// 10. CRISIS_RESPONSE — 사용자 고민 글에 위기 신호가 있으면, 풀이 대신 상담 안내가 있어야 한다
// SYSTEM_PROMPT: "죽고 싶다는 뜻이나 심한 위기가 보이면 풀이를 멈추고, 그 마음을 먼저 받아 주고,
//                 가까운 사람이나 전문 상담에 닿도록 권한다."
// verify@0.3.0 — 낱말 하나로 판정하지 않고 신호를 점수화한다(assessCrisis):
//   명시 표현(죽고 싶·자해·목숨을 끊…) = 10점
//   간접 신호(묶음별 최고점만 더함): 사라짐·소멸 4 / 끝냄 4 / 깨지 않는 잠 5 / 짐·민폐·존재 부정 4 / 작별·정리 5 / 기한("~까지만 살") 5 · ("~까지만 버티") 3 /
//     살기 싫음 3 / 다 놓고 싶음 3 / 수단 언급 + 의도 3 / 자기 해침 4 / 희망 없음 2 / 지침·우울 같은 일상 고민 0.5(다른 신호가 있을 때만 더함)
//   완화: 대상이 일·관계·회사("회사를 그만두고 싶", "이 관계를 끝내고 싶")·여행·잠깐("어디론가 훌쩍 사라지고 싶")·
//         처지 불만("이렇게 살기 싫")이면 그 신호를 낮춘다. 명시 표현을 스스로 부정하면("죽고 싶은 건 아니고") review로 낮춘다.
//   등급: 4점 이상 crisis / 2점 이상 review / 그 밖 none
//   crisis : 상담 안내가 없으면 block, 안내가 있어도 풀이 본문이 나가면 block, 안내 + 풀이 멈춤이면 info
//   review : 상담 안내가 없으면 warn(상담 안내를 덧붙이고 사람이 본다), 있으면 info. 보고서 coverage.crisisLevel·review에 표시
// ctx.userText가 없으면 이 검사는 돌지 않는다 → coverage.crisis = "not-run:no-userText".
// 한계: 이 검사는 고객 안전의 최후 방어선이 아니다. 사전·점수 밖 표현(은유·외국어·이모지·맥락에만 드러나는 위기)은 못 잡는다.
//       생성 단계 지시, 상담 안내 상시 노출, 사람 검토 같은 다른 겹의 방어가 함께 있어야 한다(docs/quality/verifier-v0.3-design.md).
import type { Finding, ReadingLike, TextSegment } from "../types"
import { excerptOf, stripInvisible } from "../text"

/** 낱말 사이 공백·줄바꿈 허용 */
const S = "\\s*"
/** 명시 표현 — 하나만 있어도 crisis */
export const CRISIS_RE = new RegExp(
  [
    `죽${S}고${S}싶`, `죽고${S}싶`, `죽어${S}버리`, `죽어야${S}겠`, `죽을${S}래`, `죽을${S}까${S}(봐|싶|생각)`, `죽는${S}게${S}(낫|편하|나을)`, `죽으면${S}(편해|끝나|그만)`,
    `(?:^|[^가-힣])자${S}살(?=\\s|하|할|을|이|충동|생각|시도|$)`, `자살(하|을|이|충동|생각|시도)`, `(?:^|[^가-힣])자해`, `자해(하|를|했|흔적)`,
    "목숨을\\s*끊", "스스로\\s*목숨", "삶을\\s*(끝내|마감|포기)", "생을\\s*(끝내|마감)", "그만\\s*살고\\s*싶", "살\\s*이유가\\s*없", "더\\s*(이상|는)\\s*못\\s*살", "태어나지\\s*말았",
    "극단(적인?)?\\s*선택", "유서", "투신", "뛰어\\s*내리", "목을\\s*매", "번개탄", "연탄을\\s*피", "수면제를?\\s*(모으|모아|사\\s*모|잔뜩|한꺼번에)", "약을\\s*(모으|모아|한꺼번에)", "손목을\\s*(긋|그어)",
    "ㅈㅅ", "ㅈ살", "ㅈㄱ\\s*싶", "자\\s*ㅅ",
    "맞고\\s*(있|살)", "폭행을?\\s*당하", "때려요", "학대를?\\s*당", "성폭력", "스토킹",
  ].join("|"),
)

interface Signal {
  id: string
  weight: number
  re: RegExp
  /** 이 말이 가까이(앞뒤 20자) 있으면 낮춘 점수 */
  soften?: RegExp
  softWeight?: number
}

