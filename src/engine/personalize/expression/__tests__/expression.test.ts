// 사주 발현 분석 엔진(expression@0.2.0) 시험 — 계약 docs/redesign/30-expression-engine.md §7 필수 시험 7개 + 경계
// + 연구소장 expression-dimensions.md @0.2.0 §4 손계산 대조(grain 두 판) + §8 요청(죽은 MBTI 줄 0·low 0·운 grain/flux)
// + 품질검증 2026-11-28 B2(금지어 변형)·S1(자기보고 모양)·S2·S3·S5·S6.
// 외부 호출 없음. 원국은 computeChart → analyzeRules로 만든다(엔진 코드는 읽기만).
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { EngineInputError, analyzeArchetype, analyzeRules, computeChart, yearPillarOf, type BirthInput, type CalendarResult, type Pillar, type RuleAnalysis } from "../../.."
import { GAEUN_CATEGORY_IDS, buildGaeunBasis, luckGlyphsOf, pickGaeun } from "../../../content/gaeun"
import type { LuckGlyphFacts } from "../../../content/types"
import { tenGodOfStem } from "../../../rules"
import { linkFactToChart } from "../../lived-link"
import { SURVEY_QUESTIONS } from "../../survey"
import type { SurveyAnswer, UserFact } from "../../types"
import { answersToUserFacts } from "../../user-facts"
import {
  EXPRESSION_ENGINE_VERSION, EXPRESSION_FORBIDDEN_PHRASES, EXPRESSION_SECTION_IDS, ExpressionTableError, LIVED_LINK_GROUP, MBTI_SIGNAL_LINKS,
  buildExpressionReport, expressionTables, findForbiddenPhrases, forbiddenHitsOf, makeExpressionTables, mbtiFromUserFacts, parseMbtiInput,
  potentialsOf, selfReportFromUserFacts, type ExpressionInput, type ExpressionReport, type ExpressionStatus, type ExpressionTables,
  type GroupRuleParams, type MbtiAxisReport, type SelfReport,
} from ".."

