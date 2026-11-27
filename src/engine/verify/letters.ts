// 간지 글자 사전 · 원국/운 글자 집합 · 본문 간지 토큰 찾기 (P4-04)
// 오검출 방지 설계(BASIS_NOT_IN_CHART):
//   1) 한자 천간+지지가 붙어 있고 음양이 맞으면(甲子·乙丑…) 60갑자 한 기둥으로 본다.
//   2) 홀로 쓰인 천간·지지 한자는 한 글자로 본다. 단 일반 한자어(子女·未來·午前·自己·辛苦 등)에 든 글자와
//      『』《》〈〉 안(서명)의 글자는 세지 않는다.
//   3) 역사 사건 이름(壬辰倭亂·乙巳條約 등) 앞의 간지는 세지 않는다.
//   4) 한글 간지(병오·정미…)는 뒤에 "년·년생·일주·월주·연주·시주·대운·세운"이 붙을 때만 센다
//      ("갑자기", "임신", "경신(更新)" 같은 일반어 오검출 방지).
import type { Branch, Pillar, Stem } from "../types"
import { yearPillarOfGanzhiYear } from "../calendar/pillars"
import { hiddenStemsOf } from "../rules/hidden"
import { DEFAULT_RULE_OPTIONS } from "../rules/options"
import type { HiddenStemTableId } from "../rules/types"

export const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const
export const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const
export const STEM_KO = "갑을병정무기경신임계"
export const BRANCH_KO = "자축인묘진사오미신유술해"
const STEM_SET = new Set<string>(STEMS)
const BRANCH_SET = new Set<string>(BRANCHES)

export const isStemChar = (c: string): c is Stem => STEM_SET.has(c)
export const isBranchChar = (c: string): c is Branch => BRANCH_SET.has(c)
export const isGanzhiChar = (c: string) => STEM_SET.has(c) || BRANCH_SET.has(c)

/** "甲子" → Pillar. 음양이 안 맞거나 간지가 아니면 null */
export function parsePillar(v: unknown): Pillar | null {
  if (typeof v !== "string") return null
  const cs = [...v.trim()]
  if (cs.length !== 2) return null
  const s = (STEMS as readonly string[]).indexOf(cs[0])
  const b = (BRANCHES as readonly string[]).indexOf(cs[1])
  if (s < 0 || b < 0 || s % 2 !== b % 2) return null
  return { stem: STEMS[s], branch: BRANCHES[b] }
}

export const gz = (p: Pillar) => p.stem + p.branch

/** 한글 간지("병오") → 한자("丙午"). 간지가 아니면 null */
export function hangulToGanzhi(ko: string): string | null {
  if (ko.length !== 2) return null
  const s = STEM_KO.indexOf(ko[0])
  const b = BRANCH_KO.indexOf(ko[1])
  if (s < 0 || b < 0 || s % 2 !== b % 2) return null
  return STEMS[s] + BRANCHES[b]
}

export function yearGanzhi(year: number): string {
  return gz(yearPillarOfGanzhiYear(year))
}

// ─────────────────────────────────────────── 원국·운 글자 집합

export interface ChartLetters {
  /** 기둥 간지 → 어디서 왔는지(예: "일주", "대운 3(2011)", "세운 2026") */
  pillars: Map<string, string[]>
  /** 겉에 드러난 천간·지지 한 글자 → 출처(원국·대운·세운 전부) */
  chars: Map<string, string[]>
  /** 원국 네 기둥의 겉 글자 */
  natalChars: Set<string>
  /** 원국 지지의 지장간(겉 글자에 없는 것만 의미 있음) → 출처 */
  hidden: Map<string, string[]>
  /** 공망 지지(원국에 없어도 "공망 戌亥"처럼 적을 수 있다) */
  gongmang: Set<string>
  dayStem: Stem | null
  natal: { year: Pillar | null; month: Pillar | null; day: Pillar | null; hour: Pillar | null }
  daeun: { ganzhi: string; start_year: number; start_age: number }[]
  thisYear: number | null
  /** sajuInput 자체가 깨져 있으면 그 이유 */
  problems: string[]
}

