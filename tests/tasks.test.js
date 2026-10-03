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

describe('GET /tasks', () => {
  test('returns empty array when no tasks', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('returns all tasks', async () => {
    db.prepare("INSERT INTO tasks (title, status) VALUES ('Task A', 'active')").run();
    db.prepare("INSERT INTO tasks (title, status) VALUES ('Task B', 'completed')").run();
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  test('filters by ?status=active', async () => {
    db.prepare("INSERT INTO tasks (title, status) VALUES ('Active Task', 'active')").run();
    db.prepare("INSERT INTO tasks (title, status) VALUES ('Done Task', 'completed')").run();
    const res = await request(app).get('/tasks?status=active');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Active Task');
  });

  test('filters by ?status=completed', async () => {
    db.prepare("INSERT INTO tasks (title, status) VALUES ('Active Task', 'active')").run();
    db.prepare("INSERT INTO tasks (title, status) VALUES ('Done Task', 'completed')").run();
    const res = await request(app).get('/tasks?status=completed');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Done Task');
  });

  test('returns 400 for invalid status value', async () => {
    const res = await request(app).get('/tasks?status=invalid');
    expect(res.status).toBe(400);
  });
});

describe('POST /tasks', () => {
  test('creates a task with valid data', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'New Task', description: 'Do the thing' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('New Task');
    expect(res.body.status).toBe('active');
    expect(res.body.id).toBeDefined();
  });

  test('creates a task assigned to a project', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'Project Task', project_id: 1 });
    expect(res.status).toBe(201);
    expect(res.body.project_id).toBe(1);
  });

  test('returns 400 when title is missing', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ description: 'No title here' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('returns 400 when title is empty string', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: '   ' });
    expect(res.status).toBe(400);
  });
});

