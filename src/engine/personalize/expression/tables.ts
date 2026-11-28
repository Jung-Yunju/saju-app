// 발현 엔진 표(데이터) 읽기·검증·해시·금지 표현 검사. 표 원본: content/expression/dimensions.json, content/expression/mbti-bridge.json
// 표를 고쳐도 엔진 코드는 바뀌지 않는다: "어떤 차원이 어떤 판정 규칙·사실·MBTI 축을 쓰는지, 문턱값"은 표, "규칙 id → 판정 함수"는 chart-rules.ts.
// 잘못된 표(없는 규칙 id·없는 설문 값·금지 표현·허용 밖 MBTI 신호 줄·폐지된 필드 등)는 조용히 넘기지 않고 ExpressionTableError로 멈춘다.
import RAW_DIMENSIONS from "../../../../content/expression/dimensions.json"
import RAW_BRIDGE from "../../../../content/expression/mbti-bridge.json"
import { ARCHETYPE_ID_LIST, archetypeCanonicalJson } from "../../archetype"
import { getQuestion } from "../survey"
import { ALL_TEN_GODS, CLARITY_FLAGS, GROUP_CODES, LEVEL_RULE_IDS, MOD_IDS } from "./chart-rules"
import type {
  DimensionRow, DimensionTable, ExpressionStatus, FluxParams, GrainParams, GroupRuleParams, MbtiAxis, MbtiBridge, OutwardParams,
  PotentialLevel,
} from "./types"

export class ExpressionTableError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = "ExpressionTableError"
  }
}

// ─────────────────────────────────────────── 금지 표현(계약 §7-7, 연구소장 §6.3)

/**
 * 글자 그대로 막는 대표 문구(계약 예시 포함). 비교는 normalizeForbiddenText를 거친 뒤 한다(띄어쓰기·대소문자 무시).
 * 변형은 아래 EXPRESSION_FORBIDDEN_PATTERNS(연구소장 §6.3 다섯 갈래)가 막는다.
 */
export const EXPRESSION_FORBIDDEN_PHRASES: readonly string[] = Object.freeze([
  "과학적으로 입증", "과학적으로 증명", "과학적으로 검증", "검증된 상관", "입증된 상관", "증명된 상관",
  "통계적으로 입증", "통계적으로 증명", "연구에 따르면", "MBTI가 사주를 바꾼", "MBTI가 사주를 결정", "MBTI가 운을 바꾼",
  "MBTI가 바뀌면 운", "MBTI로 사주를", "사주가 MBTI를 결정", "사주로 MBTI를", "사주는 ENFP", "정확히 일치", "100% 일치",
])

/**
 * 검사용 정규화: NFKC → 영문 소문자 → 모든 공백·줄바꿈·폭 없는 문자 제거 → 서비스 이름 "운명비서"를 중립어로 바꿈
 * ("운"으로 시작하는 서비스 이름이 "운이 바뀐다" 류 패턴에 걸리지 않게). 문장부호는 남긴다(문장 경계가 사라지지 않게).
 */
export function normalizeForbiddenText(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/[\s​-‍⁠﻿]+/g, "").replace(/운명비서/g, "서비스")
}

// 패턴 조각(정규화된 글자 위에서 쓴다 — 공백 없음·영문 소문자). 뒤보기(lookbehind)는 쓰지 않는다(ES2017 대상).
const SAJU = "(?:사주|팔자|원국|명식|일간|오행|명리)"
const LUCK = "(?:운세|운명|대운|세운|운(?:이|을|은|는|도|까지|마저|의흐름))"
const CHANGE = "(?:바[꾸꿔꿉꾼꿀꿨뀌뀐뀔뀝뀜]|달[라리랐]|결정|좌우|정[해하한할]|변[하해한할함했])"
// "유의"만으로는 "유의하세요(조심)"와 갈리지 않으므로 상관·근거 쪽에서는 유의미·유의성만 본다(통계 패턴은 "유의" 전체)
const PROOF = "(?:입증|검증|증명|밝혀|유의미|유의성|확인되|확인된|확립)"
const NOT_LATIN = "(?:^|[^a-z])"
const TYPE4 = "[ei][sn][tf][jp]"
const POLE = "[eisntfjp]"

