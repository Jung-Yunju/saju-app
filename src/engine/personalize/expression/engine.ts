// 사주 발현 분석 엔진 본체 (expression@0.1.0, D-035). 계약: docs/redesign/30-expression-engine.md
// 명리 규칙: docs/knowledge/personalization/expression-dimensions.md (연구소장) · 유지관리: docs/knowledge/personalization/expression-engine.md
// "하늘이 만들어 준 나(원국) → 세월이 만들어 낸 나(발현) → 앞으로 내가 만들어 갈 나(운·개운)"를 코드로 판정한다.
// 불변식(시험으로 고정 — __tests__/expression.test.ts):
//  1) RuleAnalysis·대운·세운은 읽기만 한다. 이 함수는 원국(chart)을 받지 않으므로 MBTI가 원국·운 계산에 들어갈 길이 없다.
//  2) 모든 DimensionReading.inferred === true, 모든 ChartPotential.basis는 비지 않는다.
//  3) 출력에 나오는 사용자 사실은 입력 UserFact id를 "fact:<id>"로 가리키는 것뿐이다(사실 내용을 새로 쓰지 않는다).
//  4) developed는 같은 방향의 기질 답(trait) 사실이 있어야 한다 — MBTI만·상황 답만으로는 내지 않는다.
//  5) 시주 모름이면 dormant·developed는 hourStable ≥ hourStableMin(8/12)일 때만.
//  6) 같은 입력 → 같은 출력(시각·난수·외부 호출 없음).
import { analyzeArchetype } from "../../archetype"
import { buildGaeunBasis, luckGlyphsOf, pickGaeun, type GaeunInput, type GaeunOptions } from "../../content/gaeun"
import type { GaeunPick, LuckGlyphFacts } from "../../content/types"
import type { Position, RuleAnalysis } from "../../rules/types"
import { EngineInputError, type Element } from "../../types"
import { compareTableLevels, deriveChart, fixedTableAnalysis, hourLevelVariants, potentialOf } from "./chart-rules"
import { normalizeSelf, selfSignalOf, styleHintsOf } from "./self-report"
import { expressionTables, type ExpressionTables } from "./tables"
import {
  EXPRESSION_ENGINE_VERSION,
  EXPRESSION_SECTION_IDS,
  type ChartPotential,
  type DimensionReading,
  type ExpressionConflict,
  type ExpressionLuck,
  type ExpressionReport,
  type ExpressionSectionId,
  type ExpressionStatus,
  type GroupRuleParams,
  type LuckTone,
  type LuckTouch,
  type SelfReport,
  type TenGodSetParams,
} from "./types"

export interface ExpressionInput {
  /** analyzeRules 결과. 대운을 보려면 extra.luck(대운 간지들), 세운을 보려면 extra.year를 넣어 분석한 것 */
  analysis: RuleAnalysis
  /** 자기보고(없어도 된다 — 그때는 모든 차원이 unknown) */
  self?: SelfReport
  luck?: {
    /** 지금 대운: analysis.source.luck의 0부터 번호 + 대운 순번(1부터, chart.luck.daeun[].index) */
    daeun?: { luckIndex: number; daeunIndex: number }
    /** 세운 연도(표기용). 세운 글자는 analysis.source.seun에서 읽는다 */
    seunYear?: number
  }
  /** 미리 판정한 원형(없으면 analyzeArchetype으로 판정) */
  archetype?: { id: string }
  gaeun?: {
    /** 미리 고른 개운(없으면 pickGaeun으로 고른다). 이 엔진은 순서만 바꾼다 */
    picks?: readonly GaeunPick[]
    turn?: GaeunInput["turn"]
    options?: GaeunOptions
  }
}

export interface ExpressionOptions {
  /** 다른 표로 돌릴 때(시험·연구). 기본 = 동봉 표 */
  tables?: ExpressionTables
  /** 시주 모름일 때 12시진 재판정(hourStable)을 할지(기본 true). 끄면 hourStable 없음 → dormant·developed 보류 */
  hourCheck?: boolean
  /** 비교 표(cn-lunarjs) 재판정 기록을 할지(기본 true) */
  tableCheck?: boolean
}

