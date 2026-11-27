// buildSajuInput(AI 입력)·결과 화면 표시가 새 엔진(computeChart 기본 옵션)과 같은 글자를 쓰는지 회귀 확인 (U-02)
// 기대 글자 근거(손계산):
//   2024 立春 = 2024-02-04 17:27 KST, 驚蟄 = 2024-03-05 10:23 KST (docs/SAJU_ENGINE.md 만세력 절 검산값)
//   일주 = (JDN − 11) mod 60: 2024-02-04 JDN 2460345 → 34 = 戊戌, 2024-02-03 → 33 = 丁酉, 2024-03-04 → 63 → 3 = 丁卯
//   진태양시(서울 −32.09분): 17:00 → 16:28 申시, 17:40 → 17:08 酉시, 12:00 → 11:28 午시
//   시간(五鼠遁): 戊·癸일 子시 = 壬子 → 申 庚申, 酉 辛酉 / 丁·壬일 子시 = 庚子 → 午 丙午
import { describe, expect, it } from "vitest"
import { computeChart, dayPillarOf, EngineInputError, gongmangString, RULES_ENGINE_VERSION, yearPillarOf, type BirthInput, type Pillar } from "@/engine"
import {
  buildSajuInput,
  buildSajuInputFromRequest,
  displaySajuFromStored,
  parseGanzhi,
  resolveDisplaySaju,
  seoulYearOf,
  sijinRepresentativeTime,
  ZI_BOUNDARY_WARNING,
} from "@/lib/saju-input"

const NOW = new Date("2026-06-01T00:00:00Z")
const gz = (p: Pillar | null) => (p ? p.stem + p.branch : undefined)

function chartOf(y: number, m: number, d: number, hour: number | null, gender: "M" | "F", calendar: "solar" | "lunar" = "solar", isLeapMonth = false) {
  const input: BirthInput = {
    calendar, year: y, month: m, day: d, isLeapMonth, time: hour === null ? null : { hour, minute: 0 }, timezone: "Asia/Seoul", gender,
  }
  return computeChart(input)
}

describe("buildSajuInput pillars = computeChart(기본 옵션)", () => {
  const cases: [number, number, number, number | null, "M" | "F", string][] = [
    [2024, 2, 3, 12, "M", "입춘 전날"],
    [2024, 3, 4, 12, "F", "경칩 전날"],
    [2024, 2, 4, 17, "M", "입춘(17:27) 27분 전"],
    [2024, 2, 4, null, "F", "입춘 당일 시각 모름"],
    [1987, 7, 1, 12, "M", "서머타임"],
    [1960, 1, 1, 23, "F", "UTC+8:30 시기·23시"],
    [2000, 1, 1, 0, "M", "자정"],
  ]
  for (const [y, m, d, h, g, label] of cases) {
    it(`${y}-${m}-${d} ${h ?? "모름"}시 ${g} (${label})`, () => {
      const s = buildSajuInput(y, m, d, h, g, "SOLAR", undefined, false, { now: NOW })
      const c = chartOf(y, m, d, h, g)
      expect(s.pillars).toEqual({
        year: gz(c.pillars.year), month: gz(c.pillars.month), day: gz(c.pillars.day),
        ...(c.pillars.hour ? { hour: gz(c.pillars.hour) } : {}),
      })
      expect(s.hour_unknown).toBe(h === null)
      expect(s.daeun).toEqual(c.luck.daeun.slice(0, 8).map((x) => ({ start_year: x.startYear, start_age: x.startAge, ganzhi: gz(x.pillar) })))
      expect(s.daeun).toHaveLength(8)
      expect(s.gongmang).toEqual({ day: gongmangString(c.pillars.day), year: gongmangString(c.pillars.year) })
      expect(s.warnings).toEqual(c.warnings)
      expect(s.engine_version).toBe(`${c.engineVersion}+${RULES_ENGINE_VERSION}`)
    })
  }

  it("손계산 글자: 2024-02-03 12시 → 癸卯 乙丑 丁酉 丙午", () => {
    expect(buildSajuInput(2024, 2, 3, 12, "M", "SOLAR", undefined, false, { now: NOW }).pillars).toEqual({
      year: "癸卯", month: "乙丑", day: "丁酉", hour: "丙午",
    })
  })
  it("손계산 글자: 2024-03-04 12시 → 甲辰 丙寅(경칩 전) 丁卯 丙午", () => {
    expect(buildSajuInput(2024, 3, 4, 12, "F", "SOLAR", undefined, false, { now: NOW }).pillars).toEqual({
      year: "甲辰", month: "丙寅", day: "丁卯", hour: "丙午",
    })
  })
  it("손계산 글자: 2024-02-04 17:00 → 癸卯 乙丑 戊戌 庚申 (입춘 전 — 예전 코드는 甲辰 丙寅으로 틀림)", () => {
    expect(buildSajuInput(2024, 2, 4, 17, "M", "SOLAR", undefined, false, { now: NOW }).pillars).toEqual({
      year: "癸卯", month: "乙丑", day: "戊戌", hour: "庚申",
    })
  })
  it("2024-02-04 17:40(입춘 후)은 computeChart 기준 甲辰 丙寅 戊戌 辛酉 — buildSajuInput은 시 단위라 분 입력이 없음을 확인", () => {
    // buildSajuInput은 라우트 계약상 '시'만 받는다(분 = 0). 17:40 출생은 17시로 들어오므로 입춘 전으로 계산된다.
    const c = computeChart({ calendar: "solar", year: 2024, month: 2, day: 4, time: { hour: 17, minute: 40 }, gender: "M" })
    expect([gz(c.pillars.year), gz(c.pillars.month), gz(c.pillars.day), gz(c.pillars.hour)]).toEqual(["甲辰", "丙寅", "戊戌", "辛酉"])
    expect(buildSajuInput(2024, 2, 4, 17, "M", "SOLAR", undefined, false, { now: NOW }).birth).toBe("2024-02-04 17:00")
  })

  it("시각 모름: hour 없음, hour_unknown true, 정오 가정 경고 포함", () => {
    const s = buildSajuInput(2024, 2, 4, null, "F", "SOLAR", undefined, false, { now: NOW })
    expect(s.pillars.hour).toBeUndefined()
    expect("hour" in s.pillars).toBe(false)
    expect(s.hour_unknown).toBe(true)
    expect(s.birth).toBe("2024-02-04")
    expect(s.warnings?.some((w) => w.includes("태어난 시각 모름"))).toBe(true)
    expect(s.warnings?.some((w) => w.includes("立春"))).toBe(true) // 그날 입춘 → 연·월주 불확실 경고
  })
})

