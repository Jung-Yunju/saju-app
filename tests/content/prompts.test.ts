// 콘텐츠 엔진 장별 프롬프트 검사 (P4-03) — 작성: 콘텐츠 작가
// AI를 부르지 않는다. 프롬프트 문자열·출력 스키마·상품 구성만 검사한다.
import { describe, expect, it } from "vitest"
import type { FactSheet } from "../../src/engine/content/types"
import {
  BASIC_CHAPTER_IDS,
  CHAPTERS,
  PRODUCTS,
  PRODUCT_CHAPTERS,
  PRODUCT_CODES,
  buildSystemPrompt,
  chapterById,
  chaptersForProduct,
  chaptersForProducts,
  crisisMessage,
  maxOutputTokensForProduct,
  systemFor,
  vocative,
} from "../../src/engine/content/prompts"

// ─────────────────────────────── 예시 사실표 (가상 사주 — 실제 인물 아님)
// 예시: 1986년 丙寅년 子월 乙酉일 午시생, 2026년 기준 만 39세. 대운 역행(예시 값).
// 십성은 乙 일간 기준으로 손으로 대조한 값이다(丙=상관, 寅=겁재, 庚=정관, 子=편인, 酉=편관, 壬=정인, 午=식신, 申=정관).
function exampleFacts(): FactSheet {
  return {
    schemaVersion: 1,
    engineVersion: "예시-engine@0.0.0",
    asOf: "2026-11-27T00:00:00.000Z",
    subject: { addressAs: "손주", gender: "F", ageYears: 39, lifeStage: "establishment", hourKnown: true },
    chart: {
      pillars: { year: "丙寅", month: "庚子", day: "乙酉", hour: "壬午" },
      dayMaster: { stem: "乙", element: "wood", yinYang: "yin" },
      elements: { counts: { wood: 2, fire: 2, earth: 0, metal: 2, water: 2 } },
      tenGods: [
        { char: "丙", pos: "year.stem", tenGod: "상관" },
        { char: "寅", pos: "year.branch", tenGod: "겁재" },
        { char: "庚", pos: "month.stem", tenGod: "정관" },
        { char: "子", pos: "month.branch", tenGod: "편인" },
        { char: "酉", pos: "day.branch", tenGod: "편관" },
        { char: "壬", pos: "hour.stem", tenGod: "정인" },
        { char: "午", pos: "hour.branch", tenGod: "식신" },
        { char: "丙", pos: "daeun.stem", tenGod: "상관" },
        { char: "申", pos: "daeun.branch", tenGod: "정관" },
        { char: "丙", pos: "seun.stem", tenGod: "상관" },
        { char: "午", pos: "seun.branch", tenGod: "식신" },
      ],
      interactions: [
        { kind: "천간합", chars: "庚乙", positions: ["month.stem", "day.stem"], adjacent: true },
        { kind: "충", chars: "子午", positions: ["month.branch", "hour.branch"], adjacent: false },
        { kind: "충", chars: "子午", positions: ["month.branch", "seun.branch"], adjacent: false },
      ],
      gongmang: { branches: ["午", "未"], hits: ["hour.branch"] },
    },
    luck: {
      direction: "backward",
      daeun: [
        { index: 1, startAge: 4, startYear: 1990, ganzhi: "己亥", current: false },
        { index: 2, startAge: 14, startYear: 2000, ganzhi: "戊戌", current: false },
        { index: 3, startAge: 24, startYear: 2010, ganzhi: "丁酉", current: false },
        { index: 4, startAge: 34, startYear: 2020, ganzhi: "丙申", current: true },
        { index: 5, startAge: 44, startYear: 2030, ganzhi: "乙未", current: false },
        { index: 6, startAge: 54, startYear: 2040, ganzhi: "甲午", current: false },
        { index: 7, startAge: 64, startYear: 2050, ganzhi: "癸巳", current: false },
        { index: 8, startAge: 74, startYear: 2060, ganzhi: "壬辰", current: false },
      ],
      thisYear: { year: 2026, ganzhi: "丙午" },
    },
    personal: {
      userFacts: [
        { topic: "occupationStatus", value: "employed" },
        { topic: "life_event:job_change", value: "job_change", period: "2021" },
        { topic: "relationshipStatus", value: "single" },
        { topic: "concernTopic", value: "career" },
        { topic: "toneStrength", value: "direct" },
      ],
      noGuessYears: [2021],
      guards: ["예시 규칙: userFacts는 배경으로만 쓴다."],
    },
    warnings: ["예시 경고: 태어난 시각이 시 경계에서 20분 안쪽"],
  }
}

