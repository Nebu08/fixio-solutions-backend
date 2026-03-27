import { Router } from 'express';
import { register, login, googleLogin, getMe } from '../controllers/auth.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.get('/me', verifyToken, getMe);

export default router;
