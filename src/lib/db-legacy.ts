// 옛 DB 스키마 호환 계층 — 담당: 백엔드·서버 개발자
//
// 왜 필요한가: prisma/schema.prisma에는 마이그레이션 20261127090000_reading_v3_safety가 추가한 열·표
// (Reading의 정확도 입력 열·attemptCount·lockedAt, Order.birthInfo, AiUsage 표)가 들어 있다.
// 이 schema로 만든 Prisma 클라이언트는 운영 DB에 마이그레이션을 적용하기 전(옛 스키마)이면
//   ① select 없는 조회·create·update·delete가 모든 열을 SELECT/RETURNING 하므로 "열 없음"으로 실패하고
//   ② Reading.create는 select를 줘도 정적 기본값 열(isLeapMonth=false, attemptCount=0)을 INSERT에 늘 넣으므로 실패한다
//      (Prisma 5.22 실측 — docs/DATABASE.md 4절).
// 그래서 DB_SCHEMA_V3 스위치가 꺼져 있으면(= 옛 스키마로 본다) 이 계층이
//   - Reading·Order를 돌려주는 모든 호출의 선택 열을 옛 열로 한정하고(select 없으면 옛 열 전부, 새 열은 뺌, include는 select로 바꿈)
//   - Reading·Order에 쓰는 data에서 새 열을 빼고
//   - Reading.create는 옛 열만 적은 INSERT 문으로 같은 트랜잭션 안에서 실행한다.
// 스위치가 켜져 있으면(DB_SCHEMA_V3=true, 마이그레이션 적용 후) 아무것도 바꾸지 않고 그대로 통과시킨다.
//
// 한계(쓰지 않는 기능이라 막아 둠): 옛 스키마에서 Reading.upsert·createMany·createManyAndReturn은 명확한 오류를 낸다.
// 배열형 $transaction([...]) 안의 Reading.create도 지원하지 않는다(콜백형 $transaction은 지원).
// where 조건의 새 열(lockedAt 등)은 고치지 않는다 — 그런 조회는 스위치가 켜졌을 때만 실행되게 라우트가 나눠 둔다.
import { randomBytes } from "node:crypto"
import { Prisma } from "@prisma/client"

type Env = Record<string, string | undefined>
type Obj = Record<string, unknown>

/** DB_SCHEMA_V3=true일 때만 새 열(attemptCount·lockedAt·정확도 입력 열·Order.birthInfo)과 AiUsage 표를 쓴다 */
export function isDbSchemaV3(env: Env = process.env): boolean {
  return env.DB_SCHEMA_V3 === "true"
}

/** 옛 스키마(마이그레이션 20261117072144_add_reading_v2_fields까지)의 실제 열. 새 열이 생겨도 이 목록은 늘리지 않는다 */
export const LEGACY_COLUMNS = {
  Reading: [
    "id", "userId", "orderId", "readingType", "name", "birthYear", "birthMonth", "birthDay", "birthHour", "gender",
    "calType", "otherName", "otherBirthYear", "otherBirthMonth", "otherBirthDay", "otherBirthHour", "otherGender",
    "status", "sajuInput", "claims", "userAnswers", "fullReading", "content", "createdAt",
  ],
  Order: ["id", "userId", "orderId", "amount", "status", "paymentKey", "createdAt", "updatedAt"],
} as const satisfies Record<string, readonly string[]>

/** 마이그레이션 reading_v3_safety가 추가한 항목(열과 새 표로 가는 관계) */
export const V3_FIELDS = {
  Reading: [
    "isLeapMonth", "birthMinute", "timeMode", "ziNight", "birthplaceLongitude",
    "otherCalType", "otherIsLeapMonth", "otherBirthMinute", "otherTimeMode", "otherZiNight", "otherBirthplaceLongitude",
    "attemptCount", "lockedAt", "aiUsages",
  ],
  Order: ["birthInfo"],
} as const satisfies Record<string, readonly string[]>

type LegacyModel = keyof typeof LEGACY_COLUMNS

const hasLegacyList = (model: string): model is LegacyModel => model in LEGACY_COLUMNS
const isV3Field = (model: string, key: string) =>
  hasLegacyList(model) && (V3_FIELDS[model] as readonly string[]).includes(key)
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v)

