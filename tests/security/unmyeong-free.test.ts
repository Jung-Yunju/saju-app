// 품질검증 독립 검증 — POST /api/unmyeong/free (운명비서 무료 결과), 자산 목록 대체 그림, 유료 5권 설정 가격 칸 거부.
// 작성: 품질검증 담당자. 개발자 테스트(src/app/api/unmyeong/__tests__)와 별도로, 공개 경계(라우트 POST·공개 모듈 함수)만 두드린다.
// 근거(basis) 대조는 두 갈래: (가) 품질검증이 직접 만든 십성·오행 표(엔진 코드 미사용)로 응답 원국을 다시 셈,
// (나) 요청 정리·saju-input을 거치지 않고 computeChart → analyzeRules를 직접 돌린 값과 비교.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { NextRequest } from "next/server"

// DB·AI·세션·로그인 모듈이 불리면 기록하고 실패시킨다
const touched: string[] = []
const trap = (name: string) => new Proxy({}, { get() { touched.push(name); throw new Error(`${name} 호출 금지`) } })
vi.mock("@/lib/prisma", () => ({ prisma: trap("prisma") }))
vi.mock("@/lib/session-user", () => ({ getSessionUser: () => { touched.push("session"); throw new Error("session") } }))
vi.mock("@/lib/auth", () => ({ auth: () => { touched.push("auth"); throw new Error("auth") } }))
vi.mock("@anthropic-ai/sdk", () => ({ default: class { constructor() { touched.push("anthropic"); throw new Error("ai") } } }))

// 500 경로 시험용: 원형 연결 지점에서 입력값이 섞인 메시지로 예외를 던지게 한다(기본은 실제 구현)
const fault = vi.hoisted(() => ({ msg: null as string | null }))
vi.mock("@/lib/unmyeong/archetype-link", async (orig) => {
  const real = await orig<typeof import("@/lib/unmyeong/archetype-link")>()
  return {
    resolveArchetype: (...a: Parameters<typeof real.resolveArchetype>) => {
      if (fault.msg) throw new TypeError(fault.msg)
      return real.resolveArchetype(...a)
    },
  }
})

import { POST } from "@/app/api/unmyeong/free/route"
import { POST as freePOST } from "@/app/api/free/route"
import { resetRateLimit, FREE_RATE_LIMIT, FREE_RATE_WINDOW_MS } from "@/app/api/free/_lib/rate-limit"
import { analyzeRules, computeChart, yearPillarOf } from "@/engine"
import type { UnmyeongFreeResponse } from "@/lib/unmyeong/free-types"
import { FALLBACK_IMAGE, UNMYEONG_ASSETS, archetypeAssets, illustrationFor, listImageAssets, listVideoFiles } from "@/lib/unmyeong/assets"
import { validateVolumesConfig, UNMYEONG_VOLUMES } from "@/lib/unmyeong/volumes"
import rawVolumes from "../../content/unmyeong/volumes.json"

const URL_ = "http://localhost/api/unmyeong/free"
const post = (body: unknown, ip = "10.0.0.1", raw?: string) =>
  POST(new NextRequest(URL_, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: raw ?? JSON.stringify(body) }))
const json = async (r: Response) => (await r.json()) as UnmyeongFreeResponse

const BASE = { birthYear: 1984, birthMonth: 7, birthDay: 21, birthHour: 13, birthMinute: 47, timeMode: "exact", gender: "F", calType: "SOLAR" }

let logs: string[] = []
let fetchCalls = 0
beforeEach(() => {
  resetRateLimit()
  touched.length = 0
  fault.msg = null
  logs = []
  fetchCalls = 0
  for (const k of ["log", "info", "warn", "error", "debug", "trace"] as const) {
    vi.spyOn(console, k).mockImplementation((...a: unknown[]) => {
      logs.push(a.map((x) => (x instanceof Error ? `${x.name}:${x.message}:${x.stack ?? ""}` : typeof x === "object" ? JSON.stringify(x) : String(x))).join(" "))
    })
  }
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => { fetchCalls++; throw new Error("외부 요청 금지") })
})
afterEach(() => vi.restoreAllMocks())

// ─────────────────────────────────────────── 1. 공격 입력

