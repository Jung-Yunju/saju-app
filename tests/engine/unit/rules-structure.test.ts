// 격국(정격·록겁·특수격 후보) 테스트 — src/engine/rules/structure.ts (rules@0.3.0, P3-06 → rules@0.4.0 D-022)
// 기대값: docs/knowledge/strength-structure-spec.md §2 규칙과 §7 사례 1~12의 손계산 값. 구현 결과 복사 아님.
// 0.4.0(QA 갱신 2026-11-28): 상신 hiddenOnly → hiddenPositions + presence — 명세 §7 사례 2·3·4·5·10·11 정정본 손계산 값으로 기대값 작성
import { describe, expect, it } from "vitest"
import { analyzeRules, type CalendarResult, type Pillar, type RuleOptions, type StructureCandidate } from "@/engine"

const P = (gz: string): Pillar => ({ stem: gz[0], branch: gz[1] }) as Pillar
const chart = (y: string, m: string, d: string, h: string | null) =>
  ({ engineVersion: "calendar@test", pillars: { year: P(y), month: P(m), day: P(d), hour: h ? P(h) : null } }) as unknown as CalendarResult
const run = (gz: string, o?: Partial<RuleOptions>) => {
  const [y, m, d, h] = gz.split("/")
  return analyzeRules(chart(y, m, d, h === "-" ? null : h), o)
}
const pk = (p: { pillar: string; part: string }) => `${p.pillar}.${p.part}`
const brief = (c: StructureCandidate) => `${c.name}:${c.confidence}:${c.role}`
const sang = (c: StructureCandidate) =>
  (c.sangsin ?? []).map((s) => `${s.group}:${s.element}:T[${s.touchul.map(pk).join(",")}]`)

