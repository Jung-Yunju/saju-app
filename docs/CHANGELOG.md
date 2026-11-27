# 변경 이력

## 2026-11-27 — 1단계: AI 개발회사 구축 (제품 코드 변경 없음)
- 추가: `CLAUDE.md` 공통 운영규칙, `AGENTS.md` 조직도(Next.js 자동 블록 보존)
- 추가: `.claude/agents/` AI 직원 9명, `.claude/settings.json` 위험 명령 차단
- 추가: `docs/` 관리 문서 14종, 현황판(`docs/board/tasks.json` → `scripts/board/build.mjs` → `docs/TASK_BOARD.md`, `docs/board/index.html`)
- 추가: `scripts/qa/legacy-engine-audit.sh` 기존 계산 코드 감사
- 추가: `docs/reports/2026-11-27_initial-plan.md` 최초 개발계획서
- `src/`, `prisma/`, 설정 파일은 수정하지 않음

## 이전 (2026-11-16 ~ 11-23, 기존 개발)
- 초기 앱(Next.js·Prisma·Google 로그인·토스 결제 골격), 풀이 v2(복자할미 말투 원칙), 타임아웃 대응을 위한 출력 축소·폴링 구조 등 — `git log` 참조
