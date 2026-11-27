// 무료 결과의 할미 문장 선택(서버 전용). 문안 원본: content/free/*.json (콘텐츠 작가 담당, 이 파일은 읽기만 한다)
//   day-master.json · day-pillar.json · elements.json · this-year.json · teaser.json · share-card.json
// 파일이 없거나 형식이 달라 찾지 못하면 "문안 준비 중" 자리표시로 동작하고, 파일이 생기면 자동으로 쓰인다.
//
// 이 코드가 알아듣는 형식(작가 확정 형식이 다르면 이 파일의 정규화 함수만 고친다):
//   - 키 있는 객체:  { "甲": <항목>, "乙": ... }  또는  { "entries" | "items" | "data": 위와 같은 객체·배열 }
//   - 배열:          [ { "key" | "id" | "stem" | "pillar" | "ganzhi" | "element": "甲", ... }, ... ]
//   - 키 후보:       일간 = 한자·한글(갑)·"갑목" / 일주 = "甲子"·"갑자" / 오행 = 목·木·wood / 올해 = 간지·한글·연도
//   - 항목:          문자열, 또는 { nickname|title|name, line|text|body|summary } (text가 배열이면 줄바꿈으로 합침)
//   - elements.json: { dominant|strong|많음: { 목: 항목 ... }, lacking|weak|부족: { ... } } 또는 { 목: 항목 }
//   - teaser.json:   { title, items|bullets|list: [문자열 | {title|text}] }
//   - share-card.json: 일간 키 → { nickname, line } (없으면 day-master의 별명·한 줄을 쓴다)
// 읽는 방법: 서버에서 fs로 읽는다(빌드·배포 시 파일 추적에 잡히도록 process.cwd() 기준 고정 경로).
import fs from "node:fs"
import path from "node:path"
import { PLACEHOLDER_TEXT, type CopyBlock, type ElementCopy, type ElementKo, type FreeCopy } from "./types"

export interface RawContent {
  dayMaster?: unknown
  dayPillar?: unknown
  elements?: unknown
  thisYear?: unknown
  teaser?: unknown
  shareCard?: unknown
}

const FILES: Record<keyof RawContent, string> = {
  dayMaster: "day-master.json",
  dayPillar: "day-pillar.json",
  elements: "elements.json",
  thisYear: "this-year.json",
  teaser: "teaser.json",
  shareCard: "share-card.json",
}

let cached: RawContent | null = null

/** content/free/*.json 읽기. 없거나 깨진 파일은 건너뛴다(개인정보와 무관 — 파일 이름만 기록). 개발 중에는 매번 다시 읽는다 */
export function loadRawContent(dir = path.join(process.cwd(), "content", "free")): RawContent {
  if (cached && process.env.NODE_ENV === "production") return cached
  const out: RawContent = {}
  for (const [k, file] of Object.entries(FILES) as [keyof RawContent, string][]) {
    try {
      out[k] = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as unknown
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code
      if (code !== "ENOENT") console.warn(`[free-content] ${file} 읽기 실패`)
    }
  }
  if (process.env.NODE_ENV === "production") cached = out
  return out
}

// ─── 정규화 ────────────────────────────────────────────────────────────────

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v)
const WRAPPERS = ["entries", "items", "data", "map", "byKey"]
const ID_FIELDS = ["key", "id", "stem", "pillar", "ganzhi", "element", "dm", "name", "hanja"]

function unwrap(raw: unknown): unknown {
  let cur = raw
  for (let i = 0; i < 2; i++) {
    if (!isObj(cur)) break
    const o: Obj = cur
    const w = WRAPPERS.find((k) => k in o && (isObj(o[k]) || Array.isArray(o[k])))
    if (!w) break
    cur = o[w]
  }
  return cur
}

/** 키 후보 중 먼저 맞는 항목. 없으면 undefined */
export function findEntry(raw: unknown, keys: string[]): unknown {
  const c = unwrap(raw)
  if (Array.isArray(c)) {
    return c.find((it) => isObj(it) && ID_FIELDS.some((f) => typeof it[f] === "string" && keys.includes(it[f] as string)))
  }
  if (isObj(c)) {
    for (const k of keys) if (c[k] !== undefined) return c[k]
  }
  return undefined
}

