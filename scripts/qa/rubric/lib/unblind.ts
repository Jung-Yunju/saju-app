// 블라인드 풀기 (P4-05): 대표가 내보낸 점수 JSON + 정답표(blind-key.json) (+ auto-score.json) → 판정 마크다운.
// 순수 함수. 결과에는 점수·짧은 관찰만 들어간다(원문 없음).
import type { BatchScore } from "./metrics"
import type { BlindKey, ExportedScores } from "./blind"
import { COMPARE_EXTRA, ratingsFor } from "./blind"
import { RUBRIC_ITEMS, COMPARE_LABEL, judgeBatch, judgeSample, type AutoCaps, type SampleJudgement } from "./rubric"
import { specificityCap } from "./metrics"

const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null)
const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ")

export interface UnblindResult {
  markdown: string
  samples: { persona: string; judgement: SampleJudgement }[]
  compare: { n: number; persona: string; competitor: string; oursMean: number | null; theirsMean: number | null; prefer: "ours" | "theirs" | "same" | "" }[]
  swap: { persona: string; asked: number; specific: number; share: number | null; suggestedSpecificity: number | null }[]
}

export function unblind(key: BlindKey, sc: ExportedScores, auto?: BatchScore): UnblindResult {
  if (sc.sheetId !== key.sheetId) throw new Error(`점수 파일(${sc.sheetId})과 정답표(${key.sheetId})의 시트 번호가 다름`)
  const L: string[] = [`# 블라인드 채점 결과 — 시트 ${key.sheetId}`, "", "> 점수·짧은 관찰만 담는다. 경쟁사 원문은 이 파일·저장소에 두지 않는다.", ""]

  // 1) 경쟁사 비교
  const compare: UnblindResult["compare"] = []
  if (key.compare.length) {
    L.push("## 1. 경쟁사와 나란히", "")
    for (const c of key.compare) {
      const theirsAB = c.ours === "A" ? "B" : "A"
      const o = ratingsFor(`cmp${c.n}.${c.ours}`, sc)
      const t = ratingsFor(`cmp${c.n}.${theirsAB}`, sc)
      const p = sc.ratings[`cmp${c.n}.prefer`]
      const prefer = p === c.ours ? "ours" : p === theirsAB ? "theirs" : p === "same" ? "same" : ""
      const om = mean(Object.values(o))
      const tm = mean(Object.values(t))
      compare.push({ n: c.n, persona: c.persona, competitor: c.competitor ?? "경쟁사", oursMean: om, theirsMean: tm, prefer })
      L.push(`### 비교 ${c.n} — ${esc(c.persona)} vs ${esc(c.competitor ?? "경쟁사")} (우리 = ${c.ours})`, "", "| 항목 | 우리 | 경쟁사 | 차이 |", "|---|---|---|---|")
      for (const { key: k, label } of RUBRIC_ITEMS) {
        const a = o[k]
        const b = t[k]
        L.push(`| ${COMPARE_LABEL[k] ?? label} | ${a ?? "-"} | ${b ?? "-"} | ${a !== undefined && b !== undefined ? (a - b > 0 ? "+" : "") + (a - b) : "-"} |`)
      }
      const po = sc.ratings[`cmp${c.n}.${c.ours}.price`]
      const pt = sc.ratings[`cmp${c.n}.${theirsAB}.price`]
      for (const x of COMPARE_EXTRA) {
        const a = sc.ratings[`cmp${c.n}.${c.ours}.${x.key}`]
        const b = sc.ratings[`cmp${c.n}.${theirsAB}.${x.key}`]
        if (typeof a === "number" || typeof b === "number") L.push(`| ${x.label} | ${a ?? "-"} | ${b ?? "-"} | 평균 미포함 |`)
      }
      L.push(`| 평균(8항목) | ${om ?? "-"} | ${tm ?? "-"} | ${om !== null && tm !== null ? Math.round((om - tm) * 100) / 100 : "-"} |`, "")
      L.push(`- 돈 낼 쪽: ${prefer === "ours" ? "우리" : prefer === "theirs" ? "경쟁사" : prefer === "same" ? "비슷함" : "(고르지 않음)"} · 낼 만한 값: 우리 ${po ?? "-"}원 / 경쟁사 ${pt ?? "-"}원`)
      const note = sc.notes?.[`cmp${c.n}.note`]
      if (note) L.push(`- 관찰: ${esc(note)}`)
      L.push("")
    }
  }

  // 2) 구체성 표본 검사
  const swapByP = new Map<string, { asked: number; specific: number }>()
  for (const q of key.swap) {
    const a = sc.swap?.[q.id]
    const g = swapByP.get(q.persona) ?? { asked: 0, specific: 0 }
    if (a === "specific" || a === "generic") {
      g.asked++
      if (a === "specific") g.specific++
    }
    swapByP.set(q.persona, g)
  }
  const swap: UnblindResult["swap"] = [...swapByP.entries()].map(([persona, g]) => {
    const share = g.asked ? Math.round((g.specific / g.asked) * 1000) / 1000 : null
    return { persona, asked: g.asked, specific: g.specific, share, suggestedSpecificity: share === null ? null : specificityCap(share) }
  })

  // 3) 우리 견본 편 단위 판정(사람 점수 + 자동 상한)
  L.push("## 2. 우리 견본 판정(사람 점수와 자동 상한 중 낮은 값)", "")
  L.push("| 견본 | 인물 | " + RUBRIC_ITEMS.map((r) => r.label).join(" | ") + " | 평균 | 판정 |", "|---|---|" + RUBRIC_ITEMS.map(() => "---").join("|") + "|---|---|")
  const samples: UnblindResult["samples"] = []
  for (const o of key.ours) {
    const human = ratingsFor(`ours.${o.id}`, sc)
    const capsRaw = auto?.samples.find((s) => s.persona === o.persona)?.caps
    const caps: AutoCaps | undefined = capsRaw
      ? { accuracy: capsRaw.accuracy, safety: capsRaw.safety, specificity: capsRaw.specificity, voice: capsRaw.voice, personalization: capsRaw.personalization, autoFail: capsRaw.autoFail }
      : undefined
    const j = judgeSample(human, caps)
    if (!caps) j.reasons.push("자동 채점(auto-score.json) 없음 — 상한 미적용")
    samples.push({ persona: o.persona, judgement: j })
    L.push(`| ${o.id} | ${esc(o.persona)} | ${RUBRIC_ITEMS.map((r) => j.final[r.key] ?? "-").join(" | ")} | ${j.mean ?? "-"} | ${j.pass ? "합격" : "불합격"} |`)
  }
  L.push("")
  for (const s of samples) if (s.judgement.reasons.length) L.push(`- ${esc(s.persona)}: ${s.judgement.reasons.map(esc).join(" / ")}`)
  L.push("")

  L.push("## 3. 구체성 표본 검사", "", "| 인물 | 답한 문장 | 특정한 사람 얘기 | 비율 | 구체성 점수 제안 |", "|---|---|---|---|---|")
  for (const w of swap) L.push(`| ${esc(w.persona)} | ${w.asked} | ${w.specific} | ${w.share === null ? "-" : Math.round(w.share * 100) + "%"} | ${w.suggestedSpecificity ?? "-"} |`)
  L.push("")

  // 4) 묶음 판정
  const done = compare.filter((c) => c.oursMean !== null && c.theirsMean !== null)
  const cmpAgg = done.length
    ? {
        oursMean: mean(done.map((c) => c.oursMean as number)) as number,
        theirsMean: mean(done.map((c) => c.theirsMean as number)) as number,
        preferOursOrSame: compare.filter((c) => c.prefer === "ours" || c.prefer === "same").length / Math.max(1, compare.filter((c) => c.prefer).length),
      }
    : undefined
  const b = judgeBatch(samples.map((s) => s.judgement), cmpAgg)
  L.push("## 4. 묶음 판정", "", `- **${b.verdict}** · 편 합격 ${b.passed}/${b.total} · 안전 위반 ${b.safetyViolations}편${b.competitorGap !== undefined ? ` · 경쟁사 대비 평균 ${b.competitorGap > 0 ? "+" : ""}${b.competitorGap}` : ""}`)
  for (const r of b.reasons) L.push(`- ${esc(r)}`)
  L.push("", "> 견본 10편·경쟁사 1~2편은 작은 표본이다. 이 판정은 출시 전 품질 문턱이지 통계적 우열 증명이 아니다.")
  return { markdown: L.join("\n") + "\n", samples, compare, swap }
}
