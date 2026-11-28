// 신성 원형(archetype@0.1.0, D-030) 제품 모듈 테스트.
// lab(scripts/archetype-lab, 규칙 research-12-knobC)과의 동일성은 lab 코드를 직접 불러 같은 원국으로 대조한다(읽기만).
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import {
  analyzeArchetype, analyzeRules, computeChart, ARCHETYPE_ENGINE_VERSION, ARCHETYPE_ID_LIST, ARCHETYPE_RULES_HASH, EngineInputError,
  type CalendarResult, type Pillar,
} from "../.."
import { runCascade } from "../cascade"
import { extractFeatures } from "../features"
import { archetypeRules, canonicalJson, validateArchetypeRuleSet, ArchetypeRuleSetError } from "../ruleset"
import { ARCHETYPE_IDS, UNMYEONG_ASSETS } from "../../../lib/unmyeong/assets"
import { classifyArchetype } from "../../../../scripts/archetype-lab/lib/classify"
import { extractFeatures as labExtractFeatures } from "../../../../scripts/archetype-lab/lib/features"
import { randomBirthInputs } from "../../../../scripts/archetype-lab/lib/random"
import { loadRuleSet } from "../../../../scripts/archetype-lab/lib/ruleset"
import { CASES } from "../../../../scripts/archetype-lab/reps-cases"

const ROOT = resolve(__dirname, "../../../..")
const LAB_RULES_FILE = resolve(ROOT, "scripts/archetype-lab/rules/research-12-knobC.json")
const LAB_RS = loadRuleSet(LAB_RULES_FILE)
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
const pil = (s: string): Pillar => ({ stem: s[0] as Pillar["stem"], branch: s[1] as Pillar["branch"] })
const TEMPLATE = computeChart({ calendar: "solar", year: 2000, month: 6, day: 15, time: { hour: 12, minute: 0 }, gender: "M" })
const chartOf = (p: (string | null)[]): CalendarResult => ({
  ...TEMPLATE, pillars: { year: pil(p[0]!), month: pil(p[1]!), day: pil(p[2]!), hour: p[3] ? pil(p[3]) : null },
})
const arch = (c: CalendarResult) => analyzeArchetype(analyzeRules(c), c)
const P = (p: Pillar | null) => (p ? p.stem + p.branch : "--")

describe("규칙 데이터·id", () => {
  it("동봉 규칙 = lab research-12-knobC.json(키 정렬 JSON 동일), 해시 상수 = sha256", () => {
    const own = JSON.parse(readFileSync(resolve(__dirname, "../rules/research-12-knobC.json"), "utf8"))
    const lab = JSON.parse(readFileSync(LAB_RULES_FILE, "utf8"))
    expect(canonicalJson(own)).toBe(canonicalJson(lab))
    expect(ARCHETYPE_RULES_HASH).toBe("sha256:" + createHash("sha256").update(canonicalJson(own)).digest("hex").slice(0, 16))
    const { rs } = archetypeRules()
    expect(rs.id).toBe("research-12-knobC")
    expect(ARCHETYPE_ENGINE_VERSION).toBe("archetype@0.1.0")
  })

  it("원형 id·순서 = assets.ts ARCHETYPE_IDS, 이름 = 자산 대체 글의 이름", () => {
    expect([...ARCHETYPE_ID_LIST]).toEqual([...ARCHETYPE_IDS])
    const { ordered } = archetypeRules()
    expect(ordered.map((g) => g.id)).toEqual([...ARCHETYPE_IDS])
    for (const g of ordered) expect(UNMYEONG_ASSETS.archetypes[g.id].alt).toBe(`거울에 비친 네 안의 ${g.name}`)
  })

  it("규칙 검증: 없는 특징 키·순서 어긋남·require 없음을 잡는다", () => {
    const raw = JSON.parse(readFileSync(resolve(__dirname, "../rules/research-12-knobC.json"), "utf8"))
    const a = clone(raw)
    a.archetypes[4].require.all[0].f = "st.nope"
    expect(() => validateArchetypeRuleSet(a)).toThrow(ArchetypeRuleSetError)
    const b = clone(raw)
    b.archetypes[0].priority = 13
    expect(() => validateArchetypeRuleSet(b)).toThrow(/순서|priority/)
    const c = clone(raw)
    delete c.archetypes[3].require
    expect(() => validateArchetypeRuleSet(c)).toThrow(/require/)
    expect(() => validateArchetypeRuleSet(raw)).not.toThrow()
  })
})

