// 세션 → 유효 userId 판별 (모든 API 라우트가 이 함수 하나만 쓴다)
//
// 규칙(기존 풀이 화면 src/app/reading/[id]/page.tsx 와 같은 순서):
//   1) 로그인 세션에 user.id가 없으면 null(=로그인 필요)
//   2) 세션 이메일로 DB User를 찾으면 그 id  ← 로컬 DB와 세션 id가 어긋나는 개발 환경 대응
//   3) 아니면 세션의 user.id
// createIfMissing=true(풀이·주문을 새로 만드는 경로)면 3)의 User 레코드가 없을 때 만든다.

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export interface SessionUser {
  userId: string
  name: string | null
}

export async function getSessionUser(
  opts: { createIfMissing?: boolean } = {},
): Promise<SessionUser | null> {
  const session = await auth()
  const sessionId = session?.user?.id
  if (!sessionId) return null

  const email = session.user?.email ?? null
  const name = session.user?.name ?? null

  if (email) {
    const byEmail = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (byEmail) return { userId: byEmail.id, name }
  }

  if (opts.createIfMissing) {
    const byId = await prisma.user.findUnique({ where: { id: sessionId }, select: { id: true } })
    if (!byId) {
      try {
        await prisma.user.create({
          data: { id: sessionId, email: email ?? `${sessionId}@local.dev`, name },
        })
      } catch (err) {
        // 동시 요청으로 이미 만들어졌을 수 있다. 그래도 없으면 실패 처리.
        const again = await prisma.user.findUnique({ where: { id: sessionId }, select: { id: true } })
        if (!again) throw err
      }
    }
  }

  return { userId: sessionId, name }
}
