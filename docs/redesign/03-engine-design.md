# 03. 신성 원형 분석 엔진 설계안 (제출물 ②)

> 작성: 사주엔진 개발자 · 2026-11-28 · 상태: **설계·실험 단계(대표 승인 전, 제품 코드 `src/**` 무수정)**
> 근거 지시: `docs/redesign/00-ceo-directive.md` 3절·12절·13절②, `docs/DECISIONS.md` D-026
> 실험 도구: `scripts/archetype-lab/` (이 문서 10절의 수치는 도구를 실제로 실행한 출력 그대로다)
>
> **중요 고지**: 신성 원형은 전통 명리학의 공식 분류가 아니라 사주 구조를 바탕으로 한 **서비스의 창작적 상징 해석**이다. 엔진은 명리 규칙 엔진이 이미 계산한 사실(십성·격국·신강약 등)을 재료로 원형을 "고르는" 장치일 뿐, 새로운 명리 판단을 만들지 않는다.

## 0. 대표용 요약 (쉬운 말)

- **무엇을 만드나**: 지금까지 만든 만세력(생년월일시 → 여덟 글자) 계산기와 명리 규칙 계산기(십성·격국·신강약 등)는 그대로 두고, 그 결과를 받아 "이 사람의 신성 원형 1순위·2순위"를 고르는 **세 번째 계산기**를 그 뒤에 붙인다.
- **어떻게 고르나**: 사주를 70여 개의 "특징"(예: 목 기운 비율, 태어난 계절, 격국, 합·충 개수)으로 바꾼 뒤, 원형마다 정해 둔 **점수표**(조건이 맞으면 몇 점)를 적용해 가장 점수가 높은 원형을 고른다. AI가 고르지 않는다. 같은 사주면 언제나 같은 결과가 나오고, **"어느 조건이 몇 점이라서 이 원형"인지 기록**이 남는다.
- **점수표는 누가 만드나**: 명리학 연구소장이 `docs/redesign/02-archetypes.md`에 12개 원형의 조건을 정하면, 그것을 JSON 파일 한 장으로 옮겨 실험 도구에 바로 넣을 수 있다. 지금은 연구소장 안이 오기 전이라 **엔진 개발자가 만든 임시 예시 12개**(이름 뒤에 "(예시)")로 도구가 돌아가는지만 확인했다. 예시의 원형 배정은 명리 근거가 없으니 고객용으로 쓰면 안 된다.
- **실험 결과(예시 규칙, 무작위 사주 1만 건)**: 같은 사주 재계산 결과 일치 500/500, 별도 실행 두 번의 결과 지문(해시) 일치, 1만 건 처리 약 35초(서비스 1회 계산은 1천분의 1~3초 수준). 반면 **태어난 시각을 모르면 원형이 시각에 따라 바뀌는 사주가 89%**, 지장간 표(학파)에 따라 바뀌는 사주 18%, 점수 완전 동점 10% — 연구소장 안을 만들 때 이 세 가지를 줄이도록 조건을 설계해야 한다(9.1절 합격 기준 제안).
- **결정이 필요한 것**: 12절 (시각 모름일 때 보여 줄 방식, 결과 고정 정책, 합격 기준 수치).

## 1. 위치와 원칙

```
입력(생년월일시) → [역법 엔진 computeChart] → CalendarResult(객관값, 기존)
                → [규칙 엔진 analyzeRules] → RuleAnalysis(해석 재료, 기존 rules@0.4.0)
                → [원형 엔진 (신규)]       → ArchetypeResult(창작 상징 선택 + 근거)
                → 개인화 → 콘텐츠(AI는 확정된 원형·근거를 서술만) → 검증 → 리포트
```

1. **기존 엔진 무수정 재사용**: 원형 엔진은 공개 API `computeChart`·`analyzeRules`·`hourPillarsOf`만 부른다. 규칙 엔진 결과를 바꾸거나 다시 판정하지 않는다.
2. **세 층 분리**: 역법 객관값(`CalendarResult`) / 명리 해석 재료(`RuleAnalysis`) / 창작 상징 선택(`ArchetypeResult`)을 서로 다른 타입·모듈로 둔다. 원형 결과에는 해석 문장이 없다(문장은 콘텐츠 단계).
3. **결정론**: 순수 함수. 난수·현재 시각·AI·DB·네트워크 없음. 점수는 백만분의 1 단위 정수로 더해 부동소수 오차로 순위가 흔들리지 않게 한다. 정렬은 항상 전순서(점수 → priority → id).
4. **규칙은 데이터, 코드는 기계**: 원형 조건은 코드가 아니라 **규칙 파일(JSON)** 에 둔다. 연구소장이 조건을 바꿔도 엔진 코드는 바뀌지 않고, 규칙 파일 버전과 해시만 바뀐다. 108개로 늘릴 때도 같은 구조.
5. **근거 기록**: 모든 원형(1·2순위만이 아니라 전부)에 대해 "발동한 조건 · 점수 · 판정에 쓴 특징 값"을 남긴다. 콘텐츠·검증기(P4-04)는 이 기록 밖의 근거를 쓰면 안 된다.
6. **학파 차이는 옵션 + 민감도 표시**: 지장간 표 등 학파 옵션은 `RuleOptions`로 받고(규칙 엔진과 같음) 결과에 전부 기록한다. 표를 바꾸면 원형이 바뀌는지 함께 계산해 표시한다.
7. **제품 위치(승인 후)**: `src/engine/archetype/**`(신규 모듈, 엔진 개발자 소유 제안) + 규칙 파일 `src/engine/archetype/rulesets/*.json`. 공개 API에 `classifyArchetype`를 추가하는 것은 계약 변경이므로 총괄실장 승인 대상. 지금은 `scripts/archetype-lab/`에만 있다.

## 2. 처리 흐름

1. `analyzeRules(chart, ruleOptions)` → `RuleAnalysis` (기존)
2. `extractFeatures(analysis)` → **특징 벡터**(평평한 키-값, 키 순서 고정, `features@0.1.0`)
3. 규칙 파일의 원형마다
   1. `require`(자격 조건)가 거짓이거나 `exclude`(제외 조건)가 참이면 후보 탈락(기록은 남김)
   2. 점수 항목(`terms`)마다 `when` 조건이 참이면 고정점(`points`) 또는 비례점(`linear`: 특징값 × 배율, 상·하한)을 더함
4. 순위: 자격 있는 원형 → 점수 내림차순 → `priority` 오름차순 → `id` 사전순
5. 1순위·2순위·점수 차(`margin`)·동점(`tie`)·경계(`boundary`)·결정 기준(`decidedBy`) 기록
6. 민감도(선택, 기본 켬)
   - 시각 모름: 일간 기준 12시진 시주(子→亥)를 하나씩 넣어 2~5 반복 → 시진별 1순위
   - 지장간 표: `kr-monthly-30`·`cn-lunarjs`·`main-only` 각각으로 1~5 반복 → 표별 1순위
7. 버전·옵션·규칙 파일 해시·고지 문구를 붙여 `ArchetypeResult` 반환

