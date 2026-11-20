import Link from "next/link"
import { connection } from "next/server"
import { auth } from "@/lib/auth"

export const instant = false

export default async function Home() {
  await connection()
  const session = await auth()

  return (
    <main className="min-h-screen relative overflow-hidden" style={{ background: "linear-gradient(160deg, #060818 0%, #0d1535 40%, #0a0e28 70%, #06060f 100%)" }}>

      {/* 별 배경 */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="stars-layer" />
      </div>

      {/* 상단 금빛 글로우 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none" style={{ background: "radial-gradient(ellipse at top, #c9962a22 0%, transparent 70%)" }} />

      {/* 헤더 */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #c9962a22" }}>
        <span className="font-serif font-black tracking-tight text-sm" style={{ color: "#d4a847" }}>
          복자할미 사주풀이
        </span>
        {session ? (
          <div className="flex items-center gap-4">
            <Link href="/my-readings" className="text-xs font-semibold transition-opacity hover:opacity-70" style={{ color: "#d4a847" }}>
              내 풀이
            </Link>
            <span className="text-xs" style={{ color: "#7a7fa8" }}>{session.user?.name}</span>
          </div>
        ) : (
          <Link href="/login" className="text-xs font-semibold transition-opacity hover:opacity-70" style={{ color: "#d4a847" }}>
            로그인
          </Link>
        )}
      </nav>

      {/* 히어로 */}
      <section className="relative z-10 text-center px-5 pt-14 pb-10">

        {/* 장식 한자 */}
        <div className="mb-6 flex items-center justify-center">
          <span className="text-6xl font-serif leading-none select-none" style={{
            color: "transparent",
            WebkitTextStroke: "1px #c9962a44",
            filter: "drop-shadow(0 0 20px #c9962a44)",
          }}>命</span>
        </div>

        {/* 태그라인 */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="h-px w-8" style={{ background: "linear-gradient(to right, transparent, #c9962a88)" }} />
          <span className="text-[9px] tracking-[0.5em] font-semibold" style={{ color: "#c9962a" }}>AI 명리학 · 사주팔자</span>
          <div className="h-px w-8" style={{ background: "linear-gradient(to left, transparent, #c9962a88)" }} />
        </div>

        <h1 className="font-serif font-black text-4xl leading-tight tracking-tight mb-4" style={{
          background: "linear-gradient(135deg, #f0d060 0%, #d4a847 40%, #f0c060 70%, #c9962a 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          filter: "drop-shadow(0 0 30px #c9962a66)",
        }}>
          내 사주가 이래서<br />그랬구나
        </h1>

        <p className="text-sm leading-7 mt-4" style={{ color: "#8e94bb" }}>
          60년 경력 할머니 선생님이 사주팔자로<br />
          당신의 이야기를 풀어드립니다
        </p>
      </section>

      {/* 메인 카드 */}
      <section className="relative z-10 px-5 pb-16 max-w-sm mx-auto">

        {/* 장식 구분선 */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, transparent, #c9962a44)" }} />
          <span className="text-[10px] tracking-widest" style={{ color: "#c9962a66" }}>✦ ✦ ✦</span>
          <div className="flex-1 h-px" style={{ background: "linear-gradient(to left, transparent, #c9962a44)" }} />
        </div>

        <Link
          href={session ? "/input?type=BASIC" : "/login"}
          className="block relative group"
        >
          {/* 카드 외부 글로우 */}
          <div className="absolute -inset-0.5 rounded-2xl opacity-60 group-hover:opacity-100 transition-opacity" style={{
            background: "linear-gradient(135deg, #c9962a, #f0d060, #c9962a)",
            filter: "blur(8px)",
          }} />

          {/* 카드 본체 */}
          <div className="relative rounded-2xl p-8 text-center overflow-hidden" style={{
            background: "linear-gradient(145deg, #0f1640 0%, #090d25 100%)",
            border: "1px solid #c9962a55",
          }}>
            {/* 카드 내부 상단 글로우 */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 pointer-events-none" style={{
              background: "radial-gradient(ellipse, #c9962a22 0%, transparent 70%)",
            }} />

            {/* 아이콘 */}
            <div className="relative mb-5 inline-flex items-center justify-center w-20 h-20 rounded-full mx-auto" style={{
              background: "linear-gradient(135deg, #1a2050, #0d1535)",
              border: "1px solid #c9962a44",
              boxShadow: "0 0 30px #c9962a33, inset 0 0 20px #c9962a11",
            }}>
              <span className="text-3xl">📜</span>
            </div>

            <p className="text-xs tracking-[0.4em] mb-2 font-semibold" style={{ color: "#c9962a88" }}>DESTINY REPORT</p>
            <h2 className="font-serif font-black text-2xl mb-3 leading-tight" style={{
              background: "linear-gradient(135deg, #f0d060, #d4a847)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              나의 운명 보고서
            </h2>
            <p className="text-sm leading-6 mb-6" style={{ color: "#6e74a0" }}>
              타고난 성격·재물·연애·직업운을<br />사주팔자로 깊이 풀어드려요
            </p>

            {/* CTA 버튼 */}
            <div className="relative inline-flex items-center gap-2 px-8 py-3 rounded-full text-sm font-bold tracking-wide" style={{
              background: "linear-gradient(135deg, #c9962a, #f0d060, #c9962a)",
              color: "#060818",
              boxShadow: "0 4px 20px #c9962a55",
            }}>
              지금 풀이 받기
              <span>→</span>
            </div>
          </div>
        </Link>

        {/* 하단 안내 */}
        <p className="text-center text-[11px] mt-6" style={{ color: "#3d4466" }}>
          약 2~3분 소요 · AI가 직접 작성 · 무료 체험 가능
        </p>

        {/* 장식 구분선 */}
        <div className="flex items-center gap-3 mt-10 mb-6">
          <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, transparent, #c9962a22)" }} />
          <span className="text-[10px]" style={{ color: "#c9962a33" }}>✦</span>
          <div className="flex-1 h-px" style={{ background: "linear-gradient(to left, transparent, #c9962a22)" }} />
        </div>

        {/* 신뢰 지표 */}
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { num: "60년", label: "명리 경력" },
            { num: "AI", label: "정밀 분석" },
            { num: "24시", label: "즉시 발급" },
          ].map(({ num, label }) => (
            <div key={label} className="rounded-xl py-3" style={{ background: "#0d1535", border: "1px solid #c9962a1a" }}>
              <p className="font-black text-base font-serif" style={{ color: "#c9962a" }}>{num}</p>
              <p className="text-[10px] mt-0.5" style={{ color: "#3d4466" }}>{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 푸터 */}
      <footer className="relative z-10 text-center py-5 text-[10px]" style={{ color: "#2a2f50", borderTop: "1px solid #c9962a11" }}>
        © 2026 복자할미 사주풀이
      </footer>

      <style>{`
        .stars-layer {
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(1px 1px at 15% 20%, #c9962a88 0%, transparent 100%),
            radial-gradient(1px 1px at 80% 10%, #ffffff66 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 40% 60%, #c9962a66 0%, transparent 100%),
            radial-gradient(1px 1px at 65% 35%, #ffffff44 0%, transparent 100%),
            radial-gradient(1px 1px at 25% 75%, #ffffff33 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 90% 55%, #c9962a44 0%, transparent 100%),
            radial-gradient(1px 1px at 55% 85%, #ffffff55 0%, transparent 100%),
            radial-gradient(1px 1px at 10% 45%, #c9962a33 0%, transparent 100%),
            radial-gradient(1px 1px at 70% 90%, #ffffff44 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 35% 15%, #f0d06066 0%, transparent 100%),
            radial-gradient(1px 1px at 85% 70%, #ffffff33 0%, transparent 100%),
            radial-gradient(1px 1px at 48% 40%, #c9962a55 0%, transparent 100%);
        }
      `}</style>
    </main>
  )
}
