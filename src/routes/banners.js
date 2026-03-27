import { Router } from 'express';
import { getBanners, createBanner, updateBanner, deleteBanner } from '../controllers/banners.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', getBanners);
router.post('/', verifyToken, requireAdmin, createBanner);
router.put('/:id', verifyToken, requireAdmin, updateBanner);
router.delete('/:id', verifyToken, requireAdmin, deleteBanner);

export default router;
