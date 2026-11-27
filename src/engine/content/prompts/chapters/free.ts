// 무료 장 4개 (P4-03) — 생김새 한 장 · 오행 균형 · 올해 한 줄 · 유료 미리보기
// 무료는 첫 방문 이유 + 신뢰 형성 + 미리보기(product-proposal.md §1). 작은 모델(Haiku급)로 짧게 만든다.
// 미리보기는 "목차와 첫 문단"만, 일부러 불길하게 끊어 두려움을 자극하지 않는다(제안서 §1 미리보기 원칙).
import { defineChapter } from "../chapter"
import { BASIC_CHAPTER_IDS } from "../products"
import { ASK, CAVEAT, TITLE, TODO, arr, body, chips, enumStr, obj, str } from "../schema"

const FREE_GUARDS = "결제·가격·할인·'더 알고 싶으면' 같은 권유 문장을 쓰지 않는다(화면 몫). 겁을 주거나 일부러 말을 끊지 않는다."

export const freeNature = defineChapter({
  id: "free-nature",
  title: "생김새 한 장",
  tier: "free",
  maxOutputTokens: 800,
  tokenBasis: "본문 2문단×3문장×50자 ≈ 300자 + 제목·칩·할 일·물음 ≈ 100자 = 약 400자. 한글 1자 ≈ 1토큰(추정)·JSON 칸 이름 15% → 약 460토큰, 잘림 방지 여유 1.7배",
  factParts: ["subject", "dayPillar", "natalTenGods", "userFacts", "warnings", "guards"],
  sectionOptions: { tenGodsOnly: /^day\./ },
  userFactTopics: ["mbti", "concernTopic"],
  tasks: () => [
    "일주 두 글자(위는 일간, 아래는 일지)를 한 장면으로 그린다. 예: '쇠(酉) 위에 앉은 풀(乙)'.",
    "body[0]은 겉(남이 먼저 보는 얼굴), body[1]은 속(혼자 있을 때의 결). 문단마다 근거 글자를 밝힌다.",
    "일지의 십성이 사실표에 있으면 그 이름을 쉬운 말로 풀어 한 번 쓴다. 없으면 십성 이름을 쓰지 않는다.",
    "좋다·나쁘다로 판정하지 않고 생김새로 그린다.",
    FREE_GUARDS,
  ],
  notHere: "오행 개수(오행 균형 장), 올해 이야기(올해 한 줄 장), 재물·연애·직업 판단",
  length: "body 2문단, 문단마다 2~3문장. chips 1~2개",
  catchphrases: [{ key: "lookHere", where: "body[0] 첫머리" }],
  outputSchema: obj({ title: TITLE, chips: chips("1~2"), body: body("정확히 2개: [겉, 속]"), todo: TODO, ask: ASK, caveat: CAVEAT }),
})

export const freeElements = defineChapter({
  id: "free-elements",
  title: "첫 치수 — 오행 균형",
  tier: "free",
  maxOutputTokens: 800,
  tokenBasis: "본문 2문단 ≈ 300자 + 칩 3개·제목·할 일 ≈ 120자 = 약 420자 → 약 480토큰, 여유 1.7배",
  factParts: ["subject", "pillars", "elements", "warnings", "guards"],
  userFactTopics: [],
  tasks: () => [
    "오행 다섯의 개수를 일상말로 잰다: 가장 많은 것과 없거나 가장 적은 것을, 그 오행이 어느 기둥 글자에서 왔는지와 함께 쓴다.",
    "body[0]: 넘치는 쪽이 생활에서 어떤 기울기로 나타나기 쉬운지 한 장면. body[1]: 모자란 쪽이 어떤 빈자리인지와 그 기운을 쓰는 행동 하나.",
    "모자란 오행을 '필요한 기운'이나 '용신'이라고 단정하지 않는다(용신 판정은 규칙 엔진 몫이고 사실표에 없다).",
    "모자란 오행을 색·물건·방위·음식으로 채우라고 하지 않는다. 몸 이야기를 하면 체질의 기울기까지만 쓰고 '오래가면 병원에 가 봐라'를 붙인다.",
    FREE_GUARDS,
  ],
  notHere: "성격 장면(생김새 장), 올해 이야기, 신강약 판정",
  length: "body 2문단, 문단마다 2~3문장. chips 1~3개(오행 근거 글자)",
  catchphrases: [{ key: "measureFirst", where: "body[0] 첫머리" }],
  outputSchema: obj({ title: TITLE, chips: chips("1~3"), body: body("정확히 2개: [넘치는 쪽, 모자란 쪽]"), todo: TODO, caveat: CAVEAT }),
})

