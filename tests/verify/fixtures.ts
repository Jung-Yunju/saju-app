// P4-04 검증기 테스트 견본 — 실제 저장 형식(SajuInputData·FullReading)과 같은 모양
// SAJU_1990F는 buildSajuInput(1990, 5, 15, 14, "F", "SOLAR", "지연", false, { now: 2026-06-01 })의 실제 출력이다
// (samples.test.ts에서 같은지 확인). 원국 庚午 辛巳 庚辰 癸未 · 일간 庚 · 대운 庚辰→己卯→戊寅→丁丑(2023)→… · 올해 2026 丙午
// 규칙 엔진(rules@0.2.0, 기본 옵션) 겉 글자 십성: 庚 비견, 午 정관, 辛 겁재, 巳 편관, 辰 편인, 癸 상관, 未 정인
// 세운(입춘 기준 간지 연도): 2011 辛卯, 2015 乙未, 2019 己亥, 2020 庚子, 2023 癸卯, 2025 乙巳, 2026 丙午, 2027 丁未, 2028 戊申, 2029 己酉
import type { SajuInputData } from "@/lib/saju-input"
import type { FullReading } from "@/lib/generate-reading-v2"

export const NOW = new Date("2026-06-01T00:00:00Z")

export const SAJU_1990F: SajuInputData = {
  name: "지연",
  gender: "여",
  birth: "1990-05-15 14:00",
  calendar: "양력",
  pillars: { year: "庚午", month: "辛巳", day: "庚辰", hour: "癸未" },
  hour_unknown: false,
  daeun: [
    { start_year: 1993, start_age: 3, ganzhi: "庚辰" },
    { start_year: 2003, start_age: 13, ganzhi: "己卯" },
    { start_year: 2013, start_age: 23, ganzhi: "戊寅" },
    { start_year: 2023, start_age: 33, ganzhi: "丁丑" },
    { start_year: 2033, start_age: 43, ganzhi: "丙子" },
    { start_year: 2043, start_age: 53, ganzhi: "乙亥" },
    { start_year: 2053, start_age: 63, ganzhi: "甲戌" },
    { start_year: 2063, start_age: 73, ganzhi: "癸酉" },
  ],
  gongmang: { day: "申酉", year: "戌亥" },
  this_year: 2026,
  this_year_ganzhi: "丙午",
  known_facts: [],
  voice: "할미",
  warnings: [],
  engine_version: "calendar@0.1.1+rules@0.2.0",
}

const LAST_WORDS = "할미가 그려 준 그림에 너를 가두지 마라. 운은 구름 같아서 빈 몸이라야 멀리 타고 간다."

