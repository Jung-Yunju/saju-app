// 개운(開運 — 바꿔 사는 법) 범주 선택 (D-023 ②) — 담당: 백엔드·서버 개발자
// 명세: docs/knowledge/gaeun.md §3(엔진 연결 규칙 C1~C5 · N1~N7 · L1~L7, 출력 GaeunPick §3.5), §4(관점 충돌 처리).
// 원칙
//  1) 범주는 이 코드가 결정론적으로 고른다(같은 입력 → 같은 출력, 배열 순서 포함). AI는 고른 범주를 쉬운 말로 옮기기만 한다.
//  2) 범주는 GAEUN_CATEGORY_IDS의 30개뿐이다. 금지 등급(부적·굿·개명·물건 구매·이사·방위 이동·효과 보장·의료·투자 결정·삼재 등)은
//     범주 자체가 없다 — 만들 방법이 없다.
//  3) 참고 등급(색·방향·숫자·맛)은 대표 결정(gaeun.md §6 ★1) 전이라 기본 꺼짐(referenceTier "hidden").
//     열어도 pick(tier "reference")만 나오고 색·방향 문구는 이 파일에 두지 않는다.
//  4) 격국(상신)·특수격·병약 관점은 개운 pick을 만들지 않는다(N7). 특수격은 억부를 약하게 하는 데만 쓴다(C5).
//  5) 순수 함수 — AI·DB·네트워크·현재 시각 없음. 규칙 판단은 새로 하지 않고 규칙 엔진 결과(RuleAnalysis)를 옮겨 분류만 한다.
//     [설계] 표시가 붙은 문턱값(thin 0.10, GI 우선순위·최대 2, 조후 간이 변환)은 연구소장 설계값이다(고전 근거 아님).
import type { Element } from "../types"
import type { Interaction, Position, RuleAnalysis, TenGod, UsefulGodMethod } from "../rules/types"
import { branchElement, stemElement } from "../rules/basics"
import { elementOfGroup } from "../rules/groups"
import { primaryModel } from "../rules/strength"
import { eokbuOf } from "../rules/usefulGod"
import type { GaeunBasis, GaeunGroup, GaeunPick, GaeunRelationId, LuckGlyphFacts } from "./types"

export const GAEUN_VERSION = "gaeun@0.1.0"

const GROUPS: readonly GaeunGroup[] = ["bigyeop", "siksang", "jaeseong", "gwansal", "inseong"]
const ELEMENT_KO: Readonly<Record<Element, string>> = { wood: "목", fire: "화", earth: "토", metal: "금", water: "수" }
const GE_ID: Readonly<Record<string, string>> = { 목: "GE.wood", 화: "GE.fire", 토: "GE.earth", 금: "GE.metal", 수: "GE.water" }

export const TEN_GOD_GROUP: Readonly<Record<TenGod, GaeunGroup>> = {
  비견: "bigyeop", 겁재: "bigyeop", 식신: "siksang", 상관: "siksang", 편재: "jaeseong",
  정재: "jaeseong", 편관: "gwansal", 정관: "gwansal", 편인: "inseong", 정인: "inseong",
}

// ─────────────────────────────────────────── 범주표(gaeun.md §3.3) — 30개

/**
 * 30개 범주와 "바꿔 볼 것"(gaeun.md §3.3 표의 열을 옮김). 프롬프트가 범주 id를 말로 옮길 때 참고한다.
 * 고객 문장 예시는 gaeun.md에 있고 여기 두지 않는다(문장은 콘텐츠 작가 몫).
 */
