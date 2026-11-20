import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
  }

  const body = await req.json()
  const { birthYear, birthMonth, birthDay, birthHour, gender, calType } = body

  if (!birthYear || !birthMonth || !birthDay || !gender) {
    return NextResponse.json({ error: "입력 정보가 올바르지 않습니다." }, { status: 400 })
  }

  // 주문 ID 생성 (토스페이먼츠 형식: 영문+숫자, 최대 64자)
  const orderId = `saju_${session.user.id.slice(0, 8)}_${Date.now()}`

  const order = await prisma.order.create({
    data: {
      userId: session.user.id,
      orderId,
      amount: 19900,
      status: "PENDING",
    },
  })

  // 사주 정보는 결제 성공 후 저장하기 위해 임시로 반환
  return NextResponse.json({
    orderId: order.orderId,
    amount: order.amount,
    birthInfo: { birthYear, birthMonth, birthDay, birthHour, gender, calType },
  })
}
