import db from '../config/database.js';

export const getBanners = (req, res) => {
  try {
    const banners = db.prepare('SELECT * FROM banners ORDER BY created_at ASC').all();
    res.json(banners);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener banners' });
  }
};

export const createBanner = (req, res) => {
  try {
    const { image, title, subtitle, link, cta_text } = req.body;
    const id = `ban-${Date.now()}`;
    
    db.prepare(`
      INSERT INTO banners (id, image, title, subtitle, link, cta_text)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, image, title || null, subtitle || null, link || null, cta_text || null);
    
    const newBanner = db.prepare('SELECT * FROM banners WHERE id = ?').get(id);
    res.status(201).json(newBanner);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear banner' });
  }
};

export const updateBanner = (req, res) => {
  try {
    const { id } = req.params;
    const { image, title, subtitle, link, cta_text } = req.body;

    const existing = db.prepare('SELECT id FROM banners WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Banner no encontrado' });

    db.prepare(`
      UPDATE banners SET image = ?, title = ?, subtitle = ?, link = ?, cta_text = ? WHERE id = ?
    `).run(image, title || null, subtitle || null, link || null, cta_text || null, id);

    const updated = db.prepare('SELECT * FROM banners WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar banner' });
  }
};

export const deleteBanner = (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM banners WHERE id = ?').run(id);
    
    if (result.changes === 0) return res.status(404).json({ error: 'Banner no encontrado' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al borrar banner' });
  }
};
