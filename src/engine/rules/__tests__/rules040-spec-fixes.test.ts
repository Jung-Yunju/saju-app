// rules@0.4.0 회귀 테스트 — 명세 정정(2026-11-28, D-022) E1~E6
// 명세: docs/knowledge/strength-structure-spec.md §1.9·§2.2·§2.3·§3.3·§3.6·§7(사례 2·3·4·5·7·10·11)·§7.1-6-2~6-6
// 변경표: docs/knowledge/reviews/2026-11-28-p306-decisions.md
// 기대값은 명세 본문의 손계산(연구소장)과 명세 정의에서 따로 옮겼다. 구현 결과를 복사하지 않았다.
import { describe, expect, it } from "vitest"
import {
  analyzeRules, DEFAULT_RULE_OPTIONS, EngineInputError, RULES_ENGINE_VERSION,
  type CalendarResult, type Pillar, type Position, type RuleAnalysis, type RuleOptions, type StructureGroupRef,
} from "@/engine"
import { BRANCHES, STEMS } from "../../calendar/constants"
import { regularStructures } from "../structure"
import type { Natal } from "../groups"

const P = (gz: string): Pillar => ({ stem: gz[0], branch: gz[1] }) as Pillar
const chart = (y: string, m: string, d: string, h: string | null) =>
  ({ engineVersion: "calendar@test", pillars: { year: P(y), month: P(m), day: P(d), hour: h ? P(h) : null } }) as unknown as CalendarResult
const run = (gz: string, o?: Partial<RuleOptions>): RuleAnalysis => {
  const [y, m, d, h] = gz.split("/")
  return analyzeRules(chart(y, m, d, h === "-" ? null : h), o)
}

/** 명세 §7 사례 원국 */
const CASE: Record<number, string> = {
  1: "甲寅/丙寅/甲辰/乙亥",
  2: "甲辰/丙子/丙子/丁酉",
  3: "丙寅/丁酉/庚辰/壬午",
  4: "丙寅/庚子/壬午/丁未",
  5: "戊寅/辛酉/甲寅/乙亥",
  6: "丙寅/丁酉/庚辰/-",
  7: "甲辰/己巳/庚戌/丙子",
  8: "庚申/戊子/丙申/壬辰",
  9: "戊午/己未/戊戌/丁巳",
  10: "庚辰/己丑/甲戌/戊辰",
  11: "庚申/甲申/甲寅/癸酉",
  12: "癸亥/癸亥/壬子/辛丑",
}

const S = (pillar: Position["pillar"]): Position => ({ pillar, part: "stem" })
const B = (pillar: Position["pillar"]): Position => ({ pillar, part: "branch" })

/** 60갑자(i → 천간 i%10, 지지 i%12) */
const JIAZI: Pillar[] = Array.from({ length: 60 }, (_, i) => ({ stem: STEMS[i % 10], branch: BRANCHES[i % 12] }))

/** 결정적 의사난수(LCG) — 시드 고정 */
function lcg(seed: number) {
  let x = seed >>> 0
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0
    return x / 2 ** 32
  }
}
function randomCharts(count: number, seed: number): { gz: string; c: CalendarResult }[] {
  const rnd = lcg(seed)
  const pick = () => JIAZI[Math.floor(rnd() * 60)]
  const out: { gz: string; c: CalendarResult }[] = []
  for (let i = 0; i < count; i++) {
    const y = pick(), m = pick(), d = pick()
    const h = rnd() < 0.2 ? null : pick()
    const s = (p: Pillar) => p.stem + p.branch
    out.push({ gz: [s(y), s(m), s(d), h ? s(h) : "-"].join("/"), c: chart(s(y), s(m), s(d), h ? s(h) : null) })
  }
  return out
}

