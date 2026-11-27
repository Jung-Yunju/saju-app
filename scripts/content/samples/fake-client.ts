// 견본 생성용 가짜 클라이언트 — API를 부르지 않는다. 테스트와 "--fake"(연습 실행)에서만 쓴다.
// 요청의 출력 스키마(output_config.format.schema)를 보고 모양만 맞는 연습용 JSON을 돌려준다.
// 사용량은 문자 수 근사(approxTokens)로 지어내므로 비용 숫자도 연습값이다(실제 과금과 무관).
import type { Message, MessageCreateParamsNonStreaming, MessageStreamParams } from "@anthropic-ai/sdk/resources/messages/messages"
import { approxTokens } from "../../../src/engine/content/cost"
import type { ContentClient, ContentRequestOptions } from "../../../src/engine/content/generate"

const GANZHI = /([甲乙丙丁戊己庚辛壬癸])([子丑寅卯辰巳午未申酉戌亥])/

export interface FakeCall {
  model: string
  maxTokens: number
  /** 요청 본문 전체(테스트에서 개인정보·키가 실리지 않았는지 확인용) */
  body: MessageCreateParamsNonStreaming | MessageStreamParams
}

export interface FakeClientOptions {
  /** 응답 전에 기다릴 시간(ms) */
  delayMs?: number
  /** 지정하면 그 번째(1부터) 호출은 이 오류를 던진다 */
  failOn?: Record<number, Error>
}

type Schema = { type?: string; properties?: Record<string, Schema>; items?: Schema; enum?: unknown[] }

function userText(body: { messages: { content: unknown }[] }): string {
  return body.messages.map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content))).join("\n")
}

/** 스키마 모양대로 연습용 값을 만든다. 근거 글자는 사용자 메시지에 처음 나온 간지에서 가져온다 */
export function fakeValue(schema: Schema, key: string, ctx: { stem: string; branch: string; year: number }): unknown {
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0]
  switch (schema.type) {
    case "object": {
      const o: Record<string, unknown> = {}
      for (const [k, s] of Object.entries(schema.properties ?? {})) o[k] = fakeValue(s, k, ctx)
      return o
    }
    case "array":
      return [0, 1].map(() => fakeValue(schema.items ?? { type: "string" }, key, ctx))
    case "integer":
    case "number":
      return /year/i.test(key) ? ctx.year : 1
    case "boolean":
      return false
    default: {
      if (key === "letter") return ctx.stem
      if (key === "ganzhi") return `${ctx.stem}${ctx.branch}`
      if (key === "pos") return "day.stem"
      if (key === "label") return `일간 ${ctx.stem} · 연습`
      if (key === "caveat") return ""
      if (key === "body" || key === "text") return `(연습용 가짜 문장) 일간 ${ctx.stem}(${ctx.stem})을 보면 차분히 살피는 편이다. 실제 풀이가 아니다.`
      return `(연습) ${key}`
    }
  }
}

function fakeMessage(body: MessageCreateParamsNonStreaming | MessageStreamParams): Message {
  const user = userText(body)
  const m = user.match(GANZHI)
  const yearMatch = user.match(/(20\d\d)/)
  const ctx = { stem: m?.[1] ?? "甲", branch: m?.[2] ?? "子", year: yearMatch ? Number(yearMatch[1]) : 2026 }
  const schema = (body.output_config as { format?: { schema?: Schema } } | undefined)?.format?.schema ?? { type: "object", properties: { body: { type: "array", items: { type: "string" } } } }
  const text = JSON.stringify(fakeValue(schema, "", ctx))
  const sys = Array.isArray(body.system) ? body.system.map((b) => ("text" in b ? b.text : "")).join("") : String(body.system ?? "")
  return {
    id: "msg_fake",
    type: "message",
    role: "assistant",
    model: body.model,
    content: [{ type: "text", text, citations: null }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: approxTokens(user),
      output_tokens: Math.min(body.max_tokens, approxTokens(text)),
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: approxTokens(sys),
    },
  } as unknown as Message
}

/** 가짜 클라이언트. calls에 요청이 쌓인다 */
export function createFakeClient(o: FakeClientOptions = {}): ContentClient & { calls: FakeCall[] } {
  const calls: FakeCall[] = []
  const respond = async (body: MessageCreateParamsNonStreaming | MessageStreamParams, opts?: ContentRequestOptions): Promise<Message> => {
    calls.push({ model: body.model, maxTokens: body.max_tokens, body })
    const err = o.failOn?.[calls.length]
    if (o.delayMs) await new Promise((r) => setTimeout(r, o.delayMs))
    if (opts?.signal?.aborted) throw Object.assign(new Error("aborted"), { name: "APIUserAbortError" })
    if (err) throw err
    return fakeMessage(body)
  }
  return {
    calls,
    messages: {
      create: (body, opts) => respond(body, opts),
      stream: (body, opts) => ({ finalMessage: () => respond(body, opts) }),
    },
  }
}
