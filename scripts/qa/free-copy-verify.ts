// 무료 문안(content/free/*.json) → 검증기(verifyReading) 측정 — 품질검증 담당(qa-security-lead)
// 검증기·문안을 고치지 않는다. 측정만 한다. 호출: tests/content-qa/free-verify.test.ts
//
// 단위(문안 1건 = 풀이 JSON 1개 = verifyReading 1회). 칸 배치는 화면 조립(src/app/free/_lib/content.ts selectCopy)을 따른다:
//   day-master(10): title→title, hook→sub, body→body, strength·blindSpot→details[].text(서술), bokja→bokja(서술 아님)
//   day-pillar(60): label→title, oneLiner→sub, detail→body
//   elements(10 일간 × 5 오행 × 3 종류, 자기 오행 lack 제외 = 140): text→body, tenGodLine(+묶음 문장)→details[].text, prescription→todo
//   this-year(연도 × 일간 10): line(+해당 일지 덧줄) → body. 일지 덧줄은 그 일지를 가진 일주(일간 같은 것 중 첫째)로 단위 1개씩 더
//   teaser(60 일주): 보이는 항목(needsConfirm≠true) preview→items[].text, lock→lock
//   share-card(10): line→body
// sajuInput: 그 문안이 가리키는 글자만 넣는다(연·월·일주를 같은 기둥으로, 시주 모름) — 다른 글자를 채워 넣어 BASIS 검사를 가리지 않게.
import { readFileSync } from "node:fs"
import path from "node:path"
import { verifyReading, collectSegments, splitSentences, type VerifyReport } from "@/engine/verify"
import { hasBasisMarker } from "@/engine/verify/checks/barnum"
import { BRANCH_PICTURE, POSITION_PICTURE, RELATION_PICTURE, STEM_PICTURE, TENGOD_PICTURE } from "@/engine/content/prompts/plain-words"

type J = Record<string, unknown>
const STEMS = "甲乙丙丁戊己庚辛壬癸"
const BRANCHES = "子丑寅卯辰巳午未申酉戌亥"
const KO_STEM: Record<string, string> = { 甲: "갑", 乙: "을", 丙: "병", 丁: "정", 戊: "무", 己: "기", 庚: "경", 辛: "신", 壬: "임", 癸: "계" }
const KO_BRANCH: Record<string, string> = { 子: "자", 丑: "축", 寅: "인", 卯: "묘", 辰: "진", 巳: "사", 午: "오", 未: "미", 申: "신", 酉: "유", 戌: "술", 亥: "해" }
const STEM_EL: Record<string, string> = { 甲: "wood", 乙: "wood", 丙: "fire", 丁: "fire", 戊: "earth", 己: "earth", 庚: "metal", 辛: "metal", 壬: "water", 癸: "water" }
const JZ = Array.from({ length: 60 }, (_, k) => STEMS[k % 10] + BRANCHES[k % 12])

export interface Unit {
  file: string
  id: string
  pillar: string
  reading: J
  thisYear?: { year: number; ganzhi: string }
}

const s = (v: unknown) => (typeof v === "string" ? v : "")
const fill = (t: string, tk: Record<string, string>) => {
  let miss = false
  const out = t.replace(/\{(\w+)\}/g, (_m, k: string) => (tk[k] === undefined ? ((miss = true), "") : tk[k]))
  return miss ? null : out
}
const one = (title: string, ch: J): J => ({ parts: [{ title, chapters: [{ title, ...ch }] }] })

