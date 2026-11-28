// 무료 5장 조립기(compose.ts) — content/unmyeong/compose.json 규칙대로 사람마다 다른 글이 나오는지.
// (a) 같은 원형 × 서로 다른 사주 3개 → 글이 다름  (b) 무작위 2,000 원국 전수 계수(길이 분포·남은 토큰·두 장 중복 문장)
// (c) 장마다 근거(일주 간지·일지 십성·오행 개수·올해 십성·일지 충합)가 실제 원국(엔진 값)과 일치  (d) 검증기 verifyReading block 0
// 재료 JSON은 작가 소유 — 여기서는 읽기만 한다.
import { beforeAll, describe, expect, it, vi } from "vitest"
import { analyzeRules, yearPillarOf, type Element, type RuleAnalysis } from "@/engine"
import { verifyReading } from "@/engine/verify"
import { buildSajuInputFromRequest } from "@/lib/saju-input"
import { buildUnmyeongFree, chartFromSajuInput, validateUnmyeongFreeRequest } from "@/lib/unmyeong/free"
import { resolveArchetype } from "@/lib/unmyeong/archetype-link"
import { ARCHETYPE_IDS, FREE_CHAPTER_KEYS } from "@/lib/unmyeong/assets"
import { loadFreeCopy } from "@/lib/unmyeong/free-copy"
import {
  beingShortRequired, composeFactsFrom, composeFreeChapters, endingOf, loadComposeMaterials, normalizeMaterials, pickElement,
  sameEndingRun, splitSentences, type ComposeFacts, type ComposeResult,
} from "@/lib/unmyeong/compose"
import type { UnmyeongArchetypeView, UnmyeongFreeResponse } from "@/lib/unmyeong/free-types"
import composeJson from "../../../../content/unmyeong/compose.json"
import dayPillarJson from "../../../../content/unmyeong/day-pillar.json"
import dayMasterJson from "../../../../content/unmyeong/day-master.json"
import elementsJson from "../../../../content/unmyeong/elements.json"
import thisYearJson from "../../../../content/unmyeong/this-year.json"
import freeCopyJson from "../../../../content/unmyeong/free-copy.json"

const EL: readonly Element[] = ["wood", "fire", "earth", "metal", "water"]
const FORBIDDEN = /사망|죽음|죽는|수명|단명|요절|전생|암에|중병|병에 걸|사고가 난|이혼|파산|부적|개명|삼재|흉하|흉한|액운|반드시|무조건|100%|적중|과학적|고객님|습니다|입니다/

// ─────────────────────────────────────────── 무작위 원국(결정론 — 같은 씨앗이면 같은 2,000명)

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Case {
  i: number
  now: Date
  res: UnmyeongFreeResponse
  rules: RuleAnalysis
  facts: ComposeFacts
  composed: ComposeResult
}

const NOWS = [new Date("2026-06-01T00:00:00Z"), new Date("2027-06-01T00:00:00Z")]

function makeCase(i: number, r: () => number): Case {
  const hour = r() < 0.3 ? null : Math.floor(r() * 24)
  const body = {
    birthYear: 1940 + Math.floor(r() * 71), birthMonth: 1 + Math.floor(r() * 12), birthDay: 1 + Math.floor(r() * 28),
    birthHour: hour, ...(hour !== null ? { birthMinute: Math.floor(r() * 60), timeMode: "exact" } : {}),
    gender: r() < 0.5 ? "M" : "F", calType: "SOLAR",
  }
  const v = validateUnmyeongFreeRequest(body)
  if (!v.ok) throw new Error(v.error)
  const now = NOWS[i % 2]
  const res = buildUnmyeongFree(v.value, { now })
  // 같은 길(응답 본체와 같은 엔진 호출)로 조립 사실을 다시 만들어 조각(parts)까지 본다
  const s = buildSajuInputFromRequest(v.value, undefined, { now })
  const chart = chartFromSajuInput(s, v.value.gender)
  const rules = analyzeRules(chart, undefined, { luck: chart.luck.daeun.map((d) => d.pillar), year: yearPillarOf(s.this_year) })
  const archetype = resolveArchetype(chart, rules)
  const facts = composeFactsFrom(rules, { hourUnknown: res.hourUnknown, year: res.thisYear.year, archetype })
  const composed = composeFreeChapters(facts)
  if (!composed) throw new Error("조립 실패")
  return { i, now, res, rules, facts, composed }
}

const N = 2000
let cases: Case[] = []
beforeAll(() => {
  const r = rng(20261128)
  cases = Array.from({ length: N }, (_, i) => makeCase(i, r))
}, 300_000)

const total = (c: { text: string }[]) => c.reduce((n, x) => n + x.text.length, 0)
const allSentences = (text: string) => splitSentences(text).map((x) => x.trim()).filter(Boolean)

// ─────────────────────────────────────────── 재료·규칙 단위

