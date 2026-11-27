// 1. BASIS_NOT_IN_CHART · YEAR_GANZHI_MISMATCH
// 원국(SAJU_1990F): 庚午 辛巳 庚辰 癸未 / 대운 庚辰 己卯 戊寅 丁丑(2023) 丙子 乙亥 甲戌 癸酉 / 2026 丙午 / 공망 申酉·戌亥
import { describe, expect, it } from "vitest"
import { findingsOf, readingOf, run, SAJU_MIN, worst } from "./helpers"

const CODES = ["BASIS_NOT_IN_CHART", "YEAR_GANZHI_MISMATCH"] as const

describe("BASIS 통과 예문(오탐 방지)", () => {
  const cases: [string, string, Parameters<typeof findingsOf>[2]?][] = [
    ["원국 기둥", "일주 庚辰은 젖은 흙 위에 선 쇠다."],
    ["문장에 적힌 해의 세운", "2015년 乙未에는 시지 未와 같은 글자가 와서 집안일이 겹쳤을 수 있다."],
    ["공망 지지", "공망인 申酉는 너에게 아무 일도 안 할 수 있다."],
    ["대운 + 운 표지", "2033년부터 丙子 대운이 온다."],
    ["나이로 밝힌 운 글자", "예순셋에 들어오는 甲戌 대운에는 甲이 재성으로 겉에 선다."],
    ["한글 간지 + 대운", "지금은 정축 대운의 한가운데다."],
    ["'정해 일주일' 같은 한글 일반어", "잠드는 시각을 정해 일주일만 지켜 봐라."],
    ["'갑자기'·'임신' 같은 한글 일반어", "갑자기 임신 소식이 들려도 놀라지 마라."],
    ["일반 한자어 子女·未來·回甲 (작은 원국)", "자녀(子女)와 미래(未來), 회갑(回甲) 이야기는 네가 물을 때 하마.", { sajuInput: SAJU_MIN }],
    ["『』 서명 안 글자 (작은 원국)", "『子平眞詮』 같은 책 이름의 글자는 근거로 세지 않는다.", { sajuInput: SAJU_MIN }],
    ["역사 사건 이름 (작은 원국)", "壬辰倭亂 같은 옛 난리 이야기는 이 풀이와 상관이 없다.", { sajuInput: SAJU_MIN }],
    ["지장간이라고 밝힌 글자 (작은 원국)", "일지 辰 속에 乙이 숨어 있다.", { sajuInput: SAJU_MIN }],
  ]
  for (const [label, text, ctx] of cases)
    it(label, () => {
      expect(findingsOf(text, [...CODES], ctx)).toEqual([])
    })

  it("chips.letter의 대운 글자는 운 표지 없이도 통과(간지 전용 칸)", () => {
    expect(run(readingOf("丁丑 대운의 이야기다.", { letter: "丁丑" })).findings.filter((f) => f.code === "BASIS_NOT_IN_CHART")).toEqual([])
  })
  it("years[].ganzhi가 그해 세운과 같으면 통과", () => {
    const r = run({ years: [{ year: 2027, ganzhi: "丁未", element: "fire", title: "", text: "丁未년은 未가 겹친다." }] })
    expect(r.findings.filter((f) => (CODES as readonly string[]).includes(f.code))).toEqual([])
  })
  it("claims의 when 연도는 같은 항목 letter의 문맥이 된다(2011 辛卯)", () => {
    const r = run({ claims: [{ id: "p1", when: "2011년", claim: "그해 학교가 바뀌었다.", basis: "卯가 연지 午와 파", era: "", letter: "卯", is_hour_test: false, if_yes: "", if_no: "" }] })
    expect(r.findings.filter((f) => f.code === "BASIS_NOT_IN_CHART")).toEqual([])
  })
})

