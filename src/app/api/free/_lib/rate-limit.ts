// 같은 IP의 분당 요청 제한(메모리 기반 단순 구현).
// 한계(서버리스): 인스턴스마다 메모리가 따로이고 콜드 스타트마다 초기화되므로 "대략의 남용 억제"일 뿐 정확한 제한이 아니다.
// 출시 전 정식 제한이 필요하면 호스팅 방화벽/WAF 또는 Redis(Upstash 등) 기반으로 교체한다(대표 승인 필요 — 외부 서비스).
// X-Forwarded-For는 앞단 프록시가 덮어쓸 때만 믿을 수 있다(직접 노출 시 위조 가능).
export const FREE_RATE_LIMIT = 12 // IP당 분당 최대 요청 수
export const FREE_RATE_WINDOW_MS = 60_000
const MAX_TRACKED_IPS = 5000

const hits = new Map<string, number[]>()

export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for")
  const first = xff?.split(",")[0]?.trim()
  return first || headers.get("x-real-ip")?.trim() || "unknown"
}

/** 허용이면 { ok: true }, 초과면 다시 시도할 때까지 남은 초 */
export function checkRateLimit(
  ip: string,
  now = Date.now(),
  limit = FREE_RATE_LIMIT,
  windowMs = FREE_RATE_WINDOW_MS,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= limit) {
    hits.set(ip, recent)
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) }
  }
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > MAX_TRACKED_IPS) sweep(now, windowMs)
  return { ok: true }
}

function sweep(now: number, windowMs: number) {
  for (const [k, v] of hits) {
    if (v.every((t) => now - t >= windowMs)) hits.delete(k)
  }
  // 그래도 넘치면 가장 오래된 것부터 버린다(메모리 상한)
  while (hits.size > MAX_TRACKED_IPS) {
    const oldest = hits.keys().next().value
    if (oldest === undefined) break
    hits.delete(oldest)
  }
}

/** 테스트용 */
export function resetRateLimit() {
  hits.clear()
}
