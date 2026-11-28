# 복자 v2 — 화면 적용 안내 (디자인 실장 → 프론트엔드)

> 2026-11-28. 대표 결정 D-024(복자는 대표 반려묘가 모델). 브랜드 콘셉트는 「네 안에 잠든 신성을 깨우다」로 다시 바뀌는 중이라 **시안 A 토큰 매핑·인트로 door-a는 중단**했다(총괄실장 지시). 이 문서는 복자 그림 교체만 다룬다.
> 실제 화면 코드 수정은 프론트엔드 담당. 디자인 실장은 `src/app/**`를 고치지 않았다.

## 1. 파일
| 파일 | 내용 | 무게 |
|---|---|---|
| `design/bokja/bokja-loaf.svg` | ① 식빵 자세 정면(시트용, 털 결 많음) | 51.8KB |
| `design/bokja/bokja-sleep.svg` | ② 웅크려 자기(바구니 포함) | 41.5KB |
| `design/bokja/bokja-push.svg` | ③ 머리로 미는 옆모습(부위별 `<g id>`) | 40.2KB |
| `design/bokja/handoff/bokja-svg.ts` | **무료 화면용 문자열 모듈** — ①의 털 결을 줄인 판 | 39.5KB(gzip 약 15KB) |
| `design/bokja/index.html` | 캐릭터 시트(포즈·색 표·사진 대조 체크리스트) | |
| `design/bokja/tools/*.mjs` | 원본 좌표·색·빌드 스크립트 | |

모두 생성 파일이다. 고칠 때는 `tools/pose-*.mjs`(모양)·`tools/palette.mjs`(색)를 고치고 `node design/bokja/tools/build.mjs`.

## 2. `src/app/free/bokja-svg.ts` 교체 방법
1. `design/bokja/handoff/bokja-svg.ts` 내용을 그대로 `src/app/free/bokja-svg.ts`에 덮어쓴다(빌드할 때마다 다시 복사).
2. 바뀐 점(호출하는 곳 확인 필요)
   | 항목 | 예전 | 새 |
   |---|---|---|
   | viewBox | `0 0 120 90` | `0 0 400 300` — **비율은 4:3 그대로**라 CSS 크기는 안 바꿔도 된다. `BOKJA_VIEWBOX` 상수 사용 |
   | `bokjaInner` | `(edge = "#fffaf2")` | `(edge: string \| null = null, { uid, aura })` — edge가 null이면 스티커 테두리 없음 |
   | `bokjaSvgDocument` | `(edge)` | `(edge, { uid, aura })` |
   | `BOKJA_RATIO` | 120/90 | 400/300(같은 값) |
   | 표정 | 조는 복자(zz) | 눈 뜬 무심한 식빵 → 접근성 이름을 **"식빵 자세로 엎드린 고양이 복자"**로 |
3. `src/app/free/bokja.tsx`에서 고칠 것
   - `viewBox="0 0 120 90"` → `viewBox={BOKJA_VIEWBOX}`
   - 한 화면에 복자가 둘 이상이면 그라데이션·필터 id가 겹치므로 `uid`를 넘긴다: `const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "")` → `bokjaInner(edge, { uid, aura })` (모듈 안에서도 같은 정리를 한 번 더 한다)
   - 밝은 바탕(현재 /free 기본)에서는 `aura: false`(청록 기운 끔) + `edge: "#fffaf2"` 권장. 어두운 바탕은 `aura: true`, `edge: null`.
4. `share-card.ts`(캔버스)·`og/route.tsx`(OG 이미지): `bokjaSvgDocument(c.surface)` 호출은 그대로 동작하게 만들었다. 다만 **새 그림은 `<use>`·`<clipPath>`·`feGaussianBlur`를 쓴다.** 크롬 캔버스와 `<img src="data:...">`에서는 디자인 실장이 직접 확인했다(390px 화면 캡처). **OG 이미지 렌더러(next/og)에서는 확인하지 않았다** — 프론트엔드·품질검증이 OG 결과물을 꼭 열어 볼 것. 깨지면 OG에만 `aura: false`를 넘겨 본다(흐림 필터 제거).

### 대안(권장 검토)
화면 표시만이라면 문자열을 JS 묶음에 넣는 대신 정적 파일 `<img src="/brand/bokja-loaf.svg">`가 가볍다(따로 캐시되고 id 충돌도 없다). 그 경우 디자인 실장이 `public/brand/`에 화면용 판을 넣는다(요청하면 바로). 캔버스·OG는 지금처럼 문자열 모듈을 쓴다.

## 3. 크기 기준
- 최소 64px 폭(그 아래는 얼굴 무늬가 안 읽힌다). 무료 결과 화면 표지 140~200px 권장.
- 그림 위에 글자를 얹지 않는다(검은 몸·흰 턱받이 위 글자 대비 보장 불가).

## 4. ③ 옆모습 움직임용 id (`bokja-push.svg`, 앞머리 `bp`)
| id | 부위 | 회전축(viewBox 좌표) |
|---|---|---|
| `bp-tail` | 꼬리 | 48,102 |
| `bp-hf` / `bp-hn` | 먼 / 가까운 뒷다리 | 92,120 / 78,112 |
| `bp-ff` / `bp-fn` | 먼 / 가까운 앞다리 | 186,130 / 200,124 |
| `bp-torso` | 몸통·가슴 | — |
| `bp-head` | 머리(목·턱받이 위쪽 포함) | 220,118 |
CSS에서 `transform-box: view-box; transform-origin: <축>`으로 돌린다. 그림 기본값이 '이마로 미는 순간' 자세다.

## 5. 아직 안 한 것
- 브랜드 토큰 매핑(시안 A) — 콘셉트 변경으로 중단. 새 콘셉트 시안 때 복자 색(`tools/palette.mjs`)을 토큰(`--bokja-*`)으로 옮길 예정.
- 인트로(문을 미는 복자) — 중단.
- 펼친 책 위 식빵(④) — D-025 지시였으나 이후 지시로 책 소품 중단.
