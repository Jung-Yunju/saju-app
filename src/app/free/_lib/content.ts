// 무료 결과의 할미 문장 선택(서버 전용). 문안 원본: content/free/*.json (콘텐츠 작가 소유 — 이 파일은 읽기만 한다)
// 규격: docs/knowledge/free-copy.md (치환 토큰 §0-1, 오행 판정 기준, teaser needsConfirm)
//   day-master {items:[{stem,label,title,hook,body,strength,blindSpot,bokja}], disclaimer}
//   day-pillar {items:[{pillar,label,oneLiner,detail}]}
//   elements   {numerals, thresholds, tenGodLineTemplate, groupByDayMasterElement, tenGodGroups, items:[{element,name,excess|lack|balanced:{text,prescription}}]}
//   this-year  {years:[{year,label,byDayMaster:[{stem,line}],dayBranch:[{branch,line}]}], disclaimer}
//   teaser     {wealthByDayMasterElement, button, items:[{menu,preview,lock,needsConfirm}]}
//   share-card {items:[{stem,title,line}]}
// 파일이 없거나 형식이 달라 못 찾으면 "문안 준비 중" 자리표시로 동작한다. 형식이 바뀌면 이 파일의 정규화 함수만 고친다.
// 읽는 방법: 서버에서 fs로 읽는다(process.cwd() 기준 고정 경로 — 배포 시 content/ 폴더가 함께 올라가야 한다).
import fs from "node:fs"
import path from "node:path"
import { PLACEHOLDER_TEXT, type CopyBlock, type ElementCopy, type ElementKo, type FreeCopy, type TeaserCopy } from "./types"

export interface RawContent {
  dayMaster?: unknown
  dayPillar?: unknown
  elements?: unknown
  thisYear?: unknown
  teaser?: unknown
  shareCard?: unknown
}

const FILES: Record<keyof RawContent, string> = {
  dayMaster: "day-master.json",
  dayPillar: "day-pillar.json",
  elements: "elements.json",
  thisYear: "this-year.json",
  teaser: "teaser.json",
  shareCard: "share-card.json",
}

let cached: RawContent | null = null

/** content/free/*.json 읽기. 없거나 깨진 파일은 건너뛴다(파일 이름만 기록). 개발 중에는 매번 다시 읽는다 */
export function loadRawContent(dir = path.join(process.cwd(), "content", "free")): RawContent {
  if (cached && process.env.NODE_ENV === "production") return cached
  const out: RawContent = {}
  for (const [k, file] of Object.entries(FILES) as [keyof RawContent, string][]) {
    try {
      out[k] = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as unknown
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") console.warn(`[free-content] ${file} 읽기 실패`)
    }
  }
  if (process.env.NODE_ENV === "production") cached = out
  return out
}

// ─── 안전한 읽기 도우미 ─────────────────────────────────────────────────────
type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v)
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined)
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : [])
const get = (v: unknown, k: string): unknown => (isObj(v) ? v[k] : undefined)
const itemsOf = (raw: unknown, key = "items"): Obj[] => arr(get(raw, key))

const placeholder = (): CopyBlock => ({ text: PLACEHOLDER_TEXT, placeholder: true })

const EN: Record<ElementKo, string> = { 목: "wood", 화: "fire", 토: "earth", 금: "metal", 수: "water" }

/** {토큰} 치환. 값이 없는 토큰은 그대로 두지 않고 null을 돌려 그 문장을 쓰지 않게 한다 */
export function fillTokens(text: string, tokens: Record<string, string | undefined>): string | null {
  let missing = false
  const out = text.replace(/\{(\w+)\}/g, (_m, k: string) => {
    const v = tokens[k]
    if (v === undefined) { missing = true; return "" }
    return v
  })
  return missing ? null : out
}

// ─── 선택 ──────────────────────────────────────────────────────────────────

export interface CopyFacts {
  dayMaster: { hanja: string; ko: string; element: ElementKo }
  dayPillar: { hanja: string; ko: string }
  dayBranch: { hanja: string; ko: string }
  elements: { el: ElementKo; count: number }[]
  hourUnknown: boolean
  thisYear: { year: number; hanja: string; ko: string }
}

