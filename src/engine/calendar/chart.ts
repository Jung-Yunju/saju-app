// computeChart 본체 (P3-02·P3-03·P3-07) — 입력 → 원국·절기·대운 (역법 객관값)
// 순수 함수: DB·네트워크·AI 호출 없음. 같은 입력·옵션·tzdb면 같은 결과.
import type { BirthInput, CalendarResult, EngineOptions, Pillar } from "../types"
import { DEFAULT_OPTIONS, EngineInputError } from "../types"
import { BRANCHES, CALENDAR_ENGINE_VERSION, MS_PER_MINUTE } from "./constants"
import { assertSolarDate, lunarToSolar, lunarToSolarRisk, solarToLunar, solarToLunarRisk } from "./lunar"
import { computeLuck } from "./luck"
import {
  addDays,
  dayPillarOfDate,
  ganzhiYearAt,
  hourBranchIndex,
  hourPillarOf,
  minutesToHourBoundary,
  monthPillarAt,
  yearPillarOfGanzhiYear,
} from "./pillars"
import { jieBetween, toPoint } from "./solarterms"
import { assertTimeZone, localToUtc, solarTimeCorrectionMinutes, wallOf } from "./time"

export const DEFAULT_TIMEZONE = "Asia/Seoul"
/** 절입 경계 경고 폭 */
const TERM_WARN_MS = 2 * 60 * MS_PER_MINUTE
/** 시지 경계 경고 폭(분) */
const HOUR_WARN_MIN = 15

function resolveOptions(options?: Partial<EngineOptions>): EngineOptions {
  const o: EngineOptions = { ...DEFAULT_OPTIONS }
  if (options) {
    for (const k of Object.keys(DEFAULT_OPTIONS) as (keyof EngineOptions)[]) {
      if (options[k] !== undefined) (o as unknown as Record<string, unknown>)[k] = options[k]
    }
  }
  if (o.ziHour !== "nextDay" && o.ziHour !== "yajasi") throw new EngineInputError(`ziHour 옵션 값 오류: ${String(o.ziHour)}`)
  if (o.luckRounding !== "round" && o.luckRounding !== "floor") {
    throw new EngineInputError(`luckRounding 옵션 값 오류: ${String(o.luckRounding)}`)
  }
  if (typeof o.trueSolarTime !== "boolean") throw new EngineInputError("trueSolarTime 옵션은 boolean")
  if (typeof o.equationOfTime !== "boolean") throw new EngineInputError("equationOfTime 옵션은 boolean")
  assertLongitude(o.defaultLongitude, "defaultLongitude")
  return o
}

function assertLongitude(v: unknown, name: string): void {
  if (typeof v !== "number" || !Number.isFinite(v) || v < -180 || v > 180) {
    throw new EngineInputError(`${name}는 −180~180 사이 숫자여야 함: ${String(v)}`)
  }
}

function validateInput(input: BirthInput): void {
  if (!input || typeof input !== "object") throw new EngineInputError("입력이 없음")
  if (input.calendar !== "solar" && input.calendar !== "lunar") throw new EngineInputError(`calendar 값 오류: ${String(input.calendar)}`)
  if (input.gender !== "M" && input.gender !== "F") throw new EngineInputError(`gender 값 오류: ${String(input.gender)}`)
  if (input.time !== null) {
    if (!input.time || typeof input.time !== "object") throw new EngineInputError("time은 {hour, minute} 또는 null")
    const { hour, minute } = input.time
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new EngineInputError(`시(hour)는 0~23 정수: ${String(hour)}`)
    if (!Number.isInteger(minute) || minute < 0 || minute > 59) throw new EngineInputError(`분(minute)은 0~59 정수: ${String(minute)}`)
  }
  if (input.longitude !== undefined) assertLongitude(input.longitude, "longitude")
  if (input.timezone !== undefined && typeof input.timezone !== "string") throw new EngineInputError("timezone은 IANA 문자열")
}

function fmtMinutes(m: number): string {
  const sign = m < 0 ? "−" : "+"
  return `${sign}${Math.abs(m).toFixed(1)}분`
}

