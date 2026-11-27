// 십성·12운성 테스트 — src/engine/rules/{basics,twelveStages}.ts (rules@0.2.0)
// 기대값 근거:
//   십성  rules-spec §4 표(rel = (t − d + 5) % 5, 음양 같음/다름)를 테스트 안에서 따로 계산 + 손으로 쓴 일간 甲 한 줄
//   12운성 rules-spec §5-1 표 120칸을 글자 그대로 옮김, §5-2 변형 규칙, §5 록 표 검산
// 독립 대조: lunar-javascript 1.7.8 LunarUtil.SHI_SHEN(100칸), CHANG_SHENG_OFFSET + EightChar._getDiShi 식(120칸)
//   학파 차이 기록: lunar-javascript 12운성은 음간 역행 + 화토동법(= 기본 옵션 reverse/withFire)이라 기본값에서만 일치한다.
//   lunar-javascript는 편관을 七杀로 쓴다(이 엔진은 "편관" — rules-spec §4 별칭 표기 차이).
import { describe, expect, it } from "vitest"
// @ts-expect-error lunar-javascript 패키지는 .d.ts를 제공하지 않는다
import lunarJs from "lunar-javascript"
import { BRANCHES, STEMS } from "@/engine/calendar/constants"
import type { Branch, Stem, TwelveStage } from "@/engine"
import { LU, TWELVE_STAGES, tenGodOfBranch, tenGodOfStem, twelveStageOf } from "@/engine/rules"

const lib = lunarJs as unknown as {
  LunarUtil: { SHI_SHEN: Record<string, string>; CHANG_SHENG: string[]; CHANG_SHENG_OFFSET: Record<string, number> }
}

describe("십성(§4)", () => {
  const NAMES = [["비견", "겁재"], ["식신", "상관"], ["편재", "정재"], ["편관", "정관"], ["편인", "정인"]]
  const ss = (d: number, t: number) => NAMES[(Math.floor(t / 2) - Math.floor(d / 2) + 5) % 5][d % 2 === t % 2 ? 0 : 1]

  it("일간 甲 한 줄(손으로 씀): 甲비견 乙겁재 丙식신 丁상관 戊편재 己정재 庚편관 辛정관 壬편인 癸정인", () => {
    const row = "비견 겁재 식신 상관 편재 정재 편관 정관 편인 정인".split(" ")
    STEMS.forEach((t, i) => expect(tenGodOfStem("甲", t), t).toBe(row[i]))
  })

  it("천간 100칸: rules-spec 식과 일치", () => {
    STEMS.forEach((d, di) => STEMS.forEach((t, ti) => expect(tenGodOfStem(d, t), d + t).toBe(ss(di, ti))))
  })

  it("천간 100칸: lunar-javascript SHI_SHEN과 일치(七杀=편관)", () => {
    const map: Record<string, string> = {
      比肩: "비견", 劫财: "겁재", 食神: "식신", 伤官: "상관", 偏财: "편재", 正财: "정재", 七杀: "편관", 正官: "정관", 偏印: "편인", 正印: "정인",
    }
    for (const d of STEMS) for (const t of STEMS) expect(tenGodOfStem(d, t), d + t).toBe(map[lib.LunarUtil.SHI_SHEN[d + t]])
  })

  it("지지 120칸 byMainQi: 정기 천간의 십성과 같다", () => {
    const mainQi: Record<Branch, Stem> = { 子: "癸", 丑: "己", 寅: "甲", 卯: "乙", 辰: "戊", 巳: "丙", 午: "丁", 未: "己", 申: "庚", 酉: "辛", 戌: "戊", 亥: "壬" }
    for (const d of STEMS) for (const b of BRANCHES) expect(tenGodOfBranch(d, b, "byMainQi"), d + b).toBe(tenGodOfStem(d, mainQi[b]))
  })

  it("지지 byOrder: 子午巳亥만 음양이 뒤집혀 정/편이 바뀐다", () => {
    // 일간 甲: 子 byMainQi=정인(癸) / byOrder=편인(양수), 午 상관/식신, 巳 식신/상관, 亥 편인/정인
    expect(["子", "午", "巳", "亥"].map((b) => tenGodOfBranch("甲", b as Branch, "byMainQi"))).toEqual(["정인", "상관", "식신", "편인"])
    expect(["子", "午", "巳", "亥"].map((b) => tenGodOfBranch("甲", b as Branch, "byOrder"))).toEqual(["편인", "식신", "상관", "정인"])
    for (const d of STEMS)
      for (const b of ["丑", "寅", "卯", "辰", "未", "申", "酉", "戌"] as Branch[])
        expect(tenGodOfBranch(d, b, "byOrder"), d + b).toBe(tenGodOfBranch(d, b, "byMainQi"))
  })
})

