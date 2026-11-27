// 품질검증 독립 오라클 — 규칙 엔진 rules@0.2.0 (P3-05)
// 근거: docs/knowledge/rules-spec.md, docs/knowledge/schools.md 만 보고 작성했다.
// src/engine/rules/** 구현과 엔진 개발자 테스트를 참고하지 않았다(독립성).
// 명세가 비어 있는 곳은 "QA 해석"이라고 주석을 달았다. 불일치가 나오면 원인을 따로 판정한다.
import type { Branch, Element, Pillar, Stem } from "@/engine"

// ── §0 번호 규약
export const STEMS: Stem[] = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"]
export const BRANCHES: Branch[] = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]
export const ELEMENTS: Element[] = ["wood", "fire", "earth", "metal", "water"]
export const si = (s: string) => STEMS.indexOf(s as Stem)
export const bi = (b: string) => BRANCHES.indexOf(b as Branch)

export type OPillarKey = "year" | "month" | "day" | "hour" | "daeun" | "seun"
export interface OPos { pillar: OPillarKey; part: "stem" | "branch"; luckIndex?: number }
export interface OOpts {
  hiddenStemTable: "kr-monthly-30" | "cn-lunarjs" | "main-only"
  branchYinYang: "byMainQi" | "byOrder"
  twelveStagesYin: "reverse" | "sameAsYang"
  earthStages: "withFire" | "withWater"
  strengthModel: "weighted-v1"
  gongmangBasis: "day" | "year" | "both"
  halfCombine: "withKingOnly" | "allPairs"
  partialPunishment: boolean
  wuWeiCombine: "fire" | "earth" | "none"
  partialDirectional: boolean
}
// schools.md §6·7·10·11, rules-spec §2·5·7 의 "기본 제안"
export const SPEC_DEFAULTS: OOpts = {
  hiddenStemTable: "kr-monthly-30",
  branchYinYang: "byMainQi",
  twelveStagesYin: "reverse",
  earthStages: "withFire",
  strengthModel: "weighted-v1",
  gongmangBasis: "day",
  halfCombine: "withKingOnly",
  partialPunishment: true,
  wuWeiCombine: "none",
  partialDirectional: false, // rules-spec §7 "기본: 세 글자만"
}

// ── §1 천간 오행·음양 (공식)
export const stemEl = (s: string): Element => ELEMENTS[Math.floor(si(s) / 2)]
export const stemYY = (s: string): "yang" | "yin" => (si(s) % 2 === 0 ? "yang" : "yin")

// ── §2 지지 오행 (표)
const BRANCH_EL: Record<Branch, Element> = {
  子: "water", 丑: "earth", 寅: "wood", 卯: "wood", 辰: "earth", 巳: "fire",
  午: "fire", 未: "earth", 申: "metal", 酉: "metal", 戌: "earth", 亥: "water",
}
export const branchEl = (b: string): Element => BRANCH_EL[b as Branch]
// §3-3 정기
export const MAIN_QI: Record<Branch, Stem> = {
  子: "癸", 丑: "己", 寅: "甲", 卯: "乙", 辰: "戊", 巳: "丙", 午: "丁", 未: "己", 申: "庚", 酉: "辛", 戌: "戊", 亥: "壬",
}
export function branchYY(b: string, mode: OOpts["branchYinYang"]): "yang" | "yin" {
  if (mode === "byOrder") return bi(b) % 2 === 0 ? "yang" : "yin"
  return stemYY(MAIN_QI[b as Branch])
}