export const GAEUN_CATALOG: Readonly<Record<string, { family: string; practice: string }>> = {
  "GA.fill.bigyeop": { family: "십성 채우기", practice: "같이 가는 사람 두기, 내 몫 말하기" },
  "GA.fill.siksang": { family: "십성 채우기", practice: "표현할 통로 만들기(말·글·손작업)" },
  "GA.fill.jaeseong": { family: "십성 채우기", practice: "결과를 손에 쥐기(끝 날짜·받을 값 정하기), 살림 흐름 적기" },
  "GA.fill.gwansal": { family: "십성 채우기", practice: "남과 약속한 마감, 작은 책임 맡기" },
  "GA.fill.inseong": { family: "십성 채우기", practice: "배움·돌봄 받는 관계 만들기, 쉬는 날 먼저 정하기" },
  "GA.ease.bigyeop": { family: "십성 덜어 내기", practice: "혼자 다 하려는 버릇 줄이기, 나누는 판 고르기" },
  "GA.ease.inseong": { family: "십성 덜어 내기", practice: "준비만 길어지는 버릇 줄이기, 배운 걸 바로 써 보기" },
  "GA.ease.siksang": { family: "십성 덜어 내기", practice: "벌인 일·말 줄이기, 끝내기" },
  "GA.ease.jaeseong": { family: "십성 덜어 내기", practice: "욕심 크기 줄이기, 지키는 쪽부터" },
  "GA.ease.gwansal": { family: "십성 덜어 내기", practice: "내 것이 아닌 짐 돌려주기, 거절 연습" },
  "GA.balanced": { family: "균형", practice: "지금 잘 돌아가는 습관 지키기, 해마다 그해 몫 보고 손보기" },
  "GA.bridge": { family: "다리", practice: "맞선 두 힘 사이에 잇는 단계 하나 끼우기" },
  "GJ.warm": { family: "계절 기운(몸·생활 리듬)", practice: "몸을 데우는 습관, 사람 온기 있는 자리" },
  "GJ.cool": { family: "계절 기운(몸·생활 리듬)", practice: "일정 사이 숨 돌릴 빈칸, 식혀서 정하기" },
  "GJ.dry": { family: "계절 기운(몸·생활 리듬)", practice: "날 정해 털어 내기, 쌓아 둔 것 비우기" },
  "GJ.moisten": { family: "계절 기운(몸·생활 리듬)", practice: "마음 적실 거리, 부드럽게 말 열기" },
  "GE.wood": { family: "오행 생활 결", practice: "이른 아침 시간대·봄, 기르고 가르치고 시작하는 일" },
  "GE.fire": { family: "오행 생활 결", practice: "해가 높은 한낮·여름, 드러내고 알리는 일" },
  "GE.earth": { family: "오행 생활 결", practice: "철이 바뀌는 때마다 정리, 잇고 조율하는 일" },
  "GE.metal": { family: "오행 생활 결", practice: "하루 끝 무렵·가을, 재고 다듬고 끊어 내는 일" },
  "GE.water": { family: "오행 생활 결", practice: "밤 시간·겨울, 살피고 배우는 일(잠을 줄이라는 뜻 아님)" },
  "GT.move": { family: "시기", practice: "시작·넓히기(되돌릴 수 있는 크기부터)" },
  "GT.build": { family: "시기", practice: "다지기, 쌓이는 것(몸·기술·모아 두기)에 힘 두기" },
  "GT.watch": { family: "시기", practice: "큰 결정은 나눠서, 들어갈 문과 나올 문 같이 확인" },
  "GT.turn": { family: "시기", practice: "새 열 해에 몸 맞추기, 하나씩 시험해 보고 바꾸기" },
  "GI.chungDay": { family: "합충이 오는 해", practice: "가까운 관계 점검, 계약은 서류부터" },
  "GI.chungMonth": { family: "합충이 오는 해", practice: "옮길 곳 먼저 확인, 맡은 일 기록 정리" },
  "GI.chungOther": { family: "합충이 오는 해", practice: "미뤄 둔 정리, 일정에 여유 칸" },
  "GI.hap": { family: "합충이 오는 해", practice: "묶이기 전에 언제 풀 수 있는지 확인" },
  "GI.hyeong": { family: "합충이 오는 해", practice: "규칙·서류·절차 재확인, 따질 일은 글로" },
}

/** 허용된 범주 id 30개(이 밖의 id는 나오지 않는다) */
export const GAEUN_CATEGORY_IDS: readonly string[] = Object.freeze(Object.keys(GAEUN_CATALOG))

