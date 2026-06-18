import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

process.env.JWT_SECRET = 'dev-secret-change-in-production';
process.env.NODE_ENV = 'test';

const { default: app } = await import('../app.js');
const { initDatabase } = await import('../database/initDatabase.js');
const { bootstrapDefaultUsers } = await import('../services/bootstrapService.js');
const { loginWithPassword } = await import('../services/authService.js');

await initDatabase();
await bootstrapDefaultUsers();

async function adminToken() {
  const session = await loginWithPassword('admin@localhost', 'admin123');
  return session.token;
}

test('GET /api/admin/users requires admin role', async () => {
  const userSession = await loginWithPassword('user@localhost', 'user123');
  const forbidden = await request(app)
    .get('/api/admin/users')
    .set('Authorization', `Bearer ${userSession.token}`);
  assert.equal(forbidden.status, 403);

  const token = await adminToken();
  const res = await request(app)
    .get('/api/admin/users')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.users));
  assert.ok(res.body.users.length >= 2);
});

test('PATCH /api/admin/users/:id updates role and writes audit log', async () => {
  const token = await adminToken();
  const usersRes = await request(app)
    .get('/api/admin/users')
    .set('Authorization', `Bearer ${token}`);
  const target = usersRes.body.users.find((user) => user.email === 'user@localhost');
  assert.ok(target);

  const patchRes = await request(app)
    .patch(`/api/admin/users/${target.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ displayName: 'Demo Benutzer Aktualisiert', language: 'en' });
  assert.equal(patchRes.status, 200);
  assert.equal(patchRes.body.user.displayName, 'Demo Benutzer Aktualisiert');

  const auditRes = await request(app)
    .get('/api/admin/audit')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(auditRes.status, 200);
  assert.ok(auditRes.body.items.some((entry) => entry.action === 'user.updated'));
});

test('GET /api/admin/system returns settings and health', async () => {
  const token = await adminToken();
  const res = await request(app)
    .get('/api/admin/system')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.settings);
  assert.ok(res.body.health?.services);
});

test('GET /api/admin/email returns status payload', async () => {
  const token = await adminToken();
  const res = await request(app)
    .get('/api/admin/email')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(typeof res.body.configured, 'boolean');
});

test('POST /api/admin/users creates user and DELETE removes user', async () => {
  const token = await adminToken();
  const createRes = await request(app)
    .post('/api/admin/users')
    .set('Authorization', `Bearer ${token}`)
    .send({
      email: 'temp-user@localhost',
      password: 'TempPass1',
      displayName: 'Temp User',
      role: 'user',
      language: 'de',
    });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.user.email, 'temp-user@localhost');

  const deleteRes = await request(app)
    .delete(`/api/admin/users/${createRes.body.user.id}`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(deleteRes.status, 200);
  assert.equal(deleteRes.body.user.email, 'temp-user@localhost');

  const auditRes = await request(app)
    .get('/api/admin/audit')
    .query({ action: 'user.created' })
    .set('Authorization', `Bearer ${token}`);
  assert.equal(auditRes.status, 200);
  assert.ok(auditRes.body.items.some((entry) => entry.action === 'user.created'));
});

test('GET /api/admin/audit supports action and date filters', async () => {
  const token = await adminToken();
  const today = new Date().toISOString().slice(0, 10);

  const actionsRes = await request(app)
    .get('/api/admin/audit/actions')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(actionsRes.status, 200);
  assert.ok(Array.isArray(actionsRes.body.actions));

  const filteredRes = await request(app)
    .get('/api/admin/audit')
    .query({ action: 'user.updated', from: today, to: today, limit: 10 })
    .set('Authorization', `Bearer ${token}`);
  assert.equal(filteredRes.status, 200);
  assert.ok(Array.isArray(filteredRes.body.items));
  assert.ok(filteredRes.body.items.every((entry) => entry.action === 'user.updated'));
});
