const { queryOne } = require('../db/database');

const requireAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
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

    req.admin = {
      id: session.admin_id,
      name: session.name,
      email: session.email
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

module.exports = { requireAuth };
