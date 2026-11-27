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
//
// DB 구조 v3(DB_SCHEMA_V3=true, 마이그레이션 reading_v3_safety 적용 후):
// - 시도 상한: 잠금 조건에 attemptCount < GENERATION_MAX_ATTEMPTS(기본 3)를 넣고 같은 문장에서 +1 → 풀이 1건당 AI 호출 상한.
//   상한에 닿으면 잠금을 못 잡으므로 AI를 부르지 않는다(claims·verify도 같은 횟수를 나눠 쓴다).
// - 잠금 시각: Reading.lockedAt에 기록. 상태 조회(status 라우트)가 아직 Order.updatedAt을 보므로 그것도 함께 갱신한다(이중 기록).
//   lockedAt이 NULL인 예전 GENERATING 행은 Order.updatedAt으로 판정한다.
// 스위치가 꺼져 있으면 위 내용 없이 예전 동작 그대로다.
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { isDbSchemaV3 } from "./schema-v3"

export { isDbSchemaV3 } from "./schema-v3"

export const READING_STATUS = {
  PENDING: "PENDING",
  GENERATING: "GENERATING",
  VERIFYING: "VERIFYING",
  COMPLETE: "COMPLETE",
  FAILED: "FAILED",
} as const

/** 이 시간보다 오래된 GENERATING은 죽은 잠금으로 본다 (라우트 최대 실행시간 300초보다 충분히 길게) */
export const GENERATION_STALE_MS = 10 * 60 * 1000

/** 풀이 1건당 AI 생성 시도 상한 기본값(v3). 첫 시도 1 + 다시 시도 2 */
export const DEFAULT_GENERATION_MAX_ATTEMPTS = 3
const MAX_ATTEMPTS_CEILING = 10

/** GENERATION_MAX_ATTEMPTS(1~10). 값이 없거나 잘못되면 기본 3 */
export function getGenerationMaxAttempts(env: Record<string, string | undefined> = process.env): number {
  const raw = env.GENERATION_MAX_ATTEMPTS?.trim()
  if (!raw || !/^\d{1,2}$/.test(raw)) return DEFAULT_GENERATION_MAX_ATTEMPTS
  const n = Number(raw)
  return n >= 1 && n <= MAX_ATTEMPTS_CEILING ? n : DEFAULT_GENERATION_MAX_ATTEMPTS
}

/** v3: 시도 횟수를 다 쓴 경우의 안내(결제 건은 운영자가 확인 후 재생성·환불을 처리한다 — docs/MAINTENANCE.md) */
export const ATTEMPTS_EXHAUSTED_MESSAGE =
  "풀이를 여러 번 만들어 보았지만 완성하지 못했습니다. 고객센터로 문의해 주시면 확인해 드리겠습니다."

/** v3: 시도 횟수를 다 써서 더는 잠금을 잡을 수 없는 상태인가 (완료·생성 중이면 false) */
export function isAttemptsExhausted(
  status: string,
  attemptCount: number | null | undefined,
  max: number = getGenerationMaxAttempts(),
): boolean {
  if (status === READING_STATUS.COMPLETE || status === READING_STATUS.GENERATING) return false
  return typeof attemptCount === "number" && attemptCount >= max
}

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
  const cutoff = new Date(Date.now() - GENERATION_STALE_MS)
  if (isDbSchemaV3()) {
    await prisma.reading.updateMany({
      where: {
        id,
        userId,
        status: READING_STATUS.GENERATING,
        OR: [
          { lockedAt: { lt: cutoff } },
          // 마이그레이션 전에 잠긴 행(lockedAt 없음)은 예전 방식으로 판정
          { lockedAt: null, order: { is: { updatedAt: { lt: cutoff } } } },
        ],
      },
      data: { status: READING_STATUS.FAILED },
    })
    return
  }
  await prisma.reading.updateMany({
    where: {
      id,
      userId,
      status: READING_STATUS.GENERATING,
      order: { is: { updatedAt: { lt: cutoff } } },
    },
    data: { status: READING_STATUS.FAILED },
  })
}

/**
 * 원자적 잠금. 성공(true)한 요청 하나만 AI를 호출해야 한다.
 * fromStatuses: 잠금을 허용하는 현재 상태 목록.
 * v3: 시도 횟수가 상한에 닿았으면 false(상태와 무관하게 AI 호출 금지).
 */
export async function acquireGenerationLock(
  id: string,
  userId: string,
  orderId: string,
  fromStatuses: readonly string[],
): Promise<boolean> {
  // 주의: 이 복구는 잠금 트랜잭션과 별도 문장으로 먼저 실행해야 한다(동시 요청 안전성).
  await recoverStaleGeneration(id, userId)

  if (isDbSchemaV3()) {
    const max = getGenerationMaxAttempts()
    return prisma.$transaction(async tx => {
      const now = new Date()
      // 상태·시도 횟수 확인과 +1을 한 문장으로 → 동시 요청이 와도 상한을 넘지 않는다
      const locked = await tx.reading.updateMany({
        where: { id, userId, status: { in: [...fromStatuses] }, attemptCount: { lt: max } },
        data: { status: READING_STATUS.GENERATING, lockedAt: now, attemptCount: { increment: 1 } },
      })
      if (locked.count !== 1) return false
      // status 라우트 호환용 이중 기록(그 라우트가 lockedAt을 보게 바뀌면 지운다)
      await tx.order.update({ where: { id: orderId }, data: { updatedAt: now } })
      return true
    })
  }

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
