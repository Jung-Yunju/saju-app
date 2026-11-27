// 1. BASIS_NOT_IN_CHART · YEAR_GANZHI_MISMATCH — 근거 글자가 원국·대운·세운에 실제 있는가
// 허용 글자 = 원국 네 기둥 + sajuInput.daeun 전부 + 올해 간지
//           + (같은 문장·같은 항목에 적힌 연도의 세운 간지 — 예: "2015년 乙未", years[].year, dictionary.years)
//           + 공망 지지(한 글자) + 원국 지지의 지장간(문장에 "지장간·속에" 등이 있으면 통과, 없으면 warn)
import type { Finding, ReadingLike, TextSegment } from "../types"
import { excerptAt, excerptOf, splitSentences, yearsInText } from "../text"
import { findGanzhiTokens, hangulToGanzhi, HIDDEN_MARKER_RE, LUCK_MARKER_RE, parsePillar, yearGanzhi, type ChartLetters } from "../letters"

const YEAR_LABEL_RE = /(1[89]\d{2}|20\d{2})\s*년?\s*[(（]?\s*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]|[갑을병정무기경신임계][자축인묘진사오미신유술해](?=\s?년))/g

function checkText(
  seg: TextSegment,
  text: string,
  offsetSentence: number | undefined,
  letters: ChartLetters,
  years: number[],
  strict: boolean,
  out: Finding[],
) {
  const loc = offsetSentence === undefined ? seg.location : { ...seg.location, sentence: offsetSentence }
  const localPillars = new Map<string, number>()
  for (const y of years) localPillars.set(yearGanzhi(y), y)
  const seen = new Set<string>()

  // "2015년 丙申" 처럼 연도에 바로 붙인 간지가 그해 간지와 다른가
  for (const m of text.matchAll(YEAR_LABEL_RE)) {
    const y = Number(m[1])
    const g = /[가-힣]/.test(m[2]) ? hangulToGanzhi(m[2]) : m[2]
    if (!g) continue
    const real = yearGanzhi(y)
    if (g === real) continue
    const tail = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 4)
    // "2011년 丁亥 대운이 들어와" — 그해 시작한 대운 이름이면 정상
    const isDaeunLabel = /^\s?대운/.test(tail) && letters.daeun.some((d) => d.ganzhi === g)
    if (isDaeunLabel) continue
    seen.add(`Y:${g}`)
    out.push({
      severity: "block",
      code: "YEAR_GANZHI_MISMATCH",
      location: loc,
      excerpt: excerptAt(text, m.index ?? 0, m[0].length),
      message: `${y}년의 간지는 ${real}인데 ${g}로 적음`,
    })
  }

  for (const t of findGanzhiTokens(text, strict)) {
    const key = `${t.kind === "char" ? "C" : "P"}:${t.value}`
    if (seen.has(key) || seen.has(`Y:${t.value}`)) continue
    if (t.kind !== "char") {
      if (letters.pillars.has(t.value) || localPillars.has(t.value)) continue
      seen.add(key)
      const p = parsePillar(t.value)
      const partsKnown = p ? [p.stem, p.branch].filter((c) => letters.chars.has(c)) : []
      out.push({
        severity: "block",
        code: "BASIS_NOT_IN_CHART",
        location: loc,
        excerpt: excerptAt(text, t.index, t.length),
        rule: t.kind === "hangulPillar" ? "hangul-pillar" : "pillar",
        message:
          `간지 ${t.value}는 원국·대운·올해(또는 문장에 적힌 해)의 어느 기둥에도 없음` +
          (partsKnown.length === 2 ? " (두 글자는 각각 다른 기둥에 있음 — 없는 기둥을 지어낸 것)" : ""),
      })
      continue
    }
    const c = t.value
    if (letters.natalChars.has(c)) continue
    if ([...localPillars.keys()].some((g) => g.includes(c))) continue
    if (letters.gongmang.has(c)) continue
    const isHidden = letters.hidden.has(c)
    if (isHidden && HIDDEN_MARKER_RE.test(text)) continue
    const luckSources = (letters.chars.get(c) ?? []).filter((l) => !/^(연주|월주|일주|시주)$/.test(l))
    if (luckSources.length > 0 && (strict || LUCK_MARKER_RE.test(text))) continue
    seen.add(key)
    if (luckSources.length > 0 || isHidden) {
      out.push({
        severity: "warn",
        code: "BASIS_NOT_IN_CHART",
        location: loc,
        excerpt: excerptAt(text, t.index, 1),
        rule: luckSources.length > 0 ? "luck-unmarked" : "hidden-only",
        message:
          luckSources.length > 0
            ? `${c}는 원국에 없고 운(${luckSources.join(", ")})에만 있음 — 문장에 대운·해·나이를 밝히지 않아 원국 글자처럼 읽힘`
            : `${c}는 겉 글자에 없고 지장간(${letters.hidden.get(c)!.join(", ")})에만 있음 — 지장간이라고 밝히지 않음`,
      })
      continue
    }
    out.push({
      severity: "block",
      code: "BASIS_NOT_IN_CHART",
      location: loc,
      excerpt: excerptAt(text, t.index, 1),
      rule: "char",
      message: `${c}는 원국·대운·올해(또는 문장에 적힌 해)·공망·지장간 어디에도 없는 글자`,
    })
  }
}

