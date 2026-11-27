# 데이터베이스 구조

표시: **[현행]** 운영에 있는 구조 · **[준비됨·미적용]** 파일만 있고 운영 DB에는 적용하지 않은 것 · **[제안]** 설계 초안.

## 1. 현행 [현행] — `prisma/migrations` 앞 3개, PostgreSQL(Neon)
| 모델 | 용도 |
|---|---|
| User / Account / Session / VerificationToken | NextAuth 표준 (kakaoId 필드 있음, 미사용) |
| Order | 주문 (amount, status: PENDING/PAID/FAILED/CANCELLED, paymentKey) |
| Reading | 풀이 1건 = 본인·상대방 생년월일, readingType(BASIC·MONEY·LOVE·CAREER·BULLY·CONFLICT), status 문자열, sajuInput/claims/userAnswers/fullReading(JSON), content(구버전 마크다운) |

마이그레이션 3개: init(11-16), add_reading_types(11-17), add_reading_v2_fields(11-17). (운영 DB에 실제로 몇 개가 적용돼 있는지는 저장소에서 알 수 없다 — 적용 전 `prisma migrate status`로 확인, 4절)

현행 문제: 풀이 상태가 자유 문자열, 상품·가격 테이블 없음(19,900원 하드코딩), AI 비용 기록 없음, 계산 결과 버전 없음, 생년월일이 풀이마다 중복 저장, 상대방 정보는 저장만 되고 사용되지 않음.
현행 동작의 임시방편(코드): 잠금 시각을 `Order.updatedAt`에 빌려 씀, 생성 실패 뒤 다시 시도 횟수 제한 없음, 결제 확인 때 생년월일을 클라이언트가 다시 보냄, 윤달·분·시각 입력 방식·출생지가 `sajuInput` JSON에만 있음.

## 2. v3 안전 개선 [준비됨·미적용] — `20261127090000_reading_v3_safety`
카드 P6-01 일부 + U-01 잔여 결함(docs/TEST_REPORT.md U-01 검증 "신규 2: 재시도 비용 상한"). **운영 DB에 적용하지 않았다. 적용은 대표 승인 후(4절).**

| 표 | 추가 | 왜 |
|---|---|---|
| Reading | `attemptCount Int 기본 0` | 풀이 1건당 AI 생성 시도 상한(기본 3, `GENERATION_MAX_ATTEMPTS`). 실패 뒤 무제한 재시도 → AI 비용 상한 없음(U-01 잔여, 중간) |
| Reading | `lockedAt DateTime?` | 생성 잠금 시각. 지금은 `Order.updatedAt`을 빌려 씀 |
| Reading | `isLeapMonth Boolean 기본 false`, `birthMinute Int?`, `timeMode String?`, `ziNight Boolean?`, `birthplaceLongitude Float?` | 정확도 입력(U-03)이 JSON에만 있어 조회·재계산이 어렵다. `ziNight`는 시진 자시 계산에 필요해 함께 넣음 |
| Reading | `otherCalType`, `otherIsLeapMonth`, `otherBirthMinute`, `otherTimeMode`, `otherZiNight`, `otherBirthplaceLongitude` (모두 NULL 허용) | 상대방 정확도 입력. 상대방이 없으면 모두 NULL(그래서 `otherIsLeapMonth`도 기본값 없는 NULL 허용) |
| Order | `birthInfo Json?` | prepare 때 서버가 검증한 생년월일 저장 → confirm은 이 값만 사용(클라이언트 위조 무시) |
| AiUsage (새 표) | readingId?, chapterId?, model, inputTokens, outputTokens, cacheReadTokens(기본 0), cacheWriteTokens(기본 0), costUsd `Decimal(12,6)`, createdAt + 색인(readingId, createdAt) | AI 호출마다 모델·토큰·비용 기록(백엔드 원칙 3) |

