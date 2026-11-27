// 4. FAKE_CLASSIC_QUOTE — 고전 원문 인용 차단
// 현재 지식베이스에서 원문 대조(L2, source_status: verified)를 마친 구절은 0건(docs/knowledge/sources.md).
// 그래서 기본값(verifiedQuotes = [])에서는 원문 인용이 모두 block이다.
//   block : 서명(고전 목록·『』 서명·"○○에 이르기를"의 ○○) + 따옴표 글(길이 무관)·한문 구절·인용 맺음말("이르기를/曰/~라 했다/~라는 말")
//           "옛 책·옛 명리 책·고서·고전(古典)에" + 긴 따옴표 글(한자 2자 이상 또는 8자 이상)·한문 구절
//           출처 없는 한문 구절 + 인용 맺음말("金逢火煉方成器라 했으니")
//   warn  : 서명만 언급하고 인용문·인용 맺음말이 없는 요지 설명("적천수 계열은 기세를 먼저 본다")
//           출처·맺음말 없이 쓴 4자 이상 한문 구절
//   통과  : verifiedQuotes의 original_text와 글자가 같은 인용 / "고전(苦戰)이 길어졌다" 같은 동음이의어
// verify@0.3.0 — 출처를 서명 목록에 묶지 않고 구조로 본다:
//   학문 출처 = 서명 목록 · 『』 서명 · "○○에 이르기를" · 사람(○○ 선생·명리학자·청나라 학자·한자 이름+曰) · 문헌 꼴(어느 책·한 구절·옛 가결)
//   인용 맺음 = "~라/~고 + 말하다·이르다·적다·쓰다·전하다·남기다·가르치다·노래하다·밝히다" 활용 전체(사전 밖 맺음말 포함)
//   출처 주장 = "○○에 따르면·○○의 말처럼·○○가 이르듯" — 원문 없이 서명에 내용을 붙인 것도 block
//   민간 출처(속담·옛말·어른들 말씀)는 고전 인용이 아니다(한문 구절이면 warn). 한글 읽기를 붙인 네 글자 사자성어("새옹지마(塞翁之馬)")는 인용으로 보지 않는다.
import type { Finding, TextSegment, VerifiedQuote } from "../types"
import { excerptAt, splitSentences } from "../text"
import { isGanzhiChar } from "../letters"

export const CLASSIC_NAMES: readonly string[] = [
  "연해자평", "淵海子平", "삼명통회", "三命通會", "三命通会", "적천수", "滴天髓", "적천수천미", "滴天髓闡微", "적천수징의", "滴天髓徵義",
  "자평진전", "子平眞詮", "子平真詮", "궁통보감", "窮通寶鑑", "穷通宝鉴", "난강망", "欄江網", "欄江綱", "조화원약", "造化元鑰",
  "명리정종", "命理正宗", "명리약언", "命理約言", "신봉통고", "神峰通考", "옥조신응진경", "玉照神應眞經", "자평수언", "子平粹言",
  "사주첩경", "四柱捷徑", "명리요강", "命理要綱", "명리신론", "命理新論", "오행대의", "五行大義", "난대묘선", "蘭臺妙選", "옥정오결", "玉井奧訣",
  "낙록자", "珞琭子", "이허중명서", "李虛中命書", "명리탐원", "命理探原", "천미", "闡微", "징의", "徵義", "명리진평", "命理眞評",
]
const NAME_RE = new RegExp(`(${[...CLASSIC_NAMES].sort((a, b) => b.length - a.length).join("|")})`)
const TITLE_RE = /[『《〈]([^』》〉]{1,20})[』》〉]/
/** 막연한 출처. "고전이 길어졌다"(苦戰)를 피하려고 '고전'은 "고전(古典)·고전에·고전에서"만 본다 */
const GENERIC_SOURCE_RE =
  /(옛\s?(명리|사주|역학)?\s?(책|글|문헌|서적|사주책|명리서)|옛책|옛날 책|고서|명리서|사주책|명리 고전|고전\(古典\)|古典|고전에서|고전에|옛 어른들?이 남긴|선현|옛 성현)(에|에서|은|는|이|의|엔|에는)?/
