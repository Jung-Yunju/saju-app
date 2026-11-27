// 견본 풀이 생성 스크립트(scripts/content/samples) — 가짜 클라이언트만 쓴다. 실제 API 호출 없음.
// 전체 흐름 1명 · 비용 상한 중단 · 키 없음 안내 · 장 명세 없음 · 출력 HTML/JSON에 키·생년월일 없음 · 가상 인물 조건 · 실패한 장만 다시
import { afterAll, describe, expect, it } from "vitest"
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { PERSONAS, selectPersonas } from "../../scripts/content/samples/personas"
import {
  BudgetGuard, KEY_ENV, loadBasicChapters, makeRedactor, parseArgs, preparePersona, runSamples, worstCaseCostUsd,
  type RunDeps, type SampleRecord,
} from "../../scripts/content/samples/lib"
import { createFakeClient } from "../../scripts/content/samples/fake-client"
import { esc, renderIndexHtml } from "../../scripts/content/samples/html"
import { estimateCostUsd } from "../../src/engine/content/cost"

const AS_OF_MS = Date.parse("2026-11-27T03:00:00Z")
const SECRET = "sk-ant-api03-TEST-ONLY-NOT-A-REAL-KEY-0123456789abcdef"
const roots: string[] = []
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })))

function tmpRoot(): string {
  const r = mkdtempSync(join(tmpdir(), "saju-samples-"))
  roots.push(r)
  return r
}

function deps(over: Partial<RunDeps> & { fake?: ReturnType<typeof createFakeClient> } = {}) {
  const logs: string[] = []
  const fake = over.fake ?? createFakeClient()
  const keysSeen: string[] = []
  const d: RunDeps = {
    env: { [KEY_ENV]: SECRET },
    makeClient: (k) => {
      keysSeen.push(k)
      return fake
    },
    log: (s) => logs.push(s),
    now: () => AS_OF_MS,
    samplesRoot: tmpRoot(),
    generateOptions: { sleep: async () => {}, baseDelayMs: 0 },
    ...over,
  }
  return { d, logs, fake, keysSeen }
}

const birthStrings = (p: (typeof PERSONAS)[number]) => {
  const { year, month, day } = p.birth
  const mm = String(month).padStart(2, "0")
  const dd = String(day).padStart(2, "0")
  return [`${year}-${mm}-${dd}`, `${year}-${month}-${day}`, `${year}년 ${month}월 ${day}일`, `${year}.${mm}.${dd}`]
}

describe("가상 인물 10명 — 엔진으로 조건 확인", () => {
  const asOf = new Date(AS_OF_MS)
  const prepared = PERSONAS.map((p) => ({ p, x: preparePersona(p, asOf) }))

  it("10명, 일간 10개가 모두 다르고 남녀 5명씩", () => {
    expect(PERSONAS).toHaveLength(10)
    expect(new Set(prepared.map(({ x }) => x.facts.chart.dayMaster.stem)).size).toBe(10)
    expect(PERSONAS.filter((p) => p.birth.gender === "F")).toHaveLength(5)
  })

  it("expect 칸과 엔진 결과가 맞는다(일간·계절·윤달·서머타임·시각 모름·입춘 경계·극신강약)", () => {
    for (const { p, x } of prepared) {
      expect(x.facts.chart.dayMaster.stem, p.id).toBe(p.expect.dayStem)
      expect(x.season, p.id).toBe(p.expect.season)
      expect(x.chart.corrections.dstApplied, p.id).toBe(!!p.expect.dst)
      expect(!x.chart.hourKnown, p.id).toBe(!!p.expect.hourUnknown)
      expect(x.chart.lunarDate.isLeapMonth && p.birth.calendar === "lunar", p.id).toBe(!!p.expect.leapMonth)
      expect(x.chart.warnings.some((w) => w.includes("立春")), p.id).toBe(!!p.expect.ipchunBoundary)
      expect(x.flags.includes("극신강"), p.id).toBe(p.expect.extreme === "strong")
      expect(x.flags.includes("극신약"), p.id).toBe(p.expect.extreme === "weak")
      expect(x.facts.chart.strength, p.id).toBeDefined()
      expect(x.notes, p.id).toEqual([])
    }
    const count = (k: keyof (typeof PERSONAS)[number]["expect"]) => PERSONAS.filter((p) => p.expect[k]).length
    expect([count("hourUnknown"), count("leapMonth"), count("dst"), count("ipchunBoundary")]).toEqual([1, 1, 1, 1])
    expect(PERSONAS.filter((p) => p.expect.extreme === "strong")).toHaveLength(1)
    expect(PERSONAS.filter((p) => p.expect.extreme === "weak")).toHaveLength(1)
    const dst = PERSONAS.find((p) => p.expect.dst)!
    expect(dst.birth.year).toBe(1987)
  })

  it("나이 20대 초~60대, 계절 넷 모두", () => {
    const ages = prepared.map(({ x }) => x.facts.subject.ageYears)
    expect(Math.min(...ages)).toBeGreaterThanOrEqual(20)
    expect(Math.min(...ages)).toBeLessThanOrEqual(23)
    expect(Math.max(...ages)).toBeGreaterThanOrEqual(60)
    expect(Math.max(...ages)).toBeLessThan(70)
    expect(new Set(prepared.map(({ x }) => x.season))).toEqual(new Set(["봄", "여름", "가을", "겨울"]))
  })

  it("설문 예시 응답 3명 — 모두 검증 통과(빠진 응답 없음)하고 사실표 userFacts에 들어간다", () => {
    const withAnswers = prepared.filter(({ p }) => p.answers?.length)
    expect(withAnswers).toHaveLength(3)
    for (const { p, x } of withAnswers) expect(x.facts.personal.userFacts.length, p.id).toBeGreaterThanOrEqual(p.answers!.length)
  })

  it("인물에 이름 칸이 없고 호칭은 짧다", () => {
    for (const p of PERSONAS) {
      expect(Object.keys(p)).not.toContain("name")
      expect(p.addressAs.length).toBeLessThanOrEqual(8)
    }
  })

  it("--only 선택", () => {
    expect(selectPersonas("1,p05").map((p) => p.id)).toEqual(["p01", "p05"])
    expect(() => selectPersonas("11")).toThrow()
  })
})