describe("재료와 규칙(compose.json) 정리", () => {
  it("번들 재료가 정리된다: 일주 60·일간 10·오행 5·해 2(2026 丙午·2027 丁未)·원형 문장 12×3·충돌 9쌍", () => {
    const m = loadComposeMaterials()
    expect(m).not.toBeNull()
    expect(m!.dayPillars.size).toBe(60)
    expect(m!.dayMasters.size).toBe(10)
    expect(m!.elements.items.size).toBe(5)
    expect(m!.years.map((y) => [y.year, y.ganzhi, y.byStem.size])).toEqual([[2026, "丙午", 10], [2027, "丁未", 10]])
    for (const id of ARCHETYPE_IDS) {
      expect(m!.rules.being[id], id).toMatch(/^\{letters\}를 다 펴 보면 /)
      expect(m!.rules.beingShort[id], id).toBeTruthy()
      expect(m!.rules.counsel[id], id).toBeTruthy()
    }
    expect(m!.rules.counselConflicts).toHaveLength(9)
    expect(m!.rules.titles.map((t) => t.key)).toEqual([...FREE_CHAPTER_KEYS])
    expect(m!.rules.budget).toEqual({ min: 400, max: 600, hardMax: 650 })
    expect(m!.rules.fixed.dayBranchJoinFrom).toBe("{year}년에 드는 ")
    expect(m!.rules.fixed.dayBranchJoinTo).toBe("그해의 ")
  })

  it("문장 나누기 약속(작가): detail 2 · body 3 · blindSpot 1~2 · elements text 3 · this-year line 2 · 일지 덧줄 2", () => {
    for (const it of dayPillarJson.items) expect(splitSentences(it.detail), it.pillar).toHaveLength(2)
    for (const it of dayMasterJson.items) {
      expect(splitSentences(it.body), it.stem).toHaveLength(3)
      expect([1, 2]).toContain(splitSentences(it.blindSpot).length)
    }
    for (const it of elementsJson.items) for (const k of ["excess", "lack"] as const) expect(splitSentences(it[k].text), `${it.element}.${k}`).toHaveLength(3)
    for (const y of thisYearJson.years) {
      for (const b of y.byDayMaster) expect(splitSentences(b.line), `${y.year}${b.stem}`).toHaveLength(2)
      for (const d of y.dayBranch) {
        expect(splitSentences(d.line)).toHaveLength(2)
        expect(d.line.startsWith(`${y.year}년에 드는 `)).toBe(true)
      }
    }
    expect(splitSentences("가. 나. 다")).toEqual(["가.", "나.", "다"])
    expect(splitSentences("(자오충 子午沖). 그해")).toEqual(["(자오충 子午沖).", "그해"])
  })

  it("형식이 깨진 재료는 null(조립 안 함)", () => {
    const ok = { compose: composeJson, dayPillar: dayPillarJson, dayMaster: dayMasterJson, elements: elementsJson, thisYear: thisYearJson }
    expect(normalizeMaterials(ok)).not.toBeNull()
    expect(normalizeMaterials({ ...ok, compose: { ...composeJson, chapters: composeJson.chapters.slice(0, 4) } })).toBeNull()
    expect(normalizeMaterials({ ...ok, compose: { ...composeJson, budget: { min: 700, max: 600, hardMax: 650 } } })).toBeNull()
    expect(normalizeMaterials({ ...ok, elements: { ...elementsJson, thresholds: null } })).toBeNull()
    expect(normalizeMaterials({ ...ok, dayPillar: null })).toBeNull()
  })

  it("오행 고르기: 넘침(4개↑, 시각 모름 3개↑) 중 큰 것 → 동률은 목화토금수 앞 → 없으면 0개 첫째 → 둘 다 없으면 null", () => {
    const th = { lack: 0, excessFull: 4, excessHourUnknown: 3 }
    const c = (w: number, f: number, e: number, m: number, x: number) => ({ wood: w, fire: f, earth: e, metal: m, water: x })
    expect(pickElement(c(4, 0, 2, 1, 1), false, th)).toEqual({ element: "wood", kind: "excess" })
    expect(pickElement(c(4, 0, 0, 0, 4), false, th)).toEqual({ element: "wood", kind: "excess" })
    expect(pickElement(c(4, 0, 0, 0, 5), false, th)).toEqual({ element: "water", kind: "excess" })
    expect(pickElement(c(3, 0, 2, 1, 2), false, th)).toEqual({ element: "fire", kind: "lack" })
    expect(pickElement(c(3, 0, 2, 1, 0), true, th)).toEqual({ element: "wood", kind: "excess" })
    expect(pickElement(c(2, 2, 2, 1, 1), false, th)).toBeNull()
  })

  it("충돌 원칙 2 표(conflicts.being)가 코드에 다 들어 있다", () => {
    const shortRows = composeJson.conflicts.being.filter((r) => r.do === "beingShort")
    const ids = shortRows.flatMap((r) => r.archetype.split("|"))
    expect(ids.sort()).toEqual(["baekho", "black-fox", "bonghwang", "eternal-forest", "golden-sun", "hyeonmu", "sage", "white-deer"].sort())
    expect(beingShortRequired("eternal-forest", { element: "fire", kind: "excess" }, "식상")).toBe(true)
    expect(beingShortRequired("eternal-forest", { element: "fire", kind: "lack" }, "식상")).toBe(false)
    expect(beingShortRequired("hyeonmu", { element: "water", kind: "lack" }, "인성")).toBe(true)
    expect(beingShortRequired("hyeonmu", { element: "fire", kind: "lack" }, "재성")).toBe(false)
    expect(beingShortRequired("golden-sun", { element: "fire", kind: "lack" }, "관성")).toBe(true)
    expect(beingShortRequired("sage", { element: "water", kind: "lack" }, "인성")).toBe(true)
    expect(beingShortRequired("sage", { element: "water", kind: "lack" }, "식상")).toBe(false)
    expect(beingShortRequired("black-fox", { element: "fire", kind: "lack" }, "식상")).toBe(true)
    expect(beingShortRequired("white-deer", { element: "fire", kind: "lack" }, "재성")).toBe(true)
    expect(beingShortRequired("bonghwang", { element: "metal", kind: "lack" }, "관성")).toBe(true)
    expect(beingShortRequired("baekho", { element: "metal", kind: "lack" }, "관성")).toBe(true)
    expect(beingShortRequired("galaxy", { element: "metal", kind: "lack" }, "관성")).toBe(false)
    expect(beingShortRequired("sage", null, null)).toBe(false)
  })

  it("같은 어미 세 번(원칙 6) 판정", () => {
    expect(endingOf("말하기 전에 숨을 세 번 고르거라.")).toBe("거라")
    expect(sameEndingRun(["가거라.", "보거라.", "하거라."])).toBe(0)
    expect(sameEndingRun(["가거라.", "해다.", "하거라.", "보거라."])).toBe(-1)
  })
})

