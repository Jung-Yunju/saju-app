import { describe, expect, it } from "vitest"
import { validateAnswers, getQuestion } from "../../src/engine/personalize/survey"
import { answersToUserFacts } from "../../src/engine/personalize/user-facts"
import { linkFactToChart } from "../../src/engine/personalize/lived-link"

const OPTS = { birthYear: 1985, nowYear: 2026 }

describe("살아온 모습 문항", () => {
  it("개인정보 자유입력 없음: 선택지만, 이름·회사·지명 문항 없음", () => {
    for (const id of ["workStyle", "recentChanges", "selfStrength", "selfWeakness", "changeWish"]) {
      const q = getQuestion(id)!
      expect(q.options.length).toBeGreaterThan(1)
      expect(q.usage.length).toBeGreaterThan(10)
    }
    const text = JSON.stringify([getQuestion("workStyle"), getQuestion("recentChanges"), getQuestion("changeWish")])
    for (const w of ["이름", "회사명", "주소", "지역"]) expect(text.includes(w), w).toBe(false)
  })
  it("recentChanges: 최근 3년 밖 연도는 거절, 안쪽은 통과", () => {
    const bad = validateAnswers([{ questionId: "recentChanges", values: ["breakup"], years: { breakup: 2020 } }], OPTS)
    expect(bad.issues.some((i) => i.code === "year_invalid")).toBe(true)
    const ok = validateAnswers([{ questionId: "recentChanges", values: ["breakup"], years: { breakup: 2024 } }], OPTS)
    expect(ok.ok).toBe(true)
  })
  it("changeWish는 1개만, 최대 2개 강점", () => {
    expect(validateAnswers([{ questionId: "changeWish", values: ["confidence", "habits_routine"] }], OPTS).ok).toBe(false)
    expect(validateAnswers([{ questionId: "selfStrength", values: ["persistence", "caring", "planning"] }], OPTS).ok).toBe(false)
  })
})

describe("answersToUserFacts", () => {
  it("모든 사실은 source:user, background-only, 고르지 않은 것은 없음", () => {
    const { userFacts } = answersToUserFacts(
      [
        { questionId: "workStyle", values: ["team"] },
        { questionId: "recentChanges", values: ["relocation", "job_change"], years: { job_change: 2025 } },
        { questionId: "selfStrength", values: ["caring"] },
        { questionId: "changeWish", values: ["confidence"] },
      ],
      OPTS,
    )
    expect(userFacts.every((f) => f.source === "user" && f.useAs === "background-only" && f.selfReported)).toBe(true)
    expect(userFacts.map((f) => f.id).sort()).toEqual(
      ["changeWish", "recent_change:job_change", "recent_change:relocation", "selfStrength:caring", "workStyle"].sort(),
    )
    expect(userFacts.find((f) => f.id === "recent_change:job_change")!.period).toEqual({ fromYear: 2025, toYear: 2025 })
    expect(userFacts.find((f) => f.id === "recent_change:relocation")!.period).toBeUndefined()
  })
  it("잘못된 응답은 rejected로 빠지고 사실이 되지 않는다", () => {
    const r = answersToUserFacts([{ questionId: "changeWish", values: ["없는값"] }], OPTS)
    expect(r.userFacts).toEqual([])
    expect(r.rejected.length).toBe(1)
  })
  it("lifeEvents와 recentChanges의 같은 항목이 id로 충돌하지 않는다", () => {
    const { userFacts } = answersToUserFacts(
      [
        { questionId: "lifeEvents", values: ["relocation"], years: { relocation: 2010 } },
        { questionId: "recentChanges", values: ["relocation"], years: { relocation: 2025 } },
      ],
      OPTS,
    )
    expect(new Set(userFacts.map((f) => f.id)).size).toBe(2)
  })
})

describe("linkFactToChart (일치·불일치·사주에 없는 사실)", () => {
  const facts = answersToUserFacts(
    [
      { questionId: "occupationStatus", values: ["self_employed"] },
      { questionId: "changeWish", values: ["confidence"] },
    ],
    OPTS,
  ).userFacts
  const biz = facts.find((f) => f.questionId === "occupationStatus")!
  const wish = facts.find((f) => f.questionId === "changeWish")!
  it("재성이 있으면 match, 없으면 mismatch(사실은 그대로)", () => {
    expect(linkFactToChart(biz, { jaeseong: 2 }).kind).toBe("match")
    const mm = linkFactToChart(biz, { jaeseong: 0 })
    expect(mm.kind).toBe("mismatch")
    expect(mm.source).toBe("user")
  })
  it("연결 근거가 없는 사실은 unlinked", () => {
    expect(linkFactToChart(wish, { jaeseong: 3 }).kind).toBe("unlinked")
  })
})
