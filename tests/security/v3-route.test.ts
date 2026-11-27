// v3 연결 독립 검증 — 운영 생성 API(/api/reading/[id]/generate)의 엔진 스위치·개인정보·규칙 판단·재시도·결제 안전 (qa-security-lead)
//
// 백엔드 자체 테스트(src/lib/__tests__)는 generateReadingV3에 가짜 클라이언트를 "주입"한다. 여기서는 라우트를 그대로 부르고
// @anthropic-ai/sdk 자체를 가짜로 바꿔(라우트는 클라이언트를 주입하지 않으므로 콘텐츠 엔진 기본 클라이언트가 이 가짜가 된다)
// 실제 운영 경로에서 나가는 요청 본문을 가로챈다. DB는 메모리 DB(_fakedb-v3), 로그인은 @/lib/auth mock.
// 인물 값은 테스트용으로 지어낸 것이다(실제 고객 아님).
// 한계: 실제 PostgreSQL 행 잠금·트랜잭션 격리, 실제 Anthropic 응답(품질·지연·토큰), 270초 시간 초과 경로는 재현하지 않는다(미검증).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import type { Message, MessageCreateParamsNonStreaming, MessageStreamParams } from "@anthropic-ai/sdk/resources/messages/messages"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { createFakeDbV3, type FakeDbV3 } from "./_fakedb-v3"
import { fakeValue } from "../../scripts/content/samples/fake-client"

type Body = MessageCreateParamsNonStreaming | MessageStreamParams
type Call = { model: string; method: string; args: unknown }

const h = vi.hoisted(() => ({
  db: null as unknown as FakeDbV3,
  calls: [] as { model: string; method: string; args: unknown }[],
  aiUsage: [] as unknown[],
  aiUsageFail: false,
  session: null as null | { user: { id?: string; email?: string | null; name?: string | null } },
  v2: { generateFullReading: vi.fn(), generateClaims: vi.fn() },
  anthropic: { handler: null as null | ((body: unknown, opts: unknown) => Promise<unknown>), ctorArgs: [] as unknown[] },
  v3Throw: null as null | { events: number },
}))

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return h.db.client
  },
}))
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => h.session) }))
vi.mock("@/lib/generate-reading-v2", () => h.v2)
// SDK 자체를 가짜로: 운영 경로가 만드는 new Anthropic(...)이 이 클래스가 된다
vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const orig = (await importOriginal()) as Record<string, unknown>
  class FakeAnthropic {
    constructor(args: unknown) {
      h.anthropic.ctorArgs.push(args)
    }
    messages = {
      create: (b: unknown, o: unknown) => h.anthropic.handler!(b, o),
      stream: (b: unknown, o: unknown) => ({ finalMessage: () => h.anthropic.handler!(b, o) }),
    }
  }
  return { ...orig, default: FakeAnthropic, Anthropic: FakeAnthropic }
})
// 예외 경로(엔진이 몇 번 호출한 뒤 예상 밖 오류) 재현용 — 평소에는 원래 함수 그대로
vi.mock("@/lib/generate-reading-v3", async (importOriginal) => {
  const orig = (await importOriginal()) as typeof import("@/lib/generate-reading-v3")
  return {
    ...orig,
    generateReadingV3: async (...a: Parameters<typeof orig.generateReadingV3>) => {
      if (h.v3Throw) {
        const onEvent = a[1]?.onEvent
        for (let i = 0; i < h.v3Throw.events; i++) {
          onEvent?.({
            type: "attempt", chapterId: `ch${i}`, attempt: 1, model: "claude-opus-5-5" as never, maxTokens: 100,
            structured: "native", streamed: false, outcome: "api_error", stopReason: null, error: "api_error:500",
            usage: { inputTokens: 10, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, costUsdEstimate: 0.0001, durationMs: 1,
          } as never)
        }
        throw new Error("예상 밖 오류(테스트)")
      }
      return orig.generateReadingV3(...a)
    },
  }
})

import { POST as generatePOST } from "@/app/api/reading/[id]/generate/route"
import { resolveReadingEngine } from "@/app/api/reading/_lib/engine-switch"
import { buildSajuInputFromRequest } from "@/lib/saju-input"
import { analyzeRules, computeChart, yearPillarOf } from "@/engine"
import { koreanDateOf } from "@/engine/personalize"
import { chaptersForProduct } from "@/engine/content/prompts"
import { generateReadingV3, prepareReadingV3, isStoredReadingV3 } from "@/lib/generate-reading-v3"
import ReadingViewer from "@/app/reading/[id]/ReadingViewer"

// ─────────────────────────────────────────── 테스트 인물(지어낸 값)
const NAME = "도해솔"
const EMAIL = "haesol.do.qa@example.com"
const PLACE = { name: "강릉시", longitude: 128.8761 }
// 서머타임 시기(1987) — 저장 birth는 법정시
const PERSON = { year: 1987, month: 8, day: 23, hour: 21, birthMinute: 48, timeMode: "exact", gender: "M", calType: "SOLAR", birthplace: PLACE } as const
const PERSON_TEXT = [
  NAME, "해솔", EMAIL, "haesol",
  "1987-08-23", "1987.08.23", "1987/08/23", "1987. 8. 23", "19870823", "870823", "1987년 8월 23일", "8월 23일", "08-23", "08.23", "8/23",
  "21:48", "21시 48분", "9시 48분", "오후 9시", "2148",
  PLACE.name, "강릉", "128.87", "128.88", "128.9", "Gangneung",
]

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const post = (body?: unknown) =>
  new NextRequest("http://localhost/api", {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  })

// ─────────────────────────────────────────── 가짜 AI
const bodies: Body[] = []
const userOf = (b: Body) => b.messages.map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content))).join("\n")
const chapterIdOf = (b: Body) => userOf(b).match(/^이번에 쓸 장: 「[^」]*」 \(([^)]+)\)/)?.[1] ?? "?"
const GANZHI = /([甲乙丙丁戊己庚辛壬癸])([子丑寅卯辰巳午未申酉戌亥])/
const msg = (text: string): Message =>
  ({
    id: "msg_qa", type: "message", role: "assistant", model: "claude-opus-5-5",
    content: [{ type: "text", text, citations: null }], stop_reason: "end_turn", stop_sequence: null,
    usage: { input_tokens: 800, output_tokens: 400, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  }) as unknown as Message

let tamper: ((chapterId: string, v: Record<string, unknown>) => void) | null = null
let aiDelayMs = 0
let aiFail: null | (() => Error) = null
function installAi() {
  h.anthropic.handler = async (raw) => {
    const body = raw as Body
    bodies.push(JSON.parse(JSON.stringify(body)))
    if (aiDelayMs) await new Promise((r) => setTimeout(r, aiDelayMs))
    if (aiFail) throw aiFail()
    const user = userOf(body)
    const m = user.match(GANZHI)
    const schema = (body.output_config as { format?: { schema?: unknown } } | undefined)?.format?.schema ?? { type: "object" }
    const v = fakeValue(schema as never, "", { stem: m?.[1] ?? "甲", branch: m?.[2] ?? "子", year: 2026 }) as Record<string, unknown>
    tamper?.(chapterIdOf(body), v)
    return msg(JSON.stringify(v))
  }
}

// ─────────────────────────────────────────── DB 호출 기록
function instrument(db: FakeDbV3) {
  const client = db.client as unknown as Record<string, Record<string, unknown>>
  for (const model of ["user", "order", "reading"]) {
    for (const [method, fn] of Object.entries(client[model])) {
      if (typeof fn !== "function") continue
      client[model][method] = (args: unknown) => {
        h.calls.push({ model, method, args: JSON.parse(JSON.stringify(args ?? null)) })
        return (fn as (a: unknown) => unknown)(args)
      }
    }
  }
  ;(client as Record<string, unknown>).aiUsage = {
    createMany: async (a: { data: unknown[] }) => {
      h.calls.push({ model: "aiUsage", method: "createMany", args: { n: a.data.length } })
      if (h.aiUsageFail) throw new Error("AiUsage 표 쓰기 실패(테스트)")
      h.aiUsage.push(...a.data)
      return { count: a.data.length }
    },
  }
}

/** 날짜·id 차이를 지운 DB 호출 목록(스위치 조합 간 비교용) */
const normCalls = (calls: Call[]) =>
  JSON.parse(
    JSON.stringify(calls)
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, "<date>")
      .replace(/"(rd|ord)_\d+"/g, '"<$1>"'),
  )

