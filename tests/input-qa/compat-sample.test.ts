// U-03 독립 검증(품질검증 담당) — 예전 요청(새 필드 없음) 호환성과 "짝수 시 → 시진 가운데" 변경의 영향 범위
// 표본: 고정 씨앗 난수(mulberry32, seed 20261127)로 만든 예전 화면 형식 요청 1,000건
//   예전 화면 = 시진 버튼(자시 0·축시 2 … 해시 22, 짝수 시) 또는 '모름'(null), 분·출생지·윤달 없음
// 비교: 예전 계산 buildSajuInput(옵션 없음 = 시:00, 서울 경도) ↔ 새 라우트 경로(validateReadingRequest → buildSajuInputFromRequest)
import { describe, expect, it } from "vitest"
import { validateReadingRequest } from "@/lib/validate"
import { buildSajuInput, buildSajuInputFromRequest, type SajuInputData } from "@/lib/saju-input"
import { EngineInputError } from "@/engine"

const NOW = new Date("2026-11-27T00:00:00Z")
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
type OldReq = { readingType: string; birthYear: number; birthMonth: number; birthDay: number; birthHour: number | null; gender: string; calType: string }

function sample(n: number, hours: (number | null)[], seed: number): OldReq[] {
  const rnd = mulberry32(seed)
  const out: OldReq[] = []
  while (out.length < n) {
    const calType = rnd() < 0.8 ? "SOLAR" : "LUNAR"
    const y = 1900 + Math.floor(rnd() * 125) // 1900~2024
    const m = 1 + Math.floor(rnd() * 12)
    const d = 1 + Math.floor(rnd() * (calType === "LUNAR" ? 30 : 31))
    const h = hours[Math.floor(rnd() * hours.length)]
    const r: OldReq = { readingType: "BASIC", birthYear: y, birthMonth: m, birthDay: d, birthHour: h, gender: rnd() < 0.5 ? "M" : "F", calType }
    const v = validateReadingRequest(r)
    if (!v.ok) continue // 없는 양력 날짜는 예전에도 400
    try { buildSajuInput(y, m, d, h, r.gender, calType, undefined, false, { now: NOW }) } catch (e) {
      if (e instanceof EngineInputError) continue // 그 달에 없는 음력 30일 등은 예전에도 400
      throw e
    }
    out.push(r)
  }
  return out
}
function pair(r: OldReq): { old: SajuInputData; neu: SajuInputData } {
  const old = buildSajuInput(r.birthYear, r.birthMonth, r.birthDay, r.birthHour, r.gender, r.calType, undefined, false, { now: NOW })
  const v = validateReadingRequest(r)
  if (!v.ok) throw new Error(v.error)
  const x = v.value
  const neu = buildSajuInputFromRequest({ ...x, year: x.birthYear, month: x.birthMonth, day: x.birthDay, hour: x.birthHour }, undefined, { now: NOW })
  return { old, neu }
}
const pct = (a: number, n: number) => `${a}/${n} (${((a / n) * 100).toFixed(1)}%)`

describe("예전 요청 호환성", () => {
  it("시 모름·홀수 시(예전 exact) 300건: 원국·대운·공망이 예전과 완전히 같다(새 키 time_mode만 추가)", () => {
    const odd = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23]
    for (const r of sample(300, [null, ...odd], 7)) {
      const { old, neu } = pair(r)
      expect(neu.pillars).toEqual(old.pillars)
      expect(neu.daeun).toEqual(old.daeun)
      expect(neu.gongmang).toEqual(old.gongmang)
      expect(neu.birth).toBe(old.birth)
      expect(neu.warnings).toEqual(old.warnings)
      if (r.birthHour === null) expect("time_mode" in neu).toBe(false)
      else expect(neu).toMatchObject({ time_mode: "exact", birth_minute: null })
    }
  })

  it("짝수 시(예전 시진 버튼) 1,000건: 월주·일주·시주·대운수 변경 비율 측정", () => {
    const even = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]
    const rows = sample(1000, even, 20261127)
    expect(rows.length).toBe(1000)
    let year = 0, month = 0, day = 0, hour = 0, age = 0, startYear = 0, any = 0
    const hourCases: string[] = [], monthCases: string[] = [], ageCases: string[] = []
    for (const r of rows) {
      const { old, neu } = pair(r)
      const key = `${r.calType} ${r.birthYear}-${r.birthMonth}-${r.birthDay} ${r.birthHour}시`
      // 자시(0)는 자정 전후를 모르면 예전처럼 00:00 → 원국 그대로여야 한다
      if (r.birthHour === 0) {
        expect(neu.birth).toBe(old.birth)
        expect(neu.pillars).toEqual(old.pillars)
      } else {
        expect(neu.birth).toBe(old.birth.replace(/:00$/, ":30"))
      }
      expect(neu.time_mode).toBe("sijin")
      const ch = {
        y: neu.pillars.year !== old.pillars.year, m: neu.pillars.month !== old.pillars.month,
        d: neu.pillars.day !== old.pillars.day, h: neu.pillars.hour !== old.pillars.hour,
        a: neu.daeun[0].start_age !== old.daeun[0].start_age, s: neu.daeun[0].start_year !== old.daeun[0].start_year,
      }
      if (ch.y) year++
      if (ch.m) { month++; monthCases.push(`${key} ${old.pillars.month}→${neu.pillars.month}`) }
      if (ch.d) day++
      if (ch.h) { hour++; hourCases.push(`${key} ${old.pillars.hour}→${neu.pillars.hour}`) }
      if (ch.a) { age++; ageCases.push(`${key} ${old.daeun[0].start_age}→${neu.daeun[0].start_age}`) }
      if (ch.s) startYear++
      if (ch.y || ch.m || ch.d || ch.h || ch.a) any++
    }
    console.log(
      `[U-03 QA] 짝수 시 1,000건 변경: 연주 ${pct(year, 1000)}, 월주 ${pct(month, 1000)}, 일주 ${pct(day, 1000)}, ` +
        `시주 ${pct(hour, 1000)}, 대운수 ${pct(age, 1000)}, 첫 대운 시작 연도 ${pct(startYear, 1000)}, 하나라도 ${pct(any, 1000)}\n` +
        `  시주 변경: ${hourCases.join(" / ") || "없음"}\n  월주 변경: ${monthCases.join(" / ") || "없음"}\n  대운수 변경: ${ageCases.join(" / ") || "없음"}`,
    )
    // 의도된 변경의 범위: 일주는 바뀌지 않아야 한다(30분 이동으로 23시 경계를 넘지 않음)
    expect(day).toBe(0)
    // 측정 기준선(seed 고정) — 값이 바뀌면 계산 규칙이 바뀐 것이므로 원인을 확인한다
    expect({ year, month, day, hour, age }).toMatchSnapshot()
  })
})
