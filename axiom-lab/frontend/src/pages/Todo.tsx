import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Flame, X, Check, MessageSquare, Paperclip, Trash2, ChevronDown, ChevronUp, Send, Download, Bell, BellOff, Archive, RotateCcw } from 'lucide-react';
import { cn } from '../lib/utils';
import Modal from '../components/ui/Modal';

interface Todo {
  id: number;
  title: string;
  description: string;
  category: string;
  priority: number;
  status: 'open' | 'in_progress' | 'done' | 'archived';
  assigned_to: string;
  due_date: string;
  completed_at: string;
  created_by: string;
  notify: number;
  created_at: string;
  updated_at: string;
  comments?: TodoComment[];
  attachments?: TodoAttachment[];
}

interface TodoComment {
  id: number;
  todo_id: number;
  user_id: number;
  user_name: string;
  body: string;
  created_at: string;
}

interface TodoAttachment {
  id: number;
  todo_id: number;
  filename: string;
  original_name: string;
  size: number;
  mime_type: string;
  created_by: string;
  created_at: string;
}

const CATEGORIES = ['General', 'Operations', 'Finance', 'Marketing', 'Procurement', 'Customer'];
const ASSIGNEES = ['', 'Victor', 'Ama', 'Both'];

function PriorityFlames({ priority, size = 13 }: { priority: number; size?: number }) {
  const color = priority === 3 ? 'text-danger' : priority === 2 ? 'text-warning' : 'text-txt-muted';
  return (
    <span className={cn('flex items-center gap-0.5 shrink-0', color)}>
      {Array.from({ length: priority }).map((_, i) => (
        <Flame key={i} size={size} fill="currentColor" strokeWidth={0} />
      ))}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: 'bg-cyan/10 text-cyan border-cyan/20',
    in_progress: 'bg-warning/10 text-warning border-warning/20',
    done: 'bg-success/10 text-success border-success/20',
    archived: 'bg-white/5 text-txt-muted border-border',
  };
  const labels: Record<string, string> = { open: 'Open', in_progress: 'In Progress', done: 'Done', archived: 'Archived' };
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium border whitespace-nowrap', styles[status] || styles.open)}>
      {labels[status] || status}
    </span>
  );
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / 1024 / 1024).toFixed(1) + 'MB';
}

function fmtDate(iso: string) {
  if (!iso) return '';
  return iso.split('T')[0].split(' ')[0];
}

function isOverdue(due: string, status: string) {
  if (!due || status === 'done' || status === 'archived') return false;
  return new Date(due) < new Date(new Date().toDateString());
}

