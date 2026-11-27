// 음력 ↔ 양력 — 한국 음력(한국천문연구원 방식) (P3-03)
//
// 왜 직접 구성하나
//   lunar-javascript의 농력(農曆)은 '중국 음력'으로, 합삭·中氣의 날짜를 북경시(UTC+8)로 판정한다.
//   한국 음력은 한국 표준시(UTC+9) 날짜로 판정하므로 합삭이 북경시 23시대(한국시 0시대)에 걸리면
//   초하루가 하루 다르고, 드물게 윤달 위치도 다르다. 품질검증 골든셋(한국 설날·윤달)과 대조한 결과
//   라이브러리 농력을 그대로 쓰면 92건 중 7건이 틀렸다(1997·2027·2028 설날 하루 차이,
//   2012 윤3월·2017 윤5월은 중국이 윤4월·윤6월이라 입력 자체가 거부됨).
//   → docs/SAJU_ENGINE.md "만세력" 절의 방침(오차 시 천문 알고리즘으로 교체)에 따라,
//     천문 계산(합삭 시각·절기 시각)만 lunar-javascript(寿星天文历)의 정밀식을 쓰고
//     날짜 판정·치윤 규칙은 이 파일에서 UTC+9 기준으로 직접 한다.
//
// 규칙(시헌력 계열, 현행 한국 음력)
//   1) 날짜 판정 시각대: UTC+9 고정(1954~61년 UTC+8:30 시기·1912년 이전도 UTC+9로 계산 — 위험 항목).
//   2) 합삭(삭)이 든 날이 초하루.
//   3) 冬至가 든 달이 11월.
//   4) 冬至 달에서 다음 冬至 달 사이에 달이 13개면, 그 사이에서 처음으로 中氣가 없는 달을 윤달로 한다(무중치윤).
//   윤달 표기: 엔진 API는 { month, isLeapMonth }. (lunar-javascript 관례의 음수 월 = 윤달과 같은 의미)
import { EngineInputError } from "../types"
import { MAX_YEAR, MIN_YEAR, MS_PER_DAY, daysInMonth } from "./constants"
import { lunarLib } from "./lunar-lib"
import { termsOfYear } from "./solarterms"

export interface SimpleDate {
  year: number
  month: number
  day: number
}

export interface LunarDate extends SimpleDate {
  isLeapMonth: boolean
}

const KST_MS = 9 * 3_600_000
/** J2000.0 = 2000-01-01 12:00 (라이브러리의 일수 기준점, UT로 사용) */
const J2000_MS = Date.UTC(2000, 0, 1, 12)
/** 평균 삭망월(일) — 합삭 번호 추정용 */
const SYNODIC = 29.530588853
/** 2000-01-06 18:14 UTC 합삭(번호 0) 근방 — 추정용 기준 */
const NEW_MOON_0_MS = Date.UTC(2000, 0, 6, 18, 14)
/** 합삭이 한국시 자정에서 이 범위 안이면 천문 계산 오차로 초하루가 바뀔 수 있다고 경고 */
const MIDNIGHT_RISK_MS = 3 * 60_000

const ZHONGQI = new Set(["冬至", "大寒", "雨水", "春分", "穀雨", "小滿", "夏至", "大暑", "處暑", "秋分", "霜降", "小雪"])

/**
 * k번째 합삭 순간(UTC ms). 日月黃經差 = k×2π 가 되는 순간.
 * lunar-javascript ShouXingUtil.msaLonT(정밀식, 역학시 세기) → ×36525일 → ΔT(dtT) 빼서 UT.
 * 라이브러리 shuoHigh는 북경시 자정 근처가 아니면 저정밀식(수십 초 오차)을 쓰므로 쓰지 않는다.
 * 검산: 2024-02-09 22:59 UTC 합삭(공개 천문 자료) → 22:59:11Z.
 */
