// P4-05 블라인드 채점 시트 — A/B 섞기·결정론·경쟁사 원문 미저장·블라인드 풀기·묶음 판정. 가짜 견본만 쓴다.
import { describe, expect, it } from "vitest"
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fixtureSet } from "./fixtures"
import { parseSample } from "../../scripts/qa/rubric/lib/load"
import { scoreBatch } from "../../scripts/qa/rubric/lib/metrics"
import { buildBlindSheet, maskLetters, maskWords, parseCompareSpec, sampleText, DEFAULT_COMPETITOR, type ExportedScores } from "../../scripts/qa/rubric/lib/blind"
import { unblind } from "../../scripts/qa/rubric/lib/unblind"
import { RUBRIC_ITEMS, judgeBatch, judgeSample } from "../../scripts/qa/rubric/lib/rubric"
import { runAutoScore, runBlindSheet, runUnblind } from "../../scripts/qa/rubric/lib/commands"

const fx = fixtureSet()
const samples = [...fx.good, ...fx.barnum].map((j) => parseSample(j, `${j.persona}.json`))

function fill(sc: ExportedScores, prefix: string, v: number | Record<string, number>) {
  for (const { key } of RUBRIC_ITEMS) sc.ratings[`${prefix}.${key}`] = typeof v === "number" ? v : v[key] ?? 5
}