/** "○○에 이르기를" — 목록 밖 서명도 출처로 본다 */
const INTRO_SOURCE_RE = /([가-힣]{2,8}|[\u4E00-\u9FFF]{2,8})\s?(에|에서|은|는)\s?(이르기를|이르길|말하기를|가로되)/
const QUOTE_RE = /「([^」]{2,80})」|“([^”]{2,80})”|"([^"]{2,80})"|‘([^’]{2,80})’|'([^']{2,80})'|«([^»]{2,80})»|〝([^〞]{2,80})〞|‹([^›]{2,80})›/
/** 원문을 옮기는 말머리 — 따옴표가 없어도 인용으로 본다 */
const QUOTE_INTRO_RE = /(이르기를|이르길|말하기를|가로되|曰|云)/
/** 인용 맺음말 — 말하다·이르다·적다·쓰다·전하다·남기다·가르치다·노래하다·밝히다의 활용 전체 */
const SAYING_RE =
  /((이)?라|(이)?라고|고|다고|하고|하며|며)\s?(했|하였|한다|하더|하니|하느니|했느니|했거늘|하였느니|하였으니|일렀|이르|일러|이른|적었|적고|적어|적혀|적힌|썼|쓰고|쓰여|씌어|나온다|나와|전한|전하|전해|남겼|남기|남긴|가르|노래|읊|불렀|부르|일컬|말하|말했|말씀|기록|밝혔|밝히|설파|강조|단언|경고|못 박|못박|하지 않|하잖)|(이)?라는\s?(말|구절|대목|가르침|글귀|문장|말씀)|(이)?란\s?말|에 적혀|에 나오|에 실려/
/** 사람 출처: "○○ 선생", 명리학자·술사·선현, "청나라 학자", 한자 이름 + 曰·先生 */
const PERSON_SOURCE_RE =
  /([가-힣]{1,4}\s?(?:선생|선사|대사|도사|노사|스승|대가|학자|명리가|역학자|술사|선비|영감)(?:님)?|명리학자|명리가|역학자|술사|선현|성현|선인들?|옛사람|옛\s?성인|옛\s?학자|어느\s?(?:학자|명리가|대가|스승|선생)|한\s?(?:학자|명리가|대가)|(?:명|청|송|원|당|조선|고려)(?:나라)?\s?(?:때|시대|의)?\s?(?:[가-힣]{0,6}\s)?(?:학자|명리가|술사|선비|대가)|임철초|서자평|서대승|만민영|심효첨|여춘태|진소암|유백온|원수산|위천리|서락오|[一-鿿]{2,4}(?:先生|曰|云))(?:은|는|이|가|께서|의|도)?/
/** 문헌 꼴 출처("어느 책에", "한 구절", "옛 가결") */
const DOC_SOURCE_RE = /((?:어느|한|오래된|이름난|유명한|명리의|명리)\s?(?:책|서책|경전|문헌|기록|비결|비전|가결|구결|구절|대목|글귀|노래|가르침)|비전(?:되는|된)\s?(?:글|말)|구결|가결)(?:에|에서|은|는|이|가|의)?/
/** 서명에 내용을 붙이는 꼴 */
const CLAIM_ATTR_RE = /(에 따르면|에 의하면|의 말처럼|의 말대로|이 말하듯|가 말하듯|에서 말하듯|이 이르듯|가 이르듯|에서 이르듯|의 가르침대로|에 나오듯|에 적힌 대로|에서 밝히듯|의 표현을 빌리면|의 말을 빌리면|의 뜻을 빌리면|를 빌리면|을 빌리면|에서도 말한다|에서도 이른다)/
/** 민간 출처 */
const FOLK_SOURCE_RE = /(속담|옛말|옛\s?말|어른들\s?말씀|어른들이|할머니들이|흔히들|흔히\s?(?:하는|말하)|사람들이\s?(?:흔히|말하)|우리말에|말이 있듯|라더니|다더니|이라잖니|이라잖아|이라지 않니|라는 말이 있잖)/
/** 옛 판정을 걷어 내는 대조("~고 했지만 지금은") */
const REFRAME_AFTER_RE = /(했|하였|일렀|불렀|봤|보았|적었|썼)(지만|으나|는데|어도|더라도)|(라|고) (했|하였)던 (것|걸|말)을?\s?(지금|이제|요즘)/
/** 할미 자신·사용자의 말을 되짚는 인용 */
const SELF_QUOTE_RE = /(할미가|내가|앞에서|아까|위에서|처음에|네가|너는|니가|너도|당신이)/
/** 오행·간지·십성을 뺀 한자가 2자 이상 섞인 4자 이상 한자 연속 — 한문 구절로 본다 */
const HANJA_RUN_RE = /[一-鿿]{4,}/g
const NON_PHRASE_HANJA = new Set([..."木火土金水陰陽正偏官財印食傷比劫神殺年月日時柱運大歲"])

