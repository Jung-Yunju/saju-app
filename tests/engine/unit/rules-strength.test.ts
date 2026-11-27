// 신강·신약 테스트 — src/engine/rules/strength.ts (rules@0.3.0, P3-06)
// 기대값: docs/knowledge/strength-structure-spec.md §7 사례 1~12의 손계산 값(u 단위: 천간 1.0 = 30u)을 그대로 옮겼다.
// 구현 결과를 복사하지 않았다. 명세 숫자와 다르게 나온 곳은 없었다(신강약 범위). 판정은 명리상 정답이 아니라 명세 규칙의 결과다.
import { describe, expect, it } from "vitest"
import { analyzeRules, hourPillarsOf, type CalendarResult, type Pillar, type RuleOptions, type StrengthModelResult } from "@/engine"

const P = (gz: string): Pillar => ({ stem: gz[0], branch: gz[1] }) as Pillar
const chart = (y: string, m: string, d: string, h: string | null) =>
  ({ engineVersion: "calendar@test", pillars: { year: P(y), month: P(m), day: P(d), hour: h ? P(h) : null } }) as unknown as CalendarResult
const run = (gz: string, o?: Partial<RuleOptions>) => {
  const [y, m, d, h] = gz.split("/")
  return analyzeRules(chart(y, m, d, h === "-" ? null : h), o)
}
const U = 30
const model = (r: ReturnType<typeof run>, k: StrengthModelResult["model"]) => r.strength.models.find((m) => m.model === k)!
const posKey = (p: { pillar: string; part: string }) => `${p.pillar}.${p.part}`

interface Exp {
  gz: string
  A: { S: number; T: number; r: number; verdict: string; extreme?: "strong" | "weak" | null; near?: boolean }
  B: { ryeong: boolean; ji: boolean; se: [number, number]; verdict: string }
  C: { S: number; T: number; r: number; verdict: string; near?: boolean }
}

// §7 사례별 A·B·C (명세 값)
const CASES: Record<number, Exp> = {
  1: { gz: "甲寅/丙寅/甲辰/乙亥", A: { S: 195, T: 315, r: 0.619048, verdict: "신강", extreme: null, near: false }, B: { ryeong: true, ji: false, se: [4, 5], verdict: "신강" }, C: { S: 195, T: 315, r: 0.619048, verdict: "신강" } },
  2: { gz: "甲辰/丙子/丙子/丁酉", A: { S: 129, T: 315, r: 0.409524, verdict: "신약", near: false }, B: { ryeong: false, ji: false, se: [3, 5], verdict: "신약" }, C: { S: 99, T: 285, r: 0.347368, verdict: "신약" } },
  3: { gz: "丙寅/丁酉/庚辰/壬午", A: { S: 163, T: 315, r: 0.51746, verdict: "중화", near: false }, B: { ryeong: true, ji: true, se: [0, 5], verdict: "신강" }, C: { S: 163, T: 315, r: 0.51746, verdict: "중화" } },
  4: { gz: "丙寅/庚子/壬午/丁未", A: { S: 150, T: 315, r: 0.47619, verdict: "중화", near: true }, B: { ryeong: true, ji: false, se: [1, 5], verdict: "신약" }, C: { S: 135, T: 300, r: 0.45, verdict: "중화", near: true } },
  5: { gz: "戊寅/辛酉/甲寅/乙亥", A: { S: 123, T: 315, r: 0.390476, verdict: "신약" }, B: { ryeong: false, ji: true, se: [3, 5], verdict: "신강" }, C: { S: 123, T: 315, r: 0.390476, verdict: "신약" } },
  6: { gz: "丙寅/丁酉/庚辰/-", A: { S: 154, T: 255, r: 0.603922, verdict: "신강" }, B: { ryeong: true, ji: true, se: [0, 3], verdict: "신강" }, C: { S: 154, T: 255, r: 0.603922, verdict: "신강" } },
  7: { gz: "甲辰/己巳/庚戌/丙子", A: { S: 160.5, T: 315, r: 0.509524, verdict: "중화", near: false }, B: { ryeong: false, ji: true, se: [2, 5], verdict: "신약" }, C: { S: 160.5, T: 315, r: 0.509524, verdict: "중화" } },
  8: { gz: "庚申/戊子/丙申/壬辰", A: { S: 39, T: 315, r: 0.12381, verdict: "신약", extreme: "weak" }, B: { ryeong: false, ji: false, se: [0, 5], verdict: "신약" }, C: { S: 39, T: 315, r: 0.12381, verdict: "신약" } },
  9: { gz: "戊午/己未/戊戌/丁巳", A: { S: 285.5, T: 315, r: 0.906349, verdict: "신강", extreme: "strong" }, B: { ryeong: true, ji: true, se: [5, 5], verdict: "신강" }, C: { S: 285.5, T: 315, r: 0.906349, verdict: "신강" } },
  10: { gz: "庚辰/己丑/甲戌/戊辰", A: { S: 81, T: 315, r: 0.257143, verdict: "신약", extreme: null }, B: { ryeong: false, ji: false, se: [0, 5], verdict: "신약" }, C: { S: 81, T: 315, r: 0.257143, verdict: "신약" } },
  11: { gz: "庚申/甲申/甲寅/癸酉", A: { S: 142, T: 315, r: 0.450794, verdict: "중화", near: true }, B: { ryeong: false, ji: true, se: [2, 5], verdict: "신약" }, C: { S: 142, T: 315, r: 0.450794, verdict: "중화" } },
  12: { gz: "癸亥/癸亥/壬子/辛丑", A: { S: 241, T: 315, r: 0.765079, verdict: "신강", extreme: null, near: false }, B: { ryeong: true, ji: true, se: [4, 5], verdict: "신강" }, C: { S: 241, T: 315, r: 0.765079, verdict: "신강" } },
}