describe("인자", () => {
  it("기본값: opus · 상한 5달러 · 비교 꺼짐", () => {
    const o = parseArgs([])
    expect(o).toMatchObject({ model: "claude-opus-5-5", budgetUsd: 5, compare: false, compareModel: "claude-sonnet-5-5" })
  })
  it("--only 1 --budget-usd 0.5 --compare", () => {
    expect(parseArgs(["--only", "1", "--budget-usd", "0.5", "--compare"])).toMatchObject({ only: "1", budgetUsd: 0.5, compare: true })
  })
  it("잘못된 값은 오류", () => {
    expect(() => parseArgs(["--model", "claude-opus-5-5-20261101"])).toThrow()
    expect(() => parseArgs(["--budget-usd", "0"])).toThrow()
    expect(() => parseArgs(["--budget-usd"])).toThrow()
    expect(() => parseArgs(["--only", "99"])).toThrow()
    expect(() => parseArgs(["--what"])).toThrow()
  })
})

describe("키 없음 · 장 명세 없음", () => {
  it("SAJU_ANTHROPIC_API_KEY가 없으면 안내만 하고 끝(상태 2) — 클라이언트를 만들지 않고 폴더도 만들지 않는다", async () => {
    const { d, logs, keysSeen } = deps({ env: { ANTHROPIC_API_KEY: SECRET } })
    const r = await runSamples(parseArgs(["--only", "1"]), d)
    expect(r.exitCode).toBe(2)
    expect(keysSeen).toEqual([])
    expect(readdirSync(d.samplesRoot!)).toEqual([])
    const text = logs.join("\n")
    expect(text).toContain(KEY_ENV)
    expect(text).toContain("새 세션")
    expect(text).not.toContain(SECRET)
  })

  it("공백뿐인 키도 없음으로 본다", async () => {
    const { d } = deps({ env: { [KEY_ENV]: "   " } })
    expect((await runSamples(parseArgs([]), d)).exitCode).toBe(2)
  })

  it("장 명세(prompts/index.ts)가 없으면 안내 후 끝(상태 3)", async () => {
    expect(await loadBasicChapters("/nonexistent/prompts/index.ts")).toHaveProperty("error")
    const { d, logs, fake } = deps({ loadChapters: async () => ({ error: "없음" }) })
    const r = await runSamples(parseArgs(["--only", "1"]), d)
    expect(r.exitCode).toBe(3)
    expect(fake.calls).toHaveLength(0)
    expect(logs.join("\n")).toContain("chaptersForProduct")
  })
})

