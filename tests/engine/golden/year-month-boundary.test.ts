// 골든 ③ 연주·월주 경계 — 오라클 절입 시각 앞뒤 3분~3시간 출생
// - 연주: 立春(황경 315°) 기준, 월주: 12節 기준 + 五虎遁
// - 입력은 한국 법정시 벽시계 시각. UTC→Asia/Seoul 변환은 Intl(IANA tzdb)로 독립 계산.
// - 출생 순간(분 단위로 자른 뒤)이 오라클 절입에서 3분 이내면 제외(엔진 허용 오차 2분 + 여유).
// - 서머타임 공백·중복 벽시계 시각은 제외(계약상 해석이 정해지지 않음).
// - 표본: (가) 표준시·서머타임 변경기 1948~1961·1987~1988 전 12節 × 앞뒤 + (나) 1912~2100 무작위 연도·節 × 앞뒤.
//   1900~1911(지방평균시 LMT +8:27:52 시기)은 '법정시' 정의가 모호해 제외 — 미검증.
// - 옵션은 기본값(DEFAULT_OPTIONS, 진태양시 적용). 계약상 절기는 UTC 순간으로 비교하므로 진태양시가 연·월주에 영향을 주면 안 된다.
import { describe, expect, it } from "vitest"
import { computeChart, type CalendarResult } from "@/engine"
import { randInt, rng, solarTermsOracle, yearMonthPillarsOracle, type OTerm } from "./oracle"
import { assertNoFailures, collect, fmtP, lbl, samePillar, seoulMinuteOf, solarInput } from "./helpers"

const MIN = 60_000
const r = rng(0x50_34_04)

interface Sample {
  jie: OTerm
  side: -1 | 1
  local: { year: number; month: number; day: number; hour: number; minute: number }
  utc: number
  gender: "M" | "F"
}

function makeSample(jie: OTerm, side: -1 | 1): Sample | null {
  const deltaMin = randInt(r, 3, 180)
  const raw = jie.ms + side * deltaMin * MIN
  const m = seoulMinuteOf(raw)
  if (!m) return null
  // 분 단위 절삭 후에도 같은 쪽, 3분 이상 떨어져 있어야 함
  const dist = (m.utc - jie.ms) * side
  if (dist < 3 * MIN) return null
  return { jie, side, local: m.local, utc: m.utc, gender: r() < 0.5 ? "M" : "F" }
}

const samples: Sample[] = []
const specialYears = [1948, 1949, 1950, 1951, 1954, 1955, 1956, 1957, 1958, 1959, 1960, 1961, 1987, 1988]
for (const y of specialYears) {
  for (const jie of solarTermsOracle(y).filter((t) => t.isJie)) {
    for (const side of [-1, 1] as const) {
      const s = makeSample(jie, side)
      if (s) samples.push(s)
    }
  }
}
for (let i = 0; i < 160; i++) {
  const y = randInt(r, 1912, 2100)
  const jies = solarTermsOracle(y).filter((t) => t.isJie)
  // 立春은 연주 경계라 비중을 높인다(1/3 확률)
  const jie = r() < 1 / 3 ? jies.find((t) => t.longitude === 315)! : jies[randInt(r, 0, 11)]
  for (const side of [-1, 1] as const) {
    const s = makeSample(jie, side)
    if (s) samples.push(s)
  }
}
const label = (s: Sample) => `${lbl(s.local)} KST (${s.jie.name}${s.side < 0 ? " 전" : " 후"} ${Math.round(Math.abs(s.utc - s.jie.ms) / MIN)}분)`

const chartCache = new Map<Sample, CalendarResult>()
const chartOf = (s: Sample) => {
  let c = chartCache.get(s)
  if (!c) {
    c = computeChart(solarInput(s.local, s.gender))
    chartCache.set(s, c)
  }
  return c
}

