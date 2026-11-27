// 구조 경계·성능·결정론 (독립 검증)
import { describe, expect, it } from "vitest"
import { verifyReading } from "@/engine/verify"
import { verifyChapter } from "@/engine/verify/adapters"
import { brief, ctxOf, oneChapter, run } from "./fixtures"

const GOOD_PARAS = [
  "할미가 네 여덟 글자를 펴 보니, 일간이 <b>庚金</b>이고 일지가 辰土라 바위가 젖은 흙 위에 단단히 앉은 모양이란다. 월지 巳火와 연지 午火가 여름 불을 지펴서 쇠를 달구니, 네가 일을 맡으면 끝까지 벼리는 사람이 되는 거지.",
  "시주 癸未를 보면 癸水가 상관이라 말과 손재주로 드러내는 힘이 있단다. 未土는 정인이라 그 말에 뿌리를 대 주니, 배운 것을 남에게 가르치는 일과 잘 맞는다.",
  "2023년부터 들어온 丁丑 대운은 丁火가 정관이고 丑土가 정인이라, 위에서 맡기는 일과 자격을 갖추는 일이 함께 들어오는 십 년이란다.",
  "올해 丙午년은 丙火가 편관, 午火가 정관이라 바깥에서 너를 시험하는 일이 잦단다. 원국에도 午가 연지에 있으니 불기운이 한층 짙어지는 해지.",
  "일지 辰은 편인이라 혼자 깊이 파고드는 공부에 힘이 실린단다. 시간 癸는 상관이라 그 공부를 말로 풀어내는 재주가 되고, 연지 午는 정관이라 바깥 자리에서 이름을 얻게 하지.",
  "辰土 속에 든 癸水와 乙木이 습기를 머금고 있어서, 더운 해에는 속이 쉽게 더부룩해질 수 있단다. 소화가 오래 불편하면 병원에 가 보거라.",
]

function bigReading(chapters = 30) {
  const parts = [0, 1, 2].map((p) => ({
    title: `${p + 1}마당`,
    chapters: Array.from({ length: chapters / 3 }, (_, j) => ({
      key: `p${p}c${j}`,
      title: `${p * 10 + j + 1}장 庚金 이야기`,
      sub: "네 글자에서 읽은 것",
      chips: [{ letter: "庚", element: "metal", label: "일간" }, { letter: "辰", element: "earth", label: "일지" }],
      body: GOOD_PARAS.map((x) => x),
      todo: "이번 주에는 庚金처럼 하나를 끝까지 다듬어 보거라.",
      ask: "요즘 맡은 일 중에 끝까지 벼리고 싶은 게 있느냐?",
    })),
  }))
  return { cover_title: "庚金 할미 풀이", parts, years: [{ year: 2026, ganzhi: "丙午", text: "丙火 편관이 들어오는 해란다." }, { year: 2027, ganzhi: "丁未", text: "丁火 정관과 未土 정인이 오는 해란다." }] }
}

