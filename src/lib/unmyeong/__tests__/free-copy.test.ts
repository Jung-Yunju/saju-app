// 납품 문안 content/unmyeong/free-copy.json 이 현재 키·원형 목록·고르기 규칙과 맞는지(파일 내용은 작가 소유 — 여기서는 읽기만)
import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { ARCHETYPE_IDS, FREE_CHAPTER_KEYS, UNMYEONG_ASSETS } from "@/lib/unmyeong/assets"
import { BRIDGE_WORD, bridgeOf, loadFreeCopy, selectFreeChapters } from "@/lib/unmyeong/free-copy"
import type { UnmyeongArchetypeView } from "@/lib/unmyeong/free-types"

const DIR = path.join(process.cwd(), "content", "unmyeong")
const raw = loadFreeCopy(DIR) as {
  version: number
  hourNote: { chapter: number; text: string }
  bridgeFallback: { replace: string; with: string }
  chapters: { no: number; key: string; title: string; byArchetype: Record<string, string>; default: string | null }[]
} | null

const view = (id: string, over: Partial<UnmyeongArchetypeView> = {}): UnmyeongArchetypeView => ({
  id, name: id, category: "nature", order: 1, secondary: null, secondaryName: null, variantTags: [], matched: [],
  stability: { nearBoundary: false, tableSensitive: false, hourSensitive: null }, hourUnknownNote: false,
  disclaimer: "creative-symbol", disclaimerText: "창작 상징", version: "archetype@0.1.0", ...over,
})
const len = (s: string) => [...s].length

describe("무료 5장 키", () => {
  it("대표 지시서 7절 순서", () => {
    expect([...FREE_CHAPTER_KEYS]).toEqual(["being", "symbol", "gift", "shadow", "counsel"])
    for (const k of FREE_CHAPTER_KEYS) expect(UNMYEONG_ASSETS.illustrations[k]?.alt).toBeTruthy()
    for (const old of ["reason", "chart", "unfolding"]) expect(UNMYEONG_ASSETS.illustrations[old]).toBeUndefined()
  })
  it("다리 기운: bridge 필드 우선, 없으면 변형 표지", () => {
    expect(bridgeOf(null)).toBeNull()
    expect(bridgeOf(view("moon-goddess", { variantTags: ["토↔수·금으로 이음"] }))).toBe("쇠")
    expect(bridgeOf(view("moon-goddess", { variantTags: ["화↔금·토로 이음"] }))).toBe("흙")
    expect(bridgeOf(view("moon-goddess", { bridge: "화", variantTags: ["화↔금·토로 이음"] }))).toBe("불")
    expect(bridgeOf(view("moon-goddess"))).toBeNull()
    expect(Object.values(BRIDGE_WORD).sort()).toEqual(["나무", "물", "불", "쇠", "흙"].sort())
  })
})

describe.skipIf(!fs.existsSync(path.join(DIR, "free-copy.json")))("납품 문안 free-copy.json", () => {
  it("version 2 · 다섯 장 키 순서 · default 없음 · 원형 id가 ARCHETYPE_IDS와 전부 같다", () => {
    expect(raw?.version).toBe(2)
    expect(raw!.chapters.map((c) => [c.no, c.key])).toEqual(FREE_CHAPTER_KEYS.map((k, i) => [i + 1, k]))
    for (const c of raw!.chapters) {
      expect(c.default).toBeNull()
      expect(Object.keys(c.byArchetype).sort(), c.key).toEqual([...ARCHETYPE_IDS].sort())
    }
  })

  it("원형이 없으면 준비 중(null)", () => {
    expect(selectFreeChapters(raw, null)).toBeNull()
    expect(selectFreeChapters(raw, null, { hourUnknown: true })).toBeNull()
  })

  it("원형 12개 모두 다섯 장이 나오고, 날 토큰·호칭 토큰이 없고, 다섯 장 합이 400~600자(시각 안내 포함)", () => {
    const variants: UnmyeongArchetypeView[] = ARCHETYPE_IDS.flatMap((id) =>
      id === "moon-goddess" ? [view(id, { variantTags: ["수↔화·목으로 이음"] }), view(id)] : [view(id)],
    )
    for (const a of variants) {
      for (const hourUnknown of [false, true]) {
        const ch = selectFreeChapters(raw, a, { hourUnknown })
        expect(ch, a.id).not.toBeNull()
        expect(ch!.map((c) => c.key)).toEqual([...FREE_CHAPTER_KEYS])
        for (const c of ch!) expect(c.text, `${a.id}/${c.key}`).not.toMatch(/[{}]/)
        expect(ch![0].text.endsWith(raw!.hourNote.text)).toBe(hourUnknown)
        const total = ch!.reduce((n, c) => n + len(c.text), 0)
        expect(total, a.id).toBeGreaterThanOrEqual(400)
        expect(total, a.id).toBeLessThanOrEqual(600)
      }
    }
  })

  it("달의 여신 5장: 다리 기운이 있으면 끼우고, 없으면 대체 문장으로", () => {
    const withBridge = selectFreeChapters(raw, view("moon-goddess", { variantTags: ["금↔목·수로 이음"] }))!
    expect(withBridge[4].text).toContain(raw!.bridgeFallback.replace.replace("{bridge}", "물"))
    const without = selectFreeChapters(raw, view("moon-goddess"))!
    expect(without[4].text).toContain(raw!.bridgeFallback.with)
    expect(without[4].text).not.toContain("{bridge}")
  })
})