// ─────────────────────────────────────────── 손으로 만든 사실(엔진 값과 같은 모양)로 갈래 확인

const view = (id: string, over: Partial<UnmyeongArchetypeView> = {}): UnmyeongArchetypeView => ({
  id, name: id, category: "nature", order: 1, secondary: null, secondaryName: null, variantTags: [], matched: [],
  stability: { nearBoundary: false, tableSensitive: false, hourSensitive: null }, hourUnknownNote: false,
  disclaimer: "creative-symbol", disclaimerText: "창작 상징", version: "archetype@0.1.0", ...over,
})
const baseFacts = (over: Partial<ComposeFacts> = {}): ComposeFacts => ({
  dayStem: "丙", dayBranch: "子", dayMasterElement: "fire",
  counts: { wood: 2, fire: 2, earth: 2, metal: 1, water: 1 }, weighted: { wood: 1, fire: 1, earth: 1, metal: 1, water: 1 },
  hourUnknown: false, year: 2026, yearGanzhi: "丙午", dayBranchRelations: [{ type: "clash", chars: ["子", "午"] }],
  archetype: view("bonghwang"), ...over,
})
const compose = (f: ComposeFacts, o?: Parameters<typeof composeFreeChapters>[1]) => {
  const r = composeFreeChapters(f, o)
  if (!r) throw new Error("null")
  return r
}
const ids = (r: ComposeResult, no: number) => r.parts[no - 1].parts.map((p) => p.id)

