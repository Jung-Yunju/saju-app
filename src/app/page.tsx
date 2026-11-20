import Link from "next/link"
import { connection } from "next/server"
import { auth } from "@/lib/auth"

export const instant = false

const READINGS = [
  {
    type: "BASIC",
    emoji: "🔮",
    title: "나는 어떤 사람인가",
    desc: "타고난 성격·기질·운명을\n사주팔자로 깊이 풀어드려요",
    color: "#1b2a3a",
  },
  {
    type: "MONEY",
    emoji: "💸",
    title: "나는 왜 돈이 안 모일까",
    desc: "재물운·직업운 분석으로\n돈이 새는 이유를 찾아드려요",
    color: "#7a5c2e",
  },
  {
    type: "LOVE",
    emoji: "💔",
    title: "나는 왜 연애가 안 될까",
    desc: "연애운·이상형·반복 패턴을\n사주로 솔직하게 풀어드려요",
    color: "#8b2e2e",
  },
  {
    type: "CAREER",
    emoji: "😤",
    title: "나는 왜 직장이 맨날 안 맞을까",
    desc: "직업 적성·조직 궁합·이직 시기를\n사주로 짚어드려요",
    color: "#2e5e3e",
  },
  {
    type: "BULLY",
    emoji: "😠",
    title: "이 사람은 왜 나를 괴롭힐까",
    desc: "두 사람의 사주를 비교해\n갈등의 근본 원인을 찾아드려요",
    color: "#4a2e6e",
    twoPersons: true,
  },
  {
    type: "CONFLICT",
    emoji: "⚡",
    title: "우리는 왜 맨날 싸울까",
    desc: "두 사람의 사주 충돌 포인트를\n분석해 해결책을 드려요",
    color: "#1a4a6e",
    twoPersons: true,
  },
]

export default async function Home() {
  await connection()
  const session = await auth()

  return (
    <main className="min-h-screen bg-[#ece7df]">
      {/* 헤더 */}
      <nav className="flex items-center justify-between px-6 py-4 bg-[#ece7df] border-b border-[#e4ddd3]">
        <span className="font-serif font-black text-[#1b2a3a] tracking-tight">복자할미 사주풀이</span>
        {session ? (
          <div className="flex items-center gap-3">
            <Link href="/my-readings" className="text-xs font-semibold text-[#a5603f] hover:underline">
              내 풀이
            </Link>
            <span className="text-xs text-[#6b7280]">{session.user?.name}</span>
          </div>
        ) : (
          <Link href="/login" className="text-xs font-semibold text-[#a5603f] hover:underline">
            로그인
          </Link>
        )}
      </nav>

      {/* 히어로 */}
      <section className="text-center px-5 pt-12 pb-8">
        <div className="flex items-center justify-center gap-3 mb-5">
          <div className="h-px w-10 bg-[#a5603f] opacity-50" />
          <span className="text-[9px] tracking-[0.4em] text-[#a5603f] font-semibold">AI 명리학 사주풀이</span>
          <div className="h-px w-10 bg-[#a5603f] opacity-50" />
        </div>
        <h1 className="font-serif font-black text-[#1b2a3a] text-4xl leading-tight tracking-tight mb-3">
          내 사주가 이래서<br />그랬구나
        </h1>
        <p className="text-sm text-[#6b7280] leading-7">
          60년 경력 할머니 선생님이 사주팔자로<br />
          당신의 이야기를 풀어드립니다
        </p>
      </section>

      {/* 풀이 카드 목록 */}
      <section className="px-4 pb-12 max-w-lg mx-auto">
        <div className="space-y-3">
          {READINGS.map(({ type, emoji, title, desc, color, twoPersons }) => (
            <Link
              key={type}
              href={session ? `/input?type=${type}` : "/login"}
              className="block bg-[#faf8f4] rounded-2xl border border-[#e4ddd3] shadow-sm hover:shadow-md active:scale-[0.99] transition-all overflow-hidden"
            >
              <div className="flex items-center gap-4 p-5">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: `${color}18` }}
                >
                  {emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-[#1b2a3a] text-sm leading-tight">{title}</p>
                    {twoPersons && (
                      <span className="text-[9px] bg-[#e4ddd3] text-[#6b7280] px-1.5 py-0.5 rounded-full whitespace-nowrap">2인</span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#9ea3ab] leading-5 whitespace-pre-line">{desc}</p>
                </div>
                <span className="text-[#c8bfb0] text-sm flex-shrink-0">→</span>
              </div>
            </Link>
          ))}
        </div>

        <p className="text-center text-[11px] text-[#b9b2a6] mt-6">
          각 풀이는 약 2~3분 소요 · AI가 직접 작성
        </p>
      </section>

      {/* 푸터 */}
      <footer className="text-center py-5 text-[10px] text-[#b9b2a6] border-t border-[#e4ddd3] bg-[#faf8f4]">
        © 2026 복자할미 사주풀이
      </footer>
    </main>
  )
}
