// 독립 검증(품질검증 담당자 외부 리뷰)용 고정 사주·도우미.
// 실제 만세력(buildSajuInput)으로 만든 사주를 쓴다. 기준 시각을 고정해 "올해" = 2026(丙午).
import { buildSajuInput } from "@/lib/saju-input"
import { verifyReading, type FindingCode, type Severity, type VerifyContext, type VerifyReport } from "@/engine/verify"

const NOW = new Date("2026-11-27T03:00:00Z")

/**
 * 사주 A — 여, 1990-05-15 14시 양력
 * 원국 庚午 辛巳 庚辰 癸未 (일간 庚金) · 대운 庚辰 己卯 戊寅 丁丑(2023~) 丙子 乙亥 甲戌 癸酉 · 올해 丙午 · 공망 申酉/戌亥
 * 십성(일간 庚): 辛 겁재, 癸 상관, 午 정관, 巳 편관, 辰 편인, 未 정인, 丙 편관, 丁 정관
 * 어디에도 없는 글자: 壬
 */
export const SAJU_A = buildSajuInput(1990, 5, 15, 14, "F", "SOLAR", undefined, false, { now: NOW })
/** 사주 A를 시각 모름으로 — 시주 없음(癸未가 사라짐) */
export const SAJU_A_NOHOUR = buildSajuInput(1990, 5, 15, null, "F", "SOLAR", undefined, false, { now: NOW })
/**
 * 사주 B — 남, 1985-11-03 07시 양력
 * 원국 乙丑 丙戌 丙午 辛卯 (일간 丙火) · 대운 乙酉 甲申 癸未 壬午(2024~) 辛巳 庚辰 己卯 戊寅 · 올해 丙午 · 공망 寅卯/戌亥
 * 십성(일간 丙): 乙 정인, 辛 정재, 丑 상관, 戌 식신, 午 겁재, 卯 정인, 壬 편관
 * 어디에도 없는 글자: 丁, 子
 */
export const SAJU_B = buildSajuInput(1985, 11, 3, 7, "M", "SOLAR", undefined, false, { now: NOW })

export type ChartId = "A" | "B" | "A_NOHOUR"
const SAJU = { A: SAJU_A, B: SAJU_B, A_NOHOUR: SAJU_A_NOHOUR }

export function ctxOf(chart: ChartId = "A", extra: Partial<VerifyContext> = {}): VerifyContext {
  const s = SAJU[chart]
  return {
    sajuInput: {
      pillars: s.pillars,
      hour_unknown: s.hour_unknown,
      daeun: s.daeun,
      gongmang: s.gongmang,
      this_year: s.this_year,
      this_year_ganzhi: s.this_year_ganzhi,
      known_facts: s.known_facts,
      gender: s.gender,
    },
    ...extra,
  }
}

/** 본문 문단들로 장 하나짜리 풀이를 만든다 */
export function oneChapter(body: string[], title = "네 타고난 결"): { parts: { title: string; chapters: { key: string; title: string; body: string[] }[] }[] } {
  return { parts: [{ title: "첫째 마당", chapters: [{ key: "ch1", title, body }] }] }
}

const RANK: Record<Severity | "none", number> = { block: 3, warn: 2, info: 1, none: 0 }

/** 보고서에서 주어진 코드들 중 가장 높은 심각도 */
export function worst(rep: VerifyReport, codes: FindingCode[]): Severity | "none" {
  let best: Severity | "none" = "none"
  for (const f of rep.findings) if (codes.includes(f.code) && RANK[f.severity] > RANK[best]) best = f.severity
  return best
}

export function meets(got: Severity | "none", want: "block" | "warn"): boolean {
  return RANK[got] >= RANK[want]
}

export function run(reading: unknown, chart: ChartId = "A", extra: Partial<VerifyContext> = {}): VerifyReport {
  return verifyReading(reading, ctxOf(chart, extra))
}

/** 실패 시 원인을 보기 쉽게 */
export function brief(rep: VerifyReport): string {
  return rep.findings.map((f) => `${f.severity}:${f.code}${f.rule ? "/" + f.rule : ""}「${f.excerpt}」`).join(" | ") || "(발견 없음)"
}
