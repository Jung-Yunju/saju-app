// 2. TENGOD_MISMATCH — 본문이 글자와 십성을 묶어 말하면 규칙 엔진 결과와 대조
// 잡는 꼴(가능한 범위만):
//   A. 글자 → 십성: "酉는 정관", "유(酉)는 정관이야", "酉 정관", "酉가 곧 편재", "유금은 정관"
//   B. 십성 → 글자: "정관인 酉", "정관(酉)", "정관 酉", "정관 유(酉)"
// 대조 기준: ctx.rules(analyzeRules 결과)의 tenGods에서 같은 글자의 십성. 없으면 같은 규칙 함수로 계산.
//   - 겉 글자 기준과 맞으면 통과
//   - 지지인데 지장간 기준이나 다른 학파(지지 음양 기준 byOrder)로만 맞으면 info(불확실)
//   - 일간 자신을 십성으로 부르면(일간 甲을 "비견") info
//   - 어느 기준으로도 안 맞으면 block
//   - 부정문("정관이 아니라")은 건너뛴다
import type { Branch, Stem } from "../../types"
import type { RuleAnalysis, RuleOptions, TenGod } from "../../rules/types"
import { hiddenStemsOf } from "../../rules/hidden"
import { tenGodOfBranch, tenGodOfStem } from "../../rules/basics"
import { DEFAULT_RULE_OPTIONS } from "../../rules/options"
import type { Finding, TextSegment } from "../types"
import { excerptAt, splitSentences } from "../text"
import { BRANCHES, isBranchChar, isStemChar, STEMS, type ChartLetters } from "../letters"

const TEN_GODS: readonly TenGod[] = ["비견", "겁재", "식신", "상관", "편재", "정재", "편관", "정관", "편인", "정인"]
/** 십성 이름·묶음 이름 → 해당 십성들 */
const TENGOD_NAMES: Record<string, readonly TenGod[]> = {
  ...Object.fromEntries(TEN_GODS.map((t) => [t, [t]])),
  칠살: ["편관"],
  효신: ["편인"],
  비겁: ["비견", "겁재"],
  식상: ["식신", "상관"],
  재성: ["편재", "정재"],
  관성: ["편관", "정관"],
  관살: ["편관", "정관"],
  인성: ["편인", "정인"],
}
const NAME_ALT = Object.keys(TENGOD_NAMES).sort((a, b) => b.length - a.length).join("|")

/** 한글 오행 읽기(갑목·유금…) → 한자 한 글자. "신금"은 辛·申 둘 다라 쓰지 않는다 */
const HANGUL_ELEMENT_READINGS: Record<string, string> = {
  갑목: "甲", 을목: "乙", 병화: "丙", 정화: "丁", 무토: "戊", 기토: "己", 경금: "庚", 임수: "壬", 계수: "癸",
  자수: "子", 축토: "丑", 인목: "寅", 묘목: "卯", 진토: "辰", 사화: "巳", 오화: "午", 미토: "未", 유금: "酉", 술토: "戌", 해수: "亥",
}
const HANGUL_ALT = Object.keys(HANGUL_ELEMENT_READINGS).join("|")
/** "상관없다", "상관하지 않는다" 같은 일반어 제외 */
const NAME_END = "(?!\\s?없|하지|하고|않|이\\s?없|념)"
const HANJA = "[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]"

// A: (한글(?)한자 | 한자 | 한글오행) + (조사) + (꾸밈) + 십성
const PAT_A = new RegExp(
  `(?:[가-힣]\\(\\s*(${HANJA})\\s*\\)|(${HANJA})(?![甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥])|(${HANGUL_ALT}))` +
    `\\s*(?:[(（][^)）]{0,4}[)）])?\\s*(?:은|는|이|가|=|:|—|-|,)?\\s*(?:곧|바로|네|너의|너한테|네게|너에게|일간에게|일간 기준|일간 기준으로)?\\s*(${NAME_ALT})${NAME_END}`,
  "g",
)
// B: 십성 + (인|이라는|이란|,|() + 글자
const PAT_B = new RegExp(`(${NAME_ALT})${NAME_END}\\s*(?:인|이라는|이란|으로 오는|으로 온|,|:)?\\s*[(（]?\\s*(?:[가-힣][(（])?\\s*(${HANJA})`, "g")
const NEGATION_AFTER = /^\s*(?:이|가)?\s*(?:아니|아냐|아님)/

