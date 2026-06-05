const express = require('express');
const db = require('../db');
const { requireFinance } = require('../middleware/auth');

const router = express.Router();

router.get('/summary', requireFinance, (req, res) => {
  const allTime = db.prepare(`
    SELECT
      COUNT(*) as total_sales,
      COALESCE(SUM(total_revenue), 0) as total_revenue,
      COALESCE(SUM(total_cost), 0) as total_cost,
      COALESCE(SUM(profit), 0) as total_profit,
      COALESCE(SUM(delivery_fee), 0) as total_delivery,
      COALESCE(SUM(discount), 0) as total_discounts,
      COALESCE(AVG(CASE WHEN total_revenue > 0 THEN margin END), 0) as avg_margin
    FROM sales WHERE payment_status != 'Refunded'
  `).get();

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const thisMonth = db.prepare(`
    SELECT
      COUNT(*) as total_sales,
      COALESCE(SUM(total_revenue), 0) as total_revenue,
      COALESCE(SUM(total_cost), 0) as total_cost,
      COALESCE(SUM(profit), 0) as total_profit,
      COALESCE(SUM(delivery_fee), 0) as total_delivery,
      COALESCE(SUM(discount), 0) as total_discounts,
      COALESCE(SUM(subtotal + delivery_fee - discount), 0) as units_revenue,
      COALESCE(AVG(CASE WHEN total_revenue > 0 THEN margin END), 0) as avg_margin,
      COALESCE(AVG(total_revenue), 0) as avg_order_value,
      COALESCE(AVG(profit), 0) as avg_profit_per_sale
    FROM sales
    WHERE date >= ? AND payment_status != 'Refunded'
  `).get(monthStart);

  const unitsSold = db.prepare(`
    SELECT COALESCE(SUM(qty), 0) as units FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    WHERE s.date >= ? AND s.payment_status != 'Refunded'
  `).get(monthStart);

  const byPayment = db.prepare(`
    SELECT payment_method, COUNT(*) as count, COALESCE(SUM(total_revenue), 0) as revenue
    FROM sales WHERE payment_status != 'Refunded'
    GROUP BY payment_method
  `).all();

  const byPaymentMonth = db.prepare(`
    SELECT payment_method, COUNT(*) as count, COALESCE(SUM(total_revenue), 0) as revenue
    FROM sales WHERE date >= ? AND payment_status != 'Refunded'
    GROUP BY payment_method
  `).all(monthStart);

  const supplierSpend = db.prepare(`SELECT COALESCE(SUM(total_idr), 0) as total FROM supplier_orders`).get();
  const supplierSpendMonth = db.prepare(`SELECT COALESCE(SUM(total_idr), 0) as total FROM supplier_orders WHERE date >= ?`).get(monthStart);
  const expAllTime = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE status = 'Paid'`).get();
  const expThisMonth = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date >= ? AND status = 'Paid'`).get(monthStart);
  const expTopCatMonth = db.prepare(`SELECT category, COALESCE(SUM(amount), 0) as total FROM expenses WHERE date >= ? AND status = 'Paid' GROUP BY category ORDER BY total DESC LIMIT 1`).get(monthStart);

  res.json({
    allTime: { ...allTime, supplier_spend: supplierSpend.total, expense_total: expAllTime.total, net_profit: allTime.total_profit - expAllTime.total },
    thisMonth: { ...thisMonth, units_sold: unitsSold.units, supplier_spend: supplierSpendMonth.total, expense_total: expThisMonth.total, net_profit: thisMonth.total_profit - expThisMonth.total },
    byPayment,
    byPaymentMonth,
    expTopCatMonth: expTopCatMonth || null,
  });
});

