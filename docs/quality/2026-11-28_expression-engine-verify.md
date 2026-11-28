# 사주 발현 분석 엔진 expression@0.1.0 독립 검증 (커밋 0c6127a)

> 검증: 품질검증·보안 담당자(qa-security-lead) · 2026-11-28
> 대상: `src/engine/personalize/expression/**`, `content/expression/{dimensions,mbti-bridge}.json`
> 근거: 계약서 `docs/redesign/30-expression-engine.md`(§1 대표 원칙 7개, §5 데이터 구조, §6 MBTI 다루는 법, §7 필수 시험), 연구소장 `docs/knowledge/personalization/expression-dimensions.md`(§2·§3·§4·§5·§7), 유지관리 메모 `docs/knowledge/personalization/expression-engine.md`
> 방법: 개발자 시험을 그대로 믿지 않고, **연구소장 문서만 보고 판정을 다시 구현**해 엔진 출력과 대조했다. 십성·묶음 가중 합(G·T·십성별 합)·음양 개수·12시진 시주는 시험 안에서 직접 계산했고(엔진의 `chart-rules.ts`·`self-report.ts` 함수 재사용 안 함), 규칙 엔진 원값(지장간 표·관계·신강약 판정·청탁 표지·한난)만 재료로 썼다.
> 엔진 코드는 고치지 않았다.

## 판정: **조건부 통과**

- 대표 원칙 위반(MBTI가 원국·운을 바꿈, MBTI만·상황 사실만으로 developed, 입력에 없는 사실 출력, inferred 아님, T/F가 판정을 바꿈)은 **만들어 내지 못했다.**
- 원국 판정은 무작위 4,000건에서 문서 기반 독립 계산과 **9차원 단계·표지·보정·메모 모두 0건 불일치**, 연구소장 §4 손계산 원국도 시주 있음·없음 모두 일치.
- 다만 **계약서와 이름이 다른 출력 필드**(보통 B1), **좁은 금지어 목록**(보통 B2), **MBTI 대응표 8줄 중 6줄이 실제로는 작동하지 않음**(보통 B3), **결 차원이 대부분 strong이라 사람 사이 차이를 잘 못 보여 줌**(보통 B4), **경계 차단 때 극신약 −1 해석**(보통 B5)이 남아 있다. B1은 콘텐츠 작가·화면 개발 시작 전에, B2는 금지어 목록을 문안 검증기에 넘기기 전에 정리해야 한다.

## 실행한 것

| 명령 | 결과 |
|---|---|
| `npx vitest run src/engine/personalize/expression` (개발자 시험) | 32 통과, 1 건너뜀(분포 측정) |
| `npx vitest run tests/personalize/expression-independent.qa.test.ts` (QA 독립 시험, 새로 작성) | **22 통과 / 22** (작업자 오류 0) |
| `EXPRESSION_DISTRIBUTION=1 npx vitest run src/engine/personalize/expression/__tests__/distribution.test.ts` | 1 통과(표는 아래 §7) |
| `npx tsx scripts/qa/expression-distribution.ts 10000` (QA 분포·변별력 측정, 새로 작성) | 아래 §7 |
| `npx tsc --noEmit` | 오류 0 |
| `npx eslint tests/personalize/expression-independent.qa.test.ts scripts/qa/expression-distribution.ts` | 오류 0 |

## 항목별 결과

