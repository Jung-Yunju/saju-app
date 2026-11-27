// 골든 ⑦ 입력 오류 → EngineInputError
// 음력 사례는 lunar-golden.json의 invalid 목록(오라클로 '존재하지 않음'을 확인한 날짜).
import { describe, expect, it } from "vitest"
import { computeChart, EngineInputError, type BirthInput } from "@/engine"
import data from "./lunar-golden.json"
import { assertNoFailures, collect, SEOUL } from "./helpers"

const base = { time: { hour: 12, minute: 0 }, timezone: SEOUL, gender: "M" as const }

function expectInputError(input: BirthInput): string | null {
  try {
    computeChart(input, { trueSolarTime: false })
  } catch (e) {
    if (e instanceof EngineInputError) return null
    return `다른 예외 ${(e as Error).name}: ${(e as Error).message}`
  }
  return "예외 없음"
}

describe("골든 ⑦ 입력 오류", () => {
  it(`존재하지 않는 음력 날짜·윤달 없는 해의 윤달 (${data.invalid.length}건)`, () => {
    const fails = collect(data.invalid, (c) => `음력 ${c.lunar.year}-${c.lunar.isLeapMonth ? "윤" : ""}${c.lunar.month}-${c.lunar.day} (${c.reason})`, (c) =>
      expectInputError({ calendar: "lunar", ...c.lunar, ...base }),
    )
    assertNoFailures(fails, data.invalid.length, "음력 입력 오류")
  })

  const solarBad: [number, number, number, string][] = [
    [2023, 2, 29, "평년 2월 29일"],
    [1900, 2, 29, "1900년은 평년(100의 배수)"],
    [2024, 2, 30, "2월 30일"],
    [2024, 4, 31, "4월 31일"],
    [2024, 13, 1, "13월"],
    [2024, 0, 10, "0월"],
    [2024, 1, 0, "0일"],
  ]
  it(`존재하지 않는 양력 날짜 (${solarBad.length}건)`, () => {
    const fails = collect(solarBad, (c) => `양력 ${c[0]}-${c[1]}-${c[2]} (${c[3]})`, ([y, m, d]) =>
      expectInputError({ calendar: "solar", year: y, month: m, day: d, ...base }),
    )
    assertNoFailures(fails, solarBad.length, "양력 입력 오류")
  })

  const lunarBadRange: [number, number, number, string][] = [
    [2024, 13, 1, "음력 13월"],
    [2024, 0, 1, "음력 0월"],
    [2024, 1, 31, "음력 31일"],
    [2024, 1, 0, "음력 0일"],
  ]
  it(`범위 밖 음력 월·일 (${lunarBadRange.length}건)`, () => {
    const fails = collect(lunarBadRange, (c) => `${c[3]}`, ([y, m, d]) =>
      expectInputError({ calendar: "lunar", year: y, month: m, day: d, isLeapMonth: false, ...base }),
    )
    assertNoFailures(fails, lunarBadRange.length, "음력 범위")
  })

  it("정상 경계값은 오류가 아님: 2024-02-29(윤년), 음력 2023 윤2월 29일, 2000-02-29", () => {
    expect(() => computeChart({ calendar: "solar", year: 2024, month: 2, day: 29, ...base })).not.toThrow()
    expect(() => computeChart({ calendar: "solar", year: 2000, month: 2, day: 29, ...base })).not.toThrow()
    expect(() => computeChart({ calendar: "lunar", year: 2023, month: 2, day: 29, isLeapMonth: true, ...base })).not.toThrow()
  })

  // 미검증(계약 공백): 시각 범위(24:00, 분 60)와 지원 연도 범위(1900 이전·2100 이후) 오류 규칙이 계약에 없다.
  it.todo("시각·연도 범위 밖 입력 처리 (계약 확정 후 작성)")
})
