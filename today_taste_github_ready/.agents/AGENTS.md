# AGENTS.md

This file provides guidance to AI coding agents (Codex, Claude Code, etc.) when working with code in this repository.

## 프로젝트 개요

"오늘의 취향" — 소모임(모임체) 신청·운영 서비스.

**서비스 컨셉 (기능·확장·디자인·문구를 정하기 전에 반드시 `docs/CONCEPT.md` 를 읽는다)**: 진행자 1명 + 참여자 2명, **최대 3명**이 편하게 듣는 **원데이 클래스**. 가볍게 시작하지만 새로운 나와 내 취향을 발견하는 시작점이 되는 곳. 중심 대상은 **20대**(30대까지, 신청 나이 19~35), 지역은 대구. 한 회차 인원을 늘리거나, 실력을 요구하거나, 첫 신청을 번거롭게 만드는 방향은 컨셉과 맞지 않는다.

기술 구조: **Node.js(>=20) + Express + SQLite(better-sqlite3)** 단일 서버에 빌드 단계 없는 정적 HTML 프론트엔드를 붙인 구조다. UI 문구, DB 상태값, 에러 메시지는 모두 한국어다.

## 명령어

```bash
npm install
cp .env.example .env          # JWT_SECRET 변경 필요 (PORT, DB_PATH, TRUST_PROXY)
npm start                     # node server.js → http://localhost:3000 (운영콘솔: /admin.html)
npm run dev                   # node --watch server.js
npm run dev:demo              # 화면 확인·시연용: 임시 DB(data/dev_temp.sqlite)를 필요 시 데모로 새로 만들고 --watch 실행 (-- --keep 이면 유지)
npm run seed:demo             # 빈 DB에 데모 데이터 삽입
npm run seed:demo:reset       # 기존 DB를 데모 데이터로 완전 초기화
docker compose up -d --build  # Docker 배포 (DB는 ./data 볼륨에 보존)
npm test                      # node:test. 임시 DB로 시드+서버를 띄워 API·순수 로직(core.js)을 검증
```

린트·빌드 도구는 없다. 화면 확인은 브라우저로 하되 **반드시 임시 DB**를 쓴다: `npm run dev:demo`(`scripts/dev-demo.js`, 데모 DB가 없거나 `seed-demo.js` 가 바뀌었거나 날짜가 지나면 자동 재생성) 또는 `DB_PATH=<임시경로> npm run seed:demo:reset` 후 같은 DB_PATH로 서버 실행. `data/today_taste.sqlite` 는 git 추적 대상이고 cron이 매분 상태를 바꾼다.

데모 계정(seed): 총괄자 `tasteadmin` / `Taste!2026`, 운영자 `seoyun`·`minjae`·`jiwoo` / `TasteOp!2026`. 사용자가 0명인 DB에서는 운영콘솔 첫 접속 시 `/api/auth/bootstrap` 으로 초기 총괄자를 생성한다.

## 아키텍처

### 백엔드: `server.js` 한 파일
- 모든 라우트, 인증, cron이 `server.js` 에 있다. 많은 핸들러가 한 줄로 압축되어 있으니 수정 시 해당 스타일을 유지한다.
- `.env` 는 dotenv 없이 자체 `loadEnv()` 로 읽는다. `process.env.TZ='Asia/Seoul'` 이며, SQL 시각은 모두 `datetime('now','localtime')` 을 쓴다.
- 서버 시작 시 `lib/migrate.js` 의 `migrate(db)` 가 `schema.sql` 을 실행하고(`CREATE TABLE IF NOT EXISTS`) 기존 DB에 없는 컬럼을 `ALTER TABLE ADD COLUMN` 으로 추가한다. **컬럼을 추가할 때는 `lib/migrate.js` 의 `COLUMNS` 와 `schema.sql` 두 곳만 고친다** (server.js 와 scripts/seed-demo.js 가 같은 함수를 쓴다).
- **Windows 주의**: `process.env.TZ='Asia/Seoul'` 은 Windows의 SQLite(`localtime`)가 해석하지 못해 개발 PC에서 SQL 시각이 실제 KST와 어긋난다(Linux/Docker는 정상). 그래서 브라우저에 남은 시간을 보여줄 때는 SQL로 계산한 남은 초(`payment_seconds_left`)를 내려주고 클라이언트는 `TT.deadlineFromSeconds` 로 변환한다. 원시 SQL 시각을 브라우저 시계와 비교하지 말 것.
- 모든 상태 변경은 `audit()` 로 `audit_logs` 에 기록하고, 신청자에게 가야 할 알림은 `notify()` 로 `notifications` 테이블에 `queued` 레코드만 쌓는다(카카오 알림톡 미연동, mock 큐).

