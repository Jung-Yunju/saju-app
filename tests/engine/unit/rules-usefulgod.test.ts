// 용신(관점별)·희기신·간이 조후·기세 테스트 — src/engine/rules/{usefulGod,climate,qiFlow}.ts (rules@0.3.0, P3-06)
// 기대값: docs/knowledge/strength-structure-spec.md §3~§5 규칙과 §7 사례 1~12 손계산 값. 구현 결과 복사 아님.
// 명세 본문과 다르게 판정한 곳(사례 7 clarityFlags, 사례 11 agreement)은 해당 테스트 주석에 손계산 근거를 적었다.
import { describe, expect, it } from "vitest"
import { analyzeRules, type CalendarResult, type Element, type Pillar, type RuleOptions, type UsefulGodView } from "@/engine"

const P = (gz: string): Pillar => ({ stem: gz[0], branch: gz[1] }) as Pillar
const chart = (y: string, m: string, d: string, h: string | null) =>
  ({ engineVersion: "calendar@test", pillars: { year: P(y), month: P(m), day: P(d), hour: h ? P(h) : null } }) as unknown as CalendarResult
const run = (gz: string, o?: Partial<RuleOptions>) => {
  const [y, m, d, h] = gz.split("/")
  return analyzeRules(chart(y, m, d, h === "-" ? null : h), o)
}
const GZ: Record<number, string> = {
  1: "甲寅/丙寅/甲辰/乙亥", 2: "甲辰/丙子/丙子/丁酉", 3: "丙寅/丁酉/庚辰/壬午", 4: "丙寅/庚子/壬午/丁未",
  5: "戊寅/辛酉/甲寅/乙亥", 6: "丙寅/丁酉/庚辰/-", 7: "甲辰/己巳/庚戌/丙子", 8: "庚申/戊子/丙申/壬辰",
  9: "戊午/己未/戊戌/丁巳", 10: "庚辰/己丑/甲戌/戊辰", 11: "庚申/甲申/甲寅/癸酉", 12: "癸亥/癸亥/壬子/辛丑",
}
const view = (n: number, m: UsefulGodView["method"], o?: Partial<RuleOptions>) => run(GZ[n], o).usefulGods.views.find((v) => v.method === m)!
const els = (v: UsefulGodView) => v.candidates.map((c) => c.element)
const W = "wood", F = "fire", E = "earth", M = "metal", Wt = "water"

describe("§3.1 억부", () => {
  const EXP: Record<number, { status: "ok" | "balanced"; els?: Element[]; lean?: "weak" | "strong"; rule: string }> = {
    1: { status: "ok", els: [M, F, E], rule: "ug.eokbu.strong.bigyeop" },
    2: { status: "ok", els: [W, F], rule: "ug.eokbu.weak.gwansal" },
    3: { status: "balanced", lean: "strong", rule: "ug.eokbu.balanced" },
    4: { status: "balanced", lean: "weak", rule: "ug.eokbu.balanced" }, // r 0.476 < 0.5 → weak (명세 §3.1 규칙)
    5: { status: "ok", els: [Wt, W], rule: "ug.eokbu.weak.gwansal" },
    6: { status: "ok", els: [F, Wt, W], rule: "ug.eokbu.strong.bigyeop" },
    8: { status: "ok", els: [W, F], rule: "ug.eokbu.weak.gwansal" },
    9: { status: "ok", els: [W, M, Wt], rule: "ug.eokbu.strong.bigyeop" },
    10: { status: "ok", els: [W, Wt], rule: "ug.eokbu.weak.jaeseong" },
    11: { status: "balanced", lean: "weak", rule: "ug.eokbu.balanced" },
    12: { status: "ok", els: [E, W, F], rule: "ug.eokbu.strong.bigyeop" },
  }
  for (const [n, e] of Object.entries(EXP))
    it(`사례 ${n}: ${e.status} ${e.els?.join("→") ?? e.lean}`, () => {
      const v = view(Number(n), "eokbu")
      expect(v.status).toBe(e.status)
      expect(els(v)).toEqual(e.els ?? [])
      if (e.lean) expect(v.lean).toBe(e.lean)
      expect(v.basis[0].ruleId).toBe(e.rule)
      expect(v.candidates.map((c) => c.rank)).toEqual(v.candidates.map((_, i) => i + 1))
    })

  it("사례 1: rank 1 금(관살)의 presentWeight 0 — 원국에 없는 오행을 뒤로 미루지 않음", () => {
    expect(view(1, "eokbu").candidates[0]).toEqual({ element: "metal", group: "gwansal", rank: 1, presentWeight: 0 })
  })

  it("byModel: 사례 3 B 비겁(90) > 인성(43) → 비겁형 화→수→목 · 사례 4 B 재성 최대 → 수→금 · 사례 5 B 금→화→토 · 사례 11 B 관살 → 수→목", () => {
    const b = (n: number) => view(n, "eokbu").byModel!.find((x) => x.model === "threeFactor")!
    expect([b(3).status, b(3).candidates.map((c) => c.element)]).toEqual(["ok", [F, Wt, W]])
    expect(b(4).candidates.map((c) => c.element)).toEqual([Wt, M])
    expect(b(5).candidates.map((c) => c.element)).toEqual([M, F, E])
    expect(b(11).candidates.map((c) => c.element)).toEqual([Wt, W])
    expect(view(3, "eokbu").byModel!.map((x) => x.model)).toEqual(["weighted", "threeFactor", "rooted"])
  })

  it("사례 5: A(대표) 수 vs B 금 — rank 1이 정반대, 대표값은 strengthPrimary를 따른다", () => {
    expect(view(5, "eokbu").candidates[0].element).toBe("water")
    expect(view(5, "eokbu", { strengthPrimary: "threeFactor" }).candidates[0].element).toBe("metal")
    expect(view(5, "eokbu").confidence).toBe("low") // split
    expect(view(1, "eokbu").confidence).toBe("medium") // all
  })
})

