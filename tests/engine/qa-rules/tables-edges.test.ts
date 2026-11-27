// 품질검증 P3-05 — 명세 표 전수 대조 · 시주 모름 · 입력 오류 · 결정성
import { describe, expect, it } from "vitest"
import { analyzeRules, computeChart, EngineInputError, type CalendarResult, type Pillar, type RuleExtra } from "@/engine"
import { BRANCHES, STEMS, SPEC_STAGE_TABLE, hiddenOf, stageOf } from "./oracle"

const TEMPLATE = computeChart({ calendar: "solar", year: 1990, month: 5, day: 5, time: { hour: 10, minute: 0 }, timezone: "Asia/Seoul", gender: "M" })
const P = (s: string): Pillar => ({ stem: s[0] as Pillar["stem"], branch: s[1] as Pillar["branch"] })
const JZ: Pillar[] = Array.from({ length: 60 }, (_, k) => ({ stem: STEMS[k % 10], branch: BRANCHES[k % 12] }))
const withBranch = (b: string) => JZ.find((p) => p.branch === b)!
const withStem = (s: string) => JZ.find((p) => p.stem === s)!
function chartOf(y: Pillar, m: Pillar, d: Pillar, h: Pillar | null): CalendarResult {
  const c = structuredClone(TEMPLATE)
  c.pillars = { year: y, month: m, day: d, hour: h }
  c.hourKnown = h !== null
  return c
}
const deepFreeze = <T,>(o: T): T => { if (o && typeof o === "object") { Object.values(o).forEach(deepFreeze); Object.freeze(o) } return o }

describe("지장간 표 (rules-spec §3)", () => {
  it("kr-monthly-30 날수 합 30, weight 합 1 — 엔진 출력 12지 전수", () => {
    for (const b of BRANCHES) {
      const a = analyzeRules(chartOf(withBranch(b), withBranch(b), withBranch(b), null))
      const hs = a.hiddenStems.pillars.year
      expect(hs.reduce((n, h) => n + (h.days ?? 0), 0), b).toBe(30)
      expect(hs.reduce((n, h) => n + h.weight, 0), b).toBeCloseTo(1, 9)
      expect(hs.map((h) => h.stem).join(""), b).toBe(hiddenOf(b, "kr-monthly-30").map((h) => h.stem).join(""))
    }
  })
  it("cn-lunarjs·main-only weight 합 1, days null", () => {
    for (const t of ["cn-lunarjs", "main-only"] as const) for (const b of BRANCHES) {
      const hs = analyzeRules(chartOf(withBranch(b), withBranch(b), withBranch(b), null), { hiddenStemTable: t }).hiddenStems.pillars.year
      expect(hs.reduce((n, h) => n + h.weight, 0), `${t} ${b}`).toBeCloseTo(1, 9)
      expect(hs.every((h) => h.days === null), `${t} ${b}`).toBe(true)
      expect(hs[hs.length - 1].role, `${t} ${b} 마지막=정기`).toBe("jeonggi")
    }
  })
})

describe("12운성 120칸 전수 — 엔진 출력 (rules-spec §5)", () => {
  const combos = [
    { twelveStagesYin: "reverse", earthStages: "withFire" },
    { twelveStagesYin: "reverse", earthStages: "withWater" },
    { twelveStagesYin: "sameAsYang", earthStages: "withFire" },
    { twelveStagesYin: "sameAsYang", earthStages: "withWater" },
  ] as const
  for (const c of combos) it(`${c.twelveStagesYin}/${c.earthStages}`, () => {
    const bad: string[] = []
    for (const s of STEMS) for (const b of BRANCHES) {
      const a = analyzeRules(chartOf(withBranch(b), withBranch(b), withStem(s), withBranch(b)), c)
      const hit = a.twelveStages.find((h) => h.basis === "dayStem" && h.position.pillar === "year")!
      const exp = c.twelveStagesYin === "reverse" && c.earthStages === "withFire" ? SPEC_STAGE_TABLE[s][BRANCHES.indexOf(b)] : stageOf(s, b, c.twelveStagesYin, c.earthStages)
      if (hit.stage !== exp) bad.push(`${s}${b} ${hit.stage}≠${exp}`)
    }
    expect(bad).toEqual([])
  })
  it("변형 표 명세 문구: withWater 戊=壬행·己=癸행, sameAsYang 乙=甲행 등", () => {
    for (const b of BRANCHES) {
      expect(stageOf("戊", b, "reverse", "withWater")).toBe(SPEC_STAGE_TABLE["壬"][BRANCHES.indexOf(b)])
      expect(stageOf("己", b, "reverse", "withWater")).toBe(SPEC_STAGE_TABLE["癸"][BRANCHES.indexOf(b)])
      for (const [yin, yang] of [["乙", "甲"], ["丁", "丙"], ["己", "戊"], ["辛", "庚"], ["癸", "壬"]])
        expect(stageOf(yin, b, "sameAsYang", "withFire")).toBe(SPEC_STAGE_TABLE[yang][BRANCHES.indexOf(b)])
    }
  })
})

