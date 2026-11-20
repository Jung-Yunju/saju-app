import { redirect } from "next/navigation"
import { connection } from "next/server"
import { auth } from "@/lib/auth"

export const instant = false
import { prisma } from "@/lib/prisma"
import Link from "next/link"

const READING_META: Record<string, { title: string; emoji: string }> = {
  BASIC:    { title: "나는 어떤 사람인가",         emoji: "🔮" },
  MONEY:    { title: "나는 왜 돈이 안 모일까",      emoji: "💸" },
  LOVE:     { title: "나는 왜 연애가 안 될까",      emoji: "💔" },
  CAREER:   { title: "나는 왜 직장이 안 맞을까",    emoji: "😤" },
  BULLY:    { title: "이 사람은 왜 나를 괴롭힐까",  emoji: "😠" },
  CONFLICT: { title: "우리는 왜 맨날 싸울까",       emoji: "⚡" },
}

export default async function MyReadingsPage() {
  await connection()
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const readings = await prisma.reading.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  })

  return (
    <main className="min-h-screen bg-[#ece7df]">
      {/* 헤더 */}
      <nav className="flex items-center justify-between px-6 py-4 bg-[#ece7df] border-b border-[#e4ddd3]">
        <Link href="/" className="font-serif font-black text-[#1b2a3a] tracking-tight">복자할미 사주풀이</Link>
        <span className="text-xs text-[#6b7280]">{session.user?.name}</span>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-10">
        {/* 타이틀 */}
        <div className="mb-7">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px w-8 bg-[#a5603f] opacity-50" />
            <span className="text-[9px] tracking-[0.4em] text-[#a5603f] font-semibold">내 풀이 기록</span>
          </div>
          <h1 className="font-serif font-black text-[#1b2a3a] text-2xl tracking-tight">
            내가 받은 풀이
          </h1>
          <p className="text-sm text-[#6b7280] mt-1">총 {readings.length}건</p>
        </div>

        {readings.length === 0 ? (
          <div className="bg-[#faf8f4] rounded-2xl border border-[#e4ddd3] p-10 text-center">
            <p className="text-3xl mb-3">🔮</p>
            <p className="text-sm text-[#6b7280] mb-5">아직 받은 풀이가 없어요</p>
            <Link href="/"
              className="inline-block bg-[#1b2a3a] text-[#f3ede4] px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#2a3f55] transition-colors">
              첫 풀이 받기 →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {readings.map(r => {
              const meta = READING_META[r.readingType] || { title: "사주풀이", emoji: "🔮" }
              const calStr = r.calType === "SOLAR" ? "양력" : "음력"
              const hourStr = r.birthHour !== null ? ` ${r.birthHour}시` : ""
              const birthInfo = `${calStr} ${r.birthYear}.${r.birthMonth}.${r.birthDay}${hourStr} · ${r.gender === "M" ? "남" : "여"}`
              const dateStr = new Date(r.createdAt).toLocaleDateString("ko-KR", {
                year: "numeric", month: "long", day: "numeric",
              })
              return (
                <Link key={r.id} href={`/reading/${r.id}`}
                  className="block bg-[#faf8f4] rounded-2xl border border-[#e4ddd3] shadow-sm hover:shadow-md active:scale-[0.99] transition-all overflow-hidden">
                  <div className="flex items-center gap-4 p-5">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl bg-[#1b2a3a1a] flex-shrink-0">
                      {meta.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#1b2a3a] text-sm leading-tight mb-0.5">{meta.title}</p>
                      <p className="text-[11px] text-[#9ea3ab]">{birthInfo}</p>
                      <p className="text-[10px] text-[#b9b2a6] mt-0.5">{dateStr}</p>
                    </div>
                    <span className="text-[#c8bfb0] text-sm flex-shrink-0">→</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        <div className="mt-8 text-center">
          <Link href="/"
            className="inline-block bg-[#1b2a3a] text-[#f3ede4] px-6 py-3 rounded-xl text-sm font-semibold hover:bg-[#2a3f55] transition-colors">
            새 풀이 받기 →
          </Link>
        </div>
      </div>
    </main>
  )
}