function fmtLocal(utcMs: number, offsetMinutes: number): string {
  const w = wallOf(utcMs + offsetMinutes * MS_PER_MINUTE)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${w.year}-${p(w.month)}-${p(w.day)} ${p(w.hour)}:${p(w.minute)}`
}

export function computeChartImpl(input: BirthInput, options?: Partial<EngineOptions>): CalendarResult {
  const opts = resolveOptions(options)
  validateInput(input)
  const timezone = input.timezone ?? DEFAULT_TIMEZONE
  assertTimeZone(timezone)
  const warnings: string[] = []

  // 1) 양력 날짜(현지 법정시 기준)
  let solarDate: { year: number; month: number; day: number }
  if (input.calendar === "lunar") {
    solarDate = lunarToSolar(input.year, input.month, input.day, input.isLeapMonth === true)
  } else {
    if (input.isLeapMonth) throw new EngineInputError("양력 입력에는 isLeapMonth를 쓸 수 없음")
    solarDate = { year: input.year, month: input.month, day: input.day }
  }
  assertSolarDate(solarDate.year, solarDate.month, solarDate.day)

  // 2) 출생 순간(UTC). 시각 모름이면 현지 법정시 정오 가정
  const hourKnown = input.time !== null
  const wallHour = hourKnown ? input.time!.hour : 12
  const wallMinute = hourKnown ? input.time!.minute : 0
  const local = localToUtc({ ...solarDate, hour: wallHour, minute: wallMinute }, timezone)
  warnings.push(...local.warnings)
  const utcMs = local.utcMs

  // 3) 진태양시 보정
  const longitude = input.longitude ?? opts.defaultLongitude
  const solarTimeMinutes = opts.trueSolarTime
    ? solarTimeCorrectionMinutes(utcMs, local.offsetMinutes, longitude, opts.equationOfTime)
    : 0
  const legalWall = wallOf(utcMs + local.offsetMinutes * MS_PER_MINUTE)
  const corrected = wallOf(utcMs + (local.offsetMinutes + solarTimeMinutes) * MS_PER_MINUTE)

  // 4) 연주·월주: UTC 순간과 절입 UTC 비교 (진태양시 무관)
  const ganzhiYear = ganzhiYearAt(utcMs)
  const yearPillar = yearPillarOfGanzhiYear(ganzhiYear)
  const month = monthPillarAt(utcMs, yearPillar.stem)

  // 5) 일주·시주
  let dayPillar: Pillar
  let hourPillar: Pillar | null = null
  if (!hourKnown) {
    dayPillar = dayPillarOfDate(solarDate.year, solarDate.month, solarDate.day)
  } else {
    const isLateZi = corrected.hour >= 23
    const baseDate = { year: corrected.year, month: corrected.month, day: corrected.day }
    const next = addDays(baseDate.year, baseDate.month, baseDate.day, 1)
    const dayDate = opts.ziHour === "nextDay" && isLateZi ? next : baseDate
    dayPillar = dayPillarOfDate(dayDate.year, dayDate.month, dayDate.day)
    // 시간(時干) 기준 일간: 23시대는 두 옵션 모두 '다음 날 일간'(nextDay는 이미 다음 날 일주)
    const stemSource = isLateZi ? dayPillarOfDate(next.year, next.month, next.day) : dayPillar
    const bIdx = hourBranchIndex(corrected.minutesOfDay)
    hourPillar = hourPillarOf(bIdx, stemSource.stem)

    // 경계 경고(보정 후 시각 기준)
    const hb = minutesToHourBoundary(corrected.minutesOfDay)
    if (hb.distance <= HOUR_WARN_MIN) {
      const dayToo = hb.boundaryMinutes === 23 * 60 && opts.ziHour === "nextDay"
      warnings.push(
        `시지 경계 ${HOUR_WARN_MIN}분 이내 출생(보정 후 ${String(corrected.hour).padStart(2, "0")}:${String(corrected.minute).padStart(2, "0")}) — ${dayToo ? "시주·일주" : "시주"} 경계`,
      )
    }
    if (opts.ziHour === "yajasi") {
      const toMidnight = Math.min(corrected.minutesOfDay, 1440 - corrected.minutesOfDay)
      if (toMidnight <= HOUR_WARN_MIN) warnings.push(`자정 ${HOUR_WARN_MIN}분 이내 출생(야자시 설정) — 일주 경계`)
    }
    if (opts.trueSolarTime) {
      const legalBranch = hourBranchIndex(legalWall.minutesOfDay)
      if (legalBranch !== bIdx) {
        warnings.push(
          `진태양시 보정(${fmtMinutes(solarTimeMinutes)})으로 시지가 ${BRANCHES[legalBranch]}→${BRANCHES[bIdx]}로 바뀜`,
        )
      }
      if (corrected.day !== legalWall.day) {
        warnings.push(`진태양시 보정(${fmtMinutes(solarTimeMinutes)})으로 현지 날짜가 ${corrected.year}-${corrected.month}-${corrected.day}로 바뀜`)
      }
    }
  }

  // 6) 절입 경계 경고
  if (hourKnown) {
    for (const t of [month.prev, month.next]) {
      if (Math.abs(t.utcMs - utcMs) <= TERM_WARN_MS) {
        const which = t.name === "立春" ? "연주·월주" : "월주"
        warnings.push(`절입(${t.name} ${fmtLocal(t.utcMs, local.offsetMinutes)}) 2시간 이내 출생 — ${which} 경계`)
      }
    }
  } else {
    warnings.push(
      "태어난 시각 모름 — 현지 정오(12:00) 가정으로 연·월·일주와 대운수를 계산하고 시주는 제외함" +
        (opts.ziHour === "nextDay" ? " (23시 이후 출생이면 일주가 다음 날로 바뀔 수 있음)" : ""),
    )
    const dayStart = localToUtc({ ...solarDate, hour: 0, minute: 0 }, timezone).utcMs
    const nextDate = addDays(solarDate.year, solarDate.month, solarDate.day, 1)
    const dayEnd = localToUtc({ ...nextDate, hour: 0, minute: 0 }, timezone).utcMs
    for (const t of jieBetween(dayStart, dayEnd)) {
      const which = t.name === "立春" ? "연주·월주" : "월주"
      warnings.push(`출생일에 절입(${t.name} ${fmtLocal(t.utcMs, local.offsetMinutes)}) 있음 — 시각에 따라 ${which}가 달라질 수 있음(불확실)`)
    }
  }

  // 7) 음력 날짜(한국 음력, UTC+9 판정) + 합삭이 한국시 자정 근처인 달 경고
  const lunar = solarToLunar(solarDate.year, solarDate.month, solarDate.day)
  const lunarRisk =
    input.calendar === "lunar"
      ? lunarToSolarRisk(input.year, input.month, input.isLeapMonth === true)
      : solarToLunarRisk(solarDate.year, solarDate.month, solarDate.day)
  if (lunarRisk) {
    warnings.push("이 음력 달은 합삭이 한국시 자정 ±3분 이내 — 공식 역서와 음력·양력 변환이 하루 다를 수 있음")
  }

  // 8) 대운
  const luck = computeLuck({
    utcMs,
    yearStem: yearPillar.stem,
    gender: input.gender,
    monthPillar: month.pillar,
    birthSolarYear: solarDate.year,
    rounding: opts.luckRounding,
  })

  return {
    engineVersion: CALENDAR_ENGINE_VERSION,
    options: opts,
    input: { ...input, timezone },
    hourKnown,
    utcInstant: new Date(utcMs).toISOString(),
    corrections: {
      utcOffsetMinutes: local.offsetMinutes,
      dstApplied: local.dst,
      solarTimeMinutes,
    },
    solarDate,
    lunarDate: lunar,
    pillars: { year: yearPillar, month: month.pillar, day: dayPillar, hour: hourPillar },
    solarTerm: { prev: toPoint(month.prev), next: toPoint(month.next) },
    luck: {
      direction: luck.direction,
      startAge: luck.startAge,
      startAgeExact: luck.startAgeExact,
      daeun: luck.daeun,
    },
    warnings,
  }
}
