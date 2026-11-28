// 「운명비서」 무료 결과 API — 로그인·DB·AI 없이 만세력·규칙 엔진 계산만 한다(D-027 작업 6).
// 보안 조건은 /api/free와 같다: prisma·Anthropic·세션 금지, IP당 분당 요청 제한, 본문 2KB 제한, 입력값은 로그에 남기지 않는다.
// 이름은 받지 않는다(보내도 검증 전에 버린다 — 화면에서만 끼운다). 응답 형식: src/lib/unmyeong/free-types.ts UnmyeongFreeResponse
import { NextRequest, NextResponse } from "next/server"
import { EngineInputError } from "@/engine"
import { SAJU_INPUT_ERROR_MESSAGE } from "@/lib/saju-input"
import { readJsonBody } from "@/lib/validate"
import { buildUnmyeongFree, UNMYEONG_FREE_BODY_LIMIT, validateUnmyeongFreeRequest } from "@/lib/unmyeong/free"
// 요청 제한은 /api/free와 같은 저장소를 쓴다(무료 계열 API 합산 IP당 분당 FREE_RATE_LIMIT회)
import { checkRateLimit, clientIp } from "@/app/api/free/_lib/rate-limit"

const HEADERS = { "Cache-Control": "no-store" }
const err = (message: string, status: number, extra: Record<string, string> = {}) =>
  NextResponse.json({ error: message }, { status, headers: { ...HEADERS, ...extra } })

export async function POST(req: NextRequest) {
  const limit = checkRateLimit(clientIp(req.headers))
  if (!limit.ok) {
    return err("잠시 후 다시 시도해 주세요. 요청이 너무 많아요.", 429, { "Retry-After": String(limit.retryAfterSec) })
  }

  const body = await readJsonBody(req, UNMYEONG_FREE_BODY_LIMIT)
  if (!body.ok) return err(body.error, 400)
  const input = validateUnmyeongFreeRequest(body.value)
  if (!input.ok) return err(input.error, 400)

  try {
    return NextResponse.json(buildUnmyeongFree(input.value), { headers: HEADERS })
  } catch (e) {
    if (e instanceof EngineInputError) return err(SAJU_INPUT_ERROR_MESSAGE, 400)
    // 입력값이 섞일 수 있는 메시지는 남기지 않고 오류 종류만 기록한다
    console.error("[/api/unmyeong/free] 계산 실패:", e instanceof Error ? e.name : "unknown")
    return err("일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.", 500)
  }
}