무손실: 새 열은 모두 NULL 허용 또는 상수 기본값, 새 표 하나. 기존 열·데이터를 바꾸거나 지우지 않는다(PostgreSQL 11 이상은 상수 기본값 열 추가 때 표를 다시 쓰지 않음 — 짧은 잠금만).
파일: `prisma/migrations/20261127090000_reading_v3_safety/migration.sql`(적용), `down.sql`(되돌리기, 수동). 둘 다 `prisma migrate diff`로 DB 연결 없이 이전·현재 schema를 비교해 만들었다.

### 2.1 코드 기능 스위치 `DB_SCHEMA_V3`
환경변수 `DB_SCHEMA_V3=true`일 때만 새 열을 읽고 쓴다(`src/app/api/reading/_lib/schema-v3.ts`). 꺼져 있으면 지금 동작 그대로다(테스트로 확인 — 아래).

| 경로 | 스위치 켬 | 스위치 끔(현행) |
|---|---|---|
| 생성 잠금 `_lib/reading-lock.ts` (generate·claims·verify 공통) | 잠금 조건에 `attemptCount < 상한`, 같은 문장에서 +1, `lockedAt` 기록. 상한이면 잠금 실패 → AI 미호출. 상태 조회(status 라우트) 호환을 위해 `Order.updatedAt`도 같이 갱신(이중 기록) | 횟수 제한 없음, `Order.updatedAt`만 |
| 죽은 잠금 복구 | `lockedAt`이 10분보다 오래됨, 또는 `lockedAt`이 NULL(적용 전에 잠긴 행)이면 `Order.updatedAt` 기준 | `Order.updatedAt` 기준 |
| `POST /api/reading/[id]/generate` | 상한 도달 시 `409 { retryExhausted: true, status, error }` | 409는 "만들 수 없는 상태"만 |
| `POST /api/payment/prepare` | `Order.birthInfo`에 검증된 생년월일 저장(응답 형태는 같음) | 저장 안 함 |
| `POST /api/payment/confirm` | 클라이언트 `birthInfo` 무시, `Order.birthInfo`로 검증·계산. 풀이 레코드를 만든 뒤 `Order.birthInfo`는 지움. 저장값 없는 미결제 주문(스위치 켜기 전 준비)은 토스 승인 전에 400(돈이 나가지 않음). 저장값 없는 결제 완료 주문은 풀이가 있으면 그 id, 없으면 예외적으로 클라이언트 값으로 복구 + 경고 로그 | 클라이언트 `birthInfo`를 승인 전에 검증해 사용 |
| `POST /api/payment/confirm`·`/api/reading/direct` 풀이 생성 | 정확도 열 기록(출생지는 경도만) | 기존 열만 |

참고: claims → verify(개발 전용 경로)는 한 풀이에서 AI를 2번 부르므로 같은 상한(3)을 나눠 쓴다(실패 여유 1번).

### 2.2 설계 판단
1. **풀이 상태를 enum으로 바꾸지 않는다.** (가) 기존 행의 상태 문자열을 모두 확인하지 않고 `USING status::"ReadingStatus"`로 바꾸면 예상 밖 값 한 개로 마이그레이션 전체가 실패하거나, 정리하려면 데이터 수정이 필요하다(운영 데이터 변경 = 대표 승인 대상). (나) enum으로 바꾸면 Prisma 타입이 바뀌어 새 코드와 DB가 동시에 바뀌어야 한다 → "마이그레이션 먼저, 스위치 나중" 단계 배포가 깨진다. (다) PostgreSQL enum은 값 추가·삭제가 번거롭다(값 삭제는 사실상 표 재작성). (라) 코드는 이미 `READING_STATUS` 상수 한 곳에서만 상태를 쓴다. → 필요하면 나중에 데이터 점검 뒤 `CHECK (status IN (...))` 제약을 별도 마이그레이션으로 검토.
2. **출생지 이름은 Reading 열에 저장하지 않는다**(경도만). 단, 예전부터 `Reading.sajuInput` JSON에는 출생지 이름이 들어 있다(현행 유지, 별도 결정 필요). `Order.birthInfo`는 같은 sajuInput을 다시 만들어야 하므로 이름까지 담지만, 풀이 레코드를 만든 직후 지운다. **미결제로 남은 주문의 `birthInfo` 보관 기한(예: 24시간 뒤 삭제)은 미정 — 대표 결정 필요.**
3. **AiUsage.readingId는 NULL 허용 + 풀이 삭제 시 NULL**(SetNull). 탈퇴 등으로 풀이를 지워도 비용 기록은 남아야 한다. 표에는 프롬프트·응답 본문 등 개인정보를 두지 않는다. 비용 단위는 미국 달러(토큰 단가가 달러) — 원화 환산은 보고서에서.
4. **AiUsage 기록 코드는 아직 연결하지 않았다.** `src/lib/generate-reading-v2.ts`가 토큰 사용량을 돌려주지 않고(로그로만 출력), 새 콘텐츠 엔진(`src/engine/content/**`)이 다른 직원 작업 중이라 그쪽 호출부가 정해진 뒤 연결한다(다음 작업).

