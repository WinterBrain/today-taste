# 작업 현황 — 오늘의 취향

> **이 문서의 용도**: 협업자와 작업을 위임받은 에이전트가 ① 지금 어떤 상태인지 ② 무엇을 공유받아야 하는지 ③ 다음에 무엇을 해야 하는지 한 곳에서 파악하기 위한 문서입니다.
> **기록 범위**: 기능·API·DB·운영 설정처럼 **다른 사람의 작업에 영향을 주는 변경**만 적습니다. 색·여백·문구 같은 디자인 변경은 기능에 영향이 없으므로 적지 않습니다.
> **갱신 규칙**: 작업할 때마다 이 문서를 함께 갱신합니다(에이전트 지침: `.agents/AGENTS.md` 의 "작업 현황 문서" 절).

**마지막 갱신**: 2026-09-24 · **현재 브랜치 상태**: 개편 작업은 `feat/redesign` 에 있고 **`main` 에 아직 병합되지 않았습니다** (커밋 19개, 테스트 28/28 통과).

---

## 1. 협업자가 꼭 알아야 할 것 (공유 필수)

`feat/redesign` 을 받으면 아래가 달라집니다.

| 구분 | 내용 | 해야 할 일 |
|---|---|---|
| DB 스키마 | `groups` 에 `cover_url, gallery_json, for_whom_json, includes_json, fee_note, host_bio, host_photo_url, place_note`, `applications` 에 `motivation`, `reviews` 에 `publish_ok, hidden` 컬럼 추가 | 없음 — 서버를 켜면 기존 DB에 자동으로 추가됩니다 |
| 마이그레이션 위치 | 컬럼 추가 목록이 `lib/migrate.js` 의 `COLUMNS` 한 곳으로 모였습니다 (전에는 server.js와 seed-demo.js에 복제) | 앞으로 컬럼을 추가할 때는 `lib/migrate.js` 와 `schema.sql` 만 고칩니다 |
| 환경 변수 | `PAYMENT_BANK`, `PAYMENT_ACCOUNT`, `PAYMENT_HOLDER` 추가 (참여 확인 페이지에 표시할 입금 계좌) | 각자 `.env` 에 추가. 비워두면 "운영자가 카카오톡으로 안내" 문구가 나옵니다 |
| 사이트 설정 | 상호·사업자 정보·고객센터 채널이 `public/assets/js/site-config.js` 에 자리표시 값으로 들어 있습니다 | 운영 전 실제 값으로 교체 |
| 신청 API | `POST /api/public/applications` 가 **`motivation`(신청 이유, 10~300자)을 필수로** 받습니다. 나이 19~35, 전화 `010-0000-0000`, 지난 회차(시작 시각 기준)·마감 회차·취소 일정은 400으로 거절합니다 | 신청 화면을 따로 만드는 경우 `motivation` 을 보내야 합니다 |
| 참여 링크 정책 | 참여 토큰이 **수락 후에도 유지**됩니다(입금 안내를 다시 보기 위함). 수락·거절은 `승인` 상태에서 한 번만 가능하고, 거절하면 토큰을 지웁니다. 일정이 취소되거나 모임체가 폐쇄되면 수락을 막고 `schedule_cancelled: true` 를 내려줍니다 | AGENTS.md 의 "토큰은 일회용" 설명은 이 내용으로 바뀌었습니다 |
| 후기 공개 | 평가 제출 시 `publish_ok`(공개 동의)를 받습니다. 공개 API에는 **공개 동의 + 숨기지 않은 + 본문이 있는** 후기만 이름을 `박**` 형태로 가려서 나갑니다. 총괄자가 콘솔에서 숨길 수 있습니다(`PATCH /api/admin/reviews/:id`) | 기존 평가는 모두 비공개로 취급됩니다 |
| 남은 시간 계산 | 입금 기한까지 남은 시간은 서버가 `payment_seconds_left` 로 계산해서 내려줍니다 (아래 Windows 시간대 문제 때문) | 브라우저에서 SQL 시각을 직접 현재 시각과 비교하지 마세요 |
| 프론트 구조 | 인라인 스크립트가 `public/assets/js/*.js` 로 분리됐습니다. 신청자 앱은 해시 라우트(`#/`, `#/g/:id`, `#/g/:id/apply?s=`, `#/done`, `#/find`, `#/guide`, `#/policy/:tab`)를 씁니다. `public/assets/css/style.css` 는 삭제됐습니다 | 기존 파일을 고치던 작업이 있다면 새 위치로 옮겨야 합니다 |
| 테스트 | `npm test` (Node 내장 test runner, 새 의존성 없음). 임시 DB로 서버를 띄워 API를 검증합니다 | PR 전에 실행 |
| 데모 DB | git에 올라간 `data/today_taste.sqlite` 는 **다시 만들지 않았습니다**(사용자 데이터가 있을 수 있음). 새 데모 콘텐츠(사진·후기)를 보려면 임시 DB로 `DB_PATH=./data/demo.sqlite npm run seed:demo:reset` | 화면 확인은 항상 임시 DB로 |

