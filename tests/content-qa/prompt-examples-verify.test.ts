// 품질검증 — 프롬프트 예문 → 검증기(verify@0.3.1) 회귀. 고객 화면에 그대로 나가거나 AI가 따라 쓰는 문장이 검증기에 막히지 않는지 본다.
// 대상 ① 페르소나 고정 문구(마지막 말·틀릴 수 있음 안내·마음 무거운 사람 문장·말버릇·사연·위기 문안)
//      ② 프롬프트 파일에서 "예:"·"예)"·"예문" 뒤 따옴표 예문 ③ 그림 말 사전 문구 전체
//   → block 0.
// 넓은 훑기: 프롬프트 파일의 따옴표 한글 전체(지시문·금지어 목록 포함). block이 난 것은 아래 EXPECTED_BLOCK(금지어 목록이라 막혀야 맞는 것,
//   또는 고객 문장이 아닌 지시문)에만 있어야 한다. 새 block이 생기면 오탐인지 확인하고 이 목록이나 검증기를 고친다.
import { describe, expect, it } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { verifyReading, type VerifyReport } from "@/engine/verify"
import { CATCHPHRASES, HEAVY_HEART_LINE, LAST_WORDS, PERSONA_BACKSTORY, RELIABILITY_NOTICE, crisisMessage } from "@/engine/content/prompts/persona"
import { BRANCH_PICTURE, POSITION_PICTURE, RELATION_PICTURE, STEM_PICTURE, TENGOD_PICTURE } from "@/engine/content/prompts/plain-words"

