// AI 입력 정리(prepareSajuInputForAi) — 개인정보 최소화: 출생지는 AI에 보내지 않는다
import { describe, expect, it } from "vitest"
import { prepareSajuInputForAi } from "@/app/api/reading/_lib/ai-input"

const base = {
  name: "길동",
  gender: "male",
  birth: "1990-03-15 08:30",
  calendar: "solar",
  pillars: { year: "庚午", month: "己卯", day: "甲子", hour: "戊辰" },
  hour_unknown: false,
  daeun: [],
  gongmang: { day: "戌亥", year: "戌亥" },
  this_year: 2026,
  this_year_ganzhi: "丙午",
  known_facts: ["사용자가 넣지 않은 사실"],
  voice: "grandma",
}

describe("prepareSajuInputForAi", () => {
  it("birthplace(이름·경도)를 키째 지운다", () => {
    const raw = { ...base, birthplace: { name: "부산", longitude: 129.0756 } }
    const out = prepareSajuInputForAi(raw)
    expect(out).not.toBeNull()
    expect(out).not.toHaveProperty("birthplace")
    const text = JSON.stringify(out)
    expect(text).not.toContain("부산")
    expect(text).not.toContain("129.0756")
  })
  it("원본(DB 값)은 바꾸지 않는다", () => {
    const raw = { ...base, birthplace: { name: "부산", longitude: 129.0756 } }
    prepareSajuInputForAi(raw)
    expect(raw.birthplace).toEqual({ name: "부산", longitude: 129.0756 })
  })
  it("출생지 없는 예전 레코드도 그대로 처리", () => {
    const out = prepareSajuInputForAi(base)
    expect(out).not.toHaveProperty("birthplace")
    expect(out?.pillars).toEqual(base.pillars)
  })
  it("기존 정리 규칙 유지: known_facts 비움, 잘못된 이름은 없앰", () => {
    expect(prepareSajuInputForAi(base)?.known_facts).toEqual([])
    expect(prepareSajuInputForAi({ ...base, name: "가".repeat(21) })?.name).toBeUndefined()
    expect(prepareSajuInputForAi({ ...base, name: 42 })?.name).toBeUndefined()
  })
  it("객체가 아니면 null", () => {
    for (const v of [null, undefined, "x", 1, []]) expect(prepareSajuInputForAi(v)).toBeNull()
  })
})
