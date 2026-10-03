const { db } = require('../connection');

function listProjects() {
  return db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
}

function getProjectById(id) {
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
}

function insertProject(name, description, ownerId) {
  const result = db.prepare(
    'INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)'
  ).run(name, description, ownerId);
  return getProjectById(result.lastInsertRowid);
}

function updateProject(id, name, description, ownerId) {
  db.prepare(
    'UPDATE projects SET name = ?, description = ?, owner_id = ? WHERE id = ?'
  ).run(name, description, ownerId, id);
  return getProjectById(id);
}

// Returns true if a row was deleted.
function deleteProject(id) {
  return db.prepare('DELETE FROM projects WHERE id = ?').run(id).changes > 0;
}

// Returns rows of { status, count } for the project's tasks.
function getTaskCountsByStatus(projectId) {
  return db.prepare(
    'SELECT status, COUNT(*) as count FROM tasks WHERE project_id = ? GROUP BY status'
  ).all(projectId);
}

module.exports = {
  listProjects,
  getProjectById,
  insertProject,
  updateProject,
  deleteProject,
  getTaskCountsByStatus
};
