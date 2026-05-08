import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatIDR, formatPercent, formatNumber } from '../lib/utils';
import KPICard from '../components/ui/KPICard';
import { AlertTriangle, TrendingUp, ShoppingCart, Users, Package, DollarSign, BarChart2, Activity } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { Product } from '../types';
import { StockBadge } from '../components/ui/Badge';

interface DashboardData {
  kpis: {
    revenue: number;
    profit: number;
    cost: number;
    sales_count: number;
    units_sold: number;
    avg_order: number;
    avg_profit: number;
    margin: number;
    supplier_spend: number;
  };
  comparisons: Record<string, { revenue: number; profit: number; sales: number }>;
  dailyData: { date: string; revenue: number; profit: number; sales: number }[];
  monthlyData: { month: string; revenue: number; profit: number; sales: number }[];
  byChannel: { channel: string; count: number; revenue: number }[];
  topProducts: { name: string; sku: string; dose: string; category: string; revenue: number; units: number; profit: number }[];
  lowStock: Product[];
}

const CHART_COLORS = ['#00f5ff', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="text-txt-secondary mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {formatIDR(p.value)}</p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartMode, setChartMode] = useState<'daily' | 'monthly'>('daily');
  const isFinance = user?.role !== 'employee';

  useEffect(() => {
    if (!isFinance) return;
    api.get<DashboardData>('/finance/dashboard').then(setData).finally(() => setLoading(false));
  }, [isFinance]);

  const kpis = data?.kpis;
  const monthName = new Date().toLocaleString('en', { month: 'long', year: 'numeric' });
  const chartData = chartMode === 'daily' ? data?.dailyData : data?.monthlyData;
  const chartXKey = chartMode === 'daily' ? 'date' : 'month';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-txt-secondary text-sm mt-0.5">{monthName} · The Axiom Lab</p>
      </div>

      {/* Low stock alert */}
      {data && data.lowStock.length > 0 && (
        <div className="flex items-center gap-3 bg-danger/10 border border-danger/30 rounded-xl px-4 py-3">
          <AlertTriangle size={18} className="text-danger shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-danger">Low Stock Alert</p>
            <p className="text-xs text-txt-secondary mt-0.5">
              {data.lowStock.map(p => `${p.name} ${p.dose} (${p.stock} left)`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* KPI Grid */}
      {isFinance ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard label="Revenue This Month" value={formatIDR(kpis?.revenue || 0)} icon={<TrendingUp size={16} />} accent="cyan" loading={loading} />
          <KPICard label="Profit This Month" value={formatIDR(kpis?.profit || 0)} icon={<DollarSign size={16} />} accent="success" loading={loading} />
          <KPICard label="Profit Margin" value={formatPercent(kpis?.margin || 0)} icon={<BarChart2 size={16} />} accent="purple" loading={loading} />
          <KPICard label="Sales This Month" value={String(kpis?.sales_count || 0)} icon={<ShoppingCart size={16} />} accent="cyan" loading={loading} />
          <KPICard label="Units Sold" value={String(kpis?.units_sold || 0)} icon={<Package size={16} />} loading={loading} />
          <KPICard label="Avg Order Value" value={formatIDR(kpis?.avg_order || 0)} loading={loading} />
          <KPICard label="Avg Profit / Sale" value={formatIDR(kpis?.avg_profit || 0)} loading={loading} />
          <KPICard label="Supplier Spend" value={formatIDR(kpis?.supplier_spend || 0)} icon={<Activity size={16} />} accent="warning" loading={loading} />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPICard label="Sales This Month" value={String(kpis?.sales_count || 0)} icon={<ShoppingCart size={16} />} accent="cyan" loading={loading} />
          <KPICard label="Units Sold" value={String(kpis?.units_sold || 0)} icon={<Package size={16} />} />
          <KPICard label="Customers" value="—" icon={<Users size={16} />} />
        </div>
      )}

      {isFinance && (
        <>
          {/* Revenue Chart */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-txt-primary">Revenue & Profit</h2>
              <div className="flex gap-1 bg-bg rounded-lg p-1">
                {(['daily', 'monthly'] as const).map(m => (
                  <button key={m} onClick={() => setChartMode(m)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${chartMode === m ? 'bg-cyan text-bg' : 'text-txt-secondary hover:text-txt-primary'}`}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData || []} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis dataKey={chartXKey} tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#888' }} />
                <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#00f5ff" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="profit" name="Profit" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Channel donut */}
            <div className="card">
              <h2 className="text-sm font-semibold text-txt-primary mb-4">Sales by Channel</h2>
              {data?.byChannel && data.byChannel.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={data.byChannel} dataKey="revenue" nameKey="channel" cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3}>
                      {data.byChannel.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatIDR(v)} contentStyle={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#888' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-txt-muted text-sm text-center py-12">No data</p>}
            </div>

            {/* Top products bar */}
            <div className="card">
              <h2 className="text-sm font-semibold text-txt-primary mb-4">Top 5 Products by Revenue</h2>
              {data?.topProducts && data.topProducts.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.topProducts} layout="vertical" margin={{ left: 0, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#888', fontSize: 9 }} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} axisLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#aaa', fontSize: 10 }} width={100} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: number) => formatIDR(v)} contentStyle={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, fontSize: 11 }} />
                    <Bar dataKey="revenue" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-txt-muted text-sm text-center py-12">No sales data</p>}
            </div>
          </div>

          {/* Comparisons */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Today vs Yesterday', a: data?.comparisons.today, b: data?.comparisons.yesterday },
              { label: 'This Week vs Last Week', a: data?.comparisons.thisWeek, b: data?.comparisons.lastWeek },
              { label: 'This Month', a: data?.comparisons.thisMonth, b: null },
            ].map(({ label, a, b }) => (
              <div key={label} className="card">
                <p className="text-xs text-txt-muted mb-2">{label}</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-txt-secondary">Revenue</span>
                    <span className="text-cyan font-medium">{formatIDR(a?.revenue || 0)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-txt-secondary">Profit</span>
                    <span className="text-success font-medium">{formatIDR(a?.profit || 0)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-txt-secondary">Sales</span>
                    <span className="text-txt-primary font-medium">{a?.sales || 0}</span>
                  </div>
                  {b && (
                    <div className="border-t border-border pt-1.5 mt-1.5">
                      <p className="text-[10px] text-txt-muted">Previous: {formatIDR(b.revenue || 0)}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Low stock table */}
          {data?.lowStock && data.lowStock.length > 0 && (
            <div className="card">
              <h2 className="text-sm font-semibold text-txt-primary mb-4 flex items-center gap-2">
                <AlertTriangle size={15} className="text-warning" /> Low Stock Products
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-3 py-2 text-xs text-txt-secondary">Product</th>
                      <th className="text-left px-3 py-2 text-xs text-txt-secondary">Category</th>
                      <th className="text-left px-3 py-2 text-xs text-txt-secondary">Stock</th>
                      <th className="text-left px-3 py-2 text-xs text-txt-secondary">Threshold</th>
                      <th className="text-left px-3 py-2 text-xs text-txt-secondary">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lowStock.map(p => (
                      <tr key={p.id} className="table-row">
                        <td className="px-3 py-2.5 font-medium">{p.name} {p.dose}</td>
                        <td className="px-3 py-2.5 text-txt-secondary">{p.category_emoji} {p.category_name}</td>
                        <td className="px-3 py-2.5 text-warning font-bold">{formatNumber(p.stock)}</td>
                        <td className="px-3 py-2.5 text-txt-muted">{p.threshold}</td>
                        <td className="px-3 py-2.5"><StockBadge stock={p.stock} threshold={p.threshold} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