핵심 함수는 `RuleAnalysis → 점수`(`scoreAnalysis`)이고, 민감도 계산만 원국(`CalendarResult`)이 필요하다(같은 원국을 다른 조건으로 규칙 엔진에 다시 넣기 때문).

## 3. 특징 벡터 (features@0.1.0)

지시서가 요구한 재료와 특징 키의 대응:

| 지시서 재료 | 특징 키(접두어) | 규칙 엔진 출처 |
|---|---|---|
| 일간 | `dm.*` | `dayMaster` |
| 월령 계절 | `month.branch`, `season`, `season.phase`, `season.state`, `month.rel` | 월지, `strength.seasonState`, 월지 정기 십성 |
| 오행 분포·강약 | `el.share.*`, `el.count.*`, `el.dominant*`, `el.selfShare`, `el.missing*`, `el.concentration`, `yy.yangRatio` | `qiFlow.shares`, `elements` |
| 십성 묶음 비율 | `tg.share.*`, `tg.dominant`, `tg.stems.*`, `tg.stemTenGods`, `tg.present` | `strength.groupTotals`, `tenGods` |
| 격국 | `gk.*` | `structure.candidates`(주 후보·특수격 후보), `structure.tableSensitive` |
| 신강약 3모형 | `st.weighted`, `st.threeFactor`, `st.rooted`, `st.primary`, `st.ratio`, `st.extreme`, `st.agreement`, … | `strength.models`, `strength.*Sensitive` |
| 용신 관점별 | `ug.eokbu.*`, `ug.johu.element`, `ug.tonggwan.element`, `ug.gyeokguk.element`, `ug.top.*`, `ug.single.element` | `usefulGods.views`, `agreement`, `singlePickProposal` |
| 조후 | `cl.tClass`, `cl.mClass`, `cl.T`, `cl.M`, `cl.needs` | `climate` |
| 합충형파해 요약 | `rel.*` | `interactions`(원국 내부만, D-019의 세 글자 관계에 포함된 두 글자 기록은 이중 집계하지 않음) |
| 기세 | `fl.chainLength`, `fl.circular`, `fl.to*`, `fl.fromResource`, `fl.clarity*`, `el.concentration` | `qiFlow` |
| 지장간 | (간접) `tg.present`, `month.rel`, `st.dmRooted`, 모든 가중 비율 | `hiddenStems` — 표 옵션에 따라 값이 바뀌므로 6절 민감도로 추적 |

원칙: 특징은 규칙 엔진 값을 **옮기거나 단순 집계만** 한다(비율 계산·개수 세기). 새로운 명리 판단(예: 격의 성패)을 특징 단계에서 만들지 않는다. 연구소장이 새 특징이 필요하면 요청 → 엔진 개발자가 추가 → `features` 버전을 올린다.

`ug.single.element`는 대표 결정 대기 6번의 "하나만" 제안값이라 원형 조건에 쓰면 그 결정에 원형이 묶인다. 연구소장 안에서는 관점별 값(`ug.eokbu.element` 등)을 쓰는 것을 권한다.

### 3.1 전체 특징 목록 (도구 `--catalog` 출력 그대로)

