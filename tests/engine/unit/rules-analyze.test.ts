// analyzeRules 통합 테스트 — src/engine/rules/index.ts (rules@0.2.0 항목. rules@0.3.0에서 D-019 포함 표시 반영)
// 손계산 사례 3건: 기대값은 rules-spec §1~§9 표로 손으로 계산해 적었다(구현 결과 복사 아님). 계산 과정은 각 사례 주석.
// 사례 원국은 규칙 검산용으로 고른 간지 조합이다(실제 생년월일에서 나온 원국인지는 따지지 않는다).
import { describe, expect, it } from "vitest"
import { BRANCHES, STEMS, sexagenary } from "@/engine/calendar/constants"
import {
  DEFAULT_RULE_OPTIONS, EngineInputError, RULES_ENGINE_VERSION, analyzeRules, computeChart,
  type CalendarResult, type Interaction, type Pillar, type RuleAnalysis,
} from "@/engine"
import { hiddenStemsOf } from "@/engine/rules"

const P = (gz: string): Pillar => ({ stem: gz[0], branch: gz[1] }) as Pillar
const chart = (y: string, m: string, d: string, h: string | null) =>
  ({ engineVersion: "calendar@test", pillars: { year: P(y), month: P(m), day: P(d), hour: h ? P(h) : null } }) as unknown as CalendarResult
const posKey = (m: { pillar: string; part: string; luckIndex?: number }) => `${m.pillar}${m.luckIndex ?? ""}.${m.part}`
const tg = (r: RuleAnalysis) => r.tenGods.map((t) => `${posKey(t.position)}:${t.char}:${t.tenGod}${t.viaHiddenStem ? "/" + t.viaHiddenStem : ""}`)
const ia = (xs: Interaction[]) => xs.map((i) => `${i.type}:${i.members.map(posKey).join("+")}:${i.chars.join("")}`)

