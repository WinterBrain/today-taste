---
name: start-dev-server
description: >-
  Use this skill when the user asks to start, run, or launch the local development server (e.g., '개발 서버 실행', '개발 서버 켜줘', '서버 실행', '로컬 서버 실행').
---

# 로컬 개발 서버 실행 가이드 (Start Dev Server)

사용자가 "개발 서버 실행", "서버 켜줘", "로컬 서버 실행" 등을 요청하면 **데모 데이터(사진·후기·일정 포함)가 채워진 임시 DB**로 로컬 서버를 백그라운드에서 켜고 접속 정보를 안내합니다. 방금 클론한 컴퓨터에서도 이 절차 하나로 시연 화면이 똑같이 보여야 합니다.

## 알아둘 것

- **`npm start` 로 바로 켜지 않습니다.** 기본 DB `data/today_taste.sqlite` 는 git에 올라간 초기 버전이라 사진 주소·새 후기가 없습니다(사진 대신 글자 대체 화면이 보임). 또 서버 cron이 매분 이 파일을 바꿔서 git 변경이 생깁니다.
- 데모 콘텐츠의 기준은 **`scripts/seed-demo.js`** 입니다. 어떤 모임에 어떤 사진(`public/assets/img/groups`·`hosts`, git에 있음)을 쓸지가 여기 있어서, DB 파일이 없어도 이 스크립트로 같은 데모 DB를 만들 수 있습니다.
- `npm run dev:demo` (`scripts/dev-demo.js`) 가 임시 DB `data/dev_temp.sqlite`(git 제외)를 아래 경우에 **자동으로 새로 만들고** `node --watch` 로 서버를 켭니다.
  - 임시 DB가 없을 때 (새로 클론한 컴퓨터)
  - `scripts/seed-demo.js` 가 바뀌었을 때 (pull 로 새 사진·후기가 들어옴)
  - 마지막 시드가 오늘이 아닐 때 (데모 일정 날짜가 시드한 날 기준이라, 며칠 지나면 모두 지난 일정이 됨)
- 새로 만들면 임시 DB에서 콘솔로 고친 내용은 사라집니다. 사용자가 **"데이터 유지"** 를 요청하면 `npm run dev:demo -- --keep` 을 씁니다.
- 운영콘솔에서 올린 사진은 `data/uploads/`(git 제외)에 저장됩니다. 다른 컴퓨터로 넘어가지 않습니다.

## 실행 절차

1. **포트 확인**: 3000 포트가 이미 열려 있으면 중복 실행하지 않고 접속 URL만 안내합니다. 이미 떠 있는 서버가 다른 DB를 쓰는지 궁금하면 `http://localhost:3000/api/health` 의 `database` 값을 봅니다(`dev_temp.sqlite` 여야 함).
2. **의존성 확인**: `node_modules` 가 없으면(새로 클론한 경우) 먼저 `npm install` 을 실행합니다.
3. **서버 백그라운드 실행**: `npm run dev:demo` (PowerShell·Bash 공통, 환경 변수 설정 불필요). 출력 첫 줄 `[dev:demo] ...` 로 임시 DB를 새로 만들었는지, 기존 것을 썼는지 확인합니다.
4. **완료 및 접속 정보 안내**: 서버가 뜬 것을 확인한 뒤 알립니다. 임시 DB를 새로 만들었다면 그 이유(출력 첫 줄)도 함께 알립니다.
   - **신청자 페이지**: http://localhost:3000
   - **운영 콘솔**: http://localhost:3000/admin.html
   - **데모 계정**: 총괄자 `tasteadmin` / `Taste!2026`, 운영자 `seoyun` / `TasteOp!2026`

## 문제가 생기면

- **사진이 안 보이고 글자만 나옴**: 서버가 `data/today_taste.sqlite` 로 떠 있는 것입니다(`npm start`/`npm run dev` 로 켠 경우). 그 서버를 끄고 `npm run dev:demo` 로 다시 켭니다.
- **모임이 모두 지난 일정으로 보임**: `--keep` 으로 켰거나 날짜가 바뀐 뒤 서버를 계속 켜 둔 경우입니다. `--keep` 없이 다시 켭니다.