| # | 검증 관점 | 결과 | 숫자 |
|---|---|---|---|
| 1-a | 원칙 2: MBTI가 RuleAnalysis·원국·운 값을 바꾸는 경로 | 통과 | RuleAnalysis를 깊게 얼린(freeze) 채 MBTI 625조합(축마다 극1·극1?·극2·극2?·모름) × 원국 4개 실행 — 변경 시도 0, JSON 동일. innate·touches·tone·activates·archetype·개운 집합 동일 |
| 1-b | MBTI만으로 developed | 통과 | 625조합 × 원국 12개: developed 0, dormant 0 |
| 1-c | 상황 사실만으로 developed | 통과 | faint 핵심 차원이 있는 원국 15개 × 상황 사실 52묶음(하나씩·전부·무작위 3개 30종) × MBTI 4종: developed 0. 기질 답을 넣으면 developed 17건(기능 자체는 살아 있음) |
| 1-d | 입력에 없는 사용자 사실·라벨·기간이 출력에 나옴 | 통과 | 무작위 600건: `fact:<id>`는 모두 입력 id, 라벨·기간·topic·useAs 문자열 0건, `mbti:<축>`은 입력에 그 축이 있을 때만 |
| 1-e | inferred가 아닌 판정, 빈 basis | 통과 | 600건 전 readings `inferred === true`, 보고서 `inferred === true`, basis 빈 차원 0 (4,000건 원국 대조에서도 0) |
| 1-f | source가 user가 아닌 사실, 설문 mbti 문항 사실을 기질 근거로 씀 | 통과 | 둘 다 신호에 안 들어감 |
| 1-g | T/F 축이 판정을 바꿈 | 통과 | 400건 × T·F·T?·F?·모름 다섯 가지: innate·상태·신호·luck·개운 완전 동일. 대응표에 T/F 줄을 넣으면 표 검증이 멈춤 |
| 1-h | 금지 표현이 데이터·note에 섞임 | 통과(현재 데이터) / **빈틈 있음**(B2) | 동봉 표 2개·엔진 출력 200건 금지어 0. 계약 예시 3개는 표 검증이 막음. 목록 밖 변형 18개 중 **17개가 표 검증 통과** |
| 2-a | 같은 원국 + MBTI 다름 → readings·strategy 달라짐, 규칙 엔진 값 같음 | 통과 | 원국 40개 × 16유형: readings 달라짐 40/40, luck.strategy 달라짐 34/40. RuleAnalysis는 엔진 실행 전후·재계산 모두 JSON 동일. 단, MBTI만으로 움직인 차원은 steadiness·outward 두 개뿐(B3) |
| 2-b | 같은 원국 + 같은 MBTI + 경험 다름 → 달라짐 | 통과 | 40/40 달라짐, innate 동일. 사실 순서를 뒤집어도 상태 동일 |
| 3-a | §4 손계산 원국 甲子 丙寅 戊辰 庚申 | 통과 | 시주 있음: G·T(10.5)·9차원 단계·latent·월령·경계 차단·load 없음·결 비율(0.266667/0.409524)·양 7 모두 문서와 같음. 시주 없음: expression·flux faint, 모형 A r=0.505882 중화 — 문서와 같음 |
| 3-b | 무작위 원국 대조(독립 구현 vs 엔진) | 통과 | 4,000건(실제 생일 2,000 + 60갑자 합성 2,000, 시주 있음 70%): 불일치 **0**. 규칙 줄 적중 수 — absent 1,272 · hiddenOnly 9,727 · stemOnly 1,016 · rooted 7,985 · 월령으로 낮춘 문턱 덕에 strong 167 · drive +1 349 · drive −1 67 · edge 청탁 승격 120 · load 1,266 · surplus 667 · flux strong 716 · 경계 차단 1,921. 독립 계산 G·T·양 개수와 규칙 엔진 값 교차 불일치 0 |
| 3-c | 문턱 경계(≥ 포함) | 통과 | rootedStrong을 정확한 gs값(0.161905)으로 두면 strong, 0.000001 올리면 moderate |
| 3-d | 운 글자 유무·strengthPrimary·입력 표(cn)와 무관 | 통과 | 200건 innate 동일 |
| 4-a | 시주 모름 hourStable x/12 = 실제 12시진 재계산 | 통과 | 시주 모름 300건 × 9차원: 시진 시주를 직접 만들어(五鼠遁) 재계산한 수·나온 단계 목록과 불일치 0. 8/12 미만 차원 661건 |
| 4-b | 8/12 미만에서 dormant·developed 안 나옴 | 통과 | 시주 모름 100원국 × 자기보고 30가지: dormant·developed 1,023건 모두 ≥8/12, 8/12 미만이라 보류된 기록 329건. 12시진 재판정을 끄면 dormant·developed 0 |
| 5 | 경계 차단(nearBoundary·split·tableSensitive) | 통과 | 1,200건 중 차단 578(nearBoundary 383·split 369·tableSensitive 230 — 세 종류 모두 실제로 걸림): drive 보정·load·surplus 0, 운 tone 전부 neutral, commit·smallsteps 전략 0, chart-uncertain 기록 있음. 비차단 원국의 tone은 독립 계산과 불일치 0(비중립 792건) |
| 5-b | 운 touches(§5.2~5.4) | 통과 | 800건(대운·세운): (차원, 방식) 집합 독립 계산과 불일치 0, flux 활성 387, outward 건드림 0, activates = activate 차원 목록 |
| 6-a | 결정론 | 통과 | 1,000회 무작위(시주 모름 15%, 12시진·비교 표 재판정 10%): 복제 입력·얼린 입력 두 번 실행 JSON 동일, 입력 변경 없음 |
| 6-b | 잘못된 입력·표 → 명확한 오류 | 조건부(S1) | analysis 없음·빈 객체·신강약 없음 → EngineInputError. 잘못된 표 11종(없는 규칙 id·hourStableMin 13·faint present·MBTI 약화 계수 1·없는 선택지·음수 가중·문턱 뒤바뀜·kr 아닌 표·금지어·없는 차원 id 등) → ExpressionTableError. **자기보고 모양 오류는 일반 TypeError 또는 조용히 무시** |
| 8 | 개인정보·외부 호출 | 통과 | 출력에 생년·월일·시각·성별·MBTI 유형 원문 없음. 실행 중 fetch·http·https·net 호출 0(가로채기 시험). 엔진 import 목록에 네트워크 모듈 없음 |

## 발견한 문제

### [보통] B1. 운(luck) 출력 필드 이름이 계약서와 다르다
- 계약서 §5(f089694에서 보완된 현재 판): `touches: { dimensionId; how: "activate" | "bridge" | "press"; positions: string[] }[]`, `tone?: "favorable" | "burden" | "neutral"`(경계·표 민감이면 생략). 계약서는 "이름은 이대로 맞춘다".
- 엔진(`src/engine/personalize/expression/types.ts` `LuckTouch`·`LuckTone`·`ExpressionLuck`): `mode: "activate" | "feed" | "press"`, `via`, `ruleId`, `tone: "support" | "load" | "neutral"`(항상 있음, 차단 때 `"neutral"`). 연구소장 §5.8 제안 이름을 따랐다.
- 재현: `buildExpressionReport(...)`의 `luck[0].touches[0]`에 `how`·`positions`가 없고 `mode`·`via`가 있다. `luck[].tone`은 `"favorable"`이 나오지 않고 `"support"`가 나온다.
- 영향: 콘텐츠 작가 문안 틀·화면이 계약서대로 만들면 필드를 못 읽는다. 총괄실장이 계약서를 코드에 맞출지, 코드를 계약서에 맞출지 정해야 한다(계약 필드는 총괄실장 승인 사항).

