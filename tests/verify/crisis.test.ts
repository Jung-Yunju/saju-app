// 10. CRISIS_RESPONSE — 사용자 고민 글의 위기 표현
import { describe, expect, it } from "vitest"
import type { ReadingLike } from "@/engine/verify"
import { readingOf, run, worst } from "./helpers"
import { CLEAN_READING } from "./fixtures"

const CR = "CRISIS_RESPONSE" as const
const crisisReply: ReadingLike & { crisis: { message: string } } = {
  crisis: {
    message: "지연아, 그 말을 꺼내 줘서 고맙다. 지금은 사주보다 네 마음이 먼저다. 혼자 견디지 말고 자살예방상담전화 109에 전화하거나 가까운 사람에게 지금 연락해라.",
  },
}
const of = (userText: string | undefined, reading: ReadingLike = CLEAN_READING) => run(reading, { userText }).findings.filter((f) => f.code === CR)

describe("CRISIS 통과 예문", () => {
  it("고민 글 없음", () => expect(of(undefined)).toEqual([]))
  it("위기 아닌 고민", () => expect(of("이직을 고민 중이에요")).toEqual([]))
  it("관용구 '죽을 만큼 바빠요'", () => expect(of("요즘 죽을 만큼 바빠요")).toEqual([]))
  it("'살기 좋은 동네'", () => expect(of("살기 좋은 동네로 이사하고 싶어요")).toEqual([]))
  it("위기 글 + 풀이 멈춤 + 상담 안내 → info만", () => expect(worst(of("요즘 정말 죽고 싶어요", crisisReply))).toBe("info"))
})

describe("CRISIS 차단 예문", () => {
  const noCounsel = readingOf("월지 사(巳)는 편관이다.")
  const bad = ["요즘 정말 죽고 싶어요", "어제 자해를 했어요", "더 이상 못 살겠어요", "남편에게 맞고 있어요", "그냥 사라지고 싶다"]
  for (const t of bad)
    it(t, () => {
      const fs = of(t, noCounsel)
      expect(worst(fs)).toBe("block")
      // 보고서에 사용자 글 전문을 싣지 않는다(위기 낱말만)
      expect(fs[0].excerpt.length).toBeLessThanOrEqual(12)
    })
  it("상담 안내는 있지만 풀이 본문이 그대로 나가면 block(verify@0.2.0 — 위기 사용자에게 풀이 전문이 가면 안 됨)", () => {
    const fs = of("그냥 사라지고 싶다", { ...CLEAN_READING, ...crisisReply })
    expect(worst(fs)).toBe("block")
    expect(fs[0].rule).toBe("not-stopped")
  })
})
