import { describe, expect, it } from "vitest"
import { BRANCH_PICTURE, STEM_PICTURE } from "@/engine/content/prompts/plain-words"
import { BRANCH_SHORT, STEM_SHORT, branchShort, dmCaption } from "../_lib/plain"

const words = (s: string) => s.split(/\s+/).filter(Boolean)

describe("화면 쉬운 말: 기둥 칸 줄임말은 그림 말 사전에서만 온다", () => {
  it("천간 10개·지지 12개 모두 있고, 줄임말의 낱말이 사전 문구 안에 들어 있다", () => {
    expect(Object.keys(STEM_SHORT).sort()).toEqual(Object.keys(STEM_PICTURE).sort())
    expect(Object.keys(BRANCH_SHORT).sort()).toEqual(Object.keys(BRANCH_PICTURE).sort())
    for (const [k, v] of Object.entries(STEM_SHORT)) for (const w of words(v)) expect(STEM_PICTURE[k], `${k} ${w}`).toContain(w.replace(/(과|와)$/, ""))
    for (const [k, v] of Object.entries(BRANCH_SHORT)) for (const w of words(v)) expect(BRANCH_PICTURE[k].picture, `${k} ${w}`).toContain(w)
  })
  it("땅 글자는 띠 동물을 꼬리표로, 이름표는 그림 말이 먼저", () => {
    expect(branchShort("午")).toBe("한여름 불·말")
    expect(dmCaption("壬", "임", "수")).toBe("큰 강 · 임수")
  })
})