describe("공격 입력 — 경도·숫자 형식·윤달", () => {
  it("출생지 경도: 범위 밖·문자열·Infinity(1e400)·음수·누락·배열·객체 → 400", async () => {
    const bad: string[] = [
      '{"longitude":123.999,"name":"x"}', '{"longitude":132.001,"name":"x"}', '{"longitude":"129","name":"x"}',
      '{"longitude":1e400,"name":"x"}', '{"longitude":-1e400,"name":"x"}', '{"longitude":-129,"name":"x"}',
      '{"name":"x"}', '{"longitude":129}', '{"longitude":129,"name":""}', '[129]', '"부산"', '129', 'true',
      '{"longitude":{"valueOf":129},"name":"x"}', '{"longitude":null,"name":"x"}',
    ]
    for (const bp of bad) {
      const raw = JSON.stringify(BASE).replace(/}$/, `,"birthplace":${bp}}`)
      const r = await post(null, `10.1.0.${bad.indexOf(bp)}`, raw)
      expect(r.status, bp).toBe(400)
    }
    expect(touched).toEqual([])
  })

  it("출생지 경도: 경계값 124·132는 통과, 소수점 넷째 자리 이하는 응답에 안 실린다", async () => {
    for (const lon of [124, 132, 126.97812345]) {
      const r = await post({ ...BASE, birthplace: { name: "테스트시", longitude: lon } }, `10.2.0.${lon}`)
      expect(r.status, String(lon)).toBe(200)
      const t = JSON.stringify(await r.json())
      expect(t).not.toContain("테스트시")
      expect(t).not.toContain(String(lon))
    }
  })

  it("숫자 형식: 소수·지수·16진·부호·공백 섞인 기호·불리언·배열·객체·과대 정수 → 400", async () => {
    const patches: Record<string, unknown>[] = [
      { birthYear: 1984.5 }, { birthYear: "1984.0" }, { birthYear: "1e3" }, { birthYear: "0x7C0" }, { birthYear: "+1984" },
      { birthYear: "-1984" }, { birthYear: "１９８４" }, { birthYear: "١٩٨٤" }, { birthYear: true }, { birthYear: [1984] }, { birthYear: { a: 1 } },
      { birthYear: 1e21 }, { birthYear: Number.MAX_SAFE_INTEGER + 2 }, { birthYear: 1899 }, { birthYear: 2101 },
      { birthMonth: 0 }, { birthMonth: 13 }, { birthMonth: "7 " + "x" }, { birthDay: 0 }, { birthDay: 32 }, { birthDay: 2.5 },
      { birthHour: 24 }, { birthHour: -1 }, { birthHour: 13.5 }, { birthHour: "13; DROP" },
      { birthMinute: 60 }, { birthMinute: -1 }, { birthMinute: 30.5 }, { birthMinute: "3e1" },
      { gender: "female" }, { gender: ["F"] }, { calType: "lunar" }, { calType: "MARS" }, { timeMode: "EXACT" }, { ziNight: "true" },
    ]
    for (const [i, p] of patches.entries()) {
      expect((await post({ ...BASE, ...p }, `10.3.${i}.1`)).status, JSON.stringify(p)).toBe(400)
    }
    // 앞뒤 공백 있는 숫자 문자열은 기존 검증이 받아 준다(정수로 바뀜) — 형식만 다르고 값은 같다
    expect((await post({ ...BASE, birthYear: " 1984 " }, "10.3.200.1")).status).toBe(200)
  })

  it("존재하지 않는 날짜(양력 2월 30일·평년 2월 29일·4월 31일) → 400", async () => {
    for (const [m, d, y] of [[2, 30, 1984], [2, 29, 1983], [4, 31, 1984], [2, 29, 1900]]) {
      expect((await post({ ...BASE, birthYear: y, birthMonth: m, birthDay: d }, `10.4.${m}.${d}`)).status, `${y}-${m}-${d}`).toBe(400)
    }
    expect((await post({ ...BASE, birthYear: 2000, birthMonth: 2, birthDay: 29 }, "10.4.9.9")).status).toBe(200) // 2000년은 윤년
  })

  it("윤달: 양력+윤달·문자열 윤달 → 400, 그 해에 없는 윤달 → 400(500 아님), 있는 윤달 → 200·평달과 다른 원국", async () => {
    expect((await post({ ...BASE, isLeapMonth: true }, "10.5.0.1")).status).toBe(400)
    expect((await post({ ...BASE, calType: "LUNAR", birthMonth: 6, birthDay: 1, isLeapMonth: "true" }, "10.5.0.2")).status).toBe(400)
    // 1984년(甲子) 음력 윤달은 10월 — 윤6월은 없다(KASI 음양력 변환 기준: 1984 윤10월)
    expect((await post({ ...BASE, calType: "LUNAR", birthMonth: 6, birthDay: 1, isLeapMonth: true }, "10.5.0.3")).status).toBe(400)
    const leap = await post({ ...BASE, calType: "LUNAR", birthMonth: 10, birthDay: 5, isLeapMonth: true }, "10.5.0.4")
    const plain = await post({ ...BASE, calType: "LUNAR", birthMonth: 10, birthDay: 5, isLeapMonth: false }, "10.5.0.5")
    expect(leap.status).toBe(200)
    expect(plain.status).toBe(200)
    expect((await json(leap)).pillars).not.toEqual((await json(plain)).pillars)
    // 음력 30일이 없는 달(29일 달) — 400. 31일은 검증 단계에서 400
    expect((await post({ ...BASE, calType: "LUNAR", birthMonth: 1, birthDay: 31 }, "10.5.0.6")).status).toBe(400)
    expect(logs).toEqual([])
  })
})

