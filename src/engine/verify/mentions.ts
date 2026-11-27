// 간지 언급 추출 · 십성 이름 찾기 · 글자↔십성 결속 (verify@0.3.0)
// 원리: 특정 예문 꼴을 사전에 넣지 않고, "언급(mention)"과 "십성 이름" 사이의 글을 작은 문법(조사·꾸밈말·괄호·오행 한자·기준틀)으로만
//       채워져 있는지 본다. 사이를 그 문법으로 다 설명할 수 있으면 결속, 아니면 결속하지 않는다.
// 언급의 꼴(형태 무관): 甲 · 甲木 · 甲(갑) · 갑(甲) · 갑목 · 갑목(甲木) · 丙午 · 병오(丙午) · 丙午火 · "일간 경" · 월지·일간 같은 자리 이름
// 기준틀(frame): "庚 일간에게", "庚金인 너에게", "일간 기준으로" — 결속 대상이 아니라 건너뛴다(일간 글자가 끼어도 검사를 멈추지 않는다).
import type { TenGod } from "../rules/types"
import { BRANCH_KO, BRANCHES, findGanzhiTokens, STEM_KO, STEMS, type ChartLetters } from "./letters"

export interface Mention {
  /** 대조할 글자들(기둥이면 천간·지지 둘, "신금"이면 辛·申 둘). 하나라도 맞으면 맞은 것으로 본다 */
  chars: string[]
  index: number
  end: number
  kind: "pillar" | "char" | "slot"
  /** 기둥(2자)인가 */
  pillar: boolean
  /** 자리 이름으로만 말한 언급("월지는 편관") */
  slot?: string
  /** 동음이의 한글 읽기(정화·계수 등) — 십성 이름에 바로 붙을 때만 쓴다 */
  weak?: boolean
}

export interface TenGodName {
  name: string
  index: number
  end: number
}

// ─────────────────────────────────────────── 십성 이름

const TEN_GODS: readonly TenGod[] = ["비견", "겁재", "식신", "상관", "편재", "정재", "편관", "정관", "편인", "정인"]
/** 십성 이름·묶음 이름·한자 표기 → 해당 십성 */
export const TENGOD_NAMES: Record<string, readonly TenGod[]> = {
  ...Object.fromEntries(TEN_GODS.map((t) => [t, [t]])),
  比肩: ["비견"], 劫財: ["겁재"], 食神: ["식신"], 傷官: ["상관"], 偏財: ["편재"], 正財: ["정재"], 偏官: ["편관"], 正官: ["정관"], 偏印: ["편인"], 正印: ["정인"],
  칠살: ["편관"], 七殺: ["편관"], 七煞: ["편관"], 편관살: ["편관"], 효신: ["편인"], 梟神: ["편인"], 도식: ["편인"], 倒食: ["편인"], 인수: ["정인"], 印綬: ["정인"],
  비겁: ["비견", "겁재"], 比劫: ["비견", "겁재"], 식상: ["식신", "상관"], 食傷: ["식신", "상관"], 재성: ["편재", "정재"], 財星: ["편재", "정재"],
  관성: ["편관", "정관"], 官星: ["편관", "정관"], 관살: ["편관", "정관"], 官殺: ["편관", "정관"], 인성: ["편인", "정인"], 印星: ["편인", "정인"],
}
const NAME_ALT = Object.keys(TENGOD_NAMES).sort((a, b) => b.length - a.length).join("|")
/**
 * 십성 이름이 일반어로 쓰인 꼴 제외: 상관없다·상관하지·상관이 있다(관계), 식상하다(진부), 비견되다(견주다), 관성의 법칙, 정인군자,
 * 그리고 격국 이름(정관격 — 글자의 십성이 아니라 사주 전체의 격).
 */
const NAME_RE = new RegExp(
  `(?<![가-힣])(${NAME_ALT})(?!\\s?없|하[지고는니면여였기게]|해[서도야]|했|이\\s?없|이\\s?있|은\\s?없|도\\s?없|관계|념|격|格|되|될|된|할\\s?만|한\\s?[가-힣]|의 법칙|군자|교육)`,
  "g",
)

export function findTenGodNames(text: string): TenGodName[] {
  const out: TenGodName[] = []
  for (const m of text.matchAll(NAME_RE)) out.push({ name: m[1], index: m.index ?? 0, end: (m.index ?? 0) + m[1].length })
  return out
}

// ─────────────────────────────────────────── 간지 언급

