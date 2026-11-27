// DB 구조 v3(마이그레이션 20261127090000_reading_v3_safety) 기능 스위치와 열 변환 도우미
//
// 배포 순서(대표 승인 후): ① 마이그레이션 적용 → ② 이 코드 배포(스위치 끔) → ③ DB_SCHEMA_V3=true
//   - 스위치가 꺼져 있으면 라우트는 예전과 똑같이 동작한다(새 열을 읽거나 쓰지 않음).
//   - 주의: 새 schema로 만든 Prisma 클라이언트는 select 없는 조회에서 새 열도 읽으므로,
//     스위치와 무관하게 ①이 ②보다 먼저여야 한다(docs/DATABASE.md 4절).
import { resolveTimeMode, type BirthPrecision, type CalTypeValue } from "@/lib/validate"

type Env = Record<string, string | undefined>

/** DB_SCHEMA_V3=true일 때만 새 열(attemptCount·lockedAt·정확도 입력 열·Order.birthInfo)을 쓴다 */
export function isDbSchemaV3(env: Env = process.env): boolean {
  return env.DB_SCHEMA_V3 === "true"
}

interface PrecisionPerson extends BirthPrecision {
  hour: number | null
}

/**
 * 본인 정확도 입력 → Reading 열. 만세력 계산(buildSajuInputFromRequest)과 같은 규칙으로 정리한다.
 * 출생지는 경도만 남기고 이름은 저장하지 않는다(개인정보 최소화).
 */
export function precisionColumns(p: PrecisionPerson) {
  const mode = resolveTimeMode(p.hour, p)
  return {
    isLeapMonth: p.isLeapMonth === true,
    birthMinute: mode === "exact" ? (p.birthMinute ?? null) : null,
    timeMode: mode,
    ziNight: p.ziNight ?? null,
    birthplaceLongitude: p.birthplace?.longitude ?? null,
  }
}

/** 상대방 정확도 입력 → Reading other* 열. 상대방이 없으면 모두 NULL */
export function otherPrecisionColumns(
  other: (PrecisionPerson & { calType?: CalTypeValue }) | null | undefined,
) {
  if (!other) {
    return {
      otherCalType: null, otherIsLeapMonth: null, otherBirthMinute: null,
      otherTimeMode: null, otherZiNight: null, otherBirthplaceLongitude: null,
    }
  }
  const c = precisionColumns(other)
  return {
    otherCalType: other.calType ?? null,
    otherIsLeapMonth: c.isLeapMonth,
    otherBirthMinute: c.birthMinute,
    otherTimeMode: c.timeMode,
    otherZiNight: c.ziNight,
    otherBirthplaceLongitude: c.birthplaceLongitude,
  }
}
