// Claude용 사주 입력 JSON 생성 + 결과 화면용 원국 표시 변환
// 계산은 전부 새 사주엔진(src/engine, computeChart 기본 옵션)으로 한다.
//   - 연주·월주: 절입 UTC 순간 기준(한국 시간대 이력·서머타임 반영)
//   - 일주·시주: 진태양시(서울 경도) 보정, 23시 이후는 다음 날 일주(엔진 기본값)
//   - 음력: 한국 음력(UTC+9 판정)
//   - 공망: 일주·연주 기준 旬空(src/engine/rules/gongmang.ts)
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
}

export interface BuildSajuInputOptions {
  /** '올해' 판정 기준 시각(테스트 주입용). 기본: 현재 시각 */
  now?: Date
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

/** 라우트 입력(hour만 있는 형태) → 엔진 입력. 형식이 틀리면 EngineInputError */
function toBirthInput(
  year: number,
  month: number,
  day: number,
  hour: number | null,
  gender: string,
  calType: string,
  isLeapMonth: boolean,
): BirthInput {
  if (calType !== "SOLAR" && calType !== "LUNAR") throw new EngineInputError(`calType 값 오류: ${String(calType)}`)
  if (gender !== "M" && gender !== "F") throw new EngineInputError(`gender 값 오류: ${String(gender)}`)
  return {
    calendar: calType === "LUNAR" ? "lunar" : "solar",
    year,
    month,
    day,
    isLeapMonth,
    time: hour === null ? null : { hour, minute: 0 },
    timezone: SEOUL,
    gender,
  }
}

function birthString(chart: CalendarResult): string {
  const p = (n: number) => String(n).padStart(2, "0")
  const { year, month, day } = chart.solarDate
  const t = chart.input.time
  return `${year}-${p(month)}-${p(day)}${t ? ` ${p(t.hour)}:${p(t.minute)}` : ""}`
}

/**
 * 출생 정보 → Claude용 사주 입력.
 * 입력이 틀리면(존재하지 않는 날짜, 그 해에 없는 윤달, 범위 밖 연도·시각) EngineInputError를 던진다
 * → 호출 라우트가 400으로 처리한다.
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
  const chart = computeChart(toBirthInput(year, month, day, hour, gender, calType, isLeapMonth))
  const { pillars: pc } = chart

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
    warnings: [...chart.warnings],
    engine_version: `${chart.engineVersion}+${RULES_ENGINE_VERSION}`,
  }
}

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
  const chart = computeChart(toBirthInput(year, month, day, hour, gender, calType, isLeapMonth))
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
