import type { Metadata } from "next"
import { FREE_DESCRIPTION, FREE_TITLE, SITE_NAME } from "../theme"

/** 무료 화면 메타데이터. stem이 있으면 그 일간의 미리보기 이미지(/free/og?dm=)를 쓴다 */
export function freeMetadata(stem?: string): Metadata {
  const image = stem ? `/free/og?dm=${encodeURIComponent(stem)}` : "/free/og"
  return {
    title: FREE_TITLE,
    description: FREE_DESCRIPTION,
    openGraph: {
      title: FREE_TITLE, description: FREE_DESCRIPTION, siteName: SITE_NAME, type: "website", locale: "ko_KR",
      images: [{ url: image, width: 1200, height: 630, alt: `${SITE_NAME} 무료 사주` }],
    },
    twitter: { card: "summary_large_image", title: FREE_TITLE, description: FREE_DESCRIPTION, images: [image] },
  }
}