const ROOT = resolve(__dirname, "../../../../..")
const RAW_DIMS_TEXT = readFileSync(resolve(ROOT, "content/expression/dimensions.json"), "utf8")
const RAW_BRIDGE_TEXT = readFileSync(resolve(ROOT, "content/expression/mbti-bridge.json"), "utf8")
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
const NOW_YEAR = 2026
const r6 = (x: number): number => Math.round(x * 1e6) / 1e6

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
/** 설문 경로와 같은 id 규칙으로 사실 하나를 만든다(시험용) */
function fact(questionId: string, value: string): UserFact {
  const multi = ["selfStrength", "selfWeakness", "concernTopic"].includes(questionId)
  const ev = ["lifeEvents", "recentChanges"].includes(questionId)
  return {
    source: "user",
    id: ev ? `${questionId === "lifeEvents" ? "life_event" : "recent_change"}:${value}` : multi ? `${questionId}:${value}` : questionId,
    topic: questionId,
    value,
    label: `라벨_${value}`,
    questionId: questionId as UserFact["questionId"],
    useAs: "background-only",
    selfReported: true,
  }
}
const readingOf = (r: ExpressionReport, d: string) => r.readings.find((x) => x.dimensionId === d)!
const potOf = (r: ExpressionReport, d: string) => r.innate.find((x) => x.dimensionId === d)!
const levelOf = (r: ExpressionReport, d: string) => potOf(r, d).level
const strategyIdOf = (T: ExpressionTables, dim: string, st: ExpressionStatus, mode: "activate" | "press"): string =>
  T.dims.strategies.overrides[dim]?.[mode]?.[st] ?? T.dims.strategies.matrix[st][mode]

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
/** 축마다 {극1 확신, 극1 미확신, 극2 확신, 극2 미확신, 모름} → 625조합 */
function allMbtiCombos(): MbtiAxisReport[][] {
  const per = (["EI", "SN", "TF", "JP"] as const).map((ax) => {
    const [p1, p2] = ax.split("")
    return [{ axis: ax, pole: p1, sure: true }, { axis: ax, pole: p1, sure: false }, { axis: ax, pole: p2, sure: true }, { axis: ax, pole: p2, sure: false }, null]
  })
  const out: MbtiAxisReport[][] = []
  for (const a of per[0]) for (const b of per[1]) for (const c of per[2]) for (const d of per[3])
    out.push([a, b, c, d].filter((x): x is MbtiAxisReport => !!x))
  return out
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
/** 임의 기둥 원국(analyzeRules는 pillars·engineVersion만 읽는다) */
const CUSTOM = (y: string, m: string, d: string, h: string | null): CalendarResult => ({
  ...CHART,
  hourKnown: h !== null,
  pillars: { year: pil(y), month: pil(m), day: pil(d), hour: h ? pil(h) : null },
})
// 연구소장 §4 손계산 원국: 연 甲子 · 월 丙寅 · 일 戊辰 · 시 庚申
const HAND = (hour: boolean): CalendarResult => CUSTOM("甲子", "丙寅", "戊辰", hour ? "庚申" : null)
const OPTS_FAST = { tableCheck: false } as const

// ─────────────────────────────────────────── 표

describe("표(데이터)", () => {
  it("동봉 표: 8개 차원(grain 하나)·designed·service-model·kr-monthly-30 고정, 판 번호", () => {
    const T = expressionTables()
    expect(T.dims.status).toBe("designed")
    expect(T.dims.version).toBe("0.3.0")
    expect(T.bridge.version).toBe("0.3.0")
    expect(T.dims.claim).toBe("service-model")
    expect(T.dims.hiddenStemTable).toBe("kr-monthly-30")
    expect(T.bridge.claim).toBe("service-model")
    expect(T.bridge.links.every((l) => l.claim === "service-model")).toBe(true)
    expect(T.dims.dimensions.map((d) => d.id)).toEqual(["drive", "expression", "realism", "duty", "learning", "grain", "flux", "outward"])
    expect(T.dims.dimensions.map((d) => d.kind)).toEqual(["core", "core", "core", "core", "core", "grain", "aux", "aux"])
    expect(T.dims.self).not.toHaveProperty("unsureFactor")
    expect(T.dims.self).not.toHaveProperty("mbtiOnlyFactor")
    expect(T.dims.self.developedEvidence).toEqual(["trait"])
    expect(T.hash).toMatch(/^fnv1a:[0-9a-f]{16}$/)
    expect(EXPRESSION_ENGINE_VERSION).toBe("expression@0.2.0")
  })

  it("MBTI 대응: 신호 줄은 E→outward·J→grain 고른 쪽·P→grain 센 쪽 세 줄뿐(low 없음·확신 전용), 문체 힌트 6개", () => {
    const { bridge } = expressionTables()
    expect(bridge.links.map((l) => `${l.axis}|${l.pole}|${l.dimensionId}|${l.direction}`).sort()).toEqual([...MBTI_SIGNAL_LINKS].sort())
    expect(bridge.links.every((l) => l.sureOnly === true)).toBe(true)
    expect(bridge.links.some((l) => (l.direction as string) === "low")).toBe(false)
    expect(bridge.links.some((l) => l.axis === "TF" || l.axis === "SN")).toBe(false)
    expect(bridge.styleHints.map((h) => `${h.pole}:${h.hint}`)).toEqual([
      "E:style.talkFirst", "I:style.writeFirst", "S:style.concreteFirst", "N:style.bigPictureFirst", "T:style.reasonFirst", "F:style.peopleFirst",
    ])
  })

  it("기질 답 대응은 lived-link 묶음(철자 변환)과 같다 — 연구소장 추가분(grain 고른 쪽·센 쪽)만 예외", () => {
    const { dims } = expressionTables()
    const coreOf = (g: string) => dims.dimensions.find((d) => d.rule === "exp.lv.group.v1" && (d.params as GroupRuleParams).group === g)?.id
    const ADDED = new Set(["selfStrength:planning|grain", "selfStrength:creativity|grain"])
    for (const d of dims.dimensions) {
      for (const f of d.facts) {
        const [questionId, value] = f.key.split(":")
        const fake = { source: "user", id: f.key, topic: questionId, value, label: "", questionId, useAs: "background-only", selfReported: true } as UserFact
        const g = linkFactToChart(fake, {}).group
        if (ADDED.has(`${f.key}|${d.id}`)) continue
        if (!g) continue // lived-link에 없는 추가분(decisiveness)
        expect(`${f.key}→${coreOf(LIVED_LINK_GROUP[g])}`).toBe(`${f.key}→${d.id}`)
      }
    }
    const grain = dims.dimensions.find((d) => d.id === "grain")!
    expect(grain.facts.map((f) => `${f.key}:${f.direction}`)).toEqual(["selfStrength:planning:steady", "selfStrength:creativity:edge"])
  })

  it("잘못된 표는 멈춘다", () => {
    const dims = JSON.parse(RAW_DIMS_TEXT)
    const bridge = JSON.parse(RAW_BRIDGE_TEXT)
    expect(() => makeExpressionTables(dims, bridge)).not.toThrow()
    const bad = (mut: (d: typeof dims, b: typeof bridge) => void): (() => unknown) => {
      const d = clone(dims)
      const b = clone(bridge)
      mut(d, b)
      return () => makeExpressionTables(d, b)
    }
    expect(bad((d) => { d.dimensions[0].rule = "exp.lv.nope" })).toThrow(ExpressionTableError)
    expect(bad((d) => { d.dimensions[1].facts[0].key = "workStyle:dancing" })).toThrow(/선택지/)
    expect(bad((_d, b) => { delete b.claim })).toThrow(/claim/)
    expect(bad((_d, b) => { delete b.links[0].claim })).toThrow(/행마다/)
    expect(bad((d) => { d.dimensions[0].facts.push({ key: "mbti:INTJ", direction: "high", weight: 1, evidence: "trait" }) })).toThrow(/MBTI/)
    expect(bad((_d, b) => { b.note = "사주와 MBTI는 검증된 상관이 있다" })).toThrow(/금지 표현/)
    expect(bad((_d, b) => { b.links.push({ dimensionId: "drive", axis: "TF", pole: "T", direction: "high", weight: 1, grade: "B", sureOnly: true, claim: "service-model" }) })).toThrow(/TF/)
    expect(bad((_d, b) => { b.links.push({ dimensionId: "expression", axis: "EI", pole: "I", direction: "low", weight: 1, grade: "B", sureOnly: true, claim: "service-model" }) })).toThrow(/low/)
    expect(bad((_d, b) => { b.links.push({ dimensionId: "expression", axis: "EI", pole: "E", direction: "high", weight: 0.5, grade: "B", sureOnly: true, claim: "service-model" }) })).toThrow(/허용된 신호 줄/)
    expect(bad((_d, b) => { b.links[0].sureOnly = false })).toThrow(/sureOnly/)
    expect(bad((_d, b) => { b.styleHints.push({ axis: "EI", pole: "E", hint: "style.again" }) })).toThrow(/중복/)
    expect(bad((d) => { d.dimensions[2].facts.push({ key: "occupationStatus:self_employed", direction: "high", weight: 1, evidence: "trait" }) })).toThrow(/상황 사실/)
    expect(bad((d) => { d.dimensions[0].params.group = "bigeop" })).toThrow(/rules 철자/)
    // 0.2.0: 폐지 필드·developedEvidence 고정(QA S2)·grain 사실 방향
    expect(bad((d) => { d.self.unsureFactor = 0.5 })).toThrow(/폐지/)
    expect(bad((d) => { d.self.mbtiOnlyFactor = 0.5 })).toThrow(/폐지/)
    expect(bad((d) => { d.self.developedEvidence = ["trait", "situation"] })).toThrow(/developedEvidence/)
    expect(bad((d) => { d.self.developedEvidence = ["situation"] })).toThrow(/developedEvidence/)
    expect(bad((d) => { d.dimensions[5].facts[0].direction = "high" })).toThrow(/grain 사실 direction/)
    expect(bad((d) => { d.dimensions[5].params.edge.push("정재") })).toThrow(/steady와 edge/)
    expect(bad((d) => { d.dimensions[5].params.strongGap = 0.05 })).toThrow(/balancedGap/)
    expect(bad((d) => { d.strategies.overrides.grain.press.expressed = "exp.st.nope" })).toThrow(/overrides/)
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
  it("시주 있음: 8개 차원 단계·표지·경계 차단 + grain q=0.394366 → 센 쪽 moderate → 청탁(효신탈식) 승격 strong", () => {
    const r = buildExpressionReport({ analysis: analyzeRules(HAND(true)) })
    const got = Object.fromEntries(r.innate.map((p) => [p.dimensionId, p.level]))
    expect(got).toEqual({
      drive: "moderate", expression: "moderate", realism: "moderate", duty: "strong", learning: "moderate",
      grain: "strong", flux: "strong", outward: "strong",
    })
    expect(potOf(r, "drive").flags).toContain("latent")
    expect(potOf(r, "realism").flags).toContain("latent")
    expect(potOf(r, "drive").basis[0].ruleId).toBe("exp.lv.hiddenOnly")
    expect(potOf(r, "duty").basis[0].ruleId).toBe("exp.lv.rooted")
    expect(potOf(r, "duty").flags).toContain("month")
    expect(potOf(r, "duty").basis[0].positions).toEqual(["year.stem", "month.branch.jeonggi", "day.branch.yeogi"])
    // 모형 A r≈0.4317, 경계 0.45 근처 → drive 보정 없음, duty 부담 메모 없음
    expect(r.sensitivity.boundary.nearBoundary).toBe(true)
    expect(r.sensitivity.boundary.blocked).toBe(true)
    expect(potOf(r, "drive").basis.map((b) => b.ruleId)).toContain("exp.sens.boundary")
    expect(potOf(r, "drive").basis.map((b) => b.ruleId)).not.toContain("exp.mod.drive.v1")
    expect(potOf(r, "duty").basis.map((b) => b.ruleId)).not.toContain("exp.note.load")
    expect(r.conflicts.some((k) => k.kind === "chart-uncertain" && k.note.startsWith("힘의 세기가 경계 근처"))).toBe(true)
    expect(potOf(r, "outward").basis[0].note).toContain("양 7/8")
    // grain: S = 정재 0.816667 + 정관 0.45 + 식신 1.533333 = 2.8, E = 편관 2.6 + 편인 1.7 = 4.3
    const g = potOf(r, "grain")
    expect(g.lean).toBe("edge")
    expect(g.basis[0].ruleId).toBe("exp.lv.grain.v1")
    expect(g.basis[0].note).toContain("고른 쪽 2.8 · 센 쪽 4.3")
    expect(g.basis[0].note).toContain("q=0.394366")
    expect(g.basis[0].note).toContain("기울기 0.105634")
    expect(g.basis[0].note).toContain("기운 쪽 천간 투출 있음")
    const cl = g.basis.find((b) => b.ruleId === "exp.mod.grain.clarity")!
    expect(cl.note).toBe("청탁 표지 효신탈식")
    expect([...cl.positions].sort()).toEqual(["hour.stem", "month.stem"])
  })

  it("시주 없음: expression·flux faint, grain q=0.227545 → 센 쪽 strong(승격 없이, 근거만 바뀜)", () => {
    const r = buildExpressionReport({ analysis: analyzeRules(HAND(false)) })
    const got = Object.fromEntries(r.innate.map((p) => [p.dimensionId, p.level]))
    expect(got).toEqual({
      drive: "moderate", expression: "faint", realism: "moderate", duty: "strong", learning: "moderate",
      grain: "strong", flux: "faint", outward: "strong",
    })
    expect(potOf(r, "expression").basis[0].ruleId).toBe("exp.lv.absent")
    const g = potOf(r, "grain")
    expect(g.lean).toBe("edge")
    expect(g.basis[0].note).toContain("q=0.227545")
    expect(g.basis[0].note).toContain("기울기 0.272455")
    expect(g.basis.some((b) => b.ruleId === "exp.mod.grain.clarity")).toBe(false)
    for (const p of r.innate) expect(p.hourStable?.of).toBe(12)
    expect(g.hourStable!.leans!.length).toBeGreaterThan(0)
    // 시주 모름 → flux는 대표 기질에서 빠진다(§7.1-2)
    expect(r.sections.innateEssence).not.toContain("potential:flux")
  }, 60_000)

  it("strengthPrimary를 바꿔도·입력 표가 cn이어도 차원 단계는 같다(모형 A·kr 표 고정)", () => {
    const c = HAND(true)
    const base = potentialsOf(analyzeRules(c), expressionTables().dims).map((p) => [p.level, p.lean])
    expect(potentialsOf(analyzeRules(c, { strengthPrimary: "rooted" }), expressionTables().dims).map((p) => [p.level, p.lean])).toEqual(base)
    const viaCn = buildExpressionReport({ analysis: analyzeRules(c, { hiddenStemTable: "cn-lunarjs" }), archetype: { id: "baekho" } })
    expect(viaCn.innate.map((p) => [p.level, p.lean])).toEqual(base)
  })
})

describe("grain 판정 = 연구소장 §3.7.2 식", () => {
  it("무작위 원국 300건: 시험 안에서 다시 계산한 q·d·lean·level과 같고, strong 고른 쪽·strong 센 쪽·청탁 승격·balanced·moderate가 모두 나온다", () => {
    const STEADY = ["정재", "정관", "정인", "식신"]
    const EDGE = ["편관", "상관", "편인", "겁재"]
    const { dims } = expressionTables()
    const rnd = mulberry32(3700)
    const seen = { strongSteady: 0, strongEdge: 0, clarity: 0, balanced: 0, thin: 0, moderate: 0 }
    for (let n = 0; n < 300; n++) {
      const c = randomChart(rnd, 0.8)
      const a = analyzeRules(c)
      const A = a.strength.models.find((m) => m.model === "weighted")!
      const tg: Record<string, number> = {}
      for (const b of A.basis) {
        if (b.group === "self") continue
        const t = tenGodOfStem(a.dayMaster.stem, b.char)
        tg[t] = (tg[t] ?? 0) + b.points
      }
      for (const k of Object.keys(tg)) tg[k] = r6(tg[k])
      const S = r6(STEADY.reduce((x, t) => x + (tg[t] ?? 0), 0))
      const E = r6(EDGE.reduce((x, t) => x + (tg[t] ?? 0), 0))
      const g = potentialsOf(a, dims).find((p) => p.dimensionId === "grain")!
      let want: { level: string; lean: string }
      if (r6((S + E) / A.total!) < 0.3) {
        want = { level: "faint", lean: "balanced" }
        seen.thin++
        expect(g.basis[0].ruleId).toBe("exp.lv.grain.thin")
      } else {
        const q = r6(S / (S + E))
        const d = r6(Math.abs(q - 0.5))
        const lean = d < 0.07 ? "balanced" : q > 0.5 ? "steady" : "edge"
        const set = lean === "steady" ? STEADY : EDGE
        const shown = a.tenGods.some((h) => ["year", "month", "hour"].includes(h.position.pillar) && h.position.part === "stem" && !h.viaHiddenStem && set.includes(h.tenGod))
        let level = lean === "balanced" ? "faint" : d >= 0.2 && shown ? "strong" : "moderate"
        if (lean === "edge" && level === "moderate" && (a.qiFlow?.clarityFlags ?? []).some((f) => ["상관견관", "효신탈식", "관살혼잡"].includes(f.flag))) {
          level = "strong"
          seen.clarity++
        } else if (level === "strong") seen[lean === "steady" ? "strongSteady" : "strongEdge"]++
        if (lean === "balanced") seen.balanced++
        if (level === "moderate") seen.moderate++
        want = { level, lean }
        expect(g.basis[0].note).toContain(`q=${q}`)
      }
      expect({ level: g.level, lean: g.lean }).toEqual(want)
      expect(g.level === "faint").toBe(g.lean === "balanced")
    }
    console.log("[grain 300건]", JSON.stringify(seen))
    expect(seen.strongSteady).toBeGreaterThan(0)
    expect(seen.strongEdge).toBeGreaterThan(0)
    expect(seen.clarity).toBeGreaterThan(0)
    expect(seen.balanced).toBeGreaterThan(0)
    expect(seen.moderate).toBeGreaterThan(0)
  }, 120_000)
})

// ─────────────────────────────────────────── MBTI·자기보고 입력

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

  it("QA S3: 소문자는 모든 입력 경로에서 '확신 없음' — 문자열·객체·축 배열 결과가 같다", () => {
    expect(parseMbtiInput("eSTJ").axes[0]).toEqual({ axis: "EI", pole: "E", sure: false })
    expect(parseMbtiInput({ EI: "e" }).axes[0]).toEqual({ axis: "EI", pole: "E", sure: false })
    expect(parseMbtiInput({ EI: "e?" }).axes[0]).toEqual({ axis: "EI", pole: "E", sure: false })
    const a = analyzeRules(HAND(true))
    const run = (m: MbtiAxisReport[]) => buildExpressionReport({ analysis: a, self: { mbti: m, facts: [] }, archetype: { id: "baekho" } }, OPTS_FAST)
    const viaString = run(parseMbtiInput("exxx").axes)
    const viaArrayLower = run([{ axis: "EI", pole: "e", sure: true }])
    const viaArrayFlag = run([{ axis: "EI", pole: "E", sure: false }])
    expect(viaArrayLower.readings).toEqual(viaArrayFlag.readings)
    expect(viaString.readings).toEqual(viaArrayFlag.readings)
    expect(readingOf(viaArrayLower, "outward").self).toEqual({ signal: "none", from: [], mbtiOnly: false }) // 확신 없음 → 신호 없음
    expect(viaArrayLower.styleHints).toEqual(["style.talkFirst"]) // 힌트에는 쓴다
  })

  it("T/F는 차원 신호가 아니다: ENTJ ↔ ENFJ는 readings가 같고 문체 힌트만 다르다", () => {
    const a = analysisOf(CHART)
    const r1 = buildExpressionReport(inputOf(CHART, a, { mbti: mbti("ENTJ"), facts: [] }))
    const r2 = buildExpressionReport(inputOf(CHART, a, { mbti: mbti("ENFJ"), facts: [] }))
    expect(r2.readings).toEqual(r1.readings)
    expect(r2.luck).toEqual(r1.luck)
    expect(r1.styleHints).toEqual(["style.talkFirst", "style.bigPictureFirst", "style.reasonFirst"])
    expect(r2.styleHints).toEqual(["style.talkFirst", "style.bigPictureFirst", "style.peopleFirst"])
    expect(allStrings(r1.readings).some((s) => s === "mbti:TF" || s === "mbti:SN")).toBe(false)
  })

  it("QA S1·S5: 모양이 틀린 자기보고는 EngineInputError(조용히 무시하지 않음)", () => {
    const a = analyzeRules(HAND(true))
    const run = (self: unknown) => () => buildExpressionReport({ analysis: a, self: self as SelfReport, archetype: { id: "baekho" } }, OPTS_FAST)
    const ok = fact("selfStrength", "planning")
    for (const self of [
      { facts: 5 },
      { facts: "abc" },
      { facts: [], mbti: "ESTJ" },
      { facts: [null] },
      { facts: [{ ...ok, id: "자유 입력 문장" }] },
      { facts: [{ ...ok, id: "selfStrength:Planning!" }] },
      { facts: [{ ...ok, value: 3 }] },
      { facts: [], mbti: [{ axis: "XY", pole: "E", sure: true }] },
      { facts: [], mbti: [{ axis: "EI", pole: "Q", sure: true }] },
      { facts: [], mbti: [{ axis: "EI", pole: "E", sure: "yes" }] },
      { facts: [], mbti: ["E"] },
      "ESTJ",
      [ok],
    ]) expect(run(self), JSON.stringify(self)).toThrow(EngineInputError)
    // 정상: source가 user가 아닌 사실은 오류 없이 세지 않는다, 같은 id 두 번은 첫 값만, facts 없음 허용
    expect(run({ facts: [{ ...ok, source: "chart" }] })).not.toThrow()
    expect(run({ facts: [ok, ok] })).not.toThrow()
    expect(run({ mbti: [{ axis: "EI", pole: "E", sure: true }] })).not.toThrow()
    // 메시지에 원문 값을 담지 않는다(개인정보)
    try {
      run({ facts: [{ ...ok, id: "비밀_ZQX 문장" }] })()
    } catch (e) {
      expect((e as Error).message.includes("ZQX")).toBe(false)
    }
  })
})

// ─────────────────────────────────────────── MBTI 신호(연구소장 §6.2·§8-3)

describe("MBTI 신호 줄 — 죽은 줄 0, low 0, 확신 없음 효과 0, 힌트 6개", () => {
  const rnd = mulberry32(42)
  const analyses = [HAND(true), ...Array.from({ length: 60 }, () => randomChart(rnd, 1))].map((c) => analyzeRules(c))

  it("대응표의 신호 줄마다 그 줄 하나로 판정(상태)이 바뀌는 입력이 존재하고, grain 줄은 반대 사실과 만나면 self-vs-self를 남긴다", () => {
    const { bridge, dims } = expressionTables()
    for (const l of bridge.links) {
      let changed = 0
      for (const a of analyses) {
        const base = buildExpressionReport({ analysis: a, archetype: { id: "baekho" } }, OPTS_FAST)
        const one = buildExpressionReport({ analysis: a, self: { mbti: [{ axis: l.axis, pole: l.pole, sure: true }], facts: [] }, archetype: { id: "baekho" } }, OPTS_FAST)
        if (readingOf(base, l.dimensionId).status !== readingOf(one, l.dimensionId).status) changed++
        if (changed) break
      }
      expect(changed, `${l.axis}|${l.pole}→${l.dimensionId}`).toBeGreaterThan(0)
      // (나) 사실과 반대일 때 상충 기록 — 그 차원에 반대 방향 기질 답이 있는 줄만
      const row = dims.dimensions.find((d) => d.id === l.dimensionId)!
      const opposite = row.facts.find((f) => f.direction !== l.direction && (l.direction === "high" ? f.direction === "low" : true))
      if (!opposite) continue
      const [q, v] = opposite.key.split(":")
      const r = buildExpressionReport({ analysis: analyses[0], self: { mbti: [{ axis: l.axis, pole: l.pole, sure: true }], facts: [fact(q, v)] }, archetype: { id: "baekho" } }, OPTS_FAST)
      expect(r.conflicts).toContainEqual({ dimensionId: l.dimensionId, kind: "self-vs-self", note: "MBTI 자기보고와 설문 경험이 반대 방향 — 경험 쪽을 따름" })
    }
  }, 120_000)

  it("625조합 × 원국 3개: 사실 없이 MBTI만이면 low 신호 0, 신호가 생기는 차원은 outward·grain뿐, 확신 없는 축을 빼도 readings가 같다", () => {
    const combos = allMbtiCombos()
    expect(combos).toHaveLength(625)
    for (const a of analyses.slice(0, 3)) {
      for (const m of combos) {
        const r = buildExpressionReport({ analysis: a, self: { mbti: m, facts: [] }, archetype: { id: "baekho" } }, OPTS_FAST)
        for (const x of r.readings) {
          expect(x.self.signal === "low", `${x.dimensionId} ${JSON.stringify(m)}`).toBe(false)
          if (x.self.from.length) expect(["outward", "grain"]).toContain(x.dimensionId)
          expect(["developed", "dormant", "quiet"]).not.toContain(x.status)
        }
        const sureOnly = buildExpressionReport({ analysis: a, self: { mbti: m.filter((y) => y.sure), facts: [] }, archetype: { id: "baekho" } }, OPTS_FAST)
        expect(r.readings).toEqual(sureOnly.readings)
      }
    }
  }, 300_000)

  it("사실이 있을 때도 MBTI는 low를 만들지 않는다: MBTI를 더해 low가 되면 사실만으로도 low", () => {
    const TRAIT: [string, string][] = [
      ["selfStrength", "persistence"], ["selfStrength", "communication"], ["selfStrength", "planning"], ["selfStrength", "creativity"],
      ["selfStrength", "caring"], ["selfStrength", "decisiveness"], ["selfStrength", "learning"], ["workStyle", "solo_deep"],
      ["workStyle", "people_facing"], ["workStyle", "leading"], ["selfWeakness", "saving"], ["occupationStatus", "self_employed"],
    ]
    const sets: UserFact[][] = []
    for (let i = 0; i < TRAIT.length; i++) {
      sets.push([fact(...TRAIT[i])])
      for (let j = i + 1; j < TRAIT.length; j++) if (TRAIT[i][0] !== TRAIT[j][0] || TRAIT[i][0] === "selfStrength") sets.push([fact(...TRAIT[i]), fact(...TRAIT[j])])
    }
    let lows = 0
    for (const a of analyses.slice(0, 2)) {
      for (const fs of sets) {
        const r0 = buildExpressionReport({ analysis: a, self: { facts: fs }, archetype: { id: "baekho" } }, OPTS_FAST)
        for (const t of ["ESTJ", "INFP", "ESFP", "INTJ", "ENFP"]) {
          const r = buildExpressionReport({ analysis: a, self: { mbti: mbti(t), facts: fs }, archetype: { id: "baekho" } }, OPTS_FAST)
          r.readings.forEach((x, k) => {
            if (x.self.signal !== "low") return
            lows++
            expect(r0.readings[k].self.signal, `${x.dimensionId} ${t} ${fs.map((f) => f.id)}`).toBe("low")
          })
        }
      }
    }
    expect(lows).toBeGreaterThan(0) // 사실로 low가 실제로 나오는 경로를 지났다
  }, 300_000)

  it("문체 힌트 6개는 확신 없는 답에서도 모두 출력되고, 판정(readings·luck)은 바꾸지 않는다", () => {
    const { bridge } = expressionTables()
    const a = analysisOf(CHART)
    const base = buildExpressionReport(inputOf(CHART, a, { facts: [] }))
    for (const h of bridge.styleHints) {
      const r = buildExpressionReport(inputOf(CHART, a, { mbti: [{ axis: h.axis, pole: h.pole, sure: false }], facts: [] }))
      expect(r.styleHints).toEqual([h.hint])
      expect(r.readings).toEqual(base.readings)
      expect(r.luck).toEqual(base.luck)
    }
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
    expect(readingOf(r1, "outward").self).toEqual({ signal: "high", from: ["mbti:EI"], mbtiOnly: true }) // E 확신 → 명시 규칙
    expect(readingOf(r2, "outward").self).toEqual({ signal: "none", from: [], mbtiOnly: false }) // I는 힌트만
    expect(readingOf(r1, "grain").self.lean).toBe("steady") // J
    expect(readingOf(r2, "grain").self.lean).toBe("edge") // P
  })

  it("여러 원국 × 세운 12년: luck.strategy가 달라지는 경우가 있고, 전략 id는 늘 그 차원 상태(+차원 예외)에서 나온다", () => {
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
              expect(l.strategy).toContain(`${strategyIdOf(T, t.dimensionId, st, t.mode)}:${t.dimensionId}`)
            }
            if (l.tone !== "neutral") expect(l.strategy).toContain(T.dims.strategies.tone[l.tone])
            if (r.sensitivity.boundary.blocked) expect(l.tone).toBe("neutral")
            expect(l.touches.some((t) => t.dimensionId === "outward")).toBe(false) // outward는 운이 건드리지 않음
            const gLean = potOf(r, "grain").lean
            for (const t of l.touches.filter((x) => x.dimensionId === "grain")) {
              if (gLean === "balanced") expect(t.mode).toBe("activate")
              else expect(["activate", "press"]).toContain(t.mode)
            }
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
    expect(readingOf(ra, "expression").self.from).toEqual(["fact:workStyle"]) // 0.2.0: E는 expression 신호가 아님(힌트 talkFirst)
  })
})

