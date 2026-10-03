process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/index');

describe('POST /webhooks/task-update', () => {
  test('acknowledges a webhook payload', async () => {
    const res = await request(app)
      .post('/webhooks/task-update')
      .send({ task_id: 1, status: 'completed' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });

  test('acknowledges a request with an empty body', async () => {
    const res = await request(app).post('/webhooks/task-update').send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });

  test('rejects methods other than POST', async () => {
    const res = await request(app).get('/webhooks/task-update');
    expect(res.status).toBe(404);
  });
});
