// 자동 채점 결과 → 마크다운 (P4-05). 순수 함수(현재 시각을 넣지 않는다 — 같은 견본이면 같은 보고서).
import { VERIFY_VERSION } from "../../../../src/engine/verify"
import type { BatchScore, SampleScore } from "./metrics"
import { CAP_TABLE } from "./metrics"

const pct = (x: number) => `${Math.round(x * 100)}%`
const cap = (x: number | null) => (x === null ? "미검증" : String(x))
const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ")

function verdictCell(s: SampleScore): string {
  if (!s.verify.ran) return "미실행"
  const c = s.verify.counts!
  return `${s.verify.pass ? "PASS" : "BLOCK"} (b${c.block}/w${c.warn})`
}

function sampleSection(s: SampleScore): string[] {
  const L: string[] = []
  L.push(`### ${esc(s.persona)}`, "")
  L.push(`- 파일: \`${s.file}\`${s.pillars ? ` · 원국: ${s.pillars}` : ""}`)
  if (s.problems.length) L.push(`- 형식 문제: ${s.problems.map(esc).join(" / ")}`)
  if (s.caps.autoFail.length) L.push(`- **자동 불합격 사유**: ${s.caps.autoFail.map(esc).join(" / ")}`)
  L.push(
    `- 자동 상한: 정확성 ${cap(s.caps.accuracy)} · 안전 ${cap(s.caps.safety)} · 구체성 ${s.caps.specificity} · 목소리 ${s.caps.voice} · 개인화 ${cap(s.caps.personalization)}` +
      ` (이 사람만의 문장 ${pct(s.caps.specificRatio)}, 기준 ${s.caps.specificBasis === "marker+crossdup" ? "근거 표지+교차 중복" : "근거 표지만(인물 1명)"})`,
  )
  L.push("")

  L.push("**1) 검증기(verifyReading) 요약**", "")
  if (!s.verify.ran) L.push("- 사실표가 없어 실행하지 못함 → 정확성·안전 **미검증**")
  else {
    L.push(`- 판정 ${s.verify.pass ? "PASS" : "BLOCK"} · 참고 점수 ${s.verify.score} · block ${s.verify.counts!.block} / warn ${s.verify.counts!.warn} / info ${s.verify.counts!.info}`)
    L.push(`- 정확성 계열 block ${s.verify.accuracy.block}·warn ${s.verify.accuracy.warn} · 안전 계열 block ${s.verify.safety.block}·warn ${s.verify.safety.warn} · 개인화 계열 block ${s.verify.personal.block}·warn ${s.verify.personal.warn}`)
    if (s.verify.byCode.length) L.push(`- 코드별: ${s.verify.byCode.map((c) => `${c.code} ${c.block}/${c.warn}/${c.info}`).join(", ")} (block/warn/info)`)
    if (s.verify.storedMismatch.length) L.push(`- **주의**: 파이프라인이 저장한 판정과 재검증 판정이 다른 장: ${s.verify.storedMismatch.join(", ")}`)
    if (s.verify.top.length) {
      L.push("", "| 심각도 | 코드 | 장 | 발췌 |", "|---|---|---|---|")
      for (const f of s.verify.top) L.push(`| ${f.severity} | ${f.code} | ${f.chapterId ?? "-"} | ${esc(f.excerpt)} |`)
    }
  }
  L.push("")

  L.push("**2) 근거 표지 비율**", "")
  L.push(`- 서술 칸(body·text·claim): ${s.markers.narrative.marked}/${s.markers.narrative.sentences} = ${pct(s.markers.narrative.ratio)}`)
  L.push(`- 서술+설명 칸: ${s.markers.prose.marked}/${s.markers.prose.sentences} = ${pct(s.markers.prose.ratio)} (말버릇·고정 문구 ${s.markers.fixed}문장은 뺌)`)
  if (s.crossDup) L.push(`- 다른 인물과 겹친 문장: 거의 같음 ${s.crossDup.same} · 글자만 바꾼 틀 ${s.crossDup.template} / ${s.crossDup.sentences} = ${pct(s.crossDup.ratio)}`)
  L.push("")

  L.push("**3) 장별 분량**", "")
  L.push("| 장 | 생성 | 문단 | 문장 | 글자 | 평균 | 최장 | 70자 초과 | 근거 표지 |", "|---|---|---|---|---|---|---|---|---|")
  for (const c of s.lengths) L.push(`| ${esc(c.chapterId)} | ${c.ok ? "성공" : "**실패**"} | ${c.paragraphs} | ${c.sentences} | ${c.chars} | ${c.avgChars} | ${c.maxChars} | ${c.over70} | ${pct(c.markerRatio)} |`)
  L.push("")

  const r = s.repetition
  L.push("**4) 반복 표현(목소리)**", "")
  L.push(`- 문제 합계 ${r.issues}건 = 말버릇 초과 ${r.catchphraseOveruse} + 반복 어절 묶음 ${r.phrases.length} + 말끝 3연속 ${r.endingRuns.length} + 강조어 ${r.emphasis} + 호칭 남발 장 ${r.vocativeOveruse.length} + 고정 문구 AI 작성 ${r.fixedByAi}`)
  if (r.catchphrases.length) L.push(`- 말버릇: ${r.catchphrases.map((c) => `${c.chapterId} 「${c.phrase}」 ${c.count}회(허락 ${c.allowed === null ? "?" : c.allowed})`).join(" · ")}`)
  if (r.phrases.length) L.push(`- 반복 어절 묶음: ${r.phrases.map((p) => `「${esc(p.phrase)}」×${p.sentences}`).join(" · ")}`)
  if (r.endingRuns.length) L.push(`- 말끝 3연속: ${r.endingRuns.map((e) => `${e.chapterId} ${e.path} ~${e.ending}`).join(" · ")}`)
  if (r.vocativeOveruse.length) L.push(`- 호칭 3회 이상: ${r.vocativeOveruse.map((v) => `${v.chapterId} ${v.count}회`).join(" · ")}`)
  L.push("")

  L.push("**5) 깊이·유용성·개인화 보조 지표(상한 아님 — 사람 채점 참고)**", "")
  L.push("| 장 | 원인(근거 글자) | 시기 표지 | 쓰는 법 |", "|---|---|---|---|")
  for (const d of s.depth) L.push(`| ${esc(d.chapterId)} | ${d.cause ? "O" : "-"} | ${d.timing ? "O" : "-"} | ${d.use ? "O" : "-"} |`)
  const t = s.todos
  L.push("", `- 오늘부터 할 일: ${t.withTodo}/${t.chapters}장 · 40자 이내 ${t.within40} · 근거 표지 ${t.marked} · 다른 인물과 겹침 ${t.duplicated}`)
  const p = s.personal
  L.push(`- 사용자 사실 ${p.userFacts}건 · 언급 문장 ${p.mentions} · 출처 밝힘 ${p.attributed}${p.noGuessUnattributed.length ? ` · **맞히지 않는 해를 출처 없이 씀 ${p.noGuessUnattributed.length}건**: ${p.noGuessUnattributed.map((x) => `${x.year}「${esc(x.text)}」`).join(" ")}` : ""}`)
  L.push("")
  return L
}

