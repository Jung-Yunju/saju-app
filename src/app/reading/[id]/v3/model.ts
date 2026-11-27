// v3 저장본 → 화면용 장 모양. 화면은 사주를 다시 계산하지 않고, 저장된 장 출력(output)을 그대로 옮겨 담기만 한다.
// 장 출력은 unknown으로 저장되므로 칸마다 모양을 확인하고, 모양이 틀린 칸은 건너뛴다(화면이 깨지지 않게).
import type { StoredChapterV3, StoredReadingV3 } from "@/lib/generate-reading-v3"

export type ChipView = { letter: string; pos: string; label: string; easy: string }
export type ExtraItem = { name?: string; text?: string; rows?: { label: string; text: string }[] }
export type Extra = { heading: string; items: ExtraItem[] }
export type ChapterView = {
  id: string
  title: string
  sub: string
  chips: ChipView[]
  body: string[]
  extras: Extra[]
  todo: string
  ask: string
  caveat: string
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)
const s = (v: unknown): string => (typeof v === "string" ? v.trim() : "")
const n = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0)
const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter(isObj) : [])
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.map(s).filter(Boolean) : [])

// ─────────────────────────────── 근거 칩: 쉬운 이름

const PILLAR_EASY: Record<string, string> = {
  "year.stem": "연간 · 겉으로 보이는 모습",
  "year.branch": "연지 · 뿌리와 어린 시절",
  "month.stem": "월간 · 사회에서 드러나는 결",
  "month.branch": "월지 · 타고난 바탕",
  "day.stem": "일간 · 나 자신",
  "day.branch": "일지 · 가장 가까운 자리",
  "hour.stem": "시간 · 앞으로 맺는 열매",
  "hour.branch": "시지 · 속마음과 말년",
}
const HIDDEN_EASY: Record<string, string> = { yeogi: "속에 든 앞선 기운", junggi: "속에 든 중간 기운", jeonggi: "속에 든 중심 기운" }

/** 위치 코드(day.branch, daeun[3].stem, year.branch+day.branch …) → 쉬운 이름. 한자·용어는 칩을 눌렀을 때만 */
export function easyPosition(pos: string): string {
  const parts = pos.split("+").map((p) => p.trim()).filter(Boolean)
  if (!parts.length) return "사주 속 한 자리"
  return parts.map(easyOne).join(" + ")
}