export function checkBasis(segments: TextSegment[], letters: ChartLetters): Finding[] {
  const out: Finding[] = []
  for (const seg of segments) {
    if (seg.letterField) {
      checkText(seg, seg.text, undefined, letters, [...seg.contextYears, ...yearsInText(seg.text)], true, out)
      continue
    }
    const sentences = splitSentences(seg.text)
    sentences.forEach((s, i) => {
      checkText(seg, s.text, sentences.length > 1 ? i : undefined, letters, [...seg.contextYears, ...yearsInText(s.text)], false, out)
    })
  }
  return out
}

/** 구조 칸 대조: years[].ganzhi = 그해 세운, daeun_overview·life_graph의 간지 = 실제 대운 */
export function checkStructuredGanzhi(reading: ReadingLike, letters: ChartLetters): Finding[] {
  const out: Finding[] = []
  const years = Array.isArray(reading.years) ? reading.years : []
  years.forEach((y: unknown, i: number) => {
    const e = y as { year?: unknown; ganzhi?: unknown }
    if (typeof e?.year !== "number" || typeof e.ganzhi !== "string") return
    const real = yearGanzhi(e.year)
    if (e.ganzhi.trim() !== real)
      out.push({
        severity: "block",
        code: "YEAR_GANZHI_MISMATCH",
        location: { path: `years[${i}].ganzhi`, field: "ganzhi" },
        excerpt: excerptOf(`${e.year} ${e.ganzhi}`),
        message: `${e.year}년의 간지는 ${real}인데 ${e.ganzhi}로 적음`,
      })
  })
  const dz = Array.isArray(reading.daeun_overview) ? reading.daeun_overview : []
  dz.forEach((d: unknown, i: number) => {
    const e = d as { ganzhi?: unknown; start_year?: unknown; start_age?: unknown }
    if (typeof e?.ganzhi !== "string") return
    const hit = letters.daeun.find((x) => x.ganzhi === e.ganzhi!.toString().trim())
    if (!hit) {
      out.push({
        severity: "block",
        code: "BASIS_NOT_IN_CHART",
        location: { path: `daeun_overview[${i}].ganzhi`, field: "ganzhi" },
        excerpt: excerptOf(String(e.ganzhi)),
        rule: "daeun",
        message: `대운 개요의 ${e.ganzhi}는 계산된 대운 목록에 없음`,
      })
      return
    }
    if ((typeof e.start_year === "number" && e.start_year !== hit.start_year) || (typeof e.start_age === "number" && e.start_age !== hit.start_age))
      out.push({
        severity: "block",
        code: "BASIS_NOT_IN_CHART",
        location: { path: `daeun_overview[${i}]`, field: "start_year" },
        excerpt: excerptOf(`${e.ganzhi} ${String(e.start_year)} ${String(e.start_age)}세`),
        rule: "daeun-start",
        message: `${e.ganzhi} 대운 시작이 계산값(${hit.start_year}년, ${hit.start_age}세)과 다름`,
      })
  })
  const lg = reading.life_graph as { periods?: unknown } | undefined
  const periods = lg && Array.isArray(lg.periods) ? lg.periods : []
  periods.forEach((p: unknown, i: number) => {
    const e = p as { ganzhi?: unknown }
    if (typeof e?.ganzhi !== "string") return
    const g = e.ganzhi.trim()
    const ok = letters.daeun.some((d) => d.ganzhi === g) || (letters.natal.month && g === letters.natal.month.stem + letters.natal.month.branch)
    if (!ok)
      out.push({
        severity: "block",
        code: "BASIS_NOT_IN_CHART",
        location: { path: `life_graph.periods[${i}].ganzhi`, field: "ganzhi" },
        excerpt: excerptOf(g),
        rule: "daeun",
        message: `인생 그래프 구간 간지 ${g}가 대운(또는 대운 전 월주)에 없음`,
      })
  })
  return out
}
