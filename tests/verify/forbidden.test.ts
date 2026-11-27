// 3. FORBIDDEN_TOPIC — SYSTEM_PROMPT "다루지 않는 것"
import { describe, expect, it } from "vitest"
import { findingsOf, worst } from "./helpers"

const F = "FORBIDDEN_TOPIC" as const

describe("FORBIDDEN 통과 예문(문맥 규칙)", () => {
  const ok = [
    "할미는 죽음이나 사고의 때를 말하지 않는다.",
    "몸이 오래 무거우면 병원에 가라.",
    "두 주 넘게 마음이 무거우면 병원이나 상담을 찾아라. 약한 게 아니라 물길을 내는 일이다.",
    "2015년은 죽을 만큼 애쓴 해였다.",
    "庚辰 일주는 사고방식이 곧다.",
    "투자 종목은 할미가 짚어 주지 않는다.",
    "시험 합격 여부는 사주로 가릴 일이 아니다.",
    "그 사람의 속마음은 할미도 모른다.",
    "몸이나 길 위에서 탈이 날 수 있으니 2027년에는 운전을 천천히 해라.",
    "전생 이야기는 하지 않는다.",
    "시간을 투자한 만큼 癸의 말솜씨가 는다.",
    "운동 종목을 하나 골라라.",
    "건강검진을 받아라.",
  ]
  for (const t of ok)
    it(t, () => {
      expect(findingsOf(t, F)).toEqual([])
    })
})

describe("FORBIDDEN 차단 예문", () => {
  const bad: [string, string, string][] = [
    ["사고 시기", "2030년에 큰 사고를 당한다.", "accident"],
    ["병명", "마흔 무렵 위암을 조심해라.", "diagnosis"],
    ["이혼 시기", "2028년 戊申년에 이혼수가 들었다.", "divorce-bankruptcy"],
    ["파산 시기", "내년에 사업이 망한다.", "divorce-bankruptcy"],
    ["코인", "올해 비트코인을 사 두어라.", "investment"],
    ["복권", "2027년에는 복권을 사 봐라.", "investment"],
    ["시험 합격 단정", "이번 공무원 시험은 무조건 붙는다.", "exam"],
    ["타인 속마음", "남편은 속마음으로 너를 원망한다.", "others-mind"],
    ["타인 감정 단정", "그 사람은 너를 아직 좋아하고 있다.", "others-mind"],
    ["전생", "너는 전생에 장군이었다.", "afterlife"],
    ["수명", "수명이 길지 않으니 서둘러라.", "death"],
    ["가족 사망 예언", "2031년에 아버지를 여읜다.", "death"],
    ["중병 시기", "2030년 무렵 큰 병이 찾아온다.", "serious-illness"],
  ]
  for (const [label, t, rule] of bad)
    it(label, () => {
      const fs = findingsOf(t, F)
      expect(fs.some((f) => f.rule === rule && f.severity === "block"), JSON.stringify(fs)).toBe(true)
    })

  it("걱정을 받아 주는 문장('망할까 걱정')은 막지 않는다(verify@0.3.0 — 위로 문장 오탐 정리), 시기 없는 가벼운 단정은 warn", () => {
    expect(findingsOf("사업이 망할까 걱정이 많구나.", F)).toEqual([])
    expect(worst(findingsOf("너는 무리하면 몸이 상한다.", F))).not.toBe("block")
  })
  it("부적·개명 권유는 warn", () => {
    expect(worst(findingsOf("부적을 지니고 다녀라.", F))).toBe("warn")
    expect(worst(findingsOf("이름을 바꾸면 운이 트인다.", F))).toBe("warn")
  })
  it("메타 부정 문장 뒤의 별도 문장은 따로 검사한다", () => {
    const fs = findingsOf("할미는 때를 말하지 않는다. 그래도 2030년에 큰 사고를 당한다.", F)
    expect(fs.map((f) => [f.rule, f.severity, f.location.sentence])).toEqual([["accident", "block", 1]])
  })
})
