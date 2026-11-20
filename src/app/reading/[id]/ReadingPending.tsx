"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function ReadingPending({
  readingId,
  status,
}: {
  readingId: string
  status: string
}) {
  const router = useRouter()
  const [dots, setDots] = useState(".")
  const failed = status === "FAILED"

  useEffect(() => {
    if (failed) return

    // 클라이언트에서 AI 생성 트리거 (서버는 응답 없이도 60초간 계속 실행)
    fetch(`/api/reading/${readingId}/generate`, { method: "POST" }).catch(() => {})

    const dotTimer = setInterval(() => {
      setDots(d => d.length >= 3 ? "." : d + ".")
    }, 600)

    const pollTimer = setInterval(async () => {
      try {
        const res = await fetch(`/api/reading/${readingId}/status`)
        const data = await res.json()
        if (data.status === "COMPLETE" || data.status === "FAILED") {
          router.refresh()
        }
      } catch {}
    }, 3000)

    return () => {
      clearInterval(dotTimer)
      clearInterval(pollTimer)
    }
  }, [readingId, router, failed])

  if (failed) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-5">
        <div className="text-center">
          <div className="text-4xl mb-4">😔</div>
          <p className="text-[#1b2a3a] font-semibold mb-2">풀이 생성에 실패했습니다</p>
          <p className="text-sm text-[#6b7280] mb-6">서버가 바쁩니다. 잠시 후 다시 시도해 주세요.</p>
          <button
            onClick={() => router.push("/input")}
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
