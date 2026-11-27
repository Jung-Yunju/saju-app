import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionUser } from "@/lib/session-user"
import { MSG, jsonError, serverError } from "../../../_lib/http"
import { READING_STATUS, isStaleGenerating } from "../../_lib/reading-lock"

const TAG = "/api/reading/[id]/status"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const user = await getSessionUser()
    if (!user) return jsonError(MSG.LOGIN_REQUIRED, 401)

    const reading = await prisma.reading.findFirst({
      where: { id, userId: user.userId },
      select: { status: true, order: { select: { updatedAt: true } } },
    })
    if (!reading) return jsonError(MSG.NOT_FOUND, 404)

    // 서버가 중간에 멈춰 오래 남은 GENERATING은 화면에 FAILED로 알려 "다시 시도"를 띄운다.
    // (실제 상태 복구는 generate 호출 시 잠금 단계에서 한다 — 조회 요청은 DB를 바꾸지 않음)
    const status = isStaleGenerating(reading.status, reading.order?.updatedAt)
      ? READING_STATUS.FAILED
      : reading.status

    return NextResponse.json({ status })
  } catch (err) {
    return serverError(TAG, err)
  }
}
