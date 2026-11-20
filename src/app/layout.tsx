import type { Metadata } from "next"
import { Noto_Serif_KR, Noto_Sans_KR } from "next/font/google"
import "./globals.css"

const notoSerif = Noto_Serif_KR({
  weight: ["400", "600", "700", "900"],
  subsets: ["latin"],
  variable: "--font-serif",
})

const notoSans = Noto_Sans_KR({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-sans",
})

export const metadata: Metadata = {
  title: "사주풀이 · AI 명리학",
  description: "AI가 풀어주는 나만의 사주팔자 풀이",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" className={`${notoSerif.variable} ${notoSans.variable}`}>
      <body className="bg-[#ece7df] font-sans text-[#1b2a3a] min-h-screen">
        {children}
      </body>
    </html>
  )
}
