// 개운 범주 프롬프트 검사 (prompts@0.3.0 · facts@0.3.0) — 작성: 품질검증·보안 담당자(독립 검증)
// AI를 부르지 않는다. 사실표는 계산 엔진 → 규칙 엔진 → 개인화 → buildFactSheet로 실제 생성한다(가상 인물 10명 + 생년 훑기 120명).
// 기준 문서: docs/knowledge/gaeun.md §2.1(등급)·§3.2(seunFlags.shaking 정의)·§3.4(장별 사용), docs/knowledge/content-chapters.md §2-4(범위 표).
// 장별 범위 판정은 이 파일 안에서 문서 표를 따로 옮겨 만든 기대값(oracle)과 대조한다 — facts.ts의 SCOPE_RULE을 쓰지 않는다.
//  (a) 장별 범주 범위 = 문서 표   (b) "흔들리는 해"는 seunFlags.shaking === true일 때만 허용
//  (c) 사용자 사실 link 3분류 문형   (d) 운 글자 십성 = luck.glyphs = 독립 계산
//  (e) 참고 등급(색·방향·숫자·맛) 미포함   (f) 금지 낱말이 지시 밖 예시에 없음
//  (g) 개운 줄에 십성 낱이름 + 위치 코드가 섞이지 않음(v3-route 역방향 대조와 충돌 없음)
import { describe, expect, it } from "vitest"
import { analyzeRules, computeChart, yearPillarOf } from "../../src/engine"
import type { BirthInput } from "../../src/engine/types"
import type { RuleAnalysis } from "../../src/engine/rules/types"
import { buildPersonalContext, koreanDateOf } from "../../src/engine/personalize"
import type { SurveyAnswer } from "../../src/engine/personalize/types"
import { buildFactSheet } from "../../src/engine/content/facts"
import { GAEUN_CATALOG, GAEUN_CATEGORY_IDS, GAEUN_FORBIDDEN_WORDS } from "../../src/engine/content/gaeun"
import type { FactSheet, GaeunGroup, GaeunPick } from "../../src/engine/content/types"
import { CATCHPHRASES, CHAPTERS, PRODUCT_CHAPTERS, PRODUCT_CODES, buildSystemPrompt, chapterById } from "../../src/engine/content/prompts"
import * as GW from "../../src/engine/content/prompts/gaeun-words"
import { PERSONAS } from "../../scripts/content/samples/personas"

const AS_OF = new Date("2026-11-27T03:00:00Z")
const THIS_YEAR = koreanDateOf(AS_OF).year

// ─────────────────────────────── 사실표 만들기(실제 엔진)

interface Case { id: string; facts: FactSheet; rules: RuleAnalysis }

function makeCase(id: string, birth: BirthInput, answers: SurveyAnswer[] = []): Case {
  const chart = computeChart(birth)
  const rules = analyzeRules(chart, undefined, { luck: chart.luck.daeun.map((d) => d.pillar), year: yearPillarOf(THIS_YEAR) })
  const personal = buildPersonalContext(chart, answers, AS_OF, rules)
  const facts = buildFactSheet({ chart, rules, personal, asOf: AS_OF })
  return { id, facts, rules }
}

const OCC = ["student", "employed", "self_employed", "freelance"]
const WORK = ["solo_deep", "team", "people_facing", "leading"]
const STRENGTH = ["persistence", "communication", "planning", "creativity", "caring", "learning"]

/** 생년 훑기: 1950~2005년, 달·날·시·성별을 고르게 돌리고 15명 중 1명은 시각 모름. 설문은 link가 생기는 문항으로 돌린다 */
function sweep(n: number): Case[] {
  const out: Case[] = []
  for (let k = 0; k < n; k++) {
    const birth: BirthInput = {
      calendar: "solar",
      year: 1950 + ((k * 7) % 56),
      month: 1 + ((k * 5) % 12),
      day: 1 + ((k * 11) % 28),
      time: k % 15 === 0 ? null : { hour: (k * 13) % 24, minute: (k * 17) % 60 },
      gender: k % 2 ? "M" : "F",
    }
    const answers: SurveyAnswer[] = [
      { questionId: "occupationStatus", values: [OCC[k % OCC.length]] },
      { questionId: "workStyle", values: [WORK[(k >> 1) % WORK.length]] },
      { questionId: "selfStrength", values: [STRENGTH[k % STRENGTH.length]] },
      ...(k % 3 === 0 ? [{ questionId: "selfWeakness", values: ["saving"] } satisfies SurveyAnswer] : []),
      { questionId: "concernTopic", values: ["money"] },
    ]
    out.push(makeCase(`s${k}`, birth, answers))
  }
  return out
}

