// 견본 풀이용 가상 인물 10명 — 담당: 백엔드·서버 개발자
// 모두 지어낸 인물이다(실존 아님). 이름은 두지 않고, AI에는 호칭("손주")·나이·원국 사실표만 간다.
// 출생 입력은 엔진(computeChart·analyzeRules, rules@0.3.0)으로 직접 돌려 보고 골랐다.
// 고른 기준(총괄실장 지시): 일간 10개 모두 다르게 · 남녀 5명씩 · 20대 초~60대 · 사계절 고루 ·
//   시각 모름 1 · 윤달 1 · 서머타임(1987) 1 · 입춘 경계 1 · 극신강 1 · 극신약 1 · 설문 답 있는 사람 3("예시" 응답).
// 각 인물의 expect 칸은 tests/content/samples.test.ts가 엔진으로 다시 확인한다(엔진이 바뀌어 조건이 깨지면 테스트가 알려 준다).
// 기준 시각 2026-11-27(KST) 만 나이. 원국은 진태양시 보정(기본 옵션) 후 값.
import type { BirthInput, Stem } from "../../../src/engine/types"
import type { SurveyAnswer } from "../../../src/engine/personalize/types"

export interface SamplePersona {
  /** 파일 이름에 쓰는 번호(p01~p10) */
  id: string
  /** --only 에 쓰는 번호(1~10) */
  n: number
  /** 한 줄 요약(화면용, 실명 없음) */
  label: string
  /** 이 인물을 고른 이유 */
  why: string
  birth: BirthInput
  /** 개인화 설문 "예시" 응답(가상). 없으면 설문 건너뜀 */
  answers?: SurveyAnswer[]
  /** 호칭. 실명을 넣지 않는다 */
  addressAs: string
  /** --compare 때 두 번째 모델로도 만든다 */
  compare?: boolean
  /** 엔진으로 확인한 조건(테스트가 다시 확인) */
  expect: {
    dayStem: Stem
    /** 가중 점수 모형(1차 모형)의 극단 판정 */
    extreme?: "strong" | "weak"
    hourUnknown?: true
    leapMonth?: true
    dst?: true
    /** 절입(立春) 2시간 이내 출생 경고가 붙는다 */
    ipchunBoundary?: true
    season: "봄" | "여름" | "가을" | "겨울"
  }
}

/** 설문 응답이 가상 예시임을 화면·JSON에 밝히는 문구 */
export const SURVEY_EXAMPLE_NOTE = "예시 응답(가상 인물의 지어낸 답)"