describe("공격 입력 — 본문 크기·스트림·JSON 형태", () => {
  const LIMIT = 2 * 1024

  it("2KB 초과 본문 → 400, 2KB 안이면 계산", async () => {
    const base = JSON.stringify({ ...BASE, pad: "" })
    const fill = (n: number) => base.replace('"pad":""', `"pad":"${"a".repeat(n - base.length)}"`)
    expect(new TextEncoder().encode(fill(LIMIT)).length).toBe(LIMIT)
    expect((await post(null, "10.6.0.1", fill(LIMIT))).status).toBe(200)
    expect((await post(null, "10.6.0.2", fill(LIMIT + 1))).status).toBe(400)
    // 다바이트 문자: 글자 수가 아니라 바이트로 잰다(한글 700자 ≈ 2100바이트)
    expect((await post({ ...BASE, pad: "가".repeat(700) }, "10.6.0.3")).status).toBe(400)
  })

  it("Content-Length를 작게 속여도, 헤더 없이 조각 스트림으로 보내도 실제 바이트로 잘린다", async () => {
    const big = new TextEncoder().encode(JSON.stringify({ ...BASE, pad: "x".repeat(5000) }))
    const lie = new NextRequest(URL_, { method: "POST", body: big, headers: { "content-length": "10", "x-forwarded-for": "10.7.0.1" } })
    expect((await POST(lie)).status).toBe(400)
    const stream = new ReadableStream<Uint8Array>({ start(c) { for (let i = 0; i < big.length; i += 300) c.enqueue(big.slice(i, i + 300)); c.close() } })
    expect((await POST(new NextRequest(URL_, { method: "POST", body: stream, duplex: "half", headers: { "x-forwarded-for": "10.7.0.2" } } as never))).status).toBe(400)
  })

  it("끝나지 않는 스트림: 한도를 넘는 즉시 읽기를 멈춘다(무한 대기·메모리 증가 없음)", async () => {
    let pulled = 0
    const chunk = new TextEncoder().encode('{"a":"' + "x".repeat(250))
    const endless = new ReadableStream<Uint8Array>({ pull(c) { pulled += chunk.length; c.enqueue(chunk) } }, { highWaterMark: 0 })
    const t = Date.now()
    const r = await POST(new NextRequest(URL_, { method: "POST", body: endless, duplex: "half", headers: { "x-forwarded-for": "10.8.0.1" } } as never))
    expect(r.status).toBe(400)
    expect(Date.now() - t).toBeLessThan(2000)
    expect(pulled).toBeLessThanOrEqual(LIMIT + chunk.length * 3)
  })

  it("깨진 UTF-8·JSON 아님·배열·null·문자열·숫자·빈 본문 → 400", async () => {
    const bodies: (string | Uint8Array<ArrayBuffer>)[] = [new Uint8Array([0x7b, 0xc3, 0x28, 0x7d]), "{", "not json", "[]", "null", '"x"', "1", ""]
    for (const [i, b] of bodies.entries()) {
      const r = await POST(new NextRequest(URL_, { method: "POST", body: b, headers: { "x-forwarded-for": `10.9.0.${i}` } }))
      expect(r.status, String(i)).toBe(400)
    }
  })

  it("__proto__·constructor·prototype 키: 전역 Object.prototype을 오염시키지 않고 응답에 새지 않는다", async () => {
    const baseRaw = JSON.stringify(BASE).slice(0, -1)
    const raws = [
      `${baseRaw},"__proto__":{"polluted":"yes","isAdmin":true}}`,
      `${baseRaw},"constructor":{"prototype":{"polluted":"yes"}}}`,
      `${baseRaw},"birthplace":{"name":"x","longitude":129,"__proto__":{"polluted":"yes"}}}`,
      `{"__proto__":{"birthYear":1984,"polluted":"yes"},"birthMonth":7,"birthDay":21,"birthHour":13,"gender":"F"}`,
    ]
    for (const [i, raw] of raws.entries()) {
      const r = await post(null, `10.10.0.${i}`, raw)
      expect([200, 400], raw).toContain(r.status)
      expect(JSON.stringify(await r.json())).not.toMatch(/polluted|isAdmin/)
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, "polluted")).toBe(false)
    expect(({} as Record<string, unknown>).isAdmin).toBeUndefined()
  })

  // [결함 QA-UM-1, 낮음] 종결 2026-11-28 — 백엔드가 stripUnusedFields에서 위험 키를 건너뛰게 고침(총괄실장이 it.fails → it 전환, 품질검증 추후 확인)
  it("[결함 QA-UM-1] __proto__ 안에 넣은 이름·풀이 종류·상대방 칸도 '무시'되어야 한다(평범한 요청과 같은 결과)", async () => {
    // 의도한 동작: 버려지는 칸을 어떤 모양으로 보내도 결과가 그 칸 없이 보낸 것과 같다.
    const plain = await json(await post(BASE, "10.11.0.1"))
    const baseRaw = JSON.stringify(BASE).slice(0, -1)
    const r = await post(null, "10.11.0.2", `${baseRaw},"__proto__":{"readingType":"BULLY","otherBirthYear":1700,"name":12345}}`)
    expect(r.status).toBe(200)
    expect(await json(r)).toEqual(plain)
  })
})

// ─────────────────────────────────────────── 2. 이름·other* 무시, 개인정보·로그·헤더

