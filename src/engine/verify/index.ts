// 풀이 결과 자동 검증기 (P4-04, verify@0.3.0 — 2차 블라인드 검토 불합격 후 구조 규칙으로 재설계) — 담당: 품질검증·보안 담당자
// verifyReading(reading, ctx) → VerifyReport. 순수 함수: AI·DB·네트워크·파일·현재 시각을 쓰지 않는다.
// 같은 입력이면 같은 보고서(발견 순서 포함). block이 하나라도 있으면 pass = false → 고객에게 보내지 않는다.
// 검사 항목(코드값): BASIS_NOT_IN_CHART·YEAR_GANZHI_MISMATCH / TENGOD_MISMATCH / FORBIDDEN_TOPIC / FAKE_CLASSIC_QUOTE /
//   BARNUM / MORAL_JUDGEMENT·GENDER_STEREOTYPE / SCIENTIFIC_CLAIM / KNOWN_FACT_AS_PREDICTION / UNSAFE_HTML / CRISIS_RESPONSE
// 설계·오탐 처리: docs/TEST_REPORT.md "verify@0.3.0" 절, docs/quality/verifier-v0.3-design.md, 각 checks/*.ts 머리말.
// 이 검증기는 출고 안전의 유일한 방어선이 아니다(사전·문법 밖 표현은 지나간다). review.needed가 true면 사람이 본다.
import { analyzeRules } from "../rules"
import type { RuleAnalysis } from "../rules/types"
import type { Finding, ReadingLike, Severity, VerifyContext, VerifyReport } from "./types"
import { VERIFY_VERSION } from "./types"
import { collectSegments, excerptOf } from "./text"
import { buildChartLetters, parsePillar } from "./letters"
import { checkBasis, checkStructuredGanzhi } from "./checks/basis"
import { buildTenGodLookup, checkTenGods } from "./checks/tengod"
import { checkForbidden } from "./checks/forbidden"
import { checkClassicQuotes } from "./checks/classic"
import { checkBarnum } from "./checks/barnum"
import { checkMoral } from "./checks/moral"
import { checkScience } from "./checks/science"
import { checkKnownFacts } from "./checks/known-facts"
import { checkHtml } from "./checks/html"
import { assessCrisis, checkCrisis } from "./checks/crisis"

export * from "./types"
export { collectSegments, splitSentences } from "./text"
export { buildChartLetters, findGanzhiTokens, GENERAL_HANJA_WORDS } from "./letters"
export { assessCrisis, detectCrisis, CRISIS_RE, COUNSEL_RE, type CrisisAssessment } from "./checks/crisis"
export { findMentions, bindTenGods, findTenGodNames } from "./mentions"
export { findHarms, modalityOf } from "./harm"
export { yearRefs, hasTiming } from "./timing"

const SEVERITY_ORDER: Record<Severity, number> = { block: 0, warn: 1, info: 2 }

function rulesFor(ctx: VerifyContext): RuleAnalysis | undefined {
  if (ctx.rules) return ctx.rules
  if (!ctx.chart) return undefined
  // 콘텐츠 엔진이 본 것과 같은 운 글자(sajuInput.daeun·올해)를 넣어 계산
  const luck = (ctx.sajuInput.daeun ?? []).map((d) => parsePillar(d.ganzhi)).filter((p): p is NonNullable<typeof p> => !!p)
  const seun = parsePillar(ctx.sajuInput.this_year_ganzhi)
  try {
    return analyzeRules(ctx.chart, undefined, { luck, ...(seun ? { year: seun } : {}) })
  } catch {
    return undefined
  }
}

/**
 * AI가 쓴 풀이(FullReading·ClaimsResult 또는 둘을 합친 객체)를 고객에게 보내기 전에 기계적으로 검사한다.
 * @param reading 검증 대상 JSON(파싱된 객체). 객체가 아니면 MALFORMED_READING block
 * @param ctx sajuInput(AI가 본 글자) 필수. chart·rules가 있으면 십성 대조에 쓴다
 */
