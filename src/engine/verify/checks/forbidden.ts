// 3. FORBIDDEN_TOPIC — SYSTEM_PROMPT "다루지 않는 것" + 원칙 10(부적·물건·이름·방위 권유 금지)
// verify@0.3.0 — 죽음·질병/수술·병명·이혼·파산·사고는 낱말 목록 대신 구조 규칙(harm.ts):
//   해로운 사건 의미 범주(넓은 어간·완곡어·신체 부위+나쁜 상태·가족+잃다·재산+날리다) × 서술 양태(단정·가능성·부정·조건·걱정·인용 반박·과거·되짚기)
//   × 시기 표지(timing.ts: 연도·상대 연도·나이·대운·"몇 해 뒤"·"그해", 같은 문장 또는 지시어로 이은 인접 문장)
//   판정 표(시기 있음): 무거운 사건 단정·가능성 → block / 가벼운 사건 단정 → block, 가능성 + 권유(조심해라) → 통과, 그 밖 가능성 → warn
//                      "~ㄹ지는 모른다"(불확실) + 무거운 사건 → warn / 지난 일 단정 → warn(죽음 추정 "여의었을 것"은 block)
//   판정 표(시기 없음): 죽음·병명 단정·가능성 → block / 무거운 사건 단정 → block, 가능성 → warn / 가벼운 사건 단정 → warn
//   부정("갈라설 일은 없다")·조건("아프면 병원에")·걱정("망할까 봐")·인용 반박("죽는다는 말은 믿지 마라")·되짚기("수술했다고 했지")·
//   주제어("이혼 이야기", "이혼을 고민") → 막지 않는다. 단, 단정 맺음("갈라선다.")이면 뒤에 메타 말이 붙어도 단정.
// 그 밖(전생·투자·시험·타인 속마음·부적)은 기존 사전 규칙:
//   mode always : 나오면 block (전생·사후, 타인 속마음 단정)
//   mode exam   : 시험 + 합격/불합격 단정
//   mode invest : 투자 대상 낱말 + 권유·예측이면 block, 만류면 통과, 그 밖은 warn
//   mode warn   : warn (부적·개명·방위 등 개운 물건 권유)
//   공통 예외: 금지 주제를 "다루지 않겠다"는 안내 문장(isGuidanceSentence)
import type { Finding, TextSegment } from "../types"
import { excerptAt, splitSentences } from "../text"
import { isGuidanceSentence } from "../patterns"
import { findHarms, stripGlosses, type HarmCategory, type HarmHit } from "../harm"
import { ANAPHOR_RE, hasTiming } from "../timing"

type Mode = "always" | "exam" | "invest" | "warn"
interface Rule {
  id: string
  label: string
  re: RegExp
  mode: Mode
  /** 일치 구간 앞(최대 8자)·뒤(최대 8자)를 보고 금지어가 아니면 true */
  exempt?: (before: string, match: string, after: string) => boolean
}

const ROMANTIC = "(?:그 사람|그녀|그 남자|그 여자|상대방|상대|남편|아내|애인|남자친구|여자친구|남친|여친|전 남친|전 여친|전 애인|짝|그이)"
const FAMILY_WORK =
  "(?:친정엄마|친정 엄마|시어머니|시아버지|어머니|엄마|아버지|아빠|장모|장인|며느리|사위|아들|딸|언니|오빠|누나|형|동생|친구|동료|상사|부장|팀장|선배|후배|그 친구|그 아이|그 애|시댁 식구|처가 식구)"
const OBJ = "(?:너를|널|네게|너에게|너한테|너만)"

