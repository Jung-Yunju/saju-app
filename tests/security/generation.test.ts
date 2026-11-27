// U-01 독립 검증 — 풀이 생성(generate·status·claims·verify)의 비용 남용·인가·오류 노출
// DB는 tests/security/_fakedb.ts(메모리), 로그인은 @/lib/auth mock, AI는 mock.
// session-user.ts는 실제 코드를 그대로 쓴다(경로별 userId 판별 통일 여부를 같이 본다).
// 실DB 원자성(조건부 updateMany의 행 잠금)은 미검증 — 여기서는 "DB 호출 하나가 원자적이면 안전한가"까지만 본다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { createFakeDb, type FakeDb } from "./_fakedb"

const h = vi.hoisted(() => ({
  db: null as unknown as FakeDb,
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
import { GET as statusGET } from "@/app/api/reading/[id]/status/route"
import { POST as claimsPOST } from "@/app/api/reading/[id]/claims/route"
import { POST as verifyPOST } from "@/app/api/reading/[id]/verify/route"
import { GENERATION_STALE_MS } from "@/app/api/reading/_lib/reading-lock"

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const post = (body?: unknown, raw?: string) =>
  new NextRequest("http://localhost/api", {
    method: "POST",
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    headers: { "content-type": "application/json" },
  })
const get = () => new NextRequest("http://localhost/api")
const login = (id: string, email: string | null = `${id}@example.com`) => {
  h.session = { user: { id, email, name: null } }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

let errSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  h.db = createFakeDb()
  h.db.seedUser({ id: "alice", email: "alice@example.com" })
  h.db.seedUser({ id: "mallory", email: "mallory@example.com" })
  login("alice")
  h.ai.generateFullReading.mockReset()
  h.ai.generateClaims.mockReset()
  vi.unstubAllEnvs()
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => {
  errSpy.mockRestore()
  vi.useRealTimers()
})

function seedPaid(userId = "alice", status = "PENDING") {
  const order = h.db.seedOrder({ userId, status: "PAID" })
  const reading = h.db.seedReading({ userId, orderId: order.id, status })
  return { order, reading }
}

describe("② 생성 API 중복·반복 호출 (AI 비용)", () => {
  it("같은 풀이에 동시 요청 20개 → AI 호출 정확히 1번, 나머지는 202(생성 중)", async () => {
    const { reading } = seedPaid()
    h.ai.generateFullReading.mockImplementation(async () => {
      await sleep(30)
      return { parts: [] }
    })
    const results = await Promise.all(Array.from({ length: 20 }, () => generatePOST(post(), ctx(reading.id))))
    expect(h.ai.generateFullReading).toHaveBeenCalledTimes(1)
    const codes = results.map((r) => r.status).sort()
    expect(codes.filter((c) => c === 200)).toHaveLength(1)
    expect(codes.filter((c) => c === 202)).toHaveLength(19)
    expect(h.db.readings.get(reading.id)!.status).toBe("COMPLETE")
  })

  it("완료 후 새로고침·다른 탭의 재요청 → AI 재호출 없음, alreadyCompleted", async () => {
    const { reading } = seedPaid()
    h.ai.generateFullReading.mockResolvedValue({ parts: [] })
    await generatePOST(post(), ctx(reading.id))
    for (let i = 0; i < 5; i++) {
      const res = await generatePOST(post(), ctx(reading.id))
      expect(res.status).toBe(200)
      expect((await res.json()).alreadyCompleted).toBe(true)
    }
    expect(h.ai.generateFullReading).toHaveBeenCalledTimes(1)
  })

  it("실패(FAILED) 뒤 동시 '다시 시도' 10개 → AI 호출은 1번만", async () => {
    const { reading } = seedPaid("alice", "FAILED")
    h.ai.generateFullReading.mockImplementation(async () => {
      await sleep(20)
      return {}
    })
    await Promise.all(Array.from({ length: 10 }, () => generatePOST(post(), ctx(reading.id))))
    expect(h.ai.generateFullReading).toHaveBeenCalledTimes(1)
  })

  it("결과 저장 직전에 상태가 바뀌었으면(예: 죽은 잠금 복구) 덮어쓰지 않는다", async () => {
    const { reading } = seedPaid()
    h.ai.generateFullReading.mockImplementation(async () => {
      h.db.readings.get(reading.id)!.status = "FAILED" // 다른 경로가 상태를 바꿈
      return { parts: ["late"] }
    })
    await generatePOST(post(), ctx(reading.id))
    expect(h.db.readings.get(reading.id)!.fullReading).toBeNull()
  })
})

describe("⑤ 남의 풀이 상태 변경 / ⑥ userId 판별", () => {
  it("남의 풀이 generate → 404, 상태·잠금시각 그대로, AI 호출 없음", async () => {
    const { reading, order } = seedPaid("alice")
    const before = order.updatedAt.getTime()
    login("mallory")
    h.ai.generateFullReading.mockRejectedValue(new Error("should not run"))
    const res = await generatePOST(post(), ctx(reading.id))
    expect(res.status).toBe(404)
    expect(h.db.readings.get(reading.id)!.status).toBe("PENDING")
    expect(h.db.orders.get(order.id)!.updatedAt.getTime()).toBe(before)
    expect(h.ai.generateFullReading).not.toHaveBeenCalled()
  })

  it("남의 FAILED·GENERATING 풀이도 generate·status로 바꿀 수 없다", async () => {
    for (const st of ["FAILED", "GENERATING"]) {
      const { reading } = seedPaid("alice", st)
      login("mallory")
      expect((await generatePOST(post(), ctx(reading.id))).status).toBe(404)
      expect((await statusGET(get(), ctx(reading.id))).status).toBe(404)
      expect(h.db.readings.get(reading.id)!.status).toBe(st)
    }
  })

  it("오래된 남의 GENERATING도 복구(FAILED 전환) 대상이 아니다", async () => {
    const { reading, order } = seedPaid("alice", "GENERATING")
    order.updatedAt = new Date(Date.now() - GENERATION_STALE_MS - 60_000)
    login("mallory")
    await generatePOST(post(), ctx(reading.id))
    expect(h.db.readings.get(reading.id)!.status).toBe("GENERATING")
  })

  it("남의 풀이에 claims·verify(개발 전용) → 404, 상태 그대로", async () => {
    const { reading } = seedPaid("alice", "VERIFYING")
    h.db.readings.get(reading.id)!.claims = { claims: [{ id: "p1", claim: "x" }] }
    login("mallory")
    expect((await claimsPOST(post(), ctx(reading.id))).status).toBe(404)
    expect((await verifyPOST(post({ answers: { p1: "맞다" } }), ctx(reading.id))).status).toBe(404)
    expect(h.db.readings.get(reading.id)!.status).toBe("VERIFYING")
    expect(h.ai.generateFullReading).not.toHaveBeenCalled()
  })

  it("로그인 없음·세션에 id 없음 → 모든 생성 경로 401", async () => {
    const { reading } = seedPaid()
    for (const s of [null, { user: { email: "alice@example.com" } }]) {
      h.session = s
      expect((await generatePOST(post(), ctx(reading.id))).status).toBe(401)
      expect((await statusGET(get(), ctx(reading.id))).status).toBe(401)
      expect((await claimsPOST(post(), ctx(reading.id))).status).toBe(401)
      expect((await verifyPOST(post({ answers: {} }), ctx(reading.id))).status).toBe(401)
    }
    expect(h.db.readings.get(reading.id)!.status).toBe("PENDING")
  })

  it("세션 id와 DB id가 어긋나도 이메일로 찾은 같은 사용자로 판별 (generate·status 일치)", async () => {
    const { reading } = seedPaid("alice")
    h.session = { user: { id: "stale-session-id", email: "alice@example.com" } }
    expect((await statusGET(get(), ctx(reading.id))).status).toBe(200)
    h.ai.generateFullReading.mockResolvedValue({})
    expect((await generatePOST(post(), ctx(reading.id))).status).toBe(200)
  })

  it("id가 같아도 이메일이 다른 사용자 것이면 그 사용자로 판별된다(이메일 우선) — 이메일 위조 불가 전제", async () => {
    // 현재 설계: JWT의 email을 신뢰. Google 단일 공급자라 위조 불가 전제. 공급자 추가 시 재검토 필요.
    const { reading } = seedPaid("alice")
    h.session = { user: { id: "mallory", email: "alice@example.com" } }
    expect((await statusGET(get(), ctx(reading.id))).status).toBe(200)
  })
})

describe("잠금이 영구히 걸리지 않는가", () => {
  it("서버가 죽어 GENERATING이 10분 넘게 남음 → status는 FAILED로 알리고(조회는 DB 안 바꿈), generate가 복구 후 재생성", async () => {
    const { reading, order } = seedPaid("alice", "GENERATING")
    order.updatedAt = new Date(Date.now() - GENERATION_STALE_MS - 1000)
    const st = await statusGET(get(), ctx(reading.id))
    expect((await st.json()).status).toBe("FAILED")
    expect(h.db.readings.get(reading.id)!.status).toBe("GENERATING")

    h.ai.generateFullReading.mockResolvedValue({ ok: 1 })
    const res = await generatePOST(post(), ctx(reading.id))
    expect(res.status).toBe(200)
    expect(h.db.readings.get(reading.id)!.status).toBe("COMPLETE")
  })

  it("10분이 안 된 GENERATING은 건드리지 않고 202", async () => {
    const { reading, order } = seedPaid("alice", "GENERATING")
    order.updatedAt = new Date(Date.now() - GENERATION_STALE_MS + 60_000)
    const res = await generatePOST(post(), ctx(reading.id))
    expect(res.status).toBe(202)
    expect(h.ai.generateFullReading).not.toHaveBeenCalled()
  })

  it("AI가 제한 시간(270초) 안에 안 끝나면 FAILED로 기록되어 다시 시도 가능", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    const { reading } = seedPaid()
    h.ai.generateFullReading.mockImplementation(() => new Promise(() => {}))
    const p = generatePOST(post(), ctx(reading.id))
    while (h.ai.generateFullReading.mock.calls.length === 0) await new Promise((r) => setImmediate(r))
    await vi.advanceTimersByTimeAsync(269_000)
    expect(h.db.readings.get(reading.id)!.status).toBe("GENERATING")
    await vi.advanceTimersByTimeAsync(1_001)
    const res = await p
    expect(res.status).toBe(500)
    expect(h.db.readings.get(reading.id)!.status).toBe("FAILED")
  })

  it("AI 실패 기록(FAILED 저장)마저 DB 오류로 실패해도 응답은 일반 문구, 10분 뒤 복구 가능", async () => {
    const { reading, order } = seedPaid()
    h.ai.generateFullReading.mockRejectedValue(new Error("upstream 529"))
    const orig = h.db.client.reading.updateMany
    let n = 0
    h.db.client.reading.updateMany = (async (a: Parameters<typeof orig>[0]) => {
      n++
      if (n >= 3) throw new Error("db down: postgres://user:pw@host/db")
      return orig(a)
    }) as typeof orig
    const res = await generatePOST(post(), ctx(reading.id))
    const text = JSON.stringify(await res.json())
    expect(text).not.toMatch(/postgres|529|db down/)
    h.db.client.reading.updateMany = orig
    expect(h.db.readings.get(reading.id)!.status).toBe("GENERATING")
    order.updatedAt = new Date(Date.now() - GENERATION_STALE_MS - 1)
    expect((await (await statusGET(get(), ctx(reading.id))).json()).status).toBe("FAILED")
  })
})

describe("⑦ 내부 오류 메시지 노출", () => {
  const SECRET = "sk-ant-api03-SECRETVALUE / prisma P1001 at db.neon.tech"
  it("DB 조회 예외 → 500 일반 문구, 비밀·내부값 없음 (generate·status·claims·verify)", async () => {
    const boom = async () => {
      throw new Error(SECRET)
    }
    h.db.client.reading.findFirst = boom as never
    for (const res of [
      await generatePOST(post(), ctx("x")),
      await statusGET(get(), ctx("x")),
      await claimsPOST(post(), ctx("x")),
      await verifyPOST(post({ answers: {} }), ctx("x")),
    ]) {
      expect(res.status).toBe(500)
      const body = JSON.stringify(await res.json())
      expect(body).not.toContain("SECRET")
      expect(body).not.toContain("neon")
      expect(body).not.toContain("P1001")
    }
  })

  it("세션 조회 예외 → 500 일반 문구", async () => {
    h.db.client.user.findUnique = (async () => {
      throw new Error(SECRET)
    }) as never
    const res = await generatePOST(post(), ctx("x"))
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain("SECRET")
  })

  it("AI 예외 문구는 응답에 없음 (claims·verify 포함)", async () => {
    const { reading } = seedPaid()
    h.ai.generateClaims.mockRejectedValue(new Error(SECRET))
    const r1 = await claimsPOST(post(), ctx(reading.id))
    expect(JSON.stringify(await r1.json())).not.toContain("SECRET")
    const r = h.db.readings.get(reading.id)!
    r.status = "VERIFYING"
    r.claims = { claims: [{ id: "p1", claim: "x" }] }
    h.ai.generateFullReading.mockRejectedValue(new Error(SECRET))
    const r2 = await verifyPOST(post({ answers: { p1: "맞다" } }), ctx(reading.id))
    expect(JSON.stringify(await r2.json())).not.toContain("SECRET")
    expect(h.db.readings.get(reading.id)!.status).toBe("VERIFYING")
  })
})

describe("③ AI로 가는 입력 (DB에 남은 예전 값 포함)", () => {
  it("DB sajuInput의 known_facts·긴 이름·꺾쇠는 AI 직전에 다시 걸러진다", async () => {
    const { reading } = seedPaid()
    h.db.readings.get(reading.id)!.sajuInput = {
      name: "<script>민지</script>", gender: "여", pillars: {}, known_facts: ["2019년에 이혼했다", "x".repeat(5000)],
    }
    h.ai.generateFullReading.mockResolvedValue({})
    await generatePOST(post(), ctx(reading.id))
    const sent = h.ai.generateFullReading.mock.calls[0][0]
    expect(sent.known_facts).toEqual([])
    expect(sent.name ?? "").not.toMatch(/[<>]/)
    expect([...(sent.name ?? "")].length).toBeLessThanOrEqual(20)
    expect(h.ai.generateFullReading.mock.calls[0][1]).toEqual([])
  })

  it("sajuInput이 배열·문자열·null이면 AI 호출 없이 400", async () => {
    for (const bad of [null, "문자열", [1, 2]]) {
      const { reading } = seedPaid()
      h.db.readings.get(reading.id)!.sajuInput = bad
      const res = await generatePOST(post(), ctx(reading.id))
      expect(res.status).toBe(400)
    }
    expect(h.ai.generateFullReading).not.toHaveBeenCalled()
  })

  it("verify: __proto__·constructor·남는 키·긴 값·배열 답변은 400, AI 호출 없음", async () => {
    const { reading } = seedPaid("alice", "VERIFYING")
    h.db.readings.get(reading.id)!.claims = { claims: [{ id: "p1", claim: "a" }, { id: "p2", claim: "b" }] }
    const bodies = [
      '{"answers":{"__proto__":"맞다"}}',
      '{"answers":{"constructor":"맞다"}}',
      '{"answers":{"p1":"맞다","p2":"맞다","p3":"맞다"}}',
      `{"answers":{"p1":"${"맞다".repeat(500)}"}}`,
      '{"answers":["맞다","아니다"]}',
      '{"answers":{"p1":["맞다"]}}',
      '{"answers":"맞다"}',
      "not json",
    ]
    for (const raw of bodies) {
      const res = await verifyPOST(post(undefined, raw), ctx(reading.id))
      expect(res.status, raw.slice(0, 40)).toBe(400)
    }
    expect(h.ai.generateFullReading).not.toHaveBeenCalled()
    expect(h.db.readings.get(reading.id)!.status).toBe("VERIFYING")
  })

  it("verify: 프롬프트에는 서버에 저장된 단정만(형식 어긋난 id 제외), 답변은 화이트리스트 값만", async () => {
    const { reading } = seedPaid("alice", "VERIFYING")
    h.db.readings.get(reading.id)!.claims = {
      claims: [{ id: "p1", claim: "a" }, { id: "../../x", claim: "주입" }, { id: "p2", claim: "b" }],
    }
    h.ai.generateFullReading.mockResolvedValue({})
    const res = await verifyPOST(post({ answers: { p1: "맞다" } }), ctx(reading.id))
    expect(res.status).toBe(200)
    const [, claims, answers] = h.ai.generateFullReading.mock.calls[0]
    expect(claims.map((c: { id: string }) => c.id)).toEqual(["p1", "p2"])
    expect(answers).toEqual({ p1: "맞다", p2: "모름" })
  })

  it("verify 본문 크기: Content-Length 없이 스트림으로 4KB 넘게 보내도 400", async () => {
    const { reading } = seedPaid("alice", "VERIFYING")
    h.db.readings.get(reading.id)!.claims = { claims: [{ id: "p1", claim: "a" }] }
    const big = new TextEncoder().encode(`{"answers":{"p1":"맞다"},"pad":"${"x".repeat(6000)}"}`)
    const stream = new ReadableStream({
      start(c) {
        for (let i = 0; i < big.length; i += 512) c.enqueue(big.slice(i, i + 512))
        c.close()
      },
    })
    const req = new NextRequest("http://localhost/api", { method: "POST", body: stream, duplex: "half" } as never)
    const res = await verifyPOST(req, ctx(reading.id))
    expect(res.status).toBe(400)
  })
})

describe("① 운영에서 결제 없이 생성 — 개발용 경로 차단", () => {
  it.each(["TRUE", "1", "yes", " true", "true "])("ALLOW_FREE_READING=%j 는 허용으로 보지 않는다 (claims·verify 404)", async (v) => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("ALLOW_FREE_READING", v)
    const { reading } = seedPaid()
    expect((await claimsPOST(post(), ctx(reading.id))).status).toBe(404)
    expect((await verifyPOST(post({ answers: {} }), ctx(reading.id))).status).toBe(404)
    expect(h.ai.generateClaims).not.toHaveBeenCalled()
  })
})
