# 오늘의 취향 프론트엔드·디자인 전면 개편 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 신청자 앱·링크 페이지·운영콘솔을 레퍼런스(문토·남의집) 기반의 실제 운영 서비스 수준으로 재구성하고, 이를 받치는 데이터(사진·추천 대상·포함 사항·호스트 소개·공개 후기·신청 이유·입금 계좌)를 서버에 추가한다.

**Architecture:** Express + SQLite 단일 서버는 유지하고, 컬럼 마이그레이션을 `lib/migrate.js` 한 곳으로 모은 뒤 public API에 통계·공개 후기·입금 정보를 추가한다. 프론트는 빌드 없는 정적 파일을 유지하되 인라인 스크립트를 `public/assets/js/*.js` 로 분리하고, 순수 로직은 Node에서 테스트 가능한 `core.js`(UMD)에, DOM 헬퍼는 `ui.js` 에 둔다. 신청자 앱은 해시 라우터로 바꾼다.

**Tech Stack:** Node.js ≥20, Express 4, better-sqlite3, node:test(내장, 새 의존성 없음), 바닐라 JS, CSS 커스텀 프로퍼티, Pretendard(jsdelivr), Noto Serif KR(Google Fonts).

**Spec:** [docs/design/02-redesign-plan.md](../../design/02-redesign-plan.md) (승인됨) · 근거 [01-reference-analysis.md](../../design/01-reference-analysis.md) · 이미지 [03-image-guide.md](../../design/03-image-guide.md)

## Global Constraints

- 포인트 컬러 `#E4572E` 1색 + 따뜻한 무채색. 그라데이션·유리 효과·색 그림자·알약형 버튼 금지 (spec §2.1, §2.3)
- 본문/UI `Pretendard Variable`, 모임명·상세 섹션 제목·완료 제목만 `Noto Serif KR` (spec §2.2, D3)
- 신청자 앱 최대 폭 480px 가운데 컬럼, 좌우 여백 20px, 폰 목업 프레임 없음 (spec §2.3)
- UI에서 이모지 사용 금지 — 인라인 SVG 아이콘만 (spec §2.4)
- 문구: 해요체, 숫자·사실 우선, 같은 주장은 화면당 1회, 개발·테스트 메모 노출 금지 (spec §2.6)
- 지역: 대구 기반 로컬 서비스로 표기 (D2)
- 신청 이유 필수 10~300자 (D4), 후기는 공개 동의 + 비숨김 + 이름 마스킹 `박**` (D5), 사업자 정보는 `site-config.js` 자리표시 값 (D6)
- 새 npm 의존성 추가 금지. 빌드 도구 도입 금지
- `server.js` 수정은 기존 한 줄 압축 스타일을 따른다. 프론트 JS/CSS는 읽기 쉬운 여러 줄 스타일
- **확인 작업은 항상 임시 DB로** (`DB_PATH` 를 OS 임시 폴더로). `data/today_taste.sqlite` 는 git 추적 대상이며 cron이 매분 상태를 바꾼다
- 모든 상태 변경은 `audit()` 기록 (기존 규칙)
- 범위 밖: 회원가입, 찜 저장, PG, 알림톡 실발송, 지도 임베드, 이미지 업로드, 희망 일정 알림 테이블

## Review Focus

1. **참여 수락 후 링크를 다시 열었을 때** — 신청자는 입금 계좌·금액·남은 시간을 다시 볼 수 있어야 한다(현재는 수락 즉시 토큰이 지워져 "유효하지 않은 링크"가 됨). → Task 4 테스트 `participation link stays viewable after accept`
2. **클라이언트를 우회한 신청 API 호출** — 만 19~35세 밖, `010-0000-0000` 형식이 아닌 번호, 공백뿐인 신청 이유, 지난 일정, 이미 마감된 일정은 서버가 400으로 거절해야 한다. → Task 3 테스트 `rejects invalid applications`
3. **공개 동의하지 않았거나 숨긴 후기** — 어떤 공개 API 응답에도 원문·실명이 나오면 안 된다. → Task 3 테스트 `public reviews respect consent, hidden flag and masking`
4. **새 컬럼이 없는 기존 운영 DB** — 서버 시작만으로 컬럼이 추가되고 기존 데이터가 보존돼야 하며, 값이 빈 모임도 상세 화면이 오류 없이 렌더링돼야 한다. → Task 1 테스트 `migrate upgrades a legacy database`, Task 8 수동 확인 단계
5. **시간대(자정 전후)와 날짜 표시** — `2026-09-28` 같은 날짜 문자열을 UTC로 해석해 요일이 하루 밀리면 안 된다. → Task 6 테스트 `date helpers use local calendar dates`

---

## File Structure

| 파일 | 상태 | 책임 |
|---|---|---|
| `lib/migrate.js` | 신규 | schema.sql 실행 + 컬럼 마이그레이션 목록 단일 관리 |
| `schema.sql` | 수정 | 새 컬럼을 CREATE TABLE에도 반영(신규 DB용) |
| `server.js` | 수정 | migrate 사용, public API 확장, 신청 검증, 참여/평가 링크, 모임체 새 필드, 후기 숨김 |
| `scripts/seed-demo.js` | 수정 | migrate 사용, 5개 모임 상세 콘텐츠·이미지 경로·공개 후기 보강 |
| `.env.example`, `docker-compose.yml` | 수정 | `PAYMENT_BANK/ACCOUNT/HOLDER` |
| `package.json` | 수정 | `"test": "node --test tests/"` |
| `tests/helpers.js` | 신규 | 임시 DB + 시드 + 서버 기동/종료, fetch 헬퍼 |
| `tests/migrate.test.js`, `tests/api-public.test.js`, `tests/api-links.test.js`, `tests/api-admin.test.js`, `tests/core.test.js`, `tests/assets.test.js` | 신규 | |
| `public/assets/css/tokens.css` | 신규 | 컬러·타입·간격 토큰(라이트/다크) + 공통 리셋 |
| `public/assets/css/app.css` | 신규 (style.css 대체·삭제) | 신청자 앱 + 링크 페이지 |
| `public/assets/css/admin.css` | 재작성 | 운영콘솔 |
| `public/assets/js/core.js` | 신규 | 순수 함수(날짜·시간·좌석·검증·라우트 파싱·필터·카운트다운) — UMD, Node 테스트 대상 |
| `public/assets/js/ui.js` | 신규 | DOM 헬퍼(아이콘, 좌석 점, 커버 이미지, api, toast, sheet, copy) |
| `public/assets/js/site-config.js` | 신규 | 상호·사업자 정보·고객센터 채널 |
| `public/assets/js/app.js` | 신규 | 신청자 SPA |
| `public/assets/js/participation.js`, `review.js`, `admin.js` | 신규 | 각 페이지 스크립트 |
| `public/index.html`, `participation.html`, `review.html`, `admin.html` | 재작성 | 껍데기(meta, 폰트, CSS, 스크립트 로드) |
| `public/assets/img/groups/*.jpg`, `public/assets/img/brand/home-banner.jpg`, `public/assets/icons/favicon.svg`, `og.jpg` | 신규 | 에셋 |
| `docs/design/image-credits.md` | 신규 | 스톡 출처 기록 |
| `.agents/AGENTS.md` | 수정 | 마이그레이션 위치·테스트 명령·토큰 정책 변경 반영 |

---

## Task 0: 브랜치 준비

- [ ] **Step 1: 작업 브랜치 생성**

```bash
git checkout -b feat/redesign
git add docs/design docs/superpowers/plans
git commit -m "docs: 레퍼런스 분석·개편 기획·이미지 가이드·구현 계획 추가"
```

---

## Task 1: 테스트 하네스 + 마이그레이션 단일화 + 스키마 확장

**Files:**
- Create: `lib/migrate.js`, `tests/helpers.js`, `tests/migrate.test.js`
- Modify: `schema.sql`, `server.js:29-39`, `scripts/seed-demo.js:13-18`, `package.json`

**Interfaces:**
- Produces: `require('./lib/migrate').migrate(db)` — schema.sql 실행 후 누락 컬럼 추가. `COLUMNS` 객체 export.
- Produces: `tests/helpers.js` — `startServer({seed=true}) → Promise<{base, dbPath, open(), stop()}>`, `api(base, path, {method, body, token}) → Promise<{status, body}>`, `login(base, username, password) → Promise<string token>`

- [ ] **Step 1: 테스트 헬퍼 작성** — `tests/helpers.js`

```js
'use strict';
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');

const ROOT = path.join(__dirname, '..');
const TEST_ENV = { PAYMENT_BANK: '카카오뱅크', PAYMENT_ACCOUNT: '3333-01-2345678', PAYMENT_HOLDER: '오늘의취향' };

async function startServer({ seed = true, env = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-test-'));
  const dbPath = path.join(dir, 'test.sqlite');
  const fullEnv = { ...process.env, ...TEST_ENV, ...env, DB_PATH: dbPath };
  if (seed) execFileSync(process.execPath, ['scripts/seed-demo.js', '--reset'], { cwd: ROOT, env: fullEnv, stdio: 'pipe' });
  const port = 3900 + Math.floor(Math.random() * 900);
  const proc = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...fullEnv, PORT: String(port) }, stdio: 'pipe' });
  let stderr = '';
  proc.stderr.on('data', d => { stderr += d; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(base + '/api/health'); if (r.ok) break; } catch {}
    await new Promise(r => setTimeout(r, 100));
    if (i === 79) throw new Error('server did not start: ' + stderr);
  }
  return {
    base,
    dbPath,
    open: () => new Database(dbPath),
    stop: async () => {
      await new Promise(r => { proc.once('exit', r); proc.kill(); });
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    },
  };
}

async function api(base, p, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(base + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let json = {};
  try { json = await r.json(); } catch {}
  return { status: r.status, body: json };
}

async function login(base, username, password) {
  const r = await api(base, '/api/auth/login', { method: 'POST', body: { username, password } });
  if (r.status !== 200) throw new Error('login failed ' + JSON.stringify(r.body));
  return r.body.token;
}

module.exports = { ROOT, startServer, api, login };
```

- [ ] **Step 2: 실패하는 마이그레이션 테스트 작성** — `tests/migrate.test.js`

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { migrate, COLUMNS } = require('../lib/migrate');

function tmpDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-mig-'));
  return { db: new Database(path.join(dir, 'm.sqlite')), dir };
}

test('migrate creates every declared column on a fresh database', () => {
  const { db, dir } = tmpDb();
  migrate(db);
  for (const [table, cols] of Object.entries(COLUMNS)) {
    const have = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
    for (const [name] of cols) assert.ok(have.includes(name), `${table}.${name}`);
  }
  db.close(); fs.rmSync(dir, { recursive: true, force: true });
});

test('migrate upgrades a legacy database and keeps rows', () => {
  const { db, dir } = tmpDb();
  db.exec(`CREATE TABLE groups (id INTEGER PRIMARY KEY AUTOINCREMENT, field TEXT NOT NULL, tag TEXT NOT NULL DEFAULT '', name TEXT NOT NULL, icon TEXT NOT NULL DEFAULT '', place TEXT NOT NULL DEFAULT '', duration TEXT NOT NULL DEFAULT '', fee INTEGER NOT NULL DEFAULT 0, exposed INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT '운영', tagline TEXT NOT NULL DEFAULT '', intro TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')));
           INSERT INTO groups(field,name) VALUES('만들기','레거시 모임');`);
  migrate(db);
  const g = db.prepare('SELECT * FROM groups').get();
  assert.equal(g.name, '레거시 모임');
  assert.equal(g.cover_url, '');
  assert.equal(g.for_whom_json, '[]');
  db.close(); fs.rmSync(dir, { recursive: true, force: true });
});
```

- [ ] **Step 3: 테스트 스크립트 추가 후 실패 확인**

`package.json` scripts 에 추가: `"test": "node --test tests/"`

Run: `npm test`
Expected: FAIL — `Cannot find module '../lib/migrate'`

- [ ] **Step 4: `lib/migrate.js` 작성**

```js
'use strict';
const fs = require('fs');
const path = require('path');

// 기존 테이블에 추가되는 컬럼은 여기에만 선언한다. server.js 와 scripts/seed-demo.js 가 함께 사용한다.
const COLUMNS = {
  groups: [
    ['host_name', "TEXT NOT NULL DEFAULT ''"], ['host_role', "TEXT NOT NULL DEFAULT ''"],
    ['order_json', "TEXT NOT NULL DEFAULT '[]'"], ['prep_json', "TEXT NOT NULL DEFAULT '[]'"],
    ['refund_policy', "TEXT NOT NULL DEFAULT ''"], ['faq_json', "TEXT NOT NULL DEFAULT '[]'"],
    ['cover_url', "TEXT NOT NULL DEFAULT ''"], ['gallery_json', "TEXT NOT NULL DEFAULT '[]'"],
    ['for_whom_json', "TEXT NOT NULL DEFAULT '[]'"], ['includes_json', "TEXT NOT NULL DEFAULT '[]'"],
    ['fee_note', "TEXT NOT NULL DEFAULT ''"], ['host_bio', "TEXT NOT NULL DEFAULT ''"],
    ['host_photo_url', "TEXT NOT NULL DEFAULT ''"], ['place_note', "TEXT NOT NULL DEFAULT ''"],
  ],
  applications: [['motivation', "TEXT NOT NULL DEFAULT ''"]],
  reviews: [['publish_ok', 'INTEGER NOT NULL DEFAULT 0'], ['hidden', 'INTEGER NOT NULL DEFAULT 0']],
};

function migrate(db) {
  db.exec(fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8'));
  for (const [table, cols] of Object.entries(COLUMNS)) {
    const have = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name));
    for (const [name, def] of cols) if (!have.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${def}`);
  }
}

module.exports = { migrate, COLUMNS };
```

- [ ] **Step 5: `schema.sql` 에 새 컬럼 반영** — `groups` 의 `faq_json` 줄 다음에:

```sql
  cover_url TEXT NOT NULL DEFAULT '',
  gallery_json TEXT NOT NULL DEFAULT '[]',
  for_whom_json TEXT NOT NULL DEFAULT '[]',
  includes_json TEXT NOT NULL DEFAULT '[]',
  fee_note TEXT NOT NULL DEFAULT '',
  host_bio TEXT NOT NULL DEFAULT '',
  host_photo_url TEXT NOT NULL DEFAULT '',
  place_note TEXT NOT NULL DEFAULT '',
```
`applications` 의 `selection_method` 줄 다음에 `  motivation TEXT NOT NULL DEFAULT '',`
`reviews` 의 `report_text` 줄 다음에 `  publish_ok INTEGER NOT NULL DEFAULT 0,` 와 `  hidden INTEGER NOT NULL DEFAULT 0,`

- [ ] **Step 6: server.js·seed-demo.js 가 migrate 사용**

`server.js` 29~39행(`db.exec(fs.readFileSync(...schema.sql...))` 부터 마이그레이션 `for` 루프 끝까지)을 다음으로 교체:

```js
require('./lib/migrate').migrate(db);
```

`scripts/seed-demo.js` 13~18행(`db.exec(...schema.sql...)` 와 `for` 루프)을 다음으로 교체:

```js
require('../lib/migrate').migrate(db);
```

- [ ] **Step 7: 테스트 통과 확인 + 시드·서버 스모크**

Run: `npm test`
Expected: PASS 2 tests

Run (임시 DB): `DB_PATH=$TMP/tt-smoke.sqlite node scripts/seed-demo.js --reset`
Expected: `샘플 데이터 입력 완료`

- [ ] **Step 8: Commit**

```bash
git add lib/migrate.js schema.sql server.js scripts/seed-demo.js package.json tests/helpers.js tests/migrate.test.js
git commit -m "refactor: 컬럼 마이그레이션을 lib/migrate.js로 단일화하고 콘텐츠 컬럼 추가"
```

---

## Task 2: 스톡 이미지 에셋 + 시드 콘텐츠 보강

**Files:**
- Create: `public/assets/img/groups/{perfume,coffee,leather}-{cover,1,2}.jpg`, `public/assets/img/brand/home-banner.jpg`(찾은 경우), `public/assets/icons/favicon.svg`, `public/assets/icons/og.jpg`, `docs/design/image-credits.md`, `tests/assets.test.js`
- Modify: `scripts/seed-demo.js` (groupDefs 상세·detailDefs·과거 일정·공개 후기)

**Interfaces:**
- Consumes: Task 1 컬럼
- Produces: 시드 DB에서 모임체 id 1~5 (향수·드로잉·커피·가죽·필름 순), 노출 4개(필름은 일시중지), 공개 후기 ≥8개, 경로 규칙 `/assets/img/groups/{slug}-cover.jpg`, `/assets/img/groups/{slug}-{n}.jpg`

- [ ] **Step 1: 실패하는 에셋 테스트** — `tests/assets.test.js`

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startServer, ROOT } = require('./helpers');

test('every seeded image path exists under public/', async () => {
  const s = await startServer();
  try {
    const db = s.open();
    const rows = db.prepare('SELECT name,cover_url,gallery_json,host_photo_url FROM groups').all();
    db.close();
    const urls = rows.flatMap(g => [g.cover_url, g.host_photo_url, ...JSON.parse(g.gallery_json)]).filter(Boolean);
    assert.ok(urls.length >= 9, 'at least 9 seeded images');
    for (const u of urls) assert.ok(fs.existsSync(path.join(ROOT, 'public', u)), 'missing ' + u);
  } finally { await s.stop(); }
});

test('seed provides rich content and public reviews', async () => {
  const s = await startServer();
  try {
    const db = s.open();
    const g = db.prepare("SELECT * FROM groups WHERE tag='향수'").get();
    assert.ok(JSON.parse(g.for_whom_json).length >= 3);
    assert.ok(JSON.parse(g.includes_json).length >= 2);
    assert.ok(g.host_bio.length > 40 && g.place_note && g.fee_note);
    assert.match(JSON.parse(g.order_json)[0], /^\d+분\|/);
    const pub = db.prepare('SELECT COUNT(*) c FROM reviews WHERE publish_ok=1').get().c;
    assert.ok(pub >= 8, 'public reviews ' + pub);
    db.close();
  } finally { await s.stop(); }
});
```

Run: `npm test` → Expected: FAIL (`at least 9 seeded images`)

- [ ] **Step 2: 스톡 사진 내려받기** (스크래치 스크립트, 저장소에 넣지 않음)

스크래치 폴더에 `fetch-stock.js` 작성:

```js
// usage: node fetch-stock.js <outDir>
const fs = require('fs'); const path = require('path');
const out = process.argv[2];
const list = [
  ['groups/perfume-cover.jpg', '-eOwKJhd6k8', 1600, 1200],
  ['groups/perfume-1.jpg', '-j6LLsAehUo', 1600, 1200],
  ['groups/perfume-2.jpg', '-JxrCmKGOAw', 1200, 1200],
  ['groups/coffee-cover.jpg', 'F0XGFD9Z1Uk', 1600, 1200],
  ['groups/coffee-1.jpg', 'pp8qhUH3znQ', 1600, 1200],
  ['groups/coffee-2.jpg', '5R2jbsSOeXM', 1200, 1200],
  ['groups/leather-cover.jpg', 'GPdWubhjq-Q', 1600, 1200],
  ['groups/leather-1.jpg', 'an44PeEll_w', 1600, 1200],
  ['groups/leather-2.jpg', 'Ff-5OCJ341g', 1200, 1200],
  ['../icons/og.jpg', 'F0XGFD9Z1Uk', 1200, 630],
];
(async () => {
  for (const [file, id, w, h] of list) {
    const r = await fetch(`https://unsplash.com/photos/${id}/download?force=true`, { redirect: 'manual' });
    const loc = r.headers.get('location');
    if (!loc) { console.error('no redirect for', id, r.status); continue; }
    const u = new URL(loc);
    u.search = `?w=${w}&h=${h}&fit=crop&crop=entropy&q=78&fm=jpg`;
    const img = await fetch(u); const buf = Buffer.from(await img.arrayBuffer());
    const dest = path.join(out, file); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, buf);
    console.log(file, id, Math.round(buf.length / 1024) + 'KB', u.origin + u.pathname);
  }
})();
```

Run: `node <scratch>/fetch-stock.js public/assets/img`
Expected: 10줄 출력, 각 파일 400KB 이하.

- [ ] **Step 3: 육안 검수** — Read 도구로 각 jpg를 열어 03 문서 §1.1 기준(얼굴 정면 없음, 글자·로고 없음, 따뜻한 톤) 확인. 탈락 시 03 문서 §3 의 같은 검색어로 Unsplash를 브라우저에서 다시 찾아 ID 교체 후 Step 2 재실행. **파일명은 슬롯 기준이므로 ID를 바꿔도 코드는 바뀌지 않는다.**

- [ ] **Step 4: 홈 배너 스톡 탐색** — 브라우저로 `https://unsplash.com/s/photos/cafe-window-table?license=free` 를 열어 사람 없는 작은 테이블 + 창가 빛 사진을 찾으면 `brand/home-banner.jpg` (1600×1000) 로 저장. 적합한 사진이 없으면 저장하지 않는다(홈 배너는 이미지 없는 대체 레이아웃을 지원 — Task 7).

- [ ] **Step 5: 파비콘 작성** — `public/assets/icons/favicon.svg`

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#1B1918"/>
  <circle cx="18" cy="34" r="6.5" fill="#E4572E"/>
  <circle cx="32" cy="34" r="6.5" fill="#F3EFEC"/>
  <circle cx="46" cy="34" r="6.5" fill="#F3EFEC" fill-opacity=".35"/>
</svg>
```

- [ ] **Step 6: 출처 기록** — `docs/design/image-credits.md`

```markdown
# 이미지 출처