const EXPECTED_IDS = [
  "free-nature", "free-elements", "free-year", "free-preview",
  "nature", "talent", "money", "people", "daeun-now", "year-ahead", "crossroads", "closing",
  "love-deep", "money-deep", "career-deep", "life-past", "life-ahead", "decade-weather", "decade-pack",
]

// ─────────────────────────────── JSON Schema 형태 검사(구조화 출력 부분집합)

const ALLOWED_SCHEMA_KEYS = new Set(["type", "description", "properties", "required", "additionalProperties", "items", "enum"])
const ALLOWED_TYPES = new Set(["object", "array", "string", "integer", "number", "boolean"])

function schemaErrors(node: unknown, path = "$"): string[] {
  const errs: string[] = []
  if (!node || typeof node !== "object" || Array.isArray(node)) return [`${path}: 스키마가 객체가 아님`]
  const n = node as Record<string, unknown>
  for (const k of Object.keys(n)) if (!ALLOWED_SCHEMA_KEYS.has(k)) errs.push(`${path}: 쓰지 않기로 한 키 ${k}`)
  const t = n.type
  if (typeof t !== "string" || !ALLOWED_TYPES.has(t)) errs.push(`${path}: type이 없거나 잘못됨(${String(t)})`)
  if (t === "object") {
    const props = n.properties
    if (!props || typeof props !== "object" || Array.isArray(props)) errs.push(`${path}: properties 없음`)
    else {
      const keys = Object.keys(props)
      if (keys.length === 0) errs.push(`${path}: 빈 객체`)
      const req = n.required
      if (!Array.isArray(req) || req.length !== keys.length || !keys.every((k) => req.includes(k)))
        errs.push(`${path}: required가 모든 칸과 같지 않음`)
      if (n.additionalProperties !== false) errs.push(`${path}: additionalProperties가 false가 아님`)
      for (const k of keys) errs.push(...schemaErrors((props as Record<string, unknown>)[k], `${path}.${k}`))
    }
  } else {
    if (typeof n.description !== "string" || !n.description.trim()) errs.push(`${path}: description 없음`)
  }
  if (t === "array") {
    if (!n.items) errs.push(`${path}: items 없음`)
    else errs.push(...schemaErrors(n.items, `${path}[]`))
  }
  if (n.enum !== undefined) {
    if (t !== "string" || !Array.isArray(n.enum) || n.enum.length === 0 || !n.enum.every((v) => typeof v === "string"))
      errs.push(`${path}: enum은 문자열 칸의 비지 않은 문자열 배열이어야 함`)
  }
  return errs
}

function allKeys(v: unknown, out: string[] = []): string[] {
  if (Array.isArray(v)) v.forEach((x) => allKeys(x, out))
  else if (v && typeof v === "object")
    for (const [k, x] of Object.entries(v)) {
      out.push(k)
      allKeys(x, out)
    }
  return out
}

// ─────────────────────────────── 장 목록·상품 구성

