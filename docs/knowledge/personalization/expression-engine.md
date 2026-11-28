# 사주 발현 분석 엔진 — 유지관리 메모 (expression@0.1.0)

> 담당: 개인화 분석 연구원 · 2026-11-28 · 계약서 [docs/redesign/30-expression-engine.md](../../redesign/30-expression-engine.md)(D-035) · 명리 판정 규칙 [expression-dimensions.md](expression-dimensions.md)(연구소장, expression-dimensions@0.1.0)
> 상태: 구현·시험 작성 완료, **품질검증 독립 검증 전**. 표 상태 `designed`(분포 측정 전 설계값).

## 1. 무엇을 하나
"하늘이 만들어 준 나(원국) → 세월이 만들어 낸 나(발현) → 앞으로 내가 만들어 갈 나(운·개운)"를 코드로 판정한다.
입력 `RuleAnalysis`(+ 선택 자기보고) → 출력 `ExpressionReport`. 문장은 만들지 않는다(문안은 콘텐츠 작가, 서술은 AI가 확정 결과만).

```ts
import { buildExpressionReport, selfReportFromUserFacts } from "@/engine/personalize"
const analysis = analyzeRules(chart, undefined, { luck: chart.luck.daeun.map(d => d.pillar), year: yearPillarOf(2026) })
const self = selfReportFromUserFacts(userFacts, { EI: "E", SN: "unknown", TF: "F?", JP: "J" }) // 4축 입력이 없으면 설문 mbti 값 사용
const report = buildExpressionReport({ analysis, self, luck: { daeun: { luckIndex, daeunIndex }, seunYear: 2026 } })
```

## 2. 파일 구조
| 파일 | 내용 | 바꿀 때 |
|---|---|---|
| `content/expression/dimensions.json` | 차원 9개, 판정 규칙 id·문턱값, 기질 답 대응, 운 대응표, 전략 id, 개운 우선순위, 원형 연결 | 연구소장 근거 검수 후. 판 번호(`version`) 올림 |
| `content/expression/mbti-bridge.json` | MBTI 축 ↔ 차원 가설 대응(행마다 `claim:"service-model"`, 등급 A/B), 문체 힌트 | 총괄실장 승인. T/F 신호·허용 밖 low는 검증기가 막는다 |
| `src/engine/personalize/expression/types.ts` | 계약 타입 + 표 형식 | 계약 필드는 총괄실장 승인 |
| `.../tables.ts` | 표 읽기·검증(`ExpressionTableError`)·해시·금지 표현 목록 | 새 표 필드를 추가할 때 |
| `.../chart-rules.ts` | ① 원국 판정: 규칙 id → 함수(`exp.lv.group.v1` 등), 파생값(gs·presence·M·tgT), kr 표 고정, 12시진·비교 표 재판정 | 새 판정 규칙을 넣을 때만 |
| `.../self-report.ts` | ② MBTI 4축 입력 어댑터, 자기보고 신호(기질 답·상황 답·MBTI) | 신호 규칙을 바꿀 때 |
| `.../engine.ts` | ③ 비교 판정, 상충 기록, ④ 운 touches·tone·strategy, ⑤ 개운 재정렬, ⑥ 원형, ⑦ 9개 항목 근거 id | |
| `.../__tests__/expression.test.ts` | 계약 §7 시험 7개 + 경계 + 연구소장 §4 손계산 대조 | |
| `.../__tests__/distribution.test.ts` | 분포 측정(기본 건너뜀, `EXPRESSION_DISTRIBUTION=1`) | |

