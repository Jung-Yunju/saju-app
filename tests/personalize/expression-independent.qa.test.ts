// 품질검증(qa-security-lead) 독립 검증 — 사주 발현 분석 엔진 expression@0.2.0 (커밋 14e3a25 재검증, 0.1.0 = 0c6127a)
// 근거: docs/redesign/30-expression-engine.md(계약 §1·§5·§6·§7), docs/knowledge/personalization/expression-dimensions.md
//       (연구소장 @0.2.0 §2·§3·§3.7 grain·§4·§5·§6.2·§6.4·§7.1·§7.2)
// 원칙: 엔진의 chart-rules.ts·self-report.ts·engine.ts 함수를 재사용하지 않고, 연구소장 문서만 보고 판정을 다시 구현해 엔진 출력과 대조한다.
//  - 재료는 규칙 엔진 원값(원국 글자·hiddenStems 표·interactions·strength 판정·qiFlow 표지·climate)만 쓴다.
//  - 십성·묶음·가중 합(G, T, 십성별 합)·음양 개수·12시진 시주·grain 비율(q)은 여기서 직접 계산한다(규칙 엔진 값과도 교차 확인).
//  - 기대값은 문서(§4 손계산 등)에서 가져오고 엔진 출력에서 복사하지 않는다.
// 0.2.0 갱신(재검증): steadiness·edge → 양극 축 grain(8차원), 시주 모름 grain 방향 포함 안정도·hourUncertain,
//   운 grain activate/press·세 글자 형 세운 쪽 flux, MBTI 신호 3줄·low 금지·확신 없음 효과 0, 금지어 우회·오탐, 0.1.0 지적 S1~S6.
// 외부 호출 없음. 엔진 코드는 고치지 않는다.
import { describe, expect, it } from "vitest"
import { analyzeRules, computeChart, yearPillarOf, type CalendarResult, type Pillar, type RuleAnalysis } from "@/engine"
import {
  EXPRESSION_FORBIDDEN_PHRASES, ExpressionTableError, MBTI_SIGNAL_LINKS, buildExpressionReport, expressionTables, findForbiddenPhrases,
  forbiddenHitsOf, makeExpressionTables, parseMbtiInput, potentialsOf, type ExpressionReport, type MbtiAxisReport, type SelfReport,
} from "@/engine/personalize/expression"
import type { UserFact } from "@/engine/personalize/types"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createRequire } from "node:module"

const ROOT = resolve(__dirname, "../..")
const RAW_DIMS = JSON.parse(readFileSync(resolve(ROOT, "content/expression/dimensions.json"), "utf8"))
const RAW_BRIDGE = JSON.parse(readFileSync(resolve(ROOT, "content/expression/mbti-bridge.json"), "utf8"))
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 표 JSON을 일부러 망가뜨리는 시험용
type Loose = Record<string, any>

// ─────────────────────────────────────────── 독립 구현: 기초 표(문서·통설만으로)

const STEMS = "甲乙丙丁戊己庚辛壬癸"
const BRANCHES = "子丑寅卯辰巳午未申酉戌亥"
type El = 0 | 1 | 2 | 3 | 4 // 목 화 토 금 수
const elOf = (s: string): El => (Math.floor(STEMS.indexOf(s) / 2) as El)
const yangStem = (s: string): boolean => STEMS.indexOf(s) % 2 === 0
const GEN = (e: El): El => (((e + 1) % 5) as El) // 생
const CTRL = (e: El): El => (((e + 2) % 5) as El) // 극

function tenGod(dm: string, t: string): string {
  const a = elOf(dm), b = elOf(t)
  const same = yangStem(dm) === yangStem(t)
  if (a === b) return same ? "비견" : "겁재"
  if (GEN(a) === b) return same ? "식신" : "상관"
  if (CTRL(a) === b) return same ? "편재" : "정재"
  if (CTRL(b) === a) return same ? "편관" : "정관"
  return same ? "편인" : "정인" // GEN(b) === a
}
const GROUP: Record<string, G5> = {
  비견: "bigyeop", 겁재: "bigyeop", 식신: "siksang", 상관: "siksang", 편재: "jaeseong", 정재: "jaeseong",
  편관: "gwansal", 정관: "gwansal", 편인: "inseong", 정인: "inseong",
}
type G5 = "bigyeop" | "siksang" | "jaeseong" | "gwansal" | "inseong"
const G5S: G5[] = ["bigyeop", "siksang", "jaeseong", "gwansal", "inseong"]
const DIM_OF: Record<G5, string> = { bigyeop: "drive", siksang: "expression", jaeseong: "realism", gwansal: "duty", inseong: "learning" }
/** 연구소장 @0.2.0 §1.1 — 8차원 */
const DIMS = ["drive", "expression", "realism", "duty", "learning", "grain", "flux", "outward"]
const CORE = DIMS.slice(0, 5)
type Lv = "strong" | "moderate" | "faint"
type Lean = "steady" | "edge" | "balanced"
const r6 = (x: number): number => Math.round(x * 1e6) / 1e6
// weighted-v1 위치 가중(연구소장 §2.1 표 기재값)
const BW: Record<string, number> = { year: 1.0, month: 3.0, day: 1.5, hour: 1.0 }
const NATAL = ["year", "month", "day", "hour"] as const
// §3.7.2 집합(이름으로 고정, 비견·편재 제외)
const STEADY = ["정재", "정관", "정인", "식신"]
const EDGE = ["편관", "상관", "편인", "겁재"]
const CLARITY = ["상관견관", "효신탈식", "관살혼잡"]

interface MyGrain {
  level: Lv
  lean: Lean
  thin: boolean
  q: number | null
  d: number | null
  S: number
  E: number
  shown: boolean
  promoted: boolean
  /** 문턱(0.30·0.07·0.20)에서 1e-6 안쪽 — 반올림 차이로만 갈릴 수 있는 경계 사례 */
  nearCut: boolean
}
interface Mine {
  level: Record<string, Lv>
  flags: Record<string, string[]>
  driveMod: 0 | 1 | -1
  notes: Record<string, ("load" | "surplus")[]>
  blocked: boolean
  T: number
  G: Record<G5, number>
  yang: number
  yin: number
  share: Record<string, number>
  grain: MyGrain
}

/** 연구소장 @0.2.0 §2·§3·§3.7.2·§7.2를 문서만 보고 다시 구현 */
function mine(a: RuleAnalysis): Mine {
  const n = a.source.natal
  const dm = n.day.stem
  const G = { bigyeop: 0, siksang: 0, jaeseong: 0, gwansal: 0, inseong: 0 } as Record<G5, number>
  const tg: Record<string, number> = {}
  const touchul: Record<G5, number> = { bigyeop: 0, siksang: 0, jaeseong: 0, gwansal: 0, inseong: 0 }
  const hidden: Record<G5, number> = { bigyeop: 0, siksang: 0, jaeseong: 0, gwansal: 0, inseong: 0 }
  const stemTG: string[] = []
  let T = 0
  let yang = 0, yin = 0
  for (const k of NATAL) {
    const p = n[k]
    if (!p) continue
    T += 1 + BW[k]
    if (yangStem(p.stem)) yang++
    else yin++
    if (k !== "day") {
      const t = tenGod(dm, p.stem)
      G[GROUP[t]] += 1
      tg[t] = (tg[t] ?? 0) + 1
      touchul[GROUP[t]]++
      stemTG.push(t)
    }
    const hs = a.hiddenStems.pillars[k]!
    for (const h of hs) {
      const t = tenGod(dm, h.stem)
      G[GROUP[t]] += BW[k] * h.weight
      tg[t] = (tg[t] ?? 0) + BW[k] * h.weight
      hidden[GROUP[t]]++
    }
    // 지지 음양 byMainQi = 정기 천간의 음양(子·午 음, 巳·亥 양)
    const jg = hs.find((h) => h.role === "jeonggi")!
    if (yangStem(jg.stem)) yang++
    else yin++
  }
  for (const g of G5S) G[g] = r6(G[g])
  // 월령 M
  const M = new Set<G5>()
  const mj = a.hiddenStems.pillars.month.find((h) => h.role === "jeonggi")!
  M.add(GROUP[tenGod(dm, mj.stem)])
  const cands = a.structure?.candidates ?? []
  const prim = cands.find((c) => c.role === "primary")
  if (prim?.pivot) M.add(GROUP[tenGod(dm, prim.pivot.stem)])
  if (prim?.variantAgreement === "differs") for (const c of cands) if (c.role === "otherVariant" && c.pivot) M.add(GROUP[tenGod(dm, c.pivot.stem)])

  const A = a.strength.models.find((m) => m.model === "weighted")!
  const blocked = A.nearBoundary || a.strength.agreement === "split" || a.strength.tableSensitive
  const hasSpecial = cands.some((c) => c.kind === "special")
  const level: Record<string, Lv> = {}
  const flags: Record<string, string[]> = {}
  const notes: Record<string, ("load" | "surplus")[]> = {}
  const share: Record<string, number> = {}
  let driveMod: 0 | 1 | -1 = 0
  const step = (l: Lv, d: 1 | -1): Lv => {
    const o: Lv[] = ["faint", "moderate", "strong"]
    return o[Math.max(0, Math.min(2, o.indexOf(l) + d))]
  }
  for (const g of G5S) {
    const s = r6(G[g] / T)
    const m = M.has(g)
    const tu = touchul[g] > 0, hi = hidden[g] > 0
    let l: Lv
    const f: string[] = []
    if (!tu && !hi) l = "faint"
    else if (!tu) { l = s >= 0.12 || m ? "moderate" : "faint"; f.push("latent") }
    else if (!hi) { l = s >= 0.15 ? "moderate" : "faint"; f.push("floating") }
    else l = s >= 0.24 || (m && s >= 0.18) ? "strong" : "moderate"
    if (m) f.push("month")
    const id = DIM_OF[g]
    if (id === "drive") {
      // §3.2·§7.2(0.2.0 확정): 경계 차단이면 +1·−1 모두 끔
      const plus = A.verdict === "신강" && G.bigyeop >= G.inseong
      const minus = A.extreme === "weak"
      if (!blocked && plus) driveMod = 1
      else if (!blocked && minus) driveMod = -1
      if (driveMod) l = step(l, driveMod)
    }
    const nt: ("load" | "surplus")[] = []
    if (l === "strong" && !blocked && !hasSpecial) {
      if ((g === "siksang" || g === "jaeseong" || g === "gwansal") && A.verdict === "신약") nt.push("load")
      if ((g === "bigyeop" || g === "inseong") && A.verdict === "신강") nt.push("surplus")
    }
    level[id] = l
    flags[id] = f
    notes[id] = nt
    share[id] = s
  }
  // grain(§3.7.2) — 양극 축
  const S = STEADY.reduce((x, t) => x + (tg[t] ?? 0), 0)
  const E = EDGE.reduce((x, t) => x + (tg[t] ?? 0), 0)
  const spread = (S + E) / T
  const gr: MyGrain = { level: "faint", lean: "balanced", thin: false, q: null, d: null, S: r6(S), E: r6(E), shown: false, promoted: false, nearCut: Math.abs(spread - 0.3) < 1e-6 }
  if (spread < 0.3) gr.thin = true
  else {
    const q = r6(S / (S + E))
    const d = r6(Math.abs(q - 0.5))
    gr.q = q
    gr.d = d
    gr.nearCut = gr.nearCut || Math.abs(d - 0.07) < 2e-6 || Math.abs(d - 0.2) < 2e-6
    gr.lean = d < 0.07 ? "balanced" : q > 0.5 ? "steady" : "edge"
    const SET = gr.lean === "steady" ? STEADY : EDGE
    gr.shown = gr.lean !== "balanced" && stemTG.some((t) => SET.includes(t))
    gr.level = d < 0.07 ? "faint" : d >= 0.2 && gr.shown ? "strong" : "moderate"
    if (gr.lean === "edge" && gr.level === "moderate" && (a.qiFlow?.clarityFlags ?? []).some((x) => CLARITY.includes(x.flag))) {
      gr.level = "strong"
      gr.promoted = true
    }
  }
  level.grain = gr.level
  flags.grain = []
  notes.grain = []
  share.grain = r6(spread)
  // flux(§3.8)
  const R = a.interactions.filter((i) => i.scope === "natal" && !(i.subsumedBy && i.subsumedBy.length))
  const moving = R.filter((i) => i.type === "clash" || i.type === "stemClash" || (i.type === "punishment" && !i.partial))
  const key = moving.some((i) => i.type === "clash" && i.members.some((m) => m.part === "branch" && (m.pillar === "month" || m.pillar === "day")))
  level.flux = key && moving.length >= 2 ? "strong" : moving.length >= 1 ? "moderate" : "faint"
  // outward(§3.9)
  const yr = r6(yang / (yang + yin))
  const tc = a.climate.tClass
  const warm = tc === "난" || tc === "열강", cold = tc === "한" || tc === "한강"
  level.outward = yr >= 0.75 || (yr >= 0.625 && warm) ? "strong" : yr <= 0.25 || (yr <= 0.375 && cold) ? "faint" : "moderate"
  for (const id of ["flux", "outward"]) { flags[id] = []; notes[id] = [] }
  return { level, flags, driveMod, notes, blocked, T: r6(T), G, yang, yin, share, grain: gr }
}

