// ② 자기보고(MBTI 4축 + 설문 사실) 입력 어댑터와 차원별 자기보고 신호. 순수 함수.
// 원칙(계약 §6, 연구소장 expression-dimensions@0.2.0 §3.7.5·§6.2):
//  - MBTI는 "지금 스스로 그렇게 느낀다"는 자기보고로만 쓴다. 원국·운 계산에는 들어가지 않는다(이 파일은 RuleAnalysis를 받지도 않는다).
//  - 축마다 모름·건너뜀을 허용한다. 모르는 축은 배열에 넣지 않는다.
//  - MBTI 신호는 세 줄뿐(E→outward, J→grain 고른 쪽, P→grain 센 쪽), 확신(sure)일 때만. 확신 없는 답은 문체 힌트에만 쓴다.
//  - MBTI는 low를 만들지 않는다. 사실 없이 MBTI만 있으면 "확신 + 신호 줄 → 그 방향"(명시 규칙, mbtiOnly) — 문턱 계산에 기대지 않는다.
//  - 사실은 바꾸거나 새로 만들지 않는다. id로만 가리킨다.
//  - 사실은 두 종류: 기질 답(trait — selfStrength·workStyle·selfWeakness:saving, 표 facts)과
//    상황 답(situation — 직업 상태·최근 변화·지난 일, lived-link.ts 대응을 철자 변환표로 그대로 읽음). developed는 기질 답이 있어야 한다.
//  - 모양이 틀린 자기보고(facts가 배열이 아님, 사실 id 형식 오류, MBTI가 축 배열이 아님 등)는 EngineInputError로 멈춘다.
// 기존 설문 survey.ts의 mbti 문항은 16유형 단일 선택(값 "INTJ" 등, 축별 모름 없음)이다. 여기서 4축으로 변환한다(별도 어댑터).
import { linkFactToChart } from "../lived-link"
import type { UserFact } from "../types"
import { EngineInputError } from "../../types"
import { MBTI_AXES, MBTI_POLES } from "./tables"
import type {
  DimensionRow, DimensionTable, FactEvidence, GrainLean, GroupRuleParams, MbtiAxis, MbtiAxisReport, MbtiBridge, SelfLean, SelfReport,
  SelfSignal, TenGodGroupCode,
} from "./types"

/** lived-link.ts 철자 → rules 철자(연구소장 §1.2). lived-link 파일은 고치지 않는다 */
export const LIVED_LINK_GROUP: Readonly<Record<string, TenGodGroupCode>> = {
  bigeop: "bigyeop", siksang: "siksang", jaeseong: "jaeseong", gwanseong: "gwansal", inseong: "inseong",
}

/** 사용자 사실 id 형식(설문 경로 answersToUserFacts가 만드는 코드값: "workStyle", "selfStrength:planning", "life_event:marriage") */
export const USER_FACT_ID_PATTERN = /^[A-Za-z_]+(:[a-z_]+)?$/

// ─────────────────────────────────────────── MBTI 입력

/**
 * 축 하나의 답: 대문자 극 글자("E") = 그쪽(확신), 극 + "?"("E?") 또는 소문자("e") = 그쪽에 가까운 것 같다(확신 없음),
 * "unknown"·"skip"·""·undefined 등 = 모름/건너뜀. 문자열·객체·축 배열 어느 경로로 넣어도 같은 결과다.
 */
export type MbtiAxisChoice = string | undefined

/** 4축 자기선택 입력(화면용). 축마다 모름 허용 */
export type MbtiAxesInput = Partial<Record<MbtiAxis, MbtiAxisChoice>>

export interface MbtiParseResult {
  axes: MbtiAxisReport[]
  /** 받지 못한 값(원문은 담지 않는다 — 축 이름과 사유만) */
  issues: { axis: MbtiAxis | "*"; code: "invalid_pole" | "malformed" }[]
}

const UNKNOWN = new Set(["", "unknown", "skip", "x", "X", "?", "-", "_"])

