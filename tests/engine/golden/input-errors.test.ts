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

  // ── 2026-11-27 총괄실장 결정으로 확정된 입력 범위 (docs/SAJU_ENGINE.md 만세력 '입력 범위') ──
  //   양력·음력 연도 1900~2100, 시 0~23 정수, 분 0~59 정수 → 벗어나면 EngineInputError
  //   기대값은 계약 문장에서만 도출했다(엔진 구현·엔진 테스트 미참조).
  const solarAt = (y: number, m: number, d: number, time: BirthInput["time"]): BirthInput =>
    ({ calendar: "solar", year: y, month: m, day: d, time, timezone: SEOUL, gender: "F" })

  const badTime: [BirthInput["time"], string][] = [
    [{ hour: 24, minute: 0 }, "24시"],
    [{ hour: 25, minute: 0 }, "25시"],
    [{ hour: -1, minute: 0 }, "-1시"],
    [{ hour: 12, minute: 60 }, "60분"],
    [{ hour: 12, minute: -1 }, "-1분"],
    [{ hour: 23, minute: 60 }, "23시 60분(다음 날 0시로 넘기면 안 됨)"],
    [{ hour: 12.5, minute: 0 }, "시 소수"],
    [{ hour: 12, minute: 30.5 }, "분 소수"],
    [{ hour: Number.NaN, minute: 0 }, "시 NaN"],
    [{ hour: 12, minute: Number.POSITIVE_INFINITY }, "분 Infinity"],
  ]
  it(`시 0~23·분 0~59 정수 밖 (양력 ${badTime.length}건 + 음력 ${badTime.length}건)`, () => {
    const all = badTime.flatMap(([t, why]) => [
      { input: solarAt(2000, 6, 15, t), why: `양력 ${why}` },
      { input: { calendar: "lunar" as const, year: 2000, month: 6, day: 15, isLeapMonth: false, time: t, timezone: SEOUL, gender: "M" as const }, why: `음력 ${why}` },
    ])
    const fails = collect(all, (c) => c.why, (c) => expectInputError(c.input))
    assertNoFailures(fails, all.length, "시각 범위")
  })

  const badYear: [number, string][] = [
    [1899, "1899년"], [1800, "1800년"], [2101, "2101년"], [2200, "2200년"], [0, "0년"], [-1, "음수 연도"],
  ]
  it(`연도 1900~2100 밖 (양력·음력 각 ${badYear.length}건)`, () => {
    const all = badYear.flatMap(([y, why]) => [
      { input: solarAt(y, 6, 15, { hour: 12, minute: 0 }), why: `양력 ${why}` },
      { input: { calendar: "lunar" as const, year: y, month: 6, day: 15, isLeapMonth: false, ...base }, why: `음력 ${why}` },
    ])
    const fails = collect(all, (c) => c.why, (c) => expectInputError(c.input))
    assertNoFailures(fails, all.length, "연도 범위")
  })

  it("연도 소수·NaN도 거부 (2000.5, NaN)", () => {
    const fails = collect([2000.5, Number.NaN], String, (y) => expectInputError(solarAt(y, 6, 15, { hour: 12, minute: 0 })))
    assertNoFailures(fails, 2, "연도 형식")
  })

  it("존재하지 않는 양력 날짜는 시각을 함께 줘도 거부 (2023-02-29 23:30, 2100-02-29 12:00 — 2100은 평년)", () => {
    const fails = collect(
      [solarAt(2023, 2, 29, { hour: 23, minute: 30 }), solarAt(2100, 2, 29, { hour: 12, minute: 0 }), solarAt(2024, 6, 31, null)],
      (i) => `${i.year}-${i.month}-${i.day}`,
      expectInputError,
    )
    assertNoFailures(fails, 3, "존재하지 않는 양력 날짜(시각 포함)")
  })

  it("범위 경계값은 오류가 아님: 1900-01-01 00:00, 2100-12-31 23:59, 0시 0분, 23시 59분, 시각 모름", () => {
    const ok: BirthInput[] = [
      solarAt(1900, 1, 1, { hour: 0, minute: 0 }),
      solarAt(1900, 1, 1, { hour: 12, minute: 0 }),
      solarAt(2100, 12, 31, { hour: 12, minute: 0 }),
      solarAt(2100, 12, 31, { hour: 23, minute: 59 }),
      solarAt(2000, 6, 15, { hour: 0, minute: 0 }),
      solarAt(2000, 6, 15, { hour: 23, minute: 59 }),
      solarAt(2000, 6, 15, null),
    ]
    const fails = collect(ok, (i) => `${i.year}-${i.month}-${i.day} ${i.time ? `${i.time.hour}:${i.time.minute}` : "모름"}`, (i) => {
      try {
        computeChart(i, { trueSolarTime: false })
        return null
      } catch (e) {
        return `예외 ${(e as Error).name}: ${(e as Error).message}`
      }
    })
    assertNoFailures(fails, ok.length, "정상 경계값")
  })

  // 계약 '입력 범위'의 나머지(경도 −180~180, 유효 IANA 시간대)도 같은 문장에 있어 함께 확인한다.
  it("경도 −180~180 밖·잘못된 시간대 이름 → EngineInputError", () => {
    const bad: { input: BirthInput; why: string }[] = [
      { input: { ...solarAt(2000, 6, 15, { hour: 12, minute: 0 }), longitude: 181 }, why: "경도 181" },
      { input: { ...solarAt(2000, 6, 15, { hour: 12, minute: 0 }), longitude: -180.5 }, why: "경도 -180.5" },
      { input: { ...solarAt(2000, 6, 15, { hour: 12, minute: 0 }), timezone: "Mars/Olympus" }, why: "없는 시간대" },
    ]
    const fails = collect(bad, (c) => c.why, (c) => expectInputError(c.input))
    assertNoFailures(fails, bad.length, "경도·시간대")
  })
})
