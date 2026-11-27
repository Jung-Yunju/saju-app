// 본 풀이 생성 엔진 기능 스위치 — v2(기존, 기본값) / v3(새 콘텐츠 엔진: 사실표 → 장별 생성 → 검증기)
//
// v3는 아래 둘이 모두 켜져야 동작한다. 하나라도 꺼져 있으면 예전 v2 그대로다.
//   READING_ENGINE=v3   — 새 엔진 사용
//   DB_SCHEMA_V3=true   — 마이그레이션 reading_v3_safety 적용 후 켠 스위치. v3가 쓰는 것:
//                         Reading.attemptCount(풀이 1건당 생성 시도 상한 — v3는 시도 1회에 AI를 여러 번 부르므로 필수),
//                         AiUsage 표(호출마다 모델·토큰·비용 기록)
// 값은 정확히 "v3"·"true"만 켠 것으로 본다(오타·공백은 꺼짐).
import { isDbSchemaV3 } from "./schema-v3"

type Env = Record<string, string | undefined>

export type ReadingEngine = "v2" | "v3"

export interface ReadingEngineChoice {
  engine: ReadingEngine
  /** v3를 요청했지만 v2로 도는 이유(로그용) */
  fallbackReason?: "db_schema_v3_off"
}

export function resolveReadingEngine(env: Env = process.env): ReadingEngineChoice {
  if (env.READING_ENGINE !== "v3") return { engine: "v2" }
  if (!isDbSchemaV3(env)) return { engine: "v2", fallbackReason: "db_schema_v3_off" }
  return { engine: "v3" }
}