describe("§7 사례별 정격", () => {
  it("사례 1 甲寅/丙寅/甲辰/乙亥: 寅 = 甲의 록 → 건록격 medium(두 변형 같음) + G1-alt 丙(寅 중기) 월간 투출 → 식신격 대체 후보 low", () => {
    const s = run("甲寅/丙寅/甲辰/乙亥").structure
    expect(s.candidates.map(brief)).toEqual(["건록격:medium:primary", "식신격:low:rokgeopAlt"])
    expect(s.candidates[0]).toMatchObject({ kind: "rokgeop", school: "자평진전", variantAgreement: "same", ruleId: "structure.zp.G1.geonrok" })
    expect(s.candidates[1].pivot).toEqual({ stem: "丙", role: "junggi", touchul: { pillar: "month", part: "stem" }, tenGod: "식신" })
    expect(s.candidates[1].ruleId).toBe("structure.zp.G1alt")
    // 록겁: 상신 후보 = 천간에 투출한 재·관·식상 → 월간 丙(식상)만
    expect(sang(s.candidates[0])).toEqual(["siksang:fire:T[month.stem]"])
    expect(s.tableSensitive).toBe(false)
  })

  it("사례 2: 子 정기 癸 = 정관, 투출 없음 → 정관격 medium. 상신 재성(금, 酉 지장간만) · 인성(목, 연간 甲 투출)", () => {
    const [c, ...rest] = run("甲辰/丙子/丙子/丁酉").structure.candidates
    expect(rest).toEqual([])
    expect(brief(c)).toBe("정관격:medium:primary")
    expect(c.pivot).toEqual({ stem: "癸", role: "jeonggi", touchul: null, tenGod: "정관" })
    const jae = c.sangsin!.find((x) => x.group === "jaeseong")!
    expect([jae.element, jae.touchul, jae.hiddenPositions.map(pk), jae.presence]).toEqual(["metal", [], ["hour.branch"], "hiddenOnly"])
    const ins = c.sangsin!.find((x) => x.group === "inseong")!
    // 명세 사례 2: 인성(목) touchul [연간 甲] · hiddenPositions [연지 辰(乙)] · stemAndHidden
    expect([ins.element, ins.touchul.map(pk), ins.hiddenPositions.map(pk), ins.presence]).toEqual(["wood", ["year.stem"], ["year.branch"], "stemAndHidden"])
    // 꺼리는: 상관(식상 중) · 편관 — 십성 제한 표시
    expect(c.avoid!.map((a) => `${a.group}:${(a.tenGods ?? []).join("")}`)).toEqual(["siksang:상관", "gwansal:편관"])
  })

  it("사례 3: 酉 = 庚의 양인 → 양인격 medium, 酉의 庚·辛 모두 비겁이라 G1-alt 없음. 상신 관살(화) 투출 [연간 丙, 월간 丁]", () => {
    const s = run("丙寅/丁酉/庚辰/壬午").structure
    expect(s.candidates.map(brief)).toEqual(["양인격:medium:primary"])
    expect(sang(s.candidates[0])).toEqual(["gwansal:fire:T[year.stem,month.stem]"])
    // 명세 사례 3: hiddenPositions [연지 寅(丙), 시지 午(丙·丁)] · stemAndHidden
    expect([s.candidates[0].sangsin![0].hiddenPositions.map(pk), s.candidates[0].sangsin![0].presence]).toEqual([["year.branch", "hour.branch"], "stemAndHidden"])
  })

  it("사례 4: 子 = 壬의 양인 → 양인격 medium. 상신 관살(토) 투출 없음, 지장간만(寅戊·午己·未己)", () => {
    const [c] = run("丙寅/庚子/壬午/丁未").structure.candidates
    expect(brief(c)).toBe("양인격:medium:primary")
    expect(c.sangsin!.map((x) => [x.group, x.element, x.touchul, x.hiddenPositions.map(pk), x.presence])).toEqual([
      ["gwansal", "earth", [], ["year.branch", "day.branch", "hour.branch"], "hiddenOnly"],
    ])
  })

  it("사례 5: 酉 정기 辛 월간 투출 → 정관격 medium. 상신 재성(토) 투출 [연간 戊]+지장간 stemAndHidden, 인성(수) 지장간만 [시지 亥] hiddenOnly", () => {
    const [c] = run("戊寅/辛酉/甲寅/乙亥").structure.candidates
    expect(brief(c)).toBe("정관격:medium:primary")
    expect(c.pivot).toMatchObject({ stem: "辛", role: "jeonggi", touchul: { pillar: "month", part: "stem" } })
    expect(c.sangsin!.map((x) => [x.group, x.element, x.touchul.map(pk), x.hiddenPositions.map(pk), x.presence])).toEqual([
      ["jaeseong", "earth", ["year.stem"], ["year.branch", "day.branch", "hour.branch"], "stemAndHidden"],
      ["inseong", "water", [], ["hour.branch"], "hiddenOnly"],
    ])
  })

  it("사례 6(시주 모름): 양인격 medium — 시주와 무관", () => {
    expect(run("丙寅/丁酉/庚辰/-").structure.candidates.map(brief)).toEqual(["양인격:medium:primary"])
  })

  it("사례 7: 巳 정기 丙 시간 투출 → 칠살격(편관격) medium. 일간과 같은 庚(巳 중기)은 투출 판정 대상 아님", () => {
    const [c] = run("甲辰/己巳/庚戌/丙子").structure.candidates
    expect(brief(c)).toBe("칠살격:medium:primary")
    expect(c.alias).toEqual(["편관격"])
    expect(c.pivot).toEqual({ stem: "丙", role: "jeonggi", touchul: { pillar: "hour", part: "stem" }, tenGod: "편관" })
  })

  it("사례 8: 子 여기 壬 시간 투출·정기 癸 미투출 → transparentFirst 칠살격 / mainQiOnly 정관격 → differs, 둘 다 low. cn-lunarjs(子=癸)면 정관격 → tableSensitive", () => {
    const s = run("庚申/戊子/丙申/壬辰").structure
    const reg = s.candidates.filter((c) => c.kind !== "special")
    expect(reg.map(brief)).toEqual(["칠살격:low:primary", "정관격:low:otherVariant"])
    expect(reg.every((c) => c.variantAgreement === "differs")).toBe(true)
    expect(reg[0].pivot).toEqual({ stem: "壬", role: "yeogi", touchul: { pillar: "hour", part: "stem" }, tenGod: "편관" })
    expect(reg[0].ruleId).toBe("structure.zp.G2")
    expect(reg[1].ruleId).toBe("structure.zp.G2main")
    expect(s.byTable).toEqual([
      { tableId: "kr-monthly-30", name: "칠살격" },
      { tableId: "cn-lunarjs", name: "정관격" },
      { tableId: "main-only", name: "정관격" },
    ])
    expect(s.tableSensitive).toBe(true)
    // 옵션 mainQiOnly면 주 후보가 정관격
    expect(run("庚申/戊子/丙申/壬辰", { structureTouchul: "mainQiOnly" }).structure.candidates.filter((c) => c.kind !== "special").map(brief)).toEqual([
      "정관격:low:primary", "칠살격:low:otherVariant",
    ])
    // sameElement: 정기 癸가 같은 오행 壬(시간)으로 투출 → 정관격, 두 변형 같음 → medium
    expect(run("庚申/戊子/丙申/壬辰", { touchulMatch: "sameElement" }).structure.candidates.filter((c) => c.kind !== "special").map(brief)).toEqual([
      "정관격:medium:primary",
    ])
  })

  it("사례 9: 未 정기 己 = 겁재, 戊의 록(巳)·양인(午) 아님 → 월겁격 medium. G1-alt 未 여기 丁 시간 투출 → 정인격 low. 상신(록겁): 투출한 재·관·식상 없음", () => {
    const s = run("戊午/己未/戊戌/丁巳").structure
    const reg = s.candidates.filter((c) => c.kind !== "special")
    expect(reg.map(brief)).toEqual(["월겁격:medium:primary", "정인격:low:rokgeopAlt"])
    expect(reg[0].sangsin).toEqual([])
    expect(reg[1].pivot).toEqual({ stem: "丁", role: "yeogi", touchul: { pillar: "hour", part: "stem" }, tenGod: "정인" })
    expect(reg[1].alias).toEqual(["인수격"])
  })

  it("사례 10: 丑 정기 己 월간 투출 → 정재격 medium. 상신 식상(화) 지장간만 [일지 戌의 丁] · 관(금) 투출 [연간 庚]", () => {
    const [c] = run("庚辰/己丑/甲戌/戊辰").structure.candidates
    expect(brief(c)).toBe("정재격:medium:primary")
    expect(c.sangsin!.map((x) => [x.group, x.element, x.touchul.map(pk), x.hiddenPositions.map(pk), x.presence])).toEqual([
      ["siksang", "fire", [], ["day.branch"], "hiddenOnly"],
      ["gwansal", "metal", ["year.stem"], ["month.branch", "day.branch"], "stemAndHidden"],
    ])
    expect(c.avoid!.map((a) => a.group)).toEqual(["bigyeop"])
  })

  it("사례 11: 申 정기 庚 연간 투출 → 칠살격 medium. 상신 식신(화) 지장간만 [일지 寅의 丙] · 인성(수) 투출 [시간 癸]", () => {
    const [c] = run("庚申/甲申/甲寅/癸酉").structure.candidates
    expect(brief(c)).toBe("칠살격:medium:primary")
    expect(c.sangsin!.map((x) => [x.group, x.tenGods ?? null, x.element, x.touchul.map(pk)])).toEqual([
      ["siksang", ["식신"], "fire", []],
      ["inseong", null, "water", ["hour.stem"]],
    ])
    expect([c.sangsin![0].hiddenPositions.map(pk), c.sangsin![0].presence]).toEqual([["day.branch"], "hiddenOnly"])
    // 명세 사례 11: 인성(수) hiddenPositions [연지 申(壬), 월지 申(壬)] · stemAndHidden
    expect([c.sangsin![1].hiddenPositions.map(pk), c.sangsin![1].presence]).toEqual([["year.branch", "month.branch"], "stemAndHidden"])
  })

  it("사례 12: 亥 = 壬 록 → 건록격 medium. 亥 지장간 戊·甲 투출 없음 → G1-alt 없음. 상신: 투출한 재·관·식상 없음", () => {
    const s = run("癸亥/癸亥/壬子/辛丑").structure
    expect(s.candidates.map(brief)).toEqual(["건록격:medium:primary"])
    expect(s.candidates[0].sangsin).toEqual([])
  })
})

