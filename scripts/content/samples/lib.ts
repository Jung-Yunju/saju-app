// 견본 풀이 생성 본체 — 담당: 백엔드·서버 개발자. 실행 입구는 generate.ts(설명: README.md).
// 흐름(인물마다): computeChart → analyzeRules(대운·세운 포함) → buildPersonalContext → buildFactSheet
//                → chaptersForProduct("BASIC")(콘텐츠 작가 prompts/index.ts) → generateChapters(백엔드 파이프라인)
// 지키는 것:
//  - 키는 SAJU_ANTHROPIC_API_KEY에서만 읽는다(일반 이름 ANTHROPIC_API_KEY는 읽지 않음). 키 값은 출력·저장하지 않고,
//    혹시 오류 문구 등에 섞여 나와도 로그·파일에 쓰기 전에 가린다(redact).
//  - 비용 상한: 호출 직전에 "이번 호출의 최악 비용"(입력 근사×1.3을 가장 비싼 입력 단가로 + max_tokens 전부 출력)을 더해
//    상한(--budget-usd)을 넘으면 그 호출을 보내지 않고 전체를 멈춘다. 그래서 누적 추정 비용은 상한을 넘지 않는다.
//  - 호출마다 모델·토큰·비용·결과 코드를 기록한다(본문 없음). 본문·검증 결과는 인물별 JSON에 따로 담는다.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import Anthropic from "@anthropic-ai/sdk"
import type { MessageCreateParamsNonStreaming, MessageStreamParams, Message } from "@anthropic-ai/sdk/resources/messages/messages"
import { analyzeRules, computeChart, yearPillarOf } from "../../../src/engine"
import type { CalendarResult } from "../../../src/engine/types"
import type { RuleAnalysis } from "../../../src/engine/rules/types"
import { buildPersonalContext, koreanDateOf } from "../../../src/engine/personalize"
import { buildFactSheet } from "../../../src/engine/content/facts"
import {
  approxTokens, CONTENT_MODELS, estimateCostUsd, isContentModel, PRICING_USD_PER_MTOK, resolveContentModel,
  type ContentModel, type TokenUsage,
} from "../../../src/engine/content/cost"
import {
  generateChapters, GENERATOR_VERSION, verifyContextFromFacts, wrapChapterForVerify,
  type ChapterVerifier, type ContentClient, type ContentRequestOptions, type GenerateOptions, type GenerationEvent,
} from "../../../src/engine/content/generate"
import type { ChapterResult, ChapterSpec, FactSheet } from "../../../src/engine/content/types"
import { verifyReading } from "../../../src/engine/verify"
import { PERSONAS, selectPersonas, SURVEY_EXAMPLE_NOTE, type SamplePersona } from "./personas"
import { createFakeClient } from "./fake-client"
import { KRW_PER_USD, renderIndexHtml } from "./html"

export const SAMPLES_VERSION = "samples@0.1.0"
export const KEY_ENV = "SAJU_ANTHROPIC_API_KEY"
export const BASE_URL_ENV = "SAJU_ANTHROPIC_BASE_URL"
export const DEFAULT_BUDGET_USD = 5
export const COMPARE_MODEL: ContentModel = "claude-sonnet-5-5"
const PRODUCT = "BASIC"

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = resolve(HERE, "../../..")
export const PROMPTS_INDEX = resolve(REPO_ROOT, "src/engine/content/prompts/index.ts")

// ─────────────────────────────────────────── 인자

export interface CliOptions {
  model: ContentModel
  compare: boolean
  compareModel: ContentModel
  budgetUsd: number
  only?: string
  /** 출력 폴더(없으면 samples/<KST 날짜>[-fake]) */
  outDir?: string
  /** samples/ 아래 날짜 폴더 이름을 직접 지정(재시도용) */
  date?: string
  concurrency: number
  timeBudgetMin: number
  retryFailed: boolean
  fake: boolean
  help: boolean
}

export const USAGE = `견본 풀이 생성 (기본 풀이 8장, 가상 인물 10명)
실행: node scripts/content/samples/generate.mjs [옵션]
  --only 1[,3,...]     이 인물만(번호 1~10 또는 p01~p10)
  --budget-usd 5       누적 추정 비용 상한(달러, 기본 5). 넘기 직전에 멈춤
  --model ID           기본 claude-opus-5-5 (허용: ${CONTENT_MODELS.join(", ")})
  --compare            비교 대상 인물 2명(p05·p09)은 claude-sonnet-5-5로도 만든다
  --compare-model ID   비교 모델 바꾸기
  --concurrency 1|2    장 동시 생성 수(기본 2). 429(속도 제한)가 잦으면 1
  --time-budget-min 15 인물 1명·모델 1개당 시간 상한(분)
  --retry-failed       같은 폴더의 이전 결과에서 통과한 장은 두고 나머지만 다시
  --date YYYY-MM-DD    samples/<날짜> 폴더 지정(다른 날 이어서 재시도할 때)
  --out DIR            출력 폴더 직접 지정
  --fake               API 없이 가짜 응답으로 흐름만 연습(키 불필요, 비용 0, samples/<날짜>-fake)
  --help               이 안내`

