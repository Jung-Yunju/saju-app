// 사주 발현 분석 엔진 데이터 구조 (expression@0.2.0, D-035). 계약: docs/redesign/30-expression-engine.md §5
// 명리 판정 규칙: docs/knowledge/personalization/expression-dimensions.md (expression-dimensions@0.2.0, 연구소장)
// 이름은 계약서와 같게 맞춘다. 계약서에 없는 필드는 "추가"라고 표시했다(선택·보조 필드 — 계약 필드의 뜻을 바꾸지 않음).
// 총괄실장 결정(2026-11-28 2차): 운 출력 이름은 코드 이름 유지 — touches {dimensionId, mode:"activate"|"feed"|"press", via, ruleId},
//   tone "support"|"load"|"neutral"(경계 차단이면 "neutral", 생략하지 않음). 연구소장 문서의 how/positions/favorable/burden은 이 이름으로 읽는다.
// 0.2.0: steadiness·edge → 양극 축 grain 하나(ChartPotential.lean · DimensionReading.self.lean), 8차원.
// 순수 타입 모듈: AI·DB·네트워크 호출 없음.
import type { UserFact } from "../types"

export const EXPRESSION_ENGINE_VERSION = "expression@0.2.0"

// ─────────────────────────────────────────── 계약 §5

/** 기질 차원 — 사주에서 해석 가능한 잠재력 한 갈래. 표는 content/expression/dimensions.json */
export interface TraitDimension {
  id: string
  label: string
  /** 추가: 핵심(core) · 결(grain) · 보조(aux) — innateEssence 대표 기질은 이 순서로 고른다 */
  kind: DimensionKind
}

export type DimensionKind = "core" | "grain" | "aux"
export type PotentialLevel = "strong" | "moderate" | "faint"
export type EvidenceLevel = "L0" | "L1" | "L2"
/** grain(일을 풀어 가는 결) 원국 방향: 고른 쪽 · 센 쪽 · 두 결이 고름(또는 가를 글자가 적음) */
export type GrainLean = "steady" | "edge" | "balanced"
/** grain 자기보고 방향 */
export type SelfLean = "steady" | "edge"

/** ① 원국에서 읽은 잠재력 — 근거 필수 */
export interface ChartPotential {
  dimensionId: string
  level: PotentialLevel
  /** grain 전용 — 어느 결로 기우는지. faint ⇔ balanced */
  lean?: GrainLean
  /** 위치 문자열은 gaeun.ts posStr 형식("year.stem", "month.branch.jeonggi"). faint도 "없음" 근거 한 줄 이상 */
  basis: { ruleId: string; positions: string[]; note: string }[]
  evidenceLevel: EvidenceLevel
  /**
   * 추가: latent(지장간에만) · floating(뿌리 없이 천간에만) · month(월령) ·
   * hourUncertain(시주 모름이고 12시진 중 같은 판정이 hourStableMin 미만 — faint여도 "옅다"고 서술하지 않는다, 연구소장 §7.1-1) 등 표지
   */
  flags: string[]
  /**
   * 추가: 시주 모름일 때만 — 12시진 중 세 기둥 판정과 같은 판정이 나온 수, 나온 단계(strong→faint 순).
   * grain은 단계와 방향(lean)이 모두 같아야 "같은 판정"으로 세고, 나온 방향(leans)도 남긴다(§7.1 ④).
   */
  hourStable?: { stable: number; of: 12; levels: PotentialLevel[]; leans?: GrainLean[] }
}

export type MbtiAxis = "EI" | "SN" | "TF" | "JP"

export interface MbtiAxisReport {
  axis: MbtiAxis
  /** 대문자 극 글자. 소문자·"E?"처럼 쓰면 모든 입력 경로에서 "확신 없음"으로 읽는다 */
  pole: string
  /** false = "그쪽에 가까운 것 같다" 정도(확신 없음) — 신호에 쓰지 않고 문체 힌트에만 쓴다 */
  sure: boolean
}

/** ② 자기보고 — MBTI 4축 + 설문 */
export interface SelfReport {
  /** 모름·건너뜀 축은 넣지 않는다. 배열 자체가 없어도 된다 */
  mbti?: MbtiAxisReport[]
  /** 기존 UserFact 그대로. 이 엔진은 사실을 바꾸거나 새로 만들지 않고 id로만 가리킨다 */
  facts: UserFact[]
}

/** ③ 비교 결과 — 반드시 '추론' */
export type ExpressionStatus = "expressed" | "developed" | "dormant" | "quiet" | "unknown"

export type SelfSignal = "high" | "low" | "none"

export interface DimensionReading {
  dimensionId: string
  chart: ChartPotential
  self: {
    /** grain은 원국 방향에 대한 상대 신호(같은 쪽 high · 사실이 반대 low · MBTI만 반대 none, 연구소장 §3.7.5) */
    signal: SelfSignal
    /** "fact:<UserFact.id>" · "mbti:<축>" — 이 신호를 만든 자기보고 */
    from: string[]
    /** grain 전용 — 자기보고가 기운 쪽(없으면 필드 없음) */
    lean?: SelfLean
    /** 추가: 사실(UserFact) 없이 MBTI만으로 나온 신호(확인 신호로만 — developed 근거가 될 수 없음) */
    mbtiOnly: boolean
  }
  status: ExpressionStatus
  inferred: true
}

