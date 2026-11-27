// 명리 규칙 엔진 공개 함수 (P3-05 rules@0.2.0 → P3-06 rules@0.3.0)
// 입력: 역법 결과(CalendarResult)의 원국 + (선택) 대운·세운 간지. 출력: RuleAnalysis(해석 재료).
// 순수 함수 — AI·DB·네트워크·현재 시각을 쓰지 않는다. 같은 입력·옵션이면 같은 출력(배열 순서 포함).
// 명세: docs/knowledge/rules-spec.md · docs/knowledge/strength-structure-spec.md · 옵션: docs/knowledge/schools.md
// 설계: docs/SAJU_ENGINE.md "규칙 엔진". 신강약·격국·용신·조후·기세는 명세 §6 제안대로 RuleAnalysis에 함께 담는다
// (별도 함수로 나누면 호출하는 쪽이 옵션·원국을 두 번 맞춰야 하고, 검증기 P4-04가 결과 하나만 대조하면 되게 하기 위함).
import { EngineInputError, type CalendarResult, type Pillar } from "../types"
import { assertPillar, stemElement, stemYinYang, tenGodOfBranch, tenGodOfStem } from "./basics"
import { elementDistribution } from "./elements"
import { analyzeGongmang, type GongmangTarget } from "./gongmang"
import { hiddenStemsOf } from "./hidden"
import { findInteractions, type Slot } from "./interactions"
import { resolveRuleOptions } from "./options"
import { twelveStageOf, twelveStagesTableId } from "./twelveStages"
import { analyzeStrength } from "./strength"
import { regularStructures, specialStructures } from "./structure"
import { analyzeUsefulGods, eokbuRank1Of, markReverses } from "./usefulGod"
import { analyzeClimate } from "./climate"
import { analyzeQiFlow } from "./qiFlow"
import type {
  HiddenStem, NatalPillarKey, Position, RuleAnalysis, RuleExtra, RuleOptions, TenGodHit, TwelveStageHit,
} from "./types"
import { RULES_ENGINE_VERSION } from "./version"

const NATAL_KEYS: readonly NatalPillarKey[] = ["year", "month", "day", "hour"]

interface PillarSlot {
  pillar: Pillar
  stemPos: Position
  branchPos: Position
  natalIndex: number | null
  luckIndex: number | null
}

function readInput(chart: CalendarResult, extra?: RuleExtra) {
  if (!chart || typeof chart !== "object" || !chart.pillars || typeof chart.pillars !== "object")
    throw new EngineInputError("원국(chart.pillars)이 없음")
  const { year, month, day, hour } = chart.pillars
  assertPillar(year, "연주")
  assertPillar(month, "월주")
  assertPillar(day, "일주")
  if (hour !== null) assertPillar(hour, "시주")
  if (extra !== undefined && (extra === null || typeof extra !== "object")) throw new EngineInputError("extra는 객체여야 함")
  const luck = extra?.luck ?? []
  if (!Array.isArray(luck)) throw new EngineInputError("extra.luck은 간지 배열이어야 함")
  luck.forEach((p, i) => assertPillar(p, `대운[${i}]`))
  const seun = extra?.year ?? null
  if (seun !== null) assertPillar(seun, "세운")
  return {
    natal: { year: { ...year }, month: { ...month }, day: { ...day }, hour: hour ? { ...hour } : null },
    luck: luck.map((p) => ({ ...p })),
    seun: seun ? { ...seun } : null,
  }
}

/**
 * 원국(과 선택적으로 대운·세운)의 명리 규칙 계산.
 * @param chart computeChart 결과(pillars만 쓴다. hour가 null이면 시주 항목을 계산하지 않고 omitted에 기록)
 * @param options 해석 옵션(RuleOptions) 일부. 모르는 키·지원하지 않는 값은 EngineInputError
 * @param extra luck = 대운 간지들(각 대운은 원국·세운과만 비교), year = 세운 간지
 */
