// 풀이 결과 자동 검증기 데이터 구조 (P4-04, verify@0.1.0) — 담당: 품질검증·보안 담당자
// 순수 타입 모듈. AI·DB·네트워크·파일·현재 시각을 쓰지 않는다.
// 검증 대상은 콘텐츠 엔진(AI)이 쓴 풀이 JSON(src/lib/generate-reading-v2.ts의 FullReading·ClaimsResult)이다.
// 엔진 계층이 src/lib에 기대지 않도록 FullReading을 import하지 않고, 같은 모양을 느슨하게(전부 선택) 다시 적는다.
// → FullReading·ClaimsResult는 이 타입에 그대로 대입된다(tests/verify/types.test.ts에서 컴파일로 고정).
import type { CalendarResult } from "../types"
import type { RuleAnalysis } from "../rules/types"

export const VERIFY_VERSION = "verify@0.1.0"

export type Severity = "block" | "warn" | "info"

export type FindingCode =
  | "BASIS_NOT_IN_CHART"
  | "YEAR_GANZHI_MISMATCH"
  | "TENGOD_MISMATCH"
  | "FORBIDDEN_TOPIC"
  | "FAKE_CLASSIC_QUOTE"
  | "BARNUM"
  | "MORAL_JUDGEMENT"
  | "GENDER_STEREOTYPE"
  | "SCIENTIFIC_CLAIM"
  | "KNOWN_FACT_AS_PREDICTION"
  | "UNSAFE_HTML"
  | "CRISIS_RESPONSE"
  | "MALFORMED_READING"

/** 발견 위치. path는 JSON 경로(예: "parts[0].chapters[1].body[0]") */
export interface FindingLocation {
  path: string
  /** 마지막 키(예: "body", "letter", "claim") */
  field: string
  /** parts[i] */
  part?: number
  /** parts[i].chapters[j]의 j */
  chapter?: number
  chapterKey?: string
  chapterTitle?: string
  /** body[k]의 k (문단 번호, 0부터) */
  paragraph?: number
  /** 문장 단위 검사면 그 문장 번호(0부터) */
  sentence?: number
}

export interface Finding {
  severity: Severity
  code: FindingCode
  location: FindingLocation
  /** 문제 구절 주변 최대 40자 */
  excerpt: string
  message: string
  /** 세부 분류(예: FORBIDDEN_TOPIC의 "death") */
  rule?: string
}

export interface VerifyReport {
  version: string
  /** block이 하나도 없으면 true */
  pass: boolean
  /** 100 − 25×block − 5×warn (0 아래는 0). 참고값 — 판정은 pass로만 한다 */
  score: number
  counts: Record<Severity, number>
  findings: Finding[]
  /** BARNUM 계산 결과 등 요약(장별 근거 없는 문장 비율) */
  stats: {
    texts: number
    sentences: number
    barnumByChapter: { path: string; title?: string; sentences: number; unmarked: number; ratio: number }[]
  }
}

/** 검증기에 넘기는 사주 입력 — SajuInputData(src/lib/saju-input.ts)의 필요한 부분만 */
export interface VerifySajuInput {
  pillars: { year: string; month: string; day: string; hour?: string }
  hour_unknown?: boolean
  daeun?: { start_year: number; start_age: number; ganzhi: string }[]
  gongmang?: { day?: string; year?: string }
  this_year?: number
  this_year_ganzhi?: string
  known_facts?: string[]
  gender?: string
}

/** 사용자가 직접 말한 사실 — personalize의 UserFact와 같은 모양(필요한 필드만) */
export interface VerifyUserFact {
  id?: string
  topic?: string
  value?: string
  label: string
  period?: { fromYear: number; toYear: number }
}

/** 지식베이스에서 원문 대조(L2, source_status: verified)를 마친 고전 구절 */
export interface VerifiedQuote {
  /** 서명(예: "滴天髓") */
  classic: string
  original_text: string
  citation?: string
}

export interface VerifyContext {
  sajuInput: VerifySajuInput
  /** 있으면 analyzeRules(chart)로 십성 대조. 없으면 sajuInput 글자로 같은 규칙 함수를 쓴다 */
  chart?: CalendarResult
  /** 있으면 이것을 그대로 쓴다(콘텐츠 엔진이 쓴 것과 같은 해석 재료) */
  rules?: RuleAnalysis
  /** 사용자 고민 글(자유 입력). 있으면 위기 표현을 검사한다 */
  userText?: string
  /** personalize의 userFacts. sajuInput.known_facts와 함께 KNOWN_FACT 검사에 쓴다 */
  userFacts?: VerifyUserFact[]
  /** 기본 [] — 현재 지식베이스에 verified 원문은 0건(docs/knowledge/sources.md) */
  verifiedQuotes?: VerifiedQuote[]
  options?: {
    /** 장별 근거 없는 문장 비율 경고 기준(기본 0.5) */
    barnumRatio?: number
    /** 바넘 비율을 볼 최소 문장 수(기본 1) */
    barnumMinSentences?: number
  }
}

// ─────────────────────────────── 검증 대상(느슨한 FullReading·ClaimsResult)

export interface ReadingChapterLike {
  key?: string
  title?: string
  sub?: string
  chips?: { letter?: string; element?: string; label?: string }[]
  body?: string[]
  todo?: string
  ask?: string
}

/**
 * 검증 대상. FullReading(본 풀이)·ClaimsResult(지나온 길 단정)·둘을 합친 객체 모두 받는다.
 * 알려진 필드 외의 문자열 필드도 전부 훑는다(스키마가 바뀌어도 검사가 빠지지 않게).
 */
export interface ReadingLike {
  parts?: { title?: string; chapters?: ReadingChapterLike[] }[]
  [key: string]: unknown
}

/** 검사 모듈이 받는 텍스트 조각 */
export interface TextSegment {
  path: string
  field: string
  /** 원문 그대로(<b> 포함) */
  raw: string
  /** <b> 등 태그를 지운 글 */
  text: string
  location: FindingLocation
  /** 같은 객체 안의 year·years·next 숫자와 when·after 글의 4자리 연도 */
  contextYears: number[]
  /** 고객에게 서술로 보이는 본문 계열인지(바넘 검사 대상) */
  narrative: boolean
  /** 간지만 적는 칸(chips.letter, claims.letter, years.ganzhi 등) */
  letterField: boolean
}
