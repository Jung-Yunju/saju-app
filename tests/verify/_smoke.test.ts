import { it } from "vitest"
import { verifyReading } from "@/engine/verify"
import { CLEAN_READING, BAD_READING, SAJU_1990F } from "./fixtures"
it("smoke", () => {
  const a = verifyReading(CLEAN_READING, { sajuInput: SAJU_1990F })
  console.log("CLEAN", a.pass, a.counts, JSON.stringify(a.findings, null, 1), JSON.stringify(a.stats.barnumByChapter))
  const b = verifyReading(BAD_READING, { sajuInput: { ...SAJU_1990F, known_facts: ["2019년 결혼"] }, userText: "요즘 정말 죽고 싶어요" })
  console.log("BAD", b.pass, b.counts)
  for (const f of b.findings) console.log(f.severity, f.code, f.rule, f.location.path, f.location.sentence, "|", f.excerpt, "|", f.message)
})