describe("§2.4 특수격 후보 (확신도 low, 억부 대표값 불변)", () => {
  it("사례 8: 종살격 후보 — F1 0.12381 · F2 무근 · F3 인성 9u = 2.857% · 관살 140.5u = 44.6% ≥ 40%", () => {
    const r = run("庚申/戊子/丙申/壬辰")
    const sp = r.structure.candidates.filter((c) => c.kind === "special")
    expect(sp.map((c) => c.name)).toEqual(["종살격 후보"])
    const c = sp[0]
    expect(c).toMatchObject({ confidence: "low", reversesUsefulGod: true, school: "적천수 계열", ruleId: "special.jong", follows: { group: "gwansal", element: "water" } })
    const cond = Object.fromEntries(c.conditions!.map((x) => [x.id, [x.met, x.value ?? null]]))
    expect(cond.F1).toEqual([true, 0.12381])
    expect(cond.F2).toEqual([true, null])
    expect(cond.F3).toEqual([true, Math.round((9 / 315) * 1e6) / 1e6])
    expect(cond.F4).toEqual([true, Math.round((140.5 / 315) * 1e6) / 1e6])
    // 억부 대표값은 바뀌지 않는다(목 → 화)
    expect(r.usefulGods.views.find((v) => v.method === "eokbu")!.candidates.map((x) => x.element)).toEqual(["wood", "fire"])
  })

  it("사례 2: 무근이지만 r 0.41 > 0.20 → 종격 후보 없음(무근만으로는 종격 아님)", () => {
    const s = run("甲辰/丙子/丙子/丁酉").structure
    expect(s.candidates.some((c) => c.kind === "special")).toBe(false)
    expect(s.notes).toEqual([])
  })

  it("사례 9: 종왕격 후보 — E1 0.906 · E2 관살 9u = 2.857% · 비겁 157 ≥ 인성 98.5. 가색(辰戌丑未 3자 이상)은 未·戌 둘뿐 → 후보 아님", () => {
    const sp = run("戊午/己未/戊戌/丁巳").structure.candidates.filter((c) => c.kind === "special")
    expect(sp.map((c) => c.name)).toEqual(["종왕격 후보"])
    expect(sp[0]).toMatchObject({ confidence: "low", reversesUsefulGod: true, ruleId: "special.jongwang", follows: { group: "bigyeop", element: "earth" } })
    expect(sp[0].conditions).toEqual([
      { id: "E1", met: true, value: 0.906349 },
      { id: "E2", met: true, value: Math.round((9 / 315) * 1e6) / 1e6 },
    ])
  })

  it("사례 10: 화토격 후보 — H1~H6 충족(H5 토 177u = 56.2%), obstructions 천간충 甲庚(연간·일간). 종격 검사 안 함(r 0.257)", () => {
    const s = run("庚辰/己丑/甲戌/戊辰").structure
    const sp = s.candidates.filter((c) => c.kind === "special")
    expect(sp.map((c) => c.name)).toEqual(["화토격 후보"])
    const c = sp[0]
    expect(c).toMatchObject({ confidence: "low", reversesUsefulGod: true, ruleId: "special.hwa", follows: { element: "earth" } })
    expect(c.conditions!.map((x) => `${x.id}:${x.met}`)).toEqual(["H1:true", "H2:true", "H3:true", "H4:true", "H5:true", "H6:true"])
    expect(c.conditions!.find((x) => x.id === "H5")!.value).toBe(Math.round((177 / 315) * 1e6) / 1e6)
    expect(c.obstructions).toEqual([{ ruleId: "stem.clash.甲庚", members: [{ pillar: "year", part: "stem" }, { pillar: "day", part: "stem" }] }])
    expect(s.notes).toEqual([])
  })

  it("사례 12: 亥子丑 방합 완성이지만 E1 ✗(0.765) · 관살 14.6% > 5% → 윤하격 후보 아님", () => {
    const r = run("癸亥/癸亥/壬子/辛丑")
    expect(r.interactions.some((i) => i.type === "directionalCombine" && i.complete && i.resultElement === "water")).toBe(true)
    expect(r.structure.candidates.some((c) => c.kind === "special")).toBe(false)
  })

  it("F1만 맞고 F2·F3가 안 맞으면 후보 없이 notes '극신약이나 종격 조건 미충족' (설계 사례: 丙 일간, 연지 寅에 丙 뿌리)", () => {
    // 庚寅/戊子/丙申/壬辰: 사례 8에서 연주만 庚寅으로 — 寅의 丙(중기)이 일간 뿌리 → F2 ✗
    // A: S = 30 + 寅(甲16 + 丙7) + 辰乙9 = 62 → r = 62/315 = 0.196825 ≤ 0.20
    const r = run("庚寅/戊子/丙申/壬辰")
    expect(r.strength.models[0].ratio).toBe(0.196825)
    expect(r.strength.dayMasterRooted).toBe(true)
    expect(r.structure.candidates.some((c) => c.ruleId === "special.jong")).toBe(false)
    expect(r.structure.notes).toContain("극신약이나 종격 조건 미충족")
  })

  it("specialStructures off: 특수격 후보 없음, special view notApplicable", () => {
    const r = run("庚申/戊子/丙申/壬辰", { specialStructures: "off" })
    expect(r.structure.candidates.some((c) => c.kind === "special")).toBe(false)
    expect(r.usefulGods.views.find((v) => v.method === "special")).toMatchObject({ status: "notApplicable", candidates: [] })
  })
})

