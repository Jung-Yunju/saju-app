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
| 테스트 | `tests/office/*.test.ts` | `npx vitest run tests/office` |

### 기록 위치 (모두 커밋 금지 — `.gitignore`의 `/.claude/office/`)
- 이벤트: `.claude/office/events.jsonl` (한 줄 = 이벤트 하나). 5MB를 넘으면 `events-<날짜>.jsonl`로 이름을 바꿔 넘기고 새 파일에 이어 쓴다.
- 상태 문서: `.claude/office/state.json` (200KB 이하)
- 테스트처럼 다른 폴더에 쓰려면 환경변수 `OFFICE_EVENTS_DIR=<폴더>`.

### 명령
| 목적 | 명령 |
|---|---|
| 상태 문서 만들기 | `node scripts/office/snapshot.mjs` |
| 직원별 요약도 화면에 출력 | `node scripts/office/snapshot.mjs --summary` |
| 기준 시각 고정(재현·검증) | `node scripts/office/snapshot.mjs --now 2026-11-27T12:30:00Z --out <파일>` |
| 다른 이벤트 파일·현황판 사용 | `--events <파일>` `--board <tasks.json>` |
| 오늘 이미 끝난 활동 합치기 | `node scripts/office/snapshot.mjs --backfill-transcripts ~/.claude/projects/<프로젝트 폴더>` |
| 예시 데이터 다시 만들기 | `node scripts/office/make-sample.mjs` (판정 규칙을 바꾸면 꼭 다시 실행 — 테스트가 저장본과 비교한다) |

Hook 등록은 `.claude/settings.json`의 `hooks` 항목에서 한다(총괄실장 관리). 모든 Hook은 `async: true`로 등록해 직원 업무를 늦추지 않는다. 명령은 `node "$CLAUDE_PROJECT_DIR/.claude/hooks/office-event.mjs"` 형식이다.

### 개인정보·내용 미기록 원칙
- 기록하는 것: 시각, 직원, 이벤트 종류, 도구 이름, 도구 분류, 저장소 기준 파일 경로, 총괄실장의 직원 호출 설명(60자까지)과 카드 ID, 성공/실패, 토큰 수, 내부 ID(세션·직원 업무·도구 호출 ID).
- 기록하지 않는 것: 명령문, 파일 내용, 지시문(프롬프트), 도구 결과, 검색어, 웹 주소, 직원의 마지막 보고문, 오류 메시지 본문, 알림 문구.
- `.env`가 들어간 경로는 `[비공개 파일]`, 저장소 밖 경로는 파일 이름까지 숨기고 `[외부 경로]`로 기록한다.
- 작업기록 보조 변환도 같은 규칙을 따른다. 작업기록 형식은 Claude Code 내부 형식이라 버전이 바뀌면 일부가 빠질 수 있다. 주 데이터는 언제나 Hook 기록이다.
- 비용은 "API 단가 환산 추정"이다. 구독 요금 안에서 쓰므로 실제 청구액이 아니다.

### 기록 삭제
- 전부 지우기: `rm -rf .claude/office/` (다음 Hook 이벤트 때 폴더가 다시 생긴다). 지운 뒤 상태 문서를 만들면 전원 "상태 확인 불가"가 된다.
- 지난 기록만 지우기: `rm .claude/office/events-<날짜>*.jsonl`
- 수집을 멈추기: `.claude/settings.json`에서 `hooks` 항목을 빼면 바로 반영된다(세션 재시작 불필요).
- 이 기록은 저장소 밖으로 보내지 않는다. 화면용 페이지 DB(`office/state`)에 올라간 문서는 그 페이지에서 따로 지운다.
