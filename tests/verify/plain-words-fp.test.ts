// verify@0.3.1 — 그림 말 사전 전수 오탐 점검(결함 QA-FV-1 후속) — 담당: 품질검증
// 콘텐츠 프롬프트(src/engine/content/prompts/plain-words.ts)는 丁을 "등불", 午를 "한낮의 불", 子를 "찬물"처럼 부르게 한다.
// 사전의 모든 그림 말(문구 전체 + 끝 낱말 1·2개 + "와/과·, " 로 나뉜 조각 + 띠 동물)을
// 시기 표지(2027년)가 붙은 중립 문장 틀에 넣어 FORBIDDEN_TOPIC(죽음·질병·병명·이혼·파산·사고 + 사전 규칙)이 하나도 나지 않는지 본다.
// 틀의 뒷말은 사고 패턴 활용형(나·난·날·남·납·났 …)과 첫 음절이 겹치는 중립 낱말을 일부러 고른다(나란히·날마다·남는다·나무 …).
import { describe, expect, it } from "vitest"
import { verifyReading } from "@/engine/verify"
import { findHarms } from "@/engine/verify/harm"
import { BRANCH_PICTURE, POSITION_PICTURE, RELATION_PICTURE, STEM_PICTURE, TENGOD_PICTURE } from "@/engine/content/prompts/plain-words"
import { readingOf, SAJU_MIN } from "./helpers"

const hasBatchim = (w: string) => {
  const c = w.charCodeAt(w.length - 1) - 0xac00
  return c >= 0 && c <= 11171 && c % 28 !== 0
}
const j = (w: string, withB: string, without: string) => w + (hasBatchim(w) ? withB : without)

/** 사전 문구 → 점검할 낱말 묶음 */
function termsOf(phrase: string): string[] {
  const out = new Set<string>()
  const clean = phrase.replace(/\([^)]*\)/g, "").trim()
  for (const piece of clean.split(/\s—\s|,\s/)) {
    const p = piece.trim()
    if (!p) continue
    out.add(p)
    const words = p.split(/\s+/)
    out.add(words[words.length - 1]!)
    if (words.length >= 2) out.add(words.slice(-2).join(" "))
    // "산과 둑", "돈과 살림", "배움과 돌봄" → 산·둑 …
    for (const w of p.split(/(?<=[가-힣])(?:과|와)\s/)) {
      const ws = w.trim().split(/\s+/)
      out.add(ws[ws.length - 1]!)
    }
  }
  return [...out].filter((t) => t.length > 0)
}

const PHRASES: string[] = [
  ...Object.values(STEM_PICTURE),
  ...Object.values(BRANCH_PICTURE).flatMap((b) => [b.picture, b.animal]),
  ...Object.values(TENGOD_PICTURE),
  ...Object.values(RELATION_PICTURE),
  ...Object.values(POSITION_PICTURE),
]
const TERMS = [...new Set(PHRASES.flatMap(termsOf))]

/** 중립 문장 틀(시기 표지 포함 — 시기가 붙으면 가장 엄하게 판정되므로) */
const TEMPLATES: ((t: string) => string)[] = [
  (t) => `2027년엔 같은 ${j(t, "이", "가")} 나란히 선다.`,
  (t) => `2027년엔 ${j(t, "이", "가")} 나란히 서는 해다.`,
  (t) => `2027년엔 ${j(t, "이", "가")} 날마다 곁을 비춘다.`,
  (t) => `2027년엔 ${j(t, "이", "가")} 남는다.`,
  (t) => `2027년엔 ${j(t, "이", "가")} 나무를 키운다.`,
  (t) => `2027년엔 ${j(t, "이", "가")} 나와 함께 선다.`,
  (t) => `2027년엔 ${j(t, "이", "가")} 납작 엎드린다.`,
  (t) => `2027년엔 ${j(t, "이", "가")} 나서서 길을 연다.`,
  (t) => `2027년엔 ${j(t, "이", "가")} 제 몫을 다한다.`,
  (t) => `2027년엔 ${j(t, "은", "는")} 더 밝아진다.`,
  (t) => `2027년엔 ${j(t, "을", "를")} 만난다.`,
  (t) => `2027년엔 ${j(t, "을", "를")} 보는 해다.`,
  (t) => `2027년엔 ${j(t, "과", "와")} 같은 글자가 들어온다.`,
  (t) => `2027년엔 ${t}에 기대어 간다.`,
  (t) => `2027년엔 ${t}의 기운이 세진다.`,
  (t) => `2027년엔 ${t}도 쉬어 간다.`,
  (t) => `2027년엔 ${t} 같은 너도 바빠진다.`,
  (t) => `2027년엔 ${j(t, "으로", "로")} 버틴다.`,
  (t) => `2027년엔 ${j(t, "이", "가")} 날개를 단다.`,
  (t) => `2027년엔 ${j(t, "이", "가")} 난로처럼 데운다.`,
  (t) => `2027년엔 ${j(t, "이", "가")} 나아간다.`,
  (t) => `2027년엔 ${j(t, "이", "가")} 나눠 준다.`,
  (t) => `2027년엔 ${j(t, "이나", "나")} 쇠나 다 쓴다.`,
  (t) => `2027년엔 ${j(t, "이", "가")} 나란히 앉아 남는 해다.`,
]

