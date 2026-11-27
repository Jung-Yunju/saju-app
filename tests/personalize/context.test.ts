import { describe, expect, it } from "vitest"
import { analyzeRules, computeChart } from "../../src/engine"
import type { BirthInput } from "../../src/engine"
import { buildPersonalContext } from "../../src/engine/personalize/context"

const NOW = new Date("2026-11-27T03:00:00Z")
const BIRTH: BirthInput = { calendar: "solar", year: 1990, month: 5, day: 15, time: { hour: 12, minute: 0 }, gender: "M" }
const chart = computeChart(BIRTH)

const ANSWERS = [
  { questionId: "relationshipStatus", values: ["married"] },
  { questionId: "mbti", values: ["INFP"] },
  { questionId: "lifeEvents", values: ["marriage", "job_change"], years: { marriage: 2016, job_change: 2016 } },
  { questionId: "concernTopic", values: ["money"] },
]

describe("buildPersonalContext 분리 구조", () => {
  const ctx = buildPersonalContext(chart, ANSWERS, NOW)

  it("chart 배열에는 source:chart만, user 배열에는 source:user만", () => {
    expect(ctx.chartTendencies.length).toBeGreaterThan(0)
    expect(ctx.chartTendencies.every((t) => t.source === "chart")).toBe(true)
    expect(ctx.userFacts.length).toBe(5)
    expect(ctx.userFacts.every((f) => f.source === "user")).toBe(true)
  })
  it("사용자 답이 chart 쪽 어디에도 새지 않는다", () => {
    const chartJson = JSON.stringify(ctx.chartTendencies)
    for (const leak of ["married", "INFP", "marriage", "job_change", "money", "relationshipStatus"]) {
      expect(chartJson.includes(leak), leak).toBe(false)
    }
  })
  it("사주 경향이 user 쪽 어디에도 새지 않는다", () => {
    const userJson = JSON.stringify(ctx.userFacts)
    expect(userJson.includes("daeun")).toBe(false)
    expect(userJson.includes("chart")).toBe(false)
  })
  it("모든 사용자 사실은 배경 전용·자기보고", () => {
    expect(ctx.userFacts.every((f) => f.useAs === "background-only" && f.selfReported)).toBe(true)
    expect(ctx.guards.some((g) => g.includes("MBTI") && g.includes("판정하지 않"))).toBe(true)
  })
  it("연도가 걸린 사실은 noGuessYears에 오른다", () => {
    expect(ctx.noGuessYears).toEqual([{ year: 2016, factIds: ["life_event:marriage", "life_event:job_change"] }])
    const marriage = ctx.userFacts.find((f) => f.id === "life_event:marriage")!
    expect(marriage.period).toEqual({ fromYear: 2016, toYear: 2016 })
    expect(ctx.userFacts.find((f) => f.topic === "mbti")!.period).toBeUndefined()
  })
  it("나이·단계·건너뜀", () => {
    expect(ctx.subject.birthYear).toBe(1990)
    expect(ctx.subject.ageManNow).toBe(36)
    expect(ctx.subject.lifeStage.id).toBe("establishment")
    expect(ctx.skippedQuestionIds).toContain("horizon")
    expect(ctx.skippedQuestionIds).not.toContain("mbti")
  })
  it("식별정보(월일·이름)가 담기지 않는다", () => {
    const j = JSON.stringify(ctx)
    expect(j).not.toContain("1990-05-15")
    expect(j).not.toContain("solarDate")
    expect(ctx.subject).not.toHaveProperty("birthDate")
  })
  it("같은 입력이면 같은 결과", () => {
    expect(buildPersonalContext(chart, ANSWERS, NOW)).toEqual(ctx)
  })
})

