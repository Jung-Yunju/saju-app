import type { Metadata } from "next"
import "@/styles/unmyeong.css"
import "./unmyeong-flow.css"
import "./unmyeong-result.css"
import "./unmyeong-stage.css"
import { umFontVariables } from "@/styles/unmyeong-fonts"

export const metadata: Metadata = {
  title: "운명비서 · 할머니가 풀어 주는 사주",
  description: "세상에 단 한 권, 오직 너를 위한 기록.",
}

export default function UnmyeongLayout({ children }: { children: React.ReactNode }) {
  return <div className={`um-root um-flow-root ${umFontVariables}`}>{children}</div>
}
