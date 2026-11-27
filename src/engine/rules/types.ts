// 명리 규칙 엔진 데이터 구조 (P3-05, rules@0.2.0) — 해석 재료(RuleAnalysis)
// 역법 객관값(CalendarResult, ../types.ts)과 분리된 모듈이다(D-012). 이 파일은 해석 문장을 담지 않는다.
// 근거 명세: docs/knowledge/rules-spec.md, 학파 옵션: docs/knowledge/schools.md §0
// 범위 밖(P3-06): 신강약·격국·용신 — 이 타입에는 그 필드를 두지 않는다.
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
}

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
}

export interface RuleExtra {
  /** 대운 간지들(예: chart.luck.daeun.map(d => d.pillar) 또는 현재 대운 하나) */
  luck?: Pillar[]
  /** 세운(그해 간지) */
  year?: Pillar
}
