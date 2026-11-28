// 유료 기본 풀이 8장 (P4-03) — 본질·성향 / 재능·직업 / 돈의 흐름 / 사람·인연 / 지금 대운 / 올해와 내년 / 갈림길 / 마무리
// 기본 풀이(BASIC)와 주제·총괄 상품이 같이 쓴다. 장마다 "다른 장 몫"을 밝혀 같은 말이 장마다 되풀이되지 않게 한다.
import { defineChapter } from "../chapter"
import { currentDaeun, isShakingYear, nextYearOf } from "../facts"
import { ASK, CAVEAT, SUB, THREE_FACES, TITLE, TODO, arr, body, chips, int, obj, str } from "../schema"

const LIFE_STAGE_RULE =
  "같은 십성도 나이에 따라 다르게 나타난다. [읽는 사람]의 만 나이·인생 단계에 맞는 장면만 쓴다(학령기 식상·인성은 공부머리, 사회 진입기 재성은 월급·주거, 은퇴 뒤 관성은 역할의 변화처럼). 장면은 여지를 두고 쓴다."

export const nature = defineChapter({
  id: "nature",
  title: "타고난 옷감 — 본질·성향",
  tier: "paid",
  maxOutputTokens: 1800,
  tokenBasis: "본문 4문단×3.5문장×50자 ≈ 700자 + 제목·부제·칩 4개·할 일·물음·불확실성 ≈ 220자 = 약 920자 → 약 1,060토큰. 풀이의 첫인상이라 문단 수가 가장 많아 여유 1.7배",
  factParts: ["subject", "pillars", "natalTenGods", "natalInteractions", "gongmang", "elements", "strength", "userFacts", "gaeun", "warnings", "guards"],
  sectionOptions: { gaeunScope: "natal" },
  userFactTopics: ["mbti", "birthOrder", "concernTopic", "selfStrength", "selfWeakness"],
  flow: {
    nature: "body[0] 겉, body[1] 속 — 태어난 날의 두 글자와 태어난 계절, 오행의 넘침과 모자람에서 고른 한 장면.",
    links: "body[2] — 스스로 느끼는 강점·아쉬운 점을 타고난 결 옆에 나란히 둔다(일치·불일치는 줄 끝 연결 표지만 따른다).",
    change: "body[3] — 어디서 왜 굳는지와 그 굳은 데를 바꿔 볼 실천(채울 것 하나 + 덜 것 하나). todo에 가장 구체적인 실천 하나.",
  },
  tasks: () => [
    "태어난 날의 두 글자(일주)와 태어난 계절(월지), 오행의 넘침과 모자람에서 이 사람만의 장면 하나를 고른다. 그 장면으로 네 문단을 잇는다. 장면은 [여덟 글자]의 그림 말로 그린다.",
    "body[0] 겉: 남이 먼저 보는 얼굴. body[1] 속: 혼자 있을 때의 결.",
    "body[2]: 사용자 사실(스스로 느끼는 강점·아쉬운 점)이 있으면 살아온 모습과 잇는다. 없으면 이 사람을 여는 것(무엇이 이 사람을 풀리게 하고 움직이게 하는지)으로 쓴다.",
    "body[3] 굳는 데와 바꿔 볼 것: 어디서 왜 굳는지를 근거 글자로 쓰고, 그 굳은 데를 바꿔 볼 실천을 바로 준다. 이 문단 첫머리에 말버릇 '글자는 생김새다. 쓰는 건 너다.'를 두고, 문단은 실천으로 끝낸다. 말씨 세기가 허락하면 여기서 한 번 짚는다.",
    "body[3]의 실천은 [바꿔 볼 것]의 채울 것(모자란 힘 채우기) 하나와 덜 것(넘치는 힘 덜어 내기) 하나를 같이 쓴다. 균형 범주(지금 균형 지키기)뿐이면 지킬 습관 하나로 쓴다. 계절 기운 범주가 있으면 몸·생활 리듬 실천 한 문장을 '계절 기운으로 보면' 머리말로 덧붙인다. todo는 그중 가장 구체적인 하나. [바꿔 볼 것]에 범주가 없다고 적혀 있으면 그 안내를 따른다.",
    "타고난 글자끼리의 관계(합·충 등)가 성격에 걸리면 한 번, 관계 줄의 쉬운 말로 쓴다. 충은 다 깨지는 것이 아니고, 합은 붙기도 하고 묶이기도 한다.",
    "비어 있는 자리(공망)는 타고난 글자에 걸린 곳이 있을 때만, '어떤 사람한텐 아무 일도 안 한다'는 여지와 함께 쓴다.",
    "형제 순서·MBTI 같은 사용자 사실은 비유와 장면을 고를 때만 쓰고, 성격의 근거로 쓰지 않는다.",
  ],
  notHere: "재주·직업(재능 장), 돈 쓰는 버릇(돈 장), 가까운 사람과의 관계(사람 장), 대운·올해(운 장)",
  length: "body 정확히 4문단, 문단마다 2~4문장. chips 2~4개",
  catchphrases: [
    { key: "lookHere", where: "body[0] 첫머리" },
    { key: "shapeNotFate", where: "body[3] 첫머리" },
  ],
  outputSchema: obj({ title: TITLE, sub: SUB, chips: chips("2~4"), body: body("정확히 4개: [겉, 속, 살아온 모습과 잇기(사용자 사실이 없으면 여는 것), 굳는 데와 바꿔 볼 것]"), todo: TODO, ask: ASK, caveat: CAVEAT }),
})

