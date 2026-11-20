"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { Claim } from "@/lib/generate-reading-v2"

type Answer = "맞다" | "아니다" | "모름"

const ANSWER_OPTS: { v: Answer; label: string; color: string; bg: string }[] = [
  { v: "맞다",  label: "맞아요",  color: "#2a6e3f", bg: "#e8f5ec" },
  { v: "모름",  label: "잘 모름", color: "#6b5c3a", bg: "#f5f0e8" },
  { v: "아니다", label: "아니에요", color: "#8b2e2e", bg: "#f5e8e8" },
]

export default function VerifyClient({
  readingId, coverTitle, chartSummary, claims, userName,
}: {
  readingId: string
  coverTitle: string
  chartSummary: string
  claims: Claim[]
  userName: string
}) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const allAnswered = claims.every(c => answers[c.id])
  const answered = Object.keys(answers).length

  const handleSubmit = async () => {
    if (!allAnswered) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/reading/${readingId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "오류가 발생했습니다."); return }
      router.push(`/reading/${data.readingId}`)
    } catch {
      setError("서버 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#ece7df]">
      {/* 상단 바 */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#e4ddd3] bg-[#ece7df]">
        <span className="font-serif font-black text-[#1b2a3a] tracking-tight text-sm">복자할미 사주풀이</span>
        <span className="text-xs text-[#9ea3ab]">{answered}/{claims.length} 답함</span>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">
        {/* 타이틀 */}
        <div className="mb-7">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px w-6 bg-[#a5603f] opacity-50" />
            <span className="text-[9px] tracking-[0.4em] text-[#a5603f] font-semibold">1단계 · 지나온 길 확인</span>
          </div>
          <h1 className="font-serif font-black text-[#1b2a3a] text-2xl tracking-tight leading-snug mb-2">
            {coverTitle || `${userName}의 사주`}
          </h1>
          <p className="text-sm text-[#6b7280] leading-7">{chartSummary}</p>
        </div>

        {/* 안내 */}
        <div className="bg-[#faf8f4] border border-[#e4ddd3] rounded-2xl px-5 py-4 mb-6">
          <p className="text-xs text-[#6b7280] leading-6">
            할머니가 사주를 보고 지나온 일들을 짚어봤어요.<br />
            각 항목에 <b className="text-[#2a6e3f]">맞아요 / 아니에요 / 잘 모름</b>으로 답해 주세요.<br />
            답변이 많을수록 풀이가 더 정확해져요.
          </p>
        </div>

        {/* 단정 목록 */}
        <div className="space-y-4 mb-8">
          {claims.map((claim, i) => {
            const ans = answers[claim.id]
            const isHourTest = claim.is_hour_test
            return (
              <div key={claim.id}
                className={`bg-[#faf8f4] rounded-2xl border overflow-hidden transition-all ${
                  ans ? "border-[#1b2a3a]" : "border-[#e4ddd3]"
                }`}>
                <div className="px-5 pt-4 pb-3">
                  {/* 헤더 */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-serif font-bold text-[#a5603f] text-sm w-5">{i + 1}</span>
                    <span className="text-[10px] text-[#9ea3ab] bg-[#f0ebe3] px-2 py-0.5 rounded-full">{claim.when}</span>
                    {isHourTest && (
                      <span className="text-[9px] text-[#a5603f] bg-[#f5e8d8] px-2 py-0.5 rounded-full">시주 확인</span>
                    )}
                  </div>
                  {/* 단정 */}
                  <p className="text-sm font-semibold text-[#1b2a3a] leading-6 mb-1">{claim.claim}</p>
                  <p className="text-[11px] text-[#9ea3ab] leading-5">{claim.basis}</p>
                  {claim.era && (
                    <p className="text-[10px] text-[#b9b2a6] mt-1 leading-5 italic">그때 세상은 → {claim.era}</p>
                  )}
                </div>

                {/* 답변 버튼 */}
                <div className="flex border-t border-[#e4ddd3]">
                  {ANSWER_OPTS.map(opt => (
                    <button key={opt.v}
                      onClick={() => setAnswers(a => ({ ...a, [claim.id]: opt.v }))}
                      className="flex-1 py-2.5 text-xs font-semibold transition-all"
                      style={ans === opt.v ? { background: opt.bg, color: opt.color } : { color: "#9ea3ab" }}>
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* 답변 후 판정 */}
                {ans && (
                  <div className="px-5 py-2.5 bg-[#f8f5f0] border-t border-[#e4ddd3]">
                    <p className="text-[11px] leading-5"
                      style={{ color: ans === "맞다" ? "#2a6e3f" : ans === "아니다" ? "#8b2e2e" : "#6b5c3a" }}>
                      {ans === "맞다" ? claim.if_yes : ans === "아니다" ? claim.if_no : "참고만 해요."}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 에러 */}
        {error && <p className="text-sm text-red-500 text-center mb-4">{error}</p>}

        {/* 제출 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={!allAnswered || loading}
          className="w-full py-4 rounded-2xl text-sm font-bold transition-all"
          style={allAnswered && !loading
            ? { background: "#1b2a3a", color: "#f3ede4" }
            : { background: "#d8d0c3", color: "#9ea3ab" }}>
          {loading ? "할머니가 풀이 쓰는 중... (1~2분)" : !allAnswered
            ? `${claims.length - answered}개 더 답해 주세요`
            : "본 풀이 받기 →"}
        </button>

        <p className="text-center text-[10px] text-[#b9b2a6] mt-4">
          풀이는 전통 명리 이론에 따른 해석이에요. 병·법·큰돈의 일은 전문가와 함께 보세요.
        </p>
      </div>
    </main>
  )
}
