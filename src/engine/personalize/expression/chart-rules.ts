// ① 원국 잠재력 판정 — 규칙 id → 판정 함수(코드). 차원 목록·어떤 규칙을 쓰는지·문턱값은 표(content/expression/dimensions.json).
// 명리 규칙 원문: docs/knowledge/personalization/expression-dimensions.md §2·§3·§7 (연구소장, expression-dimensions@0.1.0)
// 규칙 엔진 결과(RuleAnalysis)를 읽기만 한다. 십성·지장간·신강약을 새로 판단하지 않고 이미 나온 값을 산수로만 다룬다(§2.2).
//  - 모형 A(weighted) 고정, 지장간 표 kr-monthly-30 고정(다른 표면 같은 원국을 다시 분석 — 원형 엔진 D-030과 같은 방식)
//  - 십성 단위 계산(steadiness·edge)은 지장간 항목/A.basis만 쓴다. 지지 자체 tenGods 항목은 branchYinYang 옵션 영향이 있어 쓰지 않는다(§2.2 ⚑)
//  - 위치 문자열은 gaeun.ts posStr 형식
// 순수 함수(같은 입력 → 같은 출력). AI·DB·네트워크 없음.
import { archetypeCanonicalJson } from "../../archetype"
import { TEN_GOD_GROUP } from "../../content/gaeun"
import { analyzeRules, hourPillarsOf, tenGodOfStem } from "../../rules"
import type { HiddenStemRole, HiddenStemTableId, Position, RuleAnalysis, RuleOptions, StrengthModelResult, TenGod } from "../../rules/types"
import { EngineInputError, type CalendarResult } from "../../types"
import type {
  ChartPotential, DimensionRow, DimensionTable, FluxParams, GroupRuleParams, LevelRuleId, OutwardParams, PotentialLevel,
  TenGodGroupCode, TenGodSetParams,
} from "./types"

export const LEVEL_RULE_IDS: readonly LevelRuleId[] = ["exp.lv.group.v1", "exp.lv.tenGodSet.v1", "exp.lv.flux.v1", "exp.lv.outward.v1"]
export const MOD_IDS: readonly string[] = ["exp.mod.drive.v1"]
export const GROUP_CODES: readonly TenGodGroupCode[] = ["bigyeop", "siksang", "jaeseong", "gwansal", "inseong"]
export const ALL_TEN_GODS: readonly TenGod[] = ["비견", "겁재", "식신", "상관", "편재", "정재", "편관", "정관", "편인", "정인"]
export const CLARITY_FLAGS: readonly string[] = ["관살혼잡", "상관견관", "효신탈식", "비겁쟁재", "재성파인"]
const GROUP_TEN_GODS: Readonly<Record<TenGodGroupCode, readonly [TenGod, TenGod]>> = {
  bigyeop: ["비견", "겁재"], siksang: ["식신", "상관"], jaeseong: ["편재", "정재"], gwansal: ["편관", "정관"], inseong: ["편인", "정인"],
}
const LEVELS: readonly PotentialLevel[] = ["strong", "moderate", "faint"]

export const round6 = (x: number): number => Math.round(x * 1e6) / 1e6
const isNatal = (p: Position): boolean => p.pillar === "year" || p.pillar === "month" || p.pillar === "day" || p.pillar === "hour"
/** gaeun.ts posStr과 같은 형식(원국 위치만 — 운 위치는 engine.ts에서 daeun[n] 형식으로 만든다) */
export const posStr = (p: Position, role?: HiddenStemRole): string => (role ? `${p.pillar}.${p.part}.${role}` : `${p.pillar}.${p.part}`)

function uniq(xs: string[]): string[] {
  const out: string[] = []
  for (const x of xs) if (!out.includes(x)) out.push(x)
  return out
}
function step(l: PotentialLevel, d: 1 | -1): PotentialLevel {
  const i = LEVELS.indexOf(l) - d // strong=0
  return LEVELS[Math.max(0, Math.min(2, i))]
}

