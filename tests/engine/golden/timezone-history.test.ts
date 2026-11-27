// 골든 ④ 한국 시간대 이력 — corrections.utcOffsetMinutes / dstApplied / utcInstant
//
// 기대값 근거: IANA tzdb `asia` 파일 Korea 절 (https://github.com/eggert/tz/blob/main/asia, 2026-11-27 열람)
//   Zone Asia/Seoul 8:27:52 LMT ~1908-04-01 / 8:30 KST ~1912-01-01 / 9:00 JST ~1945-09-08
//                   9:00 ROK K%sT ~1954-03-21 / 8:30 ROK K%sT ~1961-08-10 / 9:00 ROK K%sT
//   Rule ROK 1948 Jun 1 ~ Sep 12 24:00, 1949 Apr 3 ~ Sep Sat>=7 24:00, 1950 Apr 1 ~, 1951 May 6 ~ (SAVE 1:00)
//   Rule ROK 1955 May 5 ~ Sep 8 24:00, 1956 May 20 ~ Sep 29 24:00, 1957~1960 May Sun>=1 ~ Sep Sat>=17 24:00
//   Rule ROK 1987~1988 May Sun>=8 2:00 ~ Oct Sun>=8 3:00
//   tzdb 주석의 근거: 1954 대통령령 제876호, 1961 법률 제676호, 정부 기록물(theme.archives.go.kr) 서머타임 종료 공고.
// Node 내장 ICU tzdata(2026e)가 위 규칙과 일치함은 oracle-selfcheck에서 확인한다.
import { describe, expect, it } from "vitest"
import { computeChart } from "@/engine"
import { localToUtcUnique, utcOffsetMinutesAt } from "./oracle"
import { assertNoFailures, collect, lbl, SEOUL, solarInput } from "./helpers"

interface Case {
  local: { year: number; month: number; day: number; hour: number; minute: number }
  offset: number
  dst: boolean
  why: string
}
const C = (y: number, mo: number, d: number, h: number, mi: number, offset: number, dst: boolean, why: string): Case => ({
  local: { year: y, month: mo, day: d, hour: h, minute: mi }, offset, dst, why,
})

const cases: Case[] = [
  C(1949, 7, 15, 12, 0, 600, true, "1949 서머타임(4/3~9/10) UTC+10"),
  C(1953, 7, 15, 12, 0, 540, false, "1952~1954 서머타임 없음, UTC+9"),
  C(1954, 7, 15, 12, 0, 510, false, "1954-03-21부터 UTC+8:30, 1954년 서머타임 없음"),
  C(1955, 3, 1, 12, 0, 510, false, "1955 서머타임 시작(5/5) 전"),
  C(1955, 7, 15, 12, 0, 570, true, "1955 여름 서머타임 UTC+9:30"),
  C(1960, 1, 15, 12, 0, 510, false, "1960 겨울 UTC+8:30"),
  C(1960, 7, 15, 12, 0, 570, true, "1960 여름 서머타임 UTC+9:30"),
  C(1961, 9, 1, 12, 0, 540, false, "1961-08-10부터 UTC+9"),
  C(1962, 7, 15, 12, 0, 540, false, "1962 UTC+9, 서머타임 없음"),
  C(1987, 5, 9, 12, 0, 540, false, "1987 서머타임 시작(5/10 02:00) 전날"),
  C(1987, 5, 10, 3, 0, 600, true, "1987 서머타임 시작 직후"),
  C(1987, 7, 15, 12, 0, 600, true, "1987 여름 서머타임 UTC+10"),
  C(1987, 10, 12, 12, 0, 540, false, "1987 서머타임 종료(10/11 03:00) 다음 날"),
  C(1988, 5, 7, 12, 0, 540, false, "1988 서머타임 시작(5/8 02:00) 전날"),
  C(1988, 7, 15, 12, 0, 600, true, "1988 여름 서머타임 UTC+10"),
  C(2024, 7, 15, 12, 0, 540, false, "현행 UTC+9"),
]

describe("골든 ④ 한국 표준시·서머타임 이력", () => {
  it("기대값 검산: Intl(IANA tzdb)과 표의 오프셋 일치", () => {
    for (const c of cases) {
      const utc = localToUtcUnique(c.local, SEOUL)
      expect(utc, lbl(c.local)).not.toBeNull()
      expect(utcOffsetMinutesAt(utc!, SEOUL), lbl(c.local)).toBe(c.offset)
    }
  })

  it(`utcOffsetMinutes·dstApplied·utcInstant (${cases.length}건)`, () => {
    const fails = collect(cases, (c) => `${lbl(c.local)} [${c.why}]`, (c) => {
      const chart = computeChart(solarInput(c.local))
      const errs: string[] = []
      if (chart.corrections.utcOffsetMinutes !== c.offset) errs.push(`offset ${chart.corrections.utcOffsetMinutes}≠${c.offset}`)
      if (chart.corrections.dstApplied !== c.dst) errs.push(`dst ${chart.corrections.dstApplied}≠${c.dst}`)
      const expUtc = Date.UTC(c.local.year, c.local.month - 1, c.local.day, c.local.hour, c.local.minute) - c.offset * 60_000
      if (new Date(chart.utcInstant).getTime() !== expUtc) errs.push(`utcInstant ${chart.utcInstant}≠${new Date(expUtc).toISOString()}`)
      return errs.length ? errs.join(", ") : null
    })
    assertNoFailures(fails, cases.length, "시간대 이력")
  })

  it("timezone 생략 시 Asia/Seoul 기본값 (1987-07-15 12:00 → 600분, 서머타임)", () => {
    const chart = computeChart({ calendar: "solar", year: 1987, month: 7, day: 15, time: { hour: 12, minute: 0 }, gender: "F" })
    expect(chart.corrections.utcOffsetMinutes).toBe(600)
    expect(chart.corrections.dstApplied).toBe(true)
  })

  // 서머타임 공백·겹침 벽시계 시각: 2026-11-27 총괄실장 결정(compatible 규칙)으로 계약 확정 → dst-ambiguity.test.ts
})
