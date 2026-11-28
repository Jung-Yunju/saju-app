# 살아온 모습 반영 (D-023 ①)

대표 취지: 같은 날 태어나도 사는 모습은 다르다. 사주(타고난 것)만이 아니라 사용자가 말한 살아온 모습을 풀이에 함께 쓴다. 단, 두 출처는 데이터에서도 문장에서도 섞지 않는다.

## 1. 상품별 질문 세트 (전부 객관식, 건너뛰기 가능, 상품별 12문항 이내)

새 문항 5개(기존 12개에 추가, 전체 17개). 기존 문항(직업 상태·연애 상태·자녀·형제 순서·지난 큰 일 등)은 그대로 쓴다.

| 문항 id | 묻는 것 | 풀이에서 쓰는 곳 |
|---|---|---|
| occupationStatus(기존) | 지금 하는 일 | 십성을 학생/직장/사업 장면으로 옮김 |
| workStyle(신규) | 일하는 방식(혼자 깊게/함께/대면/이끌기/유동) | 식상·관성·비겁·인성 서술의 장면 선택, 글자와 다르면 "글자 밖에서 익힌 방식"으로 존중 |
| relationshipStatus(기존) | 관계 상태 | 연애·가족 장의 말투 |
| recentChanges(신규) | 최근 3년 큰 변화(이사·이직·이별·새 인연·출산·시작·접음) + 해 | 배경으로만 사용, 그 해는 맞히기 문장에서 제외 |
| selfStrength(신규, 최대 2) | 스스로 느끼는 강점 | 사주 기질 서술 옆에 나란히 둠. 원국·운 계산 근거로 쓰지 않고 맞다/틀리다를 판정하지 않는다. 발현 비교(expression 엔진, D-035)에서 '스스로 느끼는 모습' 신호로만 쓰고 결과는 항상 추론으로 표시 |
| selfWeakness(신규, 최대 2) | 스스로 아쉬운 점 | 조언의 눈높이 맞춤. 원인 단정 금지 |
| changeWish(신규, 1개) | 바꾸고 싶은 것 1가지 | 개운(D-023 ②)의 출발점: 글자가 말하는 보완 방향 중 이 주제와 닿는 것을 먼저 풀이 |

상품별 노출(필수=화면에서 먼저 묻는 것, 모두 건너뛸 수 있음). 괄호는 상품당 문항 수:
- free(4): 변화 없음. 무료는 최소 수집.
- basic(12): recentChanges, selfStrength, changeWish 선택.
- love(12): recentChanges, changeWish 선택.
- money(12): workStyle, recentChanges, selfStrength, selfWeakness, changeWish 선택.
- career(11): workStyle 필수, 나머지 선택.
- compat(6): 변화 없음(두 사람 풀이라 한쪽의 살아온 모습을 얹지 않음).
- concern(11): changeWish 필수, 나머지 선택.

개인정보 최소화: 이름·회사명·지명·직책은 받지 않는다. 연도는 최근 3년 문항에서 범위(기준 연도 -3 ~ 현재)를 벗어나면 그 응답을 버린다. 건강·종교·성적 지향·정치는 여전히 묻지 않는다(이별·출산은 사건 종류만 받고 사유·상대는 받지 않음). 자유 서술은 대표 결정 E4 전까지 없다.

## 2. 사주 경향 ↔ 사용자 사실 연결 규칙

데이터: 글자에서 나온 것은 `chartTendencies`(source:"chart"), 사용자가 말한 것은 `userFacts`(source:"user", useAs:"background-only"). 연결 결과는 `linkFactToChart`가 `match | mismatch | unlinked` 세 가지로만 내보내며 사실을 바꾸거나 덧붙이지 않는다. 십성 대응표(`lived-link.ts`)는 문형을 고르는 편의 매핑이지 사주 판정이 아니다.

