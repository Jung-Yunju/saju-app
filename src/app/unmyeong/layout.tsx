import type { Metadata } from "next"
import "@/styles/unmyeong.css"
import "@/styles/unmyeong-book.css"
import "./unmyeong-flow.css"
import "./unmyeong-result.css"
import "./unmyeong-stage.css"
import { umFontVariables } from "@/styles/unmyeong-fonts"

export const metadata: Metadata = {
  title: "운명비서 · 할머니가 풀어 주는 사주",
  description: "세상에 단 한 권, 오직 너를 위한 기록.",
  // 점진적 향상(docs/DESIGN_SYSTEM.md 9-5): 지원하는 브라우저는 OS 글꼴 크기를 기본 글자(rem)에 반영하고 자동 글자 확대를 끈다.
  // 모르는 브라우저는 이 meta 를 그냥 무시한다(아무 영향 없음). 이 화면은 모든 크기가 rem·em 이고 큰 글자에서 배치가 바뀌도록 짜여 있다.
  // env(preferred-text-scale) 는 쓰지 않는다 — 브라우저가 이미 페이지 확대로 키운 위에 한 번 더 곱해질 수 있어서.
  other: { "text-scale": "scale" },
}

export default function UnmyeongLayout({ children }: { children: React.ReactNode }) {
  return <div className={`um-root um-flow-root ${umFontVariables}`}>{children}</div>
}
