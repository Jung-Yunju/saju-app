# 가상 사무실 계약서 (O-02) — 직원 간 공통 규격

> 작성 총괄실장 · 2026-11-27 · 바꾸려면 총괄실장 승인
> 대표 결정: 방안 A(claude.ai 비공개 페이지), 탑다운 픽셀아트, 복자 = 턱시도 고양이 (D-015, D-016)
> 고객 사주 사이트와 완전히 분리한다. 이 폴더(`office/`)와 수집 스크립트만 쓰고 `src/`는 건드리지 않는다.

## 0. 전체 흐름
```
Claude Code Hooks(비동기) ─▶ .claude/hooks/office-event.mjs ─▶ .claude/office/events.jsonl   (커밋 금지)
                                                                     │
docs/board/tasks.json ───────────────────────────────────────────────┤
                                                                     ▼
                                          scripts/office/snapshot.mjs ─▶ .claude/office/state.json
                                                                     │  (총괄실장이 작업 단계마다)
                                                                     ▼
                                              claude.ai 비공개 페이지 DB 문서 office/state  ─▶ office/web/page.html
```

## 1. 대원칙
1. **실제 이벤트가 없으면 일하는 모습을 그리지 않는다.** 상태는 반드시 이벤트 또는 명시된 규칙에서 나온다. 근거가 없거나 오래되면 `unknown`(상태 확인 불가).
2. **내용을 기록하지 않는다.** 명령문, 파일 내용, 프롬프트 본문, 도구 결과, 웹 검색어는 저장하지 않는다. 저장하는 것은 도구 이름, 저장소 기준 파일 경로, 시각, 직원, 업무 설명(직원 호출 시 짧은 description), 카드 ID, 성공/실패, 토큰 수뿐이다.
3. `.env`가 들어간 경로는 `[비공개 파일]`로 가린다. 저장소 밖 경로는 파일명만 남기거나 `[외부 경로]`로 표시한다.
4. 복자(고양이)의 움직임은 **장식**이며 업무 데이터와 무관하다. 화면에 그렇게 밝힌다.

## 2. 직원 ID와 자리
| staffId | 이름 | 직책 | 방 | 비고 |
|---|---|---|---|---|
| `ceo` | 대표 | 대표 | ceo | 추적 대상 아님. 승인 요청 알림 벨이 이 자리에 뜬다 |
| `main` | 총괄실장 | 프로젝트 매니저 | ceo | Hook의 agent_type이 비어 있으면 총괄실장 |
| `business-strategist` | 사업기획 담당 | 사업기획·마케팅 | ceo | |
| `saju-engine-developer` | 엔진 개발자 | 사주엔진 개발 | dev | |
| `frontend-developer` | 프론트엔드 개발자 | 프론트엔드 | dev | |
| `backend-developer` | 백엔드 개발자 | 백엔드·서버 | dev | |
| `qa-security-lead` | 품질검증 담당 | 품질검증·보안 | dev | |
| `myeongri-research-director` | 명리학 연구소장 | 명리학 연구 | research | |
| `personalization-researcher` | 개인화 연구원 | 개인화 분석 | research | |
| `design-director` | 디자인 실장 | 디자인 | design | |
| `content-writer` | 콘텐츠 작가 | 콘텐츠·캐릭터 | design | |
| `guest` | 외부 지원 인력 | 임시(조사·검토 보조) | lounge | 위 목록에 없는 agent_type(general-purpose, claude-code-guide, Explore 등). 여러 명이면 묶어서 한 캐릭터 + 인원수 |

방 ID: `ceo`(대표실), `dev`(개발실), `research`(명리학 연구실), `design`(디자인실), `meeting`(회의실), `lounge`(휴게실)