/** 12시진 시주(五鼠遁: 甲己→甲子, 乙庚→丙子, 丙辛→戊子, 丁壬→庚子, 戊癸→壬子) — 독립 구현 */
function myHourPillars(dayStem: string): Pillar[] {
  const start = (STEMS.indexOf(dayStem) % 5) * 2
  return [...BRANCHES].map((b, i) => ({ stem: STEMS[(start + i) % 10], branch: b }) as Pillar)
}

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

function randomBirthChart(rnd: () => number, hourKnown: boolean): CalendarResult {
  return computeChart({
    calendar: "solar",
    year: 1930 + Math.floor(rnd() * 95),
    month: 1 + Math.floor(rnd() * 12),
    day: 1 + Math.floor(rnd() * 28),
    time: hourKnown ? { hour: Math.floor(rnd() * 24), minute: Math.floor(rnd() * 60) } : null,
    gender: rnd() < 0.5 ? "M" : "F",
  })
}
const TEMPLATE = computeChart({ calendar: "solar", year: 1990, month: 3, day: 15, time: { hour: 9, minute: 30 }, gender: "F" })
/** 달력과 무관한 합성 원국(60갑자 아무 조합) — 규칙 경계를 더 넓게 훑기 위함. analyzeRules는 pillars·engineVersion만 읽는다 */
function synthChart(rnd: () => number, hourKnown: boolean): CalendarResult {
  const gz = (): Pillar => {
    const i = Math.floor(rnd() * 60)
    return { stem: STEMS[i % 10], branch: BRANCHES[i % 12] } as Pillar
  }
  return { ...TEMPLATE, pillars: { year: gz(), month: gz(), day: gz(), hour: hourKnown ? gz() : null } } as CalendarResult
}
function withPillars(base: CalendarResult, p: { year: string; month: string; day: string; hour: string | null }): CalendarResult {
  const P = (s: string): Pillar => ({ stem: s[0], branch: s[1] }) as Pillar
  return { ...base, pillars: { year: P(p.year), month: P(p.month), day: P(p.day), hour: p.hour ? P(p.hour) : null } } as CalendarResult
}
function luckAnalysis(c: CalendarResult, year = 2026): RuleAnalysis {
  const luck = c.luck?.daeun?.map((d) => d.pillar) ?? []
  return analyzeRules(c, undefined, { luck, year: yearPillarOf(year) })
}
function curDaeun(c: CalendarResult, year = 2026): { luckIndex: number; daeunIndex: number } | undefined {
  let f: { luckIndex: number; daeunIndex: number } | undefined
  c.luck?.daeun?.forEach((d, i) => { if (d.startYear <= year) f = { luckIndex: i, daeunIndex: d.index } })
  return f
}

function fact(questionId: string, value: string, label = `라벨${value}`): UserFact {
  const multi = ["selfStrength", "selfWeakness", "concernTopic"].includes(questionId)
  const ev = ["lifeEvents", "recentChanges"].includes(questionId)
  return {
    source: "user",
    id: ev ? `${questionId === "lifeEvents" ? "life_event" : "recent_change"}:${value}` : multi ? `${questionId}:${value}` : questionId,
    topic: questionId,
    value,
    label,
    questionId: questionId as UserFact["questionId"],
    useAs: "background-only",
    selfReported: true,
  }
}
const TRAIT_FACTS: [string, string][] = [
  ["selfStrength", "persistence"], ["selfStrength", "communication"], ["selfStrength", "planning"], ["selfStrength", "creativity"],
  ["selfStrength", "caring"], ["selfStrength", "decisiveness"], ["selfStrength", "learning"],
  ["workStyle", "solo_deep"], ["workStyle", "team"], ["workStyle", "people_facing"], ["workStyle", "leading"], ["workStyle", "flexible"],
  ["selfWeakness", "saving"], ["selfWeakness", "worry"], ["selfWeakness", "overwork"],
]
const SITUATION_FACTS: [string, string][] = [
  ...["student", "job_seeking", "employed", "self_employed", "freelance", "homemaker", "retired", "other"].map((v) => ["occupationStatus", v] as [string, string]),
  ...["relocation", "job_change", "breakup", "new_relationship", "childbirth", "business_start", "business_end"].map((v) => ["recentChanges", v] as [string, string]),
  ...["marriage", "childbirth", "job_change", "school_milestone", "relocation", "business_start"].map((v) => ["lifeEvents", v] as [string, string]),
]
const OTHER_FACTS: [string, string][] = [["changeWish", "money_stability"], ["changeWish", "confidence"], ["changeWish", "habits_routine"], ["relationshipStatus", "married"], ["birthOrder", "eldest"]]

/** 축마다 {극1 확신, 극1 미확신, 극2 확신, 극2 미확신, 모름} */
const AXIS_CHOICES: Record<string, (MbtiAxisReport | null)[]> = Object.fromEntries(
  (["EI", "SN", "TF", "JP"] as const).map((ax) => {
    const [p1, p2] = ax.split("")
    return [ax, [{ axis: ax, pole: p1, sure: true }, { axis: ax, pole: p1, sure: false }, { axis: ax, pole: p2, sure: true }, { axis: ax, pole: p2, sure: false }, null]]
  }),
)
function allMbtiCombos(): MbtiAxisReport[][] {
  const out: MbtiAxisReport[][] = []
  for (const a of AXIS_CHOICES.EI) for (const b of AXIS_CHOICES.SN) for (const c of AXIS_CHOICES.TF) for (const d of AXIS_CHOICES.JP)
    out.push([a, b, c, d].filter((x): x is MbtiAxisReport => !!x))
  return out
}
function randomSelf(rnd: () => number): SelfReport | undefined {
  const r = rnd()
  if (r < 0.1) return undefined
  const facts: UserFact[] = []
  const nF = Math.floor(rnd() * 5)
  for (let i = 0; i < nF; i++) {
    const [q, v] = pick(rnd, [...TRAIT_FACTS, ...SITUATION_FACTS, ...OTHER_FACTS])
    facts.push(fact(q, v))
  }
  const mb = rnd() < 0.75 ? pick(rnd, allMbtiCombos()) : undefined
  return { ...(mb ? { mbti: mb } : {}), facts }
}
function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o)
    for (const v of Object.values(o as object)) deepFreeze(v)
  }
  return o
}
/** 긴 동기 반복이 vitest 작업자 RPC를 막지 않게 가끔 양보 */
const tick = (): Promise<void> => new Promise((r) => setImmediate(r))
const reading = (r: ExpressionReport, id: string) => r.readings.find((x) => x.dimensionId === id)!
const potential = (r: ExpressionReport, id: string) => r.innate.find((x) => x.dimensionId === id)!

// ─────────────────────────────────────────── 3. 원국 판정 독립 대조