describe("규칙 세부", () => {
  it("rokgeopAlternative false: 사례 1은 건록격만", () => {
    expect(run("甲寅/丙寅/甲辰/乙亥", { rokgeopAlternative: false }).structure.candidates.map(brief)).toEqual(["건록격:medium:primary"])
  })

  it("편인격: 인수(순용)·효신(역용) 두 관점의 상신을 모두 표시하고 notes에 남김", () => {
    // 설계 사례 丙寅/己亥/甲午/壬申: 甲 일간, 亥월 지장간 戊(여기)·甲(중기, 비겁 → 건너뜀)·壬(정기 = 편인). 정기 壬 시간 투출 → 편인격
    const s = run("丙寅/己亥/甲午/壬申").structure
    const c = s.candidates[0]
    expect(brief(c)).toBe("편인격:medium:primary")
    expect(c.sangsin!.map((x) => `${x.group}:${x.note}`)).toEqual(["gwansal:인수로 볼 때(순용)", "jaeseong:효신으로 볼 때(역용): 재성으로 편인을 제어"])
    expect(s.notes.some((n) => n.includes("편인격"))).toBe(true)
  })

  it("⚑ 명세 G1 조건상 戊·己 일간은 건록·양인격이 나오지 않는다(午·巳 정기 丁·丙은 인성) — 현재 동작 기록", () => {
    // 戊 일간 午월: 午 정기 丁 = 정인 → 록겁 계열 아님 → G2. 丁 투출 없음 → 정기 丁 → 정인격. 양인 표의 戊午는 쓰이지 않음
    expect(run("甲子/庚午/戊辰/甲寅").structure.candidates[0].name).toBe("정인격")
    // 戊 일간 巳월(LU 戊=巳): 巳 정기 丙 = 편인 → 편인격(투출 없음)
    expect(run("甲子/己巳/戊辰/甲寅").structure.candidates[0].name).not.toBe("건록격")
  })
})
