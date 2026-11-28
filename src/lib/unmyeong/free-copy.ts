// 무료 5장 문안 읽기·고르기(서버 전용 — fs 사용). 원본: content/unmyeong/free-copy.json (콘텐츠 작가 소유, 이 파일은 읽기만 한다)
// 초안은 같은 폴더 free-copy.draft.json(읽지 않는다). 파일이 없거나 고를 본문이 없으면 chapters = null → 응답 pending.chapters = true("준비 중").
//
// 형식(version 2, 작가 초안과 같다 — 응답 형식 UnmyeongFreeChapter는 그대로):
//   { "version": 2,
//     "hourNote": { "chapter": 1, "text": "…" },
//     "bridgeFallback": { "replace": "…{bridge}…", "with": "…" },
//     "chapters": [ { "no": 1, "key": "being", "title": "…", "byArchetype": { "<원형 id>": "본문" }, "default": null }, … 5개 ] }
// 규칙:
//   - 장 순서 = FREE_CHAPTER_KEYS 순서. 다섯 키가 한 번씩, 각 장의 no는 그 키의 순서(1~5)와 같아야 한다(어긋나면 파일 전체를 쓰지 않음).
//   - 고르기: 원형이 정해지면 byArchetype[id], 없으면 default. default가 null이면 원형이 없을 때 다섯 장 전체 null.
//     다섯 장 중 하나라도 고를 본문이 없으면 전체 null(반쪽 결과를 내지 않는다).
//   - 호칭 토큰({name})은 쓰지 않는다(D-029 ②). {bridge} 말고 다른 {…} 토큰이 든 본문은 버린다(날 토큰을 화면에 내지 않는다).
//   - {bridge} = 원형의 다리 기운(통관 오행) → 물·나무·불·흙·쇠. 값이 없으면 bridgeFallback.replace 문장을 with 문장으로 통째로 바꾼다.
//     그래도 {bridge}가 남으면 그 본문은 고를 수 없다(→ 전체 null).
//   - hourNote: 시각 모름이면 hourNote.chapter장(기본 1장) 끝에 공백 하나 띄우고 붙인다.
//     초안 조건(hourSensitive 또는 alwaysHourNote)보다 D-030 "시각 모름 안내는 늘 표시"가 우선 → 시각 모름이면 항상.
// 파일이 깨졌거나 형식이 다르면 파일 이름만 경고로 남기고 null.
import fs from "node:fs"
import path from "node:path"
import { FREE_CHAPTER_KEYS, type FreeChapterKey } from "./assets"
import type { ElementKo, UnmyeongArchetypeView, UnmyeongFreeChapter } from "./free-types"

export const FREE_COPY_FILE = "free-copy.json"
const TEXT_MAX = 2000

/** 통관 오행 → 본문에 끼우는 말 */
export const BRIDGE_WORD: Readonly<Record<ElementKo, string>> = { 수: "물", 목: "나무", 화: "불", 토: "흙", 금: "쇠" }
const BRIDGE_TOKEN = "{bridge}"

interface NormalizedChapter {
  no: number
  key: FreeChapterKey
  title: string
  byArchetype: Record<string, string>
  default: string | null
}

interface NormalizedCopy {
  chapters: NormalizedChapter[]
  hourNote: { chapter: number; text: string } | null
  bridgeFallback: { replace: string; with: string } | null
}

