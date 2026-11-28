// 옛 DB 스키마 호환 계층(src/lib/db-legacy.ts) — DB_SCHEMA_V3가 꺼진 채(마이그레이션 전 운영 DB) 배포해도 되는가
// 담당: 백엔드·서버 개발자. DB는 옛 스키마 흉내(_legacy-prisma.ts — 새 열을 고르거나 쓰면 실패), 로그인·AI·토스는 mock.
// 실제 PostgreSQL 검증은 db-legacy.pg.test.ts(환경변수 있을 때만).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
import { createLegacyPrisma, LegacySchemaError } from "./_legacy-prisma"
import {
  LEGACY_COLUMNS, V3_FIELDS, buildLegacyReadingInsert, isDbSchemaV3, legacyId, shapeSelection, stripV3Data,
  withLegacySchemaCompat,
} from "@/lib/db-legacy"

const h = vi.hoisted(() => ({
  legacy: null as unknown as ReturnType<typeof createLegacyPrisma>,
  client: null as unknown,
  session: null as null | { user: { id?: string; email?: string | null; name?: string | null } },
  ai: { generateFullReading: vi.fn(), generateClaims: vi.fn() },
}))
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return h.client
  },
}))
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => h.session) }))
vi.mock("@/lib/generate-reading-v2", () => h.ai)

import { POST as preparePOST } from "@/app/api/payment/prepare/route"
import { POST as confirmPOST } from "@/app/api/payment/confirm/route"
import { POST as directPOST } from "@/app/api/reading/direct/route"
import { POST as generatePOST } from "@/app/api/reading/[id]/generate/route"
import { POST as claimsPOST } from "@/app/api/reading/[id]/claims/route"
import { GET as statusGET } from "@/app/api/reading/[id]/status/route"

const BIRTH = { birthYear: 1990, birthMonth: 5, birthDay: 17, birthHour: 14, gender: "F", calType: "SOLAR" }
const post = (body?: unknown) =>
  new NextRequest("http://localhost/api", {
    method: "POST", body: body === undefined ? undefined : JSON.stringify(body), headers: { "content-type": "application/json" },
  })
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const V3_READING_COLUMNS = V3_FIELDS.Reading.filter((k) => k !== "aiUsages")

let tossBody: unknown = null
const fetchMock = vi.fn(async () => new Response(JSON.stringify(tossBody), { status: 200 }))

