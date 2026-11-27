// 본 풀이 생성 v3 — 새 콘텐츠 엔진 파이프라인을 운영 풀이 레코드에 연결한다. 담당: 백엔드·서버 개발자
//
// 흐름(회사 원칙: 규칙 판단은 코드, AI는 서술만 — docs/ARCHITECTURE.md):
//   저장된 sajuInput(결제 때 엔진으로 계산·저장한 값) → computeChart(다시 계산, 저장된 원국과 대조)
//   → analyzeRules(대운 전체 + 올해 세운) → buildPersonalContext(설문 없음) → buildFactSheet(사실표)
//   → chaptersForProduct(상품, supported인 것만) → generateChapters(위기 사전 검사·장별 검증기 verifyReading 포함)
//
// 개인정보 최소화(백엔드 원칙 4): AI 요청에는 사실표만 간다. 사실표에는 이름·생년월일(월일)·출생 시각·출생지 이름/경도가 없다
//   (src/engine/content/facts.ts 불변식). 호칭은 sanitizeAddressAs를 거친 값만(기본 "손주") — 실명(Reading.name·sajuInput.name)은 넘기지 않는다.
//
// 이 파일은 DB·환경변수를 직접 읽지 않는다(스위치 판정·저장은 라우트 몫). AI 클라이언트는 주입 가능(테스트는 가짜).
// 기존 v2(src/lib/generate-reading-v2.ts)는 그대로 둔다 — 스위치(READING_ENGINE=v3 + DB_SCHEMA_V3=true)가 꺼져 있으면 v2가 돈다.
import { computeChart, EngineInputError, yearPillarOf, type CalendarResult, type RuleAnalysis } from "@/engine"
import { analyzeRules } from "@/engine"
import { buildPersonalContext, koreanDateOf } from "@/engine/personalize"
import { buildFactSheet, FACTS_VERSION } from "@/engine/content/facts"
import {
  generateChapters, type ContentClient, type GenerateLogger, type GenerateRunResult, type GenerationEvent,
} from "@/engine/content/generate"
import { chaptersForProduct, isProductCode, PROMPT_VERSION, type ProductCode } from "@/engine/content/prompts"
import type { ChapterResult, ChapterSpec, FactSheet } from "@/engine/content/types"

export const READING_V3_VERSION = "reading-v3@0.1.0"
/** fullReading JSON의 형식 표시. 화면·재시도는 이 값으로 v2(FullReading)와 구분한다 */
export const READING_V3_FORMAT = "reading-v3"

/** v3 한 번 실행(= 생성 잠금 1회)의 API 호출 상한. 장 수 × 4(재시도 2 + 검증 재생성 1 + 1)와 이 값 중 작은 쪽 */
export const V3_MAX_CALLS_PER_ATTEMPT = 40
/** 동시에 만드는 장 수(첫 장은 캐시를 만들려고 혼자 먼저) */
export const V3_CONCURRENCY = 2

const SEOUL = "Asia/Seoul"

// ─────────────────────────────────────────── 저장 형식

/** 장 하나의 검증 요약(본문 발췌·메시지는 저장하지 않는다) */
export interface StoredFinding {
  severity: string
  code: string
  rule?: string
  path?: string
}

export interface StoredChapterV3 {
  id: string
  /** 장 기본 제목(prompts 명세). AI가 쓴 제목은 output.title */
  title: string
  ok: boolean
  /** ok인 장만 있다(검증 block 장의 출력은 고객 노출 방지를 위해 저장하지 않는다) */
  output?: unknown
  /** 실패 코드(예: verify_block, time_budget_exceeded, crisis) */
  error?: string
  attempts: number
  verify?: { pass: boolean; findings: StoredFinding[] }
}

export interface StoredCostV3 {
  calls: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  costUsdEstimate: number
}

