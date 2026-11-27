// 3. FORBIDDEN_TOPIC — SYSTEM_PROMPT "다루지 않는 것" + 원칙 10(부적·물건·이름·방위 권유 금지)
// 문장 단위 정규식 사전 + 문맥 규칙. (정규식 사전 방식이라 완전한 차단은 불가능하다 — docs/TEST_REPORT.md P4-04 보완 절)
//   mode always : 나오면 block (사망·수명, 전생·사후, 병명, 타인 속마음 단정)
//   mode timed  : 시기 표지(연도·나이·대운·올해…)나 앞날 단정 끝맺음이 있으면 block, 없으면 warn (사고, 중병, 이혼·파산)
//   mode exam   : 시험 + 합격/불합격 단정(현재·미래형 동사만 사전에 둠). 두 사이에 다른 주어("체력이 떨어질")가 끼면 제외
//   mode invest : 투자 대상 낱말 + 권유·예측(사라·넣어라·오른다·당첨)이면 block, 만류("바라기보다·하지 마라")면 통과, 그 밖은 warn
//   mode warn   : warn (부적·개명·방위 등 개운 물건 권유)
// 공통 예외: 금지 주제를 "다루지 않겠다"는 안내 문장(isGuidanceSentence — 메타 부정이 맺음말이고 시기 표지가 없음)만 통과.
//           낱말 경계: "실망·전망·소망"의 '망', "설명이 짧"의 '명이 짧', "귀신같이", "댁으로 돌아가실"은 금지어가 아니다.
import type { Finding, TextSegment } from "../types"
import { excerptAt, splitSentences } from "../text"
import { FUTURE_RE, isGuidanceSentence, TIMING_RE } from "../patterns"

type Mode = "always" | "timed" | "exam" | "invest" | "warn"
interface Rule {
  id: string
  label: string
  re: RegExp
  mode: Mode
  /** 일치 구간 앞(최대 8자)·뒤(최대 8자)를 보고 금지어가 아니면 true */
  exempt?: (before: string, match: string, after: string) => boolean
}

/** 앞 글자가 한글이 아니어야 하는 낱말(낱말 머리) — JS 정규식 뒤돌아보기 대신 */
const H = "(?:^|[^가-힣])"
const ROMANTIC = "(?:그 사람|그녀|그 남자|그 여자|상대방|상대|남편|아내|애인|남자친구|여자친구|남친|여친|전 남친|전 여친|전 애인|짝|그이)"
const FAMILY_WORK =
  "(?:친정엄마|친정 엄마|시어머니|시아버지|어머니|엄마|아버지|아빠|장모|장인|며느리|사위|아들|딸|언니|오빠|누나|형|동생|친구|동료|상사|부장|팀장|선배|후배|그 친구|그 아이|그 애|시댁 식구|처가 식구)"
const OBJ = "(?:너를|널|네게|너에게|너한테|너만)"