describe("대표 사주 24개(+참고 3) — lab reps-cases", () => {
  it("24개 원형 = 연구소장 손계산 원형", () => {
    const main = CASES.filter((c) => !c.extra)
    expect(main).toHaveLength(24)
    for (const c of main) expect(`${c.id}:${arch(chartOf(c.p)).id}`).toBe(`${c.id}:${c.e.arch}`)
  })

  it("참고 3개: 사례 6 은빛 늑대 · 사례 10 은하 · 사례 3은 조정안 C(인성 하한 0.15)에서 불멸의 숲(문서 손계산은 봉황 — 03 §15.8)", () => {
    const got = Object.fromEntries(CASES.filter((c) => c.extra).map((c) => [c.id, arch(chartOf(c.p)).id]))
    expect(got).toEqual({ "참고-사례6": "silver-wolf", "참고-사례10": "galaxy", "참고-사례3": "eternal-forest" })
  })

  it("부 원형 = 관문 전체 중 다음 통과(§7, D-030). 문서 기재와 다른 것은 현무-2 하나(달의 여신 — 관문 4 통과)", () => {
    const diff: string[] = []
    for (const c of CASES.filter((x) => !x.extra && x.e.secondary)) {
      const r = arch(chartOf(c.p))
      expect(r.secondary?.id ?? null).toBe(r.alsoMatched[0] ?? null)
      if (r.secondary?.id !== c.e.secondary) diff.push(`${c.id}:${r.secondary?.id}`)
    }
    expect(diff).toEqual(["현무-2:moon-goddess"])
  })
})

// 1천 명 × (시각 앎 + 같은 사람 시각 모름)
const INPUTS = randomBirthInputs(1000, "archetype@0.1.0-product")
const KNOWN = INPUTS.map((x) => computeChart(x))
const UNKNOWN = INPUTS.map((x) => computeChart({ ...x, time: null }))

describe("lab 결과와 1천 건 동일성", () => {
  it("특징 벡터(features@0.2.0)가 lab과 같다", () => {
    for (const c of [...KNOWN.slice(0, 300), ...UNKNOWN.slice(0, 300)]) {
      const a = analyzeRules(c)
      expect(canonicalJson(extractFeatures(a))).toBe(canonicalJson(labExtractFeatures(a)))
    }
  })

  it("주·부 원형, alsoMatched, 근거(trace·matched), 12시진·표 민감도가 lab과 같다", { timeout: 300_000 }, () => {
    let compared = 0
    for (let i = 0; i < INPUTS.length; i++) {
      for (const [c, hourOn] of [[KNOWN[i], false], [UNKNOWN[i], true]] as const) {
        const r = arch(c)
        const l = classifyArchetype(c, LAB_RS, { sensitivity: { hour: hourOn, table: true } })
        const tag = `#${i} ${[c.pillars.year, c.pillars.month, c.pillars.day, c.pillars.hour].map(P).join(" ")}`
        expect({ tag, id: r.id, sec: r.secondary?.id ?? null, also: r.alsoMatched, ruleId: r.ruleId, alarm: r.fallbackSafety }).toEqual({
          tag, id: l.primary.id, sec: l.secondary?.id ?? null, also: l.cascade!.alsoMatched, ruleId: l.cascade!.ruleId, alarm: l.cascade!.fallbackSafety,
        })
        expect(r.basis.map((b) => ({ id: b.id, passed: b.passed, ...(b.failedOn !== undefined ? { failedOn: b.failedOn } : {}) }))).toEqual(l.cascade!.trace)
        expect(canonicalJson(r.basis[r.basis.length - 1].values)).toBe(canonicalJson(l.cascade!.matched))
        expect(r.sensitivity.table.byTable.map((t) => [t.tableId, t.id])).toEqual(l.tableSensitivity!.byTable.map((t) => [t.tableId, t.primary]))
        expect(r.sensitivity.table.changed).toBe(l.tableSensitivity!.sensitive)
        expect(r.sensitivity.table.changedIncludingMainOnly).toBe(l.tableSensitivity!.sensitiveIncludingMainOnly)
        if (hourOn) {
          const h = l.hourSensitivity!
          expect(r.sensitivity.hour!.byHour.map((x) => [P(x.hour), x.id])).toEqual(h.byHour.map((x) => [P(x.hour), x.primary]))
          expect(r.sensitivity.hour!.stable).toBe(h.agreeWithThreePillars)
          expect(r.sensitivity.hour!.distinct).toEqual(h.distinctPrimary)
        } else expect(r.sensitivity.hour).toBeNull()
        compared++
      }
    }
    expect(compared).toBe(2000)
  })
})

