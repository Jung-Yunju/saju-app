// P3-06 필수 시험 — docs/knowledge/strength-structure-spec.md §7.1 (rules@0.3.0)
// 1 결정성 · 2 반올림 경계 · 3 근거 합계 검산 · 4 옵션 거부 · 5 병약 기본 꺼짐 · 6 조후표 미사용 · 6-1 통관 음성 · 7 분포 측정(기록만)
import { describe, expect, it } from "vitest"
import {
  DEFAULT_RULE_OPTIONS, EngineInputError, RULES_ENGINE_VERSION, analyzeRules, computeChart,
  type CalendarResult, type Pillar, type RuleAnalysis, type RuleOptions,
} from "@/engine"

const P = (gz: string): Pillar => ({ stem: gz[0], branch: gz[1] }) as Pillar
const chart = (y: string, m: string, d: string, h: string | null) =>
  ({ engineVersion: "calendar@test", pillars: { year: P(y), month: P(m), day: P(d), hour: h ? P(h) : null } }) as unknown as CalendarResult
const run = (gz: string, o?: Partial<RuleOptions>) => {
  const [y, m, d, h] = gz.split("/")
  return analyzeRules(chart(y, m, d, h === "-" ? null : h), o)
}
const CASES = [
  "甲寅/丙寅/甲辰/乙亥", "甲辰/丙子/丙子/丁酉", "丙寅/丁酉/庚辰/壬午", "丙寅/庚子/壬午/丁未",
  "戊寅/辛酉/甲寅/乙亥", "丙寅/丁酉/庚辰/-", "甲辰/己巳/庚戌/丙子", "庚申/戊子/丙申/壬辰",
  "戊午/己未/戊戌/丁巳", "庚辰/己丑/甲戌/戊辰", "庚申/甲申/甲寅/癸酉", "癸亥/癸亥/壬子/辛丑",
]
// 명세 §7의 S·T(u). C(rooted)는 사례 2·4만 A와 다름
const ST: [number, number][] = [[195, 315], [129, 315], [163, 315], [150, 315], [123, 315], [154, 255], [160.5, 315], [39, 315], [285.5, 315], [81, 315], [142, 315], [241, 315]]
const ST_C: Record<number, [number, number]> = { 1: [99, 285], 3: [135, 300] }
const P306 = (r: RuleAnalysis) => ({ strength: r.strength, structure: r.structure, usefulGods: r.usefulGods, climate: r.climate, qiFlow: r.qiFlow })

describe("§7.1-1 결정성", () => {
  it("12사례 × 옵션 4종: 같은 입력을 두 번 넣으면 strength·structure·usefulGods·climate·qiFlow가 배열 순서까지 같다", () => {
    const opts: (Partial<RuleOptions> | undefined)[] = [
      undefined,
      { hiddenStemTable: "cn-lunarjs", strengthPrimary: "rooted" },
      { structureTouchul: "mainQiOnly", touchulMatch: "sameElement", favorableDefinition: "secondCandidate" },
      { usefulGodMethods: ["byeongyak", "special", "eokbu"], deukjiBasis: "dayBranchAnyRoot", rokgeopAlternative: false },
    ]
    for (const gz of CASES)
      for (const o of opts) expect(JSON.stringify(P306(run(gz, o))), gz).toBe(JSON.stringify(P306(run(gz, o))))
  })
  it("computeChart 원국 200건(1900~2100, 시각 모름 섞음)에서도 같다 + 결과를 고쳐도 다음 결과에 영향 없음", () => {
    for (let k = 0; k < 200; k++) {
      const c = computeChart({ calendar: "solar", year: 1900 + k, month: (k % 12) + 1, day: (k % 28) + 1, time: k % 9 === 0 ? null : { hour: k % 24, minute: 30 }, gender: k % 2 ? "M" : "F" })
      const a = analyzeRules(c)
      const before = JSON.stringify(P306(a))
      a.strength.models[0].basis.length = 0
      a.usefulGods.views.length = 0
      expect(JSON.stringify(P306(analyzeRules(c))), String(k)).toBe(before)
    }
  })
})

describe("§7.1-2 반올림 경계", () => {
  it("사례 4의 C: 135/300 = 0.45 → '중화'(부동소수 비교를 그대로 하면 실패할 수 있음)", () => {
    const C = run(CASES[3]).strength.models.find((m) => m.model === "rooted")!
    expect(C.ratio).toBe(0.45)
    expect(C.verdict).toBe("중화")
  })
  it("사례 10 cn-lunarjs: r = 63/315 = 0.2 정확히 → extreme weak(≤ 0.20 포함)", () => {
    const t = run(CASES[9]).strength.tableSensitivity.find((x) => x.tableId === "cn-lunarjs")!
    expect(t.ratio).toBe(0.2)
    expect(t.extreme).toBe("weak")
  })
})