describe("조립 갈래(손으로 만든 사실)", () => {
  it("원형이 없으면 null(2장을 만들 수 없음 → pending.chapters)", () => {
    expect(composeFreeChapters(baseFacts({ archetype: null }))).toBeNull()
  })

  it("1장: '○○(干支)일에 났구나.' + 일주 한 줄 + 원형 한 문장, 시각 모름이면 끝에 시각 안내(D-030)", () => {
    const r = compose(baseFacts())
    expect(r.chapters[0].text).toContain("병자(丙子)일에 났구나.")
    expect(r.chapters[0].text).toContain(dayPillarJson.items.find((x) => x.pillar === "丙子")!.oneLiner)
    expect(r.chapters[0].text).toContain("여덟 글자를 다 펴 보면")
    const hu = compose(baseFacts({ hourUnknown: true }))
    expect(hu.chapters[0].text.endsWith(freeCopyJson.hourNote.text)).toBe(true)
    // 길이 줄이기(1장 짧은 꼴)가 끼지 않게 상한을 넉넉히 해서 {letters} 치환을 본다
    const m = loadComposeMaterials()!
    const loose = { ...m, rules: { ...m.rules, budget: { min: 100, max: 2000, hardMax: 2100 } } }
    expect(compose(baseFacts({ hourUnknown: true }), { materials: loose }).chapters[0].text).toContain("여섯 글자를 다 펴 보면")
    expect(r.chapters[0].text).not.toContain(freeCopyJson.hourNote.text)
  })

  it("2장은 원형 본문 그대로", () => {
    const r = compose(baseFacts())
    expect(r.chapters[1].text).toBe(freeCopyJson.chapters[1].byArchetype.bonghwang)
  })

  it("4장: 넘침이면 개수 문장, 없음이고 땅 글자 속에 있으면 숨은 기운 안내, 둘 다 없으면 일주 둘째 문장", () => {
    const ex = compose(baseFacts({ counts: { wood: 4, fire: 2, earth: 1, metal: 1, water: 0 } }))
    expect(ex.elementPick).toEqual({ element: "wood", kind: "excess" })
    expect(ex.chapters[3].text.startsWith("여덟 글자 중 나무(목)가 넷이다.")).toBe(true)
    const lackHidden = compose(baseFacts({ counts: { wood: 3, fire: 2, earth: 2, metal: 1, water: 0 }, weighted: { wood: 3, fire: 2, earth: 2, metal: 1, water: 0.2 } }))
    expect(lackHidden.chapters[3].text.startsWith("드러난 여덟 글자에는 물(수)이 없다. 땅 글자 속에는 조금 숨어 있다.")).toBe(true)
    const lackNone = compose(baseFacts({ counts: { wood: 3, fire: 2, earth: 2, metal: 1, water: 0 }, weighted: { wood: 3, fire: 2, earth: 2, metal: 1, water: 0 } }))
    expect(lackNone.chapters[3].text).not.toContain("땅 글자 속에는")
    const none = compose(baseFacts())
    expect(none.elementPick).toBeNull()
    expect(ids(none, 4)).toEqual(expect.arrayContaining(["pillarS2"]))
  })

  it("5장: 일지 충이 엔진 interactions에 있을 때만 덧줄('그해의 …'), 그때 올해 줄 할 일(S2)은 뺀다(원칙 4)", () => {
    const withRel = compose(baseFacts())
    expect(ids(withRel, 5)).toContain("dayBranch")
    expect(ids(withRel, 5)).not.toContain("yearS2")
    expect(withRel.chapters[4].text).toContain("그해의 한여름 불이 네가 앉은 자리의 한겨울 찬물과")
    expect(withRel.chapters[4].text).not.toContain("2026년에 드는")
    const noRel = compose(baseFacts({ dayBranchRelations: [] }))
    expect(ids(noRel, 5)).not.toContain("dayBranch")
    expect(ids(noRel, 5)).toContain("yearS2")
    // 관계 종류가 다르면(충인데 합으로 들어옴) 덧줄 없음
    expect(ids(compose(baseFacts({ dayBranchRelations: [{ type: "sixCombine", chars: ["子", "午"] }] })), 5)).not.toContain("dayBranch")
  })

  it("5장 충돌 원칙 3: conflicts.counsel 9쌍은 원형 문장을 뺀다, 나머지는 둔다", () => {
    for (const c of composeJson.conflicts.counsel) {
      const ganzhi = c.year === 2026 ? "丙午" : "丁未"
      const dm = dayMasterJson.items.find((x) => x.stem === c.stem)!
      // 양간은 寅, 음간은 卯(있는 일주만)
      const f = baseFacts({ dayStem: c.stem, dayBranch: "甲丙戊庚壬".includes(c.stem) ? "寅" : "卯", dayMasterElement: dm.element as Element, year: c.year, yearGanzhi: ganzhi, dayBranchRelations: [], archetype: view(c.archetype) })
      const r = compose(f)
      expect(r.yearLine).toBe(true)
      expect(r.chapters[4].text, `${c.year}${c.stem}${c.archetype}`).not.toContain(composeJson.archetypeLines.counsel[c.archetype as "sage"])
      expect(r.steps).toContain("conflict3:counselDropped")
    }
    const free = compose(baseFacts({ dayBranchRelations: [] }))
    expect(free.chapters[4].text).toContain(composeJson.archetypeLines.counsel.bonghwang)
  })

  it("그해 항목이 없으면(2028) 원형 5장 원문 — 달의 여신 {bridge}는 다리 기운으로, 없으면 대체 문장으로", () => {
    const f = baseFacts({ year: 2028, yearGanzhi: "戊申", archetype: view("moon-goddess", { bridge: "수" }) })
    const r = compose(f)
    expect(r.yearLine).toBe(false)
    expect(r.chapters[4].text).toContain("두 힘을 잇는 다리는 물의 기운이니")
    const nb = compose({ ...f, archetype: view("moon-goddess") })
    expect(nb.chapters[4].text).toContain(freeCopyJson.bridgeFallback.with)
    for (const c of nb.chapters) expect(c.text).not.toMatch(/[{}]/)
  })

  it("길이 줄이기 순서: 어디 보자 → 5장 원형 → 1장 짧은 꼴 → 4장 맹점 첫 문장", () => {
    const m = loadComposeMaterials()!
    const tight = { ...m, rules: { ...m.rules, budget: { min: 100, max: 300, hardMax: 2000 } } }
    const r = compose(baseFacts({ dayStem: "甲", dayBranch: "寅", dayMasterElement: "wood", dayBranchRelations: [] }), { materials: tight })
    expect(r.steps.filter((x) => x.startsWith("trim"))).toEqual(["trim1:opening", "trim2:counselArchetype", "trim3:beingShort", "trim4:blindSpotShort"])
    expect(r.chapters[0].text.startsWith("어디 보자.")).toBe(false)
    expect(r.chapters[0].text).toContain("할미 책엔 너를 봉황으로 적었다.")
    expect(r.warnings.some((w) => w.code === "overBudget")).toBe(true)
    // hardMax도 넘으면 4장 오행 둘째 문장(마지막 수단)
    const harder = { ...m, rules: { ...m.rules, budget: { min: 100, max: 300, hardMax: 310 } } }
    const r2 = compose(baseFacts({ counts: { wood: 4, fire: 2, earth: 1, metal: 1, water: 0 } }), { materials: harder })
    expect(r2.steps).toContain("trim5:elementS2")
    // 줄이지 않는 것: 일주 첫 줄·oneLiner, 2장, 3장, 4장 첫 문장·맹점 첫 문장, 5장 날씨·올해 첫 문장
    expect(r.chapters[0].text).toContain("갑인(甲寅)일에 났구나.")
    expect(r.chapters[4].text.startsWith(composeJson.fixed.weatherLead)).toBe(true)
  })

  it("보충 순서: 일간 body 첫 문장 → 십성 묶음 한 줄 → 일주 둘째 문장(넘치면 되돌림)", () => {
    const m = loadComposeMaterials()!
    const loose = { ...m, rules: { ...m.rules, budget: { min: 2000, max: 3000, hardMax: 3100 } } }
    const r = compose(baseFacts({ counts: { wood: 4, fire: 2, earth: 1, metal: 1, water: 0 } }), { materials: loose })
    expect(r.steps).toEqual(expect.arrayContaining(["fill1:bodyS1", "fill2:tenGodLine", "fill3:pillarS2"]))
    expect(r.chapters[2].text.startsWith("너 자신을 뜻하는 글자가")).toBe(true)
    // 병(丙, 불) 일간한테 나무 = 인성
    expect(r.chapters[3].text).toContain("병(丙)인 너한테 나무(목) 기운은 너를 받쳐 주는 힘, 배움과 돌봄(인성)이다.")
    const revert = { ...m, rules: { ...m.rules, budget: { min: 2000, max: 560, hardMax: 3100 } } }
    const r2 = compose(baseFacts({ counts: { wood: 4, fire: 2, earth: 1, metal: 1, water: 0 } }), { materials: revert })
    // min > 현재 길이 > ? : max보다 짧을 때만 보충이 돈다 — 보충 후 max를 넘으면 되돌린다
    for (const st of r2.steps.filter((x) => x.startsWith("fill"))) expect(st.endsWith(":reverted") || r2.length <= 560).toBe(true)
  })

  it("재료가 깨지면 원형 고정 문안으로 내린다(빈 화면 대신)", () => {
    const r = compose(baseFacts(), { materials: null })
    expect(r.steps).toEqual(["fallback:materials"])
    expect(r.chapters.map((c) => c.text)).toEqual(freeCopyJson.chapters.map((c) => c.byArchetype.bonghwang))
  })
})

