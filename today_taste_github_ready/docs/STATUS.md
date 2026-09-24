# 작업 현황 — 오늘의 취향

> **이 문서의 용도**: 협업자와 작업을 위임받은 에이전트가 ① 지금 어떤 상태인지 ② 무엇을 공유받아야 하는지 ③ 다음에 무엇을 해야 하는지 한 곳에서 파악하기 위한 문서입니다.
> **기록 범위**: 기능·API·DB·운영 설정처럼 **다른 사람의 작업에 영향을 주는 변경**만 적습니다. 색·여백·문구 같은 디자인 변경은 기능에 영향이 없으므로 적지 않습니다.
> **갱신 규칙**: 작업할 때마다 이 문서를 함께 갱신합니다(에이전트 지침: `.agents/AGENTS.md` 의 "작업 현황 문서" 절).

**마지막 갱신**: 2026-09-24 · **현재 브랜치 상태**: 개편 작업은 `feat/redesign` 에 있고 **`main` 에 아직 병합되지 않았습니다** (커밋 25개, 테스트 44/44 통과).

---

## 1. 협업자가 꼭 알아야 할 것 (공유 필수)

`feat/redesign` 을 받으면 아래가 달라집니다.

| 구분 | 내용 | 해야 할 일 |
|---|---|---|
| DB 스키마 | `groups` 에 `cover_url, gallery_json, for_whom_json, includes_json, fee_note, host_bio, host_photo_url, place_note`, `applications` 에 `motivation, marketing_ok, purged_at`, `reviews` 에 `publish_ok, hidden` 컬럼 추가 | 없음 — 서버를 켜면 기존 DB에 자동으로 추가됩니다 |
| 마이그레이션 위치 | 컬럼 추가 목록이 `lib/migrate.js` 의 `COLUMNS` 한 곳으로 모였습니다 (전에는 server.js와 seed-demo.js에 복제) | 앞으로 컬럼을 추가할 때는 `lib/migrate.js` 와 `schema.sql` 만 고칩니다 |
| 환경 변수 | `PAYMENT_BANK`, `PAYMENT_ACCOUNT`, `PAYMENT_HOLDER` 추가 (참여 확인 페이지에 표시할 입금 계좌) | 각자 `.env` 에 추가. 비워두면 "운영자가 카카오톡으로 안내" 문구가 나옵니다 |
| 사이트 설정 | 상호·사업자 정보·고객센터 채널이 `public/assets/js/site-config.js` 에 자리표시 값으로 들어 있습니다 | 운영 전 실제 값으로 교체 |
| 신청 API | `POST /api/public/applications` 가 **`motivation`(신청 이유, 10~300자)을 필수로** 받습니다. 나이 19~35, 전화 `010-0000-0000`, **이름 20자 이내, 직업은 `대학생·직장인·프리랜서·기타` 중 하나**(목록은 `core.js` 의 `TT.JOBS`), 지난 회차(시작 시각 기준)·마감 회차·취소 일정은 400으로 거절합니다 | 신청 화면을 따로 만드는 경우 `motivation` 을 보내고 직업은 목록 값만 보냅니다 |
| 일정 API | `POST/PATCH /api/admin/schedules` 가 날짜 `YYYY-MM-DD`, 시간 `HH:MM`, 정원 1 이상, 참가비 0 이상이 아니면 400으로 거절합니다 | 스크립트로 일정을 넣는다면 형식을 맞춥니다 |
| 참여 링크 정책 | 참여 토큰이 **수락 후에도 유지**됩니다(입금 안내를 다시 보기 위함). 수락·거절은 `승인` 상태에서 한 번만 가능하고, 거절·출석 처리 때 지웁니다. **모임일로부터 7일이 지나면 만료(404)** 되고, 이미 시작한 모임은 수락할 수 없습니다. 일정이 취소되거나 모임체가 폐쇄되면 수락을 막고 `schedule_cancelled: true` 를 내려줍니다 | AGENTS.md 의 "토큰은 일회용" 설명은 이 내용으로 바뀌었습니다 |
| 공용 로직 | `server.js` 가 `public/assets/js/core.js` 를 `require` 합니다(이름 가림 `maskName`, 직업 목록 `JOBS`, 이름 길이 `NAME_MAX`) | `core.js` 를 옮기거나 브라우저 전용 코드를 넣지 마세요 |
| 출석 처리 | `POST /api/admin/applications/:id/attendance` 는 **`확정` 상태이고 모임이 시작된 뒤에만** 됩니다. 잘못 누른 `불참` 은 `참석` 으로 바꿀 수 있고, `참석완료` 는 되돌릴 수 없습니다. 목록 API에 `started` 추가 | 모임 전에는 콘솔에 출석 버튼이 보이지 않습니다 |
| 개인정보 보유·파기 | `lib/retention.js` 가 매일 04:00 실행: 입금 기록 없는 신청은 모임일+30일, 입금 기록 있는 신청은 모임일+5년 뒤 이름·연락처·신청 이유 등을 되돌릴 수 없게 지웁니다(`purged_at`). 총괄자는 삭제 요청 시 콘솔에서 즉시 파기(`POST /api/admin/applications/:id/purge`, 입금 기록 있으면 거절)·마케팅 수신 철회(`/marketing-off`) 가능 | 기간을 바꾸려면 `lib/retention.js` 와 `policy.js` 를 함께 고칩니다(테스트가 두 곳이 일치하는지 검사) |
| 약관·처리방침·환불 | 본문은 `public/assets/js/policy.js`, 공통 환불 기준은 `core.js` 의 `REFUND_RULES`. 모임별 환불 규정을 비우면 공통 기준이 보이고, 모임 규정이 공통 기준보다 불리하면 약관상 공통 기준이 적용됩니다. 신청 폼의 선택 동의(새 모임 소식)가 이제 `marketing_ok` 로 저장됩니다 | `site-config.js` 에 `privacyOfficer`, `hostingProvider`, `policyEffectiveDate` 를 실제 값으로 채웁니다 |
| 후기 공개 | 평가 제출 시 `publish_ok`(공개 동의)를 받습니다. 공개 API에는 **공개 동의 + 숨기지 않은 + 본문이 있는** 후기만 이름을 `박**` 형태로 가려서 나갑니다. 총괄자가 콘솔에서 숨길 수 있습니다(`PATCH /api/admin/reviews/:id`) | 기존 평가는 모두 비공개로 취급됩니다 |
| 남은 시간 계산 | 입금 기한까지 남은 시간은 서버가 `payment_seconds_left` 로 계산해서 내려줍니다 (아래 Windows 시간대 문제 때문) | 브라우저에서 SQL 시각을 직접 현재 시각과 비교하지 마세요 |
| 프론트 구조 | 인라인 스크립트가 `public/assets/js/*.js` 로 분리됐습니다. 신청자 앱은 해시 라우트(`#/`, `#/g/:id`, `#/g/:id/apply?s=`, `#/done`, `#/find`, `#/guide`, `#/policy/:tab`)를 씁니다. `public/assets/css/style.css` 는 삭제됐습니다 | 기존 파일을 고치던 작업이 있다면 새 위치로 옮겨야 합니다 |
| 디자인 토큰 | 색·글꼴·글자 크기·반경·z-index·**여백(`--sp-숫자`)** 은 `public/assets/css/tokens.css` 에서만 정합니다. `app.css`·`admin.css` 에 값을 직접 쓰면 `npm test` 가 실패합니다. 토큰 목록과 견본은 **`/styleguide.html`** (서버 실행 후 열기). 사람·에이전트 공통 규칙은 `.agents/AGENTS.md` 의 "디자인 작업 규칙" | 화면을 고치기 전에 그 규칙을 읽고, 새 값이 필요하면 tokens.css 에 이름·값·설명 주석을 한 줄로 추가 |
| 테스트 | `npm test` (Node 내장 test runner, 새 의존성 없음). 임시 DB로 서버를 띄워 API를 검증합니다 | PR 전에 실행 |
| 데모 DB | git에 올라간 `data/today_taste.sqlite` 는 **다시 만들지 않았습니다**(사용자 데이터가 있을 수 있음). 새 데모 콘텐츠(사진·후기)를 보려면 임시 DB로 `DB_PATH=./data/demo.sqlite npm run seed:demo:reset` | 화면 확인은 항상 임시 DB로 |

