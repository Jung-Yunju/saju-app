// U-03 독립 검증(품질검증 담당) — 화면 요청 본문 ↔ 서버 검증 계약 조합 테스트
// 화면 함수(buildRequest)로 만든 본문을 JSON 왕복(fetch와 같은 직렬화) 후 서버 검증·만세력 계산에 그대로 넣는다.
import { describe, expect, it } from "vitest"
import { buildRequest, emptyForm, PLACES, SIJIN_OPTIONS, type BirthForm } from "@/app/input/build-request"
import { validateBirthInfo, validateReadingRequest, type PersonInput } from "@/lib/validate"
import { buildSajuInputFromRequest } from "@/lib/saju-input"
import { otherPrecisionColumns, precisionColumns } from "@/app/api/reading/_lib/schema-v3"

const NOW = new Date("2026-11-27T00:00:00Z")
const pad2 = (n: number) => String(n).padStart(2, "0")

/** 날짜 조합: 양력 / 음력 평달 / 음력 윤달(2020 윤4월 실재) */
const DATES: Partial<BirthForm>[] = [
  { calType: "SOLAR", isLeapMonth: false, birthYear: "1990", birthMonth: "5", birthDay: "10" },
  { calType: "SOLAR", isLeapMonth: true, birthYear: "1987", birthMonth: "7", birthDay: "15" }, // 화면 상태만 true(양력이면 안 보냄)
  { calType: "LUNAR", isLeapMonth: false, birthYear: "1990", birthMonth: "4", birthDay: "15" },
  { calType: "LUNAR", isLeapMonth: true, birthYear: "2020", birthMonth: "4", birthDay: "10" },
]

type TimeCase = { form: Partial<BirthForm>; expectTime: string | null; mode: "exact" | "sijin" | null; minute: number | null | undefined; zi?: boolean }
const TIMES: TimeCase[] = [{ form: { timeMode: "unknown" }, expectTime: null, mode: null, minute: undefined }]
for (let h = 0; h < 24; h++) {
  for (const m of [0, 29, 30, 59]) {
    TIMES.push({ form: { timeMode: "exact", birthHour: String(h), birthMinute: String(m) }, expectTime: `${pad2(h)}:${pad2(m)}`, mode: "exact", minute: m })
  }
}
for (const { v } of SIJIN_OPTIONS) {
  const h = Number(v)
  if (h === 0) {
    TIMES.push({ form: { timeMode: "sijin", birthHour: v, ziChoice: "" }, expectTime: "00:00", mode: "sijin", minute: null })
    TIMES.push({ form: { timeMode: "sijin", birthHour: v, ziChoice: "night" }, expectTime: "23:45", mode: "sijin", minute: null, zi: true })
    TIMES.push({ form: { timeMode: "sijin", birthHour: v, ziChoice: "dawn" }, expectTime: "00:45", mode: "sijin", minute: null, zi: false })
  } else {
    TIMES.push({ form: { timeMode: "sijin", birthHour: v, ziChoice: "night" /* 자시 아닌데 남은 상태 */ }, expectTime: `${pad2(h)}:30`, mode: "sijin", minute: null })
  }
}
const PLACE_NAMES = [...PLACES.map(p => p.name), ""]

function form(d: Partial<BirthForm>, t: Partial<BirthForm>, place: string, extra: Partial<BirthForm> = {}): BirthForm {
  return { ...emptyForm(), gender: "F", ...d, ...t, birthplace: place, ...extra }
}
const roundTrip = (b: unknown) => JSON.parse(JSON.stringify(b)) as Record<string, unknown>

