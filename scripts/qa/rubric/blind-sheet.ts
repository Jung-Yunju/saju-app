// 대표용 블라인드 채점 시트 생성·풀기 (P4-05) — 담당: 품질검증·보안 담당자
// 시트 만들기:
//   npx vite-node scripts/qa/rubric/blind-sheet.ts samples/2026-11-28 --seed 아무말 [--compare p01,p03] [--swap 8] [--mask 할미,할머니,복자 | --no-mask]
//   → <폴더>/blind-sheet.html (대표가 브라우저로 연다) + <폴더>/blind-key.json (정답표 — 채점 끝날 때까지 대표가 열지 않는다)
// 결과 풀기:
//   npx vite-node scripts/qa/rubric/blind-sheet.ts samples/2026-11-28 --unblind 내려받은/blind-scores-xxxx.json
//   → <폴더>/blind-result.md (점수·판정만. auto-score.json이 있으면 자동 상한을 적용)
// 경쟁사 원문은 이 스크립트가 받지 않는다. 시트의 붙여 넣기 칸은 브라우저 화면에서만 쓰이고 저장되지 않는다.
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { loadSamplesDir } from "./lib/load"
import { buildBlindSheet, type BlindKey, type ExportedScores } from "./lib/blind"
import { unblind } from "./lib/unblind"
import type { BatchScore } from "./lib/metrics"

export interface BlindArgs {
  dir: string
  seed?: string
  compare: string[]
  swap?: number
  mask?: string[]
  unblind?: string
}

export function parseArgs(argv: string[]): BlindArgs {
  const val = (k: string) => {
    const i = argv.indexOf(k)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const withValue = new Set(["--seed", "--compare", "--swap", "--mask", "--unblind"])
  const positional = argv.filter((a, i) => !a.startsWith("--") && !withValue.has(argv[i - 1] ?? ""))
  if (!positional[0]) throw new Error("사용법: blind-sheet.ts <samples/날짜 폴더> --seed 문자열 [--compare p1,p2] | --unblind 점수.json")
  const list = (v: string | undefined) => (v ? v.split(",").map((x) => x.trim()).filter(Boolean) : [])
  return {
    dir: resolve(positional[0]),
    seed: val("--seed"),
    compare: list(val("--compare")),
    ...(val("--swap") ? { swap: Number(val("--swap")) } : {}),
    ...(argv.includes("--no-mask") ? { mask: [] } : val("--mask") ? { mask: list(val("--mask")) } : {}),
    ...(val("--unblind") ? { unblind: resolve(val("--unblind")!) } : {}),
  }
}

export function runBlindSheet(a: BlindArgs): { htmlPath: string; keyPath: string; key: BlindKey } {
  if (!a.seed) throw new Error("--seed가 필요합니다(대표만 아는 아무 문자열 — 같은 seed면 같은 배정)")
  const { samples } = loadSamplesDir(a.dir)
  if (!samples.length) throw new Error(`견본이 없습니다: ${a.dir}`)
  const { html, key } = buildBlindSheet(samples, { seed: a.seed, compare: a.compare, ...(a.swap ? { swapPerSample: a.swap } : {}), ...(a.mask ? { maskWords: a.mask } : {}) })
  const htmlPath = join(a.dir, "blind-sheet.html")
  const keyPath = join(a.dir, "blind-key.json")
  writeFileSync(htmlPath, html, "utf8")
  writeFileSync(keyPath, JSON.stringify(key, null, 2) + "\n", "utf8")
  return { htmlPath, keyPath, key }
}

export function runUnblind(a: BlindArgs): { outPath: string; markdown: string } {
  const key = JSON.parse(readFileSync(join(a.dir, "blind-key.json"), "utf8")) as BlindKey
  const scores = JSON.parse(readFileSync(a.unblind!, "utf8")) as ExportedScores
  const autoPath = join(a.dir, "auto-score.json")
  const auto = existsSync(autoPath) ? (JSON.parse(readFileSync(autoPath, "utf8")) as BatchScore) : undefined
  const { markdown } = unblind(key, scores, auto)
  const outPath = join(a.dir, "blind-result.md")
  writeFileSync(outPath, markdown, "utf8")
  return { outPath, markdown }
}

if (/blind-sheet\.ts$/.test(process.argv[1] ?? "")) {
  try {
    const a = parseArgs(process.argv.slice(2))
    if (a.unblind) console.log(`결과 → ${runUnblind(a).outPath}`)
    else {
      const r = runBlindSheet(a)
      console.log(`시트 → ${r.htmlPath}\n정답표 → ${r.keyPath} (채점이 끝날 때까지 열지 마세요)\n비교 ${r.key.compare.length}건 · 견본 ${r.key.ours.length}편 · 표본 문장 ${r.key.swap.length}개`)
    }
  } catch (e) {
    console.error((e as Error).message)
    process.exit(1)
  }
}
