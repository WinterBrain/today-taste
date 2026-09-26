/* 평가 페이지 (/review/:token). 참석완료 상태에서 한 번만 제출할 수 있다. */
(function () {
  'use strict';
  const { esc } = TT;
  const token = location.pathname.split('/').pop();
  const box = document.getElementById('box');
  const ITEMS = [['satisfaction', '전체 만족도'], ['progress', '진행'], ['place', '장소'], ['value', '가격 만족'], ['revisit', '다시 참여하고 싶어요']];
  const score = {};

  const stars = (k, label, big) => `<div class="stars${big ? ' is-big' : ''}" role="radiogroup" aria-label="${label}" data-stars="${k}">${[1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" aria-checked="${score[k] === n}" aria-label="${n}점" data-k="${k}" data-n="${n}" class="${score[k] >= n ? 'is-on' : ''}">${UI.icon('star')}</button>`).join('')}</div>`;

  function render(d) {
    box.innerHTML = `<section class="link-body">
      <div class="link-head">${UI.cover(d.cover_url, { name: d.group_name, tag: [...String(d.group_name || '')][0] || '', field: '' }, 'link-thumb', { eager: true })}<div><b>${esc(d.group_name)}</b><span>${TT.fmtDateShort(d.date)} 참여</span></div></div>
      <h1 class="heading">${esc(d.name)}님, 모임은 어떠셨어요?</h1>
      <p class="muted">1분이면 끝나요. 다음 모임을 준비하는 데 큰 도움이 돼요.</p>
      <div class="rate-main"><span>${ITEMS[0][1]}</span>${stars(ITEMS[0][0], ITEMS[0][1], true)}</div>
      <div class="rate-list">${ITEMS.slice(1).map(([k, l]) => `<div class="rate-row"><span>${l}</span>${stars(k, l)}</div>`).join('')}</div>
      <div class="field"><label for="r-text">한 줄 후기</label><textarea id="r-text" class="input" rows="4" maxlength="1000" placeholder="좋았던 점이나 아쉬웠던 점을 자유롭게 적어주세요."></textarea></div>
      <label class="agree"><input type="checkbox" id="r-pub"><span><em>선택</em> 후기를 서비스 소개에 공개해도 좋아요 (이름은 ${esc(TT.maskName(d.name))} 으로 가려져요)</span></label>
      <details class="report"><summary>불편한 일이 있었나요?</summary><label class="agree"><input type="checkbox" id="r-report"><span>운영팀에 따로 알리고 싶어요</span></label><textarea id="r-report-text" class="input" rows="3" maxlength="1000" placeholder="운영팀만 볼 수 있어요."></textarea></details>
      <div class="bottom-bar"><button class="btn btn-primary btn-block" data-submit>후기 보내기</button></div>
    </section>`;
  }

  box.addEventListener('click', async e => {
    const s = e.target.closest('[data-k]');
    if (s) {
      const k = s.dataset.k; score[k] = Number(s.dataset.n);
      const group = box.querySelector(`[data-stars="${k}"]`);
      group.outerHTML = stars(k, group.getAttribute('aria-label'), group.classList.contains('is-big'));
      return;
    }
    const btn = e.target.closest('[data-submit]'); if (!btn) return;
    const missing = ITEMS.find(([k]) => !score[k]);
    if (missing) { UI.toast(`'${missing[1]}' 점수를 골라주세요`); return; }
    btn.disabled = true;
    try {
      await UI.api('/api/public/review/' + token, { method: 'POST', body: JSON.stringify({
        ...score,
        text: document.getElementById('r-text').value,
        publish_ok: document.getElementById('r-pub').checked,
        report: document.getElementById('r-report').checked,
        report_text: document.getElementById('r-report-text').value,
      }) });
      box.innerHTML = `<section class="link-body"><span class="done-mark">${UI.icon('check')}</span><h1 class="heading">소중한 후기 고마워요</h1><p class="muted">다음 모임에서 또 만나요.</p><a class="btn btn-secondary btn-block" href="/">다른 모임 둘러보기</a></section>`;
    } catch (err) { UI.toast(err.message); btn.disabled = false; }
  });

  UI.api('/api/public/review/' + token)
    .then(render)
    .catch(() => { box.innerHTML = `<div class="empty">${UI.icon('info')}<h3>이미 후기를 보냈거나 만료된 링크예요</h3><a class="btn btn-line" href="/">홈으로</a></div>`; });
})();
