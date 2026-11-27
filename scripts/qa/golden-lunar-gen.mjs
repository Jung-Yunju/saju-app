#!/usr/bin/env node
// 만세력 골든 테스트셋 v1 — 한국 음력 기대값 생성기 (P3-04, qa-security-lead)
//
// 사용법 (저장소 루트에서):
//   node scripts/qa/golden-lunar-gen.mjs            # tests/engine/golden/lunar-golden.json 다시 생성
//   node scripts/qa/golden-lunar-gen.mjs --check    # 파일과 다르면 exit 1 (재현성 점검)
// 요구: Node 22.18+ (TypeScript 타입 제거 기능으로 oracle.ts를 직접 import)
//
// 기대값 = 독립 천문 오라클(astronomy-engine, UTC+9 합삭·중기 날짜) 계산값.
// 웹에서 확인한 값은 SOURCES에 출처와 함께 적고, 생성 시 오라클과 하나라도 다르면 실패한다.
// 주의: 2026-11-27 세션에서는 astro.kasi.re.kr 원문 페이지에 직접 접속할 수 없었다(네트워크 차단).
//       level "official-search"는 정부·KASI 공식 페이지 내용을 웹 검색 결과 인용으로 확인한 것이다.

import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { SearchMoonPhase } from "astronomy-engine"
import * as o from "../../tests/engine/golden/oracle.ts"

const OUT = fileURLToPath(new URL("../../tests/engine/golden/lunar-golden.json", import.meta.url))

const U = {
  m2022: "https://www.kasi.re.kr/kor/publication/post/newsMaterial/28806",
  m2023: "https://www.kasi.re.kr/kor/publication/post/newsMaterial/29168",
  m2024: "https://www.korea.kr/news/policyNewsView.do?newsId=148916689",
  m2025: "https://www.kasi.re.kr/kor/publication/post/newsMaterial/30071",
  m2027: "https://www.korea.kr/briefing/pressReleaseView.do?newsId=156768474",
  m2019: "https://www.kasi.re.kr/kor/publication/post/newsMaterial/10397",
  m2016: "https://www.kasi.re.kr/kor/publication/post/newsMaterial/2536",
  m2017: "https://www.kasi.re.kr/kor/publication/post/newsMaterial/3660",
  m2020: "https://korea.kr/news/pressReleaseView.do?newsId=156334437",
  kasiCal: "https://astro.kasi.re.kr/life/post/calendarData",
  kasiCal2023: "https://astro.kasi.re.kr/kor/life/post/calendarData?year=2023",
  kasiCal2025: "https://astro.kasi.re.kr/life/post/calendarData?year=2025",
  namuSeol: "https://namu.wiki/w/%EC%84%A4%EB%82%A0",
  namuChuseok: "https://namu.wiki/w/%EC%B6%94%EC%84%9D",
  namuLeap: "https://namu.moe/w/%EC%9C%A4%EC%9B%94",
  hk1997: "https://www.hankyung.com/article/1997020303191",
  mae1997: "https://www.imaeil.com/page/view/1997011414413678674",
}