export function parseArgs(argv: string[]): CliOptions {
  const o: CliOptions = {
    model: "claude-opus-5-5",
    compare: false,
    compareModel: COMPARE_MODEL,
    budgetUsd: DEFAULT_BUDGET_USD,
    concurrency: 2,
    timeBudgetMin: 15,
    retryFailed: false,
    fake: false,
    help: false,
  }
  const need = (i: number, k: string) => {
    const v = argv[i + 1]
    if (v === undefined || v.startsWith("--")) throw new Error(`${k} 뒤에 값이 필요함`)
    return v
  }
  const num = (v: string, k: string) => {
    const n = Number(v)
    if (!Number.isFinite(n) || n <= 0) throw new Error(`${k} 값은 0보다 큰 수여야 함`)
    return n
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    switch (a) {
      case "--":
        break
      case "--model":
        o.model = resolveContentModel(need(i, a), {})
        i++
        break
      case "--compare-model":
        o.compareModel = resolveContentModel(need(i, a), {})
        o.compare = true
        i++
        break
      case "--compare":
        o.compare = true
        break
      case "--budget-usd":
        o.budgetUsd = num(need(i, a), a)
        i++
        break
      case "--only":
        o.only = need(i, a)
        selectPersonas(o.only)
        i++
        break
      case "--out":
        o.outDir = need(i, a)
        i++
        break
      case "--date": {
        const v = need(i, a)
        if (!/^\d{4}-\d{2}-\d{2}(-fake)?$/.test(v)) throw new Error("--date는 YYYY-MM-DD 형식")
        o.date = v
        i++
        break
      }
      case "--concurrency": {
        const n = num(need(i, a), a)
        if (n !== 1 && n !== 2) throw new Error("--concurrency는 1 또는 2")
        o.concurrency = n
        i++
        break
      }
      case "--time-budget-min":
        o.timeBudgetMin = num(need(i, a), a)
        i++
        break
      case "--retry-failed":
        o.retryFailed = true
        break
      case "--fake":
        o.fake = true
        break
      case "--help":
      case "-h":
        o.help = true
        break
      default:
        throw new Error(`모르는 옵션: ${a} (--help 참고)`)
    }
  }
  if (o.compare && o.compareModel === o.model) o.compareModel = o.model === COMPARE_MODEL ? "claude-opus-5-5" : COMPARE_MODEL
  return o
}

// ─────────────────────────────────────────── 키 가리기

export function makeRedactor(secret: string | undefined): (s: string) => string {
  if (!secret || secret.length < 8) return (s) => s
  return (s) => s.split(secret).join("[가림]")
}

// ─────────────────────────────────────────── 비용 상한

export interface CallLog {
  seq: number
  model: string
  maxTokens: number
  worstCaseUsd: number
  usage?: TokenUsage
  costUsdEstimate: number
  /** "ok" | 오류 이름 | "budget_blocked" */
  result: string
}

type AnyBody = MessageCreateParamsNonStreaming | MessageStreamParams

function bodyText(body: AnyBody): string {
  const sys = Array.isArray(body.system) ? body.system.map((b) => ("text" in b ? b.text : "")).join("") : String(body.system ?? "")
  const msgs = body.messages.map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content))).join("")
  const fmt = body.output_config ? JSON.stringify(body.output_config) : ""
  return sys + msgs + fmt
}

/** 이번 호출의 최악 비용: 입력은 근사×1.3을 (입력·캐시쓰기 중 비싼) 단가로, 출력은 max_tokens 전부 */
export function worstCaseCostUsd(body: AnyBody): number {
  const model: ContentModel = isContentModel(body.model) ? body.model : "claude-opus-5-5"
  const p = PRICING_USD_PER_MTOK[model]
  const inTok = Math.ceil(approxTokens(bodyText(body)) * 1.3) + 64
  return (inTok * Math.max(p.input, p.cacheWrite) + body.max_tokens * p.output) / 1_000_000
}