export function buildChartLetters(
  input: {
    pillars?: { year?: string; month?: string; day?: string; hour?: string }
    hour_unknown?: boolean
    daeun?: { start_year: number; start_age: number; ganzhi: string }[]
    gongmang?: { day?: string; year?: string }
    this_year?: number
    this_year_ganzhi?: string
  },
  hiddenTable: HiddenStemTableId = DEFAULT_RULE_OPTIONS.hiddenStemTable,
): ChartLetters {
  const pillars = new Map<string, string[]>()
  const chars = new Map<string, string[]>()
  const hidden = new Map<string, string[]>()
  const add = (m: Map<string, string[]>, k: string, label: string) => {
    const a = m.get(k)
    if (a) {
      if (!a.includes(label)) a.push(label)
    } else m.set(k, [label])
  }
  const problems: string[] = []
  const natalChars = new Set<string>()
  const addPillar = (p: Pillar, label: string, natal = false) => {
    add(pillars, gz(p), label)
    add(chars, p.stem, label)
    add(chars, p.branch, label)
    if (natal) {
      natalChars.add(p.stem)
      natalChars.add(p.branch)
    }
  }
  const ip = input.pillars ?? {}
  const natal = {
    year: parsePillar(ip.year),
    month: parsePillar(ip.month),
    day: parsePillar(ip.day),
    hour: input.hour_unknown ? null : parsePillar(ip.hour),
  }
  const names = { year: "연주", month: "월주", day: "일주", hour: "시주" } as const
  for (const k of ["year", "month", "day", "hour"] as const) {
    const p = natal[k]
    if (p) {
      addPillar(p, names[k], true)
      for (const h of hiddenStemsOf(p.branch, hiddenTable)) add(hidden, h.stem, `${names[k]} ${p.branch} 지장간`)
    } else if (k !== "hour") problems.push(`${names[k]} 간지가 올바르지 않음: ${String(ip[k])}`)
    else if (!input.hour_unknown && ip.hour !== undefined) problems.push(`시주 간지가 올바르지 않음: ${String(ip.hour)}`)
  }
  const daeun: ChartLetters["daeun"] = []
  ;(input.daeun ?? []).forEach((d, i) => {
    const p = parsePillar(d?.ganzhi)
    if (!p) {
      problems.push(`대운[${i}] 간지가 올바르지 않음: ${String(d?.ganzhi)}`)
      return
    }
    addPillar(p, `대운 ${i + 1}(${d.start_year})`)
    daeun.push({ ganzhi: gz(p), start_year: d.start_year, start_age: d.start_age })
  })
  let thisYear: number | null = null
  if (typeof input.this_year === "number") {
    thisYear = input.this_year
    const p = parsePillar(input.this_year_ganzhi)
    if (p) addPillar(p, `세운 ${input.this_year}`)
    else problems.push(`올해 간지가 올바르지 않음: ${String(input.this_year_ganzhi)}`)
  } else {
    const p = parsePillar(input.this_year_ganzhi)
    if (p) addPillar(p, "세운")
  }
  const gongmang = new Set<string>()
  for (const v of [input.gongmang?.day, input.gongmang?.year]) if (typeof v === "string") for (const c of v) if (isBranchChar(c)) gongmang.add(c)
  return { pillars, chars, natalChars, hidden, gongmang, dayStem: natal.day?.stem ?? null, natal, daeun, thisYear, problems }
}

// ─────────────────────────────────────────── 본문 간지 토큰

/** 일반 한자어 — 이 낱말 안의 천간·지지 글자는 근거 글자로 세지 않는다 */
export const GENERAL_HANJA_WORDS: readonly string[] = [
  // 子
  "子女", "子息", "子孫", "孔子", "孟子", "老子", "莊子", "君子", "弟子", "母子", "父子", "女子", "男子", "王子", "太子",
  "原子", "分子", "電子", "因子", "獅子", "椅子", "帽子", "種子", "精子", "卵子", "利子", "冊子", "子平", "子正", "子宮",
  // 午·未·申·辰
  "午前", "午後", "正午", "端午", "未來", "未定", "未完", "未熟", "未滿", "未知", "未然", "未婚", "未納", "未達", "未明",
  "申告", "申請", "生辰", "誕辰", "星辰", "日辰",
  // 甲·乙·丁·己·辛
  "甲富", "甲乙", "甲板", "甲殼", "回甲", "還甲", "甲骨", "甲狀", "壯丁", "白丁", "丁寧", "園丁", "兵丁",
  "自己", "知己", "克己", "利己", "辛苦", "辛辣", "辛勝", "香辛",
]

