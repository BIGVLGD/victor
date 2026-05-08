const db = require('./db');
const bcrypt = require('bcryptjs');

console.log('Seeding database...');

// Clear existing data
db.exec(`
  DELETE FROM sale_items;
  DELETE FROM sales;
  DELETE FROM supplier_order_items;
  DELETE FROM supplier_orders;
  DELETE FROM customers;
  DELETE FROM products;
  DELETE FROM categories;
  DELETE FROM suppliers;
  DELETE FROM users;
  DELETE FROM settings;
  DELETE FROM activity_log;
`);

// Reset autoincrement
db.exec(`
  DELETE FROM sqlite_sequence WHERE name IN (
    'users','settings','categories','products','suppliers',
    'supplier_orders','supplier_order_items','customers','sales','sale_items','activity_log'
  );
`);

// Settings
const insertSetting = db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`);
insertSetting.run('usd_idr_rate', '16300');
insertSetting.run('default_delivery_fee', '50000');
insertSetting.run('business_name', 'The Axiom Lab');
insertSetting.run('business_address', 'Pererenan, Bali, Indonesia');
insertSetting.run('business_phone', '+62 821 4628 2559');
insertSetting.run('business_email', 'admin@axiomresearchbali.com');
insertSetting.run('business_website', 'axiomresearchbali.com');
insertSetting.run('instagram_followers', '0');
insertSetting.run('telegram_members', '0');
insertSetting.run('gmaps_rating', '0');
insertSetting.run('gmaps_reviews', '0');

// Users
const hashAdmin = bcrypt.hashSync('axiom2026', 10);
const insertUser = db.prepare(`INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)`);
insertUser.run('Admin', 'admin@axiomlab.com', hashAdmin, 'admin');
insertUser.run('Partner', 'partner@axiomlab.com', hashAdmin, 'partner');

// Categories
const insertCat = db.prepare(`INSERT INTO categories (name, emoji, sort_order) VALUES (?, ?, ?)`);
const cats = [
  ['Fat Loss & Appetite Control', '🔥', 1],
  ['Lean Mass & Performance', '💪', 2],
  ['Healing & Recovery', '🩹', 3],
  ['Skin, Hair & Anti-Aging', '✨', 4],
  ['Aesthetics & Tanning', '🌟', 5],
  ['Longevity & Hormones', '🧬', 6],
  ['Cognitive & Nootropics', '🧠', 7],
  ['Accessories & Supplies', '🔧', 8],
];
cats.forEach(([name, emoji, sort_order]) => insertCat.run(name, emoji, sort_order));

// Get category IDs
const getCat = (name) => db.prepare(`SELECT id FROM categories WHERE name = ?`).get(name).id;
const catFatLoss = getCat('Fat Loss & Appetite Control');
const catLean = getCat('Lean Mass & Performance');
const catHealing = getCat('Healing & Recovery');
const catSkin = getCat('Skin, Hair & Anti-Aging');
const catAesthetics = getCat('Aesthetics & Tanning');
const catLongevity = getCat('Longevity & Hormones');
const catCognitive = getCat('Cognitive & Nootropics');
const catAccessories = getCat('Accessories & Supplies');

// Products
const insertProduct = db.prepare(`
  INSERT INTO products (sku, name, category_id, dose, sell_price, cost_price, stock, threshold, active, supplier_cat_no, units_sold, revenue_total, profit_total)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 0, 0, 0)
