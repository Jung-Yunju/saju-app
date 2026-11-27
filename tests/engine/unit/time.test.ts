// 시간 보정 단위 테스트 (P3-02) — 기대값 근거는 각 테스트 주석 참고.
import { describe, expect, it } from "vitest"
import { computeChart, EngineInputError, type BirthInput } from "@/engine"
import { equationOfTimeMinutes, localToUtc } from "@/engine/calendar/time"

const base: BirthInput = { calendar: "solar", year: 2024, month: 1, day: 1, time: { hour: 12, minute: 0 }, gender: "M" }
const at = (y: number, m: number, d: number, hour: number, minute: number): BirthInput => ({
  ...base, year: y, month: m, day: d, time: { hour, minute },
})

describe("UTC 오프셋 (Asia/Seoul 이력)", () => {
  it("1987-07-01 서울: 서머타임(UTC+10) → 600분, dstApplied true", () => {
    // 근거: 1987년 한국 서머타임 5/10 02:00 ~ 10/11 03:00 (IANA tzdb asia 파일 ROK 규칙)
    const r = computeChart(at(1987, 7, 1, 12, 0))
    expect(r.corrections.utcOffsetMinutes).toBe(600)
    expect(r.corrections.dstApplied).toBe(true)
    expect(r.utcInstant).toBe("1987-07-01T02:00:00.000Z") // 12:00 − 10h
    // 진태양시 보정 = 경도×4 − 오프셋 = 126.978×4 − 600 = −92.088분 (손계산)
    expect(r.corrections.solarTimeMinutes).toBeCloseTo(-92.088, 3)
  })

  it("1960-01-01 서울: UTC+8:30 → 510분, 서머타임 아님", () => {
    // 근거: 1954-03-21 ~ 1961-08-09 한국 표준시 동경 127°30′(UTC+8:30). 1월은 서머타임 기간 밖.
    const r = computeChart(at(1960, 1, 1, 12, 0))
    expect(r.corrections.utcOffsetMinutes).toBe(510)
    expect(r.corrections.dstApplied).toBe(false)
    expect(r.utcInstant).toBe("1960-01-01T03:30:00.000Z")
  })

  it("1955-07-01 서울: UTC+8:30 위의 서머타임(UTC+9:30) → 570분, dst true", () => {
    // 근거: 1955~60년 서머타임(+1시간)이 UTC+8:30 표준시 위에 적용
    const r = computeChart(at(1955, 7, 1, 12, 0))
    expect(r.corrections.utcOffsetMinutes).toBe(570)
    expect(r.corrections.dstApplied).toBe(true)
  })

  it("1954년 표준시 변경(+9 → +8:30)은 서머타임으로 보지 않는다", () => {
    expect(computeChart(at(1954, 1, 15, 12, 0)).corrections).toMatchObject({ utcOffsetMinutes: 540, dstApplied: false })
    expect(computeChart(at(1954, 7, 15, 12, 0)).corrections).toMatchObject({ utcOffsetMinutes: 510, dstApplied: false })
  })

  it("2024 평상시: 540분, 진태양시 보정 약 −32분", () => {
    const r = computeChart(at(2024, 6, 1, 12, 0))
    expect(r.corrections.utcOffsetMinutes).toBe(540)
    expect(r.corrections.dstApplied).toBe(false)
    expect(r.corrections.solarTimeMinutes).toBeCloseTo(126.978 * 4 - 540, 6) // −32.088
  })

  it("trueSolarTime=false면 보정량 0", () => {
    expect(computeChart(at(2024, 6, 1, 12, 0), { trueSolarTime: false }).corrections.solarTimeMinutes).toBe(0)
  })

  it("출생지 경도 입력 시 그 경도로 보정(부산 129.075°E → 516.3 − 540 = −23.7분)", () => {
    const r = computeChart({ ...at(2024, 6, 1, 12, 0), longitude: 129.075 })
    expect(r.corrections.solarTimeMinutes).toBeCloseTo(129.075 * 4 - 540, 6)
  })

  it("1900-01-01: 표준시 제정 전 → 지방평균시 8:27:52(507.87분) + 경고", () => {
    // 근거: tzdb Asia/Seoul 1908-04-01 이전 LMT +8:27:52
    const r = computeChart(at(1900, 1, 1, 12, 0))
    expect(r.corrections.utcOffsetMinutes).toBeCloseTo(8 * 60 + 27 + 52 / 60, 6)
    expect(r.warnings.some((w) => w.includes("지방평균시"))).toBe(true)
  })
})

