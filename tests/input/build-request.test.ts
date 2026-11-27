import { describe, expect, it } from "vitest"
import { buildRequest, emptyForm, isDstYear, PLACES, SIJIN_OPTIONS, ZI_CHOICES, ZI_HELP, type BirthForm } from "@/app/input/build-request"

const base = (o: Partial<BirthForm> = {}): BirthForm => ({
  ...emptyForm(), birthYear: "1990", birthMonth: "5", birthDay: "10", gender: "M", ...o,
})
const ok = (r: ReturnType<typeof buildRequest>) => {
  if ("error" in r) throw new Error(r.error)
  return r.body
}

describe("buildRequest", () => {
  it("시간 모름: birthHour null, timeMode 없음, 서울 기본", () => {
    const b = ok(buildRequest("BASIC", base(), null))
    expect(b.birthHour).toBeNull()
    expect("timeMode" in b).toBe(false)
    expect("isLeapMonth" in b).toBe(false)
    expect(b.birthplace).toEqual({ name: "서울", longitude: 126.978 })
  })
  it("음력일 때만 isLeapMonth", () => {
    expect(ok(buildRequest("BASIC", base({ calType: "LUNAR", isLeapMonth: true }), null)).isLeapMonth).toBe(true)
    expect("isLeapMonth" in ok(buildRequest("BASIC", base({ calType: "SOLAR", isLeapMonth: true }), null))).toBe(false)
  })
  it("exact: 시·분 숫자", () => {
    const b = ok(buildRequest("BASIC", base({ timeMode: "exact", birthHour: "23", birthMinute: "45" }), null))
    expect(b).toMatchObject({ timeMode: "exact", birthHour: 23, birthMinute: 45 })
    expect("ziNight" in b).toBe(false)
  })
  it("exact: 범위 밖/빈 분은 오류", () => {
    expect("error" in buildRequest("BASIC", base({ timeMode: "exact", birthHour: "24", birthMinute: "0" }), null)).toBe(true)
    expect("error" in buildRequest("BASIC", base({ timeMode: "exact", birthHour: "3", birthMinute: "" }), null)).toBe(true)
    expect("error" in buildRequest("BASIC", base({ timeMode: "exact", birthHour: "3", birthMinute: "60" }), null)).toBe(true)
  })
  it("sijin: minute null, 자시일 때만 ziNight", () => {
    const night = ok(buildRequest("BASIC", base({ timeMode: "sijin", birthHour: "0", ziChoice: "night" }), null))
    expect(night).toMatchObject({ timeMode: "sijin", birthHour: 0, birthMinute: null, ziNight: true })
    const dawn = ok(buildRequest("BASIC", base({ timeMode: "sijin", birthHour: "0", ziChoice: "dawn" }), null))
    expect(dawn.ziNight).toBe(false)
    expect("ziNight" in ok(buildRequest("BASIC", base({ timeMode: "sijin", birthHour: "0" }), null))).toBe(false)
    expect("ziNight" in ok(buildRequest("BASIC", base({ timeMode: "sijin", birthHour: "2", ziChoice: "night" }), null))).toBe(false)
  })
  it("자시 문구가 서버 시진표(23:30~01:29)와 일치", () => {
    expect(SIJIN_OPTIONS[0].t).toBe("23:30~01:29")
    expect(ZI_CHOICES.map((c) => c.l)).toEqual(["밤 11시 30분~자정 (태어난 날 밤)", "자정~새벽 1시 30분"])
    expect(ZI_HELP).toContain("해시")
    expect(ZI_HELP).toContain("11시 30분")
  })
  it("sijin인데 시진 미선택은 오류", () => {
    expect("error" in buildRequest("BASIC", base({ timeMode: "sijin" }), null)).toBe(true)
  })
  it("출생지: 선택값 경도, 해외/모름은 null", () => {
    expect(ok(buildRequest("BASIC", base({ birthplace: "강릉" }), null)).birthplace).toEqual({ name: "강릉", longitude: 128.876 })
    expect(ok(buildRequest("BASIC", base({ birthplace: "" }), null)).birthplace).toBeNull()
  })
  it("2인 풀이: other* 필드", () => {
    const o = base({ calType: "LUNAR", isLeapMonth: true, timeMode: "exact", birthHour: "7", birthMinute: "5", birthplace: "부산" })
    const b = ok(buildRequest("CONFLICT", base(), o))
    expect(b).toMatchObject({
      otherBirthYear: 1990, otherIsLeapMonth: true, otherTimeMode: "exact",
      otherBirthHour: 7, otherBirthMinute: 5, otherBirthplace: { name: "부산", longitude: 129.075 },
    })
  })
  it("필수값 누락 오류, 기존 필드 유지", () => {
    expect("error" in buildRequest("BASIC", base({ gender: "" }), null)).toBe(true)
    expect("error" in buildRequest("BULLY", base(), base({ birthDay: "" }))).toBe(true)
    const b = ok(buildRequest("MONEY", base({ name: "가" }), null))
    expect(b).toMatchObject({ readingType: "MONEY", name: "가", birthMonth: 5, birthDay: 10, gender: "M", calType: "SOLAR" })
  })
})

describe("기타", () => {
  it("서머타임 연도", () => {
    for (const y of ["1948", "1951", "1957", "1987", "1988"]) expect(isDstYear(y)).toBe(true)
    for (const y of ["1952", "1954", "1961", "1986", "1989", ""]) expect(isDstYear(y)).toBe(false)
  })
  it("출생지 20곳 안팎, 경도는 한반도 범위·소수 3자리 이내", () => {
    expect(PLACES.length).toBeGreaterThanOrEqual(18)
    for (const p of PLACES) {
      expect(p.longitude).toBeGreaterThan(125.9)
      expect(p.longitude).toBeLessThan(130)
      expect(Math.round(p.longitude * 1000) / 1000).toBe(p.longitude)
    }
  })
})
