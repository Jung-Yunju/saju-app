// 장별 생성 파이프라인 (P4-03) — 담당: 백엔드·서버 개발자
// generateChapters(facts, chapters, opts): 장(chapter)마다 Claude를 호출해 구조화(JSON) 출력을 받고, 검증기(verify)를 통과한 장만 ok로 돌려준다.
//
// 동작 요약(테스트: tests/content/generate.test.ts)
//  - 순차(기본) 또는 제한 병렬(concurrency 2). 병렬이면 첫 장을 먼저 혼자 돌려 프롬프트 캐시를 만든 뒤 나머지를 2개씩 돌린다.
//  - 장마다 재시도 최대 2회(API 오류 429·5xx·연결 오류, 응답 잘림 max_tokens, JSON 형식 오류). API 오류는 지수 대기(1s→2s, retry-after 존중).
//  - stop_reason "refusal" → 즉시 실패(재시도·내용 생성 없음). "max_tokens" → 다음 시도 출력 상한 1.5배.
//  - 검증기 block → 피드백을 붙여 그 장만 1회 재생성. 그래도 block이면 실패(출력은 돌려주지 않는다 — 고객 노출 방지).
//  - 전체 시간 예산(timeBudgetMs)·외부 중단 신호(signal)·주문당 호출 상한(maxTotalCalls). 예산 초과·중단 시 진행 중 요청도 취소한다.
//  - 실패한 장만 다시: opts.previous에 이전 결과를 넣으면 ok인 장은 그대로 두고 나머지만 생성(regenerateFailed).
//  - 호출마다 onEvent로 모델·토큰·비용·결과 코드를 알린다(본문·개인정보는 싣지 않는다) → 운영 연결 시 AiUsage 기록에 쓴다.
//  - 위기 신호(verify@0.2.0 연결): opts.userText(사용자 고민 글 원문)는 검증용으로만 쓴다 — 사실표·AI 입력(build)에 넣지 않는다.
//    생성 전에 detectCrisis(userText)로 확인해 걸리면 AI를 한 번도 부르지 않고 상담 안내(crisis.message)만 돌려준다.
//    검증기에는 verifyContextFromFacts(facts, { userText })로 넘겨 장마다 CRISIS_RESPONSE 검사가 돈다(coverage.crisis = "ran").
//    고민 입력을 받는 상품(CONCERN·BULLY·CONFLICT)인데 장 검증 보고서의 coverage.crisis가 "not-run:no-userText"면 경고 로그(원문은 남기지 않음).
//
// SDK(@anthropic-ai/sdk 1.8.0) 사용 — 타입 정의에서 확인한 필드만 쓴다:
//  - output_config.format = { type: "json_schema", schema }  (resources/messages/messages.d.ts JSONOutputFormat · OutputConfig)
//    스키마가 거부되면(400 + output_config/json_schema 언급) 그 장만 "시스템 지시 + JSON 파싱 검증" 방식으로 한 번 전환한다.
//  - system = [{ type:"text", text, cache_control:{ type:"ephemeral" } }]  (TextBlockParam · CacheControlEphemeral)
//  - usage.input_tokens · output_tokens · cache_read_input_tokens · cache_creation_input_tokens (Usage)
//  - stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use" | "pause_turn" | "refusal" | "model_context_window_exceeded"
//  - 긴 출력은 messages.stream(...).finalMessage(), 짧으면 messages.create(...). RequestOptions { signal, timeout, maxRetries }
//  - temperature·thinking.budget_tokens·assistant prefill은 쓰지 않는다(현행 모델에서 400).
//  - 기본 클라이언트는 new Anthropic({ maxRetries: 0 }) — 키는 환경변수(ANTHROPIC_API_KEY)에서 SDK가 읽는다. 재시도는 이 파일이 맡는다.
import Anthropic from "@anthropic-ai/sdk"
import type { Message, MessageCreateParamsNonStreaming, MessageStreamParams, OutputConfig, TextBlockParam } from "@anthropic-ai/sdk/resources/messages/messages"
import { detectCrisis, verifyReading } from "../verify"
import type { VerifyContext, VerifyReport } from "../verify/types"
import { crisisMessage } from "./prompts/persona"
import { resolveVoice } from "./prompts/system"
import type { ChapterResult, ChapterSpec, FactSheet } from "./types"
import { estimateCostUsd, resolveContentModel, type ContentModel, type TokenUsage } from "./cost"
import { validateJsonSchema } from "./schema"

