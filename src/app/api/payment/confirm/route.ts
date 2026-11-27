// 토스페이먼츠 결제 승인 → 주문 PAID → PENDING 풀이 레코드 생성 → readingId 반환.
// AI 생성은 여기서 하지 않는다. 풀이 화면이 /api/reading/[id]/generate (1회 잠금)를 호출한다.
//
// 상태 전이 규칙(동시 요청 안전):
//   - 토스 승인 성공(금액·주문번호 일치 확인)  : PENDING|FAILED → PAID  (실제로 돈이 나갔으면 PAID가 이긴다)
//   - 토스가 명확히 거절                       : PENDING → FAILED      (이미 PAID면 건드리지 않음)
//   - 네트워크 오류·토스 5xx (결과 모름)       : 상태 유지(PENDING) → 같은 요청을 다시 보내면 재확인
//   - 이미 PAID인 주문을 다시 확인             : 풀이가 있으면 그 id, 없으면 지금 만들어 반환 (재시도 경로)
import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getSessionUser } from "@/lib/session-user"
import { buildSajuInput, type SajuInputData } from "@/lib/saju-input"
import { readJsonBody, validateBirthInfo, type BirthInput } from "@/lib/validate"
import { MSG, jsonError, serverError } from "../../_lib/http"
import { READING_STATUS } from "../../reading/_lib/reading-lock"

export const maxDuration = 30

const TAG = "/api/payment/confirm"
const TOSS_API = "https://api.tosspayments.com/v1/payments"
const ORDER_ID_RE = /^[A-Za-z0-9_-]{6,64}$/
const PAYMENT_KEY_RE = /^[A-Za-z0-9_-]{1,200}$/

type TossResult =
  | { kind: "approved" }
  | { kind: "rejected" }
  | { kind: "unknown" }

interface TossPayment {
  orderId?: unknown
  status?: unknown
  totalAmount?: unknown
}

function isApprovedFor(p: TossPayment, orderId: string, amount: number): boolean {
  return p.orderId === orderId && p.status === "DONE" && p.totalAmount === amount
}

function tossAuthHeader(secret: string) {
  return `Basic ${Buffer.from(`${secret}:`).toString("base64")}`
}