describe("QA-3 원국 판정: 문서만 보고 다시 구현한 계산 ↔ 엔진", () => {
  it("연구소장 §4 손계산 원국 甲子 丙寅 戊辰 庚申 (시주 있음·없음) — grain 두 판 포함", async () => {
    const cWith = withPillars(TEMPLATE, { year: "甲子", month: "丙寅", day: "戊辰", hour: "庚申" })
    const cNo = withPillars(TEMPLATE, { year: "甲子", month: "丙寅", day: "戊辰", hour: null })
    const aW = analyzeRules(cWith)
    const aN = analyzeRules(cNo)
    const mW = mine(aW)
    const mN = mine(aN)
    // 문서 §4 표 값
    expect(mW.T).toBe(10.5)
    expect(mW.G).toEqual({ bigyeop: 1.833333, siksang: 1.533333, jaeseong: 1.383333, gwansal: 3.05, inseong: 1.7 })
    const docWith: Record<string, Lv> = { drive: "moderate", expression: "moderate", realism: "moderate", duty: "strong", learning: "moderate", grain: "strong", flux: "strong", outward: "strong" }
    expect(mW.level).toEqual(docWith)
    expect(mW.flags.drive).toContain("latent")
    expect(mW.flags.realism).toContain("latent")
    expect(mW.flags.duty).toContain("month")
    expect(mW.blocked).toBe(true) // r=0.4317, 경계 근처
    expect(mW.notes.duty).toEqual([]) // load 달지 않음
    expect(mW.yang).toBe(7)
    // §4 grain(시주 있음): S 2.8 · E 4.3 · (S+E)/T 0.676 · q 0.394366 · d 0.105634 → edge moderate → 효신탈식 승격 strong
    expect(mW.grain.S).toBe(2.8)
    expect(mW.grain.E).toBe(4.3)
    expect(r6(mW.share.grain)).toBeCloseTo(0.676, 3)
    expect(mW.grain.q).toBe(0.394366)
    expect(mW.grain.d).toBe(0.105634)
    expect(mW.grain.lean).toBe("edge")
    expect(mW.grain.promoted).toBe(true)
    expect(aW.qiFlow.clarityFlags.map((f) => f.flag)).toContain("효신탈식")
    const eW = potentialsOf(aW, expressionTables().dims)
    expect(Object.fromEntries(eW.map((p) => [p.dimensionId, p.level]))).toEqual(docWith)
    const gW = eW.find((p) => p.dimensionId === "grain")!
    expect(gW.lean).toBe("edge")
    expect(gW.basis.map((b) => b.ruleId)).toContain("exp.mod.grain.clarity")
    expect(/q=([0-9.]+)/.exec(gW.basis.find((b) => b.ruleId === "exp.lv.grain.v1")!.note)?.[1]).toBe("0.394366")
    // 시주 없음: expression·flux faint, r=0.505882 중화. grain: S 1.267 · E 4.3 · q 0.227545 · d 0.272455 → 승격 없이 strong edge(甲·丙 투출)
    const docNo = { ...docWith, expression: "faint", flux: "faint" }
    expect(mN.level).toEqual(docNo)
    expect(mN.T).toBe(8.5)
    expect(mN.grain.S).toBe(1.266667)
    expect(mN.grain.q).toBe(0.227545)
    expect(mN.grain.d).toBe(0.272455)
    expect(mN.grain.lean).toBe("edge")
    expect(mN.grain.promoted).toBe(false)
    const AN = aN.strength.models.find((m) => m.model === "weighted")!
    expect(AN.ratio).toBeCloseTo(0.505882, 5)
    expect(AN.verdict).toBe("중화")
    const eN = potentialsOf(aN, expressionTables().dims)
    expect(Object.fromEntries(eN.map((p) => [p.dimensionId, p.level]))).toEqual(docNo)
    const gN = eN.find((p) => p.dimensionId === "grain")!
    expect(gN.lean).toBe("edge")
    expect(gN.basis.map((b) => b.ruleId)).not.toContain("exp.mod.grain.clarity")
    expect(/q=([0-9.]+)/.exec(gN.basis.find((b) => b.ruleId === "exp.lv.grain.v1")!.note)?.[1]).toBe("0.227545")
  })

  it("무작위 원국 4,000건(실제 생일 2,000 + 합성 60갑자 2,000, 시주 있음 70%): 8차원 단계·grain 방향·q·표지·보정·메모 전부 일치", async () => {
    const rnd = mulberry32(0xc0ffee)
    const { dims } = expressionTables()
    const mism: string[] = []
    let rulesCross = 0, nearCut = 0
    const hit = {
      absent: 0, hiddenOnly: 0, stemOnly: 0, rooted: 0, monthStrong: 0, drivePlus: 0, driveMinus: 0, load: 0, surplus: 0, fluxStrong: 0, blocked: 0,
      grainThin: 0, grainBalanced: 0, grainSteadyStrong: 0, grainEdgeStrongDirect: 0, grainEdgePromoted: 0, grainSteadyModerate: 0, grainEdgeModerate: 0, grainSteepNotShown: 0,
    }
    const examples: Record<string, string> = {}
    for (let i = 0; i < 4000; i++) {
      await tick()
      const known = rnd() < 0.7
      const c = i < 2000 ? randomBirthChart(rnd, known) : synthChart(rnd, known)
      const a = analyzeRules(c)
      const m = mine(a)
      // 규칙 엔진 값과 교차(독립 계산 G·T·음양이 rules 값과 같은가)
      const A = a.strength.models.find((x) => x.model === "weighted")!
      if (Math.abs(A.total! - m.T) > 1e-6 || G5S.some((g) => Math.abs(a.strength.groupTotals[g] - m.G[g]) > 2e-6) || a.elements.yinYang.yang !== m.yang) rulesCross++
      const pot = potentialsOf(a, dims)
      expect(pot.map((p) => p.dimensionId)).toEqual(DIMS)
      if (m.grain.nearCut) nearCut++
      for (const p of pot) {
        const id = p.dimensionId
        if (p.level !== m.level[id]) mism.push(`${i} ${id} engine=${p.level} mine=${m.level[id]} ${JSON.stringify(a.source.natal)}`)
        if (CORE.includes(id)) {
          if (p.lean !== undefined) mism.push(`${i} ${id} lean on core`)
          const ef = p.flags.filter((f) => ["latent", "floating", "month"].includes(f)).sort()
          if (JSON.stringify(ef) !== JSON.stringify([...m.flags[id]].sort())) mism.push(`${i} ${id} flags engine=${ef} mine=${m.flags[id]}`)
          const en = p.basis.filter((b) => b.ruleId === "exp.note.load" || b.ruleId === "exp.note.surplus").map((b) => b.ruleId.slice(9))
          if (JSON.stringify(en) !== JSON.stringify(m.notes[id])) mism.push(`${i} ${id} notes engine=${en} mine=${m.notes[id]}`)
          const rule = p.basis[0].ruleId
          if (rule === "exp.lv.absent") hit.absent++
          if (rule === "exp.lv.hiddenOnly") hit.hiddenOnly++
          if (rule === "exp.lv.stemOnly") hit.stemOnly++
          if (rule === "exp.lv.rooted") hit.rooted++
          if (rule === "exp.lv.rooted" && p.flags.includes("month") && p.level === "strong" && m.share[id] < 0.24) hit.monthStrong++
          if (en.includes("load")) hit.load++
          if (en.includes("surplus")) hit.surplus++
        }
        if (id === "drive") {
          const mod = p.basis.find((b) => b.ruleId === "exp.mod.drive.v1")
          const em = !mod ? 0 : mod.note.includes("+1") ? 1 : -1
          if (em !== m.driveMod) mism.push(`${i} drive mod engine=${em} mine=${m.driveMod}`)
          if (m.blocked && mod) mism.push(`${i} drive mod while blocked`)
          if (m.driveMod === 1) hit.drivePlus++
          if (m.driveMod === -1) hit.driveMinus++
          if (m.blocked !== p.basis.some((b) => b.ruleId === "exp.sens.boundary")) mism.push(`${i} boundary basis`)
        }
        if (id === "grain") {
          const g = m.grain
          if (p.lean !== g.lean) mism.push(`${i} grain lean engine=${p.lean} mine=${g.lean} q=${g.q} ${JSON.stringify(a.source.natal)}`)
          if ((p.level === "faint") !== (p.lean === "balanced")) mism.push(`${i} grain faint⇔balanced 위반 ${p.level}/${p.lean}`)
          const ids = p.basis.map((b) => b.ruleId)
          if (g.thin !== ids.includes("exp.lv.grain.thin")) mism.push(`${i} grain thin engine=${ids} mine=${g.thin}`)
          if (!g.thin && !ids.includes("exp.lv.grain.v1")) mism.push(`${i} grain v1 basis 없음`)
          if (g.promoted !== ids.includes("exp.mod.grain.clarity")) mism.push(`${i} grain clarity engine=${ids} mine=${g.promoted}`)
          if (!g.thin) {
            const eq = /q=([0-9.]+)/.exec(p.basis.find((b) => b.ruleId === "exp.lv.grain.v1")?.note ?? "")
            if (!eq || Math.abs(Number(eq[1]) - g.q!) > 1.5e-6) mism.push(`${i} grain q engine=${eq?.[1]} mine=${g.q}`)
          }
          const cat = g.thin ? "grainThin" : g.lean === "balanced" ? "grainBalanced"
            : g.level === "strong" ? (g.lean === "steady" ? "grainSteadyStrong" : g.promoted ? "grainEdgePromoted" : "grainEdgeStrongDirect")
            : g.d! >= 0.2 && !g.shown ? "grainSteepNotShown" : g.lean === "steady" ? "grainSteadyModerate" : "grainEdgeModerate"
          hit[cat as keyof typeof hit]++
          if (!examples[cat] && i >= 2000) examples[cat] = `${JSON.stringify(c.pillars)} q=${g.q} d=${g.d} → ${g.level}/${g.lean}`
        }
        if (id === "flux" && p.level === "strong") hit.fluxStrong++
        if (p.basis.length === 0) mism.push(`${i} ${id} basis empty`)
      }
      if (m.blocked) hit.blocked++
    }
    console.log(`[QA-3] 4000건 불일치 ${mism.length}, rules 교차 불일치 ${rulesCross}, grain 문턱 1e-6 이내 경계 사례 ${nearCut}, 규칙 줄 적중`, JSON.stringify(hit),
      "\n[QA-3] grain 갈래별 합성 원국 예(§8-2):", JSON.stringify(examples, null, 1))
    expect(mism.slice(0, 20)).toEqual([])
    expect(rulesCross).toBe(0)
    // 모든 규칙 줄이 한 번 이상 걸렸는가(시험이 빈 경로만 돈 것이 아님을 확인) — grain 갈래 8개 포함
    for (const [k, v] of Object.entries(hit)) expect(v, k).toBeGreaterThan(0)
  }, 300_000)

  it("문턱 경계값(≥ 포함)을 표 조정으로 직접 찍어 본다: rootedStrong · grain strongGap/balancedGap을 정확한 값으로 두면 경계 쪽", async () => {
    const c = withPillars(TEMPLATE, { year: "甲子", month: "丙寅", day: "戊辰", hour: "庚申" })
    const a = analyzeRules(c)
    const d = clone(RAW_DIMS)
    // inseong gs = 1.7/10.5 = 0.161905 → rootedStrong를 그 값으로
    d.dimensions.find((x: { id: string }) => x.id === "learning").params.rootedStrong = 0.161905
    d.dimensions.find((x: { id: string }) => x.id === "learning").params.rootedStrongWithMonth = 0.161905
    const T = makeExpressionTables(d, RAW_BRIDGE)
    expect(potentialsOf(a, T.dims).find((p) => p.dimensionId === "learning")!.level).toBe("strong")
    d.dimensions.find((x: { id: string }) => x.id === "learning").params.rootedStrong = 0.161906
    d.dimensions.find((x: { id: string }) => x.id === "learning").params.rootedStrongWithMonth = 0.161906
    const T2 = makeExpressionTables(d, RAW_BRIDGE)
    expect(potentialsOf(a, T2.dims).find((p) => p.dimensionId === "learning")!.level).toBe("moderate")
    // grain(§4 시주 없음 d = 0.272455): strongGap = d → strong(≥), d+0.000001 → moderate(甲·丙 edge, 청탁 표지 없음)
    const cNo = withPillars(TEMPLATE, { year: "甲子", month: "丙寅", day: "戊辰", hour: null })
    const aN = analyzeRules(cNo)
    const g = (gap: number, bal = 0.07): string => {
      const dd = clone(RAW_DIMS)
      const row = dd.dimensions.find((x: { id: string }) => x.id === "grain")
      row.params.strongGap = gap
      row.params.balancedGap = bal
      const p = potentialsOf(aN, makeExpressionTables(dd, RAW_BRIDGE).dims).find((x) => x.dimensionId === "grain")!
      return `${p.level}/${p.lean}`
    }
    expect(g(0.272455)).toBe("strong/edge")
    expect(g(0.272456)).toBe(aN.qiFlow.clarityFlags.some((f) => CLARITY.includes(f.flag)) ? "strong/edge" : "moderate/edge")
    // balancedGap = d → 기울기 있음(< 아님), d+0.000001 → faint/balanced
    expect(g(0.3, 0.272455)).not.toBe("faint/balanced")
    expect(g(0.3, 0.272456)).toBe("faint/balanced")
  })

  it("운 글자를 넣어도·strengthPrimary를 바꿔도·입력 표가 cn이어도 innate가 같다(200건)", async () => {
    const rnd = mulberry32(77)
    for (let i = 0; i < 200; i++) {
      await tick()
      const c = randomBirthChart(rnd, rnd() < 0.7)
      const base = buildExpressionReport({ analysis: analyzeRules(c) }, { hourCheck: false, tableCheck: false }).innate
      const withLuck = buildExpressionReport({ analysis: luckAnalysis(c) }, { hourCheck: false, tableCheck: false }).innate
      const prim = buildExpressionReport({ analysis: analyzeRules(c, { strengthPrimary: "rooted" }) }, { hourCheck: false, tableCheck: false }).innate
      const cn = buildExpressionReport({ analysis: analyzeRules(c, { hiddenStemTable: "cn-lunarjs" }) }, { hourCheck: false, tableCheck: false }).innate
      expect(withLuck).toEqual(base)
      expect(prim).toEqual(base)
      expect(cn).toEqual(base)
    }
  }, 120_000)
})

// ─────────────────────────────────────────── 4. 시주 모름