export const talent = defineChapter({
  id: "talent",
  title: "네 손이 잘하는 일 — 재능·직업",
  tier: "paid",
  maxOutputTokens: 1500,
  tokenBasis: "본문 3문단 ≈ 450자 + 자리 3개×80자 = 240자 + 공통 칸 ≈ 180자 = 약 870자 → 약 1,000토큰, 여유 1.5배",
  factParts: ["subject", "pillars", "natalTenGods", "natalInteractions", "elements", "strength", "userFacts", "gaeun", "warnings", "guards"],
  sectionOptions: { gaeunScope: "workNatal" },
  userFactTopics: ["occupationStatus", "careerFeeling", "concernTopic", "workStyle", "selfStrength"],
  flow: {
    nature: "body[0] — 가장 큰 재주(사실표 십성이 어느 자리에 있는지에서).",
    links: "body[1] — 지금 하는 일·스스로 말한 일하는 방식·강점을 글자가 말하는 일하는 방식 옆에 나란히 둔다. 다르면 '글자 밖에서 익힌 방식'으로 존중한다.",
    change: "body[2] — 모자란 쪽을 메우는 법(남의 손 빌리기·연장 갖추기·일하는 순서 바꾸기). todo에 가장 구체적인 실천 하나.",
  },
  tasks: () => [
    "사실표 십성을 다섯 묶음으로 본다: 식신·상관=드러내고 만드는 재주, 편재·정재=다루고 굴리는 재주, 편관·정관=맡고 책임지는 재주, 편인·정인=배우고 채우는 재주, 비견·겁재=제 힘으로 밀고 가는 재주. 사실표에 있는 묶음만, 어느 자리에 있는지를 근거로 쓴다. 묶음이 몇 개인지는 [바꿔 볼 것]의 '드러난 글자 묶음 개수' 값만 옮기고 스스로 세지 않는다(그 값이 없으면 개수를 말하지 않는다). 고객 문장에는 묶음 이름보다 이 쉬운 말을 먼저 쓴다.",
    "body[0] 가장 큰 재주. body[1] 일하는 방식(혼자/함께, 빠르게/깊게 등 근거 글자에서 나온 것) — 사용자 사실이 있으면 살아온 모습과 잇는다. body[2] 모자란 쪽 메우기(개수 값이 0인 묶음만 '드러나 있지 않다'고 쓰고, '없어서 못 한다'가 아니라 남의 손을 빌리거나 연장을 갖추는 법으로)와 바꿔 볼 실천. 바꿔 볼 실천은 [바꿔 볼 것]의 일하는 방식 범주에서 하나.",
    "fits: 값이 오르는 자리 2~3개. place는 직업 이름 단정이 아니라 일의 모양(예: '남의 글을 고치는 자리'), text는 근거(그림 말)와 이유 한두 문장.",
    "사용자 사실의 지금 하는 일이 있으면 그 자리에서 재주를 쓰는 법으로 옮긴다. 학생이면 공부·진로, 은퇴했으면 재주를 나누는 일로.",
    "직업을 사주로 정해 주지 않는다. 시험 합격·승진을 단정하지 않는다.",
    LIFE_STAGE_RULE,
  ],
  notHere: "성격 장면(본질 장), 돈 버는 법(돈 장), 일터를 옮길지 말지(직업 상품 장), 대운·올해",
  length: "body 정확히 3문단, fits 2~3개. chips 2~3개",
  outputSchema: obj({
    title: TITLE,
    sub: SUB,
    chips: chips("2~3"),
    body: body("정확히 3개: [가장 큰 재주, 일하는 방식과 살아온 모습, 모자란 쪽 메우기와 바꿔 볼 것]"),
    fits: arr(obj({ place: str("일의 모양 이름. 15자 이내. 직업명 단정 금지"), text: str("근거 글자와 이유. 1~2문장, 80자 이내") }), "값이 오르는 자리 2~3개"),
    todo: TODO,
    ask: ASK,
    caveat: CAVEAT,
  }),
})

