// verify@0.3.1 — 바넘 비율: 상품 소개 칸(teaser·toc·preview …) 칸 단위 예외 + 그림 말은 근거 표지가 아님
import { describe, expect, it } from "vitest"
import { BARNUM_EXEMPT_KEYS, isBarnumExempt, verifyReading } from "@/engine/verify"
import { hasBasisMarker } from "@/engine/verify/checks/barnum"
import { SAJU_MIN } from "./helpers"

const PROMO = ["유료 풀이에서 돈이 드나드는 문을 펼쳐 본다.", "열 해마다 바뀌는 옷을 한 장씩 짚어 본다.", "마지막 장에서 가져갈 세 가지를 고른다."]
const chapter = (extra: Record<string, unknown>) => ({ parts: [{ title: "미리보기", chapters: [{ key: "free-preview", title: "미리보기", ...extra }] }] })
const ratioWarns = (r: ReturnType<typeof verifyReading>) => r.findings.filter((f) => f.code === "BARNUM" && f.rule === "ratio")

describe("상품 소개 칸은 바넘 비율에서 빠진다", () => {
  it("기본 예외 키", () => {
    expect(BARNUM_EXEMPT_KEYS).toEqual(expect.arrayContaining(["teaser", "toc", "preview"]))
  })
  it("toc[].text만 있는 장: 비율 경고 0, 통계에 exempt로 남는다", () => {
    const r = verifyReading(chapter({ toc: PROMO.map((text, i) => ({ chapter_id: String(i), text })) }), { sajuInput: SAJU_MIN })
    expect(ratioWarns(r)).toEqual([])
    const st = r.stats.barnumByChapter.find((s) => s.path === "parts[0].chapters[0]")!
    expect(st).toMatchObject({ sentences: 0, unmarked: 0, ratio: 0, exempt: 3 })
    expect(r.stats.sentences).toBe(3)
  })
  it("teaser[].text도 같다", () => {
    const r = verifyReading(chapter({ teaser: PROMO.map((text) => ({ name: "메뉴", text })) }), { sajuInput: SAJU_MIN })
    expect(ratioWarns(r)).toEqual([])
  })
  it("같은 장의 본문(body)은 그대로 비율을 본다 — 소개 칸을 빼고 본문만으로 계산", () => {
    // body 2문장 중 근거 없는 것 2 → 100% > 50% → 경고. toc 3문장은 분모에 들어가지 않는다
    const r = verifyReading(
      chapter({ toc: [{ text: "庚 일간이 돈을 다루는 법을 본다." }, ...PROMO.map((text) => ({ text }))], body: ["오늘은 차를 마셔라. 내일은 일찍 자라."] }),
      { sajuInput: SAJU_MIN },
    )
    const st = r.stats.barnumByChapter.find((s) => s.path === "parts[0].chapters[0]")!
    expect(st).toMatchObject({ sentences: 2, unmarked: 2, ratio: 1, exempt: 4 })
    expect(ratioWarns(r)).toHaveLength(1)
  })
  it("일반 칸 이름(items)은 예외가 아니다 — 0.3.0과 같게 경고", () => {
    const r = verifyReading(chapter({ items: PROMO.map((text) => ({ text })) }), { sajuInput: SAJU_MIN })
    expect(ratioWarns(r)).toHaveLength(1)
  })
  it("설정으로 키를 바꾼다: barnumExemptKeys=['items'] → 예외, [] → 예외 없음", () => {
    const withItems = verifyReading(chapter({ items: PROMO.map((text) => ({ text })) }), { sajuInput: SAJU_MIN, options: { barnumExemptKeys: ["items"] } })
    expect(ratioWarns(withItems)).toEqual([])
    const none = verifyReading(chapter({ toc: PROMO.map((text) => ({ text })) }), { sajuInput: SAJU_MIN, options: { barnumExemptKeys: [] } })
    expect(ratioWarns(none)).toHaveLength(1)
  })
  it("예외 칸도 상투 문장 사전 검사는 받는다", () => {
    const r = verifyReading(chapter({ teaser: [{ text: "누구나 겉으로는 강해 보여도 속은 여리다." }] }), { sajuInput: SAJU_MIN })
    expect(r.findings.some((f) => f.code === "BARNUM" && f.rule === "phrase")).toBe(true)
    expect(ratioWarns(r)).toEqual([])
  })
  it("예외 칸도 금지 주제 검사는 그대로(block)", () => {
    const r = verifyReading(chapter({ teaser: [{ text: "2027년에 큰 병을 얻는 해를 미리 알려 준다." }] }), { sajuInput: SAJU_MIN })
    expect(r.pass).toBe(false)
  })
  it("isBarnumExempt는 경로의 상위 키로만 판단한다(값·글 내용은 보지 않는다)", () => {
    expect(isBarnumExempt({ path: "parts[0].chapters[0].toc[2].text" })).toBe(true)
    expect(isBarnumExempt({ path: "parts[0].chapters[0].body[0]" })).toBe(false)
    expect(isBarnumExempt({ path: "parts[0].chapters[0].details[0].text" })).toBe(false)
  })
})

describe("그림 말은 근거 표지가 아니다(QA 권고 유지)", () => {
  it.each(["한여름 한낮의 불 같은 너는 때로는 외롭다.", "위로 곧게 크는 큰 나무처럼 너도 인정받고 싶은 마음이 크다.", "가까운 데를 오래 비추는 등불이 곁에 선다."])("%s", (s) => {
    expect(hasBasisMarker(s)).toBe(false)
  })
})
