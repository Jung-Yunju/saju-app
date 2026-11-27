// 품질검증 — 무료 문안(content/free/*.json) 손계산 근거(십성·오행·정기·관계)를 규칙 엔진 analyzeRules 결과와 전수 대조
// 문안 수정은 콘텐츠 작가 몫. 이 테스트는 불일치 목록만 만든다.
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { analyzeRules, computeChart, type Pillar, type RuleAnalysis } from "@/engine"

const root = fileURLToPath(new URL("../../", import.meta.url))
const load = (f: string) => JSON.parse(readFileSync(`${root}content/free/${f}`, "utf8"))
const TEMPLATE = computeChart({ calendar: "solar", year: 1990, month: 5, day: 5, time: { hour: 10, minute: 0 }, timezone: "Asia/Seoul", gender: "M" })
const STEMS = "甲乙丙丁戊己庚辛壬癸", BRANCHES = "子丑寅卯辰巳午未申酉戌亥"
const JZ: Pillar[] = Array.from({ length: 60 }, (_, k) => ({ stem: STEMS[k % 10] as Pillar["stem"], branch: BRANCHES[k % 12] as Pillar["branch"] }))
const P = (s: string): Pillar => ({ stem: s[0] as Pillar["stem"], branch: s[1] as Pillar["branch"] })
const withStem = (s: string) => JZ.find((p) => p.stem === s)!
const FILLER = P("甲子")
function analyze(day: Pillar, opts: object = {}, seun?: Pillar, year: Pillar = FILLER): RuleAnalysis {
  const c = structuredClone(TEMPLATE)
  c.pillars = { year, month: FILLER, day, hour: null }
  c.hourKnown = false
  return analyzeRules(c, opts, seun ? { year: seun } : undefined)
}
/** 엔진으로 천간 오행 구하기: 그 천간을 일간으로 둔 원국의 dayMaster.element */
const engineStemElement = (s: string) => analyze(withStem(s)).dayMaster.element
const GROUP: Record<string, string> = { 비견: "비겁", 겁재: "비겁", 식신: "식상", 상관: "식상", 정재: "재성", 편재: "재성", 정관: "관성", 편관: "관성", 정인: "인성", 편인: "인성" }
const SEASON: Record<string, string> = { 寅: "봄", 卯: "봄", 辰: "봄", 巳: "여름", 午: "여름", 未: "여름", 申: "가을", 酉: "가을", 戌: "가을", 亥: "겨울", 子: "겨울", 丑: "겨울" } // rules-spec §2
const EL_KO: Record<string, string> = { wood: "목", fire: "화", earth: "토", metal: "금", water: "수" }

