// 명리 기초 표 (rules-spec §1~§3, §5~§7). 순수 데이터 — 계산은 각 모듈에서 한다.
// 표는 rules-spec.md의 표를 옮긴 것이다. 공식(검산용)은 테스트에서만 쓴다.
// ⚑ 표시 칸은 학파 차이(옵션으로 선택). 수치는 L0(교재 통용 표, 고전 원문 대조 전) — 잠정.
import type { Branch, Element, Stem } from "../types"
import type { HiddenStemRole, HiddenStemTableId, TwelveStage, YinYang } from "./types"

// ─────────────────────────────────────────── §1 천간

export const STEM_ELEMENT: Readonly<Record<Stem, Element>> = {
  甲: "wood", 乙: "wood", 丙: "fire", 丁: "fire", 戊: "earth",
  己: "earth", 庚: "metal", 辛: "metal", 壬: "water", 癸: "water",
}

export const STEM_YINYANG: Readonly<Record<Stem, YinYang>> = {
  甲: "yang", 乙: "yin", 丙: "yang", 丁: "yin", 戊: "yang",
  己: "yin", 庚: "yang", 辛: "yin", 壬: "yang", 癸: "yin",
}

// ─────────────────────────────────────────── §2 지지

export const BRANCH_ELEMENT: Readonly<Record<Branch, Element>> = {
  子: "water", 丑: "earth", 寅: "wood", 卯: "wood", 辰: "earth", 巳: "fire",
  午: "fire", 未: "earth", 申: "metal", 酉: "metal", 戌: "earth", 亥: "water",
}

/** 지지 순번 음양(子=양부터 번갈아) — branchYinYang="byOrder" */
export const BRANCH_YINYANG_BY_ORDER: Readonly<Record<Branch, YinYang>> = {
  子: "yang", 丑: "yin", 寅: "yang", 卯: "yin", 辰: "yang", 巳: "yin",
  午: "yang", 未: "yin", 申: "yang", 酉: "yin", 戌: "yang", 亥: "yin",
}

/** ⚑ 정기 음양 — branchYinYang="byMainQi"(기본 제안). 子·午·巳·亥만 순번과 다르다 */
export const BRANCH_YINYANG_BY_MAIN_QI: Readonly<Record<Branch, YinYang>> = {
  子: "yin", 丑: "yin", 寅: "yang", 卯: "yin", 辰: "yang", 巳: "yang",
  午: "yin", 未: "yin", 申: "yang", 酉: "yin", 戌: "yang", 亥: "yang",
}

// ─────────────────────────────────────────── §3 지장간

export interface HiddenStemRow {
  stem: Stem
  role: HiddenStemRole
  days: number | null
}

/** §3-1 kr-monthly-30 (기본 제안). 날수 합 30. ⚑ 수치 L0 — 잠정. 순서 여기 → 중기 → 정기 */
const KR_MONTHLY_30: Readonly<Record<Branch, readonly HiddenStemRow[]>> = {
  子: [{ stem: "壬", role: "yeogi", days: 10 }, { stem: "癸", role: "jeonggi", days: 20 }],
  丑: [{ stem: "癸", role: "yeogi", days: 9 }, { stem: "辛", role: "junggi", days: 3 }, { stem: "己", role: "jeonggi", days: 18 }],
  寅: [{ stem: "戊", role: "yeogi", days: 7 }, { stem: "丙", role: "junggi", days: 7 }, { stem: "甲", role: "jeonggi", days: 16 }],
  卯: [{ stem: "甲", role: "yeogi", days: 10 }, { stem: "乙", role: "jeonggi", days: 20 }],
  辰: [{ stem: "乙", role: "yeogi", days: 9 }, { stem: "癸", role: "junggi", days: 3 }, { stem: "戊", role: "jeonggi", days: 18 }],
  巳: [{ stem: "戊", role: "yeogi", days: 7 }, { stem: "庚", role: "junggi", days: 7 }, { stem: "丙", role: "jeonggi", days: 16 }],
  午: [{ stem: "丙", role: "yeogi", days: 10 }, { stem: "己", role: "junggi", days: 9 }, { stem: "丁", role: "jeonggi", days: 11 }],
  未: [{ stem: "丁", role: "yeogi", days: 9 }, { stem: "乙", role: "junggi", days: 3 }, { stem: "己", role: "jeonggi", days: 18 }],
  申: [{ stem: "戊", role: "yeogi", days: 7 }, { stem: "壬", role: "junggi", days: 7 }, { stem: "庚", role: "jeonggi", days: 16 }],
  酉: [{ stem: "庚", role: "yeogi", days: 10 }, { stem: "辛", role: "jeonggi", days: 20 }],
  戌: [{ stem: "辛", role: "yeogi", days: 9 }, { stem: "丁", role: "junggi", days: 3 }, { stem: "戊", role: "jeonggi", days: 18 }],
  亥: [{ stem: "戊", role: "yeogi", days: 7 }, { stem: "甲", role: "junggi", days: 7 }, { stem: "壬", role: "jeonggi", days: 16 }],
}