const STEM_SET = new Set<string>(STEMS)
const ELEMENT_OF_STEM: Record<string, string> = { 甲: "목", 乙: "목", 丙: "화", 丁: "화", 戊: "토", 己: "토", 庚: "금", 辛: "금", 壬: "수", 癸: "수" }
const ELEMENT_OF_BRANCH: Record<string, string> = { 子: "수", 丑: "토", 寅: "목", 卯: "목", 辰: "토", 巳: "화", 午: "화", 未: "토", 申: "금", 酉: "금", 戌: "토", 亥: "수" }

/**
 * 한글 오행 읽기(한 글자 + 오행) — 글자의 오행과 붙은 오행이 맞을 때만(갑목 ○, 갑화 ×). 사전이 아니라 계산으로 만든다.
 * 일반어와 겹치는 것(정화 淨化·계수 係數·자수 刺繡·해수 海水·묘목 苗木·사화 士禍·인목)은 weak.
 */
const READINGS: Map<string, string[]> = (() => {
  const m = new Map<string, string[]>()
  const add = (k: string, c: string) => m.set(k, [...(m.get(k) ?? []), c])
  STEMS.forEach((s, i) => add(STEM_KO[i] + ELEMENT_OF_STEM[s], s))
  BRANCHES.forEach((b, i) => add(BRANCH_KO[i] + ELEMENT_OF_BRANCH[b], b))
  return m
})()
const READING_SYLLABLES = new Set([...STEM_KO, ...BRANCH_KO, ..."목화토금수"])
const WEAK_READINGS = new Set(["정화", "계수", "자수", "해수", "묘목", "사화", "인목", "신금"])
const READING_RE = new RegExp(`(?<![가-힣])(${[...READINGS.keys()].join("|")})(?=[^가-힣]|$|[은는이가을를의와과도로에만])`, "g")

/** 자리 이름 → (원국 자리, 천간/지지/기둥) */
const SLOT_WORDS: Record<string, { pos: "year" | "month" | "day" | "hour"; part: "stem" | "branch" | "pillar" }> = {
  연간: { pos: "year", part: "stem" }, 년간: { pos: "year", part: "stem" }, 월간: { pos: "month", part: "stem" }, 일간: { pos: "day", part: "stem" },
  연지: { pos: "year", part: "branch" }, 년지: { pos: "year", part: "branch" }, 월지: { pos: "month", part: "branch" }, 일지: { pos: "day", part: "branch" }, 시지: { pos: "hour", part: "branch" },
  연주: { pos: "year", part: "pillar" }, 년주: { pos: "year", part: "pillar" }, 월주: { pos: "month", part: "pillar" }, 일주: { pos: "day", part: "pillar" }, 시주: { pos: "hour", part: "pillar" },
}
const SLOT_RE = /(?<![가-힣])(연간|년간|월간|일간|연지|년지|월지|일지|시지|연주|년주|월주|일주|시주)/g
/** 자리 이름 뒤 한글 한 글자("일간 경", "월지 사는") */
const SLOT_SYLLABLE_RE = /^\s?(?:은|는|이|가|의|인)?\s?([갑을병정무기경신임계자축인묘진사오미신유술해])(?=[은는이가의도와과로만]?(?:[^가-힣]|$))/

function slotChars(word: string, letters: ChartLetters | undefined): string[] {
  const s = SLOT_WORDS[word]
  if (!s || !letters) return []
  const p = letters.natal[s.pos]
  if (!p) return []
  return s.part === "stem" ? [p.stem] : s.part === "branch" ? [p.branch] : [p.stem, p.branch]
}

/**
 * 문장의 모든 천간·지지 언급(형태 무관). 겹치거나 괄호로 이어진 언급은 하나로 합친다("경금(庚金)" = 한 언급).
 * letters가 있으면 자리 이름만으로 말한 언급("월지는 편관")도 원국 글자로 바꿔 넣는다.
 */
