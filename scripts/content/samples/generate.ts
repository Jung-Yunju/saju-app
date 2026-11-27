// 견본 풀이 생성 — 실행 입구. 사용법·순서·비용: scripts/content/samples/README.md
//   node scripts/content/samples/generate.mjs --only 1 --budget-usd 0.5
//   (같은 것: npx vite-node --script scripts/content/samples/generate.ts --only 1 --budget-usd 0.5)
// 키: 환경 변수 SAJU_ANTHROPIC_API_KEY (없으면 안내만 하고 끝냄). 키 값은 출력·저장하지 않는다.
// 끝 상태 코드: 0 완료(차단된 장이 있어도) · 1 인자·실행 오류 · 2 키 없음 · 3 장 명세 없음 · 4 비용 상한으로 중단
import { main } from "./lib"

process.exitCode = await main(process.argv.slice(2))
