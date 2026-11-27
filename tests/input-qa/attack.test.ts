// U-03 독립 검증(품질검증 담당) — 입력 공격·경계값: 400 + 안전한 한국어 메시지, 주문·풀이 미생성, 개인정보 로그 미기록
// DB(prisma)·로그인은 가짜. 실제 PostgreSQL 동작은 이 테스트로 검증되지 않는다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const db = vi.hoisted(() => {
  const fn = () => vi.fn()
  const reading = { findFirst: fn(), findUnique: fn(), updateMany: fn(), create: fn() }
  const order = { findUnique: fn(), updateMany: fn(), update: fn(), count: fn(), create: fn() }
  const tx = { reading, order, $executeRaw: fn() }
  return { reading, order, tx, $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)) }
})
vi.mock("@/lib/prisma", () => ({ prisma: { reading: db.reading, order: db.order, $transaction: db.$transaction } }))
vi.mock("@/lib/session-user", () => ({ getSessionUser: vi.fn(async () => ({ userId: "u1", name: null })) }))

import { POST as directPOST } from "@/app/api/reading/direct/route"
import { POST as preparePOST } from "@/app/api/payment/prepare/route"
import { POST as confirmPOST } from "@/app/api/payment/confirm/route"
import { computeChart, EngineInputError } from "@/engine"

// 개인정보 표지(로그·응답에 나오면 안 됨)
const PII_NAME = "홍QA길동"
const PII_OTHER = "상대QA"
const PII_PLACE = "비밀QA마을"
const base = {
  readingType: "BASIC", name: PII_NAME, birthYear: 1977, birthMonth: 8, birthDay: 23, birthHour: 14, gender: "F", calType: "SOLAR",
  timeMode: "sijin", birthMinute: null, birthplace: { name: PII_PLACE, longitude: 127.5 },
}
const other = {
  otherName: PII_OTHER, otherBirthYear: 1979, otherBirthMonth: 3, otherBirthDay: 9, otherBirthHour: 0, otherGender: "M",
  otherCalType: "SOLAR", otherTimeMode: "sijin", otherBirthMinute: null, otherZiNight: true, otherBirthplace: { name: PII_PLACE, longitude: 129 },
}
const raw = (text: string) =>
  new NextRequest("http://localhost/api", { method: "POST", body: text, headers: { "content-type": "application/json" } })
const req = (body: unknown) => raw(JSON.stringify(body))

let logs: string[] = []
const spies: { mockRestore: () => void }[] = []
beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  logs = []
  for (const k of ["log", "info", "warn", "error", "debug"] as const) {
    spies.push(vi.spyOn(console, k).mockImplementation((...a: unknown[]) => { logs.push(a.map(x => (x instanceof Error ? `${x.message} ${x.stack}` : typeof x === "string" ? x : JSON.stringify(x))).join(" ")) }))
  }
  db.order.count.mockResolvedValue(0)
  db.order.create.mockResolvedValue({ id: "o1", orderId: "saju_x", amount: 19900 })
  db.reading.create.mockResolvedValue({ id: "r1" })
})
afterEach(() => { while (spies.length) spies.pop()!.mockRestore() })

async function expect400(res: Response, label: string, prefix?: string) {
  expect(res.status, label).toBe(400)
  const j = await res.json()
  expect(Object.keys(j), label).toEqual(["error"])
  expect(typeof j.error).toBe("string")
  expect(j.error.length, label).toBeLessThan(120)
  expect(j.error, label).toMatch(/[가-힣]/)
  for (const pii of [PII_NAME, PII_OTHER, PII_PLACE]) expect(j.error, label).not.toContain(pii)
  expect(j.error, label).not.toMatch(/Error|stack|undefined|NaN|prisma/i)
  if (prefix) expect(j.error.startsWith(prefix), `${label}: ${j.error}`).toBe(true)
  return j.error as string
}
const noPiiLogs = () => {
  for (const l of logs) for (const pii of [PII_NAME, PII_OTHER, PII_PLACE, "1977"]) expect(l).not.toContain(pii)
}

