import { Router } from 'express';
import { createPreference, webhook } from '../controllers/payments.js';

const router = Router();

// Esta ruta no pide verificación estricta para que invitados puedan comprar,
// asegurada por el flujo de negocio del frontend.
router.post('/preference', createPreference);
router.post('/webhook', webhook);

export default router;
