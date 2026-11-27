// 원국 단위 테스트 (P3-03) — 기대값은 공개 자료·공식·손계산으로 정했다(구현 출력 복사 금지).
//
// 손계산 메모
// - 일주 번호 = (JDN − 11) mod 60, 甲子=0. JDN(2000-01-01)=2451545 → 54 = 戊午,
//   JDN(1900-01-01)=2415021 → 10 = 甲戌 (두 값 모두 공개 만세력의 기준일과 일치).
// - 2024-07-20: 2000-01-01부터 8766일(2000~2023: 24×365+윤년 6) + 201일 = 8967일
//   → (54 + 8967) mod 60 = 21 = 乙酉, 다음 날 22 = 丙戌.
// - 五虎遁(월간): 甲己→丙寅, 乙庚→戊寅, 丙辛→庚寅, 丁壬→壬寅, 戊癸→甲寅.
// - 五鼠遁(시간): 甲己→甲子, 乙庚→丙子, 丙辛→戊子, 丁壬→庚子, 戊癸→壬子.
// - 절기 시각(한국천문연구원 역서, KST): 2024 小寒 01-06 05:49, 立春 02-04 17:27, 驚蟄 03-05 11:23.
import { describe, expect, it } from "vitest"
import { computeChart, dayPillarOf, getSolarTermsUtc, yearPillarOf, type BirthInput, type Pillar } from "@/engine"

const gz = (p: Pillar | null) => (p ? p.stem + p.branch : null)
const birth = (y: number, m: number, d: number, hour: number, minute: number, gender: "M" | "F" = "M"): BirthInput => ({
  calendar: "solar", year: y, month: m, day: d, time: { hour, minute }, gender,
})

describe("일주 기준일 (dayPillarOf)", () => {
  it("2000-01-01 = 戊午", () => expect(gz(dayPillarOf(2000, 1, 1))).toBe("戊午"))
  it("1900-01-01 = 甲戌", () => expect(gz(dayPillarOf(1900, 1, 1))).toBe("甲戌"))
  it("2024-07-20 = 乙酉, 07-21 = 丙戌 (손계산)", () => {
    expect(gz(dayPillarOf(2024, 7, 20))).toBe("乙酉")
    expect(gz(dayPillarOf(2024, 7, 21))).toBe("丙戌")
  })
  it("60일 뒤 같은 일주 (2000-03-01 = 2000-01-01 + 60일)", () => {
    expect(gz(dayPillarOf(2000, 3, 1))).toBe("戊午")
  })
})

describe("세운 연주 (yearPillarOf)", () => {
  it("1984 甲子, 2024 甲辰, 2026 丙午", () => {
    // 근거: 1984년이 甲子년(널리 알려진 기준), 이후 60갑자 순서
    expect(gz(yearPillarOf(1984))).toBe("甲子")
    expect(gz(yearPillarOf(2024))).toBe("甲辰")
    expect(gz(yearPillarOf(2026))).toBe("丙午")
  })
})

describe("절기 (getSolarTermsUtc)", () => {
  it("2024 立春 = 2024-02-04 08:27 UTC (KST 17:27, 한국천문연구원) — UTC+8 값을 그대로 쓰지 않는다", () => {
    const t = getSolarTermsUtc(2024)
    expect(t).toHaveLength(24)
    const lichun = t.find((x) => x.name === "立春")!
    expect(Math.abs(Date.parse(lichun.utc) - Date.parse("2024-02-04T08:27:00Z"))).toBeLessThan(60_000)
    // 시간순 정렬, 모두 2024년 UTC
    for (let i = 1; i < t.length; i++) expect(Date.parse(t[i].utc)).toBeGreaterThan(Date.parse(t[i - 1].utc))
    expect(t[0].name).toBe("小寒")
    expect(t[23].name).toBe("冬至")
  })
})

describe("연주: 2024 입춘 경계 (KST 17:27)", () => {
  it("KST 17:00 → 癸卯년 乙丑월, 17:40 → 甲辰년 丙寅월", () => {
    const before = computeChart(birth(2024, 2, 4, 17, 0))
    const after = computeChart(birth(2024, 2, 4, 17, 40))
    expect(gz(before.pillars.year)).toBe("癸卯")
    expect(gz(before.pillars.month)).toBe("乙丑") // 癸년 寅월=甲寅 → 丑월(12번째)=乙丑
    expect(gz(after.pillars.year)).toBe("甲辰")
    expect(gz(after.pillars.month)).toBe("丙寅") // 甲년 寅월=丙寅
    expect(after.solarTerm.prev.name).toBe("立春")
    expect(before.solarTerm.next.name).toBe("立春")
  })

  it("진태양시 적용 여부는 연주·월주 판정에 영향이 없다(UTC 순간 비교)", () => {
    for (const [h, m, y] of [[17, 0, "癸卯"], [17, 40, "甲辰"]] as const) {
      const a = computeChart(birth(2024, 2, 4, h, m), { trueSolarTime: true })
      const b = computeChart(birth(2024, 2, 4, h, m), { trueSolarTime: false })
      expect(gz(a.pillars.year)).toBe(y)
      expect(gz(b.pillars.year)).toBe(y)
      expect(gz(a.pillars.month)).toBe(gz(b.pillars.month))
    }
  })

  it("절입 2시간 이내면 연주·월주 경계 경고", () => {
    const r = computeChart(birth(2024, 2, 4, 17, 40))
    expect(r.warnings.some((w) => w.includes("立春") && w.includes("경계"))).toBe(true)
    const far = computeChart(birth(2024, 2, 10, 12, 0))
    expect(far.warnings.some((w) => w.includes("절입"))).toBe(false)
  })
})

