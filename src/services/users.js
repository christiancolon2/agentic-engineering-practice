const usersQueries = require('../db/queries/users');
const { sendWelcomeEmail } = require('./notifications');
const { validateEmail, isNonEmptyString } = require('../utils/validation');

function listUsers() {
  return usersQueries.listUsers();
}

function getUserById(id) {
  const user = usersQueries.getUserById(id);
  if (!user) {
    throw { status: 404, message: 'User not found' };
  }
  return user;
}

async function createUser({ name, email }) {
  if (!name || !isNonEmptyString(name)) {
    throw { status: 400, message: 'name is required' };
  }
  if (!email || !isNonEmptyString(email)) {
    throw { status: 400, message: 'email is required' };
  }
  if (!validateEmail(email)) {
    throw { status: 400, message: 'Invalid email address' };
  }

  let user;
  try {
    user = usersQueries.insertUser(name, email);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      throw { status: 409, message: 'email already exists' };
    }
    throw err;
  }

  await sendWelcomeEmail(user);
  return user;
}

function updateUser(id, data) {
  const existing = getUserById(id);
  const name = data.name !== undefined ? data.name : existing.name;
  const email = data.email !== undefined ? data.email : existing.email;
  return usersQueries.updateUser(id, name, email);
}

function deleteUser(id) {
  if (!usersQueries.deleteUser(id)) {
    throw { status: 404, message: 'User not found' };
  }
  return { deleted: true };
}

module.exports = { listUsers, getUserById, createUser, updateUser, deleteUser };
