// 발현 엔진 표(데이터) 읽기·검증·해시. 표 원본: content/expression/dimensions.json, content/expression/mbti-bridge.json
// 표를 고쳐도 엔진 코드는 바뀌지 않는다: "어떤 차원이 어떤 판정 규칙·사실·MBTI 축을 쓰는지, 문턱값"은 표, "규칙 id → 판정 함수"는 chart-rules.ts.
// 잘못된 표(없는 규칙 id·없는 설문 값·금지 표현·T/F 대응 등)는 조용히 넘기지 않고 ExpressionTableError로 멈춘다.
import RAW_DIMENSIONS from "../../../../content/expression/dimensions.json"
import RAW_BRIDGE from "../../../../content/expression/mbti-bridge.json"
import { ARCHETYPE_ID_LIST, archetypeCanonicalJson } from "../../archetype"
import { getQuestion } from "../survey"
import { ALL_TEN_GODS, CLARITY_FLAGS, GROUP_CODES, LEVEL_RULE_IDS, MOD_IDS } from "./chart-rules"
import type {
  DimensionRow, DimensionTable, ExpressionStatus, FluxParams, GroupRuleParams, MbtiAxis, MbtiBridge, OutwardParams, PotentialLevel,
  TenGodSetParams,
} from "./types"

export class ExpressionTableError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = "ExpressionTableError"
  }
}

/**
 * 데이터·출력 어디에도 나오면 안 되는 표현(계약 §7-7, 연구소장 §6.3). 사주·MBTI 관계를 검증된 사실처럼 말하거나 서로 맞히는 문구.
 * 표 검증·시험·(이후) 문안 검증기가 같은 목록을 쓰도록 내보낸다.
 */
export const EXPRESSION_FORBIDDEN_PHRASES: readonly string[] = Object.freeze([
  "과학적으로 입증", "과학적으로 증명", "과학적으로 검증", "검증된 상관", "입증된 상관", "증명된 상관",
  "통계적으로 입증", "통계적으로 증명", "연구에 따르면", "MBTI가 사주를 바꾼", "MBTI가 사주를 결정", "MBTI가 운을 바꾼",
  "MBTI가 바뀌면 운", "MBTI로 사주를", "사주가 MBTI를 결정", "사주로 MBTI를", "사주는 ENFP", "정확히 일치", "100% 일치",
])

export const MBTI_AXES: readonly MbtiAxis[] = ["EI", "SN", "TF", "JP"]
export const MBTI_POLES: Readonly<Record<MbtiAxis, readonly [string, string]>> = {
  EI: ["E", "I"], SN: ["S", "N"], TF: ["T", "F"], JP: ["J", "P"],
}
/** 총괄실장 결정(2026-11-28): MBTI 반대 극 low 신호는 이 두 경우만(sure:true일 때만) */
export const MBTI_LOW_ALLOWED: readonly string[] = ["EI|I|outward", "JP|P|steadiness"]
/** 총괄실장 결정: T/F 축은 차원 신호로 쓰지 않는다(조언 문체 힌트만) */
export const MBTI_SIGNAL_AXES: readonly MbtiAxis[] = ["EI", "SN", "JP"]

const STATUSES: readonly ExpressionStatus[] = ["expressed", "developed", "dormant", "quiet", "unknown"]
const LEVELS: readonly PotentialLevel[] = ["strong", "moderate", "faint"]
const TABLE_STATUS = ["designed", "provisional", "reviewed", "approved"] as const
const KINDS = ["core", "grain", "aux"] as const

function fail(where: string, msg: string): never {
  throw new ExpressionTableError(`${where}: ${msg}`)
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x)
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x)
const isStr = (x: unknown): x is string => typeof x === "string" && x.length > 0
const isShare = (x: unknown): boolean => isNum(x) && x > 0 && x < 1

