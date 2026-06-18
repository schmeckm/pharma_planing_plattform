import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

process.env.JWT_SECRET = 'dev-secret-change-in-production';
process.env.NODE_ENV = 'test';

const { default: app } = await import('../app.js');
const { initDatabase } = await import('../database/initDatabase.js');
const { bootstrapDefaultUsers } = await import('../services/bootstrapService.js');

await initDatabase();
await bootstrapDefaultUsers();

test('POST /api/auth/login accepts bootstrap user', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'user@localhost', password: 'user123' });

  assert.equal(res.status, 200);
  assert.ok(res.body.token);
  assert.ok(res.body.refreshToken);
  assert.equal(res.body.user.email, 'user@localhost');
  assert.equal(res.body.user.role, 'user');
});

test('GET /api/health/detailed returns services', async () => {
  const res = await request(app).get('/api/health/detailed');
  assert.ok([200, 503].includes(res.status));
  assert.ok(Array.isArray(res.body.services));
  assert.ok(res.body.services.length >= 3);
});