/**
 * 금지 등급(gaeun.md §2.1) 낱말 — 범주표·pick 어디에도 나오면 안 된다(테스트·검증기용 목록).
 * 범주로 만들지 않았으므로 코드가 고를 수 없다. 프롬프트·검증기가 같은 목록을 쓰도록 내보낸다.
 */
export const GAEUN_FORBIDDEN_WORDS: readonly string[] = Object.freeze([
  "부적", "굿", "살풀이", "액막이", "개명", "작명", "구매", "사라", "지갑", "팔찌", "인테리어", "풍수", "방위", "이사 가",
  "행운의", "운이 트인다", "반드시", "보장", "보조제", "치료", "투자", "대출", "퇴사", "삼재", "아홉수",
])

// ─────────────────────────────────────────── 위치 표기(facts.ts formatPosition과 같은 꼴)

function posStr(p: Position, hiddenRole?: string, daeunIndex?: number): string {
  const head = p.pillar === "daeun" ? `daeun[${daeunIndex ?? (p.luckIndex ?? -1) + 1}]` : p.pillar
  return hiddenRole ? `${head}.${p.part}.${hiddenRole}` : `${head}.${p.part}`
}

const isNatal = (p: Position): boolean => p.pillar === "year" || p.pillar === "month" || p.pillar === "day" || p.pillar === "hour"
const zeroGroups = (): Record<GaeunGroup, number> => ({ bigyeop: 0, siksang: 0, jaeseong: 0, gwansal: 0, inseong: 0 })

// ─────────────────────────────────────────── 근거값(규칙 엔진 결과 옮기기)

/** 드러난 글자(원국 천간 + 지지 정기, 일간 제외)의 십성 묶음 개수 — 감수 P1 tenGodGroupCounts */
export function surfaceGroupCounts(rules: RuleAnalysis): Record<GaeunGroup, number> {
  const c = zeroGroups()
  for (const h of rules.tenGods) if (isNatal(h.position) && !h.viaHiddenStem) c[TEN_GOD_GROUP[h.tenGod]] += 1
  return c
}

/** 묶음별 원국 위치(드러난 글자 + 지장간, 근거 순서) */
function groupPositions(rules: RuleAnalysis): Record<GaeunGroup, string[]> {
  const out: Record<GaeunGroup, string[]> = { bigyeop: [], siksang: [], jaeseong: [], gwansal: [], inseong: [] }
  for (const h of rules.tenGods) {
    if (!isNatal(h.position)) continue
    const s = posStr(h.position, h.viaHiddenStem)
    const arr = out[TEN_GOD_GROUP[h.tenGod]]
    if (!arr.includes(s)) arr.push(s)
  }
  return out
}

const GAEUN_VIEW_METHODS = ["eokbu", "johuClimate", "tonggwan"] as const
type GaeunViewMethod = (typeof GAEUN_VIEW_METHODS)[number]

/**
 * 개운 근거값. 신강약·용신·조후가 없는 규칙 엔진 결과(rules@0.3.0 미만)면 undefined(개운을 고르지 않는다 — gaeun.md §2.2-1).
 */