describe("손계산 사례 1 — 甲子년 丙寅월 戊辰일 庚申시 (일간 戊 토·양)", () => {
  const r = analyzeRules(chart("甲子", "丙寅", "戊辰", "庚申"))

  it("십성: 천간·지지(정기 음양)·지장간(kr-monthly-30)", () => {
    // 戊(토양) 기준. 甲 목양: 목극토 rel3, 같은 음양 → 편관 / 子 수, 정기 癸 음: 토극수 rel2, 다름 → 정재
    // 子 지장간 壬(양)편재 癸정재 / 丙 화양: 화생토 rel4 같음 → 편인 / 寅 목양 → 편관, 지장간 戊비견 丙편인 甲편관
    // 辰 토양 → 비견, 지장간 乙(음목)정관 癸정재 戊비견 / 庚 금양: 토생금 rel1 같음 → 식신 / 申 → 식신, 지장간 戊비견 壬편재 庚식신
    expect(tg(r)).toEqual([
      "year.stem:甲:편관", "year.branch:子:정재", "year.branch:壬:편재/yeogi", "year.branch:癸:정재/jeonggi",
      "month.stem:丙:편인", "month.branch:寅:편관", "month.branch:戊:비견/yeogi", "month.branch:丙:편인/junggi", "month.branch:甲:편관/jeonggi",
      "day.branch:辰:비견", "day.branch:乙:정관/yeogi", "day.branch:癸:정재/junggi", "day.branch:戊:비견/jeonggi",
      "hour.stem:庚:식신", "hour.branch:申:식신", "hour.branch:戊:비견/yeogi", "hour.branch:壬:편재/junggi", "hour.branch:庚:식신/jeonggi",
    ])
    expect(r.dayMaster).toEqual({ stem: "戊", element: "earth", yinYang: "yang" })
  })

  it("12운성: 일간 戊(화토동법 = 丙 행, 寅 장생 순행) 子태 寅장생 辰관대 申병 / 좌법 甲子목욕 丙寅장생 戊辰관대 庚申건록", () => {
    const day = r.twelveStages.filter((x) => x.basis === "dayStem").map((x) => x.branch + x.stage)
    const own = r.twelveStages.filter((x) => x.basis === "ownPillar").map((x) => x.stem + x.branch + x.stage)
    expect(day).toEqual(["子태", "寅장생", "辰관대", "申병"])
    expect(own).toEqual(["甲子목욕", "丙寅장생", "戊辰관대", "庚申건록"])
    expect(r.twelveStages.every((x) => x.tableId === "twelve-stages:reverse/withFire")).toBe(true)
  })

  it("관계: 甲庚 천간충, 申子辰 삼합 + 그 안의 반합 子辰·子申(D-019: 지우지 않고 subsumedBy), 寅申 충·두 글자 형", () => {
    expect(ia(r.interactions)).toEqual([
      "stemClash:year.stem+hour.stem:甲庚",
      "threeCombine:year.branch+day.branch+hour.branch:子辰申",
      "halfCombine:year.branch+day.branch:子辰",
      "halfCombine:year.branch+hour.branch:子申",
      "clash:month.branch+hour.branch:寅申",
      "punishment:month.branch+hour.branch:寅申",
    ])
    expect(r.interactions.map((i) => i.adjacent)).toEqual([false, false, false, false, false, false])
    expect(r.interactions[1]).toMatchObject({ resultElement: "water", complete: true, scope: "natal" })
    expect(r.interactions[1].subsumedBy).toBeUndefined()
    const tid = "branch.threeCombine.申子辰@year.branch+day.branch+hour.branch"
    expect(r.interactions[2].subsumedBy).toEqual([tid])
    expect(r.interactions[3].subsumedBy).toEqual([tid])
    expect(r.interactions[5]).toMatchObject({ partial: true, punishmentKind: "three" })
    expect(r.interactions[5].subsumedBy).toBeUndefined() // 寅巳申 삼형이 완성되지 않음
  })

  it("공망: 戊辰은 甲子순 → 戌亥, 원국에 없음", () => {
    expect(r.gongmang).toEqual([
      { basis: "day", basisPillar: P("戊辰"), xunHead: P("甲子"), empty: ["戌", "亥"], hits: [] },
    ])
  })

  it("오행: 개수 목2 화1 토2 금2 수1 / 가중(월지3 일지1.5 연·시지1 × 날수/30)", () => {
    expect(r.elements.counts).toEqual({ wood: 2, fire: 1, earth: 2, metal: 2, water: 1 })
    // 천간 각 1: 목1 화1 토1 금1
    // 子×1: 壬10/30+癸20/30 = 수1 / 寅×3: 戊0.7 丙0.7 甲1.6 / 辰×1.5: 乙0.45 癸0.15 戊0.9 / 申×1: 戊7/30 壬7/30 庚16/30
    const w = r.elements.weighted
    expect(w.wood).toBeCloseTo(3.05, 6)
    expect(w.fire).toBeCloseTo(1.7, 6)
    expect(w.earth).toBeCloseTo(1 + 0.7 + 0.9 + 7 / 30, 6)
    expect(w.metal).toBeCloseTo(1 + 16 / 30, 6)
    expect(w.water).toBeCloseTo(1 + 0.15 + 7 / 30, 6)
    // 각 값이 소수 6자리 반올림이라 합은 5자리까지만 비교
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(4 + 1 + 3 + 1.5 + 1, 5)
    // 음양: 천간 넷 양, 지지 子(정기 癸)음 寅양 辰양 申양
    expect(r.elements.yinYang).toEqual({ yang: 7, yin: 1, branchYinYang: "byMainQi" })
    expect(analyzeRules(chart("甲子", "丙寅", "戊辰", "庚申"), { branchYinYang: "byOrder" }).elements.yinYang.yang).toBe(8)
  })
})