describe("direct: 출생지 경도·형식", () => {
  it("경계 124·132는 허용(포함), 한 끗 밖은 400", async () => {
    for (const lon of [124, 132, 124.0004, 131.9996]) {
      const res = await directPOST(req({ ...base, birthplace: { name: PII_PLACE, longitude: lon } }))
      expect(res.status, String(lon)).toBe(200)
    }
    for (const lon of [123.9999, 132.0001, -127, 0, -0, 1e308]) {
      await expect400(await directPOST(req({ ...base, birthplace: { name: PII_PLACE, longitude: lon } })), String(lon))
    }
    expect(db.reading.create).toHaveBeenCalledTimes(4)
    noPiiLogs()
  })
  it("경도 NaN·Infinity(JSON 원문)·문자열·null·불리언·누락 → 400", async () => {
    const bad = ['"127.5"', "null", "true", '"NaN"', "[127]", "{}"]
    for (const b of bad) {
      const body = JSON.stringify({ ...base, birthplace: { name: PII_PLACE, longitude: "__X__" } }).replace('"__X__"', b)
      await expect400(await directPOST(raw(body)), b)
    }
    // JSON 원문의 1e999는 Infinity로 읽힌다 → 유한수 검사에서 거부
    await expect400(await directPOST(raw(JSON.stringify({ ...base, birthplace: { name: PII_PLACE, longitude: 0 } }).replace('"longitude":0', '"longitude":1e999'))), "1e999")
    // NaN 리터럴은 JSON이 아님 → 형식 오류 400
    await expect400(await directPOST(raw(JSON.stringify({ ...base, birthplace: { name: PII_PLACE, longitude: 0 } }).replace('"longitude":0', '"longitude":NaN'))), "NaN")
    await expect400(await directPOST(req({ ...base, birthplace: { name: PII_PLACE } })), "누락")
    expect(db.$transaction).not.toHaveBeenCalled()
    noPiiLogs()
  })
  it("출생지 형식 오류(문자열·배열·빈 이름·21자 이름·__proto__ 경도) → 400", async () => {
    for (const bp of ["서울", [126.9], { name: "", longitude: 127 }, { name: "가".repeat(21), longitude: 127 }, { name: 5, longitude: 127 }]) {
      await expect400(await directPOST(req({ ...base, birthplace: bp })), JSON.stringify(bp))
    }
    await expect400(await directPOST(raw(JSON.stringify(base).replace(/"birthplace":\{[^}]*\}/, '"birthplace":{"name":"x","__proto__":{"longitude":127}}'))), "__proto__")
    expect(db.$transaction).not.toHaveBeenCalled()
  })
  it("출생지 이름의 꺾쇠·제어문자는 지워지고, 추가 키(위도 등)는 저장되지 않는다. 경도는 소수 셋째 자리", async () => {
    const res = await directPOST(req({ ...base, birthplace: { name: "<b>부산</b>​", longitude: 129.07549, lat: 35.1, addr: "상세주소" } }))
    expect(res.status).toBe(200)
    const si = db.reading.create.mock.calls[0][0].data.sajuInput
    expect(si.birthplace).toEqual({ name: "b부산/b", longitude: 129.075 })
    expect(JSON.stringify(si)).not.toContain("상세주소")
  })
})

describe("direct: 숫자·문자열 혼동, 거대한 이름, 본문 형식", () => {
  it("숫자 문자열(ASCII 1~4자리)은 허용, 소수·전각·부호·배열·객체는 400", async () => {
    const okRes = await directPOST(req({ ...base, birthYear: " 1977 ", birthMonth: "08", birthDay: "23", birthHour: "14" }))
    expect(okRes.status).toBe(200)
    for (const patch of [
      { birthYear: "1977.0" }, { birthYear: "１９７７" }, { birthYear: "+1977" }, { birthYear: 1977.5 }, { birthYear: [1977] },
      { birthMonth: {} }, { birthDay: true }, { birthHour: "14시" }, { birthHour: 24 }, { birthHour: -1 },
      { timeMode: "exact", birthHour: 14, birthMinute: "abc" }, { timeMode: "exact", birthHour: 14, birthMinute: 60 },
      { timeMode: "exact", birthHour: 14, birthMinute: -1 }, { timeMode: "exact", birthHour: 14, birthMinute: 1.5 },
      { birthHour: null, timeMode: undefined, birthMinute: 10 },
      { timeMode: "SIJIN" }, { timeMode: "sijin", birthHour: 23 }, { timeMode: 1 },
      { birthHour: 0, ziNight: "true" }, { birthHour: 0, ziNight: 1 },
      { isLeapMonth: "false" }, { isLeapMonth: true }, // 양력 + 윤달
      { gender: "X" }, { calType: "solar" }, { readingType: "VIP" },
    ]) {
      await expect400(await directPOST(req({ ...base, ...patch })), JSON.stringify(patch))
    }
    expect(db.reading.create).toHaveBeenCalledTimes(1)
    noPiiLogs()
  })
  it("거대한 이름: 21자 400, 8KB 초과 본문 400(요청이 너무 큽니다), 20자 이모지는 허용", async () => {
    await expect400(await directPOST(req({ ...base, name: "가".repeat(21) })), "21자")
    const e = await expect400(await directPOST(req({ ...base, name: "가".repeat(5000) })), "5000자")
    expect(e).toBe("요청이 너무 큽니다.")
    expect((await directPOST(req({ ...base, name: "😀".repeat(20) }))).status).toBe(200)
    // Content-Length 없이 스트림으로 큰 본문
    const big = new NextRequest("http://localhost/api", {
      method: "POST",
      body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(JSON.stringify({ ...base, name: "x".repeat(20000) }))); c.close() } }),
      // @ts-expect-error Node fetch 스트림 본문
      duplex: "half",
    })
    expect(await expect400(await directPOST(big), "stream")).toBe("요청이 너무 큽니다.")
    noPiiLogs()
  })
  it("본문이 배열·null·문자열·깨진 JSON → 400", async () => {
    for (const t of ["[]", "null", '"x"', "{", "", "﻿{}"]) await expect400(await directPOST(raw(t)), JSON.stringify(t))
    expect(db.$transaction).not.toHaveBeenCalled()
  })
})

