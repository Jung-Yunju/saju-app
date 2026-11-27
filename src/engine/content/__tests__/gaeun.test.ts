// 개운 범주 선택(gaeun.ts) — 담당: 백엔드·서버 개발자
// 기대값 출처: docs/knowledge/gaeun.md §3.5 "시험" 4건(strength-structure-spec §7 사례 12·5·11·9)의 손계산 결과와 §3.2 규칙.
// 구현 출력을 복사하지 않았다. 명세에 손계산이 없는 엔진 표지(tableSensitive·reversesUsefulGod)는 "전제" 테스트로 엔진 값을 먼저 확인한다.
// 모든 원국은 시험용(실제 고객 아님).
import { describe, expect, it } from "vitest"
import { analyzeRules, computeChart, type CalendarResult, type Pillar } from "../../index"
import type { RuleAnalysis } from "../../rules/types"
import { buildPersonalContext } from "../../personalize"
import { buildFactSheet } from "../facts"
import {
  buildGaeunBasis, GAEUN_CATALOG, GAEUN_CATEGORY_IDS, GAEUN_FORBIDDEN_WORDS, luckGlyphsOf, pickGaeun, seunShaking, surfaceGroupCounts,
  type GaeunOptions,
} from "../gaeun"
import type { GaeunPick, LuckGlyphFacts } from "../types"

const P = (gz: string): Pillar => ({ stem: gz[0], branch: gz[1] }) as Pillar
const chartOf = (gz: string): CalendarResult => {
  const [y, m, d, h] = gz.split("/")
  return { engineVersion: "calendar@test", pillars: { year: P(y), month: P(m), day: P(d), hour: h && h !== "-" ? P(h) : null } } as unknown as CalendarResult
}
const rulesOf = (gz: string, luck?: string, seun?: string): RuleAnalysis =>
  analyzeRules(chartOf(gz), undefined, { ...(luck ? { luck: [P(luck)] } : {}), ...(seun ? { year: P(seun) } : {}) })

function picksOf(gz: string, opts: { luck?: string; seun?: string; turn?: boolean; options?: GaeunOptions } = {}) {
  const rules = rulesOf(gz, opts.luck, opts.seun)
  const basis = buildGaeunBasis(rules)!
  const luck: LuckGlyphFacts[] = []
  if (opts.luck) luck.push(luckGlyphsOf(rules, { slot: "daeun", luckIndex: 0, daeunIndex: 3 })!)
  if (opts.seun) luck.push(luckGlyphsOf(rules, { slot: "seun", year: 2026 })!)
  const picks = pickGaeun(
    {
      basis, dayElement: rules.dayMaster.element, hourKnown: rules.source.natal.hour !== null, luck,
      turn: opts.turn && opts.luck ? { daeunIndex: 3, startYear: 2026, ganzhi: opts.luck } : null,
    },
    opts.options,
  )
  return { rules, basis, luck, picks }
}
const ids = (ps: GaeunPick[]) => ps.map((p) => p.id)
const byId = (ps: GaeunPick[], id: string) => ps.find((p) => p.id === id)!
/** 명세 손계산은 u 단위(천간 1.0 = 30u), 엔진 가중값은 천간 1.0 단위 — 6자리 반올림 */
const u = (x: number) => Math.round((x / 30) * 1e6) / 1e6

// ─────────────────────────────────────────── gaeun.md §3.5 시험 4건

describe("사례 12 — 癸亥/癸亥/壬子/辛丑(신강 비겁형 + 한·습 강)", () => {
  const { rules, picks } = picksOf("癸亥/癸亥/壬子/辛丑")
  it("전제(엔진 표지, 명세 손계산 없음): 세 모형 일치·경계 아님·표 민감 true → C3", () => {
    expect(rules.strength.agreement).toBe("all")
    expect(rules.strength.tableSensitive).toBe(true)
  })
  it("GA.fill.gwansal · GA.ease.bigyeop · GJ.warm · GJ.dry, 그리고 GE 토(억부)·화(조후 compatible)", () => {
    expect(ids(picks)).toEqual(["GA.fill.gwansal", "GA.ease.bigyeop", "GJ.warm", "GJ.dry", "GE.earth", "GE.fire"])
  })
  it("fill: 토(관살), 드러난 관살 1개(丑 정기 己), 46/315 ≥ 0.10 → use", () => {
    const f = byId(picks, "GA.fill.gwansal")
    expect(f.element).toBe("토")
    expect(f.framing).toBe("use")
    expect(f.basis[0].values).toMatchObject({ surfaceCount: 1, presentWeight: u(46), total: u(315) })
    expect(f.tone).toBe("soft")
    expect(f.softBy).toEqual(["C3"])
  })
  it("조후 화 = 재성, 신강이 보태도 되는 쪽 → compatible", () => {
    expect(byId(picks, "GJ.warm").conflict).toBe("compatible")
    expect(byId(picks, "GJ.dry").conflict).toBe("compatible")
    expect(byId(picks, "GJ.warm").element).toBe("화")
  })
  it("통관 없음(spec §7.1 6-1) → GA.bridge 없음", () => expect(ids(picks)).not.toContain("GA.bridge"))
})