function usageOfMessage(m: Message): TokenUsage {
  const u = m.usage
  return {
    inputTokens: u?.input_tokens ?? 0,
    outputTokens: u?.output_tokens ?? 0,
    cacheReadTokens: u?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: u?.cache_creation_input_tokens ?? 0,
  }
}

/**
 * 실행 전체(모든 인물·모델)에 걸친 비용 상한. wrap()한 클라이언트는 호출 직전에
 * spent + (진행 중 호출들의 최악 비용) + (이번 호출의 최악 비용) > 상한이면 보내지 않고 전체를 멈춘다.
 */
export class BudgetGuard {
  spentUsd = 0
  reservedUsd = 0
  exhausted = false
  readonly calls: CallLog[] = []
  private readonly ac = new AbortController()
  constructor(readonly budgetUsd: number) {}

  get signal(): AbortSignal {
    return this.ac.signal
  }

  private abortError(): Error {
    return Object.assign(new Error("budget_exceeded"), { name: "AbortError" })
  }

  private async run(body: AnyBody, send: () => Promise<Message>): Promise<Message> {
    const seq = this.calls.length + 1
    const worst = worstCaseCostUsd(body)
    const log: CallLog = { seq, model: body.model, maxTokens: body.max_tokens, worstCaseUsd: round6(worst), costUsdEstimate: 0, result: "pending" }
    this.calls.push(log)
    if (this.exhausted || this.spentUsd + this.reservedUsd + worst > this.budgetUsd) {
      log.result = "budget_blocked"
      this.exhausted = true
      this.ac.abort("budget_exceeded")
      throw this.abortError()
    }
    this.reservedUsd += worst
    try {
      const msg = await send()
      const usage = usageOfMessage(msg)
      const cost = estimateCostUsd(isContentModel(body.model) ? body.model : "claude-opus-5-5", usage)
      this.spentUsd = round6(this.spentUsd + cost)
      log.usage = usage
      log.costUsdEstimate = cost
      log.result = "ok"
      return msg
    } catch (e) {
      const err = e as { name?: string; status?: number }
      log.result = err?.status ? `${err.name ?? "error"}:${err.status}` : (err?.name ?? "error")
      throw e
    } finally {
      this.reservedUsd = Math.max(0, this.reservedUsd - worst)
    }
  }

