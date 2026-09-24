# 03. 이미지 배치·에셋·생성 프롬프트 가이드

> 작성일: 2026-09-24 · 관련: [02-redesign-plan.md](02-redesign-plan.md)
> 원칙: **무료 스톡(Unsplash License)으로 해결되는 자리는 스톡을 쓰고, 구도가 특수하거나 스톡이 없는 자리만 AI로 생성**한다.
> 모든 이미지는 `public/assets/img/` 아래에 **직접 저장해 서빙**한다(외부 핫링크 금지 — 속도·가용성·약관 문제).

---

## 1. 공통 규칙

### 1.1 비주얼 톤 (스톡 선정과 AI 생성 모두 이 기준으로)

- **자연광, 따뜻한 중립 톤**. 채도는 낮게, 그림자는 부드럽게. 주홍 포인트 컬러(`#E4572E`)와 싸우는 강한 원색 배경은 피한다
- **손과 작업물 중심**. 얼굴이 정면으로 나오는 사진은 쓰지 않는다(실제 참가자·호스트로 오인될 수 있음). 사람이 나오면 손·어깨·뒷모습까지만
- 작은 테이블, 2~3인 규모가 느껴지는 구도. 대형 강의실·파티 장면 금지
- 텍스트·로고·워터마크가 사진 안에 없을 것
- 한국/대구의 소규모 공방·카페 느낌. 지나치게 서양식 인테리어(벽난로, 영문 간판)는 피한다

### 1.2 규격·파일

| 용도 | 비율 | 저장 크기 | 형식 | 경로 |
|---|---|---|---|---|
| 모임 커버 | 4:3 | 1600×1200 | JPG q80 (목표 250KB 이하) | `img/groups/{slug}-cover.jpg` |
| 모임 갤러리 | 4:3 또는 1:1 | 1600×1200 / 1200×1200 | JPG q80 | `img/groups/{slug}-{n}.jpg` |
| 호스트 | 1:1 | 400×400 | JPG q80 | `img/hosts/{slug}.jpg` |
| 홈 배너 | 16:10 | 1600×1000 | JPG q80 | `img/brand/home-banner.jpg` |
| 이용 안내 헤더 | 3:2 | 1600×1067 | JPG q80 | `img/brand/guide.jpg` |
| 공유 미리보기(OG) | 1.91:1 | 1200×630 | JPG q85 | `icons/og.jpg` |
| 파비콘 | 정사각 | SVG + 180px PNG | SVG/PNG | `icons/favicon.svg`, `icons/apple-touch-icon.png` |

- slug: `perfume`, `drawing`, `coffee`, `leather`, `film`
- 카드/커버는 `object-fit: cover` 로 잘리므로 **주요 피사체를 중앙 60% 안에** 둔다
- `<img loading="lazy" decoding="async" width height alt>` — alt는 한국어로 장면을 설명

### 1.3 라이선스

- **Unsplash License**: 상업적 이용 무료, 출처 표기 의무 없음(권장), 수정 가능. 단 "사진을 그대로 모아 경쟁 사진 서비스를 만드는 것"과 "사진 자체를 판매"는 금지. 사람이 식별되는 사진을 **보증·추천처럼 보이게** 쓰지 말 것 → 1.1의 얼굴 금지 원칙과 일치
- 사용한 스톡은 `docs/design/image-credits.md` 에 `슬롯 | 사진 ID | 작가 | URL` 로 기록(구현 시 작성)
- 다운로드: `https://unsplash.com/photos/{ID}/download?force=true` → 리사이즈·압축 후 저장
- AI 생성 이미지는 사용하는 생성 서비스의 상업 이용 약관을 확인할 것

---

## 2. 슬롯 목록 한눈에 보기