describe("§7 사례 1~12 — 모형 A·B·C (명세 손계산 값)", () => {
  for (const [no, e] of Object.entries(CASES)) {
    it(`사례 ${no} ${e.gz}`, () => {
      const r = run(e.gz)
      const A = model(r, "weighted")
      expect(A.support! * U, "A.S").toBeCloseTo(e.A.S, 4)
      expect(A.total! * U, "A.T").toBeCloseTo(e.A.T, 4)
      expect(A.ratio, "A.r").toBe(e.A.r)
      expect(A.verdict).toBe(e.A.verdict)
      expect(A.score).toBe(Math.round(e.A.r * 1000) / 10)
      if (e.A.extreme !== undefined) expect(A.extreme).toBe(e.A.extreme)
      if (e.A.near !== undefined) expect(A.nearBoundary, "A.nearBoundary").toBe(e.A.near)
      const B = model(r, "threeFactor")
      expect(B.factors!.deukryeong.met, "득령").toBe(e.B.ryeong)
      expect(B.factors!.deukji.met, "득지").toBe(e.B.ji)
      expect([B.factors!.deukse.count, B.factors!.deukse.of], "득세").toEqual(e.B.se)
      expect(B.verdict).toBe(e.B.verdict)
      expect(B.ratio).toBeNull()
      expect(B.extreme).toBeNull()
      const C = model(r, "rooted")
      expect(C.support! * U, "C.S").toBeCloseTo(e.C.S, 4)
      expect(C.total! * U, "C.T").toBeCloseTo(e.C.T, 4)
      expect(C.ratio, "C.r").toBe(e.C.r)
      expect(C.verdict).toBe(e.C.verdict)
      if (e.C.near !== undefined) expect(C.nearBoundary).toBe(e.C.near)
      // 모형 순서·agreement
      expect(r.strength.models.map((m) => m.model)).toEqual(["weighted", "threeFactor", "rooted"])
      const all = A.verdict === B.verdict && B.verdict === C.verdict
      expect(r.strength.agreement).toBe(all ? "all" : "split")
      expect(r.strength.primary).toBe("weighted")
      expect(r.strength.adjustmentsApplied).toEqual([])
    })
  }

  it("split 사례는 3·4·5·7·11 (명세 §9.1 'A·B가 다름' 3·4·5·11 + 사례 7 B 신약)", () => {
    const split = Object.entries(CASES).filter(([, e]) => run(e.gz).strength.agreement === "split").map(([k]) => Number(k))
    expect(split).toEqual([3, 4, 5, 7, 11])
  })
})

