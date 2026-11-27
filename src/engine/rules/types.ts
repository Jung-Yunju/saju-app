// 명리 규칙 엔진 데이터 구조 (P3-05 rules@0.2.0 + P3-06 rules@0.3.0) — 해석 재료(RuleAnalysis)
// 역법 객관값(CalendarResult, ../types.ts)과 분리된 모듈이다(D-012). 이 파일은 해석 문장을 담지 않는다.
// 근거 명세: docs/knowledge/rules-spec.md, docs/knowledge/strength-structure-spec.md(P3-06), 학파 옵션: docs/knowledge/schools.md §0
import type { Branch, Element, Pillar, Stem } from "../types"

// ─────────────────────────────────────────── 옵션

export type HiddenStemTableId = "kr-monthly-30" | "cn-lunarjs" | "main-only"

/**
 * 해석(규칙) 옵션. 역법 옵션(EngineOptions)과 분리한다(D-012). 결과에 해석에 쓴 값을 모두 저장한다.
 * 기본값은 DEFAULT_RULE_OPTIONS(연구소장 제안, 전부 잠정 — 대표·연구소장 확정 대기).
 */
export interface RuleOptions {
  /** ⚑ 지장간 표 (rules-spec §3) */
  hiddenStemTable: HiddenStemTableId
  /** ⚑ 지지 음양 기준: 정기 음양(byMainQi) / 지지 순번 음양(byOrder). 子午巳亥만 다르다 (rules-spec §2) */
  branchYinYang: "byMainQi" | "byOrder"
  /** ⚑ 12운성 음간: 역행(양생음사) / 양간과 같음(음양동생) (rules-spec §5) */
  twelveStagesYin: "reverse" | "sameAsYang"
  /** ⚑ 12운성 토(戊己): 화토동법 / 수토동법 (rules-spec §5) */
  earthStages: "withFire" | "withWater"
  /**
   * 오행 가중 분포(elements.weighted)의 가중치 버전 (rules-spec §9, schools.md §8).
   * rules@0.2.0에서는 오행 분포에만 쓴다. 신강약 판정은 P3-06 범위.
   */
  strengthModel: "weighted-v1"
  /** ⚑ 공망 기준 기둥 (rules-spec §8) */
  gongmangBasis: "day" | "year" | "both"
  /** ⚑ 반합 인정 범위: 왕지를 낀 쌍만 / 생지+고지까지 (rules-spec §7) */
  halfCombine: "withKingOnly" | "allPairs"
  /** ⚑ 삼형을 두 글자로도 기록할지. true면 partial: true로 표시 (rules-spec §7) */
  partialPunishment: boolean
  /** ⚑ 午未 육합의 결과 오행: 화 / 토 / 정하지 않음(null) (rules-spec §7) */
  wuWeiCombine: "fire" | "earth" | "none"
  /**
   * ⚑ 방합을 두 글자로도 기록할지 (rules-spec §7 "두 글자 방합 인정 여부 ⚑ — 기본: 세 글자만").
   * schools.md §0 제안 목록에는 없는 키 — 엔진 개발자가 추가(연구소장 확인 필요).
   */
  partialDirectional: boolean

  // ── P3-06 (rules@0.3.0, strength-structure-spec §6). 기본값은 연구소장 제안 — 전부 잠정
  /** 신강약 대표 판정 모형. 세 모형은 항상 모두 계산한다 (§1.10) */
  strengthPrimary: "weighted" | "threeFactor" | "rooted"
  /** 득령·왕상휴수사 기준. "byDays"(사령)는 예약만 된 값 → EngineInputError (§1.6) */
  monthCommandBasis: "mainQi" | "byDays"
  /** ⚑ 득지 범위: 일지 정기 / 일지 지장간 중 하나 (§1.1) */
  deukjiBasis: "dayBranchMainQi" | "dayBranchAnyRoot"
  /** 합화·충 보정. 1차는 "none"만 (§1.7) */
  combineAdjustment: "none"
  /** ⚑ 격 투출 규칙: 투출 우선(G2) / 정기 고정(G2') (§2.2) */
  structureTouchul: "transparentFirst" | "mainQiOnly"
  /** ⚑ 투출 일치: 같은 글자 / 같은 오행 (§2.2 G3) */
  touchulMatch: "sameStem" | "sameElement"
  /** 록겁월 대체 후보(G1-alt)를 낼지 (§2.2) */
  rokgeopAlternative: boolean
  /** 특수격: 후보만(확신도 low 고정) / 끔 (§2.4) */
  specialStructures: "candidateOnly" | "off"
  /** 용신 관점 목록(순서 = views 순서). byeongyak은 기본에서 뺀다 (§3.4) */
  usefulGodMethods: UsefulGodMethod[]
  /** ⚑ 희신 정의: 용신을 생하는 오행 / 같은 관점 2순위 후보 (§3.7) */
  favorableDefinition: "generationCycle" | "secondCandidate"
}

