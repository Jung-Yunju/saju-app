// 6. MORAL_JUDGEMENT · GENDER_STEREOTYPE — 옛 책의 도덕·성별 판정(원칙 5·8·11)
// 문장 단위 사전. 옛 판정을 "그렇게 읽지 않는다"고 걷어 내는 문장(원칙 5가 시키는 꼴)은 info로 낮춘다(isReframed).
// verify@0.3.0 — 구조 규칙을 더했다(낱말 목록이 아니라 짜임):
//   성별 일반 명사(여자·여성·사내·남자·여명·곤명) + 당위 서술(해야 한다·하면 안 된다·답게·다워야·는 법) → 성별 역할 고정
//   성별 일반 명사 + 성품 판정(기가 세·드세·억세·사납·나대·설치·팔자가 세·박복) → 성별 판정
//   여자 사주 + 글자 조건(많으면·있으면·강하면) + 남편·과부·재혼·팔자 결과 → 성별 판정
//   팔자·사주·운명 + 나쁜 평가 형용사(세다·사납다·기구하다·박하다·흉하다·험하다·고약하다·모질다·천하다) → 도덕 판정
//   관계어(남편·부모·자식·인·관·재…) + 복/덕 + 모자람(없다·박하다·약하다·적다·드물다·안 따른다) → 복 판정
//   가족을 해치는 팔자("남편을 잡아먹는", "부모를 극하는") → 도덕 판정
import type { Finding, TextSegment } from "../types"
import { excerptAt, splitSentences } from "../text"

interface MoralRule {
  id: string
  code: "MORAL_JUDGEMENT" | "GENDER_STEREOTYPE"
  severity: "block" | "warn"
  re: RegExp
  label: string
}

const WOMAN = "(?:여자|여성|아내|며느리|딸|여자애|계집|처자|부인|새댁)"
const MAN = "(?:남자|남성|사내|남편|아들|사위|가장)"

/** 판정 사이에 끼울 수 있는 정도 부사(독립 검토 5-04 "팔자가 아주 세다") */
const ADV = "(?:아주|너무|참|좀|꽤|무척|몹시|워낙|되게|제법|정말|엄청|지지리도|지지리|하나도|영|전혀|별로)?"
/** '세'로 시작하는 다른 낱말(세운·세상·세월…) 제외 */
const NOT_SE = "(?!운|상|월|력|금|대|우|련|계|수|탁)"

const GENDER_GENERIC = "(?:여자|여성|여잔|계집|여식|사내|남자|남성|사내대장부|여명|女命|곤명|坤命|건명|乾命)"
const FATE_WORD = "(?:팔자|사주|운명|명줄|타고난 명|명운)"
const BAD_EVAL = "(?:세|쎄|드세|드쎄|사납|사나|기구|박하|박한|나쁘|나쁜|흉하|흉한|험하|험한|고약|모질|독하|독한|천하|천한|더럽|고달프|박복|기박|불길|팍팍|고단|사나운|억세)"
const RELATION = "(?:남편|아내|부인|처|배우자|부모|자식|자녀|형제|윗사람|아랫사람|서방|남자|여자|시댁|처가|친정|일가|조상|인|재|관|이성|짝|사람|친구|윗선)"

