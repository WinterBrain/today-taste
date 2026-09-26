/* 신청자 앱. 라우트: #/ · #/g/:id · #/g/:id/apply?s= · #/done · #/find · #/guide · #/policy/:tab */
(function () {
  'use strict';
  const { esc, won } = TT;
  const $app = document.getElementById('app');

  const emptyForm = () => ({ name: '', age: '', job: '', mbti: '', phone: '', motivation: '', agreeRequired: false, agreeMarketing: false });
  const S = {
    groups: [], reviews: [], loaded: false, error: '',
    filter: 'all', faqTab: 0,
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
    document.title = document.querySelector('[data-title]')?.dataset.title || '오늘의 취향 — 대구에서 즐기는 소규모 원데이 모임';
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
    const card = '<div><div class="skel" style="aspect-ratio:4/3"></div><div class="skel" style="height:14px;margin-top:var(--sp-10)"></div><div class="skel" style="height:14px;margin-top:var(--sp-6);width:60%"></div></div>';
    return topbar({}) + `<div class="pad"><div class="skel" style="aspect-ratio:16/10"></div></div>
      <div class="section"><div class="skel" style="height:24px;width:40%"></div><div class="grid2" style="margin-top:var(--sp-14)">${card.repeat(4)}</div></div>`;
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
    return `<div class="faq">${items.map(([q, a]) => `<details><summary><span>${esc(q)}</span>${UI.icon('plus', 'icon icon-sm')}</summary><p>${esc(a)}</p></details>`).join('')}</div>`;
  }
  const askChannel = () => `<p class="ask">찾는 답이 없나요? <a class="text-link" href="${esc(SITE.kakaoChannelUrl)}" target="_blank" rel="noopener">카카오톡 채널로 물어보기</a><span>${esc(SITE.csHours)}</span></p>`;

  // [제목, 설명, 걸리는 시간]. 홈 "처음이라면"과 이용 안내에서 같이 쓴다
  const STEPS = [
    ['신청 보내기', '일정을 고르고 이름·나이·신청 이유를 적어요.', '3분'],
    ['운영자 검토', '신청 내용을 확인하고 함께할 참여자 두 분의 자리를 안내해요.', '보통 24시간 안'],
    ['참여 확인', '승인되면 카카오톡으로 링크가 와요. 링크에서 "참여할게요"를 눌러주세요.', '카카오톡'],
    ['입금', '링크에 나온 계좌로 신청자 이름으로 입금해요. 입금이 확인되면 자리가 확정돼요.', '10시간 안'],
    ['모임 당일', '확정 안내에 적힌 장소로 오시면 돼요. 끝나면 후기 링크를 보내드려요.', ''],
  ];
  const stepsList = () => `<ol class="flow">${STEPS.map(([t, d, w]) => `<li><b>${t}</b>${w ? `<span class="when">${w}</span>` : ''}<p>${d}</p></li>`).join('')}</ol>`;
  const PROMISES = [['참여 정원', '2명', '진행자 포함 총 3명'], ['승인 안내', '24시간', '보통 이 안에 알려드려요'], ['입금 전 취소', '0원', '비용 없이 취소돼요']];
  const promiseRow = () => `<dl class="promise">${PROMISES.map(([k, v, d]) => `<div><dt>${k}</dt><dd class="serif num">${v}</dd><dd>${d}</dd></div>`).join('')}</dl>`;

  // 자주 묻는 질문: 주제별로 나눠 칩으로 고른다. 규칙이 바뀌면(나이·기한·환불) 여기도 고친다
  const FAQ = [
    ['신청', [
      ['혼자 신청해도 되나요?', '네, 대부분 혼자 오세요. 진행자 1명과 참여자 2명으로 진행되어 어색하지 않고 편안하게 참여할 수 있어요.\n친구와 함께 오고 싶다면 같은 일정에 각자 신청해 주세요. 승인은 한 사람씩 따로 정해요.'],
      ['누가 신청할 수 있나요?', '만 19~35세면 누구나 신청할 수 있어요. 나이가 이 범위를 벗어나면 신청서가 접수되지 않아요.'],
      ['신청 이유는 뭘 쓰면 되나요?', '거창하지 않아도 괜찮아요. 이 모임이 궁금해진 계기나 해보고 싶은 것을 10자 이상 적어주세요.\n예) "향수를 살 때마다 뭘 골라야 할지 몰라서, 제 취향을 알고 싶어요."'],
      ['승인 결과는 어떻게 알 수 있나요?', '운영자가 보통 24시간 안에 신청서를 확인해요. 승인되면 카카오톡으로 참여 확인 링크를 보내드리고, 이번에 함께하기 어려울 때도 카카오톡으로 알려드려요.'],
    ]],
    ['입금·확정', [
      ['신청하면 바로 확정인가요?', '아니에요. 세 단계를 거쳐 확정돼요.\n1. 운영자가 신청서를 보고 승인해요.\n2. 카카오톡 링크에서 "참여할게요"를 눌러요.\n3. 10시간 안에 입금하면 자리가 확정돼요.'],
      ['입금은 어디로 하나요?', '"참여할게요"를 누르면 같은 화면에 계좌번호와 금액이 나와요. 신청자 이름으로 입금해 주세요. 운영자가 입금을 확인하면 확정 안내를 보내드려요.'],
      ['10시간 안에 입금하지 못하면요?', '신청이 자동으로 취소되고 비용은 들지 않아요. 자리는 다음 신청자에게 넘어가요. 다시 참여하고 싶다면 새로 신청해 주세요.'],
      ['입금했는데 정원이 먼저 찼다면요?', '입금을 확인할 때 자리가 이미 찼다면 입금액을 전액 돌려드려요. 환불 계좌는 카카오톡 채널로 여쭤볼게요.'],
    ]],
    ['취소·환불', [
      ['입금 전에 취소할 수 있나요?', '네, 입금 전에는 비용 없이 취소돼요. 참여 확인 링크에서 "이번엔 참여하지 않을게요"를 누르면 돼요. 승인 전이라면 카카오톡 채널로 알려주세요.'],
      ['입금 후 취소하면 얼마나 돌려받나요?', `모임일 자정을 기준으로 이렇게 돌려드려요.\n${TT.REFUND_RULES.map(r => '· ' + r).join('\n')}\n취소는 카카오톡 채널로 요청해 주세요. 환불은 3영업일 안에 해드려요.`],
      ['모임이 취소되면요?', '호스트 사정 등으로 일정이 취소되면 입금액 전액을 돌려드려요. 취소 소식은 카카오톡으로 먼저 알려드려요.'],
    ]],
    ['모임 당일', [
      ['정확한 장소는 언제 알려주나요?', '자리가 확정되면 확정 안내와 함께 정확한 위치를 보내드려요. 그전에는 모임 소개 화면의 "오시는 길"에서 동네를 확인할 수 있어요.'],
      ['준비물이 있나요?', '모임마다 달라요. 모임 소개 화면의 "준비물"과 "포함 사항"을 확인해 주세요.'],
      ['늦거나 못 가게 되면요?', '늦을 것 같다면 카카오톡 채널로 미리 알려주세요.\n못 가게 됐다면 되도록 빨리 취소해 주세요. 취소 시점에 따라 돌려받는 금액이 달라지고, 연락 없이 오지 않으면 환불되지 않아요.'],
    ]],
  ];
  actions.faqTab = el => { S.faqTab = Number(el.dataset.i); render(); };
  function faqBlock() {
    const i = S.faqTab || 0;
    return `<div class="chips faq-tabs" role="tablist" aria-label="질문 주제">${FAQ.map(([t], n) => `<button class="chip${n === i ? ' is-on' : ''}" role="tab" aria-selected="${n === i}" data-action="faqTab" data-i="${n}">${t}</button>`).join('')}</div>
      <div role="tabpanel">${faqList(FAQ[i][1])}</div>${askChannel()}`;
  }

  /* ---------- 홈 ---------- */

  const FILTERS = [['all', '전체'], ['weekend', '이번 주말'], ['weeknight', '평일 저녁'], ['make', '만들기'], ['learn', '배우기'], ['closing', '마감 임박']];
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
        <div class="banner-copy"><strong>부담 없이 딱 두 시간, 셋이서<br>오늘 새로운 취향을 발견해보세요</strong><span>오늘의 취향은 어떻게 운영되나요 ${UI.icon('forward', 'icon icon-sm')}</span></div>
      </a></div>`;
    h += `<div class="section filters"><div class="chips hscroll" role="tablist" aria-label="모임 필터">${FILTERS.map(([k, l]) => `<button class="chip${S.filter === k ? ' is-on' : ''}" role="tab" aria-selected="${S.filter === k}" data-action="filter" data-key="${k}">${l}</button>`).join('')}</div></div>`;
    h += `<div class="section find-wrap"><a class="find-entry" href="#/find"><div><b>언제 시간 되세요?</b><span>요일과 시간대를 고르면 맞는 모임을 골라드려요</span></div><span class="find-go">시간대 고르기${UI.icon('forward', 'icon icon-sm')}</span></a></div>`;
    // 모집 중인 모임이 모두 이번 주에 열리면 아래 "모든 모임"과 같은 목록이라 생략한다
    if (thisWeek.length && thisWeek.length < openGroups.length && S.filter === 'all') h += `<section class="section">${sectionHead('이번 주 열리는 모임', '7일 안에 열리는 일정이에요')}<div class="hscroll">${thisWeek.map(g => groupCard(g, { wide: true })).join('')}</div></section>`;
    h += `<section class="section">${sectionHead(S.filter === 'all' ? '모든 모임' : filterLabel, `${openGroups.length}개 모임 · ${scheduleCount}개 일정 모집 중`)}`;
    h += list.length
      ? `<div class="grid2">${list.map(g => groupCard(g)).join('')}</div>`
      : `<div class="empty">${UI.icon('calendar')}<h3>조건에 맞는 일정이 없어요</h3><p>다른 조건을 골라보세요.</p><button class="btn btn-line" data-action="filter" data-key="all">전체 보기</button></div>`;
    h += '</section>';
    if (S.reviews.length) h += `<section class="section">${sectionHead('다녀온 분들의 후기', '참여 후 직접 남긴 평가예요')}<div class="hscroll">${S.reviews.map(r => reviewCard(r)).join('')}</div></section>`;
    h += `<section class="section">${sectionHead('처음이라면', '신청부터 모임 당일까지 이렇게 진행돼요')}${promiseRow()}${stepsList()}<a class="more-link" href="#/guide">입금·환불 기준까지 자세히 보기${UI.icon('forward', 'icon icon-sm')}</a></section>`;
    h += `<section class="section">${sectionHead('자주 묻는 질문')}${faqBlock()}</section>`;
    return h + footer();
  };

  /* ---------- 모임 상세 ---------- */

  routes.g = function (parts, query) {
    const g = byId(parts[1]);
    if (!g) return topbar({ back: true }) + `<div class="empty">${UI.icon('info')}<h3>모임을 찾을 수 없어요</h3><p>모집이 끝났거나 주소가 바뀌었어요.</p><a class="btn btn-line" href="#/">홈으로</a></div>`;
    if (parts[2] === 'apply') return renderApply(g, query);
    if (S.sel.groupId !== g.id) { const n = TT.nextSchedule(g); S.sel = { groupId: g.id, date: n ? n.date : null, scheduleId: soleSession(g, n && n.date) }; }
    return renderDetail(g);
  };
  // 고른 날짜에 신청 가능한 회차가 하나뿐이면 바로 선택해 한 번 덜 누르게 한다
  function soleSession(g, date) {
    const open = (g.schedules || []).filter(s => s.date === date && Number(s.remaining) > 0);
    return open.length === 1 ? open[0].id : null;
  }
  actions.pickDate = el => { S.sel.date = el.dataset.date; S.sel.scheduleId = soleSession(byId(S.sel.groupId), S.sel.date); render(); };
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
  const SHEETS = { terms: ['이용약관', 'terms'], privacy: ['개인정보 수집·이용 동의', 'consentPrivacy'], marketing: ['새 모임 소식 수신 동의', 'consentMarketing'] };
  actions.policy = el => { const [title, fn] = SHEETS[el.dataset.tab] || SHEETS.privacy; UI.openSheet(title, POLICY[fn]()); };

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
    // 모임별 규정이 없으면 공통 환불 기준을 보여준다
    const ownRefund = String(g.refund_policy || '').split('\n').map(x => x.trim()).filter(Boolean);
    const refund = ownRefund.length ? ownRefund : TT.REFUND_RULES;
    const schedules = g.schedules || [];
    const sel = schedules.find(s => s.id === S.sel.scheduleId);
    const bands = ['오전', '오후', '저녁'].filter(b => schedules.some(s => TT.band(s.start_time) === b));
    const cap = schedules[0]?.capacity || 2;
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
      <li>${UI.icon('users')}<div><b>참여 정원 ${cap}명 (진행자 포함 총 3명) · 운영자 승인 후 확정</b>${firstOpen ? `<span>${UI.seats(TT.seatInfo(firstOpen.capacity, firstOpen.remaining))} 가장 가까운 일정 기준</span>` : ''}</div></li>
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
    if (g.host_name) h += readSection('호스트', `<div class="host">${g.host_photo_url ? `<img src="${esc(g.host_photo_url)}" alt="" class="host-photo" data-initial="${esc(hostInitial)}">` : `<span class="host-photo initial">${esc(hostInitial)}</span>`}<div><b>${esc(g.host_name)}</b><span>${esc(g.host_role)}</span></div></div>${g.host_bio ? `<p>${esc(g.host_bio)}</p>` : ''}`);
    h += readSection('오시는 길', `<p class="place"><b>대구 중구 ${esc(g.place)}</b>${g.place_note ? `<br>${esc(g.place_note)}` : ''}</p><p class="muted">정확한 위치는 참여 확정 후 안내해요.</p><a class="btn btn-line" href="https://map.kakao.com/?q=${encodeURIComponent('대구 ' + g.place)}" target="_blank" rel="noopener">${UI.icon('external', 'icon icon-sm')}카카오맵에서 보기</a>`);
    h += readSection('환불 규정', `${bulletList(refund)}<p class="muted refund-note">입금 전 취소는 비용이 없어요. 날짜 기준은 모임일 자정이에요. ${ownRefund.length ? '이 규정이 <a class="text-link" href="#/policy/terms">이용약관</a>의 공통 기준보다 불리하면 공통 기준을 따라요.' : ''}</p>`);
    h += readSection('자주 묻는 질문', `${faq.length ? faqList(faq) : ''}<a class="more-link" href="#/guide">신청·입금·환불 질문 더 보기${UI.icon('forward', 'icon icon-sm')}</a>`);
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
      <section class="pad apply-sum">${UI.cover(g.cover_url, g, 'apply-thumb')}<div><b>${esc(g.name)}</b><span>${TT.fmtDateShort(s.date)} ${TT.timeRange(s.start_time, s.end_time)} · ${esc(s.place)}</span><span>참가비 <b class="num">${won(s.fee)}</b> · 승인된 뒤에 입금해요</span></div><a class="text-link" href="#/g/${g.id}">변경</a></section>
      <form class="pad form" data-apply-form novalidate>
        <div class="field"><label for="f-name">이름</label><input id="f-name" class="input" data-bind="name" value="${esc(f.name)}" maxlength="${TT.NAME_MAX}" autocomplete="name" ${inv('name')}>${err('name')}</div>
        <div class="field"><label for="f-age">나이 (만)</label><input id="f-age" class="input num" data-bind="age" value="${esc(f.age)}" inputmode="numeric" maxlength="2" ${inv('age')}>${e.age ? err('age') : '<p class="hint">만 19~35세만 신청할 수 있어요</p>'}</div>
        <div class="field"><span class="label" id="l-job">직업</span><div class="choice-row" role="radiogroup" aria-labelledby="l-job">${JOBS.map(j => `<button type="button" class="choice${f.job === j ? ' is-on' : ''}" role="radio" aria-checked="${f.job === j}" data-action="choose" data-key="job" data-val="${j}">${j}</button>`).join('')}</div>${err('job')}</div>
        <details class="field mbti"${mbti !== '모름' ? ' open' : ''}><summary><span class="label">MBTI <em>선택</em></span><span class="val">${esc(mbti)} ${UI.icon('plus', 'icon icon-sm')}</span></summary><div class="mbti-grid">${[...MBTI, '모름'].map(m => `<button type="button" class="choice${mbti === m ? ' is-on' : ''}" data-action="choose" data-key="mbti" data-val="${m}">${m}</button>`).join('')}</div></details>
        <div class="field"><label for="f-phone">휴대폰 번호</label><input id="f-phone" class="input num" data-bind="phone" value="${esc(f.phone)}" type="tel" inputmode="numeric" autocomplete="tel" placeholder="010-0000-0000" ${inv('phone')}><p class="hint">승인·입금 안내를 카카오톡으로 보내드려요</p>${err('phone')}</div>
        <div class="field"><label for="f-mot">신청 이유</label><textarea id="f-mot" class="input" rows="4" data-bind="motivation" maxlength="300" placeholder="이 모임에서 기대하는 점이나 관심 계기를 적어주세요. 운영자가 승인할 때 참고해요." ${inv('motivation')}>${esc(f.motivation)}</textarea><div class="hint-row"><p class="hint">10자 이상 적어주세요</p><p class="hint num"><span data-counter>${f.motivation.trim().length}</span>/300</p></div>${err('motivation')}</div>
        <div class="notice"><b>신청 후 이렇게 진행돼요</b><ol><li>운영자 검토 (보통 24시간 안)</li><li>카카오톡으로 참여 확인 링크 도착</li><li>참여 확정 후 10시간 안에 입금하면 자리 확정</li></ol></div>
        <div class="agree-group">
          <label class="agree"><input type="checkbox" data-agree="agreeRequired" ${f.agreeRequired ? 'checked' : ''} ${inv('agreeRequired')}><span><em class="req">필수</em> 개인정보 수집·이용 동의</span><button type="button" class="text-link" data-action="policy" data-tab="privacy">보기</button></label>${err('agreeRequired')}
          <label class="agree"><input type="checkbox" data-agree="agreeMarketing" ${f.agreeMarketing ? 'checked' : ''}><span><em>선택</em> 새 모임 소식 받기 (광고성 정보 수신 동의)</span><button type="button" class="text-link" data-action="policy" data-tab="marketing">보기</button></label>
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
        mbti: S.form.mbti === '모름' ? '' : S.form.mbti, phone: S.form.phone, motivation: S.form.motivation.trim(), marketing_ok: S.form.agreeMarketing,
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
        <p>대구 중구의 작은 공방과 카페에서 열리는 원데이 모임이에요. 진행자 한 명과 참여자 두 명, 총 세 명이 한 테이블에 모여요. 소규모로 진행되어 실습에 온전히 집중할 수 있어요.</p>
        <h2>신청부터 모임 당일까지</h2>${stepsList()}
        <h2>입금과 확정</h2><p>참여를 확정하면 참여 확인 페이지에 입금 계좌와 금액이 표시돼요. 10시간 안에 신청자 이름으로 입금해 주세요. 기한이 지나면 자동으로 취소되고 다음 신청자에게 기회가 넘어가요.</p>
        <h2>취소와 환불</h2><p>입금 전에는 언제든 비용 없이 취소할 수 있어요. 정원이 먼저 찼거나 일정이 취소되면 입금액 전액을 돌려드려요. 입금 후 사정이 생겨 취소할 때는 아래 기준을 따르고, 환불은 3영업일 안에 해드려요. 날짜 기준은 모임일 자정이에요.</p>${bulletList(TT.REFUND_RULES)}<p class="muted">자세한 내용은 <a class="text-link" href="#/policy/terms">이용약관</a> 제9·10조에 있어요.</p>
        <h2>자주 묻는 질문</h2>${faqBlock()}
      </section>` + footer();
  };
  // 약관·처리방침 본문은 policy.js(window.POLICY)에 있다
  routes.policy = function (parts) {
    const tab = parts[1] === 'terms' ? 'terms' : 'privacy';
    const title = tab === 'terms' ? '이용약관' : '개인정보처리방침';
    return `<div data-title="${title} — 오늘의 취향"></div>` + topbar({ back: true, title }) + `<section class="pad">${POLICY[tab]()}</section>` + footer();
  };

  load();
})();
