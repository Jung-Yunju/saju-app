// 품질검증 — rules@0.4.0 연구소장 측정 요청(docs/knowledge/reviews/2026-11-28-p306-decisions.md §3)
// 같은 표본 규칙: 1900~2100 무작위 양력, 시드 20261128, 시각 앎 10,000 + 모름 2,000 (p306-required §7.1-7과 같은 생성 순서).
// 측정마다 엔진 값과 QA 오라클(strength-oracle.ts, 명세만 보고 작성) 값을 함께 내고, 둘이 다르면 실패시킨다(측정값이 엔진 결함을 옮기지 않게).
// 분위값: 정렬 뒤 최근접 순위(nearest-rank) — p 분위 = 정렬 배열의 ceil(p·N)번째 값.
import { describe, expect, it } from "vitest"
import { analyzeRules, computeChart, type BirthInput, type RuleAnalysis } from "@/engine"
import { rng } from "./compare"
import * as O from "./strength-oracle"

const COMBOS = [["현행", 0.25, 0.5], ["후보①", 0.3, 0.5], ["후보②", 0.28, 0.6]] as const
const nr = (sorted: number[], p: number) => sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)]

describe("rules@0.4.0 측정(검증 아님 — 단, 엔진·오라클 불일치 0건이어야 함)", () => {
  it("1만 + 2천 건: tableSensitive 두 정의 · |r(kr)−r(cn)| 분위 · 통관 세 조합 · 종왕/종강 · presence", () => {
    const r = rng(20261128)
    const ri = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1))
    const mism: string[] = []
    type Bucket = { n: number; c: Record<string, number>; diffs: number[] }
    const B: Record<"known" | "unknown", Bucket> = { known: { n: 0, c: {}, diffs: [] }, unknown: { n: 0, c: {}, diffs: [] } }
    const pres: Record<string, number> = {}
    let n = 0, unknown = 0, errors = 0
    while (n + unknown < 12000) {
      const known = n < 10000
      const input: BirthInput = { calendar: "solar", year: ri(1900, 2100), month: ri(1, 12), day: ri(1, 28), time: known ? { hour: ri(0, 23), minute: ri(0, 59) } : null, timezone: "Asia/Seoul", gender: r() < 0.5 ? "M" : "F" }
      let chart
      try { chart = computeChart(input) } catch { errors++; if (errors > 50) throw new Error("오류 과다"); continue }
      if (known) n++; else unknown++
      const bk = B[known ? "known" : "unknown"]
      bk.n++
      const inc = (k: string) => { bk.c[k] = (bk.c[k] ?? 0) + 1 }
      const runs = COMBOS.map(([, sh, ra]) => analyzeRules(chart, { tonggwanMinShare: sh, tonggwanMinRatio: ra }))
      const a: RuleAnalysis = runs[0]
      const nat: O.Natal = { ...chart.pillars }
      const L = `${input.year}-${input.month}-${input.day} ${known ? `${input.time!.hour}:${input.time!.minute}` : "모름"}`
      // 1 tableSensitive
      const os = O.strengthTableSensitivity(nat, "kr-monthly-30")
      const so: O.StructOpts = { table: "kr-monthly-30", touchul: "transparentFirst", match: "sameStem", rokgeopAlt: true }
      const ost = O.structureTableSensitivity(nat, so)
      const pairs: [string, boolean, boolean][] = [
        ["strength.tableSensitive", a.strength.tableSensitive, os.tableSensitive],
        ["strength.tableSensitiveIncludingMainOnly", a.strength.tableSensitiveIncludingMainOnly, os.tableSensitiveIncludingMainOnly],
        ["structure.tableSensitive", a.structure.tableSensitive, ost.tableSensitive],
        ["structure.tableSensitiveIncludingMainOnly", a.structure.tableSensitiveIncludingMainOnly, ost.tableSensitiveIncludingMainOnly],
      ]
      for (const [k, e, q] of pairs) { if (e !== q) mism.push(`${L} ${k} 엔진 ${e} 오라클 ${q}`); if (e) inc(k) }
      if (a.strength.tableSensitive || (chart.pillars.hour === null && a.strength.hourSensitivity?.hourSensitive)) inc("문구대상(tableSensitive 또는 hourSensitive)")
      // 2 |r(kr) − r(cn)|
      const rKr = a.strength.models[0].ratio!, rCn = a.strength.tableSensitivity.find((t) => t.tableId === "cn-lunarjs")!.ratio
      const oKr = O.modelA(nat, "kr-monthly-30").ratio, oCn = O.modelA(nat, "cn-lunarjs").ratio
      if (rKr !== oKr || rCn !== oCn) mism.push(`${L} r kr/cn 엔진 ${rKr}/${rCn} 오라클 ${oKr}/${oCn}`)
      bk.diffs.push(O.r6(Math.abs(rKr - rCn)))
      if (a.strength.models[0].nearBoundary) inc("A.nearBoundary(0.03)")
      if (a.strength.models[0].nearBoundary !== O.nearOf(rKr)) mism.push(`${L} nearBoundary 엔진 ${a.strength.models[0].nearBoundary}`)
      // 폭 후보별로 근접 표시가 붙을 비율(QA 계산, 엔진 옵션 아님): 경계와 차이를 6자리 반올림 뒤 w 미만
      for (const w of [0.03, 0.054, 0.057, 0.063]) if (O.TH.some((t) => O.r6(Math.abs(rKr - t)) < w)) inc(`근접폭.${w.toFixed(3)}`)
      // 3 통관 세 조합
      COMBOS.forEach(([nm, sh, ra], i) => {
        const tv = runs[i].usefulGods.views.find((v) => v.method === "tonggwan")!
        const ot = O.tonggwan(nat, "kr-monthly-30", sh, ra)
        if ((tv.status === "ok") !== (ot.length > 0)) mism.push(`${L} 통관 ${nm} 엔진 ${tv.status} 오라클 ${ot}`)
        if (tv.status === "ok") inc(`통관.${nm}`)
      })
      // 4 종왕/종강 + 특수격 전체
      const jw = O.jongwangOf(nat, "kr-monthly-30")
      const sp = a.structure.candidates.filter((c) => c.kind === "special")
      const gotJw = sp.filter((c) => /종왕|종강/.test(c.name)).map((c) => (/종강/.test(c.name) ? "종강" : "종왕")).join()
      if (gotJw !== (jw?.kind ?? "")) mism.push(`${L} 종왕/종강 엔진 ${gotJw} 오라클 ${jw?.kind}`)
      if (jw) inc(`특수.${jw.kind}`)
      for (const c of sp) inc(`특수격후보.${c.name}`)
      const sv = a.usefulGods.views.find((v) => v.method === "special")!
      if (jw?.kind === "종강") {
        if (sv.candidates.some((c) => c.element === O.groupEl(nat.day.stem, "gwansal"))) mism.push(`${L} 종강 view에 관살`)
        if (sp.length === 1 && [...sv.candidates].sort((x, y) => x.rank - y.rank).map((c) => c.element).join() !== jw.view.join()) mism.push(`${L} 종강 view ${sv.candidates.map((c) => c.element)}`)
      }
      // 5 presence (주 후보 상신·꺼림) — 시각 앎만 분포에 넣고, 일관성은 전 후보
      const prim = a.structure.candidates.find((c) => c.role === "primary")!
      for (const c of a.structure.candidates) for (const g of [...(c.sangsin ?? []), ...(c.avoid ?? [])]) if (g.presence !== O.presenceOf(g.touchul, g.hiddenPositions)) mism.push(`${L} presence 불일치 ${c.name}`)
      if (known) {
        for (const g of prim.sangsin ?? []) pres[`상신.${g.presence}`] = (pres[`상신.${g.presence}`] ?? 0) + 1
        for (const g of prim.avoid ?? []) pres[`꺼림.${g.presence}`] = (pres[`꺼림.${g.presence}`] ?? 0) + 1
        if ((prim.sangsin ?? []).some((g) => g.presence === "hiddenOnly")) inc("주격 상신 중 hiddenOnly 1개 이상")
        if ((prim.sangsin ?? []).length && (prim.sangsin ?? []).every((g) => g.presence === "absent")) inc("주격 상신 전부 absent")
        if (!(prim.sangsin ?? []).length) inc("주격 상신 없음(건록·월겁 투출 없음 등)")
      }
    }
    const rep = (k: "known" | "unknown") => {
      const b = B[k], s = [...b.diffs].sort((x, y) => x - y)
      const q = { 중앙: nr(s, 0.5), "80%": nr(s, 0.8), "90%": nr(s, 0.9), 최대: s[s.length - 1] }
      const w80 = Math.round(q["80%"] * 1000) / 1000
      return { n: b.n, counts: Object.fromEntries(Object.entries(b.c).sort().map(([x, v]) => [x, `${v} (${((v / b.n) * 100).toFixed(1)}%)`])), diffQuantiles: q, width80_3dp: w80, diffZero: `${s.filter((x) => x === 0).length} (${((s.filter((x) => x === 0).length / s.length) * 100).toFixed(1)}%)` }
    }
    const all = [...B.known.diffs, ...B.unknown.diffs].sort((x, y) => x - y)
    const out = { known: rep("known"), unknown: rep("unknown"), combinedDiff: { n: all.length, 중앙: nr(all, 0.5), "80%": nr(all, 0.8), "90%": nr(all, 0.9) }, presence: pres, errors, mismatches: mism.length }
    console.log(`[rules040 측정] ${JSON.stringify(out, null, 1)}`)
    console.log(`[rules040 불일치] ${mism.length}건\n  ${mism.slice(0, 10).join("\n  ")}`)
    expect(n).toBe(10000)
    expect(unknown).toBe(2000)
    expect(mism).toEqual([])
  }, 600000)
})