  wrap(inner: ContentClient): ContentClient {
    return {
      messages: {
        create: (body: MessageCreateParamsNonStreaming, opts?: ContentRequestOptions) => this.run(body, async () => inner.messages.create(body, opts)),
        stream: (body: MessageStreamParams, opts?: ContentRequestOptions) => ({
          finalMessage: () => this.run(body, () => inner.messages.stream(body, opts).finalMessage()),
        }),
      },
    }
  }
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6

// ─────────────────────────────────────────── 기록 형식

export interface SampleDraft {
  attempt: number
  pass: boolean
  counts: Record<string, number>
  findings: unknown[]
  output: unknown
}

export interface SampleChapter {
  id: string
  title: string
  ok: boolean
  verdict: "pass" | "block" | "error" | "skipped"
  error?: string
  attempts: number
  usage?: ChapterResult["usage"]
  verify?: { pass: boolean; counts: Record<string, number>; findings: unknown[] }
  output?: unknown
  /** 검증기를 거친 초안 전부(차단된 초안 포함 — 검토용, 고객 비노출) */
  drafts: SampleDraft[]
}

export interface SampleRecord {
  kind: "saju-sample"
  fictional: true
  notice: string
  sampleVersion: string
  fake: boolean
  persona: {
    id: string
    n: number
    label: string
    why: string
    /** 지어낸 출생 입력(재현용). 화면에는 싣지 않는다 */
    birth: SamplePersona["birth"]
    answers?: SamplePersona["answers"]
    surveyNote?: string
    ageBand: string
    gender: "M" | "F"
    season: string
    flags: string[]
  }
  model: ContentModel
  product: string
  generatedAt: string
  asOf: string
  versions: { engine: string; rules: string; prompts?: string; generator: string }
  notes: string[]
  facts: FactSheet | null
  chapters: SampleChapter[]
  /** 호출 1회마다(본문 없음): 모델·토큰·비용·결과 코드 */
  events: GenerationEvent[]
  totals: TokenUsage & { costUsdEstimate: number; calls: number }
  /** --retry-failed로 이어 만든 경우 이전 실행분까지 합친 값 */
  cumulative: { costUsdEstimate: number; calls: number; runs: number }
  elapsedMs: number
  stopped?: string
}

// ─────────────────────────────────────────── 인물 → 사실표

const SEASON_OF_BRANCH: Record<string, string> = {
  寅: "봄", 卯: "봄", 辰: "봄", 巳: "여름", 午: "여름", 未: "여름", 申: "가을", 酉: "가을", 戌: "가을", 亥: "겨울", 子: "겨울", 丑: "겨울",
}

export function ageBandOf(age: number): string {
  const d = Math.floor(age / 10) * 10
  const r = age % 10
  return `${d}대 ${r <= 3 ? "초반" : r <= 6 ? "중반" : "후반"}`
}

export interface Prepared {
  chart: CalendarResult
  rules: RuleAnalysis
  facts: FactSheet
  season: string
  flags: string[]
  notes: string[]
}

export function preparePersona(p: SamplePersona, asOf: Date): Prepared {
  const chart = computeChart(p.birth)
  const thisYear = koreanDateOf(asOf).year
  const rules = analyzeRules(chart, undefined, { luck: chart.luck.daeun.map((d) => d.pillar), year: yearPillarOf(thisYear) })
  const personal = buildPersonalContext(chart, p.answers ?? [], asOf, rules)
  const facts = buildFactSheet({ chart, rules, personal, asOf, addressAs: p.addressAs })
  const notes: string[] = []
  // 버전 문자열 대신 신강약·용신 결과가 실제로 있는지 본다(rules@0.3.0부터 제공, 0.4.0 등 이후 버전도 그대로 통과).
  const raw = rules as unknown as { strength?: unknown; usefulGods?: { views?: unknown } }
  if (!raw.strength || typeof raw.strength !== "object") notes.push(`규칙 엔진 결과에 신강약(strength)이 없음(${rules.engineVersion})`)
  if (!raw.usefulGods || !Array.isArray(raw.usefulGods.views)) notes.push(`규칙 엔진 결과에 용신 관점(usefulGods.views)이 없음(${rules.engineVersion})`)
  if (!facts.chart.strength) notes.push("사실표에 신강약이 없음(규칙 엔진 결과 모양 확인 필요)")
  if (!facts.chart.usefulGod?.length) notes.push("사실표에 용신 관점이 없음")
  if (personal.rejectedAnswers.length) notes.push(`설문 예시 응답 중 ${personal.rejectedAnswers.length}건이 검증에 걸려 빠짐: ${personal.rejectedAnswers.map((x) => `${x.questionId}/${x.code}`).join(", ")}`)
  const strength = (rules as unknown as { strength?: { primary?: string; models?: { model: string; extreme: string | null }[] } }).strength
  const primary = strength?.models?.find((m) => m.model === strength.primary)
  const flags: string[] = []
  if (p.birth.calendar === "lunar") flags.push(p.birth.isLeapMonth ? "음력 윤달 입력" : "음력 입력")
  if (chart.corrections.dstApplied) flags.push("서머타임 시기 출생")
  if (!chart.hourKnown) flags.push("태어난 시각 모름")
  if (chart.warnings.some((w) => w.includes("立春"))) flags.push("입춘 경계(연주·월주)")
  if (primary?.extreme === "strong") flags.push("극신강")
  if (primary?.extreme === "weak") flags.push("극신약")
  if (p.answers?.length) flags.push("설문 예시 응답 있음")
  return { chart, rules, facts, season: SEASON_OF_BRANCH[chart.pillars.month.branch] ?? "?", flags, notes }
}

// ─────────────────────────────────────────── 장 명세(콘텐츠 작가 prompts)

export interface LoadedChapters {
  chapters: ChapterSpec[]
  promptVersion?: string
}

/** prompts/index.ts의 chaptersForProduct("BASIC"). 파일·함수가 없거나 빈 목록이면 null + 이유 */
export async function loadBasicChapters(indexPath = PROMPTS_INDEX): Promise<LoadedChapters | { error: string }> {
  if (!existsSync(indexPath)) return { error: `장 명세 파일이 없음: src/engine/content/prompts/index.ts (콘텐츠 작가 작업 대기)` }
  let mod: Record<string, unknown>
  try {
    mod = (await import(indexPath)) as Record<string, unknown>
  } catch (e) {
    return { error: `장 명세를 불러오다 오류: ${String((e as Error)?.message ?? e).slice(0, 200)}` }
  }
  const fn = mod.chaptersForProduct
  if (typeof fn !== "function") return { error: "prompts/index.ts에 chaptersForProduct 함수가 없음" }
  let list: ChapterSpec[]
  try {
    list = (fn as (p: string) => ChapterSpec[])(PRODUCT)
  } catch (e) {
    return { error: `chaptersForProduct("${PRODUCT}") 오류: ${String((e as Error)?.message ?? e).slice(0, 200)}` }
  }
  if (!Array.isArray(list) || !list.length) return { error: `chaptersForProduct("${PRODUCT}")가 빈 목록` }
  return { chapters: list, promptVersion: typeof mod.PROMPT_VERSION === "string" ? mod.PROMPT_VERSION : undefined }
}

// ─────────────────────────────────────────── 인물 1명 × 모델 1개

export interface RunOneInput {
  persona: SamplePersona
  prepared: Prepared
  model: ContentModel
  chapters: ChapterSpec[]
  client: ContentClient
  guard: BudgetGuard
  asOf: Date
  promptVersion?: string
  fake: boolean
  concurrency: number
  timeBudgetMs: number
  previous?: SampleRecord
  log: (s: string) => void
  /** 테스트용 generateChapters 옵션 덮어쓰기 */
  generateOptions?: Partial<GenerateOptions>
  now: () => number
}

const countSev = (findings: unknown[]): Record<string, number> => {
  const c: Record<string, number> = { block: 0, warn: 0, info: 0 }
  for (const f of findings) {
    const s = (f as { severity?: string })?.severity
    if (s) c[s] = (c[s] ?? 0) + 1
  }
  return c
}

export async function runOne(x: RunOneInput): Promise<SampleRecord> {
  const { persona, prepared, model, chapters, guard, log } = x
  const drafts = new Map<string, SampleDraft[]>()
  for (const c of x.previous?.chapters ?? []) if (c.ok) drafts.set(c.id, c.drafts)

  // 기본 검증기와 같은 검사 + 원국·규칙 결과를 함께 넘기고, 시도마다 초안·판정을 남긴다
  const verify: ChapterVerifier = (output, { facts, spec }) => {
    const rep = verifyReading(wrapChapterForVerify(output, spec), verifyContextFromFacts(facts, { chart: prepared.chart, rules: prepared.rules }))
    const list = drafts.get(spec.id) ?? []
    list.push({ attempt: list.length + 1, pass: rep.pass, counts: { ...rep.counts }, findings: rep.findings, output })
    drafts.set(spec.id, list)
    return { pass: rep.pass, findings: rep.findings }
  }

  const events: GenerationEvent[] = []
  const tag = `[${persona.id} ${model}]`
  const onEvent = (e: GenerationEvent) => {
    events.push(e)
    const u = e.usage
    log(
      `${tag} ${e.chapterId} #${e.attempt} ${e.outcome}${e.error && e.outcome !== "ok" ? `(${e.error})` : ""} · 입력 ${u.inputTokens}+캐시읽기 ${u.cacheReadTokens}+캐시쓰기 ${u.cacheWriteTokens} · 출력 ${u.outputTokens} · ${fmtUsd(e.costUsdEstimate)} · ${(e.durationMs / 1000).toFixed(1)}초 · 누적 ${fmtUsd(guard.spentUsd)}/${fmtUsd(guard.budgetUsd)}`,
    )
  }

  const previous: ChapterResult[] | undefined = x.previous?.chapters
    .filter((c) => c.ok)
    .map((c) => ({ id: c.id, ok: true, output: c.output, attempts: c.attempts, ...(c.usage ? { usage: c.usage } : {}), ...(c.verify ? { verify: { pass: c.verify.pass, findings: c.verify.findings } } : {}) }))

  const started = x.now()
  const run = await generateChapters(prepared.facts, chapters, {
    client: guard.wrap(x.client),
    model,
    concurrency: x.concurrency,
    timeBudgetMs: x.timeBudgetMs,
    signal: guard.signal,
    verify,
    onEvent,
    ...(previous?.length ? { previous } : {}),
    ...x.generateOptions,
  })

  const byId = new Map(chapters.map((c) => [c.id, c]))
  const out: SampleChapter[] = run.chapters.map((r) => {
    const v = r.verify ? { pass: r.verify.pass, counts: countSev(r.verify.findings), findings: r.verify.findings } : undefined
    const prev = x.previous?.chapters.find((c) => c.id === r.id && c.ok)
    const budgetStop = !r.ok && r.error === "aborted" && guard.exhausted
    const verdict: SampleChapter["verdict"] = r.ok ? "pass" : r.error === "verify_block" ? "block" : budgetStop || r.attempts === 0 ? "skipped" : "error"
    return {
      id: r.id,
      title: byId.get(r.id)?.title ?? r.id,
      ok: r.ok,
      verdict,
      ...(r.error ? { error: budgetStop ? "budget_exceeded(비용 상한 도달로 호출 안 함)" : r.error } : {}),
      attempts: r.attempts,
      ...(r.usage ? { usage: r.usage } : {}),
      ...(v ? { verify: v } : prev?.verify ? { verify: prev.verify } : {}),
      ...(r.ok ? { output: r.output } : {}),
      drafts: drafts.get(r.id) ?? [],
    }
  })

  const prevCum = x.previous?.cumulative ?? { costUsdEstimate: 0, calls: 0, runs: 0 }
  const stopped = guard.exhausted ? "budget_exceeded" : run.stopped
  return {
    kind: "saju-sample",
    fictional: true,
    notice: "가상 인물 — 실존 아님. 설문 답은 예시로 지어낸 값",
    sampleVersion: SAMPLES_VERSION,
    fake: x.fake,
    persona: {
      id: persona.id,
      n: persona.n,
      label: persona.label,
      why: persona.why,
      birth: persona.birth,
      ...(persona.answers ? { answers: persona.answers, surveyNote: SURVEY_EXAMPLE_NOTE } : {}),
      ageBand: ageBandOf(prepared.facts.subject.ageYears),
      gender: prepared.facts.subject.gender,
      season: prepared.season,
      flags: prepared.flags,
    },
    model,
    product: PRODUCT,
    generatedAt: new Date(x.now()).toISOString(),
    asOf: x.asOf.toISOString(),
    versions: { engine: prepared.facts.engineVersion, rules: prepared.rules.engineVersion, ...(x.promptVersion ? { prompts: x.promptVersion } : {}), generator: GENERATOR_VERSION },
    notes: prepared.notes,
    facts: prepared.facts,
    chapters: out,
    events: [...(x.previous?.events ?? []), ...events],
    totals: run.totals,
    cumulative: { costUsdEstimate: round6(prevCum.costUsdEstimate + run.totals.costUsdEstimate), calls: prevCum.calls + run.totals.calls, runs: prevCum.runs + 1 },
    elapsedMs: x.now() - started,
    ...(stopped ? { stopped } : {}),
  }
}

// ─────────────────────────────────────────── 전체 실행

export interface RunDeps {
  env?: Record<string, string | undefined>
  /** 실제 클라이언트 만들기(테스트는 가짜). 키는 여기로만 넘긴다 */
  makeClient?: (apiKey: string) => ContentClient
  loadChapters?: () => Promise<LoadedChapters | { error: string }>
  log?: (s: string) => void
  now?: () => number
  /** 출력 폴더의 부모(기본 <저장소>/samples) */
  samplesRoot?: string
  generateOptions?: Partial<GenerateOptions>
}

export interface RunSummaryRow {
  persona: string
  model: string
  pass: number
  block: number
  failed: number
  inputTokens: number
  outputTokens: number
  costUsd: number
  seconds: number
  stopped?: string
}

export interface RunResult {
  exitCode: number
  outDir?: string
  rows: RunSummaryRow[]
  skipped: string[]
  totalCostUsd: number
  elapsedMs: number
  calls: CallLog[]
}

export function defaultMakeClient(env: Record<string, string | undefined>) {
  return (apiKey: string): ContentClient =>
    // baseURL을 직접 정한다: 이 환경에는 Claude Code가 쓰는 ANTHROPIC_BASE_URL이 잡혀 있어 그대로 두면 엉뚱한 곳으로 간다.
    // SDK 자체 재시도는 끈다(generateChapters가 장 단위로 재시도).
    new Anthropic({ apiKey, baseURL: env[BASE_URL_ENV]?.trim() || "https://api.anthropic.com", maxRetries: 0 })
}

export const NO_KEY_MESSAGE = `${KEY_ENV} 환경 변수가 없습니다 — API를 부르지 않고 끝냅니다.
  1) 대표가 클라우드 환경 설정에 ${KEY_ENV}를 넣은 뒤, "새 세션"에서 실행해야 합니다(이미 열린 세션에는 반영되지 않음).
  2) 확인(값은 보이지 않음): node -e "console.log(process.env.${KEY_ENV} ? '있음' : '없음')"
  3) 일반 이름 ANTHROPIC_API_KEY는 일부러 읽지 않습니다(Claude Code 자체 인증과 충돌 방지).
  4) API 없이 흐름만 보려면: node scripts/content/samples/generate.mjs --fake --only 1`

function kstDate(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms))
}