export const FORBIDDEN_RULES: readonly Rule[] = [
  {
    id: "death",
    label: "죽음·수명",
    mode: "always",
    re: new RegExp(
      [
        "사망", "죽는다", "죽게 된", "죽게 될", "죽을 (운|해|수|팔자|고비)", "죽음이 (온|닥|찾)",
        "세상을 (떠난다|떠날|떠나게|뜬다|뜰|뜨게|하직)", `${H}명이 (다하|다한|짧|길지 않)`, `${H}명줄`, "단\\s?명", `${H}요\\s?절(한|하|했|할)`, "수명",
        "오래 (못 산|못 살|살지 못)", "객사", "횡사", "숨을 거두", "숨이 끊어", "목숨을 잃", "생을 마감", "명을 달리", "이승을 떠", "황천", "저승",
        "(스물|서른|마흔|쉰|예순|일흔|여든|아흔|\\d{1,3}\\s?(살|세))[가-힣]{0,2}(을|를)?\\s?넘기(지|기) (못|어렵)",
        "돌아가신다", "돌아가실", "돌아가시게", "여읜다", "여의게", "여읠", "상을 당한다", "상을 당할", "상복을 입",
      ].join("|"),
    ),
    // "댁으로 돌아가실 때"(귀가)는 죽음이 아니다
    exempt: (before, m) => /^돌아가/.test(m) && /((댁|집|고향|본가|자리|제자리|숙소|회사|학교|일터|방)(으로|로|에)|으로|쪽으로)\s*$/.test(before),
  },
  {
    id: "afterlife",
    label: "전생·죽은 뒤의 일",
    mode: "always",
    re: /(전생|前生|前世|지난 생|지난생|전 생애|업보|업장|카르마|윤회|죽은 뒤|죽은 후|사후 세계|저세상|귀신(?!같|처럼|이 곡할)|빙의|천도재|조상 탓|조상이 노해|원혼)/,
  },
  {
    id: "diagnosis",
    label: "병명 진단",
    mode: "always",
    re: new RegExp(
      [
        "암에 걸", "암이 생", "암 진단", `[위폐간]\\s?암(?=[이가을에으도\\s.,]|$)`, `${H}암(이|에|을|으로)\\s?(생|걸|나오|찾|발견|진단|온)`,
        "대장암", "유방암", "자궁암", "갑상선암", "췌장암", "혈액암", "백혈병", "뇌졸중", "중풍", "뇌출혈", "뇌경색", "심근경색", "심장마비", "협심증", "심장병",
        "당뇨", "고혈압", "치매", "파킨슨", "우울증", "공황장애", "조현병", "조울증", "불임", "난임", "간경화", "신부전", "결핵", "디스크", "관절염", "종양",
        "癌", "腫瘍", "中風", "糖尿", "癡呆", "痴呆", "白血病",
        "(폐|간|위|가슴|목|유방|자궁|머리|뇌|장|갑상선)에\\s?(혹|물혹|덩어리|종양)", `${H}(혹|물혹)이 (생|자라|잡|커)`,
      ].join("|"),
    ),
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
    re: new RegExp(
      [
        "이혼", "파혼", "파경", "이혼수", "갈라선다", "갈라설", `(남편|아내|배우자|부부|짝|그 사람|애인)(과|와|이|가|는|은)?\\s?(갈라서|헤어지|헤어진|등을 돌리|남남이 되)`,
        "헤어질 운", "파산", "부도", "도산", `${H}망(한다|할|하게|해서|해 버|했)`, "쫄딱", "쪽박", "빈털터리", "알거지", "거덜", "빚더미", "빚잔치", "신용불량",
      ].join("|"),
    ),
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

/** 검사 전에 지우는 관용구·일반어 */
const IDIOMS = /(죽을 만큼|죽을 힘|죽도록|죽기 살기|죽기살기|사고방식|사고력|사고하|사고의 틀|사고를 넓|시간을 투자|운동 종목|경기 종목)/g

// 투자: 권유·예측 / 만류
const INVEST_PUSH = /(사\s?(라|둬|두어|두|모아|모으|놓|놔|봐|보|볼)|사야|사면 (된|돈)|사 볼|넣어|넣으|몰아|몰빵|투자해|투자하면|들어가라|매수|당첨|오른다|오를 거|값이 뛴|대박|돈이 된|돈이 될|벌 수|번다|불어난다|사들)/
const INVEST_DISSUADE = /(바라기보다|바라지 마|기대지 마|하지 마|하지 말|손대지 마|손대지 말|멀리해|멀리하|피해라|피하거라|금물|말고|대신|않는 게|않는 편|권하지 않|권하지는 않|짚지 않|짚어 주지 않)/

// 시험: 합격/불합격 단정 동사(현재·미래형만 — 과거형은 사전에 없다)
const EXAM_VERB = /(붙는다|붙을 거|붙을 것|붙겠|붙게 된|붙어\.|합격한다|합격할 거|합격할 것|합격하겠|합격이다|합격이야|합격이란다|떨어진다|떨어질 거|떨어질 것|떨어지겠|낙방한다|낙방할|불합격이다|불합격한다)/
const EXAM_SURE = /(합격|낙방|불합격)(은|이)?\s?(확실|틀림없|따 놓은|따놓은|떼어 놓은|떼놓은|떼 놓은|떼논|정해져|문제없)/
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

export function checkForbidden(segments: TextSegment[]): Finding[] {
  const out: Finding[] = []
  for (const seg of segments) {
    const sentences = splitSentences(seg.text)
    sentences.forEach((s, si) => {
      const text = s.text.replace(IDIOMS, (m) => "□".repeat(m.length))
      if (isGuidanceSentence(text)) return
      const loc = sentences.length > 1 ? { ...seg.location, sentence: si } : seg.location
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
          case "timed":
            severity = TIMING_RE.test(text) || FUTURE_RE.test(text) ? "block" : "warn"
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
          message:
            severity === "warn" && (r.mode === "timed" || r.mode === "invest")
              ? `금지 주제(${r.label}) 낱말 — 시기·권유 단정은 없지만 표현 확인 필요`
              : `금지 주제: ${r.label}`,
        })
      }
    })
  }
  return out
}