공통: 사용자 사실을 말할 때는 출처를 밝힌다("말씀해 주신 대로", "네가 직접 알려 준"). 사용자가 말하지 않은 경험을 만들지 않는다. 이유·원인을 사주로 단정하지 않는다("사주 때문에 그렇게 됐다" 금지). 미래 예측이 과학적으로 입증됐다고 쓰지 않는다.

### 2-1 일치(match): 글자에도 있고 사용자도 말함
문형: "글자에 ○○이 보이는데, 말씀하신 ○○과 닿아 있네요." 확인하는 어조, 단정은 피한다. 일치를 "사주가 맞혔다"의 증거로 쓰지 않는다.

### 2-2 불일치(mismatch): 글자에는 약한데 사용자는 살아 냄
문형 예: 재성이 비어 있음(글자) + 자영업 5년(사용자) → "글자로는 돈을 다루는 손이 두드러지게 보이지 않는데, 말씀하신 대로 5년째 장사를 해 오셨죠. 이건 글자 밖에서 익힌 힘이에요." 금지: "사주와 달리 특이하네요" 같은 틀렸다는 뉘앙스, 사용자 삶을 글자로 재단하기, 글자가 맞고 사용자가 예외라는 식의 서술. 둘 다 그대로 존중한다.

### 2-3 사주에 없는 사실(unlinked)
이사·이별·바꾸고 싶은 것 등 글자와 연결할 근거가 없는 사실은 배경으로만 쓴다. 억지로 십성에 끼워 맞추지 않는다. 그 해(period)는 `noGuessYears`로 넘어가 "그해에 ○○이 있었다"를 맞히는 서술에서 뺀다.

### 2-4 changeWish(바꾸고 싶은 것)
사주의 보완 방향 중 이 주제와 닿는 것만 골라 개운 조언의 첫머리로 쓴다. 닿는 것이 없으면 억지로 잇지 않고 일반 조언으로 돌린다. 결과·성공을 약속하지 않는다.

## 3. 코드 위치
- `src/engine/personalize/survey.ts`: 문항 정의(`yearWindow`, `factPrefix` 확장 필드), 검증.
- `src/engine/personalize/user-facts.ts`: `answersToUserFacts`, `buildUserFacts`. 기존 UserFact 형태 그대로라 `src/engine/content/facts.ts`의 `{topic, value:label, period}` 변환과 호환.
- `src/engine/personalize/lived-link.ts`: `linkFactToChart`(호출자가 십성 묶음별 개수를 집계해 넘김).
- 사실 id: 기존 `life_event:*`는 유지, 최근 변화는 `recent_change:*`(같은 항목이 두 문항에 있어도 충돌하지 않음).

## 3-1. 발현 비교(D-035)와의 관계
`src/engine/personalize/expression/`(발현 엔진)은 selfStrength·workStyle 등 **기질 답**과 직업 상태·최근 변화·지난 일 같은 **상황 답**, 그리고 MBTI 4축 자기선택을 차원별 '스스로 느끼는 모습' 신호로 읽어 원국 잠재력과 비교한다. 원국·운 계산에는 들어가지 않으며, 결과(발현·발전·미활용 등)는 모두 `inferred: true`(추론)다. 상황 답만으로는 '살아오며 키운 힘(developed)'을 판정하지 않는다. 상황 답의 십성 묶음은 이 파일의 `lived-link.ts` 대응을 철자 변환표(`bigeop→bigyeop`, `gwanseong→gwansal`)로 그대로 읽는다. 유지관리: [expression-engine.md](expression-engine.md).

## 4. 열린 문제
- 콘텐츠 계약(`src/engine/content/types.ts`) 변경은 하지 않았다. `linkFactToChart` 결과를 프롬프트에 넣으려면 총괄실장이 계약에 연결 필드(예: factId, kind, group)를 추가해야 한다(변경안, 승인 필요).
- 십성 묶음 개수 집계를 호출 쪽(규칙 엔진 결과 → GroupCounts)에서 만들어야 한다. 아직 연결 안 됨.
