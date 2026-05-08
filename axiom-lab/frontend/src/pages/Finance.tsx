import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatIDR, formatPercent, PAYMENT_ICONS } from '../lib/utils';
import KPICard from '../components/ui/KPICard';
import { TrendingUp, DollarSign, Percent, Truck, Tag, ShoppingCart } from 'lucide-react';

interface FinanceSummary {
  allTime: { total_sales: number; total_revenue: number; total_cost: number; total_profit: number; total_delivery: number; total_discounts: number; avg_margin: number; supplier_spend: number };
  thisMonth: { total_sales: number; total_revenue: number; total_cost: number; total_profit: number; total_delivery: number; total_discounts: number; avg_margin: number; units_sold: number; avg_order_value: number; avg_profit_per_sale: number; supplier_spend: number };
  byPayment: { payment_method: string; count: number; revenue: number }[];
  byPaymentMonth: { payment_method: string; count: number; revenue: number }[];
}

export default function Finance() {
  const [data, setData] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<FinanceSummary>('/finance/summary').then(setData).finally(() => setLoading(false));
  }, []);

  const m = data?.thisMonth;
  const at = data?.allTime;
  const monthName = new Date().toLocaleString('en', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Finance</h1>
        <p className="text-txt-secondary text-sm mt-0.5">Revenue · Costs · Profit · Margins</p>
      </div>

      {/* This Month */}
      <div>
        <h2 className="text-xs font-medium text-txt-muted uppercase tracking-wider mb-3">{monthName}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard label="Revenue" value={formatIDR(m?.total_revenue || 0)} icon={<TrendingUp size={16} />} accent="cyan" loading={loading} />
          <KPICard label="Profit" value={formatIDR(m?.total_profit || 0)} icon={<DollarSign size={16} />} accent="success" loading={loading} />
          <KPICard label="Cost of Goods" value={formatIDR(m?.total_cost || 0)} accent="warning" loading={loading} />
          <KPICard label="Margin" value={m ? formatPercent(m.total_revenue > 0 ? (m.total_profit / m.total_revenue) * 100 : 0) : '—'} icon={<Percent size={16} />} accent="purple" loading={loading} />
          <KPICard label="Avg Order Value" value={formatIDR(m?.avg_order_value || 0)} loading={loading} />
          <KPICard label="Avg Profit / Sale" value={formatIDR(m?.avg_profit_per_sale || 0)} loading={loading} />
          <KPICard label="Discounts Given" value={formatIDR(m?.total_discounts || 0)} icon={<Tag size={16} />} accent="warning" loading={loading} />
          <KPICard label="Delivery Collected" value={formatIDR(m?.total_delivery || 0)} icon={<Truck size={16} />} loading={loading} />
        </div>
      </div>

      {/* All Time */}
      <div>
        <h2 className="text-xs font-medium text-txt-muted uppercase tracking-wider mb-3">All Time</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard label="Total Revenue" value={formatIDR(at?.total_revenue || 0)} icon={<TrendingUp size={16} />} accent="cyan" loading={loading} />
          <KPICard label="Total Profit" value={formatIDR(at?.total_profit || 0)} icon={<DollarSign size={16} />} accent="success" loading={loading} />
          <KPICard label="Total Cost" value={formatIDR(at?.total_cost || 0)} accent="warning" loading={loading} />
          <KPICard label="Overall Margin" value={at ? formatPercent(at.total_revenue > 0 ? (at.total_profit / at.total_revenue) * 100 : 0) : '—'} icon={<Percent size={16} />} accent="purple" loading={loading} />
          <KPICard label="Total Sales" value={String(at?.total_sales || 0)} icon={<ShoppingCart size={16} />} loading={loading} />
          <KPICard label="Total Discounts" value={formatIDR(at?.total_discounts || 0)} icon={<Tag size={16} />} accent="warning" loading={loading} />
          <KPICard label="Delivery Collected" value={formatIDR(at?.total_delivery || 0)} icon={<Truck size={16} />} loading={loading} />
          <KPICard label="Supplier Spend" value={formatIDR(at?.supplier_spend || 0)} loading={loading} />
        </div>
      </div>

      {/* Payment breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { title: `Payment Methods — ${monthName}`, data: data?.byPaymentMonth },
          { title: 'Payment Methods — All Time', data: data?.byPayment },
        ].map(({ title, data: pd }) => (
          <div key={title} className="card">
            <h2 className="text-sm font-semibold text-txt-primary mb-4">{title}</h2>
            {loading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => <div key={i} className="h-8 bg-border rounded animate-pulse" />)}
              </div>
            ) : pd && pd.length > 0 ? (
              <div className="space-y-2">
                {pd.map(item => {
                  const total = pd.reduce((s, x) => s + x.revenue, 0);
                  const pct = total > 0 ? (item.revenue / total) * 100 : 0;
                  return (
                    <div key={item.payment_method}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-txt-primary font-medium">{PAYMENT_ICONS[item.payment_method] || '💳'} {item.payment_method} <span className="text-txt-muted">({item.count})</span></span>
                        <span className="text-cyan font-medium">{formatIDR(item.revenue)}</span>
                      </div>
                      <div className="h-1.5 bg-border rounded-full overflow-hidden">
                        <div className="h-full bg-cyan rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-txt-muted text-sm text-center py-8">No data</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
