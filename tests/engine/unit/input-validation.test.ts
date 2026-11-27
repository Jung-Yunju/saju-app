// 엔진 입력 검증 규칙(calendar@0.1.1 확정) 단위 테스트
// 규칙: docs/SAJU_ENGINE.md "입력 검증" — 시 0~23·분 0~59 정수, 연도 1900~2100, 존재하는 양력 날짜,
//       isLeapMonth는 boolean. 서머타임 겹침·공백은 오류가 아니라 "compatible" 규칙으로 해석 + 경고.
import { describe, expect, it } from "vitest"
import { computeChart, EngineInputError, type BirthInput } from "@/engine"

const base: BirthInput = { calendar: "solar", year: 2024, month: 6, day: 15, time: { hour: 12, minute: 0 }, gender: "F" }

function errorOf(input: unknown): unknown {
  try {
    computeChart(input as BirthInput)
  } catch (e) {
    return e
  }
  return null
}

function expectInputError(input: unknown, label: string) {
  const e = errorOf(input)
  expect(e, `${label}: 예외가 없음`).not.toBeNull()
  expect(e, `${label}: ${(e as Error)?.name} ${(e as Error)?.message}`).toBeInstanceOf(EngineInputError)
}

describe("시각 범위", () => {
  const bad: [unknown, unknown, string][] = [
    [24, 0, "24시"],
    [-1, 0, "−1시"],
    [12, 60, "60분"],
    [12, -1, "−1분"],
    [1.5, 0, "소수 시"],
    [12, 0.5, "소수 분"],
    [Number.NaN, 0, "NaN 시"],
    [Number.POSITIVE_INFINITY, 0, "무한대 시"],
    ["12", 0, "문자열 시"],
    [12, undefined, "분 없음"],
    [null, 0, "시 null"],
  ]
  for (const [hour, minute, label] of bad) {
    it(`${label} → EngineInputError`, () => expectInputError({ ...base, time: { hour, minute } }, label))
  }
  it("time 필드 누락 → EngineInputError (null과 구분)", () => {
    const { time: _t, ...rest } = base
    void _t
    expectInputError(rest, "time 없음")
  })
  it("경계 정상값: 0:00, 23:59", () => {
    expect(() => computeChart({ ...base, time: { hour: 0, minute: 0 } })).not.toThrow()
    expect(() => computeChart({ ...base, time: { hour: 23, minute: 59 } })).not.toThrow()
  })
})

describe("연도 범위 1900~2100", () => {
  it("양력 1899-12-31, 2101-01-01 → EngineInputError", () => {
    expectInputError({ ...base, year: 1899, month: 12, day: 31 }, "1899")
    expectInputError({ ...base, year: 2101, month: 1, day: 1 }, "2101")
  })
  it("음력 1899년, 2101년 → EngineInputError", () => {
    expectInputError({ ...base, calendar: "lunar", year: 1899, month: 12, day: 1, isLeapMonth: false }, "음력 1899")
    expectInputError({ ...base, calendar: "lunar", year: 2101, month: 1, day: 1, isLeapMonth: false }, "음력 2101")
  })
  it("음력 2100년 12월 2일은 양력 2101-01-01이 되어 범위 밖 → EngineInputError", () => {
    // 근거: 엔진 한국 음력 표에서 음력 2100-12-01 = 양력 2100-12-31 (아래 정상값 테스트로 확인)
    expect(computeChart({ ...base, calendar: "lunar", year: 2100, month: 12, day: 1, isLeapMonth: false }).solarDate).toEqual({
      year: 2100, month: 12, day: 31,
    })
    expectInputError({ ...base, calendar: "lunar", year: 2100, month: 12, day: 2, isLeapMonth: false }, "음력 2100-12-02")
  })
  it("경계 정상값: 양력 1900-01-01 00:00, 2100-12-31 23:59", () => {
    expect(() => computeChart({ ...base, year: 1900, month: 1, day: 1, time: { hour: 0, minute: 0 } })).not.toThrow()
    expect(() => computeChart({ ...base, year: 2100, month: 12, day: 31, time: { hour: 23, minute: 59 } })).not.toThrow()
  })
  it("연도가 정수가 아님(문자열·소수) → EngineInputError", () => {
    expectInputError({ ...base, year: "2024" }, "문자열 연도")
    expectInputError({ ...base, year: 2024.5 }, "소수 연도")
  })
})

describe("존재하지 않는 양력 날짜", () => {
  const bad: [number, number, number][] = [
    [2023, 2, 29], [2100, 2, 29], [2024, 2, 30], [2024, 6, 31], [2024, 11, 31], [2024, 12, 32], [2024, 0, 1], [2024, 13, 1], [2024, 5, 0],
  ]
  for (const [y, m, d] of bad) {
    it(`${y}-${m}-${d} → EngineInputError`, () => expectInputError({ ...base, year: y, month: m, day: d }, `${y}-${m}-${d}`))
  }
  it("윤년 2월 29일(2024, 2000)은 정상", () => {
    expect(() => computeChart({ ...base, year: 2024, month: 2, day: 29 })).not.toThrow()
    expect(() => computeChart({ ...base, year: 2000, month: 2, day: 29 })).not.toThrow()
  })
})

describe("isLeapMonth 형식", () => {
  it("boolean이 아니면 EngineInputError (예전엔 평달로 조용히 처리)", () => {
    expectInputError({ ...base, calendar: "lunar", year: 2024, month: 1, day: 1, isLeapMonth: "yes" }, "문자열")
    expectInputError({ ...base, calendar: "lunar", year: 2024, month: 1, day: 1, isLeapMonth: 1 }, "숫자")
  })
  it("양력 입력에 isLeapMonth true → EngineInputError, false는 허용", () => {
    expectInputError({ ...base, isLeapMonth: true }, "양력+윤달")
    expect(() => computeChart({ ...base, isLeapMonth: false })).not.toThrow()
  })
})

describe('서머타임 겹침·공백 = "compatible" 규칙(확정)', () => {
  // 1987년 사례는 time.test.ts. 여기서는 1988년: 5/8 02:00 시작 ~ 10/9 03:00 종료 (IANA tzdb asia ROK 규칙)
  it("공백 1988-05-08 02:30 → 오류 아님, 전환 전 오프셋(+9)으로 해석 = 17:30Z, 경고", () => {
    const r = computeChart({ ...base, year: 1988, month: 5, day: 8, time: { hour: 2, minute: 30 } })
    expect(r.utcInstant).toBe("1988-05-07T17:30:00.000Z")
    expect(r.warnings.some((w) => w.includes("존재하지 않는 현지시각"))).toBe(true)
  })
  it("겹침 1988-10-09 02:30 → 오류 아님, 앞선 순간(+10 서머타임)으로 해석 = 16:30Z, 경고", () => {
    const r = computeChart({ ...base, year: 1988, month: 10, day: 9, time: { hour: 2, minute: 30 } })
    expect(r.utcInstant).toBe("1988-10-08T16:30:00.000Z")
    expect(r.corrections.dstApplied).toBe(true)
    expect(r.warnings.some((w) => w.includes("두 번 있음"))).toBe(true)
  })
})
