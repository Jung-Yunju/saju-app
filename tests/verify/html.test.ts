// 9. UNSAFE_HTML — 본문 <b>만 허용
import { describe, expect, it } from "vitest"
import { findingsOf, readingOf, run, worst } from "./helpers"

const H = "UNSAFE_HTML" as const

describe("UNSAFE_HTML 통과 예문", () => {
  const ok = [
    "<b>庚</b>은 쇠다.",
    "<b>굵게</b> 그리고 <b>또</b> 굵게.",
    "꺾쇠 없는 글이다.",
    "3 < 5 같은 비교도 글자다.",
    "화살표 -> 는 태그가 아니다.",
  ]
  for (const t of ok)
    it(t, () => {
      expect(findingsOf(t, H)).toEqual([])
    })
  it("닫히지 않은 <b>는 info(화면이 자동 보정)", () => {
    expect(worst(findingsOf("<b>열린 굵게", H))).toBe("info")
  })
})

describe("UNSAFE_HTML 차단 예문", () => {
  const bad: [string, "block" | "warn"][] = [
    ["<script>alert(1)</script>", "block"],
    ["<img src=x onerror=alert(1)>", "block"],
    ["<b onclick=\"x()\">굵게</b>", "block"],
    ["<a href=\"javascript:alert(1)\">링크</a>", "block"],
    ["글 속 javascript:alert(1) 문자열", "block"],
    ["&#x3c;script&#x3e; 우회", "block"],
    ["<svg onload=alert(1)>", "block"],
    ["<br>줄바꿈", "warn"],
    ["<i>기울임</i>", "warn"],
  ]
  for (const [t, s] of bad)
    it(t, () => {
      expect(worst(findingsOf(t, H))).toBe(s)
    })
  it("body가 아닌 칸(제목)의 <b>는 warn", () => {
    const fs = run(readingOf("본문", { title: "<b>제목</b>" })).findings.filter((f) => f.code === H)
    expect(fs.map((f) => [f.location.field, f.severity, f.rule])).toEqual([
      ["title", "warn", "bold-outside-body"],
      ["title", "warn", "bold-outside-body"],
    ])
  })
})
