// 사실표 → 장별 사용자 메시지 조각 (P4-03) — 담당: 콘텐츠 작가
// 원칙
//  1. 사실표(FactSheet)의 값을 "옮겨 적기"만 한다. 십성·합충·공망·신강약을 새로 계산하지 않는다.
//     - 한자 → 한글 읽기, 위치 코드 → 우리말 이름, 오행 코드 → 일상말은 표기 변환이다(판정 아님).
//     - 대운 끝 나이·끝 해는 "다음 대운 시작 − 1"(없으면 시작 + 9)로 적는다(life-stages.md §1의 구간 정의).
//     - 운 글자의 십성은 사실표 luck.glyphs(facts@0.3.0, 규칙 엔진이 그 운 슬롯을 직접 판정한 값)를 옮긴다(prompts@0.3.0).
//       glyphs에 그 슬롯이 없을 때만(지난·다음 대운, 내년, 0.3.0 이전 사실표) 예전처럼 tenGods에서 "같은 글자"를 찾아 옮긴다.
//       그래도 없으면 "사실표에 없음"으로 적고 AI가 이름을 붙이지 못하게 한다.
//  5. 개운(D-023 ②, prompts@0.3.0): 범주는 코드(gaeun.ts)가 고른 chart.gaeun만 싣는다(secGaeun). 장마다 싣는 범주는 GAEUN_SCOPES(gaeun.md §3.4).
//     참고 등급(색·방향·숫자·맛)은 대표 결정 전이라 싣지 않는다. 묶음 개수는 gaeunBasis.groupCounts 값만 옮긴다(감수 P1·P2).
//  2. 필요한 조각만 골라 넣는다(입력 토큰 절약). JSON.stringify(facts)를 통째로 넣지 않는다.
//  3. 개인정보 최소화: 성별(subject.gender)·기준 시각(asOf)·엔진 버전은 AI에 넘기지 않는다.
//     성별은 대운 방향 계산에 이미 쓰였고, 풀이에서 성별로 해석을 바꾸지 않기 때문이다(voice-guide §9 성별 고정관념).
//     사실표 밖에 실수로 붙은 칸(이름·생년월일 등)이 있어도 여기서는 정해진 칸만 읽으므로 새지 않는다.
//  4. 쉬운 말(D-023 ③, prompts@0.2.0): 글자·십성·관계 줄 끝에 "| 쉬운 말: …"로 그림 말 사전(plain-words.ts = voice-guide §6-1)을 붙인다.
//     기존 줄의 앞부분("申(신) = 정관", "乙酉(을유)")은 그대로 두고 뒤에만 덧붙인다(검증기·테스트가 그 꼴을 읽는다).
import { GAEUN_CATALOG, GAEUN_FORBIDDEN_WORDS } from "../gaeun"
import type { FactSheet, GaeunGroup, GaeunPick, LuckGlyphFacts } from "../types"
import {
  EASE_SIDE, GE_PICTURE, GI_PICTURE, GJ_PICTURE, GROUP_KO, GT_PICTURE, HALF_KO, LUCK_SIDE, VERDICT_KO, VIEW_HEAD,
  familyPlain, groupPicture, plainPractice,
} from "./gaeun-words"
import { pictureOfChar, pictureOfGanzhi, pictureOfRelation, pictureOfTenGod } from "./plain-words"

type TenGodRow = FactSheet["chart"]["tenGods"][number]
type InteractionRow = FactSheet["chart"]["interactions"][number]
type DaeunRow = FactSheet["luck"]["daeun"][number]
type UserFactRow = FactSheet["personal"]["userFacts"][number]

/**
 * 계약(types.ts)에 아직 없는 선택 칸 — 백엔드가 채우면 읽고, 없으면 무시한다(계약 변경 제안 참고).
 *  - style.voice: 목소리 선택(기존 기능 voice:"담백")
 *  - luck.nextYear: 내년 세운 간지(계산 엔진 값)
 */
export type FactSheetWithExtras = FactSheet & {
  style?: { voice?: string }
  luck: FactSheet["luck"] & { nextYear?: { year: number; ganzhi: string } }
}

// ─────────────────────────────── 표기 변환(판정 아님)

const STEM_KO: Record<string, string> = { 甲: "갑", 乙: "을", 丙: "병", 丁: "정", 戊: "무", 己: "기", 庚: "경", 辛: "신", 壬: "임", 癸: "계" }
const BRANCH_KO: Record<string, string> = { 子: "자", 丑: "축", 寅: "인", 卯: "묘", 辰: "진", 巳: "사", 午: "오", 未: "미", 申: "신", 酉: "유", 戌: "술", 亥: "해" }

/** 한자 간지 → 한글 읽기. 간지가 아닌 글자는 그대로 둔다 */
export function hangulOf(hanja: string): string {
  return [...hanja].map((c) => STEM_KO[c] ?? BRANCH_KO[c] ?? c).join("")
}

/** "庚" → "庚(경)", "乙酉" → "乙酉(을유)" */
export function withReading(hanja: string): string {
  const ko = hangulOf(hanja)
  return ko === hanja ? hanja : `${hanja}(${ko})`
}

const ELEMENT_LABEL: Record<string, string> = {
  wood: "나무(목)", fire: "불(화)", earth: "흙(토)", metal: "쇠(금)", water: "물(수)",
  木: "나무(목)", 火: "불(화)", 土: "흙(토)", 金: "쇠(금)", 水: "물(수)",
  목: "나무(목)", 화: "불(화)", 토: "흙(토)", 금: "쇠(금)", 수: "물(수)",
}

export function elementLabel(key: string): string {
  return ELEMENT_LABEL[key] ?? key
}

/** 줄 끝에 붙이는 쉬운 말 꼬리. 붙일 것이 없으면 빈 문자열 */
function plainTail(parts: (string | null | undefined)[]): string {
  const ps = parts.filter((p): p is string => !!p)
  return ps.length ? ` | 쉬운 말: ${ps.join(" · ")}` : ""
}

/** 한 글자 + 그 글자의 십성 쉬운 말: "酉 한가을 잘 벼린 쇠, 거두는 가위 · 편관 = 나를 세게 다그쳐 단련하는 힘" */
function charTenGodPlain(char: string, tenGod: string | null): string {
  const pc = pictureOfChar(char, false)
  const pt = tenGod ? pictureOfTenGod(tenGod) : null
  return plainTail([pc ? `${char} ${pc}` : null, pt ? `${tenGod} = ${pt}` : null])
}