describe("근접 경계·득지 변형·통근", () => {
  it("사례 3: 0.55와 0.03254 차이 → nearBoundary false (0.03 미만 아님)", () => {
    const A = model(run(CASES[3].gz), "weighted")
    expect(A.nearest).toEqual({ threshold: 0.55, distance: 0.03254 })
    expect(A.nearBoundary).toBe(false)
  })
  it("사례 4: 0.45와 0.02619 차이 → true / 사례 12: 0.80과 0.034921 → false / 사례 2: 0.45와 0.040476 → false", () => {
    expect(model(run(CASES[4].gz), "weighted").nearest).toEqual({ threshold: 0.45, distance: 0.02619 })
    expect(model(run(CASES[12].gz), "weighted").nearest).toEqual({ threshold: 0.8, distance: 0.034921 })
    expect(model(run(CASES[2].gz), "weighted").nearest).toEqual({ threshold: 0.45, distance: 0.040476 })
  })
  it("사례 1 득지 변형 dayBranchAnyRoot: 辰의 乙·癸 → 득지 ✓, 요소 수 2→3, 판정 신강 그대로", () => {
    const B = model(run(CASES[1].gz, { deukjiBasis: "dayBranchAnyRoot" }), "threeFactor")
    expect(B.factors!.deukji).toMatchObject({ met: true, ruleId: "strength.threeFactor.deukji.dayBranchAnyRoot" })
    expect([B.factors!.deukryeong.met, B.factors!.deukji.met, B.factors!.deukse.met].filter(Boolean)).toHaveLength(3)
    expect(B.verdict).toBe("신강")
  })
  it("사례 2: 丙(월간)·丁(시간) 무근 → rootFactor 0.5(15u), 甲은 辰의 乙에 뿌리 → 1. 일간 丙은 줄이지 않음. dayMasterRooted false", () => {
    const r = run(CASES[2].gz)
    const C = model(r, "rooted")
    const stems = C.basis.filter((b) => b.position.part === "stem").map((b) => `${b.position.pillar}:${b.char}:${b.rootFactor}:${b.points}`)
    expect(stems).toEqual(["year:甲:1:1", "month:丙:0.5:0.5", "day:丙:1:1", "hour:丁:0.5:0.5"])
    expect(r.strength.dayMasterRooted).toBe(false)
    expect(r.strength.dayMasterRoots).toEqual([])
    // A에서는 rootFactor가 모두 1
    expect(model(r, "weighted").basis.every((b) => b.rootFactor === 1)).toBe(true)
  })
  it("사례 4: 庚 무근(원국 지장간에 금 없음) → C는 S 135 / T 300 = 0.45 → 중화(하한 포함, 반올림 후 비교)", () => {
    const C = model(run(CASES[4].gz), "rooted")
    expect(C.basis.find((b) => b.char === "庚" && b.position.part === "stem")!.rootFactor).toBe(0.5)
    expect(C.ratio).toBe(0.45)
    expect(C.verdict).toBe("중화")
  })
})

