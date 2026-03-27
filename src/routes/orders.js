import { Router } from 'express';
import { createOrder, getOrders, updateOrderStatus } from '../controllers/orders.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Middleware opcional para create (permite invitados)
const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    return verifyToken(req, res, next);
  }
  next();
};

router.post('/', optionalAuth, createOrder);
router.get('/', verifyToken, getOrders);
router.patch('/:id/status', verifyToken, requireAdmin, updateOrderStatus);

export default router;
