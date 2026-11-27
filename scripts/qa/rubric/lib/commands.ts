// 채점 도구 명령 본체 (P4-05) — 명령줄 파일(auto-score.ts·blind-sheet.ts)과 테스트가 같이 쓴다. AI·네트워크 호출 없음.
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { basename, join, resolve } from "node:path"
import { loadSamplesDir } from "./load"
import { scoreBatch, type BatchScore } from "./metrics"
import { renderAutoScoreMarkdown } from "./report"
import { buildBlindSheet, parseCompareSpec, type BlindKey, type ExportedScores } from "./blind"
import { unblind } from "./unblind"

export interface AutoScoreArgs {
  dir: string
  json: boolean
  out?: string
  dupThreshold?: number
  dupMinLength?: number
  minRepeat?: number
}

export function parseAutoScoreArgs(argv: string[]): AutoScoreArgs {
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


export interface BlindArgs {
  dir: string
  seed?: string
  /** "인물" 또는 "인물:경쟁사이름" (이름 생략 시 1순위 기준점 할마카세) */
  compare: string[]
  swap?: number
  mask?: string[]
  unblind?: string
}

export function parseBlindArgs(argv: string[]): BlindArgs {
  const val = (k: string) => {
    const i = argv.indexOf(k)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const withValue = new Set(["--seed", "--compare", "--swap", "--mask", "--unblind"])
  const positional = argv.filter((a, i) => !a.startsWith("--") && !withValue.has(argv[i - 1] ?? ""))
  if (!positional[0]) throw new Error("사용법: blind-sheet.ts <samples/날짜 폴더> --seed 문자열 [--compare p1[:경쟁사],p2] | --unblind 점수.json")
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
  const { html, key } = buildBlindSheet(samples, { seed: a.seed, compare: a.compare.map(parseCompareSpec), ...(a.swap ? { swapPerSample: a.swap } : {}), ...(a.mask ? { maskWords: a.mask } : {}) })
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