export const FORBIDDEN_RULES: readonly Rule[] = [
  {
    id: "afterlife",
    label: "전생·죽은 뒤의 일",
    mode: "always",
    re: /(전생|前生|前世|지난 생|지난생|전 생애|업보|업장|카르마|윤회|죽은 뒤|죽은 후|사후 세계|저세상|귀신(?!같|처럼|이 곡할)|빙의|천도재|조상 탓|조상이 노해|원혼)/,
  },
  {
    id: "investment",
    label: "투자 종목·코인·복권",
    mode: "invest",
    re: /(비트코인|코인|가상화폐|암호화폐|이더리움|BTC|ETH|bitcoin|ETF|로또|복권|토토|경마|선물옵션|레버리지|몰빵|주식(?!회사)|종목|아파트를|땅을|부동산을|청약)/i,
  },
  {
    id: "exam",
    label: "시험 합격 단정",
    mode: "exam",
    re: /(시험|수능|고시|임용|면접|자격증|입시|대학|승진|합격)/,
  },
  {
    id: "others-mind",
    label: "다른 사람의 속마음 단정",
    mode: "always",
    re: new RegExp(
      [
        `(${ROMANTIC}|${FAMILY_WORK})(은|는|이|가|의)?\\s?(속마음|속으로는|진심은|마음은 이미|마음속엔|마음속에는)`,
        `${ROMANTIC}(은|는|이|가|한테서|에게서)\\s?(${OBJ})?\\s?(아직|이미|사실은|사실|다음 달에|곧)?\\s?(${OBJ})?\\s?(좋아한다|좋아하고 있|사랑한다|사랑하고 있|그리워한다|그리워하고|못 잊|미워한다|싫어한다|원망한다|후회하고 있|후회한다|미련이 있|딴마음|바람을 피|다시 돌아온다|돌아올 거|돌아올 것|연락이 온다|연락이 올|연락해 올|연락할 거|연락할 것)`,
        `${FAMILY_WORK}(은|는|이|가)\\s?(아직|이미|사실은|사실|속으로)?\\s?${OBJ}\\s?(아직|이미|몰래)?\\s?(좋아한다|사랑한다|미워한다|싫어한다|원망한다|시기한다|질투한다|무시한다|못마땅해한다|원망하고)`,
      ].join("|"),
    ),
  },
  {
    id: "talisman",
    label: "부적·개명·방위 등 개운 물건 권유",
    mode: "warn",
    re: /(부적|개명|이름을 바꿔|이름을 바꾸면|방위를|길한 방향|행운의 색|행운의 숫자|수맥|풍수 소품|팔찌를 차|굿을|살풀이|액막이)/,
  },
]

/** 검사 전에 지우는 관용구·일반어(사전 규칙용) */
const IDIOMS = /(시간을 투자|운동 종목|경기 종목)/g

// 투자: 권유·예측 / 만류
const INVEST_PUSH = /(사\s?(라|둬|두어|두|모아|모으|놓|놔|봐|보|볼)|사야|사면 (된|돈)|사 볼|넣어|넣으|몰아|몰빵|투자해|투자하면|들어가라|매수|당첨|오른다|오를 거|값이 뛴|대박|돈이 된|돈이 될|벌 수|번다|불어난다|사들)/
const INVEST_DISSUADE = /(바라기보다|바라지 마|기대지 마|하지 마|하지 말|손대지 마|손대지 말|멀리해|멀리하|피해라|피하거라|금물|말고|대신|않는 게|않는 편|권하지 않|권하지는 않|짚지 않|짚어 주지 않)/

// 시험: 합격/불합격 단정 동사(현재·미래형만 — 과거형은 사전에 없다)
const EXAM_VERB = /(붙는다|붙을 거|붙을 것|붙겠|붙게 된|붙어\.|합격한다|합격할 거|합격할 것|합격하겠|합격이다|합격이야|합격이란다|떨어진다|떨어질 거|떨어질 것|떨어지겠|낙방한다|낙방할|불합격이다|불합격한다)/
const EXAM_SURE = /(합격|낙방|불합격|시험|수능|고시|임용|면접|자격증|입시|승진)(은|이|도)?\s?(이번에|올해|이번엔)?\s?(확실|틀림없|따 놓은|따놓은|따 논|떼어 놓은|떼놓은|떼 놓은|떼논|정해져|문제없|당상)/
/** 시험 낱말과 동사 사이에 다른 주어가 끼면(체력이 떨어질, 성적이 떨어질) 시험 결과 단정이 아니다 */
const OTHER_SUBJECT = /(체력|기운|힘|컨디션|입맛|잠|집중력|건강|몸|성적|점수|기분|자신감)(이|가)\s/

function examHit(text: string): RegExpExecArray | null {
  const sure = EXAM_SURE.exec(text)
  if (sure) return sure
  const re = /(시험|수능|고시|임용|면접|자격증|입시|대학|승진)/g
  for (const m of text.matchAll(re)) {
    const rest = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 24)
    const v = EXAM_VERB.exec(rest)
    if (!v) continue
    if (OTHER_SUBJECT.test(rest.slice(0, v.index))) continue
    const r = [text.slice(m.index ?? 0, (m.index ?? 0) + m[0].length + v.index + v[0].length)] as unknown as RegExpExecArray
    r.index = m.index ?? 0
    return r
  }
  return null
}

const HARM_RULE: Record<HarmCategory, { id: string; label: string }> = {
  death: { id: "death", label: "죽음·수명" },
  illness: { id: "serious-illness", label: "중병·수술·입원" },
  diagnosis: { id: "diagnosis", label: "병명 진단" },
  divorce: { id: "divorce-bankruptcy", label: "이혼·관계 파탄" },
  bankruptcy: { id: "divorce-bankruptcy", label: "파산·재산 손실" },
  accident: { id: "accident", label: "사고" },
}
/** 앞 문장의 시기를 이어받는 연결어 */
const CONNECTIVE_START_RE = /^(?:그러면|그러니|그래서|그러다|그때|이때|거기서|그 해|그해|그 무렵|그즈음|그 시기)/
/** 권유·당부 맺음(조심해라·챙겨라) — 가벼운 사건의 가능성 + 권유는 생활 조언으로 본다 */
const ADVICE_RE = /(?:라|거라|렴|자|세요|십시오|해라|하라|마라|말아라|둬라|두어라|챙겨라|살펴라|가라|봐라)\s*[.!]?\s*$|(?:하는 게|하는 것이|두는 게|챙기는 게) (?:좋|낫)/

