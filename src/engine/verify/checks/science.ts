// 7. SCIENTIFIC_CLAIM — "과학적으로 입증", "적중률" 등 예측 정확성 과장(원칙 9) → block
// 예외: 같은 문장 안에서 바로 부정하는 꼴("과학적으로 입증된 예측이 아니다", "적중률을 내세우지 않는다").
//       "…라 틀림없다"의 '없'은 부정으로 보지 않는다. 전각 ％는 정규화(NFKC)로 %가 된다.
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
        break
      }
    })
  }
  return out
}
