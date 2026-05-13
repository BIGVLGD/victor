const express = require('express');
const cors = require('cors');
const path = require('path');
require('./db'); // initialize DB

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

app.use(cors({ origin: isProd ? true : 'http://localhost:5173' }));
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

// Debug endpoint - shows DB state
app.get('/api/debug-db', (req, res) => {
  const db = require('./db');
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'axiom-lab.db');
  const sales = db.prepare('SELECT COUNT(*) as c FROM sales').get().c;
  const customers = db.prepare('SELECT COUNT(*) as c FROM customers').get().c;
  const users = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const fs = require('fs');
  const size = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : -1;
  res.json({ dbPath, size, sales, customers, users, node: process.version });
});

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
  const fs = require('fs');
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'axiom-lab.db');
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="axiom-lab-backup-${new Date().toISOString().split('T')[0]}.db"`);
  fs.createReadStream(dbPath).pipe(res);
});

// Database restore (admin only)
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
app.post('/api/restore-db', requireAuth, upload.single('database'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'axiom-lab.db');
  try {
    // Verify uploaded file is valid SQLite
    const Database = require('better-sqlite3');
    const tempPath = path.join(os.tmpdir(), `verify-${Date.now()}.db`);
    fs.writeFileSync(tempPath, req.file.buffer);
    const check = new Database(tempPath, { readonly: true });
    const salesCount = check.prepare('SELECT COUNT(*) as c FROM sales').get().c;
    const usersCount = check.prepare('SELECT COUNT(*) as c FROM users').get().c;
    check.close();
    fs.unlinkSync(tempPath);

    if (usersCount === 0) return res.status(400).json({ error: 'Invalid backup file' });

    // Write directly to DB path and restart
    fs.writeFileSync(dbPath, req.file.buffer);
    res.json({ message: 'ok', salesInBackup: salesCount });
    setTimeout(() => { try { db.close(); } catch {} process.exit(1); }, 800);
  } catch (err) {
    console.error('Restore error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend in production
if (isProd) {
  const frontendDist = path.join(__dirname, '../frontend/dist');
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🧪 Axiom Lab API running on port ${PORT}`);
  console.log(`   Mode: ${isProd ? 'production' : 'development'}\n`);
});