/** 표 안의 모든 문자열(키 포함)에서 금지 표현을 찾는다 */
export function findForbiddenPhrases(x: unknown): string[] {
  const hits: string[] = []
  const visit = (v: unknown): void => {
    if (typeof v === "string") {
      for (const p of EXPRESSION_FORBIDDEN_PHRASES) if (v.includes(p) && !hits.includes(p)) hits.push(p)
    } else if (Array.isArray(v)) v.forEach(visit)
    else if (isObj(v)) for (const [k, val] of Object.entries(v)) {
      visit(k)
      visit(val)
    }
  }
  visit(x)
  return hits
}

function checkStatusRecord(where: string, r: unknown): void {
  if (!isObj(r)) fail(where, "객체여야 함")
  for (const s of STATUSES) if (!isNum(r[s])) fail(where, `${s} 숫자 필요`)
}

function checkParams(w: string, d: DimensionRow): void {
  const p = d.params as unknown as Record<string, unknown>
  if (!isObj(p)) fail(w, "params 객체 필요")
  if (d.rule === "exp.lv.group.v1") {
    const q = p as unknown as GroupRuleParams
    if (!(GROUP_CODES as readonly string[]).includes(q.group)) fail(w, `group 오류 ${q.group}(rules 철자 bigyeop·siksang·jaeseong·gwansal·inseong)`)
    for (const k of ["hiddenOnlyModerate", "stemOnlyModerate", "rootedStrong", "rootedStrongWithMonth"] as const) if (!isShare(q[k])) fail(w, `${k}는 0~1 사이 비율`)
    if (!(q.rootedStrong >= q.rootedStrongWithMonth)) fail(w, "rootedStrong ≥ rootedStrongWithMonth 이어야 함")
    if (typeof q.hiddenMonthCanBeStrong !== "boolean") fail(w, "hiddenMonthCanBeStrong 참/거짓 필요")
  } else if (d.rule === "exp.lv.tenGodSet.v1") {
    const q = p as unknown as TenGodSetParams
    if (!Array.isArray(q.tenGods) || q.tenGods.length === 0 || !q.tenGods.every((t) => (ALL_TEN_GODS as readonly string[]).includes(t))) fail(w, "tenGods는 십성 이름 목록")
    if (!isShare(q.strongShare) || !isShare(q.moderateShare) || !(q.strongShare > q.moderateShare)) fail(w, "strongShare > moderateShare (0~1)")
    if (!Array.isArray(q.clarityFlags) || !q.clarityFlags.every((f) => CLARITY_FLAGS.includes(f))) fail(w, "clarityFlags는 규칙 엔진 청탁 표지 이름")
  } else if (d.rule === "exp.lv.flux.v1") {
    const q = p as unknown as FluxParams
    if (!Array.isArray(q.keyPillars) || q.keyPillars.length === 0 || !q.keyPillars.every((k) => k === "month" || k === "day")) fail(w, "keyPillars는 month|day")
    if (!Number.isInteger(q.strongMinMoving) || q.strongMinMoving < 1) fail(w, "strongMinMoving은 1 이상 정수")
  } else if (d.rule === "exp.lv.outward.v1") {
    const q = p as unknown as OutwardParams
    for (const k of ["strongYang", "warmStrongYang", "faintYang", "coldFaintYang"] as const) if (!isShare(q[k])) fail(w, `${k}는 0~1 사이 비율`)
    if (!(q.strongYang >= q.warmStrongYang && q.warmStrongYang > q.coldFaintYang && q.coldFaintYang >= q.faintYang)) fail(w, "strongYang ≥ warmStrongYang > coldFaintYang ≥ faintYang")
  }
}

