// P4-05 채점 도구 시험용 가짜 견본 — 모든 사주는 가상의 예시 입력(실제 고객 아님). AI 호출 없음.
// 좋은 글(근거 글자·이 사람만의 장면·쓰는 법) 2편 vs 바넘투성이(누구에게나 맞는 말·같은 문장 돌려쓰기·말버릇 남발) 2편.
// 좋은 글의 십성·관계는 실제 사실표(buildFactSheet)에 있는 것만 썼다(아래 각 인물 주석).
import { analyzeRules, computeChart } from "@/engine"
import type { BirthInput } from "@/engine"
import { buildPersonalContext } from "@/engine/personalize"
import { buildFactSheet } from "@/engine/content/facts"
import type { ChapterResult, FactSheet } from "@/engine/content/types"

const AS_OF = new Date("2026-11-27T03:00:00Z")

export function factsFor(birth: BirthInput): FactSheet {
  const chart = computeChart(birth)
  const rules = analyzeRules(chart, undefined, { luck: chart.luck.daeun.map((d) => d.pillar), year: { stem: "丙", branch: "午" } })
  const personal = buildPersonalContext(
    chart,
    [
      { questionId: "lifeEvents", values: ["job_change"], years: { job_change: 2019 } },
      { questionId: "concernTopic", values: ["money"] },
    ],
    AS_OF,
    rules,
  )
  return buildFactSheet({ chart, rules, personal, asOf: AS_OF, addressAs: "손주" })
}

/** 인물 1: 庚午 辛巳 庚辰 壬午 · 남 · 2026 丙午 · 지금 대운 甲申(2017~) — 일지 辰=편인, 시간 壬=식신, 월간 辛=겁재, 丙=편관, 辛丙 천간합(월간+세운), 午午 형 */
export const BIRTH_1: BirthInput = { calendar: "solar", year: 1990, month: 5, day: 15, time: { hour: 12, minute: 0 }, gender: "M" }
/** 인물 2: 乙丑 丙戌 丙午 壬辰 · 여 · 2026 丙午 · 지금 대운 辛卯(2026~) — 일지 午=겁재, 시간 壬=편관, 월지 戌=식신, 연간 乙=정인, 戌辰 충, 戌午 반합 */
export const BIRTH_2: BirthInput = { calendar: "solar", year: 1985, month: 11, day: 3, time: { hour: 8, minute: 30 }, gender: "F" }

const ch = (id: string, output: Record<string, unknown>): ChapterResult => ({ id, ok: true, output, attempts: 1 })

// ─────────────────────────────── 좋은 글

