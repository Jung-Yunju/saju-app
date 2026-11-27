import { describe, expect, it } from "vitest"
import { SURVEY_QUESTIONS, getQuestion, questionsForProduct, validateAnswers } from "../../src/engine/personalize/survey"
import { PRODUCTS } from "../../src/engine/personalize/types"

describe("설문 정의", () => {
  it("문항은 15개 이내, id 중복 없음, 모두 건너뛰기 가능", () => {
    expect(SURVEY_QUESTIONS.length).toBeLessThanOrEqual(15)
    expect(new Set(SURVEY_QUESTIONS.map((q) => q.id)).size).toBe(SURVEY_QUESTIONS.length)
    expect(SURVEY_QUESTIONS.every((q) => q.skippable)).toBe(true)
  })
  it("자유 서술 없음: 모든 문항에 선택지가 있고 값이 중복되지 않음", () => {
    for (const q of SURVEY_QUESTIONS) {
      expect(q.options.length).toBeGreaterThan(1)
      expect(new Set(q.options.map((o) => o.value)).size).toBe(q.options.length)
    }
  })
  it("민감정보(건강·종교·성적 지향·정치) 문항이 없음", () => {
    const text = JSON.stringify(SURVEY_QUESTIONS)
    for (const w of ["건강", "병", "종교", "교회", "성적", "정치", "지지 정당", "이혼", "사별"]) {
      expect(text.includes(w), w).toBe(false)
    }
  })
  it("모든 문항은 최소 1개 상품에서 쓰인다(안 쓰는 문항 금지)", () => {
    for (const q of SURVEY_QUESTIONS) expect(Object.keys(q.products).length).toBeGreaterThan(0)
  })
  it("questionsForProduct: 필수가 앞에 온다", () => {
    for (const p of PRODUCTS) {
      const list = questionsForProduct(p)
      const firstOptional = list.findIndex((x) => x.need === "optional")
      if (firstOptional >= 0) expect(list.slice(firstOptional).every((x) => x.need === "optional")).toBe(true)
    }
    expect(questionsForProduct("love")[0]!.need).toBe("required")
  })
})

describe("validateAnswers", () => {
  it("응답이 없으면 전부 건너뜀, ok", () => {
    const r = validateAnswers(undefined)
    expect(r.ok).toBe(true)
    expect(r.valid).toEqual([])
    expect(r.skippedQuestionIds.length).toBe(SURVEY_QUESTIONS.length)
  })
  it("정상 단일·복수·연도 응답 통과", () => {
    const r = validateAnswers(
      [
        { questionId: "relationshipStatus", values: ["married"] },
        { questionId: "concernTopic", values: ["love", "money"] },
        { questionId: "lifeEvents", values: ["marriage", "job_change"], years: { marriage: 2015 } },
      ],
      { birthYear: 1985, nowYear: 2026 },
    )
    expect(r.ok).toBe(true)
    expect(r.valid.length).toBe(3)
    expect(r.valid[2]!.years).toEqual({ marriage: 2015 })
  })
  it("건너뜀(skipped:true, 빈 values)은 문제가 아니고 skipped에 포함", () => {
    const r = validateAnswers([
      { questionId: "mbti", skipped: true, values: [] },
      { questionId: "horizon", values: [] },
    ])
    expect(r.ok).toBe(true)
    expect(r.valid).toEqual([])
    expect(r.skippedQuestionIds).toContain("mbti")
    expect(r.skippedQuestionIds).toContain("horizon")
  })
  it("건너뜀인데 값이 있으면 거부", () => {
    const r = validateAnswers([{ questionId: "mbti", skipped: true, values: ["INTJ"] }])
    expect(r.ok).toBe(false)
    expect(r.issues[0]!.code).toBe("skipped_with_values")
    expect(r.valid).toEqual([])
  })
  it("없는 문항·없는 선택지·중복·초과·단일에 복수 값 거부", () => {
    const cases: [unknown, string][] = [
      [[{ questionId: "religion", values: ["x"] }], "unknown_question"],
      [[{ questionId: "mbti", values: ["ABCD"] }], "invalid_option"],
      [[{ questionId: "concernTopic", values: ["love", "love"] }], "duplicate_value"],
      [[{ questionId: "concernTopic", values: ["love", "money", "career"] }], "too_many"],
      [[{ questionId: "horizon", values: ["this_year", "whole_life"] }], "single_requires_one"],
      [[{ questionId: "horizon", values: ["this_year"], years: { this_year: 2020 } }], "years_not_allowed"],
      [[{ questionId: "lifeEvents", values: ["marriage"], years: { relocation: 2020 } }], "year_for_unselected"],
      [[{ questionId: "lifeEvents", values: ["marriage"], years: { marriage: 1800 } }], "year_invalid"],
      [[{ questionId: "lifeEvents", values: ["marriage"], years: { marriage: 2020.5 } }], "year_invalid"],
      [[{ questionId: "horizon", values: "this_year" }], "malformed"],
      [{ not: "array" }, "malformed"],
    ]
    for (const [input, code] of cases) {
      const r = validateAnswers(input)
      expect(r.ok, code).toBe(false)
      expect(r.issues.some((i) => i.code === code), code).toBe(true)
      expect(r.valid, code).toEqual([])
    }
  })
  it("출생 연도 이전·미래 연도 거부", () => {
    const opts = { birthYear: 1990, nowYear: 2026 }
    expect(validateAnswers([{ questionId: "lifeEvents", values: ["marriage"], years: { marriage: 1989 } }], opts).ok).toBe(false)
    expect(validateAnswers([{ questionId: "lifeEvents", values: ["marriage"], years: { marriage: 2027 } }], opts).ok).toBe(false)
    expect(validateAnswers([{ questionId: "lifeEvents", values: ["marriage"], years: { marriage: 2026 } }], opts).ok).toBe(true)
  })
  it("같은 문항 중복 응답은 첫 번째만 쓰고 이슈 기록", () => {
    const r = validateAnswers([
      { questionId: "horizon", values: ["this_year"] },
      { questionId: "horizon", values: ["whole_life"] },
    ])
    expect(r.valid).toEqual([{ questionId: "horizon", values: ["this_year"] }])
    expect(r.issues[0]!.code).toBe("duplicate_answer")
  })
  it("한 응답이 틀려도 다른 응답은 살아남고, 이슈에 원문 값이 없다", () => {
    const r = validateAnswers([
      { questionId: "mbti", values: ["SECRET-VALUE"] },
      { questionId: "horizon", values: ["this_year"] },
    ])
    expect(r.valid.map((a) => a.questionId)).toEqual(["horizon"])
    expect(JSON.stringify(r.issues)).not.toContain("SECRET-VALUE")
  })
  it("getQuestion", () => {
    expect(getQuestion("mbti")?.options.length).toBe(16)
    expect(getQuestion("nope")).toBeUndefined()
  })
})
