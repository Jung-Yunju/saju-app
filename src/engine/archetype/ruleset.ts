// 원형 규칙 데이터(코드에 동봉한 JSON) 읽기·검증·해시.
// 규칙 원본: scripts/archetype-lab/rules/research-12-knobC.json 그대로 복사(D-030). 내용이 같다는 것은 테스트가 확인한다.
// 해시는 런타임에 계산하지 않고 상수로 둔다(엔진 안에서 node:crypto를 쓰지 않기 위함). 테스트가 규칙 데이터의 sha256과 대조한다.
import RAW_RULES from "./rules/research-12-knobC.json"
import { FEATURE_INDEX } from "./features"
import type { ArchetypeRuleSet } from "./types"
import { ARCHETYPE_ID_LIST } from "./types"
import { ARCHETYPE_FEATURE_VERSION } from "./version"

/** sha256(canonicalJson(규칙 데이터)) 앞 16자리. 규칙을 고치면 테스트가 실패하므로 새 값으로 바꾸고 버전·CHANGELOG를 갱신한다 */
export const ARCHETYPE_RULES_HASH = "sha256:9bbeaabe286d8d28"

const LEAF_OPS = ["eq", "ne", "in", "gte", "gt", "lte", "lt", "between", "has", "hasAny", "hasNone"] as const
const NUM_OPS = new Set(["gte", "gt", "lte", "lt", "between"])
const LIST_OPS = new Set(["has", "hasAny", "hasNone"])
const CATEGORIES = new Set(["divineBeast", "spiritAnimal", "divineHuman", "nature", "celestial"])

export class ArchetypeRuleSetError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = "ArchetypeRuleSetError"
  }
}

function fail(where: string, msg: string): never {
  throw new ArchetypeRuleSetError(`${where}: ${msg}`)
}

function checkValue(where: string, key: string, val: unknown): void {
  const spec = FEATURE_INDEX.get(key)!
  if (val === null) {
    if (!spec.nullable) fail(where, `${key}는 null이 될 수 없음`)
    return
  }
  if (spec.type === "number") {
    if (typeof val !== "number" || !Number.isFinite(val)) fail(where, `${key}는 숫자 특징 — 값 ${JSON.stringify(val)}`)
    return
  }
  if (spec.type === "boolean") {
    if (typeof val !== "boolean") fail(where, `${key}는 참/거짓 특징 — 값 ${JSON.stringify(val)}`)
    return
  }
  if (typeof val !== "string") fail(where, `${key}는 문자열 특징 — 값 ${JSON.stringify(val)}`)
  if (spec.domain && spec.domain.length && !spec.domain.includes(val)) fail(where, `${key}에 없는 값 "${val}"`)
}

/** 조건 검증: 없는 특징 키·없는 값·연산자 오류를 조용히 넘기지 않는다 */
export function validateCondition(c: unknown, where: string): void {
  if (!c || typeof c !== "object" || Array.isArray(c)) fail(where, "조건은 객체여야 함")
  const o = c as Record<string, unknown>
  const keys = Object.keys(o)
  if (keys.length === 1 && (keys[0] === "all" || keys[0] === "any")) {
    const arr = o[keys[0]]
    if (!Array.isArray(arr) || arr.length === 0) fail(where, `${keys[0]}은 비지 않은 배열`)
    arr.forEach((x, i) => validateCondition(x, `${where}.${keys[0]}[${i}]`))
    return
  }
  if (keys.length === 1 && keys[0] === "not") return validateCondition(o.not, `${where}.not`)
  if (typeof o.f !== "string") fail(where, `잎 조건에는 f(특징 키)가 필요 — ${JSON.stringify(c)}`)
  const spec = FEATURE_INDEX.get(o.f)
  if (!spec) fail(where, `없는 특징 키 "${o.f}"`)
  const ops = keys.filter((k) => k !== "f")
  if (ops.length !== 1 || !(LEAF_OPS as readonly string[]).includes(ops[0])) fail(where, `연산자는 하나만 — ${JSON.stringify(c)}`)
  const op = ops[0]
  const val = o[op]
  if (NUM_OPS.has(op)) {
    if (spec.type !== "number") fail(where, `${op}는 숫자 특징에만 — ${o.f}`)
    if (op === "between") {
      if (!Array.isArray(val) || val.length !== 2 || !val.every((x) => typeof x === "number") || val[0] > val[1]) fail(where, "between은 [작은값, 큰값]")
    } else if (typeof val !== "number") fail(where, `${op} 값은 숫자`)
    return
  }
  if (LIST_OPS.has(op)) {
    if (spec.type !== "string[]") fail(where, `${op}는 목록 특징에만 — ${o.f}`)
    const items = op === "has" ? [val] : val
    if (!Array.isArray(items) || items.length === 0 || !items.every((x) => typeof x === "string")) fail(where, `${op} 값 오류`)
    if (spec.domain && spec.domain.length) for (const x of items as string[]) if (!spec.domain.includes(x)) fail(where, `${o.f}에 없는 값 "${x}"`)
    return
  }
  if (spec.type === "string[]") fail(where, `${op}는 목록 특징(${o.f})에 쓸 수 없음`)
  if (op === "in") {
    if (!Array.isArray(val) || val.length === 0) fail(where, "in 값은 비지 않은 배열")
    for (const x of val) checkValue(where, o.f, x)
    return
  }
  checkValue(where, o.f, val)
}

