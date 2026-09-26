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

  function toast(msg) {
    document.querySelector('.toast')?.remove();
    const el = document.createElement('div');
    el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2400);
  }

  function closeSheet() { document.querySelector('.sheet-back')?.remove(); document.body.classList.remove('no-scroll'); }
  function openSheet(title, html) {
    closeSheet();
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

  window.UI = { icon, seats, cover, api, toast, openSheet, closeSheet, copy };
})();
