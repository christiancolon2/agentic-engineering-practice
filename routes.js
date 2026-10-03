/*
 * routes.js
 *
 * All API routes for Taskr. This file handles users, projects, tasks, comments,
 * and tags. Route handlers query the database directly — there is no service
 * layer. Validation is inline in each handler. This file is long by design.
 *
 * TODO: split into separate route files per resource
 * TODO: extract database queries into a repository layer
 * TODO: extract validation into shared middleware
 */

const express = require('express');
const router = express.Router();
const { db } = require('./src/db/connection');
const { isNonEmptyString } = require('./src/utils/validation');

// ─── Health ──────────────────────────────────────────────────────────────────

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Comments ────────────────────────────────────────────────────────────────

router.get('/tasks/:id/comments', (req, res) => {
  const taskId = parseInt(req.params.id);
  const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const comments = db.prepare(
    'SELECT c.*, u.name as user_name FROM comments c JOIN users u ON u.id = c.user_id WHERE c.task_id = ? ORDER BY c.created_at ASC'
  ).all(taskId);
  res.json(comments);
});

router.post('/tasks/:id/comments', (req, res) => {
  const taskId = parseInt(req.params.id);
  const { user_id, body } = req.body;

  const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  if (!body || !isNonEmptyString(body)) {
    return res.status(400).json({ error: 'body is required' });
  }
  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(parseInt(user_id));
  if (!user) return res.status(400).json({ error: 'user not found' });

  const result = db.prepare(
    'INSERT INTO comments (task_id, user_id, body) VALUES (?, ?, ?)'
  ).run(taskId, parseInt(user_id), body);
  const comment = db.prepare(
    'SELECT c.*, u.name as user_name FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?'
  ).get(result.lastInsertRowid);
  res.status(201).json(comment);
});

// ─── Tags ─────────────────────────────────────────────────────────────────────

router.get('/tags', (req, res) => {
  const tags = db.prepare('SELECT * FROM tags ORDER BY name ASC').all();
  res.json(tags);
});

router.post('/tags', (req, res) => {
  const { name } = req.body;
  if (!name || !isNonEmptyString(name)) {
    return res.status(400).json({ error: 'name is required' });
  }
  try {
    const result = db.prepare('INSERT INTO tags (name) VALUES (?)').run(name.toLowerCase().trim());
    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(tag);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'tag already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.post('/tasks/:id/tags', (req, res) => {
  const taskId = parseInt(req.params.id);
  const { tag_id } = req.body;

  const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  if (!tag_id) return res.status(400).json({ error: 'tag_id is required' });
  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(parseInt(tag_id));
  if (!tag) return res.status(404).json({ error: 'Tag not found' });

  try {
    db.prepare('INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)').run(taskId, parseInt(tag_id));
    res.status(201).json({ task_id: taskId, tag_id: parseInt(tag_id) });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'tag already applied to this task' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete('/tasks/:id/tags/:tagId', (req, res) => {
  const taskId = parseInt(req.params.id);
  const tagId = parseInt(req.params.tagId);
  const result = db.prepare(
    'DELETE FROM task_tags WHERE task_id = ? AND tag_id = ?'
  ).run(taskId, tagId);
  if (result.changes === 0) return res.status(404).json({ error: 'Tag not applied to this task' });
  res.json({ deleted: true });
});

module.exports = router;
