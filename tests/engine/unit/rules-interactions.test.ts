// 합·충·형·파·해 테스트 — src/engine/rules/interactions.ts (rules@0.2.0 표 + rules@0.3.0 D-019 포함 표시)
// 기대값 근거: docs/knowledge/rules-spec.md §6(천간합·충 표 + 검산 공식), §7(지지 관계 표). 아래 문자열은 명세 표를 다시 적은 것.
// lunar-javascript 대조: HE_GAN_5 · HE_ZHI_6 · CHONG · CHONG_GAN_4(천간충 4쌍, 戊己 빈칸)와 일치하는지 본다.
// D-019(rules@0.3.0): 세 글자 관계가 성립해도 그 안의 두 글자 기록(반합·두 글자 방합·두 글자 삼형)을 지우지 않고 subsumedBy(세 글자 관계 식별자)를 붙인다.
// 남은 한 글자가 원국이든 운이든 같다(0.2.0의 원국·운 비대칭 삭제 규칙 폐지).
import { describe, expect, it } from "vitest"
// @ts-expect-error lunar-javascript 패키지는 .d.ts를 제공하지 않는다
import lunarJs from "lunar-javascript"
import { BRANCHES, STEMS } from "@/engine/calendar/constants"
import { analyzeRules, interactionId, type Branch, type CalendarResult, type Interaction, type Pillar, type RuleOptions, type Stem } from "@/engine"

const lib = lunarJs as unknown as {
  LunarUtil: { HE_GAN_5: string[]; HE_ZHI_6: string[]; CHONG: string[]; CHONG_GAN_4: string[] }
}
// lunar-javascript 1.7.8의 CHONG_GAN_4는 다국어 자리표시자("{tg.geng}")가 풀리지 않은 채 남아 있어 직접 푼다
const TG: Record<string, Stem> = {
  "{tg.jia}": "甲", "{tg.yi}": "乙", "{tg.bing}": "丙", "{tg.ding}": "丁", "{tg.wu}": "戊",
  "{tg.ji}": "己", "{tg.geng}": "庚", "{tg.xin}": "辛", "{tg.ren}": "壬", "{tg.gui}": "癸",
}
const chongGan4 = (i: number) => TG[lib.LunarUtil.CHONG_GAN_4[i]] ?? lib.LunarUtil.CHONG_GAN_4[i]

/** 지지만 정한 기둥: 천간은 같은 음양의 甲/乙(천간 관계가 생기지 않음) */
const pb = (b: Branch): Pillar => ({ stem: BRANCHES.indexOf(b) % 2 === 0 ? "甲" : "乙", branch: b })
/** 천간만 정한 기둥: 지지는 같은 음양의 子/丑 */
const ps = (s: Stem): Pillar => ({ stem: s, branch: STEMS.indexOf(s) % 2 === 0 ? "子" : "丑" })
const chart = (year: Pillar, month: Pillar, day: Pillar, hour: Pillar | null = null) =>
  ({ engineVersion: "test", pillars: { year, month, day, hour } }) as unknown as CalendarResult
const key = (i: Interaction) => i.members.map((m) => `${m.pillar}${m.luckIndex ?? ""}.${m.part}`).join("+")
const branchOnly = (bs: Branch[], o?: Partial<RuleOptions>) =>
  analyzeRules(chart(pb(bs[0]), pb(bs[1]), pb(bs[2]), bs[3] ? pb(bs[3]) : null), o).interactions.filter((i) => i.members[0].part === "branch")

// rules-spec §7 표
const pairsOf = (s: string) => s.split(" ").map((x) => [x[0], x[1]] as [Branch, Branch])
const SIX = pairsOf("子丑 寅亥 卯戌 辰酉 巳申 午未")
const THREE = "申子辰 亥卯未 寅午戌 巳酉丑".split(" ")
const HALF_KING = THREE.flatMap((t) => [[t[0], t[1]], [t[1], t[2]]] as [Branch, Branch][])
const PUN_PARTIAL = "寅巳申 丑戌未".split(" ").flatMap((t) => [[t[0], t[1]], [t[1], t[2]], [t[0], t[2]]] as [Branch, Branch][])
const MUTUAL = pairsOf("子卯")
const SELF = [..."辰午酉亥"] as Branch[]
const BREAK = pairsOf("子酉 丑辰 寅亥 卯午 巳申 未戌")
const HARM = pairsOf("子未 丑午 寅巳 卯辰 申亥 酉戌")
const has = (list: [Branch, Branch][], a: Branch, b: Branch) => list.some(([x, y]) => (x === a && y === b) || (x === b && y === a))