### [보통] B2. 금지 표현 목록이 좁아 변형 표현을 못 막는다
- 위치: `src/engine/personalize/expression/tables.ts` `EXPRESSION_FORBIDDEN_PHRASES`(19개, 글자 그대로 포함 검사).
- 재현: `mbti-bridge.json`의 `note`를 아래 문장으로 바꿔 `makeExpressionTables`를 부르면 **오류 없이 통과**한다(18개 중 17개): 「검증된상관」「검증된  상관」「검증 된 상관」「상관관계가 검증되었다」「상관관계가 입증되었다」「과학적 근거가 있다」「과학적으로 밝혀진」「통계적으로 유의」「연구 결과에 따르면」「논문에 따르면」「scientifically proven」「MBTI에 따라 사주가 달라진다」「MBTI가 사주를 바꿉니다」「MBTI 때문에 운이 바뀐다」「사주와 MBTI는 상관이 있다」「당신의 사주는 INTJ」「이 사주면 I일 것」. (「MBTI가 사주를 결정짓는다」만 막힘.)
- 현재 동봉 표·엔진 출력에는 금지 표현이 없다. 문제는 유지관리 메모가 "문안 검증기도 이 목록을 가져다 쓰면 된다"고 한 점 — AI 서술은 변형이 훨씬 많으므로 이 목록만으로는 계약 §7-7 "류(類)" 금지를 지킬 수 없다. 띄어쓰기 무시 비교, 「상관(관계)?」+「입증/검증/증명/밝혀」 같은 조합 규칙, 연구소장 §6.3의 사주→MBTI 맞히기("사주는 [EI][SN][TF][JP]{4}") 패턴이 필요하다.

### [보통] B3. MBTI 대응표 8줄 중 6줄은 실제로 아무 판정도 바꾸지 못한다
- 위치: `content/expression/mbti-bridge.json` 가중치 + `dimensions.json` `self.mbtiOnlyFactor 0.5`·`unsureFactor 0.5`·`highAt/lowAt 0.5` + `self-report.ts` `selfSignalOf`.
- 측정(전수): 사실 없이 MBTI만 있을 때 신호가 생기는 차원은 **steadiness(J, 확신)·outward(E, 확신) 두 개뿐**. E→expression, S→realism, J→duty, P→flux(가중 0.5 × 0.5 = 0.25 < 문턱 0.5)와 low 두 줄(I→outward, P→steadiness)은 625조합 어디에서도 신호 0. 확신 없음("E?") 답은 모든 차원에서 효과 0. 사실이 닿은 차원에서는 사실 가중(1)이 이미 문턱을 넘고 반대 MBTI는 버려지므로, 사실 조합 666 × MBTI 4에서 MBTI가 신호를 바꾼 경우는 6건(realism, 사실끼리 상쇄된 경우)뿐. **S/N 축은 어떤 판정도 바꾸지 않는다.**
- 원칙 7(MBTI에 따라 해석이 달라짐)은 E/I·J/P 두 축을 통해 성립하므로 위반은 아니다. 그러나 대응표와 연구소장 §6.2를 읽는 사람은 8줄이 모두 작동한다고 오해한다. 의도(보수적으로 약하게)라면 표에 "현재 문턱에서 무효" 표시를 하고, 아니라면 가중·약화 계수를 다시 정해야 한다(연구소장·총괄실장 판단).

### [보통] B4. 결 차원(steadiness·edge)은 대부분 strong — 사람 사이 차이를 잘 못 보여 준다
- 위치: `content/expression/dimensions.json` steadiness·edge `strongShare 0.3`·`moderateShare 0.12`(연구소장 §3.7 설계값).
- 측정: 아래 §7. 시주 있음 strong 59~65%·faint 2.4~3.5%, 둘 다 strong 32%. 엔트로피 1.07~1.14(핵심 차원 1.52~1.53, 최대 1.585).
- 원인(구조): 두 집합이 십성 10개 중 8개를 나눠 가져 두 비율의 합이 거의 늘 0.6~0.75다. 그래서 비율 중앙값이 0.35로 strong 문턱 0.30보다 높다 — "strong"이 "보통 사람 수준"을 뜻하게 된다. 또 두 차원은 서로 반대로 움직이는 사실상 한 축이다.
- 의견: 문제다. 「차근차근 다지는 결이 강하다」가 10명 중 6명에게 나오면 개인화 효과가 없고, 바넘 효과(누구에게나 맞는 말)에 가까워진다. 문턱만 바꾸려면 측정상 strong≥0.45 / faint<0.25에서 strong 24~25%·faint 21~27%로 핵심 차원과 비슷해진다(투출 조건·청탁 보정 무시한 가상값 — 실제 적용 전 재측정 필요). 근본적으로는 "고른 쪽 대 센 쪽" 비율(steadiness ÷ (steadiness + edge)) 하나로 보는 편이 변별력이 낫다. 조정은 연구소장 검수 사항.
- 함께 볼 것: 시주 없음에서 핵심 5차원 faint 40.3~42.4%로 연구소장 목표(15~40%)를 조금 넘는다. flux는 시주 없음 strong 8%·faint 53%로 치우친다(시주 의존이 큼, 연구소장 §7.1 예상과 같음).

### [보통] B5. 경계 차단 때 극신약 drive −1을 끌지 — 문서 두 곳이 다르게 읽힌다
- 위치: `chart-rules.ts` `groupRule`(차단이면 +1·−1 모두 끔). 연구소장 §3.2는 −1에 차단 조건을 달지 않았고, §7.2는 "극단이어도 묶음 level은 그대로 계산한다. 극신약 drive −1만 적용"이라고 썼다.
- 측정: §7.2를 글자대로 읽어 −1을 적용하면 무작위 4,000건 중 **97건(2.4%)** 에서 drive 단계가 달라진다.
- 개발자가 유지관리 메모 §7에 "확인 필요"로 이미 적어 둔 항목이다. 엔진은 총괄실장 결정 5를 따른 것이라 결함이 아니라 **연구소장 확인 대기**다.

### [사소] S1. 자기보고 모양 오류가 명확한 오류로 나오지 않는다
- 재현: `self.facts = 5` → `TypeError: number 5 is not iterable`, `self.mbti = "ESTJ"`(배열 아님) → `TypeError: ... .find is not a function`, `self.facts = "abc"` → 오류 없이 무시. analysis 쪽은 EngineInputError로 막는다. 위치 `self-report.ts` `normalizeSelf`.

