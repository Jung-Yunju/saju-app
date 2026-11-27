// 유료 기본 풀이 8장 (P4-03) — 본질·성향 / 재능·직업 / 돈의 흐름 / 사람·인연 / 지금 대운 / 올해와 내년 / 갈림길 / 마무리
// 기본 풀이(BASIC)와 주제·총괄 상품이 같이 쓴다. 장마다 "다른 장 몫"을 밝혀 같은 말이 장마다 되풀이되지 않게 한다.
import { defineChapter } from "../chapter"
import { currentDaeun, nextYearOf } from "../facts"
import { ASK, CAVEAT, SUB, THREE_FACES, TITLE, TODO, arr, body, chips, int, obj, str } from "../schema"

const LIFE_STAGE_RULE =
  "같은 십성도 나이에 따라 다르게 나타난다. [읽는 사람]의 만 나이·인생 단계에 맞는 장면만 쓴다(학령기 식상·인성은 공부머리, 사회 진입기 재성은 월급·주거, 은퇴 뒤 관성은 역할의 변화처럼). 장면은 여지를 두고 쓴다."

export const nature = defineChapter({
  id: "nature",
  title: "타고난 옷감 — 본질·성향",
  tier: "paid",
  maxOutputTokens: 1800,
  tokenBasis: "본문 4문단×3.5문장×50자 ≈ 700자 + 제목·부제·칩 4개·할 일·물음·불확실성 ≈ 220자 = 약 920자 → 약 1,060토큰. 풀이의 첫인상이라 문단 수가 가장 많아 여유 1.7배",
  factParts: ["subject", "pillars", "natalTenGods", "natalInteractions", "gongmang", "elements", "strength", "userFacts", "warnings", "guards"],
  userFactTopics: ["mbti", "birthOrder", "concernTopic"],
  tasks: () => [
    "일주와 월지(태어난 계절), 오행의 넘침과 모자람에서 이 사람만의 장면 하나를 고른다. 그 장면으로 네 문단을 잇는다.",
    "body[0] 겉: 남이 먼저 보는 얼굴. body[1] 속: 혼자 있을 때의 결. body[2] 이 사람을 여는 것: 무엇이 이 사람을 풀리게 하고 움직이게 하는지.",
    "body[3] 굳는 데와 쓰는 법: 어디서 왜 굳는지를 근거 글자로 쓰고, 그 굳은 데를 쓰는 자리를 바로 준다. 말씨 세기가 허락하면 여기서 한 번 짚는다. 이 문단 끝에 말버릇 '글자는 생김새다. 쓰는 건 너다.'를 둔다.",
    "원국 관계(합·충 등)가 성격에 걸리면 한 번 쓴다. 충은 다 깨지는 것이 아니고, 합은 붙기도 하고 묶이기도 한다.",
    "공망은 원국에 걸린 곳이 있을 때만, '어떤 사람한텐 아무 일도 안 한다'는 여지와 함께 쓴다.",
    "형제 순서·MBTI 같은 사용자 사실은 비유와 장면을 고를 때만 쓰고, 성격의 근거로 쓰지 않는다.",
  ],
  notHere: "재주·직업(재능 장), 돈 쓰는 버릇(돈 장), 가까운 사람과의 관계(사람 장), 대운·올해(운 장)",
  length: "body 정확히 4문단, 문단마다 2~4문장. chips 2~4개",
  catchphrases: [
    { key: "lookHere", where: "body[0] 첫머리" },
    { key: "shapeNotFate", where: "body[3] 끝" },
  ],
  outputSchema: obj({ title: TITLE, sub: SUB, chips: chips("2~4"), body: body("정확히 4개: [겉, 속, 여는 것, 굳는 데와 쓰는 법]"), todo: TODO, ask: ASK, caveat: CAVEAT }),
})

