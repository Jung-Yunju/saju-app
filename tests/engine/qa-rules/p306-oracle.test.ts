// 품질검증 P3-06 — 무작위 원국에서 신강약·격국·억부·조후·통관·청탁 표지를 독립 오라클과 대조 + 근거 위치 무결성
import { describe, expect, it } from "vitest"
import { analyzeRules, computeChart, type RuleAnalysis, type RuleOptions } from "@/engine"
import { charAt, hiddenOf, posKey, stemEl, type OInput } from "./oracle"
import * as O from "./strength-oracle"
import { chartSamples, syntheticSamples, type Sample } from "./compare"

const TEMPLATE = computeChart({ calendar: "solar", year: 1990, month: 5, day: 5, time: { hour: 10, minute: 0 }, timezone: "Asia/Seoul", gender: "M" })
type Opts = Partial<RuleOptions>
const J = JSON.stringify
const near = (a: number | null | undefined, b: number, eps = 2e-6) => typeof a === "number" && Math.abs(a - b) <= eps

export function check306(s: Sample, a: RuleAnalysis, opt: Opts, fails: string[]): void {
  const n: O.Natal = { ...s.chart.pillars }
  const inp: OInput = { natal: n, luck: s.extra?.luck ?? [], seun: s.extra?.year ?? null }
  const table = opt.hiddenStemTable ?? "kr-monthly-30"
  const primary = opt.strengthPrimary ?? "weighted"
  const so: O.StructOpts = { table, touchul: opt.structureTouchul ?? "transparentFirst", match: opt.touchulMatch ?? "sameStem", rokgeopAlt: opt.rokgeopAlternative ?? true }
  const f = (m: string) => fails.push(`${s.label}: ${m}`)
  const d = n.day.stem

  // ── 신강약 A·C
  const A = a.strength.models.find((m) => m.model === "weighted")!, B = a.strength.models.find((m) => m.model === "threeFactor")!, C = a.strength.models.find((m) => m.model === "rooted")!
  if (a.strength.models.map((m) => m.model).join() !== "weighted,threeFactor,rooted") f(`models 순서 ${a.strength.models.map((m) => m.model)}`)
  const oa = O.modelA(n, table), oc = O.modelA(n, table, true)
  for (const [E, Q, nm] of [[A, oa, "A"], [C, oc, "C"]] as const) {
    if (E.ratio !== Q.ratio || E.verdict !== Q.verdict || E.extreme !== Q.extreme || E.nearBoundary !== Q.nearBoundary) f(`${nm} 엔진 ${J([E.ratio, E.verdict, E.extreme, E.nearBoundary])} 오라클 ${J([Q.ratio, Q.verdict, Q.extreme, Q.nearBoundary])}`)
    if (!near(E.support, Q.S) || !near(E.total, Q.T)) f(`${nm} S·T 엔진 ${E.support}/${E.total} 오라클 ${Q.S}/${Q.T}`)
    const sig = (b: { position: { pillar: string; part: string }; char: string; viaHiddenStem?: string; group: string; side: string; rootFactor: number; points: number }) => `${posKey(b.position)}:${b.char}:${b.viaHiddenStem ?? ""}:${b.group}:${b.side}:${b.rootFactor}:${b.points.toFixed(6)}`
    const ge = E.basis.map(sig).join(" "), gq = Q.basis.map(sig).join(" ")
    if (ge !== gq) f(`${nm} basis 엔진[${ge}] 오라클[${gq}]`)
    if (E.score !== Math.round(Q.ratio * 1000) / 10) f(`${nm} score ${E.score}`)
  }
  // ── B
  const ob = O.modelB(n, opt.deukjiBasis ?? "dayBranchMainQi", table)
  const fc = B.factors!
  if (B.verdict !== ob.verdict || fc.deukryeong.met !== ob.deukryeong || fc.deukji.met !== ob.deukji || fc.deukse.met !== ob.deukse || fc.deukse.count !== ob.count || fc.deukse.of !== ob.of)
    f(`B 엔진 ${J([B.verdict, fc.deukryeong.met, fc.deukji.met, fc.deukse.met, fc.deukse.count, fc.deukse.of])} 오라클 ${J([ob.verdict, ob.deukryeong, ob.deukji, ob.deukse, ob.count, ob.of])}`)
  if (fc.deukse.basis.map(posKey).sort().join() !== ob.supportCells.map(posKey).sort().join()) f(`B 득세 basis ${fc.deukse.basis.map(posKey)} 오라클 ${ob.supportCells.map(posKey)}`)
  if (B.ratio !== null || B.extreme !== null) f(`B ratio/extreme null 아님`)
  const verdicts = [oa.verdict, ob.verdict, oc.verdict]
  if (a.strength.agreement !== (new Set(verdicts).size === 1 ? "all" : "split")) f(`agreement ${a.strength.agreement} 오라클 ${verdicts}`)
  if (a.strength.primary !== primary) f(`primary ${a.strength.primary}`)
  if (a.strength.seasonState !== O.seasonState(n)) f(`seasonState ${a.strength.seasonState} 오라클 ${O.seasonState(n)}`)
  const og = O.groupTotals(n, table)
  for (const k of Object.keys(og) as O.Group[]) if (!near(a.strength.groupTotals[k], og[k])) f(`groupTotals.${k} ${a.strength.groupTotals[k]} 오라클 ${og[k]}`)
  // 일간 뿌리
  const roots: string[] = []
  for (const k of ["year", "month", "day", "hour"] as const) { const p = n[k]; if (p) for (const h of hiddenOf(p.branch, table)) if (stemEl(h.stem) === stemEl(d)) roots.push(`${k}:${h.stem}:${h.role}`) }
  const gr = a.strength.dayMasterRoots.map((r) => `${r.position.pillar}:${r.stem}:${r.role}`)
  if (gr.sort().join() !== roots.sort().join() || a.strength.dayMasterRooted !== roots.length > 0) f(`dayMasterRoots ${gr} 오라클 ${roots}`)
  // 표 민감도
  const others = (["kr-monthly-30", "cn-lunarjs", "main-only"] as const).filter((t) => t !== table)
  const ots = others.map((t) => { const x = O.modelA(n, t); return `${t}:${x.ratio}:${x.verdict}:${x.extreme}` })
  const gts = a.strength.tableSensitivity.map((t) => `${t.tableId}:${t.ratio}:${t.verdict}:${t.extreme}`)
  if (ots.join() !== gts.join()) f(`tableSensitivity ${gts} 오라클 ${ots}`)
  const oSens = others.some((t) => { const x = O.modelA(n, t); return x.verdict !== oa.verdict || x.extreme !== oa.extreme })
  if (a.strength.tableSensitive !== oSens) f(`tableSensitive ${a.strength.tableSensitive} 오라클 ${oSens}`)
  // 시진 민감도
  if (n.hour) { if (a.strength.hourSensitivity !== null) f(`시주 있는데 hourSensitivity`) }
  else {
    const hs = a.strength.hourSensitivity
    const by = O.hourPillars(d).map((h) => O.modelA({ ...n, hour: h }, table))
    const set = (["신강", "중화", "신약"] as const).filter((v) => by.some((x) => x.verdict === v))
    if (!hs || J(hs.byHour.map((h) => [h.ratio, h.verdict])) !== J(by.map((x) => [x.ratio, x.verdict])) || J(hs.verdicts) !== J(set) || hs.hourSensitive !== set.length > 1) f(`hourSensitivity 불일치`)
  }
  // affectedBy = 원국 관계 전부, critical
  const nat = a.interactions.filter((i) => i.scope === "natal")
  const supStem = (p: { pillar: string; part: string }) => p.part === "stem" && p.pillar !== "day" && ["bigyeop", "inseong"].includes(O.groupOf(d, stemEl(charAt(inp, p as never)!)))
  const crit = (ms: { pillar: string; part: string }[]) => ms.some((m) => (m.pillar === "month" && m.part === "branch") || (m.pillar === "day") || supStem(m))
  const ea = nat.map((i) => `${i.ruleId}@${i.members.map(posKey).join("+")}:${crit(i.members)}`).sort()
  const ga = a.strength.affectedBy.map((i) => `${i.ruleId}@${i.members.map(posKey).join("+")}:${i.critical}`).sort()
  if (ea.join() !== ga.join()) f(`affectedBy 엔진 ${ga.length} 오라클 ${ea.length} 차이 ${ga.filter((x) => !ea.includes(x)).concat(ea.filter((x) => !ga.includes(x))).slice(0, 4)}`)

  // ── 격국
  const prim = a.structure.candidates.find((c) => c.role === "primary")
  const op = O.primaryStructure(n, so)
  if (!prim || prim.name !== op.name) f(`격국 엔진 ${prim?.name} 오라클 ${op.name}`)
  else {
    const otherSo = { ...so, touchul: so.touchul === "transparentFirst" ? "mainQiOnly" : "transparentFirst" } as O.StructOpts
    const ov = O.primaryStructure(n, otherSo)
    const same = op.kind === "rokgeop" || ov.name === op.name
    const expConf = same ? "medium" : "low"
    if (prim.confidence !== expConf || prim.variantAgreement !== (same ? "same" : "differs")) f(`격국 확신도 ${prim.confidence}/${prim.variantAgreement} 오라클 ${expConf}`)
    const other = a.structure.candidates.find((c) => c.role === "otherVariant")
    if (same ? !!other : other?.name !== ov.name || other?.confidence !== "low") f(`다른 변형 후보 ${other?.name}/${other?.confidence} 오라클 ${same ? "없음" : ov.name}`)
    if (op.pivot && (prim.pivot?.stem !== op.pivot.stem || prim.pivot?.role !== op.pivot.role || prim.pivot?.tenGod !== op.pivot.tenGod || (prim.pivot?.touchul === null) !== (op.pivot.touchul === null))) f(`pivot ${J(prim.pivot)} 오라클 ${J(op.pivot)}`)
    const alts = a.structure.candidates.filter((c) => c.role === "rokgeopAlt")
    const oalts = op.kind === "rokgeop" && so.rokgeopAlt ? O.rokgeopAlts(n, so) : []
    if (alts.map((x) => x.name).sort().join() !== oalts.join() || alts.some((x) => x.confidence !== "low")) f(`G1-alt ${alts.map((x) => x.name)} 오라클 ${oalts}`)
    // 상신 묶음
    const sg = (prim.sangsin ?? []).map((x) => x.group)
    const esg = op.kind === "rokgeop" && op.name !== "양인격"
      ? (["jaeseong", "gwansal", "siksang"] as O.Group[]).filter((g) => (["year", "month", "hour"] as const).some((k) => n[k] && O.groupOf(d, stemEl(n[k]!.stem)) === g))
      : O.SANGSIN[op.name] ?? []
    if ([...sg].sort().join() !== [...esg].sort().join()) f(`상신 ${prim.name} 엔진 ${sg} 오라클 ${esg}`)
  }
  const byT = (["kr-monthly-30", "cn-lunarjs", "main-only"] as const).map((t) => O.primaryStructure(n, { ...so, table: t }).name)
  if (a.structure.byTable.map((x) => x.name).join() !== byT.join()) f(`structure.byTable ${a.structure.byTable.map((x) => x.name)} 오라클 ${byT}`)
  if (a.structure.tableSensitive !== new Set(byT).size > 1) f(`structure.tableSensitive`)
  for (const c of a.structure.candidates) if (c.confidence === ("high" as never) || (c.kind === "special" && c.confidence !== "low")) f(`확신도 규칙 위반 ${c.name} ${c.confidence}`)
  if (opt.specialStructures === "off" && a.structure.candidates.some((c) => c.kind === "special")) f(`특수격 off인데 후보`)

  // ── 억부
  const ev = a.usefulGods.views.find((v) => v.method === "eokbu")
  const pv = primary === "weighted" ? oa : primary === "rooted" ? oc : null
  const pVerdict = pv ? pv.verdict : ob.verdict
  const oe = O.eokbu(pVerdict, pv ? pv.ratio : null, og)
  if (ev) {
    const got = [...ev.candidates].sort((x, y) => x.rank - y.rank).map((c) => c.element).join()
    const exp = oe.groups.map((g) => O.groupEl(d, g)).join()
    if (ev.status !== oe.status || got !== exp || (oe.lean && ev.lean !== oe.lean)) f(`억부 엔진 ${ev.status}/${got}/${ev.lean} 오라클 ${oe.status}/${exp}/${oe.lean}`)
    const we = a.elements.weighted
    for (const c of ev.candidates) if (!near(c.presentWeight, we[c.element])) f(`억부 presentWeight ${c.element}`)
    for (const [m, v, r] of [["weighted", oa.verdict, oa.ratio], ["threeFactor", ob.verdict, null], ["rooted", oc.verdict, oc.ratio]] as const) {
      const bm = ev.byModel?.find((x) => x.model === m)
      const o2 = O.eokbu(v, r, og)
      const g2 = bm ? [...bm.candidates].sort((x, y) => x.rank - y.rank).map((c) => c.element).join() : "없음"
      if (!bm || bm.status !== o2.status || g2 !== o2.groups.map((g) => O.groupEl(d, g)).join()) f(`억부 byModel ${m} ${g2}`)
    }
  }
  // ── 조후·통관·청탁
  const cl = O.climate(n)
  if (a.climate.T !== cl.T || a.climate.M !== cl.M || a.climate.tClass !== cl.tClass || a.climate.mClass !== cl.mClass || a.climate.needs.join() !== cl.needs.join() || a.climate.pillarsUsed !== cl.pillarsUsed) f(`조후 엔진 ${J([a.climate.T, a.climate.M, a.climate.tClass, a.climate.mClass, a.climate.needs])} 오라클 ${J([cl.T, cl.M, cl.tClass, cl.mClass, cl.needs])}`)
  const tv = a.usefulGods.views.find((v) => v.method === "tonggwan")
  if (tv) {
    const ot = O.tonggwan(n, table)
    const gt = [...tv.candidates].sort((x, y) => x.rank - y.rank).map((c) => c.element)
    if (gt.join() !== ot.join() || tv.status !== (ot.length ? "ok" : "none")) f(`통관 엔진 ${tv.status}/${gt} 오라클 ${ot}`)
  }
  const cf = a.qiFlow.clarityFlags.map((x) => x.flag).sort()
  if (cf.join() !== O.clarityFlags(n).join()) f(`clarityFlags 엔진 ${cf} 오라클 ${O.clarityFlags(n)}`)
  if (!(opt.usefulGodMethods ?? []).includes("byeongyak") && a.usefulGods.views.some((v) => v.method === "byeongyak")) f(`byeongyak 기본 켜짐`)
  if (a.usefulGods.views.some((v) => /johuTable/.test(v.source) || (v.method as string) === "johuTable")) f(`johuTable 사용`)
  // qiFlow shares·missing
  const T = oa.T
  const w = O.weightedEls(n, table)
  for (const e of Object.keys(w) as (keyof typeof w)[]) if (!near(a.qiFlow.shares[e], O.r6(w[e] / T))) f(`shares.${e}`)
  const miss = (Object.keys(w) as (keyof typeof w)[]).filter((e) => w[e] === 0)
  if (a.qiFlow.missing.join() !== miss.join()) f(`missing ${a.qiFlow.missing} 오라클 ${miss}`)

  // ── 근거 위치 무결성
  const at = (p: { pillar: string; part: string; luckIndex?: number }) => charAt(inp, p as never)
  const isNatal = (p: { pillar: string }) => ["year", "month", "day", "hour"].includes(p.pillar)
  const posOk = (p: { pillar: string; part: string }, what: string) => { if (!isNatal(p) || at(p) === undefined) f(`무결성 ${what} ${J(p)} 원국에 없는 자리`) }
  for (const m of a.strength.models) for (const b of m.basis) {
    posOk(b.position, "strength.basis")
    if (b.viaHiddenStem) { if (!hiddenOf(at(b.position) ?? "子", table).some((h) => h.stem === b.char && h.role === b.viaHiddenStem)) f(`무결성 지장간 ${b.char}@${b.viaHiddenStem} ∉ ${at(b.position)}`) }
    else if (at(b.position) !== b.char) f(`무결성 천간 ${posKey(b.position)} ${at(b.position)} ≠ ${b.char}`)
    if (b.element !== stemEl(b.char)) f(`무결성 element ${b.char}`)
  }
  for (const k of ["deukryeong", "deukji", "deukse"] as const) for (const p of fc[k].basis) posOk(p, `factors.${k}`)
  for (const r of a.strength.dayMasterRoots) { posOk(r.position, "dayMasterRoots"); if (!hiddenOf(at(r.position) ?? "子", table).some((h) => h.stem === r.stem && h.role === r.role)) f(`무결성 dayMasterRoots ${r.stem}`) }
  for (const x of a.strength.affectedBy) for (const p of x.members) posOk(p, "affectedBy")
  for (const c of a.structure.candidates) {
    if (c.pivot?.touchul) { posOk(c.pivot.touchul, "pivot.touchul"); const ch = at(c.pivot.touchul)!; if (so.match === "sameStem" ? ch !== c.pivot.stem : stemEl(ch) !== stemEl(c.pivot.stem)) f(`무결성 pivot 투출 ${ch} ≠ ${c.pivot.stem}`) }
    for (const g of [...(c.sangsin ?? []), ...(c.avoid ?? [])]) {
      for (const p of g.touchul) { posOk(p, "sangsin.touchul"); if (p.part !== "stem" || p.pillar === "day" || stemEl(at(p)!) !== g.element) f(`무결성 상신 투출 ${posKey(p)} ${at(p)} ≠ ${g.element}`) }
      for (const p of g.hiddenOnly) { posOk(p, "sangsin.hiddenOnly"); if (p.part !== "branch" || !hiddenOf(at(p)!, table).some((h) => stemEl(h.stem) === g.element)) f(`무결성 상신 지장간 ${posKey(p)} ${at(p)} 에 ${g.element} 없음`) }
    }
    for (const ob2 of c.obstructions ?? []) for (const p of ob2.members) posOk(p, "obstructions")
  }
  for (const v of a.usefulGods.views) for (const b of v.basis) for (const p of b.positions) posOk(p, `usefulGods.${v.method}.basis`)
  for (const b of a.climate.basis) { posOk(b.position, "climate.basis"); if (at(b.position) !== b.char) f(`무결성 climate ${posKey(b.position)} ${at(b.position)} ≠ ${b.char}`) }
  for (const x of a.qiFlow.clarityFlags) for (const p of x.members) { posOk(p, "clarityFlags"); if (p.part !== "stem" || p.pillar === "day") f(`무결성 clarityFlags 자리 ${posKey(p)}`) }
}

