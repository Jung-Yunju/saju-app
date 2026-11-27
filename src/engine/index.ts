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