function refsOf(a: RuleAnalysis): { cand: string; kind: "sangsin" | "avoid"; ref: StructureGroupRef }[] {
  const out: { cand: string; kind: "sangsin" | "avoid"; ref: StructureGroupRef }[] = []
  for (const c of a.structure.candidates) {
    for (const ref of c.sangsin ?? []) out.push({ cand: c.name, kind: "sangsin", ref })
    for (const ref of c.avoid ?? []) out.push({ cand: c.name, kind: "avoid", ref })
  }
  return out
}

const expectedPresence = (r: StructureGroupRef) =>
  r.touchul.length > 0 ? (r.hiddenPositions.length > 0 ? "stemAndHidden" : "stemOnly") : r.hiddenPositions.length > 0 ? "hiddenOnly" : "absent"

describe("버전·옵션 기록 (rules@0.4.0)", () => {
  it("engineVersion rules@0.4.0", () => {
    expect(RULES_ENGINE_VERSION).toBe("rules@0.4.0")
    expect(run(CASE[1]).engineVersion).toBe("rules@0.4.0")
  })
  it("새 옵션 기본값이 결과 options에 기록된다", () => {
    expect(DEFAULT_RULE_OPTIONS.earthRokgeop).toBe("mainQiGate")
    expect(DEFAULT_RULE_OPTIONS.tonggwanMinShare).toBe(0.25)
    expect(DEFAULT_RULE_OPTIONS.tonggwanMinRatio).toBe(0.5)
    const o = run(CASE[1]).options
    expect(o).toMatchObject({ earthRokgeop: "mainQiGate", tonggwanMinShare: 0.25, tonggwanMinRatio: 0.5 })
    expect(run(CASE[1], { tonggwanMinShare: 0.3, tonggwanMinRatio: 0.6 }).options).toMatchObject({ tonggwanMinShare: 0.3, tonggwanMinRatio: 0.6 })
  })
})

describe("§7.1-6-2 예약·범위 밖 옵션 거부", () => {
  const bad: [string, Partial<RuleOptions>][] = [
    ["earthRokgeop luTable(예약)", { earthRokgeop: "luTable" }],
    ["earthRokgeop 모르는 값", { earthRokgeop: "fireEarth" as never }],
    ["tonggwanMinShare 0", { tonggwanMinShare: 0 }],
    ["tonggwanMinShare 음수", { tonggwanMinShare: -0.1 }],
    ["tonggwanMinShare 0.5 초과", { tonggwanMinShare: 0.500001 }],
    ["tonggwanMinShare NaN", { tonggwanMinShare: Number.NaN }],
    ["tonggwanMinShare Infinity", { tonggwanMinShare: Number.POSITIVE_INFINITY }],
    ["tonggwanMinShare 문자열", { tonggwanMinShare: "0.3" as never }],
    ["tonggwanMinShare null", { tonggwanMinShare: null as never }],
    ["tonggwanMinRatio 0", { tonggwanMinRatio: 0 }],
    ["tonggwanMinRatio 1 초과", { tonggwanMinRatio: 1.01 }],
    ["tonggwanMinRatio NaN", { tonggwanMinRatio: Number.NaN }],
    ["tonggwanMinRatio boolean", { tonggwanMinRatio: true as never }],
  ]
  for (const [label, o] of bad)
    it(label, () => {
      expect(() => run(CASE[1], o)).toThrow(EngineInputError)
    })
  it("허용 범위 경계(상한 포함)와 mainQiGate 명시는 받는다", () => {
    expect(() => run(CASE[1], { tonggwanMinShare: 0.5, tonggwanMinRatio: 1 })).not.toThrow()
    expect(() => run(CASE[1], { tonggwanMinShare: 1e-6, tonggwanMinRatio: 1e-6 })).not.toThrow()
    expect(run(CASE[9], { earthRokgeop: "mainQiGate" })).toEqual(run(CASE[9]))
  })
})

