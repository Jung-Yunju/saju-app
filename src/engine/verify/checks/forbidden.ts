// 3. FORBIDDEN_TOPIC — SYSTEM_PROMPT "다루지 않는 것" + 원칙 10(부적·물건·이름·방위 권유 금지)
// 문장 단위 정규식 사전 + 문맥 규칙.
//   mode always : 나오면 block (사망·수명, 전생·사후, 병명, 투자 종목·코인·복권, 타인 속마음 단정)
//   mode timed  : 시기 표지(연도·나이·대운·올해…)나 앞날 단정 끝맺음이 있으면 block, 없으면 warn (사고, 중병, 이혼·파산)
//   mode exam   : 시험 + 합격/불합격 단정, 지난 일(과거형)이면 통과
//   mode warn   : warn (부적·개명·방위 등 개운 물건 권유)
// 공통 예외: "말하지 않는다·알 수 없다·답하지 않는다" 같은 메타 부정 안내문(META_NEGATION_RE)은 통과.
//           "병원에 가라", "상담을 찾아라"는 어떤 규칙에도 걸리지 않게 낱말을 고름.
//           관용구("죽을 만큼 애썼다", "사고방식")는 검사 전에 지운다.
import type { Finding, TextSegment } from "../types"
import { excerptAt, splitSentences } from "../text"
import { FUTURE_RE, META_NEGATION_RE, PAST_RE, TIMING_RE } from "../patterns"

type Mode = "always" | "timed" | "exam" | "warn"
interface Rule {
  id: string
  label: string
  re: RegExp
  mode: Mode
}

const OTHERS = "(?:그 사람|그녀|그 남자|그 여자|상대방|상대|남편|아내|애인|남자친구|여자친구|남친|여친|전 남친|전 여친|전 애인|시어머니|장모|상사|그 친구|그 아이|그 애|짝)"

