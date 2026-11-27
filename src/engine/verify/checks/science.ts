// 7. SCIENTIFIC_CLAIM — "과학적으로 입증", "적중률" 등 예측 정확성 과장(원칙 9) → block
// 예외: 같은 문장 안에서 바로 부정하는 꼴("과학적으로 입증된 예측이 아니다", "적중률을 내세우지 않는다")
import type { Finding, TextSegment } from "../types"
import { excerptAt, splitSentences } from "../text"

export const SCIENCE_RE =
  /(과학적으로\s?(입증|증명|검증|밝혀|확인)|과학적인?\s?근거가\s?(있|확실|충분)|과학이다|과학적인 학문|통계적으로\s?(입증|증명|검증|맞|확인)|통계로\s?(입증|증명)|빅데이터로\s?(입증|증명|검증)|논문으로\s?(입증|증명)|적중률|적중도|정확도\s?\d|\d{1,3}\s?%\s?(맞|적중|정확|일치)|백\s?퍼센트\s?(맞|적중|정확)|검증된\s?(예측|사실|이론)|반드시\s?(일어난다|이루어진다|맞는다|맞아떨어진다)|틀린 적이 없|100%)/

const NEGATED_AFTER_RE = /^[^.!?。]{0,20}(아니|않|없|못)/

export function checkScience(segments: TextSegment[]): Finding[] {
  const out: Finding[] = []
  for (const seg of segments) {
    const sentences = splitSentences(seg.text)
    sentences.forEach((s, si) => {
      const re = new RegExp(SCIENCE_RE.source, "g")
      for (const m of s.text.matchAll(re)) {
        const after = s.text.slice((m.index ?? 0) + m[0].length)
        if (NEGATED_AFTER_RE.test(after)) continue
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