describe("음력 입력", () => {
  it("음력 2024-01-01 → 양력 2024-02-10, pillars = computeChart(lunar)", () => {
    const s = buildSajuInput(2024, 1, 1, 9, "M", "LUNAR", undefined, false, { now: NOW })
    const c = chartOf(2024, 1, 1, 9, "M", "lunar")
    expect(s.birth).toBe("2024-02-10 09:00") // 양력(현지 법정시)
    expect(s.calendar).toBe("음력")
    expect(s.pillars.day).toBe(gz(c.pillars.day))
    expect(s.pillars.day).toBe("甲辰") // 2024 설날 甲辰일
  })
  it("윤달: 음력 2023 윤2월 1일 → isLeapMonth 인자로 계산, 평달과 다른 날짜", () => {
    const leap = buildSajuInput(2023, 2, 1, null, "F", "LUNAR", undefined, true, { now: NOW })
    const normal = buildSajuInput(2023, 2, 1, null, "F", "LUNAR", undefined, false, { now: NOW })
    const c = chartOf(2023, 2, 1, null, "F", "lunar", true)
    expect(leap.calendar).toBe("음력(윤달)")
    expect(leap.pillars.day).toBe(gz(c.pillars.day))
    expect(leap.birth).not.toBe(normal.birth)
  })
  it("그 해에 없는 윤달(2024 윤1월) → EngineInputError", () => {
    expect(() => buildSajuInput(2024, 1, 1, null, "F", "LUNAR", undefined, true)).toThrow(EngineInputError)
  })
})

describe("this_year: 주입한 기준 시각의 서울 날짜 기준", () => {
  it("2026-12-31T14:59Z(서울 12-31 23:59) → 2026 丙午", () => {
    const s = buildSajuInput(1990, 5, 15, 12, "M", "SOLAR", undefined, false, { now: new Date("2026-12-31T14:59:00Z") })
    expect(s.this_year).toBe(2026)
    expect(s.this_year_ganzhi).toBe("丙午")
  })
  it("2026-12-31T15:00Z(서울 2027-01-01 00:00) → 2027 丁未 (UTC로는 아직 2026)", () => {
    const s = buildSajuInput(1990, 5, 15, 12, "M", "SOLAR", undefined, false, { now: new Date("2026-12-31T15:00:00Z") })
    expect(s.this_year).toBe(2027)
    expect(s.this_year_ganzhi).toBe("丁未")
  })
  it("2030-07-01 → 2030 庚戌, this_year_ganzhi = yearPillarOf(this_year)", () => {
    const s = buildSajuInput(1990, 5, 15, 12, "M", "SOLAR", undefined, false, { now: new Date("2030-07-01T00:00:00Z") })
    expect(s.this_year).toBe(2030)
    expect(s.this_year_ganzhi).toBe(gz(yearPillarOf(2030)))
    expect(s.this_year_ganzhi).toBe("庚戌")
  })
  it("기준 시각 생략 시 현재 시각의 서울 연도", () => {
    const s = buildSajuInput(1990, 5, 15, 12, "M", "SOLAR")
    expect(s.this_year).toBe(seoulYearOf(new Date()))
  })
  it("잘못된 기준 시각(Invalid Date)은 오류", () => {
    expect(() => buildSajuInput(1990, 5, 15, 12, "M", "SOLAR", undefined, false, { now: new Date("x") })).toThrow()
  })
})

