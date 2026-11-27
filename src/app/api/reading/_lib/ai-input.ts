// AI에 보내기 직전 사주 입력 정리 — DB에 저장된 값이라도(예전 레코드 포함) 다시 거른다.
// 개인정보 최소화: AI 서술에 필요 없는 값은 보내지 않는다.
//   - birthplace(출생지 이름·경도): 진태양시 보정에 이미 반영되어 pillars에 들어 있으므로 AI엔 불필요
import type { SajuInputData } from "@/lib/saju-input"
import { validateName } from "@/lib/validate"

export function prepareSajuInputForAi(raw: unknown): SajuInputData | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null
  // birthplace는 구조 분해로 떼어 내고 나머지만 보낸다(키 자체가 남지 않게)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { birthplace: _birthplace, ...input } = raw as SajuInputData
  const name = validateName(input.name)
  return {
    ...input,
    // 20자 초과·문자열 아님 → 이름 없이(호칭 없이) 생성
    name: name.ok && name.value ? name.value : undefined,
    // 사용자가 제공하지 않은 사실을 섞지 않도록 known_facts는 서버가 비운 값만 쓴다
    known_facts: [],
  }
}
