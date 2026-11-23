import { notFound, redirect } from "next/navigation"
import { connection } from "next/server"
import { auth } from "@/lib/auth"

export const instant = false
import { prisma } from "@/lib/prisma"
import { calculateSaju } from "@/lib/saju"
import ReadingViewer from "./ReadingViewer"
import ReadingPending from "./ReadingPending"
import type { FullReading } from "@/lib/generate-reading-v2"

const READING_LABELS: Record<string, string> = {
  BASIC:    "나는 어떤 사람인가",
  MONEY:    "나는 왜 돈이 안 모일까",
  LOVE:     "나는 왜 연애가 안 될까",
  CAREER:   "나는 왜 직장이 안 맞을까",
  BULLY:    "이 사람은 왜 나를 괴롭힐까",
  CONFLICT: "우리는 왜 맨날 싸울까",
}

const ELEMENT_COLORS: Record<string, string> = {
  목: "#7fbf8c", 화: "#ec8a72", 토: "#dcae6e", 금: "#b6bcc6", 수: "#6b9bcb",
}

export default async function ReadingPage({ params }: { params: Promise<{ id: string }> }) {
  await connection()
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  // 로컬 DB ID 불일치 대응: 세션 이메일로 실제 userId 조회
  let effectiveUserId = session.user.id
  if (session.user.email) {
    const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (dbUser) effectiveUserId = dbUser.id
  }

  const reading = await prisma.reading.findUnique({ where: { id } })
  if (!reading || reading.userId !== effectiveUserId) notFound()

  const saju = calculateSaju(
    reading.birthYear, reading.birthMonth, reading.birthDay,
    reading.birthHour, reading.gender, reading.calType
  )

  const pillars = [
    { label: "연주", stem: saju.year.stem, branch: saju.year.branch, element: saju.year.element, branchEl: saju.year.branchElement },
    { label: "월주", stem: saju.month.stem, branch: saju.month.branch, element: saju.month.element, branchEl: saju.month.branchElement },
    { label: "일주", stem: saju.day.stem, branch: saju.day.branch, element: saju.day.element, branchEl: saju.day.branchElement, me: true },
    ...(saju.hour ? [{ label: "시주", stem: saju.hour.stem, branch: saju.hour.branch, element: saju.hour.element, branchEl: saju.hour.branchElement }] : []),
  ]

  const fiveElements = ["목", "화", "토", "금", "수"].map(el => ({
    el,
    count: pillars.reduce((n, p) => n + (p.element === el ? 1 : 0) + (p.branchEl === el ? 1 : 0), 0),
  }))

  const calStr = reading.calType === "SOLAR" ? "양력" : "음력"
  const genderStr = reading.gender === "M" ? "남성" : "여성"
  const hourStr = reading.birthHour !== null ? ` ${reading.birthHour}시` : ""
  const birthInfo = `${calStr} ${reading.birthYear}년 ${reading.birthMonth}월 ${reading.birthDay}일${hourStr} · ${genderStr}`

  const createdAt = new Date(reading.createdAt).toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric",
  })

  if (reading.status === "PENDING" || reading.status === "FAILED") {
    return <ReadingPending readingId={id} status={reading.status} />
  }

  return (
    <ReadingViewer
      userName={reading.name || session.user.name || "사용자"}
      readingName={READING_LABELS[reading.readingType] || "사주풀이"}
      readingType={reading.readingType}
      birthInfo={birthInfo}
      pillars={pillars}
      fiveElements={fiveElements}
      content={reading.content}
      fullReading={reading.fullReading ? (reading.fullReading as unknown as FullReading) : undefined}
      createdAt={createdAt}
    />
  )
}
