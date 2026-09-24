/* 신청자 앱. 라우트: #/ · #/g/:id · #/g/:id/apply?s= · #/done · #/find · #/guide · #/policy/:tab */
(function () {
  'use strict';
  const { esc, won } = TT;
  const $app = document.getElementById('app');

  const emptyForm = () => ({ name: '', age: '', job: '', mbti: '', phone: '', motivation: '', agreeRequired: false, agreeMarketing: false });
  const S = {
    groups: [], reviews: [], loaded: false, error: '',
    filter: 'all',
    sel: { groupId: null, scheduleId: null, date: null },
    form: emptyForm(), errors: {}, submitting: false,
    find: { cells: new Set(), randomId: null },
    done: null,
    ad: readAd(),
  };
  function readAd() {
    try { const p = new URLSearchParams(location.search); return { source: p.get('utm_source') || '직접/기타' }; }
    catch (e) { return { source: '직접/기타' }; }
  }

  const byId = id => S.groups.find(g => String(g.id) === String(id)) || null;
  const today = () => TT.todayStr();
  const go = hash => { location.hash = hash; };

  const routes = {};   // 라우트 이름 → (parts, query) => html
  const actions = {};  // data-action 이름 → (el, event) => void

  function render() {
    const { parts, query } = TT.parseHash(location.hash);
    if (!S.loaded) { $app.innerHTML = S.error ? renderLoadError() : renderSkeleton(); return; }
    const handler = routes[parts[0] || ''] || routes[''];
    $app.innerHTML = handler(parts, query);
    afterRender();
  }
  let lastRoute = null;
  function afterRender() {
    const route = location.hash.split('?')[0];
    const changed = route !== lastRoute;
    if (changed) { window.scrollTo(0, 0); lastRoute = route; }
    document.title = document.querySelector('[data-title]')?.dataset.title || '오늘의 취향 — 대구에서 세 명이 만나는 원데이 모임';
    // 화면 전체 대신 바뀐 페이지 제목만 스크린리더에 알린다
    const status = document.getElementById('route-status');
    if (changed && status) status.textContent = document.title;
    const track = document.querySelector('[data-gallery]'), count = document.querySelector('[data-gallery-count]');
    if (track && count) track.addEventListener('scroll', () => { count.textContent = `${Math.round(track.scrollLeft / track.clientWidth) + 1}/${track.children.length}`; }, { passive: true });
  }

  window.addEventListener('hashchange', () => { UI.closeSheet(); render(); });
  // 호스트 사진을 못 불러오면 이름 첫 글자로 대체한다
  document.addEventListener('error', e => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.classList.contains('host-photo')) return;
    const span = document.createElement('span');
    span.className = 'host-photo initial'; span.textContent = img.dataset.initial || '';
    img.replaceWith(span);
  }, true);
  window.addEventListener('scroll', () => document.querySelector('.topbar')?.classList.toggle('is-scrolled', window.scrollY > 4), { passive: true });

  document.addEventListener('click', e => {
    const goEl = e.target.closest('[data-go]');
    if (goEl) { e.preventDefault(); go(goEl.dataset.go); return; }
    const a = e.target.closest('[data-action]');
    if (a && actions[a.dataset.action]) { e.preventDefault(); actions[a.dataset.action](a, e); }
  });

  // 외부에서 상세 링크로 바로 들어온 경우(history.length === 1) 홈으로 보낸다
  actions.back = () => { if (history.length > 1) history.back(); else go('#/'); };
  actions.retry = () => { S.error = ''; load(); };

  function renderSkeleton() {
    const card = '<div><div class="skel" style="aspect-ratio:4/3"></div><div class="skel" style="height:14px;margin-top:10px"></div><div class="skel" style="height:14px;margin-top:6px;width:60%"></div></div>';
    return topbar({}) + `<div class="pad"><div class="skel" style="aspect-ratio:16/10"></div></div>
      <div class="section"><div class="skel" style="height:24px;width:40%"></div><div class="grid2" style="margin-top:14px">${card.repeat(4)}</div></div>`;
  }
  function renderLoadError() {
    return topbar({}) + `<div class="empty">${UI.icon('info')}<h3>모임 정보를 불러오지 못했어요</h3><p>${esc(S.error)}</p><button class="btn btn-line" data-action="retry">다시 시도</button></div>`;
  }

  async function load() {
    render();
    try {
      const j = await UI.api('/api/public/groups');
      S.groups = j.groups || []; S.reviews = j.reviews || []; S.loaded = true;
    } catch (e) { S.error = e.message; }
    render();
  }

  /* ---------- 공용 컴포넌트 ---------- */

  function topbar({ back = false, title = '', right = '' } = {}) {
    const left = back
      ? `<button class="icon-btn" data-action="back" aria-label="뒤로">${UI.icon('back')}</button>${title ? `<h1 class="topbar-title">${esc(title)}</h1>` : ''}`
      : `<a class="wordmark" href="#/" aria-label="오늘의 취향 홈"><svg class="mark" viewBox="12 2 40 56" aria-hidden="true"><path d="M32 29.3C39.6 29.3 44.8 34.9 44.8 41.8C44.8 47.6 41.6 52.2 39 54.4H25C22.4 52.2 19.2 47.6 19.2 41.8C19.2 34.9 24.4 29.3 32 29.3Z" fill="var(--accent)" stroke="currentColor" stroke-width="6.2" stroke-linejoin="round"/><path d="M29.2 6.2L34.8 9.9M16 19.6H48" stroke="currentColor" stroke-width="6.2" stroke-linecap="round"/></svg>오늘의 취향</a><span class="region">${esc(SITE.region)}</span>`;
    return `<header class="topbar">${left}<span class="spacer"></span>${right}</header>`;
  }
  const sectionHead = (title, sub, more) => `<div class="section-head"><div><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div>${more ? `<a class="more" href="${more}">전체 보기${UI.icon('forward', 'icon icon-sm')}</a>` : ''}</div>`;

  function cardBadge(g) {
    const open = TT.openSchedules(g);
    if (!open.length) return '<span class="badge badge-muted">모집 마감</span>';
    if (open.some(s => Number(s.remaining) === 1)) return '<span class="badge badge-accent">마감 임박</span>';
    if (g.stats && g.stats.sessions_done) return `<span class="badge badge-ok">${g.stats.sessions_done}회 진행</span>`;
    return '<span class="badge badge-soft">새 모임</span>';
  }
  function groupCard(g, { wide = false } = {}) {
    const next = TT.nextSchedule(g);
    const when = next ? `${TT.fmtDateShort(next.date)} ${TT.timeLabel(next.start_time)}` : '다음 일정 준비 중';
    const seat = next ? UI.seats(TT.seatInfo(next.capacity, next.remaining)) : '';
    return `<a class="gcard${wide ? ' is-wide' : ''}${next ? '' : ' is-closed'}" href="#/g/${g.id}">
      <div class="gcard-photo">${UI.cover(g.cover_url, g)}<div class="gcard-badges">${cardBadge(g)}</div></div>
      <div class="gcard-meta">${esc(g.field)} · ${esc(g.place)}</div>
      <h3 class="gcard-title">${esc(g.name)}</h3>
      <div class="gcard-when">${when}</div>
      <div class="gcard-foot"><b class="num">${won(g.fee)}</b>${seat}</div>
    </a>`;
  }
  function reviewCard(r, { showGroup = true } = {}) {
    const month = r.date ? `${Number(r.date.slice(5, 7))}월 참여` : '';
    return `<article class="rcard">
      <div class="rcard-stars" aria-label="5점 만점에 ${r.rating}점">${UI.icon('star', 'icon star is-on')}<b class="num">${Number(r.rating).toFixed(1)}</b></div>
      <p class="rcard-text">${esc(r.text)}</p>
      <div class="rcard-meta">${esc(r.name_masked)}${showGroup ? ` · ${esc(r.group_name)}` : ''}${month ? ` · ${month}` : ''}</div>
    </article>`;
  }
  function footer() {
    const b = SITE.business;
    return `<footer class="footer">
      <div class="links"><a href="#/guide">이용 안내</a><a href="#/policy/terms">이용약관</a><a href="#/policy/privacy"><b>개인정보처리방침</b></a><a href="/admin.html">운영자 로그인</a></div>
      <div class="cs"><b>고객센터</b> <a href="${esc(SITE.kakaoChannelUrl)}" target="_blank" rel="noopener">카카오톡 채널</a> · ${esc(SITE.csHours)}</div>
      <div>${esc(b.company)} · 대표 ${esc(b.ceo)} · 사업자등록번호 ${esc(b.bizNo)}<br>통신판매업 ${esc(b.ecommerceNo)} · ${esc(b.address)} · ${esc(b.email)}</div>
    </footer>`;
  }
  function faqList(items) {
    return `<div class="faq">${items.map(([q, a]) => `<details><summary>${esc(q)}${UI.icon('plus', 'icon icon-sm')}</summary><p>${esc(a)}</p></details>`).join('')}</div>`;
  }

  const STEPS = [
    ['신청', '일정을 고르고 간단한 정보와 신청 이유를 보내요.'],
    ['운영자 검토', '담당 운영자가 보통 24시간 안에 확인해요.'],
    ['참여 확인', '승인되면 카카오톡으로 참여 확인 링크를 보내드려요.'],
    ['입금', '참여를 확정하면 10시간 안에 입금해 주세요. 입금이 확인되면 자리가 확정돼요.'],
    ['모임 당일', '확정 후 안내받은 장소에서 만나요.'],
  ];
  const stepsList = () => `<ol class="steps">${STEPS.map(([t, d]) => `<li><b>${t}</b><span>${d}</span></li>`).join('')}</ol>`;

  /* ---------- 홈 ---------- */

  const FILTERS = [['all', '전체'], ['weekend', '이번 주말'], ['weeknight', '평일 저녁'], ['make', '만들기'], ['learn', '배우기'], ['closing', '마감 임박']];
  const HOME_FAQ = [
    ['혼자 신청해도 되나요?', '대부분 혼자 오세요. 최대 세 명이라 자연스럽게 대화가 시작돼요.'],
    ['신청하면 바로 확정인가요?', '아니에요. 운영자 승인 → 참여 확인 → 10시간 안 입금이 끝나면 확정돼요.'],
    ['나이 제한이 있나요?', '만 19~35세만 신청할 수 있어요.'],
    ['취소하면 환불되나요?', '승인 전 취소는 언제나 전액 환불돼요. 승인 후에는 모임마다 다른 환불 규정을 따라요.'],
  ];
  actions.filter = el => { S.filter = el.dataset.key; render(); };

  const nextKey = g => { const n = TT.nextSchedule(g); return n ? n.date + n.start_time : '9999'; };

  routes[''] = function renderHome() {
    const t = today();
    const openGroups = S.groups.filter(g => TT.openSchedules(g).length);
    const scheduleCount = S.groups.reduce((n, g) => n + TT.openSchedules(g).length, 0);
    const thisWeek = openGroups.filter(g => TT.openSchedules(g).some(s => TT.daysBetween(t, s.date) <= 7))
      .sort((a, b) => nextKey(a).localeCompare(nextKey(b)));
    const list = S.groups.filter(g => TT.matchesFilter(g, S.filter, t))
      .sort((a, b) => nextKey(a).localeCompare(nextKey(b)));
    const filterLabel = FILTERS.find(f => f[0] === S.filter)[1];

    let h = topbar({ right: '<a class="text-link" href="#/guide">이용 안내</a>' });
    h += `<div class="pad"><a class="banner" href="#/guide">
        <img src="/assets/img/brand/home-banner.jpg" alt="" onerror="this.closest('.banner').classList.add('no-photo');this.remove()">
        <div class="banner-copy"><strong>퇴근 후 두 시간,<br>처음 만난 세 사람과 만드는 취향</strong><span>오늘의 취향은 어떻게 운영되나요 ${UI.icon('forward', 'icon icon-sm')}</span></div>
      </a></div>`;
    h += `<div class="section filters"><div class="chips hscroll" role="tablist" aria-label="모임 필터">${FILTERS.map(([k, l]) => `<button class="chip${S.filter === k ? ' is-on' : ''}" role="tab" aria-selected="${S.filter === k}" data-action="filter" data-key="${k}">${l}</button>`).join('')}</div></div>`;
    h += `<div class="section find-wrap"><a class="find-entry" href="#/find"><div><b>언제 시간 되세요?</b><span>요일과 시간대를 고르면 맞는 모임을 골라드려요</span></div><span class="find-go">시간대 고르기${UI.icon('forward', 'icon icon-sm')}</span></a></div>`;
    if (thisWeek.length && S.filter === 'all') h += `<section class="section">${sectionHead('이번 주 열리는 모임', '7일 안에 열리는 일정이에요')}<div class="hscroll">${thisWeek.map(g => groupCard(g, { wide: true })).join('')}</div></section>`;
    h += `<section class="section">${sectionHead(S.filter === 'all' ? '모든 모임' : filterLabel, `${openGroups.length}개 모임 · ${scheduleCount}개 일정 모집 중`)}`;
    h += list.length
      ? `<div class="grid2">${list.map(g => groupCard(g)).join('')}</div>`
      : `<div class="empty">${UI.icon('calendar')}<h3>조건에 맞는 일정이 없어요</h3><p>다른 조건을 골라보세요.</p><button class="btn btn-line" data-action="filter" data-key="all">전체 보기</button></div>`;
    h += '</section>';
    if (S.reviews.length) h += `<section class="section">${sectionHead('다녀온 분들의 후기', '참여 후 직접 남긴 평가예요')}<div class="hscroll">${S.reviews.map(r => reviewCard(r)).join('')}</div></section>`;
    h += `<section class="section">${sectionHead('처음이라면', '신청부터 모임 당일까지')}${stepsList()}<a class="more-link" href="#/guide">이용 안내 전체 보기${UI.icon('forward', 'icon icon-sm')}</a></section>`;
    h += `<section class="section">${sectionHead('자주 묻는 질문')}${faqList(HOME_FAQ)}</section>`;
    return h + footer();
  };

  /* ---------- 모임 상세 ---------- */

  routes.g = function (parts, query) {
    const g = byId(parts[1]);
    if (!g) return topbar({ back: true }) + `<div class="empty">${UI.icon('info')}<h3>모임을 찾을 수 없어요</h3><p>모집이 끝났거나 주소가 바뀌었어요.</p><a class="btn btn-line" href="#/">홈으로</a></div>`;
    if (parts[2] === 'apply') return renderApply(g, query);
    if (S.sel.groupId !== g.id) { const n = TT.nextSchedule(g); S.sel = { groupId: g.id, date: n ? n.date : null, scheduleId: null }; }
    return renderDetail(g);
  };
  actions.pickDate = el => { S.sel.date = el.dataset.date; S.sel.scheduleId = null; render(); };
  actions.pickSchedule = el => { S.sel.scheduleId = Number(el.dataset.id); render(); };
  actions.apply = () => {
    if (!S.sel.scheduleId) {
      const box = document.getElementById('schedule');
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
      UI.toast('일정을 먼저 골라주세요');
      return;
    }
    go(`#/g/${S.sel.groupId}/apply?s=${S.sel.scheduleId}`);
  };
  actions.share = async () => {
    const g = byId(S.sel.groupId); const url = location.href;
    if (navigator.share) { try { await navigator.share({ title: g.name, text: g.tagline, url }); } catch (e) {} }
    else UI.copy(url);
  };
  actions.allReviews = async () => {
    const g = byId(S.sel.groupId);
    let list = g.reviews;
    try { list = (await UI.api(`/api/public/groups/${g.id}/reviews`)).reviews; } catch (e) { /* 실패하면 받아둔 최근 후기만 보여준다 */ }
    UI.openSheet(`후기 ${list.length}개`, list.map(r => reviewCard(r, { showGroup: false })).join(''));
  };
  actions.policy = el => UI.openSheet(el.dataset.tab === 'terms' ? '이용약관' : '개인정보 수집·이용 동의', policyBody(el.dataset.tab));

  function trustLine(st) {
    const items = [];
    if (st.review_count) items.push(`${UI.icon('star', 'icon star is-on')}<b class="num">${Number(st.rating_avg).toFixed(1)}</b> (후기 ${st.review_count})`);
    if (st.sessions_done) items.push(`${st.sessions_done}회 진행`);
    if (st.participants) items.push(`누적 ${st.participants}명 참여`);
    return items.length ? items.map(x => `<span>${x}</span>`).join('') : '<span class="badge badge-soft">새로 열린 모임</span>';
  }
  function scheduleBlock(g) {
    const all = (g.schedules || []).slice().sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));
    if (!all.length) return `<div class="empty compact">${UI.icon('calendar')}<h3>지금은 모집 중인 일정이 없어요</h3><a class="btn btn-line" href="${esc(SITE.kakaoChannelUrl)}" target="_blank" rel="noopener">다음 일정 소식 받기</a></div>`;
    const dates = [...new Set(all.map(s => s.date))];
    const dateOpen = d => all.some(s => s.date === d && Number(s.remaining) > 0);
    const chips = dates.map(d => {
      const open = dateOpen(d), on = S.sel.date === d;
      return `<button class="date-chip${on ? ' is-on' : ''}${open ? '' : ' is-closed'}" ${open ? `data-action="pickDate" data-date="${d}"` : 'disabled'} aria-pressed="${on}"><b>${TT.fmtDateShort(d).split('(')[0]}</b><span>${TT.dowKo(d)}</span></button>`;
    }).join('');
    const sessions = all.filter(s => s.date === S.sel.date).map(s => {
      const info = TT.seatInfo(s.capacity, s.remaining), on = S.sel.scheduleId === s.id;
      return `<button class="session${on ? ' is-on' : ''}" ${info.full ? 'disabled' : `data-action="pickSchedule" data-id="${s.id}"`} aria-pressed="${on}">
        <div><b class="num">${TT.timeRange(s.start_time, s.end_time)}</b><span>${esc(s.place)}${Number(s.fee) !== Number(g.fee) ? ` · ${won(s.fee)}` : ''}</span></div>
        ${UI.seats(info)}${on ? UI.icon('check', 'icon session-check') : ''}
      </button>`;
    }).join('');
    return `<div class="date-chips hscroll">${chips}</div><div class="sessions">${sessions || '<p class="muted">이 날은 모두 마감됐어요.</p>'}</div>`;
  }
  const bulletList = items => items.length ? `<ul class="bullets">${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  const readSection = (title, body) => body ? `<div class="rule"></div><section class="section read"><h2>${esc(title)}</h2>${body}</section>` : '';

  function renderDetail(g) {
    const photos = [g.cover_url, ...TT.listOf(g.gallery_json)].filter(Boolean);
    const forWhom = TT.listOf(g.for_whom_json), includes = TT.listOf(g.includes_json), order = TT.listOf(g.order_json), prep = TT.listOf(g.prep_json), faq = TT.pairsOf(g.faq_json);
    const refund = String(g.refund_policy || '').split('\n').map(x => x.trim()).filter(Boolean);
    const schedules = g.schedules || [];
    const sel = schedules.find(s => s.id === S.sel.scheduleId);
    const bands = ['오전', '오후', '저녁'].filter(b => schedules.some(s => TT.band(s.start_time) === b));
    const cap = schedules[0]?.capacity || 3;
    const firstOpen = TT.nextSchedule(g);
    const hostInitial = (String(g.host_name || '').split('·').pop().trim() || '?').slice(0, 1);

    let h = `<div data-title="${esc(g.name)} — 오늘의 취향"></div>`;
    h += `<div class="gallery">
      <div class="gallery-track hscroll" data-gallery>${(photos.length ? photos : ['']).map((u, i) => `<div class="gallery-item">${UI.cover(u, g, '', { eager: i === 0 })}</div>`).join('')}</div>
      <button class="icon-btn over left" data-action="back" aria-label="뒤로">${UI.icon('back')}</button>
      <button class="icon-btn over right" data-action="share" aria-label="공유">${UI.icon('share')}</button>
      ${photos.length > 1 ? `<span class="gallery-count num" data-gallery-count>1/${photos.length}</span>` : ''}
    </div>`;
    h += `<section class="pad title-block">
      <div class="crumb">${esc(g.field)} · ${esc(g.tag)}</div>
      <h1 class="serif">${esc(g.name)}</h1>
      <p class="tagline">${esc(g.tagline)}</p>
      <div class="trust">${trustLine(g.stats || {})}</div>
    </section>`;
    h += `<section class="pad"><ul class="facts">
      <li>${UI.icon('clock')}<div><b>${esc(g.duration)}</b>${bands.length ? `<span>${bands.join('·')} 진행</span>` : ''}</div></li>
      <li>${UI.icon('users')}<div><b>최대 ${cap}명 · 운영자 승인 후 참여 확정</b>${firstOpen ? `<span>${UI.seats(TT.seatInfo(firstOpen.capacity, firstOpen.remaining))} 가장 가까운 일정 기준</span>` : ''}</div></li>
      <li>${UI.icon('wallet')}<div><b class="num">${won(g.fee)}</b>${g.fee_note ? `<span>${esc(g.fee_note)}</span>` : ''}</div></li>
      <li>${UI.icon('pin')}<div><b>대구 중구 ${esc(g.place)}</b><span>정확한 위치는 참여 확정 후 안내해요</span></div></li>
    </ul></section>`;
    h += `<div class="rule"></div><section class="section" id="schedule">${sectionHead('일정 선택', '원하는 날짜를 골라주세요')}${scheduleBlock(g)}</section>`;
    if (g.reviews && g.reviews.length) {
      const avg = k => g.reviews.reduce((n, r) => n + Number(r[k]), 0) / g.reviews.length;
      h += `<div class="rule"></div><section class="section">${sectionHead('참여한 분들의 후기')}
        <div class="score"><div class="score-big">${UI.icon('star', 'icon star is-on')}<b class="num">${Number(g.stats.rating_avg).toFixed(1)}</b><span>후기 ${g.stats.review_count}개</span></div>
        <dl class="score-bars">${[['progress', '진행'], ['place', '장소'], ['value', '가격 만족']].map(([k, l]) => `<div><dt>${l}</dt><dd><i style="width:${avg(k) / 5 * 100}%"></i></dd><dd class="num">${avg(k).toFixed(1)}</dd></div>`).join('')}</dl></div>
        <div class="review-list">${g.reviews.slice(0, 2).map(r => reviewCard(r, { showGroup: false })).join('')}</div>
        ${g.reviews.length > 2 ? '<button class="btn btn-line btn-block" data-action="allReviews">후기 전체 보기</button>' : ''}</section>`;
    }
    const introParas = String(g.intro || '').split(/\n{2,}/).map(x => x.trim()).filter(Boolean);
    const inline = photos.slice(1, 3);
    h += readSection('소개', introParas.map((p, i) => `<p>${esc(p)}</p>${inline[i] ? `<figure class="inline-photo">${UI.cover(inline[i], g)}</figure>` : ''}`).join(''));
    h += readSection('이런 분께 추천해요', bulletList(forWhom));
    h += readSection('포함 사항', includes.length ? `<ul class="checks">${includes.map(x => `<li>${UI.icon('check')}<span>${esc(x)}</span></li>`).join('')}</ul>` : '');
    h += readSection('진행 순서', order.length ? `<ol class="timeline">${order.map(TT.parseStep).map((s, i) => `<li><span class="t num">${esc(s.time || String(i + 1))}</span><span>${esc(s.text)}</span></li>`).join('')}</ol>` : '');
    h += readSection('준비물', bulletList(prep));
    if (g.host_name) h += readSection('호스트', `<div class="host">${g.host_photo_url ? `<img src="${esc(g.host_photo_url)}" alt="" class="host-photo" data-initial="${esc(hostInitial)}">` : `<span class="host-photo initial">${esc(hostInitial)}</span>`}<div><span class="host-label">호스트</span><b>${esc(g.host_name)}</b><span>${esc(g.host_role)}</span></div></div>${g.host_bio ? `<p>${esc(g.host_bio)}</p>` : ''}`);
    h += readSection('오시는 길', `<p class="place"><b>대구 중구 ${esc(g.place)}</b>${g.place_note ? `<br>${esc(g.place_note)}` : ''}</p><p class="muted">정확한 위치는 참여 확정 후 안내해요.</p><a class="btn btn-line" href="https://map.kakao.com/?q=${encodeURIComponent('대구 ' + g.place)}" target="_blank" rel="noopener">${UI.icon('external', 'icon icon-sm')}카카오맵에서 보기</a>`);
    h += readSection('환불 규정', `${bulletList(refund)}<p class="muted refund-note">승인 전 취소는 언제나 전액 환불돼요. 날짜 기준은 자정이에요.</p>`);
    h += readSection('자주 묻는 질문', faq.length ? faqList(faq) : '');
    const others = S.groups.filter(x => x.id !== g.id && TT.openSchedules(x).length).sort((a, b) => (b.field === g.field) - (a.field === g.field));
    if (others.length) h += `<div class="rule"></div><section class="section">${sectionHead('다른 모임도 둘러보세요')}<div class="hscroll">${others.map(x => groupCard(x, { wide: true })).join('')}</div></section>`;
    const open = TT.openSchedules(g).length > 0;
    h += `<div class="bottom-bar"><div class="sum"><b class="num">${won(sel ? sel.fee : g.fee)}</b><span>${sel ? `${TT.fmtDateShort(sel.date)} ${TT.timeLabel(sel.start_time)}` : open ? '일정을 골라주세요' : '모집 중인 일정이 없어요'}</span></div><button class="btn btn-primary" data-action="apply" ${open ? '' : 'disabled'}>신청하기</button></div>`;
    return h;
  }

  /* ---------- 신청 정보 입력 ---------- */

  const JOBS = TT.JOBS;
  const MBTI = ['ISTJ', 'ISFJ', 'INFJ', 'INTJ', 'ISTP', 'ISFP', 'INFP', 'INTP', 'ESTP', 'ESFP', 'ENFP', 'ENTP', 'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ'];

  function renderApply(g, query) {
    const s = (g.schedules || []).find(x => String(x.id) === String(query.s));
    if (!s || Number(s.remaining) <= 0) { setTimeout(() => go(`#/g/${g.id}`), 0); return ''; }
    S.sel = { groupId: g.id, date: s.date, scheduleId: s.id };
    const f = S.form, e = S.errors;
    const err = k => e[k] ? `<p class="field-err" id="err-${k}">${esc(e[k])}</p>` : '';
    const inv = k => e[k] ? `aria-invalid="true" aria-describedby="err-${k}"` : '';
    const mbti = f.mbti || '모름';
    return `<div data-title="신청하기 — ${esc(g.name)}"></div>` + topbar({ back: true, title: '신청하기' }) + `
      <section class="pad apply-sum">${UI.cover(g.cover_url, g, 'apply-thumb')}<div><b>${esc(g.name)}</b><span>${TT.fmtDateShort(s.date)} ${TT.timeRange(s.start_time, s.end_time)} · ${esc(s.place)}</span></div><a class="text-link" href="#/g/${g.id}">변경</a></section>
      <form class="pad form" data-apply-form novalidate>
        <div class="field"><label for="f-name">이름</label><input id="f-name" class="input" data-bind="name" value="${esc(f.name)}" maxlength="${TT.NAME_MAX}" autocomplete="name" ${inv('name')}>${err('name')}</div>
        <div class="field"><label for="f-age">나이 (만)</label><input id="f-age" class="input num" data-bind="age" value="${esc(f.age)}" inputmode="numeric" maxlength="2" ${inv('age')}>${e.age ? err('age') : '<p class="hint">만 19~35세만 신청할 수 있어요</p>'}</div>
        <div class="field"><span class="label" id="l-job">직업</span><div class="choice-row" role="radiogroup" aria-labelledby="l-job">${JOBS.map(j => `<button type="button" class="choice${f.job === j ? ' is-on' : ''}" role="radio" aria-checked="${f.job === j}" data-action="choose" data-key="job" data-val="${j}">${j}</button>`).join('')}</div>${err('job')}</div>
        <details class="field mbti"${mbti !== '모름' ? ' open' : ''}><summary><span class="label">MBTI <em>선택</em></span><span class="val">${esc(mbti)} ${UI.icon('plus', 'icon icon-sm')}</span></summary><div class="mbti-grid">${[...MBTI, '모름'].map(m => `<button type="button" class="choice${mbti === m ? ' is-on' : ''}" data-action="choose" data-key="mbti" data-val="${m}">${m}</button>`).join('')}</div></details>
        <div class="field"><label for="f-phone">휴대폰 번호</label><input id="f-phone" class="input num" data-bind="phone" value="${esc(f.phone)}" inputmode="numeric" autocomplete="tel" placeholder="010-0000-0000" ${inv('phone')}><p class="hint">승인·입금 안내를 카카오톡으로 보내드려요</p>${err('phone')}</div>
        <div class="field"><label for="f-mot">신청 이유</label><textarea id="f-mot" class="input" rows="4" data-bind="motivation" maxlength="300" placeholder="이 모임에서 기대하는 점이나 관심 계기를 적어주세요. 운영자가 승인할 때 참고해요." ${inv('motivation')}>${esc(f.motivation)}</textarea><p class="hint counter num"><span data-counter>${f.motivation.trim().length}</span>/300</p>${err('motivation')}</div>
        <div class="notice"><b>신청 후 이렇게 진행돼요</b><ol><li>운영자 검토 (보통 24시간 안)</li><li>카카오톡으로 참여 확인 링크 도착</li><li>참여 확정 후 10시간 안에 입금하면 자리 확정</li></ol></div>
        <div class="agree-group">
          <label class="agree"><input type="checkbox" data-agree="agreeRequired" ${f.agreeRequired ? 'checked' : ''} ${inv('agreeRequired')}><span><em class="req">필수</em> 개인정보 수집·이용 동의</span><button type="button" class="text-link" data-action="policy" data-tab="privacy">보기</button></label>${err('agreeRequired')}
          <label class="agree"><input type="checkbox" data-agree="agreeMarketing" ${f.agreeMarketing ? 'checked' : ''}><span><em>선택</em> 새 모임 소식 받기</span></label>
        </div>
      </form>
      <div class="bottom-bar"><button class="btn btn-primary btn-block" data-action="submit" ${S.submitting ? 'disabled' : ''}>${S.submitting ? '보내는 중…' : '신청 보내기'}</button></div>`;
  }
  actions.choose = el => { S.form[el.dataset.key] = el.dataset.val; delete S.errors[el.dataset.key]; render(); };
  document.addEventListener('input', e => {
    const t = e.target; if (!t.matches('[data-bind]')) return;
    const k = t.dataset.bind; let v = t.value;
    if (k === 'phone') {
      const digitsBefore = v.slice(0, t.selectionStart).replace(/\D/g, '').length;
      v = TT.formatPhone(v); t.value = v;
      const pos = TT.caretAfterDigits(v, digitsBefore); t.setSelectionRange(pos, pos);
    }
    if (k === 'age') { v = v.replace(/\D/g, '').slice(0, 2); t.value = v; }
    S.form[k] = v;
    if (k === 'motivation') { const c = document.querySelector('[data-counter]'); if (c) c.textContent = v.trim().length; }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.matches('[data-agree]')) { S.form[t.dataset.agree] = t.checked; delete S.errors[t.dataset.agree]; }
  });
  actions.submit = async () => {
    S.errors = TT.validateApply(S.form);
    if (Object.keys(S.errors).length) { render(); focusFirstError(); return; }
    const g = byId(S.sel.groupId), s = g.schedules.find(x => x.id === S.sel.scheduleId);
    S.submitting = true; render();
    try {
      const j = await UI.api('/api/public/applications', { method: 'POST', body: JSON.stringify({
        schedule_id: s.id, name: S.form.name.trim(), age: Number(S.form.age), job: S.form.job,
        mbti: S.form.mbti === '모름' ? '' : S.form.mbti, phone: S.form.phone, motivation: S.form.motivation.trim(),
        preferred_times: S.find.cells.size ? [...S.find.cells] : [TT.cellKey(s)],
        selection_method: S.find.randomId === g.id ? '랜덤' : '직접', ad_source: S.ad.source,
      }) });
      S.done = { id: j.id, group: g.name, when: `${TT.fmtDateShort(s.date)} ${TT.timeRange(s.start_time, s.end_time)}`, place: s.place, name: S.form.name.trim() };
      S.form = emptyForm(); S.errors = {}; S.find = { cells: new Set(), randomId: null };
      S.submitting = false;
      go('#/done');
    } catch (err) {
      S.submitting = false;
      // 마감·일정 변경으로 거절됐을 수 있으니 좌석 수를 다시 받아온다. 마감된 회차면 renderApply 가 상세로 돌려보낸다
      if (err.status === 400) { try { const j = await UI.api('/api/public/groups'); S.groups = j.groups || []; S.reviews = j.reviews || []; } catch (e) {} }
      render(); UI.toast(err.message);
    }
  };
  // 화면 순서대로 첫 오류 항목에 포커스한다. 직업은 입력칸이 없어 선택 버튼으로 보낸다
  const ERROR_ORDER = [['name', '#f-name'], ['age', '#f-age'], ['job', '[data-key="job"]'], ['phone', '#f-phone'], ['motivation', '#f-mot'], ['agreeRequired', '[data-agree="agreeRequired"]']];
  function focusFirstError() {
    const hit = ERROR_ORDER.find(([k]) => S.errors[k]);
    if (hit) document.querySelector(hit[1])?.focus();
  }

  /* ---------- 신청 완료 ---------- */

  routes.done = function () {
    const d = S.done;
    if (!d) { setTimeout(() => go('#/'), 0); return ''; }
    const steps = [['신청 접수', '지금'], ['운영자 검토', '보통 24시간 안에 확인해요'], ['참여 확인', '카카오톡으로 링크를 보내드려요'], ['입금 후 확정', '참여 확정 후 10시간 안에 입금해 주세요']];
    return `<div data-title="신청 완료 — 오늘의 취향"></div>` + topbar({}) + `
      <section class="pad done">
        <span class="done-mark">${UI.icon('check')}</span>
        <h1 class="serif">신청이 접수됐어요</h1>
        <p class="muted">${esc(d.name)}님, 운영자가 확인하면 카카오톡으로 알려드릴게요.</p>
        <ol class="progress-v">${steps.map(([t, s], i) => `<li class="${i === 0 ? 'is-now' : ''}"><b>${t}</b><span>${s}</span></li>`).join('')}</ol>
        <dl class="receipt"><div><dt>접수번호</dt><dd class="num">#${esc(d.id)}</dd></div><div><dt>모임</dt><dd>${esc(d.group)}</dd></div><div><dt>일시</dt><dd>${esc(d.when)}</dd></div><div><dt>장소</dt><dd>${esc(d.place)}</dd></div></dl>
        <a class="btn btn-secondary btn-block" href="#/">다른 모임 둘러보기</a>
        <a class="text-link center" href="${esc(SITE.kakaoChannelUrl)}" target="_blank" rel="noopener">${UI.icon('chat', 'icon icon-sm')} 카카오톡 채널로 문의하기</a>
      </section>`;
  };

  /* ---------- 시간대로 찾기 ---------- */

  const DAYS = ['평일', '토', '일'], BANDS = ['오전', '오후', '저녁'];
  actions.cell = el => { const k = el.dataset.key; S.find.cells.has(k) ? S.find.cells.delete(k) : S.find.cells.add(k); S.find.randomId = null; render(); };
  actions.randomPick = () => {
    const pool = S.groups.filter(g => TT.openSchedules(g).some(s => S.find.cells.has(TT.cellKey(s))) && g.id !== S.find.randomId);
    if (pool.length) S.find.randomId = pool[Math.floor(Math.random() * pool.length)].id;
    render();
  };
  actions.showAllMatched = () => { S.find.randomId = null; render(); };
  routes.find = function () {
    const matched = S.groups.filter(g => TT.openSchedules(g).some(s => S.find.cells.has(TT.cellKey(s))));
    const picked = S.find.randomId ? matched.filter(g => g.id === S.find.randomId) : matched;
    let h = `<div data-title="시간대로 찾기 — 오늘의 취향"></div>` + topbar({ back: true, title: '시간대로 찾기' });
    h += `<section class="pad"><h2 class="page-q">언제 시간 되세요?</h2><p class="muted">여러 칸을 고를 수 있어요.</p>
      <table class="matrix"><thead><tr><th></th>${BANDS.map(b => `<th scope="col">${b}</th>`).join('')}</tr></thead><tbody>${DAYS.map(d => `<tr><th scope="row">${d}</th>${BANDS.map(b => {
        const k = d + '|' + b, on = S.find.cells.has(k);
        return `<td><button class="cell${on ? ' is-on' : ''}" aria-pressed="${on}" data-action="cell" data-key="${k}" aria-label="${d} ${b}">${on ? UI.icon('check') : ''}</button></td>`;
      }).join('')}</tr>`).join('')}</tbody></table></section>`;
    if (!S.find.cells.size) return h + `<p class="pad muted find-hint">시간대를 고르면 맞는 모임이 바로 아래에 보여요.</p>`;
    h += `<section class="section">${sectionHead(`맞는 모임 ${matched.length}개`, S.find.randomId ? '이 모임은 어때요?' : '고른 시간대에 신청할 수 있는 일정이 있어요')}`;
    if (matched.length >= 2) h += `<div class="find-actions"><button class="btn btn-line" data-action="randomPick">${S.find.randomId ? '다시 골라주세요' : '이 중에서 골라주세요'}</button>${S.find.randomId ? '<button class="btn btn-line" data-action="showAllMatched">모두 보기</button>' : ''}</div>`;
    h += picked.length
      ? `<div class="grid2">${picked.map(g => groupCard(g)).join('')}</div>`
      : `<div class="empty">${UI.icon('calendar')}<h3>고른 시간대에 열리는 모임이 아직 없어요</h3><p>다른 시간대를 골라보세요.</p></div>`;
    return h + '</section>';
  };

  /* ---------- 이용 안내·약관 ---------- */

  routes.guide = function () {
    return `<div data-title="이용 안내 — 오늘의 취향"></div>` + topbar({ back: true, title: '이용 안내' }) + `
      <section class="pad read guide">
        <img class="guide-photo" src="/assets/img/brand/guide.jpg" alt="" onerror="this.remove()">
        <h1 class="serif">오늘의 취향은 이렇게 운영돼요</h1>
        <p>대구 중구의 작은 공방과 카페에서 열리는 원데이 모임이에요. 한 모임은 최대 세 명까지만 받아요. 대화와 실습이 충분하도록 운영자가 신청서를 보고 한 테이블을 꾸려요.</p>
        <h2>신청부터 모임 당일까지</h2>${stepsList()}
        <h2>입금과 확정</h2><p>참여를 확정하면 참여 확인 페이지에 입금 계좌와 금액이 표시돼요. 10시간 안에 신청자 이름으로 입금해 주세요. 기한이 지나면 자동으로 취소되고 다음 신청자에게 기회가 넘어가요.</p>
        <h2>환불 공통 원칙</h2><ul class="bullets"><li>승인 전 취소는 언제나 전액 환불돼요.</li><li>승인 후에는 모임마다 정한 환불 규정을 따라요. 날짜 기준은 자정이에요.</li><li>정원이 먼저 찼거나 일정이 취소되면 입금액 전액을 돌려드려요.</li></ul>
        <h2>문의</h2><p>${esc(SITE.csHours)} · <a class="text-link" href="${esc(SITE.kakaoChannelUrl)}" target="_blank" rel="noopener">카카오톡 채널</a></p>
      </section>` + footer();
  };
  function policyBody(tab) {
    const company = esc(SITE.business.company);
    return tab === 'terms'
      ? `<div class="read policy"><h3>제1조 (목적)</h3><p>이 약관은 ${company}(이하 "회사")가 운영하는 원데이 모임 신청 서비스의 이용 조건을 정합니다.</p><h3>제2조 (신청과 승인)</h3><p>신청은 회원가입 없이 할 수 있으며, 담당 운영자의 검토를 거쳐 승인 여부가 정해집니다. 회사는 모임의 성격에 맞지 않는 신청을 승인하지 않을 수 있습니다.</p><h3>제3조 (입금과 확정)</h3><p>참여 의사를 확인한 뒤 10시간 안에 입금이 확인되어야 참여가 확정됩니다. 기한이 지나면 신청은 자동으로 취소됩니다.</p><h3>제4조 (환불)</h3><p>승인 전 취소는 전액 환불하며, 승인 후에는 각 모임 상세에 표시된 환불 규정을 따릅니다. 정원 초과 입금·일정 취소 등 회사 사유로 참여할 수 없는 경우 전액 환불합니다.</p></div>`
      : `<div class="read policy"><h3>수집 항목</h3><p>이름, 나이, 직업, MBTI(선택), 휴대폰 번호, 신청 이유, 선호 시간대, 유입 경로</p><h3>이용 목적</h3><p>모임 신청 접수와 승인 검토, 참여 확인·입금 안내, 참석 확인, 모임 후 평가 요청</p><h3>제공</h3><p>신청 정보는 해당 모임을 담당하는 운영자에게만 제공됩니다.</p><h3>보관 기간</h3><p>모임 종료 후 5년간 보관한 뒤 파기합니다. 관계 법령에 따라 보관이 필요한 경우 해당 기간을 따릅니다.</p><h3>동의 거부</h3><p>동의를 거부할 수 있으나, 이 경우 신청할 수 없습니다.</p></div>`;
  }
  routes.policy = function (parts) {
    const tab = parts[1] === 'terms' ? 'terms' : 'privacy';
    const title = tab === 'terms' ? '이용약관' : '개인정보처리방침';
    return `<div data-title="${title} — 오늘의 취향"></div>` + topbar({ back: true, title }) + `<section class="pad">${policyBody(tab)}</section>` + footer();
  };

  load();
})();
