import { describe, expect, it } from "vitest"
import { escapeHtml, sanitizeBoldHtml } from "@/lib/sanitize"

describe("sanitizeBoldHtml", () => {
  it("<b></b>만 살린다", () => {
    expect(sanitizeBoldHtml("너는 <b>나무</b> 같은 사람이야")).toBe("너는 <b>나무</b> 같은 사람이야")
    expect(sanitizeBoldHtml("<B>크게</B>")).toBe("<b>크게</b>")
  })
  it("다른 태그·속성 붙은 b·이벤트 핸들러는 글자로 이스케이프", () => {
    expect(sanitizeBoldHtml('<img src=x onerror="alert(1)">')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    )
    expect(sanitizeBoldHtml("<b onclick=alert(1)>x</b>")).toBe("&lt;b onclick=alert(1)&gt;x")
    expect(sanitizeBoldHtml("<script>alert('x')</script>")).toBe(
      "&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;",
    )
    expect(sanitizeBoldHtml("<br>")).toBe("&lt;br&gt;")
  })
  it("이미 이스케이프된 문자열로 태그를 만들 수 없다", () => {
    expect(sanitizeBoldHtml("&lt;b&gt;x")).toBe("&amp;lt;b&amp;gt;x")
  })
  it("짝이 안 맞는 태그를 정리한다", () => {
    expect(sanitizeBoldHtml("</b>앞")).toBe("앞")
    expect(sanitizeBoldHtml("<b>안 닫힘")).toBe("<b>안 닫힘</b>")
    expect(sanitizeBoldHtml("<b><b>a</b>")).toBe("<b><b>a</b></b>")
  })
  it("문자열이 아니면 빈 문자열", () => {
    expect(sanitizeBoldHtml(undefined)).toBe("")
    expect(sanitizeBoldHtml(null)).toBe("")
    expect(sanitizeBoldHtml({ toString: () => "<script>" })).toBe("")
  })
  it("결과에 남는 '<'는 <b>·</b>뿐", () => {
    const out = sanitizeBoldHtml('<b>a</b><i>b</i><svg/onload=x><a href="javascript:x">c</a>')
    const tags = out.match(/<[^>]*>/g) ?? []
    expect(tags.every(t => t === "<b>" || t === "</b>")).toBe(true)
  })
})

describe("escapeHtml", () => {
  it("다섯 글자를 이스케이프", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;")
  })
})
