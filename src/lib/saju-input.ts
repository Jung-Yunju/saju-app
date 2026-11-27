// Claude용 사주 입력 JSON 생성 + 결과 화면용 원국 표시 변환
// 계산은 전부 새 사주엔진(src/engine, computeChart 기본 옵션)으로 한다.
//   - 연주·월주: 절입 UTC 순간 기준(한국 시간대 이력·서머타임 반영)
//   - 일주·시주: 진태양시(출생지 경도, 없으면 서울) 보정, 23시 이후는 다음 날 일주(엔진 기본값)
//   - 음력: 한국 음력(UTC+9 판정), 윤달은 isLeapMonth
//   - 공망: 일주·연주 기준 旬空(src/engine/rules/gongmang.ts)
// 시각 입력(U-03): exact = 시:분 그대로 / sijin = 시진 선택 → 대표 시각(시진 가운데, sijinRepresentativeTime)
// 결과 화면은 저장된 sajuInput.pillars(=AI가 실제로 본 글자)를 우선 표시한다(resolveDisplaySaju).
import {
  computeChart,
  EngineInputError,
  gongmangString,
  RULES_ENGINE_VERSION,
  yearPillarOf,
  type BirthInput,
  type Branch,
  type CalendarResult,
  type Pillar,
  type Stem,
} from "@/engine"
import { resolveTimeMode, type BirthPrecision } from "@/lib/validate"

export type TimeMode = "exact" | "sijin"

export interface BirthplaceInfo {
  name: string
  /** 동경(도) */
  longitude: number
}

export interface SajuInputData {
  name?: string
  gender: string
  /** 양력(현지 법정시) 날짜·시각. 예: "2024-02-04 17:00", 시각 모름이면 날짜만 */
  birth: string
  calendar: string
  /** 한자 간지 예: "甲辰". 시각 모름이면 hour 없음 */
  pillars: { year: string; month: string; day: string; hour?: string }
  hour_unknown: boolean
  daeun: { start_year: number; start_age: number; ganzhi: string }[]
  gongmang: { day: string; year: string }
  this_year: number
  this_year_ganzhi: string
  known_facts: string[]
  voice: string
  /** 엔진 경고(절입·시지 경계, 시각 모름 등). 예전 저장 데이터에는 없음 */
  warnings?: string[]
  /** 계산에 쓴 엔진 버전 예: "calendar@0.1.1+rules@0.1.0". 예전 저장 데이터에는 없음 */
  engine_version?: string
  /**
   * 시각 입력 방식(U-03). exact = birth의 시:분이 실제 입력, sijin = 시진만 고름(birth의 시:분은 대표 시각).
   * 예전 저장 데이터·시각 입력 방식을 넘기지 않은 호출에는 없음
   */
  time_mode?: TimeMode
  /** 사용자가 입력한 분(exact). 시진 선택·시각 모름·분 미입력이면 null. time_mode와 함께만 기록 */
  birth_minute?: number | null
  /** 진태양시 보정에 쓴 출생지. 없으면 서울 경도(126.978)로 계산 */
  birthplace?: BirthplaceInfo
}

export interface BuildSajuInputOptions {
  /** '올해' 판정 기준 시각(테스트 주입용). 기본: 현재 시각 */
  now?: Date
  /** 분(0~59). exact(또는 timeMode 생략)일 때만. 기본 0. 시각 모름이면 null이어야 함 */
  minute?: number | null
  /**
   * 시각 입력 방식. 생략 = 예전 동작(hour:minute 그대로, time_mode·birth_minute 기록 안 함).
   * "sijin"이면 hour는 짝수(0=자시, 2=축시 … 22=해시)이고 minute은 비워야 한다.
   */
  timeMode?: TimeMode
  /** sijin + 자시(hour 0)에서만: true = 자정 전 밤(23:45), false = 자정 후(00:45), 생략 = 00:00 + 경고 */
  ziNight?: boolean
  /** 출생지(경도 보정·기록). longitude와 함께 쓸 수 없음 */
  birthplace?: BirthplaceInfo | null
  /** 경도만 넘길 때(기록하지 않음). birthplace와 함께 쓸 수 없음 */
  longitude?: number
}

const DAEUN_COUNT = 8
const SEOUL = "Asia/Seoul"
const seoulYearFormatter = new Intl.DateTimeFormat("en-US", { timeZone: SEOUL, year: "numeric" })

