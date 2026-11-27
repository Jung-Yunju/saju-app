// 시간 보정 (P3-02): 현지 법정시각 → UTC → (옵션) 진태양시
// - UTC 오프셋은 하드코딩하지 않고 Node 내장 Intl(ICU의 IANA tzdb)에서 얻는다.
//   Asia/Seoul 예: 1908-04~1911 UTC+8:30, 1912~ UTC+9, 1954-03-21~1961-08-09 UTC+8:30,
//   서머타임 1948~51(+10), 1955~60(+9:30), 1987~88(+10). (모두 Intl 조회 결과로 확인)
// - 순수 함수. 같은 입력이면 같은 출력(단, Node에 탑재된 tzdb 버전에 의존 — 보고서 참고).
import { EngineInputError } from "../types"
import { MS_PER_DAY, MS_PER_MINUTE, isLeapYear } from "./constants"

export interface WallTime {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second?: number
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone)
  if (!f) {
    try {
      f = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        era: "short",
        timeZoneName: "long",
      })
    } catch {
      throw new EngineInputError(`알 수 없는 시간대(IANA): ${timeZone}`)
    }
    formatterCache.set(timeZone, f)
  }
  return f
}

/** 시간대 이름이 Intl에서 유효한지 확인. 아니면 EngineInputError */
export function assertTimeZone(timeZone: string): void {
  formatterFor(timeZone)
}

function partsAt(utcMs: number, timeZone: string): { localMs: number; zoneName: string } {
  const sec = Math.floor(utcMs / 1000) * 1000 // Intl은 초 단위까지만 표시
  const parts = formatterFor(timeZone).formatToParts(new Date(sec))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
  let year = Number(get("year"))
  if (get("era") === "BC" || get("era") === "B") year = 1 - year
  const localMs = Date.UTC(year, Number(get("month")) - 1, Number(get("day")), Number(get("hour")), Number(get("minute")), Number(get("second")))
  return { localMs: localMs + (utcMs - sec), zoneName: get("timeZoneName") }
}

/** 해당 UTC 순간의 UTC 오프셋(밀리초, 서머타임 포함). Intl 조회값. */
export function zoneOffsetMs(utcMs: number, timeZone: string): number {
  return partsAt(utcMs, timeZone).localMs - utcMs
}

/**
 * 서머타임 여부.
 * 1) Intl 긴 이름에 "Daylight"/"Summer"가 있으면 true, "Standard"면 false (현대 구간).
 * 2) 이름이 "GMT+10:00"처럼 오프셋만 나오는 과거 구간(예: 서울 1948~60)은
 *    "앞뒤 약 반년 시점의 오프셋보다 모두 크면 서머타임"으로 판정한다.
 *    (표준시 자체가 바뀐 1954·1961 서울 변경은 한쪽만 다르므로 서머타임으로 보지 않는다.)
 */
export function isDaylightSaving(utcMs: number, timeZone: string): boolean {
  const { localMs, zoneName } = partsAt(utcMs, timeZone)
  if (/Daylight|Summer/i.test(zoneName)) return true
  if (/Standard/i.test(zoneName)) return false
  const off = localMs - utcMs
  const half = 183 * MS_PER_DAY
  return off > zoneOffsetMs(utcMs - half, timeZone) && off > zoneOffsetMs(utcMs + half, timeZone)
}

export type LocalResolution = "unique" | "gap" | "overlap"

export interface LocalToUtcResult {
  utcMs: number
  /** 그 순간의 실제 UTC 오프셋(분). 서울 LMT 시기(1908-04 이전)는 507.866…(=8:27:52)처럼 정수가 아닐 수 있다 */
  offsetMinutes: number
  dst: boolean
  resolution: LocalResolution
  warnings: string[]
}

