// 품질검증 P3-05 — 명세 공백(엔진 개발자가 정한 점)의 현재 동작을 고정·기록한다.
// 연구소장 결정이 나오면 이 파일의 기대값을 그 결정에 맞게 바꾼다.
import { describe, expect, it } from "vitest"
import { analyzeRules, computeChart, type CalendarResult, type Pillar } from "@/engine"

const TEMPLATE = computeChart({ calendar: "solar", year: 1990, month: 5, day: 5, time: { hour: 10, minute: 0 }, timezone: "Asia/Seoul", gender: "M" })
const P = (s: string): Pillar => ({ stem: s[0] as Pillar["stem"], branch: s[1] as Pillar["branch"] })
function chartOf(y: string, m: string, d: string, h: string | null): CalendarResult {
  const c = structuredClone(TEMPLATE)
  c.pillars = { year: P(y), month: P(m), day: P(d), hour: h ? P(h) : null }
  c.hourKnown = h !== null
  return c
}
const brief = (a: ReturnType<typeof analyzeRules>, types: string[]) =>
  a.interactions.filter((x) => types.includes(x.type)).map((x) => `${x.type}:${x.members.map((m) => m.pillar + (m.luckIndex ?? "")).join("-")}:${x.chars.join("")}:adj=${x.adjacent}`)

const sub = (a: ReturnType<typeof analyzeRules>, type: string, pillars: string) =>
  a.interactions.find((x) => x.type === type && x.members.map((m) => m.pillar + (m.luckIndex ?? "")).join("-") === pillars)

describe("D-019 포함 표시(총괄실장 확정) — 두 글자 기록 보존 + subsumedBy", () => {
  it("붙은 반합(연申·월子)이 떨어진 삼합(연·월·시辰)과 함께 남고 subsumedBy로 표시된다 → 거리 정보 보존", () => {
    const a = analyzeRules(chartOf("庚申", "丙子", "丁卯", "甲辰"))
    const r = brief(a, ["halfCombine", "threeCombine"])
    console.log("[D-019/거리]", JSON.stringify(r))
    expect(r).toContain("threeCombine:year-month-hour:申子辰:adj=false")
    expect(r).toContain("halfCombine:year-month:申子:adj=true")
    expect(r).toContain("halfCombine:month-hour:子辰:adj=false")
    const three = "branch.threeCombine.申子辰@year.branch+month.branch+hour.branch"
    expect(sub(a, "halfCombine", "year-month")?.subsumedBy).toEqual([three])
    expect(sub(a, "halfCombine", "month-hour")?.subsumedBy).toEqual([three])
  })
  it("원국 두 글자 + 운 한 글자로 완성: 원국 반합·운 낀 반합 모두 남고 둘 다 표시(대칭)", () => {
    const a = analyzeRules(chartOf("庚申", "丙子", "丁卯", "乙巳"), undefined, { luck: [P("甲辰")] })
    const r = brief(a, ["halfCombine", "threeCombine"])
    console.log("[D-019/운]", JSON.stringify(r))
    const three = "branch.threeCombine.申子辰@year.branch+month.branch+daeun0.branch"
    expect(sub(a, "halfCombine", "year-month")?.subsumedBy).toEqual([three])
    expect(sub(a, "halfCombine", "month-daeun0")?.subsumedBy).toEqual([three])
    expect(sub(a, "threeCombine", "year-month-daeun0")?.scope).toBe("luck")
  })
  it("두 글자 삼형도 같은 규칙: 寅巳申 완성 시 두 글자 삼형 3개 보존·표시, 충(寅申)·해(寅巳)·합파(巳申)는 표시 없음", () => {
    const a = analyzeRules(chartOf("甲寅", "己巳", "丙申", "甲午"))
    const pun = a.interactions.filter((x) => x.type === "punishment")
    console.log("[D-019/삼형]", JSON.stringify(pun.map((x) => `${x.members.map((m) => m.pillar).join("-")}:${x.chars.join("")}:${(x.subsumedBy ?? []).join("|")}`)))
    expect(pun.length).toBe(4)
    for (const x of pun.filter((y) => y.members.length === 2)) expect(x.subsumedBy).toEqual(["branch.punishment.寅巳申@year.branch+month.branch+day.branch"])
    for (const x of a.interactions.filter((y) => ["clash", "harm", "sixCombine", "break"].includes(y.type))) expect(x.subsumedBy).toBeUndefined()
  })
  it("같은 쌍을 포함하는 세 글자 조합이 여럿이면 전부 적는다 (申 子 辰 辰)", () => {
    const a = analyzeRules(chartOf("庚申", "丙子", "甲辰", "戊辰"))
    expect(sub(a, "halfCombine", "month-day")?.subsumedBy).toEqual(["branch.threeCombine.申子辰@year.branch+month.branch+day.branch"]) // 子辰(월·일)은 연申·월子·일辰 하나에만 포함
    const ym = sub(a, "halfCombine", "year-month")
    expect(ym?.subsumedBy?.length).toBe(2)
  })
})

