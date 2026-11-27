// 공망(空亡, 旬空) — 명리 규칙 계산 (docs/knowledge/rules-spec.md §8)
// 순수 함수. 해석(해공 등)은 하지 않고 '어느 두 지지가 비었는가'만 계산한다.
//
// 규칙
//   60갑자 번호 i(甲子=0 … 癸亥=59)의 순두(旬首) 번호 h = i − (i mod 10)  (그 순의 甲 기둥)
//   공망 지지 번호 = (h + 10) mod 12, (h + 11) mod 12    (子=0 … 亥=11)
//   = rules-spec §8의 x = (b − s + 12) mod 12 (순 첫 지지), 공망 {(x+10)%12, (x+11)%12} 와 같은 식
//     (h mod 12 = (i − s) mod 12 = (b − s) mod 12 이므로)
//
// 표(rules-spec §8)
//   甲子순 戌亥 · 甲戌순 申酉 · 甲申순 午未 · 甲午순 辰巳 · 甲辰순 寅卯 · 甲寅순 子丑
import type { Branch, Pillar } from "../types"
import { BRANCHES, sexagenary, sexagenaryIndex } from "../calendar/constants"

/** 규칙 모듈 버전. 규칙 계산 결과가 바뀌면 올린다(rules 모듈이 늘면 rules 공통 파일로 옮긴다). */
export const RULES_ENGINE_VERSION = "rules@0.1.0"

export interface XunKong {
  /** 순두(그 순의 甲 기둥) 예: 甲辰 */
  xunHead: Pillar
  /** 공망 두 지지(지지 순서대로) 예: [寅, 卯] */
  empty: [Branch, Branch]
}

/** 기둥(간지)이 속한 순(旬)과 공망 두 지지. 음양이 맞지 않는 간지면 Error */
export function xunKongOf(p: Pillar): XunKong {
  const i = sexagenaryIndex(p)
  const head = i - (i % 10)
  return {
    xunHead: sexagenary(head),
    empty: [BRANCHES[(head + 10) % 12], BRANCHES[(head + 11) % 12]],
  }
}

/** 공망 두 지지를 붙인 문자열 예: 甲辰 → "寅卯" (lunar-javascript getDayXunKong과 같은 표기) */
export function gongmangString(p: Pillar): string {
  return xunKongOf(p).empty.join("")
}
