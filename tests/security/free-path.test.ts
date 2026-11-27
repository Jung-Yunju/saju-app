// U-01 독립 검증 — ① 결제 없는 풀이(direct) 차단과 무료 일일 한도, ③ 입력 크기·형식, session-user
// DB는 메모리 fake(advisory xact lock 흉내 포함), 로그인은 @/lib/auth mock. 실DB advisory lock 동작은 미검증.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { createFakeDb, type FakeDb } from "./_fakedb"

const h = vi.hoisted(() => ({
  db: null as unknown as FakeDb,
  session: null as null | { user: { id?: string; email?: string | null; name?: string | null } },
}))
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return h.db.client
  },
}))
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => h.session) }))

import { POST as directPOST } from "@/app/api/reading/direct/route"
import { getSessionUser } from "@/lib/session-user"

const VALID = { readingType: "BASIC", birthYear: 1990, birthMonth: 5, birthDay: 17, birthHour: 9, gender: "F", calType: "SOLAR" }
const req = (body: unknown, raw?: string) =>
  new NextRequest("http://localhost/api", {
    method: "POST",
    body: raw ?? JSON.stringify(body),
    headers: { "content-type": "application/json" },
  })
const login = (id: string, email: string | null = `${id}@example.com`) => {
  h.session = { user: { id, email, name: null } }
}