describe("이름·상대방 칸 무시, 응답·로그 개인정보 0", () => {
  it("name·readingType·other* 어떤 값이든(형식 오류 포함) 결과는 그 칸 없이 보낸 것과 완전히 같다", async () => {
    const plain = await json(await post(BASE, "10.12.0.1"))
    const noise = [
      { name: "김민지" }, { name: 12345 }, { name: "가".repeat(500) }, { name: { first: "x" } }, { name: "<script>alert(1)</script>" },
      { readingType: "BULLY", otherBirthYear: 1700, otherGender: "X", otherName: ["a"] },
      { readingType: "CONFLICT", otherBirthYear: 1990, otherBirthMonth: 2, otherBirthDay: 30, otherGender: "M" },
      { readingType: "ADMIN" }, { readingType: "__proto__" }, { otherBirthplace: { name: "x", longitude: 999 } }, { other: { year: 1 } },
    ]
    for (const [i, n] of noise.entries()) {
      const r = await post({ ...BASE, ...n }, `10.12.1.${i}`)
      expect(r.status, JSON.stringify(n)).toBe(200)
      expect(await json(r), JSON.stringify(n)).toEqual(plain)
    }
  })

  it("응답 최상위 키는 계약 목록뿐(입력 칸 이름 없음), 본문에 이름·생년월일·출생지 문자열이 없다(경고 칸 제외 — 관찰 참고)", async () => {
    const r = await post({ ...BASE, name: "김민지", birthplace: { name: "울릉군", longitude: 130.905 } }, "10.13.0.1")
    const j = await json(r)
    expect(Object.keys(j).sort()).toEqual(
      ["archetype", "basis", "chapters", "daeun", "dayMaster", "dayPillar", "elements", "engineVersion", "hourUnknown", "pending", "pillars", "thisYear", "warnings"].sort(),
    )
    const { warnings, ...rest } = j
    const text = JSON.stringify(rest)
    for (const s of ["김민지", "울릉군", "130.905", "1984-07-21", "1984-7-21", "13:47", '"F"', "양력", "SOLAR", "birth", "gender", "calType", "longitude"]) {
      expect(text, s).not.toContain(s)
    }
    const all = JSON.stringify(j)
    expect(all).not.toContain("김민지")
    expect(all).not.toContain("울릉군")
    expect(Array.isArray(warnings)).toBe(true)
  })

  it("성공·400·429·500 어느 경로든 로그에 입력값(이름·날짜·출생지·오류 메시지)이 없다. 성공·400은 로그 0줄", async () => {
    const who = { ...BASE, name: "김민지", birthplace: { name: "울릉군", longitude: 130.905 } }
    expect((await post(who, "10.14.0.1")).status).toBe(200)
    expect((await post({ ...who, birthMonth: 2, birthDay: 30 }, "10.14.0.2")).status).toBe(400)
    expect((await post({ ...who, calType: "LUNAR", birthMonth: 6, birthDay: 1, isLeapMonth: true }, "10.14.0.3")).status).toBe(400)
    expect(logs).toEqual([])
    fault.msg = "boom 김민지 1984-07-21 울릉군"
    const r500 = await post(who, "10.14.0.4")
    expect(r500.status).toBe(500)
    expect(JSON.stringify(await r500.json())).not.toMatch(/boom|김민지|1984|울릉군|TypeError|stack/)
    fault.msg = null
    for (let i = 0; i < FREE_RATE_LIMIT + 1; i++) await post(who, "10.14.0.5")
    const all = logs.join("\n")
    for (const s of ["김민지", "1984", "울릉군", "130.9", "boom", "13:47"]) expect(all, s).not.toContain(s)
    expect(logs.length).toBe(1) // 500 한 줄(오류 종류만)
    expect(all).toMatch(/TypeError/)
  })

  it("Cache-Control: no-store — 200·400(검증)·400(크기)·429·500 모두", async () => {
    const statuses: number[] = []
    const check = (r: Response) => { statuses.push(r.status); expect(r.headers.get("cache-control"), String(r.status)).toBe("no-store") }
    check(await post(BASE, "10.15.0.1"))
    check(await post({ ...BASE, gender: "X" }, "10.15.0.2"))
    check(await post({ ...BASE, pad: "x".repeat(3000) }, "10.15.0.3"))
    fault.msg = "x"
    check(await post(BASE, "10.15.0.4"))
    fault.msg = null
    for (let i = 0; i < FREE_RATE_LIMIT; i++) await post(BASE, "10.15.0.5")
    check(await post(BASE, "10.15.0.5"))
    expect(statuses).toEqual([200, 400, 400, 500, 429])
  })

  it("DB·세션·로그인·AI 모듈 접근 0, 외부 네트워크 요청(fetch) 0", async () => {
    await post(BASE, "10.16.0.1")
    await post({ ...BASE, hour: null, birthHour: null, birthMinute: undefined, timeMode: undefined }, "10.16.0.2")
    expect(touched).toEqual([])
    expect(fetchCalls).toBe(0)
  })
})

// ─────────────────────────────────────────── 3. 429

describe("요청 제한(429)", () => {
  it("같은 IP 분당 FREE_RATE_LIMIT회 초과 → 429 + Retry-After(1~60초 정수), 본문 읽기 전에 거절", async () => {
    for (let i = 0; i < FREE_RATE_LIMIT; i++) expect((await post(BASE, "10.20.0.1")).status).toBe(200)
    let read = false
    const body = new ReadableStream<Uint8Array>({ pull() { read = true; throw new Error("읽으면 안 됨") } }, { highWaterMark: 0 })
    const r = await POST(new NextRequest(URL_, { method: "POST", body, duplex: "half", headers: { "x-forwarded-for": "10.20.0.1" } } as never))
    expect(r.status).toBe(429)
    expect(read).toBe(false)
    const ra = Number(r.headers.get("retry-after"))
    expect(Number.isInteger(ra) && ra >= 1 && ra <= FREE_RATE_WINDOW_MS / 1000).toBe(true)
    expect(JSON.stringify(await r.json())).not.toMatch(/10\.20|ip/i)
  })

  it("/api/free와 같은 저장소: 두 무료 API 합산으로 IP당 한도가 걸린다(한쪽으로 우회 불가)", async () => {
    const half = Math.floor(FREE_RATE_LIMIT / 2)
    const freeReq = () => freePOST(new NextRequest("http://localhost/api/free", { method: "POST", headers: { "x-forwarded-for": "10.21.0.1" }, body: JSON.stringify(BASE) }))
    for (let i = 0; i < half; i++) expect((await freeReq()).status).toBe(200)
    for (let i = 0; i < FREE_RATE_LIMIT - half; i++) expect((await post(BASE, "10.21.0.1")).status).toBe(200)
    expect((await post(BASE, "10.21.0.1")).status).toBe(429)
    expect((await freeReq()).status).toBe(429)
  })

  it("잘못된 요청(400)도 한도에 센다(검증 실패 반복으로 계산 자원 소모 불가)", async () => {
    for (let i = 0; i < FREE_RATE_LIMIT; i++) expect((await post({ gender: "X" }, "10.22.0.1")).status).toBe(400)
    expect((await post(BASE, "10.22.0.1")).status).toBe(429)
  })
})