export const GENERATOR_VERSION = "content-gen@0.1.0"

// ─────────────────────────────────────────── 클라이언트(주입 가능)

export interface ContentRequestOptions {
  signal?: AbortSignal
  /** 요청 1회 제한 시간(ms) */
  timeout?: number
  maxRetries?: number
}

/** 생성기가 쓰는 SDK 표면만. 실제 Anthropic 클라이언트가 그대로 맞고, 테스트는 가짜를 넣는다. */
export interface ContentClient {
  messages: {
    create(body: MessageCreateParamsNonStreaming, options?: ContentRequestOptions): PromiseLike<Message>
    stream(body: MessageStreamParams, options?: ContentRequestOptions): { finalMessage(): Promise<Message> }
  }
}

// 컴파일 시점 확인: 실제 SDK 클라이언트가 ContentClient에 맞는다(맞지 않으면 tsc 오류)
export function asContentClient(c: Anthropic): ContentClient {
  return c
}

let defaultClient: ContentClient | null = null
function getDefaultClient(): ContentClient {
  // SDK 자체 재시도는 끈다(이 파일이 장 단위로 재시도·대기를 맡음 — 이중 재시도 방지)
  if (!defaultClient) defaultClient = new Anthropic({ maxRetries: 0 })
  return defaultClient
}

// ─────────────────────────────────────────── 옵션·결과

export interface ChapterVerifyResult {
  pass: boolean
  findings: unknown[]
  /** 기본 검증기(verifyReading)가 채운다 — 어떤 검사가 실제로 돌았는지(돌지 않은 검사를 통과로 오해하지 않게) */
  coverage?: VerifyReport["coverage"]
}

/**
 * 사용자 고민 글(자유 서술)을 받는 상품 — 이 상품인데 위기 검사가 돌지 않으면 경고 로그를 남긴다.
 * CONCERN: 현재 고민(products.ts — 자유 서술 수집은 대표 결정 대기). BULLY·CONFLICT: 상대와의 일을 털어놓는 상품.
 * 현재(2026-11-27) 세 상품 모두 PRODUCTS[].supported=false이고, 고민 글을 받는 API도 아직 없다.
 */
export const USER_TEXT_PRODUCTS: readonly string[] = ["CONCERN", "BULLY", "CONFLICT"]

/** 위기 신호 처리 상태(결과 객체에 항상 실린다) */
export interface CrisisStatus {
  /**
   * 생성 전 사전 검사: "not-run:no-userText"(고민 글 없음) / "clear"(위기 표현 없음 → 생성 진행) /
   * "detected"(위기 표현 감지 → AI를 부르지 않고 상담 안내만 돌려줌)
   */
  precheck: "not-run:no-userText" | "clear" | "detected"
  /** precheck = "detected"일 때만: 고객에게 보여 줄 상담 안내 문구(prompts/persona.ts CRISIS_MESSAGE 재사용) */
  message?: string
}

/** 경고 로그(본문·고민 원문·개인정보를 싣지 않는다). 기본 console.warn */
export type GenerateLogger = (message: string, meta: Record<string, unknown>) => void

export type ChapterVerifier = (
  output: unknown,
  ctx: { facts: FactSheet; spec: ChapterSpec },
) => ChapterVerifyResult | Promise<ChapterVerifyResult>

export type AttemptOutcome =
  | "ok"
  | "refusal"
  | "max_tokens"
  | "invalid_json"
  | "schema_mismatch"
  | "verify_block"
  | "verify_error"
  | "api_error"
  | "schema_unsupported"
  | "unexpected_stop"
  | "context_window_exceeded"
  | "aborted"

/** 호출 1회 기록(본문·개인정보 없음). 운영 연결 시 AiUsage 테이블에 저장한다. */
export interface GenerationEvent {
  type: "attempt"
  chapterId: string
  attempt: number
  model: ContentModel
  maxTokens: number
  structured: "native" | "prompt"
  streamed: boolean
  outcome: AttemptOutcome
  stopReason: string | null
  /** 실패 코드(예: "api_error:529") */
  error?: string
  usage: TokenUsage
  costUsdEstimate: number
  durationMs: number
}