export const FORBIDDEN_RULES: readonly Rule[] = [
  {
    id: "death",
    label: "죽음·수명",
    mode: "always",
    re: /(사망|죽는다|죽게 된|죽게 될|죽을 (운|해|수|팔자|고비)|죽음이 (온|닥|찾)|세상을 떠난다|세상을 떠날|명이 (다하|다한|짧)|단명|요절|수명|명줄|오래 (못 산|못 살|살지 못)|객사|횡사|돌아가신다|돌아가실|여읜다|여의게|여읠|상을 당한다|상을 당할|상복을 입|저승)/,
  },
  {
    id: "afterlife",
    label: "전생·죽은 뒤의 일",
    mode: "always",
    re: /(전생|업보|윤회|죽은 뒤|죽은 후|사후 세계|저세상|귀신|빙의|천도재|조상 탓|조상이 노해|원혼)/,
  },
  {
    id: "diagnosis",
    label: "병명 진단",
    mode: "always",
    re: /(암에 걸|암이 생|암 진단|[위폐간]암|대장암|유방암|자궁암|갑상선암|췌장암|혈액암|백혈병|뇌졸중|중풍|뇌출혈|뇌경색|심근경색|심장마비|협심증|당뇨|고혈압|치매|파킨슨|우울증|공황장애|조현병|조울증|불임|난임|간경화|신부전|결핵|디스크|관절염|종양)/,
  },
  {
    id: "serious-illness",
    label: "중병·수술 시기",
    mode: "timed",
    re: /(중병|큰 병|큰병|난치병|불치병|병에 걸린다|병에 걸릴|병이 든다|병이 들|병을 얻|병이 찾아|수술을 받|수술할|수술을 하게|입원한다|입원할|입원하게)/,
  },
  {
    id: "accident",
    label: "사고 시기",
    mode: "timed",
    re: /(교통사고|사고수|사고를 당|사고가 난다|사고가 날|사고 난다|큰 사고|크게 다친|크게 다칠|칼을 댄|칼을 대|피를 본|피를 볼|혈광|낙상|화재를 당|물에 빠진다|물에 빠질)/,
  },
  {
    id: "divorce-bankruptcy",
    label: "이혼·파산 시기",
    mode: "timed",
    re: /(이혼|파혼|갈라선다|갈라설|헤어진다|헤어질 운|파산|부도|도산|망한다|망할|쫄딱|빚더미|빚잔치|신용불량)/,
  },
  {
    id: "investment",
    label: "투자 종목·코인·복권",
    mode: "always",
    re: /(코인|비트코인|가상화폐|암호화폐|이더리움|로또|복권|토토|경마|투자 종목|(주식|코인) 종목|종목을 (사|골라|추천)|종목 추천|주식을 사|주식에 넣|주식으로 돈|매수해라|매도해라|사 두어라|사두어라|사 둬라|몰빵|레버리지)/,
  },
  {
    id: "exam",
    label: "시험 합격 단정",
    mode: "exam",
    re: /((시험|수능|고시|임용|면접|자격증|입시|대학|승진)[^.!?。]{0,15}(붙는다|붙을 것|붙게 된|합격한다|합격할|합격이다|합격이야|떨어진다|떨어질|낙방|불합격)|(합격|낙방|불합격)(은|이)?\s?(확실|틀림없|따 놓은|떼어 놓은|정해져))/,
  },
  {
    id: "others-mind",
    label: "다른 사람의 속마음 단정",
    mode: "always",
    re: new RegExp(
      `(${OTHERS}(은|는|이|가|의)?\\s?(속마음|속으로는|진심은|마음은 이미|마음속엔|마음속에는)|${OTHERS}(은|는|이|가)\\s?(너를|널|네게|너에게)?\\s?(아직|이미|사실은|사실)?\\s?(너를|널)?\\s?(좋아한다|좋아하고 있|사랑한다|사랑하고 있|미워한다|싫어한다|원망한다|후회하고 있|후회한다|미련이 있|딴마음|바람을 피|다시 돌아온다|돌아올 것|연락이 온다|연락할 것))`,
    ),
  },
  {
    id: "talisman",
    label: "부적·개명·방위 등 개운 물건 권유",
    mode: "warn",
    re: /(부적|개명|이름을 바꿔|이름을 바꾸면|방위를|길한 방향|행운의 색|행운의 숫자|수맥|풍수 소품|팔찌를 차|굿을|살풀이|액막이)/,
  },
]

/** 검사 전에 지우는 관용구·일반어 */
const IDIOMS = /(죽을 만큼|죽을 힘|죽도록|죽기 살기|죽기살기|사고방식|사고력|사고하|사고의 틀|사고를 넓|시간을 투자)/g

export function checkForbidden(segments: TextSegment[]): Finding[] {
  const out: Finding[] = []
  for (const seg of segments) {
    const sentences = splitSentences(seg.text)
    sentences.forEach((s, si) => {
      const text = s.text.replace(IDIOMS, (m) => "□".repeat(m.length))
      if (META_NEGATION_RE.test(text)) return
      const loc = sentences.length > 1 ? { ...seg.location, sentence: si } : seg.location
      for (const r of FORBIDDEN_RULES) {
        const m = r.re.exec(text)
        if (!m) continue
        let severity: "block" | "warn" | null
        switch (r.mode) {
          case "always":
            severity = "block"
            break
          case "warn":
            severity = "warn"
            break
          case "timed":
            severity = TIMING_RE.test(text) || FUTURE_RE.test(text) ? "block" : "warn"
            break
          case "exam":
            severity = PAST_RE.test(text.slice(m.index)) ? null : "block"
            break
        }
        if (!severity) continue
        out.push({
          severity,
          code: "FORBIDDEN_TOPIC",
          location: loc,
          excerpt: excerptAt(s.text, m.index, m[0].length),
          rule: r.id,
          message:
            r.mode === "timed" && severity === "warn"
              ? `금지 주제(${r.label}) 낱말 — 시기 단정은 없지만 표현 확인 필요`
              : `금지 주제: ${r.label}`,
        })
      }
    })
  }
  return out
}