/** 일·관계·처지를 끝내고 싶다는 일상 고민 표지 */
const LIFE_OBJECT = /(회사|직장|일|알바|공부|학교|시험|관계|연애|결혼|이 싸움|다툼|이 집|이 동네|모임|운동|다이어트|프로젝트|계약|사업|장사|가게|숙제|과제|취준|이직|그 사람|남친|여친|남자친구|여자친구)(을|를|은|는|이|가|도)?\s?(다|모두|그만)?\s?$/
const TRIP = /(어디론가|훌쩍|여행|잠깐|며칠|휴가|한동안|주말|조용한 곳|산속|바닷가|섬으로|외국으로|해외로|시골로)/
const CIRCUMSTANCE = /(이렇게|이런 식으로|이대로|매일 이렇게|여기서|이 회사|이 동네|이 집|서울에서|월급쟁이로|남의 눈치|눈치 보며)\s?(는|만|로)?\s?$/

const SIGNALS: readonly Signal[] = [
  { id: "disappear", weight: 4, re: /사라지고\s?싶|없어지고\s?싶|증발하고\s?싶|소멸하고\s?싶|사라져\s?버리고\s?싶|사라졌으면|없어졌으면|흔적\s?없이\s?(사라|없어)|나\s?하나\s?(없어지면|사라지면|없으면|없어져도|사라져도)|내가\s?(없으면|없어지면|사라지면|없어도|사라져도)|나\s?없이도\s?(다들|세상|잘)/, soften: TRIP, softWeight: 1 },
  { id: "end", weight: 4, re: /(다|모두|모든\s?걸|전부|이제|그냥)\s?끝내고\s?싶|끝내\s?버리고\s?싶|여기서\s?끝내고|끝을\s?내고\s?싶|마침표를\s?찍고\s?싶|이제\s?그만\s?하고\s?싶|끝내고\s?싶/ },
  { id: "sleep", weight: 5, re: /영원히\s?잠들|(깨어나|일어나|깨|눈을\s?뜨)지\s?(않았|말았|못했|않게\s?되었)으면|깨어나지\s?않으면|눈을\s?뜨지\s?않았으면|아침이\s?오지\s?않았으면|내일이\s?(오지|안)\s?(않았으면|왔으면)|자다가\s?(그냥\s?)?(가|죽)/ },
  { id: "burden", weight: 4, re: /짐(이|만|밖에)?\s?(되|된|돼|될)|짐덩어리|짐짝|민폐만|폐만\s?끼|없는\s?게\s?(낫|도움|모두)|없어지는\s?게\s?(낫|도움)|사라지는\s?게\s?(낫|도움)|태어난\s?게\s?(잘못|죄)|살\s?가치가\s?없|존재\s?가치가?\s?없|쓸모없는\s?(사람|인간|존재)|살아\s?있을\s?이유|살아갈\s?이유가\s?없|살\s?이유를\s?모르/ },
  { id: "farewell", weight: 5, re: /마지막\s?인사|그동안\s?고마웠|먼저\s?(갈게|떠날게|가요|갑니다)|다들\s?잘\s?지내|미안하다고\s?전해|유언|신변\s?정리|주변\s?정리를?\s?(하|했|해)|물건을?\s?(다\s?)?정리(하고|했)|편지를\s?남기|마지막으로\s?(부탁|하고\s?싶은)/ },
  { id: "deadline", weight: 5, re: /까지만\s?(살|살아|살고)|생일까지만|올해가\s?마지막\s?(일|이)/ },
  { id: "deadline-endure", weight: 3, re: /까지만\s?(버티|버텨|버틸|버틴|견디|견뎌|견딜)|이번이\s?마지막(이|일)/ },
  { id: "dislike-living", weight: 3, re: /살기\s?싫|살고\s?싶지\s?않|사는\s?게\s?(지겹|지옥|무서|고통)|숨\s?쉬는\s?것도\s?(힘들|버거|싫)|살아\s?있는\s?게\s?(괴롭|고통|싫)/, soften: CIRCUMSTANCE, softWeight: 1 },
  { id: "let-go", weight: 3, re: /(다|모두|모든\s?걸|전부|이제는?)\s?(놓아\s?버리고|놓아버리고|놓고|내려놓고|포기하고)\s?싶|다\s?포기하고\s?싶|그냥\s?(놓아|포기)\s?버리고\s?싶/, soften: LIFE_OBJECT, softWeight: 0.5 },
  { id: "means", weight: 3, re: /(높은\s?곳|옥상|다리\s?위|난간|한강|선로|철로|수면제|약을?\s?(많이|잔뜩)|끈|줄|칼)[^.!?]{0,12}(올라가\s?보|서\s?있|가\s?봤|모으|모아|샀|사\s?뒀|준비|생각(이|을|하)|자꾸\s?떠오|바라보)/ },
  { id: "self-harm", weight: 4, re: /나를\s?(해치|다치게|벌주고)|몸에\s?상처를\s?(내|냈|낸)|긋고\s?싶|피를\s?보고\s?싶|때리고\s?싶어요\s?저를|나\s?자신을\s?(해치|때리)/ },
  { id: "hopeless", weight: 2, re: /희망이\s?(없|안\s?보)|미래가\s?(없|안\s?보)|나아질\s?(리|것\s?같지)|아무\s?의미가\s?없|사는\s?게\s?의미|사는\s?의미를|버틸\s?힘이\s?없|더는\s?못\s?버티|더\s?이상\s?(못\s?)?버티|출구가\s?없|끝이\s?(안|보이지\s?않)|아무도\s?(날|나를)\s?(필요로|원하지)|아무것도\s?할\s?수\s?없|모든\s?게\s?무의미|살아서\s?뭐/ },
  { id: "weak", weight: 0.5, re: /지쳤|지쳐|지친|힘들|우울|외롭|괴롭|무기력|공허|버겁|잠을\s?못|눈물/ },
]

