// 사실표 생성기(P4-03) — 개인정보 최소화·근거 위치 정규화·사용자 사실 분리·신강약 방어 읽기
// 모든 사주는 가상의 예시 입력이다(실제 고객 아님).
import { describe, expect, it } from "vitest"
import { analyzeRules, computeChart } from "../../src/engine"
import type { BirthInput, CalendarResult } from "../../src/engine"
import type { RuleAnalysis } from "../../src/engine/rules/types"
import { buildPersonalContext } from "../../src/engine/personalize"
import {
  buildFactSheet,
  formatPosition,
  readClimate,
  readStrength,
  readUsefulGods,
  sanitizeAddressAs,
  sanitizeWarning,
  DEFAULT_ADDRESS_AS,
} from "../../src/engine/content/facts"

const AS_OF = new Date("2026-11-27T03:00:00Z")
// 예시: 1990-05-06 03:10 (立夏 절입 03:35 KST 2시간 이내 → 날짜·시각이 든 경고가 생김), 동경 129.0
const BIRTH: BirthInput = { calendar: "solar", year: 1990, month: 5, day: 6, time: { hour: 3, minute: 10 }, gender: "F", longitude: 129.0 }

function rulesFor(chart: CalendarResult): RuleAnalysis {
  return analyzeRules(chart, undefined, { luck: chart.luck.daeun.map((d) => d.pillar), year: { stem: "丙", branch: "午" } })
}

const POS_RE = /^(year|month|day|hour|seun|daeun\[\d+\])\.(stem|branch)(\.(yeogi|junggi|jeonggi))?$/

