// 신성 원형 분석 — 실험용 데이터 구조 (설계안 docs/redesign/03-engine-design.md §4의 타입 초안과 같은 내용)
// ⚠ 실험 도구 전용. 대표 승인 전에는 src/engine/types.ts·src/engine/** 에 넣지 않는다.
// 원형은 전통 명리 공식 분류가 아니라 서비스의 창작적 상징 해석이다. 이 파일은 해석 문장을 담지 않는다.
import type { HiddenStemTableId, Pillar, RuleOptions } from "../../../src/engine"

export const ARCHETYPE_ENGINE_VERSION = "archetype@0.1.0-lab"
export const FEATURE_VERSION = "features@0.2.0"

// ─────────────────────────────────────────── 특징 벡터

/** 특징 값. 문자열 특징이 "해당 없음"이면 null */
export type FeatureValue = number | string | boolean | null | string[]

export type FeatureType = "number" | "string" | "boolean" | "string[]"

export interface FeatureSpec {
  key: string
  type: FeatureType
  /** 문자열·문자열 배열이면 가능한 값(규칙 파일 검증용). null 허용 여부는 nullable */
  domain?: readonly string[]
  nullable?: boolean
  /** 숫자 범위(참고) */
  range?: [number, number]
  /** 사람용 설명 */
  desc: string
  /** RuleAnalysis의 어느 값에서 왔는가 */
  from: string
}

/** 평평한(점 표기) 특징 벡터. 키 순서는 FEATURE_CATALOG 순서로 고정 */
export type FeatureVector = Record<string, FeatureValue>

// ─────────────────────────────────────────── 원형 규칙 파일 (JSON)

/** 잎 조건: f(특징 키) + 연산자 하나 */
export type LeafCondition =
  | { f: string; eq: string | number | boolean | null }
  | { f: string; ne: string | number | boolean | null }
  | { f: string; in: (string | number | boolean | null)[] }
  | { f: string; gte: number }
  | { f: string; gt: number }
  | { f: string; lte: number }
  | { f: string; lt: number }
  | { f: string; between: [number, number] }
  | { f: string; has: string }
  | { f: string; hasAny: string[] }
  | { f: string; hasNone: string[] }

export type Condition = LeafCondition | { all: Condition[] } | { any: Condition[] } | { not: Condition }

/** 점수 항목. when이 참이면 points(고정) 또는 linear(특징값 비례)를 더한다 */
export interface ScoreTerm {
  id: string
  /** 근거 기록·설명용 짧은 이름(연구소장 문서의 조건 번호를 써도 된다) */
  label: string
  when?: Condition
  points?: number
  /** points = clamp((값 − offset) × mul, min, max). 값은 숫자 특징 */
  linear?: { f: string; mul: number; offset?: number; min?: number; max?: number }
}

export interface ArchetypeRule {
  /** 영문 소문자·숫자·하이픈. 저장·이미지 자산 키로 쓴다(바꾸면 안 됨) */
  id: string
  name: string
  category: "divineBeast" | "spiritAnimal" | "divineHuman" | "nature" | "celestial"
  /** 동점 순위(작을수록 앞). 규칙 파일 안에서 유일해야 한다 */
  priority: number
  /** 자격 조건 — 거짓이면 이 원형은 후보에서 빠진다 */
  require?: Condition
  /** 제외 조건 — 참이면 후보에서 빠진다 */
  exclude?: Condition
  /** score 모드: 1개 이상 필수. cascade 모드: 생략 가능(관문은 require 하나로 판정) */
  terms: ScoreTerm[]
  /** cascade 모드: 연구소장 문서의 규칙 ID(예: "arch.v1.05.bonghwang") */
  ruleId?: string
  /** cascade 모드: 관문 조건을 사람 말로(근거 화면·보고서용) */
  gateLabel?: string
  /** 연구소장 추정 비율 [하한, 상한](0~1) — 보고서 비교용, 판정에 쓰지 않음 */
  expectedShare?: [number, number]
}

export interface ArchetypeRuleSet {
  /** 예: "example-v0", "research-12" */
  id: string
  /**
   * score(기본) = 점수 합산 최고점 / cascade = priority 순서대로 관문(require·exclude)을 검사해 처음 통과한 원형.
   * cascade에서는 terms·boundaryMargin·minScore를 쓰지 않는다. 어떤 관문도 통과하지 못하면 fallback + 경보(fallbackSafety)
   */
  mode?: "score" | "cascade"
  /** 규칙 파일 자체 버전(semver) */
  version: string
  /** example = 엔진 개발자 임시 예시(의미 없음) / draft = 연구소장 초안 / approved = 대표 승인 */
  status: "example" | "draft" | "approved"
  source: string
  disclaimer: string
  /** 이 규칙이 전제한 특징 버전. 엔진의 FEATURE_VERSION과 다르면 로드 거부 */
  featureVersion: string
  params: {
    /** 1·2순위 점수 차가 이 값 미만이면 boundary=true (경계 사주) */
    boundaryMargin: number
    /** 1순위 점수가 이 값 미만이면 fallback 원형 */
    minScore: number
  }
  fallback: string
  archetypes: ArchetypeRule[]
}