// ── §3 지장간 표
type Role = "yeogi" | "junggi" | "jeonggi"
export interface OHidden { stem: Stem; role: Role; days: number | null; weight: number }
// §3-1 kr-monthly-30: [여기, 중기|null, 정기] (stem, days)
const KR30: Record<Branch, [Stem, number][]> = {
  子: [["壬", 10], ["癸", 20]],
  丑: [["癸", 9], ["辛", 3], ["己", 18]],
  寅: [["戊", 7], ["丙", 7], ["甲", 16]],
  卯: [["甲", 10], ["乙", 20]],
  辰: [["乙", 9], ["癸", 3], ["戊", 18]],
  巳: [["戊", 7], ["庚", 7], ["丙", 16]],
  午: [["丙", 10], ["己", 9], ["丁", 11]],
  未: [["丁", 9], ["乙", 3], ["己", 18]],
  申: [["戊", 7], ["壬", 7], ["庚", 16]],
  酉: [["庚", 10], ["辛", 20]],
  戌: [["辛", 9], ["丁", 3], ["戊", 18]],
  亥: [["戊", 7], ["甲", 7], ["壬", 16]],
}
function kr30Roles(b: Branch): Role[] {
  const n = KR30[b].length
  return n === 3 ? ["yeogi", "junggi", "jeonggi"] : ["yeogi", "jeonggi"]
}
// §3-2 cn-lunarjs (정기 먼저 표기)
const LUNARJS: Record<Branch, Stem[]> = {
  子: ["癸"], 丑: ["己", "癸", "辛"], 寅: ["甲", "丙", "戊"], 卯: ["乙"], 辰: ["戊", "乙", "癸"], 巳: ["丙", "庚", "戊"],
  午: ["丁", "己"], 未: ["己", "丁", "乙"], 申: ["庚", "壬", "戊"], 酉: ["辛"], 戌: ["戊", "辛", "丁"], 亥: ["壬", "甲"],
}
const ROLE_ORDER: Role[] = ["yeogi", "junggi", "jeonggi"]
/**
 * QA 해석(명세 공백): cn-lunarjs의 여기/중기 역할은 명세에 없다.
 * 같은 지지 안 같은 천간이 kr-monthly-30에서 맡은 역할을 빌린다. 2글자(午·亥)의 둘째 글자는 kr 표의 중기.
 * 가중: 3글자 정기0.6/중기0.3/여기0.1, 2글자 0.7/0.3, 1글자 1.0 (rules-spec §3-2). main-only는 1.0.
 */
export function hiddenOf(b: string, table: OOpts["hiddenStemTable"]): OHidden[] {
  const br = b as Branch
  if (table === "main-only") return [{ stem: MAIN_QI[br], role: "jeonggi", days: null, weight: 1 }]
  if (table === "kr-monthly-30") {
    const roles = kr30Roles(br)
    return KR30[br].map(([stem, days], i) => ({ stem, role: roles[i], days, weight: days / 30 }))
  }
  const list = LUNARJS[br]
  const krRoleOf = (stem: Stem): Role => {
    const idx = KR30[br].findIndex(([s]) => s === stem)
    return kr30Roles(br)[idx]
  }
  const out: OHidden[] = list.map((stem, i) => {
    const role: Role = i === 0 ? "jeonggi" : krRoleOf(stem)
    let weight = 1
    if (list.length === 3) weight = role === "jeonggi" ? 0.6 : role === "junggi" ? 0.3 : 0.1
    else if (list.length === 2) weight = role === "jeonggi" ? 0.7 : 0.3
    return { stem, role, days: null, weight }
  })
  out.sort((a, c) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(c.role))
  return out
}

// ── §4 십성
const TG_SAME = ["비견", "식신", "편재", "편관", "편인"]
const TG_DIFF = ["겁재", "상관", "정재", "정관", "정인"]
export function tenGod(dayStem: string, targetEl: Element, targetYY: "yang" | "yin"): string {
  const d = ELEMENTS.indexOf(stemEl(dayStem))
  const t = ELEMENTS.indexOf(targetEl)
  const rel = (t - d + 5) % 5
  return stemYY(dayStem) === targetYY ? TG_SAME[rel] : TG_DIFF[rel]
}

