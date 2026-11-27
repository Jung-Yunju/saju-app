// 한글 활용형 도구 (verify@0.3.0) — 낱말 목록이 아니라 음절 구조로 활용형을 만든다.
// 한글 음절 = 0xAC00 + (초성×21 + 중성)×28 + 종성. 받침 없는 어간의 마지막 음절은
// ㄴ(선)·ㄹ(설)·ㅁ(섬)·ㅂ(섭)·ㅆ(섰) 받침이 붙거나, 어/아와 줄어든 꼴(서→서, 지→져, 되→돼, 하→해, 오→와)로 바뀐다.
// → v("갈라서")는 "갈라[서선설섬섭섰]" 같은 정규식 조각을 돌려주고, 일치 끝 음절의 받침으로 뒤따르는 어미(ㄴ다·ㄹ 것·ㅆ다)를 복원한다.

const BASE = 0xac00
const T_N = 4 // ㄴ
const T_L = 8 // ㄹ
const T_M = 16 // ㅁ
const T_B = 17 // ㅂ
const T_SS = 20 // ㅆ

export interface Syllable {
  l: number
  v: number
  t: number
}

export function decompose(ch: string): Syllable | null {
  const c = ch.charCodeAt(0) - BASE
  if (c < 0 || c > 11171) return null
  return { l: Math.floor(c / 588), v: Math.floor((c % 588) / 28), t: c % 28 }
}

export function compose(s: Syllable): string {
  return String.fromCharCode(BASE + (s.l * 21 + s.v) * 28 + s.t)
}

/** 어/아가 붙어 줄어든 중성(ㅗ→ㅘ, ㅜ→ㅝ, ㅣ→ㅕ, ㅡ→ㅓ, ㅚ→ㅙ, 하→해). 줄지 않으면 null */
function contracted(s: Syllable): number | null {
  const ㅎ = 18
  if (s.l === ㅎ && s.v === 0) return 1 // 하→해
  switch (s.v) {
    case 0: // ㅏ
    case 4: // ㅓ
    case 1: // ㅐ
    case 5: // ㅔ
      return s.v
    case 8: // ㅗ → ㅘ
      return 9
    case 13: // ㅜ → ㅝ
      return 14
    case 20: // ㅣ → ㅕ
      return 6
    case 18: // ㅡ → ㅓ
      return 4
    case 11: // ㅚ → ㅙ
      return 10
    default:
      return null
  }
}

/** 받침 없는 음절의 활용 음절들 */
export function syllableForms(ch: string): string[] {
  const s = decompose(ch)
  if (!s || s.t !== 0) return [ch]
  const out = new Set<string>([ch])
  for (const t of [T_N, T_L, T_M, T_B, T_SS]) out.add(compose({ ...s, t }))
  const cv = contracted(s)
  if (cv !== null) {
    out.add(compose({ ...s, v: cv, t: 0 }))
    out.add(compose({ ...s, v: cv, t: T_SS }))
  }
  return [...out]
}

/**
 * 어간 → 활용형을 덮는 정규식 조각. 받침 있는 어간(잃·앓·죽)은 그대로(어미가 다음 음절로 온다).
 * 예) v("갈라서") = "갈라[서선설섬섭섰]", v("하") = "[하한할함합했해]"
 */
export function v(stem: string): string {
  const chars = [...stem]
  const last = chars.pop()!
  const forms = syllableForms(last)
  const head = chars.join("")
  return forms.length === 1 ? stem : `${head}[${forms.join("")}]`
}

/**
 * 일치 구간 끝 음절에서 복원한 어미 머리 + 뒤 글.
 * stemLast: 어간 기본 마지막 음절(받침 없는 어간일 때만 의미). 끝 음절이 받침을 얻었으면 그 받침을 자모로 앞에 붙인다.
 * 예) "갈라선" + "다." → "ㄴ다." / "갈라설" + " 것" → "ㄹ 것" / "갈라섰" + "다" → "ㅆ다" / "갈라서" + "게" → "게"
 */
export function tailOf(matchedLast: string, stemLast: string | undefined, rest: string, conjugated = false): string {
  if (!stemLast) {
    // 활용형을 직접 적은 꼴(망할·헤어진·죽는): 끝 음절 받침 ㄴ·ㄹ·ㅆ을 어미 머리로
    if (!conjugated) return rest
    const m = decompose(matchedLast)
    const mark = m ? (m.t === T_N ? "ㄴ" : m.t === T_L ? "ㄹ" : m.t === T_SS ? "ㅆ" : "") : ""
    return mark + rest
  }
  const m = decompose(matchedLast)
  const b = decompose(stemLast)
  if (!m || !b || b.t !== 0) return rest
  const mark = m.t === T_N ? "ㄴ" : m.t === T_L ? "ㄹ" : m.t === T_M ? "ㅁ" : m.t === T_B ? "ㅂ" : m.t === T_SS ? "ㅆ" : m.v !== b.v ? "어" : ""
  return mark + rest
}

export const isHangul = (c: string | undefined) => !!c && /[가-힣]/.test(c)
