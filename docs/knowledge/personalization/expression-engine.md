# 사주 발현 분석 엔진 — 유지관리 메모 (expression@0.2.0)

> 담당: 개인화 분석 연구원 · 2026-11-28 · 계약서 [docs/redesign/30-expression-engine.md](../../redesign/30-expression-engine.md)(D-035) · 명리 판정 규칙 [expression-dimensions.md](expression-dimensions.md)(연구소장, expression-dimensions@0.2.0)
> 상태: 2차 수정 구현·시험 작성 완료, **실행 확인 전(구현자에게 명령 실행 도구가 없었음 — 총괄실장이 tsc·vitest를 돌려야 함)**, 품질검증 재검증 전. 표 상태 `designed`(분포 재측정 전 설계값).
> 표 판: `dimensions.json` 0.3.0 · `mbti-bridge.json` 0.3.0.

## 0. 개정 이력

| 엔진 판 | 날짜 | 바뀐 것 | 계기 |
|---|---|---|---|
| 0.1.0 | 2026-11-28 | 첫 구현(9차원) | D-035 |
| **0.2.0** | 2026-11-28 | ① steadiness·edge → 양극 축 `grain`(lean steady/edge/balanced), 8차원 ② grain 자기보고는 원국 방향에 대한 상대 신호(연구소장 §3.7.5) ③ 운: grain activate/press, grain press 전략 `exp.st.stretch`(expressed·developed), 대운+세운+원국 월지·일지 세 글자 형은 세운 쪽 flux ④ MBTI 신호 3줄(E→outward, J→grain 고른 쪽, P→grain 센 쪽)+문체 힌트 6개, `unsureFactor`·`mbtiOnlyFactor` 폐지, "사실 없음 + 확신 + 신호 줄 → 그 방향" 명시 규칙, MBTI는 low를 만들지 않음 ⑤ 사실 대응 추가(planning→grain steady, creativity→grain edge) ⑥ 시주 모름: 8/12 미만 표지 `hourUncertain`, 그중 faint는 "옅은 기질로 읽지 않음" chart-uncertain, flux는 대표 기질(innateEssence)에서 제외 ⑦ 금지 표현: 정규화(공백·대소문자) + 다섯 갈래 패턴 ⑧ 자기보고 모양 오류 EngineInputError, 사실 id 형식 검사, 소문자 MBTI는 모든 경로에서 "확신 없음", `developedEvidence` `["trait"]` 고정, `sections.gap`은 차원 기록만 | QA 검증 B1~B5·S1~S6, 연구소장 @0.2.0, 총괄실장 결정 |

운 출력 이름(QA B1)은 **코드 이름 유지**(총괄실장 결정, 계약서가 코드에 맞춰 확정됨): `touches {dimensionId, mode: "activate"|"feed"|"press", via, ruleId}`, `tone: "support"|"load"|"neutral"`, 경계 차단이면 `tone: "neutral"`(생략하지 않음). 연구소장 문서의 `how/positions/bridge/favorable/burden`은 이 이름으로 읽는다.

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
| `content/expression/dimensions.json` | 차원 8개, 판정 규칙 id·문턱값, 기질 답 대응, 운 대응표, 전략 id(+차원별 예외 `overrides`), 개운 우선순위, 원형 연결 | 연구소장 근거 검수 후. 판 번호(`version`) 올림 |
| `content/expression/mbti-bridge.json` | MBTI 신호 3줄(행마다 `claim:"service-model"`, `sureOnly: true`), 문체 힌트 6개 | 총괄실장 승인. 허용 밖 신호 줄·low·T/F·S/N 신호는 검증기가 막는다(`MBTI_SIGNAL_LINKS`) |
| `src/engine/personalize/expression/types.ts` | 계약 타입 + 표 형식 | 계약 필드는 총괄실장 승인 |
| `.../tables.ts` | 표 읽기·검증(`ExpressionTableError`)·해시·금지 표현(목록 + 패턴) | 새 표 필드를 추가할 때, 금지 패턴을 늘릴 때 |
| `.../chart-rules.ts` | ① 원국 판정: 규칙 id → 함수(`exp.lv.group.v1`·`exp.lv.grain.v1`·`exp.lv.flux.v1`·`exp.lv.outward.v1`), 파생값(gs·presence·M·tgT), kr 표 고정, 12시진·비교 표 재판정(단계 + grain 방향) | 새 판정 규칙을 넣을 때만 |
| `.../self-report.ts` | ② MBTI 4축 입력 어댑터, 자기보고 모양 검사, 자기보고 신호(기질 답·상황 답·MBTI, grain 상대 신호) | 신호 규칙을 바꿀 때 |
| `.../engine.ts` | ③ 비교 판정, 상충 기록, ④ 운 touches·tone·strategy, ⑤ 개운 재정렬, ⑥ 원형, ⑦ 9개 항목 근거 id | |
| `.../__tests__/expression.test.ts` | 계약 §7 시험 7개 + 경계 + §4 손계산(grain 두 판) + grain 식 대조 + MBTI 죽은 줄·low 0·확신 없음 0 + 운 grain/flux + 금지어 변형 18개·정상 문구 + 자기보고 모양 오류 | |
| `.../__tests__/distribution.test.ts` | 분포 측정(기본 건너뜀, `EXPRESSION_DISTRIBUTION=1`) — grain strong 고른 쪽/센 쪽·balanced·thin·청탁 승격·q 분위수 포함 | |