/** 극 글자 읽기(모든 입력 경로 공통). null = 모름, "invalid" = 그 축에 없는 극 */
function readPole(axis: MbtiAxis, raw: string): { pole: string; sure: boolean } | null | "invalid" {
  let v = raw.trim()
  if (UNKNOWN.has(v)) return null
  let unsure = false
  if (v.endsWith("?")) {
    unsure = true
    v = v.slice(0, -1).trim()
  }
  if (v !== v.toUpperCase()) unsure = true // 소문자 = 확신 없음(문자열 "eNfP"와 객체 { EI: "e" }가 같은 결과)
  const pole = v.toUpperCase()
  if (!MBTI_POLES[axis].includes(pole)) return "invalid"
  return { pole, sure: !unsure }
}

function parseChoice(axis: MbtiAxis, raw: unknown, issues: MbtiParseResult["issues"]): MbtiAxisReport | null {
  if (raw === undefined || raw === null) return null
  if (typeof raw !== "string") {
    issues.push({ axis, code: "malformed" })
    return null
  }
  const r = readPole(axis, raw)
  if (r === null) return null
  if (r === "invalid") {
    issues.push({ axis, code: "invalid_pole" })
    return null
  }
  return { axis, pole: r.pole, sure: r.sure }
}

/**
 * MBTI 자기선택 입력 → 축 목록(EI·SN·TF·JP 순, 모르는 축 제외).
 * - 문자열 4글자: 자리마다 극 글자 또는 모름 표시(x·X·?·-·_). 소문자는 "확신 없음". 예: "INxJ", "eNfP"
 * - 객체: { EI: "E", SN: "unknown", TF: "F?", JP: "p" } — "F?"·"p"는 확신 없음
 * - undefined·null: 축 없음(MBTI를 모름)
 */
export function parseMbtiInput(input: unknown): MbtiParseResult {
  const issues: MbtiParseResult["issues"] = []
  const axes: MbtiAxisReport[] = []
  if (input === undefined || input === null) return { axes, issues }
  if (typeof input === "string") {
    // "INTJ-A"·"INTJ-T"처럼 붙는 꼬리표는 떼고 4축만 본다
    const s = input.trim().replace(/-[AaTt]$/, "")
    if (s.length !== 4) return { axes, issues: [{ axis: "*", code: "malformed" }] }
    MBTI_AXES.forEach((axis, i) => {
      const r = parseChoice(axis, s[i], issues)
      if (r) axes.push(r)
    })
    return { axes, issues }
  }
  if (typeof input !== "object" || Array.isArray(input)) return { axes, issues: [{ axis: "*", code: "malformed" }] }
  const o = input as Record<string, unknown>
  for (const axis of MBTI_AXES) {
    const r = parseChoice(axis, o[axis], issues)
    if (r) axes.push(r)
  }
  return { axes, issues }
}

/** 기존 설문 mbti 문항 사실(값 "INTJ" 등 16유형) → 4축(모두 sure). 없으면 undefined */
export function mbtiFromUserFacts(facts: readonly UserFact[]): MbtiAxisReport[] | undefined {
  const f = facts.find((x) => x.source === "user" && x.questionId === "mbti")
  if (!f || !/^[EI][SN][TF][JP]$/.test(f.value)) return undefined
  return parseMbtiInput(f.value).axes
}

/**
 * 설문 사실 → SelfReport. 4축 입력(mbtiAxes)이 따로 있으면 그것을 쓰고(축별 모름 반영), 없으면 설문 mbti 문항 값을 쓴다.
 * 사실 배열은 그대로 넘긴다(복사만, 내용 변경 없음).
 */
export function selfReportFromUserFacts(facts: readonly UserFact[], mbtiAxes?: unknown): SelfReport {
  const fromAxes = mbtiAxes !== undefined ? parseMbtiInput(mbtiAxes).axes : undefined
  const mbti = fromAxes ?? mbtiFromUserFacts(facts)
  return { ...(mbti && mbti.length ? { mbti } : {}), facts: facts.map((f) => ({ ...f, ...(f.period ? { period: { ...f.period } } : {}) })) }
}

// ─────────────────────────────────────────── 자기보고 정리(모양 검사)

