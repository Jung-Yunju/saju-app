// 사주엔진 공통 데이터 구조 (P3-01) — 직원 간 계약서
// 변경 시: 총괄실장 승인 + docs/SAJU_ENGINE.md 갱신 + engineVersion 올림
// 원칙: 역법 객관값(CalendarResult)과 명리 해석값(RuleAnalysis, 별도 모듈)을 섞지 않는다.

export type Stem = "甲" | "乙" | "丙" | "丁" | "戊" | "己" | "庚" | "辛" | "壬" | "癸"
export type Branch = "子" | "丑" | "寅" | "卯" | "辰" | "巳" | "午" | "未" | "申" | "酉" | "戌" | "亥"
export type Element = "wood" | "fire" | "earth" | "metal" | "water"
export type Gender = "M" | "F"

export interface Pillar {
  stem: Stem
  branch: Branch
}

/** 고객 입력. 시각은 출생지의 법정 현지시각(벽시계 시각) 그대로 받는다. */
export interface BirthInput {
  calendar: "solar" | "lunar"
  year: number
  month: number
  day: number
  /** 음력 입력일 때만 의미 있음. 윤달이면 true */
  isLeapMonth?: boolean
  /** null = 태어난 시각 모름 */
  time: { hour: number; minute: number } | null
  /** IANA 시간대. 기본 "Asia/Seoul" (표준시 변경·서머타임 이력 포함) */
  timezone?: string
  /** 출생지 경도(동경, 도). 없으면 options.defaultLongitude */
  longitude?: number
  gender: Gender
}

export interface EngineOptions {
  /**
   * 23시대(子時 전반) 처리
   * - "nextDay": 23:00부터 다음 날 일주로 본다 (子初換日)
   * - "yajasi": 야자시 — 일주는 당일, 시주 천간은 다음 날 일간 기준
   * 잠정 기본값 "nextDay" — 대표·연구소장 확정 대기 (docs/DECISIONS.md)
   */
  ziHour: "nextDay" | "yajasi"
  /** 진태양시(경도 보정) 적용 여부. 시주·일주 판정에만 영향 (절기는 UTC 순간으로 비교) */
  trueSolarTime: boolean
  /** 출생지 경도 미입력 시 사용 (서울 126.978) */
  defaultLongitude: number
  /** 진태양시 적용 시 균시차(equation of time)까지 반영할지 */
  equationOfTime: boolean
  /** 대운수 환산(3일 = 1년)의 나머지 처리 */
  luckRounding: "round" | "floor"
}

export const DEFAULT_OPTIONS: EngineOptions = {
  ziHour: "nextDay",
  trueSolarTime: true,
  defaultLongitude: 126.978,
  equationOfTime: false,
  luckRounding: "round",
}

export interface SolarTermPoint {
  /** 절기 한자명 예: "立春" */
  name: string
  /** ISO-8601 UTC, 분 단위 이상 정밀도 */
  utc: string
}

export interface Daeun {
  /** 1부터 */
  index: number
  /** 대운이 시작되는 만 나이(년) */
  startAge: number
  /** 대운이 시작되는 양력 연도 */
  startYear: number
  pillar: Pillar
}

/** ① 역법 객관값. 해석을 담지 않는다. */
export interface CalendarResult {
  engineVersion: string
  options: EngineOptions
  input: BirthInput
  hourKnown: boolean
  /** 출생 순간(UTC ISO). 시각 모름이면 현지 정오를 가정한 값이며 warnings에 표시 */
  utcInstant: string
  corrections: {
    /** 출생 순간 해당 지역의 UTC 오프셋(분, 서머타임 포함) 예: 1987-07 서울 = 600 */
    utcOffsetMinutes: number
    /** 서머타임 적용 시각이었는지 */
    dstApplied: boolean
    /** 법정시 → 진태양시 보정량(분). 미적용이면 0 */
    solarTimeMinutes: number
  }
  /** 양력 날짜(현지 법정시 기준) */
  solarDate: { year: number; month: number; day: number }
  /** 음력 날짜 */
  lunarDate: { year: number; month: number; day: number; isLeapMonth: boolean }
  pillars: { year: Pillar; month: Pillar; day: Pillar; hour: Pillar | null }
  /** 월주를 정한 직전 절(節)과 다음 절 */
  solarTerm: { prev: SolarTermPoint; next: SolarTermPoint }
  luck: {
    direction: "forward" | "backward"
    /** 대운수(년) — options.luckRounding 적용 */
    startAge: number
    /** 환산 전 정밀 값(년, 소수) */
    startAgeExact: number
    daeun: Daeun[]
  }
  /** 예: "절입 시각 2시간 이내 출생 — 월주 경계", "태어난 시각 모름 — 정오 가정" */
  warnings: string[]
}

/** 입력 오류(존재하지 않는 날짜, 윤달 없는 해의 윤달 등) */
export class EngineInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "EngineInputError"
  }
}
