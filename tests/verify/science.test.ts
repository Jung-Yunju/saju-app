// 7. SCIENTIFIC_CLAIM — 원칙 9
import { describe, expect, it } from "vitest"
import { findingsOf, worst } from "./helpers"

const S = "SCIENTIFIC_CLAIM" as const

describe("SCIENTIFIC_CLAIM 통과 예문", () => {
  const ok = [
    "이 풀이는 전통 명리 이론에 따른 해석이고 검증된 예측이 아니다.",
    "과학적으로 입증된 것은 아니다.",
    "할미는 적중률을 내세우지 않는다.",
    "열에 하나를 떼어 둬라.",
    "2026년 丙午는 편관의 해다.",
  ]
  for (const t of ok)
    it(t, () => {
      expect(findingsOf(t, S)).toEqual([])
    })
})

describe("SCIENTIFIC_CLAIM 차단 예문", () => {
  const bad = [
    "사주는 과학적으로 입증된 학문이다.",
    "이 풀이의 적중률은 95%다.",
    "통계적으로 검증된 결과다.",
    "100% 맞는 풀이다.",
    "빅데이터로 증명된 사주다.",
    "올해 승진은 반드시 이루어진다.",
  ]
  for (const t of bad)
    it(t, () => {
      expect(worst(findingsOf(t, S))).toBe("block")
    })
})