/**
 * 연구소장 §6.3 다섯 갈래 + 보강. ① 띄어쓰기·조사 무시(정규화) ② 상관·근거 + 입증·검증·증명·밝혀·유의
 * ③ 사주 근처의 16유형·단일 축 단정 ④ MBTI + 바꾸·바뀌·달라지·결정 + 사주·운 ⑤ 연구·논문·통계 + 따르면·결과.
 * id는 findForbiddenPhrases 결과에 "pattern:<id>"로 나온다.
 */
export interface ForbiddenPattern {
  id: string
  /** 연구소장 §6.3 갈래 번호(② 상관·입증 ③ 맞히기·단정 ④ 바꾼다·결정 ⑤ 인용). ①(띄어쓰기·조사)은 정규화가 맡는다 */
  group: number
  re: RegExp
  note: string
}

export const EXPRESSION_FORBIDDEN_PATTERNS: readonly ForbiddenPattern[] = Object.freeze([
  { id: "corr-proved", group: 2, re: new RegExp(`(?:상관|연관|인과)(?:관계|성)?.{0,10}${PROOF}`), note: "상관(관계)이 입증·검증되었다는 말" },
  { id: "proved-corr", group: 2, re: /(?:입증|검증|증명)(?:된|되었|됐|돼|되는|되어|한|된다).{0,6}(?:상관|연관|인과)/, note: "검증된 상관 류" },
  { id: "science", group: 2, re: /과학(?:적|적으로|적인)?.{0,6}(?:입증|검증|증명|밝혀|확인|근거|뒷받침|사실로)/, note: "과학적 입증·근거 주장" },
  { id: "statistics", group: 2, re: /통계.{0,6}(?:유의|입증|검증|증명|밝혀|확인|근거)/, note: "통계적 유의·입증 주장" },
  { id: "evidence-proved", group: 2, re: /근거.{0,6}(?:입증|검증|증명|밝혀|유의미|유의성)/, note: "근거가 입증되었다는 말" },
  { id: "english-proof", group: 2, re: /(?:scientific|statistical)(?:al)?(?:ly)?.{0,12}(?:proven|proved|validated|verified|significant|established)|correlat.{0,12}(?:proven|validated|verified|significant)/, note: "scientifically proven 류" },
  { id: "saju-mbti-related", group: 2, re: new RegExp(`${SAJU}.{0,15}mbti.{0,10}(?:상관|연관|관련|일치|인과|비례)|mbti.{0,15}${SAJU}.{0,10}(?:상관|연관|관련|일치|인과|비례)`), note: "사주와 MBTI가 상관이 있다는 말" },
  { id: "saju-guesses-type", group: 3, re: new RegExp(`${SAJU}.{0,12}${NOT_LATIN}${TYPE4}(?:[^a-z]|$)`), note: "사주로 16유형 맞히기" },
  { id: "saju-guesses-axis", group: 3, re: new RegExp(`${SAJU}.{0,10}${NOT_LATIN}${POLE}(?:형|유형|타입|성향|쪽)?(?:일것|일거|일겁|이겠|일가능성|이다|입니다|이에요|예요|일듯|이실)`), note: "사주로 한 축 맞히기(…면 I일 것)" },
  { id: "type-fixed", group: 3, re: new RegExp(`${NOT_LATIN}${TYPE4}(?:형|유형)?(?:=|은|는|이면|라면|→|↔)(?:[甲乙丙丁戊己庚辛壬癸]|[갑을병정무기경신임계](?:목|화|토|금|수))`), note: "16유형 ↔ 일간·오행 고정표" },
  { id: "mbti-infers", group: 3, re: new RegExp(`${NOT_LATIN}(?:${POLE}|${TYPE4})(?:형)?(?:이라서|라서|이니까|니까|이기때문에)`), note: "MBTI 글자로 경험·결여를 단정(E니까·I라서)" },
  { id: "mbti-changes-saju", group: 4, re: new RegExp(`mbti.{0,12}(?:${SAJU}|${LUCK}).{0,8}${CHANGE}`), note: "MBTI가 사주·운을 바꾼다·결정한다" },
  { id: "saju-changes-mbti", group: 4, re: new RegExp(`(?:${SAJU}|${LUCK}).{0,10}mbti.{0,10}${CHANGE}`), note: "사주·운이 MBTI를 결정한다" },
  { id: "research-cites", group: 5, re: /(?:연구|논문|통계|조사|실험|학계|데이터)(?:결과|자료)?(?:에|상|로)?(?:따르면|의하면)|(?:연구|논문|실험|조사)결과|(?:research|stud(?:y|ies))(?:shows?|showed|found|finds|suggests?|proves?)/, note: "근거 문헌 없는 인용(연구·논문·통계에 따르면)" },
])