/**
 * 정리된 자기보고: 사용자 사실(source:"user")만, id 중복 제거, MBTI는 축당 첫 값만.
 * 모양이 틀리면 EngineInputError(원문 값은 메시지에 담지 않는다 — 자리와 사유만).
 */
export function normalizeSelf(self: unknown): { facts: UserFact[]; mbti: MbtiAxisReport[] } {
  if (self === undefined || self === null) return { facts: [], mbti: [] }
  if (typeof self !== "object" || Array.isArray(self)) throw new EngineInputError("self는 { facts, mbti? } 객체여야 함")
  const s = self as { facts?: unknown; mbti?: unknown }
  if (s.facts !== undefined && s.facts !== null && !Array.isArray(s.facts)) throw new EngineInputError("self.facts는 UserFact 배열이어야 함")
  if (s.mbti !== undefined && s.mbti !== null && !Array.isArray(s.mbti))
    throw new EngineInputError("self.mbti는 축 배열이어야 함(\"ESTJ\" 같은 문자열은 parseMbtiInput으로 바꿔 넣는다)")

  const facts: UserFact[] = []
  const seen = new Set<string>()
  const rawFacts: unknown[] = Array.isArray(s.facts) ? s.facts : []
  const rawMbti: unknown[] = Array.isArray(s.mbti) ? s.mbti : []
  rawFacts.forEach((f, i) => {
    if (!f || typeof f !== "object" || Array.isArray(f)) throw new EngineInputError(`self.facts[${i}]는 UserFact 객체여야 함`)
    const x = f as Partial<UserFact>
    if (x.source !== "user") return // 사용자가 직접 말한 것이 아니면 세지 않는다(사주 추정 등)
    if (typeof x.id !== "string" || !USER_FACT_ID_PATTERN.test(x.id))
      throw new EngineInputError(`self.facts[${i}].id 형식 오류 — 설문 코드값("questionId" 또는 "questionId:value")만 받음`)
    if (typeof x.questionId !== "string" || typeof x.value !== "string") throw new EngineInputError(`self.facts[${i}]: questionId·value는 문자열`)
    if (seen.has(x.id)) return
    seen.add(x.id)
    facts.push(f as UserFact)
  })

  const mbti: MbtiAxisReport[] = []
  rawMbti.forEach((m, i) => {
    if (!m || typeof m !== "object" || Array.isArray(m)) throw new EngineInputError(`self.mbti[${i}]는 { axis, pole, sure } 객체여야 함`)
    const x = m as { axis?: unknown; pole?: unknown; sure?: unknown }
    if (typeof x.axis !== "string" || !(MBTI_AXES as readonly string[]).includes(x.axis)) throw new EngineInputError(`self.mbti[${i}].axis는 EI|SN|TF|JP`)
    const axis = x.axis as MbtiAxis
    if (typeof x.pole !== "string") throw new EngineInputError(`self.mbti[${i}].pole은 문자열`)
    if (x.sure !== undefined && typeof x.sure !== "boolean") throw new EngineInputError(`self.mbti[${i}].sure는 참/거짓`)
    const r = readPole(axis, x.pole)
    if (r === "invalid") throw new EngineInputError(`self.mbti[${i}]: ${axis} 축에 없는 극`)
    if (r === null || mbti.some((y) => y.axis === axis)) return // 모름 표시 · 같은 축 두 번째 값
    mbti.push({ axis, pole: r.pole, sure: r.sure && x.sure !== false })
  })
  mbti.sort((p, q) => MBTI_AXES.indexOf(p.axis) - MBTI_AXES.indexOf(q.axis))
  return { facts, mbti }
}

// ─────────────────────────────────────────── 사실 → 차원

