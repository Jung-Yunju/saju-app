// DB 구조 v3(reading_v3_safety) 검증용 메모리 DB — _fakedb.ts를 감싸 v3 쿼리 모양만 추가한다 (backend-developer)
//
// _fakedb.ts는 고치지 않는다(QA 소유). 여기서 덧붙이는 것:
//   - reading.updateMany: where의 OR·null 비교·숫자 lt, data의 { increment: n }
//   - order.create: data.birthInfo 보관(원본 fake는 정해진 열만 남김)
//   - order.updateMany: Prisma.DbNull/JsonNull → null
// 한계는 _fakedb.ts와 같다(실제 PostgreSQL 격리 수준·행 잠금 미재현). 각 메서드 호출 하나는 원자적이다.
import { Prisma } from "@prisma/client"
import { createFakeDb, type FOrder, type FReading } from "./_fakedb"

type Where = Record<string, unknown>
const tick = () => new Promise<void>((r) => setImmediate(r))

function isNullish(v: unknown) {
  return v === null || v === undefined || v === Prisma.DbNull || v === Prisma.JsonNull
}

function matchValue(actual: unknown, cond: unknown): boolean {
  if (cond === undefined) return true
  if (cond === null) return isNullish(actual)
  if (cond instanceof Date) return actual instanceof Date && actual.getTime() === cond.getTime()
  if (typeof cond === "object") {
    const c = cond as Record<string, unknown>
    const num = (x: unknown) => (x instanceof Date ? x.getTime() : (x as number))
    if ("in" in c) return (c.in as unknown[]).includes(actual)
    if (isNullish(actual)) return false
    if ("lt" in c) return num(actual) < num(c.lt)
    if ("lte" in c) return num(actual) <= num(c.lte)
    if ("gte" in c) return num(actual) >= num(c.gte)
    throw new Error(`fakedb-v3: 지원하지 않는 조건 ${JSON.stringify(c)}`)
  }
  return actual === cond
}

function applyData(row: Record<string, unknown>, data: Record<string, unknown>) {
  for (const [k, v] of Object.entries(data)) {
    if (v !== null && typeof v === "object" && !(v instanceof Date) && "increment" in (v as object)) {
      row[k] = ((row[k] as number | undefined) ?? 0) + ((v as { increment: number }).increment)
    } else if (v === Prisma.DbNull || v === Prisma.JsonNull) {
      row[k] = null
    } else {
      row[k] = v
    }
  }
}

export function createFakeDbV3() {
  const db = createFakeDb()
  const orderOf = (r: FReading) => [...db.orders.values()].find((o) => o.id === r.orderId)

  const matchRow = (row: Record<string, unknown>, w: Where, isReading: boolean): boolean =>
    Object.entries(w).every(([k, v]) => {
      if (k === "OR") return (v as Where[]).some((sub) => matchRow(row, sub, isReading))
      if (k === "AND") return (v as Where[]).every((sub) => matchRow(row, sub, isReading))
      if (isReading && k === "order") {
        const rel = (v as { is?: Where }).is
        const o = orderOf(row as FReading)
        return !!o && (!rel || matchRow(o as unknown as Record<string, unknown>, rel, false))
      }
      return matchValue(row[k], v)
    })

  // 같은 객체를 트랜잭션(tx)도 쓰므로 메서드를 바꿔 끼우면 tx 안에서도 적용된다
  const reading = db.client.reading as unknown as Record<string, unknown>
  reading.updateMany = async ({ where, data }: { where: Where; data: Record<string, unknown> }) => {
    await tick()
    let count = 0
    for (const r of db.readings.values()) {
      if (matchRow(r, where, true)) {
        applyData(r, data)
        count++
      }
    }
    return { count }
  }
  reading.findFirst = async ({ where, select }: { where: Where; select?: Record<string, boolean> }) => {
    await tick()
    const r = [...db.readings.values()].find((x) => matchRow(x, where, true))
    if (!r) return null
    if (!select) return { ...r }
    const out: Record<string, unknown> = {}
    for (const [k, on] of Object.entries(select)) {
      if (!on) continue
      out[k] = k === "order" ? { ...orderOf(r) } : r[k]
    }
    return out
  }

  // 실제 DB의 열 기본값(마이그레이션): attemptCount 0, isLeapMonth false, 나머지 새 열 NULL
  const withDefaults = (r: Record<string, unknown>) => {
    if (r.attemptCount === undefined) r.attemptCount = 0
    if (r.lockedAt === undefined) r.lockedAt = null
    if (r.isLeapMonth === undefined) r.isLeapMonth = false
    return r
  }
  const origReadingCreate = reading.create as (a: { data: Record<string, unknown>; select?: Record<string, unknown> }) => Promise<unknown>
  reading.create = async (a: { data: Record<string, unknown>; select?: Record<string, unknown> }) => {
    const out = (await origReadingCreate(a)) as { id: string }
    withDefaults(db.readings.get(out.id) as unknown as Record<string, unknown>)
    return out
  }
  const origSeedReading = db.seedReading
  const seedReading = (r: Parameters<typeof origSeedReading>[0]) =>
    withDefaults(origSeedReading(r) as unknown as Record<string, unknown>) as unknown as FReading

  const order = db.client.order as unknown as Record<string, (...a: never[]) => Promise<unknown>>
  const origCreate = order.create as unknown as (a: { data: Partial<FOrder> }) => Promise<FOrder>
  order.create = (async ({ data }: { data: Partial<FOrder> & { birthInfo?: unknown } }) => {
    const created = await origCreate({ data })
    const row = db.orders.get(created.id) as FOrder & { birthInfo?: unknown }
    row.birthInfo = data.birthInfo ?? null
    return { ...row }
  }) as never
  order.updateMany = (async ({ where, data }: { where: Where; data: Record<string, unknown> }) => {
    await tick()
    let count = 0
    for (const o of db.orders.values()) {
      if (matchRow(o as unknown as Record<string, unknown>, where, false)) {
        applyData(o as unknown as Record<string, unknown>, data)
        o.updatedAt = new Date()
        count++
      }
    }
    return { count }
  }) as never

  return { ...db, seedReading }
}

export type FakeDbV3 = ReturnType<typeof createFakeDbV3>
