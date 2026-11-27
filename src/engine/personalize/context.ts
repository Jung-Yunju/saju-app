// buildPersonalContext (P4-01) — 콘텐츠 엔진에 넘길 개인화 구조. 순수 함수(AI·DB·네트워크 없음).
// 불변식(테스트로 고정):
//  1) chartTendencies에는 source:"chart"만, userFacts에는 source:"user"만 들어간다.
//  2) 사용자가 고르지 않은 것은 어떤 배열에도 없다(만들어내지 않는다).
//  3) 사용자 사실에 연도가 있으면 noGuessYears에 올린다. 모든 사용자 사실은 useAs:"background-only".
//  4) 이름·이메일·월일 등 식별정보는 담지 않는다(출생 연도와 만 나이만).
import type { CalendarResult } from "../types"
import type { RuleAnalysis } from "../rules/types"
import { eraBackgroundOf, koreanDateOf, lifeStageOfAge, locateDaeun, manAge } from "./life-stage"
import { getQuestion, validateAnswers } from "./survey"
import {
  PERSONALIZE_VERSION,
  type ChartBasis,
  type ChartTendency,
  type DaeunSlot,
  type PersonalContext,
  type SurveyAnswer,
  type UserFact,
} from "./types"

/** 이 나이 미만이면 설문 응답을 풀이에 쓰지 않는다(개인정보 보호법상 만 14세 미만 법정대리인 동의 문제 회피 — survey.md §5) */
export const MIN_SURVEY_AGE = 14

export const GUARDS: readonly string[] = [
  "userFacts는 풀이에서 '맞혔다'고 쓰지 않는다. 배경으로만 쓰고, 그 사실이 걸린 해는 맞히기 서술에서 뺀다.",
  "userFacts에 없는 경험(결혼·이혼·질병·사별·재산 등)을 사실처럼 쓰지 않는다.",
  "MBTI는 사용자 자기보고다. 사주와 일치/불일치를 판정하지 않고 기질 판단 근거로 쓰지 않는다.",
  "chartTendencies는 사주 글자에서 나온 해석 재료일 뿐 사실 확정이 아니다. 근거(basis) 글자를 문장에 밝힌다.",
  "말투 강도(toneStrength)는 표현의 세기만 바꾼다. 금지 주제와 원칙은 그대로다.",
]

function sortedUnique(nums: number[]): number[] {
  return [...new Set(nums)].sort((a, b) => a - b)
}

function daeunBasis(slot: DaeunSlot): ChartBasis[] {
  const luckIndex = slot.index - 1 // extra.luck = chart.luck.daeun.map(d => d.pillar) 의 0부터 번호
  return [
    { pillar: "daeun", part: "stem", luckIndex, char: slot.pillar.stem },
    { pillar: "daeun", part: "branch", luckIndex, char: slot.pillar.branch },
  ]
}

function daeunDetail(slot: DaeunSlot): ChartTendency["detail"] {
  return {
    index: slot.index,
    stem: slot.pillar.stem,
    branch: slot.pillar.branch,
    ageFrom: slot.ageFrom,
    ageTo: slot.ageTo,
    yearFrom: slot.yearFrom,
    yearTo: slot.yearTo,
  }
}

