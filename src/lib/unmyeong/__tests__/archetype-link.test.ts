import { describe, expect, it } from "vitest"
import { analyzeArchetype, analyzeRules, ARCHETYPE_ID_LIST, computeChart, type RuleAnalysis } from "@/engine"
// 다리 기운 대조용(엔진 내부 특징 — 공개 API 아님, 테스트에서만 읽는다)
import { extractFeatures } from "@/engine/archetype/features"
import { buildSajuInputFromRequest } from "@/lib/saju-input"
import { pairBridgeOf, resolveArchetype, toArchetypeView } from "@/lib/unmyeong/archetype-link"
import { buildUnmyeongFree, chartFromSajuInput, validateUnmyeongFreeRequest } from "@/lib/unmyeong/free"
import { BRIDGE_WORD, loadFreeCopy } from "@/lib/unmyeong/free-copy"

const exact = (y: number, m: number, d: number, h: number, gender: "M" | "F") =>
  ({ birthYear: y, birthMonth: m, birthDay: d, birthHour: h, birthMinute: 30, timeMode: "exact", gender, calType: "SOLAR" })

/** 원형별 대표 사례(1960년 표본에서 처음 나온 입력, 시각 앎) */
const SAMPLES: Record<string, ReturnType<typeof exact>> = {
  galaxy: exact(1960, 4, 19, 2, "F"),
  hyeonmu: exact(1960, 1, 3, 2, "M"),
  "golden-sun": exact(1960, 6, 11, 10, "F"),
  "moon-goddess": exact(1960, 2, 27, 18, "F"),
  bonghwang: exact(1960, 3, 11, 10, "M"),
  baekho: exact(1960, 2, 27, 2, "F"),
  "black-fox": exact(1960, 1, 3, 10, "M"),
  "white-deer": exact(1960, 1, 27, 10, "M"),
  sage: exact(1960, 2, 3, 2, "F"),
  cheongnyong: exact(1960, 1, 11, 18, "M"),
  "silver-wolf": exact(1960, 1, 11, 2, "M"),
  "eternal-forest": exact(1960, 2, 11, 2, "F"),
}

const person = (body: unknown) => {
  const v = validateUnmyeongFreeRequest(body)
  if (!v.ok) throw new Error(v.error)
  return v.value
}
const chartAndRules = (body: unknown) => {
  const p = person(body)
  const s = buildSajuInputFromRequest(p)
  const chart = chartFromSajuInput(s, p.gender)
  return { chart, rules: analyzeRules(chart) }
}

describe("resolveArchetype — 엔진 결과 연결", () => {
  it("대표 사례 12개가 각 원형으로 나오고, 화면 값은 엔진 결과와 같다", () => {
    expect(Object.keys(SAMPLES).sort()).toEqual([...ARCHETYPE_ID_LIST].sort())
    for (const [id, body] of Object.entries(SAMPLES)) {
      const { chart, rules } = chartAndRules(body)
      const r = analyzeArchetype(rules, chart)
      const v = resolveArchetype(chart, rules)
      expect(v.id, id).toBe(id)
      expect(v).toMatchObject({
        id: r.id, name: r.name, category: r.category, order: r.order,
        secondary: r.secondary?.id ?? null, secondaryName: r.secondary?.name ?? null,
        variantTags: [], hourUnknownNote: false, disclaimer: "creative-symbol", disclaimerText: r.disclaimerText, version: r.version,
      })
      expect(v.stability).toEqual({ nearBoundary: false, tableSensitive: r.sensitivity.table.changed, hourSensitive: null })
      expect(v.name.length).toBeGreaterThan(0)
      expect(v.disclaimerText.length).toBeGreaterThan(0)
      // 근거: 주 원형 관문에서 참이 된 조건(1개 이상), 내부 기록은 없다
      expect(v.matched.length, id).toBeGreaterThan(0)
      const gate = r.basis.find((b) => b.id === r.id)!
      expect(gate.passed).toBe(true)
      for (const m of v.matched) expect(gate.conditions.some((c) => c.key === m.key && c.op === m.op)).toBe(true)
      const text = JSON.stringify(v)
      for (const k of ["rulesHash", "byHour", "byTable", "ruleOptions", "failedOn", "conditions"]) expect(text, k).not.toContain(k)
      // 다리 기운은 달의 여신만
      if (id !== "moon-goddess") expect(v.bridge, id).toBeNull()
    }
  })

  it("달의 여신: 다리 기운(통관 오행)을 넣는다 — 대표 사례는 수(물)", () => {
    const { chart, rules } = chartAndRules(SAMPLES["moon-goddess"])
    const v = resolveArchetype(chart, rules)
    expect(v.bridge).toBe("수")
    expect(v.secondary).toBe("baekho")
  })

  it("다리 기운 계산은 엔진 특징 el.pairBridge와 같다(여러 사주 대조)", () => {
    const KO = { wood: "목", fire: "화", earth: "토", metal: "금", water: "수" } as const
    let withPair = 0
    for (let y = 1950; y < 2010; y += 3) for (let m = 1; m <= 12; m += 2) for (const d of [5, 20]) {
      const chart = computeChart({ calendar: "solar", year: y, month: m, day: d, isLeapMonth: false, time: { hour: 9, minute: 0 }, timezone: "Asia/Seoul", gender: "F" })
      const rules: RuleAnalysis = analyzeRules(chart)
      const f = extractFeatures(rules)["el.pairBridge"] as keyof typeof KO | null
      const b = pairBridgeOf(rules)
      expect(b, `${y}-${m}-${d}`).toBe(f ? KO[f] : null)
      if (b) withPair++
    }
    expect(withPair).toBeGreaterThan(0)
  })

  it("판정 표(kr-monthly-30)가 아닌 분석이면 다리 기운을 계산하지 않는다(대체 문장 경로)", () => {
    const { chart } = chartAndRules(SAMPLES["moon-goddess"])
    expect(pairBridgeOf(analyzeRules(chart, { hiddenStemTable: "cn-lunarjs" }))).toBeNull()
  })

  it("시각 모름: hourUnknownNote true, hourSensitive는 12시진 재판정 결과", () => {
    const { chart, rules } = chartAndRules({ birthYear: 1990, birthMonth: 5, birthDay: 15, birthHour: null, gender: "F", calType: "SOLAR" })
    const r = analyzeArchetype(rules, chart)
    const v = toArchetypeView(r, pairBridgeOf(rules))
    expect(v.hourUnknownNote).toBe(true)
    expect(v.stability.hourSensitive).toBe(r.sensitivity.hour!.stable < 12)
    expect(JSON.stringify(v)).not.toContain("byHour")
  })
})

