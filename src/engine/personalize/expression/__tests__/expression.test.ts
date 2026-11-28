// 사주 발현 분석 엔진(expression@0.1.0) 시험 — 계약 docs/redesign/30-expression-engine.md §7 필수 시험 7개 + 경계
// + 연구소장 expression-dimensions.md §4 손계산 대조 + 총괄실장 결정(2026-11-28) 1~9.
// 외부 호출 없음. 원국은 computeChart → analyzeRules로 만든다(엔진 코드는 읽기만).
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { analyzeArchetype, analyzeRules, computeChart, yearPillarOf, type BirthInput, type CalendarResult, type Pillar, type RuleAnalysis } from "../../.."
import { GAEUN_CATEGORY_IDS, buildGaeunBasis, luckGlyphsOf, pickGaeun } from "../../../content/gaeun"
import type { LuckGlyphFacts } from "../../../content/types"
import { linkFactToChart } from "../../lived-link"
import { SURVEY_QUESTIONS } from "../../survey"
import type { SurveyAnswer, UserFact } from "../../types"
import { answersToUserFacts } from "../../user-facts"
import {
  EXPRESSION_ENGINE_VERSION, EXPRESSION_FORBIDDEN_PHRASES, EXPRESSION_SECTION_IDS, ExpressionTableError, LIVED_LINK_GROUP,
  buildExpressionReport, expressionTables, findForbiddenPhrases, makeExpressionTables, mbtiFromUserFacts, parseMbtiInput,
  potentialsOf, selfReportFromUserFacts, type ExpressionInput, type ExpressionReport, type GroupRuleParams, type MbtiAxisReport,
  type SelfReport,
} from ".."

const ROOT = resolve(__dirname, "../../../../..")
const RAW_DIMS_TEXT = readFileSync(resolve(ROOT, "content/expression/dimensions.json"), "utf8")
const RAW_BRIDGE_TEXT = readFileSync(resolve(ROOT, "content/expression/mbti-bridge.json"), "utf8")
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
const NOW_YEAR = 2026

// ─────────────────────────────────────────── 도우미

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = <T,>(rnd: () => number, xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]

const BASE: BirthInput = { calendar: "solar", year: 1990, month: 3, day: 15, time: { hour: 9, minute: 30 }, gender: "F" }
const pil = (s: string): Pillar => ({ stem: s[0] as Pillar["stem"], branch: s[1] as Pillar["branch"] })

function analysisOf(c: CalendarResult, year = NOW_YEAR): RuleAnalysis {
  return analyzeRules(c, undefined, { luck: c.luck.daeun.map((d) => d.pillar), year: yearPillarOf(year) })
}

function currentDaeun(c: CalendarResult, year = NOW_YEAR): { luckIndex: number; daeunIndex: number } | undefined {
  let found: { luckIndex: number; daeunIndex: number } | undefined
  c.luck.daeun.forEach((d, i) => {
    if (d.startYear <= year) found = { luckIndex: i, daeunIndex: d.index }
  })
  return found
}

function inputOf(c: CalendarResult, a: RuleAnalysis, self?: SelfReport, year = NOW_YEAR, archetypeId?: string): ExpressionInput {
  const daeun = currentDaeun(c, year)
  return {
    analysis: a,
    ...(self ? { self } : {}),
    luck: { ...(daeun ? { daeun } : {}), seunYear: year },
    ...(archetypeId ? { archetype: { id: archetypeId } } : {}),
  }
}

const mbti = (s: string): MbtiAxisReport[] => parseMbtiInput(s).axes
const facts = (answers: SurveyAnswer[], birthYear = 1990): UserFact[] => answersToUserFacts(answers, { birthYear, nowYear: NOW_YEAR }).userFacts
const readingOf = (r: ExpressionReport, d: string) => r.readings.find((x) => x.dimensionId === d)!
const levelOf = (r: ExpressionReport, d: string) => r.innate.find((x) => x.dimensionId === d)!.level

function randomChart(rnd: () => number, knownRate = 0.7): CalendarResult {
  const known = rnd() < knownRate
  return computeChart({
    calendar: "solar",
    year: 1950 + Math.floor(rnd() * 60),
    month: 1 + Math.floor(rnd() * 12),
    day: 1 + Math.floor(rnd() * 28),
    time: known ? { hour: Math.floor(rnd() * 24), minute: Math.floor(rnd() * 60) } : null,
    gender: rnd() < 0.5 ? "M" : "F",
  })
}

const SELF_QS = ["occupationStatus", "workStyle", "selfStrength", "selfWeakness", "changeWish", "recentChanges", "lifeEvents"] as const

function randomAnswers(rnd: () => number): SurveyAnswer[] {
  const out: SurveyAnswer[] = []
  for (const qid of SELF_QS) {
    if (rnd() < 0.45) continue
    const q = SURVEY_QUESTIONS.find((x) => x.id === qid)!
    if (q.kind === "single") out.push({ questionId: q.id, values: [pick(rnd, q.options).value] })
    else {
      const n = 1 + Math.floor(rnd() * Math.min(2, q.maxSelect))
      const vals: string[] = []
      while (vals.length < n) {
        const v = pick(rnd, q.options).value
        if (!vals.includes(v)) vals.push(v)
      }
      out.push({ questionId: q.id, values: vals })
    }
  }
  return out
}

const AXIS_CHOICES: Record<string, string[]> = {
  EI: ["E", "I", "E?", "I?", "unknown"], SN: ["S", "N", "S?", "N?", "unknown"],
  TF: ["T", "F", "T?", "F?", "unknown"], JP: ["J", "P", "J?", "P?", "unknown"],
}
function randomMbti(rnd: () => number): MbtiAxisReport[] | undefined {
  if (rnd() < 0.2) return undefined
  return parseMbtiInput(Object.fromEntries(Object.entries(AXIS_CHOICES).map(([k, v]) => [k, pick(rnd, v)]))).axes
}