const NORMALIZED_PHRASES = EXPRESSION_FORBIDDEN_PHRASES.map(normalizeForbiddenText)

/** 문자열 하나의 금지 표현 적중(대표 문구 원문 또는 "pattern:<id>") */
export function forbiddenHitsOf(text: string): string[] {
  const n = normalizeForbiddenText(text)
  const hits: string[] = []
  EXPRESSION_FORBIDDEN_PHRASES.forEach((p, i) => {
    if (n.includes(NORMALIZED_PHRASES[i])) hits.push(p)
  })
  for (const p of EXPRESSION_FORBIDDEN_PATTERNS) if (p.re.test(n)) hits.push(`pattern:${p.id}`)
  return hits
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x)

/** 표·보고서 안의 모든 문자열(키 포함)에서 금지 표현을 찾는다. 문안 검증기도 이 함수를 그대로 쓸 수 있다 */
export function findForbiddenPhrases(x: unknown): string[] {
  const hits: string[] = []
  const visit = (v: unknown): void => {
    if (typeof v === "string") {
      for (const h of forbiddenHitsOf(v)) if (!hits.includes(h)) hits.push(h)
    } else if (Array.isArray(v)) v.forEach(visit)
    else if (isObj(v)) for (const [k, val] of Object.entries(v)) {
      visit(k)
      visit(val)
    }
  }
  visit(x)
  return hits
}

// ─────────────────────────────────────────── MBTI 축·신호 줄

export const MBTI_AXES: readonly MbtiAxis[] = ["EI", "SN", "TF", "JP"]
export const MBTI_POLES: Readonly<Record<MbtiAxis, readonly [string, string]>> = {
  EI: ["E", "I"], SN: ["S", "N"], TF: ["T", "F"], JP: ["J", "P"],
}
/**
 * 계약 §6(2026-11-28 개정)·연구소장 §6.2: MBTI 신호 줄은 이 세 줄뿐("축|극|차원|방향"). 확신일 때만, low 없음.
 * 나머지 축·극(I·S·N·T·F)과 확신 없는 답은 문체 힌트로만 쓴다.
 */
export const MBTI_SIGNAL_LINKS: readonly string[] = Object.freeze(["EI|E|outward|high", "JP|J|grain|steady", "JP|P|grain|edge"])
/** 신호 줄이 있을 수 있는 축(위 목록에서 나옴). T/F·S/N은 신호 없음 */
export const MBTI_SIGNAL_AXES: readonly MbtiAxis[] = Object.freeze(["EI", "JP"] as MbtiAxis[])

const STATUSES: readonly ExpressionStatus[] = ["expressed", "developed", "dormant", "quiet", "unknown"]
const LEVELS: readonly PotentialLevel[] = ["strong", "moderate", "faint"]
const TABLE_STATUS = ["designed", "provisional", "reviewed", "approved"] as const
const KINDS = ["core", "grain", "aux"] as const
/** 0.2.0에서 폐지된 self 필드 — 표에 남아 있으면 "작동하는 척"하는 설정이 되므로 멈춘다 */
const RETIRED_SELF_KEYS = ["unsureFactor", "mbtiOnlyFactor"] as const

function fail(where: string, msg: string): never {
  throw new ExpressionTableError(`${where}: ${msg}`)
}

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x)
const isStr = (x: unknown): x is string => typeof x === "string" && x.length > 0
const isShare = (x: unknown): boolean => isNum(x) && x > 0 && x < 1
const isTenGodList = (x: unknown): x is string[] =>
  Array.isArray(x) && x.length > 0 && x.every((t) => (ALL_TEN_GODS as readonly string[]).includes(t)) && new Set(x).size === x.length

