# 사주 발현 분석 엔진 — 계약서 (총괄실장)

> 대표 지시 2026-11-28 「운명비서 — 사주 발현 분석 엔진 개발 지시」(D-035). 이 문서가 직원 간 공통 규격이다. 바꿀 때는 총괄실장 승인.
> 한 줄 요약: **"하늘이 만들어 준 나(원국) → 세월이 만들어 낸 나(발현) → 앞으로 내가 만들어 갈 나(운·개운)"** 를 코드로 판정하는 엔진.

## 1. 대표 지시 필수 원칙 (그대로)
1. MBTI를 단순한 성격 설명으로 추가하지 않는다.
2. 사주 원국과 대운·세운 계산은 MBTI에 따라 변경하지 않는다.
3. MBTI만으로 고객의 과거 환경이나 실제 경험을 단정하지 않는다.
4. 확인된 고객 정보와 추론한 내용을 명확하게 구분한다.
5. 과학적으로 검증되지 않은 사주와 MBTI의 상관관계를 검증된 사실처럼 표현하지 않는다.
6. 사주 발현 분석은 운명비서의 독자적인 자기이해 콘텐츠 모델로 개발한다.
7. 동일한 사주라도 MBTI와 실제 경험에 따라 해석 및 행동 조언이 달라지는 구조를 구현한다.

회사 원칙과 함께: 판단은 코드(결정론), AI는 확정된 결과를 서술만. 사용자가 말하지 않은 경험은 지어내지 않는다(D-023).

## 2. 이미 있는 것 (재사용 — 지우지 않음)
| 무엇 | 위치 |
|---|---|
| 설문 17문항(직업 상태·일 방식·강점·약점·바꾸고 싶은 것·인생 사건·MBTI 등) | `src/engine/personalize/survey.ts` |
| 사용자 사실(`UserFact`, `selfReported: true`, `useAs: "background-only"`) | `src/engine/personalize/user-facts.ts`, `types.ts` |
| 사용자 사실 ↔ 십성 묶음 연결(`linkFactsToChart`) | `src/engine/personalize/lived-link.ts` |
| 규칙 판단(십성·지장간·신강약·용신·대운·세운) | `src/engine/rules/**` (rules@0.4.0) — **수정 금지** |
| 신성 원형(영물) | `src/engine/archetype/**` (archetype@0.1.0) |
| 개운 30종 선택 | `src/engine/content/gaeun.ts` (`pickGaeun`) |

## 3. 파이프라인 위치
`calendar → rules → archetype → personalize/expression(신규) → content facts → prompts(AI 서술) → verify`
발현 엔진은 **원국·운 계산 결과를 읽기만** 한다. 입력에 MBTI가 있든 없든 `RuleAnalysis`는 같은 값이어야 한다(시험으로 고정).

## 4. 신규 모듈과 파일 소유
| 경로 | 담당 |
|---|---|
| `docs/knowledge/personalization/expression-dimensions.md` — 기질 차원별 명리 근거·근거 등급 | 명리학 연구소장 |
| `src/engine/personalize/expression/**` + `tests` 하위 시험 — 엔진 구현 | 개인화 분석 연구원 |
| `content/expression/dimensions.json` — 차원 표(데이터, 코드 아님) | 개인화 연구원 작성 → 연구소장 근거 검수 |
| 9개 결과 항목 문안 틀(할머니 말투) | 콘텐츠 작가(엔진 확정 뒤) |
| 독립 검증 | 품질검증 담당 |

