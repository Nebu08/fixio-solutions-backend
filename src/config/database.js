import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Crear carpeta de config si no existe (?) -> better-sqlite crea el archivo en root
const dbPath = path.resolve(__dirname, '../../database.db');
const db = new Database(dbPath, { verbose: console.log });

export const initializeDatabase = () => {
  // Crear tablas
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      phone TEXT,
      address TEXT,
      role TEXT DEFAULT 'customer',
      provider TEXT DEFAULT 'email',
      google_id TEXT,
      picture TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      original_price REAL,
      category TEXT NOT NULL,
      image TEXT,
      description TEXT,
      specs TEXT, -- JSON
      stock INTEGER DEFAULT 0,
      featured INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      customer TEXT NOT NULL, -- JSON
      items TEXT NOT NULL, -- JSON
      subtotal REAL NOT NULL,
      total REAL NOT NULL,
      shipping_type TEXT,
      shipping_city TEXT,
      status TEXT DEFAULT 'Recibido',
      payment_id TEXT,
      payment_status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS product_reviews (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT,
      date TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
  `);

  try {
    db.prepare('ALTER TABLE orders ADD COLUMN delivery_code TEXT').run();
  } catch (err) {
    // La columna ya existe
  }

  // Nuevas tablas para Blogs y Banners
  db.prepare(`
    CREATE TABLE IF NOT EXISTS banners (
      id TEXT PRIMARY KEY,
      image TEXT NOT NULL,
      title TEXT,
      subtitle TEXT,
      link TEXT,
      cta_text TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS blogs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      excerpt TEXT,
      content TEXT NOT NULL,
      image TEXT,
      author TEXT,
      date TEXT NOT NULL
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS blog_comments (
      id TEXT PRIMARY KEY,
      blog_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (blog_id) REFERENCES blogs(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `).run();

  // Sembrar usuario admin si no existe
  const adminExists = db.prepare("SELECT id FROM users WHERE email = 'admin@fixio.com'").get();
  if (!adminExists) {
    import('bcryptjs').then(({ default: bcrypt }) => {
      const hash = bcrypt.hashSync('admin123', 10);
      db.prepare(`
        INSERT INTO users (id, name, email, password_hash, role, provider)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('u_admin', 'Administrador', 'admin@fixio.com', hash, 'admin', 'email');
    });
  }

  // Sembrar usuario demo de cliente si no existe
  const customerExists = db.prepare("SELECT id FROM users WHERE email = 'maria@ejemplo.com'").get();
  if (!customerExists) {
    import('bcryptjs').then(({ default: bcrypt }) => {
      const hash = bcrypt.hashSync('cliente123', 10);
      db.prepare(`
        INSERT INTO users (id, name, email, password_hash, role, provider)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('u_demo', 'María García', 'maria@ejemplo.com', hash, 'customer', 'email');
    });
  }

  // Sembrar primer producto si está vacía
  const productCount = db.prepare("SELECT count(*) as count FROM products").get().count;
  if (productCount === 0) {
    const defaultProduct = {
      id: 'prod-1',
      name: 'Aspiradora Robot Inteligente',
      price: 299.99,
      original_price: 349.99,
      category: 'Hogar Práctico',
      image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?q=80&w=800&auto=format&fit=crop',
      featured: 1,
      description: 'Olvídate de limpiar el piso. Este robot inteligente limpia tu hogar.',
      specs: JSON.stringify(['Control por App', 'Sistema Anticaídas']),
      stock: 15
    };

    db.prepare(`
      INSERT INTO products (id, name, price, original_price, category, image, featured, description, specs, stock)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      defaultProduct.id, defaultProduct.name, defaultProduct.price, defaultProduct.original_price,
      defaultProduct.specs, defaultProduct.stock
    );
  }

  // Sembrar banners default
  const bannersCount = db.prepare('SELECT COUNT(*) as count FROM banners').get();
  if (bannersCount.count === 0) {
    db.prepare(`INSERT INTO banners (id, image, title, subtitle, link, cta_text) VALUES (?, ?, ?, ?, ?, ?)`).run(
      'ban-1', '/images/hero-1.jpg', 'Domótica Fácil y Accesible', 'Convierte tu casa en un hogar inteligente hoy mismo', '/catalog', 'Ver Ofertas'
    );
    db.prepare(`INSERT INTO banners (id, image, title, subtitle, link, cta_text) VALUES (?, ?, ?, ?, ?, ?)`).run(
      'ban-2', '/images/hero-2.jpg', 'Seguridad al Alcance de tu Mano', 'Cámaras y cerraduras inteligentes con instalación incluida', '/catalog', 'Comprar Ahora'
    );
  }

  // Sembrar blog default
  const blogsCount = db.prepare('SELECT COUNT(*) as count FROM blogs').get();
  if (blogsCount.count === 0) {
    db.prepare(`INSERT INTO blogs (id, title, excerpt, content, image, author, date) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      'blog-1', 
      'Cómo elegir tu primera cámara de seguridad WiFi', 
      'Descubre los factores clave que debes considerar antes de comprar una cámara inteligente para el hogar.', 
      '<h3>Las cámaras WiFi son la puerta de entrada a la seguridad inteligente.</h3><p>Al buscar tu primera cámara, debes prestar atención a...</p>', 
      'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=800&q=80', 
      'Equipo Fixio', 
      new Date().toISOString()
    );
  }
};

export default db;
