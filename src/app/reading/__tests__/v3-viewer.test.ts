// v3 풀이 리더 화면 테스트 — 서버 렌더(renderToStaticMarkup)로 상태별 화면을 확인한다. 실제 API 호출 없음.
import { describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }))
vi.mock("next/link", () => ({
  default: (p: { href: string; children?: unknown; className?: string }) => createElement("a", { href: p.href, className: p.className }, p.children as never),
}))

import V3Reader from "../[id]/v3/V3Reader"
import { easyPosition, planOf } from "../[id]/v3/model"
import { isStoredReadingV3 } from "@/lib/generate-reading-v3"
import { fakeStoredV3 } from "./v3-fixture"

const base = { userName: "손주", readingName: "나는 어떤 사람인가", birthInfo: "양력 1990년 5월 15일 · 여성", createdAt: "2026년 11월 27일" }
const render = (stored: ReturnType<typeof fakeStoredV3>, initialPage?: "toc" | number) =>
  renderToStaticMarkup(createElement(V3Reader, { ...base, stored, initialPage }))

describe("v3 리더", () => {
  it("가짜 저장본은 v3 판정을 통과한다", () => {
    expect(isStoredReadingV3(fakeStoredV3())).toBe(true)
  })

  it("complete 목차: 8장 전부, 진행 막대 없음, '만드는 중' 안내 없음", () => {
    const html = render(fakeStoredV3())
    expect(html.match(/v3-toc-no/g)?.length).toBe(8)
    expect(html).not.toContain("만드는 중")
    expect(html).not.toContain("progressbar")
  })

  it("장 쪽: 3/8 진행 막대·이전/다음·할 일 강조·쉬운 근거 이름, 한자는 접힘", () => {
    const html = render(fakeStoredV3(), 0)
    expect(html).toContain("1/8")
    expect(html).toContain('role="progressbar"')
    expect(html).toContain("일지 · 가장 가까운 자리")
    expect(html).toContain("바꿔 볼 것")
    expect(html).toContain("<b>부드럽고 잘 휘는 풀</b>")
    expect(html).toContain(">목차<")
    expect(html).toContain(">다음<")
    // 칩을 누르기 전에는 한자 글자 칸·위치 코드가 없다
    expect(html).not.toContain("v3-chip-detail")
    expect(html).not.toContain("year.branch+day.branch")
    expect(render(fakeStoredV3(), 2)).toContain("3/8")
  })

  it("장별 추가 칸이 화면에 나온다(talent fits·money habits·daeun-now faces/next·year-ahead years·crossroads forks·closing points/review)", () => {
    const s = fakeStoredV3()
    const at = (id: string) => s.chapters.findIndex((c) => c.id === id)
    expect(render(s, at("talent"))).toContain("값이 오르는 자리")
    expect(render(s, at("money"))).toContain("돈의 버릇")
    const dn = render(s, at("daeun-now"))
    expect(dn).toContain("이 열 해가 올 수 있는 얼굴")
    expect(dn).toContain("다음 열 해")
    expect(render(s, at("year-ahead"))).toContain("올해와 내년")
    expect(render(s, at("crossroads"))).toContain("갈림길")
    const cl = render(s, at("closing"))
    expect(cl).toContain("가져갈 당부")
    expect(cl).toContain("일 년 뒤 가려 볼 말")
    expect(cl).toContain("빈 몸이라야 멀리 타고 간다") // 마지막 말(고정 문구)은 complete 마지막 장에만
    expect(cl).toContain("목차로")
  })

  it("partial/FAILED: 통과한 장만, '나머지 장을 만드는 중' 안내", () => {
    const s = fakeStoredV3({}, ["money", "closing"])
    const plan = planOf(s)
    expect(plan.mode).toBe("partial")
    expect(plan.pages).toHaveLength(6)
    const html = render(s)
    expect(html).toContain("나머지 장을 만드는 중")
    expect(html.match(/v3-toc-no">\d/g)?.length).toBe(6)
    expect(html).toContain("만드는 중</span>")
    expect(render(s, 5)).toContain("6/6")
    expect(render(s, 5)).not.toContain("빈 몸이라야")
  })

  it("complete라고 적혀 있어도 통과 못 한 장이 있으면 partial로 본다", () => {
    const s = fakeStoredV3({ status: "complete" }, ["money"])
    s.status = "complete"
    expect(planOf(s).mode).toBe("partial")
  })

  it("crisis: 저장된 상담 안내 문구만(풀이·근거·막대 없음)", () => {
    const s = fakeStoredV3({ status: "crisis", crisis: { message: "풀이는 접어 둘게요. 상담전화 109" }, chapters: [] })
    const html = render(s)
    expect(html).toContain("풀이는 접어 둘게요. 상담전화 109")
    expect(html).not.toContain("progressbar")
    expect(html).not.toContain("v3-toc")
    expect(html).not.toContain("v3-pager")
  })

  it("본문의 <b> 외 태그는 그대로 글자로만 나온다(HTML 주입 없음)", () => {
    const s = fakeStoredV3()
    ;(s.chapters[0].output as { body: string[] }).body = ['<img src=x onerror=alert(1)> 안녕 <b>굵게</b>']
    const html = render(s, 0)
    expect(html).not.toContain("<img")
    expect(html).toContain("<b>굵게</b>")
  })

  it("위치 코드 → 쉬운 이름", () => {
    expect(easyPosition("day.branch")).toBe("일지 · 가장 가까운 자리")
    expect(easyPosition("year.branch+day.branch")).toBe("연지 · 뿌리와 어린 시절 + 일지 · 가장 가까운 자리")
    expect(easyPosition("month.branch.jeonggi")).toContain("속에 든 중심 기운")
    expect(easyPosition("daeun[3].stem")).toContain("대운")
    expect(easyPosition("???")).toBe("사주 속 한 자리")
  })
})
