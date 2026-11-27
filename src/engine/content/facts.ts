// 사실표(FactSheet) 생성기 (P4-03) — 담당: 백엔드·서버 개발자
// 엔진(역법·규칙)·개인화 결과 → AI에 넘길 "확정 사실표". 순수 함수(AI·DB·네트워크·현재 시각 없음 — asOf로만 받는다).
// 불변식(tests/content/facts.test.ts로 고정):
//  1) 개인정보 최소화 — 이름·생년월일(월일)·출생 시각·출생지(이름·경도)를 넣지 않는다. 나이·성별·인생 단계만.
//     엔진 경고문에 섞인 날짜·시각·보정 분(경도 추정 가능)도 지운다(sanitizeWarning).
//  2) 근거 위치는 문자열 하나로 정규화한다(formatPosition):
//       원국   "year.stem" "month.branch" "day.branch" "hour.stem"
//       지장간 "month.branch.jeonggi" (여기 yeogi · 중기 junggi · 정기 jeonggi)
//       대운   "daeun[3].stem"  ← [ ] 안은 FactSheet.luck.daeun[].index(1부터)와 같은 번호
//       세운   "seun.branch"
//  3) 사용자가 말한 사실(personal.userFacts)과 사주 사실(chart)을 섞지 않는다.
//  4) 규칙 판단은 하지 않는다 — 규칙 엔진 결과를 옮겨 적기만 한다. 신강약·용신(rules@0.3.0)은 있으면 옮기고 없으면 생략.
import type { CalendarResult, Element, Pillar } from "../types"
import type { Interaction, InteractionType, Position, RuleAnalysis } from "../rules/types"
import type { PersonalContext } from "../personalize/types"
import { GUARDS } from "../personalize/context"
import { koreanDateOf, lifeStageOfAge, locateDaeun, manAge } from "../personalize/life-stage"
import { yearPillarOfGanzhiYear } from "../calendar/pillars"
import type { FactSheet } from "./types"

export const FACTS_VERSION = "facts@0.1.0"

/** 호칭 기본값 */
export const DEFAULT_ADDRESS_AS = "손주"
/** 호칭 최대 길이(실명·문장 주입 방지용) */
export const ADDRESS_AS_MAX = 8

export interface BuildFactSheetInput {
  chart: CalendarResult
  rules: RuleAnalysis
  personal?: PersonalContext
  /** 기준 시각 — 나이·"올해"·현재 대운 계산 */
  asOf: Date
  /** 호칭(예: "손주", "우리 강아지"). 실명을 넣지 않는다. 없으면 "손주" */
  addressAs?: string
}

// ─────────────────────────────────────────── 표기

export const ELEMENT_KO: Readonly<Record<Element, string>> = { wood: "목", fire: "화", earth: "토", metal: "금", water: "수" }

const INTERACTION_KO: Readonly<Record<InteractionType, string>> = {
  stemCombine: "천간합",
  stemClash: "천간충",
  sixCombine: "육합",
  threeCombine: "삼합",
  halfCombine: "반합",
  directionalCombine: "방합",
  clash: "충",
  punishment: "형",
  break: "파",
  harm: "해",
}

const PUNISHMENT_KO = { three: "삼형", mutual: "상형", self: "자형" } as const

const ganzhi = (p: Pillar): string => `${p.stem}${p.branch}`

/**
 * 근거 위치 → 정규화 문자열.
 * @param daeunIndexOf luckIndex(0부터, RuleAnalysis.source.luck 번호) → FactSheet 대운 번호(1부터). 못 찾으면 null
 */
export function formatPosition(pos: Position, hiddenRole?: string, daeunIndexOf?: (luckIndex: number) => number | null): string {
  let head: string
  if (pos.pillar === "daeun") {
    const li = pos.luckIndex ?? -1
    const n = daeunIndexOf ? daeunIndexOf(li) : li + 1
    head = `daeun[${n ?? "?"}]`
  } else {
    head = pos.pillar
  }
  return hiddenRole ? `${head}.${pos.part}.${hiddenRole}` : `${head}.${pos.part}`
}

// ─────────────────────────────────────────── 개인정보 제거

/**
 * 엔진 경고문에서 생년월일·출생 시각·보정량(분)을 지운다. 의미(어느 기둥이 불확실한지)는 남긴다.
 * 모르는 형식은 날짜·시각·괄호 속 숫자를 일괄 제거하는 일반 규칙으로 처리한다.
 */