## 5. 데이터 구조 (요지 — 이름은 이대로 맞춘다)
```ts
export const EXPRESSION_ENGINE_VERSION = "expression@0.1.0"

/** 기질 차원 — 사주에서 해석 가능한 잠재력 한 갈래. 표는 content/expression/dimensions.json */
interface TraitDimension {
  id: string                 // 예: "expression"(표현), "drive"(주도), "realism"(현실 감각), "duty"(책임·규범), "learning"(배움·수용) …
  label: string              // 쉬운 말
}

/** ① 원국에서 읽은 잠재력 — 근거 필수 */
interface ChartPotential {
  dimensionId: string
  level: "strong" | "moderate" | "faint"   // 숫자 점수는 내부, 화면엔 단계만
  basis: { ruleId: string; positions: string[]; note: string }[]  // 어느 자리 어느 글자, 어떤 규칙
  evidenceLevel: "L0" | "L1" | "L2"        // L0 = 서비스 자체 규칙(고전 원문 대조 안 됨)
}

/** ② 자기보고 — MBTI 4축 + 설문 */
interface SelfReport {
  mbti?: { axis: "EI" | "SN" | "TF" | "JP"; pole: string; sure: boolean }[]   // 모름·건너뜀 허용
  facts: UserFact[]          // 직업·경험·관심사·삶의 목표 (기존 UserFact 그대로)
}

/** ③ 비교 결과 — 반드시 '추론'으로 표시 */
type ExpressionStatus =
  | "expressed"      // 사주 잠재력 있고, 자기보고도 그쪽 → 현재 발현된 기질
  | "developed"      // 사주는 약한데 자기보고는 강함 → 살아오며 키운 것으로 추정
  | "dormant"        // 사주는 강한데 자기보고는 약함 → 아직 덜 쓴 잠재력일 가능성
  | "quiet"          // 둘 다 약함
  | "unknown"        // 자기보고 없음 → 사주 쪽만 말한다
interface DimensionReading {
  dimensionId: string
  chart: ChartPotential
  self: { signal: "high" | "low" | "none"; from: string[] }   // 어떤 MBTI 축·UserFact id에서 왔는지
  status: ExpressionStatus
  inferred: true             // 항상 true — 화면·AI 서술에서 "~일 수 있다"로만
}

interface ExpressionReport {
  version: string; rulesHash: string
  innate: ChartPotential[]             // 타고난 나의 본질
  readings: DimensionReading[]         // 발현·발전·미활용·차이
  conflicts: { dimensionId?: string; kind: "chart-vs-self" | "self-vs-self" | "missing"; note: string }[]  // 상충·불확실
  luck: { scope: "daeun" | "seun"; ganzhi: string; activates: string[]; strategy: string[] }[]          // 운이 건드리는 차원 × 현재 상태 → 행동 방향 id
  gaeun: string[]                      // pickGaeun 결과 id(상태에 따라 순서 조정)
  archetype: { id: string }            // 신성과 내면의 영물(기존 엔진)
  sections: Record<ExpressionSectionId, string[]>   // 9개 결과 항목 ↔ 근거 id 목록
}

type ExpressionSectionId =
  | "innateEssence" | "expressedNow" | "developedAbility" | "untappedPotential" | "gap"
  | "archetype" | "growable" | "luckStrategy" | "gaeun"
```

## 6. MBTI 다루는 법 (원칙 1·3·5의 구체화)
- MBTI는 **"지금 스스로 그렇게 느낀다"는 자기보고**로만 쓴다. 원국·운 계산 입력에 절대 들어가지 않는다.
- MBTI 축 ↔ 기질 차원 대응은 **운명비서 자기이해 모델의 가설 표**다. 표에 `claim: "service-model"`을 붙이고, 출력에는 "검증된 상관"이라는 표현을 만들 수 없게 한다(문구 금지어 시험).
- MBTI만으로는 `developed`(살아오며 키움)를 판정하지 않는다 — **직업·경험 등 사실(UserFact) 1개 이상이 같은 방향**일 때만. MBTI만 있으면 `self.signal`을 약하게(한 단계 낮춤) 쓰고 `conflicts`에 "missing"을 남긴다.
- MBTI를 모르거나 건너뛰어도 엔진은 돈다(그때는 설문 사실만, 둘 다 없으면 `unknown`).

## 7. 반드시 통과해야 할 시험
1. 같은 원국 + MBTI 다름 → `RuleAnalysis`·대운·세운 값은 완전히 같고, `readings`·`luck.strategy`는 달라진다(원칙 2·7).
2. 같은 원국 + 같은 MBTI + 경험 다름 → 결과가 달라진다.
3. 모든 `DimensionReading.inferred === true`, 모든 `ChartPotential.basis`가 비어 있지 않다.
4. 사용자 입력에 없는 경험 사실이 출력에 생기지 않는다(UserFact id 집합 ⊆ 입력).
5. MBTI만 있을 때 `developed`가 나오지 않는다.
6. 결정론: 같은 입력 → 같은 출력(1,000회 무작위).
7. 금지 표현: "과학적으로 입증", "검증된 상관", "MBTI가 사주를 바꾼다" 류가 데이터·문안에 없다.

## 8. 하지 않는 것 (이번 범위 밖)
- 화면(설문 UI·결과 화면)과 유료 상품 연결은 엔진·문안 검증 후 별도 지시. 가격·결제 변경 없음.
- 외부 AI 호출 없음(엔진은 코드만). MBTI 원문 검사지(유료 저작물)를 가져다 쓰지 않는다 — 4축 자기선택만.