## 3. 수집 이벤트 형식 — `.claude/office/events.jsonl` (한 줄 = JSON 하나)
```json
{"v":1,"ts":"2026-11-27T12:00:01.123Z","event":"PreToolUse","staff":"backend-developer","agentId":"a406…","sessionId":"b691…",
 "tool":"Edit","kind":"typing","file":"src/app/api/x.ts","desc":null,"cardId":null,"ok":null,"notif":null,"tokens":null}
```
| 필드 | 설명 |
|---|---|
| `event` | Hook 이벤트 이름: SessionStart, SessionEnd, PreToolUse, PostToolUse, PostToolUseFailure, SubagentStart, SubagentStop, Notification, PermissionRequest, Stop |
| `staff` | 2절 staffId. agent_type 없음 → `main`, 목록 밖 → `guest` |
| `kind` | 도구 분류: `typing`(Edit, Write, NotebookEdit, MultiEdit) · `research`(Read, Grep, Glob, WebSearch, WebFetch, 웹 MCP) · `running`(Bash, 기타 실행) · `delegating`(Agent — 총괄실장이 직원을 호출) · `reporting`(SubagentHandback 등 보고) · `other` |
| `file` | 저장소 기준 상대경로(1절 3항 가림 규칙 적용) |
| `desc`·`cardId` | 총괄실장의 Agent 호출(PreToolUse, tool=Agent)일 때만: tool_input.description(최대 60자)과 그 안의 카드 ID(정규식 `\b(?:P\d|U|O)-\d{2}\b`), 그리고 `target`(호출된 subagent_type → staffId) |
| `ok` | PostToolUse true / PostToolUseFailure false |
| `notif` | Notification의 notification_type 또는 PermissionRequest면 `"permission"` |
| `tokens` | 총괄실장의 Agent PostToolUse일 때 tool_response의 토큰 합계·usage가 있으면 `{input,output,cacheRead,cacheWrite,total}`, 대상 agentId 포함 |

Hook은 `async: true`로 등록해 업무를 늦추지 않는다. Hook 스크립트는 실패해도 아무것도 출력하지 않고 종료 코드 0으로 끝낸다(업무 방해 금지). 파일이 5MB를 넘으면 `events-<날짜>.jsonl`로 넘긴다.

## 4. 상태 판정 규칙 — snapshot.mjs (모두 결정론적, 기준 시각 `now` 주입 가능)
| status | 한글 | 판정 | 위치 |
|---|---|---|---|
| `awaiting_approval` | 승인 대기 | 해당 직원의 마지막 permission 알림 이후 그 직원의 도구 이벤트가 없음 (최대 30분) | 자기 자리 + 대표실 벨 |
| `error` | 오류 | 마지막 이벤트가 PostToolUseFailure이고 2분 이내 | 자기 자리 + 경고 표시 |
| `typing` / `research` / `running` | 코드 작성 / 자료 조사 / 실행·테스트 | 업무 중(SubagentStart 후 SubagentStop 전)이고 마지막 도구 이벤트의 kind, 2분 이내 | 자기 자리 |
| `working` | 업무 중 | 업무 중인데 마지막 도구 이벤트가 2~10분 전 | 자기 자리 |
| `meeting` | 회의(규칙 기반) | 총괄실장: Agent 호출 직후 2분 · 직원 보고(SubagentStop) 후 총괄실장이 검토하는 3분. 둘 다 `rule:true` 로 표시 | 회의실 |
| `done` | 완료 | SubagentStop 후 10분 이내 | 자기 자리 + 완료 표시 |
| `resting` | 휴식 | 세션이 활성(마지막 이벤트 10분 이내)인데 그 직원이 업무 중이 아님 | 휴게실 |
| `off` | 퇴근 | SessionEnd 이후, 또는 오늘 출근 기록 없음 | 표시 안 함(자리 비움) |
| `unknown` | 상태 확인 불가 | 업무 중 기록인데 마지막 이벤트가 10분 넘음, 또는 수집 기록이 아예 없음, 또는 상태 문서가 `staleAfterSec`(기본 600초=10분) 넘게 갱신 안 됨 또는 `generatedAt`이 현재보다 5분 넘게 미래(화면에서 판정) | 회색 반투명 + ? 표시 |

총괄실장(main)은 사용자 대화 세션 자체다. 업무 중 여부는 "마지막 이벤트 10분 이내"로 본다.