export interface GenerateOptions {
  /** 주입형 클라이언트(테스트·프록시). 없으면 new Anthropic({ maxRetries: 0 }) */
  client?: ContentClient
  /** 모델 ID. 없으면 환경변수 CONTENT_MODEL → 기본 claude-opus-5-5 */
  model?: string
  /** 동시 생성 장 수(1 또는 2, 기본 1) */
  concurrency?: number
  /** 장마다 재시도 횟수(API 오류·잘림·형식 오류 공통, 기본 2) */
  maxRetries?: number
  /** 검증 block 시 재생성 횟수(기본 1) */
  verifyRegenerations?: number
  /** 지수 대기 시작값(ms, 기본 1000) */
  baseDelayMs?: number
  /** 대기 상한(ms, 기본 20000) */
  maxDelayMs?: number
  /** 전체 시간 예산(ms, 기본 240000). 넘으면 진행 중 요청을 취소하고 남은 장은 실패 */
  timeBudgetMs?: number
  /** 외부 중단 신호(요청 취소·서버 종료) */
  signal?: AbortSignal
  /** 이번 실행의 API 호출 상한(주문 1건당 횟수 제한, 기본 = 생성할 장 수 × 4) */
  maxTotalCalls?: number
  /** max_tokens 재시도 시 상한(기본 32000) */
  maxTokensCeiling?: number
  /** 스트리밍: true / false / "auto"(출력 상한 4096 초과면 스트리밍, 기본) */
  stream?: boolean | "auto"
  /** 구조화 출력 방식(기본 "native" = output_config.format) */
  structuredOutput?: "native" | "prompt"
  /** native 스키마가 거부되면 prompt 방식으로 한 번 전환(기본 true) */
  allowPromptFallback?: boolean
  /** 출력 노력 수준(output_config.effort). 기본: 지정 안 함(모델 기본값) */
  effort?: OutputConfig["effort"]
  /** 검증기. 기본 = src/engine/verify의 verifyReading. false면 검증 생략(개발용 — 운영 금지) */
  verify?: ChapterVerifier | false
  /** 기본 검증기에 더 넘길 문맥(rules·chart 등). userText는 아래 opts.userText를 쓴다(둘 다 있으면 opts.userText 우선) */
  verifyContext?: Partial<VerifyContext>
  /**
   * 사용자 고민 글 원문(선택). 검증용으로만 쓴다 — 사실표·AI 입력에 넣지 않고 로그·이벤트에도 싣지 않는다.
   * 있으면 생성 전 위기 사전 검사(detectCrisis)와 장별 CRISIS_RESPONSE 검사에 쓴다.
   */
  userText?: string
  /** 상품 코드(예: "BASIC", "CONCERN"). 고민 입력 상품인데 위기 검사가 안 돌면 경고 로그를 남기는 데 쓴다 */
  product?: string
  /** 경고 로그 함수(테스트 주입용). 기본 console.warn */
  logger?: GenerateLogger
  /** 검증 block 재생성 시 문제 코드를 user 메시지에 덧붙일지(기본 true) */
  verifyFeedback?: boolean
  /** 이전 실행 결과 — ok인 장은 다시 만들지 않는다 */
  previous?: ChapterResult[]
  /** 병렬일 때 첫 장을 먼저 혼자 돌려 캐시를 만든다(기본 true) */
  warmCache?: boolean
  onEvent?: (e: GenerationEvent) => void
  /** 테스트용: 대기 함수·시계 */
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>
  now?: () => number
}

export interface GenerateRunResult {
  version: string
  model: ContentModel
  /** chapters 입력 순서와 같다 */
  chapters: ChapterResult[]
  ok: boolean
  failedIds: string[]
  totals: TokenUsage & { costUsdEstimate: number; calls: number }
  elapsedMs: number
  /** 전체 실행이 도중에 멈춘 이유. "crisis" = 위기 신호 감지로 생성하지 않음(crisis.message를 고객에게 보여 준다) */
  stopped?: "aborted" | "time_budget_exceeded" | "call_limit_exceeded" | "crisis"
  /** 위기 신호 처리 상태 — 호출 쪽은 crisis.precheck === "detected"를 먼저 확인하고 풀이 대신 crisis.message를 보여 준다 */
  crisis: CrisisStatus
}

