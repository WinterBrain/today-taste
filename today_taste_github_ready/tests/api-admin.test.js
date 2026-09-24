'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, login } = require('./helpers');

let s, admin, op;
test.before(async () => { s = await startServer(); admin = await login(s.base, 'tasteadmin', 'Taste!2026'); op = await login(s.base, 'seoyun', 'TasteOp!2026'); });
test.after(async () => { await s.stop(); });

test('admin can save new group content fields', async () => {
  const body = { cover_url: '/assets/img/groups/coffee-cover.jpg', gallery: ['/a.jpg'], for_whom: ['A', 'B'], includes: ['C'], fee_note: '원두 포함', host_bio: '소개', host_photo_url: '', place_note: '1층' };
  let r = await api(s.base, '/api/admin/groups/3', { method: 'PATCH', token: admin, body });
  assert.equal(r.status, 200);
  const g = (await api(s.base, '/api/admin/groups', { token: admin })).body.groups.find(x => x.id === 3);
  assert.equal(g.fee_note, '원두 포함');
  assert.deepEqual(JSON.parse(g.for_whom_json), ['A', 'B']);
  assert.deepEqual(JSON.parse(g.gallery_json), ['/a.jpg']);
  r = await api(s.base, '/api/admin/groups', { method: 'POST', token: admin, body: { name: '새 모임', field: '만들기', ...body } });
  assert.equal(r.status, 200);
  const created = (await api(s.base, '/api/admin/groups', { token: admin })).body.groups.find(x => x.id === r.body.id);
  assert.equal(created.place_note, '1층');
});

test('PATCH without new fields keeps existing content', async () => {
  await api(s.base, '/api/admin/groups/1', { method: 'PATCH', token: admin, body: { name: '나만의 시그니처 향수 만들기' } });
  const g = (await api(s.base, '/api/admin/groups', { token: admin })).body.groups.find(x => x.id === 1);
  assert.ok(JSON.parse(g.for_whom_json).length >= 3);
  assert.ok(g.cover_url);
});

test('applications list carries motivation and server-computed payment seconds', async () => {
  const apps = (await api(s.base, '/api/admin/applications', { token: admin })).body.applications;
  const waiting = apps.find(a => a.status === '입금대기');
  assert.equal(typeof waiting.payment_seconds_left, 'number');
  assert.ok('motivation' in apps[0]);
  const other = apps.find(a => a.status === '접수');
  assert.equal(other.payment_seconds_left, null);
});

test('admin can hide a review; operator cannot', async () => {
  const id = (await api(s.base, '/api/admin/reviews', { token: admin })).body.reviews[0].id;
  let r = await api(s.base, `/api/admin/reviews/${id}`, { method: 'PATCH', token: op, body: { hidden: true } });
  assert.equal(r.status, 403);
  r = await api(s.base, `/api/admin/reviews/${id}`, { method: 'PATCH', token: admin, body: { hidden: true } });
  assert.equal(r.status, 200);
  const db = s.open();
  assert.equal(db.prepare('SELECT hidden FROM reviews WHERE id=?').get(id).hidden, 1);
  assert.ok(db.prepare("SELECT 1 FROM audit_logs WHERE action='hide_review' AND entity_id=?").get(String(id)));
  db.close();
});

test('schedule create/update rejects malformed date and time', async () => {
  const good = { group_id: 1, date: '2026-12-01', start_time: '14:00', end_time: '16:00', place: '동성로', capacity: 3, fee: 39000 };
  let r = await api(s.base, '/api/admin/schedules', { method: 'POST', token: op, body: { ...good, date: '"><img src=x onerror=alert(1)>' } });
  assert.equal(r.status, 400);
  r = await api(s.base, '/api/admin/schedules', { method: 'POST', token: op, body: { ...good, start_time: '2pm' } });
  assert.equal(r.status, 400);
  r = await api(s.base, '/api/admin/schedules', { method: 'POST', token: op, body: { ...good, capacity: 0 } });
  assert.equal(r.status, 400);
  r = await api(s.base, '/api/admin/schedules', { method: 'POST', token: op, body: good });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const id = r.body.id;
  r = await api(s.base, `/api/admin/schedules/${id}`, { method: 'PATCH', token: op, body: { end_time: '<script>' } });
  assert.equal(r.status, 400);
  r = await api(s.base, `/api/admin/schedules/${id}`, { method: 'PATCH', token: op, body: { end_time: '17:00' } });
  assert.equal(r.status, 200);
});

test('attendance closes the participation link', async () => {
  const db = s.open();
  const a = db.prepare("SELECT id FROM applications WHERE status='확정' AND group_id IN (1,3) LIMIT 1").get();
  db.prepare("UPDATE applications SET participation_token='attend-token-1' WHERE id=?").run(a.id);
  db.close();
  const r = await api(s.base, `/api/admin/applications/${a.id}/attendance`, { method: 'POST', token: op, body: { attended: true } });
  assert.equal(r.status, 200);
  assert.equal((await api(s.base, '/api/public/participation/attend-token-1')).status, 404);
});