function isTermHighlight(t: string, q: string): boolean {
  if (/\s/.test(q) || [...q].length > 4) return false
  const i = t.indexOf(q)
  const after = t.slice(i + q.length + 1, i + q.length + 10)
  return /^\s?(?:은|는|이|가|을|를|과|와|의|도|란|이란|에)(?![가-힣]*\s?(?:했|하였|일렀|적었))/.test(after) && !/^\s?(?:이라|라)\s?(?:고|했|하)/.test(after)
}

/** 한글 읽기를 붙인 네 글자 사자성어("새옹지마(塞翁之馬)", "塞翁之馬(새옹지마)") */
function isGlossedIdiom(t: string, run: string): boolean {
  if ([...run].length !== 4) return false
  const i = t.indexOf(run)
  return /[가-힣]{4}\s?[(（]\s?$/.test(t.slice(Math.max(0, i - 6), i)) || /^\s?[(（]\s?[가-힣]{4}\s?[)）]/.test(t.slice(i + run.length, i + run.length + 8))
}

function isPhrase(run: string): boolean {
  const meaningful = [...run].filter((c) => !isGanzhiChar(c) && !NON_PHRASE_HANJA.has(c))
  return meaningful.length >= 2
}

const norm = (s: string) => s.replace(/[\s，,。.、:：;；!?「」『』“”"'‘’«»〝〞‹›]/g, "")

/** 따옴표 안 글 중 인용문으로 볼 것: 한자 2자 이상 섞였거나 공백 뺀 길이 8자 이상. 짧은 낱말 강조('드세다')는 제외 */
function quotedTexts(sentence: string, longOnly: boolean): string[] {
  const out: string[] = []
  const re = new RegExp(QUOTE_RE.source, "g")
  for (const m of sentence.matchAll(re)) {
    const q = m.slice(1).find((x) => x !== undefined) as string
    const hanja = (q.match(/[\u4E00-\u9FFF]/g) ?? []).length
    if (!longOnly || hanja >= 2 || q.replace(/\s/g, "").length >= 8) out.push(q)
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
      const introM = INTRO_SOURCE_RE.exec(t)
      const genericM = GENERIC_SOURCE_RE.exec(t)
      // 서명 괄호 밖 한문 구절
      const tWithoutTitles = t.replace(/[『《〈][^』》〉]*[』》〉]/g, (m) => " ".repeat(m.length))
      const runs = [...tWithoutTitles.matchAll(HANJA_RUN_RE)]
        .map((m) => m[0])
        .filter((r) => isPhrase(r) && !CLASSIC_NAMES.includes(r) && !isGlossedIdiom(t, r))
      const personM = PERSON_SOURCE_RE.exec(t)
      const docM = DOC_SOURCE_RE.exec(t)
      const folk = FOLK_SOURCE_RE.test(t)
      const attributed = nameM || titleM || introM
      const sourceLabel = nameM?.[1] ?? (titleM ? `『${titleM[1]}』` : introM ? introM[1] : personM ? personM[1] : docM ? docM[1] : genericM?.[1])
      const at = nameM?.index ?? titleM?.index ?? introM?.index ?? personM?.index ?? docM?.index ?? genericM?.index ?? 0
      const saying = QUOTE_INTRO_RE.test(t) || SAYING_RE.test(t)
      const blockOf = (rule: string, q?: string): Finding => ({
        severity: "block",
        code: "FAKE_CLASSIC_QUOTE",
        location: loc,
        excerpt: excerptAt(t, at, 20),
        rule,
        message: `${sourceLabel ?? "고전"} 인용으로 보이는 구절${q ? `(${q.slice(0, 12)})` : ""} — 지식베이스에 원문 대조(verified)된 구절이 아님`,
      })

      if (attributed) {
        // 서명이 붙으면 따옴표 글은 길이와 상관없이 인용으로 본다("쇠신충왕").
        // 단, 띄어쓰기 없는 4자 이하 낱말에 조사가 바로 붙고 인용 맺음이 없으면 용어 강조('용신'은)로 본다
        const candidates = [...quotedTexts(t, false).filter((q) => !isTermHighlight(t, q)), ...runs]
        const unverified = candidates.filter((q) => !isVerified(q))
        if (unverified.length > 0) return void out.push(blockOf("attributed-quote", unverified[0]))
        if (candidates.length > 0) return // 모두 verified 원문
        // 따옴표 없이 "적천수에 이르기를 …", "삼명통회는 이를 귀한 격이라 했다" — 원문을 옮긴 꼴
        if (saying) return void out.push(blockOf("attributed-saying"))
        // "적천수에 따르면 …", "궁통보감의 말처럼 …" — 원문 없이 서명에 내용을 붙임
        if (CLAIM_ATTR_RE.test(t)) return void out.push(blockOf("attributed-claim"))
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
      // 사람·문헌 출처(목록 밖 인물명·막연한 문헌) + 인용문·인용 맺음·출처 주장
      if ((personM || docM) && !folk) {
        const unverified = [...quotedTexts(t, true), ...runs].filter((q) => !isVerified(q))
        if (unverified.length > 0) return void out.push(blockOf("person-source-quote", unverified[0]))
        if ((saying && !REFRAME_AFTER_RE.test(t)) || CLAIM_ATTR_RE.test(t)) return void out.push(blockOf("person-source-saying"))
      }
      if (genericM) {
        const unverified = [...quotedTexts(t, true), ...runs].filter((q) => !isVerified(q))
        if (unverified.length > 0) return void out.push(blockOf("generic-source-quote", unverified[0]))
        // "옛 책은 '드세다'고 했지만 지금은 …" — 옛 말을 걷어 내는 문장(원칙 5)은 인용이 아니다
        if ((saying && !REFRAME_AFTER_RE.test(t)) || CLAIM_ATTR_RE.test(t)) return void out.push(blockOf("generic-source-saying"))
        return
      }
      if (folk) {
        // 속담·옛말: 한글 말은 인용으로 보지 않는다. 한문 구절이면 고전처럼 보일 수 있어 warn
        const loose = runs.filter((r) => !isVerified(r))
        if (loose.length > 0)
          out.push({ severity: "warn", code: "FAKE_CLASSIC_QUOTE", location: loc, excerpt: excerptAt(t, t.indexOf(loose[0]), loose[0].length), rule: "folk-hanja", message: `속담·옛말로 소개한 한문 구절(${loose[0]}) — 고전 원문처럼 보일 수 있음` })
        return
      }
      // 출처 없이 따옴표 긴 글 + 인용 맺음("'…'고 했다") — 누구 말인지 밝히지 않은 인용(할미·사용자 말 되짚기는 제외)
      if (runs.length === 0 && saying && !SELF_QUOTE_RE.test(t)) {
        const q = quotedTexts(t, true).filter((x) => !isVerified(x))
        if (q.length > 0)
          return void out.push({ severity: "warn", code: "FAKE_CLASSIC_QUOTE", location: loc, excerpt: excerptAt(t, t.indexOf(q[0]), q[0].length), rule: "unsourced-quote", message: `출처를 밝히지 않은 인용문(${q[0].slice(0, 12)}) — 고전 원문처럼 보이면 지울 것` })
      }
      const loose = runs.filter((r) => !isVerified(r))
      if (loose.length > 0) {
        const idx = t.indexOf(loose[0])
        out.push({
          severity: saying ? "block" : "warn",
          code: "FAKE_CLASSIC_QUOTE",
          location: loc,
          excerpt: excerptAt(t, idx, loose[0].length),
          rule: saying ? "unsourced-hanja-saying" : "unsourced-hanja-phrase",
          message: saying
            ? `출처 없이 한문 구절(${loose[0]})을 인용처럼 옮김("~라 했다") — 원문 대조되지 않은 구절`
            : `출처 없이 쓴 한문 구절(${loose[0]}) — 고전 원문처럼 보일 수 있음`,
        })
      }
    })
  }
  return out
}
