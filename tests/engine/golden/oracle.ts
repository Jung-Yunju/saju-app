// 만세력 골든 테스트 — 독립 오라클 (P3-04, qa-security-lead)
//
// 원칙: 이 파일은 제품 엔진(src/engine/**)의 구현 코드를 전혀 참조하지 않는다.
//   - 천문 계산: astronomy-engine 2.1.19 (엔진이 쓰는 lunar-javascript와 독립)
//   - 시간대: Node 내장 Intl(ICU, IANA tzdb) — 엔진 구현과 무관한 표준 런타임 데이터
//   - 간지·일주: 공개 공식(JDN)과 五虎遁·五鼠遁 표를 직접 구현
// 스크립트(scripts/qa/*.mjs)에서도 Node 타입 제거(type stripping)로 직접 import 하므로
// enum·parameter property 같은 "지울 수 없는" TS 문법은 쓰지 않는다.

import { Body, Equator, MakeTime, Observer, SearchMoonPhase, SearchSunLongitude, SiderealTime } from "astronomy-engine"

export const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const
export const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const

export interface OPillar {
  stem: string
  branch: string
}

const DAY_MS = 86_400_000
const MIN_MS = 60_000

// ───────────────────────── 간지 ─────────────────────────

/** 60갑자 index(0=甲子) → 간지 */
export function sexagenary(index: number): OPillar {
  const i = ((index % 60) + 60) % 60
  return { stem: STEMS[i % 10], branch: BRANCHES[i % 12] }
}

/** 간지 → 60갑자 index. 음양이 맞지 않는 조합이면 -1 */
export function sexagenaryIndex(p: OPillar): number {
  const s = STEMS.indexOf(p.stem as (typeof STEMS)[number])
  const b = BRANCHES.indexOf(p.branch as (typeof BRANCHES)[number])
  if (s < 0 || b < 0) return -1
  for (let i = 0; i < 60; i++) if (i % 10 === s && i % 12 === b) return i
  return -1
}

/** 그레고리력 날짜의 율리우스 일수(JDN, 정오 기준 정수). Fliegel–Van Flandern 공식 */
export function jdn(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12)
  const yy = y + 4800 - a
  const mm = m + 12 * a - 3
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045
}

/** 일주: 60갑자 index = (JDN + 49) mod 60 */
export function dayPillarOracle(y: number, m: number, d: number): OPillar {
  return sexagenary(jdn(y, m, d) + 49)
}

/** 입춘 기준 간지 연도 Y의 연주 */
export function yearPillarOracle(sajuYear: number): OPillar {
  return sexagenary(sajuYear - 4) // 1984 = 甲子
}

/** 五虎遁: 연간 → 寅月 천간. monthIdx 0=寅 … 11=丑 */
export function monthPillarOracle(yearStem: string, monthIdx: number): OPillar {
  const ys = STEMS.indexOf(yearStem as (typeof STEMS)[number])
  // 甲己→丙寅, 乙庚→戊寅, 丙辛→庚寅, 丁壬→壬寅, 戊癸→甲寅
  const stem = (((ys % 5) * 2 + 2 + monthIdx) % 10 + 10) % 10
  const branch = (2 + monthIdx) % 12
  return { stem: STEMS[stem], branch: BRANCHES[branch] }
}

/** 五鼠遁: 일간 → 시주. hourBranchIdx 0=子 … 11=亥 */
export function hourPillarOracle(dayStem: string, hourBranchIdx: number): OPillar {
  const ds = STEMS.indexOf(dayStem as (typeof STEMS)[number])
  // 甲己→甲子, 乙庚→丙子, 丙辛→戊子, 丁壬→庚子, 戊癸→壬子
  const stem = ((ds % 5) * 2 + hourBranchIdx) % 10
  return { stem: STEMS[stem], branch: BRANCHES[hourBranchIdx] }
}

/** 시각(시·분, 0~23시) → 시지 index. 23:00~00:59=子, 01:00~02:59=丑 … */
export function hourBranchIndex(hour: number, minute: number): number {
  const mins = hour * 60 + minute
  return Math.floor(((mins + 60) % 1440) / 120)
}

export const YANG_STEMS = new Set(["甲", "丙", "戊", "庚", "壬"])

// ───────────────────────── 절기 ─────────────────────────

