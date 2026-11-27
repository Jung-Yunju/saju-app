// 토스페이먼츠 결제 승인 → 주문 PAID → PENDING 풀이 레코드 생성 → readingId 반환.
// AI 생성은 여기서 하지 않는다. 풀이 화면이 /api/reading/[id]/generate (1회 잠금)를 호출한다.
//
// 상태 전이 규칙(동시 요청 안전):
//   - 토스 승인 성공(금액·주문번호 일치 확인)  : PENDING|FAILED → PAID  (실제로 돈이 나갔으면 PAID가 이긴다)
//   - 토스가 명확히 거절                       : PENDING → FAILED      (이미 PAID면 건드리지 않음)
//   - 네트워크 오류·토스 5xx (결과 모름)       : 상태 유지(PENDING) → 같은 요청을 다시 보내면 재확인
//   - 이미 PAID인 주문을 다시 확인             : 풀이가 있으면 그 id, 없으면 지금 만들어 반환 (재시도 경로)
//
// 생년월일 출처:
//   - 스위치 끔(기본): 클라이언트가 다시 보낸 birthInfo를 승인 전에 검증해 쓴다(예전 동작).
//   - DB_SCHEMA_V3=true: prepare가 서버에 저장한 Order.birthInfo만 쓴다. 클라이언트 birthInfo는 무시한다.
//       · 저장값 없는 미결제 주문(스위치 켜기 전에 준비된 주문) → 토스 승인 전에 400(돈이 나가지 않음, 다시 결제)
//       · 저장값 없는 결제 완료 주문 → 풀이가 있으면 그 id. 없으면(돈은 나갔고 풀이 생성이 실패한 예전 주문)
//         예외적으로 클라이언트 값으로 복구하고 경고 로그를 남긴다
//       · 풀이 레코드를 만든 뒤 Order.birthInfo는 지운다(같은 개인정보를 두 곳에 두지 않음)
import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getSessionUser } from "@/lib/session-user"
import { EngineInputError } from "@/engine"
import { buildSajuInputFromRequest, SAJU_INPUT_ERROR_MESSAGE, type SajuInputData } from "@/lib/saju-input"
import { readJsonBody, validateBirthInfo, type BirthInput } from "@/lib/validate"
import { MSG, jsonError, serverError } from "../../_lib/http"
import { READING_STATUS } from "../../reading/_lib/reading-lock"
import { isDbSchemaV3, precisionColumns } from "../../reading/_lib/schema-v3"

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

interface PreparedBirth {
  birth: BirthInput
  sajuInput: SajuInputData
}

/** 생년월일 검증 + 만세력 계산. 입력 오류 400, 엔진 결함 500 (어느 쪽이든 호출 쪽은 토스 승인 전에 멈춘다) */
function prepareBirth(raw: unknown, source: "client" | "server"): PreparedBirth | Response {
  const birth = validateBirthInfo(raw)
  if (!birth.ok) {
    // 서버가 저장한 값이 검증을 못 넘으면 데이터 손상 → 내부 오류(내용은 로그에 남기지 않음)
    if (source === "server") return serverError(TAG, new Error("저장된 Order.birthInfo 검증 실패"))
    return jsonError(birth.error, 400)
  }
  try {
    const b = birth.value
    const sajuInput = buildSajuInputFromRequest({ ...b, year: b.birthYear, month: b.birthMonth, day: b.birthDay, hour: b.birthHour })
    return { birth: b, sajuInput }
  } catch (err) {
    if (!(err instanceof EngineInputError)) return serverError(TAG, err)
    return jsonError(SAJU_INPUT_ERROR_MESSAGE, 400)
  }
}

