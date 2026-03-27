import { createMpPreference } from '../config/mercadopago.js';
import db from '../config/database.js';

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
  // Webhook recive actualizaciones de estado (IPN) de MercadoPago
  // https://www.mercadopago.com.co/developers/es/docs/your-integrations/notifications/webhooks
  res.status(200).send('OK');

  try {
    const { action, data } = req.body;
    if (action === 'payment.created' || action === 'payment.updated') {
      // 1. Obtener pago real de la API de MP usando data.id
      // 2. Actualizar database (`payment_status`, `status`) en tabla orders
      console.log('Webhook MP recibido:', data.id);
    }
  } catch (error) {
    console.error('Webhook error:', error);
  }
};
