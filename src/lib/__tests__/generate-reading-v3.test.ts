// 본 풀이 v3(새 콘텐츠 엔진 연결) — 담당: 백엔드·서버 개발자
// 가짜 AI 클라이언트만 쓴다(실제 API 호출 없음). 인물·고민 글은 테스트용으로 지어낸 값이다(실제 고객 아님).
import { describe, expect, it } from "vitest"
import type { Message, MessageCreateParamsNonStreaming, MessageStreamParams } from "@anthropic-ai/sdk/resources/messages/messages"
import { analyzeRules, computeChart, yearPillarOf } from "@/engine"
import { buildFactSheet, formatPosition } from "@/engine/content/facts"
import type { ContentClient, GenerationEvent } from "@/engine/content/generate"
import { chaptersForProduct, CRISIS_MESSAGE } from "@/engine/content/prompts"
import { buildPersonalContext } from "@/engine/personalize"
import { buildSajuInputFromRequest } from "@/lib/saju-input"
import {
  aiUsageRows, generateReadingV3, isStoredReadingV3, parseStoredBirth, prepareReadingV3, recordAiUsage, reusableChapters,
  type PreparedReadingV3,
} from "@/lib/generate-reading-v3"
import { fakeValue } from "../../../scripts/content/samples/fake-client"

const AS_OF = new Date("2026-11-27T03:00:00Z")
const NAME = "김가람"
const PLACE = { name: "부산광역시", longitude: 129.0756 }

/** 결제 확인 라우트와 같은 함수로 저장 형식 sajuInput을 만든다 */
function storedInput(over: Partial<Parameters<typeof buildSajuInputFromRequest>[0]> = {}) {
  return buildSajuInputFromRequest(
    { year: 1990, month: 5, day: 15, hour: 14, birthMinute: 37, timeMode: "exact", gender: "F", calType: "SOLAR", birthplace: PLACE, ...over },
    NAME,
    { now: AS_OF },
  )
}

function prepare(over: Partial<Parameters<typeof buildSajuInputFromRequest>[0]> = {}, readingType = "BASIC"): PreparedReadingV3 {
  const sajuInput = storedInput(over)
  const r = prepareReadingV3({ readingType, gender: String(over.gender ?? "F"), sajuInput }, { asOf: AS_OF })
  if (!r.ok) throw new Error(`prepare 실패: ${r.reason}`)
  return r.value
}

// ─────────────────────────────────────────── 가짜 클라이언트

type Body = MessageCreateParamsNonStreaming | MessageStreamParams
type Schema = Parameters<typeof fakeValue>[0]

const GANZHI = /([甲乙丙丁戊己庚辛壬癸])([子丑寅卯辰巳午未申酉戌亥])/

function userOf(body: Body): string {
  return body.messages.map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content))).join("\n")
}
function chapterIdOf(body: Body): string {
  return userOf(body).match(/^이번에 쓸 장: 「[^」]*」 \(([^)]+)\)/)?.[1] ?? "?"
}