// ─────────────────────────────────────────── 실행 제어

class RunControl {
  readonly ac = new AbortController()
  reason: "aborted" | "time_budget_exceeded" | undefined
  calls = 0
  callLimitHit = false
  private timer: ReturnType<typeof setTimeout> | undefined
  private onExternalAbort = () => this.stop("aborted")
  readonly deadline: number

  constructor(
    private readonly external: AbortSignal | undefined,
    budgetMs: number,
    readonly maxCalls: number,
    readonly now: () => number,
  ) {
    this.deadline = now() + budgetMs
    if (external?.aborted) this.stop("aborted")
    else external?.addEventListener("abort", this.onExternalAbort, { once: true })
    if (!this.reason) this.timer = setTimeout(() => this.stop("time_budget_exceeded"), Math.max(0, budgetMs))
  }

  stop(r: "aborted" | "time_budget_exceeded") {
    if (this.reason) return
    this.reason = r
    this.ac.abort(r)
  }

  remainingMs(): number {
    return Math.max(0, this.deadline - this.now())
  }

  stopReason(): "aborted" | "time_budget_exceeded" | undefined {
    if (!this.reason && this.remainingMs() <= 0) this.stop("time_budget_exceeded")
    return this.reason
  }

  takeCall(): boolean {
    if (this.calls >= this.maxCalls) {
      this.callLimitHit = true
      return false
    }
    this.calls++
    return true
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer)
    this.external?.removeEventListener("abort", this.onExternalAbort)
  }
}

function defaultSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error("aborted"))
    const t = setTimeout(() => {
      signal.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(t)
      reject(new Error("aborted"))
    }
    signal.addEventListener("abort", onAbort, { once: true })
  })
}

// ─────────────────────────────────────────── 오류 분류

interface Classified {
  kind: "abort" | "retryable" | "fatal" | "schema_unsupported"
  code: string
  retryAfterMs?: number
}

function retryAfterOf(e: { headers?: unknown }): number | undefined {
  const h = e.headers as { get?: (k: string) => string | null } | Record<string, string> | undefined
  let v: string | null | undefined
  if (h && typeof (h as { get?: unknown }).get === "function") v = (h as { get: (k: string) => string | null }).get("retry-after")
  else if (h && typeof h === "object") v = (h as Record<string, string>)["retry-after"]
  const n = v != null ? Number(v) : NaN
  return Number.isFinite(n) && n >= 0 ? n * 1000 : undefined
}

export function classifyError(err: unknown, aborted: boolean): Classified {
  if (aborted) return { kind: "abort", code: "aborted" }
  const e = (err ?? {}) as { name?: string; status?: unknown; message?: string; headers?: unknown }
  const name = e.name ?? ""
  if (name === "AbortError" || name === "APIUserAbortError") return { kind: "abort", code: "aborted" }
  if (name === "APIConnectionTimeoutError") return { kind: "retryable", code: "api_error:timeout" }
  if (name === "APIConnectionError") return { kind: "retryable", code: "api_error:connection" }
  const status = typeof e.status === "number" ? e.status : undefined
  if (status !== undefined) {
    const msg = String(e.message ?? "")
    if (status === 400 && /output_config|json_schema|output format|schema/i.test(msg)) return { kind: "schema_unsupported", code: "api_error:400:schema" }
    if (status === 408 || status === 409 || status === 429 || status >= 500) return { kind: "retryable", code: `api_error:${status}`, retryAfterMs: retryAfterOf(e) }
    return { kind: "fatal", code: `api_error:${status}` }
  }
  return { kind: "retryable", code: "api_error:unknown" }
}

// ─────────────────────────────────────────── 출력 해석

function textOf(msg: Message): string {
  return (msg.content ?? [])
    .filter((b): b is Extract<Message["content"][number], { type: "text" }> => b?.type === "text")
    .map((b) => b.text)
    .join("")
}

