// 품질검증: 발현 엔진(expression@0.2.0) 차원 분포·변별력 측정 — 엔진을 고치지 않고 출력·비율만 잰다.
// 실행: npx tsx scripts/qa/expression-distribution.ts [건수=10000] [시주모름 12시진 재판정 건수=2000]
// 출력: 8차원 단계 분포, grain strong의 고른 쪽/센 쪽, balanced·thin·청탁 승격 비율, q 분위수,
//       연구소장 문서(§3.7.2)만 보고 다시 계산한 grain과 엔진의 불일치 수, 시주 모름 faint 중 hourStable<8/12 비율(§7.1 요청).
// 0.1.0판(steadiness·edge 측정)은 0.2.0에서 grain으로 바뀌어 대체했다.
// 외부 호출 없음. 무작위 생일(1930~2024, 양력, 일 1~28) — 총괄실장·개발자 측정과 같은 방식(시드만 다름).
import { analyzeRules, computeChart, type RuleAnalysis } from "../../src/engine"
import { buildExpressionReport, expressionTables, potentialsOf } from "../../src/engine/personalize/expression"

const N = Number(process.argv[2] ?? 10000)
const NH = Number(process.argv[3] ?? 2000)
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
const qt = (xs: number[], p: number): number => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]
}
const pct = (x: number, n: number): string => ((x / n) * 100).toFixed(1).padStart(5)
const entropy = (c: Record<string, number>, n: number): number =>
  -Object.values(c).reduce((s, v) => (v ? s + (v / n) * Math.log2(v / n) : s), 0)

// ── 독립 grain(연구소장 §3.7.2만 보고 구현 — 엔진 chart-rules.ts를 쓰지 않음)
const STEMS = "甲乙丙丁戊己庚辛壬癸"
const elOf = (s: string): number => Math.floor(STEMS.indexOf(s) / 2)
const yangStem = (s: string): boolean => STEMS.indexOf(s) % 2 === 0
function tenGod(dm: string, t: string): string {
  const a = elOf(dm), b = elOf(t), same = yangStem(dm) === yangStem(t)
  if (a === b) return same ? "비견" : "겁재"
  if ((a + 1) % 5 === b) return same ? "식신" : "상관"
  if ((a + 2) % 5 === b) return same ? "편재" : "정재"
  if ((b + 2) % 5 === a) return same ? "편관" : "정관"
  return same ? "편인" : "정인"
}
const BW: Record<string, number> = { year: 1, month: 3, day: 1.5, hour: 1 }
const STEADY = ["정재", "정관", "정인", "식신"], EDGE = ["편관", "상관", "편인", "겁재"]
const r6 = (x: number): number => Math.round(x * 1e6) / 1e6
function myGrain(a: RuleAnalysis): { level: string; lean: string; q: number | null; thin: boolean; promoted: boolean } {
  const n = a.source.natal, dm = n.day.stem
  const tg: Record<string, number> = {}
  const stemTG: string[] = []
  let T = 0
  for (const k of ["year", "month", "day", "hour"] as const) {
    const p = n[k]
    if (!p) continue
    T += 1 + BW[k]
    if (k !== "day") { const t = tenGod(dm, p.stem); tg[t] = (tg[t] ?? 0) + 1; stemTG.push(t) }
    for (const h of a.hiddenStems.pillars[k]!) { const t = tenGod(dm, h.stem); tg[t] = (tg[t] ?? 0) + BW[k] * h.weight }
  }
  const S = STEADY.reduce((x, t) => x + (tg[t] ?? 0), 0), E = EDGE.reduce((x, t) => x + (tg[t] ?? 0), 0)
  if ((S + E) / T < 0.3) return { level: "faint", lean: "balanced", q: null, thin: true, promoted: false }
  const q = r6(S / (S + E)), d = r6(Math.abs(q - 0.5))
  const lean = d < 0.07 ? "balanced" : q > 0.5 ? "steady" : "edge"
  const shown = lean !== "balanced" && stemTG.some((t) => (lean === "steady" ? STEADY : EDGE).includes(t))
  let level = d < 0.07 ? "faint" : d >= 0.2 && shown ? "strong" : "moderate"
  let promoted = false
  if (lean === "edge" && level === "moderate" && a.qiFlow.clarityFlags.some((f) => ["상관견관", "효신탈식", "관살혼잡"].includes(f.flag))) { level = "strong"; promoted = true }
  return { level, lean, q, thin: false, promoted }
}