describe("§3.7 희기신(관점별, rank 1 기준)", () => {
  it("사례 2 generationCycle(U=목): 희 수 · 기 금 · 구 토 · 한 화 / secondCandidate면 희 = 화(2순위)", () => {
    expect(view(2, "eokbu").favorable).toEqual({ definition: "generationCycle", xi: "water", ji: "metal", gu: "earth", han: "fire" })
    const s = view(2, "eokbu", { favorableDefinition: "secondCandidate" }).favorable!
    expect(s.xi).toBe("fire")
    expect([s.ji, s.gu]).toEqual(["metal", "earth"])
    // 엔진 해석(⚑): 2순위가 원래 한신(화)이면 한신 자리에 원래 희신(수)을 둔다 — 연구소장 확인 대기
    expect(s.han).toBe("water")
  })
  it("사례 5(A, U=수): 희 금(= 관살, 문제 오행)", () => {
    expect(view(5, "eokbu").favorable!.xi).toBe("metal")
  })
  it("희기신은 관점마다 따로: 사례 2 조후(U=화) 희 목 · 기 수", () => {
    expect(view(2, "johuClimate").favorable).toMatchObject({ xi: "wood", ji: "water", gu: "metal", han: "earth" })
  })
  it("후보가 없는 관점(balanced·none)은 favorable 없음", () => {
    expect(view(4, "eokbu").favorable).toBeUndefined()
    expect(view(1, "tonggwan").favorable).toBeUndefined()
  })
})

describe("§3.3 통관", () => {
  const POS: Record<number, [Element, Element, Element, number, number, number]> = {
    // [극하는 X, 맞은 Y, 통관 Z, X 비율, Y 비율, 작은÷큰] — 명세 수치(%)를 6자리 손계산으로
    2: [Wt, F, W, 138 / 315, 90 / 315, 90 / 138],
    3: [F, M, E, 88 / 315, 120 / 315, 88 / 120],
    4: [Wt, F, W, 120 / 315, 107.5 / 315, 107.5 / 120],
    5: [M, W, Wt, 120 / 315, 107 / 315, 107 / 120],
    6: [F, M, E, 67 / 255, 120 / 255, 67 / 120],
    11: [M, W, Wt, 124 / 315, 84 / 315, 84 / 124],
  }
  const r6 = (x: number) => Math.round(x * 1e6) / 1e6
  for (const [n, [x, y, z, xs, ys, bal]] of Object.entries(POS))
    it(`사례 ${n}: ${x}가 ${y}를 극함 → 통관 ${z}`, () => {
      const v = view(Number(n), "tonggwan")
      expect(v.status).toBe("ok")
      expect(els(v)[0]).toBe(z)
      expect(v.basis[0].ruleId).toBe(`ug.tonggwan.${x}>${y}`)
      expect(v.basis[0].values).toMatchObject({ attackerShare: r6(xs), targetShare: r6(ys), balance: r6(bal) })
    })
  it("사례 11: 통관 수의 presentWeight 58u", () => {
    expect(view(11, "tonggwan").candidates[0].presentWeight * 30).toBeCloseTo(58, 4)
  })
  it("음성 사례 1·7·8·9·10·12 → status none (§7.1 6-1). 사례 7은 금 20.5% < 25%", () => {
    for (const n of [1, 7, 8, 9, 10, 12]) expect(view(n, "tonggwan").status, `사례 ${n}`).toBe("none")
    expect(run(GZ[7]).qiFlow.shares.metal).toBe(Math.round((64.5 / 315) * 1e6) / 1e6)
  })
})

