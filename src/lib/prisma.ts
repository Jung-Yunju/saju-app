import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function buildDatasourceUrl(base: string | undefined): string | undefined {
  if (!base) return undefined
  try {
    const url = new URL(base)
    // Neon 무료 플랜 auto-suspend 해제 대기 시간 확보
    if (!url.searchParams.has("connect_timeout")) {
      url.searchParams.set("connect_timeout", "30")
    }
    return url.toString()
  } catch {
    return base
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    datasourceUrl: buildDatasourceUrl(process.env.DATABASE_URL),
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