describe("서머타임 전환의 특이 시각 (Temporal 'compatible' 규칙)", () => {
  it("공백: 1987-05-10 02:30(존재하지 않음) → 전환 전 +9 해석 = 17:30Z, 경고", () => {
    // 근거: 1987-05-10 02:00 KST에 03:00 KDT로 건너뜀 → 02:00~02:59는 없는 시각
    const r = localToUtc({ year: 1987, month: 5, day: 10, hour: 2, minute: 30 }, "Asia/Seoul")
    expect(r.resolution).toBe("gap")
    expect(new Date(r.utcMs).toISOString()).toBe("1987-05-09T17:30:00.000Z")
    expect(r.offsetMinutes).toBe(600) // 결과 순간은 이미 서머타임
    const c = computeChart(at(1987, 5, 10, 2, 30))
    expect(c.warnings.some((w) => w.includes("존재하지 않는 현지시각"))).toBe(true)
  })

  it("겹침: 1987-10-11 02:30(두 번 있음) → 앞선 시각(+10) = 16:30Z, 경고", () => {
    // 근거: 1987-10-11 03:00 KDT에 02:00 KST로 되돌림 → 02:00~02:59가 두 번
    const r = localToUtc({ year: 1987, month: 10, day: 11, hour: 2, minute: 30 }, "Asia/Seoul")
    expect(r.resolution).toBe("overlap")
    expect(new Date(r.utcMs).toISOString()).toBe("1987-10-10T16:30:00.000Z")
    expect(r.dst).toBe(true)
    const c = computeChart(at(1987, 10, 11, 2, 30))
    expect(c.warnings.some((w) => w.includes("두 번 있음"))).toBe(true)
  })

  it("일반 시각은 unique, 경고 없음", () => {
    const r = localToUtc({ year: 2024, month: 3, day: 1, hour: 9, minute: 0 }, "Asia/Seoul")
    expect(r.resolution).toBe("unique")
    expect(r.warnings).toEqual([])
  })
})

describe("균시차(equationOfTime 옵션)", () => {
  it("근사식 값이 천문 연감의 대표값과 맞다(±0.7분)", () => {
    // 근거: 균시차 연중 극값 약 −14.2분(2월 11일 전후), +16.4분(11월 3일 전후) — 천문 연감 일반값
    expect(equationOfTimeMinutes(Date.UTC(2024, 1, 11, 3))).toBeCloseTo(-14.2, 0)
    expect(Math.abs(equationOfTimeMinutes(Date.UTC(2024, 1, 11, 3)) + 14.2)).toBeLessThan(0.7)
    expect(Math.abs(equationOfTimeMinutes(Date.UTC(2024, 10, 3, 3)) - 16.4)).toBeLessThan(0.7)
  })

  it("equationOfTime=true면 보정량에 균시차가 더해진다", () => {
    const off = computeChart(at(2024, 11, 3, 12, 0)).corrections.solarTimeMinutes
    const on = computeChart(at(2024, 11, 3, 12, 0), { equationOfTime: true }).corrections.solarTimeMinutes
    expect(on - off).toBeCloseTo(equationOfTimeMinutes(Date.UTC(2024, 10, 3, 3)), 6)
    expect(on - off).toBeGreaterThan(15)
  })
})

describe("입력 검증", () => {
  it("범위·형식 오류는 EngineInputError", () => {
    expect(() => computeChart(at(1899, 12, 31, 12, 0))).toThrow(EngineInputError)
    expect(() => computeChart(at(2101, 1, 1, 12, 0))).toThrow(EngineInputError)
    expect(() => computeChart(at(2023, 2, 29, 12, 0))).toThrow(EngineInputError) // 2023은 평년
    expect(() => computeChart(at(2024, 1, 1, 24, 0))).toThrow(EngineInputError)
    expect(() => computeChart(at(2024, 1, 1, 12, 60))).toThrow(EngineInputError)
    expect(() => computeChart({ ...base, timezone: "Mars/Olympus" })).toThrow(EngineInputError)
    expect(() => computeChart({ ...base, longitude: 200 })).toThrow(EngineInputError)
  })

  it("결과에 engineVersion과 사용 옵션 전체를 기록한다", () => {
    const r = computeChart(base, { ziHour: "yajasi" })
    expect(r.engineVersion).toBe("calendar@0.1.1")
    expect(r.options).toEqual({ ziHour: "yajasi", trueSolarTime: true, defaultLongitude: 126.978, equationOfTime: false, luckRounding: "round" })
    expect(r.input.timezone).toBe("Asia/Seoul")
  })
})