### 권한 모델
- 역할: `admin`(총괄자), `operator`(운영자). JWT를 `Authorization: Bearer` 로 전달, `auth` 미들웨어가 매 요청 DB에서 사용자·`active` 를 재확인한다.
- `adminOnly`: 모임체 CRUD, 운영자 관리, 환불/평가/알림 조회.
- `canManageGroup(user, groupId)`: 운영자는 `operator_groups` 에 배정된 모임체만 처리 가능. 신청자/일정 관련 라우트는 이 검사를 핸들러 안에서 직접 호출한다.
- 라우트 prefix: `/api/public/*`(비로그인 신청자), `/api/auth/*`, `/api/admin/*`.

### 신청 상태 머신 (`applications.status`, 한국어 문자열)
```
접수 →(승인: participation_token 발급)→ 승인 →(신청자가 /participation/:token 에서 수락)→ 입금대기(10시간 기한)
                    ↘ 거절                    ↘ 참여포기
입금대기 →(운영자 입금확인, confirmPayment 트랜잭션)→ 확정 | 환불필요(정원 초과·일정 취소 시 refunds 레코드 생성)
입금대기 →(cron 매분, 기한 초과)→ 자동취소
확정 →(출석 처리)→ 참석완료(review_token 발급) | 불참
참석완료 →(신청자가 /review/:token 에서 평가 제출)→ 평가완료
일정 취소 시 확정 → 환불필요 (+ refunds)
```
- 정원 계산은 `확정`·`참석완료`·`평가완료` 상태를 합산한다(공개 API의 `remaining`, `confirmPayment` 모두 동일 기준).
- 참여 토큰은 수락 후에도 입금 안내 재조회를 위해 유지하고(수락/거절 처리는 `승인` 상태에서 한 번만), 거절·출석 처리 시 NULL로 비우고, 모임일로부터 7일이 지나면 만료된다(`lib/retention.js`). 출석 처리는 `확정` 상태이고 모임이 시작된 뒤에만 가능하다. 개인정보는 `lib/retention.js` 가 매일 보유 기간(무입금 30일·입금 5년)이 지난 신청을 파기한다. 평가 토큰은 제출 후 NULL. PG 가상계좌 미연동이라 입금 확인은 수동이며 계좌는 `.env` 의 `PAYMENT_BANK/ACCOUNT/HOLDER` 로 안내한다.
- 공개 API는 모임별 `stats`(진행 횟수·참여 인원·평점)와 공개 후기(`publish_ok=1 AND hidden=0`, 이름 마스킹)를 내려준다. 신청은 서버에서 나이 19~35·전화 형식·신청 이유 10~300자·지난/마감 일정을 검증한다.

