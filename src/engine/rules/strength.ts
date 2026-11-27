// 신강·신약 (strength-structure-spec §1, rules@0.3.0, score 반올림 0.3.1, tableSensitive 정의 분리 0.4.0)
//  A weighted : 위치 가중 비율 r = round6(S/T). 경계 0.45/0.55, 극단 0.20/0.80, 근접 폭 0.03 (모두 연구소장 설계값)
//  B threeFactor: 득령·득지·득세 중 2개 이상이면 신강 (중화 없음)
//  C rooted   : A와 같되 일간 외 무근 천간 가중 0.5배 (설계값)
// 합화·충 보정은 하지 않고 affectedBy로 표시만 한다(§1.7). 12운성은 점수에 넣지 않는다.
import type { Element, Pillar, Stem } from "../types"
import { BRANCHES, STEMS } from "../calendar/constants"
import { stemElement } from "./basics"
import { WEIGHTED_V1 } from "./elements"
import {
  GROUPS, branchPos, ei, groupOf, isSupport, mainQiElement, natalHidden, presentKeys, round6, scoreOfRatio, stemPos, type Natal,
} from "./groups"
import { hiddenStemsOf } from "./hidden"
import type {
  HiddenStemTableId, Interaction, NatalPillarKey, Position, RuleOptions, SeasonState, StrengthAffected, StrengthBasisItem,
  StrengthModel, StrengthModelResult, StrengthResult, StrengthVerdict, TenGodGroup,
} from "./types"

export const STRENGTH_THRESHOLDS = Object.freeze({ strong: 0.55, weak: 0.45, extremeStrong: 0.8, extremeWeak: 0.2, nearWidth: 0.03 })
export const ROOTLESS_FACTOR = 0.5
export const HIDDEN_TABLE_IDS: readonly HiddenStemTableId[] = ["kr-monthly-30", "cn-lunarjs", "main-only"]
/** 실제로 쓰이는 날수·라이브러리 표(§1.9). main-only(정기 하나로 줄인 간이 표)는 뺀다 — tableSensitive 비교 대상 */
export const USED_TABLE_IDS: readonly HiddenStemTableId[] = ["kr-monthly-30", "cn-lunarjs"]
const BOUNDARIES = [0.2, 0.45, 0.55, 0.8] as const

const BRANCH_WEIGHT: Record<NatalPillarKey, number> = {
  year: WEIGHTED_V1.yearBranch,
  month: WEIGHTED_V1.monthBranch,
  day: WEIGHTED_V1.dayBranch,
  hour: WEIGHTED_V1.hourBranch,
}

export function verdictOf(r: number): StrengthVerdict {
  if (r >= STRENGTH_THRESHOLDS.strong) return "신강"
  if (r >= STRENGTH_THRESHOLDS.weak) return "중화"
  return "신약"
}

export function extremeOf(r: number): "strong" | "weak" | null {
  if (r >= STRENGTH_THRESHOLDS.extremeStrong) return "strong"
  if (r <= STRENGTH_THRESHOLDS.extremeWeak) return "weak"
  return null
}

/** 가장 가까운 경계(동점이면 작은 경계)와 근접 여부. 거리도 6자리 반올림 후 비교 */
export function nearestOf(r: number): { nearest: { threshold: number; distance: number }; nearBoundary: boolean } {
  let best = { threshold: BOUNDARIES[0] as number, distance: round6(Math.abs(r - BOUNDARIES[0])) }
  for (const t of BOUNDARIES.slice(1)) {
    const d = round6(Math.abs(r - t))
    if (d < best.distance) best = { threshold: t, distance: d }
  }
  return { nearest: best, nearBoundary: best.distance < STRENGTH_THRESHOLDS.nearWidth }
}

/** 원국 지장간에 오행 e가 있는가(여기·중기·정기 무관) */
function hasRoot(n: Natal, table: HiddenStemTableId, e: Element): boolean {
  return natalHidden(n, table).some((x) => stemElement(x.h.stem) === e)
}

interface Scored {
  items: StrengthBasisItem[]
  sRaw: number
  tRaw: number
}