describe("공망 60갑자 전수 (rules-spec §8 표)", () => {
  const SPEC: Record<string, string> = { 子: "戌亥", 戌: "申酉", 申: "午未", 午: "辰巳", 辰: "寅卯", 寅: "子丑" } // 순두 지지 → 공망
  it("일주 기준 empty·xunHead, 자기 지지 hit 없음", () => {
    for (let k = 0; k < 60; k++) {
      const d = JZ[k]
      const head = JZ[k - (k % 10)]
      const a = analyzeRules(chartOf(JZ[(k + 7) % 60], JZ[(k + 13) % 60], d, JZ[(k + 29) % 60]))
      const g = a.gongmang[0]
      expect(g.basis).toBe("day")
      expect(`${g.xunHead.stem}${g.xunHead.branch}`, `${d.stem}${d.branch}`).toBe(`${head.stem}${head.branch}`)
      expect(g.empty.join(""), `${d.stem}${d.branch}`).toBe(SPEC[head.branch])
      expect(g.hits.some((h) => h.pillar === "day")).toBe(false)
    }
  })
})

describe("관계 표 전수 (rules-spec §6·§7) — 붙은 두 기둥(연·월)", () => {
  const types = (a: ReturnType<typeof analyzeRules>, part: "stem" | "branch") =>
    a.interactions.filter((x) => x.members.length === 2 && x.members[0].pillar === "year" && x.members[1].pillar === "month" && x.members[0].part === part)
      .map((x) => x.type + (x.punishmentKind ? `/${x.punishmentKind}` : "")).sort().join(",")
  it("천간 10×10", () => {
    const C = new Set(["甲己", "乙庚", "丙辛", "丁壬", "戊癸"]), X = new Set(["甲庚", "乙辛", "丙壬", "丁癸"])
    for (const s1 of STEMS) for (const s2 of STEMS) {
      const k = STEMS.indexOf(s1) <= STEMS.indexOf(s2) ? s1 + s2 : s2 + s1
      const exp = [C.has(k) ? "stemCombine" : "", X.has(k) ? "stemClash" : ""].filter(Boolean).sort().join(",")
      const a = analyzeRules(chartOf(withStem(s1), withStem(s2), P("甲子"), null))
      expect(types(a, "stem"), `${s1}${s2}`).toBe(exp)
    }
  })
  it("지지 12×12 (명세 표 글자 그대로)", () => {
    const has = (list: string[], x: string, y: string) => list.includes(x + y) || list.includes(y + x)
    const six = ["子丑", "寅亥", "卯戌", "辰酉", "巳申", "午未"], clash = ["子午", "丑未", "寅申", "卯酉", "辰戌", "巳亥"]
    const brk = ["子酉", "丑辰", "寅亥", "卯午", "巳申", "未戌"], harm = ["子未", "丑午", "寅巳", "卯辰", "申亥", "酉戌"]
    const half = ["申子", "子辰", "亥卯", "卯未", "寅午", "午戌", "巳酉", "酉丑"]
    const pun3 = ["寅巳", "巳申", "寅申", "丑戌", "戌未", "丑未"]
    for (const x of BRANCHES) for (const y of BRANCHES) {
      const exp: string[] = []
      if (has(six, x, y)) exp.push("sixCombine")
      if (has(half, x, y)) exp.push("halfCombine")
      if (has(clash, x, y)) exp.push("clash")
      if (has(pun3, x, y)) exp.push("punishment/three")
      if (has(["子卯"], x, y)) exp.push("punishment/mutual")
      if (x === y && "辰午酉亥".includes(x)) exp.push("punishment/self")
      if (has(brk, x, y)) exp.push("break")
      if (has(harm, x, y)) exp.push("harm")
      const a = analyzeRules(chartOf(withBranch(x), withBranch(y), P("甲子"), null))
      expect(types(a, "branch"), `${x}${y}`).toBe(exp.sort().join(","))
    }
  })
  it("겹침 동시 기록: 寅申 충·형, 寅亥 합·파, 寅巳 형·해", () => {
    const t = (x: string, y: string) => types(analyzeRules(chartOf(withBranch(x), withBranch(y), P("甲子"), null)), "branch")
    expect(t("寅", "申")).toBe("clash,punishment/three")
    expect(t("寅", "亥")).toBe("break,sixCombine")
    expect(t("寅", "巳")).toBe("harm,punishment/three")
  })
})

