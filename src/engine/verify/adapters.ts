// 콘텐츠 엔진(P4-03) 연결용 어댑터 — FactSheet → VerifyContext, 장 하나 검사
// 콘텐츠 엔진 계약(src/engine/content/types.ts)이 바뀌면 이 파일이 컴파일 오류로 알려 준다.
import type { FactSheet } from "../content/types"
import type { ReadingChapterLike, VerifyContext, VerifyReport, VerifyUserFact } from "./types"
import { verifyReading } from "./index"

/** "2019", "2019~2021", "2019-2021" → 연도 구간. 못 읽으면 undefined */
function parsePeriod(p: string | undefined): VerifyUserFact["period"] {
  if (typeof p !== "string") return undefined
  const ys = (p.match(/(1[89]\d{2}|20\d{2})/g) ?? []).map(Number)
  if (ys.length === 0) return undefined
  return { fromYear: Math.min(...ys), toYear: Math.max(...ys) }
}

/** AI에 넘긴 사실표 그대로 검증 기준을 만든다(AI가 본 글자 = 검증 기준 글자) */
export function contextFromFactSheet(facts: FactSheet, extra: Partial<Pick<VerifyContext, "rules" | "chart" | "userText" | "verifiedQuotes" | "options">> = {}): VerifyContext {
  const p = facts.chart.pillars
  return {
    sajuInput: {
      pillars: { year: p.year, month: p.month, day: p.day, ...(p.hour ? { hour: p.hour } : {}) },
      hour_unknown: !facts.subject.hourKnown || !p.hour,
      daeun: facts.luck.daeun.map((d) => ({ start_year: d.startYear, start_age: d.startAge, ganzhi: d.ganzhi })),
      gongmang: { day: facts.chart.gongmang.branches.join("") },
      this_year: facts.luck.thisYear.year,
      this_year_ganzhi: facts.luck.thisYear.ganzhi,
      known_facts: [],
    },
    userFacts: facts.personal.userFacts.map((f) => ({ label: f.value, topic: f.topic, value: f.value, period: parsePeriod(f.period) })),
    ...extra,
  }
}

/** 장(chapter) 하나만 검사(장 단위 생성·재시도용). 위치는 parts[0].chapters[0]로 나온다 */
export function verifyChapter(chapter: ReadingChapterLike | unknown, ctx: VerifyContext): VerifyReport {
  if (!chapter || typeof chapter !== "object" || Array.isArray(chapter)) return verifyReading(chapter, ctx)
  return verifyReading({ parts: [{ chapters: [chapter as ReadingChapterLike] }] }, ctx)
}
