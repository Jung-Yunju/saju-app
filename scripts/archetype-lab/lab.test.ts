// 원형 실험 도구 — 결정성·검증·동점 처리 테스트
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { computeChart, type BirthInput } from "../../src/engine"
import { classifyArchetype } from "./lib/classify"
import { FEATURE_CATALOG } from "./lib/features"
import { runLab } from "./lib/lab"
import { randomBirthInputs } from "./lib/random"
import { canonicalJson, loadRuleSet, RuleSetError, ruleSetHash, validateRuleSet } from "./lib/ruleset"
import type { ArchetypeRuleSet } from "./lib/types"

const RS = loadRuleSet(resolve(__dirname, "rules/example-v0.json"))
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
const INPUTS: BirthInput[] = [
  { calendar: "solar", year: 1990, month: 3, day: 15, time: { hour: 10, minute: 5 }, gender: "M" },
  { calendar: "solar", year: 1987, month: 7, day: 1, time: { hour: 23, minute: 40 }, gender: "F" }, // 서머타임 + 23시대
  { calendar: "solar", year: 2024, month: 2, day: 4, time: { hour: 17, minute: 30 }, gender: "F" }, // 입춘 당일
  { calendar: "solar", year: 1900, month: 1, day: 1, time: null, gender: "M" },
  { calendar: "solar", year: 2100, month: 12, day: 31, time: { hour: 0, minute: 0 }, gender: "M" },
]

describe("결정성", () => {
  it("같은 원국·같은 조건이면 근거 포함 전체 결과가 같다(시각 앎·모름)", () => {
    for (const inp of INPUTS) {
      for (const t of [inp.time, null]) {
        const x = classifyArchetype(computeChart({ ...inp, time: t }), RS)
        const y = classifyArchetype(computeChart({ ...inp, time: t }), RS)
        expect(canonicalJson(x)).toBe(canonicalJson(y))
        expect(JSON.stringify(x)).toBe(JSON.stringify(y)) // 키 순서까지
      }
    }
  })

  it("규칙 파일의 원형 나열 순서를 바꿔도(priority 고정) 결과가 같다", () => {
    const rev = clone(RS)
    rev.archetypes.reverse()
    for (const inp of INPUTS) {
      const c = computeChart(inp)
      const a = classifyArchetype(c, RS)
      const b = classifyArchetype(c, rev)
      expect(b.primary).toEqual(a.primary)
      expect(b.secondary).toEqual(a.secondary)
      expect(b.ranking.map((r) => [r.id, r.score])).toEqual(a.ranking.map((r) => [r.id, r.score]))
      expect(b.hourSensitivity).toEqual(a.hourSensitivity)
    }
  })

  it("같은 시드면 같은 표본·같은 결과 해시, 다른 시드면 다른 표본", () => {
    expect(randomBirthInputs(50, "s1")).toEqual(randomBirthInputs(50, "s1"))
    expect(randomBirthInputs(50, "s1")).not.toEqual(randomBirthInputs(50, "s2"))
    const o = { n: 150, seed: "t", samples: 2, table: true, hour: true, determinism: 10 }
    const a = runLab(RS, o)
    const b = runLab(RS, o)
    expect(a.meta.resultHash).toBe(b.meta.resultHash)
    expect(a.determinism.identical).toBe(10)
    expect(a.meta.errors).toEqual([])
  })

  it("무작위 표본 범위: 1900-01-01 ~ 2100-12-31", () => {
    const xs = randomBirthInputs(5000, "range")
    const key = (x: BirthInput) => x.year * 10000 + x.month * 100 + x.day
    expect(Math.min(...xs.map(key))).toBeGreaterThanOrEqual(19000101)
    expect(Math.max(...xs.map(key))).toBeLessThanOrEqual(21001231)
  })
})