// ── §5 12운성
export const STAGES = ["장생", "목욕", "관대", "건록", "제왕", "쇠", "병", "사", "묘", "절", "태", "양"]
const START: Record<Stem, Branch> = {
  甲: "亥", 丙: "寅", 戊: "寅", 庚: "巳", 壬: "申", 乙: "午", 丁: "酉", 己: "酉", 辛: "子", 癸: "卯",
}
export function stageOf(stem: string, branch: string, yinMode: OOpts["twelveStagesYin"], earth: OOpts["earthStages"]): string {
  let s = stem as Stem
  if (yinMode === "sameAsYang" && si(s) % 2 === 1) s = STEMS[si(s) - 1] // 乙→甲 …
  if (earth === "withWater") { if (s === "戊") s = "壬"; else if (s === "己") s = "癸" }
  const start = bi(START[s])
  const b = bi(branch)
  const idx = si(s) % 2 === 0 ? (b - start + 12) % 12 : (start - b + 12) % 12
  return STAGES[idx]
}
/** rules-spec §5-1 표 120칸을 글자 그대로 옮긴 것(공식 자체 검산용) */
export const SPEC_STAGE_TABLE: Record<string, string[]> = {
  甲: ["목욕", "관대", "건록", "제왕", "쇠", "병", "사", "묘", "절", "태", "양", "장생"],
  丙: ["태", "양", "장생", "목욕", "관대", "건록", "제왕", "쇠", "병", "사", "묘", "절"],
  戊: ["태", "양", "장생", "목욕", "관대", "건록", "제왕", "쇠", "병", "사", "묘", "절"],
  庚: ["사", "묘", "절", "태", "양", "장생", "목욕", "관대", "건록", "제왕", "쇠", "병"],
  壬: ["제왕", "쇠", "병", "사", "묘", "절", "태", "양", "장생", "목욕", "관대", "건록"],
  乙: ["병", "쇠", "제왕", "건록", "관대", "목욕", "장생", "양", "태", "절", "묘", "사"],
  丁: ["절", "묘", "사", "병", "쇠", "제왕", "건록", "관대", "목욕", "장생", "양", "태"],
  己: ["절", "묘", "사", "병", "쇠", "제왕", "건록", "관대", "목욕", "장생", "양", "태"],
  辛: ["장생", "양", "태", "절", "묘", "사", "병", "쇠", "제왕", "건록", "관대", "목욕"],
  癸: ["건록", "관대", "목욕", "장생", "양", "태", "절", "묘", "사", "병", "쇠", "제왕"],
}
export const LU_TABLE: Record<Stem, Branch> = { 甲: "寅", 乙: "卯", 丙: "巳", 丁: "午", 戊: "巳", 己: "午", 庚: "申", 辛: "酉", 壬: "亥", 癸: "子" }

// ── §6 천간 관계
const STEM_COMBINE_EL: Record<string, Element> = { 甲己: "earth", 乙庚: "metal", 丙辛: "water", 丁壬: "wood", 戊癸: "fire" }
const STEM_CLASH = new Set(["甲庚", "乙辛", "丙壬", "丁癸"])
const sortedStems = (a: string, b: string) => (si(a) <= si(b) ? a + b : b + a)

// ── §7 지지 관계
const sortedBr = (a: string, b: string) => (bi(a) <= bi(b) ? a + b : b + a)
const SIX_COMBINE: Record<string, Element | "wuwei"> = { 子丑: "earth", 寅亥: "wood", 卯戌: "fire", 辰酉: "metal", 巳申: "water", 午未: "wuwei" }
// 삼합 [생지, 왕지, 고지]
const THREE: { chars: Branch[]; el: Element }[] = [
  { chars: ["申", "子", "辰"], el: "water" }, { chars: ["亥", "卯", "未"], el: "wood" },
  { chars: ["寅", "午", "戌"], el: "fire" }, { chars: ["巳", "酉", "丑"], el: "metal" },
]
const DIRECTIONAL: { chars: Branch[]; el: Element }[] = [
  { chars: ["寅", "卯", "辰"], el: "wood" }, { chars: ["巳", "午", "未"], el: "fire" },
  { chars: ["申", "酉", "戌"], el: "metal" }, { chars: ["亥", "子", "丑"], el: "water" },
]
const THREE_PUNISH: Branch[][] = [["寅", "巳", "申"], ["丑", "戌", "未"]]
const SELF_PUNISH = new Set(["辰", "午", "酉", "亥"])
const BREAK = new Set(["子酉", "丑辰", "寅亥", "卯午", "巳申", "未戌"].map((p) => sortedBr(p[0], p[1])))
const HARM = new Set(["子未", "丑午", "寅巳", "卯辰", "申亥", "酉戌"].map((p) => sortedBr(p[0], p[1])))

