// 위기 신호(verify@0.2.0 CRISIS_RESPONSE) 운영 생성 경로 연결 — 담당: 백엔드·서버 개발자
// 가짜(mock) 클라이언트만 쓴다. 실제 API 호출 없음. 예시 고민 글은 테스트용으로 지어낸 문장이다(실제 고객 글 아님).
import { describe, expect, it } from "vitest"
import type { Message } from "@anthropic-ai/sdk/resources/messages/messages"
import { analyzeRules, computeChart } from "../../index"
import { verifyReading } from "../../verify"
import { buildFactSheet } from "../facts"
import { generateChapters, verifyContextFromFacts, type ContentClient } from "../generate"
import { CRISIS_MESSAGE } from "../prompts/persona"
import type { ChapterSpec } from "../types"

const AS_OF = new Date("2026-11-27T03:00:00Z")
const chart = computeChart({ calendar: "solar", year: 1990, month: 5, day: 15, time: { hour: 12, minute: 0 }, gender: "M" })
const rules = analyzeRules(chart, undefined, { luck: chart.luck.daeun.map((d) => d.pillar) })
const facts = buildFactSheet({ chart, rules, asOf: AS_OF })

const SCHEMA = {
  type: "object",
  properties: { title: { type: "string" }, body: { type: "array", items: { type: "string" } } },
  required: ["title", "body"],
  additionalProperties: false,
}
function spec(id: string): ChapterSpec {
  return {
    id,
    title: `장 ${id}`,
    products: ["BASIC"],
    maxOutputTokens: 1000,
    build: (f) => ({ system: "시스템", user: `장 ${id}. 일주 ${f.chart.pillars.day}` }),
    outputSchema: SCHEMA,
  }
}
const GOOD = JSON.stringify({ title: "제목", body: [`일주 ${facts.chart.pillars.day}의 ${facts.chart.pillars.day[0]} 글자를 보면 차분한 편이다.`] })

function msg(text: string): Message {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content: [{ type: "text", text, citations: null }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 200, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  } as unknown as Message
}

function fakeClient() {
  const bodies: string[] = []
  const run = async (body: unknown): Promise<Message> => {
    bodies.push(JSON.stringify(body))
    return msg(GOOD)
  }
  const client: ContentClient = {
    messages: {
      create: (b) => run(b),
      stream: (b) => ({ finalMessage: () => run(b) }),
    },
  }
  return { client, bodies }
}

function captureLogger() {
  const logs: { message: string; meta: Record<string, unknown> }[] = []
  return { logs, logger: (message: string, meta: Record<string, unknown>) => void logs.push({ message, meta }) }
}

const CRISIS_TEXT = "요즘 회사 일 때문에 너무 지쳐서 그냥 죽고 싶다는 생각이 들어요"
const NORMAL_TEXT = "이직을 할지 지금 회사에 남을지 고민이에요"

