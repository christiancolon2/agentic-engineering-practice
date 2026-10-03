const commentsQueries = require('../db/queries/comments');
const tasksQueries = require('../db/queries/tasks');
const usersQueries = require('../db/queries/users');
const { isNonEmptyString } = require('../utils/validation');

function assertTaskExists(taskId) {
  if (!tasksQueries.getTaskById(taskId)) {
    throw { status: 404, message: 'Task not found' };
  }
}

function listComments(taskId) {
  assertTaskExists(taskId);
  return commentsQueries.listCommentsByTask(taskId);
}

function createComment(taskId, { user_id, body }) {
  assertTaskExists(taskId);

  if (!body || !isNonEmptyString(body)) {
    throw { status: 400, message: 'body is required' };
  }
  if (!user_id) {
    throw { status: 400, message: 'user_id is required' };
  }
  if (!usersQueries.getUserById(parseInt(user_id))) {
    throw { status: 400, message: 'user not found' };
  }

  return commentsQueries.insertComment(taskId, parseInt(user_id), body);
}

module.exports = { listComments, createComment };
