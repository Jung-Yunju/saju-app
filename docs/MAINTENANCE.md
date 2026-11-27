# 유지관리 매뉴얼

## 현황판
1. `docs/board/tasks.json`에서 카드의 `status`, `subtasks[].done`, `verification`, `history`를 고친다. (history는 추가만, 삭제 금지)
2. `node scripts/board/build.mjs` 실행 → `docs/TASK_BOARD.md`, `docs/board/index.html` 자동 생성.
3. 규칙 위반(없는 상태값, 검증 없이 '개발 완료', 없는 선행 작업 ID, 세부 작업·이력 누락)이 있으면 생성이 멈추고 이유를 출력한다.
4. 화면 모양은 `scripts/board/template.html`에서만 고친다.
5. 대표용 웹 현황판(claude.ai 비공개 페이지)은 총괄실장이 `docs/board/index.html`을 다시 게시해 갱신한다.

## AI 직원 추가·변경
- `.claude/agents/<이름>.md` 파일 하나가 직원 한 명. 머리말(frontmatter)의 `name`, `description`은 필수이며 `tools`, `disallowedTools`, `model`, `color` 등을 쓴다.
- 파일 변경은 **새 세션부터** 반영된다.
- 바꾼 내용은 `AGENTS.md` 표와 `docs/DECISIONS.md`에 기록한다.

## 위험 명령 차단 규칙
`.claude/settings.json`의 `permissions.deny`(항상 차단)·`ask`(매번 확인). 강제 push, 운영 DB 초기화·마이그레이션 배포, 운영 배포, `.env` 읽기를 막는다. 명령 문자열 기준이라 완벽한 차단은 아니므로 GitHub 브랜치 보호와 함께 쓴다.

## 백업과 복구
| 대상 | 방법 | 상태 |
|---|---|---|
| 코드 | GitHub 원격 저장소 + 기존 상태 태그 `backup/2026-11-27-pre-company`(커밋 `39ad72b`) | 태그 업로드는 대표 승인 대기 |
| 복구 | `git checkout backup/2026-11-27-pre-company` (읽기) / 되돌리기는 새 브랜치에서 | |
| DB | Neon 콘솔의 복원(point-in-time restore) 기능. 보관 기간은 플랜마다 다름 → 대표 계정에서 확인 | 확인 필요 |
| 정기 DB 백업 | 6단계에서 GitHub Actions로 `pg_dump` → 비공개 저장소/스토리지 (비용 확인 후) | 계획 |
| 환경변수 | Vercel 프로젝트 설정에 저장된 값의 원본을 대표 비밀번호 관리자에 별도 보관 | 대표 조치 |

## 기존 계산 코드 감사
`npm ci` 후 `bash scripts/qa/legacy-engine-audit.sh`. 실패 항목 = 기존 코드 결함. 새 엔진 도입 후에는 새 엔진 대상 회귀 테스트로 바꾼다.

## 자주 쓰는 명령
| 목적 | 명령 |
|---|---|
| 의존성 설치 | `npm ci` |
| 타입 검사 | `npx tsc --noEmit` (먼저 `npx prisma generate`) |
| 린트 | `npm run lint` |
| 개발 서버 | `npm run dev` (포트 3001, DB 환경변수 필요) |

## 가상 사무실 (O-02 수집부)
대표용 픽셀아트 사무실 화면에 넣을 "직원 상태 문서"를 만드는 부분이다. 규격은 `office/CONTRACT.md`(3절 이벤트 형식, 4절 상태 판정, 5절 문서 형식)가 원본이다.

| 구성 | 파일 | 하는 일 |
|---|---|---|
| 수집 Hook | `.claude/hooks/office-event.mjs` | Claude Code Hook이 넘기는 정보 하나를 받아 이벤트 한 줄을 기록한다. 오류가 나도 아무 말 없이 끝난다(업무 방해 금지) |
| 상태 계산 | `scripts/office/snapshot.mjs` | 이벤트 기록 + 현황판(`docs/board/tasks.json`) → 직원별 상태 문서 |
| 작업기록 보조 변환 | `scripts/office/backfill.mjs` | Hook을 켜기 전에 끝난 오늘 활동을 Claude Code 작업기록에서 뽑아 이벤트로 바꾼다(선택 기능) |
| 예시 데이터 | `scripts/office/make-sample.mjs` → `office/fixtures/` | 화면의 "예시 화면"용 가짜 데이터. 실제 업무가 아니다 |
| 테스트 | `tests/office/*.test.ts` | `npx vitest run tests/office` (품질검증 결함 회귀 테스트는 `tests/office/regressions.test.ts`) |

