// AI에 보내기 직전 사주 입력 정리 — DB에 저장된 값이라도(예전 레코드 포함) 다시 거른다.
import type { SajuInputData } from "@/lib/saju-input"
import { validateName } from "@/lib/validate"

export function prepareSajuInputForAi(raw: unknown): SajuInputData | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null
  const input = raw as SajuInputData
  const name = validateName(input.name)
  return {
    ...input,
    // 20자 초과·문자열 아님 → 이름 없이(호칭 없이) 생성
    name: name.ok && name.value ? name.value : undefined,
    // 사용자가 제공하지 않은 사실을 섞지 않도록 known_facts는 서버가 비운 값만 쓴다
    known_facts: [],
  }
}
