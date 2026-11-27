// 1. BASIS_NOT_IN_CHART · YEAR_GANZHI_MISMATCH — 근거 글자가 원국·대운·세운에 실제 있는가
// 허용 글자 = 원국 네 기둥 + sajuInput.daeun 전부 + 올해 간지
//           + (같은 문장·같은 항목에 적힌 연도의 세운 간지 — 예: "2015년 乙未", years[].year, dictionary.years)
//           + 공망 지지(한 글자) + 원국 지지의 지장간(문장에 "지장간·속에" 등이 있으면 통과, 없으면 warn)
// 보완(verify@0.2.0, 독립 검토 반영):
//   - "일주는 辛未", "辛未일주", "네 일주 壬子"처럼 원국 자리를 붙여 말하면 그 자리의 실제 기둥과 대조(자리 불일치 block)
//   - 문장에 연도가 있어도 그해 세운 기둥은 그 연도 가까이(15자 안) 쓰였거나 "○○년/해"로 쓸 때만 허용
//   - "壬水가 한 글자도 없다"처럼 없는 글자를 없다고 말하는 문장은 info(부재 진술)
//   - 띄어 쓴 기둥("辛 未")·한글 간지("일주는 신미", "갑자생")·한글 오행 읽기("임수")도 토큰으로 센다(letters.ts)
// verify@0.3.0: 연도(절대·상대 "내년·작년·후년"·"그해·이듬해") ↔ 간지 결속 문법(yearGanzhiBindings)으로 그해 간지와 항상 대조.
//   조사·쉼표·괄호·"곧/즉"·"의 간지는"이 끼어도, 간지가 앞에 와도("丙午년인 2027년"), 그 간지가 올해·대운 기둥이어도 면제하지 않는다.
//   "X 대운"으로 묶이면 그해가 X 대운 기간(±1년) 안인지 본다(rule daeun-year).
import type { Finding, ReadingLike, TextSegment } from "../types"
import { excerptAt, excerptOf, splitSentences, yearsInText } from "../text"
import { findGanzhiTokens, hangulToGanzhi, HIDDEN_MARKER_RE, LUCK_MARKER_RE, parsePillar, yearGanzhi, type ChartLetters } from "../letters"
import { findMentions } from "../mentions"
import { yearRefs } from "../timing"

/** 대운·세운을 다루는 칸 — 이 안의 운 글자는 운이라고 밝힌 것으로 본다 */
const LUCK_PATH_RE = /^(daeun_overview|life_graph|years|shaky_years|review)\b/
/** 구조 검사(checkStructuredGanzhi)가 따로 보는 칸 */
const STRUCTURED_GANZHI_RE = /^(years|daeun_overview|life_graph\.periods)\[\d+\]\.ganzhi$/