const CASES: Case[] = [...PERSONAS.map((p) => makeCase(p.id, p.birth, p.answers ?? [])), ...sweep(120)]

// ─────────────────────────────── 문서 표(gaeun.md §3.4 · content-chapters.md §2-4)를 이 파일에 옮긴 기대값

type Scope = "natal" | "relationNatal" | "relation" | "workNatal" | "work" | "daeun" | "seun" | "closing"
const CHAPTER_SCOPE: Record<string, Scope> = {
  nature: "natal",
  people: "relationNatal",
  "love-deep": "relation",
  talent: "workNatal",
  money: "workNatal",
  "money-deep": "work",
  "career-deep": "work",
  "daeun-now": "daeun",
  "decade-weather": "daeun",
  "decade-pack": "daeun",
  "year-ahead": "seun",
  closing: "closing",
}
/** 범주를 싣지 않는 장(content-chapters.md §2-4) */
const NO_GAEUN = ["free-nature", "free-elements", "free-year", "free-preview", "crossroads", "life-past", "life-ahead"]

const REL: GaeunGroup[] = ["bigyeop", "gwansal", "inseong"]
const WORKG: GaeunGroup[] = ["siksang", "jaeseong", "gwansal"]
const LUCK = ["daeun", "seun", "nextSeun"]
const fillEase = (p: GaeunPick) => p.slot === "natal" && (p.id.startsWith("GA.fill.") || p.id.startsWith("GA.ease."))

function oracle(gaeun: readonly GaeunPick[], scope: Scope): string[] {
  const practice = gaeun.filter((p) => p.tier === "practice" && GAEUN_CATEGORY_IDS.includes(p.id))
  const natal = (p: GaeunPick) => fillEase(p) || (p.slot === "natal" && (p.id === "GA.balanced" || p.id.startsWith("GJ.")))
  const daeun = (p: GaeunPick) => p.slot === "daeun" && (p.id.startsWith("GT.") || p.id.startsWith("GI."))
  const seun = (p: GaeunPick) => (p.slot === "seun" || p.slot === "nextSeun") && (p.id.startsWith("GT.") || p.id.startsWith("GI."))
  const rule: Record<Scope, (p: GaeunPick) => boolean> = {
    natal,
    relationNatal: (p) => fillEase(p) && REL.includes(p.group!),
    relation: (p) => (fillEase(p) && REL.includes(p.group!)) || (LUCK.includes(p.slot) && (p.id === "GI.chungDay" || p.id === "GI.hap")),
    workNatal: (p) => fillEase(p) && WORKG.includes(p.group!),
    work: (p) => (fillEase(p) && WORKG.includes(p.group!)) || (LUCK.includes(p.slot) && p.id.startsWith("GT.")),
    daeun,
    seun,
    closing: (p) => natal(p) || daeun(p) || seun(p),
  }
  let gj = 0
  const out: string[] = []
  for (const p of practice) {
    if (!rule[scope](p)) continue
    if (p.id.startsWith("GJ.") && gj++ >= 1) continue // 타고난 옷감: GJ 1개
    out.push(p.id)
  }
  return out
}

// ─────────────────────────────── 프롬프트 읽기 도우미

const GAEUN_HEAD = "[바꿔 볼 것 — 코드가 고른 범주"
function gaeunSection(user: string): string | null {
  const i = user.indexOf(GAEUN_HEAD)
  if (i < 0) return null
  const j = user.indexOf("\n\n", i)
  return user.slice(i, j < 0 ? undefined : j)
}
const ID_RE = /^- .+? \[((?:GA|GJ|GE|GT|GI)\.[A-Za-z.]+)\] — 바꿔 볼 것:/gm
const idsIn = (sec: string) => [...sec.matchAll(ID_RE)].map((m) => m[1])
const userOf = (chapterId: string, f: FactSheet) => chapterById(chapterId)!.build(f).user
const clone = <T,>(x: T): T => structuredClone(x)

