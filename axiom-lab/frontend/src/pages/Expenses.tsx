import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { formatIDR } from '../lib/utils';
import { useToast } from '../contexts/ToastContext';
import { Plus, Edit2, Trash2, Download, Search, TrendingDown } from 'lucide-react';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { cn } from '../lib/utils';

interface Expense {
  id: number;
  expense_ref: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  amount_usd: number;
  payment_method: string;
  paid_by: string;
  status: string;
  notes: string;
  created_by: string;
  created_at: string;
}

interface Summary {
  allTime: { total: number; count: number };
  thisMonth: { total: number; count: number };
  byCategory: { category: string; total: number; count: number }[];
  byCategoryMonth: { category: string; total: number; count: number }[];
  monthly: { month: string; total: number; count: number }[];
}

const PRESET_CATEGORIES = [
  { emoji: '📱', name: 'Advertising & Marketing' },
  { emoji: '📦', name: 'Packaging & Supplies' },
  { emoji: '🧪', name: 'Lab Testing' },
  { emoji: '🚚', name: 'Shipping & Logistics' },
  { emoji: '💻', name: 'Software & Tools' },
  { emoji: '🏢', name: 'Operations' },
  { emoji: '🏦', name: 'Banking & Fees' },
  { emoji: '🎨', name: 'Branding & Design' },
  { emoji: '➕', name: 'Other' },
];

