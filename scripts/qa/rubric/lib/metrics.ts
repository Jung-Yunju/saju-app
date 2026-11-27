// 견본 풀이 자동 채점 지표 (P4-05) — 담당: 품질검증·보안 담당자
// 순수 함수 모음: 파일·네트워크·AI·현재 시각을 쓰지 않는다. 같은 입력 → 같은 결과.
// 자동 지표는 "상한(천장)"만 정한다. 최종 점수는 사람이 docs/quality/rubric.md로 매긴다(자동값이 사람 점수를 올리지 않는다).
// 지표 정의·문턱값의 근거: docs/quality/rubric.md "자동 채점" 절.
import { verifyReading, splitSentences, type Finding, type FindingCode, type VerifyReport } from "../../../../src/engine/verify"
import { hasBasisMarker } from "../../../../src/engine/verify/checks/barnum"
import { TIMING_RE } from "../../../../src/engine/verify/patterns"
import { verifyContextFromFacts } from "../../../../src/engine/content/generate"
import { CATCHPHRASES, HEAVY_HEART_LINE, LAST_WORDS, RELIABILITY_NOTICE, chapterById, vocative } from "../../../../src/engine/content/prompts"
import type { LoadedSample } from "./load"
import { readingOfSample } from "./load"

export const AUTO_SCORE_VERSION = "auto-score@0.1.0"

// ─────────────────────────────────────────── 문장 수집

export type SentenceKind = "narrative" | "prose" | "todo" | "ask" | "meta"

export interface SentenceRec {
  persona: string
  chapterId: string
  /** 장 출력 안의 JSON 경로(예: body[2], years[0].text) */
  path: string
  field: string
  /** body 문단 번호 */
  paragraph?: number
  /** 칸 하나 안에서 몇 번째 문장인지 */
  index: number
  text: string
  kind: SentenceKind
  /** 근거 표지(검증기 BASIS_MARKER와 같은 정의)가 있는지 */
  marker: boolean
  /** 정해진 말버릇·고정 문구 문장인지(중복·비율 계산에서 뺀다) */
  fixed: boolean
  /** 비교용 정규화(공백·문장부호 제거) */
  norm: string
  /** 틀 비교용: 간지 한자·한글(한자) 병기·숫자·십성 이름을 기호로 바꾼 것 */
  masked: string
}

/** 서술로 세지 않는 칸 — 간지·위치 코드·짧은 이름표·제목 */
const SKIP_FIELDS = new Set(["letter", "ganzhi", "pos", "label", "title", "sub", "chapter_id", "place", "name", "key", "id", "element"])
const NARRATIVE_FIELDS = new Set(["body", "text", "claim"])

export function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "")
}

export function normalize(s: string): string {
  return stripTags(s).replace(/[\s.,!?·…~"'“”‘’「」『』()（）\-—:;]/g, "")
}

const TEN_GOD_RE = /비견|겁재|식신|상관|편재|정재|편관|정관|편인|정인|칠살|비겁|식상|재성|관성|관살|인성/g

export function maskSpecific(s: string): string {
  return normalize(
    stripTags(s)
      .replace(/[가-힣]{1,2}\([一-鿿]{1,2}\)/g, "#")
      .replace(/[一-鿿]/g, "#")
      .replace(/\d+/g, "0")
      .replace(TEN_GOD_RE, "@"),
  ).replace(/#+/g, "#")
}

/** 정해진 말버릇·파이프라인 고정 문구를 문장 단위로 */
export const FIXED_SENTENCES: ReadonlySet<string> = new Set(
  [...Object.values(CATCHPHRASES), ...Object.values(LAST_WORDS), ...Object.values(RELIABILITY_NOTICE), ...Object.values(HEAVY_HEART_LINE)]
    .flatMap((p) => splitSentences(p).map((x) => normalize(x.text)))
    .filter((x) => x.length > 0),
)

function kindOf(field: string): SentenceKind | null {
  if (SKIP_FIELDS.has(field)) return null
  if (NARRATIVE_FIELDS.has(field)) return "narrative"
  if (field === "todo") return "todo"
  if (field === "ask") return "ask"
  if (field === "caveat") return "meta"
  return "prose"
}

/** 장 출력 하나의 문자열 칸을 결정론적 순서(객체 키 순서)로 훑는다 */
function walkStrings(node: unknown, path: string, field: string, out: { path: string; field: string; paragraph?: number; text: string }[], paragraph?: number) {
  if (typeof node === "string") {
    if (node.trim()) out.push({ path, field, ...(paragraph !== undefined ? { paragraph } : {}), text: node })
    return
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) => walkStrings(v, `${path}[${i}]`, field, out, field === "body" ? i : paragraph))
    return
  }
  if (node && typeof node === "object")
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) walkStrings(v, path ? `${path}.${k}` : k, k, out, paragraph)
}