describe("§7.1-6-3 토 일간 록겁(기본 설정): 건록격·양인격이 나오지 않는다", () => {
  const ROKGEOP_NAMES = ["건록격", "양인격"]
  const earthDays = JIAZI.filter((p) => p.stem === "戊" || p.stem === "己")
  const yearStemReps = STEMS.map((s) => JIAZI.find((p) => p.stem === s)!) // 연간 10종(투출 판정용)

  it("戊·己 일주 12 × 월주 60 × 연간 10 × 시주(모름 + 시간 10종) 전수 — 세 표 주 후보 이름 포함", () => {
    const hourReps: (Pillar | null)[] = [null, ...STEMS.map((s) => JIAZI.find((p) => p.stem === s)!)]
    let n = 0
    for (const day of earthDays)
      for (const month of JIAZI)
        for (const year of yearStemReps)
          for (const hour of hourReps) {
            const nat: Natal = { year, month, day, hour }
            const r = regularStructures(nat, { ...DEFAULT_RULE_OPTIONS, usefulGodMethods: [...DEFAULT_RULE_OPTIONS.usefulGodMethods] })
            n++
            for (const c of r.candidates) if (ROKGEOP_NAMES.includes(c.name)) throw new Error(`${JSON.stringify(nat)} → ${c.name}`)
            for (const t of r.byTable) if (ROKGEOP_NAMES.includes(t.name)) throw new Error(`${JSON.stringify(nat)} ${t.tableId} → ${t.name}`)
            const primary = r.candidates[0]
            if (["辰", "戌", "丑", "未"].includes(month.branch)) {
              if (primary.name !== "월겁격" || primary.kind !== "rokgeop") throw new Error(`${JSON.stringify(nat)} 辰戌丑未월 → ${primary.name}`)
            } else if (primary.kind !== "regular") {
              throw new Error(`${JSON.stringify(nat)} 록겁 아닌 달 → ${primary.name}`)
            }
          }
    expect(n).toBe(12 * 60 * 10 * 11)
  })

  it("戊·己 일간의 巳·午월은 G2(정인격·편인격 등)로 간다 — 명세 예", () => {
    // 戊午월 + 정기 丁 시간 투출 → 정인격 (양인격 아님)
    const a = run("甲子/戊午/戊辰/丁巳")
    expect(a.structure.candidates[0]).toMatchObject({ name: "정인격", kind: "regular", ruleId: "structure.zp.G2" })
    // 己巳월(己 일간): 정기 丙 = 정인 → 투출 없으면 정인격 (건록격 아님)
    const b = run("甲子/己巳/己卯/甲子")
    expect(b.structure.candidates[0].name).toBe("정인격")
    expect(b.structure.candidates.map((c) => c.name)).not.toContain("건록격")
    // 戊 巳월: 정기 丙 = 편인 → 편인격
    const c = run("甲子/己巳/戊辰/壬子")
    expect(c.structure.candidates[0].name).toBe("편인격")
  })

  it("기본 무작위 원국(시드 고정 3,000건)에서도 戊·己 일간 건록격·양인격 0건", () => {
    let earth = 0
    for (const { gz, c } of randomCharts(3000, 20261128)) {
      const a = analyzeRules(c)
      if (a.dayMaster.stem !== "戊" && a.dayMaster.stem !== "己") continue
      earth++
      for (const x of a.structure.candidates) expect(ROKGEOP_NAMES, gz).not.toContain(x.name)
    }
    expect(earth).toBeGreaterThan(300)
  })
})