describe("손계산 사례 2 — 辛亥년 庚寅월 丁巳일, 시각 모름 (일간 丁 화·음)", () => {
  const r = analyzeRules(chart("辛亥", "庚寅", "丁巳", null))

  it("시주 모름: omitted ['hour'], 시주 항목 없음", () => {
    expect(r.omitted).toEqual(["hour"])
    expect(r.hiddenStems.pillars.hour).toBeNull()
    const all = [...r.tenGods.map((t) => t.position), ...r.twelveStages.map((t) => t.position), ...r.interactions.flatMap((i) => i.members)]
    expect(all.some((p) => p.pillar === "hour")).toBe(false)
    expect(Object.values(r.elements.counts).reduce((a, b) => a + b, 0)).toBe(6)
  })

  it("십성: 辛편재 亥정관(정기 壬 양) / 庚정재 寅정인 / 巳겁재(정기 丙 양) + 지장간", () => {
    // 丁(화음). 辛 금음: 화극금 rel2 같음 → 편재 / 亥 수, byMainQi 양: 수극화 rel3 다름 → 정관
    // 亥 지장간 戊(토양) rel1 다름 → 상관, 甲(목양) rel4 다름 → 정인, 壬 정관
    // 庚 금양 → 정재 / 寅 목양 → 정인, 지장간 戊상관 丙(화양, rel0 다름)겁재 甲정인 / 巳 byMainQi 양 → 겁재, 지장간 戊상관 庚정재 丙겁재
    expect(tg(r)).toEqual([
      "year.stem:辛:편재", "year.branch:亥:정관", "year.branch:戊:상관/yeogi", "year.branch:甲:정인/junggi", "year.branch:壬:정관/jeonggi",
      "month.stem:庚:정재", "month.branch:寅:정인", "month.branch:戊:상관/yeogi", "month.branch:丙:겁재/junggi", "month.branch:甲:정인/jeonggi",
      "day.branch:巳:겁재", "day.branch:戊:상관/yeogi", "day.branch:庚:정재/junggi", "day.branch:丙:겁재/jeonggi",
    ])
    // byOrder: 亥 음 → 편관, 巳 음 → 비견
    const o = analyzeRules(chart("辛亥", "庚寅", "丁巳", null), { branchYinYang: "byOrder" })
    expect(o.tenGods.filter((t) => t.position.part === "branch" && !t.viaHiddenStem).map((t) => t.char + t.tenGod)).toEqual(["亥편관", "寅정인", "巳비견"])
  })

  it("12운성: 丁(역행, 酉 장생) 亥태 寅사 巳제왕 / sameAsYang(丙 행) 亥절 寅장생 巳건록", () => {
    expect(r.twelveStages.filter((x) => x.basis === "dayStem").map((x) => x.branch + x.stage)).toEqual(["亥태", "寅사", "巳제왕"])
    expect(r.twelveStages.filter((x) => x.basis === "ownPillar").map((x) => x.stem + x.branch + x.stage)).toEqual(["辛亥목욕", "庚寅절", "丁巳제왕"])
    const s = analyzeRules(chart("辛亥", "庚寅", "丁巳", null), { twelveStagesYin: "sameAsYang" })
    expect(s.twelveStages.filter((x) => x.basis === "dayStem").map((x) => x.branch + x.stage)).toEqual(["亥절", "寅장생", "巳건록"])
  })

  it("관계(겹침 동시 기록): 寅亥 합·파, 巳亥 충, 寅巳 형·해", () => {
    expect(ia(r.interactions)).toEqual([
      "sixCombine:year.branch+month.branch:亥寅",
      "clash:year.branch+day.branch:亥巳",
      "punishment:month.branch+day.branch:寅巳",
      "break:year.branch+month.branch:亥寅",
      "harm:month.branch+day.branch:寅巳",
    ])
    expect(r.interactions.map((i) => i.adjacent)).toEqual([true, false, true, true, true])
    expect(r.interactions[0]).toMatchObject({ resultElement: "wood", transformed: null })
  })

  it("공망 both: 일주 丁巳(甲寅순) 子丑 hits 없음 / 연주 辛亥(甲辰순) 寅卯 → 월지 寅", () => {
    const b = analyzeRules(chart("辛亥", "庚寅", "丁巳", null), { gongmangBasis: "both" })
    expect(b.gongmang).toEqual([
      { basis: "day", basisPillar: P("丁巳"), xunHead: P("甲寅"), empty: ["子", "丑"], hits: [] },
      { basis: "year", basisPillar: P("辛亥"), xunHead: P("甲辰"), empty: ["寅", "卯"], hits: [{ pillar: "month", part: "branch" }] },
    ])
    expect(b.options.gongmangBasis).toBe("both")
  })

  it("오행: 개수 금2 화2 수1 목1 토0 / 가중 합 = 3 + 1 + 3 + 1.5", () => {
    expect(r.elements.counts).toEqual({ wood: 1, fire: 2, earth: 0, metal: 2, water: 1 })
    // 亥×1: 戊7/30 甲7/30 壬16/30 / 寅×3: 戊0.7 丙0.7 甲1.6 / 巳×1.5: 戊0.35 庚0.35 丙0.8
    const w = r.elements.weighted
    expect(w.wood).toBeCloseTo(7 / 30 + 1.6, 6)
    expect(w.fire).toBeCloseTo(1 + 0.7 + 0.8, 6)
    expect(w.earth).toBeCloseTo(7 / 30 + 0.7 + 0.35, 6)
    expect(w.metal).toBeCloseTo(2 + 0.35, 6)
    expect(w.water).toBeCloseTo(16 / 30, 6)
  })
})