describe("§4 간이 조후 climate-v1", () => {
  const EXP: Record<number, [number, string, number, string, string[]]> = {
    1: [-1.5, "한", 0.5, "중", ["warm"]],
    2: [-1.5, "한", 2, "습강", ["warm", "dry"]],
    3: [1, "난", -1, "조", ["cool", "moisten"]], // 경계 포함 확인
    4: [0, "중", 0, "중", []], // 겨울생이어도 조후 필요 없음
    5: [-1.5, "한", 0.5, "중", ["warm"]],
    6: [0.5, "중", -0.5, "중", []], // 시주 모름(세 기둥)
    7: [0.5, "중", -0.5, "중", []],
    8: [-1, "한", 2.5, "습강", ["warm", "dry"]], // T −1 경계 포함
    9: [4, "열강", -3.5, "조강", ["cool", "moisten"]],
    10: [-2, "한강", 1.5, "습", ["warm", "dry"]], // T −2 경계 포함
    11: [0.5, "중", 0.5, "중", []],
    12: [-5, "한강", 4.5, "습강", ["warm", "dry"]],
  }
  for (const [n, [T, tc, Mv, mc, needs]] of Object.entries(EXP))
    it(`사례 ${n}: T ${T}(${tc}) M ${Mv}(${mc}) → [${needs.join(",")}]`, () => {
      const c = run(GZ[Number(n)]).climate
      expect([c.T, c.tClass, c.M, c.mClass, c.needs]).toEqual([T, tc, Mv, mc, needs])
      expect(c.ruleId).toBe("climate.v1")
      expect(c.pillarsUsed).toBe(Number(n) === 6 ? 3 : 4)
      // 근거 합 = 지수
      expect(c.basis.reduce((a, b) => a + b.dT, 0)).toBeCloseTo(T, 9)
      expect(c.basis.reduce((a, b) => a + b.dM, 0)).toBeCloseTo(Mv, 9)
    })

  it("조후 관점 오행: warm·dry → 화, cool·moisten → 수. 출처 문구에 '궁통보감 표 미적용'", () => {
    const e = (n: number) => els(view(n, "johuClimate"))
    expect([e(1), e(2), e(3), e(4), e(8), e(9), e(10), e(12)]).toEqual([[F], [F], [Wt], [], [F], [Wt], [F], [F]])
    expect(view(4, "johuClimate").status).toBe("none")
    const v = view(1, "johuClimate")
    expect(v.source).toBe("climate-v1 (연구소장 설계, 궁통보감 표 미적용)")
    expect(run(GZ[1]).climate.source).toBe(v.source)
  })

  it("두 방향이 같은 오행: 丙子/丙子/丙午/丙午 — T = −2 + 0.5×(−2+2+2) + 0.5×4 = 1(난) cool, M = 2 + 0.5×(2−2−2) − 0.5×4 = −1(조) moisten → 수 하나", () => {
    const r = run("丙子/丙子/丙午/丙午")
    expect([r.climate.T, r.climate.M, r.climate.needs]).toEqual([1, -1, ["cool", "moisten"]])
    expect(els(r.usefulGods.views.find((v) => v.method === "johuClimate")!)).toEqual([Wt])
  })
  it("춥고 마름(섞인 방향) — 절댓값이 큰 축 먼저: 庚戌/戊寅/甲戌/甲戌 T = −1(한) warm, M = 0 + 0.5×(−1−1−1) = −1.5(조) moisten → |M| > |T| → 수 → 화", () => {
    const r = run("庚戌/戊寅/甲戌/甲戌")
    expect([r.climate.T, r.climate.M, r.climate.needs]).toEqual([-1, -1.5, ["warm", "moisten"]])
    expect(els(r.usefulGods.views.find((v) => v.method === "johuClimate")!)).toEqual([Wt, F])
  })
  it("춥고 마름 — 온도 축이 더 크면 화 먼저: 甲寅/戊寅/甲戌/甲戌 T = −1 + 0.5×(−1) = −1.5, M = 0.5×(0−1−1) = −1 → 화 → 수", () => {
    const r = run("甲寅/戊寅/甲戌/甲戌")
    expect([r.climate.T, r.climate.M]).toEqual([-1.5, -1])
    expect(els(r.usefulGods.views.find((v) => v.method === "johuClimate")!)).toEqual([F, Wt])
  })
})

