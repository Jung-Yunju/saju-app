// U-03 독립 검증(품질검증 담당) — 시진 선택의 계산 정확성
// 시진 12개(자시는 생략/자정 전 밤/자정 후 3가지) × 경도 6곳 × 시기 7종(표준시 2·UTC+8:30 2·서머타임 3).
// 판정 기준: (1) 선택 시진 = 계산 시지, 아니면 "선택한 시진…" 경고가 반드시 붙는다(불변 조건)
//            (2) 표준시 UTC+9 시기에는 모든 경도에서 선택 시진 = 계산 시지
//            (3) 자시 23:45/00:45가 ziHour 두 옵션에서 의도한 날짜, 실제 23:50(exact)과 "자정 전 밤"의 일주·시주 동일
// [결함]으로 표시된 it.fails는 "의도한 동작"을 적은 것이라 지금은 실패해야 통과한다. 수정되면 it로 바꾼다.
import { describe, expect, it } from "vitest"
import { computeChart, dayPillarOf, type EngineOptions } from "@/engine"
import { buildSajuInput, sijinRepresentativeTime } from "@/lib/saju-input"

const BR = "子丑寅卯辰巳午未申酉戌亥"
/** 경도: 서울·부산·목포·포항은 화면 PLACES 값, 강화도(군청 부근)·독도는 경도 양 끝 확인용 근사값 */
const LON = { 서울: 126.978, 부산: 129.075, 목포: 126.392, 포항: 129.365, 강화도: 126.488, 독도: 131.867 } as const
type Ymd = [number, number, number]
const STANDARD: Record<string, Ymd> = { "1990-05-10(UTC+9)": [1990, 5, 10], "2000-01-15(UTC+9)": [2000, 1, 15] }
const UTC830: Record<string, Ymd> = { "1955-01-15(UTC+8:30)": [1955, 1, 15], "1960-01-15(UTC+8:30)": [1960, 1, 15] }
const DST: Record<string, Ymd> = {
  "1949-07-15(서머타임 UTC+10)": [1949, 7, 15],
  "1955-07-15(서머타임 UTC+9:30)": [1955, 7, 15],
  "1987-07-15(서머타임 UTC+10)": [1987, 7, 15],
}
const ALL = { ...STANDARD, ...UTC830, ...DST }
const ZI = [undefined, true, false] as const
const g = (p: { stem: string; branch: string }) => p.stem + p.branch
const nextDay = ([y, m, d]: Ymd): Ymd => {
  const t = new Date(Date.UTC(y, m - 1, d + 1))
  return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()]
}
const MISMATCH = "선택한 시진"

function sijin([y, m, d]: Ymd, hour: number, lon: number, ziNight?: boolean) {
  const si = buildSajuInput(y, m, d, hour, "F", "SOLAR", undefined, false, {
    timeMode: "sijin", ...(ziNight !== undefined ? { ziNight } : {}), birthplace: { name: "검증지", longitude: lon },
  })
  return { got: si.pillars.hour![1], warned: si.warnings!.some(w => w.startsWith(MISMATCH)), si }
}
function chart([y, m, d]: Ymd, time: { hour: number; minute: number }, lon: number, ziHour: EngineOptions["ziHour"]) {
  return computeChart({ calendar: "solar", year: y, month: m, day: d, time, timezone: "Asia/Seoul", longitude: lon, gender: "F" }, { ziHour })
}

