# 명리 해석 지식베이스 [구조 제안]

> 관리: 명리학 연구소장. **확인하지 않은 고전 원문·편명·출처는 입력하지 않는다.**

## 항목 형식 (규칙 1건 = 1항목, YAML 또는 JSON)
```yaml
id: tengod.jeonggwan.basic        # 규칙 ID
topic: 십성 / 정관
classic: 자평진전                  # 연해자평 | 삼명통회 | 적천수 | 자평진전 | 궁통보감 | 현대
classical:
  summary: "고전의 원래 해석 요지"
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

## 진행 순서 (P3-08)
1. 고전별 판본과 열람 가능한 원문 출처 조사·기록(서지 정보 포함)
2. 학파별 차이표: 자시 처리, 지장간 비율, 12운성 음간, 대운수, 신강약 판단, 용신 결정법
3. 첫 묶음: 십성 기본 의미, 궁통보감 조후(월별)
