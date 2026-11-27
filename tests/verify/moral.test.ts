// 6. MORAL_JUDGEMENT · GENDER_STEREOTYPE — 원칙 5·8·11
import { describe, expect, it } from "vitest"
import { findingsOf, worst } from "./helpers"

const M = ["MORAL_JUDGEMENT", "GENDER_STEREOTYPE"] as const

describe("MORAL/GENDER 통과 예문(옛 판정을 걷어 내는 문장 포함)", () => {
  const ok = [
    "옛 책은 이런 사주를 팔자가 세다고 했지만, 지금 말로는 제 일을 끝까지 끌고 가는 힘이다.",
    "도화는 이성 문제가 아니라 사람을 끄는 힘이다.",
    "남편에게 기대어 서는 팔자가 아니다.",
    "편관 배우자는 기준이 높아 배울 것이 있는 사람이다.",
    "흔들리는 해에는 되돌릴 수 있는 크기로 해라.",
    "고집이라기보다 한번 정한 기준을 지키려는 까닭이 있다.",
  ]
  for (const t of ok)
    it(t, () => {
      // 걷어 내는 문장은 info로만 남는다(block/warn 없음)
      expect(["none", "info"]).toContain(worst(findingsOf(t, [...M])))
    })
})

describe("MORAL/GENDER 차단 예문", () => {
  const bad: [string, string, "block" | "warn"][] = [
    ["팔자가 세다 + 남편 복", "팔자가 세서 남편 복이 없다.", "block"],
    ["여자가 기가 세다", "여자가 기가 세면 집안이 시끄럽다.", "block"],
    ["박복", "박복한 사주다.", "block"],
    ["도화 = 바람기", "도화가 있어 바람기가 있다.", "block"],
    ["여자의 역할 고정", "여자는 남편을 받들어야 복이 온다.", "block"],
    ["여자 무관 판정", "여자 사주에 관이 없으면 남편 덕이 없다.", "block"],
    ["흉한 해 낙인", "2027년은 흉한 해다.", "warn"],
    ["고집 낙인", "고집이 세다.", "warn"],
  ]
  for (const [label, t, s] of bad)
    it(label, () => {
      expect(worst(findingsOf(t, [...M]))).toBe(s)
    })

  it("성별 판정은 GENDER_STEREOTYPE 코드로 분리", () => {
    expect(findingsOf("여자가 기가 세면 집안이 시끄럽다.", [...M]).map((f) => f.code)).toEqual(["GENDER_STEREOTYPE"])
  })
})