/** key "Y-[L]M-D" (음력) → 웹 확인 기록 */
const SOURCES = {
  // 설날(음 1/1)
  "2022-1-1": [{ url: U.m2022, level: "official-search", note: "2022년도 월력요항: 설날(음 1월 1일) 2월 1일(화)", solar: "2022-02-01" }],
  "2023-1-1": [{ url: U.m2023, level: "official-search", note: "2023년도 월력요항: 설날(1.22.) 일요일과 겹침", solar: "2023-01-22" }],
  "2024-1-1": [{ url: U.m2024, level: "official-search", note: "2024년도 월력요항(정책브리핑): 설날(음 1월 1일) 2월 10일(토)", solar: "2024-02-10" }],
  "2025-1-1": [{ url: U.m2025, level: "official-search", note: "2025년도 월력요항: 설날(음 1월 1일) 1월 29일(수)", solar: "2025-01-29" }],
  "2026-1-1": [{ url: U.kasiCal, level: "official-search", note: "KASI 달력자료 2026: 설날 연휴 2/16~2/18 → 가운데 날(유도값)", solar: "2026-02-17" }],
  "2027-1-1": [{ url: U.m2027, level: "official-search", note: "2027년 월력요항: 설날 2월 7일(일), 연휴 2/6~2/8", solar: "2027-02-07" }],
  "2028-1-1": [{ url: U.kasiCal, level: "official-search", note: "KASI 달력자료(2년 후 자료=2028): 설날 1/26~1/28 → 가운데 날(유도값)", solar: "2028-01-27" }],
  "2019-1-1": [{ url: U.m2019, level: "official-search", note: "2019년 월력요항: 설날(음 1월 1일) 2월 5일(화)", solar: "2019-02-05" }],
  "2000-1-1": [{ url: U.namuSeol, level: "secondary", note: "나무위키 설날: 2000년 연휴 2/4~2/6 → 가운데 날(유도값)", solar: "2000-02-05" }],
  "2003-1-1": [{ url: U.namuSeol, level: "secondary", note: "나무위키 설날: 2003년 연휴 1/31~2/2 → 가운데 날(유도값)", solar: "2003-02-01" }],
  "2006-1-1": [{ url: U.namuSeol, level: "secondary", note: "나무위키 설날: 2006년 연휴 1/28~1/30 → 가운데 날(유도값)", solar: "2006-01-29" }],
  "2007-1-1": [{ url: U.namuSeol, level: "secondary", note: "나무위키 설날: 2007년 연휴 2/17~2/19 → 가운데 날(유도값)", solar: "2007-02-18" }],
  "2010-1-1": [{ url: U.namuSeol, level: "secondary", note: "나무위키 설날: 2010년 연휴 2/13~2/15, 설날 당일이 발렌타인데이", solar: "2010-02-14" }],
  "1997-1-1": [
    { url: U.hk1997, level: "secondary", note: "한국경제 1997-02-03: 1997년 음력 1월 합삭 한국 2/8 0시6분 → 한국 설날 2/8, 중국 2/7", solar: "1997-02-08" },
    { url: U.mae1997, level: "secondary", note: "매일신문 1997-01-14: 한·중 올해 설날이 다르다", solar: "1997-02-08" },
  ],
  // 추석(음 8/15)
  "2027-8-15": [{ url: U.m2027, level: "official-search", note: "2027년 월력요항: 추석 9월 15일(수), 연휴 9/14~9/16", solar: "2027-09-15" }],
  "2026-8-15": [{ url: U.kasiCal, level: "official-search", note: "KASI 달력자료 2026: 추석 연휴 9/24~9/26 → 가운데 날(유도값)", solar: "2026-09-25" }],
  "2028-8-15": [{ url: U.kasiCal, level: "official-search", note: "KASI 달력자료(2028): 추석 10/2~10/4 → 가운데 날(유도값)", solar: "2028-10-03" }],
  "2016-8-15": [{ url: U.m2016, level: "official-search", note: "2016년 월력요항: 추석 연휴 9/14~9/16 → 가운데 날(유도값)", solar: "2016-09-15" }],
  "2000-8-15": [{ url: U.namuChuseok, level: "secondary", note: "나무위키 추석: 2000년 당일 9/12(화)", solar: "2000-09-12" }],
  "2001-8-15": [{ url: U.namuChuseok, level: "secondary", note: "나무위키 추석: 2001년 10/1(월), 개천절 연계", solar: "2001-10-01" }],
  "2004-8-15": [{ url: U.namuChuseok, level: "secondary", note: "나무위키 추석: 2004년 9/28(화)", solar: "2004-09-28" }],
  "2009-8-15": [{ url: U.namuChuseok, level: "secondary", note: "나무위키 추석: 2009년 연휴 10/2~10/4 → 가운데 날(유도값)", solar: "2009-10-03" }],
  "2010-8-15": [{ url: U.namuChuseok, level: "secondary", note: "나무위키 추석: 2010년 추석 9/22", solar: "2010-09-22" }],
  // 기타 음력 기념일(공식 월력요항)
  "2016-1-15": [{ url: U.m2016, level: "official-search", note: "2016년 월력요항: 정월대보름(음 1월 15일) 2월 22일(월)", solar: "2016-02-22" }],
  "2016-5-5": [{ url: U.m2016, level: "official-search", note: "2016년 월력요항: 단오 6월 9일", solar: "2016-06-09" }],
  "2016-7-7": [{ url: U.m2016, level: "official-search", note: "2016년 월력요항: 칠석 8월 9일", solar: "2016-08-09" }],
  "2017-1-15": [{ url: U.m2017, level: "official-search", note: "2017년 월력요항: 정월대보름(음 1월 15일) 2월 11일(토)", solar: "2017-02-11" }],
  "2017-5-5": [{ url: U.m2017, level: "official-search", note: "2017년 월력요항: 단오 5월 30일", solar: "2017-05-30" }],
  "2017-7-7": [{ url: U.m2017, level: "official-search", note: "2017년 월력요항: 칠석 8월 28일 (윤5월 뒤의 7월)", solar: "2017-08-28" }],
  "2019-1-15": [{ url: U.m2019, level: "official-search", note: "2019년 월력요항: 정월대보름 2월 19일(화)", solar: "2019-02-19" }],
  // 윤달
  "2023-L2-1": [{ url: U.kasiCal2023, level: "official-search", note: "KASI 달력자료 2023: 음력 윤2월 1일 = 양력 3월 22일, 소(29일)달", solar: "2023-03-22" }],
  "2025-L6-1": [{ url: U.kasiCal2025, level: "official-search", note: "KASI 달력자료 2025: | 윤 | 6 | 1 | 소 | 을미 | 2025 | 7 | 25 |", solar: "2025-07-25" }],
  "2017-L5-1": [{ url: U.namuLeap, level: "secondary", note: "나무위키 윤월: 2017년 6/24~7/22 (윤5월). 중국은 閏六月", solar: "2017-06-24" }],
  "2012-L3-1": [{ url: U.namuLeap, level: "secondary", note: "나무위키 윤월: 2012년 4/21~5/20 (윤3월). 중국은 閏四月", solar: "2012-04-21" }],
  "2020-L4-1": [{ url: U.m2020, level: "official-search", note: "2020년도 월력요항: 음력 윤달(윤4월) 포함 — 날짜는 오라클값", solar: null }],
}

