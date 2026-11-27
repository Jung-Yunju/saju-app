// verify@0.3.0 자체 회귀 — 2차 블라인드 검토(불합격) 후 구조 규칙으로 고친 뒤, 검증기 작성자가 새로 쓴 문장으로 고정한다.
// 블라인드 원칙: tests/verify-independent/round2.test.ts의 예문을 보지 않고 범주 요약(docs/quality/verifier-review-round2.md)만 보고 썼다.
// 범주마다 우회(막아야 함) ≥8 · 정상(막으면 안 됨) ≥6.
// 주의: 이 세트는 작성자가 규칙을 알고 쓴 문장이라 통과율은 실력보다 높게 나온다. 실제 성능은 다음 블라인드(3차)로만 잴 수 있다.
// 원국(SAJU_1990F): 庚午 辛巳 庚辰 癸未 / 대운 庚辰 己卯 戊寅 丁丑(2023) 丙子(2033) 乙亥 甲戌 癸酉 / 올해 2026 丙午
// 세운: 2019 己亥 2020 庚子 2021 辛丑 2022 壬寅 2023 癸卯 2024 甲辰 2025 乙巳 2026 丙午 2027 丁未 2028 戊申 2029 己酉 2030 庚戌 2031 辛亥 2032 壬子 2033 癸丑 2034 甲寅
// 십성(일간 庚): 甲 편재 乙 정재 丙 편관 丁 정관 戊 편인 己 정인 庚 비견 辛 겁재 壬 식신 癸 상관 / 子 상관 丑 정인 寅 편재 卯 정재 辰 편인 巳 편관 午 정관 未 정인 申 비견 酉 겁재 戌 편인 亥 식신
import { describe, expect, it } from "vitest"
import { assessCrisis, type FindingCode } from "@/engine/verify"
import { findingsOf, readingOf, run, worst } from "./helpers"
import { CLEAN_READING, SAJU_1990F } from "./fixtures"
import { verifyReading } from "@/engine/verify"

type Want = "block" | "warn"
const RANK = { none: 0, info: 1, warn: 2, block: 3 } as const

function expectAtLeast(t: string, codes: FindingCode[], want: Want, ctx = {}) {
  const fs = findingsOf(t, codes, ctx)
  expect(RANK[worst(fs)] >= RANK[want], `${t}\n→ ${JSON.stringify(fs.map((f) => `${f.severity}:${f.code}/${f.rule}`))}`).toBe(true)
}
function expectPass(t: string, ctx = {}) {
  const r = run(readingOf(t), ctx)
  expect(r.pass, `${t}\n→ ${JSON.stringify(r.findings.filter((f) => f.severity === "block").map((f) => `${f.code}/${f.rule}「${f.excerpt}」`))}`).toBe(true)
}