export function buildUnits(dir: string): Unit[] {
  const load = (f: string) => JSON.parse(readFileSync(path.join(dir, `${f}.json`), "utf8")) as J
  const units: Unit[] = []
  const dm = load("day-master"), dp = load("day-pillar"), el = load("elements"), ty = load("this-year"), tz = load("teaser"), sc = load("share-card")

  for (const it of dm.items as J[]) {
    const stem = s(it.stem)
    const pillar = JZ.find((p) => p[0] === stem)!
    units.push({
      file: "day-master", id: stem, pillar,
      reading: one(s(it.title), {
        sub: s(it.hook), body: [s(it.body)],
        details: [{ label: "강점", text: s(it.strength) }, { label: "조심할 점", text: s(it.blindSpot) }],
        bokja: s(it.bokja),
      }),
    })
  }
  for (const it of dp.items as J[]) {
    units.push({ file: "day-pillar", id: s(it.pillar), pillar: s(it.pillar), reading: one(s(it.label), { sub: s(it.oneLiner), body: [s(it.detail)] }) })
  }
  const groups = el.tenGodGroups as J, byDm = el.groupByDayMasterElement as J, numerals = el.numerals as J
  for (const stem of STEMS) {
    const dmEl = STEM_EL[stem]
    const pillar = JZ.find((p) => p[0] === stem)!
    for (const item of el.items as J[]) {
      for (const kind of ["excess", "lack", "balanced"] as const) {
        if (kind === "lack" && item.element === dmEl) continue
        const sect = item[kind] as J | undefined
        if (!sect) continue
        const group = s((byDm[dmEl] as J)[s(item.element)])
        const g = groups[group] as J
        const n = kind === "lack" ? s(numerals["0"]) || "없음" : kind === "excess" ? s(numerals["4"]) : s(numerals["2"])
        const tk = { letters: "여덟 글자", n, dayStem: `${KO_STEM[stem]}(${stem})`, elementName: s(item.name), group, gloss: s(g?.gloss) }
        const line = fill(s(el.tenGodLineTemplate), tk)
        const gText = kind === "balanced" ? "" : s(g?.[kind])
        units.push({
          file: "elements", id: `${stem}/${s(item.element)}/${kind}`, pillar,
          reading: one(`${s(item.name)} ${kind}`, {
            body: [fill(s(sect.text), tk) ?? ""],
            details: line ? [{ label: "나와의 사이로 보면", text: gText ? `${line} ${gText}` : line }] : [],
            todo: fill(s(sect.prescription), tk) ?? "",
          }),
        })
      }
    }
  }
  for (const y of ty.years as J[]) {
    const year = Number(y.year), ganzhi = s(y.ganzhi)
    const extras = (y.dayBranch as J[] | undefined) ?? []
    for (const e of y.byDayMaster as J[]) {
      const stem = s(e.stem)
      const pillar = JZ.find((p) => p[0] === stem)!
      units.push({ file: "this-year", id: `${year}/${stem}`, pillar, thisYear: { year, ganzhi }, reading: one(s(y.label), { body: [s(e.line)], note: s(ty.disclaimer) }) })
    }
    for (const x of extras) {
      const branch = s(x.branch)
      const pillar = JZ.find((p) => p[1] === branch)!
      const line = s((y.byDayMaster as J[]).find((e) => e.stem === pillar[0])?.line)
      units.push({ file: "this-year", id: `${year}/일지${branch}`, pillar, thisYear: { year, ganzhi }, reading: one(s(y.label), { body: [`${line}\n${s(x.line)}`] }) })
    }
  }
  const wealth = tz.wealthByDayMasterElement as J
  const live = (tz.items as J[]).filter((x) => x.needsConfirm !== true)
  const y0 = (ty.years as J[])[0]
  for (const pillar of JZ) {
    const tk = {
      dayStem: `${KO_STEM[pillar[0]]}(${pillar[0]})`, dayBranch: `${KO_BRANCH[pillar[1]]}(${pillar[1]})`,
      dayPillar: `${KO_STEM[pillar[0]]}${KO_BRANCH[pillar[1]]}(${pillar})`, wealth: s(wealth[STEM_EL[pillar[0]]]), yearLabel: s(y0?.label), letters: "여덟 글자",
    }
    units.push({
      file: "teaser", id: pillar, pillar, thisYear: { year: Number(y0?.year), ganzhi: s(y0?.ganzhi) },
      reading: one("더 깊은 풀이", { items: live.map((x) => ({ name: s(x.menu), text: fill(s(x.preview), tk) ?? "" })), lock: fill(s(live[0]?.lock), tk) ?? "" }),
    })
  }
  for (const it of sc.items as J[]) {
    const stem = s(it.stem)
    units.push({ file: "share-card", id: stem, pillar: JZ.find((p) => p[0] === stem)!, reading: one(s(it.title), { body: [s(it.line)] }) })
  }
  return units
}

