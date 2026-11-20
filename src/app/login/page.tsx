"use client"

import { signIn } from "next-auth/react"
import Link from "next/link"

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-[340px]">
        {/* 로고 영역 */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="h-px w-10 bg-[#a5603f] opacity-50" />
            <span className="text-[9px] tracking-[0.4em] text-[#a5603f] font-semibold">사주풀이</span>
            <div className="h-px w-10 bg-[#a5603f] opacity-50" />
          </div>
          <h1 className="font-serif font-black text-[#1b2a3a] text-3xl tracking-tight mb-2">
            시작하기
          </h1>
          <p className="text-sm text-[#6b7280] leading-relaxed">
            구글 계정으로 간편하게<br />로그인하고 풀이를 시작하세요
          </p>
        </div>

        {/* 카드 */}
        <div className="bg-[#faf8f4] rounded-2xl border border-[#e4ddd3] shadow-[0_2px_4px_rgba(0,0,0,0.04),_0_12px_40px_rgba(27,42,58,0.10)] p-7">
          <button
            onClick={() => signIn("google", { callbackUrl: "/input" })}
            className="w-full flex items-center justify-center gap-3 bg-white text-[#374151] py-3.5 rounded-xl font-semibold text-sm border border-[#e4ddd3] hover:bg-[#f9f9f9] active:scale-[0.98] transition-all shadow-sm"
          >
            {/* Google G 로고 */}
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              <path fill="none" d="M0 0h48v48H0z"/>
            </svg>
            Google로 계속하기
          </button>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[#e4ddd3]" />
            <span className="text-[11px] text-[#b9b2a6]">또는</span>
            <div className="flex-1 h-px bg-[#e4ddd3]" />
          </div>

          {/* 안내 텍스트 */}
          <div className="bg-[#f5f1eb] rounded-xl p-4 text-[11px] text-[#9ea3ab] leading-5 space-y-1">
            <p>✦ 구글 계정 외 별도 가입 불필요</p>
            <p>✦ 개인정보는 풀이 목적으로만 사용</p>
            <p>✦ 결제 후 즉시 풀이 열람 가능</p>
          </div>
        </div>

        {/* 약관 */}
        <p className="text-center text-[10px] text-[#b9b2a6] mt-5 leading-5">
          로그인 시{" "}
          <span className="underline underline-offset-2">이용약관</span> 및{" "}
          <span className="underline underline-offset-2">개인정보처리방침</span>에 동의합니다
        </p>

        <Link href="/" className="block text-center text-[11px] text-[#9ea3ab] mt-4 hover:text-[#a5603f] transition-colors">
          ← 처음으로
        </Link>
      </div>
    </main>
  )
}
