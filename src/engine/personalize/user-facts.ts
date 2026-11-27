// 설문 응답 → 사용자 사실표(userFacts) 변환 (D-023 ①). 순수 함수.
// 모든 사실은 source:"user"(사용자가 말함). 사주 경향과 섞지 않는다. 고르지 않은 것은 만들지 않는다.
import { getQuestion, validateAnswers } from "./survey"
import type { SurveyAnswer, UserFact, ValidateOptions, ValidationIssue } from "./types"

/** 검증을 통과한 응답을 사실표로 옮긴다(이미 validateAnswers를 거친 입력). */
export function buildUserFacts(valid: readonly SurveyAnswer[]): UserFact[] {
  const facts: UserFact[] = []
  for (const a of valid) {
    const q = getQuestion(a.questionId)
    if (!q) continue
    for (const v of a.values) {
      const opt = q.options.find((o) => o.value === v)
      if (!opt) continue
      const isEvent = q.kind === "multiYear"
      const prefix = q.factPrefix ?? "life_event"
      const fact: UserFact = {
        source: "user",
        id: isEvent ? `${prefix}:${v}` : q.kind === "multi" ? `${q.id}:${v}` : q.id,
        topic: isEvent ? `${prefix}:${v}` : q.id,
        value: v,
        label: opt.label,
        questionId: q.id,
        useAs: "background-only",
        selfReported: true,
      }
      const y = a.years?.[v]
      if (isEvent && typeof y === "number") fact.period = { fromYear: y, toYear: y }
      facts.push(fact)
    }
  }
  return facts
}

/** 원본 응답(검증 전) → 사실표. 잘못된 응답은 rejected로 빠지고 쓰이지 않는다. */
export function answersToUserFacts(
  answers: unknown,
  opts: ValidateOptions = {},
): { userFacts: UserFact[]; rejected: ValidationIssue[] } {
  const v = validateAnswers(answers, opts)
  return { userFacts: buildUserFacts(v.valid), rejected: v.issues }
}