| 키 | 형 | 값 범위 | 뜻 | 출처(RuleAnalysis) |
|---|---|---|---|---|
| `meta.hourKnown` | boolean |  | 시주를 알고 계산했는가 | omitted |
| `dm.stem` | string | 甲 乙 丙 丁 戊 己 庚 辛 壬 癸 | 일간 | dayMaster.stem |
| `dm.element` | string | wood fire earth metal water | 일간 오행 | dayMaster.element |
| `dm.yinYang` | string | yang yin | 일간 음양 | dayMaster.yinYang |
| `month.branch` | string | 子 丑 寅 卯 辰 巳 午 未 申 酉 戌 亥 | 월지 | source.natal.month.branch |
| `season` | string | spring summer autumn winter | 월지 계절(寅卯辰 봄 … 亥子丑 겨울) | 월지 |
| `season.phase` | string | start peak end | 월지 자리: 생지(寅申巳亥)/왕지(子午卯酉)/고지(辰戌丑未) | 월지 |
| `season.state` | string | 旺 相 休 囚 死 | 일간의 왕상휴수사 | strength.seasonState |
| `month.rel` | string | bigyeop inseong siksang jaeseong gwansal | 월지 정기 오행이 일간에 대해 어떤 묶음인가 | hiddenStems.month 정기 |
| `el.share.wood` | number | 0~1 | wood 가중 비율(기세 shares) | qiFlow.shares.wood |
| `el.share.fire` | number | 0~1 | fire 가중 비율(기세 shares) | qiFlow.shares.fire |
| `el.share.earth` | number | 0~1 | earth 가중 비율(기세 shares) | qiFlow.shares.earth |
| `el.share.metal` | number | 0~1 | metal 가중 비율(기세 shares) | qiFlow.shares.metal |
| `el.share.water` | number | 0~1 | water 가중 비율(기세 shares) | qiFlow.shares.water |
| `el.count.wood` | number | 0~8 | wood 글자 수(천간 + 지지 정기) | elements.counts.wood |
| `el.count.fire` | number | 0~8 | fire 글자 수(천간 + 지지 정기) | elements.counts.fire |
| `el.count.earth` | number | 0~8 | earth 글자 수(천간 + 지지 정기) | elements.counts.earth |
| `el.count.metal` | number | 0~8 | metal 글자 수(천간 + 지지 정기) | elements.counts.metal |
| `el.count.water` | number | 0~8 | water 글자 수(천간 + 지지 정기) | elements.counts.water |
| `el.dominant` | string | wood fire earth metal water | 가장 큰 오행 | qiFlow.dominant.element |
| `el.dominantShare` | number | 0~1 | 가장 큰 오행 비율 | qiFlow.dominant.share |
| `el.dominantRel` | string | self bigyeop inseong siksang jaeseong gwansal | 가장 큰 오행이 일간에 대해 어떤 묶음인가 | qiFlow.dominant + 일간 |
| `el.selfShare` | number | 0~1 | 일간 오행 비율 | qiFlow.shares[일간 오행] |
| `el.missing` | string[] | wood fire earth metal water | 가중 0인 오행 | qiFlow.missing |
| `el.missingCount` | number | 0~4 | 없는 오행 수 | qiFlow.missing.length |
| `el.concentration` | number | 0.2~1 | 오행 집중도 Σshare²(0.2 고름 ~ 1 한 오행) | qiFlow.concentration |
| `yy.yangRatio` | number | 0~1 | 양 글자 비율(천간+지지) | elements.yinYang |
| `tg.share.bigyeop` | number | 0~1 | bigyeop 묶음 비율(일간 제외 묶음 합 대비) | strength.groupTotals.bigyeop |
| `tg.share.inseong` | number | 0~1 | inseong 묶음 비율(일간 제외 묶음 합 대비) | strength.groupTotals.inseong |
| `tg.share.siksang` | number | 0~1 | siksang 묶음 비율(일간 제외 묶음 합 대비) | strength.groupTotals.siksang |
| `tg.share.jaeseong` | number | 0~1 | jaeseong 묶음 비율(일간 제외 묶음 합 대비) | strength.groupTotals.jaeseong |
| `tg.share.gwansal` | number | 0~1 | gwansal 묶음 비율(일간 제외 묶음 합 대비) | strength.groupTotals.gwansal |
| `tg.dominant` | string | bigyeop inseong siksang jaeseong gwansal | 가장 큰 십성 묶음(동점은 비겁→인성→식상→재성→관살 순) | strength.groupTotals |
| `tg.stems.bigyeop` | number | 0~3 | bigyeop 묶음 천간 수(일간 제외, 투출) | tenGods(천간) |
| `tg.stems.inseong` | number | 0~3 | inseong 묶음 천간 수(일간 제외, 투출) | tenGods(천간) |
| `tg.stems.siksang` | number | 0~3 | siksang 묶음 천간 수(일간 제외, 투출) | tenGods(천간) |
| `tg.stems.jaeseong` | number | 0~3 | jaeseong 묶음 천간 수(일간 제외, 투출) | tenGods(천간) |
| `tg.stems.gwansal` | number | 0~3 | gwansal 묶음 천간 수(일간 제외, 투출) | tenGods(천간) |
| `tg.stemTenGods` | string[] | 비견 겁재 식신 상관 편재 정재 편관 정관 편인 정인 | 천간(일간 제외)에 드러난 십성 | tenGods(천간) |
| `tg.present` | string[] | 비견 겁재 식신 상관 편재 정재 편관 정관 편인 정인 | 원국에 있는 십성(천간·지지·지장간) | tenGods(원국) |
| `st.weighted` | string | 신강 중화 신약 | 모형 A(가중) 판정 | strength.models[weighted].verdict |
| `st.threeFactor` | string | 신강 중화 신약 | 모형 B(득령·득지·득세) 판정 | strength.models[threeFactor].verdict |
| `st.rooted` | string | 신강 중화 신약 | 모형 C(통근) 판정 | strength.models[rooted].verdict |
| `st.primary` | string | 신강 중화 신약 | 대표 모형 판정(strengthPrimary) | strength.models[primary].verdict |
| `st.ratio` | number | 0~1 | 모형 A 돕는 비율 | strength.models[weighted].ratio |
| `st.extreme` | string·null | strong weak | 모형 A 극단(극신강·극신약) | strength.models[weighted].extreme |
| `st.agreement` | string | all split | 세 모형 판정 일치 | strength.agreement |
| `st.nearBoundary` | boolean |  | 모형 A 경계 근처 | strength.models[weighted].nearBoundary |
| `st.dmRooted` | boolean |  | 일간 통근 | strength.dayMasterRooted |
| `st.rootCount` | number | 0~8 | 일간 뿌리 수 | strength.dayMasterRoots.length |
| `st.tableSensitive` | boolean |  | 신강약이 지장간 표에 따라 바뀜 | strength.tableSensitive |
| `st.hourSensitive` | boolean·null |  | 시주 모름 — 신강약이 시주에 따라 바뀜(시주 알면 null) | strength.hourSensitivity |
| `gk.name` | string·null | 정관격 칠살격 정재격 편재격 정인격 편인격 식신격 상관격 건록격 양인격 월겁격 | 주 후보 격 이름 | structure.candidates[role=primary].name |
| `gk.kind` | string·null | regular rokgeop | 주 후보 종류 | structure.candidates[primary].kind |
| `gk.tenGod` | string·null | 비견 겁재 식신 상관 편재 정재 편관 정관 편인 정인 | 격을 잡은 월지 지장간의 십성 | structure.candidates[primary].pivot.tenGod |
| `gk.group` | string·null | bigyeop inseong siksang jaeseong gwansal | 격 십성의 묶음 | pivot.tenGod |
| `gk.hasSpecial` | boolean |  | 특수격 후보 있음(항상 low) | structure.candidates[kind=special] |
| `gk.special` | string[] |  | 특수격 후보 이름들 | structure.candidates[kind=special].name |
| `gk.variantAgreement` | string·null | same differs | 투출 규칙 변형 간 일치 | structure.candidates[primary].variantAgreement |
| `gk.tableSensitive` | boolean |  | 격이 지장간 표에 따라 바뀜 | structure.tableSensitive |
| `ug.eokbu.status` | string·null | ok balanced none notApplicable | 억부 관점 상태 | usefulGods.views[eokbu].status |
| `ug.eokbu.element` | string·null | wood fire earth metal water | 억부 1순위 오행 | views[eokbu].candidates[0] |
| `ug.eokbu.group` | string·null | bigyeop inseong siksang jaeseong gwansal | 억부 1순위 묶음 | views[eokbu].candidates[0].group |
| `ug.johu.element` | string·null | wood fire earth metal water | 조후 1순위 오행 | views[johuClimate].candidates[0] |
| `ug.tonggwan.element` | string·null | wood fire earth metal water | 통관 1순위 오행 | views[tonggwan].candidates[0] |
| `ug.gyeokguk.element` | string·null | wood fire earth metal water | 격국 관점 1순위 오행 | views[gyeokguk].candidates[0] |
| `ug.single.element` | string·null | wood fire earth metal water | 하나만 대표값 제안(§3.8 가 — 고객 표시용 아님) | usefulGods.singlePickProposal.element |
| `ug.top.element` | string·null | wood fire earth metal water | 가장 많은 관점이 1순위로 낸 오행 | usefulGods.agreement[0] |
| `ug.top.count` | number | 0~6 | 그 오행을 낸 관점 수 | usefulGods.agreement[0].methods.length |
| `cl.tClass` | string | 한강 한 중 난 열강 | 한난 분류 | climate.tClass |
| `cl.mClass` | string | 습강 습 중 조 조강 | 조습 분류 | climate.mClass |
| `cl.T` | number | -6~6 | 한난 수치 | climate.T |
| `cl.M` | number | -6~6 | 조습 수치 | climate.M |
| `cl.needs` | string[] | warm cool dry moisten | 조후 필요(warm/cool/dry/moisten) | climate.needs |
| `rel.combine` | number | 0~10 | 합 수(천간합·육합·삼합·반합·방합) | interactions(scope natal) |
| `rel.clash` | number | 0~10 | 충 수(지지충·천간충) | interactions |
| `rel.punishment` | number | 0~10 | 형 수 | interactions |
| `rel.break` | number | 0~10 | 파 수 | interactions |
| `rel.harm` | number | 0~10 | 해 수 | interactions |
| `rel.tension` | number | 0~20 | 충+형+파+해 | interactions |
| `rel.balance` | number | -20~10 | 합 − (충+형+파+해) | interactions |
| `rel.types` | string[] | stemCombine stemClash sixCombine threeCombine halfCombine directionalCombine clash punishment break harm | 나타난 관계 종류 | interactions |
| `rel.dayBranchClash` | boolean |  | 일지가 충을 받음 | interactions(clash, 일지) |
| `rel.monthBranchClash` | boolean |  | 월지가 충을 받음 | interactions(clash, 월지) |
| `rel.dayStemCombine` | boolean |  | 일간이 천간합 | interactions(stemCombine, 일간) |
| `rel.completeTriad` | boolean |  | 삼합·방합 세 글자 완성 | interactions(complete) |
| `fl.chainLength` | number | 0~5 | 상생 연쇄 길이(비율 0.10 이상 오행) | qiFlow.flowChain.elements.length |
| `fl.circular` | boolean |  | 다섯 오행 순환 | qiFlow.flowChain.circular |
| `fl.toOutput` | boolean |  | 일간 → 식상 흐름 | qiFlow.dayMasterFlow.toOutput |
| `fl.toWealth` | boolean |  | 식상 → 재성 흐름 | qiFlow.dayMasterFlow.toWealth |
| `fl.fromResource` | boolean |  | 인성 → 일간 흐름 | qiFlow.dayMasterFlow.fromResource |
| `fl.clarity` | string[] | 관살혼잡 상관견관 효신탈식 비겁쟁재 재성파인 | 천간 청탁 표지 | qiFlow.clarityFlags |
| `fl.clarityCount` | number | 0~5 | 청탁 표지 수 | qiFlow.clarityFlags.length |
| `gm.hits` | number | 0~3 | 원국 공망 지지 수(rule 옵션 gongmangBasis 기준 첫 항목) | gongmang[0].hits(원국) |