// ─────────────────────────────────────────── 4. 근거(basis) ↔ 규칙 엔진, 원국 글자 실재

// 품질검증 자체 표(엔진 코드 미사용). 지지는 정기(본기) 천간으로 본다 — 子=癸, 午=丁, 巳=丙, 亥=壬
const STEMS = "甲乙丙丁戊己庚辛壬癸"
const STEM_EL = ["목", "목", "화", "화", "토", "토", "금", "금", "수", "수"] as const
const BRANCH_MAIN: Record<string, string> = { 子: "癸", 丑: "己", 寅: "甲", 卯: "乙", 辰: "戊", 巳: "丙", 午: "丁", 未: "己", 申: "庚", 酉: "辛", 戌: "戊", 亥: "壬" }
const EL_ORDER = ["목", "화", "토", "금", "수"] as const
const EN: Record<string, string> = { 목: "wood", 화: "fire", 토: "earth", 금: "metal", 수: "water" }
function tenGodOf(dm: string, target: string): string {
  const a = STEMS.indexOf(dm), b = STEMS.indexOf(target)
  const ea = EL_ORDER.indexOf(STEM_EL[a]), eb = EL_ORDER.indexOf(STEM_EL[b])
  const same = a % 2 === b % 2
  const d = (eb - ea + 5) % 5 // 0 같음, 1 내가 생함, 2 내가 극함, 3 나를 극함, 4 나를 생함
  return [["비견", "겁재"], ["식신", "상관"], ["편재", "정재"], ["편관", "정관"], ["편인", "정인"]][d][same ? 0 : 1]
}

/** 고정 씨앗 난수(재현 가능) */
function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32 }
}
const CITIES = [126.978, 129.075, 126.531, 127.385, 128.601, 130.905, 124.715]
function sampleInputs(n: number) {
  const r = rng(20261128)
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)]
  const out: Record<string, unknown>[] = []
  // 경계 시기 고정 표본: 서머타임(1948~51·55~60·87~88), 표준시 UTC+8:30(1954~61), 입춘 근처, 자시
  const fixed = [
    { birthYear: 1949, birthMonth: 7, birthDay: 10, birthHour: 0, birthMinute: 30 },
    { birthYear: 1956, birthMonth: 6, birthDay: 2, birthHour: 23, birthMinute: 40 },
    { birthYear: 1958, birthMonth: 2, birthDay: 4, birthHour: 10, birthMinute: 5 },
    { birthYear: 1987, birthMonth: 8, birthDay: 15, birthHour: 1, birthMinute: 15 },
    { birthYear: 1988, birthMonth: 10, birthDay: 9, birthHour: 2, birthMinute: 30 },
    { birthYear: 2024, birthMonth: 2, birthDay: 4, birthHour: 17, birthMinute: 27 },
    { birthYear: 1900, birthMonth: 1, birthDay: 31, birthHour: 12, birthMinute: 0 },
    { birthYear: 2099, birthMonth: 12, birthDay: 31, birthHour: 23, birthMinute: 59 },
  ]
  for (const f of fixed) out.push({ ...f, timeMode: "exact", gender: pick(["M", "F"]), calType: "SOLAR" })
  while (out.length < n) {
    const y = 1900 + Math.floor(r() * 200), m = 1 + Math.floor(r() * 12), d = 1 + Math.floor(r() * 28)
    const p: Record<string, unknown> = { birthYear: y, birthMonth: m, birthDay: d, birthHour: Math.floor(r() * 24), birthMinute: Math.floor(r() * 60), timeMode: "exact", gender: pick(["M", "F"]), calType: "SOLAR" }
    if (r() < 0.35) p.birthplace = { name: "지역", longitude: pick(CITIES) }
    if (r() < 0.2) { p.birthHour = null; delete p.birthMinute; delete p.timeMode }
    out.push(p)
  }
  return out
}

