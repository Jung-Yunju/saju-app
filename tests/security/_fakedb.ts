// 보안 테스트용 메모리 DB (Prisma 일부 흉내) — qa-security-lead
//
// 목적: 라우트 로직이 "DB가 원자적으로 동작한다면" 안전한지를 동시 요청까지 포함해 본다.
// 한계(미검증으로 남김): 실제 PostgreSQL의 격리 수준·행 잠금·pg_advisory_xact_lock·Prisma 트랜잭션 타임아웃은 재현하지 않는다.
//   - 각 메서드 호출 하나는 원자적이다(JS 단일 스레드). 호출 사이에는 일부러 await를 넣어 요청이 서로 끼어들게 한다.
//   - $transaction은 롤백을 흉내 내지 않는다(콜백 안에서 예외가 나도 이미 쓴 값은 남는다 → 라우트가 기대지 않는지 확인용).
//   - $executeRaw에 'free_reading:<userId>' 키가 있으면 트랜잭션이 끝날 때까지 같은 키를 줄 세운다(advisory xact lock 흉내).
import { Prisma } from "@prisma/client"

export interface FUser { id: string; email: string | null; name: string | null }
export interface FOrder {
  id: string; userId: string; orderId: string; amount: number; status: string
  paymentKey: string | null; createdAt: Date; updatedAt: Date
}
export interface FReading {
  id: string; userId: string; orderId: string; status: string
  sajuInput: unknown; claims: unknown; userAnswers: unknown; fullReading: unknown
  readingType: string; name: string | null; createdAt: Date
  [k: string]: unknown
}

type Where = Record<string, unknown>

const tick = () => new Promise<void>((r) => setImmediate(r))

function matchValue(actual: unknown, cond: unknown): boolean {
  if (cond === undefined) return true
  if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
    const c = cond as Record<string, unknown>
    if ("in" in c) return (c.in as unknown[]).includes(actual)
    if ("lt" in c) return actual instanceof Date && actual.getTime() < (c.lt as Date).getTime()
    if ("gte" in c) return actual instanceof Date && actual.getTime() >= (c.gte as Date).getTime()
    if ("lte" in c) return (actual as number) <= (c.lte as number)
    throw new Error(`fakedb: 지원하지 않는 조건 ${JSON.stringify(c)}`)
  }
  if (actual instanceof Date && cond instanceof Date) return actual.getTime() === cond.getTime()
  return actual === cond
}

