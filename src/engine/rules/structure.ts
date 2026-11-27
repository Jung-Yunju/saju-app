// 격국 — 자평진전 관점 정격 판정(G1~G5) + 상신 후보 표 + 특수격 후보 (strength-structure-spec §2, rules@0.3.0)
// 표는 연구소장 명세의 요지(L0)를 옮긴 것이다. 성격·파격은 판정하지 않는다. 특수격은 항상 confidence "low".
import type { Element, Pillar, Stem } from "../types"
import { stemElement, stemYinYang, tenGodOfStem } from "./basics"
import {
  branchPos, ei, el, elementOfGroup, groupOf, mainQiElement, mainQiOf, natalHidden, otherStems, presentKeys, round6, stemPos,
  type Natal,
} from "./groups"
import { hiddenStemsOf } from "./hidden"
import { HIDDEN_TABLE_IDS } from "./strength"
import { LU, STEM_COMBINES } from "./tables"
import type {
  HiddenStem, HiddenStemTableId, Interaction, Position, RuleOptions, StrengthModelResult, StrengthResult, StructureCandidate,
  StructureGroupRef, StructureResult, TenGod, TenGodGroup,
} from "./types"

/** 양인 자리(양간만). ⚑ 戊午 포함(연구소장 기본). 음간 양인은 1차에 두지 않는다 (§2.2 G1) */
export const YANGIN: Readonly<Partial<Record<Stem, Pillar["branch"]>>> = { 甲: "卯", 丙: "午", 戊: "午", 庚: "酉", 壬: "子" }

const STRUCTURE_NAME: Record<TenGod, { name: string; alias?: string[] }> = {
  정관: { name: "정관격" },
  편관: { name: "칠살격", alias: ["편관격"] },
  정재: { name: "정재격" },
  편재: { name: "편재격" },
  정인: { name: "정인격", alias: ["인수격"] },
  편인: { name: "편인격", alias: ["인수격"] },
  식신: { name: "식신격" },
  상관: { name: "상관격" },
  비견: { name: "비견격" }, // G2에서는 나오지 않는다(비겁은 건너뜀). 표 완결용
  겁재: { name: "겁재격" },
}

const ELEMENT_KO: Record<Element, string> = { wood: "목", fire: "화", earth: "토", metal: "금", water: "수" }
const ILHAENG_NAME: Record<Element, string> = { wood: "곡직격", fire: "염상격", earth: "가색격", metal: "종혁격", water: "윤하격" }
const EARTH_STORES: readonly Pillar["branch"][] = ["辰", "戌", "丑", "未"]

// ─────────────────────────────────────────── 정격

interface StructPick {
  name: string
  alias?: string[]
  kind: "regular" | "rokgeop"
  pivot: NonNullable<StructureCandidate["pivot"]>
  ruleId: string
  rokgeopType?: "건록" | "양인" | "월겁"
}

function touchulPositions(n: Natal, h: Stem, match: RuleOptions["touchulMatch"]): Position[] {
  return otherStems(n)
    .filter((s) => (match === "sameStem" ? s.stem === h : stemElement(s.stem) === stemElement(h)))
    .map((s) => stemPos(s.key))
}

/** 월지 지장간, 정기 → 중기 → 여기 순 */
function monthHiddenByPriority(n: Natal, table: HiddenStemTableId): HiddenStem[] {
  const order = { jeonggi: 0, junggi: 1, yeogi: 2 } as const
  return [...hiddenStemsOf(n.month.branch, table)].sort((a, b) => order[a.role] - order[b.role])
}

/** G1: 록겁 계열이면 그 결과, 아니면 null */
function rokgeopOf(n: Natal, table: HiddenStemTableId, match: RuleOptions["touchulMatch"]): StructPick | null {
  const dayStem = n.day.stem
  const main = mainQiOf(n.month, table)
  const tg = tenGodOfStem(dayStem, main)
  if (tg !== "비견" && tg !== "겁재") return null
  const mb = n.month.branch
  const pivot = { stem: main, role: "jeonggi" as const, touchul: touchulPositions(n, main, match)[0] ?? null, tenGod: tg }
  if (LU[dayStem] === mb) return { name: "건록격", kind: "rokgeop", pivot, ruleId: "structure.zp.G1.geonrok", rokgeopType: "건록" }
  if (stemYinYang(dayStem) === "yang" && YANGIN[dayStem] === mb)
    return { name: "양인격", kind: "rokgeop", pivot, ruleId: "structure.zp.G1.yangin", rokgeopType: "양인" }
  return { name: "월겁격", kind: "rokgeop", pivot, ruleId: "structure.zp.G1.wolgeop", rokgeopType: "월겁" }
}

