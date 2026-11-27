// 링크 공유용 미리보기 이미지: /free/og?dm=甲 (일간 단위 — 이름·생년월일을 받지도 쓰지도 않는다)
// 글꼴: ImageResponse는 한글·한자 글꼴이 없으므로 필요한 글자만 Google Fonts에서 받아 쓴다(요청 시 1회, 메모리 캐시).
// 출시 전 과제: 글꼴 파일을 저장소에 넣어 외부 요청을 없앤다(docs 보고 참조). 글꼴을 못 받으면 503을 돌려 깨진 이미지를 내보내지 않는다.
import { ImageResponse } from "next/og"
import type { NextRequest } from "next/server"
import { bokjaSvgDocument } from "../bokja-svg"
import { dayMasterOf } from "../_lib/ganzhi"
import { loadRawContent, shareCopyForDayMaster } from "../_lib/content"
import { SITE_NAME } from "../theme"

// 시안 B 토큰 값의 고정 사본(이미지 서버 렌더에는 CSS 변수가 없다). 시안이 바뀌면 이 표만 맞춘다.
const C = { bg: "#f3eadb", surface: "#fffaf2", text: "#221e1b", muted: "#5f564d", highlight: "#f2c14e" }
const EL: Record<string, { c: string; soft: string }> = {
  목: { c: "#41693b", soft: "#e8e9dc" }, 화: { c: "#9e4a2b", soft: "#f3e5da" }, 토: { c: "#7d5e1c", soft: "#efe7d8" },
  금: { c: "#5e6269", soft: "#ece8e2" }, 수: { c: "#2e4a6b", soft: "#e6e5e2" },
}

const fontCache = new Map<string, ArrayBuffer>()
async function loadFont(text: string): Promise<ArrayBuffer | null> {
  const chars = [...new Set(text)].join("")
  const hit = fontCache.get(chars)
  if (hit) return hit
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@700&text=${encodeURIComponent(chars)}`)).text()
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1]
    if (!url) return null
    const buf = await (await fetch(url)).arrayBuffer()
    fontCache.set(chars, buf)
    return buf
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const dmParam = req.nextUrl.searchParams.get("dm") ?? ""
  const dm = dayMasterOf(dmParam)
  const share = dm ? shareCopyForDayMaster(loadRawContent(), dm.hanja, dm.ko, dm.element) : null
  const nickname = share?.nickname ?? "내 사주 한 장"
  const line = share ? (share.placeholder ? "생년월일만 넣으면 바로 나와요" : share.line) : "생년월일만 넣으면 바로 나와요"
  const el = EL[dm?.element ?? "토"]
  const glyph = dm?.hanja ?? "命"

  const font = await loadFont(`${SITE_NAME}${nickname}${line}${glyph}${dm ? `${dm.ko}${dm.element} 일간` : ""}무료로 해 보기 · `)
  if (!font) return new Response("font unavailable", { status: 503, headers: { "Cache-Control": "no-store" } })

  const cat = `data:image/svg+xml;base64,${Buffer.from(bokjaSvgDocument(C.surface)).toString("base64")}`
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: C.bg, padding: 40, fontFamily: "NotoSerifKR" }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", background: C.surface, border: `5px solid ${C.text}`, borderRadius: 36, padding: "0 56px", position: "relative", boxShadow: `0 10px 0 ${C.text}` }}>
          <div style={{ width: 300, height: 300, borderRadius: 150, background: el.soft, border: `5px solid ${C.text}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 190, color: el.c }}>
            {glyph}
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", marginLeft: 56 }}>
            <div style={{ fontSize: 30, color: C.muted }}>{SITE_NAME}</div>
            {dm && <div style={{ fontSize: 32, color: C.muted, marginTop: 28 }}>{`${dm.ko}${dm.element} 일간`}</div>}
            <div style={{ fontSize: nickname.length > 10 ? 54 : 68, color: C.text, marginTop: 8, lineHeight: 1.2 }}>{nickname}</div>
            <div style={{ fontSize: 34, color: C.text, marginTop: 20, lineHeight: 1.4 }}>{line}</div>
            <div style={{ fontSize: 28, color: C.muted, marginTop: 28 }}>무료로 해 보기 · 가입 없이</div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cat} width={200} height={150} alt="" style={{ position: "absolute", right: 36, top: -64 }} />
        </div>
      </div>
    ),
    {
      width: 1200, height: 630,
      fonts: [{ name: "NotoSerifKR", data: font, weight: 700, style: "normal" }],
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    },
  )
}
