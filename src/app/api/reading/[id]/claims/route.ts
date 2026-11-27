// (구) 1차 "지나온 길 단정" 생성 — 현재 화면에서 쓰지 않는 개발용 경로.
// 운영에서는 ALLOW_FREE_READING=true가 아니면 404. 허용돼도 1회 잠금으로 중복 AI 호출을 막는다.
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionUser } from "@/lib/session-user"
import { isFreeReadingAllowed } from "@/lib/validate"
import { generateClaims } from "@/lib/generate-reading-v2"
import { MSG, jsonError, serverError } from "../../../_lib/http"
import {
  READING_STATUS, acquireGenerationLock, finishGeneration, withTimeout,
} from "../../_lib/reading-lock"
import { prepareSajuInputForAi } from "../../_lib/ai-input"

export const maxDuration = 60
const CLAIMS_TIMEOUT_MS = 55_000

const TAG = "/api/reading/[id]/claims"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isFreeReadingAllowed()) return jsonError("찾을 수 없습니다.", 404)

  const { id } = await params

  let userId: string
  let reading: { orderId: string; sajuInput: unknown } | null
  try {
    const user = await getSessionUser()
    if (!user) return jsonError(MSG.LOGIN_REQUIRED, 401)
    userId = user.userId
    reading = await prisma.reading.findFirst({
      where: { id, userId },
      select: { orderId: true, sajuInput: true },
    })
  } catch (err) {
    return serverError(TAG, err)
  }
  if (!reading) return jsonError(MSG.NOT_FOUND, 404)

  const sajuInput = prepareSajuInputForAi(reading.sajuInput)
  if (!sajuInput) return jsonError("풀이에 필요한 입력 정보가 없습니다.", 400)

  let locked: boolean
  try {
    locked = await acquireGenerationLock(id, userId, reading.orderId, [
      READING_STATUS.PENDING, READING_STATUS.FAILED,
    ])
  } catch (err) {
    return serverError(TAG, err)
  }

  if (!locked) {
    const current = await prisma.reading
      .findFirst({ where: { id, userId }, select: { status: true, claims: true } })
      .catch(() => null)
    // 이미 만들어 둔 단정이 있으면 AI를 다시 부르지 않고 그대로 돌려준다
    if (current?.status === READING_STATUS.VERIFYING && current.claims) {
      return NextResponse.json({ claims: current.claims })
    }
    if (current?.status === READING_STATUS.GENERATING) {
      return NextResponse.json({ status: current.status }, { status: 202 })
    }
    return NextResponse.json(
      { status: current?.status ?? "UNKNOWN", error: "지금은 만들 수 없는 상태입니다." },
      { status: 409 },
    )
  }

  try {
    const claimsResult = await withTimeout(generateClaims(sajuInput), CLAIMS_TIMEOUT_MS, "단정 생성")
    await finishGeneration(id, userId, {
      claims: claimsResult as object,
      status: READING_STATUS.VERIFYING,
    })
    return NextResponse.json({ claims: claimsResult })
  } catch (err) {
    await finishGeneration(id, userId, { status: READING_STATUS.FAILED }).catch(e =>
      console.error(`[${TAG}] FAILED 기록 실패`, e),
    )
    return serverError(TAG, err, MSG.GENERATION_FAILED)
  }
}
