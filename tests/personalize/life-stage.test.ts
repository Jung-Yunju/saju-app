import { describe, expect, it } from "vitest"
import { computeChart } from "../../src/engine"
import {
  LIFE_STAGES, eraBackgroundOf, koreanDateOf, lifeStageOfAge, locateDaeun, manAge, stagesInAgeRange,
} from "../../src/engine/personalize/life-stage"

describe("만 나이", () => {
  it("생일 전날은 한 살 적고 생일에 더해진다", () => {
    const b = { year: 1990, month: 5, day: 15 }
    expect(manAge(b, { year: 2026, month: 5, day: 14 })).toBe(35)
    expect(manAge(b, { year: 2026, month: 5, day: 15 })).toBe(36)
    expect(manAge(b, { year: 2026, month: 1, day: 1 })).toBe(35)
    expect(manAge(b, { year: 1990, month: 5, day: 15 })).toBe(0)
  })
  it("2월 29일생은 평년에는 3월 1일에 나이를 더한다", () => {
    const b = { year: 2000, month: 2, day: 29 }
    expect(manAge(b, { year: 2025, month: 2, day: 28 })).toBe(24)
    expect(manAge(b, { year: 2025, month: 3, day: 1 })).toBe(25)
    expect(manAge(b, { year: 2024, month: 2, day: 29 })).toBe(24)
  })
  it("미래 출생은 오류", () => {
    expect(() => manAge({ year: 2030, month: 1, day: 1 }, { year: 2026, month: 1, day: 1 })).toThrow(RangeError)
  })
  it("기준 시각은 한국 날짜로 환산(UTC 15시 이후는 한국 다음 날)", () => {
    expect(koreanDateOf(new Date("2026-05-14T14:59:59Z"))).toEqual({ year: 2026, month: 5, day: 14 })
    expect(koreanDateOf(new Date("2026-05-14T15:00:00Z"))).toEqual({ year: 2026, month: 5, day: 15 })
    expect(() => koreanDateOf(new Date("invalid"))).toThrow(RangeError)
  })
})

describe("인생 단계 경계", () => {
  const cases: [number, string][] = [
    [0, "early_childhood"], [6, "early_childhood"], [7, "elementary"], [12, "elementary"],
    [13, "secondary"], [18, "secondary"], [19, "young_adult"], [24, "young_adult"],
    [25, "early_career"], [34, "early_career"], [35, "establishment"], [44, "establishment"],
    [45, "midlife_transition"], [54, "midlife_transition"], [55, "pre_retirement"], [64, "pre_retirement"],
    [65, "senior"], [99, "senior"],
  ]
  for (const [age, id] of cases) it(`만 ${age}세 = ${id}`, () => expect(lifeStageOfAge(age).id).toBe(id))
  it("잘못된 나이는 오류", () => {
    expect(() => lifeStageOfAge(-1)).toThrow(RangeError)
    expect(() => lifeStageOfAge(3.5)).toThrow(RangeError)
  })
  it("단계 구간은 빈틈·겹침이 없다", () => {
    for (let i = 1; i < LIFE_STAGES.length; i++) expect(LIFE_STAGES[i]!.minAge).toBe(LIFE_STAGES[i - 1]!.maxAge! + 1)
    expect(LIFE_STAGES[LIFE_STAGES.length - 1]!.maxAge).toBeNull()
  })
  it("stagesInAgeRange: 걸친 단계를 모두 반환", () => {
    expect(stagesInAgeRange(17, 26)).toEqual(["secondary", "young_adult", "early_career"])
    expect(stagesInAgeRange(25, 25)).toEqual(["early_career"])
    expect(stagesInAgeRange(70, 79)).toEqual(["senior"])
  })
})

describe("대운 구간 매핑", () => {
  const chart = computeChart({ calendar: "solar", year: 1990, month: 5, day: 15, time: { hour: 12, minute: 0 }, gender: "M" })
  const list = chart.luck.daeun
  const s0 = list[0]!.startAge

  it("첫 대운 시작 전은 before, next는 첫 대운", () => {
    if (s0 > 0) {
      const p = locateDaeun(chart, s0 - 1)
      expect(p.phase).toBe("before")
      expect(p.current).toBeNull()
      expect(p.next?.index).toBe(1)
    }
  })
  it("대운 경계: 시작 나이에 새 대운, 직전 나이는 이전 대운", () => {
    expect(locateDaeun(chart, s0).current?.index).toBe(1)
    expect(locateDaeun(chart, s0 + 9).current?.index).toBe(1)
    expect(locateDaeun(chart, s0 + 10).current?.index).toBe(2)
    expect(locateDaeun(chart, s0 + 10).next?.index).toBe(3)
  })
  it("구간 연도·간지는 엔진 값 그대로", () => {
    const cur = locateDaeun(chart, s0 + 15).current!
    expect(cur.pillar).toEqual(list[1]!.pillar)
    expect(cur.yearFrom).toBe(list[1]!.startYear)
    expect(cur.yearTo).toBe(list[1]!.startYear + 9)
    expect(cur.ageTo - cur.ageFrom).toBe(9)
  })
  it("마지막 대운 이후는 after", () => {
    const last = list[list.length - 1]!
    expect(locateDaeun(chart, last.startAge + 9).next).toBeNull()
    expect(locateDaeun(chart, last.startAge + 10).phase).toBe("after")
  })
})

describe("시대 배경", () => {
  it("태어난 뒤 사건만, 당시 나이 포함", () => {
    const e = eraBackgroundOf(1990, 2026)
    expect(e.find((x) => x.id === "imf-crisis")?.ageAtYearEnd).toBe(7)
    expect(e.some((x) => x.id === "seoul-olympics")).toBe(false)
    expect(e.every((x) => x.source === "era")).toBe(true)
    expect(eraBackgroundOf(2010, 2022).some((x) => x.id === "covid-19")).toBe(true)
    expect(eraBackgroundOf(2010, 2019).some((x) => x.id === "covid-19")).toBe(false)
  })
})
