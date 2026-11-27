// 그림 말 사전 (D-023 ③ 쉬운 말) — 담당: 콘텐츠 작가
// 단일 원본: docs/knowledge/voice-guide.md §6-1 "그림 말 사전" 표. 이 파일은 그 표를 프롬프트에 넣으려고 옮긴 것이다.
//   표를 고치면 이 파일도 같이 고치고 PROMPT_VERSION(system.ts)을 올린다.
// 쓰임: facts.ts가 사실표를 글로 풀 때 글자·십성·관계 옆에 이 말을 붙여 준다 → AI는 "그림 말을 먼저, 용어는 뒤 괄호" 규칙을 지킬 재료를 받는다.
// 이것은 표기·비유 사전이다. 판정이 아니다(어떤 글자가 어떤 십성인지는 사실표=규칙 엔진 몫).
// 천간 생김새 비유는 요즘 명리 입문서에 흔한 통용 비유(L0)다 — 연구소장 답(감수 F14): 비유로만 쓰면 게시 가능, 고전에서 나왔다고 덧붙이지 않는다.

/** 천간 10 — 하늘 글자 */
export const STEM_PICTURE: Readonly<Record<string, string>> = {
  甲: "위로 곧게 크는 큰 나무",
  乙: "휘어도 안 꺾이는 풀과 덩굴",
  丙: "하늘 한가운데 뜬 해",
  丁: "가까운 데를 오래 비추는 등불",
  戊: "넓고 두꺼운 산과 둑",
  己: "손이 닿는 밭흙",
  庚: "다듬기 전 무쇠와 바위",
  辛: "잘 다듬은 보석과 바늘",
  壬: "넓게 흐르는 큰 강과 바다",
  癸: "소리 없이 스미는 비와 이슬",
}

/** 지지 12 — 땅 글자(계절·오행 + 띠 동물). 동물은 이름을 기억하게 돕는 꼬리표일 뿐, 동물 성격으로 사람을 판정하지 않는다 */
export const BRANCH_PICTURE: Readonly<Record<string, { picture: string; animal: string }>> = {
  子: { picture: "한겨울 깊은 밤의 찬물", animal: "쥐" },
  丑: { picture: "늦겨울 얼어 쉬는 밭흙", animal: "소" },
  寅: { picture: "이른 봄 막 깨어나는 숲", animal: "호랑이" },
  卯: { picture: "봄 한복판에 돋는 새순과 풀", animal: "토끼" },
  辰: { picture: "늦봄 물기를 머금은 젖은 흙", animal: "용" },
  巳: { picture: "초여름 달아오르는 불", animal: "뱀" },
  午: { picture: "한여름 한낮의 불", animal: "말" },
  未: { picture: "늦여름 볕에 마른 흙", animal: "양" },
  申: { picture: "초가을 단단한 쇠와 바위", animal: "원숭이" },
  酉: { picture: "한가을 잘 벼린 쇠, 거두는 가위", animal: "닭" },
  戌: { picture: "늦가을 마른 흙 둔덕", animal: "개" },
  亥: { picture: "초겨울 깊고 너른 물", animal: "돼지" },
}

/** 십성 10 + 묶음 5 — 일간(읽는 사람 자신)과 그 글자의 사이. 고객 문장 그대로 쓰도록 "너"로 적었다 */
export const TENGOD_PICTURE: Readonly<Record<string, string>> = {
  비견: "어깨를 나란히 하는 동무",
  겁재: "같은 편이면서 몫을 다투는 맞수",
  식신: "즐겨 만들고 먹이는 손",
  상관: "틀을 깨고 말로 드러내는 재주",
  편재: "크게 벌이고 굴리는 돈과 판",
  정재: "차곡차곡 쌓는 돈과 살림",
  편관: "너를 세게 다그쳐 단련하는 힘",
  정관: "너를 바로 세우는 틀과 책임",
  편인: "남다르게 배우고 꿰뚫는 힘",
  정인: "너를 받쳐 주는 배움과 돌봄",
  비겁: "너와 같은 힘, 동무이자 맞수",
  식상: "네가 만들어 내보내는 힘, 말과 재주",
  재성: "네가 다루는 것, 돈과 살림",
  관성: "너를 다스리는 틀, 책임과 규칙",
  인성: "너를 받쳐 주는 힘, 배움과 돌봄",
}

/** 관계(사실표 interactions.kind와 같은 이름) + 공망 */
export const RELATION_PICTURE: Readonly<Record<string, string>> = {
  천간합: "두 하늘 글자가 손을 잡는 사이 — 끌리고 묶인다",
  천간충: "두 하늘 글자가 마주 부딪는 사이 — 생각과 방향이 엇갈리기 쉽다",
  육합: "두 땅 글자가 짝지어 붙는 사이 — 잘 붙고, 묶이기도 한다",
  삼합: "세 글자가 한 기운으로 뭉치는 사이 — 힘이 한쪽으로 모인다",
  반합: "세 글자 뭉침 중 둘만 모인 사이 — 한쪽으로 힘이 기운다",
  방합: "같은 계절 글자들이 모인 것 — 한 철 기운이 두꺼워진다",
  충: "마주 서서 밀치는 사이 — 자리가 움직이기 쉽다(깨진다는 뜻이 아니다)",
  형: "서로 긁어 다듬는 사이 — 마찰 속에 손볼 데가 드러난다",
  파: "짜 놓은 것에 금이 가는 사이 — 계획을 다시 짜 볼 일이 생긴다",
  해: "은근히 서운하게 하는 사이 — 작은 서운함이 쌓이기 쉽다",
  공망: "비어 있는 자리 — 어떤 사람한텐 아무 일도 안 한다",
}

/** 자리 이름 → 고객에게 쓰는 말 */
export const POSITION_PICTURE: Readonly<Record<string, string>> = {
  일간: "너 자신을 뜻하는 글자",
  일지: "네가 앉은 자리, 가장 가까운 사람의 자리",
  일주: "태어난 날의 두 글자",
  월지: "태어난 달, 타고난 계절",
  월간: "태어난 달의 하늘 글자",
  연주: "태어난 해의 두 글자, 어린 날과 뿌리",
  시주: "태어난 시의 두 글자, 늦은 날과 혼자만의 시간",
  대운: "열 해마다 갈아입는 옷",
  세운: "그해에 들어오는 글자",
  지장간: "땅 글자 속에 숨은 기운",
}

/** "乙" → "풀과 덩굴", "酉" → "한가을 잘 벼린 쇠, 거두는 가위(닭)". 간지 글자가 아니면 null */
export function pictureOfChar(c: string, withAnimal = true): string | null {
  if (STEM_PICTURE[c]) return STEM_PICTURE[c]
  const b = BRANCH_PICTURE[c]
  if (b) return withAnimal ? `${b.picture}(${b.animal})` : b.picture
  return null
}

/** 간지 한 글자·두 글자 → "위: …/아래: …" 꼴. 간지가 아니면 null */
export function pictureOfGanzhi(hanja: string): string | null {
  const cs = [...hanja]
  if (cs.length === 1) return pictureOfChar(cs[0])
  if (cs.length === 2 && STEM_PICTURE[cs[0]] && BRANCH_PICTURE[cs[1]]) return `위 ${STEM_PICTURE[cs[0]]} / 아래 ${pictureOfChar(cs[1])}`
  return null
}

export function pictureOfTenGod(name: string): string | null {
  return TENGOD_PICTURE[name] ?? null
}

export function pictureOfRelation(kind: string): string | null {
  return RELATION_PICTURE[kind] ?? null
}