/** G2(투출 우선) / G2'(정기 고정). 록겁 계열이 아닐 때만 */
function regularOf(n: Natal, table: HiddenStemTableId, mode: RuleOptions["structureTouchul"], match: RuleOptions["touchulMatch"]): StructPick {
  const dayStem = n.day.stem
  const d = stemElement(dayStem)
  const hs = monthHiddenByPriority(n, table)
  const jeong = hs[0]
  let chosen: HiddenStem = jeong
  let touchul: Position | null = touchulPositions(n, jeong.stem, match)[0] ?? null
  if (mode === "transparentFirst") {
    for (const h of hs) {
      if (stemElement(h.stem) === d) continue // 비겁 지장간은 건너뜀
      const t = touchulPositions(n, h.stem, match)
      if (t.length) {
        chosen = h
        touchul = t[0]
        break
      }
    }
  }
  const tg = tenGodOfStem(dayStem, chosen.stem)
  const nm = STRUCTURE_NAME[tg]
  return {
    name: nm.name,
    ...(nm.alias ? { alias: [...nm.alias] } : {}),
    kind: "regular",
    pivot: { stem: chosen.stem, role: chosen.role, touchul, tenGod: tg },
    ruleId: mode === "transparentFirst" ? "structure.zp.G2" : "structure.zp.G2main",
  }
}

function primaryPick(n: Natal, table: HiddenStemTableId, o: Pick<RuleOptions, "structureTouchul" | "touchulMatch">): StructPick {
  return rokgeopOf(n, table, o.touchulMatch) ?? regularOf(n, table, o.structureTouchul, o.touchulMatch)
}

// ─────────────────────────────────────────── 상신·꺼리는 묶음 (§2.3)

interface RefSpec {
  group: TenGodGroup
  tenGods?: TenGod[]
  note?: string
}

function sangsinTable(c: { name: string; kind: string }): { sangsin: RefSpec[]; avoid: RefSpec[]; notes: string[]; touchulOnly: boolean } {
  switch (c.name) {
    case "정관격":
      return { sangsin: [{ group: "jaeseong" }, { group: "inseong" }], avoid: [{ group: "siksang", tenGods: ["상관"] }, { group: "gwansal", tenGods: ["편관"], note: "관살혼잡" }], notes: [], touchulOnly: false }
    case "정재격":
    case "편재격":
      return { sangsin: [{ group: "siksang" }, { group: "gwansal" }], avoid: [{ group: "bigyeop" }], notes: [], touchulOnly: false }
    case "정인격":
      return { sangsin: [{ group: "gwansal" }], avoid: [{ group: "jaeseong" }], notes: [], touchulOnly: false }
    case "편인격":
      return {
        sangsin: [{ group: "gwansal", note: "인수로 볼 때(순용)" }, { group: "jaeseong", note: "효신으로 볼 때(역용): 재성으로 편인을 제어" }],
        avoid: [{ group: "jaeseong", note: "인수로 볼 때" }],
        notes: ["⚑ 편인격: 인수(순용)·효신(역용) 두 관점을 모두 표시. 효신으로 볼 때 식신이 손상되는 것을 꺼림(묶음으로 표시하지 않음)"],
        touchulOnly: false,
      }
    case "식신격":
      return { sangsin: [{ group: "jaeseong" }], avoid: [{ group: "inseong", tenGods: ["편인"], note: "효신탈식" }], notes: [], touchulOnly: false }
    case "칠살격":
      return { sangsin: [{ group: "siksang", tenGods: ["식신"], note: "제살" }, { group: "inseong", note: "화살" }], avoid: [{ group: "jaeseong", note: "재생살" }], notes: [], touchulOnly: false }
    case "상관격":
      return { sangsin: [{ group: "inseong" }, { group: "jaeseong", note: "상관생재" }], avoid: [{ group: "gwansal", tenGods: ["정관"], note: "상관견관" }], notes: [], touchulOnly: false }
    case "양인격":
      return { sangsin: [{ group: "gwansal" }], avoid: [], notes: [], touchulOnly: false }
    case "건록격":
    case "월겁격":
      return { sangsin: [{ group: "jaeseong" }, { group: "gwansal" }, { group: "siksang" }], avoid: [], notes: [], touchulOnly: true }
    default:
      return { sangsin: [], avoid: [], notes: [], touchulOnly: false }
  }
}