function easyOne(code: string): string {
  const m = code.match(/^(year|month|day|hour)\.(stem|branch)(?:\.(yeogi|junggi|jeonggi))?$/)
  if (m) {
    const base = PILLAR_EASY[`${m[1]}.${m[2]}`]
    return m[3] ? `${base} (${HIDDEN_EASY[m[3]]})` : base
  }
  if (/^daeun\[/.test(code)) return "대운 · 열 해 동안 부는 바람"
  if (/^(seun|thisYear|year\[)/.test(code)) return "세운 · 올해의 바람"
  return "사주 속 한 자리"
}

// ─────────────────────────────── 장별 추가 칸

function extrasOf(o: Record<string, unknown>): Extra[] {
  const out: Extra[] = []
  const add = (heading: string, items: ExtraItem[]) => {
    const kept = items.filter((i) => i.name || i.text || i.rows?.length)
    if (kept.length) out.push({ heading, items: kept })
  }
  const rowsOf = (src: Record<string, unknown>, spec: [string, string][]) =>
    spec.map(([k, label]) => ({ label, text: s(src[k]) })).filter((r) => r.text)

  // talent / career
  add("값이 오르는 자리", list(o.fits).map((x) => ({ name: s(x.place), text: s(x.text) })))
  add("값이 오르는 일터", list(o.roles).map((x) => ({ name: s(x.place), text: s(x.text) })))
  // money
  if (isObj(o.habits)) add("돈의 버릇", [{ rows: rowsOf(o.habits, [["earn", "버는 법"], ["keep", "모으는 법"], ["leak", "새는 곳"]]) }])
  if (isObj(o.ledger)) add("곳간 셈", [{ rows: rowsOf(o.ledger, [["earn", "버는 법"], ["keep", "모으는 법"], ["leak", "새는 곳"]]) }])
  if (s(o.size_rule)) add("되돌릴 수 있는 크기", [{ text: s(o.size_rule) }])
  // love
  add("사랑의 버릇", list(o.patterns).map((x) => ({ name: s(x.name), text: s(x.text) })))
  // career 지킬까 움직일까
  if (isObj(o.move_or_stay)) {
    const m = o.move_or_stay
    const crit = strs(m.criteria).map((c, i) => ({ label: `가려 볼 물음 ${i + 1}`, text: c }))
    add("지킬까, 움직일까", [{ rows: [...rowsOf(m, [["stay", "지키면"], ["move", "움직이면"]]), ...crit] }])
  }
  if (s(o.this_year)) add("올해", [{ text: s(o.this_year) }])

  // daeun-now
  if (isObj(o.faces)) add("이 열 해가 올 수 있는 얼굴", [{ rows: rowsOf(o.faces, [["best", "잘 오면"], ["half", "반쯤 오면"], ["worst", "잘못 오면"]]) }])
  if (isObj(o.next) && (s(o.next.text) || n(o.next.start_year))) {
    const age = n(o.next.start_age)
    const year = n(o.next.start_year)
    add("다음 열 해", [{ name: age || year ? `${age ? `${age}살` : ""}${year ? ` (${year}년)` : ""}부터`.trim() : undefined, text: s(o.next.text) }])
  }

  // year-ahead
  add(
    "올해와 내년",
    list(o.years).map((x) => ({
      name: `${n(x.year) || ""}년${s(x.title) ? ` · ${s(x.title)}` : ""}`.trim(),
      text: s(x.text),
      rows: rowsOf(x, [["reduce", "줄일 것"], ["keep", "그래도 할 것"]]),
    })),
  )

  // crossroads
  add(
    "갈림길",
    list(o.forks).map((f) => {
      const side = (k: string, label: string) => {
        const v = f[k]
        if (!isObj(v)) return []
        return [{ label: `${label}${s(v.name) ? ` · ${s(v.name)}` : ""}`, text: [s(v.gain) && `얻는 것: ${s(v.gain)}`, s(v.loss) && `잃는 것: ${s(v.loss)}`].filter(Boolean).join(" / ") }]
      }
      return {
        name: s(f.title),
        text: s(f.sub),
        rows: [
          ...side("left", "한쪽 길"),
          ...side("right", "다른 쪽 길"),
          ...strs(f.criteria).map((c, i) => ({ label: `가려 볼 물음 ${i + 1}`, text: c })),
          ...rowsOf(f, [["rule", "한 줄 권고"], ["todo", "바꿔 볼 것"], ["ask", "물음"]]),
        ].filter((r) => r.text),
      }
    }),
  )

  // life-past / life-ahead / decade-weather
  add(
    "열 해마다",
    list(o.daeun).map((x) => {
      const age = n(x.start_age)
      const head = [age ? `${age}살부터` : "", s(x.name)].filter(Boolean).join(" · ")
      return {
        name: head,
        text: s(x.theme) || s(x.text),
        rows: isObj(x.faces)
          ? rowsOf(x.faces, [["best", "잘 오면"], ["half", "반쯤 오면"], ["worst", "잘못 오면"]])
          : rowsOf(x, [["best", "잘 오면"], ["half", "반쯤 오면"], ["worst", "잘못 오면"], ["do_this", "쓰는 법"]]),
      }
    }),
  )
  if (isObj(o.turn) && s(o.turn.text)) add("갈아입는 해", [{ name: n(o.turn.year) ? `${n(o.turn.year)}년` : undefined, text: s(o.turn.text) }])

  // decade-pack
  add("들고 갈 것", list(o.carry).map((x) => ({ name: s(x.item), text: s(x.text) })))
  add("두고 갈 버릇", list(o.leave).map((x) => ({ name: s(x.item), text: s(x.text) })))
  add("살펴볼 해", list(o.checkpoints).map((x) => ({ name: n(x.year) ? `${n(x.year)}년` : undefined, text: s(x.text) })))

  // closing
  add("가져갈 당부", list(o.points).map((x) => ({ name: s(x.title), text: s(x.text) })))
  add("일 년 뒤 가려 볼 말", list(o.review).map((x) => ({ name: s(x.after), text: s(x.claim), rows: rowsOf(x, [["basis", "근거"]]) })))

  return out
}

/** 저장된 장 하나 → 화면용(통과한 장만 호출한다) */
export function chapterView(ch: StoredChapterV3): ChapterView {
  const o = isObj(ch.output) ? ch.output : {}
  return {
    id: ch.id,
    title: s(o.title) || ch.title,
    sub: s(o.sub),
    chips: list(o.chips)
      .map((c) => ({ letter: s(c.letter), pos: s(c.pos), label: s(c.label), easy: easyPosition(s(c.pos)) }))
      .filter((c) => c.letter || c.pos),
    body: strs(o.body),
    extras: extrasOf(o),
    todo: s(o.todo),
    ask: s(o.ask),
    caveat: s(o.caveat),
  }
}

// ─────────────────────────────── 상태별 화면

export type V3Mode = "crisis" | "partial" | "complete"

export type V3Plan = {
  mode: V3Mode
  /** 읽을 수 있는 장(통과한 장, 저장된 순서) */
  pages: ChapterView[]
  /** 전체 장 수(목차 표시용) */
  total: number
  /** 아직 못 만든 장의 기본 제목 */
  pendingTitles: string[]
}

/** complete라고 적혀 있어도 통과하지 못한 장이 있으면 partial로 본다(안전하게) */
export function planOf(stored: StoredReadingV3): V3Plan {
  if (stored.status === "crisis") return { mode: "crisis", pages: [], total: 0, pendingTitles: [] }
  const usable = stored.chapters.filter((c) => c.ok && c.output !== undefined)
  const pending = stored.chapters.filter((c) => !(c.ok && c.output !== undefined))
  const mode: V3Mode = stored.status === "complete" && pending.length === 0 ? "complete" : "partial"
  return { mode, pages: usable.map(chapterView), total: stored.chapters.length, pendingTitles: pending.map((c) => c.title) }
}