/** 출력의 모든 문자열(키 제외)을 모은다 */
function allStrings(x: unknown, out: string[] = []): string[] {
  if (typeof x === "string") out.push(x)
  else if (Array.isArray(x)) x.forEach((v) => allStrings(v, out))
  else if (x && typeof x === "object") Object.values(x).forEach((v) => allStrings(v, out))
  return out
}
function allObjects(x: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(x)) x.forEach((v) => allObjects(v, out))
  else if (x && typeof x === "object") {
    out.push(x as Record<string, unknown>)
    Object.values(x).forEach((v) => allObjects(v, out))
  }
  return out
}

/** 9개 결과 항목의 근거 id가 모두 보고서·입력 안의 실제 항목을 가리키는지 */
function unresolvedSectionIds(r: ExpressionReport, self?: SelfReport): string[] {
  const factIds = new Set((self?.facts ?? []).map((f) => f.id))
  const axes = new Set<string>((self?.mbti ?? []).map((m) => m.axis))
  const bad: string[] = []
  for (const sid of EXPRESSION_SECTION_IDS) {
    for (const id of r.sections[sid]) {
      const [kind, ...rest] = id.split(":")
      const v = rest.join(":")
      const ok =
        kind === "potential" ? r.innate.some((p) => p.dimensionId === v)
        : kind === "reading" ? r.readings.some((x) => x.dimensionId === v)
        : kind === "conflict" ? /^\d+$/.test(v) && Number(v) < r.conflicts.length
        : kind === "luck" ? r.luck.some((l) => `${l.scope}:${l.ganzhi}` === v)
        : kind === "gaeun" ? r.gaeun.includes(v)
        : kind === "archetype" ? r.archetype.id === v
        : kind === "fact" ? factIds.has(v)
        : kind === "mbti" ? axes.has(v)
        : false
      if (!ok) bad.push(`${sid}:${id}`)
    }
  }
  return bad
}

// 고정 원국
const CHART = computeChart(BASE)
// 연구소장 §4 손계산 원국: 연 甲子 · 월 丙寅 · 일 戊辰 · 시 庚申
const HAND = (hour: boolean): CalendarResult => ({
  ...CHART,
  hourKnown: hour,
  pillars: { year: pil("甲子"), month: pil("丙寅"), day: pil("戊辰"), hour: hour ? pil("庚申") : null },
})

// ─────────────────────────────────────────── 표

describe("표(데이터)", () => {
  it("동봉 표: 9개 차원·designed·service-model·kr-monthly-30 고정", () => {
    const T = expressionTables()
    expect(T.dims.status).toBe("designed")
    expect(T.dims.claim).toBe("service-model")
    expect(T.dims.hiddenStemTable).toBe("kr-monthly-30")
    expect(T.bridge.claim).toBe("service-model")
    expect(T.bridge.links.every((l) => l.claim === "service-model")).toBe(true)
    expect(T.dims.dimensions.map((d) => d.id)).toEqual(["drive", "expression", "realism", "duty", "learning", "steadiness", "edge", "flux", "outward"])
    expect(T.dims.dimensions.map((d) => d.kind)).toEqual(["core", "core", "core", "core", "core", "grain", "grain", "aux", "aux"])
    expect(T.hash).toMatch(/^fnv1a:[0-9a-f]{16}$/)
    expect(EXPRESSION_ENGINE_VERSION).toBe("expression@0.1.0")
  })

  it("MBTI 대응: T/F 신호 없음, low는 I→outward·P→steadiness(sure 전용)만", () => {
    const { bridge } = expressionTables()
    expect(bridge.links.some((l) => l.axis === "TF")).toBe(false)
    expect(bridge.links.filter((l) => l.direction === "low").map((l) => `${l.axis}|${l.pole}|${l.dimensionId}|${l.sureOnly}`).sort())
      .toEqual(["EI|I|outward|true", "JP|P|steadiness|true"])
    expect(bridge.links.some((l) => l.pole === "N")).toBe(false)
  })

  it("기질 답 대응은 lived-link 묶음(철자 변환)과 같다 — 연구소장 추가분(planning→steadiness)만 예외", () => {
    const { dims } = expressionTables()
    const coreOf = (g: string) => dims.dimensions.find((d) => d.rule === "exp.lv.group.v1" && (d.params as GroupRuleParams).group === g)?.id
    const ADDED = new Set(["selfStrength:planning|steadiness"])
    for (const d of dims.dimensions) {
      for (const f of d.facts) {
        const [questionId, value] = f.key.split(":")
        const fake = { source: "user", id: f.key, topic: questionId, value, label: "", questionId, useAs: "background-only", selfReported: true } as UserFact
        const g = linkFactToChart(fake, {}).group
        if (!g) continue // lived-link에 없는 추가분(decisiveness)
        if (ADDED.has(`${f.key}|${d.id}`)) continue
        expect(`${f.key}→${coreOf(LIVED_LINK_GROUP[g])}`).toBe(`${f.key}→${d.id}`)
      }
    }
  })

  it("잘못된 표는 멈춘다", () => {
    const dims = JSON.parse(RAW_DIMS_TEXT)
    const bridge = JSON.parse(RAW_BRIDGE_TEXT)
    expect(() => makeExpressionTables(dims, bridge)).not.toThrow()
    const a = clone(dims)
    a.dimensions[0].rule = "exp.lv.nope"
    expect(() => makeExpressionTables(a, bridge)).toThrow(ExpressionTableError)
    const b = clone(dims)
    b.dimensions[1].facts[0].key = "workStyle:dancing"
    expect(() => makeExpressionTables(b, bridge)).toThrow(/선택지/)
    const c = clone(bridge)
    delete c.claim
    expect(() => makeExpressionTables(dims, c)).toThrow(/claim/)
    const c2 = clone(bridge)
    delete c2.links[0].claim
    expect(() => makeExpressionTables(dims, c2)).toThrow(/행마다/)
    const d = clone(dims)
    d.dimensions[0].facts.push({ key: "mbti:INTJ", direction: "high", weight: 1, evidence: "trait" })
    expect(() => makeExpressionTables(d, bridge)).toThrow(/MBTI/)
    const e = clone(bridge)
    e.note = "사주와 MBTI는 검증된 상관이 있다"
    expect(() => makeExpressionTables(dims, e)).toThrow(/금지 표현/)
    const f = clone(bridge)
    f.links.push({ dimensionId: "drive", axis: "TF", pole: "T", direction: "high", weight: 1, grade: "B", sureOnly: false, claim: "service-model" })
    expect(() => makeExpressionTables(dims, f)).toThrow(/TF/)
    const g = clone(bridge)
    g.links.push({ dimensionId: "expression", axis: "EI", pole: "I", direction: "low", weight: 1, grade: "B", sureOnly: true, claim: "service-model" })
    expect(() => makeExpressionTables(dims, g)).toThrow(/low/)
    const h = clone(dims)
    h.dimensions[2].facts.push({ key: "occupationStatus:self_employed", direction: "high", weight: 1, evidence: "trait" })
    expect(() => makeExpressionTables(h, bridge)).toThrow(/상황 사실/)
    const i = clone(dims)
    i.dimensions[0].params.group = "bigeop"
    expect(() => makeExpressionTables(i, bridge)).toThrow(/rules 철자/)
  })

  it("표만 바꿔도(문턱값) 판정이 바뀌고 해시가 바뀐다 — 엔진 코드는 그대로", () => {
    const dims = JSON.parse(RAW_DIMS_TEXT)
    const bridge = JSON.parse(RAW_BRIDGE_TEXT)
    for (const d of dims.dimensions) if (d.rule === "exp.lv.group.v1") Object.assign(d.params, { rootedStrong: 0.99, rootedStrongWithMonth: 0.99 })
    const T2 = makeExpressionTables(dims, bridge)
    const a = analyzeRules(HAND(true))
    const r1 = buildExpressionReport({ analysis: a, archetype: { id: "baekho" } })
    const r2 = buildExpressionReport({ analysis: a, archetype: { id: "baekho" } }, { tables: T2 })
    expect(r2.rulesHash).not.toBe(r1.rulesHash)
    expect(levelOf(r1, "duty")).toBe("strong")
    expect(levelOf(r2, "duty")).toBe("moderate")
  })
})