describe("SajuInputData 형태 유지", () => {
  it("기존 필드·값 형식", () => {
    const s = buildSajuInput(1990, 5, 15, 14, "F", "SOLAR", "홍길동", false, { now: NOW })
    expect(s.name).toBe("홍길동")
    expect(s.gender).toBe("여")
    expect(s.calendar).toBe("양력")
    expect(s.birth).toBe("1990-05-15 14:00")
    expect(s.known_facts).toEqual([])
    expect(s.voice).toBe("할미")
    expect(s.gongmang.day).toMatch(/^[子丑寅卯辰巳午未申酉戌亥]{2}$/)
    expect(s.gongmang.year).toMatch(/^[子丑寅卯辰巳午未申酉戌亥]{2}$/)
    for (const d of s.daeun) {
      expect(Number.isInteger(d.start_year) && Number.isInteger(d.start_age)).toBe(true)
      expect(parseGanzhi(d.ganzhi)).not.toBeNull()
    }
    // 대운 시작 연도 = 출생 연도 + 만 나이
    for (const d of s.daeun) expect(d.start_year).toBe(1990 + d.start_age)
  })
  it("입력 오류 → EngineInputError (라우트가 400 처리)", () => {
    const bad: [number, number, number, number | null, string, string][] = [
      [2023, 2, 29, 12, "M", "SOLAR"],
      [2024, 1, 1, 24, "M", "SOLAR"],
      [1899, 12, 31, null, "M", "SOLAR"],
      [2101, 1, 1, null, "M", "SOLAR"],
      [2024, 1, 1, null, "X", "SOLAR"],
      [2024, 1, 1, null, "M", "MOON"],
      [2020, 2, 30, null, "M", "LUNAR"], // 음력 2020년 2월은 작은달(29일) — tests/engine/golden/lunar-golden.json invalid 목록(오라클 확인)
    ]
    for (const b of bad) expect(() => buildSajuInput(...b), b.join(",")).toThrow(EngineInputError)
  })
})

