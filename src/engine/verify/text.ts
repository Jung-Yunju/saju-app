// 풀이 JSON → 검사용 텍스트 조각 수집, 문장 나누기, 발췌 (P4-04)
import type { FindingLocation, ReadingLike, TextSegment } from "./types"

/** 고객에게 보이지 않거나 값이 정해진 칸 — 훑지 않는다 */
const SKIP_KEYS = new Set(["id", "element", "key", "is_hour_test"])
/** 바넘(근거 없는 문장) 비율을 보는 서술 칸 */
const NARRATIVE_FIELDS = new Set(["body", "text", "claim"])
/** 간지만 적는 칸 */
const LETTER_FIELDS = new Set(["letter", "ganzhi"])

const YEAR_RE = /(1[89]\d{2}|20\d{2}|2100)/g

export function yearsInText(s: string): number[] {
  const out: number[] = []
  for (const m of s.matchAll(YEAR_RE)) {
    const y = Number(m[1])
    if (y >= 1900 && y <= 2100) out.push(y)
  }
  return out
}

export function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "")
}

function contextYearsOf(obj: Record<string, unknown>): number[] {
  const ys: number[] = []
  const pushNum = (v: unknown) => {
    if (typeof v === "number" && Number.isInteger(v) && v >= 1900 && v <= 2100) ys.push(v)
  }
  pushNum(obj.year)
  pushNum(obj.next)
  if (Array.isArray(obj.years)) obj.years.forEach(pushNum)
  for (const k of ["when", "after"]) if (typeof obj[k] === "string") ys.push(...yearsInText(obj[k] as string))
  return [...new Set(ys)]
}

interface WalkInfo {
  part?: number
  chapter?: number
  chapterKey?: string
  chapterTitle?: string
}

/** 풀이 객체의 모든 문자열 칸을 JSON 경로와 함께 모은다(순서 = 객체 키 순서, 결정론적) */
export function collectSegments(reading: ReadingLike): TextSegment[] {
  const out: TextSegment[] = []
  const walk = (node: unknown, path: string, field: string, info: WalkInfo, ctxYears: number[], paragraph?: number) => {
    if (typeof node === "string") {
      if (node.trim() === "") return
      const location: FindingLocation = { path, field, ...info }
      if (paragraph !== undefined) location.paragraph = paragraph
      out.push({
        path,
        field,
        raw: node,
        text: stripTags(node),
        location,
        contextYears: ctxYears,
        narrative: NARRATIVE_FIELDS.has(field),
        letterField: LETTER_FIELDS.has(field),
      })
      return
    }
    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${path}[${i}]`, field, info, ctxYears, field === "body" ? i : paragraph))
      return
    }
    if (node && typeof node === "object") {
      const obj = node as Record<string, unknown>
      const years = [...new Set([...ctxYears, ...contextYearsOf(obj)])]
      for (const [k, v] of Object.entries(obj)) {
        if (SKIP_KEYS.has(k)) continue
        const p = path ? `${path}.${k}` : k
        let next = info
        // parts[i].chapters[j] 진입 시 장 정보 기록
        if (k === "chapters" && Array.isArray(v)) {
          v.forEach((ch, j) => {
            const c = (ch && typeof ch === "object" ? ch : {}) as Record<string, unknown>
            walk(ch, `${p}[${j}]`, k, {
              ...info,
              chapter: j,
              chapterKey: typeof c.key === "string" ? c.key : undefined,
              chapterTitle: typeof c.title === "string" ? c.title : undefined,
            }, years)
          })
          continue
        }
        if (k === "parts" && Array.isArray(v)) {
          v.forEach((pt, i) => walk(pt, `${p}[${i}]`, k, { part: i }, years))
          continue
        }
        next = info
        walk(v, p, k, next, years)
      }
    }
  }
  walk(reading, "", "", {}, [])
  // 장 정보가 undefined인 키는 지운다(보고서를 깔끔하게)
  for (const s of out) for (const k of Object.keys(s.location) as (keyof FindingLocation)[]) if (s.location[k] === undefined) delete s.location[k]
  return out
}

/** 문장 나누기: . ! ? 。 … 뒤에 공백·줄바꿈·끝이 오면 끊는다. 숫자 소수점(2.5)은 끊지 않는다 */
export function splitSentences(text: string): { text: string; start: number }[] {
  const out: { text: string; start: number }[] = []
  let start = 0
  const push = (end: number) => {
    const raw = text.slice(start, end)
    const lead = raw.length - raw.trimStart().length
    const t = raw.trim()
    if (t) out.push({ text: t, start: start + lead })
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === "\n") {
      push(i)
      start = i + 1
      continue
    }
    if (".!?。…".includes(c)) {
      const nx = text[i + 1]
      if (nx === undefined || /\s/.test(nx)) {
        push(i + 1)
        start = i + 1
      }
    }
  }
  push(text.length)
  return out
}

/** 위치 index 주변 최대 40자 발췌 */
export function excerptAt(text: string, index: number, length = 0, max = 40): string {
  const chars = [...text]
  // index는 UTF-16 기준이지만 한글·한자는 모두 BMP라 같은 값
  const center = index + Math.floor(length / 2)
  let from = Math.max(0, center - Math.floor(max / 2))
  const to = Math.min(chars.length, from + max)
  from = Math.max(0, to - max)
  return chars.slice(from, to).join("")
}

/** 문장 전체 발췌(40자 넘으면 자름) */
export function excerptOf(s: string, max = 40): string {
  const chars = [...s]
  return chars.length <= max ? s : chars.slice(0, max - 1).join("") + "…"
}
