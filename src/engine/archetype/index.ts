// 신성 원형 분석(archetype@0.1.0, D-030). 입력: analyzeRules 결과 + 원국(시진·표 변형 재판정용). 순수 함수 — DB·네트워크·AI 없음.
// 원형은 전통 명리 공식 분류가 아니라 서비스의 창작적 상징이다. 이 모듈은 해석 문장을 만들지 않는다.
// 판정: 동봉 규칙(research-12 + 조정안 C)의 관문 12개를 순서대로 검사해 처음 통과한 원형(cascade). 지장간 표는 kr-monthly-30 고정.
import { analyzeRules, hourPillarsOf } from "../rules"
import type { RuleAnalysis, RuleOptions, HiddenStemTableId } from "../rules/types"
import { EngineInputError, type CalendarResult, type Pillar } from "../types"
import { runCascade, leafChecks, type CascadeOutcome } from "./cascade"
import { extractFeatures } from "./features"
import { ARCHETYPE_RULES_HASH, archetypeRules } from "./ruleset"
import type { ArchetypeBasisItem, ArchetypeId, ArchetypeRef, ArchetypeResult, ArchetypeGate } from "./types"
import { ARCHETYPE_ENGINE_VERSION, ARCHETYPE_FEATURE_VERSION } from "./version"

export { ARCHETYPE_ENGINE_VERSION, ARCHETYPE_FEATURE_VERSION } from "./version"
export { ARCHETYPE_RULES_HASH, canonicalJson as archetypeCanonicalJson } from "./ruleset"
export { ARCHETYPE_ID_LIST } from "./types"
export type {
  ArchetypeId, ArchetypeCategory, ArchetypeResult, ArchetypeRef, ArchetypeBasisItem, ArchetypeConditionCheck,
  ArchetypeHourSensitivity, ArchetypeTableSensitivity, ArchetypeRuleSet, ArchetypeGate, Condition as ArchetypeCondition,
  FeatureValue as ArchetypeFeatureValue, FeatureVector as ArchetypeFeatureVector,
} from "./types"

/** 원형 판정에 쓰는 지장간 표(D-030 고정) */
export const ARCHETYPE_TABLE: HiddenStemTableId = "kr-monthly-30"
/** 표 민감도 기록에 쓰는 표 순서 */
const TABLES: readonly HiddenStemTableId[] = ["kr-monthly-30", "cn-lunarjs", "main-only"]

/** 원국 입력 — computeChart 결과를 그대로 넣으면 된다(pillars·engineVersion만 쓴다) */
export type ArchetypeChartInput = Pick<CalendarResult, "pillars"> & { engineVersion?: string }

const P = (p: Pillar | null): string => (p ? p.stem + p.branch : "--")

function judge(chart: CalendarResult, options: RuleOptions): CascadeOutcome {
  const { rs, ordered } = archetypeRules()
  return runCascade(ordered, rs.fallback, extractFeatures(analyzeRules(chart, options)))
}

const ref = (g: ArchetypeGate): ArchetypeRef => ({ id: g.id, name: g.name, category: g.category, order: g.priority })

/**
 * RuleAnalysis → 신성 원형.
 * - 판정은 analysis의 옵션 그대로 쓰되 hiddenStemTable만 kr-monthly-30으로 고정한다(다르면 같은 원국을 kr 표로 다시 분석).
 * - 시각 모름(시주 null)이면 세 기둥만으로 판정하고, 12시진 시주를 넣은 재판정 결과를 sensitivity.hour에 기록한다.
 * - cn-lunarjs·main-only 표 재판정 결과는 sensitivity.table에 기록만 한다(원형을 바꾸지 않음).
 * @throws EngineInputError chart.pillars와 analysis.source.natal이 다를 때
 */