beforeEach(() => {
  h.db = createFakeDb()
  h.db.seedUser({ id: "alice", email: "alice@example.com" })
  login("alice")
  vi.unstubAllEnvs()
  vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe("① 운영 기본값: 결제 없는 풀이 경로 닫힘", () => {
  it.each([undefined, "", "false", "TRUE", "1", "yes", " true"])("NODE_ENV=production, ALLOW_FREE_READING=%j → 403, DB·세션 접근 없음", async (v) => {
    vi.stubEnv("NODE_ENV", "production")
    if (v !== undefined) vi.stubEnv("ALLOW_FREE_READING", v)
    const spy = vi.spyOn(h.db.client.order, "create")
    const res = await directPOST(req(VALID))
    expect(res.status).toBe(403)
    expect(spy).not.toHaveBeenCalled()
    expect(h.db.orders.size).toBe(0)
  })

  it("운영에서 허용(true)해도 로그인 없으면 401", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("ALLOW_FREE_READING", "true")
    h.session = null
    expect((await directPOST(req(VALID))).status).toBe(401)
  })

  it("direct는 AI를 부르지 않고 PENDING 레코드만 만든다 (생성은 1회 잠금 경로로만)", async () => {
    const res = await directPOST(req(VALID))
    expect(res.status).toBe(200)
    const r = [...h.db.readings.values()][0]
    expect(r.status).toBe("PENDING")
    expect(r.fullReading).toBeNull()
    const o = [...h.db.orders.values()][0]
    expect(o).toMatchObject({ amount: 0, status: "PAID" })
    expect(o.orderId).toMatch(/^free_[0-9a-f]{32}$/)
  })
})

describe("무료 일일 한도 (24시간 이동 창)", () => {
  it("동시 요청 10개 → 한도(3)만큼만 생성, 나머지 429 (advisory lock 흉내 하에서)", async () => {
    const res = await Promise.all(Array.from({ length: 10 }, () => directPOST(req(VALID))))
    expect(res.filter((r) => r.status === 200)).toHaveLength(3)
    expect(res.filter((r) => r.status === 429)).toHaveLength(7)
    expect(h.db.orders.size).toBe(3)
    expect(h.db.readings.size).toBe(3)
  })

  it("advisory lock은 같은 트랜잭션 안에서, 한도 검사 전에, 사용자별 키로 잡는다", async () => {
    await directPOST(req(VALID))
    expect(h.db.rawCalls).toHaveLength(1)
    expect(h.db.rawCalls[0]).toMatch(/^tx: SELECT pg_advisory_xact_lock\(hashtext\(\?\)\)/)
    expect(h.db.rawCalls[0]).toContain('"free_reading:alice"')
  })

  it("한도는 달력 날짜가 아니라 직전 24시간 — 자정(KST·UTC)을 넘겨도 초기화되지 않는다", async () => {
    let t = new Date("2026-11-27T14:50:00Z").getTime() // KST 23:50
    vi.useFakeTimers({ now: t, toFake: ["Date"] })
    h.db.setNow(() => new Date(Date.now()))
    for (let i = 0; i < 3; i++) expect((await directPOST(req(VALID))).status).toBe(200)
    t += 20 * 60_000 // KST 다음 날 00:10
    vi.setSystemTime(t)
    expect((await directPOST(req(VALID))).status).toBe(429)
    t = new Date("2026-11-28T00:10:00Z").getTime() // UTC 자정 넘김
    vi.setSystemTime(t)
    expect((await directPOST(req(VALID))).status).toBe(429)
    t = new Date("2026-11-28T14:50:01Z").getTime() // 24시간 경과
    vi.setSystemTime(t)
    expect((await directPOST(req(VALID))).status).toBe(200)
    vi.useRealTimers()
  })

  it("유료 주문(19900원)은 무료 한도에 세지 않고, 다른 사용자 무료 사용량도 세지 않는다", async () => {
    h.db.seedUser({ id: "bob", email: "bob@example.com" })
    for (let i = 0; i < 5; i++) h.db.seedOrder({ userId: "alice", amount: 19900, status: "PAID" })
    for (let i = 0; i < 5; i++) h.db.seedOrder({ userId: "bob", amount: 0, status: "PAID" })
    expect((await directPOST(req(VALID))).status).toBe(200)
  })

  it("FREE_READING_DAILY_LIMIT 잘못된 값(음수·문자·과대)이면 기본 3 또는 그 값", async () => {
    vi.stubEnv("FREE_READING_DAILY_LIMIT", "-5")
    for (let i = 0; i < 3; i++) await directPOST(req(VALID))
    expect((await directPOST(req(VALID))).status).toBe(429)
  })

  it("한도 초과 응답에 내부 정보 없음", async () => {
    vi.stubEnv("FREE_READING_DAILY_LIMIT", "0")
    const res = await directPOST(req(VALID))
    expect(res.status).toBe(429)
    expect(JSON.stringify(await res.json())).not.toMatch(/prisma|advisory|alice/)
  })
})

describe("③ 입력 크기·형식 (direct)", () => {
  it("이름 21자 이상·문자열 아님 → 400, 레코드 없음", async () => {
    for (const name of ["가".repeat(21), "x".repeat(10_000), 123, ["a"], { a: 1 }]) {
      expect((await directPOST(req({ ...VALID, name }))).status).toBe(400)
    }
    expect(h.db.readings.size).toBe(0)
  })

  it("상대방 이름도 같은 규칙 (2인 풀이)", async () => {
    const two = { ...VALID, readingType: "CONFLICT", otherBirthYear: 1991, otherBirthMonth: 1, otherBirthDay: 2, otherGender: "M" }
    expect((await directPOST(req({ ...two, otherName: "나".repeat(21) }))).status).toBe(400)
    expect((await directPOST(req({ ...two, otherName: "<b>철수</b>" }))).status).toBe(200)
    const r = [...h.db.readings.values()][0]
    expect(r.otherName).not.toMatch(/[<>]/)
  })

  it("보이지 않는 문자·방향 제어·제어문자·꺾쇠는 저장 전에 제거, 프롬프트용 sajuInput에도 반영", async () => {
    const res = await directPOST(req({ ...VALID, name: "민​지‮<>\u0000\u0007" }))
    expect(res.status).toBe(200)
    const r = [...h.db.readings.values()][0]
    expect(r.name).toBe("민지")
    expect((r.sajuInput as { name: string }).name).toBe("민지")
    expect((r.sajuInput as { known_facts: unknown[] }).known_facts).toEqual([])
  })

  it("본문 8KB 초과(Content-Length 있음·없음)·깨진 UTF-8·JSON 아님 → 400", async () => {
    expect((await directPOST(req({ ...VALID, pad: "x".repeat(9000) }))).status).toBe(400)
    const big = new TextEncoder().encode(JSON.stringify({ ...VALID, pad: "x".repeat(9000) }))
    const stream = new ReadableStream({
      start(c) {
        for (let i = 0; i < big.length; i += 1000) c.enqueue(big.slice(i, i + 1000))
        c.close()
      },
    })
    expect((await directPOST(new NextRequest("http://localhost/api", { method: "POST", body: stream, duplex: "half" } as never))).status).toBe(400)
    // Content-Length를 작게 속여도 실제 바이트로 다시 잰다 (런타임이 이 헤더를 버릴 수 있어도 결과는 같아야 함)
    const lie = new NextRequest("http://localhost/api", { method: "POST", body: JSON.stringify({ ...VALID, pad: "x".repeat(9000) }), headers: { "content-length": "10" } })
    expect((await directPOST(lie)).status).toBe(400)
    const bad = new NextRequest("http://localhost/api", { method: "POST", body: new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]) })
    expect((await directPOST(bad)).status).toBe(400)
    expect((await directPOST(req(null, "not json"))).status).toBe(400)
    expect((await directPOST(req(null, "[]"))).status).toBe(400)
    expect(h.db.orders.size).toBe(0)
  })

  it("허용 밖 풀이 종류·성별·양음력·연도·시 → 400", async () => {
    for (const patch of [
      { readingType: "ADMIN" }, { readingType: "__proto__" }, { gender: "X" }, { calType: "MARS" },
      { birthYear: 1899 }, { birthYear: 2101 }, { birthHour: 24 }, { birthHour: -1 }, { birthHour: "9; DROP" },
      { birthYear: "1990.5" }, { birthMonth: 0 }, { birthDay: 32 },
    ]) {
      expect((await directPOST(req({ ...VALID, ...patch }))).status, JSON.stringify(patch)).toBe(400)
    }
    expect(h.db.orders.size).toBe(0)
  })

  it("클라이언트가 status·userId·amount·sajuInput을 보내도 무시", async () => {
    h.db.seedUser({ id: "victim", email: "v@example.com" })
    const res = await directPOST(req({ ...VALID, status: "COMPLETE", userId: "victim", amount: 99, sajuInput: { known_facts: ["x"] }, fullReading: { a: 1 } }))
    expect(res.status).toBe(200)
    const r = [...h.db.readings.values()][0]
    expect(r).toMatchObject({ userId: "alice", status: "PENDING", fullReading: null })
    expect((r.sajuInput as { known_facts: unknown[] }).known_facts).toEqual([])
  })
})

describe("⑥ session-user (모든 API가 쓰는 userId 판별)", () => {
  it("세션 없음·id 없음 → null", async () => {
    h.session = null
    expect(await getSessionUser()).toBeNull()
    h.session = { user: { email: "alice@example.com" } }
    expect(await getSessionUser()).toBeNull()
  })

  it("createIfMissing: 동시 호출 5개여도 사용자 1명만 생성, 모두 같은 id", async () => {
    login("newbie", "newbie@example.com")
    const r = await Promise.all(Array.from({ length: 5 }, () => getSessionUser({ createIfMissing: true })))
    expect(new Set(r.map((x) => x!.userId))).toEqual(new Set(["newbie"]))
    expect([...h.db.users.values()].filter((u) => u.id === "newbie")).toHaveLength(1)
  })

  it("createIfMissing이 아니면 사용자를 만들지 않는다 (조회 경로가 DB를 바꾸지 않음)", async () => {
    login("ghost", "ghost@example.com")
    expect((await getSessionUser())!.userId).toBe("ghost")
    expect(h.db.users.has("ghost")).toBe(false)
  })
})
