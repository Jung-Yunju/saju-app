// DB 구조 v3 기능 스위치(DB_SCHEMA_V3) — 켠 경우·끈 경우 (backend-developer, P6-01 일부 + U-01 잔여)
// DB는 메모리 fake(_fakedb-v3.ts), 로그인은 @/lib/auth mock, AI·토스는 mock. 실DB 동작(행 잠금·마이그레이션 적용)은 미검증.
//   ① 생성 재시도 상한: 3회 실패 후 409(retryExhausted), AI 미호출 / 스위치 끄면 예전처럼 무제한
//   ② lockedAt: 잠금 시각 기록, 죽은 잠금 복구 기준
//   ③ 결제: prepare가 birthInfo를 서버에 저장, confirm은 클라이언트 birthInfo(위조) 무시
//   ④ 새 열 기록(direct·confirm), 출생지 이름은 열에 저장하지 않음
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { createFakeDbV3, type FakeDbV3 } from "./_fakedb-v3"

const h = vi.hoisted(() => ({
  db: null as unknown as FakeDbV3,
  session: null as null | { user: { id?: string; email?: string | null; name?: string | null } },
  ai: { generateFullReading: vi.fn(), generateClaims: vi.fn() },
}))
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return h.db.client
  },
}))
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => h.session) }))
vi.mock("@/lib/generate-reading-v2", () => h.ai)

import { POST as generatePOST } from "@/app/api/reading/[id]/generate/route"
import { POST as claimsPOST } from "@/app/api/reading/[id]/claims/route"
import { POST as directPOST } from "@/app/api/reading/direct/route"
import { POST as preparePOST } from "@/app/api/payment/prepare/route"
import { POST as confirmPOST } from "@/app/api/payment/confirm/route"
import {
  ATTEMPTS_EXHAUSTED_MESSAGE, DEFAULT_GENERATION_MAX_ATTEMPTS, GENERATION_STALE_MS, getGenerationMaxAttempts,
} from "@/app/api/reading/_lib/reading-lock"
import { isDbSchemaV3 } from "@/app/api/reading/_lib/schema-v3"

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const post = (body?: unknown) =>
  new NextRequest("http://localhost/api", {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  })
