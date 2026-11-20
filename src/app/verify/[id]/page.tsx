import { notFound, redirect } from "next/navigation"
import { connection } from "next/server"
import { auth } from "@/lib/auth"

export const instant = false
import { prisma } from "@/lib/prisma"
import VerifyClient from "./VerifyClient"
import type { ClaimsResult } from "@/lib/generate-reading-v2"

export default async function VerifyPage({ params }: { params: Promise<{ id: string }> }) {
  await connection()
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const reading = await prisma.reading.findUnique({ where: { id } })
  if (!reading || reading.userId !== session.user.id) notFound()
  if (!reading.claims) notFound()

  // 이미 완료된 풀이면 결과 페이지로
  if (reading.status === "COMPLETE" && reading.fullReading) {
    redirect(`/reading/${id}`)
  }

  const claims = reading.claims as unknown as ClaimsResult

  return (
    <VerifyClient
      readingId={id}
      coverTitle={claims.cover_title}
      chartSummary={claims.chart_summary}
      claims={claims.claims}
      userName={reading.name || session.user.name || "당신"}
    />
  )
}