| ID | 위치 | 비율 | 소스 | 상태 |
|---|---|---|---|---|
| B1 | 홈 브랜드 배너 | 16:10 | **AI** (스톡 폴백 있음) | 프롬프트 §4.1 |
| B2 | 이용 안내(`#/guide`) 헤더 | 3:2 | **AI** | 프롬프트 §4.2 |
| B3 | 공유 미리보기 OG | 1.91:1 | **AI 배경 + 워드마크 합성**(구현 시 HTML로 합성 후 캡처) | 프롬프트 §4.3 |
| B4 | 파비콘·앱 아이콘 | 1:1 | **직접 제작(SVG)** — ㅎ 옹기 마크 | 완료 (`favicon.svg`, `apple-touch-icon.png`) |
| G1-c | 향수 모임 커버 | 4:3 | **스톡** | §3.1 |
| G1-1~3 | 향수 갤러리 | 4:3/1:1 | 스톡 1 + **AI 2** | §3.1, §4.4 |
| G2-c | 드로잉 모임 커버 | 4:3 | **AI** (스톡 후보 약함) | §4.5 |
| G2-1~3 | 드로잉 갤러리 | | 스톡 1 + AI 2 | |
| G3-c | 커피 모임 커버 | 4:3 | **스톡** | §3.3 |
| G3-1~3 | 커피 갤러리 | | 스톡 2 + AI 1 | |
| G4-c | 가죽공예 커버 | 4:3 | **스톡** | §3.4 |
| G4-1~3 | 가죽공예 갤러리 | | 스톡 2 + AI 1 | |
| G5-c | 필름카메라 산책 커버 | 4:3 | **AI** (스톡 재검색 후 없으면) | §4.7 |
| G5-1~3 | 필름 갤러리 | | AI 3 | |
| H1~H5 | 호스트 사진 5개 | 1:1 | **AI** (작업 공간·손 클로즈업, 얼굴 없음) | §4.8 |

사진이 **없는 자리**(의도적): 후기 카드(텍스트만), 신청 폼, 완료 화면(아이콘), 빈 상태(아이콘 + 문구), 운영콘솔 전체. 장식용 일러스트는 쓰지 않는다 — "AI 템플릿" 인상의 원인.

---

## 3. 스톡 후보 (Unsplash, 무료 라이선스 필터로 검색)

> 아래 ID는 2026-09-24 검색 결과에서 뽑은 **후보**다. 구현 단계에서 원본을 내려받아 1.1 기준(얼굴·텍스트·톤)으로 육안 확인한 뒤 확정한다. 탈락하면 같은 검색어로 재검색하고, 그래도 없으면 AI 프롬프트로 대체한다.

### 3.1 향수 (G1) — 검색어 `perfume making`
| 후보 ID | 설명 | 용도 |
|---|---|---|
| `-eOwKJhd6k8` | 갈색 나무 테이블 위 투명 유리병 | 커버 1순위 |
| `zjWVi5rvgN8` | 테이블 위 유리 향수병 | 커버 2순위 / 갤러리 |
| `-j6LLsAehUo` | 유리 향수병 선택적 초점 | 갤러리 |
| `-JxrCmKGOAw` | 액체가 든 병 여러 개가 놓인 테이블(원료병 느낌) | 갤러리 |

### 3.2 드로잉 (G2) — 검색어 `pen sketch cafe`, `sketchbook pen drawing`
| 후보 ID | 설명 | 용도 |
|---|---|---|
| `C299ajcFPm0` | 커피 한 잔과 책이 놓인 테이블 | 갤러리(분위기) |
| `6-cxfA4MKpk` | 사람이 눈을 그리는 장면 | 갤러리 후보(얼굴 그림이라 보류 가능) |
| — | 적합한 커버 없음 → **AI §4.5** | |

### 3.3 핸드드립 커피 (G3) — 검색어 `pour over coffee`
| 후보 ID | 설명 | 용도 |
|---|---|---|
| `F0XGFD9Z1Uk` | 푸어오버 드리퍼에 뜨거운 물을 붓는 장면 | **커버 1순위** |
| `pp8qhUH3znQ` | 모던한 커피숍 내부 | 갤러리(공간) |
| `5R2jbsSOeXM` | 나무 테이블 위 커피잔 | 갤러리 |