describe("결과 화면 표시 = AI가 본 글자", () => {
  it("저장된 sajuInput.pillars를 한글·오행으로 변환(새 sajuInput)", () => {
    const s = buildSajuInput(2024, 2, 4, 17, "M", "SOLAR", undefined, false, { now: NOW }) // 癸卯 乙丑 戊戌 庚申
    const d = displaySajuFromStored(s)!
    expect(d.source).toBe("stored")
    expect(d.pillars).toEqual([
      { label: "연주", stem: "계", branch: "묘", element: "수", branchEl: "목" },
      { label: "월주", stem: "을", branch: "축", element: "목", branchEl: "토" },
      { label: "일주", stem: "무", branch: "술", element: "토", branchEl: "토", me: true },
      { label: "시주", stem: "경", branch: "신", element: "금", branchEl: "금" },
    ])
    expect(d.fiveElements).toEqual([
      { el: "목", count: 2 }, { el: "화", count: 0 }, { el: "토", count: 3 }, { el: "금", count: 2 }, { el: "수", count: 1 },
    ])
  })
  it("예전(lunar-javascript 시절) 저장값은 새 엔진과 달라도 저장된 글자 그대로 표시", () => {
    // 예전 코드는 2024-02-04 17시를 입춘 후로 계산해 甲辰·丙寅을 저장했다
    const old = { pillars: { year: "甲辰", month: "丙寅", day: "戊戌", hour: "辛酉" }, hour_unknown: false }
    const d = resolveDisplaySaju({ sajuInput: old, birthYear: 2024, birthMonth: 2, birthDay: 4, birthHour: 17, gender: "M", calType: "SOLAR" })
    expect(d.source).toBe("stored")
    expect(d.pillars.map((p) => p.stem + p.branch)).toEqual(["갑진", "병인", "무술", "신유"])
  })
  it("hour_unknown이면 시주 미표시, 오행은 6글자", () => {
    const d = displaySajuFromStored({ pillars: { year: "甲辰", month: "丙寅", day: "甲辰" }, hour_unknown: true })!
    expect(d.pillars).toHaveLength(3)
    expect(d.fiveElements.reduce((n, x) => n + x.count, 0)).toBe(6)
  })
  it("sajuInput 없음(예전 마크다운 풀이) → 새 엔진 계산", () => {
    const d = resolveDisplaySaju({ sajuInput: null, birthYear: 2024, birthMonth: 2, birthDay: 3, birthHour: 12, gender: "F", calType: "SOLAR" })
    expect(d.source).toBe("engine")
    expect(d.pillars.map((p) => p.stem + p.branch)).toEqual(["계묘", "을축", "정유", "병오"])
  })
  it("깨진 저장값(간지 아님·음양 불일치·형식 오류) → 새 엔진 계산", () => {
    const birth = { birthYear: 2024, birthMonth: 2, birthDay: 3, birthHour: 12, gender: "F", calType: "SOLAR" }
    for (const bad of [
      { pillars: { year: "甲丑", month: "乙丑", day: "丁酉" } },
      { pillars: { year: "癸卯", month: "乙丑", day: "丁酉", hour: "XX" }, hour_unknown: false },
      { pillars: "癸卯" },
      { pillars: { year: "癸卯", month: "乙丑" } },
      [],
      "x",
    ]) {
      expect(resolveDisplaySaju({ sajuInput: bad, ...birth }).source, JSON.stringify(bad)).toBe("engine")
    }
  })
  it("저장값도 없고 출생 정보도 계산 불가 → 빈 원국(화면 유지)", () => {
    const d = resolveDisplaySaju({ sajuInput: null, birthYear: 2023, birthMonth: 2, birthDay: 29, birthHour: null, gender: "M", calType: "SOLAR" })
    expect(d.source).toBe("none")
    expect(d.pillars).toEqual([])
    expect(d.fiveElements.every((x) => x.count === 0)).toBe(true)
  })
})

describe("화면 표시 ↔ AI 입력 일치(감사 스크립트 대체 확인)", () => {
  // 1900~2100 결정론적 표본 2,000건(양력·음력, 시각 있음·모름, 남·여): 새 풀이 저장값 경로와 재계산 경로 모두 AI 글자와 같아야 한다
  it("2,000건 전부 일치", () => {
    // 한자 → 한글 독립 표(구현과 별도로 적음)
    const H = "甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥"
    const K = "갑을병정무기경신임계자축인묘진사오미신유술해"
    const ko = (s: string) => [...s].map((c) => K[H.indexOf(c)]).join("")
    let seed = 20261127
    const rnd = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed % n
    }
    const mismatches: string[] = []
    let n = 0
    while (n < 2000) {
      const y = 1900 + rnd(201)
      const m = 1 + rnd(12)
      const d = 1 + rnd(28)
      const h = rnd(5) === 0 ? null : rnd(24)
      const g = rnd(2) === 0 ? "M" : "F"
      const cal = rnd(4) === 0 ? "LUNAR" : "SOLAR"
      let s
      try {
        s = buildSajuInput(y, m, d, h, g, cal, undefined, false, { now: NOW })
      } catch (e) {
        if (e instanceof EngineInputError) continue // 범위 밖(음력 2100년 말 등)
        throw e
      }
      n++
      const ai = [s.pillars.year, s.pillars.month, s.pillars.day, ...(s.pillars.hour ? [s.pillars.hour] : [])].map(ko)
      const stored = resolveDisplaySaju({ sajuInput: s, birthYear: y, birthMonth: m, birthDay: d, birthHour: h, gender: g, calType: cal })
      const recomputed = resolveDisplaySaju({ sajuInput: null, birthYear: y, birthMonth: m, birthDay: d, birthHour: h, gender: g, calType: cal })
      for (const [label, r] of [["stored", stored], ["engine", recomputed]] as const) {
        const shown = r.pillars.map((p) => p.stem + p.branch)
        if (r.source !== label || shown.join() !== ai.join()) mismatches.push(`${cal} ${y}-${m}-${d} ${h}시 ${g} ${label}: 화면 ${shown} / AI ${ai}`)
      }
    }
    expect(mismatches.slice(0, 10)).toEqual([])
  })
})

