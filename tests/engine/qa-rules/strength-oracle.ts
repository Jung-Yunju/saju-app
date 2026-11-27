// 품질검증 독립 오라클 — P3-06 (rules@0.3.0 → 0.4.0 정정 반영) 신강약·격국·억부·조후·통관·청탁 표지
// 근거: docs/knowledge/strength-structure-spec.md 본문만(2026-11-28 정정본 §1.9·§2.2·§2.3·§3.3·§3.6·§6 포함).
// 엔진 코드(src/engine/rules/strength.ts 등)는 보지 않았다.
// 명세가 비어 있는 곳은 "QA 해석"으로 표시했다.
import type { Element, Pillar, Stem } from "@/engine"
import { ELEMENTS, LU_TABLE, STEMS, BRANCHES, bi, hiddenOf, si, stemEl, stemYY, tenGod, type OOpts, type OPos } from "./oracle"

export type Group = "bigyeop" | "inseong" | "siksang" | "jaeseong" | "gwansal"
export type Verdict = "신강" | "중화" | "신약"
type Table = OOpts["hiddenStemTable"]
export interface Natal { year: Pillar; month: Pillar; day: Pillar; hour: Pillar | null }
const KEYS = ["year", "month", "day", "hour"] as const
const POS_W = { year: 1, month: 3, day: 1.5, hour: 1 }
export const r6 = (x: number) => Math.round(x * 1e6) / 1e6
const eIdx = (e: Element) => ELEMENTS.indexOf(e)

/** §0.2 십성 묶음(오행만) */
export function groupOf(dayStem: string, e: Element): Group {
  const rel = (eIdx(e) - eIdx(stemEl(dayStem)) + 5) % 5
  return (["bigyeop", "siksang", "jaeseong", "gwansal", "inseong"] as Group[])[rel]
}
export const groupEl = (dayStem: string, g: Group): Element =>
  ELEMENTS[(eIdx(stemEl(dayStem)) + { bigyeop: 0, siksang: 1, jaeseong: 2, gwansal: 3, inseong: 4 }[g]) % 5]
const isSupport = (g: Group | "self") => g === "self" || g === "bigyeop" || g === "inseong"

export interface BasisItem { position: OPos; char: Stem; viaHiddenStem?: string; element: Element; group: Group | "self"; side: "support" | "oppose"; positionWeight: number; hiddenWeight: number; rootFactor: number; points: number }

/** §1.2·§1.4·§1.10 근거 항목. rooted=true면 무근 천간(일간 제외) 0.5배 */
export function basisOf(n: Natal, table: Table, rooted: boolean): BasisItem[] {
  const d = n.day.stem
  const hiddenEls = new Set<Element>()
  for (const k of KEYS) { const p = n[k]; if (p) for (const h of hiddenOf(p.branch, table)) hiddenEls.add(stemEl(h.stem)) }
  const out: BasisItem[] = []
  for (const k of KEYS) {
    const p = n[k]
    if (!p) continue
    const isDay = k === "day"
    const g: Group | "self" = isDay ? "self" : groupOf(d, stemEl(p.stem))
    const rf = rooted && !isDay && !hiddenEls.has(stemEl(p.stem)) ? 0.5 : 1
    out.push({ position: { pillar: k, part: "stem" }, char: p.stem, element: stemEl(p.stem), group: g, side: isSupport(g) ? "support" : "oppose", positionWeight: 1, hiddenWeight: 1, rootFactor: rf, points: r6(rf) })
    for (const h of hiddenOf(p.branch, table)) {
      const hg = groupOf(d, stemEl(h.stem))
      out.push({ position: { pillar: k, part: "branch" }, char: h.stem, viaHiddenStem: h.role, element: stemEl(h.stem), group: hg, side: isSupport(hg) ? "support" : "oppose", positionWeight: POS_W[k], hiddenWeight: h.weight, rootFactor: 1, points: r6(POS_W[k] * h.weight) })
    }
  }
  return out
}

