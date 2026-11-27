// 9. UNSAFE_HTML — 허용 태그는 본문(body)의 <b>, </b>뿐(속성 없음)
// 화면은 body만 sanitizeBoldHtml로 넣고 나머지 칸은 글자 그대로 보인다(src/app/reading/[id]/ReadingViewer.tsx).
//   block : 위험 태그·속성(script, iframe, img, svg, object, embed, style, link, meta, form, a, on*=, javascript:, data:text/html)
//           속성이 붙은 <b ...>
//   warn  : 그 밖의 태그(<br>, <i>, <strong>, <p> 등 — 화면에 글자 그대로 보임), body가 아닌 칸의 <b>
//   info  : 짝이 맞지 않는 <b> (화면은 자동으로 닫음)
import type { Finding, TextSegment } from "../types"
import { excerptAt } from "../text"

const TAG_RE = /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9-]*)?([^>]*)>/g
const DANGEROUS_TAGS = new Set(["script", "iframe", "img", "svg", "object", "embed", "style", "link", "meta", "form", "a", "input", "button", "video", "audio", "math", "base", "frame", "frameset", "textarea", "select"])
const DANGEROUS_TEXT_RE = /(javascript\s*:|vbscript\s*:|data\s*:\s*text\/html|\bon[a-z]+\s*=|&#x?0*(3c|60);?)/i

export function checkHtml(segments: TextSegment[]): Finding[] {
  const out: Finding[] = []
  for (const seg of segments) {
    const raw = seg.raw
    let depth = 0
    let unbalanced = false
    for (const m of raw.matchAll(TAG_RE)) {
      const closing = m[1] === "/"
      const name = (m[2] ?? "").toLowerCase()
      const attrs = (m[3] ?? "").trim()
      const idx = m.index ?? 0
      if (name === "b" && !attrs) {
        if (seg.field !== "body") {
          out.push({ severity: "warn", code: "UNSAFE_HTML", location: seg.location, excerpt: excerptAt(raw, idx, m[0].length), rule: "bold-outside-body", message: "body가 아닌 칸의 <b>는 화면에 글자 그대로 보임" })
          continue
        }
        if (closing) {
          if (depth === 0) unbalanced = true
          else depth--
        } else depth++
        continue
      }
      const dangerous = DANGEROUS_TAGS.has(name) || DANGEROUS_TEXT_RE.test(m[0]) || name === "b"
      out.push({
        severity: dangerous ? "block" : "warn",
        code: "UNSAFE_HTML",
        location: seg.location,
        excerpt: excerptAt(raw, idx, m[0].length),
        rule: dangerous ? "dangerous-tag" : "other-tag",
        message: dangerous ? `허용되지 않은 태그·속성 ${m[0].slice(0, 30)}` : `<b> 외 태그 ${m[0].slice(0, 20)} — 화면에 글자 그대로 보임`,
      })
    }
    // 태그 밖 위험 문자열(이스케이프 우회 시도 등)
    const textOnly = raw.replace(TAG_RE, "")
    const dm = DANGEROUS_TEXT_RE.exec(textOnly)
    if (dm)
      out.push({ severity: "block", code: "UNSAFE_HTML", location: seg.location, excerpt: excerptAt(textOnly, dm.index, dm[0].length), rule: "dangerous-text", message: `스크립트 실행용 문자열 ${dm[0]}` })
    if (depth > 0 || unbalanced)
      out.push({ severity: "info", code: "UNSAFE_HTML", location: seg.location, excerpt: excerptAt(raw, 0, 0), rule: "unbalanced-bold", message: "<b> 짝이 맞지 않음(화면은 자동 보정)" })
  }
  return out
}