describe("BASIS 차단 예문(미탐 방지)", () => {
  const blocks: [string, string, string, Parameters<typeof findingsOf>[2]?][] = [
    ["없는 기둥(글자는 각각 대운에 있음)", "乙酉 일주라 칼날 위의 꽃이다.", "BASIS_NOT_IN_CHART"],
    ["어디에도 없는 천간", "壬水가 너를 돕는다.", "BASIS_NOT_IN_CHART"],
    ["연도와 간지 불일치", "2015년 丙申에 이사를 했다.", "YEAR_GANZHI_MISMATCH"],
    ["괄호 표기 연도 불일치", "2027년(戊申)에는 일이 몰린다.", "YEAR_GANZHI_MISMATCH"],
    ["한글 간지 + 년 (없는 기둥)", "갑자년에 태어난 너는 첫 글자부터 나무다.", "BASIS_NOT_IN_CHART"],
    ["작은 원국에서 대운 글자", "丁丑의 기운이 너를 받친다.", "BASIS_NOT_IN_CHART", { sajuInput: SAJU_MIN }],
    ["작은 원국에 없는 지지", "寅이 연지와 부딪친다.", "BASIS_NOT_IN_CHART", { sajuInput: SAJU_MIN }],
  ]
  for (const [label, text, code, ctx] of blocks)
    it(label, () => {
      const fs = findingsOf(text, [...CODES], ctx)
      expect(fs.some((f) => f.code === code && f.severity === "block"), JSON.stringify(fs)).toBe(true)
      for (const f of fs) expect([...f.excerpt].length).toBeLessThanOrEqual(40)
    })

  it("chips.letter의 없는 간지", () => {
    const fs = run(readingOf("庚辰 일주다.", { letter: "壬寅" })).findings
    expect(fs.some((f) => f.code === "BASIS_NOT_IN_CHART" && f.location.path === "parts[0].chapters[0].chips[0].letter" && f.severity === "block")).toBe(true)
  })
  it("years[].ganzhi가 그해 세운과 다름", () => {
    const fs = run({ years: [{ year: 2027, ganzhi: "戊申", element: "earth", title: "", text: "" }] }).findings
    expect(fs.filter((f) => f.code === "YEAR_GANZHI_MISMATCH").map((f) => f.location.path)).toEqual(["years[0].ganzhi"])
  })
  it("daeun_overview의 간지·시작 해가 계산값과 다름", () => {
    const fs = run({
      daeun_overview: [
        { ganzhi: "壬午", start_year: 2023, start_age: 33, end_age: 42, name: "", theme: "", best: "", do_this: "" },
        { ganzhi: "丁丑", start_year: 2024, start_age: 34, end_age: 43, name: "", theme: "", best: "", do_this: "" },
      ],
    }).findings.filter((f) => f.code === "BASIS_NOT_IN_CHART")
    expect(fs.map((f) => f.rule)).toEqual(["daeun", "daeun-start"])
  })
  it("원국에 없고 대운에만 있는 글자를 운 표지 없이 쓰면 warn", () => {
    const fs = findingsOf("甲이 너의 재성이다.", "BASIS_NOT_IN_CHART")
    expect(worst(fs)).toBe("warn")
    expect(fs[0].rule).toBe("luck-unmarked")
  })
  it("지장간에만 있는 글자를 지장간이라 밝히지 않으면 warn (작은 원국)", () => {
    const fs = findingsOf("乙이 너의 재성이다.", "BASIS_NOT_IN_CHART", { sajuInput: SAJU_MIN })
    expect(worst(fs)).toBe("warn")
    expect(fs[0].rule).toBe("hidden-only")
  })
  it("같은 원국이라도 시주 모름이면 시주 글자(癸未)는 근거가 될 수 없다", () => {
    const fs = findingsOf("시주 癸未가 말을 벼린다.", "BASIS_NOT_IN_CHART", { sajuInput: SAJU_MIN })
    expect(worst(fs)).toBe("block")
  })
})