### 2.3 검증(가짜 DB) — `tests/security/schema-v3.test.ts`, `tests/security/_fakedb-v3.ts`
스위치 켬/끔 두 경우 34건: 3회 실패 후 409·AI 3회만, 동시 다시 시도에도 상한 유지, 상한 1 설정, claims도 같은 상한, lockedAt 기록·복구 기준(최근 lockedAt이면 202, NULL이면 Order.updatedAt), 죽은 잠금+상한이면 FAILED로만, 끔 상태 무제한(현행), birthInfo 서버 저장·위조 무시·손상 시 승인 전 500·예전 주문 처리·생성 후 삭제, 새 열 기록·출생지 이름 미저장. 코드를 일부러 망가뜨리면(상한 조건 삭제·클라이언트 값 사용·lockedAt 기준 변경) 해당 테스트가 실패하는 것도 확인했다.
**미검증**: 실제 PostgreSQL에서의 마이그레이션 실행, 조건부 `updateMany`+`increment`의 행 잠금 동작, Neon에서의 소요 시간. → 4절 ②(개발 브랜치 리허설)에서 확인한다.

## 3. 목표 구조 초안 [제안] (6단계, 대표 승인 후 적용)
| 모델 | 핵심 필드 |
|---|---|
| Profile | 사용자의 사주 대상(본인·가족 등), 생년월일시·윤달·출생지·성별 |
| Chart | profileId, engineVersion, options, calendarResult(JSON), ruleAnalysis(JSON) |
| Product | 코드, 이름, 가격, 포함 장 목록, 판매 여부 |
| Order | productId, 서버 결정 금액, 결제 상태 이력 |
| Entitlement | 이용권(주문→발급, 사용 시각, 잔여 횟수) |
| Reading | chartId, productId, status(문자열 유지 — 2.2-1), 장별 결과, 검증 결과 |
| AiUsage | **v3에서 먼저 만듦(2절)** — readingId, 모델, 입력·출력·캐시 토큰, 비용 |
| SurveyAnswer | profileId, 문항, 답, source=user |
| AuditLog | 관리자 작업·환불·삭제 기록 |

개인정보: 탈퇴 시 Profile·Reading 삭제 경로, 생년월일 외 민감정보 미수집, 운영 DB 접근 최소화.
v3의 정확도 열은 Profile이 생기면 그쪽으로 옮길 후보다(그때는 Reading에서 읽기만 남김).

## 4. 마이그레이션 적용 절차 (대표 승인 후에만)
**순서가 중요하다: ① 백업 → ② 개발 브랜치 리허설 → ③ 운영 적용 → ④ 새 코드 배포(스위치 끔) → ⑤ 스위치 켬.**
새 schema로 만든 Prisma 클라이언트는 `select` 없는 조회(예: 풀이 화면 `findUnique`)에서 새 열까지 읽는다. 그래서 **이 schema가 든 코드를 마이그레이션보다 먼저 배포하면 스위치가 꺼져 있어도 "열이 없다" 오류로 화면이 깨진다.** 반대로 마이그레이션만 먼저 적용하면 지금 운영 코드는 새 열을 모르고 그대로 동작한다(추가만 하므로). Vercel 빌드는 `prisma generate`만 하고 마이그레이션은 하지 않는다.