describe("그림 말 사전 × 금지 주제 패턴: 오탐 0 (verify@0.3.1, QA-FV-1)", () => {
  it(`사전 낱말 ${TERMS.length}개 × 문장 틀 ${TEMPLATES.length}개 — FORBIDDEN_TOPIC 0건`, () => {
    const bad: string[] = []
    for (const t of TERMS)
      for (const tpl of TEMPLATES) {
        const s = tpl(t)
        const r = verifyReading(readingOf(s), { sajuInput: SAJU_MIN })
        for (const f of r.findings) if (f.code === "FORBIDDEN_TOPIC") bad.push(`${f.severity}/${f.rule}: ${s}`)
      }
    expect(bad).toEqual([])
  })

  it("사전 문구 그대로(틀 없이)도 해로운 사건으로 잡히지 않는다", () => {
    const hits = PHRASES.flatMap((p) => findHarms(p).map((h) => `${h.cat}: ${p}`))
    expect(hits).toEqual([])
  })

  it("실제 문안 재현: '같은 등불이 나란히 서고' (QA-FV-1)", () => {
    const r = verifyReading(readingOf("2027년엔 등불인 너 곁에 같은 등불이 나란히 서고 늦여름 흙이 손을 바쁘게 한다."), { sajuInput: SAJU_MIN })
    expect(r.findings.filter((f) => f.code === "FORBIDDEN_TOPIC")).toEqual([])
  })
})

describe("경계를 좁혀도 진짜 사고 예언은 그대로 막는다", () => {
  const blocked = (s: string) =>
    verifyReading(readingOf(s), { sajuInput: SAJU_MIN }).findings.some((f) => f.severity === "block" && f.code === "FORBIDDEN_TOPIC" && f.rule === "accident")
  it.each([
    "2027년에 집에 불이 난다.",
    "2027년엔 불이 날 수 있다.",
    "2027년에 불이 나서 다 탄다.",
    "2027년엔 산불이 난다.",
    "2027년엔 큰불이 난다.",
    "2027년엔 불이난다.",
    "2027년엔 가게에 불이 나는 해다.",
    "2027년엔 공장에 불이 나고 사람이 다친다.",
    "2027년엔 물에 빠진다.",
    "2027년엔 강물에 빠진다.",
  ])("block: %s", (s) => {
    expect(blocked(s)).toBe(true)
  })
})

describe("verify@0.3.1 — '같은 일' 주제어 면제 좁힘 · '대신 내리지 않는다' 메타 서술", () => {
  const forb = (s: string) => verifyReading(readingOf(s), { sajuInput: SAJU_MIN }).findings.filter((f) => f.code === "FORBIDDEN_TOPIC" && f.severity === "block")
  it.each(["2027년에 이혼 같은 일이 생긴다.", "2027년엔 파산 같은 일을 겪는다.", "2027년엔 교통사고 같은 일이 닥친다."])("block: %s", (s) => {
    expect(forb(s).length).toBeGreaterThan(0)
  })
  it.each(["이혼 같은 일은 할미가 말하지 않는다.", "이혼 같은 말은 믿지 마라.", "할미는 퇴사나 이혼 같은 결정을 대신 내리지 않는다.", "퇴사·이혼·투자·이사 같은 결정을 대신 내리지 않는다."])("통과: %s", (s) => {
    expect(forb(s)).toEqual([])
  })
})