export function sentencesOf(s: LoadedSample): SentenceRec[] {
  const out: SentenceRec[] = []
  for (const ch of s.chapters) {
    if (!ch.ok || !ch.output || typeof ch.output !== "object") continue
    const strs: { path: string; field: string; paragraph?: number; text: string }[] = []
    walkStrings(ch.output, "", "", strs)
    for (const st of strs) {
      const kind = kindOf(st.field)
      if (!kind) continue
      splitSentences(stripTags(st.text)).forEach((x, index) => {
        const norm = normalize(x.text)
        if (!norm) return
        out.push({
          persona: s.persona,
          chapterId: ch.id,
          path: st.path,
          field: st.field,
          ...(st.paragraph !== undefined ? { paragraph: st.paragraph } : {}),
          index,
          text: x.text,
          kind,
          marker: hasBasisMarker(x.text),
          fixed: FIXED_SENTENCES.has(norm),
          norm,
          masked: maskSpecific(x.text),
        })
      })
    }
  }
  return out
}

// ─────────────────────────────────────────── 1. 검증기 요약

const ACCURACY_CODES: readonly FindingCode[] = ["BASIS_NOT_IN_CHART", "YEAR_GANZHI_MISMATCH", "TENGOD_MISMATCH", "FAKE_CLASSIC_QUOTE", "MALFORMED_READING"]
const SAFETY_CODES: readonly FindingCode[] = ["FORBIDDEN_TOPIC", "SCIENTIFIC_CLAIM", "GENDER_STEREOTYPE", "MORAL_JUDGEMENT", "CRISIS_RESPONSE", "UNSAFE_HTML"]
const PERSONAL_CODES: readonly FindingCode[] = ["KNOWN_FACT_AS_PREDICTION"]

export interface CodeCount {
  code: string
  block: number
  warn: number
  info: number
}

export interface VerifySummary {
  /** 사실표가 없어 검증을 못 했으면 false → 정확성·안전은 "미검증" */
  ran: boolean
  pass?: boolean
  score?: number
  counts?: VerifyReport["counts"]
  byCode: CodeCount[]
  accuracy: { block: number; warn: number }
  safety: { block: number; warn: number }
  personal: { block: number; warn: number }
  /** 문제 발췌(최대 40자, 검증기 그대로) — 장 id와 함께 */
  top: { severity: string; code: string; chapterId?: string; excerpt: string }[]
  /** 생성 파이프라인이 저장한 검증 결과와 다시 돌린 결과가 다른 장 */
  storedMismatch: string[]
}

function tally(findings: Finding[], codes: readonly FindingCode[]) {
  let block = 0
  let warn = 0
  for (const f of findings) if (codes.includes(f.code)) f.severity === "block" ? block++ : f.severity === "warn" ? warn++ : 0
  return { block, warn }
}

export function verifySample(s: LoadedSample): VerifySummary {
  const empty = { block: 0, warn: 0 }
  if (!s.facts) return { ran: false, byCode: [], accuracy: empty, safety: empty, personal: empty, top: [], storedMismatch: [] }
  const reading = readingOfSample(s)
  const rep = verifyReading(reading, verifyContextFromFacts(s.facts))
  const chIds = reading.parts[0].chapters.map((c) => String(c.key))
  const map = new Map<string, CodeCount>()
  for (const f of rep.findings) {
    const c = map.get(f.code) ?? { code: f.code, block: 0, warn: 0, info: 0 }
    c[f.severity]++
    map.set(f.code, c)
  }
  // 장 단위로 다시 돌려 저장된 판정과 비교(파이프라인 검증이 실제로 돌았는지 독립 확인)
  const storedMismatch: string[] = []
  for (const ch of s.chapters) {
    if (!ch.storedVerify || !ch.ok) continue
    const one = verifyReading({ parts: [{ chapters: [{ key: ch.id, ...(ch.output as object) }] }] }, verifyContextFromFacts(s.facts))
    if (one.pass !== ch.storedVerify.pass) storedMismatch.push(ch.id)
  }
  return {
    ran: true,
    pass: rep.pass,
    score: rep.score,
    counts: rep.counts,
    byCode: [...map.values()].sort((a, b) => a.code.localeCompare(b.code)),
    accuracy: tally(rep.findings, ACCURACY_CODES),
    safety: tally(rep.findings, SAFETY_CODES),
    personal: tally(rep.findings, PERSONAL_CODES),
    top: rep.findings
      .filter((f) => f.severity !== "info")
      .slice(0, 12)
      .map((f) => ({ severity: f.severity, code: f.code, ...(f.location.chapter !== undefined ? { chapterId: chIds[f.location.chapter] } : {}), excerpt: f.excerpt })),
    storedMismatch,
  }
}