/** 관계 필드 → 상대 모델 (schema에서 읽는다) */
const RELATIONS: Record<string, Record<string, string>> = Object.fromEntries(
  Prisma.dmmf.datamodel.models.map((m) => [
    m.name,
    Object.fromEntries(m.fields.filter((f) => f.kind === "object").map((f) => [f.name, f.type])),
  ]),
)
/** 클라이언트 속성 이름(reading) → 모델 이름(Reading) */
const MODEL_BY_DELEGATE: Record<string, string> = Object.fromEntries(
  Prisma.dmmf.datamodel.models.map((m) => [m.name.charAt(0).toLowerCase() + m.name.slice(1), m.name]),
)

/** 옛 열 전부를 고르는 select */
export function legacySelect(model: LegacyModel): Record<string, true> {
  return Object.fromEntries(LEGACY_COLUMNS[model].map((c) => [c, true]))
}

const RETURNING_OPS = new Set([
  "findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany",
  "create", "update", "upsert", "delete", "createManyAndReturn",
])
const UNSUPPORTED_READING_OPS = new Set(["upsert", "createMany", "createManyAndReturn"])

// ─────────────────────────────────────────── 선택 열 다듬기(순수 함수 — 테스트 대상)

function relationValue(target: string, v: unknown, dropped: string[]): unknown {
  if (v === true) return hasLegacyList(target) ? { select: legacySelect(target) } : true
  if (isObj(v)) return shapeSelection(target, v, dropped)
  return v
}

function countValue(model: string, v: unknown, dropped: string[]): unknown {
  if (!isObj(v) || !isObj(v.select)) return v
  const select: Obj = {}
  for (const [k, on] of Object.entries(v.select)) {
    if (isV3Field(model, k)) { if (on) dropped.push(`${model}._count.${k}`); continue }
    select[k] = on
  }
  return { ...v, select }
}

/** select·include 안의 관계를 따라 내려가며 다듬는다 (scalar는 그대로, 옛 스키마에 없는 항목은 뺀다) */
function mapFields(model: string, fields: Obj, dropped: string[]): Obj {
  const out: Obj = {}
  for (const [k, v] of Object.entries(fields)) {
    if (isV3Field(model, k)) { if (v) dropped.push(`${model}.${k}`); continue }
    if (k === "_count") { out[k] = countValue(model, v, dropped); continue }
    const target = RELATIONS[model]?.[k]
    out[k] = target ? relationValue(target, v, dropped) : v
  }
  return out
}

/**
 * 옛 스키마에서 실행할 수 있게 선택 열을 바꾼 args를 돌려준다(원본은 바꾸지 않음).
 * Reading·Order: select가 없으면 옛 열 전부 + include의 관계, 있으면 새 열만 뺀다. 그 밖의 모델은 관계만 따라 내려간다.
 * dropped에는 뺀 항목 이름이 쌓인다(값은 넣지 않는다).
 */
export function shapeSelection(model: string, args: Obj, dropped: string[] = []): Obj {
  const out: Obj = { ...args }
  if (hasLegacyList(model)) {
    if (isObj(out.select)) {
      const select = mapFields(model, out.select, dropped)
      // 고를 것이 하나도 안 남으면 Prisma가 거부하므로 id만 고른다
      out.select = Object.values(select).some(Boolean) ? select : { id: true }
    } else {
      const include = isObj(out.include) ? mapFields(model, out.include, dropped) : {}
      out.select = { ...legacySelect(model), ...include }
    }
    delete out.include
    return out
  }
  if (isObj(out.select)) out.select = mapFields(model, out.select, dropped)
  if (isObj(out.include)) out.include = mapFields(model, out.include, dropped)
  return out
}

function stripRow(model: LegacyModel, data: unknown, dropped: string[]): unknown {
  if (!isObj(data)) return data
  const out: Obj = {}
  for (const [k, v] of Object.entries(data)) {
    if (isV3Field(model, k)) { if (v !== undefined) dropped.push(`${model}.${k}`); continue }
    out[k] = v
  }
  return out
}

/** 쓰기 args의 data(upsert는 create·update)에서 새 열을 뺀다 */
export function stripV3Data(model: string, args: Obj, dropped: string[] = []): Obj {
  if (!hasLegacyList(model)) return args
  const out: Obj = { ...args }
  if ("data" in out) {
    out.data = Array.isArray(out.data) ? out.data.map((d) => stripRow(model, d, dropped)) : stripRow(model, out.data, dropped)
  }
  if ("create" in out) out.create = stripRow(model, out.create, dropped)
  if ("update" in out) out.update = stripRow(model, out.update, dropped)
  return out
}

