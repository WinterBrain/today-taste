'use strict';
process.env.TZ = 'Asia/Seoul';
const test = require('node:test');
const assert = require('node:assert/strict');
const TT = require('../public/assets/js/core.js');

test('date helpers use local calendar dates', () => {
  assert.equal(TT.dowKo('2026-09-28'), '월');
  assert.equal(TT.fmtDateShort('2026-09-28'), '9.28(월)');
  assert.equal(TT.fmtDateLong('2026-10-03'), '10월 3일 (토)');
  assert.equal(TT.dayBucket('2026-10-03'), '토');
  assert.equal(TT.dayBucket('2026-10-04'), '일');
  assert.equal(TT.dayBucket('2026-09-28'), '평일');
  assert.equal(TT.todayStr(new Date(2026, 8, 24, 23, 59)), '2026-09-24');
  assert.equal(TT.daysBetween('2026-09-24', '2026-10-01'), 7);
});

test('time labels', () => {
  assert.equal(TT.timeLabel('14:00'), '오후 2:00');
  assert.equal(TT.timeLabel('09:30'), '오전 9:30');
  assert.equal(TT.timeLabel('12:00'), '오후 12:00');
  assert.equal(TT.timeLabel('00:10'), '오전 12:10');
  assert.equal(TT.timeRange('14:00', '16:00'), '오후 2:00 – 4:00');
  assert.equal(TT.timeRange('11:00', '13:00'), '오전 11:00 – 오후 1:00');
  assert.equal(TT.band('09:00'), '오전');
  assert.equal(TT.band('12:00'), '오후');
  assert.equal(TT.band('18:00'), '저녁');
  assert.equal(TT.cellKey({ date: '2026-10-03', start_time: '14:00' }), '토|오후');
});

test('seat info', () => {
  assert.deepEqual(TT.seatInfo(3, 2), { total: 3, left: 2, filled: 1, label: '2자리 남음', last: false, full: false });
  assert.equal(TT.seatInfo(3, 1).last, true);
  assert.equal(TT.seatInfo(3, 0).label, '마감');
  assert.equal(TT.seatInfo(3, -1).left, 0);
});

test('content parsing', () => {
  assert.deepEqual(TT.parseStep('20분|향 알아보기'), { time: '20분', text: '향 알아보기' });
  assert.deepEqual(TT.parseStep('그냥 단계'), { time: '', text: '그냥 단계' });
  assert.deepEqual(TT.listOf('["a","b"]'), ['a', 'b']);
  assert.deepEqual(TT.listOf('broken'), []);
  assert.deepEqual(TT.listOf(['x']), ['x']);
  assert.deepEqual(TT.pairsOf('[["q","a"]]'), [['q', 'a']]);
  assert.equal(TT.won(39000), '39,000원');
  assert.equal(TT.esc('<a href="x">'), '&lt;a href=&quot;x&quot;&gt;');
});

test('hash parsing', () => {
  assert.deepEqual(TT.parseHash('#/g/3/apply?s=5'), { parts: ['g', '3', 'apply'], query: { s: '5' } });
  assert.deepEqual(TT.parseHash(''), { parts: [], query: {} });
  assert.deepEqual(TT.parseHash('#/'), { parts: [], query: {} });
});

test('apply validation', () => {
  const ok = { name: '김하나', age: '27', job: '직장인', phone: '010-1234-5678', motivation: '커피 취향을 찾고 싶어요!', agreeRequired: true };
  assert.deepEqual(TT.validateApply(ok), {});
  const e = TT.validateApply({ ...ok, name: ' ', age: '18', job: '', phone: '010-123', motivation: '   짧음   ', agreeRequired: false });
  assert.deepEqual(Object.keys(e).sort(), ['age', 'agreeRequired', 'job', 'motivation', 'name', 'phone']);
  assert.equal(TT.formatPhone('01012345678'), '010-1234-5678');
  assert.equal(TT.formatPhone('0101234'), '010-1234');
  assert.equal(TT.formatPhone('010'), '010');
});

test('filters', () => {
  const g = (field, schedules) => ({ field, schedules });
  const sat = { date: '2026-09-26', start_time: '14:00', remaining: 2 };
  const wedNight = { date: '2026-09-30', start_time: '19:30', remaining: 1 };
  const full = { date: '2026-09-27', start_time: '14:00', remaining: 0 };
  const today = '2026-09-24';
  assert.equal(TT.matchesFilter(g('만들기', [sat]), 'weekend', today), true);
  assert.equal(TT.matchesFilter(g('만들기', [wedNight]), 'weekend', today), false);
  assert.equal(TT.matchesFilter(g('만들기', [wedNight]), 'weeknight', today), true);
  assert.equal(TT.matchesFilter(g('배우기', [sat]), 'make', today), false);
  assert.equal(TT.matchesFilter(g('배우기', [wedNight]), 'closing', today), true);
  assert.equal(TT.matchesFilter(g('배우기', [full]), 'all', today), true);
  assert.equal(TT.matchesFilter(g('배우기', [full]), 'weekend', today), false);
  assert.equal(TT.nextSchedule(g('x', [full, wedNight, sat])).date, '2026-09-26');
  const farSat = { date: '2026-10-10', start_time: '14:00', remaining: 3 };
  assert.equal(TT.matchesFilter(g('만들기', [farSat]), 'weekend', today), false, '"이번 주말" must not match a weekend weeks away');
  assert.equal(TT.matchesFilter(g('만들기', [{ date: '2026-09-27', start_time: '10:00', remaining: 1 }]), 'weekend', today), true);
  assert.equal(TT.matchesFilter(g('만들기', [{ date: '2026-09-27', start_time: '10:00', remaining: 1 }]), 'weekend', '2026-09-27'), true, 'Sunday itself counts');
});

test('deadline from server seconds uses the client clock', () => {
  const now = new Date(2026, 8, 24, 10, 28, 30).getTime();
  const d = TT.deadlineFromSeconds(36000, now);
  assert.equal(d.getTime(), now + 36000 * 1000);
  assert.equal(TT.clockLabel(d), '9.24(목) 오후 8:28');
  assert.equal(TT.deadlineFromSeconds(null, now), null);
});

test('countdown', () => {
  const d = TT.parseSqlDateTime('2026-09-24 19:00:00');
  assert.deepEqual(TT.countdown(d, d.getTime() - (9 * 3600 + 59 * 60 + 12) * 1000), { expired: false, text: '09:59:12' });
  assert.equal(TT.countdown(d, d.getTime() + 1000).expired, true);
});
