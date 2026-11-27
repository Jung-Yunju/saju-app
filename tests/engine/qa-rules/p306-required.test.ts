// 품질검증 P3-06 — 명세 §7.1 필수 시험(결정성·반올림 경계·옵션 거부·운 무관) + §7.1-7 분포 측정 1만 건
// rules@0.4.0: §7.1-6-2 옵션 거부 추가. 연구소장 측정 요청(변경표 §3)은 rules040-measure.test.ts
import { describe, expect, it } from "vitest"
import { analyzeRules, computeChart, EngineInputError, yearPillarOf, type BirthInput, type CalendarResult, type Pillar } from "@/engine"
import { rng } from "./compare"

const TEMPLATE = computeChart({ calendar: "solar", year: 1990, month: 5, day: 5, time: { hour: 10, minute: 0 }, timezone: "Asia/Seoul", gender: "M" })
const P = (s: string): Pillar => ({ stem: s[0] as Pillar["stem"], branch: s[1] as Pillar["branch"] })
const chartOf = (s: string): CalendarResult => {
  const [y, m, d, h] = s.split(" ")
  const c = structuredClone(TEMPLATE)
  c.pillars = { year: P(y), month: P(m), day: P(d), hour: h === "-" ? null : P(h) }
  c.hourKnown = h !== "-"
  return c
}
const P306 = (a: ReturnType<typeof analyzeRules>) => JSON.stringify({ s: a.strength, st: a.structure, u: a.usefulGods, c: a.climate, q: a.qiFlow })