const login = (id: string) => {
  h.session = { user: { id, email: `${id}@example.com`, name: null } }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const v3On = () => vi.stubEnv("DB_SCHEMA_V3", "true")

const V3_READING_COLUMNS = [
  "isLeapMonth", "birthMinute", "timeMode", "ziNight", "birthplaceLongitude",
  "otherCalType", "otherIsLeapMonth", "otherBirthMinute", "otherTimeMode", "otherZiNight", "otherBirthplaceLongitude",
]

// 토스 mock
type TossReply = { status: number; body: unknown }
let tossConfirm: TossReply | null = null
const fetchMock = vi.fn(async (url: string | URL) => {
  if (!String(url).endsWith("/confirm") || !tossConfirm) throw new Error(`예상하지 못한 fetch ${String(url)}`)
  return new Response(JSON.stringify(tossConfirm.body), { status: tossConfirm.status })
})
const tossDone = (orderId: string) => {
  tossConfirm = { status: 200, body: { orderId, status: "DONE", totalAmount: 19900 } }
}

let logs: string[] = []
beforeEach(() => {
  h.db = createFakeDbV3()
  h.db.seedUser({ id: "alice", email: "alice@example.com" })
  h.db.seedUser({ id: "mallory", email: "mallory@example.com" })
  login("alice")
  h.ai.generateFullReading.mockReset()
  h.ai.generateClaims.mockReset()
  vi.unstubAllEnvs()
  vi.stubEnv("TOSS_SECRET_KEY", "test_dummy_not_a_real_key")
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockClear()
  tossConfirm = null
  logs = []
  const capture = (...a: unknown[]) => {
    logs.push(a.map((x) => (x instanceof Error ? x.message : typeof x === "string" ? x : JSON.stringify(x))).join(" "))
  }
  vi.spyOn(console, "error").mockImplementation(capture)
  vi.spyOn(console, "warn").mockImplementation(capture)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

function seedPaid(userId = "alice", extra: Record<string, unknown> = {}) {
  const order = h.db.seedOrder({ userId, status: "PAID" })
  const reading = h.db.seedReading({ userId, orderId: order.id, status: "PENDING", ...extra })
  return { order, reading }
}
const row = (id: string) => h.db.readings.get(id)! as Record<string, unknown>

describe("스위치 값 해석", () => {
  it("DB_SCHEMA_V3는 정확히 'true'일 때만 켜진다", () => {
    expect(isDbSchemaV3({})).toBe(false)
    for (const v of ["1", "TRUE", "yes", " true", ""]) expect(isDbSchemaV3({ DB_SCHEMA_V3: v }), v).toBe(false)
    expect(isDbSchemaV3({ DB_SCHEMA_V3: "true" })).toBe(true)
  })
  it("GENERATION_MAX_ATTEMPTS: 기본 3, 1~10만 허용", () => {
    expect(getGenerationMaxAttempts({})).toBe(DEFAULT_GENERATION_MAX_ATTEMPTS)
    expect(DEFAULT_GENERATION_MAX_ATTEMPTS).toBe(3)
    expect(getGenerationMaxAttempts({ GENERATION_MAX_ATTEMPTS: "5" })).toBe(5)
    for (const v of ["0", "11", "-1", "abc", "2.5", "999"]) {
      expect(getGenerationMaxAttempts({ GENERATION_MAX_ATTEMPTS: v }), v).toBe(3)
    }
  })
})

describe("① 생성 재시도 상한 — 스위치 켬", () => {
  it("3번 실패 → 4번째 요청은 409 retryExhausted, AI는 정확히 3번만 호출", async () => {
    v3On()
    const { reading } = seedPaid()
    h.ai.generateFullReading.mockRejectedValue(new Error("model overloaded"))
    for (let i = 1; i <= 3; i++) {
      const res = await generatePOST(post(), ctx(reading.id))
      expect(res.status, `시도 ${i}`).toBe(500)
      expect(row(reading.id).attemptCount).toBe(i)
      expect(row(reading.id).status).toBe("FAILED")
    }
    for (let i = 0; i < 3; i++) {
      const res = await generatePOST(post(), ctx(reading.id))
      expect(res.status).toBe(409)
      const j = await res.json()
      expect(j).toMatchObject({ retryExhausted: true, status: "FAILED", error: ATTEMPTS_EXHAUSTED_MESSAGE })
    }
    expect(h.ai.generateFullReading).toHaveBeenCalledTimes(3)
    expect(row(reading.id).attemptCount).toBe(3)
  })

  it("실패 1번 뒤 성공 → COMPLETE, 이후 요청은 AI 없이 alreadyCompleted", async () => {
    v3On()
    const { reading } = seedPaid()
    h.ai.generateFullReading.mockRejectedValueOnce(new Error("x")).mockResolvedValue({ parts: [] })
    expect((await generatePOST(post(), ctx(reading.id))).status).toBe(500)
    expect((await generatePOST(post(), ctx(reading.id))).status).toBe(200)
    const again = await generatePOST(post(), ctx(reading.id))
    expect((await again.json()).alreadyCompleted).toBe(true)
    expect(h.ai.generateFullReading).toHaveBeenCalledTimes(2)
    expect(row(reading.id)).toMatchObject({ status: "COMPLETE", attemptCount: 2 })
  })

  it("동시 요청 20개 → AI 1번, 시도 횟수 1", async () => {
    v3On()
    const { reading } = seedPaid()
    h.ai.generateFullReading.mockImplementation(async () => {
      await sleep(20)
      return { parts: [] }
    })
    const results = await Promise.all(Array.from({ length: 20 }, () => generatePOST(post(), ctx(reading.id))))
    expect(h.ai.generateFullReading).toHaveBeenCalledTimes(1)
    expect(results.filter((r) => r.status === 200)).toHaveLength(1)
    expect(results.filter((r) => r.status === 202)).toHaveLength(19)
    expect(row(reading.id).attemptCount).toBe(1)
  })

  it("실패 뒤 '다시 시도'를 동시에 20번 눌러도 상한(3)을 넘지 않는다", async () => {
    v3On()
    const { reading } = seedPaid()
    h.ai.generateFullReading.mockRejectedValue(new Error("x"))
    for (let round = 0; round < 5; round++) {
      await Promise.all(Array.from({ length: 20 }, () => generatePOST(post(), ctx(reading.id))))
    }
    expect(h.ai.generateFullReading.mock.calls.length).toBeLessThanOrEqual(3)
    expect(row(reading.id).attemptCount).toBe(h.ai.generateFullReading.mock.calls.length)
  })

  it("GENERATION_MAX_ATTEMPTS=1 → 실패 1번 뒤 바로 409", async () => {
    v3On()
    vi.stubEnv("GENERATION_MAX_ATTEMPTS", "1")
    const { reading } = seedPaid()
    h.ai.generateFullReading.mockRejectedValue(new Error("x"))
    expect((await generatePOST(post(), ctx(reading.id))).status).toBe(500)
    expect((await generatePOST(post(), ctx(reading.id))).status).toBe(409)
    expect(h.ai.generateFullReading).toHaveBeenCalledTimes(1)
  })

  it("claims(개발용 경로)도 같은 시도 횟수를 쓴다 — 상한이면 AI 미호출", async () => {
    v3On()
    const { reading } = seedPaid("alice", { status: "FAILED", attemptCount: 3 })
    const res = await claimsPOST(post(), ctx(reading.id))
    expect(res.status).toBe(409)
    expect(h.ai.generateClaims).not.toHaveBeenCalled()
  })

  it("남의 풀이: 404, 시도 횟수 변화 없음", async () => {
    v3On()
    const { reading } = seedPaid("mallory")
    expect((await generatePOST(post(), ctx(reading.id))).status).toBe(404)
    expect(row(reading.id).attemptCount).toBe(0)
    expect(h.ai.generateFullReading).not.toHaveBeenCalled()
  })
})

describe("② lockedAt — 스위치 켬", () => {
  it("잠금 때 lockedAt 기록(+ status 라우트 호환용 Order.updatedAt 갱신)", async () => {
    v3On()
    const { order, reading } = seedPaid()
    order.updatedAt = new Date(Date.now() - 3600_000)
    const before = Date.now()
    h.ai.generateFullReading.mockResolvedValue({ parts: [] })
    await generatePOST(post(), ctx(reading.id))
    const lockedAt = row(reading.id).lockedAt as Date
    expect(lockedAt).toBeInstanceOf(Date)
    expect(lockedAt.getTime()).toBeGreaterThanOrEqual(before)
    expect(h.db.orders.get(order.id)!.updatedAt.getTime()).toBeGreaterThanOrEqual(before)
  })

  it("lockedAt이 오래된 GENERATING → 복구 후 재생성(시도 +1)", async () => {
    v3On()
    const { reading } = seedPaid("alice", {
      status: "GENERATING", attemptCount: 1, lockedAt: new Date(Date.now() - GENERATION_STALE_MS - 1000),
    })
    h.ai.generateFullReading.mockResolvedValue({ parts: [] })
    expect((await generatePOST(post(), ctx(reading.id))).status).toBe(200)
    expect(row(reading.id)).toMatchObject({ status: "COMPLETE", attemptCount: 2 })
  })

  it("lockedAt이 최근이면 Order.updatedAt이 오래돼도 생성 중으로 본다(202, AI 미호출)", async () => {
    v3On()
    const { order, reading } = seedPaid("alice", { status: "GENERATING", attemptCount: 1, lockedAt: new Date() })
    order.updatedAt = new Date(Date.now() - GENERATION_STALE_MS - 60_000)
    expect((await generatePOST(post(), ctx(reading.id))).status).toBe(202)
    expect(h.ai.generateFullReading).not.toHaveBeenCalled()
  })

  it("마이그레이션 전에 잠긴 행(lockedAt NULL)은 Order.updatedAt으로 판정", async () => {
    v3On()
    const { order, reading } = seedPaid("alice", { status: "GENERATING" })
    order.updatedAt = new Date(Date.now() - GENERATION_STALE_MS - 1000)
    h.ai.generateFullReading.mockResolvedValue({ parts: [] })
    expect((await generatePOST(post(), ctx(reading.id))).status).toBe(200)
    expect(row(reading.id).attemptCount).toBe(1)
  })

  it("죽은 잠금이어도 시도 횟수를 다 썼으면 FAILED로만 돌리고 409, AI 미호출", async () => {
    v3On()
    const { reading } = seedPaid("alice", {
      status: "GENERATING", attemptCount: 3, lockedAt: new Date(Date.now() - GENERATION_STALE_MS - 1000),
    })
    const res = await generatePOST(post(), ctx(reading.id))
    expect(res.status).toBe(409)
    expect((await res.json()).retryExhausted).toBe(true)
    expect(row(reading.id).status).toBe("FAILED")
    expect(h.ai.generateFullReading).not.toHaveBeenCalled()
  })
})

describe("①② 스위치 끔 — 예전 동작 그대로", () => {
  it("실패 뒤 다시 시도 횟수 제한 없음(5번 모두 AI 호출), 새 열은 건드리지 않음", async () => {
    const { reading } = seedPaid()
    h.ai.generateFullReading.mockRejectedValue(new Error("x"))
    for (let i = 0; i < 5; i++) expect((await generatePOST(post(), ctx(reading.id))).status).toBe(500)
    expect(h.ai.generateFullReading).toHaveBeenCalledTimes(5)
    expect(row(reading.id).attemptCount).toBe(0)
    expect(row(reading.id).lockedAt).toBeNull()
  })

  it("lockedAt이 최근이어도 스위치가 꺼져 있으면 Order.updatedAt 기준으로 복구한다", async () => {
    const { order, reading } = seedPaid("alice", { status: "GENERATING", lockedAt: new Date() })
    order.updatedAt = new Date(Date.now() - GENERATION_STALE_MS - 1000)
    h.ai.generateFullReading.mockResolvedValue({ parts: [] })
    expect((await generatePOST(post(), ctx(reading.id))).status).toBe(200)
  })

  it("시도 횟수가 상한 이상이어도(켰다가 끈 경우) 스위치가 꺼져 있으면 막지 않는다", async () => {
    const { reading } = seedPaid("alice", { status: "FAILED", attemptCount: 9 })
    h.ai.generateFullReading.mockResolvedValue({ parts: [] })
    expect((await generatePOST(post(), ctx(reading.id))).status).toBe(200)
  })
})

// ─── 결제 ─────────────────────────────────────────────────────────────────

const BIRTH = { birthYear: 1990, birthMonth: 5, birthDay: 17, birthHour: 9, gender: "F", calType: "SOLAR" }
const FORGED = { birthYear: 2001, birthMonth: 1, birthDay: 1, birthHour: null, gender: "M", calType: "SOLAR" }
const PRECISE = {
  ...BIRTH, calType: "LUNAR", birthYear: 2023, birthMonth: 2, birthDay: 1, birthHour: 0,
  isLeapMonth: true, timeMode: "sijin", ziNight: true, birthplace: { name: "부산", longitude: 129.075 },
}
const confirmBody = (orderId: string, birthInfo: unknown = FORGED) =>
  ({ paymentKey: "pk_test_1", orderId, amount: 19900, birthInfo })

async function prepare(birth: unknown) {
  const res = await preparePOST(post(birth))
  expect(res.status).toBe(200)
  const { orderId } = await res.json()
  return [...h.db.orders.values()].find((o) => o.orderId === orderId)!
}
const onlyReading = () => {
  expect(h.db.readings.size).toBe(1)
  return [...h.db.readings.values()][0] as Record<string, unknown>
}

describe("③ 결제 birthInfo — 스위치 켬", () => {
  it("prepare: 검증한 생년월일을 주문에 저장(응답 형태는 예전과 같음)", async () => {
    v3On()
    const res = await preparePOST(post({ ...BIRTH, amount: 1, junk: "<x>" }))
    const j = await res.json()
    expect(Object.keys(j).sort()).toEqual(["amount", "birthInfo", "orderId"])
    const o = [...h.db.orders.values()][0] as unknown as { birthInfo: unknown }
    expect(o.birthInfo).toEqual(BIRTH)
  })

  it("confirm: 클라이언트가 다른 생년월일을 보내도 서버 저장값으로 풀이를 만든다", async () => {
    v3On()
    const o = await prepare(BIRTH)
    tossDone(o.orderId)
    const res = await confirmPOST(post(confirmBody(o.orderId, FORGED)))
    expect(res.status).toBe(200)
    const r = onlyReading()
    expect(r).toMatchObject({ birthYear: 1990, birthMonth: 5, birthDay: 17, birthHour: 9, gender: "F", calType: "SOLAR" })
    expect((r.sajuInput as { birth: string }).birth.startsWith("1990-05-17")).toBe(true)
  })

  it("confirm: 클라이언트 birthInfo가 없거나 망가져도 서버 값으로 진행", async () => {
    v3On()
    for (const bad of [undefined, null, "x", { birthMonth: 13 }]) {
      h.db = createFakeDbV3()
      h.db.seedUser({ id: "alice", email: "alice@example.com" })
      const o = await prepare(BIRTH)
      tossDone(o.orderId)
      const res = await confirmPOST(post(confirmBody(o.orderId, bad)))
      expect(res.status, JSON.stringify(bad)).toBe(200)
      expect(onlyReading().birthYear).toBe(1990)
    }
  })

  it("풀이 레코드를 만든 뒤 주문의 birthInfo는 지운다, 같은 요청 재전송은 같은 풀이", async () => {
    v3On()
    const o = await prepare(BIRTH)
    tossDone(o.orderId)
    const first = await (await confirmPOST(post(confirmBody(o.orderId)))).json()
    expect((h.db.orders.get(o.id) as unknown as { birthInfo: unknown }).birthInfo).toBeNull()
    const again = await confirmPOST(post(confirmBody(o.orderId)))
    expect(again.status).toBe(200)
    expect((await again.json()).readingId).toBe(first.readingId)
    expect(h.db.readings.size).toBe(1)
  })

  it("동시 승인 요청 10개 → 풀이 1건, 모두 같은 서버 값", async () => {
    v3On()
    const o = await prepare(BIRTH)
    tossDone(o.orderId)
    const res = await Promise.all(Array.from({ length: 10 }, (_, i) =>
      confirmPOST(post(confirmBody(o.orderId, { ...FORGED, birthDay: i + 1 })))))
    const ids = new Set(await Promise.all(res.map(async (r) => (await r.json()).readingId)))
    expect(ids.size).toBe(1)
    expect(onlyReading().birthYear).toBe(1990)
  })

  it("저장값 없는 미결제 주문(스위치 켜기 전 준비) → 토스 호출 없이 400, 돈이 나가지 않음", async () => {
    v3On()
    const o = h.db.seedOrder({ userId: "alice", orderId: "saju_legacyorder01", status: "PENDING" })
    tossDone(o.orderId)
    const res = await confirmPOST(post(confirmBody(o.orderId, BIRTH)))
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(h.db.readings.size).toBe(0)
  })

  it("저장값 없는 결제 완료 주문 + 풀이 없음(예전 주문 복구) → 클라이언트 값으로 복구, 경고 로그", async () => {
    v3On()
    const o = h.db.seedOrder({ userId: "alice", orderId: "saju_legacypaid01", status: "PAID" })
    const res = await confirmPOST(post(confirmBody(o.orderId, BIRTH)))
    expect(res.status).toBe(200)
    expect(onlyReading().birthYear).toBe(1990)
    expect(logs.join("\n")).toMatch(/클라이언트 값으로 풀이 복구/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("결제 완료 + 풀이 있음 → 생년월일과 무관하게 그 풀이 id", async () => {
    v3On()
    const o = h.db.seedOrder({ userId: "alice", orderId: "saju_paiddone0001", status: "PAID" })
    const r = h.db.seedReading({ userId: "alice", orderId: o.id })
    const res = await confirmPOST(post(confirmBody(o.orderId, "garbage")))
    expect(res.status).toBe(200)
    expect((await res.json()).readingId).toBe(r.id)
  })

  it("서버 저장값이 손상됐으면 토스 승인 전에 500(내용은 응답·로그에 없음)", async () => {
    v3On()
    const o = await prepare(BIRTH)
    ;(h.db.orders.get(o.id) as unknown as { birthInfo: unknown }).birthInfo = { birthYear: 1990, birthMonth: 99, secretMarker: "민지-1990" }
    tossDone(o.orderId)
    const res = await confirmPOST(post(confirmBody(o.orderId, BIRTH)))
    expect(res.status).toBe(500)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(JSON.stringify(await res.json())).not.toContain("민지")
    expect(logs.join("\n")).not.toContain("민지")
  })

  it("남의 주문 → 400 (birthInfo가 저장돼 있어도)", async () => {
    v3On()
    login("mallory")
    const o = await prepare(BIRTH)
    login("alice")
    tossDone(o.orderId)
    expect((await confirmPOST(post(confirmBody(o.orderId)))).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("③ 결제 birthInfo — 스위치 끔(예전 동작)", () => {
  it("prepare는 birthInfo를 저장하지 않는다", async () => {
    await preparePOST(post(BIRTH))
    expect(([...h.db.orders.values()][0] as unknown as { birthInfo: unknown }).birthInfo).toBeNull()
  })

  it("confirm은 클라이언트 birthInfo를 쓰고, 새 열은 기록하지 않는다", async () => {
    const o = await prepare(BIRTH)
    tossDone(o.orderId)
    expect((await confirmPOST(post(confirmBody(o.orderId, FORGED)))).status).toBe(200)
    const r = onlyReading()
    expect(r.birthYear).toBe(2001)
    // isLeapMonth는 fake가 DB 기본값(false)을 채운다 — 나머지 새 열은 라우트가 보내지 않았으면 키가 없다
    for (const k of V3_READING_COLUMNS.filter((k) => k !== "isLeapMonth")) expect(k in r, k).toBe(false)
  })

  it("클라이언트 birthInfo가 잘못되면 예전처럼 400", async () => {
    const o = await prepare(BIRTH)
    tossDone(o.orderId)
    expect((await confirmPOST(post(confirmBody(o.orderId, { ...BIRTH, birthMonth: 13 })))).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// ─── 새 열 기록 ────────────────────────────────────────────────────────────

describe("④ 새 열 기록", () => {
  it("confirm(켬): 윤달·시진·자시 전후·출생지 경도를 열로, 출생지 이름은 열에 없음", async () => {
    v3On()
    const o = await prepare(PRECISE)
    tossDone(o.orderId)
    expect((await confirmPOST(post(confirmBody(o.orderId)))).status).toBe(200)
    const r = onlyReading()
    expect(r).toMatchObject({
      calType: "LUNAR", isLeapMonth: true, birthMinute: null, timeMode: "sijin", ziNight: true, birthplaceLongitude: 129.075,
    })
    const columns = Object.fromEntries(Object.entries(r).filter(([k]) => k !== "sajuInput"))
    expect(JSON.stringify(columns)).not.toContain("부산")
  })

  it("direct(켬): 본인·상대방 정확도 열 기록", async () => {
    v3On()
    const res = await directPOST(post({
      readingType: "CONFLICT", name: "민지",
      birthYear: 2024, birthMonth: 2, birthDay: 4, birthHour: 17, gender: "F", calType: "SOLAR",
      timeMode: "exact", birthMinute: 40, birthplace: { name: "강릉", longitude: 128.876 },
      otherBirthYear: 2023, otherBirthMonth: 2, otherBirthDay: 1, otherBirthHour: 0, otherGender: "M",
      otherCalType: "LUNAR", otherIsLeapMonth: true, otherTimeMode: "sijin", otherZiNight: false,
      otherBirthplace: { name: "대구", longitude: 128.601 },
    }))
    expect(res.status).toBe(200)
    const r = onlyReading()
    expect(r).toMatchObject({
      isLeapMonth: false, birthMinute: 40, timeMode: "exact", ziNight: null, birthplaceLongitude: 128.876,
      otherCalType: "LUNAR", otherIsLeapMonth: true, otherBirthMinute: null, otherTimeMode: "sijin",
      otherZiNight: false, otherBirthplaceLongitude: 128.601,
      attemptCount: 0, lockedAt: null,
    })
    const columns = Object.fromEntries(Object.entries(r).filter(([k]) => k !== "sajuInput"))
    expect(JSON.stringify(columns)).not.toMatch(/강릉|대구/)
  })

  it("direct(켬): 1인 풀이·시각 모름 → 상대방 열 NULL, 시각 관련 NULL", async () => {
    v3On()
    const res = await directPOST(post({ birthYear: 1990, birthMonth: 5, birthDay: 17, birthHour: null, gender: "F" }))
    expect(res.status).toBe(200)
    const r = onlyReading()
    expect(r).toMatchObject({
      isLeapMonth: false, birthMinute: null, timeMode: null, ziNight: null, birthplaceLongitude: null,
      otherCalType: null, otherIsLeapMonth: null, otherBirthMinute: null, otherTimeMode: null,
      otherZiNight: null, otherBirthplaceLongitude: null,
    })
  })

  it("direct(끔): 새 열을 data에 넣지 않는다", async () => {
    const res = await directPOST(post({ ...PRECISE, readingType: "BASIC" }))
    expect(res.status).toBe(200)
    const r = onlyReading()
    for (const k of V3_READING_COLUMNS.filter((k) => k !== "isLeapMonth")) expect(k in r, k).toBe(false)
    // isLeapMonth는 fake가 DB 기본값(false)을 채운 것 — 라우트는 보내지 않았다
    expect(r.isLeapMonth).toBe(false)
  })
})