describe("손계산 사례 3 — 己丑년 甲戌월 癸未일 戊午시 (일간 癸 수·음) + 대운 庚辰 · 세운 甲寅", () => {
  const natal = chart("己丑", "甲戌", "癸未", "戊午")
  const r = analyzeRules(natal)

  it("원국 관계: 甲己·戊癸 천간합, 午未 육합, 午戌 반합, 丑未 충, 丑戌未 삼형(완성) + 두 글자 삼형 셋(D-019 subsumedBy), 戌未 파, 丑午 해", () => {
    expect(ia(r.interactions)).toEqual([
      "stemCombine:year.stem+month.stem:己甲",
      "stemCombine:day.stem+hour.stem:癸戊",
      "sixCombine:day.branch+hour.branch:未午",
      "halfCombine:month.branch+hour.branch:戌午",
      "clash:year.branch+day.branch:丑未",
      // 정렬: 근거 위치 [연,월] < [연,월,일] < [연,일] < [월,일]
      "punishment:year.branch+month.branch:丑戌",
      "punishment:year.branch+month.branch+day.branch:丑戌未",
      "punishment:year.branch+day.branch:丑未",
      "punishment:month.branch+day.branch:戌未",
      "break:month.branch+day.branch:戌未",
      "harm:year.branch+hour.branch:丑午",
    ])
    expect(r.interactions.find((i) => i.type === "sixCombine")!.resultElement).toBeNull() // wuWeiCombine none
    expect(r.interactions.find((i) => i.type === "halfCombine")).toMatchObject({ resultElement: "fire", withKing: true, adjacent: false })
    expect(r.interactions.find((i) => i.type === "halfCombine")!.subsumedBy).toBeUndefined()
    expect(r.interactions.find((i) => i.type === "punishment" && i.complete)).toMatchObject({ complete: true, adjacent: true })
    const pid = "branch.punishment.丑戌未@year.branch+month.branch+day.branch"
    expect(r.interactions.filter((i) => i.type === "punishment" && i.partial).map((i) => i.subsumedBy)).toEqual([[pid], [pid], [pid]])
    expect(r.interactions.filter((i) => i.type === "stemCombine").map((i) => i.resultElement)).toEqual(["earth", "fire"])
  })

  it("십성(천간·지지): 己편관 甲상관 戊정관 / 丑편관 戌정관 未편관 午편재(정기 丁 음)", () => {
    // 癸(수음): 己 토음 rel3 같음 편관 / 甲 목양 rel1 다름 상관 / 戊 토양 rel3 다름 정관 / 午 화, 정기 음 rel2 같음 편재
    const main = r.tenGods.filter((t) => !t.viaHiddenStem).map((t) => `${posKey(t.position)}:${t.char}${t.tenGod}`)
    expect(main).toEqual([
      "year.stem:己편관", "year.branch:丑편관", "month.stem:甲상관", "month.branch:戌정관",
      "day.branch:未편관", "hour.stem:戊정관", "hour.branch:午편재",
    ])
  })

  it("12운성: 癸(역행, 卯 장생) 丑관대 戌쇠 未묘 午절", () => {
    expect(r.twelveStages.filter((x) => x.basis === "dayStem").map((x) => x.branch + x.stage)).toEqual(["丑관대", "戌쇠", "未묘", "午절"])
  })

  it("공망 year: 己丑(甲申순) 午未 → 일지 未·시지 午 / day: 癸未(甲戌순) 申酉 → 없음", () => {
    const y = analyzeRules(natal, { gongmangBasis: "year" })
    expect(y.gongmang).toMatchObject([{ basis: "year", xunHead: P("甲申"), empty: ["午", "未"], hits: [{ pillar: "day", part: "branch" }, { pillar: "hour", part: "branch" }] }])
    expect(r.gongmang).toMatchObject([{ basis: "day", xunHead: P("甲戌"), empty: ["申", "酉"], hits: [] }])
  })

  describe("운 포함", () => {
    const L = analyzeRules(natal, undefined, { luck: [P("庚辰")], year: P("甲寅") })
    const luckOnly = L.interactions.filter((i) => i.scope === "luck")

    it("원국 내부 관계는 운이 없을 때와 같다 — 단 운이 완성한 세 글자 관계의 포함 표시(subsumedBy)는 더해진다(D-019, 원국·운 대칭)", () => {
      const strip = (xs: Interaction[]) => xs.map(({ subsumedBy, ...rest }) => (void subsumedBy, rest))
      expect(strip(L.interactions.filter((i) => i.scope === "natal"))).toEqual(strip(r.interactions))
      // 원국 午戌(월-시) 반합은 세운 寅이 완성한 寅午戌 삼합에 포함 → 지우지 않고 표시
      const half = L.interactions.find((i) => i.type === "halfCombine" && i.scope === "natal")!
      expect(half.subsumedBy).toEqual(["branch.threeCombine.寅午戌@month.branch+hour.branch+seun.branch"])
    })

    it("운 관계(손계산): 甲庚 충 2건, 세운 甲 ↔ 연간 己 합, 寅午戌 삼합(세운 寅), 辰戌 충, 丑辰 파", () => {
      // 천간: 세운 甲-연간 己 합 / 대운 庚-월간 甲 충 / 대운 庚-세운 甲 충
      // 지지: 세운 寅 + 월지 戌 + 시지 午 = 寅午戌 삼합. 寅午(시-세운) 반합도 기록하고 subsumedBy 표시(D-019).
      //       寅戌은 생지+고지라 기본(withKingOnly)에서 반합 아님. 대운 辰: 戌과 충, 丑과 파. 방합 두 글자는 기본 꺼짐.
      expect(ia(luckOnly)).toEqual([
        "stemCombine:year.stem+seun.stem:己甲",
        "stemClash:month.stem+daeun0.stem:甲庚",
        "stemClash:daeun0.stem+seun.stem:庚甲",
        "threeCombine:month.branch+hour.branch+seun.branch:戌午寅",
        "halfCombine:hour.branch+seun.branch:午寅",
        "clash:month.branch+daeun0.branch:戌辰",
        "break:year.branch+daeun0.branch:丑辰",
      ])
      expect(luckOnly.find((i) => i.type === "halfCombine")!.subsumedBy).toEqual(["branch.threeCombine.寅午戌@month.branch+hour.branch+seun.branch"])
      expect(luckOnly.every((i) => i.adjacent === false)).toBe(true)
    })

    it("운 십성·12운성: 대운 庚정인 辰정관(辰 양), 세운 甲상관 寅상관 / 癸 기준 辰양 寅목욕", () => {
      const t = L.tenGods.filter((x) => x.position.pillar === "daeun" || x.position.pillar === "seun").map((x) => `${posKey(x.position)}:${x.char}${x.tenGod}`)
      expect(t).toEqual(["daeun0.stem:庚정인", "daeun0.branch:辰정관", "seun.stem:甲상관", "seun.branch:寅상관"])
      const s = L.twelveStages.filter((x) => x.basis === "dayStem" && x.position.pillar !== "year" && ["daeun", "seun"].includes(x.position.pillar))
      expect(s.map((x) => x.branch + x.stage)).toEqual(["辰양", "寅목욕"])
      expect(L.source.luck).toEqual([P("庚辰")])
      expect(L.source.seun).toEqual(P("甲寅"))
    })
  })
})