describe("seasonState(왕상휴수사)·groupTotals", () => {
  const GT: Record<number, [number, number, number, number, number]> = {
    // [비겁, 인성, 식상, 재성, 관살] (u, 일간 제외) — 명세 값
    1: [144.5, 20.5, 58, 62, 0],
    2: [60, 39, 18, 30, 138],
    4: [90, 30, 19, 107.5, 38.5],
    5: [77, 16, 17.5, 54.5, 120],
  }
  for (const [no, g] of Object.entries(GT))
    it(`사례 ${no} groupTotals`, () => {
      const t = run(CASES[Number(no)].gz).strength.groupTotals
      expect([t.bigyeop, t.inseong, t.siksang, t.jaeseong, t.gwansal].map((x) => Math.round(x * U * 1000) / 1000)).toEqual(g)
    })
  it("명세 본문 값: 사례 3 비겁 90·인성 43, 사례 6 비겁 90·인성 34, 사례 8 인성 9·관살 140.5, 사례 9 비겁 157·인성 98.5·관살 9, 사례 12 비겁 178·인성 33·관살 46", () => {
    const g = (n: number) => run(CASES[n].gz).strength.groupTotals
    const u = (x: number) => Math.round(x * U * 1000) / 1000
    expect([u(g(3).bigyeop), u(g(3).inseong)]).toEqual([90, 43])
    expect([u(g(6).bigyeop), u(g(6).inseong)]).toEqual([90, 34])
    expect([u(g(8).inseong), u(g(8).gwansal)]).toEqual([9, 140.5])
    expect([u(g(9).bigyeop), u(g(9).inseong), u(g(9).gwansal)]).toEqual([157, 98.5, 9])
    expect([u(g(10).jaeseong)]).toEqual([177])
    expect([u(g(12).bigyeop), u(g(12).inseong), u(g(12).gwansal)]).toEqual([178, 33, 46])
  })
  it("seasonState: 사례 1 旺(寅=목, 일간 목) · 사례 7 死(巳 화가 庚 금을 극) · 정의식 전수", () => {
    expect(run(CASES[1].gz).strength.seasonState).toBe("旺")
    expect(run(CASES[7].gz).strength.seasonState).toBe("死")
    // 일간 甲(목) 기준 월지 정기 오행별: 寅목 旺, 子수(수생목) 相, 午화(목생화) 休, 辰토(목극토) 囚, 申금(금극목) 死
    const s = (m: string) => run(`甲子/${m}/甲子/甲子`).strength.seasonState
    expect([s("丙寅"), s("丙子"), s("庚午"), s("戊辰"), s("壬申")]).toEqual(["旺", "相", "休", "囚", "死"])
  })
})

describe("§1.9 지장간 표 민감도", () => {
  it("사례 1: cn-lunarjs 0.666667(S 210) · main-only 0.761905(S 240) 모두 신강 → tableSensitive false", () => {
    const s = run(CASES[1].gz).strength
    expect(s.tableSensitivity.map((t) => [t.tableId, t.ratio, t.verdict])).toEqual([
      ["cn-lunarjs", 0.666667, "신강"],
      ["main-only", 0.761905, "신강"],
    ])
    expect(s.tableSensitive).toBe(false)
  })
  it("사례 3: cn 0.504762(S 159) · main 0.523810(S 165) 중화", () => {
    const s = run(CASES[3].gz).strength
    expect(s.tableSensitivity.map((t) => [t.tableId, t.ratio, t.verdict])).toEqual([
      ["cn-lunarjs", 0.504762, "중화"],
      ["main-only", 0.52381, "중화"],
    ])
  })
  it("사례 7: kr 중화 → cn 0.461905 중화(근접) · main 0.428571 신약 → tableSensitive true", () => {
    const s = run(CASES[7].gz).strength
    expect(s.tableSensitivity).toEqual([
      { tableId: "cn-lunarjs", ratio: 0.461905, verdict: "중화", extreme: null, nearBoundary: true },
      // 명세에 없는 값: |0.428571 − 0.45| = 0.021429 < 0.03 → 근접(손계산)
      { tableId: "main-only", ratio: 0.428571, verdict: "신약", extreme: null, nearBoundary: true },
    ])
    expect(s.tableSensitive).toBe(true)
  })
  it("선택한 표가 바뀌면 나머지 두 표를 낸다(cn-lunarjs 선택 시 kr·main)", () => {
    const s = run(CASES[7].gz, { hiddenStemTable: "cn-lunarjs" }).strength
    expect(s.models[0].ratio).toBe(0.461905)
    expect(s.tableSensitivity.map((t) => [t.tableId, t.ratio])).toEqual([["kr-monthly-30", 0.509524], ["main-only", 0.428571]])
  })
})