describe("결정성", () => {
  it("같은 입력 → 결과 전체(근거 포함) 같음 — 새로 계산한 원국·분석으로 다시 돌려도", () => {
    for (let i = 0; i < 100; i++) {
      for (const inp of [INPUTS[i], { ...INPUTS[i], time: null }]) {
        const c1 = computeChart(inp)
        const c2 = computeChart(inp)
        expect(canonicalJson(analyzeArchetype(analyzeRules(c2), c2))).toBe(canonicalJson(analyzeArchetype(analyzeRules(c1), c1)))
      }
    }
  })

  it("분석에 쓴 지장간 표가 달라도 원형 판정은 kr-monthly-30 고정(결과 전체 같음), 대운·세운 유무와도 무관", () => {
    for (const c of [...KNOWN.slice(0, 60), ...UNKNOWN.slice(0, 60)]) {
      const base = canonicalJson(arch(c))
      for (const t of ["cn-lunarjs", "main-only"] as const) expect(canonicalJson(analyzeArchetype(analyzeRules(c, { hiddenStemTable: t }), c))).toBe(base)
      const extra = analyzeRules(c, undefined, { luck: c.luck.daeun.slice(0, 3).map((d) => d.pillar), year: { stem: "丙", branch: "午" } })
      expect(canonicalJson(analyzeArchetype(extra, c))).toBe(base)
    }
  })

  it("결과에 버전·규칙 해시·옵션·고지가 기록된다", () => {
    const r = arch(KNOWN[0])
    expect(r.version).toBe("archetype@0.1.0")
    expect(r.engineVersion).toBe(r.version)
    expect(r.rulesHash).toBe(ARCHETYPE_RULES_HASH)
    expect(r.rulesHash).toMatch(/^sha256:[0-9a-f]{16}$/)
    expect(r.featureVersion).toBe("features@0.2.0")
    expect(r.rulesEngineVersion).toMatch(/^rules@/)
    expect(r.ruleOptions.hiddenStemTable).toBe("kr-monthly-30")
    expect(r.sensitivity.table.fixed).toBe("kr-monthly-30")
    expect(r.disclaimer).toBe("creative-symbol")
    expect(r.disclaimerText).toContain("창작적 상징")
  })
})

describe("경보(fallbackSafety)", () => {
  it("1천 명 × (시각 앎·모름 판정 + 12시진 변형 + 표 변형) 경보 0건", { timeout: 120_000 }, () => {
    let judged = 0
    for (let i = 0; i < INPUTS.length; i++) {
      for (const c of [KNOWN[i], UNKNOWN[i]]) {
        const r = arch(c)
        expect(r.fallbackSafety).toBe(false)
        expect(r.sensitivity.table.byTable.some((t) => t.fallbackSafety)).toBe(false)
        expect(r.sensitivity.hour?.byHour.some((h) => h.fallbackSafety) ?? false).toBe(false)
        judged += 3 + (r.sensitivity.hour ? 12 : 0)
      }
    }
    expect(judged).toBe(1000 * (3 + 15))
  })

  it("어떤 관문도 통과 못 하면 fallback(불멸의 숲) + 경보 — 조용히 넘기지 않음", () => {
    const { ordered, rs } = archetypeRules()
    const impossible = ordered.map((g) => ({ ...g, require: { f: "st.ratio", gt: 2 } }))
    const out = runCascade(impossible, rs.fallback, extractFeatures(analyzeRules(KNOWN[0])))
    expect(out.fallbackSafety).toBe(true)
    expect(out.primary.id).toBe("eternal-forest")
    expect(out.passed).toEqual([])
  })
})