export function goodChapters1(): ChapterResult[] {
  return [
    ch("nature", {
      title: "쇠 위에 쇠, 경진(庚辰)일",
      sub: "일간 경(庚)과 일지 진(辰)으로 그린 장",
      chips: [
        { letter: "庚", pos: "day.stem", label: "일간 경(庚) · 단단한 쇠" },
        { letter: "辰", pos: "day.branch", label: "일지 진(辰) · 편인" },
      ],
      body: [
        "어디 보자. 경진(庚辰)일에 났구나. 경(庚)은 다듬기 전의 쇳덩이라, 겉으로 남이 먼저 보는 얼굴은 말수 적고 단단한 쪽이다.",
        "일지 진(辰)이 경(庚) 일간한테는 편인이다. 혼자 있을 때는 남이 안 보는 책이나 손기술을 파고드는 결이 있다.",
        "시간 임(壬)은 너한테 식신이라, 손으로 무언가를 만들어 내놓을 때 굳은 몸이 풀린다. 연지와 시지에 오(午)가 둘이라 불이 쇠를 달구는 자리도 두 군데다.",
        "월간 신(辛)이 겁재라 같이 일하는 사람과 몫을 다투다 굳기 쉽다. 그 날은 네 몫을 먼저 종이에 적어 두는 데 써라. 글자는 생김새다. 쓰는 건 너다.",
      ],
      todo: "임(壬) 식신을 살려 이번 주에 만든 것 하나를 남에게 보여라",
      ask: "진(辰) 편인이 파고들던 게 지금도 남아 있느냐?",
      caveat: "",
    }),
    ch("money", {
      title: "진(辰) 속 을(乙) 한 줄기",
      sub: "재성이 지장간에만 있는 경(庚) 일간",
      chips: [{ letter: "乙", pos: "day.branch.yeogi", label: "진(辰) 속 을(乙) · 정재" }],
      body: [
        "네 겉 글자에는 재성이 없고, 일지 진(辰) 속에 을(乙) 정재가 한 줄기 숨어 있다. 돈이 눈에 띄게 들어오기보다 곁자리에서 천천히 모이는 모양이다.",
        "시간 임(壬) 식신이 돈을 만드는 손이다. 네가 만든 것을 값 매겨 내놓는 데서 진(辰) 속 을(乙)이 깨어난다.",
        "월간 신(辛) 겁재가 새는 구멍이다. 같이 하자는 돈 이야기에는 네 몫과 남의 몫을 먼저 갈라 놔라.",
      ],
      habits: { earn: "임(壬) 식신으로 만든 것을 값 매겨 판다", keep: "진(辰) 속 을(乙)처럼 곁에 따로 모아 둔다", leak: "신(辛) 겁재 탓에 함께 쓰는 돈에서 샌다" },
      todo: "신(辛) 겁재를 막게 공동 지출을 따로 적어 둬라",
      ask: "을(乙) 정재처럼 조용히 모은 돈이 어디 있느냐?",
      caveat: "",
    }),
    ch("year-ahead", {
      title: "병오(丙午)년, 쇠를 달구는 해",
      sub: "올해 병(丙)·오(午)가 경(庚) 일간에 오는 모양",
      chips: [{ letter: "丙午", pos: "seun.stem+seun.branch", label: "올해 병오(丙午) · 관성" }],
      body: [
        "날씨 얘기다. 우산은 네가 챙겨. 지금 갑신(甲申) 대운 안에서 2026년 병오(丙午)년은 경(庚) 일간한테 불이 겹으로 오는 해다.",
      ],
      years: [
        {
          year: 2026,
          ganzhi: "丙午",
          title: "달구는 해",
          text: "올해 병(丙)은 편관, 오(午)는 정관이라 맡는 일이 늘기 쉽다. 올해 병(丙)이 월간 신(辛)과 합해 겁재의 다툼이 잦아드는 쪽으로 쓸 수 있다.",
          reduce: "오(午)가 원국 오(午)와 형으로 겹치니 약속은 되돌릴 수 있는 크기로 해라.",
          keep: "병(丙) 편관이 주는 책임 하나는 끝까지 맡아 본다.",
        },
      ],
      todo: "병오(丙午)년 맡은 일 목록을 세 개로 줄여 적어라",
      ask: "올해 병(丙)이 맡긴 일 중 네가 고른 건 무엇이냐?",
      caveat: "",
    }),
  ]
}

export function goodChapters2(): ChapterResult[] {
  return [
    ch("nature", {
      title: "불 위의 불, 병오(丙午)일",
      sub: "일간 병(丙)과 일지 오(午)로 그린 장",
      chips: [
        { letter: "丙", pos: "day.stem", label: "일간 병(丙) · 한낮의 해" },
        { letter: "午", pos: "day.branch", label: "일지 오(午) · 겁재" },
      ],
      body: [
        "어디 보자. 병오(丙午)일에 났구나. 한낮의 해 병(丙)이 불 자리 오(午) 위에 앉아, 남이 먼저 보는 얼굴은 환하고 먼저 말을 건다.",
        "일지 오(午)가 병(丙) 일간한테는 겁재다. 혼자 있을 때는 남보다 앞서고 싶은 마음이 은근히 달아오른다.",
        "월지 술(戌)이 식신이라 손에 익은 일을 차근차근 쌓을 때 풀린다. 술(戌)과 오(午)가 반합으로 묶여 그 불이 오래 탄다.",
        "시간 임(壬)이 편관이라 위에서 누르면 바로 맞서기 쉽다. 그 날은 맞서기 전에 하루 묵히는 데 써라. 글자는 생김새다. 쓰는 건 너다.",
      ],
      todo: "임(壬) 편관이 누를 때는 답을 하루 묵혀 보내라",
      ask: "술(戌) 식신이 쌓아 온 손기술이 무엇이냐?",
      caveat: "",
    }),
    ch("money", {
      title: "술(戌)이 쌓고 오(午)가 쓴다",
      sub: "식신 술(戌)과 겁재 오(午)의 돈 버릇",
      chips: [{ letter: "戌", pos: "month.branch", label: "월지 술(戌) · 식신" }],
      body: [
        "월지 술(戌) 속 신(辛)이 병(丙) 일간한테 정재다. 돈은 손에 익은 일을 쌓는 술(戌) 식신 쪽에서 들어온다.",
        "연간 을(乙)이 정인이라 배운 것을 증명할 서류가 돈을 붙잡아 둔다. 자격이나 기록을 남겨 두는 쪽이 오래 간다.",
        "일지 오(午) 겁재가 새는 구멍이다. 남보다 앞서려고 쓰는 돈은 달마다 상한을 정해 둬라.",
      ],
      habits: { earn: "술(戌) 식신으로 쌓은 손기술에서 번다", keep: "을(乙) 정인처럼 기록으로 붙잡아 둔다", leak: "오(午) 겁재 탓에 앞서려는 지출로 샌다" },
      todo: "오(午) 겁재 지출에 이번 달 상한을 하나 정해라",
      ask: "술(戌) 식신으로 번 돈은 어디로 가느냐?",
      caveat: "",
    }),
    ch("year-ahead", {
      title: "병오(丙午)년, 불이 하나 더",
      sub: "올해 병(丙)·오(午)가 병(丙) 일간에 오는 모양",
      chips: [{ letter: "丙午", pos: "seun.stem+seun.branch", label: "올해 병오(丙午) · 비겁" }],
      body: [
        "날씨 얘기다. 우산은 네가 챙겨. 2026년 신묘(辛卯) 대운이 막 시작했고, 병오(丙午)년은 병(丙) 일간한테 같은 불이 하나 더 붙는 해다.",
      ],
      years: [
        {
          year: 2026,
          ganzhi: "丙午",
          title: "불이 붙는 해",
          text: "올해 병(丙)은 비견, 오(午)는 겁재라 같이 뛰는 사람이 늘기 쉽다. 올해 오(午)가 월지 술(戌)과 반합해 식신의 손이 바빠지는 쪽으로 쓸 수 있다.",
          reduce: "오(午)가 일지 오(午)와 형으로 겹치니 동업은 되돌릴 수 있는 크기로 해라.",
          keep: "술(戌) 식신으로 쌓는 일 하나는 매주 이어 간다.",
        },
      ],
      todo: "병오(丙午)년 함께 할 사람과 몫을 종이로 갈라 둬라",
      ask: "올해 오(午) 겁재로 곁에 온 사람이 누구냐?",
      caveat: "",
    }),
  ]
}