## 3. 판정 요약
1. **원국 잠재력**(모형 A·kr-monthly-30 고정, 연구소장 §3): 핵심 5(묶음 presence·gs·월령 M) + drive 보정, 결 1(`grain`), 보조 2(충·형 / 음양·한난). faint도 근거 한 줄 이상.
2. **grain**(§3.7.2): S = 정재·정관·정인·식신의 십성별 가중 합, E = 편관·상관·편인·겁재(비견·편재 제외, 지장간/A.basis만). (S+E)/T < 0.30 → faint·balanced(`exp.lv.grain.thin`). q = S/(S+E), d = |q−0.5|: d < 0.07 → faint·balanced, 그 밖 lean = q>0.5 ? steady : edge, d ≥ 0.20 + 기운 쪽 십성 천간 투출 → strong, 아니면 moderate. lean edge·moderate + 청탁 표지(상관견관·효신탈식·관살혼잡) → strong(`exp.mod.grain.clarity`). **grain의 faint는 "옅다"가 아니라 "두 결을 고르게 쓰는 판"**(문안 주의).
3. **경계 차단**: `A.nearBoundary`·`agreement:"split"`·`tableSensitive` 중 하나라도 참 → drive 보정 +1·−1 모두 끔(연구소장 @0.2.0 확정, QA B5 해소), 부담(load/surplus) 메모·운 tone 끔(`"neutral"`), `chart-uncertain` 기록.
4. **자기보고 신호**(차원마다):
   - 사실 점수 = 기질 답(표 `facts`) + 상황 답(직업 상태·최근 변화·지난 일 — `lived-link.ts` 대응을 철자 변환 `bigeop→bigyeop`, `gwanseong→gwansal`, 핵심 차원만). grain은 steady +, edge −.
   - MBTI 점수 = 확신 답의 신호 줄만. **확신 없는 답은 신호 0**(문체 힌트만, 코드에서도 막음).
   - 사실이 닿으면: MBTI와 반대면 사실만(self-vs-self), 아니면 합 → 문턱 ±0.5.
   - 사실이 없고 확신 신호 줄이 있으면 **그 방향(명시 규칙, `mbtiOnly: true`)** — 문턱 등호에 기대지 않는다.
   - **low는 사실 점수 자체가 그쪽일 때만** — MBTI는 low를 만들지 않는다(사실이 상쇄되고 MBTI가 방향을 정해도 low 금지).
   - grain(§3.7.5): 방향을 `self.lean`으로 남기고 원국 lean에 대한 상대 신호로 바꾼다 — 같은 쪽·원국 balanced → high, 반대쪽 → 사실이 그쪽이면 low, MBTI만이면 none + chart-vs-self("본인은 반대 결로 느낀다는 자기보고(MBTI만)").
