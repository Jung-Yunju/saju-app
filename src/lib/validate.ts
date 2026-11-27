// API 입력 검증 도우미 (외부 패키지 없이 직접 작성)
// - 이 파일은 DB·외부 서비스에 의존하지 않는다(단위 테스트 대상: tests/api/validate.test.ts).
// - 음력 날짜의 "그 달이 29일인지 30일인지"·"그 해에 그 윤달이 있는지"는 여기서 거르지 않고,
//   정확한 존재 여부는 만세력 계산(buildSajuInput)이 판정한다(라우트에서 EngineInputError → 400).
// - 정확도 선택 필드(윤달·분·시각 입력 방식·자시 전후·출생지, U-03)는 요청에 있을 때만 결과 객체에 키가 생긴다.
//   (예전 클라이언트가 받는 응답·검증 결과 형태를 그대로 두기 위함. 기본값 해석은 resolveTimeMode 참고)

export const READING_TYPES = ["BASIC", "MONEY", "LOVE", "CAREER", "BULLY", "CONFLICT"] as const
export type ReadingTypeValue = (typeof READING_TYPES)[number]
export const TWO_PERSON_TYPES: readonly ReadingTypeValue[] = ["BULLY", "CONFLICT"]

export const GENDERS = ["M", "F"] as const
export type GenderValue = (typeof GENDERS)[number]
export const CAL_TYPES = ["SOLAR", "LUNAR"] as const
export type CalTypeValue = (typeof CAL_TYPES)[number]

export const TIME_MODES = ["exact", "sijin"] as const
export type TimeModeValue = (typeof TIME_MODES)[number]

export const MIN_YEAR = 1900
export const MAX_YEAR = 2100
export const NAME_MAX_LENGTH = 20
/** 출생지 경도 허용 범위(동경, 도) — 한반도·부속 섬(마라도~독도 포함) */
export const MIN_LONGITUDE = 124
export const MAX_LONGITUDE = 132

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

const ok = <T>(value: T): Result<T> => ({ ok: true, value })
const fail = <T>(error: string): Result<T> => ({ ok: false, error })

// ─── 기본 값 ───────────────────────────────────────────────────────────────

/** 정수(숫자 또는 숫자로만 된 문자열)를 받아 범위 안이면 정수를, 아니면 null */
export function toIntInRange(v: unknown, min: number, max: number): number | null {
  let n: number
  if (typeof v === "number") {
    n = v
  } else if (typeof v === "string" && /^\d{1,4}$/.test(v.trim())) {
    n = Number(v.trim())
  } else {
    return null
  }
  if (!Number.isInteger(n) || n < min || n > max) return null
  return n
}

/** 양력 날짜가 실제로 존재하는지 (윤년 포함) */
export function isValidSolarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false
  if (month < 1 || month > 12 || day < 1) return false
  const d = new Date(Date.UTC(year, month - 1, day))
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
}