/** 사실 하나가 이 차원을 가리키는 연결(없으면 null). 설문 mbti 문항 사실은 여기서 세지 않는다(MBTI는 축으로만) */
export function factLinkOf(
  f: UserFact,
  d: DimensionRow,
  tables: DimensionTable,
): { direction: DimensionRow["facts"][number]["direction"]; weight: number; evidence: FactEvidence } | null {
  if (f.questionId === "mbti") return null
  const sit = tables.self.situation
  if (sit.questions.includes(f.questionId)) {
    // 상황 답: lived-link.ts 대응(십성 묶음)을 그대로 읽고 철자만 rules 기준으로 바꾼다(핵심 차원만)
    if (d.rule !== "exp.lv.group.v1") return null
    const g = linkFactToChart(f, {}).group
    const code = g ? LIVED_LINK_GROUP[g] : undefined
    if (!code || code !== (d.params as GroupRuleParams).group) return null
    return { direction: sit.direction, weight: sit.weight, evidence: "situation" }
  }
  const link = d.facts.find((l) => l.key === `${f.questionId}:${f.value}`)
  return link ? { direction: link.direction, weight: link.weight, evidence: link.evidence } : null
}

/** MBTI에서 나온 조언 문체 힌트(차원 신호 아님). 확신 없는 답도 쓴다. 축 순서 */
export function styleHintsOf(mbti: readonly MbtiAxisReport[], bridge: MbtiBridge): string[] {
  const out: string[] = []
  for (const m of mbti) for (const h of bridge.styleHints) if (h.axis === m.axis && h.pole === m.pole && !out.includes(h.hint)) out.push(h.hint)
  return out
}

// ─────────────────────────────────────────── 차원별 자기보고 신호

export interface SelfSignalResult {
  signal: SelfSignal
  from: string[]
  mbtiOnly: boolean
  /** grain 전용: 자기보고가 기운 쪽(없으면 undefined) */
  lean?: SelfLean
  /** grain 전용: 원국과 반대 결을 MBTI(사실 뒷받침 없이)로만 느낌 → signal none + chart-vs-self(§3.7.5) */
  oppositeWithoutFacts: boolean
  /** 최종 방향과 같은 쪽 기질 답(trait)이 있고 사실 점수도 그쪽 — developed 판정에 쓸 수 있음 */
  developedEvidence: boolean
  /** 최종 방향과 같은 쪽 사실이 상황 답뿐 */
  situationOnly: boolean
  /** 사실끼리 또는 사실과 MBTI가 반대 방향 */
  selfConflict: null | "facts-disagree" | "mbti-vs-facts"
  /** 사실 점수·MBTI 점수(내부. grain은 steady +, edge −) */
  factScore: number
  mbtiScore: number
}

const round6 = (x: number): number => Math.round(x * 1e6) / 1e6
const sign = (x: number): -1 | 0 | 1 => (x > 0 ? 1 : x < 0 ? -1 : 0)
/** 방향 → 부호(high·steady +1, low·edge −1) */
const sideOf = (dir: string): 1 | -1 => (dir === "high" || dir === "steady" ? 1 : -1)

/**
 * 차원 하나의 자기보고 신호.
 * - 사실 점수 = 기질 답(표 facts) + 상황 답(lived-link)의 (방향 ±1 × 가중) 합. grain은 steady +, edge −.
 * - MBTI 점수 = 대응표 links 중 확신(sure) 답만의 (방향 ±1 × 가중) 합. 확신 없는 답은 0(힌트만).
 * - 사실이 하나라도 닿으면: MBTI와 방향이 반대면 사실 쪽만 쓴다(경험 정보 우선, self-vs-self). 아니면 합 → 문턱 ±highAt/lowAt.
 * - 사실이 하나도 닿지 않고 확신 MBTI 신호 줄이 있으면: 그 방향(명시 규칙, mbtiOnly). MBTI 줄은 low가 없으므로 MBTI만으로 low는 안 나온다.
 * - grain(§3.7.5): 위 방향을 selfLean으로 읽은 뒤 원국 lean에 대한 상대 신호로 바꾼다 —
 *   같은 쪽·원국 balanced → high, 반대쪽 → 사실 점수가 그쪽이면 low, 아니면(MBTI만) none + oppositeWithoutFacts.
 * - low는 사실 점수 자체가 그쪽일 때만 낸다(사실이 상쇄되고 MBTI가 방향을 정한 경우 low 금지 — "MBTI는 low를 만들지 않는다").
 * - developed 근거: 최종 방향과 같은 쪽 기질 답(developedEvidence 종류) 1개 이상 + 사실 점수 부호가 같은 쪽.
 */
