// 5. BARNUM — 누구에게나 맞는 말(원칙 3)
// 문장에 "근거 표지"가 하나도 없으면 근거 없는 문장으로 센다.
// 근거 표지: 간지 한자, 한글 간지+년/일주/대운, 십성·묶음 이름, 기둥·자리 이름(일간·일지·월주…), 대운·세운,
//           4자리 연도, 오행 한자(木火土金水)·"○ 기운", 합충형파해 이름, 신살·공망·12운성 용어
// 판정:
//   - 상투 문장 사전(BARNUM_PHRASES)에 걸리고 근거 표지가 없는 문장 → warn(문장 하나씩)
//   - 서술 칸(body·text·claim)을 장(또는 최상위 항목)별로 묶어 근거 없는 문장 비율 > 기준(기본 0.5) → warn(문장 목록)
// todo·ask·제목·마지막 말은 행동·질문·장식이라 비율 계산에서 뺀다(사전 검사는 body·text·claim만).
// verify@0.3.0 — 근거 글자가 "부르는 말"로만 쓰인 문장("庚金인 너는 …", "癸水 상관을 가진 너도 …")은 근거로 치지 않는다:
//   그 꾸밈 구간을 지운 뒤에도 근거 표지가 남아야 근거 있는 문장이다. 지우고 나서 상투 문장이면 warn(rule phrase-decorated).
import type { Finding, TextSegment, VerifyReport } from "../types"
import { excerptOf, splitSentences } from "../text"
import { findGanzhiTokens } from "../letters"

export const BASIS_MARKER_RE = new RegExp(
  [
    "[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]",
    "[木火土金水]",
    "(1[89]\\d{2}|20\\d{2})",
    "비견|겁재|식신|상관|편재|정재|편관|정관|편인|정인|칠살|효신|비겁|식상|재성|관성|관살|인성",
    "일간|일주|월주|연주|년주|시주|일지|월지|연지|년지|시지|월간|연간|시간\\(|천간|지지|지장간|원국|여덟 글자|팔자의 글자",
    "대운|세운|운에서|월령",
    "(나무|불|흙|쇠|물|목|화|토|금|수)\\s?기운",
    "육합|삼합|반합|방합|천간합|(?:^|[^가-힣])충(?:이|을|은|으로|沖|\\()|(?:^|[^가-힣])[자축인묘진사오미신유술해]{2}\\s?(?:충|합|형|파)(?!격|의)|형살|삼형|자형|원진|귀문|파살|해살",
    "도화|역마|화개|천을귀인|문창|건록|양인|괴강|백호|공망|12운성|십이운성|장생|제왕|묘지|절지",
    "신강|신약|용신|조후|격국",
  ].join("|"),
)

/** 근거 표지가 없을 때 특히 의심하는 상투 문장(Forer·포러 효과 계열 + SYSTEM_PROMPT 원칙 3 예시) */
export const BARNUM_PHRASES: readonly RegExp[] = [
  /누구나|누구에게나|모든 사람/,
  /겉으로는[^.!?]{0,20}(속으로는|속은|속마음은)/,
  /남들이 (잘 )?모르는/,
  /인정받고 싶/,
  /스스로에게 (엄격|가혹)/,
  /(때로는|가끔은|가끔)[^.!?]{0,20}(외롭|불안|흔들|지치|힘들)/,
  /상처를 (잘 )?받/,
  /(자연을 가까이|볕을 쬐|햇볕을 쬐|산책을|규칙적인 생활|충분히 쉬|물을 많이 마|건강을 챙기)/,
  /(긍정적으로|마음을 편히|자신을 사랑|자기 자신을 믿|스스로를 믿)/,
  /(노력하면|꾸준히 하면)[^.!?]{0,20}(된다|이룬다|온다|열린다)/,
  /(좋은 일이 생길|잘될 것|잘 될 것|기회가 온다|복이 들어온다|때를 기다려라)/,
  /(주변 사람을 소중히|사람을 소중히|균형을 잡|무리하지 마라)/,
  /(잠재력|가능성)이 (크|많|무궁)|(큰|무한한|숨은) (잠재력|가능성)/,
]

/**
 * 근거 글자가 있어도 경고하는 상투 표현 — "庚金인 너도 누구나 그렇듯 인정받고 싶어 한다"처럼
 * 글자 하나를 끼워 넣어 바넘 문장을 숨기는 꼴(독립 검토 4-03·4-04)
 */
export const BARNUM_ALWAYS: readonly RegExp[] = [
  /누구나 그렇듯|다들 그렇듯|남들처럼 너도|누구에게나|사람이라면 (다|누구나|누구든)|모든 사람이|세상 사람 (다|누구나)|누구든 (다|그렇)/,
]

/** 근거 글자를 부르는 말로만 쓴 꾸밈 구간("庚金인 너는", "癸水 상관을 가진 너도", "庚 일간인 당신은") */
const VOCATIVE_RE = /[^\s,.!?]{1,12}(?:\s[^\s,.!?]{1,8}){0,2}?\s?(?:인|일간인|일주인|이 있는|가 있는|을 가진|를 가진|를 지닌|을 지닌|을 품은|를 품은|으로 태어난|로 태어난|사주의|사주인)\s(?:너|네|당신|그대|사람|너희|우리 [가-힣]{1,4})(?:는|도|가|이|라면|야|아)?/g

export function hasBasisOutsideVocative(sentence: string): boolean {
  const rest = sentence.replace(VOCATIVE_RE, (m) => " ".repeat(m.length))
  return hasBasisMarker(rest)
}

