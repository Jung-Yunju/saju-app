import { it } from "vitest"
import { fixtureSet } from "./fixtures"
import { parseSample } from "../../scripts/qa/rubric/lib/load"
import { scoreBatch } from "../../scripts/qa/rubric/lib/metrics"
it("probe", () => {
  const fx = fixtureSet()
  for (const set of [fx.good, fx.barnum]) {
    const b = scoreBatch(set.map((j) => parseSample(j, j.persona + ".json")))
    for (const s of b.samples) console.log(s.persona, JSON.stringify({ v: s.verify.counts, codes: s.verify.byCode, top: s.verify.top, m: s.markers, caps: s.caps, rep: { ...s.repetition }, cd: s.crossDup, depth: s.depth, todos: { ...s.todos, items: undefined }, p: s.personal }, null, 0))
    console.log(JSON.stringify(b.crossDup.examples.slice(0, 5)))
  }
})