export const TH = [0.2, 0.45, 0.55, 0.8]
export function verdictOf(r: number): Verdict { return r >= 0.55 ? "신강" : r >= 0.45 ? "중화" : "신약" }
export function extremeOf(r: number): "strong" | "weak" | null { return r >= 0.8 ? "strong" : r <= 0.2 ? "weak" : null }
/** QA 해석: 경계와의 차이도 6자리로 반올림한 뒤 0.03 미만인지 본다 */
export const nearOf = (r: number) => TH.some((t) => r6(Math.abs(r - t)) < 0.03)

export function modelA(n: Natal, table: Table, rooted = false) {
  const b = basisOf(n, table, rooted)
  // 명세 §0.1: 1.0 = 30u. 부동소수 오차를 피하려고 u 단위(×30)로 합한다
  const S = b.filter((x) => x.side === "support").reduce((s, x) => s + x.positionWeight * x.hiddenWeight * x.rootFactor * 30, 0)
  const T = b.reduce((s, x) => s + x.positionWeight * x.hiddenWeight * x.rootFactor * 30, 0)
  const r = r6(S / T)
  return { basis: b, S: S / 30, T: T / 30, Su: S, Tu: T, ratio: r, verdict: verdictOf(r), extreme: extremeOf(r), nearBoundary: nearOf(r) }
}

export function groupTotals(n: Natal, table: Table): Record<Group, number> {
  const g: Record<Group, number> = { bigyeop: 0, inseong: 0, siksang: 0, jaeseong: 0, gwansal: 0 }
  for (const x of basisOf(n, table, false)) if (x.group !== "self") g[x.group] += x.positionWeight * x.hiddenWeight
  for (const k of Object.keys(g) as Group[]) g[k] = r6(g[k])
  return g
}

/** §1.1·§1.3 모형 B */
export function modelB(n: Natal, deukji: "dayBranchMainQi" | "dayBranchAnyRoot", table: Table) {
  const d = n.day.stem
  const main = (b: string) => hiddenOf(b, "main-only")[0].stem
  const sup = (s: string) => isSupport(groupOf(d, stemEl(s)))
  const deukryeong = sup(main(n.month.branch))
  const deukjiMet = deukji === "dayBranchMainQi" ? sup(main(n.day.branch)) : hiddenOf(n.day.branch, table).some((h) => sup(h.stem))
  const cells: [OPos, string][] = n.hour
    ? [[{ pillar: "year", part: "stem" }, n.year.stem], [{ pillar: "month", part: "stem" }, n.month.stem], [{ pillar: "hour", part: "stem" }, n.hour.stem], [{ pillar: "year", part: "branch" }, main(n.year.branch)], [{ pillar: "hour", part: "branch" }, main(n.hour.branch)]]
    : [[{ pillar: "year", part: "stem" }, n.year.stem], [{ pillar: "month", part: "stem" }, n.month.stem], [{ pillar: "year", part: "branch" }, main(n.year.branch)]]
  const count = cells.filter(([, s]) => sup(s)).length
  const of = cells.length
  const deukse = count >= (n.hour ? 3 : 2)
  const k = [deukryeong, deukjiMet, deukse].filter(Boolean).length
  return { deukryeong, deukji: deukjiMet, deukse, count, of, supportCells: cells.filter(([, s]) => sup(s)).map(([p]) => p), verdict: (k >= 2 ? "신강" : "신약") as Verdict }
}

/** §1.1 왕상휴수사 */
export function seasonState(n: Natal): string {
  const m = eIdx(stemEl(hiddenOf(n.month.branch, "main-only")[0].stem)), d = eIdx(stemEl(n.day.stem))
  if (m === d) return "旺"
  if ((m + 1) % 5 === d) return "相"
  if ((d + 1) % 5 === m) return "休"
  if ((d + 2) % 5 === m) return "囚"
  return "死"
}

/** §1.8 오서둔 12시진 */
export function hourPillars(dayStem: string): Pillar[] {
  const start = [0, 2, 4, 6, 8][si(dayStem) % 5]
  return BRANCHES.map((b, i) => ({ stem: STEMS[(start + i) % 10], branch: b }))
}

