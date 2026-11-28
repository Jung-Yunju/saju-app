// 원형 규칙 파일 읽기·검증·해시. 오타(없는 특징 키·없는 값·연산자 오류)는 조용히 넘기지 않고 오류로 멈춘다.
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { FEATURE_INDEX } from "./features"
import { FEATURE_VERSION, type ArchetypeRuleSet, type ScoreTerm } from "./types"

const LEAF_OPS = ["eq", "ne", "in", "gte", "gt", "lte", "lt", "between", "has", "hasAny", "hasNone"] as const
const NUM_OPS = new Set(["gte", "gt", "lte", "lt", "between"])
const LIST_OPS = new Set(["has", "hasAny", "hasNone"])
const ID_RE = /^[a-z0-9][a-z0-9-]*$/
const CATEGORIES = new Set(["divineBeast", "spiritAnimal", "divineHuman", "nature", "celestial"])

export class RuleSetError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = "RuleSetError"
  }
}

function fail(where: string, msg: string): never {
  throw new RuleSetError(`${where}: ${msg}`)
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
  if (spec.domain && spec.domain.length && !spec.domain.includes(val)) fail(where, `${key}에 없는 값 "${val}" (가능: ${spec.domain.join(" ")})`)
}

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
  if (ops.length !== 1 || !(LEAF_OPS as readonly string[]).includes(ops[0])) fail(where, `연산자는 하나만(${LEAF_OPS.join(",")}) — ${JSON.stringify(c)}`)
  const op = ops[0]
  const val = o[op]
  if (NUM_OPS.has(op)) {
    if (spec.type !== "number") fail(where, `${op}는 숫자 특징에만 — ${o.f}(${spec.type})`)
    if (op === "between") {
      if (!Array.isArray(val) || val.length !== 2 || !val.every((x) => typeof x === "number") || val[0] > val[1]) fail(where, "between은 [작은값, 큰값]")
    } else if (typeof val !== "number") fail(where, `${op} 값은 숫자`)
    return
  }
  if (LIST_OPS.has(op)) {
    if (spec.type !== "string[]") fail(where, `${op}는 목록 특징에만 — ${o.f}(${spec.type})`)
    const items = op === "has" ? [val] : val
    if (!Array.isArray(items) || items.length === 0 || !items.every((x) => typeof x === "string")) fail(where, `${op} 값 오류`)
    if (spec.domain && spec.domain.length) for (const x of items as string[]) if (!spec.domain.includes(x)) fail(where, `${o.f}에 없는 값 "${x}"`)
    return
  }
  if (spec.type === "string[]") fail(where, `${op}는 목록 특징(${o.f})에 쓸 수 없음 — has/hasAny/hasNone`)
  if (op === "in") {
    if (!Array.isArray(val) || val.length === 0) fail(where, "in 값은 비지 않은 배열")
    for (const x of val) checkValue(where, o.f, x)
    return
  }
  checkValue(where, o.f, val)
}

function validateTerm(t: ScoreTerm, where: string): void {
  if (!t || typeof t !== "object") fail(where, "항목은 객체")
  if (typeof t.id !== "string" || !t.id) fail(where, "항목 id 필요")
  if (typeof t.label !== "string" || !t.label) fail(where, "항목 label 필요")
  if (t.when !== undefined) validateCondition(t.when, `${where}.when`)
  const hasP = t.points !== undefined
  const hasL = t.linear !== undefined
  if (hasP === hasL) fail(where, "points와 linear 중 정확히 하나")
  if (hasP && (typeof t.points !== "number" || !Number.isFinite(t.points))) fail(where, "points는 숫자")
  if (hasL) {
    const l = t.linear!
    const spec = FEATURE_INDEX.get(l.f)
    if (!spec) fail(where, `linear: 없는 특징 키 "${l.f}"`)
    if (spec.type !== "number") fail(where, `linear는 숫자 특징에만 — ${l.f}`)
    for (const k of ["mul", "offset", "min", "max"] as const)
      if (l[k] !== undefined && (typeof l[k] !== "number" || !Number.isFinite(l[k]))) fail(where, `linear.${k}는 숫자`)
    if (typeof l.mul !== "number") fail(where, "linear.mul 필요")
    if (l.min !== undefined && l.max !== undefined && l.min > l.max) fail(where, "linear min > max")
  }
}