// ─────────────────────────────────────────── 공통 파생값(§2.2)

export interface ChartDerived {
  A: StrengthModelResult
  /** A.total */
  T: number
  G: Record<TenGodGroupCode, number>
  /** 십성별 가중 합(A.basis, 일간 제외) */
  tgT: Record<TenGod, number>
  /** 월령 묶음(월지 정기 + 주 후보 격 pivot, 격 변형이 갈리면 다른 변형 pivot도) */
  M: Set<TenGodGroupCode>
  boundary: { blocked: boolean; nearBoundary: boolean; agreementSplit: boolean; tableSensitive: boolean }
  hasSpecial: boolean
}

export function deriveChart(a: RuleAnalysis): ChartDerived {
  const s = a.strength
  const A = s && Array.isArray(s.models) ? s.models.find((m) => m.model === "weighted") : undefined
  if (!A || !s.groupTotals || typeof A.total !== "number" || !(A.total > 0))
    throw new EngineInputError("발현 엔진은 신강약 모형 A가 있는 규칙 엔진 결과(rules@0.4.0)가 필요함")
  const G = {} as Record<TenGodGroupCode, number>
  for (const g of GROUP_CODES) G[g] = Number.isFinite(s.groupTotals[g]) ? s.groupTotals[g] : 0
  const tgT = {} as Record<TenGod, number>
  for (const t of ALL_TEN_GODS) tgT[t] = 0
  for (const b of A.basis) {
    if (b.group === "self") continue
    const t = tenGodOfStem(a.dayMaster.stem, b.char)
    tgT[t] += b.points
  }
  for (const t of ALL_TEN_GODS) tgT[t] = round6(tgT[t])
  const M = new Set<TenGodGroupCode>()
  const mj = a.tenGods.find((h) => h.position.pillar === "month" && h.viaHiddenStem === "jeonggi")
  if (mj) M.add(TEN_GOD_GROUP[mj.tenGod])
  const cands = a.structure?.candidates ?? []
  const primary = cands.find((c) => c.role === "primary")
  if (primary?.pivot) M.add(TEN_GOD_GROUP[primary.pivot.tenGod])
  if (primary?.variantAgreement === "differs")
    for (const c of cands) if (c.role === "otherVariant" && c.pivot) M.add(TEN_GOD_GROUP[c.pivot.tenGod])
  const nearBoundary = A.nearBoundary === true
  const agreementSplit = s.agreement === "split"
  const tableSensitive = s.tableSensitive === true
  return {
    A, T: A.total, G, tgT, M,
    boundary: { blocked: nearBoundary || agreementSplit || tableSensitive, nearBoundary, agreementSplit, tableSensitive },
    hasSpecial: cands.some((c) => c.kind === "special"),
  }
}

type Out = Omit<ChartPotential, "dimensionId" | "evidenceLevel" | "hourStable">

// ─────────────────────────────────────────── §3.1 묶음 규칙(핵심 차원) + §3.2 drive 보정 + §3.10 메모