/** 주문에 연결된 풀이가 있으면 그 id, 없으면 PENDING 풀이를 만든다 (Reading.orderId UNIQUE로 1건 보장) */
async function ensureReading(
  orderDbId: string, userId: string, birth: BirthInput, sajuInput: SajuInputData, v3: boolean,
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
        // v3: 윤달·분·시각 입력 방식·출생지 경도를 열로도 남긴다(출생지 이름은 저장하지 않음)
        ...(v3 ? precisionColumns({ ...birth, hour: birth.birthHour }) : {}),
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

  const v3 = isDbSchemaV3()

  // 스위치 끔: 결제 승인 전에 클라이언트 생년월일을 검증한다 (승인 후 풀이를 못 만드는 상황 방지).
  // 입력 오류(EngineInputError)만 400, 그 밖의 예외는 엔진 결함이므로 500 — 어느 쪽이든 토스 승인 전에 멈춘다.
  // 스위치 켬: 주문을 읽은 뒤 서버 저장값(Order.birthInfo)으로 같은 검증을 한다(아래 resolveBirth).
  let clientPrepared: PreparedBirth | null = null
  if (!v3) {
    const p = prepareBirth(birthInfo, "client")
    if (p instanceof Response) return p
    clientPrepared = p
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

    /** 풀이 레코드를 확보한 뒤(v3) 주문에 둔 생년월일을 지운다. 실패해도 응답에는 영향 없음 */
    const clearStoredBirth = async () => {
      if (!v3 || order.birthInfo == null) return
      await prisma.order
        .updateMany({ where: { id: order.id, status: "PAID" }, data: { birthInfo: Prisma.DbNull } })
        .catch(e => console.error(`[${TAG}] 주문 birthInfo 정리 실패`, e))
    }

    /** 이 주문에 쓸 생년월일. Response면 그대로 응답하고 끝낸다(오류 또는 이미 있는 풀이 id) */
    const resolveBirth = async (): Promise<PreparedBirth | Response> => {
      if (!v3) return clientPrepared!
      if (order.status === "PAID") {
        // 이미 풀이가 있으면 생년월일을 다시 볼 필요가 없다
        const existing = await prisma.reading.findUnique({ where: { orderId: order.id }, select: { id: true } })
        if (existing) {
          await clearStoredBirth()
          return NextResponse.json({ readingId: existing.id })
        }
      }
      if (order.birthInfo != null) return prepareBirth(order.birthInfo, "server")
      if (order.status !== "PAID") {
        return jsonError("주문 정보가 만료되었습니다. 처음부터 다시 결제해 주세요.", 400)
      }
      // 결제는 끝났는데 풀이가 없고 서버 저장값도 없는 예전 주문 → 예외적으로 클라이언트 값으로 복구
      console.warn(`[${TAG}] 저장된 생년월일 없는 결제 완료 주문 — 클라이언트 값으로 풀이 복구`, { orderId })
      return prepareBirth(birthInfo, "client")
    }

    if (order.status === "PAID") {
      const b = await resolveBirth()
      if (b instanceof Response) return b
      const readingId = await ensureReading(order.id, userId, b.birth, b.sajuInput, v3)
      await clearStoredBirth()
      return NextResponse.json({ readingId })
    }
    if (order.status !== "PENDING") {
      return jsonError("이미 처리된 주문입니다. 새로 결제해 주세요.", 400)
    }

    // 토스 승인 전에 생년월일을 확정한다(못 쓰는 값이면 돈이 나가기 전에 멈춤)
    const prepared = await resolveBirth()
    if (prepared instanceof Response) return prepared

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

    const readingId = await ensureReading(order.id, userId, prepared.birth, prepared.sajuInput, v3)
    await clearStoredBirth()
    return NextResponse.json({ readingId })
  } catch (err) {
    // 결제는 됐는데 풀이 레코드 생성이 실패했을 수 있다 → 같은 요청을 다시 보내면 PAID 경로로 복구된다
    return serverError(TAG, err, "결제 확인 중 문제가 생겼습니다. 잠시 후 이 화면을 새로고침해 주세요.")
  }
}