### 기록 위치 (모두 커밋 금지 — `.gitignore`의 `/.claude/office/`)
- 이벤트: `.claude/office/events.jsonl` (한 줄 = 이벤트 하나). 5MB를 넘으면 `events-<날짜>.jsonl`로 이름을 바꿔 넘기고 새 파일에 이어 쓴다.
- 상태 문서: `.claude/office/state.json` (200KB 이하, 파일 권한 0600 — 만들 때마다 다시 맞춘다)
- 테스트처럼 다른 폴더에 쓰려면 환경변수 `OFFICE_EVENTS_DIR=<폴더>`.

### 명령
| 목적 | 명령 |
|---|---|
| 상태 문서 만들기 | `node scripts/office/snapshot.mjs` |
| 직원별 요약도 화면에 출력 | `node scripts/office/snapshot.mjs --summary` |
| 기준 시각 고정(재현·검증) | `node scripts/office/snapshot.mjs --now 2026-11-27T12:30:00Z --out <파일>` |
| 다른 이벤트 파일·현황판 사용 | `--events <파일>` `--board <tasks.json>` |
| 오늘 이미 끝난 활동 합치기 | `node scripts/office/snapshot.mjs --backfill-transcripts ~/.claude/projects/<프로젝트 폴더>` |
| 예시 데이터 다시 만들기 | `node scripts/office/make-sample.mjs` (판정 규칙을 바꾸면 꼭 다시 실행 — 테스트가 저장본과 비교한다). 예시 이벤트는 줄마다 `"sample":true`가 붙고, 이런 줄이 하나라도 섞이면 `--sample` 없이도 상태 문서에 `sample:true`(예시 표시)가 붙는다 |

Hook 등록은 `.claude/settings.json`의 `hooks` 항목에서 한다(총괄실장 관리). 모든 Hook은 `async: true`로 등록해 직원 업무를 늦추지 않는다. 명령은 `node "$CLAUDE_PROJECT_DIR/.claude/hooks/office-event.mjs"` 형식이다.

### 판정 보정 규칙 (2026-11-27 품질검증 불합격 결함 수정)
계약서 4절 규칙 위에 다음을 더했다. 실제 Claude Code 기록에서 관찰된 형태에 맞춘 것이라, Claude Code 버전이 바뀌면 다시 확인한다.
- **내부 보조 에이전트(D1)**: `agent_type`이 없는 `SubagentStart`/`SubagentStop`은 총괄실장의 응답 종료 직후 1초 안에 오는 내부 보조 에이전트로 보인다(작업기록 폴더에 기록이 없음). Hook은 이것을 `staff:"internal"`로 기록하고, 상태 계산은 무시한다. 예전 기록에 `staff:"main"`으로 남은 `SubagentStart`/`SubagentStop`도 같은 이유로 무시한다(`snapshot.mjs`의 `isIgnoredEvent`).
- **총괄실장 휴식(D1-b)**: 응답 종료(`Stop`) 또는 입력 대기 알림(`Notification` `idle_prompt`) 뒤에는 다음 도구 이벤트가 올 때까지 "휴식"(전체가 10분 넘게 조용하면 "상태 확인 불가"). 이 사이에는 직원 호출·보고에 따른 "회의(규칙)"도 표시하지 않는다. 승인 요청 알림은 예외로 "승인 대기"가 우선한다.
- **같은 직원의 이어서 일하기(D2)**: 같은 `agentId`로 재개된 직원도 업무 구간마다 닫힌다(`SESSION_MS` 상수).
  - 출근(`SubagentStart`)이 오면 같은 직원의 열린 업무(도구 기록만으로 만든 암묵 업무 포함)를 그 시각에 닫고 새로 연다. 5초 안에 먼저 찍힌 도구 기록은 비동기 Hook 순서 뒤바뀜으로 보고 같은 업무로 합친다.
  - 보고(`SubagentStop`)는 같은 직원의 열린 업무를 모두 닫는다. 보고 뒤 2초 안의 도구 기록은 무시, 1분 안에 출근 기록 없이 다시 도구를 쓰면 같은 업무를 다시 연다(보고 독촉 뒤 재보고), 그 뒤면 새 암묵 업무.
  - 작업기록 변환은 보고(`SubagentHandback` 성공) 1건마다 종료를 넣고, 다음 지시(재개 메시지)에서 새 시작을 넣는다. 보고 없이 응답이 끝난 뒤 새 지시가 와도 구간을 나눈다. 도구 결과 줄·이미지 같은 딸림 줄(`turnCompanion`)은 새 지시로 보지 않는다.
  - Hook 기록과 작업기록을 합칠 때 출근/보고 중복은 "같은 직원 + 같은 종류 + 10초 이내"로 판정한다(예전에는 같은 직원이면 무조건 중복으로 봐서 재개 구간이 사라졌다).