function refOf(n: Natal, table: HiddenStemTableId, spec: RefSpec): StructureGroupRef {
  const dayStem = n.day.stem
  const d = stemElement(dayStem)
  const hit = (s: Stem) => groupOf(d, stemElement(s)) === spec.group && (!spec.tenGods || spec.tenGods.includes(tenGodOfStem(dayStem, s)))
  const touchul = otherStems(n).filter((s) => hit(s.stem)).map((s) => stemPos(s.key))
  const hiddenOnly = presentKeys(n)
    .filter((k) => hiddenStemsOf((n[k] as Pillar).branch, table).some((h) => hit(h.stem)))
    .map((k) => branchPos(k))
  return {
    group: spec.group,
    element: elementOfGroup(d, spec.group),
    ...(spec.tenGods ? { tenGods: [...spec.tenGods] } : {}),
    touchul,
    hiddenOnly,
    ...(spec.note ? { note: spec.note } : {}),
  }
}

function toCandidate(n: Natal, table: HiddenStemTableId, p: StructPick, extra: Pick<StructureCandidate, "confidence" | "variantAgreement" | "role">): StructureCandidate {
  const t = sangsinTable(p)
  let sangsin = t.sangsin.map((s) => refOf(n, table, s))
  if (t.touchulOnly) sangsin = sangsin.filter((s) => s.touchul.length > 0)
  const c: StructureCandidate = {
    name: p.name,
    ...(p.alias ? { alias: [...p.alias] } : {}),
    kind: p.kind,
    school: "자평진전",
    pivot: { ...p.pivot, touchul: p.pivot.touchul ? { ...p.pivot.touchul } : null },
    confidence: extra.confidence,
    sangsin,
    avoid: t.avoid.map((s) => refOf(n, table, s)),
    variantAgreement: extra.variantAgreement,
    role: extra.role,
    ruleId: p.ruleId,
  }
  return c
}

export interface RegularResult {
  candidates: StructureCandidate[]
  tableSensitive: boolean
  byTable: StructureResult["byTable"]
  notes: string[]
}

/** 정격 후보(주 후보 → 다른 투출 변형 → G1-alt) */
export function regularStructures(n: Natal, o: RuleOptions): RegularResult {
  const table = o.hiddenStemTable
  const notes: string[] = []
  const rok = rokgeopOf(n, table, o.touchulMatch)
  const out: StructureCandidate[] = []
  if (rok) {
    out.push(toCandidate(n, table, rok, { confidence: "medium", variantAgreement: "same", role: "primary" }))
    if (o.rokgeopAlternative) {
      const d = stemElement(n.day.stem)
      for (const h of monthHiddenByPriority(n, table)) {
        if (stemElement(h.stem) === d) continue
        const t = touchulPositions(n, h.stem, o.touchulMatch)
        if (!t.length) continue
        const tg = tenGodOfStem(n.day.stem, h.stem)
        const nm = STRUCTURE_NAME[tg]
        const alt: StructPick = {
          name: nm.name, ...(nm.alias ? { alias: [...nm.alias] } : {}), kind: "regular",
          pivot: { stem: h.stem, role: h.role, touchul: t[0], tenGod: tg }, ruleId: "structure.zp.G1alt",
        }
        out.push(toCandidate(n, table, alt, { confidence: "low", variantAgreement: "same", role: "rokgeopAlt" }))
      }
    }
  } else {
    const mine = regularOf(n, table, o.structureTouchul, o.touchulMatch)
    const otherMode = o.structureTouchul === "transparentFirst" ? "mainQiOnly" : "transparentFirst"
    const other = regularOf(n, table, otherMode, o.touchulMatch)
    const same = mine.name === other.name && mine.pivot.stem === other.pivot.stem
    out.push(toCandidate(n, table, mine, { confidence: same ? "medium" : "low", variantAgreement: same ? "same" : "differs", role: "primary" }))
    if (!same) out.push(toCandidate(n, table, other, { confidence: "low", variantAgreement: "differs", role: "otherVariant" }))
  }
  for (const c of out) {
    const t = sangsinTable(c)
    if (t.notes.length) notes.push(...t.notes.filter((x) => !notes.includes(x)))
  }
  const byTable = HIDDEN_TABLE_IDS.map((tableId) => ({ tableId, name: primaryPick(n, tableId, o).name }))
  const tableSensitive = new Set(byTable.map((x) => x.name)).size > 1
  return { candidates: out, tableSensitive, byTable, notes }
}

