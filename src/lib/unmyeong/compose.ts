// 운명비서 무료 5장 조립기 — 대표 피드백(2026-11-28) "사주풀이는 전혀 없어" 대응.
// 규칙 원본: content/unmyeong/compose.json(콘텐츠 작가 소유 — 읽기만). 사람용 설명: docs/knowledge/free-copy.md §9.
// 재료(정적 import, 빌드 때 번들에 들어간다 — free-copy.ts와 같은 방식):
//   day-pillar.json(일주 60) · day-master.json(일간 10) · elements.json(오행 넘침·없음·묶음) · this-year.json(해 × 일간 + 일지 덧줄)
//   + free-copy.json(2장 원형 본문 · 5장 대체 본문({bridge} 처리) · 시각 모름 안내 문장)
// 원칙:
//   - 새 판정을 만들지 않는다. 입력은 모두 엔진 값(원국·일주·일간·오행 개수 counts·지장간 포함 가중 weighted·세운·interactions·원형·시각 모름).
//   - 순수 함수: AI·DB·네트워크·파일·현재 시각을 쓰지 않는다. 같은 입력이면 같은 글.
//   - 응답 형식은 UnmyeongFreeChapter{no,key,title,text} 그대로(화면 수정 불필요).
// 조립 순서: 장별 조각 고르기(충돌 원칙 2·3·4 반영) → 길이 맞추기(400~600, 줄이기·보충 순서, 650 경고) → 원칙 5(같은 문장 두 장)·6(같은 어미 세 번) 점검.
// 재료 문장 나누기는 작가 약속대로 ". "(마침표 + 공백)에서 자르고, 문장 수가 약속과 다르면 그 재료는 통째로 쓴다(경고).
import composeJson from "../../../content/unmyeong/compose.json"
import dayPillarJson from "../../../content/unmyeong/day-pillar.json"
import dayMasterJson from "../../../content/unmyeong/day-master.json"
import elementsJson from "../../../content/unmyeong/elements.json"
import thisYearJson from "../../../content/unmyeong/this-year.json"
import type { Element, Interaction, RuleAnalysis } from "@/engine"
import { FREE_CHAPTER_KEYS, type FreeChapterKey } from "./assets"
import { bridgeOf, freeCopyHourNoteText, loadFreeCopy, selectFreeChapters } from "./free-copy"
import type { UnmyeongArchetypeView, UnmyeongFreeChapter } from "./free-types"

// ─────────────────────────────────────────── 입력(엔진 값)

/** 조립에 쓰는 사실. 모두 엔진(만세력·규칙 엔진·원형 엔진) 결과에서 옮긴다 — composeFactsFrom */
export interface ComposeFacts {
  /** 일간 한자 예: "丙" */
  dayStem: string
  /** 일지 한자 예: "子" */
  dayBranch: string
  /** 일간 오행 */
  dayMasterElement: Element
  /** 천간 + 지지 정기 오행 개수(규칙 엔진 elements.counts — 드러난 글자 기준) */
  counts: Record<Element, number>
  /** 지장간 포함 가중 값(규칙 엔진 elements.weighted) — 없음(lack)인 오행이 땅 글자 속에 있는지 */
  weighted: Record<Element, number>
  hourUnknown: boolean
  /** 올해(응답 thisYear.year) */
  year: number
  /** 올해 간지 한자(규칙 엔진 source.seun) 예: "丙午". 없으면 null → 5장 대체 본문 */
  yearGanzhi: string | null
  /** 일지 ↔ 세운 지지 관계(규칙 엔진 interactions 중 clash·sixCombine, 두 글자) */
  dayBranchRelations: { type: "clash" | "sixCombine"; chars: [string, string] }[]
  archetype: UnmyeongArchetypeView | null
}

const EL_ORDER: readonly Element[] = ["wood", "fire", "earth", "metal", "water"]

