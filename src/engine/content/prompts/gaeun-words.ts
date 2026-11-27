// 개운(바꿔 사는 법) 범주를 쉬운 말로 옮기는 표기 사전 (D-023 ②③, prompts@0.3.0) — 담당: 콘텐츠 작가
// 근거: docs/knowledge/gaeun.md §3.3(범주표·문형), §3.4(장별 범주), §4(관점 충돌). 범주를 고르는 일은 코드(src/engine/content/gaeun.ts) 몫이고,
// 이 파일은 고른 범주를 "그림 말"로 부르는 이름표만 둔다(판정 아님). 문장 예시는 gaeun.md 예시의 뜻을 줄여 옮긴 것이다.
// 참고 등급(색·방향·숫자·맛)은 대표 결정(gaeun.md §6 ★1) 전이라 여기 두지 않는다.
import type { GaeunGroup, GaeunPick } from "../types"
import { TENGOD_PICTURE } from "./plain-words"

/** 묶음 코드 → 십성 묶음 이름(plain-words TENGOD_PICTURE 키). 관살은 사전 키가 "관성"이다 */
export const GROUP_KO: Readonly<Record<GaeunGroup, string>> = {
  bigyeop: "비겁", siksang: "식상", jaeseong: "재성", gwansal: "관성", inseong: "인성",
}

/** 묶음 그림 말: "너를 받쳐 주는 힘, 배움과 돌봄" */
export function groupPicture(g: GaeunGroup): string {
  return TENGOD_PICTURE[GROUP_KO[g]] ?? GROUP_KO[g]
}

/** L7 운 글자 묶음 → "그 시기 일이 몰리는 쪽"(gaeun.md §3.3 F 아래 목록) */
export const LUCK_SIDE: Readonly<Record<GaeunGroup, string>> = {
  bigyeop: "사람·동료 일", siksang: "내놓고 만드는 일", jaeseong: "결과·살림 일", gwansal: "책임·평가 일", inseong: "배우고 서류 다루는 일",
}

/** 범주 갈래 → 고객에게 보이지 않는 작업 이름(쉬운 말). 범주 id 앞부분으로 고른다 */
export function familyPlain(id: string): string {
  if (id.startsWith("GA.fill.")) return "모자란 힘 채우기"
  if (id.startsWith("GA.ease.")) return "넘치는 힘 덜어 내기"
  if (id === "GA.balanced") return "지금 균형 지키기"
  if (id === "GA.bridge") return "맞선 두 힘 잇기"
  if (id.startsWith("GJ.")) return "계절 기운 맞추기(몸·생활 리듬)"
  if (id.startsWith("GE.")) return "반가운 기운의 생활 결(시간대·계절·일의 결)"
  if (id === "GT.turn") return "열 해 옷 갈아입기"
  if (id.startsWith("GT.")) return "때 쓰기"
  if (id.startsWith("GI.")) return "운 글자가 타고난 자리를 건드릴 때의 처신"
  return "바꿔 볼 것"
}

/** 관점 머리말(spec §3.8 병기, gaeun.md §4 P1) */
export const VIEW_HEAD: Readonly<Record<GaeunPick["view"], string>> = {
  eokbu: "힘의 균형으로 보면(억부)",
  johuClimate: "계절 기운으로 보면(조후)",
  tonggwan: "맞선 두 힘을 잇는 쪽으로 보면(통관)",
  luck: "운 글자로 보면",
}

/** 조후 범주(GJ) 그림 말과 P4 "고르는 기준" 문장에 넣을 짧은 이름 */
export const GJ_PICTURE: Readonly<Record<string, { picture: string; side: string }>> = {
  "GJ.warm": { picture: "겨울 쪽으로 기운 판", side: "데우는 쪽" },
  "GJ.cool": { picture: "한여름처럼 달아 있는 판", side: "식히는 쪽" },
  "GJ.dry": { picture: "장마철처럼 눅눅한 판", side: "털어 말리는 쪽" },
  "GJ.moisten": { picture: "가문 땅처럼 마른 판", side: "적시는 쪽" },
}

