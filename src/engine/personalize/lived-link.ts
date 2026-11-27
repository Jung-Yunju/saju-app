// 사주 경향 ↔ 사용자 사실 연결 (D-023 ①, docs/knowledge/personalization/lived-life.md). 순수 함수.
// 이 표는 "문장을 어떤 문형으로 쓸지" 고르는 편의 매핑이지 사주 판정이 아니다.
// 십성 개수는 규칙 엔진 결과를 호출자가 집계해 넘긴다(여기서 계산하지 않는다).
import type { UserFact } from "./types"

export type TenGodGroup = "bigeop" | "siksang" | "jaeseong" | "gwanseong" | "inseong"

/** 원국에서 각 십성 묶음이 몇 개 보이는지(호출자 집계). 없는 키 = 0 */
export type GroupCounts = Partial<Record<TenGodGroup, number>>

export type LinkKind =
  | "match" // 글자에도 있고 사용자도 말함 → 확인하는 문형
  | "mismatch" // 글자에는 약한데 사용자는 살아 냄 → 글자 밖에서 익힌 힘 문형
  | "unlinked" // 사주 글자와 연결할 근거가 없음 → 사실만 배경으로, 사주로 설명하지 않음

export interface LivedLink {
  factId: string
  kind: LinkKind
  group?: TenGodGroup
  /** 글자 쪽 개수(match/mismatch일 때) */
  chartCount?: number
  source: "user"
}

/** (questionId, value) → 관련 십성 묶음. 매핑 없는 사실은 unlinked */
const VALUE_GROUP: Readonly<Record<string, TenGodGroup>> = {
  "occupationStatus:self_employed": "jaeseong",
  "occupationStatus:employed": "gwanseong",
  "occupationStatus:freelance": "siksang",
  "occupationStatus:student": "inseong",
  "workStyle:solo_deep": "inseong",
  "workStyle:team": "bigeop",
  "workStyle:people_facing": "siksang",
  "workStyle:leading": "gwanseong",
  "recentChanges:business_start": "jaeseong",
  "recentChanges:job_change": "gwanseong",
  "lifeEvents:business_start": "jaeseong",
  "selfStrength:persistence": "bigeop",
  "selfStrength:communication": "siksang",
  "selfStrength:planning": "gwanseong",
  "selfStrength:creativity": "siksang",
  "selfStrength:caring": "inseong",
  "selfStrength:learning": "inseong",
  "selfWeakness:saving": "jaeseong",
}

/** 한 사실을 글자(십성 개수)와 맞대어 3가지 중 하나로 분류한다. 사실을 바꾸거나 덧붙이지 않는다. */
export function linkFactToChart(fact: UserFact, counts: GroupCounts): LivedLink {
  const group = VALUE_GROUP[`${fact.questionId}:${fact.value}`]
  if (!group) return { factId: fact.id, kind: "unlinked", source: "user" }
  const n = counts[group] ?? 0
  return { factId: fact.id, kind: n > 0 ? "match" : "mismatch", group, chartCount: n, source: "user" }
}

export function linkFactsToChart(facts: readonly UserFact[], counts: GroupCounts): LivedLink[] {
  return facts.map((f) => linkFactToChart(f, counts))
}