router.get('/dashboard', requireFinance, (req, res) => {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now - 86400000).toISOString().split('T')[0];

  // Weekly
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(weekStart);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);

  const getStats = (from, to) => db.prepare(`
    SELECT COALESCE(SUM(total_revenue), 0) as revenue, COALESCE(SUM(profit), 0) as profit, COUNT(*) as sales
    FROM sales WHERE date >= ? AND date <= ? AND payment_status != 'Refunded'
  `).get(from, to);

  // Daily data for chart (last 30 days)
  const dailyData = db.prepare(`
    SELECT date, COALESCE(SUM(total_revenue), 0) as revenue, COALESCE(SUM(profit), 0) as profit, COUNT(*) as sales
    FROM sales
    WHERE date >= date('now', '-30 days') AND payment_status != 'Refunded'
    GROUP BY date ORDER BY date
  `).all();

  // Monthly data (last 12 months)
  const monthlyData = db.prepare(`
    SELECT substr(date, 1, 7) as month, COALESCE(SUM(total_revenue), 0) as revenue, COALESCE(SUM(profit), 0) as profit, COUNT(*) as sales
    FROM sales WHERE payment_status != 'Refunded'
    GROUP BY substr(date, 1, 7) ORDER BY month
  `).all();

  // By channel
  const byChannel = db.prepare(`
    SELECT channel, COUNT(*) as count, COALESCE(SUM(total_revenue), 0) as revenue
    FROM sales WHERE payment_status != 'Refunded'
    GROUP BY channel
  `).all();

  // Top products by revenue
  const topProducts = db.prepare(`
    SELECT p.name, p.sku, p.dose, c.name as category,
      COALESCE(SUM(si.line_total), 0) as revenue,
      COALESCE(SUM(si.qty), 0) as units,
      COALESCE(SUM(si.qty * (si.unit_price - si.unit_cost)), 0) as profit
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    JOIN sales s ON si.sale_id = s.id
    WHERE s.payment_status != 'Refunded'
    GROUP BY p.id
    ORDER BY revenue DESC LIMIT 5
  `).all();

  // Low stock products
  const lowStock = db.prepare(`
    SELECT p.*, c.name as category_name, c.emoji as category_emoji
    FROM products p LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.stock <= p.threshold AND p.active = 1
    ORDER BY p.stock ASC
  `).all();

  // KPIs this month
  const kpis = db.prepare(`
    SELECT
      COALESCE(SUM(total_revenue), 0) as revenue,
      COALESCE(SUM(profit), 0) as profit,
      COALESCE(SUM(total_cost), 0) as cost,
      COUNT(*) as sales_count,
      COALESCE(AVG(total_revenue), 0) as avg_order,
      COALESCE(AVG(profit), 0) as avg_profit
    FROM sales WHERE date >= ? AND payment_status != 'Refunded'
  `).get(monthStart);

  const unitsSold = db.prepare(`
    SELECT COALESCE(SUM(si.qty), 0) as units FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    WHERE s.date >= ? AND s.payment_status != 'Refunded'
  `).get(monthStart);

  const supplierSpendMonth = db.prepare(`SELECT COALESCE(SUM(total_idr), 0) as total FROM supplier_orders WHERE date >= ?`).get(monthStart);
  const expenseMonth = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date >= ? AND status = 'Paid'`).get(monthStart);

  const margin = kpis.revenue > 0 ? (kpis.profit / kpis.revenue) * 100 : 0;
  const netProfit = kpis.profit - expenseMonth.total;
  const netMargin = kpis.revenue > 0 ? (netProfit / kpis.revenue) * 100 : 0;

  res.json({
    kpis: {
      ...kpis,
      units_sold: unitsSold.units,
      margin: Math.round(margin * 100) / 100,
      supplier_spend: supplierSpendMonth.total,
      expense_total: expenseMonth.total,
      net_profit: netProfit,
      net_margin: Math.round(netMargin * 100) / 100,
    },
    comparisons: {
      today: getStats(today, today),
      yesterday: getStats(yesterday, yesterday),
      thisWeek: getStats(weekStart.toISOString().split('T')[0], today),
      lastWeek: getStats(lastWeekStart.toISOString().split('T')[0], lastWeekEnd.toISOString().split('T')[0]),
      thisMonth: getStats(monthStart, today),
    },
    dailyData,
    monthlyData,
    byChannel,
    topProducts,
    lowStock,
  });
});

module.exports = router;