export function findMentions(text: string, letters?: ChartLetters): Mention[] {
  const raw: Mention[] = []
  for (const t of findGanzhiTokens(text)) {
    raw.push({ chars: [...t.value], index: t.index, end: t.index + t.length, kind: t.kind === "char" ? "char" : "pillar", pillar: t.value.length === 2 })
  }
  for (const m of text.matchAll(READING_RE)) {
    const i = m.index ?? 0
    if (raw.some((r) => r.index <= i && r.end > i)) continue
    raw.push({ chars: READINGS.get(m[1])!, index: i, end: i + m[1].length, kind: "char", pillar: false, weak: WEAK_READINGS.has(m[1]) && m[1] !== "신금" })
  }
  // 자리 이름 + 한글 한 글자("일간 경", "월지 사")
  for (const m of text.matchAll(SLOT_RE)) {
    const i = m.index ?? 0
    const w = m[1]
    const after = text.slice(i + w.length, i + w.length + 6)
    const sm = SLOT_SYLLABLE_RE.exec(after)
    const part = SLOT_WORDS[w].part
    if (sm && part !== "pillar") {
      const ko = sm[1]
      const at = i + w.length + sm[0].length - 1
      const idxS = STEM_KO.indexOf(ko)
      const idxB = BRANCH_KO.indexOf(ko)
      const c = part === "stem" ? (idxS >= 0 ? STEMS[idxS] : null) : idxB >= 0 ? BRANCHES[idxB] : null
      // 한자로 바로 뒤에 적었으면(일간 경(庚)) 한자 언급이 이미 있다
      if (c && !raw.some((r) => r.index >= at && r.index <= at + 2)) raw.push({ chars: [c], index: i, end: at + 1, kind: "char", pillar: false })
      continue
    }
    raw.push({ chars: slotChars(w, letters), index: i, end: i + w.length, kind: "slot", pillar: part === "pillar", slot: w })
  }
  raw.sort((a, b) => a.index - b.index || b.end - a.end)

  // 꼴 넓히기: 뒤에 붙은 오행 한자·한글 오행·괄호 읽기, 앞의 "한글(" 읽기
  for (const m of raw) {
    if (m.kind === "slot") continue
    // 앞: "경(庚)", "병오(丙午)", "경금(庚金)" — 괄호 안 한자 언급이면 괄호 앞 한글까지
    const before = text.slice(Math.max(0, m.index - 5), m.index)
    const pb = /([가-힣]{1,3})\s?[(（]\s?$/.exec(before)
    // 괄호 앞 한글이 간지·오행 읽기일 때만("경(庚)", "병오(丙午)", "경금(庚金)") — "2027년(戊申)"의 '년'은 아니다
    if (pb && [...pb[1]].every((c) => READING_SYLLABLES.has(c))) m.index -= pb[0].length
    else if (pb) pb.length = 0
    let rest = text.slice(m.end, m.end + 12)
    const ext = /^(?:\s?[木火土金水](?![一-鿿]))?(?:\s?[(（][^()（）]{1,8}[)）])?(?:\s?[木火土金水](?![一-鿿]))?/.exec(rest)
    if (ext && ext[0]) {
      m.end += ext[0].length
      rest = text.slice(m.end, m.end + 12)
    }
    // 괄호 안에서 끝난 언급("경(庚" 다음 ")")
    if (/^[)）]/.test(rest) && pb && pb.length) m.end += 1
  }
  // 겹침 합치기
  const out: Mention[] = []
  for (const m of raw) {
    const last = out[out.length - 1]
    if (last && m.index < last.end) {
      if (m.kind !== "slot" || last.kind === "slot") {
        for (const c of m.chars) if (!last.chars.includes(c)) last.chars.push(c)
        last.end = Math.max(last.end, m.end)
        last.weak = last.weak && m.weak
        last.pillar = last.pillar || m.pillar
        if (last.kind === "slot" && m.kind !== "slot") {
          last.kind = m.kind
          last.slot = undefined
        }
      }
      continue
    }
    out.push({ ...m, chars: [...m.chars] })
  }
  // 자리 이름 바로 뒤에 글자가 오면("월지 巳는", "일주 庚辰") 자리 이름은 꾸밈말 — 글자 언급에 흡수
  const merged: Mention[] = []
  for (let i = 0; i < out.length; i++) {
    const m = out[i]
    const n = out[i + 1]
    if (m.kind === "slot" && n && n.kind !== "slot" && /^\s?(?:의|인|은|는|이|가|:)?\s?$/.test(text.slice(m.end, n.index))) {
      merged.push({ ...n, index: m.index })
      i++
      continue
    }
    // 글자 바로 뒤의 자리 이름("辛未일주", "巳 월지")은 같은 언급
    if (m.kind !== "slot" && n && n.kind === "slot" && /^\s?$/.test(text.slice(m.end, n.index))) {
      merged.push({ ...m, end: n.end })
      i++
      continue
    }
    merged.push(m)
  }
  return merged.filter((m) => m.chars.length > 0)
}

// ─────────────────────────────────────────── 결속 문법