5. **상태**: 신호 none → unknown / 잠재 strong·moderate + high → expressed / + low → dormant / faint + low → quiet / faint + high → developed(**같은 방향 기질 답 1개 이상 + 사실 점수도 그쪽일 때만**, 아니면 unknown + chart-vs-self·missing).
6. **시주 모름**: 세 기둥 판정 그대로 + 12시진 재판정 `hourStable x/12`(grain은 단계와 방향 모두 같아야 같은 판정, `leans` 기록). x < `hourStableMin`(8)이면 표지 `hourUncertain`, 그중 faint는 chart-uncertain "태어난 시각을 알면 달라질 수 있어 옅은 기질로 읽지 않음". dormant·developed는 8 이상일 때만, 아니면 unknown + chart-uncertain. flux는 대표 기질에서 뺀다.
7. **운**: 운 글자 묶음 → activate·feed·press(오행 생극표). grain: 운 글자 십성이 고른 쪽/센 쪽이면 원국 lean과 같은 쪽 → activate, 반대쪽 → press, balanced → activate. 원국 월지·일지 충·형(부분 삼형 제외) → flux activate. **세 글자 관계에 대운·세운이 함께 끼면 세운 쪽에만**(그때 대운은 입력의 지금 대운이어야 함 — 지금 대운을 안 주면 붙이지 않음). outward는 운이 건드리지 않음. `strategy` = `"<전략 id>:<차원>"`(상태 × activate/press, `strategies.overrides`가 있으면 그것 — grain press는 expressed·developed에서 `exp.st.stretch`) + tone(support → commit, load → smallsteps). tone: 억부 ok·희신 있음일 때만 글자별 분류, 두 글자가 support·load로 갈리면 neutral.
8. **개운**: `pickGaeun` 결과 범주는 그대로, 순서만 상태(`gaeunPriority`)와 바꾸고 싶은 것(`changeWish`)으로 조정.
9. **9개 항목**: 근거 id(`potential:` `reading:` `conflict:<번호>` `luck:<scope>:<간지>` `gaeun:` `archetype:` `fact:<UserFact id>` `mbti:<축>`)만 담는다. 대표 기질(innateEssence)은 같은 근거 위치를 공유하는 차원을 하나만 고른다. `gap`은 차원에 걸린 chart-vs-self·self-vs-self 기록과 developed·dormant 차원(+ 그 차원의 기록)만 — "MBTI 응답 없음"·"시각 모름" 같은 전체 기록은 넣지 않는다.

## 4. 표 고치는 법
1. `dimensions.json`(또는 `mbti-bridge.json`)만 고친다. 엔진 코드는 그대로 둔다.
2. `version` 판 번호를 올린다(문턱 조정 = 부 번호, 차원 추가·삭제 = 중 번호). `status`는 검수 단계에 맞춰 `designed → reviewed → approved`.
3. `npx vitest run src/engine/personalize/expression`로 표 검증·시험을 돌린다. 표가 틀리면 `ExpressionTableError`가 어디가 틀렸는지 알려 준다. §4 손계산 시험이 깨지면 연구소장 손계산 표와 함께 고친다.
4. 출력의 `rulesHash`가 바뀐다(어느 표로 판정했는지 식별). 저장된 이전 보고서와 섞지 않는다(0.1.0 보고서의 `steadiness`·`edge`는 0.2.0의 `grain`과 대응하지 않는다).
5. 분포를 다시 잰다: `EXPRESSION_DISTRIBUTION=1 npx vitest run src/engine/personalize/expression/__tests__/distribution.test.ts`.
6. `docs/CHANGELOG.md`에 기록(총괄실장).

표가 막는 것(조용히 넘기지 않음): 폐지 필드 `self.unsureFactor`·`self.mbtiOnlyFactor`가 남아 있음, `developedEvidence`가 `["trait"]`가 아님, MBTI 신호 줄이 `MBTI_SIGNAL_LINKS` 세 줄 밖이거나 low·`sureOnly:false`, 같은 축·극 힌트 중복, grain 사실 방향이 steady|edge가 아님, grain steady·edge 집합이 겹침, `0 ≤ balancedGap < strongGap < 0.5` 위반, `overrides`의 없는 차원·상태·전략 id, 금지 표현.

새 판정 규칙(예: 12운성 메모)을 넣을 때만 `chart-rules.ts`의 `LEVEL_RULE_IDS`·`potentialOf` switch·`types.ts`의 `LevelRuleId`에 같은 id를 넣는다.

## 5. 버전 올리는 법
- 엔진 동작(판정 순서·상태 규칙·출력 모양)이 바뀌면 `EXPRESSION_ENGINE_VERSION`(types.ts)을 올린다. 표만 바뀌면 표 `version`만.
- 계약 필드를 바꾸는 변경은 총괄실장 승인 후 계약서와 함께.