describe("천간 관계(§6)", () => {
  it("100칸 전수: 연간·월간 쌍의 합·충이 표·공식과 일치", () => {
    const COMB = "甲己 乙庚 丙辛 丁壬 戊癸".split(" ")
    const CLASH = "甲庚 乙辛 丙壬 丁癸".split(" ")
    for (const a of STEMS)
      for (const b of STEMS) {
        // 일주 = 연주(같은 글자 중복)라 연·월 쌍만 걸러 본다
        const got = analyzeRules(chart(ps(a), ps(b), ps(a))).interactions.filter((i) => key(i) === "year.stem+month.stem")
        const s1 = Math.min(STEMS.indexOf(a), STEMS.indexOf(b))
        const s2 = Math.max(STEMS.indexOf(a), STEMS.indexOf(b))
        const expected: string[] = []
        if (COMB.some((p) => p.includes(a) && p.includes(b) && a !== b)) expected.push("stemCombine")
        if (CLASH.some((p) => p.includes(a) && p.includes(b) && a !== b)) expected.push("stemClash")
        expect(got.map((i) => i.type), a + b).toEqual(expected)
        // 검산 공식
        expect(expected.includes("stemCombine"), a + b).toBe(s2 - s1 === 5)
        expect(expected.includes("stemClash"), a + b).toBe(s1 <= 3 && s2 === s1 + 6)
        // lunar-javascript
        expect(expected.includes("stemCombine"), a + b).toBe(lib.LunarUtil.HE_GAN_5[STEMS.indexOf(a)] === b)
        expect(expected.includes("stemClash"), a + b).toBe(chongGan4(STEMS.indexOf(a)) === b)
      }
  })

  it("천간합: 결과 오행 甲己토 乙庚금 丙辛수 丁壬목 戊癸화, 합화는 판정하지 않음(transformed null)", () => {
    const exp: [Stem, Stem, string][] = [["甲", "己", "earth"], ["乙", "庚", "metal"], ["丙", "辛", "water"], ["丁", "壬", "wood"], ["戊", "癸", "fire"]]
    for (const [a, b, el] of exp) {
      const [i] = analyzeRules(chart(ps(a), ps(b), ps(a))).interactions.filter((x) => x.type === "stemCombine" && key(x) === "year.stem+month.stem")
      expect(i.resultElement, a + b).toBe(el)
      expect(i.transformed).toBeNull()
      expect(i.ruleId).toBe(`stem.combine.${a}${b}`)
      expect(i.chars).toEqual([a, b])
    }
  })

  it("戊·己는 충이 없고, 甲戊 같은 상극은 관계로 기록하지 않는다", () => {
    for (const s of STEMS) {
      const r = analyzeRules(chart(ps("戊"), ps(s), ps("戊"))).interactions.filter((i) => i.type === "stemClash")
      expect(r, "戊" + s).toEqual([])
    }
    expect(analyzeRules(chart(ps("甲"), ps("戊"), ps("甲"))).interactions.filter((i) => i.members[0].part === "stem")).toEqual([])
  })
})