## 4. 원형 점수 모델 (규칙 파일)

### 4.1 규칙 파일 형식

연구소장이 정한 조건을 아래 JSON 한 장으로 옮긴다. 예시: `scripts/archetype-lab/rules/example-v0.json`.

```json
{
  "id": "research-12", "version": "0.1.0", "status": "draft",
  "source": "docs/redesign/02-archetypes.md (연구소장 2026-11-xx)",
  "disclaimer": "신성 원형은 전통 명리학의 공식 분류가 아니라 … 창작적 상징 해석입니다.",
  "featureVersion": "features@0.1.0",
  "params": { "boundaryMargin": 0.5, "minScore": 2 },
  "fallback": "yellow-dragon",
  "archetypes": [
    {
      "id": "white-tiger", "name": "백호", "category": "divineBeast", "priority": 4,
      "require": { "f": "el.share.metal", "gte": 0.15 },
      "exclude": { "f": "gk.hasSpecial", "eq": true },
      "terms": [
        { "id": "A1", "label": "금 기운 비율", "linear": { "f": "el.share.metal", "mul": 8, "offset": 0.2, "min": 0, "max": 3 } },
        { "id": "A2", "label": "칠살격", "when": { "f": "gk.name", "eq": "칠살격" }, "points": 1 },
        { "id": "A3", "label": "충과 관살", "when": { "all": [ { "f": "rel.clash", "gte": 1 }, { "f": "tg.share.gwansal", "gte": 0.3 } ] }, "points": 1.5 }
      ]
    }
  ]
}
```

- **조건 문법**: 잎 조건 `{ "f": 특징키, 연산자: 값 }` — 연산자 `eq` `ne` `in` `gte` `gt` `lte` `lt` `between`(숫자), `has` `hasAny` `hasNone`(목록 특징). 묶음 `all`·`any`·`not`.
- **점수 항목**: `points`(고정점) 또는 `linear`(`(값 − offset) × mul`, `min`·`max`로 자름) 중 하나. `when`이 없으면 항상 적용.
- **자격·제외**: `require` 거짓 / `exclude` 참이면 후보 탈락. "이 구조가 아니면 절대 이 원형이 아니다"를 표현.
- **검증(로드 시 오류로 멈춤)**: 없는 특징 키, 특징에 없는 값(예: `season`에 "봄"), 연산자–형 불일치, `priority` 중복, `id` 중복·형식, `fallback` 누락, `featureVersion` 불일치, `points`·`linear` 동시 사용. 오타가 조용히 "항상 거짓"이 되는 일을 막는다. `--check`만 따로 돌릴 수 있다.

### 4.2 점수 계산 규칙

- 항목 점수는 `round(x × 10⁶)` 정수로 더한다. 결과 표시는 그 값을 10⁶으로 나눈 수.
- 숫자 연산자인데 특징이 `null`이면(예: 억부 균형이라 `ug.eokbu.element` 없음) 그 조건은 거짓.
- `all`·`any`는 단락 평가를 하지 않는다 — 판정에 쓴 특징 값을 근거에 모두 남기기 위해서.

### 4.3 동점·경계·대체

| 상황 | 처리 | 기록 |
|---|---|---|
| 1·2순위 점수 완전 동점 | `priority`가 작은 원형이 1순위 | `tie: true`, `decidedBy: "priority"`, `margin: 0` |
| 점수 차 < `params.boundaryMargin` | 1순위는 그대로 | `boundary: true` → 콘텐츠가 "두 기운이 겨루는 사주"로 2순위를 함께 서술할 수 있음 |
| 1순위 점수 < `params.minScore` 또는 자격 있는 원형 없음 | `fallback` 원형 | `decidedBy: "fallback"`, `boundary: true` |

`priority`는 단순 순번이 아니라 **연구소장이 정하는 뜻 있는 순서**여야 한다(예: 더 좁고 특수한 조건의 원형을 앞에). 예시 규칙에서는 완전 동점이 9.9% 나왔다(10절) — 고정점만 쓰면 동점이 많아지므로 비례점(`linear`)을 섞거나 점수 단위를 다양하게 해서 2% 이하로 낮추는 것을 합격 기준으로 제안한다(9절).

### 4.4 근거 기록

`ranking[]`의 원형마다 `evidence[]` = `{ termId, label, points, inputs: {특징키: 값} }`. 자격·제외 판정도 `termId: "require" | "exclude"`로 남는다. **근거 점수 합 = 원형 점수**를 테스트로 보장한다. 콘텐츠 단계는 `label`과 `inputs`를 쉬운 말로 풀어 "명리학적 근거" 항목(지시서 4절 11번째)을 만든다. 근거 샘플은 10절 8항.

## 5. 시각 모름(시주 없음) 처리

- 시각을 모르면 규칙 엔진이 세 기둥만 계산한다(`omitted: ["hour"]`). 원형 엔진은 그 결과로 **세 기둥 원형**을 낸다.
- 동시에 일간 기준 12시진 시주(子→亥, 규칙 엔진 `strength.hourSensitivity`와 같은 방식)를 하나씩 넣어 본 1순위를 `hourSensitivity.byHour`에 기록한다. `stable`(12시진 모두 같은가), `distinctPrimary`(나온 원형들, priority 순), `agreeWithThreePillars`(세 기둥 결과와 같은 시진 수), `modal`(최빈 원형).
- 대표값 정책 두 가지를 구현해 비교했다(`hourUnknownPolicy`):
  - `threePillars`(제안 기본): 알려진 글자만으로 계산 — 근거가 고객이 준 정보와 1:1로 맞는다.
  - `hourModal`: 12시진 중 가장 많이 나온 원형 — 세 기둥 결과와 28.5% 다름(10절).