// ─────────────────────────────────────────── (a) 같은 원형이라도 사주가 다르면 글이 다르다

describe("(a) 같은 원형 × 서로 다른 사주 3개 → 글이 다르다", () => {
  it("원형 12개 모두", () => {
    const byArch = new Map<string, Case[]>()
    for (const c of cases) {
      const id = c.res.archetype!.id
      const list = byArch.get(id) ?? []
      // 일주가 겹치지 않는 사람만 모은다
      if (list.length < 3 && !list.some((x) => x.res.dayPillar.hanja === c.res.dayPillar.hanja)) list.push(c)
      byArch.set(id, list)
    }
    // 2,000명 안에 3명이 안 되는 원형은 더 찾는다(같은 씨앗 이어서 — 결정론)
    const more = rng(777)
    for (let k = 0; k < 30000 && ARCHETYPE_IDS.some((id) => (byArch.get(id)?.length ?? 0) < 3); k++) {
      const c = makeCase(N + k, more)
      const list = byArch.get(c.res.archetype!.id) ?? []
      if (list.length < 3 && !list.some((x) => x.res.dayPillar.hanja === c.res.dayPillar.hanja)) list.push(c)
      byArch.set(c.res.archetype!.id, list)
    }
    const rows: string[] = []
    for (const id of ARCHETYPE_IDS) {
      const list = byArch.get(id) ?? []
      expect(list.length, `${id} 사례`).toBe(3)
      const texts = list.map((c) => c.res.chapters!.map((x) => x.text).join("\n"))
      expect(new Set(texts).size, id).toBe(3)
      // 1장(일주)·3장(일주 + 일간)은 셋 다 다르다. 2장(원형)은 셋 다 같다
      expect(new Set(list.map((c) => c.res.chapters![0].text)).size, `${id} 1장`).toBe(3)
      expect(new Set(list.map((c) => c.res.chapters![2].text)).size, `${id} 3장`).toBe(3)
      expect(new Set(list.map((c) => c.res.chapters![1].text)).size, `${id} 2장`).toBe(1)
      rows.push(`${id}: ${list.map((c) => `${c.res.dayPillar.hanja}/${c.res.thisYear.year}/${c.composed.elementPick ? c.composed.elementPick.element + "-" + c.composed.elementPick.kind : "-"}`).join(", ")}`)
    }
    process.stderr.write(`[compose] (a) 원형별 사례\n  ${rows.join("\n  ")}\n`)
  })

  it("원형·일주가 같아도 오행만 다르면 4장, 올해만 다르면 5장이 다르다", () => {
    const a = compose(baseFacts({ counts: { wood: 4, fire: 2, earth: 1, metal: 1, water: 0 } }))
    const b = compose(baseFacts({ counts: { wood: 1, fire: 2, earth: 4, metal: 1, water: 0 } }))
    const c = compose(baseFacts({ counts: { wood: 2, fire: 2, earth: 2, metal: 2, water: 0 }, weighted: { wood: 2, fire: 2, earth: 2, metal: 2, water: 0 } }))
    expect(new Set([a, b, c].map((r) => r.chapters[3].text)).size).toBe(3)
    const y26 = compose(baseFacts({ dayBranchRelations: [] }))
    const y27 = compose(baseFacts({ year: 2027, yearGanzhi: "丁未", dayBranchRelations: [] }))
    expect(y26.chapters[4].text).not.toBe(y27.chapters[4].text)
    expect(y26.chapters[0].text).toBe(y27.chapters[0].text)
  })
})

