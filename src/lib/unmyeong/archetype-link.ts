// 원형 엔진 연결 지점(하나뿐) — D-027 작업 6.
// 지금은 src/engine/archetype/ 가 없어서 null을 돌려준다(응답 pending.archetype = true).
// 엔진 개발자가 classifyArchetype(공개 API 추가는 총괄실장 승인)를 만들면 이 함수 본문만 바꾼다:
//
//   import { classifyArchetype } from "@/engine/archetype"
//   const r = classifyArchetype(chart, rules)
//   return { id: r.id, order: r.order, secondary: r.secondary, variantTags: r.variantTags, matched: r.matched,
//            stability: { nearBoundary: r.stability.nearBoundary, tableSensitive: r.stability.tableSensitive, hourSensitive: r.stability.hourSensitive },
//            disclaimer: r.disclaimer, version: r.version }
//
// 원칙: 결정론(같은 사주 → 같은 원형). AI·DB·네트워크를 쓰지 않는다. trace·derived 같은 내부 기록은 응답에 싣지 않는다.
import type { CalendarResult, RuleAnalysis } from "@/engine"
import type { UnmyeongArchetypeView } from "./free-types"

export function resolveArchetype(chart: CalendarResult, rules: RuleAnalysis): UnmyeongArchetypeView | null {
  void chart
  void rules
  return null
}
