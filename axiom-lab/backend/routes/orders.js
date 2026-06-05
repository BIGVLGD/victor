const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const orders = db.prepare(`
    SELECT o.*, s.name as supplier_name,
      (SELECT COUNT(*) FROM supplier_order_items WHERE order_id = o.id) as item_count
    FROM supplier_orders o
    LEFT JOIN suppliers s ON o.supplier_id = s.id
    ORDER BY o.date DESC
  `).all();
  res.json(orders);
});

router.get('/:id', requireAuth, (req, res) => {
  const order = db.prepare(`
    SELECT o.*, s.name as supplier_name
    FROM supplier_orders o LEFT JOIN suppliers s ON o.supplier_id = s.id
    WHERE o.id = ?
  `).get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  const items = db.prepare(`SELECT * FROM supplier_order_items WHERE order_id = ? ORDER BY id`).all(req.params.id);
  res.json({ ...order, items });
});

router.post('/', requireAuth, (req, res) => {
  const { date, supplier_id, status, total_idr, payment_method, shipping_cost_usd, notes, items } = req.body;
  if (!date || !supplier_id) return res.status(400).json({ error: 'Date and supplier required' });

  const last = db.prepare(`SELECT order_ref FROM supplier_orders ORDER BY id DESC LIMIT 1`).get();
  let nextNum = 1;
  if (last) {
    const match = last.order_ref.match(/ORD-(\d+)/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }
  const order_ref = `ORD-${String(nextNum).padStart(3, '0')}`;

  const info = db.prepare(`
    INSERT INTO supplier_orders (order_ref, date, supplier_id, status, total_idr, payment_method, shipping_cost_usd, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(order_ref, date, supplier_id, status || 'Ordered', total_idr || 0, payment_method || '', shipping_cost_usd || 0, notes || '');

  const orderId = info.lastInsertRowid;

  if (items && items.length > 0) {
    for (const item of items) {
      db.prepare(`INSERT INTO supplier_order_items (order_id, product_name, product_id, qty, unit_cost_usd) VALUES (?, ?, ?, ?, ?)`).run(orderId, item.product_name, item.product_id || null, item.qty, item.unit_cost_usd);
    }
  }

  // Update supplier total_spent
  db.prepare(`UPDATE suppliers SET total_spent = total_spent + ? WHERE id = ?`).run(total_idr || 0, supplier_id);

  db.prepare(`INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, 'create', 'supplier_order', ?, ?)`).run(req.user.id, req.user.name, String(orderId), order_ref);
  res.json(db.prepare(`SELECT * FROM supplier_orders WHERE id = ?`).get(orderId));
});

router.put('/:id', requireAuth, (req, res) => {
  const { date, supplier_id, status, total_idr, payment_method, shipping_cost_usd, notes, items } = req.body;
  const existing = db.prepare(`SELECT * FROM supplier_orders WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  db.prepare(`
    UPDATE supplier_orders SET date=?, supplier_id=?, status=?, total_idr=?, payment_method=?, shipping_cost_usd=?, notes=?, updated_at=datetime('now')
    WHERE id=?
  `).run(date, supplier_id, status, total_idr || 0, payment_method || '', shipping_cost_usd || 0, notes || '', req.params.id);

  // Update supplier spend delta
  const delta = (total_idr || 0) - (existing.total_idr || 0);
  if (delta !== 0) db.prepare(`UPDATE suppliers SET total_spent = total_spent + ? WHERE id = ?`).run(delta, supplier_id);

  if (items) {
    db.prepare(`DELETE FROM supplier_order_items WHERE order_id = ?`).run(req.params.id);
    for (const item of items) {
      db.prepare(`INSERT INTO supplier_order_items (order_id, product_name, product_id, qty, unit_cost_usd) VALUES (?, ?, ?, ?, ?)`).run(req.params.id, item.product_name, item.product_id || null, item.qty, item.unit_cost_usd);
    }
  }

  db.prepare(`INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, 'update', 'supplier_order', ?, ?)`).run(req.user.id, req.user.name, req.params.id, existing.order_ref);
  res.json(db.prepare(`SELECT * FROM supplier_orders WHERE id = ?`).get(req.params.id));
});

router.delete('/:id', requireAuth, (req, res) => {
  const o = db.prepare(`SELECT * FROM supplier_orders WHERE id = ?`).get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Not found' });
  db.prepare(`DELETE FROM supplier_orders WHERE id = ?`).run(req.params.id);
  db.prepare(`UPDATE suppliers SET total_spent = MAX(0, total_spent - ?) WHERE id = ?`).run(o.total_idr || 0, o.supplier_id);
  db.prepare(`INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, 'delete', 'supplier_order', ?, ?)`).run(req.user.id, req.user.name, req.params.id, o.order_ref);
  res.json({ ok: true });
});

module.exports = router;