/** Reading.fullReading에 저장하는 v3 결과(스키마 변경 없음 — 기존 Json 열) */
export interface StoredReadingV3 {
  format: typeof READING_V3_FORMAT
  version: string
  product: ProductCode
  /** complete = 모든 장 통과 / partial = 일부 장 실패(상태 FAILED, 다시 시도하면 실패한 장만) / crisis = 위기 신호로 생성 안 함 */
  status: "complete" | "partial" | "crisis"
  generatedAt: string
  versions: { reading: string; generator: string; prompts: string; facts: string; engine: string }
  model: string
  /** 장 순서 = 화면 순서(products.ts PRODUCT_CHAPTERS) */
  chapters: StoredChapterV3[]
  failedIds: string[]
  /** status = crisis일 때 고객에게 보여 줄 상담 안내 문구 */
  crisis?: { message: string }
  /** AI가 본 사실표 그대로(개인정보 없음). 화면의 근거 표시·감사·재현에 쓴다 */
  facts: FactSheet
  /** 이 풀이에 쓴 누적 비용(다시 시도 포함). 개별 호출 기록은 AiUsage 표 */
  cost: StoredCostV3
}

export function isStoredReadingV3(raw: unknown): raw is StoredReadingV3 {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false
  const r = raw as Partial<StoredReadingV3>
  return r.format === READING_V3_FORMAT && Array.isArray(r.chapters) && !!r.facts && typeof r.facts === "object"
}

// ─────────────────────────────────────────── 준비(AI 없음, 잠금 전에 실행)

/** 저장된 풀이 레코드에서 v3가 쓰는 값 */
export interface ReadingV3Source {
  readingType: string
  /** Reading.gender "M" | "F" */
  gender: string
  /** Reading.sajuInput(결제·직접 생성 때 buildSajuInputFromRequest로 저장한 값) */
  sajuInput: unknown
}

export interface PreparedReadingV3 {
  product: ProductCode
  asOf: Date
  chart: CalendarResult
  rules: RuleAnalysis
  facts: FactSheet
  chapters: ChapterSpec[]
}

export type PrepareFailReason =
  | "unsupported_product"
  | "no_saju_input"
  | "bad_birth"
  | "bad_gender"
  | "engine_input_error"
  | "pillars_mismatch"

export type PrepareResult = { ok: true; value: PreparedReadingV3 } | { ok: false; reason: PrepareFailReason; detail?: string }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)

/** "YYYY-MM-DD" 또는 "YYYY-MM-DD HH:MM"(저장 형식: 양력 현지 법정시, 시진 선택이면 대표 시각) */
export function parseStoredBirth(birth: unknown): { year: number; month: number; day: number; time: { hour: number; minute: number } | null } | null {
  if (typeof birth !== "string") return null
  const m = birth.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/)
  if (!m) return null
  const time = m[4] !== undefined ? { hour: Number(m[4]), minute: Number(m[5]) } : null
  if (time && (time.hour > 23 || time.minute > 59)) return null
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]), time }
}

const ganzhi = (p: { stem: string; branch: string }) => `${p.stem}${p.branch}`

/**
 * 저장된 입력 → 사실표·장 목록. AI를 부르지 않는 순수 계산(현재 시각은 asOf로만).
 * 실패하면 이유 코드만 돌려준다(라우트는 v2로 생성한다 — 고객 결제 건이 멈추지 않게).
 * - 다시 계산한 원국이 저장된 원국(화면에 보이는 글자)과 다르면 pillars_mismatch(엔진 변경 등). 화면과 풀이 글자가 어긋나지 않게 막는다.
 */
