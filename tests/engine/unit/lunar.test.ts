// 음력 변환 단위 테스트 (P3-03)
// 근거(한국천문연구원 음양력): 2023 음력 1월 1일 = 양력 2023-01-22(설날), 2월 1일 = 02-20,
//   윤2월 1일 = 03-22, 3월 1일 = 04-20. → 2월은 30일(02-20~03-21), 윤2월은 29일(03-22~04-19).
//   2022년은 윤달 없음(2020 윤4월, 2023 윤2월, 2025 윤6월).
// ※ 지시서의 "음력 2023-02-30 → 오류" 사례는 위 근거상 평달 2월이 30일까지 있어 성립하지 않으므로,
//    윤2월 30일(오류)과 평달 2월 30일(= 03-21, 정상)로 바꿔 검사한다.
// 한국·중국 음력이 다른 해(한국 공휴일·역서 기준, 중국 춘절은 비교용):
//   1997 설날 한국 02-08 (중국 춘절 02-07), 2027 설날 한국 02-07 (중국 02-06),
//   2012 한국 윤3월(양력 04-21~05-20, 중국은 閏四月), 2017 한국 윤5월(06-24~07-22, 중국은 閏六月).
import { describe, expect, it } from "vitest"
import { computeChart, EngineInputError, type BirthInput } from "@/engine"
import { leapMonthOf, lunarToSolar, newMoonUtcMs, solarToLunar } from "@/engine/calendar/lunar"

const lunarBirth = (y: number, m: number, d: number, leap: boolean): BirthInput => ({
  calendar: "lunar", year: y, month: m, day: d, isLeapMonth: leap, time: { hour: 12, minute: 0 }, gender: "M",
})

describe("음력 → 양력", () => {
  it("2023 윤2월 15일 → 2023-04-05 (윤2월 1일 03-22 + 14일)", () => {
    expect(lunarToSolar(2023, 2, 15, true)).toEqual({ year: 2023, month: 4, day: 5 })
    const r = computeChart(lunarBirth(2023, 2, 15, true))
    expect(r.solarDate).toEqual({ year: 2023, month: 4, day: 5 })
    expect(r.lunarDate).toEqual({ year: 2023, month: 2, day: 15, isLeapMonth: true })
  })

  it("2023 평달 2월 15일 → 2023-03-06 (02-20 + 14일)", () => {
    expect(lunarToSolar(2023, 2, 15, false)).toEqual({ year: 2023, month: 3, day: 6 })
  })

  it("2023 평달 2월 30일 → 2023-03-21 (2월은 큰달)", () => {
    expect(lunarToSolar(2023, 2, 30, false)).toEqual({ year: 2023, month: 3, day: 21 })
  })

  it("2023 윤2월 30일 → EngineInputError (윤2월은 29일까지)", () => {
    expect(() => lunarToSolar(2023, 2, 30, true)).toThrow(EngineInputError)
    expect(() => computeChart(lunarBirth(2023, 2, 30, true))).toThrow(EngineInputError)
  })

  it("2022 윤2월 → EngineInputError (2022년 윤달 없음)", () => {
    expect(() => lunarToSolar(2022, 2, 1, true)).toThrow(EngineInputError)
    expect(() => computeChart(lunarBirth(2022, 2, 1, true))).toThrow(EngineInputError)
  })

  it("윤달이 있는 해라도 다른 달의 윤달은 오류 (2023 윤3월)", () => {
    expect(() => lunarToSolar(2023, 3, 1, true)).toThrow(EngineInputError)
  })

  it("2023 음력 1월 1일 → 2023-01-22 (설날)", () => {
    expect(lunarToSolar(2023, 1, 1, false)).toEqual({ year: 2023, month: 1, day: 22 })
  })

  it("범위 밖·형식 오류", () => {
    expect(() => lunarToSolar(1899, 1, 1, false)).toThrow(EngineInputError)
    expect(() => lunarToSolar(2023, 13, 1, false)).toThrow(EngineInputError)
    expect(() => lunarToSolar(2023, 1, 31, false)).toThrow(EngineInputError)
  })
})

describe("양력 → 음력", () => {
  it("2023-04-05 → 윤2월 15일, 2023-03-21 → 2월 30일", () => {
    expect(solarToLunar(2023, 4, 5)).toEqual({ year: 2023, month: 2, day: 15, isLeapMonth: true })
    expect(solarToLunar(2023, 3, 21)).toEqual({ year: 2023, month: 2, day: 30, isLeapMonth: false })
  })

  it("양력 입력에 isLeapMonth를 주면 오류", () => {
    expect(() => computeChart({ calendar: "solar", year: 2023, month: 4, day: 5, isLeapMonth: true, time: null, gender: "M" })).toThrow(EngineInputError)
  })
})

describe("한국 음력(UTC+9 판정) — 중국 농력과 다른 해", () => {
  it("1997 설날 = 1997-02-08, 2027 설날 = 2027-02-07", () => {
    expect(lunarToSolar(1997, 1, 1, false)).toEqual({ year: 1997, month: 2, day: 8 })
    expect(lunarToSolar(2027, 1, 1, false)).toEqual({ year: 2027, month: 2, day: 7 })
  })

  it("2012 윤3월 1일 = 2012-04-21, 2017 윤5월 1일 = 2017-06-24 (입력 거부되지 않음)", () => {
    expect(leapMonthOf(2012)).toBe(3)
    expect(leapMonthOf(2017)).toBe(5)
    expect(lunarToSolar(2012, 3, 1, true)).toEqual({ year: 2012, month: 4, day: 21 })
    expect(lunarToSolar(2017, 5, 1, true)).toEqual({ year: 2017, month: 6, day: 24 })
    expect(() => lunarToSolar(2012, 4, 1, true)).toThrow(EngineInputError)
  })

  it("윤달 연도: 2020 윤4월, 2022 없음, 2023 윤2월, 2025 윤6월", () => {
    expect([2020, 2022, 2023, 2025].map(leapMonthOf)).toEqual([4, 0, 2, 6])
  })

  it("합삭 시각 검산: 2024-02-09 22:59 UTC (공개 천문 자료) ±1분", () => {
    const k = Math.round((Date.UTC(2024, 1, 9, 23) - Date.UTC(2000, 0, 6, 18, 14)) / 86_400_000 / 29.530588853)
    expect(Math.abs(newMoonUtcMs(k) - Date.UTC(2024, 1, 9, 22, 59))).toBeLessThan(60_000)
  })

  it("1900~2100 매주: 양력→음력→양력 왕복이 원래 날짜", () => {
    for (let t = Date.UTC(1900, 0, 1); t <= Date.UTC(2100, 11, 31); t += 7 * 86_400_000) {
      const d = new Date(t)
      const [y, m, dd] = [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]
      const l = solarToLunar(y, m, dd)
      if (l.year < 1900 || l.year > 2100) continue
      expect(lunarToSolar(l.year, l.month, l.day, l.isLeapMonth)).toEqual({ year: y, month: m, day: dd })
    }
  })
})