export const MORAL_RULES: readonly MoralRule[] = [
  // 구조 규칙(verify@0.3.0)
  { id: "gender-norm", code: "GENDER_STEREOTYPE", severity: "block", label: "성별 당위(여자는·남자는 ~해야)", re: new RegExp(`${GENDER_GENERIC}(?:은|는|이|가|라면|란|로서|로 태어났으면|의 몸으로)\\s?[^.!?]{0,16}?(?:[가-힣]야\\s?(?:한다|하느니|된다|산다|해|하는 법|하지|하거늘)|모름지기|하면 안 된다|해서는 안|하면 못 쓴다|답게|다워야|다운 게|는 법이다|이 최고|가 최고|이 제일|가 제일|하는 게 도리|해야 복|해야 사랑받|해야 대접)`) },
  { id: "gender-trait", code: "GENDER_STEREOTYPE", severity: "block", label: "성별 성품 판정", re: new RegExp(`${GENDER_GENERIC}(?:의)?\\s?(?:사주|팔자|명)?(?:가|이|은|는|로서|치고)?\\s?[^.!?]{0,10}?(?:기가\\s?(?:세|쎄|드세|강하)|기\\s?센|드세|드쎄|억세|사납|나대|설치|당돌|팔자가\\s?(?:세|쎄|드세|사납)|박복|남편을?\\s?(?:잡|누르|이기)|남자를?\\s?(?:잡|누르|이기|휘어))`) },
  { id: "gender-chart", code: "GENDER_STEREOTYPE", severity: "block", label: "여자 사주 글자 조건 판정", re: /(?:여자|여성|여명|女命|곤명|坤命)(?:의)?\s?(?:사주|팔자|명)?(?:에|에서|는|가|이)?\s?[^.!?]{0,16}?(?:많으면|강하면|없으면|있으면|태왕하면|섞이면|겹치면|뜨면|드러나면|왕하면)[^.!?]{0,16}?(?:남편|과부|재혼|이혼|팔자|드세|박복|외롭|고생|바람|남자 복|시집|홀로|독수공방)/ },
  { id: "fate-eval", code: "MORAL_JUDGEMENT", severity: "block", label: "팔자·사주 나쁜 평가", re: new RegExp(`${FATE_WORD}(?:가|이|은|는|도)?\\s?${ADV}\\s?${BAD_EVAL}${NOT_SE}|${BAD_EVAL}(?:ㄴ|은)?\\s?${FATE_WORD}(?!\\s?(?:이라는|라는|이란|란)\\s?(?:말|옛말))`) },
  { id: "relation-luck", code: "MORAL_JUDGEMENT", severity: "block", label: "관계 복·덕 판정", re: new RegExp(`${RELATION}\\s?(?:복|덕)(?:이|은|는|도|만큼은)?\\s?${ADV}\\s?(?:없|박하|박한|약하|약한|모자라|적|드물|지지리|안 따르|따르지 않|없는 편|희미|얇)`) },
  { id: "harm-family-fate", code: "MORAL_JUDGEMENT", severity: "block", label: "가족을 해치는 팔자 판정", re: /(?:남편|아내|부인|처|배우자|부모|아버지|어머니|자식|자녀|가족|형제|남자|여자|시댁|친정)(?:을|를|의)?\s?(?:잡아먹|극하|극할|해치|망치|앞길을 막|기를 꺾|등골을 빼|명을 깎|복을 깎)[^.!?]{0,8}(?:팔자|사주|운명|명|살|기운|글자|여자|남자|사람)/ },
  // 성별 판정
  {
    id: "woman-strong", code: "GENDER_STEREOTYPE", severity: "block", label: "여자가 드세다류",
    re: new RegExp(`${WOMAN}[^.!?]{0,10}((기|기운|기세|팔자|성질|성격|기질)(가|이)?\\s?${ADV}\\s?(세|쎄|센|쎈|드세|드쎄)${NOT_SE}|드세|드쎄|사납|억세|설친|나댄|남편 기를 누르|남편을 누르|남편을 잡)|(드센|드쎈|기 센|기가 센|기 쎈|기가 쎈|기센|기쎈|사나운|억센) ${WOMAN}`),
  },
  { id: "woman-role", code: "GENDER_STEREOTYPE", severity: "block", label: "여자의 역할 고정", re: new RegExp(`${WOMAN}(는|란|라면|로서|답게)[^.!?]{0,12}(집안일|살림|순종|남편을 (받들|따르|섬기)|내조|참아야|조신)|현모양처|여자 팔자는 뒤웅박|시집 잘 가|남자를 잘 만나야|팔자 고친다|팔자를 고친다`) },
  { id: "man-role", code: "GENDER_STEREOTYPE", severity: "warn", label: "남자의 역할 고정", re: new RegExp(`${MAN}(는|란|라면|로서|답게|가)[^.!?]{0,12}(울면 안|돈을 벌어야|집안을 책임져야|가장 노릇|약한 모습)|남자답지 못|여자 같은 남자|남자 같은 여자`) },
  { id: "woman-no-officer", code: "GENDER_STEREOTYPE", severity: "block", label: "여자 무관·관살 판정", re: /(여자|여성)[^.!?]{0,10}(관|관성|관살|상관|괴강|비겁)[^.!?]{0,8}(많으면|강하면|없으면|있으면)[^.!?]{0,12}(남편|과부|재혼|팔자|드세|박복)/ },
  // 도덕·복 판정
  {
    id: "fate-strong", code: "MORAL_JUDGEMENT", severity: "block", label: "팔자가 세다·박복",
    re: new RegExp(`팔자가?\\s?${ADV}\\s?(세|쎄|드세|드쎄|사납|기구|박하|나쁘|사나)${NOT_SE}|(센|쎈|드센|드쎈|사나운) 팔자|기구한 (팔자|운명)|박복|복이 박`),
  },
  {
    id: "spouse-luck", code: "MORAL_JUDGEMENT", severity: "block", label: "배우자·부모·자식 복 판정",
    re: new RegExp(`(남편|아내|부인|처|배우자|부모|자식|자녀|형제|윗사람|서방|남자|여자|시댁|처가)\\s?(복|덕)(이|은|는|도)?\\s?${ADV}\\s?(없|박하|박한|약하|모자라)|(남편|아내|처|배우자|자식)\\s?복이 많|(남편|아내|처)을? 잡아먹|(극부|극처|상부|상처할|과부 팔자|홀아비 팔자|과부가 될|과부 될)`),
  },
  { id: "marriage-fate", code: "MORAL_JUDGEMENT", severity: "block", label: "결혼·재혼 팔자 판정", re: /(결혼을? 못 할|결혼 못 할|시집을? 못|장가를? 못|두 번 결혼|재혼할 팔자|이혼할 팔자|혼자 살 팔자|독수공방|외로울 팔자|고독한 팔자|첩이 될|첩살이|소실)/ },
  // "돈이 헤프게 나간다"는 씀씀이 이야기라 제외 — 사람·행실에 붙은 '헤프다'만
  { id: "lust", code: "MORAL_JUDGEMENT", severity: "block", label: "음란·바람기 판정", re: /(음란|색을 밝|바람기|바람둥이|화냥|(행실|몸가짐|처신|몸|여자|남자|사람)[^.!?]{0,4}헤프|헤픈 (여자|남자|사람|년|놈)|이성 문제가 끊이지|도화[^.!?]{0,8}(바람|이성 문제|색정|문란))/ },
  { id: "low-character", code: "MORAL_JUDGEMENT", severity: "block", label: "천하다·못됐다류 품성 판정", re: /(천한 (사주|팔자|사람)|천박|못된 (성격|사주|팔자)|성격이 (나쁘|못됐|더럽)|인덕이 없|인복이 없|재수가 없|살이 끼었|흉한 사주|나쁜 사주|독한 팔자|악한 기운)/ },
  { id: "bad-luck-label", code: "MORAL_JUDGEMENT", severity: "warn", label: "나쁜 운·흉한 해 낙인(원칙 8)", re: /(나쁜 운|흉한 (해|운|시기)|흉운|악운|운이 나쁜 해|최악의 해|재앙)/ },
  { id: "stubborn", code: "MORAL_JUDGEMENT", severity: "warn", label: "고집 낙인(원칙 11)", re: /고집(이|이가)? (세|쎄|세다|불통|쟁이)|고집불통|고집쟁이|드세다|드센 편/ },
]

