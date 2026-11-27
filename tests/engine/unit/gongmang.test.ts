// 공망(旬空) 단위 테스트 — src/engine/rules/gongmang.ts
// 기대값 근거:
//   ① docs/knowledge/rules-spec.md §8 표(甲子순 戌亥 … 甲寅순 子丑)와 식 x = (b − s + 12) % 12
//   ② lunar-javascript LunarUtil.getXunKong(독립 구현) — 60갑자 전수 대조
import { describe, expect, it } from "vitest"
// @ts-expect-error lunar-javascript 패키지는 .d.ts를 제공하지 않는다
import lunarJs from "lunar-javascript"
import { gongmangString, xunKongOf } from "@/engine"
import { BRANCHES, STEMS, sexagenary } from "@/engine/calendar/constants"

const lib = lunarJs as unknown as { LunarUtil: { getXunKong(gz: string): string } }
const ALL = Array.from({ length: 60 }, (_, i) => sexagenary(i))
const gz = (i: number) => {
  const p = sexagenary(i)
  return p.stem + p.branch
}

describe("공망(旬空)", () => {
  it("rules-spec §8 표: 순두 6개", () => {
    const table: [string, string][] = [
      ["甲子", "戌亥"], ["甲戌", "申酉"], ["甲申", "午未"], ["甲午", "辰巳"], ["甲辰", "寅卯"], ["甲寅", "子丑"],
    ]
    for (const [head, empty] of table) {
      const p = ALL.find((x) => x.stem + x.branch === head)!
      expect(gongmangString(p), head).toBe(empty)
      expect(xunKongOf(p).xunHead).toEqual(p)
    }
  })

  it("60갑자 전수: 같은 순의 10기둥은 순두·공망이 같고, 표와 일치", () => {
    const byHead = ["戌亥", "申酉", "午未", "辰巳", "寅卯", "子丑"]
    for (let i = 0; i < 60; i++) {
      const r = xunKongOf(sexagenary(i))
      const head = Math.floor(i / 10) * 10
      expect(r.xunHead.stem + r.xunHead.branch, gz(i)).toBe(gz(head))
      expect(r.empty.join(""), gz(i)).toBe(byHead[head / 10])
    }
  })

  it("60갑자 전수: rules-spec 식 x = (b − s + 12) % 12, 공망 {(x+10)%12, (x+11)%12}", () => {
    for (const p of ALL) {
      const s = STEMS.indexOf(p.stem)
      const b = BRANCHES.indexOf(p.branch)
      const x = (b - s + 12) % 12
      expect(xunKongOf(p).empty, p.stem + p.branch).toEqual([BRANCHES[(x + 10) % 12], BRANCHES[(x + 11) % 12]])
    }
  })

  it("60갑자 전수: lunar-javascript getXunKong과 일치", () => {
    for (const p of ALL) expect(gongmangString(p), p.stem + p.branch).toBe(lib.LunarUtil.getXunKong(p.stem + p.branch))
  })

  it("기준 기둥 자신의 지지는 자기 공망이 될 수 없다(rules-spec §8)", () => {
    for (const p of ALL) expect(xunKongOf(p).empty, p.stem + p.branch).not.toContain(p.branch)
  })

  it("음양이 맞지 않는 간지(甲丑)는 오류", () => {
    expect(() => xunKongOf({ stem: "甲", branch: "丑" })).toThrow()
  })
})
