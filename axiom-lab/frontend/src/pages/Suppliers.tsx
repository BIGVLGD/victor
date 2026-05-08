import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatIDR, formatDate } from '../lib/utils';
import { Supplier } from '../types';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../contexts/ToastContext';
import { Plus, Edit2, Trash2, Eye, Star, EyeOff } from 'lucide-react';

const emptySupplier = (): Partial<Supplier> => ({
  name: '', aka: '', country: '', website: '', contact_name: '', whatsapp: '', email: '',
  bank_details: '', payment_methods: '', min_order: '', avg_delivery: '', rating: 0, notes: '',
});

export default function Suppliers() {
  const toast = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'view' | 'edit' | null>(null);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [editing, setEditing] = useState<Partial<Supplier> | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showBank, setShowBank] = useState(false);

  const load = () => api.get<Supplier[]>('/suppliers').then(setSuppliers).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const openView = async (s: Supplier) => {
    const detail = await api.get<Supplier>(`/suppliers/${s.id}`);
    setSelected(detail); setShowBank(false); setModal('view');
  };

  const openEdit = (s?: Supplier) => { setEditing(s ? { ...s } : emptySupplier()); setModal('edit'); };

  const save = async () => {
    if (!editing?.name) return toast('error', 'Name required');
    setSaving(true);
    try {
      if (editing.id) {
        await api.put(`/suppliers/${editing.id}`, editing);
        toast('success', 'Supplier updated');
      } else {
        await api.post('/suppliers', editing);
        toast('success', 'Supplier created');
      }
      setModal(null); load();
    } catch (e: unknown) { toast('error', e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try { await api.delete(`/suppliers/${deleteId}`); toast('success', 'Supplier deleted'); setDeleteId(null); load(); }
    catch { toast('error', 'Delete failed'); }
    finally { setDeleting(false); }
  };

  const StarRating = ({ rating, onChange }: { rating: number; onChange?: (r: number) => void }) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={14} onClick={() => onChange?.(i)}
          className={`${i <= rating ? 'text-warning fill-warning' : 'text-border'} ${onChange ? 'cursor-pointer' : ''}`} />
      ))}
    </div>
  );

  const f = editing;

  const columns = [
    { key: 'name', label: 'Supplier', render: (s: Supplier) => (
      <div><p className="font-medium text-txt-primary">{s.name}</p>{s.aka && <p className="text-xs text-cyan">{s.aka}</p>}</div>
    )},
    { key: 'country', label: 'Country', render: (s: Supplier) => <span className="text-txt-secondary text-xs">{s.country}</span> },
    { key: 'contact_name', label: 'Contact', render: (s: Supplier) => <span className="text-txt-secondary text-xs">{s.contact_name}</span> },
    { key: 'rating', label: 'Rating', render: (s: Supplier) => <StarRating rating={s.rating} /> },
    { key: 'total_spent', label: 'Total Spent', render: (s: Supplier) => <span className="text-cyan font-medium">{formatIDR(s.total_spent)}</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Suppliers</h1>
          <p className="text-txt-secondary text-sm mt-0.5">{suppliers.length} suppliers</p>
        </div>
        <button onClick={() => openEdit()} className="btn-primary flex items-center gap-1.5"><Plus size={14} /> Add Supplier</button>
      </div>

      <DataTable
        data={suppliers}
        columns={columns}
        searchKeys={['name', 'aka', 'country', 'contact_name']}
        loading={loading}
        emptyMessage="No suppliers yet."
        onRowClick={(row) => openView(row)}
        actions={(row) => {
          const s = row;
          return (
            <div className="flex gap-1">
              <button onClick={() => openView(s)} className="p-1.5 text-txt-muted hover:text-cyan"><Eye size={14} /></button>
              <button onClick={() => openEdit(s)} className="p-1.5 text-txt-muted hover:text-cyan"><Edit2 size={14} /></button>
              <button onClick={() => setDeleteId(s.id)} className="p-1.5 text-txt-muted hover:text-danger"><Trash2 size={14} /></button>
            </div>
          );
        }}
      />

      {/* View */}
      {selected && (
        <Modal open={modal === 'view'} onClose={() => setModal(null)} title={selected.name} size="lg">
          <div className="space-y-4">
            {selected.aka && <p className="text-cyan text-sm">Also known as: {selected.aka}</p>}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="label">Country</p><p>{selected.country || '—'}</p></div>
              <div><p className="label">Website</p><p className="text-cyan">{selected.website || '—'}</p></div>
              <div><p className="label">Contact</p><p>{selected.contact_name || '—'}</p></div>
              <div><p className="label">WhatsApp</p><p>{selected.whatsapp || '—'}</p></div>
              <div><p className="label">Email</p><p>{selected.email || '—'}</p></div>
              <div><p className="label">Payment Methods</p><p className="text-txt-secondary">{selected.payment_methods || '—'}</p></div>
              <div><p className="label">Min Order</p><p>{selected.min_order || '—'}</p></div>
              <div><p className="label">Avg Delivery</p><p>{selected.avg_delivery || '—'}</p></div>
              <div><p className="label">Rating</p><StarRating rating={selected.rating} /></div>
              <div><p className="label">Total Spent</p><p className="text-cyan font-semibold">{formatIDR(selected.total_spent)}</p></div>
            </div>

            <div className="bg-bg border border-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="label mb-0">Bank Details</p>
                <button onClick={() => setShowBank(!showBank)} className="text-xs text-txt-muted hover:text-cyan flex items-center gap-1">
                  {showBank ? <><EyeOff size={12} /> Hide</> : <><Eye size={12} /> Reveal</>}
                </button>
              </div>
              {showBank ? (
                <p className="text-sm text-txt-primary whitespace-pre-wrap">{selected.bank_details || '—'}</p>
              ) : (
                <p className="text-txt-muted text-sm">••••••••••••••••</p>
              )}
            </div>

            {selected.notes && <div className="bg-bg border border-border rounded-lg p-3 text-xs text-txt-secondary">{selected.notes}</div>}

            {selected.orders && selected.orders.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-txt-secondary uppercase tracking-wider mb-2">Order History ({selected.orders.length})</h3>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {selected.orders.map((o) => (
                    <div key={o.id} className="flex items-center justify-between bg-bg border border-border rounded-lg px-3 py-2 text-xs">
                      <span className="font-mono text-cyan">{o.order_ref}</span>
                      <span className="text-txt-muted">{formatDate(o.date)}</span>
                      <span className="text-txt-secondary">{o.status}</span>
                      <span className="text-cyan font-medium">{formatIDR(o.total_idr)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Edit */}
      <Modal open={modal === 'edit'} onClose={() => setModal(null)} title={f?.id ? 'Edit Supplier' : 'Add Supplier'} size="lg"
        footer={<div className="flex justify-end gap-2"><button onClick={() => setModal(null)} className="btn-secondary">Cancel</button><button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button></div>}>
        {f && (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Name *</label><input className="input" value={f.name || ''} onChange={e => setEditing(s => ({ ...s!, name: e.target.value }))} /></div>
            <div><label className="label">Also Known As</label><input className="input" value={f.aka || ''} onChange={e => setEditing(s => ({ ...s!, aka: e.target.value }))} /></div>
            <div><label className="label">Country</label><input className="input" value={f.country || ''} onChange={e => setEditing(s => ({ ...s!, country: e.target.value }))} /></div>
            <div><label className="label">Website</label><input className="input" value={f.website || ''} onChange={e => setEditing(s => ({ ...s!, website: e.target.value }))} /></div>
            <div><label className="label">Contact Name</label><input className="input" value={f.contact_name || ''} onChange={e => setEditing(s => ({ ...s!, contact_name: e.target.value }))} /></div>
            <div><label className="label">WhatsApp</label><input className="input" value={f.whatsapp || ''} onChange={e => setEditing(s => ({ ...s!, whatsapp: e.target.value }))} /></div>
            <div><label className="label">Email</label><input type="email" className="input" value={f.email || ''} onChange={e => setEditing(s => ({ ...s!, email: e.target.value }))} /></div>
            <div><label className="label">Payment Methods</label><input className="input" placeholder="Bank Transfer, Crypto" value={f.payment_methods || ''} onChange={e => setEditing(s => ({ ...s!, payment_methods: e.target.value }))} /></div>
            <div><label className="label">Min Order</label><input className="input" value={f.min_order || ''} onChange={e => setEditing(s => ({ ...s!, min_order: e.target.value }))} /></div>
            <div><label className="label">Avg Delivery Time</label><input className="input" value={f.avg_delivery || ''} onChange={e => setEditing(s => ({ ...s!, avg_delivery: e.target.value }))} /></div>
            <div className="col-span-2">
              <label className="label">Rating</label>
              <div className="flex gap-1 mt-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <Star key={i} size={20} onClick={() => setEditing(s => ({ ...s!, rating: i }))}
                    className={`cursor-pointer ${i <= (f.rating || 0) ? 'text-warning fill-warning' : 'text-border'}`} />
                ))}
              </div>
            </div>
            <div className="col-span-2"><label className="label">Bank Details (hidden by default)</label><textarea className="input min-h-[60px] resize-none" value={f.bank_details || ''} onChange={e => setEditing(s => ({ ...s!, bank_details: e.target.value }))} /></div>
            <div className="col-span-2"><label className="label">Notes</label><textarea className="input min-h-[60px] resize-none" value={f.notes || ''} onChange={e => setEditing(s => ({ ...s!, notes: e.target.value }))} /></div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={confirmDelete} loading={deleting} title="Delete Supplier" message="Are you sure you want to delete this supplier?" />
    </div>
  );
}
