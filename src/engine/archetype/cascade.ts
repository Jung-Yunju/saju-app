// 순서형 관문 판정(cascade). 특징 벡터 + 규칙 → 주 원형·부 원형·근거. 순수·결정론적.
// lab(scripts/archetype-lab/lib/score.ts cascadeRuleSet)과 같은 판정을 한다 — 1천 건 동일성은 테스트가 확인.
import type { ArchetypeConditionCheck, ArchetypeGate, ArchetypeId, Condition, FeatureValue, FeatureVector } from "./types"

/** 조건 평가. inputs에 판정에 쓴 특징 값을 모은다(근거 기록용). all·any는 단락하지 않는다(근거 입력을 모두 남김) */
export function evalCondition(c: Condition, fv: FeatureVector, inputs: Record<string, FeatureValue>): boolean {
  if ("all" in c) {
    let ok = true
    for (const x of c.all) if (!evalCondition(x, fv, inputs)) ok = false
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

const OP_TEXT: Record<string, string> = { eq: "=", ne: "≠", in: "∈", gte: "≥", gt: ">", lte: "≤", lt: "<", between: "∈", has: "has", hasAny: "hasAny", hasNone: "hasNone" }

/** 조건을 짧은 글로(탈락 사유용). 결정론적 — lab conditionText와 같은 글 */
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

/** 잎 조건별 판정 기록(조건 나무를 왼쪽부터 훑는다) */
export function leafChecks(c: Condition, fv: FeatureVector, negated = false, out: ArchetypeConditionCheck[] = []): ArchetypeConditionCheck[] {
  if ("all" in c) for (const x of c.all) leafChecks(x, fv, negated, out)
  else if ("any" in c) for (const x of c.any) leafChecks(x, fv, negated, out)
  else if ("not" in c) leafChecks(c.not, fv, !negated, out)
  else {
    const op = Object.keys(c).find((k) => k !== "f")!
    const threshold = (c as unknown as Record<string, ArchetypeConditionCheck["threshold"]>)[op]
    const v = fv[c.f]
    out.push({
      key: c.f, op, threshold: Array.isArray(threshold) ? [...threshold] : threshold,
      value: Array.isArray(v) ? [...v] : v, ok: evalCondition(c, fv, {}), ...(negated ? { negated: true as const } : {}),
    })
  }
  return out
}

export interface GateOutcome {
  gate: ArchetypeGate
  passed: boolean
  failedOn?: string
  values: Record<string, FeatureValue>
}

export interface CascadeOutcome {
  primary: ArchetypeGate
  /** 통과한 관문(관문 순서) */
  passed: ArchetypeId[]
  /** 관문 순서 전체 판정 */
  gates: GateOutcome[]
  fallbackSafety: boolean
}

/**
 * 관문 순서(priority 오름차순)로 require 참 · exclude 거짓을 검사해 처음 통과한 원형이 주 원형.
 * 전체 관문을 다 검사해 통과 목록을 남긴다(부 원형 = 그다음 통과). 어떤 관문도 통과 못 하면 fallback + 경보.
 */
export function runCascade(ordered: readonly ArchetypeGate[], fallback: ArchetypeId, fv: FeatureVector): CascadeOutcome {
  const gates: GateOutcome[] = []
  const passed: ArchetypeId[] = []
  for (const g of ordered) {
    const values: Record<string, FeatureValue> = {}
    let ok = evalCondition(g.require, fv, values)
    let failedOn: string | undefined
    if (!ok) failedOn = firstFailed(g.require, fv)
    else if (g.exclude && evalCondition(g.exclude, fv, values)) {
      ok = false
      failedOn = `제외 ${conditionText(g.exclude)}`
    }
    gates.push({ gate: g, passed: ok, ...(failedOn !== undefined ? { failedOn } : {}), values })
    if (ok) passed.push(g.id)
  }
  const safety = passed.length === 0
  const primaryId = safety ? fallback : passed[0]
  return { primary: ordered.find((g) => g.id === primaryId)!, passed, gates, fallbackSafety: safety }
}