export function newMoonUtcMs(k: number): number {
  const tTT = lunarLib.ShouXingUtil.msaLonT(k * 2 * Math.PI) * 36525
  const tUT = tTT - lunarLib.ShouXingUtil.dtT(tTT)
  return J2000_MS + tUT * MS_PER_DAY
}

/** UTC ms → 한국시(UTC+9) 날짜의 epoch 일수(1970-01-01 = 0) */
function kstDay(utcMs: number): number {
  return Math.floor((utcMs + KST_MS) / MS_PER_DAY)
}

function epochDay(y: number, m: number, d: number): number {
  return Math.floor(Date.UTC(y, m - 1, d) / MS_PER_DAY)
}

function fromEpochDay(n: number): SimpleDate {
  const t = new Date(n * MS_PER_DAY)
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() }
}

interface KMonth {
  lunarYear: number
  month: number
  leap: boolean
  /** 초하루 epoch 일수(KST 날짜) */
  start: number
  /** 다음 달 초하루 epoch 일수 */
  end: number
  /** 초하루 합삭이 한국시 자정 ±3분 이내 */
  midnightRisk: boolean
}

/** 합삭 KST 날짜가 day 이하인 가장 늦은 합삭 번호 */
function lastNewMoonOnOrBefore(day: number): number {
  let k = Math.floor(((day + 1) * MS_PER_DAY - KST_MS - NEW_MOON_0_MS) / MS_PER_DAY / SYNODIC)
  while (kstDay(newMoonUtcMs(k + 1)) <= day) k++
  while (kstDay(newMoonUtcMs(k)) > day) k--
  return k
}

const suiCache = new Map<number, KMonth[]>()

/**
 * 세(歲) G: (G−1)년 冬至가 든 달(11월)부터 G년 冬至가 든 달 직전까지의 달 목록.
 * 앞의 11·12월(과 그 사이 윤달)은 음력 G−1년, 1월부터는 음력 G년.
 */
function sui(G: number): KMonth[] {
  const cached = suiCache.get(G)
  if (cached) return cached
  const wsA = kstDay(termsOfYear(G - 1).find((t) => t.name === "冬至")!.utcMs)
  const wsB = kstDay(termsOfYear(G).find((t) => t.name === "冬至")!.utcMs)
  const kA = lastNewMoonOnOrBefore(wsA)
  const kB = lastNewMoonOnOrBefore(wsB)
  const zq = [...termsOfYear(G - 1), ...termsOfYear(G)].filter((t) => ZHONGQI.has(t.name)).map((t) => kstDay(t.utcMs))
  const n = kB - kA // 12 또는 13
  if (n !== 12 && n !== 13) throw new Error(`세(歲) ${G}의 달 수 이상: ${n}`)
  const out: KMonth[] = []
  let leapUsed = n === 12 // 12개월이면 윤달 없음
  let label = 10 // 첫 달(冬至 달)에서 11이 되도록
  let yearOfLabel = G - 1
  for (let k = kA; k < kB; k++) {
    const nm = newMoonUtcMs(k)
    const start = kstDay(nm)
    const end = kstDay(newMoonUtcMs(k + 1))
    const hasZhongqi = zq.some((d) => d >= start && d < end)
    let leap = false
    if (!leapUsed && !hasZhongqi && k !== kA) {
      leap = true
      leapUsed = true
    } else {
      label = label === 12 ? 1 : label + 1
      if (label === 1) yearOfLabel = G
    }
    const tod = (nm + KST_MS) - start * MS_PER_DAY
    out.push({
      lunarYear: yearOfLabel,
      month: label,
      leap,
      start,
      end,
      midnightRisk: tod < MIDNIGHT_RISK_MS || MS_PER_DAY - tod < MIDNIGHT_RISK_MS,
    })
  }
  suiCache.set(G, out)
  return out
}

function findMonth(lunarYear: number, month: number, leap: boolean): KMonth | undefined {
  return [...sui(lunarYear), ...sui(lunarYear + 1)].find((m) => m.lunarYear === lunarYear && m.month === month && m.leap === leap)
}