describe("시진 선택 → 계산 시지", () => {
  it("불변 조건: 모든 시기·경도에서 선택 ≠ 계산이면 경고가 붙는다(7개 시기 × 6곳 × 14가지 = 588건)", () => {
    const table: string[] = []
    let n = 0, mism = 0
    for (const [pn, ymd] of Object.entries(ALL)) for (const [pl, lon] of Object.entries(LON)) {
      const row: string[] = []
      for (let i = 0; i < 12; i++) for (const z of i === 0 ? ZI : [undefined]) {
        const r = sijin(ymd, i * 2, lon, z)
        n++
        if (r.got !== BR[i]) {
          mism++
          expect(r.warned, `${pn} ${pl} ${BR[i]}시 z=${String(z)}`).toBe(true)
          row.push(`${BR[i]}${z === true ? "(밤)" : z === false ? "(새벽)" : ""}→${r.got}`)
        } else {
          expect(r.warned).toBe(false)
        }
      }
      if (row.length) table.push(`${pn} ${pl}: ${row.join(" ")}`)
    }
    expect(n).toBe(Object.keys(ALL).length * 6 * 14)
    console.log(`[U-03 QA] 시진 불일치 ${mism}/${n}건 (모두 경고 붙음)\n` + table.join("\n"))
  })

  it("표준시 UTC+9 시기: 6개 경도 × 시진 14가지 모두 선택 = 계산", () => {
    for (const ymd of Object.values(STANDARD)) for (const lon of Object.values(LON)) {
      for (let i = 0; i < 12; i++) for (const z of i === 0 ? ZI : [undefined]) {
        expect(sijin(ymd, i * 2, lon, z).got).toBe(BR[i])
      }
    }
  })

  it("UTC+8:30 시기: 동경 131도 미만(PLACES 20곳 포함)은 모두 선택 = 계산", () => {
    for (const ymd of Object.values(UTC830)) for (const [pl, lon] of Object.entries(LON)) {
      if (pl === "독도") continue
      for (let i = 0; i < 12; i++) for (const z of i === 0 ? ZI : [undefined]) expect(sijin(ymd, i * 2, lon, z).got).toBe(BR[i])
    }
  })

  it.fails("[결함 D1] UTC+8:30 시기 독도: 자시(자정 후) 00:45 → 보정 +17.5분으로 01:02 丑시가 된다", () => {
    expect(sijin(UTC830["1955-01-15(UTC+8:30)"], 0, LON.독도, false).got).toBe("子")
  })

  it.fails("[결함 D1] 1987 서머타임 서울: 축시~해시를 골라도 한 칸 앞 시지로 계산된다(축시 02:30 → 보정 −92분 00:58 子)", () => {
    for (let i = 1; i < 12; i++) expect(sijin(DST["1987-07-15(서머타임 UTC+10)"], i * 2, LON.서울).got).toBe(BR[i])
  })

  it("[결함 D1 범위] 서머타임 시기 불일치 건수 고정(수정 전 기준선)", () => {
    const count = (ymd: Ymd, lon: number) => {
      let c = 0
      for (let i = 0; i < 12; i++) for (const z of i === 0 ? ZI : [undefined]) if (sijin(ymd, i * 2, lon, z).got !== BR[i]) c++
      return c
    }
    // 1987(UTC+10): 서울·목포·강화도는 14가지 중 13가지 불일치(자시 새벽만 일치), 부산·포항·독도는 자시 2가지
    expect(count(DST["1987-07-15(서머타임 UTC+10)"], LON.서울)).toBe(13)
    expect(count(DST["1987-07-15(서머타임 UTC+10)"], LON.부산)).toBe(2)
    expect(count(DST["1949-07-15(서머타임 UTC+10)"], LON.목포)).toBe(13)
    // 1955 여름(UTC+9:30): 서울은 자시(생략·밤) 2가지
    expect(count(DST["1955-07-15(서머타임 UTC+9:30)"], LON.서울)).toBe(2)
  })
})