/** chart-uncertain = 원국 판정 자체가 불확실(시주 모름에 따른 단계 변동·신강약 경계 등) */
export type ConflictKind = "chart-vs-self" | "self-vs-self" | "missing" | "chart-uncertain"

export interface ExpressionConflict {
  dimensionId?: string
  kind: ConflictKind
  note: string
}

export type LuckScope = "daeun" | "seun"
export type LuckTouchMode = "activate" | "feed" | "press"
export type LuckTone = "support" | "load" | "neutral"

export interface LuckTouch {
  dimensionId: string
  mode: LuckTouchMode
  /** 근거 위치(운 글자·원국 글자, gaeun posStr 형식 — 대운은 1부터 센 번호 "daeun[3].stem") */
  via: string[]
  ruleId: string
}

export interface ExpressionLuck {
  scope: LuckScope
  ganzhi: string
  /** touches 중 mode "activate"인 차원 id(표 순서) — 하위 호환 */
  activates: string[]
  /** 행동 방향 id 목록: "<전략 id>:<차원 id>"(activate·press 차원마다) + tone 전략 id */
  strategy: string[]
  touches: LuckTouch[]
  /** 억부 희기. 경계 차단·억부 판정 없음·운 두 글자가 갈리면 "neutral" */
  tone: LuckTone
}

export type ExpressionSectionId =
  | "innateEssence"
  | "expressedNow"
  | "developedAbility"
  | "untappedPotential"
  | "gap"
  | "archetype"
  | "growable"
  | "luckStrategy"
  | "gaeun"

export const EXPRESSION_SECTION_IDS: readonly ExpressionSectionId[] = [
  "innateEssence", "expressedNow", "developedAbility", "untappedPotential", "gap",
  "archetype", "growable", "luckStrategy", "gaeun",
]

export interface ExpressionReport {
  version: string
  /** 차원 표 + MBTI 대응표의 해시(키 정렬 JSON의 FNV-1a 32비트 두 갈래). 표를 바꾸면 값이 바뀐다 */
  rulesHash: string
  /** 추가: 쓴 표의 버전·상태(designed = 분포 측정 전 설계값) */
  tables: { dimensions: { version: string; status: string; basedOn: string }; mbtiBridge: { version: string; status: string; claim: "service-model" } }
  /** 추가: 차원 목록(id·쉬운 이름·갈래) */
  dimensions: TraitDimension[]
  innate: ChartPotential[]
  readings: DimensionReading[]
  conflicts: ExpressionConflict[]
  luck: ExpressionLuck[]
  gaeun: string[]
  archetype: { id: string }
  sections: Record<ExpressionSectionId, string[]>
  /** 추가: MBTI 극에서 나온 조언 문체 힌트 id(판정에 쓰지 않음 — 확신 없는 답도 여기에만 쓰인다) */
  styleHints: string[]
  /** 추가: 원국 판정 민감도 기록(고객 화면 비노출 — 내부·검증용) */
  sensitivity: {
    /** 차원 판정에 쓴 지장간 표(고정). changed = 비교 표에서 단계(grain은 방향 포함)가 달라진 차원 */
    table: { fixed: string; compare: string; changed: string[] }
    /** 신강약 경계 근처·모형 불일치·표 민감 중 하나라도 참 → drive 보정(+1·−1)·부담 메모·운 tone 끔 */
    boundary: { blocked: boolean; nearBoundary: boolean; agreementSplit: boolean; tableSensitive: boolean }
  }
  /** 추가: 항상 true — 이 보고서의 비교·상태는 모두 추론이다 */
  inferred: true
}

// ─────────────────────────────────────────── 표(데이터) 형식

export type LevelRuleId = "exp.lv.group.v1" | "exp.lv.grain.v1" | "exp.lv.flux.v1" | "exp.lv.outward.v1"
export type TenGodGroupCode = "bigyeop" | "siksang" | "jaeseong" | "gwansal" | "inseong"
export type FactEvidence = "trait" | "situation"
/** 사실 → 차원 방향. 한 방향 차원은 high|low, grain은 steady|edge */
export type FactDirection = "high" | "low" | SelfLean

