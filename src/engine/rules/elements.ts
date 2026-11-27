// 오행 분포 (rules-spec §9)
//  counts  : 천간(시주 모름이면 3) + 지지 정기(= 지지 본래 오행) 글자 수. 일간 포함.
//  weighted: 천간 각 1.0 + 지지 = 위치 가중 × 지장간 weight 를 지장간 오행별로 배분.
//            위치 가중은 schools.md §8 weighted-v1(월지 3.0 · 일지 1.5 · 연지·시지 1.0 · 천간 1.0) —
//            연구소장 설계값이며 고전 수치가 아니다(잠정). 일간도 천간 1.0으로 넣는다(counts와 같은 범위, 엔진 개발자 판단).
//            합충에 따른 보정은 하지 않는다.
import type { Element, Pillar } from "../types"
import { ELEMENTS, branchElement, branchYinYang, stemElement, stemYinYang } from "./basics"
import { hiddenStemsOf } from "./hidden"
import type { ElementDistribution, ElementRecord, NatalPillarKey, RuleOptions } from "./types"

export const WEIGHTED_V1 = Object.freeze({ stem: 1.0, yearBranch: 1.0, monthBranch: 3.0, dayBranch: 1.5, hourBranch: 1.0 })

const BRANCH_WEIGHT_KEY = {
  year: "yearBranch",
  month: "monthBranch",
  day: "dayBranch",
  hour: "hourBranch",
} as const satisfies Record<NatalPillarKey, keyof typeof WEIGHTED_V1>

function zero(): ElementRecord {
  return { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 }
}

const round6 = (x: number) => Math.round(x * 1e6) / 1e6

export function elementDistribution(
  natal: { year: Pillar; month: Pillar; day: Pillar; hour: Pillar | null },
  o: Pick<RuleOptions, "hiddenStemTable" | "strengthModel" | "branchYinYang">,
): ElementDistribution {
  const counts = zero()
  const weighted = zero()
  let yang = 0
  let yin = 0
  const keys: NatalPillarKey[] = ["year", "month", "day", "hour"]
  for (const k of keys) {
    const p = natal[k]
    if (!p) continue
    counts[stemElement(p.stem)] += 1
    counts[branchElement(p.branch)] += 1
    weighted[stemElement(p.stem)] += WEIGHTED_V1.stem
    const w = WEIGHTED_V1[BRANCH_WEIGHT_KEY[k]]
    for (const h of hiddenStemsOf(p.branch, o.hiddenStemTable)) weighted[stemElement(h.stem)] += w * h.weight
    if (stemYinYang(p.stem) === "yang") yang++
    else yin++
    if (branchYinYang(p.branch, o.branchYinYang) === "yang") yang++
    else yin++
  }
  for (const e of ELEMENTS as readonly Element[]) weighted[e] = round6(weighted[e])
  return {
    counts,
    weighted,
    hiddenStemTable: o.hiddenStemTable,
    strengthModel: o.strengthModel,
    positionWeights: { ...WEIGHTED_V1 },
    yinYang: { yang, yin, branchYinYang: o.branchYinYang },
  }
}
