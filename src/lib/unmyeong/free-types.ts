// POST /api/unmyeong/free 응답 형식(계약) — 화면(src/app/unmyeong/**)이 가져다 쓰는 타입. 순수 타입 파일(실행 코드 없음).
// 계약 원본: docs/redesign/20-unmyeong-plan.md §2 "무료 결과 API". 바꾸려면 총괄실장에게 알린다.
// 개인정보: 이름·생년월일·성별·출생지·양력/음력 구분은 응답에 없다. 이름은 서버로 보내지 않는다(풀이 본문에는 호칭이 없다 — D-029).
import type { DaeunView, ElementKo, GanzhiView, PillarView } from "@/app/free/_lib/types"
import type { FreeChapterKey } from "./assets"

export type { DaeunView, ElementKo, GanzhiView, PillarView }

// ─────────────────────────────────────────── 원형(archetype) — 엔진 결과(analyzeArchetype)에서 옮긴다

/** 원형 분류(엔진 ArchetypeCategory와 같은 값) */
export type UnmyeongArchetypeCategory = "divineBeast" | "spiritAnimal" | "divineHuman" | "nature" | "celestial"

/** 원형 엔진(src/engine/archetype, archetype@0.1.0) 결과 중 화면에 내보내는 부분. 변환: archetype-link.ts resolveArchetype */
export interface UnmyeongArchetypeView {
  /** ArchetypeId 예: "bonghwang" — 그림은 assets.ts archetypeAssets(id) */
  id: string
  /** 원형 이름(엔진 규칙 데이터) 예: "달의 여신" */
  name: string
  category: UnmyeongArchetypeCategory
  /** 관문 순서 1~12 */
  order: number
  /** 부 원형 id(없으면 null) — 관문 1~12 중 주 원형 다음으로 통과한 원형(D-030) */
  secondary: string | null
  /** 부 원형 이름(없으면 null) */
  secondaryName: string | null
  /** 변형 표지 — 엔진 archetype@0.1.0에 아직 없어 늘 []. 생기면 엔진 값을 옮긴다 */
  variantTags: string[]
  /**
   * 다리 기운(통관 오행) — 달의 여신(양강 대치)일 때 대표 양강 대치 쌍 X>Y에서 X가 생하는 오행. 그 밖에는 null.
   * null이면 문안 고르기가 variantTags 표지 → 없으면 bridgeFallback 문장(free-copy.ts bridgeOf)
   */
  bridge?: ElementKo | null
  /** 주 원형 관문에서 참이 된 조건과 실제 값(근거 화면용). op: eq ne in gte gt lte lt between has hasAny hasNone */
  matched: {
    key: string
    op: string
    value: number | string | boolean | null | string[]
    threshold?: number | string | boolean | null | (number | string | boolean | null)[]
    /** not 안의 조건(값이 기준에 맞지 않아서 참) */
    negated?: true
  }[]
  /**
   * 보는 방식에 따라 원형이 바뀌는가.
   * nearBoundary: 관문형(cascade) 판정이라 점수 경계가 없어 늘 false.
   * tableSensitive: 지장간 표(kr-monthly-30 ↔ cn-lunarjs)에 따라 원형이 다름 — 기록용(D-030 표 고정, 화면에 내지 않는다).
   * hourSensitive: 시각 모름일 때 12시진 중 원형이 바뀌는 시진이 있음(시각을 알면 null)
   */
  stability: { nearBoundary: boolean; tableSensitive: boolean; hourSensitive: boolean | null }
  /** 시각 모름이면 true — 화면은 "태어난 시각을 알면 다른 모습이 보일 수 있다"를 붙인다(D-030) */
  hourUnknownNote: boolean
  /** 전통 명리 공식 분류가 아님(화면 고지 필수) */
  disclaimer: "creative-symbol"
  /** 고지 문장(엔진 규칙 데이터의 disclaimer) */
  disclaimerText: string
  /** 예: "archetype@0.1.0" */
  version: string
}

// ─────────────────────────────────────────── 무료 5장 문안 — content/unmyeong/free-copy.json 납품 전에는 null

export interface UnmyeongFreeChapter {
  /** 1~5 = FREE_CHAPTER_KEYS 순서(서버가 강제) */
  no: number
  /** 1 being 너는 누구인가 · 2 symbol 너의 신성과 영물 · 3 gift 하늘이 네게 준 것 · 4 shadow 네가 넘어야 할 것 · 5 counsel 지금 네게 필요한 말 */
  key: FreeChapterKey
  title: string
  /**
   * 본문(다섯 장 합 400~600자, D-029 ④). 완성된 문장이다 — 치환 토큰 없음, 호칭 없음(D-029 ②, 화면이 이름을 끼우지 않는다).
   * {bridge}는 서버가 물·나무·불·흙·쇠로 바꿔 내보낸다. 시각 모름이면 1장 끝에 시각 안내 한 문장이 붙어 있다(D-030)
   */
  text: string
}