export type UsefulGodMethod = "eokbu" | "johuClimate" | "tonggwan" | "byeongyak" | "gyeokguk" | "special"

// ─────────────────────────────────────────── 위치(근거)

/** 원국 기둥 */
export type NatalPillarKey = "year" | "month" | "day" | "hour"
/** 근거 기둥. daeun = extra.luck[luckIndex], seun = extra.year */
export type PillarKey = NatalPillarKey | "daeun" | "seun"

/**
 * 근거 위치. AI 서술 검증기(P4-04)가 "근거 글자가 원국/운에 있는지" 확인할 때 쓴다.
 * 지장간은 part="branch"(그 지지)로 두고 TenGodHit.viaHiddenStem에 역할을 적는다.
 */
export interface Position {
  pillar: PillarKey
  part: "stem" | "branch"
  /** pillar="daeun"일 때만: extra.luck 배열의 0부터 번호 */
  luckIndex?: number
}

export type YinYang = "yang" | "yin"

// ─────────────────────────────────────────── 지장간

export type HiddenStemRole = "yeogi" | "junggi" | "jeonggi"

export interface HiddenStem {
  stem: Stem
  /** 여기(餘氣) · 중기(中氣) · 정기(正氣) */
  role: HiddenStemRole
  /** 월률 날수. 날수가 없는 표(cn-lunarjs, main-only)는 null */
  days: number | null
  /** 지지 안 비율(합 1). 날수 표는 days/30, 그 외는 임시 비율(rules-spec §3-2, 연구소장 설계값) */
  weight: number
}

export interface HiddenStemsResult {
  tableId: HiddenStemTableId
  /** 순서는 여기 → 중기 → 정기. 시주 모름이면 hour는 null */
  pillars: Record<"year" | "month" | "day", HiddenStem[]> & { hour: HiddenStem[] | null }
}

// ─────────────────────────────────────────── 십성

export type TenGod = "비견" | "겁재" | "식신" | "상관" | "편재" | "정재" | "편관" | "정관" | "편인" | "정인"

export interface TenGodHit {
  position: Position
  /** 판정 대상 글자(천간·지지·지장간 천간) */
  char: Stem | Branch
  tenGod: TenGod
  /** 지장간 판정이면 그 역할. 이때 char는 지장간 천간, position은 그 지지 */
  viaHiddenStem?: HiddenStemRole
}

// ─────────────────────────────────────────── 12운성

export type TwelveStage = "장생" | "목욕" | "관대" | "건록" | "제왕" | "쇠" | "병" | "사" | "묘" | "절" | "태" | "양"

export interface TwelveStageHit {
  /** dayStem = 일간 기준(봉법), ownPillar = 그 기둥 천간 기준(좌법) */
  basis: "dayStem" | "ownPillar"
  /** 기준 천간(일간 또는 그 기둥 천간) */
  stem: Stem
  /** 대상 지지 위치 */
  position: Position
  branch: Branch
  stage: TwelveStage
  /** 예: "twelve-stages:reverse/withFire" */
  tableId: string
}

// ─────────────────────────────────────────── 관계(합충형파해)

export type InteractionType =
  | "stemCombine" // 천간합
  | "stemClash" // 천간충
  | "sixCombine" // 지지 육합
  | "threeCombine" // 삼합(세 글자)
  | "halfCombine" // 반합(삼합 두 글자)
  | "directionalCombine" // 방합
  | "clash" // 지지 충
  | "punishment" // 형
  | "break" // 파
  | "harm" // 해(穿)

