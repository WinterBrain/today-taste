# 이미지 출처

모든 스톡 사진은 Unsplash License(https://unsplash.com/license)로 사용한다. 원본은 `https://unsplash.com/photos/{ID}`.
내려받을 때 imgix 파라미터로 리사이즈·크롭했다(`w, h, fit=crop, q=78`).

| 파일 | Unsplash ID | 비고 |
|---|---|---|
| img/groups/perfume-cover.jpg | -eOwKJhd6k8 | |
| img/groups/perfume-1.jpg | -ZaKKlJUoHE | 1차 후보(-j6LLsAehUo)는 브랜드 로고 노출로 탈락 |
| img/groups/perfume-2.jpg | -JxrCmKGOAw | |
| img/groups/coffee-cover.jpg | F0XGFD9Z1Uk | icons/og.jpg 도 같은 사진(1200×630 크롭) |
| img/groups/coffee-1.jpg | 7RYrEvbqFM8 | 1차 후보(pp8qhUH3znQ)는 매장 로고·외국어 표지판으로 탈락 |
| img/groups/coffee-2.jpg | pLPZjZL8cII | 1차 후보(5R2jbsSOeXM)는 컵 로고로 탈락 |
| img/groups/leather-cover.jpg | GPdWubhjq-Q | |
| img/groups/leather-1.jpg | JNpmCYZID68 | 1차 후보(an44PeEll_w)는 커버와 같은 장면이라 탈락 |
| img/groups/leather-2.jpg | rhP8U-86GZA | 1차 후보(Ff-5OCJ341g)는 지나치게 어수선해 탈락 |
| img/brand/home-banner.jpg | r8nUg6eXUxY | 좌측 국기가 보이지 않도록 초점 크롭(fp-x 0.68, fp-z 1.55). AI 배너(03 문서 §4.1)로 교체 예정 |

## AI 생성 이미지

Google Antigravity CLI(`agy` 1.2.9)의 내장 `generate_image` 도구(모델 `gemini-3.1-flash-image`)로 생성하고 Claude가 검토·크롭했다. 프롬프트 본문은 03-image-guide.md §4 + §4.0 공통 스타일 문구.

| 파일 | 슬롯 | 생성일 | 비고 |
|---|---|---|---|
| img/groups/drawing-cover.jpg | 드로잉 커버 (§4.5 cover) | 2026-09-24 | 원본 1200×896 → 1200×900. 배경 손님이 작게 보이나 식별 불가 수준이라 승인 |

AI 생성 예정 슬롯(드로잉 갤러리, 필름 커버, 호스트 사진, 홈 배너 교체, 이용 안내 헤더, OG)은 03-image-guide.md §4 참고. 생성 후 이 표에 추가한다.