describe("시트 만들기", () => {
  const a = buildBlindSheet(samples, { seed: "대표비밀", compare: ["good-1", "good-2:다른곳"] })

  it("같은 seed면 같은 시트·정답표, seed가 다르면 시트 번호가 다르다", () => {
    const b = buildBlindSheet(samples, { seed: "대표비밀", compare: ["good-1", "good-2:다른곳"] })
    expect(b.html).toBe(a.html)
    expect(b.key).toEqual(a.key)
    const c = buildBlindSheet(samples, { seed: "다른 seed", compare: ["good-1", "good-2:다른곳"] })
    expect(c.key.sheetId).not.toBe(a.key.sheetId)
  })

  it("경쟁사 이름: 생략하면 1순위 기준점(할마카세), 정답표에 기록", () => {
    expect(DEFAULT_COMPETITOR).toBe("할마카세")
    expect(parseCompareSpec("p01")).toEqual({ persona: "p01", competitor: "할마카세" })
    expect(a.key.compare.map((c) => [c.persona, c.competitor])).toEqual([["good-1", "할마카세"], ["good-2", "다른곳"]])
    for (const c of a.key.compare) expect(["A", "B"]).toContain(c.ours)
  })

  it("A/B 배정은 seed마다 섞인다(20개 seed에서 A·B 둘 다 나온다)", () => {
    const sides = new Set<string>()
    for (let i = 0; i < 20; i++) sides.add(buildBlindSheet(samples, { seed: `s${i}`, compare: ["good-1"] }).key.compare[0].ours)
    expect([...sides].sort()).toEqual(["A", "B"])
  })

  it("시트에 인물 이름(정답)이 드러나지 않고, 견본 순서는 섞인다", () => {
    for (const p of ["good-1", "good-2", "barnum-1", "barnum-2"]) expect(a.html.includes(p), p).toBe(false)
    expect(a.key.ours.map((o) => o.id)).toEqual(["S1", "S2", "S3", "S4"])
    expect(new Set(a.key.ours.map((o) => o.persona))).toEqual(new Set(["good-1", "good-2", "barnum-1", "barnum-2"]))
  })

  it("경쟁사 원문을 담지 않는다: 붙여 넣기 칸만, 외부 연결·저장 없음, textContent로만 그림", () => {
    expect(a.html).toMatch(/connect-src 'none'/)
    expect(a.html).toMatch(/default-src 'none'/)
    expect(a.html).not.toMatch(/localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest|innerHTML|<img|https?:\/\//)
    expect(a.html).toMatch(/textContent=/)
    expect((a.html.match(/<textarea id="paste-/g) ?? []).length).toBe(2)
    expect(a.html).toMatch(/경쟁사\(할마카세\) 풀이 붙여 넣기/)
    // 우리 본문은 들어 있다(A 또는 B 칸)
    expect(a.html).toContain("경진(庚辰)일에 났구나")
  })

  it("비교 칸에만 참고 항목(화면·그림, 분량)이 있다", () => {
    expect(a.html).toMatch(/name="cmp1\.A\.visual"/)
    expect(a.html).toMatch(/name="cmp1\.B\.volume"/)
    expect(a.html).not.toMatch(/name="ours\.S1\.visual"/)
  })

  it("이름 가리기: 할미·할머니·할마카세 → 풀이자, 긴 낱말부터", () => {
    expect(maskWords("할마카세의 할머니와 할미", ["할미", "할머니", "할마카세"])).toBe("풀이자의 풀이자와 풀이자")
    const s = parseSample({ persona: "m", chapters: [{ id: "c", ok: true, output: { title: "할미 장", body: ["할미가 본다. <b>굵게</b>"] } }] }, "m.json")
    const t = sampleText(s, ["할미"])
    expect(t).not.toMatch(/할미|<b>/)
    expect(t).toMatch(/풀이자가 본다\. 굵게/)
  })

  it("구체성 표본 검사: 견본마다 최대 N문장, 간지·숫자·십성을 가림", () => {
    const b = buildBlindSheet(samples, { seed: "x", compare: [], swapPerSample: 3 })
    expect(b.key.swap.length).toBe(12)
    expect(maskLetters("일지 진(辰)이 편인이라 2026년에 바쁘다")).toBe("일지 ○이 ○○이라 ○년에 바쁘다")
    const qs = b.html.match(/<div class="qt">[^<]*<\/div>/g) ?? []
    expect(qs.length).toBe(12)
    for (const q of qs) expect(q).not.toMatch(/[一-鿿]/)
  })

  it("없는 인물을 비교로 지정하면 오류", () => {
    expect(() => buildBlindSheet(samples, { seed: "x", compare: ["nobody"] })).toThrow(/nobody/)
  })
})

describe("블라인드 풀기·판정", () => {
  const auto = scoreBatch(samples)
  const { key } = buildBlindSheet(samples, { seed: "k", compare: ["good-1"] })

  function scores(oursCmp: number, theirsCmp: number, prefer: "ours" | "theirs" | "same"): ExportedScores {
    const sc: ExportedScores = { sheetId: key.sheetId, ratings: {}, notes: {}, swap: {} }
    const c = key.compare[0]
    const theirs = c.ours === "A" ? "B" : "A"
    fill(sc, `cmp1.${c.ours}`, oursCmp)
    fill(sc, `cmp1.${theirs}`, theirsCmp)
    sc.ratings[`cmp1.${c.ours}.visual`] = 3
    sc.ratings[`cmp1.${theirs}.visual`] = 5
    sc.ratings["cmp1.prefer"] = prefer === "ours" ? c.ours : prefer === "theirs" ? theirs : "same"
    // 사람이 견본 4편 모두에 5점을 줬다고 치자(바넘에 속았다)
    for (const o of key.ours) fill(sc, `ours.${o.id}`, 5)
    for (const q of key.swap) sc.swap![q.id] = q.persona.startsWith("good") ? "specific" : "generic"
    return sc
  }

  it("자동 상한이 사람 점수를 깎아 바넘 2편 불합격 → 4편 중 2편 합격(50%) → 묶음 불합격", () => {
    const r = unblind(key, scores(5, 4, "ours"), auto)
    const pass = Object.fromEntries(r.samples.map((s) => [s.persona, s.judgement.pass]))
    expect(pass).toEqual({ "good-1": true, "good-2": true, "barnum-1": false, "barnum-2": false })
    expect(r.markdown).toMatch(/## 4\. 묶음 판정/)
    expect(r.markdown).toMatch(/\*\*불합격\*\*/)
    expect(r.markdown).toMatch(/vs 할마카세/)
    expect(r.markdown).toMatch(/화면·그림 체감\(참고\) \| 3 \| 5 \| 평균 미포함/)
  })

  it("구체성 표본 검사 결과: 좋은 글 100%·바넘 0% → 점수 제안 5·1", () => {
    const r = unblind(key, scores(5, 4, "ours"), auto)
    const by = Object.fromEntries(r.swap.map((w) => [w.persona, w.suggestedSpecificity]))
    expect(by).toEqual({ "good-1": 5, "good-2": 5, "barnum-1": 1, "barnum-2": 1 })
  })

  it("경쟁사 쪽이 이겼는지 정확히 풀어낸다(A/B 뒤바뀜 없음)", () => {
    const r = unblind(key, scores(3, 5, "theirs"), auto)
    expect(r.compare[0]).toMatchObject({ oursMean: 3, theirsMean: 5, prefer: "theirs", competitor: "할마카세" })
  })

  it("시트 번호가 다르면 거부", () => {
    expect(() => unblind(key, { sheetId: "000000000000", ratings: {} }, auto)).toThrow(/시트 번호/)
  })

  it("묶음 판정 규칙: 통과 / 조건부(비교 미실시·경쟁사보다 조금 낮음) / 불합격(안전 위반)", () => {
    const good = judgeSample({ accuracy: 5, specificity: 4, depth: 4, voice: 4, usefulness: 4, safety: 5, personalization: 4, fun: 4 })
    expect(good.pass).toBe(true)
    const ten = Array.from({ length: 10 }, () => good)
    expect(judgeBatch(ten, { oursMean: 4.3, theirsMean: 4.4, preferOursOrSame: 0.5 }).verdict).toBe("통과")
    expect(judgeBatch(ten).verdict).toBe("조건부 통과")
    expect(judgeBatch(ten, { oursMean: 4.0, theirsMean: 4.4, preferOursOrSame: 1 }).verdict).toBe("조건부 통과")
    expect(judgeBatch(ten, { oursMean: 3.8, theirsMean: 4.4, preferOursOrSame: 1 }).verdict).toBe("불합격")
    const unsafe = judgeSample({ accuracy: 5, specificity: 5, depth: 5, voice: 5, usefulness: 5, safety: 4, personalization: 5, fun: 5 })
    expect(unsafe.pass).toBe(false)
    expect(judgeBatch([...ten.slice(0, 9), unsafe], { oursMean: 5, theirsMean: 3, preferOursOrSame: 1 }).verdict).toBe("불합격")
    const eight = [...ten.slice(0, 8), judgeSample({}), judgeSample({})]
    expect(judgeBatch(eight, { oursMean: 5, theirsMean: 3, preferOursOrSame: 1 }).verdict).toBe("불합격") // 미채점 2편은 안전 미달로 셈
  })

  it("편 단위: 평균 4.0 미만·3점 미만 항목·구체성 4 미만이면 불합격", () => {
    const base = { accuracy: 5, specificity: 4, depth: 4, voice: 4, usefulness: 4, safety: 5, personalization: 4, fun: 4 }
    expect(judgeSample({ ...base, depth: 2 }).pass).toBe(false)
    expect(judgeSample({ ...base, specificity: 3 }).pass).toBe(false)
    expect(judgeSample({ ...base, depth: 3, voice: 3, usefulness: 3, fun: 3 }).pass).toBe(false) // 평균 3.75
  })
})

describe("실행(파일 입출력)", () => {
  it("시트·정답표를 따로 쓰고, 풀기는 점수만 담은 결과를 쓴다", () => {
    const dir = join(mkdtempSync(join(tmpdir(), "qa-blind-")), "2026-11-28")
    mkdirSync(dir)
    for (const j of [...fx.good, ...fx.barnum]) writeFileSync(join(dir, `${j.persona}.json`), JSON.stringify(j))
    runAutoScore({ dir, json: true })
    const { htmlPath, keyPath, key } = runBlindSheet({ dir, seed: "x", compare: ["good-2"] })
    expect(existsSync(htmlPath) && existsSync(keyPath)).toBe(true)
    expect(readFileSync(htmlPath, "utf8")).not.toContain(key.compare[0].ours === "A" ? '"ours":"A"' : '"ours":"B"')
    const sc: ExportedScores = { sheetId: key.sheetId, ratings: {}, swap: {} }
    for (const o of key.ours) fill(sc, `ours.${o.id}`, 5)
    const scoresPath = join(dir, "..", "blind-scores.json")
    writeFileSync(scoresPath, JSON.stringify(sc))
    const { outPath, markdown } = runUnblind({ dir, compare: [], unblind: scoresPath })
    expect(outPath).toBe(join(dir, "blind-result.md"))
    expect(markdown).toMatch(/자동 상한/)
    expect(readdirSync(dir).sort()).toEqual(["auto-score.json", "auto-score.md", "barnum-1.json", "barnum-2.json", "blind-key.json", "blind-result.md", "blind-sheet.html", "good-1.json", "good-2.json"])
    expect(() => runBlindSheet({ dir, compare: [] })).toThrow(/--seed/)
  })
})
