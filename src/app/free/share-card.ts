// 공유 카드: 일간 별명 + 한 줄 + 복자 + 사이트 이름만 담은 1080×1350 이미지(브라우저 캔버스).
// 이름·생년월일·성별·시주 등 개인 정보는 카드에도 공유 문구에도 넣지 않는다 — 입력으로 받는 값이 일간 단위(spec)뿐이다.
import { bokjaSvgDocument, BOKJA_RATIO } from "./bokja-svg"
import { SITE_NAME } from "./theme"
import type { ElementKo, FreeResult } from "./_lib/types"

export const CARD_W = 1080
export const CARD_H = 1350

export interface ShareSpec {
  site: string
  dmHanja: string
  dmKo: string
  element: ElementKo
  nickname: string
  line: string
  /** Web Share에 실을 문구(개인정보 없음) */
  shareText: string
  /** 링크 공유 경로(일간 단위) */
  path: string
  filename: string
}

/** 결과 → 공유 카드 명세. 일간·별명·한 줄만 꺼낸다 */
export function buildShareSpec(r: Pick<FreeResult, "dayMaster" | "copy">): ShareSpec {
  const { dayMaster: dm, copy } = r
  const nickname = copy.share.nickname
  const line = copy.share.line
  return {
    site: SITE_NAME,
    dmHanja: dm.hanja,
    dmKo: dm.ko,
    element: dm.element,
    nickname,
    line,
    shareText: copy.share.placeholder ? `${SITE_NAME} — 생년월일만 넣으면 바로 보는 무료 사주` : `“${nickname}” ${line}`,
    path: `/free/dm/${encodeURIComponent(dm.hanja)}`,
    filename: `halmi-saju-${dm.hanja}.png`,
  }
}

const EL_VAR: Record<ElementKo, string> = { 목: "wood", 화: "fire", 토: "earth", 금: "metal", 수: "water" }

export interface CardColors {
  bg: string; surface: string; text: string; muted: string; highlight: string
  edge: string; elColor: string; elSoft: string
  display: string; body: string; hanja: string
}

/** 현재 적용된 디자인 토큰에서 색·글꼴을 읽는다(브랜드 A/B 전환에 자동으로 따라간다) */
export function readCardColors(root: HTMLElement, el: ElementKo): CardColors {
  const cs = getComputedStyle(root)
  const v = (n: string, d: string) => cs.getPropertyValue(n).trim() || d
  return {
    bg: v("--c-bg", "#f3eadb"), surface: v("--c-surface", "#fffaf2"), text: v("--c-text", "#221e1b"),
    muted: v("--c-text-muted", "#5f564d"), highlight: v("--c-highlight", "#f2c14e"), edge: v("--edge-card", "#221e1b"),
    elColor: v(`--el-${EL_VAR[el]}`, "#41693b"), elSoft: v(`--el-${EL_VAR[el]}-soft`, "#e8e9dc"),
    display: v("--f-display", "serif"), body: v("--f-body", "sans-serif"), hanja: v("--f-hanja", "serif"),
  }
}

/** 한글은 어절 단위로 줄바꿈하고, 한 어절이 너무 길면 글자 단위로 자른다. 줄 수 초과 시 말줄임 */
export function wrapLines(measure: (s: string) => number, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ""
  const push = () => { if (cur) lines.push(cur); cur = "" }
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (measure(next) <= maxW) { cur = next; continue }
    push()
    if (measure(w) <= maxW) { cur = w; continue }
    for (const ch of w) {
      if (measure(cur + ch) > maxW) push()
      cur += ch
    }
  }
  push()
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    let last = kept[maxLines - 1]
    while (last.length > 1 && measure(`${last}…`) > maxW) last = last.slice(0, -1)
    kept[maxLines - 1] = `${last}…`
    return kept
  }
  return lines
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function loadSvg(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("복자 그림을 불러오지 못했어요"))
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}

