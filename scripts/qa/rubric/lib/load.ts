// 견본 풀이 읽기 (P4-05) — 담당: 품질검증·보안 담당자
// 입력: samples/<날짜>/<persona>.json — 백엔드 견본 생성기가 쓰는 파일(사실표 FactSheet + 장별 ChapterResult).
// 모양이 아직 확정 전이라 느슨하게 받는다:
//   { persona?, facts | factSheet, chapters | results | run.chapters: ChapterResult[] }
// ChapterResult.output = 콘텐츠 작가의 장 스키마(src/engine/content/prompts/**)를 따르는 JSON.
// 이 모듈은 파일을 읽기만 한다. 네트워크·AI 호출 없음.
import { readdirSync, readFileSync, statSync } from "node:fs"
import { basename, join } from "node:path"
import type { FactSheet } from "../../../../src/engine/content/types"

export interface LoadedChapter {
  id: string
  /** 장 출력의 title(없으면 undefined) */
  title?: string
  ok: boolean
  output?: unknown
  error?: string
  /** 생성 파이프라인이 붙여 둔 검증 결과(있으면) — 자동 채점은 독립적으로 다시 검증한다 */
  storedVerify?: { pass: boolean; findings: unknown[] }
}

export interface LoadedSample {
  file: string
  persona: string
  facts?: FactSheet
  chapters: LoadedChapter[]
  /** 읽으면서 발견한 형식 문제(채점 보고서에 그대로 적는다) */
  problems: string[]
}

/** 견본이 아닌 파일 — 자동 채점·블라인드 시트 산출물, 숨김·밑줄 파일 */
export function isSampleFileName(name: string): boolean {
  if (!name.endsWith(".json")) return false
  if (name.startsWith(".") || name.startsWith("_")) return false
  if (/^(auto-score|blind-|manifest|summary|index|run-|cost)/i.test(name)) return false
  // 경쟁사 원문은 저장소에 두지 않는다 — 혹시 들어와도 견본으로 읽지 않는다
  if (/competitor|경쟁/i.test(name)) return false
  return true
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v)
}

function looksLikeFactSheet(v: unknown): v is FactSheet {
  return isObj(v) && isObj(v.chart) && isObj((v.chart as Record<string, unknown>).pillars) && isObj(v.luck) && isObj(v.subject)
}

function pickChapters(j: Record<string, unknown>): unknown[] | undefined {
  if (Array.isArray(j.chapters)) return j.chapters
  if (Array.isArray(j.results)) return j.results
  if (isObj(j.run) && Array.isArray(j.run.chapters)) return j.run.chapters as unknown[]
  if (isObj(j.result) && Array.isArray(j.result.chapters)) return j.result.chapters as unknown[]
  return undefined
}

/** JSON 한 편 → LoadedSample. 형식이 어긋나도 던지지 않고 problems에 적는다 */
export function parseSample(json: unknown, file: string): LoadedSample {
  const stem = basename(file).replace(/\.json$/, "")
  const out: LoadedSample = { file: basename(file), persona: stem, chapters: [], problems: [] }
  if (!isObj(json)) {
    out.problems.push("JSON 최상위가 객체가 아님")
    return out
  }
  if (typeof json.persona === "string" && json.persona.trim()) out.persona = json.persona.trim()
  else if (isObj(json.persona) && typeof json.persona.id === "string") out.persona = json.persona.id

  const facts = json.facts ?? json.factSheet ?? json.factsheet
  if (looksLikeFactSheet(facts)) out.facts = facts
  else out.problems.push("사실표(facts)가 없거나 모양이 다름 — 검증기 대조 불가")

  const chs = pickChapters(json)
  if (!chs) {
    out.problems.push("장 목록(chapters)이 없음")
    return out
  }
  chs.forEach((c, i) => {
    if (!isObj(c)) {
      out.problems.push(`chapters[${i}]가 객체가 아님`)
      return
    }
    const id = typeof c.id === "string" ? c.id : `chapter-${i}`
    const output = c.output
    const title = isObj(output) && typeof output.title === "string" ? output.title : undefined
    const ok = c.ok === undefined ? output !== undefined : c.ok === true
    const ch: LoadedChapter = { id, ok, ...(title ? { title } : {}), ...(output !== undefined ? { output } : {}) }
    if (typeof c.error === "string") ch.error = c.error
    if (isObj(c.verify) && typeof c.verify.pass === "boolean") ch.storedVerify = { pass: c.verify.pass, findings: Array.isArray(c.verify.findings) ? c.verify.findings : [] }
    if (!ok) out.problems.push(`장 ${id} 생성 실패${ch.error ? `(${ch.error})` : ""}`)
    else if (!isObj(output)) out.problems.push(`장 ${id} 출력이 객체가 아님`)
    out.chapters.push(ch)
  })
  return out
}

export interface LoadResult {
  dir: string
  samples: LoadedSample[]
  skipped: { file: string; reason: string }[]
}

/** samples/<날짜> 폴더의 견본 전부(파일 이름 순 — 결정론적) */
export function loadSamplesDir(dir: string): LoadResult {
  if (!statSync(dir).isDirectory()) throw new Error(`폴더가 아님: ${dir}`)
  const names = readdirSync(dir).sort()
  const samples: LoadedSample[] = []
  const skipped: LoadResult["skipped"] = []
  for (const name of names) {
    if (!name.endsWith(".json")) continue
    if (!isSampleFileName(name)) {
      skipped.push({ file: name, reason: "견본 파일이 아님(산출물·숨김·경쟁사 이름)" })
      continue
    }
    let json: unknown
    try {
      json = JSON.parse(readFileSync(join(dir, name), "utf8"))
    } catch (e) {
      skipped.push({ file: name, reason: `JSON 읽기 실패: ${(e as Error).message.slice(0, 80)}` })
      continue
    }
    const s = parseSample(json, name)
    if (s.chapters.length === 0) {
      skipped.push({ file: name, reason: s.problems.join("; ") || "장 없음" })
      continue
    }
    samples.push(s)
  }
  // 인물 이름이 겹치면 파일 이름으로 구분
  const seen = new Map<string, number>()
  for (const s of samples) seen.set(s.persona, (seen.get(s.persona) ?? 0) + 1)
  for (const s of samples) if ((seen.get(s.persona) ?? 0) > 1) s.persona = `${s.persona}(${s.file})`
  return { dir, samples, skipped }
}

/** 장 출력들을 검증기가 읽는 풀이 모양(parts[0].chapters[])으로 합친다. key = 장 id */
export function readingOfSample(s: LoadedSample): { parts: { title: string; chapters: Record<string, unknown>[] }[] } {
  const chapters = s.chapters
    .filter((c) => c.ok && isObj(c.output))
    .map((c) => ({ key: c.id, ...(c.output as Record<string, unknown>), ...(c.title ? { title: c.title } : {}) }))
  return { parts: [{ title: s.persona, chapters }] }
}
