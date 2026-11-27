// 본 풀이 생성 라우트의 엔진 스위치(READING_ENGINE=v3 + DB_SCHEMA_V3=true) — 담당: 백엔드·서버 개발자
// DB는 메모리 가짜(tests/security/_fakedb-v3.ts, 읽기만), 로그인은 @/lib/auth mock, AI는 SDK mock(실제 API 호출 없음).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import type { Message, MessageCreateParamsNonStreaming, MessageStreamParams } from "@anthropic-ai/sdk/resources/messages/messages"
import { createFakeDbV3, type FakeDbV3 } from "../../../tests/security/_fakedb-v3"
import { fakeValue } from "../../../scripts/content/samples/fake-client"
import { buildSajuInputFromRequest } from "@/lib/saju-input"
import { resolveReadingEngine } from "@/app/api/reading/_lib/engine-switch"
import { isStoredReadingV3 } from "@/lib/generate-reading-v3"

type Body = MessageCreateParamsNonStreaming | MessageStreamParams

const h = vi.hoisted(() => ({
  db: null as unknown as FakeDbV3,
  usage: [] as unknown[],
  usageFails: false,
  session: null as null | { user: { id?: string; email?: string | null; name?: string | null } },
  v2: { generateFullReading: vi.fn(), generateClaims: vi.fn() },
  sdkBodies: [] as unknown[],
  respond: null as null | ((body: unknown) => Promise<unknown>),
}))

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return {
      ...h.db.client,
      aiUsage: {
        createMany: async (a: { data: unknown[] }) => {
          if (h.usageFails) throw new Error("AiUsage 표 없음(가짜)")
          h.usage.push(...a.data)
          return { count: a.data.length }
        },
      },
    }
  },
}))
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => h.session) }))
vi.mock("@/lib/generate-reading-v2", () => h.v2)
vi.mock("@anthropic-ai/sdk", () => ({
  default: class FakeAnthropic {
    messages = {
      create: async (body: unknown) => {
        h.sdkBodies.push(body)
        return h.respond!(body)
      },
      stream: (body: unknown) => ({
        finalMessage: async () => {
          h.sdkBodies.push(body)
          return h.respond!(body)
        },
      }),
    }
  },
}))

import { POST as generatePOST } from "@/app/api/reading/[id]/generate/route"

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const post = () => new NextRequest("http://localhost/api", { method: "POST" })

const NAME = "김가람"
const sajuInput = buildSajuInputFromRequest(
  { year: 1990, month: 5, day: 15, hour: 14, birthMinute: 37, timeMode: "exact", gender: "F", calType: "SOLAR", birthplace: { name: "부산광역시", longitude: 129.0756 } },
  NAME,
)

function userOf(body: Body): string {
  return body.messages.map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content))).join("\n")
}
const chapterIdOf = (b: unknown) => userOf(b as Body).match(/^이번에 쓸 장: 「[^」]*」 \(([^)]+)\)/)?.[1] ?? "?"

function fakeResponder(tamper?: (id: string, v: Record<string, unknown>) => void) {
  return async (raw: unknown): Promise<Message> => {
    const body = raw as Body
    const user = userOf(body)
    const m = user.match(/([甲乙丙丁戊己庚辛壬癸])([子丑寅卯辰巳午未申酉戌亥])/)
    const y = user.match(/(20\d\d)/)
    const schema = (body.output_config as { format?: { schema?: Parameters<typeof fakeValue>[0] } } | undefined)?.format?.schema ?? { type: "object" }
    const v = fakeValue(schema, "", { stem: m?.[1] ?? "甲", branch: m?.[2] ?? "子", year: y ? Number(y[1]) : 2026 }) as Record<string, unknown>
    tamper?.(chapterIdOf(body), v)
    return {
      id: "msg_fake", type: "message", role: "assistant", model: body.model,
      content: [{ type: "text", text: JSON.stringify(v), citations: null }],
      stop_reason: "end_turn", stop_sequence: null,
      usage: { input_tokens: 1200, output_tokens: 600, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    } as unknown as Message
  }
}

let errSpy: ReturnType<typeof vi.spyOn>
let warnSpy: ReturnType<typeof vi.spyOn>
let infoSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  h.db = createFakeDbV3()
  h.db.seedUser({ id: "alice", email: "alice@example.com" })
  h.session = { user: { id: "alice", email: "alice@example.com", name: null } }
  h.usage = []
  h.usageFails = false
  h.sdkBodies = []
  h.respond = fakeResponder()
  h.v2.generateFullReading.mockReset()
  h.v2.generateFullReading.mockResolvedValue({ parts: [], from: "v2" })
  vi.unstubAllEnvs()
  vi.stubEnv("CONTENT_MODEL", "")
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
  infoSpy = vi.spyOn(console, "info").mockImplementation(() => {})
})
afterEach(() => {
  errSpy.mockRestore()
  warnSpy.mockRestore()
  infoSpy.mockRestore()
  vi.unstubAllEnvs()
})

