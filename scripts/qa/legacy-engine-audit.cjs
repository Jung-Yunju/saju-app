// legacy-engine-audit.sh 가 호출한다. 단독 실행하지 않는다.
const path = require("path")
const OUT = process.env.AUDIT_OUT
const { calculateSaju } = require(path.join(OUT, "saju.js"))
const { buildSajuInput } = require(path.join(OUT, "saju-input.js"))
const { Lunar, Solar } = require("lunar-javascript")

const H = "甲乙丙丁戊己庚辛壬癸", B = "子丑寅卯辰巳午未申酉戌亥"
const HK = "갑을병정무기경신임계", BK = "자축인묘진사오미신유술해"
const toHan = p => H[HK.indexOf(p.stem)] + B[BK.indexOf(p.branch)]
const NAMES = ["년", "월", "일", "시"]

function compare(y, m, d, h) {
  const a = calculateSaju(y, m, d, h, "M", "SOLAR")
  const b = buildSajuInput(y, m, d, h, "M", "SOLAR")
  const A = [toHan(a.year), toHan(a.month), toHan(a.day), a.hour ? toHan(a.hour) : "-"]
  const P = [b.pillars.year, b.pillars.month, b.pillars.day, b.pillars.hour || "-"]
  return { A, P, diff: A.map((x, i) => (x !== P[i] ? NAMES[i] : null)).filter(Boolean) }
}

let failures = 0
const check = (label, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`)
  if (!ok) failures++
}

console.log("== 1. 화면 표시 사주(saju.ts) vs AI 입력 사주(saju-input.ts) 일치 여부 ==")
const samples = [
  ["입춘 전날 2024-02-03 12시", 2024, 2, 3, 12],
  ["경칩 전날 2024-03-04 12시", 2024, 3, 4, 12],
  ["평일 2024-07-20 12시", 2024, 7, 20, 12],
  ["밤 23시 2024-07-20", 2024, 7, 20, 23],
]
for (const [label, ...args] of samples) {
  const r = compare(...args)
  check(label, r.diff.length === 0, `화면 ${r.A.join(" ")} / AI ${r.P.join(" ")}`)
}
let total = 0, mismatch = 0
for (let y = 1940; y <= 2025; y++) for (let m = 1; m <= 12; m++) for (const d of [1, 5, 10, 20, 28]) {
  total++
  if (compare(y, m, d, 12).diff.length) mismatch++
}
check(`대량 비교 ${total}건 (1940~2025, 정오)`, mismatch === 0, `불일치 ${mismatch}건 (${((mismatch / total) * 100).toFixed(1)}%)`)

console.log("\n== 2. 절기 시각 기준 시간대 ==")
const ipchun = Lunar.fromYmd(2024, 1, 1).getJieQiTable()["立春"].toYmdHms()
// 2024년 입춘 = 2024-02-04 08:27 UTC. KST(UTC+9)로는 17:27, 중국 표준시(UTC+8)로는 16:27.
check("라이브러리 입춘 시각이 한국 표준시 기준인가", ipchun.startsWith("2024-02-04 17:2"), `라이브러리 값 ${ipchun} (KST 기대값 17:27)`)
const ec = Solar.fromYmdHms(2024, 2, 4, 17, 0, 0).getLunar().getEightChar()
check("KST 2024-02-04 17:00(입춘 전) 출생의 연주가 癸卯인가", ec.getYear() === "癸卯", `결과 ${ec.getYear()}`)

console.log("\n== 3. 입력 검증 ==")
const bad = calculateSaju(2023, 2, 30, 12, "M", "LUNAR")
check("존재하지 않는 음력 날짜(2023-02-30)를 거부하는가", false, `오류 없이 양력 ${bad.birthInfo.year}-${bad.birthInfo.month}-${bad.birthInfo.day}로 처리됨`)
const plain = Lunar.fromYmd(2023, 2, 15).getSolar().toYmd(), leap = Lunar.fromYmd(2023, -2, 15).getSolar().toYmd()
check("윤달 입력 수단이 있는가 (입력 화면/API)", false, `평달 2월 15일=${plain}, 윤2월 15일=${leap} — 약 한 달 차이인데 구분 입력 없음`)

console.log("\n== 4. 기타 ==")
const s = buildSajuInput(1985, 6, 15, null, "F", "SOLAR")
check("기준 연도가 실행 시점으로 계산되는가", false, `this_year=${s.this_year}, this_year_ganzhi=${s.this_year_ganzhi} 고정값`)

console.log(`\n결과: 실패 ${failures}건 (실패는 기존 코드의 결함을 뜻함. 새 엔진 개발 시 회귀 테스트로 전환 예정)`)