### 알려진 문제

- **Windows 개발 환경의 시간대 문제 (기존부터 있던 문제)**: `process.env.TZ='Asia/Seoul'` 을 Windows의 SQLite가 해석하지 못해, SQL에 기록되는 시각이 실제 한국 시각보다 약 8시간 늦습니다. Linux와 Docker에서는 정상입니다. 서버 안에서의 비교(cron 자동취소 등)는 같은 시계끼리라 문제가 없고, 화면에 남은 시간을 보여주는 곳은 서버가 계산한 값을 쓰도록 우회했습니다.

---

## 2. 날짜별 구현 기록 (기능·백엔드)

### 2026-09-24 — 프론트엔드 개편과 운영 기능 보강 (`feat/redesign`, 미병합)

기획 근거: [01-reference-analysis.md](design/01-reference-analysis.md), [02-redesign-plan.md](design/02-redesign-plan.md) · 구현 계획: [plans/2026-09-24-frontend-redesign.md](superpowers/plans/2026-09-24-frontend-redesign.md)

**여백 토큰·디자인 작업 규칙 (같은 날 추가)**
- 여백 토큰 `--sp-2`~`--sp-64`(숫자 = px), 하단 바 공간 `--space-bottom`. padding·margin·gap 의 직접 px 값을 모두 토큰으로 바꿈. 척도 밖 값 몇 곳은 가까운 값으로 맞춤(3·5→4, 7→8, 22·26→24, 60→64 px)
- 테스트가 여백 직접 값도 검사(1px 테두리 보정만 예외)
- `.agents/AGENTS.md` 에 "디자인 작업 규칙" 7항목 추가: 토큰만 사용, 기존 부품 재사용, 시각·문구 원칙, 확인 방법. 새 세션·다른 에이전트도 같은 규칙을 읽음

