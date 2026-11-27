// 품질검증 P3-06 — 명세 §7 손계산 사례 12건: 명세 값 · 엔진 · QA 오라클 3자 대조
// rules@0.4.0(D-022) 정정본 반영: 사례 7 tableSensitive false / IncludingMainOnly true, 사례 2·3·4·5·10·11 상신 presence, §3.3 통관 후보 표
import { describe, expect, it } from "vitest"
import { analyzeRules, computeChart, type Pillar, type RuleAnalysis } from "@/engine"
import * as O from "./strength-oracle"

const TEMPLATE = computeChart({ calendar: "solar", year: 1990, month: 5, day: 5, time: { hour: 10, minute: 0 }, timezone: "Asia/Seoul", gender: "M" })
const P = (s: string): Pillar => ({ stem: s[0] as Pillar["stem"], branch: s[1] as Pillar["branch"] })
export function natalOf(s: string): O.Natal {
  const [y, m, d, h] = s.split(" ")
  return { year: P(y), month: P(m), day: P(d), hour: h === "-" ? null : P(h) }
}
export function run(n: O.Natal, opts = {}): RuleAnalysis {
  const c = structuredClone(TEMPLATE)
  c.pillars = { ...n }
  c.hourKnown = n.hour !== null
  return analyzeRules(c, opts)
}
const EL: Record<string, string> = { 목: "wood", 화: "fire", 토: "earth", 금: "metal", 수: "water" }
const els = (s: string) => (s ? s.split("").map((c) => EL[c]) : [])
const view = (a: RuleAnalysis, m: string) => a.usefulGods.views.find((v) => v.method === m)!
const rank = (v: { candidates: { element: string; rank: number }[] }) => [...v.candidates].sort((x, y) => x.rank - y.rank).map((c) => c.element)
const prim = (a: RuleAnalysis) => a.structure.candidates.find((c) => c.role === "primary")!
const u = (x: number) => Math.round(x * 30 * 1e4) / 1e4 // 가중 → u

