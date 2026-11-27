// 기초 판정: 글자 검증, 오행·음양, 십성 (rules-spec §1, §2, §4)
import { EngineInputError, type Branch, type Element, type Pillar, type Stem } from "../types"
import { BRANCHES, STEMS } from "../calendar/constants"
import { BRANCH_ELEMENT, BRANCH_YINYANG_BY_MAIN_QI, BRANCH_YINYANG_BY_ORDER, STEM_ELEMENT, STEM_YINYANG } from "./tables"
import type { RuleOptions, TenGod, YinYang } from "./types"

/** 오행 순서(목0 화1 토2 금3 수4) — 상생 e→e+1, 상극 e→e+2 */
export const ELEMENTS: readonly Element[] = ["wood", "fire", "earth", "metal", "water"]

export function isStem(x: unknown): x is Stem {
  return typeof x === "string" && (STEMS as readonly string[]).includes(x)
}

export function isBranch(x: unknown): x is Branch {
  return typeof x === "string" && (BRANCHES as readonly string[]).includes(x)
}

/** 간지 검증: 알 수 없는 글자, 음양이 맞지 않는 짝(甲丑 등)은 EngineInputError */
export function assertPillar(p: unknown, label: string): asserts p is Pillar {
  if (!p || typeof p !== "object") throw new EngineInputError(`${label}: 간지가 없음`)
  const { stem, branch } = p as { stem?: unknown; branch?: unknown }
  if (!isStem(stem)) throw new EngineInputError(`${label}: 알 수 없는 천간 ${String(stem)}`)
  if (!isBranch(branch)) throw new EngineInputError(`${label}: 알 수 없는 지지 ${String(branch)}`)
  if (STEMS.indexOf(stem) % 2 !== BRANCHES.indexOf(branch) % 2) throw new EngineInputError(`${label}: 있을 수 없는 간지 ${stem}${branch}`)
}

export function stemElement(s: Stem): Element {
  return STEM_ELEMENT[s]
}

export function stemYinYang(s: Stem): YinYang {
  return STEM_YINYANG[s]
}

export function branchElement(b: Branch): Element {
  return BRANCH_ELEMENT[b]
}

/** ⚑ 지지 음양 — branchYinYang 옵션 */
export function branchYinYang(b: Branch, basis: RuleOptions["branchYinYang"]): YinYang {
  return basis === "byMainQi" ? BRANCH_YINYANG_BY_MAIN_QI[b] : BRANCH_YINYANG_BY_ORDER[b]
}

const TEN_GOD_TABLE: readonly (readonly [TenGod, TenGod])[] = [
  ["비견", "겁재"], // rel 0 같은 오행
  ["식신", "상관"], // rel 1 일간이 생함
  ["편재", "정재"], // rel 2 일간이 극함
  ["편관", "정관"], // rel 3 일간을 극함
  ["편인", "정인"], // rel 4 일간을 생함
]

/** 십성: 일간 기준 대상(오행·음양)의 관계. rel = (t − d + 5) % 5, 음양 같으면 왼쪽 (rules-spec §4) */
export function tenGodOf(dayStem: Stem, target: { element: Element; yinYang: YinYang }): TenGod {
  const d = ELEMENTS.indexOf(stemElement(dayStem))
  const t = ELEMENTS.indexOf(target.element)
  const rel = (t - d + 5) % 5
  return TEN_GOD_TABLE[rel][stemYinYang(dayStem) === target.yinYang ? 0 : 1]
}

export function tenGodOfStem(dayStem: Stem, s: Stem): TenGod {
  return tenGodOf(dayStem, { element: stemElement(s), yinYang: stemYinYang(s) })
}

export function tenGodOfBranch(dayStem: Stem, b: Branch, basis: RuleOptions["branchYinYang"]): TenGod {
  return tenGodOf(dayStem, { element: branchElement(b), yinYang: branchYinYang(b, basis) })
}