const ganzhi = (p: Pillar): string => p.stem + p.branch

/** 기준 시각의 서울 날짜 기준 양력 연도 */
export function seoulYearOf(now: Date): number {
  const t = now.getTime()
  if (!Number.isFinite(t)) throw new Error("기준 시각(now)이 올바른 Date가 아님")
  return Number(seoulYearFormatter.format(now))
}

/** 라우트 입력 → 엔진 입력. 형식이 틀리면 EngineInputError */
function toBirthInput(
  year: number,
  month: number,
  day: number,
  time: { hour: number; minute: number } | null,
  gender: string,
  calType: string,
  isLeapMonth: boolean,
  longitude?: number,
): BirthInput {
  if (calType !== "SOLAR" && calType !== "LUNAR") throw new EngineInputError(`calType 값 오류: ${String(calType)}`)
  if (gender !== "M" && gender !== "F") throw new EngineInputError(`gender 값 오류: ${String(gender)}`)
  return {
    calendar: calType === "LUNAR" ? "lunar" : "solar",
    year,
    month,
    day,
    isLeapMonth,
    time,
    timezone: SEOUL,
    ...(longitude !== undefined ? { longitude } : {}),
    gender,
  }
}

const pad2 = (n: number) => String(n).padStart(2, "0")

/**
 * 시진 선택 → 계산에 쓸 대표 시각(현지 법정시). 시진 구간은 한국 표준시(UTC+9) 기준 30분 늦춘 표:
 * 자시 23:30~01:29, 축시 01:30~03:29 … 해시 21:30~23:29. 화면은 시진마다 짝수 시를 보낸다(자시 0, 축시 2 … 해시 22).
 * - 축시~해시: 그 시진의 가운데 = 짝수 시 + 30분 (예: 축시 → 02:30). 예전처럼 짝수 정각(02:00)을 쓰면
 *   진태양시(서울 약 −32분) 보정 후 01:28이 되어 시진 시작에 가깝다.
 * - 자시: 자정에서 날짜가 갈리므로 두 부분의 가운데를 쓴다.
 *   ziNight true = 자정 전 23:30~23:59 → 23:45 (서울 보정 후 23:13, 子시·다음 날 일주)
 *   ziNight false = 자정 후 00:00~01:29 → 00:45 (보정 후 00:13, 子시·그날 일주 — 야자시 설정에서도 같은 날)
 *   ziNight 생략 = 예전 동작 그대로 00:00 (호출 쪽이 "자시 날짜 경계 불확실" 경고를 붙인다)
 *   ※ 23:30을 쓰면 보정 후 22:58 → 亥시가 되어 자시를 고른 의미가 없어진다(테스트로 고정).
 */
export function sijinRepresentativeTime(hour: number, ziNight?: boolean): { hour: number; minute: number } {
  if (!Number.isInteger(hour) || hour < 0 || hour > 22 || hour % 2 !== 0) {
    throw new EngineInputError(`시진 선택 값은 0~22 짝수: ${String(hour)}`)
  }
  if (ziNight !== undefined && typeof ziNight !== "boolean") throw new EngineInputError("ziNight는 boolean")
  if (hour === 0) {
    if (ziNight === true) return { hour: 23, minute: 45 }
    if (ziNight === false) return { hour: 0, minute: 45 }
    return { hour: 0, minute: 0 }
  }
  return { hour, minute: 30 }
}

export const ZI_BOUNDARY_WARNING =
  "자시 날짜 경계 불확실 — 자정 전(밤 23:30~24:00) 출생이면 일주·시주가 달라질 수 있음(자정 00:00 출생으로 가정해 계산)"

interface ResolvedTime {
  time: { hour: number; minute: number } | null
  mode: TimeMode | undefined
  /** 시진 선택이면 고른 시지 */
  sijinBranch: Branch | null
  notes: string[]
}

