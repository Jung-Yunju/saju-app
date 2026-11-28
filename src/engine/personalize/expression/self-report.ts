// ② 자기보고(MBTI 4축 + 설문 사실) 입력 어댑터와 차원별 자기보고 신호. 순수 함수.
// 원칙(계약 §6):
//  - MBTI는 "지금 스스로 그렇게 느낀다"는 자기보고로만 쓴다. 원국·운 계산에는 들어가지 않는다(이 파일은 RuleAnalysis를 받지도 않는다).
//  - 축마다 모름·건너뜀을 허용한다. 모르는 축은 배열에 넣지 않는다.
//  - 사실(UserFact) 없이 MBTI만 있으면 신호를 한 단계 약하게(mbtiOnlyFactor) 쓴다.
//  - 사실은 바꾸거나 새로 만들지 않는다. id로만 가리킨다.
//  - 사실은 두 종류: 기질 답(trait — selfStrength·workStyle·selfWeakness:saving, 표 facts)과
//    상황 답(situation — 직업 상태·최근 변화·지난 일, lived-link.ts 대응을 철자 변환표로 그대로 읽음). developed는 기질 답이 있어야 한다.
// 기존 설문 survey.ts의 mbti 문항은 16유형 단일 선택(값 "INTJ" 등, 축별 모름 없음)이다. 여기서 4축으로 변환한다(별도 어댑터).
import { linkFactToChart } from "../lived-link"
import type { UserFact } from "../types"
import { MBTI_AXES, MBTI_POLES } from "./tables"
import type {
  DimensionRow, DimensionTable, FactEvidence, GroupRuleParams, MbtiAxis, MbtiAxisReport, MbtiBridge, SelfReport, SelfSignal, TenGodGroupCode,
} from "./types"

/** lived-link.ts 철자 → rules 철자(연구소장 §1.2). lived-link 파일은 고치지 않는다 */
export const LIVED_LINK_GROUP: Readonly<Record<string, TenGodGroupCode>> = {
  bigeop: "bigyeop", siksang: "siksang", jaeseong: "jaeseong", gwanseong: "gwansal", inseong: "inseong",
}

// ─────────────────────────────────────────── MBTI 입력

/**
 * 축 하나의 답: 극 글자("E") = 그쪽, 극 + "?"("E?") = 그쪽에 가까운 것 같다(확신 없음),
 * "unknown"·"skip"·""·undefined = 모름/건너뜀.
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

function parseChoice(axis: MbtiAxis, raw: unknown, issues: MbtiParseResult["issues"]): MbtiAxisReport | null {
  if (raw === undefined || raw === null) return null
  if (typeof raw !== "string") {
    issues.push({ axis, code: "malformed" })
    return null
  }
  const v = raw.trim()
  if (UNKNOWN.has(v)) return null
  const unsure = v.endsWith("?")
  const pole = (unsure ? v.slice(0, -1) : v).toUpperCase()
  if (!MBTI_POLES[axis].includes(pole)) {
    issues.push({ axis, code: "invalid_pole" })
    return null
  }
  return { axis, pole, sure: !unsure }
}

/**
 * MBTI 자기선택 입력 → 축 목록(EI·SN·TF·JP 순, 모르는 축 제외).
 * - 문자열 4글자: 자리마다 극 글자 또는 모름 표시(x·X·?·-·_). 소문자는 "확신 없음". 예: "INxJ", "eNfP"
 * - 객체: { EI: "E", SN: "unknown", TF: "F?", JP: undefined }
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
      const c = s[i]
      if (UNKNOWN.has(c)) return
      const unsure = c !== c.toUpperCase()
      const r = parseChoice(axis, unsure ? `${c.toUpperCase()}?` : c, issues)
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

// ─────────────────────────────────────────── 차원별 자기보고 신호

export interface SelfSignalResult {
  signal: SelfSignal
  from: string[]
  mbtiOnly: boolean
  /** 같은 방향(high) 사실 중 developed 판정에 쓸 수 있는 근거 종류의 사실이 있는가 */
  developedEvidence: boolean
  /** high 사실이 있으나 전부 developed 근거가 아닌 종류(상황 답)뿐 */
  situationOnly: boolean
  /** 사실끼리 또는 사실과 MBTI가 반대 방향 */
  selfConflict: null | "facts-disagree" | "mbti-vs-facts"
  /** 사실 점수·MBTI 점수(내부) */
  factScore: number
  mbtiScore: number
}

const round6 = (x: number): number => Math.round(x * 1e6) / 1e6
const sign = (x: number): -1 | 0 | 1 => (x > 0 ? 1 : x < 0 ? -1 : 0)

/** 정리된 자기보고: 사용자 사실(source:"user")만, id 중복 제거, MBTI는 축당 첫 값만 */
export function normalizeSelf(self: SelfReport | undefined): { facts: UserFact[]; mbti: MbtiAxisReport[] } {
  const facts: UserFact[] = []
  const seen = new Set<string>()
  for (const f of self?.facts ?? []) {
    if (!f || f.source !== "user" || typeof f.id !== "string" || seen.has(f.id)) continue
    seen.add(f.id)
    facts.push(f)
  }
  const mbti: MbtiAxisReport[] = []
  for (const axis of MBTI_AXES) {
    const m = (self?.mbti ?? []).find((x) => x && x.axis === axis && MBTI_POLES[axis].includes(x.pole))
    if (m) mbti.push({ axis, pole: m.pole, sure: m.sure !== false })
  }
  return { facts, mbti }
}

