// 원형 엔진 연결 지점(하나뿐) — D-027 작업 6, D-030.
// analyzeArchetype(RuleAnalysis, 원국) 결과(archetype@0.1.0)를 화면 값 UnmyeongArchetypeView로 바꾼다.
// 원칙: 결정론(같은 사주 → 같은 원형). AI·DB·네트워크를 쓰지 않는다.
//      엔진 내부 기록(basis 전체·sensitivity.byHour·byTable·ruleOptions·rulesHash)은 응답에 싣지 않는다 — 주 원형 관문의 참 조건만 matched로.
// 다리 기운(bridge): 엔진 결과에 값이 없다(variantTags·derived 미구현). 달의 여신 관문(el.strictPairCount ≥ 1)과 같은 정의로
//      규칙 엔진 qiFlow.shares에서 대표 양강 대치 쌍을 다시 골라 통관 오행을 구한다(features.ts el.pairBridge와 같은 식 — 테스트가 대조).
//      못 구하면 null → 문안은 bridgeFallback 문장.
import { analyzeArchetype, ARCHETYPE_TABLE, type ArchetypeResult, type CalendarResult, type Element, type RuleAnalysis } from "@/engine"
import type { ElementKo, UnmyeongArchetypeView } from "./free-types"

const ELEMENTS: readonly Element[] = ["wood", "fire", "earth", "metal", "water"]
const EL_KO: Readonly<Record<Element, ElementKo>> = { wood: "목", fire: "화", earth: "토", metal: "금", water: "수" }
/** 02-archetypes.md §2.2 양강 대치 기준(엔진 features.ts STRICT_PAIR_MIN·STRICT_PAIR_RATIO와 같은 값) */
const PAIR_MIN = 0.3
const PAIR_RATIO = 0.5
const R6 = (x: number): number => Math.round(x * 1e6) / 1e6
/** 다리 기운을 쓰는 원형(양강 대치 관문) */
const BRIDGE_ARCHETYPE = "moon-goddess"

/**
 * 대표 양강 대치 쌍 X>Y(X가 Y를 극함, 둘 다 ≥0.30, 작은쪽/큰쪽 ≥0.5, X 비율 큰 쌍 먼저·동점은 목화토금수 순)의 통관 오행(X가 생하는 오행).
 * 쌍이 없거나 원형 판정 표(kr-monthly-30)와 다른 표로 분석한 값이면 null.
 */
export function pairBridgeOf(rules: RuleAnalysis): ElementKo | null {
  if (rules.options?.hiddenStemTable !== ARCHETYPE_TABLE) return null
  const shares = rules.qiFlow?.shares
  if (!shares) return null
  const strict = ELEMENTS.map((x, i) => {
    const y = ELEMENTS[(i + 2) % 5]
    const sx = shares[x]
    const sy = shares[y]
    const lo = Math.min(sx, sy)
    const hi = Math.max(sx, sy)
    return { x, i, sx, sy, ratio: hi > 0 ? R6(lo / hi) : 0 }
  })
    .filter((p) => p.sx >= PAIR_MIN && p.sy >= PAIR_MIN && p.ratio >= PAIR_RATIO)
    .sort((a, b) => b.sx - a.sx || a.i - b.i)
  if (!strict.length) return null
  return EL_KO[ELEMENTS[(strict[0].i + 1) % 5]]
}

/** 엔진 결과 → 화면 값 */
export function toArchetypeView(r: ArchetypeResult, bridge: ElementKo | null): UnmyeongArchetypeView {
  const gate = r.basis.find((b) => b.id === r.id && b.passed)
  const matched: UnmyeongArchetypeView["matched"] = (gate?.conditions ?? [])
    // 관문을 참으로 만든 잎만(not 안의 잎은 거짓일 때 기여)
    .filter((c) => (c.negated ? !c.ok : c.ok))
    .map((c) => ({
      key: c.key,
      op: c.op,
      value: Array.isArray(c.value) ? [...c.value] : c.value,
      threshold: Array.isArray(c.threshold) ? [...c.threshold] : c.threshold,
      ...(c.negated ? { negated: true as const } : {}),
    }))
  const hour = r.sensitivity.hour
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    order: r.order,
    secondary: r.secondary?.id ?? null,
    secondaryName: r.secondary?.name ?? null,
    variantTags: [],
    bridge: r.id === BRIDGE_ARCHETYPE ? bridge : null,
    matched,
    stability: {
      nearBoundary: false,
      tableSensitive: r.sensitivity.table.changed,
      hourSensitive: hour ? hour.stable < hour.of : null,
    },
    hourUnknownNote: r.hourUnknownNote,
    disclaimer: r.disclaimer,
    disclaimerText: r.disclaimerText,
    version: r.version,
  }
}

/** 원국 + 규칙 해석 → 원형 화면 값. 엔진 입력 오류는 EngineInputError 그대로(호출부가 처리) */
export function resolveArchetype(chart: CalendarResult, rules: RuleAnalysis): UnmyeongArchetypeView {
  const r = analyzeArchetype(rules, chart)
  return toArchetypeView(r, pairBridgeOf(rules))
}