// ── §2 격국
const YANGIN: Partial<Record<Stem, string>> = { 甲: "卯", 丙: "午", 戊: "午", 庚: "酉", 壬: "子" }
export const geokName = (tg: string) => (tg === "편관" ? "칠살격" : `${tg}격`)
function touchulPos(n: Natal, stem: Stem, match: "sameStem" | "sameElement"): OPos | null {
  for (const k of ["year", "month", "hour"] as const) {
    const p = n[k]
    if (!p) continue
    if (match === "sameStem" ? p.stem === stem : stemEl(p.stem) === stemEl(stem)) return { pillar: k, part: "stem" }
  }
  return null
}
export interface StructOpts { table: Table; touchul: "transparentFirst" | "mainQiOnly"; match: "sameStem" | "sameElement"; rokgeopAlt: boolean }
/** 주 격 이름(G1·G2/G2'·G4) */
export function primaryStructure(n: Natal, o: StructOpts): { name: string; kind: "rokgeop" | "regular"; pivot?: { stem: Stem; role: string; touchul: OPos | null; tenGod: string } } {
  const d = n.day.stem as Stem
  const hs = hiddenOf(n.month.branch, o.table)
  const main = hs.find((h) => h.role === "jeonggi")!
  const mainTg = tenGod(d, stemEl(main.stem), stemYY(main.stem))
  if (mainTg === "비견" || mainTg === "겁재") {
    if (LU_TABLE[d] === n.month.branch) return { name: "건록격", kind: "rokgeop" }
    if (stemYY(d) === "yang" && YANGIN[d] === n.month.branch) return { name: "양인격", kind: "rokgeop" }
    return { name: "월겁격", kind: "rokgeop" }
  }
  const pick = (h: { stem: Stem; role: string }) => {
    const tg = tenGod(d, stemEl(h.stem), stemYY(h.stem))
    return { name: geokName(tg), kind: "regular" as const, pivot: { stem: h.stem, role: h.role, touchul: touchulPos(n, h.stem, o.match), tenGod: tg } }
  }
  if (o.touchul === "mainQiOnly") return pick(main)
  for (const role of ["jeonggi", "junggi", "yeogi"]) {
    const h = hs.find((x) => x.role === role)
    if (!h || stemEl(h.stem) === stemEl(d)) continue
    if (touchulPos(n, h.stem, o.match)) return pick(h)
  }
  return pick(main)
}
/** G1-alt 대체 후보 이름 집합 */
export function rokgeopAlts(n: Natal, o: StructOpts): string[] {
  const d = n.day.stem
  const out: string[] = []
  for (const h of hiddenOf(n.month.branch, o.table)) {
    if (stemEl(h.stem) === stemEl(d)) continue
    if (touchulPos(n, h.stem, o.match)) out.push(geokName(tenGod(d, stemEl(h.stem), stemYY(h.stem))))
  }
  return [...new Set(out)].sort()
}
/** §2.3 상신 묶음 */
export const SANGSIN: Record<string, Group[]> = {
  정관격: ["jaeseong", "inseong"], 정재격: ["siksang", "gwansal"], 편재격: ["siksang", "gwansal"], 정인격: ["gwansal"],
  편인격: ["gwansal", "jaeseong"], 식신격: ["jaeseong"], 칠살격: ["siksang", "inseong"], 상관격: ["inseong", "jaeseong"], 양인격: ["gwansal"],
}