function seed(over: Record<string, unknown> = {}) {
  const order = h.db.seedOrder({ userId: "alice", status: "PAID" })
  return h.db.seedReading({ userId: "alice", orderId: order.id, status: "PENDING", sajuInput, gender: "F", readingType: "BASIC", ...over })
}

describe("resolveReadingEngine — 둘 다 정확히 켜져야 v3", () => {
  it.each([
    [{}, "v2", undefined],
    [{ READING_ENGINE: "v2" }, "v2", undefined],
    [{ READING_ENGINE: "V3" }, "v2", undefined],
    [{ READING_ENGINE: " v3" }, "v2", undefined],
    [{ DB_SCHEMA_V3: "true" }, "v2", undefined],
    [{ READING_ENGINE: "v3" }, "v2", "db_schema_v3_off"],
    [{ READING_ENGINE: "v3", DB_SCHEMA_V3: "1" }, "v2", "db_schema_v3_off"],
    [{ READING_ENGINE: "v3", DB_SCHEMA_V3: "true" }, "v3", undefined],
  ])("%j → %s", (env, engine, reason) => {
    expect(resolveReadingEngine(env)).toEqual({ engine, ...(reason ? { fallbackReason: reason } : {}) })
  })
})

describe("(a) 스위치 꺼짐 = v2 경로 그대로", () => {
  it.each([
    ["둘 다 꺼짐", {}],
    ["READING_ENGINE=v3만", { READING_ENGINE: "v3" }],
    ["DB_SCHEMA_V3=true만", { DB_SCHEMA_V3: "true" }],
  ])("%s: v2 generateFullReading 1회, 새 엔진·SDK 호출 0회, AiUsage 기록 없음", async (_l, env) => {
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v)
    const r = seed()
    const res = await generatePOST(post(), ctx(r.id))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ readingId: r.id, status: "COMPLETE" })
    expect(h.v2.generateFullReading).toHaveBeenCalledTimes(1)
    // v2에는 예전과 같은 입력(prepareSajuInputForAi 결과, 출생지 제거)
    const [arg, claims, answers] = h.v2.generateFullReading.mock.calls[0]
    expect(arg.birthplace).toBeUndefined()
    expect(arg.pillars).toEqual(sajuInput.pillars)
    expect(claims).toEqual([])
    expect(answers).toEqual({})
    expect(h.sdkBodies.length).toBe(0)
    expect(h.usage.length).toBe(0)
    expect(h.db.readings.get(r.id)!.fullReading).toEqual({ parts: [], from: "v2" })
    expect(h.db.readings.get(r.id)!.status).toBe("COMPLETE")
  })

  it("v3 켜짐이어도 지원하지 않는 상품(BULLY)·저장 원국 불일치는 v2로 생성", async () => {
    vi.stubEnv("READING_ENGINE", "v3")
    vi.stubEnv("DB_SCHEMA_V3", "true")
    const a = seed({ readingType: "BULLY" })
    const b = seed({ sajuInput: { ...sajuInput, pillars: { ...sajuInput.pillars, day: "甲子" } } })
    for (const r of [a, b]) expect((await generatePOST(post(), ctx(r.id))).status).toBe(200)
    expect(h.v2.generateFullReading).toHaveBeenCalledTimes(2)
    expect(h.sdkBodies.length).toBe(0)
  })
})

