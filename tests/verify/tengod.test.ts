// 2. TENGOD_MISMATCH — 일간 庚 기준(rules@0.2.0 기본 옵션: 지지 음양 byMainQi, 지장간 kr-monthly-30)
// 겉 글자: 庚 비견 · 辛 겁재 · 癸 상관 · 午 정관 · 巳 편관 · 辰 편인 · 未 정인 / 운 글자: 丁 정관 · 丑 정인 · 丙 편관 · 甲 편재 · 酉 겁재
import { describe, expect, it } from "vitest"
import { analyzeRules, computeChart } from "@/engine"
import { findingsOf, worst } from "./helpers"

const T = "TENGOD_MISMATCH" as const

describe("TENGOD 통과 예문", () => {
  const ok = [
    "월지 사(巳)는 편관이다.",
    "癸는 상관이라 말이 빠르다.",
    "정관인 午가 연지에 있다.",
    "2023년 대운의 丁은 정관이고 丑은 정인이다.",
    "辰은 편인, 未는 정인이다.",
    "올해 丙午는 편관의 해다.",
    "酉는 정관이 아니라 겁재다.",
    "그건 상관없다, 庚 일간은 그대로다.",
    "유금은 겁재다.",
    "재성인 甲은 대운에서 온다.",
    "연간 庚은 비견이다.",
  ]
  for (const t of ok)
    it(t, () => {
      expect(findingsOf(t, T)).toEqual([])
    })
})

describe("TENGOD 차단 예문", () => {
  const bad: [string, string][] = [
    ["酉=겁재를 정관이라 함", "유(酉)는 정관이라 규칙을 잘 지킨다."],
    ["癸=상관을 정인이라 함", "癸는 정인이다."],
    ["午=정관을 편재라 함(십성→글자 꼴)", "편재인 午가 연지에 있다."],
    ["辰=편인을 상관이라 함", "辰은 상관이다."],
    ["한글 오행 읽기 갑목=편재를 정관이라 함", "갑목은 정관이다."],
    ["기둥 丁丑(정관·정인)을 편재라 함", "丁丑은 편재다."],
    ["묶음 이름: 午(정관)를 재성이라 함", "午는 재성이다."],
    ["일간 庚을 편인이라 함", "일간 庚은 편인이다."],
  ]
  for (const [label, t] of bad)
    it(label, () => {
      const fs = findingsOf(t, T)
      expect(worst(fs), JSON.stringify(fs)).toBe("block")
      expect(fs[0].rule).toBe("mismatch")
    })
})

describe("TENGOD 불확실(info) — 지장간·학파 차이로만 맞는 경우", () => {
  it("巳를 비견이라 함 — 巳의 지장간 庚이면 비견(겉 글자는 편관)", () => {
    expect(worst(findingsOf("巳는 비견이다.", T))).toBe("info")
  })
  it("子를 식신이라 함 — 지지 음양 byOrder 학파면 식신(기본 byMainQi는 상관)", () => {
    expect(worst(findingsOf("2033년 대운의 子는 식신이다.", T))).toBe("info")
  })
})

describe("ctx.rules(analyzeRules 결과)를 넘기면 그 결과로 대조", () => {
  const chart = computeChart({ calendar: "solar", year: 1990, month: 5, day: 15, time: { hour: 14, minute: 0 }, timezone: "Asia/Seoul", gender: "F" })
  it("기본 옵션: 子=상관 → '子는 상관' 통과", () => {
    const rules = analyzeRules(chart)
    expect(findingsOf("2033년 대운의 子는 상관이다.", T, { rules })).toEqual([])
  })
  it("byOrder 옵션으로 계산한 rules면 子=식신 → '子는 식신' 통과, '子는 상관'은 info", () => {
    const rules = analyzeRules(chart, { branchYinYang: "byOrder" })
    expect(findingsOf("2033년 대운의 子는 식신이다.", T, { rules })).toEqual([])
    expect(worst(findingsOf("2033년 대운의 子는 상관이다.", T, { rules }))).toBe("info")
  })
  it("ctx.chart만 넘겨도 analyzeRules로 계산해 같은 판정", () => {
    expect(worst(findingsOf("유(酉)는 정관이다.", T, { chart }))).toBe("block")
    expect(findingsOf("월지 사(巳)는 편관이다.", T, { chart })).toEqual([])
  })
})