**디자인 토큰 정리 (같은 날 추가)**
- `tokens.css` 를 구역별(색·글꼴·글자 크기·반경·레이아웃·쌓임 순서·움직임)로 정리하고 설명 주석을 붙임. 사진 위 색·반경·z-index·로고 글자 크기 토큰 추가, CSS에 남은 직접 값 제거(화면 변화 없음)
- `/styleguide.html`: tokens.css 를 읽어 색 견본·글자 크기·반경·컴포넌트를 라이트/다크로 보여주는 페이지
- 테스트: CSS에 직접 색·반경·z-index·글자 크기를 쓰거나 정의되지 않은 토큰을 쓰면 실패

**약관·개인정보·링크 만료·출석 검사 (같은 날 추가)**
- 이용약관·개인정보처리방침 작성 (`policy.js`): 전자상거래법·개인정보 보호법·정보통신망법, 소비자분쟁해결기준(공연업 준용)을 근거로 함. 신청 화면 동의문도 법정 4항목(목적·항목·보유기간·거부 권리)으로 교체
- 공통 환불 기준 `REFUND_RULES` (4일 전 전액 / 3~2일 전 20% 공제 / 1일 전 30% / 당일 90% / 입금 후 24시간 내 전액). 이용 안내·FAQ·모임 상세에 반영
- 개인정보 자동 파기(`lib/retention.js`, 매일 04:00), 총괄자 즉시 파기·마케팅 수신 철회 버튼, 마케팅 동의 저장(`marketing_ok`)
- 참여 링크 만료(모임일+7일), 시작한 모임 수락 차단, 출석 처리 상태·시각 검사
- 운영콘솔: 800px 이하 화면에 "PC 이용 권장" 안내 (휴대폰 대응은 하지 않기로 함)

