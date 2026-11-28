// 실험 실행: 무작위 원국 N건 → 원형 계산(시각 앎 + 같은 사람 시각 모름) → 집계.
// 시간 측정값을 뺀 결과 전체의 해시(resultHash)가 같으면 같은 결과다(결정성 확인용).
import { createHash } from "node:crypto"
import { analyzeRules, computeChart, type BirthInput, type CalendarResult, type Pillar, type RuleAnalysis } from "../../../src/engine"
import { classifyArchetype, scoreAnalysis, TABLES } from "./classify"
import { canonicalJson, ruleSetHash } from "./ruleset"
import { randomBirthInputs } from "./random"
import type { ArchetypeResult, ArchetypeRuleSet, EvidenceItem } from "./types"

export interface LabOptions {
  n: number
  seed: string
  /** 근거 기록 샘플 수 */
  samples: number
  table: boolean
  hour: boolean
  /** 앞에서 몇 건을 다시 계산해 결과가 같은지 볼지 */
  determinism: number
}

export interface SampleRecord {
  i: number
  input: BirthInput
  pillars: string
  dm: string
  known: { primary: string; secondary: string | null; margin: number | null; tie: boolean; boundary: boolean; decidedBy: string; alsoMatched?: string[]; fallbackSafety?: boolean }
  table: { tableId: string; primary: string }[] | null
  tableSensitive: boolean | null
  tableSensitiveIncludingMainOnly: boolean | null
  unknown: {
    pillars: string
    primary: string
    secondary: string | null
    boundary: boolean
    hourPrimaries: string[] | null
    stable: boolean | null
    agree: number | null
    modal: string | null
    /** cascade: 세 기둥 판정 경보 */
    fallbackSafety?: boolean
  }
  /** cascade: 12시진 변형·표 변형 중 경보가 난 수 */
  variantAlarms?: number
  /** 시각 앎 결과의 시주가 12시진 변형 중 몇 번째인가(일·월주가 같을 때만 — 23시·절입 경계는 null) */
  actualHourIndex: number | null
}

export interface LabResult {
  meta: {
    n: number
    seed: string
    ruleSet: { id: string; version: string; status: string; hash: string }
    engineVersion: string
    featureVersion: string
    rulesEngineVersion: string
    calendarEngineVersion: string
    resultHash: string
    errors: { i: number; input: BirthInput; message: string }[]
  }
  records: SampleRecord[]
  evidenceSamples: { i: number; pillars: string; result: Pick<ArchetypeResult, "primary" | "secondary" | "margin" | "boundary" | "decidedBy" | "tableSensitivity" | "cascade"> & { top2: { id: string; score: number; evidence: EvidenceItem[] }[] } }[]
  termFiring: Record<string, Record<string, number>>
  ineligible: Record<string, number>
  determinism: { checked: number; identical: number }
  timing: { totalMs: number; perSampleMs: number; chartMs: number; analyzeMs: number; scoreMs: number; benchN: number }
}

const P = (p: Pillar | null): string => (p ? p.stem + p.branch : "--")
const pillarsStr = (c: CalendarResult): string => [c.pillars.year, c.pillars.month, c.pillars.day, c.pillars.hour].map(P).join(" ")