function checkPerson(p: PersonInput & { calType?: string }, f: BirthForm, t: TimeCase, calType: string) {
  expect(p.year).toBe(Number(f.birthYear))
  expect(p.month).toBe(Number(f.birthMonth))
  expect(p.day).toBe(Number(f.birthDay))
  expect(p.hour).toBe(t.mode === null ? null : Number(f.birthHour))
  if (calType === "LUNAR") expect(p.isLeapMonth).toBe(f.isLeapMonth)
  else expect(p.isLeapMonth).toBeUndefined()
  if (t.mode === null) {
    expect(p.timeMode).toBeUndefined()
    expect(p.birthMinute).toBeUndefined()
  } else {
    expect(p.timeMode).toBe(t.mode)
    expect(p.birthMinute).toBe(t.minute)
  }
  expect(p.ziNight).toBe(t.zi)
  const place = PLACES.find(x => x.name === f.birthplace)
  expect(p.birthplace).toEqual(place ? { name: place.name, longitude: place.longitude } : null)

  const si = buildSajuInputFromRequest({ ...p, calType }, undefined, { now: NOW })
  const time = si.birth.length > 10 ? si.birth.slice(11) : null
  expect(time).toBe(t.expectTime)
  expect(si.hour_unknown).toBe(t.mode === null)
  expect(si.time_mode).toBe(t.mode ?? undefined)
  if (t.mode !== null) expect(si.birth_minute).toBe(t.mode === "exact" ? t.minute : null)
  expect(si.birthplace).toEqual(place ? { name: place.name, longitude: place.longitude } : undefined)
  expect(si.calendar).toBe(calType === "LUNAR" ? (f.isLeapMonth ? "음력(윤달)" : "음력") : "양력")
  // v3 열 변환도 같은 규칙인지
  const cols = precisionColumns(p)
  expect(cols.timeMode).toBe(t.mode)
  expect(cols.birthMinute).toBe(t.mode === "exact" ? t.minute : null)
  expect(cols.ziNight).toBe(t.zi ?? null)
  expect(cols.birthplaceLongitude).toBe(place ? place.longitude : null)
  expect(cols.isLeapMonth).toBe(calType === "LUNAR" && f.isLeapMonth)
  return si
}

describe("U-03 계약: 1인 풀이 — 날짜 4종 × 시각 111종 × 출생지 21종 전수(9,324건)", () => {
  it("화면 본문이 /api/reading/direct 검증과 만세력 계산을 모두 통과하고 값이 보존된다", () => {
    let n = 0
    for (const d of DATES) for (const t of TIMES) for (const place of PLACE_NAMES) {
      const f = form(d, t.form, place, { name: "검증" })
      const built = buildRequest("BASIC", f, null)
      if ("error" in built) throw new Error(`화면 오류 ${JSON.stringify(t.form)}: ${built.error}`)
      const body = roundTrip(built.body)
      const r = validateReadingRequest(body)
      if (!r.ok) throw new Error(`서버 거부 ${JSON.stringify(body)}: ${r.error}`)
      expect(r.value.other).toBeNull()
      expect(r.value.calType).toBe(d.calType)
      const p: PersonInput = { ...r.value, year: r.value.birthYear, month: r.value.birthMonth, day: r.value.birthDay, hour: r.value.birthHour }
      checkPerson(p, f, t, d.calType!)
      // 결제 준비(prepare) 경로도 같은 본문을 받는다
      const { readingType: _rt, name: _nm, ...birthOnly } = body
      const b = validateBirthInfo(birthOnly)
      if (!b.ok) throw new Error(`prepare 거부 ${JSON.stringify(birthOnly)}: ${b.error}`)
      expect(b.value).toEqual((({ readingType: _a, name: _b, other: _c, ...rest }) => rest)(r.value))
      n++
    }
    expect(n).toBe(DATES.length * TIMES.length * PLACE_NAMES.length)
  }, 120_000)
})

