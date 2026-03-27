import { Router } from 'express';
import { getBlogs, getBlogById, createBlog, updateBlog, deleteBlog, getCommentsByBlogId, createComment } from '../controllers/blogs.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Públicas
router.get('/', getBlogs);
router.get('/:id', getBlogById);
router.get('/:id/comments', getCommentsByBlogId);

// Autenticadas (Cualquier usuario logueado puede comentar)
router.post('/:id/comments', verifyToken, createComment);

// Protegidas (Solo Admin puede gestionar contenido editorial)
router.post('/', verifyToken, requireAdmin, createBlog);
router.put('/:id', verifyToken, requireAdmin, updateBlog);
router.delete('/:id', verifyToken, requireAdmin, deleteBlog);

export default router;
