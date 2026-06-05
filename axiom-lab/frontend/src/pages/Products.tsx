import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatIDR, formatPercent, formatNumber } from '../lib/utils';
import { Product, Category } from '../types';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { StockBadge } from '../components/ui/Badge';
import { useToast } from '../contexts/ToastContext';
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Tag } from 'lucide-react';

const emptyProduct = (): Partial<Product> => ({
  sku: '', name: '', dose: '', sell_price: 0, cost_price: 0,
  stock: 0, threshold: 5, active: 1, supplier_cat_no: '', category_id: 0,
});

export default function Products() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'product' | 'category' | null>(null);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [editingCat, setEditingCat] = useState<Partial<Category> | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    const [p, c] = await Promise.all([api.get<Product[]>('/products'), api.get<Category[]>('/products/categories')]);
    setProducts(p);
    setCategories(c);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(emptyProduct()); setModal('product'); };
  const openEdit = (p: Product) => { setEditing({ ...p }); setModal('product'); };

  const save = async () => {
    if (!editing?.name || !editing?.sku) return toast('error', 'Name and SKU are required');
    setSaving(true);
    try {
      if (editing.id) {
        await api.put(`/products/${editing.id}`, editing);
        toast('success', 'Product updated');
      } else {
        await api.post('/products', editing);
        toast('success', 'Product created');
      }
      setModal(null); load();
    } catch (e: unknown) {
      toast('error', e instanceof Error ? e.message : 'Save failed');
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/products/${deleteId}`);
      toast('success', 'Product deleted');
      setDeleteId(null); load();
    } catch { toast('error', 'Delete failed'); }
    finally { setDeleting(false); }
  };

  const toggleActive = async (p: Product) => {
    await api.put(`/products/${p.id}`, { ...p, active: p.active ? 0 : 1 });
    toast('success', p.active ? 'Product deactivated' : 'Product activated');
    load();
  };

  const saveCat = async () => {
    if (!editingCat?.name) return toast('error', 'Name required');
    setSaving(true);
    try {
      if (editingCat.id) {
        await api.put(`/products/categories/${editingCat.id}`, editingCat);
        toast('success', 'Category updated');
      } else {
        await api.post('/products/categories', editingCat);
        toast('success', 'Category created');
      }
      setModal(null); load();
    } catch { toast('error', 'Save failed'); }
    finally { setSaving(false); }
  };

  const grouped = categories.map(cat => ({
    cat,
    products: products.filter(p => p.category_id === cat.id),
  }));

  const columns = [
    { key: 'sku', label: 'SKU', render: (p: Product) => <span className="text-xs font-mono text-cyan">{p.sku}</span> },
    { key: 'name', label: 'Product', render: (p: Product) => (
      <div>
        <p className="font-medium text-txt-primary">{p.name} {p.dose && <span className="text-txt-secondary">{p.dose}</span>}</p>
        <p className="text-xs text-txt-muted">{p.category_emoji} {p.category_name}</p>
      </div>
    )},
    { key: 'sell_price', label: 'Sell Price', render: (p: Product) => <span className="text-cyan">{formatIDR(p.sell_price)}</span> },
    { key: 'cost_price', label: 'Cost', render: (p: Product) => <span className="text-txt-secondary text-xs">{formatIDR(p.cost_price)}</span> },
    { key: 'margin', label: 'Margin', render: (p: Product) => {
      const m = p.sell_price > 0 ? ((p.sell_price - p.cost_price) / p.sell_price) * 100 : 0;
      return <span className="text-success text-sm">{formatPercent(m)}</span>;
    }},
    { key: 'stock', label: 'Stock', render: (p: Product) => (
      <div>
        <p className={`font-bold ${p.stock === 0 ? 'text-danger' : p.stock <= p.threshold ? 'text-warning' : 'text-txt-primary'}`}>{formatNumber(p.stock)}</p>
        <p className="text-xs text-txt-muted">min {p.threshold}</p>
      </div>
    )},
    { key: 'status', label: 'Status', sortable: false, render: (p: Product) => <StockBadge stock={p.stock} threshold={p.threshold} /> },
    { key: 'units_sold', label: 'Sold', render: (p: Product) => <span className="text-txt-secondary">{p.units_sold}</span> },
    { key: 'revenue_total', label: 'Revenue Total', render: (p: Product) => <span className="text-xs text-txt-secondary">{formatIDR(p.revenue_total)}</span> },
    { key: 'active', label: '', sortable: false, render: (p: Product) => (
      <span className={`text-xs ${p.active ? 'text-txt-muted' : 'text-danger'}`}>{p.active ? '' : 'INACTIVE'}</span>
    )},
  ];

  const f = editing;
  const margin = f && f.sell_price && f.cost_price ? ((f.sell_price - f.cost_price) / f.sell_price * 100).toFixed(1) : '0.0';
  const landedCost = (f?.cost_price || 0) + (f?.shipping_fee_per_unit || 0);
  const realMargin = f?.sell_price ? (((f.sell_price - landedCost) / f.sell_price) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Product Catalog</h1>
          <p className="text-txt-secondary text-sm mt-0.5">{products.length} products · {categories.length} categories</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setEditingCat({ name: '', emoji: '', sort_order: 99 }); setModal('category'); }} className="btn-secondary flex items-center gap-1.5">
            <Tag size={14} /> Category
          </button>
          <button onClick={openNew} className="btn-primary flex items-center gap-1.5">
            <Plus size={14} /> Add Product
          </button>
        </div>
      </div>

      <DataTable
        data={products}
        columns={columns}
        searchKeys={['name', 'sku', 'category_name', 'dose']}
        exportFilename="axiom-products"
        loading={loading}
        emptyMessage="No products yet. Add your first product."
        actions={(row) => {
          const p = row as Product;
          return (
            <div className="flex items-center gap-1">
              <button onClick={() => toggleActive(p)} title={p.active ? 'Deactivate' : 'Activate'} className="p-1.5 text-txt-muted hover:text-cyan transition-colors">
                {p.active ? <ToggleRight size={15} className="text-success" /> : <ToggleLeft size={15} />}
              </button>
              <button onClick={() => openEdit(p)} className="p-1.5 text-txt-muted hover:text-cyan transition-colors"><Edit2 size={14} /></button>
              <button onClick={() => setDeleteId(p.id)} className="p-1.5 text-txt-muted hover:text-danger transition-colors"><Trash2 size={14} /></button>
            </div>
          );
        }}
      />

      {/* Categories panel */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-txt-primary">Categories</h2>
          <button onClick={() => { setEditingCat({ name: '', emoji: '', sort_order: 99 }); setModal('category'); }} className="text-xs text-cyan hover:underline">+ Add</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {grouped.map(({ cat, products: cps }) => (
            <div key={cat.id} className="bg-bg border border-border rounded-lg p-3 flex items-center justify-between group">
              <div>
                <p className="text-sm font-medium text-txt-primary">{cat.emoji} {cat.name}</p>
                <p className="text-xs text-txt-muted">{cps.length} products</p>
              </div>
              <div className="hidden group-hover:flex gap-1">
                <button onClick={() => { setEditingCat({ ...cat }); setModal('category'); }} className="p-1 text-txt-muted hover:text-cyan"><Edit2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Product Modal */}
      <Modal open={modal === 'product'} onClose={() => setModal(null)} title={editing?.id ? 'Edit Product' : 'Add Product'} size="lg"
        footer={<div className="flex justify-end gap-2"><button onClick={() => setModal(null)} className="btn-secondary">Cancel</button><button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button></div>}>
        {f && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Name *</label><input className="input" value={f.name || ''} onChange={e => setEditing(p => ({ ...p!, name: e.target.value }))} /></div>
            <div><label className="label">SKU *</label><input className="input font-mono" value={f.sku || ''} onChange={e => setEditing(p => ({ ...p!, sku: e.target.value.toUpperCase() }))} /></div>
            <div><label className="label">Category</label>
              <select className="input" value={f.category_id || ''} onChange={e => setEditing(p => ({ ...p!, category_id: Number(e.target.value) }))}>
                <option value="">— Select —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
              </select>
            </div>
            <div><label className="label">Dose</label><input className="input" placeholder="e.g. 10mg" value={f.dose || ''} onChange={e => setEditing(p => ({ ...p!, dose: e.target.value }))} /></div>
            <div><label className="label">Sell Price (IDR)</label><input type="number" className="input" value={f.sell_price || ''} onChange={e => setEditing(p => ({ ...p!, sell_price: Number(e.target.value) }))} /></div>
            <div><label className="label">Cost Price (IDR)</label><input type="number" className="input" value={f.cost_price || ''} onChange={e => setEditing(p => ({ ...p!, cost_price: Number(e.target.value) }))} /></div>
            <div className="col-span-2 p-2 bg-bg rounded-lg border border-border text-xs text-txt-secondary">
              Margin: <span className="text-success font-bold">{margin}%</span> · Profit per unit: <span className="text-cyan">{formatIDR((f.sell_price || 0) - (f.cost_price || 0))}</span>
            </div>
            <div><label className="label">Shipping Fee / Unit (IDR)</label><input type="number" className="input" placeholder="0" value={f.shipping_fee_per_unit || ''} onChange={e => setEditing(p => ({ ...p!, shipping_fee_per_unit: Number(e.target.value) }))} /></div>
            <div className="p-2 bg-bg rounded-lg border border-border/50 text-xs text-txt-secondary self-end mb-0.5">
              <span className="text-txt-muted">Landed cost: </span><span className="text-warning font-medium">{formatIDR(landedCost)}</span>
              <span className="text-txt-muted ml-3">Real margin: </span><span className="text-success font-medium">{realMargin}%</span>
              <p className="text-[10px] text-txt-muted mt-0.5">Reference only — does not affect profit calculations</p>
            </div>
            <div><label className="label">Current Stock</label><input type="number" className="input" value={f.stock || ''} onChange={e => setEditing(p => ({ ...p!, stock: Number(e.target.value) }))} /></div>
            <div><label className="label">Low Stock Threshold</label><input type="number" className="input" value={f.threshold || ''} onChange={e => setEditing(p => ({ ...p!, threshold: Number(e.target.value) }))} /></div>
            <div className="col-span-2"><label className="label">Supplier Cat. No.</label><input className="input" value={f.supplier_cat_no || ''} onChange={e => setEditing(p => ({ ...p!, supplier_cat_no: e.target.value }))} /></div>
          </div>
        )}
      </Modal>

      {/* Category Modal */}
      <Modal open={modal === 'category'} onClose={() => setModal(null)} title={editingCat?.id ? 'Edit Category' : 'Add Category'} size="sm"
        footer={<div className="flex justify-end gap-2"><button onClick={() => setModal(null)} className="btn-secondary">Cancel</button><button onClick={saveCat} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button></div>}>
        {editingCat && (
          <div className="space-y-3">
            <div><label className="label">Name *</label><input className="input" value={editingCat.name || ''} onChange={e => setEditingCat(c => ({ ...c!, name: e.target.value }))} /></div>
            <div><label className="label">Emoji</label><input className="input" value={editingCat.emoji || ''} onChange={e => setEditingCat(c => ({ ...c!, emoji: e.target.value }))} /></div>
            <div><label className="label">Sort Order</label><input type="number" className="input" value={editingCat.sort_order || ''} onChange={e => setEditingCat(c => ({ ...c!, sort_order: Number(e.target.value) }))} /></div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={confirmDelete} loading={deleting}
        title="Delete Product" message="Are you sure you want to delete this product? This cannot be undone." />
    </div>
  );
}
