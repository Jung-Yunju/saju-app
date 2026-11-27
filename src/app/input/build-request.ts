// 입력 화면의 폼 상태 -> /api/reading/direct 요청 본문 변환 (순수 함수, 화면 계산 없음)

export type TimeMode = "exact" | "sijin" | "unknown"
// ziNight 선택값: "night" = 밤 11시~12시(태어난 날 밤), "dawn" = 자정~새벽 1시, "" = 모름(보내지 않음)
export type ZiChoice = "" | "night" | "dawn"

export type BirthForm = {
  name: string
  birthYear: string
  birthMonth: string
  birthDay: string
  gender: string
  calType: string
  isLeapMonth: boolean
  timeMode: TimeMode
  birthHour: string // exact: 0~23, sijin: 짝수 시(0,2,...,22)
  birthMinute: string // exact 전용
  ziChoice: ZiChoice
  birthplace: string // PLACES의 name, "" = 해외/모름
}

export const emptyForm = (): BirthForm => ({
  name: "", birthYear: "", birthMonth: "", birthDay: "",
  gender: "", calType: "SOLAR", isLeapMonth: false,
  timeMode: "unknown", birthHour: "", birthMinute: "", ziChoice: "",
  birthplace: "서울",
})

// 경도(동경, 소수 셋째 자리): 각 시·도청 또는 시청 소재지의 공개 지리 좌표 기준 근사값.
// 주의: 오프라인 지식으로 입력한 값이라 출처(국토지리정보원·행정안전부 공개 좌표 등)와의 대조 검증이 필요하다.
export const PLACES: { name: string; longitude: number }[] = [
  { name: "서울", longitude: 126.978 },
  { name: "부산", longitude: 129.075 },
  { name: "대구", longitude: 128.601 },
  { name: "인천", longitude: 126.705 },
  { name: "광주", longitude: 126.851 },
  { name: "대전", longitude: 127.385 },
  { name: "울산", longitude: 129.311 },
  { name: "세종", longitude: 127.289 },
  { name: "수원", longitude: 127.029 },
  { name: "춘천", longitude: 127.730 },
  { name: "강릉", longitude: 128.876 },
  { name: "원주", longitude: 127.920 },
  { name: "청주", longitude: 127.489 },
  { name: "전주", longitude: 127.148 },
  { name: "목포", longitude: 126.392 },
  { name: "여수", longitude: 127.662 },
  { name: "포항", longitude: 129.365 },
  { name: "안동", longitude: 128.729 },
  { name: "창원", longitude: 128.681 },
  { name: "제주", longitude: 126.531 },
]

const DST_RANGES: [number, number][] = [[1948, 1951], [1955, 1960], [1987, 1988]]
export function isDstYear(yearStr: string): boolean {
  const y = parseInt(yearStr, 10)
  return Number.isFinite(y) && DST_RANGES.some(([a, b]) => y >= a && y <= b)
}

export const SIJIN_OPTIONS = [
  { v: "0", l: "자시(子時)", t: "23:30~01:29" },
  { v: "2", l: "축시(丑時)", t: "01:30~03:29" },
  { v: "4", l: "인시(寅時)", t: "03:30~05:29" },
  { v: "6", l: "묘시(卯時)", t: "05:30~07:29" },
  { v: "8", l: "진시(辰時)", t: "07:30~09:29" },
  { v: "10", l: "사시(巳時)", t: "09:30~11:29" },
  { v: "12", l: "오시(午時)", t: "11:30~13:29" },
  { v: "14", l: "미시(未時)", t: "13:30~15:29" },
  { v: "16", l: "신시(申時)", t: "15:30~17:29" },
  { v: "18", l: "유시(酉時)", t: "17:30~19:29" },
  { v: "20", l: "술시(戌時)", t: "19:30~21:29" },
  { v: "22", l: "해시(亥時)", t: "21:30~23:29" },
]

export function personFields(f: BirthForm): { fields: Record<string, unknown> } | { error: string } {
  const fields: Record<string, unknown> = {
    birthYear: parseInt(f.birthYear, 10),
    birthMonth: parseInt(f.birthMonth, 10),
    birthDay: parseInt(f.birthDay, 10),
    gender: f.gender,
    calType: f.calType,
  }
  if (f.calType === "LUNAR") fields.isLeapMonth = f.isLeapMonth

  if (f.timeMode === "exact") {
    const h = Number(f.birthHour), m = Number(f.birthMinute)
    if (f.birthHour.trim() === "" || f.birthMinute.trim() === "" ||
        !Number.isInteger(h) || h < 0 || h > 23 || !Number.isInteger(m) || m < 0 || m > 59) {
      return { error: "태어난 시각을 시(0~23)와 분(0~59)으로 입력해 주세요." }
    }
    fields.timeMode = "exact"
    fields.birthHour = h
    fields.birthMinute = m
  } else if (f.timeMode === "sijin") {
    if (f.birthHour === "") return { error: "태어난 시진을 골라 주세요." }
    const h = parseInt(f.birthHour, 10)
    fields.timeMode = "sijin"
    fields.birthHour = h
    fields.birthMinute = null
    if (h === 0 && f.ziChoice !== "") fields.ziNight = f.ziChoice === "night"
  } else {
    fields.birthHour = null
  }

  const place = PLACES.find(p => p.name === f.birthplace)
  fields.birthplace = place ? { name: place.name, longitude: place.longitude } : null
  return { fields }
}

export type BuildResult = { body: Record<string, unknown> } | { error: string }

export function buildRequest(type: string, me: BirthForm, other: BirthForm | null): BuildResult {
  if (!me.birthYear || !me.birthMonth || !me.birthDay || !me.gender) {
    return { error: "내 생년월일과 성별을 입력해 주세요." }
  }
  if (other && (!other.birthYear || !other.birthMonth || !other.birthDay || !other.gender)) {
    return { error: "상대방 생년월일과 성별도 입력해 주세요." }
  }
  const y = parseInt(me.birthYear, 10)
  if (!(y >= 1900 && y <= 2024)) return { error: "생년을 1900~2024 사이로 입력해 주세요." }

  const mine = personFields(me)
  if ("error" in mine) return { error: mine.error }
  const body: Record<string, unknown> = {
    readingType: type,
    name: me.name || undefined,
    ...mine.fields,
  }
  if (other) {
    const theirs = personFields(other)
    if ("error" in theirs) return { error: `상대방: ${theirs.error}` }
    body.otherName = other.name || undefined
    for (const [k, v] of Object.entries(theirs.fields)) {
      body["other" + k[0].toUpperCase() + k.slice(1)] = v
    }
  }
  return { body }
}
