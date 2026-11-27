// 풀이 생성 1회 잠금 (DB 마이그레이션 없이 Reading.status 문자열로 구현)
//
// 상태 흐름: PENDING → GENERATING → COMPLETE
//                         └(실패)→ FAILED → (다시 시도) → GENERATING
//            claims/verify(개발 전용): PENDING → GENERATING → VERIFYING → GENERATING → COMPLETE
//
// - 잠금: updateMany(where 상태 IN 허용목록) → count 1인 요청만 AI를 호출한다(원자적).
// - 잠금 시각: Reading에 수정시각 열이 없어서, 같은 트랜잭션에서 연결된 Order.updatedAt을 갱신해 기록한다.
// - 서버가 강제 종료돼 GENERATING이 남은 경우: 잠금 시각이 STALE_MS보다 오래되면 FAILED로 되돌려
//   사용자가 "다시 시도"할 수 있게 한다(진행 중인 생성은 최대 실행시간이 STALE_MS보다 짧아 건드리지 않음).
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export const READING_STATUS = {
  PENDING: "PENDING",
  GENERATING: "GENERATING",
  VERIFYING: "VERIFYING",
  COMPLETE: "COMPLETE",
  FAILED: "FAILED",
} as const

/** 이 시간보다 오래된 GENERATING은 죽은 잠금으로 본다 (라우트 최대 실행시간 300초보다 충분히 길게) */
export const GENERATION_STALE_MS = 10 * 60 * 1000

export function isStaleGenerating(
  status: string,
  lockedAt: Date | null | undefined,
  now: number = Date.now(),
): boolean {
  if (status !== READING_STATUS.GENERATING || !lockedAt) return false
  return now - lockedAt.getTime() > GENERATION_STALE_MS
}

/** 죽은 GENERATING 잠금을 FAILED로 되돌린다 (본인 풀이만) */
export async function recoverStaleGeneration(id: string, userId: string): Promise<void> {
  await prisma.reading.updateMany({
    where: {
      id,
      userId,
      status: READING_STATUS.GENERATING,
      order: { is: { updatedAt: { lt: new Date(Date.now() - GENERATION_STALE_MS) } } },
    },
    data: { status: READING_STATUS.FAILED },
  })
}

/**
 * 원자적 잠금. 성공(true)한 요청 하나만 AI를 호출해야 한다.
 * fromStatuses: 잠금을 허용하는 현재 상태 목록.
 */
export async function acquireGenerationLock(
  id: string,
  userId: string,
  orderId: string,
  fromStatuses: readonly string[],
): Promise<boolean> {
  // 주의: 이 복구는 잠금 트랜잭션과 별도 문장으로 먼저 실행해야 한다(동시 요청 안전성).
  await recoverStaleGeneration(id, userId)

  return prisma.$transaction(async tx => {
    const locked = await tx.reading.updateMany({
      where: { id, userId, status: { in: [...fromStatuses] } },
      data: { status: READING_STATUS.GENERATING },
    })
    if (locked.count !== 1) return false
    await tx.order.update({ where: { id: orderId }, data: { updatedAt: new Date() } })
    return true
  })
}

/** 잠금을 잡은 요청이 결과를 기록한다. 여전히 GENERATING인 본인 풀이만 바꾼다. */
export async function finishGeneration(
  id: string,
  userId: string,
  data: Prisma.ReadingUpdateManyMutationInput,
): Promise<boolean> {
  const res = await prisma.reading.updateMany({
    where: { id, userId, status: READING_STATUS.GENERATING },
    data,
  })
  return res.count === 1
}

/** 제한 시간 안에 끝나지 않으면 예외. 라우트 maxDuration보다 짧게 잡아 실패 기록 기회를 남긴다. */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = "작업"): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} 제한 시간(${ms}ms) 초과`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}
