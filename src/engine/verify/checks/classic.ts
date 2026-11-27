// 4. FAKE_CLASSIC_QUOTE — 고전 원문 인용 차단
// 현재 지식베이스에서 원문 대조(L2, source_status: verified)를 마친 구절은 0건(docs/knowledge/sources.md).
// 그래서 기본값(verifiedQuotes = [])에서는 원문 인용이 모두 block이다.
//   block : 서명(5대 고전·『』 서명) + 인용 표지(「」·""·“”·‘’ 안 글, "이르기를/말하기를/曰/~라 했다", 4자 이상 한문 구절)
//           "옛 책·고서·고전에" + 따옴표 인용
//   warn  : 서명만 언급하고 인용문이 없는 요지 설명("적천수 계열은 기세를 먼저 본다")
//           출처 없이 쓴 4자 이상 한문 구절(陽生陰死 등)
//   통과  : verifiedQuotes의 original_text와 글자가 같은 인용
import type { Finding, TextSegment, VerifiedQuote } from "../types"
import { excerptAt, splitSentences } from "../text"
import { isGanzhiChar } from "../letters"

export const CLASSIC_NAMES: readonly string[] = [
  "연해자평", "淵海子平", "삼명통회", "三命通會", "三命通会", "적천수", "滴天髓", "적천수천미", "滴天髓闡微", "적천수징의", "滴天髓徵義",
  "자평진전", "子平眞詮", "子平真詮", "궁통보감", "窮通寶鑑", "穷通宝鉴", "난강망", "欄江網", "欄江綱", "조화원약", "造化元鑰",
  "명리정종", "命理正宗", "명리약언", "命理約言", "신봉통고", "神峰通考", "옥조신응진경", "玉照神應眞經", "자평수언", "子平粹言",
]
const NAME_RE = new RegExp(`(${[...CLASSIC_NAMES].sort((a, b) => b.length - a.length).join("|")})`)
const TITLE_RE = /[『《〈]([^』》〉]{1,20})[』》〉]/
const GENERIC_SOURCE_RE = /(옛 책|옛책|고서|고전|옛 글|명리서|옛 어른들?이 남긴|선현|옛 성현)(에|에서|은|는|이|의)/
const QUOTE_RE = /「([^」]{2,80})」|“([^”]{2,80})”|"([^"]{2,80})"|‘([^’]{2,80})’|'([^']{4,80})'/
/** 원문을 옮기는 말머리 — 따옴표가 없어도 인용으로 본다 */
const QUOTE_INTRO_RE = /(이르기를|이르길|말하기를|가로되|曰|云)/
/** 오행·간지·십성을 뺀 한자가 2자 이상 섞인 4자 이상 한자 연속 — 한문 구절로 본다 */
const HANJA_RUN_RE = /[一-鿿]{4,}/g
const NON_PHRASE_HANJA = new Set([..."木火土金水陰陽正偏官財印食傷比劫神殺年月日時柱運大歲"])

function isPhrase(run: string): boolean {
  const meaningful = [...run].filter((c) => !isGanzhiChar(c) && !NON_PHRASE_HANJA.has(c))
  return meaningful.length >= 2
}

const norm = (s: string) => s.replace(/[\s，,。.、:：;；!?「」『』“”"'‘’]/g, "")

/** 따옴표 안 글 중 인용문으로 볼 것: 한자 2자 이상 섞였거나 공백 뺀 길이 8자 이상. 짧은 낱말 강조('드세다')는 제외 */
function quotedTexts(sentence: string): string[] {
  const out: string[] = []
  const re = new RegExp(QUOTE_RE.source, "g")
  for (const m of sentence.matchAll(re)) {
    const q = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5]
    const hanja = (q.match(/[\u4E00-\u9FFF]/g) ?? []).length
    if (hanja >= 2 || q.replace(/\s/g, "").length >= 8) out.push(q)
  }
  return out
}

export function checkClassicQuotes(segments: TextSegment[], verified: readonly VerifiedQuote[] = []): Finding[] {
  const out: Finding[] = []
  const verifiedNorm = verified.filter((q) => q.original_text && q.original_text.trim()).map((q) => norm(q.original_text))
  const isVerified = (q: string) => {
    const n = norm(q)
    return n.length > 0 && verifiedNorm.some((v) => v === n || (n.length >= 4 && v.includes(n)))
  }
  for (const seg of segments) {
    if (seg.letterField) continue
    const sentences = splitSentences(seg.text)
    sentences.forEach((s, si) => {
      const t = s.text
      const loc = sentences.length > 1 ? { ...seg.location, sentence: si } : seg.location
      const nameM = NAME_RE.exec(t)
      const titleM = TITLE_RE.exec(t)
      const genericM = GENERIC_SOURCE_RE.exec(t)
      const quotes = quotedTexts(t)
      // 서명 괄호 밖 한문 구절
      const tWithoutTitles = t.replace(/[『《〈][^』》〉]*[』》〉]/g, (m) => " ".repeat(m.length))
      const runs = [...tWithoutTitles.matchAll(HANJA_RUN_RE)]
        .map((m) => m[0])
        .filter((r) => isPhrase(r) && !CLASSIC_NAMES.includes(r))
      const attributed = nameM || titleM
      const sourceLabel = nameM?.[1] ?? (titleM ? `『${titleM[1]}』` : genericM?.[1])
      const at = nameM?.index ?? titleM?.index ?? genericM?.index ?? 0
      const candidates = [...quotes, ...runs]
      const intro = QUOTE_INTRO_RE.test(t)

      if (attributed || genericM) {
        const unverified = candidates.filter((q) => !isVerified(q))
        // "적천수에 이르기를 …" — 따옴표 없이 말을 옮긴 꼴도 인용으로 본다
        if (unverified.length > 0 || (intro && candidates.length === 0 && attributed)) {
          out.push({
            severity: "block",
            code: "FAKE_CLASSIC_QUOTE",
            location: loc,
            excerpt: excerptAt(t, at, 20),
            rule: attributed ? "attributed-quote" : "generic-source-quote",
            message: `${sourceLabel ?? "고전"} 인용으로 보이는 구절${unverified[0] ? `(${unverified[0].slice(0, 12)})` : ""} — 지식베이스에 원문 대조(verified)된 구절이 아님`,
          })
          return
        }
        if (candidates.length > 0) return // 모두 verified 원문
        if (attributed)
          out.push({
            severity: "warn",
            code: "FAKE_CLASSIC_QUOTE",
            location: loc,
            excerpt: excerptAt(t, at, 10),
            rule: "title-only",
            message: `${sourceLabel} 서명 언급(인용문 없음) — 지식베이스 항목은 모두 요지(unverified)이므로 "~계열 관점" 정도로만 쓰고 원문처럼 보이게 하지 말 것`,
          })
        return
      }
      const loose = runs.filter((r) => !isVerified(r))
      if (loose.length > 0) {
        const idx = t.indexOf(loose[0])
        out.push({
          severity: "warn",
          code: "FAKE_CLASSIC_QUOTE",
          location: loc,
          excerpt: excerptAt(t, idx, loose[0].length),
          rule: "unsourced-hanja-phrase",
          message: `출처 없이 쓴 한문 구절(${loose[0]}) — 고전 원문처럼 보일 수 있음`,
        })
      }
    })
  }
  return out
}