function groupRule(a: RuleAnalysis, d: DimensionRow, p: GroupRuleParams, D: ChartDerived): Out {
  const g = p.group
  const touchul = a.tenGods.filter(
    (h) => (h.position.pillar === "year" || h.position.pillar === "month" || h.position.pillar === "hour") && h.position.part === "stem" && !h.viaHiddenStem && TEN_GOD_GROUP[h.tenGod] === g,
  )
  const hidden = a.tenGods.filter((h) => isNatal(h.position) && !!h.viaHiddenStem && TEN_GOD_GROUP[h.tenGod] === g)
  const positions = uniq([...touchul.map((h) => posStr(h.position)), ...hidden.map((h) => posStr(h.position, h.viaHiddenStem))])
  const s = round6(D.G[g] / D.T)
  const m = D.M.has(g)
  const flags: string[] = []
  let level: PotentialLevel
  let ruleId: string
  let what: string
  if (!touchul.length && !hidden.length) {
    level = "faint"
    ruleId = "exp.lv.absent"
    what = "원국 천간·지장간 어디에도 없음"
  } else if (!touchul.length) {
    ruleId = "exp.lv.hiddenOnly"
    flags.push("latent")
    level = s >= p.hiddenOnlyModerate || m ? "moderate" : "faint"
    if (p.hiddenMonthCanBeStrong && m && s >= p.rootedStrongWithMonth) level = "strong"
    what = "지장간에만 있음(드러나지 않은 잠재)"
  } else if (!hidden.length) {
    ruleId = "exp.lv.stemOnly"
    flags.push("floating")
    level = s >= p.stemOnlyModerate ? "moderate" : "faint"
    what = "천간에 드러났으나 받쳐 주는 뿌리가 없음"
  } else {
    ruleId = "exp.lv.rooted"
    level = s >= p.rootedStrong || (m && s >= p.rootedStrongWithMonth) ? "strong" : "moderate"
    what = "드러나 있고 뿌리도 있음"
  }
  if (m) flags.push("month")
  const basis: ChartPotential["basis"] = [{ ruleId, positions, note: `${what}, 비율 ${s}${m ? ", 월령(태어난 달의 주된 기운)" : ""}` }]

  if (d.mods.includes("exp.mod.drive.v1")) {
    const r = D.A.ratio
    if (D.boundary.blocked) {
      basis.push({ ruleId: "exp.sens.boundary", positions: [], note: `힘의 세기가 경계 근처라 보는 방식에 따라 달라질 수 있어 일간 세력 보정을 하지 않음(모형 A r=${r})` })
    } else if (D.A.verdict === "신강" && D.G.bigyeop >= D.G.inseong) {
      level = step(level, 1)
      basis.push({ ruleId: "exp.mod.drive.v1", positions: [], note: `일간 세력 +1(모형 A r=${r}, 신강·비겁형)` })
    } else if (D.A.extreme === "weak") {
      level = step(level, -1)
      basis.push({ ruleId: "exp.mod.drive.v1", positions: [], note: `일간 세력 −1(모형 A r=${r}, 극신약)` })
    }
  }

  if (level === "strong" && !D.boundary.blocked && !D.hasSpecial) {
    if (d.notes.includes("load") && D.A.verdict === "신약")
      basis.push({ ruleId: "exp.note.load", positions: [], note: "쓰는 쪽 힘이 커서 부담으로 느낄 수 있음" })
    if (d.notes.includes("surplus") && D.A.verdict === "신강")
      basis.push({ ruleId: "exp.note.surplus", positions: [], note: "넘쳐서 고이기 쉬움 — 흘려보낼 통로가 필요" })
  }
  if (D.G[g] > 0) {
    const [t1, t2] = GROUP_TEN_GODS[g]
    const cut = round6((D.G[g] * 2) / 3)
    const flavor = D.tgT[t1] >= cut ? t1 : D.tgT[t2] >= cut ? t2 : "mixed"
    basis.push({ ruleId: "exp.note.flavor", positions: [], note: flavor === "mixed" ? "결: 두 십성이 섞임" : `결: ${flavor}` })
  }
  return { level, basis, flags }
}

// ─────────────────────────────────────────── §3.7 steadiness / edge