## 3. 판정 요약
1. **원국 잠재력**(모형 A·kr-monthly-30 고정, 연구소장 §3): 핵심 5(묶음 presence·gs·월령 M) + drive 보정, 결 2(정·편 십성 집합 비율, 지장간/A.basis만), 보조 2(충·형 / 음양·한난). faint도 근거 한 줄 이상.
2. **경계 차단**: `A.nearBoundary`·`agreement:"split"`·`tableSensitive` 중 하나라도 참 → drive 보정·부담(load/surplus) 메모·운 tone 끔, `chart-uncertain` 기록.
3. **자기보고 신호**(차원마다): 기질 답(표 `facts`) + 상황 답(직업 상태·최근 변화·지난 일 — `lived-link.ts` 대응을 철자 변환 `bigeop→bigyeop`, `gwanseong→gwansal`) + MBTI(가중 × 확신 없음 0.5). 사실이 없으면 MBTI × 0.5(한 단계 낮춤). 사실과 MBTI가 반대면 사실을 따른다. 문턱 ±0.5.
4. **상태**: 신호 none → unknown / 잠재 strong·moderate + high → expressed / + low → dormant / faint + low → quiet / faint + high → developed(**기질 답 high 1개 이상일 때만**, 아니면 unknown + chart-vs-self·missing).
5. **시주 모름**: 세 기둥 판정 그대로 + 12시진 재판정 `hourStable x/12`. dormant·developed는 `hourStableMin`(8) 이상일 때만, 아니면 unknown + chart-uncertain.
6. **운**: 운 글자 묶음 → activate·feed·press(오행 생극표), 십성 → steadiness/edge activate, 원국 월지·일지 충·형 → flux activate. outward는 운이 건드리지 않음. `strategy` = `"<전략 id>:<차원>"`(상태 × activate/press) + tone(support → commit, load → smallsteps).
7. **개운**: `pickGaeun` 결과 범주는 그대로, 순서만 상태(`gaeunPriority`)와 바꾸고 싶은 것(`changeWish`)으로 조정.
8. **9개 항목**: 근거 id(`potential:` `reading:` `conflict:<번호>` `luck:<scope>:<간지>` `gaeun:` `archetype:` `fact:<UserFact id>` `mbti:<축>`)만 담는다. 대표 기질(innateEssence)은 같은 근거 위치를 공유하는 차원을 하나만 고른다.

## 4. 표 고치는 법
1. `dimensions.json`(또는 `mbti-bridge.json`)만 고친다. 엔진 코드는 그대로 둔다.
2. `version` 판 번호를 올린다(문턱 조정 = 부 번호, 차원 추가·삭제 = 중 번호). `status`는 검수 단계에 맞춰 `designed → reviewed → approved`.
3. `npx vitest run src/engine/personalize/expression`로 표 검증·시험을 돌린다. 표가 틀리면 `ExpressionTableError`가 어디가 틀렸는지 알려 준다. §4 손계산 시험이 깨지면 연구소장 손계산 표와 함께 고친다.
4. 출력의 `rulesHash`가 바뀐다(어느 표로 판정했는지 식별). 저장된 이전 보고서와 섞지 않는다.
5. 분포를 다시 잰다: `EXPRESSION_DISTRIBUTION=1 npx vitest run src/engine/personalize/expression/__tests__/distribution.test.ts`.
6. `docs/CHANGELOG.md`에 기록(총괄실장).

새 판정 규칙(예: 12운성 메모)을 넣을 때만 `chart-rules.ts`의 `LEVEL_RULE_IDS`·`potentialOf` switch·`types.ts`의 `LevelRuleId`에 같은 id를 넣는다.

## 5. 버전 올리는 법
- 엔진 동작(판정 순서·상태 규칙·출력 모양)이 바뀌면 `EXPRESSION_ENGINE_VERSION`(types.ts)을 올린다. 표만 바뀌면 표 `version`만.
- 계약 필드를 바꾸는 변경은 총괄실장 승인 후 계약서와 함께.

## 6. 지켜야 할 것
- MBTI는 원국·운 계산에 들어가지 않는다(엔진은 원국 `chart`를 받지 않는다). 같은 원국이면 `innate`·`touches`·`tone`은 MBTI·설문과 무관하게 같다.
- 사용자 사실은 `fact:<id>`로만 가리키고 내용을 복사·추가하지 않는다. 선택지 이름(label)도 출력에 넣지 않는다.
- 모든 비교 결과는 `inferred: true`. 화면·AI 서술은 "~일 수 있다"로만.
- 금지 표현 목록 `EXPRESSION_FORBIDDEN_PHRASES`(tables.ts)는 표 검증과 시험이 함께 쓴다. 문안 검증기도 이 목록을 가져다 쓰면 된다.
- MBTI 검사지 문항을 가져오지 않는다(4축 자기선택만).

## 7. 열린 문제
- 분포 측정(연구소장 §8-1) 수치는 아직 없다. 측정 후 문턱 조정은 연구소장·QA 검수.
- 지장간 비교 표(cn-lunarjs) 결과는 `sensitivity.table.changed`에 기록만 하고 conflicts에는 올리지 않았다(연구소장 §7.3 "고객 화면 비노출").
- 경계 차단 시 drive −1(극신약)도 끈다(총괄실장 결정 5를 글자대로 따름). 연구소장 §7.2의 "극신약 −1만 적용"과 다르게 읽힐 수 있어 확인 필요.
- `context.ts`의 GUARDS 문구("MBTI는 … 기질 판단 근거로 쓰지 않는다")는 기존 풀이 AI용 지침이라 그대로 두었다. 발현 엔진 결과를 AI에 넘길 때 지침 문구를 따로 정해야 한다(콘텐츠 계약 변경 — 총괄실장).
