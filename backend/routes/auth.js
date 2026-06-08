const express = require('express');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('../db/database');

const router = express.Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const admin = db.prepare('SELECT * FROM admins WHERE LOWER(email) = LOWER(?)').get(email);

  if (!admin) {
    return res.status(401).json({ error: 'You do not have admin access. Please contact an administrator if you need access.' });
  }

  if (!admin.is_active) {
    return res.status(401).json({ error: 'Your admin account has been deactivated. Please contact an administrator.' });
  }

  const validPassword = bcrypt.compareSync(password, admin.password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Incorrect password. Please try again.' });
  }

  // Create session token
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

  db.prepare(`
    INSERT INTO admin_sessions (id, admin_id, token, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(uuidv4(), admin.id, token, expiresAt);

  // Update last login
  db.prepare('UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(admin.id);

  res.json({
    token,
    admin: {
      id: admin.id,
      name: admin.name,
      email: admin.email
    }
  });
});

router.post('/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (token) {
    db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
  }

  res.json({ message: 'Logged out successfully' });
});

router.get('/me', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const session = db.prepare(`
    SELECT s.*, a.id as admin_id, a.name, a.email
    FROM admin_sessions s
    JOIN admins a ON s.admin_id = a.id
    WHERE s.token = ? AND s.expires_at > datetime('now') AND a.is_active = 1
  `).get(token);

  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  res.json({
    admin: {
      id: session.admin_id,
      name: session.name,
      email: session.email
    }
  });
});

module.exports = router;
