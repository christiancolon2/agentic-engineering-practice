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
});

describe('DELETE /users/:id', () => {
  test('deletes the user when the API key is correct', async () => {
    const res = await request(app).delete('/users/1').set('x-api-key', 'dev-key');
    expect(res.status).toBe(200);
    expect(db.prepare('SELECT id FROM users WHERE id = 1').get()).toBeUndefined();
  });

  test('rejects the request when the API key is missing', async () => {
    const res = await request(app).delete('/users/1');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
    expect(db.prepare('SELECT id FROM users WHERE id = 1').get()).toBeDefined();
  });

  test('rejects the request when the API key is wrong', async () => {
    const res = await request(app).delete('/users/1').set('x-api-key', 'wrong-key');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
    expect(db.prepare('SELECT id FROM users WHERE id = 1').get()).toBeDefined();
  });
});

describe('DELETE /projects/:id', () => {
  test('deletes the project when the API key is correct', async () => {
    const res = await request(app).delete('/projects/1').set('x-api-key', 'dev-key');
    expect(res.status).toBe(200);
    expect(db.prepare('SELECT id FROM projects WHERE id = 1').get()).toBeUndefined();
  });

  test('rejects the request when the API key is missing', async () => {
    const res = await request(app).delete('/projects/1');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
    expect(db.prepare('SELECT id FROM projects WHERE id = 1').get()).toBeDefined();
  });

  test('rejects the request when the API key is wrong', async () => {
    const res = await request(app).delete('/projects/1').set('x-api-key', 'wrong-key');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
    expect(db.prepare('SELECT id FROM projects WHERE id = 1').get()).toBeDefined();
  });
});
