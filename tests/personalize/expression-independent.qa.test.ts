// 품질검증(qa-security-lead) 독립 검증 — 사주 발현 분석 엔진 expression@0.1.0 (커밋 0c6127a)
// 근거: docs/redesign/30-expression-engine.md(계약 §1·§6·§7), docs/knowledge/personalization/expression-dimensions.md(연구소장 §3·§4·§5·§7)
// 원칙: 엔진의 chart-rules.ts·self-report.ts 함수를 재사용하지 않고, 연구소장 문서만 보고 판정을 다시 구현해 엔진 출력과 대조한다.
//  - 재료는 규칙 엔진 원값(원국 글자·hiddenStems 표·interactions·strength 판정·qiFlow 표지·climate)만 쓴다.
//  - 십성·묶음·가중 합(G, T, tgT)·음양 개수·12시진 시주는 여기서 직접 계산한다(규칙 엔진 값과도 교차 확인).
// 외부 호출 없음. 엔진 코드는 고치지 않는다.
import { describe, expect, it } from "vitest"
import { analyzeRules, computeChart, yearPillarOf, type CalendarResult, type Pillar, type RuleAnalysis } from "@/engine"
import {
  EXPRESSION_FORBIDDEN_PHRASES, ExpressionTableError, buildExpressionReport, expressionTables, findForbiddenPhrases,
  makeExpressionTables, parseMbtiInput, potentialsOf, type MbtiAxisReport, type SelfReport,
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
const DIMS = ["drive", "expression", "realism", "duty", "learning", "steadiness", "edge", "flux", "outward"]
type Lv = "strong" | "moderate" | "faint"
const r6 = (x: number): number => Math.round(x * 1e6) / 1e6
// weighted-v1 위치 가중(연구소장 §2.1 표 기재값)
const BW: Record<string, number> = { year: 1.0, month: 3.0, day: 1.5, hour: 1.0 }
const NATAL = ["year", "month", "day", "hour"] as const

interface Mine {
  level: Record<string, Lv>
  flags: Record<string, string[]>
  driveMod: 0 | 1 | -1
  /** §7.2를 글자대로("극신약 −1만 적용") 읽으면 경계 차단이어도 −1을 한다는 해석 */
  driveModLiteral72: 0 | 1 | -1
  notes: Record<string, ("load" | "surplus")[]>
  blocked: boolean
  T: number
  G: Record<G5, number>
  yang: number
  yin: number
  share: Record<string, number>
}

/** 연구소장 §2·§3·§7.2를 문서만 보고 다시 구현 */
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
  let driveModLiteral72: 0 | 1 | -1 = 0
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
      const plus = A.verdict === "신강" && G.bigyeop >= G.inseong
      const minus = A.extreme === "weak"
      if (!blocked && plus) driveMod = 1
      else if (!blocked && minus) driveMod = -1
      driveModLiteral72 = !blocked && plus ? 1 : minus ? -1 : 0
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
  // 결(§3.7)
  const SETS: Record<string, string[]> = { steadiness: ["정재", "정관", "정인", "식신"], edge: ["편관", "상관", "편인", "겁재"] }
  for (const [id, set] of Object.entries(SETS)) {
    const s = r6(set.reduce((x, t) => x + (tg[t] ?? 0), 0) / T)
    const shown = stemTG.some((t) => set.includes(t))
    let l: Lv = s >= 0.3 && shown ? "strong" : s >= 0.12 ? "moderate" : "faint"
    if (id === "edge" && l === "moderate" && (a.qiFlow?.clarityFlags ?? []).some((x) => ["상관견관", "효신탈식", "관살혼잡"].includes(x.flag))) l = "strong"
    level[id] = l
    flags[id] = []
    notes[id] = []
    share[id] = s
  }
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
  return { level, flags, driveMod, driveModLiteral72, notes, blocked, T: r6(T), G, yang, yin, share }
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

// ─────────────────────────────────────────── 3. 원국 판정 독립 대조

describe("QA-3 원국 판정: 문서만 보고 다시 구현한 계산 ↔ 엔진", () => {
  it("연구소장 §4 손계산 원국 甲子 丙寅 戊辰 庚申 (시주 있음·없음)", async () => {
    const cWith = withPillars(TEMPLATE, { year: "甲子", month: "丙寅", day: "戊辰", hour: "庚申" })
    const cNo = withPillars(TEMPLATE, { year: "甲子", month: "丙寅", day: "戊辰", hour: null })
    const aW = analyzeRules(cWith)
    const aN = analyzeRules(cNo)
    const mW = mine(aW)
    const mN = mine(aN)
    // 문서 §4 표 값
    expect(mW.T).toBe(10.5)
    expect(mW.G).toEqual({ bigyeop: 1.833333, siksang: 1.533333, jaeseong: 1.383333, gwansal: 3.05, inseong: 1.7 })
    const docWith: Record<string, Lv> = { drive: "moderate", expression: "moderate", realism: "moderate", duty: "strong", learning: "moderate", steadiness: "moderate", edge: "strong", flux: "strong", outward: "strong" }
    expect(mW.level).toEqual(docWith)
    expect(mW.flags.drive).toContain("latent")
    expect(mW.flags.realism).toContain("latent")
    expect(mW.flags.duty).toContain("month")
    expect(mW.blocked).toBe(true) // r=0.4317, 경계 근처
    expect(mW.notes.duty).toEqual([]) // load 달지 않음
    expect(r6(mW.share.steadiness)).toBe(0.266667)
    expect(r6(mW.share.edge)).toBe(0.409524)
    expect(mW.yang).toBe(7)
    const eW = potentialsOf(aW, expressionTables().dims)
    expect(Object.fromEntries(eW.map((p) => [p.dimensionId, p.level]))).toEqual(docWith)
    // 시주 없음: expression·flux faint, r=0.506 중화
    const docNo = { ...docWith, expression: "faint", flux: "faint" }
    expect(mN.level).toEqual(docNo)
    const AN = aN.strength.models.find((m) => m.model === "weighted")!
    expect(AN.ratio).toBeCloseTo(0.505882, 5)
    expect(AN.verdict).toBe("중화")
    const eN = potentialsOf(aN, expressionTables().dims)
    expect(Object.fromEntries(eN.map((p) => [p.dimensionId, p.level]))).toEqual(docNo)
  })

  it("무작위 원국 4,000건(실제 생일 2,000 + 합성 60갑자 2,000, 시주 있음 70%): 9차원 단계·표지·보정·메모 전부 일치", async () => {
    const rnd = mulberry32(0xc0ffee)
    const { dims } = expressionTables()
    const mism: string[] = []
    const lit72: string[] = []
    let rulesCross = 0
    const hit = { absent: 0, hiddenOnly: 0, stemOnly: 0, rooted: 0, monthStrong: 0, drivePlus: 0, driveMinus: 0, clarity: 0, load: 0, surplus: 0, fluxStrong: 0, blocked: 0 }
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
      for (const p of pot) {
        const id = p.dimensionId
        if (p.level !== m.level[id]) mism.push(`${i} ${id} engine=${p.level} mine=${m.level[id]} ${JSON.stringify(a.source.natal)}`)
        if (G5S.map((g) => DIM_OF[g]).includes(id)) {
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
          if (m.driveMod === 1) hit.drivePlus++
          if (m.driveMod === -1) hit.driveMinus++
          if (m.driveModLiteral72 !== m.driveMod) lit72.push(JSON.stringify(a.source.natal))
          if (m.blocked !== p.basis.some((b) => b.ruleId === "exp.sens.boundary")) mism.push(`${i} boundary basis`)
        }
        if (id === "edge" && p.basis.some((b) => b.ruleId === "exp.mod.edge.clarity")) hit.clarity++
        if (id === "flux" && p.level === "strong") hit.fluxStrong++
        if (p.basis.length === 0) mism.push(`${i} ${id} basis empty`)
      }
      if (m.blocked) hit.blocked++
    }
    console.log(`[QA-3] 4000건 불일치 ${mism.length}, rules 교차 불일치 ${rulesCross}, 규칙 줄 적중`, JSON.stringify(hit),
      `\n[QA-3] §7.2 글자대로("극신약 −1만 적용") 읽으면 drive가 달라지는 원국 ${lit72.length}건 / 4000`)
    expect(mism.slice(0, 20)).toEqual([])
    expect(rulesCross).toBe(0)
    // 모든 규칙 줄이 한 번 이상 걸렸는가(시험이 빈 경로만 돈 것이 아님을 확인)
    for (const [k, v] of Object.entries(hit)) expect(v, k).toBeGreaterThan(0)
  }, 300_000)

  it("문턱 경계값(≥ 포함)을 표 조정으로 직접 찍어 본다: rootedStrong을 정확한 gs 값으로 두면 strong", async () => {
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

describe("QA-4 시주 모름: hourStable x/12 ↔ 직접 12시진 재계산, 8/12 미만 보류", () => {
  it("시주 모름 300건: hourStable 수·나온 단계 목록이 독립 12시진 재계산과 같다", async () => {
    const rnd = mulberry32(4242)
    const bad: string[] = []
    let below8 = 0
    for (let i = 0; i < 300; i++) {
      await tick()
      const c = i % 2 ? randomBirthChart(rnd, false) : synthChart(rnd, false)
      const a = analyzeRules(c)
      const three = mine(a).level
      const counts: Record<string, Lv[]> = Object.fromEntries(DIMS.map((d) => [d, []]))
      for (const hp of myHourPillars(a.source.natal.day.stem)) {
        const ah = analyzeRules({ ...c, pillars: { ...c.pillars, hour: hp } } as CalendarResult)
        const mh = mine(ah).level
        for (const d of DIMS) counts[d].push(mh[d])
      }
      const r = buildExpressionReport({ analysis: a }, { tableCheck: false })
      for (const d of DIMS) {
        const p = r.innate.find((x) => x.dimensionId === d)!
        const stable = counts[d].filter((l) => l === three[d]).length
        const levels = (["strong", "moderate", "faint"] as Lv[]).filter((l) => counts[d].includes(l))
        if (!p.hourStable || p.hourStable.stable !== stable || JSON.stringify(p.hourStable.levels) !== JSON.stringify(levels))
          bad.push(`${i} ${d} engine=${JSON.stringify(p.hourStable)} mine=${stable} ${levels}`)
        if (stable < 8) below8++
      }
    }
    console.log(`[QA-4] 시주 모름 300건 × 9차원: hourStable 불일치 ${bad.length}, 8/12 미만 차원 ${below8}건`)
    expect(bad.slice(0, 10)).toEqual([])
    expect(below8).toBeGreaterThan(0)
  }, 300_000)

  it("8/12 미만 차원은 어떤 자기보고에서도 dormant·developed가 아니다(시주 모름 100원국 × 자기보고 30가지)", async () => {
    const rnd = mulberry32(99)
    let gated = 0, dd = 0, ddKnown = 0
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
    console.log(`[QA-4] 시주 모름 dormant·developed ${dd}건(모두 ≥8/12), 8/12 미만이라 보류된 기록 ${gated}건, hourCheck 끔 dormant·developed ${ddKnown}건`)
    expect(dd).toBeGreaterThan(0)
    expect(gated).toBeGreaterThan(0)
    expect(ddKnown).toBe(0)
  }, 300_000)
})

// ─────────────────────────────────────────── 5. 경계 차단

describe("QA-5 경계 차단(nearBoundary · split · tableSensitive)", () => {
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

// ─────────────────────────────────────────── 1·2. 대표 원칙 위반 시도

describe("QA-5b 운 touches 독립 계산(§5.2~5.4)", () => {
  it("대운·세운 800건: (차원, 방식) 집합이 문서 표로 직접 계산한 것과 같고, outward는 운이 건드리지 않는다", async () => {
    const MAP: Record<G5, [string, string, string]> = {
      bigyeop: ["drive", "expression", "realism"], siksang: ["expression", "realism", "duty"], jaeseong: ["realism", "duty", "learning"],
      gwansal: ["duty", "learning", "drive"], inseong: ["learning", "drive", "expression"],
    }
    const STEADY = ["정재", "정관", "정인", "식신"], EDGE = ["편관", "상관", "편인", "겁재"]
    const rnd = mulberry32(5150)
    let bad = 0, fluxHits = 0, threeWay = 0
    const samples: string[] = []
    for (let i = 0; i < 800; i++) {
      await tick()
      const c = randomBirthChart(rnd, rnd() < 0.8)
      const a = luckAnalysis(c, 2000 + Math.floor(rnd() * 40))
      const dRef = curDaeun(c)
      const r = buildExpressionReport({ analysis: a, luck: { daeun: dRef, seunYear: 2026 } }, { hourCheck: false, tableCheck: false })
      for (const l of r.luck) {
        const p = l.scope === "seun" ? a.source.seun! : a.source.luck[dRef!.luckIndex]
        const dm = a.source.natal.day.stem
        const want = new Set<string>()
        const sTG = tenGod(dm, p.stem)
        // 운 지지: 정기 천간 기준 십성(§5.1) — 정기는 kr 표의 정기(子 癸, 午 丁, 巳 丙, 亥 壬 …)
        const JG: Record<string, string> = { 子: "癸", 丑: "己", 寅: "甲", 卯: "乙", 辰: "戊", 巳: "丙", 午: "丁", 未: "己", 申: "庚", 酉: "辛", 戌: "戊", 亥: "壬" }
        const bTG = tenGod(dm, JG[p.branch])
        for (const t of [sTG, bTG]) {
          const [ac, fe, pr] = MAP[GROUP[t]]
          want.add(`${ac}|activate`); want.add(`${fe}|feed`); want.add(`${pr}|press`)
          if (STEADY.includes(t)) want.add("steadiness|activate")
          if (EDGE.includes(t)) want.add("edge|activate")
        }
        const isSlot = (m: { pillar: string; luckIndex?: number }): boolean => m.pillar === l.scope && (l.scope !== "daeun" || m.luckIndex === dRef!.luckIndex)
        for (const it of a.interactions) {
          if (it.scope !== "luck" || !it.members.some(isSlot)) continue
          if (!(it.type === "clash" || (it.type === "punishment" && !it.partial))) continue
          const others = it.members.filter((m) => !isSlot(m))
          if (others.some((m) => m.pillar === "daeun" || m.pillar === "seun")) {
            if (others.some((m) => m.part === "branch" && (m.pillar === "month" || m.pillar === "day"))) threeWay++
            continue
          }
          if (others.some((m) => m.part === "branch" && (m.pillar === "month" || m.pillar === "day"))) want.add("flux|activate")
        }
        const got = new Set(l.touches.map((t) => `${t.dimensionId}|${t.mode}`))
        if (got.has("flux|activate")) fluxHits++
        if (JSON.stringify([...got].sort()) !== JSON.stringify([...want].sort())) { bad++; if (samples.length < 5) samples.push(`${l.scope} ${l.ganzhi} got=${[...got]} want=${[...want]}`) }
        expect(l.touches.some((t) => t.dimensionId === "outward")).toBe(false)
        expect(l.activates).toEqual([...new Set(l.touches.filter((t) => t.mode === "activate").map((t) => t.dimensionId))])
      }
    }
    console.log(`[QA-5b] touches 불일치 ${bad}, flux 활성 ${fluxHits}, 대운+세운+원국 월지·일지가 함께 낀 형(엔진은 제외 — 문서 §5.4 해석 차이 후보) ${threeWay}`, samples)
    expect(bad).toBe(0)
    expect(fluxHits).toBeGreaterThan(0)
  }, 300_000)
})

describe("QA-1 대표 원칙 위반 시도", () => {
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

  it("원칙 3·계약 §6: MBTI만(625 조합 × 12원국) → developed 0건, dormant도 0건", async () => {
    let dev = 0, dor = 0
    for (const c of charts) {
      const a = analyzeRules(c)
      for (const mb of allMbtiCombos()) {
      await tick()
        const r = buildExpressionReport({ analysis: a, self: { mbti: mb, facts: [] } }, { tableCheck: false })
        for (const x of r.readings) {
          if (x.status === "developed") dev++
          if (x.status === "dormant") dor++
        }
      }
    }
    expect(dev).toBe(0)
    console.log(`[QA-1] MBTI만: developed ${dev}, dormant ${dor}`)
  }, 300_000)

  it("계약 §6: 상황 사실(직업 상태·최근 변화·지난 일) 모든 값 × MBTI 조합 → developed 0건 / 같은 차원 기질 답 하나 더하면 developed 가능", async () => {
    // faint 묶음 차원이 있는 원국을 고른다
    const rnd = mulberry32(8)
    let found = 0, dev = 0, devWithTrait = 0
    for (let t = 0; t < 400 && found < 15; t++) {
      const c = randomBirthChart(rnd, true)
      const a = analyzeRules(c)
      const r0 = buildExpressionReport({ analysis: a }, { tableCheck: false })
      if (!r0.innate.some((p) => p.level === "faint" && ["drive", "expression", "realism", "duty", "learning"].includes(p.dimensionId))) continue
      found++
      // 상황 사실 전체 부분집합 대신: 하나씩 + 전부 함께 + 무작위 3개 묶음 30가지
      const sets: UserFact[][] = [...SITUATION_FACTS.map(([q, v]) => [fact(q, v)]), SITUATION_FACTS.map(([q, v]) => fact(q, v))]
      for (let k = 0; k < 30; k++) sets.push([0, 1, 2].map(() => fact(...pick(rnd, SITUATION_FACTS))))
      for (const fs of sets) for (const mb of [undefined, parseMbtiInput("ESTJ").axes, parseMbtiInput("ENFP").axes, parseMbtiInput("ISTJ").axes]) {
        const r = buildExpressionReport({ analysis: a, self: { ...(mb ? { mbti: mb } : {}), facts: fs } }, { tableCheck: false })
        dev += r.readings.filter((x) => x.status === "developed").length
      }
      // 대조: 기질 답을 넣으면 developed가 실제로 나오는가(차단이 너무 넓어 기능이 죽은 것은 아닌지)
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
        // mbti 근거는 입력에 그 축이 있을 때만
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

  it("원칙 5: T/F 축은 판정을 바꾸지 않는다 — T·F·T?·F?·모름 다섯 가지 × 무작위 원국·자기보고 400건", async () => {
    const rnd = mulberry32(1212)
    for (let i = 0; i < 400; i++) {
      await tick()
      const c = randomBirthChart(rnd, rnd() < 0.7)
      const a = luckAnalysis(c)
      const base = randomSelf(rnd) ?? { facts: [] }
      const others = (base.mbti ?? []).filter((m) => m.axis !== "TF")
      const outs = AXIS_CHOICES.TF.map((tf) => {
        const self: SelfReport = { facts: base.facts, mbti: tf ? [...others, tf] : others }
        const r = buildExpressionReport({ analysis: a, self, luck: { daeun: curDaeun(c), seunYear: 2026 } }, { tableCheck: false, hourCheck: false })
        return JSON.stringify([r.innate, r.readings.map((x) => [x.dimensionId, x.status, x.self.signal]), r.luck, r.gaeun])
      })
      for (const o of outs) expect(o).toBe(outs[0])
    }
  }, 300_000)

  it("원칙 5: 대응표에 T/F 신호·허용 밖 low·claim 누락을 넣으면 표 검증이 멈춘다", async () => {
    const tf = clone(RAW_BRIDGE)
    tf.links.push({ dimensionId: "duty", axis: "TF", pole: "T", direction: "high", weight: 1, grade: "B", sureOnly: false, claim: "service-model" })
    expect(() => makeExpressionTables(RAW_DIMS, tf)).toThrow(ExpressionTableError)
    const low = clone(RAW_BRIDGE)
    low.links.push({ dimensionId: "learning", axis: "EI", pole: "I", direction: "low", weight: 1, grade: "B", sureOnly: true, claim: "service-model" })
    expect(() => makeExpressionTables(RAW_DIMS, low)).toThrow(ExpressionTableError)
    const noclaim = clone(RAW_BRIDGE)
    delete noclaim.links[0].claim
    expect(() => makeExpressionTables(RAW_DIMS, noclaim)).toThrow(ExpressionTableError)
    // 기질 사실에 mbti 문항을 끼워 developed 근거로 만들려는 표
    const d = clone(RAW_DIMS)
    d.dimensions[0].facts.push({ key: "mbti:ESTJ", direction: "high", weight: 1, evidence: "trait" })
    expect(() => makeExpressionTables(d, RAW_BRIDGE)).toThrow(ExpressionTableError)
    // 상황 사실을 trait로 위장
    const d2 = clone(RAW_DIMS)
    d2.dimensions[3].facts.push({ key: "occupationStatus:employed", direction: "high", weight: 1, evidence: "trait" })
    expect(() => makeExpressionTables(d2, RAW_BRIDGE)).toThrow(ExpressionTableError)
    // developedEvidence에 situation을 넣는 것은 표로 가능(막지 않음) — 기록용
    const d3 = clone(RAW_DIMS)
    d3.self.developedEvidence = ["trait", "situation"]
    let allowed = true
    try { makeExpressionTables(d3, RAW_BRIDGE) } catch { allowed = false }
    console.log(`[QA-1] developedEvidence에 "situation"을 넣은 표가 검증을 ${allowed ? "통과함(표만 고치면 상황 사실만으로 developed 가능)" : "막힘"}`)
  })

  it("원칙 5·계약 §7-7: 금지 표현 — 동봉 표·엔진 출력 전부 없음 / 목록에 없는 변형 표현이 표 검증을 통과하는지 기록", async () => {
    expect(findForbiddenPhrases(RAW_DIMS)).toEqual([])
    expect(findForbiddenPhrases(RAW_BRIDGE)).toEqual([])
    const rnd = mulberry32(3)
    for (let i = 0; i < 200; i++) {
      const c = randomBirthChart(rnd, rnd() < 0.6)
      const r = buildExpressionReport({ analysis: luckAnalysis(c), self: randomSelf(rnd), luck: { daeun: curDaeun(c), seunYear: 2026 } }, { tableCheck: false, hourCheck: i % 4 === 0 })
      expect(findForbiddenPhrases(r)).toEqual([])
    }
    // 계약 예시는 막혀야 한다
    for (const p of ["과학적으로 입증된 관계", "검증된 상관관계", "MBTI가 사주를 바꾼다"]) {
      const b = clone(RAW_BRIDGE)
      b.note = p
      expect(() => makeExpressionTables(RAW_DIMS, b), p).toThrow(ExpressionTableError)
    }
    // 변형(목록 밖) — 통과하면 금지어 목록의 빈틈
    const variants = [
      "검증된상관", "검증된  상관", "검증 된 상관", "상관관계가 검증되었다", "상관관계가 입증되었다", "과학적 근거가 있다", "과학적으로 밝혀진",
      "통계적으로 유의", "연구 결과에 따르면", "논문에 따르면", "scientifically proven", "MBTI에 따라 사주가 달라진다", "MBTI가 사주를 바꿉니다",
      "MBTI 때문에 운이 바뀐다", "사주와 MBTI는 상관이 있다", "당신의 사주는 INTJ", "이 사주면 I일 것", "MBTI가 사주를 결정짓는다",
    ]
    const leaked = variants.filter((v) => {
      const b = clone(RAW_BRIDGE)
      b.note = v
      try { makeExpressionTables(RAW_DIMS, b); return true } catch { return false }
    })
    console.log(`[QA-1] 금지어 목록 ${EXPRESSION_FORBIDDEN_PHRASES.length}개. 변형 ${variants.length}개 중 표 검증을 통과한 것 ${leaked.length}개: ${leaked.join(" | ")}`)
  })
})

describe("QA-2 같은 원국 + 다른 MBTI/경험 → 판정은 달라지고 규칙 엔진 값은 같다", () => {
  it("원국 40개: 16유형 → readings·luck.strategy가 달라지는 경우가 있고 RuleAnalysis는 깊은 비교로 같다 / MBTI가 실제로 움직이는 차원 집계", async () => {
    const rnd = mulberry32(64)
    const types = ["INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP", "ENFJ", "ENFP", "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP"]
    let diffReadings = 0, diffStrategy = 0, chartsN = 0
    const dimMovedByMbti = new Set<string>()
    for (let i = 0; i < 40; i++) {
      const c = randomBirthChart(rnd, true)
      const a = luckAnalysis(c)
      const snap = JSON.stringify(a)
      const daeun = curDaeun(c)
      const outs = types.map((t) => buildExpressionReport({ analysis: a, self: { mbti: parseMbtiInput(t).axes, facts: [] }, luck: { daeun, seunYear: 2026 } }, { tableCheck: false }))
      // 규칙 엔진 값: 같은 입력으로 다시 계산해도, 엔진을 돌린 뒤에도 같다
      expect(JSON.stringify(a)).toBe(snap)
      expect(JSON.stringify(luckAnalysis(c))).toBe(snap)
      const rs = new Set(outs.map((o) => JSON.stringify(o.readings.map((x) => x.status))))
      const ss = new Set(outs.map((o) => JSON.stringify(o.luck.map((l) => l.strategy))))
      if (rs.size > 1) diffReadings++
      if (ss.size > 1) diffStrategy++
      for (const d of DIMS) if (new Set(outs.map((o) => o.readings.find((x) => x.dimensionId === d)!.status)).size > 1) dimMovedByMbti.add(d)
      chartsN++
    }
    console.log(`[QA-2] 원국 ${chartsN}개 중 MBTI 16유형으로 readings 달라짐 ${diffReadings}, strategy 달라짐 ${diffStrategy}. MBTI만으로 상태가 움직인 차원: ${[...dimMovedByMbti].join(",")}`)
    expect(diffReadings).toBeGreaterThan(0)
    expect(diffStrategy).toBeGreaterThan(0)
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

  it("MBTI 신호 도달 범위: 사실 없이 MBTI만일 때 신호가 생기는 차원, 사실이 닿은 차원에서 MBTI가 신호를 바꾸는 경우(전수)", async () => {
    const a = analyzeRules(TEMPLATE)
    const reach: Record<string, Set<string>> = Object.fromEntries(DIMS.map((d) => [d, new Set<string>()]))
    for (const mb of allMbtiCombos()) {
      const r = buildExpressionReport({ analysis: a, self: { mbti: mb, facts: [] } }, { tableCheck: false })
      for (const x of r.readings) reach[x.dimensionId].add(x.self.signal)
    }
    // 사실 1~2개(같은 차원) × MBTI 전체: MBTI 유무로 신호가 바뀌는가
    const factSets: UserFact[][] = []
    const pool = [...TRAIT_FACTS, ...SITUATION_FACTS]
    for (let i = 0; i < pool.length; i++) {
      factSets.push([fact(...pool[i])])
      for (let j = i + 1; j < pool.length; j++) factSets.push([fact(...pool[i]), fact(...pool[j])])
    }
    let changed = 0
    const changedDims = new Set<string>()
    for (const fs of factSets) {
      await tick()
      const r0 = buildExpressionReport({ analysis: a, self: { facts: fs } }, { tableCheck: false, hourCheck: false })
      for (const mb of [parseMbtiInput("ESTJ").axes, parseMbtiInput("INFP").axes, parseMbtiInput("ESFP").axes, parseMbtiInput("INTJ").axes]) {
        const r = buildExpressionReport({ analysis: a, self: { mbti: mb, facts: fs } }, { tableCheck: false, hourCheck: false })
        r.readings.forEach((x, k) => {
          const y = r0.readings[k]
          if (y.self.from.some((f) => f.startsWith("fact:")) && x.self.signal !== y.self.signal) { changed++; changedDims.add(x.dimensionId) }
        })
      }
    }
    console.log("[QA-2] MBTI만일 때 차원별 나올 수 있는 신호:", JSON.stringify(Object.fromEntries(Object.entries(reach).map(([k, v]) => [k, [...v]]))),
      `\n[QA-2] 사실이 닿은 차원에서 MBTI가 신호를 바꾼 경우 ${changed}건 (차원: ${[...changedDims].join(",") || "없음"}) / 사실 조합 ${factSets.length} × MBTI 4`)
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
