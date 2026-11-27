import { describe, expect, it } from "vitest"
import { firstSentence, pickElementFocus, selectCopy, type CopyFacts } from "@/app/free/_lib/content"
import { buildShareSpec, wrapLines } from "@/app/free/share-card"
import { PLACEHOLDER_TEXT, type FreeResult } from "@/app/free/_lib/types"

const facts: CopyFacts = {
  dayMaster: { hanja: "甲", ko: "갑", element: "목" },
  dayPillar: { hanja: "甲子", ko: "갑자" },
  elements: [{ el: "목", count: 3 }, { el: "화", count: 0 }, { el: "토", count: 2 }, { el: "금", count: 1 }, { el: "수", count: 0 }],
  thisYear: { year: 2026, hanja: "丙午", ko: "병오" },
}

describe("문안 선택", () => {
  it("문안 파일이 없으면 '문안 준비 중' 자리표시로 동작한다", () => {
    const c = selectCopy({}, facts)
    expect(c.dayMaster).toMatchObject({ text: PLACEHOLDER_TEXT, placeholder: true })
    expect(c.dayPillar.placeholder && c.thisYear.placeholder && c.teaser.placeholder && c.share.placeholder).toBe(true)
    expect(c.share.nickname).toBe("갑목 일간")
  })

  it("키 형식(객체·배열·한글 키)에 맞춰 일간·일주·올해 문장을 고른다", () => {
    const c = selectCopy({
      dayMaster: { 甲: { nickname: "큰 나무", text: "곧게 자라요. 그늘도 줘요." } },
      dayPillar: { entries: [{ ganzhi: "甲子", text: "물 위의 나무" }] },
      thisYear: { 병오: "불의 해" },
      shareCard: { 甲: { nickname: "봄 나무", line: "천천히 큰다." } },
    }, facts)
    expect(c.dayMaster).toMatchObject({ title: "큰 나무", placeholder: false })
    expect(c.dayPillar.text).toBe("물 위의 나무")
    expect(c.thisYear.text).toBe("불의 해")
    expect(c.share).toEqual({ nickname: "봄 나무", line: "천천히 큰다.", placeholder: false })
  })

  it("오행: 가장 많은 오행 1개 + 없는 오행(최대 2개)", () => {
    expect(pickElementFocus(facts.elements)).toEqual({ dominant: "목", lacking: ["화", "수"] })
    const c = selectCopy({ elements: { dominant: { 목: "목 많음" }, lacking: { 화: "화 없음" } } }, facts)
    expect(c.elements.map((e) => `${e.kind}:${e.el}:${e.text}`)).toEqual(["dominant:목:목 많음", "lacking:화:화 없음", `lacking:수:${PLACEHOLDER_TEXT}`])
  })

  it("깨진 형식이어도 예외 없이 자리표시로 돌아간다", () => {
    expect(() => selectCopy({ dayMaster: 5, dayPillar: [null, 3], elements: "x", teaser: 7, thisYear: [] }, facts)).not.toThrow()
  })

  it("한 줄은 첫 문장만, 60자 제한", () => {
    expect(firstSentence("첫째. 둘째.")).toBe("첫째.")
    expect(firstSentence("가".repeat(100)).length).toBe(60)
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
