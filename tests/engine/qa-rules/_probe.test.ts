import { it } from "vitest"
import { analyzeRules, computeChart, type Pillar } from "@/engine"
import * as O from "./strength-oracle"
const T0 = computeChart({ calendar: "solar", year: 1990, month: 5, day: 5, time: { hour: 10, minute: 0 }, timezone: "Asia/Seoul", gender: "M" })
const P = (s: string): Pillar => ({ stem: s[0] as Pillar["stem"], branch: s[1] as Pillar["branch"] })
it("probe", () => {
  for (const s of ["庚子 戊寅 庚辰 -", "癸未 己未 辛巳 -", "己卯 己亥 辛亥 癸卯"]) {
    const [y, m, d, h] = s.split(" ")
    const n = { year: P(y), month: P(m), day: P(d), hour: h === "-" ? null : P(h) }
    const c = structuredClone(T0); c.pillars = n
    const a = analyzeRules(c)
    const C = a.strength.models[2]
    const oc = O.modelA(n, "kr-monthly-30", true)
    console.log(s, "engine C", C.ratio, C.score, C.support, C.total, "oracle", oc.ratio, oc.Su, oc.Tu, oc.ratio * 1000, "weighted", JSON.stringify(a.elements.weighted), JSON.stringify(O.weightedEls(n, "kr-monthly-30")), JSON.stringify(a.usefulGods.views.find((v) => v.method === "tonggwan")!.basis.map((b) => [b.ruleId, b.values])))
  }
})
