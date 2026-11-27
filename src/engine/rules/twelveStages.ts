// 12운성 (rules-spec §5)
// 행 고르기: ① 戊·己는 earthStages로 빌려 올 행을 정한다(withFire: 戊→丙, 己→丁 / withWater: 戊→壬, 己→癸)
//           ② twelveStagesYin="sameAsYang"이면 음간은 같은 오행 양간의 행(乙→甲, 丁→丙, 辛→庚, 癸→壬)
//           ③ 순행: stage = (b − start) mod 12, 역행: stage = (start − b) mod 12
import type { Branch, Stem } from "../types"
import { BRANCHES, STEMS, mod } from "../calendar/constants"
import { STAGE_ROW, TWELVE_STAGES } from "./tables"
import type { RuleOptions, TwelveStage } from "./types"

type StageOptions = Pick<RuleOptions, "twelveStagesYin" | "earthStages">

export function twelveStagesTableId(o: StageOptions): string {
  return `twelve-stages:${o.twelveStagesYin}/${o.earthStages}`
}

function rowStem(stem: Stem, o: StageOptions): Stem {
  let s = stem
  if (s === "戊") s = o.earthStages === "withFire" ? "丙" : "壬"
  else if (s === "己") s = o.earthStages === "withFire" ? "丁" : "癸"
  if (o.twelveStagesYin === "sameAsYang" && STEMS.indexOf(s) % 2 === 1) s = STEMS[STEMS.indexOf(s) - 1]
  return s
}

/** 천간 stem의 지지 branch에서의 12운성 */
export function twelveStageOf(stem: Stem, branch: Branch, o: StageOptions): TwelveStage {
  const row = STAGE_ROW[rowStem(stem, o)]
  if (!row) throw new Error(`unreachable: no stage row for ${stem}`)
  const start = BRANCHES.indexOf(row.start)
  const b = BRANCHES.indexOf(branch)
  return TWELVE_STAGES[row.forward ? mod(b - start, 12) : mod(start - b, 12)]
}
