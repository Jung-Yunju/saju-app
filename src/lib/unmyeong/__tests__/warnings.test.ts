import { describe, expect, it } from "vitest"
import { buildSajuInputFromRequest, ZI_BOUNDARY_WARNING } from "@/lib/saju-input"
import { buildUnmyeongFree, validateUnmyeongFreeRequest } from "@/lib/unmyeong/free"
import { FRIENDLY_WARNINGS as W, friendlyWarnings } from "@/lib/unmyeong/warnings"

const person = (body: unknown) => {
  const v = validateUnmyeongFreeRequest(body)
  if (!v.ok) throw new Error(v.error)
  return v.value
}
const exact = (y: number, m: number, d: number, h: number, minute = 0) =>
  ({ birthYear: y, birthMonth: m, birthDay: d, birthHour: h, birthMinute: minute, timeMode: "exact", gender: "F", calType: "SOLAR" })

describe("friendlyWarnings — 원문을 쉬운 문장으로(시각·날짜 숫자 없음)", () => {
  it("원문 형식별 변환", () => {
    expect(friendlyWarnings(["절입(立春 1990-02-04 11:14) 2시간 이내 출생 — 연주·월주 경계"])).toEqual([W.termBoundaryYear])
    expect(friendlyWarnings(["절입(驚蟄 1990-03-06 05:19) 2시간 이내 출생 — 월주 경계"])).toEqual([W.termBoundaryMonth])
    expect(friendlyWarnings(["출생일에 절입(立春 1990-02-04 11:14) 있음 — 시각에 따라 연주·월주가 달라질 수 있음(불확실)"])).toEqual([W.termDayYear])
    expect(friendlyWarnings(["출생일에 절입(驚蟄 1990-03-06 05:19) 있음 — 시각에 따라 월주가 달라질 수 있음(불확실)"])).toEqual([W.termDayMonth])
    expect(friendlyWarnings(["시지 경계 10분 이내 출생(보정 후 13:02) — 시주 경계"])).toEqual([W.hourBoundary])
    expect(friendlyWarnings(["시지 경계 10분 이내 출생(보정 후 23:01) — 시주·일주 경계"])).toEqual([W.hourDayBoundary])
    expect(friendlyWarnings(["자정 10분 이내 출생(야자시 설정) — 일주 경계"])).toEqual([W.midnight])
    expect(friendlyWarnings([ZI_BOUNDARY_WARNING])).toEqual([W.ziUnknown])
    expect(friendlyWarnings(["진태양시 보정(−32.1분)으로 시지가 午→巳로 바뀜"])).toEqual([W.solarHourShift])
    expect(friendlyWarnings(["진태양시 보정(−32.1분)으로 현지 날짜가 1990-2-3로 바뀜"])).toEqual([W.solarDayShift])
    expect(friendlyWarnings(["시간대 전환(서머타임 종료 등)으로 같은 현지시각이 두 번 있음 — 앞선 시각(+10:00)으로 계산함."])).toEqual([W.dst])
    expect(friendlyWarnings(["선택한 시진(오시)과 계산된 시지(巳)가 다름 — 서머타임"])).toEqual([W.sijinMismatch])
    const lunar = "이 음력 달은 합삭이 한국시 자정 ±3분 이내 — 공식 역서와 음력·양력 변환이 하루 다를 수 있음"
    expect(friendlyWarnings([lunar], { lunarInput: true })).toEqual([W.lunarConvert])
    expect(friendlyWarnings([lunar])).toEqual([])
  })

  it("필요 없는 안내·모르는 원문은 버린다, 같은 문장은 한 번만", () => {
    expect(friendlyWarnings(["태어난 시각 모름 — 현지 정오(12:00) 가정으로 연·월·일주와 대운수를 계산하고 시주는 제외함"])).toEqual([])
    expect(friendlyWarnings(["태어난 시각 모름 — 현지 정오(12:00) 가정으로 … (23시 이후 출생이면 일주가 다음 날로 바뀔 수 있음)"])).toEqual([W.hourUnknownLateNight])
    expect(friendlyWarnings(["시진 선택(오시) — 정확한 분을 몰라 시진 가운데 12:00로 계산"])).toEqual([])
    expect(friendlyWarnings(["표준시 제정 전 시기 — 지방평균시(LMT, +08:27) 기준으로 계산함"])).toEqual([])
    expect(friendlyWarnings(["처음 보는 경고 1990-02-04 11:14"])).toEqual([])
    expect(friendlyWarnings(["절입(立春 x) — 연주·월주 경계", "절입(立春 y) — 연주·월주 경계"])).toEqual([W.termBoundaryYear])
    expect(friendlyWarnings(undefined)).toEqual([])
  })

  it("안내 문장에는 숫자가 없다", () => {
    for (const s of Object.values(W)) expect(s, s).not.toMatch(/\d/)
  })
})

describe("응답 warnings — 원문(시각 값)을 싣지 않는다", () => {
  it("입춘 2시간 이내 출생: 원문에는 절입 시각이 있지만 응답은 쉬운 문장뿐", () => {
    const p = person(exact(1990, 2, 4, 10))
    expect(buildSajuInputFromRequest(p).warnings?.join("\n")).toMatch(/11:14/)
    const r = buildUnmyeongFree(p, { freeCopy: null })
    expect(r.warnings).toEqual([W.termBoundaryYear])
  })

  it("경칩 무렵 + 진태양시 시지 변경", () => {
    const r = buildUnmyeongFree(person(exact(1990, 3, 6, 5)), { freeCopy: null })
    expect(r.warnings).toEqual([W.solarHourShift, W.termBoundaryMonth])
  })

  it("시각 모름 + 출생일 입춘", () => {
    const r = buildUnmyeongFree(person({ birthYear: 1990, birthMonth: 2, birthDay: 4, birthHour: null, gender: "F", calType: "SOLAR" }), { freeCopy: null })
    expect(r.warnings).toEqual([W.hourUnknownLateNight, W.termDayYear])
  })

  it("자시 시진(자정 전후 모름)", () => {
    const r = buildUnmyeongFree(person({ birthYear: 1990, birthMonth: 5, birthDay: 15, birthHour: 0, timeMode: "sijin", gender: "M", calType: "SOLAR" }), { freeCopy: null })
    expect(r.warnings).toContain(W.ziUnknown)
  })

  it("여러 입력에서 응답 warnings에 숫자·한자 시지·날짜가 없다", () => {
    for (let m = 1; m <= 12; m++) for (const d of [4, 5, 6, 7, 8]) for (const h of [0, 5, 11, 23]) {
      const r = buildUnmyeongFree(person(exact(1985, m, d, h, 55)), { freeCopy: null })
      for (const w of r.warnings) expect(w, `${m}-${d} ${h}`).not.toMatch(/\d|[子丑寅卯辰巳午未申酉戌亥]|立春|驚蟄/)
    }
  })
})