export function selfSignalOf(
  d: DimensionRow,
  norm: { facts: UserFact[]; mbti: MbtiAxisReport[] },
  tables: DimensionTable,
  bridge: MbtiBridge,
  chartLean?: GrainLean,
): SelfSignalResult {
  const cfg = tables.self
  const isGrain = d.rule === "exp.lv.grain.v1"
  let factScore = 0
  let factPos = 0
  let factNeg = 0
  const trait = { pos: false, neg: false }
  const situation = { pos: false, neg: false }
  const factFrom: string[] = []
  for (const f of norm.facts) {
    const link = factLinkOf(f, d, tables)
    if (!link) continue
    const s = sideOf(link.direction)
    factScore += s * link.weight
    if (s > 0) factPos += 1
    else factNeg += 1
    const bucket = cfg.developedEvidence.includes(link.evidence) ? trait : situation
    if (s > 0) bucket.pos = true
    else bucket.neg = true
    factFrom.push(`fact:${f.id}`)
  }
  factScore = round6(factScore)

  let mbtiScore = 0
  const mbtiFrom: string[] = []
  for (const m of norm.mbti) {
    if (!m.sure) continue // 확신 없는 답은 신호가 아니라 힌트만(§6.2 규칙 2) — 표의 sureOnly와 별개로 코드에서도 막는다
    for (const l of bridge.links) {
      if (l.dimensionId !== d.id || l.axis !== m.axis || l.pole !== m.pole) continue
      mbtiScore += sideOf(l.direction) * l.weight
      if (!mbtiFrom.includes(`mbti:${m.axis}`)) mbtiFrom.push(`mbti:${m.axis}`)
    }
  }
  mbtiScore = round6(mbtiScore)

  const hasFacts = factFrom.length > 0
  const hasMbti = mbtiFrom.length > 0
  let selfConflict: SelfSignalResult["selfConflict"] = null
  let dir: -1 | 0 | 1 = 0
  if (hasFacts) {
    if (factPos > 0 && factNeg > 0) selfConflict = "facts-disagree"
    let s: number
    if (sign(mbtiScore) !== 0 && sign(factScore) !== 0 && sign(mbtiScore) !== sign(factScore)) {
      selfConflict = selfConflict ?? "mbti-vs-facts"
      s = factScore
    } else s = round6(factScore + mbtiScore)
    dir = s >= cfg.highAt ? 1 : s <= -cfg.lowAt ? -1 : 0
  } else if (hasMbti) {
    dir = sign(mbtiScore) // 명시 규칙: 사실 없음 + 확신 + 신호 줄 → 그 방향
  }
  const factsBacked = dir !== 0 && sign(factScore) === dir

  let signal: SelfSignal
  let lean: SelfLean | undefined
  let oppositeWithoutFacts = false
  if (!isGrain) {
    signal = dir > 0 ? "high" : dir < 0 && factsBacked ? "low" : "none"
  } else {
    lean = dir > 0 ? "steady" : dir < 0 ? "edge" : undefined
    if (!lean) signal = "none"
    else if (!chartLean || chartLean === "balanced" || chartLean === lean) signal = "high"
    else if (factsBacked) signal = "low"
    else {
      signal = "none"
      oppositeWithoutFacts = true
    }
  }
  const traitSame = dir > 0 ? trait.pos : dir < 0 ? trait.neg : false
  const situationSame = dir > 0 ? situation.pos : dir < 0 ? situation.neg : false
  const developedEvidence = factsBacked && traitSame
  return {
    signal,
    from: [...factFrom, ...mbtiFrom],
    mbtiOnly: !hasFacts && hasMbti,
    ...(lean ? { lean } : {}),
    oppositeWithoutFacts,
    developedEvidence,
    situationOnly: !developedEvidence && situationSame && !traitSame,
    selfConflict,
    factScore,
    mbtiScore,
  }
}