`);

const products = [
  // Fat Loss
  ['RT10', 'Retatrutide', catFatLoss, '10mg', 2800000, 221000, 16, 5, ''],
  ['RT20', 'Retatrutide', catFatLoss, '20mg', 4800000, 400000, 0, 3, ''],
  // Lean Mass
  ['CP10', 'CJC-1295 + Ipamorelin', catLean, '10mg', 1700000, 170000, 10, 3, ''],
  ['MS10', 'MOTS-C', catLean, '10mg', 1400000, 200000, 0, 3, ''],
  // Healing
  ['BC5', 'BPC-157', catHealing, '5mg', 750000, 100000, 1, 5, ''],
  ['BC10', 'BPC-157', catHealing, '10mg', 1050000, 160000, 0, 5, ''],
  ['BT10', 'TB-500', catHealing, '10mg', 2000000, 350000, 0, 3, ''],
  ['TA10', 'Thymosin Alpha 1', catHealing, '10mg', 1600000, 280000, 1, 3, ''],
  ['GLOW70', 'GLOW Stack', catHealing, '70mg', 3500000, 700000, 0, 2, ''],
  // Skin
  ['CU100', 'GHK-Cu', catSkin, '100mg', 1800000, 119000, 20, 5, ''],
  ['ET10', 'Epithalon', catSkin, '10mg', 800000, 90000, 0, 3, ''],
  ['ET20', 'Epithalon', catSkin, '20mg', 1200000, 150000, 1, 3, ''],
  // Aesthetics
  ['ML10', 'Melanotan II', catAesthetics, '10mg', 950000, 77000, 10, 3, ''],
  // Longevity
  ['NJ1000', 'NAD+', catLongevity, '1000mg', 4500000, 220000, 0, 2, ''],
  ['KS10', 'Kisspeptin', catLongevity, '10mg', 1300000, 170000, 0, 3, ''],
  // Cognitive
  ['SK10', 'Selank', catCognitive, '10mg', 1200000, 160000, 0, 3, ''],
  ['XA5', 'Semax', catCognitive, '5mg', 900000, 100000, 0, 3, ''],
  // Accessories
  ['WA3', 'BAC Water', catAccessories, '3ml', 75000, 10200, 30, 10, ''],
  ['WA10', 'BAC Water', catAccessories, '10ml', 125000, 17000, 10, 10, ''],
  ['KIT01', 'Accessory Kit', catAccessories, '', 150000, 30000, 0, 5, ''],
];

products.forEach(p => insertProduct.run(...p));

const getProduct = (sku) => db.prepare(`SELECT id, cost_price FROM products WHERE sku = ?`).get(sku);

// Supplier
const insertSupplier = db.prepare(`
  INSERT INTO suppliers (name, aka, country, contact_name, whatsapp, payment_methods, rating, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
insertSupplier.run(
  'Zhejiang Huajun Pharmaceutical Co., Ltd.',
  'ZZ Peptide',
  'China',
  'Sunny Li',
  '+8619333252605',
  'Bank Transfer, Crypto',
  4,
  'Primary peptide supplier. Good quality and communication.'
);
const supplierId = db.prepare(`SELECT id FROM suppliers WHERE aka = 'ZZ Peptide'`).get().id;

// Supplier Order #001
const insertOrder = db.prepare(`
  INSERT INTO supplier_orders (order_ref, date, supplier_id, status, total_idr, payment_method, shipping_cost_usd, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
insertOrder.run('ORD-001', '2026-02-24', supplierId, 'Partially Delivered', 11175196, 'Bank Transfer', 80, 'First order. Balance discrepancy between USD total ($558) and actual IDR paid (IDR 11,175,196).');
const orderId = db.prepare(`SELECT id FROM supplier_orders WHERE order_ref = 'ORD-001'`).get().id;

// Supplier order items
const insertOrderItem = db.prepare(`
  INSERT INTO supplier_order_items (order_id, product_name, product_id, qty, unit_cost_usd)
  VALUES (?, ?, ?, ?, ?)
`);
const rt10 = getProduct('RT10');
const cp10 = getProduct('CP10');
const cu100 = getProduct('CU100');
const ml10 = getProduct('ML10');
const wa3 = getProduct('WA3');
const wa10 = getProduct('WA10');

insertOrderItem.run(orderId, 'Retatrutide 10mg (2 boxes)', rt10.id, 20, 13);
insertOrderItem.run(orderId, 'CJC-1295 5mg + Ipamorelin 5mg', cp10.id, 10, 10);
insertOrderItem.run(orderId, 'GHK-Cu 100mg (2 boxes)', cu100.id, 20, 7);
insertOrderItem.run(orderId, 'Melanotan II 10mg', ml10.id, 10, 4.5);
insertOrderItem.run(orderId, 'BAC Water 3ml (3 boxes)', wa3.id, 30, 1);
insertOrderItem.run(orderId, 'BAC Water 10ml (1 box)', wa10.id, 10, 1);

// Update supplier total_spent
db.prepare(`UPDATE suppliers SET total_spent = 11175196 WHERE id = ?`).run(supplierId);

// Customers
const insertCustomer = db.prepare(`
  INSERT INTO customers (name, whatsapp, type, acquisition_channel, commission_rate, referral_code)
  VALUES (?, ?, ?, ?, ?, ?)
`);
insertCustomer.run('Patrick L', '+62821000001', 'Regular', 'WhatsApp', 0, '');
insertCustomer.run('Eve L', '+62821000002', 'Regular', 'WhatsApp', 0, '');
insertCustomer.run('Adrien P', '+62821000003', 'Regular', 'WhatsApp', 0, '');
insertCustomer.run('Client 18', '+62821000004', 'Regular', 'WhatsApp', 0, '');
insertCustomer.run('Sophia', '', 'Regular', 'Other', 0, '');
insertCustomer.run('Affiliate Axiom 1', '+62821000006', 'Affiliate', 'WhatsApp', 10, 'AXIOM1');

const getCust = (name) => db.prepare(`SELECT id FROM customers WHERE name = ?`).get(name).id;

// Sales
const insertSale = db.prepare(`
  INSERT INTO sales (sale_ref, date, customer_id, customer_name, sale_type, channel, subtotal, delivery_fee, discount, total_revenue, total_cost, profit, margin, payment_method, payment_status, order_status, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertSaleItem = db.prepare(`
  INSERT INTO sale_items (sale_id, product_id, product_name, qty, unit_price, unit_cost, line_total)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// Helper to create a sale
function createSale(ref, date, custName, saleType, channel, items, delivery, discount, payMethod, payStatus, orderStatus, notes) {
  const custId = getCust(custName);
  let subtotal = 0;
  let totalCost = 0;

  for (const item of items) {
    subtotal += item.unit_price * item.qty;
    totalCost += item.unit_cost * item.qty;
  }

  const totalRevenue = subtotal + delivery - discount;
  const profit = totalRevenue - totalCost;
  const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  const info = insertSale.run(
    ref, date, custId, custName, saleType, channel,
    subtotal, delivery, discount, totalRevenue, totalCost, profit,
    Math.round(margin * 100) / 100,
    payMethod, payStatus, orderStatus, notes
  );
  const saleId = info.lastInsertRowid;

  for (const item of items) {
    insertSaleItem.run(saleId, item.product_id, item.product_name, item.qty, item.unit_price, item.unit_cost, item.unit_price * item.qty);
  }

  // Update customer stats
  db.prepare(`
    UPDATE customers SET
      total_orders = total_orders + 1,
      total_units = total_units + ?,
      total_spent = total_spent + ?,
      last_order_date = ?,
      first_order_date = CASE WHEN first_order_date = '' THEN ? ELSE first_order_date END
    WHERE id = ?
  `).run(items.reduce((s, i) => s + i.qty, 0), totalRevenue, date, date, custId);

  // Update product stats
  for (const item of items) {
    db.prepare(`
      UPDATE products SET
        units_sold = units_sold + ?,
        revenue_total = revenue_total + ?,
        profit_total = profit_total + ?
      WHERE id = ?
    `).run(item.qty, item.unit_price * item.qty, (item.unit_price - item.unit_cost) * item.qty, item.product_id);
  }

  return saleId;
}

// S001: 2026-04-24 | Patrick L | Bundle | 3x RT10 @900k + 2x BAC3 @75k | delivery 0
createSale('S001', '2026-04-24', 'Patrick L', 'Bundle', 'WhatsApp', [
  { product_id: rt10.id, product_name: 'Retatrutide 10mg', qty: 3, unit_price: 900000, unit_cost: 221000 },
  { product_id: wa3.id, product_name: 'BAC Water 3ml', qty: 2, unit_price: 75000, unit_cost: 10200 },
], 0, 0, 'Cash', 'Paid', 'Delivered', 'Bundle deal');

// S002: 2026-05-02 | Eve L | Single | 1x GHK-Cu @1,150,000
createSale('S002', '2026-05-02', 'Eve L', 'Individual', 'WhatsApp', [
  { product_id: cu100.id, product_name: 'GHK-Cu 100mg', qty: 1, unit_price: 1150000, unit_cost: 119000 },
], 0, 0, 'Cash', 'Paid', 'Delivered', '');

// S003: 2026-05-04 | Adrien P | Bundle | 2x GHK-Cu @1,500,000
createSale('S003', '2026-05-04', 'Adrien P', 'Bundle', 'WhatsApp', [
  { product_id: cu100.id, product_name: 'GHK-Cu 100mg', qty: 2, unit_price: 1500000, unit_cost: 119000 },
], 0, 0, 'Cash', 'Paid', 'Delivered', '');

// S004: 2026-05-01 | Client 18 | Bundle | 5x BAC10 @125k + delivery 50k
createSale('S004', '2026-05-01', 'Client 18', 'Bundle', 'WhatsApp', [
  { product_id: wa10.id, product_name: 'BAC Water 10ml', qty: 5, unit_price: 125000, unit_cost: 17000 },
], 50000, 0, 'Cash', 'Paid', 'Delivered', '');

// S005: 2026-05-06 | Sophia | Bundle | 1x RT10 @400k (discounted)
createSale('S005', '2026-05-06', 'Sophia', 'Bundle', 'Other', [
  { product_id: rt10.id, product_name: 'Retatrutide 10mg', qty: 1, unit_price: 400000, unit_cost: 221000 },
], 0, 0, 'Cash', 'Paid', 'Delivered', 'Special discount applied');

// S006: 2026-05-08 | Affiliate Axiom 1 | Bundle | 2x RT10 @1,650k + 1x BAC10 + 2x BAC3 + delivery 50k
createSale('S006', '2026-05-08', 'Affiliate Axiom 1', 'Bundle', 'WhatsApp', [
  { product_id: rt10.id, product_name: 'Retatrutide 10mg', qty: 2, unit_price: 1650000, unit_cost: 221000 },
  { product_id: wa10.id, product_name: 'BAC Water 10ml', qty: 1, unit_price: 125000, unit_cost: 17000 },
  { product_id: wa3.id, product_name: 'BAC Water 3ml', qty: 2, unit_price: 75000, unit_cost: 10200 },
], 50000, 0, 'Cash', 'Paid', 'Delivered', 'Affiliate order');

// Verify totals
const totals = db.prepare(`
  SELECT COUNT(*) as count, SUM(total_revenue) as revenue, SUM(profit) as profit, SUM(subtotal + delivery_fee) as units_check
  FROM sales
`).get();
console.log(`✓ Sales seeded: ${totals.count} sales, IDR ${totals.revenue?.toLocaleString()} revenue, IDR ${totals.profit?.toLocaleString()} profit`);
console.log(`  Target: 6 sales, IDR 11,700,000 revenue, IDR 9,862,600 profit`);

const productCount = db.prepare(`SELECT COUNT(*) as c FROM products`).get().c;
const catCount = db.prepare(`SELECT COUNT(*) as c FROM categories`).get().c;
console.log(`✓ Products: ${productCount} | Categories: ${catCount}`);
console.log(`✓ Supplier order ORD-001 seeded`);
console.log(`✓ Database ready!`);
