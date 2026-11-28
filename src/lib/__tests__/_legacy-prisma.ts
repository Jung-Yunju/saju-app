// 옛 DB 스키마(마이그레이션 reading_v3_safety 적용 전) 흉내 Prisma — 담당: 백엔드·서버 개발자
//
// tests/security/_fakedb-v3.ts(QA 소유, 읽기만)의 메모리 DB를 감싸서, 실제 옛 DB라면 "열 없음"으로 실패할 호출을 똑같이 실패시킨다.
//   - Reading·Order를 돌려주는 호출(find*·create·update·upsert·delete): select가 없거나(= 모든 열 SELECT/RETURNING),
//     include를 쓰거나, select에 새 열이 있으면 실패. 관계(order·reading)를 true로 고르면 상대 모델 전체 열이라 실패.
//   - create: Prisma 엔진처럼 data 키 + schema의 정적 기본값 열(isLeapMonth·attemptCount 등)을 INSERT 열로 보고, 새 열이 있으면 실패.
//   - data·where(OR·AND 포함)에 새 열이 있으면 실패. AiUsage 표 호출은 모두 실패(표 없음).
//   - $executeRaw(Prisma.Sql) INSERT INTO "Reading": 열 목록이 옛 열인지 확인하고 메모리 DB에 넣는다(orderId 중복은 실제와 같은 P2010/23505).
// 한계: 실제 SQL 실행·형 변환·트랜잭션 격리는 흉내 내지 않는다 → 실DB 검증은 db-legacy.pg.test.ts.
import { Prisma } from "@prisma/client"
import { createFakeDbV3 } from "../../../tests/security/_fakedb-v3"
import { LEGACY_COLUMNS } from "@/lib/db-legacy"

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v)

const MODELS = Prisma.dmmf.datamodel.models
const model = (name: string) => MODELS.find((m) => m.name === name)!
const RELATION_TARGET = (m: string, k: string) => model(m).fields.find((f) => f.name === k && f.kind === "object")?.type
const LEGACY: Record<string, readonly string[]> = LEGACY_COLUMNS
/** Prisma 엔진이 INSERT에 스스로 넣는 열: 정적 기본값·cuid·now·@updatedAt (dbgenerated·autoincrement 제외) */
const ENGINE_FILLED = (m: string) =>
  model(m).fields
    .filter((f) => f.kind === "scalar" || f.kind === "enum")
    .filter((f) => f.isUpdatedAt || (f.hasDefaultValue && !(isObj(f.default) && ["dbgenerated", "autoincrement"].includes(String((f.default as Obj).name)))))
    .map((f) => f.name)

export class LegacySchemaError extends Error {}
/** Prisma.sql`…` 결과(Sql 클래스는 런타임에 내보내지 않아 모양으로 판별) */
const isSql = (v: unknown): v is Prisma.Sql => isObj(v) && typeof v.sql === "string" && Array.isArray(v.values) && Array.isArray(v.strings)
const missing = (m: string, col: string) => {
  throw new LegacySchemaError(`The column \`${m}.${col}\` does not exist in the current database.`)
}

function checkSelect(m: string, select: unknown, path: string) {
  if (!isObj(select)) throw new LegacySchemaError(`${path}: select 없음 → ${m}의 모든 열을 읽는다(옛 DB에서 실패)`)
  for (const [k, v] of Object.entries(select)) {
    if (!v) continue
    const target = RELATION_TARGET(m, k)
    if (target) {
      if (!(target in LEGACY)) continue // User 등 새 열 없는 모델
      if (v === true) throw new LegacySchemaError(`${path}.${k}: 관계를 true로 고름 → ${target} 모든 열(옛 DB에서 실패)`)
      if (isObj(v) && (v as Obj).include) throw new LegacySchemaError(`${path}.${k}: include 사용`)
      checkSelect(target, (v as Obj).select, `${path}.${k}`)
    } else if (k !== "_count" && !LEGACY[m].includes(k)) missing(m, k)
  }
}

function checkKeys(m: string, obj: unknown) {
  if (!isObj(obj) || !(m in LEGACY)) return
  for (const [k, v] of Object.entries(obj)) {
    if (k === "OR" || k === "AND" || k === "NOT") { for (const sub of [v].flat()) checkKeys(m, sub); continue }
    const target = RELATION_TARGET(m, k)
    if (target) { if (isObj(v)) checkKeys(target, (v as Obj).is ?? v); continue }
    if (!LEGACY[m].includes(k)) missing(m, k)
  }
}

