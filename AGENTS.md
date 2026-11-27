<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AI 직원 조직도 및 담당 업무

> 이 절은 총괄실장이 관리한다. 위·아래의 `nextjs-agent-rules` 블록은 `next dev`가 자동으로 다시 쓰므로 지우지 않는다.
> 직원 정의 파일(Claude Code 공식 서브에이전트 형식): `.claude/agents/*.md`

| 번호 | 직원 | 에이전트 이름 | 가동 시점 | 쓰기 권한(요약) |
|---|---|---|---|---|
| 01 | 총괄실장 (프로젝트 매니저) | 메인 세션 | 상시 | 계획·현황판·문서 전반, 업무 배분 |
| 02 | 명리학 연구소장 | `myeongri-research-director` | **1단계부터 가동** | `docs/knowledge/**` |
| 03 | 사주엔진 개발자 | `saju-engine-developer` | **1단계부터 가동** | `src/engine/calendar/**`, `src/engine/rules/**` + 테스트 |
| 04 | 개인화 분석 연구원 | `personalization-researcher` | 4단계 | `src/engine/personalize/**` |
| 05 | 콘텐츠 작가·캐릭터 기획자 | `content-writer` | 4단계 | `src/engine/content/prompts/**`, 캐릭터·말투 문서 |
| 06 | 디자인 실장 | `design-director` | 5단계 | `docs/DESIGN_SYSTEM.md`, `src/styles/**`, `src/components/ui/**` |
| 07 | 프론트엔드 개발자 | `frontend-developer` | 5단계 | `src/app/**`(api 제외), `src/components/**` |
| 08 | 백엔드·서버 개발자 | `backend-developer` | 6단계(긴급 보안 수정은 승인 시 조기) | `src/app/api/**`, `src/lib/**`, `prisma/**` |
| 09 | 품질검증·보안 담당자 | `qa-security-lead` | **1단계부터 가동** | `tests/**`, `scripts/qa/**`, `docs/TEST_REPORT.md` |
| 10 | 사업기획·마케팅 담당자 | `business-strategist` | 필요 시 | `docs/COST_REPORT.md`, `docs/business/**` |

## 운영 방식
- **업무 흐름**: 대표 지시 → 총괄실장이 작업계획·파일 소유권 배정 → 담당 직원 실행 → 품질검증 담당자 독립 검증 → 총괄실장 취합 → 현황판 갱신 → 대표 보고.
- **병렬 작업**: 서로 다른 파일을 맡는 직원만 동시에 투입한다. 같은 코드 영역을 건드리면 순서대로 진행한다. 코드 병렬 작업은 worktree 격리(`isolation: worktree`)를 쓰되, worktree는 기본 브랜치(main)에서 갈라지므로 필요한 선행 작업이 main에 합쳐진 뒤에 쓴다.
- **직원 간 재위임 금지**: 모든 직원은 `Agent` 도구가 막혀 있다. 다른 직원이 필요하면 총괄실장에게 요청한다(비용 폭주·업무 충돌 방지).
- **모델 배정**: 정밀도가 중요한 연구·엔진·검증·디자인·백엔드·콘텐츠는 opus, 반복 구현과 시장 조사(프론트엔드·개인화·사업기획)는 sonnet. 비용 상황에 따라 총괄실장이 조정하고 `docs/DECISIONS.md`에 기록한다.
- **Agent Teams(실험 기능)**: 현재 사용하지 않는다. 사유는 `docs/DECISIONS.md` D-002.