describe("direct: 음력·윤달", () => {
  const lunar = { ...base, calType: "LUNAR" }
  it("그해 윤달이 없는데 윤달 true(2024 윤1월, 2021 윤5월) / 윤달이 다른 달(2020은 윤4월인데 윤5월) → 400", async () => {
    for (const [y, m] of [[2024, 1], [2021, 5], [2020, 5]]) {
      const e = await expect400(await directPOST(req({ ...lunar, birthYear: y, birthMonth: m, birthDay: 1, isLeapMonth: true })), `${y}윤${m}`)
      expect(e).toContain("윤달")
    }
    expect((await directPOST(req({ ...lunar, birthYear: 2020, birthMonth: 4, birthDay: 1, isLeapMonth: true }))).status).toBe(200)
    expect(db.reading.create).toHaveBeenCalledTimes(1)
    noPiiLogs()
  })
  it("작은달(29일)의 30일 → 400, 31일 → 400", async () => {
    let found: number | null = null
    for (let m = 1; m <= 12 && found === null; m++) {
      try { computeChart({ calendar: "lunar", year: 2021, month: m, day: 30, isLeapMonth: false, time: null, gender: "F" }) } catch (e) {
        if (e instanceof EngineInputError) found = m
        else throw e
      }
    }
    expect(found).not.toBeNull()
    await expect400(await directPOST(req({ ...lunar, birthYear: 2021, birthMonth: found, birthDay: 30 })), `2021-${found}-30`)
    await expect400(await directPOST(req({ ...lunar, birthYear: 2021, birthMonth: 1, birthDay: 31 })), "31일")
    expect(db.$transaction).not.toHaveBeenCalled()
  })
  it("변환 결과가 범위 밖(음력 2100-12-29 → 2101년 양력) → 400(500 아님)", async () => {
    const res = await directPOST(req({ ...lunar, birthYear: 2100, birthMonth: 12, birthDay: 29 }))
    await expect400(res, "2100-12-29")
    expect(logs.length).toBe(0)
  })
})

describe("direct: 2인 풀이 other* 혼합 오류", () => {
  it("정상 2인 요청은 200", async () => {
    expect((await directPOST(req({ ...base, readingType: "CONFLICT", ...other }))).status).toBe(200)
  })
  it("상대방 필드 오류는 모두 '상대방 '으로 시작하는 400", async () => {
    const two = { ...base, readingType: "BULLY", ...other }
    for (const patch of [
      { otherBirthYear: undefined }, { otherGender: undefined }, { otherBirthYear: 1850 },
      { otherCalType: "lunar" }, { otherCalType: "SOLAR", otherIsLeapMonth: true }, { otherIsLeapMonth: "yes" },
      { otherTimeMode: "sijin", otherBirthHour: 5 }, { otherTimeMode: "fuzzy" }, { otherZiNight: "no" },
      { otherBirthplace: { name: PII_PLACE, longitude: 140 } }, { otherBirthplace: { name: "", longitude: 127 } },
      { otherBirthHour: null, otherTimeMode: undefined, otherBirthMinute: 10 },
      { otherCalType: "LUNAR", otherBirthYear: 2024, otherBirthMonth: 1, otherBirthDay: 1, otherIsLeapMonth: true },
      { otherName: "가".repeat(21) },
    ]) {
      await expect400(await directPOST(req({ ...two, ...patch })), JSON.stringify(patch), "상대방 ")
    }
    expect(db.$transaction).not.toHaveBeenCalled()
    noPiiLogs()
  })
  it("1인 풀이(BASIC)에 섞인 other* 값은 검증하지 않고 버린다(오류 없음, 저장 안 됨)", async () => {
    const res = await directPOST(req({ ...base, ...other, otherBirthplace: { name: "x", longitude: 999 }, otherCalType: "??" }))
    expect(res.status).toBe(200)
    const data = db.reading.create.mock.calls[0][0].data
    expect(data.otherBirthYear).toBeNull()
    expect(data.otherName).toBeNull()
  })
  it("본인 필드 오류가 상대방보다 먼저 보고된다(상대방 문구 아님)", async () => {
    const e = await expect400(await directPOST(req({ ...base, readingType: "BULLY", ...other, birthMonth: 13, otherBirthMonth: 13 })), "both")
    expect(e.startsWith("상대방")).toBe(false)
  })
})