export const money = defineChapter({
  id: "money",
  title: "돈 드나드는 문 — 돈의 흐름",
  tier: "paid",
  maxOutputTokens: 1400,
  tokenBasis: "본문 3문단 ≈ 450자 + 버는·모으는·새는 3줄×60자 = 180자 + 공통 칸 ≈ 160자 = 약 790자 → 약 900토큰, 여유 1.5배",
  factParts: ["subject", "pillars", "natalTenGods", "natalInteractions", "elements", "userFacts", "gaeun", "warnings", "guards"],
  sectionOptions: { gaeunScope: "workNatal" },
  userFactTopics: ["occupationStatus", "moneyFocus", "hasChildren", "selfWeakness"],
  flow: {
    nature: "body[0] — 돈이 드는 문(돈과 살림을 뜻하는 글자가 어디 몇 개 있는지).",
    links: "body[1] — 지금 하는 일·돈 이야기에서 궁금한 것·스스로 아쉽다고 느끼는 점(예: 모으기 어려움)을 돈이 머무는 법 옆에 나란히 둔다. 꾸짖지 않는다.",
    change: "body[2]와 habits.leak — 새는 구멍과 막는 습관. todo에 가장 구체적인 실천 하나(금액·종목 없이).",
  },
  tasks: () => [
    "재성(편재·정재 = 돈과 살림을 뜻하는 글자)이 어디 있는지는 원국 십성 줄 그대로, 몇 개인지는 [바꿔 볼 것]의 '드러난 글자 묶음 개수' 재성 값만 쓴다(그 값이 없으면 개수를 말하지 않는다). 그 값이 0일 때만 '드러난 글자엔 없다'고 쓰되 '돈이 없는 사주'로 판정하지 않는다. 재성을 다루는 힘(식상=돈을 만드는 손, 비겁=나누고 겨루는 손)과의 관계는 사실표에 있는 글자로만 본다. 고객 문장에는 쉬운 말을 먼저 쓴다.",
    "body[0] 돈이 드는 문, body[1] 돈이 머무는 법(사용자 사실이 있으면 잇기), body[2] 새는 구멍과 막는 습관(바꿔 볼 것).",
    "habits: earn·keep·leak 한 문장씩, 각각 근거 포함. leak는 막는 습관으로 끝낸다.",
    "사용자 사실의 지금 하는 일에 맞춰 장면을 옮긴다: 직장=월급·주거, 사업=매출·자금 회전, 학생=용돈·아르바이트, 은퇴=연금·지출 관리.",
    "투자 종목·코인·복권·사고팔 시기는 쓰지 않는다. 물으면 '그건 할미도 모른다' 하고 돈 쓰는 버릇으로 돌린다. 넣는 돈은 잃어도 살림이 안 흔들리는 크기까지만.",
  ],
  notHere: "올해 돈 흐름(올해 장), 직업 고르기(재능 장)",
  length: "body 정확히 3문단, habits 3줄. chips 2~3개",
  catchphrases: [{ key: "dontKnow", where: "투자·종목 이야기를 거절할 때만" }],
  outputSchema: obj({
    title: TITLE,
    sub: SUB,
    chips: chips("2~3"),
    body: body("정확히 3개: [드는 문, 머무는 법과 살아온 모습, 새는 구멍과 바꿔 볼 습관]"),
    habits: obj({
      earn: str("버는 법 한 문장. 60자 이내. 근거 글자 포함"),
      keep: str("모으는 법 한 문장. 60자 이내. 근거 글자 포함"),
      leak: str("새는 곳과 막는 법 한 문장. 60자 이내. 근거 글자 포함"),
    }),
    todo: TODO,
    ask: ASK,
    caveat: CAVEAT,
  }),
})

