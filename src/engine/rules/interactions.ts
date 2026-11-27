// 합·충·형·파·해 (rules-spec §6, §7)
// 원칙
//  - 표에 있는 관계만 기록한다. 같은 글자 쌍이 여러 관계에 해당하면 모두 기록한다(寅申 충·형, 寅亥 합·파, 寅巳 형·해).
//  - 거리와 상관없이 모든 쌍을 기록하고 adjacent를 남긴다(붙어야 작용한다는 설의 필터는 해석 단계 몫).
//  - 운(대운·세운)이 낀 조합은 scope="luck". 대운은 한 조합에 하나만 넣는다(서로 다른 대운끼리는 비교하지 않는다).
//  - 포함 표시(D-019, rules@0.3.0): 세 글자 관계(삼합·방합·삼형)가 성립해도 그 안의 두 글자 기록(반합·두 글자 방합·두 글자 삼형)을
//    지우지 않는다. 대신 subsumedBy에 포함한 세 글자 관계의 식별자(interactionId)를 적는다. 남은 한 글자가 원국이든 운이든 같다
//    (rules@0.2.0의 "남은 글자가 원국일 때만 삭제" 비대칭 규칙은 없앴다). 거를지는 해석 단계가 정한다.
//  - 합화(化) 여부는 판정하지 않는다(transformed: null).
import type { Branch, Element, Stem } from "../types"
import {
  BRANCH_BREAKS, BRANCH_CLASHES, BRANCH_HARMS, DIRECTIONAL_COMBINES, KING_BRANCHES, MUTUAL_PUNISHMENTS,
  SELF_PUNISHMENTS, SIX_COMBINES, STEM_CLASHES, STEM_COMBINES, THREE_COMBINES, THREE_PUNISHMENTS,
} from "./tables"
import type { Interaction, InteractionType, Position, RuleOptions } from "./types"

/** 관계 판정에 쓰는 한 기둥(원국 또는 운) */
export interface Slot {
  /** 정렬 순서(연0 월1 일2 시3, 이후 대운들, 세운) */
  order: number
  /** 원국 기둥이면 0~3(연·월·일·시), 운이면 null */
  natalIndex: number | null
  /** 대운이면 그 번호, 아니면 null */
  luckIndex: number | null
  stemPos: Position
  branchPos: Position
  stem: Stem
  branch: Branch
}

type RuleOpts = Pick<RuleOptions, "halfCombine" | "partialPunishment" | "wuWeiCombine" | "partialDirectional">

const TYPE_ORDER: readonly InteractionType[] = [
  "stemCombine", "stemClash", "sixCombine", "threeCombine", "halfCombine", "directionalCombine",
  "clash", "punishment", "break", "harm",
]

function samePair<T>(a: T, b: T, x: T, y: T): boolean {
  return (a === x && b === y) || (a === y && b === x)
}

function sameSet3<T>(chars: readonly T[], table: readonly T[]): boolean {
  return new Set(chars).size === 3 && chars.every((c) => table.includes(c))
}

/** 한 조합에 서로 다른 대운이 둘 이상 들어가면 비교하지 않는다 */
function allowed(slots: readonly Slot[]): boolean {
  const lucks = new Set(slots.filter((s) => s.luckIndex !== null).map((s) => s.luckIndex))
  return lucks.size <= 1
}

function adjacentOf(slots: readonly Slot[]): boolean {
  if (slots.some((s) => s.natalIndex === null)) return false
  const idx = slots.map((s) => s.natalIndex as number).sort((a, b) => a - b)
  return idx[idx.length - 1] - idx[0] === idx.length - 1 && new Set(idx).size === idx.length
}

function scopeOf(slots: readonly Slot[]): "natal" | "luck" {
  return slots.every((s) => s.natalIndex !== null) ? "natal" : "luck"
}

interface Draft extends Interaction {
  _orders: number[]
}

