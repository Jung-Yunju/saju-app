import { PrismaClient } from "@prisma/client"
import { withLegacySchemaCompat } from "@/lib/db-legacy"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// 옛 스키마 호환 계층(src/lib/db-legacy.ts): DB_SCHEMA_V3가 꺼져 있으면 마이그레이션 reading_v3_safety 전 DB에서도
// 동작하게 선택 열·쓰기 열을 옛 열로 한정한다. 켜져 있으면 그대로 통과(타입도 같은 PrismaClient).
export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  withLegacySchemaCompat(
    new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    }),
  )

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

// Neon auto-suspend 대응: DB 연결 실패 시 최대 2회 재시도
export async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 2000): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn()
    } catch (err) {
      const isConnErr = err instanceof Error &&
        (err.message.includes("Can't reach database") ||
         err.message.includes("Connection refused") ||
         err.message.includes("ECONNREFUSED") ||
         err.message.includes("connect timeout"))
      if (isConnErr && i < retries) {
        console.warn(`[prisma] DB 연결 실패, ${delayMs}ms 후 재시도 (${i + 1}/${retries})`)
        await new Promise(r => setTimeout(r, delayMs))
        continue
      }
      throw err
    }
  }
  throw new Error("unreachable")
}
