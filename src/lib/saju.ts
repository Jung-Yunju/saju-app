// 사주팔자 계산 유틸리티
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Lunar } = require("lunar-javascript") as { Lunar: { fromYmd: (y: number, m: number, d: number) => { getSolar: () => { getYear: () => number; getMonth: () => number; getDay: () => number } } } }

function lunarToSolar(year: number, month: number, day: number) {
  try {
    const solar = Lunar.fromYmd(year, month, day).getSolar()
    return { year: solar.getYear(), month: solar.getMonth(), day: solar.getDay() }
  } catch {
    return { year, month, day }
  }
}

const HEAVENLY_STEMS = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"]
const EARTHLY_BRANCHES = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"]
// 천간 오행
const STEM_ELEMENTS: Record<string, string> = {
  갑: "목", 을: "목", 병: "화", 정: "화", 무: "토",
  기: "토", 경: "금", 신: "금", 임: "수", 계: "수",
}
// 지지 오행
const BRANCH_ELEMENTS: Record<string, string> = {
  자: "수", 축: "토", 인: "목", 묘: "목", 진: "토",
  사: "화", 오: "화", 미: "토", 신: "금", 유: "금",
  술: "토", 해: "수",
}
const ELEMENTS: Record<string, string> = { ...STEM_ELEMENTS, ...BRANCH_ELEMENTS }

// 연주 계산 (년간, 년지)
function getYearPillar(year: number) {
  const stemIdx = (year - 4) % 10
  const branchIdx = (year - 4) % 12
  return {
    stem: HEAVENLY_STEMS[(stemIdx + 10) % 10],
    branch: EARTHLY_BRANCHES[(branchIdx + 12) % 12],
  }
}

// 월주 계산 (월간, 월지)
// 월지: 1월=축(1), 2월=인(2), ..., 5월=사(5), ..., 12월=자(0)
// 월간: 연간 그룹별 기준 → 甲己=丙寅시작, 乙庚=戊寅, 丙辛=庚寅, 丁壬=壬寅, 戊癸=甲寅
function getMonthPillar(year: number, month: number) {
  const yearStemIdx = (year - 4) % 10
  const monthBranchIdx = month % 12  // 5월→사(5), 1월→축(1), 12월→자(0)
  const monthStemBase = ((yearStemIdx % 5) * 2 + 2) % 10  // 인월(2월) 기준 천간
  const offset = (monthBranchIdx - 2 + 12) % 12           // 인(2)으로부터 거리
  const stemIdx = (monthStemBase + offset) % 10
  return {
    stem: HEAVENLY_STEMS[stemIdx],
    branch: EARTHLY_BRANCHES[monthBranchIdx],
  }
}

// 일주 계산 (일간, 일지) — 그레고리력 율리우스 일수(JDN) 공식
function getDayPillar(year: number, month: number, day: number) {
  const a = Math.floor((14 - month) / 12)
  const y = year + 4800 - a          // ← 반드시 +4800
  const m = month + 12 * a - 3
  const jd = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045
  const stemIdx = (jd + 9) % 10
  const branchIdx = (jd + 1) % 12
  return {
    stem: HEAVENLY_STEMS[(stemIdx + 10) % 10],
    branch: EARTHLY_BRANCHES[(branchIdx + 12) % 12],
  }
}

// 시주 계산 (시간, 시지)
function getHourPillar(hour: number | null, dayStem: string) {
  if (hour === null) return null
  const branchIdx = Math.floor((hour + 1) / 2) % 12
  const dayStemIdx = HEAVENLY_STEMS.indexOf(dayStem)
  const hourStemBase = ((dayStemIdx % 5) * 2) % 10
  const stemIdx = (hourStemBase + branchIdx) % 10
  return {
    stem: HEAVENLY_STEMS[stemIdx],
    branch: EARTHLY_BRANCHES[branchIdx],
  }
}

export interface SajuPillar {
  stem: string
  branch: string
  element: string
  branchElement: string
}

export interface SajuData {
  year: SajuPillar
  month: SajuPillar
  day: SajuPillar
  hour: SajuPillar | null
  birthInfo: {
    year: number
    month: number
    day: number
    hour: number | null
    gender: string
  }
}

export function calculateSaju(
  year: number,
  month: number,
  day: number,
  hour: number | null,
  gender: string,
  calType = "SOLAR"
): SajuData {
  let sy = year, sm = month, sd = day
  if (calType === "LUNAR") {
    const solar = lunarToSolar(year, month, day)
    sy = solar.year; sm = solar.month; sd = solar.day
  }
  const yearPillar = getYearPillar(sy)
  const monthPillar = getMonthPillar(sy, sm)
  const dayPillar = getDayPillar(sy, sm, sd)
  const hourPillar = getHourPillar(hour, dayPillar.stem)

  const toPillar = (p: { stem: string; branch: string }): SajuPillar => ({
    ...p,
    element: ELEMENTS[p.stem as keyof typeof ELEMENTS] || "",
    branchElement: ELEMENTS[p.branch as keyof typeof ELEMENTS] || "",
  })

  return {
    year: toPillar(yearPillar),
    month: toPillar(monthPillar),
    day: toPillar(dayPillar),
    hour: hourPillar ? toPillar(hourPillar) : null,
    birthInfo: { year: sy, month: sm, day: sd, hour, gender },
  }
}

export function sajuToString(saju: SajuData): string {
  const { year, month, day, hour, birthInfo } = saju
  const lines = [
    `생년월일: ${birthInfo.year}년 ${birthInfo.month}월 ${birthInfo.day}일${birthInfo.hour !== null ? ` ${birthInfo.hour}시` : ""}`,
    `성별: ${birthInfo.gender === "M" ? "남성" : "여성"}`,
    ``,
    `사주팔자:`,
    `연주(年柱): ${year.stem}${year.branch} (${year.element}/${year.branchElement})`,
    `월주(月柱): ${month.stem}${month.branch} (${month.element}/${month.branchElement})`,
    `일주(日柱): ${day.stem}${day.branch} (${day.element}/${day.branchElement})`,
  ]
  if (hour) {
    lines.push(`시주(時柱): ${hour.stem}${hour.branch} (${hour.element}/${hour.branchElement})`)
  }
  return lines.join("\n")
}
