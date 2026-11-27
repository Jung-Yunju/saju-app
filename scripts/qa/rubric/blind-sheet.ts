// 대표용 블라인드 채점 시트 생성·풀기 (P4-05) — 담당: 품질검증·보안 담당자
// 시트 만들기:
//   npx vite-node scripts/qa/rubric/blind-sheet.ts samples/2026-11-28 --seed 아무말 [--compare p01,p03] [--swap 8] [--mask 할미,할머니,복자 | --no-mask]
//   → <폴더>/blind-sheet.html (대표가 브라우저로 연다) + <폴더>/blind-key.json (정답표 — 채점 끝날 때까지 대표가 열지 않는다)
// 결과 풀기:
//   npx vite-node scripts/qa/rubric/blind-sheet.ts samples/2026-11-28 --unblind 내려받은/blind-scores-xxxx.json
//   → <폴더>/blind-result.md (점수·판정만. auto-score.json이 있으면 자동 상한을 적용)
// 경쟁사 원문은 이 스크립트가 받지 않는다. 시트의 붙여 넣기 칸은 브라우저 화면에서만 쓰이고 저장되지 않는다.
import { parseBlindArgs, runBlindSheet, runUnblind } from "./lib/commands"

try {
  const a = parseBlindArgs(process.argv.slice(2))
  if (a.unblind) console.log(`결과 → ${runUnblind(a).outPath}`)
  else {
    const r = runBlindSheet(a)
    console.log(`시트 → ${r.htmlPath}\n정답표 → ${r.keyPath} (채점이 끝날 때까지 열지 마세요)\n비교 ${r.key.compare.length}건 · 견본 ${r.key.ours.length}편 · 표본 문장 ${r.key.swap.length}개`)
  }
} catch (e) {
  console.error((e as Error).message)
  process.exit(1)
}
