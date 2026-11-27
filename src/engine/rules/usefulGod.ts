// 용신 — 관점별 결정 절차와 희기신 (strength-structure-spec §3, rules@0.3.0, 통관 기준 옵션 0.4.0)
// 관점을 합친 하나의 용신은 만들지 않는다(대표 결정 대기 6번 — 기본 "관점별 병기").
// 후보 순서·기준값(통관 기본 25%·0.5 = 옵션 tonggwanMinShare·tonggwanMinRatio, 병약 40%)은 연구소장 설계값이다. 궁통보감 조후용신 표는 쓰지 않는다(칸 0/120).
import type { Element } from "../types"
import { ELEMENTS } from "./basics"
import { CLIMATE_SOURCE } from "./climate"
import { ei, el, elementOfGroup, groupOf, round6, type Natal } from "./groups"
import { primaryModel } from "./strength"
import { specialFavored } from "./structure"
import type {
  ClimateResult, FavorableSet, Position, RuleOptions, StrengthModelResult, StrengthResult, StructureCandidate, TenGodGroup,
  UsefulGodCandidate, UsefulGodMethod, UsefulGodView, UsefulGodsResult,
} from "./types"

// 통관 기준(구 TONGGWAN_MIN_SHARE 0.25·TONGGWAN_MIN_BALANCE 0.5 상수)은 rules@0.4.0부터 RuleOptions
// tonggwanMinShare·tonggwanMinRatio(기본값 같음, options.ts)로 받는다 — §3.3 기준 강화 측정용
export const BYEONGYAK_MIN_SHARE = 0.4

const LABEL: Record<UsefulGodMethod, string> = {
  eokbu: "힘의 균형(억부)",
  johuClimate: "계절 기운(조후·간이)",
  tonggwan: "맞선 기운 잇기(통관)",
  byeongyak: "지나친 기운 고치기(병약)",
  gyeokguk: "격국으로 보면(상신)",
  special: "특수격 관점(후보)",
}
const SCHOOL: Record<UsefulGodMethod, string> = {
  eokbu: "적천수 계열(억부)",
  johuClimate: "연구소장 설계(간이 조후)",
  tonggwan: "통설(통관)",
  byeongyak: "명리정종 계열(병약)",
  gyeokguk: "자평진전(상신)",
  special: "적천수 계열(종상·화상)",
}
const SOURCE: Record<UsefulGodMethod, string> = {
  eokbu: "strength-structure-spec §3.1 (후보 순서는 연구소장 설계)",
  johuClimate: CLIMATE_SOURCE,
  tonggwan: "strength-structure-spec §3.3 (기준 tonggwanMinShare·tonggwanMinRatio, 기본 25%·0.5는 연구소장 설계)",
  byeongyak: "strength-structure-spec §3.4 (기준 40%는 연구소장 설계)",
  gyeokguk: "strength-structure-spec §2.3 상신 표 (L0 요지)",
  special: "strength-structure-spec §2.4·§3.6 (특수격 후보, 확신도 low)",
}

interface Ctx {
  n: Natal
  o: RuleOptions
  d: Element
  weighted: Record<Element, number>
  strength: StrengthResult
  A: StrengthModelResult
  climate: ClimateResult
  regular: StructureCandidate[]
  special: StructureCandidate[]
}

function cands(ctx: Ctx, elements: Element[]): UsefulGodCandidate[] {
  const out: UsefulGodCandidate[] = []
  for (const e of elements) {
    if (out.some((c) => c.element === e)) continue
    out.push({ element: e, group: groupOf(ctx.d, e), rank: out.length + 1, presentWeight: ctx.weighted[e] })
  }
  return out
}

function favorableOf(def: RuleOptions["favorableDefinition"], cs: UsefulGodCandidate[]): FavorableSet | undefined {
  if (!cs.length) return undefined
  const u = ei(cs[0].element)
  const cycle = { xi: el(u + 4), ji: el(u + 3), gu: el(u + 2), han: el(u + 1) }
  if (def === "generationCycle") return { definition: def, ...cycle }
  if (cs.length < 2) return undefined
  // secondCandidate(엔진 개발자 해석 ⚑): 희신 = 2순위. 2순위가 원래 한신이면 한신 자리에 원래 희신을 둔다(맞바꿈).
  // 2순위가 기신·구신과 같으면 그대로 두고 conflicts에 적는다(예: 신강 비겁형 관살 → 식상 = 기신).
  const xi = cs[1].element
  const conflicts = (["ji", "gu"] as const).filter((k) => cycle[k] === xi)
  return {
    definition: def, xi, ji: cycle.ji, gu: cycle.gu, han: xi === cycle.han ? cycle.xi : cycle.han,
    ...(conflicts.length ? { conflicts: [...conflicts] } : {}),
  }
}

