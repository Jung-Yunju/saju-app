// AI 출력 HTML 소독 — 화면에서 dangerouslySetInnerHTML로 넣기 전에 반드시 거친다.
// 규칙: 모든 글자를 먼저 HTML 이스케이프한 뒤, 굵게 표시 태그 <b>, </b>만 되살린다.
// 속성이 붙은 태그(<b onclick=...>)나 다른 태그는 글자 그대로 보이게 된다.
// 짝이 맞지 않는 </b>는 버리고, 닫히지 않은 <b>는 끝에서 닫아 준다.

const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, ch => ESCAPE_MAP[ch])
}

export function sanitizeBoldHtml(input: unknown): string {
  if (typeof input !== "string" || input.length === 0) return ""
  const escaped = escapeHtml(input)

  let depth = 0
  const restored = escaped.replace(/&lt;(\/?)b&gt;/gi, (_m, slash: string) => {
    if (slash) {
      if (depth === 0) return "" // 짝 없는 닫는 태그는 버림
      depth -= 1
      return "</b>"
    }
    depth += 1
    return "<b>"
  })
  return restored + "</b>".repeat(depth)
}