interface Case {
  id: number; natal: string; A: [number, string]; nb?: boolean; ext?: string | null; B: string; C?: number
  table?: [number, string][]; tableSensitive?: boolean; tableSensitiveIncl?: boolean; structSens?: [boolean, boolean]; season?: string; g?: [number, number, number, number, number]
  eokbu?: string; eokbuB?: string; tong: string; struct: [string, string]; alt?: string; other?: string; clim: [number, number, string]
  special?: string; clarity?: string[]; single?: string | null
  /** 명세 §7 본문 상신 손계산: "묶음:touchul 위치들:hiddenPositions 위치들:presence" (위치 = 기둥 이름, 연→월→일→시) */
  sangsin?: string[]
}
// g = [비겁, 인성, 식상, 재성, 관살] (u). eokbu "" = balanced. 오행은 한 글자(목화토금수)
const CASES: Case[] = [
  { id: 1, natal: "甲寅 丙寅 甲辰 乙亥", A: [0.619048, "신강"], nb: false, ext: null, B: "신강", C: 0.619048, table: [[0.666667, "신강"], [0.761905, "신강"]], tableSensitive: false, tableSensitiveIncl: false, season: "旺", g: [144.5, 20.5, 58, 62, 0], eokbu: "금화토", tong: "", struct: ["건록격", "medium"], alt: "식신격", clim: [-1.5, 0.5, "warm"] },
  { id: 2, natal: "甲辰 丙子 丙子 丁酉", A: [0.409524, "신약"], nb: false, B: "신약", C: 0.347368, g: [60, 39, 18, 30, 138], eokbu: "목화", tong: "목", struct: ["정관격", "medium"], clim: [-1.5, 2.0, "warm dry"], special: "", sangsin: ["jaeseong::hour:hiddenOnly", "inseong:year:year:stemAndHidden"] },
  { id: 3, natal: "丙寅 丁酉 庚辰 壬午", A: [0.51746, "중화"], nb: false, B: "신강", C: 0.51746, table: [[0.504762, "중화"], [0.52381, "중화"]], eokbu: "", eokbuB: "화수목", tong: "토", struct: ["양인격", "medium"], alt: "", clim: [1.0, -1.0, "cool moisten"], clarity: ["관살혼잡"], sangsin: ["gwansal:year,month:year,hour:stemAndHidden"] },
  { id: 4, natal: "丙寅 庚子 壬午 丁未", A: [0.47619, "중화"], nb: true, B: "신약", C: 0.45, g: [90, 30, 19, 107.5, 38.5], eokbu: "", eokbuB: "수금", tong: "목", struct: ["양인격", "medium"], clim: [0, 0, ""], single: null, sangsin: ["gwansal::year,day,hour:hiddenOnly"] },
  { id: 5, natal: "戊寅 辛酉 甲寅 乙亥", A: [0.390476, "신약"], B: "신강", C: 0.390476, g: [77, 16, 17.5, 54.5, 120], eokbu: "수목", eokbuB: "금화토", tong: "수", struct: ["정관격", "medium"], clim: [-1.5, 0.5, "warm"], sangsin: ["jaeseong:year:year,day,hour:stemAndHidden", "inseong::hour:hiddenOnly"] },
  { id: 6, natal: "丙寅 丁酉 庚辰 -", A: [0.603922, "신강"], B: "신강", eokbu: "화수목", tong: "토", struct: ["양인격", "medium"], clim: [0.5, -0.5, ""] },
  { id: 7, natal: "甲辰 己巳 庚戌 丙子", A: [0.509524, "중화"], nb: false, B: "신약", C: 0.509524, table: [[0.461905, "중화"], [0.428571, "신약"]], tableSensitive: false, tableSensitiveIncl: true, season: "死", tong: "", struct: ["칠살격", "medium"], clim: [0.5, -0.5, ""], clarity: ["재성파인"] },
  { id: 8, natal: "庚申 戊子 丙申 壬辰", A: [0.12381, "신약"], ext: "weak", B: "신약", eokbu: "목화", tong: "", struct: ["칠살격", "low"], other: "정관격", clim: [-1.0, 2.5, "warm dry"], special: "수금", structSens: [true, true] },
  { id: 9, natal: "戊午 己未 戊戌 丁巳", A: [0.906349, "신강"], ext: "strong", B: "신강", eokbu: "목금수", tong: "", struct: ["월겁격", "medium"], alt: "정인격", clim: [4.0, -3.5, "cool moisten"], special: "토화", single: "water" },
  { id: 10, natal: "庚辰 己丑 甲戌 戊辰", A: [0.257143, "신약"], B: "신약", eokbu: "목수", tong: "", struct: ["정재격", "medium"], clim: [-2, 1.5, "warm dry"], special: "토화", sangsin: ["siksang::day:hiddenOnly", "gwansal:year:month,day:stemAndHidden"] },
  { id: 11, natal: "庚申 甲申 甲寅 癸酉", A: [0.450794, "중화"], nb: true, B: "신약", eokbu: "", eokbuB: "수목", tong: "수", struct: ["칠살격", "medium"], clim: [0.5, 0.5, ""], sangsin: ["siksang::day:hiddenOnly", "inseong:hour:year,month:stemAndHidden"] },
  { id: 12, natal: "癸亥 癸亥 壬子 辛丑", A: [0.765079, "신강"], nb: false, B: "신강", eokbu: "토목화", tong: "", struct: ["건록격", "medium"], alt: "", clim: [-5.0, 4.5, "warm dry"], special: "", single: "fire" },
]

