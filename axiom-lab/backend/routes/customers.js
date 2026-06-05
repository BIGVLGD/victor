const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  res.json(db.prepare(`SELECT * FROM customers ORDER BY name`).all());
});

router.get('/:id', requireAuth, (req, res) => {
  const customer = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Not found' });
  const orders = db.prepare(`
    SELECT s.*, GROUP_CONCAT(si.product_name || ' x' || si.qty, ', ') as items_summary
    FROM sales s
    LEFT JOIN sale_items si ON si.sale_id = s.id
    WHERE s.customer_id = ?
    GROUP BY s.id
    ORDER BY s.date DESC
  `).all(req.params.id);
  res.json({ ...customer, orders });
});

router.post('/', requireAuth, (req, res) => {
  const { name, whatsapp, instagram, area, type, acquisition_channel, referral_code, commission_rate, notes, tags } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const info = db.prepare(`
    INSERT INTO customers (name, whatsapp, instagram, area, type, acquisition_channel, referral_code, commission_rate, notes, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, whatsapp || '', instagram || '', area || '', type || 'Regular', acquisition_channel || '', referral_code || '', commission_rate || 0, notes || '', tags || '');
  db.prepare(`INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, 'create', 'customer', ?, ?)`).run(req.user.id, req.user.name, String(info.lastInsertRowid), name);
  res.json(db.prepare(`SELECT * FROM customers WHERE id = ?`).get(info.lastInsertRowid));
});

router.put('/:id', requireAuth, (req, res) => {
  const { name, whatsapp, instagram, area, type, acquisition_channel, referral_code, commission_rate, notes, tags } = req.body;
  db.prepare(`
    UPDATE customers SET name=?, whatsapp=?, instagram=?, area=?, type=?, acquisition_channel=?, referral_code=?, commission_rate=?, notes=?, tags=?, updated_at=datetime('now')
    WHERE id=?
  `).run(name, whatsapp || '', instagram || '', area || '', type || 'Regular', acquisition_channel || '', referral_code || '', commission_rate || 0, notes || '', tags || '', req.params.id);
  db.prepare(`INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, 'update', 'customer', ?, ?)`).run(req.user.id, req.user.name, req.params.id, name);
  res.json(db.prepare(`SELECT * FROM customers WHERE id = ?`).get(req.params.id));
});

router.delete('/:id', requireAuth, (req, res) => {
  const c = db.prepare(`SELECT name FROM customers WHERE id = ?`).get(req.params.id);
  db.prepare(`DELETE FROM customers WHERE id = ?`).run(req.params.id);
  db.prepare(`INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, 'delete', 'customer', ?, ?)`).run(req.user.id, req.user.name, req.params.id, c?.name || '');
  res.json({ ok: true });
});

module.exports = router;
