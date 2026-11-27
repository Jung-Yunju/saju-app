// 콘텐츠 엔진 모델·단가표·비용 추정 (P4-03) — 담당: 백엔드·서버 개발자
// 단가: 100만 토큰당 USD. 출처는 docs/COST_REPORT.md §2(총괄실장 지시 단가표, 2026-11 기준). 바뀌면 여기와 COST_REPORT를 함께 고친다.
// 모델 ID는 날짜 접미사 없는 정확한 ID만 허용한다.

export const CONTENT_MODELS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"] as const
export type ContentModel = (typeof CONTENT_MODELS)[number]

/** 기본 모델(비용 결정은 대표 몫 — 운영 연결 전 확정) */
export const DEFAULT_CONTENT_MODEL: ContentModel = "claude-opus-5-5"

export interface ModelPrice {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

export const PRICING_USD_PER_MTOK: Readonly<Record<ContentModel, ModelPrice>> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
}

export function isContentModel(m: unknown): m is ContentModel {
  return typeof m === "string" && (CONTENT_MODELS as readonly string[]).includes(m)
}

/**
 * 모델 결정: 명시값 → 환경변수 CONTENT_MODEL → 기본값. 목록에 없는 ID(날짜 접미사·오타 포함)는 오류.
 * 환경변수는 호출 시점에 읽는다(테스트·배포 환경마다 다를 수 있음).
 */
export function resolveContentModel(explicit?: string, env: Record<string, string | undefined> = process.env): ContentModel {
  const raw = (explicit ?? env.CONTENT_MODEL ?? "").trim()
  if (!raw) return DEFAULT_CONTENT_MODEL
  if (!isContentModel(raw)) throw new Error(`CONTENT_MODEL 값이 허용 목록(${CONTENT_MODELS.join(", ")})에 없음`)
  return raw
}

export interface TokenUsage {
  /** 캐시되지 않은 입력 토큰(API usage.input_tokens) */
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

/** 비용 추정(USD, 소수 6자리). 입력 합계 = input + cacheRead + cacheWrite (API 정의) */
export function estimateCostUsd(model: ContentModel, u: TokenUsage): number {
  const p = PRICING_USD_PER_MTOK[model]
  const usd = (u.inputTokens * p.input + u.outputTokens * p.output + u.cacheReadTokens * p.cacheRead + u.cacheWriteTokens * p.cacheWrite) / 1_000_000
  return Math.round(usd * 1e6) / 1e6
}

/**
 * 문자 수 기반 토큰 근사(API 호출 없이 미리보기용). 실제 값과 ±30% 이상 다를 수 있다.
 * ASCII(영문·숫자·JSON 기호)는 약 3.5자당 1토큰, 한글·한자 등은 1자당 1토큰으로 넉넉히 잡는다.
 */
export function approxTokens(text: string): number {
  let ascii = 0
  let other = 0
  for (const ch of text) {
    if (ch.charCodeAt(0) < 128) ascii++
    else other++
  }
  return Math.ceil(ascii / 3.5 + other)
}
