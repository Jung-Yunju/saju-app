// 설문 문항 정의(데이터) + 답 검증 (P4-01). 순수 함수.
// 최소 수집: 풀이 품질에 실제로 쓰는 문항만. 건강 상세·종교·성적 지향·정치는 묻지 않는다.
// 모든 문항은 선택형이고 건너뛸 수 있다. 자유 서술 문항은 없다.
import type {
  Product,
  QuestionId,
  SurveyAnswer,
  SurveyQuestion,
  ValidateOptions,
  ValidationIssue,
  ValidationResult,
} from "./types"

const MBTI_TYPES = [
  "INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP", "ENFJ", "ENFP",
  "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP",
] as const

export const SURVEY_QUESTIONS: readonly SurveyQuestion[] = [
  {
    id: "concernTopic",
    kind: "multi",
    prompt: "요즘 가장 마음이 가는 주제를 골라 주세요. (최대 2개)",
    options: [
      { value: "love", label: "연애·결혼" },
      { value: "money", label: "돈·재물" },
      { value: "career", label: "일·진로" },
      { value: "family", label: "가족" },
      { value: "relationships", label: "사람 관계" },
      { value: "self", label: "나 자신 알기" },
      { value: "direction", label: "앞으로의 방향" },
    ],
    maxSelect: 2,
    chapters: ["총론", "마무리 조언"],
    usage: "풀이에서 먼저 길게 다룰 장의 순서·비중을 정한다. 사주 판단은 바꾸지 않는다.",
    products: { free: "optional", basic: "optional", love: "optional", money: "optional", career: "optional", compat: "optional", concern: "required" },
    skippable: true,
  },
  {
    id: "horizon",
    kind: "single",
    prompt: "어느 때가 궁금하세요?",
    options: [
      { value: "this_year", label: "올해" },
      { value: "three_years", label: "앞으로 3년쯤" },
      { value: "whole_life", label: "큰 흐름 전체" },
    ],
    maxSelect: 1,
    chapters: ["올해·세운", "대운 흐름"],
    usage: "세운(올해)과 대운(10년 단위) 중 어느 쪽에 분량을 더 줄지 정한다.",
    products: { free: "optional", basic: "optional", love: "optional", money: "optional", career: "optional", concern: "optional" },
    skippable: true,
  },
  {
    id: "relationshipStatus",
    kind: "single",
    prompt: "지금 연애·혼인 상태는 어떠세요?",
    options: [
      { value: "single", label: "혼자예요" },
      { value: "dating", label: "만나는 사람이 있어요" },
      { value: "married", label: "결혼했어요" },
      { value: "other", label: "그 밖이거나 말하고 싶지 않아요" },
    ],
    maxSelect: 1,
    chapters: ["연애·결혼", "인간관계·가족"],
    usage: "배우자궁·관성/재성 해석을 현재 상황에 맞는 말투로 옮긴다. 상태를 '맞히는' 서술은 금지.",
    products: { basic: "optional", love: "required", compat: "required", concern: "optional" },
    skippable: true,
  },
  {
    id: "hasChildren",
    kind: "single",
    prompt: "자녀가 있으세요?",
    options: [
      { value: "none", label: "없어요" },
      { value: "has", label: "있어요" },
    ],
    maxSelect: 1,
    chapters: ["인간관계·가족", "재물"],
    usage: "식상·관성 해석에서 자녀 이야기를 꺼낼지 말지 결정. 답이 없거나 '없어요'면 자녀 이야기를 먼저 꺼내지 않는다.",
    products: { basic: "optional", love: "optional", money: "optional" },
    skippable: true,
  },
  {
    id: "occupationStatus",
    kind: "single",
    prompt: "지금 하는 일은 어느 쪽에 가까우세요?",
    options: [
      { value: "student", label: "학생" },
      { value: "job_seeking", label: "일자리를 찾는 중" },
      { value: "employed", label: "직장에 다녀요" },
      { value: "self_employed", label: "사업·장사를 해요" },
      { value: "freelance", label: "프리랜서·1인 일" },
      { value: "homemaker", label: "집안일·돌봄 중심" },
      { value: "retired", label: "은퇴했어요" },
      { value: "other", label: "그 밖이에요" },
    ],
    maxSelect: 1,
    chapters: ["직업·진로", "재물", "대운 흐름"],
    usage: "같은 식신·재성·관성이라도 학생/직장인/사업가의 장면으로 다르게 옮긴다(life-stages.md 참조).",
    products: { basic: "optional", love: "optional", money: "required", career: "required", concern: "optional" },
    skippable: true,
  },
  {
    id: "careerFeeling",
    kind: "single",
    prompt: "지금 일에 대한 마음은 어떠세요?",
    options: [
      { value: "satisfied", label: "대체로 만족해요" },
      { value: "neutral", label: "그저 그래요" },
      { value: "considering_change", label: "바꿀까 고민 중이에요" },
      { value: "preparing_new", label: "새로운 걸 준비 중이에요" },
    ],
    maxSelect: 1,
    chapters: ["직업·진로"],
    usage: "이직·전환 관련 운의 서술을 '지키는 쪽/움직이는 쪽' 중 어디에 무게를 둘지 정한다. 결정을 대신하지 않는다.",
    products: { career: "required" },
    skippable: true,
  },
  {
    id: "loveFocus",
    kind: "single",
    prompt: "연애에서 가장 궁금한 것은요?",
    options: [
      { value: "meeting", label: "새 인연을 만나는 때와 방식" },
      { value: "deepening", label: "지금 관계를 이어 가는 법" },
      { value: "marriage", label: "결혼을 생각하는 흐름" },
      { value: "reflecting", label: "지난 인연을 돌아보기" },
    ],
    maxSelect: 1,
    chapters: ["연애·결혼"],
    usage: "연애 장의 세부 소제목과 분량 배분.",
    products: { love: "required", compat: "optional" },
    skippable: true,
  },
  {
    id: "moneyFocus",
    kind: "single",
    prompt: "돈 이야기에서 가장 궁금한 것은요?",
    options: [
      { value: "stable_income", label: "꾸준한 수입 지키기" },
      { value: "raise_income", label: "수입 늘리기" },
      { value: "start_business", label: "내 일·사업 시작" },
      { value: "saving_assets", label: "모으고 지키는 습관" },
      { value: "no_pref", label: "특별히 없어요" },
    ],
    maxSelect: 1,
    chapters: ["재물"],
    usage: "재성의 성격(월급형/사업형 등)을 어느 장면으로 풀지 정한다. 특정 투자 상품·종목 조언에는 쓰지 않는다.",
    products: { money: "required" },
    skippable: true,
  },
  {
    id: "birthOrder",
    kind: "single",
    prompt: "형제자매 중 몇째세요?",
    options: [
      { value: "only", label: "외동" },
      { value: "eldest", label: "첫째" },
      { value: "middle", label: "중간" },
      { value: "youngest", label: "막내" },
    ],
    maxSelect: 1,
    chapters: ["성격·기질", "인간관계·가족"],
    usage: "비견·겁재·인성을 가정 안의 위치(맏이의 책임, 막내의 눈치 등)로 옮길 때 참고.",
    products: { basic: "optional", love: "optional", compat: "optional" },
    skippable: true,
  },
  {
    id: "lifeEvents",
    kind: "multiYear",
    prompt: "이미 지나온 큰 일이 있다면 골라 주세요. 해를 알면 함께 적어 주세요. (풀이에서 그 해를 '맞히지' 않고 비켜 가기 위한 용도예요)",
    options: [
      { value: "marriage", label: "결혼" },
      { value: "childbirth", label: "출산·입양" },
      { value: "job_change", label: "취업·이직·전직" },
      { value: "school_milestone", label: "입학·졸업·진학" },
      { value: "relocation", label: "이사·이민" },
      { value: "business_start", label: "사업 시작" },
    ],
    maxSelect: 6,
    chapters: ["대운 흐름", "올해·세운"],
    usage: "그 해를 풀이의 '맞히기' 문장에서 뺀다(원칙 2). 결과를 사주로 설명하는 데 쓰지 않는다.",
    products: { basic: "optional", love: "optional", money: "optional", career: "optional", concern: "optional" },
    skippable: true,
  },
  {
    id: "mbti",
    kind: "single",
    prompt: "MBTI를 알고 계시면 골라 주세요. (자기 생각대로 고르시면 돼요)",
    options: MBTI_TYPES.map((t) => ({ value: t, label: t })),
    maxSelect: 1,
    chapters: ["성격·기질"],
    usage: "말씨·비유를 고를 때만 참고. 사주와 맞다/틀리다를 판정하지 않는다. 기질 판단 근거로 쓰지 않는다.",
    products: { free: "optional", basic: "optional", love: "optional", compat: "optional" },
    skippable: true,
  },
  {
    id: "toneStrength",
    kind: "single",
    prompt: "풀이 말씀은 어떤 느낌이 좋으세요?",
    options: [
      { value: "gentle", label: "부드럽게 돌려서" },
      { value: "balanced", label: "적당히" },
      { value: "direct", label: "솔직하게 짚어서" },
    ],
    maxSelect: 1,
    chapters: ["마무리 조언", "전 장 말투"],
    usage: "표현의 세기만 조절(여지를 두는 정도). 금지 주제·원칙은 어떤 선택에서도 그대로.",
    products: { free: "optional", basic: "optional", love: "optional", money: "optional", career: "optional", compat: "optional", concern: "optional" },
    skippable: true,
  },
]