describe("P3-06 §7 손계산 사례 12건 — 명세 · 엔진 · 오라클", () => {
  const diffs: string[] = []
  for (const c of CASES) it(`사례 ${c.id} ${c.natal}`, () => {
    const n = natalOf(c.natal)
    const a = run(n)
    const A = a.strength.models.find((m) => m.model === "weighted")!
    const B = a.strength.models.find((m) => m.model === "threeFactor")!
    const C = a.strength.models.find((m) => m.model === "rooted")!
    const oa = O.modelA(n, "kr-monthly-30"), oc = O.modelA(n, "kr-monthly-30", true), ob = O.modelB(n, "dayBranchMainQi", "kr-monthly-30")
    const og = O.groupTotals(n, "kr-monthly-30")
    const chk = (label: string, spec: unknown, eng: unknown, ora: unknown) => {
      const s = JSON.stringify(spec), e = JSON.stringify(eng), q = JSON.stringify(ora)
      if (s !== e || s !== q) diffs.push(`사례${c.id} ${label}: 명세 ${s} · 엔진 ${e} · 오라클 ${q}`)
    }
    chk("A r·판정", c.A, [A.ratio, A.verdict], [oa.ratio, oa.verdict])
    if (c.nb !== undefined) chk("A nearBoundary", c.nb, A.nearBoundary, oa.nearBoundary)
    if (c.ext !== undefined) chk("A extreme", c.ext, A.extreme, oa.extreme)
    chk("B 판정", c.B, B.verdict, ob.verdict)
    if (c.C !== undefined) chk("C r", c.C, C.ratio, oc.ratio)
    if (c.table) chk("표 민감도", c.table, a.strength.tableSensitivity.map((t) => [t.ratio, t.verdict]),
      (["cn-lunarjs", "main-only"] as const).map((t) => { const x = O.modelA(n, t); return [x.ratio, x.verdict] }))
    const os = O.strengthTableSensitivity(n, "kr-monthly-30")
    if (c.tableSensitive !== undefined) chk("tableSensitive(선택·kr·cn)", c.tableSensitive, a.strength.tableSensitive, os.tableSensitive)
    if (c.tableSensitiveIncl !== undefined) chk("tableSensitiveIncludingMainOnly", c.tableSensitiveIncl, a.strength.tableSensitiveIncludingMainOnly, os.tableSensitiveIncludingMainOnly)
    if (c.structSens) {
      const ost = O.structureTableSensitivity(n, { table: "kr-monthly-30", touchul: "transparentFirst", match: "sameStem", rokgeopAlt: true })
      chk("structure.tableSensitive·IncludingMainOnly", c.structSens, [a.structure.tableSensitive, a.structure.tableSensitiveIncludingMainOnly], [ost.tableSensitive, ost.tableSensitiveIncludingMainOnly])
    }
    if (c.sangsin) {
      const pl = (ps: { pillar: string }[]) => ps.map((p) => p.pillar).join(",")
      const sig = (r: { group: string; touchul: { pillar: string }[]; hiddenPositions: { pillar: string }[]; presence: string }) => `${r.group}:${pl(r.touchul)}:${pl(r.hiddenPositions)}:${r.presence}`
      chk("상신 presence", c.sangsin, (prim(a).sangsin ?? []).map(sig), O.structureRefs(n, "kr-monthly-30", c.struct[0])!.sangsin.map(sig))
    }
    if (c.season) chk("seasonState", c.season, a.strength.seasonState, O.seasonState(n))
    if (c.g) {
      const G = a.strength.groupTotals
      chk("groupTotals(u)", c.g, [u(G.bigyeop), u(G.inseong), u(G.siksang), u(G.jaeseong), u(G.gwansal)], [u(og.bigyeop), u(og.inseong), u(og.siksang), u(og.jaeseong), u(og.gwansal)])
    }
    if (c.eokbu !== undefined) {
      const oe = O.eokbu(oa.verdict, oa.ratio, og)
      chk("억부(A)", els(c.eokbu), rank(view(a, "eokbu")), oe.groups.map((g) => O.groupEl(n.day.stem, g)))
    }
    if (c.eokbuB !== undefined) {
      const bm = view(a, "eokbu").byModel!.find((m) => m.model === "threeFactor")!
      chk("억부(B)", els(c.eokbuB), rank(bm), O.eokbu(ob.verdict, null, og).groups.map((g) => O.groupEl(n.day.stem, g)))
    }
    chk("통관", els(c.tong), rank(view(a, "tonggwan")), O.tonggwan(n, "kr-monthly-30"))
    const op = O.primaryStructure(n, { table: "kr-monthly-30", touchul: "transparentFirst", match: "sameStem", rokgeopAlt: true })
    chk("격국 주 후보", c.struct, [prim(a).name, prim(a).confidence], [op.name, c.struct[1]])
    if (c.alt !== undefined) chk("G1-alt", c.alt ? [c.alt] : [], a.structure.candidates.filter((x) => x.role === "rokgeopAlt").map((x) => x.name), O.rokgeopAlts(n, { table: "kr-monthly-30", touchul: "transparentFirst", match: "sameStem", rokgeopAlt: true }))
    if (c.other !== undefined) chk("다른 투출 변형", c.other, a.structure.candidates.find((x) => x.role === "otherVariant")?.name, O.primaryStructure(n, { table: "kr-monthly-30", touchul: "mainQiOnly", match: "sameStem", rokgeopAlt: true }).name)
    const ocl = O.climate(n)
    chk("조후 T·M·needs", [c.clim[0], c.clim[1], c.clim[2]], [a.climate.T, a.climate.M, a.climate.needs.join(" ")], [ocl.T, ocl.M, ocl.needs.join(" ")])
    if (c.special !== undefined) chk("특수격 view", els(c.special), rank(view(a, "special")), els(c.special))
    if (c.clarity !== undefined) chk("clarityFlags", c.clarity, a.qiFlow.clarityFlags.map((f) => f.flag).sort(), O.clarityFlags(n))
    if (c.single !== undefined) chk("(가) 하나만", c.single, a.usefulGods.singlePickProposal.element, c.single)
    // §7.1-3 근거 합계 검산
    const sumS = A.basis.filter((b) => b.side === "support").reduce((s, b) => s + b.points, 0), sumT = A.basis.reduce((s, b) => s + b.points, 0)
    expect(Math.abs(sumS - oa.S), `사례${c.id} Σsupport`).toBeLessThan(2e-5)
    expect(Math.abs(sumT - oa.T), `사례${c.id} Σtotal`).toBeLessThan(2e-5)
  })
  it("불일치 목록(명세·엔진·오라클)", () => {
    console.log(`[사례 대조] 불일치 ${diffs.length}건\n  ${diffs.join("\n  ")}`)
    // 2026-11-28 명세 정정(D1: 사례 7 재성파인)으로 알려진 불일치 없음 — 예외 목록을 두지 않는다
    expect(diffs).toEqual([])
  })
})

