// 무료 운명비서 화면용 안내 문장 — 엔진·입력 경고(SajuInputData.warnings) 원문을 쉬운 문장으로 바꾼다(관찰 O1).
// 원문에는 절입 시각·보정 후 시각·바뀐 날짜·지방평균시 오프셋처럼 출생 시각에 가까운 값이 들어 있다 → 원문은 내보내지 않는다.
// 허용 목록 방식: 아래 규칙에 맞는 경고만 정해진 문장(숫자 없음)으로 바꾸고, 나머지(시진 대표 시각 안내·LMT 안내 등)는 버린다.
// 원문 형식은 src/engine/calendar/{chart,time}.ts, src/lib/saju-input.ts가 만든다. 그 문구가 바뀌면 이 규칙과 테스트를 같이 고친다.
// 기존 /api/free는 이 파일을 쓰지 않는다.

export interface FriendlyWarningOptions {
  /** 음력으로 입력했는가(음력→양력 변환 경고는 음력 입력일 때만 원국에 영향) */
  lunarInput?: boolean
}

export const FRIENDLY_WARNINGS = {
  termBoundaryMonth: "절기가 바뀌는 무렵에 태어나, 태어난 시각이 조금만 달라도 달 기둥(월주)이 바뀔 수 있다.",
  termBoundaryYear: "입춘 무렵에 태어나, 태어난 시각이 조금만 달라도 해 기둥(연주)과 달 기둥(월주)이 바뀔 수 있다.",
  termDayMonth: "태어난 날에 절기가 바뀌어, 태어난 시각에 따라 달 기둥(월주)이 달라질 수 있다.",
  termDayYear: "태어난 날이 입춘이라, 태어난 시각에 따라 해 기둥(연주)과 달 기둥(월주)이 달라질 수 있다.",
  hourBoundary: "시가 바뀌는 경계 무렵에 태어나, 시 기둥(시주)이 바뀔 수 있다.",
  hourDayBoundary: "자정 무렵 시가 바뀌는 경계에 태어나, 시 기둥(시주)과 날 기둥(일주)이 바뀔 수 있다.",
  midnight: "자정 무렵에 태어나, 날 기둥(일주)이 바뀔 수 있다.",
  ziUnknown: "자시에 태어났는데 자정 전인지 후인지 몰라 자정 뒤로 보고 계산했다. 자정 전이면 날 기둥(일주)과 시 기둥(시주)이 달라질 수 있다.",
  hourUnknownLateNight: "태어난 시각을 몰라 낮으로 보고 계산했다. 밤 늦게(자시) 태어났다면 날 기둥(일주)이 다음 날로 바뀔 수 있다.",
  solarHourShift: "태어난 곳의 해 위치로 시각을 고쳐 보니 시 기둥(시주)이 달라졌다.",
  solarDayShift: "태어난 곳의 해 위치로 시각을 고쳐 보니 날짜가 바뀌어 날 기둥(일주)도 달라졌다.",
  dst: "서머타임이 바뀌던 때라 실제 태어난 순간이 한 시간쯤 어긋날 수 있다. 시 기둥(시주)이 달라질 수 있다.",
  sijinMismatch: "고른 시진과 계산된 시 기둥(시주)이 다르다(서머타임·표준시 변경·태어난 곳 영향). 정확한 시각을 알면 더 정확하다.",
  lunarConvert: "이 음력 달은 공식 달력과 양력 날짜가 하루 다를 수 있어 기둥이 달라질 수 있다.",
} as const

/** 원문 하나 → 쉬운 문장(없으면 버림) */
function convert(w: string, opts: FriendlyWarningOptions): string | null {
  if (/^절입\(/.test(w)) return /연주/.test(w) ? FRIENDLY_WARNINGS.termBoundaryYear : FRIENDLY_WARNINGS.termBoundaryMonth
  if (/^출생일에 절입\(/.test(w)) return /연주/.test(w) ? FRIENDLY_WARNINGS.termDayYear : FRIENDLY_WARNINGS.termDayMonth
  if (/^시지 경계/.test(w)) return /일주/.test(w) ? FRIENDLY_WARNINGS.hourDayBoundary : FRIENDLY_WARNINGS.hourBoundary
  if (/^자정 \d+분 이내 출생/.test(w)) return FRIENDLY_WARNINGS.midnight
  if (/^자시 날짜 경계 불확실/.test(w)) return FRIENDLY_WARNINGS.ziUnknown
  if (/^태어난 시각 모름/.test(w)) return /다음 날/.test(w) ? FRIENDLY_WARNINGS.hourUnknownLateNight : null // 시각 모름 자체는 화면이 hourUnknown으로 안내
  if (/^진태양시 보정.*시지가/.test(w)) return FRIENDLY_WARNINGS.solarHourShift
  if (/^진태양시 보정.*날짜가/.test(w)) return FRIENDLY_WARNINGS.solarDayShift
  if (/^시간대 전환/.test(w)) return FRIENDLY_WARNINGS.dst
  if (/^선택한 시진\(/.test(w)) return FRIENDLY_WARNINGS.sijinMismatch
  if (/^이 음력 달은 합삭/.test(w)) return opts.lunarInput ? FRIENDLY_WARNINGS.lunarConvert : null
  return null
}

/** 경고 원문 목록 → 화면 안내(중복 제거, 원래 순서) */
export function friendlyWarnings(raw: readonly string[] | undefined, opts: FriendlyWarningOptions = {}): string[] {
  const out: string[] = []
  for (const w of raw ?? []) {
    if (typeof w !== "string") continue
    const s = convert(w, opts)
    if (s && !out.includes(s)) out.push(s)
  }
  return out
}
