// 2. TENGOD_MISMATCH — 본문이 글자와 십성을 묶어 말하면 규칙 엔진 결과와 대조
// verify@0.3.0: 꼴 목록(정규식 두 개) 대신 구조로 찾는다(mentions.ts).
//   ① 문장 안의 모든 천간·지지 언급을 형태 무관하게 뽑는다(甲·甲木·갑(甲)·갑목·丙午·병오(丙午)·"일간 경"·자리 이름 "월지").
//   ② 십성 이름과 언급 사이 글이 결속 문법(조사·꾸밈말·괄호·오행 한자·기준틀)으로만 채워졌으면 묶는다.
//      기준틀("庚 일간에게", "庚金인 너에게")은 건너뛰고 그 앞 언급에 묶는다 — 일간 글자가 끼어도 검사를 멈추지 않는다.
//   ③ 묶인 글자를 규칙 엔진 십성과 대조한다.
// 판정: 겉 글자 기준과 맞으면 통과 / 지장간·다른 학파로만 맞으면 info / 어느 기준으로도 안 맞으면 block.
//   기둥(丙午)은 천간·지지 어느 한쪽이 맞으면 통과. 일간 글자는 비견(비겁)으로만 통과. 부정문("정관이 아니라")은 건너뛴다.
import type { Branch, Stem } from "../../types"
import type { RuleAnalysis, RuleOptions, TenGod } from "../../rules/types"
import { bindTenGods, findMentions, TENGOD_NAMES as NAMES } from "../mentions"
import { hiddenStemsOf } from "../../rules/hidden"
import { tenGodOfBranch, tenGodOfStem } from "../../rules/basics"
import { DEFAULT_RULE_OPTIONS } from "../../rules/options"
import type { Finding, TextSegment } from "../types"
import { excerptAt, splitSentences } from "../text"
import { isBranchChar, isStemChar, type ChartLetters } from "../letters"

/** 십성 이름 → 해당 십성(한자·묶음 이름 포함 — mentions.ts) */
const TENGOD_NAMES = NAMES
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

function judgeOne(char: string, claimed: readonly TenGod[], lk: TenGodLookup): "block" | "info" | null {
  const surf = lk.surface(char)
  if (!lk.dayStem) return "info"
  if (claimed.some((t) => surf.has(t))) return null
  if (claimed.some((t) => lk.loose(char).has(t))) return "info"
  return "block"
}

/** chars가 둘이면 기둥(丙午 등) — 천간·지지 어느 쪽이든 맞으면 통과 */
function judge(chars: string[], name: string, lk: TenGodLookup): { severity: "block" | "info" | null; expected: string } {
  const claimed = TENGOD_NAMES[name]
  const results = chars.map((c) => judgeOne(c, claimed, lk))
  const expected = chars.map((c) => `${c}=${[...lk.surface(c)].join("·") || "알 수 없음"}${c === lk.dayStem ? "(일간)" : ""}`).join(", ")
  if (results.includes(null)) return { severity: null, expected }
  if (results.includes("info")) return { severity: "info", expected }
  return { severity: "block", expected }
}

export function checkTenGods(segments: TextSegment[], lk: TenGodLookup, letters?: ChartLetters): Finding[] {
  const out: Finding[] = []
  for (const seg of segments) {
    if (seg.letterField) continue
    const sentences = splitSentences(seg.text)
    sentences.forEach((s, si) => {
      const loc = sentences.length > 1 ? { ...seg.location, sentence: si } : seg.location
      const seen = new Set<string>()
      const mentions = findMentions(s.text, letters)
      if (mentions.length === 0) return
      for (const b of bindTenGods(s.text, mentions, lk.dayStem)) {
        for (const m of b.mentions) {
          const chars = [...new Set(m.chars)]
          const char = chars.join("")
          const k = `${char}:${b.name.name}`
          if (seen.has(k)) continue
          seen.add(k)
          const { severity, expected } = judge(chars, b.name.name, lk)
          if (!severity) continue
          const from = Math.min(m.index, b.name.index)
          const to = Math.max(m.end, b.name.end)
          out.push({
            severity,
            code: "TENGOD_MISMATCH",
            location: loc,
            excerpt: excerptAt(s.text, from, to - from),
            rule: severity === "block" ? "mismatch" : "uncertain",
            message:
              severity === "block"
                ? `${m.slot ? m.slot + "(" + char + ")" : char}를 ${b.name.name}(이)라 했으나 규칙 엔진 기준 ${expected}`
                : `${char}를 ${b.name.name}(이)라 했음 — 겉 글자 기준 ${expected}. 지장간·학파 차이로만 맞을 수 있어 사람 확인 필요`,
          })
        }
      }
    })
  }
  return out
}
