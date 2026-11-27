# 데이터베이스 구조

## 1. 현행 [현행] — `prisma/schema.prisma`, PostgreSQL(Neon)
| 모델 | 용도 |
|---|---|
| User / Account / Session / VerificationToken | NextAuth 표준 (kakaoId 필드 있음, 미사용) |
| Order | 주문 (amount, status: PENDING/PAID/FAILED/CANCELLED, paymentKey) |
| Reading | 풀이 1건 = 본인·상대방 생년월일, readingType(BASIC·MONEY·LOVE·CAREER·BULLY·CONFLICT), status 문자열, sajuInput/claims/userAnswers/fullReading(JSON), content(구버전 마크다운) |

마이그레이션 3개: init(11-16), add_reading_types(11-17), add_reading_v2_fields(11-17).

현행 문제: 풀이 상태가 자유 문자열, 상품·가격 테이블 없음(19,900원 하드코딩), AI 비용 기록 없음, 계산 결과 버전 없음, 생년월일이 풀이마다 중복 저장, 상대방 정보는 저장만 되고 사용되지 않음.

## 2. 목표 구조 초안 [제안] (6단계, 대표 승인 후 적용)
| 모델 | 핵심 필드 |
|---|---|
| Profile | 사용자의 사주 대상(본인·가족 등), 생년월일시·윤달·출생지·성별 |
| Chart | profileId, engineVersion, options, calendarResult(JSON), ruleAnalysis(JSON) |
| Product | 코드, 이름, 가격, 포함 장 목록, 판매 여부 |
| Order | productId, 서버 결정 금액, 결제 상태 이력 |
| Entitlement | 이용권(주문→발급, 사용 시각, 잔여 횟수) |
| Reading | chartId, productId, status(enum), 장별 결과, 검증 결과 |
| AiUsage | readingId, 모델, 입력·출력·캐시 토큰, 비용(원) |
| SurveyAnswer | profileId, 문항, 답, source=user |
| AuditLog | 관리자 작업·환불·삭제 기록 |

개인정보: 탈퇴 시 Profile·Reading 삭제 경로, 생년월일 외 민감정보 미수집, 운영 DB 접근 최소화.