const asText = (v: unknown): string | undefined => {
  if (typeof v === "string") return v.trim() || undefined
  if (Array.isArray(v)) {
    const parts = v.filter((x): x is string => typeof x === "string" && x.trim() !== "")
    return parts.length ? parts.join("\n") : undefined
  }
  return undefined
}
const firstText = (o: Obj, fields: string[]): string | undefined => {
  for (const f of fields) {
    const t = asText(o[f])
    if (t) return t
  }
  return undefined
}
const TITLE_FIELDS = ["nickname", "별명", "title", "name", "heading"]
const TEXT_FIELDS = ["text", "body", "line", "summary", "한줄", "문장", "content"]

const placeholder = (title?: string): CopyBlock => ({ ...(title ? { title } : {}), text: PLACEHOLDER_TEXT, placeholder: true })

/** 항목 → 문장 덩어리. 쓸 글이 없으면 null */
export function toBlock(entry: unknown): CopyBlock | null {
  const s = asText(entry)
  if (s) return { text: s, placeholder: false }
  if (!isObj(entry)) return null
  const text = firstText(entry, TEXT_FIELDS)
  if (!text) return null
  const title = firstText(entry, TITLE_FIELDS)
  return { ...(title && title !== text ? { title } : {}), text, placeholder: false }
}

// ─── 키 후보 ───────────────────────────────────────────────────────────────

const EL_ALIASES: Record<ElementKo, string[]> = {
  목: ["목", "木", "wood"], 화: ["화", "火", "fire"], 토: ["토", "土", "earth"], 금: ["금", "金", "metal"], 수: ["수", "水", "water"],
}

export function dayMasterKeys(hanja: string, ko: string, el: ElementKo): string[] {
  return [hanja, ko, `${ko}${el}`, `${ko}${EL_ALIASES[el][1]}`]
}
export const pillarKeys = (hanja: string, ko: string) => [hanja, ko]
export const yearKeys = (year: number, hanja: string, ko: string) => [hanja, ko, String(year)]

// ─── 선택 ──────────────────────────────────────────────────────────────────

export interface CopyFacts {
  dayMaster: { hanja: string; ko: string; element: ElementKo }
  dayPillar: { hanja: string; ko: string }
  elements: { el: ElementKo; count: number }[]
  thisYear: { year: number; hanja: string; ko: string }
}

/** 가장 많은 오행(동률이면 목화토금수 순서 앞쪽 하나)과 하나도 없는 오행(최대 2개) */
export function pickElementFocus(elements: { el: ElementKo; count: number }[]): { dominant: ElementKo | null; lacking: ElementKo[] } {
  const max = Math.max(0, ...elements.map((e) => e.count))
  const dominant = max > 0 ? (elements.find((e) => e.count === max)?.el ?? null) : null
  const lacking = elements.filter((e) => e.count === 0).map((e) => e.el).slice(0, 2)
  return { dominant, lacking }
}

const SUB_KEYS = {
  dominant: ["dominant", "strong", "most", "많음", "많은"],
  lacking: ["lacking", "weak", "lack", "missing", "부족", "없음"],
}

function elementEntry(raw: unknown, kind: "dominant" | "lacking", el: ElementKo): unknown {
  const c = unwrap(raw)
  if (isObj(c)) {
    for (const sk of SUB_KEYS[kind]) {
      if (c[sk] !== undefined) {
        const e = findEntry(c[sk], EL_ALIASES[el])
        if (e !== undefined) return e
      }
    }
    // 평평한 형식 { 목: { dominant, lacking } } 또는 { 목: 항목 }
    const flat = findEntry(c, EL_ALIASES[el])
    if (isObj(flat)) {
      for (const sk of SUB_KEYS[kind]) if (flat[sk] !== undefined) return flat[sk]
    }
    if (kind === "dominant") return flat
  }
  return undefined
}