/** 규칙 엔진 결과(세운 포함) → 조립 사실. 새 값을 계산하지 않고 옮기기만 한다 */
export function composeFactsFrom(
  rules: RuleAnalysis,
  ctx: { hourUnknown: boolean; year: number; archetype: UnmyeongArchetypeView | null },
): ComposeFacts {
  const day = rules.source.natal.day
  const seun = rules.source.seun
  const isAt = (m: Interaction["members"][number], pillar: "day" | "seun") => m.pillar === pillar && m.part === "branch"
  const relations: ComposeFacts["dayBranchRelations"] = []
  for (const it of rules.interactions) {
    if ((it.type !== "clash" && it.type !== "sixCombine") || it.members.length !== 2) continue
    const di = it.members.findIndex((m) => isAt(m, "day"))
    const si = it.members.findIndex((m) => isAt(m, "seun"))
    if (di < 0 || si < 0) continue
    relations.push({ type: it.type, chars: [String(it.chars[di]), String(it.chars[si])] })
  }
  return {
    dayStem: day.stem,
    dayBranch: day.branch,
    dayMasterElement: rules.dayMaster.element,
    counts: { ...rules.elements.counts },
    weighted: { ...rules.elements.weighted },
    hourUnknown: ctx.hourUnknown,
    year: ctx.year,
    yearGanzhi: seun ? seun.stem + seun.branch : null,
    dayBranchRelations: relations,
    archetype: ctx.archetype,
  }
}

// ─────────────────────────────────────────── 재료 정리(형식이 다르면 null)

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v)
const s = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null)
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : [])
const isEl = (v: unknown): v is Element => typeof v === "string" && (EL_ORDER as readonly string[]).includes(v)

interface DayPillarItem { label: string; oneLiner: string; detail: string }
interface DayMasterItem { label: string; body: string; strength: string; blindSpot: string }
interface ElementItem { name: string; excess: string; lack: string }
interface YearEntry {
  year: number
  ganzhi: string
  byStem: Map<string, string>
  dayBranch: { branch: string; interaction: string; line: string }[]
}

export interface ComposeMaterials {
  dayPillars: Map<string, DayPillarItem>
  dayMasters: Map<string, DayMasterItem>
  elements: {
    numerals: Record<string, string>
    thresholds: { lack: number; excessFull: number; excessHourUnknown: number }
    tenGodLineTemplate: string
    groupBy: Record<Element, Record<Element, string>>
    gloss: Record<string, string>
    items: Map<Element, ElementItem>
  }
  years: YearEntry[]
  rules: {
    titles: { no: number; key: FreeChapterKey; title: string }[]
    fixed: { opening: string; dayPillarIntro: string; hiddenNote: string; weatherLead: string; dayBranchJoinFrom: string; dayBranchJoinTo: string }
    being: Record<string, string>
    beingShort: Record<string, string>
    counsel: Record<string, string>
    counselConflicts: { year: number; stem: string; archetype: string }[]
    budget: { min: number; max: number; hardMax: number }
  }
}

const strMap = (v: unknown): Record<string, string> => {
  const out: Record<string, string> = {}
  if (isObj(v)) for (const [k, x] of Object.entries(v)) { const t = s(x); if (t) out[k] = t }
  return out
}

