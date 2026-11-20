import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma, withRetry } from "@/lib/prisma"
import { buildSajuInput } from "@/lib/saju-input"
import { generateClaims } from "@/lib/generate-reading-v2"

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
  }

  const body = await req.json()
  const {
    readingType = "BASIC",
    name, birthYear, birthMonth, birthDay, birthHour, gender, calType = "SOLAR",
    otherName, otherBirthYear, otherBirthMonth, otherBirthDay, otherBirthHour, otherGender,
  } = body

  if (!birthYear || !birthMonth || !birthDay || !gender) {
    return NextResponse.json({ error: "생년월일과 성별을 입력해주세요." }, { status: 400 })
  }

  try {
    const orderId = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

    const order = await withRetry(() => prisma.order.create({
      data: {
        userId: session.user.id,
        orderId,
        amount: 0,
        status: "PAID",
      },
    }))

    // 사주 입력 JSON 계산
    const sajuInput = buildSajuInput(
      birthYear, birthMonth, birthDay,
      birthHour ?? null, gender, calType, name || undefined,
    )

    // 1차 호출: 과거 검증 단정
    const claimsResult = await generateClaims(sajuInput)

    // DB 저장 (status=VERIFYING — 2차 호출 대기)
    const reading = await withRetry(() => prisma.reading.create({
      data: {
        userId: session.user.id,
        orderId: order.id,
        readingType,
        name: name || null,
        birthYear, birthMonth, birthDay,
        birthHour: birthHour ?? null,
        gender, calType,
        otherName: otherName || null,
        otherBirthYear: otherBirthYear ?? null,
        otherBirthMonth: otherBirthMonth ?? null,
        otherBirthDay: otherBirthDay ?? null,
        otherBirthHour: otherBirthHour ?? null,
        otherGender: otherGender ?? null,
        status: "VERIFYING",
        sajuInput: sajuInput as object,
        claims: claimsResult as object,
        content: "",
      },
    }))

    return NextResponse.json({
      readingId: reading.id,
      claims: claimsResult,
    })
  } catch (err) {
    console.error("[/api/reading/direct] 오류:", err)
    const message = err instanceof Error ? err.message : "알 수 없는 오류"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