// ─────────────────────────────────────────── (b) 전수 계수

describe("(b) 무작위 2,000 원국 전수 계수", () => {
  it("길이 분포 보고 · 남은 {…} 토큰 0 · 같은 문장 두 장 중복 0 · 650자 초과 0 · 응답 = 조립 결과", () => {
    const lens = cases.map((c) => total(c.res.chapters!))
    const sorted = [...lens].sort((a, b) => a - b)
    const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
    const under = lens.filter((x) => x < 400).length
    const over = lens.filter((x) => x > 600).length
    const overHard = lens.filter((x) => x > 650).length
    const buckets: Record<string, number> = {}
    for (const x of lens) { const k = `${Math.floor(x / 25) * 25}`; buckets[k] = (buckets[k] ?? 0) + 1 }
    const stepCount: Record<string, number> = {}
    for (const c of cases) for (const st of c.composed.steps) stepCount[st.replace(/:\d+:/, ":n:")] = (stepCount[st.replace(/:\d+:/, ":n:")] ?? 0) + 1
    const warnCount: Record<string, number> = {}
    for (const c of cases) for (const w of c.composed.warnings) warnCount[w.code] = (warnCount[w.code] ?? 0) + 1
    const archCount: Record<string, number> = {}
    for (const c of cases) archCount[c.res.archetype!.id] = (archCount[c.res.archetype!.id] ?? 0) + 1
    const hourUnknown = cases.filter((c) => c.res.hourUnknown).length
    const dayPillars = new Set(cases.map((c) => c.res.dayPillar.hanja)).size
    const distinctTexts = new Set(cases.map((c) => c.res.chapters!.map((x) => x.text).join("\n"))).size
    process.stderr.write(
      `[compose] (b) ${N}명(시각 모름 ${hourUnknown}, 일주 ${dayPillars}종, 서로 다른 5장 ${distinctTexts}가지)\n` +
      `  글자 수 min ${sorted[0]} · p5 ${pct(5)} · p50 ${pct(50)} · p95 ${pct(95)} · max ${sorted[sorted.length - 1]}\n` +
      `  400 미만 ${under}명(${((under / N) * 100).toFixed(2)}%) · 600 초과 ${over}명(${((over / N) * 100).toFixed(2)}%) · 650 초과 ${overHard}명\n` +
      `  25자 구간 ${JSON.stringify(buckets)}\n  조정 ${JSON.stringify(stepCount)}\n  경고 ${JSON.stringify(warnCount)}\n  원형 ${JSON.stringify(archCount)}\n`,
    )
    expect(overHard).toBe(0)
    for (const c of cases) {
      const ch = c.res.chapters!
      expect(ch.map((x) => [x.no, x.key])).toEqual(FREE_CHAPTER_KEYS.map((k, i) => [i + 1, k]))
      expect(ch).toEqual(c.composed.chapters)
      for (const x of ch) {
        expect(x.text, `${c.i}/${x.key}`).not.toMatch(/[{}]/)
        expect(x.text.trim()).toBe(x.text)
        expect(x.title).toBe(composeJson.chapters[x.no - 1].title)
      }
      // 같은 문장을 두 장에 쓰지 않는다(원칙 5)
      const seen = new Map<string, number>()
      for (const x of ch) for (const sn of new Set(allSentences(x.text))) {
        expect(seen.has(sn) ? `${c.i}: ${sn} (${seen.get(sn)}장·${x.no}장)` : "").toBe("")
        seen.set(sn, x.no)
      }
      // 재료 결함 경고 없음(문장 수 약속 깨짐·남은 토큰·머리 불일치·중복·같은 어미 세 번)
      expect(c.composed.warnings.filter((w) => w.code !== "overBudget"), String(c.i)).toEqual([])
    }
  })

  it("같은 입력은 같은 글(결정론)", () => {
    const r = rng(20261128)
    for (let i = 0; i < 20; i++) expect(makeCase(i, r).res.chapters).toEqual(cases[i].res.chapters)
  })
})