// ═════════════════════════════════════════ (a) 장별 범주 범위
describe("(a) 장별 범주 범위 = gaeun.md §3.4 / content-chapters.md §2-4", () => {
  it("모든 장이 표에 있고, 범주 조각(gaeun) 유무가 표와 같다", () => {
    const ids = CHAPTERS.map((c) => c.id)
    expect([...Object.keys(CHAPTER_SCOPE), ...NO_GAEUN].sort()).toEqual([...ids].sort())
    for (const c of CHAPTERS) {
      const has = (c as unknown as { factParts: string[] }).factParts.includes("gaeun")
      expect(has, c.id).toBe(c.id in CHAPTER_SCOPE)
    }
  })

  it(`실제 사실표 ${CASES.length}명 × 장 ${CHAPTERS.length}개: 프롬프트에 실린 범주 id 목록 = 문서 표 기대값`, () => {
    const bad: string[] = []
    const seen = new Map<string, number>()
    for (const { id, facts } of CASES) {
      for (const c of CHAPTERS) {
        const sec = gaeunSection(c.build(facts).user)
        if (NO_GAEUN.includes(c.id)) {
          if (sec !== null) bad.push(`${id}/${c.id}: 범주 조각이 실림`)
          continue
        }
        if (sec === null) {
          bad.push(`${id}/${c.id}: 범주 조각 없음`)
          continue
        }
        const got = idsIn(sec)
        const want = oracle(facts.chart.gaeun ?? [], CHAPTER_SCOPE[c.id])
        if (JSON.stringify(got) !== JSON.stringify(want)) bad.push(`${id}/${c.id}: got ${got.join(",")} want ${want.join(",")}`)
        for (const g of got) seen.set(`${CHAPTER_SCOPE[c.id]}:${g}`, (seen.get(`${CHAPTER_SCOPE[c.id]}:${g}`) ?? 0) + 1)
      }
    }
    expect(bad.slice(0, 10)).toEqual([])
    // 표본이 범위마다 실제로 범주를 싣는 경우를 포함하는지(빈 목록끼리만 맞은 게 아님)
    for (const s of ["natal", "relationNatal", "relation", "workNatal", "work", "daeun", "seun", "closing"])
      expect([...seen.keys()].some((k) => k.startsWith(s + ":")), s).toBe(true)
    for (const id of ["GA.fill.", "GA.ease.", "GA.balanced", "GJ.", "GT.move", "GT.build", "GT.watch", "GI.hap", "GI.hyeong", "GI.chungMonth", "GI.chungDay"])
      expect([...seen.keys()].some((k) => k.includes(":" + id)), id).toBe(true)
  })

  it("합성 사실표(30개 범주 전부 + 참고 등급 + 목록 밖 id): 범위 규칙·GJ 1개·GA.bridge/GE 미게재", () => {
    const base = clone(CASES.find((c) => c.id === "p05")!.facts)
    const picks: GaeunPick[] = []
    const mk = (id: string, slot: GaeunPick["slot"], extra: Partial<GaeunPick> = {}): GaeunPick => ({ id, slot, view: slot === "natal" ? "eokbu" : "luck", tone: "firm", tier: "practice", basis: [], ...extra })
    const groupOf = (id: string) => (/\.(bigyeop|siksang|jaeseong|gwansal|inseong)$/.exec(id)?.[1] as GaeunGroup | undefined)
    for (const id of GAEUN_CATEGORY_IDS) {
      if (/^G[AJE]\./.test(id)) picks.push(mk(id, "natal", groupOf(id) ? { group: groupOf(id) } : {}))
      else for (const slot of ["daeun", "seun", "nextSeun"] as const) picks.push(mk(id, slot))
    }
    picks.push(mk("GE.wood", "natal", { tier: "reference" }), mk("GA.fill.siksang", "natal", { tier: "reference", group: "siksang" }), mk("GX.made-up", "natal"))
    base.chart.gaeun = picks
    for (const [ch, scope] of Object.entries(CHAPTER_SCOPE)) {
      const got = idsIn(gaeunSection(userOf(ch, base))!)
      expect(got, ch).toEqual(oracle(picks, scope))
      expect(got.some((x) => x === "GA.bridge" || x.startsWith("GE.") || x.startsWith("GX.")), ch).toBe(false)
      expect(got.filter((x) => x.startsWith("GJ.")).length, ch).toBeLessThanOrEqual(1)
    }
    // 마무리는 새 범주가 아니다: 상품마다 closing에 실린 범주는 그 상품의 앞 장 중 하나에 이미 실려 있다
    for (const code of PRODUCT_CODES) {
      const chs = PRODUCT_CHAPTERS[code]
      if (!chs.includes("closing")) continue
      const before = new Set(chs.filter((c) => c !== "closing" && c in CHAPTER_SCOPE).flatMap((c) => idsIn(gaeunSection(userOf(c, base))!)))
      const closing = idsIn(gaeunSection(userOf("closing", base))!)
      expect(closing.filter((x) => !before.has(x)), code).toEqual([])
    }
  })

  it("chart.gaeun이 없는 옛 사실표: 범주 줄 없이 '범주가 없다' 안내만", () => {
    const f = clone(CASES[0].facts)
    delete f.chart.gaeun
    for (const ch of Object.keys(CHAPTER_SCOPE)) {
      const sec = gaeunSection(userOf(ch, f))!
      expect(idsIn(sec), ch).toEqual([])
      expect(sec, ch).toContain("코드가 고른 범주가 이 사실표에 없다")
    }
  })
})

