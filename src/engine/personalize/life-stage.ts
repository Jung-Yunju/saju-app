// 출생 정보·기준 시각 → 만 나이·인생 단계·대운 구간 (P4-01). 순수 함수.
// 나이 경계는 한국 사회 일반 경로를 단순화한 "대략의 구간"이다(개인 경로는 다르다). 근거: docs/knowledge/personalization/life-stages.md
import type { CalendarResult } from "../types"
import type { DaeunPosition, DaeunSlot, EraMark, LifeStage, LifeStageId } from "./types"

export const LIFE_STAGES: readonly LifeStage[] = [
  { id: "early_childhood", label: "영유아기", minAge: 0, maxAge: 6 },
  { id: "elementary", label: "초등 학령기", minAge: 7, maxAge: 12 },
  { id: "secondary", label: "중·고등 학령기", minAge: 13, maxAge: 18 },
  { id: "young_adult", label: "청년 초기(대학·군·첫 취업 준비)", minAge: 19, maxAge: 24 },
  { id: "early_career", label: "사회 진입·결혼·출산기", minAge: 25, maxAge: 34 },
  { id: "establishment", label: "자리 잡기·육아·책임기", minAge: 35, maxAge: 44 },
  { id: "midlife_transition", label: "중년 전환기", minAge: 45, maxAge: 54 },
  { id: "pre_retirement", label: "은퇴 준비·전환기", minAge: 55, maxAge: 64 },
  { id: "senior", label: "은퇴 이후", minAge: 65, maxAge: null },
]

export interface YMD {
  year: number
  month: number
  day: number
}

/** 기준 시각을 한국(UTC+9) 달력 날짜로. 한국 법정 만 나이 기준일과 맞춘다. */
export function koreanDateOf(now: Date): YMD {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new RangeError("now가 올바른 Date가 아님")
  const k = new Date(now.getTime() + 9 * 3600 * 1000)
  return { year: k.getUTCFullYear(), month: k.getUTCMonth() + 1, day: k.getUTCDate() }
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

/**
 * 만 나이. 생일이 지나야 한 살이 더해진다. 2월 29일생은 평년에는 3월 1일에 나이를 더한다(엔진 선택 — 법적 해석이 갈릴 수 있음).
 * 출생일이 기준일보다 뒤면 RangeError.
 */
export function manAge(birth: YMD, on: YMD): number {
  let bm = birth.month
  let bd = birth.day
  if (bm === 2 && bd === 29 && !isLeap(on.year)) {
    bm = 3
    bd = 1
  }
  let age = on.year - birth.year
  if (on.month < bm || (on.month === bm && on.day < bd)) age -= 1
  if (age < 0) throw new RangeError("출생일이 기준일보다 뒤")
  return age
}

export function lifeStageOfAge(age: number): LifeStage {
  if (!Number.isInteger(age) || age < 0) throw new RangeError(`만 나이는 0 이상 정수여야 함: ${String(age)}`)
  for (const s of LIFE_STAGES) {
    if (s.maxAge === null || age <= s.maxAge) return s
  }
  return LIFE_STAGES[LIFE_STAGES.length - 1]!
}

/** 나이 구간 [from, to](포함)과 겹치는 인생 단계 id들 */
export function stagesInAgeRange(from: number, to: number): LifeStageId[] {
  const out: LifeStageId[] = []
  for (const s of LIFE_STAGES) {
    const max = s.maxAge === null ? Infinity : s.maxAge
    if (s.minAge <= to && max >= from) out.push(s.id)
  }
  return out
}

function slotOf(d: CalendarResult["luck"]["daeun"][number]): DaeunSlot {
  const ageFrom = d.startAge
  const ageTo = d.startAge + 9
  return {
    index: d.index,
    pillar: { stem: d.pillar.stem, branch: d.pillar.branch },
    ageFrom,
    ageTo,
    yearFrom: d.startYear,
    yearTo: d.startYear + 9,
    lifeStages: stagesInAgeRange(ageFrom, ageTo),
  }
}

/**
 * 만 나이가 어느 대운 구간인지. 각 대운은 [startAge, startAge+9] (만 나이, 정수) 10년.
 * 첫 대운 시작 전이면 phase "before"(next = 첫 대운), 계산된 대운이 끝났으면 "after".
 */
export function locateDaeun(chart: CalendarResult, age: number): DaeunPosition {
  if (!Number.isInteger(age) || age < 0) throw new RangeError(`만 나이는 0 이상 정수여야 함: ${String(age)}`)
  const list = chart.luck.daeun
  if (list.length === 0) return { phase: "after", current: null, next: null }
  const first = list[0]!
  if (age < first.startAge) return { phase: "before", current: null, next: slotOf(first) }
  for (let i = 0; i < list.length; i++) {
    const d = list[i]!
    if (age >= d.startAge && age <= d.startAge + 9) {
      const n = list[i + 1]
      return { phase: "in", current: slotOf(d), next: n ? slotOf(n) : null }
    }
  }
  return { phase: "after", current: null, next: null }
}

// ─────────────────────────────────────────── 시대 배경 (확실한 사실만)
// 연도는 공식 기록으로 널리 확인되는 것만 둔다. 성격 규정("○○세대는 ~하다")은 두지 않는다.
export const ERA_EVENTS: readonly { id: string; year: number; label: string }[] = [
  { id: "korean-war-start", year: 1950, label: "6·25 전쟁 발발" },
  { id: "korean-war-armistice", year: 1953, label: "6·25 전쟁 정전 협정" },
  { id: "seoul-olympics", year: 1988, label: "서울 올림픽 개최" },
  { id: "imf-crisis", year: 1997, label: "외환위기(IMF 구제금융 요청)" },
  { id: "worldcup-2002", year: 2002, label: "한일 월드컵 개최" },
  { id: "global-financial-crisis", year: 2008, label: "글로벌 금융위기" },
  { id: "covid-19", year: 2020, label: "코로나19 유행 시작" },
  { id: "man-age-unified", year: 2023, label: "법정·사회 연령을 만 나이로 통일" },
]

/** 태어난 뒤부터 기준 연도까지 있었던 사건과 그 해 연말 기준 만 나이 */
export function eraBackgroundOf(birthYear: number, nowYear: number): EraMark[] {
  return ERA_EVENTS.filter((e) => e.year >= birthYear && e.year <= nowYear).map((e) => ({
    source: "era" as const,
    id: e.id,
    year: e.year,
    label: e.label,
    ageAtYearEnd: e.year - birthYear,
  }))
}