/** 근거 항목: 기둥(연→월→일→시)마다 천간 → 지장간(여기→중기→정기) */
function scoreItems(n: Natal, dayStem: Stem, table: HiddenStemTableId, rooted: boolean): Scored {
  const d = stemElement(dayStem)
  const items: StrengthBasisItem[] = []
  let sRaw = 0
  let tRaw = 0
  const add = (position: Position, char: Stem, positionWeight: number, hiddenWeight: number, rootFactor: number, self: boolean, via?: StrengthBasisItem["viaHiddenStem"]) => {
    const element = stemElement(char)
    const group: TenGodGroup | "self" = self ? "self" : groupOf(d, element)
    const raw = positionWeight * hiddenWeight * rootFactor
    const side = isSupport(group) ? "support" : "oppose"
    if (side === "support") sRaw += raw
    tRaw += raw
    items.push({
      position, char, ...(via ? { viaHiddenStem: via } : {}), element, group, side,
      positionWeight, hiddenWeight, rootFactor, points: round6(raw),
    })
  }
  for (const k of presentKeys(n)) {
    const p = n[k] as Pillar
    const self = k === "day"
    const rf = rooted && !self && !hasRoot(n, table, stemElement(p.stem)) ? ROOTLESS_FACTOR : 1
    add(stemPos(k), p.stem, WEIGHTED_V1.stem, 1, rf, self)
    for (const h of hiddenStemsOf(p.branch, table)) add(branchPos(k), h.stem, BRANCH_WEIGHT[k], h.weight, 1, false, h.role)
  }
  return { items, sRaw, tRaw }
}

function ratioModel(n: Natal, dayStem: Stem, table: HiddenStemTableId, model: "weighted" | "rooted"): StrengthModelResult {
  const { items, sRaw, tRaw } = scoreItems(n, dayStem, table, model === "rooted")
  const r = round6(sRaw / tRaw)
  const { nearest, nearBoundary } = nearestOf(r)
  return {
    model,
    ratio: r,
    score: scoreOfRatio(r),
    verdict: verdictOf(r),
    extreme: extremeOf(r),
    nearBoundary,
    nearest,
    support: round6(sRaw),
    total: round6(tRaw),
    basis: items,
    ruleId: `strength.${model}.v1`,
  }
}

function threeFactorModel(n: Natal, dayStem: Stem, o: Pick<RuleOptions, "hiddenStemTable" | "deukjiBasis">): StrengthModelResult {
  const d = stemElement(dayStem)
  const sup = (e: Element) => isSupport(groupOf(d, e))
  const t = o.hiddenStemTable
  const deukryeongMet = sup(mainQiElement(n.month, t))
  const deukjiMet =
    o.deukjiBasis === "dayBranchMainQi"
      ? sup(mainQiElement(n.day, t))
      : hiddenStemsOf(n.day.branch, t).some((h) => sup(stemElement(h.stem)))
  // 득세: 연간·월간·시간·연지·시지(지지는 정기 오행). 시주 모름이면 연간·월간·연지 중 2
  const seats: { pos: Position; e: Element }[] = [
    { pos: stemPos("year"), e: stemElement(n.year.stem) },
    { pos: stemPos("month"), e: stemElement(n.month.stem) },
  ]
  if (n.hour) seats.push({ pos: stemPos("hour"), e: stemElement(n.hour.stem) })
  seats.push({ pos: branchPos("year"), e: mainQiElement(n.year, t) })
  if (n.hour) seats.push({ pos: branchPos("hour"), e: mainQiElement(n.hour, t) })
  const supporting = seats.filter((s) => sup(s.e))
  const of = seats.length
  const need = n.hour ? 3 : 2
  const count = supporting.length
  const deukseMet = count >= need
  const met = [deukryeongMet, deukjiMet, deukseMet].filter(Boolean).length
  return {
    model: "threeFactor",
    ratio: null,
    score: null,
    verdict: met >= 2 ? "신강" : "신약",
    extreme: null,
    nearBoundary: false,
    nearest: null,
    support: null,
    total: null,
    factors: {
      deukryeong: { met: deukryeongMet, basis: [branchPos("month")], ruleId: "strength.threeFactor.deukryeong.mainQi" },
      deukji: { met: deukjiMet, basis: [branchPos("day")], ruleId: `strength.threeFactor.deukji.${o.deukjiBasis}` },
      deukse: { met: deukseMet, basis: supporting.map((s) => s.pos), ruleId: `strength.threeFactor.deukse.${need}of${of}`, count, of },
    },
    basis: [],
    ruleId: "strength.threeFactor.v1",
  }
}

export function seasonStateOf(dayEl: Element, monthEl: Element): SeasonState {
  const d = ei(dayEl)
  const m = ei(monthEl)
  if (m === d) return "旺"
  if ((m + 1) % 5 === d) return "相"
  if ((d + 1) % 5 === m) return "休"
  if ((d + 2) % 5 === m) return "囚"
  return "死"
}

/** 모형 A만 빠르게(표 민감도·시진 민감도용) */
export function weightedRatio(n: Natal, dayStem: Stem, table: HiddenStemTableId): number {
  const { sRaw, tRaw } = scoreItems(n, dayStem, table, false)
  return round6(sRaw / tRaw)
}