describe("시각 모름", () => {
  it("세 기둥만으로 판정 + 12시진 기록(stable = 같은 원형 시진 수 / 12) + 안내 표시는 원형과 무관하게 항상", () => {
    let allStable = 0
    for (const c of UNKNOWN.slice(0, 200)) {
      const r = arch(c)
      expect(r.hourKnown).toBe(false)
      expect(r.hourUnknownNote).toBe(true)
      const h = r.sensitivity.hour!
      expect(h.of).toBe(12)
      expect(h.byHour).toHaveLength(12)
      expect(h.byHour.map((x) => x.hour.branch).join("")).toBe("子丑寅卯辰巳午未申酉戌亥")
      expect(h.stable).toBe(h.byHour.filter((x) => x.id === r.id).length)
      expect(h.distinct).toEqual(ARCHETYPE_ID_LIST.filter((id) => h.byHour.some((x) => x.id === id)))
      // 세 기둥 판정 = 시주 null 분석
      expect(r.id).toBe(arch({ ...c, pillars: { ...c.pillars, hour: null } }).id)
      if (h.stable === 12) allStable++
    }
    expect(allStable).toBeLessThan(200) // 대부분 시진에 따라 흔들림(03 §15.4) — 안내를 늘 붙이는 이유
  })

  it("시각을 알면 hour = null, 안내 없음. 같은 일·월주면 실제 시주 변형 원형 = 시각 앎 원형", () => {
    let checked = 0
    for (let i = 0; i < 200; i++) {
      const k = arch(KNOWN[i])
      expect(k.hourKnown).toBe(true)
      expect(k.hourUnknownNote).toBe(false)
      expect(k.sensitivity.hour).toBeNull()
      const u = arch(UNKNOWN[i])
      const same = P(KNOWN[i].pillars.day) === P(UNKNOWN[i].pillars.day) && P(KNOWN[i].pillars.month) === P(UNKNOWN[i].pillars.month)
      if (!same) continue
      const v = u.sensitivity.hour!.byHour.find((x) => P(x.hour) === P(KNOWN[i].pillars.hour))!
      expect(v.id).toBe(k.id)
      checked++
    }
    expect(checked).toBeGreaterThan(180)
  })

  it("사례 6(시주 모름)은 12시진에 은빛 늑대·봉황이 함께 나와 stable < 12", () => {
    const c = CASES.find((x) => x.id === "참고-사례6")!
    const r = arch(chartOf(c.p))
    expect(r.id).toBe("silver-wolf")
    expect(r.sensitivity.hour!.stable).toBeLessThan(12)
    expect(r.sensitivity.hour!.distinct).toEqual(expect.arrayContaining(["silver-wolf", "bonghwang"]))
  })
})

describe("근거 기록·입력 검증", () => {
  it("basis = 관문 1부터 주 원형까지, 앞은 탈락 이유, 마지막은 통과 + 잎 조건 값", () => {
    for (const c of KNOWN.slice(0, 200)) {
      const r = arch(c)
      expect(r.basis.map((b) => b.order)).toEqual(Array.from({ length: r.order }, (_, i) => i + 1))
      const last = r.basis[r.basis.length - 1]
      expect(last).toMatchObject({ id: r.id, ruleId: r.ruleId, passed: true })
      expect(last.failedOn).toBeUndefined()
      for (const b of r.basis.slice(0, -1)) expect(b.passed === false && typeof b.failedOn === "string").toBe(true)
      for (const b of r.basis) for (const k of b.conditions) expect(b.values[k.key]).toEqual(k.value)
      expect(r.alsoMatched.every((id) => ARCHETYPE_ID_LIST.indexOf(id) > ARCHETYPE_ID_LIST.indexOf(r.id))).toBe(true)
    }
  })

  it("analysis와 chart의 원국이 다르면 EngineInputError", () => {
    const a = analyzeRules(KNOWN[0])
    expect(() => analyzeArchetype(a, KNOWN[1])).toThrow(EngineInputError)
    expect(() => analyzeArchetype(a, { ...KNOWN[0], pillars: { ...KNOWN[0].pillars, hour: null } })).toThrow(EngineInputError)
    expect(() => analyzeArchetype(null as never, KNOWN[0])).toThrow(EngineInputError)
  })
})

describe("성능", () => {
  it("시각 앎 1건 평균 < 10ms, 시각 모름(12시진 재판정 포함) 1건 평균 < 40ms", () => {
    const N = 200
    const ka = KNOWN.slice(0, N).map((c) => analyzeRules(c))
    const ua = UNKNOWN.slice(0, N).map((c) => analyzeRules(c))
    let t = performance.now()
    for (let i = 0; i < N; i++) analyzeArchetype(ka[i], KNOWN[i])
    const known = (performance.now() - t) / N
    t = performance.now()
    for (let i = 0; i < N; i++) analyzeArchetype(ua[i], UNKNOWN[i])
    const unknown = (performance.now() - t) / N
    console.log(`archetype perf: known ${known.toFixed(2)}ms, unknown ${unknown.toFixed(2)}ms (N=${N})`)
    expect(known).toBeLessThan(10)
    expect(unknown).toBeLessThan(40)
  })
})