/** 깨끗한 견본: 모든 근거 글자가 원국·대운·적힌 해에 있고, 십성이 규칙 엔진과 맞고, 금지 표현이 없다 */
export const CLEAN_READING: FullReading = {
  reliability_note: "여섯 가지 가운데 네 가지가 맞았다고 했다. 아니라고 한 시주 癸未 이야기는 줄였다.",
  quote: "쇠(庚)는 불(丙午)을 만나야 그릇이 된다.",
  parts: [
    {
      title: "타고난 나와 마음 모양",
      chapters: [
        {
          key: "nature",
          title: "쇠를 두 번 품은 사람",
          sub: "일간 경(庚)과 연간 경(庚)",
          chips: [{ letter: "庚辰", element: "metal", label: "단단한 쇠 · 끝까지 밀고 간다" }],
          body: [
            "지연아, 너는 일간이 <b>경(庚)</b>이고 연간에도 경(庚)이 하나 더 있다. 같은 쇠가 둘이라 비견이 자리를 지키고, 한번 정한 길을 혼자서도 끝까지 끌고 간다.",
          ],
          todo: "오늘은 혼자 정한 일 하나를 옆 사람에게 말로 꺼내 봐라.",
          ask: "끝까지 버틴 일 가운데 놓아도 됐던 것은 무엇이냐?",
        },
        {
          key: "mind",
          title: "여름 불 속에 선 쇠",
          sub: "월지 사(巳) · 연지 오(午)",
          chips: [{ letter: "巳", element: "fire", label: "한여름 불 · 나를 다듬는 손" }],
          body: [
            "너는 사(巳)월 여름에 태어났고 연지에 오(午)가 있어 불 기운이 쇠를 달군다. 월지 사(巳)는 편관이고 연지 오(午)는 정관이라, 규칙을 먼저 챙기는 사람으로 보인다. 일지 진(辰)이 품은 물기로 스스로 식히는 사람이라, 혼자 있는 시간이 있어야 다시 단단해진다.",
          ],
          todo: "하루 한 번, 휴대전화를 끄고 혼자 걷는 시간을 정해라.",
          ask: "누가 정해 준 규칙과 네가 정한 규칙 중 어느 쪽이 더 무거우냐?",
        },
      ],
    },
    {
      title: "적성과 능력",
      chapters: [
        {
          key: "aptitude",
          title: "말로 쇠를 벼리는 재주",
          sub: "시간 계(癸)",
          chips: [{ letter: "癸未", element: "water", label: "시주의 물 · 말과 글" }],
          body: [
            "시간의 계(癸)는 상관이라 날카로운 말과 글로 재주가 나온다. 다만 태어난 시가 맞는지 묻는 문항에 아니라고 했으니, 癸未에 걸린 이 이야기는 가볍게 들어라.",
          ],
          todo: "이번 주에 하고 싶은 말 하나를 글로 먼저 적어 봐라.",
          ask: "말 때문에 일이 풀린 적과 꼬인 적 중 어느 쪽이 더 많았느냐?",
        },
        {
          key: "strength",
          title: "무리 속에서 커지는 힘",
          sub: "월간 신(辛)",
          chips: [{ letter: "辛巳", element: "metal", label: "월주의 쇠 · 같이 뛰는 사람" }],
          body: [
            "월간 신(辛)은 겁재라 같은 일을 하는 사람들 틈에서 힘이 커진다. 2023년에 들어온 丁丑 대운은 정관이 뿌리를 내리는 때라, 혼자 하던 일을 조직 안에서 이름 걸고 하는 쪽으로 쓰기 좋다.",
          ],
          todo: "같이 일하는 사람 한 명에게 네 몫과 그 사람 몫을 나눠 적어 보여 줘라.",
          ask: "혼자 할 때와 같이 할 때, 어느 쪽에서 더 멀리 갔느냐?",
        },
      ],
    },
    {
      title: "일과 돈, 사랑",
      chapters: [
        {
          key: "money",
          title: "속에 숨은 나무 한 그루",
          sub: "재성은 지장간에",
          chips: [{ letter: "未", element: "earth", label: "시지 속의 乙 · 숨은 재물" }],
          body: [
            "원국 겉에는 재성인 목(木)이 없고, 일지 진(辰)과 시지 미(未) 속에 乙이 숨어 있다. 그래서 돈은 한 번에 크게 오기보다 일한 만큼 쌓이는 꼴이고, 재성이 겉으로 나오는 2025년 乙巳 같은 해에 모으는 습관을 만들어 두면 좋다.",
          ],
          todo: "이번 달 들어온 돈의 열에 하나를 따로 떼어 이름을 붙여 둬라.",
          ask: "돈이 모였던 해에는 무엇을 꾸준히 하고 있었느냐?",
        },
        {
          key: "love",
          title: "짝 자리에 앉은 진토",
          sub: "일지 진(辰)",
          chips: [{ letter: "辰", element: "earth", label: "배우자 자리 · 곁에서 챙기는 사람" }],
          body: [
            "일지 진(辰)은 편인이라, 너는 말보다 곁에서 챙겨 주는 사람에게 마음이 열린다. 올해 丙午는 일간에게 편관으로 들어와 기준이 높은 사람을 만나기 쉬운 해이니, 그 사람에게 배울 것이 있는지를 먼저 봐라.",
          ],
          todo: "고마웠던 사람에게 오늘 짧은 인사 한 줄을 보내라.",
          ask: "너를 챙겨 준 사람과 너를 다그친 사람 중 누구 곁에서 더 컸느냐?",
        },
      ],
    },
    {
      title: "지금과 앞으로",
      chapters: [
        {
          key: "decade",
          title: "정축 대운, 이름을 거는 10년",
          sub: "2023~2032",
          chips: [{ letter: "丁丑", element: "fire", label: "2023~2032 · 정관의 10년" }],
          body: [
            "2023년부터 2032년까지는 丁丑 대운이다. 丁은 정관이고 丑은 정인이라, 책임 있는 자리와 그 자리를 버티게 하는 공부가 같이 온다. 丑은 연지 午와 원진이 되니, 2027년 丁未처럼 未가 겹치는 해에는 집안 어른과의 약속을 미리 적어 두어라.",
          ],
          todo: "올해 맡은 일 가운데 네 이름이 걸린 것 하나를 골라 끝낼 날짜를 정해라.",
          ask: "지난 2023년 이후 새로 맡은 자리는 무엇이었느냐?",
        },
        {
          key: "this-year",
          title: "불이 쇠를 두드리는 해",
          sub: "2026 丙午",
          chips: [{ letter: "丙午", element: "fire", label: "2026 · 편관과 정관이 함께" }],
          body: [
            "올해 2026년 丙午는 丙이 편관, 午가 정관이라 일과 규칙이 한꺼번에 몰려온다. 연지 午와 같은 글자가 다시 오니, 1990년 태어난 해의 기운이 되살아나는 해이기도 하다. 몸 쪽으로는 불 기운이 세져 열이 오르기 쉬우니, 잠을 줄이지 말고 오래가면 병원에 가라.",
          ],
          todo: "잠드는 시각을 정해 일주일만 지켜 봐라.",
          ask: "몸에 열이 오를 때 너는 무엇부터 줄이느냐?",
        },
      ],
    },
  ],
  three_faces: {
    intro: "丁丑 대운의 글자 둘을 세 얼굴로 나눠 적는다.",
    letters: [
      { id: "f1", letter: "丁", name: "정관 丁", what: "丁은 너를 다듬는 불이다.", best: "이름이 걸린 자리를 맡는다.", half: "맡은 일은 늘고 인정은 늦다.", worst: "규칙에 눌려 혼자 삭인다." },
    ],
    how: [{ title: "얼굴 고르기", text: "2023년 이후 丁이 어느 얼굴로 왔는지 먼저 적어 봐라." }],
    rest: "쉬는 해로 정했다면 그것도 丁丑 대운을 쓰는 한 가지 방법이다.",
  },
  daeun_overview: [
    { ganzhi: "丁丑", start_year: 2023, start_age: 33, end_age: 42, name: "이름을 거는 10년", theme: "정관 丁과 정인 丑", best: "책임과 공부가 같이 온다", do_this: "맡은 일 하나를 끝까지 마쳐라" },
  ],
  life_graph: {
    periods: [
      { age_start: 33, age_end: 42, ganzhi: "丁丑", scores: { money: 6, success: 7, health: 6, luck: 5 }, note: "丁丑 대운: 정관과 정인의 10년" },
    ],
    guide: "점수는 대운 글자와 원국의 관계를 전통 이론으로 옮긴 참고값이다.",
    scoring_note: "이 점수는 검증된 예측이 아니다.",
  },
  forks: [
    {
      title: "조직에 이름을 걸까, 내 이름으로 설까",
      sub: "丁丑 대운의 정관을 가진 사람의 갈림길",
      left: { name: "조직 안에서 자리 맡기", gain: "정관 丁이 주는 이름과 울타리", loss: "비견 庚의 혼자 정하는 맛" },
      right: { name: "내 이름으로 서기", gain: "비견 庚이 바라는 제 길", loss: "정관 丁이 주는 울타리" },
      criteria: ["2023년 이후 맡은 일이 네 이름으로 기억되느냐?", "규칙이 있을 때 일이 더 잘 풀렸느냐?", "혼자 정한 일을 끝까지 마친 적이 많으냐?"],
      rule: "셋 중 둘이 '예'면 丁丑 대운 동안은 조직 쪽을 먼저 써 봐라.",
      todo: "두 길의 얻는 것과 잃는 것을 한 장에 적어 봐라.",
      ask: "다섯 해 뒤 네 이름은 어디에 적혀 있으면 좋겠느냐?",
    },
  ],
  years: [
    { year: 2026, ganzhi: "丙午", element: "fire", title: "쇠를 두드리는 불", text: "丙午년은 편관 丙과 정관 午가 함께 와서 맡는 일이 늘어난다. 이 해를 복으로 쓰려면 맡은 일 하나를 끝까지 마쳐 이름을 남겨라." },
  ],
  shaky_years: {
    years: "2027년 丁未와 2029년 己酉 — 丑午 원진과 酉의 공망이 겹치는 해",
    reduce: "큰돈이 드는 약속은 되돌릴 수 있는 크기로 줄여라.",
    keep: "매일 하던 공부와 운동은 그대로 해라.",
  },
  review: [{ id: "r1", after: "2026년을 보내고", claim: "2026년 丙午에 맡는 일이나 직함이 하나 늘었는지 가려 보자.", basis: "丙 편관 · 午 정관" }],
  closing: {
    points: [{ title: "쇠는 불로 그릇이 된다", text: "庚 두 개와 巳午의 불이 만나는 사주라, 달궈지는 해를 피하지 말고 그릇을 만드는 해로 써라." }],
    last_words: LAST_WORDS,
  },
}

