// 기세(氣勢) 수치·표지 (strength-structure-spec §5, rules@0.3.0)
// 청탁·진가·순역의 최종 판정은 내지 않는다(§5.2). 수치 기준(0.10 등)은 연구소장 설계값.
import type { Element } from "../types"
import { ELEMENTS, stemElement, tenGodOfStem } from "./basics"
import { elementOfGroup, groupOf, otherStems, round6, stemPos, type Natal } from "./groups"
import type { Position, QiFlowResult, TenGod, TenGodGroup } from "./types"

export const FLOW_MIN_SHARE = 0.1

/**
 * 비율 ≥ 0.10인 오행만으로 상생 순서(목→화→토→금→수→목)의 가장 긴 연쇄.
 * 다섯이 다 있으면 circular(목부터). 길이가 같으면 비율 합이 큰 쪽, 그다음 시작 오행 순(엔진 개발자 정의).
 */
export function flowChainOf(shares: Record<Element, number>): QiFlowResult["flowChain"] {
  const on = ELEMENTS.map((e) => shares[e] >= FLOW_MIN_SHARE)
  if (on.every(Boolean)) return { elements: [...ELEMENTS], circular: true }
  let best: Element[] = []
  let bestSum = -1
  for (let s = 0; s < 5; s++) {
    if (!on[s] || on[(s + 4) % 5]) continue // 연쇄의 시작점만
    const chain: Element[] = []
    for (let i = s; on[i % 5] && chain.length < 5; i++) chain.push(ELEMENTS[i % 5])
    const sum = chain.reduce((a, e) => a + shares[e], 0)
    if (chain.length > best.length || (chain.length === best.length && sum > bestSum + 1e-12)) {
      best = chain
      bestSum = sum
    }
  }
  return { elements: best, circular: false }
}

export function analyzeQiFlow(n: Natal, weighted: Record<Element, number>, total: number): QiFlowResult {
  const shares = Object.fromEntries(ELEMENTS.map((e) => [e, round6(weighted[e] / total)])) as Record<Element, number>
  let dom: Element = ELEMENTS[0]
  for (const e of ELEMENTS) if (shares[e] > shares[dom]) dom = e
  const concentration = round6(ELEMENTS.reduce((a, e) => a + shares[e] * shares[e], 0))
  const missing = ELEMENTS.filter((e) => weighted[e] === 0)
  const d = stemElement(n.day.stem)
  const sh = (g: TenGodGroup) => shares[elementOfGroup(d, g)]
  const toOutput = sh("siksang") >= FLOW_MIN_SHARE
  const dayMasterFlow = { toOutput, toWealth: toOutput && sh("jaeseong") >= FLOW_MIN_SHARE, fromResource: sh("inseong") >= FLOW_MIN_SHARE }

  // 천간 표지(일간 제외, §5.1)
  const stems = otherStems(n).map((s) => ({ pos: stemPos(s.key), key: s.key, tg: tenGodOfStem(n.day.stem, s.stem), group: groupOf(d, stemElement(s.stem)) }))
  const at = (tgs: TenGod[]) => stems.filter((s) => tgs.includes(s.tg))
  const posOf = (xs: { pos: Position }[]) => xs.map((x) => ({ ...x.pos }))
  const flags: QiFlowResult["clarityFlags"] = []
  if (at(["정관"]).length && at(["편관"]).length)
    flags.push({ flag: "관살혼잡", members: posOf(at(["정관", "편관"])), ruleId: "qi.clarity.gwansalHonjap" })
  if (at(["상관"]).length && at(["정관"]).length)
    flags.push({ flag: "상관견관", members: posOf(at(["상관", "정관"])), ruleId: "qi.clarity.sanggwanGyeongwan" })
  if (at(["편인"]).length && at(["식신"]).length)
    flags.push({ flag: "효신탈식", members: posOf(at(["편인", "식신"])), ruleId: "qi.clarity.hyosinTalsik" })
  const big = stems.filter((s) => s.group === "bigyeop")
  const jae = stems.filter((s) => s.group === "jaeseong")
  if (big.length >= 2 && jae.length >= 1)
    flags.push({ flag: "비겁쟁재", members: posOf(stems.filter((s) => s.group === "bigyeop" || s.group === "jaeseong")), ruleId: "qi.clarity.bigeopJaengjae" })
  // 재성파인: 이웃한 기둥의 천간(일간 제외라 연간–월간 쌍만 해당)
  const y = stems.find((s) => s.key === "year")
  const m = stems.find((s) => s.key === "month")
  if (y && m && ((y.group === "jaeseong" && m.group === "inseong") || (y.group === "inseong" && m.group === "jaeseong")))
    flags.push({ flag: "재성파인", members: posOf([y, m]), ruleId: "qi.clarity.jaeseongPain" })

  return {
    shares,
    dominant: { element: dom, share: shares[dom] },
    concentration,
    missing,
    flowChain: flowChainOf(shares),
    dayMasterFlow,
    clarityFlags: flags,
  }
}