export function validateRuleSet(rs: unknown): ArchetypeRuleSet {
  const r = rs as ArchetypeRuleSet
  if (!r || typeof r !== "object") fail("ruleSet", "객체가 아님")
  for (const k of ["id", "version", "source", "disclaimer", "featureVersion", "fallback"] as const)
    if (typeof r[k] !== "string" || !r[k]) fail("ruleSet", `${k} 필요`)
  if (!["example", "draft", "approved"].includes(r.status)) fail("ruleSet", "status는 example|draft|approved")
  if (r.mode !== undefined && r.mode !== "score" && r.mode !== "cascade") fail("ruleSet", "mode는 score|cascade")
  const cascade = r.mode === "cascade"
  if (!/^\d+\.\d+\.\d+$/.test(r.version)) fail("ruleSet", "version은 x.y.z")
  if (r.featureVersion !== FEATURE_VERSION) fail("ruleSet", `featureVersion ${r.featureVersion} ≠ 엔진 ${FEATURE_VERSION}`)
  if (!r.params || typeof r.params.boundaryMargin !== "number" || typeof r.params.minScore !== "number") fail("ruleSet", "params.boundaryMargin·minScore 숫자 필요")
  if (!Array.isArray(r.archetypes) || r.archetypes.length < 2) fail("ruleSet", "archetypes 2개 이상")
  const ids = new Set<string>()
  const pris = new Set<number>()
  r.archetypes.forEach((a, i) => {
    const w = `archetypes[${i}](${a?.id})`
    if (typeof a.id !== "string" || !ID_RE.test(a.id)) fail(w, "id는 영문 소문자·숫자·하이픈")
    if (ids.has(a.id)) fail(w, "id 중복")
    ids.add(a.id)
    if (typeof a.name !== "string" || !a.name) fail(w, "name 필요")
    if (!CATEGORIES.has(a.category)) fail(w, `category 오류 ${a.category}`)
    if (!Number.isInteger(a.priority)) fail(w, "priority는 정수")
    if (pris.has(a.priority)) fail(w, `priority ${a.priority} 중복 — 동점 처리가 모호해짐`)
    pris.add(a.priority)
    if (a.require !== undefined) validateCondition(a.require, `${w}.require`)
    if (a.exclude !== undefined) validateCondition(a.exclude, `${w}.exclude`)
    if (cascade) {
      if (a.require === undefined) fail(w, "cascade 모드는 관문 조건(require) 필수")
      if (a.terms === undefined) a.terms = []
      if (!Array.isArray(a.terms)) fail(w, "terms는 배열")
    } else if (!Array.isArray(a.terms) || a.terms.length === 0) fail(w, "terms 1개 이상")
    for (const k of ["ruleId", "gateLabel"] as const) if (a[k] !== undefined && (typeof a[k] !== "string" || !a[k])) fail(w, `${k}는 비지 않은 문자열`)
    if (a.expectedShare !== undefined) {
      const e = a.expectedShare
      if (!Array.isArray(e) || e.length !== 2 || !e.every((x) => typeof x === "number" && x >= 0 && x <= 1) || e[0] > e[1]) fail(w, "expectedShare는 [하한, 상한] (0~1)")
    }
    const tids = new Set<string>()
    a.terms.forEach((t, j) => {
      validateTerm(t, `${w}.terms[${j}]`)
      if (tids.has(t.id)) fail(`${w}.terms[${j}]`, `항목 id 중복 ${t.id}`)
      tids.add(t.id)
    })
  })
  if (!ids.has(r.fallback)) fail("ruleSet", `fallback "${r.fallback}"가 archetypes에 없음`)
  return r
}

/** 키 정렬 JSON(배열 순서는 유지) — 해시용 */
export function canonicalJson(x: unknown): string {
  if (x === null || typeof x !== "object") return JSON.stringify(x)
  if (Array.isArray(x)) return `[${x.map(canonicalJson).join(",")}]`
  const o = x as Record<string, unknown>
  return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(",")}}`
}

export function ruleSetHash(rs: ArchetypeRuleSet): string {
  return "sha256:" + createHash("sha256").update(canonicalJson(rs)).digest("hex").slice(0, 16)
}

export function loadRuleSet(file: string): ArchetypeRuleSet {
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(file, "utf8"))
  } catch (e) {
    throw new RuleSetError(`${file}: JSON 읽기 실패 — ${(e as Error).message}`)
  }
  return validateRuleSet(raw)
}
