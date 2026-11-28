// POST /api/unmyeong/free 응답 형식(계약) — 화면(src/app/unmyeong/**)이 가져다 쓰는 타입. 순수 타입 파일(실행 코드 없음).
// 계약 원본: docs/redesign/20-unmyeong-plan.md §2 "무료 결과 API". 바꾸려면 총괄실장에게 알린다.
// 개인정보: 이름·생년월일·성별·출생지·양력/음력 구분은 응답에 없다. 이름은 서버로 보내지 않고 화면에서만 끼운다.
import type { DaeunView, ElementKo, GanzhiView, PillarView } from "@/app/free/_lib/types"
import type { FreeChapterKey } from "./assets"

export type { DaeunView, ElementKo, GanzhiView, PillarView }

// ─────────────────────────────────────────── 원형(archetype) — 엔진 연결 전에는 null

/** 원형 엔진(src/engine/archetype, archetype@0.1.0) 결과 중 화면에 내보내는 부분. 명세 초안: docs/redesign/02-archetypes.md §7 */
export interface UnmyeongArchetypeView {
  /** ArchetypeId 예: "bonghwang" — 그림은 assets.ts archetypeAssets(id) */
  id: string
  /** 관문 순서 1~12 */
  order: number
  /** 부 원형 id(없으면 null) */
  secondary: string | null
  variantTags: string[]
  /** 통과한 조건과 실제 값(근거 화면용) */
  matched: { key: string; op: string; value: number | string | boolean; threshold?: number | string | string[] }[]
  /** 보는 방식에 따라 원형이 바뀌는가 */
  stability: { nearBoundary: boolean; tableSensitive: boolean; hourSensitive: boolean | null }
  /** 전통 명리 공식 분류가 아님(화면 고지 필수) */
  disclaimer: "creative-symbol"
  version: string
}

// ─────────────────────────────────────────── 무료 5장 문안 — content/unmyeong/free-copy.json 납품 전에는 null

export interface UnmyeongFreeChapter {
  /** 1~5 */
  no: number
  /** being · gift · reason · chart · unfolding (assets.ts FREE_CHAPTER_KEYS) */
  key: FreeChapterKey
  title: string
  /** 본문(400~600자 목표). 호칭 치환 토큰이 있으면 화면이 이름으로 바꾼다 — 서버는 이름을 모른다 */
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
  dayPillar: PillarView
  daeun: { startAge: number; items: DaeunView[]; currentIndex: number }
  thisYear: { year: number; ganzhi: GanzhiView }
  /** 원형 엔진 연결 전 null (pending.archetype=true) */
  archetype: UnmyeongArchetypeView | null
  /** 5장 문안 납품 전 null (pending.chapters=true) */
  chapters: UnmyeongFreeChapter[] | null
  basis: UnmyeongBasis
  pending: { archetype: boolean; chapters: boolean }
  /** 엔진 경고(절입·시지 경계·시진 대표 시각 등) — 기존 /api/free와 같은 값 */
  warnings: string[]
  /** "calendar@…+rules@…" */
  engineVersion: string
}