// ─────────────────────────────────────────── 연구소장 §4 손계산 대조

describe("연구소장 §4 손계산 원국(甲子 丙寅 戊辰 庚申)", () => {
  it("시주 있음: 9개 차원 단계·표지·경계 차단이 손계산과 같다", () => {
    const r = buildExpressionReport({ analysis: analyzeRules(HAND(true)) })
    const got = Object.fromEntries(r.innate.map((p) => [p.dimensionId, p.level]))
    expect(got).toEqual({
      drive: "moderate", expression: "moderate", realism: "moderate", duty: "strong", learning: "moderate",
      steadiness: "moderate", edge: "strong", flux: "strong", outward: "strong",
    })
    const pot = (d: string) => r.innate.find((p) => p.dimensionId === d)!
    expect(pot("drive").flags).toContain("latent")
    expect(pot("realism").flags).toContain("latent")
    expect(pot("drive").basis[0].ruleId).toBe("exp.lv.hiddenOnly")
    expect(pot("duty").basis[0].ruleId).toBe("exp.lv.rooted")
    expect(pot("duty").flags).toContain("month")
    expect(pot("duty").basis[0].positions).toEqual(["year.stem", "month.branch.jeonggi", "day.branch.yeogi"])
    // 모형 A r≈0.4317, 경계 0.45 근처 → drive 보정 없음, duty 부담 메모 없음
    expect(r.sensitivity.boundary.nearBoundary).toBe(true)
    expect(r.sensitivity.boundary.blocked).toBe(true)
    expect(pot("drive").basis.map((b) => b.ruleId)).toContain("exp.sens.boundary")
    expect(pot("duty").basis.map((b) => b.ruleId)).not.toContain("exp.note.load")
    expect(r.conflicts.some((k) => k.kind === "chart-uncertain" && k.note.startsWith("힘의 세기가 경계 근처"))).toBe(true)
    expect(pot("edge").basis[0].note).toContain("천간 투출 있음")
    expect(pot("outward").basis[0].note).toContain("양 7/8")
  })

  it("시주 없음: expression·flux가 faint로 바뀐다(나머지는 손계산 표와 같음)", () => {
    const r = buildExpressionReport({ analysis: analyzeRules(HAND(false)) })
    const got = Object.fromEntries(r.innate.map((p) => [p.dimensionId, p.level]))
    expect(got).toEqual({
      drive: "moderate", expression: "faint", realism: "moderate", duty: "strong", learning: "moderate",
      steadiness: "moderate", edge: "strong", flux: "faint", outward: "strong",
    })
    expect(r.innate.find((p) => p.dimensionId === "expression")!.basis[0].ruleId).toBe("exp.lv.absent")
    for (const p of r.innate) expect(p.hourStable?.of).toBe(12)
  }, 60_000)

  it("strengthPrimary를 바꿔도·입력 표가 cn이어도 차원 단계는 같다(모형 A·kr 표 고정)", () => {
    const c = HAND(true)
    const base = potentialsOf(analyzeRules(c), expressionTables().dims).map((p) => p.level)
    expect(potentialsOf(analyzeRules(c, { strengthPrimary: "rooted" }), expressionTables().dims).map((p) => p.level)).toEqual(base)
    const viaCn = buildExpressionReport({ analysis: analyzeRules(c, { hiddenStemTable: "cn-lunarjs" }), archetype: { id: "baekho" } })
    expect(viaCn.innate.map((p) => p.level)).toEqual(base)
  })
})

// ─────────────────────────────────────────── MBTI 입력