**남은 작업 정리 (이미지 제외, 같은 날 추가)**
- 보안: 운영콘솔 `scheduleForm` 값 이스케이프 + 일정 API 형식 검증 (운영자가 총괄자 화면에 스크립트를 심을 수 있던 경로 차단)
- 서버/API: `GET /api/public/groups/:id/reviews` 신규(모임의 공개 후기 전체), 신청 API 직업 허용 목록·이름 20자 제한, 출석 처리 시 참여 토큰 삭제, 이름 가림을 `core.js` `maskName` 으로 통일
- 신청자: "후기 전체 보기"가 전체 목록을 불러옴, 잘못된 URL 해시에서 빈 화면 대신 "모임을 찾을 수 없어요", `#app` 의 `aria-live` 제거(페이지 제목만 `#route-status` 로 알림), 신청 실패(400) 시 좌석 수 다시 불러오기, 전화번호 입력 커서 위치 유지, 직업만 오류일 때 직업 버튼에 포커스, 호스트 사진 실패 시 이니셜로 대체
- 평가 페이지: 공개 동의 문구의 이름 가림을 서버와 같은 규칙으로(두 글자 이름 `김*`)
- 운영콘솔: `입금대기` 신청에 "입금 안내 링크" 버튼, 신청 상세에 처리 이력(접수·승인·참여 확정·입금 확인·출석)
- 테스트: 37개. `tests/core-tz.test.js` 가 core 테스트를 `America/Los_Angeles` 에서 다시 실행

**DB·서버**
- `lib/migrate.js` 추가: schema.sql 실행 + 누락 컬럼 자동 추가를 한 곳에서 처리 (server.js·seed-demo.js 공용)
- 새 컬럼 11개 (1장 표 참고)
- `GET /api/public/groups`: 모임별 `stats`(`sessions_done` 진행 횟수, `participants` 누적 참여, `rating_avg`, `review_count`)와 `reviews`(최신 공개 후기 5개), 응답 최상위 `reviews`(전체 최신 공개 후기 8개) 추가. **이미 시작한 회차는 목록에서 제외** (전에는 날짜만 비교해서 당일 지난 회차도 보였음)
- `POST /api/public/applications`: 서버 검증 추가 (나이·전화·신청 이유·지난 회차·마감·취소). 중복 신청 오류 문구 변경
- `GET/POST /api/public/participation/:token`: `fee, place, cover_url, payment{bank,account,holder}, payment_seconds_left, schedule_cancelled` 추가. 수락 후 토큰 유지. 취소된 일정은 수락 거절
- `GET/POST /api/public/review/:token`: `cover_url, date` 추가, `publish_ok` 저장, 제출 시 감사 로그 기록
- `POST/PATCH /api/admin/groups`: 새 콘텐츠 필드 저장 (`gallery, for_whom, includes` 는 배열로 받음). PATCH에서 보내지 않은 필드는 기존 값 유지
- `PATCH /api/admin/reviews/:id` 신규 (총괄자만, `hidden` 토글, 감사 로그)
- `GET /api/admin/applications`: `payment_seconds_left` 추가
- 시드(`scripts/seed-demo.js`): 5개 모임 상세 콘텐츠·사진 경로·지난 회차 4개·공개 후기·데모 신청 이유 추가

**신청자 기능**
- 모임 상세 안에서 날짜·회차를 고르고 바로 신청 (전에는 상세에서 신청해도 시간대 선택부터 다시 시작)
- 신청 폼에 "신청 이유" 필수 문항
- 브라우저 뒤로가기·상세 링크 공유 가능 (해시 라우터)
- 참여 확인 페이지: 입금 금액·계좌·계좌 복사·남은 시간 카운트다운, 상태별 안내(입금대기/확정/자동취소/환불필요/일정 취소)
- 평가 페이지: 별점 5항목, 공개 동의, 문제 신고 분리