// ─────────────────────────────────────────── (c) 근거가 실제 원국과 일치

const KO_STEM: Record<string, string> = { 甲: "갑", 乙: "을", 丙: "병", 丁: "정", 戊: "무", 己: "기", 庚: "경", 辛: "신", 壬: "임", 癸: "계" }
const EL_NAME: Record<Element, string> = { wood: "나무(목)", fire: "불(화)", earth: "흙(토)", metal: "쇠(금)", water: "물(수)" }

describe("(c) 장마다 근거가 실제 원국(엔진 값)과 일치", () => {
  it("2,000명 전수", () => {
    const th = elementsJson.thresholds
    for (const c of cases) {
      const ch = c.res.chapters!
      const parts = (no: number) => c.composed.parts[no - 1].parts
      const natal = c.rules.source.natal
      const pillar = natal.day.stem + natal.day.branch
      const dpItem = dayPillarJson.items.find((x) => x.pillar === pillar)!
      const tag = `${c.i} ${pillar}`
      // 1장: 일주 간지 = 응답 일주 = 원국 일주
      expect(c.res.dayPillar.hanja, tag).toBe(pillar)
      expect(c.res.pillars.find((p) => p.key === "day")!.hanja, tag).toBe(pillar)
      expect(ch[0].text, tag).toContain(`${dpItem.label}에 났구나.`)
      expect(dpItem.label, tag).toBe(`${c.res.dayPillar.ko}(${pillar})일`)
      // 원형 문장이 긴 꼴이면 범위 말({letters})이 시각 앎·모름에 맞다(짧은 꼴은 범위 말이 없다)
      if (parts(1).some((p) => p.id === "archetype")) expect(ch[0].text, tag).toContain(c.res.hourUnknown ? "여섯 글자를 다 펴 보면" : "여덟 글자를 다 펴 보면")
      expect(ch[0].text, tag).not.toContain(c.res.hourUnknown ? "여덟 글자" : "여섯 글자")
      expect(ch[0].text.endsWith(freeCopyJson.hourNote.text), tag).toBe(c.res.hourUnknown)
      // 3장: 일지 십성(재료 basis.tenGod) = 규칙 엔진 일지 정기 십성, 일지 오행 = 재료 basis.branchElement
      const hit = c.rules.tenGods.find((h) => h.position.pillar === "day" && h.position.part === "branch" && !h.viaHiddenStem)!
      expect(dpItem.basis.tenGod, tag).toBe(hit.tenGod)
      expect(parts(3).find((p) => p.id === "pillarS1")!.text, tag).toContain(`(${hit.tenGod})`)
      expect(ch[2].text, tag).toContain(dayMasterJson.items.find((x) => x.stem === natal.day.stem)!.strength)
      // 4장: 오행 문장의 개수 = 규칙 엔진 counts, 숨은 기운 안내 = 지장간 포함 가중 > 0
      const pick = c.composed.elementPick
      const counts = c.rules.elements.counts
      const limit = c.res.hourUnknown ? th.excessHourUnknown : th.excessFull
      expect(c.res.elements.map((e) => e.count), tag).toEqual(EL.map((e) => counts[e]))
      if (pick) {
        const n = counts[pick.element]
        const s1 = parts(4).find((p) => p.id === "elementS1")!.text
        expect(s1, tag).toContain(EL_NAME[pick.element])
        if (pick.kind === "excess") {
          expect(n, tag).toBeGreaterThanOrEqual(limit)
          expect(Math.max(...EL.map((e) => counts[e])), tag).toBe(n)
          expect(s1, tag).toMatch(new RegExp(`${EL_NAME[pick.element].replace(/[()]/g, "\\$&")}[이가] ${elementsJson.numerals[String(n) as "4"]}`))
        } else {
          expect(n, tag).toBe(0)
          expect(EL.every((e) => counts[e] < limit), tag).toBe(true)
          expect(parts(4).some((p) => p.id === "hiddenNote"), tag).toBe(c.rules.elements.weighted[pick.element] > 0)
        }
      } else {
        expect(EL.every((e) => counts[e] > 0 && counts[e] < limit), tag).toBe(true)
        expect(parts(4).some((p) => p.id === "pillarS2"), tag).toBe(true)
      }
      // 5장: 올해 = 응답 thisYear = 세운, 올해 줄의 십성(재료 tenGods) = 규칙 엔진 세운 십성, 일지 덧줄 = interactions에 있을 때만
      const seun = c.rules.source.seun!
      expect(c.res.thisYear.ganzhi.hanja, tag).toBe(seun.stem + seun.branch)
      const y = thisYearJson.years.find((x) => x.year === c.res.thisYear.year && x.ganzhi === seun.stem + seun.branch)
      expect(c.composed.yearLine, tag).toBe(!!y)
      if (y) {
        const line = y.byDayMaster.find((x) => x.stem === natal.day.stem)!
        const seunHits = c.rules.tenGods.filter((h) => h.position.pillar === "seun" && !h.viaHiddenStem)
        expect(line.tenGods, tag).toEqual([seunHits.find((h) => h.position.part === "stem")!.tenGod, seunHits.find((h) => h.position.part === "branch")!.tenGod])
        expect(ch[4].text, tag).toContain(`${y.year}년엔 `)
        const rel = c.rules.interactions.some(
          (it) => (it.type === "clash" || it.type === "sixCombine") &&
            it.members.some((m) => m.pillar === "day" && m.part === "branch") && it.members.some((m) => m.pillar === "seun" && m.part === "branch"),
        )
        const db = y.dayBranch.find((d) => d.branch === natal.day.branch)
        expect(parts(5).some((p) => p.id === "dayBranch"), tag).toBe(rel && !!db)
        // 일지 덧줄이 있는데 엔진 관계가 없는 경우는 없어야 한다(재료 4줄은 모두 실제 충·합)
        if (db) expect(rel, tag).toBe(true)
      }
      // 일간 이름: 일간 그림 말이 들어 있는 3장 문장은 그 일간 것
      expect(KO_STEM[natal.day.stem], tag).toBe(c.res.dayMaster.ko)
    }
  })
})

