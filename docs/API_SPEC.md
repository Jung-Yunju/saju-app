# API 명세

## 1. 현행 API [현행] (U-01 긴급 보안 조치 반영)
모든 API는 로그인 세션이 필요하다. 사용자 판별은 `src/lib/session-user.ts`의 `getSessionUser()` 한 가지 규칙(세션 이메일로 찾은 DB 사용자 → 없으면 세션 id)으로 통일했다.
입력 검증은 `src/lib/validate.ts`(외부 패키지 없음), 요청 본문은 크기 제한을 두고 읽는다(기본 8KB, verify 4KB).
오류 응답은 `{ "error": "일반 한국어 안내" }` 형식이며, 내부 오류 내용은 서버 로그에만 남긴다.

| 메서드·경로 | 하는 일 | 비고 |
|---|---|---|
| `POST /api/reading/direct` | 결제 없이(0원) 주문·풀이 레코드 생성(상태 PENDING) 후 `{ readingId }` 반환. AI는 부르지 않음 | 현재 입력 화면이 쓰는 경로. **운영에서는 `ALLOW_FREE_READING=true`일 때만 허용, 아니면 403.** 허용돼도 사용자당 24시간 `FREE_READING_DAILY_LIMIT`건까지(초과 429). 입력 검증 실패 400(주문 생성 안 함). 주문+풀이는 한 트랜잭션 |
| `POST /api/reading/[id]/generate` | AI 본 풀이 생성 → COMPLETE | 본인 풀이가 아니면 404(아무것도 쓰지 않음). PENDING·FAILED일 때만 원자적으로 GENERATING 잠금을 잡은 요청 1건만 AI 호출. 이미 COMPLETE면 200(`alreadyCompleted`), 생성 중이면 202, 그 밖은 409 — 모두 AI 호출 없음. 실패 시 본인 풀이만 FAILED. 270초 제한 |
| `GET /api/reading/[id]/status` | 상태 조회(폴링): PENDING · GENERATING · VERIFYING · COMPLETE · FAILED | 10분 넘게 남은 GENERATING(서버 중단 등)은 FAILED로 알려 "다시 시도"를 띄움(조회는 DB를 바꾸지 않음) |
| `POST /api/reading/[id]/claims` | (구) 1차 "지나온 길 단정" 생성 → VERIFYING | 개발용·현재 미사용. **운영에서는 direct와 같은 조건이 아니면 404.** generate와 같은 1회 잠금. 이미 단정이 있으면 AI 없이 그대로 반환 |
| `POST /api/reading/[id]/verify` | (구) 맞다/아니다 답변 반영 후 본 풀이 → COMPLETE | 개발용·현재 미사용. 운영 조건 claims와 같음. 답변 키는 저장된 claim id만, 값은 `맞다`·`아니다`·`모름`만, 본문 4KB 이하. VERIFYING·FAILED에서만 잠금. 실패 시 VERIFYING으로 되돌려 다시 제출 가능 |
| `POST /api/payment/prepare` | 주문 생성. 금액(19,900원)은 서버가 정함 | 생년월일 검증·만세력 계산 가능 여부 확인 후 주문 생성(입력 오류 400, 엔진 결함 500). 호출하는 화면 없음 |
| `POST /api/payment/confirm` | 토스 결제 승인 → 주문 PAID → PENDING 풀이 생성 후 `{ readingId }` 반환 | 같은 요청에서 AI를 부르지 않음(풀이 화면이 generate 호출). 생년월일은 승인 전에 검증. 금액은 서버 주문 금액 기준, 0원 주문 거부. 승인 성공 확인 시에만 PAID, 명확한 거절일 때 PENDING인 경우에만 FAILED, 결과를 알 수 없으면 PENDING 유지(재요청 시 재확인). 이미 PAID면 기존 풀이 id 반환(없으면 지금 생성) |
| `GET/POST /api/auth/[...nextauth]` | 로그인 | Google |