### 프론트엔드: `public/`
- 번들러·프레임워크 없음. HTML은 껍데기이고 스크립트는 `public/assets/js/` 에 있다(읽기 쉬운 여러 줄 스타일).
  - `core.js`: 순수 함수(날짜·시간·좌석·검증·해시 파싱·필터·카운트다운). UMD라 `tests/core.test.js` 와 `server.js`(이름 가림·직업 목록)에서 require 한다. 로직은 가능하면 여기에 두고 테스트한다.
  - `ui.js`: 아이콘(인라인 SVG), 좌석 점, 커버 이미지(없거나 실패 시 타이포그래피 대체), api, toast, 시트. `site-config.js`: 상호·사업자 정보·고객센터·개인정보 보호책임자(운영 전 교체). `policy.js`: 이용약관·개인정보처리방침·신청 동의문 본문(보유 기간은 `lib/retention.js`, 환불 기준은 `core.js` `REFUND_RULES` 와 일치해야 함).
  - `app.js`: 신청자 SPA. 해시 라우트 `#/`, `#/g/:id`, `#/g/:id/apply?s=`, `#/done`, `#/find`, `#/guide`, `#/policy/:tab`. `routes`/`actions` 테이블 + `data-action` 이벤트 위임.
  - `admin.js`: 운영콘솔(PC 전용, 800px 이하에서는 PC 권장 안내만 표시). `participation.js`, `review.js`: 토큰 링크 페이지(서버가 `/participation/:token`, `/review/:token` 으로 HTML 서빙).
- CSS: `tokens.css`(유일한 기준) → `app.css`(신청자·링크 페이지) / `admin.css`(콘솔). 규칙은 아래 "디자인 작업 규칙".
- 모임체 상세 정보(진행 순서, 준비물, FAQ)는 `groups` 테이블의 `*_json` TEXT 컬럼에 JSON 문자열로 저장된다.
- 사진: DB에는 주소만 저장한다. 총괄자가 운영콘솔에서 올린 사진은 `POST /api/admin/uploads`(`lib/upload.js`, JPG·PNG·WebP 5MB 이하, 파일 시그니처로 검사)가 DB 파일 옆 `uploads/`(기본 `data/uploads/`, git 제외)에 저장하고 `/uploads/파일명` 으로 제공한다. **백업·서버 이전·DB 교체 작업 시 `uploads/` 를 DB와 함께 다룬다**(git에 없어서 빠뜨리면 사진이 사라진다). `public/assets/img/groups`·`hosts` 는 데모 시연용 더미 사진이다(운영 전 정리, `docs/STATUS.md` P0).

## 디자인 작업 규칙 (화면·CSS·문구를 고칠 때 반드시)

화면을 바꾸는 작업은 사람이든 에이전트든 이 규칙을 따른다. 1~3번은 `npm test`(`tests/assets.test.js`)가 검사한다.

1. **값은 토큰으로만**: `app.css`·`admin.css` 에 색(hex·rgba), 글자 크기, 모서리 반경, z-index, 여백(padding·margin·gap)을 숫자로 쓰지 않고 `public/assets/css/tokens.css` 의 `var(--토큰)` 을 쓴다. 여백은 `--sp-숫자`(숫자=px, 4px 단위 기본). 예외는 1px(테두리 보정), 위치 좌표(top·left 로 그리는 점·선), 크기(width·height)뿐이다.
2. **새 값이 꼭 필요하면** tokens.css 의 맞는 구역에 `--이름: 값;` 과 설명 주석을 한 줄로 추가한다. 비슷한 토큰이 이미 있으면 그것을 쓴다(1~2px 차이로 새 토큰을 만들지 않는다).
3. **정의되지 않은 토큰을 쓰지 않는다.** 다크 테마 색을 추가하면 tokens.css 아래 두 다크 블록에 모두 넣는다.
4. **있는 부품을 먼저 쓴다**: 새 버튼·배지·칩·입력칸을 만들기 전에 `/styleguide.html`(서버 실행 후)에서 기존 클래스(`.btn` `.chip` `.choice` `.badge` `.seats` `.field` `.notice` `.sheet` 등)를 확인하고 재사용한다. 운영콘솔은 `admin.css` 의 `.btn.primary/.outline/.danger/.sm`, `.badge.b-green/.b-amber/.b-red`.
5. **시각 원칙**: 포인트 컬러는 `--accent` 하나(화면당 핵심 1곳), 상태색은 상태 표시에만. 이모지 금지, 아이콘은 `ui.js` 인라인 SVG. 그라데이션·유리 효과·색 그림자 금지(사진 위 글자용 `--photo-shade` 만 예외). 버튼은 알약형 금지, "카드 안의 카드" 금지. 숫자에는 `.num`, 페이지 제목·모임 이름에는 `.heading`(Pretendard 800). 글꼴은 Pretendard 하나다. 로고는 선으로 그린 SVG 글자(`core.js` 의 `TT.LOGO_SVG`)이고, 화면에는 태그라인을 얹은 `TT.LOGO_HTML`(흑백이 필요하면 `TT.LOGO_MONO_HTML`)을 넣는다(모든 화면 공용, 따로 그리지 않는다). 파비콘은 별표 타일(`icons/favicon.svg`)이다. 명조는 쓰지 않는다(`docs/CONCEPT.md`). 터치 영역 최소 44px.
6. **문구**: 해요체, 한 문장에 한 정보. 형용사보다 숫자·사실. 버튼은 결과를 말한다(`신청 보내기`). 오류는 원인 + 해결 방법.
7. **확인**: `npm test` 통과, 신청자 화면은 480px 폭에서, 라이트·다크 모두 확인. 운영콘솔은 PC 화면 기준(휴대폰 대응은 하지 않는다).