describe("전체 흐름 1명(가짜 클라이언트)", async () => {
  const { d, logs, fake, keysSeen } = deps()
  const r = await runSamples(parseArgs(["--only", "1", "--budget-usd", "0.5"]), d)
  const dir = r.outDir!
  const rec = JSON.parse(readFileSync(join(dir, "p01.json"), "utf8")) as SampleRecord
  const html = readFileSync(join(dir, "index.html"), "utf8")
  const p01 = PERSONAS[0]

  it("상태 0, 2026-11-27 폴더에 p01.json·index.html·요약", () => {
    expect(r.exitCode).toBe(0)
    expect(dir.endsWith("2026-11-27")).toBe(true)
    expect(existsSync(join(dir, "index.html"))).toBe(true)
    expect(readdirSync(dir).some((f) => f.startsWith("summary-"))).toBe(true)
    expect(keysSeen).toEqual([SECRET])
  })

  it("기본 풀이 8장을 콘텐츠 작가 장 명세로 만들고, 장마다 검증 결과·사용량이 남는다", async () => {
    const loaded = await loadBasicChapters()
    if ("error" in loaded) throw new Error(loaded.error)
    expect(rec.chapters.map((c) => c.id)).toEqual(loaded.chapters.map((c) => c.id))
    expect(rec.chapters).toHaveLength(8)
    for (const c of rec.chapters) {
      expect(c.verdict, c.id).toBe("pass")
      expect(c.verify?.pass, c.id).toBe(true)
      expect(c.usage?.model).toBe("claude-opus-5-5")
      expect(c.drafts.length).toBeGreaterThanOrEqual(1)
    }
    expect(rec.events).toHaveLength(fake.calls.length)
    expect(rec.events.every((e) => typeof e.costUsdEstimate === "number" && e.model === "claude-opus-5-5")).toBe(true)
    const sum = rec.chapters.reduce((n, c) => n + (c.usage?.costUsdEstimate ?? 0), 0)
    expect(rec.totals.costUsdEstimate).toBeCloseTo(sum, 4)
    expect(r.calls.every((c) => c.result === "ok" && c.costUsdEstimate <= c.worstCaseUsd)).toBe(true)
  })

  it("사실표·요청에 실명·생년월일이 없다(호칭만)", () => {
    expect(rec.facts?.subject.addressAs).toBe("손주")
    for (const c of fake.calls) {
      const s = JSON.stringify(c.body)
      for (const b of birthStrings(p01)) expect(s).not.toContain(b)
      expect(s).not.toContain(SECRET)
    }
  })

  it("HTML·JSON·로그에 키가 없고, HTML에 생년월일이 없으며 '실존 아님'·검증 판정·장별 비용이 보인다", () => {
    const all = [html, ...readdirSync(dir).map((f) => readFileSync(join(dir, f), "utf8")), logs.join("\n")]
    for (const t of all) expect(t).not.toContain(SECRET)
    for (const b of birthStrings(p01)) expect(html).not.toContain(b)
    expect(html).toContain("실존 아님")
    expect(html).toContain("검증기 판정")
    expect(html).toContain("20대 초반")
    expect(html).toContain(rec.facts!.chart.pillars.day)
    expect(html).toMatch(/비용 \$\d+\.\d{4}/)
    expect(html).toContain('class="chip"')
    expect(html).not.toMatch(/<script/i)
  })

  it("요약 표에 인물별 통과/차단·총 토큰·비용·소요 시간", () => {
    const text = logs.join("\n")
    expect(text).toContain("=== 요약 ===")
    expect(text).toMatch(/p01\s+claude-opus-5-5\s+8\s+0\s+0/)
    expect(text).toMatch(/합계: 입력 [\d,]+ · 출력 [\d,]+ 토큰 · 추정 \$\d+\.\d{4}/)
    expect(r.rows[0]).toMatchObject({ persona: "p01", pass: 8, block: 0, failed: 0 })
  })
})