/** 연도 → 간지 사이에 올 수 있는 말(조사·쉼표·"의 간지는"·"에 들어오는") */
const YEAR_TO_GZ_GAP_RE =
  /^\s*(?:년도?|해)?\s*(?:은|는|이|가|의|에|에는|엔|인|이라는|이란|라는|으로|부터|—|–|-|:|,|[(（])?\s*,?\s*(?:곧|즉|바로|그러니까)?\s*(?:(?:의\s?)?(?:간지|세운|해 기운|해 글자|글자|기운)(?:은|는|이|가)?|(?:에\s?)?(?:들어오는|찾아오는|오는|드는|닿는|맞는|만나는)|(?:이|가)\s?(?:되는|드는))?\s*$/
/** 간지 → 연도 사이 */
const GZ_TO_YEAR_GAP_RE = /^\s*(?:년|해)?\s*(?:인|이던|이었던|이 되는|이 드는|에 해당하는|이라는|라는|[(（]|—|–|-|:)?\s*$/
/** 한글 간지를 접미어 없이 연도 뒤에 쓴 꼴("2030년은 경술이다") — 서술격·문장부호가 뒤따를 때만 */
const HANGUL_GZ_AFTER_RE = /^([갑을병정무기경신임계][자축인묘진사오미신유술해])(?=\s?(?:년|해|[(（]|이다|이고|이며|이라|이니|이야|이란다|이지|[,.]|$))/

interface YearBinding {
  year: number
  g: string
  at: number
  len: number
  rel: boolean
  daeun: boolean
  label: string
}

const gzOf = (p: { stem: string; branch: string } | null) => (p ? p.stem + p.branch : "")

/** 문장 속 연도 표현과 그 연도에 붙인 간지(앞·뒤 어느 쪽이든) */
export function yearGanzhiBindings(text: string, letters: ChartLetters): YearBinding[] {
  const out: YearBinding[] = []
  const refs = yearRefs(text, letters.thisYear)
  if (refs.length === 0) return out
  const mentions = findMentions(text).filter((m) => m.pillar && m.chars.length === 2)
  for (const r of refs) {
    const label = text.slice(r.index, r.end).trim()
    // 뒤: 연도 + 사이말 + 간지
    for (const m of mentions) {
      if (m.index < r.end) continue
      if (m.index - r.end > 24) break
      if (!YEAR_TO_GZ_GAP_RE.test(text.slice(r.end, m.index))) continue
      const g = m.chars.join("")
      out.push({ year: r.year, g, at: r.index, len: m.end - r.index, rel: r.kind === "rel", daeun: /^[^가-힣]{0,3}\s?대운/.test(text.slice(m.end, m.end + 5)), label })
      break
    }
    if (!out.some((b) => b.at === r.index)) {
      // 한글 간지 접미어 없이: "2030년은 경술이다"
      const gapM = /^\s*(?:년도?|해)?\s*(?:은|는|이|가|의|,)?\s*,?\s*/.exec(text.slice(r.end))
      const at = r.end + (gapM ? gapM[0].length : 0)
      const h = HANGUL_GZ_AFTER_RE.exec(text.slice(at, at + 12))
      const g = h ? hangulToGanzhi(h[1]) : null
      if (g) out.push({ year: r.year, g, at: r.index, len: at + 2 - r.index, rel: r.kind === "rel", daeun: false, label })
    }
    // 앞: 간지 + 사이말 + 연도("丙午년인 2027년", "병오년(2026)")
    const before = mentions.filter((m) => m.end <= r.index && r.index - m.end <= 8)
    const m = before[before.length - 1]
    // 대운 이름("대운은 정축, 2023년부터")은 연도의 간지가 아니다
    const daeunCtx = m && (/대운\s?(?:은|는|이|가|의)?\s?$/.test(text.slice(Math.max(0, m.index - 6), m.index)) || /^\s?대운/.test(text.slice(m.end, m.end + 4)))
    if (m && !daeunCtx && GZ_TO_YEAR_GAP_RE.test(text.slice(m.end, r.index)) && !out.some((b) => b.at === r.index)) {
      out.push({ year: r.year, g: m.chars.join(""), at: m.index, len: r.end - m.index, rel: r.kind === "rel", daeun: false, label })
    }
  }
  return out
}

const ABSENCE_AFTER_RE = /^[木火土金水]?\s?(가|이|는|은|도)?\s?(한 글자도|하나도|한 자도|전혀|아예|원국에|네 사주에|여덟 글자에)?\s?(없|안 보|빠져)/
const POSITION_KO = { year: "연주", month: "월주", day: "일주", hour: "시주" } as const

function checkText(
  seg: TextSegment,
  text: string,
  offsetSentence: number | undefined,
  letters: ChartLetters,
  objYears: number[],
  strict: boolean,
  out: Finding[],
  contextText = "",
) {
  const loc = offsetSentence === undefined ? seg.location : { ...seg.location, sentence: offsetSentence }
  // 항목 단위 연도(years[].year, claims.when 등)는 항목 전체에서 허용, 문장 속 연도는 가까이 쓴 기둥만 허용
  const localPillars = new Map<string, number>()
  for (const y of objYears) localPillars.set(yearGanzhi(y), y)
  const sentenceYears = [...text.matchAll(/(1[89]\d{2}|20\d{2})/g)].map((m) => ({ y: Number(m[1]), at: m.index ?? 0 }))
  for (const { y } of sentenceYears) if (!localPillars.has(yearGanzhi(y))) localPillars.set(yearGanzhi(y), -y) // 음수 = 문장 속 연도(거리 확인 필요)
  const pillarAllowedByYear = (g: string, at: number, len: number): boolean => {
    const y = localPillars.get(g)
    if (y === undefined) return false
    if (y > 0) return true
    if (/^\s?(년|해)/.test(text.slice(at + len, at + len + 3))) return true
    return sentenceYears.some((s) => s.y === -y && Math.abs(s.at - at) <= 15)
  }
  const seen = new Set<string>()

  // 연도(절대·상대) ↔ 간지 결속: "2030년 병오(丙午)년", "2028년은, 무신(戊申)", "내년 丁未", "丙午년인 2027년" → 그해 간지와 대조
  for (const b of yearGanzhiBindings(text, letters)) {
    const real = yearGanzhi(b.year)
    if (b.daeun) {
      const idx = letters.daeun.findIndex((d) => d.ganzhi === b.g)
      if (idx < 0) continue // 없는 대운 이름은 아래 토큰 검사가 BASIS로 잡는다
      const from = letters.daeun[idx].start_year
      const to = idx + 1 < letters.daeun.length ? letters.daeun[idx + 1].start_year - 1 : from + 9
      if (b.year >= from - 1 && b.year <= to + 1) continue
      seen.add(`Y:${b.g}`)
      out.push({
        severity: "block",
        code: "YEAR_GANZHI_MISMATCH",
        location: loc,
        excerpt: excerptAt(text, b.at, b.len),
        rule: "daeun-year",
        message: `${b.year}년에 ${b.g} 대운이라 했으나 ${b.g} 대운은 ${from}~${to}년`,
      })
      continue
    }
    if (b.g === real) {
      if (b.rel) localPillars.set(b.g, b.year)
      continue
    }
    // 입춘 전 출생·1월: 그해 1월은 아직 전년 간지 — 원국 연주이거나 "1월" 표지가 있으면 전년 간지 허용
    const prev = yearGanzhi(b.year - 1)
    if (b.g === prev && (gzOf(letters.natal.year) === b.g || /(?<!\d)1\s?월|정월|입춘 전|입춘 앞/.test(text))) continue
    seen.add(`Y:${b.g}`)
    out.push({
      severity: "block",
      code: "YEAR_GANZHI_MISMATCH",
      location: loc,
      excerpt: excerptAt(text, b.at, b.len),
      rule: b.rel ? "relative-year" : "year",
      message: `${b.label}(${b.year}년)의 간지는 ${real}인데 ${b.g}로 적음`,
    })
  }
  // 상대 연도로 맞게 적은 간지는 이 문장에서 허용(내년 丁未 → 丁未)
  for (const r of yearRefs(text, letters.thisYear)) if (r.kind === "rel") localPillars.set(yearGanzhi(r.year), r.year)

  for (const t of findGanzhiTokens(text, strict)) {
    const key = `${t.kind === "char" ? "C" : "P"}:${t.value}`
    if (seen.has(key) || seen.has(`Y:${t.value}`)) continue
    if (t.kind !== "char") {
      // 원국 자리를 붙여 말했으면 그 자리의 실제 기둥이어야 한다
      if (t.position) {
        const real = letters.natal[t.position]
        const realGz = real ? real.stem + real.branch : null
        if (realGz !== t.value) {
          seen.add(key)
          out.push({
            severity: "block",
            code: "BASIS_NOT_IN_CHART",
            location: loc,
            excerpt: excerptAt(text, t.index, t.length),
            rule: "position-mismatch",
            message: `${POSITION_KO[t.position]}를 ${t.value}라 했으나 실제 ${POSITION_KO[t.position]}는 ${realGz ?? "없음(시각 모름)"}`,
          })
          continue
        }
        continue
      }
      if (letters.pillars.has(t.value) || pillarAllowedByYear(t.value, t.index, t.length)) continue
      seen.add(key)
      if (ABSENCE_AFTER_RE.test(text.slice(t.index + t.length, t.index + t.length + 14))) {
        out.push({ severity: "info", code: "BASIS_NOT_IN_CHART", location: loc, excerpt: excerptAt(text, t.index, t.length), rule: "absence", message: `${t.value}가 없다고 말한 문장(부재 진술) — 사람 확인용 기록` })
        continue
      }
      const p = parsePillar(t.value)
      const partsKnown = p ? [p.stem, p.branch].filter((c) => letters.chars.has(c)) : []
      out.push({
        severity: "block",
        code: "BASIS_NOT_IN_CHART",
        location: loc,
        excerpt: excerptAt(text, t.index, t.length),
        rule: t.kind === "hangulPillar" ? "hangul-pillar" : t.split ? "split-pillar" : "pillar",
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
    if (luckSources.length > 0 && (strict || LUCK_MARKER_RE.test(text) || LUCK_MARKER_RE.test(contextText) || LUCK_PATH_RE.test(seg.path))) continue
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
    if (ABSENCE_AFTER_RE.test(text.slice(t.index + t.length, t.index + t.length + 14))) {
      out.push({ severity: "info", code: "BASIS_NOT_IN_CHART", location: loc, excerpt: excerptAt(text, t.index, t.length), rule: "absence", message: `${c}가 없다고 말한 문장(부재 진술) — 사람 확인용 기록` })
      continue
    }
    out.push({
      severity: "block",
      code: "BASIS_NOT_IN_CHART",
      location: loc,
      excerpt: excerptAt(text, t.index, t.length),
      rule: t.reading ? "char-reading" : "char",
      message: `${c}는 원국·대운·올해(또는 문장에 적힌 해)·공망·지장간 어디에도 없는 글자`,
    })
  }
}

export function checkBasis(segments: TextSegment[], letters: ChartLetters): Finding[] {
  const out: Finding[] = []
  for (const seg of segments) {
    if (seg.letterField) {
      if (STRUCTURED_GANZHI_RE.test(seg.path)) continue
      checkText(seg, seg.text, undefined, letters, [...seg.contextYears, ...yearsInText(seg.text)], true, out)
      continue
    }
    const sentences = splitSentences(seg.text)
    // 운 표지 문맥: 같은 문단 전체 + 담은 객체(장 제목·부제 등)
    const ctxText = seg.text + " " + seg.contextText
    sentences.forEach((s, i) => {
      checkText(seg, s.text, sentences.length > 1 ? i : undefined, letters, seg.contextYears, false, out, ctxText)
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