export interface GroupRuleParams {
  group: TenGodGroupCode
  hiddenOnlyModerate: number
  stemOnlyModerate: number
  rootedStrong: number
  rootedStrongWithMonth: number
  hiddenMonthCanBeStrong: boolean
}
/** grain(§3.7.2): q = 고른 쪽 / (고른 쪽 + 센 쪽), d = |q − 0.5| */
export interface GrainParams {
  /** 고른 쪽 십성(기본 정재·정관·정인·식신) */
  steady: string[]
  /** 센 쪽 십성(기본 편관·상관·편인·겁재). 비견·편재는 어느 쪽에도 넣지 않는다(§3.7.4) */
  edge: string[]
  /** (S + E) / T가 이보다 작으면 faint·balanced(exp.lv.grain.thin) */
  thinShare: number
  /** d가 이보다 작으면 faint·balanced */
  balancedGap: number
  /** d가 이 이상이고 기운 쪽 십성이 연·월·시 천간에 투출하면 strong */
  strongGap: number
  /** lean edge · moderate이고 이 청탁 표지 중 하나가 있으면 strong(exp.mod.grain.clarity). 빈 배열 = 안 씀 */
  clarityFlags: string[]
}
export interface FluxParams {
  keyPillars: ("month" | "day")[]
  strongMinMoving: number
}
export interface OutwardParams {
  strongYang: number
  warmStrongYang: number
  faintYang: number
  coldFaintYang: number
}

export interface DimensionRow {
  id: string
  label: string
  kind: DimensionKind
  rule: LevelRuleId
  params: GroupRuleParams | GrainParams | FluxParams | OutwardParams
  /** 보정 규칙 id(현재 "exp.mod.drive.v1"만) */
  mods: string[]
  /** 공통 메모 규칙(§3.10): "load" · "surplus" */
  notes: ("load" | "surplus")[]
  /** 기질 답(trait) 사실 → 이 차원. 상황 답은 self.situation 설정으로 lived-link에서 읽는다(핵심 차원만) */
  facts: { key: string; direction: FactDirection; weight: number; evidence: "trait" }[]
}

export type StrategyMode = "activate" | "press"

export interface DimensionTable {
  id: string
  version: string
  status: "designed" | "provisional" | "reviewed" | "approved"
  claim: "service-model"
  basedOn: string
  source: string
  note: string
  evidenceLevel: EvidenceLevel
  hiddenStemTable: "kr-monthly-30"
  levels: { present: PotentialLevel[] }
  sensitivity: { hourStableMin: number; compareTable: "cn-lunarjs" | "main-only" }
  /**
   * 자기보고 신호 문턱. 0.2.0에서 unsureFactor·mbtiOnlyFactor 폐지 — "사실 없음 + 확신 + 신호 줄 → 그 방향"은 코드의 명시 규칙,
   * 확신 없는 답은 신호에 쓰지 않는다(연구소장 §6.2 규칙 2). 두 필드가 표에 있으면 검증이 멈춘다.
   */
  self: {
    highAt: number
    lowAt: number
    /** ["trait"] 고정(상황 사실만으로 developed 금지 — 표 검증이 다른 값을 막는다) */
    developedEvidence: FactEvidence[]
    situation: { from: "lived-link"; questions: string[]; direction: "high"; weight: number }
  }
  dimensions: DimensionRow[]
  luck: {
    groupMap: Record<TenGodGroupCode, { activate: string; feed: string; press: string }>
    flux: { dimensionId: string; types: ("clash" | "punishment")[]; natalPillars: ("month" | "day")[] }
  }
  strategies: {
    matrix: Record<ExpressionStatus, { activate: string; press: string }>
    /** 차원별 예외: 차원 id → 방식 → 상태 → 전략 id(없으면 matrix). 예: grain press(반대 결 요구) → exp.st.stretch(§5.7) */
    overrides: Record<string, Partial<Record<StrategyMode, Partial<Record<ExpressionStatus, string>>>>>
    tone: { support: string; load: string }
    catalog: Record<string, string>
  }
  gaeunPriority: {
    fill: Record<ExpressionStatus, number>
    ease: Record<ExpressionStatus, number>
    other: number
    changeWishBoost: number
  }
  /** changeWish 값 → 차원 id(개운 순서 보정) */
  changeWish: Record<string, string[]>
  /** 원형 id → 관련 차원 id */
  archetypeLinks: Record<string, string[]>
}

export interface MbtiBridge {
  id: string
  version: string
  status: "designed" | "provisional" | "reviewed" | "approved"
  claim: "service-model"
  note: string
  axes: { axis: MbtiAxis; poles: [string, string] }[]
  /**
   * 신호 줄(0.2.0: E→outward high, J→grain steady, P→grain edge 세 줄만 — tables.ts MBTI_SIGNAL_LINKS).
   * MBTI는 low를 만들지 않는다. 확신(sure:true)일 때만 쓴다.
   */
  links: {
    dimensionId: string
    axis: MbtiAxis
    pole: string
    /** 한 방향 차원은 "high", grain은 "steady" | "edge" */
    direction: "high" | SelfLean
    weight: number
    grade: "A" | "A-" | "B" | "B-"
    /** 항상 true(확신 없는 답은 신호에 쓰지 않음) */
    sureOnly: true
    claim: "service-model"
  }[]
  /** 조언 문체 힌트(판정에 쓰지 않음). 확신 없는 답에도 쓴다 */
  styleHints: { axis: MbtiAxis; pole: string; hint: string }[]
}