const fmtUsd = (n: number) => `$${n.toFixed(4)}`

export function fileNameOf(personaId: string, model: string, primary: ContentModel): string {
  return model === primary ? `${personaId}.json` : `${personaId}.${model}.json`
}

/** 폴더 안 견본 기록(kind=saju-sample)을 모두 읽는다 — 인물 번호 → 모델 순 */
export function readRecords(dir: string): SampleRecord[] {
  if (!existsSync(dir)) return []
  const out: SampleRecord[] = []
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json")) continue
    try {
      const r = JSON.parse(readFileSync(join(dir, f), "utf8")) as SampleRecord
      if (r?.kind === "saju-sample") out.push(r)
    } catch {
      /* 다른 파일은 무시 */
    }
  }
  const mi = (m: string) => (CONTENT_MODELS as readonly string[]).indexOf(m)
  return out.sort((a, b) => a.persona.n - b.persona.n || mi(a.model) - mi(b.model))
}

export function formatSummary(rows: RunSummaryRow[], skipped: string[], totalCostUsd: number, elapsedMs: number): string {
  const head = ["인물", "모델", "통과", "차단", "실패", "입력토큰", "출력토큰", "비용", "시간"]
  const body = rows.map((r) => [
    r.persona, r.model, String(r.pass), String(r.block), String(r.failed), String(r.inputTokens), String(r.outputTokens),
    fmtUsd(r.costUsd), `${r.seconds.toFixed(0)}초${r.stopped ? ` (${r.stopped})` : ""}`,
  ])
  const w = head.map((h, i) => Math.max(h.length * 2, ...body.map((b) => b[i].length)))
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(w[i])).join("  ")
  const inTok = rows.reduce((n, r) => n + r.inputTokens, 0)
  const outTok = rows.reduce((n, r) => n + r.outputTokens, 0)
  return [
    "=== 요약 ===",
    line(head),
    ...body.map(line),
    `합계: 입력 ${inTok.toLocaleString("en-US")} · 출력 ${outTok.toLocaleString("en-US")} 토큰 · 추정 ${fmtUsd(totalCostUsd)} (≈${Math.round(totalCostUsd * KRW_PER_USD).toLocaleString("ko-KR")}원, 1달러=${KRW_PER_USD}원 가정) · 소요 ${(elapsedMs / 1000).toFixed(0)}초`,
    ...(skipped.length ? [`비용 상한으로 건너뜀: ${skipped.join(", ")}`] : []),
  ].join("\n")
}

