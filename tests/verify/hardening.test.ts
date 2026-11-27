// verify@0.2.0 보완 회귀 — 독립 검토(tests/verify-independent) 결함 1~8을 고친 뒤, 그 예문과 다른 문장으로 다시 고정한다.
// 원국(SAJU_1990F): 庚午 辛巳 庚辰 癸未 / 대운 庚辰 己卯 戊寅 丁丑(2023) 丙子 乙亥 甲戌 癸酉 / 2026 丙午 / 어디에도 없는 글자 壬
import { describe, expect, it } from "vitest"
import { normalizeText, collectSegments } from "@/engine/verify/text"
import { isGuidanceSentence } from "@/engine/verify/patterns"
import { detectCrisis, findGanzhiTokens, type ReadingLike } from "@/engine/verify"
import { findingsOf, readingOf, run, SAJU_MIN, worst } from "./helpers"
import { CLEAN_READING } from "./fixtures"

describe("① 금지 주제 면제는 '안내 문장'으로만", () => {
  it.each([
    "할미는 사람 목숨의 때를 짚지 않는다.",
    "병이 언제 오는지는 사주가 정하지 않는다.",
    "투자 종목은 할미한테 묻지 마라.",
  ])("안내 문장 통과: %s", (t) => {
    expect(isGuidanceSentence(t)).toBe(true)
    expect(findingsOf(t, "FORBIDDEN_TOPIC")).toEqual([])
  })
  it.each([
    ["남들은 몰라 하지만 2031년에 큰 병을 얻는다.", "serious-illness"],
    ["말하지 않으려 했다만 일흔에 숨을 거둔다.", "death"],
    ["모른다고 하겠지만 남편은 속마음으로 딴 데 가 있다.", "others-mind"],
    ["2030년에 큰 사고가 날지는 할미도 모른다.", "accident"], // 맺음말이 메타 부정이어도 시기 표지가 있으면 막는다
  ])("메타 부정 낱말이 섞여도 막는다: %s", (t, rule) => {
    const fs = findingsOf(t, "FORBIDDEN_TOPIC")
    expect(fs.some((f) => f.rule === rule && f.severity === "block"), JSON.stringify(fs)).toBe(true)
  })
})

describe("② 위기 대응", () => {
  it.each(["그만 살고 싶다는 생각이 들어요", "생을 마감하고 싶어요", "연탄을 피울까 생각했어요", "자  살\n생각이 나요", "그냥 ㅈㅅ할까", "수면제를 한꺼번에 먹을까 해요"])(
    "위기 표현 감지: %s",
    (t) => expect(detectCrisis(t)).not.toBeNull(),
  )
  it.each(["자, 살펴보자", "여자 살림이 힘들어요", "죽을 만큼 바빠요", "자 해 보자", "살기 좋은 곳으로 가고 싶어요"])("위기 아님: %s", (t) => expect(detectCrisis(t)).toBeNull())

  const userText = "요즘은 그만 살고 싶어요"
  const stopped = (msg: string) => ({ quote: "", crisis: { message: msg } })
  it("구체 안내(상담 전화 번호)가 있고 풀이를 멈췄으면 info", () => {
    const r = run(stopped("지금 마음부터 챙기자. 자살예방상담전화 109로 전화해라."), { userText })
    expect(worst(r.findings.filter((f) => f.code === "CRISIS_RESPONSE"))).toBe("info")
  })
  it.each([
    "癸水 상관이 있어 상담사 일이 맞는다.",
    "가까운 사람에게 먼저 말을 걸어 보거라.",
  ])("직업 '상담사'·'가까운 사람'만으로는 안내로 인정하지 않는다: %s", (msg) => {
    const r = run(stopped(msg), { userText })
    expect(r.findings.find((f) => f.code === "CRISIS_RESPONSE")?.rule).toBe("no-counsel")
  })
  it("고민 글이 없으면 coverage에 위기 검사 미실행을 남긴다", () => {
    expect(run(CLEAN_READING).coverage.crisis).toBe("not-run:no-userText")
  })
})

describe("③ 일반어 오탐 정리(새 예문)", () => {
  it.each([
    "庚金 일간은 희망을 쉽게 놓지 않는다, 바라는 것을 끝까지 소망하는 쇠다.",
    "올해 丙午에는 일의 전망이 밝다.",
    "이 장 설명이 짧아 다음 장에서 丁丑 대운을 더 풀어 주마.",
    "할머니가 고향 집으로 돌아가실 때 庚金처럼 단단히 배웅해라.",
    "庚辰 일주는 계산을 귀신처럼 맞추는 쪽이다.",
    "2026년 丙午 시험 기간에는 입맛이 떨어질 수 있으니 끼니를 챙겨라.",
    "辛 겁재가 있어 돈이 헤프게 나가기 쉬우니 통장을 나눠라.",
    "올해 丙午는 고전이 길었던 만큼 庚金이 단단해지는 해다.",
  ])("통과: %s", (t) => {
    expect(run(readingOf(t)).pass).toBe(true)
  })
})

