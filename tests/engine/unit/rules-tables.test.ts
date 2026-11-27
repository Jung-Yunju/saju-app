// 규칙 엔진 기초 표 테스트 — src/engine/rules/{tables,basics,hidden}.ts (rules@0.2.0)
// 기대값 근거: docs/knowledge/rules-spec.md §1(천간 표·공식), §2(지지 표), §3(지장간 표 3종).
//   표는 아래에 rules-spec 글자를 그대로 다시 적었다(구현 결과를 복사하지 않음).
// 독립 대조: lunar-javascript 1.7.8 LunarUtil.ZHI_HIDE_GAN · WU_XING_GAN · WU_XING_ZHI.
//   학파 차이 기록: lunar-javascript 지장간은 子[癸] 卯[乙] 酉[辛] 午[丁,己] 亥[壬,甲]으로 여기가 없거나 적다.
//   kr-monthly-30(기본)과는 子·卯·酉·午·亥 다섯 지지가 다르다 → cn-lunarjs 표와만 일치해야 한다.
//   또 라이브러리는 역할(여기·중기)이 없고 순서가 지지마다 다르다(丑[己,癸,辛] vs 寅[甲,丙,戊]) → 글자 집합으로 비교.
import { describe, expect, it } from "vitest"
// @ts-expect-error lunar-javascript 패키지는 .d.ts를 제공하지 않는다
import lunarJs from "lunar-javascript"
import { BRANCHES, STEMS } from "@/engine/calendar/constants"
import type { Branch, Element, Stem } from "@/engine"
import { branchElement, branchYinYang, hiddenStemsOf, stemElement, stemYinYang } from "@/engine/rules"

const lib = lunarJs as unknown as {
  LunarUtil: { ZHI_HIDE_GAN: Record<string, string[]>; WU_XING_GAN: Record<string, string>; WU_XING_ZHI: Record<string, string> }
}
const KO: Record<string, Element> = { 목: "wood", 화: "fire", 토: "earth", 금: "metal", 수: "water" }
const CN: Record<string, Element> = { 木: "wood", 火: "fire", 土: "earth", 金: "metal", 水: "water" }
const ys = (s: string) => (s === "양" ? "yang" : "yin")

describe("§1 천간 오행·음양", () => {
  // rules-spec §1 표 그대로
  const elem = "목 목 화 화 토 토 금 금 수 수".split(" ")
  const yy = "양 음 양 음 양 음 양 음 양 음".split(" ")
  it("표와 일치", () => {
    STEMS.forEach((s, i) => {
      expect(stemElement(s), s).toBe(KO[elem[i]])
      expect(stemYinYang(s), s).toBe(ys(yy[i]))
    })
  })
  it("공식: 오행 floor(s/2), 음양 s%2", () => {
    const order: Element[] = ["wood", "fire", "earth", "metal", "water"]
    STEMS.forEach((s, i) => {
      expect(stemElement(s)).toBe(order[Math.floor(i / 2)])
      expect(stemYinYang(s)).toBe(i % 2 === 0 ? "yang" : "yin")
    })
  })
  it("lunar-javascript WU_XING_GAN과 일치", () => {
    for (const s of STEMS) expect(stemElement(s), s).toBe(CN[lib.LunarUtil.WU_XING_GAN[s]])
  })
})

describe("§2 지지 오행·음양", () => {
  const elem = "수 토 목 목 토 화 화 토 금 금 토 수".split(" ")
  const byOrder = "양 음 양 음 양 음 양 음 양 음 양 음".split(" ")
  const byMainQi = "음 음 양 음 양 양 음 음 양 음 양 양".split(" ")
  it("오행 표와 일치 + lunar-javascript WU_XING_ZHI와 일치", () => {
    BRANCHES.forEach((b, i) => {
      expect(branchElement(b), b).toBe(KO[elem[i]])
      expect(branchElement(b), b).toBe(CN[lib.LunarUtil.WU_XING_ZHI[b]])
    })
  })
  it("음양: byOrder / byMainQi 표와 일치", () => {
    BRANCHES.forEach((b, i) => {
      expect(branchYinYang(b, "byOrder"), b).toBe(ys(byOrder[i]))
      expect(branchYinYang(b, "byMainQi"), b).toBe(ys(byMainQi[i]))
    })
  })
  it("두 기준이 다른 지지는 子·午·巳·亥 넷뿐", () => {
    const diff = BRANCHES.filter((b) => branchYinYang(b, "byOrder") !== branchYinYang(b, "byMainQi"))
    expect(diff.sort()).toEqual((["子", "午", "巳", "亥"] as Branch[]).sort())
  })
  it("byMainQi = 정기 천간의 음양(§3-3 정기와 대조)", () => {
    const mainQi: Record<Branch, Stem> = { 子: "癸", 丑: "己", 寅: "甲", 卯: "乙", 辰: "戊", 巳: "丙", 午: "丁", 未: "己", 申: "庚", 酉: "辛", 戌: "戊", 亥: "壬" }
    for (const b of BRANCHES) {
      expect(branchYinYang(b, "byMainQi"), b).toBe(stemYinYang(mainQi[b]))
      expect(branchElement(b), b).toBe(stemElement(mainQi[b]))
    }
  })
})

