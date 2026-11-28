// 순서형 관문(cascade) 모드 + 연구소장 12안(research-12) 테스트
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { analyzeRules, computeChart, type CalendarResult, type Pillar } from "../../src/engine"
import { classifyArchetype } from "./lib/classify"
import { extractFeatures } from "./lib/features"
import { randomBirthInputs } from "./lib/random"
import { canonicalJson, loadRuleSet, RuleSetError, validateRuleSet } from "./lib/ruleset"
import { evalCondition, scoreRuleSet } from "./lib/score"
import type { ArchetypeRuleSet } from "./lib/types"
import { CASES } from "./reps-cases"

const RS = loadRuleSet(resolve(__dirname, "rules/research-12.json"))
const KNOBS = ["A", "B", "C"].map((k) => loadRuleSet(resolve(__dirname, `rules/research-12-knob${k}.json`)))
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
const pil = (s: string): Pillar => ({ stem: s[0] as Pillar["stem"], branch: s[1] as Pillar["branch"] })
const TEMPLATE = computeChart({ calendar: "solar", year: 2000, month: 6, day: 15, time: { hour: 12, minute: 0 }, gender: "M" })
const chartOf = (p: (string | null)[]): CalendarResult => ({
  ...TEMPLATE, pillars: { year: pil(p[0]!), month: pil(p[1]!), day: pil(p[2]!), hour: p[3] ? pil(p[3]) : null },
})
const SAMPLE = randomBirthInputs(400, "cascade-test").map((x) => computeChart(x))

describe("cascade 모드 판정", () => {
  it("1순위 = priority 순으로 처음 통과한 관문, 부 원형 = 그다음 통과 관문, trace = 1순위까지", () => {
    const ordered = [...RS.archetypes].sort((a, b) => a.priority - b.priority)
    for (const c of SAMPLE) {
      const f = extractFeatures(analyzeRules(c))
      const passed = ordered.filter((a) => evalCondition(a.require!, f, {})).map((a) => a.id)
      const s = scoreRuleSet(RS, f)
      expect(s.decidedBy).toBe("cascade")
      expect(s.primary.id).toBe(passed[0])
      expect(s.secondary?.id ?? null).toBe(passed[1] ?? null)
      expect(s.cascade!.alsoMatched).toEqual(passed.slice(1))
      expect(s.cascade!.trace.map((t) => t.id)).toEqual(ordered.slice(0, ordered.findIndex((a) => a.id === passed[0]) + 1).map((a) => a.id))
      expect(s.cascade!.trace.slice(0, -1).every((t) => !t.passed && typeof t.failedOn === "string")).toBe(true)
      expect(s.cascade!.ruleId).toMatch(/^arch\.v1\.\d\d\./)
    }
  })

  it("분할 증명(§3.3): 표본·12시진·표 변형 어디서도 경보(fallbackSafety) 0건 — 기본안과 보정안 A·B·C 모두", () => {
    for (const rs of [RS, ...KNOBS]) {
      for (const c of SAMPLE.slice(0, 120)) {
        const k = classifyArchetype(c, rs, { sensitivity: { hour: false, table: true } })
        expect(k.cascade!.fallbackSafety).toBe(false)
        expect(k.tableSensitivity!.byTable.some((t) => t.fallbackSafety)).toBe(false)
        const u = classifyArchetype({ ...c, pillars: { ...c.pillars, hour: null } }, rs, { sensitivity: { hour: true, table: false } })
        expect(u.cascade!.fallbackSafety).toBe(false)
        expect(u.hourSensitivity!.byHour.some((h) => h.fallbackSafety)).toBe(false)
      }
    }
  })

  it("어떤 관문도 통과 못 하면 fallback + fallbackSafety 경보(조용히 넘기지 않음)", () => {
    const bad = clone(RS)
    for (const a of bad.archetypes) a.require = { f: "st.ratio", gt: 2 }
    const s = scoreRuleSet(validateRuleSet(bad), extractFeatures(analyzeRules(SAMPLE[0])))
    expect(s.decidedBy).toBe("fallback")
    expect(s.primary.id).toBe("eternal-forest")
    expect(s.cascade!.fallbackSafety).toBe(true)
    expect(s.cascade!.trace).toHaveLength(12)
    expect(s.secondary).toBeNull()
  })

  it("규칙 파일의 원형 나열 순서를 뒤집어도 결과가 같다(priority가 순서를 정함)", () => {
    const rev = clone(RS) as ArchetypeRuleSet
    rev.archetypes.reverse()
    for (const c of SAMPLE.slice(0, 60)) {
      const a = classifyArchetype(c, RS)
      const b = classifyArchetype(c, rev)
      expect(canonicalJson({ p: b.primary, s: b.secondary, c: b.cascade, r: b.ranking, t: b.tableSensitivity })).toBe(
        canonicalJson({ p: a.primary, s: a.secondary, c: a.cascade, r: a.ranking, t: a.tableSensitivity }),
      )
    }
  })

  it("cascade 검증: require 없는 원형·잘못된 mode·expectedShare 오류를 잡는다", () => {
    const a = clone(RS)
    delete a.archetypes[3].require
    expect(() => validateRuleSet(a)).toThrow(RuleSetError)
    const b = clone(RS) as unknown as Record<string, unknown>
    b.mode = "waterfall"
    expect(() => validateRuleSet(b)).toThrow(/mode/)
    const c = clone(RS)
    c.archetypes[0].expectedShare = [0.2, 0.1]
    expect(() => validateRuleSet(c)).toThrow(/expectedShare/)
  })
})