export function createFakeDb() {
  let seq = 0
  const nid = (p: string) => `${p}${++seq}`
  const users = new Map<string, FUser>()
  const orders = new Map<string, FOrder>()
  const readings = new Map<string, FReading>()
  const rawCalls: string[] = []
  const locks = new Map<string, Promise<void>>()
  let now = () => new Date()

  const orderMatch = (o: FOrder, w: Where) =>
    Object.entries(w).every(([k, v]) => matchValue((o as unknown as Record<string, unknown>)[k], v))

  const readingMatch = (r: FReading, w: Where) =>
    Object.entries(w).every(([k, v]) => {
      if (k === "order") {
        const rel = (v as { is?: Where }).is
        const o = [...orders.values()].find((x) => x.id === r.orderId)
        return !!o && (!rel || orderMatch(o, rel))
      }
      return matchValue(r[k], v)
    })

  const pick = <T extends object>(row: T | undefined, select?: Record<string, unknown>) => {
    if (!row) return null
    if (!select) return { ...row }
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(select)) {
      if (!v) continue
      if (k === "order") {
        const o = [...orders.values()].find((x) => x.id === (row as unknown as FReading).orderId)
        out.order = o ? pick(o, (v as { select?: Record<string, unknown> }).select) : null
      } else out[k] = (row as Record<string, unknown>)[k]
    }
    return out
  }

  const p2002 = (target: string) =>
    new Prisma.PrismaClientKnownRequestError(`Unique constraint failed on ${target}`, { code: "P2002", clientVersion: "5.22.0" })

  const user = {
    findUnique: async ({ where, select }: { where: Where; select?: Record<string, unknown> }) => {
      await tick()
      const u = [...users.values()].find((x) => (where.id ? x.id === where.id : x.email === where.email))
      return pick(u, select)
    },
    create: async ({ data }: { data: Partial<FUser> & { id?: string } }) => {
      await tick()
      const id = data.id ?? nid("user_")
      if (users.has(id)) throw p2002("User.id")
      if (data.email && [...users.values()].some((x) => x.email === data.email)) throw p2002("User.email")
      const u = { id, email: data.email ?? null, name: data.name ?? null }
      users.set(id, u)
      return { ...u }
    },
  }

  const order = {
    findUnique: async ({ where }: { where: Where }) => {
      await tick()
      const o = [...orders.values()].find((x) => (where.id ? x.id === where.id : x.orderId === where.orderId))
      return o ? { ...o } : null
    },
    count: async ({ where }: { where: Where }) => {
      await tick()
      return [...orders.values()].filter((o) => orderMatch(o, where)).length
    },
    create: async ({ data }: { data: Partial<FOrder> }) => {
      await tick()
      if ([...orders.values()].some((x) => x.orderId === data.orderId)) throw p2002("Order.orderId")
      const t = now()
      const o: FOrder = {
        id: nid("ord_"), userId: data.userId!, orderId: data.orderId!, amount: data.amount!,
        status: data.status ?? "PENDING", paymentKey: data.paymentKey ?? null, createdAt: t, updatedAt: t,
      }
      orders.set(o.id, o)
      return { ...o }
    },
    update: async ({ where, data }: { where: Where; data: Partial<FOrder> }) => {
      await tick()
      const o = orders.get(where.id as string)
      if (!o) throw new Prisma.PrismaClientKnownRequestError("Record not found", { code: "P2025", clientVersion: "5.22.0" })
      Object.assign(o, data, { updatedAt: data.updatedAt ?? now() })
      return { ...o }
    },
    updateMany: async ({ where, data }: { where: Where; data: Partial<FOrder> }) => {
      await tick()
      let count = 0
      for (const o of orders.values()) {
        if (orderMatch(o, where)) {
          Object.assign(o, data, { updatedAt: now() })
          count++
        }
      }
      return { count }
    },
  }

  const reading = {
    findFirst: async ({ where, select }: { where: Where; select?: Record<string, unknown> }) => {
      await tick()
      return pick([...readings.values()].find((r) => readingMatch(r, where)), select)
    },
    findUnique: async ({ where, select }: { where: Where; select?: Record<string, unknown> }) => {
      await tick()
      const r = [...readings.values()].find((x) => (where.id ? x.id === where.id : x.orderId === where.orderId))
      return pick(r, select)
    },
    create: async ({ data, select }: { data: Partial<FReading>; select?: Record<string, unknown> }) => {
      await tick()
      if ([...readings.values()].some((x) => x.orderId === data.orderId)) throw p2002("Reading.orderId")
      const r: FReading = {
        id: nid("rd_"), userId: data.userId!, orderId: data.orderId!, status: data.status ?? "COMPLETE",
        sajuInput: data.sajuInput ?? null, claims: null, userAnswers: null, fullReading: null,
        readingType: (data.readingType as string) ?? "BASIC", name: (data.name as string) ?? null, createdAt: now(),
        ...data,
      } as FReading
      readings.set(r.id, r)
      return pick(r, select)
    },
    updateMany: async ({ where, data }: { where: Where; data: Partial<FReading> }) => {
      await tick()
      let count = 0
      for (const r of readings.values()) {
        if (readingMatch(r, where)) {
          Object.assign(r, data)
          count++
        }
      }
      return { count }
    },
  }

  const releasers = new Map<string, () => void>()
  /** heldBy: 이 트랜잭션이 잡은 advisory 잠금 키 목록 (트랜잭션 밖 호출이면 undefined) */
  const makeExecuteRaw = (heldBy?: string[]) =>
    async function $executeRaw(strings: TemplateStringsArray, ...values: unknown[]) {
      const sql = strings.join("?")
      rawCalls.push(`${heldBy ? "tx" : "root"}: ${sql} | ${JSON.stringify(values)}`)
      const key = values.find((v) => typeof v === "string" && v.startsWith("free_reading:")) as string | undefined
      if (key && /pg_advisory_xact_lock/.test(sql)) {
        if (!heldBy) throw new Error("fakedb: 트랜잭션 밖 advisory xact lock은 즉시 풀린다(의미 없음)")
        while (locks.has(key)) await locks.get(key)
        locks.set(key, new Promise<void>((r) => releasers.set(key, () => { locks.delete(key); releasers.delete(key); r() })))
        heldBy.push(key)
      }
      await tick()
      return 1
    }

  const client = {
    user, order, reading, $executeRaw: makeExecuteRaw(),
    $transaction: async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> => {
      const mine: string[] = []
      try {
        return await cb({ user, order, reading, $executeRaw: makeExecuteRaw(mine) })
      } finally {
        for (const k of mine) releasers.get(k)?.()
      }
    },
  }

  return {
    client,
    users, orders, readings, rawCalls,
    setNow(fn: () => Date) { now = fn },
    seedUser(u: Partial<FUser> & { id: string }) { users.set(u.id, { email: null, name: null, ...u }); return users.get(u.id)! },
    seedOrder(o: Partial<FOrder> & { userId: string }) {
      const t = now()
      const row: FOrder = { id: nid("ord_"), orderId: `saju_${nid("x")}aaaaaaaa`, amount: 19900, status: "PENDING", paymentKey: null, createdAt: t, updatedAt: t, ...o }
      orders.set(row.id, row)
      return row
    },
    seedReading(r: Partial<FReading> & { userId: string; orderId: string }) {
      const row = {
        id: nid("rd_"), status: "PENDING", sajuInput: { name: "민지", gender: "여", birth: "1990-05-17", pillars: {}, known_facts: [] },
        claims: null, userAnswers: null, fullReading: null, readingType: "BASIC", name: null, createdAt: now(), ...r,
      } as FReading
      readings.set(row.id, row)
      return row
    },
  }
}

export type FakeDb = ReturnType<typeof createFakeDb>
