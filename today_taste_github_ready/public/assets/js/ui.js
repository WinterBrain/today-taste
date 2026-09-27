/* DOM 헬퍼. core.js(window.TT) 다음에 로드한다. */
(function () {
  'use strict';
  const { esc } = window.TT;
  const P = {
    back: '<path d="M15 18l-6-6 6-6"/>',
    forward: '<path d="M9 18l6-6-6-6"/>',
    share: '<path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    wallet: '<path d="M20 7H5a2 2 0 0 1 0-4h13v4"/><path d="M3 5v14a2 2 0 0 0 2 2h15V7"/><path d="M16 14h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    close: '<path d="M18 6L6 18M6 6l12 12"/>',
    star: '<path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.5L12 17.3l-5.9 3.2 1.3-6.5-4.9-4.6 6.6-.8z"/>',
    chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.8 8.8 0 0 1-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5z"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
    external: '<path d="M14 3h7v7"/><path d="M10 14L21 3"/><path d="M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  };
  const icon = (name, cls = 'icon') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`;

  // 좌석 점: 채워진 점 = 확정 인원, 빈 점 = 남은 자리
  function seats(info) {
    const dots = Array.from({ length: info.total }, (_, i) => `<i class="${i < info.filled ? 'on' : ''}"></i>`).join('');
    return `<span class="seats${info.last ? ' is-last' : ''}${info.full ? ' is-full' : ''}" aria-label="정원 ${info.total}명 중 ${info.label}">${dots}<b>${info.label}</b></span>`;
  }

  // 사진이 없거나 못 불러오면 분야·태그를 크게 쓴 타이포그래피 커버로 대체한다
  function fallbackCover(group, cls) {
    return `<div class="cover-fallback ${cls || ''}" role="img" aria-label="${esc(group.name)}"><span class="heading">${esc(group.tag || group.field)}</span><small>${esc(group.field)}</small></div>`;
  }
  function cover(url, group, cls = '', { eager = false } = {}) {
    if (!url) return fallbackCover(group, cls);
    return `<img class="${cls}" src="${esc(url)}" alt="${esc(group.name)} 사진" loading="${eager ? 'eager' : 'lazy'}" decoding="async" data-fallback-tag="${esc(group.tag || group.field)}" data-fallback-field="${esc(group.field)}">`;
  }
  document.addEventListener('error', e => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.dataset.fallbackTag) return;
    img.outerHTML = fallbackCover({ name: img.alt, tag: img.dataset.fallbackTag, field: img.dataset.fallbackField }, img.className);
  }, true);

  async function api(url, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    const r = await fetch(url, { ...opts, headers });
    let j = {};
    try { j = await r.json(); } catch (e) {}
    if (!r.ok) { const err = new Error(j.error || '잠시 후 다시 시도해 주세요.'); err.status = r.status; throw err; }
    return j;
  }

  /* 움직임. 효과 자체는 app.css 의 '움직임' 절에 있고, 여기서는 클래스만 붙인다 */
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 요소를 아래에서 올라오며 나타나게 한다. i 는 차례(간격 --stagger), 너무 늦어지지 않게 8에서 멈춘다
  function animateIn(el, i = 0) {
    if (!el) return;
    el.style.setProperty('--i', Math.min(i, 8));
    if (el.classList.contains('enter')) { el.classList.remove('enter'); void el.offsetWidth; }
    el.classList.add('enter');
  }
  // iOS 사파리는 터치 이벤트를 받는 곳이 하나도 없으면 :active(누르는 동안 줄어드는 효과)를 적용하지 않는다
  document.addEventListener('touchstart', () => {}, { passive: true });
  const staggerIn =(selector, root = document) => root.querySelectorAll(selector).forEach((el, i) => animateIn(el, i));
  // 나가는 효과(cls)가 끝난 뒤 지운다. 효과가 꺼져 있거나 끝 이벤트가 오지 않아도 지워지게 시간 제한을 둔다
  function removeAfter(el, cls) {
    if (reducedMotion()) { el.remove(); return; }
    el.classList.add(cls);
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 500);
  }

  function toast(msg) {
    document.querySelector('.toast')?.remove();
    const el = document.createElement('div');
    el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => { if (el.isConnected) removeAfter(el, 'is-leaving'); }, 2200);
  }

  // instant: 다른 시트를 바로 열 때처럼 나가는 효과 없이 지운다
  function closeSheet(instant) {
    document.body.classList.remove('no-scroll');
    document.querySelectorAll('.sheet-back').forEach(back => {
      if (instant === true) back.remove();
      else if (!back.classList.contains('is-closing')) removeAfter(back, 'is-closing');
    });
  }
  function openSheet(title, html) {
    closeSheet(true);
    const back = document.createElement('div');
    back.className = 'sheet-back';
    back.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" data-sheet-close aria-label="닫기">${icon('close')}</button></div><div class="sheet-body">${html}</div></div>`;
    back.addEventListener('click', e => { if (e.target === back || e.target.closest('[data-sheet-close]')) closeSheet(); });
    document.body.appendChild(back);
    document.body.classList.add('no-scroll');
    back.querySelector('[data-sheet-close]').focus();
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
    toast('복사했어요');
  }

  // 링크 페이지 헤더의 로고 자리(data-logo)를 채운다
  document.querySelectorAll("[data-logo]").forEach(el => { el.innerHTML = TT.LOGO_HTML; });
  // 링크 페이지 본문(#box)이 새로 그려질 때마다 항목이 차례로 올라온다(안쪽 일부만 바뀌는 별점·남은 시간은 해당 없음)
  const linkBox = document.getElementById('box');
  if (linkBox) new MutationObserver(() => {
    if (reducedMotion()) return;
    staggerIn('.link-body > :not(.bottom-bar), :scope > .empty', linkBox);
    linkBox.querySelectorAll('.bottom-bar').forEach(b => animateIn(b));
  }).observe(linkBox, { childList: true });

  window.UI = { icon, seats, cover, api, toast, openSheet, closeSheet, copy, reducedMotion, animateIn, staggerIn };
})();