describe("위기 글 → AI 호출 없이 상담 안내", () => {
  it("AI 호출 0회, stopped=crisis, crisis.precheck=detected, 상담 안내 문구 재사용", async () => {
    const f = fakeClient()
    const { logs, logger } = captureLogger()
    const r = await generateChapters(facts, [spec("a"), spec("b")], { client: f.client, userText: CRISIS_TEXT, product: "CONCERN", logger })
    expect(f.bodies.length).toBe(0)
    expect(r.totals.calls).toBe(0)
    expect(r.totals.costUsdEstimate).toBe(0)
    expect(r.ok).toBe(false)
    expect(r.stopped).toBe("crisis")
    expect(r.crisis.precheck).toBe("detected")
    expect(r.chapters.map((c) => [c.id, c.ok, c.error, c.attempts, c.output])).toEqual([
      ["a", false, "crisis", 0, undefined],
      ["b", false, "crisis", 0, undefined],
    ])
    // 기존 문안(persona.ts CRISIS_MESSAGE) 그대로 — 번호·기관명을 새로 만들지 않는다
    const base = CRISIS_MESSAGE.halmi.replace("{호칭}, ", "")
    expect(r.crisis.message).toContain(base)
    // 로그에 원문·감지 구절을 남기지 않는다
    expect(JSON.stringify(logs)).not.toContain("죽고")
    expect(JSON.stringify(logs)).not.toContain("회사 일")
  })

  it("이전 결과(previous)가 ok여도 위기 글이면 풀이를 돌려주지 않는다", async () => {
    const f = fakeClient()
    const previous = [{ id: "a", ok: true, output: { title: "t", body: ["x"] }, attempts: 1 }]
    const r = await generateChapters(facts, [spec("a")], { client: f.client, userText: CRISIS_TEXT, previous, logger: () => {} })
    expect(f.bodies.length).toBe(0)
    expect(r.chapters[0].ok).toBe(false)
    expect(r.chapters[0].output).toBeUndefined()
  })

  it("상담 안내 문구는 검증기 CRISIS_RESPONSE 기준(구체적 상담 안내·풀이 멈춤)을 통과한다", async () => {
    const r = await generateChapters(facts, [spec("a")], { client: fakeClient().client, userText: CRISIS_TEXT, logger: () => {} })
    const rep = verifyReading({ notice: { text: r.crisis.message } }, verifyContextFromFacts(facts, { userText: CRISIS_TEXT }))
    expect(rep.coverage.crisis).toBe("ran")
    const crisisFindings = rep.findings.filter((x) => x.code === "CRISIS_RESPONSE")
    expect(crisisFindings.map((x) => [x.severity, x.rule])).toEqual([["info", "ok"]])
  })
})

describe("정상 고민 글 → 생성 진행, 장별 위기 검사가 돈다", () => {
  it("coverage.crisis = ran, crisis.precheck = clear, 고민 원문은 AI 요청에 들어가지 않는다", async () => {
    const f = fakeClient()
    const { logs, logger } = captureLogger()
    const r = await generateChapters(facts, [spec("a"), spec("b")], { client: f.client, userText: NORMAL_TEXT, product: "CONCERN", logger })
    expect(r.ok).toBe(true)
    expect(r.crisis).toEqual({ precheck: "clear" })
    expect(f.bodies.length).toBe(2)
    for (const c of r.chapters) expect((c.verify as { coverage?: { crisis: string } }).coverage?.crisis).toBe("ran")
    for (const b of f.bodies) expect(b).not.toContain("이직을 할지")
    expect(logs).toEqual([])
  })
})

describe("고민 글 없는 상품 → 기존과 동일", () => {
  it("BASIC: 생성 정상, coverage.crisis = not-run, 경고 로그 없음", async () => {
    const f = fakeClient()
    const { logs, logger } = captureLogger()
    const r = await generateChapters(facts, [spec("a")], { client: f.client, product: "BASIC", logger })
    expect(r.ok).toBe(true)
    expect(r.stopped).toBeUndefined()
    expect(r.crisis).toEqual({ precheck: "not-run:no-userText" })
    expect(f.bodies.length).toBe(1)
    expect((r.chapters[0].verify as { coverage?: { crisis: string } }).coverage?.crisis).toBe("not-run:no-userText")
    expect(logs).toEqual([])
  })

  it("상품 미지정 + 빈 고민 글(공백)도 기존과 동일", async () => {
    const f = fakeClient()
    const { logs, logger } = captureLogger()
    const r = await generateChapters(facts, [spec("a")], { client: f.client, userText: "   ", logger })
    expect(r.ok).toBe(true)
    expect(r.crisis.precheck).toBe("not-run:no-userText")
    expect(logs).toEqual([])
  })

  it("고민 입력 상품(CONCERN)인데 userText가 없으면 경고 로그 1건(장 id만, 원문 없음)", async () => {
    const f = fakeClient()
    const { logs, logger } = captureLogger()
    const r = await generateChapters(facts, [spec("a"), spec("b")], { client: f.client, product: "CONCERN", logger })
    expect(r.ok).toBe(true)
    expect(logs.length).toBe(1)
    expect(logs[0].message).toContain("not-run:no-userText")
    expect(logs[0].meta).toEqual({ product: "CONCERN", chapterIds: ["a", "b"] })
  })
})
