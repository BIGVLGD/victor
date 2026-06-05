const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const products = db.prepare(`
    SELECT p.*, c.name as category_name, c.emoji as category_emoji
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    ORDER BY c.sort_order, p.name
  `).all();
  res.json(products);
});

router.get('/categories', requireAuth, (req, res) => {
  res.json(db.prepare(`SELECT * FROM categories ORDER BY sort_order`).all());
});

router.post('/categories', requireAuth, (req, res) => {
  const { name, emoji, sort_order } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const info = db.prepare(`INSERT INTO categories (name, emoji, sort_order) VALUES (?, ?, ?)`).run(name, emoji || '', sort_order || 99);
  db.prepare(`INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id) VALUES (?, ?, 'create', 'category', ?)`).run(req.user.id, req.user.name, String(info.lastInsertRowid));
  res.json(db.prepare(`SELECT * FROM categories WHERE id = ?`).get(info.lastInsertRowid));
});

router.put('/categories/:id', requireAuth, (req, res) => {
  const { name, emoji, sort_order } = req.body;
  db.prepare(`UPDATE categories SET name=?, emoji=?, sort_order=? WHERE id=?`).run(name, emoji || '', sort_order || 99, req.params.id);
  db.prepare(`INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id) VALUES (?, ?, 'update', 'category', ?)`).run(req.user.id, req.user.name, req.params.id);
  res.json(db.prepare(`SELECT * FROM categories WHERE id = ?`).get(req.params.id));
});

router.delete('/categories/:id', requireAuth, (req, res) => {
  db.prepare(`DELETE FROM categories WHERE id = ?`).run(req.params.id);
  db.prepare(`INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id) VALUES (?, ?, 'delete', 'category', ?)`).run(req.user.id, req.user.name, req.params.id);
  res.json({ ok: true });
});

router.get('/:id', requireAuth, (req, res) => {
  const p = db.prepare(`
    SELECT p.*, c.name as category_name, c.emoji as category_emoji
    FROM products p LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(p);
});

router.post('/', requireAuth, (req, res) => {
  const { sku, name, category_id, dose, sell_price, cost_price, stock, threshold, supplier_cat_no, shipping_fee_per_unit } = req.body;
  if (!sku || !name) return res.status(400).json({ error: 'SKU and name required' });
  const info = db.prepare(`
    INSERT INTO products (sku, name, category_id, dose, sell_price, cost_price, stock, threshold, supplier_cat_no, shipping_fee_per_unit)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(sku, name, category_id || null, dose || '', sell_price || 0, cost_price || 0, stock || 0, threshold || 5, supplier_cat_no || '', shipping_fee_per_unit || 0);
  db.prepare(`INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, 'create', 'product', ?, ?)`).run(req.user.id, req.user.name, String(info.lastInsertRowid), name);
  res.json(db.prepare(`SELECT p.*, c.name as category_name, c.emoji as category_emoji FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?`).get(info.lastInsertRowid));
});

router.put('/:id', requireAuth, (req, res) => {
  const { sku, name, category_id, dose, sell_price, cost_price, stock, threshold, supplier_cat_no, active, shipping_fee_per_unit } = req.body;
  db.prepare(`
    UPDATE products SET sku=?, name=?, category_id=?, dose=?, sell_price=?, cost_price=?, stock=?, threshold=?, supplier_cat_no=?, active=?, shipping_fee_per_unit=?, updated_at=datetime('now')
    WHERE id=?
  `).run(sku, name, category_id || null, dose || '', sell_price || 0, cost_price || 0, stock || 0, threshold || 5, supplier_cat_no || '', active !== undefined ? active : 1, shipping_fee_per_unit || 0, req.params.id);
  db.prepare(`INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, 'update', 'product', ?, ?)`).run(req.user.id, req.user.name, req.params.id, name);
  res.json(db.prepare(`SELECT p.*, c.name as category_name, c.emoji as category_emoji FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?`).get(req.params.id));
});

router.delete('/:id', requireAuth, (req, res) => {
  const p = db.prepare(`SELECT name FROM products WHERE id = ?`).get(req.params.id);
  db.prepare(`DELETE FROM products WHERE id = ?`).run(req.params.id);
  db.prepare(`INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, 'delete', 'product', ?, ?)`).run(req.user.id, req.user.name, req.params.id, p?.name || '');
  res.json({ ok: true });
});

module.exports = router;