function checkStatusRecord(where: string, r: unknown): void {
  if (!isObj(r)) fail(where, "객체여야 함")
  for (const s of STATUSES) if (!isNum(r[s])) fail(where, `${s} 숫자 필요`)
}

function checkParams(w: string, d: DimensionRow): void {
  const p = d.params as unknown as Record<string, unknown>
  if (!isObj(p)) fail(w, "params 객체 필요")
  if (d.rule === "exp.lv.group.v1") {
    const q = p as unknown as GroupRuleParams
    if (!(GROUP_CODES as readonly string[]).includes(q.group)) fail(w, `group 오류 ${q.group}(rules 철자 bigyeop·siksang·jaeseong·gwansal·inseong)`)
    for (const k of ["hiddenOnlyModerate", "stemOnlyModerate", "rootedStrong", "rootedStrongWithMonth"] as const) if (!isShare(q[k])) fail(w, `${k}는 0~1 사이 비율`)
    if (!(q.rootedStrong >= q.rootedStrongWithMonth)) fail(w, "rootedStrong ≥ rootedStrongWithMonth 이어야 함")
    if (typeof q.hiddenMonthCanBeStrong !== "boolean") fail(w, "hiddenMonthCanBeStrong 참/거짓 필요")
  } else if (d.rule === "exp.lv.grain.v1") {
    const q = p as unknown as GrainParams
    if (!isTenGodList(q.steady) || !isTenGodList(q.edge)) fail(w, "steady·edge는 겹치지 않는 십성 이름 목록")
    if (q.steady.some((t) => q.edge.includes(t))) fail(w, "steady와 edge에 같은 십성이 있음")
    if (!isShare(q.thinShare)) fail(w, "thinShare는 0~1 사이 비율")
    if (!isNum(q.balancedGap) || q.balancedGap < 0 || !isNum(q.strongGap) || !(q.strongGap > q.balancedGap) || q.strongGap >= 0.5)
      fail(w, "0 ≤ balancedGap < strongGap < 0.5")
    if (!Array.isArray(q.clarityFlags) || !q.clarityFlags.every((f) => CLARITY_FLAGS.includes(f))) fail(w, "clarityFlags는 규칙 엔진 청탁 표지 이름")
  } else if (d.rule === "exp.lv.flux.v1") {
    const q = p as unknown as FluxParams
    if (!Array.isArray(q.keyPillars) || q.keyPillars.length === 0 || !q.keyPillars.every((k) => k === "month" || k === "day")) fail(w, "keyPillars는 month|day")
    if (!Number.isInteger(q.strongMinMoving) || q.strongMinMoving < 1) fail(w, "strongMinMoving은 1 이상 정수")
  } else if (d.rule === "exp.lv.outward.v1") {
    const q = p as unknown as OutwardParams
    for (const k of ["strongYang", "warmStrongYang", "faintYang", "coldFaintYang"] as const) if (!isShare(q[k])) fail(w, `${k}는 0~1 사이 비율`)
    if (!(q.strongYang >= q.warmStrongYang && q.warmStrongYang > q.coldFaintYang && q.coldFaintYang >= q.faintYang)) fail(w, "strongYang ≥ warmStrongYang > coldFaintYang ≥ faintYang")
  }
}

