// 역법 계산 공통 상수·간지 산술 (P3-03)
// 해석을 담지 않는 순수 산술만 둔다.
import type { Branch, Pillar, Stem } from "../types"

/** 역법 엔진 버전. 계산 결과가 바뀌는 수정이면 올리고 CHANGELOG에 기록한다. */
export const CALENDAR_ENGINE_VERSION = "calendar@0.1.0"

export const STEMS: readonly Stem[] = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"]
export const BRANCHES: readonly Branch[] = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]

/** 입력 허용 범위(양력 연도). 절기 라이브러리 검증 범위와 골든 테스트 범위에 맞춘다. */
export const MIN_YEAR = 1900
export const MAX_YEAR = 2100

export const MS_PER_MINUTE = 60_000
export const MS_PER_DAY = 86_400_000

/** 음수에도 0..n-1을 돌려주는 나머지 */
export function mod(a: number, n: number): number {
  return ((a % n) + n) % n
}

/** 60갑자 번호(甲子=0 … 癸亥=59) → 간지 */
export function sexagenary(index: number): Pillar {
  const i = mod(index, 60)
  return { stem: STEMS[i % 10], branch: BRANCHES[i % 12] }
}

/** 간지 → 60갑자 번호. 천간·지지 음양이 맞지 않으면 오류 */
export function sexagenaryIndex(p: Pillar): number {
  const s = STEMS.indexOf(p.stem)
  const b = BRANCHES.indexOf(p.branch)
  if (s < 0 || b < 0 || s % 2 !== b % 2) throw new Error(`invalid pillar ${p.stem}${p.branch}`)
  // 중국인의 나머지 정리: i ≡ s (mod 10), i ≡ b (mod 12)
  for (let i = s; i < 60; i += 10) if (i % 12 === b) return i
  throw new Error("unreachable")
}

export function stemIndex(stem: Stem): number {
  return STEMS.indexOf(stem)
}

/** 양간(甲丙戊庚壬) 여부 */
export function isYangStem(stem: Stem): boolean {
  return STEMS.indexOf(stem) % 2 === 0
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

export function daysInMonth(y: number, m: number): number {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
}

/**
 * 그레고리력 날짜 → 율리우스일수(JDN, 정오 기준 정수).
 * 출처: Fliegel & Van Flandern (1968), Communications of the ACM 11(10):657 의 정수 공식.
 * 검산: 2000-01-01 = 2451545, 1900-01-01 = 2415021.
 */
export function julianDayNumber(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12)
  const yy = y + 4800 - a
  const mm = m + 12 * a - 3
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045
}