### 생년월일 입력 필드 (direct 본문 · prepare 본문 · confirm `birthInfo` 공통, U-03 입력 정확도)
기존 필드(`birthYear`·`birthMonth`·`birthDay`·`birthHour`(0~23 또는 null)·`gender`(M/F)·`calType`(SOLAR/LUNAR, 기본 SOLAR))는 그대로다. 아래는 모두 **선택** 필드이며, 보내지 않으면 예전처럼 동작한다.

| 필드 | 형식 | 규칙 |
|---|---|---|
| `isLeapMonth` | boolean | 음력 윤달이면 true. `calType: "SOLAR"`에서 true는 400. 그 해에 없는 윤달은 만세력 계산에서 400 |
| `birthMinute` | 0~59 정수 또는 null | `birthHour`가 null이면 반드시 null(아니면 400). `timeMode: "sijin"`이면 무시(null로 정리) |
| `timeMode` | `"exact"` \| `"sijin"` | exact = `birthHour:birthMinute`가 실제 시각(분 없으면 :00). sijin = 시진 선택, `birthHour`는 짝수(자시 0, 축시 2 … 해시 22, 홀수면 400). **생략 시**: 짝수 시이고 분이 없으면 sijin, 홀수 시이거나 분이 있으면 exact |
| `ziNight` | boolean | sijin + 자시(`birthHour: 0`)일 때만 의미, 그 밖에는 버림. true = 자정 전 밤, false = 자정 후 |
| `birthplace` | `{ name, longitude }` 또는 null | 진태양시(경도) 보정용. `name`은 이름과 같은 정리 규칙·20자 이내·빈 값 불가. `longitude`는 숫자, 동경 124~132도(한반도) 밖이면 400. 소수 셋째 자리로 반올림. null·생략 = 서울 경도(126.978) |

- **상대방**(BULLY·CONFLICT): 같은 규칙으로 `otherIsLeapMonth`·`otherBirthMinute`·`otherTimeMode`·`otherZiNight`·`otherBirthplace`, 그리고 `otherCalType`(생략 시 본인 calType — 예전 동작). 오류 문구는 "상대방 …"으로 시작한다.
- **시진 대표 시각**(서버가 정함): 시진 구간은 한국 표준시 기준 30분 늦춘 표(자시 23:30~01:29, 축시 01:30~03:29 … 해시 21:30~23:29)이고, 그 **가운데** 시각으로 계산한다. 축시~해시 = 짝수 시 + 30분(축시 → 02:30). 자시는 자정에서 날짜가 갈리므로 `ziNight: true` → 그 날짜 23:45, `false` → 00:45, 생략 → 예전대로 00:00 + 경고 "자시 날짜 경계 불확실". (23:30을 쓰지 않는 이유: 서울 보정 −32분 후 22:58 → 亥시가 됨.)
- 시진으로 계산했으면 `sajuInput.warnings`에 "시진 선택(○시) — … 가운데 HH:MM로 계산"이, 계산된 시지가 고른 시진과 다르면(서머타임 시기 등) "선택한 시진(…)과 계산된 시지(…)가 다름 …"이 붙는다.
- **저장**: DB 열은 바꾸지 않았다. 윤달·분·입력 방식·출생지는 `Reading.sajuInput`(JSON)에만 `calendar: "음력(윤달)"`, `birth`("YYYY-MM-DD HH:MM", 시진이면 대표 시각), `time_mode`, `birth_minute`, `birthplace`로 남는다. 결과 화면은 저장된 `sajuInput.pillars`를 그대로 표시한다. 상대방의 양력·음력 구분·윤달·분·출생지는 계산 가능 여부만 확인하고 저장하지 않는다(열 없음, 현재 풀이 생성은 상대방 원국을 쓰지 않음).
- `prepare`는 결제창 전에 만세력 계산 가능 여부를 확인하고, 응답 `birthInfo`에 정리된 값을 돌려준다(새 필드는 요청에 있었을 때만 키가 생김 — 예전 클라이언트가 받는 형태 그대로). 클라이언트는 이 `birthInfo`를 confirm에 그대로 보낸다.
- **오류 구분**: 입력 때문에 계산할 수 없으면(`EngineInputError`) 400, 그 밖의 계산 예외(엔진 결함)는 500(내부 내용은 서버 로그에만). confirm은 어느 쪽이든 토스 승인 요청 전에 멈춘다.

