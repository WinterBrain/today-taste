# 이미지 출처

모든 스톡 사진은 Unsplash License(https://unsplash.com/license)로 사용한다. 원본은 `https://unsplash.com/photos/{ID}`.
내려받을 때 imgix 파라미터로 리사이즈·크롭했다(`w, h, fit=crop, q=78`).

| 파일 | Unsplash ID | 비고 |
|---|---|---|
| img/groups/perfume-cover.jpg | -eOwKJhd6k8 | |
| img/groups/perfume-1.jpg | -ZaKKlJUoHE | 1차 후보(-j6LLsAehUo)는 브랜드 로고 노출로 탈락 |
| img/groups/perfume-2.jpg | -JxrCmKGOAw | |
| img/groups/coffee-cover.jpg | F0XGFD9Z1Uk | |
| img/groups/coffee-1.jpg | 7RYrEvbqFM8 | 1차 후보(pp8qhUH3znQ)는 매장 로고·외국어 표지판으로 탈락 |
| img/groups/coffee-2.jpg | pLPZjZL8cII | 1차 후보(5R2jbsSOeXM)는 컵 로고로 탈락 |
| img/groups/leather-cover.jpg | GPdWubhjq-Q | |
| img/groups/leather-1.jpg | JNpmCYZID68 | 1차 후보(an44PeEll_w)는 커버와 같은 장면이라 탈락 |
| img/groups/leather-2.jpg | rhP8U-86GZA | 1차 후보(Ff-5OCJ341g)는 지나치게 어수선해 탈락 |

## AI 생성 이미지

Google Antigravity CLI(`agy` 1.2.9)의 내장 `generate_image` 도구(모델 `gemini-3.1-flash-image`)로 생성하고 Claude가 검토·크롭했다. 프롬프트 본문은 03-image-guide.md §4 + §4.0 공통 스타일 문구.

| 파일 | 슬롯 | 생성일 | 비고 |
|---|---|---|---|
| img/groups/drawing-cover.jpg | 드로잉 커버 (§4.5 cover) | 2026-09-24 | 원본 1200×896 → 1200×900. 배경 손님이 작게 보이나 식별 불가 수준이라 승인 |
| img/groups/drawing-1.jpg | 드로잉 갤러리 (§4.5 g1) | 2026-09-24 | 원본 1200×896에서 펜 부분(브랜드 글자처럼 보이는 인쇄)을 잘라내 880×660. 로고 없는 펜으로 재생성한 결과는 직원 얼굴·어색한 구도로 탈락 |
| img/groups/drawing-2.jpg | 드로잉 갤러리 (§4.5 g2) | 2026-09-24 | 원본 1024×1024 그대로 |
| img/hosts/{perfume,drawing,coffee,leather,film}.jpg | 호스트 사진 (§4.8 H1~H5) | 2026-09-24 | **Gemini 웹 앱**에서 생성(CLI 한도 소진). 1024×1024 원본을 화면 캡처 → 오른쪽 아래 워터마크를 피해 700×700 크롭 → 400×400. 필름 사진은 뒤쪽 손님 얼굴이 나오는 윗부분을 잘라냄 |
| img/brand/home-banner.jpg | 홈 배너 (§4.1) | 2026-09-27 교체 | Gemini 웹. 밝은 아침 공방(왼쪽 위를 글자용 빈 벽으로 비움). 1024×637 원본에서 오른쪽 아래 워터마크를 빼고 왼쪽 위 900×562를 잘라 880×550. 이전(2026-09-24)은 어두운 저녁 테이블 사진
| img/brand/guide.jpg | 이용 안내 헤더 (§4.2) | 2026-09-24 | Gemini 웹. 1024×687 원본에서 위쪽 턱선·오른쪽 워터마크를 빼고 870×580 크롭 |
| icons/og.jpg | 공유 미리보기 (§4.3) | 2026-09-26 다시 합성 | 배경은 그대로, 오른쪽 벽에 태그라인·새 SVG 로고·홈 배너 문구(Pretendard)를 캔버스로 그려 1200×630 JPEG로 저장(화면 캡처는 창 배율에 따라 크기가 달라져서 쓰지 않음). 로고를 바꾸면 다시 만든다. 이전 기록: 2026-09-24 Gemini 웹 배경(1024×572)을 1200×630에 채우고 오른쪽 벽에 로고·워드마크(Noto Serif KR)·설명(Noto Sans KR)을 HTML로 합성해 캡처. 벽 위 워터마크는 바로 위 벽 질감으로 덮음 |
| img/groups/{perfume-3,perfume-4,coffee-3,leather-3}.jpg | 갤러리 보충 (§4.4, §4.6) | 2026-09-24 | Gemini 웹. 워터마크를 피해 4:3은 840~880px 폭, 1:1은 720px로 크롭 |
| img/groups/{film-cover,film-1,film-2,film-3}.jpg | 필름 커버·갤러리 (§4.7) | 2026-09-24 | Gemini 웹. film-3은 1차 결과(인화 사진 속 한글 명패·뒤쪽 책 글자·손님 얼굴)를 탈락시키고 탁자만 보이는 구도로 재생성 |

03-image-guide.md 의 모든 슬롯을 채웠다. 새 이미지를 만들면 이 표에 추가한다.
