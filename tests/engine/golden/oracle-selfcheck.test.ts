// 오라클 자체 점검 — 엔진 없이 실행된다. 오라클이 공개 기준값을 재현하는지 먼저 확인한다.
import { describe, expect, it } from "vitest"
import data from "./lunar-golden.json"
import {
  dayPillarOracle, hourPillarOracle, jdn, localToUtcCandidates, lunarMonthsOracle, lunarToSolarOracle,
  monthPillarOracle, sexagenaryIndex, solarTermsOracle, utcOffsetMinutesAt, yearMonthPillarsOracle, yearPillarOracle,
} from "./oracle"
import { SEOUL } from "./helpers"

const MIN = 60_000
const kst = (y: number, mo: number, d: number, h: number, mi: number) => Date.UTC(y, mo - 1, d, h - 9, mi)

describe("오라클 자체 점검 (엔진 불필요)", () => {
  it("2024 立春 = 2024-02-04 08:27 UTC(=17:27 KST) ±2분 [총괄실장 지시 기준값; 일본 국립천문대·민간 자료 검색 인용과 일치]", () => {
    const t = solarTermsOracle(2024).find((x) => x.name === "立春")!
    expect(Math.abs(t.ms - Date.UTC(2024, 1, 4, 8, 27))).toBeLessThanOrEqual(2 * MIN)
  })

  it("KASI 달력자료 인용값: 2026 立春 02-04 05:02 KST, 2028 立春 02-04 16:31 KST (±2분)", () => {
    // 출처: https://astro.kasi.re.kr/life/post/calendarData (웹 검색 인용, 원문 직접 열람 불가)
    const t26 = solarTermsOracle(2026).find((x) => x.name === "立春")!
    const t28 = solarTermsOracle(2028).find((x) => x.name === "立春")!
    expect(Math.abs(t26.ms - kst(2026, 2, 4, 5, 2))).toBeLessThanOrEqual(2 * MIN)
    expect(Math.abs(t28.ms - kst(2028, 2, 4, 16, 31))).toBeLessThanOrEqual(2 * MIN)
  })

  it("한 해에 24절기, 시간순, 황경 15° 간격 이름 매핑", () => {
    for (const y of [1900, 1955, 2000, 2024, 2100]) {
      const ts = solarTermsOracle(y)
      expect(ts).toHaveLength(24)
      expect(ts[0].name).toBe("小寒")
      expect(ts[23].name).toBe("冬至")
      for (let i = 1; i < 24; i++) expect(ts[i].ms).toBeGreaterThan(ts[i - 1].ms)
    }
    const names = Object.fromEntries(solarTermsOracle(2024).map((t) => [t.longitude, t.name]))
    expect(names[0]).toBe("春分")
    expect(names[315]).toBe("立春")
    expect(names[345]).toBe("驚蟄")
    expect(names[270]).toBe("冬至")
  })

  it("JDN·일주 기준일: 2000-01-01 戊午, 1900-01-01 甲戌", () => {
    expect(jdn(2000, 1, 1)).toBe(2451545)
    expect(dayPillarOracle(2000, 1, 1)).toEqual({ stem: "戊", branch: "午" })
    expect(dayPillarOracle(1900, 1, 1)).toEqual({ stem: "甲", branch: "戌" })
  })

  it("연주·五虎遁·五鼠遁 표", () => {
    expect(yearPillarOracle(1984)).toEqual({ stem: "甲", branch: "子" })
    expect(yearPillarOracle(2024)).toEqual({ stem: "甲", branch: "辰" })
    expect(monthPillarOracle("甲", 0)).toEqual({ stem: "丙", branch: "寅" })
    expect(monthPillarOracle("乙", 0)).toEqual({ stem: "戊", branch: "寅" })
    expect(monthPillarOracle("丙", 0)).toEqual({ stem: "庚", branch: "寅" })
    expect(monthPillarOracle("丁", 0)).toEqual({ stem: "壬", branch: "寅" })
    expect(monthPillarOracle("戊", 0)).toEqual({ stem: "甲", branch: "寅" })
    expect(monthPillarOracle("甲", 11)).toEqual({ stem: "丁", branch: "丑" })
    expect(hourPillarOracle("甲", 0)).toEqual({ stem: "甲", branch: "子" })
    expect(hourPillarOracle("戊", 0)).toEqual({ stem: "壬", branch: "子" })
    expect(hourPillarOracle("癸", 11)).toEqual({ stem: "癸", branch: "亥" })
    expect(sexagenaryIndex({ stem: "癸", branch: "亥" })).toBe(59)
  })

  it("立春 직전·직후 연주/월주 전환 (2024: 癸卯年 乙丑月 → 甲辰年 丙寅月)", () => {
    const t = solarTermsOracle(2024).find((x) => x.name === "立春")!
    const before = yearMonthPillarsOracle(t.ms - 10 * MIN)
    const after = yearMonthPillarsOracle(t.ms + 10 * MIN)
    expect(before.year).toEqual({ stem: "癸", branch: "卯" })
    expect(before.month).toEqual({ stem: "乙", branch: "丑" })
    expect(after.year).toEqual({ stem: "甲", branch: "辰" })
    expect(after.month).toEqual({ stem: "丙", branch: "寅" })
  })

  it("Intl 시간대 이력 = IANA tzdb Asia/Seoul 규칙", () => {
    expect(utcOffsetMinutesAt(Date.UTC(1955, 6, 15, 3), SEOUL)).toBe(570)
    expect(utcOffsetMinutesAt(Date.UTC(1960, 0, 15, 3), SEOUL)).toBe(510)
    expect(utcOffsetMinutesAt(Date.UTC(1962, 6, 15, 3), SEOUL)).toBe(540)
    expect(utcOffsetMinutesAt(Date.UTC(1987, 6, 15, 3), SEOUL)).toBe(600)
    expect(utcOffsetMinutesAt(Date.UTC(1988, 6, 15, 3), SEOUL)).toBe(600)
    // 1987-05-10 02:00 서머타임 시작 → 02:30은 존재하지 않음, 1987-10-11 03:00 종료 → 02:30은 두 번
    expect(localToUtcCandidates({ year: 1987, month: 5, day: 10, hour: 2, minute: 30 }, SEOUL)).toHaveLength(0)
    expect(localToUtcCandidates({ year: 1987, month: 10, day: 11, hour: 2, minute: 30 }, SEOUL)).toHaveLength(2)
  })

  it("음력 골든 JSON = 오라클 재계산값, 웹 확인값과도 일치", () => {
    for (const c of data.cases) {
      const s = lunarToSolarOracle(c.lunar.year, c.lunar.month, c.lunar.day, c.lunar.isLeapMonth)!
      const iso = `${s.year}-${String(s.month).padStart(2, "0")}-${String(s.day).padStart(2, "0")}`
      expect(iso, JSON.stringify(c.lunar)).toBe(c.solar)
      for (const src of c.sources) if (src.solar) expect(src.solar).toBe(c.solar)
    }
    for (const c of data.invalid) {
      expect(lunarToSolarOracle(c.lunar.year, c.lunar.month, c.lunar.day, c.lunar.isLeapMonth), JSON.stringify(c.lunar)).toBeNull()
    }
  })

  it("한·중 음력 차이 재현: 1997 설날(한 2/8·중 2/7), 2012 윤3월(중 閏四月), 2017 윤5월(중 閏六月)", () => {
    expect(lunarToSolarOracle(1997, 1, 1, false, 540)).toEqual({ year: 1997, month: 2, day: 8 })
    expect(lunarToSolarOracle(1997, 1, 1, false, 480)).toEqual({ year: 1997, month: 2, day: 7 })
    const leap = (off: number, y: number) => lunarMonthsOracle(y, y, off).find((m) => m.isLeap && m.lunarYear === y)?.month
    expect(leap(540, 2012)).toBe(3)
    expect(leap(480, 2012)).toBe(4)
    expect(leap(540, 2017)).toBe(5)
    expect(leap(480, 2017)).toBe(6)
  })
})
