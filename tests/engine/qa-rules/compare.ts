// 품질검증: 엔진 결과(RuleAnalysis)와 독립 오라클 대조기 + 고정 시드 표본 생성기
import { computeChart, yearPillarOf, type BirthInput, type CalendarResult, type Pillar, type RuleAnalysis, type RuleExtra } from "@/engine"
import {
  BRANCHES, STEMS, charAt, elementsOf, gongmangOf, hiddenOf, interactionsOf, posKey, stageOf, tenGodsOf,
  type OInput, type OInteraction, type OOpts,
} from "./oracle"

// ── 고정 시드 난수 (mulberry32)
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const ri = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1))

export interface Sample { label: string; chart: CalendarResult; extra?: RuleExtra }

/** computeChart로 만든 실제 원국. 시각 모름 약 12%, 운(extra) 붙이는 방식 3가지 섞음 */
export function chartSamples(n: number, seed: number): Sample[] {
  const r = rng(seed)
  const out: Sample[] = []
  while (out.length < n) {
    const year = ri(r, 1901, 2099), month = ri(r, 1, 12), day = ri(r, 1, 28)
    const known = r() > 0.12
    const input: BirthInput = {
      calendar: "solar", year, month, day,
      time: known ? { hour: ri(r, 0, 23), minute: ri(r, 0, 59) } : null,
      timezone: "Asia/Seoul", gender: r() < 0.5 ? "M" : "F",
    }
    const chart = computeChart(input)
    const mode = out.length % 3
    let extra: RuleExtra | undefined
    if (mode === 1) extra = { luck: chart.luck.daeun.map((d) => d.pillar) }
    else if (mode === 2) {
      const k = ri(r, 0, chart.luck.daeun.length - 2)
      extra = { luck: chart.luck.daeun.slice(k, k + ri(r, 1, 2)).map((d) => d.pillar), year: yearPillarOf(ri(r, 1950, 2080)) }
    }
    out.push({ label: `#${out.length} ${year}-${month}-${day} ${known ? `${input.time!.hour}:${input.time!.minute}` : "시각모름"} ${input.gender} extra=${mode}`, chart, extra })
  }
  return out
}

/** 60갑자 아무 조합(월주·연주 제약 없음) — 삼형·자형 같은 드문 관계를 충분히 덮기 위한 합성 원국 */
export function syntheticSamples(n: number, seed: number, template: CalendarResult): Sample[] {
  const r = rng(seed)
  const jz = (): Pillar => { const k = ri(r, 0, 59); return { stem: STEMS[k % 10], branch: BRANCHES[k % 12] } }
  const out: Sample[] = []
  for (let i = 0; i < n; i++) {
    const chart = structuredClone(template)
    chart.pillars = { year: jz(), month: jz(), day: jz(), hour: r() < 0.1 ? null : jz() }
    chart.hourKnown = chart.pillars.hour !== null
    const extra: RuleExtra | undefined = i % 2 === 0 ? undefined : { luck: Array.from({ length: ri(r, 1, 3) }, jz), year: r() < 0.7 ? jz() : undefined }
    const f = (p: Pillar | null) => (p ? p.stem + p.branch : "--")
    out.push({ label: `S${i} ${f(chart.pillars.year)} ${f(chart.pillars.month)} ${f(chart.pillars.day)} ${f(chart.pillars.hour)}${extra ? ` luck=${extra.luck!.map(f).join(",")} seun=${extra.year ? f(extra.year) : "-"}` : ""}`, chart, extra })
  }
  return out
}

export const toOInput = (s: Sample): OInput => ({
  natal: { year: s.chart.pillars.year, month: s.chart.pillars.month, day: s.chart.pillars.day, hour: s.chart.pillars.hour },
  luck: s.extra?.luck ?? [],
  seun: s.extra?.year ?? null,
})

/** QA가 기대하는 규칙 엔진 버전(엔진 상수를 가져오지 않고 직접 적는다 — 버전을 올리면 QA가 확인 후 갱신) */
// 0.3.1(2026-11-27): Q-306-1 표시 score 반올림만 바뀜 — 판정·ratio 불변은 oracle-vs-engine·p306-oracle 전수 대조로 재확인
export const EXPECTED_RULES_VERSION = "rules@0.3.1"