// ── §3.1 억부
export function eokbu(verdict: Verdict, r: number | null, g: Record<Group, number>): { status: "ok" | "balanced"; groups: Group[]; lean?: "weak" | "strong" } {
  if (verdict === "중화") return { status: "balanced", groups: [], lean: (r ?? 0) < 0.5 ? "weak" : "strong" }
  if (verdict === "신강") return g.inseong > g.bigyeop ? { status: "ok", groups: ["jaeseong", "siksang"] } : { status: "ok", groups: ["gwansal", "siksang", "jaeseong"] }
  // 신약: 빼는 묶음 최대, 동점은 관살 > 재성 > 식상
  const order: Group[] = ["gwansal", "jaeseong", "siksang"]
  let best: Group = "gwansal"
  for (const x of order) if (g[x] > g[best]) best = x
  return best === "jaeseong" ? { status: "ok", groups: ["bigyeop", "inseong"] } : { status: "ok", groups: ["inseong", "bigyeop"] }
}

// ── §4 간이 조후
const CT: Record<string, [number, number]> = { 子: [-2, 2], 丑: [-2, 1], 寅: [-1, 0], 卯: [0, 0], 辰: [0, 1], 巳: [1, -1], 午: [2, -2], 未: [2, -1], 申: [1, 0], 酉: [0, 0], 戌: [0, -1], 亥: [-1, 1] }
export function climate(n: Natal) {
  let T = CT[n.month.branch][0], M = CT[n.month.branch][1]
  let fire = 0, water = 0
  for (const k of KEYS) {
    const p = n[k]
    if (!p) continue
    if (k !== "month") { T += 0.5 * CT[p.branch][0]; M += 0.5 * CT[p.branch][1] }
    if (p.stem === "丙" || p.stem === "丁") fire++
    if (p.stem === "壬" || p.stem === "癸") water++
  }
  T += 0.5 * (fire - water); M += 0.5 * (water - fire)
  const tClass = T <= -2 ? "한강" : T <= -1 ? "한" : T < 1 ? "중" : T < 2 ? "난" : "열강"
  const mClass = M >= 2 ? "습강" : M >= 1 ? "습" : M > -1 ? "중" : M > -2 ? "조" : "조강"
  const needs: string[] = []
  if (T <= -1) needs.push("warm")
  if (T >= 1) needs.push("cool")
  if (M >= 1) needs.push("dry")
  if (M <= -1) needs.push("moisten")
  return { T, M, tClass, mClass, needs, pillarsUsed: n.hour ? 4 : 3 }
}

// ── §3.3 통관 (오행 가중 = 일간 포함 전체)
export function weightedEls(n: Natal, table: Table): Record<Element, number> {
  const w: Record<Element, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 }
  for (const x of basisOf(n, table, false)) w[x.element] += x.positionWeight * x.hiddenWeight
  return w
}
export function tonggwan(n: Natal, table: Table, minShare = 0.25, minRatio = 0.5): Element[] {
  // QA 해석: 동점 비교는 6자리 반올림 가중으로(부동소수 잡음 제거), 동점이면 X의 오행 순서(목→수)
  const raw = weightedEls(n, table)
  const w = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, r6(v)])) as Record<Element, number>
  const T = Object.values(raw).reduce((a, b) => a + b, 0)
  const hits: { z: Element; wx: number }[] = []
  for (let x = 0; x < 5; x++) {
    const y = (x + 2) % 5
    const wx = w[ELEMENTS[x]], wy = w[ELEMENTS[y]]
    if (r6(wx / T) >= minShare && wx > 0 && r6(wy / T) >= minShare && r6(Math.min(wx, wy) / Math.max(wx, wy)) >= minRatio) hits.push({ z: ELEMENTS[(x + 1) % 5], wx })
  }
  return hits.sort((a, b) => b.wx - a.wx).map((h) => h.z)
}

