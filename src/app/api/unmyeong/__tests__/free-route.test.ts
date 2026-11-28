import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { NextRequest } from "next/server"

// DB·AI·세션 모듈이 불리면 즉시 실패시킨다(무료 API는 이들을 쓰면 안 된다)
const touched: string[] = []
const trap = (name: string) => new Proxy({}, { get() { touched.push(name); throw new Error(`${name} 호출 금지`) } })
vi.mock("@/lib/prisma", () => ({ prisma: trap("prisma") }))
vi.mock("@/lib/session-user", () => ({ getSessionUser: () => { touched.push("session"); throw new Error("session") } }))
vi.mock("@anthropic-ai/sdk", () => ({ default: class { constructor() { touched.push("anthropic"); throw new Error("ai") } } }))

// 원형 연결 지점 — 기본은 실제 구현(null), 500 경로 시험 때만 바꾼다
const archetypeImpl = vi.hoisted(() => ({ throwWith: null as string | null }))
vi.mock("@/lib/unmyeong/archetype-link", async (orig) => {
  const real = await orig<typeof import("@/lib/unmyeong/archetype-link")>()
  return {
    resolveArchetype: (...a: Parameters<typeof real.resolveArchetype>) => {
      if (archetypeImpl.throwWith) throw new Error(archetypeImpl.throwWith)
      return real.resolveArchetype(...a)
    },
  }
})

import { POST } from "@/app/api/unmyeong/free/route"
import { resetRateLimit, FREE_RATE_LIMIT } from "@/app/api/free/_lib/rate-limit"
import { analyzeRules, yearPillarOf } from "@/engine"
import { buildSajuInputFromRequest } from "@/lib/saju-input"
import { chartFromSajuInput, stripUnusedFields, validateUnmyeongFreeRequest, buildUnmyeongFree } from "@/lib/unmyeong/free"
import { selectFreeChapters } from "@/lib/unmyeong/free-copy"
import type { UnmyeongArchetypeView, UnmyeongFreeResponse } from "@/lib/unmyeong/free-types"

const req = (body: unknown, ip = "1.1.1.1", raw?: string) =>
  new NextRequest("http://localhost/api/unmyeong/free", {
    method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: raw ?? JSON.stringify(body),
  })
const valid = { birthYear: 1990, birthMonth: 5, birthDay: 15, birthHour: null, gender: "F", calType: "SOLAR" }
const withHour = { birthYear: 1987, birthMonth: 11, birthDay: 3, birthHour: 14, birthMinute: 20, timeMode: "exact", gender: "M", calType: "SOLAR" }

let logs: string[] = []
beforeEach(() => {
  resetRateLimit()
  touched.length = 0
  archetypeImpl.throwWith = null
  logs = []
  for (const k of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, k).mockImplementation((...a: unknown[]) => { logs.push(a.map((x) => (x instanceof Error ? `${x.name}:${x.message}` : String(x))).join(" ")) })
  }
})
afterEach(() => vi.restoreAllMocks())

const FREE_COPY_EXISTS = fs.existsSync(path.join(process.cwd(), "content", "unmyeong", "free-copy.json"))