export function verifyReading(reading: ReadingLike | unknown, ctx: VerifyContext): VerifyReport {
  const findings: Finding[] = []
  const stats: VerifyReport["stats"] = { texts: 0, sentences: 0, barnumByChapter: [] }
  const hasUserText = typeof ctx.userText === "string" && ctx.userText.trim() !== ""
  const hasFacts = (ctx.sajuInput?.known_facts ?? []).length > 0 || (ctx.userFacts ?? []).length > 0
  const crisis = hasUserText ? assessCrisis(ctx.userText) : null
  const coverage: VerifyReport["coverage"] = {
    crisis: hasUserText ? "ran" : "not-run:no-userText",
    crisisLevel: crisis ? crisis.level : "not-run",
    tenGods: ctx.rules ? "rules" : ctx.chart ? "chart" : "sajuInput",
    knownFacts: hasFacts ? "ran" : "not-run:no-facts",
    verifiedQuotes: (ctx.verifiedQuotes ?? []).length,
  }
  if (!reading || typeof reading !== "object" || Array.isArray(reading)) {
    findings.push({ severity: "block", code: "MALFORMED_READING", location: { path: "", field: "" }, excerpt: excerptOf(String(reading)), message: "풀이가 JSON 객체가 아님" })
    return finalize(findings, stats, coverage)
  }
  const r = reading as ReadingLike
  const letters = buildChartLetters(ctx.sajuInput ?? { pillars: { year: "", month: "", day: "" } }, ctx.rules?.options.hiddenStemTable)
  for (const p of letters.problems)
    findings.push({ severity: "block", code: "MALFORMED_READING", location: { path: "sajuInput", field: "pillars" }, excerpt: excerptOf(p), message: `검증 기준(sajuInput)이 깨져 근거 대조 불가: ${p}` })

  const segments = collectSegments(r)
  stats.texts = segments.length
  // 본문(body·text·claim)이 하나도 없으면 고객에게 보낼 내용이 없다 — 빈 풀이 통과 방지(독립 검토 edge)
  if (!segments.some((s) => s.narrative && s.text.trim() !== ""))
    findings.push({ severity: "block", code: "MALFORMED_READING", rule: "empty", location: { path: "", field: "" }, excerpt: "", message: "검사할 본문(body·text·claim)이 없음 — 빈 풀이는 보내지 않는다" })

  findings.push(...checkBasis(segments, letters))
  findings.push(...checkStructuredGanzhi(r, letters))
  findings.push(...checkTenGods(segments, buildTenGodLookup(letters, rulesFor(ctx)), letters))
  findings.push(...checkForbidden(segments))
  findings.push(...checkClassicQuotes(segments, ctx.verifiedQuotes ?? []))
  const barnum = checkBarnum(segments, ctx.options?.barnumRatio ?? 0.5, ctx.options?.barnumMinSentences ?? 1)
  findings.push(...barnum.findings)
  stats.barnumByChapter = barnum.stats
  stats.sentences = barnum.stats.reduce((n, s) => n + s.sentences, 0)
  findings.push(...checkMoral(segments))
  findings.push(...checkScience(segments))
  const d0 = (ctx.sajuInput?.daeun ?? [])[0]
  const birthYear = d0 && Number.isFinite(d0.start_year) && Number.isFinite(d0.start_age) ? d0.start_year - d0.start_age : null
  findings.push(...checkKnownFacts(segments, ctx.sajuInput?.known_facts ?? [], ctx.userFacts ?? [], birthYear))
  findings.push(...checkHtml(segments))
  findings.push(...checkCrisis(ctx.userText, r, segments, crisis ?? undefined))
  return finalize(findings, stats, coverage)
}

function finalize(findings: Finding[], stats: VerifyReport["stats"], coverage: VerifyReport["coverage"]): VerifyReport {
  // 안정 정렬: 심각도 → (같은 심각도 안에서는 검사 순서·경로 순서 유지)
  const sorted = findings.map((f, i) => ({ f, i })).sort((a, b) => SEVERITY_ORDER[a.f.severity] - SEVERITY_ORDER[b.f.severity] || a.i - b.i).map((x) => x.f)
  const counts: Record<Severity, number> = { block: 0, warn: 0, info: 0 }
  for (const f of sorted) counts[f.severity]++
  const reasons: string[] = []
  if (coverage.crisisLevel === "crisis") reasons.push("crisis")
  if (coverage.crisisLevel === "review") reasons.push("crisis-review")
  if (sorted.some((f) => f.code === "FORBIDDEN_TOPIC" && f.severity === "warn")) reasons.push("forbidden-warn")
  if (sorted.some((f) => f.code === "TENGOD_MISMATCH" && f.severity === "info")) reasons.push("tengod-uncertain")
  return {
    version: VERIFY_VERSION,
    pass: counts.block === 0,
    score: Math.max(0, 100 - 25 * counts.block - 5 * counts.warn),
    counts,
    findings: sorted,
    coverage,
    review: { needed: reasons.length > 0, reasons },
    stats,
  }
}

/** 보고서에서 사람이 읽을 한 줄 요약(로그용 — 개인정보·본문 전문을 넣지 않는다) */
export function summarizeReport(rep: VerifyReport): string {
  const codes = [...new Set(rep.findings.filter((f) => f.severity !== "info").map((f) => f.code))]
  return `${rep.version} ${rep.pass ? "PASS" : "BLOCK"} score=${rep.score} block=${rep.counts.block} warn=${rep.counts.warn} info=${rep.counts.info}${codes.length ? " codes=" + codes.join(",") : ""}${rep.coverage.crisis === "ran" ? (rep.coverage.crisisLevel !== "none" ? " crisis=" + rep.coverage.crisisLevel : "") : " crisis=not-run"}${rep.review.needed ? " review" : ""}`
}
