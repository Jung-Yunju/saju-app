// 실제 PostgreSQL 옛 스키마에서 호환 계층 + 주요 라우트 검증 — 담당: 백엔드·서버 개발자
// LEGACY_SCHEMA_TEST_DATABASE_URL(빈 개발·로컬 DB 접속 주소 — 운영 DB 금지)이 있을 때만 실행한다.
//   1) 임시 schema(legacy_test_…)를 만들고 마이그레이션 3개(init ~ add_reading_v2_fields)만 적용 = 운영 DB의 현재 모양
//   2) 실제 열 목록이 LEGACY_COLUMNS와 같은지 확인
//   3) 호환 계층 없이 부르면 "열 없음"으로 실패(대조군), 계층을 거치면 라우트(결제 준비·승인·무료 신청·생성·상태)와 화면 조회가 동작
//   4) 끝나면 임시 schema를 지운다
// 실행 예: LEGACY_SCHEMA_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/scratch npx vitest run src/lib/__tests__/db-legacy.pg.test.ts
import fs from "node:fs"
import path from "node:path"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { PrismaClient } from "@prisma/client"
import { LEGACY_COLUMNS, withLegacySchemaCompat } from "@/lib/db-legacy"

const URL_BASE = process.env.LEGACY_SCHEMA_TEST_DATABASE_URL
const OLD_MIGRATIONS = ["20261116090949_init", "20261117010755_add_reading_types", "20261117072144_add_reading_v2_fields"]

const h = vi.hoisted(() => ({
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
import { GET as statusGET } from "@/app/api/reading/[id]/status/route"

const BIRTH = { birthYear: 1990, birthMonth: 5, birthDay: 17, birthHour: 14, gender: "F", calType: "SOLAR" }
const post = (body?: unknown) =>
  new NextRequest("http://localhost/api", {
    method: "POST", body: body === undefined ? undefined : JSON.stringify(body), headers: { "content-type": "application/json" },
  })
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

function withSchema(url: string, schema: string) {
  const u = new URL(url)
  u.searchParams.set("schema", schema)
  return u.toString()
}

describe.skipIf(!URL_BASE)("실제 PostgreSQL 옛 스키마(마이그레이션 reading_v3_safety 전)", () => {
  const schema = `legacy_test_${Date.now().toString(36)}`
  let admin: PrismaClient
  let raw: PrismaClient
  let tossBody: unknown = null

  beforeAll(async () => {
    admin = new PrismaClient({ datasources: { db: { url: URL_BASE! } } })
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)
    raw = new PrismaClient({ datasources: { db: { url: withSchema(URL_BASE!, schema) } } })
    for (const m of OLD_MIGRATIONS) {
      const sql = fs.readFileSync(path.join(process.cwd(), "prisma", "migrations", m, "migration.sql"), "utf8")
      const statements = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").split(";").map((s) => s.trim()).filter(Boolean)
      for (const s of statements) await raw.$executeRawUnsafe(s)
    }
    await raw.user.create({ data: { id: "alice", email: "alice@example.com" } })
    h.client = withLegacySchemaCompat(raw)
  }, 60_000)

  afterAll(async () => {
    await raw?.$disconnect()
    await admin?.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
    await admin?.$disconnect()
  })

  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.stubEnv("DB_SCHEMA_V3", "")
    vi.stubEnv("TOSS_SECRET_KEY", "test_dummy_not_a_real_key")
    h.session = { user: { id: "alice", email: "alice@example.com", name: null } }
    h.ai.generateFullReading.mockReset().mockResolvedValue({ quote: "q", parts: [] })
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(tossBody), { status: 200 })))
    vi.spyOn(console, "warn").mockImplementation(() => {})
  })

  it("옛 DB의 실제 열 = LEGACY_COLUMNS", async () => {
    const cols = async (table: string) =>
      (await raw.$queryRawUnsafe<{ column_name: string }[]>(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`, schema, table,
      )).map((r) => r.column_name).sort()
    expect(await cols("Reading")).toEqual([...LEGACY_COLUMNS.Reading].sort())
    expect(await cols("Order")).toEqual([...LEGACY_COLUMNS.Order].sort())
    expect(await cols("AiUsage")).toEqual([])
  })

  it("대조군: 호환 계층 없이 부르면 실패한다", async () => {
    const order = await raw.order.create({ data: { userId: "alice", orderId: "ctrl_order_1", amount: 1 }, select: { id: true } })
    await expect(raw.order.findUnique({ where: { id: order.id } })).rejects.toThrow(/birthInfo.*does not exist/)
    await expect(raw.reading.create({
      data: { userId: "alice", orderId: order.id, birthYear: 1990, birthMonth: 1, birthDay: 1, gender: "F" }, select: { id: true },
    })).rejects.toThrow(/does not exist/)
    await expect(raw.reading.findMany({ where: { userId: "alice" } })).rejects.toThrow(/does not exist/)
  })

  it("결제 준비 → 승인 → 재승인 → 생성 → 상태, 무료 신청, 화면 조회", async () => {
    const { orderId, amount } = (await (await preparePOST(post(BIRTH))).json()) as { orderId: string; amount: number }
    tossBody = { orderId, status: "DONE", totalAmount: amount }
    const conf = await confirmPOST(post({ paymentKey: "pk_test", orderId, amount, birthInfo: BIRTH }))
    expect(conf.status).toBe(200)
    const { readingId } = (await conf.json()) as { readingId: string }
    expect(readingId).toMatch(/^c[0-9a-z]{24}$/)
    expect(await (await confirmPOST(post({ paymentKey: "pk_test", orderId, amount, birthInfo: BIRTH }))).json()).toEqual({ readingId })

    expect((await generatePOST(post(), ctx(readingId))).status).toBe(200)
    expect(await (await statusGET(new NextRequest("http://localhost/api"), ctx(readingId))).json()).toEqual({ status: "COMPLETE" })

    const d = await directPOST(post({ ...BIRTH, readingType: "MONEY", name: "민지" }))
    expect(d.status).toBe(200)
    const freeId = ((await d.json()) as { readingId: string }).readingId

    const c = h.client as PrismaClient
    const one = await c.reading.findUnique({ where: { id: freeId } })
    expect(one).toMatchObject({ userId: "alice", readingType: "MONEY", name: "민지", status: "PENDING", calType: "SOLAR", content: "" })
    expect(one!.createdAt).toBeInstanceOf(Date)
    expect(Math.abs(one!.createdAt.getTime() - Date.now())).toBeLessThan(60_000) // UTC로 저장됐는지(시간대 어긋남 없음)
    expect((one!.sajuInput as { pillars?: unknown }).pillars).toBeTruthy()
    const list = await c.reading.findMany({ where: { userId: "alice" }, orderBy: { createdAt: "desc" } })
    expect(list.map((r) => r.id)).toEqual([freeId, readingId])
    const withOrder = await c.reading.findFirst({ where: { id: readingId }, include: { order: true } })
    expect(withOrder!.order).toMatchObject({ orderId, status: "PAID", amount })
  })

  it("같은 주문으로 두 번 만들면 P2002(라우트의 동시 요청 처리와 같은 코드)", async () => {
    const c = h.client as PrismaClient
    const order = await c.order.create({ data: { userId: "alice", orderId: "dup_order_1", amount: 1 } })
    const data = { userId: "alice", orderId: order.id, birthYear: 1990, birthMonth: 1, birthDay: 1, gender: "F" }
    await c.reading.create({ data, select: { id: true } })
    await expect(c.reading.create({ data, select: { id: true } })).rejects.toMatchObject({ code: "P2002" })
  })
})
