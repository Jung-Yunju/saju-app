// P4-05 자동 채점 — 좋은 글과 바넘투성이 글이 기대대로 갈리는지. 가짜 견본(가상 인물)만 쓴다. AI·네트워크 호출 없음.
import { describe, expect, it } from "vitest"
import { mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { fixtureSet, factsFor, BIRTH_1, goodChapters1 } from "./fixtures"
import { isSampleFileName, loadSamplesDir, parseSample } from "../../scripts/qa/rubric/lib/load"
import { allowedCatchphrases, crossDuplication, scoreBatch, sentencesOf, specificityCap, voiceCap, type SampleScore } from "../../scripts/qa/rubric/lib/metrics"
import { renderAutoScoreMarkdown } from "../../scripts/qa/rubric/lib/report"
import { judgeSample, type Ratings } from "../../scripts/qa/rubric/lib/rubric"
import { runAutoScore } from "../../scripts/qa/rubric/auto-score"

const ALL5: Ratings = { accuracy: 5, specificity: 5, depth: 5, voice: 5, usefulness: 5, safety: 5, personalization: 5, fun: 5 }

const fx = fixtureSet()
const loaded = [...fx.good, ...fx.barnum].map((j) => parseSample(j, `${j.persona}.json`))
const batch = scoreBatch(loaded)
const by = (p: string): SampleScore => batch.samples.find((s) => s.persona === p)!

describe("좋은 글 2편 vs 바넘투성이 2편 — 한 묶음으로 채점", () => {
  for (const p of ["good-1", "good-2"]) {
    it(`${p}: 검증기 통과·근거 표지 높음·교차 중복 낮음·상한 높음`, () => {
      const s = by(p)
      expect(s.verify.ran).toBe(true)
      expect(s.verify.pass).toBe(true)
      expect(s.verify.counts).toEqual({ block: 0, warn: 0, info: 0 })
      expect(s.markers.narrative.ratio).toBeGreaterThanOrEqual(0.7)
      expect(s.crossDup!.ratio).toBeLessThanOrEqual(0.1)
      expect(s.caps).toMatchObject({ accuracy: 5, safety: 5, personalization: 5, autoFail: [] })
      expect(s.caps.specificity).toBeGreaterThanOrEqual(4)
      expect(s.caps.voice).toBeGreaterThanOrEqual(4)
      expect(s.repetition.catchphraseOveruse).toBe(0)
      expect(s.todos.marked).toBe(s.todos.chapters)
      expect(s.depth.every((d) => d.cause && d.use)).toBe(true)
    })
  }

  it("good-1: 사용자 사실을 출처와 함께 썼다(맞히기 아님)", () => {
    const s = by("good-1")
    expect(s.personal.mentions).toBeGreaterThanOrEqual(1)
    expect(s.personal.attributed).toBe(s.personal.mentions)
    expect(s.personal.noGuessUnattributed).toEqual([])
  })

  for (const p of ["barnum-1", "barnum-2"] as const) {
    it(`${p}: 근거 표지 0·인물 간 같은 문장·말버릇 남발 → 구체성·목소리 상한 낮음`, () => {
      const s = by(p)
      expect(s.markers.narrative.ratio).toBeLessThanOrEqual(0.1)
      expect(s.crossDup!.ratio).toBeGreaterThanOrEqual(0.8)
      expect(s.crossDup!.same).toBeGreaterThan(0)
      expect(s.caps.specificity).toBeLessThanOrEqual(2)
      expect(s.caps.voice).toBeLessThanOrEqual(3)
      expect(s.repetition.catchphraseOveruse).toBeGreaterThanOrEqual(2)
      expect(s.repetition.emphasis).toBeGreaterThanOrEqual(1)
      expect(s.repetition.endingRuns.length).toBeGreaterThanOrEqual(1)
      expect(s.repetition.phrases.length).toBeGreaterThanOrEqual(1)
      expect(s.verify.byCode.find((c) => c.code === "BARNUM")!.warn).toBeGreaterThanOrEqual(5)
      expect(s.todos.marked).toBe(0)
      expect(s.todos.duplicated).toBeGreaterThanOrEqual(2)
    })
    it(`${p}: 사용자가 말한 해(2019)를 맞히듯 씀 → 개인화 상한 3 이하`, () => {
      const s = by(p)
      expect(s.personal.noGuessUnattributed.length).toBeGreaterThanOrEqual(1)
      expect(s.verify.byCode.some((c) => c.code === "KNOWN_FACT_AS_PREDICTION")).toBe(true)
      expect(s.caps.personalization).toBeLessThanOrEqual(3)
    })
  }

  it("사람이 모두 5점을 줘도 상한 때문에 바넘 견본은 불합격, 좋은 견본은 합격", () => {
    for (const p of ["good-1", "good-2"]) expect(judgeSample(ALL5, by(p).caps).pass, p).toBe(true)
    for (const p of ["barnum-1", "barnum-2"]) {
      const j = judgeSample(ALL5, by(p).caps)
      expect(j.pass, p).toBe(false)
      expect(j.reasons.join(" ")).toMatch(/구체성/)
      expect(j.final.specificity).toBeLessThanOrEqual(2)
    }
  })

  it("좋은 글 끼리는 거의 같은 문장이 없다(틀 문장만 소수) / 바넘 끼리는 같은 문장", () => {
    const g = batch.crossDup.personas.filter((x) => x.persona.startsWith("good"))
    for (const x of g) expect(x.same).toBe(0)
    const pair = batch.crossDup.pairs.find((x) => x.a === "barnum-1" && x.b === "barnum-2")!
    expect(pair.ratioAtoB).toBeGreaterThanOrEqual(0.8)
    const gb = batch.crossDup.pairs.find((x) => x.a === "good-1" && x.b === "barnum-1")!
    expect(gb.ratioAtoB).toBeLessThanOrEqual(0.05)
  })

  it("같은 입력이면 같은 결과·같은 보고서(결정론)", () => {
    const again = scoreBatch([...fx.good, ...fx.barnum].map((j) => parseSample(j, `${j.persona}.json`)))
    expect(JSON.stringify(again)).toBe(JSON.stringify(batch))
    const m1 = renderAutoScoreMarkdown(batch, { folder: "x", skipped: [] })
    const m2 = renderAutoScoreMarkdown(again, { folder: "x", skipped: [] })
    expect(m1).toBe(m2)
    expect(m1).toMatch(/## 요약/)
    expect(m1).toMatch(/## 인물 간 문장 중복/)
  })
})

describe("검증기 block이 상한·자동 불합격으로 이어진다", () => {
  const facts = factsFor(BIRTH_1)
  it("원국에 없는 글자(子)를 근거로 쓰면 정확성 상한 2 + 자동 불합격", () => {
    const chs = goodChapters1()
    ;(chs[0].output as { body: string[] }).body.push("일지 자(子)가 너를 차갑게 식힌다.")
    const s = scoreBatch([parseSample({ persona: "bad-letter", facts, chapters: chs }, "x.json")]).samples[0]
    expect(s.verify.accuracy.block).toBeGreaterThanOrEqual(1)
    expect(s.caps.accuracy).toBe(2)
    expect(s.caps.autoFail.join(" ")).toMatch(/정확성 block/)
  })
  it("병·시기 예언이 있으면 안전 상한 1 + 자동 불합격", () => {
    const chs = goodChapters1()
    ;(chs[2].output as { body: string[] }).body.push("2031년 신해(辛亥)년에 큰 병에 걸린다.")
    const s = scoreBatch([parseSample({ persona: "bad-safety", facts, chapters: chs }, "x.json")]).samples[0]
    expect(s.verify.safety.block).toBeGreaterThanOrEqual(1)
    expect(s.caps.safety).toBe(1)
    expect(judgeSample(ALL5, s.caps).pass).toBe(false)
  })
  it("장 생성 실패가 있으면 자동 불합격", () => {
    const chs = [...goodChapters1(), { id: "people", ok: false, error: "max_tokens", attempts: 3 }]
    const s = scoreBatch([parseSample({ persona: "half", facts, chapters: chs }, "x.json")]).samples[0]
    expect(s.caps.autoFail.join(" ")).toMatch(/장 생성 실패 1개\(people\)/)
  })
  it("사실표가 없으면 정확성·안전은 미검증(null) — 합격 판정 불가", () => {
    const s = scoreBatch([parseSample({ persona: "nofacts", chapters: goodChapters1() }, "x.json")]).samples[0]
    expect(s.verify.ran).toBe(false)
    expect(s.caps.accuracy).toBeNull()
    expect(s.caps.safety).toBeNull()
    expect(judgeSample(ALL5, s.caps).pass).toBe(false)
  })
  it("파이프라인이 저장한 verify.pass와 재검증이 다르면 표시", () => {
    const chs = goodChapters1()
    ;(chs[0].output as { body: string[] }).body.push("일지 자(子)가 너를 차갑게 식힌다.")
    chs[0].verify = { pass: true, findings: [] }
    const s = scoreBatch([parseSample({ persona: "stored", facts, chapters: chs }, "x.json")]).samples[0]
    expect(s.verify.storedMismatch).toEqual(["nature"])
  })
})

describe("부품", () => {
  it("말버릇 허락 횟수는 장 명세(콘텐츠 작가)에서 읽는다", () => {
    const s = parseSample(fx.good[0], "g.json")
    const nature = allowedCatchphrases("nature", s)!
    expect(nature.get("어디 보자.")).toBe(1)
    expect(nature.get("글자는 생김새다. 쓰는 건 너다.")).toBe(1)
    const money = allowedCatchphrases("money", s)!
    expect(money.get("글자는 생김새다. 쓰는 건 너다.")).toBeUndefined()
    expect(allowedCatchphrases("no-such-chapter", s)).toBeNull()
  })

  it("틀 문장(간지·십성만 바꿔 끼움)을 잡는다, 짧은 문장은 뺀다", () => {
    const mk = (persona: string, body: string[]) => ({ persona, recs: sentencesOf(parseSample({ persona, chapters: [{ id: "c", ok: true, output: { body } }] }, "x.json")) })
    const r = crossDuplication([
      mk("a", ["일지 유(酉)가 편관이라 속에 늘 자를 대고 사는 사람이다.", "좋다."]),
      mk("b", ["일지 오(午)가 겁재라 속에 늘 자를 대고 사는 사람이다.", "좋다."]),
    ])
    expect(r.ran).toBe(true)
    expect(r.personas[0]).toMatchObject({ sentences: 1, same: 0, template: 1 })
    expect(r.examples[0].kind).toBe("template")
  })

  it("인물이 한 명이면 교차 중복은 미검증, 구체성은 표지만으로", () => {
    const s = scoreBatch([parseSample(fx.good[0], "g.json")]).samples[0]
    expect(s.caps.specificBasis).toBe("marker-only")
    expect(s.crossDup).toBeUndefined()
  })

  it("상한 문턱", () => {
    expect([0.85, 0.8, 0.79, 0.65, 0.5, 0.35, 0.34, 0].map(specificityCap)).toEqual([5, 5, 4, 4, 3, 2, 1, 1])
    expect([0, 1, 2, 3, 5, 6, 9, 10, 50].map(voiceCap)).toEqual([5, 4, 4, 3, 3, 2, 2, 1, 1])
  })

  it("견본 파일 이름 거르기 — 산출물·경쟁사 이름 파일은 읽지 않는다", () => {
    for (const n of ["p01.json", "persona-a.json"]) expect(isSampleFileName(n), n).toBe(true)
    for (const n of ["auto-score.json", "blind-key.json", "blind-scores-1.json", "competitor-a.json", "경쟁사.json", "_draft.json", ".x.json", "p01.md"]) expect(isSampleFileName(n), n).toBe(false)
  })

  it("느슨한 입력 모양(results·run.chapters·persona 객체)", () => {
    const a = parseSample({ persona: { id: "pp" }, factSheet: fx.good[0].facts, run: { chapters: fx.good[0].chapters } }, "z.json")
    expect(a.persona).toBe("pp")
    expect(a.facts).toBeDefined()
    expect(a.chapters.length).toBe(3)
    const b = parseSample({ results: [{ id: "x", output: { body: ["a"] } }] }, "q.json")
    expect(b.persona).toBe("q")
    expect(b.problems.join(" ")).toMatch(/사실표/)
    expect(parseSample([1, 2], "r.json").problems[0]).toMatch(/객체가 아님/)
  })
})

describe("실행(파일 입출력)", () => {
  const dir = mkdtempSync(join(tmpdir(), "qa-rubric-"))
  const day = join(dir, "2026-11-28")
  mkdirSync(day)
  for (const j of [...fx.good, ...fx.barnum]) writeFileSync(join(day, `${j.persona}.json`), JSON.stringify(j))
  writeFileSync(join(day, "blind-key.json"), "{}")
  writeFileSync(join(day, "competitor-x.json"), JSON.stringify({ chapters: [{ id: "c", output: { body: ["원문"] } }] }))
  writeFileSync(join(day, "broken.json"), "{ not json")

  it("폴더를 읽어 auto-score.md(+json)를 쓴다, 견본 아닌 파일은 건너뛴다", () => {
    const { batch: b, outPath } = runAutoScore({ dir: day, json: true })
    expect(outPath).toBe(join(day, "auto-score.md"))
    expect(b.samples.map((s) => s.persona)).toEqual(["barnum-1", "barnum-2", "good-1", "good-2"])
    const md = readFileSync(outPath, "utf8")
    expect(md).toMatch(/broken\.json/)
    expect(md).not.toMatch(/원문/)
    expect(existsSync(join(day, "auto-score.json"))).toBe(true)
    expect(loadSamplesDir(day).skipped.map((s) => s.file).sort()).toEqual(["auto-score.json", "blind-key.json", "broken.json", "competitor-x.json"])
  })

  it("명령줄 실행(vite-node)도 같은 파일을 만든다", () => {
    const root = resolve(__dirname, "../..")
    const out = join(dir, "cli.md")
    const r = spawnSync(resolve(root, "node_modules/.bin/vite-node"), [resolve(root, "scripts/qa/rubric/auto-score.ts"), day, "--out", out], { cwd: root, encoding: "utf8" })
    expect(r.status, r.stderr).toBe(0)
    expect(r.stdout).toMatch(/자동 채점 4편/)
    expect(readFileSync(out, "utf8")).toBe(readFileSync(join(day, "auto-score.md"), "utf8"))
  }, 60_000)
})