export function buildGaeunBasis(rules: RuleAnalysis): (GaeunBasis & { groupPositions: Record<GaeunGroup, string[]> }) | undefined {
  // 방어 읽기: 신강약·용신·조후 모양이 명세(rules@0.3.0+)와 다르면 개운을 고르지 않는다(오류 없이 생략)
  const s = rules.strength as RuleAnalysis["strength"] | undefined
  const ug = rules.usefulGods as RuleAnalysis["usefulGods"] | undefined
  const cl = rules.climate as RuleAnalysis["climate"] | undefined
  const isNum = (x: unknown) => typeof x === "number" && Number.isFinite(x)
  if (!s || typeof s !== "object" || !Array.isArray(s.models) || !s.groupTotals || typeof s.groupTotals !== "object") return undefined
  if (!GROUPS.every((g) => isNum(s.groupTotals[g]))) return undefined
  if (!ug || !Array.isArray(ug.views) || !cl || !Array.isArray(cl.needs)) return undefined
  if (!ug.views.every((v) => v && typeof v === "object" && Array.isArray(v.candidates) && Array.isArray(v.basis))) return undefined
  const pm = primaryModel(s)
  const A = s.models.find((m) => m.model === "weighted")
  if (!pm || !A || typeof pm.verdict !== "string") return undefined
  const eok = eokbuOf(pm, s.groupTotals)
  const special = rules.structure?.candidates?.filter((c) => c.kind === "special") ?? []

  const views: GaeunBasis["views"] = []
  for (const method of GAEUN_VIEW_METHODS) {
    const v = ug.views.find((x) => x.method === method)
    if (!v) continue
    const first = v.candidates.find((c) => c.rank === 1) ?? v.candidates[0]
    const row: GaeunBasis["views"][number] = { method, status: v.status }
    if (first && v.status === "ok") {
      row.element = ELEMENT_KO[first.element]
      if (first.group) row.group = first.group
      row.presentWeight = first.presentWeight
      if (v.favorable) row.xi = ELEMENT_KO[v.favorable.xi]
    }
    if (method === "tonggwan" && v.status === "ok") {
      const m = /^ug\.tonggwan\.(\w+)>(\w+)$/.exec(v.basis[0]?.ruleId ?? "")
      const from = m ? ELEMENT_KO[m[1] as Element] : undefined
      const to = m ? ELEMENT_KO[m[2] as Element] : undefined
      if (from && to) row.bridge = { from, to }
    }
    views.push(row)
  }

  return {
    groupCounts: surfaceGroupCounts(rules),
    groupTotals: { ...zeroGroups(), ...s.groupTotals },
    strength: {
      verdict: pm.verdict,
      agreement: s.agreement,
      nearBoundary: A.nearBoundary,
      tableSensitive: s.tableSensitive,
      hourSensitive: s.hourSensitivity ? s.hourSensitivity.hourSensitive : null,
      total: A.total,
      easeGroup: eok.status === "ok" ? eok.decisive : null,
      specialReversesEokbu: special.some((c) => c.reversesUsefulGod === true),
    },
    views,
    climateNeeds: [...cl.needs],
    groupPositions: groupPositions(rules),
  }
}

// ─────────────────────────────────────────── 운 글자(L1·L6·L7 재료)

const RELATION_ORDER: readonly GaeunRelationId[] = ["chungDay", "chungMonth", "hyeong", "hap", "chungOther"]
const KIND_KO: Partial<Record<Interaction["type"], string>> = { clash: "충", punishment: "형", stemCombine: "천간합", sixCombine: "육합", threeCombine: "삼합" }

/** 운 글자와 원국의 관계 하나를 L6 분류로. 해당 없음이면 null(파·해·원진·천간충·반합·방합은 쓰지 않는다) */
function classifyRelation(it: Interaction, slotPos: (p: Position) => boolean): GaeunRelationId | null {
  const others = it.members.filter((m) => !slotPos(m))
  if (others.length === it.members.length || !others.every(isNatal)) return null // 슬롯 글자 + 원국 글자만
  const touches = (pillar: string, part: "stem" | "branch") => others.some((m) => m.pillar === pillar && m.part === part)
  switch (it.type) {
    case "clash":
      if (touches("day", "branch")) return "chungDay"
      if (touches("month", "branch")) return "chungMonth"
      return "chungOther"
    case "punishment":
      return touches("day", "branch") || touches("month", "branch") ? "hyeong" : null
    case "stemCombine":
      return touches("day", "stem") ? "hap" : null
    case "sixCombine":
      return touches("day", "branch") || touches("month", "branch") ? "hap" : null
    case "threeCombine":
      return it.complete === true ? "hap" : null
    default:
      return null
  }
}

export type LuckSlotRef = { slot: "daeun"; luckIndex: number; daeunIndex: number } | { slot: "seun"; year: number }