### 3.4 가죽공예 (G4) — 검색어 `leather craft workshop`
| 후보 ID | 설명 | 용도 |
|---|---|---|
| `GPdWubhjq-Q` | 펜으로 갈색 가죽에 종이 패턴을 따라 그림 | **커버 1순위** |
| `an44PeEll_w` | 가죽 조각에 패턴을 그리는 손 | 커버 2순위 / 갤러리 |
| `Ff-5OCJ341g` | 도구와 용품이 놓인 작업대 | 갤러리(공간) |

### 3.5 필름카메라 (G5) — 검색어 `35mm film camera street`, `film camera alley`
- 1차 검색(`film camera hands`)은 DSLR 위주라 부적합. 구현 시 재검색, 없으면 AI §4.7

### 3.6 홈 배너 폴백 (B1) — 검색어 `cafe window light table`
- AI 결과가 마음에 들지 않을 때만. 사람 없는 작은 테이블 + 창가 빛

---

## 4. AI 이미지 생성 프롬프트

### 4.0 공통 스타일 문구 (모든 프롬프트 끝에 붙인다)

```
Style: natural documentary photography, shot on 35mm, soft window daylight or warm tungsten evening light,
muted warm neutral palette (oatmeal, walnut, warm grey, off-white) with a small touch of burnt orange,
shallow depth of field, subtle film grain, realistic textures, uncluttered composition,
subject centered within the middle 60% of the frame.
Setting: a small independent workshop or cafe in Daegu, South Korea — modest, lived-in, not luxurious.
Negative: no text, no letters, no logos, no watermark, no visible faces, no smiling-at-camera stock pose,
no crowd, no neon, no oversaturated colors, no illustration, no 3D render, no western fireplace interior.
```

> 한국어 설명은 생성 담당자가 의도를 이해하도록 붙인 것이며, 프롬프트 본문은 영어가 이미지 모델에서 더 안정적이다.

### 4.1 B1 홈 브랜드 배너 — 16:10

의도: "퇴근 후 두 시간, 처음 만난 세 사람과 만드는 취향". 사람 없이 **세 자리**가 준비된 테이블. 좌하단에 흰 글자를 얹으므로 **좌하단은 어둡고 단순하게**.

```
A small square wooden table prepared for exactly three people, seen from a slightly elevated three-quarter angle.
Three mismatched ceramic cups, three small trays with craft materials (glass vials, a sketchbook, leather scraps),
one low warm lamp. Early evening, the last warm light coming through a window on the right,
the lower-left area of the frame falls into soft shadow and stays empty for text overlay.
Aspect ratio 16:10.
+ 공통 스타일 문구
```

### 4.2 B2 이용 안내 헤더 — 3:2

의도: 소규모로 함께 만드는 장면. 세 사람의 **손만** 보인다.

```
Top-down view of a small wooden table where three pairs of hands are working on one-day craft projects together:
one pair blending small glass perfume vials, one pair drawing with a fine pen in a sketchbook, one pair stitching a leather keyring.
Coffee cups and a few tools between them. Forearms and sleeves only, no faces. Aspect ratio 3:2.
+ 공통 스타일 문구
```

### 4.3 B3 공유 미리보기 배경 — 1.91:1

의도: 카카오톡·인스타 링크 미리보기. 우측 40%에 워드마크를 합성하므로 **우측은 비워둔다**.

```
Close-up of the corner of a wooden table with a single ceramic cup and a small folded paper note,
warm late-afternoon light, the right 40% of the frame is an empty softly lit off-white wall for text overlay.
Aspect ratio 1200x630.
+ 공통 스타일 문구
```

### 4.4 G1 향수 갤러리 — 4:3, 2장

```
(1) Hands dipping a thin white scent blotter strip into a small amber glass vial,
several labeled-by-color (no text) dropper bottles in a row on a linen cloth. Aspect ratio 4:3.
+ 공통 스타일 문구

(2) A finished 30ml clear glass perfume bottle with a blank kraft paper tag tied with string,
placed on a wooden tray next to used blotter strips, soft side light. Aspect ratio 1:1.
+ 공통 스타일 문구
```