describe("장 목록", () => {
  it("지시된 장(무료 4 + 기본 8 + 특화 7)이 모두 있고 id가 겹치지 않는다", () => {
    const ids = CHAPTERS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort()).toEqual([...EXPECTED_IDS].sort())
  })

  it("장마다 제목·토큰 상한(800~2500)·근거·사실표 조각이 있다", () => {
    for (const c of CHAPTERS) {
      expect(c.title.trim(), c.id).not.toBe("")
      expect(Number.isInteger(c.maxOutputTokens), c.id).toBe(true)
      expect(c.maxOutputTokens, c.id).toBeGreaterThanOrEqual(800)
      expect(c.maxOutputTokens, c.id).toBeLessThanOrEqual(2500)
      expect(c.tokenBasis.length, c.id).toBeGreaterThan(10)
      expect(c.factParts.length, c.id).toBeGreaterThan(0)
      expect(c.factParts, c.id).toContain("guards")
      expect(c.factParts, c.id).toContain("warnings")
    }
  })

  it("모든 장이 적어도 한 상품에 들어가고, products는 상품 구성표와 같다", () => {
    for (const c of CHAPTERS) {
      expect(c.products.length, c.id).toBeGreaterThan(0)
      for (const p of c.products) expect(PRODUCT_CHAPTERS[p as keyof typeof PRODUCT_CHAPTERS], `${c.id}/${p}`).toContain(c.id)
    }
    for (const code of PRODUCT_CODES) for (const id of PRODUCT_CHAPTERS[code]) expect(chapterById(id)?.products, `${code}/${id}`).toContain(code)
  })
})

describe("상품별 구성", () => {
  it("PRODUCTS 코드가 PRODUCT_CODES와 같다", () => {
    expect(PRODUCTS.map((p) => p.code)).toEqual([...PRODUCT_CODES])
  })

  it("FREE는 무료 장 4개, BASIC은 기본 8장 순서 그대로", () => {
    expect(chaptersForProduct("FREE").map((c) => c.id)).toEqual(["free-nature", "free-elements", "free-year", "free-preview"])
    expect(chaptersForProduct("FREE").every((c) => c.tier === "free")).toBe(true)
    expect(chaptersForProduct("BASIC").map((c) => c.id)).toEqual([...BASIC_CHAPTER_IDS])
  })

  it("특화 장이 해당 상품에 들어 있다", () => {
    expect(chaptersForProduct("LOVE").map((c) => c.id)).toContain("love-deep")
    expect(chaptersForProduct("MONEY").map((c) => c.id)).toContain("money-deep")
    expect(chaptersForProduct("CAREER").map((c) => c.id)).toContain("career-deep")
    expect(chaptersForProduct("LIFE").map((c) => c.id)).toEqual(expect.arrayContaining(["life-past", "life-ahead", ...BASIC_CHAPTER_IDS]))
    expect(chaptersForProduct("DECADE").map((c) => c.id)).toEqual(expect.arrayContaining(["decade-weather", "decade-pack"]))
  })

  it("지원하는 유료 상품은 모두 유료 장만, 마무리 장으로 끝난다", () => {
    for (const p of PRODUCTS.filter((x) => x.supported && x.tier === "paid")) {
      const specs = chaptersForProduct(p.code)
      expect(specs.length, p.code).toBeGreaterThan(0)
      expect(specs.every((c) => c.tier === "paid"), p.code).toBe(true)
      expect(specs[specs.length - 1].id, p.code).toBe("closing")
    }
  })

  it("지원하지 않는 상품(두 사람·현재 고민)과 모르는 코드는 빈 배열", () => {
    for (const code of ["BULLY", "CONFLICT", "COMPAT", "CONCERN", "XYZ", ""]) expect(chaptersForProduct(code), code).toEqual([])
    for (const p of PRODUCTS.filter((x) => !x.supported)) expect(p.note, p.code).toBeTruthy()
  })

  it("묶음은 장을 합치되 같은 장은 한 번만", () => {
    const ids = chaptersForProducts(["LOVE", "MONEY", "CAREER"]).map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.filter((id) => id === "nature")).toHaveLength(1)
    expect(ids).toEqual(expect.arrayContaining(["love-deep", "money-deep", "career-deep"]))
  })

  it("상품별 출력 토큰 상한 합이 비용 가정(COST_REPORT 주제형 출력 12k, 인생 총괄은 그 이상)과 같은 자릿수", () => {
    expect(maxOutputTokensForProduct("FREE")).toBeLessThanOrEqual(4000)
    for (const code of ["BASIC", "LOVE", "MONEY", "CAREER", "DECADE", "YEAR"] as const) expect(maxOutputTokensForProduct(code), code).toBeLessThanOrEqual(14000)
    expect(maxOutputTokensForProduct("LIFE")).toBeLessThanOrEqual(20000)
  })
})

