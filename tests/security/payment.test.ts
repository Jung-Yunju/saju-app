// U-01 독립 검증 — 결제 준비·승인(payment/prepare, payment/confirm)
// 토스 API는 fetch mock. 실제 토스 응답 코드·동작은 미검증(공식 문서 기준 mock).
// DB는 메모리 fake, 로그인은 @/lib/auth mock, session-user.ts는 실제 코드.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
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

import { POST as confirmPOST } from "@/app/api/payment/confirm/route"
import { POST as preparePOST } from "@/app/api/payment/prepare/route"

const SECRET = "test_sk_DO_NOT_LEAK_123"
const BIRTH = { birthYear: 1990, birthMonth: 5, birthDay: 17, birthHour: 9, gender: "F", calType: "SOLAR" }
const req = (body: unknown) =>
  new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } })
const login = (id: string) => {
  h.session = { user: { id, email: `${id}@example.com`, name: null } }
}

type TossReply = { status: number; body: unknown } | "network"
let tossConfirm: TossReply[] = []
let tossLookup: TossReply[] = []
const fetchMock = vi.fn(async (url: string | URL, _init?: RequestInit) => {
  const u = String(url)
  const q = u.endsWith("/confirm") ? tossConfirm : tossLookup
  const r = q.length > 1 ? q.shift()! : q[0]
  if (!r) throw new Error(`예상하지 못한 fetch ${u}`)
  if (r === "network") throw new TypeError("fetch failed")
  return new Response(JSON.stringify(r.body), { status: r.status, headers: { "content-type": "application/json" } })
})
const done = (orderId: string, amount = 19900) => ({ status: 200, body: { orderId, status: "DONE", totalAmount: amount } })

