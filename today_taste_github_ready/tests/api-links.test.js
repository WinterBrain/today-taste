'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api } = require('./helpers');

let s;
test.before(async () => { s = await startServer(); });
test.after(async () => { await s.stop(); });

const tokenFor = (name, col = 'participation_token') => { const db = s.open(); const t = db.prepare(`SELECT ${col} t FROM applications WHERE name=?`).get(name).t; db.close(); return t; };

test('participation link shows payment info and stays viewable after accept', async () => {
  const t = tokenFor('윤태호');
  let r = await api(s.base, '/api/public/participation/' + t);
  assert.equal(r.status, 200);
  assert.equal(r.body.status, '승인');
  assert.equal(r.body.fee, 39000);
  assert.deepEqual(r.body.payment, { bank: '카카오뱅크', account: '3333-01-2345678', holder: '오늘의취향' });
  r = await api(s.base, '/api/public/participation/' + t, { method: 'POST', body: { accept: true } });
  assert.equal(r.status, 200);
  assert.equal(r.body.status, '입금대기');
  assert.ok(r.body.paymentDeadline);
  assert.equal(r.body.payment.account, '3333-01-2345678');
  r = await api(s.base, '/api/public/participation/' + t);
  assert.equal(r.status, 200, 'link must stay viewable after accept');
  assert.equal(r.body.status, '입금대기');
  r = await api(s.base, '/api/public/participation/' + t, { method: 'POST', body: { accept: true } });
  assert.equal(r.status, 400, 'second accept must be rejected');
});

test('payment countdown is computed server-side so client clock/timezone does not matter', async () => {
  const db = s.open();
  db.prepare("UPDATE applications SET status='승인',participation_token='tz-token-1',payment_deadline=NULL WHERE name='송가은'").run();
  db.close();
  let r = await api(s.base, '/api/public/participation/tz-token-1', { method: 'POST', body: { accept: true } });
  assert.ok(r.body.paymentSecondsLeft > 35990 && r.body.paymentSecondsLeft <= 36000, 'POST seconds ' + r.body.paymentSecondsLeft);
  r = await api(s.base, '/api/public/participation/tz-token-1');
  assert.ok(r.body.payment_seconds_left > 35900 && r.body.payment_seconds_left <= 36000, 'GET seconds ' + r.body.payment_seconds_left);
});

test('cancelled schedule stops payment requests on the participation link', async () => {
  const db = s.open();
  const sid = db.prepare("INSERT INTO schedules(group_id,date,start_time,end_time,place,capacity,fee,cancelled) VALUES(3,date('now','localtime','+5 day'),'19:00','21:00','교동',3,41000,1)").run().lastInsertRowid;
  db.prepare("INSERT INTO applications(group_id,schedule_id,name,age,job,phone,status,participation_token) VALUES(3,?,'취소대기',26,'직장인','010-7777-0001','입금대기','cancel-token-1')").run(sid);
  db.prepare("INSERT INTO applications(group_id,schedule_id,name,age,job,phone,status,participation_token) VALUES(3,?,'취소승인',26,'직장인','010-7777-0002','승인','cancel-token-2')").run(sid);
  db.close();
  let r = await api(s.base, '/api/public/participation/cancel-token-1');
  assert.equal(r.status, 200);
  assert.equal(r.body.schedule_cancelled, true);
  r = await api(s.base, '/api/public/participation/cancel-token-2', { method: 'POST', body: { accept: true } });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /취소/);
});

test('declining clears the token', async () => {
  const db = s.open();
  db.prepare("UPDATE applications SET status='승인',participation_token='decline-token-1' WHERE name='박서린'").run();
  db.close();
  let r = await api(s.base, '/api/public/participation/decline-token-1', { method: 'POST', body: { accept: false } });
  assert.equal(r.body.status, '참여포기');
  r = await api(s.base, '/api/public/participation/decline-token-1');
  assert.equal(r.status, 404);
});

test('payment is null when env is missing', async () => {
  const s2 = await startServer({ env: { PAYMENT_ACCOUNT: '' } });
  try {
    const db = s2.open(); const t = db.prepare("SELECT participation_token t FROM applications WHERE name='윤태호'").get().t; db.close();
    const r = await api(s2.base, '/api/public/participation/' + t);
    assert.equal(r.body.payment, null);
  } finally { await s2.stop(); }
});

test('review submit stores publish consent', async () => {
  const t = tokenFor('백승현', 'review_token');
  let r = await api(s.base, '/api/public/review/' + t);
  assert.equal(r.status, 200);
  assert.ok('date' in r.body && 'cover_url' in r.body);
  r = await api(s.base, '/api/public/review/' + t, { method: 'POST', body: { satisfaction: 5, revisit: 5, progress: 5, place: 4, value: 4, text: '좋았어요', publish_ok: true } });
  assert.equal(r.status, 200);
  const db = s.open();
  assert.equal(db.prepare("SELECT r.publish_ok p FROM reviews r JOIN applications a ON a.id=r.application_id WHERE a.name='백승현'").get().p, 1);
  db.close();
});
