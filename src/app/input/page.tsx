"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { BirthCard } from "./birth-card"
import { buildRequest, emptyForm, type BirthForm } from "./build-request"

const READING_LABELS: Record<string, { title: string; emoji: string; twoPersons?: boolean }> = {
  BASIC:    { title: "나는 어떤 사람인가", emoji: "🔮" },
  MONEY:    { title: "나는 왜 돈이 안 모일까", emoji: "💸" },
  LOVE:     { title: "나는 왜 연애가 안 될까", emoji: "💔" },
  CAREER:   { title: "나는 왜 직장이 안 맞을까", emoji: "😤" },
  BULLY:    { title: "이 사람은 왜 나를 괴롭힐까", emoji: "😠", twoPersons: true },
  CONFLICT: { title: "우리는 왜 맨날 싸울까", emoji: "⚡", twoPersons: true },
}

function InputPageInner() {
  const router = useRouter()
  const params = useSearchParams()
  const type = params.get("type") || "BASIC"
  const meta = READING_LABELS[type] || READING_LABELS.BASIC
  const isTwoPerson = !!meta.twoPersons

  const [me, setMe] = useState<BirthForm>(emptyForm())
  const [other, setOther] = useState<BirthForm>(emptyForm())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const setField = (setter: typeof setMe) => <K extends keyof BirthForm>(key: K, val: BirthForm[K]) =>
    setter(f => ({ ...f, [key]: val }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const built = buildRequest(type, me, isTwoPerson ? other : null)
    if ("error" in built) { setError(built.error); return }

    setLoading(true)
    try {
      const body = built.body

      const res = await fetch("/api/reading/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "오류가 발생했습니다."); return }

      router.push(`/reading/${data.readingId}`)
    } catch (err) {
      console.error("풀이 요청 오류:", err)
      const msg = err instanceof Error ? err.message : String(err)
      setError(`오류: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 py-14">
      <div className="w-full max-w-[380px]">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="h-px w-10 bg-[#a5603f] opacity-50" />
            <span className="text-[9px] tracking-[0.4em] text-[#a5603f] font-semibold">사주풀이</span>
            <div className="h-px w-10 bg-[#a5603f] opacity-50" />
          </div>
          <div className="text-3xl mb-2">{meta.emoji}</div>
          <h1 className="font-serif font-black text-[#1b2a3a] text-2xl tracking-tight mb-2">
            {meta.title}
          </h1>
          <p className="text-sm text-[#6b7280]">정확할수록 풀이가 더 깊어집니다</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 내 정보 */}
          <BirthCard
            title={isTwoPerson ? "나의 생년월일" : "생년월일"}
            form={me}
            setField={setField(setMe)}
          />

          {/* 상대방 정보 (2인 풀이) */}
          {isTwoPerson && (
            <BirthCard
              title="상대방의 생년월일"
              form={other}
              setField={setField(setOther)}
              accent
            />
          )}

          {error && (
            <div className="bg-[#fff5f5] border border-red-100 rounded-xl px-4 py-3 text-sm text-[#c9553d]">
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full bg-[#1b2a3a] text-[#f3ede4] py-4 rounded-xl font-semibold text-sm hover:bg-[#2a3f55] active:scale-[0.98] transition-all disabled:opacity-40"
          >
            {loading ? "잠시만요…" : "풀이 받기 →"}
          </button>
        </form>

        <Link href="/" className="block text-center text-[11px] text-[#9ea3ab] mt-5 hover:text-[#a5603f] transition-colors">
          ← 처음으로
        </Link>
      </div>
    </main>
  )
}

export default function InputPage() {
  return (
    <Suspense>
      <InputPageInner />
    </Suspense>
  )
}