describe("결과 메타·옵션·오류", () => {
  it("engineVersion rules@0.4.0, 역법 버전, 사용 옵션 전체 기록", () => {
    const r = analyzeRules(chart("甲子", "丙寅", "戊辰", "庚申"), { hiddenStemTable: "cn-lunarjs" })
    expect(r.engineVersion).toBe("rules@0.4.0") // D-022 (QA 갱신 2026-11-28)
    expect(RULES_ENGINE_VERSION).toBe("rules@0.4.0")
    expect(r.calendarEngineVersion).toBe("calendar@test")
    expect(r.options).toEqual({ ...DEFAULT_RULE_OPTIONS, hiddenStemTable: "cn-lunarjs" })
    expect(r.hiddenStems.tableId).toBe("cn-lunarjs")
    expect(r.elements.hiddenStemTable).toBe("cn-lunarjs")
  })

  it("기본 옵션(연구소장 제안, 잠정)", () => {
    expect(DEFAULT_RULE_OPTIONS).toEqual({
      hiddenStemTable: "kr-monthly-30", branchYinYang: "byMainQi", twelveStagesYin: "reverse", earthStages: "withFire",
      strengthModel: "weighted-v1", gongmangBasis: "day", halfCombine: "withKingOnly", partialPunishment: true,
      wuWeiCombine: "none", partialDirectional: false,
      // P3-06 (strength-structure-spec §6 기본 제안)
      strengthPrimary: "weighted", monthCommandBasis: "mainQi", deukjiBasis: "dayBranchMainQi", combineAdjustment: "none",
      structureTouchul: "transparentFirst", touchulMatch: "sameStem", rokgeopAlternative: true, specialStructures: "candidateOnly",
      usefulGodMethods: ["eokbu", "johuClimate", "tonggwan", "gyeokguk", "special"], favorableDefinition: "generationCycle",
      // rules@0.4.0 (strength-structure-spec §6 "2026-11-28 추가": §2.2 earthRokgeop 기본 mainQiGate, §3.3 통관 기준 기본 0.25 / 0.5)
      earthRokgeop: "mainQiGate", tonggwanMinShare: 0.25, tonggwanMinRatio: 0.5,
    })
  })

  it("지원하지 않는 옵션 값·모르는 키는 EngineInputError(조용히 기본값으로 바꾸지 않음)", () => {
    const c = chart("甲子", "丙寅", "戊辰", "庚申")
    expect(() => analyzeRules(c, { hiddenStemTable: "kr-60" as never })).toThrow(EngineInputError)
    expect(() => analyzeRules(c, { partialPunishment: "yes" as never })).toThrow(EngineInputError)
    expect(() => analyzeRules(c, { hiddenStemTabel: "main-only" } as never)).toThrow(EngineInputError)
    expect(() => analyzeRules(c, { hiddenStemTable: undefined })).not.toThrow()
  })

  it("알 수 없는 간지 글자·음양이 맞지 않는 간지·잘못된 운 입력은 EngineInputError", () => {
    expect(() => analyzeRules({ pillars: { year: P("甲丑"), month: P("丙寅"), day: P("戊辰"), hour: null } } as never)).toThrow(EngineInputError)
    expect(() => analyzeRules({ pillars: { year: P("가子"), month: P("丙寅"), day: P("戊辰"), hour: null } } as never)).toThrow(EngineInputError)
    expect(() => analyzeRules({} as never)).toThrow(EngineInputError)
    const c = chart("甲子", "丙寅", "戊辰", "庚申")
    expect(() => analyzeRules(c, undefined, { luck: P("庚辰") as never })).toThrow(EngineInputError)
    expect(() => analyzeRules(c, undefined, { luck: [P("庚卯")] })).toThrow(EngineInputError)
    expect(() => analyzeRules(c, undefined, { year: P("甲X") })).toThrow(EngineInputError)
  })

  it("결정성·입력 불변: 같은 입력이면 같은 출력, 입력 객체를 바꾸지 않음", () => {
    const c = chart("己丑", "甲戌", "癸未", "戊午")
    const luck = [P("庚辰"), P("辛巳")]
    const snapshot = JSON.stringify([c, luck])
    Object.freeze(c.pillars)
    const a = analyzeRules(c, { gongmangBasis: "both" }, { luck, year: P("甲寅") })
    const b = analyzeRules(c, { gongmangBasis: "both" }, { luck, year: P("甲寅") })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(JSON.stringify([c, luck])).toBe(snapshot)
  })
})