describe("④ 화면에 나가는 칸은 전부 검사", () => {
  it("years[].element에 금지 문장 → block", () => {
    const r = run({ years: [{ year: 2027, ganzhi: "丁未", element: "이 해에 남편과 갈라선다", title: "", text: "丁未년은 未가 겹친다." }] })
    expect(r.findings.some((f) => f.code === "FORBIDDEN_TOPIC" && f.location.path === "years[0].element")).toBe(true)
  })
  it("chips[].element·key 칸의 위험 태그 → UNSAFE_HTML", () => {
    const r = run({ parts: [{ chapters: [{ key: "<svg onload=x>", title: "t", chips: [{ letter: "庚", element: "<script>x</script>", label: "" }], body: ["庚金 일간이다."] }] }] })
    expect([...new Set(r.findings.filter((f) => f.code === "UNSAFE_HTML" && f.severity === "block").map((f) => f.location.field))].sort()).toEqual(["element", "key"])
  })
  it("아주 깊은 객체에서도 스택이 넘치지 않는다", () => {
    let node: Record<string, unknown> = { text: "壬水가 흐른다." }
    for (let i = 0; i < 20000; i++) node = { child: node }
    expect(() => collectSegments({ parts: [{ chapters: [{ body: ["庚金"], extra: node }] }] } as unknown as ReadingLike)).not.toThrow()
  })
})

describe("⑤ 빈 풀이", () => {
  it("제목·칩만 있고 본문이 없으면 block", () => {
    const r = run({ parts: [{ title: "마당", chapters: [{ title: "제목", chips: [{ letter: "庚辰" }], body: [] }] }] })
    expect(r.pass).toBe(false)
    expect(r.findings.some((f) => f.code === "MALFORMED_READING" && f.rule === "empty")).toBe(true)
  })
})

describe("⑥ 기둥 쪼개기·한글 간지·자리 불일치·연도 끼워 넣기", () => {
  it("정규화: 강희 부수·전각 문자·폭 없는 문자·문장 중간 줄바꿈", () => {
    expect(normalizeText("⾟⾣ ９５％ 가​나 다\n라")).toBe("辛酉 95% 가나 다 라")
    expect(normalizeText("끝.\n다음")).toBe("끝.\n다음")
  })
  it.each([
    ["월주는 壬 午라서", "split-pillar|position-mismatch"],
    ["癸・亥 시주라 밤에 강하다", "split-pillar|position-mismatch"],
    ["연주는 경자라 쥐띠다", "position-mismatch"],
    ["무진생인 너는", "hangul-pillar"],
    ["2040년에 보면 네 시주 庚申이 빛난다", "position-mismatch"],
  ])("차단: %s", (t, rules) => {
    const fs = findingsOf(t, "BASIS_NOT_IN_CHART")
    expect(fs.some((f) => f.severity === "block" && new RegExp(`^(${rules})$`).test(f.rule ?? "")), JSON.stringify(fs)).toBe(true)
  })
  it.each([
    "일주는 庚辰, 쇠가 젖은 흙에 앉았다.",
    "시주 癸未는 말과 글의 자리다.",
    "庚 辰 일주라고 띄어 써도 같은 기둥이다.",
    "2032년 壬子는 정축 대운의 끝이다.", // 연도 바로 옆 세운 간지
    "1990년 경오생인 너는 말띠란다.",
    "바닷물(해수)을 보면 마음이 풀린다.", // 자리 이름 없는 '해수'는 일반어
    "원국에 壬水는 하나도 없으니 물을 따로 챙겨라.", // 부재 진술
  ])("통과: %s", (t) => {
    expect(findingsOf(t, ["BASIS_NOT_IN_CHART", "YEAR_GANZHI_MISMATCH"]).filter((f) => f.severity !== "info")).toEqual([])
  })
  it("한글 오행 읽기: 자리 이름 뒤의 '자수'·'해수'는 근거 글자로 센다(작은 원국엔 子가 없어 block, 亥는 공망이라 통과)", () => {
    expect(worst(findingsOf("월지 자수가 불을 끈다.", "BASIS_NOT_IN_CHART", { sajuInput: SAJU_MIN }))).toBe("block")
    expect(findGanzhiTokens("월지 해수가 불을 끈다.").map((t) => t.value)).toEqual(["亥"])
    expect(findGanzhiTokens("바닷물 해수가 차다.")).toEqual([])
  })
  it("문장 끝 연도로 먼 곳의 가짜 기둥을 합법화하지 못한다", () => {
    const fs = findingsOf("壬子의 물이 네 庚金을 씻어 준다, 할미가 보기엔 그렇다, 2032년쯤.", "BASIS_NOT_IN_CHART")
    expect(worst(fs)).toBe("block")
  })
})