describe("운 비교 범위(명세 공백) — 현재 동작", () => {
  it("대운끼리는 비교하지 않고, 대운–세운은 비교한다", () => {
    const a = analyzeRules(chartOf("甲寅", "丙寅", "戊寅", null), undefined, { luck: [P("甲子"), P("庚午")], year: P("丙午") })
    const luckOnly = a.interactions.filter((x) => x.members.every((m) => m.pillar === "daeun" || m.pillar === "seun"))
    console.log("[운끼리]", JSON.stringify(luckOnly.map((x) => `${x.type}:${x.members.map((m) => m.pillar + (m.luckIndex ?? "")).join("-")}:${x.chars.join("")}`)))
    expect(luckOnly.some((x) => x.members.filter((m) => m.pillar === "daeun").length > 1)).toBe(false)
    expect(luckOnly.some((x) => x.type === "clash" && x.chars.join("") === "子午")).toBe(true) // 대운0 子 – 세운 午
  })
  it("12운성: 운 기둥 지지에도 봉법·좌법을 내는지 기록", () => {
    const a = analyzeRules(chartOf("甲寅", "丙寅", "戊寅", null), undefined, { luck: [P("甲子")], year: P("丙午") })
    const luck = a.twelveStages.filter((h) => h.position.pillar === "daeun" || h.position.pillar === "seun").map((h) => `${h.basis}:${h.position.pillar}:${h.stem}${h.branch}=${h.stage}`)
    console.log("[12운성/운]", JSON.stringify(luck))
    const own = a.twelveStages.filter((h) => h.basis === "ownPillar").map((h) => h.position.pillar)
    console.log("[12운성/좌법 기둥]", JSON.stringify(own))
  })
})

describe("오행 가중에 일간 포함(명세 해석 차이) — 현재 동작", () => {
  it("weighted 합 = 천간 4개×1.0 + 지지 위치가중 합(1+3+1.5+1) — 일간이 들어 있음", () => {
    const a = analyzeRules(chartOf("甲子", "丙寅", "戊辰", "庚午"))
    const sum = Object.values(a.elements.weighted).reduce((n, v) => n + v, 0)
    expect(sum).toBeCloseTo(4 + 6.5, 5)
    // schools.md §8 문구("천간(월·연·시) 각 1.0")대로라면 3 + 6.5 = 9.5
  })
})

// ─────────────────────────────── P3-06 (rules@0.3.0) — 명세와 다르거나 명세에 없는 점의 현재 동작 고정
const prim306 = (a: ReturnType<typeof analyzeRules>) => a.structure.candidates.find((c) => c.role === "primary")!
describe("P3-06 명세 공백·명세 본문 차이 — 현재 동작", () => {
  it("사례 7 재성파인: 명세 손계산은 '없음'이나 §5.1 규칙(재성·인성 천간이 이웃 기둥)상 연간 甲(편재)–월간 己(정인)로 성립 → 엔진 표시함", () => {
    const a = analyzeRules(chartOf("甲辰", "己巳", "庚戌", "丙子"))
    expect(a.qiFlow.clarityFlags.map((f) => f.flag)).toEqual(["재성파인"])
    expect(a.qiFlow.clarityFlags[0].members.map((m) => m.pillar)).toEqual(["year", "month"])
  })
  it("사례 11 agreement: 억부 byModel(B)는 agreement에 들어가지 않음(§6 타입은 method 목록) — 명세 문구 '수 = 통관·억부(B)'와 다름", () => {
    const a = analyzeRules(chartOf("庚申", "甲申", "甲寅", "癸酉"))
    expect(a.usefulGods.agreement).toEqual([{ element: "fire", methods: ["gyeokguk"] }, { element: "water", methods: ["tonggwan"] }])
  })
  it("상신 hiddenOnly: 투출이 있어도 지장간 위치를 함께 적는다(명세 사례 2·5·10 표기는 투출이 없을 때만 '지장간만')", () => {
    const a = analyzeRules(chartOf("戊寅", "辛酉", "甲寅", "乙亥")) // 사례 5 정관격
    const jae = prim306(a).sangsin!.find((g) => g.group === "jaeseong")!
    expect(jae.touchul.map((p) => p.pillar)).toEqual(["year"])
    expect(jae.hiddenOnly.map((p) => p.pillar)).toEqual(["year", "day", "hour"]) // 명세 사례 5: "재성(토) 투출 [연간 戊]"만
  })
  it("G1 戊·己 일간의 巳·午월: 정기가 인성이라 록겁 계열이 아님 → 록 표 戊巳·己午, 양인 표 戊午가 쓰이지 않음(명세 내부 모순)", () => {
    expect(prim306(analyzeRules(chartOf("甲子", "己巳", "戊辰", null))).name).toBe("편인격")
    expect(prim306(analyzeRules(chartOf("甲子", "庚午", "戊辰", null))).name).toBe("정인격")
    expect(prim306(analyzeRules(chartOf("甲子", "庚午", "己巳", null))).name).toBe("편인격")
  })
})