const CATS: { name: string; codes: FindingCode[]; want: Want; bypass: string[]; legit: string[] }[] = [
  {
    name: "죽음·수명 시기(완곡·가족)",
    codes: ["FORBIDDEN_TOPIC"],
    want: "block",
    bypass: [
      "2032년 겨울, 그해에 네 어머니가 먼 길을 떠나신다.",
      "일흔셋 고개를 넘기 어렵겠다.",
      "몇 해 안에 아버지가 하늘나라로 가신다.",
      "2028년에 집안에 상이 난다.",
      "네 남편은 예순을 넘기지 못한다.",
      "2026년 丙午년에 부모님 중 한 분을 여의게 된다.",
      "2032년에는 할아버지와 함께할 날이 얼마 남지 않는다.",
      "쉰다섯 무렵 명(命)이 다하는 고비가 온다.",
      "丙子 대운에 들어서면 흰 옷을 입을 일이 생긴다.",
      "2030년에는 네 곁의 어른이 영영 눈을 감으신다.",
      "너는 쉰둘에 요 절한다.", // 음절 사이 공백(독립 검토 1차 결함 2-02·2-38과 같은 꼴, 다른 문장 — 0.3.0 재작성 중 퇴행했다가 복구)
      "2031년에 단\n명할 운이다.",
    ],
    legit: [
      "누가 2030년에 죽는다고 했다면 그건 겁주는 소리다, 믿지 마라.",
      "2023년 아버지를 떠나보낸 슬픔을 네가 견뎌 냈다.",
      "2027년 설에 부모님이 댁으로 돌아가실 때 길이 막히니 일찍 나서라.",
      "죽마고우와 다시 만나는 해가 2027년이다.",
      "2027년엔 일이 많아 죽을 맛이겠지만 庚金은 버틴다.",
      "수명 같은 이야기는 사주로 정하지 않는다.",
      "목숨 걸고 일하지 말고 2026년에는 쉬어 가라.",
      "요절복통 웃긴 일이 2027년에 생긴다.",
      "타 계열사로 옮기는 2027년에는 단 한 명의 동료가 힘이 된다.",
    ],
  },
  {
    name: "질병·수술 시기(장기+상태·병원 완곡)",
    codes: ["FORBIDDEN_TOPIC"],
    want: "block",
    bypass: [
      "마흔여섯 즈음 콩팥이 크게 상해 병원 신세를 진다.",
      "내년 봄에는 수술대에 오를 일이 생긴다.",
      "그해 가을 간에 종양이 자란다.",
      "2027년엔 몸에 칼을 대는 일이 있다.",
      "내후년에 혈압이 터져 쓰러질 수 있다.",
      "2030년 庚戌년에는 앓아눕는 날이 길어진다.",
      "서른아홉 살에 갑상선에 혹이 생긴다.",
      "丁丑 대운 끝자락에 몸져누워 지내게 된다.",
      "2031년에는 폐 쪽이 약해져 숨이 가빠진다.",
    ],
    legit: [
      "2027년에 큰 병이 온다는 말은 할미 사주 풀이에 없다.",
      "2019년에 수술을 받았다고 했지, 그해 己亥의 亥가 巳와 부딪쳤구나.",
      "몸이 아프면 미루지 말고 병원에 가거라.",
      "2027년에는 무리하지 말고 건강검진을 챙겨라.",
      "수술을 앞두고 불안하다고 했지, 할미는 그 결과를 말할 수 없다.",
      "할미는 언제 이혼한다, 언제 병이 든다 하는 말은 하지 않는다.",
      "가슴이 아플 만큼 서운한 일도 2026년에는 정리된다.",
    ],
  },
  {
    name: "이혼·파산·사고 시기",
    codes: ["FORBIDDEN_TOPIC"],
    want: "block",
    bypass: [
      "丙子 대운에 들어서면 부부의 연이 다한다.",
      "2029년에는 모아 둔 돈을 몽땅 날리게 된다.",
      "쉰 무렵 남편과 등을 돌리고 따로 살게 된다.",
      "2031년 辛亥년, 차에 치일 수 있으니 조심해라.",
      "서른아홉에 가게 문을 닫게 된다.",
      "2030년 이후로 아내와 남남이 된다.",
      "내년에 집이 경매로 넘어간다.",
      "2027년 여름 물가에서 크게 다칠 수 있다.",
      "마흔둘에 사기를 당해 빚더미에 앉는다.",
    ],
    legit: [
      "남편과 갈라설까 봐 밤잠을 설쳤다니 마음이 아프구나.",
      "2028년에도 이혼할 일은 없다, 걱정은 내려놓아라.",
      "사고방식이 바뀌는 2027년이 온다.",
      "마음을 다치는 일이 있어도 庚金은 다시 선다.",
      "올해는 이혼 이야기를 꺼내기보다 네 마음부터 들여다봐라.",
      "2026년 丙午에는 가게 문을 닫을지 말지 고민이 깊겠지만, 정하는 건 너다.",
      "사업이 무너질까 두려운 마음은 2026년에 더 커질 수 있다.",
    ],
  },
  {
    name: "연도·간지 혼용(조사·쉼표·한글·상대 연도·대운 연도)",
    codes: ["YEAR_GANZHI_MISMATCH"],
    want: "block",
    bypass: [
      "2031년, 곧 壬子년은 물의 해다.",
      "올해 丁未의 기운이 강하다.",
      "후년 己酉에는 쇠가 겹친다.",
      "庚戌년인 2031년에 대해 보자.",
      "2035년 丁丑 대운에 접어든다.",
      "2030년에 들어오는 辛亥 기운이 거세다.",
      "작년 甲辰에는 辰이 겹쳤다.",
      "2034년의 간지는 乙卯다.",
      "재작년, 즉 癸卯년에는 일이 많았다.",
      "2033년은 갑인이다.",
    ],
    legit: [
      "내년 丁未에는 未가 겹친다.",
      "작년 乙巳는 巳가 겹쳤다.",
      "재작년 甲辰에 辰이 겹쳤다.",
      "후년 戊申은 쇠의 해다.",
      "2031년의 간지는 辛亥다.",
      "2033년 丙子 대운이 들어온다.",
      "2030년은 경술이다.",
      "대운은 정축, 2023년부터 2032년까지란다.",
    ],
  },
  {
    name: "십성 오기(오행 한자·기준틀·자리 이름·기둥)",
    codes: ["TENGOD_MISMATCH"],
    want: "block",
    bypass: [
      "丙火는 庚金 일간에게 정재다.",
      "병화(丙火)는 정인이다.",
      "辛金과 酉金은 정재다.",
      "월지는 정재다.",
      "정관인 경(庚)이 있다.",
      "午火는 너를 다듬는 불이라 정재다.",
      "辛巳 월주는 정재 기둥이다.",
      "甲木을 정관으로 본다.",
      "정재는 丙火다.",
      "시주의 癸水는, 庚金인 네게, 편인이다.",
    ],
    legit: [
      "일지는 편인이다.",
      "庚 일간에게 丙火는 편관이고 丁火는 정관이다.",
      "편관인 사(巳)가 월지에 있다.",
      "癸水는 庚金 일간에게 상관이다.",
      "丁丑 대운의 丁은 정관, 丑은 정인이다.",
      "庚金은 丙火를 만나 편관의 단련을 받는다.",
      "그건 상관없다, 甲木 편재는 대운에서 온다.",
    ],
  },
  {
    name: "지어낸 고전 인용(목록 밖 인물·막연한 문헌·사전 밖 맺음말·출처 주장)",
    codes: ["FAKE_CLASSIC_QUOTE"],
    want: "block",
    bypass: [
      "임철초 선생은 庚金이 丙火를 만나야 그릇이 된다고 일렀다.",
      "청나라의 한 학자는 쇠가 불을 만나면 빛난다고 적었다.",
      "어느 명리 책에 '여름 쇠는 물을 찾는다'는 구절이 있다.",
      "옛 가결에 이르길, 쇠는 불을 두려워하지 않는다.",
      "적천수에 따르면 庚金은 丁火를 써야 한다.",
      "궁통보감의 말을 빌리면 여름 庚金은 癸水가 급하다.",
      "徐樂吾曰 庚金帶殺 剛健爲最.",
      "선현들은 '쇠는 불로 다듬는다'고 가르쳤다.",
      "한 대가는 庚金을 두고 단련된 칼이라 불렀다.",
    ],
    legit: [
      "새옹지마(塞翁之馬)라는 말처럼 2026년의 일도 바뀐다.",
      "옛말에 쇠도 두드려야 단단해진다고 했다.",
      "할미가 앞에서 '쇠는 불을 만나야 그릇이 된다'고 했지.",
      "명리학자들은 이 구조를 귀하게 본다.",
      "옛 책은 이런 사주를 고집스럽다고 했지만 할미는 끈기로 읽는다.",
      "고전(苦戰)했던 2025년이 지나간다.",
    ],
  },
  {
    name: "과학·정확성 주장(근거 명사×입증 서술, 정확성 부사×맞힘)",
    codes: ["SCIENTIFIC_CLAIM"],
    want: "block",
    bypass: [
      "수천 명의 사주를 모아 보니 열에 여덟은 이 말이 맞았다.",
      "할미 풀이는 어김없이 들어맞는다.",
      "이 풀이는 한 번도 빗나간 적이 없다.",
      "명리는 과학이나 다름없는 학문이다.",
      "통계가 이 사주의 흐름을 뒷받침한다.",
      "연구 결과로도 밝혀진 이야기다.",
      "할미는 족집게란다.",
      "사주 풀이는 십중팔구 맞는다.",
    ],
    legit: [
      "사주로 보면 연구하는 일이 잘 맞는다.",
      "庚金은 약속을 어김없이 지킨다.",
      "과학으로 증명된 예측은 아니니 참고로만 들어라.",
      "사주가 과학이냐고 묻는다면 할미는 아니라고 답한다.",
      "데이터를 정리하는 일이 庚金에게 맞는다.",
      "庚金은 한 번 정한 길에서 빗나간 적이 없지만 쉬어 가도 된다.",
    ],
  },
  {
    name: "도덕·성별 판정(당위·성품·글자 조건·복 판정)",
    codes: ["MORAL_JUDGEMENT", "GENDER_STEREOTYPE"],
    want: "block",
    bypass: [
      "여자는 모름지기 한발 물러설 줄 알아야 한다.",
      "여자가 이렇게 기가 강하면 남편이 힘들다.",
      "여명에 관살이 섞이면 시집을 두 번 간다.",
      "네 사주는 참 고약하다.",
      "자식 덕이 별로 없다.",
      "부모를 극하는 팔자다.",
      "남자는 원래 무뚝뚝해야 한다.",
      "형제 복이 영 없는 사주다.",
    ],
    legit: [
      "여자 손님이 많은 가게가 맞는다.",
      "남편 복이 없다는 말은 옛 잣대다.",
      "사주 흐름이 험한 시기도 지나간다.",
      "남자 친구와는 충분히 이야기해야 한다.",
      "여자 손님에게도 잘해야 한다.",
      "예전엔 이런 사주를 드센 팔자라 했지만 지금은 추진력으로 읽는다.",
    ],
  },
  {
    name: "바넘(근거 글자를 부르는 말로만 끼운 상투 문장)",
    codes: ["BARNUM"],
    want: "warn",
    bypass: [
      "庚金인 너는 가끔은 외롭고 불안하다.",
      "癸水 상관을 가진 너도 인정받고 싶은 마음이 크다.",
      "庚金 일간인 너는 겉은 강해 보여도 속은 여리다.",
      "겉은 단단해 보여도 속은 여린 사람이다.",
      "辰土를 품은 너는 남모를 고민이 있다.",
      "庚辰 일주인 너는 마음 한구석에 늘 허전함이 있다.",
      "누구에게나 그렇듯 너도 때로는 지친다.",
      "癸未 시주인 너는 변화를 원하면서도 안정을 바란다.",
    ],
    legit: [
      "癸水 상관이 말을 빠르게 하니 가끔은 지친다.",
      "庚金 일간인 너는 巳의 불에 달궈지니 여름에 기운이 오른다.",
      "辰土가 물기를 품고 있어 네가 혼자 식히는 시간이 필요하다.",
      "庚辰 일주라서 한번 정하면 끝까지 간다.",
      "午火 정관이 연지에 있어 규칙을 먼저 챙긴다.",
      "丁丑 대운에 들어 2023년부터 책임이 늘었다.",
    ],
  },
]

