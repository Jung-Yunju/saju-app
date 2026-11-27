import type { Metadata } from "next"
import "../../../design/tokens.css"
import "./free.css"
import { fontClassName } from "./fonts"
import { BRAND, THEME_DEFAULT } from "./theme"

// 링크 미리보기 이미지의 절대 주소 기준. 운영 주소는 배포 환경 변수(NEXT_PUBLIC_SITE_URL)로 넣는다 — 없으면 로컬 주소.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001"

export const metadata: Metadata = { metadataBase: new URL(SITE_URL) }

// 디자인 토큰(시안 A/B)은 이 래퍼 안에서만 적용된다. 사이트 전체 브랜드는 아직 미결정.
export default function FreeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`fr-root ${fontClassName}`} data-brand={BRAND} data-theme={THEME_DEFAULT}>
      {children}
    </div>
  )
}
