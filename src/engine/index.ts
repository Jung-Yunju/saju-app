// 사주엔진 공개 API (P3-01 계약). 구현: saju-engine-developer
// 이 파일의 함수 이름·시그니처는 품질검증 테스트가 의존하므로 바꾸려면 총괄실장 승인 필요.
// 본문은 calendar/ 아래 모듈로 위임만 한다.
import type { BirthInput, CalendarResult, EngineOptions, Pillar, SolarTermPoint } from "./types"
import { computeChartImpl } from "./calendar/chart"
import { solarTermsUtc } from "./calendar/solarterms"
import { dayPillarOfDate, yearPillarOfGanzhiYear } from "./calendar/pillars"
import { assertSolarDate } from "./calendar/lunar"

export * from "./types"
// 명리 규칙(해석 재료) — 역법 객관값과 다른 모듈
export { xunKongOf, gongmangString, RULES_ENGINE_VERSION, type XunKong } from "./rules/gongmang"
// 규칙 엔진 P3-05(rules@0.2.0에서 도입): 지장간·십성·12운성·합충형파해·공망 hits·오행 분포. 현재 버전은 RULES_ENGINE_VERSION(rules/version.ts)
export { analyzeRules, resolveRuleOptions, DEFAULT_RULE_OPTIONS } from "./rules"
export type {
  RuleAnalysis, RuleOptions, RuleExtra, Position, PillarKey, NatalPillarKey, HiddenStem, HiddenStemRole,
  HiddenStemTableId, HiddenStemsResult, TenGod, TenGodHit, TwelveStage, TwelveStageHit, Interaction,
  InteractionType, GongmangEntry, ElementDistribution, ElementRecord, YinYang,
} from "./rules/types"
// 규칙 엔진 P3-06(rules@0.3.0에서 도입, rules@0.4.0 명세 정정 D-022): 신강약·격국·용신·간이 조후·기세 + D-019 포함 표시(interactionId)
export { interactionId, USEFUL_GOD_METHODS, STRENGTH_THRESHOLDS, hourPillarsOf, CLIMATE_BRANCH, CLIMATE_SOURCE } from "./rules"
export type {
  StrengthModel, StrengthVerdict, TenGodGroup, SeasonState, StrengthBasisItem, FactorCheck, StrengthModelResult,
  StrengthAffected, StrengthResult, StructureGroupRef, StructureCandidate, StructureResult, UsefulGodMethod,
  UsefulGodCandidate, FavorableSet, UsefulGodView, UsefulGodsResult, ClimateResult, QiFlowResult,
} from "./rules/types"
// 신성 원형(archetype@0.1.0, D-030): RuleAnalysis + 원국 → 창작 상징 원형 12개 중 하나(순서형 관문). 해석 문장 없음
export { analyzeArchetype, ARCHETYPE_ENGINE_VERSION, ARCHETYPE_RULES_HASH, ARCHETYPE_ID_LIST, ARCHETYPE_TABLE } from "./archetype"
export type {
  ArchetypeId, ArchetypeCategory, ArchetypeResult, ArchetypeRef, ArchetypeBasisItem, ArchetypeConditionCheck,
  ArchetypeHourSensitivity, ArchetypeTableSensitivity, ArchetypeChartInput,
} from "./archetype"

/** 출생 정보 → 원국·절기·대운 (역법 객관값) */
export function computeChart(input: BirthInput, options?: Partial<EngineOptions>): CalendarResult {
  return computeChartImpl(input, options)
}

/** 해당 양력 연도(1월 1일~12월 31일 UTC)에 속한 24절기 시각 목록 (UTC, 시간순) */
export function getSolarTermsUtc(year: number): SolarTermPoint[] {
  return solarTermsUtc(year)
}

/** 세운: 해당 연도(입춘 기준 간지 연도)의 연주 */
export function yearPillarOf(year: number): Pillar {
  return yearPillarOfGanzhiYear(year)
}

/** 양력 날짜의 일주 (자정 기준, 날짜 경계 옵션 미적용) */
export function dayPillarOf(year: number, month: number, day: number): Pillar {
  assertSolarDate(year, month, day)
  return dayPillarOfDate(year, month, day)
}