function runAll(samples: Sample[], opt: Opts) {
  const fails: string[] = []
  for (const s of samples) {
    try { check306(s, analyzeRules(s.chart, opt, s.extra), opt, fails) } catch (e) { fails.push(`${s.label}: THROW ${(e as Error).stack?.slice(0, 300)}`) }
  }
  return fails
}
const show = (f: string[], n: number) => `${f.length}건 / 표본 ${n}\n  ${f.slice(0, 15).join("\n  ")}`

describe("P3-06 기본 옵션 — 실제 2,000 + 합성 2,000", () => {
  it("computeChart 원국 2,000건(시드 20261127)", () => {
    const s = chartSamples(2000, 20261127)
    const f = runAll(s, {})
    console.log(`[p306 base] 불일치 ${show(f, s.length)}`)
    expect(f.length, show(f, s.length)).toBe(0)
  })
  it("합성 원국 2,000건(시드 777)", () => {
    const s = syntheticSamples(2000, 777, TEMPLATE)
    const f = runAll(s, {})
    console.log(`[p306 synth] 불일치 ${show(f, s.length)}`)
    expect(f.length, show(f, s.length)).toBe(0)
  })
})

const VARIANTS: Opts[] = [
  { deukjiBasis: "dayBranchAnyRoot" },
  { structureTouchul: "mainQiOnly" },
  { touchulMatch: "sameElement" },
  { strengthPrimary: "threeFactor" },
  { strengthPrimary: "rooted" },
  { hiddenStemTable: "cn-lunarjs" },
  { hiddenStemTable: "main-only" },
  { rokgeopAlternative: false },
  { specialStructures: "off" },
  { usefulGodMethods: ["eokbu", "johuClimate", "tonggwan", "byeongyak", "gyeokguk", "special"] },
  { hiddenStemTable: "cn-lunarjs", strengthPrimary: "rooted", deukjiBasis: "dayBranchAnyRoot", structureTouchul: "mainQiOnly", touchulMatch: "sameElement", rokgeopAlternative: false },
]
describe("P3-06 옵션 변형 — 각 200건(실제 100 + 합성 100)", () => {
  VARIANTS.forEach((v, i) => it(J(v), () => {
    const s = [...chartSamples(100, 7100 + i), ...syntheticSamples(100, 7300 + i, TEMPLATE)]
    const f = runAll(s, v)
    if (f.length) console.log(`[p306 ${J(v)}] 불일치 ${show(f, s.length)}`)
    expect(f.length, show(f, s.length)).toBe(0)
  }))
})
