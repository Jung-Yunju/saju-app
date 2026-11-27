// 7. SCIENTIFIC_CLAIM — "과학적으로 입증", "적중률" 등 예측 정확성 과장(원칙 9) → block
// 예외: 같은 문장 안에서 바로 부정하는 꼴("과학적으로 입증된 예측이 아니다", "적중률을 내세우지 않는다").
//       "…라 틀림없다"의 '없'은 부정으로 보지 않는다. 전각 ％는 정규화(NFKC)로 %가 된다.
// verify@0.3.0 — 구절 사전에 더해 구조 규칙:
//   ① 근거 명사(과학·통계·데이터·논문·실험·임상·"수천 명") + 입증 서술(입증·증명·밝혀·뒷받침·보여 준·맞아떨어·적중)
//      (근거 명사가 약한 것 — 연구·자료·사례 — 은 강한 입증 서술일 때만)
//   ② 정확성 부사(어김없이·십중팔구·열이면 열·한 번도 빗나간 적·족집게·오차 없이·N%) + 맞힘 서술(맞는다·들어맞·적중·일어난다)
//      — 주어가 풀이·사주·예측이거나 정확성 낱말이 그 자체로 강할 때
//   ③ 학문 지위 주장("과학이나 다름없다", "객관적인 학문", "과학적인 체계")
//   예외: 바로 뒤 부정("입증된 건 아니다"), 질문·인용("과학이냐고 묻는다면", "과학이라고들 하지만")
import type { Finding, TextSegment } from "../types"
import { excerptAt, splitSentences } from "../text"

export const SCIENCE_RE = new RegExp(
  [
    "과학적으로\\s?(입증|증명|검증|밝혀|확인)", "과학으로\\s?(입증|증명|검증|밝혀)", "과학적인?\\s?근거가\\s?(있|확실|충분)", "과학이다", "과학이란다", "과학적인 학문",
    "통계적으로\\s?(입증|증명|검증|맞|확인)", "통계로\\s?(입증|증명)", "(통계학|통계)(이다|이야|이란다|란다)", "통계다",
    "빅데이터로\\s?(입증|증명|검증)", "논문으로\\s?(입증|증명)",
    "적중률", "적중도", "정확도(가|는|은|이)?\\s?(\\d|아주 높|매우 높|높)", "\\d{1,3}\\s?%\\s?(맞|적중|정확|일치|들어맞)",
    "(100|백)\\s?(%|퍼센트|프로)\\s?(맞|적중|정확|확실|들어맞|일치)", "백발백중", "열에\\s?(아홉|여덟|열)(은|이|번)?\\s?(맞|들어맞|적중)",
    "검증된\\s?(예측|사실|이론)", "반드시\\s?(일어난다|이루어진다|맞는다|맞아떨어진다)", "틀린 적이 없", "틀림없이 (맞|들어맞|일어)",
  ].join("|"),
)

const EVIDENCE_STRONG = /(과학|통계|데이터|빅데이터|논문|실험|임상|학계|분석 결과|조사 결과|수천|수만|수십만|수백만|\d[\d,]*\s?(?:명|건|개|쌍|사례)(?:의|을|를)?)/g
const EVIDENCE_WEAK = /(연구|자료|사례|검증|객관적|기록)/g
const PROOF_STRONG = /(입증|증명|밝혀|뒷받침|증거|확증|검증(?:됐|되었|된|했|을 거친|을 마친))/
const PROOF_ANY = new RegExp(`${PROOF_STRONG.source}|(보여 주|보여준|보여줬|말해 주|말해준|말해 준다|확인되|확인된|확인했|맞았|맞는다|맞더라|맞아떨어|들어맞|일치|적중)`)
const ACCURACY_STRONG = /(족집게|백발백중|(?:틀린|틀려 본|빗나간|어긋난|헛나간) 적(?:이|은|도)? ?(?:한 번도 |거의 )?없|빗나가(?:지 않|는 법이 없|는 일이 없)|틀리는 (?:법|일)이 없|오차(?:가)? 없|한 번도 (?:틀리|빗나가|어긋나)지 않)/
const ACCURACY_ADV = /(어김없이|틀림없이|반드시|백이면 백|열이면 열|열에 [가-힣]{1,3}(?:은|이|번)?|백에 [가-힣]{1,3}|열 명 중 [가-힣]{1,3}|십중팔구|정확히|정확하게|딱딱|소름 돋게|용하게|\d{1,3}\s?(?:%|퍼센트|프로))/
const HIT_PRED = /(맞|들어맞|적중|일어나|일어난|이루어|맞힌|맞혀|맞춘|맞췄|짚어 내|짚어낸|틀리지 않|어긋나지 않)/
const READING_SUBJ = /(사주|명리|풀이|팔자|운세|예측|점(?:괘|은|이)|할미 (?:말|풀이)|이 학문|이 이론|命理|이 방법|이 풀이|할미가 본|할미 눈)/
const DISCIPLINE_RE = /(과학이나 다름없|과학과 (?:같|다르지 않|다를 바 없|다름없)|과학의 한 갈래|객관적인? (?:학문|근거|체계|사실|통계)|과학적인? (?:학문|체계|원리|방법|근거가 있|근거를 갖)|엄밀한 학문|정밀 과학|통계 과학|자연과학)/
const ASKED_RE = /^[^.!?]{0,6}(?:냐고|느냐고|이냐|인가|일까|냐는|라고들|다고들|이라고들)/