function message(text: string): Message {
  return {
    id: "msg_fake",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content: [{ type: "text", text, citations: null }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  } as unknown as Message
}

/** 스키마 모양대로 답하는 가짜. tamper(장 id, 값)로 특정 장 출력을 바꿀 수 있다 */
function fakeClient(tamper?: (chapterId: string, value: Record<string, unknown>) => void) {
  const bodies: Body[] = []
  const respond = async (body: Body): Promise<Message> => {
    bodies.push(body)
    const user = userOf(body)
    const m = user.match(GANZHI)
    const y = user.match(/(20\d\d)/)
    const schema = (body.output_config as { format?: { schema?: Schema } } | undefined)?.format?.schema ?? { type: "object" }
    const value = fakeValue(schema, "", { stem: m?.[1] ?? "甲", branch: m?.[2] ?? "子", year: y ? Number(y[1]) : 2026 }) as Record<string, unknown>
    tamper?.(chapterIdOf(body), value)
    return message(JSON.stringify(value))
  }
  const client: ContentClient = {
    messages: { create: (b) => respond(b), stream: (b) => ({ finalMessage: () => respond(b) }) },
  }
  return { client, bodies }
}

const quiet = { logger: () => {}, sleep: async () => {}, baseDelayMs: 0 }

// ─────────────────────────────────────────── 준비

describe("prepareReadingV3 — 저장된 입력에서 엔진으로 다시 계산", () => {
  it("저장 형식 birth 해석", () => {
    expect(parseStoredBirth("1990-05-15 14:37")).toEqual({ year: 1990, month: 5, day: 15, time: { hour: 14, minute: 37 } })
    expect(parseStoredBirth("1990-05-15")).toEqual({ year: 1990, month: 5, day: 15, time: null })
    for (const bad of ["1990-5-15", "1990-05-15 25:00", "1990-05-15T14:37", 19900515, null]) expect(parseStoredBirth(bad)).toBeNull()
  })

  it.each([
    ["양력·분·출생지", {}],
    ["음력", { calType: "LUNAR", month: 4, day: 21 }],
    ["시진 선택(자시, 자정 전 밤)", { hour: 0, birthMinute: null, timeMode: "sijin", ziNight: true }],
    ["시진 선택(축시)", { hour: 2, birthMinute: null, timeMode: "sijin" }],
    ["시각 모름", { hour: null, birthMinute: null, timeMode: undefined }],
    ["서머타임 시기", { year: 1987, month: 7, day: 10, hour: 9, birthMinute: 10 }],
    ["남성·출생지 없음", { gender: "M", birthplace: undefined }],
  ] as const)("%s: 다시 계산한 원국 = 저장된 원국(화면 글자)", (_label, over) => {
    const si = storedInput(over as never)
    const r = prepareReadingV3({ readingType: "BASIC", gender: String((over as { gender?: string }).gender ?? "F"), sajuInput: si }, { asOf: AS_OF })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const p = r.value.facts.chart.pillars
    expect({ year: p.year, month: p.month, day: p.day, ...(p.hour ? { hour: p.hour } : {}) }).toEqual(si.pillars)
    expect(r.value.facts.subject.hourKnown).toBe(!si.hour_unknown)
  })

  it("지원 상품만: BASIC·MONEY·LOVE·CAREER는 장 목록, BULLY·CONFLICT·FREE·모르는 값은 unsupported_product", () => {
    const si = storedInput()
    for (const t of ["BASIC", "MONEY", "LOVE", "CAREER"]) {
      const r = prepareReadingV3({ readingType: t, gender: "F", sajuInput: si }, { asOf: AS_OF })
      expect(r.ok && r.value.chapters.map((c) => c.id)).toEqual(chaptersForProduct(t).map((c) => c.id))
    }
    for (const t of ["BULLY", "CONFLICT", "FREE", "COMPAT", "basic", ""]) {
      expect(prepareReadingV3({ readingType: t, gender: "F", sajuInput: si }, { asOf: AS_OF })).toMatchObject({ ok: false, reason: "unsupported_product" })
    }
  })

  it("저장된 원국이 다시 계산한 값과 다르면 pillars_mismatch(화면 글자와 풀이 글자가 어긋나지 않게)", () => {
    const si = storedInput()
    const r = prepareReadingV3({ readingType: "BASIC", gender: "F", sajuInput: { ...si, pillars: { ...si.pillars, day: "甲子" } } }, { asOf: AS_OF })
    expect(r).toMatchObject({ ok: false, reason: "pillars_mismatch" })
  })

  it("입력이 깨졌으면 이유 코드만(예외 없음)", () => {
    const si = storedInput()
    expect(prepareReadingV3({ readingType: "BASIC", gender: "F", sajuInput: null }, { asOf: AS_OF })).toMatchObject({ ok: false, reason: "no_saju_input" })
    expect(prepareReadingV3({ readingType: "BASIC", gender: "F", sajuInput: { ...si, birth: "어제" } }, { asOf: AS_OF })).toMatchObject({ ok: false, reason: "bad_birth" })
    expect(prepareReadingV3({ readingType: "BASIC", gender: "X", sajuInput: { ...si, gender: "?" } }, { asOf: AS_OF })).toMatchObject({ ok: false, reason: "bad_gender" })
    expect(prepareReadingV3({ readingType: "BASIC", gender: "F", sajuInput: { ...si, birth: "1990-02-30 10:00" } }, { asOf: AS_OF })).toMatchObject({ ok: false, reason: "engine_input_error" })
  })
})

// ─────────────────────────────────────────── (b) 개인정보·사실표 그대로

describe("(b) AI 요청 본문 — 사실표만, 생년월일·출생지·이름 원문 없음, 십성·합충은 사실표 값 그대로", () => {
  it("요청 본문 전체에 이름·생년월일·출생 시각·출생지가 없다", async () => {
    const prepared = prepare()
    const f = fakeClient()
    const r = await generateReadingV3(prepared, { client: f.client, ...quiet })
    expect(r.run.totals.calls).toBeGreaterThan(0)
    expect(f.bodies.length).toBe(r.run.totals.calls)
    const all = JSON.stringify(f.bodies)
    for (const banned of [NAME, "가람", "1990-05-15", "1990-5-15", "1990년 5월 15일", "5월 15일", "05-15", "14:37", "14시 37분", PLACE.name, "부산", "129.07", "129.08"]) {
      expect(all, banned).not.toContain(banned)
    }
    // 저장본(fullReading)의 사실표에도 없다
    const stored = JSON.stringify(r.stored)
    for (const banned of [NAME, "1990-05-15", "14:37", PLACE.name, "129.07"]) expect(stored, banned).not.toContain(banned)
    // 호칭은 기본값(실명 대신)
    expect(r.stored.facts.subject.addressAs).toBe("손주")
  })

  it("호칭은 sanitize된 값만(태그·따옴표 제거, 8자 제한)", () => {
    const si = storedInput()
    const r = prepareReadingV3({ readingType: "BASIC", gender: "F", sajuInput: si }, { asOf: AS_OF, addressAs: '<b>우리"강아지{}</b>입니다아아아' })
    expect(r.ok && r.value.facts.subject.addressAs).toBe("우리강아지입니다")
  })

  it("사실표의 십성·합충은 규칙 엔진 결과 그대로이고, 요청 본문에 그 값이 실린다", async () => {
    const prepared = prepare()
    // 독립 계산: 같은 입력으로 엔진을 직접 돌려 사실표를 만든다
    const chart = computeChart({ calendar: "solar", year: 1990, month: 5, day: 15, time: { hour: 14, minute: 37 }, timezone: "Asia/Seoul", longitude: PLACE.longitude, gender: "F" })
    const rules = analyzeRules(chart, undefined, { luck: chart.luck.daeun.map((d) => d.pillar), year: yearPillarOf(2026) })
    const expected = buildFactSheet({ chart, rules, personal: buildPersonalContext(chart, [], AS_OF, rules), asOf: AS_OF })
    expect(prepared.facts.chart.tenGods).toEqual(expected.chart.tenGods)
    expect(prepared.facts.chart.interactions).toEqual(expected.chart.interactions)
    // 원국 십성은 규칙 엔진 tenGods를 옮긴 것(위치·이름 그대로)
    const natal = rules.tenGods.filter((h) => h.position.pillar !== "daeun" && h.position.pillar !== "seun")
    for (const h of natal) {
      expect(prepared.facts.chart.tenGods).toContainEqual({ char: h.char, pos: formatPosition(h.position, h.viaHiddenStem), tenGod: h.tenGod })
    }

    const f = fakeClient()
    await generateReadingV3(prepared, { client: f.client, ...quiet })
    const natureBody = f.bodies.find((b) => chapterIdOf(b) === "nature")
    expect(natureBody).toBeDefined()
    const user = userOf(natureBody!)
    // 사실표 십성이 위치 코드와 함께 실린다
    const visible = prepared.facts.chart.tenGods.filter((t) => /^(year|month|day|hour)\.(stem|branch)$/.test(t.pos))
    expect(visible.length).toBeGreaterThan(0)
    for (const t of visible) {
      expect(user).toContain(t.tenGod)
      expect(user).toContain(t.pos)
    }
    // 합충: 원국 관계는 위치 코드 묶음 그대로
    for (const it of prepared.facts.chart.interactions.filter((x) => x.positions.every((p) => /^(year|month|day|hour)\./.test(p)))) {
      expect(user).toContain(`[${it.positions.join("+")}]`)
    }
    // AI에게 규칙 판단을 맡기는 옛 지시가 없다
    expect(JSON.stringify(f.bodies)).not.toContain("네가 뽑는다")
  })

  it("통과한 장만 output이 있고, 저장본은 v3 형식·호출 기록은 장 id·모델·토큰·비용만", async () => {
    const prepared = prepare()
    const events: GenerationEvent[] = []
    const r = await generateReadingV3(prepared, { client: fakeClient().client, onEvent: (e) => events.push(e), ...quiet })
    expect(isStoredReadingV3(r.stored)).toBe(true)
    expect(r.stored.chapters.map((c) => c.id)).toEqual(prepared.chapters.map((c) => c.id))
    for (const c of r.stored.chapters) expect(c.ok ? c.output !== undefined : c.output === undefined).toBe(true)
    expect(r.stored.cost.calls).toBe(r.run.totals.calls)
    expect(events.length).toBe(r.run.totals.calls)
    const rows = aiUsageRows("rd_1", events)
    expect(rows.length).toBe(events.length)
    expect(Object.keys(rows[0]).sort()).toEqual(["cacheReadTokens", "cacheWriteTokens", "chapterId", "costUsd", "inputTokens", "model", "outputTokens", "readingId"])
    expect(rows[0].costUsd).toMatch(/^\d+\.\d{6}$/)
    const written: unknown[] = []
    expect(await recordAiUsage({ aiUsage: { createMany: async (a) => void written.push(a) } }, "rd_1", events)).toBe(events.length)
    expect(await recordAiUsage({ aiUsage: { createMany: async () => { throw new Error("부르면 안 됨") } } }, "rd_1", [])).toBe(0)
  })
})

// ─────────────────────────────────────────── (c) 검증기 block

describe("(c) 검증기 block 장 — 1회 재생성 후에도 block이면 실패(출력 저장 안 함)", () => {
  const BAD = "이 풀이는 적중률이 아주 높다."

  it("money 장만 늘 block → 2회 시도 후 verify_block, status=partial, 나머지 장은 통과", async () => {
    const prepared = prepare()
    const f = fakeClient((id, v) => {
      if (id === "money" && Array.isArray(v.body)) v.body = [`${String(v.body[0])} ${BAD}`, ...v.body.slice(1)]
    })
    const r = await generateReadingV3(prepared, { client: f.client, ...quiet })
    const money = r.stored.chapters.find((c) => c.id === "money")!
    expect(money).toMatchObject({ ok: false, error: "verify_block", attempts: 2 })
    expect(money.output).toBeUndefined()
    expect(money.verify?.pass).toBe(false)
    expect(money.verify?.findings.some((x) => x.code === "SCIENTIFIC_CLAIM" && x.severity === "block")).toBe(true)
    expect(JSON.stringify(r.stored)).not.toContain("적중률")
    // 두 번째 요청에는 검증 피드백이 붙는다
    const moneyBodies = f.bodies.filter((b) => chapterIdOf(b) === "money")
    expect(moneyBodies.length).toBe(2)
    expect(userOf(moneyBodies[1])).toContain("SCIENTIFIC_CLAIM")
    expect(r.status).toBe("partial")
    expect(r.stored.failedIds).toContain("money")
    for (const c of r.stored.chapters.filter((x) => x.id !== "money")) expect(c.ok, c.id).toBe(true)
  })

  it("다시 시도: 이전 저장본의 통과 장은 다시 만들지 않고 실패한 장만 부른다(비용 누적)", async () => {
    const prepared = prepare()
    const first = await generateReadingV3(prepared, {
      client: fakeClient((id, v) => {
        if (id === "money" && Array.isArray(v.body)) v.body = [BAD]
      }).client,
      ...quiet,
    })
    expect(first.status).toBe("partial")
    // JSON 저장·읽기를 거친 값으로(실제 DB 왕복과 같게)
    const previous = JSON.parse(JSON.stringify(first.stored))
    expect(reusableChapters(previous, prepared)?.map((c) => c.id)).toEqual(prepared.chapters.map((c) => c.id).filter((x) => x !== "money"))
    const f2 = fakeClient()
    const second = await generateReadingV3(prepared, { client: f2.client, previous, ...quiet })
    expect(f2.bodies.map(chapterIdOf)).toEqual(["money"])
    expect(second.status).toBe("complete")
    expect(second.stored.cost.calls).toBe(first.stored.cost.calls + 1)
  })

  it("사실표가 달라진 이전 저장본(다른 상품·해 바뀜)은 다시 쓰지 않는다", async () => {
    const prepared = prepare()
    const first = await generateReadingV3(prepared, { client: fakeClient().client, ...quiet })
    const prev = JSON.parse(JSON.stringify(first.stored))
    expect(reusableChapters({ ...prev, product: "MONEY" }, prepared)).toBeUndefined()
    const nextYear = prepareReadingV3({ readingType: "BASIC", gender: "F", sajuInput: storedInput() }, { asOf: new Date("2027-03-01T03:00:00Z") })
    expect(nextYear.ok && reusableChapters(prev, nextYear.value)).toBeUndefined()
    expect(reusableChapters({ parts: [] }, prepared)).toBeUndefined()
  })
})

// ─────────────────────────────────────────── (d) 위기 사전 감지

describe("(d) 위기 사전 감지 — AI 0회, 상담 안내만", () => {
  it("고민 글에 위기 표현 → 호출 0회·비용 0·장 출력 없음, crisis.message 저장, 원문 미저장", async () => {
    const prepared = prepare()
    const f = fakeClient()
    const events: GenerationEvent[] = []
    const text = "요즘 너무 힘들어서 죽고 싶다는 생각이 자주 들어요"
    const r = await generateReadingV3(prepared, { client: f.client, userText: text, onEvent: (e) => events.push(e), ...quiet })
    expect(f.bodies.length).toBe(0)
    expect(events.length).toBe(0)
    expect(r.status).toBe("crisis")
    expect(r.run.totals.calls).toBe(0)
    expect(r.stored.cost.costUsdEstimate).toBe(0)
    expect(r.stored.chapters.every((c) => !c.ok && c.output === undefined && c.attempts === 0)).toBe(true)
    expect(r.stored.crisis?.message).toContain(CRISIS_MESSAGE.halmi.replace("{호칭}, ", ""))
    expect(JSON.stringify(r.stored)).not.toContain("죽고")
  })

  it("이전 저장본에 통과 장이 있어도 위기 글이면 풀이를 돌려주지 않는다", async () => {
    const prepared = prepare()
    const first = await generateReadingV3(prepared, { client: fakeClient().client, ...quiet })
    const r = await generateReadingV3(prepared, { client: fakeClient().client, previous: JSON.parse(JSON.stringify(first.stored)), userText: "죽고 싶어요", ...quiet })
    expect(r.status).toBe("crisis")
    expect(r.stored.chapters.every((c) => c.output === undefined)).toBe(true)
  })

  it("정상 고민 글은 생성 진행, 고민 원문은 AI 요청·저장본에 없다", async () => {
    const prepared = prepare()
    const f = fakeClient()
    const r = await generateReadingV3(prepared, { client: f.client, userText: "이직을 할지 남을지 고민이에요", ...quiet })
    expect(r.status).toBe("complete")
    expect(f.bodies.length).toBeGreaterThan(0)
    expect(JSON.stringify(f.bodies)).not.toContain("이직을 할지")
    expect(JSON.stringify(r.stored)).not.toContain("이직을 할지")
  })
})