describe("E1·E2 상신 hiddenPositions·presence — 명세 §7 사례 손계산", () => {
  const sangsin = (n: number, group: StructureGroupRef["group"]) => {
    const r = run(CASE[n]).structure.candidates[0].sangsin!.find((s) => s.group === group)
    if (!r) throw new Error(`사례 ${n}: 상신 ${group} 없음`)
    return r
  }
  const T: [number, string, StructureGroupRef["group"], Position[], Position[], StructureGroupRef["presence"]][] = [
    [2, "정관격", "jaeseong", [], [B("hour")], "hiddenOnly"],
    [2, "정관격", "inseong", [S("year")], [B("year")], "stemAndHidden"],
    [3, "양인격", "gwansal", [S("year"), S("month")], [B("year"), B("hour")], "stemAndHidden"],
    [4, "양인격", "gwansal", [], [B("year"), B("day"), B("hour")], "hiddenOnly"],
    [5, "정관격", "jaeseong", [S("year")], [B("year"), B("day"), B("hour")], "stemAndHidden"],
    [5, "정관격", "inseong", [], [B("hour")], "hiddenOnly"],
    [10, "정재격", "siksang", [], [B("day")], "hiddenOnly"],
    [10, "정재격", "gwansal", [S("year")], [B("month"), B("day")], "stemAndHidden"],
    [11, "칠살격", "siksang", [], [B("day")], "hiddenOnly"],
    [11, "칠살격", "inseong", [S("hour")], [B("year"), B("month")], "stemAndHidden"],
  ]
  for (const [n, name, group, touchul, hidden, presence] of T)
    it(`사례 ${n} ${name} 상신 ${group}: presence ${presence}`, () => {
      expect(run(CASE[n]).structure.candidates[0].name).toBe(name)
      const r = sangsin(n, group)
      expect(r.touchul).toEqual(touchul)
      expect(r.hiddenPositions).toEqual(hidden)
      expect(r.presence).toBe(presence)
      expect(r).not.toHaveProperty("hiddenOnly")
    })
  it("사례 11 식신 상신은 tenGods [식신]", () => {
    expect(sangsin(11, "siksang").tenGods).toEqual(["식신"])
  })
  it("필드 순서: group → element → (tenGods) → touchul → hiddenPositions → presence → (note)", () => {
    expect(Object.keys(sangsin(11, "siksang"))).toEqual(["group", "element", "tenGods", "touchul", "hiddenPositions", "presence", "note"])
    expect(Object.keys(sangsin(2, "jaeseong"))).toEqual(["group", "element", "touchul", "hiddenPositions", "presence"])
  })
})

describe("§7.1-6-4 presence 일관성 (시드 고정 무작위 3,000건 × 표 3종)", () => {
  const charts = randomCharts(3000, 7)
  for (const table of ["kr-monthly-30", "cn-lunarjs", "main-only"] as const)
    it(`${table}: presence = touchul·hiddenPositions 빈 여부, 건록·월겁 상신에 hiddenOnly·absent 없음, 구 이름 없음`, () => {
      let refs = 0, rok = 0
      const seen = new Set<string>()
      for (const { gz, c } of charts) {
        const a = analyzeRules(c, { hiddenStemTable: table })
        for (const { cand, kind, ref } of refsOf(a)) {
          refs++
          seen.add(ref.presence)
          expect(ref.presence, `${gz} ${cand} ${kind} ${ref.group}`).toBe(expectedPresence(ref))
          expect(ref, gz).not.toHaveProperty("hiddenOnly")
          for (const p of ref.touchul) expect(p.part).toBe("stem")
          for (const p of ref.hiddenPositions) expect(p.part).toBe("branch")
          if ((cand === "건록격" || cand === "월겁격") && kind === "sangsin") {
            rok++
            expect(["stemAndHidden", "stemOnly"], gz).toContain(ref.presence)
          }
        }
      }
      expect(refs).toBeGreaterThan(3000)
      expect(rok).toBeGreaterThan(0)
      expect([...seen].sort()).toEqual(["absent", "hiddenOnly", "stemAndHidden", "stemOnly"])
    })
})