export interface OInteraction {
  type: string
  members: OPos[]
  chars: string[]
  resultElement?: Element | null
  complete?: boolean
  partial?: boolean
  punishmentKind?: "three" | "mutual" | "self"
  withKing?: boolean
  adjacent: boolean
  scope: "natal" | "luck"
  /** D-019: 이 두 글자 기록을 포함하는 세 글자 관계의 QA 키 `${type}@${위치들}` (없으면 undefined) */
  subsumedBy?: string[]
}

export interface OInput {
  natal: { year: Pillar; month: Pillar; day: Pillar; hour: Pillar | null }
  luck: Pillar[]
  seun: Pillar | null
}
interface Slot { key: OPillarKey; luckIndex?: number; pillar: Pillar; order: number }
const NATAL_ORDER: OPillarKey[] = ["year", "month", "day", "hour"]

export function slotsOf(inp: OInput): Slot[] {
  const s: Slot[] = []
  NATAL_ORDER.forEach((k, i) => {
    const p = inp.natal[k as "year"]
    if (p) s.push({ key: k, pillar: p, order: i })
  })
  inp.luck.forEach((p, i) => s.push({ key: "daeun", luckIndex: i, pillar: p, order: 10 + i }))
  if (inp.seun) s.push({ key: "seun", pillar: inp.seun, order: 1000 })
  return s
}
const posOf = (sl: Slot, part: "stem" | "branch"): OPos =>
  sl.key === "daeun" ? { pillar: "daeun", part, luckIndex: sl.luckIndex } : { pillar: sl.key, part }
const isLuck = (sl: Slot) => sl.key === "daeun" || sl.key === "seun"
/** QA 해석: 대운끼리는 동시에 작용하지 않으므로 대운 2개 이상이 낀 조합은 만들지 않는다 */
const validCombo = (sls: Slot[]) => sls.filter((x) => x.key === "daeun").length <= 1
function adjacentOf(sls: Slot[]): boolean {
  if (sls.some(isLuck)) return false
  const idx = sls.map((x) => x.order).sort((a, b) => a - b)
  for (let i = 1; i < idx.length; i++) if (idx[i] !== idx[i - 1] + 1) return false
  return true
}

function pairs<T>(arr: T[]): [T, T][] {
  const out: [T, T][] = []
  for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) out.push([arr[i], arr[j]])
  return out
}
function triples<T>(arr: T[]): [T, T, T][] {
  const out: [T, T, T][] = []
  for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) for (let k = j + 1; k < arr.length; k++) out.push([arr[i], arr[j], arr[k]])
  return out
}

/**
 * 관계 오라클. 명세 문자 그대로 모든 쌍/세 글자 조합을 기록하고(삭제 없음),
 * D-019(총괄실장 확정)에 따라 두 글자 기록에 포함하는 세 글자 관계 키를 subsumedBy로 단다(원국·운 대칭).
 */
