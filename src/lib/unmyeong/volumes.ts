// 「운명비서」 유료 5권 설정 — D-027 작업 7. 원본: content/unmyeong/volumes.json (운영자가 이 JSON만 고쳐 이름·구성·노출을 바꾼다)
// 계약: docs/redesign/20-unmyeong-plan.md §2 "유료 5권 설정".
// - 가격·결제 연결은 여기서 정하지 않는다(결제 변경은 대표 확인). 권은 현행 상품 코드(products.ts)를 가리키기만 한다.
//   JSON에 price·amount 같은 칸이 생기면 검증이 실패한다.
// - 장 id는 v3 장 id(PRODUCT_CHAPTERS). 연결 상품이 만들지 않는 장은 넣을 수 없다(사면 안 나오는 장을 보여 주지 않기 위해).
// - 아직 없는 장은 { "id": null, "label": "…" } → status "pending"(화면에 "준비 중").
// 순수 모듈(fs 없음) — 화면(클라이언트)에서도 가져다 쓸 수 있다. JSON은 빌드 때 묶이므로 고친 뒤 다시 배포해야 반영된다.
import raw from "../../../content/unmyeong/volumes.json"
import { PRODUCTS, PRODUCT_CHAPTERS, isProductCode, type ProductCode } from "@/engine/content/prompts/products"

export const VOLUMES_CONFIG_VERSION = 1

export interface VolumeChapter {
  /** v3 장 id. 아직 없는 장은 null */
  id: string | null
  /** 화면 이름. 없으면 화면이 장 기본 제목을 쓴다(pending이면 반드시 있음) */
  label: string | null
  status: "ready" | "pending"
}

export interface UnmyeongVolume {
  /** 권 번호(1부터, 화면 순서) */
  no: number
  /** 고정 키("volume-1"). 삽화 자산 키(assets.ts illustrations)와 같다 */
  key: string
  title: string
  subtitle: string
  /** 소개 1~2문장 */
  intro: string
  chapters: VolumeChapter[]
  /** 연결 상품(현행 상품 코드). null = 아직 판매 연결 없음 */
  productCode: ProductCode | null
  visible: boolean
}

export type VolumesResult = { ok: true; value: UnmyeongVolume[] } | { ok: false; errors: string[] }

/** 장 id로 쓸 수 있는 값 = 어떤 상품이든 구성표에 있는 장(무료 장 제외) */
export const KNOWN_PAID_CHAPTER_IDS: readonly string[] = [
  ...new Set(
    PRODUCTS.filter((p) => p.tier === "paid").flatMap((p) => PRODUCT_CHAPTERS[p.code]),
  ),
]

const TITLE_MAX = 30
const SUBTITLE_MAX = 40
const INTRO_MAX = 200
const LABEL_MAX = 40
const KEY_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** 가격을 이 설정에 넣지 못하게 막는 칸 이름 */
const FORBIDDEN_KEYS = ["price", "amount", "won", "krw", "가격"]

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v)
const text = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() !== "" && [...v.trim()].length <= max ? v.trim() : null

/** 문장 수(마침표·물음표·느낌표·말줄임 끝 기준). 소개 1~2문장 검사용 */
function sentenceCount(s: string): number {
  return s.split(/(?<=[.?!。…])\s+/).filter((x) => x.trim() !== "").length
}

function hasForbiddenKey(o: Obj): string | null {
  for (const k of Object.keys(o)) if (FORBIDDEN_KEYS.includes(k.toLowerCase())) return k
  return null
}

