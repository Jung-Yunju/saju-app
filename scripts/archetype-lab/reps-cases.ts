// 연구소장 대표 사주 24개 + 참고 3개 (docs/redesign/02-archetypes.md §5 표의 손계산 값 그대로).
// u 단위 = 엔진 값 × 30(천간 1.0 = 30u). 비율은 문서 기재 자릿수로 비교한다(reps.ts).
import type { Element, TenGodGroup } from "../../src/engine"

export type G = TenGodGroup
export interface Expect {
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
export interface Case { id: string; src: string; p: [string, string, string, string | null]; e: Expect; extra?: boolean }

export const CASES: Case[] = [
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