export const people = defineChapter({
  id: "people",
  title: "곁자리와 사람 — 사람·인연",
  tier: "paid",
  maxOutputTokens: 1400,
  tokenBasis: "본문 3~4문단 ≈ 600자 + 공통 칸 ≈ 160자 = 약 760자 → 약 870토큰, 여유 1.6배",
  factParts: ["subject", "pillars", "natalTenGods", "natalInteractions", "gongmang", "userFacts", "gaeun", "warnings", "guards"],
  sectionOptions: { gaeunScope: "relationNatal" },
  userFactTopics: ["relationshipStatus", "birthOrder", "hasChildren", "concernTopic", "changeWish"],
  flow: {
    nature: "body 앞 문단들 — 네가 앉은 자리(곁자리)의 글자, 친구·동료·윗사람과의 거리.",
    links: "마지막 앞 문단 — 연애·혼인 상태·형제 순서·바꾸고 싶은 것을 장면 고를 때 쓰고, 그 배경 옆에 타고난 결을 놓는다.",
    change: "마지막 문단 — 사람 사이에서 바꿔 볼 것(말하는 법·거리 두기·부탁하는 법). todo에 가장 구체적인 실천 하나.",
  },
  tasks: () => [
    "일지(네가 앉은 자리, 곁자리)의 글자와 십성으로 가까운 사람과 지내는 방식을 쓴다. 일지에 걸린 합·충이 사실표에 있으면: 합은 손을 잡는 사이라 잘 붙고 묶이기도 한다, 충은 마주 서서 밀치는 사이라 거리가 움직이기 쉽다(깨진다는 뜻이 아니다).",
    "비겁은 동료·친구·형제와 몫을 나누는 방식, 관성·인성은 윗사람·돌봐 주는 사람과의 거리로 쓴다. '부모 덕이 없다' 같은 가족 판정은 쓰지 않는다.",
    "body는 3~4문단: [가장 가까운 자리, 친구·동료와 윗사람, (사용자 사실이 있으면) 살아온 모습과 잇기, 사람 사이에서 바꿔 볼 것]. 마지막 문단은 늘 바꿔 볼 것이다.",
    "바꾸고 싶은 것이 '사람과의 관계'·'가족 사이'·'연애·부부 사이'면 마지막 문단을 그 주제로 쓴다. 닿는 근거 글자가 없으면 억지로 잇지 않는다.",
    "마지막 문단의 실천은 [바꿔 볼 것]의 관계 역할 범주(같이 가는 사람·책임과 울타리·배움과 돌봄 받는 자리)에서 하나를 관계 장면으로 옮긴다. 범주가 없으면 그 조각의 안내를 따른다.",
    "연애·혼인 상태 사용자 사실이 있으면 장면 고를 때만 쓴다. 말하지 않았으면 짝이나 결혼을 전제하지 않는다. 곁 사람은 성별 없이 '곁 사람', '짝'으로 쓴다.",
    "다른 사람의 속마음을 짐작해 단정하지 않는다.",
  ],
  notHere: "연애 깊이 보기(연애 상품 장), 올해의 인연(올해 장), 성격 장면(본질 장)",
  length: "body 3~4문단, 문단마다 2~4문장. chips 2~3개",
  outputSchema: obj({ title: TITLE, sub: SUB, chips: chips("2~3"), body: body("3~4개. 마지막 문단은 사람 사이에서 바꿔 볼 것"), todo: TODO, ask: ASK, caveat: CAVEAT }),
})

const NEXT_DAEUN = obj(
  {
    ganzhi: str("다음 대운 간지 한자 두 글자(사실표 그대로). 다음 대운이 사실표에 없으면 빈 문자열"),
    start_age: int("다음 대운 시작 만 나이(사실표 그대로). 없으면 0"),
    start_year: int("다음 대운 시작 해(사실표 그대로). 없으면 0"),
    text: str("갈아입는 해에 할 일 1~2문장. 80자 이내. 없으면 빈 문자열"),
  },
  "다음 대운",
)