// ─────────────────────────────── build() — 프롬프트 문자열

describe("build(facts)", () => {
  const facts = exampleFacts()

  it("모든 장이 시스템·사용자 메시지 문자열을 만든다", () => {
    for (const c of CHAPTERS) {
      const { system, user } = c.build(facts)
      expect(typeof system, c.id).toBe("string")
      expect(typeof user, c.id).toBe("string")
      expect(system.length, c.id).toBeGreaterThan(500)
      expect(user, c.id).toContain("<사실표>")
      expect(user, c.id).toContain("</사실표>")
      expect(user, c.id).toContain(c.id)
      expect(user, c.id).not.toContain("undefined")
      expect(user, c.id).not.toContain("[object Object]")
      expect(user, c.id).not.toContain("NaN")
    }
  })

  it("예시 사실표에는 실명·생년월일·출생지 칸이 없다", () => {
    const keys = allKeys(facts).map((k) => k.toLowerCase())
    for (const bad of ["name", "realname", "fullname", "birth", "birthdate", "birthday", "birthplace", "location", "address", "phone", "email"])
      expect(keys, bad).not.toContain(bad)
  })

  it("사실표 밖에 실수로 붙은 개인정보 칸은 프롬프트에 새지 않는다", () => {
    const leaky = {
      ...exampleFacts(),
      name: "홍길동예시",
      birthDate: "1986-12-15",
      birthPlace: "예시시 예시동",
      subject: { ...exampleFacts().subject, realName: "홍길동예시" },
    } as unknown as FactSheet
    for (const c of CHAPTERS) {
      const { system, user } = c.build(leaky)
      for (const s of [system, user]) {
        expect(s, c.id).not.toContain("홍길동예시")
        expect(s, c.id).not.toContain("1986-12-15")
        expect(s, c.id).not.toContain("예시시 예시동")
      }
    }
  })

  it("성별·기준 시각·엔진 버전은 AI에 넘기지 않는다", () => {
    for (const c of CHAPTERS) {
      const { system, user } = c.build(facts)
      for (const s of [system, user]) {
        expect(s, c.id).not.toContain("gender")
        expect(s, c.id).not.toMatch(/성별\s*[:：]/)
        expect(s, c.id).not.toContain(facts.asOf)
        expect(s, c.id).not.toContain(facts.engineVersion)
      }
    }
  })

  it("사실표 조각은 장에 필요한 것만 들어간다", () => {
    const fe = chapterById("free-elements")!.build(facts).user
    expect(fe).toContain("[오행 치수]")
    expect(fe).not.toContain("[지금 대운")
    expect(fe).not.toContain("[사용자 사실")
    expect(fe).not.toContain("[올해 세운]")

    const nat = chapterById("nature")!.build(facts).user
    expect(nat).not.toContain("[지금 대운")
    expect(nat).toContain("乙酉(을유)")

    const past = chapterById("life-past")!.build(facts).user
    expect(past).toContain("己亥(기해)")
    expect(past).toContain("丁酉(정유)")
    expect(past).not.toContain("乙未(을미)")

    const ahead = chapterById("life-ahead")!.build(facts).user
    expect(ahead).toContain("丙申(병신)")
    expect(ahead).toContain("乙未(을미)")
    expect(ahead).not.toContain("己亥(기해)")
    // 지금부터 많아야 4개: 丙申·乙未·甲午·癸巳 — 壬辰은 빠진다
    expect(ahead).not.toContain("壬辰(임진)")
  })

  it("운 글자의 십성은 사실표에 있는 것만 옮기고, 없으면 '사실표에 없음'으로 적는다", () => {
    const dn = chapterById("daeun-now")!.build(facts).user
    expect(dn).toContain("申(신) = 정관")
    expect(dn).toContain("丙(병) = 상관")
    // 다음 대운 乙未: 未는 예시 사실표 tenGods에 없다
    expect(dn).toContain("未(미) = 십성 사실표에 없음")
  })

  it("사용자 사실은 그 장의 주제만, 말씨 세기는 사용자 메시지에 넣지 않는다", () => {
    const tal = chapterById("talent")!.build(facts).user
    expect(tal).toContain("지금 하는 일: 직장에 다님")
    expect(tal).not.toContain("연애·혼인 상태")
    const fe = chapterById("free-elements")!.build(facts).user
    expect(fe).not.toContain("직장에 다님")
    for (const c of CHAPTERS) expect(c.build(facts).user, c.id).not.toContain("말씀의 느낌")
  })

  it("맞히지 않는 해·엔진 경고·규칙 문구가 모든 장에 들어간다(맞히지 않는 해는 그 조각을 쓰는 장)", () => {
    for (const c of CHAPTERS) {
      const { user } = c.build(facts)
      expect(user, c.id).toContain("예시 경고: 태어난 시각이 시 경계에서 20분 안쪽")
      expect(user, c.id).toContain("예시 규칙: userFacts는 배경으로만 쓴다.")
      if (c.factParts.includes("noGuessYears")) expect(user, c.id).toContain("2021년")
    }
  })

  it("태어난 시를 모르면 시주를 '모름'으로 적고 경고를 단다", () => {
    const f = exampleFacts()
    f.chart.pillars.hour = null
    f.subject.hourKnown = false
    f.warnings = []
    const u = chapterById("nature")!.build(f).user
    expect(u).toContain("시주 모름")
    expect(u).toContain("태어난 시 모름")
    expect(u).not.toContain("壬午(임오)")
  })

  it("내년 세운이 사실표에 없으면 셈하지 말라고, 있으면 그 값을 넣는다", () => {
    const without = chapterById("year-ahead")!.build(facts).user
    expect(without).toContain("내년 간지는 사실표에 없다")
    expect(without).not.toContain("2027년")
    const withNext = { ...exampleFacts(), luck: { ...exampleFacts().luck, nextYear: { year: 2027, ganzhi: "丁未" } } } as unknown as FactSheet
    const u = chapterById("year-ahead")!.build(withNext).user
    expect(u).toContain("2027년 丁未(정미)년")
  })

  it("한 풀이 안에서는 장이 달라도 시스템 프롬프트가 같다(프롬프트 캐시)", () => {
    const systems = new Set(CHAPTERS.map((c) => c.build(facts).system))
    expect(systems.size).toBe(1)
  })
})