/** 차원 표 검증 */
export function validateDimensionTable(raw: unknown): DimensionTable {
  if (!isObj(raw)) fail("dimensions", "객체가 아님")
  const t = raw as unknown as DimensionTable
  for (const k of ["id", "version", "source", "note", "basedOn"] as const) if (!isStr(t[k])) fail("dimensions", `${k} 필요`)
  if (!/^\d+\.\d+\.\d+$/.test(t.version)) fail("dimensions", "version은 x.y.z")
  if (!(TABLE_STATUS as readonly string[]).includes(t.status)) fail("dimensions", "status는 designed|provisional|reviewed|approved")
  if (t.claim !== "service-model") fail("dimensions", 'claim은 "service-model"이어야 함')
  if (!["L0", "L1", "L2"].includes(t.evidenceLevel)) fail("dimensions", "evidenceLevel은 L0|L1|L2")
  if (t.hiddenStemTable !== "kr-monthly-30") fail("dimensions", "hiddenStemTable은 kr-monthly-30 고정(연구소장 §0)")
  if (!isObj(t.levels) || !Array.isArray(t.levels.present) || t.levels.present.length === 0 || !t.levels.present.every((l) => LEVELS.includes(l)))
    fail("dimensions.levels", "present는 strong|moderate 중 하나 이상")
  if (t.levels.present.includes("faint")) fail("dimensions.levels", "faint는 present가 될 수 없음")
  if (!isObj(t.sensitivity) || !Number.isInteger(t.sensitivity.hourStableMin) || t.sensitivity.hourStableMin < 0 || t.sensitivity.hourStableMin > 12)
    fail("dimensions.sensitivity", "hourStableMin은 0~12 정수")
  if (t.sensitivity.compareTable !== "cn-lunarjs" && t.sensitivity.compareTable !== "main-only") fail("dimensions.sensitivity", "compareTable은 cn-lunarjs|main-only")
  if (!isObj(t.self)) fail("dimensions.self", "객체 필요")
  for (const k of ["highAt", "lowAt", "unsureFactor", "mbtiOnlyFactor"] as const)
    if (!isNum(t.self[k]) || t.self[k] <= 0) fail("dimensions.self", `${k}는 0보다 큰 숫자`)
  if (t.self.mbtiOnlyFactor >= 1 || t.self.unsureFactor > 1) fail("dimensions.self", "MBTI만일 때 약화 계수는 1 미만(한 단계 낮춤), 확신 없음 계수는 1 이하")
  if (!Array.isArray(t.self.developedEvidence) || t.self.developedEvidence.length === 0 || !t.self.developedEvidence.every((e) => e === "trait" || e === "situation"))
    fail("dimensions.self", "developedEvidence는 trait|situation 중 하나 이상")
  const sit = t.self.situation
  if (!isObj(sit) || sit.from !== "lived-link" || !Array.isArray(sit.questions) || sit.direction !== "high" || !isNum(sit.weight) || sit.weight <= 0)
    fail("dimensions.self.situation", "from lived-link, questions 배열, direction high, weight > 0")
  for (const q of sit.questions) if (!getQuestion(q)) fail("dimensions.self.situation", `없는 설문 문항 ${q}`)
  if (sit.questions.includes("mbti")) fail("dimensions.self.situation", "mbti는 상황 사실이 아님")

  if (!Array.isArray(t.dimensions) || t.dimensions.length === 0) fail("dimensions", "dimensions 배열 필요")
  const ids = new Set<string>()
  const groupsSeen = new Set<string>()
  t.dimensions.forEach((d, i) => {
    const w = `dimensions[${i}](${d?.id})`
    if (!isObj(d)) fail(w, "객체 필요")
    if (!isStr(d.id) || !/^[a-z][a-zA-Z]*$/.test(d.id)) fail(w, "id는 영문 소문자로 시작")
    if (ids.has(d.id)) fail(w, "id 중복")
    ids.add(d.id)
    if (!isStr(d.label)) fail(w, "label 필요")
    if (!(KINDS as readonly string[]).includes(d.kind)) fail(w, "kind는 core|grain|aux")
    if (!(LEVEL_RULE_IDS as readonly string[]).includes(d.rule)) fail(w, `없는 판정 규칙 id "${d.rule}"`)
    checkParams(w, d)
    if (d.rule === "exp.lv.group.v1") {
      const g = (d.params as GroupRuleParams).group
      if (groupsSeen.has(g)) fail(w, `묶음 ${g}가 두 차원에 있음`)
      groupsSeen.add(g)
    }
    if (!Array.isArray(d.mods) || !d.mods.every((m) => MOD_IDS.includes(m))) fail(w, "mods에 없는 보정 규칙")
    if (d.mods.includes("exp.mod.drive.v1") && d.rule !== "exp.lv.group.v1") fail(w, "drive 보정은 묶음 규칙 차원에만")
    if (!Array.isArray(d.notes) || !d.notes.every((n) => n === "load" || n === "surplus")) fail(w, "notes는 load|surplus")
    if (!Array.isArray(d.facts)) fail(w, "facts 배열 필요(비어도 됨)")
    const keys = new Set<string>()
    d.facts.forEach((f, j) => {
      const fw = `${w}.facts[${j}]`
      if (!isObj(f) || !isStr(f.key)) fail(fw, "key 필요")
      if (/^mbti:/i.test(f.key)) fail(fw, "MBTI는 사실 연결이 아니라 mbti-bridge.json으로만 잇는다")
      const m = /^([A-Za-z]+):([a-z_]+)$/.exec(f.key)
      if (!m) fail(fw, `key 형식은 "questionId:value" — ${f.key}`)
      if (sit.questions.includes(m[1])) fail(fw, `${m[1]}는 상황 사실 — lived-link에서 읽으므로 facts에 두지 않음`)
      const q = getQuestion(m[1])
      if (!q) fail(fw, `없는 설문 문항 ${m[1]}`)
      if (!q.options.some((o) => o.value === m[2])) fail(fw, `문항 ${m[1]}에 없는 선택지 ${m[2]}`)
      if (keys.has(f.key)) fail(fw, "key 중복")
      keys.add(f.key)
      if (f.direction !== "high" && f.direction !== "low") fail(fw, "direction은 high|low")
      if (!isNum(f.weight) || f.weight <= 0) fail(fw, "weight는 0보다 큰 숫자")
      if (f.evidence !== "trait") fail(fw, "facts의 evidence는 trait(기질 답)")
    })
  })
  for (const g of GROUP_CODES) if (!groupsSeen.has(g)) fail("dimensions", `묶음 ${g}를 쓰는 핵심 차원이 없음`)

  if (!isObj(t.luck) || !isObj(t.luck.groupMap) || !isObj(t.luck.flux)) fail("dimensions.luck", "groupMap·flux 필요")
  for (const g of GROUP_CODES) {
    const r = t.luck.groupMap[g]
    if (!isObj(r) || !ids.has(r.activate) || !ids.has(r.feed) || !ids.has(r.press)) fail("dimensions.luck.groupMap", `${g}: activate·feed·press 차원 id 필요`)
  }
  if (!ids.has(t.luck.flux.dimensionId) || !Array.isArray(t.luck.flux.types) || !Array.isArray(t.luck.flux.natalPillars)) fail("dimensions.luck.flux", "dimensionId·types·natalPillars 필요")

  if (!isObj(t.strategies) || !isObj(t.strategies.matrix) || !isObj(t.strategies.tone) || !isObj(t.strategies.catalog)) fail("dimensions.strategies", "matrix·tone·catalog 필요")
  const stOk = (x: unknown): boolean => isStr(x) && /^exp\.st\.[a-z]+$/.test(x) && isStr(t.strategies.catalog[x])
  for (const s of STATUSES) {
    const row = t.strategies.matrix[s]
    if (!isObj(row) || !stOk(row.activate) || !stOk(row.press)) fail("dimensions.strategies", `matrix.${s}.activate·press는 catalog에 있는 exp.st.* id`)
  }
  if (!stOk(t.strategies.tone.support) || !stOk(t.strategies.tone.load)) fail("dimensions.strategies", "tone.support·load는 catalog에 있는 exp.st.* id")

  if (!isObj(t.gaeunPriority)) fail("dimensions.gaeunPriority", "객체 필요")
  checkStatusRecord("dimensions.gaeunPriority.fill", t.gaeunPriority.fill)
  checkStatusRecord("dimensions.gaeunPriority.ease", t.gaeunPriority.ease)
  if (!isNum(t.gaeunPriority.other) || !isNum(t.gaeunPriority.changeWishBoost)) fail("dimensions.gaeunPriority", "other·changeWishBoost 숫자 필요")

  if (!isObj(t.changeWish)) fail("dimensions.changeWish", "객체 필요")
  const cw = getQuestion("changeWish")
  for (const [k, dims] of Object.entries(t.changeWish)) {
    if (!cw?.options.some((o) => o.value === k)) fail("dimensions.changeWish", `changeWish 문항에 없는 값 ${k}`)
    if (!Array.isArray(dims) || !dims.every((x) => ids.has(x))) fail("dimensions.changeWish", `${k}: 없는 차원 id`)
  }
  if (!isObj(t.archetypeLinks)) fail("dimensions.archetypeLinks", "객체 필요")
  for (const a of ARCHETYPE_ID_LIST) if (!Array.isArray(t.archetypeLinks[a])) fail("dimensions.archetypeLinks", `원형 ${a} 항목 필요(비어도 됨)`)
  for (const [k, dims] of Object.entries(t.archetypeLinks)) {
    if (!(ARCHETYPE_ID_LIST as readonly string[]).includes(k)) fail("dimensions.archetypeLinks", `없는 원형 id ${k}`)
    if (!dims.every((x) => ids.has(x))) fail("dimensions.archetypeLinks", `${k}: 없는 차원 id`)
  }

  const bad = findForbiddenPhrases(raw)
  if (bad.length) fail("dimensions", `금지 표현 ${bad.join(", ")}`)
  return t
}