export function sanitizeWarning(w: string): string {
  let m: RegExpMatchArray | null
  if ((m = w.match(/^시지 경계 \d+분 이내 출생.*— (.+ 경계)$/))) return `태어난 시각이 시(時)의 경계에 가까움 — ${m[1]}`
  if ((m = w.match(/^자정 \d+분 이내 출생(\(야자시 설정\))? — (.+)$/))) return `자정 가까이 출생${m[1] ?? ""} — ${m[2]}`
  if ((m = w.match(/^진태양시 보정\([^)]*\)으로 시지가 (.+)로 바뀜$/))) return `진태양시 보정으로 시지가 ${m[1]}로 바뀜`
  if (/^진태양시 보정\([^)]*\)으로 현지 날짜가 .+로 바뀜$/.test(w)) return "진태양시 보정으로 날짜(일주)가 하루 바뀜"
  if ((m = w.match(/^절입\([^)]*\) 2시간 이내 출생 — (.+)$/))) return `절입 2시간 이내 출생 — ${m[1]}`
  if ((m = w.match(/^출생일에 절입\([^)]*\) 있음 — (.+)$/))) return `출생일에 절입 있음 — ${m[1]}`
  if (/^시간대 전환\(서머타임 종료 등\)/.test(w)) return "시간대 전환(서머타임 종료 등)으로 같은 현지시각이 두 번 있음 — 앞선 시각으로 계산함(실제 출생 순간이 다를 수 있음)"
  if (/^시간대 전환\(서머타임 시작 등\)/.test(w)) return "시간대 전환(서머타임 시작 등)으로 존재하지 않는 현지시각 — 전환 전 기준으로 해석함"
  if (/^표준시 제정 전 시기/.test(w)) return "표준시 제정 전 시기 — 지방평균시 기준으로 계산함"
  // 일반 규칙: 괄호 속 숫자 → 제거, 날짜(YYYY-M-D)·시각(HH:MM)·"N분" 제거
  return w
    .replace(/\([^)]*\d[^)]*\)/g, "")
    .replace(/\d{4}-\d{1,2}-\d{1,2}/g, "")
    .replace(/\b\d{1,2}:\d{2}\b/g, "")
    .replace(/[+−-]?\d+(\.\d+)?분/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
}

/** 호칭 정리: 태그·제어문자·따옴표·중괄호 제거, 길이 제한. 비면 기본값 */
export function sanitizeAddressAs(s: string | undefined): string {
  if (typeof s !== "string") return DEFAULT_ADDRESS_AS
  const t = s
    .replace(/<[^>]*>/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f"'`{}[\]<>\\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, ADDRESS_AS_MAX)
    .trim()
  return t || DEFAULT_ADDRESS_AS
}

// ─────────────────────────────────────────── 신강약·용신(rules@0.3.0 방어적 읽기)

type Loose = Record<string, unknown>
const isObj = (v: unknown): v is Loose => !!v && typeof v === "object" && !Array.isArray(v)
const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined)

/**
 * strength: 명세(strength-structure-spec §6) StrengthResult { primary, models[{model, verdict}] } 또는
 * 초안(SAJU_ENGINE §2) { verdict } 둘 다 읽는다. 모양이 다르면 생략(undefined).
 */
export function readStrength(rules: RuleAnalysis): FactSheet["chart"]["strength"] {
  const s = (rules as unknown as Loose).strength
  if (!isObj(s)) return undefined
  const models = Array.isArray(s.models) ? s.models.filter(isObj) : []
  const views = models
    .map((m) => ({ method: str(m.model) ?? str(m.method), verdict: str(m.verdict) }))
    .filter((v): v is { method: string; verdict: string } => !!v.method && !!v.verdict)
  const primary = str(s.primary)
  const verdict = str(s.verdict) ?? (primary ? views.find((v) => v.method === primary)?.verdict : undefined) ?? views[0]?.verdict
  if (!verdict) return undefined
  return views.length ? { verdict, views } : { verdict }
}

const elementLabel = (v: unknown): string | undefined => {
  const s = str(v)
  if (!s) return undefined
  return (ELEMENT_KO as Record<string, string>)[s] ?? s
}

/**
 * usefulGod: 명세 UsefulGodsResult { views[{method, status, candidates[{element, rank}]}] } 또는
 * 초안 usefulGodCandidates[{element, method}]. 관점별 1순위만 옮긴다(관점 병기 — 대표값을 정하지 않는다).
 */