export const talent = defineChapter({
  id: "talent",
  title: "네 손이 잘하는 일 — 재능·직업",
  tier: "paid",
  maxOutputTokens: 1500,
  tokenBasis: "본문 3문단 ≈ 450자 + 자리 3개×80자 = 240자 + 공통 칸 ≈ 180자 = 약 870자 → 약 1,000토큰, 여유 1.5배",
  factParts: ["subject", "pillars", "natalTenGods", "natalInteractions", "elements", "strength", "userFacts", "warnings", "guards"],
  userFactTopics: ["occupationStatus", "careerFeeling", "concernTopic"],
  tasks: () => [
    "사실표 십성을 다섯 묶음으로 본다: 식신·상관=드러내고 만드는 재주, 편재·정재=다루고 굴리는 재주, 편관·정관=맡고 책임지는 재주, 편인·정인=배우고 채우는 재주, 비견·겁재=제 힘으로 밀고 가는 재주. 사실표에 있는 묶음만, 몇 개가 어느 자리에 있는지를 근거로 쓴다.",
    "body[0] 가장 큰 재주. body[1] 모자란 묶음을 메우는 법(없는 묶음은 '없어서 못 한다'가 아니라 남의 손을 빌리거나 연장을 갖추는 법으로). body[2] 일하는 방식(혼자/함께, 빠르게/깊게 등 근거 글자에서 나온 것).",
    "fits: 값이 오르는 자리 2~3개. place는 직업 이름 단정이 아니라 일의 모양(예: '남의 글을 고치는 자리'), text는 근거 글자와 이유 한두 문장.",
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
    body: body("정확히 3개: [가장 큰 재주, 모자란 쪽 메우기, 일하는 방식]"),
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
  factParts: ["subject", "pillars", "natalTenGods", "natalInteractions", "elements", "userFacts", "warnings", "guards"],
  userFactTopics: ["occupationStatus", "moneyFocus", "hasChildren"],
  tasks: () => [
    "재성(편재·정재)이 사실표에 어디 몇 개 있는지 그대로 쓴다. 없으면 없다고 쓰되 '돈이 없는 사주'로 판정하지 않는다. 재성을 다루는 힘(식상=돈을 만드는 손, 비겁=나누고 겨루는 손)과의 관계는 사실표에 있는 글자로만 본다.",
    "body[0] 돈이 드는 문, body[1] 돈이 머무는 법, body[2] 새는 구멍과 막는 법.",
    "habits: earn·keep·leak 한 문장씩, 각각 근거 글자 포함.",
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
    body: body("정확히 3개: [드는 문, 머무는 법, 새는 구멍]"),
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
  factParts: ["subject", "pillars", "natalTenGods", "natalInteractions", "gongmang", "userFacts", "warnings", "guards"],
  userFactTopics: ["relationshipStatus", "birthOrder", "hasChildren", "concernTopic"],
  tasks: () => [
    "일지(곁자리)의 글자와 십성으로 가까운 사람과 지내는 방식을 쓴다. 일지에 걸린 합·충이 사실표에 있으면: 합은 잘 붙고 묶이기도 한다, 충은 거리가 움직이기 쉽다(깨진다는 뜻이 아니다).",
    "비겁은 동료·친구·형제와 몫을 나누는 방식, 관성·인성은 윗사람·돌봐 주는 사람과의 거리로 쓴다. '부모 덕이 없다' 같은 가족 판정은 쓰지 않는다.",
    "body는 3~4문단: [가장 가까운 자리, 친구·동료, 윗사람·돌봐 주는 사람, (있으면) 사람 사이에서 쓰는 법].",
    "연애·혼인 상태 사용자 사실이 있으면 장면 고를 때만 쓴다. 말하지 않았으면 짝이나 결혼을 전제하지 않는다. 곁 사람은 성별 없이 '곁 사람', '짝'으로 쓴다.",
    "다른 사람의 속마음을 짐작해 단정하지 않는다.",
  ],
  notHere: "연애 깊이 보기(연애 상품 장), 올해의 인연(올해 장), 성격 장면(본질 장)",
  length: "body 3~4문단, 문단마다 2~4문장. chips 2~3개",
  outputSchema: obj({ title: TITLE, sub: SUB, chips: chips("2~3"), body: body("3~4개"), todo: TODO, ask: ASK, caveat: CAVEAT }),
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
  factParts: ["subject", "pillars", "natalTenGods", "daeunNow", "daeunInteractions", "userFacts", "noGuessYears", "warnings", "guards"],
  sectionOptions: { tenGodsHidden: false },
  userFactTopics: ["horizon", "occupationStatus", "careerFeeling", "relationshipStatus", "life_event:"],
  tasks: (f) => [
    currentDaeun(f)
      ? "body[0]: 지금 대운 간지와 두 글자의 십성(사실표에 있을 때만), 몇 살부터 몇 살까지인지, 이 사람 나이에 어떤 열 해인지."
      : "지금은 첫 대운 전이다. body[0]: 이 시기는 원국(특히 월주)을 중심으로 읽는다는 것과 첫 대운이 언제 오는지(사실표 그대로). 이 시기를 따로 소운으로 보는 방법도 있으니 '월주가 이끈다'고 못 박지 않는다.",
    "body[1]: 대운 글자가 원국과 맺는 관계는 [대운 글자와 원국의 관계]에 있는 것만 쓴다. 없으면 대운 글자의 오행·십성이 원국의 넘침·모자람을 어떻게 건드리는지로 쓴다.",
    "faces: 이 대운이 올 수 있는 얼굴 세 가지. 장면으로 쓴다.",
    "next: 다음 대운이 사실표에 있으면 간지·시작 나이·시작 해를 그대로 옮기고, 갈아입는 해에 할 일을 쓴다(예: 첫 반년은 새 옷에 몸을 맞춘다). 없으면 칸을 비운다.",
    "사용자가 말해 준 지나온 큰 일은 배경으로만 쓰고, [맞히지 않는 해]는 맞히지 않는다.",
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
  factParts: ["subject", "pillars", "natalTenGods", "daeunNow", "thisYear", "nextYear", "seunInteractions", "userFacts", "noGuessYears", "warnings", "guards"],
  sectionOptions: { tenGodsHidden: false },
  userFactTopics: ["horizon", "occupationStatus", "relationshipStatus", "careerFeeling", "life_event:"],
  tasks: (f) => {
    const ny = nextYearOf(f)
    return [
      "body: 한 문단. 지금 대운 안에서 올해가 어떤 해인지 큰 그림.",
      `years[0]: 올해 ${f.luck.thisYear.year}년. year·ganzhi는 사실표 그대로(${f.luck.thisYear.ganzhi}). 올해 글자가 원국을 건드리는 관계는 [올해 세운 글자와 원국의 관계]에 있는 것만 쓴다.`,
      ny
        ? `years[1]: 내년 ${ny.year}년(${ny.ganzhi}). 사실표 그대로. 내년 글자와 원국의 관계는 사실표에 없으니 십성(있을 때만)과 오행으로만 말한다.`
        : "내년 간지는 사실표에 없다. years에는 올해 하나만 넣고, 내년은 body 끝에 올해 할 일이 어떻게 이어지는지로만 한 문장 쓴다. 내년 간지를 셈해서 쓰지 않는다.",
      "각 해: title(8자 안팎 이름), text(무엇이 움직이기 쉬운지 + 이 해를 쓰는 법, 2문장), reduce(줄일 것), keep(그래도 할 것).",
      "흔들리는 해면 '흔들리는 해'라고 쓰고 말버릇 '되돌릴 수 있는 크기로 해라.'를 한 번 쓴다. 시험·승진·결혼·이사 시기를 단정하지 않는다.",
      "달마다의 이야기는 하지 않는다(월운은 사실표에 없다).",
    ]
  },
  notHere: "대운 세 얼굴(지금 대운 장), 갈림길(갈림길 장)",
  length: "body 1문단, years 1~2개(내년이 사실표에 있을 때만 2개). chips 2~3개",
  catchphrases: [
    { key: "weather", where: "body 첫머리" },
    { key: "reversible", where: "흔들리는 해의 reduce 또는 text" },
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
  userFactTopics: ["concernTopic", "careerFeeling", "loveFocus", "moneyFocus", "occupationStatus", "relationshipStatus", "horizon"],
  tasks: () => [
    "이 사람의 글자에서 나오는 갈림길 세 가지를 쓴다. 세 갈림길은 서로 다른 근거 글자에 건다.",
    "사용자 사실에 요즘 마음이 가는 주제가 있으면 그 주제의 갈림길을 하나 이상 넣는다. 없으면 원국의 가장 큰 힘, 지금 대운, 올해에서 하나씩 고른다.",
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
  factParts: ["subject", "pillars", "natalTenGods", "daeunNow", "thisYear", "userFacts", "noGuessYears", "warnings", "guards"],
  sectionOptions: { tenGodsHidden: false },
  userFactTopics: ["concernTopic", "horizon"],
  tasks: (f) => [
    "points: 이 풀이에서 가져갈 세 가지. 각각 다른 근거 글자에 건다(원국 하나, 지금 대운 하나, 올해 하나를 권한다). 요즘 마음이 가는 주제가 사용자 사실에 있으면 첫 번째로 둔다.",
    `review: 일 년 뒤 스스로 가려 볼 말 1~2개. after는 '${f.luck.thisYear.year}년을 보내고', claim은 올해 세운 글자에 건, 맞다·아니다로 답할 수 있는 한 문장(시기·사건을 못 박지 말고 '~쪽에서 움직임이 있었는지 보자'처럼), basis는 근거 글자.`,
    "review에는 금지 주제(사고·병·이별·돈 잃기·합격)를 걸지 않고, 사용자가 말해 준 사실과 [맞히지 않는 해]를 쓰지 않는다.",
    "풀이 맨 끝 마지막 말은 화면이 따로 붙이니 쓰지 않는다. '틀릴 수 있다'는 안내도 따로 붙으니 되풀이하지 않는다.",
  ],
  notHere: "새 판정(앞 장에 없는 새 이야기를 꺼내지 않는다), 마지막 말",
  length: "points 정확히 3개, review 1~2개",
  catchphrases: [{ key: "sail", where: "points 중 한 곳, 운을 쓰는 법을 말할 때" }],
  outputSchema: obj({
    title: TITLE,
    points: arr(obj({ title: str("당부 제목. 12자 이내"), text: str("근거 글자와 쓰는 법. 2문장, 100자 이내") }), "정확히 3개"),
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
