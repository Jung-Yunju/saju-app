// 새 엔진 · AI 입력(saju-input) · 결과 화면 표시 · 규칙 엔진 · 검증기 글자 집합이 같은 글자를 쓰는지 회귀 확인
// scripts/qa/legacy-engine-audit.sh(옛 src/lib/saju.ts ↔ saju-input.ts 비교, @/engine 별칭 도입 후 컴파일 불가)를 대체한다.
// 실행: npx vitest run tests/verify/consistency.test.ts
import { describe, expect, it } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { analyzeRules, computeChart, EngineInputError, type BirthInput, type Pillar } from "@/engine"
import { buildChartLetters, verifyReading } from "@/engine/verify"
import { buildSajuInput, resolveDisplaySaju } from "@/lib/saju-input"
import { NOW } from "./fixtures"

const ROOT = process.cwd()
const gz = (p: Pillar | null) => (p ? p.stem + p.branch : undefined)
const H = "甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥"
const K = "갑을병정무기경신임계자축인묘진사오미신유술해"
const ko = (s: string) => [...s].map((c) => K[H.indexOf(c)]).join("")

/** 결정론적 표본(1900~2100, 양력·음력, 시각 있음·모름, 남·여) */
function samples(n: number) {
  let seed = 4042026
  const rnd = (m: number) => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed % m
  }
  const out: { y: number; m: number; d: number; h: number | null; g: "M" | "F"; cal: "SOLAR" | "LUNAR" }[] = []
  while (out.length < n) {
    out.push({
      y: 1900 + rnd(201),
      m: 1 + rnd(12),
      d: 1 + rnd(28),
      h: rnd(5) === 0 ? null : rnd(24),
      g: rnd(2) === 0 ? "M" : "F",
      cal: rnd(4) === 0 ? "LUNAR" : "SOLAR",
    })
  }
  return out
}

describe("엔진 ↔ AI 입력 ↔ 화면 ↔ 규칙 엔진 ↔ 검증기 (표본 400건)", () => {
  it("모든 경로가 같은 글자", () => {
    const problems: string[] = []
    let checked = 0
    for (const s of samples(420)) {
      let input
      try {
        input = buildSajuInput(s.y, s.m, s.d, s.h, s.g, s.cal, undefined, false, { now: NOW })
      } catch (e) {
        if (e instanceof EngineInputError) continue
        throw e
      }
      checked++
      const label = `${s.cal} ${s.y}-${s.m}-${s.d} ${s.h}시 ${s.g}`
      const bi: BirthInput = {
        calendar: s.cal === "LUNAR" ? "lunar" : "solar", year: s.y, month: s.m, day: s.d, isLeapMonth: false,
        time: s.h === null ? null : { hour: s.h, minute: 0 }, timezone: "Asia/Seoul", gender: s.g,
      }
      const chart = computeChart(bi)
      // ① 엔진 = AI 입력
      const ai = [input.pillars.year, input.pillars.month, input.pillars.day, input.pillars.hour]
      const eng = [gz(chart.pillars.year), gz(chart.pillars.month), gz(chart.pillars.day), gz(chart.pillars.hour)]
      if (ai.join() !== eng.join()) problems.push(`${label} 엔진 ${eng} / AI ${ai}`)
      const daeunEng = chart.luck.daeun.slice(0, 8).map((d) => `${gz(d.pillar)}@${d.startYear}/${d.startAge}`)
      const daeunAi = input.daeun.map((d) => `${d.ganzhi}@${d.start_year}/${d.start_age}`)
      if (daeunEng.join() !== daeunAi.join()) problems.push(`${label} 대운 엔진 ${daeunEng} / AI ${daeunAi}`)
      if (input.hour_unknown !== !chart.hourKnown) problems.push(`${label} hour_unknown`)
      // ② 화면 표시(저장값 경로·재계산 경로) = AI 입력
      const aiKo = ai.filter((x): x is string => !!x).map(ko).join()
      const birth = { birthYear: s.y, birthMonth: s.m, birthDay: s.d, birthHour: s.h, gender: s.g, calType: s.cal }
      const shownStored = resolveDisplaySaju({ sajuInput: input, ...birth })
      const shownEngine = resolveDisplaySaju({ sajuInput: null, ...birth })
      if (shownStored.source !== "stored" || shownStored.pillars.map((p) => p.stem + p.branch).join() !== aiKo) problems.push(`${label} 화면(저장값)`)
      if (shownEngine.source !== "engine" || shownEngine.pillars.map((p) => p.stem + p.branch).join() !== aiKo) problems.push(`${label} 화면(재계산)`)
      // ③ 규칙 엔진이 보는 원국 = AI 입력
      const rules = analyzeRules(chart)
      const rs = rules.source.natal
      if ([gz(rs.year), gz(rs.month), gz(rs.day), gz(rs.hour)].join() !== ai.join()) problems.push(`${label} 규칙 엔진 source`)
      // ④ 검증기 글자 집합: 원국 4기둥 + 대운 8 + 올해가 모두 허용, 일간 일치
      const letters = buildChartLetters(input)
      if (letters.problems.length) problems.push(`${label} 검증기 입력 오류 ${letters.problems}`)
      for (const g of [...ai.filter((x): x is string => !!x), ...input.daeun.map((d) => d.ganzhi), input.this_year_ganzhi])
        if (!letters.pillars.has(g)) problems.push(`${label} 검증기에 ${g} 없음`)
      if (letters.dayStem !== rules.dayMaster.stem) problems.push(`${label} 일간 불일치`)
      if (problems.length > 10) break
    }
    expect(problems).toEqual([])
    expect(checked).toBeGreaterThanOrEqual(400)
  })

  it("검증기: 원국·대운·올해만 인용한 문장은 통과, 그 밖의 기둥은 차단 (표본 100건)", () => {
    let n = 0
    for (const s of samples(120)) {
      let input
      try {
        input = buildSajuInput(s.y, s.m, s.d, s.h, s.g, s.cal, undefined, false, { now: NOW })
      } catch (e) {
        if (e instanceof EngineInputError) continue
        throw e
      }
      n++
      const natal = [input.pillars.year, input.pillars.month, input.pillars.day, input.pillars.hour].filter((x): x is string => !!x)
      const cur = input.daeun[2]
      const ok = { parts: [{ title: "", chapters: [{ key: "k", title: "", sub: "", chips: [], body: [`원국은 ${natal.join(" ")}이다. ${cur.start_year}년부터 ${cur.ganzhi} 대운이고 올해는 ${input.this_year_ganzhi}다.`], todo: "", ask: "" }] }] }
      const okBasis = verifyReading(ok, { sajuInput: input }).findings.filter((f) => f.code === "BASIS_NOT_IN_CHART" || f.code === "YEAR_GANZHI_MISMATCH")
      expect(okBasis, JSON.stringify([input.pillars, okBasis])).toEqual([])
      // 원국·대운·올해 어디에도 없는 기둥 하나를 골라 넣으면 차단
      const allowed = new Set([...natal, ...input.daeun.map((d) => d.ganzhi), input.this_year_ganzhi])
      let fake = ""
      for (let i = 0; i < 60 && !fake; i++) {
        const g = "甲乙丙丁戊己庚辛壬癸"[i % 10] + "子丑寅卯辰巳午未申酉戌亥"[i % 12]
        if (!allowed.has(g)) fake = g
      }
      const bad = { parts: [{ title: "", chapters: [{ key: "k", title: "", sub: "", chips: [], body: [`${fake} 일주라 그렇다.`], todo: "", ask: "" }] }] }
      expect(verifyReading(bad, { sajuInput: input }).findings.some((f) => f.code === "BASIS_NOT_IN_CHART" && f.severity === "block"), fake).toBe(true)
    }
    expect(n).toBeGreaterThanOrEqual(100)
  })
})