describe("공망 hits — 60갑자 일주 전수(rules-spec §8 식)", () => {
  it("기준 기둥을 뺀 원국·대운·세운 지지 중 공망에 든 위치", () => {
    for (let i = 0; i < 60; i++) {
      const pz = (k: number) => sexagenary(i + k)
      const c = { engineVersion: "t", pillars: { year: pz(10), month: pz(20), day: pz(0), hour: pz(30) } } as unknown as CalendarResult
      const r = analyzeRules(c, undefined, { luck: [pz(40)], year: pz(50) })
      const d = pz(0)
      const x = (BRANCHES.indexOf(d.branch) - STEMS.indexOf(d.stem) + 12) % 12
      const empty = [BRANCHES[(x + 10) % 12], BRANCHES[(x + 11) % 12]]
      const cand: [string, Pillar][] = [["year", pz(10)], ["month", pz(20)], ["hour", pz(30)], ["daeun0", pz(40)], ["seun", pz(50)]]
      const expected = cand.filter(([, p]) => empty.includes(p.branch)).map(([k]) => `${k}.branch`)
      expect(r.gongmang[0].empty, d.stem + d.branch).toEqual(empty)
      expect(r.gongmang[0].hits.map(posKey), d.stem + d.branch).toEqual(expected)
    }
  })
})