| 단계 | 할 일 | 확인 |
|---|---|---|
| ⓪ 승인 | 대표가 적용 일시·담당자 승인. 위험 명령 차단 규칙(`.claude/settings.json`)상 `prisma migrate deploy`는 승인 창을 거쳐야 한다 | 승인 기록(docs/DECISIONS.md) |
| ① 백업 | Neon 콘솔에서 운영 브랜치의 복원 시점(PITR) 보관 기간 확인 + 적용 직전 시각 기록. 가능하면 운영 브랜치에서 새 브랜치(스냅숏)를 만들어 둠 | 복원 가능한 시점·브랜치 이름 기록 |
| ② 리허설 | 운영에서 갈라진 Neon **개발 브랜치**의 연결 주소로 `npx prisma migrate status` → `npx prisma migrate deploy` → 개발 브랜치에서 새 코드(스위치 켬)로 결제(테스트 키)·생성·재시도 3회 확인. 이때 U-01 조건 (다) 실DB 동시성 실측도 같이 | 오류 없음, 소요 시간, 기존 풀이 화면 정상 |
| ③ 운영 적용 | 운영 `DIRECT_URL`로 `npx prisma migrate status`(보류 1개 = reading_v3_safety 인지) → `npx prisma migrate deploy` | `_prisma_migrations`에 reading_v3_safety 기록, 아래 확인 쿼리 |
| ④ 배포 | 새 코드를 스위치 끈 채 배포 | 풀이 화면·내 풀이 목록·결제 준비 정상 |
| ⑤ 스위치 | Vercel 환경변수 `DB_SCHEMA_V3=true`(선택: `GENERATION_MAX_ATTEMPTS`, 기본 3) → 재배포 | 새 풀이에 `attemptCount`·`lockedAt` 기록, 새 주문에 `birthInfo` 저장 뒤 삭제 |

확인 쿼리(읽기 전용, 개인정보 열 조회 금지):
```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'Reading' AND column_name IN ('attemptCount','lockedAt','isLeapMonth');
SELECT status, count(*) FROM "Reading" GROUP BY status;          -- 적용 전후 개수 같음
SELECT count(*) FROM "Reading" WHERE "attemptCount" <> 0;          -- 적용 직후 0
SELECT to_regclass('"AiUsage"');                                   -- 표 존재
```

### 4.1 되돌리기
- **스위치만 끄기**(가장 먼저 쓸 수단): `DB_SCHEMA_V3` 삭제 → 재배포. DB는 그대로 둔다. 주의: 켜져 있던 동안 상한에 닿은 풀이는 꺼지면 다시 시도가 무제한으로 돌아가고, 결제 확인은 다시 클라이언트 생년월일을 쓴다. 꺼진 직후 결제 중이던 사용자는 영향 없음 — 단, 결제 화면이 confirm에 birthInfo를 계속 보내는 동안만이다(화면에서 birthInfo 전송을 없애는 변경은 스위치를 끌 일이 없다고 확정한 뒤에 한다).
- **DB까지 되돌리기**(대표 승인 필요, 데이터 삭제): ① 스위치 끈 배포 확인 → ② 이 schema 이전 코드로 배포(새 클라이언트가 없는 열을 읽지 않도록) → ③ 백업 확인 → ④ `down.sql` 실행(트랜잭션) → ⑤ `npx prisma migrate resolve --rolled-back 20261127090000_reading_v3_safety`. 지워지는 것: 시도 횟수·잠금 시각·정확도 열·주문 birthInfo·AI 사용 기록. 정확도 입력은 `sajuInput` JSON에도 있으므로 풀이에는 영향 없음.
- 적용 후에는 `migration.sql`을 고치지 않는다(Prisma가 체크섬으로 변경을 감지). 수정은 새 마이그레이션으로.
