import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatIDR, formatPercent, formatDate, PAYMENT_METHODS, PAYMENT_STATUSES, ORDER_STATUSES, CHANNELS, SALE_TYPES } from '../lib/utils';
import { Sale, Customer, Product, SaleItem } from '../types';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { PaymentStatusBadge, OrderStatusBadge } from '../components/ui/Badge';
import { useToast } from '../contexts/ToastContext';
import { Plus, Edit2, Trash2, Eye, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Sales() {
  const toast = useToast();
  const { user } = useAuth();
  const isFinance = user?.role !== 'employee';
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'view' | 'edit' | null>(null);
  const [selected, setSelected] = useState<Sale | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [form, setForm] = useState<Partial<Sale>>({});
  const [items, setItems] = useState<SaleItem[]>([]);
  const defaultDelivery = 50000;

  const load = async () => {
    const [s, c, p] = await Promise.all([
      api.get<Sale[]>('/sales'),
      api.get<Customer[]>('/customers'),
      api.get<Product[]>('/products'),
    ]);
    setSales(s); setCustomers(c); setProducts(p);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    const today = new Date().toISOString().split('T')[0];
    setForm({ date: today, sale_type: 'Bundle', channel: 'WhatsApp', delivery_fee: defaultDelivery, discount: 0, payment_method: 'Cash', payment_status: 'Paid', order_status: 'Delivered', notes: '' });
    setItems([]);
    setModal('edit');
  };

  const openEdit = async (s: Sale) => {
    const detail = await api.get<Sale>(`/sales/${s.id}`);
    setForm(detail);
    setItems(detail.items || []);
    setModal('edit');
  };

  const openView = async (s: Sale) => {
    const detail = await api.get<Sale>(`/sales/${s.id}`);
    setSelected(detail);
    setModal('view');
  };

  const addItem = () => {
    if (products.length === 0) return;
    const p = products[0];
    setItems(prev => [...prev, { product_id: p.id, product_name: p.name + (p.dose ? ' ' + p.dose : ''), qty: 1, unit_price: p.sell_price, unit_cost: p.cost_price }]);
  };

  const updateItem = (i: number, field: keyof SaleItem, val: unknown) => {
    setItems(prev => {
      const next = [...prev];
      const item = { ...next[i], [field]: val };
      if (field === 'product_id') {
        const p = products.find(x => x.id === Number(val));
        if (p) {
          item.product_name = p.name + (p.dose ? ' ' + p.dose : '');
          item.unit_price = p.sell_price;
          item.unit_cost = p.cost_price;
        }
      }
      next[i] = item;
      return next;
    });
  };

  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const subtotal = items.reduce((s, i) => s + (i.unit_price * i.qty), 0);
  const totalCost = items.reduce((s, i) => s + (i.unit_cost * i.qty), 0);
  const delivery = form.delivery_fee || 0;
  const discount = form.discount || 0;
  const totalRevenue = subtotal + delivery - discount;
  const profit = totalRevenue - totalCost;
  const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  const save = async () => {
    if (items.length === 0) return toast('error', 'Add at least one item');
    setSaving(true);
    try {
      const payload = { ...form, items, subtotal, total_cost: totalCost, total_revenue: totalRevenue, profit, margin };
      if (form.id) {
        await api.put(`/sales/${form.id}`, payload);
        toast('success', 'Sale updated');
      } else {
        await api.post('/sales', payload);
        toast('success', 'Sale created');
      }
      setModal(null); load();
    } catch (e: unknown) { toast('error', e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try { await api.delete(`/sales/${deleteId}`); toast('success', 'Sale deleted'); setDeleteId(null); load(); }
    catch { toast('error', 'Delete failed'); }
    finally { setDeleting(false); }
  };

  const columns = [
    { key: 'sale_ref', label: 'Ref', render: (s: Sale) => <span className="font-mono text-cyan text-xs">{s.sale_ref}</span> },
    { key: 'date', label: 'Date', render: (s: Sale) => <span className="text-txt-secondary text-xs">{formatDate(s.date)}</span> },
    { key: 'customer_name', label: 'Customer' },
    { key: 'channel', label: 'Channel', render: (s: Sale) => <span className="text-txt-secondary text-xs">{s.channel}</span> },
    { key: 'items_summary', label: 'Items', render: (s: Sale) => <span className="text-xs text-txt-muted truncate max-w-[200px] block">{s.items_summary}</span> },
    ...(isFinance ? [
      { key: 'total_revenue', label: 'Revenue', render: (s: Sale) => <span className="text-cyan font-medium">{formatIDR(s.total_revenue)}</span> },
      { key: 'profit', label: 'Profit', render: (s: Sale) => <span className="text-success font-medium">{formatIDR(s.profit)}</span> },
      { key: 'margin', label: 'Margin', render: (s: Sale) => <span className="text-txt-secondary text-xs">{formatPercent(s.margin)}</span> },
    ] : []),
    { key: 'payment_method', label: 'Payment', render: (s: Sale) => <span className="text-txt-secondary text-xs">{s.payment_method}</span> },
    { key: 'payment_status', label: 'Pay Status', sortable: false, render: (s: Sale) => <PaymentStatusBadge status={s.payment_status} /> },
    { key: 'order_status', label: 'Order Status', sortable: false, render: (s: Sale) => <OrderStatusBadge status={s.order_status} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sales</h1>
          <p className="text-txt-secondary text-sm mt-0.5">{sales.length} sales recorded</p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-1.5"><Plus size={14} /> New Sale</button>
      </div>

      <DataTable
        data={sales}
        columns={columns}
        searchKeys={['sale_ref', 'customer_name', 'channel', 'items_summary']}
        exportFilename="axiom-sales"
        loading={loading}
        emptyMessage="No sales yet."
        onRowClick={(row) => openView(row)}
        actions={(row) => {
          const s = row;
          return (
            <div className="flex gap-1">
              <button onClick={() => openView(s)} className="p-1.5 text-txt-muted hover:text-cyan transition-colors"><Eye size={14} /></button>
              <button onClick={() => openEdit(s)} className="p-1.5 text-txt-muted hover:text-cyan transition-colors"><Edit2 size={14} /></button>
              <button onClick={() => setDeleteId(s.id)} className="p-1.5 text-txt-muted hover:text-danger transition-colors"><Trash2 size={14} /></button>
            </div>
          );
        }}
      />

      {/* View Modal */}
      {selected && (
        <Modal open={modal === 'view'} onClose={() => setModal(null)} title={`Sale ${selected.sale_ref}`} size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><p className="label">Date</p><p>{formatDate(selected.date)}</p></div>
              <div><p className="label">Customer</p><p>{selected.customer_name}</p></div>
              <div><p className="label">Channel</p><p>{selected.channel}</p></div>
              <div><p className="label">Sale Type</p><p>{selected.sale_type}</p></div>
              <div><p className="label">Payment</p><p>{selected.payment_method}</p></div>
              <div><p className="label">Status</p><PaymentStatusBadge status={selected.payment_status} /></div>
            </div>
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-bg">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs text-txt-secondary">Product</th>
                    <th className="px-4 py-2 text-right text-xs text-txt-secondary">Qty</th>
                    <th className="px-4 py-2 text-right text-xs text-txt-secondary">Unit Price</th>
                    {isFinance && <th className="px-4 py-2 text-right text-xs text-txt-secondary">Cost</th>}
                    <th className="px-4 py-2 text-right text-xs text-txt-secondary">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(selected.items || []).map((item, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="px-4 py-2">{item.product_name}</td>
                      <td className="px-4 py-2 text-right">{item.qty}</td>
                      <td className="px-4 py-2 text-right text-cyan">{formatIDR(item.unit_price)}</td>
                      {isFinance && <td className="px-4 py-2 text-right text-txt-muted text-xs">{formatIDR(item.unit_cost)}</td>}
                      <td className="px-4 py-2 text-right font-medium">{formatIDR(item.unit_price * item.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {isFinance && (
              <div className="bg-bg border border-border rounded-xl p-4 grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between"><span className="text-txt-secondary">Subtotal</span><span>{formatIDR(selected.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-txt-secondary">Delivery</span><span>{formatIDR(selected.delivery_fee)}</span></div>
                <div className="flex justify-between"><span className="text-txt-secondary">Discount</span><span className="text-warning">-{formatIDR(selected.discount)}</span></div>
                <div className="flex justify-between font-semibold"><span>Total Revenue</span><span className="text-cyan">{formatIDR(selected.total_revenue)}</span></div>
                <div className="flex justify-between"><span className="text-txt-secondary">Total Cost</span><span className="text-danger">{formatIDR(selected.total_cost)}</span></div>
                <div className="flex justify-between font-semibold"><span>Profit</span><span className="text-success">{formatIDR(selected.profit)}</span></div>
                <div className="flex justify-between col-span-2"><span className="text-txt-secondary">Margin</span><span className="text-purple">{formatPercent(selected.margin)}</span></div>
              </div>
            )}
            {selected.notes && <p className="text-xs text-txt-secondary bg-bg border border-border rounded-lg p-3">{selected.notes}</p>}
          </div>
        </Modal>
      )}

      {/* Edit/New Modal */}
      <Modal open={modal === 'edit'} onClose={() => setModal(null)} title={form.id ? `Edit Sale ${form.sale_ref}` : 'New Sale'} size="xl"
        footer={<div className="flex justify-end gap-2"><button onClick={() => setModal(null)} className="btn-secondary">Cancel</button><button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Sale'}</button></div>}>
        <div className="space-y-5">
          {/* Basic info */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><label className="label">Date</label><input type="date" className="input" value={form.date || ''} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div><label className="label">Customer</label>
              <select className="input" value={form.customer_id || ''} onChange={e => {
                const c = customers.find(x => x.id === Number(e.target.value));
                setForm(f => ({ ...f, customer_id: Number(e.target.value), customer_name: c?.name || '' }));
              }}>
                <option value="">— Select —</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="label">Sale Type</label>
              <select className="input" value={form.sale_type || 'Bundle'} onChange={e => setForm(f => ({ ...f, sale_type: e.target.value as Sale['sale_type'] }))}>
                {SALE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div><label className="label">Channel</label>
              <select className="input" value={form.channel || ''} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}>
                {CHANNELS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="label">Payment Method</label>
              <select className="input" value={form.payment_method || 'Cash'} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div><label className="label">Payment Status</label>
              <select className="input" value={form.payment_status || 'Paid'} onChange={e => setForm(f => ({ ...f, payment_status: e.target.value as Sale['payment_status'] }))}>
                {PAYMENT_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div><label className="label">Order Status</label>
              <select className="input" value={form.order_status || 'Delivered'} onChange={e => setForm(f => ({ ...f, order_status: e.target.value as Sale['order_status'] }))}>
                {ORDER_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div><label className="label">Delivery Fee (IDR)</label><input type="number" className="input" value={form.delivery_fee ?? 50000} onChange={e => setForm(f => ({ ...f, delivery_fee: Number(e.target.value) }))} /></div>
            <div><label className="label">Discount (IDR)</label><input type="number" className="input" value={form.discount ?? 0} onChange={e => setForm(f => ({ ...f, discount: Number(e.target.value) }))} /></div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Items</label>
              <button onClick={addItem} className="text-xs text-cyan hover:underline flex items-center gap-1"><Plus size={12} /> Add Item</button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex gap-2 items-center bg-bg border border-border rounded-lg p-2">
                  <select className="input text-xs flex-[2]" value={item.product_id} onChange={e => updateItem(i, 'product_id', e.target.value)}>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} {p.dose}</option>)}
                  </select>
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-txt-muted whitespace-nowrap">Qty</label>
                    <input type="number" className="input text-xs w-16" min="1" value={item.qty} onChange={e => updateItem(i, 'qty', Number(e.target.value))} />
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-txt-muted whitespace-nowrap">Price</label>
                    <input type="number" className="input text-xs w-28" value={item.unit_price} onChange={e => updateItem(i, 'unit_price', Number(e.target.value))} />
                  </div>
                  <span className="text-xs text-cyan whitespace-nowrap min-w-[80px] text-right">{formatIDR(item.unit_price * item.qty)}</span>
                  <button onClick={() => removeItem(i)} className="text-txt-muted hover:text-danger"><X size={14} /></button>
                </div>
              ))}
              {items.length === 0 && <p className="text-xs text-txt-muted text-center py-4 border border-dashed border-border rounded-lg">No items. Click "Add Item" to start.</p>}
            </div>
          </div>

          {/* Totals */}
          {isFinance && items.length > 0 && (
            <div className="bg-bg border border-border rounded-xl p-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div><p className="text-txt-muted">Subtotal</p><p className="font-medium">{formatIDR(subtotal)}</p></div>
              <div><p className="text-txt-muted">+ Delivery</p><p className="font-medium">{formatIDR(delivery)}</p></div>
              <div><p className="text-txt-muted">− Discount</p><p className="text-warning font-medium">{formatIDR(discount)}</p></div>
              <div><p className="text-txt-muted">= Revenue</p><p className="text-cyan font-bold">{formatIDR(totalRevenue)}</p></div>
              <div><p className="text-txt-muted">Cost</p><p className="text-danger">{formatIDR(totalCost)}</p></div>
              <div><p className="text-txt-muted">Profit</p><p className="text-success font-bold">{formatIDR(profit)}</p></div>
              <div><p className="text-txt-muted">Margin</p><p className="text-purple font-bold">{formatPercent(margin)}</p></div>
            </div>
          )}

          <div><label className="label">Notes</label><textarea className="input min-h-[60px] resize-none" value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={confirmDelete} loading={deleting} title="Delete Sale" message="Are you sure you want to delete this sale?" />
    </div>
  );
}