describe("자시 23:45 / 00:45 — ziHour 두 옵션의 날짜", () => {
  it("표준시·UTC+8:30 시기(독도 제외): 자정 전 밤 = nextDay에선 다음 날 일주, yajasi에선 그날 일주 / 자정 후 = 두 옵션 모두 그날 일주, 시지 子", () => {
    for (const ymd of [...Object.values(STANDARD), ...Object.values(UTC830)]) for (const [pl, lon] of Object.entries(LON)) {
      if (pl === "독도" && Object.values(UTC830).includes(ymd)) continue
      const same = g(dayPillarOf(...ymd)), next = g(dayPillarOf(...nextDay(ymd)))
      const night = sijinRepresentativeTime(0, true), dawn = sijinRepresentativeTime(0, false)
      expect(night).toEqual({ hour: 23, minute: 45 })
      expect(dawn).toEqual({ hour: 0, minute: 45 })
      const nN = chart(ymd, night, lon, "nextDay"), nY = chart(ymd, night, lon, "yajasi")
      const dN = chart(ymd, dawn, lon, "nextDay"), dY = chart(ymd, dawn, lon, "yajasi")
      expect(g(nN.pillars.day), `${pl} ${ymd}`).toBe(next)
      expect(g(nY.pillars.day)).toBe(same)
      expect(g(dN.pillars.day)).toBe(same)
      expect(g(dY.pillars.day)).toBe(same)
      for (const c of [nN, nY, dN, dY]) expect(c.pillars.hour!.branch).toBe("子")
      // 야자시: 밤 자시의 시간(時干)은 다음 날 일간 기준 → 두 옵션의 시주가 같아야 한다
      expect(g(nY.pillars.hour!)).toBe(g(nN.pillars.hour!))
    }
  })

  it.fails("[결함 D1] 1987 서머타임: '자정 전 밤'을 골라도 23:45 → 보정 후 22:13 亥시·그날 일주가 된다(nextDay 의도: 다음 날 일주·子시)", () => {
    const ymd = DST["1987-07-15(서머타임 UTC+10)"]
    const c = chart(ymd, sijinRepresentativeTime(0, true), LON.서울, "nextDay")
    expect(c.pillars.hour!.branch).toBe("子")
    expect(g(c.pillars.day)).toBe(g(dayPillarOf(...nextDay(ymd))))
  })

  it("[관찰] 서머타임 + yajasi 옵션: '자정 후' 00:45가 보정 후 전날 23시대가 되어 전날 일주(기본값 nextDay에서는 그날 일주)", () => {
    const ymd = DST["1987-07-15(서머타임 UTC+10)"]
    const c = chart(ymd, sijinRepresentativeTime(0, false), LON.서울, "yajasi")
    expect(g(c.pillars.day)).toBe(g(dayPillarOf(1987, 7, 14)))
    expect(g(chart(ymd, sijinRepresentativeTime(0, false), LON.서울, "nextDay").pillars.day)).toBe(g(dayPillarOf(...ymd)))
  })

  it("실제 23:50 출생(exact)과 자시 '자정 전 밤' 선택은 모든 시기·경도·두 옵션에서 일주·시주가 같다(84건)", () => {
    let n = 0
    for (const ymd of Object.values(ALL)) for (const lon of Object.values(LON)) for (const zh of ["nextDay", "yajasi"] as const) {
      const ex = chart(ymd, { hour: 23, minute: 50 }, lon, zh)
      const zi = chart(ymd, sijinRepresentativeTime(0, true), lon, zh)
      expect(g(zi.pillars.day)).toBe(g(ex.pillars.day))
      expect(g(zi.pillars.hour!)).toBe(g(ex.pillars.hour!))
      n++
    }
    expect(n).toBe(84)
  })

  it("라우트 경로(buildSajuInput, 기본 nextDay)도 같은 결과: 서울 1990-05-10 자정 전 밤 = 23:50 exact", () => {
    const a = buildSajuInput(1990, 5, 10, 0, "M", "SOLAR", undefined, false, { timeMode: "sijin", ziNight: true })
    const b = buildSajuInput(1990, 5, 10, 23, "M", "SOLAR", undefined, false, { timeMode: "exact", minute: 50 })
    expect(a.pillars).toEqual(b.pillars)
    expect(a.pillars.day).toBe(g(dayPillarOf(1990, 5, 11)))
    expect(a.birth).toBe("1990-05-10 23:45")
  })

  it("자시 전후 생략(예전 동작 00:00)에는 날짜 경계 경고가 붙는다", () => {
    const si = buildSajuInput(1990, 5, 10, 0, "M", "SOLAR", undefined, false, { timeMode: "sijin" })
    expect(si.birth).toBe("1990-05-10 00:00")
    expect(si.warnings!.some(w => w.startsWith("자시 날짜 경계 불확실"))).toBe(true)
  })
})

describe("[결함 D1 범위] 화면 PLACES 20곳 — 1987 서머타임 축시~해시 11가지", () => {
  it("동경 127.5도 서쪽 도시는 11가지 모두 한 칸 앞 시지, 동쪽 도시는 일치(경계 15분 이내)", async () => {
    const { PLACES } = await import("@/app/input/build-request")
    const west: string[] = [], east: string[] = []
    for (const p of PLACES) {
      let c = 0
      for (let i = 1; i < 12; i++) if (sijin(DST["1987-07-15(서머타임 UTC+10)"], i * 2, p.longitude).got !== BR[i]) c++
      expect(c === 0 || c === 11).toBe(true)
      ;(c === 11 ? west : east).push(p.name)
      expect(c === 11).toBe(p.longitude < 127.5)
    }
    console.log(`[U-03 QA] 1987 서머타임 축시~해시: 불일치 ${west.length}곳(${west.join("·")}) / 일치 ${east.length}곳(${east.join("·")})`)
  })
})
