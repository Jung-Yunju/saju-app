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
    /** (facts@0.3.0, D-023 ②) 개운 선택에 쓴 규칙 엔진 값. 판정이 아니라 옮겨 적은 값이다 */
    gaeunBasis?: GaeunBasis
    /** (facts@0.3.0, D-023 ②) 코드가 고른 개운(바꿔 사는 법) 범주. AI는 이 범주를 말로 옮기기만 한다 */
    gaeun?: GaeunPick[]
  }
  luck: {
    direction: "forward" | "backward"
    daeun: { index: number; startAge: number; startYear: number; ganzhi: string; current: boolean }[]
    thisYear: { year: number; ganzhi: string }
    /** (facts@0.3.0) 지금 대운·올해 세운 글자의 십성과 원국 관계(규칙 엔진 결과). 규칙 엔진에 그 운을 넘기지 않았으면 그 슬롯이 없다 */
    glyphs?: LuckGlyphFacts[]
    /** (facts@0.3.0) shaking = 올해 세운 지지가 원국 일지·월지와 충 또는 형(gaeun.md §3.2). "흔들리는 해"는 이 값이 true일 때만 쓴다 */
    seunFlags?: { shaking: boolean }
  }
  personal: {
    /**
     * 사용자가 직접 말한 사실 — 배경으로만, 맞히기 금지.
     * link(facts@0.3.0): 사주 글자와의 연결(personalize/lived-link.ts, 드러난 글자 묶음 개수 기준). match = 글자에도 있음,
     * mismatch = 글자엔 약한데 살아 냄. **link가 없으면 unlinked** = 사주로 설명하지 않고 배경으로만. group은 십성 묶음 코드
     */
    userFacts: { topic: string; value: string; period?: string; link?: { kind: "match" | "mismatch"; group: GaeunGroup } }[]
    /** 이 해들은 "맞히는" 문장을 쓰지 않는다 */
    noGuessYears: number[]
    guards: string[]
  }
  /** 엔진 경고(절입 경계, 시각 모름 등) — 풀이에서 불확실성을 밝힐 때 사용 */
  warnings: string[]
}

// ─────────────────────────────────────────── 개운(D-023 ②, docs/knowledge/gaeun.md §3) — facts@0.3.0 추가분

/** 십성 묶음 코드(규칙 엔진 rules/types.ts TenGodGroup과 같은 이름) */
export type GaeunGroup = "bigyeop" | "siksang" | "jaeseong" | "gwansal" | "inseong"

/** 개운 선택 근거값(규칙 엔진 결과를 옮긴 것) */
export interface GaeunBasis {
  /** 드러난 글자(원국 천간 + 지지 정기, 일간 제외) 묶음별 개수 */
  groupCounts: Record<GaeunGroup, number>
  /** 일간 제외 묶음 가중 합계(strength.groupTotals) */
  groupTotals: Record<GaeunGroup, number>
  strength: {
    /** 대표 모형 판정 */
    verdict: string
    /** 세 모형 판정이 모두 같으면 all */
    agreement: "all" | "split"
    /** 모형 A(weighted) 경계 근처 */
    nearBoundary: boolean
    tableSensitive: boolean
    /** 시주 모름일 때만 true/false, 시주를 알면 null */
    hourSensitive: boolean | null
    /** 모형 A 전체 가중 합 T(천간 1.0 단위 — views[].presentWeight와 같은 단위. 명세의 u 단위 ÷ 30) */
    total: number | null
    /** 억부 덜 대상 묶음 h(N2). 중화면 null */
    easeGroup: GaeunGroup | null
    /** 특수격 후보가 억부 방향을 뒤집는가(C5). 특수격 내용 자체는 사실표에 넣지 않는다 */
    specialReversesEokbu: boolean
  }
  /** 개운에 쓰는 용신 관점(억부·조후·통관)만. 격국·특수격·병약은 넣지 않는다(N7) */
  views: {
    method: "eokbu" | "johuClimate" | "tonggwan"
    status: "ok" | "balanced" | "none" | "notApplicable"
    /** rank 1 오행(목·화·토·금·수) */
    element?: string
    group?: GaeunGroup
    presentWeight?: number
    /** 희신(favorable.xi) — 운 분류 보조로만 */
    xi?: string
    /** 통관: 첫 쌍(공격 → 대상) */
    bridge?: { from: string; to: string }
  }[]
  climateNeeds: ("warm" | "cool" | "dry" | "moisten")[]
}

export type GaeunRelationId = "chungDay" | "chungMonth" | "hyeong" | "hap" | "chungOther"

/** 운 한 슬롯(지금 대운 또는 올해 세운)의 글자 사실 */
export interface LuckGlyphFacts {
  slot: "daeun" | "seun"
  ganzhi: string
  /** slot=daeun: FactSheet.luck.daeun[].index */
  daeunIndex?: number
  /** slot=seun: 양력 연도 */
  year?: number
  /** 천간 → 지지 순. 지지의 오행·묶음은 정기 기준 */
  glyphs: { part: "stem" | "branch"; char: string; tenGod: string; group: GaeunGroup; element: string; pos: string }[]
  /** 원국과의 관계(gaeun.md L6 분류, 우선순위 순). 파·해·원진은 넣지 않는다 */
  relations: { id: GaeunRelationId; kind: string; chars: string; positions: string[] }[]
}

/** 코드가 고른 개운 범주 하나(gaeun.md §3.5). 문장은 콘텐츠 프롬프트가 만든다 */
export interface GaeunPick {
  /** "GA.fill.inseong", "GT.build", "GI.chungDay" … (30개 범주 중 하나, GAEUN_CATEGORY_IDS) */
  id: string
  slot: "natal" | "daeun" | "seun" | "nextSeun"
  view: "eokbu" | "johuClimate" | "tonggwan" | "luck"
  /** 목·화·토·금·수 */
  element?: string
  group?: GaeunGroup
  /** L7: 운 글자(천간→지지)의 십성 묶음 */
  luckGroups?: GaeunGroup[]
  framing?: "missingSurface" | "thin" | "use"
  hiddenPresent?: boolean
  tone: "firm" | "soft"
  /** soft로 만든 문(門) — C2면 "태어난 시를 몰라 갈릴 수 있다" 안내 */
  softBy?: ("C1" | "C2" | "C3" | "C5")[]
  tier: "practice" | "reference"
  /** L3: 억부·조후 운 판정이 갈림 */
  split?: { eokbu: string; johuClimate: string }
  /** §4.1 관점 충돌 수준(조후 쪽 pick에 붙음) */
  conflict?: "compatible" | "tension" | "opposed"
  /** luckHalves 옵션일 때 대운 앞 5년(천간)·뒤 5년(지지) */
  half?: "early" | "late"
  basis: { ruleId: string; positions: string[]; values?: Record<string, number> }[]
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
