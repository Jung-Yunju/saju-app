// U-01 독립 검증 — ⑧ AI 출력 innerHTML 소독, 코드 정적 점검(경로별 인증 함수·innerHTML 사용처·비밀값)
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"
import { sanitizeBoldHtml } from "@/lib/sanitize"

const ROOT = join(__dirname, "..", "..")
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}
const rel = (p: string) => relative(ROOT, p).replace(/\\/g, "/")

/** 소독 결과에 <b>·</b> 이외의 태그가 '태그로' 남아 있는지 */
function hasNonBoldTag(html: string): boolean {
  return /<(?!\/?b>)/i.test(html)
}

describe("⑧ sanitizeBoldHtml — 공격 문자열", () => {
  const payloads = [
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    "<b onclick=alert(1)>x</b>",
    "<b style='x'>x</b>",
    "<b\tonmouseover=alert(1)>x",
    "<b/onload=alert(1)>",
    "<B>굵게</B><SCRIPT>x</SCRIPT>",
    "<svg><b>x</b></svg>",
    "<b><a href='javascript:alert(1)'>x</a></b>",
    "&lt;script&gt;alert(1)&lt;/script&gt;",
    "&lt;b onclick=1&gt;",
    "<<b>script>alert(1)<</b>/script>",
    "<b>x</b\n>",
    "<iframe srcdoc='<b>x</b>'>",
    "<script>",
    "<!--<b>--><script>x</script>",
    "<b>" .repeat(1000) + "x",
    "</b>".repeat(50) + "<b>x",
    "\"><b>'\"`",
    "<b >x</b >",
    "<math><mi xlink:href='javascript:1'>",
  ]
  it.each(payloads.map((p) => [p.slice(0, 50), p]))("%s", (_l, p) => {
    const out = sanitizeBoldHtml(p)
    expect(hasNonBoldTag(out)).toBe(false)
    expect(out).not.toMatch(/<b[^>]/i) // 속성 붙은 b 없음
    // 열림·닫힘 짝이 맞는다
    expect((out.match(/<b>/g) ?? []).length).toBe((out.match(/<\/b>/g) ?? []).length)
    expect(out).not.toMatch(/["']/) // 따옴표는 엔티티로
  })

  it("정상 굵게는 유지", () => {
    expect(sanitizeBoldHtml("안녕 <b>할미</b>야")).toBe("안녕 <b>할미</b>야")
  })

  it("문자열이 아닌 값(객체·배열·숫자·null)은 빈 문자열", () => {
    for (const v of [{ toString: () => "<script>" }, ["<script>"], 1, null, undefined]) {
      expect(sanitizeBoldHtml(v)).toBe("")
    }
  })

  it("1MB 입력도 1초 안에 처리 (정규식 폭주 없음)", () => {
    const big = "<b>".repeat(50_000) + "&<>\"'".repeat(150_000)
    const t = Date.now()
    sanitizeBoldHtml(big)
    expect(Date.now() - t).toBeLessThan(1000)
  })
})

describe("정적 점검", () => {
  const files = walk(join(ROOT, "src"))

  it("dangerouslySetInnerHTML / innerHTML 사용처는 모두 sanitizeBoldHtml을 거친다", () => {
    const bad: string[] = []
    for (const f of files) {
      const lines = readFileSync(f, "utf8").split("\n")
      lines.forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) return // 주석
        if (/dangerouslySetInnerHTML|\.innerHTML\s*=|outerHTML\s*=|insertAdjacentHTML/.test(line) && !/sanitizeBoldHtml\(/.test(line)) {
          bad.push(`${rel(f)}:${i + 1}`)
        }
      })
    }
    expect(bad).toEqual([])
  })

  it("react-markdown에 원시 HTML 허용 플러그인(rehype-raw)·skipHtml=false 없음", () => {
    const hits = files.filter((f) => /rehype-raw|rehypeRaw|allowDangerousHtml/.test(readFileSync(f, "utf8"))).map(rel)
    expect(hits).toEqual([])
  })

  it("API 라우트(auth 제외)는 로그인 판별에 getSessionUser만 쓴다 (auth() 직접 호출·session.user.id 직접 사용 없음)", () => {
    const api = files.filter((f) => rel(f).startsWith("src/app/api/") && /route\.ts$/.test(f) && !rel(f).includes("[...nextauth]"))
    expect(api.length).toBeGreaterThanOrEqual(7)
    const bad: string[] = []
    for (const f of api) {
      const s = readFileSync(f, "utf8")
      if (/from "@\/lib\/auth"/.test(s) || /session\.user\.id/.test(s)) bad.push(`${rel(f)}: auth 직접 사용`)
      if (!/getSessionUser\(/.test(s)) bad.push(`${rel(f)}: getSessionUser 미사용`)
    }
    expect(bad).toEqual([])
  })

  it("API 라우트 응답에 err.message·String(err)·stack을 그대로 싣지 않는다", () => {
    const api = files.filter((f) => rel(f).startsWith("src/app/api/"))
    const bad: string[] = []
    for (const f of api) {
      readFileSync(f, "utf8").split("\n").forEach((line, i) => {
        if (/NextResponse\.json|jsonError\(/.test(line) && /(err|e|error)\.(message|stack)|String\((err|e|error)\)/.test(line)) bad.push(`${rel(f)}:${i + 1}`)
      })
    }
    expect(bad).toEqual([])
  })

  it("소스에 비밀키 형태 문자열이 하드코딩돼 있지 않다", () => {
    const pat = /(sk-ant-[A-Za-z0-9_-]{10,}|live_sk_[A-Za-z0-9]{10,}|test_sk_[A-Za-z0-9]{10,}|AKIA[0-9A-Z]{16}|postgres(ql)?:\/\/[^"'\s]*:[^"'\s]*@|GOCSPX-[A-Za-z0-9_-]{10,})/
    const hits = files.filter((f) => pat.test(readFileSync(f, "utf8"))).map(rel)
    expect(hits).toEqual([])
  })

  it("NEXT_PUBLIC_ 환경변수로 비밀값(SECRET·KEY 중 클라이언트 키 외)을 노출하지 않는다", () => {
    const bad: string[] = []
    for (const f of files) {
      for (const m of readFileSync(f, "utf8").matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) {
        if (/SECRET|PRIVATE|PASSWORD|DATABASE|ANTHROPIC/.test(m[0])) bad.push(`${rel(f)}: ${m[0]}`)
      }
    }
    expect(bad).toEqual([])
  })
})