/** 엔진 interactionId 형식(SAJU_ENGINE.md): `${ruleId}@${위치들}`, 위치 = `{pillar}{luckIndex}.{part}`를 +로 이음 — QA 독립 계산 */
export const qaInteractionId = (x: { ruleId: string; members: { pillar: string; part: string; luckIndex?: number }[] }) => `${x.ruleId}@${x.members.map(posKey).join("+")}`
const RULE_FAMILY: [string, string][] = [["branch.threeCombine.", "threeCombine"], ["branch.directional.", "directionalCombine"], ["branch.punishment.", "punishment"]]
/** 엔진 식별자 → QA 키(`${type}@${위치들}`). 형식이 다르면 null */
export function idToQaKey(id: string): string | null {
  const at = id.indexOf("@")
  if (at < 0) return null
  const rule = id.slice(0, at), pos = id.slice(at + 1)
  const fam = RULE_FAMILY.find(([p]) => rule.startsWith(p))
  return fam ? `${fam[1]}@${pos}` : null
}

// ── 대조
export type Cat = "subsumed" | "meta" | "hidden" | "tenGods" | "tenGodsOrder" | "stages" | "interactions" | "interactionAttrs" | "gongmang" | "elements" | "integrity"
export type Fails = Record<Cat, string[]>
export const emptyFails = (): Fails => ({ subsumed: [], meta: [], hidden: [], tenGods: [], tenGodsOrder: [], stages: [], interactions: [], interactionAttrs: [], gongmang: [], elements: [], integrity: [] })

const ikey = (x: { type: string; members: { pillar: string; part: string; luckIndex?: number }[]; chars: string[]; punishmentKind?: string }) =>
  `${x.type}${x.punishmentKind ? `/${x.punishmentKind}` : ""}[${x.members.map(posKey).join(",")}](${x.chars.join("")})`
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps

export interface CompareStats { interactionTypes: Record<string, number>; positions?: number; subsumedPairs?: number }

