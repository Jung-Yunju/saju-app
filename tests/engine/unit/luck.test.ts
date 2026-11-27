// 대운 단위 테스트 (P3-07)
// 근거: 절기 시각은 한국천문연구원 역서(KST) — 2024 小寒 01-06 05:49, 立春 02-04 17:27, 驚蟄 03-05 11:23.
// 일수는 손계산(2024는 윤년, 2월 29일까지). 분 단위 절기 시각이므로 startAgeExact는 ±0.01년 허용.
import { describe, expect, it } from "vitest"
import { computeChart, type BirthInput, type Pillar } from "@/engine"

const gz = (p: Pillar) => p.stem + p.branch
const birth = (hour: number, minute: number, gender: "M" | "F"): BirthInput => ({
  calendar: "solar", year: 2024, month: 2, day: 4, time: { hour, minute }, gender,
})

describe("대운 순행", () => {
  it("2024-02-04 17:40 KST 남자: 甲(양간)·남 → 순행, 驚蟄까지 29일 17시간 43분 ÷ 3 ≈ 9.91 → 10", () => {
    // 02-04 17:40 → 03-04 17:40 = 29일(2024-02는 29일) + 17:40→익일 11:23 = 17h43m
    const days = 29 + (17 * 60 + 43) / 1440 // 29.738
    const r = computeChart(birth(17, 40, "M"))
    expect(r.luck.direction).toBe("forward")
    expect(Math.abs(r.luck.startAgeExact - days / 3)).toBeLessThan(0.01)
    expect(r.luck.startAge).toBe(10)
    expect(r.luck.daeun).toHaveLength(10)
    // 월주 丙寅에서 +1씩: 丁卯, 戊辰, 己巳 …
    expect(r.luck.daeun.slice(0, 3).map((d) => gz(d.pillar))).toEqual(["丁卯", "戊辰", "己巳"])
    expect(gz(r.luck.daeun[9].pillar)).toBe("丙子") // 丙寅(2)+10 = 12 = 丙子
    expect(r.luck.daeun[0]).toMatchObject({ index: 1, startAge: 10, startYear: 2034 })
    expect(r.luck.daeun[1]).toMatchObject({ index: 2, startAge: 20, startYear: 2044 })
  })

  it("luckRounding floor → 9", () => {
    const r = computeChart(birth(17, 40, "M"), { luckRounding: "floor" })
    expect(r.luck.startAge).toBe(9)
    expect(r.luck.daeun[0].startYear).toBe(2033)
  })
})

describe("대운 역행", () => {
  it("2024-02-04 17:00 KST 남자: 癸(음간)·남 → 역행, 小寒부터 29일 11시간 11분 ÷ 3 ≈ 9.82 → 10", () => {
    // 01-06 05:49 → 02-04 05:49 = 29일, 05:49 → 17:00 = 11h11m
    const days = 29 + (11 * 60 + 11) / 1440 // 29.466
    const r = computeChart(birth(17, 0, "M"))
    expect(r.luck.direction).toBe("backward")
    expect(Math.abs(r.luck.startAgeExact - days / 3)).toBeLessThan(0.01)
    expect(r.luck.startAge).toBe(10)
    // 월주 乙丑에서 −1씩: 甲子, 癸亥, 壬戌 …
    expect(r.luck.daeun.slice(0, 3).map((d) => gz(d.pillar))).toEqual(["甲子", "癸亥", "壬戌"])
    expect(r.luck.daeun[0].startYear).toBe(2034)
  })

  it("양간·여 → 역행: 2024-02-04 17:40 여자는 立春(17:27)까지 13분 → 대운수 0", () => {
    const r = computeChart(birth(17, 40, "F"))
    expect(r.luck.direction).toBe("backward")
    expect(r.luck.startAgeExact).toBeLessThan(0.01)
    expect(r.luck.startAge).toBe(0)
    expect(gz(r.luck.daeun[0].pillar)).toBe("乙丑") // 丙寅 − 1
  })

  it("음간·여 → 순행: 2024-02-04 17:00 여자", () => {
    expect(computeChart(birth(17, 0, "F")).luck.direction).toBe("forward")
  })
})