/** 모형 A 근거 항목 중 그 묶음의 위치(중복 제거, 근거 순서) */
function groupPositions(A: StrengthModelResult, g: TenGodGroup): Position[] {
  const out: Position[] = []
  for (const it of A.basis)
    if (it.group === g && !out.some((p) => p.pillar === it.position.pillar && p.part === it.position.part)) out.push({ ...it.position })
  return out
}

// ─────────────────────────────────────────── 억부 §3.1

export interface EokbuOne {
  status: "ok" | "balanced"
  lean?: "weak" | "strong"
  groups: TenGodGroup[]
  decisive: TenGodGroup | null
  ruleId: string
}

export function eokbuOf(m: StrengthModelResult, g: Record<TenGodGroup, number>): EokbuOne {
  if (m.verdict === "중화")
    return { status: "balanced", lean: (m.ratio as number) < 0.5 ? "weak" : "strong", groups: [], decisive: null, ruleId: "ug.eokbu.balanced" }
  if (m.verdict === "신강") {
    if (g.inseong > g.bigyeop) return { status: "ok", groups: ["jaeseong", "siksang"], decisive: "inseong", ruleId: "ug.eokbu.strong.inseong" }
    return { status: "ok", groups: ["gwansal", "siksang", "jaeseong"], decisive: "bigyeop", ruleId: "ug.eokbu.strong.bigyeop" }
  }
  const opp: TenGodGroup[] = ["gwansal", "jaeseong", "siksang"] // 동점: 관살 > 재성 > 식상
  let best: TenGodGroup = opp[0]
  for (const x of opp) if (g[x] > g[best]) best = x
  if (best === "gwansal") return { status: "ok", groups: ["inseong", "bigyeop"], decisive: best, ruleId: "ug.eokbu.weak.gwansal" }
  if (best === "siksang") return { status: "ok", groups: ["inseong", "bigyeop"], decisive: best, ruleId: "ug.eokbu.weak.siksang" }
  return { status: "ok", groups: ["bigyeop", "inseong"], decisive: best, ruleId: "ug.eokbu.weak.jaeseong" }
}

function eokbuView(ctx: Ctx): UsefulGodView {
  const g = ctx.strength.groupTotals
  const byModel = ctx.strength.models.map((m) => {
    const r = eokbuOf(m, g)
    return {
      model: m.model, verdict: m.verdict, status: r.status, ...(r.lean ? { lean: r.lean } : {}),
      candidates: cands(ctx, r.groups.map((x) => elementOfGroup(ctx.d, x))), ruleId: r.ruleId,
    }
  })
  const pm = primaryModel(ctx.strength)
  const p = eokbuOf(pm, g)
  const candidates = cands(ctx, p.groups.map((x) => elementOfGroup(ctx.d, x)))
  const values: Record<string, number> = { ...g }
  if (pm.ratio !== null) values.ratio = pm.ratio
  return {
    method: "eokbu", label: LABEL.eokbu, school: SCHOOL.eokbu,
    status: p.status,
    candidates,
    ...(favorableOf(ctx.o.favorableDefinition, candidates) ? { favorable: favorableOf(ctx.o.favorableDefinition, candidates) } : {}),
    byModel,
    ...(p.lean ? { lean: p.lean } : {}),
    confidence: ctx.strength.agreement === "all" ? "medium" : "low",
    basis: [{ ruleId: p.ruleId, positions: p.decisive ? groupPositions(ctx.A, p.decisive) : [], values }],
    source: SOURCE.eokbu,
  }
}

// ─────────────────────────────────────────── 간이 조후 §3.2

/** 필요 방향 → 오행(따뜻하게·말리기 = 화, 식히기·적시기 = 수). 절댓값이 큰 축 먼저(같으면 온도 축) */
export function climateElements(c: ClimateResult): Element[] {
  const tEl: Element | null = c.needs.includes("warm") ? "fire" : c.needs.includes("cool") ? "water" : null
  const mEl: Element | null = c.needs.includes("dry") ? "fire" : c.needs.includes("moisten") ? "water" : null
  const order = Math.abs(c.M) > Math.abs(c.T) ? [mEl, tEl] : [tEl, mEl]
  const out: Element[] = []
  for (const e of order) if (e && !out.includes(e)) out.push(e)
  return out
}