describe("MBTI 4축 입력(축별 모름 허용)", () => {
  it("문자열·객체·설문 16유형 값을 받는다", () => {
    expect(parseMbtiInput("INTJ").axes).toEqual([
      { axis: "EI", pole: "I", sure: true }, { axis: "SN", pole: "N", sure: true },
      { axis: "TF", pole: "T", sure: true }, { axis: "JP", pole: "J", sure: true },
    ])
    expect(parseMbtiInput("iNxJ").axes).toEqual([
      { axis: "EI", pole: "I", sure: false }, { axis: "SN", pole: "N", sure: true }, { axis: "JP", pole: "J", sure: true },
    ])
    expect(parseMbtiInput("ENFP-T").axes.map((x) => x.pole).join("")).toBe("ENFP")
    expect(parseMbtiInput({ EI: "E?", SN: "unknown", TF: undefined, JP: "P" }).axes).toEqual([
      { axis: "EI", pole: "E", sure: false }, { axis: "JP", pole: "P", sure: true },
    ])
    expect(parseMbtiInput(undefined).axes).toEqual([])
    expect(parseMbtiInput("xxxx").axes).toEqual([])
    const bad = parseMbtiInput({ EI: "Q", SN: 3 })
    expect(bad.axes).toEqual([])
    expect(bad.issues.map((i) => i.code).sort()).toEqual(["invalid_pole", "malformed"])
    expect(parseMbtiInput("INTJX").issues[0].code).toBe("malformed")

    const fs = facts([{ questionId: "mbti", values: ["ENFP"] }, { questionId: "workStyle", values: ["team"] }])
    expect(mbtiFromUserFacts(fs)?.map((x) => x.pole).join("")).toBe("ENFP")
    const s1 = selfReportFromUserFacts(fs)
    expect(s1.mbti?.length).toBe(4)
    expect(s1.facts).toEqual(fs)
    expect(selfReportFromUserFacts(fs, { EI: "I", SN: "unknown" }).mbti).toEqual([{ axis: "EI", pole: "I", sure: true }])
  })

  it("T/F는 차원 신호가 아니다: ENTJ ↔ ENFJ는 readings가 같고 문체 힌트만 다르다", () => {
    const a = analysisOf(CHART)
    const r1 = buildExpressionReport(inputOf(CHART, a, { mbti: mbti("ENTJ"), facts: [] }))
    const r2 = buildExpressionReport(inputOf(CHART, a, { mbti: mbti("ENFJ"), facts: [] }))
    expect(r2.readings).toEqual(r1.readings)
    expect(r2.luck).toEqual(r1.luck)
    expect(r1.styleHints).toEqual(["style.bigPictureFirst", "style.reasonFirst"])
    expect(r2.styleHints).toEqual(["style.bigPictureFirst", "style.peopleFirst"])
    expect(allStrings(r1.readings).some((s) => s === "mbti:TF")).toBe(false)
  })
})

// ─────────────────────────────────────────── 계약 §7 필수 시험

describe("§7-1 같은 원국 + MBTI 다름 → RuleAnalysis·대운·세운 같고 readings·luck.strategy 다름", () => {
  it("규칙 엔진 값은 그대로, 발현 판정만 달라진다", () => {
    const chartBefore = JSON.stringify(CHART)
    const a1 = analysisOf(CHART)
    const a1Snap = JSON.stringify(a1)
    const r1 = buildExpressionReport(inputOf(CHART, a1, { mbti: mbti("ESTJ"), facts: [] }))
    const a2 = analysisOf(CHART)
    const r2 = buildExpressionReport(inputOf(CHART, a2, { mbti: mbti("INFP"), facts: [] }))

    expect(JSON.stringify(a1)).toBe(a1Snap) // 엔진은 RuleAnalysis를 고치지 않는다
    expect(a2).toEqual(a1) // MBTI가 들어갈 길이 없음
    expect(a2.source.luck).toEqual(a1.source.luck)
    expect(a2.source.seun).toEqual(a1.source.seun)
    expect(JSON.stringify(CHART)).toBe(chartBefore)

    expect(r2.innate).toEqual(r1.innate)
    expect(r2.rulesHash).toBe(r1.rulesHash)
    expect(r2.archetype).toEqual(r1.archetype)
    expect(r2.luck.map((l) => [l.scope, l.ganzhi, l.touches, l.tone])).toEqual(r1.luck.map((l) => [l.scope, l.ganzhi, l.touches, l.tone]))

    expect(r2.readings).not.toEqual(r1.readings)
    expect(readingOf(r1, "outward").self.signal).toBe("high") // E(A) × MBTI만 0.5
    expect(readingOf(r2, "outward").self.signal).toBe("none") // I low(B 0.5) × 0.5 = 0.25
    expect(readingOf(r1, "steadiness").self.signal).toBe("high") // J(A−)
    expect(readingOf(r2, "steadiness").self.signal).toBe("none")
  })

  it("여러 원국 × 세운 12년: luck.strategy가 달라지는 경우가 있고, 전략 id는 늘 그 차원 상태에서 나온다", () => {
    const T = expressionTables()
    const rnd = mulberry32(11)
    const charts = [CHART, ...Array.from({ length: 5 }, () => randomChart(rnd, 1))]
    let differ = 0
    for (const c of charts) {
      const arch = analyzeArchetype(analyzeRules(c), c).id
      for (let y = 2020; y < 2032; y++) {
        const a = analysisOf(c, y)
        const r1 = buildExpressionReport(inputOf(c, a, { mbti: mbti("ESTJ"), facts: [] }, y, arch))
        const r2 = buildExpressionReport(inputOf(c, analysisOf(c, y), { mbti: mbti("INFP"), facts: [] }, y, arch))
        expect(r2.luck.map((l) => l.touches)).toEqual(r1.luck.map((l) => l.touches))
        if (JSON.stringify(r1.luck.map((l) => l.strategy)) !== JSON.stringify(r2.luck.map((l) => l.strategy))) differ++
        for (const r of [r1, r2]) {
          for (const l of r.luck) {
            expect(l.activates).toEqual([...new Set(l.touches.filter((t) => t.mode === "activate").map((t) => t.dimensionId))])
            for (const t of l.touches) {
              expect(t.via.length).toBeGreaterThan(0)
              if (t.mode === "feed") continue
              const st = readingOf(r, t.dimensionId).status
              expect(l.strategy).toContain(`${T.dims.strategies.matrix[st][t.mode]}:${t.dimensionId}`)
            }
            if (l.tone !== "neutral") expect(l.strategy).toContain(T.dims.strategies.tone[l.tone])
            if (r.sensitivity.boundary.blocked) expect(l.tone).toBe("neutral")
            expect(l.touches.some((t) => t.dimensionId === "outward")).toBe(false) // outward는 운이 건드리지 않음
          }
        }
      }
    }
    expect(differ).toBeGreaterThan(0)
  }, 120_000)
})

