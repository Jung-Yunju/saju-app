// 견본 풀이 자동 채점 (P4-05) — 담당: 품질검증·보안 담당자
// 실행: npx vite-node scripts/qa/rubric/auto-score.ts samples/2026-11-28 [--json] [--out 파일] [--dup-threshold 0.6] [--dup-min 12] [--min-repeat 3]
//   (또는 node scripts/qa/rubric/run.mjs auto-score samples/2026-11-28)
// 입력: 폴더 안의 <persona>.json(사실표 + 장별 ChapterResult). auto-score.*·blind-*·경쟁사 이름 파일은 읽지 않는다.
// 출력: <폴더>/auto-score.md (기본), --json이면 <폴더>/auto-score.json도.
// AI·네트워크 호출 없음. 비용 0.
import { parseAutoScoreArgs, runAutoScore } from "./lib/commands"

try {
  const { batch, outPath } = runAutoScore(parseAutoScoreArgs(process.argv.slice(2)))
  const fails = batch.samples.filter((s) => s.caps.autoFail.length).length
  console.log(`자동 채점 ${batch.samples.length}편 · 자동 불합격 ${fails}편 → ${outPath}`)
} catch (e) {
  console.error((e as Error).message)
  process.exit(1)
}
