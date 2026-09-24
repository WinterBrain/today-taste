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

// 1분 전에 시작한 회차와 그 회차의 신청 한 건을 만든다
function startedApp(status, phone, tokenValue = null) {
  const db = s.open();
  const sid = db.prepare("INSERT INTO schedules(group_id,date,start_time,end_time,place,capacity,fee) VALUES(1,date('now','localtime','-1 minute'),strftime('%H:%M','now','localtime','-1 minute'),'23:59','진행 중',3,39000)").run().lastInsertRowid;
  const id = db.prepare("INSERT INTO applications(group_id,schedule_id,name,age,job,phone,status,participation_token) VALUES(1,?,'출석대상',25,'직장인',?,?,?)").run(sid, phone, status, tokenValue).lastInsertRowid;
  db.close();
  return id;
}
const attend = (id, attended) => api(s.base, `/api/admin/applications/${id}/attendance`, { method: 'POST', token: op, body: { attended } });

test('attendance closes the participation link', async () => {
  const id = startedApp('확정', '010-5555-0001', 'attend-token-1');
  assert.equal((await api(s.base, '/api/public/participation/attend-token-1')).status, 200);
  const r = await attend(id, true);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal((await api(s.base, '/api/public/participation/attend-token-1')).status, 404);
});

test('attendance requires a confirmed application whose session has started', async () => {
  const db = s.open();
  const future = db.prepare("SELECT id FROM applications WHERE status='확정' AND group_id IN (1,3) LIMIT 1").get().id;
  const pending = db.prepare("SELECT id FROM applications WHERE status='접수' AND group_id IN (1,3) LIMIT 1").get().id;
  db.close();
  let r = await attend(future, true);
  assert.equal(r.status, 400); assert.match(r.body.error, /시작된 뒤/);
  assert.equal((await attend(pending, true)).status, 400);
  const id = startedApp('확정', '010-5555-0002');
  assert.equal((await attend(id, false)).body.status, '불참');
  assert.equal((await attend(id, false)).status, 400, 'absent twice is rejected');
  assert.equal((await attend(id, true)).body.status, '참석완료', 'absent can be corrected to attended');
  assert.equal((await attend(id, false)).status, 400, 'attended cannot be reverted');
});

test('purge endpoint: admin only, refuses paid applications', async () => {
  const db = s.open();
  const rejected = db.prepare("INSERT INTO applications(group_id,schedule_id,name,age,job,phone,status,motivation) VALUES(1,1,'파기대상',25,'직장인','010-5555-0003','거절','지워져야 하는 신청 이유')").run().lastInsertRowid;
  const paid = db.prepare('SELECT id FROM applications WHERE paid_at IS NOT NULL LIMIT 1').get().id;
  db.close();
  const purge = (id, token) => api(s.base, `/api/admin/applications/${id}/purge`, { method: 'POST', token });
  assert.equal((await purge(rejected, op)).status, 403);
  assert.equal((await purge(paid, admin)).status, 400);
  assert.equal((await purge(rejected, admin)).status, 200);
  const db2 = s.open();
  const row = db2.prepare('SELECT name,phone,motivation,purged_at FROM applications WHERE id=?').get(rejected);
  db2.close();
  assert.equal(row.name, '(파기)'); assert.equal(row.motivation, ''); assert.ok(!row.phone.startsWith('010')); assert.ok(row.purged_at);
});
