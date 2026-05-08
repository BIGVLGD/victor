const express = require('express');
const db = require('../db');
const bcrypt = require('bcryptjs');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT * FROM settings`).all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  res.json(settings);
});

router.put('/', requireAuth, (req, res) => {
  const updates = req.body;
  const stmt = db.prepare(`INSERT OR REPLACE INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, datetime('now'), ?)`);
  for (const [key, value] of Object.entries(updates)) {
    stmt.run(key, String(value), req.user.id);
  }
  db.prepare(`INSERT INTO activity_log (user_id, user_name, action, entity_type, details) VALUES (?, ?, 'update', 'settings', ?)`).run(req.user.id, req.user.name, Object.keys(updates).join(', '));
  res.json({ ok: true });
});

// Users
router.get('/users', requireAdmin, (req, res) => {
  res.json(db.prepare(`SELECT id, name, email, role, created_at FROM users ORDER BY id`).all());
});

router.post('/users', requireAdmin, (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, password required' });
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare(`INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)`).run(name, email, hash, role || 'employee');
  db.prepare(`INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, 'create', 'user', ?, ?)`).run(req.user.id, req.user.name, String(info.lastInsertRowid), email);
  res.json(db.prepare(`SELECT id, name, email, role, created_at FROM users WHERE id = ?`).get(info.lastInsertRowid));
});

router.put('/users/:id', requireAdmin, (req, res) => {
  const { name, email, role, password } = req.body;
  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare(`UPDATE users SET name=?, email=?, role=?, password_hash=?, updated_at=datetime('now') WHERE id=?`).run(name, email, role, hash, req.params.id);
  } else {
    db.prepare(`UPDATE users SET name=?, email=?, role=?, updated_at=datetime('now') WHERE id=?`).run(name, email, role, req.params.id);
  }
  db.prepare(`INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, 'update', 'user', ?, ?)`).run(req.user.id, req.user.name, req.params.id, email);
  res.json(db.prepare(`SELECT id, name, email, role, created_at FROM users WHERE id = ?`).get(req.params.id));
});

router.delete('/users/:id', requireAdmin, (req, res) => {
  if (String(req.params.id) === String(req.user.id)) return res.status(400).json({ error: 'Cannot delete yourself' });
  const u = db.prepare(`SELECT email FROM users WHERE id = ?`).get(req.params.id);
  db.prepare(`DELETE FROM users WHERE id = ?`).run(req.params.id);
  db.prepare(`INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, 'delete', 'user', ?, ?)`).run(req.user.id, req.user.name, req.params.id, u?.email || '');
  res.json({ ok: true });
});

// Activity log
router.get('/activity', requireAdmin, (req, res) => {
  res.json(db.prepare(`SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 500`).all());
});

module.exports = router;