/**
 * §3-2 cn-lunarjs (lunar-javascript 1.7.8 ZHI_HIDE_GAN과 같은 글자). 날수 없음.
 * 라이브러리는 역할(여기·중기)을 주지 않고 순서도 지지마다 다르다(丑[己,癸,辛] vs 寅[甲,丙,戊]).
 * 그래서 역할은 같은 글자가 kr-monthly-30에서 맡는 역할로 붙였다(엔진 개발자 판단 — 연구소장 확인 필요).
 */
const CN_LUNARJS: Readonly<Record<Branch, readonly HiddenStemRow[]>> = {
  子: [{ stem: "癸", role: "jeonggi", days: null }],
  丑: [{ stem: "癸", role: "yeogi", days: null }, { stem: "辛", role: "junggi", days: null }, { stem: "己", role: "jeonggi", days: null }],
  寅: [{ stem: "戊", role: "yeogi", days: null }, { stem: "丙", role: "junggi", days: null }, { stem: "甲", role: "jeonggi", days: null }],
  卯: [{ stem: "乙", role: "jeonggi", days: null }],
  辰: [{ stem: "乙", role: "yeogi", days: null }, { stem: "癸", role: "junggi", days: null }, { stem: "戊", role: "jeonggi", days: null }],
  巳: [{ stem: "戊", role: "yeogi", days: null }, { stem: "庚", role: "junggi", days: null }, { stem: "丙", role: "jeonggi", days: null }],
  午: [{ stem: "己", role: "junggi", days: null }, { stem: "丁", role: "jeonggi", days: null }],
  未: [{ stem: "丁", role: "yeogi", days: null }, { stem: "乙", role: "junggi", days: null }, { stem: "己", role: "jeonggi", days: null }],
  申: [{ stem: "戊", role: "yeogi", days: null }, { stem: "壬", role: "junggi", days: null }, { stem: "庚", role: "jeonggi", days: null }],
  酉: [{ stem: "辛", role: "jeonggi", days: null }],
  戌: [{ stem: "辛", role: "yeogi", days: null }, { stem: "丁", role: "junggi", days: null }, { stem: "戊", role: "jeonggi", days: null }],
  亥: [{ stem: "甲", role: "junggi", days: null }, { stem: "壬", role: "jeonggi", days: null }],
}

/** §3-3 main-only: 정기 하나 */
const MAIN_ONLY: Readonly<Record<Branch, readonly HiddenStemRow[]>> = {
  子: [{ stem: "癸", role: "jeonggi", days: null }],
  丑: [{ stem: "己", role: "jeonggi", days: null }],
  寅: [{ stem: "甲", role: "jeonggi", days: null }],
  卯: [{ stem: "乙", role: "jeonggi", days: null }],
  辰: [{ stem: "戊", role: "jeonggi", days: null }],
  巳: [{ stem: "丙", role: "jeonggi", days: null }],
  午: [{ stem: "丁", role: "jeonggi", days: null }],
  未: [{ stem: "己", role: "jeonggi", days: null }],
  申: [{ stem: "庚", role: "jeonggi", days: null }],
  酉: [{ stem: "辛", role: "jeonggi", days: null }],
  戌: [{ stem: "戊", role: "jeonggi", days: null }],
  亥: [{ stem: "壬", role: "jeonggi", days: null }],
}

export const HIDDEN_STEM_TABLES: Readonly<Record<HiddenStemTableId, Readonly<Record<Branch, readonly HiddenStemRow[]>>>> = {
  "kr-monthly-30": KR_MONTHLY_30,
  "cn-lunarjs": CN_LUNARJS,
  "main-only": MAIN_ONLY,
}

/**
 * 날수 없는 표의 임시 비율 (rules-spec §3-2). 연구소장 설계값 — 고전 근거 없음(잠정).
 * 세 글자: 정기 0.6 / 중기 0.3 / 여기 0.1, 두 글자: 정기 0.7 / 나머지 0.3, 한 글자: 1.0
 */
export const PROVISIONAL_HIDDEN_WEIGHTS = {
  three: { jeonggi: 0.6, junggi: 0.3, yeogi: 0.1 },
  two: { jeonggi: 0.7, other: 0.3 },
} as const

// ─────────────────────────────────────────── §5 12운성

