// 장별 생성 파이프라인(P4-03) — 가짜(mock) 클라이언트만 쓴다. 실제 API 호출 없음.
// 재시도·refusal·max_tokens·중단·시간 예산·검증기 block→재생성·비용 계산·요청 모양(구조화 출력·캐시)·실패한 장만 재생성
import { afterEach, describe, expect, it } from "vitest"
import type { Message } from "@anthropic-ai/sdk/resources/messages/messages"
import { analyzeRules, computeChart } from "../../src/engine"
import { buildFactSheet } from "../../src/engine/content/facts"
import {
  generateChapters,
  regenerateFailed,
  verifyContextFromFacts,
  wrapChapterForVerify,
  type ContentClient,
  type ContentRequestOptions,
  type GenerationEvent,
} from "../../src/engine/content/generate"
import { estimateCostUsd, resolveContentModel } from "../../src/engine/content/cost"
import type { ChapterSpec } from "../../src/engine/content/types"

const AS_OF = new Date("2026-11-27T03:00:00Z")
// 가상의 예시 사주
const chart = computeChart({ calendar: "solar", year: 1990, month: 5, day: 15, time: { hour: 12, minute: 0 }, gender: "M" })
const rules = analyzeRules(chart, undefined, { luck: chart.luck.daeun.map((d) => d.pillar) })
const facts = buildFactSheet({ chart, rules, asOf: AS_OF })

const SCHEMA = {
  type: "object",
  properties: { title: { type: "string" }, body: { type: "array", items: { type: "string" } } },
  required: ["title", "body"],
  additionalProperties: false,
}
const SYSTEM = "공통 시스템 지시(장 사이 동일 — 캐시 대상)"

function spec(id: string, maxOutputTokens = 1000): ChapterSpec {
  return {
    id,
    title: `장 ${id}`,
    products: ["BASIC"],
    maxOutputTokens,
    build: (f) => ({ system: SYSTEM, user: `장 ${id}. 일주 ${f.chart.pillars.day}` }),
    outputSchema: SCHEMA,
  }
}

const GOOD = JSON.stringify({ title: "제목", body: [`일주 ${facts.chart.pillars.day}의 ${facts.chart.pillars.day[0]} 글자를 보면 차분한 편이다.`] })

function msg(text: string, stop_reason: string | null = "end_turn", usage: Partial<Message["usage"]> = {}): Message {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content: [{ type: "text", text, citations: null }],
    stop_reason,
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 200, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, ...usage },
  } as unknown as Message
}

function apiError(status: number, message = "err", headers?: Record<string, string>) {
  return Object.assign(new Error(message), { status, name: "APIError", headers })
}

type Step = Message | Error | ((body: Record<string, unknown>, opts?: ContentRequestOptions) => Message | Promise<Message>)

interface Call {
  via: "create" | "stream"
  body: Record<string, unknown>
  opts?: ContentRequestOptions
}

/** 순서대로 응답하는 가짜 클라이언트. 함수 단계는 (body, opts)로 직접 응답을 만든다 */
function fakeClient(steps: Step[] | ((n: number, body: Record<string, unknown>, opts?: ContentRequestOptions) => Message | Promise<Message>)) {
  const calls: Call[] = []
  let inFlight = 0
  let maxInFlight = 0
  const run = async (via: Call["via"], body: unknown, opts?: ContentRequestOptions): Promise<Message> => {
    const b = body as Record<string, unknown>
    calls.push({ via, body: b, opts })
    inFlight++
    maxInFlight = Math.max(maxInFlight, inFlight)
    try {
      await Promise.resolve()
      if (typeof steps === "function") return await steps(calls.length - 1, b, opts)
      const s = steps[calls.length - 1]
      if (s === undefined) throw new Error("가짜 클라이언트: 준비된 응답 없음")
      if (s instanceof Error) throw s
      if (typeof s === "function") return await s(b, opts)
      return s
    } finally {
      inFlight--
    }
  }
  const client: ContentClient = {
    messages: {
      create: (body, opts) => run("create", body, opts),
      stream: (body, opts) => ({ finalMessage: () => run("stream", body, opts) }),
    },
  }
  return { client, calls, maxInFlight: () => maxInFlight }
}

/** signal이 끊길 때까지 기다리는 응답(진행 중 요청 취소 시험) */
function hang(_b: Record<string, unknown>, opts?: ContentRequestOptions): Promise<Message> {
  return new Promise((_, reject) => {
    const s = opts?.signal
    if (!s) return
    const fail = () => reject(Object.assign(new Error("Request was aborted."), { name: "APIUserAbortError" }))
    if (s.aborted) fail()
    else s.addEventListener("abort", fail, { once: true })
  })
}