describe("§7-3·4·5 무작위 원국·자기보고", () => {
  it("inferred 항상 true, basis 비지 않음, 사실 id ⊆ 입력, 사실 내용 복사 없음, MBTI만이면 developed·low 없음, 시주 모름 보류 규칙, 근거 id 해석 가능", () => {
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
          expect(r.readings.some((x) => x.self.signal === "low")).toBe(false)
        }
        for (const x of r.readings) {
          if (x.status !== "developed") continue
          const row = T.dims.dimensions.find((d) => d.id === x.dimensionId)!
          const traitKeys = new Set(row.facts.filter((f) => f.direction === "high" || (!!x.self.lean && f.direction === x.self.lean)).map((f) => f.key))
          expect(fs.some((f) => traitKeys.has(`${f.questionId}:${f.value}`) && x.self.from.includes(`fact:${f.id}`))).toBe(true)
        }
        // 결정 6: 시주 모름이면 dormant·developed는 hourStable ≥ 8/12일 때만
        if (!c.hourKnown)
          for (const x of r.readings)
            if (x.status === "dormant" || x.status === "developed") expect(x.chart.hourStable!.stable).toBeGreaterThanOrEqual(8)

        // QA S6: gap에는 차원에 걸린 기록만
        for (const id of r.sections.gap) {
          const mm = /^conflict:(\d+)$/.exec(id)
          if (mm) expect(r.conflicts[Number(mm[1])].dimensionId, id).toBeDefined()
        }

        expect(unresolvedSectionIds(r, self)).toEqual([])
        expect(findForbiddenPhrases(r)).toEqual([])
      }
    }
    expect(mbtiOnlyRuns).toBeGreaterThan(10)
  }, 180_000)

  it("§7-5 16유형 × 확신 없음까지: MBTI만이면 developed가 한 번도 없고, 같은 방향 기질 답 1개를 더하면 developed가 된다", () => {
    const rnd = mulberry32(7)
    const T = expressionTables()
    const types = ["E", "I"].flatMap((a) => ["S", "N"].flatMap((b) => ["T", "F"].flatMap((c) => ["J", "P"].map((d) => a + b + c + d))))
    let blocked = 0
    let developedWithFact = 0
    let used = 0
    // MBTI만으로 신호가 나올 수 있는 차원은 outward(E)·grain(J·P)뿐 — 처음 10개 원국은 무조건, 그 뒤로는 둘 중 하나가 faint인 원국만 본다
    for (let n = 0; n < 400 && (used < 10 || developedWithFact === 0); n++) {
      const c = randomChart(rnd, 1)
      const a = analysisOf(c)
      const lv = potentialsOf(a, T.dims)
      if (used >= 10 && !lv.some((p) => (p.dimensionId === "grain" || p.dimensionId === "outward") && p.level === "faint")) continue
      used++
      const archId = analyzeArchetype(a, c).id
      for (const t of types) {
        for (const form of [t, t.toLowerCase()]) {
          const self: SelfReport = { mbti: mbti(form), facts: [] }
          const r = buildExpressionReport(inputOf(c, a, self, NOW_YEAR, archId))
          expect(r.readings.some((x) => x.status === "developed")).toBe(false)
          if (form !== t) expect(r.readings.every((x) => x.self.from.length === 0)).toBe(true) // 확신 없음 → 신호 없음
          for (const x of r.readings) {
            expect(x.self.mbtiOnly || x.self.from.length === 0).toBe(true)
            if (x.chart.level !== "faint" || x.self.signal !== "high") continue
            blocked++
            expect(x.status).toBe("unknown")
            expect(r.conflicts.filter((k) => k.dimensionId === x.dimensionId).map((k) => k.kind)).toEqual(expect.arrayContaining(["chart-vs-self", "missing"]))
            const row = T.dims.dimensions.find((d) => d.id === x.dimensionId)!
            const link = row.facts.find((f) => f.direction === (x.self.lean ?? "high"))
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
    expect(r3.innate.map((p) => [p.level, p.lean])).toEqual(r1.innate.map((p) => [p.level, p.lean]))
    expect(r3.innate.every((p) => p.hourStable === undefined)).toBe(true)
    expect(r1.innate.every((p) => p.hourStable && p.hourStable.stable >= 0 && p.hourStable.stable <= 12)).toBe(true)
    expect(potOf(r1, "grain").hourStable!.leans).toBeDefined()
    expect(potOf(r1, "drive").hourStable!.leans).toBeUndefined()
  }, 60_000)
})

describe("§7-7 금지 표현(QA B2 — 변형까지)", () => {
  it("데이터 파일 원문에 금지 표현이 없다", () => {
    for (const text of [RAW_DIMS_TEXT, RAW_BRIDGE_TEXT]) for (const p of EXPRESSION_FORBIDDEN_PHRASES) expect(text.includes(p), p).toBe(false)
    expect(findForbiddenPhrases(JSON.parse(RAW_DIMS_TEXT))).toEqual([])
    expect(findForbiddenPhrases(JSON.parse(RAW_BRIDGE_TEXT))).toEqual([])
  })

  it("금지 목록이 계약서 예시를 포함한다", () => {
    for (const p of ["과학적으로 입증", "검증된 상관", "MBTI가 사주를 바꾼"]) expect(EXPRESSION_FORBIDDEN_PHRASES).toContain(p)
    for (const p of ["과학적으로 입증된 관계", "검증된 상관관계", "MBTI가 사주를 바꾼다"]) expect(forbiddenHitsOf(p).length, p).toBeGreaterThan(0)
  })

  it("QA가 통과시킨 변형 18개가 모두 걸리고(표 검증도 멈춤), 정상 문구는 걸리지 않는다", () => {
    const VARIANTS = [
      "검증된상관", "검증된  상관", "검증 된 상관", "상관관계가 검증되었다", "상관관계가 입증되었다", "과학적 근거가 있다", "과학적으로 밝혀진",
      "통계적으로 유의", "연구 결과에 따르면", "논문에 따르면", "scientifically proven", "MBTI에 따라 사주가 달라진다", "MBTI가 사주를 바꿉니다",
      "MBTI 때문에 운이 바뀐다", "사주와 MBTI는 상관이 있다", "당신의 사주는 INTJ", "이 사주면 I일 것", "MBTI가 사주를 결정짓는다",
    ]
    expect(VARIANTS).toHaveLength(18)
    const bridge = JSON.parse(RAW_BRIDGE_TEXT)
    const dims = JSON.parse(RAW_DIMS_TEXT)
    for (const v of VARIANTS) {
      expect(forbiddenHitsOf(v), v).not.toEqual([])
      const b = clone(bridge)
      b.note = v
      expect(() => makeExpressionTables(dims, b), v).toThrow(ExpressionTableError)
    }
    // 연구소장 §6.3 다른 예시(사주→MBTI 맞히기·MBTI로 경험 단정·고정표)
    for (const v of ["당신의 사주는 ENFP형이다", "E라서 사주가 맞았다", "MBTI가 바뀌면 운이 바뀐다", "E니까 친구가 많았겠다", "J라서 직장에서 인정받았을 것이다", "INTJ = 庚금", "I라서 표현력이 없다", "사주가 MBTI를 결정한다", "통계적으로 입증된"]) {
      expect(forbiddenHitsOf(v), v).not.toEqual([])
    }
    const NORMAL = [
      "운명비서 자기이해 모델의 가설",
      "MBTI는 원국·운 계산에 들어가지 않는다",
      "MBTI는 지금 스스로 그렇게 느낀다는 자기보고로만 쓴다",
      "명리학 연구소장 검수 결과를 표로 옮김",
      "이 사주는 관살이 뚜렷하다",
      "사주에서 나온 경향과 본인이 말한 사실을 나눠 쓴다",
      "확신 없는 답은 조언 문체 힌트로만 쓴다",
      "상관견관·효신탈식·관살혼잡",
      "태어난 시각을 알면 달라질 수 있다",
      "주의사항에 유의하세요",
    ]
    for (const v of NORMAL) {
      expect(forbiddenHitsOf(v), v).toEqual([])
      const b = clone(bridge)
      b.note = v
      expect(() => makeExpressionTables(dims, b), v).not.toThrow()
    }
  })

  it("엔진이 만드는 모든 기록 문구(note)에 금지 표현이 없다 — 상충·시주 모름·설문 없음 경우까지", () => {
    const c = computeChart({ ...BASE, time: null })
    const a = analysisOf(c)
    const self: SelfReport = {
      mbti: mbti("IxxP"),
      facts: facts([{ questionId: "workStyle", values: ["people_facing"] }, { questionId: "occupationStatus", values: ["self_employed"] }, { questionId: "selfWeakness", values: ["saving"] }]),
    }
    for (const s of [undefined, self, { facts: [] }, { mbti: mbti("ENTJ"), facts: [] }, { mbti: mbti("ESFJ"), facts: [fact("selfStrength", "creativity")] }]) {
      expect(findForbiddenPhrases(buildExpressionReport(inputOf(c, a, s)))).toEqual([])
    }
  }, 60_000)
})

// ─────────────────────────────────────────── 운(§5.3·§5.4)

describe("운 — grain activate/press·exp.st.stretch, 세 글자 형은 세운 쪽 flux", () => {
  it("grain: 원국 결과 같은 쪽 운 글자면 activate, 반대쪽이면 press — 원국 결대로 쓰는 사람(expressed)의 press 전략은 exp.st.stretch", () => {
    // §4 원국(戊 일간, grain 센 쪽) + 세운 丙午: 丙 편인(센 쪽) → activate, 午 정인(고른 쪽) → press
    const a = analyzeRules(HAND(true), undefined, { year: pil("丙午") })
    const T = expressionTables()
    const r = buildExpressionReport({ analysis: a, self: { mbti: [{ axis: "JP", pole: "P", sure: true }], facts: [] }, luck: { seunYear: 2026 }, archetype: { id: "baekho" } }, OPTS_FAST)
    expect(potOf(r, "grain").lean).toBe("edge")
    expect(readingOf(r, "grain").status).toBe("expressed")
    const l = r.luck.find((x) => x.scope === "seun")!
    expect(l.touches.filter((t) => t.dimensionId === "grain")).toEqual([
      { dimensionId: "grain", mode: "activate", via: ["seun.stem"], ruleId: "exp.luck.activate" },
      { dimensionId: "grain", mode: "press", via: ["seun.branch"], ruleId: "exp.luck.press" },
    ])
    expect(l.strategy).toContain("exp.st.expand:grain")
    expect(l.strategy).toContain("exp.st.stretch:grain")
    expect(l.strategy).not.toContain("exp.st.pace:grain")
    expect(T.dims.strategies.catalog["exp.st.stretch"]).toBeTruthy()
    // 반대 결(J)을 MBTI만으로 느끼면 none + chart-vs-self, 전략은 observe
    const rj = buildExpressionReport({ analysis: a, self: { mbti: [{ axis: "JP", pole: "J", sure: true }], facts: [] }, luck: { seunYear: 2026 }, archetype: { id: "baekho" } }, OPTS_FAST)
    expect(readingOf(rj, "grain").self).toEqual({ signal: "none", from: ["mbti:JP"], lean: "steady", mbtiOnly: true })
    expect(readingOf(rj, "grain").status).toBe("unknown")
    expect(rj.conflicts).toContainEqual({ dimensionId: "grain", kind: "chart-vs-self", note: "본인은 반대 결로 느낀다는 자기보고(MBTI만) — 판정에 쓰지 않음" })
    expect(rj.luck[0].strategy).toContain("exp.st.observe:grain")
    // 반대 결을 기질 사실(planning)로 말하면 low → dormant
    const rf = buildExpressionReport({ analysis: a, self: { facts: [fact("selfStrength", "planning")] }, luck: { seunYear: 2026 }, archetype: { id: "baekho" } }, OPTS_FAST)
    expect(readingOf(rf, "grain").self).toEqual({ signal: "low", from: ["fact:selfStrength:planning"], lean: "steady", mbtiOnly: false })
    expect(readingOf(rf, "grain").status).toBe("dormant")
  })

  it("대운 + 세운 + 원국 일지가 이루는 세 글자 형(丑戌未)은 세운 쪽에만 flux activate", () => {
    const c = CUSTOM("甲子", "丙寅", "戊戌", null)
    const a = analyzeRules(c, undefined, { luck: [pil("乙丑")], year: pil("丁未") })
    expect(a.interactions.some((i) => i.scope === "luck" && i.type === "punishment" && !i.partial && i.members.length === 3)).toBe(true)
    const r = buildExpressionReport({ analysis: a, luck: { daeun: { luckIndex: 0, daeunIndex: 3 }, seunYear: 2027 }, archetype: { id: "baekho" } }, { hourCheck: false, tableCheck: false })
    const dae = r.luck.find((l) => l.scope === "daeun")!
    const se = r.luck.find((l) => l.scope === "seun")!
    expect(dae.touches.some((t) => t.dimensionId === "flux")).toBe(false)
    const fx = se.touches.find((t) => t.dimensionId === "flux")!
    expect(fx).toBeDefined()
    expect(fx.mode).toBe("activate")
    expect(fx.ruleId).toBe("exp.luck.flux")
    expect([...fx.via].sort()).toEqual(["daeun[3].branch", "day.branch", "seun.branch"])
    expect(se.activates).toContain("flux")
    // 대운을 지정하지 않으면(지금 대운을 모름) 세 글자 형을 세운에 붙이지 않는다
    const r2 = buildExpressionReport({ analysis: a, luck: { seunYear: 2027 }, archetype: { id: "baekho" } }, { hourCheck: false, tableCheck: false })
    expect(r2.luck[0].touches.some((t) => t.dimensionId === "flux")).toBe(false)
  })
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

  it("시주 모름 + 8/12 미만 faint는 '옅다'로 읽지 않는다(hourUncertain 표지·chart-uncertain), flux는 대표 기질에서 빠진다", () => {
    const rnd = mulberry32(77)
    let faintBelow = 0
    let fluxPresent = 0
    for (let n = 0; n < 40 && (faintBelow < 2 || fluxPresent < 2); n++) {
      const c = randomChart(rnd, 0)
      const r = buildExpressionReport({ analysis: analyzeRules(c), archetype: { id: "sage" } }, OPTS_FAST)
      expect(r.sections.innateEssence).not.toContain("potential:flux")
      if (levelOf(r, "flux") !== "faint") fluxPresent++
      for (const p of r.innate) {
        const below = p.hourStable!.stable < 8
        expect(p.flags.includes("hourUncertain"), p.dimensionId).toBe(below)
        if (p.level === "faint" && below) {
          faintBelow++
          expect(r.conflicts).toContainEqual({
            dimensionId: p.dimensionId, kind: "chart-uncertain", note: `태어난 시각을 알면 달라질 수 있어 옅은 기질로 읽지 않음 (${p.hourStable!.stable}/12)`,
          })
        }
      }
    }
    expect(faintBelow).toBeGreaterThan(0)
    expect(fluxPresent).toBeGreaterThan(0)
  }, 120_000)

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
    expect(r.sections.gap).toEqual([]) // QA S6: "자기보고 없음" 같은 전체 기록은 gap에 넣지 않는다
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

  it("MBTI만: 확신 신호 줄은 확인 신호(mbtiOnly), 확신 없음 축은 신호 없음(힌트만), missing 기록", () => {
    const a = analysisOf(CHART)
    const sure = buildExpressionReport(inputOf(CHART, a, { mbti: mbti("ESTJ"), facts: [] }))
    const unsure = buildExpressionReport(inputOf(CHART, a, { mbti: mbti("estj"), facts: [] }))
    expect(readingOf(sure, "outward").self).toEqual({ signal: "high", from: ["mbti:EI"], mbtiOnly: true })
    expect(readingOf(sure, "expression").self).toEqual({ signal: "none", from: [], mbtiOnly: false })
    expect(readingOf(sure, "realism").self).toEqual({ signal: "none", from: [], mbtiOnly: false })
    expect(readingOf(sure, "duty").self).toEqual({ signal: "none", from: [], mbtiOnly: false })
    expect(readingOf(sure, "grain").self.from).toEqual(["mbti:JP"])
    expect(unsure.readings.every((x) => x.self.signal === "none" && x.self.from.length === 0)).toBe(true)
    expect(unsure.styleHints).toEqual(["style.talkFirst", "style.concreteFirst", "style.reasonFirst"])
    expect(sure.conflicts.some((k) => k.kind === "missing" && k.note.includes("확인 신호로만"))).toBe(true)
  })

  it("사실만: MBTI 없음 기록, mbtiOnly 없음, grain은 사실 방향(lean)을 남긴다", () => {
    const a = analysisOf(CHART)
    const fs = facts([{ questionId: "workStyle", values: ["leading"] }, { questionId: "selfStrength", values: ["planning", "learning"] }])
    const r = buildExpressionReport(inputOf(CHART, a, { facts: fs }))
    expect(r.conflicts.some((k) => k.note === "MBTI 응답 없음 — 설문 사실만으로 비교")).toBe(true)
    expect(r.readings.every((x) => !x.self.mbtiOnly)).toBe(true)
    expect(readingOf(r, "duty").self).toEqual({ signal: "high", from: ["fact:workStyle", "fact:selfStrength:planning"], mbtiOnly: false })
    expect(readingOf(r, "grain").self.from).toEqual(["fact:selfStrength:planning"])
    expect(readingOf(r, "grain").self.lean).toBe("steady")
    expect(["expressed", "developed"]).toContain(readingOf(r, "duty").status)
    expect(unresolvedSectionIds(r, { facts: fs })).toEqual([])
  })

  it("상충: MBTI와 경험이 반대면 경험을 따르고 self-vs-self, 사실끼리 상쇄되면 판정 보류", () => {
    const a = analysisOf(CHART)
    const fs = facts([
      { questionId: "selfStrength", values: ["planning"] }, // grain steady
      { questionId: "occupationStatus", values: ["self_employed"] }, // realism high(상황)
      { questionId: "selfWeakness", values: ["saving"] }, // realism low(기질)
    ])
    const self: SelfReport = { mbti: mbti("ISTP"), facts: fs } // P(확신) → grain edge
    const r = buildExpressionReport(inputOf(CHART, a, self))
    const g = readingOf(r, "grain")
    expect(g.self.lean).toBe("steady") // 경험 쪽
    expect(g.self.from).toEqual(["fact:selfStrength:planning", "mbti:JP"])
    expect(r.conflicts).toContainEqual({ dimensionId: "grain", kind: "self-vs-self", note: "MBTI 자기보고와 설문 경험이 반대 방향 — 경험 쪽을 따름" })
    const re = readingOf(r, "realism")
    // 사실 +1 −1 = 0, 0.2.0에서 S는 신호가 아님 → none
    expect(re.self.from).toEqual(["fact:occupationStatus", "fact:selfWeakness:saving"])
    expect(re.self.signal).toBe("none")
    expect(r.conflicts).toContainEqual({ dimensionId: "realism", kind: "self-vs-self", note: "설문 답끼리 방향이 엇갈림 — 합산해 판정" })
    expect(r.conflicts).toContainEqual({ dimensionId: "realism", kind: "missing", note: "자기보고가 약하거나 서로 상쇄되어 판정 보류" })
    expect(r.sections.gap.length).toBeGreaterThan(0)
    expect(unresolvedSectionIds(r, self)).toEqual([])
  })

  it("MBTI 일부 축만: 응답한 축만 쓰고 기록한다", () => {
    const a = analysisOf(CHART)
    const r = buildExpressionReport(inputOf(CHART, a, { mbti: mbti("IxxJ"), facts: [] }))
    expect(r.conflicts.some((k) => k.note.startsWith("MBTI 2개 축만 응답"))).toBe(true)
    expect(r.readings.flatMap((x) => x.self.from).every((s) => s === "mbti:JP")).toBe(true) // I는 힌트만
    expect(r.styleHints).toEqual(["style.writeFirst"])
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
    expect(() => buildExpressionReport({ analysis: {} as RuleAnalysis })).toThrow(EngineInputError)
  })
})
