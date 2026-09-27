/* 화면 테마(라이트·다크). <head> 에서 CSS 보다 먼저 불러 첫 화면이 깜빡이지 않게 한다.
   고르지 않았으면 기기 설정을 따르고, 푸터 버튼으로 바꾸면 이 브라우저에 기억한다(localStorage tt_theme). */
(function () {
  'use strict';
  const KEY = 'tt_theme';
  const BG = { light: '#FFFFFF', dark: '#141211' };  // 주소창 색 = tokens.css 의 --bg (바꾸면 같이 고친다)
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  const current = () => root.dataset.theme || (media.matches ? 'dark' : 'light');

  function apply(t) {
    if (t !== 'light' && t !== 'dark') return;
    root.dataset.theme = t;
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => { m.content = BG[t]; });
  }

  // 바꾸는 순간 색이 부드럽게 넘어가도록 잠깐 전환 효과를 켠다(tokens.css .theme-switching)
  function set(next) {
    if (next === current()) return next;
    root.classList.add('theme-switching');
    apply(next);
    try { localStorage.setItem(KEY, next); } catch (e) {}
    setTimeout(() => root.classList.remove('theme-switching'), 400);
    return next;
  }

  apply(saved());
  window.TTTheme = { current, set };
})();