describe("독립 검증 — 구조 경계", () => {
  it("객체가 아닌 입력은 MALFORMED block", () => {
    for (const bad of [null, undefined, 42, "문자열", [], [{ parts: [] }]]) {
      const rep = run(bad)
      expect(rep.pass).toBe(false)
      expect(rep.findings[0].code).toBe("MALFORMED_READING")
    }
  })

  it("빈 장·이상한 칸 타입에도 예외 없이 끝난다", () => {
    const weird = {
      parts: [
        { title: "", chapters: [] },
        { chapters: [{}, { body: [] }, { body: [123, null, "", "   ", { x: "庚金" }] }, { body: "body가 문자열 하나인 경우 庚金" }, { chips: [{ letter: 5 }, null] }] },
        null,
        { chapters: null },
      ],
      years: "not-array",
      daeun_overview: [{ ganzhi: 7 }],
      life_graph: { periods: "x" },
    }
    expect(() => run(weird)).not.toThrow()
  })

  it("sajuInput 기둥이 깨지면 MALFORMED block", () => {
    const rep = verifyReading(oneChapter(["庚金 일간이란다."]), { sajuInput: { pillars: { year: "XX", month: "辛巳", day: "庚辰" } } })
    expect(rep.pass).toBe(false)
    expect(rep.findings.some((f) => f.code === "MALFORMED_READING")).toBe(true)
  })

  // 결함 후보: 글이 하나도 없는 풀이({}·parts:[]·빈 장)도 pass=true로 고객에게 나갈 수 있다.
  it.fails("[결함] 내용이 비어 있는 풀이는 통과시키면 안 된다", () => {
    for (const empty of [{}, { parts: [] }, { parts: [{ chapters: [{ body: [] }] }] }]) {
      const rep = run(empty)
      expect(rep.pass, brief(rep)).toBe(false)
    }
  })

  it("verifyChapter로 장 하나만 검사해도 같은 판정", () => {
    const ch = { key: "x", title: "일주", body: ["네 일주는 辛未라서 속이 단단하단다."] }
    expect(verifyChapter(ch, ctxOf("A")).pass).toBe(false)
    expect(verifyChapter({ key: "y", title: "일주", body: ["일간 庚金이란다."] }, ctxOf("A")).pass).toBe(true)
  })

  it("verifiedQuotes에 있는 원문 인용은 통과", () => {
    const rep = run(oneChapter(["적천수에 이르기를 「庚金帶煞剛健爲最」라 했다."]), "A", { verifiedQuotes: [{ classic: "滴天髓", original_text: "庚金帶煞剛健爲最" }] })
    expect(rep.findings.filter((f) => f.code === "FAKE_CLASSIC_QUOTE" && f.severity === "block")).toHaveLength(0)
  })

  it("같은 입력이면 같은 보고서(결정론)", () => {
    const r = bigReading(6)
    expect(JSON.stringify(run(r))).toBe(JSON.stringify(run(r)))
  })

  it("깊게 중첩된 객체(깊이 3000)에서 스택이 터지는지 확인", () => {
    let node: Record<string, unknown> = { text: "庚金" }
    for (let i = 0; i < 3000; i++) node = { child: node }
    let threw: unknown = null
    try {
      run({ parts: [{ chapters: [{ body: ["庚金"], extra: node }] }] })
    } catch (e) {
      threw = e
    }
    // 기록용: JSON.parse 결과라면 현실적으로 이 깊이는 드묾. 터지면 RangeError
    console.log(`[edge] depth3000 → ${threw ? (threw as Error).name : "OK"}`)
    expect(true).toBe(true)
  })
})

describe("독립 검증 — 성능", () => {
  it("30장 풀이(장당 6문단 + chips·todo·ask, 약 2.4만 자) < 200ms", () => {
    const r = bigReading(30)
    const chars = JSON.stringify(r).length
    run(r) // 워밍업
    const times: number[] = []
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now()
      const rep = run(r)
      times.push(performance.now() - t0)
      expect(rep.pass, brief(rep)).toBe(true)
    }
    times.sort((a, b) => a - b)
    console.log(`[perf] 30장 ${chars}자 중앙값 ${times[2].toFixed(1)}ms 최대 ${times[4].toFixed(1)}ms`)
    expect(times[2]).toBeLessThan(200)
  })

  it("문장부호 없는 5만 자 한 문단(최악 입력) < 1000ms", () => {
    const blob = "庚金 일간 辰土 일지 癸水 상관 ".repeat(2500)
    run(oneChapter([blob]))
    const t0 = performance.now()
    run(oneChapter([blob]))
    const ms = performance.now() - t0
    console.log(`[perf] 무문장부호 ${blob.length}자 ${ms.toFixed(1)}ms`)
    expect(ms).toBeLessThan(1000)
  })
})
