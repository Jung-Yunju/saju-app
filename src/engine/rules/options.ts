// RuleOptions 기본값·검증 (D-012: 역법 옵션과 분리)
// 기본값은 연구소장 제안(rules-spec.md, schools.md)이며 전부 잠정 — 대표·연구소장 확정 대기.
import { EngineInputError } from "../types"
import type { RuleOptions } from "./types"

export const DEFAULT_RULE_OPTIONS: Readonly<RuleOptions> = Object.freeze({
  hiddenStemTable: "kr-monthly-30", // 잠정: 수치 L0, schools.md §6
  branchYinYang: "byMainQi", // 잠정: 국내 교재 통례로 기억(L0), schools.md §11
  twelveStagesYin: "reverse", // 잠정: lunar-javascript·기존 서비스와 같음, schools.md §7
  earthStages: "withFire", // 잠정: 화토동법, schools.md §7
  strengthModel: "weighted-v1", // 잠정: 연구소장 설계값(고전 수치 아님), schools.md §8
  gongmangBasis: "day", // 잠정: rules-spec §8 기본(schools.md §10은 "both 저장"도 언급 — 확인 필요)
  halfCombine: "withKingOnly", // 잠정: rules-spec §7
  partialPunishment: true, // 잠정: rules-spec §7 (두 글자도 partial: true로 기록)
  wuWeiCombine: "none", // 잠정: rules-spec §7 (합만 표시, 결과 오행 판정 안 함)
  partialDirectional: false, // 잠정: rules-spec §7 "기본: 세 글자만" (키 이름은 엔진 개발자 추가)
} satisfies RuleOptions)

const ALLOWED: { [K in keyof RuleOptions]: readonly RuleOptions[K][] } = {
  hiddenStemTable: ["kr-monthly-30", "cn-lunarjs", "main-only"],
  branchYinYang: ["byMainQi", "byOrder"],
  twelveStagesYin: ["reverse", "sameAsYang"],
  earthStages: ["withFire", "withWater"],
  strengthModel: ["weighted-v1"],
  gongmangBasis: ["day", "year", "both"],
  halfCombine: ["withKingOnly", "allPairs"],
  partialPunishment: [true, false],
  wuWeiCombine: ["fire", "earth", "none"],
  partialDirectional: [true, false],
}

/**
 * 부분 옵션 → 전체 옵션. 모르는 키·지원하지 않는 값은 EngineInputError(조용히 기본값으로 바꾸지 않는다).
 * 값이 undefined인 키는 생략으로 보고 기본값을 쓴다.
 */
export function resolveRuleOptions(options?: Partial<RuleOptions>): RuleOptions {
  const o: RuleOptions = { ...DEFAULT_RULE_OPTIONS }
  if (options === undefined || options === null) return o
  if (typeof options !== "object") throw new EngineInputError("규칙 옵션은 객체여야 함")
  for (const key of Object.keys(options)) {
    if (!Object.prototype.hasOwnProperty.call(ALLOWED, key)) throw new EngineInputError(`알 수 없는 규칙 옵션: ${key}`)
    const k = key as keyof RuleOptions
    const v = options[k]
    if (v === undefined) continue
    if (!(ALLOWED[k] as readonly unknown[]).includes(v)) throw new EngineInputError(`${k} 옵션 값 오류: ${String(v)}`)
    ;(o as unknown as Record<string, unknown>)[k] = v
  }
  return o
}