export function interactionsOf(inp: OInput, o: OOpts): OInteraction[] {
  const sl = slotsOf(inp)
  const out: OInteraction[] = []
  const base = (type: string, sls: Slot[], part: "stem" | "branch"): OInteraction => ({
    type,
    members: sls.map((x) => posOf(x, part)),
    chars: sls.map((x) => (part === "stem" ? x.pillar.stem : x.pillar.branch)),
    adjacent: adjacentOf(sls),
    scope: sls.some(isLuck) ? "luck" : "natal",
  })
  // 천간
  for (const [a, b] of pairs(sl)) {
    if (!validCombo([a, b])) continue
    const k = sortedStems(a.pillar.stem, b.pillar.stem)
    if (STEM_COMBINE_EL[k]) out.push({ ...base("stemCombine", [a, b], "stem"), resultElement: STEM_COMBINE_EL[k] })
    if (STEM_CLASH.has(k)) out.push(base("stemClash", [a, b], "stem"))
  }
  // 지지 쌍
  for (const [a, b] of pairs(sl)) {
    if (!validCombo([a, b])) continue
    const x = a.pillar.branch, y = b.pillar.branch
    const k = sortedBr(x, y)
    if (SIX_COMBINE[k]) {
      const el = SIX_COMBINE[k]
      const re = el === "wuwei" ? (o.wuWeiCombine === "none" ? null : o.wuWeiCombine) : el
      out.push({ ...base("sixCombine", [a, b], "branch"), resultElement: re })
    }
    for (const g of THREE) {
      const ix = g.chars.indexOf(x as Branch), iy = g.chars.indexOf(y as Branch)
      if (ix < 0 || iy < 0 || ix === iy) continue
      const withKing = ix === 1 || iy === 1
      if (!withKing && o.halfCombine !== "allPairs") continue
      out.push({ ...base("halfCombine", [a, b], "branch"), resultElement: g.el, withKing })
    }
    if (o.partialDirectional) {
      for (const g of DIRECTIONAL) {
        const ix = g.chars.indexOf(x as Branch), iy = g.chars.indexOf(y as Branch)
        if (ix < 0 || iy < 0 || ix === iy) continue
        out.push({ ...base("directionalCombine", [a, b], "branch"), resultElement: g.el, complete: false, partial: true })
      }
    }
    if ((bi(y) - bi(x) + 12) % 12 === 6) out.push(base("clash", [a, b], "branch"))
    if (o.partialPunishment) {
      for (const g of THREE_PUNISH) {
        const ix = g.indexOf(x as Branch), iy = g.indexOf(y as Branch)
        if (ix < 0 || iy < 0 || ix === iy) continue
        out.push({ ...base("punishment", [a, b], "branch"), punishmentKind: "three", complete: false, partial: true })
      }
    }
    if (k === "子卯") out.push({ ...base("punishment", [a, b], "branch"), punishmentKind: "mutual" })
    if (x === y && SELF_PUNISH.has(x)) out.push({ ...base("punishment", [a, b], "branch"), punishmentKind: "self" })
    if (BREAK.has(k)) out.push(base("break", [a, b], "branch"))
    if (HARM.has(k)) out.push(base("harm", [a, b], "branch"))
  }
  // 지지 세 글자
  for (const t of triples(sl)) {
    if (!validCombo(t)) continue
    const cs = t.map((x) => x.pillar.branch)
    const isSet = (g: Branch[]) => new Set(cs).size === 3 && cs.every((c) => g.includes(c))
    for (const g of THREE) if (isSet(g.chars)) out.push({ ...base("threeCombine", t, "branch"), resultElement: g.el, complete: true })
    for (const g of DIRECTIONAL) if (isSet(g.chars)) out.push({ ...base("directionalCombine", t, "branch"), resultElement: g.el, complete: true, ...(o.partialDirectional ? { partial: false } : {}) })
    for (const g of THREE_PUNISH) if (isSet(g)) out.push({ ...base("punishment", t, "branch"), punishmentKind: "three", complete: true, partial: false })
  }
  markSubsumed(out)
  return out
}

/** 세 글자 관계 QA 키: `${type}@${위치들}` — 엔진 interactionId의 위치 부분과 같은 표기(posKey를 +로 이음) */
export const tripleKey = (x: { type: string; members: OPos[] }) => `${x.type}@${x.members.map(posKey).join("+")}`

/**
 * D-019: 반합 ⊂ 삼합, 두 글자 방합 ⊂ 방합, 두 글자 삼형 ⊂ 삼형. 같은 위치 두 개를 모두 포함하고 글자 집합이 같은 계열이면 표시.
 * 남은 한 글자가 원국이든 운이든 똑같이 붙인다. 기록은 지우지 않는다.
 */
function markSubsumed(list: OInteraction[]): void {
  const full = list.filter((x) => x.members.length === 3)
  for (const x of list) {
    if (x.members.length !== 2) continue
    const fam = x.type === "halfCombine" ? "threeCombine"
      : x.type === "directionalCombine" ? "directionalCombine"
      : x.type === "punishment" && x.punishmentKind === "three" ? "punishment" : null
    if (!fam) continue
    const mine = x.members.map(posKey)
    const by = full.filter((t) => t.type === fam && (fam !== "punishment" || t.punishmentKind === "three")
      && mine.every((m) => t.members.some((tm) => posKey(tm) === m)) && x.chars.every((c) => t.chars.includes(c)))
    if (by.length) x.subsumedBy = by.map(tripleKey).sort()
  }
}