export function compare(s: Sample, a: RuleAnalysis, o: OOpts, fails: Fails, stats?: CompareStats): void {
  const inp = toOInput(s)
  const L = s.label
  const add = (c: Cat, m: string) => fails[c].push(`${L}: ${m}`)
  const hourKnown = inp.natal.hour !== null

  // meta
  if (a.engineVersion !== EXPECTED_RULES_VERSION) add("meta", `engineVersion=${a.engineVersion}`)
  if (a.calendarEngineVersion !== s.chart.engineVersion) add("meta", `calendarEngineVersion=${a.calendarEngineVersion}`)
  if (JSON.stringify(a.omitted) !== JSON.stringify(hourKnown ? [] : ["hour"])) add("meta", `omitted=${JSON.stringify(a.omitted)}`)
  for (const k of Object.keys(o) as (keyof OOpts)[]) if (a.options[k] !== o[k]) add("meta", `options.${k}=${String(a.options[k])} 기대 ${String(o[k])}`)
  const d = inp.natal.day.stem
  if (a.dayMaster.stem !== d) add("meta", `dayMaster.stem`)
  if (JSON.stringify(a.source.natal) !== JSON.stringify(inp.natal)) add("meta", `source.natal 불일치`)
  if (JSON.stringify(a.source.luck) !== JSON.stringify(inp.luck)) add("meta", `source.luck 불일치`)
  if (JSON.stringify(a.source.seun) !== JSON.stringify(inp.seun)) add("meta", `source.seun 불일치`)

  // 지장간
  if (a.hiddenStems.tableId !== o.hiddenStemTable) add("hidden", `tableId=${a.hiddenStems.tableId}`)
  for (const k of ["year", "month", "day", "hour"] as const) {
    const p = inp.natal[k]
    const got = a.hiddenStems.pillars[k]
    if (!p) { if (got !== null) add("hidden", `${k}: 시주 모름인데 ${JSON.stringify(got)}`); continue }
    const exp = hiddenOf(p.branch, o.hiddenStemTable)
    const sig = (h: { stem: string; role: string; days: number | null; weight: number }) => `${h.stem}/${h.role}/${h.days}/${h.weight.toFixed(9)}`
    const gs = (got ?? []).map(sig).join(" "), es = exp.map(sig).join(" ")
    if (gs !== es) add("hidden", `${k}(${p.branch}) 엔진[${gs}] 오라클[${es}]`)
  }

  // 십성
  const tg = tenGodsOf(inp, o)
  const tsig = (x: { position: { pillar: string; part: string; luckIndex?: number }; char: string; tenGod: string; viaHiddenStem?: string }) => `${posKey(x.position)}:${x.char}:${x.tenGod}${x.viaHiddenStem ? `@${x.viaHiddenStem}` : ""}`
  const gotT = a.tenGods.map(tsig), expT = tg.map(tsig)
  const gSorted = [...gotT].sort().join("|"), eSorted = [...expT].sort().join("|")
  if (gSorted !== eSorted) {
    const miss = expT.filter((x) => !gotT.includes(x)), extra = gotT.filter((x) => !expT.includes(x))
    add("tenGods", `누락[${miss.join(" ")}] 초과[${extra.join(" ")}]`)
  } else if (gotT.join("|") !== expT.join("|")) add("tenGodsOrder", `순서 다름 엔진[${gotT.join(" ")}]`)

  // 12운성
  const stagesSeen = new Set<string>()
  for (const h of a.twelveStages) {
    const at = charAt(inp, h.position)
    if (at !== h.branch) add("integrity", `12운성 position ${posKey(h.position)} 글자 ${at} ≠ branch ${h.branch}`)
    if (h.position.part !== "branch") add("integrity", `12운성 position.part=${h.position.part}`)
    const expStem = h.basis === "dayStem" ? d : charAt(inp, { ...h.position, part: "stem" })
    if (h.stem !== expStem) add("stages", `${h.basis}@${posKey(h.position)} stem=${h.stem} 기대 ${expStem}`)
    const exp = stageOf(h.stem, h.branch, o.twelveStagesYin, o.earthStages)
    if (h.stage !== exp) add("stages", `${h.basis} ${h.stem}→${h.branch} 엔진 ${h.stage} 오라클 ${exp}`)
    if (h.tableId !== `twelve-stages:${o.twelveStagesYin}/${o.earthStages}`) add("stages", `tableId=${h.tableId}`)
    const sk = `${h.basis}@${posKey(h.position)}`
    if (stagesSeen.has(sk)) add("stages", `중복 ${sk}`)
    stagesSeen.add(sk)
  }
  for (const k of ["year", "month", "day", "hour"] as const) {
    if (!inp.natal[k]) {
      if ([...stagesSeen].some((x) => x.includes(`@${k}.`))) add("stages", `시주 모름인데 ${k} 12운성 있음`)
      continue
    }
    if (!stagesSeen.has(`dayStem@${k}.branch`)) add("stages", `봉법 ${k} 누락`)
    if (k !== "day" && !stagesSeen.has(`ownPillar@${k}.branch`)) add("stages", `좌법 ${k} 누락`)
  }

  // 관계
  const expI = interactionsOf(inp, o)
  if (stats) for (const x of expI) stats.interactionTypes[x.type + (x.punishmentKind ? `/${x.punishmentKind}` : "") + (x.partial ? "/partial" : "") + `/${x.scope}`] = (stats.interactionTypes[x.type + (x.punishmentKind ? `/${x.punishmentKind}` : "") + (x.partial ? "/partial" : "") + `/${x.scope}`] ?? 0) + 1
  const gotMap = new Map<string, number>(), expMap = new Map<string, OInteraction[]>()
  for (const x of a.interactions) gotMap.set(ikey(x), (gotMap.get(ikey(x)) ?? 0) + 1)
  for (const x of expI) expMap.set(ikey(x), [...(expMap.get(ikey(x)) ?? []), x])
  const missing: string[] = [], over: string[] = []
  for (const [k, v] of expMap) { const g = gotMap.get(k) ?? 0; if (g < v.length) missing.push(`${k}×${v.length - g}`) }
  for (const [k, g] of gotMap) { const e = expMap.get(k)?.length ?? 0; if (g > e) over.push(`${k}×${g - e}`) }
  if (missing.length || over.length) add("interactions", `누락[${missing.join(" ")}] 초과[${over.join(" ")}]`)
  for (const x of a.interactions) {
    const e = expMap.get(ikey(x))?.[0]
    // 근거 무결성
    x.members.forEach((m, i) => {
      const at = charAt(inp, m)
      if (at === undefined || at !== x.chars[i]) add("integrity", `${x.type} member ${posKey(m)} 실제 ${at} ≠ chars ${x.chars[i]}`)
    })
    if (!e) continue
    const attrs: (keyof OInteraction)[] = ["resultElement", "complete", "partial", "punishmentKind", "withKing", "adjacent", "scope"]
    for (const f of attrs) {
      const gv = (x as unknown as Record<string, unknown>)[f], ev = (e as unknown as Record<string, unknown>)[f]
      if (ev === undefined) continue // 오라클이 값을 정하지 않은 필드(명세 공백)는 비교하지 않음
      // complete/partial: 명세는 "세 글자면 complete: true", "두 글자 기록이면 partial: true"만 정함 → 없음(undefined)과 false를 같게 본다
      if ((f === "complete" || f === "partial") && (gv ?? false) === (ev ?? false)) continue
      if (gv !== ev) add("interactionAttrs", `${ikey(x)} ${f}=${String(gv)} 기대 ${String(ev)}`)
    }
    if ((x.type === "stemCombine" || x.type === "sixCombine") && x.transformed !== null) add("interactionAttrs", `${ikey(x)} transformed=${String(x.transformed)}`)
    if (!x.ruleId || typeof x.ruleId !== "string") add("interactionAttrs", `${ikey(x)} ruleId 없음`)
    // D-019 subsumedBy: 엔진 식별자를 QA 키로 바꿔 오라클과 비교
    const gotSub = (x.subsumedBy ?? []).map((id) => idToQaKey(id) ?? `?${id}`).sort().join(" ")
    const expSub = (e.subsumedBy ?? []).join(" ")
    if (gotSub !== expSub) add("subsumed", `${ikey(x)} subsumedBy 엔진[${gotSub}] 오라클[${expSub}]`)
    if (x.subsumedBy && x.subsumedBy.length === 0) add("subsumed", `${ikey(x)} subsumedBy 빈 배열(없으면 필드 생략이 계약)`)
  }
  // 식별자 무결성: 유일성 + subsumedBy가 가리키는 관계가 결과 안에 실제로 있음
  const ids = a.interactions.map(qaInteractionId)
  if (new Set(ids).size !== ids.length) add("subsumed", `interactionId 중복 ${ids.length - new Set(ids).size}개`)
  const idSet = new Set(ids)
  for (const x of a.interactions) for (const id of x.subsumedBy ?? []) {
    if (!idSet.has(id)) add("integrity", `subsumedBy ${id}가 결과 관계 목록에 없음`)
    else {
      const t = a.interactions[ids.indexOf(id)]
      if (t.members.length !== 3 || !x.members.every((m) => t.members.some((tm) => posKey(tm) === posKey(m)))) add("integrity", `subsumedBy ${id}가 ${ikey(x)}의 두 위치를 포함하지 않음`)
    }
  }
  if (stats) for (const x of expI) if (x.subsumedBy) stats.subsumedPairs = (stats.subsumedPairs ?? 0) + 1

  // 공망
  const gm = gongmangOf(inp, o)
  const gsig = (g: { basis: string; basisPillar: Pillar; xunHead: Pillar; empty: string[]; hits: { pillar: string; part: string; luckIndex?: number }[] }) =>
    `${g.basis}:${g.basisPillar.stem}${g.basisPillar.branch}:${g.xunHead.stem}${g.xunHead.branch}:${g.empty.join("")}:[${g.hits.map(posKey).join(",")}]`
  const gg = a.gongmang.map(gsig).join(" ; "), ge = gm.map(gsig).join(" ; ")
  if (gg !== ge) add("gongmang", `엔진 ${gg} / 오라클 ${ge}`)
  for (const g of a.gongmang) for (const h of g.hits) {
    const at = charAt(inp, h)
    if (!at || !g.empty.includes(at as never)) add("integrity", `공망 hit ${posKey(h)} 글자 ${at} ∉ ${g.empty.join("")}`)
  }

  // 오행
  const el = elementsOf(inp, o)
  for (const k of Object.keys(el.counts) as (keyof typeof el.counts)[]) {
    if (a.elements.counts[k] !== el.counts[k]) add("elements", `counts.${k} 엔진 ${a.elements.counts[k]} 오라클 ${el.counts[k]}`)
    if (!near(a.elements.weighted[k], el.weighted[k], 2e-6)) add("elements", `weighted.${k} 엔진 ${a.elements.weighted[k]} 오라클 ${el.weighted[k]}`)
  }
  if (a.elements.yinYang.yang !== el.yinYang.yang || a.elements.yinYang.yin !== el.yinYang.yin) add("elements", `yinYang 엔진 ${JSON.stringify(a.elements.yinYang)} 오라클 ${JSON.stringify(el.yinYang)}`)
  if (a.elements.yinYang.branchYinYang !== o.branchYinYang) add("elements", `yinYang.branchYinYang`)
  if (a.elements.hiddenStemTable !== o.hiddenStemTable) add("elements", `hiddenStemTable`)
  const pw = a.elements.positionWeights
  if (pw.stem !== 1 || pw.yearBranch !== 1 || pw.monthBranch !== 3 || pw.dayBranch !== 1.5 || pw.hourBranch !== 1) add("elements", `positionWeights ${JSON.stringify(pw)}`)

  if (stats) stats.positions = (stats.positions ?? 0) + a.tenGods.length + a.twelveStages.length + a.interactions.reduce((n, x) => n + x.members.length, 0) + a.gongmang.reduce((n, g) => n + g.hits.length, 0)
  // 십성 근거 무결성
  for (const t of a.tenGods) {
    const at = charAt(inp, t.position)
    if (at === undefined) { add("integrity", `십성 position ${posKey(t.position)} 없는 자리`); continue }
    if (t.position.pillar === "day" && t.position.part === "stem") add("integrity", `일간이 십성 목록에 있음`)
    if (t.viaHiddenStem) {
      if (t.position.part !== "branch") add("integrity", `지장간 십성 part=${t.position.part}`)
      const hs = hiddenOf(at, o.hiddenStemTable)
      if (!hs.some((h) => h.stem === t.char && h.role === t.viaHiddenStem)) add("integrity", `지장간 ${t.char}@${t.viaHiddenStem}가 ${posKey(t.position)}(${at})에 없음`)
      const eng = t.position.pillar === "daeun" || t.position.pillar === "seun" ? null : a.hiddenStems.pillars[t.position.pillar as "year"]
      if (eng && !eng.some((h) => h.stem === t.char && h.role === t.viaHiddenStem)) add("integrity", `지장간 십성 ${t.char}이 엔진 hiddenStems.${t.position.pillar}에 없음`)
    } else if (at !== t.char) add("integrity", `십성 ${posKey(t.position)} 실제 ${at} ≠ char ${t.char}`)
    if ((t.position.pillar === "daeun") !== (t.position.luckIndex !== undefined)) add("integrity", `luckIndex 규약 위반 ${JSON.stringify(t.position)}`)
  }
  for (const x of a.interactions) for (const m of x.members) if ((m.pillar === "daeun") !== (m.luckIndex !== undefined)) add("integrity", `luckIndex 규약 위반 ${JSON.stringify(m)}`)
}

export function summarize(fails: Fails, total: number): string {
  const lines: string[] = []
  for (const [k, v] of Object.entries(fails)) if (v.length) lines.push(`[${k}] ${v.length}건 (표본 ${total})\n    ${v.slice(0, 8).join("\n    ")}${v.length > 8 ? `\n    … 외 ${v.length - 8}건` : ""}`)
  return lines.join("\n")
}