// ─── U-03 입력 정확도: 시진 대표 시각·자시 전후·분·윤달·출생지 경도 ─────────────────────────
// 손계산 근거:
//   서울 경도 126.978 → 진태양시 보정 (126.978 − 135) × 4 = −32.088분, 독도 131.87 → −12.52분, 부산 129.075 → −23.70분
//   2000-03-10 JDN 2451614 → (2451614 − 11) mod 60 = 3 = 丁卯, 다음 날 戊辰
//   五鼠遁: 丁·壬일 子시 = 庚子 / 戊·癸일 子시 = 壬子, 丁일 亥시 = 辛亥, 丁일 丑시 = 辛丑
//   1987-07-01은 서머타임(UTC+10): 보정 = −32.088 − 60 = −92.088분
const NOW2 = NOW
const D = { y: 2000, m: 3, d: 10 } // 절입·서머타임과 먼 평범한 날
const SIJIN = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]
function exactChart(y: number, m: number, d: number, hour: number, minute: number, extra: Partial<BirthInput> = {}) {
  return computeChart({ calendar: "solar", year: y, month: m, day: d, time: { hour, minute }, timezone: "Asia/Seoul", gender: "F", ...extra })
}
const pillarsOf = (c: ReturnType<typeof computeChart>) => ({
  year: gz(c.pillars.year), month: gz(c.pillars.month), day: gz(c.pillars.day), ...(c.pillars.hour ? { hour: gz(c.pillars.hour) } : {}),
})

describe("시진 대표 시각 = 시진 가운데 (sijinRepresentativeTime)", () => {
  it("축시~해시: 짝수 시 + 30분 (예: 축시 01:30~03:29 → 02:30)", () => {
    const expected: [number, string][] = [
      [2, "02:30"], [4, "04:30"], [6, "06:30"], [8, "08:30"], [10, "10:30"], [12, "12:30"],
      [14, "14:30"], [16, "16:30"], [18, "18:30"], [20, "20:30"], [22, "22:30"],
    ]
    for (const [h, hhmm] of expected) {
      const t = sijinRepresentativeTime(h)
      expect(`${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`, `${h}`).toBe(hhmm)
    }
  })
  it("자시: 자정 전 밤 23:45 / 자정 후 00:45 / 모름 00:00(예전 동작)", () => {
    expect(sijinRepresentativeTime(0, true)).toEqual({ hour: 23, minute: 45 })
    expect(sijinRepresentativeTime(0, false)).toEqual({ hour: 0, minute: 45 })
    expect(sijinRepresentativeTime(0)).toEqual({ hour: 0, minute: 0 })
  })
  it("홀수 시·범위 밖은 EngineInputError", () => {
    for (const h of [1, 3, 23, 24, -2, 2.5]) expect(() => sijinRepresentativeTime(h), String(h)).toThrow(EngineInputError)
  })
})

describe("buildSajuInput 시진 방식 → computeChart(대표 시각)과 같은 글자", () => {
  it("축시(2) → 02:30으로 계산(예전 02:00 아님), 보정 후 01:58 丑시 가운데", () => {
    const s = buildSajuInput(D.y, D.m, D.d, 2, "F", "SOLAR", undefined, false, { now: NOW2, timeMode: "sijin" })
    const c = exactChart(D.y, D.m, D.d, 2, 30)
    expect(s.birth).toBe("2000-03-10 02:30")
    expect(s.pillars).toEqual(pillarsOf(c))
    expect(s.pillars).toEqual({ year: "庚辰", month: "己卯", day: "丁卯", hour: "辛丑" })
    expect(c.corrections.solarTimeMinutes).toBeCloseTo(-32.088, 2) // 02:30 − 32분 = 01:58 (丑시 01:00~03:00의 가운데)
    expect(s.time_mode).toBe("sijin")
    expect(s.birth_minute).toBeNull()
    expect(s.warnings).toEqual([...c.warnings, "시진 선택(축시) — 정확한 분을 몰라 시진 가운데 02:30로 계산"])
    // 예전 방식(02:00)은 보정 후 01:28 — 시진 시작(01:00)에서 28분
    expect(buildSajuInput(D.y, D.m, D.d, 2, "F", "SOLAR", undefined, false, { now: NOW2 }).birth).toBe("2000-03-10 02:00")
  })
  it("12시진 모두: 계산된 시지 = 고른 시진, 시주·일주 = computeChart(대표 시각)", () => {
    for (let i = 0; i < 12; i++) {
      const h = i * 2
      for (const zi of h === 0 ? [true, false, undefined] : [undefined]) {
        const s = buildSajuInput(D.y, D.m, D.d, h, "M", "SOLAR", undefined, false, { now: NOW2, timeMode: "sijin", ziNight: zi })
        const t = sijinRepresentativeTime(h, zi)
        const c = exactChart(D.y, D.m, D.d, t.hour, t.minute, { gender: "M" })
        expect(s.pillars, `${h} ${zi}`).toEqual(pillarsOf(c))
        expect([...s.pillars.hour!][1], `${h} ${zi}`).toBe(SIJIN[i])
        expect(s.warnings?.some((w) => w.startsWith("선택한 시진")), `${h} ${zi}`).toBe(false)
      }
    }
  })
})

