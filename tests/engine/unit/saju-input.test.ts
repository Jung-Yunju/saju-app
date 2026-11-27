// buildSajuInput(AI 입력)·결과 화면 표시가 새 엔진(computeChart 기본 옵션)과 같은 글자를 쓰는지 회귀 확인 (U-02)
// 기대 글자 근거(손계산):
//   2024 立春 = 2024-02-04 17:27 KST, 驚蟄 = 2024-03-05 10:23 KST (docs/SAJU_ENGINE.md 만세력 절 검산값)
//   일주 = (JDN − 11) mod 60: 2024-02-04 JDN 2460345 → 34 = 戊戌, 2024-02-03 → 33 = 丁酉, 2024-03-04 → 63 → 3 = 丁卯
//   진태양시(서울 −32.09분): 17:00 → 16:28 申시, 17:40 → 17:08 酉시, 12:00 → 11:28 午시
//   시간(五鼠遁): 戊·癸일 子시 = 壬子 → 申 庚申, 酉 辛酉 / 丁·壬일 子시 = 庚子 → 午 丙午
import { describe, expect, it } from "vitest"
import { computeChart, EngineInputError, gongmangString, RULES_ENGINE_VERSION, yearPillarOf, type BirthInput, type Pillar } from "@/engine"
import {
  buildSajuInput,
  displaySajuFromStored,
  parseGanzhi,
  resolveDisplaySaju,
  seoulYearOf,
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