// 제어문자(C0·DEL·C1), 꺾쇠, 보이지 않는 서식 문자(폭 없는 공백·방향 제어·BOM)
const NAME_STRIP_RE = /[\u0000-\u001F\u007F-\u009F<>\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g

/**
 * 이름 정리: 문자열이 아니거나 비면 null. 제어문자·꺾쇠·보이지 않는 문자를 지우고
 * 연속 공백을 하나로 줄인다. 길이 검사는 하지 않는다(validateName 참고).
 */
export function cleanName(v: unknown): string | null {
  if (typeof v !== "string") return null
  const cleaned = v.replace(NAME_STRIP_RE, "").replace(/\s+/g, " ").trim()
  return cleaned.length > 0 ? cleaned : null
}

/** 이름 검증: 없으면 null(허용), 문자열이 아니거나 정리 후 20자 초과면 오류 */
export function validateName(v: unknown, label = "이름"): Result<string | null> {
  if (v === undefined || v === null || v === "") return ok(null)
  if (typeof v !== "string") return fail(`${label}을(를) 올바르게 입력해 주세요.`)
  const cleaned = cleanName(v)
  if (cleaned === null) return ok(null)
  if ([...cleaned].length > NAME_MAX_LENGTH) {
    return fail(`${label}은(는) ${NAME_MAX_LENGTH}자 이내로 입력해 주세요.`)
  }
  return ok(cleaned)
}

// ─── 생년월일 ──────────────────────────────────────────────────────────────

export interface BirthplaceValue {
  /** 정리된 이름(validateName 규칙, 20자 이내) */
  name: string
  /** 동경(도), 소수 셋째 자리로 반올림 */
  longitude: number
}

/**
 * 정확도 선택 필드(U-03). 요청에 그 필드가 있을 때만 키가 생긴다.
 * - isLeapMonth: 음력 윤달 여부(양력에서 true는 거부)
 * - birthMinute: 분(0~59) 또는 null. 시 모름이면 반드시 null. 시진 방식이면 null로 정리
 * - timeMode: "exact"(시:분 그대로) | "sijin"(시진 선택 — 짝수 시만)
 * - ziNight: 시진 방식 + 자시(시 0)일 때만 남김. true = 자정 전 밤, false = 자정 후
 * - birthplace: 출생지(경도 보정용) 또는 null(= 서울 기준)
 */
export interface BirthPrecision {
  isLeapMonth?: boolean
  birthMinute?: number | null
  timeMode?: TimeModeValue
  ziNight?: boolean
  birthplace?: BirthplaceValue | null
}

export interface BirthInput extends BirthPrecision {
  birthYear: number
  birthMonth: number
  birthDay: number
  birthHour: number | null
  gender: GenderValue
  calType: CalTypeValue
}

export interface PersonInput extends BirthPrecision {
  year: number
  month: number
  day: number
  hour: number | null
  gender: GenderValue
}

/**
 * 실제로 적용할 시각 입력 방식. 시 모름이면 null.
 * timeMode를 보내지 않은 예전 요청: 짝수 시 + 분 없음 → "sijin"(예전 화면은 시진만 골라 짝수 시를 보냄),
 * 홀수 시이거나 분이 있으면 "exact"(그 시각 그대로).
 */
export function resolveTimeMode(
  hour: number | null,
  p: Pick<BirthPrecision, "timeMode" | "birthMinute">,
): TimeModeValue | null {
  if (hour === null) return null
  if (p.timeMode) return p.timeMode
  if (typeof p.birthMinute === "number") return "exact"
  return hour % 2 === 0 ? "sijin" : "exact"
}

interface RawPerson {
  year: unknown
  month: unknown
  day: unknown
  hour: unknown
  gender: unknown
  isLeapMonth: unknown
  minute: unknown
  timeMode: unknown
  ziNight: unknown
  birthplace: unknown
}

const isAbsent = (v: unknown) => v === undefined || v === null

function validateBirthplace(v: unknown, who: string): Result<BirthplaceValue | null> {
  if (v === null) return ok(null)
  if (!isPlainObject(v)) return fail(`${who}출생지 정보가 올바르지 않습니다.`)
  const name = validateName(v.name, `${who}출생지 이름`)
  if (!name.ok) return name
  if (name.value === null) return fail(`${who}출생지 이름을 입력해 주세요.`)
  const lon = v.longitude
  if (typeof lon !== "number" || !Number.isFinite(lon) || lon < MIN_LONGITUDE || lon > MAX_LONGITUDE) {
    return fail(`${who}출생지 경도는 동경 ${MIN_LONGITUDE}~${MAX_LONGITUDE}도(한반도) 범위여야 합니다.`)
  }
  // 소수 셋째 자리(약 100m)까지만 — 보정 오차 0.01분 미만, 필요 이상으로 정밀한 위치는 저장하지 않는다
  return ok({ name: name.value, longitude: Math.round(lon * 1000) / 1000 })
}

function validatePrecision(
  raw: RawPerson,
  calType: CalTypeValue,
  hour: number | null,
  who: string,
): Result<BirthPrecision> {
  const out: BirthPrecision = {}

  if (!isAbsent(raw.isLeapMonth)) {
    if (typeof raw.isLeapMonth !== "boolean") return fail(`${who}윤달 여부가 올바르지 않습니다.`)
    if (calType === "SOLAR" && raw.isLeapMonth) return fail(`${who}양력 날짜에는 윤달을 고를 수 없습니다.`)
    out.isLeapMonth = raw.isLeapMonth
  }

  if (!isAbsent(raw.timeMode) && raw.timeMode !== "") {
    if (raw.timeMode !== "exact" && raw.timeMode !== "sijin") return fail(`${who}시각 입력 방식이 올바르지 않습니다.`)
    out.timeMode = raw.timeMode
  }

  if (raw.minute !== undefined) {
    let minute: number | null = null
    if (raw.minute !== null && raw.minute !== "") {
      minute = toIntInRange(raw.minute, 0, 59)
      if (minute === null) return fail(`${who}태어난 분은 0~59 사이로 입력해 주세요.`)
      if (hour === null) return fail(`${who}태어난 시를 모르면 분도 비워 주세요.`)
    }
    out.birthMinute = minute
  }

  const mode = resolveTimeMode(hour, out)
  if (mode === "sijin") {
    if (hour !== null && hour % 2 !== 0) return fail(`${who}시진 선택 값이 올바르지 않습니다.`)
    // 시진 방식에서는 분을 쓰지 않는다(대표 시각 = 시진 가운데)
    if (out.birthMinute !== undefined) out.birthMinute = null
  }

  if (!isAbsent(raw.ziNight)) {
    if (typeof raw.ziNight !== "boolean") return fail(`${who}자시 전후 선택이 올바르지 않습니다.`)
    // 시진 방식의 자시(시 0)일 때만 의미가 있다. 그 밖에는 버린다
    if (mode === "sijin" && hour === 0) out.ziNight = raw.ziNight
  }

  if (raw.birthplace !== undefined) {
    const bp = validateBirthplace(raw.birthplace, who)
    if (!bp.ok) return bp
    out.birthplace = bp.value
  }

  return ok(out)
}

function validatePerson(raw: RawPerson, calType: CalTypeValue, who: string): Result<PersonInput> {
  const year = toIntInRange(raw.year, MIN_YEAR, MAX_YEAR)
  if (year === null) return fail(`${who}태어난 해는 ${MIN_YEAR}~${MAX_YEAR} 사이로 입력해 주세요.`)
  const month = toIntInRange(raw.month, 1, 12)
  if (month === null) return fail(`${who}태어난 달은 1~12 사이로 입력해 주세요.`)
  const day = toIntInRange(raw.day, 1, 31)
  if (day === null) return fail(`${who}태어난 날을 올바르게 입력해 주세요.`)
  if (calType === "SOLAR" && !isValidSolarDate(year, month, day)) {
    return fail(`${who}존재하지 않는 날짜입니다. 생년월일을 확인해 주세요.`)
  }
  if (calType === "LUNAR" && day > 30) {
    return fail(`${who}음력 날짜는 30일을 넘을 수 없습니다.`)
  }

  let hour: number | null = null
  if (raw.hour !== undefined && raw.hour !== null && raw.hour !== "") {
    hour = toIntInRange(raw.hour, 0, 23)
    if (hour === null) return fail(`${who}태어난 시는 0~23 사이로 입력하거나 '모름'을 골라 주세요.`)
  }

  if (raw.gender !== "M" && raw.gender !== "F") return fail(`${who}성별을 선택해 주세요.`)

  const precision = validatePrecision(raw, calType, hour, who)
  if (!precision.ok) return precision

  return ok({ year, month, day, hour, gender: raw.gender, ...precision.value })
}

function validateCalType(v: unknown): Result<CalTypeValue> {
  if (v === undefined || v === null || v === "") return ok("SOLAR")
  if (v === "SOLAR" || v === "LUNAR") return ok(v)
  return fail("양력·음력 구분이 올바르지 않습니다.")
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

/** 결제 확인 등에서 쓰는 본인 생년월일 묶음 검증 */
export function validateBirthInfo(raw: unknown): Result<BirthInput> {
  if (!isPlainObject(raw)) return fail("생년월일 정보가 없습니다.")
  const cal = validateCalType(raw.calType)
  if (!cal.ok) return cal
  const p = validatePerson(
    {
      year: raw.birthYear, month: raw.birthMonth, day: raw.birthDay, hour: raw.birthHour, gender: raw.gender,
      isLeapMonth: raw.isLeapMonth, minute: raw.birthMinute, timeMode: raw.timeMode, ziNight: raw.ziNight,
      birthplace: raw.birthplace,
    },
    cal.value,
    "",
  )
  if (!p.ok) return p
  const { year, month, day, hour, gender, ...precision } = p.value
  return ok({
    birthYear: year,
    birthMonth: month,
    birthDay: day,
    birthHour: hour,
    gender,
    calType: cal.value,
    ...precision,
  })
}

// ─── 풀이 생성 요청 (/api/reading/direct) ──────────────────────────────────

export interface ReadingRequest extends BirthInput {
  readingType: ReadingTypeValue
  name: string | null
  /** calType은 otherCalType을 보냈을 때만 있다(없으면 본인과 같은 구분). DB 열이 없어 저장되지 않는다 */
  other: (PersonInput & { name: string | null; calType?: CalTypeValue }) | null
}

export function validateReadingType(v: unknown): Result<ReadingTypeValue> {
  if (v === undefined || v === null || v === "") return ok("BASIC")
  if (typeof v === "string" && (READING_TYPES as readonly string[]).includes(v)) {
    return ok(v as ReadingTypeValue)
  }
  return fail("풀이 종류가 올바르지 않습니다.")
}

export function validateReadingRequest(raw: unknown): Result<ReadingRequest> {
  if (!isPlainObject(raw)) return fail("요청 형식이 올바르지 않습니다.")

  const type = validateReadingType(raw.readingType)
  if (!type.ok) return type
  const name = validateName(raw.name)
  if (!name.ok) return name
  const birth = validateBirthInfo(raw)
  if (!birth.ok) return birth

  let other: ReadingRequest["other"] = null
  if (TWO_PERSON_TYPES.includes(type.value)) {
    // 상대방 양력·음력 구분: otherCalType이 있으면 그것, 없으면(예전 요청) 본인과 같은 구분으로 검증한다.
    let otherCal: CalTypeValue = birth.value.calType
    if (!isAbsent(raw.otherCalType) && raw.otherCalType !== "") {
      const c = validateCalType(raw.otherCalType)
      if (!c.ok) return fail(`상대방 ${c.error}`)
      otherCal = c.value
    }
    const p = validatePerson(
      {
        year: raw.otherBirthYear, month: raw.otherBirthMonth, day: raw.otherBirthDay,
        hour: raw.otherBirthHour, gender: raw.otherGender,
        isLeapMonth: raw.otherIsLeapMonth, minute: raw.otherBirthMinute, timeMode: raw.otherTimeMode,
        ziNight: raw.otherZiNight, birthplace: raw.otherBirthplace,
      },
      otherCal,
      "상대방 ",
    )
    if (!p.ok) return p
    const otherName = validateName(raw.otherName, "상대방 이름")
    if (!otherName.ok) return otherName
    other = { ...p.value, name: otherName.value, ...(isAbsent(raw.otherCalType) || raw.otherCalType === "" ? {} : { calType: otherCal }) }
  }

  return ok({ ...birth.value, readingType: type.value, name: name.value, other })
}

// ─── 맞다/아니다 답변 (/api/reading/[id]/verify) ───────────────────────────

export const ANSWER_VALUES = ["맞다", "아니다", "모름"] as const
export type AnswerValue = (typeof ANSWER_VALUES)[number]
export const MAX_CLAIMS = 20

/**
 * 답변 검증: 키는 서버에 저장된 claim id 목록(allowedIds)에 있는 것만,
 * 값은 "맞다"|"아니다"|"모름"만 허용한다. 답하지 않은 항목은 "모름"으로 채운다.
 */
export function validateAnswers(
  raw: unknown,
  allowedIds: readonly string[],
): Result<Record<string, AnswerValue>> {
  if (!isPlainObject(raw)) return fail("답변 형식이 올바르지 않습니다.")
  const allowed = new Set(allowedIds)
  const keys = Object.keys(raw)
  if (keys.length > allowed.size) return fail("답변 개수가 올바르지 않습니다.")

  const result: Record<string, AnswerValue> = {}
  for (const key of keys) {
    if (!allowed.has(key)) return fail("알 수 없는 질문에 대한 답변이 있습니다.")
    const v = raw[key]
    if (typeof v !== "string" || !(ANSWER_VALUES as readonly string[]).includes(v)) {
      return fail("답변은 '맞다', '아니다', '모름' 중 하나여야 합니다.")
    }
    result[key] = v as AnswerValue
  }
  for (const id of allowed) {
    if (!(id in result)) result[id] = "모름"
  }
  return ok(result)
}

/** DB에 저장된 claims JSON에서 claim id 목록을 안전하게 뽑는다 */
export function extractClaimIds(claimsJson: unknown): string[] {
  if (!isPlainObject(claimsJson) || !Array.isArray(claimsJson.claims)) return []
  const ids: string[] = []
  for (const c of claimsJson.claims.slice(0, MAX_CLAIMS)) {
    if (isPlainObject(c) && typeof c.id === "string" && /^[A-Za-z0-9_-]{1,16}$/.test(c.id)) {
      ids.push(c.id)
    }
  }
  return ids
}

// ─── 요청 본문 읽기 (크기 제한) ────────────────────────────────────────────

export const DEFAULT_BODY_LIMIT = 8 * 1024

/**
 * JSON 본문을 크기 제한을 두고 읽는다. 초과·형식 오류면 사용자용 한국어 오류를 돌려준다.
 * Content-Length를 먼저 보고, 실제 읽은 바이트 수도 다시 확인한다.
 */
export async function readJsonBody(
  req: Request,
  maxBytes = DEFAULT_BODY_LIMIT,
): Promise<Result<unknown>> {
  const declared = Number(req.headers.get("content-length") ?? "")
  if (Number.isFinite(declared) && declared > maxBytes) {
    return fail("요청이 너무 큽니다.")
  }
  if (!req.body) return fail("요청 형식이 올바르지 않습니다.")

  // 스트림으로 읽으면서 한도를 넘는 순간 중단 (Content-Length가 없거나 거짓이어도 안전)
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel().catch(() => {})
        return fail("요청이 너무 큽니다.")
      }
      chunks.push(value)
    }
  } catch {
    return fail("요청을 읽을 수 없습니다.")
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    bytes.set(c, offset)
    offset += c.byteLength
  }
  let text: string
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    return fail("요청 형식이 올바르지 않습니다.")
  }
  try {
    return ok(JSON.parse(text) as unknown)
  } catch {
    return fail("요청 형식이 올바르지 않습니다.")
  }
}

// ─── 무료 풀이 정책 (환경변수) ─────────────────────────────────────────────

type Env = Record<string, string | undefined>

/**
 * 결제 없이 풀이를 만드는 경로(direct·claims·verify) 허용 여부.
 * 운영(NODE_ENV=production)에서는 ALLOW_FREE_READING=true일 때만 허용한다.
 */
export function isFreeReadingAllowed(env: Env = process.env): boolean {
  if (env.NODE_ENV !== "production") return true
  return env.ALLOW_FREE_READING === "true"
}

export const DEFAULT_FREE_READING_DAILY_LIMIT = 3

/** 사용자당 24시간 무료 풀이 생성 한도. 값이 없거나 잘못되면 기본 3 */
export function getFreeReadingDailyLimit(env: Env = process.env): number {
  const raw = env.FREE_READING_DAILY_LIMIT
  if (raw === undefined || !/^\d{1,4}$/.test(raw.trim())) return DEFAULT_FREE_READING_DAILY_LIMIT
  return Number(raw.trim())
}