describe("비용 상한", () => {
  it("상한을 넘기 직전 호출을 보내지 않고 멈춘다 — 누적은 상한 이하, 남은 인물은 건너뜀(상태 4)", async () => {
    const { d, fake, logs } = deps()
    const budget = 0.12
    const r = await runSamples(parseArgs(["--only", "1,2", "--budget-usd", String(budget), "--concurrency", "1"]), d)
    expect(r.exitCode).toBe(4)
    expect(r.totalCostUsd).toBeLessThanOrEqual(budget)
    const blocked = r.calls.filter((c) => c.result === "budget_blocked")
    expect(blocked).toHaveLength(1)
    // 막힌 호출은 실제로 보내지 않았다
    expect(fake.calls).toHaveLength(r.calls.length - 1)
    expect(r.skipped).toEqual(["p02/claude-opus-5-5"])
    const rec = JSON.parse(readFileSync(join(r.outDir!, "p01.json"), "utf8")) as SampleRecord
    expect(rec.stopped).toBe("budget_exceeded")
    expect(rec.chapters.some((c) => c.verdict === "pass")).toBe(true)
    expect(rec.chapters.some((c) => c.verdict === "skipped")).toBe(true)
    expect(existsSync(join(r.outDir!, "p02.json"))).toBe(false)
    expect(logs.join("\n")).toContain("비용 상한")
  })

  it("최악 비용 추정은 실제 추정 비용 이상", () => {
    const body = { model: "claude-opus-5-5", max_tokens: 1000, system: [{ type: "text" as const, text: "가".repeat(3000) }], messages: [{ role: "user" as const, content: "나".repeat(1500) }] }
    const actual = estimateCostUsd("claude-opus-5-5", { inputTokens: 1500, outputTokens: 1000, cacheReadTokens: 0, cacheWriteTokens: 3000 })
    expect(worstCaseCostUsd(body)).toBeGreaterThanOrEqual(actual)
  })

  it("병렬 호출 중에는 진행 중 호출의 최악 비용까지 잡아 둔다", async () => {
    const g = new BudgetGuard(0.05)
    const c = g.wrap(createFakeClient({ delayMs: 20 }))
    const body = { model: "claude-opus-5-5", max_tokens: 1500, system: "s", messages: [{ role: "user" as const, content: "u" }] }
    const res = await Promise.allSettled([c.messages.create(body), c.messages.create(body)])
    expect(res.map((x) => x.status)).toEqual(["fulfilled", "rejected"])
    expect(g.exhausted).toBe(true)
  })
})

describe("비교 모델 · 실패한 장만 다시", () => {
  it("--compare: 비교 대상 인물은 sonnet으로도 만들어 따로 저장", async () => {
    const { d } = deps()
    const r = await runSamples(parseArgs(["--only", "5", "--compare"]), d)
    expect(r.exitCode).toBe(0)
    expect(readdirSync(r.outDir!).filter((f) => f.endsWith(".json")).sort()).toEqual(["p05.claude-sonnet-5-5.json", "p05.json"])
    const html = readFileSync(join(r.outDir!, "index.html"), "utf8")
    expect(html).toContain("claude-sonnet-5-5")
  })

  it("--retry-failed: 통과한 장은 그대로 두고 실패한 장만 다시 부른다", async () => {
    const fatal = Object.assign(new Error("bad request"), { status: 400, name: "BadRequestError" })
    const first = createFakeClient({ failOn: { 3: fatal } })
    const { d } = deps({ fake: first })
    const r1 = await runSamples(parseArgs(["--only", "1", "--concurrency", "1"]), d)
    expect(r1.rows[0]).toMatchObject({ pass: 7, failed: 1 })
    const second = createFakeClient()
    const r2 = await runSamples(parseArgs(["--only", "1", "--retry-failed", "--concurrency", "1"]), { ...d, makeClient: () => second })
    expect(second.calls).toHaveLength(1)
    expect(r2.rows[0]).toMatchObject({ pass: 8, failed: 0 })
    const rec = JSON.parse(readFileSync(join(r2.outDir!, "p01.json"), "utf8")) as SampleRecord
    expect(rec.cumulative.runs).toBe(2)
    expect(rec.cumulative.costUsdEstimate).toBeGreaterThan(rec.totals.costUsdEstimate)
  })
})

describe("HTML 안전", () => {
  it("본문은 이스케이프하고 <b>만 살린다", () => {
    const rec = {
      kind: "saju-sample", fictional: true, notice: "", sampleVersion: "x", fake: false,
      persona: { id: "p01", n: 1, label: "<i>x</i>", why: "", birth: PERSONAS[0].birth, ageBand: "20대 초반", gender: "F", season: "봄", flags: [] },
      model: "claude-opus-5-5", product: "BASIC", generatedAt: "", asOf: "", versions: { engine: "", rules: "", generator: "" }, notes: [],
      facts: null,
      chapters: [{ id: "nature", title: "장", ok: true, verdict: "pass", attempts: 1, output: { title: "t", body: ["<b>굵게</b> <script>alert(1)</script>"] }, drafts: [] }],
      events: [], totals: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsdEstimate: 0, calls: 0 },
      cumulative: { costUsdEstimate: 0, calls: 0, runs: 1 }, elapsedMs: 0,
    } as unknown as SampleRecord
    const html = renderIndexHtml([rec], { generatedAt: "now", folderLabel: "t" })
    expect(html).toContain("<b>굵게</b>")
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;")
    expect(html).not.toContain("<i>x</i>")
    expect(html).not.toContain(String(PERSONAS[0].birth.year))
    expect(esc(`"'<>&`)).toBe("&quot;&#39;&lt;&gt;&amp;")
  })

  it("키 가리기", () => {
    expect(makeRedactor(SECRET)(`x ${SECRET} y`)).toBe("x [가림] y")
    expect(makeRedactor(undefined)("x")).toBe("x")
  })
})
