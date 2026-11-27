// 골든 ⑤ 한국 음력 → 양력 (computeChart calendar:"lunar" → solarDate)
// 데이터: lunar-golden.json (생성: node scripts/qa/golden-lunar-gen.mjs)
//   - 2000~2030 설날(음 1/1)·추석(음 8/15) 62건 + 1997 설날 + 기타 공식 월력요항 기념일 7건 + 윤달 1일·말일 24건
//   - 기대값은 독립 오라클(UTC+9 합삭·중기)이며, 웹 확인값(공식 월력요항·KASI 달력자료 검색 인용, 2차 자료)과 전부 일치함을 생성 시 검사
//   - 한·중 음력 차이(오라클 UTC+9 vs UTC+8) 달은 한국 값으로 따로 검사 — 중국 기준 라이브러리를 그대로 쓰면 여기서 실패한다
import { describe, expect, it } from "vitest"
import { computeChart } from "@/engine"
import data from "./lunar-golden.json"
import { assertNoFailures, collect, SEOUL } from "./helpers"

type L = { year: number; month: number; day: number; isLeapMonth: boolean }
const lunarChart = (l: L) =>
  computeChart(
    { calendar: "lunar", year: l.year, month: l.month, day: l.day, isLeapMonth: l.isLeapMonth, time: { hour: 12, minute: 0 }, timezone: SEOUL, gender: "M" },
    { trueSolarTime: false },
  )
const iso = (d: { year: number; month: number; day: number }) => `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`
const ll = (l: L) => `음력 ${l.year}-${l.isLeapMonth ? "윤" : ""}${l.month}-${l.day}`

describe("골든 ⑤ 한국 음력", () => {
  it("데이터 규모: 설·추석 20개 연도 이상, 웹 확인 연도 20개 이상, 윤달 2건 이상, 한·중 차이 포함", () => {
    const seol = data.cases.filter((c) => c.kind === "seollal" && c.lunar.year >= 2000 && c.lunar.year <= 2030)
    const chu = data.cases.filter((c) => c.kind === "chuseok")
    expect(seol.length).toBeGreaterThanOrEqual(20)
    expect(chu.length).toBeGreaterThanOrEqual(20)
    const webYears = new Set(data.cases.filter((c) => c.sources.length > 0 && c.lunar.year >= 2000 && c.lunar.year <= 2030).map((c) => c.lunar.year))
    expect(webYears.size).toBeGreaterThanOrEqual(20)
    expect(data.cases.filter((c) => c.kind === "leap" && c.sources.length > 0).length).toBeGreaterThanOrEqual(2)
    expect(data.koreaChinaDiffs.length).toBeGreaterThan(0)
  })

  for (const kind of ["seollal", "chuseok", "other", "leap"] as const) {
    const cases = data.cases.filter((c) => c.kind === kind)
    it(`${kind}: 음력→양력 solarDate (${cases.length}건)`, () => {
      const fails = collect(cases, (c) => `${ll(c.lunar)}${c.sources.length ? " [웹확인]" : ""}`, (c) => {
        const got = lunarChart(c.lunar).solarDate
        return iso(got) === c.solar ? null : `엔진 ${iso(got)} / 기대 ${c.solar}`
      })
      assertNoFailures(fails, cases.length, kind)
    })
  }

  it("음력 입력 시 lunarDate는 입력값을 그대로 돌려줌 (왕복)", () => {
    const fails = collect(data.cases, (c) => ll(c.lunar), (c) => {
      const got = lunarChart(c.lunar).lunarDate
      const ok = got.year === c.lunar.year && got.month === c.lunar.month && got.day === c.lunar.day && got.isLeapMonth === c.lunar.isLeapMonth
      return ok ? null : `엔진 ${JSON.stringify(got)}`
    })
    assertNoFailures(fails, data.cases.length, "lunarDate 왕복")
  })

  it("양력 입력 → lunarDate (같은 표본의 역방향)", () => {
    const fails = collect(data.cases, (c) => `${c.solar} (${ll(c.lunar)})`, (c) => {
      const [y, m, d] = c.solar.split("-").map(Number)
      const got = computeChart({ calendar: "solar", year: y, month: m, day: d, time: { hour: 12, minute: 0 }, timezone: SEOUL, gender: "F" }, { trueSolarTime: false }).lunarDate
      const ok = got.year === c.lunar.year && got.month === c.lunar.month && got.day === c.lunar.day && got.isLeapMonth === c.lunar.isLeapMonth
      return ok ? null : `엔진 ${JSON.stringify(got)}`
    })
    assertNoFailures(fails, data.cases.length, "양력→음력")
  })

  it(`한·중 음력이 다른 달의 1일은 한국 기준 (${data.koreaChinaDiffs.length}건: 1997 설날, 2012 윤3월, 2017 윤5월, 2027·2028 설날 등)`, () => {
    const parse = (k: string): L => {
      const [y, mm] = k.split("-")
      const leap = mm.startsWith("L")
      return { year: Number(y), month: Number(leap ? mm.slice(1) : mm), day: 1, isLeapMonth: leap }
    }
    const fails = collect(data.koreaChinaDiffs, (d) => `${d.month} (한 ${d.koreaDay1} / 중 ${d.chinaDay1 ?? "해당 달 없음"})`, (d) => {
      const got = iso(lunarChart(parse(d.month)).solarDate)
      return got === d.koreaDay1 ? null : `엔진 ${got}${got === d.chinaDay1 ? " (중국 음력 값)" : ""}`
    })
    assertNoFailures(fails, data.koreaChinaDiffs.length, "한·중 차이")
  })

  it("2017 윤5월·2012 윤3월 존재 (중국 음력은 각각 閏六月·閏四月)", () => {
    expect(iso(lunarChart({ year: 2017, month: 5, day: 1, isLeapMonth: true }).solarDate)).toBe("2017-06-24")
    expect(iso(lunarChart({ year: 2012, month: 3, day: 1, isLeapMonth: true }).solarDate)).toBe("2012-04-21")
  })
})
