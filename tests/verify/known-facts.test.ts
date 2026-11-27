// 8. KNOWN_FACT_AS_PREDICTION — 원칙 2
import { describe, expect, it } from "vitest"
import { findingsOf, run, worst } from "./helpers"
import { SAJU_1990F } from "./fixtures"

const K = "KNOWN_FACT_AS_PREDICTION" as const
const ctx = {
  sajuInput: { ...SAJU_1990F, known_facts: ["2019년 결혼"] },
  userFacts: [{ id: "life_event:move", label: "이사", value: "move", period: { fromYear: 2021, toYear: 2021 } }],
}

describe("KNOWN_FACT 통과 예문", () => {
  const ok = [
    "2019년에 결혼한 적이 있느냐?",
    "2022년에 이사를 했다.",
    "결혼운은 丁丑 대운에 무게가 실린다.",
    "2019년 己亥에는 일이 바빴다.",
    "2020년 庚子에 짝을 맺었다.",
  ]
  for (const t of ok)
    it(t, () => {
      expect(findingsOf(t, K, ctx)).toEqual([])
    })
  it("알려 준 사실이 없으면 검사하지 않는다", () => {
    expect(findingsOf("2019년에 결혼했다.", K)).toEqual([])
  })
})

describe("KNOWN_FACT 걸러야 할 예문(warn)", () => {
  const bad = [
    "2019년에 결혼을 했다.",
    "2019년 己亥에 짝을 맺었다.",
    "2021년에 사는 곳이 바뀌었다.",
    "2019년, 식을 올린 해다.",
  ]
  for (const t of bad)
    it(t, () => {
      expect(worst(findingsOf(t, K, ctx))).toBe("warn")
    })
  it("지나온 길 단정(claims)의 when 연도도 대조", () => {
    const r = run({ claims: [{ id: "p1", when: "2019년", claim: "이 해에 혼인으로 집안이 바뀌었다.", basis: "亥가 巳와 충", era: "", letter: "巳亥충", is_hour_test: false, if_yes: "", if_no: "" }] }, ctx)
    expect(r.findings.filter((f) => f.code === K).map((f) => f.location.path)).toEqual(["claims[0].claim"])
  })
  it("연도 없는 사실은 지난 일 단정(과거형)일 때만", () => {
    const c = { sajuInput: { ...SAJU_1990F, known_facts: ["이직함"] } }
    expect(worst(findingsOf("직장을 옮겼다.", K, c))).toBe("warn")
    expect(findingsOf("이직은 丁丑 대운에 생각해 볼 일이다.", K, c)).toEqual([])
  })
})
