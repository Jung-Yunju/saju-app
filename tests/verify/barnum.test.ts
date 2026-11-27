// 5. BARNUM — 근거 표지 없는 상투 문장, 장별 비율
import { describe, expect, it } from "vitest"
import { findingsOf, readingOf, run } from "./helpers"

const B = "BARNUM" as const

describe("BARNUM 통과 예문", () => {
  const ok = [
    "월지 사(巳)가 편관이라 규칙을 먼저 챙긴다.",
    "2023년부터 丁丑 대운이 들어와 책임이 늘었다.",
    "불 기운이 세서 여름에 지치기 쉽다.",
    "일간 경(庚)은 비견이 곁에 있어 혼자서도 버틴다.",
    "도화가 있어 사람을 끄는 힘이 있다.",
    "축오 원진이 있는 해에는 약속을 적어 두어라.",
    // 셋 중 하나만 근거 없음(33%) → 비율 경고 없음, 상투 사전에도 안 걸림
    "庚辰 일주는 단단하다. 癸가 말을 벼린다. 그러니 오늘은 쉬어도 된다.",
  ]
  for (const t of ok)
    it(t, () => {
      expect(findingsOf(t, B)).toEqual([])
    })
})

describe("BARNUM 걸러야 할 예문(warn)", () => {
  const bad = [
    "누구나 겉으로는 강해 보여도 속은 여리다.",
    "때로는 외롭고 불안할 때가 있다.",
    "자연을 가까이하고 볕을 쬐어라.",
    "노력하면 좋은 결과가 온다.",
    "너는 인정받고 싶은 마음이 크다.",
    "너에게는 큰 잠재력이 있다.",
    "충분히 쉬어라.", // '충'분히가 충(沖) 근거 표지로 잘못 세이지 않는지
  ]
  for (const t of bad)
    it(t, () => {
      const fs = findingsOf(t, B)
      expect(fs.some((f) => f.rule === "phrase" && f.severity === "warn"), JSON.stringify(fs)).toBe(true)
    })

  it("장별 근거 없는 문장 비율이 기준(50%)을 넘으면 문장 목록과 함께 warn", () => {
    const fs = findingsOf("庚辰 일주는 단단하다. 사람을 아껴라. 마음을 다잡아라.", B)
    const ratio = fs.find((f) => f.rule === "ratio")!
    expect(ratio.severity).toBe("warn")
    expect(ratio.message).toContain("2/3")
    expect(ratio.message).toContain("「사람을 아껴라.」")
    expect(ratio.location.path).toBe("parts[0].chapters[0]")
  })
  it("기준값은 ctx.options.barnumRatio로 바꿀 수 있다", () => {
    const text = "庚辰 일주는 단단하다. 사람을 아껴라. 마음을 다잡아라."
    expect(findingsOf(text, B, { options: { barnumRatio: 0.7 } }).filter((f) => f.rule === "ratio")).toEqual([])
  })
  it("todo·ask는 비율 계산에서 뺀다", () => {
    const r = run(readingOf("월지 사(巳)가 편관이다.", { todo: "물을 마셔라.", ask: "요즘 어떠냐?" }))
    expect(r.findings.filter((f) => f.code === B)).toEqual([])
    expect(r.stats.barnumByChapter[0]).toMatchObject({ sentences: 1, unmarked: 0 })
  })
})