// ─────────────────────────────────────────── (d) 검증기 block 0 · 금지 낱말·죽음·질병 시기 없음

describe("(d) 검증기(verifyReading) — block 0", () => {
  it("2,000명 전수", () => {
    const blocks: string[] = []
    const warnCodes: Record<string, number> = {}
    const regexHits: string[] = []
    const forbiddenWarn = new Set<string>()
    for (const c of cases) {
      const natal = c.rules.source.natal
      const seun = c.rules.source.seun!
      const g = (p: { stem: string; branch: string }) => p.stem + p.branch
      const reading = {
        parts: [{ title: "무료 결과", chapters: c.res.chapters!.map((x) => ({ key: x.key, title: x.title, body: [x.text] })) }],
      }
      const rep = verifyReading(reading, {
        sajuInput: {
          pillars: { year: g(natal.year), month: g(natal.month), day: g(natal.day), ...(natal.hour ? { hour: g(natal.hour) } : {}) },
          hour_unknown: c.res.hourUnknown, this_year: c.res.thisYear.year, this_year_ganzhi: g(seun),
        },
        rules: c.rules,
      })
      for (const f of rep.findings) {
        if (f.severity === "block") blocks.push(`${c.i} ${f.code}: ${f.excerpt}`)
        else {
          warnCodes[`${f.severity}:${f.code}`] = (warnCodes[`${f.severity}:${f.code}`] ?? 0) + 1
          if (f.code === "FORBIDDEN_TOPIC") forbiddenWarn.add(`${f.rule ?? ""}: ${f.excerpt}`)
        }
      }
      for (const x of c.res.chapters!) { const m = FORBIDDEN.exec(x.text); if (m) regexHits.push(`${c.i}/${x.key}: ${m[0]}`) }
    }
    process.stderr.write(`[compose] (d) block ${blocks.length} · warn/info ${JSON.stringify(warnCodes)} · 금지 낱말 ${regexHits.length}\n  FORBIDDEN_TOPIC warn 문장: ${[...forbiddenWarn].join(" | ")}\n${blocks.slice(0, 10).join("\n")}\n${regexHits.slice(0, 10).join("\n")}\n`)
    expect(blocks).toEqual([])
    expect(regexHits).toEqual([])
  })
})

// ─────────────────────────────────────────── 응답 본체 연결

describe("응답 본체(buildUnmyeongFree) 연결", () => {
  it("성공 경로는 로그 0줄(경고는 재료 결함·650자 초과일 때만)", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const r = rng(5)
    for (let i = 0; i < 50; i++) makeCase(i, r)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
  it("free-copy.json에 원형 본문이 없으면 chapters null(준비 중)", () => {
    const c = cases[0]
    expect(composeFreeChapters(c.facts, { freeCopy: null })).toBeNull()
    expect(composeFreeChapters(c.facts, { freeCopy: loadFreeCopy() })).not.toBeNull()
  })
})
