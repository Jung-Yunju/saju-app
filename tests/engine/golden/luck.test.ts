// 골든 ⑥ 대운 — 방향·대운수·대운 간지
// 규칙(독립 구현):
//   - 순행(forward): 양간(甲丙戊庚壬) 연주 + 남, 또는 음간 연주 + 여. 그 밖은 역행(backward)
//   - 대운수(정밀) = 출생 순간(UTC)에서 순행이면 다음 節까지, 역행이면 직전 節까지의 일수 ÷ 3  (허용 오차 0.05년)
//   - luckRounding "round" → startAge = 반올림, "floor" → 버림 (.5·정수 경계 ±0.06년 표본은 판정 제외)
//   - 대운 간지: 월주에서 순행이면 +1, +2 …, 역행이면 −1, −2 … (60갑자)
// 표본: 1912~2090 무작위 출생 200건(고정 시드), 성별 무작위. 節 10분 이내 출생과 서머타임 공백·중복 시각은 제외.
import { describe, expect, it } from "vitest"
import { computeChart, type CalendarResult } from "@/engine"
import {
  dateToDayNumber, dayNumberToDate, randInt, rng, sexagenary, sexagenaryIndex, YANG_STEMS, yearMonthPillarsOracle,
} from "./oracle"
import { assertNoFailures, collect, fmtP, lbl, samePillar, seoulMinuteOf, solarInput } from "./helpers"

const DAY = 86_400_000
const r = rng(0x50_34_06)
interface S {
  local: { year: number; month: number; day: number; hour: number; minute: number }
  utc: number
  gender: "M" | "F"
}
const samples: S[] = []
const lo = dateToDayNumber(1912, 1, 1)
const hi = dateToDayNumber(2090, 12, 31)
while (samples.length < 200) {
  const d = dayNumberToDate(randInt(r, lo, hi))
  const roughUtc = Date.UTC(d.year, d.month - 1, d.day, randInt(r, 0, 23), randInt(r, 0, 59)) - 9 * 3_600_000
  const m = seoulMinuteOf(roughUtc)
  const gender = r() < 0.5 ? "M" : "F"
  if (!m) continue
  const { prev, next } = yearMonthPillarsOracle(m.utc)
  if (m.utc - prev.ms < 10 * 60_000 || next.ms - m.utc < 10 * 60_000) continue
  samples.push({ local: m.local, utc: m.utc, gender })
}

function expected(s: S) {
  const o = yearMonthPillarsOracle(s.utc)
  const yang = YANG_STEMS.has(o.year.stem)
  const forward = (yang && s.gender === "M") || (!yang && s.gender === "F")
  const days = forward ? (o.next.ms - s.utc) / DAY : (s.utc - o.prev.ms) / DAY
  return { forward, exact: days / 3, month: o.month }
}
const label = (s: S) => `${lbl(s.local)} KST ${s.gender}`

const cache = new Map<string, CalendarResult>()
const chartOf = (s: S, rounding: "round" | "floor" = "round") => {
  const k = `${label(s)}|${rounding}`
  let c = cache.get(k)
  if (!c) {
    c = computeChart(solarInput(s.local, s.gender), { luckRounding: rounding })
    cache.set(k, c)
  }
  return c
}

describe("골든 ⑥ 대운", () => {
  it("표본 200건, 순행·역행 모두 포함", () => {
    expect(samples).toHaveLength(200)
    const f = samples.filter((s) => expected(s).forward).length
    expect(f).toBeGreaterThan(50)
    expect(200 - f).toBeGreaterThan(50)
  })

  it("luck.direction (연간 음양 × 성별)", () => {
    const fails = collect(samples, label, (s) => {
      const e = expected(s)
      const got = chartOf(s).luck.direction
      const exp = e.forward ? "forward" : "backward"
      return got === exp ? null : `엔진 ${got} / 기대 ${exp}`
    })
    assertNoFailures(fails, samples.length, "대운 방향")
  })

  it("luck.startAgeExact = 절입까지 일수 ÷ 3 (±0.05년)", () => {
    const fails = collect(samples, label, (s) => {
      const e = expected(s)
      const got = chartOf(s).luck.startAgeExact
      return Math.abs(got - e.exact) <= 0.05 ? null : `엔진 ${got} / 기대 ${e.exact.toFixed(3)}`
    })
    assertNoFailures(fails, samples.length, "대운수(정밀)")
  })

  it("luck.startAge — luckRounding round / floor", () => {
    const fails: string[] = []
    const total = { n: 0 }
    for (const rounding of ["round", "floor"] as const) {
      const pick = samples.filter((s) => {
        const x = expected(s).exact
        const frac = x - Math.floor(x)
        return rounding === "round" ? Math.abs(frac - 0.5) > 0.06 : frac > 0.06 && frac < 0.94
      })
      total.n += pick.length
      fails.push(...collect(pick, (s) => `${label(s)} [${rounding}]`, (s) => {
        const x = expected(s).exact
        const exp = rounding === "round" ? Math.round(x) : Math.floor(x)
        const got = chartOf(s, rounding).luck.startAge
        return got === exp ? null : `엔진 ${got} / 기대 ${exp} (정밀 ${x.toFixed(3)})`
      }))
    }
    assertNoFailures(fails, total.n, "대운수(환산)")
  })

  it("대운 간지 = 월주 ±1씩, index 1부터, 시작 나이 10년 간격, 시작 연도 ≈ 출생 연도 + 나이", () => {
    const fails = collect(samples, label, (s) => {
      const e = expected(s)
      const c = chartOf(s)
      const list = c.luck.daeun
      if (!list || list.length === 0) return "daeun 비어 있음"
      const m0 = sexagenaryIndex(e.month)
      const errs: string[] = []
      list.forEach((d, i) => {
        const exp = sexagenary(m0 + (e.forward ? i + 1 : -(i + 1)))
        if (d.index !== i + 1) errs.push(`#${i} index ${d.index}`)
        if (!samePillar(d.pillar, exp)) errs.push(`#${i + 1} ${fmtP(d.pillar)}≠${fmtP(exp)}`)
        if (d.startAge !== c.luck.startAge + 10 * i) errs.push(`#${i + 1} startAge ${d.startAge}`)
        const dy = d.startYear - s.local.year - d.startAge
        if (dy < -1 || dy > 1) errs.push(`#${i + 1} startYear ${d.startYear}`)
      })
      return errs.length ? errs.slice(0, 4).join(", ") : null
    })
    assertNoFailures(fails, samples.length, "대운 간지")
  })
})
