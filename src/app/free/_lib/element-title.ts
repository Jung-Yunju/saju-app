import type { ElementKo } from "./types"
import { EL_HANJA, EL_PLAIN } from "./plain"

/** 오행 카드 제목. 받침에 따라 조사가 달라지지 않도록 "기운이"로 받는다(오행 이름 뒤에 조사를 붙이지 않는다). */
export function elementTitle(kind: "excess" | "lack" | "balanced", el: ElementKo): string {
  const head = `${EL_PLAIN[el]}(${el} ${EL_HANJA[el]}) 기운이`
  return kind === "excess" ? `${head} 넘치는 편` : kind === "lack" ? `${head} 비어 있어요` : `${head} 알맞아요`
}
