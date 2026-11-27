# 변경 이력

## 2026-11-27 — 3단계 착수 + 긴급 조치 (대표 "알아서 진행" 지시, 배포·main 병합 없음)
- 추가: 사주엔진 `src/engine/` calendar@0.1.0 — 한국 시간대 이력·서머타임·경도 보정, 절기(UTC), 원국, 한국 음력(UTC+9), 대운·세운 (엔진 개발자)
- 추가: 공통 계약 `src/engine/types.ts`·`index.ts` (총괄실장), 테스트 도구 vitest·astronomy-engine(독립 검증용)
- 추가: 골든 테스트셋 v1 `tests/engine/golden/` — 독립 천문 오라클, 한국 공식 설·추석·윤달, 경계 655건 (품질검증)
- 수정(보안): API 무료 생성 운영 차단(ALLOW_FREE_READING), 사용자당 일일 한도, 생성 1회 잠금, 입력 검증, 결제 승인 원자화, 소유자 외 쓰기 차단, 오류 메시지 일반화, AI 출력 소독 (백엔드)
- 추가: 고전 지식베이스 출처·학파 차이표·규칙 명세·십성 항목 `docs/knowledge/` (연구소장)
- 발견·수정: 엔진 첫 구현이 중국 음력을 사용 → 골든 테스트가 검출 → 한국 음력으로 재구성(D-011)
- 검증(총괄실장 재실행): tsc 오류 0, eslint 오류 0, vitest 176 통과. 실DB·결제·AI 연동은 미검증
- 참고: 커밋 68a3e22는 "WIP 미검증"으로 저장됐으나 위 검증을 거친 내용과 동일

## 2026-11-27 — 1단계: AI 개발회사 구축 (제품 코드 변경 없음)
- 추가: `CLAUDE.md` 공통 운영규칙, `AGENTS.md` 조직도(Next.js 자동 블록 보존)
- 추가: `.claude/agents/` AI 직원 9명, `.claude/settings.json` 위험 명령 차단
- 추가: `docs/` 관리 문서 14종, 현황판(`docs/board/tasks.json` → `scripts/board/build.mjs` → `docs/TASK_BOARD.md`, `docs/board/index.html`)
- 추가: `scripts/qa/legacy-engine-audit.sh` 기존 계산 코드 감사
- 추가: `docs/reports/2026-11-27_initial-plan.md` 최초 개발계획서
- `src/`, `prisma/`, 설정 파일은 수정하지 않음

## 이전 (2026-11-16 ~ 11-23, 기존 개발)
- 초기 앱(Next.js·Prisma·Google 로그인·토스 결제 골격), 풀이 v2(복자할미 말투 원칙), 타임아웃 대응을 위한 출력 축소·폴링 구조 등 — `git log` 참조