describe("사례 개별 확인", () => {
  it("사례 6 시진 민감도 12칸 = 명세 표", () => {
    const a = run(natalOf("丙寅 丁酉 庚辰 -"))
    const hs = a.strength.hourSensitivity!
    const spec = [0.488889, 0.555556, 0.606349, 0.584127, 0.64127, 0.628571, 0.51746, 0.546032, 0.561905, 0.584127, 0.574603, 0.511111]
    expect(hs.byHour.map((h) => h.ratio)).toEqual(spec)
    expect(hs.byHour.map((h) => `${h.hour.stem}${h.hour.branch}`).join("")).toBe("丙子丁丑戊寅己卯庚辰辛巳壬午癸未甲申乙酉丙戌丁亥")
    expect(hs.verdicts).toEqual(["신강", "중화"])
    expect(hs.hourSensitive).toBe(true)
    expect(a.climate.pillarsUsed).toBe(3)
    expect(a.strength.models[1].factors!.deukse.of).toBe(3)
  })
  it("사례 7 affectedBy 필수 항목과 critical", () => {
    const a = run(natalOf("甲辰 己巳 庚戌 丙子"))
    const f = (type: string, chars: string) => a.strength.affectedBy.find((x) => x.type === type && a.interactions.some((i) => i.ruleId === x.ruleId && i.chars.join("") === chars))
    expect(f("stemCombine", "甲己")?.critical).toBe(true)
    expect(f("stemClash", "甲庚")?.critical).toBe(true)
    expect(f("clash", "辰戌")?.critical).toBe(true)
    expect(f("halfCombine", "辰子")?.critical).toBe(false)
    expect(a.strength.adjustmentsApplied).toEqual([])
  })
  it("§3.3 통관 기준 후보 표 — 현행 2·3·4·5·6·11 / 후보① 0.30·0.5 → 4·5 / 후보② 0.28·0.6 → 2·4·5 (엔진 = 오라클 = 명세)", () => {
    const combos: [number, number, number[]][] = [[0.25, 0.5, [2, 3, 4, 5, 6, 11]], [0.3, 0.5, [4, 5]], [0.28, 0.6, [2, 4, 5]]]
    for (const [sh, ra, want] of combos) {
      const eng = CASES.filter((c) => run(natalOf(c.natal), { tonggwanMinShare: sh, tonggwanMinRatio: ra }).usefulGods.views.find((v) => v.method === "tonggwan")!.status === "ok").map((c) => c.id)
      const ora = CASES.filter((c) => O.tonggwan(natalOf(c.natal), "kr-monthly-30", sh, ra).length > 0).map((c) => c.id)
      expect([sh, ra, eng]).toEqual([sh, ra, want])
      expect([sh, ra, ora]).toEqual([sh, ra, want])
    }
    // §7.1-6-6 기본값 불변: 옵션 미지정 = 0.25/0.5 지정
    for (const c of CASES) expect(JSON.stringify(run(natalOf(c.natal)).usefulGods)).toBe(JSON.stringify(run(natalOf(c.natal), { tonggwanMinShare: 0.25, tonggwanMinRatio: 0.5, earthRokgeop: "mainQiGate" }).usefulGods))
  })
  it("사례 8 종살격 후보·격 변형 갈림·표 민감", () => {
    const a = run(natalOf("庚申 戊子 丙申 壬辰"))
    const sp = a.structure.candidates.find((x) => x.kind === "special")!
    expect(sp.name).toMatch(/종살/)
    expect(sp.confidence).toBe("low")
    expect(sp.reversesUsefulGod).toBe(true)
    expect(prim(a).variantAgreement).toBe("differs")
    expect(a.structure.tableSensitive).toBe(true) // kr(칠살격) ↔ cn(정관격) — 새 정의에서도 true(명세 E3)
    expect(a.structure.tableSensitiveIncludingMainOnly).toBe(true)
    expect(a.structure.byTable.map((x) => x.name)).toEqual(["칠살격", "정관격", "정관격"])
    expect(a.interactions.some((i) => i.type === "threeCombine" && i.complete)).toBe(true)
    expect(a.usefulGods.singlePickProposal.element).not.toBe("water")
  })
  it("§7.1-6-5 종강: 합성 원국 甲子 丙子 乙亥 壬子 — 인성(수) > 비겁(목) · r ≥ 0.8 · 관살 0 → view [수, 목], 금 없음", () => {
    // 손계산(kr-monthly-30, u): 천간 甲30(비겁) 丙30(식상) 乙30(일간) 壬30(인성) · 子(연)壬10+癸20=30 · 子(월)×3=90 · 亥(일)×1.5 = 戊10.5·甲10.5·壬24 · 子(시)30
    //   S = 30+30+30 + 30+90 + 甲10.5+壬24 + 30 = 274.5, T = 315 → r = 0.871429 (E1 ✓), 관살(금) 0u (E2 ✓)
    //   비겁(일간 제외) = 甲30 + 亥甲10.5 = 40.5 < 인성 = 壬30 + 子30 + 子90 + 亥壬24 + 子30 = 204 → 종강. 월지 子 정기 癸 ≠ 목이라 일행득기 아님, 乙의 천간합 상대(庚) 없음 → 특수격은 종강 하나
    const n = natalOf("甲子 丙子 乙亥 壬子")
    const a = run(n)
    const A = a.strength.models[0]
    expect(A.ratio).toBe(0.871429)
    expect(O.jongwangOf(n, "kr-monthly-30")?.kind).toBe("종강")
    const sp = a.structure.candidates.filter((x) => x.kind === "special")
    expect(sp.length).toBe(1)
    expect(sp.map((x) => x.name).some((x) => /종강/.test(x))).toBe(true)
    const v = view(a, "special")
    expect(rank(v)).toEqual(["water", "wood"])
    expect(v.candidates.some((c) => c.element === "metal")).toBe(false)
  })
  it("사례 9 종왕 후보, 가색 아님", () => {
    const a = run(natalOf("戊午 己未 戊戌 丁巳"))
    const names = a.structure.candidates.filter((x) => x.kind === "special").map((x) => x.name)
    expect(names.some((x) => /종왕/.test(x))).toBe(true)
    expect(names.some((x) => /가색/.test(x))).toBe(false)
  })
  it("사례 10 화토격 후보 + obstruction 甲庚", () => {
    const a = run(natalOf("庚辰 己丑 甲戌 戊辰"))
    const sp = a.structure.candidates.find((x) => x.kind === "special")!
    expect(sp.name).toMatch(/화토/)
    expect(sp.obstructions?.length).toBeGreaterThan(0)
  })
  it("사례 11 agreement — 명세 문구 '수 = 통관·억부(B)' 대 엔진", () => {
    const a = run(natalOf("庚申 甲申 甲寅 癸酉"))
    console.log("[사례11 agreement]", JSON.stringify(a.usefulGods.agreement))
    const water = a.usefulGods.agreement.find((x) => x.element === "water")!
    expect(water.methods).toContain("tonggwan")
    expect(water.methods).not.toContain("eokbu") // 억부 대표(A)는 balanced — byModel(B)는 agreement 대상 아님(§6 타입: method 목록)
  })
  it("사례 12 윤하 후보 아님", () => {
    const a = run(natalOf("癸亥 癸亥 壬子 辛丑"))
    expect(a.structure.candidates.filter((x) => x.kind === "special")).toEqual([])
  })
})
