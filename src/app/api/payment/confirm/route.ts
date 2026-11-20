import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateReading } from "@/lib/generate-reading"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
  }

  const { paymentKey, orderId, amount, birthInfo } = await req.json()

  // 주문 검증
  const order = await prisma.order.findUnique({ where: { orderId } })
  if (!order || order.userId !== session.user.id) {
    return NextResponse.json({ error: "유효하지 않은 주문입니다." }, { status: 400 })
  }
  if (order.amount !== amount) {
    return NextResponse.json({ error: "결제 금액이 일치하지 않습니다." }, { status: 400 })
  }
  if (order.status !== "PENDING") {
    return NextResponse.json({ error: "이미 처리된 주문입니다." }, { status: 400 })
  }

  // 토스페이먼츠 결제 승인
  const tossRes = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  })

  if (!tossRes.ok) {
    const err = await tossRes.json()
    await prisma.order.update({ where: { orderId }, data: { status: "FAILED" } })
    return NextResponse.json({ error: err.message || "결제 승인에 실패했습니다." }, { status: 400 })
  }

  // 주문 상태 업데이트
  await prisma.order.update({
    where: { orderId },
    data: { status: "PAID", paymentKey },
  })

  // AI 사주 풀이 생성
  const { birthYear, birthMonth, birthDay, birthHour, gender, calType } = birthInfo
  const content = await generateReading({
    readingType: "BASIC",
    birthYear, birthMonth, birthDay,
    birthHour: birthHour ?? null,
    gender, calType,
  })

  // 풀이 저장
  const reading = await prisma.reading.create({
    data: {
      userId: session.user.id,
      orderId,
      birthYear,
      birthMonth,
      birthDay,
      birthHour: birthHour ?? null,
      gender,
      calType: calType || "SOLAR",
      content,
    },
  })

  return NextResponse.json({ readingId: reading.id })
}
