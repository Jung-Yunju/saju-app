// 시기 표현 (verify@0.3.0) — 연도·상대 연도·나이·대운·"몇 해 뒤"·"그해"·간지 해 등
// 1) yearRefs: 문장 속 연도 표현을 실제 연도 숫자로(상대 연도는 사실표의 올해 기준). 연도→간지 대조에 쓴다.
// 2) hasTiming: 금지 주제(죽음·질병·이혼·파산·사고) 시기 예언 판정에 쓰는 넓은 시기 표지.

/** 상대 연도 낱말 → 올해와의 차이 */
const RELATIVE_YEARS: [RegExp, number][] = [
  [/재작년|지지난해|지지난 해|그러께/y, -2],
  [/작년|지난해|지난 해|昨年|지난 한 해|전해(?=[에의는엔])/y, -1],
  [/내후년|후년|다다음 해|다다음해|내명년/y, 2],
  [/내년|명년|來年|다음 해|다음해|오는 해/y, 1],
  [/올해|금년|今年|이번 해|올 한 해|올 한해/y, 0],
]

export interface YearRef {
  year: number
  index: number
  end: number
  kind: "abs" | "rel"
}

const ABS_YEAR_RE = /(?<!\d)(1[89]\d{2}|20\d{2}|2100)(?!\d)(\s*년도?)?/g

/** 문장 속 연도 표현(절대·상대). thisYear가 없으면 상대 연도는 건너뛴다 */
export function yearRefs(text: string, thisYear: number | null): YearRef[] {
  const out: YearRef[] = []
  for (const m of text.matchAll(ABS_YEAR_RE)) {
    const y = Number(m[1])
    // "2,030원", "1990번" 같은 숫자 제외 — 뒤가 년·해 표지거나 간지·쉼표·조사·공백·괄호
    const after = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 2)
    if (!m[2] && /^(\s?[원명개번호층%점]|[.,]\d)/.test(after)) continue
    out.push({ year: y, index: m.index ?? 0, end: (m.index ?? 0) + m[0].length, kind: "abs" })
  }
  if (thisYear !== null)
    for (let i = 0; i < text.length; i++) {
      if (i > 0 && /[가-힣]/.test(text[i - 1])) continue
      for (const [re, d] of RELATIVE_YEARS) {
        re.lastIndex = i
        const m = re.exec(text)
        if (m) {
          out.push({ year: thisYear + d, index: i, end: i + m[0].length, kind: "rel" })
          i += m[0].length - 1
          break
        }
      }
    }
  // "이듬해"·"그다음 해" = 바로 앞에 적은 연도 + 1
  for (const m of text.matchAll(/이듬해|그다음 해|그 이듬해/g)) {
    const prev = out.filter((r) => r.end <= (m.index ?? 0)).sort((a, b) => b.end - a.end)[0]
    if (prev) out.push({ year: prev.year + 1, index: m.index ?? 0, end: (m.index ?? 0) + m[0].length, kind: "rel" })
  }
  return out.sort((a, b) => a.index - b.index)
}

const NUM_KO = "(?:스물|서른|마흔|쉰|예순|일흔|여든|아흔|스무)"
const UNIT_KO = "(?:하나|한|둘|두|셋|세|넷|네|다섯|여섯|일곱|여덟|아홉)?"

/**
 * 시기 표지(금지 주제 시기 예언 판정용). 넓게 잡는다 — 해로운 사건과 함께 단정될 때만 막으므로
 * 시기 표지만으로는 아무것도 막지 않는다.
 */
export const TIMING_SOURCE = [
  "(?<!\\d)(?:1[89]\\d{2}|20\\d{2})(?!\\d)",
  "재작년|작년|지난해|올해|금년|내년|명년|후년|내후년|다음 해|다음해|이듬해|그해|그 해|그다음 해|그 무렵|그즈음|그 즈음|그때|그 시기|그 시절|이맘때|그맘때",
  "몇\\s?(?:해|년|달)\\s?(?:안|뒤|후|지나|만에|사이|내)|\\d{1,2}\\s?(?:해|년|달|개월)\\s?(?:안|뒤|후|지나|만에|사이|내|째)|(?:한두|두세|서너|한|두|세|네)\\s?해\\s?(?:안|뒤|후|지나|만에|사이|내)",
  "머지않아|머잖아|조만간|곧(?=\\s|$)|얼마 (?:안 가|못 가|지나지 않아)|오래지 않아|머지않은",
  `${NUM_KO}${UNIT_KO}\\s?(?:살|세|해)?\\s?(?:에|에는|엔|즈음|무렵|쯤|고개|줄|문턱|을 넘|이 되|이 넘|전후)`,
  "(?<!\\d)\\d{1,3}\\s?(?:살|세)(?!대)",
  "\\d0\\s?대\\s?(?:초|중|후)?반?|환갑|회갑|칠순|팔순|고희|진갑|중년|노년|말년|만년|늘그막|노후에|노년기",
  "대운|세운|운이 바뀌|운이 들어|운이 오|[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]\\s?(?:년|해|운|대운|세운|에|이 오|이 들)",
  "[갑을병정무기경신임계][자축인묘진사오미신유술해]\\s?(?:년|해)",
  "(?:쥐|소|범|호랑이|토끼|용|뱀|말|양|원숭이|닭|개|돼지)띠\\s?해",
  "(?:이번|다음|오는|올|내년|이듬해)\\s?(?:봄|여름|가을|겨울|달|해|철|명절|생일)|다음 달|이번 달|내달|이달|연말|연초|정초|(?<!\\d)\\d{1,2}\\s?월(?:에|부터|까지|쯤|즈음|이면)",
  "[\\d가-힣]{1,4}\\s?번째 해",
].join("|")

export const TIMING_RE = new RegExp(TIMING_SOURCE)

/** 앞·뒤 문장의 시기를 끌어오는 지시어 */
export const ANAPHOR_RE = /그해|그 해|그때|그 무렵|그즈음|그 시기|그 운|그 대운|그 나이|이때|그 고비|그 즈음|그게 바로|그 일이|그 일은|그것이|그건/

export function hasTiming(text: string): boolean {
  return TIMING_RE.test(text)
}