export function readUsefulGods(rules: RuleAnalysis): FactSheet["chart"]["usefulGod"] {
  const r = rules as unknown as Loose
  const out: { method: string; element: string }[] = []
  const ug = r.usefulGods
  if (isObj(ug) && Array.isArray(ug.views)) {
    for (const v of ug.views.filter(isObj)) {
      if (v.status !== undefined && v.status !== "ok") continue
      const cands = Array.isArray(v.candidates) ? v.candidates.filter(isObj) : []
      const first = cands.find((c) => c.rank === 1) ?? cands[0]
      const method = str(v.label) ?? str(v.method)
      const element = first ? elementLabel(first.element) : undefined
      if (method && element) out.push({ method, element })
    }
  } else if (Array.isArray(r.usefulGodCandidates)) {
    for (const c of r.usefulGodCandidates.filter(isObj)) {
      const method = str(c.method)
      const element = elementLabel(c.element)
      if (method && element) out.push({ method, element })
    }
  }
  return out.length ? out : undefined
}

const NEED_KO: Record<string, string> = { warm: "따뜻함", cool: "서늘함", dry: "마름", moisten: "촉촉함" }

/** climate: 명세 ClimateResult { tClass, mClass, needs } 또는 { summary }. 출처 한계 문구를 붙인다(궁통보감 표 미적용). */
export function readClimate(rules: RuleAnalysis): FactSheet["chart"]["climate"] {
  const c = (rules as unknown as Loose).climate
  if (!isObj(c)) return undefined
  const summary = str(c.summary)
  if (summary) return { summary }
  const t = str(c.tClass)
  const m = str(c.mClass)
  if (!t && !m) return undefined
  const needs = Array.isArray(c.needs) ? c.needs.map((n) => NEED_KO[String(n)] ?? String(n)) : []
  return {
    summary: `계절 기운(간이 판단): 온도 ${t ?? "?"}, 습도 ${m ?? "?"}${needs.length ? `, 반가운 기운: ${needs.join("·")}` : ""} — 궁통보감 조후표가 아닌 간이 판단(climate-v1)`,
  }
}

// ─────────────────────────────────────────── 본체

function interactionNote(it: Interaction): string | undefined {
  const parts: string[] = []
  if (it.type === "punishment" && it.punishmentKind) parts.push(PUNISHMENT_KO[it.punishmentKind])
  if (it.resultElement) parts.push(`결과 오행 ${ELEMENT_KO[it.resultElement]}(합화 성립 여부는 판정하지 않음)`)
  if (it.complete === false) parts.push("세 글자 중 일부")
  if (it.partial) parts.push("두 글자만(부분)")
  if (it.scope === "luck") parts.push("운에서 들어온 글자 포함")
  return parts.length ? parts.join(", ") : undefined
}