**운영콘솔 기능**
- 신청 관리: "오늘 할 일"(검토 대기·입금 기한 3시간 이내·오늘 열리는 모임·환불 대기), 상태 탭, 신청 상세 패널(신청 이유·선호 시간대·유입 경로·입금 남은 시간)
- 승인된 신청의 참여 링크를 다시 볼 수 있음 (링크 복사)
- 모임체 폼: 사진 주소·추가 사진·추천 대상·포함 사항·진행 순서(`소요시간|내용`)·호스트 소개·오시는 길·참가비 포함 내역 편집, 목록에 "상세 채움 정도" 표시
- 후기: 공개 여부 표시, 공개 중지/다시 공개

**이미지**
- AI 이미지 생성 파이프라인 확인: Google Antigravity CLI(`agy`)의 `generate_image` 로 생성 → Claude가 검토·크롭해 반영. 드로잉 모임 커버(`img/groups/drawing-cover.jpg`) 적용, 시드에 경로 연결
- ⚠️ 이미지 생성 모델(`gemini-3.1-flash-image`) 계정 한도가 있어 한 번에 여러 장 요청하면 429로 막힌다. 오늘은 16:57 KST 이후 재개 가능

**개발 환경**
- 에이전트 지침 공유: `.agents/AGENTS.md`, `CLAUDE.md` 가 git으로 추적된다(`.gitignore` 에서 제외 해제). 협업자의 에이전트도 같은 규칙(이 문서 자동 갱신 포함)을 따른다
- 로컬 개발 서버 실행 스킬 추가: `.agents/skills/start-dev-server/SKILL.md` (Claude Code와 Antigravity 공용, `CLAUDE.md`에 참조 추가)
- `npm test` 추가 (API·마이그레이션·순수 로직 28개 테스트)
- 스톡 이미지 10장 추가 (출처: [image-credits.md](design/image-credits.md))

### 2026-09-23 — 초기 업로드

- 실제 DB/API 연동 버전 업로드: Express + SQLite 단일 서버, 신청자 모바일 SPA, 운영콘솔, 참여·평가 링크 페이지, 신청 상태 머신, cron 자동취소, mock 알림 큐, 감사 로그
- `.gitignore`, `.env.example`, `data/.gitkeep`, `package-lock.json` 추가

---

## 3. 해야 할 일 (우선순위순)

담당자를 정하면 항목 앞에 `[이름]` 을 붙이고, 끝나면 2장 날짜별 기록으로 옮깁니다.

### P0 — 운영 전 반드시

- [ ] **`feat/redesign` 병합 여부 결정** (병합 / PR / 보류)
- [ ] `.env` 에 `PAYMENT_BANK / PAYMENT_ACCOUNT / PAYMENT_HOLDER` 실제 입금 계좌 설정
- [ ] `public/assets/js/site-config.js` 의 상호·대표·사업자등록번호·통신판매업·주소·이메일·카카오톡 채널 주소·운영시간을 실제 값으로 교체
- [ ] `.env` 의 `JWT_SECRET` 변경, 데모 계정 비밀번호 변경
- [ ] git에 올라간 `data/today_taste.sqlite` 의 샘플 개인정보 처리 방침 결정 (추적 해제 또는 교체)
- [ ] `site-config.js` 의 `privacyOfficer`(개인정보 보호책임자), `hostingProvider`(서버 호스팅 업체), `policyEffectiveDate`(시행일) 입력
- [ ] 배포 서버에 HTTPS 적용 (개인정보처리방침 "안전성 확보 조치"에 적혀 있음)
- [ ] 모임 호스트와 개인정보 처리 위탁 계약서 작성 (개인정보 보호법 제26조, 처리방침 5항)
- [ ] 운영 DB의 모임별 환불 규정 점검: "당일 환불 불가"처럼 공통 기준보다 불리한 문구가 있으면 운영콘솔에서 지우거나 고치기 (데모 시드는 비움)

