# GitHub / 모바일 / 배포 안내

## 1. GitHub 저장소에 올리기
1. GitHub에서 새 저장소를 만듭니다. (예: `today-taste`)
2. 이 폴더의 **내용물 전체**를 저장소 루트에 업로드합니다.
3. `.env`는 절대 업로드하지 않습니다. `.env.example`만 저장소에 둡니다.

## 2. GitHub에서 바로 테스트: Codespaces
GitHub 저장소에서 `Code` → `Codespaces` → `Create codespace on main`을 누르면 됩니다.
`.devcontainer/devcontainer.json` 때문에 Node 22 설치와 `npm install`이 자동으로 진행되고 3000번 포트가 열립니다.

포트 공개 범위가 Private이면 모바일에서 같은 GitHub 계정으로 로그인해야 접근할 수 있습니다. 다른 사람에게 테스트 링크를 줄 때만 Ports 메뉴에서 3000 포트를 Public으로 바꾸세요.

> Codespaces는 개발/테스트용입니다. Codespace가 중지되면 홈페이지도 중지됩니다.

## 3. 실제 상시 운영
GitHub Pages는 정적 HTML만 호스팅하므로 이 프로젝트의 Express API + SQLite DB를 실행할 수 없습니다.
실서비스는 GitHub 저장소를 소스 원본으로 두고, Node/Docker를 실행할 수 있는 서버(VPS/클라우드)에 배포해야 합니다.

### Docker 서버에서 실행
```bash
cp .env.example .env
# .env의 JWT_SECRET을 긴 임의 문자열로 변경

docker compose up -d --build
```
DB는 `./data` 폴더에 보존됩니다. 서버 이전/백업 시 `data/today_taste.sqlite`를 함께 백업하세요.

## 4. 모바일 UI
- 신청자 화면은 430px 기준 모바일 UI를 기본으로 하고, PC에서는 모바일 프레임 형태로 표시됩니다.
- 운영콘솔은 800px 이하에서 메뉴가 가로 스크롤형 탭으로 바뀌고 입력/카드/모달이 모바일 너비에 맞춰집니다.
- `viewport-fit=cover`가 적용되어 모바일 브라우저와 인앱 브라우저에서도 폭이 맞습니다.

## 5. 디자인 수정 위치
- 신청자/참여확인/평가: `public/assets/css/style.css`
- 운영콘솔: `public/assets/css/admin.css`

색상은 각 CSS 파일 상단의 `:root` 변수를 수정하면 전체에 반영됩니다.

## 6. 꼭 바꿔야 하는 운영 값
`.env`:
```env
PORT=3000
JWT_SECRET=아주_긴_랜덤_문자열
DB_PATH=./data/today_taste.sqlite
TRUST_PROXY=0
```

외부 배포 시에는 HTTPS 도메인과 프록시 구성을 추가하고, 카카오 알림톡/PG 키는 프론트 HTML이 아니라 서버 환경변수에 저장하세요.