// ─────────────────────────────── 시스템 프롬프트 원칙

describe("시스템 프롬프트", () => {
  const sys = systemFor(exampleFacts())

  it("재료 원칙: 사실표에 있는 글자·관계만, 새로 계산·추론 금지, 근거 글자 밝히기", () => {
    expect(sys).toContain("아래 사실표에 있는 글자·관계만 근거로 쓴다")
    expect(sys).toContain("새로 계산하거나 추론한 십성·합충형파해")
    expect(sys).toContain("근거 글자는 문장 안에 밝힌다")
    expect(sys).toContain("다른 사람에게 이 문장을 줘도 통하는가")
  })

  it("사용자 사실은 배경으로만, 맞히지 않는 해, 불확실성 밝히기", () => {
    expect(sys).toContain("배경으로만 쓴다")
    expect(sys).toContain("[맞히지 않는 해]")
    expect(sys).toContain("[엔진 경고]")
    expect(sys).toContain("검증된 예측이 아니다")
  })

  it("금지 주제: 사망·사고·중병·이혼·파산 시기, 병 이름, 투자 종목, 합격, 속마음, 전생, 점수", () => {
    for (const w of ["죽음·사고·중병·이혼·파산의 시기", "병 이름", "투자 종목", "합격", "속마음", "전생", "점수를 매기지 않는다", "부적"]) expect(sys, w).toContain(w)
  })

  it("성별로 해석을 바꾸지 않고, 옛 판정 낱말을 막는다", () => {
    expect(sys).toContain("같은 글자의 뜻을 성별로 바꾸지 않는다")
    expect(sys).toContain("팔자가 세다")
  })

  it("고전 인용 금지와 발음 주의", () => {
    expect(sys).toContain("고전 인용 금지")
    expect(sys).toContain("병신합")
  })

  it("위기 신호면 풀이를 멈추고 상담 안내(호칭은 부름말로 바뀌어 들어간다)", () => {
    expect(sys).toContain("풀이를 멈춘다")
    expect(sys).toContain("109")
    expect(sys).toContain("1577-0199")
    expect(sys).toContain("손주야, 할미가 풀이는 잠깐 접어 두마")
    expect(sys).not.toContain("{호칭}")
  })

  it("JSON 출력 규칙", () => {
    expect(sys).toContain("지정된 JSON 스키마로만 답한다")
    expect(sys).toContain("<b></b>")
  })

  it("기존 프롬프트의 폐기 항목이 남지 않는다(AI가 십성 뽑기, 명언 인용구, 복자할미 호칭)", () => {
    for (const s of [sys, buildSystemPrompt({ voice: "plain" })]) {
      expect(s).not.toContain("네가 뽑는다")
      expect(s).not.toContain("명언처럼")
      expect(s).not.toContain("복자할미")
    }
  })

  it("목소리·말씨 세기·할머니 이름이 바뀐다", () => {
    expect(sys).toContain("할미 목소리")
    expect(sys).toContain("솔직하게 짚어서") // 예시 사실표 toneStrength = direct
    const plain = systemFor({ ...exampleFacts(), style: { voice: "담백" } } as unknown as FactSheet)
    expect(plain).toContain("담백 목소리")
    expect(plain).toContain("해요체")
    expect(buildSystemPrompt()).toContain("할머니가 풀어 주는 사주」의 할머니다")
    const named = buildSystemPrompt({ grandmaName: "달래" })
    expect(named).toContain("달래 할머니다")
    expect(named).toContain('스스로는 "할미"라고 부른다')
  })

  it("부름말과 위기 문안 도우미", () => {
    expect(vocative("손주")).toBe("손주야")
    expect(vocative("지민")).toBe("지민아")
    expect(vocative("")).toBe("")
    expect(crisisMessage("halmi", "")).not.toContain("{호칭}")
    expect(crisisMessage("plain", "손주")).not.toContain("손주")
  })
})