export default function TodoPage() {
  const { id: paramId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'active' | 'done' | 'all'>('active');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');
  const [showArchive, setShowArchive] = useState(false);

  const [selected, setSelected] = useState<Todo | null>(null);
  const [slideOpen, setSlideOpen] = useState(false);

  const [showNew, setShowNew] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', category: 'General', priority: 2, assigned_to: '', due_date: '', notify: true });
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Todo>>({});
  const [saving, setSaving] = useState(false);

  const [commentBody, setCommentBody] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const loadTodos = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (assignedFilter) params.set('assigned_to', assignedFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      const qs = params.toString() ? '?' + params.toString() : '';
      const data = await api.get<Todo[]>(`/todos${qs}`);
      setTodos(data);
    } catch {
      // silent on background refresh
    } finally {
      setLoading(false);
    }
  }, [assignedFilter, priorityFilter]);

  useEffect(() => {
    setLoading(true);
    loadTodos();
    const iv = setInterval(loadTodos, 15000);
    return () => clearInterval(iv);
  }, [loadTodos]);

  useEffect(() => {
    if (paramId && !loading) {
      const id = parseInt(paramId);
      const existing = todos.find(t => t.id === id);
      if (existing) openTask(id);
    }
  }, [paramId, loading]);

  const openTask = async (id: number) => {
    try {
      const data = await api.get<Todo>(`/todos/${id}`);
      setSelected(data);
      setSlideOpen(true);
      setEditing(false);
      setEditData({});
      setCommentBody('');
      navigate(`/todo/${id}`, { replace: true });
    } catch {
      toast('error', 'Failed to load task');
    }
  };

  const closeSlide = () => {
    setSlideOpen(false);
    setSelected(null);
    setEditing(false);
    navigate('/todo', { replace: true });
  };

  const activeTodos = todos.filter(t => {
    if (statusFilter === 'active') return t.status === 'open' || t.status === 'in_progress';
    if (statusFilter === 'done') return t.status === 'done';
    return t.status !== 'archived';
  });

  const archivedTodos = todos.filter(t => t.status === 'archived');

  const createTask = async () => {
    if (!newTask.title.trim()) return toast('error', 'Title required');
    setCreating(true);
    try {
      await api.post('/todos', newTask);
      toast('success', 'Task created');
      setShowNew(false);
      setNewTask({ title: '', description: '', category: 'General', priority: 2, assigned_to: '', due_date: '', notify: true });
      await loadTodos();
    } catch (e: unknown) {
      toast('error', e instanceof Error ? e.message : 'Failed');
    } finally {
      setCreating(false);
    }
  };

  const quickStatus = async (todo: Todo, status: string) => {
    try {
      const updated = await api.put<Todo>(`/todos/${todo.id}`, { status });
      setTodos(ts => ts.map(t => t.id === todo.id ? { ...t, ...updated } : t));
      if (selected?.id === todo.id) setSelected(s => s ? { ...s, ...updated } : s);
    } catch {
      toast('error', 'Update failed');
    }
  };

  const saveEdit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await api.put<Todo>(`/todos/${selected.id}`, editData);
      setTodos(ts => ts.map(t => t.id === selected.id ? { ...t, ...updated } : t));
      setSelected(s => s ? { ...s, ...updated } : s);
      setEditing(false);
      toast('success', 'Saved');
    } catch {
      toast('error', 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = async (id: number) => {
    if (!confirm('Delete this task?')) return;
    try {
      await api.delete(`/todos/${id}`);
      setTodos(ts => ts.filter(t => t.id !== id));
      if (selected?.id === id) closeSlide();
      toast('success', 'Deleted');
    } catch {
      toast('error', 'Delete failed');
    }
  };

  const postComment = async () => {
    if (!selected || !commentBody.trim()) return;
    setPostingComment(true);
    try {
      const comment = await api.post<TodoComment>(`/todos/${selected.id}/comments`, { body: commentBody });
      setSelected(s => s ? { ...s, comments: [...(s.comments || []), comment] } : s);
      setCommentBody('');
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch {
      toast('error', 'Comment failed');
    } finally {
      setPostingComment(false);
    }
  };

  const deleteComment = async (cid: number) => {
    if (!selected) return;
    try {
      await api.delete(`/todos/${selected.id}/comments/${cid}`);
      setSelected(s => s ? { ...s, comments: (s.comments || []).filter(c => c.id !== cid) } : s);
    } catch {
      toast('error', 'Delete failed');
    }
  };

  const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    setUploadingFile(true);
    const form = new FormData();
    form.append('file', file);
    const token = localStorage.getItem('axiom_token');
    try {
      const res = await fetch(`/api/todos/${selected.id}/attachments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) throw new Error('Upload failed');
      const att: TodoAttachment = await res.json();
      setSelected(s => s ? { ...s, attachments: [...(s.attachments || []), att] } : s);
      toast('success', 'File attached');
    } catch {
      toast('error', 'Upload failed');
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const downloadFile = (todoId: number, attId: number, name: string) => {
    const token = localStorage.getItem('axiom_token');
    fetch(`/api/todos/${todoId}/attachments/${attId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
      });
  };

  const deleteFile = async (attId: number) => {
    if (!selected) return;
    try {
      await api.delete(`/todos/${selected.id}/attachments/${attId}`);
      setSelected(s => s ? { ...s, attachments: (s.attachments || []).filter(a => a.id !== attId) } : s);
    } catch {
      toast('error', 'Delete failed');
    }
  };

  const ed = editData as Partial<Todo>;
  const display = editing ? { ...selected, ...ed } as Todo : selected;

  return (
    <div className="space-y-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">To-Do</h1>
          <p className="text-txt-secondary text-sm mt-0.5">Shared task list for Victor & Ama</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-1.5">
          <Plus size={14} /> New Task
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status tabs */}
        <div className="flex bg-card border border-border rounded-lg p-0.5 gap-0.5">
          {([['active', 'Active'], ['done', 'Done'], ['all', 'All']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setStatusFilter(val)}
              className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all', statusFilter === val ? 'bg-cyan/10 text-cyan' : 'text-txt-muted hover:text-txt-primary')}
            >
              {label}
              {val === 'active' && todos.filter(t => t.status === 'open' || t.status === 'in_progress').length > 0 && (
                <span className="ml-1.5 bg-cyan/20 text-cyan px-1.5 py-0.5 rounded-full text-[9px] font-bold">
                  {todos.filter(t => t.status === 'open' || t.status === 'in_progress').length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Priority filter */}
        <div className="flex items-center gap-1">
          {[['', 'All'], ['1', '🔥'], ['2', '🔥🔥'], ['3', '🔥🔥🔥']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setPriorityFilter(val)}
              className={cn('px-2.5 py-1.5 rounded-lg text-xs border transition-all', priorityFilter === val ? 'border-cyan/30 bg-cyan/5 text-cyan' : 'border-border text-txt-muted hover:text-txt-primary hover:border-border/80')}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Assigned filter */}
        <div className="flex items-center gap-1">
          {[['', 'Everyone'], ['Victor', 'Victor'], ['Ama', 'Ama']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setAssignedFilter(val)}
              className={cn('px-2.5 py-1.5 rounded-lg text-xs border transition-all', assignedFilter === val ? 'border-purple/30 bg-purple/5 text-purple' : 'border-border text-txt-muted hover:text-txt-primary')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Task list */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-2 border-cyan/30 border-t-cyan rounded-full animate-spin mx-auto mb-3" />
            <p className="text-txt-muted text-sm">Loading tasks...</p>
          </div>
        ) : activeTodos.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-cyan/5 border border-cyan/10 flex items-center justify-center mx-auto mb-3">
              <Check size={20} className="text-cyan/40" />
            </div>
            <p className="text-txt-muted text-sm">No tasks here</p>
            <button onClick={() => setShowNew(true)} className="mt-3 text-xs text-cyan hover:underline">Create the first one</button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {activeTodos.map(todo => (
              <div
                key={todo.id}
                onClick={() => openTask(todo.id)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] cursor-pointer transition-colors group',
                  todo.status === 'done' && 'opacity-60'
                )}
              >
                {/* Quick complete */}
                <button
                  onClick={e => { e.stopPropagation(); quickStatus(todo, todo.status === 'done' ? 'open' : 'done'); }}
                  className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                    todo.status === 'done' ? 'border-success bg-success/20 text-success' : 'border-border hover:border-success/60'
                  )}
                >
                  {todo.status === 'done' && <Check size={11} strokeWidth={3} />}
                </button>

                {/* Priority */}
                <PriorityFlames priority={todo.priority} />

                {/* Title */}
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium text-txt-primary truncate', todo.status === 'done' && 'line-through text-txt-muted')}>
                    {todo.title}
                  </p>
                  {todo.description && (
                    <p className="text-xs text-txt-muted truncate mt-0.5">{todo.description}</p>
                  )}
                </div>

                {/* Meta */}
                <div className="hidden md:flex items-center gap-2 shrink-0">
                  {todo.category && todo.category !== 'General' && (
                    <span className="px-2 py-0.5 bg-white/5 border border-border rounded-full text-[10px] text-txt-muted">{todo.category}</span>
                  )}
                  {todo.assigned_to && (
                    <span className="text-[10px] text-purple font-medium">{todo.assigned_to}</span>
                  )}
                  {todo.due_date && (
                    <span className={cn('text-xs', isOverdue(todo.due_date, todo.status) ? 'text-danger font-medium' : 'text-txt-muted')}>
                      {isOverdue(todo.due_date, todo.status) ? '⚠ ' : ''}{fmtDate(todo.due_date)}
                    </span>
                  )}
                  <StatusBadge status={todo.status} />
                </div>

                {/* Delete */}
                <button
                  onClick={e => { e.stopPropagation(); deleteTask(todo.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-txt-muted hover:text-danger transition-all shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Archive section */}
      {archivedTodos.length > 0 && (
        <div>
          <button
            onClick={() => setShowArchive(v => !v)}
            className="flex items-center gap-2 text-xs text-txt-muted hover:text-txt-primary transition-colors mb-2"
          >
            {showArchive ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            <Archive size={13} />
            Archived ({archivedTodos.length})
          </button>
          {showArchive && (
            <div className="card p-0 overflow-hidden opacity-60">
              <div className="divide-y divide-border">
                {archivedTodos.map(todo => (
                  <div
                    key={todo.id}
                    onClick={() => openTask(todo.id)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] cursor-pointer transition-colors group"
                  >
                    <PriorityFlames priority={todo.priority} size={11} />
                    <p className="flex-1 text-xs text-txt-muted truncate line-through">{todo.title}</p>
                    <button
                      onClick={e => { e.stopPropagation(); quickStatus(todo, 'open'); }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-txt-muted hover:text-cyan transition-all"
                      title="Restore"
                    >
                      <RotateCcw size={13} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); deleteTask(todo.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-txt-muted hover:text-danger transition-all"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Slide-over */}
      {slideOpen && selected && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={closeSlide} />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-card border-l border-border z-50 flex flex-col shadow-2xl">
            {/* Slide-over header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <PriorityFlames priority={display?.priority ?? selected.priority} size={15} />
                <StatusBadge status={display?.status ?? selected.status} />
              </div>
              <div className="flex items-center gap-1">
                {!editing ? (
                  <button onClick={() => { setEditing(true); setEditData({ ...selected }); }} className="p-1.5 text-txt-muted hover:text-cyan transition-colors text-xs border border-border rounded-lg px-2.5">
                    Edit
                  </button>
                ) : (
                  <>
                    <button onClick={() => setEditing(false)} className="p-1.5 text-txt-muted hover:text-txt-primary border border-border rounded-lg text-xs px-2.5">Cancel</button>
                    <button onClick={saveEdit} disabled={saving} className="btn-primary text-xs py-1.5 px-3">{saving ? 'Saving...' : 'Save'}</button>
                  </>
                )}
                <button onClick={closeSlide} className="p-1.5 ml-1 text-txt-muted hover:text-txt-primary">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Slide-over body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Title */}
              {editing ? (
                <input
                  className="input text-base font-semibold"
                  value={(ed.title as string) ?? selected.title}
                  onChange={e => setEditData(d => ({ ...d, title: e.target.value }))}
                />
              ) : (
                <h2 className="text-base font-semibold text-txt-primary">{selected.title}</h2>
              )}

              {/* Description */}
              {editing ? (
                <textarea
                  className="input min-h-[80px] resize-y text-sm"
                  placeholder="Description..."
                  value={(ed.description as string) ?? selected.description}
                  onChange={e => setEditData(d => ({ ...d, description: e.target.value }))}
                />
              ) : selected.description ? (
                <p className="text-sm text-txt-secondary whitespace-pre-wrap">{selected.description}</p>
              ) : null}

              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-[10px]">Category</label>
                  {editing ? (
                    <select className="input text-sm" value={(ed.category as string) ?? selected.category} onChange={e => setEditData(d => ({ ...d, category: e.target.value }))}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : (
                    <p className="text-sm text-txt-primary">{selected.category}</p>
                  )}
                </div>

                <div>
                  <label className="label text-[10px]">Priority</label>
                  {editing ? (
                    <select className="input text-sm" value={(ed.priority as number) ?? selected.priority} onChange={e => setEditData(d => ({ ...d, priority: parseInt(e.target.value) }))}>
                      <option value={1}>🔥 Low</option>
                      <option value={2}>🔥🔥 Medium</option>
                      <option value={3}>🔥🔥🔥 Urgent</option>
                    </select>
                  ) : (
                    <div className="flex items-center gap-1 mt-0.5">
                      <PriorityFlames priority={selected.priority} />
                      <span className="text-xs text-txt-muted">{['', 'Low', 'Medium', 'Urgent'][selected.priority]}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="label text-[10px]">Assigned To</label>
                  {editing ? (
                    <select className="input text-sm" value={(ed.assigned_to as string) ?? selected.assigned_to} onChange={e => setEditData(d => ({ ...d, assigned_to: e.target.value }))}>
                      {ASSIGNEES.map(a => <option key={a} value={a}>{a || 'Unassigned'}</option>)}
                    </select>
                  ) : (
                    <p className="text-sm text-txt-primary">{selected.assigned_to || <span className="text-txt-muted">Unassigned</span>}</p>
                  )}
                </div>

                <div>
                  <label className="label text-[10px]">Due Date</label>
                  {editing ? (
                    <input type="date" className="input text-sm" value={(ed.due_date as string) ?? selected.due_date} onChange={e => setEditData(d => ({ ...d, due_date: e.target.value }))} />
                  ) : (
                    <p className={cn('text-sm', isOverdue(selected.due_date, selected.status) ? 'text-danger font-medium' : 'text-txt-primary')}>
                      {selected.due_date ? fmtDate(selected.due_date) : <span className="text-txt-muted">—</span>}
                    </p>
                  )}
                </div>

                <div>
                  <label className="label text-[10px]">Status</label>
                  {editing ? (
                    <select className="input text-sm" value={(ed.status as string) ?? selected.status} onChange={e => setEditData(d => ({ ...d, status: e.target.value as Todo['status'] }))}>
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="done">Done</option>
                      <option value="archived">Archived</option>
                    </select>
                  ) : (
                    <div className="mt-0.5"><StatusBadge status={selected.status} /></div>
                  )}
                </div>

                <div>
                  <label className="label text-[10px]">WhatsApp Notify</label>
                  {editing ? (
                    <button
                      onClick={() => setEditData(d => ({ ...d, notify: d.notify ? 0 : 1 }))}
                      className={cn('flex items-center gap-1.5 text-xs mt-1', (ed.notify ?? selected.notify) ? 'text-success' : 'text-txt-muted')}
                    >
                      {(ed.notify ?? selected.notify) ? <Bell size={13} /> : <BellOff size={13} />}
                      {(ed.notify ?? selected.notify) ? 'On' : 'Off'}
                    </button>
                  ) : (
                    <div className={cn('flex items-center gap-1 text-xs mt-1', selected.notify ? 'text-success' : 'text-txt-muted')}>
                      {selected.notify ? <Bell size={13} /> : <BellOff size={13} />}
                      {selected.notify ? 'On' : 'Off'}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick actions when not editing */}
              {!editing && (
                <div className="flex flex-wrap gap-2">
                  {selected.status !== 'done' && (
                    <button onClick={() => quickStatus(selected, 'done')} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-success/10 text-success border border-success/20 hover:bg-success/20 transition-colors">
                      <Check size={12} /> Mark Done
                    </button>
                  )}
                  {selected.status === 'done' && (
                    <button onClick={() => quickStatus(selected, 'open')} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-cyan/10 text-cyan border border-cyan/20 hover:bg-cyan/20 transition-colors">
                      <RotateCcw size={12} /> Reopen
                    </button>
                  )}
                  {selected.status !== 'archived' && (
                    <button onClick={() => quickStatus(selected, 'archived')} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/5 text-txt-muted border border-border hover:text-txt-primary transition-colors">
                      <Archive size={12} /> Archive
                    </button>
                  )}
                  <button onClick={() => deleteTask(selected.id)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-danger/5 text-danger border border-danger/20 hover:bg-danger/10 transition-colors ml-auto">
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              )}

              {/* Meta info */}
              <div className="text-[10px] text-txt-muted space-y-0.5 border-t border-border pt-3">
                <p>Created by {selected.created_by} · {fmtDate(selected.created_at)}</p>
                {selected.completed_at && <p>Completed · {fmtDate(selected.completed_at)}</p>}
              </div>

              {/* Attachments */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-txt-primary flex items-center gap-1.5">
                    <Paperclip size={12} /> Attachments {selected.attachments && selected.attachments.length > 0 && `(${selected.attachments.length})`}
                  </h3>
                  <label className="text-xs text-cyan hover:underline cursor-pointer">
                    {uploadingFile ? 'Uploading...' : '+ Add file'}
                    <input ref={fileRef} type="file" className="hidden" onChange={uploadFile} disabled={uploadingFile} />
                  </label>
                </div>
                {selected.attachments && selected.attachments.length > 0 ? (
                  <div className="space-y-1.5">
                    {selected.attachments.map(att => (
                      <div key={att.id} className="flex items-center gap-2 bg-bg border border-border rounded-lg px-3 py-2">
                        <Paperclip size={12} className="text-txt-muted shrink-0" />
                        <span className="text-xs text-txt-primary truncate flex-1">{att.original_name}</span>
                        <span className="text-[10px] text-txt-muted shrink-0">{fmtSize(att.size)}</span>
                        <button onClick={() => downloadFile(selected.id, att.id, att.original_name)} className="p-1 text-txt-muted hover:text-cyan transition-colors">
                          <Download size={12} />
                        </button>
                        <button onClick={() => deleteFile(att.id)} className="p-1 text-txt-muted hover:text-danger transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-txt-muted">No attachments</p>
                )}
              </div>

              {/* Comments */}
              <div>
                <h3 className="text-xs font-semibold text-txt-primary flex items-center gap-1.5 mb-3">
                  <MessageSquare size={12} /> Comments {selected.comments && selected.comments.length > 0 && `(${selected.comments.length})`}
                </h3>
                <div className="space-y-3 mb-3">
                  {selected.comments && selected.comments.length > 0 ? (
                    selected.comments.map(c => (
                      <div key={c.id} className="flex gap-2 group">
                        <div className="w-6 h-6 rounded-full bg-purple/20 border border-purple/30 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-[9px] text-purple font-bold">{c.user_name?.[0]?.toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-medium text-txt-primary">{c.user_name}</span>
                            <span className="text-[10px] text-txt-muted">{fmtDate(c.created_at)}</span>
                          </div>
                          <p className="text-sm text-txt-secondary mt-0.5 whitespace-pre-wrap">{c.body}</p>
                        </div>
                        {(c.user_id === user?.id || user?.role === 'admin') && (
                          <button onClick={() => deleteComment(c.id)} className="opacity-0 group-hover:opacity-100 p-1 text-txt-muted hover:text-danger transition-all shrink-0">
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-txt-muted">No comments yet</p>
                  )}
                  <div ref={commentsEndRef} />
                </div>

                {/* Comment input */}
                <div className="flex gap-2">
                  <textarea
                    className="input flex-1 text-sm min-h-[64px] resize-none"
                    placeholder="Add a comment..."
                    value={commentBody}
                    onChange={e => setCommentBody(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postComment(); }}
                  />
                  <button
                    onClick={postComment}
                    disabled={postingComment || !commentBody.trim()}
                    className="btn-primary px-3 self-end"
                  >
                    <Send size={13} />
                  </button>
                </div>
                <p className="text-[10px] text-txt-muted mt-1">⌘+Enter to send</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* New Task Modal */}
      <Modal
        open={showNew}
        onClose={() => setShowNew(false)}
        title="New Task"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNew(false)} className="btn-secondary">Cancel</button>
            <button onClick={createTask} disabled={creating} className="btn-primary">{creating ? 'Creating...' : 'Create Task'}</button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">Title *</label>
            <input
              className="input"
              placeholder="What needs to be done?"
              value={newTask.title}
              onChange={e => setNewTask(t => ({ ...t, title: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') createTask(); }}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-[72px] resize-none" placeholder="Details..." value={newTask.description} onChange={e => setNewTask(t => ({ ...t, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Priority</label>
              <select className="input" value={newTask.priority} onChange={e => setNewTask(t => ({ ...t, priority: parseInt(e.target.value) }))}>
                <option value={1}>🔥 Low</option>
                <option value={2}>🔥🔥 Medium</option>
                <option value={3}>🔥🔥🔥 Urgent</option>
              </select>
            </div>
            <div>
              <label className="label">Assign To</label>
              <select className="input" value={newTask.assigned_to} onChange={e => setNewTask(t => ({ ...t, assigned_to: e.target.value }))}>
                {ASSIGNEES.map(a => <option key={a} value={a}>{a || 'Unassigned'}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={newTask.category} onChange={e => setNewTask(t => ({ ...t, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Due Date</label>
              <input type="date" className="input" value={newTask.due_date} onChange={e => setNewTask(t => ({ ...t, due_date: e.target.value }))} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="notify-new" checked={newTask.notify} onChange={e => setNewTask(t => ({ ...t, notify: e.target.checked }))} className="accent-cyan" />
            <label htmlFor="notify-new" className="text-sm text-txt-secondary cursor-pointer">Send WhatsApp notification to assigned person</label>
          </div>
        </div>
      </Modal>
    </div>
  );
}