function structural(t: string): { index: number; length: number } | null {
  const neg = (end: number) => negatedAfter(t.slice(end)) || ASKED_RE.test(t.slice(end))
  for (const re of [EVIDENCE_STRONG, EVIDENCE_WEAK]) {
    re.lastIndex = 0
    for (const m of t.matchAll(re)) {
      const i = m.index ?? 0
      const win = t.slice(i + m[0].length, i + m[0].length + 30)
      const p = (re === EVIDENCE_STRONG ? PROOF_ANY : PROOF_STRONG).exec(win)
      if (!p) continue
      // 약한 맞힘 서술(맞는다·일치)은 주어가 풀이·사주일 때만
      if (re === EVIDENCE_STRONG && !PROOF_STRONG.test(p[0]) && !READING_SUBJ.test(t)) continue
      const end = i + m[0].length + p.index + p[0].length
      if (neg(end)) continue
      return { index: i, length: end - i }
    }
  }
  const a = ACCURACY_STRONG.exec(t)
  if (a && !neg(a.index + a[0].length) && (READING_SUBJ.test(t) || /족집게|백발백중/.test(a[0]))) return { index: a.index, length: a[0].length }
  const adv = ACCURACY_ADV.exec(t)
  if (adv) {
    const win = t.slice(adv.index + adv[0].length, adv.index + adv[0].length + 16)
    const h = HIT_PRED.exec(win)
    if (h && READING_SUBJ.test(t)) {
      const end = adv.index + adv[0].length + h.index + h[0].length
      if (!neg(end)) return { index: adv.index, length: end - adv.index }
    }
  }
  const d = DISCIPLINE_RE.exec(t)
  if (d && !neg(d.index + d[0].length)) return { index: d.index, length: d[0].length }
  return null
}

/** 바로 뒤의 부정. "틀림없다"의 '없'은 부정이 아니다(독립 검토 6-03) */
const NEGATION_RE = /(아니|않|못|말고|마라|말거라|말아라|없)/g

function negatedAfter(after: string): boolean {
  const win = after.split(/[.!?。]/)[0].slice(0, 20)
  for (const m of win.matchAll(NEGATION_RE)) {
    const i = m.index ?? 0
    if (m[0] === "없" && /(틀림|의심할 여지가?|문제|걱정|빈틈)\s?$/.test(win.slice(0, i))) continue
    return true
  }
  return false
}

export function checkScience(segments: TextSegment[]): Finding[] {
  const out: Finding[] = []
  for (const seg of segments) {
    const sentences = splitSentences(seg.text)
    sentences.forEach((s, si) => {
      const re = new RegExp(SCIENCE_RE.source, "g")
      let found = false
      for (const m of s.text.matchAll(re)) {
        const after = s.text.slice((m.index ?? 0) + m[0].length)
        if (negatedAfter(after)) continue
        out.push({
          severity: "block",
          code: "SCIENTIFIC_CLAIM",
          location: sentences.length > 1 ? { ...seg.location, sentence: si } : seg.location,
          excerpt: excerptAt(s.text, m.index ?? 0, m[0].length),
          message: "명리 해석의 예측 정확성이 입증되었다는 표현 — 전통 이론에 따른 해석이며 검증된 예측이 아니다",
        })
        found = true
        break
      }
      if (found) return
      const st = structural(s.text)
      if (st)
        out.push({
          severity: "block",
          code: "SCIENTIFIC_CLAIM",
          rule: "structural",
          location: sentences.length > 1 ? { ...seg.location, sentence: si } : seg.location,
          excerpt: excerptAt(s.text, st.index, st.length),
          message: "근거·정확성 주장(통계·연구·적중 등)으로 풀이의 예측력을 내세움 — 전통 이론에 따른 해석이며 검증된 예측이 아니다",
        })
    })
  }
  return out
}
