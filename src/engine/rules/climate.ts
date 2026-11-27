// 간이 조후 — 계절 한난조습 climate-v1 (strength-structure-spec §4, rules@0.3.0)
// 궁통보감 조후표가 아니다. 지지 기본값·계수·분류 경계는 모두 연구소장 설계값(근거 미확보)이다.
import type { Branch, Pillar, Stem } from "../types"
import { branchPos, presentKeys, stemPos, type Natal } from "./groups"
import type { ClimateResult } from "./types"

export const CLIMATE_SOURCE = "climate-v1 (연구소장 설계, 궁통보감 표 미적용)"

/** §4.1 지지 기본값 [온도 t, 습도 m] */
export const CLIMATE_BRANCH: Readonly<Record<Branch, readonly [number, number]>> = {
  子: [-2, 2], 丑: [-2, 1], 寅: [-1, 0], 卯: [0, 0], 辰: [0, 1], 巳: [1, -1],
  午: [2, -2], 未: [2, -1], 申: [1, 0], 酉: [0, 0], 戌: [0, -1], 亥: [-1, 1],
}

const WARM_STEMS: readonly Stem[] = ["丙", "丁"]
const WET_STEMS: readonly Stem[] = ["壬", "癸"]

export function tClassOf(T: number): ClimateResult["tClass"] {
  if (T <= -2) return "한강"
  if (T <= -1) return "한"
  if (T < 1) return "중"
  if (T < 2) return "난"
  return "열강"
}

export function mClassOf(M: number): ClimateResult["mClass"] {
  if (M >= 2) return "습강"
  if (M >= 1) return "습"
  if (M > -1) return "중"
  if (M > -2) return "조"
  return "조강"
}

/**
 * T = t(월지) + 0.5 × Σ t(그 밖의 원국 지지) + 0.5 × (丙·丁 천간 수 − 壬·癸 천간 수)
 * M = m(월지) + 0.5 × Σ m(그 밖의 원국 지지) + 0.5 × (壬·癸 천간 수 − 丙·丁 천간 수)
 * 천간에는 일간을 포함한다. 시주 모름이면 세 기둥만(정규화 없음). 값은 모두 0.5의 배수라 부동소수 오차가 없다.
 */
export function analyzeClimate(n: Natal): ClimateResult {
  const basis: ClimateResult["basis"] = []
  let T = 0
  let M = 0
  for (const k of presentKeys(n)) {
    const p = n[k] as Pillar
    const sdT = WARM_STEMS.includes(p.stem) ? 0.5 : WET_STEMS.includes(p.stem) ? -0.5 : 0
    basis.push({ position: stemPos(k), char: p.stem, dT: sdT, dM: -sdT === 0 ? 0 : -sdT })
    const f = k === "month" ? 1 : 0.5
    const [t, m] = CLIMATE_BRANCH[p.branch]
    const bdT = f * t === 0 ? 0 : f * t
    const bdM = f * m === 0 ? 0 : f * m
    basis.push({ position: branchPos(k), char: p.branch, dT: bdT, dM: bdM })
    T += sdT + bdT
    M += -sdT + bdM
  }
  T = T === 0 ? 0 : T
  M = M === 0 ? 0 : M
  const needs: ClimateResult["needs"] = []
  if (T <= -1) needs.push("warm")
  if (T >= 1) needs.push("cool")
  if (M >= 1) needs.push("dry")
  if (M <= -1) needs.push("moisten")
  return {
    T, M,
    tClass: tClassOf(T),
    mClass: mClassOf(M),
    needs,
    basis,
    pillarsUsed: n.hour ? 4 : 3,
    ruleId: "climate.v1",
    source: CLIMATE_SOURCE,
  }
}
