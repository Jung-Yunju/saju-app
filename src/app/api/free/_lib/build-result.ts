// 엔진 결과(SajuInputData) → 화면 응답(FreeResult). 계산은 엔진이 끝냈고 여기서는 표시용으로 옮기기만 한다.
// 개인정보 차단: 이름·생년월일(birth)·성별·출생지·양력/음력 구분은 응답에 옮기지 않는다.
import { displaySajuFromStored, type DisplayPillar, type SajuInputData } from "@/lib/saju-input"
import { ganzhiView } from "@/app/free/_lib/ganzhi"
import { selectCopy, type RawContent } from "@/app/free/_lib/content"
import type { DaeunView, ElementKo, FreeResult, PillarView } from "@/app/free/_lib/types"

const EL = (v: string): ElementKo => v as ElementKo

const LABELS: Record<PillarView["key"], string> = { year: "연주", month: "월주", day: "일주", hour: "시주" }

export function buildFreeResult(s: SajuInputData, raw: RawContent): FreeResult {
  const display = displaySajuFromStored(s)
  if (!display) throw new Error("원국 표시 변환 실패")
  const keys: PillarView["key"][] = ["year", "month", "day", ...(s.hour_unknown || !s.pillars.hour ? [] : (["hour"] as const))]
  const pillars: PillarView[] = keys.map((key, i) => {
    const g = ganzhiView(s.pillars[key] as string)
    if (!g) throw new Error("원국 간지 변환 실패")
    const d: DisplayPillar = display.pillars[i]
    return { ...g, key, label: LABELS[key], element: EL(d.element), branchEl: EL(d.branchEl), ...(key === "day" ? { me: true } : {}) }
  })
  const day = pillars.find((p) => p.key === "day") as PillarView

  // 현재 대운: 시작 연도가 올해 이하인 마지막 대운(연 단위 근사 — 월 단위 경계는 표시하지 않는다)
  let currentIndex = -1
  s.daeun.forEach((d, i) => {
    if (d.start_year <= s.this_year) currentIndex = i
  })
  const items: DaeunView[] = s.daeun.map((d, i) => {
    const g = ganzhiView(d.ganzhi)
    if (!g) throw new Error("대운 간지 변환 실패")
    return { ...g, startAge: d.start_age, startYear: d.start_year, current: i === currentIndex }
  })
  const ty = ganzhiView(s.this_year_ganzhi)
  if (!ty) throw new Error("올해 간지 변환 실패")

  const elements = display.fiveElements.map((e) => ({ el: EL(e.el), count: e.count }))
  const dayMaster = { hanja: day.stemHanja, ko: day.stemKo, element: day.element }
  const copy = selectCopy(raw, {
    dayMaster,
    dayPillar: { hanja: day.hanja, ko: day.ko },
    elements,
    thisYear: { year: s.this_year, hanja: ty.hanja, ko: ty.ko },
  })

  return {
    pillars,
    hourUnknown: !pillars.some((p) => p.key === "hour"),
    elements,
    dayMaster: { ...dayMaster, nickname: copy.share.nickname },
    dayPillar: day,
    daeun: { startAge: s.daeun[0]?.start_age ?? 0, items, currentIndex },
    thisYear: { year: s.this_year, ganzhi: ty },
    warnings: s.warnings ?? [],
    engineVersion: s.engine_version ?? "",
    copy,
  }
}
