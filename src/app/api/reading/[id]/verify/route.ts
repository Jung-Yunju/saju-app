import { NextRequest, NextResponse } from "next/server"

export const maxDuration = 60
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateFullReading, type Claim, type AnswerMap } from "@/lib/generate-reading-v2"
import type { SajuInputData } from "@/lib/saju-input"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const { answers } = body as { answers: AnswerMap }

  const reading = await prisma.reading.findUnique({ where: { id } })
  if (!reading || reading.userId !== session.user.id) {
    return NextResponse.json({ error: "풀이를 찾을 수 없습니다." }, { status: 404 })
  }
  if (!reading.sajuInput || !reading.claims) {
    return NextResponse.json({ error: "1차 풀이 데이터가 없습니다." }, { status: 400 })
  }

  try {
    const sajuInput = reading.sajuInput as unknown as SajuInputData
    const claims = (reading.claims as unknown as { claims: Claim[] }).claims

    const fullReading = await generateFullReading(sajuInput, claims, answers)

    await prisma.reading.update({
      where: { id },
      data: {
        userAnswers: answers as object,
        fullReading: fullReading as object,
        status: "COMPLETE",
      },
    })

    return NextResponse.json({ readingId: id })
  } catch (err) {
    console.error("[/api/reading/[id]/verify] 오류:", err)
    const message = err instanceof Error ? err.message : "알 수 없는 오류"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