/** 언급 바로 뒤의 기준틀 꼬리("일간에게", "인 너에게", "기준으로") */
const FRAME_AFTER_RE =
  /^[)）]?\s?(?:일간|일주|일원|일간인 너|인 너|인 네|인 당신|일간인 네)?\s?(?:에게|에겐|에게는|에게서 보면|한테|한텐|한테는|기준으로|기준에서|기준|입장에서|으로 보면|로 보면|에서 보면|을 기준으로|를 기준으로|의 눈으로 보면|의 눈엔|의 자리에서)(?=[\s,]|$)/
/** 자리 이름 없이 쓴 기준틀("일간에게", "너한테", "나를 기준으로") */
const BARE_FRAME_RE = /(?:일간|너|네|나|당신|이 사주|네 사주)(?:에게|에겐|에게는|한테|한테는|기준으로|입장에서|을 기준으로|를 기준으로)/g

const GAP_A_RE = new RegExp(
  "^\\s*(?:[(（][^()（）]{0,10}[)）])?\\s*(?:[木火土金水](?:\\s?기운)?)?\\s*(?:[(（][^()（）]{0,10}[)）])?\\s*" +
    "(?:기운|글자|한 글자|자리|오행|대운|세운|운)?\\s*" +
    "(?:은|는|이|가|도|만|의|을|를|이야말로|이란|란|이라는|라는|=|:|：|—|–|-|→|,|[(（])?\\s*" +
    "(?:(?:곧|바로|역시|결국|분명|딱|모두|둘 다|다|그대로|확실히)\\s*)?" +
    "(?:(?:너|네|너의|네게|너에게|너한테|너에겐|네겐|너에게는|이 사주에서|네 사주에서|사주에서|원국에서|여기서|여기선|이 자리에서)\\s*)?" +
    "(?:(?:곧|바로|역시|결국|분명|모두)\\s*)?(?:(?:나|너|네|당신)\\s?)?[(（]?\\s*$",
)
/** 언급 뒤 을/를 → 십성 뒤 "으로 본다" 꼴만 결속 */
const OBJ_PARTICLE_RE = /(?:을|를)\s*$/
const AS_PRED_RE = /^\s?(?:성|살)?\s?(?:으로|로)\s?(?:본|보|읽|친|치|여기|삼|부르|불러|쓴|써|해석)/

const GAP_B_RE =
  /^\s*(?:성|살|星)?\s*(?:인|이자|이란|이라는|라는|으로 오는|으로 들어오는|으로 들어온|으로 온|로 오는|이 되는|가 되는|에 해당하는|노릇을 하는|자리의|자리에 앉은|자리인|=|:|：|—|–|-|→|,|[(（])?\s*(?:글자(?:인|로|는)?\s*)?[(（]?\s*$/
const GAP_B_TOPIC_RE = /^\s*(?:성|살|星)?\s*(?:은|는|이|가)\s*(?:바로|곧)?\s*$/
const COPULA_AFTER_RE = /^\s?(?:[木火土金水])?\s?(?:[(（][^)）]{0,10}[)）])?\s?(?:이다|다(?![가-힣])|이야|야(?![가-힣])|이고|이며|이라|라서|이니|이란다|란다|이지|이요|요(?![가-힣])|[,.]|$)/

/** 주제-설명 꼴("丙火는 너를 다듬는 불이라 편관이다")에서 십성 이름 뒤에 와야 하는 서술 */
const PRED_C_RE =
  /^\s?(?:성|살)?\s?(?:이다|다(?![가-힣])|이야|야(?![가-힣])|이고|이며|이라|라서|이니|이란다|란다|이지|에 해당|노릇|역할|구실|(?:으로|로)\s?(?:본|보|읽|친|치|여기|삼)|이 된다|가 된다|이 되|가 되|의 글자|자리다|자리이|에 속)/
const TOPIC_AFTER_RE = /^\s?(?:[木火土金水])?\s?(?:[(（][^)）]{0,10}[)）])?\s?(?:기운|글자)?\s?(?:은|는|이|가|도)(?![가-힣])/
const COORD_RE = /^\s*(?:[木火土金水])?\s*(?:[(（][^)）]{0,10}[)）])?\s*(?:와|과|,|·|이나|나|하고|및|그리고|랑|이랑)\s*$/
const NEGATED_AFTER_RE = /^\s?(?:성|살)?\s?(?:이|가|은|는)?\s?(?:아니|아냐|아님)/

export interface Binding {
  name: TenGodName
  mentions: Mention[]
  form: "A" | "B" | "C"
}