/**
 * 태양 시황경 → 절기 한자명(한국 정자 표기).
 * 0°=春分 기준 15° 간격. 節(월 경계)은 315°=立春부터 30° 간격 12개.
 */
export const TERM_NAME_BY_LONGITUDE: Record<number, string> = {
  0: "春分", 15: "清明", 30: "穀雨", 45: "立夏", 60: "小滿", 75: "芒種",
  90: "夏至", 105: "小暑", 120: "大暑", 135: "立秋", 150: "處暑", 165: "白露",
  180: "秋分", 195: "寒露", 210: "霜降", 225: "立冬", 240: "小雪", 255: "大雪",
  270: "冬至", 285: "小寒", 300: "大寒", 315: "立春", 330: "雨水", 345: "驚蟄",
}

/** 12節: 황경 → 월지 index(0=寅月 … 11=丑月) */
export const JIE_LONGITUDES = [315, 345, 15, 45, 75, 105, 135, 165, 195, 225, 255, 285] as const

export interface OTerm {
  longitude: number
  name: string
  /** UTC epoch ms */
  ms: number
  isJie: boolean
  /** 節이면 월지 index(0=寅), 아니면 -1 */
  monthIdx: number
}

const termCache = new Map<number, OTerm[]>()

/** 양력 연도 year의 UTC 1/1 00:00 ~ 다음 해 1/1 00:00 사이 24절기 (시간순) */
export function solarTermsOracle(year: number): OTerm[] {
  const hit = termCache.get(year)
  if (hit) return hit
  const start = new Date(Date.UTC(year, 0, 1))
  start.setUTCFullYear(year) // 100년 미만 연도 보호(사용하지 않지만 안전)
  const end = Date.UTC(year + 1, 0, 1)
  const out: OTerm[] = []
  for (let k = 0; k < 24; k++) {
    const lon = k * 15
    // 연초부터 1년 안에서 찾는다. 같은 황경이 한 해에 두 번 올 수는 없다.
    const t = SearchSunLongitude(lon, start, 366)
    if (!t) throw new Error(`oracle: sun longitude ${lon} not found in ${year}`)
    const ms = t.date.getTime()
    if (ms >= end) throw new Error(`oracle: sun longitude ${lon} out of year ${year}`)
    const jieIdx = (JIE_LONGITUDES as readonly number[]).indexOf(lon)
    out.push({ longitude: lon, name: TERM_NAME_BY_LONGITUDE[lon], ms, isJie: jieIdx >= 0, monthIdx: jieIdx })
  }
  out.sort((a, b) => a.ms - b.ms)
  termCache.set(year, out)
  return out
}

/** UTC 순간 기준 직전 節과 다음 節 */
export function surroundingJie(ms: number): { prev: OTerm; next: OTerm } {
  const y = new Date(ms).getUTCFullYear()
  const all = [...solarTermsOracle(y - 1), ...solarTermsOracle(y), ...solarTermsOracle(y + 1)].filter((t) => t.isJie)
  let prev: OTerm | null = null
  let next: OTerm | null = null
  for (const t of all) {
    if (t.ms <= ms) prev = t
    else if (!next) next = t
  }
  if (!prev || !next) throw new Error("oracle: surrounding jie not found")
  return { prev, next }
}

/** UTC 순간의 연주(立春 기준)·월주(12節 기준) */
export function yearMonthPillarsOracle(ms: number): { sajuYear: number; year: OPillar; month: OPillar; prev: OTerm; next: OTerm } {
  const { prev, next } = surroundingJie(ms)
  const gYear = new Date(ms).getUTCFullYear()
  const lichun = solarTermsOracle(gYear).find((t) => t.longitude === 315)!
  const sajuYear = ms >= lichun.ms ? gYear : gYear - 1
  const year = yearPillarOracle(sajuYear)
  const month = monthPillarOracle(year.stem, prev.monthIdx)
  return { sajuYear, year, month, prev, next }
}

// ───────────────────────── 시간대 ─────────────────────────

const offsetFmtCache = new Map<string, Intl.DateTimeFormat>()
const partsFmtCache = new Map<string, Intl.DateTimeFormat>()

