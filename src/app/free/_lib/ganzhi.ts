// 간지 표시 변환(서버 전용). 한글·오행 표는 src/lib/saju-input.ts에만 있으므로 그 변환을 재사용한다(표를 복제하지 않는다).
import { displaySajuFromStored, parseGanzhi } from "@/lib/saju-input"
import type { ElementKo, GanzhiView } from "./types"

const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"]
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]

/** "甲子" → 표시값(한글·오행). 올바른 간지가 아니면 null */
export function ganzhiView(hanja: string): GanzhiView | null {
  const p = parseGanzhi(hanja)
  if (!p) return null
  const d = displaySajuFromStored({ pillars: { year: hanja, month: hanja, day: hanja }, hour_unknown: true })
  const row = d?.pillars[0]
  if (!row) return null
  return {
    hanja,
    ko: row.stem + row.branch,
    stemHanja: p.stem,
    branchHanja: p.branch,
    stemKo: row.stem,
    branchKo: row.branch,
    element: row.element as ElementKo,
    branchEl: row.branchEl as ElementKo,
  }
}

/** 천간 한 글자("甲") → 일간 표시값. 천간이 아니면 null (일간은 지지와 무관해 짝이 맞는 아무 지지를 붙여 변환한다) */
export function dayMasterOf(stem: string): { hanja: string; ko: string; element: ElementKo } | null {
  const i = STEMS.indexOf(stem)
  if (i < 0) return null
  const g = ganzhiView(stem + BRANCHES[i])
  return g ? { hanja: g.stemHanja, ko: g.stemKo, element: g.element } : null
}