describe("day-pillar.json 60개 basis", () => {
  const d = load("day-pillar.json")
  it("일주 60개 전부, 중복 없음", () => {
    const ps = d.items.map((i: { pillar: string }) => i.pillar)
    expect(new Set(ps).size).toBe(60)
    expect([...ps].sort()).toEqual(JZ.map((p) => p.stem + p.branch).sort())
  })
  it("일지·일지 오행·정기·십성·계절 = 엔진(기본 옵션 byMainQi, main-only 정기)", () => {
    const bad: string[] = []
    for (const it_ of d.items) {
      const day = P(it_.pillar), b = it_.basis
      const a = analyze(day)
      const main = analyze(day, { hiddenStemTable: "main-only" }).hiddenStems.pillars.day[0].stem
      const tg = a.tenGods.find((t) => t.position.pillar === "day" && t.position.part === "branch" && !t.viaHiddenStem)!.tenGod
      const tgMain = a.tenGods.find((t) => t.position.pillar === "day" && t.viaHiddenStem === "jeonggi")!.tenGod
      const el = engineStemElement(main)
      const issues: string[] = []
      if (b.branch !== day.branch) issues.push(`branch ${b.branch}≠${day.branch}`)
      if (b.mainQi !== main) issues.push(`mainQi ${b.mainQi}≠${main}`)
      if (b.branchElement !== el) issues.push(`branchElement ${b.branchElement}≠${el}`)
      if (b.tenGod !== tg) issues.push(`tenGod ${b.tenGod}≠엔진 지지 십성 ${tg}`)
      if (b.tenGod !== tgMain) issues.push(`tenGod ${b.tenGod}≠엔진 정기 십성 ${tgMain}`)
      if (!String(b.season).includes(SEASON[day.branch]) || Object.values(SEASON).some((x) => x !== SEASON[day.branch] && String(b.season).includes(x))) issues.push(`season ${b.season} (일지 계절 ${SEASON[day.branch]})`)
      // 본문이 basis와 맞는지(검증용 칸과 보이는 문장의 일치)
      if (!it_.detail.includes(b.tenGod)) issues.push(`detail에 십성 '${b.tenGod}' 없음`)
      if (!it_.detail.includes(`(${EL_KO[el]})`)) issues.push(`detail에 오행 '(${EL_KO[el]})' 없음`)
      const otherTg = Object.keys(GROUP).filter((t) => t !== b.tenGod && it_.detail.includes(t))
      if (otherTg.length) issues.push(`detail에 다른 십성 ${otherTg} 언급(확인 필요)`)
      if (issues.length) bad.push(`${it_.pillar}: ${issues.join(" · ")}`)
    }
    console.log(`[day-pillar] 불일치 ${bad.length}건\n  ${bad.join("\n  ")}`)
    expect(bad).toEqual([])
  })
  it("byOrder로 바꾸면 子午巳亥 일지만 십성이 바뀜(notes 문구 확인)", () => {
    const changed = d.items.filter((i: { pillar: string; basis: { tenGod: string } }) => {
      const tg = analyze(P(i.pillar), { branchYinYang: "byOrder" }).tenGods.find((t) => t.position.pillar === "day" && t.position.part === "branch" && !t.viaHiddenStem)!.tenGod
      return tg !== i.basis.tenGod
    }).map((i: { pillar: string }) => i.pillar[1])
    expect([...new Set(changed)].sort().join("")).toBe([..."子午巳亥"].sort().join(""))
  })
})

describe("this-year.json 일간×연도 십성·관계", () => {
  const t = load("this-year.json")
  it("세운 천간·지지 정기 십성, 천간합·충, 일지 충·육합 = 엔진", () => {
    const bad: string[] = []
    const info: string[] = []
    for (const y of t.years) {
      const seun = P(y.ganzhi)
      const main = analyze(seun, { hiddenStemTable: "main-only" }).hiddenStems.pillars.day[0].stem
      if (y.basis.stem !== seun.stem || y.basis.branch !== seun.branch || y.basis.branchMainQi !== main) bad.push(`${y.year} basis ${JSON.stringify(y.basis)} 엔진 정기 ${main}`)
      if (y.byDayMaster.length !== 10) bad.push(`${y.year} 일간 ${y.byDayMaster.length}개`)
      for (const e of y.byDayMaster) {
        const a = analyze(withStem(e.stem), {}, seun)
        const s = a.tenGods.find((x) => x.position.pillar === "seun" && x.position.part === "stem")!.tenGod
        const b = a.tenGods.find((x) => x.position.pillar === "seun" && x.position.part === "branch")!.tenGod
        if (JSON.stringify(e.tenGods) !== JSON.stringify([s, b])) bad.push(`${y.year} ${e.stem}: 문안 ${e.tenGods} 엔진 [${s},${b}]`)
        const rel = a.interactions.filter((i) => i.scope === "luck" && (i.type === "stemCombine" || i.type === "stemClash") && i.members.some((m) => m.pillar === "day") && i.members.some((m) => m.pillar === "seun"))
          .map((i) => `${[...i.chars].sort((p, q) => STEMS.indexOf(p) - STEMS.indexOf(q)).join("")} ${i.type === "stemCombine" ? "천간합" : "천간충"}`)
        const listed = (e.interactions ?? []) as string[]
        if (JSON.stringify([...listed].sort()) !== JSON.stringify(rel.sort())) bad.push(`${y.year} ${e.stem}: 관계 문안 ${JSON.stringify(listed)} 엔진 ${JSON.stringify(rel)}`)
        for (const tg of [s, b]) if (!e.line.includes(tg) && !e.line.includes(GROUP[tg] ?? "")) info.push(`${y.year} ${e.stem}: line에 '${tg}' 없음`)
      }
      // 일지(dayBranch) 줄: 그 관계가 엔진에 실제로 있는지 + 엔진의 충·육합 중 빠진 일지
      const engineDB: string[] = []
      for (const br of BRANCHES) {
        const a = analyze(JZ.find((p) => p.branch === br)!, {}, seun)
        for (const i of a.interactions) if (i.scope === "luck" && (i.type === "clash" || i.type === "sixCombine") && i.members.some((m) => m.pillar === "day" && m.part === "branch") && i.members.some((m) => m.pillar === "seun"))
          engineDB.push(`${br}:${i.type}`)
      }
      const listedDB = (y.dayBranch ?? []).map((x: { branch: string; interaction: string }) => `${x.branch}:${/沖|冲/.test(x.interaction) ? "clash" : /合/.test(x.interaction) ? "sixCombine" : "?"}`)
      for (const x of listedDB) if (!engineDB.includes(x)) bad.push(`${y.year} dayBranch ${x}가 엔진 관계에 없음`)
      for (const x of engineDB) if (!listedDB.includes(x)) info.push(`${y.year} 엔진 일지 관계 ${x} 줄 없음`)
    }
    console.log(`[this-year] 불일치 ${bad.length}건\n  ${bad.join("\n  ")}\n[this-year] 참고 ${info.length}건\n  ${info.join("\n  ")}`)
    expect(bad).toEqual([])
  })
})