const PILLAR_KO: Record<string, string> = { year: "연", month: "월", day: "일", hour: "시" }
const PART_KO: Record<string, string> = { stem: "간", branch: "지" }

/** 위치 코드 → 우리말 이름. 예: "month.stem" → "월간", "day.branch.jeonggi" → "일지 속 지장간(jeonggi)" */
export function posLabel(pos: string): string {
  const natal = /^(year|month|day|hour)\.(stem|branch)(?:[.:[](.+?)\]?)?$/.exec(pos)
  if (natal) {
    const base = PILLAR_KO[natal[1]] + PART_KO[natal[2]]
    return natal[3] ? `${base} 속 지장간(${natal[3]})` : base
  }
  const part = /stem/.test(pos) ? " 천간" : /branch/.test(pos) ? " 지지" : ""
  if (/^daeun/.test(pos)) return `대운${part}`
  if (/^seun/.test(pos)) return `올해 세운${part}`
  return pos
}

export function isNatalPos(pos: string): boolean {
  return /^(year|month|day|hour)\b/.test(pos)
}

export function isLuckPos(pos: string): boolean {
  return /^(daeun|seun)/.test(pos)
}

export function isHiddenPos(pos: string): boolean {
  return isNatalPos(pos) && /^(year|month|day|hour)\.(stem|branch)[.:[]/.test(pos)
}

// ─────────────────────────────── 조회

/** 사실표 tenGods에서 같은 글자를 찾아 십성 이름을 옮긴다(새 판정 아님). 운 위치 항목을 먼저 본다 */
export function tenGodOfChar(facts: FactSheet, char: string): string | null {
  const rows = facts.chart.tenGods.filter((t) => t.char === char)
  if (rows.length === 0) return null
  const luck = rows.find((t) => isLuckPos(t.pos))
  const plain = rows.find((t) => !isHiddenPos(t.pos))
  return (luck ?? plain ?? rows[0]).tenGod
}

export function currentDaeun(facts: FactSheet): DaeunRow | null {
  return facts.luck.daeun.find((d) => d.current) ?? null
}

/** 지금 대운 다음 대운. 대운이 아직 시작 전이면 첫 대운 */
export function nextDaeun(facts: FactSheet): DaeunRow | null {
  const sorted = [...facts.luck.daeun].sort((a, b) => a.index - b.index)
  const cur = sorted.find((d) => d.current)
  if (cur) return sorted.find((d) => d.index > cur.index) ?? null
  return sorted.find((d) => d.startAge > facts.subject.ageYears) ?? null
}

/** 대운 끝 나이·끝 해: 다음 대운 시작 − 1, 없으면 시작 + 9 */
export function daeunEnd(facts: FactSheet, d: DaeunRow): { endAge: number; endYear: number } {
  const after = facts.luck.daeun.filter((x) => x.index > d.index).sort((a, b) => a.index - b.index)[0]
  return after ? { endAge: after.startAge - 1, endYear: after.startYear - 1 } : { endAge: d.startAge + 9, endYear: d.startYear + 9 }
}

export function dayBranch(facts: FactSheet): string {
  return [...facts.chart.pillars.day][1] ?? ""
}

export function nextYearOf(facts: FactSheet): { year: number; ganzhi: string } | null {
  const ny = (facts as FactSheetWithExtras).luck.nextYear
  return ny && typeof ny.year === "number" && typeof ny.ganzhi === "string" && ny.ganzhi.length === 2 ? ny : null
}

// ─────────────────────────────── 조각(섹션) — 모두 "[제목]\n내용" 꼴

function section(title: string, lines: string[]): string {
  return `[${title}]\n${lines.length ? lines.join("\n") : "(없음)"}`
}

export function secSubject(facts: FactSheet): string {
  const s = facts.subject
  const lines = [
    `호칭: ${s.addressAs && s.addressAs.trim() ? s.addressAs.trim() : "(없음 — 부르지 않는다)"}`,
    `만 나이: ${s.ageYears}`,
    `인생 단계: ${s.lifeStage}`,
    `태어난 시: ${s.hourKnown ? "앎" : "모름 — 시주를 쓰지 않는다"}`,
    `올해: ${facts.luck.thisYear.year}년`,
  ]
  if (s.ageYears < 19) lines.push("주의: 만 19세 미만 — 어린 날의 경향이라고 밝히고 단정과 세기를 낮춘다")
  return section("읽는 사람", lines)
}

export function secPillars(facts: FactSheet): string {
  const p = facts.chart.pillars
  const dm = facts.chart.dayMaster
  const pics: [string, string | null][] = [["연주", p.year], ["월주", p.month], ["일주", p.day], ["시주", p.hour]]
  return section("여덟 글자(원국)", [
    `연주 ${withReading(p.year)} / 월주 ${withReading(p.month)} / 일주 ${withReading(p.day)} / 시주 ${p.hour ? withReading(p.hour) : "모름"}`,
    `일간(너 자신을 뜻하는 글자): ${withReading(dm.stem)} · ${elementLabel(dm.element)} · ${dm.yinYang === "yang" ? "양" : "음"}`,
    `일지(네가 앉은 자리, 가장 가까운 사람의 자리): ${withReading(dayBranch(facts))}`,
    "그림 말(고객 문장에는 이 말을 먼저 쓰고 간지는 뒤 괄호로):",
    ...pics.filter((x): x is [string, string] => !!x[1]).map(([k, g]) => `- ${k} ${g}: ${pictureOfGanzhi(g) ?? "(그림 말 없음)"}`),
  ])
}

/** 일주만(무료 생김새 장) */
export function secDayPillar(facts: FactSheet): string {
  const dm = facts.chart.dayMaster
  const day = facts.chart.pillars.day
  return section("일주", [
    `일주 ${withReading(day)} — 일간 ${withReading(dm.stem)}(${elementLabel(dm.element)}, ${dm.yinYang === "yang" ? "양" : "음"}), 일지 ${withReading(dayBranch(facts))}`,
    `그림 말(고객 문장에는 이 말을 먼저): ${pictureOfGanzhi(day) ?? "(그림 말 없음)"}`,
  ])
}

function tenGodLine(t: TenGodRow): string {
  return `- ${posLabel(t.pos)} ${withReading(t.char)} = ${t.tenGod} [${t.pos}]${charTenGodPlain(t.char, t.tenGod)}`
}

/** 원국 십성(규칙 엔진 판정). includeHidden=false면 지장간 항목을 빼고, onlyPos가 있으면 그 위치만 */
export function secNatalTenGods(facts: FactSheet, opts: { includeHidden?: boolean; onlyPos?: RegExp } = {}): string {
  const includeHidden = opts.includeHidden ?? true
  const rows = facts.chart.tenGods.filter(
    (t) => isNatalPos(t.pos) && (includeHidden || !isHiddenPos(t.pos)) && (!opts.onlyPos || opts.onlyPos.test(t.pos)),
  )
  return section("원국 십성(규칙 엔진 판정, 일간 기준 — 여기 없는 글자에 십성 이름을 붙이지 않는다)", rows.map(tenGodLine))
}

/** luck.glyphs(facts@0.3.0)에서 운 슬롯 하나를 찾는다. 간지가 다르면 쓰지 않는다(다른 운의 값을 옮기지 않게) */
export function glyphSlotOf(facts: FactSheet, ref: { slot: "daeun"; daeunIndex: number } | { slot: "seun"; year: number }, ganzhi: string): LuckGlyphFacts | null {
  const found = (facts.luck.glyphs ?? []).find((g) =>
    g.slot === ref.slot && (ref.slot === "daeun" ? g.daeunIndex === ref.daeunIndex : g.year === ref.year),
  )
  return found && found.ganzhi === ganzhi ? found : null
}

/**
 * 운 글자(대운·세운 간지)의 십성. glyphs 슬롯이 있으면 그 값(규칙 엔진 판정)을 옮기고,
 * 없으면 사실표 tenGods에서 같은 글자를 찾아 옮긴다(맨 위 원칙 1).
 */
function luckCharsLine(facts: FactSheet, ganzhi: string, slot: LuckGlyphFacts | null = null): string {
  return [...ganzhi]
    .map((c, i) => {
      const part = i === 0 ? "stem" : "branch"
      const g = slot?.glyphs.find((x) => x.part === part && x.char === c)
      const tg = g ? g.tenGod : tenGodOfChar(facts, c)
      const pc = pictureOfChar(c, false)
      const pt = tg ? pictureOfTenGod(tg) : null
      const plain = [pc, pt].filter(Boolean).join(" · ")
      return `${i === 0 ? "천간" : "지지"} ${withReading(c)} = ${tg ?? "십성 사실표에 없음(이름을 붙이지 않는다)"}${plain ? ` (쉬운 말: ${plain})` : ""}`
    })
    .join(", ")
}

function interactionLine(x: InteractionRow): string {
  const where = x.positions.map(posLabel).join("·")
  const adj = x.positions.every(isNatalPos) ? (x.adjacent ? ", 붙어 있음" : ", 떨어져 있음") : ""
  return `- ${x.kind} ${withReading(x.chars)}: ${where}${adj} [${x.positions.join("+")}]${x.note ? ` — ${x.note}` : ""}${plainTail([pictureOfRelation(x.kind)])}`
}

export type InteractionScope = "natal" | "daeun" | "seun" | "all"

export function interactionsOf(facts: FactSheet, scope: InteractionScope, mustTouch?: RegExp): InteractionRow[] {
  return facts.chart.interactions.filter((x) => {
    const natal = x.positions.every(isNatalPos)
    const inScope =
      scope === "all" ||
      (scope === "natal" && natal) ||
      (scope === "daeun" && x.positions.some((p) => /^daeun/.test(p))) ||
      (scope === "seun" && x.positions.some((p) => /^seun/.test(p)))
    return inScope && (!mustTouch || x.positions.some((p) => mustTouch.test(p)))
  })
}

export function secInteractions(facts: FactSheet, scope: InteractionScope, title: string, mustTouch?: RegExp): string {
  return section(`${title} — 여기 없는 관계는 쓰지 않고, 비어 있어도 '없다'고 단정하지 않는다`, interactionsOf(facts, scope, mustTouch).map(interactionLine))
}

export function secGongmang(facts: FactSheet): string {
  const g = facts.chart.gongmang
  if (!g.branches.length) return section("공망(비어 있는 자리)", [])
  return section("공망(비어 있는 자리 — 고객에게는 '비어 있는 자리'라고 먼저 쓴다)", [
    `공망 지지: ${g.branches.map(withReading).join("·")}`,
    `원국·운에서 걸린 곳: ${g.hits.length ? g.hits.map((h) => (/^[a-z]/.test(h) ? `${posLabel(h)} [${h}]` : withReading(h))).join(", ") : "없음"}`,
    "공망은 어떤 사람에게는 아무 일도 안 한다. 허무·조상 덕 판정으로 쓰지 않는다",
  ])
}

export function secElements(facts: FactSheet): string {
  const e = facts.chart.elements
  const lines = [`개수(천간+지지 정기): ${Object.entries(e.counts).map(([k, v]) => `${elementLabel(k)} ${v}`).join(", ")}`]
  if (e.weighted) lines.push(`가중 분포(참고, 지장간 배분 포함): ${Object.entries(e.weighted).map(([k, v]) => `${elementLabel(k)} ${Number(v.toFixed(2))}`).join(", ")}`)
  if (!facts.subject.hourKnown) lines.push("태어난 시를 몰라 여섯 글자로 센 값이다")
  return section("오행 치수", lines)
}

/** 신강약·용신·조후 — 사실표에 있을 때만. 없으면 쓰지 말라는 줄 */
export function secStrength(facts: FactSheet): string {
  const c = facts.chart
  const lines: string[] = []
  if (c.strength) {
    lines.push(`신강약 판정: ${c.strength.verdict}`)
    for (const v of c.strength.views ?? []) lines.push(`- ${v.method} 방식: ${v.verdict}`)
  }
  const useful = c.usefulGod ?? []
  for (const u of useful) lines.push(`${u.method}: ${elementLabel(u.element)}`)
  if (c.climate) lines.push(`조후: ${c.climate.summary}`)
  if (!lines.length) lines.push("판정 없음 — 신강·신약·용신·조후를 말하지 않는다")
  else {
    lines.push("방식마다 판정이 다를 수 있다. 쓸 때는 방식 이름을 밝히고 한 판정으로 못 박지 않는다")
    if (useful.length) {
      lines.push("용신 줄은 관점마다 적힌 머리말(예: '힘의 균형으로 보면(억부)')을 그대로 붙여 쓴다. 관점들을 하나로 합치거나 '진짜 용신'을 고르지 않는다")
      lines.push("쉬운 말: 용신 = '이 사주에 보태 쓰면 좋다고 보는 기운'. 고객 문장에서는 '용신'보다 이 말을 먼저 쓰고, 바꿔 볼 것(개운)의 근거로 생활 실천에 옮긴다")
    }
  }
  return section("신강약·용신(규칙 엔진)", lines)
}

function daeunLine(facts: FactSheet, d: DaeunRow, tag = ""): string {
  const { endAge, endYear } = daeunEnd(facts, d)
  const slot = glyphSlotOf(facts, { slot: "daeun", daeunIndex: d.index }, d.ganzhi)
  return `- ${d.index}번째 대운 ${withReading(d.ganzhi)}: 만 ${d.startAge}~${endAge}세, ${d.startYear}~${endYear}년${tag} | ${luckCharsLine(facts, d.ganzhi, slot)}`
}

export function secDaeunNow(facts: FactSheet): string {
  const cur = currentDaeun(facts)
  const nxt = nextDaeun(facts)
  const lines = [`대운 방향: ${facts.luck.direction === "forward" ? "순행" : "역행"}`]
  if (cur) lines.push(daeunLine(facts, cur, " ← 지금"))
  else {
    const first = [...facts.luck.daeun].sort((a, b) => a.index - b.index)[0]
    lines.push(
      first
        ? `지금은 첫 대운 전이다(이 시기는 원국, 특히 월주 ${withReading(facts.chart.pillars.month)} 중심으로 읽는다. 따로 소운으로 보는 방법도 있어 '월주가 이끈다'고 못 박지 않는다). 첫 대운은 만 ${first.startAge}세, ${first.startYear}년부터`
        : "대운 정보 없음 — 대운 이야기를 하지 않는다",
    )
  }
  if (nxt) lines.push(daeunLine(facts, nxt, " ← 다음"))
  return section("지금 대운(10년 운)", lines)
}

/** 대운 전체 중 일부: past = 지금 대운 이전, ahead = 지금 대운 포함 이후 최대 limit개 */
export function secDaeunList(facts: FactSheet, which: "past" | "ahead", limit = 4): string {
  const sorted = [...facts.luck.daeun].sort((a, b) => a.index - b.index)
  const cur = currentDaeun(facts)
  const age = facts.subject.ageYears
  let rows: DaeunRow[]
  if (which === "past") rows = sorted.filter((d) => (cur ? d.index < cur.index : d.startAge <= age && !d.current))
  else {
    const from = cur ? sorted.filter((d) => d.index >= cur.index) : sorted.filter((d) => d.startAge > age)
    rows = from.slice(0, limit)
  }
  const title = which === "past" ? "지나온 대운" : "지금부터의 대운"
  const lines = rows.map((d) => daeunLine(facts, d, d.current ? " ← 지금" : ""))
  if (which === "past") {
    const first = sorted[0]
    if (first && first.startAge > 0) lines.unshift(`- 첫 대운 전(만 0~${first.startAge - 1}세): 원국, 특히 월주 ${withReading(facts.chart.pillars.month)} 중심으로 읽는 시기(따로 소운으로 보는 방법도 있다 — 한 방식으로 못 박지 않는다)`)
  }
  return section(title, lines)
}

/** 올해가 "흔들리는 해"인가 — 규칙 엔진 표지 seunFlags.shaking === true일 때만(gaeun.md §3.2, 감수 P6) */
export function isShakingYear(facts: FactSheet): boolean {
  return facts.luck.seunFlags?.shaking === true
}

export function secThisYear(facts: FactSheet): string {
  const ty = facts.luck.thisYear
  const slot = glyphSlotOf(facts, { slot: "seun", year: ty.year }, ty.ganzhi)
  return section("올해 세운", [
    `${ty.year}년 ${withReading(ty.ganzhi)}년 | ${luckCharsLine(facts, ty.ganzhi, slot)}`,
    isShakingYear(facts)
      ? "흔들리는 해 표지: 있음(규칙 엔진 — 올해 땅 글자가 네가 앉은 자리나 태어난 달 자리와 마주 밀치거나 긁는 사이). '흔들리는 해'라고 쓸 수 있다"
      : "흔들리는 해 표지: 없음 — 올해를 '흔들리는 해'라고 부르지 않는다",
  ])
}

export function secNextYear(facts: FactSheet): string {
  const ny = nextYearOf(facts)
  if (!ny) return section("내년 세운", ["사실표에 없음 — 내년 간지를 쓰거나 셈하지 않는다. 내년은 올해 할 일이 이어지는 쪽으로만 말한다"])
  return section("내년 세운", [`${ny.year}년 ${withReading(ny.ganzhi)}년 | ${luckCharsLine(facts, ny.ganzhi)}`])
}

const TOPIC_KO: Record<string, string> = {
  concernTopic: "요즘 마음이 가는 주제",
  horizon: "궁금한 때",
  relationshipStatus: "연애·혼인 상태",
  hasChildren: "자녀",
  occupationStatus: "지금 하는 일",
  careerFeeling: "지금 일에 대한 마음",
  loveFocus: "연애에서 궁금한 것",
  moneyFocus: "돈 이야기에서 궁금한 것",
  birthOrder: "형제 중 순서",
  mbti: "MBTI(자기보고 — 비유·말씨 고를 때만)",
  toneStrength: "말씀의 느낌",
  // D-023 ① 살아온 모습(personalize/survey.ts 신규 문항)
  workStyle: "스스로 말한 일하는 방식",
  selfStrength: "스스로 느끼는 강점",
  selfWeakness: "스스로 아쉽다고 느끼는 점(꾸짖지 말고 조언 눈높이에만)",
  changeWish: "요즘 가장 바꾸고 싶은 것(바꿔 볼 것의 출발점)",
}

const VALUE_KO: Record<string, string> = {
  love: "연애·결혼", money: "돈·재물", career: "일·진로", family: "가족", relationships: "사람 관계", self: "나 자신 알기", direction: "앞으로의 방향",
  this_year: "올해", three_years: "앞으로 3년쯤", whole_life: "큰 흐름 전체",
  single: "혼자", dating: "만나는 사람이 있음", married: "결혼함", other: "그 밖이거나 말하고 싶지 않음",
  none: "없음", has: "있음",
  student: "학생", job_seeking: "일자리를 찾는 중", employed: "직장에 다님", self_employed: "사업·장사", freelance: "프리랜서·1인 일", homemaker: "집안일·돌봄 중심", retired: "은퇴",
  satisfied: "대체로 만족", neutral: "그저 그럼", considering_change: "바꿀까 고민 중", preparing_new: "새로운 걸 준비 중",
  meeting: "새 인연을 만나는 때와 방식", deepening: "지금 관계를 이어 가는 법", marriage: "결혼을 생각하는 흐름", reflecting: "지난 인연을 돌아보기",
  stable_income: "꾸준한 수입 지키기", raise_income: "수입 늘리기", start_business: "내 일·사업 시작", saving_assets: "모으고 지키는 습관", no_pref: "특별히 없음",
  only: "외동", eldest: "첫째", middle: "중간", youngest: "막내",
  gentle: "부드럽게 돌려서", balanced: "적당히", direct: "솔직하게 짚어서",
  // 신규 문항 코드값(실제 파이프라인은 화면 선택지 이름을 넘기므로 대개 그대로 쓰인다)
  solo_deep: "혼자 깊이 파고드는 쪽", team: "여럿이 함께 맞춰 가는 쪽", people_facing: "사람을 직접 만나 풀어 가는 쪽", leading: "이끌고 정리하는 쪽", flexible: "그때그때 다름",
  persistence: "끈기 있게 이어 감", communication: "사람과 말이 잘 통함", planning: "계획하고 정리를 잘함", creativity: "새로운 걸 떠올림", caring: "주변을 잘 챙김", decisiveness: "결단이 빠름", learning: "배우는 속도가 빠름",
  indecision: "결정을 미룸", overwork: "너무 무리함", impatience: "성급해짐", saving: "모으는 게 어려움", asking_help: "도움 청하기가 어려움", perfectionism: "완벽하게 하려다 지침", worry: "걱정이 앞섬",
  money_stability: "돈 문제를 안정시키기", job_direction: "일의 방향 정하기", people_relations: "사람과의 관계를 편하게", love_partner: "연애·부부 사이 바꾸기", family_peace: "가족 사이 풀기", habits_routine: "생활 습관·리듬 바꾸기", confidence: "나에 대한 믿음 키우기", rest_balance: "쉼과 일의 균형 찾기",
}

const EVENT_KO: Record<string, string> = {
  marriage: "결혼", childbirth: "출산·입양", job_change: "취업·이직·전직", school_milestone: "입학·졸업·진학", relocation: "이사·이민", business_start: "사업 시작",
  breakup: "이별", new_relationship: "새 인연의 시작", business_end: "사업·장사를 접음",
}

/**
 * 사용자 사실 한 줄 = 사실 + 출처 + 글자와의 연결 표지(facts@0.3.0 link, personalize/lived-link.ts).
 * 연결은 백엔드가 드러난 글자 묶음 개수로 정한 값이다. 여기서는 그 값대로 문형만 붙인다(판정하지 않는다).
 *  - match    → "네가 말한 ○○이 바로 그 통로다"(확인하는 어조)
 *  - mismatch → "글자 밖에서 익힌 힘"(드러난 글자엔 그 묶음이 없다 — 개수 0)
 *  - 없음     → 사주로 설명하지 않는다, 배경으로만
 */
function userFactLine(f: UserFactRow): string {
  const ev = /^life_event:(.+)$/.exec(f.topic)
  const rc = /^recent_change:(.+)$/.exec(f.topic)
  const value = ev ? (EVENT_KO[ev[1]] ?? ev[1]) : rc ? (EVENT_KO[rc[1]] ?? rc[1]) : (VALUE_KO[f.value] ?? f.value)
  const name = ev ? `지나온 큰 일: ${value}` : rc ? `최근 3년 사이 변화: ${value}` : `${TOPIC_KO[f.topic] ?? f.topic}: ${value}`
  const link = f.link
  const tail = !link
    ? "글자와 잇지 않음 → 사주로 설명하지 않는다, 배경으로만 둔다"
    : link.kind === "match"
      ? `글자와 닿음(${groupPicture(link.group)}(${GROUP_KO[link.group]})이 드러난 글자에 있다) → '네가 말한 「${value}」이 바로 그 통로다' 꼴로 잇는다(조사는 맞춘다). 사주가 맞혔다고 쓰지 않는다`
      : `글자 밖(드러난 글자엔 ${groupPicture(link.group)}(${GROUP_KO[link.group]})이 없다) → '네가 해 왔다면 그건 글자 밖에서 익힌 힘이다' 꼴로 존중한다. 글자를 근거로 그 삶을 고치라 하지 않는다`
  return `- ${name}${f.period ? ` (${f.period})` : ""} [출처: 네가 말한 것] | ${tail}`
}

/**
 * 사용자 사실 중 이 장에 필요한 주제만. topics의 항목이 ":"로 끝나면 접두어로 본다(예: "life_event:").
 * toneStrength는 시스템 프롬프트에서 쓰므로 여기서는 뺀다.
 */
export function userFactsFor(facts: FactSheet, topics: readonly string[]): FactSheet["personal"]["userFacts"] {
  return facts.personal.userFacts.filter(
    (f) => f.topic !== "toneStrength" && topics.some((t) => (t.endsWith(":") ? f.topic.startsWith(t) : f.topic === t)),
  )
}

export function secUserFacts(facts: FactSheet, topics: readonly string[]): string {
  const rows = userFactsFor(facts, topics)
  return section(
    "사용자 사실 — 읽는 사람이 직접 말한 것. 고객 문장에서도 '네가 말한 ~', '네가 말해 준 대로'처럼 출처를 밝히고, 줄 끝 연결 표지대로만 글자와 잇는다",
    rows.map(userFactLine),
  )
}

export function secNoGuess(facts: FactSheet): string {
  const ys = [...new Set(facts.personal.noGuessYears)].sort((a, b) => a - b)
  return section("맞히지 않는 해 — 이 해들에 '그해 ○○ 일이 있었다/있었겠다'는 문장을 쓰지 않는다", ys.length ? [ys.map((y) => `${y}년`).join(", ")] : [])
}

export function secWarnings(facts: FactSheet): string {
  const ws = [...facts.warnings]
  if (!facts.subject.hourKnown && !ws.some((w) => /시.*모름|모름.*시|hour/i.test(w))) ws.push("태어난 시 모름")
  return section("엔진 경고 — 해당되면 caveat 칸에 쉬운 말로 한 번 밝힌다", ws.map((w) => `- ${w}`))
}

export function secGuards(facts: FactSheet): string {
  return section("지켜야 할 규칙(개인화 엔진)", facts.personal.guards.map((g) => `- ${g}`))
}

// ─────────────────────────────── 개운(바꿔 볼 것) — 코드가 고른 범주만 (D-023 ②, gaeun.md §3.3·§3.4·§4)

/**
 * 장별로 싣는 범주(gaeun.md §3.4). 장 → 범위 이름은 chapters/*.ts의 sectionOptions.gaeunScope.
 *  - natal        타고난 옷감: GA.fill + GA.ease(또는 GA.balanced), GJ 1개
 *  - daeun        지금 대운·열 해 장: 지금 대운 슬롯의 GT.* + GT.turn + GI.*
 *  - seun         올해 장: 올해(·내년) 슬롯의 GT.* + GI.*
 *  - relation     연애 등 관계 장(운 이야기 있음): GI.chungDay·GI.hap + GA.fill/ease 중 비겁·관성·인성
 *  - relationNatal 사람 장(운 이야기는 올해 장 몫): GA.fill/ease 중 비겁·관성·인성만
 *  - work         일·돈 특화 장(운 이야기 있음): GA.fill/ease 중 식상·재성·관성 + GT.*
 *  - workNatal    재능·돈 기본 장(운 이야기는 운 장 몫): GA.fill/ease 중 식상·재성·관성만
 *  - closing      마무리: 새 범주 없이 앞 장들이 쓴 범주(natal ∪ daeun ∪ seun) 중 1~3개 되짚기
 * GA.bridge·GE.*(오행 생활 결 실천 줄)는 §3.4 표에 자리가 없어 지금은 어느 장에도 싣지 않는다.
 */
export type GaeunScope = "natal" | "daeun" | "seun" | "relation" | "relationNatal" | "work" | "workNatal" | "closing"

const REL_GROUPS: readonly GaeunGroup[] = ["bigyeop", "gwansal", "inseong"]
const WORK_GROUPS: readonly GaeunGroup[] = ["siksang", "jaeseong", "gwansal"]
const LUCK_SLOTS: readonly GaeunPick["slot"][] = ["daeun", "seun", "nextSeun"]

const isFillEase = (p: GaeunPick) => /^GA\.(fill|ease)\./.test(p.id)
const natalGroupIn = (p: GaeunPick, gs: readonly GaeunGroup[]) => p.slot === "natal" && isFillEase(p) && !!p.group && gs.includes(p.group)

const SCOPE_RULE: Record<Exclude<GaeunScope, "closing">, (p: GaeunPick) => boolean> = {
  natal: (p) => p.slot === "natal" && (isFillEase(p) || p.id === "GA.balanced" || p.id.startsWith("GJ.")),
  daeun: (p) => p.slot === "daeun" && /^(GT|GI)\./.test(p.id),
  seun: (p) => (p.slot === "seun" || p.slot === "nextSeun") && /^(GT|GI)\./.test(p.id),
  relation: (p) => natalGroupIn(p, REL_GROUPS) || (LUCK_SLOTS.includes(p.slot) && (p.id === "GI.chungDay" || p.id === "GI.hap")),
  relationNatal: (p) => natalGroupIn(p, REL_GROUPS),
  work: (p) => natalGroupIn(p, WORK_GROUPS) || (LUCK_SLOTS.includes(p.slot) && p.id.startsWith("GT.")),
  workNatal: (p) => natalGroupIn(p, WORK_GROUPS),
}

/** 장 끝맺음(gaeun.md §3.4 "끝맺음" 열) */
const SCOPE_ENDING: Record<GaeunScope, string> = {
  natal: "채울 것 하나 + 덜 것 하나(균형 범주면 지킬 습관 하나)",
  daeun: "이 열 해에 할 것 하나",
  seun: "올해 할 것 하나, 줄일 것 하나",
  relation: "관계에서 바꿔 볼 것 하나",
  relationNatal: "관계에서 바꿔 볼 것 하나",
  work: "일하는 방식 하나",
  workNatal: "일하는 방식 하나",
  closing: "아래 후보 중 1~3개를 되짚는다. 새 범주를 꺼내지 않는다",
}

/** 이 범위에 싣는 pick(실천 등급만, 코드가 준 순서 그대로). 마무리는 앞 장 범위의 합집합 */
export function gaeunPicksFor(facts: FactSheet, scope: GaeunScope): GaeunPick[] {
  const all = (facts.chart.gaeun ?? []).filter((p) => p.tier === "practice" && !!GAEUN_CATALOG[p.id])
  const rule = scope === "closing" ? (p: GaeunPick) => SCOPE_RULE.natal(p) || SCOPE_RULE.daeun(p) || SCOPE_RULE.seun(p) : SCOPE_RULE[scope]
  const out: GaeunPick[] = []
  let gj = 0
  for (const p of all) {
    if (!rule(p)) continue
    if (p.id.startsWith("GJ.")) {
      if (gj >= 1) continue // 타고난 옷감 장: GJ 1개(§3.4)
      gj += 1
    }
    out.push(p)
  }
  return out
}

function slotGlyphs(facts: FactSheet, p: GaeunPick): LuckGlyphFacts | null {
  const gs = facts.luck.glyphs ?? []
  if (p.slot === "daeun") {
    const cur = currentDaeun(facts)
    return gs.find((g) => g.slot === "daeun" && (cur ? g.daeunIndex === cur.index : true)) ?? null
  }
  if (p.slot === "seun") return gs.find((g) => g.slot === "seun" && g.year === facts.luck.thisYear.year) ?? null
  return null
}

/** 운 슬롯 이름: "지금 열 해 옷(대운) 丙申(병신)", "올해 2026년 丙午(병오)" */
function slotLabel(facts: FactSheet, p: GaeunPick): string {
  if (p.slot === "daeun") {
    const cur = currentDaeun(facts)
    return cur ? `지금 열 해 옷(대운) ${withReading(cur.ganzhi)}` : "열 해 옷(대운)"
  }
  if (p.slot === "seun") return `올해 ${facts.luck.thisYear.year}년 ${withReading(facts.luck.thisYear.ganzhi)}`
  const ny = nextYearOf(facts)
  return ny ? `내년 ${ny.year}년 ${withReading(ny.ganzhi)}` : "내년"
}

/** 운 글자 그림 말: "丙 하늘 한가운데 뜬 해 · 申 초가을 단단한 쇠와 바위" */
function glyphPictures(slot: LuckGlyphFacts | null, half?: "early" | "late"): string {
  if (!slot) return ""
  const rows = slot.glyphs.filter((g) => !half || (half === "early" ? g.part === "stem" : g.part === "branch"))
  return rows.map((g) => `${g.char} ${pictureOfChar(g.char, false) ?? g.char}`).join(" · ")
}

const firstSentence = (p: GaeunPick): string | null => {
  if (!p.id.startsWith("GA.fill.") || !p.framing) return null
  if (p.framing === "missingSurface")
    return `첫 문장 꼴: "드러난 글자엔 ~가 없다"(~ = 위 그림 말, 규칙 엔진 개수 0)${p.hiddenPresent ? ' + "속에 조금 숨어 있다"' : ""}`
  if (p.framing === "thin") return '첫 문장 꼴: "~가 얇다"(드러나 있되 얇다. \'없다\'고 쓰지 않는다)'
  return '첫 문장 꼴: "~가 있는데 덜 꺼내 쓰기 쉽다"(있는 걸 더 꺼내 쓰라는 쪽. \'모자라다\'고 쓰지 않는다)'
}

/** pick 한 줄 = 범주 + 바꿔 볼 것(practice) + 근거 그림 말, 그 아래 문형·말투 줄 */
function gaeunPickLines(facts: FactSheet, p: GaeunPick, all: readonly GaeunPick[]): string[] {
  const cat = GAEUN_CATALOG[p.id]
  const g = p.group
  const el = p.element ? `${elementLabel(p.element)} 기운` : null
  let root: string
  if ((p.id.startsWith("GA.fill.") || p.id.startsWith("GA.ease.")) && g) {
    root = `${groupPicture(g)}(${GROUP_KO[g]})${el ? ` · ${el}` : ""}${p.id.startsWith("GA.ease.") ? " — 넘치기 쉬운 쪽" : " — 채울 쪽"}`
  } else if (p.id === "GA.balanced") {
    root = "한쪽으로 크게 기울지 않은 판"
  } else if (p.id === "GA.bridge") {
    const b = facts.chart.gaeunBasis?.views.find((v) => v.method === "tonggwan")?.bridge
    root = `${b ? `맞선 두 기운 ${elementLabel(b.from)}·${elementLabel(b.to)} 사이를 ` : "맞선 두 힘 사이를 "}${el ?? "다른 기운"}이 잇는다`
  } else if (p.id.startsWith("GJ.")) {
    root = `${GJ_PICTURE[p.id]?.picture ?? "계절 기운이 한쪽으로 기운 판"}${el ? ` · ${el}` : ""}`
  } else if (p.id.startsWith("GE.")) {
    root = `${(p.element && GE_PICTURE[p.element]) || "반가운 기운"}${el ? `(${el})` : ""}`
  } else if (p.id === "GT.turn") {
    const y = p.basis.find((b) => b.ruleId === "gaeun.L5")?.values?.startYear
    const m = /^daeun\[(\d+)\]/.exec(p.basis[0]?.positions[0] ?? "")
    const d = m ? facts.luck.daeun.find((x) => x.index === Number(m[1])) : undefined
    root = `${typeof y === "number" ? `${y}년에 ` : ""}${d ? `새 열 해 옷 ${withReading(d.ganzhi)}(${pictureOfGanzhi(d.ganzhi) ?? "그림 말 없음"})으로 ` : ""}갈아입는다 — ${GT_PICTURE["GT.turn"]}`
  } else if (p.id.startsWith("GT.")) {
    const pics = glyphPictures(slotGlyphs(facts, p), p.half)
    root = `${slotLabel(facts, p)}${p.half ? ` ${HALF_KO[p.half]}` : ""}${pics ? ` — ${pics}` : ""} | ${GT_PICTURE[p.id] ?? ""}`
  } else if (p.id.startsWith("GI.")) {
    const slot = slotGlyphs(facts, p)
    const rels = p.basis.map((b) => {
      const kind = b.ruleId.replace(/^gaeun\.L6\./, "")
      const r = slot?.relations.find((x) => x.id === p.id.slice(3) && x.positions.join("+") === b.positions.join("+"))
      const pr = pictureOfRelation(kind)
      return `${kind}${r ? ` ${withReading(r.chars)}` : ""}: ${b.positions.map(posLabel).join("·")}${pr ? `(${pr})` : ""}`
    })
    root = `${slotLabel(facts, p)} — ${GI_PICTURE[p.id] ?? ""}${rels.length ? ` | ${rels.join(" / ")}` : ""}`
  } else {
    root = el ?? ""
  }
  const lines = [`- ${familyPlain(p.id)} [${p.id}] — 바꿔 볼 것: ${plainPractice(cat.practice)} | 근거 그림 말: ${root}`]
  const sub = (s: string) => lines.push(`  · ${s}`)

  if (p.view !== "luck") sub(`머리말: ${VIEW_HEAD[p.view]}`)
  const fs = firstSentence(p)
  if (fs) sub(fs)
  if (p.luckGroups?.length && p.id.startsWith("GT.")) sub(`그 시기 일이 몰리는 쪽: ${p.luckGroups.map((x) => LUCK_SIDE[x]).join(" / ")}에서`)
  if (p.tone === "soft") {
    sub(`말투: 단정하지 않는다 — "~쪽으로 볼 수도 있다. 네 겪은 걸로 가려 봐라"${p.softBy?.includes("C2") ? '. "태어난 시를 몰라 갈릴 수 있다"를 한 번 밝힌다' : ""}`)
  }
  if (p.split) {
    sub(
      `보는 법이 갈린다(힘의 균형으로는 ${VERDICT_KO[p.split.eokbu] ?? p.split.eokbu}, 계절 기운으로는 ${VERDICT_KO[p.split.johuClimate] ?? p.split.johuClimate}) — ` +
        '움직여라·다져라 중 하나를 고르지 않는다. "들어갈 문과 나올 문을 같이 확인" 같은 중립 실천만 쓴다',
    )
  }
  if (p.conflict === "compatible") sub('함께 쓰는 힘의 균형 범주와 머리말을 나눈다: "힘의 균형으로 보면 ~, 계절 기운으로 보면 ~"')
  if (p.conflict === "tension" || p.conflict === "opposed") {
    sub("이 계절 기운은 몸·생활 리듬 실천으로만 쓰고 그 기운을 '반갑다'고 부르지 않는다. 한 장에 두 방향의 '반갑다'를 쓰지 않는다")
  }
  if (p.conflict === "opposed") {
    const ease = all.find((x) => x.slot === "natal" && x.id.startsWith("GA.ease.") && x.group)
    const easeSide = ease?.group ? EASE_SIDE[ease.group] : "덜어 내는 쪽"
    const gjSide = GJ_PICTURE[p.id]?.side ?? "몸을 맞추는 쪽"
    sub(
      "힘의 균형으로 덜자는 기운과 같은 기운이다. 같은 기운에 '채워라'와 '덜어라'를 함께 말하지 않는다. " +
        `덜 것은 누르기 말고 흘려보내기(벌인 것 끝내기·나누기) 말투로 쓰고, 고르는 기준을 준다: "보는 법에 따라 이 판은 두 갈래로 읽힌다. 네가 지쳐 있을 땐 ${gjSide}, 일이 막힐 땐 ${easeSide}부터 해 봐라."`,
    )
  }
  if (p.id.startsWith("GA.ease.") && all.some((x) => x.slot === "natal" && x.conflict === "opposed")) {
    sub("이 판은 계절 기운이 이 기운을 반긴다 — 덜 것을 누르기 말고 흘려보내기(벌인 것 끝내기·나누기) 말투로 쓴다")
  }
  if (p.id.startsWith("GE.") && p.basis.some((b) => b.ruleId === "gaeun.N6.N4") && p.basis.some((b) => b.ruleId === "gaeun.N6.N1")) {
    sub('두 관점이 같은 기운을 반긴다 — "어느 쪽으로 봐도 ~가 반갑다"로 한 줄에 합쳐 쓴다')
  }
  return lines
}

/** 드러난 글자 묶음 개수(감수 P1·P2) — AI가 세지 않고 이 값만 옮긴다 */
function groupCountsLine(facts: FactSheet): string[] {
  const c = facts.chart.gaeunBasis?.groupCounts
  if (!c) return ["드러난 글자 묶음 개수: 사실표에 없음 — 묶음 개수를 말하지 않고, '○○이 없다·약하다'는 조건 문장을 쓰지 않는다"]
  const order: GaeunGroup[] = ["bigyeop", "siksang", "jaeseong", "gwansal", "inseong"]
  const zero = order.filter((g) => (c[g] ?? 0) === 0)
  return [
    `드러난 글자 묶음 개수(규칙 엔진 값, 천간과 땅 글자 겉 기운만, 너 자신을 뜻하는 글자 제외): ${order.map((g) => `${GROUP_KO[g]}(${groupPicture(g)}) ${c[g] ?? 0}`).join(", ")}`,
    `'○○이 없다·드러나 있지 않다·약하면' 같은 조건은 값이 0인 묶음에만 쓴다(지금: ${zero.length ? zero.map((g) => GROUP_KO[g]).join("·") : "없음"}). 1 이상인 묶음은 범주 줄의 첫 문장 꼴('얇다'·'덜 꺼내 쓴다')을 따르고 '없다·약하다'고 쓰지 않는다. 개수는 이 값만 옮기고 글자를 세어 새 개수를 만들지 않는다`,
  ]
}

export function secGaeun(facts: FactSheet, slots: GaeunScope): string {
  const title = "바꿔 볼 것 — 코드가 고른 범주. 이 밖의 개운은 만들지 않는다"
  const counts = groupCountsLine(facts)
  if (!facts.chart.gaeun) {
    return section(title, [
      ...counts,
      "코드가 고른 범주가 이 사실표에 없다. 바꿔 볼 것은 [이 장에서 할 일]대로 이 장 사실표 글자에서만 끌어내고, 채우기·덜기·기운 맞추기 같은 개운 처방을 스스로 골라 붙이지 않는다",
    ])
  }
  const picks = gaeunPicksFor(facts, slots)
  const all = facts.chart.gaeun
  const lines = [...counts]
  if (!picks.length) {
    lines.push(
      slots === "closing"
        ? "되짚을 범주가 없다. 마무리 당부는 앞 장들이 이미 다룬 근거 글자를 되짚어 쓰고 새 개운 처방을 만들지 않는다"
        : "이 장에 실을 범주가 없다. 바꿔 볼 것은 이 장 사실표 글자에서 나온 생활 실천 하나로만 쓰고, 채우기·덜기·기운 맞추기 같은 개운 처방을 새로 만들지 않는다",
    )
  } else {
    lines.push(`이 장 끝맺음: ${SCOPE_ENDING[slots]}`)
    if (slots === "closing") lines.push("아래는 앞 장들에 실린 범주다(되짚기 후보). 새 범주가 아니다")
    for (const p of picks) lines.push(...gaeunPickLines(facts, p, all))
    lines.push(
      "쓰는 법: 범주 하나를 이 사람 장면으로 옮겨 언제·무엇을·얼마나가 보이는 행동 1~2개로 쓴다. 근거는 '근거 그림 말'로 문장 안에 넣고 효과는 약속하지 않는다('해 볼 만하다'). 대괄호 안 범주 이름표(영문)는 고객 문장에 쓰지 않는다",
    )
  }
  lines.push("색·방향·숫자·맛으로 기운을 빗대는 옛 방식 참고는 싣지 않았다 — 쓰지 않는다")
  lines.push(`이 범주에 쓰지 않는 말: ${GAEUN_FORBIDDEN_WORDS.join("·")}`)
  return section(title, lines)
}
