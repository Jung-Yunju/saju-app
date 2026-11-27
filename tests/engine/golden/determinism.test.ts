// 골든 ⑧ 결정성 — 같은 입력 두 번 호출 결과 동일, 입력 객체를 바꾸지 않음
import { describe, expect, it } from "vitest"
import { computeChart, type BirthInput } from "@/engine"
import { SEOUL } from "./helpers"

const inputs: BirthInput[] = [
  { calendar: "solar", year: 1987, month: 7, day: 15, time: { hour: 12, minute: 0 }, timezone: SEOUL, gender: "F" },
  { calendar: "solar", year: 2024, month: 2, day: 4, time: { hour: 17, minute: 40 }, timezone: SEOUL, gender: "M" },
  { calendar: "lunar", year: 2023, month: 2, day: 10, isLeapMonth: true, time: { hour: 23, minute: 30 }, timezone: SEOUL, gender: "M" },
  { calendar: "solar", year: 1958, month: 8, day: 8, time: null, timezone: SEOUL, gender: "F" },
  { calendar: "solar", year: 2001, month: 12, day: 31, time: { hour: 0, minute: 10 }, longitude: 129.0, gender: "M" },
]

describe("골든 ⑧ 결정성", () => {
  for (const inp of inputs) {
    it(`${inp.calendar} ${inp.year}-${inp.month}-${inp.day} ${inp.time ? `${inp.time.hour}:${inp.time.minute}` : "시각 모름"}`, () => {
      const snapshot = structuredClone(inp)
      const a = computeChart(inp)
      const b = computeChart(structuredClone(inp))
      expect(JSON.parse(JSON.stringify(b))).toEqual(JSON.parse(JSON.stringify(a)))
      expect(inp).toEqual(snapshot)
      const c = computeChart(inp, { trueSolarTime: false, ziHour: "yajasi" })
      const d = computeChart(inp, { trueSolarTime: false, ziHour: "yajasi" })
      expect(d).toEqual(c)
    })
  }
})