describe("QA-4 시주 모름: hourStable x/12 ↔ 직접 12시진 재계산(grain은 단계+방향), 8/12 미만 보류·hourUncertain", () => {
  it("시주 모름 300건: hourStable 수·나온 단계·grain 방향 목록·hourUncertain·faint 기록·대표 기질 flux 제외가 독립 재계산과 같다", async () => {
    const rnd = mulberry32(4242)
    const bad: string[] = []
    let below8 = 0, multiNoConflict = 0
    const faintN: Record<string, number> = Object.fromEntries(DIMS.map((d) => [d, 0]))
    const faintUnstable: Record<string, number> = Object.fromEntries(DIMS.map((d) => [d, 0]))
    for (let i = 0; i < 300; i++) {
      await tick()
      const c = i % 2 ? randomBirthChart(rnd, false) : synthChart(rnd, false)
      const a = analyzeRules(c)
      const three = mine(a)
      const jud = (m: Mine, d: string): string => (d === "grain" ? `${m.level[d]}/${m.grain.lean}` : m.level[d])
      const counts: Record<string, string[]> = Object.fromEntries(DIMS.map((d) => [d, []]))
      const lvls: Record<string, Lv[]> = Object.fromEntries(DIMS.map((d) => [d, []]))
      const leans: Lean[] = []
      for (const hp of myHourPillars(a.source.natal.day.stem)) {
        const ah = analyzeRules({ ...c, pillars: { ...c.pillars, hour: hp } } as CalendarResult)
        const mh = mine(ah)
        for (const d of DIMS) { counts[d].push(jud(mh, d)); lvls[d].push(mh.level[d]) }
        leans.push(mh.grain.lean)
      }
      const r = buildExpressionReport({ analysis: a }, { tableCheck: false })
      for (const d of DIMS) {
        const p = potential(r, d)
        const stable = counts[d].filter((l) => l === jud(three, d)).length
        const levels = (["strong", "moderate", "faint"] as Lv[]).filter((l) => lvls[d].includes(l))
        if (!p.hourStable || p.hourStable.stable !== stable || JSON.stringify(p.hourStable.levels) !== JSON.stringify(levels))
          bad.push(`${i} ${d} engine=${JSON.stringify(p.hourStable)} mine=${stable} ${levels}`)
        if (d === "grain" && JSON.stringify([...(p.hourStable?.leans ?? [])].sort()) !== JSON.stringify([...new Set(leans)].sort()))
          bad.push(`${i} grain leans engine=${p.hourStable?.leans} mine=${[...new Set(leans)]}`)
        const unstable = stable < 8
        if (unstable) below8++
        if (p.flags.includes("hourUncertain") !== unstable) bad.push(`${i} ${d} hourUncertain engine=${p.flags.includes("hourUncertain")} stable=${stable}`)
        const cf = r.conflicts.filter((x) => x.dimensionId === d && x.kind === "chart-uncertain")
        // §7.1-1: 시주 모름 · 8/12 미만 · faint → chart-uncertain(옅은 기질로 서술하지 않음)
        if (p.level === "faint") {
          faintN[d]++
          if (unstable) {
            faintUnstable[d]++
            if (cf.length === 0) bad.push(`${i} ${d} faint·불안정인데 chart-uncertain 없음`)
          }
        }
        // §7.1 ③: 12시진에서 판정이 2가지 이상 → chart-uncertain
        if (new Set(counts[d]).size >= 2 && cf.length === 0) multiNoConflict++
      }
      // §7.1-2: 시주 모름이면 flux는 대표 기질에서 뺀다
      if (r.sections.innateEssence.includes("potential:flux")) bad.push(`${i} innateEssence에 flux`)
    }
    const share = Object.fromEntries(DIMS.map((d) => [d, `${faintUnstable[d]}/${faintN[d]}`]))
    console.log(`[QA-4] 시주 모름 300건 × 8차원: 불일치 ${bad.length}, 8/12 미만 차원 ${below8}건, 판정 2가지 이상인데 차원 chart-uncertain 없음 ${multiNoConflict}`,
      `\n[QA-4] (연구소장 §7.1 요청) 시주 모름 faint 중 hourStable<8/12 비율(차원별 불안정/faint):`, JSON.stringify(share))
    expect(bad.slice(0, 10)).toEqual([])
    expect(below8).toBeGreaterThan(0)
    expect(multiNoConflict).toBe(0)
  }, 300_000)

  it("8/12 미만 차원은 어떤 자기보고에서도 dormant·developed가 아니다(시주 모름 100원국 × 자기보고 30가지)", async () => {
    const rnd = mulberry32(99)
    let gated = 0, dd = 0, ddKnown = 0, quietUncertain = 0
    for (let i = 0; i < 100; i++) {
      await tick()
      const c = randomBirthChart(rnd, false)
      const a = analyzeRules(c)
      for (let k = 0; k < 30; k++) {
        const self = randomSelf(rnd) ?? { facts: [] }
        // dormant/developed가 나오기 쉽게 기질 답 몇 개를 섞는다
        if (k % 2) self.facts.push(fact(...pick(rnd, TRAIT_FACTS)), fact(...pick(rnd, TRAIT_FACTS)))
        const r = buildExpressionReport({ analysis: a, self }, { tableCheck: false })
        for (const x of r.readings) {
          const hs = x.chart.hourStable
          expect(hs).toBeDefined()
          if ((x.status === "dormant" || x.status === "developed")) {
            dd++
            expect(hs!.stable, `${x.dimensionId} ${x.status}`).toBeGreaterThanOrEqual(8)
          }
          if (x.status === "quiet" && hs!.stable < 8) quietUncertain++
          if (hs!.stable < 8 && r.conflicts.some((cf) => cf.dimensionId === x.dimensionId && cf.kind === "chart-uncertain" && cf.note.includes("판정을 보류"))) gated++
        }
      }
    }
    // hourCheck를 끄면(재판정 안 함) 시주 모름에서 dormant·developed가 하나도 없어야 한다
    const rnd2 = mulberry32(5)
    for (let i = 0; i < 60; i++) {
      const a = analyzeRules(randomBirthChart(rnd2, false))
      const self: SelfReport = { facts: TRAIT_FACTS.map(([q, v]) => fact(q, v)), mbti: parseMbtiInput("ESTJ").axes }
      const r = buildExpressionReport({ analysis: a, self }, { hourCheck: false, tableCheck: false })
      for (const x of r.readings) if (x.status === "dormant" || x.status === "developed") ddKnown++
    }
    console.log(`[QA-4] 시주 모름 dormant·developed ${dd}건(모두 ≥8/12), 8/12 미만이라 보류된 기록 ${gated}건, hourCheck 끔 dormant·developed ${ddKnown}건,`,
      `8/12 미만인데 quiet로 남은 판정 ${quietUncertain}건(개발자 남은 판단 2 — 보류 안 함)`)
    expect(dd).toBeGreaterThan(0)
    expect(gated).toBeGreaterThan(0)
    expect(ddKnown).toBe(0)
  }, 300_000)
})

// ─────────────────────────────────────────── 5. 경계 차단

describe("QA-5 경계 차단(nearBoundary · split · tableSensitive) — 0.2.0: drive +1·−1 모두 끔(B5 확정), tone은 계약대로 neutral", () => {
  it("차단 원국은 drive 보정·부담/넘침 메모·운 tone·tone 전략이 모두 꺼지고, 비차단 원국의 tone은 독립 계산과 같다", async () => {
    const rnd = mulberry32(555)
    const cnt = { blocked: 0, nb: 0, split: 0, ts: 0, unblockedTone: 0, toneMismatch: 0 }
    for (let i = 0; i < 1200; i++) {
      await tick()
      const c = randomBirthChart(rnd, rnd() < 0.8)
      const a = luckAnalysis(c)
      const r = buildExpressionReport({ analysis: a, luck: { daeun: curDaeun(c), seunYear: 2026 } }, { hourCheck: false, tableCheck: false })
      const A = a.strength.models.find((m) => m.model === "weighted")!
      const nb = A.nearBoundary, sp = a.strength.agreement === "split", ts = a.strength.tableSensitive
      const blocked = nb || sp || ts
      expect(r.sensitivity.boundary).toEqual({ blocked, nearBoundary: nb, agreementSplit: sp, tableSensitive: ts })
      if (blocked) {
        cnt.blocked++
        if (nb) cnt.nb++
        if (sp) cnt.split++
        if (ts) cnt.ts++
        for (const p of r.innate) {
          expect(p.basis.some((b) => b.ruleId === "exp.mod.drive.v1" || b.ruleId === "exp.note.load" || b.ruleId === "exp.note.surplus")).toBe(false)
        }
        for (const l of r.luck) {
          expect(l.tone).toBe("neutral")
          expect(l.strategy.some((s) => s === "exp.st.commit" || s === "exp.st.smallsteps")).toBe(false)
        }
        expect(r.conflicts.some((x) => x.kind === "chart-uncertain" && !x.dimensionId)).toBe(true)
      } else {
        // 독립 tone(§5.5): 억부 ok·희신 있음, rank1·희신=support, 기신·구신=load
        const eok = a.usefulGods.views.find((v) => v.method === "eokbu")
        const r1 = eok?.candidates.find((x) => x.rank === 1)?.element
        for (const l of r.luck) {
          let exp: string = "neutral"
          if (eok?.status === "ok" && eok.favorable && r1) {
            const ELN = ["wood", "fire", "earth", "metal", "water"]
            const p = l.scope === "seun" ? a.source.seun! : a.source.luck[curDaeun(c)!.luckIndex]
            const els = [ELN[elOf(p.stem)], ELN[[4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4][BRANCHES.indexOf(p.branch)]]]
            const cls = els.map((e) => (e === r1 || e === eok.favorable!.xi ? "s" : e === eok.favorable!.ji || e === eok.favorable!.gu ? "l" : "n"))
            exp = cls.includes("s") && !cls.includes("l") ? "support" : cls.includes("l") && !cls.includes("s") ? "load" : "neutral"
          }
          if (exp !== "neutral") cnt.unblockedTone++
          if (l.tone !== exp) cnt.toneMismatch++
        }
      }
    }
    console.log("[QA-5] 1200건", JSON.stringify(cnt))
    expect(cnt.blocked).toBeGreaterThan(0)
    expect(cnt.nb * cnt.split * cnt.ts).toBeGreaterThan(0) // 세 종류 모두 실제로 걸림
    expect(cnt.unblockedTone).toBeGreaterThan(0)
    expect(cnt.toneMismatch).toBe(0)
  }, 300_000)
})

// ─────────────────────────────────────────── 5b. 운 touches

describe("QA-5b 운 touches 독립 계산(§5.2~5.4, 0.2.0 grain activate/press · 세 글자 형 세운 쪽)", () => {
  const MAP: Record<G5, [string, string, string]> = {
    bigyeop: ["drive", "expression", "realism"], siksang: ["expression", "realism", "duty"], jaeseong: ["realism", "duty", "learning"],
    gwansal: ["duty", "learning", "drive"], inseong: ["learning", "drive", "expression"],
  }
  // 운 지지: 정기 천간 기준 십성(§5.1) — kr 표의 정기
  const JG: Record<string, string> = { 子: "癸", 丑: "己", 寅: "甲", 卯: "乙", 辰: "戊", 巳: "丙", 午: "丁", 未: "己", 申: "庚", 酉: "辛", 戌: "戊", 亥: "壬" }
  type Pos = { pillar: string; part: string; luckIndex?: number }
  const posOf = (m: Pos): string => (m.pillar === "daeun" ? `daeun[${m.luckIndex! + 1}].${m.part}` : `${m.pillar}.${m.part}`)
  const isLuck = (m: Pos): boolean => m.pillar === "daeun" || m.pillar === "seun"
  const keyNatal = (m: Pos): boolean => m.part === "branch" && (m.pillar === "month" || m.pillar === "day")

  /** 문서 §5.2~5.4만으로 (차원|방식) 집합과 flux 근거 위치를 계산 */
  function want(a: RuleAnalysis, scope: "daeun" | "seun", dRef: { luckIndex: number } | undefined): { set: Set<string>; fluxVia: string[][]; skippedOtherDaeun: number; threeWay: number; noDaeunThreeWay: number } {
    const p = scope === "seun" ? a.source.seun! : a.source.luck[dRef!.luckIndex]
    const dm = a.source.natal.day.stem
    const lean = mine(a).grain.lean
    const set = new Set<string>()
    for (const t of [tenGod(dm, p.stem), tenGod(dm, JG[p.branch])]) {
      const [ac, fe, pr] = MAP[GROUP[t]]
      set.add(`${ac}|activate`); set.add(`${fe}|feed`); set.add(`${pr}|press`)
      const side = STEADY.includes(t) ? "steady" : EDGE.includes(t) ? "edge" : null
      if (side) set.add(`grain|${lean === "balanced" || lean === side ? "activate" : "press"}`)
    }
    const isSlot = (m: Pos): boolean => m.pillar === scope && (scope !== "daeun" || m.luckIndex === dRef!.luckIndex)
    const fluxVia: string[][] = []
    let skippedOtherDaeun = 0, threeWay = 0, noDaeunThreeWay = 0
    for (const it of a.interactions) {
      if (it.scope !== "luck" || !it.members.some(isSlot)) continue
      if (!(it.type === "clash" || (it.type === "punishment" && !it.partial))) continue
      if (!it.members.some((m) => !isLuck(m) && keyNatal(m))) continue
      const otherLuck = it.members.filter((m) => isLuck(m) && !isSlot(m))
      if (scope === "daeun" && otherLuck.some((m) => m.pillar === "seun")) continue // 세 글자 형에 세운이 끼면 세운 쪽에만
      if (scope === "seun" && otherLuck.length) {
        // 세운과 함께 낀 대운은 그해의 지금 대운이어야 같은 때에 겹친다
        if (!dRef) { noDaeunThreeWay++; continue }
        if (otherLuck.some((m) => m.luckIndex !== dRef.luckIndex)) { skippedOtherDaeun++; continue }
        threeWay++
      }
      set.add("flux|activate")
      fluxVia.push(it.members.map(posOf))
    }
    return { set, fluxVia, skippedOtherDaeun, threeWay, noDaeunThreeWay }
  }

  it("대운·세운 1,000건(그해의 지금 대운): (차원, 방식) 집합·flux 근거 위치가 문서로 직접 계산한 것과 같고, outward는 운이 건드리지 않는다", async () => {
    const rnd = mulberry32(5150)
    let bad = 0, fluxHits = 0, threeWay = 0, skipped = 0, grainPress = 0, grainActivate = 0, bothSides = 0
    const samples: string[] = []
    for (let i = 0; i < 1000; i++) {
      await tick()
      const c = randomBirthChart(rnd, rnd() < 0.8)
      const Y = 2000 + Math.floor(rnd() * 46)
      const a = luckAnalysis(c, Y)
      const dRef = curDaeun(c, Y)
      const r = buildExpressionReport({ analysis: a, luck: { daeun: dRef, seunYear: Y } }, { hourCheck: false, tableCheck: false })
      for (const l of r.luck) {
        const w = want(a, l.scope, dRef)
        threeWay += w.threeWay
        skipped += w.skippedOtherDaeun
        const got = new Set(l.touches.map((t) => `${t.dimensionId}|${t.mode}`))
        if (got.has("flux|activate")) fluxHits++
        if (got.has("grain|press")) grainPress++
        if (got.has("grain|activate")) grainActivate++
        if (got.has("grain|press") && got.has("grain|activate")) bothSides++
        if (JSON.stringify([...got].sort()) !== JSON.stringify([...w.set].sort())) { bad++; if (samples.length < 5) samples.push(`${l.scope} ${l.ganzhi} got=${[...got]} want=${[...w.set]}`) }
        // flux 근거 위치: 관계의 모든 위치(§5.4)
        const fv = l.touches.filter((t) => t.dimensionId === "flux").flatMap((t) => t.via)
        for (const v of w.fluxVia.flat()) if (!fv.includes(v)) { bad++; if (samples.length < 5) samples.push(`${l.scope} flux via 누락 ${v} got=${fv}`) }
        expect(l.touches.some((t) => t.dimensionId === "outward")).toBe(false)
        expect(l.activates).toEqual([...new Set(l.touches.filter((t) => t.mode === "activate").map((t) => t.dimensionId))])
        // 계약 §5 확정 이름(B1): mode·via·ruleId, tone support/load/neutral
        for (const t of l.touches) expect(["activate", "feed", "press"]).toContain(t.mode)
        expect(["support", "load", "neutral"]).toContain(l.tone)
      }
    }
    console.log(`[QA-5b] touches 불일치 ${bad}, flux 활성 ${fluxHits}, 세운 쪽에 붙은 대운+세운+원국 월지·일지 세 글자 형 ${threeWay},`,
      `다른 대운과 낀 세운 관계(붙이지 않음) ${skipped}, grain activate ${grainActivate} · press ${grainPress} · 한 기둥 양쪽 ${bothSides}`, samples)
    expect(bad).toBe(0)
    expect(fluxHits).toBeGreaterThan(0)
    expect(threeWay).toBeGreaterThan(0)
    expect(grainPress).toBeGreaterThan(0)
  }, 300_000)

  it("지금 대운을 주지 않으면(세운만): 세 글자 형은 세운에 붙지 않는다 — 몇 건이 빠지는지와 기록 여부(개발자 남은 판단 5)", async () => {
    const rnd = mulberry32(6262)
    let lost = 0, recorded = 0, bad = 0
    for (let i = 0; i < 600; i++) {
      await tick()
      const c = randomBirthChart(rnd, rnd() < 0.8)
      const Y = 2000 + Math.floor(rnd() * 46)
      const a = luckAnalysis(c, Y)
      const dRef = curDaeun(c, Y)
      const r = buildExpressionReport({ analysis: a, luck: { seunYear: Y } }, { hourCheck: false, tableCheck: false })
      expect(r.luck.map((l) => l.scope)).toEqual(["seun"])
      const l = r.luck[0]
      const wNo = want(a, "seun", undefined)
      const got = new Set(l.touches.map((t) => `${t.dimensionId}|${t.mode}`))
      if (JSON.stringify([...got].sort()) !== JSON.stringify([...wNo.set].sort())) bad++
      // 실제 지금 대운을 알았다면 붙었을 세 글자 형
      if (dRef && want(a, "seun", dRef).threeWay > 0 && !got.has("flux|activate")) {
        lost++
        if (r.conflicts.some((x) => /대운/.test(x.note))) recorded++
      }
    }
    console.log(`[QA-5b] 지금 대운 미입력: 세운 flux 불일치 ${bad}, 실제로는 세 글자 형이 있었는데 flux가 빠진 세운 ${lost}건 / 600, 그중 conflicts에 대운 미입력 기록 ${recorded}건`)
    expect(bad).toBe(0)
  }, 300_000)
})

