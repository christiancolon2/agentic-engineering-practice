const { db } = require('../connection');

function listUsers() {
  return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
}

function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function insertUser(name, email) {
  const result = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)').run(name, email);
  return getUserById(result.lastInsertRowid);
}

function updateUser(id, name, email) {
  db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(name, email, id);
  return getUserById(id);
}

// Returns true if a row was deleted.
function deleteUser(id) {
  return db.prepare('DELETE FROM users WHERE id = ?').run(id).changes > 0;
}

module.exports = { listUsers, getUserById, insertUser, updateUser, deleteUser };