export interface Interaction {
  type: InteractionType
  /** 근거 위치(연→월→일→시→대운→세운 순) */
  members: Position[]
  /** members와 같은 순서의 글자 */
  chars: (Stem | Branch)[]
  /** 합 계열의 결과 오행. 午未 육합은 wuWeiCombine 옵션, "none"이면 null. 합이 아닌 관계에는 없음 */
  resultElement?: Element | null
  /** 합화(化) 성립 여부 — 판정하지 않는다(항상 null). 천간합·육합에만 둔다 (rules-spec §6) */
  transformed?: null
  /** 삼합·방합·삼형: 세 글자가 모두 있으면 true */
  complete?: boolean
  /** 삼형·방합을 두 글자로 본 기록(옵션 partialPunishment / partialDirectional) */
  partial?: boolean
  /** 형의 종류: 삼형(three) · 상형(mutual, 子卯) · 자형(self) */
  punishmentKind?: "three" | "mutual" | "self"
  /** 반합: 왕지(子午卯酉)를 끼었는가. false = 생지+고지 쌍(halfCombine="allPairs"일 때만) */
  withKing?: boolean
  /**
   * D-019: 이 두 글자 기록(반합·두 글자 방합·두 글자 삼형)을 포함하는 세 글자 관계(삼합·방합·삼형)의 식별자 목록.
   * 식별자 형식은 interactionId(): `${ruleId}@${위치들}`. 포함하는 세 글자 관계가 없으면 이 필드가 없다.
   * 세 글자 관계에 운 글자가 끼어도 같은 규칙으로 붙인다(원국·운 대칭). 기록은 지우지 않는다.
   */
  subsumedBy?: string[]
  /** 원국 안에서 붙어 있는 기둥인가(세 글자면 연속된 세 기둥). 운이 끼면 항상 false */
  adjacent: boolean
  /** natal = 원국 내부, luck = 대운·세운 글자가 하나 이상 낌 */
  scope: "natal" | "luck"
  /** 적용한 표 항목 예: "branch.clash.子午", "branch.punishment.寅巳申" */
  ruleId: string
}

// ─────────────────────────────────────────── 공망

export interface GongmangEntry {
  basis: "day" | "year"
  /** 기준 기둥(일주·연주)의 간지 */
  basisPillar: Pillar
  /** 순두(그 순의 甲 기둥) */
  xunHead: Pillar
  empty: [Branch, Branch]
  /** 공망 지지에 해당하는 위치(기준 기둥을 뺀 원국 지지 + 대운·세운 지지) */
  hits: Position[]
}

// ─────────────────────────────────────────── 오행 분포

export type ElementRecord = Record<Element, number>

export interface ElementDistribution {
  /** 천간(시주 모름이면 3) + 지지 정기 오행 개수. 일간 포함 */
  counts: ElementRecord
  /** 천간 1.0 + 지지 = 위치 가중 × 지장간 weight 배분. 소수 6자리 반올림 */
  weighted: ElementRecord
  hiddenStemTable: HiddenStemTableId
  strengthModel: RuleOptions["strengthModel"]
  /** weighted에 쓴 위치 가중치 (schools.md §8 weighted-v1 — 연구소장 설계값, 고전 수치 아님) */
  positionWeights: { stem: number; yearBranch: number; monthBranch: number; dayBranch: number; hourBranch: number }
  /** 음양 개수(천간 + 지지). 지지는 branchYinYang 기준 */
  yinYang: { yang: number; yin: number; branchYinYang: RuleOptions["branchYinYang"] }
}

// ─────────────────────────────────────────── 결과