export async function runSamples(o: CliOptions, deps: RunDeps = {}): Promise<RunResult> {
  const env = deps.env ?? process.env
  const now = deps.now ?? Date.now
  const key = o.fake ? undefined : env[KEY_ENV]?.trim() || undefined
  const redact = makeRedactor(key)
  const log = (s: string) => (deps.log ?? console.log)(redact(s))
  const t0 = now()
  const empty = (exitCode: number): RunResult => ({ exitCode, rows: [], skipped: [], totalCostUsd: 0, elapsedMs: now() - t0, calls: [] })

  if (o.help) {
    log(USAGE)
    return empty(0)
  }
  if (!o.fake && !key) {
    log(NO_KEY_MESSAGE)
    return empty(2)
  }

  const loaded = await (deps.loadChapters ?? (() => loadBasicChapters()))()
  if ("error" in loaded) {
    log(`장 명세를 쓸 수 없어 끝냅니다 — ${loaded.error}`)
    log("콘텐츠 작가의 src/engine/content/prompts/index.ts(chaptersForProduct)가 준비된 뒤 다시 실행하세요. API는 부르지 않았습니다.")
    return empty(3)
  }

  const personas = selectPersonas(o.only)
  const asOf = new Date(now())
  const folder = o.date ?? `${kstDate(now())}${o.fake ? "-fake" : ""}`
  const outDir = resolve(o.outDir ?? join(deps.samplesRoot ?? join(REPO_ROOT, "samples"), folder))
  mkdirSync(outDir, { recursive: true })

  const client = o.fake ? createFakeClient() : (deps.makeClient ?? defaultMakeClient(env))(key as string)
  const guard = new BudgetGuard(o.budgetUsd)
  log(
    `견본 생성 시작 — 인물 ${personas.length}명 · 장 ${loaded.chapters.length}개(${PRODUCT}) · 모델 ${o.model}${o.compare ? ` (+비교 ${o.compareModel})` : ""} · 비용 상한 ${fmtUsd(o.budgetUsd)}${o.fake ? " · 가짜 응답(연습)" : ""}`,
  )
  log(`출력: ${outDir}`)

  const rows: RunSummaryRow[] = []
  const skipped: string[] = []
  const write = (file: string, data: string) => writeFileSync(join(outDir, file), redact(data))

  for (const p of personas) {
    const models: ContentModel[] = [o.model, ...(o.compare && p.compare ? [o.compareModel] : [])]
    let prepared: Prepared
    try {
      prepared = preparePersona(p, asOf)
    } catch (e) {
      log(`[${p.id}] 엔진 계산 실패 — ${String((e as Error)?.message ?? e).slice(0, 200)} (이 인물은 건너뜀)`)
      rows.push({ persona: p.id, model: "-", pass: 0, block: 0, failed: loaded.chapters.length, inputTokens: 0, outputTokens: 0, costUsd: 0, seconds: 0, stopped: "engine_error" })
      continue
    }
    for (const model of models) {
      const name = fileNameOf(p.id, model, o.model)
      if (guard.exhausted) {
        skipped.push(`${p.id}/${model}`)
        continue
      }
      let previous: SampleRecord | undefined
      if (o.retryFailed && existsSync(join(outDir, name))) {
        try {
          const r = JSON.parse(readFileSync(join(outDir, name), "utf8")) as SampleRecord
          if (r.kind === "saju-sample" && r.model === model) previous = r
        } catch {
          /* 깨진 파일이면 처음부터 */
        }
        if (previous && previous.chapters.every((c) => c.ok)) {
          log(`[${p.id} ${model}] 이전 결과가 모두 통과 — 건너뜀`)
          continue
        }
      }
      log(`[${p.id} ${model}] ${p.label} — 원국 ${prepared.facts.chart.pillars.year} ${prepared.facts.chart.pillars.month} ${prepared.facts.chart.pillars.day} ${prepared.facts.chart.pillars.hour ?? "(시 모름)"}${previous ? " · 실패한 장만 다시" : ""}`)
      const rec = await runOne({
        persona: p,
        prepared,
        model,
        chapters: loaded.chapters,
        client,
        guard,
        asOf,
        promptVersion: loaded.promptVersion,
        fake: o.fake,
        concurrency: o.concurrency,
        timeBudgetMs: Math.round(o.timeBudgetMin * 60_000),
        previous,
        log,
        generateOptions: deps.generateOptions,
        now,
      })
      write(name, JSON.stringify(rec, null, 2))
      const cnt = (v: SampleChapter["verdict"]) => rec.chapters.filter((c) => c.verdict === v).length
      rows.push({
        persona: p.id,
        model,
        pass: cnt("pass"),
        block: cnt("block"),
        failed: cnt("error") + cnt("skipped"),
        inputTokens: rec.totals.inputTokens + rec.totals.cacheReadTokens + rec.totals.cacheWriteTokens,
        outputTokens: rec.totals.outputTokens,
        costUsd: rec.totals.costUsdEstimate,
        seconds: rec.elapsedMs / 1000,
        ...(rec.stopped ? { stopped: rec.stopped } : {}),
      })
      log(`[${p.id} ${model}] 끝 — 통과 ${cnt("pass")} · 차단 ${cnt("block")} · 실패/건너뜀 ${cnt("error") + cnt("skipped")} · ${fmtUsd(rec.totals.costUsdEstimate)}${rec.stopped ? ` · 중단(${rec.stopped})` : ""}`)
    }
  }

  const records = readRecords(outDir)
  write("index.html", renderIndexHtml(records, { generatedAt: new Date(now()).toISOString(), folderLabel: folder }))
  const elapsedMs = now() - t0
  const summary = formatSummary(rows, skipped, guard.spentUsd, elapsedMs)
  log(summary)
  write(`summary-${new Date(now()).toISOString().replace(/[:.]/g, "-")}.txt`, summary + "\n")
  log(`화면: ${join(outDir, "index.html")}`)
  if (guard.exhausted) log(`비용 상한(${fmtUsd(o.budgetUsd)})에 닿아 멈췄습니다. 이어서 하려면: --retry-failed --budget-usd <추가 금액>${o.date ? "" : ` --date ${folder}`}`)
  return { exitCode: guard.exhausted ? 4 : 0, outDir, rows, skipped, totalCostUsd: guard.spentUsd, elapsedMs, calls: guard.calls }
}

/** CLI 입구(generate.ts) */
export async function main(argv: string[], deps: RunDeps = {}): Promise<number> {
  let o: CliOptions
  try {
    o = parseArgs(argv)
  } catch (e) {
    ;(deps.log ?? console.error)(`인자 오류: ${(e as Error).message}\n\n${USAGE}`)
    return 1
  }
  try {
    return (await runSamples(o, deps)).exitCode
  } catch (e) {
    const redact = makeRedactor(o.fake ? undefined : (deps.env ?? process.env)[KEY_ENV]?.trim())
    ;(deps.log ?? console.error)(redact(`실행 오류: ${String((e as Error)?.stack ?? e).slice(0, 800)}`))
    return 1
  }
}

export { PERSONAS }