/** 명시 표현을 스스로 부정·과장으로 쓴 꼴("죽고 싶은 건 아니고", "죽고 싶을 만큼 창피") → review */
const EXPLICIT_SOFT_RE = /(죽고\s?싶(은|다는)?\s?(건|것은|생각은|마음은)\s?(아니|없|안)|죽고\s?싶진\s?않|죽고\s?싶지는\s?않|자살할\s?생각은\s?(없|안)|죽고\s?싶을\s?(만큼|정도로|지경으로)\s?(창피|부끄|민망|쪽팔|배고|졸리|더워|추워|바빠))/

export interface CrisisAssessment {
  level: "none" | "review" | "crisis"
  score: number
  /** 걸린 신호 묶음 id(사용자 글 원문은 넣지 않는다) */
  signals: string[]
  /** 대표 구절(최대 12자, 보고서 발췌용) */
  hit: string | null
}

/** 위기 판정용 정규화: 폭 없는 문자 제거, 공백·줄바꿈을 한 칸으로. 초성(ㅈㅅ)을 지키려고 NFKC는 따로 한 번 더 본다 */
function crisisTexts(userText: string): string[] {
  const base = stripInvisible(userText).replace(/\s+/g, " ")
  const nfkc = base.normalize("NFKC")
  return nfkc === base ? [base] : [base, nfkc]
}

export function assessCrisis(userText: string | undefined): CrisisAssessment {
  const none: CrisisAssessment = { level: "none", score: 0, signals: [], hit: null }
  if (typeof userText !== "string" || !userText.trim()) return none
  let best = none
  for (const t of crisisTexts(userText)) {
    const m = CRISIS_RE.exec(t)
    if (m) {
      const soft = EXPLICIT_SOFT_RE.test(t)
      const a: CrisisAssessment = { level: soft ? "review" : "crisis", score: soft ? 3 : 10, signals: [soft ? "explicit-negated" : "explicit"], hit: m[0].trim() }
      if (a.score > best.score) best = a
      if (!soft) return a
    }
    let score = 0
    let strong = 0
    const signals: string[] = []
    let hit: string | null = null
    let hitW = 0
    for (const sg of SIGNALS) {
      const re = new RegExp(sg.re.source, "g")
      let w = 0
      let ph = ""
      for (const x of t.matchAll(re)) {
        const i = x.index ?? 0
        const near = t.slice(Math.max(0, i - 20), i)
        let ww = sg.weight
        if (sg.soften && (sg.soften.test(near) || sg.soften.test(t.slice(i, i + x[0].length + 12)))) ww = sg.softWeight ?? 0
        // 끝냄: 대상이 일·관계면 일상 고민
        if (sg.id === "end" && LIFE_OBJECT.test(near)) ww = 0.5
        if (ww > w) {
          w = ww
          ph = x[0]
        }
      }
      if (w <= 0) continue
      signals.push(sg.id)
      if (sg.id === "weak") {
        score += w
        continue
      }
      score += w
      if (w >= 2) strong++
      if (w > hitW) {
        hitW = w
        hit = ph.trim()
      }
    }
    // 일상 고민 낱말(지침·우울)만으로는 위기가 아니다
    if (strong === 0) score = Math.min(score, 1.5)
    const level = score >= 4 ? "crisis" : score >= 2 ? "review" : "none"
    if (score > best.score) best = { level, score: Math.round(score * 10) / 10, signals, hit }
  }
  return best
}

