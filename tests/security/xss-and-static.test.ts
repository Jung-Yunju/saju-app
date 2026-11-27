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

  /**
   * 허용 목록(품질검증 판정 2026-11-27): 고정 문자열만 넣는 사용처. 줄 내용이 정확히 이 패턴일 때만 허용한다.
   * - src/app/free/bokja.tsx: 복자 고양이 SVG(bokjaInner) — 사용자 값 없음. 단, edge 인자가 마크업에 끼워지므로
   *   아래 "Bokja edge 인자" 점검으로 호출부가 고정 색상 리터럴만 넘기는지 함께 지킨다.
   * (주석 줄은 검사하지 않는다 — bokja-svg.ts:26은 설명 주석이다)
   */
  const HTML_ALLOW: { file: string; line: RegExp }[] = [
    { file: "src/app/free/bokja.tsx", line: /dangerouslySetInnerHTML=\{\{ __html: bokjaInner\(edge\) \}\}/ },
  ]

  it("dangerouslySetInnerHTML / innerHTML 사용처는 모두 sanitizeBoldHtml을 거친다(허용 목록 제외)", () => {
    const bad: string[] = []
    for (const f of files) {
      const lines = readFileSync(f, "utf8").split("\n")
      lines.forEach((line, i) => {
        if (/^\s*(\/\/|\*|\/\*\*)/.test(line)) return // 주석
        if (/dangerouslySetInnerHTML|\.innerHTML\s*=|outerHTML\s*=|insertAdjacentHTML/.test(line) && !/sanitizeBoldHtml\(/.test(line)) {
          if (HTML_ALLOW.some((a) => a.file === rel(f) && a.line.test(line))) return
          bad.push(`${rel(f)}:${i + 1}`)
        }
      })
    }
    expect(bad).toEqual([])
  })

  it("허용 목록 조건: bokjaInner는 고정 SVG(스크립트·이벤트·링크 없음), <Bokja>·bokjaInner 호출부는 edge에 고정 색상만 넘긴다", async () => {
    const { bokjaInner } = await import("@/app/free/bokja-svg")
    const svg = bokjaInner()
    expect(svg).not.toMatch(/<script|<foreignObject|\son[a-z]+\s*=|href|javascript:|<use|<image/i)
    expect(bokjaInner()).toBe(svg) // 같은 입력 → 같은 문자열(외부 상태 없음)
    const bad: string[] = []
    for (const f of files) {
      const s = readFileSync(f, "utf8")
      for (const m of s.matchAll(/<Bokja\b[^>]*>/g)) {
        const edge = /edge=(\{[^}]*\}|"[^"]*")/.exec(m[0])
        if (edge && !/^(\{"#[0-9a-fA-F]{3,8}"\}|"#[0-9a-fA-F]{3,8}")$/.test(edge[1])) bad.push(`${rel(f)}: ${m[0]}`)
      }
      if (rel(f) !== "src/app/free/bokja.tsx" && rel(f) !== "src/app/free/bokja-svg.ts") {
        for (const m of s.matchAll(/bokjaInner\(([^)]*)\)/g)) {
          if (m[1].trim() !== "" && !/^"#[0-9a-fA-F]{3,8}"$/.test(m[1].trim())) bad.push(`${rel(f)}: bokjaInner(${m[1]})`)
        }
      }
    }
    expect(bad).toEqual([])
  })

  it("react-markdown에 원시 HTML 허용 플러그인(rehype-raw)·skipHtml=false 없음", () => {
    const hits = files.filter((f) => /rehype-raw|rehypeRaw|allowDangerousHtml/.test(readFileSync(f, "utf8"))).map(rel)
    expect(hits).toEqual([])
  })

  /**
   * 로그인 없는 공개 API 허용 목록(품질검증 판정 2026-11-27). 조건을 아래 테스트가 강제한다:
   * DB(prisma)·세션·auth·AI(Anthropic) 접근 없음, IP 요청 제한(checkRateLimit)·본문 크기 제한(readJsonBody 2번째 인자) 사용.
   */
  const PUBLIC_API = ["src/app/api/free/route.ts"]

  it("API 라우트(auth·공개 API 제외)는 로그인 판별에 getSessionUser만 쓴다 (auth() 직접 호출·session.user.id 직접 사용 없음)", () => {
    const api = files.filter((f) => rel(f).startsWith("src/app/api/") && /route\.ts$/.test(f) && !rel(f).includes("[...nextauth]"))
    expect(api.length).toBeGreaterThanOrEqual(7)
    const bad: string[] = []
    for (const f of api) {
      const s = readFileSync(f, "utf8")
      if (/from "@\/lib\/auth"/.test(s) || /session\.user\.id/.test(s)) bad.push(`${rel(f)}: auth 직접 사용`)
      if (PUBLIC_API.includes(rel(f))) continue
      if (!/getSessionUser\(/.test(s)) bad.push(`${rel(f)}: getSessionUser 미사용`)
    }
    expect(bad).toEqual([])
  })

  it("공개 API 허용 조건: DB·세션·AI 접근 없음, 요청 제한·본문 크기 제한 있음(하위 _lib 포함)", () => {
    for (const p of PUBLIC_API) {
      const dir = join(ROOT, p, "..")
      const srcs = walk(dir).map((f) => readFileSync(f, "utf8")).join("\n")
      expect(srcs, p).not.toMatch(/@\/lib\/prisma|@prisma\/client|@\/lib\/session-user|@\/lib\/auth|next-auth|@anthropic-ai|generate-reading|cookies\(\)/)
      const route = readFileSync(join(ROOT, p), "utf8")
      expect(route, p).toMatch(/checkRateLimit\(/)
      expect(route, p).toMatch(/readJsonBody\(req, [A-Z_]+\)/)
    }
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
