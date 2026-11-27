// U-03 독립 검증(품질검증 담당) — 화면 쪽 생년 범위
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { buildRequest, emptyForm } from "@/app/input/build-request"
import { validateReadingRequest } from "@/lib/validate"

const f = (y: string) => ({ ...emptyForm(), birthYear: y, birthMonth: "3", birthDay: "1", gender: "F" })
const thisYear = new Date().getFullYear()

describe("화면 생년 상한", () => {
  it("buildRequest: 올해 출생까지 받고(서버도 허용), 내년은 막는다 — 검증 중 프론트가 2024 고정값을 고침(ad4cb2d)", () => {
    for (const y of [String(thisYear - 1), String(thisYear)]) {
      expect("error" in buildRequest("BASIC", f(y), null), y).toBe(false)
      const server = validateReadingRequest({ readingType: "BASIC", birthYear: Number(y), birthMonth: 3, birthDay: 1, birthHour: null, gender: "F", calType: "SOLAR" })
      expect(server.ok, y).toBe(true)
    }
    expect("error" in buildRequest("BASIC", f(String(thisYear + 1)), null)).toBe(true)
  })

  // 브라우저는 <input type=number max>를 넘는 값이 있으면 form 제출 자체를 막는다(Chromium 실측: "Value must be less than or equal to 2024.")
  // page.tsx의 <form>에 noValidate가 없으므로 birth-card.tsx의 max="2024"가 남아 있으면 2025년 이후 출생은 여전히 제출되지 않는다.
  it.fails("[결함 D2 잔여] birth-card.tsx 생년 입력칸 max 속성이 올해 이상이다", () => {
    const src = readFileSync(join(__dirname, "..", "..", "src/app/input/birth-card.tsx"), "utf8")
    const m = /placeholder="예\) 1990"[^>]*max="(\d{4})"/.exec(src)
    if (m) expect(Number(m[1])).toBeGreaterThanOrEqual(thisYear)
  })
})
