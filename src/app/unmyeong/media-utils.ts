"use client"

// 영상 연동 공용 도구 — 비율 분기·cover 좌표 환산·효과음. 계산은 화면 배치뿐이고 사주 값은 만지지 않는다.
import { useEffect, useState } from "react"
import { UNMYEONG_MEDIA, type PaperRect } from "@/lib/unmyeong/assets"

export type MediaKind = "pc" | "mobile"
export type Size = { w: number; h: number }

/** 가로 ≥ 세로 → PC 자산, 아니면 모바일 자산 */
export const kindOf = (w: number, h: number): MediaKind => (w >= h ? "pc" : "mobile")
/** D-032: 모바일도 가로(16:9) 자산 하나만 쓴다. 9:16 항목은 목록에 남겨 두되 쓰지 않는다 */
export const mediaOf = (kind: MediaKind) => { void kind; return UNMYEONG_MEDIA.pc }

/** 창 크기(회전·크기 변경 때 갱신). 첫 렌더 전에는 null */
export function useViewport(): Size | null {
  const [vp, setVp] = useState<Size | null>(null)
  useEffect(() => {
    const read = () => setVp(prev => {
      const next = { w: window.innerWidth, h: window.innerHeight }
      return prev && prev.w === next.w && prev.h === next.h ? prev : next
    })
    read()
    window.addEventListener("resize", read)
    window.addEventListener("orientationchange", read)
    return () => { window.removeEventListener("resize", read); window.removeEventListener("orientationchange", read) }
  }, [])
  return vp
}

export type PxRect = { left: number; top: number; width: number; height: number }

/** object-fit: cover 변환과 같은 식으로, 이미지 대비 % 사각형/점을 화면 px로 환산 */
export function coverMapper(box: Size, iw: number, ih: number) {
  const s = Math.max(box.w / iw, box.h / ih)
  const ox = (box.w - iw * s) / 2
  const oy = (box.h - ih * s) / 2
  return {
    scale: s,
    rect: (r: PaperRect): PxRect => ({
      left: ox + (r.x0 / 100) * iw * s,
      top: oy + (r.y0 / 100) * ih * s,
      width: ((r.x1 - r.x0) / 100) * iw * s,
      height: ((r.y1 - r.y0) / 100) * ih * s,
    }),
    point: (p: { x: number; y: number }) => ({ x: ox + (p.x / 100) * iw * s, y: oy + (p.y / 100) * ih * s }),
  }
}

export type Xf = { s: number; tx: number; ty: number }

/** 모바일(세로 화면): 가로 이미지를 object-fit: contain으로 놓았을 때의 변환(이미지 px → 화면 px) */
export function containXf(box: Size, iw: number, ih: number): Xf {
  const s = Math.min(box.w / iw, box.h / ih)
  return { s, tx: (box.w - iw * s) / 2, ty: (box.h - ih * s) / 2 }
}

/**
 * 모바일 확대 변환: 대상 쪽(이미지 대비 %)이 화면을 채우도록(가로·세로 중 먼저 닿는 쪽 맞춤) 쪽 중심을 화면 중심에 둔다.
 * 이미지가 화면보다 크면 이미지 밖이 비치지 않게 평행 이동을 제한한다.
 */
export function zoomXf(box: Size, iw: number, ih: number, target: PaperRect): Xf {
  const pw = ((target.x1 - target.x0) / 100) * iw, ph = ((target.y1 - target.y0) / 100) * ih
  const s = Math.min(box.w / pw, box.h / ph)
  const cx = ((target.x0 + target.x1) / 200) * iw, cy = ((target.y0 + target.y1) / 200) * ih
  const clamp = (t: number, view: number, size: number) => (size * s <= view ? (view - size * s) / 2 : Math.min(0, Math.max(view - size * s, t)))
  return { s, tx: clamp(box.w / 2 - cx * s, box.w, iw), ty: clamp(box.h / 2 - cy * s, box.h, ih) }
}

/** 이미지 대비 % 사각형/점을 주어진 변환 뒤의 화면 px로 환산(확대 변환까지 포함) */
export function xfMapper(xf: Xf, iw: number, ih: number) {
  return {
    rect: (r: PaperRect): PxRect => ({
      left: xf.tx + (r.x0 / 100) * iw * xf.s,
      top: xf.ty + (r.y0 / 100) * ih * xf.s,
      width: ((r.x1 - r.x0) / 100) * iw * xf.s,
      height: ((r.y1 - r.y0) / 100) * ih * xf.s,
    }),
    point: (p: { x: number; y: number }) => ({ x: xf.tx + (p.x / 100) * iw * xf.s, y: xf.ty + (p.y / 100) * ih * xf.s }),
  }
}

/** contain 상태의 화면 요소를 확대 상태로 옮기는 상대 변환(화면 px 기준, transform-origin 0 0): screen' = k*screen + (x, y) */
export function relativeZoom(from: Xf, to: Xf) {
  const k = to.s / from.s
  return { k, x: to.tx - k * from.tx, y: to.ty - k * from.ty }
}
export const relCss = (r: { k: number; x: number; y: number }) => `translate(${r.x}px, ${r.y}px) scale(${r.k})`

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
}

type NetInfo = { saveData?: boolean; effectiveType?: string }
/** 영상을 틀어도 되는가 — 움직임 줄이기·데이터 절약·느린 연결이면 false */
export function canPlayMedia(): boolean {
  if (prefersReducedMotion()) return false
  const c = (navigator as Navigator & { connection?: NetInfo }).connection
  if (c?.saveData) return false
  if (c?.effectiveType && /^(slow-2g|2g|3g)$/.test(c.effectiveType)) return false
  return true
}

/** 효과음 — 반드시 사용자 클릭 직후에 부른다. 파일이 없거나 재생이 막혀도 조용히 넘어간다 */
export function playSfx(srcs: string[] = UNMYEONG_MEDIA.sfxBrush) {
  const next = (i: number) => {
    if (i >= srcs.length) return
    try {
      const a = new Audio(srcs[i])
      a.volume = 0.7
      a.addEventListener("error", () => next(i + 1), { once: true })
      a.play().catch(() => { /* 자동 재생 차단·파일 없음 — 진행에는 영향 없음 */ })
    } catch { /* 오디오를 못 만들어도 진행 */ }
  }
  next(0)
}
