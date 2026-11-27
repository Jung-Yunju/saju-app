// /api/free 응답 계약(서버·화면 공용). 개인정보(이름·생년월일·성별·출생지)는 이 응답에 넣지 않는다.
export type ElementKo = "목" | "화" | "토" | "금" | "수"

/** 간지 한 글자 쌍의 표시값 */
export interface GanzhiView {
  /** 한자 간지 예: "甲子" */
  hanja: string
  /** 한글 간지 예: "갑자" */
  ko: string
  stemHanja: string
  branchHanja: string
  stemKo: string
  branchKo: string
  /** 천간 오행 */
  element: ElementKo
  /** 지지(정기) 오행 */
  branchEl: ElementKo
}

export interface PillarView extends GanzhiView {
  key: "year" | "month" | "day" | "hour"
  label: string
  /** 일주(=나) */
  me?: boolean
}

export interface DaeunView extends GanzhiView {
  startAge: number
  startYear: number
  current: boolean
}

/** 할미 문장 한 덩어리. placeholder=true면 문안 준비 중 자리표시 */
export interface CopyBlock {
  title?: string
  /** 첫 줄(hook·일주 한 줄 등) */
  lead?: string
  text: string
  /** 이름표가 붙은 덧줄(강점·맹점·처방 등) */
  details?: { label: string; text: string }[]
  placeholder: boolean
}

export interface ElementCopy extends CopyBlock {
  kind: "excess" | "lack" | "balanced"
  el: ElementKo
}

export interface TeaserCopy {
  title: string
  /** 맛보기 문장(잠긴 본문 아님). needsConfirm 항목은 서버에서 이미 뺐다 */
  items: { menu: string; preview: string }[]
  lock: string
  button: string
  placeholder: boolean
}

export interface FreeCopy {
  dayMaster: CopyBlock
  dayPillar: CopyBlock
  elements: ElementCopy[]
  thisYear: CopyBlock
  /** 올해 문안 아래 작은 안내 */
  thisYearNote: string
  teaser: TeaserCopy
  share: { nickname: string; line: string; placeholder: boolean }
  /** "증명된 예언이 아니다" 안내(화면에 한 번) */
  disclaimer: string
}

export interface FreeResult {
  pillars: PillarView[]
  hourUnknown: boolean
  elements: { el: ElementKo; count: number }[]
  dayMaster: { hanja: string; ko: string; element: ElementKo; nickname: string }
  dayPillar: GanzhiView
  daeun: {
    startAge: number
    items: DaeunView[]
    /** 현재 대운 위치. 첫 대운 시작 전이면 -1 */
    currentIndex: number
  }
  thisYear: { year: number; ganzhi: GanzhiView }
  warnings: string[]
  engineVersion: string
  copy: FreeCopy
}

export const PLACEHOLDER_TEXT = "문안 준비 중"