function monthOfDay(day: number, gregYear: number): KMonth {
  const m = [...sui(gregYear), ...sui(gregYear + 1)].find((x) => x.start <= day && day < x.end)
  if (!m) throw new Error(`음력 달을 찾지 못함: epoch day ${day}`)
  return m
}

/** 음력 Y년의 윤달 번호(없으면 0) */
export function leapMonthOf(lunarYear: number): number {
  const m = [...sui(lunarYear), ...sui(lunarYear + 1)].find((x) => x.lunarYear === lunarYear && x.leap)
  return m ? m.month : 0
}

function assertInt(v: unknown, name: string): asserts v is number {
  if (typeof v !== "number" || !Number.isInteger(v)) throw new EngineInputError(`${name}는 정수여야 함: ${String(v)}`)
}

/** 양력 날짜 유효성(1900~2100) 검사. 아니면 EngineInputError */
export function assertSolarDate(y: number, m: number, d: number): void {
  assertInt(y, "연도")
  assertInt(m, "월")
  assertInt(d, "일")
  if (y < MIN_YEAR || y > MAX_YEAR) throw new EngineInputError(`연도는 ${MIN_YEAR}~${MAX_YEAR}만 지원: ${y}`)
  if (m < 1 || m > 12) throw new EngineInputError(`월은 1~12: ${m}`)
  if (d < 1 || d > daysInMonth(y, m)) throw new EngineInputError(`존재하지 않는 양력 날짜: ${y}-${m}-${d}`)
}

/**
 * 한국 음력 → 양력.
 * - 그 해에 해당 윤달이 없으면 EngineInputError
 * - 그 달의 날수(29/30)를 넘는 날이면 EngineInputError
 */
export function lunarToSolar(year: number, month: number, day: number, isLeapMonth: boolean): SimpleDate {
  assertInt(year, "음력 연도")
  assertInt(month, "음력 월")
  assertInt(day, "음력 일")
  if (year < MIN_YEAR || year > MAX_YEAR) throw new EngineInputError(`음력 연도는 ${MIN_YEAR}~${MAX_YEAR}만 지원: ${year}`)
  if (month < 1 || month > 12) throw new EngineInputError(`음력 월은 1~12: ${month}`)
  if (day < 1 || day > 30) throw new EngineInputError(`음력 일은 1~30: ${day}`)
  const m = findMonth(year, month, isLeapMonth)
  if (!m) {
    const leap = leapMonthOf(year)
    throw new EngineInputError(
      `음력 ${year}년에는 윤${month}월이 없음` + (leap ? ` (그 해 윤달: 윤${leap}월)` : " (그 해 윤달 없음)"),
    )
  }
  const count = m.end - m.start
  if (day > count) {
    throw new EngineInputError(`음력 ${year}년 ${isLeapMonth ? "윤" : ""}${month}월은 ${count}일까지만 있음: ${day}일`)
  }
  return fromEpochDay(m.start + day - 1)
}

/** 양력 → 한국 음력 */
export function solarToLunar(year: number, month: number, day: number): LunarDate {
  const d = epochDay(year, month, day)
  const m = monthOfDay(d, year)
  return { year: m.lunarYear, month: m.month, day: d - m.start + 1, isLeapMonth: m.leap }
}

/**
 * 천문 계산 오차 위험: 그 날이 속한 음력 달(음력 입력이면 그 달과 다음 달)의 초하루 합삭이
 * 한국시 자정 ±3분 이내면 true. 이때는 공식 역서와 하루 다를 수 있다.
 */
export function solarToLunarRisk(year: number, month: number, day: number): boolean {
  return monthOfDay(epochDay(year, month, day), year).midnightRisk
}

export function lunarToSolarRisk(year: number, month: number, isLeapMonth: boolean): boolean {
  const m = findMonth(year, month, isLeapMonth)
  if (!m) return false
  if (m.midnightRisk) return true
  const next = monthOfDay(m.end, fromEpochDay(m.end).year)
  return next.midnightRisk
}