/** 덜어 내기(GA.ease) — P4 ② "흘려보내기" 말투의 짧은 이름 */
export const EASE_SIDE: Readonly<Record<GaeunGroup, string>> = {
  bigyeop: "나누는 쪽", inseong: "배운 걸 바로 써 보는 쪽", siksang: "벌인 걸 끝내는 쪽", jaeseong: "지키는 쪽", gwansal: "짐을 돌려주는 쪽",
}

/** 오행 생활 결(GE) 그림 말 — 실천 줄 전용(참고 줄은 싣지 않는다) */
export const GE_PICTURE: Readonly<Record<string, string>> = {
  목: "새싹 같은 기운", 화: "햇볕 같은 기운", 토: "마당 흙 같은 기운", 금: "가위 같은 기운", 수: "냇물 같은 기운",
}

/** 시기(GT) 판정 그림 말 */
export const GT_PICTURE: Readonly<Record<string, string>> = {
  "GT.move": "반가운 기운이 들어오는 때 — 시작하고 넓히되 되돌릴 수 있는 크기부터",
  "GT.build": "이미 넉넉한 기운이 또 들어오는 때 — 새로 벌이기보다 다지기",
  "GT.watch": "반가운 기운과 버거운 기운이 같이 오는 때 — 큰 결정은 나눠서",
  "GT.turn": "열 해 옷을 갈아입는 해 — 첫 반년은 새 옷에 몸을 맞추기",
}

/** split 값(move·build·watch) → 쉬운 말 */
export const VERDICT_KO: Readonly<Record<string, string>> = { move: "움직일 때", build: "다질 때", watch: "섞인 때" }

/** 합충 해(GI) 그림 말 — 어느 자리가 흔들리는지 */
export const GI_PICTURE: Readonly<Record<string, string>> = {
  "GI.chungDay": "네가 앉은 자리(가장 가까운 사람의 자리)를 마주 서서 미는 기운이 온다",
  "GI.chungMonth": "태어난 달 자리(일터 쪽 자리)를 마주 서서 미는 기운이 온다",
  "GI.chungOther": "바깥 자리 하나(태어난 해나 태어난 시 자리)를 마주 서서 미는 기운이 온다",
  "GI.hap": "무언가와 손을 잡고 단단히 묶이기 쉬운 기운이 온다",
  "GI.hyeong": "가까운 자리나 일터 쪽 자리를 서로 긁어 다듬는 기운이 온다",
}

/** 대운 앞·뒤 다섯 해(luckHalves 옵션) */
export const HALF_KO: Readonly<Record<"early" | "late", string>> = { early: "앞 다섯 해(하늘 글자 쪽)", late: "뒤 다섯 해(땅 글자 쪽)" }

const TERM_TO_PLAIN: readonly [string, string][] = [
  ...Object.entries(TENGOD_PICTURE).sort((a, b) => b[0].length - a[0].length),
  ["용신", "보태 쓰면 좋다고 보는 기운"],
]

/**
 * 범주 practice 문장에 명리 용어가 섞여 있으면 그림 말로 바꾼다(D-023 ③). 지금 범주표(GAEUN_CATALOG)엔 용어가 없지만
 * 범주표가 바뀌어도 용어가 그대로 새지 않게 둔다. 관계 이름(충·합·형)은 한 글자라 일반 낱말과 겹쳐 바꾸지 않는다.
 * 일반 낱말과 겹치지 않게("상관없이", "식상하다") 용어 뒤가 낱말 끝(빈칸·문장부호·괄호)이거나 조사 한 글자 + 낱말 끝일 때만 바꾼다.
 */
export function plainPractice(text: string): string {
  let out = text
  for (const [term, plain] of TERM_TO_PLAIN) {
    out = out.replace(new RegExp(`${term}(?=$|[^가-힣]|[이가을를은는의과와도에](?:$|[^가-힣]))`, "g"), `${plain}(${term})`)
  }
  return out
}