export function analyzeRules(chart: CalendarResult, options?: Partial<RuleOptions>, extra?: RuleExtra): RuleAnalysis {
  const o = resolveRuleOptions(options)
  const src = readInput(chart, extra)
  const dayStem = src.natal.day.stem

  // 기둥 목록: 원국(연→월→일→시) → 대운(0부터) → 세운
  const slots: PillarSlot[] = []
  NATAL_KEYS.forEach((k, i) => {
    const p = src.natal[k]
    if (p) slots.push({ pillar: p, stemPos: { pillar: k, part: "stem" }, branchPos: { pillar: k, part: "branch" }, natalIndex: i, luckIndex: null })
  })
  src.luck.forEach((p, i) =>
    slots.push({
      pillar: p,
      stemPos: { pillar: "daeun", part: "stem", luckIndex: i },
      branchPos: { pillar: "daeun", part: "branch", luckIndex: i },
      natalIndex: null,
      luckIndex: i,
    }),
  )
  if (src.seun) slots.push({ pillar: src.seun, stemPos: { pillar: "seun", part: "stem" }, branchPos: { pillar: "seun", part: "branch" }, natalIndex: null, luckIndex: null })

  // 지장간(원국만)
  const hs = (p: Pillar | null): HiddenStem[] | null => (p ? hiddenStemsOf(p.branch, o.hiddenStemTable) : null)
  const hiddenStems = {
    tableId: o.hiddenStemTable,
    pillars: {
      year: hs(src.natal.year) as HiddenStem[],
      month: hs(src.natal.month) as HiddenStem[],
      day: hs(src.natal.day) as HiddenStem[],
      hour: hs(src.natal.hour),
    },
  }

  // 십성: 기둥마다 천간 → 지지 → 지장간(원국만). 일간 자신은 넣지 않는다
  const tenGods: TenGodHit[] = []
  for (const s of slots) {
    const isDay = s.stemPos.pillar === "day"
    if (!isDay) tenGods.push({ position: { ...s.stemPos }, char: s.pillar.stem, tenGod: tenGodOfStem(dayStem, s.pillar.stem) })
    tenGods.push({ position: { ...s.branchPos }, char: s.pillar.branch, tenGod: tenGodOfBranch(dayStem, s.pillar.branch, o.branchYinYang) })
    if (s.natalIndex !== null)
      for (const h of hiddenStemsOf(s.pillar.branch, o.hiddenStemTable))
        tenGods.push({ position: { ...s.branchPos }, char: h.stem, tenGod: tenGodOfStem(dayStem, h.stem), viaHiddenStem: h.role })
  }

  // 12운성: 기둥마다 일간 기준(봉법) → 그 기둥 천간 기준(좌법)
  const tableId = twelveStagesTableId(o)
  const twelveStages: TwelveStageHit[] = []
  for (const s of slots) {
    const b = s.pillar.branch
    twelveStages.push({ basis: "dayStem", stem: dayStem, position: { ...s.branchPos }, branch: b, stage: twelveStageOf(dayStem, b, o), tableId })
    twelveStages.push({ basis: "ownPillar", stem: s.pillar.stem, position: { ...s.branchPos }, branch: b, stage: twelveStageOf(s.pillar.stem, b, o), tableId })
  }

  // 합충형파해
  const relSlots: Slot[] = slots.map((s, i) => ({
    order: i,
    natalIndex: s.natalIndex,
    luckIndex: s.luckIndex,
    stemPos: s.stemPos,
    branchPos: s.branchPos,
    stem: s.pillar.stem,
    branch: s.pillar.branch,
  }))
  const interactions = findInteractions(relSlots, o)

  // 공망
  const targets: GongmangTarget[] = slots.map((s) => ({ position: { ...s.branchPos }, branch: s.pillar.branch }))
  const gongmang = analyzeGongmang(o.gongmangBasis, src.natal, targets)
  const elements = elementDistribution(src.natal, o)

  // P3-06: 원국만 판단(운 제외). 관계는 원국 내부(scope natal)만 쓴다
  const natalInteractions = interactions.filter((i) => i.scope === "natal")
  const strength = analyzeStrength(src.natal, o, natalInteractions)
  const A = strength.models[0] // weighted (특수격·통관·기세는 strengthPrimary와 무관하게 모형 A 사용, spec §2.4)
  const dayEl = stemElement(dayStem)
  const regular = regularStructures(src.natal, o)
  const special =
    o.specialStructures === "off"
      ? { candidates: [], notes: [] }
      : specialStructures({ n: src.natal, o, strength, A, weighted: elements.weighted, interactions: natalInteractions })
  markReverses(special.candidates, dayEl, strength.groupTotals, eokbuRank1Of(strength, dayEl))
  const climate = analyzeClimate(src.natal)
  const usefulGods = analyzeUsefulGods({
    n: src.natal, o, d: dayEl, weighted: elements.weighted, strength, A, climate,
    regular: regular.candidates, special: special.candidates,
  })
  const qiFlow = analyzeQiFlow(src.natal, elements.weighted, A.total as number)

  return {
    engineVersion: RULES_ENGINE_VERSION,
    calendarEngineVersion: typeof chart.engineVersion === "string" ? chart.engineVersion : "unknown",
    options: o,
    omitted: src.natal.hour ? [] : ["hour"],
    source: src,
    dayMaster: { stem: dayStem, element: stemElement(dayStem), yinYang: stemYinYang(dayStem) },
    hiddenStems,
    tenGods,
    twelveStages,
    interactions,
    gongmang,
    elements,
    strength,
    structure: {
      candidates: [...regular.candidates, ...special.candidates],
      tableSensitive: regular.tableSensitive,
      byTable: regular.byTable,
      notes: [...regular.notes, ...special.notes],
    },
    usefulGods,
    climate,
    qiFlow,
  }
}

export { resolveRuleOptions, DEFAULT_RULE_OPTIONS, USEFUL_GOD_METHODS } from "./options"
export { interactionId } from "./interactions"
export { STRENGTH_THRESHOLDS, hourPillarsOf } from "./strength"
export { CLIMATE_BRANCH, CLIMATE_SOURCE } from "./climate"
export { RULES_ENGINE_VERSION } from "./version"
export { hiddenStemsOf } from "./hidden"
export { twelveStageOf, twelveStagesTableId } from "./twelveStages"
export { tenGodOf, tenGodOfStem, tenGodOfBranch, stemElement, stemYinYang, branchElement, branchYinYang } from "./basics"
export { xunKongOf, gongmangString, analyzeGongmang, type XunKong } from "./gongmang"
export { LU, TWELVE_STAGES } from "./tables"
export type * from "./types"
