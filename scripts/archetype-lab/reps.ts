// 연구소장 대표 사주(02-archetypes.md §5 표) → 엔진 실제 계산 → 손계산 값·판정과 대조.
// 실행: npx vite-node scripts/archetype-lab/reps.ts -- [--rules 파일] [--md 파일] [--json 파일] [--no-date]
// analyzeRules는 chart.pillars만 쓰므로(src/engine/rules/index.ts 주석) 기둥을 그대로 넣어 계산한다.
// 별도로 1900~2100 실제 날짜(정오 기준)에서 같은 연·월·일주가 있는지 찾아 "실재하는 원국인가"를 확인한다.
import { writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { analyzeRules, computeChart, hourPillarsOf, type CalendarResult, type Element, type Pillar, type Stem } from "../../src/engine"
import { classifyArchetype } from "./lib/classify"
import { loadRuleSet } from "./lib/ruleset"
import { CASES, type Case, type G } from "./reps-cases"

const STEMS = "甲乙丙丁戊己庚辛壬癸"
const BRANCHES = "子丑寅卯辰巳午未申酉戌亥"
const pil = (s: string): Pillar => ({ stem: s[0] as Pillar["stem"], branch: s[1] as Pillar["branch"] })
const ps = (p: Pillar | null) => (p ? p.stem + p.branch : "--")
/** 60갑자로 성립하는 간지인가(천간·지지 음양이 같은가) */
const validGanji = (s: string) => STEMS.indexOf(s[0]) % 2 === BRANCHES.indexOf(s[1]) % 2
/** 오호둔: 연간 → 월간 */
function monthStemOk(y: string, m: string): boolean {
  const start = ((STEMS.indexOf(y[0]) % 5) * 2 + 2) % 10
  const order = (BRANCHES.indexOf(m[1]) - 2 + 12) % 12
  return STEMS[(start + order) % 10] === m[0]
}
const decimals = (x: number) => {
  const s = String(x)
  return s.includes(".") ? s.split(".")[1].length : 0
}
/** 손계산 기재 자릿수로 비교(반올림 차 허용). u 단위는 0.05 */
const close = (eng: number, hand: number, unitU = false) => Math.abs(eng - hand) <= (unitU ? 0.05 : 0.5 * 10 ** -decimals(hand) + 1e-9)

function argv() {
  const a = process.argv.slice(2).filter((x) => x !== "--")
  const get = (k: string) => (a.includes(k) ? a[a.indexOf(k) + 1] : undefined)
  return { rules: get("--rules") ?? resolve(__dirname, "rules/research-12.json"), md: get("--md"), json: get("--json"), date: !a.includes("--no-date") }
}

const o = argv()
const rs = loadRuleSet(o.rules)
const NAME = new Map(rs.archetypes.map((a) => [a.id, a.name]))
const nm = (id: string | null | undefined) => (id ? `${NAME.get(id) ?? id}` : "없음")

// 실제 날짜 찾기(정오, 서울). 연·월·일주가 같으면 시주는 오서둔으로 정해진다
const dateIndex = new Map<string, string>()
if (o.date) {
  for (let t = Date.UTC(1900, 0, 1); t <= Date.UTC(2100, 11, 31); t += 86400000) {
    const d = new Date(t)
    const c = computeChart({ calendar: "solar", year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), time: { hour: 12, minute: 0 }, timezone: "Asia/Seoul", gender: "M" })
    const k = [c.pillars.year, c.pillars.month, c.pillars.day].map(ps).join(" ")
    if (!dateIndex.has(k)) dateIndex.set(k, d.toISOString().slice(0, 10))
  }
}

const template = computeChart({ calendar: "solar", year: 2000, month: 6, day: 15, time: { hour: 12, minute: 0 }, timezone: "Asia/Seoul", gender: "M" })
const chartOf = (p: Case["p"]): CalendarResult => ({ ...template, pillars: { year: pil(p[0]), month: pil(p[1]), day: pil(p[2]), hour: p[3] ? pil(p[3]) : null } })

const GROUP_KO: Record<G, string> = { bigyeop: "비겁", inseong: "인성", siksang: "식상", jaeseong: "재성", gwansal: "관살" }
const EL_KO: Record<Element, string> = { wood: "목", fire: "화", earth: "토", metal: "금", water: "수" }
const R3 = (x: number) => Math.round(x * 1000) / 1000