/** UTC 순간의 해당 시간대 UTC 오프셋(분). LMT처럼 초 단위 오프셋은 소수 분으로 */
export function utcOffsetMinutesAt(ms: number, timeZone: string): number {
  let f = offsetFmtCache.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    offsetFmtCache.set(timeZone, f)
  }
  const v = f.formatToParts(new Date(ms)).find((p) => p.type === "timeZoneName")!.value // "GMT+08:30" / "GMT"
  const m = /^GMT(?:([+-])(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(v)
  if (!m) throw new Error(`oracle: unexpected offset format ${v}`)
  if (!m[1]) return 0
  const sign = m[1] === "-" ? -1 : 1
  return sign * (Number(m[2]) * 60 + Number(m[3]) + Number(m[4] ?? 0) / 60)
}

export interface LocalDateTime {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

/** UTC 순간 → 해당 시간대 벽시계 시각 (Intl) */
export function utcToLocal(ms: number, timeZone: string): LocalDateTime {
  let f = partsFmtCache.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    })
    partsFmtCache.set(timeZone, f)
  }
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]))
  return {
    year: Number(p.year), month: Number(p.month), day: Number(p.day),
    hour: Number(p.hour), minute: Number(p.minute), second: Number(p.second),
  }
}

/**
 * 벽시계 시각 → UTC 순간 후보 전부.
 * 0개 = 존재하지 않는 시각(서머타임 시작 공백), 2개 = 모호한 시각(서머타임 종료 중복).
 */
export function localToUtcCandidates(l: Omit<LocalDateTime, "second"> & { second?: number }, timeZone: string): number[] {
  const wall = Date.UTC(l.year, l.month - 1, l.day, l.hour, l.minute, l.second ?? 0)
  const found = new Set<number>()
  // 주변 ±2일의 오프셋 후보를 모아 하나씩 검산
  const offsets = new Set<number>()
  for (let h = -48; h <= 48; h += 1) offsets.add(utcOffsetMinutesAt(wall + h * 3_600_000, timeZone))
  for (const off of offsets) {
    const utc = Math.round(wall - off * MIN_MS)
    if (Math.abs(utcOffsetMinutesAt(utc, timeZone) - off) < 1e-9) found.add(utc)
  }
  return [...found].sort((a, b) => a - b)
}

/** 모호하지 않은 벽시계 시각 → UTC. 모호/공백이면 null */
export function localToUtcUnique(l: Omit<LocalDateTime, "second">, timeZone: string): number | null {
  const c = localToUtcCandidates(l, timeZone)
  return c.length === 1 ? c[0] : null
}

// ───────────────────────── 음력(한국) ─────────────────────────
//
// 현대 동아시아 태음태양력 규칙(定氣法):
//  1) 각 달의 1일 = 합삭(신월)이 든 날(해당 표준시 기준 날짜)
//  2) 冬至가 든 달 = 11월
//  3) 冬至~다음 冬至 사이(歲)에 달이 13개면, 中氣(황경 30°의 배수)가 없는 첫 달을 윤달로 둔다
// 한국 음력은 UTC+9(동경 135°), 중국 농력은 UTC+8(동경 120°) 기준 날짜를 쓴다.
// 범위 주의: 한국 1954~1961 표준시(UTC+8:30) 시기 KASI 음력의 기준 자오선은 확인하지 못했으므로
//           이 오라클은 2000~2030 검증용으로만 쓴다.

export interface OLunarMonth {
  lunarYear: number
  month: number
  isLeap: boolean
  /** 1일의 일련번호(UTC 1970-01-01 = 0 기준의 '현지 날짜' 일수) */
  startDay: number
  length: number
}

function localDayNumber(ms: number, offsetMinutes: number): number {
  return Math.floor((ms + offsetMinutes * MIN_MS) / DAY_MS)
}

export function dayNumberToDate(n: number): { year: number; month: number; day: number } {
  const d = new Date(n * DAY_MS)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

export function dateToDayNumber(y: number, m: number, d: number): number {
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS)
}

const lunarCache = new Map<string, OLunarMonth[]>()