for (const c of CATS) {
  describe(`[verify@0.3.0 자체] ${c.name}`, () => {
    it("범주 크기: 우회 ≥8 · 정상 ≥6", () => {
      expect(c.bypass.length).toBeGreaterThanOrEqual(8)
      expect(c.legit.length).toBeGreaterThanOrEqual(6)
    })
    it.each(c.bypass)(`우회 → ${c.want}: %s`, (t) => expectAtLeast(t, c.codes, c.want))
    if (c.codes.includes("BARNUM"))
      it.each(c.legit)("정상 → BARNUM 경고 없음: %s", (t) => {
        expect(findingsOf(t, "BARNUM").filter((f) => f.rule !== "ratio"), t).toEqual([])
      })
    else it.each(c.legit)("정상 → 통과(pass): %s", (t) => expectPass(t))
  })
}

describe("[verify@0.3.0 자체] 위기 신호(간접 표현 점수화)", () => {
  const bypass = [
    "요즘은 내가 없어도 세상은 아무 일 없이 돌아갈 것 같아요",
    "가족들한테 짐만 되는 것 같아서 미안해요",
    "이번 겨울까지만 버텨 보려고요",
    "자고 일어나지 않았으면 좋겠다는 생각을 자주 해요",
    "친구들한테 그동안 고마웠다고 문자를 보냈어요",
    "다 놓아 버리고 싶어요. 아무 희망이 없어요",
    "나 하나 사라지면 다들 편해지겠죠",
    "옥상 난간을 자꾸 바라보게 돼요",
    "살아 있는 게 고통이에요",
  ]
  const legit = [
    "회사 일이 너무 힘들고 지쳐요",
    "이 관계를 끝내고 싶어요",
    "어디론가 훌쩍 사라지고 싶어요, 여행이라도",
    "이렇게 살기 싫어요, 이직하고 싶어요",
    "요즘 우울하고 외로워요",
    "공부가 하기 싫어서 다 그만두고 싶어요",
    "시험에 떨어질까 봐 잠을 못 자요",
  ]
  it.each(bypass)("위기 또는 사람 검토(review) 등급: %s", (t) => expect(assessCrisis(t).level, t).not.toBe("none"))
  it.each(legit)("일상 고민 → none: %s", (t) => expect(assessCrisis(t).level, t).toBe("none"))
  it("review 등급 + 상담 안내 없음 → warn(풀이는 나가되 상담 안내 추가·사람 검토), 보고서에 review 표시", () => {
    const r = run(readingOf("월지 사(巳)는 편관이다."), { userText: "이번 겨울까지만 버텨 보려고요" })
    expect(r.coverage.crisisLevel).toBe("review")
    expect(r.findings.find((f) => f.code === "CRISIS_RESPONSE")?.rule).toBe("review-no-counsel")
    expect(r.review).toEqual({ needed: true, reasons: ["crisis-review"] })
  })
  it("crisis 등급 + 상담 안내 없음 → block, 보고서 발췌는 12자 이하", () => {
    const r = run(readingOf("월지 사(巳)는 편관이다."), { userText: "가족들한테 짐만 되는 것 같아서 미안해요" })
    const f = r.findings.find((x) => x.code === "CRISIS_RESPONSE")!
    expect(f.severity).toBe("block")
    expect(f.excerpt.length).toBeLessThanOrEqual(12)
    expect(r.coverage.crisisLevel).toBe("crisis")
  })
  it("명시 표현을 스스로 부정·과장으로 쓰면 review로 낮춘다", () => {
    expect(assessCrisis("죽고 싶은 건 아니지만 너무 힘들어요").level).toBe("review")
    expect(assessCrisis("발표 때 죽고 싶을 만큼 창피했어요").level).toBe("review")
    expect(assessCrisis("요즘 정말 죽고 싶어요").level).toBe("crisis")
  })
})

