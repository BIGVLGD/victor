import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatIDR, formatDate, SUPPLIER_STATUSES } from '../lib/utils';
import { SupplierOrder, SupplierOrderItem, Supplier, Product } from '../types';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { SupplierStatusBadge } from '../components/ui/Badge';
import KPICard from '../components/ui/KPICard';
import { useToast } from '../contexts/ToastContext';
import { Plus, Edit2, Trash2, Eye, X } from 'lucide-react';

const PAYMENT_METHODS = ['Bank Transfer', 'Crypto', 'PayPal', 'Wise', 'Cash'];

export default function SupplierOrders() {
  const toast = useToast();
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'view' | 'edit' | null>(null);
  const [selected, setSelected] = useState<SupplierOrder | null>(null);
  const [form, setForm] = useState<Partial<SupplierOrder>>({});
  const [items, setItems] = useState<Partial<SupplierOrderItem>[]>([]);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const usdRate = 16300;

  const load = async () => {
    const [o, s, p] = await Promise.all([
      api.get<SupplierOrder[]>('/orders'),
      api.get<Supplier[]>('/suppliers'),
      api.get<Product[]>('/products'),
    ]);
    setOrders(o); setSuppliers(s); setProducts(p);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openView = async (o: SupplierOrder) => {
    const d = await api.get<SupplierOrder>(`/orders/${o.id}`);
    setSelected(d); setModal('view');
  };

  const openNew = () => {
    const today = new Date().toISOString().split('T')[0];
    setForm({ date: today, status: 'Ordered', payment_method: 'Bank Transfer', total_idr: 0, shipping_cost_usd: 0, notes: '' });
    setItems([]);
    setModal('edit');
  };

  const openEdit = async (o: SupplierOrder) => {
    const d = await api.get<SupplierOrder>(`/orders/${o.id}`);
    setForm(d); setItems(d.items || []);
    setModal('edit');
  };

  const addItem = () => setItems(prev => [...prev, { product_name: '', qty: 1, unit_cost_usd: 0 }]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof SupplierOrderItem, val: unknown) => {
    setItems(prev => {
      const next = [...prev];
      const item = { ...next[i], [field]: val };
      if (field === 'product_id') {
        const p = products.find(x => x.id === Number(val));
        if (p) item.product_name = p.name + (p.dose ? ' ' + p.dose : '');
      }
      next[i] = item;
      return next;
    });
  };

  const productsUsdTotal = items.reduce((s, i) => s + (i.qty || 0) * (i.unit_cost_usd || 0), 0);
  const orderTotalUsd = productsUsdTotal + (form.shipping_cost_usd || 0);
  const orderTotalIdr = orderTotalUsd * usdRate;

  const save = async () => {
    if (!form.supplier_id || !form.date) return toast('error', 'Supplier and date required');
    setSaving(true);
    try {
      if (form.id) {
        await api.put(`/orders/${form.id}`, { ...form, items });
        toast('success', 'Order updated');
      } else {
        await api.post('/orders', { ...form, items });
        toast('success', 'Order created');
      }
      setModal(null); load();
    } catch (e: unknown) { toast('error', e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try { await api.delete(`/orders/${deleteId}`); toast('success', 'Order deleted'); setDeleteId(null); load(); }
    catch { toast('error', 'Delete failed'); }
    finally { setDeleting(false); }
  };

  // KPIs
  const totalSpent = orders.reduce((s, o) => s + o.total_idr, 0);
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const thisMonthSpent = orders.filter(o => o.date >= monthStart).reduce((s, o) => s + o.total_idr, 0);
  const inProgress = orders.filter(o => ['Ordered', 'Shipped', 'Partially Delivered'].includes(o.status)).length;
  const lastOrder = orders.reduce((latest, o) => !latest || o.date > latest ? o.date : latest, '');

  const columns = [
    { key: 'order_ref', label: 'Ref', render: (o: SupplierOrder) => <span className="font-mono text-cyan text-xs">{o.order_ref}</span> },
    { key: 'date', label: 'Date', render: (o: SupplierOrder) => <span className="text-txt-secondary text-xs">{formatDate(o.date)}</span> },
    { key: 'supplier_name', label: 'Supplier' },
    { key: 'status', label: 'Status', sortable: false, render: (o: SupplierOrder) => <SupplierStatusBadge status={o.status} /> },
    { key: 'total_idr', label: 'Total (IDR)', render: (o: SupplierOrder) => <span className="text-cyan font-medium">{formatIDR(o.total_idr)}</span> },
    { key: 'item_count', label: 'Items', render: (o: SupplierOrder) => <span className="text-txt-secondary">{o.item_count}</span> },
    { key: 'payment_method', label: 'Payment', render: (o: SupplierOrder) => <span className="text-txt-secondary text-xs">{o.payment_method}</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Supplier Orders</h1>
          <p className="text-txt-secondary text-sm mt-0.5">{orders.length} orders</p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-1.5"><Plus size={14} /> New Order</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="Total Spent (All Time)" value={formatIDR(totalSpent)} accent="cyan" loading={loading} />
        <KPICard label="Spent This Month" value={formatIDR(thisMonthSpent)} loading={loading} />
        <KPICard label="Orders In Progress" value={String(inProgress)} accent="warning" loading={loading} />
        <KPICard label="Last Order Date" value={formatDate(lastOrder)} loading={loading} />
      </div>

      <DataTable
        data={orders}
        columns={columns}
        searchKeys={['order_ref', 'supplier_name', 'status']}
        exportFilename="axiom-orders"
        loading={loading}
        emptyMessage="No supplier orders yet."
        onRowClick={(row) => openView(row)}
        actions={(row) => {
          const o = row;
          return (
            <div className="flex gap-1">
              <button onClick={() => openView(o)} className="p-1.5 text-txt-muted hover:text-cyan"><Eye size={14} /></button>
              <button onClick={() => openEdit(o)} className="p-1.5 text-txt-muted hover:text-cyan"><Edit2 size={14} /></button>
              <button onClick={() => setDeleteId(o.id)} className="p-1.5 text-txt-muted hover:text-danger"><Trash2 size={14} /></button>
            </div>
          );
        }}
      />

      {/* View */}
      {selected && (
        <Modal open={modal === 'view'} onClose={() => setModal(null)} title={`Order ${selected.order_ref}`} size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><p className="label">Date</p><p>{formatDate(selected.date)}</p></div>
              <div><p className="label">Supplier</p><p>{selected.supplier_name}</p></div>
              <div><p className="label">Status</p><SupplierStatusBadge status={selected.status} /></div>
              <div><p className="label">Payment</p><p>{selected.payment_method}</p></div>
              <div><p className="label">Shipping (USD)</p><p>${selected.shipping_cost_usd}</p></div>
              <div><p className="label">Total Paid (IDR)</p><p className="text-cyan font-semibold">{formatIDR(selected.total_idr)}</p></div>
            </div>

            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-bg border-b border-border">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs text-txt-secondary">Product</th>
                    <th className="px-4 py-2 text-right text-xs text-txt-secondary">Qty</th>
                    <th className="px-4 py-2 text-right text-xs text-txt-secondary">Unit (USD)</th>
                    <th className="px-4 py-2 text-right text-xs text-txt-secondary">Line (USD)</th>
                    <th className="px-4 py-2 text-right text-xs text-txt-secondary">Line (IDR)</th>
                  </tr>
                </thead>
                <tbody>
                  {(selected.items || []).map((item, i) => {
                    const lineUsd = (item.qty || 0) * (item.unit_cost_usd || 0);
                    return (
                      <tr key={i} className="border-b border-border">
                        <td className="px-4 py-2">{item.product_name}</td>
                        <td className="px-4 py-2 text-right">{item.qty}</td>
                        <td className="px-4 py-2 text-right text-txt-secondary">${item.unit_cost_usd}</td>
                        <td className="px-4 py-2 text-right font-medium">${lineUsd.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right text-cyan">{formatIDR(lineUsd * usdRate)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="bg-bg border border-border rounded-xl p-3 grid grid-cols-2 gap-2 text-sm">
              {(() => {
                const prodTotal = (selected.items || []).reduce((s, i) => s + (i.qty || 0) * (i.unit_cost_usd || 0), 0);
                const total = prodTotal + (selected.shipping_cost_usd || 0);
                return (
                  <>
                    <div className="flex justify-between"><span className="text-txt-secondary">Products</span><span>${prodTotal.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-txt-secondary">Shipping</span><span>${selected.shipping_cost_usd}</span></div>
                    <div className="flex justify-between font-semibold"><span>Total (USD)</span><span className="text-cyan">${total.toFixed(2)}</span></div>
                    <div className="flex justify-between font-semibold"><span>Est. IDR (@{usdRate.toLocaleString()})</span><span className="text-purple">{formatIDR(total * usdRate)}</span></div>
                    <div className="flex justify-between col-span-2 pt-1 border-t border-border font-bold"><span>Actual Paid (IDR)</span><span className="text-cyan">{formatIDR(selected.total_idr)}</span></div>
                  </>
                );
              })()}
            </div>

            {selected.notes && <p className="text-xs text-txt-secondary bg-bg border border-border rounded-lg p-3">{selected.notes}</p>}
          </div>
        </Modal>
      )}

      {/* Edit/New */}
      <Modal open={modal === 'edit'} onClose={() => setModal(null)} title={form.id ? `Edit ${form.order_ref}` : 'New Supplier Order'} size="xl"
        footer={<div className="flex justify-end gap-2"><button onClick={() => setModal(null)} className="btn-secondary">Cancel</button><button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button></div>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><label className="label">Date *</label><input type="date" className="input" value={form.date || ''} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div><label className="label">Supplier *</label>
              <select className="input" value={form.supplier_id || ''} onChange={e => setForm(f => ({ ...f, supplier_id: Number(e.target.value) }))}>
                <option value="">— Select —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div><label className="label">Status</label>
              <select className="input" value={form.status || 'Ordered'} onChange={e => setForm(f => ({ ...f, status: e.target.value as SupplierOrder['status'] }))}>
                {SUPPLIER_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div><label className="label">Payment Method</label>
              <select className="input" value={form.payment_method || ''} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div><label className="label">Shipping Cost (USD)</label><input type="number" step="0.01" className="input" value={form.shipping_cost_usd || 0} onChange={e => setForm(f => ({ ...f, shipping_cost_usd: Number(e.target.value) }))} /></div>
            <div><label className="label">Total Paid (IDR)</label><input type="number" className="input" value={form.total_idr || 0} onChange={e => setForm(f => ({ ...f, total_idr: Number(e.target.value) }))} /></div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Line Items</label>
              <button onClick={addItem} className="text-xs text-cyan hover:underline flex items-center gap-1"><Plus size={12} /> Add Item</button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex gap-2 items-center bg-bg border border-border rounded-lg p-2">
                  <select className="input text-xs flex-1" value={item.product_id || ''} onChange={e => updateItem(i, 'product_id', e.target.value)}>
                    <option value="">Custom item name</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} {p.dose}</option>)}
                  </select>
                  <input className="input text-xs flex-1" placeholder="Product name" value={item.product_name || ''} onChange={e => updateItem(i, 'product_name', e.target.value)} />
                  <div className="flex items-center gap-1"><label className="text-xs text-txt-muted">Qty</label><input type="number" className="input text-xs w-16" min="1" value={item.qty || 1} onChange={e => updateItem(i, 'qty', Number(e.target.value))} /></div>
                  <div className="flex items-center gap-1"><label className="text-xs text-txt-muted">$/unit</label><input type="number" step="0.01" className="input text-xs w-20" value={item.unit_cost_usd || 0} onChange={e => updateItem(i, 'unit_cost_usd', Number(e.target.value))} /></div>
                  <span className="text-xs text-cyan min-w-[60px] text-right">${((item.qty || 0) * (item.unit_cost_usd || 0)).toFixed(2)}</span>
                  <button onClick={() => removeItem(i)} className="text-txt-muted hover:text-danger"><X size={14} /></button>
                </div>
              ))}
            </div>
            {items.length > 0 && (
              <div className="mt-2 p-2 bg-bg border border-border rounded-lg text-xs grid grid-cols-3 gap-2">
                <div><span className="text-txt-muted">Products: </span><span className="text-cyan">${productsUsdTotal.toFixed(2)}</span></div>
                <div><span className="text-txt-muted">+ Shipping: </span><span>${form.shipping_cost_usd || 0}</span></div>
                <div><span className="text-txt-muted">= Total USD: </span><span className="font-bold text-cyan">${orderTotalUsd.toFixed(2)}</span><span className="text-txt-muted ml-2">≈ {formatIDR(orderTotalIdr)}</span></div>
              </div>
            )}
          </div>

          <div><label className="label">Notes</label><textarea className="input min-h-[60px] resize-none" value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={confirmDelete} loading={deleting} title="Delete Order" message="Are you sure you want to delete this order?" />
    </div>
  );
}