describe("§7-2 같은 원국 + 같은 MBTI + 경험 다름 → 결과가 달라진다", () => {
  it("직업·일 방식이 다르면 readings·sections가 다르다", () => {
    const a = analysisOf(CHART)
    const fa = facts([{ questionId: "occupationStatus", values: ["self_employed"] }, { questionId: "workStyle", values: ["people_facing"] }])
    const fb = facts([{ questionId: "occupationStatus", values: ["student"] }, { questionId: "workStyle", values: ["solo_deep"] }])
    const ra = buildExpressionReport(inputOf(CHART, a, { mbti: mbti("ENTP"), facts: fa }))
    const rb = buildExpressionReport(inputOf(CHART, a, { mbti: mbti("ENTP"), facts: fb }))
    expect(ra.innate).toEqual(rb.innate)
    expect(ra.readings).not.toEqual(rb.readings)
    expect(ra.sections).not.toEqual(rb.sections)
    expect(readingOf(ra, "realism").self).toEqual({ signal: "high", from: ["fact:occupationStatus"], mbtiOnly: false }) // 상황 답(lived-link)
    expect(readingOf(rb, "realism").self.signal).toBe("none")
    expect(readingOf(rb, "learning").self).toEqual({ signal: "high", from: ["fact:occupationStatus", "fact:workStyle"], mbtiOnly: false })
    expect(readingOf(ra, "expression").self.from).toEqual(["fact:workStyle", "mbti:EI"])
  })
})