const RETURNING = new Set(["findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "create", "update", "upsert", "delete"])

function strictDelegate(m: string, d: Obj, extra: Obj, log: string[]): Obj {
  return new Proxy(d, {
    get(t, op) {
      const fn = (extra[op as string] ?? t[op as string]) as ((a: Obj) => Promise<unknown>) | undefined
      if (typeof fn !== "function") return fn
      return async (args: Obj = {}) => {
        log.push(`${m}.${String(op)}`)
        if (m in LEGACY) {
          if (RETURNING.has(String(op))) {
            if (args.include) throw new LegacySchemaError(`${m}.${String(op)}: include 사용 → 모든 열을 읽는다`)
            checkSelect(m, args.select, `${m}.${String(op)}`)
          }
          checkKeys(m, args.where)
          if (op === "create") for (const c of new Set([...Object.keys(args.data as Obj), ...ENGINE_FILLED(m)])) checkKeys(m, { [c]: 1 })
          else checkKeys(m, args.data)
        }
        return fn.call(t, args)
      }
    },
  }) as Obj
}

export function createLegacyPrisma() {
  const db = createFakeDbV3()
  const log: string[] = []
  const rawInserts: { columns: string[]; text: string }[] = []

  const findMany = async ({ where = {}, select, orderBy }: Obj) => {
    const rows = [...db.readings.values()].filter((r) => Object.entries(where as Obj).every(([k, v]) => r[k] === v))
    if (isObj(orderBy) && orderBy.createdAt === "desc") rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    return rows.map((r) => Object.fromEntries(Object.entries(select as Obj).filter(([, on]) => on).map(([k]) => [k, r[k]])))
  }
  const findUniqueOrThrow = async (a: Obj) => {
    const r = await (db.client.reading.findUnique as (x: Obj) => Promise<unknown>)(a)
    if (!r) throw new Prisma.PrismaClientKnownRequestError("No record", { code: "P2025", clientVersion: "5.22.0" })
    return r
  }

  async function rawInsert(sql: Prisma.Sql) {
    const m = /^INSERT INTO "Reading" \(([^)]*)\) VALUES/.exec(sql.sql)
    if (!m) throw new Error(`legacy-prisma: 지원하지 않는 원시 SQL ${sql.sql.slice(0, 40)}`)
    const columns = m[1].split(",").map((c) => c.trim().replace(/"/g, ""))
    for (const c of columns) if (!LEGACY.Reading.includes(c)) missing("Reading", c)
    if (columns.length !== sql.values.length) throw new Error("legacy-prisma: 열 수와 값 수가 다름")
    rawInserts.push({ columns, text: sql.sql })
    const row: Obj = { status: "COMPLETE", readingType: "BASIC", calType: "SOLAR", content: "", claims: null, userAnswers: null, fullReading: null, sajuInput: null, name: null }
    columns.forEach((c, i) => {
      const v = sql.values[i]
      if (["sajuInput", "claims", "userAnswers", "fullReading"].includes(c)) row[c] = v === null ? null : JSON.parse(String(v))
      else if (c === "createdAt") row[c] = new Date(String(v))
      else row[c] = v
    })
    if ([...db.readings.values()].some((r) => r.orderId === row.orderId)) {
      throw new Prisma.PrismaClientKnownRequestError("Raw query failed", {
        code: "P2010", clientVersion: "5.22.0", meta: { code: "23505", message: `Key ("orderId")=(${String(row.orderId)}) already exists.` },
      })
    }
    db.readings.set(String(row.id), row as never)
    return 1
  }

  const wrapClient = (c: Obj): Obj => ({
    user: strictDelegate("User", c.user as Obj, {}, log),
    order: strictDelegate("Order", c.order as Obj, {}, log),
    reading: strictDelegate("Reading", c.reading as Obj, { findMany, findUniqueOrThrow }, log),
    aiUsage: new Proxy({}, { get: () => async () => { throw new LegacySchemaError('The table `AiUsage` does not exist in the current database.') } }),
    $executeRaw: (first: unknown, ...rest: unknown[]) =>
      isSql(first) ? rawInsert(first) : (c.$executeRaw as (...a: unknown[]) => Promise<number>)(first, ...rest),
    $transaction: async (cb: (tx: Obj) => Promise<unknown>) =>
      (db.client.$transaction as (f: (tx: Obj) => Promise<unknown>) => Promise<unknown>)((tx) => cb(wrapClient(tx))),
  })

  return { db, client: wrapClient(db.client as unknown as Obj), log, rawInserts }
}