export interface TenGodLookup {
  /** 겉 글자(원국·운의 천간·지지) 기준 */
  surface(c: string): Set<TenGod>
  /** 지장간 기준 + 다른 지지 음양 학파 기준까지 넓힌 값 */
  loose(c: string): Set<TenGod>
  dayStem: Stem | null
  /** 규칙 엔진 결과(ctx.rules)를 썼는가 */
  fromRules: boolean
}

export function buildTenGodLookup(letters: ChartLetters, rules?: RuleAnalysis): TenGodLookup {
  const dayStem = (rules?.dayMaster.stem ?? letters.dayStem) as Stem | null
  const opt: RuleOptions = rules?.options ?? { ...DEFAULT_RULE_OPTIONS }
  const fromRules = !!rules
  const surfaceMap = new Map<string, Set<TenGod>>()
  if (rules) {
    for (const h of rules.tenGods) {
      if (h.viaHiddenStem) continue
      const s = surfaceMap.get(h.char) ?? new Set<TenGod>()
      s.add(h.tenGod)
      surfaceMap.set(h.char, s)
    }
  }
  const surface = (c: string): Set<TenGod> => {
    if (!dayStem) return new Set()
    const r = surfaceMap.get(c)
    if (r && r.size) return r
    // 규칙 결과에 없는 글자(원국에 없는 글자 등)는 같은 규칙 함수로 계산
    if (isStemChar(c)) return new Set([tenGodOfStem(dayStem, c)])
    if (isBranchChar(c)) return new Set([tenGodOfBranch(dayStem, c, opt.branchYinYang)])
    return new Set()
  }
  const loose = (c: string): Set<TenGod> => {
    const s = new Set(surface(c))
    if (!dayStem) return s
    if (isBranchChar(c)) {
      s.add(tenGodOfBranch(dayStem, c as Branch, "byMainQi"))
      s.add(tenGodOfBranch(dayStem, c as Branch, "byOrder"))
      for (const h of hiddenStemsOf(c as Branch, opt.hiddenStemTable)) s.add(tenGodOfStem(dayStem, h.stem))
    }
    return s
  }
  return { surface, loose, dayStem, fromRules }
}

function judge(char: string, name: string, lk: TenGodLookup): { severity: "block" | "info" | null; expected: string } {
  const claimed = TENGOD_NAMES[name]
  const surf = lk.surface(char)
  const expected = [...surf].join("·") || "알 수 없음"
  if (!lk.dayStem) return { severity: "info", expected }
  if (claimed.some((t) => surf.has(t))) return { severity: null, expected }
  if (char === lk.dayStem) return { severity: "info", expected: `일간(${expected})` }
  if (claimed.some((t) => lk.loose(char).has(t))) return { severity: "info", expected }
  return { severity: "block", expected }
}

export function checkTenGods(segments: TextSegment[], lk: TenGodLookup): Finding[] {
  const out: Finding[] = []
  for (const seg of segments) {
    if (seg.letterField) continue
    const sentences = splitSentences(seg.text)
    sentences.forEach((s, si) => {
      const loc = sentences.length > 1 ? { ...seg.location, sentence: si } : seg.location
      const seen = new Set<string>()
      const handle = (char: string, name: string, idx: number, len: number) => {
        const k = `${char}:${name}`
        if (seen.has(k)) return
        seen.add(k)
        const tail = s.text.slice(idx + len, idx + len + 6)
        if (NEGATION_AFTER.test(tail)) return
        const { severity, expected } = judge(char, name, lk)
        if (!severity) return
        out.push({
          severity,
          code: "TENGOD_MISMATCH",
          location: loc,
          excerpt: excerptAt(s.text, idx, len),
          rule: severity === "block" ? "mismatch" : "uncertain",
          message:
            severity === "block"
              ? `${char}를 ${name}(이)라 했으나 규칙 엔진 기준 ${char}는 ${expected}`
              : `${char}를 ${name}(이)라 했음 — 겉 글자 기준 ${expected}. 일간 자신이거나 지장간·학파 차이로만 맞을 수 있어 사람 확인 필요`,
        })
      }
      for (const m of s.text.matchAll(PAT_A)) {
        const char = m[1] ?? m[2] ?? HANGUL_ELEMENT_READINGS[m[3]]
        if (char) handle(char, m[4], m.index ?? 0, m[0].length)
      }
      for (const m of s.text.matchAll(PAT_B)) handle(m[2], m[1], m.index ?? 0, m[0].length)
    })
  }
  return out
}

export { STEMS, BRANCHES }
