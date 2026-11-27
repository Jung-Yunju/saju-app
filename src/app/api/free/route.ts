// 무료 사주 결과 API — 로그인·DB·AI 없이 만세력 엔진 계산만 한다.
// 금지: prisma·Anthropic·세션 접근. 입력(생년월일 등)은 로그에 남기지 않는다.
import { NextRequest, NextResponse } from "next/server"
import { EngineInputError } from "@/engine"
import { buildSajuInputFromRequest, SAJU_INPUT_ERROR_MESSAGE } from "@/lib/saju-input"
import { readJsonBody, validateReadingRequest } from "@/lib/validate"
import { loadRawContent } from "@/app/free/_lib/content"
import { buildFreeResult } from "./_lib/build-result"
import { checkRateLimit, clientIp } from "./_lib/rate-limit"

/** 요청 본문 최대 크기(바이트). 입력 항목이 모두 차도 1KB 안팎이다 */
export const FREE_BODY_LIMIT = 2 * 1024

const HEADERS = { "Cache-Control": "no-store" }
const err = (message: string, status: number, extra: Record<string, string> = {}) =>
  NextResponse.json({ error: message }, { status, headers: { ...HEADERS, ...extra } })

export async function POST(req: NextRequest) {
  const limit = checkRateLimit(clientIp(req.headers))
  if (!limit.ok) {
    return err("잠시 후 다시 시도해 주세요. 요청이 너무 많아요.", 429, { "Retry-After": String(limit.retryAfterSec) })
  }

  const body = await readJsonBody(req, FREE_BODY_LIMIT)
  if (!body.ok) return err(body.error, 400)
  // 풀이 종류·이름은 무료 결과에서 쓰지 않는다. 검증만 재사용하고 값은 버린다.
  const input = validateReadingRequest(body.value)
  if (!input.ok) return err(input.error, 400)
  const v = input.value

  try {
    const sajuInput = buildSajuInputFromRequest({ ...v, year: v.birthYear, month: v.birthMonth, day: v.birthDay, hour: v.birthHour })
    const result = buildFreeResult(sajuInput, loadRawContent())
    return NextResponse.json(result, { headers: HEADERS })
  } catch (e) {
    if (e instanceof EngineInputError) return err(SAJU_INPUT_ERROR_MESSAGE, 400)
    // 입력값이 섞일 수 있는 메시지는 남기지 않고 오류 종류만 기록한다
    console.error("[/api/free] 계산 실패:", e instanceof Error ? e.name : "unknown")
    return err("일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.", 500)
  }
}