const BY_ID: ReadonlyMap<string, SurveyQuestion> = new Map(SURVEY_QUESTIONS.map((q) => [q.id, q]))

export function getQuestion(id: string): SurveyQuestion | undefined {
  return BY_ID.get(id)
}

/** 상품에서 묻는 문항(필수 먼저). 건너뛰기는 항상 가능. */
export function questionsForProduct(product: Product): { question: SurveyQuestion; need: "required" | "optional" }[] {
  const out: { question: SurveyQuestion; need: "required" | "optional" }[] = []
  for (const q of SURVEY_QUESTIONS) {
    const need = q.products[product]
    if (need) out.push({ question: q, need })
  }
  return out.sort((a, b) => (a.need === b.need ? 0 : a.need === "required" ? -1 : 1))
}

function issue(questionId: string, code: ValidationIssue["code"], message: string): ValidationIssue {
  return { questionId, code, message }
}

/**
 * 응답 검증. 응답 하나에 문제가 있으면 그 응답만 통째로 버린다(일부만 살리지 않음).
 * 건너뜀(응답 없음·skipped:true)은 정상이다.
 */
export function validateAnswers(answers: unknown, opts: ValidateOptions = {}): ValidationResult {
  const issues: ValidationIssue[] = []
  const valid: SurveyAnswer[] = []
  const answered = new Set<QuestionId>()
  const seen = new Set<string>()
  const minYear = Math.max(1900, opts.birthYear ?? 1900)
  const maxYear = Math.min(2100, opts.nowYear ?? 2100)

  if (answers === undefined || answers === null) {
    return { ok: true, issues, valid, skippedQuestionIds: SURVEY_QUESTIONS.map((q) => q.id) }
  }
  if (!Array.isArray(answers)) {
    issues.push(issue("*", "malformed", "응답 목록이 배열이 아님"))
    return { ok: false, issues, valid, skippedQuestionIds: SURVEY_QUESTIONS.map((q) => q.id) }
  }

  for (const raw of answers as unknown[]) {
    if (!raw || typeof raw !== "object") {
      issues.push(issue("*", "malformed", "응답 항목이 객체가 아님"))
      continue
    }
    const a = raw as Partial<SurveyAnswer>
    const qid = typeof a.questionId === "string" ? a.questionId : "*"
    const q = typeof a.questionId === "string" ? getQuestion(a.questionId) : undefined
    if (!q) {
      issues.push(issue(qid, "unknown_question", "없는 문항"))
      continue
    }
    if (seen.has(q.id)) {
      issues.push(issue(q.id, "duplicate_answer", "같은 문항에 응답이 두 번 있음(두 번째 이후 무시)"))
      continue
    }
    seen.add(q.id)
    if (!Array.isArray(a.values) || a.values.some((v) => typeof v !== "string")) {
      issues.push(issue(q.id, "malformed", "values는 문자열 배열이어야 함"))
      continue
    }
    const values = a.values as string[]

    if (a.skipped === true) {
      if (values.length > 0) issues.push(issue(q.id, "skipped_with_values", "건너뜀인데 값이 있음"))
      continue // 건너뜀은 answered로 세지 않는다
    }
    if (values.length === 0) {
      // 값이 없으면 건너뜀으로 본다
      continue
    }

    const local: ValidationIssue[] = []
    const optionValues = new Set(q.options.map((o) => o.value))
    if (new Set(values).size !== values.length) local.push(issue(q.id, "duplicate_value", "같은 선택지가 중복됨"))
    for (const v of values) {
      if (!optionValues.has(v)) {
        local.push(issue(q.id, "invalid_option", "선택지에 없는 값"))
        break
      }
    }
    if (q.kind === "single" && values.length !== 1) local.push(issue(q.id, "single_requires_one", "단일 선택 문항은 값이 1개"))
    if (q.kind !== "single" && values.length > q.maxSelect) local.push(issue(q.id, "too_many", `최대 ${q.maxSelect}개까지 선택`))

    let years: Record<string, number> | undefined
    if (a.years !== undefined) {
      if (q.kind !== "multiYear") {
        local.push(issue(q.id, "years_not_allowed", "연도를 받지 않는 문항"))
      } else if (!a.years || typeof a.years !== "object" || Array.isArray(a.years)) {
        local.push(issue(q.id, "malformed", "years는 객체여야 함"))
      } else {
        years = {}
        for (const [k, y] of Object.entries(a.years)) {
          if (!values.includes(k)) {
            local.push(issue(q.id, "year_for_unselected", "선택하지 않은 항목의 연도"))
          } else if (typeof y !== "number" || !Number.isInteger(y) || y < minYear || y > maxYear) {
            local.push(issue(q.id, "year_invalid", "연도가 범위를 벗어남"))
          } else {
            years[k] = y
          }
        }
      }
    }

    if (local.length > 0) {
      issues.push(...local)
      continue
    }
    const clean: SurveyAnswer = { questionId: q.id, values: [...values] }
    if (years && Object.keys(years).length > 0) clean.years = years
    valid.push(clean)
    answered.add(q.id)
  }

  const skippedQuestionIds = SURVEY_QUESTIONS.map((q) => q.id).filter((id) => !answered.has(id))
  return { ok: issues.length === 0, issues, valid, skippedQuestionIds }
}