describe("POST /api/unmyeong/free — 보안 조건", () => {
  it("정상 입력은 200, DB·AI·세션을 건드리지 않고 캐시 금지", async () => {
    const res = await POST(req(valid))
    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect(touched).toEqual([])
  })

  it("이름은 받지 않는다: 보내도 버리고(형식이 틀려도 무시), 응답·로그 어디에도 없다", async () => {
    const res = await POST(req({ ...valid, name: "홍길동", otherName: "김철수", readingType: "BULLY", otherBirthYear: 1700 }))
    expect(res.status).toBe(200)
    const text = JSON.stringify(await res.json())
    expect(text).not.toContain("홍길동")
    expect(text).not.toContain("김철수")
    // 이름 칸의 형식 오류(숫자)도 검증 전에 버려진다
    expect((await POST(req({ ...valid, name: 12345 }))).status).toBe(200)
    expect(logs.join("\n")).not.toContain("홍길동")
    const v = validateUnmyeongFreeRequest({ ...valid, name: "홍길동" })
    expect(v.ok).toBe(true)
    if (v.ok) expect(Object.keys(v.value)).not.toContain("name")
    expect(Object.keys(stripUnusedFields({ ...valid, name: "x", readingType: "LOVE", otherGender: "M" }) as object).sort()).toEqual(Object.keys(valid).sort())
  })

  it("응답에 개인정보(이름·생년월일·성별·출생지·양력음력)가 없다", async () => {
    const j = await (await POST(req({ ...valid, birthplace: { name: "부산", longitude: 129.075 } }))).json()
    const text = JSON.stringify(j)
    for (const k of ["name", "birth", "gender", "birthplace", "birthYear", "calendar", "calType"]) expect(Object.keys(j)).not.toContain(k)
    expect(text).not.toContain("부산")
    expect(text).not.toContain("1990")
    expect(text).not.toMatch(/1990-05/)
  })

  it("검증 실패는 400, 존재하지 않는 날짜도 400", async () => {
    for (const bad of [{ ...valid, birthMonth: 13 }, { ...valid, gender: "X" }, { ...valid, birthYear: 1800 }, {}, "x", [1]]) {
      expect((await POST(req(bad))).status).toBe(400)
    }
    expect((await POST(req(null, "1.1.1.2", "{깨진"))).status).toBe(400)
    expect((await POST(req({ ...valid, birthMonth: 2, birthDay: 30 }))).status).toBe(400)
  })

  it("본문이 2KB를 넘으면 400", async () => {
    expect((await POST(req({ ...valid, pad: "가".repeat(1000) }))).status).toBe(400)
  })

  it("같은 IP 분당 제한 초과는 429(+Retry-After), 다른 IP는 통과", async () => {
    for (let i = 0; i < FREE_RATE_LIMIT; i++) expect((await POST(req(valid, "9.9.9.9"))).status).toBe(200)
    const over = await POST(req(valid, "9.9.9.9"))
    expect(over.status).toBe(429)
    expect(over.headers.get("retry-after")).toBeTruthy()
    expect((await POST(req(valid, "8.8.8.8"))).status).toBe(200)
  })

  it("계산 실패(500) 로그에는 오류 종류만 남고 입력값·메시지는 없다", async () => {
    archetypeImpl.throwWith = "secret 1990-05-15 홍길동"
    const res = await POST(req({ ...valid, name: "홍길동" }))
    expect(res.status).toBe(500)
    const all = logs.join("\n")
    expect(all).toContain("[/api/unmyeong/free]")
    expect(all).not.toContain("1990")
    expect(all).not.toContain("홍길동")
    expect(all).not.toContain("secret")
  })

  it("API·본체 소스는 DB·AI·세션 모듈을 가져오지 않는다", () => {
    const files = [
      ...fs.readdirSync(path.join(process.cwd(), "src/app/api/unmyeong/free")).map((f) => path.join("src/app/api/unmyeong/free", f)),
      ...fs.readdirSync(path.join(process.cwd(), "src/lib/unmyeong")).filter((f) => f.endsWith(".ts")).map((f) => path.join("src/lib/unmyeong", f)),
    ]
    for (const f of files) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf8")
      expect(src, f).not.toMatch(/from\s+["'](@\/lib\/prisma|@prisma\/client|@anthropic-ai\/sdk|@\/lib\/auth|@\/lib\/session-user|next-auth|@\/lib\/generate-reading[^"']*|@\/engine\/content\/generate)["']/)
    }
  })
})