describe("§1.8 시주 모름 — 사례 6 hourSensitivity", () => {
  const r = run(CASES[6].gz)
  // 명세 표: 庚일 12시진(오서둔 丙子부터), T 315
  const TABLE: [string, number, number, string][] = [
    ["丙子", 0, 0.488889, "중화"], ["丁丑", 21, 0.555556, "신강"], ["戊寅", 37, 0.606349, "신강"], ["己卯", 30, 0.584127, "신강"],
    ["庚辰", 48, 0.64127, "신강"], ["辛巳", 44, 0.628571, "신강"], ["壬午", 9, 0.51746, "중화"], ["癸未", 18, 0.546032, "중화"],
    ["甲申", 23, 0.561905, "신강"], ["乙酉", 30, 0.584127, "신강"], ["丙戌", 27, 0.574603, "신강"], ["丁亥", 7, 0.511111, "중화"],
  ]
  it("omitted ['hour'], 세 기둥 T 255", () => {
    expect(r.omitted).toEqual(["hour"])
    expect(r.strength.models[0].total! * U).toBeCloseTo(255, 4)
  })
  it("12시진 간지·r·판정이 명세 표와 같다(더해지는 S로 검산: (154 + ΔS)/315)", () => {
    const h = r.strength.hourSensitivity!
    expect(h.byHour.map((x) => x.hour.stem + x.hour.branch)).toEqual(TABLE.map((t) => t[0]))
    for (const [gz, dS, ratio, v] of TABLE) {
      const x = h.byHour.find((b) => b.hour.stem + b.hour.branch === gz)!
      expect(Math.round(((154 + dS) / 315) * 1e6) / 1e6, `${gz} 명세 내부 검산`).toBe(ratio)
      expect(x.ratio, gz).toBe(ratio)
      expect(x.verdict, gz).toBe(v)
    }
    expect(h.verdicts).toEqual(["신강", "중화"])
    expect(h.hourSensitive).toBe(true)
    expect(h.byHour.filter((b) => b.verdict === "중화")).toHaveLength(4)
  })
  it("壬午 행 = 사례 3의 A와 같다", () => {
    const x = r.strength.hourSensitivity!.byHour.find((b) => b.hour.stem === "壬" && b.hour.branch === "午")!
    expect(x.ratio).toBe(model(run(CASES[3].gz), "weighted").ratio)
  })
  it("시주를 알면 hourSensitivity null", () => {
    expect(run(CASES[3].gz).strength.hourSensitivity).toBeNull()
  })
  it("오서둔: 甲己일 甲子 · 乙庚일 丙子 · 丙辛일 戊子 · 丁壬일 庚子 · 戊癸일 壬子 시작", () => {
    const first = (s: string) => hourPillarsOf(s as Pillar["stem"])[0]
    expect(["甲", "己", "乙", "庚", "丙", "辛", "丁", "壬", "戊", "癸"].map((s) => first(s).stem + first(s).branch)).toEqual([
      "甲子", "甲子", "丙子", "丙子", "戊子", "戊子", "庚子", "庚子", "壬子", "壬子",
    ])
    expect(hourPillarsOf("庚").map((p) => p.branch).join("")).toBe("子丑寅卯辰巳午未申酉戌亥")
  })
})