### 4.5 G2 드로잉 — 커버 + 갤러리 2장

```
(cover) Over-the-shoulder view of a hand drawing a loose black ink pen sketch of a cafe interior in an open sketchbook,
a latte cup and a small window view of an old Korean street in soft focus behind. Aspect ratio 4:3.
+ 공통 스타일 문구

(g1) A finished one-page pen drawing of a small cafe corner (chairs, plant, window) lying on a wooden table
next to two fine liner pens. Aspect ratio 4:3.
+ 공통 스타일 문구

(g2) Two hands practicing straight and curved pen lines on a practice sheet, eraser and pens nearby,
another person's sketchbook partially visible across the small table. Aspect ratio 1:1.
+ 공통 스타일 문구
```

### 4.6 G3 커피 · G4 가죽 갤러리 보충 — 각 1장

```
(G3) Three small glass cups of hand-drip coffee with slightly different colors lined up for tasting,
a notebook with a hand-drawn flavor wheel (no readable text), coffee beans in three small dishes. Aspect ratio 4:3.
+ 공통 스타일 문구

(G4) A finished tan leather keyring and a navy leather card holder with blind-stamped initials (no readable letters),
waxed thread and a stitching needle beside them on a cutting mat. Aspect ratio 1:1.
+ 공통 스타일 문구
```

### 4.7 G5 필름카메라 골목 산책 — 커버 + 갤러리 3장

```
(cover) Hands holding a vintage 35mm film camera at chest level in a narrow Korean alley with painted murals and
old low houses, late afternoon side light, back of the person only. Aspect ratio 4:3.
+ 공통 스타일 문구

(g1) Close-up of a thumb advancing the film lever of a silver 35mm rangefinder camera. Aspect ratio 1:1.
+ 공통 스타일 문구

(g2) Two people seen from behind walking up a gentle slope in an old Daegu alley, one pointing a film camera at a
sunlit doorway. Aspect ratio 4:3.
+ 공통 스타일 문구

(g3) A small stack of developed 4x6 film prints of alley scenes spread on a cafe table next to a film canister. Aspect ratio 4:3.
+ 공통 스타일 문구
```

### 4.8 H1~H5 호스트 사진 — 1:1, 얼굴 없음

의도: 실제 인물처럼 보이는 가짜 얼굴을 피하고, **호스트의 공간과 손**으로 인상을 전달한다. 실제 운영 시 운영콘솔에서 실제 호스트 사진으로 교체.

```
(H1 향수 · 무드랩) Hands of a perfumer arranging dozens of small amber vials on a wooden shelf, apron visible. Aspect ratio 1:1.
(H2 드로잉 · 페이지카페) A hand holding a pen resting on a sketchbook full of cafe drawings, sleeve of a knit sweater. Aspect ratio 1:1.
(H3 커피 · 로스터리 소담) Hands of a barista holding a gooseneck kettle, small roaster blurred behind. Aspect ratio 1:1.
(H4 가죽 · 스튜디오 결) Hands in a canvas apron cutting leather with a craft knife along a steel ruler. Aspect ratio 1:1.
(H5 필름 · 필름워크) Hands loading a roll of 35mm film into an open vintage camera back. Aspect ratio 1:1.
각 줄 끝에 + 공통 스타일 문구
```

---

## 5. 이미지가 없을 때의 대체 표현 (구현 규칙)

- 모임 커버가 비어 있으면: `--bg-sunken` 면 위에 **분야·태그를 Noto Serif 28px** 로 크게 배치한 타이포그래피 커버(예: "향수" / "만들기"). 이모지 사용 안 함
- 호스트 사진이 비어 있으면: 이름 첫 글자 원형 이니셜
- 이미지 로드 실패(`onerror`) 시 위 대체 표현으로 전환
