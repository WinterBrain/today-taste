/* 오늘의 취향 — 순수 함수 모음. 브라우저에서는 window.TT, Node 테스트에서는 module.exports */
(function (root) {
  'use strict';
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  const pad = n => String(n).padStart(2, '0');

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  const won = n => (Number(n) || 0).toLocaleString('ko-KR') + '원';

  // 'YYYY-MM-DD' 를 UTC가 아닌 로컬 달력 날짜로 해석한다 (new Date('2026-09-28') 은 UTC 자정이라 요일이 밀릴 수 있다)
  function parseDate(d) { const [y, m, dd] = String(d).split('-').map(Number); return new Date(y, m - 1, dd); }
  function parseSqlDateTime(v) {
    const [d, t = '00:00:00'] = String(v).split(' ');
    const [y, m, dd] = d.split('-').map(Number);
    const [hh, mm, ss = 0] = t.split(':').map(Number);
    return new Date(y, m - 1, dd, hh, mm, ss);
  }
  const dowKo = d => DOW[parseDate(d).getDay()];
  const fmtDateShort = d => { const x = parseDate(d); return `${x.getMonth() + 1}.${x.getDate()}(${DOW[x.getDay()]})`; };
  const fmtDateLong = d => { const x = parseDate(d); return `${x.getMonth() + 1}월 ${x.getDate()}일 (${DOW[x.getDay()]})`; };
  const todayStr = (now = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);

  function splitTime(t) { const [h, m] = String(t).split(':').map(Number); return { h: h || 0, m: m || 0 }; }
  function timeParts(t) { const { h, m } = splitTime(t); return { period: h < 12 ? '오전' : '오후', clock: `${h % 12 === 0 ? 12 : h % 12}:${pad(m)}` }; }
  const timeLabel = t => { const p = timeParts(t); return `${p.period} ${p.clock}`; };
  function timeRange(a, b) {
    const x = timeParts(a), y = timeParts(b);
    return x.period === y.period ? `${x.period} ${x.clock} – ${y.clock}` : `${x.period} ${x.clock} – ${y.period} ${y.clock}`;
  }
  const dayBucket = d => { const w = parseDate(d).getDay(); return w === 0 ? '일' : w === 6 ? '토' : '평일'; };
  const band = t => { const { h } = splitTime(t); return h >= 9 && h < 12 ? '오전' : h >= 12 && h < 18 ? '오후' : '저녁'; };
  const cellKey = s => dayBucket(s.date) + '|' + band(s.start_time);

  function seatInfo(capacity, remaining) {
    const total = Math.max(1, Number(capacity) || 3);
    const left = Math.max(0, Math.min(total, Number(remaining) || 0));
    return { total, left, filled: total - left, label: left ? `${left}자리 남음` : '마감', last: left === 1, full: left === 0 };
  }

  function parseStep(s) {
    const str = String(s ?? ''); const i = str.indexOf('|');
    return i < 0 ? { time: '', text: str.trim() } : { time: str.slice(0, i).trim(), text: str.slice(i + 1).trim() };
  }
  function listOf(v) {
    if (Array.isArray(v)) return v;
    try { const x = JSON.parse(v || '[]'); return Array.isArray(x) ? x : []; } catch (e) { return []; }
  }
  const pairsOf = v => listOf(v).filter(p => Array.isArray(p) && p.length >= 2);

  function parseHash(hash) {
    const h = String(hash || '').replace(/^#/, '');
    const [p, q = ''] = h.split('?');
    const parts = p.split('/').filter(Boolean).map(decodeURIComponent);
    const query = {};
    q.split('&').filter(Boolean).forEach(kv => { const [k, v = ''] = kv.split('='); query[decodeURIComponent(k)] = decodeURIComponent(v); });
    return { parts, query };
  }

  function formatPhone(raw) {
    const v = String(raw || '').replace(/\D/g, '').slice(0, 11);
    if (v.length > 7) return `${v.slice(0, 3)}-${v.slice(3, 7)}-${v.slice(7)}`;
    if (v.length > 3) return `${v.slice(0, 3)}-${v.slice(3)}`;
    return v;
  }

  // 서버(/api/public/applications)와 같은 규칙. 키가 없으면 통과.
  function validateApply(f) {
    const e = {}; const age = Number(f.age); const mot = String(f.motivation || '').trim();
    if (!String(f.name || '').trim()) e.name = '이름을 입력해 주세요.';
    if (!Number.isInteger(age) || age < 19 || age > 35) e.age = '만 19~35세만 신청할 수 있어요.';
    if (!f.job) e.job = '직업을 선택해 주세요.';
    if (!/^010-\d{4}-\d{4}$/.test(f.phone || '')) e.phone = '010-0000-0000 형식으로 입력해 주세요.';
    if (mot.length < 10) e.motivation = '신청 이유를 10자 이상 적어주세요.';
    else if (mot.length > 300) e.motivation = '300자 이내로 줄여주세요.';
    if (!f.agreeRequired) e.agreeRequired = '필수 동의가 필요해요.';
    return e;
  }

  const openSchedules = g => (g.schedules || []).filter(s => Number(s.remaining) > 0);
  const nextSchedule = g => openSchedules(g).slice().sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time))[0] || null;

  function matchesFilter(g, key, today) {
    if (key === 'all' || !key) return true;
    const open = openSchedules(g);
    if (key === 'make') return g.field === '만들기' && open.length > 0;
    if (key === 'learn') return g.field === '배우기' && open.length > 0;
    if (key === 'weekend') {
      // 이번 주말 = 오늘부터 이번 주 일요일까지의 토·일
      const toSunday = (7 - parseDate(today).getDay()) % 7;
      return open.some(s => dayBucket(s.date) !== '평일' && daysBetween(today, s.date) >= 0 && daysBetween(today, s.date) <= toSunday);
    }
    if (key === 'weeknight') return open.some(s => dayBucket(s.date) === '평일' && band(s.start_time) === '저녁');
    if (key === 'closing') return open.some(s => Number(s.remaining) === 1 || daysBetween(today, s.date) <= 3);
    return true;
  }

  // 서버가 계산한 남은 초로 마감 시각을 만든다. 서버 시간대 설정과 무관하게 브라우저 시계 기준으로 맞춰진다.
  const deadlineFromSeconds = (sec, nowMs = Date.now()) => (sec === null || sec === undefined || sec === '') ? null : new Date(nowMs + Number(sec) * 1000);
  const clockLabel = d => { const x = d; return `${x.getMonth() + 1}.${x.getDate()}(${DOW[x.getDay()]}) ${timeLabel(pad(x.getHours()) + ':' + pad(x.getMinutes()))}`; };

  function countdown(deadline, nowMs) {
    const ms = deadline.getTime() - nowMs;
    if (ms <= 0) return { expired: true, text: '00:00:00' };
    const t = Math.floor(ms / 1000);
    return { expired: false, text: `${pad(Math.floor(t / 3600))}:${pad(Math.floor((t % 3600) / 60))}:${pad(t % 60)}` };
  }

  const TT = { esc, won, parseDate, parseSqlDateTime, dowKo, fmtDateShort, fmtDateLong, todayStr, daysBetween, timeLabel, timeRange, dayBucket, band, cellKey, seatInfo, parseStep, listOf, pairsOf, parseHash, formatPhone, validateApply, openSchedules, nextSchedule, matchesFilter, countdown, deadlineFromSeconds, clockLabel };
  if (typeof module !== 'undefined' && module.exports) module.exports = TT; else root.TT = TT;
})(typeof window !== 'undefined' ? window : globalThis);