/** 차원 표 검증 */
export function validateDimensionTable(raw: unknown): DimensionTable {
  if (!isObj(raw)) fail("dimensions", "객체가 아님")
  const t = raw as unknown as DimensionTable
  for (const k of ["id", "version", "source", "note", "basedOn"] as const) if (!isStr(t[k])) fail("dimensions", `${k} 필요`)
  if (!/^\d+\.\d+\.\d+$/.test(t.version)) fail("dimensions", "version은 x.y.z")
  if (!(TABLE_STATUS as readonly string[]).includes(t.status)) fail("dimensions", "status는 designed|provisional|reviewed|approved")
  if (t.claim !== "service-model") fail("dimensions", 'claim은 "service-model"이어야 함')
  if (!["L0", "L1", "L2"].includes(t.evidenceLevel)) fail("dimensions", "evidenceLevel은 L0|L1|L2")
  if (t.hiddenStemTable !== "kr-monthly-30") fail("dimensions", "hiddenStemTable은 kr-monthly-30 고정(연구소장 §0)")
  if (!isObj(t.levels) || !Array.isArray(t.levels.present) || t.levels.present.length === 0 || !t.levels.present.every((l) => LEVELS.includes(l)))
    fail("dimensions.levels", "present는 strong|moderate 중 하나 이상")
  if (t.levels.present.includes("faint")) fail("dimensions.levels", "faint는 present가 될 수 없음")
  if (!isObj(t.sensitivity) || !Number.isInteger(t.sensitivity.hourStableMin) || t.sensitivity.hourStableMin < 0 || t.sensitivity.hourStableMin > 12)
    fail("dimensions.sensitivity", "hourStableMin은 0~12 정수")
  if (t.sensitivity.compareTable !== "cn-lunarjs" && t.sensitivity.compareTable !== "main-only") fail("dimensions.sensitivity", "compareTable은 cn-lunarjs|main-only")
  if (!isObj(t.self)) fail("dimensions.self", "객체 필요")
  for (const k of RETIRED_SELF_KEYS)
    if (k in (t.self as unknown as Record<string, unknown>)) fail("dimensions.self", `${k}는 0.2.0에서 폐지됨(MBTI만·확신 없음 처리는 코드의 명시 규칙) — 표에서 지울 것`)
  for (const k of ["highAt", "lowAt"] as const) if (!isNum(t.self[k]) || t.self[k] <= 0) fail("dimensions.self", `${k}는 0보다 큰 숫자`)
  // 상황 사실만으로 developed 금지(계약 §6, 연구소장 권고 채택) — 표 한 줄로 풀리지 않게 ["trait"] 고정
  if (!Array.isArray(t.self.developedEvidence) || t.self.developedEvidence.length !== 1 || t.self.developedEvidence[0] !== "trait")
    fail("dimensions.self", 'developedEvidence는 ["trait"] 고정(상황 사실만으로 developed 금지)')
  const sit = t.self.situation
  if (!isObj(sit) || sit.from !== "lived-link" || !Array.isArray(sit.questions) || sit.direction !== "high" || !isNum(sit.weight) || sit.weight <= 0)
    fail("dimensions.self.situation", "from lived-link, questions 배열, direction high, weight > 0")
  for (const q of sit.questions) if (!getQuestion(q)) fail("dimensions.self.situation", `없는 설문 문항 ${q}`)
  if (sit.questions.includes("mbti")) fail("dimensions.self.situation", "mbti는 상황 사실이 아님")

  if (!Array.isArray(t.dimensions) || t.dimensions.length === 0) fail("dimensions", "dimensions 배열 필요")
  const ids = new Set<string>()
  const groupsSeen = new Set<string>()
  t.dimensions.forEach((d, i) => {
    const w = `dimensions[${i}](${d?.id})`
    if (!isObj(d)) fail(w, "객체 필요")
    if (!isStr(d.id) || !/^[a-z][a-zA-Z]*$/.test(d.id)) fail(w, "id는 영문 소문자로 시작")
    if (ids.has(d.id)) fail(w, "id 중복")
    ids.add(d.id)
    if (!isStr(d.label)) fail(w, "label 필요")
    if (!(KINDS as readonly string[]).includes(d.kind)) fail(w, "kind는 core|grain|aux")
    if (!(LEVEL_RULE_IDS as readonly string[]).includes(d.rule)) fail(w, `없는 판정 규칙 id "${d.rule}"`)
    const isGrain = d.rule === "exp.lv.grain.v1"
    if (isGrain !== (d.kind === "grain")) fail(w, "kind grain ⇔ rule exp.lv.grain.v1")
    checkParams(w, d)
    if (d.rule === "exp.lv.group.v1") {
      const g = (d.params as GroupRuleParams).group
      if (groupsSeen.has(g)) fail(w, `묶음 ${g}가 두 차원에 있음`)
      groupsSeen.add(g)
    }
    if (!Array.isArray(d.mods) || !d.mods.every((m) => MOD_IDS.includes(m))) fail(w, "mods에 없는 보정 규칙")
    if (d.mods.includes("exp.mod.drive.v1") && d.rule !== "exp.lv.group.v1") fail(w, "drive 보정은 묶음 규칙 차원에만")
    if (!Array.isArray(d.notes) || !d.notes.every((n) => n === "load" || n === "surplus")) fail(w, "notes는 load|surplus")
    if (d.notes.length && d.rule !== "exp.lv.group.v1") fail(w, "load·surplus 메모는 묶음 규칙 차원에만")
    if (!Array.isArray(d.facts)) fail(w, "facts 배열 필요(비어도 됨)")
    const keys = new Set<string>()
    d.facts.forEach((f, j) => {
      const fw = `${w}.facts[${j}]`
      if (!isObj(f) || !isStr(f.key)) fail(fw, "key 필요")
      if (/^mbti:/i.test(f.key)) fail(fw, "MBTI는 사실 연결이 아니라 mbti-bridge.json으로만 잇는다")
      const m = /^([A-Za-z]+):([a-z_]+)$/.exec(f.key)
      if (!m) fail(fw, `key 형식은 "questionId:value" — ${f.key}`)
      if (sit.questions.includes(m[1])) fail(fw, `${m[1]}는 상황 사실 — lived-link에서 읽으므로 facts에 두지 않음`)
      const q = getQuestion(m[1])
      if (!q) fail(fw, `없는 설문 문항 ${m[1]}`)
      if (!q.options.some((o) => o.value === m[2])) fail(fw, `문항 ${m[1]}에 없는 선택지 ${m[2]}`)
      if (keys.has(f.key)) fail(fw, "key 중복")
      keys.add(f.key)
      if (isGrain ? f.direction !== "steady" && f.direction !== "edge" : f.direction !== "high" && f.direction !== "low")
        fail(fw, isGrain ? "grain 사실 direction은 steady|edge" : "direction은 high|low")
      if (!isNum(f.weight) || f.weight <= 0) fail(fw, "weight는 0보다 큰 숫자")
      if (f.evidence !== "trait") fail(fw, "facts의 evidence는 trait(기질 답)")
    })
  })
  for (const g of GROUP_CODES) if (!groupsSeen.has(g)) fail("dimensions", `묶음 ${g}를 쓰는 핵심 차원이 없음`)

  if (!isObj(t.luck) || !isObj(t.luck.groupMap) || !isObj(t.luck.flux)) fail("dimensions.luck", "groupMap·flux 필요")
  for (const g of GROUP_CODES) {
    const r = t.luck.groupMap[g]
    if (!isObj(r) || !ids.has(r.activate) || !ids.has(r.feed) || !ids.has(r.press)) fail("dimensions.luck.groupMap", `${g}: activate·feed·press 차원 id 필요`)
  }
  if (!ids.has(t.luck.flux.dimensionId) || !Array.isArray(t.luck.flux.types) || !Array.isArray(t.luck.flux.natalPillars)) fail("dimensions.luck.flux", "dimensionId·types·natalPillars 필요")

  if (!isObj(t.strategies) || !isObj(t.strategies.matrix) || !isObj(t.strategies.tone) || !isObj(t.strategies.catalog) || !isObj(t.strategies.overrides))
    fail("dimensions.strategies", "matrix·overrides·tone·catalog 필요")
  const stOk = (x: unknown): boolean => isStr(x) && /^exp\.st\.[a-z]+$/.test(x) && isStr(t.strategies.catalog[x])
  for (const s of STATUSES) {
    const row = t.strategies.matrix[s]
    if (!isObj(row) || !stOk(row.activate) || !stOk(row.press)) fail("dimensions.strategies", `matrix.${s}.activate·press는 catalog에 있는 exp.st.* id`)
  }
  for (const [dim, byMode] of Object.entries(t.strategies.overrides)) {
    if (!ids.has(dim) || !isObj(byMode)) fail("dimensions.strategies.overrides", `없는 차원 id ${dim}`)
    for (const [mode, byStatus] of Object.entries(byMode)) {
      if (mode !== "activate" && mode !== "press") fail("dimensions.strategies.overrides", `${dim}: 방식은 activate|press`)
      if (!isObj(byStatus)) fail("dimensions.strategies.overrides", `${dim}.${mode}: 객체 필요`)
      for (const [st, id] of Object.entries(byStatus))
        if (!(STATUSES as readonly string[]).includes(st) || !stOk(id)) fail("dimensions.strategies.overrides", `${dim}.${mode}.${st}: 상태 이름·catalog의 exp.st.* id 필요`)
    }
  }
  if (!stOk(t.strategies.tone.support) || !stOk(t.strategies.tone.load)) fail("dimensions.strategies", "tone.support·load는 catalog에 있는 exp.st.* id")

  if (!isObj(t.gaeunPriority)) fail("dimensions.gaeunPriority", "객체 필요")
  checkStatusRecord("dimensions.gaeunPriority.fill", t.gaeunPriority.fill)
  checkStatusRecord("dimensions.gaeunPriority.ease", t.gaeunPriority.ease)
  if (!isNum(t.gaeunPriority.other) || !isNum(t.gaeunPriority.changeWishBoost)) fail("dimensions.gaeunPriority", "other·changeWishBoost 숫자 필요")

  if (!isObj(t.changeWish)) fail("dimensions.changeWish", "객체 필요")
  const cw = getQuestion("changeWish")
  for (const [k, dims] of Object.entries(t.changeWish)) {
    if (!cw?.options.some((o) => o.value === k)) fail("dimensions.changeWish", `changeWish 문항에 없는 값 ${k}`)
    if (!Array.isArray(dims) || !dims.every((x) => ids.has(x))) fail("dimensions.changeWish", `${k}: 없는 차원 id`)
  }
  if (!isObj(t.archetypeLinks)) fail("dimensions.archetypeLinks", "객체 필요")
  for (const a of ARCHETYPE_ID_LIST) if (!Array.isArray(t.archetypeLinks[a])) fail("dimensions.archetypeLinks", `원형 ${a} 항목 필요(비어도 됨)`)
  for (const [k, dims] of Object.entries(t.archetypeLinks)) {
    if (!(ARCHETYPE_ID_LIST as readonly string[]).includes(k)) fail("dimensions.archetypeLinks", `없는 원형 id ${k}`)
    if (!dims.every((x) => ids.has(x))) fail("dimensions.archetypeLinks", `${k}: 없는 차원 id`)
  }

  const bad = findForbiddenPhrases(raw)
  if (bad.length) fail("dimensions", `금지 표현 ${bad.join(", ")}`)
  return t
}