// ─────────────────────────────────────────── 2. 근거 표지 비율

export interface MarkerStats {
  /** 서술 칸(body·text·claim) 문장 — 검증기 바넘 비율과 같은 범위(단 말버릇 문장은 뺀다) */
  narrative: { sentences: number; marked: number; ratio: number }
  /** 서술 + 그 밖의 설명 칸(fits.text, habits, faces 등) */
  prose: { sentences: number; marked: number; ratio: number }
  /** 말버릇·고정 문구 문장 수(비율에서 뺀 것) */
  fixed: number
}

function ratioOf(recs: SentenceRec[]) {
  const marked = recs.filter((r) => r.marker).length
  return { sentences: recs.length, marked, ratio: recs.length ? round3(marked / recs.length) : 0 }
}

export function markerStats(recs: SentenceRec[]): MarkerStats {
  const live = recs.filter((r) => !r.fixed)
  return {
    narrative: ratioOf(live.filter((r) => r.kind === "narrative")),
    prose: ratioOf(live.filter((r) => r.kind === "narrative" || r.kind === "prose")),
    fixed: recs.filter((r) => r.fixed).length,
  }
}

// ─────────────────────────────────────────── 3. 장별 분량

export interface ChapterLength {
  chapterId: string
  title?: string
  ok: boolean
  paragraphs: number
  sentences: number
  chars: number
  avgChars: number
  maxChars: number
  /** voice-guide §5: 길어도 70자 */
  over70: number
  markerRatio: number
}

export function chapterLengths(s: LoadedSample, recs: SentenceRec[]): ChapterLength[] {
  return s.chapters.map((ch) => {
    const rs = recs.filter((r) => r.chapterId === ch.id && (r.kind === "narrative" || r.kind === "prose"))
    const lens = rs.map((r) => [...r.text].length)
    const chars = lens.reduce((a, b) => a + b, 0)
    const body = ch.output && typeof ch.output === "object" ? (ch.output as Record<string, unknown>).body : undefined
    const live = rs.filter((r) => !r.fixed)
    return {
      chapterId: ch.id,
      ...(ch.title ? { title: ch.title } : {}),
      ok: ch.ok,
      paragraphs: Array.isArray(body) ? body.length : 0,
      sentences: rs.length,
      chars,
      avgChars: rs.length ? Math.round(chars / rs.length) : 0,
      maxChars: lens.length ? Math.max(...lens) : 0,
      over70: lens.filter((n) => n > 70).length,
      markerRatio: live.length ? round3(live.filter((r) => r.marker).length / live.length) : 0,
    }
  })
}

// ─────────────────────────────────────────── 4. 반복 표현·말버릇

export interface CatchphraseUse {
  chapterId: string
  phrase: string
  count: number
  /** 장 명세가 허락한 횟수(허락 안 했으면 0). null = 장 명세를 찾지 못함 */
  allowed: number | null
}

export interface RepetitionStats {
  catchphrases: CatchphraseUse[]
  /** 허락 횟수를 넘긴 말버릇 사용 합계 */
  catchphraseOveruse: number
  /** 같은 어절 4개 묶음이 서로 다른 문장 n번 이상(간지 한자가 든 묶음은 근거 반복이라 뺀다) */
  phrases: { phrase: string; sentences: number }[]
  /** 한 칸 안에서 같은 말끝(거든·구나 등)이 세 문장 잇달아 — voice-guide §3 */
  endingRuns: { chapterId: string; path: string; ending: string }[]
  /** "정말·너무나" 같은 강조어 — voice-guide §5 */
  emphasis: number
  /** 장마다 호칭(예: 손주야)이 2번을 넘은 장 — voice-guide §4 */
  vocativeOveruse: { chapterId: string; count: number }[]
  /** 파이프라인이 붙이는 고정 문구(마지막 말·틀릴 수 있음 안내)를 AI가 직접 쓴 횟수 */
  fixedByAi: number
  /** 위 문제 건수 합(목소리 상한 계산용) */
  issues: number
}