export function runLab(rs: ArchetypeRuleSet, o: LabOptions): LabResult {
  const hash = ruleSetHash(rs)
  const inputs = randomBirthInputs(o.n, o.seed)
  const records: SampleRecord[] = []
  const errors: LabResult["meta"]["errors"] = []
  const evidenceSamples: LabResult["evidenceSamples"] = []
  const termFiring: Record<string, Record<string, number>> = Object.fromEntries(rs.archetypes.map((a) => [a.id, Object.fromEntries(a.terms.map((t) => [t.id, 0]))]))
  const ineligible: Record<string, number> = Object.fromEntries(rs.archetypes.map((a) => [a.id, 0]))
  let versions = { engineVersion: "", featureVersion: "", rulesEngineVersion: "", calendarEngineVersion: "" }

  const t0 = performance.now()
  inputs.forEach((input, i) => {
    try {
      const ck = computeChart(input)
      const cu = computeChart({ ...input, time: null })
      const rk = classifyArchetype(ck, rs, { ruleSetHash: hash, sensitivity: { hour: false, table: o.table } })
      const ru = classifyArchetype(cu, rs, { ruleSetHash: hash, sensitivity: { hour: o.hour, table: false } })
      versions = { engineVersion: rk.engineVersion, featureVersion: rk.featureVersion, rulesEngineVersion: rk.rulesEngineVersion, calendarEngineVersion: rk.calendarEngineVersion }
      for (const s of rk.ranking) {
        if (!s.eligible) ineligible[s.id]++
        for (const e of s.evidence) if (e.termId in termFiring[s.id]) termFiring[s.id][e.termId]++
      }
      const sameDayMonth = ck.pillars.day.stem === cu.pillars.day.stem && ck.pillars.day.branch === cu.pillars.day.branch && P(ck.pillars.month) === P(cu.pillars.month)
      const actualHourIndex = sameDayMonth && ru.hourSensitivity ? ru.hourSensitivity.byHour.findIndex((h) => P(h.hour) === P(ck.pillars.hour)) : null
      records.push({
        i, input, pillars: pillarsStr(ck), dm: ck.pillars.day.stem,
        known: {
          primary: rk.primary.id, secondary: rk.secondary?.id ?? null, margin: rk.margin, tie: rk.tie, boundary: rk.boundary, decidedBy: rk.decidedBy,
          ...(rk.cascade ? { alsoMatched: rk.cascade.alsoMatched, fallbackSafety: rk.cascade.fallbackSafety } : {}),
        },
        table: rk.tableSensitivity ? rk.tableSensitivity.byTable.map((x) => ({ tableId: x.tableId, primary: x.primary })) : null,
        tableSensitive: rk.tableSensitivity?.sensitive ?? null,
        tableSensitiveIncludingMainOnly: rk.tableSensitivity?.sensitiveIncludingMainOnly ?? null,
        unknown: {
          pillars: pillarsStr(cu), primary: ru.primary.id, secondary: ru.secondary?.id ?? null, boundary: ru.boundary,
          hourPrimaries: ru.hourSensitivity ? ru.hourSensitivity.byHour.map((h) => h.primary) : null,
          stable: ru.hourSensitivity?.stable ?? null,
          agree: ru.hourSensitivity?.agreeWithThreePillars ?? null,
          modal: ru.hourSensitivity?.modal.id ?? null,
          ...(ru.cascade ? { fallbackSafety: ru.cascade.fallbackSafety } : {}),
        },
        ...(rk.cascade
          ? {
              variantAlarms:
                (ru.hourSensitivity?.byHour.filter((h) => h.fallbackSafety).length ?? 0) + (rk.tableSensitivity?.byTable.filter((t) => t.fallbackSafety).length ?? 0),
            }
          : {}),
        actualHourIndex: actualHourIndex === -1 ? null : actualHourIndex,
      })
      // cascade: 서로 다른 1순위 원형으로 샘플을 고른다(같은 관문만 반복되지 않게)
      if (evidenceSamples.length < o.samples && !(rk.cascade && evidenceSamples.some((x) => x.result.primary.id === rk.primary.id)))
        evidenceSamples.push({
          i, pillars: pillarsStr(ck),
          result: {
            primary: rk.primary, secondary: rk.secondary, margin: rk.margin, boundary: rk.boundary, decidedBy: rk.decidedBy, tableSensitivity: rk.tableSensitivity,
            ...(rk.cascade ? { cascade: rk.cascade } : {}),
            top2: rk.ranking.slice(0, 2).map((s) => ({ id: s.id, score: s.score, evidence: s.evidence })),
          },
        })
    } catch (e) {
      errors.push({ i, input, message: (e as Error).message })
    }
  })
  const totalMs = performance.now() - t0

  // 결정성: 앞 K건을 처음부터 다시 계산해 전체 결과(근거 포함)가 같은지
  let identical = 0
  const K = Math.min(o.determinism, inputs.length)
  for (let i = 0; i < K; i++) {
    const ck = computeChart(inputs[i])
    const a = canonicalJson(classifyArchetype(ck, rs, { sensitivity: { hour: false, table: o.table } }))
    const b = canonicalJson(classifyArchetype(computeChart(inputs[i]), rs, { sensitivity: { hour: false, table: o.table } }))
    const cu = computeChart({ ...inputs[i], time: null })
    const c = canonicalJson(classifyArchetype(cu, rs, { sensitivity: { hour: true, table: true } }))
    const d = canonicalJson(classifyArchetype(computeChart({ ...inputs[i], time: null }), rs, { sensitivity: { hour: true, table: true } }))
    if (a === b && c === d) identical++
  }

  // 단계별 시간(앞 benchN건): 역법 계산 / 규칙 엔진 1회 / 특징+점수 1회
  const benchN = Math.min(2000, inputs.length)
  let tc = performance.now()
  const charts = inputs.slice(0, benchN).map((x) => computeChart(x))
  const chartMs = (performance.now() - tc) / benchN
  tc = performance.now()
  const analyses: RuleAnalysis[] = charts.map((c) => analyzeRules(c))
  const analyzeMs = (performance.now() - tc) / benchN
  tc = performance.now()
  for (const a of analyses) scoreAnalysis(a, rs)
  const scoreMs = (performance.now() - tc) / benchN

  const resultHash = "sha256:" + createHash("sha256").update(canonicalJson({ records, termFiring, ineligible, errors: errors.map((e) => e.i) })).digest("hex").slice(0, 16)
  return {
    meta: { n: o.n, seed: o.seed, ruleSet: { id: rs.id, version: rs.version, status: rs.status, hash }, ...versions, resultHash, errors },
    records, evidenceSamples, termFiring, ineligible,
    determinism: { checked: K, identical },
    timing: { totalMs, perSampleMs: totalMs / Math.max(1, inputs.length), chartMs, analyzeMs, scoreMs, benchN },
  }
}