// ─────────────────────────────────────────── Reading.create (옛 열만 적은 INSERT)

const INT_COLUMNS = new Set([
  "birthYear", "birthMonth", "birthDay", "birthHour", "otherBirthYear", "otherBirthMonth", "otherBirthDay", "otherBirthHour",
])
const JSON_COLUMNS = new Set(["sajuInput", "claims", "userAnswers", "fullReading"])

/** Prisma cuid()와 같은 모양(소문자 영숫자 25자, c로 시작). 순서용 시각 + 무작위 */
export function legacyId(): string {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz"
  const rand = [...randomBytes(16)].map((b) => alphabet[b % 36]).join("")
  return `c${Date.now().toString(36).padStart(8, "0").slice(-8)}${rand}`
}

function columnValue(column: string, v: unknown): Prisma.Sql {
  if (JSON_COLUMNS.has(column)) {
    // 열 하나 = 바인딩 변수 하나(검사·로그에서 열과 값을 짝지을 수 있게)
    if (v === null || v === undefined || v === Prisma.DbNull) return Prisma.sql`CAST(${null} AS jsonb)`
    if (v === Prisma.JsonNull) return Prisma.sql`CAST(${"null"} AS jsonb)`
    return Prisma.sql`CAST(${JSON.stringify(v)} AS jsonb)`
  }
  if (INT_COLUMNS.has(column)) return Prisma.sql`CAST(${v ?? null} AS integer)`
  if (column === "readingType") return Prisma.sql`CAST(${v} AS "ReadingType")`
  if (column === "createdAt") {
    // Prisma는 DateTime을 UTC 기준 시각(시간대 없는 timestamp)으로 저장한다 → 같은 방식으로 넣는다
    const iso = (v instanceof Date ? v : new Date(String(v))).toISOString()
    return Prisma.sql`(CAST(${iso} AS timestamptz) AT TIME ZONE 'UTC')`
  }
  return Prisma.sql`CAST(${v ?? null} AS text)`
}

/** 옛 열만으로 INSERT 문을 만든다(값은 모두 바인딩 변수). 모르는 키(관계 연결 등)가 있으면 오류 */
export function buildLegacyReadingInsert(data: Obj): { id: string; sql: Prisma.Sql } {
  const legacy = LEGACY_COLUMNS.Reading as readonly string[]
  const row: Obj = { ...data }
  const id = typeof row.id === "string" && row.id ? row.id : legacyId()
  row.id = id
  if (row.createdAt === undefined) row.createdAt = new Date()
  const columns: string[] = []
  const values: Prisma.Sql[] = []
  for (const [k, v] of Object.entries(row)) {
    if (v === undefined) continue // Prisma와 같이 '값 없음'은 DB 기본값에 맡긴다
    if (!legacy.includes(k)) {
      throw new Error(`[db-legacy] 옛 스키마의 Reading.create는 옛 열 값만 지원합니다(지원하지 않는 항목: ${k})`)
    }
    columns.push(k)
    values.push(columnValue(k, v))
  }
  const cols = Prisma.raw(columns.map((c) => `"${c}"`).join(", "))
  return { id, sql: Prisma.sql`INSERT INTO "Reading" (${cols}) VALUES (${Prisma.join(values)})` }
}

/** 원시 SQL 오류(P2010)를 Prisma 모델 호출과 같은 오류 코드로 바꾼다 → 라우트의 P2002 처리(동시 요청)가 그대로 동작 */
function mapRawError(err: unknown): unknown {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2010") return err
  const meta = (err.meta ?? {}) as { code?: unknown; message?: unknown }
  const target = /Key \("?([A-Za-z]+)"?\)/.exec(String(meta.message ?? ""))?.[1]
  const clientVersion = Prisma.prismaVersion.client
  if (meta.code === "23505") {
    return new Prisma.PrismaClientKnownRequestError(`Unique constraint failed on the fields: (\`${target ?? "?"}\`)`, {
      code: "P2002", clientVersion, meta: { target: target ? [target] : [] },
    })
  }
  if (meta.code === "23503") {
    return new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed on the field", {
      code: "P2003", clientVersion, meta: { field_name: target ?? "?" },
    })
  }
  return err
}

