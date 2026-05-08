import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatIDR, formatDate, CUSTOMER_TYPES, CHANNELS, BALI_AREAS } from '../lib/utils';
import { Customer } from '../types';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Badge from '../components/ui/Badge';
import { useToast } from '../contexts/ToastContext';
import { Plus, Edit2, Trash2, Eye, Star } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const CUSTOMER_VARIANT: Record<string, 'cyan' | 'purple' | 'warning' | 'blue'> = {
  Regular: 'cyan', VIP: 'purple', Affiliate: 'warning', Wholesale: 'blue',
};

const emptyCustomer = (): Partial<Customer> => ({
  name: '', whatsapp: '', instagram: '', area: 'Canggu', type: 'Regular',
  acquisition_channel: 'WhatsApp', referral_code: '', commission_rate: 0, notes: '', tags: '',
});

export default function Customers() {
  const toast = useToast();
  const { user } = useAuth();
  const isFinance = user?.role !== 'employee';
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'view' | 'edit' | null>(null);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [editing, setEditing] = useState<Partial<Customer> | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = () => api.get<Customer[]>('/customers').then(setCustomers).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const openView = async (c: Customer) => {
    const detail = await api.get<Customer>(`/customers/${c.id}`);
    setSelected(detail); setModal('view');
  };

  const openEdit = (c?: Customer) => {
    setEditing(c ? { ...c } : emptyCustomer());
    setModal('edit');
  };

  const save = async () => {
    if (!editing?.name) return toast('error', 'Name is required');
    setSaving(true);
    try {
      if (editing.id) {
        await api.put(`/customers/${editing.id}`, editing);
        toast('success', 'Customer updated');
      } else {
        await api.post('/customers', editing);
        toast('success', 'Customer created');
      }
      setModal(null); load();
    } catch (e: unknown) { toast('error', e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try { await api.delete(`/customers/${deleteId}`); toast('success', 'Customer deleted'); setDeleteId(null); load(); }
    catch { toast('error', 'Delete failed'); }
    finally { setDeleting(false); }
  };

  const f = editing;

  const columns = [
    { key: 'name', label: 'Name', render: (c: Customer) => <span className="font-medium">{c.name}</span> },
    { key: 'type', label: 'Type', sortable: false, render: (c: Customer) => <Badge variant={CUSTOMER_VARIANT[c.type] || 'gray'}>{c.type}</Badge> },
    { key: 'whatsapp', label: 'WhatsApp', render: (c: Customer) => <span className="text-txt-secondary text-xs">{c.whatsapp || '—'}</span> },
    { key: 'area', label: 'Area', render: (c: Customer) => <span className="text-txt-secondary text-xs">{c.area || '—'}</span> },
    { key: 'total_orders', label: 'Orders', render: (c: Customer) => <span className="font-medium">{c.total_orders}</span> },
    { key: 'total_units', label: 'Units', render: (c: Customer) => <span className="text-txt-secondary">{c.total_units}</span> },
    ...(isFinance ? [{ key: 'total_spent', label: 'Total Spent', render: (c: Customer) => <span className="text-cyan font-medium">{formatIDR(c.total_spent)}</span> }] : []),
    { key: 'last_order_date', label: 'Last Order', render: (c: Customer) => <span className="text-txt-muted text-xs">{formatDate(c.last_order_date)}</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Customers</h1>
          <p className="text-txt-secondary text-sm mt-0.5">{customers.length} customers</p>
        </div>
        <button onClick={() => openEdit()} className="btn-primary flex items-center gap-1.5"><Plus size={14} /> Add Customer</button>
      </div>

      <DataTable
        data={customers}
        columns={columns}
        searchKeys={['name', 'whatsapp', 'area', 'type', 'referral_code']}
        exportFilename="axiom-customers"
        loading={loading}
        emptyMessage="No customers yet."
        onRowClick={(row) => openView(row)}
        actions={(row) => {
          const c = row;
          return (
            <div className="flex gap-1">
              <button onClick={() => openView(c)} className="p-1.5 text-txt-muted hover:text-cyan"><Eye size={14} /></button>
              <button onClick={() => openEdit(c)} className="p-1.5 text-txt-muted hover:text-cyan"><Edit2 size={14} /></button>
              <button onClick={() => setDeleteId(c.id)} className="p-1.5 text-txt-muted hover:text-danger"><Trash2 size={14} /></button>
            </div>
          );
        }}
      />

      {/* View */}
      {selected && (
        <Modal open={modal === 'view'} onClose={() => setModal(null)} title={selected.name} size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div><p className="label">Type</p><Badge variant={CUSTOMER_VARIANT[selected.type] || 'gray'}>{selected.type}</Badge></div>
              <div><p className="label">WhatsApp</p><p>{selected.whatsapp || '—'}</p></div>
              <div><p className="label">Instagram</p><p>{selected.instagram || '—'}</p></div>
              <div><p className="label">Area</p><p>{selected.area || '—'}</p></div>
              <div><p className="label">Acquisition</p><p>{selected.acquisition_channel || '—'}</p></div>
              {selected.type === 'Affiliate' && <div><p className="label">Referral Code</p><p className="font-mono text-cyan">{selected.referral_code || '—'}</p></div>}
            </div>

            {isFinance && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  ['Total Orders', selected.total_orders],
                  ['Total Units', selected.total_units],
                  ['Total Spent', formatIDR(selected.total_spent)],
                  ['First Order', formatDate(selected.first_order_date)],
                ].map(([label, val]) => (
                  <div key={String(label)} className="bg-bg border border-border rounded-lg p-3">
                    <p className="text-xs text-txt-muted mb-1">{label}</p>
                    <p className="font-semibold text-txt-primary">{val}</p>
                  </div>
                ))}
              </div>
            )}

            {selected.type === 'Affiliate' && (
              <div className="bg-purple/10 border border-purple/20 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-purple uppercase tracking-wider mb-2">Affiliate Info</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><p className="text-txt-muted text-xs">Commission Rate</p><p className="font-medium">{selected.commission_rate}%</p></div>
                  <div><p className="text-txt-muted text-xs">Referral Code</p><p className="font-mono text-cyan">{selected.referral_code || '—'}</p></div>
                </div>
              </div>
            )}

            {selected.notes && <div className="bg-bg border border-border rounded-lg p-3 text-xs text-txt-secondary">{selected.notes}</div>}

            {selected.orders && selected.orders.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-txt-secondary uppercase tracking-wider mb-2">Order History</h3>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {selected.orders.map((o) => (
                    <div key={o.id} className="flex items-center justify-between bg-bg border border-border rounded-lg px-3 py-2 text-xs">
                      <span className="font-mono text-cyan">{o.sale_ref}</span>
                      <span className="text-txt-muted">{formatDate(o.date)}</span>
                      {isFinance && <span className="text-cyan font-medium">{formatIDR(o.total_revenue)}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Edit/New */}
      <Modal open={modal === 'edit'} onClose={() => setModal(null)} title={f?.id ? 'Edit Customer' : 'New Customer'} size="lg"
        footer={<div className="flex justify-end gap-2"><button onClick={() => setModal(null)} className="btn-secondary">Cancel</button><button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button></div>}>
        {f && (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Name *</label><input className="input" value={f.name || ''} onChange={e => setEditing(c => ({ ...c!, name: e.target.value }))} /></div>
            <div><label className="label">WhatsApp</label><input className="input" placeholder="+62821..." value={f.whatsapp || ''} onChange={e => setEditing(c => ({ ...c!, whatsapp: e.target.value }))} /></div>
            <div><label className="label">Instagram</label><input className="input" placeholder="@handle" value={f.instagram || ''} onChange={e => setEditing(c => ({ ...c!, instagram: e.target.value }))} /></div>
            <div><label className="label">Type</label>
              <select className="input" value={f.type || 'Regular'} onChange={e => setEditing(c => ({ ...c!, type: e.target.value as Customer['type'] }))}>
                {CUSTOMER_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div><label className="label">Bali Area</label>
              <select className="input" value={f.area || 'Canggu'} onChange={e => setEditing(c => ({ ...c!, area: e.target.value }))}>
                {BALI_AREAS.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div><label className="label">Acquisition Channel</label>
              <select className="input" value={f.acquisition_channel || 'WhatsApp'} onChange={e => setEditing(c => ({ ...c!, acquisition_channel: e.target.value }))}>
                {CHANNELS.map(ch => <option key={ch}>{ch}</option>)}
              </select>
            </div>
            {(f.type === 'Affiliate') && (
              <>
                <div><label className="label">Referral Code</label><input className="input font-mono" value={f.referral_code || ''} onChange={e => setEditing(c => ({ ...c!, referral_code: e.target.value }))} /></div>
                <div><label className="label">Commission Rate %</label><input type="number" className="input" value={f.commission_rate || 0} onChange={e => setEditing(c => ({ ...c!, commission_rate: Number(e.target.value) }))} /></div>
              </>
            )}
            <div><label className="label">Tags</label><input className="input" placeholder="comma separated" value={f.tags || ''} onChange={e => setEditing(c => ({ ...c!, tags: e.target.value }))} /></div>
            <div className="col-span-2"><label className="label">Notes</label><textarea className="input min-h-[60px] resize-none" value={f.notes || ''} onChange={e => setEditing(c => ({ ...c!, notes: e.target.value }))} /></div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={confirmDelete} loading={deleting} title="Delete Customer" message="Are you sure? This will not delete their sales history." />
    </div>
  );
}