describe("자시 날짜 경계 (ziNight)", () => {
  it("자정 전 밤(true): 23:45 → 보정 23:13 → 다음 날 일주 戊辰·壬子", () => {
    const s = buildSajuInput(D.y, D.m, D.d, 0, "F", "SOLAR", undefined, false, { now: NOW2, timeMode: "sijin", ziNight: true })
    expect(s.birth).toBe("2000-03-10 23:45")
    expect(s.pillars.day).toBe(gz(dayPillarOf(2000, 3, 11)))
    expect(s.pillars.day).toBe("戊辰")
    expect(s.pillars.hour).toBe("壬子")
    expect(s.warnings).not.toContain(ZI_BOUNDARY_WARNING)
    expect(s.warnings).toContain("시진 선택(자시(자정 전 밤)) — 정확한 분을 몰라 시진 가운데 23:45로 계산")
  })
  it("자정 후(false): 00:45 → 보정 00:13 → 그날 일주 丁卯·庚子 (야자시 설정이어도 같은 날)", () => {
    const s = buildSajuInput(D.y, D.m, D.d, 0, "F", "SOLAR", undefined, false, { now: NOW2, timeMode: "sijin", ziNight: false })
    expect(s.birth).toBe("2000-03-10 00:45")
    expect(s.pillars.day).toBe("丁卯")
    expect(s.pillars.hour).toBe("庚子")
    expect(gz(exactChart(D.y, D.m, D.d, 0, 45).pillars.day)).toBe("丁卯")
    expect(gz(computeChart({ calendar: "solar", year: 2000, month: 3, day: 10, time: { hour: 0, minute: 45 }, gender: "F" }, { ziHour: "yajasi" }).pillars.day)).toBe("丁卯")
  })
  it("모름(undefined): 예전처럼 00:00, 결과 글자 그대로 + '자시 날짜 경계 불확실' 경고", () => {
    const s = buildSajuInput(D.y, D.m, D.d, 0, "F", "SOLAR", undefined, false, { now: NOW2, timeMode: "sijin" })
    const legacy = buildSajuInput(D.y, D.m, D.d, 0, "F", "SOLAR", undefined, false, { now: NOW2 })
    expect(s.birth).toBe("2000-03-10 00:00")
    expect(s.pillars).toEqual(legacy.pillars)
    expect(s.pillars).toEqual({ year: "庚辰", month: "己卯", day: "丁卯", hour: "庚子" })
    expect(s.warnings).toEqual([...(legacy.warnings ?? []), ZI_BOUNDARY_WARNING])
    expect(ZI_BOUNDARY_WARNING.startsWith("자시 날짜 경계 불확실")).toBe(true)
  })
  it("대표 시각을 23:30으로 하면 안 되는 이유: 보정 후 22:58 → 亥시·그날 일주(자시를 고른 의미가 없음)", () => {
    const c = exactChart(D.y, D.m, D.d, 23, 30)
    expect([gz(c.pillars.day), gz(c.pillars.hour)]).toEqual(["丁卯", "辛亥"])
  })
  it("23:30~23:59 출생이 '자시'를 고른 예전 경로(00:00)는 일주가 하루 앞섬 — ziNight true면 실제 시각과 같은 일주", () => {
    const actual = exactChart(D.y, D.m, D.d, 23, 50) // 실제 23:50 출생 → 보정 23:18 → 戊辰
    const old = buildSajuInput(D.y, D.m, D.d, 0, "F", "SOLAR", undefined, false, { now: NOW2 })
    const fixed = buildSajuInput(D.y, D.m, D.d, 0, "F", "SOLAR", undefined, false, { now: NOW2, timeMode: "sijin", ziNight: true })
    expect(gz(actual.pillars.day)).toBe("戊辰")
    expect(old.pillars.day).toBe("丁卯")
    expect(fixed.pillars.day).toBe("戊辰")
    expect(fixed.pillars.hour).toBe(gz(actual.pillars.hour))
  })
})