export const daeunNow = defineChapter({
  id: "daeun-now",
  title: "지금 입은 열 해 — 지금 대운",
  tier: "paid",
  maxOutputTokens: 1600,
  tokenBasis: "본문 2문단 ≈ 300자 + 세 얼굴 3줄×50자 = 150자 + 다음 대운 120자 + 공통 칸 ≈ 200자 = 약 770자 → 약 900토큰, 숫자 칸·중첩 객체가 있어 여유 1.8배",
  factParts: ["subject", "pillars", "natalTenGods", "daeunNow", "daeunInteractions", "userFacts", "gaeun", "noGuessYears", "warnings", "guards"],
  sectionOptions: { tenGodsHidden: false, gaeunScope: "daeun" },
  userFactTopics: ["horizon", "occupationStatus", "careerFeeling", "relationshipStatus", "life_event:", "recent_change:"],
  flow: {
    nature: "body[0]·body[1] — 지금 입은 열 해 옷(대운)의 두 글자를 그림 말로, 타고난 글자를 어떻게 건드리는지.",
    links: "body[1] 끝 — 지금 하는 일·최근 3년 사이 변화·지나온 큰 일을 배경으로 놓고, 그 열 해 글자 옆에 나란히 둔다. 그 변화를 대운 탓으로 단정하지 않는다.",
    change: "faces.worst의 미리 할 일, next.text, todo — 이 열 해를 쓰는 실천(무엇을 시작하고 무엇을 줄일지).",
  },
  tasks: (f) => [
    currentDaeun(f)
      ? "body[0]: 지금 대운(열 해마다 갈아입는 옷)의 두 글자를 그림 말로 먼저 쓰고, 두 글자의 십성(사실표에 있을 때만)은 쉬운 말 뒤 괄호로, 몇 살부터 몇 살까지인지, 이 사람 나이에 어떤 열 해인지."
      : "지금은 첫 대운 전이다. body[0]: 이 시기는 원국(특히 월주)을 중심으로 읽는다는 것과 첫 대운이 언제 오는지(사실표 그대로). 이 시기를 따로 소운으로 보는 방법도 있으니 '월주가 이끈다'고 못 박지 않는다.",
    "body[1]: 대운 글자가 원국과 맺는 관계는 [대운 글자와 원국의 관계]에 있는 것만 쓴다. 없으면 대운 글자의 오행·십성이 원국의 넘침·모자람을 어떻게 건드리는지로 쓴다.",
    "faces: 이 대운이 올 수 있는 얼굴 세 가지. 장면으로 쓴다.",
    "next: 다음 대운이 사실표에 있으면 간지·시작 나이·시작 해를 그대로 옮기고, 갈아입는 해에 할 일을 쓴다(예: 첫 반년은 새 옷에 몸을 맞춘다). 없으면 칸을 비운다.",
    "사용자가 말해 준 지나온 큰 일·최근 변화는 배경으로만 쓰고, [맞히지 않는 해]는 맞히지 않는다.",
    "이 열 해를 쓰는 실천(faces.worst의 미리 할 일, next.text, todo)은 [바꿔 볼 것]의 때 쓰기·열 해 옷 갈아입기·처신 범주에서 고른다. 보는 법이 갈린다고 적힌 범주면 움직이라·다지라 중 하나를 고르지 않는다.",
    LIFE_STAGE_RULE,
  ],
  notHere: "올해 한 해 이야기(올해 장), 대운 전체 목록(인생 총괄 장)",
  length: "body 정확히 2문단, faces 3줄, next 1~2문장. chips 2~3개",
  catchphrases: [{ key: "weather", where: "body[0] 첫머리" }],
  outputSchema: obj({
    title: TITLE,
    sub: SUB,
    chips: chips("2~3"),
    body: body("정확히 2개: [지금 대운, 원국과의 관계]"),
    faces: THREE_FACES,
    next: NEXT_DAEUN,
    todo: TODO,
    ask: str("너에게 묻는 말 한 문장. 40자 이내. 예: '네겐 어느 얼굴로 왔느냐?'"),
    caveat: CAVEAT,
  }),
})

