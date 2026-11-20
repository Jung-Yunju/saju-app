import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
  }

  const { id } = await params
  const reading = await prisma.reading.findUnique({
    where: { id },
    select: { status: true, userId: true },
  })

  if (!reading || reading.userId !== session.user.id) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 })
  }

  return NextResponse.json({ status: reading.status })
}