const pad = (n) => String(n).padStart(2, "0")
const iso = (d) => `${d.year}-${pad(d.month)}-${pad(d.day)}`
const keyOf = (y, m, d, leap) => `${y}-${leap ? "L" : ""}${m}-${d}`

const cases = []
function add(kind, y, m, d, leap) {
  const solar = o.lunarToSolarOracle(y, m, d, leap, 540)
  if (!solar) throw new Error(`oracle: lunar ${keyOf(y, m, d, leap)} does not exist`)
  const sources = SOURCES[keyOf(y, m, d, leap)] ?? []
  for (const s of sources) {
    if (s.solar && s.solar !== iso(solar)) throw new Error(`web/oracle mismatch ${keyOf(y, m, d, leap)}: web ${s.solar} oracle ${iso(solar)}`)
  }
  cases.push({ kind, lunar: { year: y, month: m, day: d, isLeapMonth: leap }, solar: iso(solar), sources })
}

for (let y = 2000; y <= 2030; y++) add("seollal", y, 1, 1, false)
for (let y = 2000; y <= 2030; y++) add("chuseok", y, 8, 15, false)
add("seollal", 1997, 1, 1, false)
for (const k of ["2016-1-15", "2016-5-5", "2016-7-7", "2017-1-15", "2017-5-5", "2017-7-7", "2019-1-15"]) {
  const [y, m, d] = k.split("-").map(Number)
  add("other", y, m, d, false)
}
// 윤달: 2000~2030 오라클의 모든 윤달 1일 + 마지막 날
const months = o.lunarMonthsOracle(2000, 2030, 540).filter((x) => x.isLeap && x.lunarYear >= 2000 && x.lunarYear <= 2030)
for (const lm of months) {
  add("leap", lm.lunarYear, lm.month, 1, true)
  add("leap", lm.lunarYear, lm.month, lm.length, true)
}
for (const k of Object.keys(SOURCES)) {
  const hit = cases.some((c) => keyOf(c.lunar.year, c.lunar.month, c.lunar.day, c.lunar.isLeapMonth) === k)
  if (!hit) throw new Error(`source key not covered: ${k}`)
}