describe("POST /api/unmyeong/free — 응답 모양", () => {
  it("원국·대운·올해·근거·원형(엔진 연결됨 → pending.archetype false)", async () => {
    const j = (await (await POST(req(valid))).json()) as UnmyeongFreeResponse
    expect(j.pillars.map((p) => p.key)).toEqual(["year", "month", "day"])
    expect(j.hourUnknown).toBe(true)
    expect(j.elements).toHaveLength(5)
    expect(j.dayMaster.hanja).toHaveLength(1)
    expect(Object.keys(j.dayMaster).sort()).toEqual(["element", "hanja", "ko"]) // 예전 nickname(문안 준비 중) 없음
    expect(j.daeun.items.length).toBeGreaterThan(0)
    expect(j.thisYear.ganzhi.hanja).toHaveLength(2)
    expect(j.archetype).not.toBeNull()
    expect(j.pending.archetype).toBe(false)
    if (!FREE_COPY_EXISTS) {
      expect(j.chapters).toBeNull()
      expect(j.pending.chapters).toBe(true)
    }
    expect(j.engineVersion).toMatch(/calendar@.*\+rules@/)
    expect(Array.isArray(j.warnings)).toBe(true)
    expect(Object.keys(j)).not.toContain("copy")
  })

  it("근거(basis)는 규칙 엔진 값 그대로, 쉬운 말 + 한자 한글 병기", async () => {
    const j = (await (await POST(req(withHour))).json()) as UnmyeongFreeResponse
    expect(j.pillars).toHaveLength(4)
    const b = j.basis
    // 같은 입력으로 규칙 엔진을 직접 돌려 대조
    const v = validateUnmyeongFreeRequest(withHour)
    if (!v.ok) throw new Error(v.error)
    const s = buildSajuInputFromRequest(v.value)
    const chart = chartFromSajuInput(s, v.value.gender)
    const rules = analyzeRules(chart, undefined, { luck: chart.luck.daeun.map((d) => d.pillar), year: yearPillarOf(s.this_year) })
    expect(b.rulesVersion).toBe(rules.engineVersion)
    expect(b.dayMaster.char).toBe(rules.dayMaster.stem)
    expect(b.dayMaster.label).toEqual({ ko: "일간", hanja: "日干", plain: expect.any(String) })

    // 십성: 겉 글자 7개(일간 제외), 자리·십성이 엔진과 같다
    const surface = rules.tenGods.filter((h) => !h.viaHiddenStem && ["year", "month", "day", "hour"].includes(h.position.pillar))
    expect(b.tenGods.positions).toHaveLength(7)
    expect(b.tenGods.positions.map((p) => [p.pillar, p.part, p.char, p.tenGod.ko])).toEqual(surface.map((h) => [h.position.pillar, h.position.part, h.char, h.tenGod]))
    for (const p of b.tenGods.positions) {
      expect(p.tenGod.hanja).toMatch(/^[一-鿿]{2}$/)
      expect(p.tenGod.plain.length).toBeGreaterThan(2)
      expect(p.charKo).toMatch(/^[가-힣]$/)
    }
    expect(b.tenGods.groups.map((g) => g.ko)).toEqual(["비겁", "인성", "식상", "재성", "관성"])
    const shareSum = b.tenGods.groups.reduce((a, g) => a + g.share, 0)
    expect(Math.abs(shareSum - 1)).toBeLessThan(0.01)

    // 오행
    expect(b.elements.items.map((e) => `${e.ko}${e.hanja}`)).toEqual(["목木", "화火", "토土", "금金", "수水"])
    expect(b.elements.items.map((e) => e.count)).toEqual(["wood", "fire", "earth", "metal", "water"].map((e) => rules.elements.counts[e as "wood"]))

    // 신강약: 대표 모형 판정 그대로
    const primary = rules.strength.models.find((m) => m.model === rules.strength.primary)!
    expect(b.strength.verdict).toBe(primary.verdict)
    expect(b.strength.label.hanja).toMatch(/^(身强|中和|身弱)$/)
    expect(b.strength.models).toHaveLength(3)
    expect(b.strength.sensitive).toBe(b.strength.notes.length > 0)

    // 격국: 주 후보(특수격 제외)
    const main = rules.structure.candidates.find((c) => c.role === "primary" && c.kind !== "special")
    expect(b.structure?.name ?? null).toBe(main?.name ?? null)
    if (b.structure) expect(b.structure.label.hanja).toMatch(/格$/)

    // 용신: 관점별 병기, 특수격 관점 없음, 머리말은 사실표와 같은 고정 문구
    expect(b.usefulGods.length).toBeGreaterThan(0)
    expect(b.usefulGods.some((u) => u.method === "special")).toBe(false)
    for (const u of b.usefulGods) {
      expect(u.header).toMatch(/로 보면/)
      expect(u.element.hanja).toMatch(/^[木火土金水]$/)
    }
    expect(b.caveats.length).toBeGreaterThan(0)
  })

  it("시각 모름이면 시주 십성이 없다(겉 글자 5개)", async () => {
    const j = (await (await POST(req(valid))).json()) as UnmyeongFreeResponse
    expect(j.basis.tenGods.positions.some((p) => p.pillar === "hour")).toBe(false)
    expect(j.basis.tenGods.positions).toHaveLength(5)
  })

  it("음력 입력도 계산되고, 같은 입력은 같은 결과(결정론)", async () => {
    const lunar = { ...withHour, calType: "LUNAR", birthMonth: 9, birthDay: 12 }
    const a = await (await POST(req(lunar))).json()
    const b = await (await POST(req(lunar, "2.2.2.2"))).json()
    expect(a).toEqual(b)
    const now = new Date("2026-06-01T00:00:00Z")
    const v = validateUnmyeongFreeRequest(lunar)
    if (!v.ok) throw new Error(v.error)
    expect(buildUnmyeongFree(v.value, { now, freeCopy: null }).thisYear.year).toBe(2026)
  })
})