describe("§3.5·§3.6 격국 상신 관점·특수격 관점", () => {
  it("격국 관점: 사례 2 정관격 상신 금 → 목 / 사례 12 건록격 상신 없음 → none", () => {
    expect(els(view(2, "gyeokguk"))).toEqual([M, W])
    expect(view(2, "gyeokguk").confidence).toBe("medium")
    expect(view(12, "gyeokguk").status).toBe("none")
  })
  it("사례 9: 월겁격(주 후보) 상신 없음 → 정인격 대체 후보(low)의 상신 관살(목)이 rank 1이 되므로 관점 확신도 low", () => {
    const v = view(9, "gyeokguk")
    expect(els(v)).toEqual([W])
    expect(v.confidence).toBe("low")
  })
  it("특수격 관점: 사례 8 종살 → 수(관살)·금(재성, 생살) · 사례 9 종왕 → 토·화 · 사례 10 화토 → 토·화. 모두 low·reversesUsefulGod", () => {
    for (const [n, e] of [[8, [Wt, M]], [9, [E, F]], [10, [E, F]]] as const) {
      const v = view(n, "special")
      expect(els(v), `사례 ${n}`).toEqual(e)
      expect(v).toMatchObject({ status: "ok", confidence: "low", reversesUsefulGod: true })
    }
    expect(view(1, "special").status).toBe("none")
  })
  it("사례 8: 억부(목) vs 특수격(수) 정반대 / 사례 9: 억부 목, 특수격 토, 조후 수 — 세 관점이 모두 다름", () => {
    expect([els(view(8, "eokbu"))[0], els(view(8, "special"))[0]]).toEqual([W, Wt])
    expect([els(view(9, "eokbu"))[0], els(view(9, "special"))[0], els(view(9, "johuClimate"))[0]]).toEqual([W, E, Wt])
  })
})

describe("§3.8 관점 병기·agreement·(가) 제안 규칙", () => {
  it("displayPolicy parallel, views 순서 = usefulGodMethods", () => {
    const u = run(GZ[1]).usefulGods
    expect(u.displayPolicy).toBe("parallel")
    expect(u.views.map((v) => v.method)).toEqual(["eokbu", "johuClimate", "tonggwan", "gyeokguk", "special"])
    expect(run(GZ[1], { usefulGodMethods: ["tonggwan", "eokbu"] }).usefulGods.views.map((v) => v.method)).toEqual(["tonggwan", "eokbu"])
  })
  it("사례 11: 수 = 통관 rank 1. 명세 본문은 '통관·억부(B)'라 적었으나 억부 view의 대표 rank 1은 A(balanced, 없음)라 agreement에는 통관만 들어간다. B의 rank 1 수는 byModel에서 확인", () => {
    const u = run(GZ[11]).usefulGods
    expect(u.agreement.find((a) => a.element === "water")!.methods).toEqual(["tonggwan"])
    expect(u.views.find((v) => v.method === "eokbu")!.byModel!.find((b) => b.model === "threeFactor")!.candidates[0].element).toBe("water")
  })
  it("사례 2: 목 = 억부·통관 두 관점의 rank 1", () => {
    expect(run(GZ[2]).usefulGods.agreement[0]).toEqual({ element: "wood", methods: ["eokbu", "tonggwan"] })
  })
  it("(가) 제안: 사례 4 → 조후 극단 아님 → 억부 balanced → 조후 없음 → 용신 없음(null)", () => {
    expect(run(GZ[4]).usefulGods.singlePickProposal).toEqual({ element: null, step: "none", ruleId: "ug.singlePick.proposal-ga" })
  })
  it("(가) 제안: 사례 9 열강 → 수 · 사례 12 한강 → 화 · 사례 8 특수격 제외(습강 → 화, 특수격 수 아님)", () => {
    expect(run(GZ[9]).usefulGods.singlePickProposal).toMatchObject({ element: "water", step: "johuExtreme" })
    expect(run(GZ[12]).usefulGods.singlePickProposal).toMatchObject({ element: "fire", step: "johuExtreme" })
    expect(run(GZ[8]).usefulGods.singlePickProposal).toMatchObject({ element: "fire", step: "johuExtreme" })
  })
  it("(가) 제안: 사례 11 split + A nearBoundary → 억부 건너뜀(어차피 balanced) → 조후 없음 → null / 사례 5 → 억부 수", () => {
    expect(run(GZ[11]).usefulGods.singlePickProposal.element).toBeNull()
    expect(run(GZ[5]).usefulGods.singlePickProposal).toMatchObject({ element: "water", step: "eokbu" })
  })
})

