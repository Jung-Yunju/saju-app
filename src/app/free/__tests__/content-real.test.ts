import { describe, expect, it } from "vitest"
import path from "node:path"
import { loadRawContent, selectCopy, type CopyFacts } from "../_lib/content"
import type { ElementKo } from "../_lib/types"

// 실제 content/free/*.json 이 content.ts 정규화 함수에서 전부 문안으로 읽히는지(자리표시 "문안 준비 중"이 안 나오는지) 확인
const real = loadRawContent(path.join(process.cwd(), "content", "free"))
const ELS: ElementKo[] = ["목", "화", "토", "금", "수"]
const base: CopyFacts = {
  dayMaster: { hanja: "甲", ko: "갑", element: "목" }, dayPillar: { hanja: "甲子", ko: "갑자" }, dayBranch: { hanja: "子", ko: "자" },
  elements: [], hourUnknown: false, thisYear: { year: 2026, hanja: "丙午", ko: "병오" },
}

describe("실제 문안 JSON 읽기", () => {
  it("오행 5개 x (넘침/없음/균형) x 일간 5오행 모두 문안이 나온다", () => {
    const dms: [string, string, ElementKo][] = [["甲", "갑", "목"], ["丙", "병", "화"], ["戊", "무", "토"], ["庚", "경", "금"], ["壬", "임", "수"]]
    for (const [hanja, ko, element] of dms) for (const el of ELS) for (const mode of ["excess", "lack", "balanced"] as const) {
      const counts = ELS.map((e) => ({ el: e, count: mode === "excess" ? (e === el ? 4 : 1) : mode === "lack" ? (e === el ? 0 : 2) : 2 }))
      const c = selectCopy(real, { ...base, dayMaster: { hanja, ko, element }, elements: counts })
      const hit = c.elements.find((x) => x.el === el && x.kind === mode)
      if (mode === "balanced") { expect(c.elements.length).toBeGreaterThan(0) } else expect(hit, `${ko}${el}${mode}`).toBeTruthy()
      expect(c.elements.every((x) => !x.placeholder), `${ko}${el}${mode}`).toBe(true)
    }
  })
  it("올해(2026·2027) 값이 문안으로 나온다", () => {
    for (const y of [2026, 2027]) expect(selectCopy(real, { ...base, thisYear: { year: y, hanja: "", ko: "" } }).thisYear.placeholder, String(y)).toBe(false)
  })
})
