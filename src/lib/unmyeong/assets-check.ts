// 자산 목록 파일 점검(서버·테스트·스크립트 전용 — fs 사용). 화면 코드에서 가져오지 않는다.
// 판정: 파일이 public/ 아래 있으면 ok. 없어도 fallback(데이터 URI 또는 public/ 아래 있는 파일)이 있으면 ok(missing으로 표시).
import fs from "node:fs"
import path from "node:path"
import { listImageAssets, listVideoFiles, UNMYEONG_ASSETS, type UnmyeongAssets } from "./assets"

export interface AssetCheck {
  key: string
  src: string
  /** public/ 아래 파일이 있는가 */
  exists: boolean
  /** 파일이 없을 때 대신 그릴 수 있는가 */
  fallbackOk: boolean
  /** exists || fallbackOk */
  ok: boolean
  /** 경로 형식 문제(외부 주소, ../, /unmyeong/ 밖 등) — 있으면 ok=false */
  problem?: string
}

/** URL("/unmyeong/…") → public 안의 실제 경로. 형식이 틀리면 null */
function toPublicPath(src: string, publicDir: string): string | null {
  if (!src.startsWith("/unmyeong/")) return null
  if (src.includes("..") || src.includes("\\") || /[?#]/.test(src)) return null
  return path.join(publicDir, ...src.split("/").filter(Boolean))
}

function fileExists(p: string | null): boolean {
  if (!p) return false
  try {
    return fs.statSync(p).isFile()
  } catch {
    return false
  }
}

function fallbackUsable(fallback: string | undefined, publicDir: string): boolean {
  if (!fallback) return false
  if (fallback.startsWith("data:image/")) return true
  return fileExists(toPublicPath(fallback, publicDir))
}

/** 목록의 모든 그림·영상 경로 점검. 영상은 대체가 "scene"(대체 장면)이라 파일이 없어도 ok */
export function checkAssetFiles(m: UnmyeongAssets = UNMYEONG_ASSETS, publicDir = path.join(process.cwd(), "public")): AssetCheck[] {
  const out: AssetCheck[] = []
  for (const { key, asset } of listImageAssets(m)) {
    const p = toPublicPath(asset.src, publicDir)
    const exists = fileExists(p)
    const fallbackOk = fallbackUsable(asset.fallback, publicDir)
    const folderOk = asset.isPlaceholder ? asset.src.startsWith("/unmyeong/placeholder/") : asset.src.startsWith("/unmyeong/final/")
    const problem = !p ? "경로는 /unmyeong/ 아래 고정 경로여야 함(.. · 외부 주소 · ?# 금지)" : !folderOk ? "isPlaceholder와 폴더(placeholder/·final/)가 맞지 않음" : undefined
    out.push({ key, src: asset.src, exists, fallbackOk, ok: !problem && (exists || fallbackOk), ...(problem ? { problem } : {}) })
  }
  for (const { key, src } of listVideoFiles(m)) {
    const p = toPublicPath(src, publicDir)
    const exists = fileExists(p)
    const fallbackOk = m.intro.fallback === "scene"
    out.push({ key, src, exists, fallbackOk, ok: !!p && (exists || fallbackOk), ...(p ? {} : { problem: "경로는 /unmyeong/ 아래여야 함" }) })
  }
  return out
}

/** 요약: 깨지는 항목(ok=false)과 아직 파일이 없는 항목(대체로 그려짐) */
export function summarizeAssetCheck(checks: AssetCheck[]): { broken: AssetCheck[]; missing: AssetCheck[]; total: number } {
  return { broken: checks.filter((c) => !c.ok), missing: checks.filter((c) => c.ok && !c.exists), total: checks.length }
}
