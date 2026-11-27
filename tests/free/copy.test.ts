import { describe, expect, it } from "vitest"
import { firstSentence, selectCopy, type CopyFacts } from "@/app/free/_lib/content"
import { buildShareSpec, wrapLines } from "@/app/free/share-card"
import { PLACEHOLDER_TEXT, type FreeResult } from "@/app/free/_lib/types"

import fs from "node:fs"
import path from "node:path"
import { classifyElements, fillTokens, loadRawContent } from "@/app/free/_lib/content"

const facts: CopyFacts = {
  dayMaster: { hanja: "甲", ko: "갑", element: "목" },
  dayPillar: { hanja: "甲子", ko: "갑자" },
  dayBranch: { hanja: "子", ko: "자" },
  elements: [{ el: "목", count: 3 }, { el: "화", count: 0 }, { el: "토", count: 2 }, { el: "금", count: 1 }, { el: "수", count: 2 }],
  hourUnknown: false,
  thisYear: { year: 2026, hanja: "丙午", ko: "병오" },
}
const real = loadRawContent(path.join(process.cwd(), "content", "free"))
const hasReal = fs.existsSync(path.join(process.cwd(), "content/free/day-master.json"))

describe("문안 선택", () => {
  it("문안 파일이 없으면 '문안 준비 중' 자리표시로 동작한다", () => {
    const c = selectCopy({}, facts)
    expect(c.dayMaster).toMatchObject({ text: PLACEHOLDER_TEXT, placeholder: true })
    expect(c.dayPillar.placeholder && c.thisYear.placeholder && c.teaser.placeholder && c.share.placeholder).toBe(true)
    expect(c.share.nickname).toBe("갑목 일간")
  })

  it("치환 토큰: 모두 채우고, 값이 없으면 그 문장을 버린다", () => {
    expect(fillTokens("{a}는 {b}", { a: "가", b: "나" })).toBe("가는 나")
    expect(fillTokens("{a}는 {b}", { a: "가" })).toBeNull()
  })

  it("오행 판정: 0=없음, 4개 이상(시주 모름 3개 이상)=넘침, 없으면 가장 많은 오행 알맞음", () => {
    const e = (c: number[]) => (["목", "화", "토", "금", "수"] as const).map((el, i) => ({ el, count: c[i] }))
    expect(classifyElements(e([4, 0, 2, 1, 1]), false, "목")).toEqual([{ kind: "excess", el: "목" }, { kind: "lack", el: "화" }])
    expect(classifyElements(e([3, 1, 1, 1, 0]), false, "목")).toEqual([{ kind: "lack", el: "수" }])
    expect(classifyElements(e([3, 1, 1, 1, 0]), true, "목")[0]).toEqual({ kind: "excess", el: "목" })
    expect(classifyElements(e([2, 2, 1, 2, 1]), false, "금")).toEqual([{ kind: "balanced", el: "금" }])
  })

  it("깨진 형식이어도 예외 없이 자리표시로 돌아간다", () => {
    expect(() => selectCopy({ dayMaster: 5, dayPillar: [null, 3], elements: "x", teaser: 7, thisYear: [] }, facts)).not.toThrow()
  })

  it("한 줄은 첫 문장만, 60자 제한", () => {
    expect(firstSentence("첫째. 둘째.")).toBe("첫째.")
    expect(firstSentence("가".repeat(100)).length).toBe(60)
  })

  it.skipIf(!hasReal)("실제 문안(content/free): 일간 10개 × 일주 60개 전부 채워지고 {토큰}이 남지 않는다", () => {
    const stems = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"]
    const kos = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"]
    const els = ["목", "목", "화", "화", "토", "토", "금", "금", "수", "수"] as const
    const branches = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]
    const bko = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"]
    for (let i = 0; i < 60; i++) {
      const si = i % 10, bi = i % 12
      const c = selectCopy(real, {
        ...facts, dayMaster: { hanja: stems[si], ko: kos[si], element: els[si] },
        dayPillar: { hanja: stems[si] + branches[bi], ko: kos[si] + bko[bi] }, dayBranch: { hanja: branches[bi], ko: bko[bi] },
      })
      const all = JSON.stringify(c)
      expect(c.dayMaster.placeholder, stems[si]).toBe(false)
      expect(c.dayPillar.placeholder, stems[si] + branches[bi]).toBe(false)
      expect(c.thisYear.placeholder, stems[si]).toBe(false)
      expect(c.share.placeholder).toBe(false)
      expect(c.elements.every((e) => !e.placeholder)).toBe(true)
      expect(all).not.toMatch(/\{\w+\}/)
    }
  })

  it.skipIf(!hasReal)("실제 문안: teaser의 needsConfirm 항목(P3·P8)은 숨기고, 일지 충·합 덧줄은 해당자에게만", () => {
    const c = selectCopy(real, facts) // 일지 子 + 2026 午 = 자오충
    expect(c.teaser.items.map((i) => i.menu).join("|")).not.toMatch(/앞으로 열 해 날씨|한 해 옷 고쳐 입기/)
    expect(c.teaser.items.length).toBe(6)
    expect(c.thisYear.text).toContain("자오충")
    const other = selectCopy(real, { ...facts, dayBranch: { hanja: "寅", ko: "인" } })
    expect(other.thisYear.text).not.toContain("자오충")
  })

  it.skipIf(!hasReal)("실제 문안: 일간이 다르면 별명·올해 줄이 다르다", () => {
    const a = selectCopy(real, facts)
    const b = selectCopy(real, { ...facts, dayMaster: { hanja: "庚", ko: "경", element: "금" } })
    expect(a.share.nickname).not.toBe(b.share.nickname)
    expect(a.thisYear.text).not.toBe(b.thisYear.text)
  })
})

describe("공유 카드 문구", () => {
  const r = {
    dayMaster: { hanja: "甲", ko: "갑", element: "목", nickname: "큰 나무" },
    copy: { share: { nickname: "큰 나무", line: "곧게 자라는 사람", placeholder: false } },
  } as unknown as Pick<FreeResult, "dayMaster" | "copy">

  it("일간 별명·한 줄·사이트 이름만 담고 생년월일·이름이 없다", () => {
    const s = buildShareSpec(r)
    const all = JSON.stringify(s)
    expect(all).toContain("큰 나무")
    expect(all).toContain("할머니가 풀어 주는 사주")
    expect(all).not.toMatch(/\d{4}/) // 연도
    expect(s.path).toBe(`/free/dm/${encodeURIComponent("甲")}`)
    expect(Object.keys(s).sort()).toEqual(["dmHanja", "dmKo", "element", "filename", "line", "nickname", "path", "shareText", "site"])
  })

  it("줄바꿈은 줄 수 제한과 말줄임을 지킨다", () => {
    const lines = wrapLines((s) => s.length * 10, "가나다라마바사 아자차카타파하 ".repeat(6), 100, 3)
    expect(lines).toHaveLength(3)
    expect(lines[2].endsWith("…")).toBe(true)
  })
})