describe("§7-3·4·5 무작위 원국·자기보고", () => {
  it("inferred 항상 true, basis 비지 않음, 사실 id ⊆ 입력, 사실 내용 복사 없음, MBTI만이면 developed 없음, 시주 모름 보류 규칙, 근거 id 해석 가능", () => {
    const rnd = mulberry32(20261128)
    const T = expressionTables()
    let mbtiOnlyRuns = 0
    for (let n = 0; n < 24; n++) {
      const c = randomChart(rnd)
      const a = analysisOf(c)
      const archId = n % 4 === 0 ? undefined : analyzeArchetype(a, c).id
      for (let k = 0; k < 6; k++) {
        const fs = k % 3 === 0 ? [] : facts(randomAnswers(rnd), c.solarDate.year)
        const m = k % 2 === 0 ? randomMbti(rnd) : undefined
        const self: SelfReport = { ...(m ? { mbti: m } : {}), facts: fs }
        const r = buildExpressionReport(inputOf(c, a, self, NOW_YEAR, archId))

        // §7-3
        expect(r.readings.every((x) => x.inferred === true)).toBe(true)
        expect(r.inferred).toBe(true)
        expect(r.innate).toHaveLength(T.dims.dimensions.length)
        for (const p of r.innate) expect(p.basis.length).toBeGreaterThan(0)
        for (const x of r.readings) expect(x.chart.basis.length).toBeGreaterThan(0)
        if (!c.hourKnown) expect(allStrings(r.innate).some((s) => s.startsWith("hour."))).toBe(false)

        // §7-4: 사실은 입력 id로만, 사실 객체·선택지 이름을 출력에 만들지 않는다
        const inputIds = new Set(fs.map((f) => f.id))
        for (const s of allStrings(r).filter((x) => x.startsWith("fact:"))) expect(inputIds.has(s.slice(5)), s).toBe(true)
        expect(allObjects(r).some((o) => o.source === "user")).toBe(false)
        const json = JSON.stringify(r)
        for (const f of fs) expect(json.includes(f.label), f.label).toBe(false)

        // §7-5 + 결정 8: developed는 기질 답이 있어야(MBTI만·상황 답만이면 없음)
        if (fs.length === 0) {
          mbtiOnlyRuns++
          expect(r.readings.some((x) => x.status === "developed")).toBe(false)
        }
        for (const x of r.readings) {
          if (x.status !== "developed") continue
          const row = T.dims.dimensions.find((d) => d.id === x.dimensionId)!
          const traitKeys = new Set(row.facts.filter((f) => f.direction === "high").map((f) => f.key))
          expect(fs.some((f) => traitKeys.has(`${f.questionId}:${f.value}`) && x.self.from.includes(`fact:${f.id}`))).toBe(true)
        }
        // 결정 6: 시주 모름이면 dormant·developed는 hourStable ≥ 8/12일 때만
        if (!c.hourKnown)
          for (const x of r.readings)
            if (x.status === "dormant" || x.status === "developed") expect(x.chart.hourStable!.stable).toBeGreaterThanOrEqual(8)

        expect(unresolvedSectionIds(r, self)).toEqual([])
        expect(findForbiddenPhrases(r)).toEqual([])
      }
    }
    expect(mbtiOnlyRuns).toBeGreaterThan(10)
  }, 180_000)

  it("§7-5 16유형 × 확신 없음까지: MBTI만이면 developed가 한 번도 없고, 같은 상황에 기질 답 1개를 더하면 developed가 된다", () => {
    const rnd = mulberry32(7)
    const T = expressionTables()
    const types = ["E", "I"].flatMap((a) => ["S", "N"].flatMap((b) => ["T", "F"].flatMap((c) => ["J", "P"].map((d) => a + b + c + d))))
    let blocked = 0
    let developedWithFact = 0
    let used = 0
    // MBTI만으로 high가 나올 수 있는 차원은 outward(E)·steadiness(J)뿐 — 처음 10개 원국은 무조건, 그 뒤로는 둘 중 하나가 faint인 원국만 본다
    for (let n = 0; n < 400 && (used < 10 || developedWithFact === 0); n++) {
      const c = randomChart(rnd, 1)
      const a = analysisOf(c)
      const lv = potentialsOf(a, T.dims)
      if (used >= 10 && !lv.some((p) => (p.dimensionId === "steadiness" || p.dimensionId === "outward") && p.level === "faint")) continue
      used++
      const archId = analyzeArchetype(a, c).id
      for (const t of types) {
        for (const form of [t, t.toLowerCase()]) {
          const self: SelfReport = { mbti: mbti(form), facts: [] }
          const r = buildExpressionReport(inputOf(c, a, self, NOW_YEAR, archId))
          expect(r.readings.some((x) => x.status === "developed")).toBe(false)
          for (const x of r.readings) {
            expect(x.self.mbtiOnly || x.self.from.length === 0).toBe(true)
            if (x.chart.level !== "faint" || x.self.signal !== "high") continue
            blocked++
            expect(x.status).toBe("unknown")
            expect(r.conflicts.filter((k) => k.dimensionId === x.dimensionId).map((k) => k.kind)).toEqual(expect.arrayContaining(["chart-vs-self", "missing"]))
            const row = T.dims.dimensions.find((d) => d.id === x.dimensionId)!
            const link = row.facts.find((f) => f.direction === "high")
            if (!link) continue // outward 등 기질 답 대응이 없는 차원
            const [qid, val] = link.key.split(":")
            const fs = facts([{ questionId: qid as SurveyAnswer["questionId"], values: [val] }], c.solarDate.year)
            const x2 = readingOf(buildExpressionReport(inputOf(c, a, { mbti: self.mbti, facts: fs }, NOW_YEAR, archId)), x.dimensionId)
            expect(x2.status).toBe("developed")
            expect(x2.self.from[0]).toBe(`fact:${fs[0].id}`)
            developedWithFact++
          }
        }
      }
    }
    expect(blocked).toBeGreaterThan(0)
    expect(developedWithFact).toBeGreaterThan(0)
  }, 180_000)

  it("결정 8: 상황 답(직업 상태 등)만으로는 developed가 아니고, 기질 답을 더하면 developed", () => {
    const SITUATION: Record<string, SurveyAnswer> = {
      expression: { questionId: "occupationStatus", values: ["freelance"] },
      realism: { questionId: "occupationStatus", values: ["self_employed"] },
      duty: { questionId: "occupationStatus", values: ["employed"] },
      learning: { questionId: "occupationStatus", values: ["student"] },
    }
    const TRAIT: Record<string, SurveyAnswer> = {
      expression: { questionId: "selfStrength", values: ["communication"] },
      duty: { questionId: "workStyle", values: ["leading"] },
      learning: { questionId: "selfStrength", values: ["learning"] },
    }
    const rnd = mulberry32(99)
    let checked = 0
    for (let n = 0; n < 40 && checked < 3; n++) {
      const c = randomChart(rnd, 1)
      const a = analysisOf(c)
      const base = buildExpressionReport(inputOf(c, a, undefined, NOW_YEAR, "sage"))
      for (const dim of ["expression", "duty", "learning"]) {
        if (levelOf(base, dim) !== "faint") continue
        const fs1 = facts([SITUATION[dim]], c.solarDate.year)
        const r1 = buildExpressionReport(inputOf(c, a, { facts: fs1 }, NOW_YEAR, "sage"))
        expect(readingOf(r1, dim).self.signal).toBe("high")
        expect(readingOf(r1, dim).status).toBe("unknown")
        expect(r1.conflicts.some((k) => k.dimensionId === dim && k.note.includes("상황 답만"))).toBe(true)
        const fs2 = facts([SITUATION[dim], TRAIT[dim]], c.solarDate.year)
        expect(readingOf(buildExpressionReport(inputOf(c, a, { facts: fs2 }, NOW_YEAR, "sage")), dim).status).toBe("developed")
        checked++
      }
    }
    expect(checked).toBeGreaterThan(0)
  }, 120_000)
})

describe("§7-6 결정론 — 같은 입력 → 같은 출력(1,000회 무작위)", () => {
  it("1,000회: 같은 입력(복제본 포함)이면 출력 JSON이 같다", () => {
    const rnd = mulberry32(1000)
    const fixtures = Array.from({ length: 8 }, () => {
      const c = randomChart(rnd)
      const a = analysisOf(c)
      return { c, a, archId: analyzeArchetype(a, c).id }
    })
    const firstSeen = new Map<string, string>()
    for (let i = 0; i < 1000; i++) {
      const fx = fixtures[i % fixtures.length]
      const self: SelfReport = { facts: rnd() < 0.7 ? facts(randomAnswers(rnd), fx.c.solarDate.year) : [] }
      const m = randomMbti(rnd)
      if (m) self.mbti = m
      const inp = inputOf(fx.c, fx.a, self, NOW_YEAR, fx.archId)
      const j1 = JSON.stringify(buildExpressionReport(inp))
      const j2 = JSON.stringify(buildExpressionReport(clone(inp)))
      expect(j2).toBe(j1)
      const key = `${i % fixtures.length}|${JSON.stringify(self)}`
      const prev = firstSeen.get(key)
      if (prev !== undefined) expect(j1).toBe(prev)
      else firstSeen.set(key, j1)
    }
  }, 180_000)

  it("시주 모름 12시진 재판정은 캐시와 무관하게 같은 값, hourCheck를 끄면 기록이 빠지고 단계는 같다", () => {
    const c = computeChart({ ...BASE, time: null })
    const a = analysisOf(c)
    const r1 = buildExpressionReport(inputOf(c, a))
    const r2 = buildExpressionReport(inputOf(c, clone(a)))
    expect(r2).toEqual(r1)
    const r3 = buildExpressionReport(inputOf(c, a), { hourCheck: false })
    expect(r3.innate.map((p) => p.level)).toEqual(r1.innate.map((p) => p.level))
    expect(r3.innate.every((p) => p.hourStable === undefined)).toBe(true)
    expect(r1.innate.every((p) => p.hourStable && p.hourStable.stable >= 0 && p.hourStable.stable <= 12)).toBe(true)
  }, 60_000)
})

