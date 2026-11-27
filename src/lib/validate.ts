// API 입력 검증 도우미 (외부 패키지 없이 직접 작성)
// - 이 파일은 DB·외부 서비스에 의존하지 않는다(단위 테스트 대상: tests/api/validate.test.ts).
// - 음력 날짜의 "그 달이 29일인지 30일인지"는 여기서 1~30으로만 거르고,
//   정확한 존재 여부는 만세력 계산(buildSajuInput)이 판정한다(라우트에서 예외 → 400).

export const READING_TYPES = ["BASIC", "MONEY", "LOVE", "CAREER", "BULLY", "CONFLICT"] as const
export type ReadingTypeValue = (typeof READING_TYPES)[number]
export const TWO_PERSON_TYPES: readonly ReadingTypeValue[] = ["BULLY", "CONFLICT"]

export const GENDERS = ["M", "F"] as const
export type GenderValue = (typeof GENDERS)[number]
export const CAL_TYPES = ["SOLAR", "LUNAR"] as const
export type CalTypeValue = (typeof CAL_TYPES)[number]

export const MIN_YEAR = 1900
export const MAX_YEAR = 2100
export const NAME_MAX_LENGTH = 20

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

export interface BirthInput {
  birthYear: number
  birthMonth: number
  birthDay: number
  birthHour: number | null
  gender: GenderValue
  calType: CalTypeValue
}

export interface PersonInput {
  year: number
  month: number
  day: number
  hour: number | null
  gender: GenderValue
}

function validatePerson(
  raw: { year: unknown; month: unknown; day: unknown; hour: unknown; gender: unknown },
  calType: CalTypeValue,
  who: string,
): Result<PersonInput> {
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

  return ok({ year, month, day, hour, gender: raw.gender })
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
    { year: raw.birthYear, month: raw.birthMonth, day: raw.birthDay, hour: raw.birthHour, gender: raw.gender },
    cal.value,
    "",
  )
  if (!p.ok) return p
  return ok({
    birthYear: p.value.year,
    birthMonth: p.value.month,
    birthDay: p.value.day,
    birthHour: p.value.hour,
    gender: p.value.gender,
    calType: cal.value,
  })
}

// ─── 풀이 생성 요청 (/api/reading/direct) ──────────────────────────────────

export interface ReadingRequest extends BirthInput {
  readingType: ReadingTypeValue
  name: string | null
  other: (PersonInput & { name: string | null }) | null
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
    // 상대방은 별도 양력·음력 구분을 받지 않으므로 본인과 같은 구분으로 검증한다.
    const p = validatePerson(
      {
        year: raw.otherBirthYear, month: raw.otherBirthMonth, day: raw.otherBirthDay,
        hour: raw.otherBirthHour, gender: raw.otherGender,
      },
      birth.value.calType,
      "상대방 ",
    )
    if (!p.ok) return p
    const otherName = validateName(raw.otherName, "상대방 이름")
    if (!otherName.ok) return otherName
    other = { ...p.value, name: otherName.value }
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
