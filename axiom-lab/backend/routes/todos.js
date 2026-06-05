const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const multer = require('multer');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function sendWhatsApp(to, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !token || !from || !to) return;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: `whatsapp:${from}`, To: `whatsapp:${to}`, Body: body }).toString(),
    });
    if (!res.ok) console.error('Twilio error:', await res.text());
  } catch (e) {
    console.error('Twilio error:', e.message);
  }
}

async function notifyTodo(todo, action, actorName) {
  if (!todo.notify) return;
  const assigned = todo.assigned_to;
  if (!assigned) return;

  const victorPhone = process.env.VICTOR_WHATSAPP;
  const amaPhone = process.env.AMA_WHATSAPP;
  const flames = '🔥'.repeat(Math.min(todo.priority || 1, 3));

  let msg = '';
  if (action === 'created') {
    msg = `${flames} *New task assigned*\n${todo.title}${todo.description ? '\n' + todo.description.slice(0, 120) : ''}${todo.due_date ? '\nDue: ' + todo.due_date : ''}\n_by ${actorName}_`;
  } else if (action === 'completed') {
    msg = `✅ *Task completed*\n${todo.title}\n_by ${actorName}_`;
  } else if (action === 'comment') {
    msg = `💬 *New comment on task*\n${todo.title}\n_by ${actorName}_`;
  }

  const phones = [];
  if ((assigned === 'Victor' || assigned === 'Both') && victorPhone) phones.push(victorPhone);
  if ((assigned === 'Ama' || assigned === 'Both') && amaPhone) phones.push(amaPhone);
  for (const phone of phones) await sendWhatsApp(phone, msg);
}

router.get('/meta/counts', requireAuth, (req, res) => {
  const open = db.prepare(`SELECT COUNT(*) as c FROM todos WHERE status IN ('open','in_progress')`).get().c;
  res.json({ open });
});

router.get('/', requireAuth, (req, res) => {
  const { status, priority, assigned_to } = req.query;
  let sql = `SELECT * FROM todos WHERE 1=1`;
  const params = [];
  if (status && status !== 'all') { sql += ` AND status = ?`; params.push(status); }
  if (priority) { sql += ` AND priority = ?`; params.push(parseInt(priority)); }
  if (assigned_to) { sql += ` AND (assigned_to = ? OR assigned_to = 'Both')`; params.push(assigned_to); }
  sql += ` ORDER BY CASE status WHEN 'open' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'done' THEN 3 ELSE 4 END, priority DESC, created_at DESC`;
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', requireAuth, (req, res) => {
  const todo = db.prepare(`SELECT * FROM todos WHERE id = ?`).get(req.params.id);
  if (!todo) return res.status(404).json({ error: 'Not found' });
  const comments = db.prepare(`SELECT * FROM todo_comments WHERE todo_id = ? ORDER BY created_at ASC`).all(req.params.id);
  const attachments = db.prepare(`SELECT id, todo_id, filename, original_name, size, mime_type, created_by, created_at FROM todo_attachments WHERE todo_id = ? ORDER BY created_at ASC`).all(req.params.id);
  res.json({ ...todo, comments, attachments });
});

router.post('/', requireAuth, async (req, res) => {
  const { title, description, category, priority, assigned_to, due_date, notify } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' });

  const info = db.prepare(`
    INSERT INTO todos (title, description, category, priority, assigned_to, due_date, notify, created_by_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title.trim(), description || '', category || 'General', priority ?? 2, assigned_to || '', due_date || '', notify !== false ? 1 : 0, req.user.id, req.user.name);

  const todo = db.prepare(`SELECT * FROM todos WHERE id = ?`).get(info.lastInsertRowid);
  db.prepare(`INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, 'create', 'todo', ?, ?)`).run(req.user.id, req.user.name, String(todo.id), title.trim());

  try { await notifyTodo(todo, 'created', req.user.name); } catch (e) { console.error(e); }
  res.json(todo);
});

router.put('/:id', requireAuth, async (req, res) => {
  const existing = db.prepare(`SELECT * FROM todos WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { title, description, category, priority, status, assigned_to, due_date, notify } = req.body;
  const newStatus = status !== undefined ? status : existing.status;
  const wasCompleted = existing.status !== 'done' && newStatus === 'done';
  const completedAt = wasCompleted
    ? new Date().toISOString().replace('T', ' ').slice(0, 19)
    : (newStatus !== 'done' ? '' : existing.completed_at);

  db.prepare(`
    UPDATE todos SET title=?, description=?, category=?, priority=?, status=?, assigned_to=?, due_date=?, notify=?, completed_at=?, updated_at=datetime('now')
    WHERE id=?
  `).run(
    title !== undefined ? title : existing.title,
    description !== undefined ? description : existing.description,
    category !== undefined ? category : existing.category,
    priority !== undefined ? priority : existing.priority,
    newStatus,
    assigned_to !== undefined ? assigned_to : existing.assigned_to,
    due_date !== undefined ? due_date : existing.due_date,
    notify !== undefined ? (notify ? 1 : 0) : existing.notify,
    completedAt,
    req.params.id
  );

  const updated = db.prepare(`SELECT * FROM todos WHERE id = ?`).get(req.params.id);
  db.prepare(`INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, 'update', 'todo', ?, ?)`).run(req.user.id, req.user.name, req.params.id, updated.title);

  if (wasCompleted) { try { await notifyTodo(updated, 'completed', req.user.name); } catch (e) { console.error(e); } }
  res.json(updated);
});