function johuView(ctx: Ctx): UsefulGodView {
  const candidates = cands(ctx, climateElements(ctx.climate))
  const fav = favorableOf(ctx.o.favorableDefinition, candidates)
  return {
    method: "johuClimate", label: LABEL.johuClimate, school: SCHOOL.johuClimate,
    status: candidates.length ? "ok" : "none",
    candidates,
    ...(fav ? { favorable: fav } : {}),
    confidence: "low",
    basis: [{
      ruleId: "climate.v1",
      positions: ctx.climate.basis.filter((b) => b.dT !== 0 || b.dM !== 0).map((b) => ({ ...b.position })),
      values: { T: ctx.climate.T, M: ctx.climate.M },
    }],
    source: SOURCE.johuClimate,
  }
}

// ─────────────────────────────────────────── 통관 §3.3

function elementPositions(A: StrengthModelResult, es: Element[]): Position[] {
  const out: Position[] = []
  for (const it of A.basis)
    if (es.includes(it.element) && !out.some((p) => p.pillar === it.position.pillar && p.part === it.position.part)) out.push({ ...it.position })
  return out
}

function tonggwanView(ctx: Ctx): UsefulGodView {
  const T = ctx.A.total as number
  const minShare = ctx.o.tonggwanMinShare
  const minRatio = ctx.o.tonggwanMinRatio
  const pairs: { x: Element; y: Element; z: Element; xw: number; yw: number; xs: number; ys: number; bal: number }[] = []
  for (const x of ELEMENTS) {
    const y = el(ei(x) + 2)
    const xw = ctx.weighted[x]
    const yw = ctx.weighted[y]
    const xs = round6(xw / T)
    const ys = round6(yw / T)
    if (xs < minShare || ys < minShare) continue
    const bal = round6(Math.min(xw, yw) / Math.max(xw, yw))
    if (bal < minRatio) continue
    pairs.push({ x, y, z: el(ei(x) + 1), xw, yw, xs, ys, bal })
  }
  pairs.sort((a, b) => b.xw - a.xw || ei(a.x) - ei(b.x))
  const candidates = cands(ctx, pairs.map((p) => p.z))
  const fav = favorableOf(ctx.o.favorableDefinition, candidates)
  return {
    method: "tonggwan", label: LABEL.tonggwan, school: SCHOOL.tonggwan,
    status: candidates.length ? "ok" : "none",
    candidates,
    ...(fav ? { favorable: fav } : {}),
    confidence: "low",
    basis: pairs.map((p) => ({
      ruleId: `ug.tonggwan.${p.x}>${p.y}`,
      positions: elementPositions(ctx.A, [p.x, p.y]),
      values: {
        attackerWeight: p.xw, targetWeight: p.yw, attackerShare: p.xs, targetShare: p.ys, balance: p.bal, bridgeWeight: ctx.weighted[p.z],
        minShare, minRatio, // rules@0.4.0: 사용한 기준값
      },
    })),
    source: SOURCE.tonggwan,
  }
}

// ─────────────────────────────────────────── 병약 §3.4 (기본 꺼짐)

function byeongyakView(ctx: Ctx): UsefulGodView {
  const T = ctx.A.total as number
  let x: Element = ELEMENTS[0]
  for (const e of ELEMENTS) if (ctx.weighted[e] > ctx.weighted[x]) x = e
  const s = round6(ctx.weighted[x] / T)
  const ok = s >= BYEONGYAK_MIN_SHARE
  const candidates = ok ? cands(ctx, [el(ei(x) + 3)]) : []
  const fav = favorableOf(ctx.o.favorableDefinition, candidates)
  return {
    method: "byeongyak", label: LABEL.byeongyak, school: SCHOOL.byeongyak,
    status: ok ? "ok" : "none",
    candidates,
    ...(fav ? { favorable: fav } : {}),
    confidence: "low",
    basis: ok ? [{ ruleId: `ug.byeongyak.${x}`, positions: elementPositions(ctx.A, [x]), values: { illnessShare: s } }] : [],
    source: SOURCE.byeongyak,
  }
}

// ─────────────────────────────────────────── 격국 상신 §3.5

function gyeokgukView(ctx: Ctx): UsefulGodView {
  const els: Element[] = []
  const from: StructureCandidate[] = []
  const basis: UsefulGodView["basis"] = []
  for (const c of ctx.regular)
    for (const s of c.sangsin ?? []) {
      els.push(s.element)
      from.push(c)
      basis.push({ ruleId: `${c.ruleId}.sangsin.${s.group}`, positions: s.touchul.map((p) => ({ ...p })) })
    }
  const candidates = cands(ctx, els)
  const fav = favorableOf(ctx.o.favorableDefinition, candidates)
  return {
    method: "gyeokguk", label: LABEL.gyeokguk, school: SCHOOL.gyeokguk,
    status: candidates.length ? "ok" : "none",
    candidates,
    ...(fav ? { favorable: fav } : {}),
    // rank 1을 낸 격 후보의 확신도(주 후보에 상신이 없어 대체 후보가 rank 1이면 low)
    confidence: from[0]?.confidence ?? ctx.regular[0]?.confidence ?? "low",
    basis,
    source: SOURCE.gyeokguk,
  }
}

