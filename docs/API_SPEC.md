# API 명세

## 1. 현행 API [현행]
모든 API는 로그인 세션(`auth()`)이 필요하다.

| 메서드·경로 | 하는 일 | 비고 |
|---|---|---|
| `POST /api/reading/direct` | 입력값으로 주문·풀이 레코드 생성(상태 PENDING) | 현재 입력 화면이 사용하는 유일한 경로. 결제 없이 주문 생성 → 긴급 조치 대상(U-01) |
| `POST /api/reading/[id]/generate` | AI 본 풀이 생성 → COMPLETE | 대기 화면이 열릴 때 호출. 중복 실행 방지 없음 → U-01 |
| `GET /api/reading/[id]/status` | 상태 조회(폴링) | |
| `POST /api/reading/[id]/claims` | (구) 1차 "지나온 길 단정" 생성 | 이 기능의 화면(`/verify/[id]`)으로 가는 링크 없음 — 현재 미사용 |
| `POST /api/reading/[id]/verify` | (구) 사용자 맞다/아니다 답변 반영 후 풀이 | 〃 미사용 |
| `POST /api/payment/prepare` | 주문 생성(19,900원) | 호출하는 화면 없음 |
| `POST /api/payment/confirm` | 토스 결제 승인 후 구버전 풀이 생성 | 구버전 생성기 사용 |
| `GET/POST /api/auth/[...nextauth]` | 로그인 | Google |

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