- 화면 표시 제안: `stable: false`면 "태어난 시각에 따라 ○○ 또는 △△의 모습이 함께 보인다"를 `distinctPrimary`로 안내하고, 시각 입력을 권한다. `stable: true`면 "시각과 관계없이 같은 원형".
- 한계(기록): 12시진 변형은 **같은 일주**에 시주만 바꾼다. 실제로 23시대 출생(기본 `ziHour: "nextDay"`)이나 절입 당일은 시각에 따라 일주·월주도 바뀌므로 이 경우는 변형에 포함되지 않는다. 실험 1만 건 중 285건이 해당(일·월주가 정오 가정과 다름). 나머지 9,715건에서는 "실제 시주 변형의 1순위 = 시각 앎 1순위"가 100%로 검산됐다.

## 6. 학파 옵션(지장간 표) 민감도

- 규칙 옵션은 `RuleOptions` 그대로 받고 결과 `ruleOptions`에 전부 기록한다(기본 `kr-monthly-30`).
- `tableSensitivity.byTable` = 세 표 각각의 1·2순위. `sensitive` = {선택 표, kr-monthly-30, cn-lunarjs} 1순위가 다름 — 규칙 엔진 rules@0.4.0의 `tableSensitive` 정의와 맞췄다. `sensitiveIncludingMainOnly` = 세 표 모두 비교(내부 참고).
- 화면: `sensitive: true`면 근거 화면(무료 4장)에 "보는 방식(학파)에 따라 ○○로 볼 수도 있다"를 접어 두는 수준을 제안. 원형 이름 자체를 둘로 보여 주지는 않는다.
- 다른 학파 옵션(12운성 음간, 반합 범위 등)도 같은 방식으로 늘릴 수 있다. 지금은 지시대로 지장간 표만 계산(규칙 엔진 2회 추가).

## 7. 버전 관리

| 항목 | 형식 | 언제 올리나 |
|---|---|---|
| `engineVersion` | `archetype@x.y.z` (실험 중 `archetype@0.1.0-lab`) | 점수 계산·순위·동점 규칙·결과 구조가 바뀔 때 |
| `featureVersion` | `features@x.y.z` | 특징 키 추가(minor)·뜻 변경/삭제(major). 규칙 파일이 전제한 버전과 다르면 로드 거부 |
| `ruleSet.id` + `ruleSet.version` | `research-12@0.1.0` | 연구소장이 조건·점수를 바꿀 때 |
| `ruleSet.hash` | 키 정렬 JSON의 sha256 앞 16자리 | 자동. 버전을 안 올리고 파일만 바꿔도 드러난다 |
| `rulesEngineVersion`, `calendarEngineVersion` | 기존 `rules@0.4.0`, `calendar@0.1.1` | 기존 규칙 |
| `ruleOptions` | 전체 옵션 | 결과마다 기록 |

**결과 고정(제안, 백엔드와 협의)**: 고객에게 한 번 보여 준 원형은 저장된 결과(위 버전 전부 포함)를 그대로 다시 보여 준다. 규칙 파일이 바뀌어도 자동으로 다시 계산해 원형이 바뀌지 않게 한다(재방문·공유 카드 일관성). 재계산은 명시적 이전 작업으로만, 바뀌는 고객 수를 이 도구로 먼저 측정한다.

## 8. 데이터 구조 타입 초안

> 아직 `src/engine/types.ts`에 넣지 않는다. 실험 도구의 `scripts/archetype-lab/lib/types.ts`가 같은 내용이다.

```ts
export const ARCHETYPE_ENGINE_VERSION = "archetype@0.1.0-lab"
export const FEATURE_VERSION = "features@0.1.0"

export type FeatureValue = number | string | boolean | null | string[]
export type FeatureVector = Record<string, FeatureValue>          // 키 순서 = FEATURE_CATALOG 순서

// ── 규칙 파일
export type LeafCondition =
  | { f: string; eq: string | number | boolean | null } | { f: string; ne: string | number | boolean | null }
  | { f: string; in: (string | number | boolean | null)[] }
  | { f: string; gte: number } | { f: string; gt: number } | { f: string; lte: number } | { f: string; lt: number }
  | { f: string; between: [number, number] }
  | { f: string; has: string } | { f: string; hasAny: string[] } | { f: string; hasNone: string[] }
export type Condition = LeafCondition | { all: Condition[] } | { any: Condition[] } | { not: Condition }
export interface ScoreTerm {
  id: string; label: string; when?: Condition
  points?: number                                                   // points와 linear 중 하나
  linear?: { f: string; mul: number; offset?: number; min?: number; max?: number }
}
export interface ArchetypeRule {
  id: string                // 저장·이미지 자산 키(바꾸지 않음)
  name: string
  category: "divineBeast" | "spiritAnimal" | "divineHuman" | "nature" | "celestial"
  priority: number          // 동점 순위(작을수록 앞), 파일 안에서 유일
  require?: Condition; exclude?: Condition
  terms: ScoreTerm[]
}
export interface ArchetypeRuleSet {
  id: string; version: string; status: "example" | "draft" | "approved"
  source: string; disclaimer: string; featureVersion: string
  params: { boundaryMargin: number; minScore: number }
  fallback: string
  archetypes: ArchetypeRule[]
}

// ── 결과
export interface EvidenceItem { termId: string; label: string; points: number; inputs: Record<string, FeatureValue> }
export interface ArchetypeScore {
  id: string; name: string; eligible: boolean; ineligibleBy?: "require" | "exclude"
  score: number; matchedTerms: number; evidence: EvidenceItem[]
}
export interface ArchetypePick { id: string; name: string; score: number }
export interface ArchetypeScoring {
  primary: ArchetypePick
  secondary: ArchetypePick | null
  ranking: ArchetypeScore[]     // 자격 있는 원형(점수↓ → priority↑ → id) → 탈락 원형
  margin: number | null; tie: boolean; boundary: boolean
  decidedBy: "score" | "priority" | "fallback" | "hourModal"
}
export type HourUnknownPolicy = "threePillars" | "hourModal"
export interface ArchetypeResult extends ArchetypeScoring {
  engineVersion: string; featureVersion: string; rulesEngineVersion: string; calendarEngineVersion: string
  ruleSet: { id: string; version: string; status: ArchetypeRuleSet["status"]; hash: string }
  ruleOptions: RuleOptions
  hourKnown: boolean
  hourUnknownPolicy: HourUnknownPolicy
  features: FeatureVector
  hourSensitivity: null | {
    byHour: { hour: Pillar; primary: string; secondary: string | null }[]   // 子→亥 12개
    distinctPrimary: string[]; stable: boolean; agreeWithThreePillars: number
    modal: { id: string; count: number }
  }
  tableSensitivity: null | {
    byTable: { tableId: HiddenStemTableId; primary: string; secondary: string | null }[]
    sensitive: boolean; sensitiveIncludingMainOnly: boolean
  }
  disclaimer: string
}

// ── 공개 함수(승인 후 src/engine/archetype/)
export function scoreAnalysis(a: RuleAnalysis, rs: ArchetypeRuleSet): ArchetypeScoring & { features: FeatureVector }
export function classifyArchetype(chart: CalendarResult, rs: ArchetypeRuleSet, opts?: {
  ruleOptions?: Partial<RuleOptions>; hourUnknownPolicy?: HourUnknownPolicy
  sensitivity?: { hour?: boolean; table?: boolean }
}): ArchetypeResult
```

