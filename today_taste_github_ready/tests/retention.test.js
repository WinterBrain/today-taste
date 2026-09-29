'use strict';
process.env.TZ = 'Asia/Seoul';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { migrate } = require('../lib/migrate');
const { runRetention } = require('../lib/retention');

test('retention purges by paid status and schedule age, and expires old links', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-ret-'));
  const db = new Database(path.join(dir, 'r.sqlite'));
  migrate(db);
  db.prepare("INSERT INTO groups(id,field,name) VALUES(1,'만들기','모임')").run();
  const sched = off => db.prepare("INSERT INTO schedules(group_id,date,start_time,end_time,place) VALUES(1,date('now','localtime',?),'14:00','16:00','곳')").run(off).lastInsertRowid;
  const app = (sid, phone, status, paid, tok) => db.prepare("INSERT INTO applications(group_id,schedule_id,name,age,job,phone,status,paid_at,participation_token,motivation) VALUES(1,?,'홍길동',25,'직장인',?,?,?,?,'이유')")
    .run(sid, phone, status, paid ? '2020-01-01 00:00:00' : null, tok || null).lastInsertRowid;
  const d31 = sched('-31 days'), d8 = sched('-8 days'), d6 = sched('-6 days'), y6 = sched('-6 years'), y4 = sched('-4 years');
  const a = {
    unpaidOld: app(d31, '010-0000-0001', '자동취소'),
    staleOld: app(d31, '010-0000-0002', '접수'),
    unpaidRecent: app(d8, '010-0000-0003', '거절', false, 'tok-8'),
    linkFresh: app(d6, '010-0000-0004', '확정', true, 'tok-6'),
    paidOld: app(y6, '010-0000-0005', '평가완료', true),
    paidKept: app(y4, '010-0000-0006', '평가완료', true),
  };
  const r = runRetention(db);
  const row = id => db.prepare('SELECT name,purged_at,participation_token t FROM applications WHERE id=?').get(id);
  assert.equal(row(a.unpaidOld).name, '(파기)');
  assert.ok(row(a.staleOld).purged_at, 'unprocessed applications past 30 days are purged too');
  assert.equal(row(a.unpaidRecent).purged_at, null);
  assert.equal(row(a.unpaidRecent).t, null, 'link older than 7 days is cleared');
  assert.equal(row(a.linkFresh).t, 'tok-6');
  assert.ok(row(a.paidOld).purged_at);
  assert.equal(row(a.paidKept).purged_at, null);
  assert.deepEqual(r, { purged: 3, links: 1 });
  assert.deepEqual(runRetention(db), { purged: 0, links: 0 }, 'idempotent');
  db.close(); fs.rmSync(dir, { recursive: true, force: true });
});

test('privacy policy text states the same periods as lib/retention.js', () => {
  const { UNPAID_DAYS, PAID_YEARS, LINK_DAYS } = require('../lib/retention');
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'js', 'policy.js'), 'utf8');
  assert.ok(src.includes(`모임일로부터 ${UNPAID_DAYS}일`), 'unpaid period');
  assert.ok(src.includes(`모임일로부터 ${PAID_YEARS}년`), 'paid period');
  assert.ok(src.includes(`모임일로부터 ${LINK_DAYS}일이 지나거나`), 'link period');
});