// ─────────────────────────────────────────── 1. 대표 원칙 위반 재시도

describe("QA-1 대표 원칙 위반 재시도", () => {
  const charts = (() => {
    const rnd = mulberry32(31337)
    return Array.from({ length: 12 }, (_, i) => randomBirthChart(rnd, i % 3 !== 0))
  })()

  it("원칙 2: 얼린(freeze) RuleAnalysis로 625가지 MBTI 조합을 돌려도 RuleAnalysis·innate·touches·tone이 그대로", async () => {
    for (const c of charts.slice(0, 4)) {
      await tick()
      const a = luckAnalysis(c)
      const snap = JSON.stringify(a)
      deepFreeze(a)
      const daeun = curDaeun(c)
      const ref = buildExpressionReport({ analysis: a, luck: { daeun, seunYear: 2026 } }, { tableCheck: false })
      for (const mb of allMbtiCombos()) {
        const r = buildExpressionReport({ analysis: a, self: { mbti: mb, facts: [] }, luck: { daeun, seunYear: 2026 } }, { tableCheck: false })
        expect(r.innate).toEqual(ref.innate)
        expect(r.luck.map((l) => [l.ganzhi, l.touches, l.tone, l.activates])).toEqual(ref.luck.map((l) => [l.ganzhi, l.touches, l.tone, l.activates]))
        expect(r.archetype).toEqual(ref.archetype)
        expect([...r.gaeun].sort()).toEqual([...ref.gaeun].sort())
      }
      expect(JSON.stringify(a)).toBe(snap)
    }
  }, 300_000)

  it("원칙 3·계약 §6: MBTI만(625 조합 × 12원국) → developed 0건, dormant 0건, low 신호 0건", async () => {
    let dev = 0, dor = 0, low = 0
    for (const c of charts) {
      const a = analyzeRules(c)
      for (const mb of allMbtiCombos()) {
        await tick()
        const r = buildExpressionReport({ analysis: a, self: { mbti: mb, facts: [] } }, { tableCheck: false })
        for (const x of r.readings) {
          if (x.status === "developed") dev++
          if (x.status === "dormant") dor++
          if (x.self.signal === "low") low++
        }
      }
    }
    console.log(`[QA-1] MBTI만: developed ${dev}, dormant ${dor}, low ${low}`)
    expect(dev).toBe(0)
    expect(dor).toBe(0)
    expect(low).toBe(0)
  }, 300_000)

  it("계약 §6: 상황 사실(직업 상태·최근 변화·지난 일) 모든 값 × MBTI 조합 → developed 0건 / 같은 차원 기질 답 하나 더하면 developed 가능", async () => {
    // faint 묶음 차원이 있는 원국을 고른다
    const rnd = mulberry32(8)
    let found = 0, dev = 0, devWithTrait = 0
    for (let t = 0; t < 400 && found < 15; t++) {
      const c = randomBirthChart(rnd, true)
      const a = analyzeRules(c)
      const r0 = buildExpressionReport({ analysis: a }, { tableCheck: false })
      if (!r0.innate.some((p) => p.level === "faint" && CORE.includes(p.dimensionId))) continue
      found++
      const sets: UserFact[][] = [...SITUATION_FACTS.map(([q, v]) => [fact(q, v)]), SITUATION_FACTS.map(([q, v]) => fact(q, v))]
      for (let k = 0; k < 30; k++) sets.push([0, 1, 2].map(() => fact(...pick(rnd, SITUATION_FACTS))))
      for (const fs of sets) for (const mb of [undefined, parseMbtiInput("ESTJ").axes, parseMbtiInput("ENFP").axes, parseMbtiInput("ISTJ").axes, parseMbtiInput("ESTP").axes]) {
        const r = buildExpressionReport({ analysis: a, self: { ...(mb ? { mbti: mb } : {}), facts: fs } }, { tableCheck: false })
        dev += r.readings.filter((x) => x.status === "developed").length
      }
      const all = [...TRAIT_FACTS.map(([q, v]) => fact(q, v))]
      const r2 = buildExpressionReport({ analysis: a, self: { facts: all } }, { tableCheck: false })
      devWithTrait += r2.readings.filter((x) => x.status === "developed").length
    }
    console.log(`[QA-1] 상황 사실만 developed ${dev}건(원국 ${found}개), 기질 답 전부 넣으면 developed ${devWithTrait}건`)
    expect(found).toBeGreaterThan(5)
    expect(dev).toBe(0)
    expect(devWithTrait).toBeGreaterThan(0)
  }, 300_000)

  it("원칙 4·D-023: 출력의 사용자 사실은 입력 id뿐, 라벨·기간·입력에 없는 사실이 출력에 안 나온다(무작위 600건)", async () => {
    const rnd = mulberry32(2024)
    for (let i = 0; i < 600; i++) {
      await tick()
      const c = randomBirthChart(rnd, rnd() < 0.7)
      const self = randomSelf(rnd)
      if (self) for (const f of self.facts) { f.label = `비밀라벨_${f.value}_ZQX`; if (rnd() < 0.5) f.period = { fromYear: 1777, toYear: 1778 } }
      const ids = new Set((self?.facts ?? []).map((f) => f.id))
      const r = buildExpressionReport({ analysis: luckAnalysis(c), self, luck: { daeun: curDaeun(c), seunYear: 2026 } }, { tableCheck: false, hourCheck: i % 5 === 0 })
      const s = JSON.stringify(r)
      expect(s.includes("ZQX")).toBe(false)
      expect(/fromYear|toYear|"period"|"topic"|"useAs"|"selfReported"/.test(s)).toBe(false)
      const refs = s.match(/fact:[A-Za-z_]+(?::[a-z_]+)?/g) ?? []
      for (const ref of refs) expect(ids.has(ref.slice(5)), ref).toBe(true)
      for (const x of r.readings) {
        expect(x.inferred).toBe(true)
        for (const f of x.self.from) if (f.startsWith("fact:")) expect(ids.has(f.slice(5))).toBe(true)
        for (const f of x.self.from) if (f.startsWith("mbti:")) expect(self?.mbti?.some((m) => m.axis === f.slice(5))).toBe(true)
      }
      expect(r.inferred).toBe(true)
      for (const p of r.innate) expect(p.basis.length).toBeGreaterThan(0)
    }
  }, 300_000)

  it("원칙 4: source가 user가 아닌 사실·mbti 문항 사실은 기질 근거로 세지 않는다", async () => {
    const a = analyzeRules(charts[1])
    const fake = { ...fact("selfStrength", "planning"), source: "chart" } as unknown as UserFact
    const r = buildExpressionReport({ analysis: a, self: { facts: [fake] } }, { tableCheck: false })
    expect(r.readings.every((x) => x.status === "unknown" && x.self.from.length === 0)).toBe(true)
    const mf = { ...fact("mbti", "ESTJ"), id: "mbti" }
    const r2 = buildExpressionReport({ analysis: a, self: { facts: [mf] } }, { tableCheck: false })
    expect(r2.readings.every((x) => x.self.from.every((f) => f !== "fact:mbti"))).toBe(true)
  })

  it("원칙 5: T/F 축(그리고 S/N 축)은 판정·전략 id를 바꾸지 않는다 — 다섯 가지 답 × 무작위 원국·자기보고 400건, 바뀌는 것은 문체 힌트뿐", async () => {
    const rnd = mulberry32(1212)
    let hintDiff = 0
    for (let i = 0; i < 400; i++) {
      await tick()
      const c = randomBirthChart(rnd, rnd() < 0.7)
      const a = luckAnalysis(c)
      const base = randomSelf(rnd) ?? { facts: [] }
      const ax = i % 2 ? "TF" : "SN"
      const others = (base.mbti ?? []).filter((m) => m.axis !== ax)
      const reps = AXIS_CHOICES[ax].map((tf) => {
        const self: SelfReport = { facts: base.facts, mbti: tf ? [...others, tf] : others }
        return buildExpressionReport({ analysis: a, self, luck: { daeun: curDaeun(c), seunYear: 2026 } }, { tableCheck: false, hourCheck: false })
      })
      // conflicts 중 차원 없는 "missing"(응답한 축 수·MBTI 없음 안내)은 축 응답 유무에 따라 달라지는 것이 맞다 — 판정 기록만 비교
      const outs = reps.map((r) => JSON.stringify([r.innate, r.readings, r.luck, r.gaeun, r.conflicts.filter((x) => x.dimensionId || x.kind !== "missing")]))
      for (const o of outs) expect(o).toBe(outs[0])
      if (new Set(reps.map((r) => r.styleHints.join(","))).size > 1) hintDiff++
    }
    expect(hintDiff).toBeGreaterThan(0)
  }, 300_000)

  it("원칙 3·§6.2 규칙 1: MBTI는 low를 만들지 않는다 — 사실 1~2개(666묶음) × MBTI 5종 × 원국 3개: low면 MBTI를 뺀 같은 입력도 low", async () => {
    const pool = [...TRAIT_FACTS, ...SITUATION_FACTS]
    const factSets: UserFact[][] = []
    for (let i = 0; i < pool.length; i++) {
      factSets.push([fact(...pool[i])])
      for (let j = i + 1; j < pool.length; j++) factSets.push([fact(...pool[i]), fact(...pool[j])])
    }
    const rnd = mulberry32(4711)
    // grain 방향이 서로 다른 원국 셋(steady·edge·balanced)
    const want: Lean[] = ["steady", "edge", "balanced"]
    const picked: RuleAnalysis[] = []
    for (let t = 0; t < 500 && picked.length < 3; t++) {
      const a = analyzeRules(randomBirthChart(rnd, true))
      if (mine(a).grain.lean === want[picked.length] && !mine(a).grain.thin) picked.push(a)
    }
    expect(picked.length).toBe(3)
    let lowWithMbti = 0, lowFromMbti = 0, mbtiChanged = 0
    const MB = ["ESTJ", "INFP", "ESFP", "INTJ", "ENTP"].map((t) => parseMbtiInput(t).axes)
    for (const a of picked) for (const fs of factSets) {
      await tick()
      const r0 = buildExpressionReport({ analysis: a, self: { facts: fs } }, { tableCheck: false, hourCheck: false })
      for (const mb of MB) {
        const r = buildExpressionReport({ analysis: a, self: { mbti: mb, facts: fs } }, { tableCheck: false, hourCheck: false })
        r.readings.forEach((x, k) => {
          const y = r0.readings[k]
          if (x.self.signal === "low") { lowWithMbti++; if (y.self.signal !== "low") lowFromMbti++ }
          if (x.self.signal !== y.self.signal || x.status !== y.status) mbtiChanged++
        })
      }
    }
    console.log(`[QA-1] 사실+MBTI에서 low ${lowWithMbti}건, 그중 MBTI를 빼면 low가 아닌 것(=MBTI가 만든 low) ${lowFromMbti}건, MBTI가 신호·상태를 바꾼 경우 ${mbtiChanged}건`)
    expect(lowWithMbti).toBeGreaterThan(0) // 사실 low 경로는 살아 있음
    expect(lowFromMbti).toBe(0)
  }, 300_000)

  it("§6.2 규칙 2·3: 확신 없음 답은 신호 효과 0(문체 힌트만) / 신호 줄 3개 모두 실제로 판정을 바꾼다(죽은 줄 0) / 힌트 6개 모두 출력된다", async () => {
    const rnd = mulberry32(9090)
    const pool: RuleAnalysis[] = []
    for (let t = 0; t < 60; t++) pool.push(analyzeRules(randomBirthChart(rnd, true)))
    let unsureEffect = 0, unsureChecked = 0
    const lineChanged: Record<string, number> = Object.fromEntries(MBTI_SIGNAL_LINKS.map((k) => [k, 0]))
    const hintsSeen = new Set<string>()
    const factPool = [[], [fact("selfStrength", "planning")], [fact("selfStrength", "creativity")], [fact("selfStrength", "planning"), fact("selfStrength", "creativity")]] as UserFact[][]
    for (const [ai, a] of pool.entries()) {
      await tick()
      // 625조합 전수 비교는 원국 8개에만(시간 — 전체 시험 동시 실행 부하를 줄임), 신호 줄 검사는 60개 전부
      if (ai < 8) for (const fs of factPool) for (const mb of allMbtiCombos()) {
        const r = buildExpressionReport({ analysis: a, self: { mbti: mb, facts: fs } }, { tableCheck: false, hourCheck: false })
        for (const h of r.styleHints) hintsSeen.add(h)
        // 확신 없는 답을 모두 뺀 입력과 판정이 같아야 한다
        const sureOnly = mb.filter((m) => m.sure)
        if (sureOnly.length !== mb.length) {
          const r2 = buildExpressionReport({ analysis: a, self: { mbti: sureOnly, facts: fs } }, { tableCheck: false, hourCheck: false })
          unsureChecked++
          if (JSON.stringify([r.readings, r.luck]) !== JSON.stringify([r2.readings, r2.luck])) unsureEffect++
        }
      }
      // 신호 줄마다: 그 축 답 하나만 있을 때와 없을 때 상태가 바뀌는 원국이 있는가
      for (const key of MBTI_SIGNAL_LINKS) {
        const [axis, pole, dim] = key.split("|")
        const r1 = buildExpressionReport({ analysis: a, self: { mbti: [{ axis: axis as MbtiAxisReport["axis"], pole, sure: true }], facts: [] } }, { tableCheck: false, hourCheck: false })
        const r0 = buildExpressionReport({ analysis: a, self: { facts: [] } }, { tableCheck: false, hourCheck: false })
        if (reading(r1, dim).status !== reading(r0, dim).status) lineChanged[key]++
      }
    }
    console.log(`[QA-1] 확신 없음 답이 판정을 바꾼 경우 ${unsureEffect} / 비교 ${unsureChecked}, 신호 줄별 상태를 바꾼 원국 수(60개 중) ${JSON.stringify(lineChanged)}, 나온 힌트 ${[...hintsSeen].sort().join(",")}`)
    expect(unsureEffect).toBe(0)
    for (const [k, v] of Object.entries(lineChanged)) expect(v, k).toBeGreaterThan(0)
    expect([...hintsSeen].sort()).toEqual(["style.bigPictureFirst", "style.concreteFirst", "style.peopleFirst", "style.reasonFirst", "style.talkFirst", "style.writeFirst"])
    // 표 자체: 신호 줄은 MBTI_SIGNAL_LINKS 세 줄과 같고, 그 밖 줄·low·sureOnly false·S/N 신호는 표 검증이 막는다
    expect(RAW_BRIDGE.links.map((l: Loose) => `${l.axis}|${l.pole}|${l.dimensionId}|${l.direction}`).sort()).toEqual([...MBTI_SIGNAL_LINKS].sort())
    const bad = (mut: (b: Loose) => void): boolean => { const b = clone(RAW_BRIDGE); mut(b); try { makeExpressionTables(RAW_DIMS, b); return false } catch (e) { return e instanceof ExpressionTableError } }
    expect(bad((b) => b.links.push({ dimensionId: "realism", axis: "SN", pole: "S", direction: "high", weight: 1, grade: "B", sureOnly: true, claim: "service-model" }))).toBe(true)
    expect(bad((b) => b.links.push({ dimensionId: "duty", axis: "JP", pole: "J", direction: "high", weight: 1, grade: "B", sureOnly: true, claim: "service-model" }))).toBe(true)
    expect(bad((b) => b.links.push({ dimensionId: "outward", axis: "EI", pole: "I", direction: "low", weight: 1, grade: "B", sureOnly: true, claim: "service-model" }))).toBe(true)
    expect(bad((b) => { b.links[0].sureOnly = false })).toBe(true)
    expect(bad((b) => { b.links[1].direction = "edge" })).toBe(true)
    // 줄을 빼는 것(죽은 줄의 반대)은 막는가 — 기록만
    const removable = !bad((b) => { b.links.splice(2, 1) })
    console.log(`[QA-1] 신호 줄 하나(P→grain edge)를 지운 표: 검증 ${removable ? "통과(줄 삭제는 허용)" : "막힘"}`)
  }, 300_000)

  it("§3.7.5 grain 자기보고 독립 재구현: 사실(planning +, creativity −)·J/P 확신 → selfLean → 원국 방향 상대 신호 → 상태 (시주 있음 1,500건) + outward MBTI 확인 신호", async () => {
    const rnd = mulberry32(3757)
    const bad: string[] = []
    const seen: Record<string, number> = {}
    for (let i = 0; i < 1500; i++) {
      if (i % 50 === 0) await tick()
      const c = i % 2 ? randomBirthChart(rnd, true) : synthChart(rnd, true)
      const a = analyzeRules(c)
      const g = mine(a).grain
      const facts: UserFact[] = []
      if (rnd() < 0.45) facts.push(fact("selfStrength", "planning"))
      if (rnd() < 0.45) facts.push(fact("selfStrength", "creativity"))
      if (rnd() < 0.3) facts.push(fact(...pick(rnd, SITUATION_FACTS)))
      const jp = pick(rnd, AXIS_CHOICES.JP)
      const ei = pick(rnd, AXIS_CHOICES.EI)
      const mb = [ei, jp].filter((x): x is MbtiAxisReport => !!x)
      const r = buildExpressionReport({ analysis: a, self: { mbti: mb, facts } }, { tableCheck: false, hourCheck: false })
      // ── 독립 계산(grain)
      const f = (facts.some((x) => x.id === "selfStrength:planning") ? 1 : 0) - (facts.some((x) => x.id === "selfStrength:creativity") ? 1 : 0)
      const touched = facts.some((x) => x.id === "selfStrength:planning" || x.id === "selfStrength:creativity")
      const m = jp && jp.sure ? (jp.pole === "J" ? 1 : -1) : 0
      let s: number, fromFactDir = false
      if (touched && f !== 0 && m !== 0 && Math.sign(m) !== Math.sign(f)) { s = f; fromFactDir = true }
      else s = f + m
      if (touched && f !== 0 && Math.sign(s) === Math.sign(f)) fromFactDir = true
      const selfLean = s >= 0.5 ? "steady" : s <= -0.5 ? "edge" : undefined
      let sig: "high" | "low" | "none" = "none"
      if (selfLean) {
        if (g.lean === "balanced" || g.lean === selfLean) sig = "high"
        else sig = fromFactDir ? "low" : "none"
      }
      let st: string
      if (sig === "none") st = "unknown"
      else if (g.level !== "faint") st = sig === "high" ? "expressed" : "dormant"
      else st = sig === "low" ? "quiet" : (fromFactDir ? "developed" : "unknown")
      const x = reading(r, "grain")
      const k = `${g.lean}/${selfLean ?? "-"}/${sig}/${st}`
      seen[k] = (seen[k] ?? 0) + 1
      if (x.self.signal !== sig || (x.self.lean ?? undefined) !== selfLean || x.status !== st || x.self.mbtiOnly !== (!touched && m !== 0))
        bad.push(`${i} chart=${g.level}/${g.lean} f=${f} m=${m} engine=${x.self.signal}/${x.self.lean}/${x.status}/mo=${x.self.mbtiOnly} mine=${sig}/${selfLean}/${st}`)
      if (!touched && m !== 0 && selfLean && g.lean !== "balanced" && g.lean !== selfLean
        && !r.conflicts.some((cf) => cf.dimensionId === "grain" && cf.kind === "chart-vs-self")) bad.push(`${i} MBTI만 반대 결인데 chart-vs-self 없음`)
      if (touched && f !== 0 && m !== 0 && Math.sign(m) !== Math.sign(f) && !r.conflicts.some((cf) => cf.dimensionId === "grain" && cf.kind === "self-vs-self"))
        bad.push(`${i} 사실·MBTI 반대인데 self-vs-self 없음`)
      // ── outward: 닿는 사실 없음 → E 확신만 high(mbtiOnly), 상태는 잠재 있으면 expressed, faint면 unknown
      const o = reading(r, "outward")
      const oSig = ei && ei.sure && ei.pole === "E" ? "high" : "none"
      const oSt = oSig === "none" ? "unknown" : mine(a).level.outward !== "faint" ? "expressed" : "unknown"
      if (o.self.signal !== oSig || o.status !== oSt || o.self.mbtiOnly !== (oSig === "high")) bad.push(`${i} outward engine=${o.self.signal}/${o.status} mine=${oSig}/${oSt}`)
    }
    console.log(`[QA-1] grain 자기보고 1500건 불일치 ${bad.length}, 갈래(원국 방향/본인 방향/신호/상태) ${JSON.stringify(seen)}`, bad.slice(0, 5))
    expect(bad.slice(0, 10)).toEqual([])
    for (const k of ["steady/steady/high/expressed", "edge/edge/high/expressed", "steady/edge/low/dormant", "steady/edge/none/unknown", "balanced/steady/high/developed", "balanced/edge/high/unknown"])
      expect(seen[k] ?? 0, k).toBeGreaterThan(0)
  }, 300_000)

  it("원칙 5: 대응표에 T/F 신호·허용 밖 low·claim 누락·상황 사실 developed를 넣으면 표 검증이 멈춘다(S2 포함)", async () => {
    const tf = clone(RAW_BRIDGE)
    tf.links.push({ dimensionId: "duty", axis: "TF", pole: "T", direction: "high", weight: 1, grade: "B", sureOnly: true, claim: "service-model" })
    expect(() => makeExpressionTables(RAW_DIMS, tf)).toThrow(ExpressionTableError)
    const noclaim = clone(RAW_BRIDGE)
    delete noclaim.links[0].claim
    expect(() => makeExpressionTables(RAW_DIMS, noclaim)).toThrow(ExpressionTableError)
    const d = clone(RAW_DIMS)
    d.dimensions[0].facts.push({ key: "mbti:ESTJ", direction: "high", weight: 1, evidence: "trait" })
    expect(() => makeExpressionTables(d, RAW_BRIDGE)).toThrow(ExpressionTableError)
    const d2 = clone(RAW_DIMS)
    d2.dimensions[3].facts.push({ key: "occupationStatus:employed", direction: "high", weight: 1, evidence: "trait" })
    expect(() => makeExpressionTables(d2, RAW_BRIDGE)).toThrow(ExpressionTableError)
    // S2: developedEvidence에 situation → 막혀야 함
    const d3 = clone(RAW_DIMS)
    d3.self.developedEvidence = ["trait", "situation"]
    expect(() => makeExpressionTables(d3, RAW_BRIDGE)).toThrow(ExpressionTableError)
    // 폐지 필드 되살리기
    const d4 = clone(RAW_DIMS)
    d4.self.unsureFactor = 0.5
    expect(() => makeExpressionTables(d4, RAW_BRIDGE)).toThrow(ExpressionTableError)
    // grain 사실 방향에 high
    const d5 = clone(RAW_DIMS)
    d5.dimensions.find((x: Loose) => x.id === "grain").facts[0].direction = "high"
    expect(() => makeExpressionTables(d5, RAW_BRIDGE)).toThrow(ExpressionTableError)
  })

  it("0.1.0 S1·S3·S5·S6: 자기보고 모양 오류 → EngineInputError / 소문자 MBTI는 모든 경로 확신 없음 / 자유 입력 사실 id 거부(원문 미노출) / gap에는 차원 기록만", async () => {
    const a = analyzeRules(TEMPLATE)
    const errOf = (f: () => unknown): Error | null => { try { f(); return null } catch (e) { return e as Error } }
    for (const self of [{ facts: 5 }, { facts: "abc" }, { facts: [], mbti: "ESTJ" }, { facts: [{ source: "user", id: 3 }] }, { facts: [{ source: "user", id: "selfStrength:planning", questionId: 5 }] }, 7, { facts: [], mbti: [{ axis: "EI", pole: "Q", sure: true }] }, { facts: [], mbti: [{ axis: "XY", pole: "E", sure: true }] }]) {
      const e = errOf(() => buildExpressionReport({ analysis: a, self: self as never }, { tableCheck: false, hourCheck: false }))
      expect(e?.name, JSON.stringify(self)).toBe("EngineInputError")
    }
    // S3
    expect(parseMbtiInput("eSTJ").axes.find((x) => x.axis === "EI")!.sure).toBe(false)
    expect(parseMbtiInput({ EI: "e" }).axes.find((x) => x.axis === "EI")!.sure).toBe(false)
    expect(parseMbtiInput({ EI: "E?" }).axes.find((x) => x.axis === "EI")!.sure).toBe(false)
    expect(parseMbtiInput({ EI: "E" }).axes.find((x) => x.axis === "EI")!.sure).toBe(true)
    const viaAxes = buildExpressionReport({ analysis: a, self: { mbti: [{ axis: "EI", pole: "e", sure: true }], facts: [] } }, { tableCheck: false, hourCheck: false })
    expect(reading(viaAxes, "outward").self.signal).toBe("none")
    // S5: 자유 입력이 id로
    for (const id of ["selfStrength:planning; DROP", "홍길동 010-1234-5678", "selfStrength:Planning", "<script>x</script>", "a:b:c"]) {
      const f = { ...fact("selfStrength", "planning"), id }
      const e = errOf(() => buildExpressionReport({ analysis: a, self: { facts: [f] } }, { tableCheck: false, hourCheck: false }))
      expect(e?.name, id).toBe("EngineInputError")
      expect(e!.message.includes(id), id).toBe(false)
    }
    // S6: gap 근거의 conflict는 모두 dimensionId가 있다(시주 모름·MBTI 없음 같은 전체 기록 제외)
    const rnd = mulberry32(66)
    let gapRefs = 0
    for (let i = 0; i < 200; i++) {
      const c = randomBirthChart(rnd, rnd() < 0.6)
      const r = buildExpressionReport({ analysis: analyzeRules(c), self: randomSelf(rnd) }, { tableCheck: false, hourCheck: i % 4 === 0 })
      for (const ref of r.sections.gap.filter((x) => x.startsWith("conflict:"))) {
        gapRefs++
        const cf = r.conflicts[Number(ref.slice(9))]
        expect(cf, ref).toBeDefined()
        expect(cf.dimensionId, `${ref} ${cf.note}`).toBeDefined()
        expect(["chart-vs-self", "self-vs-self", "missing", "chart-uncertain"]).toContain(cf.kind)
      }
    }
    expect(gapRefs).toBeGreaterThan(0)
  })

  it("원칙 5·계약 §7-7: 금지 표현 — 동봉 표·엔진 출력 0 / 0.1.0 변형 18개 전부 막힘 / 새 우회 시도·정상 문구 오탐 기록", async () => {
    expect(findForbiddenPhrases(RAW_DIMS)).toEqual([])
    expect(findForbiddenPhrases(RAW_BRIDGE)).toEqual([])
    const rnd = mulberry32(3)
    for (let i = 0; i < 200; i++) {
      const c = randomBirthChart(rnd, rnd() < 0.6)
      const r = buildExpressionReport({ analysis: luckAnalysis(c), self: randomSelf(rnd), luck: { daeun: curDaeun(c), seunYear: 2026 } }, { tableCheck: false, hourCheck: i % 4 === 0 })
      expect(findForbiddenPhrases(r)).toEqual([])
    }
    const blockedByTable = (v: string): boolean => {
      const b = clone(RAW_BRIDGE)
      b.note = v
      try { makeExpressionTables(RAW_DIMS, b); return false } catch (e) { return e instanceof ExpressionTableError }
    }
    for (const p of ["과학적으로 입증된 관계", "검증된 상관관계", "MBTI가 사주를 바꾼다"]) expect(blockedByTable(p), p).toBe(true)
    const OLD = [
      "검증된상관", "검증된  상관", "검증 된 상관", "상관관계가 검증되었다", "상관관계가 입증되었다", "과학적 근거가 있다", "과학적으로 밝혀진",
      "통계적으로 유의", "연구 결과에 따르면", "논문에 따르면", "scientifically proven", "MBTI에 따라 사주가 달라진다", "MBTI가 사주를 바꿉니다",
      "MBTI 때문에 운이 바뀐다", "사주와 MBTI는 상관이 있다", "당신의 사주는 INTJ", "이 사주면 I일 것", "MBTI가 사주를 결정짓는다",
    ]
    const oldLeak = OLD.filter((v) => !blockedByTable(v))
    // 새 우회 시도(금지해야 할 뜻) — 패턴을 보기 전에 만든 것 + 패턴을 본 뒤 만든 것
    const NEW = [
      "과.학.적.으.로 입증", "과학·적으로 입증", "과학이 증명한 사실", "학계에서 인정된 연관성", "두 체계의 관련성은 이미 확인되었습니다",
      "MBTI 유형별로 모아 보니 사주 오행과 겹치는 비율이 높았습니다", "검증을 거친 연관성", "검증 끝난 상관", "통계적으로 의미 있는 차이",
      "statistically meaningful", "proven by science", "evidence-based 사주 MBTI 분석", "한 조사에서 드러났듯", "하버드 연구진이 밝힌 바",
      "전문가들은 MBTI와 사주가 같은 것을 본다고 말한다", "엠비티아이가 사주를 바꾼다", "МВТІ가 사주를 바꾼다", "MBTI가 팔자를 고친다",
      "MBTI로 운명이 뒤집힌다", "사주를 보면 당신은 외향형일 것", "이 사주는 I 성향일 확률이 높다", "사주로 보아 당신은 엔프피",
      "E라 친구가 많았겠어요", "외향형이니 친구가 많았겠다", "J 성향 덕분에 직장에서 인정받았을 것", "INTJ면 경금", "ENFP는 봉황",
      "P는 게으르다", "I는 표현력이 없다", "MBTI 궁합으로 채용을 결정하세요",
    ]
    const newLeak = NEW.filter((v) => forbiddenHitsOf(v).length === 0)
    // 정상 문구(막히면 안 되는 뜻) — 면책·명리 서술·조언 문체
    const NORMAL = [
      "명리 해석은 과학적으로 입증된 예측이 아니다", "과학적 근거는 없습니다", "사주와 MBTI의 상관은 확인된 바 없습니다", "MBTI는 사주를 바꾸지 않습니다",
      "MBTI에 따라 조언 말투만 달라지고 사주 풀이는 바뀌지 않습니다", "사주로 MBTI를 맞히지 않습니다", "원국은 ENFP를 알려 주지 않습니다",
      "J라서 그렇다는 뜻은 아니에요", "운명비서 자기이해 모델의 가설입니다", "미래를 맞히는 방법이 아닙니다", "관련 연구가 없어 검증되지 않은 가설입니다",
      "상관이 투출해 말로 따지고 검증하려는 편", "상관의 기운은 고칠 점을 밝혀 말하는 쪽", "식신과 상관이 함께 있어 증명하듯 보여 주는 재주",
      "풀이 근거를 밝혀 둡니다", "근거: 월지 정기에서 확인된 정관", "대운이 바뀌는 해에는 속도를 조절해 보세요", "결정은 본인이 합니다",
      "입력한 시각이 절입 시각과 정확히 일치하면 다시 확인해 주세요", "유의하세요", "E를 고르셨다면 말로 먼저 꺼내 보는 방식이 편할 수 있어요",
    ]
    const fp = NORMAL.map((v) => [v, forbiddenHitsOf(v)] as const).filter(([, h]) => h.length > 0)
    console.log(`[QA-1] 금지어 목록 ${EXPRESSION_FORBIDDEN_PHRASES.length}개 + 패턴. 0.1.0 변형 ${OLD.length}개 중 통과(누출) ${oldLeak.length}: ${oldLeak.join(" | ")}`,
      `\n[QA-1] 새 우회 시도 ${NEW.length}개 중 누출 ${newLeak.length}: ${newLeak.join(" | ")}`,
      `\n[QA-1] 정상 문구 ${NORMAL.length}개 중 오탐 ${fp.length}: ${fp.map(([v, h]) => `${v} ⇒ ${h.join(",")}`).join(" | ")}`)
    expect(oldLeak).toEqual([])
  })
})

