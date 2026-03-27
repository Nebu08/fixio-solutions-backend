import crypto from 'crypto';
import { createMpPreference, getMpPayment } from '../config/mercadopago.js';
import db from '../config/database.js';
import { sendPaymentNotificationEmail } from '../services/email.js';

export const createPreference = async (req, res) => {
  try {
    const orderData = req.body;
    
    // Si no hay token de MP, simulamos la respuesta (para fase de desarrollo sin credenciales)
    if (!process.env.MP_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN.includes('TU_ACCESS_TOKEN')) {
      return res.json({
        preferenceId: `PREF-MOCK-${Date.now()}`,
        initPoint: null,
        sandboxInitPoint: null,
        isMock: true
      });
    }

    // Formatear items para MercadoPago
    const items = orderData.items.map(item => ({
      id: item.id,
      title: item.name,
      unit_price: Math.round(Number(item.price)), // MP (COP) exige que sea un entero
      quantity: Number(item.quantity)
      // Se elimina currency_id para que MercadoPago use la moneda por defecto del token
    }));

    // Si hay envío por transportadora, se maneja aparte por el equipo.
    // Si la orden ya calcula el envío gratis en Bogotá, está bien.

    // Resolver la URL de retorno, previendo que FRONTEND_URL esté undefined o malformado
    const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    const isLocalhost = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');

    const preferenceData = {
      items,
      payer: {
        name: orderData.customer.name,
        email: orderData.customer.email
        // phone omitido para prevenir error 400 de formato inválido
      },
      external_reference: orderData.id,
      back_urls: {
        success: `${baseUrl}/cart?payment=success`,
        failure: `${baseUrl}/cart?payment=failure`,
        pending: `${baseUrl}/cart?payment=pending`
      },
      // auto_return solo funciona con URLs HTTPS públicas — no en localhost
      // En producción (dominio real) se activa automáticamente
      ...(!isLocalhost && { auto_return: 'approved' }),
      // Webhook: descomentar cuando se despliegue online
      // notification_url: `${baseUrl}/api/payments/webhook`
    };

    const result = await createMpPreference(preferenceData);

    res.json({
      preferenceId: result.id,
      initPoint: result.init_point,
      sandboxInitPoint: result.sandbox_init_point,
      isMock: false
    });
  } catch (error) {
    if (error.cause) console.error('Error MP Cause:', error.cause);
    if (error.response) console.error('Error MP Response:', JSON.stringify(error.response, null, 2));
    console.error('Error creando preferencia MP:', error.message);
    res.status(500).json({ error: 'Error al conectar con pasarela de pago', detail: error.cause || error.message });
  }
};

export const webhook = async (req, res) => {
  // Webhook recibe actualizaciones de estado (IPN) de MercadoPago
  // Respondemos inmediatamente con HTTP 200 como pide MercadoPago
  res.status(200).send('OK');

  try {
    const xSignature = req.headers['x-signature'];
    const xRequestId = req.headers['x-request-id'];
    const dataId = req.query['data.id'] || req.body?.data?.id;

    if (!xSignature || !xRequestId || !dataId) {
      console.warn('Webhook MP: Faltan headers de validación');
      return;
    }

    // Validación HMAC
    const parts = xSignature.split(',');
    let ts, v1;
    parts.forEach(part => {
      const [key, value] = part.split('=');
      if (key && value) {
        if (key.trim() === 'ts') ts = value.trim();
        if (key.trim() === 'v1') v1 = value.trim();
      }
    });

    const secret = process.env.MP_WEBHOOK_SECRET;
    if (secret && ts && v1) {
      const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(manifest);
      const sha = hmac.digest('hex');

      if (sha !== v1) {
        console.error('Webhook MP: ALERTA - Validación HMAC DENEGADA');
        return; // IGNORAR LA PETICIÓN
      }
    } else {
      console.warn('Webhook MP: No hay MP_WEBHOOK_SECRET en .env, saltando seguridad');
    }

    const { action } = req.body;
    
    if (action === 'payment.created' || action === 'payment.updated') {
      const payment = await getMpPayment(dataId);
      
      const externalReference = payment.external_reference;
      const paymentStatus = payment.status; // 'approved', 'rejected', 'in_process', etc.
      
      if (externalReference) {
        db.prepare('UPDATE orders SET payment_status = ?, payment_id = ? WHERE id = ?')
          .run(paymentStatus, payment.id.toString(), externalReference);
          
        console.log(`Webhook MP: Orden ${externalReference} actualizada a payment_status: ${paymentStatus}`);

        // Obtener detalles de la orden para el correo
        const orderInfo = db.prepare('SELECT customer, total FROM orders WHERE id = ?').get(externalReference);
        if (orderInfo && orderInfo.customer) {
          try {
            const customerData = JSON.parse(orderInfo.customer);
            await sendPaymentNotificationEmail(externalReference, paymentStatus, customerData.name, orderInfo.total);
          } catch (err) {
            console.error('Error enviando notificación por correo:', err);
          }
        }
      } else {
        console.warn(`Webhook MP: Pago ${payment.id} no tiene external_reference`);
      }
    }
  } catch (error) {
    if (error.response) {
      console.error('Webhook API error:', error.response);
    } else {
      console.error('Webhook error:', error.message);
    }
  }
};