describe("응답 — 원형과 5장 문안이 실제로 채워진다(content/unmyeong/free-copy.json)", () => {
  const raw = loadFreeCopy()

  it("12 원형 모두 pending false, 다섯 장이 그 원형 문안으로 채워지고 날 토큰이 없다", () => {
    expect(raw).not.toBeNull()
    const copy = raw as { chapters: { byArchetype: Record<string, string> }[] }
    for (const [id, body] of Object.entries(SAMPLES)) {
      const r = buildUnmyeongFree(person(body), { freeCopy: raw })
      expect(r.archetype?.id, id).toBe(id)
      expect(r.pending, id).toEqual({ archetype: false, chapters: false })
      expect(r.chapters?.map((c) => c.no), id).toEqual([1, 2, 3, 4, 5])
      for (const c of r.chapters!) {
        expect(c.text, `${id} ${c.key}`).not.toMatch(/\{[^{}]*\}/)
        expect(c.text.length).toBeGreaterThan(0)
      }
      // 조립기(compose.ts): 1장은 그 사람의 일주로 시작하고(시각 앎 → 시각 안내 없음), 2장은 그 원형 문안 그대로
      expect(r.chapters![0].text, id).toContain(`${r.dayPillar.ko}(${r.dayPillar.hanja})일에 났구나.`)
      expect(r.chapters![0].text, id).not.toContain((raw as { hourNote: { text: string } }).hourNote.text)
      expect(r.chapters![1].text, id).toBe(copy.chapters[1].byArchetype[id].trim())
    }
  })

  it("달의 여신 5장: 그해 줄이 없는 해(원형 원문 대체)에는 {bridge}가 다리 기운 말(물)로 바뀐다, 그해 줄이 있으면 날 토큰 없음", () => {
    // this-year.json에 2028년이 아직 없다 → compose.json 5장 fallback(원형 원문 + {bridge} 처리)
    const r = buildUnmyeongFree(person(SAMPLES["moon-goddess"]), { freeCopy: raw, now: new Date("2028-06-01T00:00:00Z") })
    expect(r.thisYear.year).toBe(2028)
    expect(r.chapters![4].text).toContain(`다리는 ${BRIDGE_WORD["수"]}의 기운`)
    const y26 = buildUnmyeongFree(person(SAMPLES["moon-goddess"]), { freeCopy: raw, now: new Date("2026-06-01T00:00:00Z") })
    expect(y26.chapters![4].text.startsWith("날씨 이야기다.")).toBe(true)
    for (const c of y26.chapters!) expect(c.text).not.toMatch(/[{}]/)
  })

  it("시각 모름이면 1장 끝에 시각 안내가 붙는다", () => {
    const r = buildUnmyeongFree(person({ birthYear: 1990, birthMonth: 5, birthDay: 15, birthHour: null, gender: "F", calType: "SOLAR" }), { freeCopy: raw })
    const note = (raw as { hourNote: { text: string } }).hourNote.text
    expect(r.pending).toEqual({ archetype: false, chapters: false })
    expect(r.archetype?.hourUnknownNote).toBe(true)
    expect(r.chapters![0].text.endsWith(note)).toBe(true)
  })
})