### [사소] S2. 표 검증이 `self.developedEvidence: ["trait","situation"]`을 허용한다
- 재현: `dimensions.json`의 `self.developedEvidence`에 `"situation"`을 넣으면 `makeExpressionTables`가 통과한다 → 표 한 줄로 "상황 사실만으로 developed 금지"(연구소장 권고, 총괄실장 채택)가 풀린다. 위치 `tables.ts` `validateDimensionTable`. 결정 사항이면 `["trait"]`로 고정 검증하는 편이 안전하다.

### [사소] S3. MBTI 입력: 객체 입력의 소문자는 "확신", 문자열 입력의 소문자는 "확신 없음"
- 재현: `parseMbtiInput("eSTJ").axes[0].sure === false`, `parseMbtiInput({ EI: "e" }).axes[0].sure === true`. 위치 `self-report.ts` `parseChoice`. 화면에서 어느 형식을 쓰느냐에 따라 결과가 달라질 수 있다.

### [사소] S4. 문서에 없는 엔진 선택 두 가지 — 문서화 필요
- 운 tone: 운 천간·지지 두 글자가 하나는 support, 하나는 load면 neutral(`engine.ts` tone 계산). 연구소장 §5.5에는 두 글자 결합 규칙이 없다.
- 운 flux: 대운 + 세운 + 원국 월지·일지가 함께 낀 형(세 글자)은 세지 않는다(다른 쪽이 모두 원국일 때만). 800건 중 139번 이런 관계가 나왔다. 연구소장 §5.4 문구("다른 쪽이 원국 월지 또는 일지")로는 어느 쪽인지 정해지지 않는다.

### [사소] S5. 사용자 사실 id를 형식 확인 없이 그대로 출력한다
- `fact:<id>`의 id는 호출자가 준 문자열 그대로다. 지금 설문 경로(`answersToUserFacts`)는 코드값 id만 만들어 문제없지만, 다른 경로에서 자유 입력이 id에 들어가면 출력·AI 입력으로 그대로 흘러간다. 설문 id 형식(`^[a-zA-Z_]+(:[a-z_]+)?$`) 확인을 권한다.

### [사소] S6. `sections.gap`에 차이와 무관한 기록이 섞인다
- `dimensionId`가 없는 conflicts(예: "MBTI 응답 없음", "태어난 시각을 몰라…")가 모두 gap 항목 근거로 들어간다(`engine.ts` raw.gap). 문안 작가가 gap 장에 "MBTI를 안 적었다"는 말을 쓰게 될 수 있다.

## §7 분포 (검증 관점 7)

개발자 측정(`EXPRESSION_DISTRIBUTION=1 …distribution.test.ts`, 시드 20261128/9, 1940~2019년, N=10,000씩):

| 차원 | 시주 있음 strong / moderate / faint (%) | 시주 없음 strong / moderate / faint (%) |
|---|---|---|
| drive | 23.5 / 44.3 / 32.1 | 20.4 / 38.0 / 41.6 |
| expression | 23.1 / 44.6 / 32.3 | 17.3 / 41.7 / 41.0 |
| realism | 22.8 / 44.9 / 32.3 | 17.7 / 40.7 / 41.6 |
| duty | 22.1 / 45.8 / 32.0 | 18.1 / 41.0 / 40.9 |
| learning | 23.2 / 44.6 / 32.2 | 17.5 / 41.2 / 41.3 |
| steadiness | 59.2 / 37.6 / 3.1 | 48.0 / 44.7 / 7.2 |
| edge | 65.0 / 32.5 / 2.5 | 52.1 / 43.3 / 4.6 |
| flux | 21.4 / 49.4 / 29.2 | 8.4 / 38.4 / 53.2 |
| outward | 25.9 / 48.9 / 25.1 | 22.5 / 55.5 / 22.0 |

QA 측정(`npx tsx scripts/qa/expression-distribution.ts 10000`, 다른 시드, 1930~2024년)도 같은 모양(핵심 21.8~23.5% strong, 결 60.4%/64.6% strong). 총괄실장 측정값(핵심 strong 22~24%·faint 32%, 시주 없음 faint 41%, 결 strong 59~65%·faint 3% 안팎)과 일치한다.

결 차원 추가 측정(시주 있음): 비율 분위수 steadiness p25 0.260 · p50 0.354 · p75 0.446, edge p25 0.270 · p50 0.359 · p75 0.451. 천간 투출 조건 충족 79%. 둘 다 strong 31.9%, 하나 strong·하나 moderate 55.8%, 둘 다 faint 0%. 청탁 표지로 moderate→strong 승격 3.7%. 9차원 단계 조합 3,678가지(핵심 5차원만은 201가지).

## 확인하지 못한 것(미검증)
- 9개 결과 항목 문안(할머니 말투)·AI 서술 — 아직 없음(콘텐츠 작가 몫). 서술 단계에서 "추론" 표현·금지 표현이 지켜지는지는 미검증.
- 화면(설문 MBTI 4축 입력·결과 화면)·모바일 확인 — 범위 밖(계약 §8), 미검증.
- 비기본 규칙 옵션(`branchYinYang: "byOrder"`, `halfCombine: "allPairs"`, `partialPunishment: false` 등)에서의 판정 — 기본 옵션만 대조했다.
- 개운 재정렬(`gaeunPriority`·`changeWish`)의 순서 규칙 자체 — 집합 보존만 확인, 순서 계산은 독립 대조하지 않았다.
- `innateEssence` 대표 기질 선택(같은 근거 위치 공유 제외)의 독립 대조 — 개발자 시험만 있음.
- 명리 해석의 타당성(차원 구성·문턱이 실제 사람의 기질과 맞는가) — 판정 대상 아님. 이 엔진의 결과는 자기이해 모델의 추정이며 과학적으로 입증된 예측이 아니다.

## 남긴 파일
- 독립 시험: `tests/personalize/expression-independent.qa.test.ts` (22건, 문서 기반 재구현 포함)
- 분포·변별력 측정: `scripts/qa/expression-distribution.ts`

---

## 재검증 0.2.0 (커밋 14e3a25, expression@0.2.0 · 표 dimensions 0.3.0 · mbti-bridge 0.3.0)