## 6. 지켜야 할 것
- MBTI는 원국·운 계산에 들어가지 않는다(엔진은 원국 `chart`를 받지 않는다). 같은 원국이면 `innate`·`touches`·`tone`은 MBTI·설문과 무관하게 같다(grain touch도 원국 lean으로만 정해진다).
- 사용자 사실은 `fact:<id>`로만 가리키고 내용을 복사·추가하지 않는다. 선택지 이름(label)도 출력에 넣지 않는다. 사실 id는 설문 코드값 형식(`USER_FACT_ID_PATTERN` = `^[A-Za-z_]+(:[a-z_]+)?$`)만 받는다 — 자유 입력이 id로 들어오면 EngineInputError(메시지에 원문을 담지 않음).
- 자기보고 모양이 틀리면(self가 객체 아님, facts·mbti가 배열 아님, 사실·축 항목 모양 오류, 없는 극) EngineInputError. source가 user가 아닌 사실은 오류 없이 세지 않는다.
- MBTI 소문자는 문자열(`"eSTJ"`)·객체(`{ EI: "e" }`)·축 배열(`{ pole: "e" }`) 어느 경로든 "확신 없음"이다(`"E?"`도 같음).
- 모든 비교 결과는 `inferred: true`. 화면·AI 서술은 "~일 수 있다"로만.
- 금지 표현: `findForbiddenPhrases`/`forbiddenHitsOf`(tables.ts)가 `normalizeForbiddenText`(NFKC·소문자·공백 제거·서비스 이름 중립화) 뒤에 대표 문구 목록(`EXPRESSION_FORBIDDEN_PHRASES`)과 연구소장 §6.3 다섯 갈래 패턴(`EXPRESSION_FORBIDDEN_PATTERNS` — 상관·근거+입증류, 사주 근처 16유형·단일 축 단정, MBTI 글자로 경험 단정, MBTI+바꾸·결정+사주·운, 연구·논문·통계+따르면)을 검사한다. 문안 검증기도 이 함수를 쓰면 된다. **부정문도 막는다**(예: "과학적으로 입증된 예측이 아니다"도 걸림) — 면책 문구는 "운명비서 자기이해 모델의 가설", "미래를 맞히는 방법이 아니다" 같은 표현을 쓴다.
- MBTI 검사지 문항을 가져오지 않는다(4축 자기선택만).

## 7. 열린 문제
- **실행 확인 전**: 2차 수정은 명령 실행 없이 작성했다. `npx tsc --noEmit`, `npx vitest run src/engine/personalize`, 분포 측정을 총괄실장이 돌려야 한다.
- **grain 분포 미측정**: 연구소장 목표(strong 합 15~35%, faint 15~40%, strong 안 한쪽 ≥ 1/3)는 분포 측정 후 확인. 벗어나면 0.07·0.20 문턱 또는 edge 승격 조정(연구소장 검수).
- 시주 모름 faint 중 `hourStable < 8/12` 비율(연구소장 §7.1 QA 추가 측정 요청)은 아직 안 쟀다.
- `quiet`(faint + low)는 `hourUncertain`이어도 그대로 둔다(연구소장 §7.1-3은 dormant·developed만 보류). "옅다"로 서술하지 않는 문안 규칙(§7.1-1)이 quiet에도 걸리므로 작가 전달 필요 — 상태 자체를 보류할지는 연구소장 판단.
- 원국 grain이 balanced일 때 한 운 기둥의 두 글자가 고른 쪽·센 쪽을 모두 건드리면 둘 다 activate라 touch 하나로 합쳐진다(위치는 둘 다 남음). 어느 쪽 결인지 출력 필드로 따로 내지 않는다 — 계약 필드 추가가 필요하면 총괄실장 판단.
- 지장간 비교 표(cn-lunarjs) 결과는 `sensitivity.table.changed`에 기록만 하고 conflicts에는 올리지 않았다(연구소장 §7.3 "고객 화면 비노출").
- `context.ts`의 GUARDS 문구("MBTI는 … 기질 판단 근거로 쓰지 않는다")는 기존 풀이 AI용 지침이라 그대로 두었다. 발현 엔진 결과를 AI에 넘길 때 지침 문구를 따로 정해야 한다(콘텐츠 계약 변경 — 총괄실장).
- QA 독립 시험(`tests/personalize/expression-independent.qa.test.ts`)과 QA 측정 스크립트(`scripts/qa/expression-distribution.ts`)는 0.1.0 구조(steadiness·edge·9차원·세 글자 형 제외) 기준이라 일부가 깨지는 것이 정상이다 — 품질검증 소관.