describe("근거(basis) — 원국 글자 실재·자체 표 대조·규칙 엔진 직접 대조", () => {
  const inputs = sampleInputs(40)

  it("표본 40건: 근거 십성 자리 글자가 실제 원국 그 자리에 있고, 품질검증 표로 다시 센 십성·오행 개수와 같다", async () => {
    for (const [i, inp] of inputs.entries()) {
      resetRateLimit()
      const res = await post(inp, `10.30.0.${i}`)
      expect(res.status, JSON.stringify(inp)).toBe(200)
      const j = await json(res)
      const pil = Object.fromEntries(j.pillars.map((p) => [p.key, p]))
      const dm = pil.day.stemHanja
      expect(j.basis.dayMaster.char).toBe(dm)
      expect(j.dayMaster.hanja).toBe(dm)
      // 겉 글자: 일간 제외 천간 + 지지 전부 = 시주 있으면 7, 없으면 5
      const expectedCount = j.hourUnknown ? 5 : 7
      expect(j.basis.tenGods.positions, JSON.stringify(inp)).toHaveLength(expectedCount)
      expect(j.hourUnknown).toBe(!pil.hour)
      for (const p of j.basis.tenGods.positions) {
        const v = pil[p.pillar]
        expect(v, `${p.pillar} 기둥 없음`).toBeTruthy()
        const char = p.part === "stem" ? v.stemHanja : v.branchHanja
        expect(p.char, JSON.stringify(inp)).toBe(char) // 근거 글자가 실제 원국에 있다
        expect(p.charKo).toBe(p.part === "stem" ? v.stemKo : v.branchKo)
        const target = p.part === "stem" ? char : BRANCH_MAIN[char]
        expect(p.tenGod.ko, `${JSON.stringify(inp)} ${p.pillar}.${p.part} ${char}`).toBe(tenGodOf(dm, target))
        expect(p.pillar === "day" && p.part === "stem").toBe(false) // 일간 자신은 십성 자리에 없음
      }
      // 지장간에만 있는 십성은 겉 글자 십성과 겹치지 않는다
      const surface = new Set(j.basis.tenGods.positions.map((p) => p.tenGod.ko))
      for (const h of j.basis.tenGods.hiddenOnly) expect(surface.has(h.ko)).toBe(false)
      // 오행 개수: 천간 + 지지 정기
      const cnt: Record<string, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 }
      for (const v of j.pillars) { cnt[v.element]++; cnt[STEM_EL[STEMS.indexOf(BRANCH_MAIN[v.branchHanja])]]++ }
      expect(j.basis.elements.items.map((e) => [e.ko, e.count])).toEqual(EL_ORDER.map((e) => [e, cnt[e]]))
      expect(j.elements.map((e) => [e.el, e.count])).toEqual(EL_ORDER.map((e) => [e, cnt[e]]))
      // 비율 합
      const g = j.basis.tenGods.groups.reduce((a, x) => a + x.share, 0)
      const e = j.basis.elements.items.reduce((a, x) => a + x.share, 0)
      expect(Math.abs(g - 1)).toBeLessThan(0.006)
      expect(Math.abs(e - 1)).toBeLessThan(0.006)
      // 부족 오행은 가중 비율 기준이지만 개수 0인 오행보다 넓지 않아야 할 이유는 없다 — 대신 우세 오행이 비율 최댓값인지만 본다
      const maxShare = Math.max(...j.basis.elements.items.map((x) => x.share))
      expect(j.basis.elements.items.find((x) => x.ko === j.basis.elements.dominant)!.share).toBe(maxShare)
    }
    expect(touched).toEqual([])
  }, 60_000)

  it("양력 시각 입력 표본: computeChart → analyzeRules 직접 계산과 원국·신강약·격국·용신·오행 비율이 같다", async () => {
    let compared = 0
    for (const [i, inp] of inputs.entries()) {
      resetRateLimit()
      const j = await json(await post(inp, `10.31.0.${i}`))
      const hour = inp.birthHour as number | null
      const chart = computeChart({
        calendar: "solar", year: inp.birthYear as number, month: inp.birthMonth as number, day: inp.birthDay as number, isLeapMonth: false,
        time: hour === null ? null : { hour, minute: inp.birthMinute as number }, timezone: "Asia/Seoul",
        ...(inp.birthplace ? { longitude: (inp.birthplace as { longitude: number }).longitude } : {}),
        gender: inp.gender as "M" | "F",
      })
      const g = (p: { stem: string; branch: string } | null) => (p ? p.stem + p.branch : null)
      expect(j.pillars.map((p) => p.hanja), JSON.stringify(inp)).toEqual(
        [chart.pillars.year, chart.pillars.month, chart.pillars.day, chart.pillars.hour].map(g).filter((x) => x !== null),
      )
      const rules = analyzeRules(chart, undefined, { luck: chart.luck.daeun.map((d) => d.pillar), year: yearPillarOf(j.thisYear.year) })
      const b = j.basis
      expect(b.rulesVersion).toBe(rules.engineVersion)
      const primary = rules.strength.models.find((m) => m.model === rules.strength.primary)!
      expect(b.strength.verdict).toBe(primary.verdict)
      expect(b.strength.models.map((m) => [m.model, m.verdict])).toEqual(rules.strength.models.map((m) => [m.model, m.verdict]))
      const main = rules.structure.candidates.find((c) => c.role === "primary" && c.kind !== "special")
      expect(b.structure?.name ?? null).toBe(main?.name ?? null)
      const ug = rules.usefulGods.views
        .filter((v) => v.status === "ok" && v.method !== "special")
        .map((v) => [v.method, (v.candidates.find((c) => c.rank === 1) ?? v.candidates[0])?.element])
        .filter((x) => x[1] !== undefined)
      expect(b.usefulGods.map((u) => [u.method, EN[u.element.ko]])).toEqual(ug)
      for (const it of b.elements.items) expect(Math.abs(it.share - (rules.qiFlow.shares[EN[it.ko] as "wood"] ?? 0))).toBeLessThan(0.0006)
      expect(EN[b.elements.dominant]).toBe(rules.qiFlow.dominant.element)
      expect(b.elements.missing.map((m) => EN[m]).sort()).toEqual([...rules.qiFlow.missing].sort())
      // 대운: 응답 대운 간지가 엔진 대운과 같다
      expect(j.daeun.items.map((d) => d.hanja)).toEqual(chart.luck.daeun.slice(0, j.daeun.items.length).map((d) => d.pillar.stem + d.pillar.branch))
      compared++
    }
    expect(compared).toBe(inputs.length)
  }, 60_000)

  it("결정론: 같은 입력 두 번(다른 IP) → 응답 완전히 같음", async () => {
    for (const inp of inputs.slice(0, 5)) {
      resetRateLimit()
      const a = await json(await post(inp, "10.32.0.1"))
      const b = await json(await post(inp, "10.32.0.2"))
      expect(a).toEqual(b)
    }
  })
})

// ─────────────────────────────────────────── 5. 특수격 정책

