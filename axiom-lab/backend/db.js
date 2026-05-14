const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'axiom-lab.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')),
    updated_by INTEGER
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    user_name TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    details TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    emoji TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    dose TEXT DEFAULT '',
    sell_price INTEGER NOT NULL DEFAULT 0,
    cost_price INTEGER NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    threshold INTEGER NOT NULL DEFAULT 5,
    active INTEGER NOT NULL DEFAULT 1,
    supplier_cat_no TEXT DEFAULT '',
    units_sold INTEGER NOT NULL DEFAULT 0,
    revenue_total INTEGER NOT NULL DEFAULT 0,
    profit_total INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    aka TEXT DEFAULT '',
    country TEXT DEFAULT '',
    website TEXT DEFAULT '',
    contact_name TEXT DEFAULT '',
    whatsapp TEXT DEFAULT '',
    email TEXT DEFAULT '',
    bank_details TEXT DEFAULT '',
    payment_methods TEXT DEFAULT '',
    min_order TEXT DEFAULT '',
    avg_delivery TEXT DEFAULT '',
    rating INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    total_spent INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS supplier_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_ref TEXT UNIQUE NOT NULL,
    date TEXT NOT NULL,
    supplier_id INTEGER REFERENCES suppliers(id),
    status TEXT NOT NULL DEFAULT 'Ordered',
    total_idr INTEGER DEFAULT 0,
    payment_method TEXT DEFAULT '',
    shipping_cost_usd REAL DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS supplier_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER REFERENCES supplier_orders(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    product_id INTEGER REFERENCES products(id),
    qty INTEGER NOT NULL DEFAULT 0,
    unit_cost_usd REAL NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    whatsapp TEXT DEFAULT '',
    instagram TEXT DEFAULT '',
    area TEXT DEFAULT '',
    type TEXT DEFAULT 'Regular',
    acquisition_channel TEXT DEFAULT '',
    referral_code TEXT DEFAULT '',
    commission_rate REAL DEFAULT 0,
    notes TEXT DEFAULT '',
    tags TEXT DEFAULT '',
    total_orders INTEGER DEFAULT 0,
    total_units INTEGER DEFAULT 0,
    total_spent INTEGER DEFAULT 0,
    first_order_date TEXT DEFAULT '',
    last_order_date TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_ref TEXT UNIQUE NOT NULL,
    date TEXT NOT NULL,
    customer_id INTEGER REFERENCES customers(id),
    customer_name TEXT DEFAULT '',
    sale_type TEXT DEFAULT 'Individual',
    channel TEXT DEFAULT 'WhatsApp',
    subtotal INTEGER DEFAULT 0,
    delivery_fee INTEGER DEFAULT 0,
    discount INTEGER DEFAULT 0,
    total_revenue INTEGER DEFAULT 0,
    total_cost INTEGER DEFAULT 0,
    profit INTEGER DEFAULT 0,
    margin REAL DEFAULT 0,
    payment_method TEXT DEFAULT 'Cash',
    payment_status TEXT DEFAULT 'Paid',
    order_status TEXT DEFAULT 'Delivered',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    product_name TEXT NOT NULL,
    qty INTEGER NOT NULL DEFAULT 1,
    unit_price INTEGER NOT NULL DEFAULT 0,
    unit_cost INTEGER NOT NULL DEFAULT 0,
    line_total INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT DEFAULT 'General',
    priority INTEGER DEFAULT 2,
    status TEXT DEFAULT 'open',
    assigned_to TEXT DEFAULT '',
    due_date TEXT DEFAULT '',
    completed_at TEXT DEFAULT '',
    created_by_id INTEGER,
    created_by TEXT DEFAULT '',
    notify INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS todo_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    todo_id INTEGER REFERENCES todos(id) ON DELETE CASCADE,
    user_id INTEGER,
    user_name TEXT DEFAULT '',
    body TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS todo_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    todo_id INTEGER REFERENCES todos(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    size INTEGER DEFAULT 0,
    mime_type TEXT DEFAULT '',
    data BLOB,
    created_by TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

module.exports = db;