> 검증: 품질검증·보안 담당자 · 2026-11-28 · 근거: 연구소장 `expression-dimensions.md` **@0.2.0**(§3.7 grain·§4·§5.3~5.5·§6.2·§6.4·§7.1·§7.2), 계약서 `30-expression-engine.md`(개정판 — 운 필드 이름 mode/via/ruleId·support/load/neutral 확정, lean 필드, MBTI 신호 3줄), 유지관리 메모 `expression-engine.md`(0.2.0).
> 방법: 깨진 독립 시험 6건(QA-3 §4 손계산·4,000건, QA-4 시주 모름, QA-5b 운 touches, QA-2 원국 40개·신호 도달 범위)을 **연구소장 @0.2.0 문서만 보고** 다시 구현했다. 기대값은 문서 손계산에서 가져왔고 엔진 출력에서 복사하지 않았다. 엔진 판정 함수(`chart-rules.ts`·`self-report.ts`·`engine.ts`)는 재사용하지 않았다. 원칙 위반 재시도·0.1.0 지적 확인·grain 자기보고 독립 재구현 시험을 더해 22건 → **27건**. 엔진 코드는 고치지 않았다.

### 판정: **조건부 통과**

- 계산은 문서와 정확히 같다: 무작위 4,000건 8차원 단계·grain 방향·q·표지·보정·메모 **불일치 0**, §4 grain 두 판 일치, 분포 측정 1만 건 × 2(시주 있음·없음) 독립 grain 재계산 **불일치 0**, 시주 모름 300건 12시진 재계산 불일치 0, 운 1,000건 불일치 0, grain 자기보고 1,500건 불일치 0.
- 대표 원칙 위반 7종 재시도는 **하나도 재현되지 않았다**.
- 0.1.0 보통 지적 B1·B3·B4·B5와 사소 S1~S6은 해소됐다. **B2(금지 표현)는 부분 해소** — 0.1.0 변형 18개는 모두 막히지만, 새 우회 시도 대부분이 빠져나가고 정상 명리 문장(십성 「상관(傷官)」)을 오탐한다. 지금 데이터·엔진 출력에는 금지 표현이 없으므로 엔진 자체의 판정 결함은 아니다. 다만 **이 함수를 AI 문안 검증기에 쓰기 전에** 고쳐야 한다(조건 1).
- 새로 발견: grain이 고른 판(balanced, faint)인데 엔진 기록 문구가 "사주 잠재력은 약하게 보이는데…"로 나온다(N1, 조건 2). 시주 모름·대운 미입력 처리는 의견(아래 5).

### 실행한 것

| 명령 | 결과 |
|---|---|
| `npx vitest run tests/personalize/expression-independent.qa.test.ts` (갱신 전, 0.1.0 기준) | 22건 중 6 실패 · 16 통과(옛 9차원 기준 — 예상대로) |
| 같은 명령(갱신 후) | **27 통과 / 27** |
| `npx vitest run src/engine/personalize/expression` (개발자 시험) | 43 통과 · 1 건너뜀(분포 측정) |
| `npx tsx scripts/qa/expression-distribution.ts 10000 2000` (갱신) | 아래 4 |
| `npx tsc --noEmit` | 오류 0 |
| `npx eslint tests/personalize/expression-independent.qa.test.ts scripts/qa/expression-distribution.ts` | 오류 0 · 경고 0 |
| `npx vitest run` (전체) | **118 파일 통과 · 5 건너뜀 / 2,653 통과 · 9 건너뜀 · 1 todo, 실패 0** (103초). 첫 실행에서는 `src/lib/unmyeong/__tests__/compose.test.ts` "(d) 2,000명 전수" 1건이 동시 실행 부하로 5초 제한 초과(6.5초) — 단독 실행 4.1초 통과, QA 시험 부하를 줄인 뒤 재실행에서 통과(발현 엔진과 무관, 관찰) |

### 1. 다시 구현한 독립 시험 6건

| 시험 | 0.2.0 기준(연구소장 문서) | 결과 |
|---|---|---|
| QA-3 §4 손계산 | 시주 있음: S 2.8 · E 4.3 · (S+E)/T 0.676 · q **0.394366** · d 0.105634 → edge moderate → 효신탈식 승격 **strong**. 시주 없음: T 8.5 · S 1.266667 · q **0.227545** · d 0.272455 → 승격 없이 **strong edge**. 핵심 5·flux·outward는 0.1.0과 같음 | 독립 계산·엔진 모두 문서와 같음. 엔진 근거 메모의 q 값도 같음, 승격 기록은 시주 있음에만 |
| QA-3 4,000건 | §3.7.2 grain(thin 0.30, balanced 0.07, strong 0.20 + 투출, edge 청탁 승격), 8차원 | 불일치 **0**. grain 갈래 8개 모두 실제로 걸림: thin 14 · balanced 1,208 · steady strong 481 · edge strong(승격 없이) 526 · edge 승격 108 · steady moderate 858 · edge moderate 748 · 기울었지만 투출 없음 57. 문턱 1e-6 이내 경계 사례 4건도 일치. 갈래마다 합성 원국 예를 시험 기록에 남김(연구소장 §8-2) |
| QA-3 문턱 경계 | grain strongGap·balancedGap을 §4 시주 없음 d(0.272455)로 정확히 두기 | `≥` 포함·`<` 경계 모두 문서대로 |
| QA-4 시주 모름 300건 | §7.1: grain은 단계·방향 모두 같아야 같은 판정, 8/12 미만 → hourUncertain, faint·불안정 → chart-uncertain, 판정 2가지 이상 → chart-uncertain, 시주 모름이면 flux는 대표 기질 제외 | 불일치 **0**(8/12 미만 차원 702건). 8/12 미만에서 dormant·developed 0(1,149건 모두 ≥8/12) |
| QA-5b 운 1,000건 | §5.2 생극표 + §5.3 grain(원국 방향과 같은 쪽 activate·반대쪽 press·balanced는 activate) + §5.4 flux(세 글자 형에 대운·세운이 함께 끼면 세운 쪽에만, 그 대운은 그해의 지금 대운) | (차원, 방식) 집합·flux 근거 위치 불일치 **0**. 세운 쪽 세 글자 형 13 · 다른 대운과 낀 세운 관계(붙이지 않음) 129 · grain activate 1,364 · press 857 · 한 기둥이 양쪽 442. 계약 이름(mode·via·ruleId, support/load/neutral) 확인 |
| QA-2 원국 40개 · 신호 도달 범위 | §6.2 신호 3줄 | 16유형으로 readings 달라짐 37/40 · strategy 달라짐 22/40, RuleAnalysis 동일. MBTI만으로 움직인 차원 = **outward·grain뿐**. MBTI만(625조합 × grain 방향 셋)일 때 신호: outward·grain {high, none}, 나머지 {none}, low 없음 |

