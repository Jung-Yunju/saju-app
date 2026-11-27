// 품질검증 P3-05 — 규칙 엔진 rules@0.2.0 vs 독립 오라클 (기본 옵션 2,000건 + 합성 2,000건 + 옵션 변형 각 200건)
import { describe, expect, it } from "vitest"
import { analyzeRules, computeChart, type RuleOptions } from "@/engine"
import { SPEC_DEFAULTS, SPEC_STAGE_TABLE, LU_TABLE, STEMS, BRANCHES, stageOf, type OOpts } from "./oracle"
import { chartSamples, compare, emptyFails, summarize, syntheticSamples, type CompareStats, type Sample } from "./compare"

const TEMPLATE = computeChart({ calendar: "solar", year: 1990, month: 5, day: 5, time: { hour: 10, minute: 0 }, timezone: "Asia/Seoul", gender: "M" })

// subsume=true: 엔진 개발자가 정한 포섭 규칙(명세 공백, 연구소장 확인 대기)을 QA 오라클에 따로 구현해 적용
function run(samples: Sample[], opts: Partial<RuleOptions> | undefined, expected: OOpts, stats?: CompareStats, subsume = true) {
  const fails = emptyFails()
  for (const s of samples) {
    let a
    try { a = analyzeRules(s.chart, opts, s.extra) } catch (e) { fails.meta.push(`${s.label}: THROW ${(e as Error).message}`); continue }
    compare(s, a, expected, fails, stats, { subsume })
  }
  return fails
}
const total = (f: ReturnType<typeof emptyFails>) => Object.values(f).reduce((n, v) => n + v.length, 0)

describe("오라클 자체 검산 (명세 표와 공식 일치)", () => {
  it("12운성 공식 = rules-spec §5-1 표 120칸, 건록 = 록 표", () => {
    for (const s of STEMS) BRANCHES.forEach((b, i) => {
      expect(stageOf(s, b, "reverse", "withFire"), `${s}${b}`).toBe(SPEC_STAGE_TABLE[s][i])
    })
    for (const s of STEMS) expect(SPEC_STAGE_TABLE[s][BRANCHES.indexOf(LU_TABLE[s])], s).toBe("건록")
  })
})

describe("P3-05 기본 옵션 — computeChart 원국 2,000건 (시드 20261127)", () => {
  const samples = chartSamples(2000, 20261127)
  it("기본 옵션 값이 명세 기본 제안과 같다 + 전 항목 일치", () => {
    const stats: CompareStats = { interactionTypes: {} }
    const f = run(samples, undefined, SPEC_DEFAULTS, stats)
    console.log("[base-2000] 관계 유형별 오라클 건수", JSON.stringify(stats.interactionTypes))
    console.log(`[base-2000] 근거 위치 검사 ${stats.positions}개`)
    console.log(`[base-2000] 불일치 합계 ${total(f)}\n${summarize(f, samples.length)}`)
    expect(total(f), summarize(f, samples.length)).toBe(0)
  })
})

describe("P3-05 기본 옵션 — 합성 원국 2,000건 (60갑자 임의, 시드 777)", () => {
  const samples = syntheticSamples(2000, 777, TEMPLATE)
  it("전 항목 일치", () => {
    const stats: CompareStats = { interactionTypes: {} }
    const f = run(samples, {}, SPEC_DEFAULTS, stats)
    console.log("[synthetic-2000] 관계 유형별 오라클 건수", JSON.stringify(stats.interactionTypes))
    console.log(`[synthetic-2000] 근거 위치 검사 ${stats.positions}개`)
    console.log(`[synthetic-2000] 불일치 합계 ${total(f)}\n${summarize(f, samples.length)}`)
    expect(total(f), summarize(f, samples.length)).toBe(0)
  })
})

describe("명세 문자 그대로(포섭 없음)와의 차이 — 포섭 규칙 영향 측정", () => {
  it("차이는 '엔진이 뺀 두 글자 기록'뿐이고, 엔진이 더 만든 기록은 없다", () => {
    const samples = [...chartSamples(2000, 20261127), ...syntheticSamples(2000, 777, TEMPLATE)]
    const f = run(samples, undefined, SPEC_DEFAULTS, undefined, false)
    const others = Object.entries(f).filter(([k, v]) => k !== "interactions" && v.length)
    expect(others, JSON.stringify(others).slice(0, 2000)).toEqual([])
    expect(f.interactions.filter((x) => /초과\[[^\]]/.test(x))).toEqual([])
    const dropped = f.interactions.reduce((n, x) => n + [...x.matchAll(/×(\d+)/g)].reduce((m, g) => m + Number(g[1]), 0), 0)
    const byType: Record<string, number> = {}
    for (const x of f.interactions) for (const g of x.matchAll(/ ?([a-zA-Z/]+)\[[^\]]*\]\([^)]*\)×(\d+)/g)) byType[g[1]] = (byType[g[1]] ?? 0) + Number(g[2])
    console.log(`[literal] 표본 ${samples.length}건 중 ${f.interactions.length}건에서 두 글자 기록 ${dropped}개가 포섭으로 빠짐 ${JSON.stringify(byType)}`)
  })
})

const VARIANTS: Partial<OOpts>[] = [
  { hiddenStemTable: "cn-lunarjs" },
  { hiddenStemTable: "main-only" },
  { branchYinYang: "byOrder" },
  { twelveStagesYin: "sameAsYang" },
  { earthStages: "withWater" },
  { twelveStagesYin: "sameAsYang", earthStages: "withWater" },
  { gongmangBasis: "year" },
  { gongmangBasis: "both" },
  { halfCombine: "allPairs" },
  { partialPunishment: false },
  { wuWeiCombine: "fire" },
  { wuWeiCombine: "earth" },
  { partialDirectional: true },
  { hiddenStemTable: "cn-lunarjs", branchYinYang: "byOrder", twelveStagesYin: "sameAsYang", earthStages: "withWater", gongmangBasis: "both", halfCombine: "allPairs", partialPunishment: false, wuWeiCombine: "earth", partialDirectional: true },
]

describe("P3-05 옵션 변형 — 각 200건(실제 100 + 합성 100)", () => {
  VARIANTS.forEach((v, i) => {
    it(JSON.stringify(v), () => {
      const samples = [...chartSamples(100, 9000 + i), ...syntheticSamples(100, 5000 + i, TEMPLATE)]
      const exp = { ...SPEC_DEFAULTS, ...v } as OOpts
      const f = run(samples, v as Partial<RuleOptions>, exp)
      if (total(f)) console.log(`[variant ${JSON.stringify(v)}] 불일치 ${total(f)}\n${summarize(f, samples.length)}`)
      expect(total(f), summarize(f, samples.length)).toBe(0)
    })
  })
})