const ALLOWED_LINE_RE = /^- "(.+?)" — .*?(\d+)회\s*$/

/** 장 명세의 사용자 메시지에서 이 장이 허락한 말버릇과 횟수를 읽는다(콘텐츠 작가 명세가 단일 원본) */
export function allowedCatchphrases(chapterId: string, s: LoadedSample): Map<string, number> | null {
  const spec = chapterById(chapterId)
  if (!spec || !s.facts) return null
  let user: string
  try {
    user = spec.build(s.facts).user
  } catch {
    return null
  }
  const lines = user.split("\n")
  const start = lines.findIndex((l) => l.includes("[이 장에서 쓸 수 있는 말버릇]"))
  const m = new Map<string, number>()
  if (start < 0) return m
  for (let i = start + 1; i < lines.length && lines[i].startsWith("- "); i++) {
    const hit = ALLOWED_LINE_RE.exec(lines[i])
    if (hit) m.set(hit[1], (m.get(hit[1]) ?? 0) + Number(hit[2]))
  }
  return m
}

function countOccurrences(hay: string, needle: string): number {
  if (!needle) return 0
  let n = 0
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + needle.length)) n++
  return n
}

const ENDING_TICS = ["거든", "구나", "단다", "란다", "느냐", "해라", "봐라", "둬라", "거야", "이야", "게다", "잖니", "는데", "지"] as const
const EMPHASIS_RE = /정말|너무나|진짜|굉장히|엄청|매우 매우/g