export { TABLES }

/** 원자료(1건 1줄) CSV — 큰 JSON 대신 저장소에 남길 용도 */
export function labCsv(L: LabResult): string {
  const esc = (x: unknown): string => {
    const t = x === null || x === undefined ? "" : String(x)
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  const head = [
    "i", "date", "time", "gender", "pillars", "known_primary", "known_secondary", "known_also", "alarm",
    "unknown_pillars", "unknown_primary", "hour12_primaries", "hour12_stable", "hour12_agree", "table_kr", "table_cn", "table_mainonly",
  ]
  const rows = L.records.map((r) => {
    const t = (id: string) => r.table?.find((x) => x.tableId === id)?.primary ?? ""
    const inp = r.input
    return [
      r.i, `${inp.year}-${String(inp.month).padStart(2, "0")}-${String(inp.day).padStart(2, "0")}`,
      inp.time ? `${String(inp.time.hour).padStart(2, "0")}:${String(inp.time.minute).padStart(2, "0")}` : "", inp.gender, r.pillars,
      r.known.primary, r.known.secondary ?? "", (r.known.alsoMatched ?? []).join("|"), r.known.fallbackSafety || r.unknown.fallbackSafety || (r.variantAlarms ?? 0) > 0 ? 1 : 0,
      r.unknown.pillars, r.unknown.primary, (r.unknown.hourPrimaries ?? []).join("|"), r.unknown.stable === null ? "" : r.unknown.stable ? 1 : 0, r.unknown.agree ?? "",
      t("kr-monthly-30"), t("cn-lunarjs"), t("main-only"),
    ].map(esc).join(",")
  })
  return [head.join(","), ...rows].join("\n") + "\n"
}