const sleeps: number[] = []
const fastSleep = async (ms: number) => {
  sleeps.push(ms)
}
const pass = () => ({ pass: true, findings: [] })

afterEach(() => {
  sleeps.length = 0
  delete process.env.CONTENT_MODEL
})

describe("요청 모양(SDK 1.8.0 타입 기준)", () => {
  it("구조화 출력·시스템 캐시·금지 파라미터 없음·user 메시지 하나", async () => {
    const f = fakeClient([msg(GOOD)])
    const r = await generateChapters(facts, [spec("a")], { client: f.client, verify: pass, sleep: fastSleep })
    expect(r.ok).toBe(true)
    const b = f.calls[0].body
    expect(b.model).toBe("claude-opus-5-5")
    expect(b.max_tokens).toBe(1000)
    expect(b.output_config).toEqual({ format: { type: "json_schema", schema: SCHEMA } })
    expect(b.system).toEqual([{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }])
    expect(b.messages).toEqual([{ role: "user", content: `장 a. 일주 ${facts.chart.pillars.day}` }])
    for (const k of ["temperature", "thinking", "top_p", "top_k"]) expect(b).not.toHaveProperty(k)
    expect((b.messages as { role: string }[]).some((m) => m.role === "assistant")).toBe(false)
    expect(f.calls[0].opts?.signal).toBeDefined()
    expect(f.calls[0].opts?.maxRetries).toBe(0)
    expect(r.chapters[0]).toMatchObject({ id: "a", ok: true, attempts: 1, output: JSON.parse(GOOD) })
  })
  it("출력 상한 4096 초과면 스트리밍(messages.stream().finalMessage())", async () => {
    const f = fakeClient([msg(GOOD), msg(GOOD)])
    await generateChapters(facts, [spec("short", 4096), spec("long", 8000)], { client: f.client, verify: pass })
    expect(f.calls.map((c) => c.via)).toEqual(["create", "stream"])
  })
  it("모델: 환경변수 CONTENT_MODEL, 목록 밖·날짜 접미사는 거부", async () => {
    process.env.CONTENT_MODEL = "claude-sonnet-5-5"
    const f = fakeClient([msg(GOOD)])
    const r = await generateChapters(facts, [spec("a")], { client: f.client, verify: pass })
    expect(r.model).toBe("claude-sonnet-5-5")
    expect(f.calls[0].body.model).toBe("claude-sonnet-5-5")
    expect(() => resolveContentModel("claude-opus-5-5-20261101")).toThrow()
    expect(() => resolveContentModel("gpt-x")).toThrow()
    delete process.env.CONTENT_MODEL
    expect(resolveContentModel()).toBe("claude-opus-5-5")
  })
  it("스키마가 거부되면(400) 시스템 지시 + JSON 파싱 방식으로 한 번 전환", async () => {
    const f = fakeClient([apiError(400, "output_config.format.schema: unsupported keyword"), msg("```json\n" + GOOD + "\n```")])
    const r = await generateChapters(facts, [spec("a")], { client: f.client, verify: pass, sleep: fastSleep })
    expect(r.ok).toBe(true)
    expect(f.calls[1].body).not.toHaveProperty("output_config")
    const sys = f.calls[1].body.system as { text: string }[]
    expect(sys.length).toBe(2)
    expect(sys[1].text).toContain("JSON 스키마")
    expect(sleeps).toEqual([])
  })
})

describe("재시도", () => {
  it("529·429 → 지수 대기(1s, 2s) 후 성공", async () => {
    const f = fakeClient([apiError(529, "overloaded"), apiError(429, "rate"), msg(GOOD)])
    const r = await generateChapters(facts, [spec("a")], { client: f.client, verify: pass, sleep: fastSleep })
    expect(r.chapters[0]).toMatchObject({ ok: true, attempts: 3 })
    expect(sleeps).toEqual([1000, 2000])
  })
  it("retry-after 헤더를 존중(상한 안에서)", async () => {
    const f = fakeClient([apiError(429, "rate", { "retry-after": "5" }), msg(GOOD)])
    await generateChapters(facts, [spec("a")], { client: f.client, verify: pass, sleep: fastSleep })
    expect(sleeps).toEqual([5000])
  })
  it("최대 2회 재시도 후 실패", async () => {
    const f = fakeClient([apiError(500), apiError(503), apiError(529)])
    const r = await generateChapters(facts, [spec("a")], { client: f.client, verify: pass, sleep: fastSleep })
    expect(r.chapters[0]).toMatchObject({ ok: false, attempts: 3, error: "api_error:529" })
    expect(r.failedIds).toEqual(["a"])
  })
  it("401 등 재시도해도 소용없는 오류는 바로 실패", async () => {
    const f = fakeClient([apiError(401, "auth")])
    const r = await generateChapters(facts, [spec("a")], { client: f.client, verify: pass, sleep: fastSleep })
    expect(r.chapters[0]).toMatchObject({ ok: false, attempts: 1, error: "api_error:401" })
  })
  it("JSON 깨짐·스키마 불일치 → 재시도", async () => {
    const f = fakeClient([msg("{ 깨진"), msg(JSON.stringify({ title: 1 })), msg(GOOD)])
    const r = await generateChapters(facts, [spec("a")], { client: f.client, verify: pass, sleep: fastSleep })
    expect(r.chapters[0]).toMatchObject({ ok: true, attempts: 3 })
  })
})