describe("QA-2 같은 원국 + 다른 MBTI/경험 → 판정은 달라지고 규칙 엔진 값은 같다", () => {
  it("원국 40개: 16유형 → readings·luck.strategy가 달라지는 경우가 있고 RuleAnalysis는 깊은 비교로 같다 / MBTI만으로 움직인 차원은 outward·grain뿐", async () => {
    const rnd = mulberry32(64)
    const types = ["INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP", "ENFJ", "ENFP", "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP"]
    let diffReadings = 0, diffStrategy = 0, chartsN = 0
    const dimMovedByMbti = new Set<string>()
    for (let i = 0; i < 40; i++) {
      await tick()
      const c = randomBirthChart(rnd, true)
      const a = luckAnalysis(c)
      const snap = JSON.stringify(a)
      const daeun = curDaeun(c)
      const outs = types.map((t) => buildExpressionReport({ analysis: a, self: { mbti: parseMbtiInput(t).axes, facts: [] }, luck: { daeun, seunYear: 2026 } }, { tableCheck: false }))
      expect(JSON.stringify(a)).toBe(snap)
      expect(JSON.stringify(luckAnalysis(c))).toBe(snap)
      for (const o of outs) expect(o.innate).toEqual(outs[0].innate)
      const rs = new Set(outs.map((o) => JSON.stringify(o.readings.map((x) => x.status))))
      const ss = new Set(outs.map((o) => JSON.stringify(o.luck.map((l) => l.strategy))))
      if (rs.size > 1) diffReadings++
      if (ss.size > 1) diffStrategy++
      for (const d of DIMS) if (new Set(outs.map((o) => `${reading(o, d).status}/${reading(o, d).self.signal}`)).size > 1) dimMovedByMbti.add(d)
      chartsN++
    }
    console.log(`[QA-2] 원국 ${chartsN}개 중 MBTI 16유형으로 readings 달라짐 ${diffReadings}, strategy 달라짐 ${diffStrategy}. MBTI만으로 상태·신호가 움직인 차원: ${[...dimMovedByMbti].join(",")}`)
    expect(diffReadings).toBeGreaterThan(0)
    expect(diffStrategy).toBeGreaterThan(0)
    expect([...dimMovedByMbti].sort()).toEqual(["grain", "outward"])
  }, 300_000)

  it("같은 원국 + 같은 MBTI + 경험 다름 → readings가 달라진다 / 사실 순서를 바꿔도 상태는 같다", async () => {
    const rnd = mulberry32(65)
    let diff = 0
    for (let i = 0; i < 40; i++) {
      const c = randomBirthChart(rnd, true)
      const a = analyzeRules(c)
      const mb = parseMbtiInput(pick(rnd, ["ISTJ", "ENFP", "INTP"])).axes
      const f1 = [fact("selfStrength", "communication"), fact("workStyle", "people_facing")]
      const f2 = [fact("selfStrength", "learning"), fact("workStyle", "solo_deep"), fact("selfWeakness", "saving")]
      const r1 = buildExpressionReport({ analysis: a, self: { mbti: mb, facts: f1 } }, { tableCheck: false })
      const r2 = buildExpressionReport({ analysis: a, self: { mbti: mb, facts: f2 } }, { tableCheck: false })
      if (JSON.stringify(r1.readings) !== JSON.stringify(r2.readings)) diff++
      expect(r1.innate).toEqual(r2.innate)
      const r2b = buildExpressionReport({ analysis: a, self: { mbti: mb, facts: [...f2].reverse() } }, { tableCheck: false })
      expect(r2b.readings.map((x) => x.status)).toEqual(r2.readings.map((x) => x.status))
    }
    expect(diff).toBe(40)
  }, 120_000)

  it("MBTI 신호 도달 범위(전수 625조합 × grain 방향이 다른 원국): 사실 없이 MBTI만이면 outward·grain만 high, low 없음 / 사실이 닿은 차원에서 MBTI가 신호를 바꾸는 경우", async () => {
    const rnd = mulberry32(6400)
    const picked: RuleAnalysis[] = []
    const leansWanted: Lean[] = ["steady", "edge", "balanced"]
    for (let t = 0; t < 600 && picked.length < 3; t++) {
      const a = analyzeRules(randomBirthChart(rnd, true))
      if (mine(a).grain.lean === leansWanted[picked.length] && !mine(a).grain.thin) picked.push(a)
    }
    expect(picked.length).toBe(3)
    const reach: Record<string, Set<string>> = Object.fromEntries(DIMS.map((d) => [d, new Set<string>()]))
    for (const a of picked) for (const mb of allMbtiCombos()) {
      const r = buildExpressionReport({ analysis: a, self: { mbti: mb, facts: [] } }, { tableCheck: false, hourCheck: false })
      for (const x of r.readings) reach[x.dimensionId].add(x.self.signal)
    }
    const factSets: UserFact[][] = []
    const pool = [...TRAIT_FACTS, ...SITUATION_FACTS]
    for (let i = 0; i < pool.length; i++) {
      factSets.push([fact(...pool[i])])
      for (let j = i + 1; j < pool.length; j++) factSets.push([fact(...pool[i]), fact(...pool[j])])
    }
    let changed = 0
    const changedDims: Record<string, number> = {}
    for (const fs of factSets) {
      await tick()
      const r0 = buildExpressionReport({ analysis: picked[0], self: { facts: fs } }, { tableCheck: false, hourCheck: false })
      for (const mb of [parseMbtiInput("ESTJ").axes, parseMbtiInput("INFP").axes, parseMbtiInput("ESFP").axes, parseMbtiInput("INTJ").axes]) {
        const r = buildExpressionReport({ analysis: picked[0], self: { mbti: mb, facts: fs } }, { tableCheck: false, hourCheck: false })
        r.readings.forEach((x, k) => {
          const y = r0.readings[k]
          if (y.self.from.some((f) => f.startsWith("fact:")) && x.self.signal !== y.self.signal) { changed++; changedDims[x.dimensionId] = (changedDims[x.dimensionId] ?? 0) + 1 }
        })
      }
    }
    const reachOut = Object.fromEntries(Object.entries(reach).map(([k, v]) => [k, [...v].sort()]))
    console.log("[QA-2] MBTI만일 때 차원별 나올 수 있는 신호(원국 steady·edge·balanced):", JSON.stringify(reachOut),
      `\n[QA-2] 사실이 닿은 차원에서 MBTI가 신호를 바꾼 경우 ${changed}건 (차원별 ${JSON.stringify(changedDims)}) / 사실 조합 ${factSets.length} × MBTI 4`)
    for (const d of DIMS) {
      if (d === "outward" || d === "grain") expect(reachOut[d], d).toEqual(["high", "none"])
      else expect(reachOut[d], d).toEqual(["none"])
    }
  }, 300_000)
})