/** 오행 판정(작가 제안 기준): 0개=없음, 4개 이상(시주 모름 3개 이상)=넘침. 넘침 전부 → 없음 전부 순. 둘 다 없으면 가장 많은 오행의 balanced 하나(같으면 일간 오행) */
export function classifyElements(
  elements: { el: ElementKo; count: number }[], hourUnknown: boolean, dayEl: ElementKo, th = { lack: 0, excessFull: 4, excessHourUnknown: 3 },
): { kind: ElementCopy["kind"]; el: ElementKo }[] {
  if (elements.length === 0) return []
  const limit = hourUnknown ? th.excessHourUnknown : th.excessFull
  const out: { kind: ElementCopy["kind"]; el: ElementKo }[] = []
  for (const e of elements) if (e.count >= limit) out.push({ kind: "excess", el: e.el })
  for (const e of elements) if (e.count <= th.lack) out.push({ kind: "lack", el: e.el })
  if (out.length === 0) {
    const max = Math.max(...elements.map((e) => e.count))
    const top = elements.filter((e) => e.count === max)
    out.push({ kind: "balanced", el: (top.find((e) => e.el === dayEl) ?? top[0]).el })
  }
  return out
}

function dayMasterCopy(raw: unknown, f: CopyFacts): { block: CopyBlock; nickname?: string } {
  const it = itemsOf(raw).find((x) => x.stem === f.dayMaster.hanja)
  const body = str(it?.body)
  if (!it || !body) return { block: placeholder(), nickname: str(it?.title) }
  const details = [
    ["강점", str(it.strength)], ["조심할 점", str(it.blindSpot)], ["복자는", str(it.bokja)],
  ].filter((d): d is [string, string] => !!d[1]).map(([label, text]) => ({ label, text }))
  return { block: { title: str(it.title), lead: str(it.hook), text: body, details, placeholder: false }, nickname: str(it.title) }
}

function dayPillarCopy(raw: unknown, f: CopyFacts): CopyBlock {
  const it = itemsOf(raw).find((x) => x.pillar === f.dayPillar.hanja)
  const detail = str(it?.detail)
  if (!it || !detail) return placeholder()
  return { title: str(it.label), lead: str(it.oneLiner), text: detail, placeholder: false }
}

function elementsCopy(raw: unknown, f: CopyFacts): ElementCopy[] {
  const th = get(raw, "thresholds")
  const numerals = get(raw, "numerals")
  const items = itemsOf(raw)
  const picks = classifyElements(f.elements, f.hourUnknown, f.dayMaster.element, isObj(th) ? {
    lack: Number(th.lack ?? 0), excessFull: Number(th.excessFull ?? 4), excessHourUnknown: Number(th.excessHourUnknown ?? 3),
  } : undefined).slice(0, 4)
  const groups = get(raw, "tenGodGroups")
  const byDm = get(get(raw, "groupByDayMasterElement"), EN[f.dayMaster.element])
  return picks.map(({ kind, el }) => {
    const item = items.find((x) => x.element === EN[el])
    const sect = get(item, kind)
    const count = f.elements.find((e) => e.el === el)?.count ?? 0
    const group = str(get(byDm, EN[el]))
    const g = group ? get(groups, group) : undefined
    const tokens = {
      letters: f.hourUnknown ? "여섯 글자" : "여덟 글자",
      n: str(get(numerals, String(count))),
      dayStem: `${f.dayMaster.ko}(${f.dayMaster.hanja})`,
      elementName: str(item?.name), group, gloss: str(get(g, "gloss")),
    }
    const text = fillTokens(str(get(sect, "text")) ?? "", tokens)
    if (!text) return { ...placeholder(), kind, el }
    const details: { label: string; text: string }[] = []
    const rx = fillTokens(str(get(sect, "prescription")) ?? "", tokens)
    if (rx) details.push({ label: "할미 처방", text: rx })
    // 일간 기준 십성 묶음: 같은 오행이라도 일간마다 다른 문장이 되게 한다(원본 규칙: 템플릿과 떼어 쓰지 않는다)
    const line = fillTokens(str(get(raw, "tenGodLineTemplate")) ?? "", tokens)
    const gText = kind === "balanced" ? undefined : str(get(g, kind))
    if (line) details.push({ label: "십성으로 보면", text: gText ? `${line} ${gText}` : line })
    return { text, details, kind, el, placeholder: false }
  })
}