## 5. 상태 문서 형식 — `office/state` (snapshot.mjs 출력)
```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-11-27T12:10:00Z",
  "staleAfterSec": 600,
  "source": { "eventCount": 412, "firstEventAt": "…", "lastEventAt": "…", "sessionActive": true },
  "ceo": { "pendingApprovals": [ { "at": "…", "staff": "backend-developer", "tool": "Bash", "message": "명령 실행 승인 요청" } ],
           "boardApprovals": [ { "cardId": "U-01", "title": "…", "item": "…" } ] },
  "staff": [
    {
      "id": "backend-developer", "name": "백엔드 개발자", "title": "백엔드·서버", "room": "dev",
      "status": "typing", "statusLabel": "코드 작성", "statusSince": "…", "rule": false,
      "task": { "description": "U-01 urgent security fixes", "cardId": "U-01", "startedAt": "…", "endedAt": null },
      "elapsedSec": 732,
      "currentFile": "src/app/api/reading/[id]/generate/route.ts",
      "activity": [ { "at": "…", "kind": "typing", "tool": "Edit", "file": "src/…", "ok": true } ],
      "toolCounts": { "Edit": 4, "Bash": 28 },
      "filesTouched": 19,
      "tokens": { "input": 210, "output": 200631, "cacheRead": 8912896, "cacheWrite": 0, "total": 9113737, "source": "hook" },
      "costUsdEstimate": { "usd": 9.4, "basis": "API 단가 환산 추정(구독 사용 — 실제 청구 아님)" },
      "cards": [ { "id": "U-01", "title": "…", "status": "수정 필요", "progress": { "done": 5, "total": 6 },
                   "verification": "조건부 통과", "issues": "…", "approval": null } ],
      "completed": [ { "id": "P2-01", "title": "…" } ],
      "errors": [ { "at": "…", "tool": "Bash", "message": "도구 실행 실패" } ],
      "approvals": [ "…" ],
      "sessions": [ { "description": "…", "cardId": "U-01", "startedAt": "…", "endedAt": "…" } ]
    }
  ]
}
```
- `activity`는 직원별 최근 30개, `sessions`는 최근 10개.
- `cards`는 `docs/board/tasks.json`에서 owner가 그 직원인 카드(owner의 한글 이름 → staffId 매핑표는 snapshot.mjs에 둔다). 진행률은 현황판 규칙(세부 작업 완료 수) 그대로.
- 비용 추정 단가: Opus 5.5 입력 $4 / 출력 $20 / 캐시 읽기 $0.20 / 캐시 쓰기 $5, Sonnet 5.5 $2/$10/$0.10/$2.50, Haiku 5.5 $0.10/$0.50/$0.01/$0.125 (100만 토큰당). 모델을 모르면 Opus 단가로 계산하고 basis에 밝힌다.
- 문서 크기는 200KB 이하로 유지한다.

## 6. 그림 파일 규격 (디자인 실장 → 프론트엔드)
`office/web/art.js` — 전역 `window.OFFICE_ART`:
```js
window.OFFICE_ART = {
  tile: 16,                                   // 타일 한 칸 픽셀
  palette: { ".": null, "k": "#1b1b24", ... },// 문자 → 색(#rrggbb), "." 은 투명
  characters: {                               // staffId 별. 모두 같은 크기
    "<staffId>": { w: 16, h: 24, anims: {
      idle:  { fps: 2, frames: [F, F] },      // F = 문자열 배열(h줄, 각 w글자)
      walk:  { fps: 6, frames: [F, F, F, F] },// 아래 방향 기준. 좌우는 좌우반전으로 처리(오른쪽 보기 기준 walkSide 있으면 사용)
      walkSide: { fps: 6, frames: [F, F, F, F] },
      walkUp: { fps: 6, frames: [F, F, F, F] },
      sit:   { fps: 1, frames: [F] },          // 책상에 앉은 뒷모습/옆모습
      type:  { fps: 6, frames: [F, F] },       // 앉아서 타이핑
      read:  { fps: 2, frames: [F, F] }        // 앉아서 책/화면 보기
    } }
  },
  cat: { w: 16, h: 16, anims: { idle, walk, walkSide, sit, sleep, groom } }, // 복자: 턱시도(검정 몸·흰 가슴·흰 발)
  tiles: { "<key>": { w: 16, h: 16, frames: [F] } }, // 바닥·벽·가구(2칸 이상 가구는 w/h를 배수로)
  icons: { typing, research, running, error, approval, done, unknown, zzz, meeting } // 12x12, 머리 위 말풍선용
}
```
- 반드시 들어갈 캐릭터: 2절의 staffId 전부(`ceo`, `main`, `guest` 포함). 직원마다 머리·옷·소품으로 구분되게(예: 연구소장은 두루마리, 품질검증은 돋보기, 디자인 실장은 베레모).
- 기존 게임의 캐릭터·타일·화풍을 베끼지 않는다. 브랜드 톤: 고급스럽고 신비로우면서 친근하게(짙은 남색·금색 포인트 + 따뜻한 나무색).

