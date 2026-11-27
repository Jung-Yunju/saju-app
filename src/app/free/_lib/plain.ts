// 화면 고정 글자용 쉬운 말(D-023 ③). 그림 말은 engine/content/prompts/plain-words.ts 사전이 원본이다.
// 여기 STEM_SHORT·BRANCH_SHORT는 그 사전 문구를 좁은 칸(기둥 칸)에 맞게 줄인 꼴이다 — 낱말은 사전 문구에서만 가져온다
// (src/app/free/__tests__/plain.test.ts가 "줄인 말의 낱말이 사전 문구 안에 있는지" 확인한다).
import { BRANCH_PICTURE, STEM_PICTURE } from "@/engine/content/prompts/plain-words"
import type { ElementKo } from "./types"

export const STEM_SHORT: Readonly<Record<string, string>> = {
  甲: "큰 나무", 乙: "풀과 덩굴", 丙: "뜬 해", 丁: "등불", 戊: "두꺼운 산",
  己: "밭흙", 庚: "무쇠와 바위", 辛: "보석과 바늘", 壬: "큰 강", 癸: "비와 이슬",
}
export const BRANCH_SHORT: Readonly<Record<string, string>> = {
  子: "한겨울 찬물", 丑: "늦겨울 밭흙", 寅: "이른 봄 숲", 卯: "봄 새순", 辰: "젖은 흙", 巳: "초여름 불",
  午: "한여름 불", 未: "마른 흙", 申: "단단한 쇠", 酉: "벼린 쇠", 戌: "마른 흙", 亥: "너른 물",
}

/** 오행 그림 이름(목→나무 …). 용어는 작게 뒤에 붙인다 */
export const EL_PLAIN: Record<ElementKo, string> = { 목: "나무", 화: "불", 토: "흙", 금: "쇠", 수: "물" }
export const EL_HANJA: Record<ElementKo, string> = { 목: "木", 화: "火", 토: "土", 금: "金", 수: "水" }

export const stemShort = (h: string): string => STEM_SHORT[h] ?? ""
/** 땅 글자: "한여름 불·말" */
export const branchShort = (h: string): string => (BRANCH_SHORT[h] ? `${BRANCH_SHORT[h]}·${BRANCH_PICTURE[h]?.animal ?? ""}` : "")

/** 나를 나타내는 글자 설명 한 줄(사전 원문): "넓게 흐르는 큰 강과 바다" */
export const stemPicture = (h: string): string => STEM_PICTURE[h] ?? ""

/** 공유 카드·미리보기 이름표: "큰 강 · 임수(壬水)" — 그림 말이 먼저, 용어는 뒤 */
export function dmCaption(hanja: string, ko: string, element: ElementKo): string {
  const pic = STEM_SHORT[hanja]
  return pic ? `${pic} · ${ko}${element}` : `${ko}${element}`
}

export const PILLAR_PLAIN = { hour: "태어난 시", day: "태어난 날", month: "태어난 달", year: "태어난 해" } as const
export const PILLAR_TERM = { hour: "시주", day: "일주", month: "월주", year: "연주" } as const