describe("stop_reason 처리", () => {
  it("refusal → 즉시 실패, 재시도·출력 없음", async () => {
    const f = fakeClient([msg("", "refusal")])
    const r = await generateChapters(facts, [spec("a")], { client: f.client, verify: pass, sleep: fastSleep })
    expect(r.chapters[0]).toMatchObject({ ok: false, attempts: 1, error: "refusal" })
    expect(r.chapters[0].output).toBeUndefined()
    expect(f.calls.length).toBe(1)
  })
  it("max_tokens → 다음 시도 상한 1.5배", async () => {
    const f = fakeClient([msg('{"title":"잘', "max_tokens"), msg('{"title":"잘', "max_tokens"), msg(GOOD)])
    const r = await generateChapters(facts, [spec("a", 1000)], { client: f.client, verify: pass, sleep: fastSleep })
    expect(f.calls.map((c) => c.body.max_tokens)).toEqual([1000, 1500, 2250])
    expect(r.chapters[0]).toMatchObject({ ok: true, attempts: 3 })
  })
  it("max_tokens가 계속되면 실패(상한 ceiling 적용)", async () => {
    const f = fakeClient([msg("", "max_tokens"), msg("", "max_tokens"), msg("", "max_tokens")])
    const r = await generateChapters(facts, [spec("a", 3000)], { client: f.client, verify: pass, maxTokensCeiling: 4000 })
    expect(f.calls.map((c) => c.body.max_tokens)).toEqual([3000, 4000, 4000])
    expect(r.chapters[0]).toMatchObject({ ok: false, error: "max_tokens" })
  })
})

describe("검증기 연동", () => {
  it("block → 피드백 붙여 1회 재생성 → 통과", async () => {
    const f = fakeClient([msg(GOOD), msg(GOOD)])
    let n = 0
    const verify = () => (n++ === 0 ? { pass: false, findings: [{ severity: "block", code: "FORBIDDEN_TOPIC", message: "사망 시기 언급" }] } : { pass: true, findings: [] })
    const r = await generateChapters(facts, [spec("a")], { client: f.client, verify, sleep: fastSleep })
    expect(r.chapters[0]).toMatchObject({ ok: true, attempts: 2, verify: { pass: true } })
    const user2 = (f.calls[1].body.messages as { content: string }[])[0].content
    expect(user2).toContain("FORBIDDEN_TOPIC")
    expect(sleeps).toEqual([])
  })
  it("재생성 후에도 block → 실패, 출력은 돌려주지 않는다", async () => {
    const f = fakeClient([msg(GOOD), msg(GOOD)])
    const verify = () => ({ pass: false, findings: [{ severity: "block", code: "BASIS_NOT_IN_CHART", message: "x" }] })
    const r = await generateChapters(facts, [spec("a")], { client: f.client, verify })
    expect(r.chapters[0]).toMatchObject({ ok: false, attempts: 2, error: "verify_block", verify: { pass: false } })
    expect(r.chapters[0].output).toBeUndefined()
    expect(f.calls.length).toBe(2)
  })
  it("검증기가 오류를 내면 통과로 보지 않는다(fail-closed)", async () => {
    const f = fakeClient([msg(GOOD)])
    const r = await generateChapters(facts, [spec("a")], { client: f.client, verify: () => { throw new Error("boom") } })
    expect(r.chapters[0].ok).toBe(false)
    expect(r.chapters[0].error).toMatch(/^verify_error/)
  })
  it("기본 검증기(verifyReading): 위험 HTML은 block → 재생성 → 그래도 block이면 실패", async () => {
    const bad = JSON.stringify({ title: "제목", body: ["<script>alert(1)</script> 좋은 날이다."] })
    const f = fakeClient([msg(bad), msg(bad)])
    const r = await generateChapters(facts, [spec("a")], { client: f.client })
    expect(r.chapters[0]).toMatchObject({ ok: false, error: "verify_block" })
    expect(JSON.stringify(r.chapters[0].verify!.findings)).toContain("UNSAFE_HTML")
  })
  it("기본 검증기: 원국 글자를 근거로 든 정상 출력은 통과", async () => {
    const f = fakeClient([msg(GOOD)])
    const r = await generateChapters(facts, [spec("a")], { client: f.client })
    expect(r.chapters[0].verify?.pass, JSON.stringify(r.chapters[0].verify)).toBe(true)
    expect(r.chapters[0].ok).toBe(true)
  })
  it("사실표 → 검증 문맥 변환", () => {
    const ctx = verifyContextFromFacts(facts)
    expect(ctx.sajuInput.pillars.day).toBe(facts.chart.pillars.day)
    expect(ctx.sajuInput.daeun!.length).toBe(facts.luck.daeun.length)
    expect(ctx.sajuInput.this_year_ganzhi).toBe(facts.luck.thisYear.ganzhi)
    expect(wrapChapterForVerify({ body: ["x"] }, { id: "a", title: "A" })).toEqual({ parts: [{ title: "A", chapters: [{ key: "a", title: "A", body: ["x"] }] }] })
  })
})