### 2. 0.1.0 지적 해결 여부

| # | 0.1.0 지적 | 0.2.0 상태 | 근거(실행) |
|---|---|---|---|
| B1 | 운 출력 이름이 계약서와 다름 | **해소**(계약서를 코드에 맞춤 — 총괄실장 결정) | 1,000건 touches 모두 mode∈{activate, feed, press}, tone∈{support, load, neutral}, 차단 때 neutral(계약서 §5 문구와 같음). 단 연구소장 문서 §5 머리말·§5.5는 아직 반대 이름(how/positions/bridge/favorable/burden, 차단 때 tone 생략)을 쓴다 → 문서 맞춤 필요(N3) |
| B2 | 금지어 목록이 좁음 | **부분 해소** | 정규화(NFKC·소문자·공백 제거) + 패턴 14개. 0.1.0 변형 18개 **18/18 막힘**, 계약 예시 3개 막힘, 동봉 표·엔진 출력 200건 0건. 새 우회 시도 30개 중 **28개 통과**, 정상 문구 21개 중 **13개 오탐**(아래 3) |
| B3 | MBTI 대응 8줄 중 6줄 무효 | **해소** | 신호 줄 3개 모두 살아 있음(원국 60개 중 상태를 바꾼 원국: E→outward 45 · J→grain 18 · P→grain 24). 확신 없음 답이 판정을 바꾼 경우 0 / 34,816 비교. 힌트 6개 모두 출력. 표에 S→realism·J→duty·I→outward low·sureOnly false·방향 바꾸기를 넣으면 표 검증이 멈춤 |
| B4 | 결 차원 대부분 strong | **해소** | grain 시주 있음 strong 27.7%(고른 쪽 11.0 · 센 쪽 16.7) · moderate 40.3 · faint 32.0, 엔트로피 1.567(최대 1.585). 연구소장 목표(strong 15~35%, faint 15~40%, strong 안 한쪽 ≥ 1/3 — 고른 쪽 39.7%) 안 |
| B5 | 경계 차단 때 극신약 −1 | **해소**(연구소장 @0.2.0 §3.2·§7.2가 "+1·−1 모두 끔"으로 확정) | 4,000건 중 차단 1,921건에서 drive 보정 0, 독립 계산과 불일치 0 |
| S1 | 자기보고 모양 오류가 일반 TypeError | **해소** | facts 숫자·문자열, mbti 문자열, self 숫자, 사실 id 숫자, questionId 숫자, 없는 극·없는 축 → 모두 EngineInputError. (source가 없는 사실은 설계대로 오류 없이 무시 — 유지관리 메모 §6) |
| S2 | developedEvidence에 situation 허용 | **해소** | `["trait","situation"]` → ExpressionTableError |
| S3 | 소문자 MBTI 해석이 경로마다 다름 | **해소** | 문자열·객체·축 배열 모두 "확신 없음", outward 신호 none |
| S4 | 운 tone 두 글자 결합·세 글자 형 규칙이 문서에 없음 | **해소** | 연구소장 §5.4·§5.5에 명시. tone 비차단 792건 독립 계산과 불일치 0, 세 글자 형은 세운 쪽 13건 일치 |
| S5 | 사실 id 형식 미확인 | **해소** | 자유 입력 id 5종 EngineInputError, 오류 메시지에 원문 없음 |
| S6 | gap에 무관한 기록 | **해소** | 무작위 200건, gap이 가리키는 conflict는 모두 dimensionId 있음 |

### 3. B2 금지 표현 — 우회·오탐 (저장소가 공개라 문자열 전체 목록은 총괄실장 보고에만, 여기에는 갈래만)

- **0.1.0 변형 18개**: 모두 막힘.
- **새 우회 시도 30개 중 28개 통과.** 갈래: ① 글자 사이 문장부호 끼우기(정규화가 문장부호를 남김) ② 비슷한 말(관련성·인정·의미 있는·겹치는 비율, "검증을 거친/끝난") ③ 영어 다른 표현 ④ 출처 흉내(조사·연구진·전문가) ⑤ MBTI 한글 표기·다른 문자(키릴 문자) ⑥ 패턴에 없는 동사(고치다·뒤집히다) ⑦ 축 이름을 한글로(외향형·내향형) 또는 "확률이 높다" ⑧ "라서·니까" 없이 하는 경험 단정("E라…·덕분에…") ⑨ 연구소장 §6.3 5·6·7·8번(영물·고정관념·결여 판정·궁합/채용) — 패턴 자체가 없음.
- **정상 문구 21개 중 13개 오탐.** ① 부정문 면책 7개("과학적으로 입증된 예측이 아니다", "과학적 근거는 없습니다", "MBTI는 사주를 바꾸지 않습니다", "사주로 MBTI를 맞히지 않습니다" 등) ② **십성 이름 「상관(傷官)」이 들어간 명리 서술 3개**("상관이 투출해 … 검증하려는 편", "상관의 기운은 … 밝혀 말하는 쪽" 등 — `corr-proved` 패턴이 '상관관계'와 '십성 상관'을 구분하지 못함) ③ "풀이 근거를 밝혀 둡니다" ④ 생시 안내의 "정확히 일치". 통과한 정상 문구: "운명비서 자기이해 모델의 가설입니다", "미래를 맞히는 방법이 아닙니다", "관련 연구가 없어 검증되지 않은 가설입니다", "대운이 바뀌는 해…", "유의하세요" 등.
- 의견: 정규식 검사만으로 "류(類)" 금지를 지키는 것은 원리상 불가능하다(뜻을 바꾼 말 바꾸기). 정규식은 **1차 그물**로 두고, (가) 문안은 코드가 정한 틀·승인 문구로 조립하며, (나) AI 서술은 검증기(verify)에서 "근거 없는 주장" 규칙 + 사람 검수 표본으로 보완하는 것이 맞다. **반드시 고칠 것은 ②「상관」 오탐**이다 — 명리 문안에 흔한 단어라 문안 검증기에 그대로 쓰면 정상 풀이가 대량으로 막힌다(상관관계·상관성이나 MBTI·사주 문맥일 때만 걸리게).