router.delete('/:id', requireAuth, (req, res) => {
  const todo = db.prepare(`SELECT title FROM todos WHERE id = ?`).get(req.params.id);
  if (!todo) return res.status(404).json({ error: 'Not found' });
  db.prepare(`DELETE FROM todos WHERE id = ?`).run(req.params.id);
  db.prepare(`INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, 'delete', 'todo', ?, ?)`).run(req.user.id, req.user.name, req.params.id, todo.title);
  res.json({ ok: true });
});

router.post('/:id/comments', requireAuth, async (req, res) => {
  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'Body required' });
  const todo = db.prepare(`SELECT * FROM todos WHERE id = ?`).get(req.params.id);
  if (!todo) return res.status(404).json({ error: 'Not found' });

  const info = db.prepare(`INSERT INTO todo_comments (todo_id, user_id, user_name, body) VALUES (?, ?, ?, ?)`).run(
    req.params.id, req.user.id, req.user.name, body.trim()
  );
  const comment = db.prepare(`SELECT * FROM todo_comments WHERE id = ?`).get(info.lastInsertRowid);
  try { await notifyTodo(todo, 'comment', req.user.name); } catch (e) { console.error(e); }
  res.json(comment);
});

router.delete('/:id/comments/:cid', requireAuth, (req, res) => {
  const comment = db.prepare(`SELECT * FROM todo_comments WHERE id = ? AND todo_id = ?`).get(req.params.cid, req.params.id);
  if (!comment) return res.status(404).json({ error: 'Not found' });
  if (comment.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  db.prepare(`DELETE FROM todo_comments WHERE id = ?`).run(req.params.cid);
  res.json({ ok: true });
});

router.post('/:id/attachments', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const todo = db.prepare(`SELECT id FROM todos WHERE id = ?`).get(req.params.id);
  if (!todo) return res.status(404).json({ error: 'Not found' });

  const info = db.prepare(`
    INSERT INTO todo_attachments (todo_id, filename, original_name, size, mime_type, data, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, req.file.originalname, req.file.originalname, req.file.size, req.file.mimetype, req.file.buffer, req.user.name);

  const att = db.prepare(`SELECT id, todo_id, filename, original_name, size, mime_type, created_by, created_at FROM todo_attachments WHERE id = ?`).get(info.lastInsertRowid);
  res.json(att);
});

router.get('/:id/attachments/:aid', requireAuth, (req, res) => {
  const att = db.prepare(`SELECT * FROM todo_attachments WHERE id = ? AND todo_id = ?`).get(req.params.aid, req.params.id);
  if (!att) return res.status(404).json({ error: 'Not found' });
  res.setHeader('Content-Type', att.mime_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${att.original_name}"`);
  res.send(att.data);
});

router.delete('/:id/attachments/:aid', requireAuth, (req, res) => {
  const att = db.prepare(`SELECT id FROM todo_attachments WHERE id = ? AND todo_id = ?`).get(req.params.aid, req.params.id);
  if (!att) return res.status(404).json({ error: 'Not found' });
  db.prepare(`DELETE FROM todo_attachments WHERE id = ?`).run(req.params.aid);
  res.json({ ok: true });
});

module.exports = router;