describe("골든 ③ 연주·월주 절입 경계", () => {
  it(`표본 ${samples.length}건(200건 이상), 立春 ${samples.filter((s) => s.jie.longitude === 315).length}건, 앞 ${samples.filter((s) => s.side < 0).length}·뒤 ${samples.filter((s) => s.side > 0).length}`, () => {
    expect(samples.length).toBeGreaterThanOrEqual(200)
    expect(samples.filter((s) => s.jie.longitude === 315).length).toBeGreaterThanOrEqual(50)
    expect(samples.filter((s) => s.side < 0).length).toBeGreaterThanOrEqual(90)
    expect(samples.filter((s) => s.side > 0).length).toBeGreaterThanOrEqual(90)
    // 경계 앞뒤에서 오라클 월주가 실제로 바뀌는지(표본 생성 검산)
    for (const s of samples) {
      const exp = yearMonthPillarsOracle(s.utc)
      expect(exp.prev.monthIdx).toBe(s.side > 0 ? s.jie.monthIdx : (s.jie.monthIdx + 11) % 12)
    }
  })

  it("utcInstant = Intl 독립 변환값 (분 단위 일치)", () => {
    const fails = collect(samples, label, (s) => {
      const got = new Date(chartOf(s).utcInstant).getTime()
      return Math.abs(got - s.utc) < 1000 ? null : `엔진 ${chartOf(s).utcInstant} / 기대 ${new Date(s.utc).toISOString()}`
    })
    assertNoFailures(fails, samples.length, "utcInstant")
  })

  it("연주 (立春 기준)", () => {
    const fails = collect(samples, label, (s) => {
      const exp = yearMonthPillarsOracle(s.utc).year
      const got = chartOf(s).pillars.year
      return samePillar(got, exp) ? null : `엔진 ${fmtP(got)} / 기대 ${fmtP(exp)}`
    })
    assertNoFailures(fails, samples.length, "연주")
  })

  it("월주 (12節 + 五虎遁)", () => {
    const fails = collect(samples, label, (s) => {
      const exp = yearMonthPillarsOracle(s.utc).month
      const got = chartOf(s).pillars.month
      return samePillar(got, exp) ? null : `엔진 ${fmtP(got)} / 기대 ${fmtP(exp)}`
    })
    assertNoFailures(fails, samples.length, "월주")
  })

  it("solarTerm.prev/next = 직전·다음 節 (이름 일치, 시각 ±2분)", () => {
    const fails = collect(samples, label, (s) => {
      const { prev, next } = yearMonthPillarsOracle(s.utc)
      const st = chartOf(s).solarTerm
      const errs: string[] = []
      if (st.prev.name !== prev.name) errs.push(`prev ${st.prev.name}≠${prev.name}`)
      if (st.next.name !== next.name) errs.push(`next ${st.next.name}≠${next.name}`)
      if (Math.abs(new Date(st.prev.utc).getTime() - prev.ms) > 2 * MIN) errs.push(`prev 시각 ${st.prev.utc}`)
      if (Math.abs(new Date(st.next.utc).getTime() - next.ms) > 2 * MIN) errs.push(`next 시각 ${st.next.utc}`)
      return errs.length ? errs.join(", ") : null
    })
    assertNoFailures(fails, samples.length, "solarTerm")
  })

  const nearCount = samples.filter((s) => Math.abs(s.utc - s.jie.ms) <= 110 * MIN).length
  it(`절입 110분 이내 출생 ${nearCount}건은 warnings에 경계 경고가 있어야 함 (계약 주석 예시 "절입 시각 2시간 이내")`, () => {
    const near = samples.filter((s) => Math.abs(s.utc - s.jie.ms) <= 110 * MIN)
    expect(near.length).toBeGreaterThan(50)
    const fails = collect(near, label, (s) => (chartOf(s).warnings.length > 0 ? null : "warnings 비어 있음"))
    assertNoFailures(fails, near.length, "경계 경고")
  })
})
