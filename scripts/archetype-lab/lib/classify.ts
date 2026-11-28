// 원국(CalendarResult) → 원형 결과. 핵심 점수 계산(scoreAnalysis)은 RuleAnalysis만 받는다.
// 시주·지장간 표 민감도는 같은 원국을 다른 조건으로 analyzeRules에 다시 넣어 비교한다(규칙 엔진은 고치지 않는다).
import { analyzeRules, hourPillarsOf, type CalendarResult, type HiddenStemTableId, type RuleAnalysis, type RuleOptions } from "../../../src/engine"
import { extractFeatures } from "./features"
import { ruleSetHash } from "./ruleset"
import { scoreRuleSet } from "./score"
import {
  ARCHETYPE_ENGINE_VERSION, FEATURE_VERSION, type ArchetypeResult, type ArchetypeRuleSet, type ArchetypeScoring, type HourUnknownPolicy,
} from "./types"

export const TABLES: readonly HiddenStemTableId[] = ["kr-monthly-30", "cn-lunarjs", "main-only"]

export interface ClassifyOptions {
  ruleOptions?: Partial<RuleOptions>
  /** 기본 threePillars */
  hourUnknownPolicy?: HourUnknownPolicy
  /** 기본 둘 다 true */
  sensitivity?: { hour?: boolean; table?: boolean }
  /** 미리 계산한 규칙 파일 해시(반복 호출 시 성능용). 없으면 계산 */
  ruleSetHash?: string
}

/** RuleAnalysis → 점수(민감도 없음). 서비스 엔진의 핵심 함수에 해당 */
export function scoreAnalysis(a: RuleAnalysis, rs: ArchetypeRuleSet): ArchetypeScoring & { features: ReturnType<typeof extractFeatures> } {
  const features = extractFeatures(a)
  return { ...scoreRuleSet(rs, features), features }
}

function withHour(chart: CalendarResult, hour: CalendarResult["pillars"]["hour"]): CalendarResult {
  return { ...chart, pillars: { ...chart.pillars, hour } }
}

export function classifyArchetype(chart: CalendarResult, rs: ArchetypeRuleSet, opts: ClassifyOptions = {}): ArchetypeResult {
  const policy = opts.hourUnknownPolicy ?? "threePillars"
  const doHour = opts.sensitivity?.hour ?? true
  const doTable = opts.sensitivity?.table ?? true
  const a = analyzeRules(chart, opts.ruleOptions)
  const base = scoreAnalysis(a, rs)
  const hourKnown = chart.pillars.hour !== null

  // 시주 민감도(시각 모름일 때만): 일간 기준 12시진(子→亥) 시주를 넣어 본다 — strength.hourSensitivity와 같은 방식
  let hourSensitivity: ArchetypeResult["hourSensitivity"] = null
  if (!hourKnown && doHour) {
    const byHour = hourPillarsOf(chart.pillars.day.stem).map((hp) => {
      const s = scoreRuleSet(rs, extractFeatures(analyzeRules(withHour(chart, hp), opts.ruleOptions)))
      return { hour: hp, primary: s.primary.id, secondary: s.secondary?.id ?? null }
    })
    const counts = new Map<string, number>()
    for (const h of byHour) counts.set(h.primary, (counts.get(h.primary) ?? 0) + 1)
    const prio = new Map(rs.archetypes.map((x) => [x.id, x.priority]))
    const modal = [...counts.entries()].sort(
      (x, y) => y[1] - x[1] || Number(y[0] === base.primary.id) - Number(x[0] === base.primary.id) || prio.get(x[0])! - prio.get(y[0])!,
    )[0]
    // 순서: priority 오름차순(규칙 파일 나열 순서와 무관)
    const distinctPrimary = [...counts.keys()].sort((x, y) => prio.get(x)! - prio.get(y)!)
    hourSensitivity = {
      byHour,
      distinctPrimary,
      stable: distinctPrimary.length === 1,
      agreeWithThreePillars: counts.get(base.primary.id) ?? 0,
      modal: { id: modal[0], count: modal[1] },
    }
  }

  // 지장간 표 민감도
  let tableSensitivity: ArchetypeResult["tableSensitivity"] = null
  if (doTable) {
    const sel = a.options.hiddenStemTable
    const byTable = TABLES.map((t) => {
      const s = t === sel ? base : scoreRuleSet(rs, extractFeatures(analyzeRules(chart, { ...opts.ruleOptions, hiddenStemTable: t })))
      return { tableId: t, primary: s.primary.id, secondary: s.secondary?.id ?? null }
    })
    const pick = (t: HiddenStemTableId) => byTable.find((x) => x.tableId === t)!.primary
    const core = new Set([pick(sel), pick("kr-monthly-30"), pick("cn-lunarjs")])
    tableSensitivity = { byTable, sensitive: core.size > 1, sensitiveIncludingMainOnly: new Set(byTable.map((x) => x.primary)).size > 1 }
  }

  let scoring: ArchetypeScoring = base
  if (!hourKnown && policy === "hourModal" && hourSensitivity && hourSensitivity.modal.id !== base.primary.id) {
    const m = base.ranking.find((x) => x.id === hourSensitivity!.modal.id)!
    scoring = {
      ...base,
      primary: { id: m.id, name: m.name, score: m.score },
      secondary: base.primary,
      margin: null,
      tie: false,
      boundary: true,
      decidedBy: "hourModal",
    }
  }
  const { features: _f, ...rest } = base
  void _f
  return {
    ...rest,
    ...scoring,
    engineVersion: ARCHETYPE_ENGINE_VERSION,
    featureVersion: FEATURE_VERSION,
    rulesEngineVersion: a.engineVersion,
    calendarEngineVersion: a.calendarEngineVersion,
    ruleSet: { id: rs.id, version: rs.version, status: rs.status, hash: opts.ruleSetHash ?? ruleSetHash(rs) },
    ruleOptions: a.options,
    hourKnown,
    hourUnknownPolicy: policy,
    features: base.features,
    hourSensitivity,
    tableSensitivity,
    disclaimer: rs.disclaimer,
  }
}
