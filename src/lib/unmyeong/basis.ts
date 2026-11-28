// 「할미는 어떻게 알았을까?」 근거 — 규칙 엔진(analyzeRules) 결과를 화면용 쉬운 말 + 한자 한글 병기로 옮긴다.
// 원칙: 새 판정을 만들지 않는다(옮기기·정렬·비율 반올림만). 신강약·격국·용신 표시 정책은 콘텐츠 사실표(facts.ts)와 같다:
//   - 용신은 관점별 병기(하나로 합치지 않음), 특수격 관점·특수격 후보는 대표 결정(D4) 전이라 싣지 않는다.
//   - 보는 방식(모형·지장간 표·시각)에 따라 갈리면 sensitive=true로 알린다.
// 쉬운 말 사전: 십성 그림 말은 plain-words.ts(TENGOD_PICTURE, voice-guide §6-1)를 그대로 쓴다.
import type { Element, RuleAnalysis, StrengthVerdict, TenGod, TenGodGroup } from "@/engine"
import { TENGOD_PICTURE } from "@/engine/content/prompts/plain-words"
import { USEFUL_GOD_EXCLUDED, USEFUL_GOD_HEADER } from "@/engine/content/facts"
import { ganzhiView } from "@/app/free/_lib/ganzhi"
import type { BasisElement, BasisElementRef, BasisTenGodAt, BasisTenGodGroup, ElementKo, TermLabel, UnmyeongBasis } from "./free-types"

const EL_ORDER: readonly Element[] = ["wood", "fire", "earth", "metal", "water"]
const EL_LABEL: Record<Element, { ko: ElementKo; hanja: string; plain: string }> = {
  wood: { ko: "목", hanja: "木", plain: "나무" },
  fire: { ko: "화", hanja: "火", plain: "불" },
  earth: { ko: "토", hanja: "土", plain: "흙" },
  metal: { ko: "금", hanja: "金", plain: "쇠" },
  water: { ko: "수", hanja: "水", plain: "물" },
}

const TENGOD_HANJA: Record<TenGod, string> = {
  비견: "比肩", 겁재: "劫財", 식신: "食神", 상관: "傷官", 편재: "偏財",
  정재: "正財", 편관: "偏官", 정관: "正官", 편인: "偏印", 정인: "正印",
}
const TENGOD_ORDER = Object.keys(TENGOD_HANJA) as TenGod[]

const GROUP_LABEL: Record<TenGodGroup, { ko: string; hanja: string; pictureKey: string }> = {
  bigyeop: { ko: "비겁", hanja: "比劫", pictureKey: "비겁" },
  inseong: { ko: "인성", hanja: "印星", pictureKey: "인성" },
  siksang: { ko: "식상", hanja: "食傷", pictureKey: "식상" },
  jaeseong: { ko: "재성", hanja: "財星", pictureKey: "재성" },
  gwansal: { ko: "관성", hanja: "官星", pictureKey: "관성" },
}
const GROUP_ORDER: readonly TenGodGroup[] = ["bigyeop", "inseong", "siksang", "jaeseong", "gwansal"]

const STRENGTH_LABEL: Record<StrengthVerdict, TermLabel> = {
  신강: { ko: "신강", hanja: "身强", plain: "스스로 힘이 넉넉한 편" },
  중화: { ko: "중화", hanja: "中和", plain: "힘이 어느 한쪽으로 크게 기울지 않은 편" },
  신약: { ko: "신약", hanja: "身弱", plain: "둘레 기운이 더 커서 스스로 힘은 덜한 편" },
}
const STRENGTH_MODEL_NAME: Record<"weighted" | "threeFactor" | "rooted", string> = {
  weighted: "가중 점수로 보면",
  threeFactor: "득령·득지·득세로 보면",
  rooted: "뿌리까지 따져 보면",
}

/** 격국 이름 한자(규칙 엔진 structure.ts의 정격·록겁격 이름) */
const STRUCTURE_HANJA: Record<string, string> = {
  정관격: "正官格", 칠살격: "七殺格", 정재격: "正財格", 편재격: "偏財格", 정인격: "正印格", 편인격: "偏印格",
  식신격: "食神格", 상관격: "傷官格", 비견격: "比肩格", 겁재격: "劫財格", 건록격: "建祿格", 양인격: "羊刃格", 월겁격: "月劫格",
}

const round3 = (n: number) => Math.round(n * 1000) / 1000

const tenGodLabel = (t: TenGod): TermLabel => ({ ko: t, hanja: TENGOD_HANJA[t], plain: TENGOD_PICTURE[t] ?? t })
const elRef = (e: Element): BasisElementRef => ({ el: EL_LABEL[e].ko, ko: EL_LABEL[e].ko, hanja: EL_LABEL[e].hanja, plain: EL_LABEL[e].plain })

export const BASIS_CAVEATS: readonly string[] = [
  "여기 적힌 것은 만세력 계산과 명리 규칙으로 뽑은 해석 재료다. 앞날을 정해 주는 답이 아니다.",
  "같은 사주라도 보는 방식(학파)에 따라 판정이 갈릴 수 있다. 갈리는 곳은 따로 적어 두었다.",
]

