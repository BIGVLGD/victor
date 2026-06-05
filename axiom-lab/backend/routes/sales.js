const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const sales = db.prepare(`
    SELECT s.*, c.name as customer_name_join,
      (SELECT GROUP_CONCAT(si.product_name || ' x' || si.qty, ', ') FROM sale_items si WHERE si.sale_id = s.id) as items_summary,
      (SELECT SUM(si.qty) FROM sale_items si WHERE si.sale_id = s.id) as units
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    ORDER BY s.date DESC, s.sale_ref DESC
  `).all();
  res.json(sales);
});

router.get('/:id', requireAuth, (req, res) => {
  const sale = db.prepare(`SELECT s.* FROM sales s WHERE s.id = ?`).get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'Not found' });
  const items = db.prepare(`SELECT si.*, p.sku FROM sale_items si LEFT JOIN products p ON si.product_id = p.id WHERE si.sale_id = ?`).all(req.params.id);
  res.json({ ...sale, items });
});

router.post('/', requireAuth, (req, res) => {
  const { date, customer_id, customer_name, sale_type, channel, items, delivery_fee, discount, payment_method, payment_status, order_status, notes } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'Items required' });

  // Auto-generate sale_ref
  const last = db.prepare(`SELECT sale_ref FROM sales ORDER BY id DESC LIMIT 1`).get();
  let nextNum = 1;
  if (last) {
    const match = last.sale_ref.match(/S(\d+)/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }
  const sale_ref = `S${String(nextNum).padStart(3, '0')}`;

  let subtotal = 0;
  let totalCost = 0;
  for (const item of items) {
    subtotal += item.unit_price * item.qty;
    totalCost += item.unit_cost * item.qty;
  }
  const del = delivery_fee || 0;
  const disc = discount || 0;
  const totalRevenue = subtotal + del - disc;
  const profit = totalRevenue - totalCost;
  const margin = totalRevenue > 0 ? Math.round((profit / totalRevenue) * 10000) / 100 : 0;

  const info = db.prepare(`
    INSERT INTO sales (sale_ref, date, customer_id, customer_name, sale_type, channel, subtotal, delivery_fee, discount, total_revenue, total_cost, profit, margin, payment_method, payment_status, order_status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(sale_ref, date, customer_id || null, customer_name || '', sale_type || 'Individual', channel || 'WhatsApp', subtotal, del, disc, totalRevenue, totalCost, profit, margin, payment_method || 'Cash', payment_status || 'Paid', order_status || 'Delivered', notes || '');

  const saleId = info.lastInsertRowid;

  for (const item of items) {
    db.prepare(`INSERT INTO sale_items (sale_id, product_id, product_name, qty, unit_price, unit_cost, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      saleId, item.product_id, item.product_name, item.qty, item.unit_price, item.unit_cost, item.unit_price * item.qty
    );
    // Decrement stock
    db.prepare(`UPDATE products SET stock = MAX(0, stock - ?), units_sold = units_sold + ?, revenue_total = revenue_total + ?, profit_total = profit_total + ?, updated_at = datetime('now') WHERE id = ?`)
      .run(item.qty, item.qty, item.unit_price * item.qty, (item.unit_price - item.unit_cost) * item.qty, item.product_id);
  }

  // Update customer stats
  if (customer_id) {
    db.prepare(`UPDATE customers SET total_orders=total_orders+1, total_units=total_units+?, total_spent=total_spent+?, last_order_date=?, first_order_date=CASE WHEN first_order_date='' THEN ? ELSE first_order_date END, updated_at=datetime('now') WHERE id=?`)
      .run(items.reduce((s, i) => s + i.qty, 0), totalRevenue, date, date, customer_id);
  }

  db.prepare(`INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, 'create', 'sale', ?, ?)`).run(req.user.id, req.user.name, String(saleId), sale_ref);

  res.json(db.prepare(`SELECT * FROM sales WHERE id = ?`).get(saleId));
});

router.put('/:id', requireAuth, (req, res) => {
  const { date, customer_id, customer_name, sale_type, channel, items, delivery_fee, discount, payment_method, payment_status, order_status, notes } = req.body;

  const existing = db.prepare(`SELECT * FROM sales WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  let subtotal = 0;
  let totalCost = 0;
  for (const item of items) {
    subtotal += item.unit_price * item.qty;
    totalCost += item.unit_cost * item.qty;
  }
  const del = delivery_fee || 0;
  const disc = discount || 0;
  const totalRevenue = subtotal + del - disc;
  const profit = totalRevenue - totalCost;
  const margin = totalRevenue > 0 ? Math.round((profit / totalRevenue) * 10000) / 100 : 0;

  db.prepare(`
    UPDATE sales SET date=?, customer_id=?, customer_name=?, sale_type=?, channel=?, subtotal=?, delivery_fee=?, discount=?, total_revenue=?, total_cost=?, profit=?, margin=?, payment_method=?, payment_status=?, order_status=?, notes=?, updated_at=datetime('now')
    WHERE id=?
  `).run(date, customer_id || null, customer_name || '', sale_type, channel, subtotal, del, disc, totalRevenue, totalCost, profit, margin, payment_method, payment_status, order_status, notes || '', req.params.id);

  // Replace items
  db.prepare(`DELETE FROM sale_items WHERE sale_id = ?`).run(req.params.id);
  for (const item of items) {
    db.prepare(`INSERT INTO sale_items (sale_id, product_id, product_name, qty, unit_price, unit_cost, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      req.params.id, item.product_id, item.product_name, item.qty, item.unit_price, item.unit_cost, item.unit_price * item.qty
    );
  }

  db.prepare(`INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, 'update', 'sale', ?, ?)`).run(req.user.id, req.user.name, req.params.id, existing.sale_ref);
  res.json(db.prepare(`SELECT * FROM sales WHERE id = ?`).get(req.params.id));
});

router.delete('/:id', requireAuth, (req, res) => {
  const sale = db.prepare(`SELECT sale_ref FROM sales WHERE id = ?`).get(req.params.id);
  db.prepare(`DELETE FROM sales WHERE id = ?`).run(req.params.id);
  db.prepare(`INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, 'delete', 'sale', ?, ?)`).run(req.user.id, req.user.name, req.params.id, sale?.sale_ref || '');
  res.json({ ok: true });
});

router.get('/:id/items', requireAuth, (req, res) => {
  res.json(db.prepare(`SELECT si.*, p.sku FROM sale_items si LEFT JOIN products p ON si.product_id = p.id WHERE si.sale_id = ?`).all(req.params.id));
});

module.exports = router;
