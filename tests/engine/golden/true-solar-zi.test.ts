// 골든 ⑨ 진태양시 보정·자시(23시대)·시각 모름
// [확정 규칙 2026-11-27 총괄실장] solarTimeMinutes는 경도×4 − UTC 오프셋(서머타임 포함)으로 오프셋 차이를 포함한다. 일주 날짜는 보정된 시각의 현지 날짜로 정한다.
// 진태양시 기대값(계약: "법정시 → 진태양시 보정량"):
//   solarTimeMinutes = 경도 × 4분 − UTC 오프셋(분) [+ 균시차, equationOfTime:true일 때]
//   서울 126.978°E, UTC+9 → 507.912 − 540 = −32.088분. 서머타임(UTC+10)이면 −92.088분, UTC+8:30이면 −2.088분.
//   균시차 오라클: astronomy-engine 태양 시적경 + 그리니치 시항성시 (허용 오차 1분)
// 진태양시 적용 시 일주·시주는 '보정된 현지 시각'으로 판정한다(계약: 시주·일주 판정에만 영향).
import { describe, expect, it } from "vitest"
import { computeChart, type BirthInput, type EngineOptions } from "@/engine"
import { dayPillarOracle, equationOfTimeMinutes, hourPillarOracle, localToUtcUnique } from "./oracle"
import { fmtP, SEOUL } from "./helpers"

const SEOUL_LON = 126.978
const inp = (y: number, mo: number, d: number, h: number, mi: number, extra: Partial<BirthInput> = {}): BirthInput => ({
  calendar: "solar", year: y, month: mo, day: d, time: { hour: h, minute: mi }, timezone: SEOUL, gender: "M", ...extra,
})
const B = { 子: 0, 丑: 1, 寅: 2, 卯: 3, 辰: 4, 巳: 5, 午: 6, 未: 7, 申: 8, 酉: 9, 戌: 10, 亥: 11 } as const

interface TstCase {
  name: string
  input: BirthInput
  opts?: Partial<EngineOptions>
  solarMin: number
  tol: number
  /** 기대 일주 날짜(양력)와 시지 */
  dayDate: [number, number, number]
  hourStemDate: [number, number, number]
  hourBranch: keyof typeof B
}

const eot = (y: number, mo: number, d: number, h: number, mi: number) =>
  equationOfTimeMinutes(localToUtcUnique({ year: y, month: mo, day: d, hour: h, minute: mi }, SEOUL)!)

const tst: TstCase[] = [
  { name: "2024-06-15 11:20 서울 → 진태양시 10:48 巳時", input: inp(2024, 6, 15, 11, 20), solarMin: SEOUL_LON * 4 - 540, tol: 0.1, dayDate: [2024, 6, 15], hourStemDate: [2024, 6, 15], hourBranch: "巳" },
  { name: "2024-06-15 23:20 서울 → 22:48 亥時, 일주 당일(보정 없으면 子時·다음 날)", input: inp(2024, 6, 15, 23, 20), solarMin: SEOUL_LON * 4 - 540, tol: 0.1, dayDate: [2024, 6, 15], hourStemDate: [2024, 6, 15], hourBranch: "亥" },
  { name: "2024-06-16 00:20 서울 → 6/15 23:48 子時, nextDay → 일주 6/16", input: inp(2024, 6, 16, 0, 20), solarMin: SEOUL_LON * 4 - 540, tol: 0.1, dayDate: [2024, 6, 16], hourStemDate: [2024, 6, 16], hourBranch: "子" },
  { name: "같은 시각 yajasi → 일주 6/15, 시간 천간은 6/16 기준", input: inp(2024, 6, 16, 0, 20), opts: { ziHour: "yajasi" }, solarMin: SEOUL_LON * 4 - 540, tol: 0.1, dayDate: [2024, 6, 15], hourStemDate: [2024, 6, 16], hourBranch: "子" },
  { name: "1987-07-15 12:00 서머타임(UTC+10) → −92분, 10:28 巳時", input: inp(1987, 7, 15, 12, 0), solarMin: SEOUL_LON * 4 - 600, tol: 0.1, dayDate: [1987, 7, 15], hourStemDate: [1987, 7, 15], hourBranch: "巳" },
  { name: "1960-01-15 12:00 UTC+8:30 → −2분, 11:58 午時", input: inp(1960, 1, 15, 12, 0), solarMin: SEOUL_LON * 4 - 510, tol: 0.1, dayDate: [1960, 1, 15], hourStemDate: [1960, 1, 15], hourBranch: "午" },
  { name: "경도 129.0(부산 부근) 2024-06-15 12:00 → −24분, 11:36 午時", input: inp(2024, 6, 15, 12, 0, { longitude: 129.0 }), solarMin: 129.0 * 4 - 540, tol: 0.1, dayDate: [2024, 6, 15], hourStemDate: [2024, 6, 15], hourBranch: "午" },
  { name: "균시차 포함 2024-02-11 13:40 → 약 −46분, 12:54 午時(균시차 없으면 未時)", input: inp(2024, 2, 11, 13, 40), opts: { equationOfTime: true }, solarMin: SEOUL_LON * 4 - 540 + eot(2024, 2, 11, 13, 40), tol: 1.0, dayDate: [2024, 2, 11], hourStemDate: [2024, 2, 11], hourBranch: "午" },
  { name: "균시차 포함 2024-11-03 12:00 → 약 −16분, 11:44 午時", input: inp(2024, 11, 3, 12, 0), opts: { equationOfTime: true }, solarMin: SEOUL_LON * 4 - 540 + eot(2024, 11, 3, 12, 0), tol: 1.0, dayDate: [2024, 11, 3], hourStemDate: [2024, 11, 3], hourBranch: "午" },
]

