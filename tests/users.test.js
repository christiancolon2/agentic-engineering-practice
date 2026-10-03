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
});

describe('User endpoints', () => {
  test('GET /users returns empty array when no users exist', async () => {
    const res = await request(app).get('/users');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('POST /users creates a user', async () => {
    const res = await request(app)
      .post('/users')
      .send({ name: 'Alice Chen', email: 'alice@test.com' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Alice Chen');
    expect(res.body.email).toBe('alice@test.com');
    expect(res.body.id).toBeDefined();
  });

  test('POST /users returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/users')
      .send({ email: 'noname@test.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('POST /users returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/users')
      .send({ name: 'No Email' });
    expect(res.status).toBe(400);
  });

  test('POST /users returns 409 when email already exists', async () => {
    await request(app).post('/users').send({ name: 'Alice', email: 'dup@test.com' });
    const res = await request(app).post('/users').send({ name: 'Alice Again', email: 'dup@test.com' });
    expect(res.status).toBe(409);
  });

  test('GET /users/:id returns user', async () => {
    const created = await request(app)
      .post('/users')
      .send({ name: 'Bob', email: 'bob@test.com' });
    const res = await request(app).get(`/users/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Bob');
  });

  test('GET /users/:id returns 404 for unknown user', async () => {
    const res = await request(app).get('/users/99999');
    expect(res.status).toBe(404);
  });

  test('PUT /users/:id updates user name', async () => {
    const created = await request(app)
      .post('/users')
      .send({ name: 'Old Name', email: 'update@test.com' });
    const res = await request(app)
      .put(`/users/${created.body.id}`)
      .send({ name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
    expect(res.body.email).toBe('update@test.com');
  });

  test('DELETE /users/:id removes user', async () => {
    const created = await request(app)
      .post('/users')
      .send({ name: 'Delete Me', email: 'deleteme@test.com' });
    const userId = created.body.id;

    // DELETE requires auth header
    const res = await request(app)
      .delete(`/users/${userId}`)
      .set('x-api-key', 'dev-key');
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);

    const check = await request(app).get(`/users/${userId}`);
    expect(check.status).toBe(404);
  });

  test('GET /users returns all users', async () => {
    await request(app).post('/users').send({ name: 'User One', email: 'one@test.com' });
    await request(app).post('/users').send({ name: 'User Two', email: 'two@test.com' });
    const res = await request(app).get('/users');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

describe('POST /users validation and side effects', () => {
  test('rejects a malformed email address', async () => {
    const res = await request(app).post('/users').send({ name: 'Bad Email', email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid email address');
  });

  test('rejects a blank name with a clear message', async () => {
    const res = await request(app).post('/users').send({ name: '  ', email: 'blank@test.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('name is required');
  });

  test('reports a duplicate email with a clear message', async () => {
    await request(app).post('/users').send({ name: 'Alice', email: 'dup2@test.com' });
    const res = await request(app).post('/users').send({ name: 'Alice Again', email: 'dup2@test.com' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('email already exists');
  });

  test('sends a welcome email to the new user', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    await request(app).post('/users').send({ name: 'Welcome Me', email: 'welcome@test.com' });
    expect(log).toHaveBeenCalledWith('[EMAIL] Sending to:', 'welcome@test.com', '| Subject:', 'Welcome to Taskr!');
    log.mockRestore();
  });
});

describe('PUT /users/:id', () => {
  test('returns 404 when the user does not exist', async () => {
    const res = await request(app).put('/users/99999').send({ name: 'Ghost' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
  });

  test('keeps the existing values for fields that are not sent', async () => {
    const created = await request(app).post('/users').send({ name: 'Keep Name', email: 'keep@test.com' });
    const res = await request(app).put(`/users/${created.body.id}`).send({ email: 'changed@test.com' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Keep Name');
    expect(res.body.email).toBe('changed@test.com');
  });

  test('fails when the new email belongs to another user', async () => {
    await request(app).post('/users').send({ name: 'First', email: 'first@test.com' });
    const second = await request(app).post('/users').send({ name: 'Second', email: 'second@test.com' });
    const res = await request(app).put(`/users/${second.body.id}`).send({ email: 'first@test.com' });
    // Current behavior: the database error surfaces as a 500 rather than a 409.
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/UNIQUE/);
  });
});

describe('DELETE /users/:id', () => {
  test('returns 404 when the user does not exist', async () => {
    const res = await request(app).delete('/users/99999').set('x-api-key', 'dev-key');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
  });
});

describe('PUT /users/:id validation', () => {
  test('accepts an email that is not a valid address', async () => {
    const created = await request(app).post('/users').send({ name: 'Loose', email: 'loose@test.com' });
    const res = await request(app).put(`/users/${created.body.id}`).send({ email: 'not-an-email' });
    // Current behavior: updates are not validated the way creation is.
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('not-an-email');
  });
});