모든 스톡 사진은 Unsplash License(https://unsplash.com/license)로 사용한다. 원본은 `https://unsplash.com/photos/{ID}`.

| 파일 | Unsplash ID | 비고 |
|---|---|---|
| img/groups/perfume-cover.jpg | -eOwKJhd6k8 | |
| img/groups/perfume-1.jpg | -j6LLsAehUo | |
| img/groups/perfume-2.jpg | -JxrCmKGOAw | |
| img/groups/coffee-cover.jpg | F0XGFD9Z1Uk | og.jpg 도 같은 사진 |
| img/groups/coffee-1.jpg | pp8qhUH3znQ | |
| img/groups/coffee-2.jpg | 5R2jbsSOeXM | |
| img/groups/leather-cover.jpg | GPdWubhjq-Q | |
| img/groups/leather-1.jpg | an44PeEll_w | |
| img/groups/leather-2.jpg | Ff-5OCJ341g | |

AI 생성 예정 슬롯(드로잉·필름 커버, 호스트 사진, 홈 배너)은 03-image-guide.md §4 참고. 생성 후 이 표에 추가한다.
```
(Step 3·4에서 ID를 바꿨다면 표도 맞춰 수정)

- [ ] **Step 7: 시드 콘텐츠 교체** — `scripts/seed-demo.js`

`groupDefs` 의 intro(11번째 값)를 문단형으로 교체:

```js
    ['만들기','향수','나만의 시그니처 향수 만들기','🧴','동성로','2시간',39000,1,'운영','좋아하는 향을 조합해 한 병의 취향을 완성해요.','향수를 고를 때마다 "좋은데 왜 좋은지 모르겠다"는 생각이 들었다면, 이 모임에서 그 이유를 찾아봐요.\n\n시트러스·플로럴·우디·머스크처럼 향의 계열을 먼저 가볍게 익히고, 원료 20여 종을 직접 맡아보며 내가 끌리는 향을 골라요. 마음에 드는 원료가 정해지면 비율을 바꿔가며 블렌딩해 30ml 한 병을 완성합니다.\n\n세 명이 한 테이블에 앉아 서로의 향을 맡아보는 시간이 가장 즐거운 순간이에요. 향을 잘 몰라도 괜찮아요.'],
    ['배우기','드로잉','카페에서 시작하는 펜 드로잉','✏️','삼덕동','1시간 50분',32000,1,'운영','그림을 못 그려도 괜찮은 한 장 드로잉.','"그림은 학교 이후로 처음"인 분들이 가장 많이 오는 모임이에요.\n\n지우개 없이 펜 한 자루로 선을 긋는 연습부터 시작해요. 컵이나 화분 같은 작은 사물을 그려보고, 마지막에는 카페의 한 구석을 한 장에 담습니다. 잘 그리는 것보다 오래 보는 법을 배우는 시간이에요.\n\n완성한 드로잉북은 가져가서 여행이나 일상에서 계속 채워보세요.'],
    ['배우기','커피','원두 취향 찾기 & 핸드드립','☕','교동','2시간',41000,1,'운영','산미와 고소함, 내 커피 취향을 직접 찾아봐요.','카페에서 "산미 있는 걸로 주세요"라고 말하지만 정확히 어떤 맛인지 설명하기 어렵다면 이 모임이 맞아요.\n\n산지가 다른 원두 세 가지를 나란히 맛보며 산미·단맛·바디감을 비교하고, 분쇄도와 물 온도를 바꿔 같은 원두가 어떻게 달라지는지 직접 확인해요. 마지막엔 각자 핸드드립으로 한 잔을 완성합니다.\n\n마음에 든 원두 100g을 가져가 집에서도 같은 레시피로 내려볼 수 있어요.'],
    ['만들기','가죽공예','가죽 키링과 카드태그 만들기','🧷','봉산동','2시간 20분',46000,1,'운영','색을 고르고 직접 각인하는 작은 가죽 소품.','매일 들고 다니는 물건 하나쯤은 직접 만든 것이면 좋겠다는 생각으로 시작한 모임이에요.\n\n미리 재단해 둔 베지터블 가죽 중에서 색을 고르고, 실 색과 이니셜 각인 위치를 정해요. 구멍을 뚫고 두 개의 바늘로 한 땀씩 꿰매는 새들 스티치를 배워 키링과 카드태그를 완성합니다.\n\n손바느질이 처음이어도 최대 세 명이라 단계마다 옆에서 도와드려요.'],
    ['배우기','사진','필름카메라 골목 산책','📷','김광석길','2시간 30분',35000,0,'일시중지','한 롤을 천천히 채우며 동네를 다르게 보는 시간.','필름카메라 기본 조작을 배우고 김광석길 골목을 걸으며 빛과 구도를 연습해요. 한 롤을 천천히 채우다 보면 익숙한 동네가 다르게 보여요. 현재 다음 일정 준비로 모집을 잠시 쉬고 있어요.']
```

`detailDefs` 와 `updDetail` 을 새 필드까지 포함하도록 교체:

```js
  const detailDefs = [
    { host:['무드랩 · 윤가람','조향 클래스 5년'],
      bio:'향수 브랜드 연구실에서 5년간 일하다 동성로에 작은 조향 공방을 열었어요. 비싼 원료보다 "내가 왜 이 향을 좋아하는지" 알아가는 과정을 더 중요하게 생각해요. 세 명이 한 테이블에 앉으면 서로의 향을 맡아보며 이야기가 자연스럽게 이어져요.',
      order:['20분|향의 계열과 노트 구조 알아보기','30분|원료 20여 종 시향하고 고르기','50분|나만의 비율로 블렌딩하기','20분|라벨 작성·포장하고 서로의 향 맡아보기'],
      prep:['향수 시향이 편한 복장','향료 알레르기가 있다면 신청 이유에 적어주세요'],
      forWhom:['향수는 좋아하지만 어떤 계열이 나에게 맞는지 모르는 분','선물용이 아니라 나를 위한 향을 갖고 싶은 분','퇴근 후 조용히 몰입할 두 시간이 필요한 분'],
      includes:['원료 20여 종 시향','30ml 향수 1병 (공병·라벨 포함)','나만의 배합표 카드'],
      feeNote:'재료비·30ml 공병 포함',
      placeNote:'동성로 무드랩 2층 · 건물 주차 불가 · 중앙로역 3번 출구 도보 4분',
      refund:'모임 4일 전까지: 전액 환불\n모임 3일 전~1일 전: 50% 환불 (원료 준비 비용)\n모임 당일·불참: 환불 불가',
      faq:[['향을 잘 몰라도 되나요?','처음인 분 기준으로 계열 설명부터 천천히 진행해요.'],['완성품은 가져가나요?','30ml 향수 한 병을 당일 포장해서 가져가요.'],['혼자 신청해도 되나요?','대부분 혼자 오세요. 최대 세 명이라 금방 대화가 시작돼요.']],
      cover:'/assets/img/groups/perfume-cover.jpg', gallery:['/assets/img/groups/perfume-1.jpg','/assets/img/groups/perfume-2.jpg'] },
    { host:['페이지카페 · 오하린','드로잉 클래스 4년'],
      bio:'삼덕동에서 작은 카페를 하며 손님들 모습을 드로잉북에 기록해 왔어요. 그림은 잘 그리는 것보다 오래 보는 게 먼저라고 생각해요. 펜 한 자루만 있으면 어디서든 시작할 수 있다는 걸 알려드리고 싶어요.',
      order:['20분|펜 잡는 법과 선 긋기','30분|컵·화분 같은 작은 사물 스케치','50분|카페 한 구석을 한 장에 담기','10분|서로의 그림 보며 이야기'],
      prep:['없어요 (도구 모두 제공)'],
      forWhom:['그림은 학창 시절 이후로 처음인 분','여행이나 일상을 사진 말고 다른 방식으로 기록하고 싶은 분','잘하는 것보다 꾸준히 하는 취미를 찾는 분'],
      includes:['0.3mm·0.5mm 드로잉 펜 2자루','A5 드로잉북 (가져가요)','음료 1잔'],
      feeNote:'펜·드로잉북·음료 1잔 포함',
      placeNote:'삼덕동 페이지카페 창가 테이블 · 주차 불가',
      refund:'모임 3일 전까지: 전액 환불\n모임 2일 전~당일: 환불 불가',
      faq:[['그림을 못 그려도 되나요?','선 긋기부터 시작하는 초보자 과정이에요.'],['개인 도구를 가져가도 되나요?','물론이에요. 쓰던 펜이 있다면 함께 가져오세요.']],
      cover:'', gallery:[] },
    { host:['로스터리 소담 · 김현우','바리스타 7년'],
      bio:'교동 골목에서 작은 로스터리를 운영해요. 손님마다 "산미"라는 말을 다르게 쓰는 게 재미있어서 이 모임을 열었어요. 정답 대신 내 입에 맞는 기준을 찾아가는 시간이 되면 좋겠어요.',
      order:['20분|세 가지 원두 향 맡고 맛 비교','30분|분쇄도·물 온도에 따라 달라지는 맛','50분|직접 핸드드립 3회 실습','20분|나만의 레시피 카드 정리'],
      prep:['카페인에 민감하다면 신청 이유에 적어주세요 (디카페인 준비)'],
      forWhom:['카페에서 늘 같은 메뉴만 고르게 되는 분','집에서 핸드드립을 시작해 보고 싶은 분','산미·바디감 같은 말을 직접 맛으로 확인하고 싶은 분'],
      includes:['원두 3종 시음','직접 내린 핸드드립 커피','마음에 든 원두 100g','레시피 카드'],
      feeNote:'원두 100g·시음 포함',
      placeNote:'교동 로스터리 소담 1층 · 주차 1대 가능 (신청 이유에 미리 적어주세요) · 대구역 도보 7분',
      refund:'모임 3일 전까지: 전액 환불\n모임 2일 전~당일: 환불 불가',
      faq:[['디카페인도 가능한가요?','미리 알려주시면 디카페인 원두로 준비해요.'],['도구를 사야 하나요?','모든 도구는 현장에 준비되어 있어요.']],
      cover:'/assets/img/groups/coffee-cover.jpg', gallery:['/assets/img/groups/coffee-1.jpg','/assets/img/groups/coffee-2.jpg'] },
    { host:['스튜디오 결 · 서지민','가죽공예 6년'],
      bio:'봉산문화거리에서 가죽 소품을 만들고 있어요. 기계 박음질보다 느리지만 오래가는 손바느질을 좋아해요. 처음 바늘을 잡는 분도 두 시간이면 매일 쓰는 물건 하나를 완성할 수 있어요.',
      order:['15분|가죽과 도구 소개','25분|가죽·실 색 고르고 각인 위치 정하기','80분|새들 스티치로 키링·카드태그 만들기','20분|모서리 마감과 포장'],
      prep:['없어요 (재료·도구 모두 제공)'],
      forWhom:['손으로 무언가를 끝까지 완성해 보고 싶은 분','선물할 작은 소품을 직접 만들고 싶은 분','조용히 집중하는 시간을 좋아하는 분'],
      includes:['베지터블 가죽 키링·카드태그 1세트','이니셜 각인','포장 파우치'],
      feeNote:'가죽·도구·각인·포장 포함',
      placeNote:'봉산동 스튜디오 결 3층 · 엘리베이터 없음 · 봉산문화거리 안',
      refund:'모임 4일 전까지: 전액 환불\n모임 3일 전~1일 전: 50% 환불 (가죽 재단 비용)\n모임 당일·불참: 환불 불가',
      faq:[['손바느질이 처음인데 괜찮나요?','최대 세 명이라 단계마다 옆에서 도와드려요.'],['각인 글자는 몇 자까지 되나요?','영문 이니셜 3자까지 가능해요.']],
      cover:'/assets/img/groups/leather-cover.jpg', gallery:['/assets/img/groups/leather-1.jpg','/assets/img/groups/leather-2.jpg'] },
    { host:['필름워크 · 한도윤','필름사진 워크숍 5년'],
      bio:'김광석길 근처에서 필름 현상소를 겸한 작은 작업실을 운영해요. 한 롤에 36장뿐이라 한 장 한 장 오래 고민하게 되는 게 필름의 매력이에요.',
      order:['20분|카메라 조작과 노출 기본','20분|빛과 구도 이야기','90분|김광석길 골목 촬영 산책','20분|카페에서 한 롤 정리하며 이야기'],
      prep:['편한 신발','개인 필름카메라가 있으면 지참'],
      forWhom:['휴대폰 말고 다른 카메라로 찍어보고 싶은 분','천천히 걷는 산책을 좋아하는 분'],
      includes:['필름카메라 대여','컬러 필름 1롤','현상·스캔 (1주 후 파일 전송)'],
      feeNote:'카메라 대여·필름·현상 포함',
      placeNote:'김광석길 입구 집결 · 우천 시 일정 변경',
      refund:'모임 3일 전까지: 전액 환불\n모임 2일 전~당일: 환불 불가',
      faq:[['카메라가 없어도 되나요?','대여 장비가 준비되어 있어요.']],
      cover:'', gallery:[] },
  ];
  const updDetail=db.prepare('UPDATE groups SET host_name=?,host_role=?,host_bio=?,order_json=?,prep_json=?,for_whom_json=?,includes_json=?,fee_note=?,place_note=?,refund_policy=?,faq_json=?,cover_url=?,gallery_json=? WHERE id=?');
  detailDefs.forEach((d,i)=>updDetail.run(d.host[0],d.host[1],d.bio,json(d.order),json(d.prep),json(d.forWhom),json(d.includes),d.feeNote,d.placeNote,d.refund,json(d.faq),d.cover,json(d.gallery),gids[i]));
```

- [ ] **Step 8: 과거 일정·공개 후기 추가** — `schedules` 정의(`addS('perfumePast'...)`) 뒤에 추가:

```js
  addS('coffeePast1',gids[2],-13,'19:30','21:30','교동 로스터리 소담',41000,1,0);
  addS('coffeePast2',gids[2],-20,'14:00','16:00','교동 로스터리 소담',41000,1,0);
  addS('leatherPast',gids[3],-16,'18:30','20:50','봉산동 스튜디오 결',46000,1,0);
  addS('drawingPast',gids[1],-18,'15:00','16:50','삼덕동 페이지카페',32000,1,0);
```

기존 `insReview` 선언을 `publish_ok` 포함으로 교체하고, 기존 두 건은 공개로, 새 후기 추가:

```js
  const insReview = db.prepare(`INSERT INTO reviews(application_id,satisfaction,revisit,progress,place,value,text,report,report_text,publish_ok,submitted_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`);
  insReview.run(a10,5,5,4,4,5,'카메라를 거의 처음 써봤는데 설명이 쉬웠고 산책 코스도 좋았어요.',0,'',1,sqlDateTime(-6,20,15));
  insReview.run(a13,4,4,5,5,4,'향을 여러 번 비교해볼 수 있어서 좋았어요. 선택 시간이 조금 더 길면 좋겠습니다.',0,'',1,sqlDateTime(-9,18,40));
  const past = (gid,sid,off,rows) => rows.forEach(([name,age,job,mbti,phone,scores,text,pub]) => {
    const id = addA(gid,sid,name,age,job,mbti,phone,'인스타그램',['평일 저녁'],'직접','평가완료',sqlDateTime(off-3,12,0),{approved_at:sqlDateTime(off-2,10,0),participation_confirmed_at:sqlDateTime(off-2,10,30),paid_at:sqlDateTime(off-2,13,0),attendance:'참석'});
    insReview.run(id,...scores,text,0,'',pub,sqlDateTime(off,21,40));
  });
  past(gids[2],schedules.coffeePast1,-13,[
    ['이수빈',26,'직장인','INFP','010-3321-4410',[5,5,5,4,5],'같은 원두인데 물 온도만 바꿨을 뿐인데 맛이 완전히 달라서 놀랐어요. 집에서 내려 마실 자신감이 생겼습니다.',1],
    ['조현준',30,'직장인','ISTJ','010-7710-2285',[5,4,5,5,4],'세 명이라 질문을 편하게 할 수 있었어요. 원두 100g 챙겨주신 것도 좋았습니다.',1]]);
  past(gids[2],schedules.coffeePast2,-20,[
    ['한예린',24,'대학생','ENFJ','010-5540-1937',[4,4,4,5,4],'산미를 싫어하는 줄 알았는데 제가 싫어했던 건 신맛이 아니라 떫은맛이었더라고요.',1],
    ['김태오',29,'직장인','INTP','010-6612-8804',[5,5,4,4,5],'',0]]);
  past(gids[3],schedules.leatherPast,-16,[
    ['박소율',27,'직장인','ISFP','010-2287-5519',[5,5,5,5,4],'바느질이 이렇게 차분해지는 일인 줄 몰랐어요. 키링은 매일 들고 다녀요.',1],
    ['윤지호',31,'직장인','ESTP','010-9031-6627',[5,4,5,4,4],'각인 위치까지 같이 고민해 주셔서 선물용으로 딱 좋았습니다.',1]]);
  past(gids[1],schedules.drawingPast,-18,[
    ['정다은',23,'대학생','INFJ','010-4478-2016',[5,5,4,5,5],'그림을 못 그린다고 생각했는데 한 장을 끝까지 완성했어요. 드로잉북은 계속 채우는 중이에요.',1],
    ['최민호',28,'직장인','ENTP','010-8124-3350',[4,4,4,5,4],'창가 자리에서 그리는 시간이 좋았어요. 조금 더 길었으면 싶을 정도.',1]]);
  past(gids[0],schedules.perfumePast,-9,[
    ['강하늘',25,'직장인','ENFP','010-3905-7741',[5,5,5,4,4],'제가 우디 계열을 좋아하는 이유를 처음 알았어요. 향수 이름을 직접 붙이는 것도 즐거웠습니다.',1]]);
```

마지막 요약 로그를 `console.log(\`모임체 ${result.groupIds.length}개, 과거 모임 후기 포함 데모 데이터\`);` 로 교체.

(주의: 새로 추가한 전화번호는 기존 번호와 겹치지 않고, `UNIQUE(schedule_id, phone)` 제약을 지킨다.)

- [ ] **Step 9: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (migrate 2 + assets 2)

- [ ] **Step 10: Commit**

```bash
git add public/assets/img public/assets/icons docs/design/image-credits.md scripts/seed-demo.js tests/assets.test.js
git commit -m "feat: 스톡 이미지 에셋과 모임 상세 콘텐츠·공개 후기 시드 추가"
```

---

## Task 3: 공개 API — 통계·공개 후기·신청 검증

**Files:**
- Modify: `server.js` (`/api/public/groups`, `/api/public/applications`, 헬퍼 영역 47~52행 근처)
- Create: `tests/api-public.test.js`

**Interfaces:**
- Produces (응답 형태, 이후 프론트가 사용):
  - `GET /api/public/groups` → `{ groups: Group[], reviews: PublicReview[] }`
  - `Group` = 기존 groups 행 전체 + `schedules: Schedule[]`(기존, `remaining` 포함) + `stats: {sessions_done:number, participants:number, rating_avg:number|null, review_count:number}` + `reviews: PublicReview[]`(최대 5)
  - `PublicReview` = `{ id, group_id, group_name, name_masked, rating, progress, place, value, text, date, submitted_at }`
  - `POST /api/public/applications` body에 `motivation:string` 필수

- [ ] **Step 1: 실패하는 테스트** — `tests/api-public.test.js`

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api } = require('./helpers');

let s;
test.before(async () => { s = await startServer(); });
test.after(async () => { await s.stop(); });

const validBody = (schedule_id, phone = '010-1111-2222') => ({
  schedule_id, name: '테스트', age: 27, job: '직장인', mbti: '', phone,
  motivation: '향을 직접 조합해 보고 싶어서 신청했어요.', preferred_times: ['토|오후'], selection_method: '직접',
});

test('groups include stats and masked public reviews', async () => {
  const r = await api(s.base, '/api/public/groups');
  assert.equal(r.status, 200);
  const coffee = r.body.groups.find(g => g.tag === '커피');
  assert.equal(coffee.stats.sessions_done, 2);
  assert.equal(coffee.stats.participants, 4);
  assert.equal(coffee.stats.review_count, 3);
  assert.equal(typeof coffee.stats.rating_avg, 'number');
  assert.ok(coffee.reviews.length >= 1);
  assert.match(coffee.reviews[0].name_masked, /^.\*+$/);
  assert.ok(r.body.reviews.length >= 6);
});

test('public reviews respect consent, hidden flag and masking', async () => {
  const db = s.open();
  db.prepare("UPDATE reviews SET hidden=1 WHERE text LIKE '같은 원두인데%'").run();
  db.close();
  const r = await api(s.base, '/api/public/groups');
  const all = JSON.stringify(r.body);
  assert.ok(!all.includes('같은 원두인데'), 'hidden review leaked');
  assert.ok(!all.includes('김태오'), 'real name leaked');
  assert.ok(!all.includes('이수빈'), 'real name leaked');
  const coffee = r.body.groups.find(g => g.tag === '커피');
  assert.equal(coffee.stats.review_count, 2);
});

test('valid application is accepted with motivation stored', async () => {
  const g = (await api(s.base, '/api/public/groups')).body.groups.find(x => x.tag === '향수');
  const sched = g.schedules.find(x => x.remaining > 0);
  const r = await api(s.base, '/api/public/applications', { method: 'POST', body: validBody(sched.id, '010-9999-0001') });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const db = s.open();
  assert.equal(db.prepare('SELECT motivation FROM applications WHERE id=?').get(r.body.id).motivation, '향을 직접 조합해 보고 싶어서 신청했어요.');
  db.close();
});

test('rejects invalid applications', async () => {
  const g = (await api(s.base, '/api/public/groups')).body.groups.find(x => x.tag === '향수');
  const sid = g.schedules[0].id;
  const cases = [
    [{ age: 18 }, /19~35/], [{ age: 36 }, /19~35/], [{ phone: '01012345678' }, /휴대폰/],
    [{ motivation: '          ' }, /신청 이유/], [{ motivation: '짧아요' }, /신청 이유/], [{ motivation: 'a'.repeat(301) }, /신청 이유/],
  ];
  for (const [patch, msg] of cases) {
    const r = await api(s.base, '/api/public/applications', { method: 'POST', body: { ...validBody(sid, '010-9999-0002'), ...patch } });
    assert.equal(r.status, 400, JSON.stringify(patch));
    assert.match(r.body.error, msg);
  }
  const db = s.open();
  const past = db.prepare("SELECT id FROM schedules WHERE date < date('now','localtime') LIMIT 1").get();
  const full = db.prepare("INSERT INTO schedules(group_id,date,start_time,end_time,place,capacity,fee) VALUES(1,date('now','localtime','+3 day'),'10:00','12:00','테스트',1,1000)").run().lastInsertRowid;
  db.prepare("INSERT INTO applications(group_id,schedule_id,name,age,job,phone,status) VALUES(1,?,'만석',25,'직장인','010-9999-0003','확정')").run(full);
  db.close();
  let r = await api(s.base, '/api/public/applications', { method: 'POST', body: validBody(past.id, '010-9999-0004') });
  assert.equal(r.status, 400); assert.match(r.body.error, /신청할 수 없는 일정/);
  r = await api(s.base, '/api/public/applications', { method: 'POST', body: validBody(full, '010-9999-0005') });
  assert.equal(r.status, 400); assert.match(r.body.error, /마감/);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/api-public.test.js`
Expected: FAIL (`stats` undefined)

- [ ] **Step 3: 헬퍼 추가** — `server.js` 의 `notify` 정의 다음 줄에:

```js
const maskName = n => { const c=[...String(n||'').trim()]; return c.length?c[0]+'*'.repeat(Math.max(1,c.length-1)):'익명'; };
const PUBLIC_REVIEW_WHERE = "r.publish_ok=1 AND r.hidden=0 AND trim(r.text)<>''";
const publicReviews = (extraWhere,params,limit) => db.prepare(`SELECT r.id,r.satisfaction rating,r.progress,r.place,r.value,r.text,r.submitted_at,a.name,a.group_id,g.name group_name,s.date FROM reviews r JOIN applications a ON a.id=r.application_id JOIN groups g ON g.id=a.group_id JOIN schedules s ON s.id=a.schedule_id WHERE ${PUBLIC_REVIEW_WHERE} AND g.exposed=1 AND g.status='운영' ${extraWhere} ORDER BY r.submitted_at DESC,r.id DESC LIMIT ${Number(limit)}`).all(...params).map(({name,...r})=>({...r,name_masked:maskName(name)}));
```

- [ ] **Step 4: `/api/public/groups` 교체**

```js
app.get('/api/public/groups',(req,res)=>{
  const groups=db.prepare("SELECT * FROM groups WHERE exposed=1 AND status='운영' ORDER BY id DESC").all();
  const sched=db.prepare("SELECT s.*, (SELECT COUNT(*) FROM applications a WHERE a.schedule_id=s.id AND a.status IN ('확정','참석완료','평가완료')) confirmed FROM schedules s WHERE s.cancelled=0 AND date(s.date)>=date('now','localtime') ORDER BY s.date,s.start_time").all();
  const statRow=db.prepare(`SELECT (SELECT COUNT(*) FROM schedules s WHERE s.group_id=@id AND s.occurred=1 AND s.cancelled=0) sessions_done,(SELECT COUNT(*) FROM applications a WHERE a.group_id=@id AND a.status IN ('참석완료','평가완료')) participants,(SELECT ROUND(AVG(r.satisfaction),1) FROM reviews r JOIN applications a ON a.id=r.application_id WHERE a.group_id=@id AND ${PUBLIC_REVIEW_WHERE}) rating_avg,(SELECT COUNT(*) FROM reviews r JOIN applications a ON a.id=r.application_id WHERE a.group_id=@id AND ${PUBLIC_REVIEW_WHERE}) review_count`);
  const map=new Map(groups.map(g=>[g.id,{...g,exposed:!!g.exposed,schedules:[],stats:statRow.get({id:g.id}),reviews:publicReviews('AND a.group_id=?',[g.id],5)}]));
  sched.forEach(s=>{ if(map.has(s.group_id)) map.get(s.group_id).schedules.push({...s,remaining:Math.max(0,s.capacity-s.confirmed)}); });
  res.json({groups:[...map.values()],reviews:publicReviews('',[],8)});
});
```

- [ ] **Step 5: `/api/public/applications` 검증 강화** — 핸들러 첫 부분을 다음으로 교체(INSERT 는 `motivation` 추가):

```js
app.post('/api/public/applications',(req,res)=>{
  const b=req.body; const s=db.prepare("SELECT s.*,g.exposed,g.status gstatus,(SELECT COUNT(*) FROM applications a WHERE a.schedule_id=s.id AND a.status IN ('확정','참석완료','평가완료')) confirmed FROM schedules s JOIN groups g ON g.id=s.group_id WHERE s.id=?").get(Number(b.schedule_id));
  if(!s||s.cancelled||!s.exposed||s.gstatus!=='운영'||s.date<db.prepare("SELECT date('now','localtime') d").get().d) return res.status(400).json({error:'신청할 수 없는 일정입니다.'});
  if(s.confirmed>=s.capacity) return res.status(400).json({error:'이미 마감된 일정이에요. 다른 일정을 골라주세요.'});
  const name=String(b.name||'').trim(),age=Number(b.age),phone=String(b.phone||'').trim(),motivation=String(b.motivation||'').trim();
  if(!name||!b.job) return res.status(400).json({error:'이름과 직업을 입력해 주세요.'});
  if(!Number.isInteger(age)||age<19||age>35) return res.status(400).json({error:'만 19~35세만 신청할 수 있어요.'});
  if(!/^010-\d{4}-\d{4}$/.test(phone)) return res.status(400).json({error:'휴대폰 번호를 010-0000-0000 형식으로 입력해 주세요.'});
  if(motivation.length<10||motivation.length>300) return res.status(400).json({error:'신청 이유를 10자 이상 300자 이하로 적어주세요.'});
  try{
    const r=db.prepare(`INSERT INTO applications(group_id,schedule_id,name,age,job,mbti,phone,ad_source,preferred_times,selection_method,motivation)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(s.group_id,s.id,name,age,String(b.job).trim(),String(b.mbti||'').toUpperCase().trim(),phone,String(b.ad_source||'직접/기타'),JSON.stringify(b.preferred_times||[]),String(b.selection_method||'직접'),motivation);
    audit(null,'application_created','application',r.lastInsertRowid,{schedule_id:s.id}); res.json({ok:true,id:r.lastInsertRowid,status:'접수'});
  }catch(e){ if(String(e.message).includes('UNIQUE')) return res.status(409).json({error:'이미 이 일정에 같은 번호로 신청했어요. 신청 현황은 카카오톡 채널로 문의해 주세요.'}); throw e; }
});
```

- [ ] **Step 6: 통과 확인**

Run: `npm test`
Expected: PASS 전체

- [ ] **Step 7: Commit**

```bash
git add server.js tests/api-public.test.js
git commit -m "feat: 공개 API에 모임 통계·공개 후기 추가, 신청 서버 검증 강화"
```

---

## Task 4: 참여·평가 링크 API + 운영 API 확장

**Files:**
- Modify: `server.js` (participation GET/POST, review GET/POST, admin groups POST/PATCH, 신규 `PATCH /api/admin/reviews/:id`), `.env.example`, `docker-compose.yml`
- Create: `tests/api-links.test.js`, `tests/api-admin.test.js`

**Interfaces:**
- Produces:
  - `GET /api/public/participation/:token` → `{id,name,status,payment_deadline,group_name,cover_url,date,start_time,end_time,place,fee,payment:{bank,account,holder}|null}`; status 는 `승인|입금대기|확정|참석완료|평가완료|자동취소|환불필요|불참` 중 하나
  - `POST .../participation/:token {accept:boolean}` → `{ok,status,paymentDeadline?,payment?,fee?}`; `승인` 상태에서만 허용. **수락 시 토큰 유지**, 거절 시 토큰 NULL
  - `GET /api/public/review/:token` → `{id,name,status,group_name,cover_url,date,start_time}`
  - `POST /api/public/review/:token` body에 `publish_ok:boolean`
  - `POST/PATCH /api/admin/groups` body에 `cover_url, gallery(string[]), for_whom(string[]), includes(string[]), fee_note, host_bio, host_photo_url, place_note`
  - `PATCH /api/admin/reviews/:id {hidden:boolean}` (adminOnly)

- [ ] **Step 1: 실패하는 링크 테스트** — `tests/api-links.test.js`

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api } = require('./helpers');

let s;
test.before(async () => { s = await startServer(); });
test.after(async () => { await s.stop(); });

const tokenFor = (name, col = 'participation_token') => { const db = s.open(); const t = db.prepare(`SELECT ${col} t FROM applications WHERE name=?`).get(name).t; db.close(); return t; };

test('participation link shows payment info and stays viewable after accept', async () => {
  const t = tokenFor('윤태호');
  let r = await api(s.base, '/api/public/participation/' + t);
  assert.equal(r.status, 200);
  assert.equal(r.body.status, '승인');
  assert.equal(r.body.fee, 39000);
  assert.deepEqual(r.body.payment, { bank: '카카오뱅크', account: '3333-01-2345678', holder: '오늘의취향' });
  r = await api(s.base, '/api/public/participation/' + t, { method: 'POST', body: { accept: true } });
  assert.equal(r.status, 200);
  assert.equal(r.body.status, '입금대기');
  assert.ok(r.body.paymentDeadline);
  assert.equal(r.body.payment.account, '3333-01-2345678');
  r = await api(s.base, '/api/public/participation/' + t);
  assert.equal(r.status, 200, 'link must stay viewable after accept');
  assert.equal(r.body.status, '입금대기');
  r = await api(s.base, '/api/public/participation/' + t, { method: 'POST', body: { accept: true } });
  assert.equal(r.status, 400, 'second accept must be rejected');
});

test('declining clears the token', async () => {
  const db = s.open();
  db.prepare("UPDATE applications SET status='승인',participation_token='decline-token-1' WHERE name='박서린'").run();
  db.close();
  let r = await api(s.base, '/api/public/participation/decline-token-1', { method: 'POST', body: { accept: false } });
  assert.equal(r.body.status, '참여포기');
  r = await api(s.base, '/api/public/participation/decline-token-1');
  assert.equal(r.status, 404);
});

test('payment is null when env is missing', async () => {
  const s2 = await startServer({ env: { PAYMENT_ACCOUNT: '' } });
  try {
    const db = s2.open(); const t = db.prepare("SELECT participation_token t FROM applications WHERE name='윤태호'").get().t; db.close();
    const r = await api(s2.base, '/api/public/participation/' + t);
    assert.equal(r.body.payment, null);
  } finally { await s2.stop(); }
});

test('review submit stores publish consent', async () => {
  const t = tokenFor('백승현', 'review_token');
  let r = await api(s.base, '/api/public/review/' + t);
  assert.equal(r.status, 200);
  assert.ok('date' in r.body && 'cover_url' in r.body);
  r = await api(s.base, '/api/public/review/' + t, { method: 'POST', body: { satisfaction: 5, revisit: 5, progress: 5, place: 4, value: 4, text: '좋았어요', publish_ok: true } });
  assert.equal(r.status, 200);
  const db = s.open();
  assert.equal(db.prepare("SELECT r.publish_ok p FROM reviews r JOIN applications a ON a.id=r.application_id WHERE a.name='백승현'").get().p, 1);
  db.close();
});
```

- [ ] **Step 2: 실패하는 운영 API 테스트** — `tests/api-admin.test.js`

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, login } = require('./helpers');

let s, admin, op;
test.before(async () => { s = await startServer(); admin = await login(s.base, 'tasteadmin', 'Taste!2026'); op = await login(s.base, 'seoyun', 'TasteOp!2026'); });
test.after(async () => { await s.stop(); });

test('admin can save new group content fields', async () => {
  const body = { cover_url: '/assets/img/groups/coffee-cover.jpg', gallery: ['/a.jpg'], for_whom: ['A', 'B'], includes: ['C'], fee_note: '원두 포함', host_bio: '소개', host_photo_url: '', place_note: '1층' };
  let r = await api(s.base, '/api/admin/groups/3', { method: 'PATCH', token: admin, body });
  assert.equal(r.status, 200);
  const g = (await api(s.base, '/api/admin/groups', { token: admin })).body.groups.find(x => x.id === 3);
  assert.equal(g.fee_note, '원두 포함');
  assert.deepEqual(JSON.parse(g.for_whom_json), ['A', 'B']);
  assert.deepEqual(JSON.parse(g.gallery_json), ['/a.jpg']);
  r = await api(s.base, '/api/admin/groups', { method: 'POST', token: admin, body: { name: '새 모임', field: '만들기', ...body } });
  assert.equal(r.status, 200);
  const created = (await api(s.base, '/api/admin/groups', { token: admin })).body.groups.find(x => x.id === r.body.id);
  assert.equal(created.place_note, '1층');
});

test('PATCH without new fields keeps existing content', async () => {
  await api(s.base, '/api/admin/groups/1', { method: 'PATCH', token: admin, body: { name: '나만의 시그니처 향수 만들기' } });
  const g = (await api(s.base, '/api/admin/groups', { token: admin })).body.groups.find(x => x.id === 1);
  assert.ok(JSON.parse(g.for_whom_json).length >= 3);
  assert.ok(g.cover_url);
});

test('admin can hide a review; operator cannot', async () => {
  const id = (await api(s.base, '/api/admin/reviews', { token: admin })).body.reviews[0].id;
  let r = await api(s.base, `/api/admin/reviews/${id}`, { method: 'PATCH', token: op, body: { hidden: true } });
  assert.equal(r.status, 403);
  r = await api(s.base, `/api/admin/reviews/${id}`, { method: 'PATCH', token: admin, body: { hidden: true } });
  assert.equal(r.status, 200);
  const db = s.open();
  assert.equal(db.prepare('SELECT hidden FROM reviews WHERE id=?').get(id).hidden, 1);
  assert.ok(db.prepare("SELECT 1 FROM audit_logs WHERE action='hide_review' AND entity_id=?").get(String(id)));
  db.close();
});
```

Run: `npm test` → Expected: FAIL (fee undefined, fee_note undefined 등)

- [ ] **Step 3: 참여 링크 구현** — `server.js`

`notify` 아래 헬퍼에 추가:

```js
const paymentInfo = () => process.env.PAYMENT_ACCOUNT ? {bank:process.env.PAYMENT_BANK||'',account:process.env.PAYMENT_ACCOUNT,holder:process.env.PAYMENT_HOLDER||''} : null;
```

participation GET/POST 교체:

```js
app.get('/api/public/participation/:token',(req,res)=>{
  const a=db.prepare(`SELECT a.id,a.name,a.status,a.payment_deadline,g.name group_name,g.cover_url,s.date,s.start_time,s.end_time,s.place,s.fee
    FROM applications a JOIN groups g ON g.id=a.group_id JOIN schedules s ON s.id=a.schedule_id WHERE a.participation_token=?`).get(req.params.token);
  if(!a) return res.status(404).json({error:'유효하지 않은 링크입니다.'}); res.json({...a,payment:paymentInfo()});
});
app.post('/api/public/participation/:token',(req,res)=>{
  const a=db.prepare('SELECT a.*,s.fee FROM applications a JOIN schedules s ON s.id=a.schedule_id WHERE a.participation_token=?').get(req.params.token);
  if(!a||a.status!=='승인') return res.status(400).json({error:'이미 처리되었거나 유효하지 않은 링크입니다.'});
  if(req.body.accept===false){ db.prepare("UPDATE applications SET status='참여포기',participation_token=NULL WHERE id=?").run(a.id); notify(a.id,'participation_declined'); audit(null,'participation_declined','application',a.id); return res.json({ok:true,status:'참여포기'}); }
  db.prepare("UPDATE applications SET status='입금대기',participation_confirmed_at=datetime('now','localtime'),payment_deadline=datetime('now','localtime','+10 hours') WHERE id=?").run(a.id);
  notify(a.id,'payment_instruction',{manual:true}); audit(null,'participation_accepted','application',a.id); const n=db.prepare('SELECT payment_deadline FROM applications WHERE id=?').get(a.id); res.json({ok:true,status:'입금대기',paymentDeadline:n.payment_deadline,payment:paymentInfo(),fee:a.fee});
});
```

- [ ] **Step 4: 평가 링크 구현** — review GET/POST 교체:

```js
app.get('/api/public/review/:token',(req,res)=>{const a=db.prepare(`SELECT a.id,a.name,a.status,g.name group_name,g.cover_url,s.date,s.start_time FROM applications a JOIN groups g ON g.id=a.group_id JOIN schedules s ON s.id=a.schedule_id WHERE a.review_token=?`).get(req.params.token);if(!a)return res.status(404).json({error:'유효하지 않은 링크입니다.'});res.json(a);});
app.post('/api/public/review/:token',(req,res)=>{const a=db.prepare('SELECT * FROM applications WHERE review_token=?').get(req.params.token);if(!a||a.status!=='참석완료')return res.status(400).json({error:'평가할 수 없는 링크입니다.'});const b=req.body;for(const k of ['satisfaction','revisit','progress','place','value'])if(Number(b[k])<1||Number(b[k])>5)return res.status(400).json({error:'평가 점수는 1~5점이어야 합니다.'});try{db.prepare('INSERT INTO reviews(application_id,satisfaction,revisit,progress,place,value,text,report,report_text,publish_ok) VALUES(?,?,?,?,?,?,?,?,?,?)').run(a.id,Number(b.satisfaction),Number(b.revisit),Number(b.progress),Number(b.place),Number(b.value),String(b.text||'').slice(0,1000),b.report?1:0,String(b.report_text||'').slice(0,1000),b.publish_ok?1:0);db.prepare("UPDATE applications SET status='평가완료',review_token=NULL WHERE id=?").run(a.id);audit(null,'review_submitted','application',a.id,{publish_ok:!!b.publish_ok});res.json({ok:true});}catch(e){return res.status(409).json({error:'이미 평가가 제출되었습니다.'});}});
```

- [ ] **Step 5: 모임체 POST/PATCH 새 필드** — 두 핸들러 교체:

```js
const GROUP_COLS='field,tag,name,icon,place,duration,fee,exposed,status,tagline,intro,host_name,host_role,order_json,prep_json,refund_policy,faq_json,cover_url,gallery_json,for_whom_json,includes_json,fee_note,host_bio,host_photo_url,place_note';
const groupValues=(b,g={})=>[b.field,b.tag||'',b.name,b.icon||g.icon||'✨',b.place||'',b.duration||'',Number(b.fee||0),b.exposed===false||b.exposed===0?0:1,b.status||'운영',b.tagline||'',b.intro||'',b.host_name||'',b.host_role||'',JSON.stringify(b.order||parseJson(g.order_json,[])),JSON.stringify(b.prep||parseJson(g.prep_json,[])),b.refund_policy||'',JSON.stringify(b.faq||parseJson(g.faq_json,[])),b.cover_url||'',JSON.stringify(b.gallery||parseJson(g.gallery_json,[])),JSON.stringify(b.for_whom||parseJson(g.for_whom_json,[])),JSON.stringify(b.includes||parseJson(g.includes_json,[])),b.fee_note||'',b.host_bio||'',b.host_photo_url||'',b.place_note||''];
app.post('/api/admin/groups',auth,adminOnly,(req,res)=>{
  const b=req.body;if(!b.name||!b.field)return res.status(400).json({error:'모임체명과 분야가 필요합니다.'}); const r=db.prepare(`INSERT INTO groups(${GROUP_COLS}) VALUES(${GROUP_COLS.split(',').map(()=>'?').join(',')})`).run(...groupValues(b)); audit(req.user.id,'create_group','group',r.lastInsertRowid);res.json({ok:true,id:r.lastInsertRowid});
});
app.patch('/api/admin/groups/:id',auth,adminOnly,(req,res)=>{
  const g=db.prepare('SELECT * FROM groups WHERE id=?').get(Number(req.params.id));if(!g)return res.status(404).json({error:'모임체가 없습니다.'});const b={...g,...req.body};db.prepare(`UPDATE groups SET ${GROUP_COLS.split(',').map(c=>c+'=?').join(',')} WHERE id=?`).run(...groupValues(b,g),g.id);audit(req.user.id,'update_group','group',g.id);res.json({ok:true});
});
```

(주의: PATCH 는 `{...g,...req.body}` 로 병합하므로 문자열 필드는 기존 값이 유지되고, 배열 필드는 body에 없으면 `parseJson(g.*_json)` 으로 유지된다. `exposed` 는 DB 값 0/1 도 처리.)

- [ ] **Step 6: 후기 숨김 API** — `/api/admin/reviews` GET 다음 줄에:

```js
app.patch('/api/admin/reviews/:id',auth,adminOnly,(req,res)=>{const r=db.prepare('SELECT id FROM reviews WHERE id=?').get(Number(req.params.id));if(!r)return res.status(404).json({error:'평가를 찾을 수 없습니다.'});db.prepare('UPDATE reviews SET hidden=? WHERE id=?').run(req.body.hidden?1:0,r.id);audit(req.user.id,req.body.hidden?'hide_review':'show_review','review',r.id);res.json({ok:true});});
```

- [ ] **Step 7: 환경 변수 문서화**

`.env.example` 끝에:

```
# 참여 확인 페이지에 표시할 입금 계좌 (비우면 "운영자가 카카오톡으로 안내" 문구 표시)
PAYMENT_BANK=카카오뱅크
PAYMENT_ACCOUNT=
PAYMENT_HOLDER=
```

`docker-compose.yml` environment 에:

```yaml
      PAYMENT_BANK: ${PAYMENT_BANK:-}
      PAYMENT_ACCOUNT: ${PAYMENT_ACCOUNT:-}
      PAYMENT_HOLDER: ${PAYMENT_HOLDER:-}
```

- [ ] **Step 8: 통과 확인**

Run: `npm test`
Expected: PASS 전체

- [ ] **Step 9: Commit**

```bash
git add server.js .env.example docker-compose.yml tests/api-links.test.js tests/api-admin.test.js
git commit -m "feat: 참여 링크에 입금 안내 추가·수락 후 재조회 허용, 평가 공개 동의, 모임체 콘텐츠 필드와 후기 숨김 API"
```

---

## Task 5: 디자인 토큰 + 순수 로직 core.js

**Files:**
- Create: `public/assets/css/tokens.css`, `public/assets/js/core.js`, `tests/core.test.js`

**Interfaces:**
- Produces `core.js` → 브라우저 `window.TT`, Node `module.exports`:
  - `esc(s): string`
  - `won(n): string` — `39000 → '39,000원'`
  - `parseDate('YYYY-MM-DD'): Date` (로컬 자정), `parseSqlDateTime('YYYY-MM-DD HH:MM:SS'): Date` (로컬)
  - `dowKo(date): '일'..'토'`, `fmtDateShort(date): '9.28(월)'`, `fmtDateLong(date): '9월 28일 (월)'`
  - `timeLabel('14:00'): '오후 2:00'`, `timeRange(start,end): '오후 2:00 – 4:00' | '오전 11:00 – 오후 1:00'`
  - `dayBucket(date): '평일'|'토'|'일'`, `band(time): '오전'|'오후'|'저녁'`, `cellKey(schedule): '토|오후'`
  - `seatInfo(capacity, remaining): {total, left, filled, label, last, full}`
  - `parseStep(str): {time, text}`, `listOf(jsonOrArray): string[]`, `pairsOf(jsonOrArray): [string,string][]`
  - `parseHash(hash): {parts: string[], query: Object}`
  - `formatPhone(raw): string`
  - `validateApply(form): {[field]: message}` — form 키: `name, age, job, phone, motivation, agreeRequired`
  - `todayStr(now?: Date): 'YYYY-MM-DD'`, `daysBetween(a, b): number`
  - `openSchedules(group): Schedule[]` (remaining>0), `nextSchedule(group)`
  - `matchesFilter(group, key, today): boolean` — key: `all|weekend|weeknight|make|learn|closing`
  - `countdown(deadline: Date, nowMs: number): {expired, text}` — `'09:59:12'`

- [ ] **Step 1: 실패하는 테스트** — `tests/core.test.js`

```js
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
});

test('countdown', () => {
  const d = TT.parseSqlDateTime('2026-09-24 19:00:00');
  assert.deepEqual(TT.countdown(d, d.getTime() - (9 * 3600 + 59 * 60 + 12) * 1000), { expired: false, text: '09:59:12' });
  assert.equal(TT.countdown(d, d.getTime() + 1000).expired, true);
});
```

Run: `node --test tests/core.test.js` → Expected: FAIL (`Cannot find module`)

- [ ] **Step 2: `public/assets/js/core.js` 작성**

```js
/* 오늘의 취향 — 순수 함수 모음. 브라우저에서는 window.TT, Node 테스트에서는 module.exports */
(function (root) {
  'use strict';
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  const pad = n => String(n).padStart(2, '0');

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  const won = n => (Number(n) || 0).toLocaleString('ko-KR') + '원';

  function parseDate(d) { const [y, m, dd] = String(d).split('-').map(Number); return new Date(y, m - 1, dd); }
  function parseSqlDateTime(v) {
    const [d, t = '00:00:00'] = String(v).split(' ');
    const [y, m, dd] = d.split('-').map(Number); const [hh, mm, ss = 0] = t.split(':').map(Number);
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

  function parseStep(s) { const str = String(s ?? ''); const i = str.indexOf('|'); return i < 0 ? { time: '', text: str.trim() } : { time: str.slice(0, i).trim(), text: str.slice(i + 1).trim() }; }
  function listOf(v) { if (Array.isArray(v)) return v; try { const x = JSON.parse(v || '[]'); return Array.isArray(x) ? x : []; } catch (e) { return []; } }
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
    if (key === 'make') return g.field === '만들기' && openSchedules(g).length > 0;
    if (key === 'learn') return g.field === '배우기' && openSchedules(g).length > 0;
    const open = openSchedules(g);
    if (key === 'weekend') return open.some(s => dayBucket(s.date) !== '평일');
    if (key === 'weeknight') return open.some(s => dayBucket(s.date) === '평일' && band(s.start_time) === '저녁');
    if (key === 'closing') return open.some(s => Number(s.remaining) === 1 || daysBetween(today, s.date) <= 3);
    return true;
  }

  function countdown(deadline, nowMs) {
    const ms = deadline.getTime() - nowMs;
    if (ms <= 0) return { expired: true, text: '00:00:00' };
    const t = Math.floor(ms / 1000);
    return { expired: false, text: `${pad(Math.floor(t / 3600))}:${pad(Math.floor((t % 3600) / 60))}:${pad(t % 60)}` };
  }

  const TT = { esc, won, parseDate, parseSqlDateTime, dowKo, fmtDateShort, fmtDateLong, todayStr, daysBetween, timeLabel, timeRange, dayBucket, band, cellKey, seatInfo, parseStep, listOf, pairsOf, parseHash, formatPhone, validateApply, openSchedules, nextSchedule, matchesFilter, countdown };
  if (typeof module !== 'undefined' && module.exports) module.exports = TT; else root.TT = TT;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 3: 통과 확인**

Run: `node --test tests/core.test.js`
Expected: PASS 8 tests

- [ ] **Step 4: `public/assets/css/tokens.css` 작성**

```css
/* 오늘의 취향 디자인 토큰 — 신청자 앱·링크 페이지·운영콘솔 공용 */
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css');
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@600;700&display=swap');

:root {
  --bg: #FFFFFF; --bg-sunken: #F6F4F2; --line: #ECE8E5;
  --ink: #1B1918; --ink-2: #4A4543; --ink-3: #8A8481; --ink-4: #B8B2AF;
  --accent: #E4572E; --accent-soft: #FDEDE7; --accent-ink: #B23E1C;
  --ok: #2F8F5B; --ok-soft: #E6F3EC; --warn: #C27A0E; --danger: #C8372D;
  --on-accent: #FFFFFF; --scrim: rgba(20, 18, 17, .48);
  --font: 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
  --serif: 'Noto Serif KR', 'AppleMyungjo', serif;
  --r-photo: 8px; --r-btn: 10px; --r-chip: 6px; --r-sheet: 16px;
  --gutter: 20px; --col: 480px;
  --fs-12: 12px; --fs-13: 13px; --fs-14: 14px; --fs-15: 15px; --fs-17: 17px; --fs-20: 20px; --fs-24: 24px; --fs-28: 28px;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #141211; --bg-sunken: #1C1A18; --line: #2E2A27;
    --ink: #F3EFEC; --ink-2: #C9C2BD; --ink-3: #8E8783; --ink-4: #5E5854;
    --accent: #F06A43; --accent-soft: #3A211A; --accent-ink: #FFB39C;
    --ok: #5CC28A; --ok-soft: #18301F; --warn: #E3A445; --danger: #F07A70;
    --scrim: rgba(0, 0, 0, .6); color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #141211; --bg-sunken: #1C1A18; --line: #2E2A27;
  --ink: #F3EFEC; --ink-2: #C9C2BD; --ink-3: #8E8783; --ink-4: #5E5854;
  --accent: #F06A43; --accent-soft: #3A211A; --accent-ink: #FFB39C;
  --ok: #5CC28A; --ok-soft: #18301F; --warn: #E3A445; --danger: #F07A70;
  --scrim: rgba(0, 0, 0, .6); color-scheme: dark;
}

*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 400 var(--fs-15)/1.6 var(--font); word-break: keep-all; overflow-wrap: anywhere; -webkit-font-smoothing: antialiased; }
img { display: block; max-width: 100%; }
button, input, select, textarea { font: inherit; color: inherit; }
button { cursor: pointer; background: none; border: 0; padding: 0; }
a { color: inherit; text-decoration: none; }
.num { font-variant-numeric: tabular-nums; }
.serif { font-family: var(--serif); font-weight: 700; letter-spacing: -0.01em; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.icon { width: 20px; height: 20px; flex: none; stroke: currentColor; fill: none; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; scroll-behavior: auto !important; } }
```

- [ ] **Step 5: Commit**

```bash
git add public/assets/css/tokens.css public/assets/js/core.js tests/core.test.js
git commit -m "feat: 디자인 토큰과 테스트된 순수 로직 core.js 추가"
```

---

## Task 6: UI 헬퍼 ui.js + site-config.js + 신청자 앱 CSS 골격

**Files:**
- Create: `public/assets/js/ui.js`, `public/assets/js/site-config.js`, `public/assets/css/app.css`

**Interfaces:**
- Consumes: `window.TT` (core.js)
- Produces `window.UI`:
  - `icon(name, cls='icon'): string` — name ∈ `back, forward, share, pin, clock, users, calendar, wallet, info, check, close, star, chat, copy, external, menu, plus`
  - `seats(info): string` — `<span class="seats" ...><i class="on"></i>…<b>2자리 남음</b></span>`
  - `cover(url, group, cls): string` — `<img>` 또는 타이포그래피 대체 커버. 로드 실패 시 대체로 교체(전역 `error` 캡처 리스너)
  - `api(url, opts): Promise<json>` — 실패 시 `Error(message)`
  - `toast(msg)`, `openSheet(title, html)`, `closeSheet()`, `copy(text): Promise<void>`
- Produces `window.SITE` (site-config.js): `{ name, region, kakaoChannelUrl, csHours, business: {company, ceo, bizNo, ecommerceNo, address, email} }`

- [ ] **Step 1: `site-config.js` 작성** (D6 자리표시 값)

```js
/* 운영 전 실제 값으로 교체하세요. 화면 푸터·고객센터·공유 문구에 사용됩니다. */
window.SITE = {
  name: '오늘의 취향',
  region: '대구',
  kakaoChannelUrl: 'https://pf.kakao.com/',
  csHours: '평일 11:00–18:00 (점심 13:00–14:00)',
  business: {
    company: '오늘의 취향',
    ceo: '대표자명',
    bizNo: '000-00-00000',
    ecommerceNo: '제0000-대구중구-0000호',
    address: '대구광역시 중구',
    email: 'hello@example.com',
  },
};
```

- [ ] **Step 2: `ui.js` 작성**

```js
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

  function seats(info) {
    const dots = Array.from({ length: info.total }, (_, i) => `<i class="${i < info.filled ? 'on' : ''}"></i>`).join('');
    return `<span class="seats${info.last ? ' is-last' : ''}${info.full ? ' is-full' : ''}" aria-label="정원 ${info.total}명 중 ${info.label}">${dots}<b>${info.label}</b></span>`;
  }

  function fallbackCover(group, cls) {
    return `<div class="cover-fallback ${cls || ''}" role="img" aria-label="${esc(group.name)}"><span class="serif">${esc(group.tag || group.field)}</span><small>${esc(group.field)}</small></div>`;
  }
  function cover(url, group, cls = '') {
    if (!url) return fallbackCover(group, cls);
    return `<img class="${cls}" src="${esc(url)}" alt="${esc(group.name)} 사진" loading="lazy" decoding="async" data-fallback-tag="${esc(group.tag || group.field)}" data-fallback-field="${esc(group.field)}">`;
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
```

- [ ] **Step 3: `app.css` 골격 작성** — 공통 컴포넌트(이후 화면 Task에서 섹션별 규칙을 이 파일에 추가):

```css
/* 신청자 앱 + 링크 페이지. tokens.css 다음에 로드한다. */
body { background: var(--bg-sunken); }
.shell { max-width: var(--col); min-height: 100dvh; margin: 0 auto; background: var(--bg); position: relative; padding-bottom: 96px; }
.no-scroll { overflow: hidden; }
.pad { padding: 0 var(--gutter); }

/* 헤더 */
.topbar { position: sticky; top: 0; z-index: 20; height: 56px; display: flex; align-items: center; gap: 8px; padding: 0 var(--gutter); background: var(--bg); }
.topbar.is-scrolled { box-shadow: 0 1px 0 var(--line); }
.topbar .spacer { flex: 1; }
.wordmark { font-family: var(--serif); font-weight: 700; font-size: 19px; letter-spacing: -0.02em; display: inline-flex; align-items: center; gap: 6px; }
.wordmark .dots { display: inline-flex; gap: 3px; }
.wordmark .dots i { width: 5px; height: 5px; border-radius: 50%; background: var(--ink); }
.wordmark .dots i:first-child { background: var(--accent); }
.wordmark .dots i:last-child { opacity: .35; }
.region { font-size: var(--fs-13); color: var(--ink-3); border: 1px solid var(--line); border-radius: var(--r-chip); padding: 1px 6px; }
.icon-btn { width: 40px; height: 40px; display: inline-grid; place-items: center; border-radius: 50%; }
.text-link { font-size: var(--fs-14); color: var(--ink-2); }

/* 버튼 */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 52px; padding: 0 20px; border-radius: var(--r-btn); font-weight: 600; font-size: var(--fs-15); }
.btn-primary { background: var(--accent); color: var(--on-accent); }
.btn-secondary { background: var(--bg-sunken); color: var(--ink); }
.btn-line { border: 1px solid var(--line); color: var(--ink); }
.btn-block { width: 100%; }
.btn[disabled] { background: var(--bg-sunken); color: var(--ink-4); cursor: not-allowed; }

/* 섹션 */
.section { padding: 36px var(--gutter) 0; }
.section-head { display: flex; align-items: flex-end; gap: 8px; margin-bottom: 14px; }
.section-head h2 { margin: 0; font-size: var(--fs-20); font-weight: 700; letter-spacing: -0.02em; }
.section-head p { margin: 2px 0 0; font-size: var(--fs-14); color: var(--ink-3); }
.section-head .more { margin-left: auto; font-size: var(--fs-14); color: var(--ink-3); display: inline-flex; align-items: center; }
.rule { height: 1px; background: var(--line); margin: 40px var(--gutter) 0; }
.read h2 { font-family: var(--serif); font-weight: 700; font-size: var(--fs-20); margin: 0 0 14px; }
.read p { margin: 0 0 14px; color: var(--ink-2); line-height: 1.75; white-space: pre-line; }

/* 가로 스크롤 */
.hscroll { display: flex; gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory; padding: 0 var(--gutter); margin: 0 calc(var(--gutter) * -1); scrollbar-width: none; }
.hscroll::-webkit-scrollbar { display: none; }
.hscroll > * { scroll-snap-align: start; flex: none; }

/* 칩 */
.chips { display: flex; gap: 8px; }
.chip { height: 36px; padding: 0 14px; border-radius: var(--r-chip); border: 1px solid var(--line); font-size: var(--fs-14); color: var(--ink-2); white-space: nowrap; }
.chip.is-on { background: var(--ink); border-color: var(--ink); color: var(--bg); font-weight: 600; }

/* 좌석 점 */
.seats { display: inline-flex; align-items: center; gap: 3px; font-size: var(--fs-13); color: var(--ink-3); }
.seats i { width: 7px; height: 7px; border-radius: 50%; border: 1.5px solid var(--ink-4); }
.seats i.on { background: var(--ink-3); border-color: var(--ink-3); }
.seats b { margin-left: 5px; font-weight: 500; }
.seats.is-last b { color: var(--accent); font-weight: 700; }
.seats.is-full b { color: var(--ink-4); }

/* 배지 */
.badge { display: inline-flex; align-items: center; height: 22px; padding: 0 7px; border-radius: 4px; font-size: var(--fs-12); font-weight: 600; }
.badge-ok { background: var(--ok); color: #fff; }
.badge-accent { background: var(--accent); color: #fff; }
.badge-soft { background: var(--accent-soft); color: var(--accent-ink); }
.badge-muted { background: rgba(20,18,17,.62); color: #fff; }

/* 대체 커버 */
.cover-fallback { display: grid; place-content: center; text-align: center; gap: 2px; background: var(--bg-sunken); color: var(--ink-2); aspect-ratio: 4 / 3; }
.cover-fallback .serif { font-size: var(--fs-28); }
.cover-fallback small { font-size: var(--fs-13); color: var(--ink-3); }

/* 하단 고정 바 */
.bottom-bar { position: fixed; left: 50%; bottom: 0; transform: translateX(-50%); width: 100%; max-width: var(--col); z-index: 30; display: flex; align-items: center; gap: 12px; padding: 12px var(--gutter) calc(12px + env(safe-area-inset-bottom)); background: var(--bg); box-shadow: 0 -1px 0 var(--line); }
.bottom-bar .sum { flex: 1; min-width: 0; }
.bottom-bar .sum b { display: block; font-size: var(--fs-17); }
.bottom-bar .sum span { font-size: var(--fs-13); color: var(--ink-3); }
.bottom-bar .btn { min-width: 140px; }
.shake { animation: shake .35s; }
@keyframes shake { 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }

/* 시트·토스트 */
.sheet-back { position: fixed; inset: 0; z-index: 50; background: var(--scrim); display: flex; align-items: flex-end; justify-content: center; }
.sheet { width: 100%; max-width: var(--col); max-height: 86dvh; overflow: auto; background: var(--bg); border-radius: var(--r-sheet) var(--r-sheet) 0 0; padding-bottom: env(safe-area-inset-bottom); }
.sheet-head { position: sticky; top: 0; background: var(--bg); display: flex; align-items: center; padding: 8px 8px 8px var(--gutter); box-shadow: 0 1px 0 var(--line); }
.sheet-head h2 { flex: 1; margin: 0; font-size: var(--fs-17); }
.sheet-body { padding: 16px var(--gutter) 24px; }
.toast { position: fixed; left: 50%; bottom: 96px; transform: translateX(-50%); z-index: 60; background: var(--ink); color: var(--bg); padding: 10px 16px; border-radius: 8px; font-size: var(--fs-14); }

/* 스켈레톤·빈 상태 */
.skel { background: var(--bg-sunken); border-radius: var(--r-photo); animation: pulse 1.2s ease-in-out infinite alternate; }
@keyframes pulse { to { opacity: .55; } }
.empty { text-align: center; padding: 48px var(--gutter); color: var(--ink-3); }
.empty .icon { width: 28px; height: 28px; margin: 0 auto 10px; color: var(--ink-4); }
.empty h3 { margin: 0 0 4px; color: var(--ink); font-size: var(--fs-17); }
.empty .btn { margin-top: 16px; }

/* 푸터 */
.footer { margin-top: 56px; padding: 28px var(--gutter) 40px; background: var(--bg-sunken); font-size: var(--fs-13); color: var(--ink-3); line-height: 1.7; }
.footer .links { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-bottom: 14px; color: var(--ink-2); font-weight: 500; }
.footer .cs { margin-bottom: 14px; }
.footer .cs b { color: var(--ink); }
```

- [ ] **Step 4: 콘솔 에러 없이 로드되는지 확인** — 스크래치 `ui-check.html` (`<link tokens.css><link app.css><script core.js><script ui.js><script site-config.js>` + `document.body.innerHTML = UI.seats(TT.seatInfo(3,1)) + UI.icon('star')`)을 서버 정적 경로 밖에서 file:// 로 열 수 없으므로, `public/` 에 두지 말고 Task 7의 index.html 에서 확인한다. 이 Step은 Task 7 Step 6과 함께 검증.

- [ ] **Step 5: Commit**

```bash
git add public/assets/js/ui.js public/assets/js/site-config.js public/assets/css/app.css
git commit -m "feat: 아이콘·좌석 점·시트·토스트 UI 헬퍼와 신청자 앱 공통 스타일"
```

---

## Task 7: 신청자 앱 셸 + 해시 라우터 + 홈

**Files:**
- Rewrite: `public/index.html`
- Create: `public/assets/js/app.js`
- Modify: `public/assets/css/app.css` (홈 섹션 규칙 추가)
- Delete: `public/assets/css/style.css` (Task 10에서 링크 페이지 교체 후 삭제 — 여기서는 index.html 참조만 제거)

**Interfaces:**
- Consumes: `TT.*`, `UI.*`, `SITE`, `GET /api/public/groups`
- Produces (app.js 내부, 이후 Task 8·9가 같은 파일에 추가):
  - 전역 상태 `S = { groups, reviews, loaded, error, filter, sel: {groupId, scheduleId, date}, form, find: {cells:Set, randomId}, done }`
  - `routes` 테이블: `{ '': renderHome, g: routeGroup, done: renderDone, find: renderFind, guide: renderGuide, policy: renderPolicy }` — 핸들러 시그니처 `(parts, query) => string(html)`
  - `go(hash)` — `location.hash = hash`
  - 컴포넌트: `groupCard(g, {wide})`, `reviewCard(r, {showGroup})`, `sectionHead(title, sub, moreHref)`, `footer()`, `topbar({back, title, right})`
  - 이벤트: 문서 레벨 `click` 위임 — `data-go="#/..."`, `data-action="..."` + `actions` 객체 `{ name: (el, event) => void }`

- [ ] **Step 1: `index.html` 재작성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#141211" media="(prefers-color-scheme: dark)">
<title>오늘의 취향 — 대구에서 세 명이 만나는 원데이 모임</title>
<meta name="description" content="향수·드로잉·핸드드립·가죽공예. 대구에서 최대 세 명이 한 테이블에 모이는 승인제 원데이 모임이에요.">
<meta property="og:type" content="website">
<meta property="og:title" content="오늘의 취향">
<meta property="og:description" content="대구에서 최대 세 명이 한 테이블에 모이는 원데이 모임">
<meta property="og:image" content="/assets/icons/og.jpg">
<link rel="icon" href="/assets/icons/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/css/tokens.css">
<link rel="stylesheet" href="/assets/css/app.css">
</head>
<body>
<div class="shell" id="app" aria-live="polite"></div>
<script src="/assets/js/site-config.js"></script>
<script src="/assets/js/core.js"></script>
<script src="/assets/js/ui.js"></script>
<script src="/assets/js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: app.js 뼈대 — 상태·로딩·라우터·이벤트 위임**

```js
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
  function readAd() { try { const p = new URLSearchParams(location.search); return { source: p.get('utm_source') || '직접/기타' }; } catch (e) { return { source: '직접/기타' }; } }

  const byId = id => S.groups.find(g => String(g.id) === String(id)) || null;
  const today = () => TT.todayStr();
  const go = hash => { location.hash = hash; };

  const routes = {};                 // Task 7~9 에서 채운다
  const actions = {};                // data-action 핸들러

  function render() {
    const { parts, query } = TT.parseHash(location.hash);
    if (!S.loaded) { $app.innerHTML = S.error ? renderLoadError() : renderSkeleton(); return; }
    const handler = routes[parts[0] || ''] || routes[''];
    $app.innerHTML = handler(parts, query);
    afterRender();
  }
  let lastRoute = '';
  function afterRender() {
    const route = location.hash.split('?')[0];
    if (route !== lastRoute) { window.scrollTo(0, 0); lastRoute = route; }
    document.title = document.querySelector('[data-title]')?.dataset.title || '오늘의 취향 — 대구에서 세 명이 만나는 원데이 모임';
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
    return topbar({}) + `<div class="pad"><div class="skel" style="aspect-ratio:16/10"></div></div>
      <div class="section"><div class="skel" style="height:24px;width:40%"></div><div class="grid2" style="margin-top:14px">${'<div><div class="skel" style="aspect-ratio:4/3"></div><div class="skel" style="height:14px;margin-top:10px"></div></div>'.repeat(4)}</div></div>`;
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

  // --- 이하 Task 7 Step 3~4, Task 8, Task 9 에서 추가 ---

  load();
})();
```

- [ ] **Step 3: 공용 컴포넌트 추가** (app.js 의 표시 위치에)

```js
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
      <div class="rcard-stars" aria-label="5점 만점에 ${r.rating}점">${UI.icon('star', 'icon star is-on')}<b class="num">${r.rating}.0</b></div>
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
```

- [ ] **Step 4: 홈 화면** (`routes['']`, spec §4.1)

```js
  const FILTERS = [['all', '전체'], ['weekend', '이번 주말'], ['weeknight', '평일 저녁'], ['make', '만들기'], ['learn', '배우기'], ['closing', '마감 임박']];
  actions.filter = el => { S.filter = el.dataset.key; render(); };

  routes[''] = function renderHome() {
    const t = today();
    const openGroups = S.groups.filter(g => TT.openSchedules(g).length);
    const scheduleCount = S.groups.reduce((n, g) => n + TT.openSchedules(g).length, 0);
    const thisWeek = openGroups.filter(g => TT.openSchedules(g).some(s => TT.daysBetween(t, s.date) <= 7))
      .sort((a, b) => (TT.nextSchedule(a).date + TT.nextSchedule(a).start_time).localeCompare(TT.nextSchedule(b).date + TT.nextSchedule(b).start_time));
    const list = S.groups.filter(g => TT.matchesFilter(g, S.filter, t))
      .sort((a, b) => (TT.openSchedules(b).length > 0) - (TT.openSchedules(a).length > 0));
    const banner = `<a class="banner" href="#/guide">
        <picture><img src="/assets/img/brand/home-banner.jpg" alt="" onerror="this.closest('.banner').classList.add('no-photo');this.remove()"></picture>
        <div class="banner-copy"><strong>퇴근 후 두 시간,<br>처음 만난 세 사람과 만드는 취향</strong><span>오늘의 취향은 어떻게 운영되나요 ${UI.icon('forward', 'icon icon-sm')}</span></div>
      </a>`;
    let h = topbar({ right: '<a class="text-link" href="#/guide">이용 안내</a>' });
    h += `<div class="pad">${banner}</div>`;
    h += `<div class="section filters"><div class="chips hscroll" role="tablist">${FILTERS.map(([k, l]) => `<button class="chip${S.filter === k ? ' is-on' : ''}" role="tab" aria-selected="${S.filter === k}" data-action="filter" data-key="${k}">${l}</button>`).join('')}</div></div>`;
    h += `<div class="section"><a class="find-entry" href="#/find"><div><b>언제 시간 되세요?</b><span>요일과 시간대를 고르면 맞는 모임을 골라드려요</span></div><span class="find-go">시간대 고르기 ${UI.icon('forward', 'icon icon-sm')}</span></a></div>`;
    if (thisWeek.length && S.filter === 'all') h += `<section class="section">${sectionHead('이번 주 열리는 모임', '7일 안에 열리는 일정이에요')}<div class="hscroll">${thisWeek.map(g => groupCard(g, { wide: true })).join('')}</div></section>`;
    h += `<section class="section">${sectionHead(S.filter === 'all' ? '모든 모임' : FILTERS.find(f => f[0] === S.filter)[1], `${openGroups.length}개 모임 · ${scheduleCount}개 일정 모집 중`)}`;
    h += list.length ? `<div class="grid2">${list.map(g => groupCard(g)).join('')}</div>` : `<div class="empty">${UI.icon('calendar')}<h3>조건에 맞는 일정이 없어요</h3><p>다른 조건을 골라보세요.</p><button class="btn btn-line" data-action="filter" data-key="all">전체 보기</button></div>`;
    h += '</section>';
    if (S.reviews.length) h += `<section class="section">${sectionHead('다녀온 분들의 후기', '참여 후 직접 남긴 평가예요')}<div class="hscroll">${S.reviews.map(r => reviewCard(r)).join('')}</div></section>`;
    h += `<section class="section">${sectionHead('처음이라면', '신청부터 모임 당일까지')}${stepsList()}<a class="more-link" href="#/guide">이용 안내 전체 보기 ${UI.icon('forward', 'icon icon-sm')}</a></section>`;
    h += `<section class="section">${sectionHead('자주 묻는 질문')}${faqList(HOME_FAQ)}</section>`;
    return h + footer();
  };

  const STEPS = [
    ['신청', '일정을 고르고 간단한 정보와 신청 이유를 보내요.'],
    ['운영자 검토', '담당 운영자가 보통 24시간 안에 확인해요.'],
    ['참여 확인', '승인되면 카카오톡으로 참여 확인 링크를 보내드려요.'],
    ['입금', '참여를 확정하면 10시간 안에 입금해 주세요. 입금이 확인되면 자리가 확정돼요.'],
    ['모임 당일', '확정 후 안내받은 장소에서 만나요.'],
  ];
  const stepsList = () => `<ol class="steps">${STEPS.map(([t, d]) => `<li><b>${t}</b><span>${d}</span></li>`).join('')}</ol>`;
  const HOME_FAQ = [
    ['혼자 신청해도 되나요?', '대부분 혼자 오세요. 최대 세 명이라 자연스럽게 대화가 시작돼요.'],
    ['신청하면 바로 확정인가요?', '아니에요. 운영자 승인 → 참여 확인 → 10시간 안 입금이 끝나면 확정돼요.'],
    ['나이 제한이 있나요?', '만 19~35세만 신청할 수 있어요.'],
    ['취소하면 환불되나요?', '승인 전 취소는 언제나 전액 환불돼요. 승인 후에는 모임마다 다른 환불 규정을 따라요.'],
  ];
  function faqList(items) {
    return `<div class="faq">${items.map(([q, a]) => `<details><summary>${esc(q)}${UI.icon('plus', 'icon icon-sm')}</summary><p>${esc(a)}</p></details>`).join('')}</div>`;
  }
```

- [ ] **Step 5: 홈 CSS 추가** (`app.css` 끝)

```css
.topbar-title { margin: 0; font-size: var(--fs-17); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.icon-sm { width: 16px; height: 16px; }

.banner { position: relative; display: block; border-radius: var(--r-photo); overflow: hidden; aspect-ratio: 16 / 10; background: var(--ink); }
.banner img { width: 100%; height: 100%; object-fit: cover; }
.banner-copy { position: absolute; left: 0; right: 0; bottom: 0; padding: 18px; color: #fff; display: grid; gap: 8px; background: linear-gradient(to top, rgba(0,0,0,.55), transparent); }
.banner-copy strong { font-family: var(--serif); font-size: 22px; line-height: 1.35; }
.banner-copy span { font-size: var(--fs-13); display: inline-flex; align-items: center; opacity: .9; }
.banner.no-photo { aspect-ratio: auto; background: var(--bg-sunken); }
.banner.no-photo .banner-copy { position: static; color: var(--ink); background: none; padding: 24px 20px; }

.filters { padding-top: 20px; }
.find-entry { display: flex; align-items: center; gap: 12px; padding: 16px; border-radius: var(--r-btn); background: var(--bg-sunken); }
.find-entry div { flex: 1; display: grid; }
.find-entry b { font-size: var(--fs-15); }
.find-entry span { font-size: var(--fs-13); color: var(--ink-3); }
.find-go { display: inline-flex; align-items: center; font-size: var(--fs-14) !important; color: var(--accent-ink) !important; font-weight: 600; white-space: nowrap; }

.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px 12px; }
.gcard { display: block; min-width: 0; }
.gcard.is-wide { width: 72%; }
.gcard-photo { position: relative; border-radius: var(--r-photo); overflow: hidden; aspect-ratio: 4 / 3; background: var(--bg-sunken); }
.gcard-photo img, .gcard-photo .cover-fallback { width: 100%; height: 100%; object-fit: cover; }
.gcard-photo .cover-fallback .serif { font-size: var(--fs-20); }
.gcard-badges { position: absolute; top: 8px; left: 8px; display: flex; gap: 4px; }
.gcard.is-closed .gcard-photo img { filter: grayscale(.6) opacity(.7); }
.gcard-meta { margin-top: 10px; font-size: var(--fs-13); color: var(--ink-3); }
.gcard-title { margin: 2px 0 4px; font-size: var(--fs-15); font-weight: 600; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.gcard-when { font-size: var(--fs-13); color: var(--ink-2); }
.gcard-foot { margin-top: 6px; display: flex; align-items: center; justify-content: space-between; gap: 6px; flex-wrap: wrap; }
.gcard-foot b { font-size: var(--fs-14); }

.rcard { width: 78%; padding: 16px; border-radius: var(--r-btn); background: var(--bg-sunken); display: grid; gap: 8px; align-content: start; }
.rcard-stars { display: inline-flex; align-items: center; gap: 4px; font-size: var(--fs-14); }
.star.is-on { fill: var(--accent); stroke: var(--accent); width: 16px; height: 16px; }
.rcard-text { margin: 0; font-size: var(--fs-14); color: var(--ink-2); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.rcard-meta { font-size: var(--fs-12); color: var(--ink-3); }

.steps { list-style: none; margin: 0; padding: 0; counter-reset: s; display: grid; gap: 14px; }
.steps li { counter-increment: s; display: grid; grid-template-columns: 28px 1fr; column-gap: 10px; }
.steps li::before { content: counter(s); grid-row: span 2; width: 24px; height: 24px; border-radius: 50%; background: var(--bg-sunken); display: grid; place-items: center; font-size: var(--fs-13); font-weight: 700; color: var(--ink-2); }
.steps b { font-size: var(--fs-15); }
.steps span { font-size: var(--fs-14); color: var(--ink-3); }
.more-link { display: inline-flex; align-items: center; margin-top: 16px; font-size: var(--fs-14); color: var(--ink-2); }

.faq details { border-bottom: 1px solid var(--line); }
.faq summary { list-style: none; display: flex; align-items: center; gap: 8px; justify-content: space-between; padding: 16px 0; font-weight: 500; cursor: pointer; }
.faq summary::-webkit-details-marker { display: none; }
.faq details[open] summary .icon { transform: rotate(45deg); }
.faq p { margin: 0 0 16px; color: var(--ink-2); font-size: var(--fs-14); }
```

- [ ] **Step 6: 브라우저 확인** (임시 DB)

```bash
DB_PATH=$TMP/tt-ui.sqlite node scripts/seed-demo.js --reset
DB_PATH=$TMP/tt-ui.sqlite PORT=3100 node server.js   # 백그라운드
```

스크래치 `preview.html` (430px iframe 두 개: 라이트 / `data-theme` 대신 OS 다크 에뮬 불가하므로 라이트만) 을 만들어 `http://localhost:3100/#/` 를 430px·1280px로 띄워 스크린샷.
체크: 사진 카드 2열, 필터 칩 동작, 후기 섹션 표시, 푸터 사업자 정보, 콘솔 에러 0 (`use_browser eval` 로 `window.__errors` 수집 — 페이지 로드 전 `window.addEventListener('error',...)` 는 불가하므로 console 캡처 파일 확인), 알약형 요소·이모지 없음.
다크 모드 확인: `eval` 로 `document.documentElement.dataset.theme='dark'` 설정 후 스크린샷.

- [ ] **Step 7: Commit**

```bash
git add public/index.html public/assets/js/app.js public/assets/css/app.css
git commit -m "feat: 신청자 앱 해시 라우터와 새 홈 화면"
```

---

## Task 8: 모임 상세 (일정 선택 포함)

**Files:**
- Modify: `public/assets/js/app.js`, `public/assets/css/app.css`

**Interfaces:**
- Consumes: Task 7 의 `routes`, `actions`, `S.sel`, 컴포넌트
- Produces: `routes.g(parts, query)` — `parts[2]==='apply'` 이면 Task 9 의 `renderApply(g, query)` 로 위임. `S.sel = {groupId, date, scheduleId}` 규칙: 상세 진입 시 groupId가 바뀌면 date=가장 가까운 열린 일정 날짜, scheduleId=null

- [ ] **Step 1: 상세 라우트와 일정 선택 상태**

```js
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
  actions.allReviews = () => { const g = byId(S.sel.groupId); UI.openSheet(`후기 ${g.stats.review_count}개`, g.reviews.map(r => reviewCard(r, { showGroup: false })).join('')); };
  actions.policy = el => UI.openSheet(el.dataset.tab === 'terms' ? '이용약관' : '개인정보 수집·이용 동의', policyBody(el.dataset.tab));
```

- [ ] **Step 2: 상세 렌더** (spec §4.2 순서 그대로)

```js
  function trustLine(st) {
    const items = [];
    if (st.review_count) items.push(`${UI.icon('star', 'icon star is-on')}<b class="num">${st.rating_avg}</b> (후기 ${st.review_count})`);
    if (st.sessions_done) items.push(`${st.sessions_done}회 진행`);
    if (st.participants) items.push(`누적 ${st.participants}명 참여`);
    return items.length ? items.map(x => `<span>${x}</span>`).join('') : '<span class="badge badge-soft">새로 열린 모임</span>';
  }
  function scheduleBlock(g) {
    const all = (g.schedules || []).slice().sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));
    if (!all.length) return `<div class="empty compact">${UI.icon('calendar')}<h3>지금은 모집 중인 일정이 없어요</h3><a class="btn btn-line" href="${esc(SITE.kakaoChannelUrl)}" target="_blank" rel="noopener">다음 일정 소식 받기</a></div>`;
    const dates = [...new Set(all.map(s => s.date))];
    const dateOpen = d => all.some(s => s.date === d && Number(s.remaining) > 0);
    const chips = dates.map(d => `<button class="date-chip${S.sel.date === d ? ' is-on' : ''}${dateOpen(d) ? '' : ' is-closed'}" data-action="pickDate" data-date="${d}" ${dateOpen(d) ? '' : 'aria-disabled="true"'}><b>${TT.fmtDateShort(d).split('(')[0]}</b><span>${TT.dowKo(d)}</span></button>`).join('');
    const sessions = all.filter(s => s.date === S.sel.date).map(s => {
      const info = TT.seatInfo(s.capacity, s.remaining); const on = S.sel.scheduleId === s.id;
      return `<button class="session${on ? ' is-on' : ''}" ${info.full ? 'disabled' : `data-action="pickSchedule" data-id="${s.id}"`} aria-pressed="${on}">
        <div><b class="num">${TT.timeRange(s.start_time, s.end_time)}</b><span>${esc(s.place)}${Number(s.fee) !== Number(g.fee) ? ` · ${won(s.fee)}` : ''}</span></div>
        ${UI.seats(info)}${on ? UI.icon('check', 'icon session-check') : ''}
      </button>`;
    }).join('');
    return `<div class="date-chips hscroll">${chips}</div><div class="sessions">${sessions || '<p class="muted">이 날은 모두 마감됐어요.</p>'}</div>`;
  }
  function list(items, cls = 'bullets') { return items.length ? `<ul class="${cls}">${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''; }
  const readSection = (title, body) => body ? `<div class="rule"></div><section class="section read"><h2>${esc(title)}</h2>${body}</section>` : '';

  function renderDetail(g) {
    const photos = [g.cover_url, ...TT.listOf(g.gallery_json)].filter(Boolean);
    const forWhom = TT.listOf(g.for_whom_json), includes = TT.listOf(g.includes_json), order = TT.listOf(g.order_json), prep = TT.listOf(g.prep_json), faq = TT.pairsOf(g.faq_json);
    const refund = String(g.refund_policy || '').split('\n').map(x => x.trim()).filter(Boolean);
    const sel = (g.schedules || []).find(s => s.id === S.sel.scheduleId);
    const bands = [...new Set((g.schedules || []).map(s => TT.band(s.start_time)))];
    const cap = (g.schedules || [])[0]?.capacity || 3;
    const firstOpen = TT.nextSchedule(g);

    let h = `<div data-title="${esc(g.name)} — 오늘의 취향"></div>`;
    h += `<div class="gallery">
      <div class="gallery-track hscroll" data-gallery>${photos.length ? photos.map(u => `<div class="gallery-item">${UI.cover(u, g)}</div>`).join('') : `<div class="gallery-item">${UI.cover('', g)}</div>`}</div>
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
      const avg = k => (g.reviews.reduce((n, r) => n + Number(r[k]), 0) / g.reviews.length).toFixed(1);
      h += `<div class="rule"></div><section class="section">${sectionHead('참여한 분들의 후기')}
        <div class="score"><div class="score-big">${UI.icon('star', 'icon star is-on')}<b class="num">${g.stats.rating_avg}</b><span>후기 ${g.stats.review_count}개</span></div>
        <dl class="score-bars">${[['progress', '진행'], ['place', '장소'], ['value', '가격 만족']].map(([k, l]) => `<div><dt>${l}</dt><dd><i style="width:${avg(k) / 5 * 100}%"></i></dd><dd class="num">${avg(k)}</dd></div>`).join('')}</dl></div>
        <div class="review-list">${g.reviews.slice(0, 2).map(r => reviewCard(r, { showGroup: false })).join('')}</div>
        ${g.reviews.length > 2 ? '<button class="btn btn-line btn-block" data-action="allReviews">후기 전체 보기</button>' : ''}</section>`;
    }
    const introParas = String(g.intro || '').split(/\n{2,}/).filter(Boolean);
    const inline = photos.slice(1, 3);
    h += readSection('소개', introParas.map((p, i) => `<p>${esc(p)}</p>${inline[i] ? `<figure class="inline-photo">${UI.cover(inline[i], g)}</figure>` : ''}`).join(''));
    h += readSection('이런 분께 추천해요', list(forWhom));
    h += readSection('포함 사항', includes.length ? `<ul class="checks">${includes.map(x => `<li>${UI.icon('check')}${esc(x)}</li>`).join('')}</ul>` : '');
    h += readSection('진행 순서', order.length ? `<ol class="timeline">${order.map(TT.parseStep).map(s => `<li>${s.time ? `<span class="t num">${esc(s.time)}</span>` : ''}<span>${esc(s.text)}</span></li>`).join('')}</ol>` : '');
    h += readSection('준비물', list(prep));
    h += readSection('호스트', `<div class="host">${g.host_photo_url ? `<img src="${esc(g.host_photo_url)}" alt="" class="host-photo">` : `<span class="host-photo initial">${esc((g.host_name.split('·').pop() || '?').trim().slice(0, 1))}</span>`}<div><span class="host-label">호스트</span><b>${esc(g.host_name)}</b><span>${esc(g.host_role)}</span></div></div>${g.host_bio ? `<p>${esc(g.host_bio)}</p>` : ''}`);
    h += readSection('오시는 길', `<p class="place"><b>대구 중구 ${esc(g.place)}</b>${g.place_note ? `<br>${esc(g.place_note)}` : ''}</p><p class="muted">정확한 위치는 참여 확정 후 안내해요.</p><a class="btn btn-line" href="https://map.kakao.com/?q=${encodeURIComponent('대구 ' + g.place)}" target="_blank" rel="noopener">${UI.icon('external')}카카오맵에서 보기</a>`);
    h += readSection('환불 규정', `${list(refund)}<p class="muted">승인 전 취소는 언제나 전액 환불돼요. 날짜 기준은 자정이에요.</p>`);
    h += readSection('자주 묻는 질문', faq.length ? faqList(faq) : '');
    const others = S.groups.filter(x => x.id !== g.id && TT.openSchedules(x).length).sort((a, b) => (b.field === g.field) - (a.field === g.field));
    if (others.length) h += `<div class="rule"></div><section class="section">${sectionHead('다른 모임도 둘러보세요')}<div class="hscroll">${others.map(x => groupCard(x, { wide: true })).join('')}</div></section>`;
    const open = TT.openSchedules(g).length > 0;
    h += `<div class="bottom-bar"><div class="sum"><b class="num">${won(sel ? sel.fee : g.fee)}</b><span>${sel ? `${TT.fmtDateShort(sel.date)} ${TT.timeLabel(sel.start_time)}` : open ? '일정을 골라주세요' : '모집 중인 일정이 없어요'}</span></div><button class="btn btn-primary" data-action="apply" ${open ? '' : 'disabled'}>신청하기</button></div>`;
    return h;
  }
```

`afterRender()` 에 갤러리 카운터 연결 추가:

```js
    const track = document.querySelector('[data-gallery]'), count = document.querySelector('[data-gallery-count]');
    if (track && count) track.addEventListener('scroll', () => { count.textContent = `${Math.round(track.scrollLeft / track.clientWidth) + 1}/${track.children.length}`; }, { passive: true });
```

- [ ] **Step 3: 상세 CSS** (`app.css` 끝)

```css
.gallery { position: relative; }
.gallery-track { gap: 0; padding: 0; margin: 0; }
.gallery-item { width: 100%; aspect-ratio: 4 / 3; }
.gallery-item img, .gallery-item .cover-fallback { width: 100%; height: 100%; object-fit: cover; }
.icon-btn.over { position: absolute; top: 10px; background: rgba(255,255,255,.92); color: #1B1918; }
.icon-btn.over.left { left: 12px; } .icon-btn.over.right { right: 12px; }
.gallery-count { position: absolute; right: 12px; bottom: 12px; background: rgba(20,18,17,.6); color: #fff; font-size: var(--fs-12); padding: 2px 8px; border-radius: 10px; }

.title-block { padding-top: 20px; }
.crumb { font-size: var(--fs-13); color: var(--ink-3); }
.title-block h1 { margin: 4px 0 6px; font-size: var(--fs-24); line-height: 1.3; }
.tagline { margin: 0; color: var(--ink-2); }
.trust { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: var(--fs-14); color: var(--ink-2); }
.trust span { display: inline-flex; align-items: center; gap: 3px; }

.facts { list-style: none; margin: 20px 0 0; padding: 16px; border-radius: var(--r-btn); background: var(--bg-sunken); display: grid; gap: 14px; }
.facts li { display: flex; gap: 12px; }
.facts li > .icon { margin-top: 2px; color: var(--ink-3); }
.facts b { display: block; font-weight: 600; font-size: var(--fs-15); }
.facts span { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: var(--fs-13); color: var(--ink-3); }

.date-chips { gap: 8px; margin-bottom: 14px; }
.date-chip { width: 56px; height: 64px; border-radius: var(--r-btn); border: 1px solid var(--line); display: grid; place-content: center; text-align: center; }
.date-chip b { font-size: var(--fs-15); } .date-chip span { font-size: var(--fs-12); color: var(--ink-3); }
.date-chip.is-on { border-color: var(--ink); background: var(--ink); color: var(--bg); } .date-chip.is-on span { color: var(--ink-4); }
.date-chip.is-closed { opacity: .45; text-decoration: line-through; }
.sessions { display: grid; gap: 8px; }
.session { width: 100%; display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-radius: var(--r-btn); border: 1px solid var(--line); text-align: left; }
.session > div { flex: 1; display: grid; }
.session b { font-size: var(--fs-15); } .session span { font-size: var(--fs-13); color: var(--ink-3); }
.session.is-on { border: 2px solid var(--accent); padding: 13px 15px; }
.session-check { color: var(--accent); }
.session[disabled] { opacity: .5; }
.empty.compact { padding: 24px 0; }
.muted { color: var(--ink-3); font-size: var(--fs-14); }

.score { display: flex; gap: 20px; align-items: center; margin-bottom: 16px; }
.score-big { display: grid; justify-items: center; }
.score-big b { font-size: var(--fs-28); line-height: 1.1; } .score-big span { font-size: var(--fs-12); color: var(--ink-3); }
.score-big .star { width: 20px; height: 20px; }
.score-bars { flex: 1; margin: 0; display: grid; gap: 6px; }
.score-bars div { display: grid; grid-template-columns: 56px 1fr 28px; align-items: center; gap: 8px; font-size: var(--fs-13); }
.score-bars dt { color: var(--ink-3); } .score-bars dd { margin: 0; }
.score-bars dd:not(.num) { height: 4px; border-radius: 2px; background: var(--line); overflow: hidden; }
.score-bars dd i { display: block; height: 100%; background: var(--ink-2); }
.review-list { display: grid; gap: 10px; margin-bottom: 12px; }
.review-list .rcard, .sheet .rcard { width: auto; margin-bottom: 10px; }
.review-list .rcard-text, .sheet .rcard-text { -webkit-line-clamp: unset; }

.inline-photo { margin: 6px 0 20px; border-radius: var(--r-photo); overflow: hidden; }
.bullets, .checks { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; color: var(--ink-2); }
.bullets li { padding-left: 14px; position: relative; } .bullets li::before { content: ''; position: absolute; left: 2px; top: .7em; width: 4px; height: 4px; border-radius: 50%; background: var(--ink-3); }
.checks li { display: flex; gap: 8px; } .checks .icon { color: var(--ok); width: 18px; height: 18px; margin-top: 3px; }
.timeline { list-style: none; margin: 0; padding: 0; display: grid; gap: 0; counter-reset: t; }
.timeline li { counter-increment: t; display: grid; grid-template-columns: 56px 1fr; gap: 12px; padding: 12px 0; border-top: 1px solid var(--line); color: var(--ink-2); }
.timeline li:first-child { border-top: 0; }
.timeline .t { font-size: var(--fs-13); color: var(--ink-3); padding-top: 1px; }
.timeline li:not(:has(.t))::before { content: counter(t); font-size: var(--fs-13); color: var(--ink-3); }
.host { display: flex; gap: 14px; align-items: center; margin-bottom: 14px; }
.host-photo { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; flex: none; }
.host-photo.initial { display: grid; place-items: center; background: var(--bg-sunken); font-family: var(--serif); font-size: var(--fs-20); }
.host div { display: grid; } .host-label { font-size: var(--fs-12); color: var(--ink-3); } .host span:last-child { font-size: var(--fs-13); color: var(--ink-3); }
.place b { color: var(--ink); }
```

- [ ] **Step 4: 브라우저 확인** — 임시 DB 서버에서 `#/g/1`(사진 있는 모임), `#/g/2`(드로잉: 사진 없음 → 타이포 커버), `#/g/999`(없는 모임) 를 430px로 스크린샷.
체크: 날짜 칩 → 회차 선택 → 하단 바 요약 갱신, 일정 미선택 상태로 `신청하기` → 스크롤 + 흔들림 + 토스트, 공유 버튼(데스크톱은 링크 복사 토스트), 후기 전체 보기 시트, 브라우저 뒤로가기 → 홈.
**Review Focus 4**: 스크래치 DB에서 `UPDATE groups SET for_whom_json='[]',includes_json='[]',host_bio='',place_note='',fee_note='',cover_url='',gallery_json='[]' WHERE id=3` 후 `#/g/3` 이 빈 섹션 없이 렌더링되는지 확인.

- [ ] **Step 5: Commit**

```bash
git add public/assets/js/app.js public/assets/css/app.css
git commit -m "feat: 모임 상세 화면 — 갤러리, 요약 블록, 일정 선택, 후기, 읽는 콘텐츠 섹션"
```

---

## Task 9: 신청 정보 입력·완료·시간대 찾기·이용 안내·약관

**Files:**
- Modify: `public/assets/js/app.js`, `public/assets/css/app.css`

**Interfaces:**
- Consumes: `TT.validateApply`, `TT.formatPhone`, `S.form`, `S.find`, `POST /api/public/applications`
- Produces: `renderApply(g, query)`, `routes.done`, `routes.find`, `routes.guide`, `routes.policy`, `policyBody(tab)`

- [ ] **Step 1: 신청 폼** (spec §4.3)

```js
  const JOBS = ['대학생', '직장인', '프리랜서', '기타'];
  const MBTI = ['ISTJ','ISFJ','INFJ','INTJ','ISTP','ISFP','INFP','INTP','ESTP','ESFP','ENFP','ENTP','ESTJ','ESFJ','ENFJ','ENTJ'];
  function renderApply(g, query) {
    const s = (g.schedules || []).find(x => String(x.id) === String(query.s));
    if (!s || Number(s.remaining) <= 0) { setTimeout(() => go(`#/g/${g.id}`), 0); return ''; }
    S.sel = { groupId: g.id, date: s.date, scheduleId: s.id };
    const f = S.form, e = S.errors;
    const err = k => e[k] ? `<p class="field-err" id="err-${k}">${esc(e[k])}</p>` : '';
    const inv = k => e[k] ? `aria-invalid="true" aria-describedby="err-${k}"` : '';
    return `<div data-title="신청하기 — ${esc(g.name)}"></div>` + topbar({ back: true, title: '신청하기' }) + `
      <section class="pad apply-sum">${UI.cover(g.cover_url, g, 'apply-thumb')}<div><b>${esc(g.name)}</b><span>${TT.fmtDateShort(s.date)} ${TT.timeRange(s.start_time, s.end_time)} · ${esc(s.place)}</span></div><a class="text-link" href="#/g/${g.id}">변경</a></section>
      <form class="pad form" data-apply-form novalidate>
        <div class="field"><label for="f-name">이름</label><input id="f-name" class="input" data-bind="name" value="${esc(f.name)}" autocomplete="name" ${inv('name')}>${err('name')}</div>
        <div class="field"><label for="f-age">나이 (만)</label><input id="f-age" class="input" data-bind="age" value="${esc(f.age)}" inputmode="numeric" maxlength="2" ${inv('age')}><p class="hint">만 19~35세만 신청할 수 있어요</p>${err('age')}</div>
        <div class="field"><span class="label">직업</span><div class="choice-row" role="radiogroup">${JOBS.map(j => `<button type="button" class="choice${f.job === j ? ' is-on' : ''}" role="radio" aria-checked="${f.job === j}" data-action="choose" data-key="job" data-val="${j}">${j}</button>`).join('')}</div>${err('job')}</div>
        <details class="field mbti"${f.mbti && f.mbti !== '모름' ? ' open' : ''}><summary><span class="label">MBTI <em>선택</em></span><span class="val">${esc(f.mbti || '모름')}</span></summary><div class="mbti-grid">${[...MBTI, '모름'].map(m => `<button type="button" class="choice${(f.mbti || '모름') === m ? ' is-on' : ''}" data-action="choose" data-key="mbti" data-val="${m}">${m}</button>`).join('')}</div></details>
        <div class="field"><label for="f-phone">휴대폰 번호</label><input id="f-phone" class="input num" data-bind="phone" value="${esc(f.phone)}" inputmode="numeric" autocomplete="tel" placeholder="010-0000-0000" ${inv('phone')}><p class="hint">승인·입금 안내를 카카오톡으로 보내드려요</p>${err('phone')}</div>
        <div class="field"><label for="f-mot">신청 이유</label><textarea id="f-mot" class="input" rows="4" data-bind="motivation" maxlength="300" placeholder="이 모임에서 기대하는 점이나 관심 계기를 적어주세요. 운영자가 승인할 때 참고해요." ${inv('motivation')}>${esc(f.motivation)}</textarea><p class="hint counter num"><span data-counter>${f.motivation.trim().length}</span>/300</p>${err('motivation')}</div>
        <div class="notice"><b>신청 후 이렇게 진행돼요</b><ol><li>운영자 검토 (보통 24시간 안)</li><li>카카오톡으로 참여 확인 링크 도착</li><li>참여 확정 후 10시간 안에 입금하면 자리 확정</li></ol></div>
        <label class="agree"><input type="checkbox" data-agree="agreeRequired" ${f.agreeRequired ? 'checked' : ''} ${inv('agreeRequired')}><span><em class="req">필수</em> 개인정보 수집·이용 동의</span><button type="button" class="text-link" data-action="policy" data-tab="privacy">보기</button></label>${err('agreeRequired')}
        <label class="agree"><input type="checkbox" data-agree="agreeMarketing" ${f.agreeMarketing ? 'checked' : ''}><span><em>선택</em> 새 모임 소식 받기</span></label>
      </form>
      <div class="bottom-bar"><button class="btn btn-primary btn-block" data-action="submit" ${S.submitting ? 'disabled' : ''}>${S.submitting ? '보내는 중…' : '신청 보내기'}</button></div>`;
  }
  actions.choose = el => { S.form[el.dataset.key] = el.dataset.val; delete S.errors[el.dataset.key]; render(); };
  document.addEventListener('input', e => {
    const t = e.target; if (!t.matches('[data-bind]')) return;
    const k = t.dataset.bind; let v = t.value;
    if (k === 'phone') { v = TT.formatPhone(v); t.value = v; }
    if (k === 'age') { v = v.replace(/\D/g, '').slice(0, 2); t.value = v; }
    S.form[k] = v;
    if (k === 'motivation') { const c = document.querySelector('[data-counter]'); if (c) c.textContent = v.trim().length; }
  });
  document.addEventListener('change', e => { const t = e.target; if (t.matches('[data-agree]')) { S.form[t.dataset.agree] = t.checked; delete S.errors[t.dataset.agree]; } });
  actions.submit = async () => {
    S.errors = TT.validateApply(S.form);
    if (Object.keys(S.errors).length) { render(); document.querySelector('[aria-invalid="true"]')?.focus(); return; }
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
      go('#/done');
    } catch (err) { UI.toast(err.message); }
    finally { S.submitting = false; if (location.hash.startsWith('#/g/')) render(); }
  };
```

- [ ] **Step 2: 완료 화면** (spec §4.4)

```js
  routes.done = function () {
    const d = S.done; if (!d) { setTimeout(() => go('#/'), 0); return ''; }
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
```

- [ ] **Step 3: 시간대로 찾기** (spec §4.6)

```js
  const DAYS = ['평일', '토', '일'], BANDS = ['오전', '오후', '저녁'];
  actions.cell = el => { const k = el.dataset.key; S.find.cells.has(k) ? S.find.cells.delete(k) : S.find.cells.add(k); S.find.randomId = null; render(); };
  actions.randomPick = () => {
    const pool = S.groups.filter(g => TT.openSchedules(g).some(s => S.find.cells.has(TT.cellKey(s))) && g.id !== S.find.randomId);
    if (pool.length) S.find.randomId = pool[Math.floor(Math.random() * pool.length)].id;
    render();
  };
  routes.find = function () {
    const matched = S.groups.filter(g => TT.openSchedules(g).some(s => S.find.cells.has(TT.cellKey(s))));
    const picked = S.find.randomId ? matched.filter(g => g.id === S.find.randomId) : matched;
    let h = `<div data-title="시간대로 찾기 — 오늘의 취향"></div>` + topbar({ back: true, title: '시간대로 찾기' });
    h += `<section class="pad"><h2 class="page-q">언제 시간 되세요?</h2><p class="muted">여러 칸을 고를 수 있어요.</p>
      <table class="matrix"><thead><tr><th></th>${BANDS.map(b => `<th>${b}</th>`).join('')}</tr></thead><tbody>${DAYS.map(d => `<tr><th>${d}</th>${BANDS.map(b => { const k = d + '|' + b, on = S.find.cells.has(k); return `<td><button class="cell${on ? ' is-on' : ''}" aria-pressed="${on}" data-action="cell" data-key="${k}" aria-label="${d} ${b}">${on ? UI.icon('check') : ''}</button></td>`; }).join('')}</tr>`).join('')}</tbody></table></section>`;
    if (!S.find.cells.size) return h + `<p class="pad muted center">시간대를 고르면 맞는 모임이 바로 아래에 보여요.</p>`;
    h += `<section class="section">${sectionHead(`맞는 모임 ${matched.length}개`, S.find.randomId ? '이 모임은 어때요?' : '고른 시간대에 신청할 수 있는 일정이 있어요')}`;
    if (matched.length >= 2) h += `<button class="btn btn-line btn-block find-random" data-action="randomPick">${S.find.randomId ? '다시 골라주세요' : '이 중에서 골라주세요'}</button>`;
    h += picked.length ? `<div class="grid2">${picked.map(g => groupCard(g)).join('')}</div>` : `<div class="empty">${UI.icon('calendar')}<h3>고른 시간대에 열리는 모임이 아직 없어요</h3><p>다른 시간대를 골라보세요.</p></div>`;
    return h + '</section>';
  };
```

상세 → 신청 시 `preferred_times` 는 `S.find.cells` 가 있으면 그것, 없으면 선택 일정의 `cellKey` (Step 1 코드에 반영됨).

- [ ] **Step 4: 이용 안내·약관**

```js
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
    return tab === 'terms'
      ? `<div class="read policy"><h3>제1조 (목적)</h3><p>이 약관은 ${esc(SITE.business.company)}(이하 "회사")가 운영하는 원데이 모임 신청 서비스의 이용 조건을 정합니다.</p><h3>제2조 (신청과 승인)</h3><p>신청은 회원가입 없이 할 수 있으며, 담당 운영자의 검토를 거쳐 승인 여부가 정해집니다. 회사는 모임의 성격에 맞지 않는 신청을 승인하지 않을 수 있습니다.</p><h3>제3조 (입금과 확정)</h3><p>참여 의사를 확인한 뒤 10시간 안에 입금이 확인되어야 참여가 확정됩니다. 기한이 지나면 신청은 자동으로 취소됩니다.</p><h3>제4조 (환불)</h3><p>승인 전 취소는 전액 환불하며, 승인 후에는 각 모임 상세에 표시된 환불 규정을 따릅니다. 정원 초과 입금·일정 취소 등 회사 사유로 참여할 수 없는 경우 전액 환불합니다.</p></div>`
      : `<div class="read policy"><h3>수집 항목</h3><p>이름, 나이, 직업, MBTI(선택), 휴대폰 번호, 신청 이유, 선호 시간대, 유입 경로</p><h3>이용 목적</h3><p>모임 신청 접수와 승인 검토, 참여 확인·입금 안내, 참석 확인, 모임 후 평가 요청</p><h3>제공</h3><p>신청 정보는 해당 모임을 담당하는 운영자에게만 제공됩니다.</p><h3>보관 기간</h3><p>모임 종료 후 5년간 보관한 뒤 파기합니다. 관계 법령에 따라 보관이 필요한 경우 해당 기간을 따릅니다.</p><h3>동의 거부</h3><p>동의를 거부할 수 있으나, 이 경우 신청할 수 없습니다.</p></div>`;
  }
  routes.policy = function (parts) {
    const tab = parts[1] === 'terms' ? 'terms' : 'privacy';
    return `<div data-title="${tab === 'terms' ? '이용약관' : '개인정보처리방침'} — 오늘의 취향"></div>` + topbar({ back: true, title: tab === 'terms' ? '이용약관' : '개인정보처리방침' }) + `<section class="pad">${policyBody(tab)}</section>` + footer();
  };
```

- [ ] **Step 5: 폼·완료·찾기 CSS** (`app.css` 끝)

```css
.apply-sum { display: flex; align-items: center; gap: 12px; padding-top: 8px; padding-bottom: 16px; border-bottom: 1px solid var(--line); }
.apply-thumb { width: 56px !important; height: 56px; aspect-ratio: 1; border-radius: 6px; object-fit: cover; flex: none; }
.apply-thumb.cover-fallback .serif { font-size: var(--fs-13); } .apply-thumb.cover-fallback small { display: none; }
.apply-sum div { flex: 1; min-width: 0; display: grid; } .apply-sum b { font-size: var(--fs-15); } .apply-sum span { font-size: var(--fs-13); color: var(--ink-3); }
.form { padding-top: 20px; display: grid; gap: 22px; }
.field { display: grid; gap: 6px; }
.field label, .field .label { font-size: var(--fs-14); font-weight: 600; }
.label em { font-style: normal; font-weight: 400; color: var(--ink-3); margin-left: 4px; }
.input { width: 100%; min-height: 48px; padding: 12px 14px; border-radius: var(--r-btn); border: 1px solid var(--line); background: var(--bg); font-size: 16px; }
textarea.input { resize: vertical; line-height: 1.6; }
.input:focus { outline: none; border-color: var(--ink); }
.input[aria-invalid="true"] { border-color: var(--danger); }
.hint { margin: 0; font-size: var(--fs-13); color: var(--ink-3); } .counter { text-align: right; margin-top: -2px; }
.field-err { margin: 0; font-size: var(--fs-13); color: var(--danger); }
.choice-row { display: flex; gap: 8px; flex-wrap: wrap; }
.choice { height: 40px; padding: 0 14px; border-radius: var(--r-chip); border: 1px solid var(--line); font-size: var(--fs-14); }
.choice.is-on { border-color: var(--ink); background: var(--ink); color: var(--bg); font-weight: 600; }
.mbti summary { list-style: none; display: flex; justify-content: space-between; align-items: center; cursor: pointer; min-height: 44px; }
.mbti summary::-webkit-details-marker { display: none; }
.mbti .val { font-size: var(--fs-14); color: var(--ink-3); }
.mbti-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 8px; }
.mbti-grid .choice { padding: 0; } .mbti-grid .choice:last-child { grid-column: span 4; }
.notice { padding: 14px 16px; border-radius: var(--r-btn); background: var(--bg-sunken); font-size: var(--fs-14); color: var(--ink-2); }
.notice ol { margin: 6px 0 0; padding-left: 18px; }
.agree { display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: var(--fs-14); }
.agree input { width: 20px; height: 20px; accent-color: var(--accent); }
.agree span { flex: 1; } .agree em { font-style: normal; color: var(--ink-3); margin-right: 4px; } .agree em.req { color: var(--accent-ink); font-weight: 600; }

.done { padding-top: 32px; display: grid; gap: 14px; }
.done-mark { width: 56px; height: 56px; border-radius: 50%; background: var(--ok-soft); color: var(--ok); display: grid; place-items: center; }
.done-mark .icon { width: 28px; height: 28px; stroke-width: 2.4; }
.done h1 { margin: 6px 0 0; font-size: var(--fs-24); }
.progress-v { list-style: none; margin: 12px 0; padding: 0; display: grid; }
.progress-v li { position: relative; padding: 0 0 18px 26px; display: grid; }
.progress-v li::before { content: ''; position: absolute; left: 4px; top: 6px; width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--ink-4); background: var(--bg); }
.progress-v li:not(:last-child)::after { content: ''; position: absolute; left: 9px; top: 18px; bottom: 2px; width: 2px; background: var(--line); }
.progress-v li.is-now::before { border-color: var(--accent); background: var(--accent); }
.progress-v b { font-size: var(--fs-15); } .progress-v span { font-size: var(--fs-13); color: var(--ink-3); }
.receipt { margin: 0; padding: 16px; border-radius: var(--r-btn); background: var(--bg-sunken); display: grid; gap: 8px; font-size: var(--fs-14); }
.receipt div { display: flex; justify-content: space-between; gap: 12px; } .receipt dt { color: var(--ink-3); } .receipt dd { margin: 0; text-align: right; }
.center { text-align: center; justify-content: center; display: flex; align-items: center; gap: 4px; }

.page-q { margin: 16px 0 2px; font-size: var(--fs-20); }
.matrix { width: 100%; border-collapse: separate; border-spacing: 6px; margin: 12px -6px 0; }
.matrix th { font-size: var(--fs-13); color: var(--ink-3); font-weight: 500; }
.cell { width: 100%; height: 52px; border-radius: var(--r-btn); border: 1px solid var(--line); display: grid; place-items: center; }
.cell.is-on { background: var(--accent); border-color: var(--accent); color: #fff; }
.find-random { margin-bottom: 18px; }

.guide-photo { border-radius: var(--r-photo); margin: 8px 0 20px; aspect-ratio: 3 / 2; object-fit: cover; width: 100%; }
.guide h1 { font-size: var(--fs-24); margin: 16px 0 12px; line-height: 1.35; }
.guide h2 { margin-top: 32px; }
.policy h3 { font-size: var(--fs-15); margin: 20px 0 6px; } .policy h3:first-child { margin-top: 0; }
```

- [ ] **Step 6: 브라우저로 전체 신청 플로우** (임시 DB 서버)
  1. `#/` → 카드 → 날짜·회차 선택 → 신청하기 → 빈 폼으로 `신청 보내기` → 6개 오류 표시·첫 오류 포커스
  2. 전부 입력(신청 이유 10자 이상) → 제출 → `#/done` 접수번호 표시
  3. 같은 번호로 같은 일정 재신청 → 토스트 "이미 이 일정에 같은 번호로 신청했어요…"
  4. `#/find` → `토|오후` 선택 → 결과 → `이 중에서 골라주세요` → 카드 → 신청 제출 후 콘솔에서 해당 신청의 `selection_method='랜덤'`, `preferred_times` 확인 (`sqlite3` 대신 `node -e` 로 조회)
  5. 신청 폼에서 브라우저 뒤로가기 → 상세, 다시 앞으로 → 입력값 유지
  6. `#/guide`, `#/policy/terms` 표시, 430px·다크 스크린샷

- [ ] **Step 7: Commit**

```bash
git add public/assets/js/app.js public/assets/css/app.css
git commit -m "feat: 1단계 신청 폼(신청 이유 포함)·완료 타임라인·시간대 찾기·이용 안내·약관"
```

---

## Task 10: 참여 확인·평가 페이지 + style.css 제거

**Files:**
- Rewrite: `public/participation.html`, `public/review.html`
- Create: `public/assets/js/participation.js`, `public/assets/js/review.js`
- Modify: `public/assets/css/app.css` (링크 페이지 규칙)
- Delete: `public/assets/css/style.css`

**Interfaces:**
- Consumes: Task 4 응답 형태, `TT.countdown`, `TT.parseSqlDateTime`, `UI.*`, `SITE`

- [ ] **Step 1: HTML 껍데기 두 개** — 둘 다 아래 형태, `<title>` 과 마지막 스크립트만 다름(`참여 확인 — 오늘의 취향` + `participation.js` / `후기 남기기 — 오늘의 취향` + `review.js`). `<meta name="robots" content="noindex">` 포함.

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex">
<title>참여 확인 — 오늘의 취향</title>
<link rel="icon" href="/assets/icons/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/css/tokens.css">
<link rel="stylesheet" href="/assets/css/app.css">
</head>
<body>
<div class="shell link-page" id="app"><header class="topbar"><a class="wordmark" href="/">오늘의 취향<span class="dots"><i></i><i></i><i></i></span></a></header><div class="pad" id="box"><div class="skel" style="height:220px;margin-top:16px"></div></div></div>
<script src="/assets/js/site-config.js"></script>
<script src="/assets/js/core.js"></script>
<script src="/assets/js/ui.js"></script>
<script src="/assets/js/participation.js"></script>
</body>
</html>
```

- [ ] **Step 2: `participation.js`** (spec §4.7)

```js
(function () {
  'use strict';
  const { esc, won } = TT;
  const token = location.pathname.split('/').pop();
  const box = document.getElementById('box');
  let data = null, timer = null;

  const head = d => `<div class="link-head">${UI.cover(d.cover_url, { name: d.group_name, tag: d.group_name, field: '' }, 'link-thumb')}<div><b>${esc(d.group_name)}</b><span>${TT.fmtDateShort(d.date)} ${TT.timeRange(d.start_time, d.end_time)}</span><span>${esc(d.place)}</span></div></div>`;
  const payBox = (d, withCountdown) => {
    const p = d.payment;
    const account = p ? `<div class="pay-row"><dt>입금 계좌</dt><dd>${esc(p.bank)} <b class="num">${esc(p.account)}</b><br><span>${esc(p.holder)}</span></dd></div><button class="btn btn-line btn-block" data-copy="${esc(p.bank + ' ' + p.account)}">${UI.icon('copy')}계좌번호 복사</button>` : `<p class="muted">입금 계좌는 운영자가 카카오톡으로 안내해 드려요.</p>`;
    return `<dl class="paybox"><div class="pay-row"><dt>입금 금액</dt><dd><b class="num">${won(d.fee)}</b></dd></div>${account}
      ${withCountdown ? `<div class="pay-row"><dt>입금 기한</dt><dd><b class="num countdown" data-countdown>--:--:--</b> 남음<br><span>${esc(d.payment_deadline)}까지 · 지나면 자동 취소돼요</span></dd></div>` : `<div class="pay-row"><dt>입금 기한</dt><dd>참여 확정 후 10시간 안</dd></div>`}
      <p class="hint">신청자 이름(${esc(d.name)})으로 입금해 주세요.</p></dl>`;
  };
  const done = (title, body) => `<section class="link-body">${head(data)}<h1 class="serif">${title}</h1>${body}<a class="text-link center" href="${esc(SITE.kakaoChannelUrl)}" target="_blank" rel="noopener">${UI.icon('chat', 'icon icon-sm')} 카카오톡 채널로 문의하기</a></section>`;

  function render() {
    const d = data;
    clearInterval(timer);
    if (d.status === '승인') {
      box.innerHTML = `<section class="link-body">${head(d)}<h1 class="serif">${esc(d.name)}님, 신청이 승인됐어요</h1><p class="muted">참여할지 알려주세요. 참여를 누르면 아래 계좌로 10시간 안에 입금해 주시면 돼요.</p>${payBox(d, false)}
        <div class="bottom-bar stack"><button class="btn btn-primary btn-block" data-act="accept">참여할게요</button><button class="btn btn-secondary btn-block" data-act="decline">이번엔 참여하지 않을게요</button></div></section>`;
    } else if (d.status === '입금대기') {
      box.innerHTML = done('입금을 기다리고 있어요', `<p class="muted">입금이 확인되면 자리가 확정되고 카카오톡으로 알려드려요.</p>${payBox(d, true)}`);
      const deadline = TT.parseSqlDateTime(d.payment_deadline);
      const tick = () => { const c = TT.countdown(deadline, Date.now()); const el = box.querySelector('[data-countdown]'); if (el) el.textContent = c.text; if (c.expired) { clearInterval(timer); data.status = '자동취소'; render(); } };
      tick(); timer = setInterval(tick, 1000);
    } else if (['확정', '참석완료', '평가완료'].includes(d.status)) {
      box.innerHTML = done('참여가 확정됐어요', '<p class="muted">모임 전날 정확한 장소를 카카오톡으로 안내해 드려요.</p>');
    } else if (d.status === '자동취소') {
      box.innerHTML = done('입금 기한이 지나 취소됐어요', '<p class="muted">다시 참여하고 싶다면 새로 신청해 주세요.</p><a class="btn btn-secondary btn-block" href="/">다른 일정 보기</a>');
    } else if (d.status === '환불필요') {
      box.innerHTML = done('환불을 준비하고 있어요', '<p class="muted">정원이 먼저 찼거나 일정이 바뀌어 참여할 수 없게 됐어요. 입금액 전액을 돌려드려요.</p>');
    } else {
      box.innerHTML = done('이미 처리된 링크예요', '');
    }
  }

  box.addEventListener('click', async e => {
    const c = e.target.closest('[data-copy]'); if (c) return UI.copy(c.dataset.copy);
    const a = e.target.closest('[data-act]'); if (!a) return;
    if (a.dataset.act === 'decline') {
      UI.openSheet('이번엔 참여하지 않을까요?', `<p class="muted">참여하지 않으면 이 신청은 종료되고 자리는 다음 신청자에게 넘어가요.</p><button class="btn btn-primary btn-block" data-confirm-decline>참여하지 않을게요</button>`);
      document.querySelector('[data-confirm-decline]').onclick = () => { UI.closeSheet(); send(false); };
      return;
    }
    send(true);
  });
  async function send(accept) {
    try {
      box.querySelectorAll('button').forEach(b => { b.disabled = true; });
      const j = await UI.api('/api/public/participation/' + token, { method: 'POST', body: JSON.stringify({ accept }) });
      if (!accept) { box.innerHTML = done('참여하지 않기로 했어요', '<p class="muted">다음에 더 잘 맞는 모임에서 만나요.</p><a class="btn btn-secondary btn-block" href="/">다른 모임 보기</a>'); return; }
      Object.assign(data, { status: j.status, payment_deadline: j.paymentDeadline, payment: j.payment, fee: j.fee });
      render();
    } catch (err) { UI.toast(err.message); box.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
  }

  UI.api('/api/public/participation/' + token)
    .then(d => { data = d; render(); })
    .catch(() => { box.innerHTML = `<div class="empty">${UI.icon('info')}<h3>링크를 확인할 수 없어요</h3><p>이미 처리됐거나 주소가 잘못됐어요.</p><a class="btn btn-line" href="${esc(SITE.kakaoChannelUrl)}" target="_blank" rel="noopener">카카오톡 채널로 문의</a></div>`; });
})();
```

- [ ] **Step 3: `review.js`** (spec §4.8)

```js
(function () {
  'use strict';
  const { esc } = TT;
  const token = location.pathname.split('/').pop();
  const box = document.getElementById('box');
  const ITEMS = [['satisfaction', '전체 만족도'], ['progress', '진행'], ['place', '장소'], ['value', '가격 만족'], ['revisit', '다시 참여하고 싶어요']];
  const score = {};

  const stars = (k, big) => `<div class="stars${big ? ' is-big' : ''}" role="radiogroup" aria-label="${k}">${[1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" aria-checked="${score[k] === n}" aria-label="${n}점" data-k="${k}" data-n="${n}" class="${score[k] >= n ? 'is-on' : ''}">${UI.icon('star')}</button>`).join('')}</div>`;
  function render(d) {
    box.innerHTML = `<section class="link-body">
      <div class="link-head">${UI.cover(d.cover_url, { name: d.group_name, tag: d.group_name, field: '' }, 'link-thumb')}<div><b>${esc(d.group_name)}</b><span>${TT.fmtDateShort(d.date)} 참여</span></div></div>
      <h1 class="serif">${esc(d.name)}님, 모임은 어떠셨어요?</h1><p class="muted">1분이면 끝나요. 다음 모임을 준비하는 데 큰 도움이 돼요.</p>
      <div class="rate-main"><span>${ITEMS[0][1]}</span>${stars('satisfaction', true)}</div>
      <div class="rate-list">${ITEMS.slice(1).map(([k, l]) => `<div class="rate-row"><span>${l}</span>${stars(k)}</div>`).join('')}</div>
      <div class="field"><label for="r-text">한 줄 후기</label><textarea id="r-text" class="input" rows="4" maxlength="1000" placeholder="좋았던 점이나 아쉬웠던 점을 자유롭게 적어주세요."></textarea></div>
      <label class="agree"><input type="checkbox" id="r-pub"><span><em>선택</em> 후기를 서비스 소개에 공개해도 좋아요 (이름은 ${esc([...d.name][0])}** 으로 가려져요)</span></label>
      <details class="report"><summary>불편한 일이 있었나요?</summary><label class="agree"><input type="checkbox" id="r-report"><span>운영팀에 따로 알리고 싶어요</span></label><textarea id="r-report-text" class="input" rows="3" maxlength="1000" placeholder="운영팀만 볼 수 있어요."></textarea></details>
      <div class="bottom-bar"><button class="btn btn-primary btn-block" data-submit>후기 보내기</button></div>
    </section>`;
  }
  box.addEventListener('click', async e => {
    const s = e.target.closest('[data-k]');
    if (s) { score[s.dataset.k] = Number(s.dataset.n); s.parentElement.outerHTML = stars(s.dataset.k, s.dataset.k === 'satisfaction'); return; }
    if (!e.target.closest('[data-submit]')) return;
    const missing = ITEMS.find(([k]) => !score[k]);
    if (missing) return UI.toast(`'${missing[1]}' 점수를 골라주세요`);
    try {
      await UI.api('/api/public/review/' + token, { method: 'POST', body: JSON.stringify({ ...score, text: document.getElementById('r-text').value, publish_ok: document.getElementById('r-pub').checked, report: document.getElementById('r-report').checked, report_text: document.getElementById('r-report-text').value }) });
      box.innerHTML = `<section class="link-body"><span class="done-mark">${UI.icon('check')}</span><h1 class="serif">소중한 후기 고마워요</h1><p class="muted">다음 모임에서 또 만나요.</p><a class="btn btn-secondary btn-block" href="/">다른 모임 둘러보기</a></section>`;
    } catch (err) { UI.toast(err.message); }
  });
  UI.api('/api/public/review/' + token)
    .then(render)
    .catch(() => { box.innerHTML = `<div class="empty">${UI.icon('info')}<h3>이미 후기를 보냈거나 만료된 링크예요</h3><a class="btn btn-line" href="/">홈으로</a></div>`; });
})();
```

- [ ] **Step 4: 링크 페이지 CSS** (`app.css` 끝)

```css
.link-body { padding-top: 12px; display: grid; gap: 14px; }
.link-body h1 { margin: 8px 0 0; font-size: var(--fs-24); line-height: 1.35; }
.link-head { display: flex; gap: 12px; align-items: center; padding: 12px; border-radius: var(--r-btn); background: var(--bg-sunken); }
.link-thumb { width: 64px !important; height: 64px; aspect-ratio: 1; border-radius: 6px; object-fit: cover; flex: none; }
.link-thumb.cover-fallback .serif { font-size: var(--fs-12); } .link-thumb.cover-fallback small { display: none; }
.link-head div { display: grid; } .link-head b { font-size: var(--fs-15); } .link-head span { font-size: var(--fs-13); color: var(--ink-3); }
.paybox { margin: 0; padding: 16px; border-radius: var(--r-btn); border: 1px solid var(--line); display: grid; gap: 12px; }
.pay-row { display: grid; grid-template-columns: 72px 1fr; gap: 8px; font-size: var(--fs-14); }
.pay-row dt { color: var(--ink-3); } .pay-row dd { margin: 0; } .pay-row dd span { font-size: var(--fs-13); color: var(--ink-3); }
.pay-row b { font-size: var(--fs-17); }
.countdown { color: var(--warn); }
.bottom-bar.stack { flex-direction: column; }
.stars { display: inline-flex; gap: 2px; }
.stars button { width: 36px; height: 36px; display: grid; place-items: center; color: var(--ink-4); }
.stars.is-big button { width: 44px; height: 44px; } .stars.is-big .icon { width: 30px; height: 30px; }
.stars button.is-on { color: var(--accent); } .stars button.is-on .icon { fill: var(--accent); }
.rate-main { display: grid; justify-items: center; gap: 6px; padding: 16px 0; font-weight: 600; }
.rate-list { display: grid; gap: 4px; border-top: 1px solid var(--line); padding-top: 12px; }
.rate-row { display: flex; align-items: center; justify-content: space-between; font-size: var(--fs-14); }
.report summary { font-size: var(--fs-14); color: var(--ink-3); cursor: pointer; min-height: 44px; display: flex; align-items: center; }
.report .input { margin-top: 6px; }
```

- [ ] **Step 5: style.css 삭제·참조 확인**

```bash
git rm public/assets/css/style.css
grep -rn "style.css" public/ || echo "no references"
```
Expected: `no references`

- [ ] **Step 6: 브라우저 확인** (임시 DB 서버 + env `PAYMENT_ACCOUNT` 설정)
  1. `node -e` 로 `윤태호` participation_token 조회 → `/participation/<token>` : 승인 화면·계좌 표시 → `참여할게요` → 카운트다운 동작 → **새로고침해도 입금 대기 화면 유지** (Review Focus 1)
  2. 계좌 복사 → 토스트
  3. 다른 승인 건 만들어 `이번엔 참여하지 않을게요` → 확인 시트 → 종료 화면
  4. `백승현` review_token → `/review/<token>` : 별점 미선택 제출 → 토스트, 모두 선택 + 공개 동의 → 제출 → 감사 화면, 홈 `#/` 후기 섹션에 새 후기(텍스트 있을 때) 노출
  5. 잘못된 토큰 두 페이지 모두 안내 화면

- [ ] **Step 7: Commit**

```bash
git add public/participation.html public/review.html public/assets/js/participation.js public/assets/js/review.js public/assets/css/app.css
git commit -m "feat: 참여 확인 페이지(입금 계좌·카운트다운·상태별 안내)와 별점 평가 페이지, 구 style.css 제거"
```

---

## Task 11: 운영콘솔 재구성

**Files:**
- Rewrite: `public/admin.html` (껍데기), `public/assets/css/admin.css`
- Create: `public/assets/js/admin.js` (기존 인라인 스크립트 이전 후 수정)

**Interfaces:**
- Consumes: 기존 admin API 전부 + Task 4 (`groups` 새 필드, `PATCH /api/admin/reviews/:id`), `TT.*`
- Produces: 없음(최종 화면)

- [ ] **Step 1: 스크립트 이전** — 현재 `admin.html` 의 `<script>` 본문을 그대로 `public/assets/js/admin.js` 로 옮기고, `admin.html` 은 아래 껍데기로 교체. 이 시점에 브라우저에서 기존 기능이 그대로 동작하는지 확인(로그인·신청 목록 표시)한 뒤 커밋.

```html
<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>운영콘솔 — 오늘의 취향</title>
<link rel="icon" href="/assets/icons/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/css/tokens.css">
<link rel="stylesheet" href="/assets/css/admin.css">
</head>
<body>
<div id="root"></div>
<script src="/assets/js/core.js"></script>
<script src="/assets/js/admin.js"></script>
</body>
</html>
```

```bash
git add public/admin.html public/assets/js/admin.js
git commit -m "refactor: 운영콘솔 스크립트를 admin.js로 분리"
```

- [ ] **Step 2: 레이아웃·문구 교체** — `admin.js` 의 `render()` 를 사이드 내비 구조로:

```js
function render(){if(!S.user)return renderLogin();const admin=S.user.role==='admin';const nav=[['applications','신청 관리'],['schedules','일정'],...(admin?[['groups','모임체'],['operators','운영자'],['refunds','환불'],['reviews','후기']]:[])];
document.getElementById('root').innerHTML=`<div class="app"><aside class="side"><div class="brand">오늘의 취향<small>운영콘솔</small></div><nav>${nav.map(([k,t])=>`<button class="${S.page===k?'on':''}" onclick="go('${k}')">${t}</button>`).join('')}</nav><div class="me"><b>${esc(S.user.name)}</b><span>${admin?'총괄자':'운영자'}</span><button class="link" onclick="logout()">로그아웃</button></div></aside><main id="main" class="main"></main></div>`;}
```

`renderLogin()` 의 eyebrow 문구 `실제 DB 연동 운영콘솔` 을 제거하고 제목을 `운영콘솔 로그인`(부트스트랩 시 `처음 사용할 총괄자 계정 만들기`)으로. 사용자 화면에 노출되는 개발 문구 전체 검색: `grep -n "테스트\|PG\|mock\|DB 연동\|실제 DB" public/assets/js/admin.js` → 운영자에게 필요한 설명(예: "알림톡 연동 전에는 링크를 직접 전달하세요")만 남기고 나머지 삭제.

- [ ] **Step 3: 신청 관리 — 오늘 할 일 + 상태 탭 + 상세 패널** — `drawApps()` 교체:

```js
const APP_TABS=['전체','접수','승인','입금대기','확정','참석완료','평가완료','환불필요','거절','자동취소','참여포기','불참'];
function todo(){const now=Date.now(),t=TT.todayStr();return [
  ['검토 대기',S.apps.filter(a=>a.status==='접수').length,()=>{S.appTab='접수'}],
  ['입금 기한 3시간 이내',S.apps.filter(a=>a.status==='입금대기'&&a.payment_deadline&&TT.parseSqlDateTime(a.payment_deadline).getTime()-now<3*3600e3).length,()=>{S.appTab='입금대기'}],
  ['오늘 열리는 모임',S.schedules.filter(s=>s.date===t&&!s.cancelled).length,()=>go('schedules')],
  ['환불 대기',S.apps.filter(a=>a.status==='환불필요').length,()=>{S.appTab='환불필요'}]]}
function drawApps(){S.appTab=S.appTab||'전체';const counts=Object.fromEntries(APP_TABS.map(t=>[t,t==='전체'?S.apps.length:S.apps.filter(a=>a.status===t).length]));const list=S.apps.filter(a=>(S.appTab==='전체'||a.status===S.appTab)&&(!S.appQ||a.name.includes(S.appQ)||a.phone.includes(S.appQ)));
document.getElementById('main').innerHTML=head('운영','신청 관리','담당 모임체의 신청을 검토하고 처리합니다.')+`<div class="todo">${todo().map(([l,n],i)=>`<button class="todo-item${n?' has':''}" onclick="todoClick(${i})"><span>${l}</span><b class="num">${n}</b></button>`).join('')}</div>
<div class="tabs">${APP_TABS.filter(t=>counts[t]||t==='전체'||t==='접수').map(t=>`<button class="${S.appTab===t?'on':''}" onclick="S.appTab='${t}';drawApps()">${t} <span class="num">${counts[t]}</span></button>`).join('')}</div>
<div class="toolbar"><input class="input" placeholder="이름·전화번호 검색" value="${esc(S.appQ||'')}" oninput="S.appQ=this.value;drawAppRows()"></div>
<div class="split"><div class="table-wrap"><table class="table"><thead><tr><th>신청일</th><th>이름</th><th>모임 · 일정</th><th>상태</th></tr></thead><tbody id="appRows"></tbody></table></div><aside class="panel" id="appPanel"><p class="muted">왼쪽에서 신청을 선택하세요.</p></aside></div>`;drawAppRows();if(S.appSel)openApp(S.appSel)}
function todoClick(i){todo()[i][2]();if(S.page==='applications')drawApps()}
function drawAppRows(){const list=S.apps.filter(a=>(S.appTab==='전체'||a.status===S.appTab)&&(!S.appQ||a.name.includes(S.appQ)||a.phone.includes(S.appQ)));document.getElementById('appRows').innerHTML=list.length?list.map(a=>`<tr class="${S.appSel===a.id?'sel':''}" onclick="openApp(${a.id})"><td class="num">${esc(a.applied_at.slice(5,16))}</td><td><b>${esc(a.name)}</b><br><span class="muted">${a.age}세 · ${esc(a.job)}</span></td><td>${esc(a.group_name)}<br><span class="muted">${TT.fmtDateShort(a.date)} ${esc(a.start_time)}</span></td><td>${badge(a.status)}</td></tr>`).join(''):'<tr><td colspan="4" class="empty-row">해당하는 신청이 없어요</td></tr>'}
function openApp(id){S.appSel=id;const a=S.apps.find(x=>x.id===id);if(!a)return;document.querySelectorAll('#appRows tr').forEach(tr=>tr.classList.toggle('sel',tr.getAttribute('onclick')===`openApp(${id})`));
const acts={접수:`<button class="btn primary" onclick="approve(${a.id})">승인</button><button class="btn outline" onclick="rejectA(${a.id})">거절</button>`,승인:`<button class="btn outline" onclick="showParticipation(${a.id})">참여 링크 안내</button>`,입금대기:`<button class="btn primary" onclick="paid(${a.id})">입금 확인</button>`,확정:`<button class="btn primary" onclick="attendance(${a.id},true)">참석</button><button class="btn outline" onclick="attendance(${a.id},false)">불참</button>`}[a.status]||'';
document.getElementById('appPanel').innerHTML=`<div class="panel-head"><h2>${esc(a.name)}</h2>${badge(a.status)}</div><dl class="kv"><dt>연락처</dt><dd class="num">${esc(a.phone)}</dd><dt>나이 · 직업</dt><dd>${a.age}세 · ${esc(a.job)}${a.mbti?' · '+esc(a.mbti):''}</dd><dt>모임</dt><dd>${esc(a.group_name)}</dd><dt>일정</dt><dd>${TT.fmtDateLong(a.date)} ${esc(a.start_time)}~${esc(a.end_time)}</dd><dt>선호 시간대</dt><dd>${esc((a.preferred_times||[]).join(', ')||'-')}</dd><dt>선택 방식 · 유입</dt><dd>${esc(a.selection_method)} · ${esc(a.ad_source)}</dd>${a.payment_deadline?`<dt>입금 기한</dt><dd class="num">${esc(a.payment_deadline)}</dd>`:''}</dl><h3>신청 이유</h3><p class="quote">${esc(a.motivation||'(입력 없음)')}</p><div class="row">${acts}</div>`}
```

(`filterApps` 는 삭제하고 `drawAppRows` 로 대체. `approve/paid/attendance` 등 기존 액션은 유지하되 완료 후 `loadPage()` 다음 `openApp(id)` 로 패널 갱신.)

- [ ] **Step 4: 모임체 폼 섹션화 + 새 필드** — `groupForm(id)` 의 모달 본문을 다음 섹션 구성으로 교체하고 `saveGroup` 이 새 필드를 보낸다. 줄 단위 입력 헬퍼:

```js
const lines=v=>String(v||'').split('\n').map(x=>x.trim()).filter(Boolean);
const joinList=j=>TT.listOf(j).join('\n');
const joinPairs=j=>TT.pairsOf(j).map(p=>p.join('|')).join('\n');
```

섹션과 필드 id:
| 섹션 | 필드 (id → body 키) |
|---|---|
| 기본 정보 | `gfN→name`, `gfField→field`(select 만들기/배우기), `gfTag→tag`, `gfPlace→place`(동 이름), `gfDur→duration`, `gfFee→fee`, `gfTagline→tagline`, `gfExposed→exposed`(checkbox) |
| 사진 | `gfCover→cover_url`, `gfGallery→gallery`(lines) + 미리보기 `<img>` 썸네일 행 |
| 상세 콘텐츠 | `gfIntro→intro`(textarea, "문단은 빈 줄로 구분"), `gfForWhom→for_whom`(lines), `gfIncludes→includes`(lines), `gfOrder→order`(lines, 힌트 "소요시간\|내용, 예: 20분\|향 알아보기"), `gfPrep→prep`(lines) |
| 호스트 | `gfHost→host_name`, `gfRole→host_role`, `gfBio→host_bio`, `gfHostPhoto→host_photo_url` |
| 장소·정책 | `gfPlaceNote→place_note`, `gfFeeNote→fee_note`, `gfRefund→refund_policy`(textarea, 줄 단위), `gfFaq→faq`(lines → `split('|')`, 힌트 "질문\|답변") |

```js
async function saveGroup(id){let body={name:val('gfN'),field:val('gfField'),tag:val('gfTag'),place:val('gfPlace'),duration:val('gfDur'),fee:Number(val('gfFee')),tagline:val('gfTagline'),exposed:document.getElementById('gfExposed').checked,cover_url:val('gfCover').trim(),gallery:lines(val('gfGallery')),intro:val('gfIntro'),for_whom:lines(val('gfForWhom')),includes:lines(val('gfIncludes')),order:lines(val('gfOrder')),prep:lines(val('gfPrep')),host_name:val('gfHost'),host_role:val('gfRole'),host_bio:val('gfBio'),host_photo_url:val('gfHostPhoto').trim(),place_note:val('gfPlaceNote'),fee_note:val('gfFeeNote'),refund_policy:val('gfRefund'),faq:lines(val('gfFaq')).map(x=>x.split('|').map(s=>s.trim())).filter(p=>p.length>=2&&p[0]&&p[1])};try{await api(id?`/api/admin/groups/${id}`:'/api/admin/groups',{method:id?'PATCH':'POST',body:JSON.stringify(body)});closeModal();toast('저장했습니다.');loadPage()}catch(e){alert(e.message)}}
```

모임체 목록 카드에 **상세 채움 정도** 표시:

```js
function completeness(g){const checks=[g.cover_url,TT.listOf(g.gallery_json).length,g.intro&&g.intro.length>80,TT.listOf(g.for_whom_json).length,TT.listOf(g.includes_json).length,TT.listOf(g.order_json).length,g.host_bio,g.place_note];return `${checks.filter(Boolean).length}/${checks.length}`}
```
목록 각 행에 `<span class="muted">상세 ${completeness(g)}</span>`.

- [ ] **Step 5: 후기 화면 — 공개 여부·숨김 토글** — `drawReviews()` 각 카드에:

```js
`${r.publish_ok?'<span class="badge b-green">공개 동의</span>':'<span class="badge">비공개</span>'}${r.hidden?'<span class="badge b-red">숨김</span>':''}${r.publish_ok?`<button class="btn outline sm" onclick="toggleReview(${r.id},${r.hidden?0:1})">${r.hidden?'다시 공개':'공개 중지'}</button>`:''}`
```
```js
async function toggleReview(id,hidden){try{await api(`/api/admin/reviews/${id}`,{method:'PATCH',body:JSON.stringify({hidden:!!hidden})});toast(hidden?'공개를 중지했습니다.':'다시 공개했습니다.');loadPage()}catch(e){alert(e.message)}}
```

- [ ] **Step 6: `admin.css` 재작성** — tokens.css 변수만 사용. 필수 규칙:

```css
body { background: var(--bg-sunken); font-size: var(--fs-14); }
.app { display: grid; grid-template-columns: 220px 1fr; min-height: 100dvh; }
.side { position: sticky; top: 0; height: 100dvh; display: flex; flex-direction: column; gap: 20px; padding: 20px 14px; background: var(--bg); border-right: 1px solid var(--line); }
.side .brand { font-family: var(--serif); font-weight: 700; font-size: 18px; display: grid; } .side .brand small { font-family: var(--font); font-weight: 500; font-size: var(--fs-12); color: var(--ink-3); }
.side nav { display: grid; gap: 2px; } .side nav button { text-align: left; padding: 10px 12px; border-radius: 8px; color: var(--ink-2); font-weight: 500; }
.side nav button.on { background: var(--bg-sunken); color: var(--ink); font-weight: 700; }
.side .me { margin-top: auto; display: grid; font-size: var(--fs-13); } .side .me span { color: var(--ink-3); } .link { color: var(--ink-3); text-align: left; text-decoration: underline; margin-top: 6px; }
.main { padding: 28px 32px 60px; min-width: 0; }
.pageHead h1 { margin: 2px 0 4px; font-size: var(--fs-24); } .eyebrow { font-size: var(--fs-12); color: var(--ink-3); font-weight: 600; }
.muted { color: var(--ink-3); }
.todo { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0; }
.todo-item { display: grid; gap: 4px; text-align: left; padding: 14px 16px; border-radius: var(--r-btn); background: var(--bg); border: 1px solid var(--line); color: var(--ink-3); }
.todo-item b { font-size: var(--fs-24); color: var(--ink-4); } .todo-item.has b { color: var(--ink); } .todo-item.has:first-child b { color: var(--accent); }
.tabs { display: flex; gap: 4px; flex-wrap: wrap; border-bottom: 1px solid var(--line); margin-bottom: 12px; }
.tabs button { padding: 10px 12px; color: var(--ink-3); border-bottom: 2px solid transparent; margin-bottom: -1px; } .tabs button.on { color: var(--ink); border-color: var(--ink); font-weight: 700; }
.toolbar { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; } .toolbar .spacer { flex: 1; } .toolbar .input { max-width: 280px; }
.split { display: grid; grid-template-columns: 1fr 360px; gap: 16px; align-items: start; }
.table-wrap { background: var(--bg); border: 1px solid var(--line); border-radius: var(--r-btn); overflow: auto; }
.table { width: 100%; border-collapse: collapse; } .table th { text-align: left; font-weight: 500; color: var(--ink-3); font-size: var(--fs-12); padding: 10px 14px; border-bottom: 1px solid var(--line); }
.table td { padding: 12px 14px; border-bottom: 1px solid var(--line); vertical-align: top; } .table tr { cursor: pointer; } .table tr.sel td { background: var(--accent-soft); }
.empty-row { text-align: center; color: var(--ink-3); padding: 32px !important; cursor: default; }
.panel { position: sticky; top: 20px; background: var(--bg); border: 1px solid var(--line); border-radius: var(--r-btn); padding: 18px; }
.panel-head { display: flex; align-items: center; gap: 8px; } .panel-head h2 { margin: 0; font-size: var(--fs-20); flex: 1; }
.kv { display: grid; grid-template-columns: 96px 1fr; gap: 8px 10px; margin: 16px 0; } .kv dt { color: var(--ink-3); } .kv dd { margin: 0; }
.panel h3 { font-size: var(--fs-13); color: var(--ink-3); margin: 0 0 6px; } .quote { margin: 0 0 16px; padding: 12px; background: var(--bg-sunken); border-radius: 8px; white-space: pre-line; }
.row { display: flex; gap: 8px; flex-wrap: wrap; } .row.end { justify-content: flex-end; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 40px; padding: 0 16px; border-radius: 8px; font-weight: 600; border: 1px solid transparent; }
.btn.primary { background: var(--accent); color: #fff; } .btn.outline { border-color: var(--line); background: var(--bg); } .btn.sm { height: 32px; padding: 0 10px; font-size: var(--fs-13); } .btn.danger { color: var(--danger); border-color: var(--line); background: var(--bg); }
.badge { display: inline-flex; align-items: center; height: 22px; padding: 0 8px; border-radius: 4px; font-size: var(--fs-12); font-weight: 600; background: var(--bg-sunken); color: var(--ink-2); }
.b-green { background: var(--ok-soft); color: var(--ok); } .b-amber { background: #FBF0DC; color: var(--warn); } .b-red { background: var(--accent-soft); color: var(--danger); }
.input { width: 100%; min-height: 40px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); }
textarea.input { min-height: 88px; line-height: 1.6; }
.field { display: grid; gap: 4px; } .field label { font-size: var(--fs-13); font-weight: 600; } .field .hint { font-size: var(--fs-12); color: var(--ink-3); }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; } .full { grid-column: 1 / -1; }
.form-section { border-top: 1px solid var(--line); padding-top: 16px; margin-top: 16px; } .form-section > h3 { margin: 0 0 10px; font-size: var(--fs-15); }
.thumbs { display: flex; gap: 6px; flex-wrap: wrap; } .thumbs img { width: 72px; height: 54px; object-fit: cover; border-radius: 4px; }
.cards { display: grid; gap: 12px; } .card { background: var(--bg); border: 1px solid var(--line); border-radius: var(--r-btn); padding: 16px; }
.modalBack { position: fixed; inset: 0; background: var(--scrim); display: grid; place-items: center; z-index: 50; padding: 20px; }
.modal { width: min(720px, 100%); max-height: 90dvh; overflow: auto; background: var(--bg); border-radius: 12px; padding: 22px; } .modal h2 { margin: 0 0 14px; }
.toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: var(--ink); color: var(--bg); padding: 10px 16px; border-radius: 8px; z-index: 60; }
.loginShell { min-height: 100dvh; display: grid; place-items: center; padding: 20px; } .loginCard { width: min(380px, 100%); background: var(--bg); border: 1px solid var(--line); border-radius: 12px; padding: 28px; display: grid; gap: 12px; }
.loginCard .brand { font-family: var(--serif); font-weight: 700; font-size: 20px; }
@media (max-width: 800px) {
  .app { grid-template-columns: 1fr; }
  .side { position: sticky; height: auto; flex-direction: row; align-items: center; gap: 10px; padding: 10px 14px; overflow-x: auto; border-right: 0; border-bottom: 1px solid var(--line); z-index: 10; }
  .side nav { display: flex; } .side nav button { white-space: nowrap; } .side .me { margin: 0 0 0 auto; }
  .main { padding: 18px 14px 60px; }
  .todo { grid-template-columns: 1fr 1fr; }
  .split { grid-template-columns: 1fr; } .panel { position: static; }
  .grid2 { grid-template-columns: 1fr; }
}
```

기존 admin.js 가 사용하는 나머지 클래스(`stats`, `stat`, `checks` 등)는 `grep -o 'class="[^"]*"' public/assets/js/admin.js | sort -u` 로 목록을 뽑아 위 규칙에 없는 것마다 같은 토큰으로 규칙을 추가한다.

- [ ] **Step 7: 브라우저 확인** (임시 DB)
  - 총괄자 `tasteadmin`: 오늘 할 일 숫자 → 클릭 시 탭 전환, 신청 선택 → 패널에 신청 이유 → 승인 → 참여 링크 모달, 모임체 수정 → 새 필드 저장 → `#/g/:id` 반영, 후기 공개 중지 → 홈 후기 섹션에서 사라짐
  - 운영자 `seoyun`: 모임체·운영자·환불·후기 메뉴 없음, 담당 모임체 신청만 보임
  - 800px 이하 레이아웃 스크린샷, 다크(`data-theme="dark"`) 스크린샷

- [ ] **Step 8: Commit**

```bash
git add public/admin.html public/assets/js/admin.js public/assets/css/admin.css
git commit -m "feat: 운영콘솔 재구성 — 오늘 할 일, 상태 탭, 신청 상세 패널, 모임체 콘텐츠 편집, 후기 공개 관리"
```

---

## Task 12: QA·문서 마무리

**Files:**
- Modify: `.agents/AGENTS.md`, `README.md`(명령어·환경변수 절), `docs/design/02-redesign-plan.md`(상태)

- [ ] **Step 1: 전체 테스트**

Run: `npm test`
Expected: PASS 전체, 0 fail

- [ ] **Step 2: 화면 QA 스크린샷 매트릭스** — 430px / 1280px / 다크 × (홈, 상세 사진 있음, 상세 사진 없음, 신청 폼 오류 상태, 완료, 시간대 찾기, 참여 확인 3상태, 평가, 콘솔 신청 관리, 콘솔 모임체 폼). 각 스크린샷을 레퍼런스 분석 §4.1 "AI 느낌 원인 8가지" 체크리스트로 점검하고 발견한 문제는 이 Task 안에서 수정.

- [ ] **Step 3: 문구 점검**

```bash
grep -rn "테스트 버전\|PG 연동\|mock\|검증된\|실제 DB" public/ --include=*.js --include=*.html
```
Expected: 사용자 화면(app.js, participation.js, review.js, *.html)에서 0건. admin.js 의 운영자용 도움말만 허용.

- [ ] **Step 4: 이모지 점검**

```bash
node -e "const fs=require('fs');for(const f of ['public/assets/js/app.js','public/assets/js/participation.js','public/assets/js/review.js','public/index.html']){const m=fs.readFileSync(f,'utf8').match(/\p{Extended_Pictographic}/gu);console.log(f,m?m.join(''):'none')}"
```
Expected: 모두 `none`

- [ ] **Step 5: AGENTS.md 갱신** — 다음 내용으로 해당 절 수정:
  - 마이그레이션: "`lib/migrate.js` 의 `COLUMNS` 에만 추가한다(server.js·seed-demo.js 가 공유). 신규 DB용으로 `schema.sql` 에도 컬럼을 넣는다."
  - 명령어: `npm test` (node:test, 임시 DB로 서버를 띄워 API 검증)
  - 프론트엔드: 파일 구조(tokens.css / app.css / admin.css, core.js·ui.js·site-config.js·app.js…), 해시 라우트 목록, 토큰 정책(포인트 컬러 1색·이모지 금지)
  - 참여 토큰: "수락 후에도 입금 안내 재조회를 위해 유지, 거절 시 NULL"
  - 환경 변수 `PAYMENT_BANK/ACCOUNT/HOLDER`
  - `data/today_taste.sqlite` 대신 임시 DB로 확인하라는 경고

- [ ] **Step 6: README 갱신** — 실행 절에 `npm test`, `.env` 의 `PAYMENT_*` 설명, `public/assets/js/site-config.js` 를 운영 전 교체하라는 안내, `docs/design/03-image-guide.md` 로 AI 이미지를 채우는 방법 한 단락.

- [ ] **Step 7: 기획서 상태 갱신** — `02-redesign-plan.md` 상단 상태를 `구현 완료 (feat/redesign)` 로.

- [ ] **Step 8: Commit**

```bash
git add .agents/AGENTS.md README.md docs/design/02-redesign-plan.md public/
git commit -m "docs: 개편 후 구조·명령어·운영 설정 문서화, QA 수정"
```

---

## Spec coverage 점검표

| spec 절 | Task |
|---|---|
| §0 성공 기준 1~7 | 7, 8, 9, 10, 11, 12 |
| §1 D1~D6 | 5(D1·D3), 7(D2·D6), 3·9(D4), 3·10·11(D5) |
| §2 디자인 시스템 | 5, 6 |
| §3 라우팅 | 7, 9 |
| §4.1 홈 | 7 |
| §4.2 상세 | 8 |
| §4.3~4.4 신청·완료 | 9 |
| §4.5 공용 컴포넌트 | 6, 7 |
| §4.6 시간대 찾기 | 9 |
| §4.7 참여 확인 | 4, 10 |
| §4.8 평가 | 4, 10 |
| §4.9 운영콘솔 | 4, 11 |
| §5 데이터·API | 1, 2, 3, 4 |
| §6 파일 구조 | 1, 5, 6, 7, 10, 11 |
| §7 단계·임시 DB | 전 Task |
| §8 위험(빈 콘텐츠·폰트 폴백·사진) | 8 Step 4, 5 Step 4, 2 Step 3 |
| 03 이미지 가이드 | 2 |