describe("§1.7 합충 표시(affectedBy) — 반영하지 않음", () => {
  it("사례 7: 甲己 합(돕는 천간 己 → critical) · 甲庚 충(일간 → critical) · 辰戌 충(일지 → critical) · 子辰 반합(연지·시지 → critical 아님)", () => {
    const s = run(CASES[7].gz).strength
    const f = (rid: string) => s.affectedBy.filter((a) => a.ruleId === rid).map((a) => [a.members.map(posKey).join("+"), a.critical])
    expect(f("stem.combine.甲己")).toEqual([["year.stem+month.stem", true]])
    expect(f("stem.clash.甲庚")).toEqual([["year.stem+day.stem", true]])
    expect(f("branch.clash.辰戌")).toEqual([["year.branch+day.branch", true]])
    expect(f("branch.halfCombine.子辰")).toEqual([["year.branch+hour.branch", false]])
    expect(s.adjustmentsApplied).toEqual([])
  })
  it("사례 8: 申子辰 삼합 완성이 interactions에 있고 affectedBy에서 월지 포함 → critical", () => {
    const r = run(CASES[8].gz)
    expect(r.interactions.some((i) => i.type === "threeCombine" && i.complete && i.resultElement === "water")).toBe(true)
    const t = r.strength.affectedBy.filter((a) => a.type === "threeCombine")
    expect(t.length).toBeGreaterThan(0)
    expect(t.every((a) => a.critical && a.members.some((m) => m.pillar === "month" && m.part === "branch"))).toBe(true)
  })
  it("사례 11: 寅申 충(월지·일지 → critical), 두 글자 삼형 寅申(partial), 甲庚 천간충(연간·월간)", () => {
    const r = run(CASES[11].gz)
    const s = r.strength
    expect(s.affectedBy.find((a) => a.ruleId === "branch.clash.寅申" && a.members.map(posKey).join("+") === "month.branch+day.branch")!.critical).toBe(true)
    expect(s.affectedBy.some((a) => a.ruleId === "branch.punishment.寅申")).toBe(true)
    expect(r.interactions.find((i) => i.ruleId === "branch.punishment.寅申")!.partial).toBe(true)
    expect(s.affectedBy.some((a) => a.ruleId === "stem.clash.甲庚" && a.members.map(posKey).join("+") === "year.stem+month.stem")).toBe(true)
  })
  it("운 관계는 affectedBy에 넣지 않는다(원국만)", () => {
    const c = chart("甲辰", "己巳", "庚戌", "丙子")
    const r = analyzeRules(c, undefined, { luck: [P("壬午")], year: P("甲寅") })
    expect(r.strength.affectedBy.every((a) => a.members.every((m) => m.pillar !== "daeun" && m.pillar !== "seun"))).toBe(true)
    expect(r.strength).toEqual(analyzeRules(c).strength)
  })
})

describe("근거 항목(basis) 구조", () => {
  it("사례 1 A: 천간 1항목, 지지는 지장간 단위(연→월→일→시, 여기→중기→정기). 월지 3.0·일지 1.5", () => {
    const A = model(run(CASES[1].gz), "weighted")
    expect(A.basis.map((b) => `${posKey(b.position)}:${b.char}${b.viaHiddenStem ? "/" + b.viaHiddenStem : ""}:${b.group}:${b.side}:${b.positionWeight}`)).toEqual([
      "year.stem:甲:bigyeop:support:1", "year.branch:戊/yeogi:jaeseong:oppose:1", "year.branch:丙/junggi:siksang:oppose:1", "year.branch:甲/jeonggi:bigyeop:support:1",
      "month.stem:丙:siksang:oppose:1", "month.branch:戊/yeogi:jaeseong:oppose:3", "month.branch:丙/junggi:siksang:oppose:3", "month.branch:甲/jeonggi:bigyeop:support:3",
      "day.stem:甲:self:support:1", "day.branch:乙/yeogi:bigyeop:support:1.5", "day.branch:癸/junggi:inseong:support:1.5", "day.branch:戊/jeonggi:jaeseong:oppose:1.5",
      // 亥는 kr-monthly-30에서 여기 戊 7 · 중기 甲 7 · 정기 壬 16
      "hour.stem:乙:bigyeop:support:1", "hour.branch:戊/yeogi:jaeseong:oppose:1", "hour.branch:甲/junggi:bigyeop:support:1", "hour.branch:壬/jeonggi:inseong:support:1",
    ])
    // points = 위치 가중 × 지장간 비율(날수/30) × 통근 계수, 6자리: 월지 甲 = 3 × 16/30 = 1.6, 일지 乙 = 1.5 × 9/30 = 0.45
    expect(A.basis.find((b) => b.position.pillar === "month" && b.char === "甲" && b.viaHiddenStem)!.points).toBe(1.6)
    expect(A.basis.find((b) => b.position.pillar === "day" && b.char === "乙")!.points).toBe(0.45)
    expect(A.basis.find((b) => b.position.pillar === "hour" && b.char === "戊")!.points).toBe(0.233333)
  })
})
