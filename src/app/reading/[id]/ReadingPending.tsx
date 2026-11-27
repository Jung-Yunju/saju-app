"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

// 서버 상태: PENDING(아직 시작 안 함) · GENERATING(생성 중) · FAILED(실패)
// - PENDING일 때만 화면이 열리면서 생성을 1번 요청한다(useRef로 중복 방지 — 새로고침·StrictMode 대비).
// - GENERATING이면 생성 요청 없이 상태만 확인한다(다른 탭·이전 요청이 만들고 있음).
// - FAILED면 "다시 시도" 버튼으로만 생성을 다시 요청한다.
type Phase = "PENDING" | "GENERATING" | "FAILED"

function toPhase(status: string): Phase {
  if (status === "GENERATING") return "GENERATING"
  if (status === "FAILED") return "FAILED"
  return "PENDING"
}

export default function ReadingPending({
  readingId,
  status,
}: {
  readingId: string
  status: string
}) {
  const router = useRouter()
  const [dots, setDots] = useState(".")
  const [phase, setPhase] = useState<Phase>(() => toPhase(status))
  const [errorMsg, setErrorMsg] = useState("")
  const requestingRef = useRef(false)
  const autoStartedRef = useRef(false)

  const requestGeneration = useCallback(async () => {
    if (requestingRef.current) return
    requestingRef.current = true
    try {
      const res = await fetch(`/api/reading/${readingId}/generate`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.status === "COMPLETE") {
        router.refresh()
      } else if (res.status === 202) {
        // 다른 요청이 생성 중 → 폴링이 이어서 확인
      } else if (!res.ok) {
        setErrorMsg(typeof data.error === "string" ? data.error : "")
        setPhase("FAILED")
      }
    } catch {
      // 네트워크가 끊겨도 서버에서는 계속 만들고 있을 수 있다 → 폴링이 결과를 확인
    } finally {
      requestingRef.current = false
    }
  }, [readingId, router])

  // 처음 열렸을 때 PENDING이면 한 번만 생성 요청
  useEffect(() => {
    if (autoStartedRef.current || toPhase(status) !== "PENDING") return
    autoStartedRef.current = true
    void requestGeneration()
  }, [status, requestGeneration])

  // 생성 중에는 점 애니메이션 + 3초마다 상태 확인
  useEffect(() => {
    if (phase === "FAILED") return

    const dotTimer = setInterval(() => {
      setDots(d => d.length >= 3 ? "." : d + ".")
    }, 600)

    const pollTimer = setInterval(async () => {
      try {
        const res = await fetch(`/api/reading/${readingId}/status`)
        const data = await res.json()
        if (data.status === "COMPLETE") {
          router.refresh()
        } else if (data.status === "FAILED" && !requestingRef.current) {
          setPhase("FAILED")
        }
      } catch {}
    }, 3000)

    return () => {
      clearInterval(dotTimer)
      clearInterval(pollTimer)
    }
  }, [readingId, router, phase])

  const handleRetry = () => {
    setErrorMsg("")
    setPhase("GENERATING")
    void requestGeneration()
  }

  if (phase === "FAILED") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-5">
        <div className="text-center">
          <div className="text-4xl mb-4">😔</div>
          <p className="text-[#1b2a3a] font-semibold mb-2">풀이 생성에 실패했습니다</p>
          <p className="text-sm text-[#6b7280] mb-6">
            {errorMsg || "서버가 바쁩니다. 잠시 후 다시 시도해 주세요."}
          </p>
          <button
            onClick={handleRetry}
            className="bg-[#1b2a3a] text-white px-6 py-3 rounded-xl text-sm font-semibold"
          >
            다시 시도
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5">
      <div className="text-center">
        <div className="text-5xl mb-6">🔮</div>
        <p className="text-[#1b2a3a] font-semibold text-lg mb-2">
          복자할미가 풀이 중{dots}
        </p>
        <p className="text-sm text-[#6b7280]">1분 정도 걸려요. 창을 닫지 마세요.</p>
        <div className="mt-8 flex gap-1.5 justify-center">
          {[0,1,2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-[#a5603f] opacity-70 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </main>
  )
}