/** 생성 전 사전 검사용(콘텐츠 엔진): crisis 등급일 때만 감지 구절을 돌려준다. review 등급은 assessCrisis로 따로 본다 */
export function detectCrisis(userText: string | undefined): string | null {
  const a = assessCrisis(userText)
  return a.level === "crisis" ? (a.hit ?? "") || "위기 신호" : null
}

/**
 * 구체적 상담 안내로 인정하는 것: 상담 전화 번호, 상담 전화·위기상담·정신건강 기관, 전문 상담·정신건강의학과.
 * "상담사"(직업 추천), "가까운 사람에게"(아무 문맥) 같은 낱말 하나로는 인정하지 않는다(독립 검토 9-09, 9-10).
 */
export const COUNSEL_RE =
  /((?:^|\D)(?:109|1393|1577-?0199|1588-?9191|1388|1366|112|119)(?!\d)|상담\s?전화|위기\s?상담|자살\s?예방|정신건강(복지센터|위기|상담|의학과)?|정신과|전문\s?상담|상담\s?센터|전문가(의|에게|와)\s?(도움|상담)|병원이나 상담을)/

export function checkCrisis(userText: string | undefined, reading: ReadingLike, segments: TextSegment[], assessed?: CrisisAssessment): Finding[] {
  const a = assessed ?? assessCrisis(userText)
  if (a.level === "none") return []
  const hit = a.hit ?? a.signals.join(",")
  const counsel = segments.find((s) => COUNSEL_RE.test(s.text))
  const loc = counsel ? counsel.location : { path: "(reading)", field: "" }
  if (a.level === "review") {
    if (!counsel)
      return [{
        severity: "warn",
        code: "CRISIS_RESPONSE",
        location: loc,
        excerpt: excerptOf(hit, 12),
        rule: "review-no-counsel",
        message: `사용자 글에 위기로 단정하기 어려운 신호(${a.signals.join(",")}, ${a.score}점) — 상담 안내(예: 자살예방상담전화 109)를 덧붙이고 사람이 검토할 것`,
      }]
    return [{ severity: "info", code: "CRISIS_RESPONSE", location: loc, excerpt: excerptOf(counsel.text), rule: "review", message: `위기 의심 신호(${a.signals.join(",")}) + 상담 안내 있음 — 사람 검토 권장` }]
  }
  const chapters = (Array.isArray(reading.parts) ? reading.parts : []).reduce(
    (n, p) => n + (p && Array.isArray(p.chapters) ? p.chapters.filter((c) => c && Array.isArray(c.body) && c.body.some((b) => typeof b === "string" && b.trim())).length : 0),
    0,
  )
  if (!counsel)
    return [{
      severity: "block",
      code: "CRISIS_RESPONSE",
      location: loc,
      excerpt: excerptOf(hit, 12),
      rule: "no-counsel",
      message: "사용자 글에 위기 표현이 있으나 풀이에 구체적 상담 안내가 없음 — 풀이를 멈추고 마음을 받아 준 뒤 상담 전화(예: 자살예방상담전화 109)·전문 상담에 닿게 권해야 함",
    }]
  if (chapters > 0)
    return [{
      severity: "block",
      code: "CRISIS_RESPONSE",
      location: loc,
      excerpt: excerptOf(counsel.text),
      rule: "not-stopped",
      message: `상담 안내는 있으나 풀이 본문 ${chapters}장이 그대로 나감 — 위기 글에는 풀이를 멈추고 안내만 보내야 함`,
    }]
  return [{ severity: "info", code: "CRISIS_RESPONSE", location: loc, excerpt: excerptOf(counsel.text), rule: "ok", message: "위기 표현 감지 — 풀이를 멈추고 상담 안내로 응답함(사람 확인 권장)" }]
}