// ═════════════════════════════════════════ (b) 흔들리는 해
describe("(b) '흔들리는 해'는 seunFlags.shaking === true일 때만 허용", () => {
  const PERMIT = [/'흔들리는 해'라고 쓸 수 있다/, /올해를 '흔들리는 해'라고 쓰고/]
  /** "흔들리는 해"가 나오는 줄은 금지·조건 지시여야 한다(허용 문장이 아니면) */
  const GUARDED = /(부르지 않|쓰지 않|표지: 없음|표지가 없|표지가 있을 때|있을 때만|때만 쓴다|적혀 있을 때|썼는가)/

  it("규칙 엔진 정의와 같다: shaking ⇔ 올해 세운 지지가 일지·월지와 충 또는 형(glyphs 관계)", () => {
    let t = 0
    for (const { id, facts } of CASES) {
      const seun = facts.luck.glyphs?.find((g) => g.slot === "seun" && g.year === THIS_YEAR)
      const want = !!seun?.relations.some((r) => r.id === "chungDay" || r.id === "chungMonth" || r.id === "hyeong")
      expect(facts.luck.seunFlags?.shaking, id).toBe(want)
      if (want) t++
    }
    expect(t).toBeGreaterThan(0)
    expect(t).toBeLessThan(CASES.length)
  })

  it("실제 사실표 전 장: 표지 없음이면 허용 문장이 없고 '흔들리는 해' 줄은 모두 금지·조건 지시 / 표지 있음이면 올해 장에만 허용", () => {
    const bad: string[] = []
    for (const { id, facts } of CASES) {
      const shaking = facts.luck.seunFlags?.shaking === true
      for (const c of CHAPTERS) {
        const user = c.build(facts).user
        for (const line of user.split("\n").filter((l) => l.includes("흔들리는 해"))) {
          const permits = PERMIT.some((r) => r.test(line))
          if (permits && !shaking) bad.push(`${id}/${c.id} 표지 없는데 허용: ${line.slice(0, 80)}`)
          if (!permits && !GUARDED.test(line)) bad.push(`${id}/${c.id} 조건 없는 줄: ${line.slice(0, 80)}`)
        }
      }
      const ya = userOf("year-ahead", facts)
      if (shaking) {
        if (!ya.includes("흔들리는 해 표지: 있음")) bad.push(`${id} year-ahead 표지 있음 줄 없음`)
        if (!ya.includes("내년은 표지가 없으니 '흔들리는 해'라고 부르지 않는다")) bad.push(`${id} 내년 제한 없음`)
      } else if (!ya.includes("흔들리는 해 표지: 없음")) bad.push(`${id} year-ahead 표지 없음 줄 없음`)
    }
    expect(bad.slice(0, 10)).toEqual([])
    const sys = buildSystemPrompt()
    expect(sys).toContain("'흔들리는 해 표지: 있음'이 적혀 있을 때 올해에만 쓴다")
  })

  it("허용은 표지 하나로만 바뀐다: 표지만 뒤집으면 허용이 따라 바뀌고, GI.chungDay가 있어도 표지가 없으면 허용 안 함, 표지 칸이 없으면 없음", () => {
    const src = CASES.find((c) => c.facts.luck.seunFlags?.shaking === false)!.facts
    const on = clone(src)
    on.luck.seunFlags = { shaking: true }
    const off = clone(src)
    off.luck.seunFlags = { shaking: false }
    off.chart.gaeun = [...(off.chart.gaeun ?? []), { id: "GI.chungDay", slot: "seun", view: "luck", tone: "firm", tier: "practice", basis: [] }]
    const none = clone(src)
    delete none.luck.seunFlags
    for (const ch of ["year-ahead", "free-year"]) {
      expect(PERMIT.some((r) => r.test(userOf(ch, on))), `${ch} on`).toBe(true)
      expect(PERMIT.some((r) => r.test(userOf(ch, off))), `${ch} off+GI`).toBe(false)
      expect(PERMIT.some((r) => r.test(userOf(ch, none))), `${ch} 칸 없음`).toBe(false)
    }
    // 허용 문장은 [올해 세운] 조각(thisYear)이 실린 장에만, 표지가 켜졌을 때만 나온다(올해에 한정 — 대운·타고난 결 장엔 없음)
    for (const c of CHAPTERS) {
      const hasThisYear = (c as unknown as { factParts: string[] }).factParts.includes("thisYear")
      expect(PERMIT.some((r) => r.test(c.build(on).user)), `${c.id} on`).toBe(hasThisYear)
      expect(PERMIT.some((r) => r.test(c.build(off).user)), `${c.id} off`).toBe(false)
    }
  })
})

