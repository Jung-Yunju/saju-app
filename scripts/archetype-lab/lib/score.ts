// 특징 벡터 + 규칙 파일 → 원형 점수·순위·근거 기록. 순수·결정론적.
// 점수는 백만분의 1 단위 정수로 더한다(부동소수 더하기 순서에 따른 오차로 순위가 흔들리지 않게).
import type {
  ArchetypeRule, ArchetypeRuleSet, ArchetypeScore, ArchetypeScoring, CascadeInfo, Condition, EvidenceItem, FeatureValue, FeatureVector, ScoreTerm,
} from "./types"

const U = 1_000_000
const toU = (x: number): number => Math.round(x * U)
const fromU = (u: number): number => u / U

/** 조건 평가. inputs에 판정에 쓴 특징 값을 모은다(근거 기록용) */
export function evalCondition(c: Condition, fv: FeatureVector, inputs: Record<string, FeatureValue>): boolean {
  if ("all" in c) {
    let ok = true
    for (const x of c.all) if (!evalCondition(x, fv, inputs)) ok = false // 단락하지 않음: 근거 입력을 모두 남긴다
    return ok
  }
  if ("any" in c) {
    let ok = false
    for (const x of c.any) if (evalCondition(x, fv, inputs)) ok = true
    return ok
  }
  if ("not" in c) return !evalCondition(c.not, fv, inputs)
  const v = fv[c.f]
  inputs[c.f] = Array.isArray(v) ? [...v] : v
  if ("eq" in c) return v === c.eq
  if ("ne" in c) return v !== c.ne
  if ("in" in c) return c.in.includes(v as string | number | boolean | null)
  if ("has" in c) return Array.isArray(v) && v.includes(c.has)
  if ("hasAny" in c) return Array.isArray(v) && c.hasAny.some((x) => v.includes(x))
  if ("hasNone" in c) return Array.isArray(v) && !c.hasNone.some((x) => v.includes(x))
  if (typeof v !== "number") return false // 숫자 연산자인데 값이 null 등 → 거짓
  if ("gte" in c) return v >= c.gte
  if ("gt" in c) return v > c.gt
  if ("lte" in c) return v <= c.lte
  if ("lt" in c) return v < c.lt
  if ("between" in c) return v >= c.between[0] && v <= c.between[1]
  return false
}

function termPointsU(t: ScoreTerm, fv: FeatureVector, inputs: Record<string, FeatureValue>): number {
  if (t.points !== undefined) return toU(t.points)
  const l = t.linear!
  const raw = fv[l.f]
  inputs[l.f] = raw
  if (typeof raw !== "number") return 0
  let p = (raw - (l.offset ?? 0)) * l.mul
  if (l.min !== undefined) p = Math.max(l.min, p)
  if (l.max !== undefined) p = Math.min(l.max, p)
  return toU(p)
}

export function scoreArchetype(a: ArchetypeRule, fv: FeatureVector): ArchetypeScore & { scoreU: number; priority: number } {
  const evidence: EvidenceItem[] = []
  let ineligibleBy: ArchetypeScore["ineligibleBy"]
  if (a.require) {
    const inputs = {}
    if (!evalCondition(a.require, fv, inputs)) ineligibleBy = "require"
    evidence.push({ termId: "require", label: "자격 조건", points: 0, inputs })
  }
  if (!ineligibleBy && a.exclude) {
    const inputs = {}
    if (evalCondition(a.exclude, fv, inputs)) ineligibleBy = "exclude"
    evidence.push({ termId: "exclude", label: "제외 조건", points: 0, inputs })
  }
  let su = 0
  let matched = 0
  for (const t of a.terms) {
    const inputs: Record<string, FeatureValue> = {}
    if (t.when && !evalCondition(t.when, fv, inputs)) continue
    const pu = termPointsU(t, fv, inputs)
    if (pu === 0) continue
    su += pu
    matched++
    evidence.push({ termId: t.id, label: t.label, points: fromU(pu), inputs })
  }
  return {
    id: a.id, name: a.name, eligible: !ineligibleBy, ...(ineligibleBy ? { ineligibleBy } : {}),
    score: fromU(su), matchedTerms: matched, evidence, scoreU: su, priority: a.priority,
  }
}

/**
 * 순위: 자격 있는 원형 → 점수 내림차순 → priority 오름차순 → id 사전순. 자격 없는 원형은 뒤(같은 정렬).
 * 1순위 점수 < minScore 이거나 자격 있는 원형이 없으면 fallback 원형을 1순위로 둔다(decidedBy "fallback").
 */