function resolveTime(hour: number | null, options: BuildSajuInputOptions): ResolvedTime {
  const { timeMode, minute, ziNight } = options
  if (timeMode !== undefined && timeMode !== "exact" && timeMode !== "sijin") {
    throw new EngineInputError(`timeMode 값 오류: ${String(timeMode)}`)
  }
  if (ziNight !== undefined && typeof ziNight !== "boolean") throw new EngineInputError("ziNight는 boolean")
  const hasMinute = minute !== undefined && minute !== null
  if (hour === null) {
    if (hasMinute) throw new EngineInputError("시각 모름인데 분이 있음")
    // 시각 모름: 입력 방식은 의미가 없으므로 기록하지 않는다(hour_unknown이 대신 알려 줌)
    return { time: null, mode: undefined, sijinBranch: null, notes: [] }
  }
  if (timeMode !== "sijin") return { time: { hour, minute: hasMinute ? minute : 0 }, mode: timeMode, sijinBranch: null, notes: [] }

  if (hasMinute) throw new EngineInputError("시진 선택에는 분을 넣지 않음")
  const t = sijinRepresentativeTime(hour, ziNight)
  const branch = BRANCH_LIST[hour / 2]
  const label = `${BRANCH_KO[branch]}시${hour === 0 && ziNight !== undefined ? (ziNight ? "(자정 전 밤)" : "(자정 후)") : ""}`
  const notes =
    hour === 0 && ziNight === undefined
      ? [ZI_BOUNDARY_WARNING]
      : [`시진 선택(${label}) — 정확한 분을 몰라 시진 가운데 ${pad2(t.hour)}:${pad2(t.minute)}로 계산`]
  return { time: t, mode: "sijin", sijinBranch: branch, notes }
}

function birthString(chart: CalendarResult): string {
  const { year, month, day } = chart.solarDate
  const t = chart.input.time
  return `${year}-${pad2(month)}-${pad2(day)}${t ? ` ${pad2(t.hour)}:${pad2(t.minute)}` : ""}`
}

/**
 * 출생 정보 → Claude용 사주 입력.
 * 입력이 틀리면(존재하지 않는 날짜, 그 해에 없는 윤달, 범위 밖 연도·시각) EngineInputError를 던진다
 * → 호출 라우트가 400으로 처리한다. 그 밖의 예외는 엔진 결함이므로 라우트가 500으로 처리한다.
 * options를 생략하면 예전과 똑같이 hour:00으로 계산한다(분·출생지·시진 변환 없음).
 */
export function buildSajuInput(
  year: number,
  month: number,
  day: number,
  hour: number | null,
  gender: string,
  calType: string,
  name?: string,
  isLeapMonth = false,
  options: BuildSajuInputOptions = {},
): SajuInputData {
  if (typeof isLeapMonth !== "boolean") throw new EngineInputError("isLeapMonth는 boolean")
  if (options.birthplace && options.longitude !== undefined) {
    throw new EngineInputError("birthplace와 longitude를 함께 넘길 수 없음")
  }
  const birthplace = options.birthplace ?? undefined
  const longitude = birthplace ? birthplace.longitude : options.longitude
  const resolved = resolveTime(hour, options)
  const chart = computeChart(
    toBirthInput(year, month, day, resolved.time, gender, calType, isLeapMonth, longitude),
  )
  const { pillars: pc } = chart

  const warnings = [...chart.warnings, ...resolved.notes]
  if (resolved.sijinBranch && pc.hour && pc.hour.branch !== resolved.sijinBranch) {
    warnings.push(
      `선택한 시진(${BRANCH_KO[resolved.sijinBranch]}시)과 계산된 시지(${pc.hour.branch})가 다름 — ` +
        "서머타임·표준시 변경 시기 또는 출생지 경도 영향. 정확한 시:분 입력 권장",
    )
  }

  const pillars: SajuInputData["pillars"] = {
    year: ganzhi(pc.year),
    month: ganzhi(pc.month),
    day: ganzhi(pc.day),
  }
  if (pc.hour) pillars.hour = ganzhi(pc.hour)

  const thisYear = seoulYearOf(options.now ?? new Date())

  return {
    name,
    gender: gender === "M" ? "남" : "여",
    birth: birthString(chart),
    calendar: calType === "LUNAR" ? (isLeapMonth ? "음력(윤달)" : "음력") : "양력",
    pillars,
    hour_unknown: !chart.hourKnown,
    daeun: chart.luck.daeun.slice(0, DAEUN_COUNT).map((d) => ({
      start_year: d.startYear,
      start_age: d.startAge,
      ganzhi: ganzhi(d.pillar),
    })),
    gongmang: {
      day: gongmangString(pc.day),
      year: gongmangString(pc.year),
    },
    this_year: thisYear,
    this_year_ganzhi: ganzhi(yearPillarOf(thisYear)),
    known_facts: [],
    voice: "할미",
    warnings,
    engine_version: `${chart.engineVersion}+${RULES_ENGINE_VERSION}`,
    ...(resolved.mode !== undefined
      ? {
          time_mode: resolved.mode,
          birth_minute: resolved.mode === "exact" ? (options.minute ?? null) : null,
        }
      : {}),
    ...(birthplace ? { birthplace: { name: birthplace.name, longitude: birthplace.longitude } } : {}),
  }
}

