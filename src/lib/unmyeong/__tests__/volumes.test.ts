import { describe, expect, it } from "vitest"
import raw from "../../../../content/unmyeong/volumes.json"
import { CHAPTERS, PRODUCT_CHAPTERS } from "@/engine/content/prompts"
import { KNOWN_PAID_CHAPTER_IDS, UNMYEONG_VOLUMES, validateVolumesConfig, visibleVolumes, volumeByKey, volumesForProduct } from "@/lib/unmyeong/volumes"

const clone = () => JSON.parse(JSON.stringify(raw)) as { version: number; volumes: Record<string, unknown>[] } & Record<string, unknown>

describe("유료 5권 설정(volumes.json)", () => {
  it("현재 설정이 검증을 통과하고 5권, 이름이 대표 지시와 같다", () => {
    const r = validateVolumesConfig(raw)
    expect(r.ok).toBe(true)
    expect(UNMYEONG_VOLUMES.map((v) => [v.no, v.title])).toEqual([
      [1, "너라는 사람"], [2, "네 앞에 놓인 10년"], [3, "너에게 찾아올 인연"], [4, "돈이 너를 찾아오는 길"], [5, "네 삶을 바꾸는 법"],
    ])
    expect(UNMYEONG_VOLUMES.map((v) => v.productCode)).toEqual(["BASIC", "DECADE", "LOVE", "MONEY", "BASIC"])
    expect(visibleVolumes()).toHaveLength(5)
    expect(volumeByKey("volume-3")?.productCode).toBe("LOVE")
    expect(volumesForProduct("BASIC").map((v) => v.no)).toEqual([1, 5])
  })

  it("ready 장은 실제 v3 장이고 연결 상품이 만드는 장이다. 준비 중 장은 label이 있다", () => {
    const ids = new Set(CHAPTERS.map((c) => c.id))
    for (const v of UNMYEONG_VOLUMES) {
      for (const c of v.chapters) {
        if (c.status === "ready") {
          expect(ids.has(c.id as string)).toBe(true)
          expect(PRODUCT_CHAPTERS[v.productCode!]).toContain(c.id)
        } else expect(c.label).toBeTruthy()
      }
    }
    expect(UNMYEONG_VOLUMES[4].chapters.some((c) => c.status === "pending")).toBe(true)
  })

  it("알려진 장 id 목록은 CHAPTERS의 유료 장과 같다", () => {
    const paid = CHAPTERS.filter((c) => !c.id.startsWith("free-")).map((c) => c.id).sort()
    expect([...KNOWN_PAID_CHAPTER_IDS].sort()).toEqual(paid)
  })

  it("가격 칸을 넣으면 실패(가격은 현행 상품 설정을 따른다)", () => {
    const a = clone(); a.volumes[0].price = 9900
    const b = clone(); b.amount = 1
    for (const x of [a, b]) {
      const r = validateVolumesConfig(x)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.errors.join()).toMatch(/가격/)
    }
  })

  it("잘못된 값은 모두 모아 알려 준다", () => {
    const c = clone()
    c.volumes[0].productCode = "NOPE"
    c.volumes[1].no = 1
    c.volumes[2].chapters = [{ id: "talent" }] // talent는 LOVE 상품이 만들지 않는 장
    c.volumes[3].chapters = [{ id: null }]
    c.volumes[4].title = ""
    c.volumes[4].visible = "yes"
    const r = validateVolumesConfig(c)
    expect(r.ok).toBe(false)
    if (r.ok) return
    const all = r.errors.join("\n")
    expect(all).toMatch(/volumes\[0\]\.productCode/)
    expect(all).toMatch(/volumes\[1\]\.no: 1 중복/)
    expect(all).toMatch(/talent는 상품 LOVE가 만들지 않는 장/)
    expect(all).toMatch(/volumes\[3\]\.chapters\[0\]: 준비 중인 장/)
    expect(all).toMatch(/volumes\[4\]\.title/)
    expect(all).toMatch(/volumes\[4\]\.visible/)
  })

  it("모르는 장 id·무료 장·만들 수 없는 상품·문장 수 초과는 실패", () => {
    const a = clone(); a.volumes[0].chapters = [{ id: "free-nature" }]
    const b = clone(); b.volumes[0].chapters = [{ id: "없는-장" }]
    const c = clone(); c.volumes[0].productCode = "COMPAT"
    const d = clone(); d.volumes[0].intro = "하나. 둘. 셋."
    const e = clone(); e.version = 2
    for (const x of [a, b, c, d, e]) expect(validateVolumesConfig(x).ok).toBe(false)
  })

  it("productCode null이면 장은 준비 중으로, visible=false는 화면 목록에서 빠진다", () => {
    const c = clone()
    c.volumes[0].productCode = null
    c.volumes[1].visible = false
    const r = validateVolumesConfig(c)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value[0].chapters.every((ch) => ch.status === "pending")).toBe(true)
    expect(r.value.filter((v) => v.visible).map((v) => v.no)).toEqual([1, 3, 4, 5])
  })
})
