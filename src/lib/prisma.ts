import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  })

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