/** 검증된 요청(src/lib/validate.ts)의 한 사람 정보. 본인은 birth* 이름을, 상대방은 짧은 이름을 바꿔 넘긴다 */
export interface SajuRequestPerson extends BirthPrecision {
  year: number
  month: number
  day: number
  hour: number | null
  gender: string
  calType: string
}

/**
 * 라우트용: 검증된 요청 → buildSajuInput. 시각 입력 방식은 resolveTimeMode 규칙으로 정해 항상 기록한다
 * (timeMode 없는 예전 요청: 짝수 시 = 시진, 홀수 시·분 있음 = 그 시각).
 */
export function buildSajuInputFromRequest(
  p: SajuRequestPerson,
  name?: string,
  options: Pick<BuildSajuInputOptions, "now"> = {},
): SajuInputData {
  const mode = resolveTimeMode(p.hour, p) ?? undefined // 시각 모름이면 undefined
  return buildSajuInput(p.year, p.month, p.day, p.hour, p.gender, p.calType, name, p.isLeapMonth === true, {
    ...options,
    timeMode: mode,
    minute: mode === "exact" ? (p.birthMinute ?? null) : null,
    ...(p.ziNight !== undefined ? { ziNight: p.ziNight } : {}),
    birthplace: p.birthplace ?? null,
  })
}

/** 만세력 계산이 입력 때문에 실패했을 때 사용자에게 보여 줄 문구(400) */
export const SAJU_INPUT_ERROR_MESSAGE =
  "입력한 생년월일로 사주를 계산할 수 없습니다. 날짜(음력이면 윤달 여부 포함)를 확인해 주세요."

// ─── 결과 화면 표시용 변환 ─────────────────────────────────────────────────

const STEM_KO: Record<Stem, string> = {
  甲: "갑", 乙: "을", 丙: "병", 丁: "정", 戊: "무", 己: "기", 庚: "경", 辛: "신", 壬: "임", 癸: "계",
}
const BRANCH_KO: Record<Branch, string> = {
  子: "자", 丑: "축", 寅: "인", 卯: "묘", 辰: "진", 巳: "사", 午: "오", 未: "미", 申: "신", 酉: "유", 戌: "술", 亥: "해",
}
/** 천간 오행 */
const STEM_EL: Record<Stem, string> = {
  甲: "목", 乙: "목", 丙: "화", 丁: "화", 戊: "토", 己: "토", 庚: "금", 辛: "금", 壬: "수", 癸: "수",
}
/** 지지 오행(정기 기준 — rules-spec §9 counts와 같은 기준) */
const BRANCH_EL: Record<Branch, string> = {
  子: "수", 丑: "토", 寅: "목", 卯: "목", 辰: "토", 巳: "화", 午: "화", 未: "토", 申: "금", 酉: "금", 戌: "토", 亥: "수",
}
const STEM_LIST = Object.keys(STEM_KO) as Stem[]
const BRANCH_LIST = Object.keys(BRANCH_KO) as Branch[]
const FIVE_ELEMENTS = ["목", "화", "토", "금", "수"] as const

/** 화면 컴포넌트(ReadingViewer)가 기대하는 형태: 한글 글자·한글 오행 */
export interface DisplayPillar {
  label: string
  stem: string
  branch: string
  element: string
  branchEl: string
  me?: boolean
}

export interface DisplaySaju {
  pillars: DisplayPillar[]
  fiveElements: { el: string; count: number }[]
  /** stored = 저장된 sajuInput.pillars(AI가 본 글자) · engine = 새 엔진 계산 · none = 계산 불가 */
  source: "stored" | "engine" | "none"
}

