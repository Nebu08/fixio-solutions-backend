import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

// Configurar con el access token del .env
// Permite inicialización lazy para no romper si el .env no está aún
let client;

export const getMpClient = () => {
  if (!client) {
    if (!process.env.MP_ACCESS_TOKEN) {
      console.warn('⚠️ MP_ACCESS_TOKEN no configurado en .env');
    }
    client = new MercadoPagoConfig({ 
      accessToken: process.env.MP_ACCESS_TOKEN || 'APP_USR-TEST', 
      options: { timeout: 5000 } 
    });
  }
  return client;
};

export const createMpPreference = async (preferenceData) => {
  const c = getMpClient();
  const preference = new Preference(c);
  return await preference.create({ body: preferenceData });
};

export const getMpPayment = async (paymentId) => {
  const c = getMpClient();
  const payment = new Payment(c);
  return await payment.get({ id: paymentId });
};