export function renderAutoScoreMarkdown(batch: BatchScore, meta: { folder: string; skipped: { file: string; reason: string }[] }): string {
  const L: string[] = []
  L.push(`# 견본 풀이 자동 채점 — ${meta.folder}`, "")
  L.push(`> 도구 ${batch.version} · 검증기 ${VERIFY_VERSION} · 기준표 docs/quality/rubric.md`)
  L.push("> 자동 값은 **상한(천장)**이다. 사람이 매긴 점수는 이 값을 넘을 수 없고, 자동 값이 사람 점수를 올려 주지 않는다.")
  L.push("> 이 보고서는 명리 해석의 맞고 틀림(미래 예측 정확성)을 재지 않는다. 사실표와의 일치·글의 형식만 잰다.", "")
  if (meta.skipped.length) {
    L.push("**읽지 않은 파일**", "")
    for (const s of meta.skipped) L.push(`- \`${s.file}\` — ${esc(s.reason)}`)
    L.push("")
  }

  L.push("## 요약", "")
  L.push("| 인물 | 검증기 | 근거 표지(서술) | 이 사람만의 문장 | 교차 중복 | 반복 문제 | 상한 정확·안전·구체·목소리·개인화 | 자동 불합격 |", "|---|---|---|---|---|---|---|---|")
  for (const s of batch.samples)
    L.push(
      `| ${esc(s.persona)} | ${verdictCell(s)} | ${pct(s.markers.narrative.ratio)} | ${pct(s.caps.specificRatio)} | ${s.crossDup ? pct(s.crossDup.ratio) : "-"} | ${s.repetition.issues} | ${cap(s.caps.accuracy)}·${cap(s.caps.safety)}·${s.caps.specificity}·${s.caps.voice}·${cap(s.caps.personalization)} | ${s.caps.autoFail.length ? "예" : "-"} |`,
    )
  L.push("")
  const n = batch.samples.length
  const failN = batch.samples.filter((s) => s.caps.autoFail.length).length
  L.push(`- 견본 ${n}편 · 자동 불합격 ${failN}편 · 안전 상한 5 미만 ${batch.samples.filter((s) => s.caps.safety !== 5).length}편 · 구체성 상한 4 미만 ${batch.samples.filter((s) => s.caps.specificity < 4).length}편`)
  L.push(`- 구체성 상한 문턱: ${CAP_TABLE.specificity.map((r) => `${pct(r.min)}↑→${r.cap}`).join(", ")} · 목소리 상한 문턱(문제 건수): ${CAP_TABLE.voice.map((r) => `${r.max === Infinity ? "그 이상" : `≤${r.max}`}→${r.cap}`).join(", ")}`)
  L.push("")

  L.push("## 인물 간 문장 중복(바넘 신호)", "")
  const d = batch.crossDup
  if (!d.ran) L.push("- 인물이 2명 미만이라 계산하지 않음(미검증). 구체성 상한은 근거 표지 비율만으로 냈다.")
  else {
    L.push(`- 방법: 글자 3-gram 자카드 유사도 ≥ ${d.threshold} (정규화 ${d.minLength}자 미만 문장·말버릇·불확실성 칸 제외). "틀" = 간지·숫자·십성 이름만 바꿔 끼운 문장.`)
    L.push("", "| 인물 | 문장 | 거의 같음 | 틀 | 비율 |", "|---|---|---|---|---|")
    for (const p of d.personas) L.push(`| ${esc(p.persona)} | ${p.sentences} | ${p.same} | ${p.template} | ${pct(p.ratio)} |`)
    const worst = [...d.pairs].sort((a, b) => b.ratioAtoB - a.ratioAtoB).filter((x) => x.ratioAtoB > 0).slice(0, 10)
    if (worst.length) {
      L.push("", "가장 많이 겹친 짝(A의 문장 중 B에 거의 같은 문장이 있는 비율):", "")
      for (const w of worst) L.push(`- ${esc(w.a)} → ${esc(w.b)}: ${pct(w.ratioAtoB)}`)
    }
    if (d.examples.length) {
      L.push("", "겹친 문장 예(최대 15):", "")
      for (const e of d.examples) L.push(`- [${e.kind === "same" ? "같음" : "틀"}·${e.personas.length}명] ${esc(e.text.length > 60 ? e.text.slice(0, 59) + "…" : e.text)}`)
    }
  }
  L.push("")

  L.push("## 인물별 상세", "")
  for (const s of batch.samples) L.push(...sampleSection(s))
  return L.join("\n") + "\n"
}
