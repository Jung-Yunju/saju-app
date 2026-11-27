// (구) 사용자 맞다/아니다 답변을 반영한 본 풀이 — 현재 화면에서 쓰지 않는 개발용 경로.
// 운영에서는 ALLOW_FREE_READING=true가 아니면 404.
// 답변은 서버에 저장된 claim id만, 값은 "맞다"|"아니다"|"모름"만 받는다. 본문은 4KB까지.
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionUser } from "@/lib/session-user"
import { extractClaimIds, isFreeReadingAllowed, readJsonBody, validateAnswers } from "@/lib/validate"
import { generateFullReading, type Claim } from "@/lib/generate-reading-v2"
import { MSG, jsonError, serverError } from "../../../_lib/http"
import {
  READING_STATUS, acquireGenerationLock, finishGeneration, withTimeout,
} from "../../_lib/reading-lock"
import { prepareSajuInputForAi } from "../../_lib/ai-input"

// 본 풀이 생성은 generate 경로와 같은 시간이 걸리므로 같은 한도를 쓴다
export const maxDuration = 300
const GENERATION_TIMEOUT_MS = 270_000
const BODY_LIMIT = 4 * 1024

const TAG = "/api/reading/[id]/verify"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isFreeReadingAllowed()) return jsonError("찾을 수 없습니다.", 404)

  const { id } = await params

  let userId: string
  let reading: { orderId: string; sajuInput: unknown; claims: unknown; status: string } | null
  try {
    const user = await getSessionUser()
    if (!user) return jsonError(MSG.LOGIN_REQUIRED, 401)
    userId = user.userId
    reading = await prisma.reading.findFirst({
      where: { id, userId },
      select: { orderId: true, sajuInput: true, claims: true, status: true },
    })
  } catch (err) {
    return serverError(TAG, err)
  }
  if (!reading) return jsonError(MSG.NOT_FOUND, 404)
  if (reading.status === READING_STATUS.COMPLETE) {
    return NextResponse.json({ readingId: id, status: reading.status, alreadyCompleted: true })
  }

  const sajuInput = prepareSajuInputForAi(reading.sajuInput)
  const claimIds = extractClaimIds(reading.claims)
  if (!sajuInput || claimIds.length === 0) {
    return jsonError("1차 풀이 데이터가 없습니다.", 400)
  }

  const body = await readJsonBody(req, BODY_LIMIT)
  if (!body.ok) return jsonError(body.error, 400)
  const answersRaw = (body.value as { answers?: unknown } | null)?.answers
  const answers = validateAnswers(answersRaw, claimIds)
  if (!answers.ok) return jsonError(answers.error, 400)

  // 프롬프트에는 화이트리스트를 통과한 id의 단정만 넣는다
  const allowed = new Set(claimIds)
  const claims = ((reading.claims as { claims: Claim[] }).claims ?? []).filter(c => allowed.has(c.id))

  let locked: boolean
  try {
    locked = await acquireGenerationLock(id, userId, reading.orderId, [
      READING_STATUS.VERIFYING, READING_STATUS.FAILED,
    ])
  } catch (err) {
    return serverError(TAG, err)
  }
  if (!locked) {
    return NextResponse.json(
      { readingId: id, error: "이미 풀이를 만들고 있습니다. 잠시 후 확인해 주세요." },
      { status: 409 },
    )
  }

  try {
    const fullReading = await withTimeout(
      generateFullReading(sajuInput, claims, answers.value),
      GENERATION_TIMEOUT_MS,
      "본 풀이 생성",
    )
    await finishGeneration(id, userId, {
      userAnswers: answers.value as object,
      fullReading: fullReading as object,
      status: READING_STATUS.COMPLETE,
    })
    return NextResponse.json({ readingId: id })
  } catch (err) {
    // 단정은 남아 있으므로 답변을 다시 제출할 수 있게 VERIFYING으로 되돌린다
    await finishGeneration(id, userId, { status: READING_STATUS.VERIFYING }).catch(e =>
      console.error(`[${TAG}] 상태 복구 실패`, e),
    )
    return serverError(TAG, err, MSG.GENERATION_FAILED)
  }
}