/** ② 명리 해석 재료. 해석 문장은 담지 않는다(콘텐츠 단계 몫). */
export interface RuleAnalysis {
  /** 예: "rules@0.2.0" */
  engineVersion: string
  /** 입력 원국을 만든 역법 엔진 버전(CalendarResult.engineVersion) */
  calendarEngineVersion: string
  /** 해석에 쓴 옵션(기본값 포함 전체) */
  options: RuleOptions
  /** 계산하지 않은 기둥. 시주 모름이면 ["hour"] */
  omitted: "hour"[]
  /** 분석 대상 글자(근거 위치를 검증할 때 이 값과 대조) */
  source: {
    natal: { year: Pillar; month: Pillar; day: Pillar; hour: Pillar | null }
    /** extra.luck 그대로(없으면 []) */
    luck: Pillar[]
    /** extra.year(세운, 없으면 null) */
    seun: Pillar | null
  }
  dayMaster: { stem: Stem; element: Element; yinYang: YinYang }
  hiddenStems: HiddenStemsResult
  /** 일간 자신은 넣지 않는다(일원 — dayMaster). 순서: 기둥(연→월→일→시→대운→세운)마다 천간 → 지지 → 지장간(원국만) */
  tenGods: TenGodHit[]
  twelveStages: TwelveStageHit[]
  interactions: Interaction[]
  /** gongmangBasis가 both면 [일주 기준, 연주 기준] */
  gongmang: GongmangEntry[]
  elements: ElementDistribution
  // ── P3-06 (rules@0.3.0). 원국만 판단한다(운은 범위 밖). 해석 문장은 없다.
  /** 신강·신약 (spec §1) */
  strength: StrengthResult
  /** 격국 (spec §2) */
  structure: StructureResult
  /** 용신 관점별 (spec §3) */
  usefulGods: UsefulGodsResult
  /** 간이 조후 한난조습 climate-v1 (spec §4) — 궁통보감 표 아님 */
  climate: ClimateResult
  /** 기세 수치·표지 (spec §5) */
  qiFlow: QiFlowResult
}

export interface RuleExtra {
  /** 대운 간지들(예: chart.luck.daeun.map(d => d.pillar) 또는 현재 대운 하나) */
  luck?: Pillar[]
  /** 세운(그해 간지) */
  year?: Pillar
}

// ─────────────────────────────────────────── P3-06 신강약 (strength-structure-spec §1)
// 점수·경계값·가중치는 모두 연구소장 설계값이다(고전에 이런 점수표는 없다). 수치는 가중 단위(천간 1.0 = 30u).

export type StrengthModel = "weighted" | "threeFactor" | "rooted"
export type StrengthVerdict = "신강" | "중화" | "신약"
/** 십성 묶음(오행 관계만, 음양 무관) */
export type TenGodGroup = "bigyeop" | "inseong" | "siksang" | "jaeseong" | "gwansal"
export type SeasonState = "旺" | "相" | "休" | "囚" | "死"

export interface StrengthBasisItem {
  /** 천간이면 그 천간 위치, 지장간이면 그 지지 위치 + viaHiddenStem */
  position: Position
  /** 천간 또는 지장간 천간 */
  char: Stem
  viaHiddenStem?: HiddenStemRole
  element: Element
  /** 일간 자신은 "self" */
  group: TenGodGroup | "self"
  side: "support" | "oppose"
  /** 1.0 / 3.0 / 1.5 (weighted-v1) */
  positionWeight: number
  /** 천간 1, 지장간은 표의 weight */
  hiddenWeight: number
  /** rooted 모형의 무근 천간 0.5, 그 외 1 */
  rootFactor: number
  /** positionWeight × hiddenWeight × rootFactor (소수 6자리) */
  points: number
}

export interface FactorCheck {
  met: boolean
  /** 판정에 쓴 위치(득세는 돕는 쪽으로 센 위치) */
  basis: Position[]
  ruleId: string
}

export interface StrengthModelResult {
  model: StrengthModel
  /** round6(support / total). threeFactor는 null */
  ratio: number | null
  /** ratio × 100, 소수 1자리. threeFactor는 null */
  score: number | null
  /** threeFactor는 "중화"를 내지 않는다 */
  verdict: StrengthVerdict
  extreme: "strong" | "weak" | null
  nearBoundary: boolean
  nearest: { threshold: number; distance: number } | null
  /** 돕는 쪽 가중 합 S(일간 포함, 6자리). threeFactor는 null — 엔진 개발자 추가 필드(검산용) */
  support: number | null
  /** 전체 가중 합 T(6자리). threeFactor는 null — 엔진 개발자 추가 필드(검산용) */
  total: number | null
  factors?: { deukryeong: FactorCheck; deukji: FactorCheck; deukse: FactorCheck & { count: number; of: number } }
  /** weighted·rooted: 글자(지장간) 단위 근거. threeFactor: 빈 배열(근거는 factors) */
  basis: StrengthBasisItem[]
  /** "strength.weighted.v1" · "strength.threeFactor.v1" · "strength.rooted.v1" */
  ruleId: string
}

