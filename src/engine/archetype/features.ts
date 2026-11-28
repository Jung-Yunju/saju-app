// RuleAnalysis → 특징 벡터 (features@0.2.0). 원형 실험 도구 scripts/archetype-lab/lib/features.ts에서 옮김 — 같은 RuleAnalysis면 같은 벡터(키 순서 포함).
// 특징은 규칙 엔진이 이미 계산한 값만 옮기거나 단순 집계한다(새 명리 판단을 만들지 않는다). 동일성은 __tests__/archetype.test.ts가 lab과 1천 건 대조한다.
import type { Branch, Element } from "../types"
import type { RuleAnalysis, TenGod, TenGodGroup } from "../rules/types"
import type { FeatureSpec, FeatureValue, FeatureVector } from "./types"

const ELEMENTS: readonly Element[] = ["wood", "fire", "earth", "metal", "water"]
const GROUPS: readonly TenGodGroup[] = ["bigyeop", "inseong", "siksang", "jaeseong", "gwansal"]
const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const
const TEN_GODS: readonly TenGod[] = ["비견", "겁재", "식신", "상관", "편재", "정재", "편관", "정관", "편인", "정인"]
const STRUCTURE_NAMES = [
  "정관격", "칠살격", "정재격", "편재격", "정인격", "편인격", "식신격", "상관격", "건록격", "양인격", "월겁격",
] as const
const VERDICTS = ["신강", "중화", "신약"] as const
const SEASONS = ["spring", "summer", "autumn", "winter"] as const
const TCLASS = ["한강", "한", "중", "난", "열강"] as const
const MCLASS = ["습강", "습", "중", "조", "조강"] as const
const NEEDS = ["warm", "cool", "dry", "moisten"] as const
const CLARITY = ["관살혼잡", "상관견관", "효신탈식", "비겁쟁재", "재성파인"] as const
const REL_TYPES = [
  "stemCombine", "stemClash", "sixCombine", "threeCombine", "halfCombine", "directionalCombine", "clash", "punishment", "break", "harm",
] as const

export const TEN_GOD_GROUP: Readonly<Record<TenGod, TenGodGroup>> = {
  비견: "bigyeop", 겁재: "bigyeop", 식신: "siksang", 상관: "siksang", 편재: "jaeseong",
  정재: "jaeseong", 편관: "gwansal", 정관: "gwansal", 편인: "inseong", 정인: "inseong",
}

/** 오행 e가 일간 오행 d에 대해 어떤 묶음인가 (같으면 self) */
function relOf(d: Element, e: Element): TenGodGroup | "self" {
  const k = (ELEMENTS.indexOf(e) - ELEMENTS.indexOf(d) + 5) % 5
  return (["self", "siksang", "jaeseong", "gwansal", "inseong"] as const)[k]
}

const BRANCH_SEASON: Record<Branch, (typeof SEASONS)[number]> = {
  寅: "spring", 卯: "spring", 辰: "spring", 巳: "summer", 午: "summer", 未: "summer",
  申: "autumn", 酉: "autumn", 戌: "autumn", 亥: "winter", 子: "winter", 丑: "winter",
}
const BRANCH_PHASE: Record<Branch, "start" | "peak" | "end"> = {
  寅: "start", 申: "start", 巳: "start", 亥: "start", 子: "peak", 午: "peak", 卯: "peak", 酉: "peak",
  辰: "end", 戌: "end", 丑: "end", 未: "end",
}

const R6 = (x: number): number => Math.round(x * 1e6) / 1e6

