// 사실표 → 장별 사용자 메시지 조각 (P4-03) — 담당: 콘텐츠 작가
// 원칙
//  1. 사실표(FactSheet)의 값을 "옮겨 적기"만 한다. 십성·합충·공망·신강약을 새로 계산하지 않는다.
//     - 한자 → 한글 읽기, 위치 코드 → 우리말 이름, 오행 코드 → 일상말은 표기 변환이다(판정 아님).
//     - 대운 끝 나이·끝 해는 "다음 대운 시작 − 1"(없으면 시작 + 9)로 적는다(life-stages.md §1의 구간 정의).
//     - 운 글자의 십성은 사실표 tenGods에서 "같은 글자"를 찾아 옮긴다. 없으면 "사실표에 없음"으로 적고 AI가 이름을 붙이지 못하게 한다.
//  2. 필요한 조각만 골라 넣는다(입력 토큰 절약). JSON.stringify(facts)를 통째로 넣지 않는다.
//  3. 개인정보 최소화: 성별(subject.gender)·기준 시각(asOf)·엔진 버전은 AI에 넘기지 않는다.
//     성별은 대운 방향 계산에 이미 쓰였고, 풀이에서 성별로 해석을 바꾸지 않기 때문이다(voice-guide §9 성별 고정관념).
//     사실표 밖에 실수로 붙은 칸(이름·생년월일 등)이 있어도 여기서는 정해진 칸만 읽으므로 새지 않는다.
import type { FactSheet } from "../types"

type TenGodRow = FactSheet["chart"]["tenGods"][number]
type InteractionRow = FactSheet["chart"]["interactions"][number]
type DaeunRow = FactSheet["luck"]["daeun"][number]

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
  return section("여덟 글자(원국)", [
    `연주 ${withReading(p.year)} / 월주 ${withReading(p.month)} / 일주 ${withReading(p.day)} / 시주 ${p.hour ? withReading(p.hour) : "모름"}`,
    `일간: ${withReading(dm.stem)} · ${elementLabel(dm.element)} · ${dm.yinYang === "yang" ? "양" : "음"}`,
    `일지(가장 가까운 사람의 자리): ${withReading(dayBranch(facts))}`,
  ])
}

/** 일주만(무료 생김새 장) */
export function secDayPillar(facts: FactSheet): string {
  const dm = facts.chart.dayMaster
  return section("일주", [
    `일주 ${withReading(facts.chart.pillars.day)} — 일간 ${withReading(dm.stem)}(${elementLabel(dm.element)}, ${dm.yinYang === "yang" ? "양" : "음"}), 일지 ${withReading(dayBranch(facts))}`,
  ])
}

function tenGodLine(t: TenGodRow): string {
  return `- ${posLabel(t.pos)} ${withReading(t.char)} = ${t.tenGod} [${t.pos}]`
}

/** 원국 십성(규칙 엔진 판정). includeHidden=false면 지장간 항목을 빼고, onlyPos가 있으면 그 위치만 */
export function secNatalTenGods(facts: FactSheet, opts: { includeHidden?: boolean; onlyPos?: RegExp } = {}): string {
  const includeHidden = opts.includeHidden ?? true
  const rows = facts.chart.tenGods.filter(
    (t) => isNatalPos(t.pos) && (includeHidden || !isHiddenPos(t.pos)) && (!opts.onlyPos || opts.onlyPos.test(t.pos)),
  )
  return section("원국 십성(규칙 엔진 판정, 일간 기준 — 여기 없는 글자에 십성 이름을 붙이지 않는다)", rows.map(tenGodLine))
}

/** 운 글자(대운·세운 간지)의 십성 — 사실표에서 같은 글자를 찾아 옮긴다 */
function luckCharsLine(facts: FactSheet, ganzhi: string): string {
  return [...ganzhi]
    .map((c, i) => {
      const tg = tenGodOfChar(facts, c)
      return `${i === 0 ? "천간" : "지지"} ${withReading(c)} = ${tg ?? "십성 사실표에 없음(이름을 붙이지 않는다)"}`
    })
    .join(", ")
}

function interactionLine(x: InteractionRow): string {
  const where = x.positions.map(posLabel).join("·")
  const adj = x.positions.every(isNatalPos) ? (x.adjacent ? ", 붙어 있음" : ", 떨어져 있음") : ""
  return `- ${x.kind} ${withReading(x.chars)}: ${where}${adj} [${x.positions.join("+")}]${x.note ? ` — ${x.note}` : ""}`
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
  return section("공망(비어 있는 자리)", [
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
    if (useful.length) lines.push("용신 줄은 관점마다 적힌 머리말(예: '힘의 균형으로 보면(억부)')을 그대로 붙여 쓴다. 관점들을 하나로 합치거나 '진짜 용신'을 고르지 않는다")
  }
  return section("신강약·용신(규칙 엔진)", lines)
}

function daeunLine(facts: FactSheet, d: DaeunRow, tag = ""): string {
  const { endAge, endYear } = daeunEnd(facts, d)
  return `- ${d.index}번째 대운 ${withReading(d.ganzhi)}: 만 ${d.startAge}~${endAge}세, ${d.startYear}~${endYear}년${tag} | ${luckCharsLine(facts, d.ganzhi)}`
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

export function secThisYear(facts: FactSheet): string {
  const ty = facts.luck.thisYear
  return section("올해 세운", [`${ty.year}년 ${withReading(ty.ganzhi)}년 | ${luckCharsLine(facts, ty.ganzhi)}`])
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
}

const EVENT_KO: Record<string, string> = {
  marriage: "결혼", childbirth: "출산·입양", job_change: "취업·이직·전직", school_milestone: "입학·졸업·진학", relocation: "이사·이민", business_start: "사업 시작",
}

function userFactLine(f: FactSheet["personal"]["userFacts"][number]): string {
  const ev = /^life_event:(.+)$/.exec(f.topic)
  const name = ev ? `지나온 큰 일: ${EVENT_KO[ev[1]] ?? ev[1]}` : `${TOPIC_KO[f.topic] ?? f.topic}: ${VALUE_KO[f.value] ?? f.value}`
  return `- ${name}${f.period ? ` (${f.period})` : ""}`
}

/**
 * 사용자 사실 중 이 장에 필요한 주제만. topics의 항목이 ":"로 끝나면 접두어로 본다(예: "life_event:").
 * toneStrength는 시스템 프롬프트에서 쓰므로 여기서는 뺀다.
 */
export function secUserFacts(facts: FactSheet, topics: readonly string[]): string {
  const rows = facts.personal.userFacts.filter(
    (f) => f.topic !== "toneStrength" && topics.some((t) => (t.endsWith(":") ? f.topic.startsWith(t) : f.topic === t)),
  )
  return section("사용자 사실 — 읽는 사람이 직접 말한 것. 배경으로만 쓰고 맞혔다고 쓰지 않는다", rows.map(userFactLine))
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