describe("중단·시간 예산·호출 상한", () => {
  it("외부 중단 신호 → 진행 중 요청 취소, 남은 장은 시작하지 않음", async () => {
    const ac = new AbortController()
    const f = fakeClient((n, b, o) => {
      if (n === 0) setTimeout(() => ac.abort(), 5)
      return hang(b, o)
    })
    const r = await generateChapters(facts, [spec("a"), spec("b")], { client: f.client, verify: pass, signal: ac.signal })
    expect(r.stopped).toBe("aborted")
    expect(r.chapters.map((c) => [c.id, c.ok, c.error, c.attempts])).toEqual([
      ["a", false, "aborted", 1],
      ["b", false, "aborted", 0],
    ])
    expect(f.calls.length).toBe(1)
  })
  it("이미 중단된 신호면 호출하지 않는다", async () => {
    const ac = new AbortController()
    ac.abort()
    const f = fakeClient([msg(GOOD)])
    const r = await generateChapters(facts, [spec("a")], { client: f.client, verify: pass, signal: ac.signal })
    expect(f.calls.length).toBe(0)
    expect(r.chapters[0]).toMatchObject({ ok: false, error: "aborted", attempts: 0 })
  })
  it("전체 시간 예산 초과 → 진행 중 요청 취소", async () => {
    const f = fakeClient((_n, b, o) => hang(b, o))
    const r = await generateChapters(facts, [spec("a"), spec("b")], { client: f.client, verify: pass, timeBudgetMs: 30 })
    expect(r.stopped).toBe("time_budget_exceeded")
    expect(r.chapters.every((c) => !c.ok && c.error === "time_budget_exceeded")).toBe(true)
  })
  it("대기 시간이 남은 예산보다 길면 기다리지 않고 실패", async () => {
    const f = fakeClient([apiError(529)])
    const r = await generateChapters(facts, [spec("a")], { client: f.client, verify: pass, timeBudgetMs: 500, baseDelayMs: 1000, sleep: fastSleep })
    expect(r.chapters[0].error).toBe("time_budget_exceeded")
    expect(sleeps).toEqual([])
  })
  it("주문당 호출 상한", async () => {
    const f = fakeClient(() => msg(GOOD))
    const r = await generateChapters(facts, [spec("a"), spec("b"), spec("c")], { client: f.client, verify: pass, maxTotalCalls: 2 })
    expect(f.calls.length).toBe(2)
    expect(r.chapters[2]).toMatchObject({ ok: false, error: "call_limit_exceeded", attempts: 0 })
    expect(r.stopped).toBe("call_limit_exceeded")
  })
})