describe("사례 5 — 戊寅/辛酉/甲寅/乙亥(A 신약 관살 최대 vs B 신강, split)", () => {
  const { picks } = picksOf("戊寅/辛酉/甲寅/乙亥")
  it("GA.fill.inseong · GA.ease.gwansal(모두 soft) · GA.bridge(수) · GJ.warm(tension) · GE 수만", () => {
    expect(ids(picks)).toEqual(["GA.fill.inseong", "GA.ease.gwansal", "GA.bridge", "GJ.warm", "GE.water"])
    for (const id of ["GA.fill.inseong", "GA.ease.gwansal"]) {
      expect(byId(picks, id).tone).toBe("soft")
      expect(byId(picks, id).softBy).toEqual(["C1"])
    }
  })
  it("fill: 수(인성), 드러난 인성 1개(亥), 16/315 = 0.0508 < 0.10 → thin", () => {
    const f = byId(picks, "GA.fill.inseong")
    expect(f.element).toBe("수")
    expect(f.framing).toBe("thin")
    expect(f.basis[0].values).toMatchObject({ surfaceCount: 1, presentWeight: u(16) })
  })
  it("통관 수 / 조후 화 = 식상(신약이 보태지 않으려는 쪽, 덜 대상 관살 아님) → tension, GE.fire 없음(§4 P3)", () => {
    expect(byId(picks, "GA.bridge").element).toBe("수")
    expect(byId(picks, "GJ.warm").conflict).toBe("tension")
    expect(ids(picks)).not.toContain("GE.fire")
  })
})

describe("사례 11 — 庚申/甲申/甲寅/癸酉(억부 balanced + 통관)", () => {
  const { picks } = picksOf("庚申/甲申/甲寅/癸酉")
  it("GA.balanced · GA.bridge(수), GJ·GE 없음", () => {
    expect(ids(picks)).toEqual(["GA.balanced", "GA.bridge"])
    expect(byId(picks, "GA.bridge").element).toBe("수")
  })
  it("split·A nearBoundary → 억부에서 나온 GA.balanced는 soft(C1)", () => {
    expect(byId(picks, "GA.balanced").tone).toBe("soft")
    expect(byId(picks, "GA.balanced").softBy).toEqual(["C1"])
  })
})

describe("사례 9 — 戊午/己未/戊戌/丁巳(종왕 후보 vs 억부 vs 조후)", () => {
  const { rules, picks } = picksOf("戊午/己未/戊戌/丁巳")
  it("전제(엔진 출력 확인): 특수격 후보 reversesUsefulGod true → C5", () => {
    const sp = rules.structure.candidates.filter((c) => c.kind === "special")
    expect(sp.length).toBeGreaterThan(0)
    expect(sp.some((c) => c.reversesUsefulGod === true)).toBe(true)
  })
  it("GA.fill.gwansal · GA.ease.bigyeop(soft C5) · GJ.cool · GJ.moisten · GE 수만(억부 목 GE 생략)", () => {
    expect(ids(picks)).toEqual(["GA.fill.gwansal", "GA.ease.bigyeop", "GJ.cool", "GJ.moisten", "GE.water"])
    expect(byId(picks, "GA.fill.gwansal").softBy).toEqual(["C5"])
    expect(byId(picks, "GA.ease.bigyeop").tone).toBe("soft")
  })
  it("fill: 목 드러난 글자 0 → missingSurface, 지장간 9u 있음 → hiddenPresent", () => {
    const f = byId(picks, "GA.fill.gwansal")
    expect(f.element).toBe("목")
    expect(f.framing).toBe("missingSurface")
    expect(f.hiddenPresent).toBe(true)
    expect(f.basis[0].values).toMatchObject({ surfaceCount: 0, presentWeight: u(9) })
  })
  it("조후 수 = 재성 → compatible, 특수격·격국 관점 pick 없음", () => {
    expect(byId(picks, "GJ.cool").conflict).toBe("compatible")
    expect(picks.every((p) => ["eokbu", "johuClimate", "tonggwan", "luck"].includes(p.view))).toBe(true)
  })
})

