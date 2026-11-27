import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionUser } from "@/lib/session-user"
import { generateFullReading } from "@/lib/generate-reading-v2"
import { MSG, jsonError, serverError } from "../../../_lib/http"
import {
  ATTEMPTS_EXHAUSTED_MESSAGE, READING_STATUS, acquireGenerationLock, finishGeneration,
  getGenerationMaxAttempts, isAttemptsExhausted, isDbSchemaV3, withTimeout,
} from "../../_lib/reading-lock"
import { prepareSajuInputForAi } from "../../_lib/ai-input"

export const maxDuration = 300
// maxDuration보다 짧게 끊어서, 시간 초과 시에도 FAILED 기록·"다시 시도"가 가능하게 한다
const GENERATION_TIMEOUT_MS = 270_000

const TAG = "/api/reading/[id]/generate"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let userId: string
  try {
    const user = await getSessionUser()
    if (!user) return jsonError(MSG.LOGIN_REQUIRED, 401)
    userId = user.userId
  } catch (err) {
    return serverError(TAG, err)
  }

  let reading: { id: string; orderId: string; status: string; sajuInput: unknown } | null
  try {
    // 소유자가 아니면 아무것도 쓰지 않고 404
    reading = await prisma.reading.findFirst({
      where: { id, userId },
      select: { id: true, orderId: true, status: true, sajuInput: true },
    })
  } catch (err) {
    return serverError(TAG, err)
  }
  if (!reading) return jsonError(MSG.NOT_FOUND, 404)

  const sajuInput = prepareSajuInputForAi(reading.sajuInput)
  if (!sajuInput) {
    console.error(`[${TAG}] sajuInput 없음`, { id })
    return jsonError("풀이에 필요한 입력 정보가 없습니다. 새로 풀이를 신청해 주세요.", 400)
  }

  let locked: boolean
  try {
    locked = await acquireGenerationLock(id, userId, reading.orderId, [
      READING_STATUS.PENDING, READING_STATUS.FAILED,
    ])
  } catch (err) {
    return serverError(TAG, err)
  }

  if (!locked) {
    // 다른 요청이 이미 생성 중이거나 끝났다(또는 v3에서 시도 횟수를 다 썼다) → AI 호출 없이 현재 상태만 알려 준다
    const v3 = isDbSchemaV3()
    const current: { status: string; attemptCount?: number } | null = await prisma.reading
      .findFirst({ where: { id, userId }, select: v3 ? { status: true, attemptCount: true } : { status: true } })
      .catch(() => null)
    const status = current?.status ?? "UNKNOWN"
    if (v3 && current && isAttemptsExhausted(status, current.attemptCount, getGenerationMaxAttempts())) {
      console.error(`[${TAG}] 생성 시도 상한 도달`, { id, attemptCount: current.attemptCount })
      return NextResponse.json(
        { readingId: id, status, retryExhausted: true, error: ATTEMPTS_EXHAUSTED_MESSAGE },
        { status: 409 },
      )
    }
    if (status === READING_STATUS.COMPLETE) {
      return NextResponse.json({ readingId: id, status, alreadyCompleted: true })
    }
    if (status === READING_STATUS.GENERATING) {
      return NextResponse.json({ readingId: id, status }, { status: 202 })
    }
    return NextResponse.json(
      { readingId: id, status, error: "지금은 풀이를 만들 수 없는 상태입니다." },
      { status: 409 },
    )
  }

  try {
    const fullReading = await withTimeout(
      generateFullReading(sajuInput, [], {}),
      GENERATION_TIMEOUT_MS,
      "본 풀이 생성",
    )
    const saved = await finishGeneration(id, userId, {
      fullReading: fullReading as object,
      status: READING_STATUS.COMPLETE,
    })
    if (!saved) console.error(`[${TAG}] 결과 저장 시 잠금 상태가 아님`, { id })
    return NextResponse.json({ readingId: id, status: READING_STATUS.COMPLETE })
  } catch (err) {
    // 본인 풀이(잠금을 잡은 것)만 FAILED로
    await finishGeneration(id, userId, { status: READING_STATUS.FAILED }).catch(e =>
      console.error(`[${TAG}] FAILED 기록 실패`, e),
    )
    return serverError(TAG, err, MSG.GENERATION_FAILED)
  }
}