describe("elements.json 십성 묶음 표 groupByDayMasterElement 25칸", () => {
  const e = load("elements.json")
  it("일간 오행 × 대상 오행 → 묶음 = 엔진 십성의 묶음(양간·음간 일간 모두)", () => {
    const bad: string[] = []
    const repOf: Record<string, string> = {}
    for (const s of STEMS) repOf[`${engineStemElement(s)}:${"甲丙戊庚壬".includes(s) ? "yang" : "yin"}`] = s
    for (const [dmEl, row] of Object.entries(e.groupByDayMasterElement as Record<string, Record<string, string>>)) {
      for (const [tEl, group] of Object.entries(row)) {
        for (const yy of ["yang", "yin"]) {
          const dayStem = repOf[`${dmEl}:${yy}`]
          for (const tyy of ["yang", "yin"]) {
            const target = repOf[`${tEl}:${tyy}`]
            const a = analyze(withStem(dayStem), {}, undefined, withStem(target))
            const tg = a.tenGods.find((x) => x.position.pillar === "year" && x.position.part === "stem")!.tenGod
            if (GROUP[tg] !== group) bad.push(`${dmEl}→${tEl}: 문안 ${group} · 엔진 ${dayStem} 일간에 ${target} = ${tg}(${GROUP[tg]})`)
          }
        }
      }
      if (Object.keys(row).length !== 5) bad.push(`${dmEl} 행 칸 수 ${Object.keys(row).length}`)
    }
    if (Object.keys(e.groupByDayMasterElement).length !== 5) bad.push("행 수")
    for (const g of Object.values(e.groupByDayMasterElement as Record<string, Record<string, string>>).flatMap((r) => Object.values(r))) if (!e.tenGodGroups[g]) bad.push(`tenGodGroups에 ${g} 없음`)
    console.log(`[elements] 불일치 ${bad.length}건\n  ${bad.join("\n  ")}`)
    expect(bad).toEqual([])
  })
  it("비겁 lackNote(일간 자신이라 0개 불가)·counts 기준이 엔진과 맞음", () => {
    for (const s of STEMS) {
      const a = analyze(withStem(s))
      expect(a.elements.counts[a.dayMaster.element]).toBeGreaterThan(0)
      expect(Object.values(a.elements.counts).reduce((x, y) => x + y, 0)).toBe(6) // 시주 모름 = 여섯 글자({letters})
    }
  })
})