/** 규칙 엔진 결과 → 근거 화면 값 */
export function buildBasis(rules: RuleAnalysis): UnmyeongBasis {
  const natal = rules.source.natal
  const views = {
    year: ganzhiView(natal.year.stem + natal.year.branch),
    month: ganzhiView(natal.month.stem + natal.month.branch),
    day: ganzhiView(natal.day.stem + natal.day.branch),
    hour: natal.hour ? ganzhiView(natal.hour.stem + natal.hour.branch) : null,
  }
  const day = views.day
  if (!day) throw new Error("일주 간지 변환 실패")

  // 십성 — 원국 겉 글자(천간·지지 정기 판정)와 지장간만
  const natalHits = rules.tenGods.filter((h) => h.position.pillar !== "daeun" && h.position.pillar !== "seun")
  const positions: BasisTenGodAt[] = []
  for (const h of natalHits) {
    if (h.viaHiddenStem) continue
    const pillar = h.position.pillar as BasisTenGodAt["pillar"]
    const v = views[pillar]
    if (!v) continue
    const part = h.position.part
    positions.push({
      pillar,
      part,
      char: part === "stem" ? v.stemHanja : v.branchHanja,
      charKo: part === "stem" ? v.stemKo : v.branchKo,
      tenGod: tenGodLabel(h.tenGod),
    })
  }
  const surface = new Set(positions.map((p) => p.tenGod.ko))
  const hiddenOnly = TENGOD_ORDER.filter((t) => !surface.has(t) && natalHits.some((h) => h.viaHiddenStem && h.tenGod === t)).map(tenGodLabel)

  const totals = rules.strength.groupTotals
  const sum = GROUP_ORDER.reduce((a, g) => a + (totals[g] ?? 0), 0)
  const groups: BasisTenGodGroup[] = GROUP_ORDER.map((g) => ({
    group: g,
    ko: GROUP_LABEL[g].ko,
    hanja: GROUP_LABEL[g].hanja,
    plain: TENGOD_PICTURE[GROUP_LABEL[g].pictureKey] ?? GROUP_LABEL[g].ko,
    share: sum > 0 ? round3((totals[g] ?? 0) / sum) : 0,
  }))

  // 오행
  const items: BasisElement[] = EL_ORDER.map((e) => ({
    el: EL_LABEL[e].ko,
    ko: EL_LABEL[e].ko,
    hanja: EL_LABEL[e].hanja,
    plain: EL_LABEL[e].plain,
    count: rules.elements.counts[e] ?? 0,
    share: round3(rules.qiFlow.shares[e] ?? 0),
  }))

  // 신강약
  const s = rules.strength
  const primary = s.models.find((m) => m.model === s.primary) ?? s.models[0]
  const strengthNotes: string[] = []
  if (s.agreement === "split") strengthNotes.push("셈법(모형)마다 판정이 다르다 — 대표 셈법의 판정을 보였다.")
  if (s.tableSensitive) strengthNotes.push("땅 글자 속 기운(지장간)을 나누는 표에 따라 판정이 달라진다.")
  if (s.hourSensitivity?.hourSensitive) strengthNotes.push("태어난 시각을 몰라, 시각에 따라 판정이 달라질 수 있다.")
  if (primary?.nearBoundary) strengthNotes.push("판정 경계에 가까워 한쪽으로 단정하기 어렵다.")

  // 격국 — 주 후보만(특수격 후보 제외)
  const main = rules.structure.candidates.find((c) => c.role === "primary" && c.kind !== "special") ?? null
  let structure: UnmyeongBasis["structure"] = null
  if (main) {
    const notes: string[] = []
    if (rules.structure.tableSensitive) notes.push("지장간 표에 따라 격 이름이 달라진다.")
    if (main.variantAgreement === "differs") notes.push("드러난 글자를 먼저 보느냐, 달의 본기운을 보느냐에 따라 격 이름이 달라진다.")
    if (rules.omitted.includes("hour")) notes.push("태어난 시각을 몰라 시주 없이 잡은 격이다.")
    const pivot = main.pivot?.tenGod
    structure = {
      name: main.name,
      label: {
        ko: main.name,
        hanja: STRUCTURE_HANJA[main.name] ?? "",
        plain: pivot
          ? `태어난 달의 중심 기운이 '${TENGOD_PICTURE[pivot] ?? pivot}'(${pivot})로 잡힌 짜임`
          : "태어난 달의 중심 기운으로 잡은 짜임",
      },
      confidence: main.confidence,
      sensitive: notes.length > 0,
      notes,
    }
  }

  // 용신 — 관점별 1순위, 병기
  const usefulGods: UnmyeongBasis["usefulGods"] = []
  for (const v of rules.usefulGods.views) {
    if (v.status !== "ok" || USEFUL_GOD_EXCLUDED.includes(v.method)) continue
    const first = v.candidates.find((c) => c.rank === 1) ?? v.candidates[0]
    if (!first) continue
    usefulGods.push({ method: v.method, header: USEFUL_GOD_HEADER[v.method] ?? v.label, element: elRef(first.element) })
  }

  return {
    rulesVersion: rules.engineVersion,
    dayMaster: {
      char: day.stemHanja,
      charKo: day.stemKo,
      element: day.element,
      label: { ko: "일간", hanja: "日干", plain: "너 자신을 뜻하는 글자" },
    },
    tenGods: { positions, hiddenOnly, groups },
    elements: {
      items,
      dominant: EL_LABEL[rules.qiFlow.dominant.element].ko,
      missing: EL_ORDER.filter((e) => rules.qiFlow.missing.includes(e)).map((e) => EL_LABEL[e].ko),
    },
    strength: {
      verdict: primary.verdict,
      label: STRENGTH_LABEL[primary.verdict],
      models: s.models.map((m) => ({ model: m.model, name: STRENGTH_MODEL_NAME[m.model], verdict: m.verdict })),
      sensitive: strengthNotes.length > 0,
      notes: strengthNotes,
    },
    structure,
    usefulGods,
    caveats: [...BASIS_CAVEATS],
  }
}