for (const hourKnown of [true, false]) {
  const rnd = mulberry32(hourKnown ? 7001 : 7002)
  const cnt = dims.dimensions.map(() => ({ strong: 0, moderate: 0, faint: 0 }))
  const grain = { strongSteady: 0, strongEdge: 0, modSteady: 0, modEdge: 0, balanced: 0, thin: 0, promoted: 0, mismatch: 0 }
  const qs: number[] = []
  const coreProfiles = new Set<string>()
  const fullProfiles = new Set<string>()
  const hourFaint: Record<string, { faint: number; unstable: number }> = Object.fromEntries(dims.dimensions.map((d) => [d.id, { faint: 0, unstable: 0 }]))
  let hourChecked = 0
  for (let i = 0; i < N; i++) {
    const c = computeChart({
      calendar: "solar", year: 1930 + Math.floor(rnd() * 95), month: 1 + Math.floor(rnd() * 12), day: 1 + Math.floor(rnd() * 28),
      time: hourKnown ? { hour: Math.floor(rnd() * 24), minute: Math.floor(rnd() * 60) } : null, gender: rnd() < 0.5 ? "M" : "F",
    })
    const a = analyzeRules(c)
    const ps = potentialsOf(a, dims)
    ps.forEach((p, j) => cnt[j][p.level]++)
    const g = ps.find((p) => p.dimensionId === "grain")!
    const mg = myGrain(a)
    if (mg.level !== g.level || mg.lean !== g.lean) grain.mismatch++
    if (g.level === "strong") { if (g.lean === "steady") grain.strongSteady++; else grain.strongEdge++ }
    if (g.level === "moderate") { if (g.lean === "steady") grain.modSteady++; else grain.modEdge++ }
    if (g.lean === "balanced") grain.balanced++
    if (g.basis.some((b) => b.ruleId === "exp.lv.grain.thin")) grain.thin++
    if (g.basis.some((b) => b.ruleId === "exp.mod.grain.clarity")) grain.promoted++
    if (mg.q !== null) qs.push(mg.q)
    coreProfiles.add(ps.slice(0, 5).map((p) => p.level[0]).join(""))
    fullProfiles.add(ps.map((p) => p.level[0] + (p.lean ? p.lean[0] : "")).join(""))
    if (!hourKnown && hourChecked < NH) {
      hourChecked++
      const r = buildExpressionReport({ analysis: a }, { tableCheck: false })
      for (const p of r.innate) if (p.level === "faint") {
        hourFaint[p.dimensionId].faint++
        if ((p.hourStable?.stable ?? 12) < 8) hourFaint[p.dimensionId].unstable++
      }
    }
  }
  console.log(`\n[시주 ${hourKnown ? "있음" : "없음"}] N=${N}`)
  console.log("차원         strong moderate faint  엔트로피(최대 1.585)")
  dims.dimensions.forEach((d, j) =>
    console.log(`${d.id.padEnd(12)} ${pct(cnt[j].strong, N)}  ${pct(cnt[j].moderate, N)}  ${pct(cnt[j].faint, N)}  ${entropy(cnt[j], N).toFixed(3)}`))
  const st = grain.strongSteady + grain.strongEdge
  console.log(`grain strong ${pct(st, N)}% = 고른 쪽 ${pct(grain.strongSteady, N)}% + 센 쪽 ${pct(grain.strongEdge, N)}% (strong 안 고른 쪽 비중 ${pct(grain.strongSteady, st)}%)`,
    `· moderate 고른 ${pct(grain.modSteady, N)}% 센 ${pct(grain.modEdge, N)}% · balanced(faint) ${pct(grain.balanced, N)}% (그중 thin ${pct(grain.thin, N)}%) · 청탁 승격 ${pct(grain.promoted, N)}%`)
  console.log(`grain q 분위수 p10 ${qt(qs, 0.1)} p25 ${qt(qs, 0.25)} p50 ${qt(qs, 0.5)} p75 ${qt(qs, 0.75)} p90 ${qt(qs, 0.9)} (thin 제외 ${qs.length}건)`)
  console.log(`문서 기반 독립 grain 재계산 ↔ 엔진 불일치 ${grain.mismatch} / ${N}`)
  console.log(`서로 다른 8차원 단계(+grain 방향) 조합 수 ${fullProfiles.size}, 핵심 5차원 조합 수 ${coreProfiles.size}`)
  if (!hourKnown) {
    console.log(`시주 모름 faint 중 hourStable<8/12 (12시진 재판정 ${hourChecked}건):`,
      Object.entries(hourFaint).map(([k, v]) => `${k} ${v.unstable}/${v.faint}(${pct(v.unstable, v.faint || 1).trim()}%) · 안정 faint ${pct(v.faint - v.unstable, hourChecked).trim()}%`).join(", "))
  }
}