/** 운 한 슬롯의 글자 십성·오행·원국 관계(규칙 엔진에 그 운을 넘겼을 때만). 없으면 null */
export function luckGlyphsOf(rules: RuleAnalysis, ref: LuckSlotRef): LuckGlyphFacts | null {
  const pillar = ref.slot === "daeun" ? rules.source.luck[ref.luckIndex] : rules.source.seun
  if (!pillar) return null
  const daeunIndex = ref.slot === "daeun" ? ref.daeunIndex : undefined
  const slotPos = (p: Position): boolean => p.pillar === ref.slot && (ref.slot !== "daeun" || p.luckIndex === ref.luckIndex)

  const glyphs: LuckGlyphFacts["glyphs"] = []
  for (const part of ["stem", "branch"] as const) {
    const hit = rules.tenGods.find((h) => slotPos(h.position) && h.position.part === part && !h.viaHiddenStem)
    if (!hit) continue
    const element = part === "stem" ? stemElement(pillar.stem) : branchElement(pillar.branch)
    glyphs.push({
      part, char: hit.char, tenGod: hit.tenGod, group: TEN_GOD_GROUP[hit.tenGod], element: ELEMENT_KO[element],
      pos: posStr(hit.position, undefined, daeunIndex),
    })
  }

  const rel: (LuckGlyphFacts["relations"][number] & { order: number })[] = []
  rules.interactions.forEach((it, i) => {
    if (!it.members.some(slotPos)) return
    const id = classifyRelation(it, slotPos)
    if (!id) return
    rel.push({
      id, kind: KIND_KO[it.type] ?? it.type, chars: it.chars.join(""),
      positions: it.members.map((m) => posStr(m, undefined, slotPos(m) ? daeunIndex : undefined)), order: i,
    })
  })
  rel.sort((a, b) => RELATION_ORDER.indexOf(a.id) - RELATION_ORDER.indexOf(b.id) || a.order - b.order)

  return {
    slot: ref.slot,
    ganzhi: `${pillar.stem}${pillar.branch}`,
    ...(ref.slot === "daeun" ? { daeunIndex: ref.daeunIndex } : { year: ref.year }),
    glyphs,
    relations: rel.map((r) => ({ id: r.id, kind: r.kind, chars: r.chars, positions: r.positions })),
  }
}

/** seunFlags.shaking(gaeun.md §3.2): 올해 세운 지지가 원국 일지 또는 월지와 충 또는 형 */
export function seunShaking(seun: LuckGlyphFacts | null | undefined): boolean {
  return !!seun && seun.relations.some((r) => r.id === "chungDay" || r.id === "chungMonth" || r.id === "hyeong")
}

// ─────────────────────────────────────────── 선택(§3.2)

export interface GaeunOptions {
  /** 개운에 쓰는 관점(기본 억부·조후·통관). 격국·특수격·병약은 넣어도 무시한다(N7) */
  views?: readonly UsefulGodMethod[]
  /** 대운을 앞 5년 천간·뒤 5년 지지로 나눠 판정(기본 false — 통째) */
  luckHalves?: boolean
  /** 참고 등급(색·방향·숫자·맛) pick을 낼지. 대표 결정 전 기본 "hidden" */
  referenceTier?: "hidden" | "shown"
}

export const DEFAULT_GAEUN_OPTIONS: Readonly<Required<GaeunOptions>> = Object.freeze({
  views: Object.freeze(["eokbu", "johuClimate", "tonggwan"]) as readonly UsefulGodMethod[],
  luckHalves: false,
  referenceTier: "hidden",
})

export interface GaeunInput {
  basis: GaeunBasis & { groupPositions?: Record<GaeunGroup, string[]> }
  /** 일간 오행(RuleAnalysis.dayMaster.element) — 묶음 ↔ 오행 변환용 */
  dayElement: Element
  hourKnown: boolean
  /** 지금 대운·올해 세운 슬롯(없으면 시기 pick 없음) */
  luck?: readonly LuckGlyphFacts[]
  /** L5: 올해 시작하는 대운(FactSheet.luck.daeun 중 startYear = 올해) */
  turn?: { daeunIndex: number; startYear: number; ganzhi: string } | null
}

const NEED_ELEMENT: Readonly<Record<string, string>> = { warm: "화", dry: "화", cool: "수", moisten: "수" }
const NEED_ID: Readonly<Record<string, string>> = { warm: "GJ.warm", cool: "GJ.cool", dry: "GJ.dry", moisten: "GJ.moisten" }
const OPPOSITE: Readonly<Record<string, string>> = { 화: "수", 수: "화" }

