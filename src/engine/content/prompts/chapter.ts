// 장 명세를 만드는 공통 틀 (P4-03) — 담당: 콘텐츠 작가
// 장마다 다른 것은 사용자 메시지뿐이고, 시스템 프롬프트는 풀이 하나 안에서 같다(프롬프트 캐시 재사용).
// 사용자 메시지의 <사실표>는 장 초안의 factParts 목록으로만 만든다 → 문서(content-chapters.md)·테스트와 어긋나지 않는다.
import type { ChapterSpec, FactSheet } from "../types"
import {
  secDaeunList, secDaeunNow, secDayPillar, secElements, secGongmang, secGuards, secInteractions, secNatalTenGods,
  secNextYear, secNoGuess, secPillars, secStrength, secSubject, secThisYear, secUserFacts, secWarnings, userFactsFor,
} from "./facts"
import { CATCHPHRASES, type CatchphraseKey } from "./persona"
import type { JsonSchema } from "./schema"
import { systemFor } from "./system"

export type ChapterTier = "free" | "paid"

/** 사실표 조각 이름. 아래 SECTION_BUILDERS와 1:1 */
export type FactPart =
  | "subject"
  | "dayPillar"
  | "pillars"
  | "natalTenGods"
  | "natalInteractions"
  | "daeunInteractions"
  | "seunInteractions"
  | "gongmang"
  | "elements"
  | "strength"
  | "daeunNow"
  | "daeunPast"
  | "daeunAhead"
  | "thisYear"
  | "nextYear"
  | "userFacts"
  | "noGuessYears"
  | "warnings"
  | "guards"

export interface SectionOptions {
  /** 원국 십성에 지장간 항목을 넣을지(기본 true) */
  tenGodsHidden?: boolean
  /** 원국 십성 중 이 위치만(예: /^day\.branch/) */
  tenGodsOnly?: RegExp
  /** 대운·세운 관계 중 이 위치를 건드리는 것만(예: /^day\.branch/) */
  luckTouch?: RegExp
  /** daeunAhead에 넣을 대운 수(기본 4) */
  daeunAheadLimit?: number
}

type SectionBuilder = (facts: FactSheet, o: SectionOptions, topics: readonly string[]) => string

export const SECTION_BUILDERS: Record<FactPart, SectionBuilder> = {
  subject: (f) => secSubject(f),
  dayPillar: (f) => secDayPillar(f),
  pillars: (f) => secPillars(f),
  natalTenGods: (f, o) => secNatalTenGods(f, { includeHidden: o.tenGodsHidden ?? true, onlyPos: o.tenGodsOnly }),
  natalInteractions: (f) => secInteractions(f, "natal", "원국 안의 관계(합충형파해)"),
  daeunInteractions: (f, o) => secInteractions(f, "daeun", "대운 글자와 원국의 관계", o.luckTouch),
  seunInteractions: (f, o) => secInteractions(f, "seun", "올해 세운 글자와 원국의 관계", o.luckTouch),
  gongmang: (f) => secGongmang(f),
  elements: (f) => secElements(f),
  strength: (f) => secStrength(f),
  daeunNow: (f) => secDaeunNow(f),
  daeunPast: (f) => secDaeunList(f, "past"),
  daeunAhead: (f, o) => secDaeunList(f, "ahead", o.daeunAheadLimit ?? 4),
  thisYear: (f) => secThisYear(f),
  nextYear: (f) => secNextYear(f),
  userFacts: (f, _o, topics) => secUserFacts(f, topics),
  noGuessYears: (f) => secNoGuess(f),
  warnings: (f) => secWarnings(f),
  guards: (f) => secGuards(f),
}

/** ChapterSpec + 문서·테스트용 정보. products는 index.ts가 상품 구성표(products.ts)에서 채운다 */
export interface PromptChapter extends ChapterSpec {
  tier: ChapterTier
  /** 이 장이 사용자 메시지에 넣는 사실표 조각(순서대로) */
  factParts: readonly FactPart[]
  /** 이 장이 쓰는 사용자 사실 주제(":"로 끝나면 접두어) */
  userFactTopics: readonly string[]
  /** maxOutputTokens 산정 근거 */
  tokenBasis: string
}

