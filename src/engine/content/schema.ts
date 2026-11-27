// 간이 JSON 스키마 검사 (P4-03) — 구조화 출력이 보장되더라도 받은 JSON을 한 번 더 확인한다(방어).
// 지원 키워드: type(문자열·배열), properties, required, additionalProperties(false만), items, enum, const,
//   minItems, maxItems, minLength, maxLength. 그 밖의 키워드는 무시한다(통과).
// 전체 JSON Schema 검사기가 아니다 — 외부 패키지를 추가하지 않기 위한 최소 구현.

export interface SchemaIssue {
  path: string
  message: string
}

type S = Record<string, unknown>

function typeOf(v: unknown): string {
  if (v === null) return "null"
  if (Array.isArray(v)) return "array"
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number"
  return typeof v
}

function typeMatches(v: unknown, t: string): boolean {
  const actual = typeOf(v)
  if (t === "number") return actual === "number" || actual === "integer"
  return actual === t
}

export function validateJsonSchema(value: unknown, schema: unknown, path = "$", out: SchemaIssue[] = [], maxIssues = 20): SchemaIssue[] {
  if (out.length >= maxIssues || !schema || typeof schema !== "object") return out
  const s = schema as S
  const push = (message: string) => {
    if (out.length < maxIssues) out.push({ path, message })
  }

  if (s.type !== undefined) {
    const types = Array.isArray(s.type) ? (s.type as string[]) : [s.type as string]
    if (!types.some((t) => typeMatches(value, t))) {
      push(`형식 ${types.join("|")} 이어야 함(실제 ${typeOf(value)})`)
      return out
    }
  }
  if (Array.isArray(s.enum) && !s.enum.some((e) => e === value)) push("enum 값이 아님")
  if ("const" in s && s.const !== value) push("const 값이 아님")

  if (typeof value === "string") {
    if (typeof s.minLength === "number" && [...value].length < s.minLength) push(`길이 ${s.minLength} 이상이어야 함`)
    if (typeof s.maxLength === "number" && [...value].length > s.maxLength) push(`길이 ${s.maxLength} 이하여야 함`)
  }

  if (Array.isArray(value)) {
    if (typeof s.minItems === "number" && value.length < s.minItems) push(`항목 ${s.minItems}개 이상이어야 함`)
    if (typeof s.maxItems === "number" && value.length > s.maxItems) push(`항목 ${s.maxItems}개 이하여야 함`)
    if (s.items && typeof s.items === "object" && !Array.isArray(s.items)) value.forEach((v, i) => validateJsonSchema(v, s.items, `${path}[${i}]`, out, maxIssues))
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>
    const props = (s.properties && typeof s.properties === "object" ? s.properties : {}) as Record<string, unknown>
    if (Array.isArray(s.required)) for (const k of s.required as string[]) if (!(k in obj)) push(`필수 키 '${k}' 없음`)
    for (const [k, v] of Object.entries(obj)) {
      if (k in props) validateJsonSchema(v, props[k], `${path}.${k}`, out, maxIssues)
      else if (s.additionalProperties === false) push(`허용되지 않은 키 '${k}'`)
    }
  }
  return out
}