function fmtOffset(ms: number): string {
  const sign = ms < 0 ? "−" : "+"
  const totalSec = Math.round(Math.abs(ms) / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `UTC${sign}${h}:${String(m).padStart(2, "0")}${s ? ":" + String(s).padStart(2, "0") : ""}`
}

function fmtWall(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`
}

/**
 * 현지 법정시각(벽시계) → UTC.
 *
 * 서머타임·표준시 변경으로 생기는 특이 시각 처리 규칙
 * (TC39 Temporal의 disambiguation "compatible", RFC 5545 iCalendar 3.3.5와 같은 규칙):
 * - 겹침(overlap, 같은 벽시계 시각이 두 번): **앞선 순간**(전환 전 오프셋, 보통 서머타임 쪽)을 택한다.
 * - 공백(gap, 존재하지 않는 벽시계 시각): **전환 전 오프셋**으로 해석한다
 *   → 결과 순간은 공백 길이만큼 뒤의 벽시계 시각(예: 1987-05-10 02:30 → 서머타임 03:30)과 같다.
 * 두 경우 모두 warnings에 기록한다.
 */
export function localToUtc(wall: WallTime, timeZone: string): LocalToUtcResult {
  const W = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second ?? 0)
  // 하루 앞·뒤·당일의 오프셋 후보 (전환은 48시간 안에 두 번 일어나지 않는다고 가정)
  const candidates = new Set<number>([
    zoneOffsetMs(W - MS_PER_DAY, timeZone),
    zoneOffsetMs(W, timeZone),
    zoneOffsetMs(W + MS_PER_DAY, timeZone),
  ])
  const solutions: number[] = []
  for (const off of candidates) {
    const u = W - off
    if (zoneOffsetMs(u, timeZone) === off) solutions.push(u)
  }
  solutions.sort((a, b) => a - b)
  const warnings: string[] = []
  let utcMs: number
  let resolution: LocalResolution
  if (solutions.length === 1) {
    utcMs = solutions[0]
    resolution = "unique"
  } else if (solutions.length >= 2) {
    utcMs = solutions[0]
    resolution = "overlap"
    const later = solutions[solutions.length - 1]
    warnings.push(
      `시간대 전환(서머타임 종료 등)으로 같은 현지시각이 두 번 있음 — 앞선 시각(${fmtOffset(zoneOffsetMs(utcMs, timeZone))})으로 계산함. ` +
        `뒤의 시각(${fmtOffset(zoneOffsetMs(later, timeZone))})이면 실제 출생 순간이 ${Math.round((later - utcMs) / MS_PER_MINUTE)}분 늦음`,
    )
  } else {
    const before = zoneOffsetMs(W - MS_PER_DAY, timeZone)
    utcMs = W - before
    resolution = "gap"
    const after = zoneOffsetMs(utcMs, timeZone)
    warnings.push(
      `시간대 전환(서머타임 시작 등)으로 존재하지 않는 현지시각 — 전환 전 오프셋(${fmtOffset(before)})으로 해석함. ` +
        `전환 후 시각으로는 ${fmtWall(utcMs + after)}(${fmtOffset(after)})`,
    )
  }
  const offMs = zoneOffsetMs(utcMs, timeZone)
  if (offMs % MS_PER_MINUTE !== 0) {
    warnings.push(`표준시 제정 전 시기 — 지방평균시(LMT, ${fmtOffset(offMs)}) 기준으로 계산함`)
  }
  return {
    utcMs,
    offsetMinutes: offMs / MS_PER_MINUTE,
    dst: isDaylightSaving(utcMs, timeZone),
    resolution,
    warnings,
  }
}

/**
 * 균시차(진태양시 − 평균태양시, 분).
 * 출처: Spencer, J.W. (1971) "Fourier series representation of the position of the sun", Search 2(5):172.
 *       NOAA Global Monitoring Laboratory "General Solar Position Calculations"의 같은 식
 *       EoT = 229.18 × (0.000075 + 0.001868cosγ − 0.032077sinγ − 0.014615cos2γ − 0.040849sin2γ),
 *       γ = 2π/(연 일수) × (연중일 − 1 + (UTC시 − 12)/24).
 * 정밀도: 약 ±0.5분 이내(근사식). 대략 2월 중순 −14분, 11월 초 +16분.
 */
export function equationOfTimeMinutes(utcMs: number): number {
  const d = new Date(utcMs)
  const y = d.getUTCFullYear()
  const doy = Math.floor((utcMs - Date.UTC(y, 0, 1)) / MS_PER_DAY) + 1
  const hours = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600
  const g = ((2 * Math.PI) / (isLeapYear(y) ? 366 : 365)) * (doy - 1 + (hours - 12) / 24)
  return (
    229.18 *
    (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g))
  )
}

/**
 * 법정시 → 진태양시 보정량(분).
 * 지방평균태양시 = UTC + 경도×4분 이므로 보정량 = 경도×4 − UTC오프셋(분) [+ 균시차].
 * 예: 서울(126.978°E) 평상시 507.912 − 540 = −32.09분, 1987년 여름(+10) −92.09분.
 */
export function solarTimeCorrectionMinutes(
  utcMs: number,
  offsetMinutes: number,
  longitude: number,
  withEquationOfTime: boolean,
): number {
  const lmt = longitude * 4 - offsetMinutes
  return withEquationOfTime ? lmt + equationOfTimeMinutes(utcMs) : lmt
}

/** 밀리초 시각을 '벽시계'(UTC getter로 읽는 이동된 시각)로 분해 */
export function wallOf(shiftedMs: number): Required<WallTime> & { minutesOfDay: number } {
  const d = new Date(shiftedMs)
  const minutesOfDay = (shiftedMs - Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) / MS_PER_MINUTE
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
    minutesOfDay,
  }
}
