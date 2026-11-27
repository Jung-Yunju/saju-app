// 골든 ④-2 서머타임·표준시 변경 때의 '없는 시각'(공백)과 '두 번 있는 시각'(겹침)
//
// 확정 규칙(총괄실장 결정 2026-11-27, docs/SAJU_ENGINE.md 시간 보정 3항 — TC39 Temporal disambiguation "compatible"):
//   - 겹침: 앞선 순간(전환 전 오프셋)으로 본다.
//   - 공백: 전환 전 오프셋으로 해석한다 → 결과는 공백 길이만큼 뒤의 벽시계 시각(예: 1987-05-10 02:30 → 서머타임 03:30).
//   - 두 경우 모두 warnings에 표시한다.
// 파생 기대값(계약 types.ts 주석에서 도출):
//   - corrections.utcOffsetMinutes = "출생 순간" 해당 지역 오프셋 → 결과 UTC 순간의 Intl 오프셋
//   - 일주·시주 = 보정 시각(UTC + 오프셋, trueSolarTime:false) 기준. 자시는 기본 nextDay.
//
// 독립성: 기대값은 엔진 코드·엔진 테스트를 보지 않고 아래 두 근거로만 정했다.
//   (1) IANA tzdb `asia` Korea 절 규칙(timezone-history.test.ts 머리말 참조)
//   (2) Node 내장 Intl(ICU tzdata 2026e)로 전환 시각을 15분 간격 전수 탐색한 결과
//       1987-05-09T17:00Z +9→+10 / 1987-10-10T17:00Z +10→+9 / 1988-05-07T17:00Z / 1988-10-08T17:00Z
//       1955-05-04T15:30Z +8:30→+9:30 / 1960-09-17T14:30Z +9:30→+8:30
//       1954-03-20T15:00Z +9→+8:30 (표준시 변경) / 1961-08-09T15:30Z +8:30→+9 (표준시 변경)
//   아래 '기대값 검산' 테스트가 (2)를 매번 다시 확인한다.
import { describe, expect, it } from "vitest"
import { computeChart } from "@/engine"
import { dayPillarOracle, hourPillarOracle, localToUtcCandidates, utcOffsetMinutesAt, utcToLocal } from "./oracle"
import { assertNoFailures, collect, fmtP, lbl, samePillar, SEOUL, solarInput } from "./helpers"

const B = { 子: 0, 丑: 1, 寅: 2, 卯: 3, 辰: 4, 巳: 5, 午: 6, 未: 7, 申: 8, 酉: 9, 戌: 10, 亥: 11 } as const

interface Case {
  kind: "gap" | "overlap"
  local: { year: number; month: number; day: number; hour: number; minute: number }
  /** 규칙 적용 후 UTC 순간 */
  utc: string
  offset: number
  dst: boolean
  /** 보정 시각(진태양시 미적용) 벽시계 */
  resultLocal: string
  hourBranch: keyof typeof B
  /** 일주 날짜 (nextDay: 23시대는 다음 날) */
  dayDate: [number, number, number]
  why: string
}

const L = (year: number, month: number, day: number, hour: number, minute: number) => ({ year, month, day, hour, minute })