// ─────────────────────────────────────────── 운 규칙(L1~L7) 손계산

describe("운 L1~L6 — 사례 12(壬 일간: 억부 fav 토·희신 화, load 수 / 조후 fav 화, load 수)", () => {
  it("세운 丙午: 화·화 → 두 기준 move → GT.move. 午 ↔ 일지 子 충 → GI.chungDay, shaking", () => {
    const { picks, luck } = picksOf("癸亥/癸亥/壬子/辛丑", { seun: "丙午" })
    const seun = picks.filter((p) => p.slot === "seun")
    expect(ids(seun)).toEqual(["GT.move", "GI.chungDay"])
    expect(seun[0].luckGroups).toEqual(["jaeseong"])
    expect(byId(seun, "GI.chungDay").basis[0].positions).toEqual(["day.branch", "seun.branch"])
    expect(seunShaking(luck[0])).toBe(true)
  })
  it("대운 壬子: 수·수 → 두 기준 build. 子 ↔ 시지 丑 육합은 일지·월지가 아니라 GI 없음", () => {
    const { picks } = picksOf("癸亥/癸亥/壬子/辛丑", { luck: "壬子" })
    expect(ids(picks.filter((p) => p.slot === "daeun"))).toEqual(["GT.build"])
  })
  it("대운 甲辰: 억부만 move(辰 토 fav, 甲 목 neutral), 조후 판정 없음 → GT.move, 억부 기준이라 soft(C3)", () => {
    const { picks } = picksOf("癸亥/癸亥/壬子/辛丑", { luck: "甲辰" })
    const gt = byId(picks, "GT.move")
    expect(gt.slot).toBe("daeun")
    expect(gt.basis[0].ruleId).toBe("gaeun.L2.eokbu")
    expect(gt.tone).toBe("soft")
    expect(gt.basis[0].positions).toEqual(["daeun[3].stem", "daeun[3].branch"])
  })
})

describe("운 L3·L5·L6 hap·luckHalves — 사례 9(戊 일간: 억부 fav 목·희신 수, load 토 / 조후 fav 수, load 화)", () => {
  it("대운 丙寅: 억부 move vs 조후 build → GT.watch split, 寅午戌 삼합 완성 → GI.hap, 교체 해 → GT.turn", () => {
    const { picks } = picksOf("戊午/己未/戊戌/丁巳", { luck: "丙寅", turn: true })
    expect(ids(picks.filter((p) => p.slot === "daeun"))).toEqual(["GT.watch", "GT.turn", "GI.hap"])
    expect(byId(picks, "GT.watch").split).toEqual({ eokbu: "move", johuClimate: "build" })
    expect(byId(picks, "GT.turn").basis[0].values).toEqual({ startYear: 2026 })
  })
  it("luckHalves: 앞 5년 丙(조후 load → build) · 뒤 5년 寅(억부 fav → move)", () => {
    const { picks } = picksOf("戊午/己未/戊戌/丁巳", { luck: "丙寅", options: { luckHalves: true } })
    const gt = picks.filter((p) => p.id.startsWith("GT."))
    expect(gt.map((p) => [p.id, p.half])).toEqual([["GT.build", "early"], ["GT.move", "late"]])
  })
  it("세운 癸亥: 癸·亥(수) 두 기준 fav → GT.move, 戊癸 천간합(일간) → GI.hap, 巳亥 충(시지) → GI.chungOther(hap 다음), shaking false", () => {
    const { picks, luck } = picksOf("戊午/己未/戊戌/丁巳", { seun: "癸亥" })
    const seun = picks.filter((p) => p.slot === "seun")
    expect(ids(seun)).toEqual(["GT.move", "GI.hap", "GI.chungOther"])
    expect(seunShaking(luck[0])).toBe(false)
  })
})

// ─────────────────────────────────────────── 금지 범주 · 결정성(무작위 2,000 원국)

