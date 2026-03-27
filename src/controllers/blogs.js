import db from '../config/database.js';

// --- BLOGS ---

export const getBlogs = (req, res) => {
  try {
    const blogs = db.prepare('SELECT * FROM blogs ORDER BY date DESC').all();
    res.json(blogs);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener blogs' });
  }
};

export const getBlogById = (req, res) => {
  try {
    const { id } = req.params;
    const blog = db.prepare('SELECT * FROM blogs WHERE id = ?').get(id);
    if (!blog) return res.status(404).json({ error: 'Blog no encontrado' });
    res.json(blog);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener blog' });
  }
};

export const createBlog = (req, res) => {
  try {
    const { title, excerpt, content, image, author } = req.body;
    const id = `blog-${Date.now()}`;
    const date = new Date().toISOString();

    db.prepare(`
      INSERT INTO blogs (id, title, excerpt, content, image, author, date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, title, excerpt || null, content, image || null, author || 'Admin', date);

    const newBlog = db.prepare('SELECT * FROM blogs WHERE id = ?').get(id);
    res.status(201).json(newBlog);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear blog' });
  }
};

export const updateBlog = (req, res) => {
  try {
    const { id } = req.params;
    const { title, excerpt, content, image, author } = req.body;

    const existing = db.prepare('SELECT id FROM blogs WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Blog no encontrado' });

    db.prepare(`
      UPDATE blogs SET title = ?, excerpt = ?, content = ?, image = ?, author = ?
      WHERE id = ?
    `).run(title, excerpt || null, content, image || null, author || 'Admin', id);

    const updated = db.prepare('SELECT * FROM blogs WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar blog' });
  }
};

export const deleteBlog = (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM blogs WHERE id = ?').run(id);
    if (result.changes === 0) return res.status(404).json({ error: 'Blog no encontrado' });
    res.json({ success: true, message: 'Blog eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar blog' });
  }
};

// --- COMMENTS ---

export const getCommentsByBlogId = (req, res) => {
  try {
    const { id } = req.params;
    const comments = db.prepare('SELECT * FROM blog_comments WHERE blog_id = ? ORDER BY created_at DESC').all(id);
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener comentarios' });
  }
};

export const createComment = (req, res) => {
  try {
    const { id: blog_id } = req.params;
    const { content } = req.body;
    // req.user has the current logged in user from verifyToken
    const user_id = req.user.id;
    const user_name = req.user.name;

    const commentId = `comm-${Date.now()}`;

    db.prepare(`
      INSERT INTO blog_comments (id, blog_id, user_id, user_name, content)
      VALUES (?, ?, ?, ?, ?)
    `).run(commentId, blog_id, user_id, user_name, content);

    const newComment = db.prepare('SELECT * FROM blog_comments WHERE id = ?').get(commentId);
    res.status(201).json(newComment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al publicar comentario' });
  }
};