### 풀이 상태값 (`Reading.status`, 문자열 — 마이그레이션 없음)
`PENDING`(생성 전) → `GENERATING`(AI 생성 중, 잠금) → `COMPLETE` / 실패 시 `FAILED`(다시 시도 가능).
개발용 단정 흐름: `PENDING` → `GENERATING` → `VERIFYING` → `GENERATING` → `COMPLETE`.
잠금 시각은 연결된 `Order.updatedAt`에 기록한다(Reading에 수정시각 열이 없음).

### 환경변수 (값은 배포 환경 설정에만 두고 코드·문서에 쓰지 않는다)
| 이름 | 뜻 | 기본 |
|---|---|---|
| `ALLOW_FREE_READING` | 운영(`NODE_ENV=production`)에서 결제 없는 풀이(direct·claims·verify)를 열지 여부. 정확히 `true`일 때만 열림 | 미설정 = 닫힘 |
| `FREE_READING_DAILY_LIMIT` | 무료 풀이 사용자당 24시간 생성 한도(0 이상 정수, 0이면 신청 불가). 개발 환경에도 적용 | 3 |

## 2. 목표 API 초안 [제안] (6단계 확정)
| 메서드·경로 | 하는 일 |
|---|---|
| `POST /api/v1/charts` | 생년월일 → 엔진 계산 결과 저장(무료, AI 없음) |
| `GET /api/v1/charts/[id]` | 원국·오행·대운 조회 (화면 표시는 이것만 사용) |
| `POST /api/v1/orders` | 상품 ID로 주문 생성(금액은 서버가 결정) |
| `POST /api/v1/orders/[id]/confirm` | 결제 승인 → 이용권 발급 |
| `POST /api/v1/readings` | 이용권 + chart로 풀이 작업 생성(1회 잠금) |
| `GET /api/v1/readings/[id]` | 장별 진행 상황·결과 |
| `POST /api/v1/readings/[id]/retry` | 실패한 장만 재생성(횟수 제한) |

공통 규칙: 입력 스키마 검증, 요청 크기 제한, 사용자별 호출 제한, 오류 메시지에 내부 정보 미노출.


## DB 구조 v3 기능 스위치 (2026-11-27 준비, 미적용) [현행 코드]
| 환경변수 | 기본 | 설명 |
|---|---|---|
| `DB_SCHEMA_V3` | 꺼짐 | 정확히 `true`일 때만 새 열 사용. **운영 DB 마이그레이션 적용 후에만 켤 것** |
| `GENERATION_MAX_ATTEMPTS` | 3 (1~10) | 스위치 켬일 때 풀이 1건당 생성 시도 상한 |
- 스위치 켬: `POST /api/reading/[id]/generate`가 상한 도달 시 **409 `{ retryExhausted: true }`** (AI 미호출) — 화면은 "다시 시도" 대신 문의 안내 필요(미구현).
- 스위치 켬: `payment/prepare`가 검증한 생년월일을 `Order.birthInfo`에 저장, `payment/confirm`은 **클라이언트가 보낸 birthInfo를 무시**하고 서버 저장값만 사용. 저장값 없는 미결제 주문은 토스 승인 전 400.
- 주의: 이 스키마가 포함된 코드는 마이그레이션 적용 전 운영 배포 금지(`docs/DATABASE.md` 4절).