describe("E3 tableSensitive 정의 분리 (§1.9)", () => {
  it("사례 7: 신강약 tableSensitive false, IncludingMainOnly true (kr·cn 중화, main-only만 신약)", () => {
    const s = run(CASE[7]).strength
    expect(s.models[0].verdict).toBe("중화")
    expect(s.tableSensitivity.map((x) => [x.tableId, x.verdict])).toEqual([["cn-lunarjs", "중화"], ["main-only", "신약"]])
    expect(s.tableSensitive).toBe(false)
    expect(s.tableSensitiveIncludingMainOnly).toBe(true)
  })
  it("사례 1·3: 둘 다 false(불변)", () => {
    for (const n of [1, 3]) {
      const s = run(CASE[n]).strength
      expect(s.tableSensitive, `사례 ${n}`).toBe(false)
      expect(s.tableSensitiveIncludingMainOnly, `사례 ${n}`).toBe(false)
    }
  })
  it("사례 8: 격국 tableSensitive true 유지(kr 칠살격 ↔ cn 정관격)", () => {
    const st = run(CASE[8]).structure
    expect(st.byTable.find((x) => x.tableId === "kr-monthly-30")!.name).toBe("칠살격")
    expect(st.byTable.find((x) => x.tableId === "cn-lunarjs")!.name).toBe("정관격")
    expect(st.tableSensitive).toBe(true)
    expect(st.tableSensitiveIncludingMainOnly).toBe(true)
  })

  const charts = randomCharts(2000, 99)
  for (const table of ["kr-monthly-30", "cn-lunarjs", "main-only"] as const)
    it(`${table} 선택: 정의대로 계산(무작위 2,000건), 새 값이면 IncludingMainOnly도 true`, () => {
      const used = new Set<string>([table, "kr-monthly-30", "cn-lunarjs"])
      let diff = 0
      for (const { gz, c } of charts) {
        const a = analyzeRules(c, { hiddenStemTable: table })
        const s = a.strength
        const A = s.models[0]
        const d = (x: (typeof s.tableSensitivity)[number]) => x.verdict !== A.verdict || x.extreme !== A.extreme
        expect(s.tableSensitivity.map((x) => x.tableId), gz).not.toContain(table)
        expect(s.tableSensitive, gz).toBe(s.tableSensitivity.filter((x) => used.has(x.tableId)).some(d))
        expect(s.tableSensitiveIncludingMainOnly, gz).toBe(s.tableSensitivity.some(d))
        const st = a.structure
        expect(st.byTable.map((x) => x.tableId)).toEqual(["kr-monthly-30", "cn-lunarjs", "main-only"])
        expect(st.tableSensitive, gz).toBe(new Set(st.byTable.filter((x) => used.has(x.tableId)).map((x) => x.name)).size > 1)
        expect(st.tableSensitiveIncludingMainOnly, gz).toBe(new Set(st.byTable.map((x) => x.name)).size > 1)
        if (s.tableSensitive) expect(s.tableSensitiveIncludingMainOnly).toBe(true)
        if (st.tableSensitive) expect(st.tableSensitiveIncludingMainOnly).toBe(true)
        if (table === "main-only") {
          expect(s.tableSensitive).toBe(s.tableSensitiveIncludingMainOnly)
          expect(st.tableSensitive).toBe(st.tableSensitiveIncludingMainOnly)
        }
        if (s.tableSensitive !== s.tableSensitiveIncludingMainOnly) diff++
      }
      if (table !== "main-only") expect(diff, "main-only만 다른 사례가 있어야 정의 분리가 의미 있음").toBeGreaterThan(0)
    })
})

