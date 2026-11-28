# 명리 해석 지식베이스 [구조 제안]

> 관리: 명리학 연구소장. **확인하지 않은 고전 원문·편명·출처는 입력하지 않는다.**

## 항목 형식 (규칙 1건 = 1항목, YAML 또는 JSON)
```yaml
id: tengod.jeonggwan.basic        # 규칙 ID
topic: 십성 / 정관
classic: 자평진전                  # 연해자평 | 삼명통회 | 적천수 | 자평진전 | 궁통보감 | 현대
classical:
  summary: "고전의 원래 해석 요지"
  basis: paraphrase                # paraphrase(요지·기억) | original(원문 대조 후 작성)
  removed_in_modern: []            # 현대 해석에서 걷어 낸 원래 판정(요지 그대로 보존)
  original_text: null              # 판본에서 직접 확인한 원문만. 없으면 null
  citation: null                   # 판본·권·편·출처 URL
  source_status: unverified        # verified | unverified
modern:
  interpretation: "서비스용 현대 해석 (도덕·성별 판정 제거)"
  notes: "고전 판정을 바꾼 이유"
schools:                           # 학파 간 차이
  - school: "…"
    view: "…"
conflicts_with: []                 # 상충하는 다른 규칙 ID
engine_rule: rules.tenGods          # 구현 위치
reviewed_by: []                    # 검수 기록
```

- `source_status: verified`는 [sources.md](sources.md) §0의 **L2(본문 직접 대조)** 일 때만 쓴다. 서지·URL 존재만 확인(L1)한 경우도 `unverified`.
- 한 파일에 여러 항목을 넣을 때는 `meta:` + `entries:` 목록으로 묶는다.

## 파일 목록
| 파일 | 내용 | 상태 |
|---|---|---|
| [sources.md](sources.md) | 5대 고전 서지·원문 열람처·저작권 메모 | 1차 (L2 0건) |
| [schools.md](schools.md) | 학파·설정 차이표, 엔진 옵션·기본값 제안 | 제안 |
| [rules-spec.md](rules-spec.md) | 규칙 엔진(P3-05) 구현 명세 | 제안 |
| [strength-structure-spec.md](strength-structure-spec.md) | 신강약·격국·용신·조후·기세 판단 명세(P3-06), 경계 사례 12건 | 제안 (L2 0건, 수치는 설계값) |
| [gaeun.md](gaeun.md) | 개운(바꿔 사는 법) 정리·서비스 안전 기준·엔진 연결 규칙(범주 30개)·관점 갈림 처리 (D-023 ②) | 제안 (L0만, 고전 인용 0건) |
| [../redesign/02-archetypes.md](../redesign/02-archetypes.md) | 신성 원형 12 판정 관문(엔진 값 기준)·명리 근거 요지·대표 사주 24(손계산)·108 확장 원칙 (D-026) | 제안 (창작 상징, L0만, 고전 인용 0건, 엔진 확인 전) |
| [personalization/expression-dimensions.md](personalization/expression-dimensions.md) | 사주 발현 분석 기질 차원 8개(@0.2.0, 결 차원은 양극 축 `grain`) · 원국 판정 규칙(rules@0.4.0 필드) · 운 대응 · MBTI 대응 의견(서비스 모델 가설, 신호 3줄) · 불확실 처리 (D-035) | 제안 (L0만, 고전 인용 0건, 문턱값은 설계. 0.1.0 규칙은 QA 4,000건 일치, 0.2.0 변경분은 엔진 확인 전) |
| [entries/tengods.yaml](entries/tengods.yaml) | 십성 10개 기본 의미 | 요지만(unverified) |
| [entries/johu-outline.yaml](entries/johu-outline.yaml) | 궁통보감 조후 표 뼈대 | 칸 0/120 |

## 진행 순서 (P3-08)
1. 고전별 판본과 열람 가능한 원문 출처 조사·기록(서지 정보 포함)
2. 학파별 차이표: 자시 처리, 지장간 비율, 12운성 음간, 대운수, 신강약 판단, 용신 결정법
3. 첫 묶음: 십성 기본 의미, 궁통보감 조후(월별)