/** fromYear 동지 직전 ~ toYear 말까지의 음력 달 목록 */
export function lunarMonthsOracle(fromYear: number, toYear: number, offsetMinutes = 540): OLunarMonth[] {
  const key = `${fromYear}:${toYear}:${offsetMinutes}`
  const hit = lunarCache.get(key)
  if (hit) return hit

  // 신월 목록 (현지 날짜 일련번호)
  const newMoons: number[] = []
  let t = new Date(Date.UTC(fromYear - 1, 9, 1))
  const stop = Date.UTC(toYear + 2, 1, 1)
  while (t.getTime() < stop) {
    const nm = SearchMoonPhase(0, t, 40)
    if (!nm) throw new Error("oracle: new moon not found")
    newMoons.push(localDayNumber(nm.date.getTime(), offsetMinutes))
    t = new Date(nm.date.getTime() + 5 * DAY_MS)
  }
  // 中氣(황경 30°의 배수) 현지 날짜 일련번호
  const zhongqi: { lon: number; day: number }[] = []
  for (let y = fromYear - 1; y <= toYear + 1; y++) {
    for (const term of solarTermsOracle(y)) {
      if (term.longitude % 30 === 0) zhongqi.push({ lon: term.longitude, day: localDayNumber(term.ms, offsetMinutes) })
    }
  }
  const winterSolstices = zhongqi.filter((z) => z.lon === 270).map((z) => z.day)

  // 달 구간 [start, end)
  const spans = newMoons.slice(0, -1).map((s, i) => ({ start: s, end: newMoons[i + 1] }))
  const monthIndexOf = (day: number) => spans.findIndex((sp) => sp.start <= day && day < sp.end)
  const hasZhongqi = (i: number) => zhongqi.some((z) => spans[i].start <= z.day && z.day < spans[i].end)

  const out: OLunarMonth[] = []
  for (let w = 0; w + 1 < winterSolstices.length; w++) {
    const a = monthIndexOf(winterSolstices[w]) // 11월
    const b = monthIndexOf(winterSolstices[w + 1]) // 다음 11월
    if (a < 0 || b < 0) continue
    const count = b - a
    let leapUsed = count === 12 // 12개면 윤달 없음
    let num = 11
    // 歲의 11월이 속한 음력 연도 = 冬至가 든 양력 연도 (冬至는 항상 12월)
    const ws = dayNumberToDate(winterSolstices[w])
    if (ws.month !== 12) throw new Error("oracle: unexpected winter solstice")
    let lunarYear = ws.year
    for (let i = a; i < b; i++) {
      let isLeap = false
      if (i > a) {
        if (!leapUsed && !hasZhongqi(i)) {
          isLeap = true
          leapUsed = true
        } else {
          num = num === 12 ? 1 : num + 1
          if (num === 1) lunarYear += 1
        }
      }
      out.push({ lunarYear, month: num, isLeap, startDay: spans[i].start, length: spans[i].end - spans[i].start })
    }
  }
  lunarCache.set(key, out)
  return out
}

/** 음력 → 양력. 존재하지 않으면 null */
export function lunarToSolarOracle(
  lunarYear: number, month: number, day: number, isLeap: boolean, offsetMinutes = 540,
): { year: number; month: number; day: number } | null {
  const months = lunarMonthsOracle(lunarYear - 1, lunarYear + 1, offsetMinutes)
  const lm = months.find((x) => x.lunarYear === lunarYear && x.month === month && x.isLeap === isLeap)
  if (!lm || day < 1 || day > lm.length) return null
  return dayNumberToDate(lm.startDay + day - 1)
}

// ───────────────────────── 균시차 ─────────────────────────

/**
 * 균시차(분) = 진태양시 − 평균태양시. astronomy-engine의 태양 시적경(겉보기)과 그리니치 시항성시로 계산.
 * 예: 2월 중순 약 −14분, 11월 초 약 +16분.
 */
export function equationOfTimeMinutes(ms: number): number {
  const t = MakeTime(new Date(ms))
  const eq = Equator(Body.Sun, t, new Observer(0, 0, 0), true, true)
  const gast = SiderealTime(t) // 시간
  const apparentSolar = gast - eq.ra + 12 // 그리니치 진태양시(시간)
  const mean = (((ms / 3_600_000) % 24) + 24) % 24
  let e = apparentSolar - mean
  e = ((e % 24) + 36) % 24 - 12
  return e * 60
}

// ───────────────────────── 재현 가능한 난수 ─────────────────────────

/** mulberry32 — 고정 시드 PRNG */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randInt(r: () => number, lo: number, hiInclusive: number): number {
  return lo + Math.floor(r() * (hiInclusive - lo + 1))
}

export const isoToMs = (iso: string) => new Date(iso).getTime()
export const MINUTE_MS = MIN_MS
export const DAY_MS_CONST = DAY_MS