// ─────────────────────────────────────────── 6. 결정론·잘못된 입력

describe("QA-6 결정론·잘못된 입력", () => {
  it("1,000회 무작위: 같은 입력 두 번(복제본·얼린 입력) → JSON 동일, 입력 불변", async () => {
    const rnd = mulberry32(1000)
    for (let i = 0; i < 1000; i++) {
      await tick()
      const c = randomBirthChart(rnd, rnd() < 0.85)
      const a = luckAnalysis(c)
      const self = randomSelf(rnd)
      const inp = { analysis: a, self, luck: { daeun: curDaeun(c), seunYear: 2026 } }
      const o = { tableCheck: i % 10 === 0, hourCheck: i % 10 === 0 }
      const x = JSON.stringify(buildExpressionReport(clone(inp), o))
      const frozen = deepFreeze(clone(inp))
      const y = JSON.stringify(buildExpressionReport(frozen, o))
      expect(y).toBe(x)
    }
  }, 600_000)

  it("잘못된 입력은 명확한 오류(EngineInputError/ExpressionTableError), 조용히 넘어가지 않는다", async () => {
    const a = analyzeRules(TEMPLATE)
    const errName = (f: () => unknown): string => { try { f(); return "no-error" } catch (e) { return (e as Error).name + ":" + (e as Error).message.slice(0, 40) } }
    const cases: Record<string, string> = {
      nullInput: errName(() => buildExpressionReport(null as never)),
      emptyAnalysis: errName(() => buildExpressionReport({ analysis: {} as never })),
      noStrength: errName(() => buildExpressionReport({ analysis: { ...a, strength: undefined } as never })),
      factsNotArray: errName(() => buildExpressionReport({ analysis: a, self: { facts: 5 as never } })),
      factsString: errName(() => buildExpressionReport({ analysis: a, self: { facts: "abc" as never } })),
      mbtiNotArray: errName(() => buildExpressionReport({ analysis: a, self: { facts: [], mbti: "ESTJ" as never } })),
      badDaeunIndex: errName(() => buildExpressionReport({ analysis: a, luck: { daeun: { luckIndex: 99, daeunIndex: 1 } } })),
    }
    const tbl = (mut: (d: Loose, b: Loose) => void): string => {
      const d = clone(RAW_DIMS), b = clone(RAW_BRIDGE)
      mut(d, b)
      return errName(() => makeExpressionTables(d, b))
    }
    const tables: Record<string, string> = {
      badRule: tbl((d) => { d.dimensions[0].rule = "exp.lv.nope" }),
      hourMin13: tbl((d) => { d.sensitivity.hourStableMin = 13 }),
      faintPresent: tbl((d) => { d.levels.present.push("faint") }),
      mbtiOnlyFactor1: tbl((d) => { d.self.mbtiOnlyFactor = 1 }),
      badFactValue: tbl((d) => { d.dimensions[0].facts.push({ key: "selfStrength:flying", direction: "high", weight: 1, evidence: "trait" }) }),
      negWeight: tbl((d) => { d.dimensions[0].facts[0].weight = -1 }),
      thresholdsSwapped: tbl((d) => { d.dimensions[0].params.rootedStrong = 0.1 }),
      tableNotKr: tbl((d) => { d.hiddenStemTable = "cn-lunarjs" }),
      forbiddenInStrategy: tbl((d) => { d.strategies.catalog["exp.st.expand"] = "과학적으로 입증된 방법" }),
      tfStyleOk: tbl((_d, b) => { b.styleHints.push({ axis: "TF", pole: "T", hint: "style.x" }) }),
      highAtZero: tbl((d) => { d.self.highAt = 0 }),
      bigHighAt: tbl((d) => { d.self.highAt = 99 }),
      luckMapUnknownDim: tbl((d) => { d.luck.groupMap.bigyeop.activate = "nope" }),
    }
    console.log("[QA-6] 잘못된 입력:", JSON.stringify(cases, null, 1), "\n[QA-6] 잘못된 표:", JSON.stringify(tables, null, 1))
    expect(cases.nullInput).toMatch(/^EngineInputError/)
    expect(cases.emptyAnalysis).toMatch(/^EngineInputError/)
    expect(cases.noStrength).toMatch(/^EngineInputError/)
    for (const k of ["badRule", "hourMin13", "faintPresent", "mbtiOnlyFactor1", "badFactValue", "negWeight", "thresholdsSwapped", "tableNotKr", "forbiddenInStrategy", "luckMapUnknownDim"])
      expect(tables[k], k).toMatch(/^ExpressionTableError/)
  })
})