/** 사실 하나가 이 차원을 가리키는 연결(없으면 null). 설문 mbti 문항 사실은 여기서 세지 않는다(MBTI는 축으로만) */
export function factLinkOf(
  f: UserFact,
  d: DimensionRow,
  tables: DimensionTable,
): { direction: "high" | "low"; weight: number; evidence: FactEvidence } | null {
  if (f.questionId === "mbti") return null
  const sit = tables.self.situation
  if (sit.questions.includes(f.questionId)) {
    // 상황 답: lived-link.ts 대응(십성 묶음)을 그대로 읽고 철자만 rules 기준으로 바꾼다
    if (d.rule !== "exp.lv.group.v1") return null
    const g = linkFactToChart(f, {}).group
    const code = g ? LIVED_LINK_GROUP[g] : undefined
    if (!code || code !== (d.params as GroupRuleParams).group) return null
    return { direction: sit.direction, weight: sit.weight, evidence: "situation" }
  }
  const link = d.facts.find((l) => l.key === `${f.questionId}:${f.value}`)
  return link ? { direction: link.direction, weight: link.weight, evidence: link.evidence } : null
}

/** MBTI에서 나온 조언 문체 힌트(차원 신호 아님 — T/F·N 등). 축 순서 */
export function styleHintsOf(mbti: readonly MbtiAxisReport[], bridge: MbtiBridge): string[] {
  const out: string[] = []
  for (const m of mbti) for (const h of bridge.styleHints) if (h.axis === m.axis && h.pole === m.pole && !out.includes(h.hint)) out.push(h.hint)
  return out
}

/**
 * 차원 하나의 자기보고 신호.
 * - 사실 점수 = 기질 답(표 facts) + 상황 답(lived-link)의 (방향 ±1 × 가중) 합.
 * - MBTI 점수 = 대응표 links의 (방향 ±1 × 가중 × 확신 없으면 unsureFactor) 합. sureOnly 행은 sure:true일 때만.
 * - 사실이 하나라도 닿으면: 방향이 MBTI와 반대일 때는 사실 쪽만 쓴다(경험 정보 우선, self-vs-self 기록).
 * - 사실이 하나도 닿지 않으면: MBTI 점수 × mbtiOnlyFactor(한 단계 약하게).
 * - developed 근거: developedEvidence에 든 종류(기본 trait = 기질 답)의 high 사실이 1개 이상이고 사실 점수가 양수.
 */
export function selfSignalOf(
  d: DimensionRow,
  norm: { facts: UserFact[]; mbti: MbtiAxisReport[] },
  tables: DimensionTable,
  bridge: MbtiBridge,
): SelfSignalResult {
  const cfg = tables.self
  let factScore = 0
  let factPos = 0
  let factNeg = 0
  let developedEvidence = false
  const factFrom: string[] = []
  for (const f of norm.facts) {
    const link = factLinkOf(f, d, tables)
    if (!link) continue
    const s = link.direction === "high" ? 1 : -1
    factScore += s * link.weight
    if (s > 0) {
      factPos += 1
      if (cfg.developedEvidence.includes(link.evidence)) developedEvidence = true
    } else factNeg += 1
    factFrom.push(`fact:${f.id}`)
  }
  factScore = round6(factScore)

  let mbtiScore = 0
  const mbtiFrom: string[] = []
  for (const m of norm.mbti) {
    for (const l of bridge.links) {
      if (l.dimensionId !== d.id || l.axis !== m.axis || l.pole !== m.pole) continue
      if (l.sureOnly && !m.sure) continue
      mbtiScore += (l.direction === "high" ? 1 : -1) * l.weight * (m.sure ? 1 : cfg.unsureFactor)
      if (!mbtiFrom.includes(`mbti:${m.axis}`)) mbtiFrom.push(`mbti:${m.axis}`)
    }
  }
  mbtiScore = round6(mbtiScore)

  const hasFacts = factFrom.length > 0
  const hasMbti = mbtiFrom.length > 0
  let selfConflict: SelfSignalResult["selfConflict"] = null
  let s: number
  if (hasFacts) {
    if (factPos > 0 && factNeg > 0) selfConflict = "facts-disagree"
    if (sign(mbtiScore) !== 0 && sign(factScore) !== 0 && sign(mbtiScore) !== sign(factScore)) {
      selfConflict = selfConflict ?? "mbti-vs-facts"
      s = factScore
    } else s = factScore + mbtiScore
  } else {
    s = mbtiScore * cfg.mbtiOnlyFactor
  }
  s = round6(s)
  const signal: SelfSignal = s >= cfg.highAt ? "high" : s <= -cfg.lowAt ? "low" : "none"
  return {
    signal,
    from: [...factFrom, ...mbtiFrom],
    mbtiOnly: !hasFacts && hasMbti,
    // 사실 점수가 최종적으로 high 쪽일 때만 developed 근거로 인정
    developedEvidence: developedEvidence && factScore > 0,
    situationOnly: factPos > 0 && !developedEvidence,
    selfConflict,
    factScore,
    mbtiScore,
  }
}
