const express = require('express');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { query, queryOne } = require('../db/database');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const admin = await queryOne('SELECT * FROM admins WHERE LOWER(email) = LOWER($1)', [email]);

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
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await query(
      'INSERT INTO admin_sessions (id, admin_id, token, expires_at) VALUES ($1, $2, $3, $4)',
      [uuidv4(), admin.id, token, expiresAt]
    );

    // Update last login
    await query('UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [admin.id]);

    res.json({
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      await query('DELETE FROM admin_sessions WHERE token = $1', [token]);
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const session = await queryOne(`
      SELECT s.*, a.id as admin_id, a.name, a.email
      FROM admin_sessions s
      JOIN admins a ON s.admin_id = a.id
      WHERE s.token = $1 AND s.expires_at > NOW() AND a.is_active = TRUE
    `, [token]);

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
  } catch (error) {
    console.error('Auth check error:', error);
    res.status(500).json({ error: 'Auth check failed' });
  }
});

module.exports = router;