const dir = fileURLToPath(new URL("../../src/engine/content/prompts/", import.meta.url))
const files = [...readdirSync(dir).filter((f) => f.endsWith(".ts")).map((f) => dir + f), ...readdirSync(dir + "chapters").filter((f) => f.endsWith(".ts")).map((f) => dir + "chapters/" + f)]
const sources = files.map((f) => ({ f: f.slice(dir.length), src: readFileSync(f, "utf8").replace(/\\"/g, '"') }))
const QUOTE = /"([^"\n]{2,400})"|'([^'\n]{2,400})'|“([^”\n]{2,400})”/g

const run = (q: string): VerifyReport =>
  verifyReading(
    { parts: [{ title: "예문", chapters: [{ title: "예문", body: [q] }] }] },
    { sajuInput: { pillars: { year: "甲子", month: "丙寅", day: "乙酉" }, hour_unknown: true, this_year: 2026, this_year_ganzhi: "丙午" } },
  )
/** 글자 대조(BASIS·간지·십성)는 예문이 가상의 원국을 쓰므로 뺀다 — 여기서는 금지 주제·도덕 판정·과학 주장·고전 인용·HTML만 본다 */
const CHART_CODES = new Set(["BASIS_NOT_IN_CHART", "YEAR_GANZHI_MISMATCH", "TENGOD_MISMATCH", "MALFORMED_READING"])
const blocksOf = (q: string) => run(q).findings.filter((x) => x.severity === "block" && !CHART_CODES.has(x.code)).map((x) => `${x.code}/${x.rule ?? ""}`)

function exampleQuotes(): string[] {
  const out: string[] = []
  for (const { src } of sources)
    for (const m of src.matchAll(/예(?:문)?\s?[:：)]\s*([^\n]{0,400})/g))
      for (const q of m[1]!.matchAll(QUOTE)) {
        const t = q[1] ?? q[2] ?? q[3]
        if (t && /[가-힣]{2}/.test(t)) out.push(t)
      }
  return [...new Set(out)]
}

const FIXED = [
  ...Object.values(LAST_WORDS),
  ...Object.values(RELIABILITY_NOTICE),
  ...Object.values(HEAVY_HEART_LINE),
  ...Object.values(CATCHPHRASES),
  PERSONA_BACKSTORY,
  crisisMessage("halmi", "손주"),
  crisisMessage("plain"),
]
const PICTURES = [
  ...Object.values(STEM_PICTURE),
  ...Object.values(BRANCH_PICTURE).map((b) => `${b.picture}(${b.animal})`),
  ...Object.values(TENGOD_PICTURE),
  ...Object.values(RELATION_PICTURE),
  ...Object.values(POSITION_PICTURE),
]

describe("프롬프트 예문 → 검증기: block 0", () => {
  it("페르소나 고정 문구", () => {
    expect(FIXED.flatMap((q) => blocksOf(q).map((b) => `${b}: ${q}`))).toEqual([])
  })
  it("프롬프트의 '예:' 따옴표 예문", () => {
    const qs = exampleQuotes()
    expect(qs.length).toBeGreaterThan(10)
    expect(qs.flatMap((q) => blocksOf(q).map((b) => `${b}: ${q}`))).toEqual([])
  })
  it("그림 말 사전 문구", () => {
    expect(PICTURES.flatMap((q) => blocksOf(q).map((b) => `${b}: ${q}`))).toEqual([])
  })
})

/** 프롬프트가 "쓰지 마라"고 적어 둔 금지어 목록 — 검증기가 막아야 맞다 */
const EXPECTED_BLOCK: Record<string, string> = {
  "검증된 예측": "SCIENTIFIC_CLAIM/",
  "여자가 기가 세다": "GENDER_STEREOTYPE/gender-trait",
  현모양처: "GENDER_STEREOTYPE/woman-role",
  "팔자가 세다": "MORAL_JUDGEMENT/fate-eval",
  박복하다: "MORAL_JUDGEMENT/fate-strong",
  "과부 팔자": "MORAL_JUDGEMENT/spouse-luck",
  바람기: "MORAL_JUDGEMENT/lust",
  "부모 덕이 없다": "MORAL_JUDGEMENT/relation-luck",
  "말띠 여자는 드세다": "GENDER_STEREOTYPE/gender-trait",
  "고전에 따르면": "FAKE_CLASSIC_QUOTE/generic-source-saying",
}
/** 고객 문장이 아닌 AI 지시문(장 명세 tasks)인데 검증기에 걸리는 것 — 오탐 후보로 기록(QA 관찰, verify@0.3.1 보고) */
// (basic.ts crossroads "퇴사·이혼·투자·이사 같은 결정을 대신 내리지 않는다"는 verify@0.3.1에서 '대신 내리지 않는다'를 메타 서술로 보게 해 풀렸다)
const INSTRUCTION_BLOCK: RegExp[] = [/^상대의 속마음, 결혼·이별의 시기, 궁합 점수는 쓰지 않는다/]

describe("프롬프트 파일 따옴표 한글 전체 훑기", () => {
  it("block은 금지어 목록·지시문에서만 난다", () => {
    const all = new Set<string>()
    for (const { src } of sources)
      for (const m of src.matchAll(QUOTE)) {
        const t = m[1] ?? m[2] ?? m[3]
        if (t && /[가-힣]/.test(t)) all.add(t)
      }
    expect(all.size).toBeGreaterThan(300)
    const unexpected: string[] = []
    const seenForbidden = new Set<string>()
    for (const q of all) {
      const b = blocksOf(q)
      if (!b.length) continue
      if (EXPECTED_BLOCK[q] !== undefined) {
        expect(b).toContain(EXPECTED_BLOCK[q])
        seenForbidden.add(q)
        continue
      }
      if (INSTRUCTION_BLOCK.some((re) => re.test(q))) {
        process.stderr.write(`[qa] 지시문 block(오탐 후보): ${b.join(",")}: ${q.slice(0, 60)}\n`)
        continue
      }
      unexpected.push(`${b.join(",")}: ${q.slice(0, 80)}`)
    }
    expect(unexpected).toEqual([])
    // 금지어 목록이 프롬프트에서 사라지면 알린다(목록을 같이 정리할 것)
    expect([...seenForbidden].sort()).toEqual(Object.keys(EXPECTED_BLOCK).sort())
  })
})