// ─────────────────────────────────────────── 8. 개인정보·외부 호출

describe("QA-8 개인정보·외부 호출", () => {
  it("출력에 생년월일·성별 원문이 없고, 엔진 실행 중 fetch·네트워크 호출이 없다", async () => {
    const req = createRequire(import.meta.url)
    const http = req("node:http")
    const https = req("node:https")
    const net = req("node:net")
    const calls: string[] = []
    const origFetch = globalThis.fetch
    const o = { hr: http.request, hg: http.get, sr: https.request, sg: https.get, nc: net.connect, ncc: net.createConnection }
    globalThis.fetch = (async () => { calls.push("fetch"); throw new Error("blocked") }) as typeof fetch
    ;(http).request = () => { calls.push("http.request"); throw new Error("blocked") }
    ;(http).get = () => { calls.push("http.get"); throw new Error("blocked") }
    ;(https).request = () => { calls.push("https.request"); throw new Error("blocked") }
    ;(https).get = () => { calls.push("https.get"); throw new Error("blocked") }
    ;(net).connect = () => { calls.push("net.connect"); throw new Error("blocked") }
    ;(net).createConnection = () => { calls.push("net.createConnection"); throw new Error("blocked") }
    try {
      const c = computeChart({ calendar: "solar", year: 1987, month: 11, day: 23, time: { hour: 14, minute: 47 }, gender: "M" })
      const r = buildExpressionReport({
        analysis: luckAnalysis(c),
        self: { mbti: parseMbtiInput("ENFJ").axes, facts: [fact("selfStrength", "planning"), fact("occupationStatus", "employed")] },
        luck: { daeun: curDaeun(c), seunYear: 2026 },
      })
      const s = JSON.stringify(r)
      for (const needle of ["1987", "11-23", "1987-11-23", "14:47", "\"M\"", "gender", "birth", "ENFJ"]) expect(s.includes(needle), needle).toBe(false)
    } finally {
      globalThis.fetch = origFetch
      Object.assign(http, { request: o.hr, get: o.hg })
      Object.assign(https, { request: o.sr, get: o.sg })
      Object.assign(net, { connect: o.nc, createConnection: o.ncc })
    }
    expect(calls).toEqual([])
  })
})
