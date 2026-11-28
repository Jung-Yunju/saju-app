// /api/unmyeong/free 본체(라우트와 분리 — 테스트·재사용용). 로그인·DB·AI 없이 만세력·규칙 엔진 계산만 한다.
// 금지: prisma·Anthropic·세션 접근. 입력(생년월일 등)은 로그·응답에 남기지 않는다. 이름은 받지 않는다(화면에서만 끼운다).
// 흐름: 요청 정리(이름·풀이 종류·상대방 칸 버림) → validateReadingRequest(기존 검증 재사용) → buildSajuInputFromRequest
//      → buildFreeResult(기존 /api/free 표시값 재사용) → computeChart·analyzeRules(근거) → 원형 연결(resolveArchetype) → 5장 문안
import { analyzeRules, computeChart, yearPillarOf, type CalendarResult, type RuleAnalysis } from "@/engine"
import { buildSajuInputFromRequest, type SajuInputData, type SajuRequestPerson } from "@/lib/saju-input"
import { validateReadingRequest, type ReadingRequest, type Result } from "@/lib/validate"
import { buildFreeResult } from "@/app/api/free/_lib/build-result"
import { resolveArchetype } from "./archetype-link"
import { buildBasis } from "./basis"
import { loadFreeCopy, selectFreeChapters } from "./free-copy"
import type { UnmyeongFreeResponse } from "./free-types"

/** 요청 본문 최대 크기(바이트) — 기존 /api/free와 같다 */
export const UNMYEONG_FREE_BODY_LIMIT = 2 * 1024

const SEOUL = "Asia/Seoul"

/**
 * 무료 결과에 쓰지 않는 칸을 검증 전에 버린다: 이름(name), 풀이 종류(readingType), 상대방(other*).
 * 버린 값은 어디에도 옮기지 않는다(검증 오류 문구에도 나오지 않게 검증 전에 지운다).
 */
export function stripUnusedFields(body: unknown): unknown {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return body
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    if (k === "name" || k === "readingType" || /^other[A-Z]?/.test(k)) continue
    out[k] = v
  }
  return out
}

/** 검증을 통과한 한 사람 정보(이름·상대방·풀이 종류 없음) */
export type UnmyeongFreePerson = SajuRequestPerson & { gender: "M" | "F" }

/** 검증된 요청만 통과(이름 없음) */
export function validateUnmyeongFreeRequest(body: unknown): Result<UnmyeongFreePerson> {
  const r = validateReadingRequest(stripUnusedFields(body))
  if (!r.ok) return r
  return { ok: true, value: toPerson(r.value) }
}

function toPerson(v: ReadingRequest): UnmyeongFreePerson {
  // name·other·readingType은 여기서 끊는다
  return {
    year: v.birthYear, month: v.birthMonth, day: v.birthDay, hour: v.birthHour, gender: v.gender, calType: v.calType,
    ...(v.isLeapMonth !== undefined ? { isLeapMonth: v.isLeapMonth } : {}),
    ...(v.birthMinute !== undefined ? { birthMinute: v.birthMinute } : {}),
    ...(v.timeMode !== undefined ? { timeMode: v.timeMode } : {}),
    ...(v.ziNight !== undefined ? { ziNight: v.ziNight } : {}),
    ...(v.birthplace !== undefined ? { birthplace: v.birthplace } : {}),
  }
}

/** 저장 형식 birth("YYYY-MM-DD" 또는 "YYYY-MM-DD HH:MM", 양력·대표 시각) → 날짜·시각 */
function parseBirth(birth: string): { year: number; month: number; day: number; time: { hour: number; minute: number } | null } {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/.exec(birth)
  if (!m) throw new Error("birth 형식 오류")
  return {
    year: Number(m[1]), month: Number(m[2]), day: Number(m[3]),
    time: m[4] !== undefined ? { hour: Number(m[4]), minute: Number(m[5]) } : null,
  }
}

/**
 * 근거용 원국 재계산. buildSajuInput이 이미 양력 변환·시진 대표 시각·출생지 경도를 적용한 birth로 다시 계산한다
 * (generate-reading-v3 prepareReadingV3와 같은 방식). 원국이 다르면 엔진 결함 → 예외(500).
 */
export function chartFromSajuInput(s: SajuInputData, gender: "M" | "F"): CalendarResult {
  const b = parseBirth(s.birth)
  const chart = computeChart({
    calendar: "solar", year: b.year, month: b.month, day: b.day, isLeapMonth: false, time: b.time, timezone: SEOUL,
    ...(s.birthplace ? { longitude: s.birthplace.longitude } : {}),
    gender,
  })
  const g = (p: { stem: string; branch: string } | null | undefined) => (p ? p.stem + p.branch : undefined)
  const same =
    g(chart.pillars.year) === s.pillars.year && g(chart.pillars.month) === s.pillars.month &&
    g(chart.pillars.day) === s.pillars.day && g(chart.pillars.hour) === s.pillars.hour
  if (!same) throw new Error("원국 재계산 불일치")
  return chart
}

export interface BuildUnmyeongFreeOptions {
  /** '올해' 기준 시각(테스트용) */
  now?: Date
  /** 무료 5장 문안 원본(테스트용). 생략하면 content/unmyeong/free-copy.json */
  freeCopy?: unknown
}

/** 검증된 입력 → 응답. 입력 오류면 EngineInputError(라우트가 400), 그 밖은 엔진 결함(500) */
export function buildUnmyeongFree(
  person: UnmyeongFreePerson,
  opts: BuildUnmyeongFreeOptions = {},
): UnmyeongFreeResponse {
  const s = buildSajuInputFromRequest(person, undefined, opts.now ? { now: opts.now } : {})
  // 기존 무료 결과 표시값 재사용. 예전 무료 문안(content/free)은 쓰지 않는다(빈 원본 → copy는 버림)
  const base = buildFreeResult(s, {})
  const chart = chartFromSajuInput(s, person.gender)
  const rules: RuleAnalysis = analyzeRules(chart, undefined, {
    luck: chart.luck.daeun.map((d) => d.pillar),
    year: yearPillarOf(s.this_year),
  })
  const archetype = resolveArchetype(chart, rules)
  const chapters = selectFreeChapters(opts.freeCopy !== undefined ? opts.freeCopy : loadFreeCopy(), archetype)
  return {
    pillars: base.pillars,
    hourUnknown: base.hourUnknown,
    elements: base.elements,
    dayMaster: { hanja: base.dayMaster.hanja, ko: base.dayMaster.ko, element: base.dayMaster.element },
    dayPillar: base.dayPillar,
    daeun: base.daeun,
    thisYear: base.thisYear,
    archetype,
    chapters,
    basis: buildBasis(rules),
    pending: { archetype: archetype === null, chapters: chapters === null },
    warnings: base.warnings,
    engineVersion: base.engineVersion,
  }
}
