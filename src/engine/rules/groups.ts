// P3-06 공통 도구: 십성 묶음(오행 관계), 반올림, 원국 글자 목록 (strength-structure-spec §0)
import type { Element, Pillar, Stem } from "../types"
import { ELEMENTS, stemElement } from "./basics"
import { hiddenStemsOf } from "./hidden"
import type { HiddenStem, HiddenStemTableId, NatalPillarKey, Position, TenGodGroup } from "./types"

export type Natal = { year: Pillar; month: Pillar; day: Pillar; hour: Pillar | null }

export const NATAL_KEYS: readonly NatalPillarKey[] = ["year", "month", "day", "hour"]
export const GROUPS: readonly TenGodGroup[] = ["bigyeop", "siksang", "jaeseong", "gwansal", "inseong"]
/** 오행 번호(목0 화1 토2 금3 수4) */
export const ei = (e: Element): number => ELEMENTS.indexOf(e)
export const el = (i: number): Element => ELEMENTS[((i % 5) + 5) % 5]

/** 일간 오행 d 기준 오행 e의 묶음: rel 0 비겁 · 1 식상 · 2 재성 · 3 관살 · 4 인성 (§0.2) */
export function groupOf(d: Element, e: Element): TenGodGroup {
  return GROUPS[(ei(e) - ei(d) + 5) % 5]
}

/** 묶음 → 오행 */
export function elementOfGroup(d: Element, g: TenGodGroup): Element {
  return el(ei(d) + GROUPS.indexOf(g))
}

export const isSupport = (g: TenGodGroup | "self"): boolean => g === "self" || g === "bigyeop" || g === "inseong"

/** 경계 비교 전 반올림(§0 수치) */
export const round6 = (x: number): number => {
  const r = Math.round(x * 1e6) / 1e6
  return r === 0 ? 0 : r // -0 제거
}
export const round1 = (x: number): number => Math.round(x * 10) / 10

/**
 * 표시 점수 = r×100, 소수 1자리(§1 점수). rules@0.3.1(Q-306-1):
 * r은 이미 round6을 거친 6자리 값이므로 정수(백만분율)로 바꿔 정수 산술로 반올림한다.
 * `round1(r*100)`은 0.5125×100 = 51.24999…처럼 곱셈 오차로 끝자리 5가 내려가 51.2가 되었다.
 * 반올림 방향은 round6과 같은 Math.round(절반은 올림, r ≥ 0). 판정 경계 비교는 r로만 하므로 영향 없음.
 */
export const scoreOfRatio = (r: number): number => {
  const micro = Math.round(r * 1e6) // 정확한 정수(r는 6자리)
  return Math.round(micro / 1000) / 10 // micro/1000의 .5는 정확히 표현되어 반올림이 흔들리지 않는다
}

export const stemPos = (k: NatalPillarKey): Position => ({ pillar: k, part: "stem" })
export const branchPos = (k: NatalPillarKey): Position => ({ pillar: k, part: "branch" })

/** 원국의 있는 기둥만(연→월→일→시) */
export function presentKeys(n: Natal): NatalPillarKey[] {
  return NATAL_KEYS.filter((k) => n[k] !== null)
}

/** 원국 지장간 전부(연→월→일→시, 지지마다 여기→중기→정기) */
export function natalHidden(n: Natal, table: HiddenStemTableId): { key: NatalPillarKey; h: HiddenStem }[] {
  const out: { key: NatalPillarKey; h: HiddenStem }[] = []
  for (const k of presentKeys(n)) for (const h of hiddenStemsOf((n[k] as Pillar).branch, table)) out.push({ key: k, h })
  return out
}

/** 일간을 뺀 원국 천간(연·월·시) */
export function otherStems(n: Natal): { key: NatalPillarKey; stem: Stem }[] {
  return (["year", "month", "hour"] as const).filter((k) => n[k] !== null).map((k) => ({ key: k, stem: (n[k] as Pillar).stem }))
}

/** 지지 정기 천간(표마다 정기 글자는 같다) */
export function mainQiOf(p: Pillar, table: HiddenStemTableId): Stem {
  const hs = hiddenStemsOf(p.branch, table)
  return (hs.find((h) => h.role === "jeonggi") as HiddenStem).stem
}

export function mainQiElement(p: Pillar, table: HiddenStemTableId): Element {
  return stemElement(mainQiOf(p, table))
}