describe("§7-7 금지 표현", () => {
  it("데이터 파일 원문에 금지 표현이 없다", () => {
    for (const text of [RAW_DIMS_TEXT, RAW_BRIDGE_TEXT]) for (const p of EXPRESSION_FORBIDDEN_PHRASES) expect(text.includes(p), p).toBe(false)
    expect(findForbiddenPhrases(JSON.parse(RAW_DIMS_TEXT))).toEqual([])
    expect(findForbiddenPhrases(JSON.parse(RAW_BRIDGE_TEXT))).toEqual([])
  })

  it("금지 목록이 계약서 예시를 포함한다", () => {
    for (const p of ["과학적으로 입증", "검증된 상관", "MBTI가 사주를 바꾼"]) expect(EXPRESSION_FORBIDDEN_PHRASES).toContain(p)
  })

  it("엔진이 만드는 모든 기록 문구(note)에 금지 표현이 없다 — 상충·시주 모름·설문 없음 경우까지", () => {
    const c = computeChart({ ...BASE, time: null })
    const a = analysisOf(c)
    const self: SelfReport = {
      mbti: mbti("IxxP"),
      facts: facts([{ questionId: "workStyle", values: ["people_facing"] }, { questionId: "occupationStatus", values: ["self_employed"] }, { questionId: "selfWeakness", values: ["saving"] }]),
    }
    for (const s of [undefined, self, { facts: [] }, { mbti: mbti("ENTJ"), facts: [] }]) {
      expect(findForbiddenPhrases(buildExpressionReport(inputOf(c, a, s)))).toEqual([])
    }
  }, 60_000)
})

// ─────────────────────────────────────────── 경계