function thisYearCopy(raw: unknown, f: CopyFacts): { block: CopyBlock; note: string } {
  const year = arr(get(raw, "years")).find((y) => y.year === f.thisYear.year)
  const note = str(get(raw, "disclaimer")) ?? ""
  const line = str(arr(get(year, "byDayMaster")).find((x) => x.stem === f.dayMaster.hanja)?.line)
  if (!year || !line) return { block: placeholder(), note: "" }
  // 일지가 세운 지지와 충·합이 되는 사람에게만 덧줄을 붙인다(원본에 해당 일지만 적혀 있다)
  const extra = str(arr(get(year, "dayBranch")).find((x) => x.branch === f.dayBranch.hanja)?.line)
  return { block: { title: str(year.label), text: extra ? `${line}\n${extra}` : line, placeholder: false }, note }
}

function teaserCopy(raw: unknown, f: CopyFacts, yearLabel: string): TeaserCopy {
  const fallback: TeaserCopy = { title: "더 깊은 풀이", items: [], lock: PLACEHOLDER_TEXT, button: "더 깊은 풀이 보기", placeholder: true }
  const wealth = str(get(get(raw, "wealthByDayMasterElement"), EN[f.dayMaster.element]))
  const tokens = {
    dayStem: `${f.dayMaster.ko}(${f.dayMaster.hanja})`, dayBranch: `${f.dayBranch.ko}(${f.dayBranch.hanja})`,
    dayPillar: `${f.dayPillar.ko}(${f.dayPillar.hanja})`, wealth, yearLabel,
    letters: f.hourUnknown ? "여섯 글자" : "여덟 글자",
  }
  // 유료 상품에 실제로 들어가는지 확인 전(needsConfirm: true)인 항목은 약속이 되므로 숨긴다
  const live = itemsOf(raw).filter((x) => x.needsConfirm !== true)
  const items = live.flatMap((x) => {
    const menu = str(x.menu), preview = fillTokens(str(x.preview) ?? "", tokens)
    return menu && preview ? [{ menu, preview }] : []
  })
  if (items.length === 0) return fallback
  const lock = fillTokens(str(live[0]?.lock) ?? "", tokens) ?? PLACEHOLDER_TEXT
  return { title: "더 깊은 풀이", items, lock, button: str(get(raw, "button")) ?? fallback.button, placeholder: false }
}

/** 엔진 사실 → 문장 선택. 순수 함수(파일 읽기 없음) — 테스트 대상 */
export function selectCopy(raw: RawContent, f: CopyFacts): FreeCopy {
  const dm = dayMasterCopy(raw.dayMaster, f)
  const ty = thisYearCopy(raw.thisYear, f)
  const yearLabel = ty.block.title ?? `${f.thisYear.year}년 ${f.thisYear.ko}(${f.thisYear.hanja})년`

  const sc = itemsOf(raw.shareCard).find((x) => x.stem === f.dayMaster.hanja)
  const nickname = str(sc?.title) ?? dm.nickname ?? `${f.dayMaster.ko}${f.dayMaster.element} 일간`
  const line = str(sc?.line)

  return {
    dayMaster: dm.block,
    dayPillar: dayPillarCopy(raw.dayPillar, f),
    elements: elementsCopy(raw.elements, f),
    thisYear: ty.block,
    thisYearNote: ty.note,
    teaser: teaserCopy(raw.teaser, f, yearLabel),
    share: { nickname, line: line ? firstSentence(line, 60) : PLACEHOLDER_TEXT, placeholder: !line },
    disclaimer: str(get(raw.dayMaster, "disclaimer")) ?? "",
  }
}

/** 공유 카드용 한 줄: 첫 문장(마침표·물음표·느낌표까지), 60자 넘으면 자른다 */
export function firstSentence(text: string, max = 60): string {
  const first = text.split(/\n/)[0].trim()
  const m = first.match(/^.+?[.!?。]/)
  const s = (m ? m[0] : first).trim()
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

/** 공유 카드·OG에서 일간 단위로 별명·한 줄을 얻는다(생년월일 불필요) */
export function shareCopyForDayMaster(raw: RawContent, hanja: string, ko: string, element: ElementKo): FreeCopy["share"] {
  return selectCopy(raw, {
    dayMaster: { hanja, ko, element },
    dayPillar: { hanja: "", ko: "" }, dayBranch: { hanja: "", ko: "" },
    elements: [], hourUnknown: false, thisYear: { year: 0, hanja: "", ko: "" },
  }).share
}
