process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/index');

describe('GET /', () => {
  test('returns the API name, version and docs pointer', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: 'Taskr API', version: '1.0.0', docs: '/health' });
  });

  test('rejects methods other than GET', async () => {
    const res = await request(app).post('/');
    expect(res.status).toBe(404);
  });
});