/** 재료 JSON 다섯 개 → 정리된 재료. 하나라도 형식이 다르면 null(조립하지 않음) */
export function normalizeMaterials(raw: { compose: unknown; dayPillar: unknown; dayMaster: unknown; elements: unknown; thisYear: unknown }): ComposeMaterials | null {
  const { compose, dayPillar, dayMaster, elements, thisYear } = raw
  if (!isObj(compose) || !isObj(dayPillar) || !isObj(dayMaster) || !isObj(elements) || !isObj(thisYear)) return null

  const dayPillars = new Map<string, DayPillarItem>()
  for (const it of arr(dayPillar.items)) {
    const p = s(it.pillar), label = s(it.label), oneLiner = s(it.oneLiner), detail = s(it.detail)
    if (p && label && oneLiner && detail) dayPillars.set(p, { label, oneLiner, detail })
  }
  const dayMasters = new Map<string, DayMasterItem>()
  for (const it of arr(dayMaster.items)) {
    const st = s(it.stem), label = s(it.label), body = s(it.body), strength = s(it.strength), blindSpot = s(it.blindSpot)
    if (st && label && body && strength && blindSpot) dayMasters.set(st, { label, body, strength, blindSpot })
  }

  const th = isObj(elements.thresholds) ? elements.thresholds : null
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null)
  const thresholds = th && num(th.lack) !== null && num(th.excessFull) !== null && num(th.excessHourUnknown) !== null
    ? { lack: th.lack as number, excessFull: th.excessFull as number, excessHourUnknown: th.excessHourUnknown as number }
    : null
  const groupBy = {} as Record<Element, Record<Element, string>>
  const gb = isObj(elements.groupByDayMasterElement) ? elements.groupByDayMasterElement : {}
  for (const e of EL_ORDER) {
    const row = strMap(gb[e])
    if (!EL_ORDER.every((x) => row[x])) return null
    groupBy[e] = row as Record<Element, string>
  }
  const gloss: Record<string, string> = {}
  if (isObj(elements.tenGodGroups)) for (const [g, v] of Object.entries(elements.tenGodGroups)) { const t = isObj(v) ? s(v.gloss) : null; if (t) gloss[g] = t }
  const items = new Map<Element, ElementItem>()
  for (const it of arr(elements.items)) {
    const name = s(it.name)
    const ex = isObj(it.excess) ? s(it.excess.text) : null
    const lk = isObj(it.lack) ? s(it.lack.text) : null
    if (isEl(it.element) && name && ex && lk) items.set(it.element, { name, excess: ex, lack: lk })
  }
  const tenGodLineTemplate = s(elements.tenGodLineTemplate)
  if (!thresholds || !tenGodLineTemplate || items.size !== EL_ORDER.length) return null

  const years: YearEntry[] = []
  for (const y of arr(thisYear.years)) {
    const ganzhi = s(y.ganzhi)
    if (typeof y.year !== "number" || !ganzhi) continue
    const byStem = new Map<string, string>()
    for (const b of arr(y.byDayMaster)) { const st = s(b.stem), line = s(b.line); if (st && line) byStem.set(st, line) }
    const dayBranch: YearEntry["dayBranch"] = []
    for (const d of arr(y.dayBranch)) {
      const branch = s(d.branch), interaction = s(d.interaction), line = s(d.line)
      if (branch && interaction && line) dayBranch.push({ branch, interaction, line })
    }
    years.push({ year: y.year, ganzhi, byStem, dayBranch })
  }

  // compose.json
  const chapters = arr(compose.chapters)
  if (chapters.length !== FREE_CHAPTER_KEYS.length) return null
  const titles: ComposeMaterials["rules"]["titles"] = []
  for (const [i, key] of FREE_CHAPTER_KEYS.entries()) {
    const c = chapters[i]
    const title = s(c.title)
    if (c.key !== key || c.no !== i + 1 || !title) return null
    titles.push({ no: i + 1, key, title })
  }
  const f = strMap(compose.fixed)
  const fixedKeys = ["opening", "dayPillarIntro", "hiddenNote", "weatherLead", "dayBranchJoinFrom", "dayBranchJoinTo"] as const
  if (!fixedKeys.every((k) => f[k])) return null
  // dayBranchJoinFrom·To는 끝 공백까지가 약속이다(s()가 다듬기 전 원문을 쓴다)
  const fixedRaw = isObj(compose.fixed) ? compose.fixed : {}
  const fixed = {
    opening: f.opening, dayPillarIntro: f.dayPillarIntro, hiddenNote: f.hiddenNote, weatherLead: f.weatherLead,
    dayBranchJoinFrom: String(fixedRaw.dayBranchJoinFrom), dayBranchJoinTo: String(fixedRaw.dayBranchJoinTo),
  }
  const al = isObj(compose.archetypeLines) ? compose.archetypeLines : {}
  const cf = isObj(compose.conflicts) ? compose.conflicts : {}
  const counselConflicts: ComposeMaterials["rules"]["counselConflicts"] = []
  for (const c of arr(cf.counsel)) {
    const stem = s(c.stem), archetype = s(c.archetype)
    if (typeof c.year === "number" && stem && archetype) counselConflicts.push({ year: c.year, stem, archetype })
  }
  const b = isObj(compose.budget) ? compose.budget : {}
  const min = num(b.min), max = num(b.max), hardMax = num(b.hardMax)
  if (min === null || max === null || hardMax === null || !(min < max && max <= hardMax)) return null

  return {
    dayPillars, dayMasters,
    elements: { numerals: strMap(elements.numerals), thresholds, tenGodLineTemplate, groupBy, gloss, items },
    years,
    rules: {
      titles, fixed,
      being: strMap(al.being), beingShort: strMap(al.beingShort), counsel: strMap(al.counsel),
      counselConflicts, budget: { min, max, hardMax },
    },
  }
}

let cached: ComposeMaterials | null | undefined
/** 번들에 들어 있는 재료(한 번만 정리) */
export function loadComposeMaterials(): ComposeMaterials | null {
  if (cached === undefined) {
    cached = normalizeMaterials({ compose: composeJson, dayPillar: dayPillarJson, dayMaster: dayMasterJson, elements: elementsJson, thisYear: thisYearJson })
  }
  return cached
}

// ─────────────────────────────────────────── 문장 나누기·잇기·토큰