const STEMS = "甲乙丙丁戊己庚辛壬癸"
const BRANCHES = "子丑寅卯辰巳午未申酉戌亥"
const JIAZI = Array.from({ length: 60 }, (_, i) => STEMS[i % 10] + BRANCHES[i % 12])
function rng(seed: number) {
  let s = seed >>> 0
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32)
}

describe("무작위 2,000 원국 — 금지 범주는 절대 나오지 않는다", () => {
  const r = rng(20261128)
  const pick = () => JIAZI[Math.floor(r() * 60)]
  const samples = Array.from({ length: 2000 }, () => ({
    gz: [pick(), pick(), pick(), r() < 0.2 ? "-" : pick()].join("/"),
    luck: pick(),
    seun: pick(),
    halves: r() < 0.3,
    reference: r() < 0.5,
  }))

  it("모든 pick: 허용 30개 범주 · 참고 등급 기본 숨김 · 격국/특수격 관점 없음 · 금지 낱말 없음 · 같은 기운 채우기/덜기 동시 없음", () => {
    const allowed = new Set(GAEUN_CATEGORY_IDS)
    const seen = new Set<string>()
    let total = 0
    for (const s of samples) {
      const opts: GaeunOptions = { luckHalves: s.halves, ...(s.reference ? { referenceTier: "shown" as const } : {}), views: ["eokbu", "johuClimate", "tonggwan", "gyeokguk", "special", "byeongyak"] }
      const { picks } = picksOf(s.gz, { luck: s.luck, seun: s.seun, turn: true, options: opts })
      const def = picksOf(s.gz, { luck: s.luck, seun: s.seun }).picks
      total += picks.length
      for (const p of picks) {
        expect(allowed.has(p.id), `${s.gz} ${p.id}`).toBe(true)
        expect(["eokbu", "johuClimate", "tonggwan", "luck"]).toContain(p.view)
        seen.add(p.id)
      }
      expect(def.every((p) => p.tier === "practice"), s.gz).toBe(true)
      const json = JSON.stringify(picks)
      for (const w of GAEUN_FORBIDDEN_WORDS) expect(json.includes(w), `${s.gz} ${w}`).toBe(false)
      const ease = picks.filter((p) => p.id.startsWith("GA.ease.")).map((p) => p.element)
      const ge = picks.filter((p) => p.id.startsWith("GE.")).map((p) => p.element)
      for (const e of ge) expect(ease.includes(e), `${s.gz} GE ${e}`).toBe(false)
      for (const slot of ["daeun", "seun"]) expect(picks.filter((p) => p.slot === slot && p.id.startsWith("GI.")).length).toBeLessThanOrEqual(2)
      // GJ가 tension·opposed면 그 오행 GE는 조후 쪽으로 나오지 않는다(§4 P3·P4)
      for (const gj of picks.filter((p) => p.id.startsWith("GJ.") && (p.conflict === "tension" || p.conflict === "opposed")))
        expect(picks.some((p) => p.id.startsWith("GE.") && p.view === "johuClimate" && p.element === gj.element)).toBe(false)
    }
    expect(total).toBeGreaterThan(2000)
    // 30개 범주가 실제로 두루 나온다(분류기가 한쪽에 몰리지 않음 — 측정 겸 확인)
    expect(seen.size).toBeGreaterThanOrEqual(25)
  }, 120_000)

  it("범주표 문구에도 금지 낱말이 없고, 범주는 정확히 30개", () => {
    expect(GAEUN_CATEGORY_IDS.length).toBe(30)
    const text = JSON.stringify(GAEUN_CATALOG)
    for (const w of GAEUN_FORBIDDEN_WORDS) expect(text.includes(w), w).toBe(false)
  })

  it("결정성: 같은 입력 두 번 → 배열 순서까지 같다", () => {
    for (const s of samples.slice(0, 200)) {
      const a = picksOf(s.gz, { luck: s.luck, seun: s.seun, turn: true })
      const b = picksOf(s.gz, { luck: s.luck, seun: s.seun, turn: true })
      expect(b.picks).toEqual(a.picks)
      expect(b.basis).toEqual(a.basis)
    }
  })
})

// ─────────────────────────────────────────── 사실표 연결