### 4. grain 분포 재확인 (`scripts/qa/expression-distribution.ts` 갱신, 시드 7001/7002, 1930~2024년, N=10,000씩)

| 차원 | 시주 있음 strong / moderate / faint (%) | 시주 없음 strong / moderate / faint (%) |
|---|---|---|
| drive | 23.0 / 45.3 / 31.7 | 20.3 / 37.8 / 41.9 |
| expression | 23.5 / 45.0 / 31.5 | 17.5 / 42.2 / 40.3 |
| realism | 21.8 / 46.1 / 32.1 | 17.8 / 40.8 / 41.4 |
| duty | 21.8 / 46.0 / 32.3 | 18.2 / 41.5 / 40.3 |
| learning | 22.9 / 45.6 / 31.5 | 17.1 / 40.5 / 42.4 |
| **grain** | **27.7**(고른 11.0 · 센 16.7) / 40.3 / 32.0 | **29.5**(고른 13.7 · 센 15.8) / 42.1 / 28.4 |
| flux | 21.6 / 48.8 / 29.6 | 8.1 / 38.6 / 53.4 |
| outward | 26.1 / 48.7 / 25.2 | 22.1 / 55.7 / 22.2 |

- 총괄실장 측정(시주 있음 grain strong 27.3%(고른 10.7·센 16.6) · moderate 40.5 · faint 32.2)과 0.5%p 안에서 일치.
- grain q 분위수(시주 있음): p10 0.273 · p25 0.382 · p50 0.496 · p75 0.611 · p90 0.711. thin 0.1%, 청탁 승격 3.9%(시주 없음 1.5%).
- 문서 기반 독립 grain 재계산 ↔ 엔진: 시주 있음·없음 각 **불일치 0 / 10,000**.
- 8차원 단계(+grain 방향) 조합 수 4,034가지(0.1.0 9차원 3,678가지).
- 연구소장 §7.1 요청 — 시주 모름 faint 중 hourStable < 8/12(12시진 재판정 2,000건): 핵심 5차원 23~29%(faint의 절반 미만), "안정된 faint"는 전체의 29~32%로 40%를 넘지 않는다 → 연구소장 기준으로 L2 문턱(0.12) 재검토 조건에 해당하지 않음. grain 64%·flux 84%는 불안정 비율이 높다(flux는 예상대로, grain은 balanced가 시주 한 기둥에 쉽게 흔들림).

### 5. 개발자 남은 판단 5개 — QA 의견

1. **계약 §6 문구**: 신호 3줄 문장은 반영됐다. 그러나 같은 절의 "MBTI만 있으면 `self.signal`을 약하게(한 단계 낮춤) 쓰고"는 지금 동작(사실 없음 + 확신 + 신호 줄 → high, `mbtiOnly: true`, developed 근거 불가)과 다르다. "MBTI만 있으면 확인 신호(high, mbtiOnly)로만 쓰고 developed 근거가 될 수 없으며 conflicts에 missing을 남긴다"로 바꾸기를 권한다. 계약서 §5 코드 블록의 `EXPRESSION_ENGINE_VERSION = "expression@0.1.0"`도 0.2.0으로(N3).
2. **hourUncertain faint의 quiet 보류**: 보류하는 쪽을 권한다. quiet는 "원국도 옅고 본인도 덜 쓴다"는 말이라 원국 faint를 사실로 깐다 — 연구소장 §7.1-1("8/12 미만 faint는 성향으로 서술하지 않는다")과 데이터 단계에서 어긋난다. 측정: 시주 모름 원국 100 × 자기보고 30(= 3,000 보고 × 8차원) 중 18건(드묾) — 보류해도 잃는 것이 적다. 최종 판단은 연구소장.
3. **balanced 원국에서 한 운 기둥이 양쪽을 건드릴 때**: 지금처럼 activate 하나로 합치고 근거 위치(via)를 둘 다 남기는 것은 문서 §5.3("balanced면 activate")과 맞다. 다만 문안이 "이 시기엔 센 결 쪽 일이 몰린다"처럼 쪽을 말하려면 정보가 없다. 필요해지면 touch를 쪼개지 말고 grain touch에 선택 필드 `side?: "steady" | "edge" | "both"`를 더하는 편이 계약 변경이 작다(총괄실장 판단, 지금 막을 사안 아님).
4. **부정문 금지**: AI가 쓰는 문장에서는 **부정문도 막는 지금 방식(fail-closed)을 유지**하기를 권한다 — 부정 판별을 정규식으로 하면 "입증된 것은 아니지만 사실상 맞다", "아니라고 할 수 없다" 같은 이중 부정이 바로 빠져나간다. 대신 면책 문구는 AI가 쓰지 않고 **코드가 넣는 승인 문구 목록**(정확히 같은 문자열)으로 두고, 검증기는 승인 문구를 뺀 뒤 검사한다. 면책 문구 작성 영향: "운명비서 자기이해 모델의 가설", "미래를 맞히는 방법이 아니다", "관련 연구가 없어 검증되지 않은 가설"은 현재 패턴을 통과함을 확인했다. "과학적 근거는 없습니다"·"MBTI는 사주를 바꾸지 않습니다"는 걸린다 — 승인 목록에 넣을 문구라면 위 방식이 필요하다.
5. **지금 대운 미입력 시 세 글자 형 미부착**: 동작은 맞다(analysis의 운 기둥에는 연도가 없어 엔진이 어느 대운이 그해와 겹치는지 알 수 없다). 측정: 세운만 준 600건 중 실제로는 세 글자 형이 있었던 세운 3건(0.5%)에서 flux가 빠졌고, **conflicts에 아무 기록도 없다**. 최소한 세운만 주고 대운을 안 준 경우 `missing` 기록("지금 대운을 몰라 대운과 함께 이루는 관계는 보지 않음")을 남기거나, 호출 규약(유지관리 메모)에 "세운을 주면 지금 대운도 준다"를 적기를 권한다.

