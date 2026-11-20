import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateFullReading } from "@/lib/generate-reading-v2"
import type { SajuInputData } from "@/lib/saju-input"

export const maxDuration = 300

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
  }

  const { id } = await params

  try {
    const reading = await prisma.reading.findUnique({ where: { id } })
    if (!reading || reading.userId !== session.user.id) {
      return NextResponse.json({ error: "풀이를 찾을 수 없습니다." }, { status: 404 })
    }
    if (!reading.sajuInput) {
      return NextResponse.json({ error: "사주 입력 데이터가 없습니다." }, { status: 400 })
    }

    const sajuInput = reading.sajuInput as unknown as SajuInputData
    const fullReading = await generateFullReading(sajuInput, [], {})

    await prisma.reading.update({
      where: { id },
      data: {
        fullReading: fullReading as object,
        status: "COMPLETE",
      },
    })

    return NextResponse.json({ readingId: id })
  } catch (err) {
    console.error("[/api/reading/[id]/generate] 오류:", err)
    await prisma.reading.update({ where: { id }, data: { status: "FAILED" } }).catch(() => {})
    const message = err instanceof Error ? err.message : "알 수 없는 오류"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