export const yearAhead = defineChapter({
  id: "year-ahead",
  title: "한 해 옷 고쳐 입기 — 올해와 내년",
  tier: "paid",
  maxOutputTokens: 1600,
  tokenBasis: "본문 1문단 150자 + 해 2개×(이름 10+본문 150+줄일 것 50+할 것 50) = 520자 + 공통 칸 ≈ 160자 = 약 830자 → 약 950토큰, 여유 1.7배",
  factParts: ["subject", "pillars", "natalTenGods", "daeunNow", "thisYear", "nextYear", "seunInteractions", "userFacts", "gaeun", "noGuessYears", "warnings", "guards"],
  sectionOptions: { tenGodsHidden: false, gaeunScope: "seun" },
  userFactTopics: ["horizon", "occupationStatus", "relationshipStatus", "careerFeeling", "life_event:", "recent_change:"],
  flow: {
    nature: "body 앞 — 지금 입은 열 해 옷 안에서 올해 들어오는 글자가 어떤 해를 만드는지.",
    links: "body 끝 — 최근 3년 사이 변화·지금 하는 일을 배경으로 올해와 잇는다(그 일을 올해 글자로 설명하지 않는다).",
    change: "years[].reduce(줄일 것)·keep(그래도 할 것)과 todo — 그해를 쓰는 실천.",
  },
  tasks: (f) => {
    const ny = nextYearOf(f)
    return [
      "body: 한 문단. 지금 대운 안에서 올해가 어떤 해인지 큰 그림. 올해 들어오는 두 글자는 그림 말로 먼저 쓴다.",
      `years[0]: 올해 ${f.luck.thisYear.year}년. year·ganzhi는 사실표 그대로(${f.luck.thisYear.ganzhi}). 올해 글자가 원국을 건드리는 관계는 [올해 세운 글자와 원국의 관계]에 있는 것만 쓴다.`,
      ny
        ? `years[1]: 내년 ${ny.year}년(${ny.ganzhi}). 사실표 그대로. 내년 글자와 원국의 관계는 사실표에 없으니 십성(있을 때만)과 오행으로만 말한다.`
        : "내년 간지는 사실표에 없다. years에는 올해 하나만 넣고, 내년은 body 끝에 올해 할 일이 어떻게 이어지는지로만 한 문장 쓴다. 내년 간지를 셈해서 쓰지 않는다.",
      "각 해: title(8자 안팎 이름), text(무엇이 움직이기 쉬운지 + 이 해를 쓰는 법, 2문장), reduce(줄일 것), keep(그래도 할 것).",
      "올해의 keep(할 것)과 reduce(줄일 것), todo는 [바꿔 볼 것]의 올해 범주(때 쓰기·처신)에서 옮긴다. 보는 법이 갈린다고 적힌 범주면 '들어갈 문과 나올 문을 같이 확인' 같은 중립 실천만 쓴다.",
      isShakingYear(f)
        ? "[올해 세운]에 흔들리는 해 표지가 있다. 올해를 '흔들리는 해'라고 쓰고 말버릇 '되돌릴 수 있는 크기로 하거라.'를 한 번 쓴다. 내년은 표지가 없으니 '흔들리는 해'라고 부르지 않는다. 시험·승진·결혼·이사 시기를 단정하지 않는다."
        : "[올해 세운]에 흔들리는 해 표지가 없다. 올해도 내년도 '흔들리는 해'라고 부르지 않는다. 시험·승진·결혼·이사 시기를 단정하지 않는다.",
      "달마다의 이야기는 하지 않는다(월운은 사실표에 없다).",
    ]
  },
  notHere: "대운 세 얼굴(지금 대운 장), 갈림길(갈림길 장)",
  length: "body 1문단, years 1~2개(내년이 사실표에 있을 때만 2개). chips 2~3개",
  catchphrases: [
    { key: "weather", where: "body 첫머리" },
    { key: "reversible", where: "흔들리는 해 표지가 있을 때만, 그해의 reduce 또는 text" },
  ],
  outputSchema: obj({
    title: TITLE,
    sub: SUB,
    chips: chips("2~3"),
    body: body("정확히 1개"),
    years: arr(
      obj({
        year: int("양력 연도(사실표 그대로)"),
        ganzhi: str("그해 세운 간지 한자 두 글자(사실표 그대로)"),
        title: str("그해 이름. 8자 안팎"),
        text: str("무엇이 움직이기 쉬운지와 이 해를 쓰는 법. 2문장, 120자 이내. 근거 글자 포함"),
        reduce: str("그해 줄일 것 한 문장. 50자 이내"),
        keep: str("그해에도 할 것 한 문장. 50자 이내"),
      }),
      "올해 1개 + (사실표에 내년이 있을 때만) 내년 1개",
    ),
    todo: TODO,
    ask: ASK,
    caveat: CAVEAT,
  }),
})

const SIDE = obj({
  name: str("길 이름. 12자 이내"),
  gain: str("이 길에서 얻는 것 한 문장. 40자 이내"),
  loss: str("이 길에서 잃는 것 한 문장. 40자 이내"),
})