// ── §5.1 청탁 표지(천간, 일간 제외)
export function clarityFlags(n: Natal): string[] {
  const d = n.day.stem
  const st = (["year", "month", "hour"] as const).filter((k) => n[k]).map((k) => ({ k, tg: tenGod(d, stemEl(n[k]!.stem), stemYY(n[k]!.stem)) }))
  const has = (t: string) => st.some((x) => x.tg === t)
  const grp = (t: string) => (t === "정재" || t === "편재" ? "재" : t === "정인" || t === "편인" ? "인" : t === "비견" || t === "겁재" ? "비" : "")
  const out: string[] = []
  if (has("정관") && has("편관")) out.push("관살혼잡")
  if (has("상관") && has("정관")) out.push("상관견관")
  if (has("편인") && has("식신")) out.push("효신탈식")
  if (st.filter((x) => grp(x.tg) === "비").length >= 2 && st.some((x) => grp(x.tg) === "재")) out.push("비겁쟁재")
  // QA 해석: "이웃한 기둥" = 기둥 순서상 붙은 두 기둥. 일간 제외라 연간–월간만 가능(월간–시간은 일주를 사이에 둠)
  const y = st.find((x) => x.k === "year"), m = st.find((x) => x.k === "month")
  if (y && m && ((grp(y.tg) === "재" && grp(m.tg) === "인") || (grp(y.tg) === "인" && grp(m.tg) === "재"))) out.push("재성파인")
  return out.sort()
}

export const bIdx = bi
/** 점수 = r × 100 소수 1자리 반올림(사사오입). 부동소수 잡음 없이 10진 반올림 */
export const scoreOf = (r: number) => Math.round(Number((r * 1000).toFixed(6))) / 10

// ─────────────────────────────── rules@0.4.0 정정(2026-11-28, D-022) — 명세 본문으로만 작성
const ALL_TABLES = ["kr-monthly-30", "cn-lunarjs", "main-only"] as const
const vSig = (x: { verdict: Verdict; extreme: string | null }) => `${x.verdict}/${x.extreme}`
/**
 * §1.9 정의 분리: tableSensitive = {선택 표, kr, cn} 사이 판정·extreme 차이, IncludingMainOnly = 세 표 모두.
 * 선택 표가 main-only면 {main-only, kr, cn} 세 표가 되어 두 값이 같아진다(명세 문구 그대로).
 */
export function strengthTableSensitivity(n: Natal, selected: Table): { tableSensitive: boolean; tableSensitiveIncludingMainOnly: boolean } {
  const sig = (t: Table) => vSig(modelA(n, t))
  const core = [...new Set<Table>([selected, "kr-monthly-30", "cn-lunarjs"])]
  return { tableSensitive: new Set(core.map(sig)).size > 1, tableSensitiveIncludingMainOnly: new Set(ALL_TABLES.map(sig)).size > 1 }
}
/** §1.9·§6 격국 쪽: byTable은 세 표 그대로, tableSensitive는 {선택, kr, cn}의 격 이름 비교 */
export function structureTableSensitivity(n: Natal, so: StructOpts): { byTable: string[]; tableSensitive: boolean; tableSensitiveIncludingMainOnly: boolean } {
  const name = (t: Table) => primaryStructure(n, { ...so, table: t }).name
  const core = [...new Set<Table>([so.table, "kr-monthly-30", "cn-lunarjs"])]
  const byTable = ALL_TABLES.map(name)
  return { byTable, tableSensitive: new Set(core.map(name)).size > 1, tableSensitiveIncludingMainOnly: new Set(byTable).size > 1 }
}

export type Presence = "stemAndHidden" | "stemOnly" | "hiddenOnly" | "absent"
export interface GroupRef { group: Group; element: Element; tenGods?: string[]; touchul: OPos[]; hiddenPositions: OPos[]; presence: Presence }
export const presenceOf = (touchul: unknown[], hidden: unknown[]): Presence =>
  touchul.length && hidden.length ? "stemAndHidden" : touchul.length ? "stemOnly" : hidden.length ? "hiddenOnly" : "absent"
/**
 * §2.3 필드 정의: touchul = 일간 제외 천간(연→월→시) 중 이 묶음(tenGods 제한 적용) 글자 위치,
 * hiddenPositions = 원국 지지(연→월→일→시) 중 선택 표 지장간(역할 무관)에 이 묶음 글자가 있는 위치 — 투출과 별개.
 */