let logs: string[] = []
/** 관찰값 출력(console는 테스트가 가로채므로 stderr로) */
const qa = (...a: unknown[]) => process.stderr.write(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ") + "\n")
const spies: ReturnType<typeof vi.spyOn>[] = []

function setEnv(engine: string | undefined, schema: string | undefined) {
  vi.unstubAllEnvs()
  if (engine === undefined) vi.stubEnv("READING_ENGINE", undefined as unknown as string)
  else vi.stubEnv("READING_ENGINE", engine)
  if (schema === undefined) vi.stubEnv("DB_SCHEMA_V3", undefined as unknown as string)
  else vi.stubEnv("DB_SCHEMA_V3", schema)
}
const V3_ON = () => setEnv("v3", "true")

beforeEach(() => {
  h.db = createFakeDbV3()
  h.calls = []
  h.aiUsage = []
  h.aiUsageFail = false
  h.v3Throw = null
  instrument(h.db)
  h.db.seedUser({ id: "u_owner", email: EMAIL, name: NAME })
  h.db.seedUser({ id: "u_other", email: "other.qa@example.com" })
  h.session = { user: { id: "u_owner", email: EMAIL, name: NAME } }
  h.v2.generateFullReading.mockReset()
  h.v2.generateFullReading.mockResolvedValue({ parts: [], closing: {}, review: {} })
  bodies.length = 0
  tamper = null
  aiDelayMs = 0
  aiFail = null
  installAi()
  logs = []
  for (const k of ["log", "info", "warn", "error", "debug"] as const) {
    spies.push(
      vi.spyOn(console, k).mockImplementation((...a: unknown[]) => {
        logs.push(a.map((x) => (x instanceof Error ? `${x.name}:${x.message}` : typeof x === "string" ? x : JSON.stringify(x))).join(" "))
      }),
    )
  }
})
afterEach(() => {
  while (spies.length) spies.pop()!.mockRestore()
  vi.unstubAllEnvs()
})

function storedInput(over: Record<string, unknown> = {}) {
  return buildSajuInputFromRequest({ ...PERSON, ...over } as never, NAME)
}

function seed(opts: { userId?: string; orderStatus?: string; status?: string; readingType?: string; gender?: string; sajuInput?: unknown; attemptCount?: number; fullReading?: unknown } = {}) {
  const userId = opts.userId ?? "u_owner"
  const order = h.db.seedOrder({ userId, status: opts.orderStatus ?? "PAID" })
  const reading = h.db.seedReading({
    userId, orderId: order.id, status: opts.status ?? "PENDING", readingType: opts.readingType ?? "BASIC",
    gender: opts.gender ?? "M", name: NAME, sajuInput: opts.sajuInput ?? storedInput(),
    ...(opts.attemptCount !== undefined ? { attemptCount: opts.attemptCount } : {}),
    ...(opts.fullReading !== undefined ? { fullReading: opts.fullReading } : {}),
  } as never)
  h.calls = []
  return { order, reading }
}

const row = (id: string) => h.db.readings.get(id) as unknown as Record<string, unknown>
const BASIC_IDS = chaptersForProduct("BASIC").map((c) => c.id)

// ═════════════════════════════════════════ 1. 스위치 조합
describe("1. 스위치 조합 전수 — 정확히 READING_ENGINE=v3 + DB_SCHEMA_V3=true일 때만 v3", () => {
  const ENGINE = [undefined, "", "v3", "V3", " v3", "v3 ", "v3\n", "\tv3", "v 3", "3", "v3.0", "v2", "true", "1", "on", "ｖ３", "v3,v2", "\"v3\"", "v4"]
  const SCHEMA = [undefined, "", "true", "TRUE", "True", " true", "true ", "true\n", "1", "yes", "on", "false", "ｔｒｕｅ", "\"true\""]

  it(`순수 함수: ${ENGINE.length}×${SCHEMA.length} 조합 중 v3는 정확히 1개`, () => {
    const on: string[] = []
    for (const e of ENGINE) for (const s of SCHEMA) {
      const env: Record<string, string | undefined> = { READING_ENGINE: e, DB_SCHEMA_V3: s }
      const c = resolveReadingEngine(env)
      if (c.engine === "v3") on.push(JSON.stringify([e, s]))
      if (e !== "v3") expect(c.fallbackReason, JSON.stringify([e, s])).toBeUndefined()
      if (e === "v3" && s !== "true") expect(c).toEqual({ engine: "v2", fallbackReason: "db_schema_v3_off" })
    }
    expect(on).toEqual([JSON.stringify(["v3", "true"])])
  })

  it("라우트 기본값: process.env를 직접 읽는다(인자 없이)", () => {
    setEnv("v3", "true")
    expect(resolveReadingEngine().engine).toBe("v3")
    setEnv("v3", "TRUE")
    expect(resolveReadingEngine().engine).toBe("v2")
  })

  /** 꺼진 조합으로 라우트를 돌린 기록(DB 호출·응답·AI 호출·저장값) */
  async function runOff(engine: string | undefined, schema: string | undefined) {
    h.db = createFakeDbV3()
    h.calls = []
    instrument(h.db)
    h.db.seedUser({ id: "u_owner", email: EMAIL, name: NAME })
    const { reading } = seed()
    h.v2.generateFullReading.mockClear()
    bodies.length = 0
    setEnv(engine, schema)
    const res = await generatePOST(post(), ctx(reading.id))
    return {
      status: res.status,
      json: JSON.parse(JSON.stringify(await res.json()).replace(/"rd_\d+"/g, '"<rd>"')),
      calls: normCalls(h.calls),
      v2Args: h.v2.generateFullReading.mock.calls.map((c) => JSON.parse(JSON.stringify(c))),
      anthropicBodies: bodies.length,
      saved: { status: row(reading.id).status, fullReading: row(reading.id).fullReading },
    }
  }

  it("꺼진 조합은 모두 v2 경로이고, 스위치가 아예 없을 때와 DB 호출·응답·v2 인자·저장값이 완전히 같다", async () => {
    // 기준 1: 두 변수 모두 없음(예전 운영) / 기준 2: DB_SCHEMA_V3=true만 켬(이전 단계에서 이미 배포된 DB 스위치)
    const base = await runOff(undefined, undefined)
    const baseSchema = await runOff(undefined, "true")

    // 기준 1의 모양을 명시적으로 고정(예전 v2 라우트와 같은 조회 항목)
    expect(base.status).toBe(200)
    expect(base.json).toEqual({ readingId: "<rd>", status: "COMPLETE" })
    expect(base.anthropicBodies).toBe(0)
    expect(base.v2Args).toHaveLength(1)
    expect(base.v2Args[0][1]).toEqual([])
    expect(base.v2Args[0][2]).toEqual({})
    expect(base.calls.map((c: Call) => `${c.model}.${c.method}`)).toEqual([
      "user.findUnique", "reading.findFirst", "reading.updateMany", "reading.updateMany", "order.update", "reading.updateMany",
    ])
    expect(base.calls[1].args.select).toEqual({ id: true, orderId: true, status: true, sajuInput: true })
    // 잠금: v2 기본(시도 횟수 열 없음)
    expect(base.calls[3].args).toEqual({ where: { id: "<rd>", userId: "u_owner", status: { in: ["PENDING", "FAILED"] } }, data: { status: "GENERATING" } })
    expect(base.calls[5].args).toEqual({ where: { id: "<rd>", userId: "u_owner", status: "GENERATING" }, data: { fullReading: { parts: [], closing: {}, review: {} }, status: "COMPLETE" } })
    expect(base.saved.status).toBe("COMPLETE")
    // DB_SCHEMA_V3=true만: 잠금은 시도 횟수(attemptCount)를 쓰지만 조회 항목·응답·AI 경로는 v2 그대로
    expect(baseSchema.calls[1].args.select).toEqual({ id: true, orderId: true, status: true, sajuInput: true })
    expect(baseSchema.calls[3].args.where.attemptCount).toEqual({ lt: 3 })

    const ENGINE_OFF = [undefined, "", "V3", " v3", "v3 ", "v3\n", "v 3", "3", "v2", "true", "ｖ３", "v4"]
    const SCHEMA_ALL = [undefined, "", "true", "TRUE", " true", "true ", "1", "false"]
    let n = 0
    for (const e of ENGINE_OFF) for (const s of SCHEMA_ALL) {
      const r = await runOff(e, s)
      const expected = s === "true" ? baseSchema : base
      expect(r, JSON.stringify([e, s])).toEqual(expected)
      n++
    }
    // READING_ENGINE=v3 + DB 스위치가 정확한 "true"가 아님 → v2(경고 로그만 추가), DB 호출은 기준 1과 같다
    for (const s of [undefined, "", "TRUE", "True", " true", "true ", "true\n", "1", "yes", "false"]) {
      logs = []
      const r = await runOff("v3", s)
      expect(r, JSON.stringify(["v3", s])).toEqual(base)
      expect(logs.some((l) => l.includes("DB_SCHEMA_V3가 꺼져"))).toBe(true)
      n++
    }
    expect(n).toBe(ENGINE_OFF.length * SCHEMA_ALL.length + 10)
  })

  it("켜짐(v3+true): v3 조회 항목(readingType·gender·fullReading 추가), v2 함수 호출 0회", async () => {
    V3_ON()
    const { reading } = seed()
    const res = await generatePOST(post(), ctx(reading.id))
    expect(res.status).toBe(200)
    expect(h.v2.generateFullReading).not.toHaveBeenCalled()
    expect(bodies.length).toBeGreaterThan(0)
    expect((h.calls[1].args as { select: unknown }).select).toEqual({ id: true, orderId: true, status: true, sajuInput: true, readingType: true, gender: true, fullReading: true })
    expect(isStoredReadingV3(row(reading.id).fullReading)).toBe(true)
  })

  it("켜짐인데 v3 준비 불가(미지원 상품·저장 원국 불일치·깨진 입력) → v2로 생성(결제 건 정지 없음)", async () => {
    V3_ON()
    const si = storedInput()
    for (const s of [
      { readingType: "COMPAT" },
      { readingType: "BULLY" },
      { sajuInput: { ...si, pillars: { ...(si.pillars as object), day: "甲子" } } },
      { sajuInput: { ...si, birth: "1987-08-23T21:48" } },
    ]) {
      h.v2.generateFullReading.mockClear()
      bodies.length = 0
      const { reading } = seed(s)
      const res = await generatePOST(post(), ctx(reading.id))
      expect(res.status, JSON.stringify(s)).toBe(200)
      expect(h.v2.generateFullReading).toHaveBeenCalledTimes(1)
      expect(bodies.length).toBe(0)
      expect(logs.some((l) => l.includes("v3 준비 불가"))).toBe(true)
    }
  })
})

// ═════════════════════════════════════════ 2. 개인정보
describe("2. 개인정보 — 운영 경로에서 가로챈 AI 요청 본문·저장본·로그", () => {
  const CASES: [string, Record<string, unknown>, string[]][] = [
    ["양력·분·출생지(서머타임 시기)", {}, []],
    ["음력 입력", { calType: "LUNAR", month: 6, day: 29 }, ["6월 29일", "06-29", "1987-06-29", "음력 6월"]],
    ["시진 선택(자시)", { hour: 0, birthMinute: null, timeMode: "sijin", ziNight: false }, ["00:00", "0시"]],
    ["시각 모름", { hour: null, birthMinute: null, timeMode: undefined }, []],
  ]

  it.each(CASES)("%s: 요청 본문 전체(system·messages·메타)에 이름·생년월일 변형·시각·출생지·경도·이메일 없음", async (_l, over, extra) => {
    V3_ON()
    const si = storedInput(over)
    const { reading } = seed({ sajuInput: si })
    const res = await generatePOST(post({ name: NAME, email: EMAIL, concern: "QA고민원문-이직할까" }), ctx(reading.id))
    expect(res.status).toBe(200)
    expect(bodies.length).toBeGreaterThanOrEqual(BASIC_IDS.length)
    const all = JSON.stringify(bodies)
    // 저장된 birth 문자열(변환된 양력 날짜 포함)에서 파생한 변형도 금지
    const b = String((si as { birth: string }).birth)
    const [ymd, hm] = b.split(" ")
    const [y, mo, d] = ymd.split("-")
    const derived = [ymd, `${y}.${mo}.${d}`, `${y}/${mo}/${d}`, `${y}${mo}${d}`, `${Number(mo)}월 ${Number(d)}일`, `${mo}-${d}`, ...(hm && hm !== "00:00" ? [hm] : [])]
    for (const s of [...PERSON_TEXT, ...derived, ...extra.filter((x) => !(over.hour === 0 && x === "0시")), "QA고민원문"]) {
      expect(all, `AI 본문에 "${s}"`).not.toContain(s)
    }
    // 생년(1987)은 본문에 그대로 있는지 기록(나이 계산값과 구분) — 아래 별도 테스트
    const stored = JSON.stringify(row(reading.id).fullReading)
    for (const s of [...PERSON_TEXT, ...derived, "QA고민원문"]) expect(stored, `저장본에 "${s}"`).not.toContain(s)
    const logText = logs.join("\n")
    for (const s of [...PERSON_TEXT, ...derived, "QA고민원문"]) expect(logText, `로그에 "${s}"`).not.toContain(s)
  })

  it("생년(연도 숫자)·나이: 요청 본문에 출생 연도 숫자가 실리는지 기록(월일·시각은 위에서 없음 확인)", async () => {
    V3_ON()
    const { reading } = seed()
    await generatePOST(post(), ctx(reading.id))
    const all = JSON.stringify(bodies)
    // 관찰값만 남긴다(사실표 불변식은 "월일" 금지). 실패 조건 아님
    const hasYear = all.includes("1987")
    expect(typeof hasYear).toBe("boolean")
    qa("[qa] AI 본문 출생 연도 1987 포함 여부:", hasYear)
  })

  it("AI 요청에 Authorization·키·메타데이터(user_id 등) 없음, SDK 생성자 인자에 키 하드코딩 없음", async () => {
    V3_ON()
    const { reading } = seed()
    await generatePOST(post(), ctx(reading.id))
    for (const b of bodies) {
      expect(Object.keys(b)).not.toContain("metadata")
      expect(JSON.stringify(b)).not.toMatch(/sk-ant|api[_-]?key|u_owner|rd_\d+|ord_\d+/i)
    }
    for (const a of h.anthropic.ctorArgs) expect(JSON.stringify(a ?? {})).not.toMatch(/sk-ant|apiKey/)
  })

  it("고민 글(userText): 라이브러리 층에서 AI·저장본·로그 어디에도 원문 없음(라우트는 요청 본문을 읽지 않음)", async () => {
    const prepared = prepareReadingV3({ readingType: "BASIC", gender: "M", sajuInput: storedInput() })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const text = "QA원문표지 회사 상사와 갈등이 심해서 이직을 고민 중입니다"
    const logged: string[] = []
    const r = await generateReadingV3(prepared.value, {
      userText: text, sleep: async () => {}, baseDelayMs: 0,
      logger: (m, meta) => logged.push(m + JSON.stringify(meta)),
    })
    expect(r.status).toBe("complete")
    expect(JSON.stringify(bodies)).not.toContain("QA원문표지")
    expect(JSON.stringify(bodies)).not.toContain("상사와 갈등")
    expect(JSON.stringify(r.stored)).not.toContain("QA원문표지")
    expect(logged.join("\n") + logs.join("\n")).not.toContain("QA원문표지")
  })
})

// ═════════════════════════════════════════ 3. 규칙 판단
describe("3. 규칙 판단 — 요청 본문의 십성·합충 = 엔진을 따로 돌린 값", () => {
  const POS: Record<string, string> = { year: "year", month: "month", day: "day", hour: "hour" }

  it("원국 십성(글자·위치·이름)과 합충(위치 묶음)이 독립 계산과 일치하고, 독립 계산에 없는 십성 주장이 없다", async () => {
    V3_ON()
    const { reading } = seed()
    await generatePOST(post(), ctx(reading.id))
    // 독립 계산: 원 입력(양력 1987-08-23 21:48, 경도)으로 엔진 직접 실행
    const chart = computeChart({ calendar: "solar", year: 1987, month: 8, day: 23, time: { hour: 21, minute: 48 }, timezone: "Asia/Seoul", longitude: PLACE.longitude, gender: "M" })
    const rules = analyzeRules(chart, undefined, { luck: chart.luck.daeun.map((d) => d.pillar), year: yearPillarOf(koreanDateOf(new Date()).year) })
    const natal = rules.tenGods.filter((t) => t.position.pillar in POS)
    expect(natal.length).toBeGreaterThanOrEqual(7)
    const nature = bodies.find((b) => chapterIdOf(b) === "nature") ?? bodies[0]
    const user = userOf(nature)
    // 원국 글자 표시가 독립 계산과 같다
    for (const p of ["year", "month", "day", "hour"] as const) {
      const pl = chart.pillars[p]!
      expect(user, p).toContain(`${pl.stem}${pl.branch}`)
    }
    // 십성(천간·지지 본기·지장간): "<위치 코드> … <글자> … <십성>"이 한 줄에 함께 있다. 위치 코드는 직접 조립(facts.formatPosition 미사용)
    const lines = user.split("\n")
    const posOf = (p: { pillar: string; part: string }, via?: string) => `${p.pillar}.${p.part}${via ? `.${via}` : ""}`
    const missing: string[] = []
    for (const t of natal) {
      const pos = posOf(t.position, t.viaHiddenStem)
      const re = new RegExp(`(^|[^.\\w])${pos.replace(/\./g, "\\.")}(?![.\\w])`)
      const hit = lines.some((l) => re.test(l) && l.includes(t.tenGod) && l.includes(t.char))
      if (!hit) missing.push(`${pos} ${t.char} ${t.tenGod}`)
    }
    if (missing.length) qa("[qa] 본문 발췌:\n" + lines.filter((l) => /(year|month|day|hour)\./.test(l)).slice(0, 30).join("\n"))
    expect(missing).toEqual([])
    // 원국끼리의 합충: 엔진 interactions의 위치 묶음([a+b])이 본문에 있다
    const natalInter = rules.interactions.filter((i) => i.members.every((p) => p.pillar in POS))
    for (const i of natalInter) {
      const key = `[${i.members.map((p) => posOf(p)).join("+")}]`
      expect(user, `${i.type} ${key}`).toContain(key)
    }
    qa("[qa] 원국 십성", natal.length, "개 · 원국 합충", natalInter.length, "개 대조")
    // 역방향: 본문의 "위치 코드 + 십성 하나" 줄이 독립 계산에 있는 조합인가
    const TEN = ["비견", "겁재", "식신", "상관", "편재", "정재", "편관", "정관", "편인", "정인"]
    const allowed = new Set(natal.map((t) => `${posOf(t.position, t.viaHiddenStem)}|${t.tenGod}`))
    let checked = 0
    for (const l of lines) {
      const codes = l.match(/\b(?:year|month|day|hour)\.(?:stem|branch)(?:\.(?:yeogi|junggi|jeonggi))?(?![.\w])/g) ?? []
      const named = TEN.filter((g) => l.includes(g))
      if (codes.length !== 1 || named.length !== 1 || l.includes("+")) continue
      checked++
      expect(allowed.has(`${codes[0]}|${named[0]}`), l).toBe(true)
    }
    qa("[qa] 역방향 대조 줄 수", checked)
  })

  it("AI에게 규칙 판단을 맡기는 옛 지시가 운영 요청 본문에 없다", async () => {
    V3_ON()
    const { reading } = seed()
    await generatePOST(post(), ctx(reading.id))
    const all = JSON.stringify(bodies)
    for (const s of ["네가 뽑는다", "네가 판단", "십성을 계산", "합충을 찾아", "직접 계산", "알아서 판단"]) expect(all, s).not.toContain(s)
  })
})

// ═════════════════════════════════════════ 4. 실패·재시도
describe("4. 실패·재시도 — 검증기 block·시도 상한·동시 요청·부분 저장 재사용·사실표 변경", () => {
  const BAD = "명리학은 과학적으로 입증된 학문이라 적중률이 높다."

  it("block 장: 2회 시도 후 실패, 출력 미저장, 상태 FAILED·500, 다른 장은 통과 저장", async () => {
    V3_ON()
    tamper = (id, v) => {
      if (id === "money" && Array.isArray(v.body)) v.body = [BAD]
    }
    const { reading } = seed()
    const res = await generatePOST(post(), ctx(reading.id))
    expect(res.status).toBe(500)
    const r = row(reading.id)
    expect(r.status).toBe("FAILED")
    expect(r.attemptCount).toBe(1)
    const fr = r.fullReading as { status: string; chapters: { id: string; ok: boolean; output?: unknown; attempts: number }[]; failedIds: string[] }
    expect(fr.status).toBe("partial")
    expect(fr.failedIds).toEqual(["money"])
    const money = fr.chapters.find((c) => c.id === "money")!
    expect(money.ok).toBe(false)
    expect(money.output).toBeUndefined()
    expect(money.attempts).toBe(2)
    expect(JSON.stringify(fr)).not.toContain("적중률")
    expect(bodies.filter((b) => chapterIdOf(b) === "money")).toHaveLength(2)
    for (const c of fr.chapters.filter((x) => x.id !== "money")) expect(c.ok, c.id).toBe(true)
  })

  it("partial 재시도: 통과 장 재사용(실패 장만 AI 호출), 비용 누적, 성공 시 COMPLETE", async () => {
    V3_ON()
    tamper = (id, v) => {
      if (id === "money" && Array.isArray(v.body)) v.body = [BAD]
    }
    const { reading } = seed()
    await generatePOST(post(), ctx(reading.id))
    const first = row(reading.id).fullReading as { cost: { calls: number }; chapters: { id: string; output?: unknown }[] }
    // DB 왕복과 같게 JSON 직렬화
    row(reading.id).fullReading = JSON.parse(JSON.stringify(first))
    bodies.length = 0
    tamper = null
    const res = await generatePOST(post(), ctx(reading.id))
    expect(res.status).toBe(200)
    expect(bodies.map(chapterIdOf)).toEqual(["money"])
    const second = row(reading.id).fullReading as typeof first & { status: string }
    expect(second.status).toBe("complete")
    expect(row(reading.id).status).toBe("COMPLETE")
    expect(row(reading.id).attemptCount).toBe(2)
    expect(second.cost.calls).toBe(first.cost.calls + 1)
    // 재사용 장 본문이 이전과 같다
    for (const c of first.chapters.filter((x) => x.id !== "money")) {
      expect(second.chapters.find((x) => x.id === c.id)!.output, c.id).toEqual(c.output)
    }
  })

  it("사실표가 바뀐 저장본(다른 사실)으로 재시도 → 전부 다시 생성", async () => {
    V3_ON()
    tamper = (id, v) => {
      if (id === "money" && Array.isArray(v.body)) v.body = [BAD]
    }
    const { reading } = seed()
    await generatePOST(post(), ctx(reading.id))
    const prev = JSON.parse(JSON.stringify(row(reading.id).fullReading)) as { facts: Record<string, unknown> }
    // 해가 바뀐 경우를 흉내: 사실표의 엔진 판 표시만 바꿈(asOf 이외 필드 변경)
    prev.facts = { ...prev.facts, engineVersion: "engine@changed-by-qa" }
    row(reading.id).fullReading = prev
    bodies.length = 0
    tamper = null
    await generatePOST(post(), ctx(reading.id))
    expect(new Set(bodies.map(chapterIdOf))).toEqual(new Set(BASIC_IDS))
  })

  it("다른 상품 저장본·v2 형식 저장본은 재사용하지 않는다", async () => {
    V3_ON()
    const { reading } = seed({ status: "FAILED", fullReading: { parts: [{ title: "옛 v2" }] } })
    await generatePOST(post(), ctx(reading.id))
    expect(new Set(bodies.map(chapterIdOf))).toEqual(new Set(BASIC_IDS))
  })

  it("시도 상한: attemptCount=3·FAILED → 409 retryExhausted, AI·v2 호출 0, 상태 불변", async () => {
    V3_ON()
    const { reading } = seed({ status: "FAILED", attemptCount: 3 })
    const res = await generatePOST(post(), ctx(reading.id))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ retryExhausted: true })
    expect(bodies.length).toBe(0)
    expect(h.v2.generateFullReading).not.toHaveBeenCalled()
    expect(row(reading.id).status).toBe("FAILED")
    expect(row(reading.id).attemptCount).toBe(3)
  })

  it("계속 block이면 3회 시도 후 4번째 요청은 409 — 풀이 1건 총 AI 호출 상한이 있다", async () => {
    V3_ON()
    tamper = (_id, v) => {
      if (Array.isArray(v.body)) v.body = [BAD]
    }
    const { reading } = seed()
    const codes: number[] = []
    for (let i = 0; i < 5; i++) codes.push((await generatePOST(post(), ctx(reading.id))).status)
    expect(codes).toEqual([500, 500, 500, 409, 409])
    expect(row(reading.id).attemptCount).toBe(3)
    // 시도당 장 수×2(검증 재생성) 이하, 시도당 상한 40 이하
    expect(bodies.length).toBeLessThanOrEqual(3 * Math.min(40, BASIC_IDS.length * 4))
    qa("[qa] 연속 block 3회 시도 총 AI 호출 수:", bodies.length, "장 수:", BASIC_IDS.length)
  })

  it("동시 요청 15개 → 생성 1회(장별 첫 호출 각 1회), 1개만 200, 나머지 202, attemptCount 1", async () => {
    V3_ON()
    aiDelayMs = 15
    const { reading } = seed()
    const res = await Promise.all(Array.from({ length: 15 }, () => generatePOST(post(), ctx(reading.id))))
    const codes = res.map((r) => r.status)
    expect(codes.filter((c) => c === 200)).toHaveLength(1)
    expect(codes.filter((c) => c === 202)).toHaveLength(14)
    expect(bodies.map(chapterIdOf).sort()).toEqual([...BASIC_IDS].sort())
    expect(row(reading.id).attemptCount).toBe(1)
    expect(row(reading.id).status).toBe("COMPLETE")
  })

  it("완료 후 재요청 → AI 0회, alreadyCompleted, attemptCount 불변", async () => {
    V3_ON()
    const { reading } = seed()
    await generatePOST(post(), ctx(reading.id))
    bodies.length = 0
    const res = await generatePOST(post(), ctx(reading.id))
    expect(await res.json()).toMatchObject({ alreadyCompleted: true })
    expect(bodies.length).toBe(0)
    expect(row(reading.id).attemptCount).toBe(1)
  })
})

