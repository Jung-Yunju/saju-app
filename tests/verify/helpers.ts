// P4-04 검증기 테스트 도우미
import { verifyReading, type Finding, type FindingCode, type ReadingLike, type VerifyContext, type VerifySajuInput } from "@/engine/verify"
import { SAJU_1990F } from "./fixtures"

/**
 * 시주 모름·대운 없음의 작은 원국(庚午 辛巳 庚辰, 올해 2026 丙午) — 일반 한자어 오검출 시험용.
 * 겉 글자: 庚午辛巳辰丙 / 지장간: 丙己丁(午) 戊庚丙(巳) 乙癸戊(辰) / 공망: 申酉 戌亥
 * → 子·未·甲·壬·寅·卯·丑 은 어디에도 없는 글자
 */
export const SAJU_MIN: VerifySajuInput = {
  pillars: { year: "庚午", month: "辛巳", day: "庚辰" },
  hour_unknown: true,
  daeun: [],
  gongmang: { day: "申酉", year: "戌亥" },
  this_year: 2026,
  this_year_ganzhi: "丙午",
  known_facts: [],
}

/** 본문 한 문단짜리 풀이 */
export function readingOf(body: string | string[], extra: Partial<{ title: string; sub: string; todo: string; ask: string; letter: string }> = {}): ReadingLike {
  return {
    parts: [
      {
        title: "시험",
        chapters: [
          {
            key: "t",
            title: extra.title ?? "시험 장",
            sub: extra.sub ?? "",
            chips: extra.letter ? [{ letter: extra.letter, element: "metal", label: "" }] : [],
            body: Array.isArray(body) ? body : [body],
            todo: extra.todo ?? "",
            ask: extra.ask ?? "",
          },
        ],
      },
    ],
  }
}

export function run(reading: ReadingLike, ctx: Partial<VerifyContext> = {}) {
  return verifyReading(reading, { sajuInput: SAJU_1990F, ...ctx })
}

/** 본문 한 문단을 검사해 해당 코드의 발견만 돌려준다 */
export function findingsOf(body: string | string[], codes: FindingCode | FindingCode[], ctx: Partial<VerifyContext> = {}): Finding[] {
  const cs = Array.isArray(codes) ? codes : [codes]
  return run(readingOf(body), ctx).findings.filter((f) => cs.includes(f.code))
}

export const sev = (fs: Finding[]) => fs.map((f) => f.severity)
export const worst = (fs: Finding[]): "block" | "warn" | "info" | "none" =>
  fs.some((f) => f.severity === "block") ? "block" : fs.some((f) => f.severity === "warn") ? "warn" : fs.length ? "info" : "none"