export interface ChapterDraft {
  id: string
  title: string
  tier: ChapterTier
  maxOutputTokens: number
  tokenBasis: string
  factParts: readonly FactPart[]
  userFactTopics: readonly string[]
  sectionOptions?: SectionOptions
  /** 이 장에서 할 일(번호 목록으로 나간다) */
  tasks(facts: FactSheet): string[]
  /**
   * 장 짜임(D-023): 이 장의 어느 칸이 [타고난 결 / 살아온 모습과 잇기 / 바꿔 볼 것] 몫인지.
   * links는 이 장에 사용자 사실이 있을 때만 나간다(없으면 "건너뛰고 지어내지 않는다"로 바뀐다).
   */
  flow: { nature: string; links?: string; change: string }
  /** 다른 장 몫이라 이 장에서 쓰지 않는 것 */
  notHere?: string
  /** 분량 지시 */
  length: string
  /** 이 장에서 허락하는 말버릇 */
  catchphrases?: readonly { key: CatchphraseKey; where: string }[]
  outputSchema: JsonSchema
}

export function renderSections(d: ChapterDraft, facts: FactSheet): string[] {
  const o = d.sectionOptions ?? {}
  return d.factParts.map((p) => SECTION_BUILDERS[p](facts, o, d.userFactTopics))
}

/** [이 장의 짜임] — 타고난 결 → (사용자 사실이 있으면) 살아온 모습과 잇기 → 바꿔 볼 것 */
export function renderFlow(d: ChapterDraft, facts: FactSheet): string[] {
  const hasUser = d.userFactTopics.length > 0 && userFactsFor(facts, d.userFactTopics).length > 0
  const links = !d.flow.links
    ? null
    : hasUser
      ? `- 살아온 모습과 잇기: ${d.flow.links} [사용자 사실]의 출처를 밝히고("네가 말해 준 대로"), 글자와 닿으면 확인하는 어조로, 다르면 '글자 밖에서 익힌 힘'으로 존중한다.`
      : "- 살아온 모습과 잇기: 이 장에는 사용자 사실이 없다. 이 몫은 건너뛰고, 있을 법한 삶을 지어 채우지 않는다."
  return [
    "[이 장의 짜임 — 타고난 결 → 살아온 모습과 잇기 → 바꿔 볼 것]",
    `- 타고난 결: ${d.flow.nature}`,
    ...(links ? [links] : []),
    `- 바꿔 볼 것: ${d.flow.change} 생활 실천(습관·관계·일하는 방식·시기 활용)으로, 효과를 단정하지 않고("해 볼 만하다") 쓴다.`,
  ]
}

export function renderUser(d: ChapterDraft, facts: FactSheet): string {
  const tasks = d.tasks(facts).map((t, i) => `${i + 1}. ${t}`)
  const phrases = d.catchphrases?.length
    ? d.catchphrases.map((c) => `- "${CATCHPHRASES[c.key]}" — ${c.where}, 1회`).join("\n")
    : "- 이 장에서는 말버릇을 쓰지 않는다"
  return [
    `이번에 쓸 장: 「${d.title}」 (${d.id})`,
    "",
    "<사실표>",
    renderSections(d, facts).join("\n\n"),
    "</사실표>",
    "",
    ...renderFlow(d, facts),
    "",
    "[이 장에서 할 일]",
    ...tasks,
    ...(d.notHere ? ["", `[이 장에서 쓰지 않는 것 — 다른 장 몫] ${d.notHere}`] : []),
    "",
    `[분량] ${d.length}`,
    "",
    "[이 장에서 쓸 수 있는 말버릇]",
    phrases,
    "",
    "[쉬운 말] 그림 말을 먼저, 용어는 뒤 괄호에 두거나 뺀다. 한 문단에 명리 용어는 하나까지, 한자는 이 장에서 처음 나올 때만.",
    "",
    "[출력] 지정된 JSON 스키마로만 답한다. 위 사실표에 없는 글자·관계·연도는 이 장에서 쓰지 않는다.",
  ].join("\n")
}

/** 초안 → PromptChapter(products는 빈 배열, index.ts에서 상품 구성표로 채움) */
export function defineChapter(d: ChapterDraft): PromptChapter {
  return {
    id: d.id,
    title: d.title,
    products: [],
    maxOutputTokens: d.maxOutputTokens,
    outputSchema: d.outputSchema,
    tier: d.tier,
    factParts: d.factParts,
    userFactTopics: d.userFactTopics,
    tokenBasis: d.tokenBasis,
    build(facts: FactSheet) {
      return { system: systemFor(facts), user: renderUser(d, facts) }
    },
  }
}