/** MBTI 대응표 검증. claim "service-model"(표 전체·행마다) 필수, T/F 신호 금지, low 신호는 허용된 두 경우·sure 전용만 */
export function validateMbtiBridge(raw: unknown, dims: DimensionTable): MbtiBridge {
  if (!isObj(raw)) fail("mbtiBridge", "객체가 아님")
  const b = raw as unknown as MbtiBridge
  for (const k of ["id", "version", "note"] as const) if (!isStr(b[k])) fail("mbtiBridge", `${k} 필요`)
  if (!/^\d+\.\d+\.\d+$/.test(b.version)) fail("mbtiBridge", "version은 x.y.z")
  if (!(TABLE_STATUS as readonly string[]).includes(b.status)) fail("mbtiBridge", "status는 designed|provisional|reviewed|approved")
  if (b.claim !== "service-model") fail("mbtiBridge", 'claim은 "service-model"이어야 함(가설 표 표시 필수)')
  if (!Array.isArray(b.axes) || b.axes.length !== 4) fail("mbtiBridge", "axes는 4개")
  MBTI_AXES.forEach((ax, i) => {
    const a = b.axes[i]
    if (!isObj(a) || a.axis !== ax || !Array.isArray(a.poles) || a.poles.join("") !== MBTI_POLES[ax].join(""))
      fail(`mbtiBridge.axes[${i}]`, `${ax} 축과 극 ${MBTI_POLES[ax].join("/")} 순서여야 함`)
  })
  const dimIds = new Set(dims.dimensions.map((d) => d.id))
  if (!Array.isArray(b.links)) fail("mbtiBridge", "links 배열 필요")
  const seen = new Set<string>()
  b.links.forEach((l, i) => {
    const w = `mbtiBridge.links[${i}]`
    if (!isObj(l) || !dimIds.has(l.dimensionId)) fail(w, `없는 차원 id ${(l as { dimensionId?: unknown })?.dimensionId}`)
    if (l.claim !== "service-model") fail(w, 'claim "service-model" 필요(행마다)')
    if (!MBTI_AXES.includes(l.axis)) fail(w, `없는 축 ${l.axis}`)
    if (!MBTI_SIGNAL_AXES.includes(l.axis)) fail(w, `${l.axis} 축은 차원 신호로 쓰지 않음(조언 문체 힌트만)`)
    if (!MBTI_POLES[l.axis].includes(l.pole)) fail(w, `${l.axis} 축에 없는 극 ${l.pole}`)
    if (l.direction !== "high" && l.direction !== "low") fail(w, "direction은 high|low")
    if (l.direction === "low") {
      if (!MBTI_LOW_ALLOWED.includes(`${l.axis}|${l.pole}|${l.dimensionId}`)) fail(w, "low 신호는 I→outward, P→steadiness만")
      if (l.sureOnly !== true) fail(w, "low 신호는 sureOnly: true")
    }
    if (typeof l.sureOnly !== "boolean") fail(w, "sureOnly 참/거짓 필요")
    if (!["A", "A-", "B", "B-"].includes(l.grade)) fail(w, "grade는 A|A-|B|B-")
    if (!isNum(l.weight) || l.weight <= 0) fail(w, "weight는 0보다 큰 숫자")
    const k = `${l.dimensionId}|${l.axis}|${l.pole}`
    if (seen.has(k)) fail(w, "같은 차원·축·극 중복")
    seen.add(k)
  })
  if (!Array.isArray(b.styleHints)) fail("mbtiBridge", "styleHints 배열 필요(비어도 됨)")
  b.styleHints.forEach((h, i) => {
    if (!isObj(h) || !MBTI_AXES.includes(h.axis) || !MBTI_POLES[h.axis]?.includes(h.pole) || !isStr(h.hint) || !/^style\.[a-zA-Z]+$/.test(h.hint))
      fail(`mbtiBridge.styleHints[${i}]`, "axis·pole·hint(style.*) 필요")
  })
  const bad = findForbiddenPhrases(raw)
  if (bad.length) fail("mbtiBridge", `금지 표현 ${bad.join(", ")}`)
  return b
}

