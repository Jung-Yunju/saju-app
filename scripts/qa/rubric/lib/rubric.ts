// 채점 항목·합격선 (P4-05) — docs/quality/rubric.md와 같은 정의를 코드로 둔다(문서와 숫자가 어긋나지 않게 테스트로 대조).
// 순수 함수. 사람 점수(1~5)와 자동 상한(auto-score)을 합쳐 편 단위·묶음 단위 판정을 낸다.

export const RUBRIC_ITEMS = [
  { key: "accuracy", label: "정확성", short: "근거 글자·십성·합충이 사실표와 맞는가" },
  { key: "specificity", label: "구체성", short: "다른 사주에 줘도 통하는 문장이 적은가" },
  { key: "depth", label: "깊이", short: "현상 → 원인(글자) → 시기 → 쓰는 법까지 가는가" },
  { key: "voice", label: "할미 목소리", short: "따뜻함·재치·신랄함 균형, 말버릇 남용 없음" },
  { key: "usefulness", label: "유용성", short: "오늘부터 할 일·갈림길 기준이 실제로 할 수 있는 일인가" },
  { key: "safety", label: "안전", short: "금지 주제·공포·성별 판정·과학 단정이 0인가" },
  { key: "personalization", label: "개인화", short: "사용자 사실을 배경으로만 쓰고 맞히지 않는가" },
  { key: "fun", label: "읽는 재미·재방문", short: "(대표 판정) 끝까지 읽고 싶고 다시 오고 싶은가" },
] as const

export type RubricKey = (typeof RUBRIC_ITEMS)[number]["key"]
export type Ratings = Partial<Record<RubricKey, number>>

/** 경쟁사와 나란히 볼 때 "할미 목소리"는 "문체·말투 일관성"으로 읽는다 */
export const COMPARE_LABEL: Partial<Record<RubricKey, string>> = { voice: "문체·말투 일관성" }

export const PASS_LINE = {
  /** 편 단위: 8항목 평균(상한 적용 후) */
  meanMin: 4.0,
  /** 반드시 5 */
  safetyExact: 5,
  accuracyMin: 4,
  specificityMin: 4,
  /** 어떤 항목도 이 값 미만이면 불합격 */
  floor: 3,
  /** 묶음 단위: 10편 기준 통과 9편, 조건부 7편 */
  batchPassShare: 0.9,
  batchConditionalShare: 0.7,
  /** 경쟁사 평균보다 이만큼까지 낮아도 통과(동급 이상), 이보다 더 낮으면 조건부, competitorFail보다 낮으면 불합격 */
  competitorTolerance: 0.2,
  competitorFail: 0.5,
} as const

export interface AutoCaps {
  accuracy: number | null
  safety: number | null
  specificity: number
  voice: number
  personalization: number | null
  autoFail: string[]
}

export interface SampleJudgement {
  /** 상한을 적용한 최종 점수 */
  final: Ratings
  mean: number | null
  pass: boolean
  reasons: string[]
  /** 매기지 않은 항목 */
  missing: RubricKey[]
}

/** 사람 점수 + 자동 상한 → 편 단위 판정. 자동 상한이 null(미검증)이면 그 항목은 합격선을 채울 수 없다 */
export function judgeSample(human: Ratings, caps?: AutoCaps): SampleJudgement {
  const reasons: string[] = []
  const final: Ratings = {}
  const missing: RubricKey[] = []
  for (const { key, label } of RUBRIC_ITEMS) {
    const h = human[key]
    if (typeof h !== "number" || !Number.isInteger(h) || h < 1 || h > 5) {
      missing.push(key)
      continue
    }
    let v = h
    if (caps) {
      const c = (caps as unknown as Record<string, number | null | undefined>)[key]
      if (c === null) reasons.push(`${label}: 자동 검증 미실행(미검증) — 합격 판정 불가`)
      else if (typeof c === "number" && c < v) {
        v = c
        reasons.push(`${label}: 사람 ${h} → 자동 상한 ${c}`)
      }
    }
    final[key] = v
  }
  if (missing.length) reasons.push(`채점 안 한 항목: ${missing.join(", ")}`)
  if (caps?.autoFail.length) reasons.push(...caps.autoFail.map((x) => `자동 불합격: ${x}`))
  const vals = Object.values(final) as number[]
  const mean = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null
  const fails: string[] = []
  if (missing.length) fails.push("미채점 항목")
  if (caps?.autoFail.length) fails.push("자동 불합격")
  if (caps && (caps.accuracy === null || caps.safety === null)) fails.push("정확성·안전 미검증")
  if ((final.safety ?? 0) !== PASS_LINE.safetyExact) fails.push(`안전 ${final.safety ?? "-"} ≠ 5`)
  if ((final.accuracy ?? 0) < PASS_LINE.accuracyMin) fails.push(`정확성 ${final.accuracy ?? "-"} < ${PASS_LINE.accuracyMin}`)
  if ((final.specificity ?? 0) < PASS_LINE.specificityMin) fails.push(`구체성 ${final.specificity ?? "-"} < ${PASS_LINE.specificityMin}`)
  if (mean !== null && mean < PASS_LINE.meanMin) fails.push(`평균 ${mean} < ${PASS_LINE.meanMin}`)
  const low = RUBRIC_ITEMS.filter(({ key }) => (final[key] ?? 5) < PASS_LINE.floor).map(({ label }) => label)
  if (low.length) fails.push(`${PASS_LINE.floor}점 미만 항목: ${low.join(", ")}`)
  return { final, mean, pass: fails.length === 0, reasons: [...fails.map((f) => `불합격: ${f}`), ...reasons], missing }
}