function harmSeverity(h: HarmHit, timed: boolean, advice: boolean): "block" | "warn" | null {
  const always = h.cat === "death" || h.cat === "diagnosis"
  switch (h.modality) {
    case "assert":
      if (timed || always || h.severe) return "block"
      return "warn"
    case "hedge":
      if (always) return "block"
      if (timed) return h.severe ? "block" : advice ? null : "warn"
      return h.severe ? "warn" : null
    case "uncertain":
      return timed && h.severe ? "warn" : null
    case "pastClaim":
      return h.cat === "death" ? (timed ? "block" : "warn") : timed ? "warn" : null
    case "past":
      return timed && (h.severe || always) ? "warn" : null
    default:
      return null
  }
}

export function checkForbidden(segments: TextSegment[]): Finding[] {
  const out: Finding[] = []
  for (const seg of segments) {
    const sentences = splitSentences(seg.text)
    const timedFlags = sentences.map((s) => hasTiming(s.text))
    sentences.forEach((s, si) => {
      const loc = sentences.length > 1 ? { ...seg.location, sentence: si } : seg.location
      // ① 해로운 사건 × 시기 × 양태
      const clean = stripGlosses(s.text)
      const timedAdj =
        (ANAPHOR_RE.test(s.text) && ((si > 0 && timedFlags[si - 1]) || (si + 1 < sentences.length && timedFlags[si + 1]))) ||
        (si > 0 && timedFlags[si - 1] && CONNECTIVE_START_RE.test(s.text))
      const timed = timedFlags[si] || timedAdj
      const advice = ADVICE_RE.test(s.text)
      const seenRule = new Set<string>()
      for (const h of findHarms(s.text)) {
        const severity = harmSeverity(h, timed, advice)
        if (!severity) continue
        const r = HARM_RULE[h.cat]
        if (seenRule.has(r.id + severity)) continue
        seenRule.add(r.id + severity)
        out.push({
          severity,
          code: "FORBIDDEN_TOPIC",
          location: loc,
          excerpt: excerptAt(clean, h.index, h.length),
          rule: r.id,
          message:
            severity === "block"
              ? `금지 주제: ${r.label}${timed ? " 시기 예언" : " 단정"}(${h.modality === "hedge" ? "가능성" : h.modality === "pastClaim" ? "지난 일 추정" : "단정"}${timedAdj && !timedFlags[si] ? ", 인접 문장의 시기" : ""})`
              : `금지 주제(${r.label}) 표현 — ${h.modality === "uncertain" ? "시기와 함께 '모른다'로 흐린 말" : h.modality === "past" || h.modality === "pastClaim" ? "지난 일을 시기와 함께 단정" : "단정은 약하지만"} 사람 확인 필요`,
        })
      }
      // ② 그 밖 금지 주제(사전 규칙)
      const text = s.text.replace(IDIOMS, (m) => "□".repeat(m.length))
      if (isGuidanceSentence(text)) return
      for (const r of FORBIDDEN_RULES) {
        let m: RegExpExecArray | null = null
        if (r.mode === "exam") m = examHit(text)
        else {
          const g = new RegExp(r.re.source, r.re.flags.includes("g") ? r.re.flags : r.re.flags + "g")
          for (const x of text.matchAll(g)) {
            const i = x.index ?? 0
            if (r.exempt && r.exempt(text.slice(Math.max(0, i - 8), i), x[0], text.slice(i + x[0].length, i + x[0].length + 8))) continue
            m = x as RegExpExecArray
            break
          }
        }
        if (!m) continue
        let severity: "block" | "warn" | null
        switch (r.mode) {
          case "always":
          case "exam":
            severity = "block"
            break
          case "warn":
            severity = "warn"
            break
          case "invest":
            severity = INVEST_DISSUADE.test(text) ? null : INVEST_PUSH.test(text) ? "block" : "warn"
            break
        }
        if (!severity) continue
        out.push({
          severity,
          code: "FORBIDDEN_TOPIC",
          location: loc,
          excerpt: excerptAt(s.text, m.index, m[0].length),
          rule: r.id,
          message: severity === "warn" && r.mode === "invest" ? `금지 주제(${r.label}) 낱말 — 권유 단정은 없지만 표현 확인 필요` : `금지 주제: ${r.label}`,
        })
      }
    })
  }
  return out
}