describe("direct: DB_SCHEMA_V3=true 열 기록이 계산과 같은 규칙", () => {
  it("본인·상대방 정확도 열: 출생지 이름은 열에 없고 경도만, ziNight는 시진 자시일 때만", async () => {
    vi.stubEnv("DB_SCHEMA_V3", "true")
    const res = await directPOST(req({ ...base, readingType: "CONFLICT", ...other, birthHour: 0, ziNight: false }))
    expect(res.status).toBe(200)
    const data = db.reading.create.mock.calls[0][0].data
    expect(data).toMatchObject({
      isLeapMonth: false, birthMinute: null, timeMode: "sijin", ziNight: false, birthplaceLongitude: 127.5,
      otherCalType: "SOLAR", otherIsLeapMonth: false, otherBirthMinute: null, otherTimeMode: "sijin", otherZiNight: true, otherBirthplaceLongitude: 129,
    })
    const cols = JSON.stringify({ ...data, sajuInput: undefined })
    expect(cols).not.toContain(PII_PLACE)
    expect(data.sajuInput.birth).toBe("1977-08-23 00:45")
  })
})

describe("payment/prepare·confirm: 같은 공격 입력", () => {
  const birth = { birthYear: 1977, birthMonth: 8, birthDay: 23, birthHour: 14, gender: "F", calType: "SOLAR", birthplace: { name: PII_PLACE, longitude: 127.5 } }
  const bads = [
    { birthplace: { name: PII_PLACE, longitude: 132.0001 } }, { birthplace: { name: PII_PLACE, longitude: "127" } },
    { calType: "LUNAR", birthYear: 2024, birthMonth: 1, birthDay: 1, isLeapMonth: true }, { isLeapMonth: true },
    { timeMode: "sijin", birthHour: 3 }, { birthHour: 0, ziNight: "x" }, { birthHour: null, birthMinute: 0 },
    { birthYear: "１９７７" },
  ]
  it("prepare: 400, 주문 생성 없음, 개인정보 로그 없음", async () => {
    for (const p of bads) await expect400(await preparePOST(req({ ...birth, ...p })), JSON.stringify(p))
    expect(db.order.create).not.toHaveBeenCalled()
    expect(logs.length).toBe(0)
  })
  it("prepare(v3): 주문에 저장되는 birthInfo는 검증·정리된 값뿐(추가 키 없음)", async () => {
    vi.stubEnv("DB_SCHEMA_V3", "true")
    const res = await preparePOST(req({ ...birth, amount: 1, injected: "x", birthplace: { name: PII_PLACE, longitude: 127.5, lat: 1 } }))
    expect(res.status).toBe(200)
    const data = db.order.create.mock.calls[0][0].data
    expect(data.amount).toBe(19900)
    expect(data.birthInfo).toEqual({ ...birth, birthplace: { name: PII_PLACE, longitude: 127.5 } })
  })
  it("confirm(스위치 끔): 토스 승인·주문 조회 전에 400, 로그 없음", async () => {
    vi.stubEnv("TOSS_SECRET_KEY", "test_dummy_not_a_real_key")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("네트워크 호출 금지"))
    for (const p of bads) {
      await expect400(await confirmPOST(req({ paymentKey: "pk_1", orderId: "saju_abcdef", amount: 19900, birthInfo: { ...birth, ...p } })), JSON.stringify(p))
    }
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(db.order.findUnique).not.toHaveBeenCalled()
    expect(logs.length).toBe(0)
    fetchSpy.mockRestore()
  })
})