type Verdict = "move" | "build" | "watch"
type Cls = "fav" | "load" | "neutral"

function verdictOf(classes: Cls[]): Verdict | null {
  const fav = classes.includes("fav")
  const load = classes.includes("load")
  if (fav && load) return "watch"
  if (fav) return "move"
  if (load) return "build"
  return null
}

/** §4.1 충돌 수준: 억부 판정(신강/신약)·덜 대상 h 기준으로 조후 오행 c를 본다 */
function conflictOf(verdict: string, dayElementOfGroup: (g: GaeunGroup) => string, groupOfEl: (e: string) => GaeunGroup, h: GaeunGroup | null, c: string) {
  if (h && dayElementOfGroup(h) === c) return "opposed" as const
  const g = groupOfEl(c)
  const helps = verdict === "신강" ? ["siksang", "jaeseong", "gwansal"] : ["bigyeop", "inseong"]
  return helps.includes(g) ? ("compatible" as const) : ("tension" as const)
}

/**
 * gaeun.md §3.2 선택 절차. 같은 입력이면 같은 출력(순서: 원국 → 지금 대운 → 올해 세운).
 * 원국: GA.fill·GA.ease(또는 GA.balanced) → GA.bridge → GJ.* → GE.*. 운 슬롯: GT.* → GT.turn → GI.*(최대 2).
 */
