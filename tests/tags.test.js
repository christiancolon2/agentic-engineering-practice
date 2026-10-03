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

describe('GET /tags', () => {
  test('returns all tags sorted by name', async () => {
    db.prepare("INSERT INTO tags (name) VALUES ('urgent')").run();
    db.prepare("INSERT INTO tags (name) VALUES ('bug')").run();
    const res = await request(app).get('/tags');
    expect(res.status).toBe(200);
    expect(res.body.map((t) => t.name)).toEqual(['bug', 'urgent']);
  });

  test('returns an empty list when there are no tags', async () => {
    const res = await request(app).get('/tags');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /tags', () => {
  test('creates a tag with a lowercased, trimmed name', async () => {
    const res = await request(app).post('/tags').send({ name: '  Urgent ' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('urgent');
    expect(res.body.id).toBeDefined();
  });

  test('rejects a tag with no name', async () => {
    const res = await request(app).post('/tags').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('name is required');
  });

  test('rejects a tag with a blank name', async () => {
    const res = await request(app).post('/tags').send({ name: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('name is required');
  });

  test('returns 409 when the tag already exists', async () => {
    await request(app).post('/tags').send({ name: 'bug' });
    const res = await request(app).post('/tags').send({ name: 'BUG' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('tag already exists');
  });
});

describe('POST /tasks/:id/tags', () => {
  let tagId;

  beforeEach(() => {
    tagId = db.prepare("INSERT INTO tags (name) VALUES ('bug')").run().lastInsertRowid;
  });

  test('applies a tag to a task', async () => {
    const res = await request(app).post('/tasks/1/tags').send({ tag_id: tagId });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ task_id: 1, tag_id: Number(tagId) });
    const applied = db.prepare('SELECT * FROM task_tags WHERE task_id = 1 AND tag_id = ?').get(tagId);
    expect(applied).toBeDefined();
  });

  test('returns 404 when the task does not exist', async () => {
    const res = await request(app).post('/tasks/999/tags').send({ tag_id: tagId });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Task not found');
  });

  test('rejects a request with no tag_id', async () => {
    const res = await request(app).post('/tasks/1/tags').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('tag_id is required');
  });

  test('returns 404 when the tag does not exist', async () => {
    const res = await request(app).post('/tasks/1/tags').send({ tag_id: 999 });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Tag not found');
  });

  test('returns 409 when the tag is already applied to the task', async () => {
    await request(app).post('/tasks/1/tags').send({ tag_id: tagId });
    const res = await request(app).post('/tasks/1/tags').send({ tag_id: tagId });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('tag already applied to this task');
  });
});

describe('DELETE /tasks/:id/tags/:tagId', () => {
  let tagId;

  beforeEach(() => {
    tagId = db.prepare("INSERT INTO tags (name) VALUES ('bug')").run().lastInsertRowid;
  });

  test('removes a tag from a task', async () => {
    db.prepare('INSERT INTO task_tags (task_id, tag_id) VALUES (1, ?)').run(tagId);
    const res = await request(app).delete(`/tasks/1/tags/${tagId}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: true });
    const remaining = db.prepare('SELECT * FROM task_tags WHERE task_id = 1').all();
    expect(remaining).toHaveLength(0);
  });

  test('returns 404 when the tag is not applied to the task', async () => {
    const res = await request(app).delete(`/tasks/1/tags/${tagId}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Tag not applied to this task');
  });

  test('returns 404 when the task does not exist', async () => {
    const res = await request(app).delete(`/tasks/999/tags/${tagId}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Tag not applied to this task');
  });
});

describe('POST /tags details', () => {
  test('rejects a name that is not text', async () => {
    const res = await request(app).post('/tags').send({ name: 42 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('name is required');
  });
});

describe('POST /tasks/:id/tags validation order', () => {
  test('checks that the task exists before checking the tag id', async () => {
    const res = await request(app).post('/tasks/999/tags').send({});
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Task not found');
  });

  test('accepts the tag id as a numeric string', async () => {
    const tagId = db.prepare("INSERT INTO tags (name) VALUES ('feature')").run().lastInsertRowid;
    const res = await request(app).post('/tasks/1/tags').send({ tag_id: String(tagId) });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ task_id: 1, tag_id: Number(tagId) });
  });

  test('lets the same tag be applied to different tasks', async () => {
    db.prepare("INSERT INTO tasks (id, title, project_id) VALUES (2, 'Task B', 1)").run();
    const tagId = db.prepare("INSERT INTO tags (name) VALUES ('shared')").run().lastInsertRowid;
    const first = await request(app).post('/tasks/1/tags').send({ tag_id: tagId });
    const second = await request(app).post('/tasks/2/tags').send({ tag_id: tagId });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
  });

  test('shows the applied tag on the task', async () => {
    const tagId = db.prepare("INSERT INTO tags (name) VALUES ('visible')").run().lastInsertRowid;
    await request(app).post('/tasks/1/tags').send({ tag_id: tagId });
    const res = await request(app).get('/tasks/1');
    expect(res.body.tags.map((t) => t.name)).toEqual(['visible']);
  });
});

describe('DELETE /tasks/:id/tags/:tagId scoping', () => {
  test('only removes the tag from the requested task', async () => {
    db.prepare("INSERT INTO tasks (id, title, project_id) VALUES (2, 'Task B', 1)").run();
    const tagId = db.prepare("INSERT INTO tags (name) VALUES ('keep')").run().lastInsertRowid;
    db.prepare('INSERT INTO task_tags (task_id, tag_id) VALUES (1, ?), (2, ?)').run(tagId, tagId);
    await request(app).delete(`/tasks/1/tags/${tagId}`);
    const remaining = db.prepare('SELECT task_id FROM task_tags').all();
    expect(remaining).toEqual([{ task_id: 2 }]);
  });
});