describe("지지 두 글자 관계(§7) — 144칸 전수", () => {
  it("연지·월지 쌍의 관계 종류가 표와 일치(기본 옵션)", () => {
    for (const a of BRANCHES)
      for (const b of BRANCHES) {
        const got = branchOnly([a, b, a]).filter((i) => key(i) === "year.branch+month.branch").map((i) => i.type).sort()
        const expected: string[] = []
        if (a !== b) {
          if (has(SIX, a, b)) expected.push("sixCombine")
          if (has(HALF_KING, a, b)) expected.push("halfCombine")
          if ((BRANCHES.indexOf(b) - BRANCHES.indexOf(a) + 12) % 12 === 6) expected.push("clash")
          if (has(PUN_PARTIAL, a, b)) expected.push("punishment")
          if (has(MUTUAL, a, b)) expected.push("punishment")
          if (has(BREAK, a, b)) expected.push("break")
          if (has(HARM, a, b)) expected.push("harm")
        } else if (SELF.includes(a)) expected.push("punishment")
        expect(got, a + b).toEqual(expected.sort())
      }
  })

  it("충 6쌍·육합 6쌍이 lunar-javascript CHONG·HE_ZHI_6과 일치", () => {
    for (const a of BRANCHES) {
      const i = BRANCHES.indexOf(a)
      expect(has(pairsOf("子午 丑未 寅申 卯酉 辰戌 巳亥"), a, lib.LunarUtil.CHONG[i] as Branch), a).toBe(true)
      expect(has(SIX, a, lib.LunarUtil.HE_ZHI_6[i] as Branch), a).toBe(true)
    }
  })

  it("겹침은 모두 기록: 寅申 충·형 / 寅亥 합·파 / 寅巳 형·해 / 巳申 합·형·파", () => {
    const types = (a: Branch, b: Branch) => branchOnly([a, b, a]).filter((i) => key(i) === "year.branch+month.branch").map((i) => i.type)
    expect(types("寅", "申")).toEqual(["clash", "punishment"])
    expect(types("寅", "亥")).toEqual(["sixCombine", "break"])
    expect(types("寅", "巳")).toEqual(["punishment", "harm"])
    expect(types("巳", "申")).toEqual(["sixCombine", "punishment", "break"])
    const pun = branchOnly(["寅", "申", "寅"]).find((i) => i.type === "punishment" && key(i) === "year.branch+month.branch")!
    expect(pun).toMatchObject({ partial: true, complete: false, punishmentKind: "three", ruleId: "branch.punishment.寅申" })
  })

  it("육합 결과 오행: 子丑토 寅亥목 卯戌화 辰酉금 巳申수, 午未는 wuWeiCombine(none=null / fire / earth)", () => {
    const el = (a: Branch, b: Branch, o?: Partial<RuleOptions>) =>
      branchOnly([a, b, a], o).find((i) => i.type === "sixCombine" && key(i) === "year.branch+month.branch")!.resultElement
    expect([el("子", "丑"), el("寅", "亥"), el("卯", "戌"), el("辰", "酉"), el("巳", "申")]).toEqual(["earth", "wood", "fire", "metal", "water"])
    expect(el("午", "未")).toBeNull()
    expect(el("午", "未", { wuWeiCombine: "fire" })).toBe("fire")
    expect(el("午", "未", { wuWeiCombine: "earth" })).toBe("earth")
  })

  it("자형은 같은 글자 둘, 상형 子卯", () => {
    expect(branchOnly(["辰", "辰", "子"]).filter((i) => i.type === "punishment")).toMatchObject([
      { punishmentKind: "self", ruleId: "branch.punishment.辰辰", chars: ["辰", "辰"], adjacent: true },
    ])
    expect(branchOnly(["卯", "午", "子"]).filter((i) => i.type === "punishment")).toMatchObject([
      { punishmentKind: "mutual", ruleId: "branch.punishment.子卯", chars: ["卯", "子"], adjacent: false },
    ])
    expect(branchOnly(["寅", "寅", "子"]).filter((i) => i.type === "punishment")).toEqual([])
  })
})

