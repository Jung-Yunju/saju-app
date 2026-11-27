// 24절기 시각 (P3-03)
// 내부 계산기: lunar-javascript(寿星天文历 알고리즘, ΔT 반영).
// ★ 라이브러리 절기 시각은 중국 표준시(UTC+8) 기준이다. 여기서 반드시 UTC로 바꾼 뒤에만 비교한다.
//   검산: 2024 立春 라이브러리 값 2024-02-04 16:27:07(UTC+8) = 08:27:07 UTC = 17:27:07 KST
//         (한국천문연구원 역서 2024 입춘 17시 27분과 일치)
// 외부 검증(astronomy-engine)은 품질검증 담당의 골든 테스트에서만 한다. 엔진은 쓰지 않는다.
import type { SolarTermPoint } from "../types"
import { EngineInputError } from "../types"
import { MAX_YEAR, MIN_YEAR } from "./constants"
import { lunarLib, type LibSolar } from "./lunar-lib"

/** 라이브러리 시각대: 중국 표준시 UTC+8 */
const LIB_OFFSET_MS = 8 * 3_600_000

/** 라이브러리 키(간체자/병음) → 엔진 표기(번체 한자, 한국 역서 표기) */
const NAME_MAP: Record<string, string> = {
  小寒: "小寒", XIAO_HAN: "小寒",
  大寒: "大寒", DA_HAN: "大寒",
  立春: "立春", LI_CHUN: "立春",
  雨水: "雨水", YU_SHUI: "雨水",
  惊蛰: "驚蟄", JING_ZHE: "驚蟄",
  春分: "春分",
  清明: "清明",
  谷雨: "穀雨",
  立夏: "立夏",
  小满: "小滿",
  芒种: "芒種",
  夏至: "夏至",
  小暑: "小暑",
  大暑: "大暑",
  立秋: "立秋",
  处暑: "處暑",
  白露: "白露",
  秋分: "秋分",
  寒露: "寒露",
  霜降: "霜降",
  立冬: "立冬",
  小雪: "小雪",
  大雪: "大雪", DA_XUE: "大雪",
  冬至: "冬至", DONG_ZHI: "冬至",
}

/** 황경 0°(春分)부터가 아니라 小寒부터의 양력 1년 순서 */
export const SOLAR_TERM_NAMES = [
  "小寒", "大寒", "立春", "雨水", "驚蟄", "春分", "清明", "穀雨", "立夏", "小滿", "芒種", "夏至",
  "小暑", "大暑", "立秋", "處暑", "白露", "秋分", "寒露", "霜降", "立冬", "小雪", "大雪", "冬至",
] as const

/**
 * 12절(節) → 월지 번호(寅=0 기준 월 순서). 월주는 직전 節로 정한다.
 * 立春=寅(0) 驚蟄=卯(1) 清明=辰(2) 立夏=巳(3) 芒種=午(4) 小暑=未(5)
 * 立秋=申(6) 白露=酉(7) 寒露=戌(8) 立冬=亥(9) 大雪=子(10) 小寒=丑(11)
 */
export const JIE_MONTH_INDEX: Record<string, number> = {
  立春: 0, 驚蟄: 1, 清明: 2, 立夏: 3, 芒種: 4, 小暑: 5,
  立秋: 6, 白露: 7, 寒露: 8, 立冬: 9, 大雪: 10, 小寒: 11,
}

export interface TermInstant {
  name: string
  utcMs: number
}

/** 라이브러리 Solar(UTC+8 벽시계) → UTC 밀리초 */
export function libSolarToUtcMs(s: LibSolar): number {
  return Date.UTC(s.getYear(), s.getMonth() - 1, s.getDay(), s.getHour(), s.getMinute(), s.getSecond()) - LIB_OFFSET_MS
}

const yearCache = new Map<number, TermInstant[]>()

/**
 * 양력 Y년(UTC 1월 1일 0시 ~ 12월 31일 24시)에 드는 24절기. 범위 검증 없음(내부용, 1899~2101에서 사용).
 * 음력 Y년의 절기표(전년 大雪 ~ 익년 驚蟄)에 양력 Y년 小寒~冬至가 모두 들어 있음을 이용한다.
 */
export function termsOfYear(year: number): TermInstant[] {
  const cached = yearCache.get(year)
  if (cached) return cached
  const table = lunarLib.Lunar.fromYmd(year, 1, 1).getJieQiTable()
  const start = Date.UTC(year, 0, 1)
  const end = Date.UTC(year + 1, 0, 1)
  const seen = new Set<string>()
  const out: TermInstant[] = []
  for (const [key, solar] of Object.entries(table)) {
    const name = NAME_MAP[key]
    if (!name) throw new Error(`lunar-javascript 절기 이름 매핑 없음: ${key}`)
    const utcMs = libSolarToUtcMs(solar)
    if (utcMs < start || utcMs >= end || seen.has(name)) continue
    seen.add(name)
    out.push({ name, utcMs })
  }
  out.sort((a, b) => a.utcMs - b.utcMs)
  if (out.length !== 24) throw new Error(`절기 개수 이상: ${year}년 ${out.length}개`)
  yearCache.set(year, out)
  return out
}

/** 공개 API용: 범위 검증 + ISO 문자열 */
export function solarTermsUtc(year: number): SolarTermPoint[] {
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    throw new EngineInputError(`절기 조회 연도는 ${MIN_YEAR}~${MAX_YEAR} 정수여야 함: ${year}`)
  }
  return termsOfYear(year).map((t) => ({ name: t.name, utc: new Date(t.utcMs).toISOString() }))
}

export function toPoint(t: TermInstant): SolarTermPoint {
  return { name: t.name, utc: new Date(t.utcMs).toISOString() }
}

/** 해당 양력 연도 立春의 UTC 밀리초 */
export function lichunUtcMs(year: number): number {
  const t = termsOfYear(year).find((x) => x.name === "立春")
  if (!t) throw new Error(`立春 없음: ${year}`)
  return t.utcMs
}

/** utcMs 앞뒤 약 1년의 12절(節)만 시간순으로 */
function jieNear(utcMs: number): TermInstant[] {
  const y = new Date(utcMs).getUTCFullYear()
  return [...termsOfYear(y - 1), ...termsOfYear(y), ...termsOfYear(y + 1)].filter((t) => t.name in JIE_MONTH_INDEX)
}

/**
 * 출생 순간 직전 節(prev, prev.utcMs ≤ utcMs)과 다음 節(next, next.utcMs > utcMs).
 * 절입 시각과 정확히 같은 순간은 새 달(절입 후)로 본다.
 */
export function jieAround(utcMs: number): { prev: TermInstant; next: TermInstant } {
  const list = jieNear(utcMs)
  for (let i = 1; i < list.length; i++) {
    if (list[i].utcMs > utcMs && list[i - 1].utcMs <= utcMs) return { prev: list[i - 1], next: list[i] }
  }
  throw new Error("직전·다음 節을 찾지 못함")
}

/** [startMs, endMs) 구간에 드는 12절(節) */
export function jieBetween(startMs: number, endMs: number): TermInstant[] {
  return jieNear(startMs).filter((t) => t.utcMs >= startMs && t.utcMs < endMs)
}
