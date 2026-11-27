import { notFound } from "next/navigation"
import { FreeClient } from "../../free-client"
import { dayMasterOf } from "../../_lib/ganzhi"
import { freeMetadata } from "../../_lib/metadata"

// 공유 링크(/free/dm/甲)용: 천간 10개를 빌드 시 미리 만든다. 링크에는 일간만 있고 개인정보는 없다.
const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"]
export function generateStaticParams() {
  return STEMS.map((stem) => ({ stem }))
}

type P = { params: Promise<{ stem: string }> }

export async function generateMetadata({ params }: P) {
  const { stem } = await params
  const dm = dayMasterOf(decodeURIComponent(stem))
  return freeMetadata(dm?.hanja)
}

export default async function FreeDmPage({ params }: P) {
  const { stem } = await params
  if (!dayMasterOf(decodeURIComponent(stem))) notFound()
  return <FreeClient />
}