/** volumes.json 형식 검증. 오류는 모두 모아 돌려준다(운영자가 한 번에 고치도록) */
export function validateVolumesConfig(input: unknown): VolumesResult {
  const errors: string[] = []
  if (!isObj(input)) return { ok: false, errors: ["최상위가 객체가 아님"] }
  if (input.version !== VOLUMES_CONFIG_VERSION) errors.push(`version은 ${VOLUMES_CONFIG_VERSION}이어야 함`)
  const bad = hasForbiddenKey(input)
  if (bad) errors.push(`가격 칸(${bad})은 이 설정에 넣지 않는다`)
  if (!Array.isArray(input.volumes) || input.volumes.length === 0) {
    errors.push("volumes는 비지 않은 배열이어야 함")
    return { ok: false, errors }
  }
  const out: UnmyeongVolume[] = []
  const seenNo = new Set<number>()
  const seenKey = new Set<string>()
  input.volumes.forEach((v, i) => {
    const at = `volumes[${i}]`
    if (!isObj(v)) return void errors.push(`${at}: 객체가 아님`)
    const fk = hasForbiddenKey(v)
    if (fk) errors.push(`${at}: 가격 칸(${fk})은 넣지 않는다 — 가격은 현행 상품 설정을 따른다`)
    const no = v.no
    if (typeof no !== "number" || !Number.isInteger(no) || no < 1 || no > 20) errors.push(`${at}.no: 1~20 정수`)
    else if (seenNo.has(no)) errors.push(`${at}.no: ${no} 중복`)
    else seenNo.add(no)
    const key = typeof v.key === "string" && KEY_RE.test(v.key) ? v.key : null
    if (!key) errors.push(`${at}.key: 영문 소문자·숫자·하이픈`)
    else if (seenKey.has(key)) errors.push(`${at}.key: ${key} 중복`)
    else seenKey.add(key)
    const title = text(v.title, TITLE_MAX)
    if (!title) errors.push(`${at}.title: 1~${TITLE_MAX}자`)
    const subtitle = text(v.subtitle, SUBTITLE_MAX)
    if (!subtitle) errors.push(`${at}.subtitle: 1~${SUBTITLE_MAX}자`)
    const intro = text(v.intro, INTRO_MAX)
    if (!intro) errors.push(`${at}.intro: 1~${INTRO_MAX}자`)
    else if (sentenceCount(intro) > 2) errors.push(`${at}.intro: 1~2문장`)
    if (typeof v.visible !== "boolean") errors.push(`${at}.visible: true/false`)

    let productCode: ProductCode | null = null
    if (v.productCode === null) productCode = null
    else if (!isProductCode(v.productCode)) errors.push(`${at}.productCode: 현행 상품 코드(products.ts) 또는 null`)
    else {
      const def = PRODUCTS.find((p) => p.code === v.productCode)
      if (!def || def.tier !== "paid") errors.push(`${at}.productCode: 유료 상품이어야 함`)
      else if (!def.supported) errors.push(`${at}.productCode: ${def.code}는 아직 만들 수 없는 상품(supported=false)`)
      else productCode = def.code
    }

    const chapters: VolumeChapter[] = []
    if (!Array.isArray(v.chapters) || v.chapters.length === 0) errors.push(`${at}.chapters: 비지 않은 배열`)
    else {
      const seenCh = new Set<string>()
      v.chapters.forEach((c, j) => {
        const cat = `${at}.chapters[${j}]`
        if (!isObj(c)) return void errors.push(`${cat}: 객체가 아님`)
        const label = c.label === undefined || c.label === null ? null : text(c.label, LABEL_MAX)
        if (c.label !== undefined && c.label !== null && !label) errors.push(`${cat}.label: 1~${LABEL_MAX}자`)
        if (c.id === null) {
          if (!label) errors.push(`${cat}: 준비 중인 장(id null)은 label이 있어야 함`)
          chapters.push({ id: null, label, status: "pending" })
          return
        }
        if (typeof c.id !== "string" || !KNOWN_PAID_CHAPTER_IDS.includes(c.id)) {
          return void errors.push(`${cat}.id: 유료 v3 장 id(PRODUCT_CHAPTERS) 또는 null — 받은 값 ${JSON.stringify(c.id)}`)
        }
        if (seenCh.has(c.id)) errors.push(`${cat}.id: ${c.id} 중복`)
        seenCh.add(c.id)
        if (productCode && !PRODUCT_CHAPTERS[productCode].includes(c.id)) {
          errors.push(`${cat}.id: ${c.id}는 상품 ${productCode}가 만들지 않는 장`)
        }
        if (!productCode && v.productCode === null) {
          // 상품 연결이 없으면 장을 만들 길이 없다 → 준비 중으로 보여 준다
          chapters.push({ id: c.id, label, status: "pending" })
          return
        }
        chapters.push({ id: c.id, label, status: "ready" })
      })
    }
    if (no && key && title && subtitle && intro && typeof v.visible === "boolean") {
      out.push({ no: no as number, key, title, subtitle, intro, chapters, productCode, visible: v.visible })
    }
  })
  if (errors.length) return { ok: false, errors }
  out.sort((a, b) => a.no - b.no)
  return { ok: true, value: out }
}

const parsed = validateVolumesConfig(raw)
if (!parsed.ok) {
  // JSON은 빌드 때 묶인다 → 잘못 고치면 빌드·테스트에서 바로 드러나게 한다
  throw new Error(`content/unmyeong/volumes.json 형식 오류:\n- ${parsed.errors.join("\n- ")}`)
}

/** 검증을 통과한 전체 권(숨김 포함, 번호 순) */
export const UNMYEONG_VOLUMES: readonly UnmyeongVolume[] = parsed.value

/** 화면에 보일 권(visible=true만, 번호 순) */
export function visibleVolumes(): UnmyeongVolume[] {
  return UNMYEONG_VOLUMES.filter((v) => v.visible)
}

export function volumeByKey(key: string): UnmyeongVolume | undefined {
  return UNMYEONG_VOLUMES.find((v) => v.key === key)
}

/** 상품 코드 → 그 상품으로 열리는 권들(결제 후 화면에서 "어느 권이 열렸나" 표시용) */
export function volumesForProduct(code: string): UnmyeongVolume[] {
  return UNMYEONG_VOLUMES.filter((v) => v.productCode === code)
}