async function confirmWithToss(
  secret: string, paymentKey: string, orderId: string, amount: number,
): Promise<TossResult> {
  let res: Response
  try {
    res = await fetch(`${TOSS_API}/confirm`, {
      method: "POST",
      headers: { Authorization: tossAuthHeader(secret), "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount }),
      signal: AbortSignal.timeout(20_000),
    })
  } catch (err) {
    console.error(`[${TAG}] 토스 승인 요청 실패(네트워크)`, err)
    return { kind: "unknown" }
  }

  const data = (await res.json().catch(() => ({}))) as TossPayment & { code?: unknown }
  if (res.ok) {
    if (isApprovedFor(data, orderId, amount)) return { kind: "approved" }
    console.error(`[${TAG}] 토스 승인 응답 불일치`, { orderId, status: data.status })
    return { kind: "unknown" }
  }

  // 같은 결제를 이미 승인한 경우(새로고침·동시 요청) → 결제 조회로 실제 상태 확인
  if (data.code === "ALREADY_PROCESSED_PAYMENT" || res.status >= 500) {
    return lookupToss(secret, paymentKey, orderId, amount)
  }
  console.error(`[${TAG}] 토스 승인 거절`, { orderId, httpStatus: res.status, code: data.code })
  return { kind: "rejected" }
}

async function lookupToss(
  secret: string, paymentKey: string, orderId: string, amount: number,
): Promise<TossResult> {
  try {
    const res = await fetch(`${TOSS_API}/${encodeURIComponent(paymentKey)}`, {
      headers: { Authorization: tossAuthHeader(secret) },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return { kind: "unknown" }
    const data = (await res.json().catch(() => ({}))) as TossPayment
    return isApprovedFor(data, orderId, amount) ? { kind: "approved" } : { kind: "unknown" }
  } catch (err) {
    console.error(`[${TAG}] 토스 결제 조회 실패`, err)
    return { kind: "unknown" }
  }
}

/** 주문에 연결된 풀이가 있으면 그 id, 없으면 PENDING 풀이를 만든다 (Reading.orderId UNIQUE로 1건 보장) */
async function ensureReading(
  orderDbId: string, userId: string, birth: BirthInput, sajuInput: SajuInputData,
): Promise<string> {
  const existing = await prisma.reading.findUnique({ where: { orderId: orderDbId }, select: { id: true } })
  if (existing) return existing.id
  try {
    const created = await prisma.reading.create({
      data: {
        userId,
        orderId: orderDbId,
        readingType: "BASIC", // 상품은 서버가 정한다 (현재 결제 상품은 기본 풀이 하나)
        birthYear: birth.birthYear,
        birthMonth: birth.birthMonth,
        birthDay: birth.birthDay,
        birthHour: birth.birthHour,
        gender: birth.gender,
        calType: birth.calType,
        status: READING_STATUS.PENDING,
        sajuInput: sajuInput as object,
        content: "",
      },
      select: { id: true },
    })
    return created.id
  } catch (err) {
    // 동시 요청이 먼저 만들었으면 그것을 쓴다
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const again = await prisma.reading.findUnique({ where: { orderId: orderDbId }, select: { id: true } })
      if (again) return again.id
    }
    throw err
  }
}

export async function POST(req: Request) {
  let userId: string
  try {
    const user = await getSessionUser()
    if (!user) return jsonError(MSG.LOGIN_REQUIRED, 401)
    userId = user.userId
  } catch (err) {
    return serverError(TAG, err)
  }

  const body = await readJsonBody(req)
  if (!body.ok) return jsonError(body.error, 400)
  const { paymentKey, orderId, amount, birthInfo } = (body.value ?? {}) as Record<string, unknown>

  if (typeof orderId !== "string" || !ORDER_ID_RE.test(orderId)) {
    return jsonError("유효하지 않은 주문입니다.", 400)
  }
  if (typeof paymentKey !== "string" || !PAYMENT_KEY_RE.test(paymentKey)) {
    return jsonError("결제 정보가 올바르지 않습니다.", 400)
  }

  // 결제 승인 전에 생년월일을 검증한다 (승인 후 풀이를 못 만드는 상황 방지)
  const birth = validateBirthInfo(birthInfo)
  if (!birth.ok) return jsonError(birth.error, 400)
  let sajuInput: SajuInputData
  try {
    const b = birth.value
    sajuInput = buildSajuInput(b.birthYear, b.birthMonth, b.birthDay, b.birthHour, b.gender, b.calType)
  } catch (err) {
    console.error(`[${TAG}] 사주 계산 실패`, err)
    return jsonError("입력한 생년월일로 사주를 계산할 수 없습니다. 날짜를 확인해 주세요.", 400)
  }

  const secret = process.env.TOSS_SECRET_KEY
  if (!secret) return serverError(TAG, new Error("TOSS_SECRET_KEY 미설정"))

  try {
    const order = await prisma.order.findUnique({ where: { orderId } })
    // 0원(무료) 주문은 결제 확인 대상이 아니다 — 예전 무료 경로가 남긴 빈 주문에 풀이를 붙이는 우회 차단
    if (!order || order.userId !== userId || order.amount <= 0) {
      return jsonError("유효하지 않은 주문입니다.", 400)
    }
    // 금액은 서버에 저장된 주문 금액이 기준. 결제창이 돌려준 금액이 다르면 승인하지 않는다.
    if (amount !== order.amount) return jsonError("결제 금액이 일치하지 않습니다.", 400)

    if (order.status === "PAID") {
      const readingId = await ensureReading(order.id, userId, birth.value, sajuInput)
      return NextResponse.json({ readingId })
    }
    if (order.status !== "PENDING") {
      return jsonError("이미 처리된 주문입니다. 새로 결제해 주세요.", 400)
    }

    const result = await confirmWithToss(secret, paymentKey, orderId, order.amount)

    if (result.kind === "rejected") {
      await prisma.order.updateMany({ where: { id: order.id, status: "PENDING" }, data: { status: "FAILED" } })
      return jsonError("결제 승인에 실패했습니다. 결제 수단을 확인하고 다시 시도해 주세요.", 400)
    }
    if (result.kind === "unknown") {
      return jsonError("결제 확인이 늦어지고 있습니다. 잠시 후 이 화면을 새로고침해 주세요.", 502)
    }

    // 승인 확인됨 → PAID (동시 요청이 FAILED로 바꿨더라도 실제 승인이 우선)
    await prisma.order.updateMany({
      where: { id: order.id, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "PAID", paymentKey },
    })

    const readingId = await ensureReading(order.id, userId, birth.value, sajuInput)
    return NextResponse.json({ readingId })
  } catch (err) {
    // 결제는 됐는데 풀이 레코드 생성이 실패했을 수 있다 → 같은 요청을 다시 보내면 PAID 경로로 복구된다
    return serverError(TAG, err, "결제 확인 중 문제가 생겼습니다. 잠시 후 이 화면을 새로고침해 주세요.")
  }
}