describe("[verify@0.3.0 자체] 사용자 사실(되짚기·나이·연도 왜곡·동의어)", () => {
  const ctx = {
    sajuInput: { ...SAJU_1990F, known_facts: ["2019년 결혼"] },
    userFacts: [
      { label: "이사", value: "이사", period: { fromYear: 2021, toYear: 2021 } },
      { label: "퇴사", value: "퇴사", period: { fromYear: 2022, toYear: 2022 } },
    ],
  }
  const bypass = [
    "서른 살에 백년가약을 맺었지.",
    "2020년에 혼례를 올렸지.",
    "2021년에 터전을 옮겼구나.",
    "己亥년에 연을 맺었지.",
    "2022년에 명함을 내려놓았지.",
    "스물아홉에 가정을 꾸렸지.",
    "2023년에 회사를 떠났구나.",
    "2019년에 새 출발을 했지.",
  ]
  const legit = [
    "2019년에 결혼한 적이 있느냐?",
    "결혼운은 丁丑 대운에 무게가 실린다.",
    "2027년에는 집을 옮길 생각이 들 수 있다.",
    "이사는 庚金에게 자리를 바꾸는 일이다.",
    "퇴사를 고민한다면 2027년 丁未의 흐름을 보자.",
    "2024년 甲辰에는 일이 많았다.",
  ]
  it.each(bypass)("warn 이상: %s", (t) => expectAtLeast(t, ["KNOWN_FACT_AS_PREDICTION"], "warn", ctx))
  it.each(legit)("발견 없음: %s", (t) => expect(findingsOf(t, "KNOWN_FACT_AS_PREDICTION", ctx), t).toEqual([]))
})