/** 문제투성이 견본 — 각 문단 끝 주석의 코드가 나와야 한다 */
export const BAD_READING: FullReading = {
  reliability_note: "이 풀이는 적중률 95%로 과학적으로 입증된 방법이다.", // SCIENTIFIC_CLAIM
  quote: "『적천수』에 「쇠가 불을 만나면 반드시 귀해진다」라 했다.", // FAKE_CLASSIC_QUOTE
  parts: [
    {
      title: "타고난 나와 마음 모양",
      chapters: [
        {
          key: "nature",
          title: "칼날 위의 꽃",
          sub: "乙酉 일주", // BASIS(乙酉 없음)
          chips: [{ letter: "乙酉", element: "metal", label: "칼날 위의 꽃" }], // BASIS
          body: [
            "누구나 겉으로는 강해 보여도 속은 여리다. 때로는 외롭고 불안할 때가 있다.", // BARNUM
            "유(酉)는 정관이라 규칙을 잘 지킨다. 壬水가 너를 도와준다.", // TENGOD(酉=겁재), BASIS(壬)
          ],
          todo: "긍정적으로 생각해라.",
          ask: "요즘 힘드니?",
        },
        {
          key: "mind",
          title: "드센 팔자",
          sub: "",
          chips: [{ letter: "庚辰", element: "metal", label: "" }],
          body: [
            "팔자가 세서 남편 복이 없다. 여자가 기가 세면 집안이 시끄럽다.", // MORAL, GENDER
            "2015년 丙申에 큰일이 있었다.", // YEAR_GANZHI_MISMATCH(2015=乙未)
          ],
          todo: "",
          ask: "",
        },
      ],
    },
    {
      title: "지금과 앞으로",
      chapters: [
        {
          key: "this-year",
          title: "조심할 해",
          sub: "",
          chips: [{ letter: "丙午", element: "fire", label: "" }],
          body: [
            "2030년 무렵 큰 병이 찾아온다. 수명이 길지 않으니 서둘러라.", // FORBIDDEN(serious-illness, death)
            "올해는 코인에 넣어라. 그 사람은 너를 아직 좋아하고 있다.", // FORBIDDEN(investment, others-mind)
            "2019년에 결혼을 했다.", // KNOWN_FACT(known_facts에 "2019년 결혼")
            "<img src=x onerror=alert(1)>를 보라. <b class=\"x\">굵게</b>", // UNSAFE_HTML
          ],
          todo: "부적을 지니고 다녀라.", // FORBIDDEN(talisman, warn)
          ask: "",
        },
      ],
    },
  ],
  three_faces: { intro: "", letters: [], how: [], rest: "" },
  daeun_overview: [{ ganzhi: "壬午", start_year: 2023, start_age: 33, end_age: 42, name: "", theme: "", best: "", do_this: "" }], // BASIS(대운 아님)
  life_graph: { periods: [], guide: "", scoring_note: "" },
  forks: [],
  years: [{ year: 2027, ganzhi: "戊申", element: "earth", title: "", text: "" }], // YEAR_GANZHI_MISMATCH(2027=丁未)
  shaky_years: { years: "", reduce: "", keep: "" },
  review: [],
  closing: { points: [], last_words: "" },
}
