// P10(명리 감수 2026-11-27 §2-5): 용신 사실표 — 특수격 관점 제외 · 관점별 고정 머리말 — 담당: 백엔드·서버 개발자
import { describe, expect, it } from "vitest"
import { analyzeRules, computeChart } from "../../index"
import type { BirthInput } from "../../index"
import type { RuleAnalysis } from "../../rules/types"
import { buildFactSheet, readUsefulGods, USEFUL_GOD_HEADER } from "../facts"

const AS_OF = new Date("2026-11-27T03:00:00Z")
// 실제 엔진 출력에서 특수격 view가 status "ok"인 사례(rules@0.3.0에서 확인, rules@0.4.0에서도 이 테스트로 재확인):
// 특수격 1순위 wood · 억부 1순위 fire · 격국(상신) 1순위 water — 셋이 모두 다르다
const SPECIAL_BIRTH: BirthInput = { calendar: "solar", year: 1951, month: 3, day: 10, time: { hour: 1, minute: 30 }, gender: "M" }

const HEADERS = Object.values(USEFUL_GOD_HEADER)

describe("P10 특수격 관점은 사실표에 넣지 않는다", () => {
  const chart = computeChart(SPECIAL_BIRTH)
  const rules = analyzeRules(chart)

  it("전제: 이 사례는 엔진에서 특수격 view가 ok이고 억부와 1순위가 다르다", () => {
    const sp = rules.usefulGods.views.find((v) => v.method === "special")!
    const eo = rules.usefulGods.views.find((v) => v.method === "eokbu")!
    expect(sp.status).toBe("ok")
    expect(sp.candidates[0].element).toBe("wood")
    expect(eo.candidates[0].element).toBe("fire")
  })

  it("사실표 usefulGod에 특수격 줄이 없다", () => {
    const f = buildFactSheet({ chart, rules, asOf: AS_OF })
    const ug = f.chart.usefulGod!
    expect(ug.length).toBeGreaterThan(0)
    for (const u of ug) {
      expect(u.method).not.toMatch(/특수격|special|종격|화격/)
      expect(HEADERS).toContain(u.method)
    }
    // 특수격만 낸 오행(wood)이 다른 관점 1순위로도 나오지 않으면 사실표 어디에도 없다
    const others = rules.usefulGods.views.filter((v) => v.method !== "special" && v.status === "ok").map((v) => v.candidates[0].element)
    if (!others.includes("wood")) expect(ug.map((u) => u.element)).not.toContain("목")
    expect(JSON.stringify(f)).not.toMatch(/특수격/)
  })

  it("label만 특수격인 view·초안 usefulGodCandidates의 special도 뺀다(방어)", () => {
    const strip = { ...rules } as Record<string, unknown>
    delete strip.usefulGods
    const draft = { ...strip, usefulGodCandidates: [{ element: "wood", method: "special" }, { element: "fire", method: "eokbu" }] } as unknown as RuleAnalysis
    expect(readUsefulGods(draft)).toEqual([{ method: "힘의 균형으로 보면(억부)", element: "화" }])
    const odd = { ...strip, usefulGods: { views: [{ method: "x", label: "특수격 관점(후보)", status: "ok", candidates: [{ element: "wood", rank: 1 }] }] } } as unknown as RuleAnalysis
    expect(readUsefulGods(odd)).toBeUndefined()
  })
})

describe("P10 관점별 고정 머리말로 나란히(D2 추천안)", () => {
  const chart = computeChart(SPECIAL_BIRTH)
  const rules = analyzeRules(chart)
  const f = buildFactSheet({ chart, rules, asOf: AS_OF })
  const ug = f.chart.usefulGod!

  it("억부와 격국(상신)이 서로 다른 머리말의 다른 줄로 나온다", () => {
    const eok = ug.filter((u) => u.method === "힘의 균형으로 보면(억부)")
    const gyeok = ug.filter((u) => u.method === "격국으로 보면(상신)")
    expect(eok).toEqual([{ method: "힘의 균형으로 보면(억부)", element: "화" }])
    expect(gyeok).toEqual([{ method: "격국으로 보면(상신)", element: "수" }])
  })

  it("머리말은 엔진 label 문구가 아니라 관점 코드로 고정된다", () => {
    const fake = {
      ...rules,
      usefulGods: {
        views: [
          { method: "eokbu", label: "아무 문구", status: "ok", candidates: [{ element: "earth", rank: 1 }] },
          { method: "johuClimate", label: "다른 문구", status: "ok", candidates: [{ element: "water", rank: 1 }] },
          { method: "gyeokguk", label: "용신", status: "ok", candidates: [{ element: "metal", rank: 1 }] },
          { method: "special", label: "특수격 관점(후보)", status: "ok", candidates: [{ element: "wood", rank: 1 }] },
          { method: "tonggwan", label: "통관", status: "none", candidates: [] },
        ],
      },
    } as unknown as RuleAnalysis
    expect(readUsefulGods(fake)).toEqual([
      { method: "힘의 균형으로 보면(억부)", element: "토" },
      { method: "계절로 보면(조후·간이)", element: "수" },
      { method: "격국으로 보면(상신)", element: "금" },
    ])
  })

  it("관점마다 머리말이 한 번씩만(같은 줄에 섞이지 않음)", () => {
    const heads = ug.map((u) => u.method)
    expect(new Set(heads).size).toBe(heads.length)
  })
})