export function prepareReadingV3(src: ReadingV3Source, opts: { asOf?: Date; addressAs?: string } = {}): PrepareResult {
  const asOf = opts.asOf ?? new Date()
  if (!isProductCode(src.readingType)) return { ok: false, reason: "unsupported_product", detail: String(src.readingType) }
  const product = src.readingType
  const chapters = chaptersForProduct(product)
  // FREE는 유료 풀이 레코드에 쓰지 않는다. supported=false(BULLY·CONFLICT 등)는 빈 배열
  if (product === "FREE" || chapters.length === 0) return { ok: false, reason: "unsupported_product", detail: product }

  if (!isObj(src.sajuInput)) return { ok: false, reason: "no_saju_input" }
  const si = src.sajuInput
  const birth = parseStoredBirth(si.birth)
  if (!birth) return { ok: false, reason: "bad_birth" }
  if (si.hour_unknown === true && birth.time) return { ok: false, reason: "bad_birth", detail: "hour_unknown인데 시각 있음" }
  if (si.hour_unknown !== true && !birth.time) return { ok: false, reason: "bad_birth", detail: "시각 없음" }
  const gender = src.gender === "M" || src.gender === "F" ? src.gender : si.gender === "남" ? "M" : si.gender === "여" ? "F" : null
  if (!gender) return { ok: false, reason: "bad_gender" }
  const bp = isObj(si.birthplace) ? si.birthplace : null
  const longitude = bp && typeof bp.longitude === "number" && Number.isFinite(bp.longitude) ? bp.longitude : undefined

  let chart: CalendarResult
  try {
    // 저장된 birth는 이미 양력(음력 입력이면 변환된 날짜)·대표 시각이므로 양력으로 다시 계산한다(엔진 기본 옵션 = 저장 때와 같음)
    chart = computeChart({
      calendar: "solar",
      year: birth.year,
      month: birth.month,
      day: birth.day,
      isLeapMonth: false,
      time: birth.time,
      timezone: SEOUL,
      ...(longitude !== undefined ? { longitude } : {}),
      gender,
    })
  } catch (e) {
    if (e instanceof EngineInputError) return { ok: false, reason: "engine_input_error" }
    throw e
  }

  const stored = isObj(si.pillars) ? si.pillars : {}
  const now = chart.pillars
  const same =
    stored.year === ganzhi(now.year) &&
    stored.month === ganzhi(now.month) &&
    stored.day === ganzhi(now.day) &&
    (now.hour ? stored.hour === ganzhi(now.hour) : stored.hour === undefined || stored.hour === null)
  if (!same) return { ok: false, reason: "pillars_mismatch" }

  // 저장 때의 경고(음력 변환·시진 선택·자시 경계 등)는 다시 계산하면 사라지므로 합친다. 날짜·시각은 buildFactSheet가 지운다(sanitizeWarning)
  const storedWarnings = Array.isArray(si.warnings) ? si.warnings.filter((w): w is string => typeof w === "string") : []
  const merged: CalendarResult = { ...chart, warnings: [...chart.warnings, ...storedWarnings].filter((w, i, a) => a.indexOf(w) === i) }

  const thisYear = koreanDateOf(asOf).year
  const rules = analyzeRules(merged, undefined, { luck: merged.luck.daeun.map((d) => d.pillar), year: yearPillarOf(thisYear) })
  // 설문 응답은 아직 저장하지 않는다(사용자 사실 없음). known_facts도 쓰지 않는다
  const personal = buildPersonalContext(merged, [], asOf, rules)
  const facts = buildFactSheet({ chart: merged, rules, personal, asOf, addressAs: opts.addressAs })
  return { ok: true, value: { product, asOf, chart: merged, rules, facts, chapters } }
}

// ─────────────────────────────────────────── 생성

export interface GenerateReadingV3Options {
  /** AI 클라이언트(테스트는 가짜). 없으면 콘텐츠 엔진 기본(new Anthropic({ maxRetries: 0 }), 키는 환경변수) */
  client?: ContentClient
  /** 모델 ID. 없으면 CONTENT_MODEL 환경변수 → 기본값(cost.ts) */
  model?: string
  /** 이전 실행의 fullReading(Json). v3 형식이고 같은 사실표면 통과한 장은 다시 만들지 않는다 */
  previous?: unknown
  /** 사용자 고민 글(현재 받는 API 없음 — CONCERN 상품용). 위기 사전 검사·검증에만 쓰고 AI·저장·로그에 싣지 않는다 */
  userText?: string
  /** 전체 시간 예산(ms). 라우트 제한 시간보다 짧게 */
  timeBudgetMs?: number
  signal?: AbortSignal
  /** 호출마다(모델·토큰·비용, 본문 없음) — 라우트가 AiUsage에 기록 */
  onEvent?: (e: GenerationEvent) => void
  logger?: GenerateLogger
  /** 테스트용 대기 함수 */
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>
  baseDelayMs?: number
}

export interface GenerateReadingV3Result {
  status: StoredReadingV3["status"]
  stored: StoredReadingV3
  /** 콘텐츠 엔진 실행 결과 원본(장별 검증 보고서 전체 포함) — 저장하지 않고 로그 요약에만 쓴다 */
  run: GenerateRunResult
}