### 알려진 문제

- **Windows 개발 환경의 시간대 문제 (기존부터 있던 문제)**: `process.env.TZ='Asia/Seoul'` 을 Windows의 SQLite가 해석하지 못해, SQL에 기록되는 시각이 실제 한국 시각보다 약 8시간 늦습니다. Linux와 Docker에서는 정상입니다. 서버 안에서의 비교(cron 자동취소 등)는 같은 시계끼리라 문제가 없고, 화면에 남은 시간을 보여주는 곳은 서버가 계산한 값을 쓰도록 우회했습니다.
- **운영콘솔 일정 수정 폼의 이스케이프 누락 (기존부터 있던 문제)**: `admin.js` 의 `scheduleForm` 이 날짜·시간 값을 이스케이프하지 않고 넣습니다. 운영자 계정이 총괄자 화면에 스크립트를 심을 수 있는 경로입니다.

---

## 2. 날짜별 구현 기록 (기능·백엔드)

### 2026-09-24 — 프론트엔드 개편과 운영 기능 보강 (`feat/redesign`, 미병합)

기획 근거: [01-reference-analysis.md](design/01-reference-analysis.md), [02-redesign-plan.md](design/02-redesign-plan.md) · 구현 계획: [plans/2026-09-24-frontend-redesign.md](superpowers/plans/2026-09-24-frontend-redesign.md)

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
- [ ] 운영콘솔 `scheduleForm` 의 날짜·시간 값 이스케이프 (1장 "알려진 문제")
- [ ] 약관·개인정보처리방침 문구 법률 검토 (현재 초안)
- [ ] Windows 서버로 배포할 계획이라면 시간대 문제 해결 (Linux/Docker 배포면 불필요)

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

- [ ] 운영콘솔: `입금대기` 신청에도 참여 링크 재발송 버튼 (지금은 `승인` 상태에만 있음)
- [ ] 운영콘솔: 신청 상세 패널에 상태 이력 (승인·참여 확정·입금 시각)
- [ ] 참여 토큰 유효 기간 정책 (지금은 확정·자동취소 후에도 링크가 살아 있음)
- [ ] "후기 전체 보기"가 최대 5개만 보여줌 → 전체 목록 API 또는 "최근 후기"로 문구 변경
- [ ] 800px 이하 운영콘솔(로그인 후) 화면을 실제 기기에서 확인
- [ ] 신청 API: 직업 값 허용 목록 검증, 이름 길이 제한

### P3 — 작은 개선

- [ ] 잘못된 URL 해시(`#/g/%E0` 등)에서 앱이 빈 화면이 되는 문제 (`core.js` `parseHash` 예외 처리)
- [ ] 신청자 앱 `#app` 의 `aria-live` 정리 (화면 전체를 다시 읽음)
- [ ] 마감 오류 후 좌석 수 새로고침, 전화번호 입력 커서 위치, 직업만 오류일 때 포커스, 호스트 사진 로드 실패 시 대체 표시
- [ ] 평가 페이지의 이름 가림 표시(`김**`)와 서버 마스킹(두 글자 이름 `김*`) 통일
- [ ] 날짜 테스트를 음수 시간대(예: `America/Los_Angeles`)에서도 실행

### 범위 밖 (결정 필요 시 논의)

PG 가상계좌 자동 입금 확인, 카카오 알림톡 실제 발송(지금은 `notifications` 테이블에 쌓이기만 함), 회원가입·찜, 지도 임베드, 이미지 업로드 기능, 희망 일정 알림 신청, 신청 API 요청 수 제한

---

## 4. 참고 문서

| 문서 | 내용 |
|---|---|
| [README.md](../README.md) | 실행 방법, 운영 전 체크리스트, 파일 구조 |
| [design/01-reference-analysis.md](design/01-reference-analysis.md) | 문토·남의집 레퍼런스 분석 |
| [design/02-redesign-plan.md](design/02-redesign-plan.md) | 개편 기획서 (디자인 원칙, 화면 설계, API 변경) |
| [design/03-image-guide.md](design/03-image-guide.md) | 이미지 슬롯·규격·AI 프롬프트 |
| [design/image-credits.md](design/image-credits.md) | 사용한 이미지 출처 |
| [superpowers/plans/2026-09-24-frontend-redesign.md](superpowers/plans/2026-09-24-frontend-redesign.md) | 개편 구현 계획 |