describe("사실표(facts@0.3.0) — 개운·운 글자·사용자 사실 연결", () => {
  const AS_OF = new Date("2026-11-27T03:00:00Z")
  // 1985-03-15 10:10 → 乙丑 己卯 癸丑 丁巳, 일간 癸(수). 드러난 글자 손셈: 식상 2(乙·卯) · 재성 2(丁·巳) · 관살 3(己·丑·丑) · 비겁 0 · 인성 0
  const chart = computeChart({ calendar: "solar", year: 1985, month: 3, day: 15, time: { hour: 10, minute: 10 }, gender: "F" })
  const rules = analyzeRules(chart, undefined, { luck: chart.luck.daeun.map((d) => d.pillar), year: { stem: "丙", branch: "午" } })
  const personal = buildPersonalContext(
    chart,
    [
      { questionId: "occupationStatus", values: ["self_employed"] }, // → 재성 2 → match
      { questionId: "selfStrength", values: ["caring", "persistence"] }, // → 인성 0 · 비겁 0 → mismatch
      { questionId: "workStyle", values: ["flexible"] }, // 매핑 없음 → unlinked
    ],
    AS_OF,
    rules,
  )
  const facts = buildFactSheet({ chart, rules, personal, asOf: AS_OF })

  it("전제: 손셈과 엔진 집계가 같다", () => {
    expect(surfaceGroupCounts(rules)).toEqual({ bigyeop: 0, siksang: 2, jaeseong: 2, gwansal: 3, inseong: 0 })
    expect(facts.chart.gaeunBasis!.groupCounts).toEqual({ bigyeop: 0, siksang: 2, jaeseong: 2, gwansal: 3, inseong: 0 })
  })
  it("사용자 사실 3분류: match / mismatch / unlinked(link 없음) — 사실 값은 그대로", () => {
    const links = facts.personal.userFacts.map((f) => [f.topic, f.link])
    expect(links).toContainEqual(["occupationStatus", { kind: "match", group: "jaeseong" }])
    const ss = facts.personal.userFacts.filter((f) => f.topic === "selfStrength").map((f) => f.link)
    expect(ss).toEqual(expect.arrayContaining([{ kind: "mismatch", group: "inseong" }, { kind: "mismatch", group: "bigyeop" }]))
    expect(links).toContainEqual(["workStyle", undefined]) // link 없음 = unlinked
    for (const f of facts.personal.userFacts) expect(Object.keys(f).sort()).toEqual(expect.arrayContaining(["topic", "value"]))
  })
  it("개운 pick이 있고 모두 허용 범주, 운 글자는 지금 대운 + 올해(2026 丙午) 세운", () => {
    expect(facts.chart.gaeun!.length).toBeGreaterThan(0)
    for (const p of facts.chart.gaeun!) expect(GAEUN_CATEGORY_IDS).toContain(p.id)
    expect(facts.luck.thisYear.ganzhi).toBe("丙午")
    const slots = facts.luck.glyphs!.map((g) => g.slot)
    expect(slots).toContain("seun")
    const cur = facts.luck.daeun.find((d) => d.current)
    if (cur) expect(facts.luck.glyphs!.find((g) => g.slot === "daeun")!.daeunIndex).toBe(cur.index)
    expect(typeof facts.luck.seunFlags!.shaking).toBe("boolean")
  })
  it("seunFlags.shaking: 午 ↔ 일지 丑·월지 卯 — 충·형 아님(丑午는 해·원진) → false", () => {
    expect(facts.luck.seunFlags).toEqual({ shaking: false })
  })
  it("세운 간지가 사실표 '올해'와 다르면 세운 슬롯·shaking을 넣지 않는다", () => {
    const other = analyzeRules(chart, undefined, { luck: chart.luck.daeun.map((d) => d.pillar), year: { stem: "乙", branch: "巳" } })
    const f = buildFactSheet({ chart, rules: other, personal, asOf: AS_OF })
    expect((f.luck.glyphs ?? []).some((g) => g.slot === "seun")).toBe(false)
    expect(f.luck.seunFlags).toBeUndefined()
  })
  it("특수격 관점 이름은 사실표 어디에도 없다(C5 표지는 boolean만)", () => {
    expect(JSON.stringify(facts.chart.gaeunBasis)).not.toMatch(/특수격|종격|화격|special"/)
    expect(facts.chart.gaeunBasis!.views.map((v) => v.method)).toEqual(["eokbu", "johuClimate", "tonggwan"])
  })
  it("결정성: 사실표 두 번 → 같다", () => {
    expect(buildFactSheet({ chart, rules, personal, asOf: AS_OF })).toEqual(facts)
  })
})