export const crossroads = defineChapter({
  id: "crossroads",
  title: "갈림길 앞에서",
  tier: "paid",
  maxOutputTokens: 2500,
  tokenBasis: "갈림길 3개×(제목 15+부제 30+두 길 180+기준 3×30+권고 50+할 일 40+물음 40 ≈ 445자) = 1,335자 + 소개 100자 = 약 1,440자 → 약 1,650토큰. 칸 이름이 많아 JSON 부담이 커서 여유 1.5배(상한 2,500)",
  factParts: ["subject", "pillars", "natalTenGods", "natalInteractions", "daeunNow", "thisYear", "seunInteractions", "userFacts", "noGuessYears", "warnings", "guards"],
  sectionOptions: { tenGodsHidden: false },
  userFactTopics: ["concernTopic", "careerFeeling", "loveFocus", "moneyFocus", "occupationStatus", "relationshipStatus", "horizon", "changeWish"],
  flow: {
    nature: "forks[].sub — 그 갈림길이 어떤 글자에서 나왔는지(그림 말로).",
    links: "body(갈림길 소개) — 요즘 마음이 가는 주제·바꾸고 싶은 것·지금 일에 대한 마음을 먼저 받고, 그 주제의 갈림길을 앞에 둔다.",
    change: "forks[].todo — 길마다 오늘부터 해 볼 실천(화면에는 '바꿔 볼 것'으로 나간다).",
  },
  tasks: () => [
    "이 사람의 글자에서 나오는 갈림길 세 가지를 쓴다. 세 갈림길은 서로 다른 근거 글자에 건다.",
    "사용자 사실에 요즘 마음이 가는 주제나 바꾸고 싶은 것이 있으면 그 주제의 갈림길을 하나 이상, 맨 앞에 넣는다. 없으면 타고난 글자의 가장 큰 힘, 지금 대운, 올해에서 하나씩 고른다.",
    "각 갈림길: title, sub(어떤 글자를 가진 사람의 갈림길인지, 근거 글자 포함), 두 길(left·right) 각각 얻는 것과 잃는 것, '예/아니오'로 답할 수 있는 기준 세 가지, 기준에 따른 한 줄 권고, 오늘부터 할 일, 묻는 말.",
    "정해 주지 않고 고르는 기준을 준다. 퇴사·이혼·투자·이사 같은 결정을 대신 내리지 않는다. 한쪽 길을 나쁜 길로 그리지 않는다.",
  ],
  notHere: "성격·재능의 긴 설명(앞 장 몫)",
  length: "body 1문단(갈림길 소개), forks 정확히 3개",
  outputSchema: obj({
    title: TITLE,
    sub: SUB,
    body: body("정확히 1개(갈림길 소개)"),
    forks: arr(
      obj({
        title: str("갈림길 제목. 20자 이내"),
        sub: str("어떤 글자를 가진 사람의 갈림길인지. 40자 이내. 근거 글자 포함"),
        left: SIDE,
        right: SIDE,
        criteria: arr(str("'예/아니오'로 답할 수 있는 물음. 30자 이내"), "정확히 3개"),
        rule: str("기준에 따른 한 줄 권고. 50자 이내. 결정을 대신 내리지 않는다"),
        todo: TODO,
        ask: ASK,
      }),
      "정확히 3개",
    ),
    caveat: CAVEAT,
  }),
})