function make(
  type: InteractionType,
  slots: readonly Slot[],
  part: "stem" | "branch",
  ruleId: string,
  extra: Partial<Interaction> = {},
): Draft {
  return {
    type,
    members: slots.map((s) => ({ ...(part === "stem" ? s.stemPos : s.branchPos) })),
    chars: slots.map((s) => (part === "stem" ? s.stem : s.branch)),
    ...extra,
    adjacent: adjacentOf(slots),
    scope: scopeOf(slots),
    ruleId,
    _orders: slots.map((s) => s.order),
  }
}

function pairs<T>(xs: readonly T[]): [T, T][] {
  const out: [T, T][] = []
  for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) out.push([xs[i], xs[j]])
  return out
}

function triples<T>(xs: readonly T[]): [T, T, T][] {
  const out: [T, T, T][] = []
  for (let i = 0; i < xs.length; i++)
    for (let j = i + 1; j < xs.length; j++) for (let k = j + 1; k < xs.length; k++) out.push([xs[i], xs[j], xs[k]])
  return out
}

const posKey = (p: Position) => `${p.pillar}${p.luckIndex ?? ""}.${p.part}`

/**
 * 관계 식별자: `${ruleId}@${위치들}` 예: "branch.threeCombine.申子辰@year.branch+month.branch+hour.branch".
 * 같은 원국·운 입력 안에서 유일하다(같은 ruleId라도 근거 위치가 다르면 다른 관계).
 */
export function interactionId(i: Pick<Interaction, "ruleId" | "members">): string {
  return `${i.ruleId}@${i.members.map(posKey).join("+")}`
}

/** 두 글자 기록 pair를 포함하는 세 글자 관계들의 식별자(D-019). 운·원국 구분 없이 같다 */
function containersOf(pair: readonly Slot[], completes: readonly { slots: readonly Slot[]; id: string }[]): string[] {
  return completes.filter((t) => pair.every((p) => t.slots.includes(p))).map((t) => t.id)
}

/** 천간 관계 (§6) */
function stemInteractions(slots: readonly Slot[]): Draft[] {
  const out: Draft[] = []
  for (const [a, b] of pairs(slots)) {
    if (!allowed([a, b])) continue
    for (const [x, y, el] of STEM_COMBINES)
      if (samePair(a.stem, b.stem, x, y))
        out.push(make("stemCombine", [a, b], "stem", `stem.combine.${x}${y}`, { resultElement: el, transformed: null }))
    for (const [x, y] of STEM_CLASHES)
      if (samePair(a.stem, b.stem, x, y)) out.push(make("stemClash", [a, b], "stem", `stem.clash.${x}${y}`))
  }
  return out
}