function isFrame(text: string, m: Mention): number {
  const f = FRAME_AFTER_RE.exec(text.slice(m.end, m.end + 14))
  return f ? f[0].length : 0
}

/** 기준틀(언급+꼬리, 맨 기준틀)을 지운 사이 글 */
function gapWithoutFrames(text: string, from: number, to: number, mentions: Mention[]): string {
  let s = ""
  let i = from
  for (const m of mentions) {
    if (m.index < from || m.end > to) continue
    const fl = isFrame(text, m)
    if (!fl) continue
    s += text.slice(i, m.index)
    i = Math.min(to, m.end + fl)
  }
  s += text.slice(i, to)
  return s.replace(BARE_FRAME_RE, " ").replace(/\s{2,}/g, " ")
}

/**
 * 문장 하나에서 글자↔십성 결속을 찾는다.
 * A 글자→이름: 사이가 결속 문법(GAP_A)으로만 채워짐 — 기준틀 언급은 건너뛰고 앞 언급으로 넘어간다. "丙과 丁은 관성"처럼 나열도 함께 묶는다.
 * B 이름→글자: "정관인 酉", "편관(丙)", "편관은 丙이다"(뒤에 서술격이 올 때만)
 * C 주제-설명: 이름 뒤에 "~이다/~에 해당/~노릇" 서술이 오고, 앞쪽 가장 가까운 주제 언급("丙火는 …")에 묶는다.
 *   일간 글자가 주제이고 비견·비겁이 아닌 이름이면 묶지 않는다("庚金은 丙을 만나 편관이 된다"는 일간의 십성 주장이 아님).
 */
export function bindTenGods(text: string, mentions: Mention[], dayStem: string | null): Binding[] {
  const names = findTenGodNames(text)
  const out: Binding[] = []
  for (const nm of names) {
    if (NEGATED_AFTER_RE.test(text.slice(nm.end, nm.end + 6))) continue
    const before = mentions.filter((m) => m.end <= nm.index).reverse()
    // A
    let boundA: Mention[] = []
    for (const m of before) {
      if (names.some((o) => o !== nm && o.index >= m.end && o.end <= nm.index)) break
      if (isFrame(text, m)) continue
      const gap = gapWithoutFrames(text, m.end, nm.index, mentions)
      if (!GAP_A_RE.test(gap)) break
      if (m.weak && gap.trim().length > 2) break
      if (OBJ_PARTICLE_RE.test(gap.trim()) && !AS_PRED_RE.test(text.slice(nm.end, nm.end + 10))) break
      boundA = [m]
      // 나열("辛과 酉는 겁재")
      let cur = m
      for (const p of before.slice(before.indexOf(m) + 1)) {
        if (COORD_RE.test(text.slice(p.end, cur.index))) {
          boundA.push(p)
          cur = p
        } else break
      }
      break
    }
    if (boundA.length) {
      out.push({ name: nm, mentions: boundA, form: "A" })
      continue
    }
    // B
    const after = mentions.find((m) => m.index >= nm.end)
    if (after && !names.some((o) => o.index >= nm.end && o.end <= after.index)) {
      const gap = text.slice(nm.end, after.index)
      const ok = GAP_B_RE.test(gap) || (GAP_B_TOPIC_RE.test(gap) && COPULA_AFTER_RE.test(text.slice(after.end, after.end + 14)))
      if (ok && (!after.weak || gap.trim().length <= 2)) {
        out.push({ name: nm, mentions: [after], form: "B" })
        continue
      }
    }
    // C
    if (!PRED_C_RE.test(text.slice(nm.end, nm.end + 10))) continue
    const claimed = TENGOD_NAMES[nm.name]
    for (const m of before) {
      if (nm.index - m.end > 40) break
      if (names.some((o) => o !== nm && o.index >= m.end && o.end <= nm.index)) break
      if (m.weak || isFrame(text, m)) continue
      if (!TOPIC_AFTER_RE.test(text.slice(m.end, m.end + 12))) continue
      if (m.chars.length === 1 && m.chars[0] === dayStem && !claimed.every((t) => t === "비견" || t === "겁재")) break
      out.push({ name: nm, mentions: [m], form: "C" })
      break
    }
  }
  // 약한(동음이의) 읽기는 이름에 바로 붙은 A·B 결속에서만 쓴다
  return out.filter((b) => b.form !== "C" || b.mentions.every((m) => !m.weak))
}

export const isStem = (c: string) => STEM_SET.has(c)
