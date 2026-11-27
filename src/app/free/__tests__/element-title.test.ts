import { describe, expect, it } from "vitest"
import { elementTitle } from "../_lib/element-title"
import type { ElementKo } from "../_lib/types"

describe("오행 카드 제목 조사", () => {
  it("오행 5개 x 넘침/없음/균형 제목에 받침 조사 오류가 없다", () => {
    const els: ElementKo[] = ["목", "화", "토", "금", "수"]
    for (const el of els) for (const k of ["excess", "lack", "balanced"] as const) {
      const t = elementTitle(k, el)
      expect(t).toContain("기운이")
      expect(t).not.toMatch(/\)(이|가|은|는|을|를) /)
      expect(t).not.toMatch(/\)[이가] |(?<!기운)[이가] 넘치/)
    }
  })
})