describe("특수격 정책 — 특수격 후보·특수격 용신 관점은 응답에 싣지 않는다", () => {
  const SPECIAL_TEXT = /종[가-힣]{0,2}격|[목화토금수]{1,2}격 후보|화[목화토금수]격|일행득기|종왕|special|singlePick/i

  it("특수격 후보가 있는 원국을 찾아 응답 근거에 특수격 이름·관점이 없음을 확인(그리고 일반 표본 전부)", async () => {
    let specialCharts = 0
    let specialPrimary = 0
    // 탐색: 1950~2010년 매 9일 정오(시 모름 포함 아님) — 특수격 후보가 생긴 원국에서 응답을 본다
    for (let t = Date.UTC(1950, 0, 3); t < Date.UTC(2010, 0, 1) && specialCharts < 6; t += 9 * 86400_000) {
      const d = new Date(t)
      const inp = { birthYear: d.getUTCFullYear(), birthMonth: d.getUTCMonth() + 1, birthDay: d.getUTCDate(), birthHour: (d.getUTCDate() * 7) % 24, birthMinute: 10, timeMode: "exact", gender: "M", calType: "SOLAR" }
      const chart = computeChart({ calendar: "solar", year: inp.birthYear, month: inp.birthMonth, day: inp.birthDay, isLeapMonth: false, time: { hour: inp.birthHour, minute: 10 }, timezone: "Asia/Seoul", gender: "M" })
      const rules = analyzeRules(chart)
      const sp = rules.structure.candidates.filter((c) => c.kind === "special")
      const spView = rules.usefulGods.views.find((v) => v.method === "special" && v.status === "ok")
      if (sp.length === 0 && !spView) continue
      specialCharts++
      if (rules.structure.candidates.some((c) => c.role === "primary" && c.kind === "special")) specialPrimary++
      resetRateLimit()
      const j = await json(await post(inp, "10.40.0.1"))
      const basisText = JSON.stringify(j.basis)
      for (const c of sp) expect(basisText, c.name).not.toContain(c.name)
      expect(basisText, JSON.stringify(inp)).not.toMatch(SPECIAL_TEXT)
      expect(j.basis.usefulGods.some((u) => u.method === "special")).toBe(false)
      if (j.basis.structure) expect(sp.map((c) => c.name)).not.toContain(j.basis.structure.name)
    }
    expect(specialCharts, "특수격 후보가 있는 표본을 찾지 못함 — 탐색 범위 조정 필요").toBeGreaterThan(0)
    // 기록용(판정 아님): 특수격이 주 후보로 잡힌 원국 수
    expect(specialPrimary).toBeGreaterThanOrEqual(0)
  }, 60_000)

  it("일반 표본 전체에서도 응답(근거·경고 포함)에 특수격 문구·관점이 없다", async () => {
    for (const [i, inp] of sampleInputs(20).entries()) {
      resetRateLimit()
      const j = await json(await post(inp, `10.41.0.${i}`))
      expect(JSON.stringify(j.basis)).not.toMatch(SPECIAL_TEXT)
      for (const u of j.basis.usefulGods) expect(u.header).not.toMatch(/특수격|종격|화격/)
    }
  }, 30_000)
})

// ─────────────────────────────────────────── 6. 자산 목록 — 대체 그림은 데이터 URI(외부 요청 0)

describe("자산 목록(assets.ts) — 대체 그림·경로", () => {
  const decode = (uri: string) => decodeURIComponent(uri.replace(/^data:image\/svg\+xml;charset=utf-8,/, ""))
  /** 외부 요청을 일으킬 수 있는 SVG 요소·속성(xmlns 이름공간 선언은 요청이 아니므로 먼저 지운다) */
  const external = (svg: string) =>
    svg.replace(/\sxmlns(:\w+)?="[^"]*"/g, "").match(/https?:|\/\/|href|url\((?!#[\w-]+\))|@import|<script|<image|<use|<foreignObject|<iframe|\son[a-z]+\s*=|<style/gi)

  it("모든 그림 자산(원형 12종·삽화 10종 포함)의 fallback이 데이터 URI SVG이고 외부 참조가 없다", () => {
    const all = listImageAssets()
    // grandma 1 + bokja 2 + study 1 + bookCover 1 + paper 1 + 원형 12×2 + 삽화 10 = 40
    expect(all.length).toBe(40)
    for (const { key, asset } of all) {
      expect(asset.fallback, key).toBe(FALLBACK_IMAGE)
      expect(asset.fallback.startsWith("data:image/svg+xml;")).toBe(true)
      expect(external(decode(asset.fallback)), key).toBeNull()
      // 원본 경로도 같은 출처 고정 경로(외부 주소·상위 폴더 이동 없음)
      expect(asset.src, key).toMatch(/^\/unmyeong\/(placeholder|final)\/[a-z0-9/_-]+\.(svg|webp|png|jpg|avif)$/)
      expect(asset.isPlaceholder).toBe(asset.src.startsWith("/unmyeong/placeholder/"))
    }
    // 모르는 원형 id·장 키도 깨지지 않는다
    for (const a of [archetypeAssets("없는원형"), archetypeAssets(null), archetypeAssets(undefined), archetypeAssets("")]) {
      expect(a.human.fallback).toBe(FALLBACK_IMAGE)
      expect(a.beast.src).toMatch(/^\/unmyeong\//)
    }
    expect(illustrationFor("없는장").fallback).toBe(FALLBACK_IMAGE)
  })

  // [결함 QA-UM-2, 낮음] 객체 기본 속성 이름(__proto__·constructor·toString)을 키로 주면 자산이 아닌 값이 돌아온다.
  // 지금 원형 id·장 키는 엔진·고정 목록에서만 오므로 사용자 입력 경로는 없다. 고쳐지면 it.fails → it.
  it.fails("[결함 QA-UM-2] archetypeAssets·illustrationFor: 객체 기본 속성 이름도 임시 그림으로 대체", () => {
    for (const k of ["__proto__", "constructor", "toString", "hasOwnProperty"]) {
      expect(archetypeAssets(k).human.fallback, k).toBe(FALLBACK_IMAGE)
      expect(illustrationFor(k).fallback, k).toBe(FALLBACK_IMAGE)
    }
  })

  it("대체 그림 SVG가 올바른 SVG 문서이고 작다(1KB 미만)", () => {
    const svg = decode(FALLBACK_IMAGE)
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]*>.*<\/svg>$/)
    expect(FALLBACK_IMAGE.length).toBeLessThan(1024)
  })

  it("public/unmyeong/placeholder/ 임시 그림 파일도 외부 참조·스크립트가 없다, 목록이 가리키는 임시 그림 파일이 모두 있다", () => {
    const dir = path.join(process.cwd(), "public", "unmyeong", "placeholder")
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".svg"))
    expect(files.length).toBeGreaterThan(0)
    for (const f of files) expect(external(fs.readFileSync(path.join(dir, f), "utf8")), f).toBeNull()
    for (const { key, asset } of listImageAssets()) {
      if (asset.isPlaceholder) expect(fs.existsSync(path.join(process.cwd(), "public", ...asset.src.split("/").filter(Boolean))), key).toBe(true)
    }
  })

  it("인트로 영상은 아직 없음(null) → 대체 장면, 영상 파일 목록 0", () => {
    expect(UNMYEONG_ASSETS.intro.video).toBeNull()
    expect(UNMYEONG_ASSETS.intro.fallback).toBe("scene")
    expect(listVideoFiles()).toEqual([])
  })
})