describe("⑦ 부정 표지 악용", () => {
  it.each([
    ["서방 덕이 없는 건 네 잘못이 아니다.", "MORAL_JUDGEMENT"],
    ["팔자가 참 사납다, 그래도 네 탓은 아니다.", "MORAL_JUDGEMENT"],
  ])("판정을 유지한 채 끝에 '아니다'를 붙여도 block: %s", (t, code) => {
    expect(worst(findingsOf(t, code as "MORAL_JUDGEMENT"))).toBe("block")
  })
  it.each(["팔자가 세다는 말은 옛 잣대다.", "남편 복이 없다고 쓰지 마라, 기대어 서는 팔자가 아닐 뿐이다.", "예전엔 이런 사주를 드센 팔자라 했다."])(
    "걷어 내는 문장은 info: %s",
    (t) => expect(worst(findingsOf(t, ["MORAL_JUDGEMENT", "GENDER_STEREOTYPE"]))).toBe("info"),
  )
  it("'틀림없다'의 '없'은 부정이 아니다 / '100% 믿지 말고'는 정확성 주장이 아니다", () => {
    expect(worst(findingsOf("할미 풀이는 적중률이 높아 틀림없다.", "SCIENTIFIC_CLAIM"))).toBe("block")
    expect(findingsOf("할미 말을 100% 믿지 말고 네 삶과 견주어 봐라.", "SCIENTIFIC_CLAIM")).toEqual([])
  })
})

describe("⑧ 동의어 사전 보강(새 예문)", () => {
  it.each([
    ["2029년에 부부가 남남이 된다.", "FORBIDDEN_TOPIC"],
    ["마흔둘에 쪽박을 찬다.", "FORBIDDEN_TOPIC"],
    ["이번 임용은 따놓은 당상이다.", "FORBIDDEN_TOPIC"],
    ["ETF에 몰아 넣어라.", "FORBIDDEN_TOPIC"],
    ["前世의 업으로 이번에 고생한다.", "FORBIDDEN_TOPIC"],
    ["팔자가 너무 쎄서 고생한다.", "MORAL_JUDGEMENT"],
    ["할미 풀이는 백발백중이다.", "SCIENTIFIC_CLAIM"],
    ["정확도는 90%를 넘는다.", "SCIENTIFIC_CLAIM"],
    ["난대묘선에 이르기를 쇠는 불에 녹는다 했다.", "FAKE_CLASSIC_QUOTE"],
    ["궁통보감에 '경금득정'이라 했다.", "FAKE_CLASSIC_QUOTE"],
  ])("block: %s", (t, code) => {
    expect(worst(findingsOf(t, code as "FORBIDDEN_TOPIC")), t).toBe("block")
  })
  it.each([
    "로또 같은 한 방은 바라지 말고 다달이 모아라.",
    "코인은 庚金 일간에게 맞지 않으니 멀리해라.",
    "주식회사에 다니든 가게를 하든 庚金은 맡은 일을 끝까지 한다.",
  ])("투자 만류·일반어는 통과: %s", (t) => {
    expect(findingsOf(t, "FORBIDDEN_TOPIC").filter((f) => f.severity === "block")).toEqual([])
  })
  it("사용자가 알려 준 지난 이별을 되짚는 문장은 block이 아니라 warn", () => {
    expect(worst(findingsOf("그 사람과 헤어진 해가 2021년이라 했지, 그해 辛丑의 丑이 午와 원진이 된다.", "FORBIDDEN_TOPIC"))).not.toBe("block")
  })
  it("사용자 사실: 간지 연도·새 동의어", () => {
    const ctx = { userFacts: [{ label: "결혼", value: "결혼", period: { fromYear: 2019, toYear: 2019 } }, { label: "퇴사", value: "퇴사", period: { fromYear: 2022, toYear: 2022 } }] }
    expect(worst(findingsOf("己亥년에 살림을 차렸지.", "KNOWN_FACT_AS_PREDICTION", ctx))).toBe("warn")
    expect(worst(findingsOf("2022년에 사직서를 냈구나.", "KNOWN_FACT_AS_PREDICTION", ctx))).toBe("warn")
  })
  it("근거 글자를 끼워 넣은 바넘 문장도 warn", () => {
    expect(worst(findingsOf("癸水 상관인 너도 다들 그렇듯 칭찬에 약하다.", "BARNUM"))).toBe("warn")
  })
})

describe("새로 확인한 정상 문단(오탐 회귀)", () => {
  it.each([
    "동생이 너를 많이 따랐다고 했지, 비견 庚이 곁에 있는 사주라 그렇단다.",
    "庚金은 쉽게 사라지지 않는 쇠라, 한번 맺은 인연을 오래 간다.",
    "대운은 정축, 2023년부터 2032년까지란다.",
    "기해년이던 2019년에는 亥가 巳와 부딪쳐 자리가 흔들렸을 수 있다.",
    "엄마가 너를 많이 아꼈다고 했지, 정인 未가 시주에 있는 걸 보면 그 말이 맞다.",
    "2027년 丁未에는 승진이나 자리 이동 이야기가 나올 수 있으나, 붙고 떨어지는 건 네 준비에 달렸다.",
    "옛 책에서는 상관을 흉신이라 불렀지만, 지금은 말과 재주의 글자로 읽는다.",
    "물기운인 임수가 원국에 없으니 마음을 식힐 길을 따로 마련해라.",
    "아내가 너를 아끼는지는 할미가 알 수 없단다.",
  ])("pass: %s", (t) => {
    const r = run(readingOf(t))
    expect(r.pass, JSON.stringify(r.findings)).toBe(true)
  })
})
