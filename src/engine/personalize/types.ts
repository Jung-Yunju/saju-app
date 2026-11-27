// 개인화 엔진 데이터 구조 (P4-01)
// 핵심 계약: 사주에서 나온 경향(source:"chart")과 사용자가 직접 말한 사실(source:"user")은
// 서로 다른 배열·서로 다른 타입으로만 전달한다. 한 배열에 섞지 않는다.
// 순수 타입 모듈: AI·DB 호출 없음.
import type { Branch, Stem } from "../types"
import type { Position } from "../rules/types"

export const PERSONALIZE_VERSION = "personalize@0.1.0"

// ─────────────────────────────────────────── 설문

export type Product = "free" | "basic" | "love" | "money" | "career" | "compat" | "concern"

export const PRODUCTS: readonly Product[] = ["free", "basic", "love", "money", "career", "compat", "concern"]

export type QuestionId =
  | "concernTopic"
  | "horizon"
  | "relationshipStatus"
  | "hasChildren"
  | "occupationStatus"
  | "careerFeeling"
  | "loveFocus"
  | "moneyFocus"
  | "birthOrder"
  | "lifeEvents"
  | "mbti"
  | "toneStrength"

export type QuestionKind = "single" | "multi" | "multiYear"

export interface SurveyOption {
  value: string
  label: string
}

/** 상품별 노출 수준. 필수라도 사용자는 언제든 건너뛸 수 있다("required" = 화면에서 먼저·눈에 띄게 묻는다). */
export type ProductNeed = "required" | "optional"

export interface SurveyQuestion {
  id: QuestionId
  kind: QuestionKind
  /** 화면에 보일 질문(할머니 말투 아님 — 말투는 프론트·콘텐츠 담당) */
  prompt: string
  options: readonly SurveyOption[]
  /** multi·multiYear의 최대 선택 수 (single은 1) */
  maxSelect: number
  /** 풀이의 어느 장에서 쓰는지 (docs/knowledge/personalization/survey.md §2와 같은 이름) */
  chapters: readonly string[]
  /** 어떻게 쓰는지 한 줄 */
  usage: string
  /** 상품별 수준. 없는 상품 = 그 상품에서는 묻지 않음 */
  products: Partial<Record<Product, ProductNeed>>
  /** 항상 true — 모든 문항은 건너뛸 수 있다 */
  skippable: true
}

/**
 * 사용자 응답 1건. 건너뛴 문항은 응답 자체를 보내지 않거나 skipped:true, values:[]로 보낸다.
 * years: multiYear 문항에서 선택지 값 → 그 일이 있었던 양력 연도(모르면 생략).
 */
export interface SurveyAnswer {
  questionId: QuestionId
  skipped?: boolean
  values: string[]
  years?: Record<string, number>
}

export type ValidationCode =
  | "unknown_question"
  | "duplicate_answer"
  | "skipped_with_values"
  | "empty_values"
  | "invalid_option"
  | "duplicate_value"
  | "too_many"
  | "single_requires_one"
  | "years_not_allowed"
  | "year_for_unselected"
  | "year_invalid"
  | "malformed"

/** 원문 답을 담지 않는다(로그에 개인정보가 남지 않게). */
export interface ValidationIssue {
  questionId: string
  code: ValidationCode
  message: string
}

export interface ValidationResult {
  /** 문제가 하나도 없으면 true (건너뜀은 문제가 아니다) */
  ok: boolean
  issues: ValidationIssue[]
  /** 통과한 응답만(건너뜀 제외, 값 정리됨). 문제 있는 응답은 통째로 빠진다 */
  valid: SurveyAnswer[]
  /** 건너뛰었거나 응답이 없는 문항 */
  skippedQuestionIds: QuestionId[]
}

export interface ValidateOptions {
  /** 이벤트 연도 범위 검사용. 없으면 1900~2100만 검사 */
  birthYear?: number
  nowYear?: number
}

// ─────────────────────────────────────────── 사용자 사실 / 사주 경향 / 시대 배경