// ── §8 공망
export function xunOf(p: Pillar): { head: Pillar; empty: [Branch, Branch] } {
  const x = (bi(p.branch) - si(p.stem) + 12) % 12
  return { head: { stem: "甲", branch: BRANCHES[x] }, empty: [BRANCHES[(x + 10) % 12], BRANCHES[(x + 11) % 12]] }
}
export function gongmangOf(inp: OInput, o: OOpts) {
  const bases: ("day" | "year")[] = o.gongmangBasis === "both" ? ["day", "year"] : [o.gongmangBasis]
  return bases.map((basis) => {
    const bp = inp.natal[basis]
    const { head, empty } = xunOf(bp)
    const hits: OPos[] = []
    for (const sl of slotsOf(inp)) {
      if (sl.key === basis) continue
      if (empty.includes(sl.pillar.branch)) hits.push(posOf(sl, "branch"))
    }
    return { basis, basisPillar: bp, xunHead: head, empty, hits }
  })
}

// ── 십성 목록(순서 포함): 기둥마다 천간 → 지지 → 지장간(원국만), 일간 제외
export interface OTenGod { position: OPos; char: string; tenGod: string; viaHiddenStem?: Role }
export function tenGodsOf(inp: OInput, o: OOpts): OTenGod[] {
  const d = inp.natal.day.stem
  const out: OTenGod[] = []
  for (const sl of slotsOf(inp)) {
    if (sl.key !== "day") out.push({ position: posOf(sl, "stem"), char: sl.pillar.stem, tenGod: tenGod(d, stemEl(sl.pillar.stem), stemYY(sl.pillar.stem)) })
    const b = sl.pillar.branch
    out.push({ position: posOf(sl, "branch"), char: b, tenGod: tenGod(d, branchEl(b), branchYY(b, o.branchYinYang)) })
    if (!isLuck(sl)) {
      for (const h of hiddenOf(b, o.hiddenStemTable)) {
        out.push({ position: posOf(sl, "branch"), char: h.stem, tenGod: tenGod(d, stemEl(h.stem), stemYY(h.stem)), viaHiddenStem: h.role })
      }
    }
  }
  return out
}

// ── §9 오행 분포
const PW = { stem: 1, year: 1, month: 3, day: 1.5, hour: 1 }
const r6 = (x: number) => Math.round(x * 1e6) / 1e6
export function elementsOf(inp: OInput, o: OOpts) {
  const counts: Record<Element, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 }
  const weighted: Record<Element, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 }
  let yang = 0, yin = 0
  for (const k of NATAL_ORDER) {
    const p = inp.natal[k as "year"]
    if (!p) continue
    counts[stemEl(p.stem)]++
    counts[stemEl(MAIN_QI[p.branch])]++
    weighted[stemEl(p.stem)] += PW.stem
    for (const h of hiddenOf(p.branch, o.hiddenStemTable)) weighted[stemEl(h.stem)] += PW[k as "year"] * h.weight
    if (stemYY(p.stem) === "yang") yang++; else yin++
    if (branchYY(p.branch, o.branchYinYang) === "yang") yang++; else yin++
  }
  for (const e of ELEMENTS) weighted[e] = r6(weighted[e])
  return { counts, weighted, yinYang: { yang, yin } }
}

// ── 근거 위치 → 실제 글자
export function charAt(inp: OInput, p: OPos): string | undefined {
  let pl: Pillar | null | undefined
  if (p.pillar === "daeun") pl = p.luckIndex === undefined ? undefined : inp.luck[p.luckIndex]
  else if (p.pillar === "seun") pl = inp.seun
  else pl = inp.natal[p.pillar]
  if (!pl) return undefined
  return p.part === "stem" ? pl.stem : pl.branch
}

export const posKey = (p: { pillar: string; part: string; luckIndex?: number }) => `${p.pillar}${p.luckIndex ?? ""}.${p.part}`