/** 원국·운 결과 → 사실표. 규칙 판단을 새로 하지 않는다. */
export function buildFactSheet(input: BuildFactSheetInput): FactSheet {
  const { chart, rules, personal, asOf } = input
  if (!(asOf instanceof Date) || Number.isNaN(asOf.getTime())) throw new TypeError("asOf가 올바른 Date가 아님")

  const today = koreanDateOf(asOf)
  const age = personal?.subject.ageManNow ?? manAge(chart.solarDate, today)
  const stage = personal?.subject.lifeStage ?? lifeStageOfAge(age)
  const pos = locateDaeun(chart, age)
  const currentIndex = pos.current?.index ?? null
  const currentDaeun = currentIndex ? chart.luck.daeun.find((d) => d.index === currentIndex) : undefined

  // luckIndex(규칙 엔진 source.luck 번호) → chart 대운 번호. 규칙 엔진에 넘긴 운 목록이 chart와 같으면 +1, 아니면 간지로 찾는다
  const daeunIndexOf = (li: number): number | null => {
    const p = rules.source.luck[li]
    if (!p) return null
    const same = chart.luck.daeun[li]
    if (same && same.pillar.stem === p.stem && same.pillar.branch === p.branch) return same.index
    const found = chart.luck.daeun.find((d) => d.pillar.stem === p.stem && d.pillar.branch === p.branch)
    return found ? found.index : null
  }
  const isCurrentLuck = (p: Position): boolean => {
    if (p.pillar === "seun") return true
    if (p.pillar !== "daeun") return true
    return currentIndex !== null && daeunIndexOf(p.luckIndex ?? -1) === currentIndex
  }

  const natal = rules.source.natal
  const tenGods = rules.tenGods
    .filter((h) => h.position.pillar !== "daeun" || daeunIndexOf(h.position.luckIndex ?? -1) !== null)
    .map((h) => ({ char: h.char as string, pos: formatPosition(h.position, h.viaHiddenStem, daeunIndexOf), tenGod: h.tenGod as string }))

  // 원국 관계 + (현재 대운·세운이 낀 관계만) — 지나간·먼 대운 관계는 사실표를 불필요하게 키우므로 뺀다
  const interactions = rules.interactions
    .filter((it) => it.scope === "natal" || it.members.every(isCurrentLuck))
    .map((it) => {
      const note = interactionNote(it)
      return {
        kind: INTERACTION_KO[it.type] ?? it.type,
        chars: it.chars.join(""),
        positions: it.members.map((m) => formatPosition(m, undefined, daeunIndexOf)),
        adjacent: it.adjacent,
        ...(note ? { note } : {}),
      }
    })

  const gmBranches: string[] = []
  const gmHits: string[] = []
  for (const g of rules.gongmang) {
    for (const b of g.empty) if (!gmBranches.includes(b)) gmBranches.push(b)
    for (const h of g.hits) {
      const s = formatPosition(h, undefined, daeunIndexOf)
      if (!gmHits.includes(s)) gmHits.push(s)
    }
  }

  const counts: Record<string, number> = {}
  const weighted: Record<string, number> = {}
  for (const e of Object.keys(ELEMENT_KO) as Element[]) {
    counts[ELEMENT_KO[e]] = rules.elements.counts[e]
    weighted[ELEMENT_KO[e]] = rules.elements.weighted[e]
  }

  const strength = readStrength(rules)
  const usefulGod = readUsefulGods(rules)
  const climate = readClimate(rules)

  const thisYear = today.year
  const versions = [chart.engineVersion, rules.engineVersion, personal?.version, FACTS_VERSION].filter(Boolean).join("+")

  const warnings = [
    ...chart.warnings.map(sanitizeWarning),
    ...(personal?.notes ?? []).map(sanitizeWarning),
  ].filter((w, i, a) => w && a.indexOf(w) === i)

  const fmtPeriod = (p?: { fromYear: number; toYear: number }): string | undefined =>
    p ? (p.fromYear === p.toYear ? String(p.fromYear) : `${p.fromYear}-${p.toYear}`) : undefined

  return {
    schemaVersion: 1,
    engineVersion: versions,
    asOf: asOf.toISOString(),
    subject: {
      addressAs: sanitizeAddressAs(input.addressAs),
      gender: chart.input.gender,
      ageYears: age,
      lifeStage: stage.label,
      hourKnown: chart.hourKnown,
    },
    chart: {
      pillars: { year: ganzhi(natal.year), month: ganzhi(natal.month), day: ganzhi(natal.day), hour: natal.hour ? ganzhi(natal.hour) : null },
      dayMaster: { stem: rules.dayMaster.stem, element: ELEMENT_KO[rules.dayMaster.element], yinYang: rules.dayMaster.yinYang },
      elements: { counts, weighted },
      tenGods,
      interactions,
      gongmang: { branches: gmBranches, hits: gmHits },
      ...(strength ? { strength } : {}),
      ...(usefulGod ? { usefulGod } : {}),
      ...(climate ? { climate } : {}),
    },
    luck: {
      direction: chart.luck.direction,
      daeun: chart.luck.daeun.map((d) => ({
        index: d.index,
        startAge: d.startAge,
        startYear: d.startYear,
        ganzhi: ganzhi(d.pillar),
        current: currentDaeun ? d.index === currentDaeun.index : false,
      })),
      thisYear: { year: thisYear, ganzhi: ganzhi(yearPillarOfGanzhiYear(thisYear)) },
    },
    personal: {
      userFacts: (personal?.userFacts ?? []).map((f) => {
        const period = fmtPeriod(f.period)
        return { topic: f.topic, value: f.label, ...(period ? { period } : {}) }
      }),
      noGuessYears: (personal?.noGuessYears ?? []).map((y) => y.year),
      guards: [...(personal?.guards ?? GUARDS)],
    },
    warnings,
  }
}