// ─────────────────────────────────────────── 해시(엔진 안에서 node:crypto를 쓰지 않는다)

function fnv1a32(s: string, seed: number): string {
  let h = seed >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, "0")
}

/** 표 해시: 키 정렬 JSON에 FNV-1a 32비트를 두 시드로 적용(16자리). 보안용이 아니라 "어느 표로 판정했나" 식별용 */
export function expressionTablesHash(dims: unknown, bridge: unknown): string {
  const s = archetypeCanonicalJson({ dimensions: dims, mbtiBridge: bridge })
  return `fnv1a:${fnv1a32(s, 0x811c9dc5)}${fnv1a32(s, 0x01234567)}`
}

// ─────────────────────────────────────────── 동봉 표

export interface ExpressionTables {
  dims: DimensionTable
  bridge: MbtiBridge
  hash: string
}

let cachedTables: ExpressionTables | null = null

/** 동봉 표(검증 1회 후 고정). 반환값을 고치지 말 것 */
export function expressionTables(): ExpressionTables {
  if (!cachedTables) cachedTables = makeExpressionTables(RAW_DIMENSIONS as unknown, RAW_BRIDGE as unknown)
  return cachedTables
}

/** 시험·연구용: 다른 표로 엔진을 돌릴 때(검증 포함) */
export function makeExpressionTables(rawDims: unknown, rawBridge: unknown): ExpressionTables {
  const dims = validateDimensionTable(rawDims)
  const bridge = validateMbtiBridge(rawBridge, dims)
  return { dims, bridge, hash: expressionTablesHash(rawDims, rawBridge) }
}
