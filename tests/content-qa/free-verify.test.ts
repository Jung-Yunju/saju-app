// 품질검증 — 무료 문안 6종을 검증기(verifyReading)에 넣어 block/warn을 잰다(prompts@0.2.0 쉬운 말 회귀).
// 측정 로직: scripts/qa/free-copy-verify.ts. 검증기·문안은 고치지 않는다.
// 판정: block 0이어야 통과(무료 화면에 그대로 나가는 고정 문안이므로). warn은 기록만 한다.
// 이전 판과 비교하려면 QA_FREE_BASELINE=<이전 content/free 디렉터리>를 주고 실행한다(없으면 현재 판만).
import { describe, expect, it } from "vitest"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { buildUnits, tally, pictureExact, pictureLoose } from "../../scripts/qa/free-copy-verify"
import { hasBasisMarker } from "@/engine/verify/checks/barnum"
import { verifyReading } from "@/engine/verify"

const root = fileURLToPath(new URL("../../", import.meta.url))
const print = (label: string, r: ReturnType<typeof tally>) => {
  const rows = Object.entries(r).map(
    ([f, x]) =>
      `  ${f}: 단위 ${x.units} · block ${x.block} · warn ${x.warn} · 바넘 비율경고 단위 ${x.barnumRatioUnits} · 문장 ${x.sentences} 중 근거표지 없음 ${x.unmarked}` +
      ` · [가정 H1 사전문구] 없음 ${x.hyp.exact.unmarked}/비율경고 ${x.hyp.exact.ratioUnits} · [가정 H2 핵심낱말] 없음 ${x.hyp.loose.unmarked}/비율경고 ${x.hyp.loose.ratioUnits}` +
      `\n     ${JSON.stringify(x.byCode)}${x.blocks.length ? `\n     block 예: ${x.blocks.join(" | ")}` : ""}`,
  )
  process.stderr.write(`[qa] ${label}\n${rows.join("\n")}\n`)
}

describe("무료 문안 → 검증기", () => {
  it("현재 판: block 0 (warn 수는 기록)", () => {
    const units = buildUnits(`${root}content/free`)
    expect(units.length).toBeGreaterThan(300)
    const r = tally(units)
    print("현재 content/free", r)
    // verify@0.3.1: QA-FV-1(등불이 나란히) 고침 → 알려진 오탐 없이 block 0
    expect(r["전체"]!.blocks).toEqual([])
    expect(r["전체"]!.block).toBe(0)
    // 상품 소개 칸(teaser) 예외: teaser 단위의 바넘 비율 경고 0(0.3.0에서는 60)
    expect(r["teaser"]!.barnumRatioUnits).toBe(0)
  })

  // 결함 QA-FV-1(검증기) — verify@0.3.1에서 고침(it.fails → it): 사고 패턴 `불이 ?(?:나|난|날|났)`이 낱말 경계 없이
  // "등불이 나란히"의 "불이 나"에 걸려 FORBIDDEN_TOPIC/accident block이던 것. 사전 전수 점검: tests/verify/plain-words-fp.test.ts
  it("[결함 QA-FV-1 고침] '등불이 나란히 서는 해'는 사고 예언이 아니다(block 없어야 함)", () => {
    const r = verifyReading(
      { parts: [{ title: "올해", chapters: [{ title: "올해", body: ["2027년엔 등불인 너 곁에 같은 등불이 나란히 서는 해다."] }] }] },
      { sajuInput: { pillars: { year: "丁亥", month: "丁亥", day: "丁亥" }, hour_unknown: true, this_year: 2027, this_year_ganzhi: "丁未" } },
    )
    expect(r.findings.filter((f) => f.severity === "block")).toEqual([])
  })

  const base = process.env.QA_FREE_BASELINE
  it.runIf(!!base && existsSync(base!))("이전 판(QA_FREE_BASELINE) 측정 — 비교용, 단언 없음", () => {
    print(`이전 판 ${base}`, tally(buildUnits(base!)))
  })

  it("그림 말을 근거로 세는 가정의 우회 위험: 상투 문장에 그림 말만 붙이면 '근거 있음'이 된다", () => {
    const canned = [
      "한여름 한낮의 불 같은 너는 때로는 외롭다.",
      "위로 곧게 크는 큰 나무처럼 너도 인정받고 싶은 마음이 크다.",
      "네가 앉은 자리가 그렇다, 겉으로는 강해 보여도 속으로는 여리다.",
      "찬물 같은 기질이라 상처를 잘 받는다.",
    ]
    const rows = canned.map((c) => ({ c, now: hasBasisMarker(c), h1: pictureExact(c), h2: pictureLoose(c) }))
    process.stderr.write(`[qa] 우회 예시(근거 표지로 인정되는가): ${JSON.stringify(rows)}\n`)
    // 현재 검증기는 넷 다 근거 없음으로 본다
    expect(rows.every((r) => !r.now)).toBe(true)
  })
})