const cases: Case[] = [
  // ── 공백 (없는 시각) ──
  { kind: "gap", local: L(1987, 5, 10, 2, 30), utc: "1987-05-09T17:30:00.000Z", offset: 600, dst: true,
    resultLocal: "1987-05-10 03:30", hourBranch: "寅", dayDate: [1987, 5, 10], why: "1987 서머타임 시작 공백 02:00~02:59 (계약 예시)" },
  { kind: "gap", local: L(1988, 5, 8, 2, 0), utc: "1988-05-07T17:00:00.000Z", offset: 600, dst: true,
    resultLocal: "1988-05-08 03:00", hourBranch: "寅", dayDate: [1988, 5, 8], why: "1988 서머타임 시작 공백의 첫 분" },
  { kind: "gap", local: L(1955, 5, 5, 0, 30), utc: "1955-05-04T16:00:00.000Z", offset: 570, dst: true,
    resultLocal: "1955-05-05 01:30", hourBranch: "丑", dayDate: [1955, 5, 5], why: "1955 서머타임 시작(+8:30→+9:30) 공백 00:00~00:59" },
  { kind: "gap", local: L(1961, 8, 10, 0, 15), utc: "1961-08-09T15:45:00.000Z", offset: 540, dst: false,
    resultLocal: "1961-08-10 00:45", hourBranch: "子", dayDate: [1961, 8, 10], why: "1961 표준시 변경(+8:30→+9) 공백 00:00~00:29, 서머타임 아님" },
  // ── 겹침 (두 번 있는 시각) ──
  { kind: "overlap", local: L(1987, 10, 11, 2, 30), utc: "1987-10-10T16:30:00.000Z", offset: 600, dst: true,
    resultLocal: "1987-10-11 02:30", hourBranch: "丑", dayDate: [1987, 10, 11], why: "1987 서머타임 종료 겹침 02:00~02:59 → 서머타임 쪽" },
  { kind: "overlap", local: L(1988, 10, 9, 2, 59), utc: "1988-10-08T16:59:00.000Z", offset: 600, dst: true,
    resultLocal: "1988-10-09 02:59", hourBranch: "丑", dayDate: [1988, 10, 9], why: "1988 서머타임 종료 겹침의 마지막 분" },
  { kind: "overlap", local: L(1960, 9, 17, 23, 30), utc: "1960-09-17T14:00:00.000Z", offset: 570, dst: true,
    resultLocal: "1960-09-17 23:30", hourBranch: "子", dayDate: [1960, 9, 18], why: "1960 서머타임 종료 겹침 23:00~23:59 + 자시(nextDay)" },
  { kind: "overlap", local: L(1954, 3, 20, 23, 45), utc: "1954-03-20T14:45:00.000Z", offset: 540, dst: false,
    resultLocal: "1954-03-20 23:45", hourBranch: "子", dayDate: [1954, 3, 21], why: "1954 표준시 변경(+9→+8:30) 겹침 23:30~23:59, 서머타임 아님" },
]

const label = (c: Case) => `${lbl(c.local)} [${c.why}]`
const fmtLocal = (ms: number) => {
  const l = utcToLocal(ms, SEOUL)
  return lbl(l)
}
/** 서머타임·표준시 전환에 따른 해석을 알리는 경고인지 (문구는 계약에 없어 주제어로만 판정) */
const AMBIG_WARNING_RE = /서머타임|일광|DST|summer|daylight|표준시|중복|겹|두 번|존재하지 않|없는 (벽시계 )?시각|공백|모호/i

