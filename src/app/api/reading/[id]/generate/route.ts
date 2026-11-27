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
import { resolveReadingEngine } from "../../_lib/engine-switch"
import {
  generateReadingV3, prepareReadingV3, recordAiUsage, summarizeV3Run, type PreparedReadingV3,
} from "@/lib/generate-reading-v3"
import type { GenerationEvent } from "@/engine/content/generate"

export const maxDuration = 300
// maxDuration보다 짧게 끊어서, 시간 초과 시에도 FAILED 기록·"다시 시도"가 가능하게 한다
const GENERATION_TIMEOUT_MS = 270_000
// v3: 콘텐츠 엔진 시간 예산. 위 제한보다 짧게 잡아 엔진이 스스로 멈추고 통과한 장을 저장할 여유를 둔다
const V3_TIME_BUDGET_MS = 245_000

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

  // 기능 스위치(READING_ENGINE=v3 + DB_SCHEMA_V3=true). 기본은 v2 — 아래 v2 경로는 예전과 같다
  const choice = resolveReadingEngine()
  if (choice.fallbackReason) console.warn(`[${TAG}] READING_ENGINE=v3인데 DB_SCHEMA_V3가 꺼져 있어 v2로 생성`)
  const useV3 = choice.engine === "v3"

  let reading: {
    id: string; orderId: string; status: string; sajuInput: unknown
    readingType?: string; gender?: string; fullReading?: unknown
  } | null
  try {
    // 소유자가 아니면 아무것도 쓰지 않고 404
    reading = await prisma.reading.findFirst({
      where: { id, userId },
      select: useV3
        ? { id: true, orderId: true, status: true, sajuInput: true, readingType: true, gender: true, fullReading: true }
        : { id: true, orderId: true, status: true, sajuInput: true },
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

  // v3 준비(AI 없음, 잠금 전) — 지원하지 않는 상품·저장 원국과 재계산 불일치 등이면 v2로 생성한다(결제 건이 멈추지 않게)
  let v3: PreparedReadingV3 | null = null
  if (useV3) {
    try {
      const prepared = prepareReadingV3({
        readingType: String(reading.readingType ?? ""),
        gender: String(reading.gender ?? ""),
        sajuInput: reading.sajuInput,
      })
      if (prepared.ok) v3 = prepared.value
      else console.warn(`[${TAG}] v3 준비 불가 → v2로 생성`, { id, reason: prepared.reason })
    } catch (err) {
      console.error(`[${TAG}] v3 준비 중 예상하지 못한 오류 → v2로 생성`, { id }, err)
    }
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

  if (v3) return runV3(id, userId, v3, reading.fullReading)

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

/** v3 생성(잠금을 잡은 요청만). 잠금·저장·실패 기록은 v2와 같은 함수(finishGeneration)를 쓴다 */
async function runV3(id: string, userId: string, prepared: PreparedReadingV3, previous: unknown) {
  const events: GenerationEvent[] = []
  try {
    const result = await withTimeout(
      generateReadingV3(prepared, { previous, timeBudgetMs: V3_TIME_BUDGET_MS, onEvent: e => events.push(e) }),
      GENERATION_TIMEOUT_MS,
      "본 풀이 생성(v3)",
    )
    console.info(`[${TAG}] v3 생성 결과`, { id, ...summarizeV3Run(result) })
    // complete·crisis(상담 안내) = COMPLETE / partial(일부 장 실패) = FAILED + 통과한 장 저장 → 다시 시도하면 실패한 장만 만든다
    const status = result.status === "partial" ? READING_STATUS.FAILED : READING_STATUS.COMPLETE
    const saved = await finishGeneration(id, userId, { fullReading: result.stored as object, status })
    if (!saved) console.error(`[${TAG}] 결과 저장 시 잠금 상태가 아님`, { id })
    if (status === READING_STATUS.FAILED) return jsonError(MSG.GENERATION_FAILED, 500)
    return NextResponse.json({ readingId: id, status: READING_STATUS.COMPLETE })
  } catch (err) {
    await finishGeneration(id, userId, { status: READING_STATUS.FAILED }).catch(e =>
      console.error(`[${TAG}] FAILED 기록 실패`, e),
    )
    return serverError(TAG, err, MSG.GENERATION_FAILED)
  } finally {
    // 호출마다 모델·토큰·비용 기록(실패·시간 초과여도 이미 한 호출은 남긴다). 기록 실패가 풀이 결과를 바꾸지 않는다
    await recordAiUsage(prisma, id, events).catch(e => console.error(`[${TAG}] AiUsage 기록 실패`, { id, calls: events.length }, e))
  }
}
