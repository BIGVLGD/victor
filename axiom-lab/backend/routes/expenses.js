const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function getRate() {
  const s = db.prepare(`SELECT value FROM settings WHERE key = 'usd_idr_rate'`).get();
  return s ? parseFloat(s.value) || 16000 : 16000;
}

function nextRef() {
  const last = db.prepare(`SELECT expense_ref FROM expenses ORDER BY id DESC LIMIT 1`).get();
  if (!last) return 'EXP-001';
  const m = last.expense_ref.match(/EXP-(\d+)/);
  return m ? `EXP-${String(parseInt(m[1]) + 1).padStart(3, '0')}` : 'EXP-001';
}

router.get('/summary', requireAuth, (req, res) => {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const allTime = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM expenses WHERE status = 'Paid'`).get();
  const thisMonth = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM expenses WHERE date >= ? AND status = 'Paid'`).get(monthStart);
  const byCategory = db.prepare(`SELECT category, COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM expenses WHERE status = 'Paid' GROUP BY category ORDER BY total DESC`).all();
  const byCategoryMonth = db.prepare(`SELECT category, COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM expenses WHERE date >= ? AND status = 'Paid' GROUP BY category ORDER BY total DESC`).all(monthStart);
  const monthly = db.prepare(`SELECT substr(date, 1, 7) as month, COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM expenses WHERE status = 'Paid' GROUP BY substr(date, 1, 7) ORDER BY month`).all();

  res.json({ allTime, thisMonth, byCategory, byCategoryMonth, monthly });
});

router.get('/', requireAuth, (req, res) => {
  const { category, payment_method, paid_by, from, to } = req.query;
  let sql = `SELECT * FROM expenses WHERE 1=1`;
  const params = [];
  if (category) { sql += ` AND category = ?`; params.push(category); }
  if (payment_method) { sql += ` AND payment_method = ?`; params.push(payment_method); }
  if (paid_by) { sql += ` AND paid_by = ?`; params.push(paid_by); }
  if (from) { sql += ` AND date >= ?`; params.push(from); }
  if (to) { sql += ` AND date <= ?`; params.push(to); }
  sql += ` ORDER BY date DESC, id DESC`;
  res.json(db.prepare(sql).all(...params));
});

router.post('/', requireAuth, (req, res) => {
  const { date, category, description, amount, payment_method, paid_by, status, notes } = req.body;
  if (!date || !category || amount === undefined) return res.status(400).json({ error: 'Date, category and amount required' });
  const rate = getRate();
  const amount_usd = rate > 0 ? Math.round((amount / rate) * 100) / 100 : 0;
  const expense_ref = nextRef();
  const info = db.prepare(`
    INSERT INTO expenses (expense_ref, date, category, description, amount, amount_usd, payment_method, paid_by, status, notes, created_by_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(expense_ref, date, category, description || '', amount, amount_usd, payment_method || 'Cash', paid_by || 'Victor', status || 'Paid', notes || '', req.user.id, req.user.name);
  db.prepare(`INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, 'create', 'expense', ?, ?)`).run(req.user.id, req.user.name, String(info.lastInsertRowid), expense_ref);
  res.json(db.prepare(`SELECT * FROM expenses WHERE id = ?`).get(info.lastInsertRowid));
});

router.put('/:id', requireAuth, (req, res) => {
  const existing = db.prepare(`SELECT * FROM expenses WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { date, category, description, amount, payment_method, paid_by, status, notes } = req.body;
  const rate = getRate();
  const amt = amount !== undefined ? amount : existing.amount;
  const amount_usd = rate > 0 ? Math.round((amt / rate) * 100) / 100 : 0;
  db.prepare(`
    UPDATE expenses SET date=?, category=?, description=?, amount=?, amount_usd=?, payment_method=?, paid_by=?, status=?, notes=?, updated_at=datetime('now')
    WHERE id=?
  `).run(
    date || existing.date, category || existing.category,
    description !== undefined ? description : existing.description,
    amt, amount_usd,
    payment_method || existing.payment_method, paid_by || existing.paid_by,
    status || existing.status, notes !== undefined ? notes : existing.notes,
    req.params.id
  );
  db.prepare(`INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, 'update', 'expense', ?, ?)`).run(req.user.id, req.user.name, req.params.id, existing.expense_ref);
  res.json(db.prepare(`SELECT * FROM expenses WHERE id = ?`).get(req.params.id));
});

router.delete('/:id', requireAuth, (req, res) => {
  const exp = db.prepare(`SELECT expense_ref FROM expenses WHERE id = ?`).get(req.params.id);
  if (!exp) return res.status(404).json({ error: 'Not found' });
  db.prepare(`DELETE FROM expenses WHERE id = ?`).run(req.params.id);
  db.prepare(`INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, 'delete', 'expense', ?, ?)`).run(req.user.id, req.user.name, req.params.id, exp.expense_ref);
  res.json({ ok: true });
});

module.exports = router;