describe("건너뛴 문항·잘못된 응답", () => {
  it("응답이 없으면 userFacts·noGuessYears가 비고 사실을 만들지 않는다", () => {
    const ctx = buildPersonalContext(chart, undefined, NOW)
    expect(ctx.userFacts).toEqual([])
    expect(ctx.noGuessYears).toEqual([])
    // 전체 17문항(기존 12 + D-023 ① 살아온 모습 5) — survey.ts·lived-life.md §1 독립 대조(QA 2026-11-28)
    expect(ctx.skippedQuestionIds.length).toBe(17)
    for (const id of ["workStyle", "recentChanges", "selfStrength", "selfWeakness", "changeWish"]) expect(ctx.skippedQuestionIds).toContain(id)
    expect(ctx.chartTendencies.length).toBeGreaterThan(0)
  })
  it("건너뜀 표시 응답은 사실이 되지 않는다", () => {
    const ctx = buildPersonalContext(chart, [{ questionId: "relationshipStatus", skipped: true, values: [] }], NOW)
    expect(ctx.userFacts).toEqual([])
  })
  it("검증 실패 응답은 쓰지 않고 rejectedAnswers에 남는다(다른 응답은 유지)", () => {
    const ctx = buildPersonalContext(
      chart,
      [{ questionId: "mbti", values: ["XXXX"] }, { questionId: "horizon", values: ["this_year"] }],
      NOW,
    )
    expect(ctx.userFacts.map((f) => f.topic)).toEqual(["horizon"])
    expect(ctx.rejectedAnswers[0]!.code).toBe("invalid_option")
  })
  it("연도 없는 사건은 사실로는 남지만 noGuessYears에는 없다", () => {
    const ctx = buildPersonalContext(chart, [{ questionId: "lifeEvents", values: ["marriage"] }], NOW)
    expect(ctx.userFacts[0]!.period).toBeUndefined()
    expect(ctx.noGuessYears).toEqual([])
  })
  it("출생 이전·미래 연도 응답은 거부", () => {
    const ctx = buildPersonalContext(chart, [{ questionId: "lifeEvents", values: ["marriage"], years: { marriage: 1980 } }], NOW)
    expect(ctx.userFacts).toEqual([])
    expect(ctx.rejectedAnswers[0]!.code).toBe("year_invalid")
  })
})

describe("만 14세 미만", () => {
  it("설문 응답을 쓰지 않는다", () => {
    const kid = computeChart({ ...BIRTH, year: 2016 })
    const ctx = buildPersonalContext(kid, [{ questionId: "mbti", values: ["INFP"] }], NOW)
    expect(ctx.subject.ageManNow).toBe(10)
    expect(ctx.userFacts).toEqual([])
    expect(ctx.notes.some((n) => n.includes("14세"))).toBe(true)
  })
  it("만 14세 생일에 응답을 쓰기 시작한다", () => {
    const b = computeChart({ ...BIRTH, year: 2012, month: 11, day: 27 })
    expect(buildPersonalContext(b, [{ questionId: "mbti", values: ["INFP"] }], NOW).userFacts.length).toBe(1)
    const b2 = computeChart({ ...BIRTH, year: 2012, month: 11, day: 28 })
    expect(buildPersonalContext(b2, [{ questionId: "mbti", values: ["INFP"] }], NOW).userFacts.length).toBe(0)
  })
})

describe("대운 경향", () => {
  it("현재 대운 경향의 근거는 chart 대운 간지와 같다", () => {
    const ctx = buildPersonalContext(chart, undefined, NOW)
    const cur = ctx.chartTendencies.find((t) => t.kind === "daeun-current")
    expect(cur).toBeDefined()
    const d = chart.luck.daeun.find((x) => x.index === cur!.detail.index)!
    expect(cur!.basis.map((b) => b.char)).toEqual([d.pillar.stem, d.pillar.branch])
    expect(cur!.period).toEqual({ fromYear: d.startYear, toYear: d.startYear + 9 })
  })
  it("규칙 분석을 주면 현재 대운의 십성 판정이 chart 경향으로 옮겨진다", () => {
    const base = buildPersonalContext(chart, undefined, NOW)
    const cur = base.chartTendencies.find((t) => t.kind === "daeun-current")!
    const idx = (cur.detail.index as number) - 1
    const analysis = analyzeRules(chart, undefined, { luck: chart.luck.daeun.map((d) => d.pillar) })
    const ctx = buildPersonalContext(chart, ANSWERS, NOW, analysis)
    const tg = ctx.chartTendencies.filter((t) => t.kind === "daeun-tengod")
    expect(tg.length).toBeGreaterThan(0)
    expect(tg.every((t) => t.source === "chart" && t.basis[0]!.luckIndex === idx)).toBe(true)
    expect(ctx.userFacts.length).toBe(5)
  })
})
