// 골든 ① 절기 시각 — getSolarTermsUtc(year) vs 독립 오라클(astronomy-engine SearchSunLongitude)
// [확정 규칙 2026-11-27 총괄실장] 절기명은 한국 정자(번체) 표기.
// 표본: 1900~2100 매 5년(41개 연도) + 고정 시드 무작위 20개 연도, 연도마다 24절기 전부.
// 허용 오차: 2분. 이름은 한국 정자 표기(驚蟄·穀雨·小滿·芒種·處暑).
import { describe, expect, it } from "vitest"
import { getSolarTermsUtc } from "@/engine"
import { randInt, rng, solarTermsOracle } from "./oracle"
import { assertNoFailures, collect } from "./helpers"

const TOL_MS = 2 * 60_000
const years: number[] = []
for (let y = 1900; y <= 2100; y += 5) years.push(y)
{
  const r = rng(0x50_34_01) // P3-04 고정 시드
  while (years.length < 41 + 20) {
    const y = randInt(r, 1900, 2100)
    if (!years.includes(y)) years.push(y)
  }
}
years.sort((a, b) => a - b)

describe("골든 ① 절기 시각 getSolarTermsUtc", () => {
  it(`표본 연도 ${years.length}개 × 24절기`, () => {
    expect(years.length).toBe(61)
  })

  it("연도마다 24개, 시간순, ISO-8601 UTC 문자열", () => {
    const fails = collect(years, (y) => `${y}`, (y) => {
      const got = getSolarTermsUtc(y)
      if (got.length !== 24) return `개수 ${got.length}`
      for (let i = 0; i < 24; i++) {
        const ms = new Date(got[i].utc).getTime()
        if (Number.isNaN(ms)) return `utc 파싱 불가 ${got[i].utc}`
        if (!/(Z|[+-]00:00)$/.test(got[i].utc)) return `UTC 표기 아님 ${got[i].utc}`
        if (new Date(ms).getUTCFullYear() !== y) return `${got[i].name} ${got[i].utc} 연도 밖`
        if (i > 0 && ms <= new Date(got[i - 1].utc).getTime()) return `시간순 아님 @${i}`
      }
      return null
    })
    assertNoFailures(fails, years.length, "절기 목록 형식")
  })

  it("절기 시각 ±2분 (61개 연도 × 24 = 1,464건)", () => {
    const pairs = years.flatMap((y) => solarTermsOracle(y).map((t, i) => ({ y, i, t })))
    const cache = new Map<number, ReturnType<typeof getSolarTermsUtc>>()
    const fails = collect(pairs, (p) => `${p.y} ${p.t.name}`, (p) => {
      let got = cache.get(p.y)
      if (!got) {
        got = getSolarTermsUtc(p.y)
        cache.set(p.y, got)
      }
      const g = got[p.i]
      if (!g) return "없음"
      const d = new Date(g.utc).getTime() - p.t.ms
      return Math.abs(d) <= TOL_MS ? null : `엔진 ${g.utc} / 오라클 ${new Date(p.t.ms).toISOString()} (차 ${(d / 60_000).toFixed(2)}분)`
    })
    assertNoFailures(fails, pairs.length, "절기 시각")
  })

  it("절기 한자명 매핑 (0°=春分 … 315°=立春, 정자 표기)", () => {
    const pairs = years.flatMap((y) => solarTermsOracle(y).map((t, i) => ({ y, i, t })))
    const cache = new Map<number, ReturnType<typeof getSolarTermsUtc>>()
    const fails = collect(pairs, (p) => `${p.y} #${p.i}`, (p) => {
      let got = cache.get(p.y)
      if (!got) {
        got = getSolarTermsUtc(p.y)
        cache.set(p.y, got)
      }
      return got[p.i]?.name === p.t.name ? null : `엔진 "${got[p.i]?.name}" / 기대 "${p.t.name}"(${p.t.longitude}°)`
    })
    assertNoFailures(fails, pairs.length, "절기 이름")
  })

  // KASI 공식 발표 절기 시각 고정값: 2026-11-27 세션에서 astro.kasi.re.kr 원문 접속 불가(네트워크 차단).
  // 검색 인용으로 확인된 2026·2028 立春은 오라클 자체 점검(oracle-selfcheck)에서 오라클과 대조했다.
  // 원문 확인 후 엔진 고정 기대값으로 추가할 것.
  it.todo("KASI 월력요항 원문 절기 시각 고정값 (원문 열람 후 추가)")
})
