// 8. KNOWN_FACT_AS_PREDICTION — 사용자가 미리 알려 준 사실을 "맞힌" 단정으로 쓴 경우(원칙 2) → warn
// 사실 출처: sajuInput.known_facts(문자열) + ctx.userFacts(personalize UserFact: label·value·period)
// 판정(문장 단위, 질문문 제외):
//   - 사실에 연도가 있으면: 그 연도 + 사실의 핵심어(동의어 포함)가 같은 문장에 있으면 warn
//   - 연도가 없으면: 핵심어가 있고 지난 일을 단정하는 끝맺음(~했다·~었다)이면 warn
import type { Finding, TextSegment, VerifyUserFact } from "../types"
import { excerptOf, splitSentences, yearsInText } from "../text"
import { PAST_RE, QUESTION_RE } from "../patterns"

/** 생활 사건 동의어 묶음 — 사실 글에 앞쪽 낱말이 있으면 묶음 전체를 핵심어로 본다 */
const SYNONYMS: readonly string[][] = [
  ["결혼", "혼인", "짝을 맺", "식을 올", "시집", "장가"],
  ["이혼", "갈라서", "헤어"],
  ["이사", "이주", "사는 곳", "거처", "집을 옮"],
  ["취업", "입사", "직장을 얻", "일자리"],
  ["이직", "직장을 옮", "회사를 옮", "자리를 옮"],
  ["퇴사", "회사를 그만", "직장을 그만", "일을 그만"],
  ["창업", "사업을 시작", "가게를 열"],
  ["출산", "아이를 낳", "자식을 얻", "아이를 얻"],
  ["입학", "진학", "학교가 바뀌", "학교를 옮", "전학"],
  ["졸업"],
  ["유학", "외국", "해외"],
  ["입대", "군대", "군에"],
  ["수술", "입원", "몸을 다", "탈이 나"],
  ["사별", "여의", "돌아가"],
  ["승진", "자리가 올"],
  ["합격", "붙었"],
  ["연애", "사귀", "만나기 시작"],
]

const STOP = new Set(["했다", "했음", "함", "있음", "있었다", "그해", "올해", "작년", "때", "년"])

function keywordsOf(text: string): string[] {
  const kws = new Set<string>()
  for (const group of SYNONYMS) if (group.some((w) => text.includes(w))) group.forEach((w) => kws.add(w))
  // 묶음에 없는 사실: 2자 이상 한글 낱말(조사·끝말 떼고)
  if (kws.size === 0)
    for (const w of text.split(/[\s,·.]+/)) {
      const t = w.replace(/(을|를|이|가|은|는|에|에서|으로|로|했다|했음|함|하였다|됨|했어요)$/, "")
      if (/^[가-힣]{2,}$/.test(t) && !STOP.has(t)) kws.add(t)
    }
  return [...kws]
}

interface FactProbe {
  label: string
  years: number[]
  keywords: string[]
}

function probesOf(knownFacts: readonly string[], userFacts: readonly VerifyUserFact[]): FactProbe[] {
  const out: FactProbe[] = []
  for (const f of knownFacts) {
    if (typeof f !== "string" || !f.trim()) continue
    out.push({ label: f, years: yearsInText(f), keywords: keywordsOf(f) })
  }
  for (const f of userFacts) {
    const text = [f.label, f.value, f.topic].filter((x) => typeof x === "string").join(" ")
    const years: number[] = []
    if (f.period) for (let y = f.period.fromYear; y <= f.period.toYear && years.length < 50; y++) years.push(y)
    out.push({ label: f.label, years, keywords: keywordsOf(text) })
  }
  return out.filter((p) => p.keywords.length > 0)
}

export function checkKnownFacts(segments: TextSegment[], knownFacts: readonly string[], userFacts: readonly VerifyUserFact[]): Finding[] {
  const probes = probesOf(knownFacts, userFacts)
  if (probes.length === 0) return []
  const out: Finding[] = []
  for (const seg of segments) {
    if (seg.letterField) continue
    const sentences = splitSentences(seg.text)
    sentences.forEach((s, si) => {
      if (QUESTION_RE.test(s.text)) return
      const sy = new Set([...yearsInText(s.text), ...seg.contextYears])
      for (const p of probes) {
        const kw = p.keywords.find((k) => s.text.includes(k))
        if (!kw) continue
        const hit = p.years.length > 0 ? p.years.some((y) => sy.has(y)) : PAST_RE.test(s.text)
        if (!hit) continue
        out.push({
          severity: "warn",
          code: "KNOWN_FACT_AS_PREDICTION",
          location: sentences.length > 1 ? { ...seg.location, sentence: si } : seg.location,
          excerpt: excerptOf(s.text),
          message: `사용자가 미리 알려 준 사실(「${excerptOf(p.label, 20)}」)을 사주로 맞힌 것처럼 씀 — 배경으로만 쓰고 단정·문항에서 뺄 것`,
        })
        break
      }
    })
  }
  return out
}