// ═════════════════════════════════════════ (c) 사용자 사실 link 3분류
describe("(c) 사용자 사실 link 3분류 문형", () => {
  const LINE = (user: string) => user.split("\n").filter((l) => l.includes("[출처: 네가 말한 것]"))
  const MATCH = "바로 그 통로다"
  const MISMATCH = "글자 밖에서 익힌 힘"
  const NONE = "사주로 설명하지 않는다, 배경으로만"

  it("엔진이 만든 link: kind는 같은 사실표 groupCounts와 맞고(match ⇔ 개수 > 0), 줄마다 그 문형 하나만", () => {
    const kinds = { match: 0, mismatch: 0, none: 0 }
    const bad: string[] = []
    for (const { id, facts } of CASES) {
      const counts = facts.chart.gaeunBasis?.groupCounts
      for (const f of facts.personal.userFacts) {
        if (!f.link) continue
        expect(Object.keys(GW.GROUP_KO), `${id} ${f.topic} group`).toContain(f.link.group)
        if (counts) expect(f.link.kind, `${id} ${f.topic}`).toBe((counts[f.link.group] ?? 0) > 0 ? "match" : "mismatch")
      }
      for (const c of CHAPTERS) {
        for (const line of LINE(c.build(facts).user)) {
          const has = [line.includes(MATCH), line.includes(MISMATCH), line.includes(NONE)]
          if (has.filter(Boolean).length !== 1) bad.push(`${id}/${c.id}: ${line.slice(0, 90)}`)
          if (has[0]) kinds.match++
          else if (has[1]) kinds.mismatch++
          else kinds.none++
        }
      }
    }
    expect(bad.slice(0, 10)).toEqual([])
    expect(kinds.match).toBeGreaterThan(0)
    expect(kinds.mismatch).toBeGreaterThan(0)
    expect(kinds.none).toBeGreaterThan(0)
  })

  it("합성: match·mismatch·없음 세 줄이 각자의 문형·묶음 이름으로 나오고, 맞혔다고 쓰지 않게 막는다", () => {
    const f = clone(CASES[0].facts)
    f.personal.userFacts = [
      { topic: "workStyle", value: "solo_deep", link: { kind: "match", group: "inseong" } },
      { topic: "selfStrength", value: "communication", link: { kind: "mismatch", group: "siksang" } },
      { topic: "selfWeakness", value: "worry" },
    ]
    const lines = LINE(userOf("nature", f))
    expect(lines).toHaveLength(2) // nature 장 주제: selfStrength·selfWeakness (workStyle은 talent 장)
    const [mis, none] = lines
    expect(mis).toContain(MISMATCH)
    expect(mis).toContain(`드러난 글자엔 ${GW.groupPicture("siksang")}(식상)이 없다`)
    expect(mis).not.toContain(MATCH)
    expect(none).toContain(NONE)
    expect(none).not.toMatch(/통로|글자 밖/)
    const talent = LINE(userOf("talent", f))
    const m = talent.find((l) => l.includes("혼자 깊이 파고드는 쪽"))!
    expect(m).toContain(`'네가 말한 「혼자 깊이 파고드는 쪽」이 바로 그 통로다'`)
    expect(m).toContain(`${GW.groupPicture("inseong")}(인성)이 드러난 글자에 있다`)
    expect(m).toContain("사주가 맞혔다고 쓰지 않는다")
    // 사용자 사실이 있는 장에만 '살아온 모습과 잇기' 3분류 지시가 붙고, 없으면 지어내지 말라는 지시로 바뀐다
    expect(userOf("talent", f)).toContain("글자와 닿음 → \"네가 말한 ○○이 바로 그 통로다\"")
    const empty = clone(f)
    empty.personal.userFacts = []
    expect(userOf("talent", empty)).toContain("이 장에는 사용자 사실이 없다")
    expect(userOf("talent", empty)).not.toContain("바로 그 통로다\"")
  })
})

