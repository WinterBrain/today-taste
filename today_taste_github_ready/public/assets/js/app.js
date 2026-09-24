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
    if (route !== lastRoute) { window.scrollTo(0, 0); lastRoute = route; }
    document.title = document.querySelector('[data-title]')?.dataset.title || '오늘의 취향 — 대구에서 세 명이 만나는 원데이 모임';
    const track = document.querySelector('[data-gallery]'), count = document.querySelector('[data-gallery-count]');
    if (track && count) track.addEventListener('scroll', () => { count.textContent = `${Math.round(track.scrollLeft / track.clientWidth) + 1}/${track.children.length}`; }, { passive: true });
  }

  window.addEventListener('hashchange', () => { UI.closeSheet(); render(); });
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
      : `<a class="wordmark" href="#/" aria-label="오늘의 취향 홈">오늘의 취향<span class="dots"><i></i><i></i><i></i></span></a><span class="region">${esc(SITE.region)}</span>`;
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

  /* ---------- 상세·신청·기타 화면은 아래에 이어서 ---------- */

  load();
})();