describe("골든 ④-2 서머타임 공백·겹침 (compatible 규칙)", () => {
  it("공백·겹침 각 2건 이상", () => {
    expect(cases.filter((c) => c.kind === "gap").length).toBeGreaterThanOrEqual(2)
    expect(cases.filter((c) => c.kind === "overlap").length).toBeGreaterThanOrEqual(2)
  })

  it("기대값 검산: Intl 후보 수(공백 0개·겹침 2개)와 규칙 적용 결과가 표와 일치", () => {
    for (const c of cases) {
      const cand = localToUtcCandidates(c.local, SEOUL)
      const wall = Date.UTC(c.local.year, c.local.month - 1, c.local.day, c.local.hour, c.local.minute)
      let exp: number
      if (c.kind === "overlap") {
        expect(cand.length, label(c)).toBe(2)
        exp = cand[0] // 앞선 순간
      } else {
        expect(cand.length, label(c)).toBe(0)
        // 전환 전 오프셋 = 12시간 전 순간의 오프셋 (전환이 12시간 안에 두 번 일어나지 않음)
        const before = utcOffsetMinutesAt(wall - 540 * 60_000 - 12 * 3_600_000, SEOUL)
        exp = wall - before * 60_000
      }
      expect(new Date(exp).toISOString(), label(c)).toBe(c.utc)
      expect(utcOffsetMinutesAt(exp, SEOUL), label(c)).toBe(c.offset)
      expect(fmtLocal(exp), label(c)).toBe(c.resultLocal)
    }
  })

  it(`utcInstant = 규칙 적용 순간 (${cases.length}건, 진태양시 적용·미적용 모두)`, () => {
    const fails = collect(cases, label, (c) => {
      const errs: string[] = []
      for (const trueSolarTime of [false, true]) {
        const chart = computeChart(solarInput(c.local), { trueSolarTime })
        const got = new Date(chart.utcInstant).getTime()
        if (got !== new Date(c.utc).getTime()) errs.push(`tst=${trueSolarTime} utcInstant ${chart.utcInstant}≠${c.utc}`)
      }
      return errs.length ? errs.join(", ") : null
    })
    assertNoFailures(fails, cases.length, "공백·겹침 utcInstant")
  })

  it(`corrections.utcOffsetMinutes·dstApplied = 결과 순간의 값 (${cases.length}건)`, () => {
    const fails = collect(cases, label, (c) => {
      const chart = computeChart(solarInput(c.local), { trueSolarTime: false })
      const errs: string[] = []
      if (chart.corrections.utcOffsetMinutes !== c.offset) errs.push(`offset ${chart.corrections.utcOffsetMinutes}≠${c.offset}`)
      if (chart.corrections.dstApplied !== c.dst) errs.push(`dst ${chart.corrections.dstApplied}≠${c.dst}`)
      return errs.length ? errs.join(", ") : null
    })
    assertNoFailures(fails, cases.length, "공백·겹침 오프셋")
  })

  it(`일주·시주 = 결과 벽시계 기준 (trueSolarTime:false, ${cases.length}건)`, () => {
    const fails = collect(cases, label, (c) => {
      const chart = computeChart(solarInput(c.local), { trueSolarTime: false })
      const day = dayPillarOracle(...c.dayDate)
      const hour = hourPillarOracle(day.stem, B[c.hourBranch])
      const errs: string[] = []
      if (!samePillar(chart.pillars.day, day)) errs.push(`일주 ${fmtP(chart.pillars.day)}≠${fmtP(day)}`)
      if (!samePillar(chart.pillars.hour, hour)) errs.push(`시주 ${fmtP(chart.pillars.hour)}≠${fmtP(hour)}`)
      return errs.length ? errs.join(", ") : null
    })
    assertNoFailures(fails, cases.length, "공백·겹침 일주·시주")
  })

  it(`warnings에 서머타임·표준시 전환 해석 경고 (${cases.length}건)`, () => {
    const fails = collect(cases, label, (c) => {
      const w = computeChart(solarInput(c.local), { trueSolarTime: false }).warnings
      return w.some((x) => AMBIG_WARNING_RE.test(x)) ? null : `경고 없음 ${JSON.stringify(w)}`
    })
    assertNoFailures(fails, cases.length, "공백·겹침 경고")
  })

  it("대조군: 같은 날 모호하지 않은 시각에는 전환 해석 경고가 없어야 함 (과잉 경고 방지)", () => {
    const controls = [L(1987, 5, 10, 12, 0), L(1987, 10, 11, 12, 0), L(1960, 9, 17, 12, 0), L(1955, 5, 5, 12, 0)]
    const fails = collect(controls, lbl, (l) => {
      expect(localToUtcCandidates(l, SEOUL).length).toBe(1)
      const w = computeChart(solarInput(l), { trueSolarTime: false }).warnings
      const hit = w.filter((x) => /중복|겹|두 번|존재하지 않|없는 (벽시계 )?시각|공백|모호/.test(x))
      return hit.length ? `불필요한 경고 ${JSON.stringify(hit)}` : null
    })
    assertNoFailures(fails, controls.length, "대조군 경고")
  })
})
