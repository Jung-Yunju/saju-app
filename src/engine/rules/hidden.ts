// 지장간 (rules-spec §3)
import type { Branch } from "../types"
import { HIDDEN_STEM_TABLES, PROVISIONAL_HIDDEN_WEIGHTS } from "./tables"
import type { HiddenStem, HiddenStemTableId } from "./types"

/** 지지의 지장간(여기 → 중기 → 정기 순). weight 합 = 1 */
export function hiddenStemsOf(branch: Branch, tableId: HiddenStemTableId): HiddenStem[] {
  const rows = HIDDEN_STEM_TABLES[tableId][branch]
  const hasDays = rows.every((r) => r.days !== null)
  return rows.map((r) => {
    let weight: number
    if (hasDays) {
      const total = rows.reduce((a, x) => a + (x.days as number), 0)
      weight = (r.days as number) / total
    } else if (rows.length === 1) {
      weight = 1
    } else if (rows.length === 2) {
      weight = r.role === "jeonggi" ? PROVISIONAL_HIDDEN_WEIGHTS.two.jeonggi : PROVISIONAL_HIDDEN_WEIGHTS.two.other
    } else {
      weight = PROVISIONAL_HIDDEN_WEIGHTS.three[r.role]
    }
    return { stem: r.stem, role: r.role, days: r.days, weight }
  })
}