describe("U-03 계약: 2인 풀이 other* — 상대방 전수 × 본인 고정, 본인 전수 × 상대방 고정", () => {
  for (const type of ["BULLY", "CONFLICT"]) {
    it(`${type}: 상대방 조합(otherCalType·otherIsLeapMonth·otherTimeMode·otherZiNight·otherBirthplace) 보존`, () => {
      const me = form(DATES[0], { timeMode: "exact", birthHour: "9", birthMinute: "5" }, "서울")
      for (const d of DATES) for (const t of TIMES) for (const place of ["목포", "포항", ""]) {
        const o = form(d, t.form, place, { gender: "M", name: "상대" })
        const built = buildRequest(type, me, o)
        if ("error" in built) throw new Error(built.error)
        const body = roundTrip(built.body)
        const r = validateReadingRequest(body)
        if (!r.ok) throw new Error(`서버 거부 ${JSON.stringify(body)}: ${r.error}`)
        const other = r.value.other!
        expect(other).not.toBeNull()
        expect(other.name).toBe("상대")
        expect(other.calType).toBe(d.calType) // 화면은 항상 otherCalType을 보낸다
        checkPerson(other, o, t, other.calType ?? r.value.calType)
        const oc = otherPrecisionColumns(other)
        expect(oc.otherCalType).toBe(d.calType)
      }
    }, 120_000)
  }
  it("CONFLICT: 본인 음력 윤달 + 상대방 양력 — 서로의 구분이 섞이지 않는다", () => {
    const me = form(DATES[3], { timeMode: "sijin", birthHour: "0", ziChoice: "night" }, "제주")
    for (const t of TIMES) {
      const o = form(DATES[0], t.form, "강릉", { gender: "M" })
      const built = buildRequest("CONFLICT", me, o)
      if ("error" in built) throw new Error(built.error)
      const r = validateReadingRequest(roundTrip(built.body))
      if (!r.ok) throw new Error(r.error)
      expect(r.value.calType).toBe("LUNAR")
      expect(r.value.isLeapMonth).toBe(true)
      expect(r.value.ziNight).toBe(true)
      expect(r.value.other!.calType).toBe("SOLAR")
      expect(r.value.other!.isLeapMonth).toBeUndefined()
      expect(r.value.other!.ziNight).toBe(t.zi)
    }
  })
  it("1인 풀이(BASIC 등)에서 화면은 other*를 보내지 않는다", () => {
    for (const type of ["BASIC", "MONEY", "LOVE", "CAREER"]) {
      const built = buildRequest(type, form(DATES[0], { timeMode: "unknown" }, "서울"), null)
      if ("error" in built) throw new Error(built.error)
      expect(Object.keys(built.body).some(k => k.startsWith("other"))).toBe(false)
    }
  })
})

describe("U-03 계약: 화면과 서버의 범위 차이(관찰)", () => {
  it("본인 생년은 화면이 1900~2024로 막지만, 상대방 생년은 화면 검사가 없다(서버 1900~2100에 맡김)", () => {
    const me = form(DATES[0], { timeMode: "unknown" }, "서울")
    const o = form({ ...DATES[0], birthYear: "2090" }, { timeMode: "unknown" }, "서울", { gender: "M" })
    const built = buildRequest("CONFLICT", me, o)
    expect("error" in built).toBe(false)
    if ("error" in built) return
    expect(validateReadingRequest(roundTrip(built.body)).ok).toBe(true)
    const o2 = form({ ...DATES[0], birthYear: "1850" }, { timeMode: "unknown" }, "서울", { gender: "M" })
    const built2 = buildRequest("CONFLICT", me, o2)
    expect("error" in built2).toBe(false) // 화면은 통과 → 서버가 400
    if ("error" in built2) return
    const r = validateReadingRequest(roundTrip(built2.body))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.startsWith("상대방 ")).toBe(true)
  })
  it("화면이 숫자로 못 바꾼 값(예: 월 'abc')은 NaN → JSON null → 서버가 400", () => {
    const f = form({ ...DATES[0], birthMonth: "abc" }, { timeMode: "unknown" }, "서울")
    const built = buildRequest("BASIC", f, null)
    if ("error" in built) return
    const body = roundTrip(built.body)
    expect(body.birthMonth).toBeNull()
    expect(validateReadingRequest(body).ok).toBe(false)
  })
})
