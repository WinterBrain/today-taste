---
name: start-dev-server
description: >-
  Use this skill when the user asks to start, run, or launch the local development server (e.g., '개발 서버 실행', '개발 서버 켜줘', '서버 실행', '로컬 서버 실행').
---

# 로컬 개발 서버 실행 가이드 (Start Dev Server)

사용자가 "개발 서버 실행", "서버 켜줘", "로컬 서버 실행" 등의 요청을 했을 때 로컬 개발 서버를 백그라운드로 안전하게 실행하고 접속 정보를 안내합니다.

## 주의 사항 (AGENTS.md 준수)
- `data/today_taste.sqlite`는 Git 추적 대상이며, 서버 내부 cron이 매분 상태를 갱신합니다.
- 따라서 로컬 개발 및 화면 확인 시에는 원본 DB 오염을 방지하기 위해 **임시 DB (`data/dev_temp.sqlite`)** 사용을 권장합니다.

## 실행 절차

1. **포트 확인**:
   - 기본 포트(3000)가 이미 열려있는지 확인합니다. 이미 실행 중이라면 중복 실행하지 않고 접속 URL을 안내합니다.

2. **임시 DB 준비**:
   - `data/dev_temp.sqlite` 파일이 없는 경우 데모 시드를 먼저 생성합니다:
     - PowerShell: `$env:DB_PATH="data/dev_temp.sqlite"; npm run seed:demo:reset`
     - Bash: `DB_PATH=data/dev_temp.sqlite npm run seed:demo:reset`

3. **서버 백그라운드 실행**:
   - 변경 감지(watch)가 포함된 개발 모드로 백그라운드(Daemon) 실행합니다:
     - PowerShell: `$env:DB_PATH="data/dev_temp.sqlite"; npm run dev`
     - Bash: `DB_PATH=data/dev_temp.sqlite npm run dev`

4. **완료 및 접속 정보 안내**:
   - 서버 실행 확인 후 사용자에게 접속 URL과 테스트 계정을 안내합니다:
     - **신청자 페이지**: http://localhost:3000
     - **운영 콘솔**: http://localhost:3000/admin.html
     - **데모 계정**:
       - 총괄 관리자: `tasteadmin` / `Taste!2026`
       - 운영자: `seoyun` / `TasteOp!2026`