/** JSON 본문 추출: 그대로 → 코드 울타리(```json) 제거 → 첫 { ~ 마지막 } */
export function parseJsonOutput(text: string): { ok: true; value: unknown } | { ok: false } {
  const tryParse = (s: string) => {
    try {
      return { ok: true as const, value: JSON.parse(s) as unknown }
    } catch {
      return null
    }
  }
  const t = text.trim()
  if (!t) return { ok: false }
  const direct = tryParse(t)
  if (direct) return direct
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  if (fence) {
    const f = tryParse(fence[1])
    if (f) return f
  }
  const a = t.indexOf("{")
  const b = t.lastIndexOf("}")
  if (a >= 0 && b > a) {
    const s = tryParse(t.slice(a, b + 1))
    if (s) return s
  }
  return { ok: false }
}

function usageOf(msg: Message): TokenUsage {
  const u = msg.usage
  return {
    inputTokens: u?.input_tokens ?? 0,
    outputTokens: u?.output_tokens ?? 0,
    cacheReadTokens: u?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: u?.cache_creation_input_tokens ?? 0,
  }
}

const ZERO: TokenUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }
const addUsage = (a: TokenUsage, b: TokenUsage): TokenUsage => ({
  inputTokens: a.inputTokens + b.inputTokens,
  outputTokens: a.outputTokens + b.outputTokens,
  cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
  cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
})

// ─────────────────────────────────────────── 검증기 연동

function parsePeriod(p?: string): { fromYear: number; toYear: number } | undefined {
  if (!p) return undefined
  const m = p.match(/^(\d{4})(?:-(\d{4}))?$/)
  if (!m) return undefined
  const from = Number(m[1])
  return { fromYear: from, toYear: m[2] ? Number(m[2]) : from }
}

/** 사실표 → 검증기 문맥(AI가 본 것과 같은 글자로 대조) */
export function verifyContextFromFacts(f: FactSheet, extra?: Partial<VerifyContext>): VerifyContext {
  const p = f.chart.pillars
  return {
    sajuInput: {
      pillars: { year: p.year, month: p.month, day: p.day, ...(p.hour ? { hour: p.hour } : {}) },
      hour_unknown: !f.subject.hourKnown,
      daeun: f.luck.daeun.map((d) => ({ start_year: d.startYear, start_age: d.startAge, ganzhi: d.ganzhi })),
      gongmang: { day: f.chart.gongmang.branches.join("") },
      this_year: f.luck.thisYear.year,
      this_year_ganzhi: f.luck.thisYear.ganzhi,
      known_facts: [],
      gender: f.subject.gender,
    },
    userFacts: f.personal.userFacts.map((u) => {
      const period = parsePeriod(u.period)
      return { topic: u.topic, value: u.value, label: u.value, ...(period ? { period } : {}) }
    }),
    ...extra,
  }
}

/** 장 출력이 parts 구조가 아니면 장 하나짜리 풀이로 감싸 검증한다(장별 바넘 통계가 잡히도록) */
export function wrapChapterForVerify(output: unknown, spec: Pick<ChapterSpec, "id" | "title">): unknown {
  if (output && typeof output === "object" && !Array.isArray(output)) {
    if ("parts" in (output as object)) return output
    return { parts: [{ title: spec.title, chapters: [{ key: spec.id, title: spec.title, ...(output as object) }] }] }
  }
  return output
}

function defaultVerifier(extra?: Partial<VerifyContext>): ChapterVerifier {
  return (output, { facts, spec }) => {
    const rep = verifyReading(wrapChapterForVerify(output, spec), verifyContextFromFacts(facts, extra))
    return { pass: rep.pass, findings: rep.findings, coverage: rep.coverage }
  }
}

function feedbackOf(v: ChapterVerifyResult): string {
  const lines = v.findings
    .filter((x): x is { severity?: string; code?: string; message?: string } => !!x && typeof x === "object")
    .filter((x) => x.severity === undefined || x.severity === "block")
    .slice(0, 10)
    .map((x) => `- ${x.code ?? "BLOCK"}: ${x.message ?? ""}`.trim())
  return `\n\n[이전 출력 자동 검증 결과 — 아래 문제를 고쳐 처음부터 다시 쓴다. 사실표에 없는 내용은 쓰지 않는다]\n${lines.join("\n") || "- 검증 불합격"}`
}

// ─────────────────────────────────────────── 본체

const PROMPT_MODE_INSTRUCTION = (schema: Record<string, unknown>) =>
  "출력 형식: 아래 JSON 스키마를 따르는 JSON 객체 하나만 출력한다. 코드 울타리(```)·설명·머리말을 붙이지 않는다.\n" + JSON.stringify(schema)

