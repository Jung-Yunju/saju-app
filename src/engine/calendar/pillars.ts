// 원국(연·월·일·시주) 계산 (P3-03)
// 모든 경계 판정은 '출생 UTC 순간'(연·월주) 또는 '보정된 현지 벽시계'(일·시주)로 한다.
import type { Pillar, Stem } from "../types"
import { EngineInputError } from "../types"
import { julianDayNumber, mod, sexagenary, stemIndex } from "./constants"
import { JIE_MONTH_INDEX, jieAround, lichunUtcMs, type TermInstant } from "./solarterms"

/**
 * 간지 연도(입춘~다음 입춘)의 연주. 1984 = 甲子 기준: 번호 = (Y − 4) mod 60.
 * 검산: 2024 → 40 = 甲辰, 2000 → 16 = 庚辰.
 */
export function yearPillarOfGanzhiYear(year: number): Pillar {
  if (!Number.isInteger(year)) throw new EngineInputError(`연도는 정수여야 함: ${year}`)
  return sexagenary(year - 4)
}

/** 출생 UTC 순간의 간지 연도: 그 해 立春(UTC) 이전이면 전년 */
export function ganzhiYearAt(utcMs: number): number {
  const y = new Date(utcMs).getUTCFullYear()
  return utcMs >= lichunUtcMs(y) ? y : y - 1
}

/**
 * 월주: 직전 節로 월지, 연간 기준 五虎遁(甲己→丙寅, 乙庚→戊寅, 丙辛→庚寅, 丁壬→壬寅, 戊癸→甲寅)으로 월간.
 * 寅월 천간 = (연간번호 mod 5)×2 + 2, 이후 달마다 +1.
 */
export function monthPillarAt(utcMs: number, yearStem: Stem): { pillar: Pillar; prev: TermInstant; next: TermInstant } {
  const { prev, next } = jieAround(utcMs)
  const monthIdx = JIE_MONTH_INDEX[prev.name] // 寅=0 … 丑=11
  const stem = mod((stemIndex(yearStem) % 5) * 2 + 2 + monthIdx, 10)
  const branch = mod(monthIdx + 2, 12) // 子=0 기준으로 寅=2
  // stem·branch 음양은 항상 일치(寅=2 짝수, 丙/戊/庚/壬/甲 짝수)
  return { pillar: sexagenaryFromParts(stem, branch), prev, next }
}

function sexagenaryFromParts(stem: number, branch: number): Pillar {
  for (let i = stem; i < 60; i += 10) if (i % 12 === branch) return sexagenary(i)
  throw new Error("천간·지지 음양 불일치")
}

/**
 * 양력 날짜의 일주(자정 기준). 번호 = (JDN − 11) mod 60.
 * 검산(공개 만세력 기준): 2000-01-01 JDN 2451545 → 54 = 戊午, 1900-01-01 JDN 2415021 → 10 = 甲戌.
 */
export function dayPillarOfDate(y: number, m: number, d: number): Pillar {
  return sexagenary(julianDayNumber(y, m, d) - 11)
}

/** 날짜 + n일 */
export function addDays(y: number, m: number, d: number, n: number): { year: number; month: number; day: number } {
  const t = new Date(Date.UTC(y, m - 1, d) + n * 86_400_000)
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() }
}

/**
 * 시지 번호(子=0 … 亥=11): 23:00~00:59 子, 01:00~02:59 丑, …, 21:00~22:59 亥.
 * minutesOfDay: 보정된 현지 벽시계의 0시부터 분(소수 가능).
 */
export function hourBranchIndex(minutesOfDay: number): number {
  return mod(Math.floor((minutesOfDay + 60) / 120), 12)
}

/** 시주: 일간 기준 五鼠遁(甲己→甲子, 乙庚→丙子, 丙辛→戊子, 丁壬→庚子, 戊癸→壬子) */
export function hourPillarOf(branchIdx: number, dayStemForHour: Stem): Pillar {
  const stem = mod((stemIndex(dayStemForHour) % 5) * 2 + branchIdx, 10)
  return sexagenaryFromParts(stem, branchIdx)
}

/** 가장 가까운 시지 경계(홀수 정시: 1,3,…,23시)까지의 거리(분, 절댓값) */
export function minutesToHourBoundary(minutesOfDay: number): { distance: number; boundaryMinutes: number } {
  const k = Math.round((minutesOfDay - 60) / 120)
  const boundary = 60 + 120 * k // …, -60(전날 23시), 60, 180, …, 1380, 1500(다음날 1시)
  return { distance: Math.abs(minutesOfDay - boundary), boundaryMinutes: mod(boundary, 1440) }
}