describe("월주: 2024 경칩 경계 (KST 11:23)", () => {
  it("11:00 → 丙寅월, 11:45 → 丁卯월", () => {
    expect(gz(computeChart(birth(2024, 3, 5, 11, 0)).pillars.month)).toBe("丙寅")
    expect(gz(computeChart(birth(2024, 3, 5, 11, 45)).pillars.month)).toBe("丁卯")
  })
})

describe("시주·자시 처리 (2024-07-20 23:30 KST)", () => {
  // 진태양시를 켜면 23:30 KST는 22:58(亥時)이 되므로, 자시 옵션 비교는 법정시(trueSolarTime=false)로 한다.
  it("ziHour nextDay: 일주 丙戌(다음 날), 시주 戊子(丙일 五鼠遁)", () => {
    const r = computeChart(birth(2024, 7, 20, 23, 30), { ziHour: "nextDay", trueSolarTime: false })
    expect(gz(r.pillars.day)).toBe("丙戌")
    expect(gz(r.pillars.hour)).toBe("戊子")
  })

  it("ziHour yajasi: 일주 乙酉(당일), 시주 戊子(다음 날 丙일 기준)", () => {
    const r = computeChart(birth(2024, 7, 20, 23, 30), { ziHour: "yajasi", trueSolarTime: false })
    expect(gz(r.pillars.day)).toBe("乙酉")
    expect(gz(r.pillars.hour)).toBe("戊子")
  })

  it("진태양시 적용 시 23:30 KST → 약 22:58 → 亥時, 일주 乙酉, 시주 丁亥(乙일 丙子부터 11번째)", () => {
    const r = computeChart(birth(2024, 7, 20, 23, 30))
    expect(gz(r.pillars.day)).toBe("乙酉")
    expect(gz(r.pillars.hour)).toBe("丁亥")
    expect(r.warnings.some((w) => w.includes("시지 경계"))).toBe(true) // 23시 경계 2분 전
  })

  it("00:30 출생은 두 옵션 모두 당일 일주·당일 일간 기준 子시", () => {
    for (const z of ["nextDay", "yajasi"] as const) {
      const r = computeChart(birth(2024, 7, 21, 0, 30), { ziHour: z, trueSolarTime: false })
      expect(gz(r.pillars.day)).toBe("丙戌")
      expect(gz(r.pillars.hour)).toBe("戊子")
    }
  })

  it("시지 배정: 법정시 13:00 → 午시가 아닌 未시 시작(13~15 未)", () => {
    // 2024-07-20 乙酉일, 乙일 子=丙子 → 未(7번째) = 丙+7 = 癸 → 癸未
    const r = computeChart(birth(2024, 7, 20, 13, 30), { trueSolarTime: false })
    expect(gz(r.pillars.hour)).toBe("癸未")
  })
})

describe("시각 모름", () => {
  it("hour null, hourKnown false, 정오 가정 경고", () => {
    const r = computeChart({ calendar: "solar", year: 2024, month: 7, day: 20, time: null, gender: "F" })
    expect(r.pillars.hour).toBeNull()
    expect(r.hourKnown).toBe(false)
    expect(r.utcInstant).toBe("2024-07-20T03:00:00.000Z") // 현지 12:00 KST
    expect(gz(r.pillars.day)).toBe("乙酉")
    expect(r.warnings.some((w) => w.includes("시각 모름"))).toBe(true)
  })

  it("출생일에 절입(2024-02-04 立春)이 있으면 월주·연주 불확실 경고", () => {
    const r = computeChart({ calendar: "solar", year: 2024, month: 2, day: 4, time: null, gender: "M" })
    expect(gz(r.pillars.year)).toBe("癸卯") // 정오는 17:27 입춘 전
    expect(r.warnings.some((w) => w.includes("立春") && w.includes("불확실"))).toBe(true)
  })
})