`office/web/map.js` — 전역 `window.OFFICE_MAP`:
```js
window.OFFICE_MAP = {
  cols: 36, rows: 24,                         // 타일 단위
  layers: { floor: [ "문자열 rows개" ], furniture: [ ... ] },  // 각 문자 → legend의 tiles 키
  legend: { "w": "wall", "f": "floor_wood", ... },
  rooms: [ { id: "ceo", name: "대표실", x, y, w, h } ],         // 타일 좌표
  desks: { "<staffId>": { x, y, facing: "up"|"down"|"left"|"right" } }, // 앉는 위치
  spots: { meeting: [ {x,y}, ... 8개 ], lounge: [ ... 8개 ], ceoBell: {x,y}, door: {x,y} },
  walkable: [ "문자열 rows개, '#'=막힘 '.'=통행" ],
  catRoutes: [ [ {x,y}, ... ] ]                 // 복자 산책 경로(장식)
}
```

## 7. 화면 요구 (프론트엔드)
- 파일: `office/web/page.html`(아티팩트 본문, `<title>`·`<style>` 먼저, doctype 없이) + `art.js` + `map.js` + `app.js`. 외부 라이브러리는 cdnjs 고정 버전만: React 18.3.1 UMD, ReactDOM 18.3.1, Phaser 3.80.1.
- 데이터: `const db = await claude.use("db")` → `db.doc("office/state")` 구독(onSnapshot). `null`이거나 10초 안에 응답이 없으면 "수집 연결 안 됨" 상태로 모두 `unknown`. 문서의 `generatedAt`이 `staleAfterSec`(기본 600초=10분) 넘게 지났으면 전원 `unknown` + "마지막 갱신 n분 전 — 상태 확인 불가" 배너. 미래 5분 초과면 "시각 오류" 배너 + 전원 `unknown`. 오래됨으로 바뀔 때 직원은 그 자리에서 정지하며(이동 없음), 퇴근 직원은 계속 숨긴다.
- 예시 보기: 실제 데이터가 없을 때만 "예시 화면 보기" 버튼. 예시 모드에서는 화면 전체 상단에 **"예시 화면 — 실제 업무가 아닙니다"** 고정 배너. 예시 데이터는 `office/fixtures/sample-state.json` 내용을 `app.js`에 넣는다.
- 캐릭터 클릭/탭 → 상세 패널(PC: 오른쪽, 모바일: 아래 시트): 이름·직책, 현재 업무와 카드, 시작 시각·경과, 현재 파일, 활동 로그, 진행률, 완료 업무, 오류, 토큰·비용 추정(근거 문구 포함), 검증 결과, 대표 승인 요청.
- 상단: 오늘 출근 인원, 업무 중 인원, 승인 대기 수(대표실 벨과 연동), 마지막 갱신 시각.
- 모바일(390px): 사무실 전체 축소 + 방 단위 확대 탭(대표실·개발실·연구실·디자인실·회의실·휴게실). 가로 스크롤 없음.
- 접근성: 캔버스 밖에 직원 목록(텍스트)도 제공해 키보드·화면낭독기로 같은 정보에 접근.
- `prefers-reduced-motion`이면 걷기·복자 산책 애니메이션 최소화.

## 8. 판정 보정 규칙 (2026-11-27 품질검증 지적 반영 — 상세는 `docs/MAINTENANCE.md` 가상 사무실 절)
- agent_type 없는 SubagentStart/Stop은 `staff:"internal"`(내부 보조 에이전트)로 기록하고 상태 계산에서 제외한다.
- 총괄실장은 응답 종료(Stop)·입력 대기 알림(idle_prompt) 뒤 다음 도구 이벤트 전까지 `resting`. 전체 10분 무기록이면 `unknown`.
- 업무 구간: 출근 시 같은 직원의 열린 업무를 닫고, 보고(SubagentStop) 시 같은 직원의 열린 업무를 모두 닫는다. 보고 후 1분 안의 도구 기록은 같은 업무 재개.
- 업무 설명(desc)은 이메일·전화·주민번호·생년월일 형태를 `[가림]`으로 바꾼 뒤 60자로 자른다. `~/` 경로는 `[외부 경로]`.
- 예시 이벤트는 줄마다 `"sample":true`, 하나라도 있으면 상태 문서 `sample:true` → 화면은 예시 배너.
- 화면 오래됨 기준: 문서 `staleAfterSec`(기본 600초) — D-020.
- 알려진 한계: 승인 요청 알림은 agent_type이 없어 직원 요청인지 구분할 수 없다.
