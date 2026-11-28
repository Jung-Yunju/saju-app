// DB 구조 v3(마이그레이션 20261127090000_reading_v3_safety) 기능 스위치와 열 변환 도우미
//
// 배포 순서(대표 승인 후): 이 코드 배포(스위치 끔 — 마이그레이션 전 DB에서도 동작) → 마이그레이션 적용 → DB_SCHEMA_V3=true
//   - 스위치가 꺼져 있으면 라우트는 예전과 똑같이 동작한다(새 열을 읽거나 쓰지 않음).
//   - select 없는 조회·Reading.create의 기본값 열 문제는 src/lib/db-legacy.ts(옛 스키마 호환 계층)가 막는다
//     (src/lib/prisma.ts가 감싼다 — docs/DATABASE.md 4절).
//   - 반대로 스위치를 켜기 전에는 반드시 마이그레이션이 적용되어 있어야 한다.
import { resolveTimeMode, type BirthPrecision, type CalTypeValue } from "@/lib/validate"

export { isDbSchemaV3 } from "@/lib/db-legacy"

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