export const closing = defineChapter({
  id: "closing",
  title: "마무리 — 할미의 당부",
  tier: "paid",
  maxOutputTokens: 1200,
  tokenBasis: "당부 3개×(제목 15+본문 100) = 345자 + 일 년 뒤 가려 볼 말 2개×100자 = 200자 + 공통 칸 ≈ 100자 = 약 650자 → 약 750토큰, 여유 1.6배. 마지막 말은 고정 문구라 파이프라인이 붙여 출력에서 뺐다",
  factParts: ["subject", "pillars", "natalTenGods", "elements", "strength", "daeunNow", "thisYear", "userFacts", "gaeun", "noGuessYears", "warnings", "guards"],
  sectionOptions: { tenGodsHidden: false, gaeunScope: "closing" },
  userFactTopics: ["concernTopic", "horizon", "changeWish", "selfStrength", "selfWeakness", "recent_change:"],
  flow: {
    nature: "points[].text 앞 문장 — 그 당부가 걸린 글자(타고난 글자 하나, 지금 열 해 운 하나, 올해 하나).",
    links: "points[0] — 바꾸고 싶은 것·요즘 마음이 가는 주제를 첫 당부로 받는다. 스스로 느끼는 강점은 실천의 지렛대로, 아쉬운 점은 실천의 눈높이를 맞추는 데만 쓴다.",
    change: "points[].text 뒷 문장과 todo — 바꿔 볼 것 세 가지와 오늘 시작할 하나. 이 장이 풀이 전체의 바꿔 볼 것을 모으는 자리다.",
  },
  tasks: (f) => [
    "points: 이 풀이에서 가져갈 '바꿔 볼 것' 세 가지. 각각 다른 근거 글자에 건다(타고난 글자 하나, 지금 열 해 운 하나, 올해 하나를 권한다). 사용자 사실에 바꾸고 싶은 것이나 요즘 마음이 가는 주제가 있으면 그 주제와 닿는 것을 첫 번째로 둔다(닿는 근거가 없으면 억지로 잇지 않는다).",
    "각 point의 text: 앞 문장은 근거(그림 말 + 그 범주의 첫 문장 꼴), 뒷 문장은 생활 실천(습관·관계·일하는 방식·시기 활용 중 하나, 언제·무엇을이 보이게). '해 볼 만하다'로 맺고 효과를 단정하지 않는다. '약하다·없다'는 [바꿔 볼 것]의 묶음 개수 값이 0인 묶음에만 쓴다.",
    f.chart.gaeun
      ? "이 장은 새 범주를 꺼내지 않는다. points 중 1~3개는 [바꿔 볼 것]의 되짚기 후보(앞 장들에 실린 범주)를 앞 장과 다른 말로 짧게 되짚는다. 후보가 셋보다 적으면 나머지는 앞 장들이 이미 다룬 근거 글자(타고난 결·지금 열 해·올해)를 되짚는 당부로 채우고, 새 채우기·덜기·기운 맞추기를 만들지 않는다."
      : "[신강약·용신]에 용신 줄이 있으면 세 가지 중 하나는 그 기운('보태 쓰면 좋다고 보는 기운')을 생활에서 보태는 실천으로 쓰고, 관점 머리말을 밝힌다. 없으면 오행 치수의 넘침·모자람으로 방향을 잡고 '용신'이라는 말을 쓰지 않는다.",
    "색·방향·숫자·맛으로 기운을 빗대는 옛 방식 참고는 쓰지 않는다(대표 결정 전). 물건·이사·개명으로 잇지 않는다.",
    `review: 일 년 뒤 스스로 가려 볼 말 1~2개. after는 '${f.luck.thisYear.year}년을 보내고', claim은 올해 세운 글자에 건, 맞다·아니다로 답할 수 있는 한 문장(시기·사건을 못 박지 말고 '~쪽에서 움직임이 있었는지 보자'처럼), basis는 근거 글자.`,
    "review에는 금지 주제(사고·병·이별·돈 잃기·합격)를 걸지 않고, 사용자가 말해 준 사실과 [맞히지 않는 해]를 쓰지 않는다.",
    "풀이 맨 끝 마지막 말은 화면이 따로 붙이니 쓰지 않는다. '틀릴 수 있다'는 안내도 따로 붙으니 되풀이하지 않는다.",
  ],
  notHere: "새 판정(앞 장에 없는 새 이야기를 꺼내지 않는다), 마지막 말",
  length: "points 정확히 3개, review 1~2개",
  catchphrases: [{ key: "sail", where: "points 중 한 곳, 운을 쓰는 법을 말할 때" }],
  outputSchema: obj({
    title: TITLE,
    points: arr(obj({ title: str("바꿔 볼 것 제목. 12자 이내. 그림 말로"), text: str("앞 문장은 근거(그림 말), 뒷 문장은 생활 실천. 2문장, 100자 이내. 효과 단정 금지") }), "정확히 3개"),
    review: arr(
      obj({
        after: str("예: '2026년을 보내고'"),
        claim: str("일 년 뒤 맞다·아니다로 가려 볼 한 문장. 50자 이내"),
        basis: str("근거 글자 한자와 한 줄. 30자 이내"),
      }),
      "1~2개",
    ),
    todo: TODO,
    caveat: CAVEAT,
  }),
})

export const BASIC_CHAPTERS = [nature, talent, money, people, daeunNow, yearAhead, crossroads, closing]
