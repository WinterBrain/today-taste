'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api } = require('./helpers');

let s;
test.before(async () => { s = await startServer(); });
test.after(async () => { await s.stop(); });

const validBody = (schedule_id, phone = '010-1111-2222') => ({
  schedule_id, name: '테스트', age: 27, job: '직장인', mbti: '', phone,
  motivation: '향을 직접 조합해 보고 싶어서 신청했어요.', preferred_times: ['토|오후'], selection_method: '직접',
});

test('groups include stats and masked public reviews', async () => {
  const r = await api(s.base, '/api/public/groups');
  assert.equal(r.status, 200);
  const coffee = r.body.groups.find(g => g.tag === '커피');
  assert.equal(coffee.stats.sessions_done, 2);
  assert.equal(coffee.stats.participants, 4);
  assert.equal(coffee.stats.review_count, 3);
  assert.equal(typeof coffee.stats.rating_avg, 'number');
  assert.ok(coffee.reviews.length >= 1);
  assert.match(coffee.reviews[0].name_masked, /^.\*+$/);
  assert.ok(r.body.reviews.length >= 6);
});

test('public reviews respect consent, hidden flag and masking', async () => {
  const db = s.open();
  db.prepare("UPDATE reviews SET hidden=1 WHERE text LIKE '같은 원두인데%'").run();
  db.close();
  const r = await api(s.base, '/api/public/groups');
  const all = JSON.stringify(r.body);
  assert.ok(!all.includes('같은 원두인데'), 'hidden review leaked');
  assert.ok(!all.includes('김태오'), 'real name leaked');
  assert.ok(!all.includes('이수빈'), 'real name leaked');
  const coffee = r.body.groups.find(g => g.tag === '커피');
  assert.equal(coffee.stats.review_count, 2);
});

test('valid application is accepted with motivation stored', async () => {
  const g = (await api(s.base, '/api/public/groups')).body.groups.find(x => x.tag === '향수');
  const sched = g.schedules.find(x => x.remaining > 0);
  const r = await api(s.base, '/api/public/applications', { method: 'POST', body: validBody(sched.id, '010-9999-0001') });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const db = s.open();
  assert.equal(db.prepare('SELECT motivation FROM applications WHERE id=?').get(r.body.id).motivation, '향을 직접 조합해 보고 싶어서 신청했어요.');
  db.close();
});

test('a session that already started today is neither listed nor bookable', async () => {
  const db = s.open();
  const id = db.prepare("INSERT INTO schedules(group_id,date,start_time,end_time,place,capacity,fee) VALUES(1,date('now','localtime','-1 minute'),strftime('%H:%M','now','localtime','-1 minute'),'23:59','지난 회차',3,39000)").run().lastInsertRowid;
  db.close();
  const groups = (await api(s.base, '/api/public/groups')).body.groups;
  assert.ok(!groups.flatMap(g => g.schedules).some(x => x.id === id), 'started session must not be listed');
  const r = await api(s.base, '/api/public/applications', { method: 'POST', body: validBody(id, '010-9999-0006') });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /신청할 수 없는 일정/);
});

test('rejects invalid applications', async () => {
  const g = (await api(s.base, '/api/public/groups')).body.groups.find(x => x.tag === '향수');
  const sid = g.schedules[0].id;
  const cases = [
    [{ age: 18 }, /19~35/], [{ age: 36 }, /19~35/], [{ phone: '01012345678' }, /휴대폰/],
    [{ motivation: '          ' }, /신청 이유/], [{ motivation: '짧아요' }, /신청 이유/], [{ motivation: 'a'.repeat(301) }, /신청 이유/],
  ];
  for (const [patch, msg] of cases) {
    const r = await api(s.base, '/api/public/applications', { method: 'POST', body: { ...validBody(sid, '010-9999-0002'), ...patch } });
    assert.equal(r.status, 400, JSON.stringify(patch));
    assert.match(r.body.error, msg);
  }
  const db = s.open();
  const past = db.prepare("SELECT id FROM schedules WHERE date < date('now','localtime') LIMIT 1").get();
  const full = db.prepare("INSERT INTO schedules(group_id,date,start_time,end_time,place,capacity,fee) VALUES(1,date('now','localtime','+3 day'),'10:00','12:00','테스트',1,1000)").run().lastInsertRowid;
  db.prepare("INSERT INTO applications(group_id,schedule_id,name,age,job,phone,status) VALUES(1,?,'만석',25,'직장인','010-9999-0003','확정')").run(full);
  db.close();
  let r = await api(s.base, '/api/public/applications', { method: 'POST', body: validBody(past.id, '010-9999-0004') });
  assert.equal(r.status, 400); assert.match(r.body.error, /신청할 수 없는 일정/);
  r = await api(s.base, '/api/public/applications', { method: 'POST', body: validBody(full, '010-9999-0005') });
  assert.equal(r.status, 400); assert.match(r.body.error, /마감/);
});

test('rejects jobs outside the list and overlong names', async () => {
  const g = (await api(s.base, '/api/public/groups')).body.groups.find(x => x.tag === '향수');
  const sid = g.schedules.find(x => x.remaining > 0).id;
  let r = await api(s.base, '/api/public/applications', { method: 'POST', body: { ...validBody(sid, '010-9999-0007'), job: '<b>해커</b>' } });
  assert.equal(r.status, 400); assert.match(r.body.error, /직업/);
  r = await api(s.base, '/api/public/applications', { method: 'POST', body: { ...validBody(sid, '010-9999-0008'), name: '가'.repeat(21) } });
  assert.equal(r.status, 400); assert.match(r.body.error, /20자/);
});

test('group review endpoint returns every public review, masked', async () => {
  const coffee = (await api(s.base, '/api/public/groups')).body.groups.find(g => g.tag === '커피');
  const r = await api(s.base, `/api/public/groups/${coffee.id}/reviews`);
  assert.equal(r.status, 200);
  assert.equal(r.body.reviews.length, coffee.stats.review_count);
  assert.ok(r.body.reviews.every(x => /^.\*+$/.test(x.name_masked) && !('name' in x)));
});

test('marketing consent is stored only when opted in', async () => {
  const g = (await api(s.base, '/api/public/groups')).body.groups.find(x => x.tag === '향수');
  const sid = g.schedules.find(x => x.remaining > 0).id;
  const yes = await api(s.base, '/api/public/applications', { method: 'POST', body: { ...validBody(sid, '010-9999-0011'), marketing_ok: true } });
  const no = await api(s.base, '/api/public/applications', { method: 'POST', body: validBody(sid, '010-9999-0012') });
  const db = s.open();
  const get = id => db.prepare('SELECT marketing_ok FROM applications WHERE id=?').get(id).marketing_ok;
  assert.equal(get(yes.body.id), 1); assert.equal(get(no.body.id), 0);
  db.close();
});