function buildChartTendencies(chart: CalendarResult, age: number, analysis?: RuleAnalysis): ChartTendency[] {
  const out: ChartTendency[] = []
  const dm = chart.pillars.day.stem
  out.push({
    source: "chart",
    id: "chart:day-master",
    kind: "day-master",
    basis: [{ pillar: "day", part: "stem", char: dm }],
    detail: { stem: dm },
  })

  const pos = locateDaeun(chart, age)
  const toTendency = (kind: ChartTendency["kind"], slot: DaeunSlot): ChartTendency => ({
    source: "chart",
    id: `chart:${kind}:${slot.index}`,
    kind,
    basis: daeunBasis(slot),
    detail: daeunDetail(slot),
    lifeStages: slot.lifeStages,
    period: { fromYear: slot.yearFrom, toYear: slot.yearTo },
  })
  if (pos.phase === "before" && pos.next) {
    out.push({
      source: "chart",
      id: "chart:daeun-before-start",
      kind: "daeun-before-start",
      basis: [{ pillar: "month", part: "stem", char: chart.pillars.month.stem }, { pillar: "month", part: "branch", char: chart.pillars.month.branch }],
      detail: { startAge: pos.next.ageFrom, startYear: pos.next.yearFrom },
    })
  }
  if (pos.current) out.push(toTendency("daeun-current", pos.current))
  if (pos.next) out.push(toTendency("daeun-next", pos.next))

  // 규칙 엔진 결과가 있으면 현재 대운 글자의 십성 판정을 옮긴다(대운 간지가 chart와 일치할 때만).
  if (analysis && pos.current) {
    const idx = pos.current.index - 1
    const a = analysis.source.luck[idx]
    const p = pos.current.pillar
    if (a && a.stem === p.stem && a.branch === p.branch) {
      for (const hit of analysis.tenGods) {
        if (hit.position.pillar === "daeun" && hit.position.luckIndex === idx) {
          out.push({
            source: "chart",
            id: `chart:daeun-tengod:${idx}:${hit.position.part}:${hit.viaHiddenStem ?? "main"}`,
            kind: "daeun-tengod",
            basis: [{ ...hit.position, char: hit.char }],
            detail: { tenGod: hit.tenGod, via: hit.viaHiddenStem ?? null },
            lifeStages: pos.current.lifeStages,
            period: { fromYear: pos.current.yearFrom, toYear: pos.current.yearTo },
          })
        }
      }
    }
  }
  return out
}

function buildUserFacts(valid: readonly SurveyAnswer[]): UserFact[] {
  const facts: UserFact[] = []
  for (const a of valid) {
    const q = getQuestion(a.questionId)
    if (!q) continue
    for (const v of a.values) {
      const opt = q.options.find((o) => o.value === v)
      if (!opt) continue
      const isEvent = q.kind === "multiYear"
      const fact: UserFact = {
        source: "user",
        id: isEvent ? `life_event:${v}` : q.kind === "multi" ? `${q.id}:${v}` : q.id,
        topic: isEvent ? `life_event:${v}` : q.id,
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

/**
 * @param chart computeChart 결과
 * @param answers 설문 응답(검증 전 원본 가능). 잘못된 응답은 rejectedAnswers로 빠지고 쓰이지 않는다.
 * @param now 기준 시각(한국 날짜로 환산해 만 나이 계산)
 * @param analysis 선택. analyzeRules 결과(extra.luck = chart.luck.daeun의 간지들)를 주면 현재 대운의 십성 판정을 chartTendencies에 옮긴다
 */
export function buildPersonalContext(
  chart: CalendarResult,
  answers: unknown,
  now: Date,
  analysis?: RuleAnalysis,
): PersonalContext {
  const today = koreanDateOf(now)
  const birthYear = chart.solarDate.year
  const age = manAge(chart.solarDate, today)
  const notes: string[] = []

  const v = validateAnswers(answers, { birthYear, nowYear: today.year })
  let userFacts: UserFact[] = []
  if (age < MIN_SURVEY_AGE) {
    if (v.valid.length > 0) notes.push(`만 ${MIN_SURVEY_AGE}세 미만이라 설문 응답을 쓰지 않음`)
  } else {
    userFacts = buildUserFacts(v.valid)
  }

  const yearMap = new Map<number, string[]>()
  for (const f of userFacts) {
    if (!f.period) continue
    for (let y = f.period.fromYear; y <= f.period.toYear; y++) {
      const arr = yearMap.get(y) ?? []
      arr.push(f.id)
      yearMap.set(y, arr)
    }
  }
  const noGuessYears = sortedUnique([...yearMap.keys()]).map((year) => ({ year, factIds: yearMap.get(year)! }))

  if (!chart.hourKnown) notes.push("태어난 시각을 몰라 시주 없이 풀이함")

  return {
    version: PERSONALIZE_VERSION,
    nowIso: now.toISOString(),
    subject: {
      birthYear,
      ageManNow: age,
      lifeStage: lifeStageOfAge(age),
      gender: chart.input.gender,
      hourKnown: chart.hourKnown,
    },
    chartTendencies: buildChartTendencies(chart, age, analysis),
    userFacts,
    noGuessYears,
    eraBackground: eraBackgroundOf(birthYear, today.year),
    guards: [...GUARDS],
    skippedQuestionIds: age < MIN_SURVEY_AGE ? v.skippedQuestionIds.concat(v.valid.map((a) => a.questionId)) : v.skippedQuestionIds,
    rejectedAnswers: v.issues,
    notes,
  }
}