const rows: Record<string, unknown>[] = []
const md: string[] = []
md.push(`### 대표 사주 대조 — 규칙 \`${rs.id}@${rs.version}\` · 기본 옵션(kr-monthly-30, 모형 A)`)
md.push("")
md.push("| 예 | 원국 | 실재 날짜(정오) | 엔진 원형(부) | 손계산 원형(부) | 원형 | 수치 불일치 | cn 표 원형 |")
md.push("|---|---|---|---|---|---|---|---|")
let archMis = 0
let valMis = 0
let secMis = 0
for (const c of CASES) {
  const invalid: string[] = []
  c.p.forEach((x, i) => {
    if (x && !validGanji(x)) invalid.push(`${["연", "월", "일", "시"][i]}주 ${x} 성립 안 함`)
  })
  if (!monthStemOk(c.p[0], c.p[1])) invalid.push(`월주 ${c.p[1]}가 연간 ${c.p[0][0]}의 오호둔과 다름`)
  if (c.p[3] && !hourPillarsOf(c.p[2][0] as Stem).some((h) => ps(h) === c.p[3])) invalid.push(`시주 ${c.p[3]}가 일간 ${c.p[2][0]}의 오서둔과 다름`)
  const chart = chartOf(c.p)
  const a = analyzeRules(chart)
  const res = classifyArchetype(chart, rs, { sensitivity: { hour: true, table: true } })
  const A = a.strength.models.find((m) => m.model === "weighted")!
  const gt = a.strength.groupTotals
  const special = a.structure.candidates.filter((x) => x.kind === "special").map((x) => x.name)
  const primary = a.structure.candidates.find((x) => x.role === "primary")?.name ?? null
  const flags = a.qiFlow.clarityFlags.map((f) => f.flag)
  const f = res.features
  const e = c.e
  const mis: string[] = []
  const cmp = (label: string, eng: number, hand: number | undefined, u = false) => {
    if (hand !== undefined && !close(eng, hand, u)) mis.push(`${label} 엔진 ${eng} / 손 ${hand}`)
  }
  // 문서 u 단위 = 엔진 값 × 30 (천간 1.0 = 30u, 명세 §0.1)
  const U = (x: number) => Math.round(x * 30 * 1e6) / 1e6
  cmp("S", U(A.support!), e.S, true)
  cmp("T합", U(A.total!), e.total, true)
  cmp("r", A.ratio!, e.r)
  if (e.verdict && A.verdict !== e.verdict) mis.push(`판정 엔진 ${A.verdict} / 손 ${e.verdict}`)
  if (e.extreme !== undefined && A.extreme !== e.extreme) mis.push(`extreme 엔진 ${A.extreme} / 손 ${e.extreme}`)
  if (e.special === null && special.length) mis.push(`특수격 엔진 [${special.join(",")}] / 손 없음`)
  if (e.special && !special.some((s) => s.includes(e.special!))) mis.push(`특수격 엔진 [${special.join(",") || "없음"}] / 손 ${e.special}`)
  cmp("조후T", a.climate.T, e.T)
  cmp("조후M", a.climate.M, e.M)
  for (const [g, v] of Object.entries(e.groupsU ?? {})) cmp(`${GROUP_KO[g as G]}u`, U(gt[g as G]), v, true)
  for (const [g, v] of Object.entries(e.gs ?? {})) cmp(`${GROUP_KO[g as G]}비율`, f[`tg.shareT.${g}`] as number, v)
  for (const [el, v] of Object.entries(e.shares ?? {})) cmp(`${EL_KO[el as Element]}비율`, a.qiFlow.shares[el as Element], v)
  if (e.structure && primary !== e.structure) mis.push(`주 격 엔진 ${primary} / 손 ${e.structure}`)
  for (const fl of e.flags ?? []) if (!flags.includes(fl)) mis.push(`표지 ${fl} 없음(엔진 [${flags.join(",")}])`)
  if (e.circular !== undefined && a.qiFlow.flowChain.circular !== e.circular) mis.push(`circular 엔진 ${a.qiFlow.flowChain.circular} / 손 ${e.circular}`)
  if (e.strictPair && !(f["el.strictPairs"] as string[]).includes(e.strictPair)) mis.push(`대치쌍 엔진 [${(f["el.strictPairs"] as string[]).join(",")}] / 손 ${e.strictPair}`)
  if (e.hourSensitive !== undefined && (res.hourSensitivity ? !res.hourSensitivity.stable : null) !== e.hourSensitive)
    mis.push(`시주 민감 엔진 ${res.hourSensitivity ? !res.hourSensitivity.stable : "n/a"} / 손 ${e.hourSensitive}`)
  const archOk = res.primary.id === e.arch
  const secOk = e.secondary === undefined || res.secondary?.id === e.secondary
  if (!c.extra) {
    if (!archOk) archMis++
    if (!secOk) secMis++
    if (mis.length) valMis++
  }
  const key3 = c.p.slice(0, 3).join(" ")
  const date = o.date ? dateIndex.get(key3) ?? "없음" : "-"
  const cn = res.tableSensitivity!.byTable.find((x) => x.tableId === "cn-lunarjs")!.primary
  const hourNote = res.hourSensitivity ? ` · 12시진: ${res.hourSensitivity.distinctPrimary.map(nm).join("/")}` : ""
  md.push(
    `| ${c.id}${c.extra ? "(참고)" : ""} | ${c.p.map((x) => x ?? "모름").join(" ")} | ${date} | ${nm(res.primary.id)}(${nm(res.secondary?.id)})${hourNote} | ${nm(e.arch)}${e.secondary ? `(${nm(e.secondary)})` : ""} | ${archOk ? (secOk ? "일치" : "**부 원형 다름**") : "**불일치**"} | ${[...invalid.map((x) => `**${x}**`), ...mis].join("; ") || "-"} | ${cn === res.primary.id ? "같음" : `**${nm(cn)}**`} |`,
  )
  rows.push({
    id: c.id, src: c.src, pillars: c.p, invalid, date,
    engine: {
      archetype: res.primary.id, secondary: res.secondary?.id ?? null, alsoMatched: res.cascade?.alsoMatched, ruleId: res.cascade?.ruleId, trace: res.cascade?.trace,
      S: A.support, total: A.total, r: A.ratio, verdict: A.verdict, extreme: A.extreme, nearBoundary: A.nearBoundary,
      T: a.climate.T, M: a.climate.M, tClass: a.climate.tClass, mClass: a.climate.mClass,
      groupTotals: gt, gs: Object.fromEntries(Object.keys(GROUP_KO).map((g) => [g, f[`tg.shareT.${g}`]])), shares: a.qiFlow.shares,
      structure: primary, special, flags, circular: a.qiFlow.flowChain.circular, dayMasterFlow: a.qiFlow.dayMasterFlow, strictPairs: f["el.strictPairs"],
      byTable: res.tableSensitivity?.byTable, hour: res.hourSensitivity ? { distinct: res.hourSensitivity.distinctPrimary, byHour: res.hourSensitivity.byHour.map((h) => [ps(h.hour), h.primary]) } : null,
    },
    hand: e, archMatch: archOk, secondaryMatch: secOk, mismatches: mis,
  })
}
const n24 = CASES.filter((c) => !c.extra).length
md.push("")
md.push(`- 대표 사주 ${n24}개: 원형 불일치 **${archMis}개** · 부 원형 불일치 ${secMis}개 · 수치(S·r·조후·묶음·격·표지) 불일치가 하나라도 있는 예 ${valMis}개. 참고 사례 3개는 집계에서 뺌`)
md.push("")
md.push("#### 엔진 실제 값(대조용 요약)")
md.push("")
md.push("| 예 | S/T합(u) | r · 판정 | 조후 T/M | 묶음 비율 gs(비·인·식·재·관) | 주 격 · 특수격 | 표지 | 통과 관문 |")
md.push("|---|---|---|---|---|---|---|---|")
for (const r of rows) {
  const en = r.engine as Record<string, unknown> & { gs: Record<string, number> }
  md.push(
    `| ${r.id} | ${R3((en.S as number) * 30)}/${R3((en.total as number) * 30)} | ${en.r} ${en.verdict}${en.extreme ? `(${en.extreme})` : ""}${en.nearBoundary ? " 경계" : ""} | ${en.T}/${en.M} ${en.tClass}·${en.mClass} | ${["bigyeop", "inseong", "siksang", "jaeseong", "gwansal"].map((g) => R3(en.gs[g])).join(" · ")} | ${en.structure ?? "-"}${(en.special as string[]).length ? ` · ${(en.special as string[]).join(",")}` : ""} | ${(en.flags as string[]).join(",") || "-"} | ${[en.archetype, ...((en.alsoMatched as string[]) ?? [])].map((x) => nm(x as string)).join(" > ")} |`,
  )
}
const out = md.join("\n")
console.log(out)
if (o.md) writeFileSync(o.md, out + "\n")
if (o.json) writeFileSync(o.json, JSON.stringify({ ruleSet: `${rs.id}@${rs.version}`, rows }, null, 1) + "\n")