describe("분 입력(exact)", () => {
  it("2024-02-04 17:40(입춘 17:27 후) → 甲辰 丙寅 戊戌 辛酉, birth·birth_minute 기록", () => {
    const s = buildSajuInput(2024, 2, 4, 17, "M", "SOLAR", undefined, false, { now: NOW2, timeMode: "exact", minute: 40 })
    expect(s.pillars).toEqual({ year: "甲辰", month: "丙寅", day: "戊戌", hour: "辛酉" })
    expect(s.pillars).toEqual(pillarsOf(computeChart({ calendar: "solar", year: 2024, month: 2, day: 4, time: { hour: 17, minute: 40 }, gender: "M" })))
    expect(s.birth).toBe("2024-02-04 17:40")
    expect(s.time_mode).toBe("exact")
    expect(s.birth_minute).toBe(40)
  })
  it("exact인데 분 없음 → :00, birth_minute null", () => {
    const s = buildSajuInput(2024, 2, 4, 17, "M", "SOLAR", undefined, false, { now: NOW2, timeMode: "exact" })
    expect(s.birth).toBe("2024-02-04 17:00")
    expect(s.birth_minute).toBeNull()
  })
  it("잘못된 조합은 EngineInputError", () => {
    const bad: Parameters<typeof buildSajuInput>[8][] = [
      { timeMode: "exact", minute: 60 },
      { timeMode: "exact", minute: 1.5 },
      { timeMode: "sijin", minute: 30 },
      { timeMode: "sijin", ziNight: "yes" as unknown as boolean },
      { timeMode: "minute" as unknown as "exact" },
    ]
    for (const o of bad) expect(() => buildSajuInput(2000, 3, 10, 2, "F", "SOLAR", undefined, false, o), JSON.stringify(o)).toThrow(EngineInputError)
    expect(() => buildSajuInput(2000, 3, 10, 3, "F", "SOLAR", undefined, false, { timeMode: "sijin" })).toThrow(EngineInputError)
    expect(() => buildSajuInput(2000, 3, 10, null, "F", "SOLAR", undefined, false, { minute: 5 })).toThrow(EngineInputError)
  })
})

describe("출생지 경도 전달", () => {
  it("birthplace 경도가 엔진에 전달되고 기록된다: 부산 129.075 → 보정 −23.70분", () => {
    const s = buildSajuInput(D.y, D.m, D.d, 9, "F", "SOLAR", undefined, false, { now: NOW2, timeMode: "exact", minute: 10, birthplace: { name: "부산", longitude: 129.075 } })
    const c = exactChart(D.y, D.m, D.d, 9, 10, { longitude: 129.075 })
    expect(c.corrections.solarTimeMinutes).toBeCloseTo((129.075 - 135) * 4, 6)
    expect(s.pillars).toEqual(pillarsOf(c))
    expect(s.warnings).toEqual(c.warnings)
    expect(s.birthplace).toEqual({ name: "부산", longitude: 129.075 })
  })
  it("경도에 따라 시지·일주가 바뀌는 사례: 23:20 서울 → 보정 22:48 亥·丁卯 / 독도 131.87 → 23:07 子·다음 날 戊辰", () => {
    const seoul = buildSajuInput(D.y, D.m, D.d, 23, "F", "SOLAR", undefined, false, { now: NOW2, timeMode: "exact", minute: 20 })
    const dokdo = buildSajuInput(D.y, D.m, D.d, 23, "F", "SOLAR", undefined, false, { now: NOW2, timeMode: "exact", minute: 20, birthplace: { name: "독도", longitude: 131.87 } })
    expect([seoul.pillars.day, seoul.pillars.hour]).toEqual(["丁卯", "辛亥"])
    expect([dokdo.pillars.day, dokdo.pillars.hour]).toEqual(["戊辰", "壬子"])
    expect(dokdo.pillars).toEqual(pillarsOf(exactChart(D.y, D.m, D.d, 23, 20, { longitude: 131.87 })))
    expect(seoul.birthplace).toBeUndefined()
  })
  it("longitude만 넘기면 계산에는 쓰고 기록하지 않음, birthplace와 함께면 오류", () => {
    const s = buildSajuInput(D.y, D.m, D.d, 23, "F", "SOLAR", undefined, false, { now: NOW2, minute: 20, longitude: 131.87 })
    expect(s.pillars.hour).toBe("壬子")
    expect("birthplace" in s).toBe(false)
    expect(() => buildSajuInput(D.y, D.m, D.d, 23, "F", "SOLAR", undefined, false, { longitude: 130, birthplace: { name: "x", longitude: 130 } })).toThrow(EngineInputError)
  })
  it("서머타임 시기 시진: 1987-07-01 축시 02:30 → 보정 00:58 子시 → '선택한 시진과 다름' 경고", () => {
    const s = buildSajuInput(1987, 7, 1, 2, "M", "SOLAR", undefined, false, { now: NOW2, timeMode: "sijin" })
    const c = exactChart(1987, 7, 1, 2, 30, { gender: "M" })
    expect(c.corrections.solarTimeMinutes).toBeCloseTo(-92.088, 2)
    expect(s.pillars).toEqual(pillarsOf(c))
    expect([...s.pillars.hour!][1]).toBe("子")
    expect(s.warnings?.some((w) => w.startsWith("선택한 시진(축시)과 계산된 시지(子)가 다름"))).toBe(true)
  })
})