export function analyzeArchetype(analysis: RuleAnalysis, chart: ArchetypeChartInput): ArchetypeResult {
  if (!analysis || typeof analysis !== "object" || !analysis.source?.natal || !analysis.options)
    throw new EngineInputError("analysis는 analyzeRules 결과여야 함")
  if (!chart || typeof chart !== "object" || !chart.pillars) throw new EngineInputError("원국(chart.pillars)이 없음")
  const n = analysis.source.natal
  const c = chart.pillars
  if (P(n.year) !== P(c.year) || P(n.month) !== P(c.month) || P(n.day) !== P(c.day) || P(n.hour) !== P(c.hour))
    throw new EngineInputError(
      `analysis(${[n.year, n.month, n.day, n.hour].map(P).join(" ")})와 chart(${[c.year, c.month, c.day, c.hour].map(P).join(" ")})의 원국이 다름`,
    )
  const { rs, ordered } = archetypeRules()
  // analyzeRules는 pillars·engineVersion만 읽는다(rules/index.ts readInput)
  const base: CalendarResult = {
    pillars: { year: { ...n.year }, month: { ...n.month }, day: { ...n.day }, hour: n.hour ? { ...n.hour } : null },
    engineVersion: analysis.calendarEngineVersion,
  } as CalendarResult
  const options: RuleOptions = { ...analysis.options, hiddenStemTable: ARCHETYPE_TABLE }
  // 같은 옵션(표 kr)이면 받은 분석을 그대로 쓴다. 특징은 원국 값만 읽으므로 대운·세운(extra) 유무와 무관
  const a = analysis.options.hiddenStemTable === ARCHETYPE_TABLE ? analysis : analyzeRules(base, options)
  const fv = extractFeatures(a)
  const out = runCascade(ordered, rs.fallback, fv)
  const pIdx = ordered.findIndex((g) => g.id === out.primary.id)
  const shown = out.fallbackSafety ? out.gates : out.gates.slice(0, pIdx + 1)
  const basis: ArchetypeBasisItem[] = shown.map((x) => ({
    order: x.gate.priority, id: x.gate.id, ruleId: x.gate.ruleId, gateLabel: x.gate.gateLabel,
    passed: x.passed,
    ...(x.failedOn !== undefined ? { failedOn: x.failedOn } : {}),
    values: x.values, conditions: leafChecks(x.gate.require, fv),
  }))
  const alsoMatched = out.passed.filter((id) => id !== out.primary.id)
  const byId = new Map(ordered.map((g) => [g.id, g]))
  const hourKnown = n.hour !== null

  let hour: ArchetypeResult["sensitivity"]["hour"] = null
  if (!hourKnown) {
    const byHour = hourPillarsOf(n.day.stem).map((hp) => {
      const r = judge({ ...base, pillars: { ...base.pillars, hour: hp } }, options)
      return { hour: { ...hp }, id: r.primary.id, ...(r.fallbackSafety ? { fallbackSafety: true as const } : {}) }
    })
    const seen = new Set(byHour.map((h) => h.id))
    hour = {
      stable: byHour.filter((h) => h.id === out.primary.id).length,
      of: 12,
      distinct: ordered.filter((g) => seen.has(g.id)).map((g) => g.id),
      byHour,
    }
  }

  const byTable = TABLES.map((t) => {
    const r = t === ARCHETYPE_TABLE ? out : judge(base, { ...options, hiddenStemTable: t })
    return { tableId: t, id: r.primary.id, ...(r.fallbackSafety ? { fallbackSafety: true as const } : {}) }
  })
  const tid = (t: HiddenStemTableId): ArchetypeId => byTable.find((x) => x.tableId === t)!.id

  return {
    version: ARCHETYPE_ENGINE_VERSION,
    engineVersion: ARCHETYPE_ENGINE_VERSION,
    rulesHash: ARCHETYPE_RULES_HASH,
    ruleSet: { id: rs.id, version: rs.version, status: rs.status },
    featureVersion: ARCHETYPE_FEATURE_VERSION,
    rulesEngineVersion: a.engineVersion,
    calendarEngineVersion: a.calendarEngineVersion,
    ruleOptions: { ...a.options, usefulGodMethods: [...a.options.usefulGodMethods] },
    id: out.primary.id,
    name: out.primary.name,
    category: out.primary.category,
    order: out.primary.priority,
    ruleId: out.primary.ruleId,
    secondary: alsoMatched.length ? ref(byId.get(alsoMatched[0])!) : null,
    alsoMatched,
    basis,
    hourKnown,
    hourUnknownNote: !hourKnown,
    sensitivity: {
      hour,
      table: {
        fixed: "kr-monthly-30",
        byTable,
        changed: tid("kr-monthly-30") !== tid("cn-lunarjs"),
        changedIncludingMainOnly: new Set(byTable.map((x) => x.id)).size > 1,
      },
    },
    fallbackSafety: out.fallbackSafety,
    disclaimer: "creative-symbol",
    disclaimerText: rs.disclaimer,
  }
}