원형의 **표현 자산**(별칭·한 문장·강점·그림자·테마 색·대표 이미지 키)은 이 타입에 넣지 않는다. 원형 `id`를 키로 콘텐츠·디자인 쪽 데이터(작가·디자인 실장 소유)에서 찾는다 — 계산과 표현을 분리.

## 9. 실험 도구 `scripts/archetype-lab/`

| 파일 | 역할 |
|---|---|
| `run.ts` | 실행 입구(CLI) |
| `lib/types.ts` | 8절 타입 |
| `lib/features.ts` | 특징 목록(`FEATURE_CATALOG`)·`extractFeatures` |
| `lib/ruleset.ts` | 규칙 파일 읽기·검증·해시 |
| `lib/score.ts` | 조건 평가·점수·순위·동점·대체 |
| `lib/classify.ts` | `scoreAnalysis`·`classifyArchetype`(시주·표 민감도) |
| `lib/random.ts` | 고정 시드 난수(mulberry32), 1900-01-01~2100-12-31 균등 출생 입력 |
| `lib/lab.ts`, `lib/report.ts` | N건 실행·결정성 재계산·단계별 시간 측정 / 보고서(마크다운) |
| `rules/example-v0.json` | **임시 예시 12개(명리 근거 없음)** |
| `lab.test.ts`, `vitest.config.ts` | 결정성·검증·동점 테스트(`npm test` 범위 밖, 따로 실행) |
| `out/example-v0_n10000.md` | 10절 보고서 원본 |

```bash
# 보고서(기본 1000건)
npx vite-node scripts/archetype-lab/run.ts -- --n 10000 --md scripts/archetype-lab/out/결과.md
# 연구소장 안이 오면: 규칙 파일만 바꿔 끼운다
npx vite-node scripts/archetype-lab/run.ts -- --rules scripts/archetype-lab/rules/research-12.json --check
npx vite-node scripts/archetype-lab/run.ts -- --rules scripts/archetype-lab/rules/research-12.json --n 10000 --json out.json
# 특징 목록 표(연구소장용)
npx vite-node scripts/archetype-lab/run.ts -- --catalog
# 테스트
npx vitest run --config scripts/archetype-lab/vitest.config.ts
```

기타 옵션: `--seed`, `--samples`(근거 샘플 수), `--determinism`(재계산 확인 건수), `--no-table`, `--no-hour`. 오류가 있거나 재계산 결과가 다르면 종료 코드 1.

**보고서 항목**: ① 원형별 비율(1순위·2순위·시각 모름) + 최대·최소·엔트로피 ② 같은 일간 안의 원형 수·최빈 비율, "일간 오행만 / 일간만 / 일주만 / 월지+일간만 알 때 1순위 적중률" vs 기준선(가장 흔한 원형만 찍기) ③ 시주 민감도 ④ 표 민감도 ⑤ 동점·경계·대체 비율과 점수 차 분포 ⑥ 조건별 발동률·자격 탈락률(조건이 너무 흔하거나 거의 안 나오는지) ⑦ 결정성·성능 ⑧ 근거 기록 샘플.

### 9.1 연구소장 안 합격 기준(제안 — 총괄실장·연구소장 확정 필요)

| 지표 | 제안 기준 | 이유 |
|---|---|---|
| 원형별 1순위 비율 | 모두 3% 이상 15% 이하(12개 균등 8.3%) | 한 원형 쏠림·사실상 안 나오는 원형 방지. 희귀 원형을 의도하면 예외로 명시 |
| 일간 오행만 알 때 적중률 | 기준선 + 15%p 이하 | "일간 하나로 정하지 않는다"(지시서 3절)의 수치화 |
| 같은 일간 안 원형 수 | 일간마다 8종 이상 | 같음 |
| kr ↔ cn 표 민감도 | 10% 이하 | 학파 차이로 원형이 바뀌는 고객 최소화 |
| 완전 동점 | 2% 이하 | priority 결정은 설명력이 약함 |
| 경계(차 < boundaryMargin) | 기록만(목표 없음) | 콘텐츠에서 2순위 활용 |
| 시주 민감도(12시진 모두 같음) | 기록 + 연구소장 판단 | 월령·일주·격국 위주 조건일수록 높아짐. 예시 규칙은 11%뿐 |
| 결정성 | 재계산 100% 일치, 실행 두 번 결과 해시 일치 | 필수 |

## 10. 실험 결과 — 임시 예시 규칙(example-v0), 무작위 1만 건

> 아래는 `npx vite-node scripts/archetype-lab/run.ts -- --n 10000 --samples 4 --determinism 500 --md scripts/archetype-lab/out/example-v0_n10000.md` 출력을 그대로 붙인 것이다(2026-11-28 실행). **예시 규칙은 도구 확인용이라 원형 비율 자체에는 의미가 없다.** 의미 있는 것은 도구가 무엇을 잡아내는지다.

#### 실행 정보
- 규칙 파일: `example-v0@0.0.1` (status: example, sha256:3b60f55e9102dd45)
- 엔진: archetype@0.1.0-lab · features@0.1.0 · rules@0.4.0 · 역법 calendar@0.1.1
- 표본: 양력 1900-01-01~2100-12-31 균등 무작위 10000건, 시드 `archetype-lab-v1`, 서울 시각, 규칙 옵션 기본값
- 계산 성공 10000건 · 오류 0건
- 결과 해시(시간 측정 제외): `sha256:886c5dcd13a361f2`

#### 1. 원형별 비율 (시각 앎 1순위 / 2순위 / 시각 모름 세 기둥 1순위)
| 원형 | 1순위 | 2순위 | 시각 모름 1순위 |
|---|---:|---:|---:|
| 청룡(예시) `ex-azure-dragon` | 6.0% | 8.1% | 8.1% |
| 주작(예시) `ex-vermilion-bird` | 6.7% | 7.2% | 8.1% |
| 황룡(예시) `ex-yellow-dragon` | 5.2% | 8.8% | 5.2% |
| 백호(예시) `ex-white-tiger` | 9.6% | 10.7% | 9.3% |
| 현무(예시) `ex-black-tortoise` | 6.3% | 8.5% | 7.8% |
| 봉황(예시) `ex-phoenix` | 24.2% | 16.3% | 24.8% |
| 흑여우(예시) `ex-black-fox` | 17.6% | 12.0% | 8.3% |
| 은빛 늑대(예시) `ex-silver-wolf` | 9.7% | 4.6% | 10.8% |
| 백록(예시) `ex-white-deer` | 0.8% | 2.1% | 3.5% |
| 달의 여신(예시) `ex-moon-goddess` | 6.7% | 10.5% | 6.0% |
| 지혜의 현자(예시) `ex-sage` | 6.2% | 10.5% | 5.0% |
| 은하(예시) `ex-galaxy` | 1.0% | 0.5% | 3.3% |

- 1순위 최대 24.2% · 최소 0.8% · 0건 원형 0개 · 정규화 엔트로피 0.892 (1 = 완전 균등, 균등이면 원형당 8.3%)