/** 이전 저장본에서 다시 쓸 수 있는 통과 장(같은 상품·같은 사실표일 때만) */
export function reusableChapters(previous: unknown, prepared: PreparedReadingV3): ChapterResult[] | undefined {
  if (!isStoredReadingV3(previous)) return undefined
  if (previous.product !== prepared.product || previous.status === "crisis") return undefined
  // 사실표가 달라졌으면(해가 바뀜·엔진 판올림 등) 이전 장은 다른 사실로 쓴 글이므로 쓰지 않는다
  if (JSON.stringify(stripAsOf(previous.facts)) !== JSON.stringify(stripAsOf(prepared.facts))) return undefined
  const ids = new Set(prepared.chapters.map((c) => c.id))
  const out = previous.chapters
    .filter((c) => c && c.ok === true && c.output !== undefined && ids.has(c.id))
    .map((c): ChapterResult => ({ id: c.id, ok: true, output: c.output, attempts: c.attempts, ...(c.verify ? { verify: c.verify } : {}) }))
  return out.length ? out : undefined
}

function stripAsOf(f: FactSheet): Omit<FactSheet, "asOf"> {
  // asOf(초 단위 기준 시각)만 다르고 나머지가 같으면 같은 사실표로 본다
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { asOf: _asOf, ...rest } = f
  return rest
}

function compactFindings(findings: unknown[]): StoredFinding[] {
  return findings
    .filter((x): x is { severity?: unknown; code?: unknown; rule?: unknown; location?: { path?: unknown } } => !!x && typeof x === "object")
    .filter((x) => x.severity === "block" || x.severity === "warn")
    .slice(0, 30)
    .map((x) => ({
      severity: String(x.severity),
      code: String(x.code ?? ""),
      ...(typeof x.rule === "string" ? { rule: x.rule } : {}),
      ...(typeof x.location?.path === "string" ? { path: x.location.path } : {}),
    }))
}

const ZERO_COST: StoredCostV3 = { calls: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsdEstimate: 0 }

function addCost(a: StoredCostV3, b: StoredCostV3): StoredCostV3 {
  return {
    calls: a.calls + b.calls,
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    costUsdEstimate: Math.round((a.costUsdEstimate + b.costUsdEstimate) * 1e6) / 1e6,
  }
}

function previousCost(previous: unknown): StoredCostV3 {
  if (!isStoredReadingV3(previous) || !previous.cost) return ZERO_COST
  const c = previous.cost
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0)
  return {
    calls: n(c.calls), inputTokens: n(c.inputTokens), outputTokens: n(c.outputTokens),
    cacheReadTokens: n(c.cacheReadTokens), cacheWriteTokens: n(c.cacheWriteTokens), costUsdEstimate: n(c.costUsdEstimate),
  }
}

/**
 * 준비된 사실표로 장별 생성 → 저장 형식. 예외는 클라이언트 생성 실패 등 예상 밖 오류뿐(장 실패는 status=partial로 돌려준다).
 * - 위기 사전 감지(userText): AI 0회, status=crisis
 * - 검증기 block: 그 장만 피드백 붙여 1회 재생성, 그래도 block이면 실패(출력 저장 안 함) → status=partial
 */
