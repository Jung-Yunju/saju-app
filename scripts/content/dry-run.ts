// 콘텐츠 엔진 미리보기(P4-03) — API 호출 없음. 가상의 "예시" 사주로 사실표와 장별 프롬프트를 만들고 토큰·비용을 근사한다.
// 실행: npx vite-node scripts/content/dry-run.ts [--product BASIC] [--facts] [--prompts]
//   (또는 node scripts/content/dry-run.mjs ...)
//   --product X : 그 상품(ChapterSpec.products)에 든 장만
//   --facts     : 사실표 전체 JSON 출력
//   --prompts   : 장별 system·user 프롬프트 전문 출력
// 장 명세(콘텐츠 작가, src/engine/content/prompts/index.ts)가 아직 없으면 사실표만 보여 준다.
// 토큰 수는 문자 수 기반 근사(approxTokens)다. 실제 과금 토큰과 ±30% 이상 다를 수 있다.
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { analyzeRules, computeChart } from "../../src/engine"
import { buildPersonalContext } from "../../src/engine/personalize"
import { buildFactSheet } from "../../src/engine/content/facts"
import { approxTokens, CONTENT_MODELS, estimateCostUsd } from "../../src/engine/content/cost"
import type { ChapterSpec, FactSheet } from "../../src/engine/content/types"

const args = process.argv.slice(2)
const flag = (k: string) => args.includes(k)
const product = (() => {
  const i = args.indexOf("--product")
  return i >= 0 ? args[i + 1] : undefined
})()

// ── 예시 입력(가상 인물 — 실제 고객 아님)
const AS_OF = new Date("2026-11-27T03:00:00Z")
const chart = computeChart({ calendar: "solar", year: 1990, month: 5, day: 15, time: { hour: 12, minute: 0 }, gender: "M" })
const rules = analyzeRules(chart, undefined, { luck: chart.luck.daeun.map((d) => d.pillar), year: { stem: "丙", branch: "午" } })
const personal = buildPersonalContext(
  chart,
  [
    { questionId: "relationshipStatus", values: ["married"] },
    { questionId: "lifeEvents", values: ["job_change"], years: { job_change: 2019 } },
    { questionId: "concernTopic", values: ["money"] },
  ],
  AS_OF,
  rules,
)
const facts: FactSheet = buildFactSheet({ chart, rules, personal, asOf: AS_OF, addressAs: "손주" })

const factsJson = JSON.stringify(facts)
console.log("=== 예시 사실표 (가상 인물) ===")
console.log(`엔진: ${facts.engineVersion}`)
console.log(`원국: ${facts.chart.pillars.year} ${facts.chart.pillars.month} ${facts.chart.pillars.day} ${facts.chart.pillars.hour ?? "(시 모름)"}  ·  ${facts.subject.gender} 만 ${facts.subject.ageYears}세 · ${facts.subject.lifeStage}`)
console.log(`십성 ${facts.chart.tenGods.length}건 · 관계 ${facts.chart.interactions.length}건 · 대운 ${facts.luck.daeun.length}개 · 사용자 사실 ${facts.personal.userFacts.length}건`)
console.log(`신강약: ${facts.chart.strength ? facts.chart.strength.verdict : "(규칙 엔진에 아직 없음 — 생략)"} · 용신 관점: ${facts.chart.usefulGod?.length ?? 0}개 · 조후: ${facts.chart.climate ? "있음" : "없음"}`)
console.log(`사실표 JSON ${factsJson.length.toLocaleString()}자 ≈ ${approxTokens(factsJson).toLocaleString()} 토큰(근사)`)
if (flag("--facts")) console.log(JSON.stringify(facts, null, 2))

// ── 장 명세 탐색(콘텐츠 작가 소유 — 읽기만)
function isSpec(v: unknown): v is ChapterSpec {
  const o = v as ChapterSpec
  return !!o && typeof o === "object" && typeof o.id === "string" && typeof o.build === "function" && !!o.outputSchema && typeof o.maxOutputTokens === "number"
}

async function loadChapters(): Promise<ChapterSpec[] | null> {
  const idx = resolve(__dirname, "../../src/engine/content/prompts/index.ts")
  if (!existsSync(idx)) return null
  const mod = (await import(idx)) as Record<string, unknown>
  const found = new Map<string, ChapterSpec>()
  const take = (v: unknown) => {
    if (isSpec(v)) found.set(v.id, v)
    else if (Array.isArray(v)) v.forEach(take)
    else if (v && typeof v === "object" && !isSpec(v)) Object.values(v as Record<string, unknown>).forEach((x) => (isSpec(x) || Array.isArray(x) ? take(x) : undefined))
  }
  for (const v of Object.values(mod)) if (typeof v !== "function") take(v)
  return [...found.values()]
}

const chapters = await loadChapters()
if (!chapters) {
  console.log("\n(장 명세 src/engine/content/prompts/index.ts 가 아직 없음 — 장별 프롬프트 미리보기는 건너뜀)")
  process.exit(0)
}
const list = product ? chapters.filter((c) => c.products.includes(product)) : chapters
console.log(`\n=== 장별 프롬프트 (${list.length}장${product ? `, 상품 ${product}` : ""}) — API 호출 없음 ===`)
if (!list.length) process.exit(0)

let systemShared: string | null = null
let allSame = true
const rows: { id: string; sys: number; user: number; schema: number; out: number }[] = []
for (const c of list) {
  let built: { system: string; user: string }
  try {
    built = c.build(facts)
  } catch (e) {
    console.log(`- ${c.id}: build 오류 — ${(e as Error).message}`)
    continue
  }
  if (systemShared === null) systemShared = built.system
  else if (built.system !== systemShared) allSame = false
  const row = { id: c.id, sys: approxTokens(built.system), user: approxTokens(built.user), schema: approxTokens(JSON.stringify(c.outputSchema)), out: c.maxOutputTokens }
  rows.push(row)
  console.log(`- ${c.id} 「${c.title}」 [${c.products.join(",")}]  system≈${row.sys} · user≈${row.user} · 스키마≈${row.schema} · 출력 상한 ${row.out}`)
  if (flag("--prompts")) console.log(`  --- system ---\n${built.system}\n  --- user ---\n${built.user}\n`)
}
console.log(`시스템 프롬프트가 장 사이 ${allSame ? "동일 → 첫 장 이후 캐시 읽기 기대" : "서로 다름 → 장마다 캐시 쓰기(캐시 이득 작음)"}`)

// ── 비용 근사: 첫 장은 system 캐시 쓰기, 이후는 캐시 읽기(동일할 때). user·스키마는 일반 입력. 출력은 상한의 100%와 60% 두 경우
const fmt = (n: number) => `$${n.toFixed(4)}`
for (const ratio of [1, 0.6]) {
  const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }
  rows.forEach((r, i) => {
    usage.inputTokens += r.user + r.schema
    if (i === 0 || !allSame) usage.cacheWriteTokens += r.sys
    else usage.cacheReadTokens += r.sys
    usage.outputTokens += Math.round(r.out * ratio)
  })
  const costs = CONTENT_MODELS.map((m) => `${m} ${fmt(estimateCostUsd(m, usage))}`).join(" · ")
  console.log(`출력 ${ratio * 100}% 가정 — 입력 ${usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens} (캐시쓰기 ${usage.cacheWriteTokens}, 캐시읽기 ${usage.cacheReadTokens}) · 출력 ${usage.outputTokens} → ${costs}`)
}
console.log("(재시도·검증 재생성 비용 제외. 모델별 최소 캐시 길이에 못 미치면 캐시가 걸리지 않아 입력 단가가 그대로 붙는다)")
