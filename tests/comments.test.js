process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/index');
const { db } = require('../src/db/connection');
const { createSchema } = require('../src/db/schema');

beforeAll(() => {
  createSchema(db);
});

beforeEach(() => {
  db.exec('DELETE FROM task_tags; DELETE FROM comments; DELETE FROM tasks; DELETE FROM projects; DELETE FROM users; DELETE FROM tags;');
  db.prepare('INSERT INTO users (id, name, email) VALUES (1, ?, ?)').run('Test User', 'test@example.com');
  db.prepare('INSERT INTO projects (id, name) VALUES (1, ?)').run('Test Project');
  db.prepare("INSERT INTO tasks (id, title, project_id, status) VALUES (1, 'Task A', 1, 'active')").run();
});

describe('GET /tasks/:id/comments', () => {
  test('returns the comments on a task with the author name', async () => {
    db.prepare("INSERT INTO comments (task_id, user_id, body, created_at) VALUES (1, 1, 'First', '2026-01-01 10:00:00')").run();
    db.prepare("INSERT INTO comments (task_id, user_id, body, created_at) VALUES (1, 1, 'Second', '2026-01-01 11:00:00')").run();
    const res = await request(app).get('/tasks/1/comments');
    expect(res.status).toBe(200);
    expect(res.body.map((c) => c.body)).toEqual(['First', 'Second']);
    expect(res.body[0].user_name).toBe('Test User');
  });

  test('returns an empty list when the task has no comments', async () => {
    const res = await request(app).get('/tasks/1/comments');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('returns 404 when the task does not exist', async () => {
    const res = await request(app).get('/tasks/999/comments');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Task not found');
  });
});

describe('POST /tasks/:id/comments', () => {
  test('creates a comment on a task', async () => {
    const res = await request(app)
      .post('/tasks/1/comments')
      .send({ user_id: 1, body: 'Looks good' });
    expect(res.status).toBe(201);
    expect(res.body.body).toBe('Looks good');
    expect(res.body.task_id).toBe(1);
    expect(res.body.user_id).toBe(1);
    expect(res.body.user_name).toBe('Test User');
    expect(res.body.id).toBeDefined();
  });

  test('returns 404 when the task does not exist', async () => {
    const res = await request(app)
      .post('/tasks/999/comments')
      .send({ user_id: 1, body: 'Hello' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Task not found');
  });

  test('rejects a comment with no body', async () => {
    const res = await request(app).post('/tasks/1/comments').send({ user_id: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('body is required');
  });

  test('rejects a comment with a blank body', async () => {
    const res = await request(app).post('/tasks/1/comments').send({ user_id: 1, body: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('body is required');
  });

  test('rejects a comment with no user_id', async () => {
    const res = await request(app).post('/tasks/1/comments').send({ body: 'Hello' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('user_id is required');
  });

  test('rejects a comment from a user that does not exist', async () => {
    const res = await request(app).post('/tasks/1/comments').send({ user_id: 999, body: 'Hello' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('user not found');
  });
});

describe('POST /tasks/:id/comments validation order', () => {
  test('checks that the task exists before checking the body', async () => {
    const res = await request(app).post('/tasks/999/comments').send({});
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Task not found');
  });

  test('checks the body before the user', async () => {
    const res = await request(app).post('/tasks/1/comments').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('body is required');
  });

  test('rejects a body that is not text', async () => {
    const res = await request(app).post('/tasks/1/comments').send({ user_id: 1, body: 42 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('body is required');
  });

  test('accepts the user id as a numeric string', async () => {
    const res = await request(app).post('/tasks/1/comments').send({ user_id: '1', body: 'Hi' });
    expect(res.status).toBe(201);
    expect(res.body.user_id).toBe(1);
  });

  test('keeps the body exactly as sent', async () => {
    const res = await request(app).post('/tasks/1/comments').send({ user_id: 1, body: '  padded  ' });
    expect(res.body.body).toBe('  padded  ');
  });
});

describe('GET /tasks/:id/comments scoping', () => {
  test('only returns comments for the requested task', async () => {
    db.prepare("INSERT INTO tasks (id, title, project_id) VALUES (2, 'Task B', 1)").run();
    db.prepare("INSERT INTO comments (task_id, user_id, body) VALUES (1, 1, 'On one')").run();
    db.prepare("INSERT INTO comments (task_id, user_id, body) VALUES (2, 1, 'On two')").run();
    const res = await request(app).get('/tasks/2/comments');
    expect(res.body.map((c) => c.body)).toEqual(['On two']);
  });
});