// ─────────────────────────────── 출력 스키마

describe("outputSchema", () => {
  it("모든 장의 스키마가 구조화 출력용 JSON Schema 형태다", () => {
    for (const c of CHAPTERS) {
      expect(c.outputSchema.type, c.id).toBe("object")
      expect(schemaErrors(c.outputSchema), c.id).toEqual([])
    }
  })

  it("유료 장은 불확실성 칸(caveat)을, 대부분의 장은 할 일·물음 칸을 가진다", () => {
    for (const c of CHAPTERS) {
      const props = Object.keys(c.outputSchema.properties as Record<string, unknown>)
      expect(props, c.id).toContain("caveat")
      expect(props, c.id).toContain("title")
    }
    const withTodo = CHAPTERS.filter((c) => "todo" in (c.outputSchema.properties as Record<string, unknown>)).length
    expect(withTodo).toBeGreaterThanOrEqual(CHAPTERS.length - 3)
  })

  it("근거 칩은 {letter, pos, label} 꼴이다", () => {
    for (const c of CHAPTERS) {
      const props = c.outputSchema.properties as Record<string, { items?: { properties?: Record<string, unknown> } }>
      if (!props.chips) continue
      expect(Object.keys(props.chips.items?.properties ?? {}), c.id).toEqual(["letter", "pos", "label"])
    }
  })

  it("마지막 말·점수·인용구 칸은 AI 출력에 없다", () => {
    for (const c of CHAPTERS) {
      const keys = allKeys(c.outputSchema)
      for (const bad of ["last_words", "quote", "score", "scores", "health", "luck"]) expect(keys, `${c.id}/${bad}`).not.toContain(bad)
    }
  })
})