// ─────────────────────────────────────────── 특수격 §3.6

function specialView(ctx: Ctx): UsefulGodView {
  if (ctx.o.specialStructures === "off")
    return {
      method: "special", label: LABEL.special, school: SCHOOL.special, status: "notApplicable", candidates: [],
      confidence: "low", basis: [], source: SOURCE.special,
    }
  const els: Element[] = []
  const basis: UsefulGodView["basis"] = []
  for (const c of ctx.special) {
    els.push(...specialFavored(c, ctx.d, ctx.strength.groupTotals))
    basis.push({ ruleId: c.ruleId, positions: c.obstructions ? c.obstructions.flatMap((x) => x.members.map((m) => ({ ...m }))) : [] })
  }
  const candidates = cands(ctx, els)
  const fav = favorableOf(ctx.o.favorableDefinition, candidates)
  return {
    method: "special", label: LABEL.special, school: SCHOOL.special,
    status: candidates.length ? "ok" : "none",
    candidates,
    ...(fav ? { favorable: fav } : {}),
    confidence: "low",
    ...(candidates.length ? { reversesUsefulGod: ctx.special.some((c) => c.reversesUsefulGod === true) } : {}),
    basis,
    source: SOURCE.special,
  }
}

/** 특수격 후보마다 억부 대표 rank 1이 그 관점의 반가운 오행에 없으면 reversesUsefulGod = true (엔진 개발자 정의) */
export function markReverses(special: StructureCandidate[], d: Element, g: Record<TenGodGroup, number>, eokbuRank1: Element | null): void {
  for (const c of special) c.reversesUsefulGod = eokbuRank1 !== null && !specialFavored(c, d, g).includes(eokbuRank1)
}

// ─────────────────────────────────────────── 묶기

export type UsefulGodsInput = Ctx

export function analyzeUsefulGods(ctx: UsefulGodsInput): UsefulGodsResult {
  const pm = primaryModel(ctx.strength)
  const eok = eokbuOf(pm, ctx.strength.groupTotals)
  const eokRank1 = eok.groups.length ? elementOfGroup(ctx.d, eok.groups[0]) : null
  const views: UsefulGodView[] = ctx.o.usefulGodMethods.map((m) => {
    switch (m) {
      case "eokbu":
        return eokbuView(ctx)
      case "johuClimate":
        return johuView(ctx)
      case "tonggwan":
        return tonggwanView(ctx)
      case "byeongyak":
        return byeongyakView(ctx)
      case "gyeokguk":
        return gyeokgukView(ctx)
      case "special":
        return specialView(ctx)
    }
  })

  // 관점 일치(rank 1)
  const map = new Map<Element, UsefulGodMethod[]>()
  for (const v of views) if (v.candidates.length) map.set(v.candidates[0].element, [...(map.get(v.candidates[0].element) ?? []), v.method])
  const agreement = [...map.entries()]
    .map(([element, methods]) => ({ element, methods }))
    .sort((a, b) => b.methods.length - a.methods.length || ei(a.element) - ei(b.element))

  // §3.8 (가) 제안 규칙 — 표시 정책 아님
  const johu = climateElements(ctx.climate)
  const extreme = ["한강", "열강"].includes(ctx.climate.tClass) || ["습강", "조강"].includes(ctx.climate.mClass)
  let singlePickProposal: UsefulGodsResult["singlePickProposal"]
  const skipEokbu = eok.status !== "ok" || (ctx.strength.agreement === "split" && ctx.A.nearBoundary)
  if (extreme && johu.length) singlePickProposal = { element: johu[0], step: "johuExtreme", ruleId: "ug.singlePick.proposal-ga" }
  else if (!skipEokbu && eokRank1) singlePickProposal = { element: eokRank1, step: "eokbu", ruleId: "ug.singlePick.proposal-ga" }
  else if (johu.length) singlePickProposal = { element: johu[0], step: "johu", ruleId: "ug.singlePick.proposal-ga" }
  else singlePickProposal = { element: null, step: "none", ruleId: "ug.singlePick.proposal-ga" }

  return { views, agreement, displayPolicy: "parallel", singlePickProposal }
}

/** index에서 특수격 reversesUsefulGod 표시에 쓰는 억부 대표 rank 1 */
export function eokbuRank1Of(strength: StrengthResult, d: Element): Element | null {
  const r = eokbuOf(primaryModel(strength), strength.groupTotals)
  return r.groups.length ? elementOfGroup(d, r.groups[0]) : null
}