const LEVEL_RANK: Readonly<Record<ChartPotential["level"], number>> = { strong: 0, moderate: 1, faint: 2 }
const KIND_RANK: Readonly<Record<string, number>> = { core: 0, grain: 1, aux: 2 }
const EL_KO: Readonly<Record<Element, string>> = { wood: "목", fire: "화", earth: "토", metal: "금", water: "수" }

function uniq(xs: readonly string[]): string[] {
  const out: string[] = []
  for (const x of xs) if (!out.includes(x)) out.push(x)
  return out
}

function statusOf(present: boolean, signal: "high" | "low" | "none", developedOk: boolean): { status: ExpressionStatus; blocked: boolean } {
  if (signal === "none") return { status: "unknown", blocked: false }
  if (present) return { status: signal === "high" ? "expressed" : "dormant", blocked: false }
  if (signal === "low") return { status: "quiet", blocked: false }
  return developedOk ? { status: "developed", blocked: false } : { status: "unknown", blocked: true }
}

/**
 * 발현 분석 보고서. 판단은 전부 코드·표로 하고, 문장은 만들지 않는다(note는 내부 기록용 짧은 설명).
 * @throws EngineInputError analysis가 analyzeRules 결과(rules@0.4.0) 모양이 아닐 때
 */
export function buildExpressionReport(input: ExpressionInput, opts: ExpressionOptions = {}): ExpressionReport {
  const a0 = input?.analysis
  if (!a0 || typeof a0 !== "object" || !a0.source?.natal || !Array.isArray(a0.tenGods) || !a0.options)
    throw new EngineInputError("analysis는 analyzeRules 결과여야 함")
  const T = opts.tables ?? expressionTables()
  const { dims, bridge } = T
  const conflicts: ExpressionConflict[] = []
  const hourKnown = a0.source.natal.hour !== null

  // ── ① 원국 잠재력(표 kr-monthly-30·모형 A 고정)
  const a = fixedTableAnalysis(a0, dims)
  const D = deriveChart(a)
  const innate: ChartPotential[] = dims.dimensions.map((d) => potentialOf(a, d, dims, D))
  if (D.boundary.blocked)
    conflicts.push({ kind: "chart-uncertain", note: "힘의 세기가 경계 근처라 보는 방식에 따라 달라질 수 있음 — 일간 세력 보정·부담 메모·운의 결을 쓰지 않음" })
  if (!hourKnown) {
    conflicts.push({ kind: "missing", note: "태어난 시각을 몰라 시주 없이 세 기둥으로 잠재력을 읽음" })
    const variants = opts.hourCheck !== false ? hourLevelVariants(a, dims, T.hash) : null
    if (variants) {
      innate.forEach((p, i) => {
        const stable = variants[i].filter((l) => l === p.level).length
        const levels = (["strong", "moderate", "faint"] as const).filter((l) => variants[i].includes(l))
        p.hourStable = { stable, of: 12, levels }
        // 12시진 중 하나라도 세 기둥 판정과 다르면 기록(2가지 이상 나오거나, 12개 모두 다른 단계인 경우 포함)
        if (stable < 12)
          conflicts.push({ dimensionId: p.dimensionId, kind: "chart-uncertain", note: `태어난 시각에 따라 이 기질의 세기가 달라질 수 있음 (${stable}/12)` })
      })
    }
  }
  const compare = opts.tableCheck !== false ? compareTableLevels(a, dims, T.hash) : null
  const tableChanged = compare ? innate.filter((p, i) => compare[i] !== p.level).map((p) => p.dimensionId) : []

  // ── ② 자기보고 정리
  const norm = normalizeSelf(input.self)
  const hasFacts = norm.facts.length > 0
  const hasMbti = norm.mbti.length > 0
  if (!hasFacts && !hasMbti) conflicts.push({ kind: "missing", note: "자기보고(MBTI·설문)가 없어 발현 비교 없이 사주 쪽만 읽음" })
  else if (!hasMbti) conflicts.push({ kind: "missing", note: "MBTI 응답 없음 — 설문 사실만으로 비교" })
  else if (norm.mbti.length < 4) conflicts.push({ kind: "missing", note: `MBTI ${norm.mbti.length}개 축만 응답(나머지 축은 모름) — 응답한 축만 씀` })
  if (hasMbti && !hasFacts) conflicts.push({ kind: "missing", note: "경험·직업 등 설문 사실이 없어 MBTI 자기보고를 한 단계 약하게 반영" })

  // ── ③ 비교 판정
  const hourMin = dims.sensitivity.hourStableMin
  const readings: DimensionReading[] = dims.dimensions.map((d, i) => {
    const chart = innate[i]
    const sig = selfSignalOf(d, norm, dims, bridge)
    const present = dims.levels.present.includes(chart.level)
    const judged = statusOf(present, sig.signal, sig.developedEvidence && !sig.mbtiOnly)
    let status = judged.status
    const blocked = judged.blocked
    if (sig.mbtiOnly && hasFacts)
      conflicts.push({ dimensionId: d.id, kind: "missing", note: "이 차원에 닿는 설문 사실이 없어 MBTI 자기보고만 한 단계 약하게 반영" })
    if (blocked) {
      conflicts.push({ dimensionId: d.id, kind: "chart-vs-self", note: "사주 잠재력은 약하게 보이는데 자기보고는 강함" })
      conflicts.push({
        dimensionId: d.id,
        kind: "missing",
        note: sig.situationOnly
          ? "직업 상태·최근 변화·지난 일 같은 상황 답만 있어 '살아오며 키움'으로 판정하지 않고 보류(기질 답 필요)"
          : "같은 방향의 기질 답(강점·일하는 방식 등)이 없어 '살아오며 키움'으로 판정하지 않고 보류",
      })
    }
    if ((status === "developed" || status === "dormant") && !hourKnown && !(chart.hourStable && chart.hourStable.stable >= hourMin)) {
      const x = chart.hourStable ? `${chart.hourStable.stable}/12` : "재판정 안 함"
      conflicts.push({ dimensionId: d.id, kind: "chart-uncertain", note: `태어난 시각에 따라 원국 쪽 세기가 흔들려(${x}) '${status === "developed" ? "살아오며 키움" : "덜 쓴 잠재력"}' 판정을 보류` })
      status = "unknown"
    }
    if (status === "developed")
      conflicts.push({ dimensionId: d.id, kind: "chart-vs-self", note: "사주 잠재력은 약하게 보이는데 기질 자기보고는 강함 — 살아오며 키운 힘일 수 있음(추론)" })
    if (status === "dormant")
      conflicts.push({ dimensionId: d.id, kind: "chart-vs-self", note: "사주 잠재력은 보이는데 자기보고는 약함 — 아직 덜 쓴 잠재력일 가능성(추론)" })
    if (sig.selfConflict === "facts-disagree")
      conflicts.push({ dimensionId: d.id, kind: "self-vs-self", note: "설문 답끼리 방향이 엇갈림 — 합산해 판정" })
    if (sig.selfConflict === "mbti-vs-facts")
      conflicts.push({ dimensionId: d.id, kind: "self-vs-self", note: "MBTI 자기보고와 설문 경험이 반대 방향 — 경험 쪽을 따름" })
    if (sig.signal === "none" && sig.from.length > 0)
      conflicts.push({ dimensionId: d.id, kind: "missing", note: "자기보고가 약하거나 서로 상쇄되어 판정 보류" })
    return {
      dimensionId: d.id,
      chart,
      self: { signal: sig.signal, from: sig.from, mbtiOnly: sig.mbtiOnly },
      status,
      inferred: true as const,
    }
  })
  const statusById = new Map(readings.map((r) => [r.dimensionId, r.status]))

  // ── ④ 운 × 차원 상태 → 행동 방향(§5)
  const slots: LuckGlyphFacts[] = []
  const dRef = input.luck?.daeun
  if (dRef) {
    const g = Number.isInteger(dRef.luckIndex) && dRef.luckIndex >= 0
      ? luckGlyphsOf(a0, { slot: "daeun", luckIndex: dRef.luckIndex, daeunIndex: dRef.daeunIndex })
      : null
    if (g) slots.push(g)
    else conflicts.push({ kind: "missing", note: "지금 대운 글자가 규칙 엔진 결과에 없어 대운 전략을 고르지 않음" })
  }
  if (a0.source.seun) {
    const g = luckGlyphsOf(a0, { slot: "seun", year: input.luck?.seunYear ?? 0 })
    if (g) slots.push(g)
  }
  const eok = a.usefulGods?.views?.find((v) => v.method === "eokbu")
  const eokRank1 = eok?.candidates?.find((c) => c.rank === 1)?.element
  const johu = a.usefulGods?.views?.find((v) => v.method === "johuClimate")
  const johuRank1 = johu?.status === "ok" ? johu.candidates?.find((c) => c.rank === 1)?.element : undefined
  const toneReady = !D.boundary.blocked && eok?.status === "ok" && !!eok.favorable && !!eokRank1
  if (slots.length && toneReady && johuRank1 && johuRank1 !== eokRank1)
    conflicts.push({ kind: "chart-uncertain", note: "운의 결(힘이 실림/부담)은 억부 관점만 씀 — 조후 관점 1순위와 엇갈림" })

  const dimIds = dims.dimensions.map((d) => d.id)
  const tenGodSets = dims.dimensions.filter((d) => d.rule === "exp.lv.tenGodSet.v1").map((d) => ({ id: d.id, set: (d.params as TenGodSetParams).tenGods }))
  const fluxCfg = dims.luck.flux
  const luck: ExpressionLuck[] = slots.map((s) => {
    const touchList: LuckTouch[] = []
    for (const gl of s.glyphs) {
      const m = dims.luck.groupMap[gl.group]
      touchList.push({ dimensionId: m.activate, mode: "activate", via: [gl.pos], ruleId: "exp.luck.activate" })
      touchList.push({ dimensionId: m.feed, mode: "feed", via: [gl.pos], ruleId: "exp.luck.feed" })
      touchList.push({ dimensionId: m.press, mode: "press", via: [gl.pos], ruleId: "exp.luck.press" })
      for (const ts of tenGodSets) if (ts.set.includes(gl.tenGod)) touchList.push({ dimensionId: ts.id, mode: "activate", via: [gl.pos], ruleId: "exp.luck.activate" })
    }
    // 관계: 운 글자 ↔ 원국 월지·일지 충·형(부분 삼형 제외)
    const slotPos = (p: Position): boolean => p.pillar === s.slot && (s.slot !== "daeun" || p.luckIndex === dRef?.luckIndex)
    const luckPosStr = (p: Position): string => (slotPos(p) && s.slot === "daeun" ? `daeun[${s.daeunIndex}].${p.part}` : `${p.pillar}.${p.part}`)
    for (const it of a0.interactions) {
      if (it.scope !== "luck" || !it.members.some(slotPos)) continue
      if (!(fluxCfg.types as string[]).includes(it.type) || (it.type === "punishment" && it.partial)) continue
      const others = it.members.filter((m) => !slotPos(m))
      if (!others.length) continue
      const natalOnly = others.every((m) => m.pillar === "year" || m.pillar === "month" || m.pillar === "day" || m.pillar === "hour")
      if (!natalOnly || !others.some((m) => m.part === "branch" && (fluxCfg.natalPillars as string[]).includes(m.pillar))) continue
      touchList.push({ dimensionId: fluxCfg.dimensionId, mode: "activate", via: it.members.map(luckPosStr), ruleId: "exp.luck.flux" })
    }
    // 같은 차원·같은 방식은 하나로(근거 위치 합침), 표 순서 → activate·feed·press 순
    const MODE_RANK = { activate: 0, feed: 1, press: 2 } as const
    const merged: LuckTouch[] = []
    for (const t of touchList) {
      const hit = merged.find((x) => x.dimensionId === t.dimensionId && x.mode === t.mode)
      if (hit) hit.via = uniq([...hit.via, ...t.via]) // 처음 규칙 id 유지
      else merged.push({ ...t, via: [...t.via] })
    }
    merged.sort((x, y) => dimIds.indexOf(x.dimensionId) - dimIds.indexOf(y.dimensionId) || MODE_RANK[x.mode] - MODE_RANK[y.mode])

    // 운의 결(§5.5): 억부 ok·희신 있음일 때만. 경계면 neutral
    let tone: LuckTone = "neutral"
    if (toneReady && eok?.favorable && eokRank1) {
      const sup = new Set([EL_KO[eokRank1], EL_KO[eok.favorable.xi]])
      const load = new Set([EL_KO[eok.favorable.ji], EL_KO[eok.favorable.gu]])
      const cls = s.glyphs.map((g) => (sup.has(g.element) ? "support" : load.has(g.element) ? "load" : "neutral"))
      const hasS = cls.includes("support")
      const hasL = cls.includes("load")
      tone = hasS && !hasL ? "support" : hasL && !hasS ? "load" : "neutral"
    }

    const strategy: string[] = []
    for (const t of merged) {
      if (t.mode === "feed") continue
      const st = dims.strategies.matrix[statusById.get(t.dimensionId) ?? "unknown"][t.mode]
      strategy.push(`${st}:${t.dimensionId}`)
    }
    if (tone !== "neutral") strategy.push(dims.strategies.tone[tone])
    return {
      scope: s.slot,
      ganzhi: s.ganzhi,
      activates: uniq(merged.filter((t) => t.mode === "activate").map((t) => t.dimensionId)),
      strategy: uniq(strategy),
      touches: merged,
      tone,
    }
  })

  // ── ⑤ 개운: pickGaeun 결과를 상태에 따라 재정렬(범주는 바꾸지 않음)
  let picks: readonly GaeunPick[]
  if (input.gaeun?.picks) picks = input.gaeun.picks
  else {
    const basis = buildGaeunBasis(a0)
    if (basis) {
      picks = pickGaeun(
        { basis, dayElement: a0.dayMaster.element, hourKnown, luck: slots, ...(input.gaeun?.turn !== undefined ? { turn: input.gaeun.turn } : {}) },
        input.gaeun?.options,
      )
    } else {
      picks = []
      conflicts.push({ kind: "missing", note: "개운 근거값(신강약·용신·조후)이 없어 개운을 고르지 않음" })
    }
  }
  const dimOfGroup = (g: string | undefined): string | undefined =>
    g ? dims.dimensions.find((d) => d.rule === "exp.lv.group.v1" && (d.params as GroupRuleParams).group === g)?.id : undefined
  const wish = norm.facts.find((f) => f.questionId === "changeWish")
  const wishDims = wish ? dims.changeWish[wish.value] ?? [] : []
  let wishUsed = false
  const ranked = picks.map((p, i) => {
    const m = /^GA\.(fill|ease)\.(\w+)$/.exec(p.id)
    let pr = dims.gaeunPriority.other
    if (m) {
      const dim = dimOfGroup(m[2])
      const st: ExpressionStatus = dim ? (statusById.get(dim) ?? "unknown") : "unknown"
      pr = dims.gaeunPriority[m[1] as "fill" | "ease"][st]
    }
    const touched = uniq([p.group, ...(p.luckGroups ?? []), ...(m ? [m[2]] : [])].map(dimOfGroup).filter((x): x is string => !!x))
    if (wishDims.length && touched.some((d) => wishDims.includes(d))) {
      pr += dims.gaeunPriority.changeWishBoost
      wishUsed = true
    }
    return { id: p.id, pr, i }
  })
  ranked.sort((x, y) => y.pr - x.pr || x.i - y.i)
  const gaeun = uniq(ranked.map((r) => r.id))

  // ── ⑥ 원형
  const archetypeId = input.archetype?.id ?? analyzeArchetype(a0, { pillars: a0.source.natal, engineVersion: a0.calendarEngineVersion }).id
  const archLinks = dims.archetypeLinks[archetypeId] ?? []

  // ── ⑦ 9개 결과 항목 ↔ 근거 id
  const conflictIdsOf = (dimId: string): string[] => conflicts.flatMap((c, i) => (c.dimensionId === dimId ? [`conflict:${i}`] : []))
  const readingRefs = (st: ExpressionStatus): string[] =>
    readings.filter((r) => r.status === st).flatMap((r) => [`reading:${r.dimensionId}`, ...r.self.from])
  // 대표 기질: present 중 strong 먼저, 갈래(핵심 → 결 → 보조), 표 순서. 같은 근거 위치를 공유하는 차원은 하나만(§7.8)
  const kindOf = (id: string): string => dims.dimensions.find((d) => d.id === id)?.kind ?? "aux"
  const order = innate
    .map((p, i) => ({ p, i }))
    .filter((x) => dims.levels.present.includes(x.p.level))
    .sort((x, y) => LEVEL_RANK[x.p.level] - LEVEL_RANK[y.p.level] || KIND_RANK[kindOf(x.p.dimensionId)] - KIND_RANK[kindOf(y.p.dimensionId)] || x.i - y.i)
  const chosen: ChartPotential[] = []
  const usedPos = new Set<string>()
  for (const { p } of order) {
    const pos = p.basis.flatMap((b) => b.positions)
    if (pos.some((x) => usedPos.has(x))) continue
    chosen.push(p)
    pos.forEach((x) => usedPos.add(x))
  }
  const luckActivated = new Set(luck.flatMap((l) => l.activates))

  const raw: Record<ExpressionSectionId, string[]> = {
    innateEssence: chosen.map((p) => `potential:${p.dimensionId}`),
    expressedNow: readingRefs("expressed"),
    developedAbility: readingRefs("developed"),
    untappedPotential: readingRefs("dormant"),
    gap: [
      ...readings.filter((r) => r.status === "developed" || r.status === "dormant").map((r) => `reading:${r.dimensionId}`),
      ...conflicts.flatMap((c, i) => ((c.kind === "chart-vs-self" || c.kind === "self-vs-self") || !c.dimensionId ? [`conflict:${i}`] : [])),
    ],
    archetype: [`archetype:${archetypeId}`, ...archLinks.map((d) => `potential:${d}`)],
    growable: readings
      .filter((r) => r.status === "dormant" || (luckActivated.has(r.dimensionId) && r.status !== "expressed"))
      .map((r) => `reading:${r.dimensionId}`),
    luckStrategy: luck.flatMap((l) => [
      `luck:${l.scope}:${l.ganzhi}`,
      ...uniq(l.touches.filter((t) => t.mode !== "feed").map((t) => `reading:${t.dimensionId}`)),
    ]),
    gaeun: [...gaeun.map((id) => `gaeun:${id}`), ...(wishUsed && wish ? [`fact:${wish.id}`] : [])],
  }
  const sections = {} as Record<ExpressionSectionId, string[]>
  for (const sid of EXPRESSION_SECTION_IDS) {
    const ids = raw[sid]
    const extra = ids.flatMap((x) => {
      const m = /^(?:reading|potential):(.+)$/.exec(x)
      return m ? conflictIdsOf(m[1]) : []
    })
    sections[sid] = uniq([...ids, ...extra])
  }

  return {
    version: EXPRESSION_ENGINE_VERSION,
    rulesHash: T.hash,
    tables: {
      dimensions: { version: dims.version, status: dims.status, basedOn: dims.basedOn },
      mbtiBridge: { version: bridge.version, status: bridge.status, claim: bridge.claim },
    },
    dimensions: dims.dimensions.map((d) => ({ id: d.id, label: d.label, kind: d.kind })),
    innate,
    readings,
    conflicts,
    luck,
    gaeun,
    archetype: { id: archetypeId },
    sections,
    styleHints: styleHintsOf(norm.mbti, bridge),
    sensitivity: {
      table: { fixed: dims.hiddenStemTable, compare: dims.sensitivity.compareTable, changed: tableChanged },
      boundary: { ...D.boundary },
    },
    inferred: true,
  }
}
