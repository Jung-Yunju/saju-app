// 신성 원형(archetype@0.1.0) 데이터 구조. 명리 해석값(RuleAnalysis)을 재료로 한 "서비스의 창작적 상징" 분류 결과다.
// 역법 객관값(CalendarResult)·규칙 해석값(RuleAnalysis)과 다른 모듈·다른 타입이다. 해석 문장은 담지 않는다.
// 명세: docs/redesign/02-archetypes.md §3·§7(연구소장 초안) + D-030(규칙 research-12 + 조정안 C, 표 고정, 시각 모름, 부 원형 정의)
import type { HiddenStemTableId, RuleOptions } from "../rules/types"
import type { Pillar } from "../types"

/** 원형 id — src/lib/unmyeong/assets.ts ARCHETYPE_IDS와 같은 값·같은 순서(관문 순서). 저장·이미지 자산 키라 바꾸지 않는다 */
export const ARCHETYPE_ID_LIST = [
  "galaxy", "hyeonmu", "golden-sun", "moon-goddess", "bonghwang", "baekho",
  "black-fox", "white-deer", "sage", "cheongnyong", "silver-wolf", "eternal-forest",
] as const
export type ArchetypeId = (typeof ARCHETYPE_ID_LIST)[number]

export type ArchetypeCategory = "divineBeast" | "spiritAnimal" | "divineHuman" | "nature" | "celestial"

// ─────────────────────────────────────────── 특징 벡터 (features@0.2.0)

/** 특징 값. 문자열 특징이 "해당 없음"이면 null */
export type FeatureValue = number | string | boolean | null | string[]
export type FeatureType = "number" | "string" | "boolean" | "string[]"

export interface FeatureSpec {
  key: string
  type: FeatureType
  domain?: readonly string[]
  nullable?: boolean
  range?: [number, number]
  desc: string
  /** RuleAnalysis의 어느 값에서 왔는가 */
  from: string
}

/** 평평한(점 표기) 특징 벡터. 키 순서는 FEATURE_CATALOG 순서로 고정 */
export type FeatureVector = Record<string, FeatureValue>

// ─────────────────────────────────────────── 규칙(순서형 관문) — 코드 안 데이터 rules/*.json

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

export interface ArchetypeGate {
  id: ArchetypeId
  name: string
  category: ArchetypeCategory
  /** 관문 순서 1~12(작을수록 먼저 검사) */
  priority: number
  /** 연구소장 문서의 규칙 ID(예: "arch.v1.05.bonghwang") */
  ruleId: string
  /** 관문 조건을 사람 말로(근거 화면·보고서용) */
  gateLabel: string
  /** 관문 조건 — 참이면 통과 */
  require: Condition
  /** 제외 조건(선택) — 참이면 탈락 */
  exclude?: Condition
  /** 연구소장 추정 비율 [하한, 상한] — 판정에 쓰지 않음 */
  expectedShare?: [number, number]
}

/** 규칙 파일 형식(scripts/archetype-lab 규칙 파일 중 cascade 모드와 같은 형식) */
export interface ArchetypeRuleSet {
  id: string
  mode: "cascade"
  version: string
  status: "example" | "draft" | "approved"
  source: string
  disclaimer: string
  featureVersion: string
  /** cascade 모드에서는 쓰지 않음(lab 형식 호환용) */
  params: { boundaryMargin: number; minScore: number }
  /** 어떤 관문도 통과하지 못했을 때 줄 원형(정상이면 일어나지 않음 — fallbackSafety 경보) */
  fallback: ArchetypeId
  archetypes: ArchetypeGate[]
}

// ─────────────────────────────────────────── 결과

/** 관문 조건의 잎(특징 하나 + 연산자 하나) 판정 기록 */
export interface ArchetypeConditionCheck {
  /** 특징 키(예: "st.weighted") */
  key: string
  /** eq ne in gte gt lte lt between has hasAny hasNone */
  op: string
  /** 규칙의 기준값 */
  threshold: string | number | boolean | null | (string | number | boolean | null)[]
  /** 이 사주의 실제 값 */
  value: FeatureValue
  /** 잎 조건 자체의 참·거짓(not 적용 전) */
  ok: boolean
  /** not 안에 있는 잎이면 true(관문 판정은 ok의 반대로 기여) */
  negated?: true
}

