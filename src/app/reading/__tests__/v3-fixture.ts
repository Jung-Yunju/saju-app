// 가짜 v3 저장본(화면 테스트·스크린샷용). 장 출력은 실제 출력 스키마 모양대로 만든다(내용은 연습 문장).
import { fakeValue } from "../../../../scripts/content/samples/fake-client"
import { BASIC_CHAPTER_IDS, chapterById } from "@/engine/content/prompts"
import type { StoredChapterV3, StoredReadingV3 } from "@/lib/generate-reading-v3"
import type { FactSheet } from "@/engine/content/types"

const ctx = { stem: "乙", branch: "酉", year: 2026 }

const FACTS = { schemaVersion: 1, engineVersion: "test", asOf: "2026-11-27T00:00:00+09:00" } as unknown as FactSheet

const HAND: Record<string, Record<string, unknown>> = {
  nature: {
    title: "을(乙) 풀잎이 유(酉) 가위를 만났다",
    sub: "일간 을목과 일지 유금을 보고 쓴 장",
    chips: [
      { letter: "乙", pos: "day.stem", label: "일간 을(乙) · 바람에 눕는 풀" },
      { letter: "酉", pos: "day.branch", label: "일지 유(酉) · 나를 단련하는 자" },
      { letter: "子午", pos: "year.branch+day.branch", label: "자오(子午) 충 · 거리가 움직이는 자리" },
    ],
    body: [
      "어디 보자. 남이 먼저 보는 얼굴은 <b>부드럽고 잘 휘는 풀</b>이다. 일간 을(乙)이 그 모양이다.",
      "혼자 있을 때는 결이 다르다. 일지 유(酉)가 곁에서 늘 다듬는 가위 같아서, 스스로를 자주 재 본다.",
      "이 사람을 여는 것은 믿는 사람 앞에서 하는 작은 고백이다. 그러면 풀린다.",
      "굳는 데는 잘못 보일까 하는 마음이다. 글자는 생김새다. 쓰는 건 너다.",
    ],
    todo: "오늘 한 사람에게 속마음 한 줄을 먼저 말해 본다",
    ask: "요즘 누구 앞에서 가장 풀려 있느냐?",
    caveat: "태어난 시를 몰라 시주는 읽지 않았다.",
  },
}

export function fakeStoredV3(over: Partial<StoredReadingV3> = {}, failIds: string[] = []): StoredReadingV3 {
  const chapters: StoredChapterV3[] = BASIC_CHAPTER_IDS.map((id) => {
    const spec = chapterById(id)!
    if (failIds.includes(id)) return { id, title: spec.title, ok: false, error: "verify_block", attempts: 3 }
    const out = (fakeValue(spec.outputSchema as never, "", ctx) as Record<string, unknown>) ?? {}
    return { id, title: spec.title, ok: true, output: { ...out, ...(HAND[id] ?? {}) }, attempts: 1 }
  })
  return {
    format: "reading-v3",
    version: "reading-v3@test",
    product: "BASIC",
    status: failIds.length ? "partial" : "complete",
    generatedAt: "2026-11-27T00:00:00Z",
    versions: { reading: "t", generator: "t", prompts: "t", facts: "t", engine: "t" },
    model: "fake",
    chapters,
    failedIds: failIds,
    facts: FACTS,
    cost: { calls: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsdEstimate: 0 },
    ...over,
  } as StoredReadingV3
}