describe("§7.1-3 근거 합계 검산", () => {
  it("모든 사례 A·C: support points 합 = S, 전체 points 합 = T (points는 항목마다 6자리라 합은 1e-5 이내), S·T = 명세 u 값", () => {
    CASES.forEach((gz, i) => {
      const r = run(gz)
      for (const m of r.strength.models.filter((x) => x.model !== "threeFactor")) {
        const sup = m.basis.filter((b) => b.side === "support").reduce((a, b) => a + b.points, 0)
        const all = m.basis.reduce((a, b) => a + b.points, 0)
        expect(Math.abs(sup - m.support!), `${gz} ${m.model} S`).toBeLessThanOrEqual(1e-5)
        expect(Math.abs(all - m.total!), `${gz} ${m.model} T`).toBeLessThanOrEqual(1e-5)
        // points = positionWeight × hiddenWeight × rootFactor (6자리)
        for (const b of m.basis) expect(b.points).toBe(Math.round(b.positionWeight * b.hiddenWeight * b.rootFactor * 1e6) / 1e6)
        const [S, T] = m.model === "rooted" && ST_C[i] ? ST_C[i] : ST[i]
        expect(m.support! * 30, `${gz} ${m.model} S(u)`).toBeCloseTo(S, 4)
        expect(m.total! * 30, `${gz} ${m.model} T(u)`).toBeCloseTo(T, 4)
        // 일간은 self·support, 하나뿐
        expect(m.basis.filter((b) => b.group === "self")).toHaveLength(1)
      }
      // groupTotals 합 + 일간 1.0 = T(A)
      const A = r.strength.models[0]
      const gsum = Object.values(r.strength.groupTotals).reduce((a, b) => a + b, 0)
      expect(Math.abs(gsum + 1 - A.total!), gz).toBeLessThanOrEqual(1e-5)
      // 모형 A의 오행 합 = elements.weighted (같은 위치 가중 weighted-v1)
      for (const e of ["wood", "fire", "earth", "metal", "water"] as const) {
        const s = A.basis.filter((b) => b.element === e).reduce((a, b) => a + b.points, 0)
        expect(Math.abs(s - r.elements.weighted[e]), `${gz} ${e}`).toBeLessThanOrEqual(1e-5)
      }
    })
  })
})

describe("§7.1-4 옵션 거부(EngineInputError, 조용히 기본값으로 바꾸지 않음)", () => {
  const c = chart("甲寅", "丙寅", "甲辰", "乙亥")
  const bad: [string, Partial<RuleOptions>][] = [
    ["monthCommandBasis byDays(예약)", { monthCommandBasis: "byDays" }],
    ["combineAdjustment 다른 값", { combineAdjustment: "transformOnConditions" as never }],
    ["모르는 method", { usefulGodMethods: ["eokbu", "johuTable" as never] }],
    ["method 중복", { usefulGodMethods: ["eokbu", "eokbu"] }],
    ["method 배열 아님", { usefulGodMethods: "eokbu" as never }],
    ["strengthPrimary 오류", { strengthPrimary: "rootedV2" as never }],
    ["deukjiBasis 오류", { deukjiBasis: "allBranches" as never }],
    ["structureTouchul 오류", { structureTouchul: "x" as never }],
    ["touchulMatch 오류", { touchulMatch: "x" as never }],
    ["rokgeopAlternative 문자열", { rokgeopAlternative: "true" as never }],
    ["specialStructures full", { specialStructures: "full" as never }],
    ["favorableDefinition 오류", { favorableDefinition: "x" as never }],
  ]
  for (const [label, o] of bad) it(label, () => expect(() => analyzeRules(c, o)).toThrow(EngineInputError))
  it("byDays 오류 문구에 '예약'이 있다", () => {
    expect(() => analyzeRules(c, { monthCommandBasis: "byDays" })).toThrow(/예약/)
  })
  it("빈 usefulGodMethods는 허용(관점 없음), 결과 options에 사용 값 전체 기록·입력 배열과 분리", () => {
    const methods: RuleOptions["usefulGodMethods"] = ["tonggwan"]
    const r = analyzeRules(c, { usefulGodMethods: methods })
    expect(r.options.usefulGodMethods).toEqual(["tonggwan"])
    methods.push("eokbu")
    expect(r.options.usefulGodMethods).toEqual(["tonggwan"])
    expect(analyzeRules(c, { usefulGodMethods: [] }).usefulGods.views).toEqual([])
    expect(DEFAULT_RULE_OPTIONS.usefulGodMethods).toEqual(["eokbu", "johuClimate", "tonggwan", "gyeokguk", "special"])
    expect(Object.isFrozen(DEFAULT_RULE_OPTIONS.usefulGodMethods)).toBe(true)
  })
})

describe("§7.1-5 병약 기본 꺼짐", () => {
  it("기본 옵션 결과에 method 'byeongyak' view가 없다(12사례)", () => {
    for (const gz of CASES) expect(run(gz).usefulGods.views.some((v) => v.method === "byeongyak"), gz).toBe(false)
  })
  it("켜면 계산만 한다: 사례 2 수 0.438 ≥ 0.40 → 병 수, 약 토 / 사례 3 최대 금 0.381 < 0.40 → none", () => {
    const v2 = run(CASES[1], { usefulGodMethods: ["byeongyak"] }).usefulGods.views[0]
    expect(v2).toMatchObject({ method: "byeongyak", status: "ok" })
    expect(v2.candidates.map((c) => c.element)).toEqual(["earth"])
    expect(run(CASES[2], { usefulGodMethods: ["byeongyak"] }).usefulGods.views[0].status).toBe("none")
  })
})

