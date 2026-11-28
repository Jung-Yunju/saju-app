// 연구소장 대표 사주(02-archetypes.md §5 표) → 엔진 실제 계산 → 손계산 값·판정과 대조.
// 실행: npx vite-node scripts/archetype-lab/reps.ts -- [--rules 파일] [--md 파일] [--json 파일] [--no-date]
// analyzeRules는 chart.pillars만 쓰므로(src/engine/rules/index.ts 주석) 기둥을 그대로 넣어 계산한다.
// 별도로 1900~2100 실제 날짜(정오 기준)에서 같은 연·월·일주가 있는지 찾아 "실재하는 원국인가"를 확인한다.
import { writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { analyzeRules, computeChart, hourPillarsOf, type CalendarResult, type Element, type Pillar, type Stem, type TenGodGroup } from "../../src/engine"
import { classifyArchetype } from "./lib/classify"
import { loadRuleSet } from "./lib/ruleset"

type G = TenGodGroup
interface Expect {
  arch: string
  secondary?: string
  S?: number
  total?: number
  r?: number
  verdict?: "신강" | "중화" | "신약"
  extreme?: "strong" | "weak" | null
  /** 특수격 후보 이름에 들어갈 글자. null = 특수격 후보 없음 */
  special?: string | null
  T?: number
  M?: number
  groupsU?: Partial<Record<G, number>>
  gs?: Partial<Record<G, number>>
  shares?: Partial<Record<Element, number>>
  structure?: string
  flags?: string[]
  circular?: boolean
  strictPair?: string
  hourSensitive?: boolean
}
interface Case { id: string; src: string; p: [string, string, string, string | null]; e: Expect; extra?: boolean }

const CASES: Case[] = [
  { id: "은하-1", src: "명세 사례 8", p: ["庚申", "戊子", "丙申", "壬辰"], e: { arch: "galaxy", S: 39, total: 315, r: 0.12381, extreme: "weak", special: "종살" } },
  { id: "은하-2", src: "명세 사례 9", p: ["戊午", "己未", "戊戌", "丁巳"], e: { arch: "galaxy", secondary: "golden-sun", S: 285.5, r: 0.906349, extreme: "strong", special: "종왕", T: 4.0, M: -3.5 } },
  { id: "현무-1", src: "명세 사례 12", p: ["癸亥", "癸亥", "壬子", "辛丑"], e: { arch: "hyeonmu", secondary: "silver-wolf", r: 0.765079, verdict: "신강", extreme: null, special: null, T: -5.0, M: 4.5, shares: { wood: 0.089 } } },
  { id: "현무-2", src: "손계산", p: ["戊辰", "甲子", "丙寅", "己亥"], e: { arch: "hyeonmu", secondary: "bonghwang", S: 110.5, r: 0.350794, verdict: "신약", special: null, T: -2.5, M: 2.5, groupsU: { gwansal: 109, inseong: 70 }, gs: { gwansal: 0.346, inseong: 0.222 } } },
  { id: "태양-1", src: "손계산", p: ["甲午", "庚午", "壬戌", "丙午"], e: { arch: "golden-sun", secondary: "white-deer", S: 73.5, r: 0.233333, verdict: "신약", extreme: null, T: 4.0, M: -4.5, structure: "편재격", groupsU: { jaeseong: 139.5 } } },
  { id: "태양-2", src: "손계산", p: ["丁巳", "丁未", "庚戌", "甲申"], e: { arch: "golden-sun", secondary: "bonghwang", S: 161.5, r: 0.512698, verdict: "중화", T: 4.0, M: -3.0, structure: "정관격", groupsU: { gwansal: 107.5, inseong: 95 }, gs: { gwansal: 0.341, inseong: 0.302 } } },
  { id: "달-1", src: "명세 사례 4", p: ["丙寅", "庚子", "壬午", "丁未"], e: { arch: "moon-goddess", r: 0.47619, verdict: "중화", shares: { water: 0.381, fire: 0.341 }, strictPair: "water>fire" } },
  { id: "달-2", src: "명세 사례 5", p: ["戊寅", "辛酉", "甲寅", "乙亥"], e: { arch: "moon-goddess", secondary: "baekho", r: 0.390476, verdict: "신약", shares: { metal: 0.381, wood: 0.34 }, strictPair: "metal>wood" } },
  { id: "봉황-1", src: "명세 사례 11", p: ["庚申", "甲申", "甲寅", "癸酉"], e: { arch: "bonghwang", r: 0.450794, verdict: "중화", groupsU: { gwansal: 124, inseong: 58 }, gs: { gwansal: 0.394, inseong: 0.184 }, structure: "칠살격", shares: { metal: 0.394, wood: 0.267 } } },
  { id: "봉황-2", src: "명세 사례 7", p: ["甲辰", "己巳", "庚戌", "丙子"], e: { arch: "bonghwang", r: 0.509524, verdict: "중화", groupsU: { gwansal: 82.5, inseong: 96, jaeseong: 39, siksang: 33 }, gs: { gwansal: 0.262, inseong: 0.305 }, structure: "칠살격", flags: ["재성파인"] } },
  { id: "백호-1", src: "손계산", p: ["庚寅", "甲申", "甲辰", "辛未"], e: { arch: "baekho", S: 118, r: 0.374603, verdict: "신약", groupsU: { bigyeop: 62.5, inseong: 25.5, siksang: 16, jaeseong: 73, gwansal: 108 }, gs: { inseong: 0.081, gwansal: 0.343 }, structure: "칠살격", flags: ["관살혼잡"], T: 1.5, M: 0, shares: { metal: 0.343, wood: 0.294 } } },
  { id: "백호-2", src: "손계산", p: ["丙辰", "戊戌", "壬午", "壬寅"], e: { arch: "baekho", S: 90, r: 0.285714, verdict: "신약", groupsU: { bigyeop: 33, inseong: 27, siksang: 25, jaeseong: 77.5, gwansal: 122.5 }, gs: { inseong: 0.086, gwansal: 0.389 }, structure: "칠살격", T: 0, M: -1.0 } },
  { id: "흑여우-1", src: "손계산", p: ["辛丑", "辛卯", "甲午", "丁卯"], e: { arch: "black-fox", S: 159, r: 0.504762, verdict: "중화", flags: ["상관견관"], structure: "양인격", gs: { gwansal: 0.2, inseong: 0.029 }, T: 0.5, M: -1.0 } },
  { id: "흑여우-2", src: "손계산", p: ["戊寅", "甲寅", "癸卯", "庚申"], e: { arch: "black-fox", S: 83, r: 0.263492, verdict: "신약", groupsU: { bigyeop: 7, inseong: 46, siksang: 139, jaeseong: 28, gwansal: 65 }, structure: "상관격", flags: ["상관견관"], T: -1.5, M: 0.5 } },
  { id: "백록-1", src: "손계산", p: ["戊戌", "丙辰", "乙丑", "己卯"], e: { arch: "white-deer", S: 109.5, r: 0.347619, verdict: "신약", groupsU: { bigyeop: 57, inseong: 22.5, siksang: 33, jaeseong: 159, gwansal: 13.5 }, structure: "정재격", T: -0.5, M: 0.5 } },
  { id: "백록-2", src: "손계산", p: ["甲寅", "丁卯", "庚寅", "庚辰"], e: { arch: "white-deer", S: 95.5, r: 0.303175, verdict: "신약", groupsU: { bigyeop: 30, inseong: 35.5, siksang: 3, jaeseong: 169, gwansal: 47.5 }, structure: "편재격", T: -0.5, M: 0 } },
  { id: "현자-1", src: "손계산", p: ["戊辰", "乙卯", "丙寅", "壬辰"], e: { arch: "sage", S: 202.5, r: 0.642857, verdict: "신강", groupsU: { bigyeop: 10.5, inseong: 162, siksang: 76.5, jaeseong: 0, gwansal: 36 }, structure: "정인격", T: -0.5, M: 1.0 } },
  { id: "현자-2", src: "손계산", p: ["甲戌", "戊辰", "辛未", "己丑"], e: { arch: "sage", S: 219, r: 0.695238, verdict: "신강", groupsU: { bigyeop: 12, inseong: 177, siksang: 18, jaeseong: 61.5, gwansal: 16.5 }, structure: "정인격", flags: ["재성파인"], T: 0, M: 0.5 } },
  { id: "청룡-1", src: "명세 사례 1", p: ["甲寅", "丙寅", "甲辰", "乙亥"], e: { arch: "cheongnyong", r: 0.619048, verdict: "신강", groupsU: { bigyeop: 144.5, inseong: 20.5 }, shares: { fire: 0.184, earth: 0.197 }, structure: "건록격" } },
  { id: "청룡-2", src: "손계산", p: ["戊午", "庚申", "戊子", "丙辰"], e: { arch: "cheongnyong", S: 159, r: 0.504762, verdict: "중화", shares: { metal: 0.248, water: 0.219, wood: 0.029 }, circular: false, structure: "식신격", flags: ["효신탈식"], T: 1.5, M: 0 } },
  { id: "늑대-1", src: "손계산", p: ["丁卯", "己酉", "庚辰", "甲申"], e: { arch: "silver-wolf", S: 200, r: 0.634921, verdict: "신강", groupsU: { bigyeop: 106, inseong: 64, siksang: 11.5 }, shares: { water: 0.037 }, structure: "양인격", T: 1.0, M: 0 } },
  { id: "늑대-2", src: "손계산", p: ["戊寅", "辛酉", "辛卯", "甲午"], e: { arch: "silver-wolf", S: 196, r: 0.622222, verdict: "신강", groupsU: { bigyeop: 120, inseong: 46, siksang: 0, jaeseong: 91 }, gs: { jaeseong: 0.289 }, structure: "건록격", T: 0.5, M: -1.0 } },
  { id: "숲-1", src: "손계산", p: ["丁酉", "甲辰", "甲寅", "壬申"], e: { arch: "eternal-forest", S: 157, r: 0.498413, verdict: "중화", shares: { wood: 0.352, fire: 0.129, earth: 0.227, metal: 0.146, water: 0.146 }, circular: true, gs: { gwansal: 0.146 }, structure: "편재격", T: 0, M: 1.0 } },
  { id: "숲-2", src: "손계산", p: ["庚辰", "甲申", "乙卯", "戊寅"], e: { arch: "eternal-forest", S: 154, r: 0.488889, verdict: "중화", groupsU: { bigyeop: 100, inseong: 24, siksang: 7, jaeseong: 76, gwansal: 78 }, gs: { inseong: 0.076, gwansal: 0.248, siksang: 0.022 }, structure: "정관격", T: 0.5, M: 0.5 } },
  // 본문 참고 사례(24개 밖)
  { id: "참고-사례6", src: "명세 사례 6(시주 모름)", p: ["丙寅", "丁酉", "庚辰", null], e: { arch: "silver-wolf", r: 0.603922, verdict: "신강", shares: { water: 0.018 }, hourSensitive: true }, extra: true },
  { id: "참고-사례3", src: "명세 사례 3(사례6 + 壬午시)", p: ["丙寅", "丁酉", "庚辰", "壬午"], e: { arch: "bonghwang", verdict: "중화" }, extra: true },
  { id: "참고-사례10", src: "명세 사례 10", p: ["庚辰", "己丑", "甲戌", "戊辰"], e: { arch: "galaxy", r: 0.257, special: "화토" }, extra: true },
]

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