function tenGodSetRule(a: RuleAnalysis, p: TenGodSetParams, D: ChartDerived): Out {
  const set = p.tenGods
  const items = D.A.basis.filter((b) => b.group !== "self" && set.includes(tenGodOfStem(a.dayMaster.stem, b.char)))
  const sum = items.reduce((x, b) => x + b.points, 0)
  const share = round6(sum / D.T)
  const shown = a.tenGods.some(
    (h) => (h.position.pillar === "year" || h.position.pillar === "month" || h.position.pillar === "hour") && h.position.part === "stem" && !h.viaHiddenStem && set.includes(h.tenGod),
  )
  let level: PotentialLevel = share >= p.strongShare && shown ? "strong" : share >= p.moderateShare ? "moderate" : "faint"
  const positions = uniq(items.map((b) => posStr(b.position, b.viaHiddenStem)))
  const basis: ChartPotential["basis"] = [
    { ruleId: "exp.lv.tenGodSet.v1", positions, note: `${set.join("·")} 비율 ${share}${shown ? ", 천간 투출 있음" : ", 천간 투출 없음"}` },
  ]
  if (level === "moderate" && p.clarityFlags.length) {
    const hit = a.qiFlow?.clarityFlags?.filter((f) => p.clarityFlags.includes(f.flag)) ?? []
    if (hit.length) {
      level = "strong"
      basis.push({ ruleId: "exp.mod.edge.clarity", positions: uniq(hit.flatMap((f) => f.members.map((m) => posStr(m)))), note: `청탁 표지 ${hit.map((f) => f.flag).join("·")}` })
    }
  }
  return { level, basis, flags: [] }
}

// ─────────────────────────────────────────── §3.8 flux

function fluxRule(a: RuleAnalysis, p: FluxParams): Out {
  const R = a.interactions.filter((i) => i.scope === "natal" && !(i.subsumedBy && i.subsumedBy.length))
  const moving = R.filter((i) => i.type === "clash" || i.type === "stemClash" || (i.type === "punishment" && !i.partial))
  const keyClash = moving.some(
    (i) => i.type === "clash" && i.members.some((m) => m.part === "branch" && (p.keyPillars as string[]).includes(m.pillar)),
  )
  const level: PotentialLevel = keyClash && moving.length >= p.strongMinMoving ? "strong" : moving.length >= 1 ? "moderate" : "faint"
  const positions = uniq(moving.flatMap((i) => i.members.map((m) => posStr(m))))
  const note = moving.length
    ? `원국 충·형 ${moving.length}개(${moving.map((i) => i.chars.join("")).join(", ")})${keyClash ? ", 월지·일지 충 있음" : ""}`
    : "원국에 충·형 없음(파·해·합은 세지 않음)"
  return { level, basis: [{ ruleId: "exp.lv.flux.v1", positions, note }], flags: [] }
}

// ─────────────────────────────────────────── §3.9 outward

function outwardRule(a: RuleAnalysis, p: OutwardParams): Out {
  const yy = a.elements.yinYang
  const n = yy.yang + yy.yin
  const yr = n > 0 ? round6(yy.yang / n) : 0.5
  const t = a.climate?.tClass
  const warm = t === "난" || t === "열강"
  const cold = t === "한" || t === "한강"
  const level: PotentialLevel =
    yr >= p.strongYang || (yr >= p.warmStrongYang && warm) ? "strong" : yr <= p.faintYang || (yr <= p.coldFaintYang && cold) ? "faint" : "moderate"
  return {
    level,
    basis: [{ ruleId: "exp.lv.outward.v1", positions: [], note: `양 ${yy.yang}/${n}(${yr}, 지지 음양 ${yy.branchYinYang}), 한난 ${t ?? "없음"}` }],
    flags: [],
  }
}

/** 차원 하나의 원국 잠재력. 근거 한 줄 이상(faint도) */
export function potentialOf(a: RuleAnalysis, d: DimensionRow, tables: DimensionTable, D: ChartDerived = deriveChart(a)): ChartPotential {
  let out: Out
  switch (d.rule) {
    case "exp.lv.group.v1":
      out = groupRule(a, d, d.params as GroupRuleParams, D)
      break
    case "exp.lv.tenGodSet.v1":
      out = tenGodSetRule(a, d.params as TenGodSetParams, D)
      break
    case "exp.lv.flux.v1":
      out = fluxRule(a, d.params as FluxParams)
      break
    case "exp.lv.outward.v1":
      out = outwardRule(a, d.params as OutwardParams)
      break
    default:
      throw new EngineInputError(`없는 판정 규칙 ${String(d.rule)}`)
  }
  return { dimensionId: d.id, level: out.level, basis: out.basis, evidenceLevel: tables.evidenceLevel, flags: out.flags }
}