let logs: string[] = []
beforeEach(() => {
  h.db = createFakeDb()
  h.db.seedUser({ id: "alice", email: "alice@example.com" })
  h.db.seedUser({ id: "mallory", email: "mallory@example.com" })
  login("alice")
  vi.unstubAllEnvs()
  vi.stubEnv("TOSS_SECRET_KEY", SECRET)
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockClear()
  tossConfirm = []
  tossLookup = []
  logs = []
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => {
    logs.push(a.map((x) => (x instanceof Error ? `${x.message}` : typeof x === "string" ? x : JSON.stringify(x))).join(" "))
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const pendingOrder = (userId = "alice", extra = {}) =>
  h.db.seedOrder({ userId, orderId: `saju_${Math.random().toString(36).slice(2)}abcdef`, amount: 19900, status: "PENDING", ...extra })
const body = (orderId: string, extra: Record<string, unknown> = {}) => ({ paymentKey: "pk_test_1", orderId, amount: 19900, birthInfo: BIRTH, ...extra })

describe("prepare — 금액·상품은 서버가 정한다", () => {
  it("클라이언트가 보낸 amount·readingType·status·userId는 무시, 19900원 PENDING 주문", async () => {
    const res = await preparePOST(req({ ...BIRTH, amount: 1, readingType: "CONFLICT", status: "PAID", userId: "mallory" }))
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.amount).toBe(19900)
    const o = [...h.db.orders.values()][0]
    expect(o).toMatchObject({ userId: "alice", amount: 19900, status: "PENDING" })
    expect(o.orderId).toMatch(/^saju_[0-9a-f]{32}$/)
  })
  it("로그인 없음 401, 잘못된 생년월일 400 — 주문을 만들지 않는다", async () => {
    h.session = null
    expect((await preparePOST(req(BIRTH))).status).toBe(401)
    login("alice")
    expect((await preparePOST(req({ ...BIRTH, birthMonth: 2, birthDay: 30 }))).status).toBe(400)
    expect(h.db.orders.size).toBe(0)
  })
})

describe("confirm — 결제 금액·주문번호 위조", () => {
  it("금액을 바꿔 보내면 토스 호출 없이 400", async () => {
    const o = pendingOrder()
    for (const amount of [100, 0, -19900, "19900", 19900.0001, null]) {
      const res = await confirmPOST(req(body(o.orderId, { amount })))
      expect(res.status, String(amount)).toBe(400)
    }
    expect(fetchMock).not.toHaveBeenCalled()
    expect(h.db.orders.get(o.id)!.status).toBe("PENDING")
  })

  it("남의 주문번호 → 400, 토스 호출·상태 변경 없음", async () => {
    const o = pendingOrder("mallory")
    const res = await confirmPOST(req(body(o.orderId)))
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(h.db.readings.size).toBe(0)
  })

  it("남의 PAID 주문번호로 풀이를 얻을 수 없다", async () => {
    const o = h.db.seedOrder({ userId: "mallory", status: "PAID", orderId: "saju_paidbymallory01" })
    h.db.seedReading({ userId: "mallory", orderId: o.id })
    const res = await confirmPOST(req(body(o.orderId)))
    expect(res.status).toBe(400)
    expect(JSON.stringify(await res.json())).not.toContain("rd_")
  })

  it("0원(무료 경로) 주문에 결제 확인으로 풀이를 붙일 수 없다", async () => {
    const o = h.db.seedOrder({ userId: "alice", amount: 0, status: "PAID", orderId: "free_0000000000000001" })
    const res = await confirmPOST(req(body(o.orderId, { amount: 0 })))
    expect(res.status).toBe(400)
    expect(h.db.readings.size).toBe(0)
  })

  it("주문번호·결제키 형식 위반(경로 조작·과도한 길이) → 400, 토스 호출 없음", async () => {
    for (const orderId of ["../../v1/x", "a b", "x".repeat(65), "short", 123]) {
      expect((await confirmPOST(req(body(orderId as string)))).status).toBe(400)
    }
    const o = pendingOrder()
    for (const paymentKey of ["../cancel", "a/b", "x".repeat(201), "", { $ne: 1 }]) {
      expect((await confirmPOST(req(body(o.orderId, { paymentKey })))).status).toBe(400)
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("토스가 200이지만 금액이 다르면 PAID로 바꾸지 않는다 (502)", async () => {
    const o = pendingOrder()
    tossConfirm = [{ status: 200, body: { orderId: o.orderId, status: "DONE", totalAmount: 100 } }]
    const res = await confirmPOST(req(body(o.orderId)))
    expect(res.status).toBe(502)
    expect(h.db.orders.get(o.id)!.status).toBe("PENDING")
    expect(h.db.readings.size).toBe(0)
  })

  it("토스가 200이지만 다른 주문번호·DONE 아님이면 PAID로 바꾸지 않는다", async () => {
    for (const b of [
      { orderId: "saju_other00000000", status: "DONE", totalAmount: 19900 },
      { status: "WAITING_FOR_DEPOSIT", totalAmount: 19900 },
      {},
    ]) {
      const o = pendingOrder()
      tossConfirm = [{ status: 200, body: { ...b, orderId: (b as { orderId?: string }).orderId ?? o.orderId } }]
      const res = await confirmPOST(req(body(o.orderId)))
      expect(res.status).toBe(502)
      expect(h.db.orders.get(o.id)!.status).toBe("PENDING")
    }
    expect(h.db.readings.size).toBe(0)
  })

  it("결제 금액은 서버 주문 금액으로 토스에 보낸다, 상품은 BASIC 고정", async () => {
    const o = pendingOrder()
    tossConfirm = [done(o.orderId)]
    const res = await confirmPOST(req(body(o.orderId, { readingType: "CONFLICT" })))
    expect(res.status).toBe(200)
    const sent = JSON.parse(fetchMock.mock.calls[0][1]!.body as string)
    expect(sent).toEqual({ paymentKey: "pk_test_1", orderId: o.orderId, amount: 19900 })
    const r = [...h.db.readings.values()][0]
    expect(r.readingType).toBe("BASIC")
    expect(r.status).toBe("PENDING")
  })
})

describe("confirm — ④ 승인 후 복구·동시 요청", () => {
  it("생년월일이 잘못되면 토스 승인 전에 400 (돈이 나간 뒤 실패하는 상황 방지)", async () => {
    const o = pendingOrder()
    for (const birthInfo of [{ ...BIRTH, birthMonth: 13 }, { ...BIRTH, birthYear: 1800 }, null, "x"]) {
      expect((await confirmPOST(req(body(o.orderId, { birthInfo })))).status).toBe(400)
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("토스 네트워크 오류 → 502, 주문 PENDING 유지 → 다시 보내면 승인", async () => {
    const o = pendingOrder()
    tossConfirm = ["network"]
    expect((await confirmPOST(req(body(o.orderId)))).status).toBe(502)
    expect(h.db.orders.get(o.id)!.status).toBe("PENDING")
    tossConfirm = [done(o.orderId)]
    expect((await confirmPOST(req(body(o.orderId)))).status).toBe(200)
    expect(h.db.orders.get(o.id)!.status).toBe("PAID")
  })

  it("이미 승인된 결제(ALREADY_PROCESSED_PAYMENT) → 조회로 확인 후 PAID", async () => {
    const o = pendingOrder()
    tossConfirm = [{ status: 400, body: { code: "ALREADY_PROCESSED_PAYMENT" } }]
    tossLookup = [done(o.orderId)]
    expect((await confirmPOST(req(body(o.orderId)))).status).toBe(200)
    expect(h.db.orders.get(o.id)!.status).toBe("PAID")
  })

  it("다른 주문에서 쓴 결제키를 재사용하면(조회 결과 주문번호 불일치) PAID가 되지 않는다", async () => {
    const o = pendingOrder()
    tossConfirm = [{ status: 400, body: { code: "ALREADY_PROCESSED_PAYMENT" } }]
    tossLookup = [done("saju_someotherorder01")]
    expect((await confirmPOST(req(body(o.orderId)))).status).toBe(502)
    expect(h.db.orders.get(o.id)!.status).toBe("PENDING")
    expect(h.db.readings.size).toBe(0)
  })

  it("승인 후 풀이 레코드 생성이 실패 → 500(일반 문구), 같은 요청 재전송으로 복구, 토스 재승인 없음", async () => {
    const o = pendingOrder()
    tossConfirm = [done(o.orderId)]
    const orig = h.db.client.reading.create
    h.db.client.reading.create = (async () => {
      throw new Error("connection reset by peer at 10.0.0.5")
    }) as never
    const r1 = await confirmPOST(req(body(o.orderId)))
    expect(r1.status).toBe(500)
    expect(JSON.stringify(await r1.json())).not.toContain("10.0.0.5")
    expect(h.db.orders.get(o.id)!.status).toBe("PAID")
    h.db.client.reading.create = orig
    const calls = fetchMock.mock.calls.length
    const r2 = await confirmPOST(req(body(o.orderId)))
    expect(r2.status).toBe(200)
    expect(fetchMock.mock.calls.length).toBe(calls)
    expect(h.db.readings.size).toBe(1)
  })

  it("같은 결제 동시 승인 5개(새로고침·여러 탭) → 풀이 1건, 모두 같은 readingId", async () => {
    const o = pendingOrder()
    let first = true
    fetchMock.mockImplementation(async (url: string | URL, _init?: RequestInit) => {
      const u = String(url)
      await new Promise((r) => setTimeout(r, 5))
      if (u.endsWith("/confirm")) {
        if (first) {
          first = false
          return new Response(JSON.stringify(done(o.orderId).body), { status: 200 })
        }
        return new Response(JSON.stringify({ code: "ALREADY_PROCESSED_PAYMENT" }), { status: 400 })
      }
      return new Response(JSON.stringify(done(o.orderId).body), { status: 200 })
    })
    const res = await Promise.all(Array.from({ length: 5 }, () => confirmPOST(req(body(o.orderId)))))
    const ids = await Promise.all(res.map(async (r) => (await r.json()).readingId))
    expect(res.every((r) => r.status === 200)).toBe(true)
    expect(new Set(ids).size).toBe(1)
    expect(h.db.readings.size).toBe(1)
    expect(h.db.orders.get(o.id)!.status).toBe("PAID")
  })

  it("동시 요청 중 하나가 거절(FAILED)을 받아도 실제 승인이 이기면 PAID", async () => {
    const o = pendingOrder()
    let n = 0
    fetchMock.mockImplementation(async () => {
      const mine = ++n
      await new Promise((r) => setTimeout(r, mine === 1 ? 20 : 1))
      return mine === 1
        ? new Response(JSON.stringify(done(o.orderId).body), { status: 200 })
        : new Response(JSON.stringify({ code: "INVALID_REQUEST" }), { status: 400 })
    })
    await Promise.all([confirmPOST(req(body(o.orderId))), confirmPOST(req(body(o.orderId)))])
    expect(h.db.orders.get(o.id)!.status).toBe("PAID")
    expect(h.db.readings.size).toBe(1)
  })

  it("거절된(FAILED) 주문은 다시 확인해도 토스 호출 없이 400", async () => {
    const o = pendingOrder("alice", { status: "FAILED" })
    expect((await confirmPOST(req(body(o.orderId)))).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("confirm — ⑦ 비밀키·내부 오류", () => {
  it("비밀키는 응답·로그 어디에도 없다 (승인·거절·네트워크 오류·조회 실패)", async () => {
    const replies: TossReply[][] = [
      [done("x")], [{ status: 400, body: { code: "REJECT_CARD_COMPANY", message: SECRET } }], ["network"],
      [{ status: 500, body: {} }],
    ]
    for (const c of replies) {
      const o = pendingOrder()
      tossConfirm = c
      tossLookup = [{ status: 500, body: {} }]
      const res = await confirmPOST(req(body(o.orderId)))
      expect(JSON.stringify(await res.json())).not.toContain(SECRET)
    }
    expect(logs.join("\n")).not.toContain(SECRET)
    expect(logs.join("\n")).not.toContain(Buffer.from(`${SECRET}:`).toString("base64"))
  })

  it("TOSS_SECRET_KEY 미설정 → 500 일반 문구 (환경변수 이름 노출 없음)", async () => {
    vi.stubEnv("TOSS_SECRET_KEY", "")
    const o = pendingOrder()
    const res = await confirmPOST(req(body(o.orderId)))
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toMatch(/TOSS|SECRET/)
  })

  it("로그인 없음 → 401, 토스 호출 없음", async () => {
    h.session = null
    const o = pendingOrder()
    expect((await confirmPOST(req(body(o.orderId)))).status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
