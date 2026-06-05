const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  res.json(db.prepare(`SELECT * FROM suppliers ORDER BY name`).all());
});

router.get('/:id', requireAuth, (req, res) => {
  const supplier = db.prepare(`SELECT * FROM suppliers WHERE id = ?`).get(req.params.id);
  if (!supplier) return res.status(404).json({ error: 'Not found' });
  const orders = db.prepare(`SELECT * FROM supplier_orders WHERE supplier_id = ? ORDER BY date DESC`).all(req.params.id);
  res.json({ ...supplier, orders });
});

router.post('/', requireAuth, (req, res) => {
  const { name, aka, country, website, contact_name, whatsapp, email, bank_details, payment_methods, min_order, avg_delivery, rating, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const info = db.prepare(`
    INSERT INTO suppliers (name, aka, country, website, contact_name, whatsapp, email, bank_details, payment_methods, min_order, avg_delivery, rating, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, aka || '', country || '', website || '', contact_name || '', whatsapp || '', email || '', bank_details || '', payment_methods || '', min_order || '', avg_delivery || '', rating || 0, notes || '');
  db.prepare(`INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, 'create', 'supplier', ?, ?)`).run(req.user.id, req.user.name, String(info.lastInsertRowid), name);
  res.json(db.prepare(`SELECT * FROM suppliers WHERE id = ?`).get(info.lastInsertRowid));
});

router.put('/:id', requireAuth, (req, res) => {
  const { name, aka, country, website, contact_name, whatsapp, email, bank_details, payment_methods, min_order, avg_delivery, rating, notes } = req.body;
  db.prepare(`
    UPDATE suppliers SET name=?, aka=?, country=?, website=?, contact_name=?, whatsapp=?, email=?, bank_details=?, payment_methods=?, min_order=?, avg_delivery=?, rating=?, notes=?, updated_at=datetime('now')
    WHERE id=?
  `).run(name, aka || '', country || '', website || '', contact_name || '', whatsapp || '', email || '', bank_details || '', payment_methods || '', min_order || '', avg_delivery || '', rating || 0, notes || '', req.params.id);
  db.prepare(`INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, 'update', 'supplier', ?, ?)`).run(req.user.id, req.user.name, req.params.id, name);
  res.json(db.prepare(`SELECT * FROM suppliers WHERE id = ?`).get(req.params.id));
});

router.delete('/:id', requireAuth, (req, res) => {
  const s = db.prepare(`SELECT name FROM suppliers WHERE id = ?`).get(req.params.id);
  db.prepare(`DELETE FROM suppliers WHERE id = ?`).run(req.params.id);
  db.prepare(`INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, 'delete', 'supplier', ?, ?)`).run(req.user.id, req.user.name, req.params.id, s?.name || '');
  res.json({ ok: true });
});

module.exports = router;
