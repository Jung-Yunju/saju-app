import { describe, expect, it } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  ARCHETYPE_IDS, FALLBACK_IMAGE, FREE_CHAPTER_KEYS, UNMYEONG_ASSETS, archetypeAssets, hasPlaceholders, illustrationFor, img,
  listImageAssets, listVideoFiles, type UnmyeongAssets,
} from "@/lib/unmyeong/assets"
import { checkAssetFiles, summarizeAssetCheck } from "@/lib/unmyeong/assets-check"

describe("운명비서 자산 목록", () => {
  it("목록의 모든 경로는 public/ 아래 있거나 대체 그림이 있다(깨지는 항목 0)", () => {
    const checks = checkAssetFiles()
    const { broken, missing, total } = summarizeAssetCheck(checks)
    expect(total).toBeGreaterThan(10)
    expect(broken).toEqual([])
    // 아직 파일이 없는 항목은 대체 그림으로 그려진다 — 개수만 확인(디자인 실장 납품 전에는 0보다 클 수 있음)
    for (const m of missing) expect(m.fallbackOk).toBe(true)
  })

  it("필수 칸이 계약대로 있다", () => {
    expect(UNMYEONG_ASSETS.intro.fallback).toBe("scene")
    expect(UNMYEONG_ASSETS.intro.video).toBeNull()
    for (const k of ["grandma", "study", "bookCover", "paperTexture"] as const) expect(UNMYEONG_ASSETS[k].src).toMatch(/^\/unmyeong\//)
    expect(UNMYEONG_ASSETS.bokja.sleep.src).toContain("bokja-sleep-placeholder.svg")
    expect(UNMYEONG_ASSETS.bokja.loaf.src).toContain("bokja-loaf-placeholder.svg")
    expect(Object.keys(UNMYEONG_ASSETS.archetypes).sort()).toEqual([...ARCHETYPE_IDS].sort())
    for (const id of ARCHETYPE_IDS) {
      const a = UNMYEONG_ASSETS.archetypes[id]
      expect(a.human.src).toBeTruthy()
      expect(a.beast.src).toBeTruthy()
      expect(a.alt).toBeTruthy()
    }
    for (const k of FREE_CHAPTER_KEYS) expect(UNMYEONG_ASSETS.illustrations[k]).toBeDefined()
    for (let n = 1; n <= 5; n++) expect(UNMYEONG_ASSETS.illustrations[`volume-${n}`]).toBeDefined()
  })

  it("지금은 전부 임시 그림이고 isPlaceholder가 폴더와 맞는다", () => {
    for (const { asset } of listImageAssets()) {
      expect(asset.isPlaceholder).toBe(true)
      expect(asset.src).toMatch(/^\/unmyeong\/placeholder\/[a-z0-9-]+-placeholder\.svg$/)
      expect(asset.fallback).toBe(FALLBACK_IMAGE)
    }
    expect(hasPlaceholders()).toBe(true)
    expect(img("final/study.webp", "서재").isPlaceholder).toBe(false)
  })

  it("대체 그림은 외부 요청 없는 데이터 URI SVG", () => {
    expect(FALLBACK_IMAGE.startsWith("data:image/svg+xml")).toBe(true)
    expect(decodeURIComponent(FALLBACK_IMAGE)).not.toMatch(/https?:\/\/(?!www\.w3\.org\/2000\/svg)/)
  })

  it("모르는 원형 id·장 키도 깨지지 않는다", () => {
    expect(archetypeAssets("unknown-id").human.src).toMatch(/^\/unmyeong\//)
    expect(archetypeAssets(null).beast.fallback).toBe(FALLBACK_IMAGE)
    expect(illustrationFor("nope")).toBe(UNMYEONG_ASSETS.study)
  })

  it("검사 함수: 있는 파일은 exists, 없는 파일은 대체로 ok, 잘못된 경로·폴더 불일치는 broken", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "um-assets-"))
    fs.mkdirSync(path.join(dir, "unmyeong", "final"), { recursive: true })
    fs.writeFileSync(path.join(dir, "unmyeong", "final", "study.webp"), "x")
    const m: UnmyeongAssets = {
      ...UNMYEONG_ASSETS,
      study: img("final/study.webp", "서재"),
      grandma: { ...img("final/grandma.webp", "할머니"), fallback: "" },
      bookCover: { ...img("placeholder/book-cover-placeholder.svg", "표지"), src: "https://example.com/a.png" },
      paperTexture: { ...img("final/paper.webp", ""), isPlaceholder: true },
      intro: { fallback: "scene", video: { mp4: "/unmyeong/final/intro.mp4", poster: "/unmyeong/final/p.webp", durationSec: 10, isPlaceholder: false, vertical: { mp4: "/unmyeong/final/v.mp4", poster: "/unmyeong/final/vp.webp" } } },
    }
    const byKey = Object.fromEntries(checkAssetFiles(m, dir).map((c) => [c.key, c]))
    expect(byKey.study).toMatchObject({ exists: true, ok: true })
    expect(byKey["bokja.sleep"]).toMatchObject({ exists: false, fallbackOk: true, ok: true })
    expect(byKey.grandma).toMatchObject({ exists: false, fallbackOk: false, ok: false })
    expect(byKey.bookCover.ok).toBe(false)
    expect(byKey.bookCover.problem).toBeTruthy()
    expect(byKey.paperTexture.ok).toBe(false)
    expect(listVideoFiles(m).map((v) => v.key)).toEqual(["intro.video.mp4", "intro.video.poster", "intro.video.vertical.mp4", "intro.video.vertical.poster"])
    // 영상은 파일이 없어도 대체 장면으로 ok
    expect(byKey["intro.video.mp4"]).toMatchObject({ exists: false, ok: true })
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
