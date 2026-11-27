// 골든 테스트 공통 헬퍼 — 표본 단위 불일치를 모아 한 번에 보고한다.
import type { BirthInput } from "@/engine"
import { localToUtcUnique, utcToLocal, type LocalDateTime } from "./oracle"

export const SEOUL = "Asia/Seoul"

export function samePillar(a: { stem: string; branch: string } | null | undefined, b: { stem: string; branch: string }): boolean {
  return !!a && a.stem === b.stem && a.branch === b.branch
}

export const fmtP = (p: { stem: string; branch: string } | null | undefined) => (p ? `${p.stem}${p.branch}` : String(p))

/**
 * 표본마다 fn을 실행해 불일치 문자열을 모은다. fn이 null을 돌려주면 일치.
 * 엔진 예외(예: "not implemented")도 불일치로 기록한다.
 */
export function collect<T>(samples: T[], label: (s: T) => string, fn: (s: T) => string | null): string[] {
  const fails: string[] = []
  for (const s of samples) {
    try {
      const r = fn(s)
      if (r) fails.push(`${label(s)} → ${r}`)
    } catch (e) {
      fails.push(`${label(s)} → THROW ${(e as Error).message}`)
    }
  }
  return fails
}

export function assertNoFailures(fails: string[], total: number, what: string): void {
  if (fails.length === 0) return
  const head = fails.slice(0, 25).join("\n  ")
  throw new Error(`${what}: ${fails.length}/${total}건 불일치\n  ${head}${fails.length > 25 ? `\n  … 외 ${fails.length - 25}건` : ""}`)
}

/** 한국 법정시 벽시계 시각 → 엔진 입력(양력) */
export function solarInput(l: Pick<LocalDateTime, "year" | "month" | "day" | "hour" | "minute">, gender: "M" | "F" = "M", extra: Partial<BirthInput> = {}): BirthInput {
  return {
    calendar: "solar", year: l.year, month: l.month, day: l.day,
    time: { hour: l.hour, minute: l.minute }, timezone: SEOUL, gender, ...extra,
  }
}

export const lbl = (l: Pick<LocalDateTime, "year" | "month" | "day" | "hour" | "minute">) =>
  `${l.year}-${String(l.month).padStart(2, "0")}-${String(l.day).padStart(2, "0")} ${String(l.hour).padStart(2, "0")}:${String(l.minute).padStart(2, "0")}`

/** UTC 순간 → 분 단위로 자른 서울 벽시계 시각과, 그 벽시계 시각의 (유일한) UTC. 모호하면 null */
export function seoulMinuteOf(ms: number): { local: LocalDateTime; utc: number } | null {
  const local = utcToLocal(ms, SEOUL)
  local.second = 0
  const utc = localToUtcUnique(local, SEOUL)
  return utc === null ? null : { local, utc }
}
