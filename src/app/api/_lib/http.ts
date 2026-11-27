// API 공통 응답 도우미 — 클라이언트에는 일반 한국어 메시지만, 상세는 서버 로그로만 남긴다.
import { NextResponse } from "next/server"

export const MSG = {
  LOGIN_REQUIRED: "로그인이 필요합니다.",
  NOT_FOUND: "풀이를 찾을 수 없습니다.",
  SERVER_ERROR: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  GENERATION_FAILED: "풀이를 만드는 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.",
  FREE_READING_CLOSED: "지금은 무료 풀이를 제공하지 않습니다. 결제 후 이용해 주세요.",
} as const

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

/** 내부 오류를 로그로만 남기고 일반 메시지로 응답 */
export function serverError(tag: string, err: unknown, message: string = MSG.SERVER_ERROR) {
  console.error(`[${tag}]`, err)
  return jsonError(message, 500)
}