export interface SelectFreeChaptersOptions {
  /** 태어난 시각을 모름(응답 hourUnknown) → hourNote를 붙인다(D-030) */
  hourUnknown?: boolean
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
/** 본문: {bridge} 말고 다른 토큰({name} 등)이 있으면 버린다 */
const body = (v: unknown): string | null => {
  const s = str(v)
  if (!s) return null
  return (s.match(/\{[^{}]*\}/g) ?? []).every((t) => t === BRIDGE_TOKEN) ? s : null
}

function normalize(raw: unknown): NormalizedCopy | null {
  if (!isObj(raw) || !Array.isArray(raw.chapters) || raw.chapters.length !== FREE_CHAPTER_KEYS.length) return null
  const chapters: NormalizedChapter[] = []
  for (const [i, key] of FREE_CHAPTER_KEYS.entries()) {
    // 장 번호 = 키 순서: 배열 i번째는 i번째 키, no는 i + 1
    const c: unknown = raw.chapters[i]
    if (!isObj(c) || c.key !== key || c.no !== i + 1) return null
    const title = str(c.title)
    if (!title) return null
    if (c.default !== undefined && c.default !== null && typeof c.default !== "string") return null
    const by: Record<string, string> = {}
    if (isObj(c.byArchetype)) for (const [id, t] of Object.entries(c.byArchetype)) { const s = body(t); if (s) by[id] = s }
    chapters.push({ no: i + 1, key, title, byArchetype: by, default: body(c.default) })
  }

  let hourNote: NormalizedCopy["hourNote"] = null
  if (raw.hourNote !== undefined && raw.hourNote !== null) {
    const h = raw.hourNote
    const text = isObj(h) ? body(h.text) : null
    const chapter = isObj(h) && h.chapter !== undefined ? h.chapter : 1
    if (!text || text.includes(BRIDGE_TOKEN) || typeof chapter !== "number" || !Number.isInteger(chapter) || chapter < 1 || chapter > chapters.length) return null
    hourNote = { chapter, text }
  }

  let bridgeFallback: NormalizedCopy["bridgeFallback"] = null
  if (raw.bridgeFallback !== undefined && raw.bridgeFallback !== null) {
    const b = raw.bridgeFallback
    const replace = isObj(b) ? str(b.replace) : null
    const withText = isObj(b) ? body(b.with) : null
    if (!replace || !replace.includes(BRIDGE_TOKEN) || !withText || withText.includes(BRIDGE_TOKEN)) return null
    bridgeFallback = { replace, with: withText }
  }
  return { chapters, hourNote, bridgeFallback }
}

/** 원형의 다리 기운 → "물"·"나무"·… 없으면 null. 우선 archetype.bridge, 없으면 variantTags "…·수로 이음"/"…·목으로 이음" */
export function bridgeOf(archetype: UnmyeongArchetypeView | null): string | null {
  if (!archetype) return null
  if (archetype.bridge) return BRIDGE_WORD[archetype.bridge] ?? null
  for (const tag of archetype.variantTags) {
    const m = /·\s*(수|목|화|토|금)\s*(?:으로|로)\s*이음/.exec(tag)
    if (m) return BRIDGE_WORD[m[1] as ElementKo]
  }
  return null
}

function fillBridge(text: string, bridge: string | null, fallback: NormalizedCopy["bridgeFallback"]): string | null {
  if (!text.includes(BRIDGE_TOKEN)) return text
  let out = text
  if (bridge) out = out.split(BRIDGE_TOKEN).join(bridge)
  else if (fallback) out = out.split(fallback.replace).join(fallback.with)
  return out.includes(BRIDGE_TOKEN) ? null : out
}

/** 문안 + 원형 → 5장. 고를 수 없으면 null */
export function selectFreeChapters(
  raw: unknown,
  archetype: UnmyeongArchetypeView | null,
  opts: SelectFreeChaptersOptions = {},
): UnmyeongFreeChapter[] | null {
  if (raw === null || raw === undefined) return null
  const copy = normalize(raw)
  if (!copy) {
    console.warn(`[unmyeong-free-copy] ${FREE_COPY_FILE} 형식이 달라 쓰지 않음`)
    return null
  }
  const bridge = bridgeOf(archetype)
  const picked: UnmyeongFreeChapter[] = []
  for (const c of copy.chapters) {
    const chosen = (archetype ? c.byArchetype[archetype.id] : undefined) ?? c.default
    let text = chosen ? fillBridge(chosen, bridge, copy.bridgeFallback) : null
    if (!text) return null
    // D-030: 시각 모름이면 원형·민감도와 관계없이 안내를 붙인다
    if (opts.hourUnknown && copy.hourNote && copy.hourNote.chapter === c.no) text = `${text} ${copy.hourNote.text}`
    picked.push({ no: c.no, key: c.key, title: c.title, text })
  }
  return picked
}