describe("§7.1-6-5 종강 반가운 오행: [인성, 비겁], 관살 없음", () => {
  it("甲 일간 수(인성) 과다 원국 → 종강격 후보, special view = [수, 목]", () => {
    const a = run("壬子/壬子/甲子/乙亥")
    const c = a.structure.candidates.find((x) => x.ruleId === "special.jongwang")!
    expect(c.name).toBe("종강격 후보")
    const v = a.usefulGods.views.find((x) => x.method === "special")!
    expect(v.candidates.map((x) => [x.element, x.group])).toEqual([["water", "inseong"], ["wood", "bigyeop"]])
  })
  it("무작위 원국(시드 고정 20,000건)의 종왕·종강 후보 전부: 돕는 두 묶음만, 많은 쪽 먼저", () => {
    let jongkang = 0, jongwang = 0
    for (const { gz, c } of randomCharts(20000, 4242)) {
      const a = analyzeRules(c)
      const cs = a.structure.candidates.filter((x) => x.ruleId === "special.jongwang")
      if (!cs.length) continue
      // 종왕·종강만 있는 원국에서 special view를 대조(다른 특수격 후보가 함께 있으면 후보가 섞임)
      const others = a.structure.candidates.filter((x) => x.kind === "special" && x.ruleId !== "special.jongwang")
      const groups = a.usefulGods.views.find((x) => x.method === "special")!.candidates.map((x) => x.group)
      const kang = cs[0].name === "종강격 후보"
      if (kang) jongkang++
      else jongwang++
      if (others.length) continue
      expect(groups, gz).toEqual(kang ? ["inseong", "bigyeop"] : ["bigyeop", "inseong"])
      expect(groups, gz).not.toContain("gwansal")
    }
    expect(jongwang).toBeGreaterThan(0)
    expect(jongkang + jongwang).toBeGreaterThan(0)
  })
})

describe("§7.1-6-6 통관 옵션: 기본값 결과 불변 + 후보 기준 (§3.3 표)", () => {
  const tg = (n: number, o?: Partial<RuleOptions>) => run(CASE[n], o).usefulGods.views.find((v) => v.method === "tonggwan")!
  const okCases = (o?: Partial<RuleOptions>) =>
    Object.keys(CASE).map(Number).filter((n) => tg(n, o).status === "ok")

  it("기본값: 성립 사례 2·3·4·5·6·11, rank 1 = rules@0.3.x와 같음", () => {
    expect(okCases()).toEqual([2, 3, 4, 5, 6, 11])
    const rank1: Record<number, string> = { 2: "wood", 3: "earth", 4: "wood", 5: "water", 6: "earth", 11: "water" }
    for (const [n, e] of Object.entries(rank1)) expect(tg(Number(n)).candidates[0].element, `사례 ${n}`).toBe(e)
    for (const n of [1, 7, 8, 9, 10, 12]) expect(tg(n).status, `사례 ${n}`).toBe("none")
  })
  it("기본값을 명시해도 통관 view가 기본 결과와 같다(12사례)", () => {
    for (const n of Object.keys(CASE).map(Number))
      expect(tg(n, { tonggwanMinShare: 0.25, tonggwanMinRatio: 0.5 }), `사례 ${n}`).toEqual(tg(n))
  })
  it("basis values에 사용한 기준값 기록", () => {
    expect(tg(2).basis[0].values).toMatchObject({ minShare: 0.25, minRatio: 0.5 })
    expect(tg(4, { tonggwanMinShare: 0.3 }).basis[0].values).toMatchObject({ minShare: 0.3, minRatio: 0.5 })
  })
  it("후보 ① 0.30/0.5 → 사례 4·5만 성립", () => {
    expect(okCases({ tonggwanMinShare: 0.3, tonggwanMinRatio: 0.5 })).toEqual([4, 5])
  })
  it("후보 ② 0.28/0.6 → 사례 2·4·5 성립", () => {
    expect(okCases({ tonggwanMinShare: 0.28, tonggwanMinRatio: 0.6 })).toEqual([2, 4, 5])
  })
  it("통관 옵션은 다른 관점·판정을 바꾸지 않는다", () => {
    for (const n of [2, 3, 11]) {
      const a = run(CASE[n])
      const b = run(CASE[n], { tonggwanMinShare: 0.3, tonggwanMinRatio: 0.6 })
      expect(b.strength).toEqual(a.strength)
      expect(b.structure).toEqual(a.structure)
      expect(b.usefulGods.views.filter((v) => v.method !== "tonggwan")).toEqual(a.usefulGods.views.filter((v) => v.method !== "tonggwan"))
    }
  })
})