describe("스위치 켜짐 = v3 경로(소유권·잠금·시도 상한은 기존 로직 그대로)", () => {
  beforeEach(() => {
    vi.stubEnv("READING_ENGINE", "v3")
    vi.stubEnv("DB_SCHEMA_V3", "true")
  })

  it("v2 호출 0회, 장별 생성 → COMPLETE + v3 저장 형식, 호출마다 AiUsage 1행, 요청 본문에 이름·생년월일·출생지 없음", async () => {
    const r = seed()
    const res = await generatePOST(post(), ctx(r.id))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ readingId: r.id, status: "COMPLETE" })
    expect(h.v2.generateFullReading).not.toHaveBeenCalled()
    const row = h.db.readings.get(r.id)!
    expect(row.status).toBe("COMPLETE")
    expect(row.attemptCount).toBe(1)
    expect(isStoredReadingV3(row.fullReading)).toBe(true)
    const stored = row.fullReading as { status: string; chapters: { id: string; ok: boolean }[]; cost: { calls: number } }
    expect(stored.status).toBe("complete")
    expect(stored.chapters.map((c) => c.id)).toEqual(["nature", "talent", "money", "people", "daeun-now", "year-ahead", "crossroads", "closing"])
    expect(h.sdkBodies.length).toBe(8)
    expect(h.usage.length).toBe(8)
    expect(stored.cost.calls).toBe(8)
    expect(h.usage[0]).toMatchObject({ readingId: r.id, chapterId: "nature", model: "claude-opus-5-5", inputTokens: 1200, outputTokens: 600 })
    const all = JSON.stringify(h.sdkBodies)
    for (const banned of [NAME, "1990-05-15", "14:37", "부산", "129.07"]) expect(all, banned).not.toContain(banned)
  })

  it("남의 풀이 → 404, AI 호출 없음", async () => {
    const r = seed()
    h.session = { user: { id: "mallory", email: "mallory@example.com", name: null } }
    h.db.seedUser({ id: "mallory", email: "mallory@example.com" })
    expect((await generatePOST(post(), ctx(r.id))).status).toBe(404)
    expect(h.sdkBodies.length).toBe(0)
    expect(h.db.readings.get(r.id)!.attemptCount).toBe(0)
  })

  it("동시 요청 10개 → 잠금 1회만 생성(장 수만큼만 호출)", async () => {
    const r = seed()
    const results = await Promise.all(Array.from({ length: 10 }, () => generatePOST(post(), ctx(r.id))))
    expect(results.filter((x) => x.status === 200).length).toBeGreaterThanOrEqual(1)
    expect(h.sdkBodies.length).toBe(8)
    expect(h.db.readings.get(r.id)!.attemptCount).toBe(1)
  })

  it("(c) 검증 block 장이 남으면 FAILED(500) + 통과 장 저장 → 다시 시도는 실패한 장만, 상한 3회", async () => {
    h.respond = fakeResponder((id, v) => {
      if (id === "money" && Array.isArray(v.body)) v.body = ["이 풀이는 적중률이 아주 높다."]
    })
    const r = seed()
    const res1 = await generatePOST(post(), ctx(r.id))
    expect(res1.status).toBe(500)
    expect(JSON.stringify(await res1.json())).not.toContain("verify")
    let row = h.db.readings.get(r.id)!
    expect(row.status).toBe("FAILED")
    const s1 = row.fullReading as { status: string; failedIds: string[] }
    expect(s1.status).toBe("partial")
    expect(s1.failedIds).toEqual(["money"])
    expect(h.sdkBodies.length).toBe(9) // 8장 + money 재생성 1
    expect(h.usage.length).toBe(9)

    // 다시 시도: money만
    h.sdkBodies = []
    h.respond = fakeResponder()
    const res2 = await generatePOST(post(), ctx(r.id))
    expect(res2.status).toBe(200)
    expect(h.sdkBodies.map(chapterIdOf)).toEqual(["money"])
    row = h.db.readings.get(r.id)!
    expect(row.status).toBe("COMPLETE")
    expect(row.attemptCount).toBe(2)
    expect((row.fullReading as { cost: { calls: number } }).cost.calls).toBe(10)
  })

  it("계속 실패하면 시도 상한(GENERATION_MAX_ATTEMPTS)에서 멈춘다 — AI 호출 없이 409", async () => {
    h.respond = fakeResponder((id, v) => {
      if (id === "money" && Array.isArray(v.body)) v.body = ["이 풀이는 적중률이 아주 높다."]
    })
    const r = seed()
    for (let i = 0; i < 3; i++) expect((await generatePOST(post(), ctx(r.id))).status).toBe(500)
    const before = h.sdkBodies.length
    const res = await generatePOST(post(), ctx(r.id))
    expect(res.status).toBe(409)
    expect((await res.json()).retryExhausted).toBe(true)
    expect(h.sdkBodies.length).toBe(before)
  })

  it("SDK 오류(전 장 실패)도 FAILED, AiUsage 기록 실패는 결과를 바꾸지 않는다", async () => {
    h.usageFails = true
    h.respond = async () => {
      throw Object.assign(new Error("bad request"), { status: 400 })
    }
    const r = seed()
    const res = await generatePOST(post(), ctx(r.id))
    expect(res.status).toBe(500)
    const row = h.db.readings.get(r.id)!
    expect(row.status).toBe("FAILED")
    expect((row.fullReading as { chapters: { ok: boolean }[] }).chapters.every((c) => !c.ok)).toBe(true)
  })

  it("이미 COMPLETE면 AI 호출 없이 alreadyCompleted", async () => {
    const r = seed({ status: "COMPLETE" })
    const res = await generatePOST(post(), ctx(r.id))
    expect(await res.json()).toMatchObject({ alreadyCompleted: true })
    expect(h.sdkBodies.length).toBe(0)
  })
})
