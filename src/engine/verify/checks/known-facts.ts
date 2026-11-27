// 8. KNOWN_FACT_AS_PREDICTION — 사용자가 미리 알려 준 사실을 "맞힌" 단정으로 쓴 경우(원칙 2) → warn
// 사실 출처: sajuInput.known_facts(문자열) + ctx.userFacts(personalize UserFact: label·value·period)
// 판정(문장 단위, 질문문 제외):
//   - 사실에 연도가 있으면: 그 연도 + 사실의 핵심어(동의어 포함)가 같은 문장에 있으면 warn
//   - 연도가 없으면: 핵심어가 있고 지난 일을 단정하는 끝맺음(~했다·~었다)이면 warn
// verify@0.3.0:
//   - 나이 표현: 사실 연도를 출생 연도(대운 시작 연도 − 시작 나이)로 나이(만·세는 나이 둘 다)로 바꿔 "서른에 결혼했지"도 잡는다
//   - 연도 왜곡: 사실의 핵심어 + 지난 일 서술인데 사실 연도가 없고 ±5년 안의 다른 연도를 적으면 warn(rule fact-year-mismatch)
//     (다른 사건을 짚은 것일 수도 있어 block이 아니라 사람 확인)
//   - 연도 메아리: 핵심어가 없어도 사실 연도(또는 그해 간지·나이) + 지난 일 단정이면 warn(rule year-echo)
//   - 동의어 묶음을 넓혔다(사전 방식이라 사전 밖 말은 여전히 못 잡는다)
import type { Finding, TextSegment, VerifyUserFact } from "../types"
import { excerptOf, splitSentences, yearsInText } from "../text"
import { PAST_RE as PAST_DICT_RE, QUESTION_RE } from "../patterns"
import { decompose } from "../hangul"

/** 지난 일 단정: 사전 꼴(했다·었다) 또는 ㅆ 받침 음절 + 어미(바빴다·옮겼고·맺었던) — 음절 구조로 판정 */
const PAST_RE = {
  test(t: string): boolean {
    if (PAST_DICT_RE.test(t)) return true
    for (let i = 0; i + 1 < t.length; i++) {
      const d = decompose(t[i])
      if (d && d.t === 20 && /[다고던지어구는을으더네소]/.test(t[i + 1])) return true
    }
    return false
  },
}
import { BRANCH_KO, BRANCHES, STEM_KO, STEMS, yearGanzhi } from "../letters"

/** 생활 사건 동의어 묶음 — 사실 글에 앞쪽 낱말이 있으면 묶음 전체를 핵심어로 본다 */
const SYNONYMS: readonly string[][] = [
  ["결혼", "혼인", "혼례", "백년가약", "웨딩", "신혼", "짝을 맺", "식을 올", "연을 맺", "인연을 맺", "시집", "장가", "가정을 꾸리", "가정을 꾸렸", "가정을 이루", "가정을 이뤘", "한 가정", "살림을 차리", "살림을 차렸", "살림을 합", "부부가 되", "부부가 됐", "부부의 연", "배우자를 만났", "반려자를 만났"],
  ["이혼", "갈라서", "갈라섰", "헤어", "남남", "따로 살", "도장을 찍", "혼인을 정리", "결혼을 정리", "관계를 정리", "이별"],
  ["이사", "이주", "사는 곳", "거처", "집을 옮", "터전을 옮", "보금자리", "새집", "짐을 쌌", "둥지를 틀", "집을 구했"],
  ["취업", "입사", "직장을 얻", "일자리", "첫 직장", "사회에 나", "출근을 시작", "일을 시작", "명함을 받"],
  ["이직", "직장을 옮", "회사를 옮", "자리를 옮", "둥지를 옮", "회사를 바꾸", "회사를 바꿨", "직장을 바꾸", "직장을 바꿨", "새 직장"],
  ["퇴사", "회사를 그만", "직장을 그만", "일을 그만", "그만두", "그만뒀", "사표", "사직", "회사를 나왔", "회사를 나오", "회사를 떠", "직장을 떠", "일을 놓", "명함을 내려"],
  ["창업", "사업을 시작", "가게를 열", "가게를 차", "사업을 벌", "간판을 걸", "장사를 시작", "독립했", "내 일을 시작"],
  ["출산", "아이를 낳", "자식을 얻", "아이를 얻", "아이가 태어", "엄마가 되", "엄마가 됐", "아빠가 되", "아빠가 됐", "부모가 되", "부모가 됐", "첫아이"],
  ["입학", "진학", "학교가 바뀌", "학교를 옮", "전학", "학교에 들어", "대학에 들어", "새 학교"],
  ["졸업", "학교를 마치", "학교를 마쳤"],
  ["유학", "외국", "해외", "바다를 건너"],
  ["입대", "군대", "군에", "군 복무"],
  ["수술", "입원", "몸을 다", "탈이 나", "병원에", "칼을 대", "수술대", "몸이 상"],
  ["사별", "여의", "돌아가", "떠나보내", "세상을 떠", "먼저 보내"],
  ["승진", "자리가 올", "직급이 오르", "한 자리 올"],
  ["합격", "붙었", "통과했", "시험에 붙"],
  ["연애", "사귀", "만나기 시작", "인연이 닿", "연인이 되", "연인이 됐"],
]