/** 지지 관계 (§7) */
function branchInteractions(slots: readonly Slot[], o: RuleOpts): Draft[] {
  const out: Draft[] = []
  const allTriples = triples(slots).filter(allowed)
  const allPairs = pairs(slots).filter(allowed)

  // 세 글자: 삼합 · 방합 · 삼형 (완성)
  type Complete = { slots: Slot[]; id: string }
  const completeThree = new Map<string, Complete[]>()
  const completeDir = new Map<string, Complete[]>()
  const completePun = new Map<string, Complete[]>()
  const push = (m: Map<string, Complete[]>, k: string, d: Draft, v: Slot[]) => m.set(k, [...(m.get(k) ?? []), { slots: v, id: interactionId(d) }])
  const withSub = (ids: string[]): Partial<Interaction> => (ids.length ? { subsumedBy: ids } : {})

  for (const t of allTriples) {
    const chars = t.map((s) => s.branch)
    for (const [g, k, r, el] of THREE_COMBINES)
      if (sameSet3(chars, [g, k, r])) {
        const d = make("threeCombine", t, "branch", `branch.threeCombine.${g}${k}${r}`, { resultElement: el, complete: true })
        out.push(d)
        push(completeThree, g + k + r, d, t)
      }
    for (const [x, y, z, el] of DIRECTIONAL_COMBINES)
      if (sameSet3(chars, [x, y, z])) {
        const d = make("directionalCombine", t, "branch", `branch.directional.${x}${y}${z}`, { resultElement: el, complete: true })
        out.push(d)
        push(completeDir, x + y + z, d, t)
      }
    for (const [x, y, z] of THREE_PUNISHMENTS)
      if (sameSet3(chars, [x, y, z])) {
        const d = make("punishment", t, "branch", `branch.punishment.${x}${y}${z}`, { punishmentKind: "three", complete: true })
        out.push(d)
        push(completePun, x + y + z, d, t)
      }
  }

  for (const pr of allPairs) {
    const [a, b] = pr
    const A = a.branch
    const B = b.branch

    for (const [x, y, el] of SIX_COMBINES)
      if (samePair(A, B, x, y)) {
        const resultElement: Element | null =
          el ?? (o.wuWeiCombine === "fire" ? "fire" : o.wuWeiCombine === "earth" ? "earth" : null)
        out.push(make("sixCombine", pr, "branch", `branch.sixCombine.${x}${y}`, { resultElement, transformed: null }))
      }

    // 반합: 생지+왕지, 왕지+고지 (+ allPairs면 생지+고지)
    for (const [g, k, r, el] of THREE_COMBINES) {
      const cands: [Branch, Branch][] = [[g, k], [k, r]]
      if (o.halfCombine === "allPairs") cands.push([g, r])
      for (const [x, y] of cands)
        if (samePair(A, B, x, y)) {
          const withKing = KING_BRANCHES.includes(x) || KING_BRANCHES.includes(y)
          const sub = withSub(containersOf(pr, completeThree.get(g + k + r) ?? []))
          out.push(make("halfCombine", pr, "branch", `branch.halfCombine.${x}${y}`, { resultElement: el, withKing, ...sub }))
        }
    }

    // 두 글자 방합(옵션)
    if (o.partialDirectional)
      for (const [x, y, z, el] of DIRECTIONAL_COMBINES)
        for (const [p, q] of pairs([x, y, z]))
          if (samePair(A, B, p, q))
            out.push(make("directionalCombine", pr, "branch", `branch.directional.${p}${q}`, {
              resultElement: el, complete: false, partial: true, ...withSub(containersOf(pr, completeDir.get(x + y + z) ?? [])),
            }))

    for (const [x, y] of BRANCH_CLASHES)
      if (samePair(A, B, x, y)) out.push(make("clash", pr, "branch", `branch.clash.${x}${y}`))

    // 형: 두 글자 삼형(옵션) · 상형 · 자형
    if (o.partialPunishment)
      for (const [x, y, z] of THREE_PUNISHMENTS)
        for (const [p, q] of pairs([x, y, z]))
          if (samePair(A, B, p, q))
            out.push(make("punishment", pr, "branch", `branch.punishment.${p}${q}`, {
              punishmentKind: "three", complete: false, partial: true, ...withSub(containersOf(pr, completePun.get(x + y + z) ?? [])),
            }))
    for (const [x, y] of MUTUAL_PUNISHMENTS)
      if (samePair(A, B, x, y)) out.push(make("punishment", pr, "branch", `branch.punishment.${x}${y}`, { punishmentKind: "mutual" }))
    if (A === B && SELF_PUNISHMENTS.includes(A))
      out.push(make("punishment", pr, "branch", `branch.punishment.${A}${B}`, { punishmentKind: "self" }))

    for (const [x, y] of BRANCH_BREAKS)
      if (samePair(A, B, x, y)) out.push(make("break", pr, "branch", `branch.break.${x}${y}`))
    for (const [x, y] of BRANCH_HARMS)
      if (samePair(A, B, x, y)) out.push(make("harm", pr, "branch", `branch.harm.${x}${y}`))
  }
  return out
}

function compareOrders(a: number[], b: number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i]
  return a.length - b.length
}

/** 슬롯(원국 + 운) 사이의 모든 관계. 순서: 관계 종류 → 근거 위치(연→월→일→시→대운→세운) → ruleId */
export function findInteractions(slots: readonly Slot[], o: RuleOpts): Interaction[] {
  const sorted = [...slots].sort((a, b) => a.order - b.order)
  const drafts = [...stemInteractions(sorted), ...branchInteractions(sorted, o)]
  drafts.sort(
    (a, b) =>
      TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) ||
      compareOrders(a._orders, b._orders) ||
      (a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0),
  )
  return drafts.map((d) => {
    const { _orders, ...rest } = d
    void _orders
    return rest
  })
}