describe("시주 모름 (rules-spec §0)", () => {
  const c = computeChart({ calendar: "solar", year: 1985, month: 3, day: 21, time: null, timezone: "Asia/Seoul", gender: "F" })
  const a = analyzeRules(c, undefined, { luck: [P("丙子")], year: P("甲午") })
  it("omitted·hidden·십성·12운성·관계·공망·오행 모두 시주 없음", () => {
    expect(c.pillars.hour).toBeNull()
    expect(a.omitted).toEqual(["hour"])
    expect(a.source.natal.hour).toBeNull()
    expect(a.hiddenStems.pillars.hour).toBeNull()
    const touchesHour = (p: { pillar: string }) => p.pillar === "hour"
    expect(a.tenGods.some((t) => touchesHour(t.position))).toBe(false)
    expect(a.twelveStages.some((t) => touchesHour(t.position))).toBe(false)
    expect(a.interactions.some((x) => x.members.some(touchesHour))).toBe(false)
    expect(a.gongmang.some((g) => g.hits.some(touchesHour))).toBe(false)
    expect(Object.values(a.elements.counts).reduce((n, v) => n + v, 0)).toBe(6)
    expect(a.elements.yinYang.yang + a.elements.yinYang.yin).toBe(6)
    expect(Object.values(a.elements.weighted).reduce((n, v) => n + v, 0)).toBeCloseTo(3 + 1 + 3 + 1.5, 5)
  })
})