자세한 배경과 화면별 설계는 `docs/design/02-redesign-plan.md`(2장 디자인 시스템, 4장 화면 설계).

## 배포 관련 참고
- GitHub Pages로는 실행 불가(Express + SQLite 필요). VPS/Docker 등 Node 실행 가능한 서버에 배포한다.
- `.devcontainer/devcontainer.json`, `.github/workflows/ci.yml` 은 저장소에 없다 (README에서도 언급을 제거함).
- `data/today_taste.sqlite` 가 git에 추적되어 있다(`.gitignore` 에는 `data/*.sqlite` 가 있지만 이미 커밋된 상태). 샘플 개인정보가 담겨 있으므로 DB 변경분을 커밋할 때 주의한다.

## 작업 현황 문서 (`docs/STATUS.md`) — 반드시 갱신

이 프로젝트는 작업을 에이전트에게 위임하고 협업자와 함께 진행한다. `docs/STATUS.md` 가 현재 상황·공유 사항·할 일의 단일 기준이다. **사용자가 따로 요청하지 않아도** 아래 규칙대로 갱신한다.

- **언제**: 기능·API·DB 스키마·환경 변수·운영 설정·테스트·배포에 영향을 주는 변경을 커밋할 때, 할 일 항목을 끝냈을 때, 새로 발견한 문제나 해야 할 일이 생겼을 때. 같은 커밋(또는 바로 다음 커밋)에 함께 넣는다.
- **무엇을**:
  - 2장 "날짜별 구현 기록": 오늘 날짜(`YYYY-MM-DD`) 절이 없으면 맨 위에 새로 만들고, DB·서버/API·신청자 기능·운영콘솔 기능·개발 환경으로 나눠 한 줄씩 적는다. 어느 브랜치에 있고 병합됐는지도 적는다.
  - 1장 "협업자가 꼭 알아야 할 것": 다른 사람의 코드·환경·데이터에 영향을 주는 변경(응답 형태, 필수 입력, 새 env, 마이그레이션, 파일 이동, 정책 변경)이면 표에 추가하거나 고친다. 알려진 문제가 해결되면 지운다.
  - 3장 "해야 할 일": 끝난 항목은 지우고 2장에 기록한다. 새 할 일은 우선순위(P0 운영 전 필수 / P1 이미지 / P2 기능 개선 / P3 작은 개선 / 범위 밖)에 맞춰 넣는다. 이미지 슬롯을 채우면 P1 표에서 지우고 `docs/design/image-credits.md` 에 기록한다.
  - 상단 "마지막 갱신" 날짜와 현재 브랜치 상태(병합 여부, 테스트 결과)를 고친다.
- **적지 않는 것**: 색·여백·폰트·문구 같은 순수 디자인 변경 (사용자가 직접 바꾸며 기능에 영향이 없다).
- 문서는 협업자가 읽으므로 짧고 구체적으로 쓴다: 무엇이 바뀌었는지, 누가 무엇을 해야 하는지, 파일·엔드포인트 이름.