describe("features@0.2.0 파생값(02-archetypes.md §2.2)", () => {
  it("gs = 묶음 ÷ 모형 A total, maxOppose 동점 관살>재성>식상, 비겁형 동점 = 비겁", () => {
    for (const c of SAMPLE) {
      const a = analyzeRules(c)
      const f = extractFeatures(a)
      const A = a.strength.models.find((m) => m.model === "weighted")!
      const g = a.strength.groupTotals
      for (const k of ["bigyeop", "inseong", "siksang", "jaeseong", "gwansal"] as const)
        expect(f[`tg.shareT.${k}`]).toBeCloseTo(g[k] / A.total!, 6)
      const m = Math.max(g.gwansal, g.jaeseong, g.siksang)
      expect(f["tg.maxOppose"]).toBe(g.gwansal === m ? "gwansal" : g.jaeseong === m ? "jaeseong" : "siksang")
      expect(f["tg.supportType"]).toBe(g.bigyeop >= g.inseong ? "bigyeop" : "inseong")
    }
  })

  it("strictPairs(0.30/0.5) 유무 = (pairMin ≥ 0.30 그리고 pairRatio ≥ 0.5) — 보정안이 쓰는 매개 형태와 동치", () => {
    for (const c of [...SAMPLE, ...randomBirthInputs(600, "pairs").map((x) => computeChart(x))]) {
      const f = extractFeatures(analyzeRules(c))
      const sh = analyzeRules(c).qiFlow.shares
      const E = ["wood", "fire", "earth", "metal", "water"] as const
      const brute = E.map((x, i) => [x, E[(i + 2) % 5]] as const).filter(
        ([x, y]) => sh[x] >= 0.3 && sh[y] >= 0.3 && Math.round((Math.min(sh[x], sh[y]) / Math.max(sh[x], sh[y])) * 1e6) / 1e6 >= 0.5,
      )
      expect(f["el.strictPairCount"]).toBe(brute.length)
      expect((f["el.pairMin"] as number) >= 0.3 && (f["el.pairRatio"] as number) >= 0.5).toBe(brute.length > 0)
    }
  })
})

describe("연구소장 대표 사주 24개(+참고 3)", () => {
  it("엔진 계산 원형 = 손계산 원형", () => {
    for (const c of CASES) {
      const r = classifyArchetype(chartOf(c.p), RS, { sensitivity: { hour: true, table: false } })
      expect(`${c.id}:${r.primary.id}`).toBe(`${c.id}:${c.e.arch}`)
    }
  })

  it("사례 6(시주 모름)은 시주 민감 — 12시진에 은빛 늑대·봉황이 함께 나온다", () => {
    const c = CASES.find((x) => x.id === "참고-사례6")!
    const r = classifyArchetype(chartOf(c.p), RS)
    expect(r.hourSensitivity!.stable).toBe(false)
    expect(r.hourSensitivity!.distinctPrimary).toEqual(expect.arrayContaining(["silver-wolf", "bonghwang"]))
  })
})
