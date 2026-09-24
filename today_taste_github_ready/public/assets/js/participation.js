/* 참여 확인 페이지 (/participation/:token). 상태: 승인 → 입금대기 → 확정 / 자동취소 / 환불필요 */
(function () {
  'use strict';
  const { esc, won } = TT;
  const token = location.pathname.split('/').pop();
  const box = document.getElementById('box');
  let data = null, timer = null;

  const pseudoGroup = d => ({ name: d.group_name, tag: [...String(d.group_name || '')][0] || '', field: '' });
  const head = d => `<div class="link-head">${UI.cover(d.cover_url, pseudoGroup(d), 'link-thumb', { eager: true })}<div><b>${esc(d.group_name)}</b><span>${TT.fmtDateShort(d.date)} ${TT.timeRange(d.start_time, d.end_time)}</span><span>${esc(d.place)}</span></div></div>`;
  function payBox(d, withCountdown) {
    const p = d.payment;
    const account = p
      ? `<div class="pay-row"><dt>입금 계좌</dt><dd>${esc(p.bank)} <b class="num">${esc(p.account)}</b>${p.holder ? `<br><span>예금주 ${esc(p.holder)}</span>` : ''}</dd></div><button class="btn btn-line btn-block" data-copy="${esc((p.bank + ' ' + p.account).trim())}">${UI.icon('copy', 'icon icon-sm')}계좌번호 복사</button>`
      : '<p class="muted">입금 계좌는 운영자가 카카오톡으로 안내해 드려요.</p>';
    const deadline = withCountdown
      ? `<div class="pay-row"><dt>입금 기한</dt><dd><b class="num countdown" data-countdown>--:--:--</b> 남음<br><span>${d.deadline ? TT.clockLabel(d.deadline) + '까지 · ' : ''}지나면 자동으로 취소돼요</span></dd></div>`
      : '<div class="pay-row"><dt>입금 기한</dt><dd>참여 확정 후 10시간 안</dd></div>';
    return `<dl class="paybox"><div class="pay-row"><dt>입금 금액</dt><dd><b class="num">${won(d.fee)}</b></dd></div>${account}${deadline}<p class="hint">신청자 이름(${esc(d.name)})으로 입금해 주세요.</p></dl>`;
  }
  const contact = () => `<a class="text-link center" href="${esc(SITE.kakaoChannelUrl)}" target="_blank" rel="noopener">${UI.icon('chat', 'icon icon-sm')} 카카오톡 채널로 문의하기</a>`;
  const page = (title, body) => `<section class="link-body">${head(data)}<h1 class="serif">${title}</h1>${body}${contact()}</section>`;

  function render() {
    const d = data;
    clearInterval(timer);
    if (d.status === '승인') {
      box.innerHTML = `<section class="link-body">${head(d)}<h1 class="serif">${esc(d.name)}님, 신청이 승인됐어요</h1>
        <p class="muted">참여할지 알려주세요. 참여를 누르면 아래 계좌로 10시간 안에 입금해 주시면 돼요.</p>${payBox(d, false)}${contact()}
        <div class="bottom-bar stack"><button class="btn btn-primary btn-block" data-act="accept">참여할게요</button><button class="btn btn-secondary btn-block" data-act="decline">이번엔 참여하지 않을게요</button></div></section>`;
    } else if (d.status === '입금대기') {
      d.deadline = d.deadline || TT.deadlineFromSeconds(d.payment_seconds_left);
      box.innerHTML = page('입금을 기다리고 있어요', `<p class="muted">입금이 확인되면 자리가 확정되고 카카오톡으로 알려드려요.</p>${payBox(d, !!d.deadline)}`);
      if (!d.deadline) return;
      const tick = () => {
        const c = TT.countdown(d.deadline, Date.now());
        const el = box.querySelector('[data-countdown]'); if (el) el.textContent = c.text;
        if (c.expired) { clearInterval(timer); data.status = '자동취소'; render(); }
      };
      tick(); timer = setInterval(tick, 1000);
    } else if (['확정', '참석완료', '평가완료'].includes(d.status)) {
      box.innerHTML = page('참여가 확정됐어요', '<p class="muted">모임 전날 정확한 장소를 카카오톡으로 안내해 드려요.</p>');
    } else if (d.status === '자동취소') {
      box.innerHTML = page('입금 기한이 지나 취소됐어요', '<p class="muted">다시 참여하고 싶다면 새로 신청해 주세요.</p><a class="btn btn-secondary btn-block" href="/">다른 일정 보기</a>');
    } else if (d.status === '환불필요') {
      box.innerHTML = page('환불을 준비하고 있어요', '<p class="muted">정원이 먼저 찼거나 일정이 바뀌어 참여할 수 없게 됐어요. 입금액 전액을 돌려드려요.</p>');
    } else {
      box.innerHTML = page('이미 처리된 링크예요', '');
    }
  }

  async function send(accept) {
    box.querySelectorAll('button').forEach(b => { b.disabled = true; });
    try {
      const j = await UI.api('/api/public/participation/' + token, { method: 'POST', body: JSON.stringify({ accept }) });
      if (!accept) {
        clearInterval(timer);
        box.innerHTML = page('참여하지 않기로 했어요', '<p class="muted">다음에 더 잘 맞는 모임에서 만나요.</p><a class="btn btn-secondary btn-block" href="/">다른 모임 보기</a>');
        return;
      }
      Object.assign(data, { status: j.status, payment_seconds_left: j.paymentSecondsLeft, deadline: null, payment: j.payment, fee: j.fee });
      render();
    } catch (err) {
      UI.toast(err.message);
      box.querySelectorAll('button').forEach(b => { b.disabled = false; });
    }
  }

  box.addEventListener('click', e => {
    const c = e.target.closest('[data-copy]'); if (c) { UI.copy(c.dataset.copy); return; }
    const a = e.target.closest('[data-act]'); if (!a) return;
    if (a.dataset.act === 'accept') { send(true); return; }
    UI.openSheet('이번엔 참여하지 않을까요?', '<p class="muted">참여하지 않으면 이 신청은 종료되고 자리는 다음 신청자에게 넘어가요.</p><button class="btn btn-primary btn-block" data-confirm-decline>참여하지 않을게요</button>');
    document.querySelector('[data-confirm-decline]').addEventListener('click', () => { UI.closeSheet(); send(false); });
  });

  UI.api('/api/public/participation/' + token)
    .then(d => { data = d; render(); })
    .catch(() => {
      box.innerHTML = `<div class="empty">${UI.icon('info')}<h3>링크를 확인할 수 없어요</h3><p>이미 처리됐거나 주소가 잘못됐어요.</p><a class="btn btn-line" href="${esc(SITE.kakaoChannelUrl)}" target="_blank" rel="noopener">카카오톡 채널로 문의</a></div>`;
    });
})();