/** 사용자가 직접 말한 것만. 사주에서 추정한 것은 절대 여기 넣지 않는다. */
export interface UserFact {
  source: "user"
  /** 예: "relationship_status", "life_event:marriage", "mbti" */
  id: string
  topic: string
  /** 선택지 값(코드값). 사용자가 쓰지 않은 내용을 덧붙이지 않는다 */
  value: string
  /** 화면에 보인 선택지 이름 */
  label: string
  /** 그 사실이 걸린 기간(양력 연도). 연도를 말하지 않았으면 없음 */
  period?: { fromYear: number; toYear: number }
  questionId: QuestionId
  /** 풀이는 이 사실을 "맞혔다"고 쓸 수 없고 배경으로만 쓴다 (항상 "background-only") */
  useAs: "background-only"
  /** 자기보고 정보임을 표시(MBTI 등). 항상 true */
  selfReported: true
}

export type ChartBasis = Position & { char: Stem | Branch }

export type ChartTendencyKind = "day-master" | "daeun-current" | "daeun-next" | "daeun-before-start" | "daeun-tengod"

/** 사주(원국·대운)에서 나온 경향. 사용자 사실은 절대 근거로 쓰지 않는다. */
export interface ChartTendency {
  source: "chart"
  id: string
  kind: ChartTendencyKind
  /** 근거 글자 위치 — 검증기가 "그 글자가 실제 있는가"를 확인할 때 쓴다 */
  basis: ChartBasis[]
  /** 숫자·코드 위주의 구조화 값(서술 문장 아님) */
  detail: Record<string, string | number | null>
  /** 겹치는 인생 단계 */
  lifeStages?: LifeStageId[]
  period?: { fromYear: number; toYear: number }
}

/** 확실히 있었던 역사 사건(시대 배경). 사주도 사용자 말도 아니다. */
export interface EraMark {
  source: "era"
  id: string
  year: number
  label: string
  /** 그 해 연말 기준 만 나이(생일 전이면 한 살 적을 수 있다) */
  ageAtYearEnd: number
}

// ─────────────────────────────────────────── 인생 단계 / 대운 구간

export type LifeStageId =
  | "early_childhood"
  | "elementary"
  | "secondary"
  | "young_adult"
  | "early_career"
  | "establishment"
  | "midlife_transition"
  | "pre_retirement"
  | "senior"

export interface LifeStage {
  id: LifeStageId
  label: string
  /** 만 나이, 포함 */
  minAge: number
  /** 만 나이, 포함. senior는 null(상한 없음) */
  maxAge: number | null
}

export interface DaeunSlot {
  /** 1부터 (chart.luck.daeun의 index) */
  index: number
  pillar: { stem: Stem; branch: Branch }
  ageFrom: number
  /** 포함 */
  ageTo: number
  yearFrom: number
  yearTo: number
  lifeStages: LifeStageId[]
}

export interface DaeunPosition {
  /** before = 대운 시작 전(월주 기운의 시기) / in = 대운 안 / after = 계산된 10개 대운 이후 */
  phase: "before" | "in" | "after"
  current: DaeunSlot | null
  next: DaeunSlot | null
}

// ─────────────────────────────────────────── 최종 구조

export interface PersonalContext {
  version: string
  /** 기준 시각(ISO). 같은 chart·answers·now면 같은 결과 */
  nowIso: string
  subject: {
    birthYear: number
    /** 한국 날짜 기준 만 나이 */
    ageManNow: number
    lifeStage: LifeStage
    gender: "M" | "F"
    hourKnown: boolean
  }
  /** 사주에서 나온 경향만 */
  chartTendencies: ChartTendency[]
  /** 사용자가 직접 말한 사실만 */
  userFacts: UserFact[]
  /** 사용자 사실이 걸린 해 — 이 해들은 "그 해에 ○○ 일이 있었다"를 맞히는 서술·문항에서 뺀다 */
  noGuessYears: { year: number; factIds: string[] }[]
  eraBackground: EraMark[]
  /** 콘텐츠 엔진이 지켜야 할 규칙 문구(항상 포함) */
  guards: string[]
  skippedQuestionIds: QuestionId[]
  /** 검증에 실패해 쓰지 않은 응답 */
  rejectedAnswers: ValidationIssue[]
  /** 예: 만 14세 미만이라 설문 응답을 쓰지 않음 */
  notes: string[]
}
