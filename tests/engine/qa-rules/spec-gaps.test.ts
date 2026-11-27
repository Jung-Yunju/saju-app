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

describe("포섭 규칙(명세 공백) — 현재 동작", () => {
  it("붙은 반합(연申·월子)이 떨어진 삼합(연·월·시辰)에 포섭되어 사라진다 → 붙어 있음 정보 손실", () => {
    const a = analyzeRules(chartOf("庚申", "丙子", "丁卯", "甲辰"))
    const r = brief(a, ["halfCombine", "threeCombine"])
    console.log("[포섭/거리]", JSON.stringify(r))
    expect(r).toContain("threeCombine:year-month-hour:申子辰:adj=false")
    expect(r.some((x) => x.startsWith("halfCombine:year-month"))).toBe(false) // adjacent=true 반합 기록 없음
  })
  it("원국 두 글자 + 운 한 글자로 완성되면 원국 반합은 남고, 운이 낀 두 글자 기록은 빠진다", () => {
    const a = analyzeRules(chartOf("庚申", "丙子", "丁卯", "乙巳"), undefined, { luck: [P("甲辰")] })
    const r = brief(a, ["halfCombine", "threeCombine"])
    console.log("[포섭/운]", JSON.stringify(r))
    expect(r).toContain("halfCombine:year-month:申子:adj=true")
    expect(r).toContain("threeCombine:year-month-daeun0:申子辰:adj=false")
    expect(r.some((x) => x.startsWith("halfCombine:month-daeun0"))).toBe(false) // 子辰(운 낌) 빠짐
  })
  it("두 글자 삼형도 같은 규칙: 寅巳申 완성 시 원국 안 두 글자 삼형 없음, 충(寅申)·해(寅巳)는 남음", () => {
    const a = analyzeRules(chartOf("甲寅", "己巳", "丙申", "甲午"))
    const r = brief(a, ["punishment", "clash", "harm", "sixCombine", "break"])
    console.log("[포섭/삼형]", JSON.stringify(r))
    expect(r.filter((x) => x.startsWith("punishment"))).toEqual(["punishment:year-month-day:寅巳申:adj=true"])
    expect(r).toContain("clash:year-day:寅申:adj=false")
    expect(r).toContain("harm:year-month:寅巳:adj=true")
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