export interface StrengthAffected {
  ruleId: string
  type: InteractionType
  members: Position[]
  /** 월지·일지·일간·돕는 천간이 members에 있으면 true */
  critical: boolean
  /** D-019 포함 표시를 그대로 옮김 */
  subsumedBy?: string[]
}

export interface StrengthResult {
  primary: StrengthModel
  /** 세 모형 모두, 순서 weighted → threeFactor → rooted */
  models: StrengthModelResult[]
  /** 세 모형의 verdict가 모두 같은가 */
  agreement: "all" | "split"
  seasonState: SeasonState
  dayMasterRooted: boolean
  dayMasterRoots: { position: Position; stem: Stem; role: HiddenStemRole }[]
  /** 일간 제외 묶음 합계(weighted 모형 가중, 6자리) */
  groupTotals: Record<TenGodGroup, number>
  /** 선택한 표 외의 두 표로 계산한 모형 A (표 순서 kr-monthly-30 → cn-lunarjs → main-only에서 선택 표 제외) */
  tableSensitivity: { tableId: HiddenStemTableId; ratio: number; verdict: StrengthVerdict; extreme: "strong" | "weak" | null; nearBoundary: boolean }[]
  tableSensitive: boolean
  /** 시주를 알면 null. 모르면 오서둔 12시진(子→亥)마다 모형 A */
  hourSensitivity: null | {
    byHour: { hour: Pillar; ratio: number; verdict: StrengthVerdict }[]
    /** 나온 판정(신강 → 중화 → 신약 순) */
    verdicts: StrengthVerdict[]
    hourSensitive: boolean
  }
  /** 신강약 근거 글자가 낀 원국 관계(합충형파해) — 반영하지 않고 표시만 (§1.7) */
  affectedBy: StrengthAffected[]
  /** 1차 구현은 항상 빈 배열 */
  adjustmentsApplied: []
}

// ─────────────────────────────────────────── P3-06 격국 (§2)

export interface StructureGroupRef {
  group: TenGodGroup
  element: Element
  /** 묶음 중 일부 십성만 해당하면 그 십성(예: 정관격의 꺼리는 '상관'). 없으면 묶음 전체 */
  tenGods?: TenGod[]
  /** 원국 천간(일간 제외) 중 이 묶음(십성 제한 적용)의 위치 */
  touchul: Position[]
  /** 엔진 정의: 원국 지지 중 지장간에 이 오행(십성 제한 적용)이 있는 위치(투출 여부와 별개) */
  hiddenOnly: Position[]
  /** 편인격의 인수·효신 구분 등 */
  note?: string
}

export interface StructureCandidate {
  /** "정관격", "칠살격", "건록격", "종살격 후보", "화토격 후보" … */
  name: string
  alias?: string[]
  kind: "regular" | "rokgeop" | "special"
  school: "자평진전" | "적천수 계열" | "통설"
  /** 격을 잡은 월지 지장간 */
  pivot?: { stem: Stem; role: HiddenStemRole; touchul: Position | null; tenGod: TenGod }
  /** 1차는 high 없음, special은 항상 low */
  confidence: "medium" | "low"
  reversesUsefulGod?: boolean
  /** 특수격 F1~F3, E1~E2, H1~H6 등 */
  conditions?: { id: string; met: boolean; value?: number }[]
  obstructions?: { ruleId: string; members: Position[] }[]
  sangsin?: StructureGroupRef[]
  avoid?: StructureGroupRef[]
  /** G2·G2' 결과 비교 */
  variantAgreement: "same" | "differs"
  /** 특수격: 따르는 묶음(종격·종왕) 또는 합화 오행(화격)·일행 오행 */
  follows?: { group: TenGodGroup | null; element: Element }
  /** 이 후보가 어떤 규칙 변형의 결과인지: primary(선택 옵션) / otherVariant(다른 투출 변형) / rokgeopAlt(G1-alt) / special */
  role: "primary" | "otherVariant" | "rokgeopAlt" | "special"
  ruleId: string
}

