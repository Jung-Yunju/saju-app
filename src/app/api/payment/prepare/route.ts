// 결제 주문 생성. 금액·상품은 서버가 정한다(클라이언트 값 무시).
import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionUser } from "@/lib/session-user"
import { readJsonBody, validateBirthInfo } from "@/lib/validate"
import { MSG, jsonError, serverError } from "../../_lib/http"

const TAG = "/api/payment/prepare"
const BASIC_PRICE = 19900

export async function POST(req: Request) {
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
  const birth = validateBirthInfo(body.value)
  if (!birth.ok) return jsonError(birth.error, 400)

  try {
    // 주문 ID (토스페이먼츠 형식: 영문·숫자·-·_, 6~64자)
    const orderId = `saju_${randomUUID().replace(/-/g, "")}`
    const order = await prisma.order.create({
      data: { userId, orderId, amount: BASIC_PRICE, status: "PENDING" },
    })

    // 사주 정보는 결제 성공 후 저장하기 위해 (검증된 값으로) 돌려준다
    return NextResponse.json({
      orderId: order.orderId,
      amount: order.amount,
      birthInfo: birth.value,
    })
  } catch (err) {
    return serverError(TAG, err)
  }
}
