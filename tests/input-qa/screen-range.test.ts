// U-03 독립 검증(품질검증 담당) — 화면 쪽 범위 검사(관찰·결함 재현)
import { describe, expect, it } from "vitest"
import { buildRequest, emptyForm } from "@/app/input/build-request"
import { validateReadingRequest } from "@/lib/validate"

const f = (y: string) => ({ ...emptyForm(), birthYear: y, birthMonth: "3", birthDay: "1", gender: "F" })

describe("화면 생년 상한", () => {
  it("[결함 D3] 2025·2026년생(오늘 2026-11-27 기준 실재 출생)을 화면이 막는다 — 서버는 허용", () => {
    for (const y of ["2025", "2026"]) {
      const r = buildRequest("BASIC", f(y), null)
      expect("error" in r, y).toBe(true) // 현행: "생년을 1900~2024 사이로 입력해 주세요."
      const server = validateReadingRequest({ readingType: "BASIC", birthYear: Number(y), birthMonth: 3, birthDay: 1, birthHour: null, gender: "F", calType: "SOLAR" })
      expect(server.ok, y).toBe(true)
    }
  })
})
