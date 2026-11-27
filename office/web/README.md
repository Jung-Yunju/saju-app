# office/web — 가상 사무실 화면 (O-02)

claude.ai 비공개 아티팩트로 게시하는 대표 전용 화면. 계약: `office/CONTRACT.md`.

## 파일
- `page.html` 본문(doctype·html·head·body 없음). React/Phaser는 cdnjs 고정 버전.
- `app.js` 화면 전체(React createElement + Phaser). 예시 데이터는 `/*SAMPLE_BEGIN*/ ~ /*SAMPLE_END*/` 사이 상수.
- `art.js`(디자인 실장), `map.js`(디자인 실장): 없거나 형식이 다르면 app.js의 대체 그림(색 사각형·단순 인물)으로 그린다.
- `dev-preview.html` 로컬 미리보기 전용(게시하지 않음).

## 로컬 미리보기
office/web을 정적 서버로 열고 `dev-preview.html?mode=live|real|stale|empty|null|hang&theme=light|dark`.
cdnjs가 막혀 있으면 `&libs=/libs` 로 로컬 react.js/react-dom.js/phaser.js 경로를 지정(저장소엔 설치하지 않음).

## 동작 요약
- 데이터는 `claude.use("db")` → 문서 `office/state` 구독 1회. null·10초 무응답·오류·형식 불일치·10분(staleAfterSec) 초과·미래 시각 → 전원 상태 확인 불가.
- 예시 보기는 실제 문서가 없을 때만. 예시 상태에서는 상단 고정 배너.
- 복자는 장식(업무와 무관). reduced-motion이면 걷기·산책·아이콘 흔들림 정지.

## 유지보수
- 예시 데이터를 `office/fixtures/sample-state.json`과 맞추려면 SAMPLE 상수를 그 내용으로 교체(시각은 열 때 현재 기준으로 자동 이동).
- 가구 겹침 순서는 app.js의 depth 계산(가구는 아래 가장자리 y, 캐릭터는 발 y)을 조정.