describe("§7.1 필수 시험", () => {
  it("1 결정성: 같은 입력 두 번 → 다섯 결과 배열 순서까지 같음, 입력 불변", () => {
    for (const s of ["甲寅 丙寅 甲辰 乙亥", "丙寅 丁酉 庚辰 -", "庚申 戊子 丙申 壬辰", "戊午 己未 戊戌 丁巳"]) {
      const c = chartOf(s), snap = structuredClone(c)
      expect(P306(analyzeRules(c))).toBe(P306(analyzeRules(structuredClone(c))))
      expect(c).toEqual(snap)
    }
  })
  it("2 반올림 경계: 사례 4 C = 135/300 = 0.45 → 중화", () => {
    const C = analyzeRules(chartOf("丙寅 庚子 壬午 丁未")).strength.models.find((m) => m.model === "rooted")!
    expect(C.ratio).toBe(0.45)
    expect(C.verdict).toBe("중화")
    expect(C.nearBoundary).toBe(true)
  })
  const bad: [string, object][] = [
    ["monthCommandBasis byDays(예약)", { monthCommandBasis: "byDays" }],
    ["combineAdjustment 다른 값", { combineAdjustment: "transformOnConditions" }],
    ["모르는 method", { usefulGodMethods: ["eokbu", "johuTable"] }],
    ["usefulGodMethods 배열 아님", { usefulGodMethods: "eokbu" }],
    ["strengthPrimary 잘못", { strengthPrimary: "mixed" }],
    ["deukjiBasis 잘못", { deukjiBasis: "allBranches" }],
    ["structureTouchul 잘못", { structureTouchul: "x" }],
    ["touchulMatch 잘못", { touchulMatch: "x" }],
    ["rokgeopAlternative 문자열", { rokgeopAlternative: "true" }],
    ["specialStructures high", { specialStructures: "full" }],
    ["favorableDefinition 잘못", { favorableDefinition: "x" }],
    // §7.1-6-2 (rules@0.4.0): 예약값·범위 밖
    ["earthRokgeop luTable(예약)", { earthRokgeop: "luTable" }],
    ["earthRokgeop 모르는 값", { earthRokgeop: "x" }],
    ["tonggwanMinShare 0", { tonggwanMinShare: 0 }],
    ["tonggwanMinShare 음수", { tonggwanMinShare: -0.1 }],
    ["tonggwanMinShare 0.5 초과", { tonggwanMinShare: 0.5000001 }],
    ["tonggwanMinShare NaN", { tonggwanMinShare: Number.NaN }],
    ["tonggwanMinShare 문자열", { tonggwanMinShare: "0.3" }],
    ["tonggwanMinRatio 0", { tonggwanMinRatio: 0 }],
    ["tonggwanMinRatio 1 초과", { tonggwanMinRatio: 1.01 }],
    ["tonggwanMinRatio Infinity", { tonggwanMinRatio: Number.POSITIVE_INFINITY }],
  ]
  for (const [name, o] of bad) it(`4 옵션 거부: ${name}`, () => {
    let err: unknown = null
    try { analyzeRules(TEMPLATE, o as never) } catch (e) { err = e }
    expect(err instanceof EngineInputError, `${name}: ${(err as Error)?.message ?? "예외 없음"}`).toBe(true)
  })
  it("§7.1-6-2 허용 경계값은 받는다: tonggwanMinShare 0.5 · tonggwanMinRatio 1 · earthRokgeop mainQiGate, 옵션 echo", () => {
    const a = analyzeRules(TEMPLATE, { tonggwanMinShare: 0.5, tonggwanMinRatio: 1, earthRokgeop: "mainQiGate" })
    expect([a.options.tonggwanMinShare, a.options.tonggwanMinRatio, a.options.earthRokgeop]).toEqual([0.5, 1, "mainQiGate"])
    const d = analyzeRules(TEMPLATE)
    expect([d.options.tonggwanMinShare, d.options.tonggwanMinRatio, d.options.earthRokgeop]).toEqual([0.25, 0.5, "mainQiGate"])
  })
  it("관찰: usefulGodMethods 중복·빈 배열 처리", () => {
    for (const m of [["eokbu", "eokbu"], []]) {
      let msg = "예외 없음"
      try { const a = analyzeRules(TEMPLATE, { usefulGodMethods: m as never }); msg += ` views=${a.usefulGods.views.map((v) => v.method)}` } catch (e) { msg = `${(e as Error).name}: ${(e as Error).message}` }
      console.log(`[관찰] usefulGodMethods=${JSON.stringify(m)} → ${msg}`)
    }
  })
  it("5·6 병약 기본 꺼짐, 조후표 미사용", () => {
    const a = analyzeRules(chartOf("癸亥 癸亥 壬子 辛丑"))
    expect(a.usefulGods.views.map((v) => v.method)).toEqual(["eokbu", "johuClimate", "tonggwan", "gyeokguk", "special"])
    expect(a.usefulGods.views.find((v) => v.method === "johuClimate")!.source).toContain("궁통보감 표 미적용")
  })
  it("운 범위 밖: 대운·세운을 넣어도 P3-06 결과가 같다", () => {
    const c = chartOf("庚申 甲申 甲寅 癸酉")
    expect(P306(analyzeRules(c, undefined, { luck: [P("丙子"), P("丁丑")], year: P("戊寅") }))).toBe(P306(analyzeRules(c)))
  })
  it("시주 모름이면 hourSensitivity, 알면 null", () => {
    expect(analyzeRules(chartOf("甲寅 丙寅 甲辰 乙亥")).strength.hourSensitivity).toBeNull()
    expect(analyzeRules(chartOf("甲寅 丙寅 甲辰 -")).strength.hourSensitivity?.byHour.length).toBe(12)
  })
})