// 존재하지 않는 음력 날짜(작은달의 30일) — 2020~2026 평달 중 작은달 전부
const invalid = []
for (const lm of o.lunarMonthsOracle(2020, 2026, 540)) {
  if (lm.isLeap || lm.lunarYear < 2020 || lm.lunarYear > 2026) continue
  if (lm.length === 29) invalid.push({ lunar: { year: lm.lunarYear, month: lm.month, day: 30, isLeapMonth: false }, reason: "작은달(29일)의 30일" })
}
// 윤달 없는 해의 윤달, 윤달이 있는 해의 다른 달 윤달
const leapYears = new Set(months.map((m) => m.lunarYear))
for (const y of [2021, 2022, 2024, 2026, 2027]) {
  if (leapYears.has(y)) throw new Error(`${y} has leap month`)
  invalid.push({ lunar: { year: y, month: 5, day: 1, isLeapMonth: true }, reason: `${y}년은 윤달 없음` })
}
for (const lm of months.filter((m) => [2020, 2023, 2025].includes(m.lunarYear))) {
  const other = lm.month === 12 ? 11 : lm.month + 1
  invalid.push({ lunar: { year: lm.lunarYear, month: other, day: 1, isLeapMonth: true }, reason: `${lm.lunarYear}년 윤달은 ${lm.month}월뿐` })
}
// 윤달 작은달의 30일
for (const lm of months.filter((m) => m.length === 29).slice(0, 2)) {
  invalid.push({ lunar: { year: lm.lunarYear, month: lm.month, day: 30, isLeapMonth: true }, reason: "윤달(29일)의 30일" })
}

// 한·중 음력 차이(오라클: 한국 UTC+9, 중국 UTC+8) 1997~2030
const ko = o.lunarMonthsOracle(1996, 2030, 540)
const cn = o.lunarMonthsOracle(1996, 2030, 480)
const mk = (m) => `${m.lunarYear}-${m.isLeap ? "L" : ""}${m.month}`
const cnMap = new Map(cn.map((m) => [mk(m), m]))
const koreaChinaDiffs = []
for (const m of ko) {
  if (m.lunarYear < 1997 || m.lunarYear > 2030) continue
  const c = cnMap.get(mk(m))
  if (!c || c.startDay !== m.startDay) {
    // 근거: 이 달 합삭 시각(KST)과 KST 자정까지의 여유. 여유가 작을수록 오라클 오차에 민감하다.
    const nm = SearchMoonPhase(0, new Date((m.startDay - 2) * 86_400_000), 5).date.getTime()
    const kstMs = nm + 9 * 3_600_000
    const marginMinutes = Math.round((kstMs % 86_400_000) / 60_000)
    koreaChinaDiffs.push({
      month: mk(m), koreaDay1: iso(o.dayNumberToDate(m.startDay)), chinaDay1: c ? iso(o.dayNumberToDate(c.startDay)) : null,
      newMoonKst: new Date(kstMs).toISOString().slice(0, 16).replace("T", " "), minutesAfterKstMidnight: marginMinutes,
    })
  }
}

const data = {
  description: "만세력 골든 테스트셋 v1 — 한국 음력→양력 기대값. 생성: scripts/qa/golden-lunar-gen.mjs (수정 금지, 스크립트로 재생성)",
  oracle: "astronomy-engine 2.1.19, 합삭·中氣의 UTC+9 날짜, 冬至=11월, 무중치윤(無中置閏)",
  sourceLevels: {
    "official-search": "정부(월력요항 보도자료)·KASI 달력자료 페이지 내용을 웹 검색 인용으로 확인. 원문 직접 열람은 네트워크 차단으로 못 함",
    secondary: "언론·위키 등 2차 자료",
    none: "웹 확인 없음 — 오라클 계산값만",
  },
  cases,
  invalid,
  koreaChinaDiffs,
}
const text = JSON.stringify(data, null, 2) + "\n"
if (process.argv.includes("--check")) {
  const cur = readFileSync(OUT, "utf8")
  if (cur !== text) {
    console.error("lunar-golden.json 이 생성 결과와 다릅니다")
    process.exit(1)
  }
  console.log("lunar-golden.json 일치")
} else {
  writeFileSync(OUT, text)
  console.log(`written ${OUT}: ${cases.length} cases, ${invalid.length} invalid, ${koreaChinaDiffs.length} KR/CN diffs`)
}