describe("buildSajuInputFromRequest (라우트 경로)", () => {
  const req = { year: 2000, month: 3, day: 10, gender: "F", calType: "SOLAR" }
  it("timeMode 없는 예전 요청: 짝수 시 = 시진(가운데), 홀수 시 = 그 시각, 시각 모름 = time_mode 없음", () => {
    const even = buildSajuInputFromRequest({ ...req, hour: 2 }, undefined, { now: NOW2 })
    expect(even.birth).toBe("2000-03-10 02:30")
    expect(even.time_mode).toBe("sijin")
    const odd = buildSajuInputFromRequest({ ...req, hour: 17 }, undefined, { now: NOW2 })
    expect(odd.birth).toBe("2000-03-10 17:00")
    expect(odd.time_mode).toBe("exact")
    expect(odd.pillars).toEqual(buildSajuInput(2000, 3, 10, 17, "F", "SOLAR", undefined, false, { now: NOW2 }).pillars)
    const unknown = buildSajuInputFromRequest({ ...req, hour: null }, undefined, { now: NOW2 })
    expect("time_mode" in unknown).toBe(false)
    expect(unknown.hour_unknown).toBe(true)
  })
  it("명시값: exact + 분 / sijin + 자시 전후 / 출생지", () => {
    const exact = buildSajuInputFromRequest({ ...req, hour: 23, timeMode: "exact", birthMinute: 50 }, "민지", { now: NOW2 })
    expect(exact.birth).toBe("2000-03-10 23:50")
    expect(exact.name).toBe("민지")
    expect(exact.pillars.day).toBe("戊辰")
    const zi = buildSajuInputFromRequest({ ...req, hour: 0, timeMode: "sijin", ziNight: true, birthplace: { name: "광주", longitude: 126.851 } }, undefined, { now: NOW2 })
    expect(zi.birth).toBe("2000-03-10 23:45")
    expect(zi.pillars).toEqual(pillarsOf(exactChart(D.y, D.m, D.d, 23, 45, { longitude: 126.851 })))
    expect(zi.birthplace).toEqual({ name: "광주", longitude: 126.851 })
  })
  it("윤달: 음력 2023 윤2월 1일 → isLeapMonth 전달, 평달과 다른 양력 날짜", () => {
    const leap = buildSajuInputFromRequest({ ...req, calType: "LUNAR", year: 2023, month: 2, day: 1, hour: 12, timeMode: "exact", birthMinute: 0, isLeapMonth: true }, undefined, { now: NOW2 })
    const normal = buildSajuInputFromRequest({ ...req, calType: "LUNAR", year: 2023, month: 2, day: 1, hour: 12, timeMode: "exact", birthMinute: 0 }, undefined, { now: NOW2 })
    const c = computeChart({ calendar: "lunar", year: 2023, month: 2, day: 1, isLeapMonth: true, time: { hour: 12, minute: 0 }, gender: "F" })
    expect(leap.calendar).toBe("음력(윤달)")
    expect(normal.calendar).toBe("음력")
    expect(leap.pillars).toEqual(pillarsOf(c))
    expect(leap.birth).toBe(`${c.solarDate.year}-${String(c.solarDate.month).padStart(2, "0")}-${String(c.solarDate.day).padStart(2, "0")} 12:00`)
    expect(leap.birth).toBe("2023-03-22 12:00") // 2023 윤2월 초하루 = 양력 3월 22일
    expect(normal.birth).toBe("2023-02-20 12:00") // 2023 2월 초하루 = 양력 2월 20일
    expect(leap.pillars.day).not.toBe(normal.pillars.day)
  })
  it("그 해에 없는 윤달 → EngineInputError", () => {
    expect(() => buildSajuInputFromRequest({ ...req, calType: "LUNAR", year: 2024, month: 1, day: 1, hour: null, isLeapMonth: true })).toThrow(EngineInputError)
  })
  it("예전 호출(옵션 없음)은 새 필드를 만들지 않는다", () => {
    const s = buildSajuInput(1990, 5, 15, 14, "F", "SOLAR", "홍길동", false, { now: NOW2 })
    for (const k of ["time_mode", "birth_minute", "birthplace"]) expect(k in s, k).toBe(false)
  })
})