describe("결과 구조", () => {
  it("버전·옵션·규칙 해시·고지 문구를 기록하고, 근거 점수 합 = 점수", () => {
    const r = classifyArchetype(computeChart(INPUTS[0]), RS)
    expect(r.engineVersion).toMatch(/^archetype@/)
    expect(r.featureVersion).toBe("features@0.1.0")
    expect(r.rulesEngineVersion).toMatch(/^rules@/)
    expect(r.ruleSet).toEqual({ id: "example-v0", version: "0.0.1", status: "example", hash: ruleSetHash(RS) })
    expect(r.ruleOptions.hiddenStemTable).toBe("kr-monthly-30")
    expect(r.disclaimer).toContain("창작적 상징 해석")
    expect(Object.keys(r.features)).toEqual(FEATURE_CATALOG.map((s) => s.key))
    for (const s of r.ranking) expect(Math.round(s.evidence.reduce((a, e) => a + e.points, 0) * 1e6)).toBe(Math.round(s.score * 1e6))
    expect(r.hourSensitivity).toBeNull()
    expect(r.tableSensitivity!.byTable.map((x) => x.tableId)).toEqual(["kr-monthly-30", "cn-lunarjs", "main-only"])
  })

  it("시각 모름이면 12시진 민감도를 기록한다", () => {
    const r = classifyArchetype(computeChart({ ...INPUTS[0], time: null }), RS)
    expect(r.hourKnown).toBe(false)
    expect(r.features["meta.hourKnown"]).toBe(false)
    expect(r.hourSensitivity!.byHour).toHaveLength(12)
    expect(r.hourSensitivity!.byHour.map((h) => h.hour.branch).join("")).toBe("子丑寅卯辰巳午未申酉戌亥")
    expect(r.hourSensitivity!.stable).toBe(r.hourSensitivity!.distinctPrimary.length === 1)
    const m = classifyArchetype(computeChart({ ...INPUTS[0], time: null }), RS, { hourUnknownPolicy: "hourModal" })
    expect(m.primary.id).toBe(r.hourSensitivity!.modal.id)
  })

  it("지장간 표 옵션을 바꾸면 결과의 ruleOptions에 남는다", () => {
    const r = classifyArchetype(computeChart(INPUTS[0]), RS, { ruleOptions: { hiddenStemTable: "cn-lunarjs" } })
    expect(r.ruleOptions.hiddenStemTable).toBe("cn-lunarjs")
    expect(r.tableSensitivity!.byTable.find((x) => x.tableId === "cn-lunarjs")!.primary).toBe(r.primary.id)
  })
})

describe("동점·대체", () => {
  const twin = (minScore: number): ArchetypeRuleSet =>
    validateRuleSet({
      ...clone(RS),
      params: { boundaryMargin: 0.5, minScore },
      fallback: "b-two",
      archetypes: [
        { id: "b-two", name: "둘", category: "nature", priority: 2, terms: [{ id: "x", label: "항상", points: 1 }] },
        { id: "a-one", name: "하나", category: "nature", priority: 1, terms: [{ id: "x", label: "항상", points: 1 }] },
        { id: "c-gated", name: "셋", category: "nature", priority: 3, require: { f: "dm.stem", eq: "甲" }, terms: [{ id: "x", label: "항상", points: 9 }] },
      ],
    })
  it("완전 동점이면 priority로 정하고 tie·boundary를 표시한다", () => {
    const c = computeChart(INPUTS[0]) // 일간이 甲이 아님을 확인하고 쓴다(c-gated 탈락 확인용)
    expect(c.pillars.day.stem).not.toBe("甲")
    const r = classifyArchetype(c, twin(0))
    expect(r.primary.id).toBe("a-one")
    expect(r.secondary!.id).toBe("b-two")
    expect(r).toMatchObject({ tie: true, boundary: true, decidedBy: "priority", margin: 0 })
    expect(r.ranking.find((x) => x.id === "c-gated")).toMatchObject({ eligible: false, ineligibleBy: "require" })
  })
  it("1순위가 minScore 미만이면 fallback 원형", () => {
    const r = classifyArchetype(computeChart(INPUTS[0]), twin(5))
    expect(r.primary.id).toBe("b-two")
    expect(r.decidedBy).toBe("fallback")
  })
})

describe("규칙 파일 검증(오타를 조용히 넘기지 않음)", () => {
  const bad = (mut: (r: ArchetypeRuleSet) => void) => {
    const r = clone(RS)
    mut(r)
    return () => validateRuleSet(r)
  }
  it("없는 특징 키", () => expect(bad((r) => (r.archetypes[0].terms[1].when = { f: "season.typo", eq: "spring" }))).toThrow(RuleSetError))
  it("특징에 없는 값", () => expect(bad((r) => (r.archetypes[0].terms[1].when = { f: "season", eq: "봄" }))).toThrow(/없는 값/))
  it("숫자 연산자를 문자열 특징에", () => expect(bad((r) => (r.archetypes[0].terms[1].when = { f: "season", gte: 1 }))).toThrow(RuleSetError))
  it("priority 중복", () => expect(bad((r) => (r.archetypes[1].priority = r.archetypes[0].priority))).toThrow(/priority/))
  it("featureVersion 불일치", () => expect(bad((r) => (r.featureVersion = "features@9.9.9"))).toThrow(/featureVersion/))
  it("fallback 없음", () => expect(bad((r) => (r.fallback = "nope"))).toThrow(/fallback/))
  it("points·linear 둘 다", () => expect(bad((r) => (r.archetypes[0].terms[1].linear = { f: "cl.T", mul: 1 }))).toThrow(/정확히 하나/))
})