// ═════════════════════════════════════════ (d) 운 글자 십성
describe("(d) 운 글자 십성 = luck.glyphs = 규칙 엔진 = 독립 계산", () => {
  // 독립 계산: 일간과 글자(지지는 정기)의 오행·음양 관계. 계산 엔진·규칙 엔진 코드를 쓰지 않는다.
  const STEM: Record<string, [number, number]> = { 甲: [0, 0], 乙: [0, 1], 丙: [1, 0], 丁: [1, 1], 戊: [2, 0], 己: [2, 1], 庚: [3, 0], 辛: [3, 1], 壬: [4, 0], 癸: [4, 1] }
  const MAIN_QI: Record<string, string> = { 子: "癸", 丑: "己", 寅: "甲", 卯: "乙", 辰: "戊", 巳: "丙", 午: "丁", 未: "己", 申: "庚", 酉: "辛", 戌: "戊", 亥: "壬" }
  const NAMES = [["비견", "겁재"], ["식신", "상관"], ["편재", "정재"], ["편관", "정관"], ["편인", "정인"]]
  function tenGod(dayStem: string, ch: string): string {
    const [de, dy] = STEM[dayStem]
    const [xe, xy] = STEM[MAIN_QI[ch] ?? ch]
    const rel = (xe - de + 5) % 5 // 0 같음 · 1 내가 낳음 · 2 내가 이김 · 3 나를 이김 · 4 나를 낳음
    return NAMES[[0, 1, 2, 3, 4][rel]][dy === xy ? 0 : 1]
  }
  const charLine = (part: "천간" | "지지", c: string) => new RegExp(`${part} ${c}\\([가-힣]\\) = ([가-힣]+)`)

  it("glyphs(지금 대운·올해)의 십성이 독립 계산·규칙 엔진 판정과 같고, 프롬프트 운 줄이 그 값을 옮긴다", () => {
    const bad: string[] = []
    let n = 0
    for (const { id, facts, rules } of CASES) {
      const ds = facts.chart.dayMaster.stem
      for (const g of facts.luck.glyphs ?? []) {
        for (const x of g.glyphs) {
          n++
          if (x.tenGod !== tenGod(ds, x.char)) bad.push(`${id} ${g.slot} ${x.char}: glyphs ${x.tenGod} ≠ 독립 ${tenGod(ds, x.char)}`)
          const hit = rules.tenGods.find((h) => h.position.pillar === g.slot && h.position.part === x.part && !h.viaHiddenStem && h.char === x.char && (g.slot !== "daeun" || facts.luck.daeun.find((d) => d.index === g.daeunIndex)?.ganzhi === g.ganzhi))
          if (!hit || hit.tenGod !== x.tenGod) bad.push(`${id} ${g.slot} ${x.char}: 규칙 엔진 ${hit?.tenGod}`)
        }
      }
      const cur = facts.luck.daeun.find((d) => d.current)
      const dn = userOf("daeun-now", facts)
      const ya = userOf("year-ahead", facts)
      const curLine = dn.split("\n").find((l) => l.includes("← 지금"))
      const tyLine = ya.split("\n").find((l) => l.startsWith(`${THIS_YEAR}년 `))!
      const check = (line: string | undefined, ganzhi: string, label: string) => {
        if (!line) return bad.push(`${id} ${label} 줄 없음`)
        ;[...ganzhi].forEach((c, i) => {
          const m = charLine(i === 0 ? "천간" : "지지", c).exec(line)
          if (!m || m[1] !== tenGod(ds, c)) bad.push(`${id} ${label} ${c}: 프롬프트 ${m?.[1]} ≠ ${tenGod(ds, c)}`)
        })
      }
      if (cur) check(curLine, cur.ganzhi, "지금 대운")
      check(tyLine, facts.luck.thisYear.ganzhi, "올해")
    }
    expect(bad.slice(0, 10)).toEqual([])
    expect(n).toBeGreaterThan(CASES.length * 2)
  })

  it("glyphs 값이 프롬프트에 그대로 옮겨진다(같은 글자의 원국 십성으로 바꿔 치지 않는다)", () => {
    const f = clone(CASES.find((c) => c.facts.luck.glyphs?.some((g) => g.slot === "seun"))!.facts)
    const slot = f.luck.glyphs!.find((g) => g.slot === "seun")!
    slot.glyphs[0].tenGod = "표지십성" // 표시용 가짜 값 — 옮겨 적기만 하는지 본다
    expect(userOf("year-ahead", f)).toContain(`천간 ${slot.glyphs[0].char}(`)
    expect(userOf("year-ahead", f)).toMatch(new RegExp(`천간 ${slot.glyphs[0].char}\\([가-힣]\\) = 표지십성`))
    // 간지가 다른 슬롯 값은 쓰지 않는다
    slot.ganzhi = "甲子"
    expect(userOf("year-ahead", f)).not.toContain("표지십성")
  })
})