// ─────────────────────────────────────────── 특수격 후보 (§2.4)

export interface SpecialInput {
  n: Natal
  o: RuleOptions
  strength: StrengthResult
  /** 모형 A (strengthPrimary와 무관) */
  A: StrengthModelResult
  weighted: Record<Element, number>
  interactions: readonly Interaction[]
}

const share = (x: number, T: number) => round6(x / T)

/** 특수격 후보와 notes. reversesUsefulGod는 index에서 억부 결과와 비교해 채운다 */
export function specialStructures(inp: SpecialInput): { candidates: StructureCandidate[]; notes: string[] } {
  const { n, strength, A, weighted } = inp
  const notes: string[] = []
  const out: StructureCandidate[] = []
  const r = A.ratio as number
  const T = A.total as number
  const g = strength.groupTotals
  const dayStem = n.day.stem
  const d = stemElement(dayStem)
  const base = { kind: "special" as const, school: "적천수 계열" as const, confidence: "low" as const, variantAgreement: "same" as const, role: "special" as const }

  // 종격
  const F1 = r <= 0.2
  if (F1) {
    const F2 = !strength.dayMasterRooted
    const inShare = share(g.inseong, T)
    const F3 = inShare <= 0.05
    if (F2 && F3) {
      const opp: TenGodGroup[] = ["gwansal", "jaeseong", "siksang"] // 동점: 관살 > 재성 > 식상
      let best: TenGodGroup = opp[0]
      for (const x of opp) if (g[x] > g[best]) best = x
      const bestShare = share(g[best], T)
      const F4 = bestShare >= 0.4
      const nm = !F4 ? "종세격 후보" : best === "gwansal" ? "종살격 후보" : best === "jaeseong" ? "종재격 후보" : "종아격 후보"
      out.push({
        ...base,
        name: nm,
        alias: ["종격"],
        conditions: [
          { id: "F1", met: true, value: r },
          { id: "F2", met: true },
          { id: "F3", met: true, value: inShare },
          { id: "F4", met: F4, value: bestShare },
        ],
        follows: { group: best, element: elementOfGroup(d, best) },
        ruleId: "special.jong",
      })
    } else {
      notes.push("극신약이나 종격 조건 미충족")
    }
  }

  // 종왕·종강
  if (r >= 0.8) {
    const gwShare = share(g.gwansal, T)
    if (gwShare <= 0.05) {
      const wang = g.bigyeop >= g.inseong
      const grp: TenGodGroup = wang ? "bigyeop" : "inseong"
      out.push({
        ...base,
        name: wang ? "종왕격 후보" : "종강격 후보",
        conditions: [
          { id: "E1", met: true, value: r },
          { id: "E2", met: true, value: gwShare },
        ],
        follows: { group: grp, element: elementOfGroup(d, grp) },
        ruleId: "special.jongwang",
      })
    }
  }

  // 화격
  const combo = STEM_COMBINES.find(([x, y]) => x === dayStem || y === dayStem)
  if (combo) {
    const partner = combo[0] === dayStem ? combo[1] : combo[0]
    const h = combo[2]
    const adj = (["month", "hour"] as const).filter((k) => n[k] && (n[k] as Pillar).stem === partner)
    if (adj.length) {
      const monthMain = mainQiElement(n.month, inp.o.hiddenStemTable)
      const H2 = monthMain === h || (ei(monthMain) + 1) % 5 === ei(h)
      const controller = el(ei(h) + 3)
      const H3 = !otherStems(n).some((s) => stemElement(s.stem) === controller)
      const H4 = !natalHidden(n, inp.o.hiddenStemTable).some((x) => stemElement(x.h.stem) === d && x.h.role !== "yeogi")
      const hShare = share(weighted[h], T)
      const H5 = hShare >= 0.4
      const others = otherStems(n)
      const H6 = others.filter((s) => s.stem === partner).length === 1 && others.filter((s) => s.stem === dayStem).length === 0
      if (H2 && H3 && H4 && H5 && H6) {
        const obstructions = inp.interactions
          .filter((i) => i.scope === "natal" && i.type === "stemClash" && i.members.some((m) => m.pillar === "day" && m.part === "stem"))
          .map((i) => ({ ruleId: i.ruleId, members: i.members.map((m) => ({ ...m })) }))
        out.push({
          ...base,
          name: `화${ELEMENT_KO[h]}격 후보`,
          alias: ["화격"],
          conditions: [
            { id: "H1", met: true },
            { id: "H2", met: H2 },
            { id: "H3", met: H3 },
            { id: "H4", met: H4 },
            { id: "H5", met: H5, value: hShare },
            { id: "H6", met: H6 },
          ],
          ...(obstructions.length ? { obstructions } : {}),
          follows: { group: groupOf(d, h), element: h },
          ruleId: "special.hwa",
        })
      }
    }
  }

  // 일행득기
  if (mainQiElement(n.month, inp.o.hiddenStemTable) === d && r >= 0.8 && share(g.gwansal, T) <= 0.05) {
    const branches = presentKeys(n).map((k) => (n[k] as Pillar).branch)
    const formed =
      d === "earth"
        ? branches.filter((b) => EARTH_STORES.includes(b)).length >= 3
        : inp.interactions.some(
            (i) => i.scope === "natal" && i.complete === true && (i.type === "threeCombine" || i.type === "directionalCombine") && i.resultElement === d,
          )
    if (formed)
      out.push({
        ...base,
        name: `${ILHAENG_NAME[d]} 후보`,
        alias: ["일행득기격"],
        conditions: [
          { id: "I1", met: true },
          { id: "I2", met: true },
          { id: "E1", met: true, value: r },
          { id: "E2", met: true, value: share(g.gwansal, T) },
        ],
        follows: { group: "bigyeop", element: d },
        ruleId: "special.ilhaeng",
      })
  }
  return { candidates: out, notes }
}

/**
 * 특수격 관점에서 반가운 오행(순서 = rank). §3.6:
 *  종살·종재·종아 = 따르는 묶음 + 그것을 생하는 오행 / 종세 = 빼는 묶음 큰 순 /
 *  종왕 = 비겁 → 인성, 종강 = 인성 → 비겁(엔진 개발자 정의 ⚑) / 화격·일행득기 = 그 오행 + 그것을 생하는 오행
 */
export function specialFavored(c: StructureCandidate, d: Element, g: Record<TenGodGroup, number>): Element[] {
  const f = c.follows as NonNullable<StructureCandidate["follows"]>
  if (c.ruleId === "special.jong" && c.name.startsWith("종세")) {
    const opp: TenGodGroup[] = ["gwansal", "jaeseong", "siksang"]
    return [...opp].sort((a, b) => g[b] - g[a] || opp.indexOf(a) - opp.indexOf(b)).map((x) => elementOfGroup(d, x))
  }
  if (c.ruleId === "special.jongwang") {
    const order: TenGodGroup[] = f.group === "bigyeop" ? ["bigyeop", "inseong"] : ["inseong", "bigyeop"]
    return order.map((x) => elementOfGroup(d, x))
  }
  return [f.element, el(ei(f.element) + 4)]
}