beforeEach(() => {
  vi.unstubAllEnvs()
  vi.stubEnv("DB_SCHEMA_V3", "") // 꺼짐 = 옛 스키마
  vi.stubEnv("TOSS_SECRET_KEY", "test_dummy_not_a_real_key")
  h.legacy = createLegacyPrisma()
  h.legacy.db.seedUser({ id: "alice", email: "alice@example.com" })
  h.client = withLegacySchemaCompat(h.legacy.client)
  h.session = { user: { id: "alice", email: "alice@example.com", name: null } }
  h.ai.generateFullReading.mockReset().mockResolvedValue({ quote: "q", parts: [] })
  h.ai.generateClaims.mockReset().mockResolvedValue({ claims: [{ id: "c1", text: "t" }] })
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockClear()
  vi.spyOn(console, "warn").mockImplementation(() => {})
  vi.spyOn(console, "info").mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

const errors = () => (console.error as unknown as { mock?: { calls: unknown[][] } }).mock?.calls ?? []
const noV3Columns = (row: Record<string, unknown>) => V3_READING_COLUMNS.filter((k) => k in row)

describe("목록 — schema와 옛 열·새 열 목록이 어긋나지 않는다", () => {
  it("모델 필드 = 옛 열 + 새 항목 + 기존 관계 (새 열이 생기면 여기서 걸린다 → 옛 스키마 호환 여부를 정하고 목록 갱신)", () => {
    const fields = (m: string) => Prisma.dmmf.datamodel.models.find((x) => x.name === m)!.fields.map((f) => f.name).sort()
    expect(fields("Reading")).toEqual([...LEGACY_COLUMNS.Reading, ...V3_FIELDS.Reading, "user", "order"].sort())
    expect(fields("Order")).toEqual([...LEGACY_COLUMNS.Order, ...V3_FIELDS.Order, "user", "reading"].sort())
  })
  it("isDbSchemaV3는 정확히 'true'일 때만", () => {
    for (const v of [undefined, "", "1", "TRUE", " true"]) expect(isDbSchemaV3({ DB_SCHEMA_V3: v })).toBe(false)
    expect(isDbSchemaV3({ DB_SCHEMA_V3: "true" })).toBe(true)
  })
})

describe("선택 열 다듬기(순수 함수)", () => {
  it("select 없음 → 옛 열 전부, include → select로 바꾸고 관계도 옛 열만", () => {
    const a = shapeSelection("Reading", { where: { id: "x" }, include: { order: true } })
    expect(a.include).toBeUndefined()
    expect(Object.keys(a.select as object).sort()).toEqual([...LEGACY_COLUMNS.Reading, "order"].sort())
    expect(((a.select as Record<string, { select: object }>).order.select)).toEqual(
      Object.fromEntries(LEGACY_COLUMNS.Order.map((c) => [c, true])),
    )
  })
  it("select의 새 열은 빠지고 뺀 이름이 기록된다 / 다 빠지면 id만", () => {
    const dropped: string[] = []
    expect(shapeSelection("Reading", { select: { status: true, attemptCount: true } }, dropped).select).toEqual({ status: true })
    expect(dropped).toEqual(["Reading.attemptCount"])
    expect(shapeSelection("Reading", { select: { lockedAt: true } }).select).toEqual({ id: true })
  })
  it("User → readings·orders 관계로 내려가도 옛 열만", () => {
    const a = shapeSelection("User", { where: { id: "u" }, include: { readings: true, orders: { where: { amount: 0 } } } })
    const inc = a.include as Record<string, { select: Record<string, true> }>
    expect(Object.keys(inc.readings.select).sort()).toEqual([...LEGACY_COLUMNS.Reading].sort())
    expect(Object.keys(inc.orders.select).sort()).toEqual([...LEGACY_COLUMNS.Order].sort())
  })
  it("쓰기 data에서 새 열을 뺀다(upsert create·update, createMany 배열 포함)", () => {
    expect(stripV3Data("Order", { data: { amount: 1, birthInfo: { a: 1 } } }).data).toEqual({ amount: 1 })
    expect(stripV3Data("Reading", { data: [{ status: "A", attemptCount: 1 }] }).data).toEqual([{ status: "A" }])
    const u = stripV3Data("Reading", { create: { status: "A", lockedAt: new Date() }, update: { isLeapMonth: true } })
    expect([u.create, u.update]).toEqual([{ status: "A" }, {}])
  })
  it("Reading INSERT: 옛 열만, 값은 모두 바인딩 변수, 모르는 키는 오류", () => {
    const { id, sql } = buildLegacyReadingInsert({ userId: "u", orderId: "o", birthYear: 1990, sajuInput: { a: 1 }, claims: null })
    expect(id).toMatch(/^c[0-9a-z]{24}$/)
    expect(sql.sql).toMatch(/^INSERT INTO "Reading" \("userId", "orderId", "birthYear", "sajuInput", "claims", "id", "createdAt"\) VALUES/)
    expect(sql.values).toEqual(["u", "o", 1990, '{"a":1}', null, id, expect.any(String)])
    expect(() => buildLegacyReadingInsert({ userId: "u", user: { connect: { id: "u" } } })).toThrow(/지원하지 않는 항목: user/)
    expect(new Set(Array.from({ length: 50 }, legacyId)).size).toBe(50)
  })
})

describe("가짜 옛 DB가 실제로 엄격하다(대조군 — 호환 계층 없이 부르면 실패)", () => {
  it("select 없는 조회·Reading.create(기본값 열)·Order 전체 RETURNING은 실패", async () => {
    const raw = h.legacy.client as unknown as {
      reading: { findUnique(a: unknown): Promise<unknown>; create(a: unknown): Promise<unknown> }
      order: { create(a: unknown): Promise<unknown> }
    }
    await expect(raw.reading.findUnique({ where: { id: "x" } })).rejects.toBeInstanceOf(LegacySchemaError)
    await expect(raw.reading.create({ data: { userId: "alice", orderId: "o", birthYear: 1, birthMonth: 1, birthDay: 1, gender: "F" }, select: { id: true } }))
      .rejects.toThrow(/Reading\.isLeapMonth/)
    await expect(raw.order.create({ data: { userId: "alice", orderId: "oooooo", amount: 1 } })).rejects.toBeInstanceOf(LegacySchemaError)
  })
  it("스위치를 켜면 호환 계층은 아무것도 바꾸지 않는다(→ 옛 DB에서는 실패 = 켜기 전 마이그레이션 필수)", async () => {
    vi.stubEnv("DB_SCHEMA_V3", "true")
    const c = h.client as { reading: { findMany(a: unknown): Promise<unknown> } }
    await expect(c.reading.findMany({ where: { userId: "alice" } })).rejects.toBeInstanceOf(LegacySchemaError)
  })
})

describe("스위치 끔 + 옛 스키마 DB: 주요 라우트가 정상 동작", () => {
  it("결제 준비 → 승인 → (새로고침) 재승인 → 풀이 생성 → 상태 조회", async () => {
    const prep = await preparePOST(post(BIRTH))
    expect(prep.status).toBe(200)
    const { orderId, amount } = (await prep.json()) as { orderId: string; amount: number }
    const order = [...h.legacy.db.orders.values()].find((o) => o.orderId === orderId)!
    expect("birthInfo" in order && (order as { birthInfo?: unknown }).birthInfo != null).toBe(false)

    tossBody = { orderId, status: "DONE", totalAmount: amount }
    const conf = await confirmPOST(post({ paymentKey: "pk_test", orderId, amount, birthInfo: BIRTH }))
    expect(conf.status).toBe(200)
    const { readingId } = (await conf.json()) as { readingId: string }
    const row = h.legacy.db.readings.get(readingId) as unknown as Record<string, unknown>
    expect(row).toMatchObject({ userId: "alice", status: "PENDING", birthYear: 1990, readingType: "BASIC", gender: "F" })
    expect(noV3Columns(row)).toEqual([])
    expect(h.legacy.rawInserts).toHaveLength(1)

    const again = await confirmPOST(post({ paymentKey: "pk_test", orderId, amount, birthInfo: BIRTH }))
    expect(await again.json()).toEqual({ readingId })

    const gen = await generatePOST(post(), ctx(readingId))
    expect(gen.status).toBe(200)
    expect(h.legacy.db.readings.get(readingId)!.status).toBe("COMPLETE")
    expect(h.ai.generateFullReading).toHaveBeenCalledTimes(1)

    const st = await statusGET(new NextRequest("http://localhost/api"), ctx(readingId))
    expect(await st.json()).toEqual({ status: "COMPLETE" })

    // 완료 후 다시 생성 요청 → AI 호출 없이 완료 응답
    const gen2 = await generatePOST(post(), ctx(readingId))
    expect(await gen2.json()).toMatchObject({ alreadyCompleted: true })
    expect(h.ai.generateFullReading).toHaveBeenCalledTimes(1)
    expect(errors()).toEqual([])
  })

  it("결제 승인 동시 요청 — 원시 INSERT의 중복 오류도 P2002로 바뀌어 같은 풀이 id", async () => {
    const { orderId, amount } = (await (await preparePOST(post(BIRTH))).json()) as { orderId: string; amount: number }
    tossBody = { orderId, status: "DONE", totalAmount: amount }
    const [a, b] = await Promise.all([
      confirmPOST(post({ paymentKey: "pk_test", orderId, amount, birthInfo: BIRTH })),
      confirmPOST(post({ paymentKey: "pk_test", orderId, amount, birthInfo: BIRTH })),
    ])
    const ids = [(await a.json()).readingId, (await b.json()).readingId]
    expect(ids[0]).toBeTruthy()
    expect(ids[1]).toBe(ids[0])
    expect(h.legacy.db.readings.size).toBe(1)
  })

  it("무료 신청(direct) → 생성 실패 → 다시 시도 / 개발용 claims", async () => {
    const res = await directPOST(post({ ...BIRTH, readingType: "MONEY", name: "민지" }))
    expect(res.status).toBe(200)
    const { readingId } = (await res.json()) as { readingId: string }
    const row = h.legacy.db.readings.get(readingId) as unknown as Record<string, unknown>
    expect(row).toMatchObject({ status: "PENDING", readingType: "MONEY", name: "민지" })
    expect(noV3Columns(row)).toEqual([])

    vi.spyOn(console, "error").mockImplementation(() => {})
    h.ai.generateFullReading.mockRejectedValueOnce(new Error("AI 실패"))
    expect((await generatePOST(post(), ctx(readingId))).status).toBe(500)
    expect(h.legacy.db.readings.get(readingId)!.status).toBe("FAILED")
    expect((await generatePOST(post(), ctx(readingId))).status).toBe(200)

    const d2 = await directPOST(post({ ...BIRTH, readingType: "BASIC" }))
    const id2 = ((await d2.json()) as { readingId: string }).readingId
    const cl = await claimsPOST(post(), ctx(id2))
    expect(cl.status).toBe(200)
    expect(h.legacy.db.readings.get(id2)!.status).toBe("VERIFYING")
  })

  it("화면(서버 컴포넌트)이 쓰는 조회 모양 — select 없는 findUnique·findMany도 옛 열만 읽는다", async () => {
    // src/app/reading/[id]/page.tsx · src/app/verify/[id]/page.tsx · src/app/my-readings/page.tsx 와 같은 인자
    const res = await directPOST(post({ ...BIRTH, readingType: "LOVE" }))
    const { readingId } = (await res.json()) as { readingId: string }
    const c = h.client as {
      reading: { findUnique(a: unknown): Promise<Record<string, unknown>>; findMany(a: unknown): Promise<Record<string, unknown>[]> }
      user: { findUnique(a: unknown): Promise<unknown> }
    }
    const one = await c.reading.findUnique({ where: { id: readingId } })
    expect(Object.keys(one).sort()).toEqual([...LEGACY_COLUMNS.Reading].sort())
    expect(one).toMatchObject({ userId: "alice", readingType: "LOVE", calType: "SOLAR", birthHour: 14 })
    const list = await c.reading.findMany({ where: { userId: "alice" }, orderBy: { createdAt: "desc" } })
    expect(list.map((r) => r.id)).toEqual([readingId])
    expect(await c.user.findUnique({ where: { email: "alice@example.com" } })).toMatchObject({ id: "alice" })
  })
})