describe("무료 5장 문안 고르기(version 2)", () => {
  const keys = ["being", "symbol", "gift", "shadow", "counsel"]
  const copy = {
    version: 2,
    hourNote: { chapter: 1, text: "시각 안내." },
    bridgeFallback: { replace: "다리는 {bridge}의 기운이다.", with: "다리가 될 기운 하나를 고르거라." },
    chapters: keys.map((key, i) => ({ no: i + 1, key, title: `제${i + 1}장`, default: null as string | null, byArchetype: { bonghwang: `봉황 ${key}`, "moon-goddess": i === 4 ? "달 앞. 다리는 {bridge}의 기운이다. 달 뒤." : `달 ${key}` } })),
  }
  const arch: UnmyeongArchetypeView = {
    id: "bonghwang", name: "봉황", category: "divineBeast", order: 5, secondary: null, secondaryName: null, variantTags: [], matched: [],
    stability: { nearBoundary: false, tableSensitive: false, hourSensitive: null }, hourUnknownNote: false,
    disclaimer: "creative-symbol", disclaimerText: "창작 상징", version: "archetype@0.1.0",
  }
  const moon: UnmyeongArchetypeView = { ...arch, id: "moon-goddess", name: "달의 여신", category: "divineHuman", order: 4 }

  it("파일이 없으면 null", () => {
    expect(selectFreeChapters(null, null)).toBeNull()
    expect(selectFreeChapters(undefined, arch)).toBeNull()
  })
  it("원형이 있으면 원형 문안, 장 번호 = 키 순서", () => {
    expect(selectFreeChapters(copy, arch)?.map((c) => [c.no, c.key, c.text])).toEqual(keys.map((k, i) => [i + 1, k, `봉황 ${k}`]))
  })
  it("default가 null이면 원형이 없을 때 전체 null(준비 중)", () => {
    expect(selectFreeChapters(copy, null)).toBeNull()
    const withDefault = { ...copy, chapters: copy.chapters.map((c) => ({ ...c, default: `기본 ${c.key}` })) }
    expect(selectFreeChapters(withDefault, null)?.map((c) => c.text)).toEqual(keys.map((k) => `기본 ${k}`))
  })
  it("{bridge}: 통관 오행을 물·나무·불·흙·쇠로, 값이 없으면 대체 문장으로 통째로", () => {
    expect(selectFreeChapters(copy, { ...moon, variantTags: ["수↔화·목으로 이음"] })?.[4].text).toBe("달 앞. 다리는 나무의 기운이다. 달 뒤.")
    expect(selectFreeChapters(copy, { ...moon, variantTags: ["금↔목·수로 이음"] })?.[4].text).toBe("달 앞. 다리는 물의 기운이다. 달 뒤.")
    expect(selectFreeChapters(copy, { ...moon, bridge: "금" as const, variantTags: ["수↔화·목으로 이음"] })?.[4].text).toBe("달 앞. 다리는 쇠의 기운이다. 달 뒤.")
    expect(selectFreeChapters(copy, moon)?.[4].text).toBe("달 앞. 다리가 될 기운 하나를 고르거라. 달 뒤.")
    // 대체 문장이 없으면 날 토큰을 내지 않는다 → 전체 null
    expect(selectFreeChapters({ ...copy, bridgeFallback: undefined }, moon)).toBeNull()
  })
  it("hourNote: 시각 모름이면 원형·민감도와 관계없이 1장 끝에 붙는다(D-030), 시각을 알면 없다", () => {
    const r = selectFreeChapters(copy, arch, { hourUnknown: true })
    expect(r?.[0].text).toBe("봉황 being 시각 안내.")
    expect(r?.slice(1).every((c) => !c.text.includes("시각 안내"))).toBe(true)
    expect(selectFreeChapters(copy, arch, { hourUnknown: false })?.[0].text).toBe("봉황 being")
  })
  it("{name} 같은 다른 토큰이 든 본문은 쓰지 않는다", () => {
    const named = { ...copy, chapters: copy.chapters.map((c, i) => (i === 1 ? { ...c, byArchetype: { bonghwang: "{name}아, 봉황이다." } } : c)) }
    expect(selectFreeChapters(named, arch)).toBeNull()
  })
  it("한 장이라도 고를 본문이 없거나 형식·순서가 다르면 전체 null", () => {
    const partial = { ...copy, chapters: copy.chapters.map((c, i) => (i === 2 ? { ...c, byArchetype: {} } : c)) }
    expect(selectFreeChapters(partial, arch)).toBeNull()
    expect(selectFreeChapters({ ...copy, chapters: copy.chapters.slice(0, 4) }, arch)).toBeNull()
    expect(selectFreeChapters({ foo: 1 }, arch)).toBeNull()
    expect(selectFreeChapters({ ...copy, chapters: copy.chapters.map((c) => ({ ...c, no: 9 })) }, arch)).toBeNull()
    expect(selectFreeChapters({ ...copy, chapters: [...copy.chapters].reverse() }, arch)).toBeNull()
    const swapped = copy.chapters.map((c, i) => (i === 0 ? { ...c, key: "symbol" } : i === 1 ? { ...c, key: "being" } : c))
    expect(selectFreeChapters({ ...copy, chapters: swapped }, arch)).toBeNull()
    const oldKeys = { ...copy, chapters: ["being", "gift", "reason", "chart", "unfolding"].map((key, i) => ({ ...copy.chapters[i], key })) }
    expect(selectFreeChapters(oldKeys, arch)).toBeNull()
    expect(selectFreeChapters({ ...copy, hourNote: { chapter: 7, text: "x" } }, arch)).toBeNull()
  })
  it("응답 본체: 그 원형 문안이 없고 default도 null이면 chapters null, 있으면 조립기(compose.ts)가 5장을 만들고 시각 모름 안내가 1장 끝에 붙는다", () => {
    const v = validateUnmyeongFreeRequest(valid)
    if (!v.ok) throw new Error(v.error)
    const empty = { ...copy, chapters: copy.chapters.map((c) => ({ ...c, byArchetype: {} })) }
    const none = buildUnmyeongFree(v.value, { freeCopy: empty })
    expect(none.archetype).not.toBeNull()
    expect(none.chapters).toBeNull()
    expect(none.pending).toEqual({ archetype: false, chapters: true })
    const withDefault = { ...empty, chapters: empty.chapters.map((c) => ({ ...c, default: `기본 ${c.key}` })) }
    const r = buildUnmyeongFree(v.value, { freeCopy: withDefault })
    expect(r.hourUnknown).toBe(true)
    expect(r.chapters?.map((c) => c.key)).toEqual(keys)
    // 1장: 일주 글자로 시작(조립), 끝에 시각 안내. 2장은 원형 본문(여기선 default) 그대로
    expect(r.chapters?.[0].text).toContain(`${r.dayPillar.ko}(${r.dayPillar.hanja})일에 났구나.`)
    expect(r.chapters?.[0].text.endsWith("시각 안내.")).toBe(true)
    expect(r.chapters?.[1].text).toBe("기본 symbol")
    expect(r.chapters?.slice(1).every((c) => !c.text.includes("시각 안내"))).toBe(true)
    expect(r.pending).toEqual({ archetype: false, chapters: false })
  })
})