// ─────────────────────────────────────────── 「할미는 어떻게 알았을까?」 근거 — 규칙 엔진 analyzeRules 값만 옮긴다

/** 쉬운 말 + 용어(한글) + 한자. 예: { ko: "정관", hanja: "正官", plain: "너를 바로 세우는 틀과 책임" } */
export interface TermLabel {
  ko: string
  hanja: string
  plain: string
}

export interface BasisTenGodAt {
  pillar: "year" | "month" | "day" | "hour"
  part: "stem" | "branch"
  /** 그 자리 글자(한자·한글) */
  char: string
  charKo: string
  tenGod: TermLabel
}

export interface BasisTenGodGroup extends TermLabel {
  group: "bigyeop" | "inseong" | "siksang" | "jaeseong" | "gwansal"
  /** 일간 제외 묶음 합 대비 비율(0~1, 규칙 엔진 strength.groupTotals — 가중 모형 값) */
  share: number
}

export interface BasisElement extends TermLabel {
  el: ElementKo
  /** 천간 + 지지 정기 글자 수(규칙 엔진 elements.counts) */
  count: number
  /** 가중 비율(0~1, qiFlow.shares) */
  share: number
}

export interface UnmyeongBasis {
  /** 예: "rules@0.4.0" */
  rulesVersion: string
  dayMaster: { char: string; charKo: string; element: ElementKo; label: TermLabel }
  tenGods: {
    /** 원국 겉 글자(천간·지지, 일간 제외)의 십성 */
    positions: BasisTenGodAt[]
    /** 지장간(땅 글자 속)에만 있는 십성 */
    hiddenOnly: TermLabel[]
    groups: BasisTenGodGroup[]
  }
  elements: { items: BasisElement[]; dominant: ElementKo; missing: ElementKo[] }
  strength: {
    /** 대표 모형 판정 */
    verdict: "신강" | "중화" | "신약"
    label: TermLabel
    /** 세 모형 판정 */
    models: { model: "weighted" | "threeFactor" | "rooted"; name: string; verdict: "신강" | "중화" | "신약" }[]
    /** 모형·지장간 표·시각에 따라 판정이 갈리거나 경계 근처면 true → 화면에 "보는 방식에 따라 달라질 수 있음" */
    sensitive: boolean
    notes: string[]
  }
  /** 주 후보 격국(특수격 후보는 대표 결정 전이라 싣지 않음). 못 정하면 null */
  structure: { name: string; label: TermLabel; confidence: "medium" | "low"; sensitive: boolean; notes: string[] } | null
  /** 용신 — 관점별 병기(하나로 합치지 않는다). 특수격 관점 제외 */
  usefulGods: { method: string; header: string; element: BasisElementRef }[]
  /** 화면 하단 고지(규칙 엔진의 해석 재료이며 미래를 확정하지 않는다 등) */
  caveats: string[]
}

export interface BasisElementRef extends TermLabel {
  el: ElementKo
}

// ─────────────────────────────────────────── 응답 전체

export interface UnmyeongFreeResponse {
  /** 원국 표시값(기존 /api/free와 같은 모양). 시각 모름이면 시주 없음 */
  pillars: PillarView[]
  hourUnknown: boolean
  /** 오행 개수(표시용, 목→수 순) */
  elements: { el: ElementKo; count: number }[]
  dayMaster: { hanja: string; ko: string; element: ElementKo }
  /** 일주 간지(일간 + 일지) */
  dayPillar: GanzhiView
  daeun: { startAge: number; items: DaeunView[]; currentIndex: number }
  thisYear: { year: number; ganzhi: GanzhiView }
  /** 원형(엔진 연결됨 → 정상이면 늘 값이 있다. null이면 pending.archetype=true) */
  archetype: UnmyeongArchetypeView | null
  /** 5장 문안 납품 전 null (pending.chapters=true) */
  chapters: UnmyeongFreeChapter[] | null
  basis: UnmyeongBasis
  pending: { archetype: boolean; chapters: boolean }
  /**
   * 화면용 쉬운 안내(절기 경계·시 경계·서머타임 등). 엔진 경고 원문은 싣지 않는다 — 시각·날짜 숫자 없음.
   * 꼭 필요한 것만 골라 바꾼다(warnings.ts friendlyWarnings). 기존 /api/free의 warnings와 다르다
   */
  warnings: string[]
  /** "calendar@…+rules@…" */
  engineVersion: string
}