describe("입력 오류 → EngineInputError (rules-spec §0)", () => {
  const bad: [string, () => unknown][] = [
    ["hiddenStemTable 오타", () => analyzeRules(TEMPLATE, { hiddenStemTable: "kr-monthly-31" as never })],
    ["branchYinYang 잘못", () => analyzeRules(TEMPLATE, { branchYinYang: "x" as never })],
    ["twelveStagesYin 잘못", () => analyzeRules(TEMPLATE, { twelveStagesYin: "forward" as never })],
    ["earthStages 잘못", () => analyzeRules(TEMPLATE, { earthStages: "withMetal" as never })],
    ["strengthModel 잘못", () => analyzeRules(TEMPLATE, { strengthModel: "weighted-v2" as never })],
    ["gongmangBasis 잘못", () => analyzeRules(TEMPLATE, { gongmangBasis: "month" as never })],
    ["halfCombine 잘못", () => analyzeRules(TEMPLATE, { halfCombine: "none" as never })],
    ["partialPunishment 문자열", () => analyzeRules(TEMPLATE, { partialPunishment: "true" as never })],
    ["partialDirectional 숫자", () => analyzeRules(TEMPLATE, { partialDirectional: 1 as never })],
    ["wuWeiCombine 잘못", () => analyzeRules(TEMPLATE, { wuWeiCombine: "water" as never })],
    ["옵션 null 값", () => analyzeRules(TEMPLATE, { hiddenStemTable: null } as never)],
    ["partialPunishment null", () => analyzeRules(TEMPLATE, { partialPunishment: null } as never)],
    ["옵션이 문자열", () => analyzeRules(TEMPLATE, "kr" as never)],
    ["모르는 옵션 키", () => analyzeRules(TEMPLATE, { hiddenStemTabel: "main-only" } as never)],
    ["원국 천간 이상 글자", () => analyzeRules(chartOf(P("甲子"), P("丙寅"), { stem: "X" as never, branch: "子" }, null))],
    ["원국 지지 이상 글자", () => analyzeRules(chartOf(P("甲子"), { stem: "丙", branch: "Z" as never }, P("甲子"), null))],
    ["원국 한글 글자", () => analyzeRules(chartOf(P("甲子"), P("丙寅"), { stem: "갑" as never, branch: "자" as never }, null))],
    ["일주 없음", () => analyzeRules(chartOf(P("甲子"), P("丙寅"), null as never, null))],
    ["대운 글자 이상", () => analyzeRules(TEMPLATE, undefined, { luck: [{ stem: "甲", branch: "Q" as never }] })],
    ["대운이 배열 아님", () => analyzeRules(TEMPLATE, undefined, { luck: P("甲子") as never })],
    ["세운 글자 이상", () => analyzeRules(TEMPLATE, undefined, { year: { stem: "?" as never, branch: "子" } })],
    ["chart null", () => analyzeRules(null as never)],
  ]
  for (const [name, fn] of bad) it(name, () => {
    let err: unknown = null
    try { fn() } catch (e) { err = e }
    expect(err, `${name}: 예외 없음`).not.toBeNull()
    expect((err as Error).name, `${name}: ${(err as Error)?.message}`).toBe("EngineInputError")
    expect(err instanceof EngineInputError).toBe(true)
  })
  it("관찰: 값이 undefined인 옵션 키는 '지정 안 함'으로 보고 기본값을 쓴다(결과 options에 기본값 기록)", () => {
    const a = analyzeRules(TEMPLATE, { hiddenStemTable: undefined } as never)
    expect(a.options.hiddenStemTable).toBe("kr-monthly-30")
    expect(a.hiddenStems.tableId).toBe("kr-monthly-30")
  })
  it("관찰: 음양이 맞지 않는 간지(甲丑)는 60갑자에 없다 — 엔진 처리 기록", () => {
    let msg = "예외 없음"
    try { analyzeRules(chartOf(P("甲子"), P("丙寅"), P("甲丑"), null)) } catch (e) { msg = `${(e as Error).name}: ${(e as Error).message}` }
    console.log(`[관찰] 일주 甲丑 → ${msg}`)
  })
})

describe("결정성·입력 불변", () => {
  const charts = [
    computeChart({ calendar: "solar", year: 1987, month: 7, day: 15, time: { hour: 12, minute: 0 }, timezone: "Asia/Seoul", gender: "F" }),
    computeChart({ calendar: "solar", year: 2024, month: 2, day: 4, time: { hour: 17, minute: 40 }, timezone: "Asia/Seoul", gender: "M" }),
    computeChart({ calendar: "solar", year: 1958, month: 8, day: 8, time: null, timezone: "Asia/Seoul", gender: "F" }),
  ]
  charts.forEach((c, i) => it(`표본 ${i}: 두 번 호출 동일 · 얼린 입력에서도 동작 · 입력·옵션 변경 없음`, () => {
    const extra: RuleExtra = { luck: c.luck.daeun.map((d) => d.pillar), year: P("丙午") }
    const opts = { hiddenStemTable: "cn-lunarjs", gongmangBasis: "both", partialDirectional: true } as const
    const snap = structuredClone({ c, extra, opts })
    const a1 = analyzeRules(c, { ...opts }, extra)
    const a2 = analyzeRules(structuredClone(c), { ...opts }, structuredClone(extra))
    expect(JSON.stringify(a2)).toBe(JSON.stringify(a1))
    expect({ c, extra, opts }).toEqual(snap)
    const fc = deepFreeze(structuredClone(c)), fe = deepFreeze(structuredClone(extra)), fo = deepFreeze({ ...opts })
    const a3 = analyzeRules(fc, fo, fe)
    expect(JSON.stringify(a3)).toBe(JSON.stringify(a1))
    // 결과를 고쳐도 입력이 바뀌지 않아야 한다(참조 공유 없음)
    a1.source.natal.day.stem = "癸"
    if (a1.source.luck[0]) a1.source.luck[0].stem = "癸"
    a1.options.hiddenStemTable = "main-only"
    expect({ c, extra, opts }).toEqual(snap)
    const a4 = analyzeRules(c, { ...opts }, extra)
    expect(JSON.stringify(a4)).toBe(JSON.stringify(a2))
  }))
})