export async function generateReadingV3(prepared: PreparedReadingV3, opts: GenerateReadingV3Options = {}): Promise<GenerateReadingV3Result> {
  const { facts, chapters, product } = prepared
  const previous = reusableChapters(opts.previous, prepared)
  const todo = chapters.filter((c) => !previous?.some((p) => p.id === c.id)).length

  const run = await generateChapters(facts, chapters, {
    ...(opts.client ? { client: opts.client } : {}),
    ...(opts.model ? { model: opts.model } : {}),
    concurrency: V3_CONCURRENCY,
    maxTotalCalls: Math.min(V3_MAX_CALLS_PER_ATTEMPT, Math.max(1, todo) * 4),
    ...(opts.timeBudgetMs !== undefined ? { timeBudgetMs: opts.timeBudgetMs } : {}),
    ...(opts.signal ? { signal: opts.signal } : {}),
    ...(opts.userText !== undefined ? { userText: opts.userText } : {}),
    product,
    ...(opts.logger ? { logger: opts.logger } : {}),
    ...(opts.onEvent ? { onEvent: opts.onEvent } : {}),
    ...(opts.sleep ? { sleep: opts.sleep } : {}),
    ...(opts.baseDelayMs !== undefined ? { baseDelayMs: opts.baseDelayMs } : {}),
    ...(previous ? { previous } : {}),
  })

  const titleOf = new Map(chapters.map((c) => [c.id, c.title]))
  const status: StoredReadingV3["status"] = run.crisis.precheck === "detected" ? "crisis" : run.ok ? "complete" : "partial"
  const thisRun: StoredCostV3 = {
    calls: run.totals.calls,
    inputTokens: run.totals.inputTokens,
    outputTokens: run.totals.outputTokens,
    cacheReadTokens: run.totals.cacheReadTokens,
    cacheWriteTokens: run.totals.cacheWriteTokens,
    costUsdEstimate: run.totals.costUsdEstimate,
  }

  const stored: StoredReadingV3 = {
    format: READING_V3_FORMAT,
    version: READING_V3_VERSION,
    product,
    status,
    generatedAt: new Date().toISOString(),
    versions: { reading: READING_V3_VERSION, generator: run.version, prompts: PROMPT_VERSION, facts: FACTS_VERSION, engine: facts.engineVersion },
    model: run.model,
    chapters: run.chapters.map((c) => ({
      id: c.id,
      title: titleOf.get(c.id) ?? c.id,
      ok: c.ok,
      // 위기 응답이면 이전 통과 장도 저장하지 않는다(generateChapters도 돌려주지 않음)
      ...(c.ok && status !== "crisis" && c.output !== undefined ? { output: c.output } : {}),
      ...(c.error ? { error: c.error } : {}),
      attempts: c.attempts,
      ...(c.verify ? { verify: { pass: c.verify.pass, findings: compactFindings(c.verify.findings ?? []) } } : {}),
    })),
    failedIds: status === "crisis" ? [] : run.failedIds,
    ...(status === "crisis" && run.crisis.message ? { crisis: { message: run.crisis.message } } : {}),
    facts,
    cost: addCost(previousCost(opts.previous), thisRun),
  }
  return { status, stored, run }
}

// ─────────────────────────────────────────── 비용 기록(AiUsage, DB_SCHEMA_V3 마이그레이션에서 만든 표)

/** AiUsage 기록에 필요한 Prisma 표면만(테스트는 가짜) */
export interface AiUsageWriter {
  aiUsage: { createMany(args: { data: AiUsageRow[] }): PromiseLike<unknown> }
}

export interface AiUsageRow {
  readingId: string
  chapterId: string
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  /** Decimal(12,6) — 문자열로 넘겨 부동소수 오차 없이 저장 */
  costUsd: string
}

/** 호출 1회 = 1행(실패한 호출도 0토큰으로 남겨 호출 횟수를 셀 수 있게 한다). 본문·개인정보는 없다 */
export function aiUsageRows(readingId: string, events: readonly GenerationEvent[]): AiUsageRow[] {
  return events.map((e) => ({
    readingId,
    chapterId: e.chapterId,
    model: e.model,
    inputTokens: e.usage.inputTokens,
    outputTokens: e.usage.outputTokens,
    cacheReadTokens: e.usage.cacheReadTokens,
    cacheWriteTokens: e.usage.cacheWriteTokens,
    costUsd: e.costUsdEstimate.toFixed(6),
  }))
}

export async function recordAiUsage(db: AiUsageWriter, readingId: string, events: readonly GenerationEvent[]): Promise<number> {
  if (!events.length) return 0
  const data = aiUsageRows(readingId, events)
  await db.aiUsage.createMany({ data })
  return data.length
}

/** 로그 한 줄용 요약(본문·개인정보 없음) */
export function summarizeV3Run(r: GenerateReadingV3Result): Record<string, unknown> {
  return {
    status: r.status,
    product: r.stored.product,
    model: r.run.model,
    calls: r.run.totals.calls,
    inputTokens: r.run.totals.inputTokens,
    outputTokens: r.run.totals.outputTokens,
    costUsdEstimate: r.run.totals.costUsdEstimate,
    failedIds: r.stored.failedIds,
    stopped: r.run.stopped ?? null,
    elapsedMs: r.run.elapsedMs,
  }
}