export function pickGaeun(input: GaeunInput, options: GaeunOptions = {}): GaeunPick[] {
  const o = { ...DEFAULT_GAEUN_OPTIONS, ...options }
  const enabled = (m: GaeunViewMethod) => o.views.includes(m)
  const { basis } = input
  const st = basis.strength
  const view = (m: GaeunViewMethod) => (enabled(m) ? basis.views.find((v) => v.method === m) : undefined)
  const eok = view("eokbu")
  const johu = view("johuClimate")
  const tong = view("tonggwan")
  const picks: GaeunPick[] = []

  // 일간 오행 기준 묶음 ↔ 오행(표기 변환)
  const dm = input.dayElement
  const elOfGroup = (g: GaeunGroup): string => ELEMENT_KO[elementOfGroup(dm, g)]
  const groupOfEl = (e: string): GaeunGroup => {
    for (const g of GROUPS) if (elOfGroup(g) === e) return g
    return "bigyeop"
  }

  // 신뢰도 문 C1~C3·C5 (억부 pick에만)
  const softBy: NonNullable<GaeunPick["softBy"]> = []
  if (st.agreement === "split" || st.nearBoundary) softBy.push("C1")
  if (!input.hourKnown && st.hourSensitive === true) softBy.push("C2")
  if (st.tableSensitive) softBy.push("C3")
  if (st.specialReversesEokbu) softBy.push("C5")
  const eokTone = (): Pick<GaeunPick, "tone" | "softBy"> => (softBy.length ? { tone: "soft", softBy: [...softBy] } : { tone: "firm" })
  const T = st.total ?? 0
  const gp = basis.groupPositions

  // ── 원국 N1·N2·N3
  const eokOk = eok?.status === "ok" && !!eok.element && !!eok.group
  const h = eokOk ? st.easeGroup : null
  if (eokOk) {
    const g = eok!.group as GaeunGroup
    const count = basis.groupCounts[g] ?? 0
    const pw = eok!.presentWeight ?? 0
    const framing: GaeunPick["framing"] = count === 0 ? "missingSurface" : T > 0 && Math.round((pw / T) * 1e6) / 1e6 < 0.1 ? "thin" : "use"
    picks.push({
      id: `GA.fill.${g}`, slot: "natal", view: "eokbu", element: eok!.element, group: g, framing,
      ...(framing === "missingSurface" ? { hiddenPresent: pw > 0 } : {}),
      ...eokTone(), tier: "practice",
      basis: [{ ruleId: "gaeun.N1", positions: gp?.[g] ?? [], values: { surfaceCount: count, presentWeight: pw, ...(T ? { total: T } : {}) } }],
    })
    if (h) {
      picks.push({
        id: `GA.ease.${h}`, slot: "natal", view: "eokbu", element: elOfGroup(h), group: h, ...eokTone(), tier: "practice",
        basis: [{ ruleId: "gaeun.N2", positions: gp?.[h] ?? [], values: { ...basis.groupTotals } }],
      })
    }
  } else if (eok?.status === "balanced") {
    picks.push({ id: "GA.balanced", slot: "natal", view: "eokbu", ...eokTone(), tier: "practice", basis: [{ ruleId: "gaeun.N3", positions: [] }] })
  }

  // ── N5 통관(첫 쌍만)
  if (tong?.status === "ok" && tong.element) {
    picks.push({
      id: "GA.bridge", slot: "natal", view: "tonggwan", element: tong.element, ...(tong.group ? { group: tong.group } : {}), tone: "firm", tier: "practice",
      basis: [{ ruleId: "gaeun.N5", positions: [], values: { bridgeWeight: tong.presentWeight ?? 0 } }],
    })
  }

  // ── N4 조후(needs 순서, 최대 2) + §4.1 충돌 수준
  const johuEls: { el: string; conflict?: GaeunPick["conflict"] }[] = []
  if (johu?.status === "ok") {
    for (const need of basis.climateNeeds.slice(0, 2)) {
      const el = NEED_ELEMENT[need]
      const conflict = eokOk ? conflictOf(st.verdict, elOfGroup, groupOfEl, h, el) : undefined
      picks.push({
        id: NEED_ID[need], slot: "natal", view: "johuClimate", element: el, ...(conflict ? { conflict } : {}), tone: "firm", tier: "practice",
        basis: [{ ruleId: "gaeun.N4", positions: [] }],
      })
      if (!johuEls.some((x) => x.el === el)) johuEls.push({ el, conflict })
    }
  }

  // ── N6 오행 생활 결: 억부 rank 1(C5면 생략) → 조후 오행(compatible·판정 없음만 — §4 P3·P4)
  const geEls: { el: string; view: GaeunPick["view"]; tone: Pick<GaeunPick, "tone" | "softBy">; ruleFrom: string; conflict?: GaeunPick["conflict"] }[] = []
  if (eokOk && !st.specialReversesEokbu) geEls.push({ el: eok!.element!, view: "eokbu", tone: eokTone(), ruleFrom: "N1" })
  for (const j of johuEls) {
    if (j.conflict === "tension" || j.conflict === "opposed") continue
    const same = geEls.find((x) => x.el === j.el)
    if (same) continue // 두 관점이 같은 오행이면 한 줄(§4 P2)
    geEls.push({ el: j.el, view: "johuClimate", tone: { tone: "firm" }, ruleFrom: "N4", ...(j.conflict ? { conflict: j.conflict } : {}) })
  }
  for (const g of geEls) {
    const id = GE_ID[g.el]
    if (!id) continue
    const both = g.view === "eokbu" && johuEls.some((j) => j.el === g.el)
    const base = { id, slot: "natal" as const, view: g.view, element: g.el, ...g.tone, ...(g.conflict ? { conflict: g.conflict } : {}) }
    const basisRows = [{ ruleId: `gaeun.N6.${g.ruleFrom}`, positions: [] as string[] }, ...(both ? [{ ruleId: "gaeun.N6.N4", positions: [] as string[] }] : [])]
    picks.push({ ...base, tier: "practice", basis: basisRows })
    if (o.referenceTier === "shown") picks.push({ ...base, tier: "reference", basis: basisRows.map((b) => ({ ...b })) })
  }

  // ── 운 L1~L7
  const eokFav = new Set<string>()
  const eokLoad = new Set<string>()
  if (eokOk) {
    eokFav.add(eok!.element!)
    if (eok!.xi) eokFav.add(eok!.xi)
    if (h) eokLoad.add(elOfGroup(h))
  }
  const johuFav = new Set<string>()
  const johuLoad = new Set<string>()
  if (johu?.status === "ok" && basis.climateNeeds.length) {
    const els = [...new Set(basis.climateNeeds.map((n) => NEED_ELEMENT[n]))]
    // 온도·습도가 서로 다른 쪽을 원하면(예: 한 + 조) 조후 rank 1(절댓값이 큰 축)만 쓴다 [백엔드 해석]
    const fav = els.length === 1 ? els[0] : (johu.element ?? els[0])
    johuFav.add(fav)
    johuLoad.add(OPPOSITE[fav])
  }
  const classify = (fav: Set<string>, load: Set<string>, el: string): Cls => (load.has(el) ? "load" : fav.has(el) ? "fav" : "neutral")
  const hasEok = eokFav.size > 0 || eokLoad.size > 0
  const hasJohu = johuFav.size > 0

  const slotPicks = (s: LuckGlyphFacts): GaeunPick[] => {
    const out: GaeunPick[] = []
    const slot = s.slot
    const groups: GaeunGroup[] = []
    for (const g of s.glyphs) if (!groups.includes(g.group)) groups.push(g.group)
    const halves: { half?: "early" | "late"; glyphs: LuckGlyphFacts["glyphs"] }[] =
      slot === "daeun" && o.luckHalves
        ? [{ half: "early", glyphs: s.glyphs.filter((g) => g.part === "stem") }, { half: "late", glyphs: s.glyphs.filter((g) => g.part === "branch") }]
        : [{ glyphs: s.glyphs }]
    for (const part of halves) {
      if (!part.glyphs.length) continue
      const e = hasEok ? verdictOf(part.glyphs.map((g) => classify(eokFav, eokLoad, g.element))) : null
      const j = hasJohu ? verdictOf(part.glyphs.map((g) => classify(johuFav, johuLoad, g.element))) : null
      let v: Verdict | null
      let split: GaeunPick["split"]
      if (e && j && e !== j) {
        v = "watch" // L3
        split = { eokbu: e, johuClimate: j }
      } else v = e ?? j
      if (!v) continue
      const partGroups = part.half ? [...new Set(part.glyphs.map((g) => g.group))] : groups
      const rule = [e ? "eokbu" : null, j ? "johuClimate" : null].filter(Boolean).join("+")
      out.push({
        id: `GT.${v}`, slot, view: "luck", luckGroups: partGroups, ...(e ? eokTone() : { tone: "firm" as const }), tier: "practice",
        ...(split ? { split } : {}), ...(part.half ? { half: part.half } : {}),
        basis: [{ ruleId: `gaeun.L2.${rule}`, positions: part.glyphs.map((g) => g.pos) }],
      })
    }
    if (slot === "daeun" && input.turn && input.turn.daeunIndex === s.daeunIndex) out.push(turnPick(input.turn))
    const seen: GaeunRelationId[] = []
    for (const r of s.relations) {
      if (seen.includes(r.id)) continue
      if (seen.length >= 2) break
      seen.push(r.id)
      out.push({
        id: `GI.${r.id}`, slot, view: "luck", luckGroups: groups, tone: "firm", tier: "practice",
        basis: s.relations.filter((x) => x.id === r.id).map((x) => ({ ruleId: `gaeun.L6.${x.kind}`, positions: [...x.positions] })),
      })
    }
    return out
  }

  const luck = input.luck ?? []
  const daeun = luck.find((s) => s.slot === "daeun")
  const seun = luck.find((s) => s.slot === "seun")
  if (daeun) picks.push(...slotPicks(daeun))
  if (input.turn && (!daeun || daeun.daeunIndex !== input.turn.daeunIndex)) picks.push(turnPick(input.turn))
  if (seun) picks.push(...slotPicks(seun))
  return picks
}

function turnPick(t: NonNullable<GaeunInput["turn"]>): GaeunPick {
  return {
    id: "GT.turn", slot: "daeun", view: "luck", tone: "firm", tier: "practice",
    basis: [{ ruleId: "gaeun.L5", positions: [`daeun[${t.daeunIndex}].stem`, `daeun[${t.daeunIndex}].branch`], values: { startYear: t.startYear } }],
  }
}
