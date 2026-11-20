"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { Claim } from "@/lib/generate-reading-v2"

type Answer = "맞다" | "아니다" | "모름"

const ANSWER_OPTS: { v: Answer; label: string; color: string; activeBg: string; activeBorder: string }[] = [
  { v: "맞다",   label: "맞아요",   color: "#4adf86", activeBg: "#4adf8618", activeBorder: "#4adf86" },
  { v: "모름",   label: "잘 모름",  color: "#7a7fa8", activeBg: "#7a7fa818", activeBorder: "#7a7fa8" },
  { v: "아니다", label: "아니에요", color: "#f47a7a", activeBg: "#f47a7a18", activeBorder: "#f47a7a" },
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
    <main className="min-h-screen relative overflow-hidden" style={{
      background: "linear-gradient(160deg, #060818 0%, #0d1535 40%, #0a0e28 70%, #06060f 100%)",
    }}>
      {/* 별 배경 */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="stars-layer" />
      </div>

      {/* 상단 글로우 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[200px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse at top, #c9962a1a 0%, transparent 70%)" }} />

      {/* 헤더 */}
      <div className="relative z-10 flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid #c9962a1a" }}>
        <span className="font-serif font-black text-sm tracking-tight" style={{ color: "#d4a847" }}>
          복자할미 사주풀이
        </span>
        <span className="text-xs" style={{ color: "#7a7fa8" }}>
          {answered}/{claims.length} 답함
        </span>
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 py-8">

        {/* 타이틀 */}
        <div className="mb-7">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px w-6" style={{ background: "linear-gradient(to right, transparent, #c9962a88)" }} />
            <span className="text-[9px] tracking-[0.4em] font-semibold" style={{ color: "#c9962a" }}>
              1단계 · 지나온 길 확인
            </span>
          </div>
          <h1 className="font-serif font-black text-2xl tracking-tight leading-snug mb-3" style={{
            background: "linear-gradient(135deg, #f0d060 0%, #d4a847 50%, #c9962a 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            {coverTitle || `${userName}의 사주`}
          </h1>
          <p className="text-sm leading-7" style={{ color: "#8e94bb" }}>{chartSummary}</p>
        </div>

        {/* 안내 */}
        <div className="rounded-2xl px-5 py-4 mb-6" style={{
          background: "linear-gradient(145deg, #0f1640, #090d25)",
          border: "1px solid #c9962a2a",
        }}>
          <p className="text-xs leading-6" style={{ color: "#7a7fa8" }}>
            할머니가 사주를 보고 지나온 일들을 짚어봤어요.<br />
            각 항목에{" "}
            <span style={{ color: "#4adf86", fontWeight: 700 }}>맞아요</span>
            {" / "}
            <span style={{ color: "#f47a7a", fontWeight: 700 }}>아니에요</span>
            {" / "}
            <span style={{ color: "#7a7fa8", fontWeight: 700 }}>잘 모름</span>
            으로 답해 주세요.<br />
            답변이 많을수록 풀이가 더 정확해져요.
          </p>
        </div>

        {/* 단정 목록 */}
        <div className="space-y-4 mb-8">
          {claims.map((claim, i) => {
            const ans = answers[claim.id]
            const isHourTest = claim.is_hour_test
            const activeBorder = ans ? ANSWER_OPTS.find(o => o.v === ans)?.activeBorder || "#c9962a" : "#c9962a1a"
            return (
              <div key={claim.id}
                className="rounded-2xl overflow-hidden transition-all duration-200"
                style={{
                  background: "linear-gradient(145deg, #0f1640, #090d25)",
                  border: `1px solid ${activeBorder}`,
                }}>
                <div className="px-5 pt-4 pb-3">
                  {/* 헤더 */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-serif font-bold text-sm w-5" style={{ color: "#d4a847" }}>{i + 1}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
                      color: "#c9962a", background: "#c9962a18",
                    }}>{claim.when}</span>
                    {isHourTest && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full" style={{
                        color: "#d4a847", background: "#d4a84718",
                      }}>시주 확인</span>
                    )}
                  </div>
                  {/* 단정 */}
                  <p className="text-sm font-semibold leading-6 mb-1" style={{ color: "#e8e2d6" }}>
                    {claim.claim}
                  </p>
                  <p className="text-[11px] leading-5" style={{ color: "#5a6080" }}>{claim.basis}</p>
                  {claim.era && (
                    <p className="text-[10px] mt-1 leading-5 italic" style={{ color: "#4a5070" }}>
                      그때 세상은 → {claim.era}
                    </p>
                  )}
                </div>

                {/* 답변 버튼 */}
                <div className="flex" style={{ borderTop: "1px solid #c9962a1a" }}>
                  {ANSWER_OPTS.map(opt => (
                    <button key={opt.v}
                      onClick={() => setAnswers(a => ({ ...a, [claim.id]: opt.v }))}
                      className="flex-1 py-2.5 text-xs font-semibold transition-all"
                      style={ans === opt.v
                        ? { background: opt.activeBg, color: opt.color }
                        : { color: "#3a4060" }}>
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* 답변 후 판정 */}
                {ans && (
                  <div className="px-5 py-2.5" style={{ borderTop: "1px solid #c9962a1a", background: "#ffffff08" }}>
                    <p className="text-[11px] leading-5"
                      style={{ color: ans === "맞다" ? "#4adf86" : ans === "아니다" ? "#f47a7a" : "#7a7fa8" }}>
                      {ans === "맞다" ? claim.if_yes : ans === "아니다" ? claim.if_no : "참고만 해요."}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 에러 */}
        {error && <p className="text-sm text-center mb-4" style={{ color: "#f47a7a" }}>{error}</p>}

        {/* 제출 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={!allAnswered || loading}
          className="w-full py-4 rounded-2xl text-sm font-bold transition-all"
          style={allAnswered && !loading ? {
            background: "linear-gradient(135deg, #c9962a, #f0d060, #c9962a)",
            color: "#060818",
            boxShadow: "0 4px 20px #c9962a44",
          } : {
            background: "#0d1535",
            color: "#3a4060",
            border: "1px solid #1a2050",
          }}>
          {loading
            ? "할머니가 풀이 쓰는 중... (1~2분)"
            : !allAnswered
              ? `${claims.length - answered}개 더 답해 주세요`
              : "본 풀이 받기 →"}
        </button>

        <p className="text-center text-[10px] mt-4" style={{ color: "#2a2f50" }}>
          풀이는 전통 명리 이론에 따른 해석이에요. 병·법·큰돈의 일은 전문가와 함께 보세요.
        </p>
      </div>

      <style>{`
        .stars-layer {
          position: absolute; inset: 0;
          background-image:
            radial-gradient(1px 1px at 15% 20%, #c9962a88 0%, transparent 100%),
            radial-gradient(1px 1px at 80% 10%, #ffffff55 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 40% 60%, #c9962a55 0%, transparent 100%),
            radial-gradient(1px 1px at 65% 35%, #ffffff33 0%, transparent 100%),
            radial-gradient(1px 1px at 25% 75%, #ffffff22 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 90% 55%, #c9962a33 0%, transparent 100%),
            radial-gradient(1px 1px at 55% 85%, #ffffff44 0%, transparent 100%),
            radial-gradient(1px 1px at 70% 90%, #ffffff33 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 35% 15%, #f0d06055 0%, transparent 100%);
        }
      `}</style>
    </main>
  )
}