/** X가 Y를 극하는 다섯 쌍(목→토, 화→금, 토→수, 금→목, 수→화). 키 "X>Y" */
const CONTROL_PAIRS: readonly { x: Element; y: Element; key: string }[] = ELEMENTS.map((x, i) => {
  const y = ELEMENTS[(i + 2) % 5]
  return { x, y, key: `${x}>${y}` }
})
const PAIR_KEYS = CONTROL_PAIRS.map((p) => p.key)
/** X가 생하는 오행(통관) */
const generated = (x: Element): Element => ELEMENTS[(ELEMENTS.indexOf(x) + 1) % 5]
/** 02-archetypes.md §2.2 strictPairs 기본 기준(설계값 — 바꾸려면 규칙 파일에서 el.pairMin·el.pairRatio 사용) */
export const STRICT_PAIR_MIN = 0.3
export const STRICT_PAIR_RATIO = 0.5
const OPPOSE_ORDER: readonly TenGodGroup[] = ["gwansal", "jaeseong", "siksang"]

// ─────────────────────────────────────────── 특징 목록(규칙 파일이 쓸 수 있는 키 전부)

const S = (key: string, domain: readonly string[], desc: string, from: string, nullable = false): FeatureSpec => ({ key, type: "string", domain, desc, from, nullable })
const N = (key: string, desc: string, from: string, range?: [number, number]): FeatureSpec => ({ key, type: "number", desc, from, range })
const B = (key: string, desc: string, from: string, nullable = false): FeatureSpec => ({ key, type: "boolean", desc, from, nullable })
const L = (key: string, domain: readonly string[], desc: string, from: string): FeatureSpec => ({ key, type: "string[]", domain, desc, from })