export function scoreRuleSet(rs: ArchetypeRuleSet, fv: FeatureVector): ArchetypeScoring {
  if (rs.mode === "cascade") return cascadeRuleSet(rs, fv)
  const all = rs.archetypes.map((a) => scoreArchetype(a, fv))
  all.sort((x, y) => Number(y.eligible) - Number(x.eligible) || y.scoreU - x.scoreU || x.priority - y.priority || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
  const eligible = all.filter((x) => x.eligible)
  const strip = (x: (typeof all)[number]): ArchetypeScore => {
    const { scoreU: _u, priority: _p, ...rest } = x
    void _u
    void _p
    return rest
  }
  const ranking = all.map(strip)
  const minU = toU(rs.params.minScore)
  if (eligible.length === 0 || eligible[0].scoreU < minU) {
    const fb = all.find((x) => x.id === rs.fallback)!
    const second = eligible.find((x) => x.id !== fb.id) ?? null
    return {
      primary: { id: fb.id, name: fb.name, score: fb.score },
      secondary: second ? { id: second.id, name: second.name, score: second.score } : null,
      ranking, margin: null, tie: false, boundary: true, decidedBy: "fallback",
    }
  }
  const [p, s] = eligible
  const marginU = s ? p.scoreU - s.scoreU : null
  return {
    primary: { id: p.id, name: p.name, score: p.score },
    secondary: s ? { id: s.id, name: s.name, score: s.score } : null,
    ranking,
    margin: marginU === null ? null : fromU(marginU),
    tie: marginU === 0,
    boundary: marginU !== null && marginU < toU(rs.params.boundaryMargin),
    decidedBy: marginU === 0 ? "priority" : "score",
  }
}

// ─────────────────────────────────────────── 순서형 관문(cascade) 모드

const OP_TEXT: Record<string, string> = { eq: "=", ne: "≠", in: "∈", gte: "≥", gt: ">", lte: "≤", lt: "<", between: "∈", has: "has", hasAny: "hasAny", hasNone: "hasNone" }

/** 조건을 짧은 글로(근거 기록·탈락 사유용). 결정론적 */
export function conditionText(c: Condition): string {
  if ("all" in c) return c.all.length === 1 ? conditionText(c.all[0]) : `(${c.all.map(conditionText).join(" 그리고 ")})`
  if ("any" in c) return c.any.length === 1 ? conditionText(c.any[0]) : `(${c.any.map(conditionText).join(" 또는 ")})`
  if ("not" in c) return `아님${conditionText(c.not)}`
  const op = Object.keys(c).find((k) => k !== "f")!
  const v = (c as unknown as Record<string, unknown>)[op]
  return `${c.f} ${OP_TEXT[op]} ${Array.isArray(v) ? `{${v.join(",")}}` : String(v)}`
}

/** 처음 거짓이 된 최상위 조건(all이면 첫 거짓 자식, 아니면 조건 전체) */
function firstFailed(c: Condition, fv: FeatureVector): string {
  if ("all" in c) {
    for (const x of c.all) if (!evalCondition(x, fv, {})) return conditionText(x)
  }
  return conditionText(c)
}

/**
 * priority 오름차순으로 관문(require 참 · exclude 거짓)을 검사해 처음 통과한 원형을 1순위로 준다(02-archetypes.md §3.1).
 * 2순위(부 원형) = 순서와 무관하게 통과한 다른 원형 중 priority가 가장 앞선 것. 점수는 통과 1 / 탈락 0(표시용).
 * 어떤 관문도 통과하지 못하면 fallback 원형 + fallbackSafety(경보). 조용히 넘기지 않는다.
 */
export function cascadeRuleSet(rs: ArchetypeRuleSet, fv: FeatureVector): ArchetypeScoring {
  const ordered = [...rs.archetypes].sort((x, y) => x.priority - y.priority)
  const ranking: ArchetypeScore[] = []
  const passedIds: string[] = []
  const gateInputs = new Map<string, Record<string, FeatureValue>>()
  const failedOn = new Map<string, string>()
  for (const a of ordered) {
    const inputs: Record<string, FeatureValue> = {}
    let ok = evalCondition(a.require!, fv, inputs)
    let ineligibleBy: ArchetypeScore["ineligibleBy"]
    if (!ok) {
      ineligibleBy = "require"
      failedOn.set(a.id, firstFailed(a.require!, fv))
    } else if (a.exclude && evalCondition(a.exclude, fv, inputs)) {
      ok = false
      ineligibleBy = "exclude"
      failedOn.set(a.id, `제외 ${conditionText(a.exclude)}`)
    }
    gateInputs.set(a.id, inputs)
    if (ok) passedIds.push(a.id)
    ranking.push({
      id: a.id, name: a.name, eligible: ok, ...(ineligibleBy ? { ineligibleBy } : {}), score: ok ? 1 : 0, matchedTerms: ok ? 1 : 0,
      evidence: [{ termId: "gate", label: a.gateLabel ?? a.ruleId ?? a.id, points: ok ? 1 : 0, inputs }],
    })
  }
  const byId = new Map(ordered.map((a) => [a.id, a]))
  const pick = (id: string) => ({ id, name: byId.get(id)!.name, score: passedIds.includes(id) ? 1 : 0 })
  const safety = passedIds.length === 0
  const primaryId = safety ? rs.fallback : passedIds[0]
  const pIdx = ordered.findIndex((a) => a.id === primaryId)
  const trace: CascadeInfo["trace"] = ordered
    .slice(0, safety ? ordered.length : pIdx + 1)
    .map((a) => (a.id === primaryId && !safety ? { id: a.id, passed: true } : { id: a.id, passed: false, failedOn: failedOn.get(a.id) }))
  const alsoMatched = passedIds.filter((id) => id !== primaryId)
  // 통과 원형을 앞으로(priority 순), 탈락 원형은 뒤(priority 순)
  ranking.sort((x, y) => Number(y.eligible) - Number(x.eligible) || byId.get(x.id)!.priority - byId.get(y.id)!.priority)
  return {
    primary: pick(primaryId),
    secondary: alsoMatched.length ? pick(alsoMatched[0]) : null,
    ranking,
    margin: null,
    tie: false,
    boundary: false,
    decidedBy: safety ? "fallback" : "cascade",
    cascade: {
      ruleId: byId.get(primaryId)!.ruleId ?? null,
      matched: safety ? {} : gateInputs.get(primaryId)!,
      trace,
      alsoMatched,
      fallbackSafety: safety,
    },
  }
}