describe("§7.1-6 조후표(johuTable) 미사용", () => {
  it("어떤 사례에서도 johuTable 출처 view·후보가 없다. 조후 관점은 climate-v1 출처이고 특정 천간을 내지 않는다", () => {
    for (const gz of CASES) {
      const u = run(gz, { usefulGodMethods: ["eokbu", "johuClimate", "tonggwan", "byeongyak", "gyeokguk", "special"] }).usefulGods
      expect(u.views.some((v) => (v.method as string) === "johuTable" || /johuTable|궁통보감 표 적용/.test(v.source)), gz).toBe(false)
      const j = u.views.find((v) => v.method === "johuClimate")!
      expect(j.source).toContain("궁통보감 표 미적용")
      expect(j.candidates.every((c) => c.element === "fire" || c.element === "water"), gz).toBe(true)
    }
  })
})

describe("§7.1-6-1 통관 음성·양성 사례", () => {
  it("사례 1·7·8·9·10·12 none, 2·3·4·5·6·11 ok", () => {
    const st = CASES.map((gz) => run(gz).usefulGods.views.find((v) => v.method === "tonggwan")!.status)
    expect(st).toEqual(["none", "ok", "ok", "ok", "ok", "ok", "none", "none", "none", "none", "ok", "none"])
  })
})

describe("버전·공개 결과", () => {
  it("engineVersion rules@0.4.0, RuleAnalysis에 P3-06 다섯 항목", () => {
    const r = run(CASES[0])
    expect(r.engineVersion).toBe("rules@0.4.0") // D-022 (QA 갱신 2026-11-28)
    expect(RULES_ENGINE_VERSION).toBe("rules@0.4.0")
    expect(Object.keys(r)).toEqual(expect.arrayContaining(["strength", "structure", "usefulGods", "climate", "qiFlow"]))
  })
  it("근거 위치는 모두 원국 위치(운 없음)이고, 시주 모름이면 hour 위치가 없다", () => {
    const r = analyzeRules(chart("丙寅", "丁酉", "庚辰", null), undefined, { luck: [P("壬午")], year: P("甲辰") })
    const ps = [
      ...r.strength.models.flatMap((m) => m.basis.map((b) => b.position)),
      ...r.strength.affectedBy.flatMap((a) => a.members),
      ...r.structure.candidates.flatMap((c) => [...(c.sangsin ?? []), ...(c.avoid ?? [])].flatMap((s) => [...s.touchul, ...s.hiddenPositions])),
      ...r.usefulGods.views.flatMap((v) => v.basis.flatMap((b) => b.positions)),
      ...r.climate.basis.map((b) => b.position),
      ...r.qiFlow.clarityFlags.flatMap((f) => f.members),
    ]
    expect(ps.length).toBeGreaterThan(0)
    expect(ps.every((p) => ["year", "month", "day"].includes(p.pillar))).toBe(true)
  })
})

describe("§7.1-7 분포 측정(검증 아님 — 기록용)", () => {
  it("computeChart 원국 2,000건(고정 시드, 1900~2100) A 판정·split·tableSensitive·통관 비율을 기록", () => {
    let seed = 20261127 >>> 0
    const rnd = () => {
      seed = (seed + 0x6d2b79f5) >>> 0
      let t = seed
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    const ri = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1))
    const N = 2000
    const cnt: Record<string, number> = {}
    const inc = (k: string) => (cnt[k] = (cnt[k] ?? 0) + 1)
    for (let i = 0; i < N; i++) {
      const c = computeChart({ calendar: "solar", year: ri(1900, 2100), month: ri(1, 12), day: ri(1, 28), time: { hour: ri(0, 23), minute: ri(0, 59) }, gender: rnd() < 0.5 ? "M" : "F" })
      const r = analyzeRules(c)
      inc(`A:${r.strength.models[0].verdict}`)
      if (r.strength.agreement === "split") inc("split")
      if (r.strength.tableSensitive) inc("tableSensitive")
      if (r.strength.models[0].nearBoundary) inc("nearBoundary")
      if (r.usefulGods.views.find((v) => v.method === "tonggwan")!.status === "ok") inc("tonggwan")
      if (r.structure.candidates.some((x) => x.kind === "special")) inc("special")
    }
    const pct = Object.fromEntries(Object.entries(cnt).sort().map(([k, v]) => [k, `${((v / N) * 100).toFixed(1)}%`]))
    console.log(`[P3-06 분포 ${N}건]`, JSON.stringify(pct))
    expect((cnt["A:신강"] ?? 0) + (cnt["A:중화"] ?? 0) + (cnt["A:신약"] ?? 0)).toBe(N)
  })
})