/** "甲辰" → Pillar. 두 글자가 아니거나 천간·지지 음양이 맞지 않으면 null */
export function parseGanzhi(v: unknown): Pillar | null {
  if (typeof v !== "string") return null
  const chars = [...v]
  if (chars.length !== 2) return null
  const s = STEM_LIST.indexOf(chars[0] as Stem)
  const b = BRANCH_LIST.indexOf(chars[1] as Branch)
  if (s < 0 || b < 0 || s % 2 !== b % 2) return null
  return { stem: STEM_LIST[s], branch: BRANCH_LIST[b] }
}

function toDisplay(p: { year: Pillar; month: Pillar; day: Pillar; hour: Pillar | null }, source: DisplaySaju["source"]): DisplaySaju {
  const row = (label: string, x: Pillar, me?: boolean): DisplayPillar => ({
    label,
    stem: STEM_KO[x.stem],
    branch: BRANCH_KO[x.branch],
    element: STEM_EL[x.stem],
    branchEl: BRANCH_EL[x.branch],
    ...(me ? { me: true } : {}),
  })
  const pillars = [
    row("연주", p.year),
    row("월주", p.month),
    row("일주", p.day, true),
    ...(p.hour ? [row("시주", p.hour)] : []),
  ]
  const fiveElements = FIVE_ELEMENTS.map((el) => ({
    el,
    count: pillars.reduce((n, x) => n + (x.element === el ? 1 : 0) + (x.branchEl === el ? 1 : 0), 0),
  }))
  return { pillars, fiveElements, source }
}

/**
 * 저장된 sajuInput(JSON)에서 원국 표시값을 만든다. 연·월·일주가 모두 올바른 간지일 때만 사용.
 * hour_unknown이 true이거나 hour가 없으면 시주를 표시하지 않는다. 시주 글자가 깨져 있으면 null(전체 재계산).
 */
export function displaySajuFromStored(raw: unknown): DisplaySaju | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null
  const r = raw as { pillars?: unknown; hour_unknown?: unknown }
  if (typeof r.pillars !== "object" || r.pillars === null || Array.isArray(r.pillars)) return null
  const p = r.pillars as Record<string, unknown>
  const year = parseGanzhi(p.year)
  const month = parseGanzhi(p.month)
  const day = parseGanzhi(p.day)
  if (!year || !month || !day) return null
  let hour: Pillar | null = null
  if (r.hour_unknown !== true && p.hour !== undefined && p.hour !== null) {
    hour = parseGanzhi(p.hour)
    if (!hour) return null
  }
  return toDisplay({ year, month, day, hour }, "stored")
}

/** 출생 정보로 새 엔진 계산(기본 옵션, 윤달 아님 가정 가능). 입력이 틀리면 EngineInputError */
export function displaySajuFromBirth(
  year: number,
  month: number,
  day: number,
  hour: number | null,
  gender: string,
  calType: string,
  isLeapMonth = false,
): DisplaySaju {
  const chart = computeChart(
    toBirthInput(year, month, day, hour === null ? null : { hour, minute: 0 }, gender, calType, isLeapMonth),
  )
  return toDisplay(chart.pillars, "engine")
}

/**
 * 결과 화면용: 저장된 sajuInput.pillars가 있으면 그것(=AI가 본 글자), 없으면 새 엔진 계산.
 * 둘 다 안 되면(예전 레코드의 잘못된 날짜 등) 빈 원국을 돌려 화면이 깨지지 않게 한다.
 * 예전 레코드에는 윤달 여부가 저장돼 있지 않으므로 재계산 시 평달로 본다.
 */
export function resolveDisplaySaju(reading: {
  sajuInput: unknown
  birthYear: number
  birthMonth: number
  birthDay: number
  birthHour: number | null
  gender: string
  calType: string
}): DisplaySaju {
  const stored = displaySajuFromStored(reading.sajuInput)
  if (stored) return stored
  try {
    return displaySajuFromBirth(
      reading.birthYear, reading.birthMonth, reading.birthDay, reading.birthHour, reading.gender, reading.calType,
    )
  } catch (err) {
    // 입력 오류가 아닌 예외는 엔진 결함이므로 기록을 남긴다(화면은 원국 없이 계속 표시)
    if (!(err instanceof EngineInputError)) console.error("[resolveDisplaySaju] 원국 계산 중 예상하지 못한 오류", err)
    return { pillars: [], fiveElements: FIVE_ELEMENTS.map((el) => ({ el, count: 0 })), source: "none" }
  }
}
