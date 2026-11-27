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