/** 단계 순서(번호 0~11) */
export const TWELVE_STAGES: readonly TwelveStage[] = ["장생", "목욕", "관대", "건록", "제왕", "쇠", "병", "사", "묘", "절", "태", "양"]

/**
 * 기본 행(음간 역행 기준)의 장생 자리와 방향. 戊·己는 earthStages, 음간은 twelveStagesYin 옵션으로
 * 다른 행을 빌려 쓴다(twelveStages.ts). 甲亥 丙寅 庚巳 壬申 순행 · 乙午 丁酉 辛子 癸卯 역행.
 */
export const STAGE_ROW: Readonly<Partial<Record<Stem, { start: Branch; forward: boolean }>>> = {
  甲: { start: "亥", forward: true },
  丙: { start: "寅", forward: true },
  庚: { start: "巳", forward: true },
  壬: { start: "申", forward: true },
  乙: { start: "午", forward: false },
  丁: { start: "酉", forward: false },
  辛: { start: "子", forward: false },
  癸: { start: "卯", forward: false },
}

/** 록(祿) 표 — 12운성 옵션과 무관하게 고정(schools.md §7). 신살 단계용. 검산: reverse에서 건록 자리와 같다 */
export const LU: Readonly<Record<Stem, Branch>> = {
  甲: "寅", 乙: "卯", 丙: "巳", 丁: "午", 戊: "巳", 己: "午", 庚: "申", 辛: "酉", 壬: "亥", 癸: "子",
}

// ─────────────────────────────────────────── §6 천간 관계

/** 천간합 — [두 글자, 결과 오행]. 합화 여부는 판정하지 않는다 */
export const STEM_COMBINES: readonly (readonly [Stem, Stem, Element])[] = [
  ["甲", "己", "earth"], ["乙", "庚", "metal"], ["丙", "辛", "water"], ["丁", "壬", "wood"], ["戊", "癸", "fire"],
]

/** 천간충 — 戊己는 넣지 않는 것이 통례(⚑, 옵션 없음) */
export const STEM_CLASHES: readonly (readonly [Stem, Stem])[] = [
  ["甲", "庚"], ["乙", "辛"], ["丙", "壬"], ["丁", "癸"],
]

// ─────────────────────────────────────────── §7 지지 관계

/** 육합 — 결과 오행. 午未는 wuWeiCombine 옵션(null 자리) */
export const SIX_COMBINES: readonly (readonly [Branch, Branch, Element | null])[] = [
  ["子", "丑", "earth"], ["寅", "亥", "wood"], ["卯", "戌", "fire"], ["辰", "酉", "metal"], ["巳", "申", "water"], ["午", "未", null],
]

/** 삼합 [생지, 왕지, 고지, 결과 오행] */
export const THREE_COMBINES: readonly (readonly [Branch, Branch, Branch, Element])[] = [
  ["申", "子", "辰", "water"], ["亥", "卯", "未", "wood"], ["寅", "午", "戌", "fire"], ["巳", "酉", "丑", "metal"],
]

/** 방합 [세 글자, 결과 오행] */
export const DIRECTIONAL_COMBINES: readonly (readonly [Branch, Branch, Branch, Element])[] = [
  ["寅", "卯", "辰", "wood"], ["巳", "午", "未", "fire"], ["申", "酉", "戌", "metal"], ["亥", "子", "丑", "water"],
]

export const BRANCH_CLASHES: readonly (readonly [Branch, Branch])[] = [
  ["子", "午"], ["丑", "未"], ["寅", "申"], ["卯", "酉"], ["辰", "戌"], ["巳", "亥"],
]

/** 삼형 두 묶음 */
export const THREE_PUNISHMENTS: readonly (readonly [Branch, Branch, Branch])[] = [
  ["寅", "巳", "申"], ["丑", "戌", "未"],
]
/** 상형 */
export const MUTUAL_PUNISHMENTS: readonly (readonly [Branch, Branch])[] = [["子", "卯"]]
/** 자형 — 같은 글자 두 개 */
export const SELF_PUNISHMENTS: readonly Branch[] = ["辰", "午", "酉", "亥"]

export const BRANCH_BREAKS: readonly (readonly [Branch, Branch])[] = [
  ["子", "酉"], ["丑", "辰"], ["寅", "亥"], ["卯", "午"], ["巳", "申"], ["未", "戌"],
]

export const BRANCH_HARMS: readonly (readonly [Branch, Branch])[] = [
  ["子", "未"], ["丑", "午"], ["寅", "巳"], ["卯", "辰"], ["申", "亥"], ["酉", "戌"],
]

/** 왕지(子午卯酉) — 반합 판정용 */
export const KING_BRANCHES: readonly Branch[] = ["子", "午", "卯", "酉"]
