const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'axiomlab-secret-2026';

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token' });
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    next();
  });
}

function requireFinance(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role === 'employee') return res.status(403).json({ error: 'No finance access' });
    next();
  });
}

module.exports = { requireAuth, requireAdmin, requireFinance, JWT_SECRET };
