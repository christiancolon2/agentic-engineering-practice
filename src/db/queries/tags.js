const { db } = require('../connection');

function listTags() {
  return db.prepare('SELECT * FROM tags ORDER BY name ASC').all();
}

function getTagById(id) {
  return db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
}

function insertTag(name) {
  const result = db.prepare('INSERT INTO tags (name) VALUES (?)').run(name);
  return getTagById(result.lastInsertRowid);
}

function addTagToTask(taskId, tagId) {
  db.prepare('INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)').run(taskId, tagId);
}

// Returns true if the tag was applied to the task and has been removed.
function removeTagFromTask(taskId, tagId) {
  return db.prepare(
    'DELETE FROM task_tags WHERE task_id = ? AND tag_id = ?'
  ).run(taskId, tagId).changes > 0;
}

module.exports = { listTags, getTagById, insertTag, addTagToTask, removeTagFromTask };