### P1 — 이미지 생성 (AI) · 가이드: [03-image-guide.md](design/03-image-guide.md)

생성 방법: Claude에게 "agy로 이미지 만들어줘"라고 요청하면 Antigravity CLI로 생성 → 검토 → 적용까지 진행합니다(스킬 `agy-collaborator`). 이미지 모델 한도 때문에 **한 번에 2~3장씩, 순서대로** 요청합니다. 사진이 없는 자리는 지금 모임명 글자나 이니셜로 대체돼 있습니다. 만든 파일을 `public/assets/img/` 에 넣고 운영콘솔 모임체 폼의 사진 주소 칸에 경로를 입력하면 바로 반영됩니다. 넣은 뒤에는 [image-credits.md](design/image-credits.md) 에 기록합니다.

| 우선 | 슬롯 | 파일 경로(권장) | 프롬프트 |
|---|---|---|---|
| 1 | 드로잉 모임 갤러리 2장 (커버는 2026-09-24 적용 완료) | `img/groups/drawing-1.jpg`, `drawing-2.jpg` | 가이드 §4.5 |
| 2 | 호스트 사진 5장 (얼굴 없이 손·작업 공간) | `img/hosts/perfume.jpg` 등 5개 | 가이드 §4.8 |
| 3 | 홈 배너 교체 (지금은 크롭한 스톡 사진) | `img/brand/home-banner.jpg` (덮어쓰기) | 가이드 §4.1 |
| 4 | 이용 안내 헤더 (없으면 자동으로 숨김) | `img/brand/guide.jpg` | 가이드 §4.2 |
| 5 | 공유 미리보기 OG (지금은 커피 사진 크롭) | `icons/og.jpg` (덮어쓰기) | 가이드 §4.3 |
| 6 | 향수·커피·가죽 갤러리 보충 (선택) | 기존 갤러리에 추가 | 가이드 §4.4, §4.6 |
| 7 | 필름 모임 커버 + 갤러리 (현재 비공개 모임이라 나중에) | `img/groups/film-*.jpg` | 가이드 §4.7 |

### P2 — 기능 개선 (운영하며 필요)

- [ ] 환불 금액 자동 계산 (지금은 공통 기준표를 보고 운영자가 직접 계산)

### P3 — 작은 개선

- (없음)

### 범위 밖 (결정 필요 시 논의)

PG 가상계좌 자동 입금 확인, 카카오 알림톡 실제 발송(지금은 `notifications` 테이블에 쌓이기만 함), 회원가입·찜, 지도 임베드, 이미지 업로드 기능, 희망 일정 알림 신청, 신청 API 요청 수 제한

---

## 4. 참고 문서

| 문서 | 내용 |
|---|---|
| [README.md](../README.md) | 실행 방법, 운영 전 체크리스트, 파일 구조 |
| [design/01-reference-analysis.md](design/01-reference-analysis.md) | 문토·남의집 레퍼런스 분석 |
| [design/02-redesign-plan.md](design/02-redesign-plan.md) | 개편 기획서 (디자인 원칙, 화면 설계, API 변경) |
| [/styleguide.html](../public/styleguide.html) | 디자인 토큰 견본 (서버 실행 후 `http://localhost:3000/styleguide.html`) |
| [design/03-image-guide.md](design/03-image-guide.md) | 이미지 슬롯·규격·AI 프롬프트 |
| [design/image-credits.md](design/image-credits.md) | 사용한 이미지 출처 |
| [superpowers/plans/2026-09-24-frontend-redesign.md](superpowers/plans/2026-09-24-frontend-redesign.md) | 개편 구현 계획 |