describe("결과 화면 표시 경로가 옛 계산 코드를 쓰지 않는다(정적 확인)", () => {
  const files: string[] = []
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(ts|tsx)$/.test(f)) files.push(p)
    }
  }
  walk(join(ROOT, "src/app"))

  it("src/app 아래 어떤 파일도 @/lib/saju(옛 화면 계산)·@/lib/generate-reading(옛 v1)을 가져오지 않는다", () => {
    const offenders = files.filter((f) => /from\s+["']@\/lib\/(saju|generate-reading)["']/.test(readFileSync(f, "utf8"))).map((f) => relative(ROOT, f))
    expect(offenders).toEqual([])
  })
  it("결과 화면(page.tsx)은 resolveDisplaySaju로 원국을 만든다", () => {
    const page = readFileSync(join(ROOT, "src/app/reading/[id]/page.tsx"), "utf8")
    expect(page).toMatch(/import\s*\{\s*resolveDisplaySaju\s*\}\s*from\s*["']@\/lib\/saju-input["']/)
    expect(page).toMatch(/resolveDisplaySaju\(reading\)/)
  })
  it("결과 화면은 본문(body)만 sanitizeBoldHtml을 거쳐 HTML로 넣는다(UNSAFE_HTML 검사의 전제)", () => {
    const viewer = readFileSync(join(ROOT, "src/app/reading/[id]/ReadingViewer.tsx"), "utf8")
    const uses = viewer.match(/dangerouslySetInnerHTML=\{\{\s*__html:\s*([^}]+)\}\}/g) ?? []
    expect(uses.length).toBeGreaterThan(0)
    for (const u of uses) expect(u).toMatch(/sanitizeBoldHtml\(/)
  })
  it("옛 감사 스크립트에는 폐기 안내와 대체 경로가 적혀 있다", () => {
    const sh = readFileSync(join(ROOT, "scripts/qa/legacy-engine-audit.sh"), "utf8")
    expect(sh).toContain("폐기")
    expect(sh).toContain("tests/verify/consistency.test.ts")
  })
})