#### 2. 같은 일간 안의 원형 다양성 (일간 하나로 정해지지 않는가)
| 일간 | 표본 | 나온 원형 수 | 최빈 원형 | 최빈 비율 |
|---|---:|---:|---|---:|
| 甲(목) | 980 | 12 | 봉황(예시) | 22.6% |
| 乙(목) | 1013 | 11 | 봉황(예시) | 25.2% |
| 丙(화) | 951 | 12 | 봉황(예시) | 30.5% |
| 丁(화) | 995 | 12 | 봉황(예시) | 26.1% |
| 戊(토) | 1039 | 12 | 은빛 늑대(예시) | 20.8% |
| 己(토) | 1009 | 12 | 봉황(예시) | 20.2% |
| 庚(금) | 991 | 12 | 봉황(예시) | 22.5% |
| 辛(금) | 1035 | 12 | 봉황(예시) | 26.4% |
| 壬(수) | 954 | 12 | 봉황(예시) | 26.0% |
| 癸(수) | 1033 | 12 | 봉황(예시) | 27.5% |

- 일간 오행(5)만 알 때 1순위 적중률 24.7%, 일간(10)만 알 때 24.7% — 기준선(전체 최빈 원형만 찍기) 24.2%
- 일주(60)만 알 때 26.6% · 월지+일간(120)만 알 때 52.3%

#### 3. 시주 민감도
- 시각 앎 1순위 = 같은 사람 시각 모름(세 기둥) 1순위: 57.1%
- 시각 모름 원국에 12시진을 넣어 봤을 때 1순위가 모두 같음: 11.1% (= "시주에 따라 원형이 바뀜" 표시 대상 88.9%)
- 12시진 중 나온 1순위 종류 수 분포: 1종 11.1% · 2종 27.3% · 3종 30.1% · 4종 19.6% · 5종 9.1% · 6종 2.3% · 7종 0.5% · 8종 0.0%
- 세 기둥 1순위와 같은 시진 수 평균 6.89/12 · 12시진 최빈 원형 ≠ 세 기둥 1순위: 28.5%
- 검산: 실제 시주 변형의 1순위 = 시각 앎 1순위 100.0% (일·월주가 정오 가정과 같은 9715건)

#### 4. 지장간 표 민감도 (시각 앎, 기본 kr-monthly-30)
- kr-monthly-30 ↔ cn-lunarjs 1순위 다름: 18.4%
- main-only 포함 세 표 중 하나라도 다름: 47.9%

#### 5. 동점·경계·대체
- 점수 완전 동점(priority로 결정): 9.9% · 경계(1·2순위 차 < 0.5): 31.1% · 대체 원형(1순위 < 2점): 0.5%
- 1·2순위 점수 차 중앙값 0.70 · 하위 10% 0.01 · 상위 10% 1.96

#### 6. 조건(점수 항목) 발동률 — 시각 앎 기준
| 원형 | 자격 탈락 | 항목별 발동률 |
|---|---:|---|
| 청룡(예시) | 0.0% | wood-share 39.3% · spring 24.1% · grow-flow 13.4% · long-chain 84.5% |
| 주작(예시) | 0.0% | fire-share 35.4% · output-heavy 21.8% · warm 35.7% · sanggwan-stem 26.5% |
| 황룡(예시) | 0.0% | earth-share 70.3% · balanced 23.2% · circular 15.1% · mild 30.4% |
| 백호(예시) | 0.0% | metal-share 40.0% · officer-heavy 22.3% · clash 61.2% · chilsal 10.1% |
| 현무(예시) | 0.0% | water-share 38.2% · cold 33.9% · resource-heavy 22.4% · rooted 90.5% |
| 봉황(예시) | 0.0% | noble-structure 30.1% · clear 74.4% · to-wealth 48.5% · agree 69.7% |
| 흑여우(예시) | 0.0% | tricky-structure 30.4% · many-combine 56.7% · tricky-stem 48.6% · yin 50.9% |
| 은빛 늑대(예시) | 0.0% | peer-heavy 13.9% · strong 27.6% · rokgeop 20.0% · day-clash 23.2% |
| 백록(예시) | 0.0% | resource 22.4% · weak 49.1% · calm 6.0% · mild 35.1% |
| 달의 여신(예시) | 0.0% | yin-heavy 38.8% · yin-dm 50.9% · moist 31.9% · winter-autumn 49.5% · inner 23.9% |
| 지혜의 현자(예시) | 0.0% | resource-structure 21.2% · resource-stem 49.0% · resource-output 19.0% · chain4 67.3% |
| 은하(예시) | 0.0% | special 1.2% · concentrated 9.0% · extreme 4.7% · missing2 0.6% |

#### 7. 결정성·성능
- 결정성: 앞 500건을 처음부터 두 번 다시 계산(시각 앎 + 표 민감도, 시각 모름 + 12시진·표 민감도) → 근거 포함 전체 결과 동일 500/500
- 전체 10000건 실행 34.5초 (1건당 3.45ms = 원국 2회 + [시각 앎: 규칙 엔진·원형 점수 3회] + [시각 모름: 1+12회])
- 단계별(앞 2000건 평균): 역법 computeChart 0.034ms · 규칙 analyzeRules 0.182ms · 특징+원형 점수 0.036ms
- 서비스 1회 요청 추정(민감도 포함): 원국 1 + 규칙 3(표) + 12(시각 모름일 때) ≈ 0.7ms(시각 앎) / 2.9ms(시각 모름, 표 민감도 제외)

#### 8. 근거 기록 샘플 (시각 앎, 1·2순위)
- #0 `己卯 壬申 壬申 乙巳` → **흑여우(예시)** 4점 / 2순위 지혜의 현자(예시) 3점 · 차 1 · score
  - 흑여우(예시): 편인·상관·편재격 +2 [gk.tenGod=편인]; 합 2개 이상 +1.5 [rel.combine=2]; 천간 편인 또는 상관 +0.5 [tg.stemTenGods=비견/상관/정관]
  - 지혜의 현자(예시): 인성 계열 격 +2 [gk.group=inseong]; 상생 연쇄 4 이상 +1 [fl.chainLength=4]
- #1 `戊申 丙辰 己未 甲戌` → **은빛 늑대(예시)** 4.5점 / 2순위 황룡(예시) 1.961904점 · 차 2.538096 · score
  - 은빛 늑대(예시): 비겁 묶음 35% 이상 +2 [tg.share.bigyeop=0.477193]; 대표 모형 신강 +1 [st.primary=신강]; 록겁 계열 격 +1.5 [gk.kind=rokgeop]
  - 황룡(예시): 토 기운 비율 +1.961904 [el.share.earth=0.526984]
- #2 `甲申 乙亥 丁未 庚戌` → **봉황(예시)** 4.5점 / 2순위 지혜의 현자(예시) 3.5점 · 차 1 · score
  - 봉황(예시): 정관·정재·정인격 +2 [gk.name=정인격]; 청탁 표지 없음 +1 [fl.clarityCount=0]; 식상→재성 흐름 +1 [fl.toWealth=true]; 신강약 세 모형 일치 +0.5 [st.agreement=all]
  - 지혜의 현자(예시): 인성 계열 격 +2 [gk.group=inseong]; 천간 인성 투출 +0.5 [tg.stems.inseong=2]; 상생 연쇄 4 이상 +1 [fl.chainLength=5]