/** 작가 약속: ". "(마침표 + 공백 한 칸)에서 자르고 앞쪽에 "."를 다시 붙인다 */
export function splitSentences(text: string): string[] {
  const parts = text.split(". ")
  return parts.map((p, i) => (i < parts.length - 1 ? `${p}.` : p))
}

/** 문장 수가 약속(min~max)과 다르면 통째로 하나 — 경고 기록 */
function sentencesOf(text: string, min: number, max: number, name: string, warn: (w: ComposeWarning) => void): string[] {
  const out = splitSentences(text)
  if (out.length < min || out.length > max) {
    warn({ code: "split", material: name, sentences: out.length })
    return [text]
  }
  return out
}

const TERMINAL = /[.?!…]["'”’」』)]*$/
/** 조각 끝에 마침표가 없으면 붙인다 */
const withPeriod = (t: string) => (TERMINAL.test(t) ? t : `${t}.`)
const TOKEN_RE = /\{[^{}]*\}/

function fill(text: string, tokens: Record<string, string | null | undefined>): string {
  return text.replace(/\{([A-Za-z]+)\}/g, (m, k: string) => {
    const v = tokens[k]
    return typeof v === "string" && v ? v : m
  })
}

// ─────────────────────────────────────────── 결과

export type ComposeWarning =
  | { code: "split"; material: string; sentences: number }
  | { code: "overBudget"; archetype: string | null; dayPillar: string; length: number }
  | { code: "overHardMax"; archetype: string | null; dayPillar: string; length: number }
  | { code: "sameEnding"; chapter: number; ending: string }
  | { code: "duplicate"; chapter: number; sentence: string }
  | { code: "tokenLeft"; part: string }
  | { code: "dayBranchHead"; branch: string }

export interface ComposedPart {
  id: string
  text: string
}

export interface ComposeResult {
  chapters: UnmyeongFreeChapter[]
  /** 다섯 장 text 길이 합(JS string length, 제목 제외) */
  length: number
  /** 장마다 실제로 쓴 조각(근거 대조·테스트용, 응답에 싣지 않는다) */
  parts: { no: number; parts: ComposedPart[] }[]
  /** 4장 오행 고르기 결과 */
  elementPick: { element: Element; kind: "excess" | "lack" } | null
  /** 5장이 올해 줄로 조립됐는가(false면 원형 대체 본문) */
  yearLine: boolean
  /** 길이 맞추기·충돌 처리로 한 일(순서대로) */
  steps: string[]
  warnings: ComposeWarning[]
}

export interface ComposeOptions {
  /** free-copy.json 원본(테스트용). 생략하면 번들 원본 */
  freeCopy?: unknown
  /** 재료(테스트용). 생략하면 번들 재료 */
  materials?: ComposeMaterials | null
}

// ─────────────────────────────────────────── 충돌 원칙 2 — 1장 원형 문장을 짧은 꼴로(compose.json conflicts.being)

/** 원형 판정 묶음(원칙 2의 다섯 원형) — compose.json conflicts.being 다섯째 줄 */
const ARCHETYPE_GROUP: Readonly<Record<string, string>> = {
  sage: "인성", "black-fox": "식상", "white-deer": "재성", bonghwang: "관성", baekho: "관성",
}

/** conflicts.being 표: 이 원형·이 오행 고르기면 1장을 beingShort로 */
export function beingShortRequired(
  archetypeId: string,
  pick: ComposeResult["elementPick"],
  groupOfPick: string | null,
): boolean {
  if (!pick) return false
  if (archetypeId === "eternal-forest") return pick.kind === "excess"
  if (pick.kind !== "lack") return false
  if (archetypeId === "hyeonmu") return pick.element === "water"
  if (archetypeId === "golden-sun") return pick.element === "fire"
  const g = ARCHETYPE_GROUP[archetypeId]
  return !!g && g === groupOfPick
}

// ─────────────────────────────────────────── 오행 고르기(compose.json elementPick)

export function pickElement(
  counts: Record<Element, number>,
  hourUnknown: boolean,
  th: ComposeMaterials["elements"]["thresholds"],
): ComposeResult["elementPick"] {
  const limit = hourUnknown ? th.excessHourUnknown : th.excessFull
  let best: Element | null = null
  for (const e of EL_ORDER) if ((counts[e] ?? 0) >= limit && (best === null || counts[e] > counts[best])) best = e
  if (best) return { element: best, kind: "excess" }
  const lack = EL_ORDER.find((e) => (counts[e] ?? 0) === th.lack)
  return lack ? { element: lack, kind: "lack" } : null
}

/** "子午沖" → 충, "午未合" → 육합. 앞 두 글자가 지지 쌍 */
function relationOf(name: string): { type: "clash" | "sixCombine"; chars: [string, string] } | null {
  const ch = [...name]
  if (ch.length !== 3) return null
  const type = ch[2] === "沖" || ch[2] === "冲" ? "clash" : ch[2] === "合" ? "sixCombine" : null
  return type ? { type, chars: [ch[0], ch[1]] } : null
}

// ─────────────────────────────────────────── 조립

interface Part extends ComposedPart {
  /** 줄이기·보충·충돌 처리에서 뺄 수 있는 조각 */
  removable?: boolean
}
interface Chap { no: number; key: FreeChapterKey; title: string; parts: Part[] }

const render = (c: Chap) => c.parts.map((p) => p.text).join(" ")
const totalOf = (cs: Chap[]) => cs.reduce((n, c) => n + render(c).length, 0)

/** 문장 끝 어미(마지막 한글 두 음절) — 원칙 6 점검용 */
export function endingOf(sentence: string): string {
  const syl = sentence.replace(/[^가-힣]/g, "")
  return syl.slice(-2)
}

/** 한 장 안 문장 목록에서 같은 어미가 세 번 잇달아 나오는 첫 위치(없으면 -1) */
export function sameEndingRun(sentences: string[]): number {
  for (let i = 0; i + 2 < sentences.length; i++) {
    const e = endingOf(sentences[i])
    if (e && e === endingOf(sentences[i + 1]) && e === endingOf(sentences[i + 2])) return i
  }
  return -1
}

/**
 * 엔진 사실 → 5장. 원형이 없거나(2장을 만들 수 없음) free-copy.json에서 2장을 고를 수 없으면 null(pending.chapters).
 * 재료가 깨져 필수 조각을 만들 수 없으면 원형 고정 문안(selectFreeChapters)으로 내린다 — 그 사실은 warnings·steps에 남는다.
 */
export function composeFreeChapters(facts: ComposeFacts, opts: ComposeOptions = {}): ComposeResult | null {
  const rawCopy = opts.freeCopy !== undefined ? opts.freeCopy : loadFreeCopy()
  // 2장·5장 대체 본문은 기존 고르기(형식 검사·{bridge} 처리 포함)를 그대로 쓴다
  const fixedCopy = selectFreeChapters(rawCopy, facts.archetype)
  if (!fixedCopy) return null
  const warnings: ComposeWarning[] = []
  const warn = (w: ComposeWarning) => warnings.push(w)
  const fallbackToFixed = (why: string): ComposeResult => {
    const chapters = selectFreeChapters(rawCopy, facts.archetype, { hourUnknown: facts.hourUnknown }) ?? fixedCopy
    return {
      chapters, length: chapters.reduce((n, c) => n + c.text.length, 0),
      parts: chapters.map((c) => ({ no: c.no, parts: [{ id: "fixed", text: c.text }] })),
      elementPick: null, yearLine: false, steps: [`fallback:${why}`], warnings,
    }
  }

  const m = opts.materials !== undefined ? opts.materials : loadComposeMaterials()
  if (!m) return fallbackToFixed("materials")
  const pillarKey = facts.dayStem + facts.dayBranch
  const dp = m.dayPillars.get(pillarKey)
  const dm = m.dayMasters.get(facts.dayStem)
  if (!dp || !dm) return fallbackToFixed("dayPillar")
  const archId = facts.archetype?.id ?? null
  const R = m.rules
  const letters = facts.hourUnknown ? "여섯 글자" : "여덟 글자"
  const hourNote = facts.hourUnknown ? freeCopyHourNoteText(rawCopy) : null
  if (facts.hourUnknown && !hourNote) return fallbackToFixed("hourNote")

  // 재료 문장 나누기(작가 약속 개수)
  const detail = sentencesOf(dp.detail, 2, 2, `day-pillar.${pillarKey}.detail`, warn)
  const body = sentencesOf(dm.body, 3, 3, `day-master.${facts.dayStem}.body`, warn)
  const blind = sentencesOf(dm.blindSpot, 1, 2, `day-master.${facts.dayStem}.blindSpot`, warn)
  const pillarS1 = detail[0]
  const pillarS2 = detail.length === 2 ? detail[1] : null

  // 4장 오행
  const pick = pickElement(facts.counts, facts.hourUnknown, m.elements.thresholds)
  const groupOfPick = pick ? m.elements.groupBy[facts.dayMasterElement][pick.element] : null
  const elItem = pick ? m.elements.items.get(pick.element) : undefined
  const tokens = {
    letters,
    n: pick ? m.elements.numerals[String(facts.counts[pick.element])] : null,
    label: dp.label,
    year: String(facts.year),
    dayStem: dm.label,
    elementName: elItem?.name,
    group: groupOfPick,
    gloss: groupOfPick ? m.elements.gloss[groupOfPick] : null,
    // 지금 compose.json 원형 문장에는 {bridge}가 없다. 작가가 넣으면 달의 여신 다리 기운으로 채우고, 값이 없으면 그 조각은 버린다
    bridge: bridgeOf(facts.archetype),
  }

  let failed: string | null = null
  /** 토큰을 채운 조각. 토큰이 남으면 버린다(필수 조각이면 조립 실패) */
  const part = (id: string, text: string | null | undefined, o: { required?: boolean; removable?: boolean; verbatim?: boolean } = {}): Part | null => {
    if (!text) { if (o.required) failed ??= id; return null }
    // verbatim: free-copy.json 원형 본문(2장·5장 대체)은 고르기·{bridge} 처리가 끝난 글 그대로 둔다
    const t = o.verbatim ? text.trim() : withPeriod(fill(text, tokens).trim())
    if (TOKEN_RE.test(t)) { warn({ code: "tokenLeft", part: id }); if (o.required) failed ??= id; return null }
    return { id, text: t, ...(o.removable ? { removable: true } : {}) }
  }
  const keep = (ps: (Part | null)[]): Part[] => ps.filter((p): p is Part => p !== null)
  const steps: string[] = []

  // ── 1장 너는 누구인가
  const beingShort = archId ? beingShortRequired(archId, pick, groupOfPick) : false
  if (beingShort) steps.push("conflict2:beingShort")
  const ch1 = keep([
    part("opening", R.fixed.opening, { removable: true }),
    part("intro", R.fixed.dayPillarIntro, { required: true }),
    part("oneLiner", dp.oneLiner, { required: true }),
    archId ? part(beingShort ? "archetypeShort" : "archetype", beingShort ? R.beingShort[archId] : R.being[archId]) : null,
    hourNote ? part("hourNote", hourNote, { required: true }) : null,
  ])

  // ── 2장 너의 신성과 영물(원형 본문 그대로)
  const ch2 = keep([part("symbol", fixedCopy[1].text, { required: true, verbatim: true })])

  // ── 3장 하늘이 네게 준 것
  const ch3 = keep([part("pillarS1", pillarS1, { required: true }), part("strength", dm.strength, { required: true })])

  // ── 4장 네가 넘어야 할 것
  let ch4: Part[]
  if (pick && elItem) {
    const et = sentencesOf(pick.kind === "excess" ? elItem.excess : elItem.lack, 3, 3, `elements.${pick.element}.${pick.kind}.text`, warn)
    const hidden = pick.kind === "lack" && (facts.weighted[pick.element] ?? 0) > 0
    ch4 = keep([
      part("elementS1", et[0], { required: true }),
      hidden ? part("hiddenNote", R.fixed.hiddenNote, { required: true }) : null,
      et.length === 3 ? part("elementS2", et[1], { removable: true }) : null,
      part("blindSpot", dm.blindSpot, { required: true }),
    ])
  } else {
    ch4 = keep([pillarS2 ? part("pillarS2", pillarS2) : null, part("blindSpot", dm.blindSpot, { required: true })])
  }

  // ── 5장 지금 네게 필요한 말
  let ch5: Part[]
  const yearEntry = facts.yearGanzhi ? m.years.find((y) => y.year === facts.year && y.ganzhi === facts.yearGanzhi) : undefined
  const yearLine = yearEntry?.byStem.get(facts.dayStem)
  if (yearEntry && yearLine) {
    const ys = sentencesOf(yearLine, 2, 2, `this-year.${facts.year}.${facts.dayStem}.line`, warn)
    // 일지 덧줄: 그 일지 줄이 있고, 규칙 엔진 interactions에 같은 관계(일지 ↔ 세운)가 실제로 있을 때만
    const db = yearEntry.dayBranch.find((d) => {
      if (d.branch !== facts.dayBranch) return false
      const rel = relationOf(d.interaction)
      if (!rel) return false
      const seunBranch = facts.yearGanzhi ? [...facts.yearGanzhi][1] : ""
      const want = new Set([facts.dayBranch, seunBranch])
      if (!(want.has(rel.chars[0]) && want.has(rel.chars[1]))) return false
      return facts.dayBranchRelations.some((r) => r.type === rel.type && r.chars[0] === facts.dayBranch && r.chars[1] === seunBranch)
    })
    let dbText: string | null = null
    if (db) {
      const head = fill(R.fixed.dayBranchJoinFrom, tokens)
      if (db.line.startsWith(head)) dbText = R.fixed.dayBranchJoinTo + db.line.slice(head.length)
      else { warn({ code: "dayBranchHead", branch: db.branch }); dbText = db.line }
    }
    // 원칙 3: 올해 할 일과 원형 할 일이 반대·되풀이면 원형 문장을 뺀다(conflicts.counsel 표)
    const counselConflict = !!archId && R.counselConflicts.some((c) => c.year === facts.year && c.stem === facts.dayStem && c.archetype === archId)
    if (counselConflict) steps.push("conflict3:counselDropped")
    // 원칙 4: 일지 줄이 있으면 올해 줄의 할 일(S2)을 뺀다
    if (dbText) steps.push("conflict4:yearS2Dropped")
    ch5 = keep([
      part("weatherLead", R.fixed.weatherLead, { required: true }),
      part("yearS1", ys[0], { required: true }),
      !dbText && ys.length === 2 ? part("yearS2", ys[1]) : null,
      dbText ? part("dayBranch", dbText, { required: true }) : null,
      archId && !counselConflict ? part("archetype", R.counsel[archId], { removable: true }) : null,
    ])
  } else {
    // 그해 항목이 없을 때만: 원형 5장 원문 전체({bridge} 처리는 selectFreeChapters가 했다)
    ch5 = keep([part("fallback", fixedCopy[4].text, { required: true, verbatim: true })])
    steps.push("counsel:fallback")
  }

  if (failed) return fallbackToFixed(`part:${failed}`)

  const T = R.titles
  const chaps: Chap[] = [ch1, ch2, ch3, ch4, ch5].map((parts, i) => ({ no: T[i].no, key: T[i].key, title: T[i].title, parts }))
  const C = (no: number) => chaps[no - 1]
  const has = (no: number, id: string) => C(no).parts.some((p) => p.id === id)
  const remove = (no: number, id: string) => { const c = C(no); c.parts = c.parts.filter((p) => p.id !== id) }
  const replace = (no: number, id: string, next: Part) => { const c = C(no); c.parts = c.parts.map((p) => (p.id === id ? next : p)) }
  const insertBefore = (no: number, beforeId: string | null, p: Part) => {
    const c = C(no)
    const i = beforeId ? c.parts.findIndex((x) => x.id === beforeId) : 0
    c.parts.splice(i < 0 ? c.parts.length : i, 0, p)
  }
  const insertAfter = (no: number, afterId: string, p: Part) => {
    const c = C(no)
    const i = c.parts.findIndex((x) => x.id === afterId)
    c.parts.splice(i < 0 ? c.parts.length : i + 1, 0, p)
  }
  const { min, max, hardMax } = R.budget

  // ── 길이 맞추기(compose.json budget)
  if (totalOf(chaps) > max) {
    const trims: { name: string; can: () => boolean; run: () => void }[] = [
      { name: "trim1:opening", can: () => has(1, "opening"), run: () => remove(1, "opening") },
      { name: "trim2:counselArchetype", can: () => has(5, "archetype"), run: () => remove(5, "archetype") },
      {
        name: "trim3:beingShort",
        can: () => !!archId && has(1, "archetype") && !!R.beingShort[archId],
        run: () => { const p = part("archetypeShort", R.beingShort[archId!]); if (p) replace(1, "archetype", p) },
      },
      {
        name: "trim4:blindSpotShort",
        can: () => blind.length === 2 && has(4, "blindSpot"),
        run: () => { const p = part("blindSpotShort", blind[0]); if (p) replace(4, "blindSpot", p) },
      },
    ]
    for (const t of trims) {
      if (totalOf(chaps) <= max) break
      if (!t.can()) continue
      t.run()
      steps.push(t.name)
    }
    if (totalOf(chaps) > max) warn({ code: "overBudget", archetype: archId, dayPillar: pillarKey, length: totalOf(chaps) })
    if (totalOf(chaps) > hardMax && has(4, "elementS2")) { remove(4, "elementS2"); steps.push("trim5:elementS2") }
    if (totalOf(chaps) > hardMax) warn({ code: "overHardMax", archetype: archId, dayPillar: pillarKey, length: totalOf(chaps) })
  } else if (totalOf(chaps) < min) {
    const usedPillarS2 = () => chaps.some((c) => c.parts.some((p) => p.id === "pillarS2"))
    const fills: { name: string; can: () => boolean; run: () => void; undo: () => void }[] = [
      {
        name: "fill1:bodyS1",
        can: () => body.length === 3,
        run: () => { const p = part("bodyS1", body[0], { removable: true }); if (p) insertBefore(3, null, p) },
        undo: () => remove(3, "bodyS1"),
      },
      {
        name: "fill2:tenGodLine",
        can: () => !!pick && !!elItem && !!tokens.gloss,
        run: () => {
          const p = part("tenGodLine", m.elements.tenGodLineTemplate, { removable: true })
          if (p) insertAfter(4, has(4, "elementS2") ? "elementS2" : has(4, "hiddenNote") ? "hiddenNote" : "elementS1", p)
        },
        undo: () => remove(4, "tenGodLine"),
      },
      {
        name: "fill3:pillarS2",
        can: () => !!pillarS2 && !usedPillarS2(),
        run: () => { const p = part("pillarS2", pillarS2, { removable: true }); if (p) insertBefore(4, has(4, "blindSpot") ? "blindSpot" : "blindSpotShort", p) },
        undo: () => remove(4, "pillarS2"),
      },
    ]
    for (const f of fills) {
      if (totalOf(chaps) >= min) break
      if (!f.can()) continue
      f.run()
      if (totalOf(chaps) > max) { f.undo(); steps.push(`${f.name}:reverted`); continue }
      steps.push(f.name)
    }
  }

  // ── 원칙 5: 같은 문장을 두 장에 쓰지 않는다(구조상 생기지 않지만, 재료가 바뀌어도 지키게 뺄 수 있는 조각은 뺀다)
  const seen = new Set<string>()
  for (const c of chaps) {
    for (const p of [...c.parts]) {
      const ss = splitSentences(p.text)
      const dup = ss.find((x) => seen.has(x))
      if (dup) {
        if (p.removable || p.id === "archetype" || p.id === "archetypeShort" || p.id === "pillarS2" || p.id === "yearS2") {
          c.parts = c.parts.filter((x) => x !== p)
          steps.push(`conflict5:${c.no}:${p.id}`)
          continue
        }
        warn({ code: "duplicate", chapter: c.no, sentence: dup })
      }
      for (const x of ss) seen.add(x)
    }
  }

  // ── 원칙 6: 한 장 안에서 같은 어미 세 번 잇달아 금지 — 그 줄에 걸린 뺄 수 있는 조각을 뒤에서부터 뺀다
  for (const c of chaps) {
    for (let guard = 0; guard < 4; guard++) {
      const sents = c.parts.flatMap((p) => splitSentences(p.text).map((t) => ({ t, p })))
      const at = sameEndingRun(sents.map((x) => x.t))
      if (at < 0) break
      const inRun = sents.slice(at, at + 3).map((x) => x.p)
      const victim = [...inRun].reverse().find((p) => p.removable)
      if (!victim) { warn({ code: "sameEnding", chapter: c.no, ending: endingOf(sents[at].t) }); break }
      c.parts = c.parts.filter((p) => p !== victim)
      steps.push(`conflict6:${c.no}:${victim.id}`)
    }
  }

  const chapters: UnmyeongFreeChapter[] = chaps.map((c) => ({ no: c.no, key: c.key, title: c.title, text: render(c) }))
  if (chapters.some((c) => !c.text || TOKEN_RE.test(c.text))) return fallbackToFixed("empty")
  return {
    chapters,
    length: chapters.reduce((n, c) => n + c.text.length, 0),
    parts: chaps.map((c) => ({ no: c.no, parts: c.parts.map(({ id, text }) => ({ id, text })) })),
    elementPick: pick,
    yearLine: !!(yearEntry && yearLine),
    steps,
    warnings,
  }
}

/** 로그로 남길 경고(재료 결함·650자 초과). 600~650자(overBudget)는 compose.json이 허용한 범위라 로그로 남기지 않는다 — 분포는 테스트가 잰다 */
const LOGGED: ReadonlySet<ComposeWarning["code"]> = new Set(["split", "overHardMax", "sameEnding", "duplicate", "tokenLeft", "dayBranchHead"])

/** 경고 로그. 입력값(생년월일 등)은 싣지 않는다 — 원형 id·일주 간지·글자 수·재료 이름만 */
export function logComposeWarnings(ws: readonly ComposeWarning[]): void {
  for (const w of ws) if (LOGGED.has(w.code)) console.warn(`[unmyeong-compose] ${JSON.stringify(w)}`)
}