// ═════════════════════════════════════════ (e) 참고 등급
describe("(e) 참고 등급(색·방향·숫자·맛) 미포함", () => {
  const REFERENCE = /(푸른빛|붉은빛|누런빛|흰빛|검은빛|해 뜨는 쪽|해 지는 쪽|남쪽|북쪽|동쪽|서쪽|옛 방식은 이 기운을|행운의 색|행운의 숫자|행운의 방|럭키)/
  const FIXED = ["색·방향·숫자·맛으로 기운을 빗대는 옛 방식 참고는 싣지 않았다 — 쓰지 않는다", "이 범주에 쓰지 않는 말:"]

  it("엔진 사실표에 참고 등급 pick이 없고(기본 숨김), 개운 조각에 참고 표현이 없으며 '싣지 않았다' 지시가 있다", () => {
    for (const { id, facts } of CASES) {
      expect((facts.chart.gaeun ?? []).filter((p) => p.tier !== "practice"), id).toEqual([])
      for (const ch of Object.keys(CHAPTER_SCOPE)) {
        const sec = gaeunSection(userOf(ch, facts))!
        expect(sec, `${id}/${ch}`).toContain(FIXED[0])
        const body = sec.split("\n").filter((l) => !FIXED.some((x) => l.startsWith(x)))
        for (const l of body) expect(l, `${id}/${ch}`).not.toMatch(REFERENCE)
        // 범주 줄(- … [ID] … 근거 그림 말)에는 색·방향·숫자·맛 낱말 자체가 없어야 한다(지시 줄의 "두 방향의 '반갑다'"는 해석 방향이라 제외)
        for (const l of body.filter((x) => /^- .+\[(GA|GJ|GE|GT|GI)\./.test(x))) expect(l, `${id}/${ch}`).not.toMatch(/(빛|방향|방위|숫자|맛)/)
      }
    }
  })

  it("범주 사전(GAEUN_CATALOG practice·gaeun-words)에 색·방향·숫자·맛 표현이 없다", () => {
    const words = [
      ...Object.values(GAEUN_CATALOG).map((c) => c.practice),
      ...Object.values(GW.GJ_PICTURE).flatMap((x) => [x.picture, x.side]),
      ...[GW.LUCK_SIDE, GW.EASE_SIDE, GW.GE_PICTURE, GW.GT_PICTURE, GW.GI_PICTURE, GW.HALF_KO, GW.VERDICT_KO, GW.VIEW_HEAD].flatMap((o) => Object.values(o)),
    ]
    for (const w of words) expect(w).not.toMatch(REFERENCE)
    for (const w of words) expect(w).not.toMatch(/(빛|방위|숫자|맛)/)
  })
})

// ═════════════════════════════════════════ (f) 금지 낱말
describe("(f) 금지 낱말(GAEUN_FORBIDDEN_WORDS)이 지시 밖 본문 예시에 없다", () => {
  /** 금지 낱말이 나와도 되는 자리: 금지 목록 줄, 또는 같은 줄에 금지·거절 지시가 있는 줄 */
  const PROHIBIT = /(쓰지 않|하지 않|말하지 않|내리지 않|잇지 않|단정하지 않|권하지 않|없다|없는가|거절할 때|금지)/
  const QUOTE = /["“'「]([^"”'」\n]{2,200})["”'」]/g

  function allPromptTexts(): { where: string; text: string }[] {
    const out: { where: string; text: string }[] = []
    for (const voice of ["halmi", "plain"] as const)
      for (const tone of ["gentle", "balanced", "direct"] as const) out.push({ where: `system:${voice}/${tone}`, text: buildSystemPrompt({ voice, tone }) })
    for (const { id, facts } of CASES.slice(0, 40)) for (const c of CHAPTERS) out.push({ where: `${id}/${c.id}`, text: c.build(facts).user })
    for (const c of CHAPTERS) out.push({ where: `${c.id}/schema`, text: JSON.stringify(c.outputSchema) })
    return out
  }

  it("금지 낱말이 나오는 줄은 모두 금지 지시 줄이다", () => {
    const bad: string[] = []
    for (const { where, text } of allPromptTexts()) {
      for (const line of text.split("\n")) {
        const ws = GAEUN_FORBIDDEN_WORDS.filter((w) => line.includes(w))
        if (!ws.length) continue
        if (line.startsWith("이 범주에 쓰지 않는 말:")) continue
        // 말놀이 금지 지시 — '丙申년은 반드시 "병신(丙申)년"으로'(AI에게 주는 표기 지시이고 고객 예문이 아님)
        if (/丙申년은 반드시 "병신\(丙申\)년"/.test(line) && ws.length === 1) continue
        if (!PROHIBIT.test(line)) bad.push(`${where}: [${ws.join(",")}] ${line.slice(0, 100)}`)
      }
    }
    expect([...new Set(bad)].slice(0, 10)).toEqual([])
  })

  it("따옴표 안 예문은 금지 낱말 자체를 인용한 경우 말고는 금지 낱말을 담지 않는다(스키마 설명 포함)", () => {
    const bad: string[] = []
    for (const { where, text } of allPromptTexts()) {
      for (const m of text.matchAll(QUOTE)) {
        const q = m[1].trim()
        const ws = GAEUN_FORBIDDEN_WORDS.filter((w) => q.includes(w))
        if (ws.length && !(ws.length === 1 && q === ws[0])) bad.push(`${where}: "${q.slice(0, 80)}"`)
      }
    }
    expect([...new Set(bad)].slice(0, 10)).toEqual([])
  })

  it("고객 문장으로 옮겨질 사전 값(범주 practice·그림 말·말버릇)에 금지 낱말이 없다", () => {
    const words = [
      ...Object.values(GAEUN_CATALOG).map((c) => c.practice),
      ...Object.values(GW.GJ_PICTURE).flatMap((x) => [x.picture, x.side]),
      ...[GW.LUCK_SIDE, GW.EASE_SIDE, GW.GE_PICTURE, GW.GT_PICTURE, GW.GI_PICTURE, GW.HALF_KO, GW.VERDICT_KO, GW.VIEW_HEAD].flatMap((o) => Object.values(o)),
      ...Object.values(CATCHPHRASES).map(String),
    ]
    for (const w of words) for (const f of GAEUN_FORBIDDEN_WORDS) expect(w.includes(f), `${f} in ${w}`).toBe(false)
  })
})

// ═════════════════════════════════════════ (g) 십성 낱이름 + 위치 코드
describe("(g) 개운 줄에 십성 낱이름·위치 코드가 섞이지 않는다(v3-route 역방향 대조와 충돌 없음)", () => {
  const TEN = ["비견", "겁재", "식신", "상관", "편재", "정재", "편관", "정관", "편인", "정인"]
  const CODE = /\b(?:year|month|day|hour)\.(?:stem|branch)(?:\.(?:yeogi|junggi|jeonggi))?(?![.\w])/g

  it("개운 조각의 모든 줄에 원국 위치 코드와 십성 낱이름이 없다(묶음 이름·그림 말만)", () => {
    const bad: string[] = []
    for (const { id, facts } of CASES)
      for (const ch of Object.keys(CHAPTER_SCOPE))
        for (const l of gaeunSection(userOf(ch, facts))!.split("\n")) {
          if ((l.match(CODE) ?? []).length || TEN.some((t) => l.includes(t))) bad.push(`${id}/${ch}: ${l.slice(0, 100)}`)
        }
    expect([...new Set(bad)].slice(0, 10)).toEqual([])
  })

  it("v3-route 역방향 대조를 전 장 프롬프트에 그대로 돌려도 독립 계산에 없는 '위치 코드|십성' 조합이 없다", () => {
    const bad: string[] = []
    let checked = 0
    for (const { id, facts, rules } of CASES.slice(0, 40)) {
      const natal = rules.tenGods.filter((t) => ["year", "month", "day", "hour"].includes(t.position.pillar))
      const allowed = new Set(natal.map((t) => `${t.position.pillar}.${t.position.part}${t.viaHiddenStem ? `.${t.viaHiddenStem}` : ""}|${t.tenGod}`))
      for (const c of CHAPTERS)
        for (const l of c.build(facts).user.split("\n")) {
          const codes = l.match(CODE) ?? []
          const named = TEN.filter((g) => l.includes(g))
          if (codes.length !== 1 || named.length !== 1 || l.includes("+")) continue
          checked++
          if (!allowed.has(`${codes[0]}|${named[0]}`)) bad.push(`${id}/${c.id}: ${l.slice(0, 100)}`)
        }
    }
    expect(bad.slice(0, 10)).toEqual([])
    expect(checked).toBeGreaterThan(0)
  })
})