export async function generateChapters(facts: FactSheet, chapters: ChapterSpec[], opts: GenerateOptions = {}): Promise<GenerateRunResult> {
  const model = resolveContentModel(opts.model)
  const now = opts.now ?? Date.now
  const started = now()
  const sleep = opts.sleep ?? defaultSleep
  const maxRetries = Math.max(0, opts.maxRetries ?? 2)
  const maxVerifyRegens = Math.max(0, opts.verifyRegenerations ?? 1)
  const baseDelay = opts.baseDelayMs ?? 1000
  const maxDelay = opts.maxDelayMs ?? 20_000
  const ceiling = opts.maxTokensCeiling ?? 32_000
  const concurrency = Math.min(2, Math.max(1, Math.floor(opts.concurrency ?? 1)))
  const userText = typeof opts.userText === "string" && opts.userText.trim() !== "" ? opts.userText : undefined
  const verifyExtra: Partial<VerifyContext> | undefined = userText ? { ...opts.verifyContext, userText } : opts.verifyContext
  const verifier: ChapterVerifier | null = opts.verify === false ? null : (opts.verify ?? defaultVerifier(verifyExtra))
  const allowFallback = opts.allowPromptFallback ?? true
  const logger: GenerateLogger = opts.logger ?? ((m, meta) => console.warn(m, meta))
  const expectsUserText = !!opts.product && USER_TEXT_PRODUCTS.includes(opts.product)

  const ids = new Set<string>()
  for (const c of chapters) {
    if (ids.has(c.id)) throw new Error(`장 id 중복: ${c.id}`)
    ids.add(c.id)
  }

  // 위기 사전 검사 — 걸리면 AI를 부르지 않는다(클라이언트도 만들지 않음). 이전 결과(previous)의 풀이도 돌려주지 않는다.
  if (userText && detectCrisis(userText)) {
    const message = crisisMessage(resolveVoice(facts), facts.subject.addressAs)
    // 원문·감지 구절은 로그에 남기지 않는다(상품·장 수만)
    logger("[content-gen] 위기 신호 감지 — 생성 중단, 상담 안내로 응답", { product: opts.product ?? null, chapters: chapters.length })
    return {
      version: GENERATOR_VERSION,
      model,
      chapters: chapters.map((c) => ({ id: c.id, ok: false, error: "crisis", attempts: 0 })),
      ok: false,
      failedIds: chapters.map((c) => c.id),
      totals: { ...ZERO, costUsdEstimate: 0, calls: 0 },
      elapsedMs: now() - started,
      stopped: "crisis",
      crisis: { precheck: "detected", message },
    }
  }
  const crisis: CrisisStatus = { precheck: userText ? "clear" : "not-run:no-userText" }
  const crisisNotRun: string[] = []

  const results: ChapterResult[] = new Array(chapters.length)
  const todo: number[] = []
  chapters.forEach((spec, i) => {
    const prev = opts.previous?.find((r) => r.id === spec.id)
    if (prev?.ok) results[i] = prev
    else todo.push(i)
  })

  const ctl = new RunControl(opts.signal, opts.timeBudgetMs ?? 240_000, opts.maxTotalCalls ?? todo.length * 4, now)
  let client: ContentClient | null = null
  const getClient = () => (client ??= opts.client ?? getDefaultClient())

  const runChapter = async (spec: ChapterSpec): Promise<ChapterResult> => {
    let attempts = 0
    let retries = 0
    let verifyRegens = 0
    let maxTokens = Math.max(1, Math.floor(spec.maxOutputTokens))
    let mode: "native" | "prompt" = opts.structuredOutput ?? "native"
    let switched = false
    let usage: TokenUsage = { ...ZERO }
    let feedback = ""
    let lastVerify: ChapterVerifyResult | undefined

    const finish = (r: Omit<ChapterResult, "id" | "attempts" | "usage">): ChapterResult => ({
      id: spec.id,
      attempts,
      ...r,
      ...(attempts > 0 ? { usage: { ...usage, model, costUsdEstimate: estimateCostUsd(model, usage) } } : {}),
    })

    let built: { system: string; user: string }
    try {
      built = spec.build(facts)
      if (typeof built?.system !== "string" || typeof built?.user !== "string") throw new Error("build 결과 형식 오류")
    } catch (e) {
      return finish({ ok: false, error: `build_error: ${String((e as Error)?.message ?? e).slice(0, 120)}` })
    }

    while (true) {
      const stop = ctl.stopReason()
      if (stop) return finish({ ok: false, error: stop, ...(lastVerify ? { verify: lastVerify } : {}) })
      if (!ctl.takeCall()) return finish({ ok: false, error: "call_limit_exceeded" })
      attempts++

      const streamed = opts.stream === true || ((opts.stream ?? "auto") === "auto" && maxTokens > 4096)
      const system: TextBlockParam[] = [{ type: "text", text: built.system, cache_control: { type: "ephemeral" } }]
      if (mode === "prompt") system.push({ type: "text", text: PROMPT_MODE_INSTRUCTION(spec.outputSchema) })
      const outputConfig: OutputConfig = {
        ...(mode === "native" ? { format: { type: "json_schema" as const, schema: spec.outputSchema } } : {}),
        ...(opts.effort ? { effort: opts.effort } : {}),
      }
      const body: MessageCreateParamsNonStreaming = {
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: built.user + feedback }],
        ...(Object.keys(outputConfig).length ? { output_config: outputConfig } : {}),
      }
      const reqOpts: ContentRequestOptions = { signal: ctl.ac.signal, timeout: Math.max(1000, ctl.remainingMs()), maxRetries: 0 }

      const t0 = now()
      const emit = (outcome: AttemptOutcome, stopReason: string | null, u: TokenUsage, error?: string) =>
        opts.onEvent?.({
          type: "attempt",
          chapterId: spec.id,
          attempt: attempts,
          model,
          maxTokens,
          structured: mode,
          streamed,
          outcome,
          stopReason,
          ...(error ? { error } : {}),
          usage: u,
          costUsdEstimate: estimateCostUsd(model, u),
          durationMs: now() - t0,
        })

      let msg: Message
      try {
        msg = streamed ? await getClient().messages.stream(body, reqOpts).finalMessage() : await getClient().messages.create(body, reqOpts)
      } catch (err) {
        const c = classifyError(err, ctl.ac.signal.aborted)
        emit(c.kind === "abort" ? "aborted" : c.kind === "schema_unsupported" ? "schema_unsupported" : "api_error", null, ZERO, c.code)
        if (c.kind === "abort") return finish({ ok: false, error: ctl.stopReason() ?? "aborted" })
        if (c.kind === "schema_unsupported" && mode === "native" && allowFallback && !switched) {
          mode = "prompt"
          switched = true
          continue
        }
        if (c.kind === "retryable" && retries < maxRetries) {
          retries++
          const delay = Math.min(maxDelay, Math.max(baseDelay * 2 ** (retries - 1), c.retryAfterMs ?? 0))
          if (delay >= ctl.remainingMs()) return finish({ ok: false, error: "time_budget_exceeded" })
          try {
            await sleep(delay, ctl.ac.signal)
          } catch {
            return finish({ ok: false, error: ctl.stopReason() ?? "aborted" })
          }
          continue
        }
        return finish({ ok: false, error: c.code })
      }

      const u = usageOf(msg)
      usage = addUsage(usage, u)
      const sr = msg.stop_reason ?? null

      if (sr === "refusal") {
        emit("refusal", sr, u, "refusal")
        return finish({ ok: false, error: "refusal" })
      }
      if (sr === "model_context_window_exceeded") {
        emit("context_window_exceeded", sr, u, sr)
        return finish({ ok: false, error: "context_window_exceeded" })
      }
      if (sr === "max_tokens") {
        emit("max_tokens", sr, u, "max_tokens")
        if (retries < maxRetries) {
          retries++
          maxTokens = Math.min(ceiling, Math.ceil(maxTokens * 1.5))
          continue
        }
        return finish({ ok: false, error: "max_tokens" })
      }
      if (sr !== "end_turn" && sr !== "stop_sequence" && sr !== null) {
        emit("unexpected_stop", sr, u, `unexpected_stop:${sr}`)
        if (retries < maxRetries) {
          retries++
          continue
        }
        return finish({ ok: false, error: `unexpected_stop:${sr}` })
      }

      const parsed = parseJsonOutput(textOf(msg))
      if (!parsed.ok) {
        emit("invalid_json", sr, u, "invalid_json")
        if (retries < maxRetries) {
          retries++
          continue
        }
        return finish({ ok: false, error: "invalid_json" })
      }
      const issues = validateJsonSchema(parsed.value, spec.outputSchema)
      if (issues.length) {
        const code = `schema_mismatch: ${issues.slice(0, 3).map((i) => `${i.path} ${i.message}`).join("; ")}`
        emit("schema_mismatch", sr, u, code)
        if (retries < maxRetries) {
          retries++
          continue
        }
        return finish({ ok: false, error: code })
      }

      if (!verifier) {
        emit("ok", sr, u)
        return finish({ ok: true, output: parsed.value })
      }
      let v: ChapterVerifyResult
      try {
        v = await verifier(parsed.value, { facts, spec })
        if (!v || typeof v.pass !== "boolean") throw new Error("검증기 결과 형식 오류")
      } catch (e) {
        // 검증을 못 하면 통과로 보지 않는다(fail-closed)
        emit("verify_error", sr, u, "verify_error")
        return finish({ ok: false, error: `verify_error: ${String((e as Error)?.message ?? e).slice(0, 120)}` })
      }
      lastVerify = { pass: v.pass, findings: v.findings ?? [], ...(v.coverage ? { coverage: v.coverage } : {}) }
      if (expectsUserText && v.coverage?.crisis === "not-run:no-userText" && !crisisNotRun.includes(spec.id)) crisisNotRun.push(spec.id)
      if (v.pass) {
        emit("ok", sr, u)
        return finish({ ok: true, output: parsed.value, verify: lastVerify })
      }
      emit("verify_block", sr, u, "verify_block")
      if (verifyRegens < maxVerifyRegens) {
        verifyRegens++
        if (opts.verifyFeedback ?? true) feedback = feedbackOf(lastVerify)
        continue
      }
      return finish({ ok: false, error: "verify_block", verify: lastVerify })
    }
  }

  try {
    const queue = [...todo]
    if (concurrency > 1 && (opts.warmCache ?? true) && queue.length > 1) {
      const first = queue.shift()!
      results[first] = await runChapter(chapters[first])
    }
    const worker = async () => {
      while (queue.length) {
        const i = queue.shift()!
        results[i] = await runChapter(chapters[i])
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, queue.length)) }, worker))
  } finally {
    ctl.dispose()
  }

  if (crisisNotRun.length)
    logger("[content-gen] 고민 입력 상품인데 위기 검사가 돌지 않음(coverage.crisis=not-run:no-userText) — 호출 쪽이 userText를 넘겨야 함", {
      product: opts.product,
      chapterIds: crisisNotRun,
    })

  let totals: TokenUsage = { ...ZERO }
  for (const r of results) {
    // 이번 실행에서 새로 만든 장만 합산(이전 결과에서 가져온 장은 제외)
    if (r?.usage && !opts.previous?.includes(r)) {
      totals = addUsage(totals, { inputTokens: r.usage.inputTokens, outputTokens: r.usage.outputTokens, cacheReadTokens: r.usage.cacheReadTokens, cacheWriteTokens: r.usage.cacheWriteTokens })
    }
  }
  const failedIds = results.filter((r) => !r.ok).map((r) => r.id)
  const stopped = ctl.reason ?? (ctl.callLimitHit ? "call_limit_exceeded" : undefined)
  return {
    version: GENERATOR_VERSION,
    model,
    chapters: results,
    ok: failedIds.length === 0,
    failedIds,
    totals: { ...totals, costUsdEstimate: estimateCostUsd(model, totals), calls: ctl.calls },
    elapsedMs: now() - started,
    ...(stopped ? { stopped } : {}),
    crisis,
  }
}

/** 실패한 장만 다시 생성(ok인 장은 previous 결과를 그대로 둔다) */
export function regenerateFailed(facts: FactSheet, chapters: ChapterSpec[], previous: ChapterResult[], opts: Omit<GenerateOptions, "previous"> = {}): Promise<GenerateRunResult> {
  return generateChapters(facts, chapters, { ...opts, previous })
}
