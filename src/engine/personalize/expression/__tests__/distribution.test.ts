// 차원별 strong/moderate/faint 분포 측정(연구소장 expression-dimensions.md §8-1, 총괄실장 지시 12).
// 무거워서 기본은 건너뛴다. 실행: EXPRESSION_DISTRIBUTION=1 npx vitest run src/engine/personalize/expression/__tests__/distribution.test.ts
// 건수: EXPRESSION_DISTRIBUTION_N(기본 10000, 시주 있음·없음 각각). 결과는 콘솔 표로만 낸다 — 문턱은 여기서 바꾸지 않는다.
// 목표(연구소장 설계): 핵심 차원 각 strong 15~35%, faint 15~40%. 벗어난 차원은 "범위 밖"으로 표시만 한다.
import { describe, expect, it } from "vitest"
import { analyzeRules, computeChart } from "../../.."
import { expressionTables, potentialsOf } from ".."

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

const RUN = !!process.env.EXPRESSION_DISTRIBUTION
const N = Number(process.env.EXPRESSION_DISTRIBUTION_N ?? 10000)

describe("발현 차원 분포(측정 전용)", () => {
  it.skipIf(!RUN)(`무작위 ${N}건 × 시주 있음/없음`, () => {
    const { dims } = expressionTables()
    const rows: string[] = []
    for (const hourKnown of [true, false]) {
      const rnd = mulberry32(hourKnown ? 20261128 : 20261129)
      const count = dims.dimensions.map(() => ({ strong: 0, moderate: 0, faint: 0 }))
      for (let i = 0; i < N; i++) {
        const c = computeChart({
          calendar: "solar",
          year: 1940 + Math.floor(rnd() * 80),
          month: 1 + Math.floor(rnd() * 12),
          day: 1 + Math.floor(rnd() * 28),
          time: hourKnown ? { hour: Math.floor(rnd() * 24), minute: Math.floor(rnd() * 60) } : null,
          gender: rnd() < 0.5 ? "M" : "F",
        })
        potentialsOf(analyzeRules(c), dims).forEach((p, j) => count[j][p.level]++)
      }
      rows.push(`\n[시주 ${hourKnown ? "있음" : "없음"}] N=${N}`)
      rows.push("차원         갈래   strong%  moderate%  faint%  목표(핵심)")
      dims.dimensions.forEach((d, j) => {
        const pct = (x: number) => ((x / N) * 100).toFixed(1).padStart(6)
        const s = (count[j].strong / N) * 100
        const f = (count[j].faint / N) * 100
        const ok = d.kind !== "core" ? "-" : s >= 15 && s <= 35 && f >= 15 && f <= 40 ? "범위 안" : "범위 밖"
        rows.push(`${d.id.padEnd(12)} ${d.kind.padEnd(5)} ${pct(count[j].strong)}   ${pct(count[j].moderate)}    ${pct(count[j].faint)}  ${ok}`)
        expect(count[j].strong + count[j].moderate + count[j].faint).toBe(N)
      })
    }
    console.log(rows.join("\n"))
  }, 3_600_000)
})