export function groupRef(n: Natal, table: Table, group: Group, tenGods?: string[]): GroupRef {
  const d = n.day.stem
  const el = groupEl(d, group)
  const ok = (s: string) => stemEl(s) === el && (!tenGods || tenGods.includes(tenGod(d, stemEl(s), stemYY(s))))
  const touchul: OPos[] = (["year", "month", "hour"] as const).filter((k) => n[k] && ok(n[k]!.stem)).map((k) => ({ pillar: k, part: "stem" }))
  const hiddenPositions: OPos[] = KEYS.filter((k) => n[k] && hiddenOf(n[k]!.branch, table).some((h) => ok(h.stem))).map((k) => ({ pillar: k, part: "branch" }))
  return { group, element: el, ...(tenGods ? { tenGods } : {}), touchul, hiddenPositions, presence: presenceOf(touchul, hiddenPositions) }
}
type GSpec = [Group, string[]?]
/** §2.3 상신 표(십성 제한: 칠살격 식신 — 사례 11 "식신(화, tenGods [식신])") */
const SANGSIN_SPEC: Record<string, GSpec[]> = {
  정관격: [["jaeseong"], ["inseong"]], 정재격: [["siksang"], ["gwansal"]], 편재격: [["siksang"], ["gwansal"]], 정인격: [["gwansal"]],
  편인격: [["gwansal"], ["jaeseong"]], 식신격: [["jaeseong"]], 칠살격: [["siksang", ["식신"]], ["inseong"]], 상관격: [["inseong"], ["jaeseong"]], 양인격: [["gwansal"]],
}
/**
 * §2.3 꺼리는 묶음. QA 해석: 표 칸 "식상 중 상관, 편관" → siksang[상관]·gwansal[편관], "편인" → inseong[편인], "정관" → gwansal[정관].
 * 편인격 칸("재성(인수 취급) / 식신이 손상됨(효신 취급)")은 묶음으로 옮길 수 있는 것이 재성뿐이라 재성만 둔다(명세 공백 — 대조 결과로 확인).
 */
const AVOID_SPEC: Record<string, GSpec[]> = {
  정관격: [["siksang", ["상관"]], ["gwansal", ["편관"]]], 정재격: [["bigyeop"]], 편재격: [["bigyeop"]], 정인격: [["jaeseong"]],
  편인격: [["jaeseong"]], 식신격: [["inseong", ["편인"]]], 칠살격: [["jaeseong"]], 상관격: [["gwansal", ["정관"]]], 양인격: [],
}
/** 격 이름 → 상신·꺼림 참조. 건록·월겁격은 투출한 재성·관살·식상만 상신, 꺼림 없음 */
export function structureRefs(n: Natal, table: Table, name: string): { sangsin: GroupRef[]; avoid: GroupRef[] } | null {
  if (name === "건록격" || name === "월겁격") {
    const sangsin = (["jaeseong", "gwansal", "siksang"] as Group[]).map((g) => groupRef(n, table, g)).filter((r) => r.touchul.length > 0)
    return { sangsin, avoid: [] }
  }
  const s = SANGSIN_SPEC[name], a = AVOID_SPEC[name]
  if (!s) return null
  return { sangsin: s.map(([g, t]) => groupRef(n, table, g, t)), avoid: (a ?? []).map(([g, t]) => groupRef(n, table, g, t)) }
}

/** §2.4·§3.6 종왕·종강(모형 A, 선택 표): E1 r ≥ 0.80 · E2 관살 ≤ T의 5%. 비겁 ≥ 인성 종왕(비겁→인성), 인성 > 비겁 종강(인성→비겁) */
export function jongwangOf(n: Natal, table: Table): { kind: "종왕" | "종강"; view: Element[] } | null {
  const a = modelA(n, table)
  const g = groupTotals(n, table)
  if (!(a.ratio >= 0.8) || !(r6(g.gwansal / a.T) <= 0.05)) return null
  const d = n.day.stem
  return g.bigyeop >= g.inseong ? { kind: "종왕", view: [groupEl(d, "bigyeop"), groupEl(d, "inseong")] } : { kind: "종강", view: [groupEl(d, "inseong"), groupEl(d, "bigyeop")] }
}