export function potentialsOf(a: RuleAnalysis, tables: DimensionTable): ChartPotential[] {
  const D = deriveChart(a)
  return tables.dimensions.map((d) => potentialOf(a, d, tables, D))
}

// ─────────────────────────────────────────── 표 고정·다시 분석(원국만)

const P = (p: { stem: string; branch: string } | null): string => (p ? p.stem + p.branch : "--")

function natalChart(a: RuleAnalysis, hour: RuleAnalysis["source"]["natal"]["hour"]): CalendarResult {
  const n = a.source.natal
  // analyzeRules는 pillars·engineVersion만 읽는다(archetype/index.ts와 같은 방식)
  return {
    pillars: { year: { ...n.year }, month: { ...n.month }, day: { ...n.day }, hour: hour ? { ...hour } : null },
    engineVersion: a.calendarEngineVersion,
  } as CalendarResult
}
const optsWith = (a: RuleAnalysis, table: HiddenStemTableId): RuleOptions => ({ ...a.options, usefulGodMethods: [...a.options.usefulGodMethods], hiddenStemTable: table })

const cache = new Map<string, PotentialLevel[][] | PotentialLevel[]>()
const CACHE_MAX = 256
function cached<T extends PotentialLevel[][] | PotentialLevel[]>(key: string, make: () => T): T {
  const hit = cache.get(key) as T | undefined
  if (hit) return JSON.parse(JSON.stringify(hit)) as T
  const v = make()
  if (cache.size >= CACHE_MAX) cache.clear()
  cache.set(key, JSON.parse(JSON.stringify(v)))
  return v
}
const keyOf = (a: RuleAnalysis, tag: string, hash: string): string =>
  `${tag}|${P(a.source.natal.year)}|${P(a.source.natal.month)}|${P(a.source.natal.day)}|${P(a.source.natal.hour)}|${archetypeCanonicalJson(a.options)}|${hash}`

/** 차원 판정용 분석: 표가 고정 표(kr-monthly-30)면 그대로, 아니면 같은 원국을 고정 표로 다시 분석(원국만 — 운은 원국 판정에 쓰지 않음) */
export function fixedTableAnalysis(a: RuleAnalysis, tables: DimensionTable): RuleAnalysis {
  if (a.options.hiddenStemTable === tables.hiddenStemTable) return a
  return analyzeRules(natalChart(a, a.source.natal.hour), optsWith(a, tables.hiddenStemTable))
}

/** 비교 표(cn-lunarjs)로 다시 분석한 차원별 단계(기록만, §7.3) */
export function compareTableLevels(fixed: RuleAnalysis, tables: DimensionTable, hash: string): PotentialLevel[] {
  return cached(keyOf(fixed, `table:${tables.sensitivity.compareTable}`, hash), () => {
    const b = analyzeRules(natalChart(fixed, fixed.source.natal.hour), optsWith(fixed, tables.sensitivity.compareTable))
    return potentialsOf(b, tables).map((p) => p.level)
  })
}

/**
 * 시주를 모르면 일간 기준 12시진 시주를 넣어 다시 분석하고 차원별 단계를 돌려준다(차원 순서 × 12, §7.1).
 * 시주를 알면 null. 판정값은 세 기둥 결과 그대로이며 이 값은 기록·판정 보류에만 쓴다. 캐시는 속도용(값에 영향 없음).
 */
export function hourLevelVariants(fixed: RuleAnalysis, tables: DimensionTable, hash: string): PotentialLevel[][] | null {
  const n = fixed.source.natal
  if (n.hour !== null) return null
  return cached(keyOf(fixed, "hour", hash), () => {
    const byDim: PotentialLevel[][] = tables.dimensions.map(() => [])
    for (const hp of hourPillarsOf(n.day.stem)) {
      const ah = analyzeRules(natalChart(fixed, hp), optsWith(fixed, fixed.options.hiddenStemTable))
      potentialsOf(ah, tables).forEach((p, i) => byDim[i].push(p.level))
    }
    return byDim
  })
}