function teaserCopy(raw: unknown): FreeCopy["teaser"] {
  const c = unwrap(raw)
  const fallback = { title: "더 깊은 풀이", items: [PLACEHOLDER_TEXT], placeholder: true }
  const whole = isObj(raw) ? raw : undefined
  const list = isObj(c) ? undefined : Array.isArray(c) ? c : undefined
  const listSrc = list ?? (whole ? ["items", "bullets", "list", "lines"].map((k) => whole[k]).find(Array.isArray) : undefined)
  const items = (Array.isArray(listSrc) ? listSrc : [])
    .map((it) => (typeof it === "string" ? it.trim() : isObj(it) ? firstText(it, [...TITLE_FIELDS, ...TEXT_FIELDS]) : undefined))
    .filter((s): s is string => !!s)
  const title = (whole && firstText(whole, TITLE_FIELDS)) || undefined
  if (items.length === 0) {
    const single = toBlock(raw)
    return single ? { title: title ?? "더 깊은 풀이", items: [single.text], placeholder: false } : fallback
  }
  return { title: title ?? "더 깊은 풀이", items, placeholder: false }
}

/** 엔진 사실 → 문장 선택. 순수 함수(파일 읽기 없음) — 테스트 대상 */
export function selectCopy(raw: RawContent, f: CopyFacts): FreeCopy {
  const dmKeys = dayMasterKeys(f.dayMaster.hanja, f.dayMaster.ko, f.dayMaster.element)
  const dmEntry = findEntry(raw.dayMaster, dmKeys)
  const dmBlock = toBlock(dmEntry)
  const dayMaster = dmBlock ?? placeholder()

  const dayPillar = toBlock(findEntry(raw.dayPillar, pillarKeys(f.dayPillar.hanja, f.dayPillar.ko))) ?? placeholder()

  const focus = pickElementFocus(f.elements)
  const elements: ElementCopy[] = []
  const add = (kind: "dominant" | "lacking", el: ElementKo) => {
    const b = toBlock(elementEntry(raw.elements, kind, el)) ?? placeholder()
    elements.push({ ...b, kind, el })
  }
  if (focus.dominant) add("dominant", focus.dominant)
  for (const el of focus.lacking) add("lacking", el)

  let ty = findEntry(raw.thisYear, yearKeys(f.thisYear.year, f.thisYear.hanja, f.thisYear.ko))
  // 올해 문안이 일간별로 나뉜 형식 { 乙巳: { 甲: 항목 } }도 받는다
  if (isObj(ty) && !toBlock(ty)) ty = findEntry(ty, dmKeys)
  const thisYear = toBlock(ty) ?? placeholder()

  // 공유 카드: 일간 단위(개인정보 없음). 별명은 share-card → day-master 순, 한 줄도 같은 순서
  const scEntry = findEntry(raw.shareCard, dmKeys)
  const sc = toBlock(scEntry)
  const dmObj = isObj(dmEntry) ? dmEntry : undefined
  const nickname =
    (isObj(scEntry) ? firstText(scEntry, ["nickname", "별명", "title", "name"]) : undefined) ??
    (dmObj ? firstText(dmObj, ["nickname", "별명", "title", "name"]) : undefined) ??
    `${f.dayMaster.ko}${f.dayMaster.element} 일간`
  const lineSrc = (sc && sc.text !== nickname ? sc.text : undefined) ?? (dmBlock && dmBlock.text !== nickname ? dmBlock.text : undefined)
  const line = lineSrc ? firstSentence(lineSrc) : PLACEHOLDER_TEXT

  return { dayMaster, dayPillar, elements, thisYear, teaser: teaserCopy(raw.teaser), share: { nickname, line, placeholder: !lineSrc } }
}

/** 공유 카드용 한 줄: 첫 문장(마침표·물음표·느낌표까지), 60자 넘으면 자른다 */
export function firstSentence(text: string, max = 60): string {
  const first = text.split(/\n/)[0].trim()
  const m = first.match(/^.+?[.!?。]/)
  const s = (m ? m[0] : first).trim()
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

/** 공유 카드·OG에서 일간 단위로 별명·한 줄을 얻는다(생년월일 불필요) */
export function shareCopyForDayMaster(raw: RawContent, hanja: string, ko: string, element: ElementKo): FreeCopy["share"] {
  const c = selectCopy(raw, {
    dayMaster: { hanja, ko, element },
    dayPillar: { hanja: "", ko: "" },
    elements: [],
    thisYear: { year: 0, hanja: "", ko: "" },
  })
  return c.share
}