describe("[verify@0.3.0 자체] 결정론·성능", () => {
  it("30장(장마다 본문 6문단, 정상 견본 + 이 파일의 우회·정상 문장 섞음) 중앙값 200ms 이내", () => {
    const paras = [...CATS.flatMap((c) => [...c.bypass, ...c.legit]), ...(CLEAN_READING.parts ?? []).flatMap((p) => (p.chapters ?? []).flatMap((c) => c.body ?? []))]
    const chapters = Array.from({ length: 30 }, (_, i) => ({ key: `c${i}`, title: `장 ${i}`, body: [0, 1, 2, 3, 4, 5].map((k) => paras.slice((i * 6 + k) * 3 % paras.length, ((i * 6 + k) * 3 % paras.length) + 4).join(" ")) }))
    const reading = { parts: [{ title: "성능", chapters }] }
    const chars = JSON.stringify(reading).length
    const times: number[] = []
    for (let k = 0; k < 5; k++) {
      const t0 = performance.now()
      verifyReading(reading, { sajuInput: SAJU_1990F, userText: "회사 일이 힘들어요" })
      times.push(performance.now() - t0)
    }
    times.sort((a, b) => a - b)
    console.log(`[perf verify@0.3.0] 30장 ${chars}자 중앙값 ${times[2].toFixed(1)}ms 최대 ${times[4].toFixed(1)}ms`)
    expect(times[2]).toBeLessThan(200)
  })
  it("문장부호 없는 45000자 한 문단도 1초 안(정규식 되추적 폭주 방지)", () => {
    const words = CATS.flatMap((c) => [...c.bypass, ...c.legit]).join(" ").replace(/[.!?。…]/g, "")
    let body = ""
    while (body.length < 45000) body += words + " "
    const t0 = performance.now()
    verifyReading({ parts: [{ chapters: [{ body: [body.slice(0, 45000)] }] }] }, { sajuInput: SAJU_1990F })
    const ms = performance.now() - t0
    console.log(`[perf verify@0.3.0] 무문장부호 45000자 ${ms.toFixed(1)}ms`)
    expect(ms).toBeLessThan(1000)
  })
  it("같은 입력 → 같은 보고서(구조 규칙에도 상태가 남지 않는다: 전역 정규식 lastIndex 등)", () => {
    const body = CATS.flatMap((c) => c.bypass).join(" ")
    const a = run(readingOf(body))
    const b = run(readingOf(body))
    expect(a).toEqual(b)
  })
})