describe("§3 지장간", () => {
  // rules-spec §3-1 kr-monthly-30: [여기, 중기|null, 정기] "글자 날수"
  const KR: Record<Branch, string> = {
    子: "壬10 - 癸20", 丑: "癸9 辛3 己18", 寅: "戊7 丙7 甲16", 卯: "甲10 - 乙20", 辰: "乙9 癸3 戊18", 巳: "戊7 庚7 丙16",
    午: "丙10 己9 丁11", 未: "丁9 乙3 己18", 申: "戊7 壬7 庚16", 酉: "庚10 - 辛20", 戌: "辛9 丁3 戊18", 亥: "戊7 甲7 壬16",
  }
  // rules-spec §3-2 cn-lunarjs (정기 먼저)
  const CNJS: Record<Branch, string> = {
    子: "癸", 丑: "己癸辛", 寅: "甲丙戊", 卯: "乙", 辰: "戊乙癸", 巳: "丙庚戊", 午: "丁己", 未: "己丁乙", 申: "庚壬戊", 酉: "辛", 戌: "戊辛丁", 亥: "壬甲",
  }
  const MAIN: Record<Branch, Stem> = { 子: "癸", 丑: "己", 寅: "甲", 卯: "乙", 辰: "戊", 巳: "丙", 午: "丁", 未: "己", 申: "庚", 酉: "辛", 戌: "戊", 亥: "壬" }

  it("kr-monthly-30: 표와 일치(역할·날수·순서 여기→중기→정기), 날수 합 30, weight = days/30", () => {
    for (const b of BRANCHES) {
      const [y, j, m] = KR[b].split(" ")
      const expected: { stem: string; role: string; days: number }[] = [{ stem: y[0], role: "yeogi", days: Number(y.slice(1)) }]
      if (j !== "-") expected.push({ stem: j[0], role: "junggi", days: Number(j.slice(1)) })
      expected.push({ stem: m[0], role: "jeonggi", days: Number(m.slice(1)) })
      const got = hiddenStemsOf(b, "kr-monthly-30")
      expect(got.map(({ stem, role, days }) => ({ stem, role, days })), b).toEqual(expected)
      expect(got.reduce((a, h) => a + (h.days ?? 0), 0), b).toBe(30)
      for (const h of got) expect(h.weight, b + h.stem).toBeCloseTo((h.days as number) / 30, 12)
    }
  })

  it("cn-lunarjs: rules-spec §3-2 글자 집합과 일치, lunar-javascript ZHI_HIDE_GAN과 글자 집합 일치", () => {
    for (const b of BRANCHES) {
      const got = hiddenStemsOf(b, "cn-lunarjs").map((h) => h.stem).sort()
      expect(got, b).toEqual([...CNJS[b]].sort())
      expect(got, b).toEqual([...lib.LunarUtil.ZHI_HIDE_GAN[b]].sort())
      // 정기는 라이브러리 배열의 첫 글자
      expect(hiddenStemsOf(b, "cn-lunarjs").find((h) => h.role === "jeonggi")!.stem, b).toBe(lib.LunarUtil.ZHI_HIDE_GAN[b][0])
    }
  })

  it("학파 차이 기록: kr-monthly-30과 lunar-javascript가 다른 지지는 子·卯·午·酉·亥", () => {
    const diff = BRANCHES.filter((b) => {
      const kr = hiddenStemsOf(b, "kr-monthly-30").map((h) => h.stem).sort().join("")
      return kr !== [...lib.LunarUtil.ZHI_HIDE_GAN[b]].sort().join("")
    })
    expect(diff).toEqual(["子", "卯", "午", "酉", "亥"])
  })

  it("cn-lunarjs 임시 비율: 세 글자 0.6/0.3/0.1, 두 글자 0.7/0.3, 한 글자 1, days = null", () => {
    for (const b of BRANCHES) {
      const hs = hiddenStemsOf(b, "cn-lunarjs")
      for (const h of hs) expect(h.days).toBeNull()
      const w = Object.fromEntries(hs.map((h) => [h.role, h.weight]))
      if (hs.length === 3) expect(w).toEqual({ jeonggi: 0.6, junggi: 0.3, yeogi: 0.1 })
      else if (hs.length === 2) expect(w.jeonggi, b).toBe(0.7)
      else expect(w).toEqual({ jeonggi: 1 })
      expect(hs.reduce((a, h) => a + h.weight, 0), b).toBeCloseTo(1, 12)
    }
  })

  it("main-only: 정기 하나(weight 1), 세 표의 정기가 모두 같다", () => {
    for (const b of BRANCHES) {
      expect(hiddenStemsOf(b, "main-only"), b).toEqual([{ stem: MAIN[b], role: "jeonggi", days: null, weight: 1 }])
      for (const t of ["kr-monthly-30", "cn-lunarjs"] as const)
        expect(hiddenStemsOf(b, t).filter((h) => h.role === "jeonggi").map((h) => h.stem), `${t} ${b}`).toEqual([MAIN[b]])
    }
  })

  it("표의 짜임 검산(§3-1): 진술축미 중기 = 삼합 고 글자, 생지 중기 = 삼합 생지 기운", () => {
    const junggi = (b: Branch) => hiddenStemsOf(b, "kr-monthly-30").find((h) => h.role === "junggi")?.stem
    expect([junggi("辰"), junggi("戌"), junggi("丑"), junggi("未")]).toEqual(["癸", "丁", "辛", "乙"])
    expect([junggi("寅"), junggi("申"), junggi("巳"), junggi("亥")]).toEqual(["丙", "壬", "庚", "甲"])
  })
})