// ═════════════════════════════════════════ 5. 결제 안전·비용 기록
describe("5. 결제 안전·비용 기록", () => {
  it("남의 풀이 → 404, DB 쓰기·AI 호출 0, 존재 여부를 응답으로 구분할 수 없음", async () => {
    V3_ON()
    const { reading } = seed({ userId: "u_other" })
    const res = await generatePOST(post(), ctx(reading.id))
    const missing = await generatePOST(post(), ctx("rd_does_not_exist"))
    expect(res.status).toBe(404)
    expect(missing.status).toBe(404)
    expect(await res.json()).toEqual(await missing.json())
    expect(bodies.length).toBe(0)
    expect(h.calls.filter((c) => c.method !== "findFirst" && c.method !== "findUnique")).toEqual([])
    expect(row(reading.id).status).toBe("PENDING")
  })

  it("로그인 없음 → 401, DB 조회조차 없음", async () => {
    V3_ON()
    h.session = null
    const { reading } = seed()
    const res = await generatePOST(post(), ctx(reading.id))
    expect(res.status).toBe(401)
    expect(h.calls).toEqual([])
  })

  // 결함 V3-5(알려진 결함 — 고쳐지면 it.fails → it): 라우트가 Order.status(PAID)를 확인하지 않는다.
  // 현재 풀이 레코드는 결제 승인(PAID) 뒤에만 만들어지므로 지금 당장 악용 경로는 없지만, 환불·취소가 생기면 무료 생성이 된다(v2도 같음)
  for (const orderStatus of ["PENDING", "FAILED", "CANCELED", "REFUNDED"]) {
    it.fails(`[알려진 결함 V3-5] 주문 상태 ${orderStatus}인 풀이 레코드 → AI를 부르지 않아야 한다`, async () => {
      V3_ON()
      const { reading } = seed({ orderStatus })
      const res = await generatePOST(post(), ctx(reading.id))
      expect(bodies.length, `주문 ${orderStatus}인데 AI 호출`).toBe(0)
      expect(res.status).not.toBe(200)
    })
  }

  it("정상 생성: AiUsage에 호출 수만큼 행(장 id·모델·토큰·비용만, 본문·개인정보 없음)", async () => {
    V3_ON()
    const { reading } = seed()
    await generatePOST(post(), ctx(reading.id))
    expect(h.aiUsage).toHaveLength(bodies.length)
    for (const r of h.aiUsage as Record<string, unknown>[]) {
      expect(Object.keys(r).sort()).toEqual(["cacheReadTokens", "cacheWriteTokens", "chapterId", "costUsd", "inputTokens", "model", "outputTokens", "readingId"])
      expect(r.readingId).toBe(reading.id)
      expect(String(r.costUsd)).toMatch(/^\d+\.\d{6}$/)
    }
    expect(JSON.stringify(h.aiUsage)).not.toMatch(new RegExp([NAME, EMAIL, "1987-08-23", PLACE.name].join("|")))
  })

  it("AI가 전부 실패(500) → FAILED·500, 실패 호출도 AiUsage에 남는다", async () => {
    V3_ON()
    aiFail = () => Object.assign(new Error("server error"), { status: 500, name: "InternalServerError" })
    const { reading } = seed()
    const t0 = Date.now()
    const res = await generatePOST(post(), ctx(reading.id))
    // 라우트는 대기 함수를 주입하지 않으므로 실제 재시도 대기(지수 백오프)를 그대로 겪는다
    qa("[qa] AI 전부 500: 호출", bodies.length, "회, 소요", Date.now() - t0, "ms")
    expect(res.status).toBe(500)
    expect(row(reading.id).status).toBe("FAILED")
    expect(row(reading.id).attemptCount).toBe(1)
    expect(bodies.length).toBeGreaterThan(0)
    expect(h.aiUsage).toHaveLength(bodies.length)
    expect(bodies.length).toBeLessThanOrEqual(Math.min(40, BASIC_IDS.length * 4))
  }, 120_000)

  it("엔진이 몇 번 호출한 뒤 예외 → FAILED·500(일반 문구), 이미 한 호출은 AiUsage에 남는다", async () => {
    V3_ON()
    h.v3Throw = { events: 3 }
    const { reading } = seed()
    const res = await generatePOST(post(), ctx(reading.id))
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain("예상 밖 오류")
    expect(row(reading.id).status).toBe("FAILED")
    expect(h.aiUsage).toHaveLength(3)
  })

  it("AiUsage 쓰기가 실패해도 풀이 결과(200·COMPLETE)는 바뀌지 않고 로그만", async () => {
    V3_ON()
    h.aiUsageFail = true
    const { reading } = seed()
    const res = await generatePOST(post(), ctx(reading.id))
    expect(res.status).toBe(200)
    expect(row(reading.id).status).toBe("COMPLETE")
    expect(logs.some((l) => l.includes("AiUsage 기록 실패"))).toBe(true)
  })
})

// ═════════════════════════════════════════ 6. 남은 위험(관찰)
describe("6. 화면 연결 — v3 저장본을 기존 풀이 화면이 그릴 수 있는가", () => {
  // 결함 V3-1(알려진 결함 — 고쳐지면 it.fails → it)
  it.fails("[알려진 결함 V3-1] v3로 COMPLETE된 fullReading을 ReadingViewer(풀이 화면)에 넣으면 렌더링이 되어야 한다", async () => {
    V3_ON()
    const { reading } = seed()
    await generatePOST(post(), ctx(reading.id))
    const fr = row(reading.id).fullReading
    expect(row(reading.id).status).toBe("COMPLETE")
    let error: string | null = null
    try {
      renderToString(
        createElement(ReadingViewer as never, {
          userName: "손주", readingName: "평생 사주", readingType: "BASIC", birthInfo: "", pillars: [], fiveElements: [],
          content: null, fullReading: fr, createdAt: "",
        }),
      )
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
    // 결함 V3-1 기록: 현재 화면은 v2 형식(parts)만 안다
    qa("[qa] v3 저장본 화면 렌더링:", error ?? "정상")
    expect(error, "v3 저장본 화면 렌더링 오류").toBeNull()
  })
})
