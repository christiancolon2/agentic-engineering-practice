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
  db.prepare('INSERT INTO users (id, name, email) VALUES (1, ?, ?)').run('Project Owner', 'owner@test.com');
});

describe('Project endpoints', () => {
  test('POST /projects creates a project', async () => {
    const res = await request(app)
      .post('/projects')
      .send({ name: 'My Project', description: 'A test project', owner_id: 1 });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('My Project');
    expect(res.body.id).toBeDefined();
  });

  test('POST /projects returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/projects')
      .send({ description: 'No name' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('GET /projects returns all projects', async () => {
    await request(app).post('/projects').send({ name: 'Alpha' });
    await request(app).post('/projects').send({ name: 'Beta' });
    const res = await request(app).get('/projects');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  test('GET /projects/:id returns project with stats', async () => {
    const created = await request(app)
      .post('/projects')
      .send({ name: 'Stats Project' });
    const projectId = created.body.id;

    await request(app).post('/tasks').send({ title: 'Active task', project_id: projectId });
    await request(app).post('/tasks').send({ title: 'Another active', project_id: projectId });

    const res = await request(app).get(`/projects/${projectId}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Stats Project');
    expect(res.body.stats).toBeDefined();
    expect(res.body.stats.total).toBe(2);
    expect(res.body.stats.active).toBe(2);
  });

  test('GET /projects/:id returns 404 for unknown project', async () => {
    const res = await request(app).get('/projects/99999');
    expect(res.status).toBe(404);
  });

  test('tasks can be assigned to a project', async () => {
    const proj = await request(app).post('/projects').send({ name: 'Assignment Test' });
    const projectId = proj.body.id;

    await request(app).post('/tasks').send({ title: 'Task in project', project_id: projectId });
    await request(app).post('/tasks').send({ title: 'Unassigned task' });

    const res = await request(app).get(`/tasks?project_id=${projectId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Task in project');
  });

  test('PUT /projects/:id updates a project', async () => {
    const created = await request(app)
      .post('/projects')
      .send({ name: 'Old Name' });
    const res = await request(app)
      .put(`/projects/${created.body.id}`)
      .send({ name: 'New Name', description: 'Updated desc' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
    expect(res.body.description).toBe('Updated desc');
  });

  test('DELETE /projects/:id removes a project', async () => {
    const created = await request(app).post('/projects').send({ name: 'Doomed Project' });
    const projectId = created.body.id;

    const res = await request(app)
      .delete(`/projects/${projectId}`)
      .set('x-api-key', 'dev-key');
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);

    const check = await request(app).get(`/projects/${projectId}`);
    expect(check.status).toBe(404);
  });
});

describe('POST /projects details', () => {
  test('rejects a blank name with a clear message', async () => {
    const res = await request(app).post('/projects').send({ name: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('name is required');
  });

  test('stores the description and owner when they are sent', async () => {
    const res = await request(app)
      .post('/projects')
      .send({ name: 'Owned', description: 'With an owner', owner_id: 1 });
    expect(res.status).toBe(201);
    expect(res.body.description).toBe('With an owner');
    expect(res.body.owner_id).toBe(1);
  });

  test('leaves description and owner empty when they are not sent', async () => {
    const res = await request(app).post('/projects').send({ name: 'Bare' });
    expect(res.status).toBe(201);
    expect(res.body.description).toBeNull();
    expect(res.body.owner_id).toBeNull();
  });

  test('fails when the owner does not exist', async () => {
    const res = await request(app).post('/projects').send({ name: 'Orphan', owner_id: 999 });
    // Current behavior: the database error surfaces as a 500.
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/FOREIGN KEY/);
  });
});

describe('GET /projects/:id stats', () => {
  test('counts tasks by status', async () => {
    const created = await request(app).post('/projects').send({ name: 'Counts' });
    const pid = created.body.id;
    db.prepare("INSERT INTO tasks (title, status, project_id) VALUES ('a', 'active', ?)").run(pid);
    db.prepare("INSERT INTO tasks (title, status, project_id) VALUES ('b', 'completed', ?)").run(pid);
    db.prepare("INSERT INTO tasks (title, status, project_id) VALUES ('c', 'completed', ?)").run(pid);
    db.prepare("INSERT INTO tasks (title, status, project_id) VALUES ('d', 'archived', ?)").run(pid);
    const res = await request(app).get(`/projects/${pid}`);
    expect(res.body.stats).toEqual({ total: 4, active: 1, completed: 2, archived: 1 });
  });

  test('reports zero for a project with no tasks', async () => {
    const created = await request(app).post('/projects').send({ name: 'Empty' });
    const res = await request(app).get(`/projects/${created.body.id}`);
    expect(res.body.stats).toEqual({ total: 0, active: 0, completed: 0, archived: 0 });
  });

  test('returns the not found message for an unknown project', async () => {
    const res = await request(app).get('/projects/99999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Project not found');
  });
});

describe('PUT /projects/:id details', () => {
  test('returns 404 when the project does not exist', async () => {
    const res = await request(app).put('/projects/99999').send({ name: 'Ghost' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Project not found');
  });

  test('keeps the existing values for fields that are not sent', async () => {
    const created = await request(app)
      .post('/projects')
      .send({ name: 'Keep', description: 'Original', owner_id: 1 });
    const res = await request(app).put(`/projects/${created.body.id}`).send({ name: 'Renamed' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed');
    expect(res.body.description).toBe('Original');
    expect(res.body.owner_id).toBe(1);
  });

  test('fails when the new owner does not exist', async () => {
    const created = await request(app).post('/projects').send({ name: 'Reassign' });
    const res = await request(app).put(`/projects/${created.body.id}`).send({ owner_id: 999 });
    // Current behavior: the database error surfaces as a 500.
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/FOREIGN KEY/);
  });
});

describe('DELETE /projects/:id details', () => {
  test('returns 404 when the project does not exist', async () => {
    const res = await request(app).delete('/projects/99999').set('x-api-key', 'dev-key');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Project not found');
  });

  test('fails while the project still has tasks', async () => {
    const created = await request(app).post('/projects').send({ name: 'Busy' });
    db.prepare("INSERT INTO tasks (title, project_id) VALUES ('t', ?)").run(created.body.id);
    const res = await request(app).delete(`/projects/${created.body.id}`).set('x-api-key', 'dev-key');
    // Current behavior: the database error surfaces as a 500.
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/FOREIGN KEY/);
  });
});

describe('PUT /projects/:id validation', () => {
  test('accepts a blank name', async () => {
    const created = await request(app).post('/projects').send({ name: 'Named' });
    const res = await request(app).put(`/projects/${created.body.id}`).send({ name: '' });
    // Current behavior: updates are not validated the way creation is.
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('');
  });
});
