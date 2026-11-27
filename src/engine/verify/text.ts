// 풀이 JSON → 검사용 텍스트 조각 수집, 문장 나누기, 발췌 (P4-04)
import type { FindingLocation, ReadingLike, TextSegment } from "./types"

/**
 * 훑지 않는 칸. 화면에 나가는 칸은 전부 검사한다(독립 검토: years[].element가 화면에 그대로 나감).
 * is_hour_test는 불리언이라 애초에 문자열이 아니다. 비워 둔 집합은 일부러 남겨 둔다(추가 시 근거를 적을 것).
 */
const SKIP_KEYS = new Set<string>()
/** 바넘(근거 없는 문장) 비율을 보는 서술 칸 */
const NARRATIVE_FIELDS = new Set(["body", "text", "claim"])
/** 간지만 적는 칸 */
const LETTER_FIELDS = new Set(["letter", "ganzhi"])

/** 폭 없는 문자·소프트 하이픈 — 낱말 사이에 끼워 검사를 피하는 수법 방지 */
const INVISIBLE_RE = /[\u00AD\u180E\u200B-\u200F\u2028\u2029\u202A-\u202E\u2060-\u2064\uFEFF]/g

/** 화면에 보이는 글 정규화: 폭 없는 문자 제거 */
export function stripInvisible(s: string): string {
  return s.replace(INVISIBLE_RE, "")
}

/**
 * 검사용 정규화.
 * - NFKC: 강희 부수(⾟→辛)·호환 한자·전각 문자(％→%, 전각 공백→공백, ＂→")를 표준 글자로
 * - 폭 없는 문자 제거
 * - 문장부호 없이 끼운 줄바꿈 하나는 공백으로(낱말·문장을 줄바꿈으로 쪼개는 우회 방지). 빈 줄·문장부호 뒤 줄바꿈은 문장 경계로 남긴다
 */
export function normalizeText(s: string): string {
  return stripInvisible(s.normalize("NFKC"))
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/([^\n.!?。…])\n(?!\n)/g, "$1 ")
    .replace(/[ \t]{2,}/g, " ")
}

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

interface Frame {
  node: unknown
  path: string
  field: string
  info: WalkInfo
  years: number[]
  paragraph?: number
  ctxText: string
}

/**
 * 풀이 객체의 모든 문자열 칸을 JSON 경로와 함께 모은다(순서 = 객체 키 순서, 결정론적).
 * 재귀 대신 명시적 스택을 써서 아주 깊은 객체에서도 스택이 넘치지 않는다.
 */
export function collectSegments(reading: ReadingLike): TextSegment[] {
  const out: TextSegment[] = []
  const stack: Frame[] = [{ node: reading, path: "", field: "", info: {}, years: [], ctxText: "" }]
  while (stack.length) {
    const f = stack.pop()!
    const { node, path, field, info, years: ctxYears, paragraph, ctxText } = f
    if (typeof node === "string") {
      const raw = stripInvisible(node)
      if (raw.trim() === "") continue
      const location: FindingLocation = { path, field, ...info }
      if (paragraph !== undefined) location.paragraph = paragraph
      out.push({
        path,
        field,
        raw,
        text: stripTags(normalizeText(node)),
        location,
        contextYears: ctxYears,
        contextText: ctxText,
        narrative: NARRATIVE_FIELDS.has(field),
        letterField: LETTER_FIELDS.has(field),
      })
      continue
    }
    const children: Frame[] = []
    if (Array.isArray(node)) {
      node.forEach((v, i) =>
        children.push({ node: v, path: `${path}[${i}]`, field, info, years: ctxYears, paragraph: field === "body" ? i : paragraph, ctxText }),
      )
    } else if (node && typeof node === "object") {
      const obj = node as Record<string, unknown>
      const years = [...new Set([...ctxYears, ...contextYearsOf(obj)])]
      // 최상위(풀이 전체)는 문맥에 넣지 않는다 — 넣으면 모든 칸이 서로의 문맥이 되어 검사가 무뎌진다
      const shallow = path === "" ? "" : Object.entries(obj).filter(([k, v]) => typeof v === "string" && !SKIP_KEYS.has(k)).map(([, v]) => normalizeText(v as string)).join(" ")
      const ctx = shallow ? (ctxText ? ctxText + " " + shallow : shallow) : ctxText
      for (const [k, v] of Object.entries(obj)) {
        if (SKIP_KEYS.has(k)) continue
        const p = path ? `${path}.${k}` : k
        // parts[i].chapters[j] 진입 시 장 정보 기록
        if (k === "chapters" && Array.isArray(v)) {
          v.forEach((ch, j) => {
            const c = (ch && typeof ch === "object" ? ch : {}) as Record<string, unknown>
            children.push({
              node: ch,
              path: `${p}[${j}]`,
              field: k,
              info: { ...info, chapter: j, chapterKey: typeof c.key === "string" ? c.key : undefined, chapterTitle: typeof c.title === "string" ? c.title : undefined },
              years,
              ctxText: ctx,
            })
          })
          continue
        }
        if (k === "parts" && Array.isArray(v)) {
          v.forEach((pt, i) => children.push({ node: pt, path: `${p}[${i}]`, field: k, info: { part: i }, years, ctxText: ctx }))
          continue
        }
        children.push({ node: v, path: p, field: k, info, years, ctxText: ctx })
      }
    }
    for (let i = children.length - 1; i >= 0; i--) stack.push(children[i])
  }
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
