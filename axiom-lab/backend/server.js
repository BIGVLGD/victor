const express = require('express');
const cors = require('cors');
require('./db'); // initialize DB

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/finance', require('./routes/finance'));
app.use('/api/settings', require('./routes/settings'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// CSV export endpoints
const db = require('./db');
const { requireAuth } = require('./middleware/auth');

app.get('/api/export/sales', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT s.sale_ref, s.date, s.customer_name, s.sale_type, s.channel, s.subtotal, s.delivery_fee, s.discount, s.total_revenue, s.total_cost, s.profit, s.margin, s.payment_method, s.payment_status, s.order_status, s.notes FROM sales s ORDER BY s.date DESC`).all();
  const header = 'Sale Ref,Date,Customer,Type,Channel,Subtotal,Delivery,Discount,Revenue,Cost,Profit,Margin%,Payment,Pay Status,Order Status,Notes\n';
  const csv = header + rows.map(r => Object.values(r).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="axiom-sales.csv"');
  res.send(csv);
});

app.get('/api/export/products', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT p.sku, p.name, c.name as category, p.dose, p.sell_price, p.cost_price, p.stock, p.threshold, p.units_sold, p.revenue_total, p.profit_total, p.active FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY c.sort_order, p.name`).all();
  const header = 'SKU,Name,Category,Dose,Sell Price,Cost Price,Stock,Threshold,Units Sold,Revenue Total,Profit Total,Active\n';
  const csv = header + rows.map(r => Object.values(r).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="axiom-products.csv"');
  res.send(csv);
});

app.get('/api/export/customers', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT name, whatsapp, instagram, area, type, acquisition_channel, total_orders, total_units, total_spent, first_order_date, last_order_date FROM customers ORDER BY name`).all();
  const header = 'Name,WhatsApp,Instagram,Area,Type,Channel,Orders,Units,Spent,First Order,Last Order\n';
  const csv = header + rows.map(r => Object.values(r).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="axiom-customers.csv"');
  res.send(csv);
});

// SQLite backup download
app.get('/api/export/backup', requireAuth, (req, res) => {
  const path = require('path');
  const fs = require('fs');
  const dbPath = path.join(__dirname, 'axiom-lab.db');
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="axiom-lab-backup-${new Date().toISOString().split('T')[0]}.db"`);
  fs.createReadStream(dbPath).pipe(res);
});

app.listen(PORT, () => {
  console.log(`\n🧪 Axiom Lab API running on http://localhost:${PORT}`);
  console.log(`   Database: axiom-lab.db\n`);
});
