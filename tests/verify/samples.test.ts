// 실제 저장 형식 견본 2개(깨끗한 것 / 문제투성이) + 결정론·입력 불변·형식 오류·타입 호환
import { describe, expect, it } from "vitest"
import { analyzeRules, computeChart, type Pillar } from "@/engine"
import { summarizeReport, verifyReading, type ReadingLike, type VerifySajuInput } from "@/engine/verify"
import { buildSajuInput, type SajuInputData } from "@/lib/saju-input"
import type { ClaimsResult, FullReading } from "@/lib/generate-reading-v2"
import { BAD_READING, CLEAN_READING, NOW, SAJU_1990F } from "./fixtures"

// 타입 호환: 콘텐츠 엔진의 출력·입력 타입이 검증기 타입에 그대로 들어가는지 컴파일로 고정
const _r1: ReadingLike = CLEAN_READING satisfies FullReading
const _r2: ReadingLike = { chart_summary: "", cover_title: "", claims: [], dictionary: [] } satisfies ClaimsResult
const _s: VerifySajuInput = SAJU_1990F satisfies SajuInputData
void _r1
void _r2
void _s

const chart = computeChart({ calendar: "solar", year: 1990, month: 5, day: 15, time: { hour: 14, minute: 0 }, timezone: "Asia/Seoul", gender: "F" })
const p = (g: string): Pillar => ({ stem: g[0], branch: g[1] }) as Pillar

describe("견본 sajuInput은 실제 엔진 출력이다", () => {
  it("SAJU_1990F = buildSajuInput(1990-05-15 14시 여, now 2026-06-01)", () => {
    expect(buildSajuInput(1990, 5, 15, 14, "F", "SOLAR", "지연", false, { now: NOW })).toEqual(SAJU_1990F)
  })
})

describe("깨끗한 견본", () => {
  it("sajuInput만으로: 발견 0건, pass", () => {
    const r = verifyReading(CLEAN_READING, { sajuInput: SAJU_1990F })
    expect(r.findings).toEqual([])
    expect(r.pass).toBe(true)
    expect(r.score).toBe(100)
  })
  it("chart·rules(대운·세운 포함)를 넘겨도 발견 0건", () => {
    const rules = analyzeRules(chart, undefined, { luck: SAJU_1990F.daeun.map((d) => p(d.ganzhi)), year: p(SAJU_1990F.this_year_ganzhi) })
    expect(verifyReading(CLEAN_READING, { sajuInput: SAJU_1990F, chart }).findings).toEqual([])
    expect(verifyReading(CLEAN_READING, { sajuInput: SAJU_1990F, rules }).findings).toEqual([])
  })
  it("장별 근거 표지 비율 통계가 남는다", () => {
    const r = verifyReading(CLEAN_READING, { sajuInput: SAJU_1990F })
    expect(r.stats.barnumByChapter.filter((s) => s.path.startsWith("parts")).every((s) => s.unmarked === 0)).toBe(true)
    expect(r.stats.sentences).toBeGreaterThan(15)
  })
  it("다른 사람 원국으로 검사하면 근거 글자가 없어 막힌다(대조가 실제로 일어나는지)", () => {
    const other = buildSajuInput(1985, 11, 3, 8, "M", "SOLAR", undefined, false, { now: NOW })
    const r = verifyReading(CLEAN_READING, { sajuInput: other })
    expect(r.pass).toBe(false)
    expect(r.findings.some((f) => f.code === "BASIS_NOT_IN_CHART" && f.severity === "block")).toBe(true)
  })
})