- #3 `庚寅 己卯 己酉 丙寅` → **백호(예시)** 3.80476점 / 2순위 청룡(예시) 2.998416점 · 차 0.806344 · score
  - 백호(예시): 금 기운 비율 +0.30476 [el.share.metal=0.238095]; 관살 묶음 30% 이상 +1.5 [tg.share.gwansal=0.42807]; 원국 충 있음 +1 [rel.clash=1]; 칠살격 +1 [gk.name=칠살격]
  - 청룡(예시): 목 기운 비율 +1.498416 [el.share.wood=0.387302]; 봄 월령 +1 [season=spring]; 상생 연쇄 3 이상 +0.5 [fl.chainLength=4]

### 10.1 도구가 잡아낸 것 (연구소장 안 설계 시 참고)

1. **결정성은 확보**: 재계산 500/500 일치, 별도 프로세스 두 번 실행 결과 해시 `sha256:886c5dcd13a361f2` 동일, 오류 0건(1900~2100 전 구간).
2. **일간 의존은 낮게 만들 수 있다**: 예시 규칙에서 일간 오행만으로 맞힐 확률 24.7% ≈ 기준선 24.2%, 모든 일간에서 11~12종 원형이 나왔다. 반면 월지+일간(120칸)으로는 52.3% — 월령·격국을 많이 쓰면 "태어난 달"이 원형을 크게 좌우한다(의도라면 괜찮음, 칸당 표본 약 83건이라 다소 과대평가).
3. **시주 민감도가 매우 크다(가장 큰 위험)**: 12시진 모두 같은 원형은 11.1%뿐, 시각 앎 결과와 세 기둥 결과 일치 57.1%. 시주가 천간 1·지지 1을 더해 비율 특징(오행·십성 비율)을 크게 흔들기 때문이다. 시각 모름 고객이 많다면 연구소장 안은 **월령·일주·격국(월지 기준) 같은 시주에 덜 흔들리는 특징의 비중을 높이고**, 비율 특징은 상한을 둔 비례점으로 쓰는 것을 권한다. 5절 표시 정책도 함께 결정 필요.
4. **표 민감도 18.4%**: 격국(월지 지장간)·비율 특징이 표에 따라 바뀐다. 9.1 기준(10% 이하)을 넘는다 — 표에 덜 민감한 특징(천간 투출 `tg.stems.*`, 계절 `season`)을 섞으면 줄어든다.
5. **완전 동점 9.9%**: 고정점(0.5 단위)만 쓰는 원형끼리 자주 같아진다. 비례점을 쓰는 원형이 많을수록 줄어든다.
6. **쏠림 감지**: 봉황(예시) 24.2%, 백록(예시) 0.8%, 은하(예시) 1.0%. 조건별 발동률 표(⑥)를 보면 원인(예: 봉황의 `clear` 74%·`agree` 70%처럼 너무 흔한 조건)이 바로 보인다.
7. **성능**: 1만 건(1건마다 원국 2회·규칙 엔진 16회·원형 점수 16회) 약 35초. 서비스 요청 1회 기준 시각 앎 약 0.7ms·시각 모름 약 2.9ms(민감도 포함, 실행마다 ±20% 흔들림) — 서버 비용·대기 시간 영향 없음. 원형 점수 단독은 1건 0.03~0.04ms.

## 11. 테스트 (실제 실행)

`npx vitest run --config scripts/archetype-lab/vitest.config.ts` — **16개 통과 / 실패 0** (2026-11-28 실행)

| 묶음 | 확인 내용 |
|---|---|
| 결정성 | 같은 원국(서머타임 1987·23시대·입춘 당일·1900-01-01 시각 모름·2100-12-31)을 두 번 계산 → 근거 포함 JSON이 키 순서까지 같음 / 규칙 파일 원형 순서를 뒤집어도(priority 고정) 순위·점수·시주 민감도 같음 / 같은 시드 = 같은 표본·같은 결과 해시, 다른 시드 = 다른 표본 / 표본 범위 1900-01-01~2100-12-31 |
| 결과 구조 | 버전·규칙 해시·옵션·고지 문구 기록, 특징 키 순서 = 목록 순서, 원형마다 근거 점수 합 = 점수, 시각 모름이면 12시진(子→亥) 기록, `hourModal` 정책 = 최빈 원형, 표 옵션 기록 |
| 동점·대체 | 완전 동점 → priority 결정·`tie`·`boundary` 표시, `require` 탈락 기록, minScore 미달 → fallback |
| 규칙 파일 검증 | 없는 특징 키·없는 값·연산자–형 불일치·priority 중복·featureVersion 불일치·fallback 누락·points/linear 동시 → 오류 |

- 개발 중 이 테스트가 실제 결함 1건을 잡았다: `hourSensitivity.distinctPrimary` 순서가 규칙 파일 나열 순서에 따라 달라짐 → priority 순으로 고쳐 통과.
- `npx tsc --noEmit` 통과(오류 0), `npx eslint scripts/archetype-lab` 통과(경고 0).
- 제품 코드를 고치지 않았으므로 `npm test`(제품 전체)는 다시 돌리지 않았다.

## 12. 결정이 필요한 사항

1. **시각 모름 대표값**: (가) 세 기둥만으로 계산(`threePillars`, 엔진 개발자 추천 — 근거가 고객 정보와 1:1) / (나) 12시진 최빈값(`hourModal`). 어느 쪽이든 "시각에 따라 바뀜" 안내는 표시.
2. **결과 고정**: 한 번 보여 준 원형은 규칙 파일이 바뀌어도 그대로 유지(추천) / 매번 최신 규칙으로 재계산.
3. **9.1 합격 기준 수치** 확정(연구소장·총괄실장).
4. **제품 반영 위치·공개 API**: `src/engine/archetype/**` 신규 + `src/engine/index.ts`에 `classifyArchetype`·타입 추가(계약 변경 — 총괄실장 승인), 규칙 파일 소유(연구소장 작성 → 엔진 개발자 JSON 반영 제안).

## 13. 다음 단계

1. 연구소장 `02-archetypes.md` 수령 → `rules/research-12.json`으로 옮김 → `--check` → 1만 건 보고서 → 9.1 기준 미달 항목을 연구소장에게 돌려 조정(2~3회 반복 예상).
2. 필요한 특징 추가 요청이 오면 `features@0.2.0`.
3. 대표 승인 후 `src/engine/archetype/`로 옮기고 테스트를 `src/engine/archetype/__tests__/`로 이관, `docs/SAJU_ENGINE.md` 계산 명세 절에 원형 엔진 추가, CHANGELOG 기록, 품질검증 담당자 독립 검증.
4. 원형 궁합(두 영물 비교, 지시서 11절)은 두 `ArchetypeResult` + 두 `RuleAnalysis` 관계로 별도 설계(이번 범위 밖).

## 14. 쓰기 범위 확인

이번 작업으로 만든 파일은 `docs/redesign/03-engine-design.md`와 `scripts/archetype-lab/**`뿐이다. `src/**`·`prisma/**`·기존 문서는 수정하지 않았다. git 명령은 쓰지 않았다(커밋은 총괄실장 몫).