describe("골든 ⑨ 진태양시", () => {
  for (const c of tst) {
    it(c.name, () => {
      const chart = computeChart(c.input, c.opts)
      expect(Math.abs(chart.corrections.solarTimeMinutes - c.solarMin), `solarTimeMinutes ${chart.corrections.solarTimeMinutes} 기대 ${c.solarMin.toFixed(3)}`).toBeLessThanOrEqual(c.tol)
      const expDay = dayPillarOracle(...c.dayDate)
      const expHour = hourPillarOracle(dayPillarOracle(...c.hourStemDate).stem, B[c.hourBranch])
      expect(fmtP(chart.pillars.day), "일주").toBe(fmtP(expDay))
      expect(fmtP(chart.pillars.hour), "시주").toBe(fmtP(expHour))
    })
  }

  it("trueSolarTime:false → solarTimeMinutes = 0", () => {
    expect(computeChart(inp(2024, 6, 15, 11, 20), { trueSolarTime: false }).corrections.solarTimeMinutes).toBe(0)
  })

  it("진태양시는 연주·월주에 영향 없음: 立春 2024-02-04 17:27 KST 직후 17:40 출생 → 甲辰年 丙寅月", () => {
    const c = computeChart(inp(2024, 2, 4, 17, 40))
    expect(fmtP(c.pillars.year)).toBe("甲辰")
    expect(fmtP(c.pillars.month)).toBe("丙寅")
  })
})

describe("골든 ⑨ 자시(23시대) — trueSolarTime:false", () => {
  const off = { trueSolarTime: false }
  const zi = (y: number, mo: number, d: number) => hourPillarOracle(dayPillarOracle(y, mo, d).stem, 0)
  it("nextDay: 2024-03-15 23:30 → 일주 3/16, 시주 3/16 일간 기준 子時", () => {
    const c = computeChart(inp(2024, 3, 15, 23, 30), { ...off, ziHour: "nextDay" })
    expect(fmtP(c.pillars.day)).toBe(fmtP(dayPillarOracle(2024, 3, 16)))
    expect(fmtP(c.pillars.hour)).toBe(fmtP(zi(2024, 3, 16)))
  })
  it("nextDay: 23:00 정각부터 다음 날", () => {
    const c = computeChart(inp(2024, 3, 15, 23, 0), { ...off, ziHour: "nextDay" })
    expect(fmtP(c.pillars.day)).toBe(fmtP(dayPillarOracle(2024, 3, 16)))
  })
  it("nextDay: 22:59 → 당일 亥時", () => {
    const c = computeChart(inp(2024, 3, 15, 22, 59), { ...off, ziHour: "nextDay" })
    expect(fmtP(c.pillars.day)).toBe(fmtP(dayPillarOracle(2024, 3, 15)))
    expect(fmtP(c.pillars.hour)).toBe(fmtP(hourPillarOracle(dayPillarOracle(2024, 3, 15).stem, 11)))
  })
  it("yajasi: 2024-03-15 23:30 → 일주 3/15, 시주 천간은 3/16 일간 기준", () => {
    const c = computeChart(inp(2024, 3, 15, 23, 30), { ...off, ziHour: "yajasi" })
    expect(fmtP(c.pillars.day)).toBe(fmtP(dayPillarOracle(2024, 3, 15)))
    expect(fmtP(c.pillars.hour)).toBe(fmtP(zi(2024, 3, 16)))
  })
  it("00:30(子時 후반)은 두 옵션 모두 당일 일주·당일 일간 기준", () => {
    for (const ziHour of ["nextDay", "yajasi"] as const) {
      const c = computeChart(inp(2024, 3, 16, 0, 30), { ...off, ziHour })
      expect(fmtP(c.pillars.day), ziHour).toBe(fmtP(dayPillarOracle(2024, 3, 16)))
      expect(fmtP(c.pillars.hour), ziHour).toBe(fmtP(zi(2024, 3, 16)))
    }
  })
  it("연말 nextDay: 2024-12-31 23:30 → 일주 2025-01-01", () => {
    const c = computeChart(inp(2024, 12, 31, 23, 30), { ...off, ziHour: "nextDay" })
    expect(fmtP(c.pillars.day)).toBe(fmtP(dayPillarOracle(2025, 1, 1)))
  })
})

describe("골든 ⑨ 시각 모름", () => {
  it("time:null → hourKnown=false, 시주 null, 경고 있음, utcInstant = 현지 정오", () => {
    const c = computeChart({ calendar: "solar", year: 1990, month: 5, day: 20, time: null, timezone: SEOUL, gender: "F" })
    expect(c.hourKnown).toBe(false)
    expect(c.pillars.hour).toBeNull()
    expect(c.warnings.length).toBeGreaterThan(0)
    expect(new Date(c.utcInstant).getTime()).toBe(Date.UTC(1990, 4, 20, 3, 0))
  })
})