describe("세 글자 관계와 옵션(§7)", () => {
  it("삼합 4종: complete, 결과 오행, 그 안의 반합(왕지 낀 두 쌍)은 남고 subsumedBy = 삼합 식별자", () => {
    const exp: Record<string, string> = { 申子辰: "water", 亥卯未: "wood", 寅午戌: "fire", 巳酉丑: "metal" }
    for (const t of THREE) {
      const r = branchOnly([...t] as Branch[])
      const tc = r.filter((i) => i.type === "threeCombine")
      expect(tc, t).toMatchObject([{ complete: true, resultElement: exp[t], chars: [...t], adjacent: true, ruleId: `branch.threeCombine.${t}` }])
      expect(tc[0].subsumedBy, t).toBeUndefined()
      expect(interactionId(tc[0])).toBe(`branch.threeCombine.${t}@year.branch+month.branch+day.branch`)
      const halves = r.filter((i) => i.type === "halfCombine")
      // 생지(연)+왕지(월), 왕지(월)+고지(일). 생지+고지(연-일)는 기본 withKingOnly라 반합 아님
      expect(halves.map(key), t).toEqual(["year.branch+month.branch", "month.branch+day.branch"])
      expect(halves.map((h) => h.subsumedBy), t).toEqual([[interactionId(tc[0])], [interactionId(tc[0])]])
      expect(halves.every((h) => h.withKing && h.resultElement === exp[t]), t).toBe(true)
    }
  })

  it("반합: 왕지 낀 쌍만(기본). allPairs면 생지+고지(申辰 亥未 寅戌 巳丑)도 withKing false로 기록", () => {
    expect(branchOnly(["申", "辰", "申"]).filter((i) => i.type === "halfCombine")).toEqual([])
    for (const [a, b] of pairsOf("申辰 亥未 寅戌 巳丑")) {
      const r = branchOnly([a, b, a], { halfCombine: "allPairs" }).filter((i) => i.type === "halfCombine" && key(i) === "year.branch+month.branch")
      expect(r, a + b).toMatchObject([{ withKing: false }])
    }
    expect(branchOnly(["子", "辰", "子"]).find((i) => i.type === "halfCombine")).toMatchObject({ withKing: true, resultElement: "water" })
  })

  it("방합: 세 글자만(기본). partialDirectional이면 두 글자도 partial로, 세 글자가 있으면 두 글자도 남기고 subsumedBy", () => {
    for (const [t, el] of [["寅卯辰", "wood"], ["巳午未", "fire"], ["申酉戌", "metal"], ["亥子丑", "water"]]) {
      expect(branchOnly([...t] as Branch[]).filter((i) => i.type === "directionalCombine"), t).toMatchObject([{ complete: true, resultElement: el }])
      const d = branchOnly([...t] as Branch[], { partialDirectional: true }).filter((i) => i.type === "directionalCombine")
      // 정렬: [연,월] < [연,월,일] < [연,일] < [월,일]
      expect(d.map((i) => [key(i), i.complete, i.partial ?? false]), t).toEqual([
        ["year.branch+month.branch", false, true],
        ["year.branch+month.branch+day.branch", true, false],
        ["year.branch+day.branch", false, true],
        ["month.branch+day.branch", false, true],
      ])
      const id = `branch.directional.${t}@year.branch+month.branch+day.branch`
      expect(d.map((i) => i.subsumedBy ?? null), t).toEqual([[id], null, [id], [id]])
    }
    expect(branchOnly(["寅", "卯", "寅"]).filter((i) => i.type === "directionalCombine")).toEqual([])
    expect(branchOnly(["寅", "卯", "寅"], { partialDirectional: true }).filter((i) => i.type === "directionalCombine")).toMatchObject([
      { partial: true, complete: false, resultElement: "wood" },
      { partial: true, complete: false, resultElement: "wood" },
    ])
  })

  it("삼형 寅巳申·丑戌未: 세 글자면 complete 하나 + 두 글자 삼형 셋(subsumedBy). 충·파·해·합은 그대로(포함 표시 없음)", () => {
    const r = branchOnly(["寅", "巳", "申"])
    const pun = r.filter((i) => i.type === "punishment")
    expect(pun.map((i) => `${i.ruleId}:${key(i)}:${i.complete}`)).toEqual([
      "branch.punishment.寅巳:year.branch+month.branch:false",
      "branch.punishment.寅巳申:year.branch+month.branch+day.branch:true",
      "branch.punishment.寅申:year.branch+day.branch:false",
      "branch.punishment.巳申:month.branch+day.branch:false",
    ])
    const id = "branch.punishment.寅巳申@year.branch+month.branch+day.branch"
    expect(pun.map((i) => i.subsumedBy ?? null)).toEqual([[id], null, [id], [id]])
    expect(r.filter((i) => i.type !== "punishment").map((i) => `${i.type}:${i.chars.join("")}`)).toEqual([
      "sixCombine:巳申", "clash:寅申", "break:巳申", "harm:寅巳",
    ])
    expect(r.filter((i) => i.type !== "punishment").every((i) => i.subsumedBy === undefined)).toBe(true)
    const r2 = branchOnly(["丑", "戌", "未"])
    expect(r2.filter((i) => i.type === "punishment" && i.complete)).toMatchObject([{ complete: true, ruleId: "branch.punishment.丑戌未" }])
    expect(r2.filter((i) => i.type === "punishment" && i.partial)).toHaveLength(3)
  })

  it("partialPunishment=false: 두 글자 삼형은 기록하지 않음(세 글자·상형·자형은 기록)", () => {
    const o = { partialPunishment: false }
    expect(branchOnly(["寅", "申", "寅"], o).map((i) => i.type)).toEqual(["clash", "clash"])
    expect(branchOnly(["寅", "巳", "申"], o).filter((i) => i.type === "punishment")).toHaveLength(1)
    expect(branchOnly(["子", "卯", "子"], o).filter((i) => i.type === "punishment")).toHaveLength(2)
  })

  it("adjacent: 연-월·월-일·일-시만 true, 세 글자는 연속 세 기둥일 때 true", () => {
    const r = branchOnly(["子", "寅", "午", "申"])
    const clashes = r.filter((i) => i.type === "clash").map((i) => [key(i), i.adjacent])
    expect(clashes).toEqual([["year.branch+day.branch", false], ["month.branch+hour.branch", false]])
    const t = branchOnly(["辰", "申", "子", "辰"]).filter((i) => i.type === "threeCombine")
    expect(t.map((i) => [key(i), i.adjacent])).toEqual([
      ["year.branch+month.branch+day.branch", true],
      ["month.branch+day.branch+hour.branch", true],
    ])
    const t2 = branchOnly(["申", "午", "子", "辰"]).filter((i) => i.type === "threeCombine")
    expect(t2.map((i) => [key(i), i.adjacent])).toEqual([["year.branch+day.branch+hour.branch", false]])
  })
})