/**
 * 옛 판정을 걷어 내는 문장인가. 문장 어디에 "아니다"가 있다고 낮추면
 * "남편 복이 없는 건 네 탓이 아니다"처럼 판정을 유지한 채 빠져나간다(독립 검토 5-08). 그래서 둘 중 하나일 때만:
 *  ① 판정 앞에 옛 출처를 밝힘("옛 책에서는 …", "예전엔 …", "그 시대 …")
 *  ② 판정 바로 뒤에 부정이 붙음("드세다가 아니라", "팔자가 세다는 말은 옛 잣대", "…라고 쓰지 마라")
 */
const ATTRIBUTION_BEFORE_RE = /(옛\s?(책|날|사람|어른|명리|풀이|말|글|잣대)|옛책|고서|예전(엔|에는|에)|그 시대|전통 해석|옛 잣대|옛날)/
const NEGATION_AFTER_RE =
  /^((다|라|이다)?\s?(는|란|라는|다는|이라는)?\s?(말|뜻|판정|소리|것|게|건)?\s?(은|는|이|가)?\s?(아니|아냐|틀린|틀렸|옛|시대)|(다|라)?\s?(고들|라고들|다고들)|[^.!?]{0,8}(쓰지 마|말하지 마|하지 마라|로 읽지 않|로 보지 않|가 아니라|이 아니라))/

/** 따옴표로 묶어 "표현의 예"로 든 판정("팔자가 사납다"처럼, '박복하다'라는 말) */
const CITED_EXPRESSION_RE = /^[^"'“”‘’「」]{0,12}["'”’」]\s?(?:처럼|같은|과 같은|와 같은|이라는|라는|란|이란|는 말|라는 말|하는 말|은 말|이라고들|라고들)/

export function isReframed(sentence: string, index: number, length: number): boolean {
  if (ATTRIBUTION_BEFORE_RE.test(sentence.slice(0, index))) return true
  if (/["'“‘「]\s?[^"'”’」]{0,6}$/.test(sentence.slice(Math.max(0, index - 8), index)) && CITED_EXPRESSION_RE.test(sentence.slice(index + length, index + length + 20))) return true
  return NEGATION_AFTER_RE.test(sentence.slice(index + length, index + length + 16))
}

export function checkMoral(segments: TextSegment[]): Finding[] {
  const out: Finding[] = []
  for (const seg of segments) {
    const sentences = splitSentences(seg.text)
    sentences.forEach((s, si) => {
      const loc = sentences.length > 1 ? { ...seg.location, sentence: si } : seg.location
      const reported = new Map<string, string>()
      for (const r of MORAL_RULES) {
        const m = r.re.exec(s.text)
        if (!m) continue
        const reframed = isReframed(s.text, m.index, m[0].length)
        // 같은 문장에서 같은 코드는 한 번(가장 먼저 걸린 규칙 = 더 구체적인 규칙이 앞에 오지 않으므로 심각도 높은 쪽 유지)
        const sev = reframed ? "info" : r.severity
        const prev = reported.get(r.code)
        if (prev && (prev === "block" || prev === sev || sev === "info")) continue
        reported.set(r.code, sev)
        out.push({
          severity: reframed ? "info" : r.severity,
          code: r.code,
          location: loc,
          excerpt: excerptAt(s.text, m.index, m[0].length),
          rule: r.id,
          message: reframed
            ? `${r.label} 표현이 있으나 옛 판정을 걷어 내는 문장으로 보임 — 사람 확인 권장`
            : `${r.label}: 옛 책의 도덕·성별 판정은 지금의 말로 바꿔야 함(원칙 5·8·11)`,
        })
      }
    })
  }
  return out
}