/** 오서둔: 일간에 맞는 子시~亥시 12간지(子시 = 그날 0~1시 子시) */
export function hourPillarsOf(dayStem: Stem): Pillar[] {
  const start = (STEMS.indexOf(dayStem) % 5) * 2
  return BRANCHES.map((b, i) => ({ stem: STEMS[(start + i) % 10], branch: b }))
}

const VERDICT_ORDER: readonly StrengthVerdict[] = ["신강", "중화", "신약"]

export function analyzeStrength(n: Natal, o: RuleOptions, interactions: readonly Interaction[]): StrengthResult {
  const dayStem = n.day.stem
  const d = stemElement(dayStem)
  const t = o.hiddenStemTable
  const A = ratioModel(n, dayStem, t, "weighted")
  const B = threeFactorModel(n, dayStem, o)
  const C = ratioModel(n, dayStem, t, "rooted")
  const models = [A, B, C]
  const agreement = models.every((m) => m.verdict === A.verdict) ? "all" : "split"

  const dayMasterRoots = natalHidden(n, t)
    .filter((x) => stemElement(x.h.stem) === d)
    .map((x) => ({ position: branchPos(x.key), stem: x.h.stem, role: x.h.role }))

  // 묶음별 합계(일간 제외, 모형 A 가중)
  const sums: Record<TenGodGroup, number> = { bigyeop: 0, siksang: 0, jaeseong: 0, gwansal: 0, inseong: 0 }
  for (const it of A.basis) {
    if (it.group === "self") continue
    sums[it.group] += it.positionWeight * it.hiddenWeight * it.rootFactor
  }
  const groupTotals = Object.fromEntries(GROUPS.map((g) => [g, round6(sums[g])])) as Record<TenGodGroup, number>

  const tableSensitivity = HIDDEN_TABLE_IDS.filter((id) => id !== t).map((tableId) => {
    const ratio = weightedRatio(n, dayStem, tableId)
    return { tableId, ratio, verdict: verdictOf(ratio), extreme: extremeOf(ratio), nearBoundary: nearestOf(ratio).nearBoundary }
  })
  // §1.9(2026-11-28 확정): tableSensitive = {선택 표, kr, cn} 비교. main-only는 간이 판정용이라 IncludingMainOnly에만 넣는다
  const differs = (x: (typeof tableSensitivity)[number]) => x.verdict !== A.verdict || x.extreme !== A.extreme
  const tableSensitive = tableSensitivity.filter((x) => USED_TABLE_IDS.includes(x.tableId)).some(differs)
  const tableSensitiveIncludingMainOnly = tableSensitivity.some(differs)

  let hourSensitivity: StrengthResult["hourSensitivity"] = null
  if (n.hour === null) {
    const byHour = hourPillarsOf(dayStem).map((hour) => {
      const ratio = weightedRatio({ ...n, hour }, dayStem, t)
      return { hour, ratio, verdict: verdictOf(ratio) }
    })
    const verdicts = VERDICT_ORDER.filter((v) => byHour.some((h) => h.verdict === v))
    hourSensitivity = { byHour, verdicts, hourSensitive: verdicts.length > 1 }
  }

  // 합충 표시(§1.7): 원국 관계 전부. 월지·일지·일간·돕는 천간이 끼면 critical
  const supportStemKeys = new Set(
    (["year", "month", "hour"] as const).filter((k) => n[k] && isSupport(groupOf(d, stemElement((n[k] as Pillar).stem)))),
  )
  const isCritical = (p: Position) =>
    (p.part === "branch" && (p.pillar === "month" || p.pillar === "day")) ||
    (p.part === "stem" && (p.pillar === "day" || supportStemKeys.has(p.pillar as "year" | "month" | "hour")))
  const affectedBy: StrengthAffected[] = interactions
    .filter((i) => i.scope === "natal")
    .map((i) => ({
      ruleId: i.ruleId,
      type: i.type,
      members: i.members.map((m) => ({ ...m })),
      critical: i.members.some(isCritical),
      ...(i.subsumedBy ? { subsumedBy: [...i.subsumedBy] } : {}),
    }))

  return {
    primary: o.strengthPrimary as StrengthModel,
    models,
    agreement,
    seasonState: seasonStateOf(d, mainQiElement(n.month, t)),
    dayMasterRooted: dayMasterRoots.length > 0,
    dayMasterRoots,
    groupTotals,
    tableSensitivity,
    tableSensitive,
    tableSensitiveIncludingMainOnly,
    hourSensitivity,
    affectedBy,
    adjustmentsApplied: [],
  }
}

/** 대표 모형 결과 */
export function primaryModel(s: StrengthResult): StrengthModelResult {
  return s.models.find((m) => m.model === s.primary) as StrengthModelResult
}