const KO_TENS: Record<string, number> = { 열: 10, 스물: 20, 스무: 20, 서른: 30, 마흔: 40, 쉰: 50, 예순: 60, 일흔: 70, 여든: 80, 아흔: 90 }
const KO_UNITS: Record<string, number> = { 하나: 1, 한: 1, 둘: 2, 두: 2, 셋: 3, 세: 3, 넷: 4, 네: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9 }
const AGE_KO_RE = /(열|스물|스무|서른|마흔|쉰|예순|일흔|여든|아흔)(하나|다섯|여섯|일곱|여덟|아홉|둘|셋|넷|한|두|세|네)?\s?(?:살|세)?(?=\s?(?:에|에는|엔|때|즈음|무렵|쯤|이던|이었던|되던|이 되|살)|\s|$)/g
const AGE_NUM_RE = /(?<!\d)(\d{1,2})\s?(?:살|세)(?!대)/g

/** 문장 속 나이 표현 → 숫자들 */
export function agesInText(text: string): number[] {
  const out: number[] = []
  for (const m of text.matchAll(AGE_NUM_RE)) out.push(Number(m[1]))
  for (const m of text.matchAll(AGE_KO_RE)) out.push(KO_TENS[m[1]] + (m[2] ? KO_UNITS[m[2]] : 0))
  return out
}

/** 사용자에게 들은 말임을 밝힌 표지 */
const USER_ATTRIBUTION_RE = /(네가|니가|당신이|너는|네)\s?(말해 준|말해준|말한|알려 준|알려준|들려준|들려 준|적어 준|적어준|털어놓은)\s?(대로|것처럼|바로는|걸 보면|이야기|일)|(말해 준|알려 준|들려준|말한) 대로|네 말대로|네 말처럼|(다고|라고|이라고) (했지|했잖|했던|했으니|했구나)|했다니|했다며|했다면서/
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

/** 그해 간지를 한자·한글 둘 다로("己亥", "기해년") — 연도를 간지로 바꿔 쓴 문장도 잡는다(독립 검토 7-02) */
function yearNamesOf(y: number): string[] {
  const g = yearGanzhi(y)
  const ko = STEM_KO[(STEMS as readonly string[]).indexOf(g[0])] + BRANCH_KO[(BRANCHES as readonly string[]).indexOf(g[1])]
  return [g, `${ko}년`, `${ko} 년`]
}

export function checkKnownFacts(segments: TextSegment[], knownFacts: readonly string[], userFacts: readonly VerifyUserFact[], birthYear: number | null = null): Finding[] {
  const probes = probesOf(knownFacts, userFacts)
  if (probes.length === 0) return []
  const out: Finding[] = []
  for (const seg of segments) {
    if (seg.letterField) continue
    const sentences = splitSentences(seg.text)
    sentences.forEach((s, si) => {
      if (QUESTION_RE.test(s.text)) return
      const sentenceYears = yearsInText(s.text)
      const sy = new Set([...sentenceYears, ...seg.contextYears])
      const ages = agesInText(s.text)
      const ageMatch = (y: number) => birthYear !== null && ages.some((a) => a === y - birthYear || a === y - birthYear + 1)
      const loc = sentences.length > 1 ? { ...seg.location, sentence: si } : seg.location
      // 출처를 밝힌 되짚기("네가 말해 준 대로", "~했다고 했지")는 맞히기가 아니다 — 연도 왜곡만 본다
      const attributed = USER_ATTRIBUTION_RE.test(s.text)
      for (const p of probes) {
        const kw = p.keywords.find((k) => s.text.includes(k))
        const yearHit = p.years.some((y) => sy.has(y) || yearNamesOf(y).some((n) => s.text.includes(n)) || ageMatch(y))
        if (!kw) {
          if (attributed) continue
          // 연도 메아리: 사용자 사실 연도 + 지난 일 단정(핵심어를 다른 말로 바꿔 써도)
          if (p.years.length > 0 && yearHit && PAST_RE.test(s.text) && sentenceYears.length + ages.length > 0) {
            out.push({ severity: "warn", code: "KNOWN_FACT_AS_PREDICTION", rule: "year-echo", location: loc, excerpt: excerptOf(s.text), message: `사용자가 알려 준 사실(「${excerptOf(p.label, 20)}」)의 해를 지난 일 단정과 함께 씀 — 사주로 맞힌 것처럼 보이지 않게 배경으로만 쓸 것` })
            break
          }
          continue
        }
        // 연도 왜곡: 사실 연도는 없고 가까운 다른 연도로 같은 사건을 단정
        if (p.years.length > 0 && !yearHit && PAST_RE.test(s.text)) {
          const wrong = sentenceYears.find((y) => !p.years.includes(y) && p.years.some((fy) => Math.abs(fy - y) <= 5))
          if (wrong !== undefined) {
            out.push({ severity: "warn", code: "KNOWN_FACT_AS_PREDICTION", rule: "fact-year-mismatch", location: loc, excerpt: excerptOf(s.text), message: `사용자가 알려 준 사실(「${excerptOf(p.label, 20)}」, ${p.years[0]}${p.years.length > 1 ? "~" + p.years[p.years.length - 1] : ""}년)을 ${wrong}년의 일로 바꿔 씀 — 사용자 사실을 왜곡하지 말 것` })
            break
          }
        }
        const hit = p.years.length > 0 ? yearHit : PAST_RE.test(s.text)
        if (!hit || attributed) continue
        out.push({
          severity: "warn",
          code: "KNOWN_FACT_AS_PREDICTION",
          location: loc,
          excerpt: excerptOf(s.text),
          message: `사용자가 미리 알려 준 사실(「${excerptOf(p.label, 20)}」)을 사주로 맞힌 것처럼 씀 — 배경으로만 쓰고 단정·문항에서 뺄 것`,
        })
        break
      }
    })
  }
  return out
}
