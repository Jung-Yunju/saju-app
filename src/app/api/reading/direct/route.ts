// 결제 없이(0원) 풀이를 신청하는 경로.
// 운영(NODE_ENV=production)에서는 ALLOW_FREE_READING=true일 때만 열린다.
// 열려 있어도 사용자당 24시간 FREE_READING_DAILY_LIMIT건(기본 3)까지만 만든다.
// 이 경로는 레코드만 만들고 AI를 부르지 않는다. AI 생성은 /api/reading/[id]/generate (1회 잠금).
import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionUser } from "@/lib/session-user"
import { EngineInputError } from "@/engine"
import { buildSajuInputFromRequest, SAJU_INPUT_ERROR_MESSAGE, type SajuInputData } from "@/lib/saju-input"
import {
  getFreeReadingDailyLimit, isFreeReadingAllowed, readJsonBody, validateReadingRequest,
} from "@/lib/validate"
import { MSG, jsonError, serverError } from "../../_lib/http"
import { READING_STATUS } from "../_lib/reading-lock"
import { isDbSchemaV3, otherPrecisionColumns, precisionColumns } from "../_lib/schema-v3"

export const maxDuration = 30

const TAG = "/api/reading/direct"
const DAY_MS = 24 * 60 * 60 * 1000

class DailyLimitError extends Error {}

export async function POST(req: NextRequest) {
  if (!isFreeReadingAllowed()) return jsonError(MSG.FREE_READING_CLOSED, 403)

  let userId: string
  try {
    const user = await getSessionUser({ createIfMissing: true })
    if (!user) return jsonError(MSG.LOGIN_REQUIRED, 401)
    userId = user.userId
  } catch (err) {
    return serverError(TAG, err)
  }

  const body = await readJsonBody(req)
  if (!body.ok) return jsonError(body.error, 400)
  const input = validateReadingRequest(body.value)
  if (!input.ok) return jsonError(input.error, 400)
  const v = input.value

  // 만세력 계산이 실패하는 입력(예: 그 해에 없는 음력 30일·윤달)은 레코드를 만들기 전에 거른다.
  // 입력 오류(EngineInputError)만 400, 그 밖의 예외는 엔진 결함이므로 500.
  // 윤달·분·시각 입력 방식·출생지는 sajuInput(JSON)에 남는다(결과 화면은 저장된 pillars를 표시).
  // DB_SCHEMA_V3=true이면 같은 값을 Reading 열(isLeapMonth·birthMinute·timeMode·ziNight·birthplaceLongitude, other*)에도 기록한다.
  let sajuInput: SajuInputData
  try {
    sajuInput = buildSajuInputFromRequest(
      { ...v, year: v.birthYear, month: v.birthMonth, day: v.birthDay, hour: v.birthHour },
      v.name ?? undefined,
    )
  } catch (err) {
    if (!(err instanceof EngineInputError)) return serverError(TAG, err)
    return jsonError(SAJU_INPUT_ERROR_MESSAGE, 400)
  }
  // 상대방: 계산 가능 여부만 확인한다(현재 풀이 생성은 상대방 원국을 쓰지 않는다).
  // 상대방 양력·음력 구분·윤달·분·출생지는 스위치가 켜져 있을 때만 other* 열에 남는다.
  if (v.other) {
    try {
      buildSajuInputFromRequest({ ...v.other, calType: v.other.calType ?? v.calType })
    } catch (err) {
      if (!(err instanceof EngineInputError)) return serverError(TAG, err)
      return jsonError(`상대방 ${SAJU_INPUT_ERROR_MESSAGE}`, 400)
    }
  }

  const limit = getFreeReadingDailyLimit()
  const v3Columns = isDbSchemaV3()
    ? { ...precisionColumns({ ...v, hour: v.birthHour }), ...otherPrecisionColumns(v.other) }
    : {}

  try {
    const readingId = await prisma.$transaction(async tx => {
      // 같은 사용자의 동시 요청을 줄 세워 한도 검사와 생성 사이 경쟁을 막는다 (트랜잭션 종료 시 자동 해제)
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`free_reading:${userId}`}))`

      const used = await tx.order.count({
        where: { userId, amount: 0, createdAt: { gte: new Date(Date.now() - DAY_MS) } },
      })
      if (used >= limit) throw new DailyLimitError()

      const order = await tx.order.create({
        data: {
          userId,
          orderId: `free_${randomUUID().replace(/-/g, "")}`,
          amount: 0,
          status: "PAID",
        },
      })

      const reading = await tx.reading.create({
        data: {
          userId,
          orderId: order.id,
          readingType: v.readingType,
          name: v.name,
          birthYear: v.birthYear,
          birthMonth: v.birthMonth,
          birthDay: v.birthDay,
          birthHour: v.birthHour,
          gender: v.gender,
          calType: v.calType,
          otherName: v.other?.name ?? null,
          otherBirthYear: v.other?.year ?? null,
          otherBirthMonth: v.other?.month ?? null,
          otherBirthDay: v.other?.day ?? null,
          otherBirthHour: v.other?.hour ?? null,
          otherGender: v.other?.gender ?? null,
          ...v3Columns,
          status: READING_STATUS.PENDING,
          sajuInput: sajuInput as object,
          content: "",
        },
        select: { id: true },
      })
      return reading.id
    })

    return NextResponse.json({ readingId })
  } catch (err) {
    if (err instanceof DailyLimitError) {
      return jsonError(
        `무료 풀이는 하루(24시간)에 ${limit}번까지 신청할 수 있어요. 나중에 다시 시도해 주세요.`,
        429,
      )
    }
    return serverError(TAG, err)
  }
}
