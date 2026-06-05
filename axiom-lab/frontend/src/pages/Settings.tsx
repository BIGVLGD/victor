import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Settings as SettingsType } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { Save, Plus, Edit2, Trash2, Download, Upload, Clock } from 'lucide-react';

interface User { id: number; name: string; email: string; role: string; created_at: string; }
interface LogEntry { id: number; user_name: string; action: string; entity_type: string; entity_id: string; details: string; created_at: string; }

export default function Settings() {
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [settings, setSettings] = useState<Partial<SettingsType>>({});
  const [users, setUsers] = useState<User[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [userModal, setUserModal] = useState(false);
  const [editUser, setEditUser] = useState<Partial<User & { password: string }> | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [savingUser, setSavingUser] = useState(false);

  useEffect(() => {
    api.get<SettingsType>('/settings').then(setSettings);
    if (isAdmin) {
      api.get<User[]>('/settings/users').then(setUsers);
      api.get<LogEntry[]>('/settings/activity').then(setLog);
    }
  }, [isAdmin]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.put('/settings', settings);
      toast('success', 'Settings saved');
    } catch { toast('error', 'Save failed'); }
    finally { setSaving(false); }
  };

  const saveUser = async () => {
    if (!editUser?.name || !editUser?.email) return toast('error', 'Name and email required');
    if (!editUser.id && !editUser.password) return toast('error', 'Password required for new user');
    setSavingUser(true);
    try {
      if (editUser.id) {
        await api.put(`/settings/users/${editUser.id}`, editUser);
        toast('success', 'User updated');
      } else {
        await api.post('/settings/users', editUser);
        toast('success', 'User created');
      }
      setUserModal(false);
      api.get<User[]>('/settings/users').then(setUsers);
    } catch (e: unknown) { toast('error', e instanceof Error ? e.message : 'Save failed'); }
    finally { setSavingUser(false); }
  };

  const deleteUser = async () => {
    if (!deleteUserId) return;
    setDeletingUser(true);
    try {
      await api.delete(`/settings/users/${deleteUserId}`);
      toast('success', 'User deleted');
      setDeleteUserId(null);
      api.get<User[]>('/settings/users').then(setUsers);
    } catch (e: unknown) { toast('error', e instanceof Error ? e.message : 'Delete failed'); }
    finally { setDeletingUser(false); }
  };

  const exportData = (type: 'sales' | 'products' | 'customers' | 'backup') => {
    const url = type === 'backup' ? `/api/export/backup` : `/api/export/${type}`;
    const token = localStorage.getItem('axiom_token');
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = type === 'backup' ? `axiom-backup-${new Date().toISOString().split('T')[0]}.db` : `axiom-${type}.csv`;
        a.click();
      });
  };

  const set = (key: keyof SettingsType, val: string) => setSettings(s => ({ ...s, [key]: val }));

  const restoreDB = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.db')) return toast('error', 'Please select a .db backup file');
    if (!confirm('This will replace ALL current data with the backup. Are you sure?')) return;
    const form = new FormData();
    form.append('database', file);
    const token = localStorage.getItem('axiom_token');
    try {
      const res = await fetch('/api/restore-db', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Unknown error');
      toast('success', `Restored! ${data.salesInBackup} sales found. Reloading in 15s...`);
      setTimeout(() => window.location.reload(), 15000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Restore failed';
      toast('error', 'Restore failed: ' + msg);
      alert('Restore error: ' + msg);
    }
    e.target.value = '';
  };

  const ROLES = ['admin', 'partner', 'employee'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-txt-secondary text-sm mt-0.5">App configuration and management</p>
      </div>

      {/* General Settings */}
      <div className="card">
        <h2 className="text-sm font-semibold text-txt-primary mb-4">General</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">USD/IDR Rate</label>
            <input type="number" className="input" value={settings.usd_idr_rate || ''} onChange={e => set('usd_idr_rate', e.target.value)} />
            <p className="text-xs text-txt-muted mt-1">Current rate used for supplier order conversions</p>
          </div>
          <div>
            <label className="label">Default Delivery Fee (IDR)</label>
            <input type="number" className="input" value={settings.default_delivery_fee || ''} onChange={e => set('default_delivery_fee', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Business Info */}
      <div className="card">
        <h2 className="text-sm font-semibold text-txt-primary mb-4">Business Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><label className="label">Business Name</label><input className="input" value={settings.business_name || ''} onChange={e => set('business_name', e.target.value)} /></div>
          <div><label className="label">Address</label><input className="input" value={settings.business_address || ''} onChange={e => set('business_address', e.target.value)} /></div>
          <div><label className="label">Phone / WhatsApp</label><input className="input" value={settings.business_phone || ''} onChange={e => set('business_phone', e.target.value)} /></div>
          <div><label className="label">Email</label><input className="input" value={settings.business_email || ''} onChange={e => set('business_email', e.target.value)} /></div>
          <div><label className="label">Website</label><input className="input" value={settings.business_website || ''} onChange={e => set('business_website', e.target.value)} /></div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={saveSettings} disabled={saving} className="btn-primary flex items-center gap-1.5">
          <Save size={14} /> {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* User Management */}
      {isAdmin && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-txt-primary">Users</h2>
            <button onClick={() => { setEditUser({ name: '', email: '', role: 'employee', password: '' }); setUserModal(true); }} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5"><Plus size={13} /> Add User</button>
          </div>
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between bg-bg border border-border rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-txt-primary">{u.name}</p>
                  <p className="text-xs text-txt-muted">{u.email} · <span className="capitalize">{u.role}</span></p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditUser({ ...u, password: '' }); setUserModal(true); }} className="p-1.5 text-txt-muted hover:text-cyan"><Edit2 size={14} /></button>
                  {u.id !== user?.id && <button onClick={() => setDeleteUserId(u.id)} className="p-1.5 text-txt-muted hover:text-danger"><Trash2 size={14} /></button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exports */}
      <div className="card">
        <h2 className="text-sm font-semibold text-txt-primary mb-4">Data Export</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Sales CSV', type: 'sales' as const },
            { label: 'Products CSV', type: 'products' as const },
            { label: 'Customers CSV', type: 'customers' as const },
            { label: 'SQLite Backup', type: 'backup' as const },
          ].map(({ label, type }) => (
            <button key={type} onClick={() => exportData(type)} className="btn-secondary flex items-center gap-2 justify-center py-3">
              <Download size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Restore */}
      {isAdmin && (
        <div className="card border-warning/20">
          <h2 className="text-sm font-semibold text-warning mb-1">Restore Database from Backup</h2>
          <p className="text-xs text-txt-muted mb-4">Upload a <strong>.db</strong> backup file to replace all current data. Use this to migrate your local data to the online version.</p>
          <label className="btn-secondary flex items-center gap-2 w-fit cursor-pointer py-3 px-4">
            <Upload size={14} /> Select Backup File (.db)
            <input type="file" accept=".db" className="hidden" onChange={restoreDB} />
          </label>
        </div>
      )}

      {/* Activity Log */}
      {isAdmin && (
        <div className="card">
          <h2 className="text-sm font-semibold text-txt-primary mb-4 flex items-center gap-2"><Clock size={15} /> Activity Log</h2>
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {log.slice(0, 100).map(entry => (
              <div key={entry.id} className="flex items-center gap-3 text-xs py-2 border-b border-border/50">
                <span className="text-txt-muted w-32 shrink-0">{entry.created_at.split('T').join(' ').slice(0, 16)}</span>
                <span className="text-cyan font-medium w-20 shrink-0">{entry.user_name}</span>
                <span className={`w-16 shrink-0 ${entry.action === 'delete' ? 'text-danger' : entry.action === 'create' ? 'text-success' : 'text-txt-secondary'}`}>{entry.action}</span>
                <span className="text-txt-muted w-20 shrink-0">{entry.entity_type}</span>
                <span className="text-txt-secondary truncate">{entry.details}</span>
              </div>
            ))}
            {log.length === 0 && <p className="text-txt-muted text-sm text-center py-8">No activity yet</p>}
          </div>
        </div>
      )}

      {/* User Modal */}
      <Modal open={userModal} onClose={() => setUserModal(false)} title={editUser?.id ? 'Edit User' : 'Add User'} size="sm"
        footer={<div className="flex justify-end gap-2"><button onClick={() => setUserModal(false)} className="btn-secondary">Cancel</button><button onClick={saveUser} disabled={savingUser} className="btn-primary">{savingUser ? 'Saving...' : 'Save'}</button></div>}>
        {editUser && (
          <div className="space-y-3">
            <div><label className="label">Name *</label><input className="input" value={editUser.name || ''} onChange={e => setEditUser(u => ({ ...u!, name: e.target.value }))} /></div>
            <div><label className="label">Email *</label><input type="email" className="input" value={editUser.email || ''} onChange={e => setEditUser(u => ({ ...u!, email: e.target.value }))} /></div>
            <div><label className="label">Role</label>
              <select className="input" value={editUser.role || 'employee'} onChange={e => setEditUser(u => ({ ...u!, role: e.target.value }))}>
                {ROLES.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
              </select>
            </div>
            <div><label className="label">{editUser.id ? 'New Password (leave blank to keep)' : 'Password *'}</label><input type="password" className="input" value={editUser.password || ''} onChange={e => setEditUser(u => ({ ...u!, password: e.target.value }))} /></div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteUserId} onClose={() => setDeleteUserId(null)} onConfirm={deleteUser} loading={deletingUser} title="Delete User" message="Are you sure you want to delete this user?" />
    </div>
  );
}