describe("문제투성이 견본", () => {
  const ctx = { sajuInput: { ...SAJU_1990F, known_facts: ["2019년 결혼"] }, userText: "요즘 정말 죽고 싶어요" }
  const r = verifyReading(BAD_READING, ctx)
  it("pass = false", () => {
    expect(r.pass).toBe(false)
    expect(r.counts.block).toBeGreaterThanOrEqual(15)
  })
  it("모든 검사 항목 코드가 나온다", () => {
    const codes = new Set(r.findings.filter((f) => f.severity !== "info").map((f) => f.code))
    for (const c of [
      "BASIS_NOT_IN_CHART", "YEAR_GANZHI_MISMATCH", "TENGOD_MISMATCH", "FORBIDDEN_TOPIC", "FAKE_CLASSIC_QUOTE", "BARNUM",
      "MORAL_JUDGEMENT", "GENDER_STEREOTYPE", "SCIENTIFIC_CLAIM", "KNOWN_FACT_AS_PREDICTION", "UNSAFE_HTML", "CRISIS_RESPONSE",
    ] as const)
      expect(codes.has(c), c).toBe(true)
  })
  it("금지 주제 세부 분류", () => {
    const rules = new Set(r.findings.filter((f) => f.code === "FORBIDDEN_TOPIC").map((f) => f.rule))
    for (const x of ["serious-illness", "death", "investment", "others-mind", "talisman"]) expect(rules.has(x), x).toBe(true)
  })
  it("발견마다 위치(path·field)와 40자 이하 발췌가 있고, block이 앞에 온다", () => {
    for (const f of r.findings) {
      expect(f.location.path.length).toBeGreaterThan(0)
      expect([...f.excerpt].length).toBeLessThanOrEqual(40)
      expect(f.message.length).toBeGreaterThan(0)
    }
    const order = r.findings.map((f) => ({ block: 0, warn: 1, info: 2 })[f.severity])
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })
  it("본문 위치에는 장·문단 번호가 붙는다", () => {
    const f = r.findings.find((x) => x.code === "TENGOD_MISMATCH")!
    expect(f.location).toMatchObject({ path: "parts[0].chapters[0].body[1]", part: 0, chapter: 0, chapterKey: "nature", paragraph: 1, sentence: 0 })
  })
  it("요약 한 줄(로그용)에는 본문이 들어가지 않는다", () => {
    const line = summarizeReport(r)
    expect(line).toMatch(/^verify@0\.1\.0 BLOCK score=0 block=\d+ warn=\d+ info=\d+ codes=/)
    expect(line).not.toContain("죽고")
    expect(line).not.toContain("지연")
  })
})

describe("결정론 · 입력 불변 · 형식 오류", () => {
  it("같은 입력 두 번 → 같은 보고서", () => {
    const ctx = { sajuInput: SAJU_1990F, userText: "죽고 싶어요" }
    expect(verifyReading(BAD_READING, ctx)).toEqual(verifyReading(BAD_READING, ctx))
  })
  it("입력 객체를 바꾸지 않는다", () => {
    const before = JSON.stringify([CLEAN_READING, BAD_READING, SAJU_1990F])
    verifyReading(BAD_READING, { sajuInput: SAJU_1990F })
    verifyReading(CLEAN_READING, { sajuInput: SAJU_1990F, chart })
    expect(JSON.stringify([CLEAN_READING, BAD_READING, SAJU_1990F])).toBe(before)
  })
  it("풀이가 객체가 아니면 MALFORMED_READING block", () => {
    for (const bad of [null, "문자열", 3, []]) {
      const r = verifyReading(bad, { sajuInput: SAJU_1990F })
      expect(r.pass).toBe(false)
      expect(r.findings[0].code).toBe("MALFORMED_READING")
    }
  })
  it("sajuInput 간지가 깨져 있으면 대조 불가로 block", () => {
    const r = verifyReading(CLEAN_READING, { sajuInput: { ...SAJU_1990F, pillars: { ...SAJU_1990F.pillars, day: "庚丑" } } })
    expect(r.pass).toBe(false)
    expect(r.findings.some((f) => f.code === "MALFORMED_READING")).toBe(true)
  })
  it("빈 풀이 객체는 통과(검사할 글이 없음) — 형식 검사는 콘텐츠 엔진 몫", () => {
    expect(verifyReading({}, { sajuInput: SAJU_1990F }).pass).toBe(true)
  })
})