describe("12운성(§5)", () => {
  // rules-spec §5-1 표(子丑寅卯辰巳午未申酉戌亥 순) — 글자 그대로
  const SPEC: Record<string, string> = {
    甲: "목욕 관대 건록 제왕 쇠 병 사 묘 절 태 양 장생",
    丙: "태 양 장생 목욕 관대 건록 제왕 쇠 병 사 묘 절",
    庚: "사 묘 절 태 양 장생 목욕 관대 건록 제왕 쇠 병",
    壬: "제왕 쇠 병 사 묘 절 태 양 장생 목욕 관대 건록",
    乙: "병 쇠 제왕 건록 관대 목욕 장생 양 태 절 묘 사",
    丁: "절 묘 사 병 쇠 제왕 건록 관대 목욕 장생 양 태",
    辛: "장생 양 태 절 묘 사 병 쇠 제왕 건록 관대 목욕",
    癸: "건록 관대 목욕 장생 양 태 절 묘 사 병 쇠 제왕",
  }
  const row = (s: string) => SPEC[s].split(" ") as TwelveStage[]
  // 기본(reverse/withFire): 戊 = 丙 행, 己 = 丁 행
  const DEFAULT_ROW: Record<Stem, string> = { 甲: "甲", 乙: "乙", 丙: "丙", 丁: "丁", 戊: "丙", 己: "丁", 庚: "庚", 辛: "辛", 壬: "壬", 癸: "癸" }
  const def = { twelveStagesYin: "reverse", earthStages: "withFire" } as const

  it("기본 120칸 전수: rules-spec §5-1 표와 일치", () => {
    let n = 0
    for (const s of STEMS)
      BRANCHES.forEach((b, i) => {
        expect(twelveStageOf(s, b, def), s + b).toBe(row(DEFAULT_ROW[s])[i])
        n++
      })
    expect(n).toBe(120)
  })

  it("기본 120칸: rules-spec 공식(양간 (b−start)%12, 음간 (start−b)%12)과 일치", () => {
    const start: Record<Stem, number> = { 甲: 11, 丙: 2, 戊: 2, 庚: 5, 壬: 8, 乙: 6, 丁: 9, 己: 9, 辛: 0, 癸: 3 }
    STEMS.forEach((s, si) =>
      BRANCHES.forEach((b, bi) => {
        const k = si % 2 === 0 ? (bi - start[s] + 12) % 12 : (start[s] - bi + 12) % 12
        expect(twelveStageOf(s, b, def), s + b).toBe(TWELVE_STAGES[k])
      }),
    )
  })

  it("기본 120칸: lunar-javascript _getDiShi 식과 일치", () => {
    const KO: Record<string, TwelveStage> = {
      长生: "장생", 沐浴: "목욕", 冠带: "관대", 临官: "건록", 帝旺: "제왕", 衰: "쇠", 病: "병", 死: "사", 墓: "묘", 绝: "절", 胎: "태", 养: "양",
    }
    STEMS.forEach((s, si) =>
      BRANCHES.forEach((b, bi) => {
        // EightChar._getDiShi: index = offset + (양간 ? zhiIndex : −zhiIndex), 0..11로 접기
        const idx = (((lib.LunarUtil.CHANG_SHENG_OFFSET[s] + (si % 2 === 0 ? bi : -bi)) % 12) + 12) % 12
        expect(twelveStageOf(s, b, def), s + b).toBe(KO[lib.LunarUtil.CHANG_SHENG[idx]])
      }),
    )
  })

  it("록 표 검산: 기본 옵션에서 건록 자리 = 甲寅 乙卯 丙巳 丁午 戊巳 己午 庚申 辛酉 壬亥 癸子", () => {
    const lu: Record<Stem, Branch> = { 甲: "寅", 乙: "卯", 丙: "巳", 丁: "午", 戊: "巳", 己: "午", 庚: "申", 辛: "酉", 壬: "亥", 癸: "子" }
    for (const s of STEMS) {
      expect(BRANCHES.filter((b) => twelveStageOf(s, b, def) === "건록"), s).toEqual([lu[s]])
      expect(LU[s], s).toBe(lu[s])
    }
  })

  // §5-2 변형: 행 바꿔치기 규칙을 테스트에서 따로 적용
  const variants: { name: string; o: { twelveStagesYin: "reverse" | "sameAsYang"; earthStages: "withFire" | "withWater" }; rows: Record<Stem, string> }[] = [
    {
      name: "withWater(수토동법): 戊 = 壬 행, 己 = 癸 행",
      o: { twelveStagesYin: "reverse", earthStages: "withWater" },
      rows: { 甲: "甲", 乙: "乙", 丙: "丙", 丁: "丁", 戊: "壬", 己: "癸", 庚: "庚", 辛: "辛", 壬: "壬", 癸: "癸" },
    },
    {
      name: "sameAsYang(음양동생): 乙=甲 丁=丙 己=戊(=丙) 辛=庚 癸=壬",
      o: { twelveStagesYin: "sameAsYang", earthStages: "withFire" },
      rows: { 甲: "甲", 乙: "甲", 丙: "丙", 丁: "丙", 戊: "丙", 己: "丙", 庚: "庚", 辛: "庚", 壬: "壬", 癸: "壬" },
    },
    {
      name: "sameAsYang + withWater: 戊=壬, 己=戊=壬",
      o: { twelveStagesYin: "sameAsYang", earthStages: "withWater" },
      rows: { 甲: "甲", 乙: "甲", 丙: "丙", 丁: "丙", 戊: "壬", 己: "壬", 庚: "庚", 辛: "庚", 壬: "壬", 癸: "壬" },
    },
  ]
  for (const v of variants)
    it(`변형 120칸 — ${v.name}`, () => {
      for (const s of STEMS) BRANCHES.forEach((b, i) => expect(twelveStageOf(s, b, v.o), s + b).toBe(row(v.rows[s])[i]))
    })

  it("sameAsYang에서도 록 표(LU)는 바뀌지 않는다 — 乙의 12운성 건록은 寅, 록은 卯", () => {
    expect(BRANCHES.filter((b) => twelveStageOf("乙", b, { twelveStagesYin: "sameAsYang", earthStages: "withFire" }) === "건록")).toEqual(["寅"])
    expect(LU.乙).toBe("卯")
  })
})