export function verifyUnit(u: Unit): VerifyReport {
  return verifyReading(u.reading, {
    sajuInput: {
      pillars: { year: u.pillar, month: u.pillar, day: u.pillar },
      hour_unknown: true,
      ...(u.thisYear ? { this_year: u.thisYear.year, this_year_ganzhi: u.thisYear.ganzhi } : {}),
    },
  })
}

// ─────────────────────────────── 가정 계산: 그림 말 사전을 근거 표지로 센다면(검증기는 그대로, 여기서만 다시 셈)

const relCore = (v: string) => v.split(" — ")[0]!.trim()
/** H1: 사전 문구 전체가 그대로 들어간 경우만 */
export const PICTURE_EXACT: string[] = [
  ...Object.values(STEM_PICTURE),
  ...Object.values(BRANCH_PICTURE).map((b) => b.picture),
  ...Object.values(TENGOD_PICTURE),
  ...Object.values(RELATION_PICTURE).map(relCore),
  ...Object.values(POSITION_PICTURE),
]
/** H2: 그림의 핵심 낱말(계절+물상, 자리 말) — 느슨한 가정. 우회 위험을 보이려고 같이 잰다 */
export const PICTURE_LOOSE_RE =
  /(한겨울|늦겨울|초겨울|이른 봄|늦봄|봄 한복판|초여름|한여름|늦여름|초가을|한가을|늦가을)|큰 나무|풀과 덩굴|등불|밭흙|무쇠|보석|큰 강|이슬|찬물|네가 앉은 자리|너 자신을 뜻하는 글자|태어난 날의 두 글자|열 해마다|그해에 들어오는|손을 잡는|마주 서서 밀치/

export const pictureExact = (t: string) => PICTURE_EXACT.some((p) => t.includes(p))
export const pictureLoose = (t: string) => pictureExact(t) || PICTURE_LOOSE_RE.test(t)

export interface Tally {
  units: number
  block: number
  warn: number
  byCode: Record<string, number>
  barnumRatioUnits: number
  sentences: number
  unmarked: number
  /** 가정: 그림 말을 근거로 셀 때 남는 근거 없는 문장 수 / 비율 경고가 날 단위 수 */
  hyp: { exact: { unmarked: number; ratioUnits: number }; loose: { unmarked: number; ratioUnits: number } }
  blocks: string[]
}

export function tally(units: Unit[], ratioLimit = 0.5): Record<string, Tally> {
  const out: Record<string, Tally> = {}
  const t = (f: string) =>
    (out[f] ??= { units: 0, block: 0, warn: 0, byCode: {}, barnumRatioUnits: 0, sentences: 0, unmarked: 0, hyp: { exact: { unmarked: 0, ratioUnits: 0 }, loose: { unmarked: 0, ratioUnits: 0 } }, blocks: [] })
  for (const u of units) {
    const r = verifyUnit(u)
    for (const key of [u.file, "전체"]) {
      const x = t(key)
      x.units++
      x.block += r.counts.block
      x.warn += r.counts.warn
      for (const f of r.findings) {
        if (f.severity === "info") continue
        const k = `${f.severity}:${f.code}${f.rule ? `/${f.rule}` : ""}`
        x.byCode[k] = (x.byCode[k] ?? 0) + 1
        if (f.severity === "block" && x.blocks.length < 20) x.blocks.push(`${u.file}#${u.id} ${f.code}${f.rule ? `/${f.rule}` : ""}: ${f.excerpt}`)
      }
      if (r.findings.some((f) => f.code === "BARNUM" && f.rule === "ratio")) x.barnumRatioUnits++
      // 문장 다시 세기(검증기와 같은 조각·문장 나누기·근거 표지 함수)
      let total = 0, un = 0, unE = 0, unL = 0
      for (const seg of collectSegments(u.reading)) {
        if (!seg.narrative) continue
        for (const st of splitSentences(seg.text)) {
          total++
          if (hasBasisMarker(st.text)) continue
          un++
          if (!pictureExact(st.text)) unE++
          if (!pictureLoose(st.text)) unL++
        }
      }
      x.sentences += total
      x.unmarked += un
      x.hyp.exact.unmarked += unE
      x.hyp.loose.unmarked += unL
      if (total && unE / total > ratioLimit) x.hyp.exact.ratioUnits++
      if (total && unL / total > ratioLimit) x.hyp.loose.ratioUnits++
    }
  }
  return out
}