// ─────────────────────────────── 바넘투성이

const BARNUM_BODY = [
  "어디 보자. 너는 겉으로는 밝지만 속으로는 외로움을 많이 타는 사람이다. 정말 남들이 모르는 고민을 혼자 안고 있다. 인정받고 싶은 마음이 크거든.",
  "누구에게나 친절하지만 스스로에게 엄격한 편이거든. 때로는 불안하고 흔들릴 때도 있거든. 그래도 노력하면 좋은 결과가 온다.",
  "마음을 편히 먹고 긍정적으로 생각해라. 큰 잠재력이 숨어 있으니 때를 기다려라. 글자는 생김새다. 쓰는 건 너다.",
  "주변 사람을 소중히 여기고 무리하지 마라. 규칙적인 생활을 하면 좋은 일이 생길 것이다. 글자는 생김새다. 쓰는 건 너다.",
]

function barnumChapters(): ChapterResult[] {
  const common = { chips: [], todo: "주변 사람을 소중히 여기고 마음을 편히 먹어라", ask: "요즘 마음이 편하냐?", caveat: "" }
  return [
    ch("nature", { title: "타고난 성품", sub: "너의 성격", ...common, body: BARNUM_BODY }),
    ch("money", {
      title: "돈의 흐름",
      sub: "재물 이야기",
      ...common,
      body: [
        "돈은 노력하면 꾸준히 들어온다. 정말 너무나 아끼는 것이 중요하다. 글자는 생김새다. 쓰는 건 너다.",
        "때로는 돈 때문에 불안하고 흔들릴 때도 있다. 마음을 편히 먹고 긍정적으로 생각해라.",
        "주변 사람을 소중히 여기면 기회가 온다. 큰 잠재력이 숨어 있으니 때를 기다려라.",
      ],
      habits: { earn: "노력하면 꾸준히 들어온다", keep: "아끼고 또 아낀다", leak: "충동구매를 조심한다" },
    }),
    ch("year-ahead", {
      title: "올해의 운",
      sub: "한 해 이야기",
      ...common,
      body: ["올해는 노력하면 좋은 결과가 온다. 마음을 편히 먹고 긍정적으로 생각해라. 글자는 생김새다. 쓰는 건 너다."],
      years: [{ year: 2026, ganzhi: "丙午", title: "좋은 해", text: "노력하면 좋은 일이 생길 것이다. 주변 사람을 소중히 여겨라.", reduce: "무리하지 마라.", keep: "규칙적인 생활을 한다." }],
    }),
  ]
}

export function sampleJson(persona: string, facts: FactSheet, chapters: ChapterResult[]) {
  return { persona, facts, chapters }
}

export function fixtureSet() {
  const f1 = factsFor(BIRTH_1)
  const f2 = factsFor(BIRTH_2)
  return {
    good: [sampleJson("good-1", f1, goodChapters1()), sampleJson("good-2", f2, goodChapters2())],
    barnum: [sampleJson("barnum-1", f1, barnumChapters()), sampleJson("barnum-2", f2, barnumChapters())],
  }
}