export const FEATURE_CATALOG: readonly FeatureSpec[] = [
  // 메타
  B("meta.hourKnown", "시주를 알고 계산했는가", "omitted"),
  // 일간
  S("dm.stem", STEMS, "일간", "dayMaster.stem"),
  S("dm.element", ELEMENTS, "일간 오행", "dayMaster.element"),
  S("dm.yinYang", ["yang", "yin"], "일간 음양", "dayMaster.yinYang"),
  // 월령
  S("month.branch", BRANCHES, "월지", "source.natal.month.branch"),
  S("season", SEASONS, "월지 계절(寅卯辰 봄 … 亥子丑 겨울)", "월지"),
  S("season.phase", ["start", "peak", "end"], "월지 자리: 생지(寅申巳亥)/왕지(子午卯酉)/고지(辰戌丑未)", "월지"),
  S("season.state", ["旺", "相", "休", "囚", "死"], "일간의 왕상휴수사", "strength.seasonState"),
  S("month.rel", GROUPS, "월지 정기 오행이 일간에 대해 어떤 묶음인가", "hiddenStems.month 정기"),
  // 오행
  ...ELEMENTS.map((e) => N(`el.share.${e}`, `${e} 가중 비율(기세 shares)`, `qiFlow.shares.${e}`, [0, 1])),
  ...ELEMENTS.map((e) => N(`el.count.${e}`, `${e} 글자 수(천간 + 지지 정기)`, `elements.counts.${e}`, [0, 8])),
  S("el.dominant", ELEMENTS, "가장 큰 오행", "qiFlow.dominant.element"),
  N("el.dominantShare", "가장 큰 오행 비율", "qiFlow.dominant.share", [0, 1]),
  S("el.dominantRel", ["self", ...GROUPS], "가장 큰 오행이 일간에 대해 어떤 묶음인가", "qiFlow.dominant + 일간"),
  N("el.selfShare", "일간 오행 비율", "qiFlow.shares[일간 오행]", [0, 1]),
  L("el.missing", ELEMENTS, "가중 0인 오행", "qiFlow.missing"),
  N("el.missingCount", "없는 오행 수", "qiFlow.missing.length", [0, 4]),
  N("el.concentration", "오행 집중도 Σshare²(0.2 고름 ~ 1 한 오행)", "qiFlow.concentration", [0.2, 1]),
  N("yy.yangRatio", "양 글자 비율(천간+지지)", "elements.yinYang", [0, 1]),
  // 십성 묶음
  ...GROUPS.map((g) => N(`tg.share.${g}`, `${g} 묶음 비율(일간 제외 묶음 합 대비)`, `strength.groupTotals.${g}`, [0, 1])),
  S("tg.dominant", GROUPS, "가장 큰 십성 묶음(동점은 비겁→인성→식상→재성→관살 순)", "strength.groupTotals"),
  ...GROUPS.map((g) => N(`tg.stems.${g}`, `${g} 묶음 천간 수(일간 제외, 투출)`, "tenGods(천간)", [0, 3])),
  L("tg.stemTenGods", TEN_GODS, "천간(일간 제외)에 드러난 십성", "tenGods(천간)"),
  L("tg.present", TEN_GODS, "원국에 있는 십성(천간·지지·지장간)", "tenGods(원국)"),
  // 연구소장 파생값(02-archetypes.md §2.2) — features@0.2.0
  N("st.total", "모형 A 전체 가중 합 T(u)", "strength.models[weighted].total", [0, 400]),
  ...GROUPS.map((g) => N(`tg.shareT.${g}`, `${g} 묶음 ÷ 모형 A 전체 합 T(gs, 일간 포함 분모)`, `strength.groupTotals.${g} / weighted.total`, [0, 1])),
  S("tg.maxOppose", OPPOSE_ORDER, "빼는 묶음(관살·재성·식상) 중 최대. 동점 관살>재성>식상", "strength.groupTotals"),
  S("tg.supportType", ["bigyeop", "inseong"], "비겁형(비겁 ≥ 인성, 동점 비겁) / 인성형", "strength.groupTotals"),
  L("el.strictPairs", PAIR_KEYS, "양강 대치 쌍 X>Y(X가 Y를 극함, 둘 다 ≥0.30, 작은쪽/큰쪽 ≥0.5). 대표 쌍(X 비율 큰 쌍) 먼저", "qiFlow.shares"),
  N("el.strictPairCount", "양강 대치 쌍 수(기본 기준 0.30/0.5)", "qiFlow.shares", [0, 2]),
  S("el.pairBridge", ELEMENTS, "대표 양강 대치 쌍의 통관 오행(X가 생하는 오행)", "qiFlow.shares", true),
  N("el.pairMin", "극 관계 다섯 쌍 중 min(sX,sY)가 가장 큰 쌍의 그 값(기준 조정 시뮬레이션용)", "qiFlow.shares", [0, 0.5]),
  N("el.pairRatio", "그 쌍의 작은쪽/큰쪽", "qiFlow.shares", [0, 1]),
  S("el.pairKey", PAIR_KEYS, "그 쌍 X>Y", "qiFlow.shares"),
  // 신강약
  S("st.weighted", VERDICTS, "모형 A(가중) 판정", "strength.models[weighted].verdict"),
  S("st.threeFactor", VERDICTS, "모형 B(득령·득지·득세) 판정", "strength.models[threeFactor].verdict"),
  S("st.rooted", VERDICTS, "모형 C(통근) 판정", "strength.models[rooted].verdict"),
  S("st.primary", VERDICTS, "대표 모형 판정(strengthPrimary)", "strength.models[primary].verdict"),
  N("st.ratio", "모형 A 돕는 비율", "strength.models[weighted].ratio", [0, 1]),
  S("st.extreme", ["strong", "weak"], "모형 A 극단(극신강·극신약)", "strength.models[weighted].extreme", true),
  S("st.agreement", ["all", "split"], "세 모형 판정 일치", "strength.agreement"),
  B("st.nearBoundary", "모형 A 경계 근처", "strength.models[weighted].nearBoundary"),
  B("st.dmRooted", "일간 통근", "strength.dayMasterRooted"),
  N("st.rootCount", "일간 뿌리 수", "strength.dayMasterRoots.length", [0, 8]),
  B("st.tableSensitive", "신강약이 지장간 표에 따라 바뀜", "strength.tableSensitive"),
  B("st.hourSensitive", "시주 모름 — 신강약이 시주에 따라 바뀜(시주 알면 null)", "strength.hourSensitivity", true),
  // 격국
  S("gk.name", STRUCTURE_NAMES, "주 후보 격 이름", "structure.candidates[role=primary].name", true),
  S("gk.kind", ["regular", "rokgeop"], "주 후보 종류", "structure.candidates[primary].kind", true),
  S("gk.tenGod", TEN_GODS, "격을 잡은 월지 지장간의 십성", "structure.candidates[primary].pivot.tenGod", true),
  S("gk.group", GROUPS, "격 십성의 묶음", "pivot.tenGod", true),
  B("gk.hasSpecial", "특수격 후보 있음(항상 low)", "structure.candidates[kind=special]"),
  L("gk.special", [], "특수격 후보 이름들", "structure.candidates[kind=special].name"),
  S("gk.variantAgreement", ["same", "differs"], "투출 규칙 변형 간 일치", "structure.candidates[primary].variantAgreement", true),
  B("gk.tableSensitive", "격이 지장간 표에 따라 바뀜", "structure.tableSensitive"),
  // 용신(관점별)
  S("ug.eokbu.status", ["ok", "balanced", "none", "notApplicable"], "억부 관점 상태", "usefulGods.views[eokbu].status", true),
  S("ug.eokbu.element", ELEMENTS, "억부 1순위 오행", "views[eokbu].candidates[0]", true),
  S("ug.eokbu.group", GROUPS, "억부 1순위 묶음", "views[eokbu].candidates[0].group", true),
  S("ug.johu.element", ELEMENTS, "조후 1순위 오행", "views[johuClimate].candidates[0]", true),
  S("ug.tonggwan.element", ELEMENTS, "통관 1순위 오행", "views[tonggwan].candidates[0]", true),
  S("ug.gyeokguk.element", ELEMENTS, "격국 관점 1순위 오행", "views[gyeokguk].candidates[0]", true),
  S("ug.single.element", ELEMENTS, "하나만 대표값 제안(§3.8 가 — 고객 표시용 아님)", "usefulGods.singlePickProposal.element", true),
  S("ug.top.element", ELEMENTS, "가장 많은 관점이 1순위로 낸 오행", "usefulGods.agreement[0]", true),
  N("ug.top.count", "그 오행을 낸 관점 수", "usefulGods.agreement[0].methods.length", [0, 6]),
  // 조후
  S("cl.tClass", TCLASS, "한난 분류", "climate.tClass"),
  S("cl.mClass", MCLASS, "조습 분류", "climate.mClass"),
  N("cl.T", "한난 수치", "climate.T", [-6, 6]),
  N("cl.M", "조습 수치", "climate.M", [-6, 6]),
  L("cl.needs", NEEDS, "조후 필요(warm/cool/dry/moisten)", "climate.needs"),
  // 합충형파해(원국 내부, 세 글자 관계에 포함된 두 글자 기록은 빼고 셈)
  N("rel.combine", "합 수(천간합·육합·삼합·반합·방합)", "interactions(scope natal)", [0, 10]),
  N("rel.clash", "충 수(지지충·천간충)", "interactions", [0, 10]),
  N("rel.punishment", "형 수", "interactions", [0, 10]),
  N("rel.break", "파 수", "interactions", [0, 10]),
  N("rel.harm", "해 수", "interactions", [0, 10]),
  N("rel.tension", "충+형+파+해", "interactions", [0, 20]),
  N("rel.balance", "합 − (충+형+파+해)", "interactions", [-20, 10]),
  L("rel.types", REL_TYPES, "나타난 관계 종류", "interactions"),
  B("rel.dayBranchClash", "일지가 충을 받음", "interactions(clash, 일지)"),
  B("rel.monthBranchClash", "월지가 충을 받음", "interactions(clash, 월지)"),
  B("rel.dayStemCombine", "일간이 천간합", "interactions(stemCombine, 일간)"),
  B("rel.completeTriad", "삼합·방합 세 글자 완성", "interactions(complete)"),
  // 기세
  N("fl.chainLength", "상생 연쇄 길이(비율 0.10 이상 오행)", "qiFlow.flowChain.elements.length", [0, 5]),
  B("fl.circular", "다섯 오행 순환", "qiFlow.flowChain.circular"),
  B("fl.toOutput", "일간 → 식상 흐름", "qiFlow.dayMasterFlow.toOutput"),
  B("fl.toWealth", "식상 → 재성 흐름", "qiFlow.dayMasterFlow.toWealth"),
  B("fl.fromResource", "인성 → 일간 흐름", "qiFlow.dayMasterFlow.fromResource"),
  L("fl.clarity", CLARITY, "천간 청탁 표지", "qiFlow.clarityFlags"),
  N("fl.clarityCount", "청탁 표지 수", "qiFlow.clarityFlags.length", [0, 5]),
  // 공망
  N("gm.hits", "원국 공망 지지 수(rule 옵션 gongmangBasis 기준 첫 항목)", "gongmang[0].hits(원국)", [0, 3]),
]

