import type { Metadata } from "next"
import { FreeClient } from "./free-client"
import { dayMasterOf } from "./_lib/ganzhi"
import { FREE_DESCRIPTION, FREE_TITLE, SITE_NAME } from "./theme"

type SP = Promise<{ dm?: string | string[] }>

// 공유 링크(/free?dm=甲)로 들어오면 일간별 미리보기 이미지를 쓴다. dm이 없거나 천간이 아니면 기본 이미지.
export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const { dm } = await searchParams
  const stem = typeof dm === "string" ? dayMasterOf(dm)?.hanja : undefined
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

export default function FreePage() {
  return <FreeClient />
}
