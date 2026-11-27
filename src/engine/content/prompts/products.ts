// 상품 코드와 상품별 장 구성 (P4-03) — 담당: 콘텐츠 작가
// 상품 목록 기준: docs/business/product-proposal.md 추천안(안 B)의 11종 + 무료. 상품 목록 자체가 대표 결정 대기(제안서 §7-2).
// 코드값: 현행 DB ReadingType(BASIC·MONEY·LOVE·CAREER·BULLY·CONFLICT)과 같은 이름을 쓰고, 나머지는 새로 정했다.
// 묶음(3개 묶음·올패스)은 상품이 아니라 상품 코드의 조합이다 → chaptersForProducts()로 장을 합치고 같은 장은 한 번만 만든다.
// 장 순서 = 화면에 보이는 순서.

export const PRODUCT_CODES = [
  "FREE",
  "BASIC",
  "MONEY",
  "LOVE",
  "CAREER",
  "BULLY",
  "CONFLICT",
  "LIFE",
  "DECADE",
  "COMPAT",
  "YEAR",
  "CONCERN",
] as const

export type ProductCode = (typeof PRODUCT_CODES)[number]

export interface ProductDef {
  code: ProductCode
  /** 제안서의 상품 이름 */
  name: string
  /** 메뉴 이름 추천안(menu-names.md ★, 대표 승인 대기) */
  menuName: string
  tier: "free" | "paid"
  /** 개인화 설문 상품 코드(src/engine/personalize/types.ts Product). 설문 문항 고를 때 사용 */
  surveyProduct: "free" | "basic" | "love" | "money" | "career" | "compat" | "concern" | null
  /** false면 이 계약(FactSheet 한 사람분)으로는 아직 만들 수 없다 — chaptersForProduct가 빈 배열을 돌려준다 */
  supported: boolean
  note?: string
}

export const PRODUCTS: readonly ProductDef[] = [
  { code: "FREE", name: "무료 요약", menuName: "생김새 한 장 · 올해 한 줄", tier: "free", surveyProduct: "free", supported: true },
  { code: "BASIC", name: "나는 어떤 사람인가", menuName: "타고난 옷감", tier: "paid", surveyProduct: "basic", supported: true, note: "유료 기본 풀이 8장" },
  { code: "MONEY", name: "왜 돈이 안 모일까", menuName: "곳간 셈", tier: "paid", surveyProduct: "money", supported: true },
  { code: "LOVE", name: "왜 연애가 안 될까", menuName: "곁자리 이야기", tier: "paid", surveyProduct: "love", supported: true },
  { code: "CAREER", name: "왜 직장이 안 맞을까", menuName: "네 손이 잘하는 일", tier: "paid", surveyProduct: "career", supported: true },
  {
    code: "BULLY", name: "이 사람은 왜 나를 괴롭힐까", menuName: "(미정)", tier: "paid", surveyProduct: null, supported: false,
    note: "상대방 사실표가 필요하다 — 계약에 두 번째 사람(상대) 칸이 없어 보류. 제3자 개인정보 동의 문구도 대표 결정 대기",
  },
  {
    code: "CONFLICT", name: "우리는 왜 맨날 싸울까", menuName: "(미정)", tier: "paid", surveyProduct: null, supported: false,
    note: "상대방 사실표가 필요하다 — BULLY와 같은 이유로 보류",
  },
  { code: "LIFE", name: "인생 총괄", menuName: "네 인생 한 두루마리", tier: "paid", surveyProduct: "basic", supported: true, note: "기본 8장 + 지나온 마디·남은 마디" },
  { code: "DECADE", name: "향후 10년", menuName: "앞으로 열 해 날씨", tier: "paid", surveyProduct: "basic", supported: true },
  {
    code: "COMPAT", name: "궁합(2인)", menuName: "둘이 한 상에 앉으면", tier: "paid", surveyProduct: "compat", supported: false,
    note: "두 사람 사실표와 두 사람 사이의 관계(규칙 엔진) 칸이 필요하다 — 계약 확장 후 장을 만든다",
  },
  {
    code: "YEAR", name: "올해(신년) 운세", menuName: "한 해 옷 고쳐 입기", tier: "paid", surveyProduct: "basic", supported: true,
    note: "임시 구성 — 월운(달마다의 간지) 사실이 계약에 없어 달별 장을 만들지 못했다",
  },
  {
    code: "CONCERN", name: "현재 고민", menuName: "갈림길 앞에서", tier: "paid", surveyProduct: "concern", supported: false,
    note: "고민 자유 서술을 받을지 대표 결정 대기(survey.md §6). 받으면 위기 신호 사전 검사와 함께 장을 만든다",
  },
]

/** 유료 기본 풀이 8장(BASIC) — 무료 미리보기 목차도 이 순서 */
export const BASIC_CHAPTER_IDS = ["nature", "talent", "money", "people", "daeun-now", "year-ahead", "crossroads", "closing"] as const

/** 상품별 장 구성(순서 = 화면 순서). 지원하지 않는 상품은 빈 배열 */
export const PRODUCT_CHAPTERS: Record<ProductCode, readonly string[]> = {
  FREE: ["free-nature", "free-elements", "free-year", "free-preview"],
  BASIC: BASIC_CHAPTER_IDS,
  MONEY: ["nature", "money-deep", "daeun-now", "year-ahead", "crossroads", "closing"],
  LOVE: ["nature", "love-deep", "daeun-now", "year-ahead", "crossroads", "closing"],
  CAREER: ["nature", "talent", "career-deep", "daeun-now", "year-ahead", "crossroads", "closing"],
  BULLY: [],
  CONFLICT: [],
  LIFE: ["nature", "talent", "money", "people", "life-past", "daeun-now", "life-ahead", "year-ahead", "crossroads", "closing"],
  DECADE: ["nature", "decade-weather", "decade-pack", "year-ahead", "crossroads", "closing"],
  COMPAT: [],
  YEAR: ["nature", "daeun-now", "year-ahead", "crossroads", "closing"],
  CONCERN: [],
}

export function isProductCode(v: unknown): v is ProductCode {
  return typeof v === "string" && (PRODUCT_CODES as readonly string[]).includes(v)
}