/** 근거 한 줄 = 관문 하나. 앞 관문(탈락)부터 통과 관문까지 순서대로 */
export interface ArchetypeBasisItem {
  order: number
  id: ArchetypeId
  ruleId: string
  gateLabel: string
  passed: boolean
  /** 탈락 이유 — 처음 거짓이 된 최상위 조건(글) */
  failedOn?: string
  /** 이 관문 판정에 쓴 특징 값 */
  values: Record<string, FeatureValue>
  /** 잎 조건별 판정 */
  conditions: ArchetypeConditionCheck[]
}

export interface ArchetypeRef {
  id: ArchetypeId
  name: string
  category: ArchetypeCategory
  order: number
}

/** 시각 모름일 때만. 일간 기준 12시진(子→亥) 시주를 넣어 다시 판정 */
export interface ArchetypeHourSensitivity {
  /** 12시진 중 세 기둥 결과와 같은 원형이 나온 시진 수(0~12) */
  stable: number
  of: 12
  /** 12시진에서 나온 원형(관문 순서) */
  distinct: ArchetypeId[]
  byHour: { hour: Pillar; id: ArchetypeId; fallbackSafety?: true }[]
}

/** 지장간 표 민감도 — 기록만(원형 판정은 kr-monthly-30 고정, 고객 화면 비노출) */
export interface ArchetypeTableSensitivity {
  /** 판정에 쓴 표(항상 kr-monthly-30) */
  fixed: "kr-monthly-30"
  byTable: { tableId: HiddenStemTableId; id: ArchetypeId; fallbackSafety?: true }[]
  /** kr-monthly-30 ↔ cn-lunarjs 사이에서 원형이 다른가 */
  changed: boolean
  /** main-only까지 세 표 사이에서 다른가 */
  changedIncludingMainOnly: boolean
}

export interface ArchetypeResult {
  /** "archetype@0.1.0" */
  version: string
  /** version과 같음(엔진 공통 규칙: 모든 결과에 engineVersion) */
  engineVersion: string
  /** 규칙 데이터 해시("sha256:" + 16자리) — 키 정렬 JSON 기준 */
  rulesHash: string
  ruleSet: { id: string; version: string; status: ArchetypeRuleSet["status"] }
  featureVersion: string
  rulesEngineVersion: string
  calendarEngineVersion: string
  /** 판정에 쓴 규칙 엔진 옵션 전체(hiddenStemTable은 항상 kr-monthly-30) */
  ruleOptions: RuleOptions

  id: ArchetypeId
  name: string
  category: ArchetypeCategory
  /** 관문 순서 1~12 */
  order: number
  ruleId: string
  /** 부 원형 = 관문 전체(1~12) 중 주 원형 다음으로 통과한 원형(02 §7, D-030). 없으면 null */
  secondary: ArchetypeRef | null
  /** 순서와 무관하게 관문을 통과한 다른 원형(관문 순서). 첫째 = secondary */
  alsoMatched: ArchetypeId[]
  /** 앞 관문 탈락 이유 + 통과 관문 값 */
  basis: ArchetypeBasisItem[]

  hourKnown: boolean
  /** 시각 모름이면 원형과 무관하게 항상 true — 화면은 "태어난 시각을 알면 다른 모습이 보일 수 있다"를 붙인다 */
  hourUnknownNote: boolean
  sensitivity: { hour: ArchetypeHourSensitivity | null; table: ArchetypeTableSensitivity }
  /** 어떤 관문도 통과 못 해 fallback 원형을 준 경우 true(정상이면 false — QA 경보) */
  fallbackSafety: boolean

  /** 전통 명리 공식 분류가 아닌 창작 상징(화면 고지 필수). 코드값은 free-types.ts·02 §7과 같게 "creative-symbol" */
  disclaimer: "creative-symbol"
  /** 고지 문장(규칙 데이터의 disclaimer) */
  disclaimerText: string
}