describe("computeChart 연동 + 근거 위치 불변식(P4-04 검증기용)", () => {
  // 1950~2049년 매년 3월 15일 정오(서울) 100건 — 원국 글자는 역법 엔진 결과, 여기서는 '근거 위치의 글자가 원국에 실제로 있는가'만 본다
  const charts = Array.from({ length: 100 }, (_, k) =>
    computeChart({ calendar: "solar", year: 1950 + k, month: 3, day: 15, time: k % 7 === 0 ? null : { hour: 12, minute: 0 }, gender: k % 2 ? "M" : "F" }),
  )

  it("모든 판정의 position·chars가 source의 글자와 맞는다", () => {
    for (const c of charts) {
      const r = analyzeRules(c, { gongmangBasis: "both" }, { luck: c.luck.daeun.slice(0, 3).map((d) => d.pillar), year: P("丙午") })
      expect(r.source.natal).toEqual(c.pillars)
      expect(r.calendarEngineVersion).toBe(c.engineVersion)
      expect(r.omitted).toEqual(c.pillars.hour ? [] : ["hour"])
      const at = (pos: { pillar: string; part: "stem" | "branch"; luckIndex?: number }) => {
        const p =
          pos.pillar === "daeun" ? r.source.luck[pos.luckIndex!] : pos.pillar === "seun" ? r.source.seun! : r.source.natal[pos.pillar as "year"]!
        return p[pos.part]
      }
      for (const t of r.tenGods) {
        if (t.viaHiddenStem) {
          const hs = hiddenStemsOf(at(t.position) as never, r.options.hiddenStemTable)
          expect(hs.some((h) => h.stem === t.char && h.role === t.viaHiddenStem)).toBe(true)
        } else expect(at(t.position)).toBe(t.char)
      }
      for (const i of r.interactions) expect(i.members.map(at)).toEqual(i.chars)
      for (const s of r.twelveStages) expect(at(s.position)).toBe(s.branch)
      for (const g of r.gongmang) for (const h of g.hits) expect(g.empty).toContain(at(h))
      // 오행 가중 합 = 천간 수 + 지지 위치 가중 합
      const n = c.pillars.hour ? 4 : 3
      const wsum = Object.values(r.elements.weighted).reduce((a, b) => a + b, 0)
      expect(wsum).toBeCloseTo(n + 1 + 3 + 1.5 + (c.pillars.hour ? 1 : 0), 5)
      expect(Object.values(r.elements.counts).reduce((a, b) => a + b, 0)).toBe(2 * n)
    }
  })
})