/**
 * MBTI 대응표 검증. claim "service-model"(표 전체·행마다) 필수.
 * 신호 줄은 MBTI_SIGNAL_LINKS 세 줄만(T/F·S/N 신호 금지, low 금지, sureOnly true 고정), 문체 힌트는 축·극당 하나.
 */
export function validateMbtiBridge(raw: unknown, dims: DimensionTable): MbtiBridge {
  if (!isObj(raw)) fail("mbtiBridge", "객체가 아님")
  const b = raw as unknown as MbtiBridge
  for (const k of ["id", "version", "note"] as const) if (!isStr(b[k])) fail("mbtiBridge", `${k} 필요`)
  if (!/^\d+\.\d+\.\d+$/.test(b.version)) fail("mbtiBridge", "version은 x.y.z")
  if (!(TABLE_STATUS as readonly string[]).includes(b.status)) fail("mbtiBridge", "status는 designed|provisional|reviewed|approved")
  if (b.claim !== "service-model") fail("mbtiBridge", 'claim은 "service-model"이어야 함(가설 표 표시 필수)')
  if (!Array.isArray(b.axes) || b.axes.length !== 4) fail("mbtiBridge", "axes는 4개")
  MBTI_AXES.forEach((ax, i) => {
    const a = b.axes[i]
    if (!isObj(a) || a.axis !== ax || !Array.isArray(a.poles) || a.poles.join("") !== MBTI_POLES[ax].join(""))
      fail(`mbtiBridge.axes[${i}]`, `${ax} 축과 극 ${MBTI_POLES[ax].join("/")} 순서여야 함`)
  })
  const dimIds = new Set(dims.dimensions.map((d) => d.id))
  if (!Array.isArray(b.links)) fail("mbtiBridge", "links 배열 필요")
  const seen = new Set<string>()
  b.links.forEach((l, i) => {
    const w = `mbtiBridge.links[${i}]`
    if (!isObj(l) || !dimIds.has(l.dimensionId)) fail(w, `없는 차원 id ${(l as { dimensionId?: unknown })?.dimensionId}`)
    if (l.claim !== "service-model") fail(w, 'claim "service-model" 필요(행마다)')
    if (!MBTI_AXES.includes(l.axis)) fail(w, `없는 축 ${l.axis}`)
    if (!MBTI_SIGNAL_AXES.includes(l.axis)) fail(w, `${l.axis} 축은 차원 신호로 쓰지 않음(조언 문체 힌트만)`)
    if (!MBTI_POLES[l.axis].includes(l.pole)) fail(w, `${l.axis} 축에 없는 극 ${l.pole}`)
    if ((l.direction as string) === "low") fail(w, "MBTI는 low 신호를 만들지 않음(연구소장 §6.2 규칙 1)")
    if (l.sureOnly !== true) fail(w, "sureOnly는 true 고정(확신 없는 답은 문체 힌트만)")
    const k = `${l.axis}|${l.pole}|${l.dimensionId}|${l.direction}`
    if (!MBTI_SIGNAL_LINKS.includes(k)) fail(w, `허용된 신호 줄이 아님 ${k} — E→outward high, J→grain steady, P→grain edge만`)
    if (!["A", "A-", "B", "B-"].includes(l.grade)) fail(w, "grade는 A|A-|B|B-")
    if (!isNum(l.weight) || l.weight <= 0) fail(w, "weight는 0보다 큰 숫자")
    if (seen.has(k)) fail(w, "같은 신호 줄 중복")
    seen.add(k)
  })
  if (!Array.isArray(b.styleHints)) fail("mbtiBridge", "styleHints 배열 필요(비어도 됨)")
  const hintSeen = new Set<string>()
  b.styleHints.forEach((h, i) => {
    if (!isObj(h) || !MBTI_AXES.includes(h.axis) || !MBTI_POLES[h.axis]?.includes(h.pole) || !isStr(h.hint) || !/^style\.[a-zA-Z]+$/.test(h.hint))
      fail(`mbtiBridge.styleHints[${i}]`, "axis·pole·hint(style.*) 필요")
    if (hintSeen.has(`${h.axis}|${h.pole}`)) fail(`mbtiBridge.styleHints[${i}]`, "같은 축·극 힌트 중복")
    hintSeen.add(`${h.axis}|${h.pole}`)
  })
  const bad = findForbiddenPhrases(raw)
  if (bad.length) fail("mbtiBridge", `금지 표현 ${bad.join(", ")}`)
  return b
}