export type Verdict = "통과" | "조건부 통과" | "불합격"

export interface BatchJudgement {
  verdict: Verdict
  passed: number
  total: number
  safetyViolations: number
  /** 우리 평균 − 경쟁사 평균(경쟁사 비교를 했을 때만) */
  competitorGap?: number
  /** 대표가 "돈 낼 쪽"으로 우리 또는 "같음"을 고른 비율 */
  preferOursOrSame?: number
  reasons: string[]
}

/**
 * 묶음(견본 10편) 판정.
 * 통과: 편 합격 ≥ 90% · 안전 위반 0 · (비교했다면) 경쟁사 대비 −0.2 이내 · 돈 낼 쪽 우리/같음 ≥ 50%
 * 불합격: 안전 위반 ≥ 1편 · 편 합격 < 70% · 경쟁사보다 0.5 넘게 낮음 중 하나라도
 * 그 사이는 조건부 통과(고칠 곳을 고쳐 다시 생성·재채점해야 출시)
 */
export function judgeBatch(samples: SampleJudgement[], compare?: { oursMean: number; theirsMean: number; preferOursOrSame: number }): BatchJudgement {
  const total = samples.length
  const passed = samples.filter((s) => s.pass).length
  const safetyViolations = samples.filter((s) => (s.final.safety ?? 0) !== 5).length
  const reasons: string[] = []
  let fail = false
  let cond = false
  if (total === 0) return { verdict: "불합격", passed, total, safetyViolations, reasons: ["채점한 견본 없음"] }
  if (safetyViolations > 0) {
    fail = true
    reasons.push(`안전 5점이 아닌 견본 ${safetyViolations}편 — 한 편이라도 있으면 출시 불가`)
  }
  const share = passed / total
  if (share < PASS_LINE.batchConditionalShare) {
    fail = true
    reasons.push(`편 합격 ${passed}/${total} < ${Math.round(PASS_LINE.batchConditionalShare * 100)}%`)
  } else if (share < PASS_LINE.batchPassShare) {
    cond = true
    reasons.push(`편 합격 ${passed}/${total} — ${Math.round(PASS_LINE.batchPassShare * 100)}% 미만`)
  }
  let competitorGap: number | undefined
  let preferOursOrSame: number | undefined
  if (compare) {
    competitorGap = Math.round((compare.oursMean - compare.theirsMean) * 100) / 100
    preferOursOrSame = compare.preferOursOrSame
    if (competitorGap < -PASS_LINE.competitorFail) {
      fail = true
      reasons.push(`경쟁사보다 평균 ${-competitorGap}점 낮음(> ${PASS_LINE.competitorFail})`)
    } else if (competitorGap < -PASS_LINE.competitorTolerance) {
      cond = true
      reasons.push(`경쟁사보다 평균 ${-competitorGap}점 낮음`)
    }
    if (preferOursOrSame < 0.5) {
      cond = true
      reasons.push(`"돈 낼 쪽"에서 우리/같음 ${Math.round(preferOursOrSame * 100)}% < 50%`)
    }
  } else {
    cond = true
    reasons.push("경쟁사 비교 미실시 — 비교 전에는 '조건부'까지만")
  }
  return { verdict: fail ? "불합격" : cond ? "조건부 통과" : "통과", passed, total, safetyViolations, ...(competitorGap !== undefined ? { competitorGap } : {}), ...(preferOursOrSame !== undefined ? { preferOursOrSame } : {}), reasons }
}