// ─────────────────────────────────────────── 결과

export interface EvidenceItem {
  termId: string
  label: string
  points: number
  /** 이 항목 판정에 쓴 특징 값 */
  inputs: Record<string, FeatureValue>
}

export interface ArchetypeScore {
  id: string
  name: string
  eligible: boolean
  /** 자격 탈락 사유(require 거짓 / exclude 참) */
  ineligibleBy?: "require" | "exclude"
  score: number
  matchedTerms: number
  evidence: EvidenceItem[]
}

export interface ArchetypePick {
  id: string
  name: string
  score: number
}

/** 원국 1개(한 가지 옵션 조합)에 대한 점수 계산 결과 — RuleAnalysis만 입력으로 받는다 */
export interface ArchetypeScoring {
  primary: ArchetypePick
  secondary: ArchetypePick | null
  /** 자격 있는 원형 점수 내림차순(동점은 priority → id) — 탈락 원형은 뒤에 */
  ranking: ArchetypeScore[]
  margin: number | null
  tie: boolean
  boundary: boolean
  /**
   * 1순위를 가른 기준: score(점수 차) / priority(동점 → 우선순위) / fallback(최소 점수 미달·후보 없음)
   * / hourModal(시각 모름 + 정책 hourModal에서 12시진 최빈값이 세 기둥 결과를 대신함)
   */
  decidedBy: "score" | "priority" | "fallback" | "hourModal" | "cascade"
  /** cascade 모드에서만 */
  cascade?: CascadeInfo
}

/** 순서형 관문 판정의 근거 기록 (02-archetypes.md §7 matched·trace·alsoMatched) */
export interface CascadeInfo {
  /** 통과한 관문의 규칙 ID */
  ruleId: string | null
  /** 통과한 관문 판정에 쓴 특징 값 */
  matched: Record<string, FeatureValue>
  /** 앞 순서 원형부터 통과 원형까지(통과 원형 포함). failedOn = 처음 거짓이 된 최상위 조건 */
  trace: { id: string; passed: boolean; failedOn?: string }[]
  /** 순서와 무관하게 관문을 통과한 다른 원형(priority 순). 첫째 = 부 원형 */
  alsoMatched: string[]
  /** 어떤 관문도 통과하지 못해 fallback을 준 경우(정상이면 false — QA 경보) */
  fallbackSafety: boolean
}

export interface HourVariant {
  hour: Pillar
  primary: string
  secondary: string | null
  /** cascade 모드에서 관문 경보가 난 경우에만 true로 기록 */
  fallbackSafety?: true
}

export interface ArchetypeResult extends ArchetypeScoring {
  engineVersion: string
  featureVersion: string
  rulesEngineVersion: string
  calendarEngineVersion: string
  ruleSet: { id: string; version: string; status: ArchetypeRuleSet["status"]; hash: string }
  /** 분석에 쓴 규칙 엔진 옵션 전체 */
  ruleOptions: RuleOptions
  hourKnown: boolean
  /** 시각 모름일 때 대표값을 정한 방법 */
  hourUnknownPolicy: HourUnknownPolicy
  features: FeatureVector
  /** 시각을 알면 null. 모르면 12시진마다 1순위 */
  hourSensitivity: null | {
    byHour: HourVariant[]
    distinctPrimary: string[]
    /** 12시진 모두 같은 1순위인가 */
    stable: boolean
    /** 세 기둥 결과와 같은 1순위가 나온 시진 수(0~12) */
    agreeWithThreePillars: number
    /** 최빈 1순위(동점은 세 기둥 결과 → priority) */
    modal: { id: string; count: number }
  }
  /** 지장간 표별 1순위. sensitive = {선택 표, kr, cn} 사이에서 다름 (rules@0.4.0 tableSensitive와 같은 정의) */
  tableSensitivity: null | {
    byTable: { tableId: HiddenStemTableId; primary: string; secondary: string | null; fallbackSafety?: true }[]
    sensitive: boolean
    sensitiveIncludingMainOnly: boolean
  }
  disclaimer: string
}

/** 시각 모름 대표값: threePillars(세 기둥만으로 계산 — 기본 제안) / hourModal(12시진 대입 최빈값) */
export type HourUnknownPolicy = "threePillars" | "hourModal"