describe('GET /tasks/:id', () => {
  test('returns task by id', async () => {
    const result = db.prepare("INSERT INTO tasks (title) VALUES ('Find Me')").run();
    const res = await request(app).get(`/tasks/${result.lastInsertRowid}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Find Me');
    expect(res.body.tags).toBeDefined();
    expect(res.body.comments).toBeDefined();
  });

  test('returns 404 for unknown id', async () => {
    const res = await request(app).get('/tasks/99999');
    expect(res.status).toBe(404);
  });
});

describe('PUT /tasks/:id', () => {
  test('updates task status to completed', async () => {
    const result = db.prepare("INSERT INTO tasks (title, status) VALUES ('Update Me', 'active')").run();
    const taskId = result.lastInsertRowid;
    const res = await request(app)
      .put(`/tasks/${taskId}`)
      .send({ status: 'completed' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(res.body.completed_at).not.toBeNull();
  });

  test('updates task title', async () => {
    const result = db.prepare("INSERT INTO tasks (title) VALUES ('Old Title')").run();
    const taskId = result.lastInsertRowid;
    const res = await request(app)
      .put(`/tasks/${taskId}`)
      .send({ title: 'New Title' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New Title');
  });

  test('returns 404 for unknown id', async () => {
    const res = await request(app).put('/tasks/99999').send({ title: 'Ghost' });
    expect(res.status).toBe(404);
  });

  test('returns 400 for invalid status', async () => {
    const result = db.prepare("INSERT INTO tasks (title) VALUES ('Status Test')").run();
    const res = await request(app)
      .put(`/tasks/${result.lastInsertRowid}`)
      .send({ status: 'bogus' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /tasks/:id', () => {
  test('deletes a task', async () => {
    const result = db.prepare("INSERT INTO tasks (title) VALUES ('Delete Me')").run();
    const taskId = result.lastInsertRowid;
    const res = await request(app).delete(`/tasks/${taskId}`);
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);

    const check = await request(app).get(`/tasks/${taskId}`);
    expect(check.status).toBe(404);
  });

  test('returns 404 when task does not exist', async () => {
    const res = await request(app).delete('/tasks/99999');
    expect(res.status).toBe(404);
  });
});

describe('GET /tasks filtering and paging', () => {
  beforeEach(() => {
    db.prepare("INSERT INTO users (id, name, email) VALUES (2, 'Second User', 'second@example.com')").run();
    db.prepare("INSERT INTO projects (id, name) VALUES (2, 'Other Project')").run();
  });

  const insertAt = (title, extra = {}) => {
    const row = { project_id: null, assignee_id: null, status: 'active', created_at: '2026-01-01 00:00:00', ...extra };
    db.prepare(
      'INSERT INTO tasks (title, status, project_id, assignee_id, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(title, row.status, row.project_id, row.assignee_id, row.created_at);
  };

  test('filters by project', async () => {
    insertAt('In one', { project_id: 1 });
    insertAt('In two', { project_id: 2 });
    const res = await request(app).get('/tasks?project_id=2');
    expect(res.body.map((t) => t.title)).toEqual(['In two']);
  });

  test('filters by assignee', async () => {
    insertAt('Mine', { assignee_id: 1 });
    insertAt('Theirs', { assignee_id: 2 });
    const res = await request(app).get('/tasks?assignee_id=1');
    expect(res.body.map((t) => t.title)).toEqual(['Mine']);
  });

  test('combines status, project and assignee filters', async () => {
    insertAt('Match', { project_id: 1, assignee_id: 1, status: 'completed' });
    insertAt('Wrong status', { project_id: 1, assignee_id: 1, status: 'active' });
    insertAt('Wrong project', { project_id: 2, assignee_id: 1, status: 'completed' });
    const res = await request(app).get('/tasks?status=completed&project_id=1&assignee_id=1');
    expect(res.body.map((t) => t.title)).toEqual(['Match']);
  });

  test('ignores a project filter that is not a number', async () => {
    insertAt('One', { project_id: 1 });
    insertAt('Two', { project_id: 2 });
    const res = await request(app).get('/tasks?project_id=abc');
    expect(res.body).toHaveLength(2);
  });

  test('lists the newest tasks first', async () => {
    insertAt('Older', { created_at: '2026-01-01 00:00:00' });
    insertAt('Newer', { created_at: '2026-02-01 00:00:00' });
    const res = await request(app).get('/tasks');
    expect(res.body.map((t) => t.title)).toEqual(['Newer', 'Older']);
  });

  test('returns 20 tasks per page by default', async () => {
    for (let i = 0; i < 25; i++) insertAt(`Task ${i}`);
    const res = await request(app).get('/tasks');
    expect(res.body).toHaveLength(20);
  });

  test('honours page_size and page', async () => {
    for (let i = 1; i <= 5; i++) insertAt(`Task ${i}`, { created_at: `2026-01-0${i} 00:00:00` });
    const first = await request(app).get('/tasks?page_size=2&page=1');
    const second = await request(app).get('/tasks?page_size=2&page=2');
    const third = await request(app).get('/tasks?page_size=2&page=3');
    expect(first.body.map((t) => t.title)).toEqual(['Task 5', 'Task 4']);
    expect(second.body.map((t) => t.title)).toEqual(['Task 3', 'Task 2']);
    expect(third.body.map((t) => t.title)).toEqual(['Task 1']);
  });

  test('caps page_size at 100', async () => {
    db.transaction(() => {
      for (let i = 0; i < 105; i++) insertAt(`Task ${i}`);
    })();
    const res = await request(app).get('/tasks?page_size=500');
    expect(res.body).toHaveLength(100);
  });

  test('names the allowed statuses when the status is invalid', async () => {
    const res = await request(app).get('/tasks?status=bogus');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('status must be one of: active, completed, archived');
  });
});

describe('POST /tasks details', () => {
  test('stores description, project, assignee and due date', async () => {
    const res = await request(app).post('/tasks').send({
      title: 'Full task',
      description: 'All fields',
      project_id: 1,
      assignee_id: 1,
      due_date: '2026-12-31'
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: 'Full task',
      description: 'All fields',
      status: 'active',
      project_id: 1,
      assignee_id: 1,
      due_date: '2026-12-31',
      completed_at: null
    });
  });

  test('leaves optional fields empty when they are not sent', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Bare' });
    expect(res.status).toBe(201);
    expect(res.body.description).toBeNull();
    expect(res.body.project_id).toBeNull();
    expect(res.body.assignee_id).toBeNull();
    expect(res.body.due_date).toBeNull();
  });

  test('rejects a missing title with a clear message', async () => {
    const res = await request(app).post('/tasks').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('title is required');
  });

  test('rejects a project that does not exist', async () => {
    const res = await request(app).post('/tasks').send({ title: 'T', project_id: 999 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('project not found');
  });

  test('rejects an assignee that does not exist', async () => {
    const res = await request(app).post('/tasks').send({ title: 'T', assignee_id: 999 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('assignee not found');
  });

  test('checks the project before the assignee', async () => {
    const res = await request(app).post('/tasks').send({ title: 'T', project_id: 999, assignee_id: 999 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('project not found');
  });
});

describe('GET /tasks/:id details', () => {
  test('includes the tags and comments on the task', async () => {
    const taskId = db.prepare("INSERT INTO tasks (title) VALUES ('Detailed')").run().lastInsertRowid;
    const tagId = db.prepare("INSERT INTO tags (name) VALUES ('bug')").run().lastInsertRowid;
    db.prepare('INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)').run(taskId, tagId);
    db.prepare("INSERT INTO comments (task_id, user_id, body) VALUES (?, 1, 'Note')").run(taskId);
    const res = await request(app).get(`/tasks/${taskId}`);
    expect(res.status).toBe(200);
    expect(res.body.tags.map((t) => t.name)).toEqual(['bug']);
    expect(res.body.comments).toHaveLength(1);
    expect(res.body.comments[0]).toMatchObject({ body: 'Note', user_name: 'Test User' });
  });

  test('returns empty tags and comments when there are none', async () => {
    const taskId = db.prepare("INSERT INTO tasks (title) VALUES ('Plain')").run().lastInsertRowid;
    const res = await request(app).get(`/tasks/${taskId}`);
    expect(res.body.tags).toEqual([]);
    expect(res.body.comments).toEqual([]);
  });

  test('returns the not found message for an unknown id', async () => {
    const res = await request(app).get('/tasks/99999');
    expect(res.body.error).toBe('Task not found');
  });
});

describe('PUT /tasks/:id details', () => {
  test('keeps the existing values for fields that are not sent', async () => {
    const id = db.prepare(
      "INSERT INTO tasks (title, description, project_id, assignee_id, due_date) VALUES ('Keep', 'Desc', 1, 1, '2026-06-01')"
    ).run().lastInsertRowid;
    const res = await request(app).put(`/tasks/${id}`).send({ title: 'Changed' });
    expect(res.body).toMatchObject({
      title: 'Changed',
      description: 'Desc',
      project_id: 1,
      assignee_id: 1,
      due_date: '2026-06-01',
      status: 'active'
    });
  });

  test('updates every editable field', async () => {
    db.prepare("INSERT INTO projects (id, name) VALUES (2, 'Other')").run();
    const id = db.prepare("INSERT INTO tasks (title) VALUES ('Original')").run().lastInsertRowid;
    const res = await request(app).put(`/tasks/${id}`).send({
      title: 'New',
      description: 'New desc',
      status: 'archived',
      project_id: 2,
      assignee_id: 1,
      due_date: '2027-01-01'
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      title: 'New',
      description: 'New desc',
      status: 'archived',
      project_id: 2,
      assignee_id: 1,
      due_date: '2027-01-01'
    });
  });

  test('does not change the completion time when a completed task is saved again', async () => {
    const id = db.prepare(
      "INSERT INTO tasks (title, status, completed_at) VALUES ('Done', 'completed', '2026-01-01T00:00:00.000Z')"
    ).run().lastInsertRowid;
    const res = await request(app).put(`/tasks/${id}`).send({ title: 'Done, renamed' });
    expect(res.body.completed_at).toBe('2026-01-01T00:00:00.000Z');
  });

  test('clears the completion time when a task is reopened', async () => {
    const id = db.prepare(
      "INSERT INTO tasks (title, status, completed_at) VALUES ('Done', 'completed', '2026-01-01T00:00:00.000Z')"
    ).run().lastInsertRowid;
    const res = await request(app).put(`/tasks/${id}`).send({ status: 'active' });
    expect(res.body.status).toBe('active');
    expect(res.body.completed_at).toBeNull();
  });

  test('clears the completion time when a completed task is archived', async () => {
    const id = db.prepare(
      "INSERT INTO tasks (title, status, completed_at) VALUES ('Done', 'completed', '2026-01-01T00:00:00.000Z')"
    ).run().lastInsertRowid;
    const res = await request(app).put(`/tasks/${id}`).send({ status: 'archived' });
    expect(res.body.completed_at).toBeNull();
  });

  test('records the completion time as a timestamp when a task is completed', async () => {
    const id = db.prepare("INSERT INTO tasks (title) VALUES ('Finish')").run().lastInsertRowid;
    const res = await request(app).put(`/tasks/${id}`).send({ status: 'completed' });
    expect(new Date(res.body.completed_at).toISOString()).toBe(res.body.completed_at);
  });

  test('names the allowed statuses when the status is invalid', async () => {
    const id = db.prepare("INSERT INTO tasks (title) VALUES ('T')").run().lastInsertRowid;
    const res = await request(app).put(`/tasks/${id}`).send({ status: 'bogus' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('status must be one of: active, completed, archived');
  });

  test('checks that the task exists before checking the status', async () => {
    const res = await request(app).put('/tasks/99999').send({ status: 'bogus' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Task not found');
  });

  test('fails when the new project does not exist', async () => {
    const id = db.prepare("INSERT INTO tasks (title) VALUES ('T')").run().lastInsertRowid;
    const res = await request(app).put(`/tasks/${id}`).send({ project_id: 999 });
    // Current behavior: the database error surfaces as a 500.
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/FOREIGN KEY/);
  });
});

describe('DELETE /tasks/:id details', () => {
  test('returns the not found message for an unknown id', async () => {
    const res = await request(app).delete('/tasks/99999');
    expect(res.body.error).toBe('Task not found');
  });

  test('fails while the task still has comments', async () => {
    const id = db.prepare("INSERT INTO tasks (title) VALUES ('Discussed')").run().lastInsertRowid;
    db.prepare("INSERT INTO comments (task_id, user_id, body) VALUES (?, 1, 'Hi')").run(id);
    const res = await request(app).delete(`/tasks/${id}`);
    // Current behavior: the database error surfaces as a 500.
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/FOREIGN KEY/);
  });
});