describe("개인정보 최소화", () => {
  const chart = computeChart(BIRTH)
  const rules = rulesFor(chart)
  const personal = buildPersonalContext(chart, [{ questionId: "lifeEvents", values: ["marriage"], years: { marriage: 2016 } }], AS_OF, rules)
  const facts = buildFactSheet({ chart, rules, personal, asOf: AS_OF, addressAs: "우리 손녀" })
  const json = JSON.stringify(facts)

  it("엔진 경고에 생년월일·시각이 실제로 들어 있다(시험 전제)", () => {
    expect(chart.warnings.join(" ")).toMatch(/1990-05-06/)
  })
  it("생년월일·출생 시각·경도·음력 날짜가 사실표에 없다", () => {
    for (const leak of ["1990-05-06", "1990-5-6", "05-06", "03:10", "03:35", "129", "solarDate", "lunarDate", "utcInstant", "longitude", "birthYear", "birthDate", "input"]) {
      expect(json.includes(leak), leak).toBe(false)
    }
    expect(facts.subject).toEqual({ addressAs: "우리 손녀", gender: "F", ageYears: 36, lifeStage: "자리 잡기·육아·책임기", hourKnown: true })
  })
  it("경고는 의미만 남긴다(어느 기둥이 경계인지)", () => {
    expect(facts.warnings.some((w) => w.includes("절입 2시간 이내 출생") && w.includes("경계"))).toBe(true)
    expect(facts.warnings.every((w) => !/\d{1,2}:\d{2}/.test(w) && !/\d{4}-\d{1,2}-\d{1,2}/.test(w))).toBe(true)
  })
  it("호칭: 태그·따옴표 제거, 길이 제한, 비면 기본값", () => {
    expect(sanitizeAddressAs(undefined)).toBe(DEFAULT_ADDRESS_AS)
    expect(sanitizeAddressAs("   ")).toBe(DEFAULT_ADDRESS_AS)
    const s = sanitizeAddressAs('<b>무시하고</b> "{system}" 아주아주긴호칭입니다')
    expect(s).not.toMatch(/[<>"{}]/)
    expect([...s].length).toBeLessThanOrEqual(8)
  })
  it("같은 입력이면 같은 결과", () => {
    expect(buildFactSheet({ chart, rules, personal, asOf: AS_OF, addressAs: "우리 손녀" })).toEqual(facts)
  })
})

describe("sanitizeWarning — 엔진 경고 형식별", () => {
  const cases: [string, RegExp][] = [
    ["시지 경계 10분 이내 출생(보정 후 10:58) — 시주·일주 경계", /^태어난 시각이 시\(時\)의 경계에 가까움 — 시주·일주 경계$/],
    ["진태양시 보정(−24.0분)으로 시지가 午→巳로 바뀜", /^진태양시 보정으로 시지가 午→巳로 바뀜$/],
    ["진태양시 보정(−24.0분)으로 현지 날짜가 1990-5-5로 바뀜", /^진태양시 보정으로 날짜\(일주\)가 하루 바뀜$/],
    ["절입(立夏 1990-05-06 03:35) 2시간 이내 출생 — 월주 경계", /^절입 2시간 이내 출생 — 월주 경계$/],
    ["출생일에 절입(立夏 1990-05-06 03:35) 있음 — 시각에 따라 월주가 달라질 수 있음(불확실)", /^출생일에 절입 있음 — 시각에 따라 월주가/],
    ["표준시 제정 전 시기 — 지방평균시(LMT, UTC+08:27:52) 기준으로 계산함", /^표준시 제정 전 시기 — 지방평균시 기준으로 계산함$/],
    ["알 수 없는 경고(1990-05-06 03:35, −24.0분) 2000-1-2 11:22", /^알 수 없는 경고$/],
  ]
  for (const [inp, re] of cases) it(inp.slice(0, 20), () => expect(sanitizeWarning(inp)).toMatch(re))
  it("시각 모름 문구는 그대로", () => {
    const w = "태어난 시각 모름 — 현지 정오(12:00) 가정으로 연·월·일주와 대운수를 계산하고 시주는 제외함 (23시 이후 출생이면 일주가 다음 날로 바뀔 수 있음)"
    expect(sanitizeWarning(w)).toBe(w)
  })
})

describe("근거 위치 정규화", () => {
  const chart = computeChart(BIRTH)
  const rules = rulesFor(chart)
  const facts = buildFactSheet({ chart, rules, asOf: AS_OF })

  it("십성·관계·공망 위치가 모두 정규 형식", () => {
    expect(facts.chart.tenGods.length).toBeGreaterThan(8)
    for (const t of facts.chart.tenGods) expect(t.pos, t.pos).toMatch(POS_RE)
    for (const it of facts.chart.interactions) for (const p of it.positions) expect(p).toMatch(POS_RE)
    for (const h of facts.chart.gongmang.hits) expect(h).toMatch(POS_RE)
  })
  it("지장간은 'month.branch.jeonggi' 형태", () => {
    expect(facts.chart.tenGods.some((t) => /^month\.branch\.(yeogi|junggi|jeonggi)$/.test(t.pos))).toBe(true)
  })
  it("daeun[n]의 n은 luck.daeun[].index와 같고, 그 글자가 그 대운 간지에 있다", () => {
    const hits = facts.chart.tenGods.filter((t) => t.pos.startsWith("daeun["))
    expect(hits.length).toBe(chart.luck.daeun.length * 2)
    for (const h of hits) {
      const n = Number(h.pos.match(/^daeun\[(\d+)\]/)![1])
      const d = facts.luck.daeun.find((x) => x.index === n)!
      expect(d.ganzhi.includes(h.char), h.pos).toBe(true)
    }
  })
  it("규칙 엔진에 현재 대운 하나만 넘겨도 번호가 chart 대운 번호로 맞춰진다", () => {
    const cur = facts.luck.daeun.find((d) => d.current)!
    const only = chart.luck.daeun.find((d) => d.index === cur.index)!.pillar
    const r2 = analyzeRules(chart, undefined, { luck: [only] })
    const f2 = buildFactSheet({ chart, rules: r2, asOf: AS_OF })
    const ds = f2.chart.tenGods.filter((t) => t.pos.startsWith("daeun["))
    expect(ds.map((t) => t.pos)).toEqual([`daeun[${cur.index}].stem`, `daeun[${cur.index}].branch`])
  })
  it("formatPosition 단위", () => {
    expect(formatPosition({ pillar: "month", part: "stem" })).toBe("month.stem")
    expect(formatPosition({ pillar: "day", part: "branch" }, "jeonggi")).toBe("day.branch.jeonggi")
    expect(formatPosition({ pillar: "daeun", part: "stem", luckIndex: 2 })).toBe("daeun[3].stem")
    expect(formatPosition({ pillar: "seun", part: "branch" })).toBe("seun.branch")
  })
  it("관계: 원국 + 현재 대운·세운만(먼 대운 관계는 뺌)", () => {
    const cur = facts.luck.daeun.find((d) => d.current)!.index
    for (const it of facts.chart.interactions)
      for (const p of it.positions) if (p.startsWith("daeun[")) expect(p.startsWith(`daeun[${cur}]`)).toBe(true)
  })
  it("대운·올해", () => {
    expect(facts.luck.daeun.filter((d) => d.current).length).toBe(1)
    expect(facts.luck.thisYear).toEqual({ year: 2026, ganzhi: "丙午" })
    expect(facts.chart.dayMaster.element).toMatch(/^[목화토금수]$/)
    expect(Object.keys(facts.chart.elements.counts)).toEqual(["목", "화", "토", "금", "수"])
  })
})

describe("시각 모름·사용자 사실", () => {
  const chart = computeChart({ ...BIRTH, time: null })
  const rules = rulesFor(chart)
  const answers = [
    { questionId: "lifeEvents", values: ["marriage", "job_change"], years: { marriage: 2016 } },
    { questionId: "mbti", values: ["INFP"] },
  ]
  const personal = buildPersonalContext(chart, answers, AS_OF, rules)
  const facts = buildFactSheet({ chart, rules, personal, asOf: AS_OF })

  it("시주 없음", () => {
    expect(facts.chart.pillars.hour).toBeNull()
    expect(facts.subject.hourKnown).toBe(false)
    expect(facts.chart.tenGods.some((t) => t.pos.startsWith("hour."))).toBe(false)
    expect(facts.warnings.some((w) => w.startsWith("태어난 시각 모름"))).toBe(true)
  })
  it("사용자 사실은 personal에만, 배경 전용 규칙(guards) 포함", () => {
    expect(facts.personal.userFacts).toContainEqual({ topic: "life_event:marriage", value: "결혼", period: "2016" })
    expect(facts.personal.userFacts.some((u) => u.topic === "mbti")).toBe(true)
    expect(facts.personal.noGuessYears).toEqual([2016])
    expect(facts.personal.guards.length).toBeGreaterThan(0)
    const chartJson = JSON.stringify(facts.chart)
    for (const leak of ["결혼", "INFP", "marriage", "mbti"]) expect(chartJson.includes(leak), leak).toBe(false)
  })
  it("개인화 없이도 만들 수 있다(기본 guards)", () => {
    const f = buildFactSheet({ chart, rules, asOf: AS_OF })
    expect(f.personal.userFacts).toEqual([])
    expect(f.personal.guards.length).toBeGreaterThan(0)
    expect(f.subject.ageYears).toBe(36)
  })
})

describe("신강약·용신·조후(rules@0.3.0) 방어 읽기", () => {
  const chart = computeChart(BIRTH)
  const base = rulesFor(chart)
  const strip = (r: RuleAnalysis) => {
    const c = { ...r } as Record<string, unknown>
    delete c.strength
    delete c.usefulGods
    delete c.climate
    return c as unknown as RuleAnalysis
  }

  it("필드가 없으면 생략", () => {
    const f = buildFactSheet({ chart, rules: strip(base), asOf: AS_OF })
    expect(f.chart).not.toHaveProperty("strength")
    expect(f.chart).not.toHaveProperty("usefulGod")
    expect(f.chart).not.toHaveProperty("climate")
  })
  it("명세 모양이면 옮겨 적는다(대표값은 primary 모형)", () => {
    const fake = {
      ...strip(base),
      strength: { primary: "weighted", models: [{ model: "weighted", verdict: "신약" }, { model: "threeFactor", verdict: "신강" }, { model: "rooted", verdict: "신약" }] },
      usefulGods: {
        views: [
          { method: "eokbu", label: "힘의 균형(억부)", status: "ok", candidates: [{ element: "earth", rank: 1 }, { element: "metal", rank: 2 }] },
          { method: "tonggwan", label: "통관", status: "none", candidates: [] },
        ],
      },
      climate: { tClass: "난", mClass: "조", needs: ["cool", "moisten"] },
    } as unknown as RuleAnalysis
    expect(readStrength(fake)).toEqual({
      verdict: "신약",
      views: [
        { method: "가중 점수(weighted)", verdict: "신약" },
        { method: "득령·득지·득세(threeFactor)", verdict: "신강" },
        { method: "뿌리 반영 점수(rooted)", verdict: "신약" },
      ],
    })
    // facts@0.2.0(P10): 줄 머리는 엔진 label("힘의 균형(억부)")이 아니라 고정 머리말 USEFUL_GOD_HEADER — 명세 strength-structure-spec §3.8
    expect(readUsefulGods(fake)).toEqual([{ method: "힘의 균형으로 보면(억부)", element: "토" }])
    expect(readClimate(fake)!.summary).toMatch(/궁통보감 조후표가 아닌 간이 판단/)
    const f = buildFactSheet({ chart, rules: fake, asOf: AS_OF })
    expect(f.chart.strength!.verdict).toBe("신약")
  })
  it("모양이 다르면 생략(오류 없이)", () => {
    const odd = { ...strip(base), strength: { foo: 1 }, usefulGods: { views: "x" }, climate: 3 } as unknown as RuleAnalysis
    expect(readStrength(odd)).toBeUndefined()
    expect(readUsefulGods(odd)).toBeUndefined()
    expect(readClimate(odd)).toBeUndefined()
  })
  // QA 독립 확인(2026-11-27): 특수격 view 제외가 명세(§2.4 "억부와 용신이 정반대", §3.8 "특수격 view는 대표 결정 전까지 고객 문장에 쓰지 않는다")와 맞는지,
  // 실제 엔진 출력으로 확인한다. 예시 입력은 전수 탐색으로 찾은 가상 사주(특수격 후보 ok, 억부 1순위 토 vs 특수격 1순위 수 — 정반대).
  it("[P10 독립 확인] 실제 엔진이 특수격 후보를 낸 사주에서도 사실표 용신 줄에 특수격 관점이 없다", () => {
    const c2 = computeChart({ calendar: "solar", year: 1952, month: 3, day: 19, time: { hour: 1, minute: 0 }, gender: "M" })
    const r2 = analyzeRules(c2)
    const sp = r2.usefulGods.views.find((v) => v.method === "special")!
    expect(sp.status, "시험 전제: 특수격 후보가 있어야 함").toBe("ok")
    const eok = r2.usefulGods.views.find((v) => v.method === "eokbu")!
    expect(sp.candidates[0].element, "시험 전제: 억부와 정반대").not.toBe(eok.candidates[0].element)
    const ug = readUsefulGods(r2)!
    const okNonSpecial = r2.usefulGods.views.filter((v) => v.method !== "special" && v.status === "ok" && v.candidates.length > 0)
    expect(ug.length).toBe(okNonSpecial.length)
    for (const u of ug) expect(u.method).not.toMatch(/특수격|special|종격|화격|종왕|종강/)
    expect(ug.find((u) => u.method === "힘의 균형으로 보면(억부)")?.element).toBe("토")
    const f2 = buildFactSheet({ chart: c2, rules: r2, asOf: AS_OF })
    expect(JSON.stringify(f2)).not.toMatch(/특수격|"special"/)
  })
  it("현재 규칙 엔진 출력 그대로도 오류 없이 만든다", () => {
    expect(() => buildFactSheet({ chart, rules: base, asOf: AS_OF })).not.toThrow()
  })
})