/** 이 말 앞의 간지는 역사 사건 이름(壬辰倭亂 등)으로 보고 세지 않는다 */
const HISTORY_SUFFIX = ["倭亂", "胡亂", "改革", "士禍", "政變", "換局", "獄事", "事變", "條約", "勒約", "戰爭", "革命", "農民", "運動", "國恥", "洋擾", "軍亂", "再亂"]

const HANGUL_SUFFIX_RE = /^\s?(년생|년|일주|월주|연주|년주|시주|대운|세운)/

export interface GanzhiToken {
  kind: "pillar" | "char" | "hangulPillar"
  /** 한자 간지 또는 한 글자(한글 간지는 한자로 바꾼 값) */
  value: string
  /** 글 안 위치 */
  index: number
  length: number
}

function bracketMask(text: string): boolean[] {
  const mask = new Array<boolean>(text.length).fill(false)
  const pairs: [string, string][] = [["『", "』"], ["《", "》"], ["〈", "〉"]]
  for (const [o, c] of pairs) {
    let i = text.indexOf(o)
    while (i >= 0) {
      const j = text.indexOf(c, i + 1)
      if (j < 0) break
      for (let k = i; k <= j; k++) mask[k] = true
      i = text.indexOf(o, j + 1)
    }
  }
  return mask
}

function generalWordMask(text: string): boolean[] {
  const mask = new Array<boolean>(text.length).fill(false)
  for (const w of GENERAL_HANJA_WORDS) {
    let i = text.indexOf(w)
    while (i >= 0) {
      for (let k = i; k < i + w.length; k++) mask[k] = true
      i = text.indexOf(w, i + 1)
    }
  }
  return mask
}

/**
 * 글에서 간지 토큰을 찾는다.
 * @param strict true면 일반 한자어·서명 예외를 두지 않는다(chips.letter 같은 간지 전용 칸)
 */
export function findGanzhiTokens(text: string, strict = false): GanzhiToken[] {
  const out: GanzhiToken[] = []
  const skip = strict ? new Array<boolean>(text.length).fill(false) : bracketMask(text)
  const general = strict ? new Array<boolean>(text.length).fill(false) : generalWordMask(text)
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (!isGanzhiChar(c) || skip[i] || general[i]) continue
    const n = text[i + 1]
    if (isStemChar(c) && n !== undefined && isBranchChar(n) && !general[i + 1] && parsePillar(c + n)) {
      const after = text.slice(i + 2, i + 4)
      if (!strict && HISTORY_SUFFIX.includes(after)) {
        i++
        continue
      }
      out.push({ kind: "pillar", value: c + n, index: i, length: 2 })
      i++
      continue
    }
    out.push({ kind: "char", value: c, index: i, length: 1 })
  }
  // 한글 간지 + 접미어
  if (!strict) {
    for (let i = 0; i + 1 < text.length; i++) {
      const prev = i > 0 ? text[i - 1] : ""
      if (prev && /[가-힣]/.test(prev)) continue
      const g = hangulToGanzhi(text.slice(i, i + 2))
      if (!g) continue
      if (!HANGUL_SUFFIX_RE.test(text.slice(i + 2, i + 6))) continue
      // "병오(丙午)년"처럼 바로 뒤에 한자가 같이 오면 한자 쪽에서 이미 센다
      out.push({ kind: "hangulPillar", value: g, index: i, length: 2 })
    }
  }
  return out.sort((a, b) => a.index - b.index)
}

/** 운(대운·세운)을 말하는 문맥 표지 — 원국에 없고 운에만 있는 한 글자를 쓸 때 문장에 있어야 한다 */
export const LUCK_MARKER_RE = /대운|세운|운(에|이|으로|의|에서|이 들|이 바뀌)|올해|금년|내년|후년|그해|이듬해|(1[89]\d{2}|20\d{2})|\d{1,3}\s*(살|세)|\d0\s*대|스무|서른|마흔|쉰|예순|일흔|여든|들어오|들어온|찾아오|찾아온/

/** 지장간을 말하는 문맥 표지 */
export const HIDDEN_MARKER_RE = /지장간|속에|속의|속 |안에 든|안에 품|품은|품고|숨은|숨어|감춘|감춰|여기|중기|정기/
