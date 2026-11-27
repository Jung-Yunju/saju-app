// 4. FAKE_CLASSIC_QUOTE — 현재 verified 원문 0건(docs/knowledge/sources.md) → 원문 인용은 전부 block
// 아래 인용문은 검출 시험용으로 지어낸 문장이다. 고전 원문이 아니다.
import { describe, expect, it } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { findingsOf, worst } from "./helpers"

const C = "FAKE_CLASSIC_QUOTE" as const

describe("FAKE_CLASSIC_QUOTE 통과 예문", () => {
  const ok = [
    "이 풀이는 전통 명리 이론에 따른 해석이다.",
    "옛 책은 '드세다'고 했지만 지금 말로는 제 일을 끝까지 끌고 가는 힘이다.",
    "원국 庚午辛巳庚辰癸未를 차례로 보면 쇠가 셋이다.",
    "고전(苦戰)했던 2015년이었다.",
    "「오늘부터 할 일」을 적어 두어라.",
    "\"맞다\"라고 답한 글자를 근거로 쓴다.",
  ]
  for (const t of ok)
    it(t, () => {
      expect(findingsOf(t, C)).toEqual([])
    })

  it("verifiedQuotes에 있는 원문과 같으면 통과(시험용 가상 항목)", () => {
    const verifiedQuotes = [{ classic: "시험서", original_text: "가나다라마바사아" }]
    expect(findingsOf("『시험서』에 「가나다라 마바사아」라 했다.", C, { verifiedQuotes })).toEqual([])
    // 같은 서명이라도 다른 구절이면 차단
    expect(worst(findingsOf("『시험서』에 「자차카타파하가나」라 했다.", C, { verifiedQuotes }))).toBe("block")
  })
})

describe("FAKE_CLASSIC_QUOTE 차단 예문", () => {
  const bad: [string, string][] = [
    ["『』 서명 + 「」 인용", "『적천수』에 「쇠가 불을 만나면 귀해진다」라 했다."],
    ["서명 + 이르기를(따옴표 없음)", "자평진전에 이르기를 관을 쓰려면 재가 받쳐야 한다."],
    ["서명 + 큰따옴표", "궁통보감은 \"여름 쇠는 물을 먼저 찾는다\"고 했다."],
    ["옛 책 + 인용", "옛 책에 「강한 나무는 쉽게 부러진다」고 했다."],
    ["서명 + 한문 구절", "삼명통회에 陽刃逢沖 이라 하였다."],
    ["한자 서명 + 曰", "滴天髓 曰 天道有寒暖."],
    ["5대 고전 밖 『』 서명 + 인용", "『명리정종』에서 「재물은 흐르는 물과 같다」라고 했다."],
  ]
  for (const [label, t] of bad)
    it(label, () => {
      const fs = findingsOf(t, C)
      expect(worst(fs), JSON.stringify(fs)).toBe("block")
    })

  it("서명만 언급한 요지 설명은 warn", () => {
    const fs = findingsOf("적천수 계열은 기세를 먼저 본다.", C)
    expect(worst(fs)).toBe("warn")
    expect(fs[0].rule).toBe("title-only")
  })
  it("출처 없이 쓴 한문 구절은 warn", () => {
    const fs = findingsOf("陽生陰死라는 말이 있다.", C)
    expect(worst(fs)).toBe("warn")
    expect(fs[0].rule).toBe("unsourced-hanja-phrase")
  })
})

describe("지식베이스 상태와 기본값이 맞는가", () => {
  it("docs/knowledge/entries에 source_status: verified 항목이 0건 → 기본 verifiedQuotes = [] 가 맞다", () => {
    // 이 테스트가 깨지면(verified 항목이 생기면) 콘텐츠 엔진이 그 항목을 verifiedQuotes로 넘기도록 연결할 것
    const dir = join(process.cwd(), "docs/knowledge/entries")
    const n = readdirSync(dir)
      .filter((f) => f.endsWith(".yaml"))
      .reduce((acc, f) => acc + (readFileSync(join(dir, f), "utf8").match(/source_status:\s*verified\b/g) ?? []).length, 0)
    expect(n).toBe(0)
  })
})
