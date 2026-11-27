// 콘텐츠 엔진 프롬프트 입구 (P4-03) — 담당: 콘텐츠 작가
// 생성 파이프라인(백엔드)은 여기서 CHAPTERS·chaptersForProduct만 가져다 쓴다.
//   const specs = chaptersForProduct("BASIC")
//   for (const s of specs) { const { system, user } = s.build(facts); ... max_tokens = s.maxOutputTokens; schema = s.outputSchema }
// 장 목록·상품 구성·사실표 사용 항목: docs/knowledge/content-chapters.md
import type { PromptChapter } from "./chapter"
import { BASIC_CHAPTERS } from "./chapters/basic"
import { FREE_CHAPTERS } from "./chapters/free"
import { SPECIAL_CHAPTERS } from "./chapters/special"
import { PRODUCTS, PRODUCT_CHAPTERS, PRODUCT_CODES, isProductCode, type ProductCode } from "./products"

export { PRODUCTS, PRODUCT_CHAPTERS, PRODUCT_CODES, BASIC_CHAPTER_IDS, isProductCode } from "./products"
export type { ProductCode, ProductDef } from "./products"
export { buildSystemPrompt, systemFor, resolveVoice, resolveTone, PROMPT_VERSION } from "./system"
export { GRANDMA_NAME, SELF_NAME, LAST_WORDS, RELIABILITY_NOTICE, CRISIS_MESSAGE, HEAVY_HEART_LINE, CATCHPHRASES, grandmaDisplayName } from "./persona"
export type { Voice, ToneStrength } from "./persona"
export type { PromptChapter, FactPart, ChapterTier } from "./chapter"
export { PREVIEW_TOPICS } from "./chapters/free"

const ALL: readonly PromptChapter[] = [...FREE_CHAPTERS, ...BASIC_CHAPTERS, ...SPECIAL_CHAPTERS]

/** 장마다 그 장을 쓰는 상품 코드를 상품 구성표(PRODUCT_CHAPTERS)에서 채운다 — 구성표가 단일 원본 */
function productsOf(id: string): string[] {
  return PRODUCT_CODES.filter((code) => PRODUCT_CHAPTERS[code].includes(id))
}

/** 모든 장(무료 → 기본 → 특화 순). products는 상품 구성표에서 채운 값 */
export const CHAPTERS: readonly PromptChapter[] = ALL.map((c) => ({ ...c, products: productsOf(c.id) }))

const BY_ID = new Map<string, PromptChapter>(CHAPTERS.map((c) => [c.id, c]))

export function chapterById(id: string): PromptChapter | undefined {
  return BY_ID.get(id)
}

/**
 * 상품 하나의 장 목록(화면 순서). 지원하지 않는 상품(두 사람 상품·현재 고민 — PRODUCTS[].supported=false)이나
 * 알 수 없는 코드는 빈 배열.
 */
export function chaptersForProduct(product: string): PromptChapter[] {
  if (!isProductCode(product)) return []
  const def = PRODUCTS.find((p) => p.code === product)
  if (!def || !def.supported) return []
  return PRODUCT_CHAPTERS[product].map((id) => {
    const c = BY_ID.get(id)
    if (!c) throw new Error(`상품 ${product}의 장 ${id}가 CHAPTERS에 없음`)
    return c
  })
}

/** 묶음(3개 묶음·올패스 등): 상품들의 장을 합치고 같은 장은 한 번만(처음 나온 자리) */
export function chaptersForProducts(products: readonly string[]): PromptChapter[] {
  const seen = new Set<string>()
  const out: PromptChapter[] = []
  for (const p of products)
    for (const c of chaptersForProduct(p))
      if (!seen.has(c.id)) {
        seen.add(c.id)
        out.push(c)
      }
  return out
}

/** 상품 하나를 만들 때 출력 토큰 상한의 합(비용 상한 추정용) */
export function maxOutputTokensForProduct(product: ProductCode): number {
  return chaptersForProduct(product).reduce((n, c) => n + c.maxOutputTokens, 0)
}