describe("§7.1-7 분포 측정(검증 아님) — 1900~2100 무작위 원국", () => {
  it("1만 건(시각 앎) + 2천 건(시각 모름)", () => {
    const r = rng(20261128)
    const ri = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1))
    const cnt: Record<string, number> = {}
    const inc = (k: string) => { cnt[k] = (cnt[k] ?? 0) + 1 }
    let n = 0, unknown = 0, errors = 0
    const ratios: number[] = []
    while (n + unknown < 12000) {
      const known = n < 10000
      const input: BirthInput = { calendar: "solar", year: ri(1900, 2100), month: ri(1, 12), day: ri(1, 28), time: known ? { hour: ri(0, 23), minute: ri(0, 59) } : null, timezone: "Asia/Seoul", gender: r() < 0.5 ? "M" : "F" }
      let a
      try { a = analyzeRules(computeChart(input), undefined, { year: yearPillarOf(2026) }) } catch { errors++; if (errors > 50) throw new Error("오류 과다"); continue }
      if (!known) {
        unknown++
        inc(`U.hourSensitive.${a.strength.hourSensitivity!.hourSensitive}`)
        continue
      }
      n++
      const [A, B, C] = a.strength.models
      ratios.push(A.ratio!)
      inc(`A.${A.verdict}`); inc(`B.${B.verdict}`); inc(`C.${C.verdict}`)
      inc(`agreement.${a.strength.agreement}`)
      if (A.verdict !== B.verdict) inc("A≠B")
      if (A.nearBoundary) inc("A.nearBoundary")
      if (A.extreme) inc(`A.extreme.${A.extreme}`)
      if (a.strength.tableSensitive) inc("strength.tableSensitive")
      if (a.strength.tableSensitiveIncludingMainOnly) inc("strength.tableSensitiveIncludingMainOnly")
      if (a.structure.tableSensitive) inc("structure.tableSensitive")
      if (a.structure.tableSensitiveIncludingMainOnly) inc("structure.tableSensitiveIncludingMainOnly")
      const prim = a.structure.candidates.find((c) => c.role === "primary")!
      inc(`격.${prim.name}`); inc(`격확신도.${prim.confidence}`)
      for (const c of a.structure.candidates.filter((x) => x.kind === "special")) inc(`특수격.${c.name}`)
      if (a.structure.candidates.some((x) => x.kind === "special")) inc("특수격 후보 있음")
      const tg = a.usefulGods.views.find((v) => v.method === "tonggwan")!
      if (tg.status === "ok") inc("통관 성립")
      const eo = a.usefulGods.views.find((v) => v.method === "eokbu")!
      const jo = a.usefulGods.views.find((v) => v.method === "johuClimate")!
      inc(`억부.${eo.status}`); inc(`조후.${jo.status}`)
      const e1 = eo.candidates.find((c) => c.rank === 1)?.element, j1 = jo.candidates.find((c) => c.rank === 1)?.element
      if (e1 && j1) inc(e1 === j1 ? "억부=조후 rank1" : "억부≠조후 rank1")
      inc(`(가)하나만.${a.usefulGods.singlePickProposal.step}`)
      if (a.qiFlow.clarityFlags.length) inc("청탁표지 1개 이상")
      for (const f of a.qiFlow.clarityFlags) inc(`표지.${f.flag}`)
    }
    ratios.sort((x, y) => x - y)
    const q = (p: number) => ratios[Math.floor(p * (ratios.length - 1))]
    const mean = ratios.reduce((s, x) => s + x, 0) / ratios.length
    const pct = Object.fromEntries(Object.entries(cnt).sort().map(([k, v]) => [k, `${v} (${((v / (k.startsWith("U.") ? unknown : n)) * 100).toFixed(1)}%)`]))
    console.log(`[분포] 시각 앎 ${n}건 · 시각 모름 ${unknown}건 · 계산 오류 ${errors}건\n[분포] A 비율 평균 ${mean.toFixed(4)} · 5% ${q(0.05)} · 25% ${q(0.25)} · 중앙 ${q(0.5)} · 75% ${q(0.75)} · 95% ${q(0.95)}\n[분포] ${JSON.stringify(pct, null, 1)}`)
    expect(n).toBe(10000)
    expect(cnt["A.신강"] + cnt["A.중화"] + cnt["A.신약"]).toBe(10000)
  }, 300000)
})
