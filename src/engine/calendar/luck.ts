// 대운·세운 (P3-07) — 역법 객관값(간지 배열·시작 나이)만 계산한다. 해석은 rules/에서.
//
// 규칙(학파 선택 포함)
// 1) 순행 = (양간 연주 & 남) 또는 (음간 연주 & 여). 그 외 역행.
// 2) 대운수: 출생 순간 → 다음 節(순행) / 직전 節(역행)까지의 실제 경과 일수 ÷ 3 = 년 (3일 = 1년).
//    startAgeExact는 소수 그대로, startAge는 options.luckRounding("round" 반올림 / "floor" 버림).
//    0이 나오면 0으로 둔다(최솟값 1로 올리는 학파도 있음 — 보정하지 않음).
// 3) 대운 간지: 월주에서 60갑자 순서로 순행 +1, 역행 −1씩 10개.
// 4) n번째 대운 시작 만 나이 = startAge + 10(n−1),
//    시작 연도 = 출생 양력 연도 + 시작 만 나이.
//    [학파 차이] 세는나이로 대운수를 쓰는 만세력은 '출생 연도 + 대운수 − 1'로 적기도 하고,
//    대운수를 월 단위까지 환산해 시작 연·월을 쓰는 방식도 있다. 이 엔진은 만 나이 기준을 택했다.
import type { Daeun, Gender, Pillar, Stem } from "../types"
import { MS_PER_DAY, isYangStem, sexagenary, sexagenaryIndex } from "./constants"
import { jieAround } from "./solarterms"

export interface LuckParams {
  utcMs: number
  yearStem: Stem
  gender: Gender
  monthPillar: Pillar
  birthSolarYear: number
  rounding: "round" | "floor"
  count?: number
}

export interface LuckResult {
  direction: "forward" | "backward"
  startAge: number
  startAgeExact: number
  daeun: Daeun[]
  /** 대운수 계산에 쓴 節 */
  targetTermUtcMs: number
  targetTermName: string
}

export function luckDirection(yearStem: Stem, gender: Gender): "forward" | "backward" {
  const yang = isYangStem(yearStem)
  return (yang && gender === "M") || (!yang && gender === "F") ? "forward" : "backward"
}

export function computeLuck(p: LuckParams): LuckResult {
  const direction = luckDirection(p.yearStem, p.gender)
  const { prev, next } = jieAround(p.utcMs)
  const target = direction === "forward" ? next : prev
  const days = Math.abs(target.utcMs - p.utcMs) / MS_PER_DAY
  const startAgeExact = days / 3
  const startAge = p.rounding === "floor" ? Math.floor(startAgeExact) : Math.round(startAgeExact)
  const base = sexagenaryIndex(p.monthPillar)
  const step = direction === "forward" ? 1 : -1
  const daeun: Daeun[] = []
  for (let i = 1; i <= (p.count ?? 10); i++) {
    const age = startAge + 10 * (i - 1)
    daeun.push({ index: i, startAge: age, startYear: p.birthSolarYear + age, pillar: sexagenary(base + step * i) })
  }
  return { direction, startAge, startAgeExact, daeun, targetTermUtcMs: target.utcMs, targetTermName: target.name }
}