export const freeYear = defineChapter({
  id: "free-year",
  title: "올해 한 줄",
  tier: "free",
  maxOutputTokens: 800,
  tokenBasis: "한 줄 25자 + 본문 1문단 150자 + 여는 문·줄일 것·할 일 각 40자 + 제목·칩 ≈ 380자 → 약 440토큰, 여유 1.8배",
  factParts: ["subject", "dayPillar", "natalTenGods", "thisYear", "seunInteractions", "noGuessYears", "userFacts", "warnings", "guards"],
  sectionOptions: { tenGodsHidden: false },
  userFactTopics: ["horizon", "concernTopic"],
  tasks: (f) => [
    `올해 ${f.luck.thisYear.year}년 세운 글자가 원국 어디를 건드리는지는 [올해 세운 글자와 원국의 관계]에 있는 것만 쓴다. 관계가 없으면 올해 글자의 십성(사실표에 있을 때만)으로 말한다.`,
    "line: 올해를 한 줄로(25자 이내, 근거 글자 포함). 공포 낱말·점수 없이.",
    "body: 한 문단. 올해 글자가 무엇을 움직이기 쉬운지와 이 해를 쓰는 법.",
    "open: 올해가 여는 문 한 문장. reduce: 줄일 것 하나 한 문장. 흔들리는 해라도 '하지 마라' 대신 크기를 줄이는 말로.",
    "달마다의 이야기는 하지 않는다(월운은 사실표에 없다).",
    FREE_GUARDS,
  ],
  notHere: "대운 이야기, 내년 이야기, 성격 장면",
  length: "line 25자 이내, body 1문단 2~3문장, open·reduce 한 문장씩. chips 1~2개",
  catchphrases: [{ key: "weather", where: "body 첫머리" }],
  outputSchema: obj({
    title: TITLE,
    chips: chips("1~2"),
    line: str("올해 한 줄. 25자 이내. 근거 글자 포함"),
    body: body("정확히 1개"),
    open: str("올해가 여는 문 한 문장. 40자 이내"),
    reduce: str("올해 줄일 것 하나 한 문장. 40자 이내"),
    todo: TODO,
    caveat: CAVEAT,
  }),
})

/** 미리보기 목차에서 장마다 보여 줄 주제(teaser는 AI가 이 사람 글자로 쓴다) */
export const PREVIEW_TOPICS: Record<(typeof BASIC_CHAPTER_IDS)[number], string> = {
  nature: "타고난 옷감 — 겉과 속, 너를 여는 것",
  talent: "네 손이 잘하는 일 — 재주와 일하는 방식",
  money: "돈 드나드는 문 — 버는 법·머무는 법·새는 곳",
  people: "곁자리와 사람 — 가까운 사람과 지내는 방식",
  "daeun-now": "지금 입은 열 해 — 지금 대운의 세 얼굴",
  "year-ahead": "한 해 옷 고쳐 입기 — 올해 줄일 것과 할 것",
  crossroads: "갈림길 앞에서 — 두 길과 고르는 기준",
  closing: "마무리 — 가져갈 세 가지",
}

export const freePreview = defineChapter({
  id: "free-preview",
  title: "펼치기 전에 — 풀이 미리보기",
  tier: "free",
  maxOutputTokens: 1000,
  tokenBasis: "소개 1문단 150자 + 목차 8줄×40자 = 320자 + 맛보기 1문단 150자 + 칸 이름 ≈ 650자 → 약 750토큰, 여유 1.3배(목차가 정해진 8줄이라 길이 편차가 작다)",
  factParts: ["subject", "pillars", "natalTenGods", "natalInteractions", "elements", "daeunNow", "thisYear", "warnings", "guards"],
  sectionOptions: { tenGodsHidden: false },
  userFactTopics: [],
  tasks: () => [
    "intro: 유료 풀이가 이 사람의 어떤 글자들을 펼쳐 볼지 한 문단으로 소개한다. 결론은 아껴 두되 근거 글자는 밝힌다.",
    `toc: 아래 8장 각각에 한 줄씩, 그 장에서 볼 이 사람의 글자를 짚는다(40자 이내, 근거 글자 포함). 순서와 chapter_id는 그대로: ${BASIC_CHAPTER_IDS.map((id) => `${id}(${PREVIEW_TOPICS[id]})`).join(" / ")}`,
    "body: 첫 장(타고난 옷감)의 첫 문단 맛보기 한 문단. 그 자체로 완결된 문단으로 쓰고, 뒷말이 궁금하게 일부러 끊지 않는다.",
    "'숨겨진 위험', '지금 안 보면 후회', '조심해야 할 해가 있다' 같은 두려움을 자극하는 말을 쓰지 않는다.",
    FREE_GUARDS,
  ],
  notHere: "각 장의 결론(유료 장 몫), 점수·등급",
  length: "intro 1문단, toc 정확히 8줄, body 1문단",
  catchphrases: [{ key: "lookHere", where: "intro 첫머리" }],
  outputSchema: obj({
    title: TITLE,
    intro: str("유료 풀이 소개 한 문단. 2~3문장. 근거 글자 포함"),
    toc: arr(
      obj({
        chapter_id: enumStr(BASIC_CHAPTER_IDS, "장 번호. 지시된 순서 그대로"),
        text: str("그 장에서 볼 이 사람의 글자 한 줄. 40자 이내. 근거 글자 포함, 결론·공포 없이"),
      }),
      "정확히 8개, 지시된 순서대로",
    ),
    body: body("정확히 1개(첫 장 맛보기)"),
    caveat: CAVEAT,
  }),
})

export const FREE_CHAPTERS = [freeNature, freeElements, freeYear, freePreview]