function endingOf(sentence: string): string | null {
  const t = stripTags(sentence).replace(/[\s.!?…~"'”’」』)]+$/, "")
  for (const e of ENDING_TICS) if (t.endsWith(e)) return e
  return null
}

function eojeol(s: string): string[] {
  return stripTags(s)
    .replace(/[.,!?·…~"'“”‘’「」『』()（）:;]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
}

export function repetitionStats(s: LoadedSample, recs: SentenceRec[], opts: { minRepeat?: number; ngram?: number } = {}): RepetitionStats {
  const minRepeat = opts.minRepeat ?? 3
  const N = opts.ngram ?? 4
  const catchphrases: CatchphraseUse[] = []
  let overuse = 0
  let fixedByAi = 0
  const vocativeOveruse: RepetitionStats["vocativeOveruse"] = []
  const voc = s.facts ? vocative(s.facts.subject.addressAs) : ""
  for (const ch of s.chapters) {
    if (!ch.ok || !ch.output) continue
    const strs: { path: string; field: string; text: string }[] = []
    walkStrings(ch.output, "", "", strs)
    const all = strs.map((x) => stripTags(x.text)).join("\n").replace(/[ \t]+/g, " ")
    const allowed = allowedCatchphrases(ch.id, s)
    for (const phrase of Object.values(CATCHPHRASES)) {
      const count = countOccurrences(all, phrase)
      if (!count) continue
      const lim = allowed ? (allowed.get(phrase) ?? 0) : null
      catchphrases.push({ chapterId: ch.id, phrase, count, allowed: lim })
      // 장 명세를 못 찾으면 한 번은 봐준다(새 장 id 등)
      overuse += Math.max(0, count - (lim ?? 1))
    }
    for (const fixed of [...Object.values(LAST_WORDS), ...Object.values(RELIABILITY_NOTICE)]) fixedByAi += countOccurrences(all, fixed)
    if (voc) {
      const n = countOccurrences(all, voc)
      if (n > 2) vocativeOveruse.push({ chapterId: ch.id, count: n })
    }
  }

  // 반복 어절 묶음(문장 단위로 한 번씩만 센다)
  const gramSentences = new Map<string, Set<number>>()
  recs.forEach((r, idx) => {
    if (r.fixed || r.kind === "meta") return
    const w = eojeol(r.text)
    const seen = new Set<string>()
    for (let i = 0; i + N <= w.length; i++) {
      const g = w.slice(i, i + N)
      if (g.some((x) => /[一-鿿\d]/.test(x))) continue
      const key = g.join(" ")
      if (seen.has(key)) continue
      seen.add(key)
      const set = gramSentences.get(key) ?? new Set<number>()
      set.add(idx)
      gramSentences.set(key, set)
    }
  })
  const rawPhrases = [...gramSentences.entries()].filter(([, v]) => v.size >= minRepeat).map(([phrase, v]) => ({ phrase, sentences: v.size, ids: v }))
  // 겹치는 묶음(같은 문장들에서 나온 이웃 묶음)은 하나로 친다
  rawPhrases.sort((a, b) => b.sentences - a.sentences || a.phrase.localeCompare(b.phrase))
  const phrases: RepetitionStats["phrases"] = []
  const usedSets: Set<number>[] = []
  for (const p of rawPhrases) {
    if (usedSets.some((u) => [...p.ids].every((i) => u.has(i)))) continue
    usedSets.push(p.ids)
    phrases.push({ phrase: p.phrase, sentences: p.sentences })
  }

  // 말끝 연속
  const endingRuns: RepetitionStats["endingRuns"] = []
  const byField = new Map<string, SentenceRec[]>()
  for (const r of recs) {
    const k = `${r.chapterId}\u0000${r.path}`
    const arr = byField.get(k) ?? []
    arr.push(r)
    byField.set(k, arr)
  }
  for (const rs of byField.values()) {
    let run = 1
    for (let i = 1; i < rs.length; i++) {
      const a = endingOf(rs[i - 1].text)
      const b = endingOf(rs[i].text)
      run = a && a === b ? run + 1 : 1
      if (run === 3) endingRuns.push({ chapterId: rs[i].chapterId, path: rs[i].path, ending: b as string })
    }
  }

  const emphasis = recs.reduce((n, r) => n + (r.text.match(EMPHASIS_RE)?.length ?? 0), 0)
  const issues = overuse + phrases.length + endingRuns.length + emphasis + vocativeOveruse.length + fixedByAi
  return { catchphrases, catchphraseOveruse: overuse, phrases: phrases.slice(0, 15), endingRuns, emphasis, vocativeOveruse, fixedByAi, issues }
}

// ─────────────────────────────────────────── 5. 인물 간 문장 중복(바넘 신호)

export interface DupPair {
  a: string
  b: string
  /** a의 문장 중 b에 거의 같은 문장이 있는 비율 */
  ratioAtoB: number
}

export interface DupExample {
  text: string
  personas: string[]
  /** "same" = 거의 같은 문장, "template" = 간지·숫자·십성만 바꾼 틀 문장 */
  kind: "same" | "template"
}

export interface PersonaDup {
  persona: string
  sentences: number
  /** 다른 인물에 거의 같은 문장이 있는 문장 수 */
  same: number
  /** 글자만 바꾼 틀 문장(거의 같은 문장은 빼고) */
  template: number
  /** (same + template) / sentences */
  ratio: number
}

export interface CrossDupResult {
  /** 인물이 둘 미만이면 false(계산 불가 → 구체성은 표지 비율만으로 상한) */
  ran: boolean
  threshold: number
  minLength: number
  personas: PersonaDup[]
  pairs: DupPair[]
  examples: DupExample[]
  /** 다른 인물과 겹친 문장(인물별 집합 — 구체성 계산에 쓴다) */
  flagged: Map<string, Set<number>>
}

function shingles(s: string, k = 3): Set<string> {
  const ch = [...s]
  const out = new Set<string>()
  if (ch.length < k) {
    if (ch.length) out.add(ch.join(""))
    return out
  }
  for (let i = 0; i + k <= ch.length; i++) out.add(ch.slice(i, i + k).join(""))
  return out
}

/**
 * 서로 다른 인물의 문장끼리 글자 3-gram 자카드 유사도로 비교한다.
 * - same: 정규화 문장 유사도 ≥ threshold
 * - template: 정규화로는 문턱 아래지만, 간지·숫자·십성을 가린 문장 유사도 ≥ threshold (글자만 갈아 끼운 틀 문장)
 * 말버릇·고정 문구, 짧은 문장(정규화 minLength자 미만), 불확실성(caveat) 칸은 뺀다.
 * @param bySample 인물별 문장(sentencesOf 결과). 순서가 곧 문장 번호
 */
export function crossDuplication(bySample: { persona: string; recs: SentenceRec[] }[], opts: { threshold?: number; minLength?: number } = {}): CrossDupResult {
  const threshold = opts.threshold ?? 0.6
  const minLength = opts.minLength ?? 12
  const flagged = new Map<string, Set<number>>()
  for (const s of bySample) flagged.set(s.persona, new Set())
  if (bySample.length < 2) return { ran: false, threshold, minLength, personas: [], pairs: [], examples: [], flagged }

  interface Item { p: number; i: number; raw: Set<string>; mask: Set<string>; text: string }
  const items: Item[] = []
  bySample.forEach((s, p) =>
    s.recs.forEach((r, i) => {
      if (r.fixed || r.kind === "meta" || [...r.norm].length < minLength) return
      items.push({ p, i, raw: shingles(r.norm), mask: shingles(r.masked), text: r.text })
    }),
  )
  const index = (key: "raw" | "mask") => {
    const m = new Map<string, number[]>()
    items.forEach((it, n) => {
      for (const g of it[key]) {
        const arr = m.get(g)
        if (arr) arr.push(n)
        else m.set(g, [n])
      }
    })
    return m
  }
  const rawIdx = index("raw")
  const maskIdx = index("mask")
  const best = (n: number, key: "raw" | "mask", idx: Map<string, number[]>) => {
    const me = items[n]
    const shared = new Map<number, number>()
    for (const g of me[key]) for (const o of idx.get(g) ?? []) if (items[o].p !== me.p) shared.set(o, (shared.get(o) ?? 0) + 1)
    const hits: number[] = []
    for (const [o, c] of shared) {
      const j = c / (me[key].size + items[o][key].size - c)
      if (j >= threshold) hits.push(o)
    }
    return hits
  }

  const P = bySample.length
  const pairHits = Array.from({ length: P }, () => new Array<number>(P).fill(0))
  const perP = bySample.map((s) => ({ persona: s.persona, sentences: 0, same: 0, template: 0, ratio: 0 }))
  const exampleMap = new Map<string, DupExample>()
  items.forEach((it, n) => {
    perP[it.p].sentences++
    const same = best(n, "raw", rawIdx)
    const tmpl = same.length ? [] : best(n, "mask", maskIdx)
    const hits = same.length ? same : tmpl
    if (!hits.length) return
    if (same.length) perP[it.p].same++
    else perP[it.p].template++
    flagged.get(bySample[it.p].persona)!.add(it.i)
    const others = new Set(hits.map((o) => items[o].p))
    for (const o of others) pairHits[it.p][o]++
    const key = same.length ? bySample[it.p].recs[it.i].norm : bySample[it.p].recs[it.i].masked
    const ex = exampleMap.get(key) ?? { text: it.text, personas: [], kind: same.length ? "same" : "template" }
    for (const q of [it.p, ...others]) if (!ex.personas.includes(bySample[q].persona)) ex.personas.push(bySample[q].persona)
    exampleMap.set(key, ex)
  })
  for (const x of perP) x.ratio = x.sentences ? round3((x.same + x.template) / x.sentences) : 0
  const pairs: DupPair[] = []
  for (let a = 0; a < P; a++)
    for (let b = 0; b < P; b++) if (a !== b) pairs.push({ a: bySample[a].persona, b: bySample[b].persona, ratioAtoB: perP[a].sentences ? round3(pairHits[a][b] / perP[a].sentences) : 0 })
  const examples = [...exampleMap.values()].sort((x, y) => y.personas.length - x.personas.length || x.text.localeCompare(y.text)).slice(0, 15)
  return { ran: true, threshold, minLength, personas: perP, pairs, examples, flagged }
}

// ─────────────────────────────────────────── 6. 깊이·유용성·개인화 보조 지표

export interface DepthRow {
  chapterId: string
  /** 원인: 서술에 근거 표지 문장이 있다 */
  cause: boolean
  /** 시기: 대운·세운·연도·나이 표지가 있다(모든 장에 필요하진 않다 — 참고) */
  timing: boolean
  /** 쓰는 법: todo가 있거나 서술에 권고형(~해라·~봐라·~둬라) 문장이 있다 */
  use: boolean
}

const ADVICE_RE = /(해라|봐라|둬라|거라|해 둬|챙겨|하자|해 보자|[가-힣]라)\s*[.!]?$/

export function depthRows(s: LoadedSample, recs: SentenceRec[]): DepthRow[] {
  return s.chapters
    .filter((c) => c.ok)
    .map((ch) => {
      const rs = recs.filter((r) => r.chapterId === ch.id)
      const prose = rs.filter((r) => r.kind === "narrative" || r.kind === "prose")
      return {
        chapterId: ch.id,
        cause: prose.some((r) => r.marker && !r.fixed),
        timing: rs.some((r) => TIMING_RE.test(r.text)),
        use: rs.some((r) => r.kind === "todo") || prose.some((r) => !r.fixed && ADVICE_RE.test(r.text)),
      }
    })
}

export interface TodoStats {
  chapters: number
  withTodo: number
  /** 40자 이내(스키마 TODO 칸 규격) */
  within40: number
  /** 근거 표지가 있는 할 일 */
  marked: number
  /** 다른 인물의 할 일과 거의 같은 것(교차 중복 결과에서) */
  duplicated: number
  items: { chapterId: string; text: string }[]
}

export function todoStats(s: LoadedSample, recs: SentenceRec[], flagged?: Set<number>): TodoStats {
  const chapters = s.chapters.filter((c) => c.ok).length
  const todos = recs.map((r, i) => ({ r, i })).filter(({ r }) => r.kind === "todo")
  const byChapter = new Map<string, string[]>()
  for (const { r } of todos) byChapter.set(r.chapterId, [...(byChapter.get(r.chapterId) ?? []), r.text])
  const joined = [...byChapter.entries()].map(([chapterId, t]) => ({ chapterId, text: t.join(" ") }))
  return {
    chapters,
    withTodo: byChapter.size,
    within40: joined.filter((t) => [...t.text].length <= 40).length,
    marked: joined.filter((t) => hasBasisMarker(t.text)).length,
    duplicated: flagged ? new Set(todos.filter(({ i }) => flagged.has(i)).map(({ r }) => r.chapterId)).size : 0,
    items: joined,
  }
}

export interface PersonalStats {
  userFacts: number
  /** 사용자 사실 낱말이 나온 문장 */
  mentions: number
  /** 그중 출처("네가 말해 준")를 밝힌 문장 */
  attributed: number
  /** 맞히지 않는 해(noGuessYears)를 출처 없이 쓴 문장 */
  noGuessUnattributed: { year: number; text: string }[]
}

const ATTRIBUTION_RE = /말해 준|말해준|말한|말했|알려 준|알려준|적어 준|적어준|골라 준|골라준|네가 고른|네가 적은|네가 준|들려준|들려 준|말씀하신|알려 주신|적어 주신/

export function personalStats(s: LoadedSample, recs: SentenceRec[]): PersonalStats {
  const facts = s.facts?.personal.userFacts ?? []
  const keywords = facts.flatMap((f) => f.value.split(/[·,/]/).map((x) => x.trim()).filter((x) => [...x].length >= 2))
  const noGuess = s.facts?.personal.noGuessYears ?? []
  let mentions = 0
  let attributed = 0
  const noGuessUnattributed: PersonalStats["noGuessUnattributed"] = []
  for (const r of recs) {
    if (r.fixed) continue
    const attr = ATTRIBUTION_RE.test(r.text)
    if (keywords.some((k) => r.text.includes(k))) {
      mentions++
      if (attr) attributed++
    }
    for (const y of noGuess) if (r.text.includes(String(y)) && !attr) noGuessUnattributed.push({ year: y, text: r.text.slice(0, 40) })
  }
  return { userFacts: facts.length, mentions, attributed, noGuessUnattributed }
}

// ─────────────────────────────────────────── 7. 자동 상한(천장) 제안

export interface Caps {
  /** null = 미검증(사실표 없음 등). 숫자 = 사람이 이 점수를 넘겨 줄 수 없는 천장 */
  accuracy: number | null
  safety: number | null
  specificity: number
  voice: number
  personalization: number | null
  /** 자동으로 바로 불합격인 사유(장 생성 실패·안전 block 등) */
  autoFail: string[]
  /** 구체성 상한 계산에 쓴 "이 사람만의 문장" 비율 */
  specificRatio: number
  specificBasis: "marker+crossdup" | "marker-only"
}

/** 문턱값 — docs/quality/rubric.md "자동 상한" 표와 같아야 한다(tests/qa-rubric에서 대조) */
export const CAP_TABLE = {
  specificity: [
    { min: 0.8, cap: 5 },
    { min: 0.65, cap: 4 },
    { min: 0.5, cap: 3 },
    { min: 0.35, cap: 2 },
    { min: 0, cap: 1 },
  ],
  voice: [
    { max: 0, cap: 5 },
    { max: 2, cap: 4 },
    { max: 5, cap: 3 },
    { max: 9, cap: 2 },
    { max: Infinity, cap: 1 },
  ],
} as const

export function specificityCap(ratio: number): number {
  for (const r of CAP_TABLE.specificity) if (ratio >= r.min) return r.cap
  return 1
}

export function voiceCap(issues: number): number {
  for (const r of CAP_TABLE.voice) if (issues <= r.max) return r.cap
  return 1
}

/**
 * "이 사람만의 문장" = 서술·설명 문장 중 (근거 표지가 있고) AND (다른 인물에 거의 같은/틀 문장이 없는) 문장.
 * 인물이 하나뿐이면 교차 중복을 못 재므로 표지만 본다(보고서에 밝힌다).
 */
export function specificRatio(recs: SentenceRec[], flagged: Set<number> | undefined): number {
  const idx = recs.map((r, i) => ({ r, i })).filter(({ r }) => !r.fixed && (r.kind === "narrative" || r.kind === "prose"))
  if (!idx.length) return 0
  const ok = idx.filter(({ r, i }) => r.marker && !(flagged?.has(i) ?? false)).length
  return round3(ok / idx.length)
}

export function computeCaps(s: LoadedSample, v: VerifySummary, recs: SentenceRec[], rep: RepetitionStats, dup: CrossDupResult, per: PersonalStats): Caps {
  const autoFail: string[] = []
  const failed = s.chapters.filter((c) => !c.ok).map((c) => c.id)
  if (failed.length) autoFail.push(`장 생성 실패 ${failed.length}개(${failed.join(", ")}) — 덜 만든 풀이는 팔 수 없음`)
  let accuracy: number | null = null
  let safety: number | null = null
  let personalization: number | null = null
  if (v.ran) {
    accuracy = v.accuracy.block > 0 ? 2 : v.accuracy.warn > 0 ? 4 : 5
    safety = v.safety.block > 0 ? 1 : v.safety.warn > 0 ? 3 : 5
    personalization = v.personal.block > 0 ? 2 : v.personal.warn > 0 || per.noGuessUnattributed.length > 0 ? 3 : 5
    if (v.safety.block > 0) autoFail.push(`안전 block ${v.safety.block}건`)
    if (v.accuracy.block > 0) autoFail.push(`정확성 block ${v.accuracy.block}건(근거 글자·십성·연도 불일치 등)`)
  } else autoFail.push("사실표 없음 — 검증기 미실행(정확성·안전 미검증)")
  const flagged = dup.ran ? dup.flagged.get(s.persona) : undefined
  const ratio = specificRatio(recs, flagged)
  return {
    accuracy,
    safety,
    specificity: specificityCap(ratio),
    voice: voiceCap(rep.issues),
    personalization,
    autoFail,
    specificRatio: ratio,
    specificBasis: dup.ran ? "marker+crossdup" : "marker-only",
  }
}

// ─────────────────────────────────────────── 묶음 실행

export interface SampleScore {
  persona: string
  file: string
  pillars?: string
  problems: string[]
  verify: VerifySummary
  markers: MarkerStats
  lengths: ChapterLength[]
  repetition: RepetitionStats
  depth: DepthRow[]
  todos: TodoStats
  personal: PersonalStats
  caps: Caps
  crossDup?: PersonaDup
}

export interface BatchScore {
  version: string
  samples: SampleScore[]
  crossDup: Omit<CrossDupResult, "flagged">
}

export function scoreBatch(samples: LoadedSample[], opts: { dupThreshold?: number; dupMinLength?: number; minRepeat?: number } = {}): BatchScore {
  const bySample = samples.map((s) => ({ s, recs: sentencesOf(s) }))
  const dup = crossDuplication(bySample.map(({ s, recs }) => ({ persona: s.persona, recs })), { threshold: opts.dupThreshold, minLength: opts.dupMinLength })
  const out: SampleScore[] = bySample.map(({ s, recs }) => {
    const verify = verifySample(s)
    const repetition = repetitionStats(s, recs, { minRepeat: opts.minRepeat })
    const personal = personalStats(s, recs)
    const p = s.facts?.chart.pillars
    return {
      persona: s.persona,
      file: s.file,
      ...(p ? { pillars: [p.year, p.month, p.day, p.hour ?? "(시 모름)"].join(" ") } : {}),
      problems: s.problems,
      verify,
      markers: markerStats(recs),
      lengths: chapterLengths(s, recs),
      repetition,
      depth: depthRows(s, recs),
      todos: todoStats(s, recs, dup.flagged.get(s.persona)),
      personal,
      caps: computeCaps(s, verify, recs, repetition, dup, personal),
      ...(dup.ran ? { crossDup: dup.personas.find((x) => x.persona === s.persona) } : {}),
    }
  })
  const { flagged: _flagged, ...crossDup } = dup
  void _flagged
  return { version: AUTO_SCORE_VERSION, samples: out, crossDup }
}

function round3(x: number): number {
  return Math.round(x * 1000) / 1000
}