// ─────────────────────────────────────────── 해시(엔진 안에서 node:crypto를 쓰지 않는다)

function fnv1a32(s: string, seed: number): string {
  let h = seed >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, "0")
}

/** 표 해시: 키 정렬 JSON에 FNV-1a 32비트를 두 시드로 적용(16자리). 보안용이 아니라 "어느 표로 판정했나" 식별용 */
export function expressionTablesHash(dims: unknown, bridge: unknown): string {
  const s = archetypeCanonicalJson({ dimensions: dims, mbtiBridge: bridge })
  return `fnv1a:${fnv1a32(s, 0x811c9dc5)}${fnv1a32(s, 0x01234567)}`
}

// ─────────────────────────────────────────── 동봉 표

export interface ExpressionTables {
  dims: DimensionTable
  bridge: MbtiBridge
  hash: string
}

let cachedTables: ExpressionTables | null = null

/** 동봉 표(검증 1회 후 고정). 반환값을 고치지 말 것 */
export function expressionTables(): ExpressionTables {
  if (!cachedTables) cachedTables = makeExpressionTables(RAW_DIMENSIONS as unknown, RAW_BRIDGE as unknown)
  return cachedTables
}

/** 시험·연구용: 다른 표로 엔진을 돌릴 때(검증 포함) */
export function makeExpressionTables(rawDims: unknown, rawBridge: unknown): ExpressionTables {
  const dims = validateDimensionTable(rawDims)
  const bridge = validateMbtiBridge(rawBridge, dims)
  return { dims, bridge, hash: expressionTablesHash(rawDims, rawBridge) }
}