interface RawRunner {
  $executeRaw(query: Prisma.Sql): PromiseLike<number>
}

async function legacyCreateReading(
  raw: RawRunner, readingDelegate: { findUniqueOrThrow(a: Obj): PromiseLike<unknown> }, args: Obj,
): Promise<unknown> {
  if (!isObj(args.data)) throw new Error("[db-legacy] Reading.create에 data가 없습니다")
  const { id, sql } = buildLegacyReadingInsert(args.data)
  try {
    await raw.$executeRaw(sql)
  } catch (err) {
    throw mapRawError(err)
  }
  // 돌려줄 값: select가 id 하나면 바로, 아니면 같은 연결(트랜잭션)에서 다시 읽는다(선택 열은 위 규칙으로 다듬어짐)
  const sel = isObj(args.select) ? Object.entries(args.select).filter(([, on]) => on).map(([k]) => k) : null
  if (sel && sel.length === 1 && sel[0] === "id" && !args.include) return { id }
  const read: Obj = { where: { id } }
  if (args.select !== undefined) read.select = args.select
  if (args.include !== undefined) read.include = args.include
  return readingDelegate.findUniqueOrThrow(read)
}

// ─────────────────────────────────────────── 클라이언트 감싸기

const warned = new Set<string>()
function warnDropped(op: string, dropped: string[]) {
  if (!dropped.length) return
  const key = `${op}:${[...new Set(dropped)].sort().join(",")}`
  if (warned.has(key)) return
  warned.add(key)
  console.warn(`[db-legacy] DB_SCHEMA_V3 꺼짐(옛 스키마) — 옛 DB에 없는 항목을 빼고 실행: ${key}`)
}

function wrapDelegate(model: string, delegate: object, client: object, env: () => Env): object {
  const wrapped: object = new Proxy(delegate, {
    get(target, op, receiver) {
      const orig = Reflect.get(target, op, receiver) as unknown
      if (typeof op !== "string" || typeof orig !== "function") return orig
      return (args?: unknown, ...rest: unknown[]) => {
        if (isDbSchemaV3(env()) || (args !== undefined && !isObj(args))) return orig.call(target, args, ...rest)
        const dropped: string[] = []
        let a: Obj = stripV3Data(model, isObj(args) ? args : {}, dropped)
        if (model === "Reading" && op === "create") {
          warnDropped(`${model}.${op}`, dropped)
          return legacyCreateReading(
            client as RawRunner,
            wrapped as { findUniqueOrThrow(a: Obj): PromiseLike<unknown> },
            a,
          )
        }
        if (model === "Reading" && UNSUPPORTED_READING_OPS.has(op)) {
          return Promise.reject(new Error(`[db-legacy] 옛 스키마(DB_SCHEMA_V3 꺼짐)에서는 Reading.${op}를 지원하지 않습니다`))
        }
        if (RETURNING_OPS.has(op)) a = shapeSelection(model, a, dropped)
        warnDropped(`${model}.${op}`, dropped)
        return orig.call(target, args === undefined && !Object.keys(a).length ? undefined : a, ...rest)
      }
    },
  })
  return wrapped
}

/**
 * Prisma 클라이언트(또는 트랜잭션 클라이언트)를 옛 스키마 호환 계층으로 감싼다. 타입은 그대로다.
 * 스위치(DB_SCHEMA_V3)는 호출할 때마다 읽는다 → 배포 후 환경변수만 바꿔도 동작이 바뀐다.
 */
export function withLegacySchemaCompat<T extends object>(client: T, env: () => Env = () => process.env): T {
  return new Proxy(client, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target) as unknown
      if (prop === "$transaction" && typeof value === "function") {
        return (arg: unknown, ...rest: unknown[]) =>
          typeof arg === "function"
            ? value.call(target, (tx: object) => (arg as (t: object) => unknown)(withLegacySchemaCompat(tx, env)), ...rest)
            : value.call(target, arg, ...rest)
      }
      if (typeof prop === "string" && MODEL_BY_DELEGATE[prop] && isObj(value)) {
        return wrapDelegate(MODEL_BY_DELEGATE[prop], value, target, env)
      }
      return typeof value === "function" ? value.bind(target) : value
    },
  })
}
