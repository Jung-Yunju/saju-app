// 무료 5장 문안 읽기·고르기(서버 전용 — fs 사용). 원본: content/unmyeong/free-copy.json (콘텐츠 작가 소유, 이 파일은 읽기만 한다)
// 지금은 파일이 없다 → chapters = null, 응답 pending.chapters = true. 화면은 "준비 중"으로 그린다.
//
// 임시 형식(작가 납품 때 형식이 정해지면 이 파일의 normalize·select만 고친다 — 응답 형식 UnmyeongFreeChapter는 그대로):
//   { "version": 1,
//     "chapters": [ { "no": 1, "key": "being", "title": "…", "byArchetype": { "<원형 id>": "본문" }, "default": "본문(원형 무관)" }, … 5개 ] }
// 고르기: 원형이 정해지면 byArchetype[id], 없으면 default. 다섯 장 중 하나라도 고를 본문이 없으면 전체 null(반쪽 결과를 내지 않는다).
// 파일이 깨졌거나 형식이 다르면 파일 이름만 경고로 남기고 null.
import fs from "node:fs"
import path from "node:path"
import { FREE_CHAPTER_KEYS, type FreeChapterKey } from "./assets"
import type { UnmyeongArchetypeView, UnmyeongFreeChapter } from "./free-types"

export const FREE_COPY_FILE = "free-copy.json"
const TEXT_MAX = 2000

interface NormalizedChapter {
  no: number
  key: FreeChapterKey
  title: string
  byArchetype: Record<string, string>
  default: string | null
}

let cached: { value: unknown } | null = null

/** content/unmyeong/free-copy.json 원본. 없으면 null. 운영에서는 한 번만 읽는다 */
export function loadFreeCopy(dir = path.join(process.cwd(), "content", "unmyeong")): unknown {
  if (cached && process.env.NODE_ENV === "production") return cached.value
  let value: unknown = null
  try {
    value = JSON.parse(fs.readFileSync(path.join(dir, FREE_COPY_FILE), "utf8")) as unknown
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") console.warn(`[unmyeong-free-copy] ${FREE_COPY_FILE} 읽기 실패`)
    value = null
  }
  if (process.env.NODE_ENV === "production") cached = { value }
  return value
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v)
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() && v.length <= TEXT_MAX ? v.trim() : null)

function normalize(raw: unknown): NormalizedChapter[] | null {
  if (!isObj(raw) || !Array.isArray(raw.chapters)) return null
  const out: NormalizedChapter[] = []
  for (const c of raw.chapters) {
    if (!isObj(c)) return null
    const key = FREE_CHAPTER_KEYS.find((k) => k === c.key)
    const no = typeof c.no === "number" ? c.no : null
    const title = str(c.title)
    if (!key || no === null || no !== FREE_CHAPTER_KEYS.indexOf(key) + 1 || !title) return null
    const by: Record<string, string> = {}
    if (isObj(c.byArchetype)) for (const [id, t] of Object.entries(c.byArchetype)) { const s = str(t); if (s) by[id] = s }
    out.push({ no, key, title, byArchetype: by, default: str(c.default) })
  }
  if (out.length !== FREE_CHAPTER_KEYS.length || new Set(out.map((c) => c.key)).size !== out.length) return null
  return out.sort((a, b) => a.no - b.no)
}

/** 문안 + 원형 → 5장. 고를 수 없으면 null */
export function selectFreeChapters(raw: unknown, archetype: UnmyeongArchetypeView | null): UnmyeongFreeChapter[] | null {
  if (raw === null || raw === undefined) return null
  const chapters = normalize(raw)
  if (!chapters) {
    console.warn(`[unmyeong-free-copy] ${FREE_COPY_FILE} 형식이 달라 쓰지 않음`)
    return null
  }
  const picked: UnmyeongFreeChapter[] = []
  for (const c of chapters) {
    const text = (archetype ? c.byArchetype[archetype.id] : undefined) ?? c.default
    if (!text) return null
    picked.push({ no: c.no, key: c.key, title: c.title, text })
  }
  return picked
}