export const FEATURE_INDEX: ReadonlyMap<string, FeatureSpec> = new Map(FEATURE_CATALOG.map((s) => [s.key, s]))

const COMBINE_TYPES = new Set(["stemCombine", "sixCombine", "threeCombine", "halfCombine", "directionalCombine"])

export function extractFeatures(a: RuleAnalysis): FeatureVector {
  const v: Record<string, FeatureValue> = {}
  const d = a.dayMaster.element
  const n = a.source.natal
  const mb = n.month.branch
  const byModel = Object.fromEntries(a.strength.models.map((m) => [m.model, m]))
  const A = byModel.weighted
  const shares = a.qiFlow.shares

  v["meta.hourKnown"] = n.hour !== null
  v["dm.stem"] = a.dayMaster.stem
  v["dm.element"] = d
  v["dm.yinYang"] = a.dayMaster.yinYang
  v["month.branch"] = mb
  v["season"] = BRANCH_SEASON[mb]
  v["season.phase"] = BRANCH_PHASE[mb]
  v["season.state"] = a.strength.seasonState
  const monthMain = a.hiddenStems.pillars.month.find((h) => h.role === "jeonggi") ?? a.hiddenStems.pillars.month[a.hiddenStems.pillars.month.length - 1]
  const monthMainGod = a.tenGods.find((t) => t.position.pillar === "month" && t.viaHiddenStem === monthMain.role && t.char === monthMain.stem)
  if (!monthMainGod) throw new Error("월지 정기 십성을 찾지 못함")
  v["month.rel"] = TEN_GOD_GROUP[monthMainGod.tenGod]
  for (const e of ELEMENTS) v[`el.share.${e}`] = shares[e]
  for (const e of ELEMENTS) v[`el.count.${e}`] = a.elements.counts[e]
  v["el.dominant"] = a.qiFlow.dominant.element
  v["el.dominantShare"] = a.qiFlow.dominant.share
  v["el.dominantRel"] = relOf(d, a.qiFlow.dominant.element)
  v["el.selfShare"] = shares[d]
  v["el.missing"] = [...a.qiFlow.missing]
  v["el.missingCount"] = a.qiFlow.missing.length
  v["el.concentration"] = a.qiFlow.concentration
  const yy = a.elements.yinYang
  v["yy.yangRatio"] = R6(yy.yang / (yy.yang + yy.yin))

  const gt = a.strength.groupTotals
  const gsum = GROUPS.reduce((s, g) => s + gt[g], 0)
  for (const g of GROUPS) v[`tg.share.${g}`] = gsum > 0 ? R6(gt[g] / gsum) : 0
  let dom: TenGodGroup = GROUPS[0]
  for (const g of GROUPS) if (gt[g] > gt[dom] + 1e-9) dom = g
  v["tg.dominant"] = dom
  const natalKeys = new Set(["year", "month", "day", "hour"])
  const stemHits = a.tenGods.filter((t) => natalKeys.has(t.position.pillar) && t.position.part === "stem")
  for (const g of GROUPS) v[`tg.stems.${g}`] = stemHits.filter((t) => TEN_GOD_GROUP[t.tenGod] === g).length
  v["tg.stemTenGods"] = TEN_GODS.filter((tg) => stemHits.some((t) => t.tenGod === tg))
  const natalHits = a.tenGods.filter((t) => natalKeys.has(t.position.pillar) && (t.position.part === "stem" || t.viaHiddenStem))
  v["tg.present"] = TEN_GODS.filter((tg) => natalHits.some((t) => t.tenGod === tg))

  if (A.total === null || !(A.total > 0)) throw new Error("모형 A total 없음")
  v["st.total"] = A.total
  for (const g of GROUPS) v[`tg.shareT.${g}`] = R6(gt[g] / A.total)
  let mo: TenGodGroup = OPPOSE_ORDER[0]
  for (const g of OPPOSE_ORDER) if (gt[g] > gt[mo]) mo = g // 동점이면 앞 순서(관살>재성>식상) 유지
  v["tg.maxOppose"] = mo
  v["tg.supportType"] = gt.bigyeop >= gt.inseong ? "bigyeop" : "inseong"
  const pairs = CONTROL_PAIRS.map((p) => {
    const sx = shares[p.x]
    const sy = shares[p.y]
    const lo = Math.min(sx, sy)
    const hi = Math.max(sx, sy)
    return { ...p, sx, lo, ratio: hi > 0 ? R6(lo / hi) : 0 }
  })
  const strict = pairs
    .filter((p) => p.sx >= STRICT_PAIR_MIN && shares[p.y] >= STRICT_PAIR_MIN && p.ratio >= STRICT_PAIR_RATIO)
    .sort((a, b) => b.sx - a.sx || ELEMENTS.indexOf(a.x) - ELEMENTS.indexOf(b.x))
  v["el.strictPairs"] = strict.map((p) => p.key)
  v["el.strictPairCount"] = strict.length
  v["el.pairBridge"] = strict.length ? generated(strict[0].x) : null
  const best = [...pairs].sort((a, b) => b.lo - a.lo || b.ratio - a.ratio || ELEMENTS.indexOf(a.x) - ELEMENTS.indexOf(b.x))[0]
  v["el.pairMin"] = R6(best.lo)
  v["el.pairRatio"] = best.ratio
  v["el.pairKey"] = best.key

  v["st.weighted"] = A.verdict
  v["st.threeFactor"] = byModel.threeFactor.verdict
  v["st.rooted"] = byModel.rooted.verdict
  v["st.primary"] = byModel[a.strength.primary].verdict
  v["st.ratio"] = A.ratio
  v["st.extreme"] = A.extreme
  v["st.agreement"] = a.strength.agreement
  v["st.nearBoundary"] = A.nearBoundary
  v["st.dmRooted"] = a.strength.dayMasterRooted
  v["st.rootCount"] = a.strength.dayMasterRoots.length
  v["st.tableSensitive"] = a.strength.tableSensitive
  v["st.hourSensitive"] = a.strength.hourSensitivity ? a.strength.hourSensitivity.hourSensitive : null

  const primary = a.structure.candidates.find((c) => c.role === "primary") ?? null
  const special = a.structure.candidates.filter((c) => c.kind === "special")
  v["gk.name"] = primary ? primary.name : null
  v["gk.kind"] = primary ? (primary.kind as "regular" | "rokgeop") : null
  v["gk.tenGod"] = primary?.pivot ? primary.pivot.tenGod : null
  v["gk.group"] = primary?.pivot ? TEN_GOD_GROUP[primary.pivot.tenGod] : null
  v["gk.hasSpecial"] = special.length > 0
  v["gk.special"] = special.map((c) => c.name)
  v["gk.variantAgreement"] = primary ? primary.variantAgreement : null
  v["gk.tableSensitive"] = a.structure.tableSensitive

  const view = (m: string) => a.usefulGods.views.find((x) => x.method === m)
  const top = (m: string) => view(m)?.candidates.find((c) => c.rank === 1) ?? view(m)?.candidates[0] ?? null
  v["ug.eokbu.status"] = view("eokbu")?.status ?? null
  v["ug.eokbu.element"] = top("eokbu")?.element ?? null
  v["ug.eokbu.group"] = top("eokbu")?.group ?? null
  v["ug.johu.element"] = top("johuClimate")?.element ?? null
  v["ug.tonggwan.element"] = top("tonggwan")?.element ?? null
  v["ug.gyeokguk.element"] = top("gyeokguk")?.element ?? null
  v["ug.single.element"] = a.usefulGods.singlePickProposal.element
  const ag = a.usefulGods.agreement[0]
  v["ug.top.element"] = ag ? ag.element : null
  v["ug.top.count"] = ag ? ag.methods.length : 0

  v["cl.tClass"] = a.climate.tClass
  v["cl.mClass"] = a.climate.mClass
  v["cl.T"] = a.climate.T
  v["cl.M"] = a.climate.M
  v["cl.needs"] = NEEDS.filter((x) => a.climate.needs.includes(x))

  const rels = a.interactions.filter((i) => i.scope === "natal" && !(i.subsumedBy && i.subsumedBy.length))
  const cnt = (p: (t: string) => boolean) => rels.filter((i) => p(i.type)).length
  const combine = cnt((t) => COMBINE_TYPES.has(t))
  const clash = cnt((t) => t === "clash" || t === "stemClash")
  const pun = cnt((t) => t === "punishment")
  const brk = cnt((t) => t === "break")
  const harm = cnt((t) => t === "harm")
  v["rel.combine"] = combine
  v["rel.clash"] = clash
  v["rel.punishment"] = pun
  v["rel.break"] = brk
  v["rel.harm"] = harm
  v["rel.tension"] = clash + pun + brk + harm
  v["rel.balance"] = combine - (clash + pun + brk + harm)
  v["rel.types"] = REL_TYPES.filter((t) => rels.some((i) => i.type === t))
  const hasMember = (type: string, pillar: string, part: string) =>
    rels.some((i) => i.type === type && i.members.some((m) => m.pillar === pillar && m.part === part))
  v["rel.dayBranchClash"] = hasMember("clash", "day", "branch")
  v["rel.monthBranchClash"] = hasMember("clash", "month", "branch")
  v["rel.dayStemCombine"] = hasMember("stemCombine", "day", "stem")
  v["rel.completeTriad"] = rels.some((i) => (i.type === "threeCombine" || i.type === "directionalCombine") && i.complete === true)

  v["fl.chainLength"] = a.qiFlow.flowChain.elements.length
  v["fl.circular"] = a.qiFlow.flowChain.circular
  v["fl.toOutput"] = a.qiFlow.dayMasterFlow.toOutput
  v["fl.toWealth"] = a.qiFlow.dayMasterFlow.toWealth
  v["fl.fromResource"] = a.qiFlow.dayMasterFlow.fromResource
  v["fl.clarity"] = CLARITY.filter((f) => a.qiFlow.clarityFlags.some((x) => x.flag === f))
  v["fl.clarityCount"] = a.qiFlow.clarityFlags.length
  v["gm.hits"] = a.gongmang[0] ? a.gongmang[0].hits.filter((h) => natalKeys.has(h.pillar)).length : 0

  // 목록 순서로 다시 담는다(키 순서 고정) + 빠진 키 점검
  const out: FeatureVector = {}
  for (const s of FEATURE_CATALOG) {
    if (!(s.key in v)) throw new Error(`특징 누락: ${s.key}`)
    out[s.key] = v[s.key]
  }
  if (Object.keys(v).length !== FEATURE_CATALOG.length) throw new Error("목록에 없는 특징이 있음")
  return out
}