### 개인정보·내용 미기록 원칙
- 기록하는 것: 시각, 직원, 이벤트 종류, 도구 이름, 도구 분류, 저장소 기준 파일 경로, 총괄실장의 직원 호출 설명(60자까지)과 카드 ID, 성공/실패, 토큰 수, 내부 ID(세션·직원 업무·도구 호출 ID).
- 기록하지 않는 것: 명령문, 파일 내용, 지시문(프롬프트), 도구 결과, 검색어, 웹 주소, 직원의 마지막 보고문, 오류 메시지 본문, 알림 문구.
- `.env`가 들어간 경로는 `[비공개 파일]`, 저장소 밖 경로는 파일 이름까지 숨기고 `[외부 경로]`로 기록한다. `~`로 시작하는 경로(`~/…`, `~사용자/…`)는 홈 폴더이므로 `[외부 경로]`다.
- 직원 호출 설명(60자)에 이메일·전화번호·주민등록번호·날짜(연·월·일이 모두 있는 날짜, `1987년생` 포함) 형태가 있으면 `[가림]`으로 바꾼 뒤 자른다(`office-event.mjs`의 `maskPersonal`·`cleanDesc`). 생년월일과 일반 날짜를 구분할 수 없어 날짜는 모두 가린다. 작업기록 변환과 상태 문서 출력(예전 기록 포함)에도 같은 가림을 적용한다. 형태 기반이라 이름·주소처럼 형태가 없는 개인정보는 못 거른다 — 직원 호출 설명에는 고객 정보를 쓰지 않는 것이 원칙이다.
- 작업기록 보조 변환도 같은 규칙을 따른다. 작업기록 형식은 Claude Code 내부 형식이라 버전이 바뀌면 일부가 빠질 수 있다. 주 데이터는 언제나 Hook 기록이다.
- 비용은 "API 단가 환산 추정"이다. 구독 요금 안에서 쓰므로 실제 청구액이 아니다.

### 기록 삭제
- 전부 지우기: `rm -rf .claude/office/` (다음 Hook 이벤트 때 폴더가 다시 생긴다). 지운 뒤 상태 문서를 만들면 전원 "상태 확인 불가"가 된다.
- 지난 기록만 지우기: `rm .claude/office/events-<날짜>*.jsonl`
- 수집을 멈추기: `.claude/settings.json`에서 `hooks` 항목을 빼면 바로 반영된다(세션 재시작 불필요).
- 이 기록은 저장소 밖으로 보내지 않는다. 화면용 페이지 DB(`office/state`)에 올라간 문서는 그 페이지에서 따로 지운다.

## DB 마이그레이션 적용 절차 (대표 승인 필요)
운영 DB 변경은 **대표 승인 후에만** 한다(공통 규칙 15). 직원은 마이그레이션 파일만 만들고 `prisma validate`·`format`·`generate`(로컬)만 실행한다. `migrate deploy`·`migrate dev`·`db push`는 `.claude/settings.json`에서 막혀 있다.

현재 대기 중: `prisma/migrations/20261127090000_reading_v3_safety` (추가만 — 생성 시도 상한·잠금 시각·정확도 열·주문 birthInfo·AiUsage 표). 상세·확인 쿼리: `docs/DATABASE.md` 2·4절.

1. **순서**: 백업 → Neon 개발 브랜치 리허설 → 운영 `npx prisma migrate deploy` → 새 코드 배포(스위치 끔) → `DB_SCHEMA_V3=true` 설정 후 재배포.
   - 새 schema가 든 코드를 마이그레이션보다 **먼저 배포하면 안 된다**(스위치와 무관하게 새 열을 조회해 화면 오류). 이 변경을 main에 합칠 때는 운영 적용 일정과 맞춘다.