export const PERSONAS: readonly SamplePersona[] = [
  {
    id: "p01",
    n: 1,
    label: "20대 초반 여성 · 봄 · 학생 · 설문 있음",
    why: "가장 어린 연령대(만 21세)에서 학령기·사회 진입기 장면이 나오는지 본다. 설문(학생·첫째·MBTI·말씨 '부드럽게') 예시 1. 일간 乙.",
    birth: { calendar: "solar", year: 2005, month: 4, day: 11, time: { hour: 8, minute: 40 }, gender: "F" },
    answers: [
      { questionId: "concernTopic", values: ["career", "self"] },
      { questionId: "relationshipStatus", values: ["single"] },
      { questionId: "occupationStatus", values: ["student"] },
      { questionId: "birthOrder", values: ["eldest"] },
      { questionId: "mbti", values: ["INFP"] },
      { questionId: "lifeEvents", values: ["school_milestone"], years: { school_milestone: 2024 } },
      { questionId: "toneStrength", values: ["gentle"] },
    ],
    addressAs: "손주",
    expect: { dayStem: "乙", season: "봄" },
  },
  {
    id: "p02",
    n: 2,
    label: "20대 중반 남성 · 겨울 · 설문 없음",
    why: "설문 없이 원국만으로 쓰는 기본 경우(대조군). 겨울 丑월생, 신강약 중화 근처라 판정이 갈리는(split) 경우도 본다. 일간 壬.",
    birth: { calendar: "solar", year: 2002, month: 1, day: 14, time: { hour: 20, minute: 15 }, gender: "M" },
    addressAs: "손주",
    expect: { dayStem: "壬", season: "겨울" },
  },
  {
    id: "p03",
    n: 3,
    label: "20대 후반 남성 · 여름 · 음력 윤달생",
    why: "음력 윤달 입력(1998년 윤5월 10일 → 양력 1998-07-03) 경로가 사실표까지 문제없이 가는지 본다. 일간 辛.",
    birth: { calendar: "lunar", year: 1998, month: 5, day: 10, isLeapMonth: true, time: { hour: 9, minute: 50 }, gender: "M" },
    addressAs: "손주",
    expect: { dayStem: "辛", leapMonth: true, season: "여름" },
  },
  {
    id: "p04",
    n: 4,
    label: "30대 초반 여성 · 입춘 직전 출생(연주·월주 경계)",
    why: "1995년 입춘(02-04 16:12 KST) 22분 전 출생 → 연주 甲戌·월주 丁丑(아직 전 해). 엔진 경고 '절입 2시간 이내'가 풀이의 불확실성 문장(caveat)으로 나오는지 본다. 일간 丙.",
    birth: { calendar: "solar", year: 1995, month: 2, day: 4, time: { hour: 15, minute: 50 }, gender: "F" },
    addressAs: "손주",
    expect: { dayStem: "丙", ipchunBoundary: true, season: "겨울" },
  },
  {
    id: "p05",
    n: 5,
    label: "30대 후반 여성 · 여름 · 서머타임 시기(1987) · 설문 있음",
    why: "1987년 서머타임(UTC+10) 시각 출생 → 진태양시 보정 −92분으로 시지가 申→未로 바뀐다. 설문(기혼·자녀·직장·이직 고민·지나온 해) 예시 2. 비교 모델 대상.",
    birth: { calendar: "solar", year: 1987, month: 7, day: 20, time: { hour: 15, minute: 30 }, gender: "F" },
    answers: [
      { questionId: "concernTopic", values: ["family", "career"] },
      { questionId: "relationshipStatus", values: ["married"] },
      { questionId: "hasChildren", values: ["has"] },
      { questionId: "occupationStatus", values: ["employed"] },
      { questionId: "careerFeeling", values: ["considering_change"] },
      { questionId: "lifeEvents", values: ["marriage", "childbirth", "job_change"], years: { marriage: 2014, childbirth: 2017, job_change: 2021 } },
      { questionId: "toneStrength", values: ["balanced"] },
    ],
    addressAs: "손주",
    compare: true,
    expect: { dayStem: "庚", dst: true, season: "여름" },
  },
  {
    id: "p06",
    n: 6,
    label: "40대 여성 · 가을 · 태어난 시각 모름",
    why: "시각 모름 → 시주 없이 세 기둥만. 풀이가 시주를 지어내지 않고 '시를 몰라 비워 둔다'를 밝히는지 본다. 일간 戊.",
    birth: { calendar: "solar", year: 1980, month: 10, day: 12, time: null, gender: "F" },
    addressAs: "손주",
    expect: { dayStem: "戊", hourUnknown: true, season: "가을" },
  },
  {
    id: "p07",
    n: 7,
    label: "50대 초반 남성 · 가을 · 극신약",
    why: "엔진 판정 극신약(가중 점수 19.7, 세 모형 모두 신약). 약한 일간을 '불운'으로 단정하지 않는지 본다. 일간 己.",
    birth: { calendar: "solar", year: 1974, month: 10, day: 5, time: { hour: 3, minute: 10 }, gender: "M" },
    addressAs: "손주",
    expect: { dayStem: "己", extreme: "weak", season: "가을" },
  },
  {
    id: "p08",
    n: 8,
    label: "50대 후반 남성 · 겨울 · 자영업 · 설문 있음",
    why: "설문(자영업·막내·사업 시작 해·말씨 '솔직하게') 예시 3. 말씨 세기 direct가 반영되는지, 사업 시작 해를 '맞히지' 않는지 본다. 일간 癸.",
    birth: { calendar: "solar", year: 1968, month: 12, day: 19, time: { hour: 6, minute: 20 }, gender: "M" },
    answers: [
      { questionId: "concernTopic", values: ["money"] },
      { questionId: "relationshipStatus", values: ["married"] },
      { questionId: "hasChildren", values: ["has"] },
      { questionId: "occupationStatus", values: ["self_employed"] },
      { questionId: "moneyFocus", values: ["saving_assets"] },
      { questionId: "birthOrder", values: ["youngest"] },
      { questionId: "lifeEvents", values: ["business_start", "relocation"], years: { business_start: 2009, relocation: 2015 } },
      { questionId: "toneStrength", values: ["direct"] },
    ],
    addressAs: "손주",
    expect: { dayStem: "癸", season: "겨울" },
  },
  {
    id: "p09",
    n: 9,
    label: "60대 남성 · 봄 · 극신강",
    why: "엔진 판정 극신강(가중 점수 86.7, 세 모형 모두 신강) — 목(木)이 몰린 원국. 강한 일간을 과장(대길·대성)하지 않는지 본다. 비교 모델 대상.",
    birth: { calendar: "solar", year: 1962, month: 3, day: 17, time: { hour: 22, minute: 30 }, gender: "M" },
    addressAs: "손주",
    compare: true,
    expect: { dayStem: "甲", extreme: "strong", season: "봄" },
  },
  {
    id: "p10",
    n: 10,
    label: "60대 여성 · 여름",
    why: "가장 나이 든 여성 쪽(만 62세). 은퇴·돌봄 시기 장면, 지나간 대운을 '맞히지' 않는지 본다. 일간 丁.",
    birth: { calendar: "solar", year: 1964, month: 6, day: 27, time: { hour: 14, minute: 10 }, gender: "F" },
    addressAs: "손주",
    expect: { dayStem: "丁", season: "여름" },
  },
]

/** "1", "1,3", "p01", "p01,p05" → 인물 목록. 모르는 번호는 오류 */
export function selectPersonas(only?: string): SamplePersona[] {
  if (!only) return [...PERSONAS]
  const picked: SamplePersona[] = []
  for (const raw of only.split(",").map((s) => s.trim()).filter(Boolean)) {
    const p = PERSONAS.find((x) => String(x.n) === raw || x.id === raw.toLowerCase())
    if (!p) throw new Error(`--only 값 "${raw}"에 해당하는 인물이 없음 (1~${PERSONAS.length} 또는 p01~p${String(PERSONAS.length).padStart(2, "0")})`)
    if (!picked.includes(p)) picked.push(p)
  }
  return picked
}