/** 캔버스에 카드를 그린다. 글꼴이 준비된 뒤에 호출해야 한다(prepareCardFonts) */
export async function drawShareCard(canvas: HTMLCanvasElement, spec: ShareSpec, c: CardColors): Promise<void> {
  canvas.width = CARD_W
  canvas.height = CARD_H
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("캔버스를 쓸 수 없어요")
  const bokja = await loadSvg(bokjaSvgDocument(c.surface))

  ctx.fillStyle = c.bg
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  // 카드 본체: 먹선 + 아래로 떨어진 그림자(스티커 느낌)
  const X = 60, Y = 60, W = CARD_W - 120, H = CARD_H - 150
  ctx.fillStyle = c.text
  roundRect(ctx, X, Y + 14, W, H, 44); ctx.fill()
  ctx.fillStyle = c.surface
  roundRect(ctx, X, Y, W, H, 44); ctx.fill()
  ctx.lineWidth = 6; ctx.strokeStyle = c.text
  roundRect(ctx, X, Y, W, H, 44); ctx.stroke()

  ctx.textAlign = "center"
  ctx.textBaseline = "alphabetic"

  // 위쪽 사이트 이름
  ctx.fillStyle = c.muted
  ctx.font = `700 40px ${c.display}`
  ctx.fillText(spec.site, CARD_W / 2, 170)

  // 일간 배지
  const cx = CARD_W / 2, cy = 490, R = 190
  ctx.fillStyle = c.elSoft
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill()
  ctx.lineWidth = 6; ctx.strokeStyle = c.text; ctx.stroke()
  ctx.fillStyle = c.elColor
  ctx.font = `700 260px ${c.hanja}`
  ctx.textBaseline = "middle"
  ctx.fillText(spec.dmHanja, cx, cy + 10)
  ctx.textBaseline = "alphabetic"

  // 복자: 배지 오른쪽 위에 걸터앉기
  const bw = 270, bh = bw / BOKJA_RATIO
  ctx.drawImage(bokja, cx + 70, cy - R - bh + 52, bw, bh)

  // 일간 이름표 + 별명
  ctx.fillStyle = c.muted
  ctx.font = `400 38px ${c.body}`
  ctx.fillText(`${spec.dmKo}${spec.element} 일간`, cx, 770)
  ctx.fillStyle = c.text
  let nickSize = 92
  ctx.font = `700 ${nickSize}px ${c.display}`
  while (ctx.measureText(spec.nickname).width > 860 && nickSize > 52) {
    nickSize -= 4
    ctx.font = `700 ${nickSize}px ${c.display}`
  }
  ctx.fillText(spec.nickname, cx, 880)

  // 한 줄
  ctx.fillStyle = c.text
  ctx.font = `400 46px ${c.body}`
  const lines = wrapLines((s) => ctx.measureText(s).width, spec.line, 800, 3)
  lines.forEach((l, i) => ctx.fillText(l, cx, 980 + i * 68))

  // 아래 주소 표시(링크만 — 개인정보 없음)
  ctx.fillStyle = c.highlight
  ctx.fillRect(cx - 60, 1230, 120, 6)
  ctx.fillStyle = c.muted
  ctx.font = `700 34px ${c.display}`
  ctx.fillText(`${spec.site} · 무료로 해 보기`, cx, 1300)
}

/** 캔버스에서 쓸 글꼴 조각을 미리 받는다. 실패해도 대체 글꼴로 그려진다 */
export async function prepareCardFonts(c: CardColors, spec: ShareSpec): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return
  const all = `${spec.site}${spec.nickname}${spec.line}${spec.dmKo}${spec.element} 일간 무료로 해 보기 ·`
  try {
    await Promise.all([
      document.fonts.load(`700 40px ${c.display}`, all),
      document.fonts.load(`400 40px ${c.body}`, all),
      document.fonts.load(`700 200px ${c.hanja}`, spec.dmHanja),
    ])
  } catch {
    /* 대체 글꼴 사용 */
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("이미지를 만들지 못했어요"))), "image/png"))
}
