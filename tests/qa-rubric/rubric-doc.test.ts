// P4-05 채점 기준표 문서(docs/quality/rubric.md)와 코드(CAP_TABLE·PASS_LINE·RUBRIC_ITEMS)의 숫자가 어긋나지 않는지
// + 비교 양식에 1순위 기준점(할마카세)·원문 금지 원칙이 적혀 있는지.
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { CAP_TABLE } from "../../scripts/qa/rubric/lib/metrics"
import { PASS_LINE, RUBRIC_ITEMS } from "../../scripts/qa/rubric/lib/rubric"

const root = resolve(__dirname, "../..")
const rubric = readFileSync(resolve(root, "docs/quality/rubric.md"), "utf8")
const compare = readFileSync(resolve(root, "docs/quality/competitor-compare.md"), "utf8")

describe("rubric.md ↔ 코드", () => {
  it("8항목 이름이 문서 표에 있다", () => {
    for (const { label } of RUBRIC_ITEMS) expect(rubric, label).toMatch(new RegExp(`\\| \\d \\| ${label.replace(/[·]/g, ".")} \\|`))
  })
  it("구체성 상한 문턱 표 = CAP_TABLE.specificity", () => {
    for (const r of CAP_TABLE.specificity) {
      const row = r.min === 0 ? `| ${Math.round(CAP_TABLE.specificity[CAP_TABLE.specificity.length - 2].min * 100)}% 미만 | ${r.cap} |` : `| ${Math.round(r.min * 100)}% 이상 | ${r.cap} |`
      expect(rubric, row).toContain(row)
    }
  })
  it("목소리 상한 문턱 표 = CAP_TABLE.voice", () => {
    let prev = -1
    for (const r of CAP_TABLE.voice) {
      const lo = prev + 1
      const row = r.max === Infinity ? `| ${lo}건 이상 | ${r.cap} |` : lo === r.max ? `| ${lo}건 | ${r.cap} |` : `| ${lo}~${r.max}건 | ${r.cap} |`
      expect(rubric, row).toContain(row)
      prev = r.max as number
    }
  })
  it("합격선 숫자 = PASS_LINE", () => {
    expect(rubric).toContain(`**안전 = ${PASS_LINE.safetyExact}**`)
    expect(rubric).toContain(`**정확성 ≥ ${PASS_LINE.accuracyMin}**`)
    expect(rubric).toContain(`**구체성 ≥ ${PASS_LINE.specificityMin}**`)
    expect(rubric).toContain(`**8항목 평균 ≥ ${PASS_LINE.meanMin.toFixed(1)}**`)
    expect(rubric).toContain(`${PASS_LINE.floor}점 미만 없음`)
    expect(rubric).toContain(`${Math.round(PASS_LINE.batchPassShare * 100)}% 이상`)
    expect(rubric).toContain(`${Math.round(PASS_LINE.batchConditionalShare * 100)}% 미만`)
    expect(rubric).toContain(`${PASS_LINE.competitorTolerance}점 넘게 낮지 않음`)
    expect(rubric).toContain(`${PASS_LINE.competitorFail}점 넘게 낮음`)
  })
  it("미래 예측 정확성을 재지 않는다고 밝힌다", () => {
    expect(rubric).toMatch(/미래 예측이 맞는지.*잴 수 없고/)
  })
})

describe("competitor-compare.md", () => {
  it("1순위 비교 대상 = 할마카세, 기준 문서 연결", () => {
    expect(compare).toMatch(/\*\*1순위\*\* \| \*\*할마카세\*\*/)
    expect(compare).toContain("../business/trends/benchmark-halmakase.md")
  })
  it("원문을 저장소에 넣지 않는 원칙", () => {
    expect(compare).toMatch(/경쟁사 풀이 원문·캡처·그림을 이 저장소에 넣지 않는다/)
    expect(compare).toMatch(/원문 인용 금지/)
  })
})
