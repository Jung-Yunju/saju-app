// 콘텐츠 엔진(P4-03) 연결 어댑터: FactSheet → VerifyContext, 장 단위 검사
import { describe, expect, it } from "vitest"
import type { FactSheet } from "@/engine/content/types"
import { contextFromFactSheet, verifyChapter } from "@/engine/verify/adapters"
import { CLEAN_READING, SAJU_1990F } from "./fixtures"

const facts: FactSheet = {
  schemaVersion: 1,
  engineVersion: "calendar@0.1.1+rules@0.2.0",
  asOf: "2026-06-01T00:00:00Z",
  subject: { addressAs: "손주", gender: "F", ageYears: 36, lifeStage: "establishment", hourKnown: true },
  chart: {
    pillars: { year: "庚午", month: "辛巳", day: "庚辰", hour: "癸未" },
    dayMaster: { stem: "庚", element: "metal", yinYang: "yang" },
    elements: { counts: { wood: 0, fire: 2, earth: 2, metal: 3, water: 1 } },
    tenGods: [],
    interactions: [],
    gongmang: { branches: ["申", "酉"], hits: [] },
  },
  luck: {
    direction: "backward",
    daeun: SAJU_1990F.daeun.map((d, i) => ({ index: i + 1, startAge: d.start_age, startYear: d.start_year, ganzhi: d.ganzhi, current: d.start_year === 2023 })),
    thisYear: { year: 2026, ganzhi: "丙午" },
  },
  personal: { userFacts: [{ topic: "life_event", value: "결혼", period: "2019" }], noGuessYears: [2019], guards: [] },
  warnings: [],
}

describe("contextFromFactSheet", () => {
  const ctx = contextFromFactSheet(facts)
  it("AI가 본 글자(사실표)가 검증 기준이 된다", () => {
    expect(ctx.sajuInput.pillars).toEqual(SAJU_1990F.pillars)
    expect(ctx.sajuInput.daeun).toEqual(SAJU_1990F.daeun)
    expect(ctx.sajuInput.this_year_ganzhi).toBe("丙午")
    expect(ctx.userFacts).toEqual([{ label: "결혼", topic: "life_event", value: "결혼", period: { fromYear: 2019, toYear: 2019 } }])
  })
  it("깨끗한 장은 통과, 사용자 사실을 맞힌 문장은 warn", () => {
    const ch = CLEAN_READING.parts[0].chapters[0]
    expect(verifyChapter(ch, ctx).findings).toEqual([])
    const bad = { ...ch, body: ["2019년 己亥에 결혼을 했다."] }
    expect(verifyChapter(bad, ctx).findings.map((f) => f.code)).toContain("KNOWN_FACT_AS_PREDICTION")
  })
  it("장 단위 검사도 위치에 장 번호가 붙는다", () => {
    const r = verifyChapter({ key: "x", title: "t", body: ["壬水가 돕는다."] }, ctx)
    expect(r.pass).toBe(false)
    expect(r.findings[0].location).toMatchObject({ path: "parts[0].chapters[0].body[0]", chapterKey: "x", paragraph: 0 })
  })
  it("장이 객체가 아니면 MALFORMED_READING", () => {
    expect(verifyChapter("문자열", ctx).findings[0].code).toBe("MALFORMED_READING")
  })
})