describe("§5 기세 qiFlow", () => {
  it("사례 1: shares 목 0.553968 · 화 0.184127 · 토 0.196825 · 수 0.065079 · 금 0 → missing [금], 연쇄 목→화→토", () => {
    const q = run(GZ[1]).qiFlow
    expect(q.shares).toEqual({ wood: 0.553968, fire: 0.184127, earth: 0.196825, metal: 0, water: 0.065079 })
    expect(q.missing).toEqual(["metal"])
    expect(q.flowChain).toEqual({ elements: ["wood", "fire", "earth"], circular: false })
    expect(q.dominant).toEqual({ element: "wood", share: 0.553968 })
    const sq = 0.553968 ** 2 + 0.184127 ** 2 + 0.196825 ** 2 + 0.065079 ** 2
    expect(q.concentration).toBe(Math.round(sq * 1e6) / 1e6)
    // 甲 일간: 식상 화 0.18 ≥ 0.10, 재성 토 0.20 ≥ 0.10, 인성 수 0.065 < 0.10
    expect(q.dayMasterFlow).toEqual({ toOutput: true, toWealth: true, fromResource: false })
  })
  it("사례 11: 금 0.393651 · 목 0.266667 · 수 0.184127 · 토 0.122222 · 화 0.033333 → 연쇄 토→금→수→목(4), missing 없음, dominant 금", () => {
    const q = run(GZ[11]).qiFlow
    expect(q.shares).toEqual({ wood: 0.266667, fire: 0.033333, earth: 0.122222, metal: 0.393651, water: 0.184127 })
    expect(q.flowChain).toEqual({ elements: ["earth", "metal", "water", "wood"], circular: false })
    expect(q.missing).toEqual([])
    expect(q.dominant.element).toBe("metal")
  })
  it("사례 12: 수 0.660317 · 토 0.146032 · 금 0.104762 · 목 0.088889 · 화 0 → missing [화], 연쇄 토→금→수(3)", () => {
    const q = run(GZ[12]).qiFlow
    expect(q.shares).toEqual({ wood: 0.088889, fire: 0, earth: 0.146032, metal: 0.104762, water: 0.660317 })
    expect(q.missing).toEqual(["fire"])
    expect(q.flowChain.elements).toEqual(["earth", "metal", "water"])
  })
  it("다섯 오행이 모두 0.10 이상이면 circular: 사례 7(목 .124 화 .262 토 .305 금 .205 수 .105)", () => {
    expect(run(GZ[7]).qiFlow.flowChain).toEqual({ elements: ["wood", "fire", "earth", "metal", "water"], circular: true })
  })
  it("clarityFlags 사례 3: 관살혼잡(丙 편관 연간, 丁 정관 월간)", () => {
    expect(run(GZ[3]).qiFlow.clarityFlags).toEqual([
      { flag: "관살혼잡", members: [{ pillar: "year", part: "stem" }, { pillar: "month", part: "stem" }], ruleId: "qi.clarity.gwansalHonjap" },
    ])
  })
  it("clarityFlags 사례 7: 혼잡류 표지(관살혼잡·상관견관·효신탈식·비겁쟁재) 없음. 단 §5.1 표 '재성파인(재성 천간과 인성 천간이 이웃한 기둥)'에 따르면 연간 甲(편재)·월간 己(정인)가 이웃이라 표지가 선다 — 명세 사례 본문의 '없음'은 이 줄을 빠뜨린 손계산으로 판정", () => {
    const f = run(GZ[7]).qiFlow.clarityFlags
    expect(f.map((x) => x.flag)).toEqual(["재성파인"])
    expect(f[0].members).toEqual([{ pillar: "year", part: "stem" }, { pillar: "month", part: "stem" }])
  })
  it("표지 조건: 상관견관·효신탈식·비겁쟁재 설계 사례", () => {
    // 甲 일간: 丁(상관)·辛(정관) 투출 → 상관견관 / 壬(편인)·丙(식신) → 효신탈식 / 甲·乙(비겁 둘)+戊(편재) → 비겁쟁재
    expect(run("丁卯/辛亥/甲子/甲子").qiFlow.clarityFlags.map((x) => x.flag)).toContain("상관견관")
    expect(run("壬申/丙午/甲子/甲子").qiFlow.clarityFlags.map((x) => x.flag)).toContain("효신탈식")
    expect(run("甲子/乙亥/甲子/戊辰").qiFlow.clarityFlags.map((x) => x.flag)).toContain("비겁쟁재")
  })
})
