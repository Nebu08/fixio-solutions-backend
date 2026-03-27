import db from '../config/database.js';

export const getProducts = (req, res) => {
  try {
    const products = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
    
    // Parse JSON fields
    const formatted = products.map(p => ({
      ...p,
      price: p.price,
      originalPrice: p.original_price, // frontend espera camelCase
      specs: p.specs ? JSON.parse(p.specs) : [],
      featured: p.featured === 1,
      // Simplificación para reviews por ahora
      reviews: db.prepare('SELECT * FROM product_reviews WHERE product_id = ?').all(p.id)
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener productos' });
  }
};

export const getProductById = (req, res) => {
  try {
    const { id } = req.params;
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);

    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    product.specs = product.specs ? JSON.parse(product.specs) : [];
    product.featured = product.featured === 1;
    product.originalPrice = product.original_price;
    product.reviews = db.prepare('SELECT * FROM product_reviews WHERE product_id = ?').all(product.id);

    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el producto' });
  }
};

export const createProduct = (req, res) => {
  try {
    const { name, price, originalPrice, category, image, description, specs, stock, featured } = req.body;
    const id = `prod-${Date.now()}`;

    db.prepare(`
      INSERT INTO products (id, name, price, original_price, category, image, description, specs, stock, featured)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, name, parseFloat(price), originalPrice ? parseFloat(originalPrice) : null,
      category, image || null, description || null, 
      specs ? JSON.stringify(specs) : '[]', 
      parseInt(stock) || 0, featured ? 1 : 0
    );

    const newProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    newProduct.specs = JSON.parse(newProduct.specs);
    newProduct.featured = newProduct.featured === 1;
    newProduct.originalPrice = newProduct.original_price;

    res.status(201).json(newProduct);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Error al crear producto' });
  }
};

export const updateProduct = (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, originalPrice, category, image, description, specs, stock, featured } = req.body;

    const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });

    db.prepare(`
      UPDATE products 
      SET name = ?, price = ?, original_price = ?, category = ?, image = ?, 
          description = ?, specs = ?, stock = ?, featured = ?
      WHERE id = ?
    `).run(
      name, parseFloat(price), originalPrice ? parseFloat(originalPrice) : null,
      category, image || null, description || null, 
      specs ? JSON.stringify(specs) : '[]', 
      parseInt(stock) || 0, featured ? 1 : 0, id
    );

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    updated.specs = JSON.parse(updated.specs);
    updated.featured = updated.featured === 1;
    updated.originalPrice = updated.original_price;

    res.json(updated);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
};

export const deleteProduct = (req, res) => {
  try {
    const { id } = req.params;
    
    // Primero borrar reviews asociadas (por foreign key constraint si está activo)
    db.prepare('DELETE FROM product_reviews WHERE product_id = ?').run(id);
    
    const result = db.prepare('DELETE FROM products WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json({ success: true, message: 'Producto eliminado' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
};
