// 고정 시드 난수 + 무작위 출생 입력(양력 1900-01-01 ~ 2100-12-31, 서울 시각). Math.random을 쓰지 않는다.
import type { BirthInput } from "../../../src/engine"

/** 문자열 → 32비트 시드(FNV-1a) */
export function seedOf(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** mulberry32 — [0, 1) */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const daysIn = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate()

/** 날짜는 1900-01-01 ~ 2100-12-31 안에서 일 단위 균등, 시각은 분 단위 균등 */
export function randomBirthInputs(n: number, seed: string): BirthInput[] {
  const r = rng(seedOf(seed))
  const start = Date.UTC(1900, 0, 1)
  const days = Math.round((Date.UTC(2100, 11, 31) - start) / 86400000) + 1
  const out: BirthInput[] = []
  for (let i = 0; i < n; i++) {
    const d = new Date(start + Math.floor(r() * days) * 86400000)
    const minuteOfDay = Math.floor(r() * 1440)
    const gender = r() < 0.5 ? "M" : "F"
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth() + 1
    const day = d.getUTCDate()
    if (day > daysIn(y, m)) throw new Error("날짜 생성 오류")
    out.push({
      calendar: "solar", year: y, month: m, day,
      time: { hour: Math.floor(minuteOfDay / 60), minute: minuteOfDay % 60 },
      timezone: "Asia/Seoul", gender,
    })
  }
  return out
}
