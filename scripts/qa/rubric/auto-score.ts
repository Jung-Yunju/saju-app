// 견본 풀이 자동 채점 (P4-05) — 담당: 품질검증·보안 담당자
// 실행: npx vite-node scripts/qa/rubric/auto-score.ts samples/2026-11-28 [--json] [--out 파일] [--dup-threshold 0.6] [--dup-min 12] [--min-repeat 3]
//   (또는 node scripts/qa/rubric/run.mjs auto-score samples/2026-11-28)
// 입력: 폴더 안의 <persona>.json(사실표 + 장별 ChapterResult). auto-score.*·blind-*·경쟁사 이름 파일은 읽지 않는다.
// 출력: <폴더>/auto-score.md (기본), --json이면 <폴더>/auto-score.json도.
// AI·네트워크 호출 없음. 비용 0.
import { writeFileSync } from "node:fs"
import { basename, join, resolve } from "node:path"
import { loadSamplesDir } from "./lib/load"
import { scoreBatch, type BatchScore } from "./lib/metrics"
import { renderAutoScoreMarkdown } from "./lib/report"

export interface AutoScoreArgs {
  dir: string
  json: boolean
  out?: string
  dupThreshold?: number
  dupMinLength?: number
  minRepeat?: number
}

export function parseArgs(argv: string[]): AutoScoreArgs {
  const val = (k: string) => {
    const i = argv.indexOf(k)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const num = (k: string) => {
    const v = val(k)
    if (v === undefined) return undefined
    const n = Number(v)
    if (!Number.isFinite(n)) throw new Error(`${k} 값이 숫자가 아님: ${v}`)
    return n
  }
  const flagsWithValue = new Set(["--out", "--dup-threshold", "--dup-min", "--min-repeat"])
  const positional = argv.filter((a, i) => !a.startsWith("--") && !flagsWithValue.has(argv[i - 1] ?? ""))
  if (!positional[0]) throw new Error("사용법: auto-score.ts <samples/날짜 폴더> [--json] [--out 파일]")
  return {
    dir: resolve(positional[0]),
    json: argv.includes("--json"),
    ...(val("--out") ? { out: resolve(val("--out")!) } : {}),
    dupThreshold: num("--dup-threshold"),
    dupMinLength: num("--dup-min"),
    minRepeat: num("--min-repeat"),
  }
}

/** 채점 실행 + 파일 쓰기. 테스트에서도 이 함수를 그대로 부른다 */
export function runAutoScore(a: AutoScoreArgs): { batch: BatchScore; markdown: string; outPath: string } {
  const loaded = loadSamplesDir(a.dir)
  const batch = scoreBatch(loaded.samples, { dupThreshold: a.dupThreshold, dupMinLength: a.dupMinLength, minRepeat: a.minRepeat })
  const markdown = renderAutoScoreMarkdown(batch, { folder: basename(a.dir), skipped: loaded.skipped })
  const outPath = a.out ?? join(a.dir, "auto-score.md")
  writeFileSync(outPath, markdown, "utf8")
  if (a.json) writeFileSync(outPath.replace(/\.md$/, "") + ".json", JSON.stringify(batch, null, 2) + "\n", "utf8")
  return { batch, markdown, outPath }
}

const isMain = (() => {
  const argv1 = process.argv[1] ?? ""
  return /auto-score\.ts$/.test(argv1)
})()

if (isMain) {
  try {
    const a = parseArgs(process.argv.slice(2))
    const { batch, outPath } = runAutoScore(a)
    const fails = batch.samples.filter((s) => s.caps.autoFail.length).length
    console.log(`자동 채점 ${batch.samples.length}편 · 자동 불합격 ${fails}편 → ${outPath}`)
  } catch (e) {
    console.error((e as Error).message)
    process.exit(1)
  }
}
