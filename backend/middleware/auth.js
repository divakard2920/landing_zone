const db = require('../db/database');

const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
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

  req.admin = {
    id: session.admin_id,
    name: session.name,
    email: session.email
  };

  next();
};

module.exports = { requireAuth };
