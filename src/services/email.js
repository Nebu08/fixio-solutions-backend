import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendDeliveryCodeEmail = async (customerEmail, customerName, orderId, code) => {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[EMAIL SIMULADO] RESEND_API_KEY no configurado.`);
    console.log(`[EMAIL SIMULADO] A: ${customerEmail} | Código para orden ${orderId}: ${code}`);
    return { success: true, simulated: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'Fixio Solutions <onboarding@resend.dev>', // Usamos email de pruebas de resend por defecto
      to: [customerEmail],
      subject: `Código de verificación para tu entrega - Orden ${orderId}`,
      html: `
        <h2>Hola ${customerName},</h2>
        <p>Tu orden <strong>${orderId}</strong> está en camino.</p>
        <p>Por seguridad, el repartidor te pedirá el siguiente código de 6 dígitos al momento de la entrega:</p>
        <h1 style="letter-spacing: 5px; font-size: 32px; color: #2e7d32;">${code}</h1>
        <p>Por favor, tenlo a la mano.</p>
        <p>Gracias por comprar en Fixio Solutions.</p>
      `,
    });

    if (error) {
      console.error('Error enviando correo Resend:', error);
      return { success: false, error };
    }
    return { success: true, data };
  } catch (error) {
    console.error('Excepción al enviar correo:', error);
    return { success: false, error };
  }
};

export const sendPaymentNotificationEmail = async (orderId, paymentStatus, customerName, total) => {
  if (!process.env.RESEND_API_KEY) return;

  const statusES = paymentStatus === 'approved' ? 'Aprobado' : (paymentStatus === 'rejected' ? 'Rechazado' : 'Pendiente/En Proceso');
  const color = paymentStatus === 'approved' ? '#2e7d32' : (paymentStatus === 'rejected' ? '#d32f2f' : '#ed6c02');

  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'fixiosoluions@gmail.com';
    await resend.emails.send({
      from: 'Fixio Solutions <onboarding@resend.dev>',
      to: [adminEmail],
      subject: `Notificación de Pago MP: Orden ${orderId} - ${statusES}`,
      html: `
        <h2>Hola Admin,</h2>
        <p>Se ha registrado una actualización de pago vía Mercado Pago (Webhook).</p>
        <ul>
          <li><strong>Orden ID:</strong> ${orderId}</li>
          <li><strong>Cliente:</strong> ${customerName || 'N/A'}</li>
          <li><strong>Monto Total:</strong> $${total || 'N/A'}</li>
          <li><strong>Estado del Pago:</strong> <b style="color: ${color};">${statusES}</b></li>
        </ul>
        <p>Revisa el <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin">Panel de Administración</a> para gestionar esta orden.</p>
      `,
    });
    console.log(`[EMAIL] Notificación de pago enviada a ${adminEmail}`);
  } catch (error) {
    console.error('Error enviando notificación de pago al admin:', error);
  }
};