// ─────────────────────────────────────────── 7. 유료 5권 설정 — 가격 칸 거부

describe("유료 5권 설정(volumes.ts) — 가격 칸 거부", () => {
  const clone = () => JSON.parse(JSON.stringify(rawVolumes)) as { volumes: Record<string, unknown>[] } & Record<string, unknown>

  it("현재 volumes.json 어디에도 가격류 칸·금액 문구가 없다", () => {
    const keys: string[] = []
    const walk = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(walk)
      else if (v && typeof v === "object") for (const [k, c] of Object.entries(v)) { keys.push(k); walk(c) }
    }
    walk(rawVolumes)
    expect(keys.filter((k) => /price|amount|won|krw|cost|fee|가격|금액|원가/i.test(k))).toEqual([])
    const text = JSON.stringify((rawVolumes as { volumes: unknown }).volumes)
    expect(text).not.toMatch(/\d[\d,]*\s*원|₩|\d+\s*won/i)
  })

  it.each([
    ["최상위 price", (c: ReturnType<typeof clone>) => { c.price = 9900 }],
    ["최상위 Amount(대소문자)", (c: ReturnType<typeof clone>) => { c.Amount = 1 }],
    ["권 price", (c: ReturnType<typeof clone>) => { c.volumes[0].price = 0 }],
    ["권 PRICE", (c: ReturnType<typeof clone>) => { c.volumes[1].PRICE = 100 }],
    ["권 amount", (c: ReturnType<typeof clone>) => { c.volumes[2].amount = 19900 }],
    ["권 won", (c: ReturnType<typeof clone>) => { c.volumes[3].won = 1 }],
    ["권 krw", (c: ReturnType<typeof clone>) => { c.volumes[4].krw = 1 }],
    ["권 가격", (c: ReturnType<typeof clone>) => { c.volumes[0]["가격"] = "무료" }],
    ["권 price=null", (c: ReturnType<typeof clone>) => { c.volumes[0].price = null }],
  ])("%s → 검증 실패", (_l, mutate) => {
    const c = clone()
    mutate(c)
    const r = validateVolumesConfig(c)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.join("\n")).toMatch(/가격 칸/)
  })

  it("목록에 없는 가격류 이름(priceKrw·cost·fee·장 안 price)은 거부되지 않지만, 검증 결과(화면이 쓰는 값)에는 실리지 않는다 — 관찰", () => {
    const c = clone()
    c.volumes[0].priceKrw = 1
    c.volumes[0].cost = 1
    c.volumes[0].fee = 1
    ;(c.volumes[0].chapters as Record<string, unknown>[])[0].price = 1
    const r = validateVolumesConfig(c)
    // 관찰: 현재 통과한다(이름 목록 방식). 결과 객체는 정해진 칸만 복사하므로 가격 값이 새지 않는다
    expect(r.ok).toBe(true)
    if (r.ok) {
      const allowedVol = ["chapters", "intro", "key", "no", "productCode", "subtitle", "title", "visible"]
      for (const v of r.value) {
        expect(Object.keys(v).sort()).toEqual(allowedVol)
        for (const ch of v.chapters) expect(Object.keys(ch).sort()).toEqual(["id", "label", "status"])
      }
      expect(JSON.stringify(r.value)).not.toMatch(/priceKrw|cost|fee|"price"/)
    }
  })

  it("빌드에 묶인 UNMYEONG_VOLUMES에도 가격 칸이 없고, 상품 코드만 가리킨다", () => {
    for (const v of UNMYEONG_VOLUMES) {
      expect(Object.keys(v)).not.toEqual(expect.arrayContaining(["price"]))
      expect(v.productCode === null || /^[A-Z_]+$/.test(v.productCode)).toBe(true)
    }
  })
})