describe("경계", () => {
  it("시주 모름: 세 기둥만으로 읽고 missing·hourStable을 남긴다", () => {
    const c = computeChart({ ...BASE, time: null })
    const r = buildExpressionReport(inputOf(c, analysisOf(c)))
    expect(r.conflicts.some((k) => k.kind === "missing" && k.note === "태어난 시각을 몰라 시주 없이 세 기둥으로 잠재력을 읽음")).toBe(true)
    expect(allStrings(r.innate).some((s) => s.startsWith("hour."))).toBe(false)
    for (const p of r.innate) {
      expect(p.hourStable!.levels.length).toBeGreaterThan(0)
      const varies = p.hourStable!.stable < 12
      expect(r.conflicts.some((k) => k.dimensionId === p.dimensionId && k.kind === "chart-uncertain" && k.note.includes(`(${p.hourStable!.stable}/12)`))).toBe(varies)
    }
  }, 60_000)

  it("설문 없음: 모든 차원 unknown, 사주 쪽(innateEssence·archetype)만 채워진다", () => {
    const a = analysisOf(CHART)
    const r = buildExpressionReport(inputOf(CHART, a))
    expect(r.readings.every((x) => x.status === "unknown" && x.self.signal === "none" && x.self.from.length === 0)).toBe(true)
    expect(r.conflicts.some((k) => k.kind === "missing" && k.note.startsWith("자기보고(MBTI·설문)가 없어"))).toBe(true)
    expect(r.sections.expressedNow).toEqual([])
    expect(r.sections.developedAbility).toEqual([])
    expect(r.sections.untappedPotential).toEqual([])
    expect(r.sections.innateEssence.length).toBeGreaterThan(0)
    expect(r.archetype.id).toBe(analyzeArchetype(a, CHART).id)
    expect(r.sections.archetype[0]).toBe(`archetype:${r.archetype.id}`)
    expect(r.styleHints).toEqual([])
    expect(unresolvedSectionIds(r)).toEqual([])
  })

  it("innateEssence 대표 기질은 같은 근거 위치를 공유하지 않는다(§7.8)", () => {
    const r = buildExpressionReport({ analysis: analyzeRules(HAND(true)), archetype: { id: "baekho" } })
    const pos = r.sections.innateEssence
      .filter((x) => x.startsWith("potential:"))
      .map((x) => r.innate.find((p) => `potential:${p.dimensionId}` === x)!.basis.flatMap((b) => b.positions))
    const all = pos.flat()
    expect(new Set(all).size).toBe(all.length)
    expect(r.sections.innateEssence[0]).toBe("potential:duty") // strong · 핵심 먼저
  })

  it("MBTI만: 신호는 한 단계 약하게(확신 없음 축은 신호 없음), missing 기록", () => {
    const a = analysisOf(CHART)
    const sure = buildExpressionReport(inputOf(CHART, a, { mbti: mbti("ESTJ"), facts: [] }))
    const unsure = buildExpressionReport(inputOf(CHART, a, { mbti: mbti("estj"), facts: [] }))
    expect(readingOf(sure, "outward").self).toEqual({ signal: "high", from: ["mbti:EI"], mbtiOnly: true })
    expect(readingOf(sure, "expression").self).toEqual({ signal: "none", from: ["mbti:EI"], mbtiOnly: true }) // B 0.5 × 0.5
    expect(unsure.readings.every((x) => x.self.signal === "none")).toBe(true)
    expect(sure.conflicts.some((k) => k.kind === "missing" && k.note.includes("한 단계 약하게"))).toBe(true)
  })

  it("사실만: MBTI 없음 기록, mbtiOnly 없음", () => {
    const a = analysisOf(CHART)
    const fs = facts([{ questionId: "workStyle", values: ["leading"] }, { questionId: "selfStrength", values: ["planning", "learning"] }])
    const r = buildExpressionReport(inputOf(CHART, a, { facts: fs }))
    expect(r.conflicts.some((k) => k.note === "MBTI 응답 없음 — 설문 사실만으로 비교")).toBe(true)
    expect(r.readings.every((x) => !x.self.mbtiOnly)).toBe(true)
    expect(readingOf(r, "duty").self).toEqual({ signal: "high", from: ["fact:workStyle", "fact:selfStrength:planning"], mbtiOnly: false })
    expect(readingOf(r, "steadiness").self.from).toEqual(["fact:selfStrength:planning"])
    expect(["expressed", "developed"]).toContain(readingOf(r, "duty").status)
    expect(unresolvedSectionIds(r, { facts: fs })).toEqual([])
  })

  it("상충: MBTI와 경험이 반대면 경험을 따르고 self-vs-self, 사실끼리 상쇄되면 판정 보류", () => {
    const a = analysisOf(CHART)
    const fs = facts([
      { questionId: "selfStrength", values: ["planning"] }, // steadiness high
      { questionId: "occupationStatus", values: ["self_employed"] }, // realism high(상황)
      { questionId: "selfWeakness", values: ["saving"] }, // realism low(기질)
    ])
    const self: SelfReport = { mbti: mbti("ISTP"), facts: fs } // P(sure) → steadiness low
    const r = buildExpressionReport(inputOf(CHART, a, self))
    expect(readingOf(r, "steadiness").self.signal).toBe("high")
    expect(r.conflicts).toContainEqual({ dimensionId: "steadiness", kind: "self-vs-self", note: "MBTI 자기보고와 설문 경험이 반대 방향 — 경험 쪽을 따름" })
    const re = readingOf(r, "realism")
    // 사실 +1 −1 = 0, MBTI S(B 0.5)는 사실이 0이라 반대 방향이 아님 → 0 + 0.5 = 0.5 → high
    expect(re.self.from).toEqual(["fact:occupationStatus", "fact:selfWeakness:saving", "mbti:SN"])
    expect(re.self.signal).toBe("high")
    expect(r.conflicts).toContainEqual({ dimensionId: "realism", kind: "self-vs-self", note: "설문 답끼리 방향이 엇갈림 — 합산해 판정" })
    const r2 = buildExpressionReport(inputOf(CHART, a, { facts: fs }))
    expect(readingOf(r2, "realism").self.signal).toBe("none")
    expect(readingOf(r2, "realism").status).toBe("unknown")
    expect(r2.conflicts).toContainEqual({ dimensionId: "realism", kind: "missing", note: "자기보고가 약하거나 서로 상쇄되어 판정 보류" })
    expect(r.sections.gap.length).toBeGreaterThan(0)
    expect(unresolvedSectionIds(r, self)).toEqual([])
  })

  it("MBTI 일부 축만: 응답한 축만 쓰고 기록한다", () => {
    const a = analysisOf(CHART)
    const r = buildExpressionReport(inputOf(CHART, a, { mbti: mbti("IxxJ"), facts: [] }))
    expect(r.conflicts.some((k) => k.note.startsWith("MBTI 2개 축만 응답"))).toBe(true)
    expect(r.readings.flatMap((x) => x.self.from).every((s) => s === "mbti:EI" || s === "mbti:JP")).toBe(true)
  })

  it("개운: pickGaeun 범주 집합은 그대로, 순서만 상태에 따라 바뀐다", () => {
    const a = analysisOf(CHART)
    const basis = buildGaeunBasis(a)!
    expect(basis).toBeTruthy()
    const daeun = currentDaeun(CHART)!
    const slots = [luckGlyphsOf(a, { slot: "daeun", ...daeun }), luckGlyphsOf(a, { slot: "seun", year: NOW_YEAR })].filter((x): x is LuckGlyphFacts => !!x)
    const ref = [...new Set(pickGaeun({ basis, dayElement: a.dayMaster.element, hourKnown: true, luck: slots }).map((p) => p.id))]
    for (const s of ["ESTJ", "INFP"]) {
      const r = buildExpressionReport(inputOf(CHART, a, { mbti: mbti(s), facts: [] }))
      expect([...r.gaeun].sort()).toEqual([...ref].sort())
      expect(r.gaeun.every((id) => GAEUN_CATEGORY_IDS.includes(id))).toBe(true)
    }
  })

  it("개운: 바꾸고 싶은 것(changeWish)이 닿는 범주가 앞으로 오고 근거에 그 사실 id가 붙는다", () => {
    const a = analysisOf(CHART)
    const r0 = buildExpressionReport(inputOf(CHART, a))
    const touched = r0.gaeun.filter((id) => /^GA\.(fill|ease)\.jaeseong$/.test(id))
    const fs = facts([{ questionId: "changeWish", values: ["money_stability"] }])
    const r = buildExpressionReport(inputOf(CHART, a, { facts: fs }))
    if (touched.length) {
      expect(r.sections.gaeun).toContain("fact:changeWish")
      expect(r.gaeun.indexOf(touched[0])).toBeLessThanOrEqual(r0.gaeun.indexOf(touched[0]))
    }
    expect([...r.gaeun].sort()).toEqual([...r0.gaeun].sort())
  })

  it("대운 번호가 범위 밖이면 대운 전략 없이 missing, 운 정보가 없으면 luck 비어 있음", () => {
    const a = analysisOf(CHART)
    const r = buildExpressionReport({ analysis: a, luck: { daeun: { luckIndex: 99, daeunIndex: 100 } } })
    expect(r.luck.every((l) => l.scope === "seun")).toBe(true)
    expect(r.conflicts.some((k) => k.note.startsWith("지금 대운 글자가"))).toBe(true)
    const r2 = buildExpressionReport({ analysis: analyzeRules(CHART) })
    expect(r2.luck).toEqual([])
    expect(r2.sections.luckStrategy).toEqual([])
  })

  it("잘못된 analysis는 EngineInputError", () => {
    expect(() => buildExpressionReport({ analysis: {} as RuleAnalysis })).toThrow(/analyzeRules/)
  })
})