/** 규칙 데이터 검증. 원형 12개가 ARCHETYPE_ID_LIST와 같은 id·같은 관문 순서여야 한다 */
export function validateArchetypeRuleSet(raw: unknown): ArchetypeRuleSet {
  const r = raw as ArchetypeRuleSet
  if (!r || typeof r !== "object") fail("ruleSet", "객체가 아님")
  for (const k of ["id", "version", "source", "disclaimer", "featureVersion", "fallback"] as const)
    if (typeof r[k] !== "string" || !r[k]) fail("ruleSet", `${k} 필요`)
  if (r.mode !== "cascade") fail("ruleSet", "mode는 cascade만 지원")
  if (!["example", "draft", "approved"].includes(r.status)) fail("ruleSet", "status는 example|draft|approved")
  if (!/^\d+\.\d+\.\d+$/.test(r.version)) fail("ruleSet", "version은 x.y.z")
  if (r.featureVersion !== ARCHETYPE_FEATURE_VERSION) fail("ruleSet", `featureVersion ${r.featureVersion} ≠ ${ARCHETYPE_FEATURE_VERSION}`)
  if (!Array.isArray(r.archetypes)) fail("ruleSet", "archetypes 배열 필요")
  const sorted = [...r.archetypes].sort((a, b) => a.priority - b.priority)
  if (sorted.map((a) => a.id).join(",") !== ARCHETYPE_ID_LIST.join(","))
    fail("ruleSet", `원형 id·순서가 ARCHETYPE_ID_LIST와 다름: ${sorted.map((a) => a.id).join(",")}`)
  const pris = new Set<number>()
  r.archetypes.forEach((a, i) => {
    const w = `archetypes[${i}](${a?.id})`
    if (typeof a.name !== "string" || !a.name) fail(w, "name 필요")
    if (!CATEGORIES.has(a.category)) fail(w, `category 오류 ${a.category}`)
    if (!Number.isInteger(a.priority) || a.priority < 1 || a.priority > 12) fail(w, "priority는 1~12 정수")
    if (pris.has(a.priority)) fail(w, `priority ${a.priority} 중복`)
    pris.add(a.priority)
    for (const k of ["ruleId", "gateLabel"] as const) if (typeof a[k] !== "string" || !a[k]) fail(w, `${k} 필요`)
    if (a.require === undefined) fail(w, "관문 조건(require) 필요")
    validateCondition(a.require, `${w}.require`)
    if (a.exclude !== undefined) validateCondition(a.exclude, `${w}.exclude`)
    if ("terms" in a && Array.isArray((a as { terms?: unknown[] }).terms) && (a as { terms: unknown[] }).terms.length)
      fail(w, "cascade 규칙에 점수 항목(terms)은 쓰지 않음")
  })
  if (!(ARCHETYPE_ID_LIST as readonly string[]).includes(r.fallback)) fail("ruleSet", `fallback "${r.fallback}"가 원형 목록에 없음`)
  return r
}

/** 키 정렬 JSON(배열 순서 유지) — 해시·결정성 비교용 */
export function canonicalJson(x: unknown): string {
  if (x === null || typeof x !== "object") return JSON.stringify(x)
  if (Array.isArray(x)) return `[${x.map(canonicalJson).join(",")}]`
  const o = x as Record<string, unknown>
  return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(",")}}`
}

let cached: { rs: ArchetypeRuleSet; ordered: readonly ArchetypeRuleSet["archetypes"][number][] } | null = null

/** 동봉 규칙(검증 1회 후 고정). 반환값을 고치지 말 것 */
export function archetypeRules(): { rs: ArchetypeRuleSet; ordered: readonly ArchetypeRuleSet["archetypes"][number][] } {
  if (!cached) {
    const rs = validateArchetypeRuleSet(RAW_RULES as unknown)
    cached = { rs, ordered: Object.freeze([...rs.archetypes].sort((a, b) => a.priority - b.priority)) }
  }
  return cached
}

