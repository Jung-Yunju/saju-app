// 품질검증: 발현 엔진 결 차원(steadiness·edge) 변별력 측정 — 엔진을 고치지 않고 출력·비율만 잰다.
// 실행: npx tsx scripts/qa/expression-distribution.ts [건수=10000]
// 출력: 차원별 단계 분포, 결 두 차원의 조합 분포, 비율(share) 분위수, 문턱을 바꿨을 때의 가상 분포(엔진 표는 그대로).
// 외부 호출 없음. 무작위 생일(1930~2024, 양력, 일 1~28) — 총괄실장·개발자 측정과 같은 방식(시드만 다름).
import { analyzeRules, computeChart } from "../../src/engine"
import { expressionTables, potentialsOf } from "../../src/engine/personalize/expression"

const N = Number(process.argv[2] ?? 10000)
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
const { dims } = expressionTables()
const q = (xs: number[], p: number): number => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]
}
const pct = (x: number, n: number): string => ((x / n) * 100).toFixed(1).padStart(5)
const entropy = (c: Record<string, number>, n: number): number =>
  -Object.values(c).reduce((s, v) => (v ? s + (v / n) * Math.log2(v / n) : s), 0)

for (const hourKnown of [true, false]) {
  const rnd = mulberry32(hourKnown ? 7001 : 7002)
  const cnt = dims.dimensions.map(() => ({ strong: 0, moderate: 0, faint: 0 }))
  const pair: Record<string, number> = {}
  const shares: Record<string, number[]> = { steadiness: [], edge: [] }
  const shown: Record<string, number> = { steadiness: 0, edge: 0 }
  let clarityLift = 0
  const coreProfiles = new Set<string>()
  const fullProfiles = new Set<string>()
  for (let i = 0; i < N; i++) {
    const c = computeChart({
      calendar: "solar", year: 1930 + Math.floor(rnd() * 95), month: 1 + Math.floor(rnd() * 12), day: 1 + Math.floor(rnd() * 28),
      time: hourKnown ? { hour: Math.floor(rnd() * 24), minute: Math.floor(rnd() * 60) } : null, gender: rnd() < 0.5 ? "M" : "F",
    })
    const ps = potentialsOf(analyzeRules(c), dims)
    ps.forEach((p, j) => cnt[j][p.level]++)
    const st = ps.find((p) => p.dimensionId === "steadiness")!
    const ed = ps.find((p) => p.dimensionId === "edge")!
    pair[`${st.level[0]}/${ed.level[0]}`] = (pair[`${st.level[0]}/${ed.level[0]}`] ?? 0) + 1
    for (const p of [st, ed]) {
      const m = /비율 ([0-9.]+)/.exec(p.basis[0].note)
      shares[p.dimensionId].push(Number(m![1]))
      if (p.basis[0].note.includes("투출 있음")) shown[p.dimensionId]++
    }
    if (ed.basis.some((b) => b.ruleId === "exp.mod.edge.clarity")) clarityLift++
    coreProfiles.add(ps.slice(0, 5).map((p) => p.level[0]).join(""))
    fullProfiles.add(ps.map((p) => p.level[0]).join(""))
  }
  console.log(`\n[시주 ${hourKnown ? "있음" : "없음"}] N=${N}`)
  console.log("차원         strong moderate faint  엔트로피(최대 1.585)")
  dims.dimensions.forEach((d, j) =>
    console.log(`${d.id.padEnd(12)} ${pct(cnt[j].strong, N)}  ${pct(cnt[j].moderate, N)}  ${pct(cnt[j].faint, N)}  ${entropy(cnt[j], N).toFixed(3)}`))
  console.log("steadiness/edge 조합(s=strong,m=moderate,f=faint):", Object.entries(pair).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v, N)}%`).join(", "))
  console.log(`edge clarity로 moderate→strong 올라간 비율 ${pct(clarityLift, N)}%`)
  console.log(`서로 다른 9차원 단계 조합 수 ${fullProfiles.size}, 핵심 5차원 조합 수 ${coreProfiles.size}`)
  for (const id of ["steadiness", "edge"]) {
    const xs = shares[id]
    console.log(`${id} 비율 분위수 p10 ${q(xs, 0.1)} p25 ${q(xs, 0.25)} p50 ${q(xs, 0.5)} p75 ${q(xs, 0.75)} p90 ${q(xs, 0.9)} · 천간 투출 있음 ${pct(shown[id], N)}%`)
    for (const [sS, mS] of [[0.3, 0.12], [0.35, 0.15], [0.4, 0.2], [0.45, 0.25]]) {
      let s = 0, f = 0
      xs.forEach((x) => { if (x >= sS) s++; else if (x < mS) f++ })
      console.log(`   가상 문턱 strong≥${sS}(투출·청탁 보정 무시) faint<${mS}: strong ${pct(s, N)}% faint ${pct(f, N)}%`)
    }
  }
}
