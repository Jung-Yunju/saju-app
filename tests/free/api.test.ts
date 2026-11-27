import { beforeEach, describe, expect, it, vi } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { NextRequest } from "next/server"

// DB·AI·세션 모듈이 불리면 즉시 실패시킨다(무료 API는 이들을 쓰면 안 된다)
const touched: string[] = []
const trap = (name: string) => new Proxy({}, { get() { touched.push(name); throw new Error(`${name} 호출 금지`) } })
vi.mock("@/lib/prisma", () => ({ prisma: trap("prisma") }))
vi.mock("@/lib/session-user", () => ({ getSessionUser: () => { touched.push("session"); throw new Error("session") } }))
vi.mock("@anthropic-ai/sdk", () => ({ default: class { constructor() { touched.push("anthropic"); throw new Error("ai") } } }))

import { POST } from "@/app/api/free/route"
import { resetRateLimit, checkRateLimit, FREE_RATE_LIMIT } from "@/app/api/free/_lib/rate-limit"

const req = (body: unknown, ip = "1.1.1.1", raw?: string) =>
  new NextRequest("http://localhost/api/free", {
    method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: raw ?? JSON.stringify(body),
  })
const valid = { birthYear: 1990, birthMonth: 5, birthDay: 15, birthHour: null, gender: "F", calType: "SOLAR", name: "홍길동" }

beforeEach(() => { resetRateLimit(); touched.length = 0 })

describe("POST /api/free", () => {
  it("정상 입력은 200과 원국·오행·대운·올해·경고를 돌려준다", async () => {
    const res = await POST(req(valid))
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.pillars.map((p: { key: string }) => p.key)).toEqual(["year", "month", "day"])
    expect(j.hourUnknown).toBe(true)
    expect(j.elements).toHaveLength(5)
    expect(j.daeun.items.length).toBeGreaterThan(0)
    expect(j.daeun.items.filter((d: { current: boolean }) => d.current).length).toBeLessThanOrEqual(1)
    expect(j.thisYear.ganzhi.hanja).toHaveLength(2)
    expect(Array.isArray(j.warnings)).toBe(true)
    expect(touched).toEqual([])
  })

  it("응답에 개인정보(이름·생년월일·성별·출생지)가 없다", async () => {
    const j = await (await POST(req(valid))).json()
    const text = JSON.stringify(j)
    for (const k of ["name", "birth", "gender", "birthplace", "birthYear", "calendar"]) expect(Object.keys(j)).not.toContain(k)
    expect(text).not.toContain("홍길동")
    expect(text).not.toContain("1990")
    expect(text).not.toMatch(/1990-05/)
  })

  it("검증 실패는 400", async () => {
    for (const bad of [{ ...valid, birthMonth: 13 }, { ...valid, gender: "X" }, { ...valid, birthYear: 1800 }, {}, "x"]) {
      expect((await POST(req(bad))).status).toBe(400)
    }
    expect((await POST(req(null, "1.1.1.2", "{깨진"))).status).toBe(400)
  })

  it("존재하지 않는 날짜(2월 30일)는 400", async () => {
    expect((await POST(req({ ...valid, birthMonth: 2, birthDay: 30 }))).status).toBe(400)
  })

  it("요청이 너무 크면 400", async () => {
    expect((await POST(req({ ...valid, name: "가".repeat(5000) }))).status).toBe(400)
  })

  it("같은 IP 분당 제한 초과는 429(+Retry-After), 다른 IP는 통과", async () => {
    for (let i = 0; i < FREE_RATE_LIMIT; i++) expect((await POST(req(valid, "9.9.9.9"))).status).toBe(200)
    const over = await POST(req(valid, "9.9.9.9"))
    expect(over.status).toBe(429)
    expect(over.headers.get("retry-after")).toBeTruthy()
    expect((await POST(req(valid, "8.8.8.8"))).status).toBe(200)
  })

  it("제한 창이 지나면 다시 허용", () => {
    const t = 1_000_000
    for (let i = 0; i < FREE_RATE_LIMIT; i++) checkRateLimit("z", t)
    expect(checkRateLimit("z", t + 1000).ok).toBe(false)
    expect(checkRateLimit("z", t + 61_000).ok).toBe(true)
  })

  it("무료 API 소스는 DB·AI·세션 모듈을 가져오지 않는다", () => {
    const dir = path.join(process.cwd(), "src/app/api/free")
    const files = [path.join(dir, "route.ts"), ...fs.readdirSync(path.join(dir, "_lib")).map((f) => path.join(dir, "_lib", f))]
    for (const f of files) {
      const src = fs.readFileSync(f, "utf8")
      expect(src, f).not.toMatch(/from\s+["'][^"']*(prisma|anthropic|session-user|generate-reading|auth)[^"']*["']/)
    }
  })
})
