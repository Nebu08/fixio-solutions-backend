import db from '../config/database.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

export const register = async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;

    // Verificar si el correo ya existe
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ error: 'El correo ya está registrado.' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const userId = `u_${Date.now()}`;

    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, phone, address, provider)
      VALUES (?, ?, ?, ?, ?, ?, 'email')
    `).run(userId, name, email, hashedPassword, phone || null, address || null);

    const user = { id: userId, name, email, role: 'customer' };
    const token = generateToken(user);

    res.status(201).json({ user, token });
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar el usuario' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user || user.provider !== 'email') {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }

    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }

    const userData = { id: user.id, name: user.name, email: user.email, role: user.role };
    const token = generateToken(userData);

    res.json({ user: userData, token });
  } catch (error) {
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
};

export const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    
    // Verificar token con Google
    let payload;
    try {
      if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'TU_GOOGLE_CLIENT_ID') {
        const ticket = await googleClient.verifyIdToken({
          idToken: credential,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
      } else {
        // Fallback inseguro para entorno de desarrollo sin CLIENT_ID válido
        payload = JSON.parse(atob(credential.split('.')[1]));
      }
    } catch (e) {
      console.error('Error verificando token de Google:', e);
      return res.status(401).json({ error: 'Token de Google inválido' });
    }

    const { sub: googleId, email, name, picture } = payload;

    // Buscar si el usuario ya existe
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user) {
      // Registrar nuevo usuario
      const userId = `u_g_${Date.now()}`;
      db.prepare(`
        INSERT INTO users (id, name, email, google_id, picture, provider)
        VALUES (?, ?, ?, ?, ?, 'google')
      `).run(userId, name, email, googleId, picture);
      
      user = { id: userId, name, email, role: 'customer', picture };
    } else {
      // Actualizar datos de Google si ya existía
      db.prepare(`
        UPDATE users SET google_id = ?, picture = ? WHERE id = ?
      `).run(googleId, picture, user.id);
    }

    const userData = { id: user.id, name: user.name, email: user.email, role: user.role, picture: user.picture };
    const token = generateToken(userData);

    res.json({ user: userData, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en autenticación con Google' });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = db.prepare('SELECT id, name, email, phone, address, role, picture FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
};
