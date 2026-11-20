"use client"

import { useState } from "react"
import ReactMarkdown from "react-markdown"
import Link from "next/link"
import type { FullReading, Part, Chapter, Fork, YearEntry } from "@/lib/generate-reading-v2"

const EL_KO: Record<string, string> = {
  wood: "목", fire: "화", earth: "토", metal: "금", water: "수",
}
const EL_COLOR: Record<string, string> = {
  목: "#7fbf8c", 화: "#ec8a72", 토: "#dcae6e", 금: "#b6bcc6", 수: "#6b9bcb",
}
const EL_COLOR_EN: Record<string, string> = {
  wood: "#7fbf8c", fire: "#ec8a72", earth: "#dcae6e", metal: "#b6bcc6", water: "#6b9bcb",
}

type Pillar = { label: string; stem: string; branch: string; element: string; branchEl: string; me?: boolean }
type FiveEl = { el: string; count: number }
type Section = { title: string; content: string }

function parseSections(md: string): Section[] {
  const sections: Section[] = []
  const parts = md.split(/^## /m)
  for (const part of parts) {
    if (!part.trim()) continue
    const nl = part.indexOf("\n")
    const title = nl === -1 ? part.trim() : part.slice(0, nl).trim()
    const content = nl === -1 ? "" : part.slice(nl + 1).trim()
    sections.push({ title, content })
  }
  return sections
}

export type ReadingViewerProps = {
  userName: string
  readingName: string
  readingType: string
  birthInfo: string
  pillars: Pillar[]
  fiveElements: FiveEl[]
  content?: string
  fullReading?: FullReading
  reliabilityNote?: string
  createdAt: string
}

export default function ReadingViewer(props: ReadingViewerProps) {
  if (props.fullReading) {
    return <NewReadingViewer {...props} fullReading={props.fullReading} />
  }
  return <LegacyReadingViewer {...props} content={props.content || ""} />
}

// 슬라이드 페이드인 + body highlight CSS + 스크롤바 숨김
const STYLES = `
  @keyframes si { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:none; } }
  .si { animation: si 0.22s ease; }
  .bhl b { background: linear-gradient(transparent 55%, rgba(165,96,63,0.16) 55%); font-weight:600; color:#1b2a3a; }
  .no-sb { scrollbar-width: none; -ms-overflow-style: none; }
  .no-sb::-webkit-scrollbar { display: none; }
  .hide-sb *::-webkit-scrollbar { display: none; }
  .hide-sb * { scrollbar-width: none; -ms-overflow-style: none; }
`

// ══════════════════════════════════════════════════════════════════════════════
// 신버전 뷰어 (구조화 JSON)
// ══════════════════════════════════════════════════════════════════════════════
type TocItem = { label: string; sub: string; idx: number }
type Slide =
  | { type: "cover" }
  | { type: "toc" }
  | { type: "note"; text: string }
  | { type: "part-index"; part: Part; chapterSlideIdxs: number[] }
  | { type: "chapter"; part: string; chapter: Chapter }
  | { type: "fork"; fork: Fork }
  | { type: "years"; years: YearEntry[] }
  | { type: "closing" }

type PartTocItem = { label: string; tag: string; count: number; slideIdx: number }

type NavTab = { label: string; firstIdx: number; lastIdx: number }

function NewReadingViewer({ userName, readingName, readingType, birthInfo, pillars, fiveElements, fullReading, createdAt }: ReadingViewerProps & { fullReading: FullReading }) {
  const slides: Slide[] = [{ type: "cover" }, { type: "toc" }]
  const toc: TocItem[] = []
  const partToc: PartTocItem[] = []
  const tabs: NavTab[] = [{ label: "커버", firstIdx: 0, lastIdx: 1 }]

  if (fullReading.reliability_note) slides.push({ type: "note", text: fullReading.reliability_note })

  for (const part of fullReading.parts) {
    const partIndexIdx = slides.length
    const chapterStartIdx = partIndexIdx + 1
    const chapterSlideIdxs = part.chapters.map((_, i) => chapterStartIdx + i)

    partToc.push({
      label: part.title,
      tag: part.chapters.slice(0, 2).map(c => c.key).join(" · "),
      count: part.chapters.length,
      slideIdx: partIndexIdx,
    })
    slides.push({ type: "part-index", part, chapterSlideIdxs })

    for (const ch of part.chapters) {
      toc.push({ label: ch.title, sub: part.title, idx: slides.length })
      slides.push({ type: "chapter", part: part.title, chapter: ch })
    }
    tabs.push({ label: part.title, firstIdx: partIndexIdx, lastIdx: slides.length - 1 })
  }

  const forks = fullReading.forks ?? []
  if (forks.length) {
    const firstIdx = slides.length
    for (const fork of forks) {
      toc.push({ label: fork.title, sub: "갈림길", idx: slides.length })
      slides.push({ type: "fork", fork })
    }
    tabs.push({ label: "갈림길", firstIdx, lastIdx: slides.length - 1 })
  }

  if (fullReading.years?.length) {
    const firstIdx = slides.length
    toc.push({ label: "올해부터 여섯 해", sub: "해마다", idx: slides.length })
    slides.push({ type: "years", years: fullReading.years })
    tabs.push({ label: "해마다", firstIdx, lastIdx: slides.length - 1 })
  }

  const closingIdx = slides.length
  toc.push({ label: "마무리", sub: "", idx: closingIdx })
  slides.push({ type: "closing" })
  tabs.push({ label: "마무리", firstIdx: closingIdx, lastIdx: closingIdx })

  const total = slides.length
  const [slide, setSlide] = useState(0)
  const prev = () => setSlide(s => Math.max(0, s - 1))
  const next = () => setSlide(s => Math.min(total - 1, s + 1))

  const activeTabIdx = tabs.findIndex(t => slide >= t.firstIdx && slide <= t.lastIdx)
  const s = slides[slide]

  return (
    <div className="min-h-screen bg-[#ece7df] flex flex-col">
      <style>{STYLES}</style>

      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#e4ddd3] bg-[#ece7df] flex-none">
        <span className="text-sm font-bold text-[#1b2a3a] truncate max-w-[55%]">{userName}의 사주</span>
        <div className="flex gap-2">
          <Link href="/my-readings" className="text-xs border border-[#e4ddd3] bg-white text-[#1b2a3a] rounded-full px-3 py-1.5 font-medium hover:border-[#1b2a3a] transition-colors">내 풀이</Link>
          <Link href={`/input?type=${readingType}`} className="text-xs border border-[#e4ddd3] bg-white text-[#1b2a3a] rounded-full px-3 py-1.5 font-medium hover:border-[#1b2a3a] transition-colors">새 풀이</Link>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex-none bg-[#ece7df] border-b border-[#e4ddd3] overflow-x-auto no-sb">
        <div className="flex px-4" style={{ gap: 0, minWidth: "max-content" }}>
          {tabs.map((t, i) => (
            <button
              key={i}
              onClick={() => setSlide(t.firstIdx)}
              className="transition-colors"
              style={{
                fontSize: "12px",
                fontWeight: i === activeTabIdx ? 700 : 400,
                color: i === activeTabIdx ? "#1b2a3a" : "#9ea3ab",
                borderBottom: i === activeTabIdx ? "2px solid #1b2a3a" : "2px solid transparent",
                padding: "8px 12px",
                whiteSpace: "nowrap",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 카드 영역 */}
      <div className="flex-1 flex items-center justify-center px-10 py-4 relative">
        <button onClick={prev} disabled={slide === 0}
          className="absolute left-2 z-10 w-9 h-9 rounded-full border border-[#e4ddd3] bg-white text-[#1b2a3a] flex items-center justify-center text-xl shadow-sm disabled:opacity-20 hover:border-[#1b2a3a] transition-colors">‹</button>

        <div className="relative w-full max-w-sm" style={{ aspectRatio: "14/19" }}>
          <div
            key={slide}
            className="si hide-sb relative w-full h-full rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.06),0_12px_40px_rgba(27,42,58,0.14)] overflow-hidden"
            style={{ containerType: "inline-size" } as React.CSSProperties}
          >
            {s.type === "cover" && <CoverSlide {...{ userName, readingName, birthInfo, pillars, fiveElements, createdAt, next, quote: fullReading.quote }} />}
            {s.type === "toc" && <TocSlide partToc={partToc} goto={setSlide} />}
            {s.type === "note" && <NoteSlide text={s.text} />}
            {s.type === "part-index" && <PartIndexSlide part={s.part} chapterSlideIdxs={s.chapterSlideIdxs} goto={setSlide} />}
            {s.type === "chapter" && <ChapterSlide part={s.part} chapter={s.chapter} />}
            {s.type === "fork" && <ForkSlide fork={s.fork} />}
            {s.type === "years" && <YearsSlide years={s.years} />}
            {s.type === "closing" && <ClosingSlide closing={fullReading.closing} review={fullReading.review} />}
          </div>
        </div>

        <button onClick={next} disabled={slide === total - 1}
          className="absolute right-2 z-10 w-9 h-9 rounded-full border border-[#e4ddd3] bg-white text-[#1b2a3a] flex items-center justify-center text-xl shadow-sm disabled:opacity-20 hover:border-[#1b2a3a] transition-colors">›</button>
      </div>

      {/* 프로그레스 바 */}
      <div className="flex items-center justify-center gap-3 pb-6 pt-1 flex-none">
        <div className="w-52 h-1 bg-[#d8d0c3] rounded-full overflow-hidden">
          <div className="h-full bg-[#1b2a3a] rounded-full transition-all duration-300"
            style={{ width: `${((slide + 1) / total) * 100}%` }} />
        </div>
        <span className="text-xs text-[#9ea3ab] tabular-nums">{slide + 1} / {total}</span>
      </div>
    </div>
  )
}

// ── 커버 슬라이드 ─────────────────────────────────────────────────────────────
const EL_ORDER = ["목", "화", "토", "금", "수"] as const

function CoverSlide({ userName, readingName, birthInfo, pillars, fiveElements, createdAt, next, quote }: {
  userName: string; readingName: string; birthInfo: string
  pillars: Pillar[]; fiveElements: FiveEl[]; createdAt: string; next: () => void; quote?: string
}) {
  const elMap = Object.fromEntries(fiveElements.map(f => [f.el, f.count]))

  return (
    <div className="absolute inset-0 bg-[#1b2a3a] text-[#f3ede4] flex flex-col overflow-hidden no-sb"
      style={{ padding: "6cqw 7cqw" }}>

      {/* 배지 */}
      <div style={{ display: "flex", alignItems: "center", gap: "3cqw", marginBottom: "4cqw", flexShrink: 0 }}>
        <div style={{ height: "1px", flex: 1, background: "#e3b892", opacity: 0.25 }} />
        <span style={{ fontSize: "2.3cqw", letterSpacing: "0.35em", color: "#e3b892", fontWeight: 700 }}>AI 명리학 사주풀이</span>
        <div style={{ height: "1px", flex: 1, background: "#e3b892", opacity: 0.25 }} />
      </div>

      {/* 사주 별칭 */}
      <p style={{ fontSize: "3cqw", color: "#9ea3ab", marginBottom: "1cqw", flexShrink: 0 }}>{readingName}</p>

      {/* 메인 타이틀 */}
      <h1 style={{ fontSize: "7cqw", lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: "1.2cqw", flexShrink: 0 }}
        className="font-serif font-black">{userName}의 사주</h1>

      {/* 생년월일 */}
      <p style={{ fontSize: "2.6cqw", color: "#9ea3ab", marginBottom: "4cqw", flexShrink: 0 }}>{birthInfo}</p>

      {/* 사주팔자 그리드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "2cqw", marginBottom: "3cqw", flexShrink: 0 }}>
        {pillars.map(({ label, stem, branch, element, branchEl, me }) => (
          <div key={label} style={{
            padding: "2.5cqw 0", borderRadius: "2cqw", textAlign: "center",
            border: `1px solid ${me ? "#e3b892" : "rgba(243,237,228,0.1)"}`,
            background: me ? "rgba(227,184,146,0.07)" : "transparent",
          }}>
            <span style={{ display: "block", fontSize: "2cqw", color: "#9ea3ab", letterSpacing: "0.1em", marginBottom: "0.8cqw" }}>{label}</span>
            <span style={{ display: "block", fontSize: "6.5cqw", color: EL_COLOR[element] || "#f3ede4", fontFamily: "serif", fontWeight: 700, lineHeight: 1, marginBottom: "0.4cqw" }}>{stem}</span>
            <span style={{ display: "block", fontSize: "6.5cqw", color: EL_COLOR[branchEl] || "#e9e2d6", fontFamily: "serif", fontWeight: 700, lineHeight: 1 }}>{branch}</span>
          </div>
        ))}
      </div>

      {/* 오행 바 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1.5cqw", marginBottom: "auto", flexShrink: 0 }}>
        {EL_ORDER.map(el => {
          const count = elMap[el] ?? 0
          const col = EL_COLOR[el]
          return count > 0 ? (
            <div key={el} style={{ background: `${col}33`, border: `1px solid ${col}66`, borderRadius: "1.5cqw", padding: "1.8cqw 0", textAlign: "center" }}>
              <span style={{ display: "block", fontSize: "2.5cqw", color: col, fontWeight: 700, marginBottom: "0.5cqw" }}>{el}</span>
              <span style={{ display: "block", fontSize: "3.5cqw", color: "#f3ede4", fontWeight: 700 }}>{count}</span>
            </div>
          ) : (
            <div key={el} style={{ border: `1px dashed ${col}44`, borderRadius: "1.5cqw", padding: "1.8cqw 0", textAlign: "center" }}>
              <span style={{ display: "block", fontSize: "2.5cqw", color: `${col}66`, fontWeight: 700, marginBottom: "0.5cqw" }}>{el}</span>
              <span style={{ display: "block", fontSize: "3.5cqw", color: "#555e6a", fontWeight: 700 }}>0</span>
            </div>
          )
        })}
      </div>

      {/* 운명 인용구 */}
      {quote && (
        <div style={{ borderTop: "1px solid rgba(243,237,228,0.12)", paddingTop: "3cqw", marginTop: "3cqw", flexShrink: 0 }}>
          <p style={{ fontSize: "3cqw", lineHeight: 1.7, color: "#c8bfb0", fontFamily: "serif", fontStyle: "italic" }}>{quote}</p>
        </div>
      )}

      {/* 하단 */}
      <div style={{ borderTop: "1px solid rgba(243,237,228,0.08)", paddingTop: "2.5cqw", marginTop: "2.5cqw", display: "flex", justifyContent: "space-between", fontSize: "2.5cqw", color: "#9ea3ab", flexShrink: 0 }}>
        <span>{createdAt}</span>
        <button onClick={next} style={{ color: "#e3b892", fontWeight: 700 }}>풀이 보기 →</button>
      </div>
    </div>
  )
}

// ── 목차 슬라이드 (파트 단위) ─────────────────────────────────────────────────
function TocSlide({ partToc, goto }: { partToc: PartTocItem[]; goto: (i: number) => void }) {
  return (
    <div className="absolute inset-0 bg-[#faf8f4] flex flex-col overflow-hidden"
      style={{ padding: "6cqw 6cqw 5cqw" }}>

      {/* 헤더 */}
      <div style={{ marginBottom: "3cqw", flexShrink: 0 }}>
        <span style={{ fontSize: "2.3cqw", color: "#a5603f", letterSpacing: "0.3em", fontWeight: 700 }}>四柱 · 할머니가 풀어 주는 사주</span>
        <h2 style={{ fontSize: "6.5cqw", lineHeight: 1.1, marginTop: "1.5cqw" }}
          className="font-serif font-black text-[#1b2a3a]">차례</h2>
        <div style={{ marginTop: "2.5cqw", height: "1px", background: "#e4ddd3" }} />
      </div>

      {/* 파트 버튼 */}
      <div className="flex-1 overflow-y-auto no-sb" style={{ display: "flex", flexDirection: "column", gap: "2cqw" }}>
        {partToc.map((item, i) => (
          <button key={i} onClick={() => goto(item.slideIdx)}
            style={{ padding: "3cqw 3.5cqw", borderRadius: "2cqw", display: "flex", alignItems: "center", gap: "3cqw", width: "100%", textAlign: "left", background: "#fff", border: "1px solid #e4ddd3", cursor: "pointer" }}
            className="hover:border-[#1b2a3a] transition-colors">
            <span style={{ fontSize: "5.5cqw", width: "6cqw", textAlign: "center", color: "#a5603f", fontFamily: "serif", fontWeight: 900, flexShrink: 0, lineHeight: 1 }}>{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: "4cqw", fontWeight: 700, color: "#1b2a3a", lineHeight: 1.2, fontFamily: "serif" }}>{item.label}</p>
              <p style={{ fontSize: "2.4cqw", color: "#9ea3ab", marginTop: "0.8cqw" }}>{item.tag} · {item.count}장</p>
            </div>
            <span style={{ fontSize: "3.5cqw", color: "#c8bfb0", flexShrink: 0 }}>›</span>
          </button>
        ))}

        {/* 하단 안내 */}
        <p style={{ fontSize: "2.3cqw", color: "#b0a89a", lineHeight: 1.65, marginTop: "1cqw", padding: "0 1cqw" }}>
          각 편 첫 쪽에서 세부 목차를 볼 수 있습니다.<br />
          이 풀이는 전통 명리 이론에 따른 해석입니다. 길을 정하는 건 읽는 분 자신이에요.
        </p>
      </div>
    </div>
  )
}

// ── 파트 인덱스 슬라이드 ──────────────────────────────────────────────────────
function PartIndexSlide({ part, chapterSlideIdxs, goto }: {
  part: Part; chapterSlideIdxs: number[]; goto: (i: number) => void
}) {
  return (
    <div className="absolute inset-0 bg-[#faf8f4] flex flex-col overflow-hidden">
      <div style={{ height: "1.1cqw", background: "#1b2a3a", flexShrink: 0 }} />

      <div style={{ padding: "4cqw 6cqw 2.5cqw", flexShrink: 0 }}>
        <span style={{ fontSize: "2.3cqw", color: "#a5603f", letterSpacing: "0.3em", fontWeight: 700 }}>차례</span>
        <h2 style={{ fontSize: "6cqw", lineHeight: 1.15, marginTop: "1.5cqw" }}
          className="font-serif font-black text-[#1b2a3a]">{part.title}</h2>
      </div>

      <div style={{ height: "1px", background: "#e4ddd3", flexShrink: 0, margin: "0 6cqw" }} />

      <div className="flex-1 overflow-y-auto no-sb" style={{ padding: "2cqw 6cqw 4cqw" }}>
        {part.chapters.map((ch, i) => (
          <button key={i} onClick={() => goto(chapterSlideIdxs[i])}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: "2.5cqw", padding: "2.2cqw 2.5cqw", borderRadius: "1.5cqw", textAlign: "left", background: "transparent", border: "none", cursor: "pointer" }}
            className="hover:bg-[#f1ebe2] transition-colors">
            <span style={{ fontSize: "3cqw", color: "#a5603f", fontFamily: "serif", fontWeight: 700, width: "4.5cqw", flexShrink: 0, lineHeight: 1 }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span style={{ fontSize: "2.3cqw", color: "#b0a89a", width: "16cqw", flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {ch.key}
            </span>
            <span style={{ fontSize: "2.9cqw", fontWeight: 600, color: "#1b2a3a", flex: 1, lineHeight: 1.3, letterSpacing: "-0.01em" }}>
              {ch.title}
            </span>
            <span style={{ fontSize: "2.5cqw", color: "#c8bfb0", flexShrink: 0 }}>›</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── 신뢰도 노트 슬라이드 ──────────────────────────────────────────────────────
function NoteSlide({ text }: { text: string }) {
  return (
    <div className="absolute inset-0 bg-[#faf8f4] flex flex-col items-center justify-center"
      style={{ padding: "8cqw", textAlign: "center" }}>
      <div style={{ fontSize: "10cqw", marginBottom: "4cqw" }}>📋</div>
      <h2 style={{ fontSize: "5cqw", marginBottom: "4cqw" }} className="font-serif font-bold text-[#1b2a3a]">확인 결과</h2>
      <p style={{ fontSize: "3.5cqw", lineHeight: 1.85, color: "#374151" }}>{text}</p>
    </div>
  )
}

// ── 챕터 슬라이드 ─────────────────────────────────────────────────────────────
function ChapterSlide({ part, chapter }: { part: string; chapter: Chapter }) {
  return (
    <div className="absolute inset-0 bg-[#faf8f4] flex flex-col overflow-hidden">
      {/* 상단 4px 강조선 */}
      <div style={{ height: "1.1cqw", background: "#1b2a3a", flexShrink: 0 }} />

      {/* 헤더 (페이퍼 배경) */}
      <div style={{ padding: "4cqw 6cqw 3cqw", flexShrink: 0 }}>
        <span style={{ fontSize: "2.5cqw", color: "#9ea3ab", letterSpacing: "0.15em", fontWeight: 500 }}>{part}</span>
        <h2 style={{ fontSize: "5.2cqw", lineHeight: 1.3, marginTop: "1.5cqw" }}
          className="font-serif font-bold text-[#1b2a3a]">{chapter.title}</h2>
        {chapter.sub && <p style={{ fontSize: "3cqw", color: "#9ea3ab", marginTop: "1.2cqw" }}>{chapter.sub}</p>}

        {/* 오행 칩 */}
        {chapter.chips?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5cqw", marginTop: "2.5cqw" }}>
            {chapter.chips.map((c, i) => {
              const col = EL_COLOR_EN[c.element] || "#6b9bcb"
              return (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: "1.2cqw", fontSize: "2.8cqw", padding: "0.8cqw 2.2cqw", background: `${col}1a`, color: col, borderRadius: "100px", fontWeight: 600 }}>
                  <span style={{ width: "2cqw", height: "2cqw", borderRadius: "50%", background: col, flexShrink: 0, display: "inline-block" }} />
                  {c.letter} {c.label}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* 구분선 */}
      <div style={{ height: "1px", background: "#e4ddd3", flexShrink: 0, margin: "0 6cqw" }} />

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto bhl" style={{ padding: "3.5cqw 6cqw" }}>
        {chapter.body.map((para, i) => (
          <p key={i} style={{ fontSize: "3.5cqw", lineHeight: 1.9, marginBottom: "2.5cqw", color: "#374151" }}
            dangerouslySetInnerHTML={{ __html: para }} />
        ))}
      </div>

      {/* 해볼 것 / 스스로에게 */}
      {(chapter.todo || chapter.ask) && (
        <div style={{ padding: "0 6cqw 4cqw", display: "flex", flexDirection: "column", gap: "2cqw", flexShrink: 0 }}>
          {chapter.todo && (
            <div style={{ background: "#1b2a3a", borderRadius: "2cqw", padding: "2.5cqw 3.5cqw" }}>
              <p style={{ fontSize: "2.3cqw", letterSpacing: "0.1em", color: "#9ea3ab", marginBottom: "1.5cqw", fontWeight: 700 }}>해볼 것</p>
              <p style={{ fontSize: "3.2cqw", lineHeight: 1.7, color: "#f3ede4" }}>{chapter.todo}</p>
            </div>
          )}
          {chapter.ask && (
            <div style={{ background: "rgba(165,96,63,0.07)", borderRadius: "2cqw", padding: "2.5cqw 3.5cqw", borderLeft: "2.5px solid #a5603f" }}>
              <p style={{ fontSize: "2.3cqw", letterSpacing: "0.1em", color: "#a5603f", marginBottom: "1.5cqw", fontWeight: 700 }}>스스로에게</p>
              <p style={{ fontSize: "3.2cqw", lineHeight: 1.7, fontStyle: "italic", color: "#5a3a20" }}>{chapter.ask}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 갈림길 슬라이드 ───────────────────────────────────────────────────────────
function ForkSlide({ fork }: { fork: Fork }) {
  return (
    <div className="absolute inset-0 bg-[#faf8f4] flex flex-col overflow-hidden">
      <div style={{ height: "1.1cqw", background: "#1b2a3a", flexShrink: 0 }} />

      <div style={{ padding: "4cqw 6cqw 3cqw", flexShrink: 0 }}>
        <span style={{ fontSize: "2.5cqw", color: "#9ea3ab", letterSpacing: "0.15em", fontWeight: 500 }}>갈림길</span>
        <h2 style={{ fontSize: "5.2cqw", lineHeight: 1.3, marginTop: "1.5cqw" }}
          className="font-serif font-bold text-[#1b2a3a]">{fork.title}</h2>
        {fork.sub && <p style={{ fontSize: "3cqw", color: "#9ea3ab", marginTop: "1cqw" }}>{fork.sub}</p>}
      </div>

      <div style={{ height: "1px", background: "#e4ddd3", flexShrink: 0, margin: "0 6cqw" }} />

      <div className="flex-1 overflow-y-auto" style={{ padding: "3.5cqw 6cqw", display: "flex", flexDirection: "column", gap: "3cqw" }}>
        {/* 두 선택지 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2.5cqw" }}>
          {[fork.left, fork.right].map((side, i) => (
            <div key={i} style={{ background: "#fff", borderRadius: "2.5cqw", padding: "3cqw", border: "1px solid #e4ddd3" }}>
              <p style={{ fontSize: "3.5cqw", fontWeight: 700, color: "#1b2a3a", marginBottom: "2cqw" }}>{side.name}</p>
              <p style={{ fontSize: "2.8cqw", color: "#2a6e3f", marginBottom: "1.5cqw", lineHeight: 1.6 }}>+ {side.gain}</p>
              <p style={{ fontSize: "2.8cqw", color: "#8b2e2e", lineHeight: 1.6 }}>− {side.loss}</p>
            </div>
          ))}
        </div>

        {/* 선택 기준 */}
        <div style={{ background: "#f0ebe3", borderRadius: "2.5cqw", padding: "3cqw" }}>
          <p style={{ fontSize: "2.8cqw", fontWeight: 700, color: "#6b5c3a", marginBottom: "2cqw" }}>선택 기준</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.8cqw" }}>
            {fork.criteria.map((q, i) => (
              <div key={i} style={{ display: "flex", gap: "1.5cqw", alignItems: "flex-start" }}>
                <span style={{ fontSize: "2.8cqw", color: "#a5603f", fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                <span style={{ fontSize: "3cqw", color: "#374151", lineHeight: 1.7 }}>{q}</span>
              </div>
            ))}
          </div>
        </div>

        {fork.rule && (
          <p style={{ fontSize: "3.2cqw", fontStyle: "italic", color: "#1b2a3a", lineHeight: 1.7 }}>{fork.rule}</p>
        )}

        {(fork.todo || fork.ask) && (
          <div style={{ display: "flex", flexDirection: "column", gap: "2cqw" }}>
            {fork.todo && (
              <div style={{ background: "#1b2a3a", borderRadius: "2cqw", padding: "2.5cqw 3.5cqw" }}>
                <p style={{ fontSize: "2.3cqw", letterSpacing: "0.1em", color: "#9ea3ab", marginBottom: "1.5cqw", fontWeight: 700 }}>해볼 것</p>
                <p style={{ fontSize: "3.2cqw", lineHeight: 1.7, color: "#f3ede4" }}>{fork.todo}</p>
              </div>
            )}
            {fork.ask && (
              <div style={{ background: "rgba(165,96,63,0.07)", borderRadius: "2cqw", padding: "2.5cqw 3.5cqw", borderLeft: "2.5px solid #a5603f" }}>
                <p style={{ fontSize: "2.3cqw", letterSpacing: "0.1em", color: "#a5603f", marginBottom: "1.5cqw", fontWeight: 700 }}>스스로에게</p>
                <p style={{ fontSize: "3.2cqw", lineHeight: 1.7, fontStyle: "italic", color: "#5a3a20" }}>{fork.ask}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 연도 운세 슬라이드 ────────────────────────────────────────────────────────
function YearsSlide({ years }: { years: YearEntry[] }) {
  return (
    <div className="absolute inset-0 bg-[#faf8f4] flex flex-col overflow-hidden">
      <div style={{ height: "1.1cqw", background: "#1b2a3a", flexShrink: 0 }} />

      <div style={{ padding: "4cqw 6cqw 3cqw", flexShrink: 0 }}>
        <span style={{ fontSize: "2.5cqw", color: "#9ea3ab", letterSpacing: "0.15em", fontWeight: 500 }}>해마다</span>
        <h2 style={{ fontSize: "5.2cqw", lineHeight: 1.3, marginTop: "1.5cqw" }}
          className="font-serif font-bold text-[#1b2a3a]">올해부터 여섯 해</h2>
      </div>

      <div style={{ height: "1px", background: "#e4ddd3", flexShrink: 0, margin: "0 6cqw" }} />

      <div className="flex-1 overflow-y-auto" style={{ padding: "3.5cqw 6cqw", display: "flex", flexDirection: "column", gap: "2.5cqw" }}>
        {years.map(y => {
          const col = EL_COLOR_EN[y.element] || "#6b9bcb"
          return (
            <div key={y.year} style={{ background: "#fff", borderRadius: "2.5cqw", padding: "3cqw 3.5cqw", border: "1px solid #e4ddd3" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "2cqw", marginBottom: "1.8cqw" }}>
                <span style={{ fontSize: "5cqw", fontFamily: "serif", fontWeight: 700, color: "#1b2a3a" }}>{y.year}</span>
                <span style={{ fontSize: "2.8cqw", padding: "0.7cqw 2cqw", background: `${col}1a`, color: col, borderRadius: "100px", fontWeight: 600, flexShrink: 0 }}>
                  {y.ganzhi} · {EL_KO[y.element] || y.element}
                </span>
                <span style={{ fontSize: "2.8cqw", flex: 1, textAlign: "right", color: "#6b7280", lineHeight: 1.3 }}>{y.title}</span>
              </div>
              <p style={{ fontSize: "3.2cqw", lineHeight: 1.75, color: "#374151" }}>{y.text}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 마무리 슬라이드 ───────────────────────────────────────────────────────────
function ClosingSlide({ closing, review }: { closing: FullReading["closing"]; review: FullReading["review"] }) {
  return (
    <div className="absolute inset-0 bg-[#1b2a3a] text-[#f3ede4] flex flex-col overflow-hidden"
      style={{ padding: "7cqw" }}>

      {/* 배지 */}
      <div style={{ display: "flex", alignItems: "center", gap: "3cqw", marginBottom: "5cqw" }}>
        <div style={{ height: "1px", flex: 1, background: "#e3b892", opacity: 0.3 }} />
        <span style={{ fontSize: "2.5cqw", letterSpacing: "0.4em", color: "#e3b892", fontWeight: 700 }}>마무리</span>
        <div style={{ height: "1px", flex: 1, background: "#e3b892", opacity: 0.3 }} />
      </div>

      <div className="flex-1 overflow-y-auto" style={{ display: "flex", flexDirection: "column", gap: "3.5cqw" }}>
        {/* 포인트 */}
        {closing.points.filter(p => p.text).map((p, i) => (
          <div key={i} style={{ display: "flex", gap: "3cqw", alignItems: "flex-start" }}>
            <span style={{ fontSize: "5cqw", color: "#e3b892", fontFamily: "serif", fontWeight: 900, flexShrink: 0, lineHeight: 1 }}>{i + 1}</span>
            <div style={{ flex: 1 }}>
              {p.title && <p style={{ fontSize: "3.2cqw", fontWeight: 700, color: "#e3b892", marginBottom: "1cqw" }}>{p.title}</p>}
              <p style={{ fontSize: "3.2cqw", lineHeight: 1.8, color: "#c8c0b4" }}>{p.text}</p>
            </div>
          </div>
        ))}

        {/* 마지막 말 */}
        {closing.last_words && (
          <div style={{ borderTop: "1px solid rgba(243,237,228,0.1)", paddingTop: "4cqw" }}>
            <p style={{ fontSize: "3.5cqw", lineHeight: 1.85, color: "#f3ede4" }}>{closing.last_words}</p>
          </div>
        )}

        {/* 나중에 돌아볼 것 */}
        {review?.length > 0 && (
          <div style={{ borderTop: "1px solid rgba(243,237,228,0.08)", paddingTop: "4cqw" }}>
            <p style={{ fontSize: "2.3cqw", letterSpacing: "0.3em", color: "#9ea3ab", marginBottom: "2.5cqw" }}>일 년 뒤 다시 볼 것</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5cqw" }}>
              {review.map(r => (
                <div key={r.id} style={{ background: "rgba(255,255,255,0.05)", borderRadius: "2cqw", padding: "2.5cqw 3cqw" }}>
                  <p style={{ fontSize: "2.5cqw", color: "#9ea3ab", marginBottom: "0.8cqw" }}>{r.after}</p>
                  <p style={{ fontSize: "3cqw", color: "#c8c0b4" }}>{r.claim}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 구버전 뷰어 (마크다운)
// ══════════════════════════════════════════════════════════════════════════════
function LegacyReadingViewer({ userName, readingName, readingType, birthInfo, pillars, fiveElements, content, createdAt }: ReadingViewerProps & { content: string }) {
  const sections = parseSections(content)
  const total = 2 + sections.length
  const [slide, setSlide] = useState(0)
  const prev = () => setSlide(s => Math.max(0, s - 1))
  const next = () => setSlide(s => Math.min(total - 1, s + 1))

  const Cover = (
    <div className="absolute inset-0 bg-[#1b2a3a] text-[#f3ede4] flex flex-col overflow-hidden"
      style={{ padding: "7cqw" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "3cqw", marginBottom: "6cqw" }}>
        <div style={{ height: "1px", flex: 1, background: "#e3b892", opacity: 0.3 }} />
        <span style={{ fontSize: "2.5cqw", letterSpacing: "0.4em", color: "#e3b892", fontWeight: 700 }}>AI 명리학 사주풀이</span>
        <div style={{ height: "1px", flex: 1, background: "#e3b892", opacity: 0.3 }} />
      </div>
      <p style={{ fontSize: "3.2cqw", color: "#9ea3ab", marginBottom: "1cqw" }}>{readingName}</p>
      <h1 style={{ fontSize: "7.5cqw", lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: "1.5cqw" }}
        className="font-serif font-black">{userName}의 사주</h1>
      <p style={{ fontSize: "2.8cqw", color: "#9ea3ab", marginBottom: "5cqw" }}>{birthInfo}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "2cqw", marginBottom: "4cqw" }}>
        {pillars.map(({ label, stem, branch, element, branchEl, me }) => (
          <div key={label} style={{ padding: "2.5cqw 0", borderRadius: "2.5cqw", textAlign: "center", border: `1px solid ${me ? "#e3b892" : "rgba(243,237,228,0.12)"}`, background: me ? "rgba(227,184,146,0.08)" : "transparent" }}>
            <span style={{ display: "block", fontSize: "2.2cqw", color: "#9ea3ab", letterSpacing: "0.1em", marginBottom: "1cqw" }}>{label}</span>
            <span style={{ display: "block", fontSize: "6.5cqw", color: EL_COLOR[element] || "#f3ede4", fontFamily: "serif", fontWeight: 700, lineHeight: 1, marginBottom: "0.5cqw" }}>{stem}</span>
            <span style={{ display: "block", fontSize: "6.5cqw", color: EL_COLOR[branchEl] || "#e9e2d6", fontFamily: "serif", fontWeight: 700, lineHeight: 1 }}>{branch}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "3.5cqw", marginBottom: "auto" }}>
        {fiveElements.map(({ el, count }) => (
          <div key={el} style={{ display: "flex", alignItems: "center", gap: "1.5cqw" }}>
            <span style={{ width: "5.5cqw", height: "5.5cqw", fontSize: "2.5cqw", background: `${EL_COLOR[el]}22`, color: EL_COLOR[el], borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{el}</span>
            <span style={{ fontSize: "2.8cqw", color: "#9ea3ab" }}>{count}</span>
          </div>
        ))}
      </div>
      <div style={{ borderTop: "1px solid rgba(243,237,228,0.1)", paddingTop: "3cqw", marginTop: "3cqw", display: "flex", justifyContent: "space-between", fontSize: "2.8cqw", color: "#9ea3ab" }}>
        <span>{createdAt}</span>
        <button onClick={next} style={{ color: "#e3b892", fontWeight: 700 }}>목차 보기 →</button>
      </div>
    </div>
  )

  const Toc = (
    <div className="absolute inset-0 bg-[#faf8f4] flex flex-col overflow-hidden"
      style={{ padding: "6cqw 6cqw 5cqw" }}>
      <div style={{ marginBottom: "4cqw" }}>
        <span style={{ fontSize: "2.5cqw", color: "#a5603f", letterSpacing: "0.3em", fontWeight: 700 }}>차례</span>
        <h2 style={{ fontSize: "7cqw", lineHeight: 1.1, marginTop: "1.5cqw" }} className="font-serif font-black text-[#1b2a3a]">목차</h2>
        <div style={{ marginTop: "3cqw", height: "1px", background: "#e4ddd3" }} />
      </div>
      <div className="flex-1 overflow-y-auto" style={{ display: "flex", flexDirection: "column", gap: "1.5cqw" }}>
        {sections.map((s, i) => (
          <button key={i} onClick={() => setSlide(i + 2)}
            style={{ padding: "2.5cqw 3.5cqw", borderRadius: "2cqw", display: "flex", alignItems: "center", gap: "3cqw", width: "100%", textAlign: "left", background: "#fff", border: "1px solid #e4ddd3", cursor: "pointer" }}
            className="hover:border-[#1b2a3a] transition-colors">
            <span style={{ fontSize: "4cqw", width: "5cqw", textAlign: "center", color: "#a5603f", fontFamily: "serif", fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
            <p style={{ fontSize: "3.5cqw", fontWeight: 600, color: "#1b2a3a", flex: 1, lineHeight: 1.3 }}>{s.title}</p>
            <span style={{ fontSize: "3.5cqw", color: "#c8bfb0", flexShrink: 0 }}>→</span>
          </button>
        ))}
      </div>
    </div>
  )

  const SectionCard = ({ section, idx }: { section: Section; idx: number }) => (
    <div className="absolute inset-0 bg-[#faf8f4] flex flex-col overflow-hidden">
      <div style={{ height: "1.1cqw", background: "#1b2a3a", flexShrink: 0 }} />
      <div style={{ padding: "4cqw 6cqw 3cqw", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "2.5cqw", color: "#9ea3ab", marginBottom: "2cqw" }}>
          <span>{userName}의 사주</span>
          <span>{idx + 1} / {sections.length}</span>
        </div>
        <h2 style={{ fontSize: "5.2cqw", lineHeight: 1.3 }} className="font-serif font-bold text-[#1b2a3a]">{section.title}</h2>
      </div>
      <div style={{ height: "1px", background: "#e4ddd3", flexShrink: 0, margin: "0 6cqw" }} />
      <div className="flex-1 overflow-y-auto" style={{ padding: "3.5cqw 6cqw" }}>
        <div className="[&_p]:text-[#374151] [&_p]:text-sm [&_p]:leading-[1.9] [&_p]:mb-4 [&_strong]:text-[#a5603f] [&_strong]:font-semibold [&_ul]:pl-4 [&_ul]:space-y-1.5 [&_ul]:mb-4 [&_li]:text-sm [&_li]:text-[#374151] [&_li]:leading-7 [&_li]:list-disc [&_h3]:font-serif [&_h3]:text-[#1b2a3a] [&_h3]:font-bold [&_h3]:text-sm [&_h3]:mt-5 [&_h3]:mb-2">
          <ReactMarkdown>{section.content}</ReactMarkdown>
        </div>
      </div>
      {idx < sections.length - 1 && (
        <div style={{ padding: "3cqw 6cqw", borderTop: "1px solid #e4ddd3", flexShrink: 0 }}>
          <p style={{ fontSize: "2.8cqw", color: "#9ea3ab" }}>다음 → {sections[idx + 1].title}</p>
        </div>
      )}
    </div>
  )

  const renderSlide = () => {
    if (slide === 0) return Cover
    if (slide === 1) return Toc
    return <SectionCard section={sections[slide - 2]} idx={slide - 2} />
  }

  // 구버전 탭: 커버 + 각 섹션
  const legacyTabs = [
    { label: "커버", firstIdx: 0, lastIdx: 1 },
    ...sections.map((s, i) => ({ label: s.title, firstIdx: i + 2, lastIdx: i + 2 })),
  ]
  const activeLegacyTab = legacyTabs.findIndex(t => slide >= t.firstIdx && slide <= t.lastIdx)

  return (
    <div className="min-h-screen bg-[#ece7df] flex flex-col">
      <style>{STYLES}</style>
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#e4ddd3] bg-[#ece7df] flex-none">
        <span className="text-sm font-bold text-[#1b2a3a] truncate max-w-[55%]">{userName}의 사주</span>
        <div className="flex gap-2">
          <Link href="/my-readings" className="text-xs border border-[#e4ddd3] bg-white text-[#1b2a3a] rounded-full px-3 py-1.5 font-medium hover:border-[#1b2a3a] transition-colors">내 풀이</Link>
          <Link href={`/input?type=${readingType}`} className="text-xs border border-[#e4ddd3] bg-white text-[#1b2a3a] rounded-full px-3 py-1.5 font-medium hover:border-[#1b2a3a] transition-colors">새 풀이</Link>
        </div>
      </div>
      {/* 탭 네비게이션 */}
      <div className="flex-none bg-[#ece7df] border-b border-[#e4ddd3] overflow-x-auto no-sb">
        <div className="flex px-4" style={{ gap: 0, minWidth: "max-content" }}>
          {legacyTabs.map((t, i) => (
            <button key={i} onClick={() => setSlide(t.firstIdx)} className="transition-colors"
              style={{ fontSize: "12px", fontWeight: i === activeLegacyTab ? 700 : 400, color: i === activeLegacyTab ? "#1b2a3a" : "#9ea3ab", borderBottom: i === activeLegacyTab ? "2px solid #1b2a3a" : "2px solid transparent", padding: "8px 12px", whiteSpace: "nowrap", background: "transparent", cursor: "pointer" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center px-10 py-4 relative">
        <button onClick={prev} disabled={slide === 0} className="absolute left-2 z-10 w-9 h-9 rounded-full border border-[#e4ddd3] bg-white text-[#1b2a3a] flex items-center justify-center text-xl shadow-sm disabled:opacity-20 hover:border-[#1b2a3a] transition-colors">‹</button>
        <div className="relative w-full max-w-sm" style={{ aspectRatio: "14/19" }}>
          <div key={slide} className="si hide-sb relative w-full h-full rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.06),0_12px_40px_rgba(27,42,58,0.14)] overflow-hidden"
            style={{ containerType: "inline-size" } as React.CSSProperties}>
            {renderSlide()}
          </div>
        </div>
        <button onClick={next} disabled={slide === total - 1} className="absolute right-2 z-10 w-9 h-9 rounded-full border border-[#e4ddd3] bg-white text-[#1b2a3a] flex items-center justify-center text-xl shadow-sm disabled:opacity-20 hover:border-[#1b2a3a] transition-colors">›</button>
      </div>
      <div className="flex items-center justify-center gap-3 pb-6 pt-1 flex-none">
        <div className="w-52 h-1 bg-[#d8d0c3] rounded-full overflow-hidden">
          <div className="h-full bg-[#1b2a3a] rounded-full transition-all duration-300" style={{ width: `${((slide + 1) / total) * 100}%` }} />
        </div>
        <span className="text-xs text-[#9ea3ab] tabular-nums">{slide + 1} / {total}</span>
      </div>
    </div>
  )
}
