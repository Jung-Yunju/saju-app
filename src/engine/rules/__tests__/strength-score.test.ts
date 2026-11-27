// Q-306-1 회귀 테스트 (rules@0.3.1) — 신강약 표시 score 반올림
// 명세: docs/knowledge/strength-structure-spec.md §0 수치(비율은 6자리 반올림 후 비교) · §1 점수(score = r×100, 소수 1자리)
// 이전 구현 round1(r*100)은 0.5125×100 = 51.2499…처럼 곱셈 오차로 끝자리 5가 내려갔다(51.2·63.7).
// 기대값은 정수 산술(백만분율 k → floor((k+500)/1000)/10)로 따로 계산한다. 구현 결과를 복사하지 않았다.
import { describe, expect, it } from "vitest"
import { analyzeRules, type CalendarResult, type Pillar, type StrengthModelResult } from "@/engine"
import { scoreOfRatio } from "../groups"

const P = (gz: string): Pillar => ({ stem: gz[0], branch: gz[1] }) as Pillar
const chart = (y: string, m: string, d: string, h: string | null) =>
  ({ engineVersion: "calendar@test", pillars: { year: P(y), month: P(m), day: P(d), hour: h ? P(h) : null } }) as unknown as CalendarResult
const run = (gz: string) => {
  const [y, m, d, h] = gz.split("/")
  return analyzeRules(chart(y, m, d, h === "-" ? null : h))
}
const model = (gz: string, k: StrengthModelResult["model"]) => run(gz).strength.models.find((m) => m.model === k)!

describe("scoreOfRatio — 6자리 비율의 표시 점수", () => {
  it("끝자리 5는 올린다 (QA 보고 값)", () => {
    expect(scoreOfRatio(0.5125)).toBe(51.3)
    expect(scoreOfRatio(0.6375)).toBe(63.8)
    expect(scoreOfRatio(0.2875)).toBe(28.8)
    expect(scoreOfRatio(0.45)).toBe(45)
    expect(scoreOfRatio(0.55)).toBe(55)
    expect(scoreOfRatio(0)).toBe(0)
    expect(scoreOfRatio(1)).toBe(100)
    expect(scoreOfRatio(0.450794)).toBe(45.1)
    expect(scoreOfRatio(0.512499)).toBe(51.2)
  })

  it("0~1 사이 6자리 값 1,000,001개 전수: 정수 산술 기대값과 같다", () => {
    let bad = 0
    for (let k = 0; k <= 1_000_000; k++) {
      const r = Math.round((k / 1e6) * 1e6) / 1e6 // round6과 같은 6자리 값
      const expected = Math.floor((k + 500) / 1000) / 10
      if (scoreOfRatio(r) !== expected) bad++
    }
    expect(bad).toBe(0)
  })
})

describe("analyzeRules 경유 — 이전에 끝자리가 내려가던 원국 (rooted, 시주 모름 T=8)", () => {
  // 이전 값(round1(r*100)): 51.2 / 63.7 / 28.7
  const CASES = [
    { gz: "辛卯/壬寅/甲戌/-", r: 0.5125, score: 51.3, verdict: "중화" },
    { gz: "壬辰/丁酉/癸卯/-", r: 0.6375, score: 63.8, verdict: "신강" },
    { gz: "戊申/乙丑/丁巳/-", r: 0.2875, score: 28.8, verdict: "신약" },
  ] as const
  for (const c of CASES) {
    it(`${c.gz} r=${c.r} → score ${c.score}, 판정 ${c.verdict}(r로 비교, 변화 없음)`, () => {
      const m = model(c.gz, "rooted")
      expect(m.ratio).toBe(c.r)
      expect(m.score).toBe(c.score)
      expect(m.verdict).toBe(c.verdict)
    })
  }

  it("판정 경계는 score가 아니라 ratio로 비교한다(0.45 경계 사례 4-C 그대로 중화)", () => {
    const m = model("丙寅/庚子/壬午/丁未", "rooted")
    expect(m.ratio).toBe(0.45)
    expect(m.score).toBe(45)
    expect(m.verdict).toBe("중화")
  })
})