/** 바넘 상투 표현을 더 넓게(Forer 진술 계열) */
export const BARNUM_EXTRA: readonly RegExp[] = [
  /겉(?:은|으로는)\s?[^.!?]{0,12}(?:보여도|보이지만)\s?[^.!?]{0,8}속(?:은|으로는)/,
  /(?:말 못 할|남모를|남에게 말하지 못한)\s?(?:고민|사연|상처)/,
  /(?:마음 한구석|마음 깊은 곳)(?:에|엔)/,
  /(?:변화|자유)를\s?(?:원하|바라)면서도\s?[^.!?]{0,8}(?:안정|불안)/,
  /(?:생각이 많|속정이 깊|정이 많|책임감이 강|티를 (?:잘 )?내지 않|혼자 삭이|속으로 끙끙|눈치를 (?:많이 )?보|자존심이 강|쉽게 마음을 열지)/,
]

export function hasBasisMarker(sentence: string): boolean {
  return BASIS_MARKER_RE.test(sentence) || findGanzhiTokens(sentence).length > 0
}

function groupKey(seg: TextSegment): { key: string; title?: string } {
  const m = /^(parts\[\d+\]\.chapters\[\d+\])/.exec(seg.path)
  if (m) return { key: m[1], title: seg.location.chapterTitle }
  const top = /^([a-z_]+(\[\d+\])?)/.exec(seg.path)
  return { key: top ? top[1] : seg.path }
}

export function checkBarnum(
  segments: TextSegment[],
  ratioLimit = 0.5,
  minSentences = 1,
): { findings: Finding[]; stats: VerifyReport["stats"]["barnumByChapter"] } {
  const findings: Finding[] = []
  const groups = new Map<string, { title?: string; total: number; unmarked: { text: string; seg: TextSegment; i: number }[] }>()
  for (const seg of segments) {
    if (!seg.narrative) continue
    const { key, title } = groupKey(seg)
    const g = groups.get(key) ?? { title, total: 0, unmarked: [] }
    groups.set(key, g)
    const sentences = splitSentences(seg.text)
    sentences.forEach((s, i) => {
      g.total++
      const always = BARNUM_ALWAYS.find((re) => re.test(s.text))
      if (always) {
        findings.push({
          severity: "warn",
          code: "BARNUM",
          location: sentences.length > 1 ? { ...seg.location, sentence: i } : seg.location,
          excerpt: excerptOf(s.text),
          rule: "phrase-always",
          message: "'누구나 그렇듯'처럼 누구에게나 맞는 말임을 스스로 밝힌 문장 — 근거 글자가 있어도 이 사람만의 말로 바꿀 것",
        })
      }
      if (hasBasisMarker(s.text)) {
        // 근거 글자가 부르는 말로만 쓰였고 나머지가 상투 문장이면 warn
        if (!always && !hasBasisOutsideVocative(s.text)) {
          const hit2 = [...BARNUM_PHRASES, ...BARNUM_EXTRA].find((re) => re.test(s.text))
          if (hit2)
            findings.push({
              severity: "warn",
              code: "BARNUM",
              location: sentences.length > 1 ? { ...seg.location, sentence: i } : seg.location,
              excerpt: excerptOf(s.text),
              rule: "phrase-decorated",
              message: "근거 글자를 부르는 말(\"○○인 너는\")로만 끼운 상투 문장 — 그 글자에서 어떻게 그런 성향이 나오는지 이어서 말하거나 지울 것",
            })
        }
        return
      }
      if (always) {
        g.unmarked.push({ text: s.text, seg, i })
        return
      }
      g.unmarked.push({ text: s.text, seg, i })
      const hit = [...BARNUM_PHRASES, ...BARNUM_EXTRA].find((re) => re.test(s.text))
      if (hit)
        findings.push({
          severity: "warn",
          code: "BARNUM",
          location: sentences.length > 1 ? { ...seg.location, sentence: i } : seg.location,
          excerpt: excerptOf(s.text),
          rule: "phrase",
          message: "누구에게나 맞는 상투 문장이고 근거 글자도 없음 — 이 사람의 글자에서 나온 말로 바꾸거나 지울 것",
        })
    })
  }
  const stats: VerifyReport["stats"]["barnumByChapter"] = []
  for (const [key, g] of groups) {
    const ratio = g.total ? g.unmarked.length / g.total : 0
    stats.push({ path: key, ...(g.title ? { title: g.title } : {}), sentences: g.total, unmarked: g.unmarked.length, ratio: Math.round(ratio * 1000) / 1000 })
    if (g.total >= minSentences && ratio > ratioLimit) {
      const first = g.unmarked[0].seg
      findings.push({
        severity: "warn",
        code: "BARNUM",
        location: { path: key, field: first.field, ...(first.location.part !== undefined ? { part: first.location.part } : {}), ...(first.location.chapter !== undefined ? { chapter: first.location.chapter } : {}), ...(g.title ? { chapterTitle: g.title } : {}) },
        excerpt: excerptOf(g.unmarked[0].text),
        rule: "ratio",
        message: `근거 표지 없는 문장 ${g.unmarked.length}/${g.total}(${Math.round(ratio * 100)}%) > 기준 ${Math.round(ratioLimit * 100)}%: ` +
          g.unmarked.map((u) => `「${excerptOf(u.text, 30)}」`).join(" "),
      })
    }
  }
  return { findings, stats }
}
