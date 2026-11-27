// 콘텐츠 엔진 계약 (P4-03) — 총괄실장 작성. 바꾸려면 총괄실장 승인.
// 원칙: AI는 이 FactSheet에 담긴 "확정 사실"만 서술한다. 규칙 판단(십성·합충·신강약)은 하지 않는다.
// 담당: 프롬프트(prompts/**) = 콘텐츠 작가, 사실표 생성·생성 파이프라인 = 백엔드.

/** AI에 넘기는 확정 사실표. 개인정보 최소화: 이름·생년월일·출생지 이름은 넣지 않는다. */
export interface FactSheet {
  schemaVersion: 1
  engineVersion: string
  /** 기준 시각(ISO) — "올해", 나이 계산 기준 */
  asOf: string
  subject: {
    /** 호칭(예: "손주"). 실명은 넣지 않는다 */
    addressAs: string
    gender: "M" | "F"
    ageYears: number
    lifeStage: string
    hourKnown: boolean
  }
  chart: {
    /** "甲辰" 형태. 시각 모름이면 hour null */
    pillars: { year: string; month: string; day: string; hour: string | null }
    dayMaster: { stem: string; element: string; yinYang: "yang" | "yin" }
    elements: { counts: Record<string, number>; weighted?: Record<string, number> }
    /** 근거 위치와 함께 정리한 십성 (예: { char:"庚", pos:"month.stem", tenGod:"편관" }) */
    tenGods: { char: string; pos: string; tenGod: string }[]
    /** 합충형파해 등 (예: { kind:"충", chars:"子午", positions:["year.branch","day.branch"], adjacent:false }) */
    interactions: { kind: string; chars: string; positions: string[]; adjacent: boolean; note?: string }[]
    gongmang: { branches: string[]; hits: string[] }
    /** 신강약·용신(P3-06 완성 후 채움, 없으면 생략) */
    strength?: { verdict: string; views?: { method: string; verdict: string }[] }
    usefulGod?: { method: string; element: string }[]
    climate?: { summary: string }
  }
  luck: {
    direction: "forward" | "backward"
    daeun: { index: number; startAge: number; startYear: number; ganzhi: string; current: boolean }[]
    thisYear: { year: number; ganzhi: string }
  }
  personal: {
    /** 사용자가 직접 말한 사실 — 배경으로만, 맞히기 금지 */
    userFacts: { topic: string; value: string; period?: string }[]
    /** 이 해들은 "맞히는" 문장을 쓰지 않는다 */
    noGuessYears: number[]
    guards: string[]
  }
  /** 엔진 경고(절입 경계, 시각 모름 등) — 풀이에서 불확실성을 밝힐 때 사용 */
  warnings: string[]
}

/** 장(chapter) 하나를 만드는 프롬프트 명세 — 콘텐츠 작가가 prompts/에 정의 */
export interface ChapterSpec {
  id: string
  title: string
  /** 이 장을 포함하는 상품 코드들 (예: ["BASIC","LIFE"]) — docs/business/product-proposal.md 기준 */
  products: string[]
  /** 출력 상한 토큰(생성기가 사용) */
  maxOutputTokens: number
  /** 사실표 → 메시지 */
  build(facts: FactSheet): { system: string; user: string }
  /** 출력 JSON 스키마(JSON Schema 객체). 생성기는 구조화 출력으로 강제 */
  outputSchema: Record<string, unknown>
}

/** 생성 결과 한 장 */
export interface ChapterResult {
  id: string
  ok: boolean
  output?: unknown
  error?: string
  usage?: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; model: string; costUsdEstimate: number }
  verify?: { pass: boolean; findings: unknown[] }
  attempts: number
}
