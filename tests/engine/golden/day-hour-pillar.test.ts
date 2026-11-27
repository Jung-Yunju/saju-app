// 골든 ② 일주·시주·세운
// 일주 기대값: 독립 JDN 공식 60갑자 index = (JDN + 49) mod 60 (0=甲子).
// 시주 기대값: 五鼠遁. 진태양시 영향을 없애려고 computeChart는 trueSolarTime:false로 호출한다.
import { describe, expect, it } from "vitest"
import { computeChart, dayPillarOf, yearPillarOf } from "@/engine"
import {
  dateToDayNumber, dayNumberToDate, dayPillarOracle, hourBranchIndex, hourPillarOracle, localToUtcCandidates, randInt, rng,
  yearPillarOracle,
} from "./oracle"
import { assertNoFailures, collect, fmtP, lbl, samePillar, SEOUL, solarInput } from "./helpers"

const lo = dateToDayNumber(1900, 1, 1)
const hi = dateToDayNumber(2100, 12, 31)
const r = rng(0x50_34_02)
const dates = Array.from({ length: 500 }, () => dayNumberToDate(randInt(r, lo, hi)))
const dl = (d: { year: number; month: number; day: number }) => `${d.year}-${d.month}-${d.day}`

describe("골든 ② 일주 dayPillarOf", () => {
  it("기준일: 2000-01-01 戊午, 1900-01-01 甲戌, 2100-12-31", () => {
    expect(dayPillarOf(2000, 1, 1)).toEqual({ stem: "戊", branch: "午" })
    expect(dayPillarOf(1900, 1, 1)).toEqual({ stem: "甲", branch: "戌" })
    expect(dayPillarOf(2100, 12, 31)).toEqual(dayPillarOracle(2100, 12, 31))
  })

  it("1900~2100 무작위 500일 (고정 시드)", () => {
    const fails = collect(dates, dl, (d) => {
      const got = dayPillarOf(d.year, d.month, d.day)
      const exp = dayPillarOracle(d.year, d.month, d.day)
      return samePillar(got, exp) ? null : `엔진 ${fmtP(got)} / 기대 ${fmtP(exp)}`
    })
    assertNoFailures(fails, dates.length, "일주")
  })
})

describe("골든 ② 세운 yearPillarOf (입춘 기준 간지 연도)", () => {
  it("1900~2100 전 연도", () => {
    const ys = Array.from({ length: 201 }, (_, i) => 1900 + i)
    const fails = collect(ys, String, (y) => {
      const got = yearPillarOf(y)
      const exp = yearPillarOracle(y)
      return samePillar(got, exp) ? null : `엔진 ${fmtP(got)} / 기대 ${fmtP(exp)}`
    })
    assertNoFailures(fails, ys.length, "세운")
  })
})

describe("골든 ② computeChart 일주·시주 (trueSolarTime:false)", () => {
  // 1912~2100, 시각은 00:00~22:59 무작위(23시대 자시는 true-solar-zi.test.ts에서 별도 검증).
  const rr = rng(0x50_34_03)
  const lo2 = dateToDayNumber(1912, 1, 1)
  const samples = Array.from({ length: 150 }, () => {
    const d = dayNumberToDate(randInt(rr, lo2, hi))
    return { ...d, hour: randInt(rr, 0, 22), minute: randInt(rr, 0, 59), gender: rr() < 0.5 ? ("M" as const) : ("F" as const) }
  }).filter((s) => localToUtcCandidates(s, SEOUL).length === 1) // 서머타임 공백·중복 시각 제외

  it(`일주 = 현지 법정 날짜의 JDN 일주 (${samples.length}건)`, () => {
    const fails = collect(samples, lbl, (s) => {
      const c = computeChart(solarInput(s, s.gender), { trueSolarTime: false })
      const exp = dayPillarOracle(s.year, s.month, s.day)
      return samePillar(c.pillars.day, exp) ? null : `엔진 ${fmtP(c.pillars.day)} / 기대 ${fmtP(exp)}`
    })
    assertNoFailures(fails, samples.length, "computeChart 일주")
  })

  it(`시주 = 五鼠遁(일간 × 시지) (${samples.length}건)`, () => {
    const fails = collect(samples, lbl, (s) => {
      const c = computeChart(solarInput(s, s.gender), { trueSolarTime: false })
      const day = dayPillarOracle(s.year, s.month, s.day)
      const exp = hourPillarOracle(day.stem, hourBranchIndex(s.hour, s.minute))
      return samePillar(c.pillars.hour, exp) ? null : `엔진 ${fmtP(c.pillars.hour)} / 기대 ${fmtP(exp)}`
    })
    assertNoFailures(fails, samples.length, "computeChart 시주")
  })
})