### 6. 새로 발견한 문제

- **[보통] N1. grain balanced에 "잠재력이 약하다"는 기록 문구가 붙는다.** 원국 grain faint(=두 결을 고르게 쓰는 판, 연구소장 §3.7.2) + 자기보고 한쪽 결(MBTI만 또는 사실 부족)이면 conflicts에 `{dimensionId:"grain", kind:"chart-vs-self", note:"사주 잠재력은 약하게 보이는데 자기보고는 강함"}`이 남는다(직접 셈: 시주 있음 balanced 원국 61개 × MBTI P만 → **61/61**에 이 문구. grain 자기보고 시험에서도 balanced/high/unknown 84건 / 1,500). 시주 모름 불안정 grain faint에도 "옅은 기질로 읽지 않음"이 그대로 붙는다(38/38). 문서는 grain faint를 "옅다"로 쓰지 말라고 했고, 이 note는 AI 입력으로 갈 수 있다. grain 전용 문구("원국은 두 결이 고른데 본인은 한쪽 결로 느낌" 등)로 바꿔야 한다. 위치: `engine.ts` 상충 기록 문구(개인화 연구원).
- **[사소] N2. B2 잔여** — 위 3.
- **[사소] N3. 문서 불일치**: ① 연구소장 §5 머리말·§5.5가 운 이름 how/positions/bridge/favorable/burden·차단 때 tone 생략을 쓰는데, 확정 계약서·코드는 mode/via/feed/support/load·neutral. ② 계약서 §5 버전 상수 0.1.0, §6 "한 단계 낮춤" 문장(위 5-1). ③ 연구소장 §4 머리말 "grain 줄은 엔진 확인 전", §9.1 "0.2.0 변경분 미확인" → 이번 재검증으로 확인됨(문서 갱신은 연구소장).
- **[관찰] N4.** 대응표에서 신호 줄을 **지우는** 것은 표 검증이 막지 않는다(추가·변경은 막음). 죽은 줄 문제는 아니지만 코드 상수 `MBTI_SIGNAL_LINKS`와 표가 달라질 수 있다 — 의도면 그대로 두어도 된다.

### 7. 대표 원칙 위반 재시도 (7종, 모두 재현 안 됨)

| 시도 | 결과 |
|---|---|
| MBTI가 원국·운 값을 바꿈 | 얼린 RuleAnalysis × 625조합 × 원국 4: 변경 0, innate·touches·tone·activates·원형·개운 집합 동일. 원국 40 × 16유형에서도 innate 동일 |
| MBTI만으로 developed | 625조합 × 원국 12: developed 0 · dormant 0 |
| 상황 사실만으로 developed | faint 원국 15 × 상황 사실 52묶음 × MBTI 5종: 0 (기질 답 넣으면 17 — 기능은 살아 있음) |
| 입력 밖 사실 출력 | 무작위 600건: fact id ⊆ 입력, 라벨·기간 0, mbti 근거는 입력 축만 |
| T/F가 판정 변경 | T/F·S/N 각 5가지 답 × 400건: innate·readings·luck·gaeun·차원 기록 동일(달라지는 것은 문체 힌트와 "응답한 축 수" 안내뿐) |
| MBTI low 신호 | MBTI만 625조합 × 원국 12: low 0. 사실 666묶음 × MBTI 5 × 원국 3: low 845건 모두 MBTI를 빼도 low(MBTI가 만든 low 0) |
| 죽은 신호 줄 | 3줄 모두 실제 상태를 바꿈(45·18·24 / 60), 확신 없음 효과 0, 표에 허용 밖 신호 줄 추가 시 검증 중단 |

### 8. 미검증 (0.1.0에서 이어짐)
- 9개 결과 항목 문안·AI 서술, 화면·모바일 — 아직 없음.
- 비기본 규칙 옵션(`branchYinYang: "byOrder"`·`pyeonjaeSide` 등 예약 옵션) — 기본 옵션만 대조.
- 개운 재정렬 순서 규칙·innateEssence 대표 기질 선택의 독립 대조 — 시주 모름 flux 제외만 확인.
- 명리 해석의 타당성 — 판정 대상 아님. 이 엔진의 결과는 자기이해 모델의 추정이며 과학적으로 입증된 예측이 아니다.

### 조건(개발 완료 처리 전)
1. B2: 「상관」 오탐을 고치고, 금지어 함수를 AI 문안 검증기에 쓸 때는 승인 면책 문구 목록 방식과 함께 쓴다(문안 검증기 연결 전까지).
2. N1: grain 전용 상충 문구로 바꾼다(콘텐츠 작가가 문안 틀을 쓰기 전).
3. N3: 연구소장 문서 §5·계약서 §5 버전·§6 문장을 코드에 맞춘다(문서 작업).