export interface StructureResult {
  /** 순서: 주 후보 → 다른 투출 변형 후보(다를 때) → G1-alt 대체 후보 → 특수격 후보 */
  candidates: StructureCandidate[]
  /** 다른 지장간 표로 주 후보 격 이름이 바뀌면 true */
  tableSensitive: boolean
  /** 표별 주 후보 이름(검산용, 표 순서 kr → cn → main) — 엔진 개발자 추가 */
  byTable: { tableId: HiddenStemTableId; name: string }[]
  /** 예: "극신약이나 종격 조건 미충족" */
  notes: string[]
}

// ─────────────────────────────────────────── P3-06 용신 (§3)

export interface UsefulGodCandidate {
  element: Element
  /** 일간 기준 묶음 */
  group: TenGodGroup | null
  rank: number
  /** 원국 안 그 오행 가중(elements.weighted) */
  presentWeight: number
}

export interface FavorableSet {
  definition: "generationCycle" | "secondCandidate"
  xi: Element
  ji: Element
  gu: Element
  han: Element
  /** secondCandidate에서 2순위(희신)가 기신·구신과 같은 오행일 때 그 자리 */
  conflicts?: ("ji" | "gu")[]
}

export interface UsefulGodView {
  method: UsefulGodMethod
  label: string
  school: string
  status: "ok" | "balanced" | "none" | "notApplicable"
  candidates: UsefulGodCandidate[]
  /** rank 1 기준 희기신. 후보가 없거나 secondCandidate인데 2순위가 없으면 없음 */
  favorable?: FavorableSet
  /** eokbu만: 모형별 결과 */
  byModel?: { model: StrengthModel; verdict: StrengthVerdict; status: "ok" | "balanced"; lean?: "weak" | "strong"; candidates: UsefulGodCandidate[]; ruleId: string }[]
  /** eokbu balanced일 때 r < 0.5면 weak */
  lean?: "weak" | "strong"
  confidence: "medium" | "low"
  /** special만: 억부 대표값과 뒤집히는가 */
  reversesUsefulGod?: boolean
  basis: { ruleId: string; positions: Position[]; values?: Record<string, number> }[]
  source: string
}

export interface UsefulGodsResult {
  /** usefulGodMethods 순서 */
  views: UsefulGodView[]
  /** rank 1 기준 — 오행마다 그것을 rank 1로 낸 관점(관점 수 많은 순 → 오행 순) */
  agreement: { element: Element; methods: UsefulGodMethod[] }[]
  /** 대표 결정 전 기본(관점별 병기) */
  displayPolicy: "parallel"
  /**
   * §3.8 (가) "하나만" 대표값 규칙(제안, 대표 결정 대기 6번). 기본 표시 정책이 아니므로 고객 문장에 쓰지 않는다.
   * element null = "뚜렷하게 치우친 기운이 없음"
   */
  singlePickProposal: { element: Element | null; step: "johuExtreme" | "eokbu" | "johu" | "none"; ruleId: "ug.singlePick.proposal-ga" }
}

// ─────────────────────────────────────────── P3-06 조후 (§4)

export interface ClimateResult {
  T: number
  M: number
  tClass: "한강" | "한" | "중" | "난" | "열강"
  mClass: "습강" | "습" | "중" | "조" | "조강"
  needs: ("warm" | "cool" | "dry" | "moisten")[]
  basis: { position: Position; char: Stem | Branch; dT: number; dM: number }[]
  /** 시주 모름이면 3(정규화하지 않음) */
  pillarsUsed: 3 | 4
  ruleId: "climate.v1"
  source: string
}

// ─────────────────────────────────────────── P3-06 기세 (§5)

export interface QiFlowResult {
  shares: Record<Element, number>
  dominant: { element: Element; share: number }
  concentration: number
  missing: Element[]
  flowChain: { elements: Element[]; circular: boolean }
  dayMasterFlow: { toOutput: boolean; toWealth: boolean; fromResource: boolean }
  clarityFlags: { flag: string; members: Position[]; ruleId: string }[]
}
