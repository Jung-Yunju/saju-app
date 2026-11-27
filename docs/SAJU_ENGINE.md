# 사주엔진 설계 [제안]

> 계산 명세: 사주엔진 개발자 · 해석 규칙: 명리학 연구소장 · 검증: 품질검증 담당자

## 1. 현행 코드 상태 [현행]
| 파일 | 용도 | 문제 |
|---|---|---|
| `src/lib/saju.ts` | 결과 화면의 여덟 글자·오행 표시 | 절기 무시(양력 월=사주 월), 입춘 무시(1/1에 연도 바뀜) → 감사 결과 42% 오류 |
| `src/lib/saju-input.ts` | AI에 넘기는 사주 JSON (lunar-javascript) | 절기 시각이 중국 표준시 기준(한국과 1시간 차), 시간 모름=0시 가정, 윤달 입력 불가, 기준 연도 2026 고정, 진태양시·서머타임 미반영 |

상세는 [TEST_REPORT.md](TEST_REPORT.md). 재현: `bash scripts/qa/legacy-engine-audit.sh`

## 2. 데이터 구조 초안 (P3-01에서 확정)

```ts
// 입력
interface BirthInput {
  calendar: "solar" | "lunar"
  year: number; month: number; day: number
  isLeapMonth?: boolean            // 음력일 때만
  time: { hour: number; minute: number } | null   // null = 모름
  timezone: string                 // 기본 "Asia/Seoul" (IANA)
  birthplace?: { name: string; longitude: number }  // 진태양시용
  gender: "M" | "F"
}

// ① 역법 객관값 — 해석 없음
interface CalendarResult {
  engineVersion: string
  options: EngineOptions            // 어떤 학파 설정으로 계산했는지
  utcInstant: string | null         // 보정된 출생 순간 (UTC)
  corrections: { standardOffsetMin: number; dstMin: number; solarTimeMin: number }
  solarDate: string; lunarDate: { y: number; m: number; d: number; leap: boolean }
  pillars: { year: Pillar; month: Pillar; day: Pillar; hour: Pillar | null }
  solarTerm: { current: string; enteredAtUtc: string; next: string; nextAtUtc: string }
  luck: { direction: "forward" | "backward"; startAge: number; daeun: Daeun[] }
  warnings: string[]                // 예: "절입 30분 이내 출생 — 월주 경계"
}
interface Pillar { stem: Stem; branch: Branch }   // 한자·한글·오행·음양은 조회 함수로

// ② 명리 해석 재료
interface RuleAnalysis {
  hiddenStems: Record<PillarKey, HiddenStem[]>
  tenGods: ...; twelveStages: ...; interactions: Interaction[] // 합·충·형·파·해 (근거 글자 포함)
  elements: { counts: ...; weighted: ... }
  strength: { score: number; verdict: "신강" | "중화" | "신약"; basis: string[] }
  structureCandidates: { name: string; school: string; basis: string[] }[]   // 격국 후보
  usefulGodCandidates: { element: Element; method: "억부" | "조후" | "통관" | "병약"; school: string; basis: string[] }[]
}
```

## 3. 학파·설정 옵션 (기본값은 대표 승인 사항)

| 옵션 | 선택지 | 기본값 제안 | 비고 |
|---|---|---|---|
| 자시 처리 | 야자시·조자시 구분 / 23시부터 다음 날 | 대표 결정 | 현행 두 코드가 서로 다르게 처리 중 |
| 진태양시 | 적용 / 미적용 | 적용(출생지 미입력 시 서울 경도) | 서울은 표준 경선보다 약 32분 늦음 |
| 서머타임 | 공식 기록대로 보정 | 보정 | 1948~51, 1955~60, 1987~88 |
| 표준시 이력 | IANA Asia/Seoul | 적용 | 1954~61 UTC+8:30 |
| 대운수 계산 | 3일=1년(반올림/버림), 정밀 환산 | 연구소장 제안 | |
| 지장간 비율 | 학파별 일수표 | 연구소장 제안 | |
| 12운성 음간 | 양생음사 / 음양동생 | 연구소장 제안 | |
| 시간 모름 | 시주 제외 3주 분석 | 시주 제외 | 0시 가정 금지 |

## 시간 보정
입력 현지시각 → IANA 시간대 규칙(서머타임·표준시 변경 포함)으로 UTC 계산 → (옵션) 출생지 경도로 진태양시 보정 → 절기·시주 판정. Node.js 내장 국제화 데이터로 서울의 1955년(UTC+9:30 서머타임), 1960년(UTC+8:30), 1987~88년(UTC+10 서머타임) 이력을 확인함.

## 만세력
- 절입 시각은 UTC로 계산·비교한다. 외부 라이브러리(lunar-javascript)는 UTC+8 기준이므로, 사용 시 반드시 시간대 변환 후 입력한다.
- 1차 구현은 lunar-javascript를 내부 계산기로 감싸되, 한국천문연구원 자료 기반 골든 테스트로 검증한다. 오차가 나오면 천문 알고리즘 자체 구현으로 교체한다.
- 존재하지 않는 날짜(음력 30일 없는 달, 윤달 없는 해의 윤달)는 오류로 거부한다.

## 운
대운 순행/역행(연간 음양 × 성별), 대운수, 세운·월운은 **실행 시점 기준**으로 계산(연도 고정값 금지).

## 규칙 엔진
지장간·십성·12운성·합충형파해·공망·신살은 코드 표(table)로 구현하고 각 결과에 근거 글자 위치를 남긴다.

## 해석 규칙
연구소장이 `docs/knowledge/`에 규칙 단위로 기록 → 엔진 개발자가 구현. 고전별 관점:
- 연해자평: 기본 체계(십성·격국의 기초)
- 삼명통회: 다양한 이론·사례(신살 등)
- 적천수: 전체 기세·균형(신강약 판단)
- 자평진전: 격국과 사회적 역할
- 궁통보감: 계절·조후 용신

## 4. 버전 관리
`engineVersion`(예: `calendar@1.0.0+rules@1.0.0`)을 모든 결과에 저장. 계산 결과가 바뀌는 수정은 버전을 올리고 CHANGELOG에 기록한다.
