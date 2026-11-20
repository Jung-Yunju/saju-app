// 대운·공망·올해 간지를 포함한 Claude용 사주 입력 JSON 생성
// lunar-javascript 의 EightChar API 사용

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Solar, Lunar } = require("lunar-javascript") as {
  Solar: { fromYmdHms: (y: number, m: number, d: number, h: number, mi: number, s: number) => { getLunar: () => LunarObj } }
  Lunar: { fromYmdHms: (y: number, m: number, d: number, h: number, mi: number, s: number) => LunarObj }
}

interface EightCharObj {
  getYear: () => string
  getMonth: () => string
  getDay: () => string
  getTime: () => string
  getYearXunKong: () => string
  getDayXunKong: () => string
  getYun: (gender: number) => YunObj
}

interface YunObj {
  getStartYear: () => number
  getStartMonth: () => number
  getStartDay: () => number
  getDaYun: (n: number) => DaYunObj[]
}

interface DaYunObj {
  getIndex: () => number
  getGanZhi: () => string
  getStartYear: () => number
  getStartAge: () => number
}

interface LunarObj {
  getEightChar: () => EightCharObj
  getSolar: () => { getYear: () => number; getMonth: () => number; getDay: () => number }
}

// 2026년 간지 (병오) — 올해 고정값
const THIS_YEAR = 2026
const THIS_YEAR_GANZHI = "丙午"

export interface SajuInputData {
  name?: string
  gender: string
  birth: string
  calendar: string
  pillars: { year: string; month: string; day: string; hour?: string }
  hour_unknown: boolean
  daeun: { start_year: number; start_age: number; ganzhi: string }[]
  gongmang: { day: string; year: string }
  this_year: number
  this_year_ganzhi: string
  known_facts: string[]
  voice: string
}

export function buildSajuInput(
  year: number,
  month: number,
  day: number,
  hour: number | null,
  gender: string,
  calType: string,
  name?: string,
): SajuInputData {
  const h = hour ?? 0
  let lunar: LunarObj

  if (calType === "LUNAR") {
    lunar = Lunar.fromYmdHms(year, month, day, h, 0, 0)
  } else {
    lunar = Solar.fromYmdHms(year, month, day, h, 0, 0).getLunar()
  }

  const ec: EightCharObj = lunar.getEightChar()

  // 사주 간지 (한자)
  const pillars: SajuInputData["pillars"] = {
    year: ec.getYear(),
    month: ec.getMonth(),
    day: ec.getDay(),
  }
  if (hour !== null) {
    pillars.hour = ec.getTime()
  }

  // 공망
  const gongmang = {
    day: ec.getDayXunKong(),
    year: ec.getYearXunKong(),
  }

  // 대운 (성별: 남=1, 여=0)
  const genderNum = gender === "M" ? 1 : 0
  const yun: YunObj = ec.getYun(genderNum)
  const daYunList: DaYunObj[] = ec.getYun(genderNum).getDaYun(9)
  // index 0 은 birth period, 1-8 이 실제 대운
  const daeun = daYunList
    .filter(d => d.getIndex() > 0)
    .slice(0, 8)
    .map(d => ({
      start_year: d.getStartYear(),
      start_age: d.getStartAge(),
      ganzhi: d.getGanZhi(),
    }))

  // 출생 년/월/일 문자열 (양력 기준)
  const solar = lunar.getSolar()
  const birthStr = `${solar.getYear()}-${String(solar.getMonth()).padStart(2, "0")}-${String(solar.getDay()).padStart(2, "0")}${hour !== null ? ` ${String(h).padStart(2, "0")}:00` : ""}`

  void yun  // getDaYun called above via ec.getYun(genderNum)

  return {
    name,
    gender: gender === "M" ? "남" : "여",
    birth: birthStr,
    calendar: calType === "LUNAR" ? "음력" : "양력",
    pillars,
    hour_unknown: hour === null,
    daeun,
    gongmang,
    this_year: THIS_YEAR,
    this_year_ganzhi: THIS_YEAR_GANZHI,
    known_facts: [],
    voice: "할미",
  }
}
