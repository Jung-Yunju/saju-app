// QA 독립 고정값: 설문 문항 수(전체·상품별)와 필수 문항.
// 근거: docs/knowledge/personalization/lived-life.md §1 표 + survey.ts 수기 대조(QA 2026-11-28).
// survey.test.ts의 "≤18 / 상품별 ≤12" 상한 단언은 느슨해서(18의 출처 없음) 문항이 몰래 늘어도 통과한다.
// 이 파일은 정확한 수를 고정한다. 문항을 바꾸면 문서와 함께 이 값을 갱신해야 한다.
import { describe, expect, it } from "vitest"
import { SURVEY_QUESTIONS, questionsForProduct } from "../../src/engine/personalize/survey"

const EXPECTED_TOTAL = 17
const EXPECTED_PER_PRODUCT = { free: 4, basic: 12, love: 12, money: 12, career: 11, compat: 6, concern: 11 } as const
const EXPECTED_REQUIRED: Record<keyof typeof EXPECTED_PER_PRODUCT, string[]> = {
  free: [],
  basic: [],
  love: ["relationshipStatus", "loveFocus"],
  money: ["occupationStatus", "moneyFocus"],
  career: ["occupationStatus", "careerFeeling", "workStyle"],
  compat: ["relationshipStatus"],
  concern: ["concernTopic", "changeWish"],
}

describe("설문 문항 수 고정(QA)", () => {
  it(`전체 ${EXPECTED_TOTAL}문항`, () => {
    expect(SURVEY_QUESTIONS.length).toBe(EXPECTED_TOTAL)
  })
  it("상품별 문항 수가 lived-life.md 표와 같다", () => {
    for (const [p, n] of Object.entries(EXPECTED_PER_PRODUCT)) {
      expect(questionsForProduct(p as keyof typeof EXPECTED_PER_PRODUCT).length, p).toBe(n)
    }
  })
  it("상품별 필수 문항", () => {
    for (const [p, ids] of Object.entries(EXPECTED_REQUIRED)) {
      const req = questionsForProduct(p as keyof typeof EXPECTED_REQUIRED).filter((x) => x.need === "required").map((x) => x.question.id)
      expect([...req].sort(), p).toEqual([...ids].sort())
    }
  })
  it("무료·궁합은 살아온 모습 문항을 묻지 않는다(최소 수집)", () => {
    const lived = ["workStyle", "recentChanges", "selfStrength", "selfWeakness", "changeWish"]
    for (const p of ["free", "compat"] as const) {
      const ids = questionsForProduct(p).map((x) => x.question.id)
      for (const id of lived) expect(ids, `${p}:${id}`).not.toContain(id)
    }
  })
})