describe("운(대운·세운)과 원국 사이", () => {
  const natal = chart(pb("申"), pb("子"), pb("寅"), pb("卯"))

  it("운이 낀 관계는 scope luck, adjacent false, 위치에 luckIndex", () => {
    const r = analyzeRules(natal, undefined, { luck: [pb("午")] }).interactions
    const c = r.filter((i) => i.type === "clash" && i.scope === "luck")
    expect(c).toMatchObject([{ members: [{ pillar: "month", part: "branch" }, { pillar: "daeun", part: "branch", luckIndex: 0 }], adjacent: false, chars: ["子", "午"] }])
  })

  it("서로 다른 대운끼리는 비교하지 않는다. 대운-세운은 비교한다", () => {
    const r = analyzeRules(chart(pb("丑"), pb("丑"), pb("丑")), undefined, { luck: [pb("子"), pb("午")], year: pb("子") }).interactions
    // 대운0 子 ↔ 대운1 午 충은 없어야 함, 대운1 午 ↔ 세운 子 충은 있어야 함
    const clashes = r.filter((i) => i.type === "clash").map(key)
    expect(clashes).toEqual(["daeun1.branch+seun.branch"])
  })

  it("원국 두 글자 + 운 한 글자 삼합: 원국 반합·운 낀 반합 모두 남고 둘 다 subsumedBy(원국·운 대칭, D-019)", () => {
    const r = analyzeRules(natal, undefined, { year: pb("辰") }).interactions
    expect(r.filter((i) => i.type === "threeCombine").map(key)).toEqual(["year.branch+month.branch+seun.branch"])
    const halves = r.filter((i) => i.type === "halfCombine")
    // 申子(연-월, 원국) · 子辰(월-세운). 申辰은 생지+고지라 기본 옵션에서 반합 아님
    expect(halves.map(key)).toEqual(["year.branch+month.branch", "month.branch+seun.branch"])
    const id = "branch.threeCombine.申子辰@year.branch+month.branch+seun.branch"
    expect(halves.map((h) => h.subsumedBy)).toEqual([[id], [id]])
    expect(halves.map((h) => h.scope)).toEqual(["natal", "luck"])
    expect(r.find((i) => i.type === "threeCombine")!.scope).toBe("luck")
    // 운이 없으면 원국 申子 반합은 포함 표시 없음
    const plain = analyzeRules(natal).interactions.filter((i) => i.type === "halfCombine")
    expect(plain.map((h) => [key(h), h.subsumedBy ?? null])).toEqual([["year.branch+month.branch", null]])
  })

  it("같은 두 글자를 포함하는 세 글자 관계가 여럿이면 식별자를 모두 적는다(申子 + 辰 둘)", () => {
    const r = analyzeRules(chart(pb("申"), pb("子"), pb("辰"), pb("辰"))).interactions
    const t = r.filter((i) => i.type === "threeCombine").map(interactionId)
    expect(t).toEqual([
      "branch.threeCombine.申子辰@year.branch+month.branch+day.branch",
      "branch.threeCombine.申子辰@year.branch+month.branch+hour.branch",
    ])
    const sz = r.find((i) => i.type === "halfCombine" && key(i) === "year.branch+month.branch")!
    expect(sz.subsumedBy).toEqual(t)
    const zc = r.find((i) => i.type === "halfCombine" && key(i) === "month.branch+day.branch")!
    expect(zc.subsumedBy).toEqual([t[0]])
  })

  it("천간도 운과 비교: 원국 庚 ↔ 세운 甲 충, 대운 己 ↔ 세운 甲 합", () => {
    const r = analyzeRules(chart(ps("庚"), ps("丙"), ps("丙")), undefined, { luck: [ps("己")], year: ps("甲") }).interactions
    expect(r.filter((i) => i.members[0].part === "stem").map((i) => `${i.type}:${key(i)}`)).toEqual([
      "stemCombine:daeun0.stem+seun.stem",
      "stemClash:year.stem+seun.stem",
    ])
  })
})
