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
  // page.tsx의 <form>에 noValidate가 없으므로 입력칸 max가 올해보다 작으면 그 뒤 출생은 제출되지 않는다.
  // [결함 D2 종결 2026-11-27 QA] birth-card.tsx가 max={currentMaxBirthYear()}(build-request.ts, min(2100, 올해))로 바뀜 — 검증과 같은 값 사용.
  it("[결함 D2 종결] birth-card.tsx 생년 입력칸 max가 올해 이상이고 검증과 같은 상한 함수를 쓴다", async () => {
    const src = readFileSync(join(__dirname, "..", "..", "src/app/input/birth-card.tsx"), "utf8")
    const tag = /<input[^>]*placeholder="예\) 1990"[^>]*>/.exec(src)
    expect(tag, "생년 입력칸을 찾지 못함").not.toBeNull()
    const lit = /max="(\d{4})"/.exec(tag![0])
    if (lit) {
      expect(Number(lit[1])).toBeGreaterThanOrEqual(thisYear)
    } else {
      // Next 16 프리렌더: 렌더 중 new Date() 금지 -> 렌더 max는 고정 상한, 올해 상한은 buildRequest가 제출 시 검증
      expect(tag![0]).toMatch(/max=\{MAX_BIRTH_YEAR\}/)
      const { currentMaxBirthYear, MAX_BIRTH_YEAR } = await import("@/app/input/build-request")
      expect(MAX_BIRTH_YEAR).toBeGreaterThanOrEqual(thisYear)
      expect(currentMaxBirthYear()).toBe(Math.min(MAX_BIRTH_YEAR, thisYear))
    }
  })
})