const PAYMENT_METHODS = ['Cash', 'PayPal', 'Revolut', 'Wise', 'Crypto', 'Bank Transfer'];
const PAID_BY_OPTIONS = ['Victor', 'Ama', 'Both'];
const CHART_COLORS = ['#00f5ff', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6', '#f97316'];

function getCatEmoji(name: string) {
  return PRESET_CATEGORIES.find(c => c.name === name)?.emoji || '💼';
}

function emptyExpense(): Partial<Expense> {
  return {
    date: new Date().toISOString().split('T')[0],
    category: 'Advertising & Marketing',
    description: '',
    amount: 0,
    payment_method: 'Cash',
    paid_by: 'Victor',
    status: 'Paid',
    notes: '',
  };
}

export default function Expenses() {
  const toast = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterMethod, setFilterMethod] = useState('');
  const [filterPaidBy, setFilterPaidBy] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Partial<Expense> | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [customCat, setCustomCat] = useState('');
  const [useCustomCat, setUseCustomCat] = useState(false);
  const [sortKey, setSortKey] = useState<'date' | 'amount' | 'category'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterCat) params.set('category', filterCat);
    if (filterMethod) params.set('payment_method', filterMethod);
    if (filterPaidBy) params.set('paid_by', filterPaidBy);
    if (filterFrom) params.set('from', filterFrom);
    if (filterTo) params.set('to', filterTo);
    const qs = params.toString() ? '?' + params.toString() : '';
    const [exp, sum] = await Promise.all([
      api.get<Expense[]>(`/expenses${qs}`),
      api.get<Summary>('/expenses/summary'),
    ]);
    setExpenses(exp);
    setSummary(sum);
    setLoading(false);
  }, [filterCat, filterMethod, filterPaidBy, filterFrom, filterTo]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(emptyExpense()); setUseCustomCat(false); setCustomCat(''); setModal(true); };
  const openEdit = (e: Expense) => {
    const isPreset = PRESET_CATEGORIES.some(c => c.name === e.category);
    setEditing({ ...e });
    setUseCustomCat(!isPreset);
    setCustomCat(!isPreset ? e.category : '');
    setModal(true);
  };

  const save = async () => {
    const cat = useCustomCat ? customCat : editing?.category;
    if (!editing?.date || !cat || !editing?.amount) return toast('error', 'Date, category and amount required');
    setSaving(true);
    try {
      const payload = { ...editing, category: cat };
      if (editing.id) {
        await api.put(`/expenses/${editing.id}`, payload);
        toast('success', 'Expense updated');
      } else {
        await api.post('/expenses', payload);
        toast('success', 'Expense added');
      }
      setModal(false);
      load();
    } catch (e: unknown) {
      toast('error', e instanceof Error ? e.message : 'Save failed');
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/expenses/${deleteId}`);
      toast('success', 'Expense deleted');
      setDeleteId(null);
      load();
    } catch { toast('error', 'Delete failed'); }
    finally { setDeleting(false); }
  };

  const exportCSV = () => {
    const token = localStorage.getItem('axiom_token');
    fetch('/api/export/expenses', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob()).then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'axiom-expenses.csv';
        a.click();
      });
  };

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const filtered = expenses
    .filter(e => !search || e.description.toLowerCase().includes(search.toLowerCase()) || e.category.toLowerCase().includes(search.toLowerCase()) || e.expense_ref.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'amount') return (a.amount - b.amount) * dir;
      if (sortKey === 'category') return a.category.localeCompare(b.category) * dir;
      return a.date.localeCompare(b.date) * dir;
    });

  const f = editing;
  const monthName = new Date().toLocaleString('en', { month: 'long', year: 'numeric' });
  const biggestCat = summary?.byCategoryMonth[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Business Expenses</h1>
          <p className="text-txt-secondary text-sm mt-0.5">Operating costs outside supplier orders</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-1.5 text-xs py-2"><Download size={13} /> Export CSV</button>
          <button onClick={openNew} className="btn-primary flex items-center gap-1.5"><Plus size={14} /> Add Expense</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card">
          <p className="text-xs text-txt-muted mb-1">Expenses — {monthName}</p>
          <p className="text-xl font-bold text-danger">{formatIDR(summary?.thisMonth.total || 0)}</p>
          <p className="text-xs text-txt-muted mt-1">{summary?.thisMonth.count || 0} entries</p>
        </div>
        <div className="card">
          <p className="text-xs text-txt-muted mb-1">Expenses — All Time</p>
          <p className="text-xl font-bold text-warning">{formatIDR(summary?.allTime.total || 0)}</p>
          <p className="text-xs text-txt-muted mt-1">{summary?.allTime.count || 0} entries</p>
        </div>
        <div className="card">
          <p className="text-xs text-txt-muted mb-1">Biggest Category This Month</p>
          <p className="text-base font-bold text-txt-primary truncate">
            {biggestCat ? `${getCatEmoji(biggestCat.category)} ${biggestCat.category}` : '—'}
          </p>
          {biggestCat && <p className="text-xs text-danger mt-1">{formatIDR(biggestCat.total)}</p>}
        </div>
        <div className="card">
          <p className="text-xs text-txt-muted mb-1">Entries This Month</p>
          <p className="text-xl font-bold text-txt-primary">{summary?.thisMonth.count || 0}</p>
          <p className="text-xs text-txt-muted mt-1">expenses recorded</p>
        </div>
      </div>

      {/* Charts */}
      {summary && (summary.byCategory.length > 0 || summary.monthly.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Donut */}
          <div className="card">
            <h2 className="text-sm font-semibold text-txt-primary mb-3">By Category (All Time)</h2>
            {summary.byCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={summary.byCategory} dataKey="total" nameKey="category" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3}>
                    {summary.byCategory.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatIDR(v)} contentStyle={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 10, color: '#888' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-txt-muted text-sm text-center py-12">No data</p>}
          </div>

          {/* Monthly line */}
          <div className="card">
            <h2 className="text-sm font-semibold text-txt-primary mb-3">Monthly Expenses</h2>
            {summary.monthly.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={summary.monthly} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                  <XAxis dataKey="month" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} />
                  <Tooltip formatter={(v: number) => formatIDR(v)} contentStyle={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, fontSize: 11 }} />
                  <Line type="monotone" dataKey="total" name="Expenses" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-txt-muted text-sm text-center py-12">No data</p>}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
            <input className="input pl-8 py-1.5 text-sm" placeholder="Search expenses..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input py-1.5 text-sm w-auto" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="">All Categories</option>
            {PRESET_CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.emoji} {c.name}</option>)}
          </select>
          <select className="input py-1.5 text-sm w-auto" value={filterMethod} onChange={e => setFilterMethod(e.target.value)}>
            <option value="">All Methods</option>
            {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select className="input py-1.5 text-sm w-auto" value={filterPaidBy} onChange={e => setFilterPaidBy(e.target.value)}>
            <option value="">All</option>
            {PAID_BY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <input type="date" className="input py-1.5 text-sm w-auto" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
          <span className="text-txt-muted text-xs">→</span>
          <input type="date" className="input py-1.5 text-sm w-auto" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
          {(filterCat || filterMethod || filterPaidBy || filterFrom || filterTo || search) && (
            <button onClick={() => { setFilterCat(''); setFilterMethod(''); setFilterPaidBy(''); setFilterFrom(''); setFilterTo(''); setSearch(''); }} className="text-xs text-cyan hover:underline whitespace-nowrap">Clear</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center"><div className="w-8 h-8 border-2 border-cyan/30 border-t-cyan rounded-full animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-danger/5 border border-danger/10 flex items-center justify-center mx-auto mb-3">
              <TrendingDown size={20} className="text-danger/40" />
            </div>
            <p className="text-txt-muted text-sm">{expenses.length === 0 ? 'Add your first business expense' : 'No expenses match your filters'}</p>
            {expenses.length === 0 && <button onClick={openNew} className="mt-3 text-xs text-cyan hover:underline">Add expense</button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs text-txt-secondary">ID</th>
                  <th className="text-left px-4 py-3 text-xs text-txt-secondary cursor-pointer hover:text-cyan select-none" onClick={() => toggleSort('date')}>
                    Date {sortKey === 'date' && (sortDir === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="text-left px-4 py-3 text-xs text-txt-secondary cursor-pointer hover:text-cyan select-none" onClick={() => toggleSort('category')}>
                    Category {sortKey === 'category' && (sortDir === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="text-left px-4 py-3 text-xs text-txt-secondary">Description</th>
                  <th className="text-left px-4 py-3 text-xs text-txt-secondary cursor-pointer hover:text-cyan select-none" onClick={() => toggleSort('amount')}>
                    Amount {sortKey === 'amount' && (sortDir === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="text-left px-4 py-3 text-xs text-txt-secondary">USD</th>
                  <th className="text-left px-4 py-3 text-xs text-txt-secondary">Method</th>
                  <th className="text-left px-4 py-3 text-xs text-txt-secondary">Paid By</th>
                  <th className="text-left px-4 py-3 text-xs text-txt-secondary">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(exp => (
                  <tr key={exp.id} className="table-row group">
                    <td className="px-4 py-3 font-mono text-xs text-cyan">{exp.expense_ref}</td>
                    <td className="px-4 py-3 text-txt-secondary">{exp.date}</td>
                    <td className="px-4 py-3 font-medium text-txt-primary">{getCatEmoji(exp.category)} {exp.category}</td>
                    <td className="px-4 py-3 text-txt-secondary max-w-48 truncate">{exp.description || <span className="text-txt-muted italic">—</span>}</td>
                    <td className="px-4 py-3 font-bold text-danger">{formatIDR(exp.amount)}</td>
                    <td className="px-4 py-3 text-txt-muted text-xs">${exp.amount_usd.toFixed(2)}</td>
                    <td className="px-4 py-3 text-txt-secondary text-xs">{exp.payment_method}</td>
                    <td className="px-4 py-3 text-xs text-purple font-medium">{exp.paid_by}</td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium border', exp.status === 'Paid' ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20')}>
                        {exp.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(exp)} className="p-1.5 text-txt-muted hover:text-cyan transition-colors"><Edit2 size={13} /></button>
                        <button onClick={() => setDeleteId(exp.id)} className="p-1.5 text-txt-muted hover:text-danger transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing?.id ? 'Edit Expense' : 'Add Expense'}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        }
      >
        {f && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date *</label>
              <input type="date" className="input" value={f.date || ''} onChange={e => setEditing(x => ({ ...x!, date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Amount (IDR) *</label>
              <input type="number" className="input" placeholder="0" value={f.amount || ''} onChange={e => setEditing(x => ({ ...x!, amount: Number(e.target.value) }))} />
            </div>
            <div className="col-span-2">
              <label className="label">Category *</label>
              <select className="input" value={useCustomCat ? '__custom' : (f.category || '')} onChange={e => {
                if (e.target.value === '__custom') { setUseCustomCat(true); setEditing(x => ({ ...x!, category: '' })); }
                else { setUseCustomCat(false); setEditing(x => ({ ...x!, category: e.target.value })); }
              }}>
                {PRESET_CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.emoji} {c.name}</option>)}
                <option value="__custom">✏️ Custom category...</option>
              </select>
              {useCustomCat && (
                <input className="input mt-2" placeholder="Type custom category..." value={customCat} onChange={e => setCustomCat(e.target.value)} />
              )}
            </div>
            <div className="col-span-2">
              <label className="label">Description</label>
              <input className="input" placeholder="What was this expense for?" value={f.description || ''} onChange={e => setEditing(x => ({ ...x!, description: e.target.value }))} />
            </div>
            <div>
              <label className="label">Payment Method</label>
              <select className="input" value={f.payment_method || 'Cash'} onChange={e => setEditing(x => ({ ...x!, payment_method: e.target.value }))}>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Paid By</label>
              <select className="input" value={f.paid_by || 'Victor'} onChange={e => setEditing(x => ({ ...x!, paid_by: e.target.value }))}>
                {PAID_BY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={f.status || 'Paid'} onChange={e => setEditing(x => ({ ...x!, status: e.target.value }))}>
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
            <div>
              <label className="label">Notes</label>
              <input className="input" placeholder="Optional notes..." value={f.notes || ''} onChange={e => setEditing(x => ({ ...x!, notes: e.target.value }))} />
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Delete Expense"
        message="Are you sure you want to delete this expense?"
      />
    </div>
  );
}