describe("병렬·실패한 장만 재생성", () => {
  it("동시 2개 제한, 첫 장은 혼자 먼저(캐시 만들기)", async () => {
    const order: string[] = []
    const f = fakeClient(async (_n, b) => {
      const id = String((b.messages as { content: string }[])[0].content).slice(2, 3)
      order.push(`start:${id}`)
      await new Promise((r) => setTimeout(r, 5))
      order.push(`end:${id}`)
      return msg(GOOD)
    })
    const r = await generateChapters(facts, ["a", "b", "c", "d"].map((x) => spec(x)), { client: f.client, verify: pass, concurrency: 2 })
    expect(r.ok).toBe(true)
    expect(f.maxInFlight()).toBe(2)
    expect(order.slice(0, 2)).toEqual(["start:a", "end:a"])
    expect(r.chapters.map((c) => c.id)).toEqual(["a", "b", "c", "d"])
  })
  it("concurrency는 2를 넘지 않는다", async () => {
    const f = fakeClient(async () => {
      await new Promise((r) => setTimeout(r, 3))
      return msg(GOOD)
    })
    await generateChapters(facts, ["a", "b", "c", "d", "e"].map((x) => spec(x)), { client: f.client, verify: pass, concurrency: 5, warmCache: false })
    expect(f.maxInFlight()).toBe(2)
  })
  it("이전 결과의 ok 장은 다시 부르지 않고 실패 장만 생성", async () => {
    const f1 = fakeClient([msg(GOOD), msg("", "refusal"), msg(GOOD)])
    const first = await generateChapters(facts, [spec("a"), spec("b"), spec("c")], { client: f1.client, verify: pass })
    expect(first.failedIds).toEqual(["b"])
    const f2 = fakeClient([msg(GOOD)])
    const second = await regenerateFailed(facts, [spec("a"), spec("b"), spec("c")], first.chapters, { client: f2.client, verify: pass })
    expect(f2.calls.length).toBe(1)
    expect((f2.calls[0].body.messages as { content: string }[])[0].content).toContain("장 b")
    expect(second.ok).toBe(true)
    expect(second.chapters[0]).toBe(first.chapters[0])
    expect(second.totals.calls).toBe(1)
  })
  it("build 오류는 그 장만 실패", async () => {
    const broken: ChapterSpec = { ...spec("x"), build: () => { throw new Error("프롬프트 오류") } }
    const f = fakeClient([msg(GOOD)])
    const r = await generateChapters(facts, [broken, spec("a")], { client: f.client, verify: pass })
    expect(r.chapters[0]).toMatchObject({ ok: false, attempts: 0 })
    expect(r.chapters[0].error).toMatch(/^build_error/)
    expect(r.chapters[1].ok).toBe(true)
  })
  it("장 id 중복은 오류", async () => {
    await expect(generateChapters(facts, [spec("a"), spec("a")], { client: fakeClient([]).client })).rejects.toThrow()
  })
})

describe("사용량·비용 기록", () => {
  it("단가표대로 계산(Opus 5.5: 입력 $4·출력 $20·캐시읽기 $0.20·쓰기 $5 /100만)", () => {
    expect(estimateCostUsd("claude-opus-5-5", { inputTokens: 1000, outputTokens: 2000, cacheReadTokens: 3000, cacheWriteTokens: 4000 })).toBe(0.0646)
    expect(estimateCostUsd("claude-sonnet-5-5", { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000, cacheWriteTokens: 1_000_000 })).toBe(14.6)
    expect(estimateCostUsd("claude-haiku-5-5", { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000, cacheWriteTokens: 1_000_000 })).toBe(0.735)
  })
  it("시도마다 합산 + 호출별 이벤트(본문·개인정보 없음)", async () => {
    const events: GenerationEvent[] = []
    const f = fakeClient([
      apiError(529),
      msg('{"title":"잘', "max_tokens", { input_tokens: 50, output_tokens: 1000, cache_creation_input_tokens: 2000 }),
      msg(GOOD, "end_turn", { input_tokens: 50, output_tokens: 300, cache_read_input_tokens: 2000 }),
    ])
    const r = await generateChapters(facts, [spec("a")], { client: f.client, verify: pass, sleep: fastSleep, onEvent: (e) => events.push(e) })
    const u = r.chapters[0].usage!
    expect(u).toMatchObject({ inputTokens: 100, outputTokens: 1300, cacheReadTokens: 2000, cacheWriteTokens: 2000, model: "claude-opus-5-5" })
    expect(u.costUsdEstimate).toBe(estimateCostUsd("claude-opus-5-5", u))
    expect(r.totals).toMatchObject({ inputTokens: 100, outputTokens: 1300, calls: 3, costUsdEstimate: u.costUsdEstimate })
    expect(events.map((e) => e.outcome)).toEqual(["api_error", "max_tokens", "ok"])
    expect(events[0].error).toBe("api_error:529")
    const ej = JSON.stringify(events)
    expect(ej).not.toContain("차분한 편")
    expect(ej).not.toContain(facts.chart.pillars.day)
  })
})