2. **백업 확인**: Neon 콘솔에서 복원 시점(PITR) 보관 기간 확인, 적용 직전 시각 기록, 가능하면 운영 브랜치 스냅숏 브랜치 생성.
3. **적용 전후 확인**: `npx prisma migrate status`(보류 목록이 예상과 같은지), DATABASE.md 4절 확인 쿼리(상태별 개수가 적용 전후 같음).
4. **문제 시**: 먼저 `DB_SCHEMA_V3`를 지우고 재배포(DB는 그대로). DB까지 되돌리려면 대표 승인 → 이전 코드 배포 → 백업 확인 → 같은 폴더 `down.sql` 실행 → `npx prisma migrate resolve --rolled-back <마이그레이션 이름>`. down은 새 열의 데이터를 지운다.
5. **환경변수**: `DB_SCHEMA_V3`(정확히 `true`일 때만 켜짐), `GENERATION_MAX_ATTEMPTS`(풀이 1건당 AI 생성 시도 상한, 1~10, 기본 3).
6. **상한 도달 풀이 처리(운영자)**: 생성 API가 `409 retryExhausted`를 돌려준 결제 건은 고객 문의로 들어온다. 원인 확인 뒤 재생성(해당 풀이 `attemptCount`를 0으로 되돌림 = 운영 데이터 변경, 승인 필요) 또는 토스 환불. 자동 환불 경로는 아직 없다.
7. **적용한 마이그레이션 파일은 고치지 않는다**(체크섬 불일치). 고칠 일이 생기면 새 마이그레이션을 만든다.

## 견본 풀이 생성 (scripts/content/samples)
가상 인물 10명의 기본 풀이 8장을 실제 AI로 만들어 대표가 품질을 확인하는 도구입니다. 실행 순서, 비용, 실패 시 대처는 `scripts/content/samples/README.md`에 있습니다. 담당은 백엔드·서버 개발자입니다.
- **실행은 대표 승인이 있을 때만 합니다.** 키는 클라우드 환경 변수 `SAJU_ANTHROPIC_API_KEY`(새 세션부터 반영)로 받습니다. 일반 이름 `ANTHROPIC_API_KEY`는 읽지 않습니다. 키가 없으면 안내만 하고 끝납니다(상태 2).
- 명령: `node scripts/content/samples/generate.mjs --only 1 --budget-usd 0.5`(1명 시험) → `--compare --budget-usd 5`(전체). 비용 0으로 연습하려면 `--fake`를 씁니다.
- 비용 상한: 호출 직전에 최악 비용을 더해 `--budget-usd`(기본 5달러)를 넘으면 그 호출을 보내지 않고 멈춥니다. 이어서 할 때는 `--retry-failed`를 씁니다. 실제 청구액은 `docs/COST_REPORT.md`에 기록합니다.
- 출력: `samples/<날짜>/`(인물별 JSON + `index.html` + 요약). 이 폴더는 `.gitignore`의 `/samples/` 항목이라 커밋되지 않습니다. 저장소가 공개 상태이므로 그대로 둡니다. 지울 때는 `rm -rf samples/<날짜>`를 씁니다(로컬 파일이라 운영 데이터가 아닙니다).
- 인물을 바꿀 때: `personas.ts`의 `expect` 칸을 엔진으로 확인한 값으로 적습니다. `tests/content/samples.test.ts`가 일간 10개가 모두 다른지와 윤달·서머타임·시각 모름·입춘 경계·극신강약 조건을 엔진으로 다시 확인합니다. 엔진 판정이 바뀌어 조건이 깨지면 이 테스트가 실패합니다.
- 장 구성이나 프롬프트가 바뀌면 스크립트는 고칠 필요가 없습니다(`chaptersForProduct("BASIC")`를 그대로 씁니다). 출력 칸이 새로 생기면 화면(`html.ts`)이 이름 그대로 보여 줍니다. 쉬운 이름을 붙이려면 `FIELD_KO`에 추가합니다.
- 검사: `npx vitest run tests/content/samples.test.ts`(가짜 클라이언트만 씁니다. API 호출 없음).
