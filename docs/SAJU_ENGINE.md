# 사주엔진 설계 [제안]

> 계산 명세: 사주엔진 개발자 · 해석 규칙: 명리학 연구소장 · 검증: 품질검증 담당자

## 1. 현행 코드 상태 [현행 — 2026-11-27 갱신]
| 파일 | 용도 | 상태 |
|---|---|---|
| `src/engine/calendar/**` (calendar@0.1.1) | 역법 계산: 시간대 이력·서머타임·경도 보정, 절기(UTC), 원국, 한국 음력(UTC+9), 대운 | 골든 테스트(독립 천문 오라클) 통과 |
| `src/engine/rules/**` (rules@0.2.0 → 0.3.0 작업 중) | 지장간·십성·12운성·합충형파해·공망·오행 분포 (+ 신강약·격국·용신·조후 작업 중) | 독립 오라클 4,000건 일치(0.2.0) |
| `src/lib/saju-input.ts` | AI 입력(SajuInputData) — 새 엔진 사용, 시진 가운데 시각(D-018) | 화면 표시와 2,000건 일치 |
| `src/app/reading/[id]/page.tsx` | 결과 화면 — 저장된 sajuInput 글자 그대로 표시 | |
| `src/lib/saju.ts` | **옛 계산(사용처 없음)** — 42% 오류. 삭제는 대표 승인 사항 | 사용 중지 |
| `scripts/qa/legacy-engine-audit.sh` | 옛 감사 스크립트 — 폐기, 대체: `npx vitest run tests/verify/consistency.test.ts` | 폐기 |

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

## 시간 보정 [계산 명세 — calendar@0.1.1, `src/engine/calendar/time.ts`]
입력 현지 법정시각(벽시계) → IANA 시간대 규칙으로 UTC → (옵션) 진태양시 → 일주·시주 판정. 연주·월주는 UTC 순간으로만 판정한다.

1. **UTC 오프셋**: Node 내장 `Intl`(ICU의 IANA tzdb)에서 얻는다. 하드코딩하지 않는다. Asia/Seoul 조회 결과: 1908-04 이전 지방평균시 UTC+8:27:52, 1908-04~1911 UTC+8:30, 1912~ UTC+9, 1954-03-21~1961-08-09 UTC+8:30, 서머타임 1948~51(+10)·1955~60(+9:30)·1987~88(+10).
2. **서머타임 판정(`dstApplied`)**: Intl 긴 이름에 Daylight/Summer가 있으면 서머타임으로 본다. 이름이 "GMT+10:00"처럼 오프셋만 나오는 과거 구간은 "앞뒤 183일 시점의 오프셋보다 모두 크면 서머타임"으로 판정한다(그래서 1954·1961년 표준시 변경은 서머타임이 아니다).
3. **없는 시각·두 번 있는 시각 [확정 규칙 — 총괄실장 결정, calendar@0.1.1]**: 오류로 거부하지 않고 TC39 Temporal `disambiguation: "compatible"`(RFC 5545와 같은 규칙)으로 해석한다.
   - 겹침(서머타임 종료, 예: 1987-10-11 02:00~02:59): **앞선 순간**(전환 전 오프셋, 서머타임 쪽)으로 본다.
   - 공백(서머타임 시작, 예: 1987-05-10 02:00~02:59): **전환 전 오프셋**으로 해석한다. 결과는 공백 길이만큼 뒤의 시각이 된다(02:30 → 서머타임 03:30).
   - 두 경우 모두 warnings에 다른 해석(뒤의 순간 / 전환 후 시각)을 적는다. 이 규칙은 옵션이 아니라 엔진 공식 규칙이다(바꾸려면 총괄실장 승인 + 버전 올림). 테스트: `tests/engine/unit/time.test.ts`(1987), `tests/engine/unit/input-validation.test.ts`(1988).
4. **진태양시**(`trueSolarTime`): 지방평균태양시 = UTC + 경도×4분이다. 따라서 `solarTimeMinutes = 경도×4 − utcOffsetMinutes`(서울 126.978°E: 평상시 −32.09분, 1987년 여름 −92.09분)이고, 미적용이면 0이다. 경도는 `input.longitude`, 없으면 `options.defaultLongitude`를 쓴다.
5. **균시차**(`equationOfTime`): Spencer(1971)/NOAA 근사식을 쓴다. EoT = 229.18×(0.000075 + 0.001868cosγ − 0.032077sinγ − 0.014615cos2γ − 0.040849sin2γ), γ = 2π/연일수×(연중일−1+(UTC시−12)/24). 오차는 약 ±0.5분이다.
6. **보정 시각** = UTC + (오프셋 + solarTimeMinutes). 일주 날짜·시지·자시 판정에 쓴다.

## 만세력 [계산 명세 — `src/engine/calendar/{solarterms,pillars,lunar}.ts`]
- **절기**: lunar-javascript(寿星天文历, ΔT 반영)의 절기표를 쓴다. 라이브러리 시각은 **UTC+8**이므로 −8시간 해서 UTC로만 다룬다(검산: 2024 立春 16:27:07 CST = 08:27:07Z = 17:27 KST). 절기명은 번체 한자로 표기한다(驚蟄·穀雨·小滿·芒種·處暑). `getSolarTermsUtc(Y)`는 UTC 기준 Y년에 드는 24개를 시간순으로 돌려준다. astronomy-engine은 품질검증 전용이다.
- **연주**: 출생 UTC ≥ 그해 立春 UTC이면 그해 간지, 아니면 전년 간지. 간지 번호 = (Y−4) mod 60(1984 = 甲子).
- **월주**: 출생 UTC 직전의 12절(立春寅 … 大雪子·小寒丑)로 월지를 정한다. 절입 순간과 같으면 새 달로 본다. 월간은 五虎遁(寅월 천간 = (연간 mod 5)×2+2)으로 정한다.
- **일주**: 보정 시각(진태양시 미적용이면 법정시)의 현지 날짜를 JDN으로 바꾼다. 번호 = (JDN−11) mod 60(2000-01-01 戊午, 1900-01-01 甲戌). `dayPillarOf`는 자정 기준이며 옵션을 적용하지 않는다.
- **자시**: 보정 시각 23시 이후일 때
  - `nextDay`: 일주를 다음 날로 본다.
  - `yajasi`: 일주는 당일, 시간(時干)만 다음 날 일간으로 정한다.
  - 두 옵션의 시주는 같고, 일주만 다르다.
- **시주**: 시지는 보정 시각으로 정한다(23~01 子, 01~03 丑 …). 시간은 五鼠遁(子시 천간 = (일간 mod 5)×2)으로 정한다.
- **시각 모름**: 현지 법정시 정오를 가정해 연·월·일주와 대운수를 계산하고, 시주는 null로 둔다. 경고를 남기고, 그날(현지 0~24시)에 절입이 있으면 월주(立春이면 연주까지) 불확실 경고를 추가한다.
- **경계 경고**: 절입 ±2시간 이내, 시지 경계(보정 후 홀수 정시) ±15분 이내(야자시는 자정 ±15분도 포함)면 경고한다. 진태양시 보정으로 시지나 날짜가 바뀌면 그 사실도 적는다.
- **음력(한국 음력)**: lunar-javascript 농력은 중국 음력(UTC+8 날짜 판정)이라 쓰지 않는다. 품질검증 골든 92건 중 7건이 틀렸고, 1900~2100년 매일 비교에서 2,997일·윤달 3개 해(2012·2017·2099)가 다르다. 천문값(절기 시각, 합삭 = `ShouXingUtil.msaLonT` 정밀식 − ΔT)만 라이브러리에서 가져오고, 날짜는 **UTC+9 고정**으로 판정한다.
  - 규칙: 합삭일이 초하루, 冬至가 든 달이 11월이다. 冬至 달 사이에 13개월이 있으면 처음으로 中氣가 없는 달을 윤달로 한다.
  - 거부(EngineInputError): 그 해에 없는 윤달, 그 달 날수(29/30)를 넘는 날, 1900~2100 범위 밖.
  - 합삭이 한국시 자정 ±3분 이내인 달은 하루 차이 가능 경고를 남긴다.
- **입력 검증 [확정 규칙 — calendar@0.1.1, `chart.ts` validateInput · `lunar.ts` assertSolarDate/lunarToSolar]**: 아래를 어기면 `EngineInputError`를 던진다(호출 라우트는 400으로 처리).
  - `calendar` "solar"|"lunar", `gender` "M"|"F".
  - `time`: `null`(모름) 또는 `{ hour: 0~23 정수, minute: 0~59 정수 }`. 24:00, 60분, 소수, NaN, 문자열, 필드 누락은 거부한다.
  - 연도: 양력·음력 모두 1900~2100 정수. 음력 입력은 변환된 양력 날짜도 이 범위여야 한다(예: 음력 2100-12-02 = 양력 2101-01-01 → 거부).
  - 양력 날짜: 실제로 있는 날짜만(평년 2/29, 4/31, 13월, 0일 등 거부). 음력: 그 해에 없는 윤달, 그 달 날수(29/30) 초과, 월 1~12·일 1~30 밖은 거부.
  - `isLeapMonth`: 생략 또는 boolean(0.1.1부터 boolean이 아니면 거부 — 0.1.0은 평달로 조용히 처리했다). 양력 입력에 `true`면 거부.
  - 경도 −180~180, 시간대는 Intl 유효 IANA 이름.
  - 서머타임 겹침·공백 시각은 거부하지 않는다(위 "시간 보정" 3번 규칙으로 해석 + 경고).
  - 테스트: `tests/engine/unit/input-validation.test.ts`, `tests/engine/golden/input-errors.test.ts`.

## 운 [계산 명세 — `src/engine/calendar/luck.ts`]
- **방향**: (양간 연주 & 남) 또는 (음간 연주 & 여)이면 순행, 그 외는 역행.
- **대운수**: 출생 UTC 순간부터 다음 節(순행) 또는 직전 節(역행)까지의 실제 일수 ÷ 3을 `startAgeExact`로 둔다. `startAge`는 `luckRounding`(round 반올림 / floor 버림)을 적용한 값이다. 0이 나오면 0으로 두고 1로 올리지 않는다.
- **대운 간지**: 월주에서 60갑자 ±1씩 10개다. n번째 시작 만 나이 = startAge + 10(n−1), 시작 연도 = 출생 양력 연도 + 시작 만 나이다.
  - [학파 차이] 세는나이로 '출생 연도 + 대운수 − 1'로 적는 방식, 대운수를 월 단위까지 환산하는 방식도 있다. 이 엔진은 만 나이 기준이다.
- **세운**: `yearPillarOf(Y)`는 입춘 이후 Y년의 간지다. 세운·월운의 '올해'는 실행 시점에 호출하는 쪽이 정한다(엔진 안에 연도 고정값을 두지 않는다).

## 규칙 엔진
지장간·십성·12운성·합충형파해·공망·신살은 코드 표(table)로 구현하고 각 결과에 근거 글자 위치를 남긴다.

### analyzeRules [계산 명세 — rules@0.3.1, `src/engine/rules/`]
- 근거: `docs/knowledge/rules-spec.md`(표·공식), `docs/knowledge/strength-structure-spec.md`(P3-06 신강약·격국·용신·조후·기세), `docs/knowledge/schools.md`(학파 옵션), D-012(해석 옵션은 `RuleOptions`로 분리), D-019(세 글자 관계에 포함된 두 글자 기록은 지우지 않고 표시).
- 공개 함수: `analyzeRules(chart: CalendarResult, options?: Partial<RuleOptions>, extra?: { luck?: Pillar[]; year?: Pillar }): RuleAnalysis` (`src/engine/index.ts`에서 export). 순수 함수 — AI·DB·네트워크·현재 시각 없음. `chart.pillars`와 `chart.engineVersion`만 읽고 입력을 바꾸지 않는다.
- 타입: `src/engine/rules/types.ts`(공통 `types.ts`는 그대로). rules@0.3.0부터 `strength`·`structure`·`usefulGods`·`climate`·`qiFlow`를 같은 `RuleAnalysis`에 담는다(아래 "신강약·격국·용신·조후·기세" 절).
- 결과에 남기는 것: `engineVersion`("rules@0.3.1"), `calendarEngineVersion`, 기본값을 채운 `options` 전체, `omitted`(시주 모름이면 `["hour"]`), `source`(분석한 원국·대운·세운 글자), 판정마다 근거 위치 `Position { pillar: year|month|day|hour|daeun|seun, part: stem|branch, luckIndex? }`.
- 파일: `tables.ts`(표), `basics.ts`(오행·음양·십성), `hidden.ts`(지장간), `twelveStages.ts`, `interactions.ts`, `gongmang.ts`, `elements.ts`, `options.ts`, `version.ts`, `index.ts`. P3-06: `groups.ts`(십성 묶음·반올림 공통), `strength.ts`, `structure.ts`, `usefulGod.ts`, `climate.ts`, `qiFlow.ts`.

**옵션(`RuleOptions`) — 기본값은 연구소장 제안이며 전부 잠정(대표·연구소장 확정 대기)**

| 키 | 값 | 기본 | 비고 |
|---|---|---|---|
| hiddenStemTable | kr-monthly-30 / cn-lunarjs / main-only | kr-monthly-30 | 날수 L0 |
| branchYinYang | byMainQi / byOrder | byMainQi | 子午巳亥만 다름. 십성·음양 개수에 씀 |
| twelveStagesYin | reverse / sameAsYang | reverse | |
| earthStages | withFire / withWater | withFire | |
| strengthModel | weighted-v1 | weighted-v1 | 0.2.0에서는 오행 가중 분포에만 씀 |
| gongmangBasis | day / year / both | day | schools.md §10은 "both 저장" 언급 — 확인 필요 |
| halfCombine | withKingOnly / allPairs | withKingOnly | |
| partialPunishment | boolean | true | 두 글자 삼형을 `partial: true`로 기록 |
| wuWeiCombine | fire / earth / none | none | 午未 육합 결과 오행(none = null) |
| partialDirectional | boolean | false | **엔진 개발자 추가 키**(rules-spec §7 "두 글자 방합 ⚑, 기본 세 글자만"). 아래 설명 |
| strengthPrimary | weighted / threeFactor / rooted | weighted | P3-06. 대표 판정 모형(세 모형은 항상 모두 계산) |
| monthCommandBasis | mainQi (byDays 예약) | mainQi | `byDays`(사령)는 예약 값 → EngineInputError |
| deukjiBasis | dayBranchMainQi / dayBranchAnyRoot | dayBranchMainQi | 득지: 일지 정기 / 일지 지장간 중 하나 |
| combineAdjustment | none | none | 합화·충 보정 안 함(1차는 이 값만) |
| structureTouchul | transparentFirst / mainQiOnly | transparentFirst | 격 투출 우선(G2) / 정기 고정(G2') |
| touchulMatch | sameStem / sameElement | sameStem | 투출 일치: 같은 글자 / 같은 오행 |
| rokgeopAlternative | boolean | true | 록겁월 대체 후보(G1-alt) |
| specialStructures | candidateOnly / off | candidateOnly | 특수격 후보(확신도 low 고정) / 끔 |
| usefulGodMethods | 배열: eokbu · johuClimate · tonggwan · byeongyak · gyeokguk · special | 병약(byeongyak) 뺀 5개 | 순서 = 결과 views 순서. 모르는 값·중복·배열 아님 → EngineInputError. 빈 배열 허용 |
| favorableDefinition | generationCycle / secondCandidate | generationCycle | 희신 정의 |

- **`partialDirectional`(두 글자 방합)**: rules-spec §7은 "두 글자 방합 인정 여부 ⚑ — 기본: 세 글자만"이라고만 적었고 `schools.md` §0 옵션 목록에는 키가 없어 엔진 개발자가 이름을 붙였다(연구소장 확인 대기). `true`면 같은 방합 묶음(寅卯辰·巳午未·申酉戌·亥子丑)의 두 글자 쌍을 `type: "directionalCombine"`, `complete: false`, `partial: true`, `resultElement` = 그 방위 오행으로 기록한다. **가운데 글자가 빠진 쌍(寅辰 등)도 기록한다**(연구소장 확인 필요). 세 글자가 다 있으면 세 글자 기록(`complete: true`)과 두 글자 기록이 함께 있고, 두 글자 기록에 `subsumedBy`가 붙는다(D-019). 기본값 `false`에서는 두 글자 방합을 기록하지 않는다.

모르는 키, 지원하지 않는 값, 알 수 없는 간지 글자, 음양이 맞지 않는 간지(甲丑), 배열이 아닌 `extra.luck`은 `EngineInputError`를 던진다. 조용히 기본값으로 바꾸지 않는다. 값이 `undefined`인 키는 생략으로 본다.

**계산 규칙**
1. **지장간**(`hiddenStems`): 원국 지지마다 여기 → 중기 → 정기 순서로 `{stem, role, days, weight}`를 둔다. kr-monthly-30은 `weight = days/30`이다. cn-lunarjs는 날수가 없어 임시 비율을 쓴다(세 글자 0.6/0.3/0.1, 두 글자 0.7/0.3, 연구소장 설계값). main-only는 1이다.
   - cn-lunarjs의 역할(여기·중기)은 라이브러리에 없다. 그래서 같은 글자가 kr-monthly-30에서 맡는 역할을 붙였다(예: 丑[己,癸,辛] → 癸 여기, 辛 중기).
2. **십성**(`tenGods`): `rel = (대상오행 − 일간오행 + 5) % 5`이고, 음양이 같으면 비견·식신·편재·편관·편인, 다르면 겁재·상관·정재·정관·정인이다.
   - 대상: 원국 천간(일간 제외 — `dayMaster`에 따로 둔다), 지지(branchYinYang 기준), 원국 지장간 전부(`viaHiddenStem`=역할), 대운·세운의 천간·지지(지장간 제외).
   - 순서: 기둥(연→월→일→시→대운→세운)마다 천간 → 지지 → 지장간.
3. **12운성**(`twelveStages`): 기둥마다 일간 기준(`basis: "dayStem"`, 봉법)과 그 기둥 천간 기준(`"ownPillar"`, 좌법) 두 건을 둔다(일주는 두 건이 같다). `tableId = "twelve-stages:{twelveStagesYin}/{earthStages}"`.
   - 행 고르기: 戊·己는 earthStages에 따라 丙·丁 또는 壬·癸 행을 빌린다. 그다음 sameAsYang이면 음간이 같은 오행 양간의 행을 쓴다(己+sameAsYang+withWater = 壬 행).
   - 단계: 순행은 `(b − 장생)%12`, 역행은 `(장생 − b)%12`이다.
   - 록 표(`LU`)는 옵션과 무관하게 고정한다(신살용).
4. **관계**(`interactions`): rules-spec §6·§7 표에 있는 관계만 기록한다. 같은 쌍이 여러 관계에 해당하면 모두 기록한다(寅申 충·형, 寅亥 합·파, 寅巳 형·해, 巳申 합·형·파).
   - 거리와 상관없이 모든 쌍을 기록하고 `adjacent`를 둔다(붙은 기둥 또는 연속 세 기둥이면 true, 운이 끼면 false).
   - 합 계열은 `resultElement`를 둔다. 천간합·육합의 `transformed`는 항상 null이다(합화 판정 안 함).
   - **포함 표시(D-019, rules@0.3.0)**: 세 글자 관계(삼합·방합·삼형)가 성립해도 그 안의 두 글자 기록(반합·두 글자 방합·두 글자 삼형)을 **지우지 않는다**. 대신 `subsumedBy: string[]`에 포함한 세 글자 관계의 식별자를 모두 적는다(같은 쌍을 포함하는 세 글자 조합이 여럿이면 전부). 포함 관계가 없으면 필드가 없다. 남은 한 글자가 원국이든 운이든 같은 규칙이다(rules@0.2.0의 "남은 글자가 원국일 때만 삭제" 비대칭 규칙은 폐지). 그래서 운이 완성한 세 글자 관계도 원국 두 글자 기록에 표시를 붙인다. 거를지(예: "붙어야 작용" 설)는 해석 단계가 `subsumedBy`·`adjacent`·`scope`를 보고 정한다.
   - 관계 식별자 `interactionId(i)` = `` `${ruleId}@${위치들}` ``, 위치 = `{pillar}{luckIndex}.{part}`를 `+`로 이음. 예: `branch.threeCombine.申子辰@year.branch+month.branch+hour.branch`, 운이면 `daeun0.branch`·`seun.branch`. 같은 입력 안에서 유일하다.
   - 운: `extra.luck`의 대운은 각각 원국·세운과만 비교한다(대운끼리는 비교하지 않음). 운이 낀 관계는 `scope: "luck"`이다.
   - 정렬: 관계 종류(천간합, 천간충, 육합, 삼합, 반합, 방합, 충, 형, 파, 해) → 근거 위치 → ruleId.
5. **공망**(`gongmang`): `xunKongOf`(rules@0.1.0)를 기준 기둥(일주·연주)에 적용한다. `hits`는 기준 기둥을 뺀 원국 지지와 대운·세운 지지 중 공망 두 지지에 든 위치다. `both`면 [일주 기준, 연주 기준] 순서다. 해공은 판정하지 않는다.
6. **오행 분포**(`elements`):
   - `counts`: 천간 + 지지 본래 오행(= 정기 오행) 글자 수. 일간을 포함하고, 시주 모름이면 6글자다.
   - `weighted`: 천간 각 1.0에, 지지는 위치 가중(월지 3.0 · 일지 1.5 · 연지·시지 1.0, schools.md §8 weighted-v1)에 지장간 weight를 곱해 지장간 오행별로 나눠 더한다. 소수 6자리로 반올림한다. 일간도 1.0으로 넣는다(엔진 개발자 판단). 합충 보정은 하지 않는다.
   - `yinYang`: 천간 + 지지(branchYinYang 기준) 음양 개수.
- 버전: `RULES_ENGINE_VERSION`은 `rules/version.ts`로 옮겼다(`rules/gongmang.ts`는 re-export). 0.3.0(P3-06 + D-019)으로 올리면서 `src/lib/saju-input.ts`의 `engine_version` 문자열도 `…+rules@0.3.0`이 된다(공망 값 자체는 같다). 0.3.1은 신강약 `score` 표시 반올림 수정(Q-306-1)만 바뀐 패치다.
- 테스트: `tests/engine/unit/rules-tables.test.ts`, `rules-tengods-stages.test.ts`, `rules-interactions.test.ts`, `rules-analyze.test.ts`, P3-06은 `rules-strength.test.ts`, `rules-structure.test.ts`, `rules-usefulgod.test.ts`, `rules-p306-required.test.ts`. 엔진 개발자 자체 회귀 테스트는 `src/engine/rules/__tests__/strength-score.test.ts`(Q-306-1).
  - 12운성은 120칸 전수 + 변형 3종 + 록 표 검산.
  - 십성은 100칸 + 지지, 관계는 천간 100칸·지지 144칸 전수, 공망 hits는 60갑자 전수다.
  - 손계산 사례는 3건이다. lunar-javascript 대조는 SHI_SHEN·ZHI_HIDE_GAN·12운성 식·HE/CHONG 표로 한다.

### 신강약·격국·용신·조후·기세 [계산 명세 — rules@0.3.0 P3-06, 0.3.1 score 반올림 수정]
- 근거: `docs/knowledge/strength-structure-spec.md`(연구소장 명세). **점수·경계값·가중치·조후 지수는 모두 연구소장 설계값이며 고전 수치가 아니다.** 판정은 "이 명세 규칙의 결과"이지 명리상 정답이나 과학적 예측이 아니다. 해석 문장은 만들지 않는다.
- 공개 API 결정: 명세 §6 제안대로 `analyzeRules` 결과(`RuleAnalysis`)에 `strength`·`structure`·`usefulGods`·`climate`·`qiFlow`를 추가했다. 별도 함수(`analyzeStructure`)로 나누지 않은 이유: 호출하는 쪽이 원국·옵션을 두 번 맞출 필요가 없고, 풀이 검증기(P4-04)가 결과 하나만 대조하면 되며, 신강약이 쓰는 지장간·오행 가중·관계를 같은 옵션으로 한 번만 계산하기 위해서다.
- 범위: **원국만** 본다(운은 1차 범위 밖). 관계는 원국 내부(`scope: "natal"`)만 쓴다. 대운·세운을 넣어도 P3-06 결과는 같다.
- 수치: 가중 단위(천간 1.0 = 명세의 30u). 비율은 경계 비교 전 소수 6자리 반올림(`round6`). 출력 수치도 6자리.

**신강약(`strength`, `strength.ts`)**
1. 근거 항목(`basis`): 기둥(연→월→일→시)마다 천간 1항목 → 지장간(여기→중기→정기) 항목. `points = positionWeight × hiddenWeight × rootFactor`(6자리). 위치 가중은 weighted-v1(천간 1 · 연지·시지 1 · 월지 3 · 일지 1.5)로 `elements.weighted`와 같고 일간도 1.0으로 들어간다(`group: "self"`). 십성 묶음은 오행으로만 정한다(비겁·인성 = support).
2. 모형 A `weighted`: `ratio = round6(S/T)`, S = support 합(일간 포함), T = 전체 합(네 기둥 10.5 = 315u, 세 기둥 8.5 = 255u). 신강 r ≥ 0.55, 중화 0.45 ≤ r < 0.55, 신약 r < 0.45. `extreme` strong r ≥ 0.80 / weak r ≤ 0.20. `nearest` = 0.20·0.45·0.55·0.80 중 가장 가까운 경계(거리 6자리, 같으면 작은 경계), `nearBoundary` = 거리 < 0.03. `score` = r×100(1자리, 절반은 올림). rules@0.3.1(Q-306-1)부터 `scoreOfRatio`(`groups.ts`)가 6자리 r을 백만분율 정수로 바꿔 정수 산술로 반올림한다(0.5125 → 51.3, 0.6375 → 63.8; 이전 `round1(r*100)`은 곱셈 오차로 51.2·63.7). 판정·`extreme`·`nearest`는 r로 비교하므로 바뀌지 않는다.
   - `support`·`total`(S·T)은 반올림 전 합의 6자리 값이다(명세 타입에 없는 검산용 필드). 항목 `points`는 각각 6자리로 반올림하므로 `Σpoints`와 S·T는 최대 약 1e-5까지 다를 수 있다. r은 반올림 전 합으로 계산한다.
3. 모형 B `threeFactor`: 득령(월지 정기 오행이 비겁·인성) · 득지(`deukjiBasis`) · 득세(연간·월간·시간·연지·시지 정기 중 3자리 이상, 시주 모름이면 연간·월간·연지 중 2자리 이상). 2개 이상이면 신강, 아니면 신약. 중화 없음(`ratio`·`score`·`extreme`·`nearest` null). `basis`는 빈 배열이고 근거 위치는 `factors`에 있다.
4. 모형 C `rooted`: A와 같되 일간이 아닌 천간 중 같은 오행이 원국 지장간(여기·중기·정기 무관) 어디에도 없으면 `rootFactor` 0.5. T도 줄어든 값.
5. `agreement`: 세 모형 verdict가 모두 같으면 "all". `seasonState`: 월지 정기 오행 m과 일간 d의 왕상휴수사. `dayMasterRooted`·`dayMasterRoots`: 일간 오행이 원국 지장간에 있는 위치.
6. `groupTotals`: 모형 A 가중의 묶음별 합(일간 제외). 용신 유형 판별에 쓴다.
7. `tableSensitivity`: 선택한 표를 뺀 두 표(순서 kr → cn → main)로 모형 A. verdict나 extreme이 다르면 `tableSensitive`.
8. `hourSensitivity`: 시주를 알면 null. 모르면 오서둔 12시진(甲己일 甲子 … , 子→亥)마다 모형 A(네 기둥). `verdicts`는 신강→중화→신약 순, 둘 이상이면 `hourSensitive`.
9. `affectedBy`: 원국 관계 전부(합·충·형·파·해, D-019 포함 표시 그대로). 월지·일지·일간·돕는 천간이 members에 있으면 `critical`. `adjustmentsApplied`는 항상 `[]`(합화·충 보정 안 함).

**격국(`structure`, `structure.ts`) — 자평진전 관점, 성격·파격은 판정 안 함**
1. G1 록겁: 월지 정기 십성이 비견·겁재면 록(LU 표) = 건록격, 양간이고 양인 자리(甲卯 丙午 戊午 庚酉 壬子) = 양인격, 그 밖 = 월겁격. `rokgeopAlternative`면 월지 지장간 중 비겁이 아닌 글자가 연·월·시간에 투출했을 때 그 십성의 격을 `role: "rokgeopAlt"`, low로 더한다(정기→중기→여기 순).
   - ⚑ 명세의 G1 조건(월지 정기가 비겁)상 戊·己 일간은 午·巳월(정기 丁·丙 = 인성)에 록겁 계열이 되지 않으므로 양인 표의 戊午, 록 표의 戊巳·己午는 실제로 쓰이지 않는다(연구소장 확인 요청).
2. G2 투출 우선: 정기 → 중기 → 여기 순으로 처음 투출한 글자(일간 제외 천간, `touchulMatch`), 없으면 정기. 일간과 같은 오행 지장간은 건너뜀. G2' 정기 고정. 두 변형이 같으면 medium, 다르면 주 후보와 `otherVariant` 후보 모두 low. high는 쓰지 않는다.
3. 이름: 정관격 · 칠살격(alias 편관격) · 정재격 · 편재격 · 정인격·편인격(alias 인수격) · 식신격 · 상관격.
4. 상신·꺼리는 묶음(`sangsin`·`avoid`): 명세 §2.3 표. 묶음 중 일부 십성만이면 `tenGods`(예: 정관격 꺼림 = 식상 중 상관). `touchul` = 일간 제외 천간 위치, `hiddenOnly` = **그 오행이 지장간에 있는 지지 위치(투출 여부와 별개 — 엔진 정의)**. 건록·월겁격은 투출한 재·관·식상만 상신으로 낸다. 편인격은 인수·효신 두 관점을 모두 표시하고 notes에 남긴다.
5. `byTable`·`tableSensitive`: 세 표로 주 후보 이름을 구해 다르면 true.
6. 특수격(`kind: "special"`, 항상 low, `specialStructures="off"`면 없음): 조건 판정에는 `strengthPrimary`와 무관하게 모형 A의 r·T·groupTotals와 `elements.weighted`를 쓴다.
   - 종격 `special.jong`: F1 r ≤ 0.20 · F2 일간 무근 · F3 인성 ≤ 5%. 빼는 묶음 최대(동점 관살 > 재성 > 식상)가 40% 이상이면 종살·종재·종아, 아니면 종세(F4). F1만 맞으면 후보 없이 notes "극신약이나 종격 조건 미충족".
   - 종왕·종강 `special.jongwang`: E1 r ≥ 0.80 · E2 관살 ≤ 5%. 비겁 ≥ 인성이면 종왕, 아니면 종강.
   - 화격 `special.hwa`: H1 월간 또는 시간이 일간의 천간합 짝 · H2 월지 정기 오행 = 합화 오행 또는 그것을 생함 · H3 일간 외 천간에 합화 오행을 극하는 오행 없음 · H4 일간 오행 지장간이 여기에만 · H5 합화 오행 ≥ 40% · H6 일간 외 천간에 짝 글자가 정확히 하나이고 일간과 같은 글자가 없음(쟁합·투합 — 엔진 해석). 일간이 낀 천간충은 `obstructions`.
   - 일행득기 `special.ilhaeng`: 월지 정기 오행 = 일간 오행 · 원국 그 오행의 삼합·방합 완성(토는 辰戌丑未가 지지 세 자리 이상 — 자리 수로 셈, 엔진 해석) · E1 · E2.
   - `reversesUsefulGod`: 억부 대표 rank 1 오행이 그 특수격 관점의 반가운 오행에 없으면 true(엔진 정의). 억부 대표값은 바꾸지 않는다.

**용신(`usefulGods`, `usefulGod.ts`) — 관점별 병기(대표 결정 대기 6번), 합친 용신은 만들지 않음**
1. `views`는 `usefulGodMethods` 순서. 각 view: `candidates`(rank, `presentWeight` = `elements.weighted`, 원국에 없는 오행도 뒤로 미루지 않음), `favorable`(rank 1 기준 희·기·구·한), `basis`(ruleId·위치·값), `source`, `confidence`.
2. 억부 `eokbu`: 대표 모형 verdict와 groupTotals로 명세 §3.1 표. 신강 인성형(인성 > 비겁) 재성→식상 / 비겁형 관살→식상→재성 · 신약 최대가 관살·식상이면 인성→비겁, 재성이면 비겁→인성 · 중화는 `status: "balanced"`, `lean`(r < 0.5면 weak). `byModel`에 세 모형 결과. confidence = 세 모형 일치면 medium, 아니면 low(엔진 정의).
3. 간이 조후 `johuClimate`: `climate.needs`를 warm·dry → 화, cool·moisten → 수로 옮기고, |M| > |T|면 습도 축 먼저(같으면 온도 축). 같은 오행은 하나로. `source` = "climate-v1 (연구소장 설계, 궁통보감 표 미적용)". 궁통보감 조후용신 표(johuTable)는 쓰지 않는다(method 값도 없음).
4. 통관 `tonggwan`: X가 Y(= X+2)를 극하고 둘 다 T의 25% 이상, 작은 쪽÷큰 쪽 ≥ 0.5이면 Z = X+1. 여러 쌍이면 X 가중 큰 순. basis `ug.tonggwan.{X}>{Y}`에 비율 값.
5. 병약 `byeongyak`(기본 꺼짐): 최대 오행이 40% 이상이면 그것을 극하는 오행.
6. 격국 상신 `gyeokguk`: 정격 후보(주 → 다른 변형 → G1-alt) 순서로 상신 묶음의 오행. confidence는 rank 1을 낸 격 후보의 확신도.
7. 특수격 `special`: 종살·종재·종아·화격·일행득기 = 따르는 오행 + 그것을 생하는 오행, 종세 = 빼는 묶음 큰 순, 종왕 = 비겁→인성, 종강 = 인성→비겁(⚑ 엔진 정의 — 명세 문자대로 "생하는 오행"을 붙이면 종강에 관살이 들어감). 후보가 없으면 none, 끄면 notApplicable.
8. 희기신: generationCycle은 U 기준 희 U−1·기 U−2·구 U−3·한 U+1(오행 번호). secondCandidate는 희 = 2순위 후보, 2순위가 원래 한신이면 한신 자리에 원래 희신을 두고, 기신·구신과 겹치면 `conflicts`에 적는다(⚑ 엔진 해석, 2순위가 없으면 favorable 없음).
9. `agreement`: 각 view rank 1 오행별 관점 목록(관점 수 많은 순 → 오행 순). 억부 byModel은 넣지 않는다.
10. `singlePickProposal`: §3.8 (가) "하나만" 규칙의 계산값(제안, 대표 결정 전에는 고객 문장에 쓰지 않음). 특수격 제외 → 조후 극단(한강·열강·습강·조강)이면 조후 오행 → 아니면 억부 rank 1(balanced이거나 split + A nearBoundary면 건너뜀) → 조후 오행 → 없으면 null. 조후는 `usefulGodMethods`와 무관하게 `climate`에서 구한다.

**간이 조후(`climate`, `climate.ts`)** — 명세 §4 지지 표(온도 t, 습도 m). T = t(월지) + 0.5×Σt(그 밖 지지) + 0.5×(丙丁 수 − 壬癸 수), M = m(월지) + 0.5×Σm(그 밖) + 0.5×(壬癸 수 − 丙丁 수). 천간에 일간 포함, 시주 모름이면 세 기둥(정규화 없음, `pillarsUsed: 3`). 분류: T ≤ −2 한강, ≤ −1 한, < 1 중, < 2 난, 그 이상 열강 / M ≥ 2 습강, ≥ 1 습, > −1 중, > −2 조, 그 이하 조강. needs: T ≤ −1 warm, T ≥ 1 cool, M ≥ 1 dry, M ≤ −1 moisten. `basis`는 모든 천간·지지의 dT·dM.

**기세(`qiFlow`, `qiFlow.ts`)** — `shares` = `elements.weighted` ÷ T(6자리), `dominant`(동점은 목→수 순 앞), `concentration` = Σ비율², `missing` = 가중 0, `flowChain` = 비율 ≥ 0.10 오행의 상생 순서 최장 연쇄(다섯 다 있으면 circular, 목부터. 길이 같으면 비율 합 큰 쪽 — 엔진 정의), `dayMasterFlow`(식상 ≥ 0.10 / 식상·재성 ≥ 0.10 / 인성 ≥ 0.10), `clarityFlags`(일간 제외 천간: 관살혼잡·상관견관·효신탈식·비겁쟁재·재성파인. 재성파인의 "이웃한 기둥"은 일간 제외라 연간–월간 쌍만 해당). 청탁·진가·순역의 최종 판정은 내지 않는다.

- 시험: 명세 §7 사례 12건(A·B·C, 표·시진 민감도, 격국, 특수격, 용신, 조후, 기세)과 §7.1 필수 시험(결정성, 반올림 경계, 근거 합계, 옵션 거부, 병약 기본 꺼짐, 조후표 미사용, 통관 음성, 분포 측정 기록)을 위 테스트 파일에 넣었다. 명세 본문과 다르게 판정한 두 곳(사례 7 재성파인 표지, 사례 11 agreement 범위)은 테스트 주석에 손계산 근거를 적었다.

### 공망 [계산 명세 — rules@0.1.0, `src/engine/rules/gongmang.ts`]
- 근거: `docs/knowledge/rules-spec.md` §8.
- 60갑자 번호 i(甲子=0 … 癸亥=59)의 순두 h = i − (i mod 10), 공망 지지 번호 = (h+10) mod 12, (h+11) mod 12. rules-spec의 식 x = (b − s + 12) mod 12, {(x+10)%12, (x+11)%12}와 같다(h mod 12 = x).
- `xunKongOf(pillar)` → `{ xunHead, empty: [Branch, Branch] }`, `gongmangString(pillar)` → "寅卯"처럼 두 글자.
- `gongmangBasis` 옵션과 `hits`는 rules@0.2.0 `analyzeRules`에서 구현했다(위 5번).
- 테스트: `tests/engine/unit/gongmang.test.ts`(rules-spec 표·식, lunar-javascript `getXunKong` 60갑자 전수 대조).

### AI 입력·결과 화면 연결 [계산 명세 — `src/lib/saju-input.ts`]
- `buildSajuInput(year, month, day, hour, gender, calType, name?, isLeapMonth = false, { now? })`: `computeChart` **기본 옵션**(진태양시 서울 경도, 23시 다음 날 일주, 대운 반올림)으로 계산한다. 분은 0으로 넣는다(라우트 계약이 '시' 단위).
  - `pillars` 한자 간지, 시각 모름이면 `hour` 생략·`hour_unknown: true`.
  - `daeun` = `luck.daeun` 앞 8개(`start_age`는 **만 나이**, `start_year` = 출생 양력 연도 + start_age). 예전 lunar-javascript 값은 세는나이(1 큼)였다.
  - `gongmang` = 일주·연주 `gongmangString`.
  - `this_year` = 기준 시각(`now`, 기본 현재)의 **서울 날짜 기준 양력 연도**, `this_year_ganzhi` = `yearPillarOf(this_year)`. 1/1~입춘 전에는 실제 세운이 아직 전년 간지인데, 지금 값은 이를 구분하지 않는다(미해결 — 생성기 지시문 담당과 협의 필요).
  - `birth` = 양력(현지 법정시) "YYYY-MM-DD HH:00", 시각 모름이면 날짜만. `calendar` "양력"/"음력"/"음력(윤달)".
  - 선택 필드 `warnings`(엔진 경고), `engine_version`("calendar@x+rules@y") — 예전 저장 데이터에는 없다.
  - 입력 오류는 `EngineInputError`를 그대로 던진다.
- 결과 화면(`resolveDisplaySaju`): 저장된 `sajuInput.pillars`가 올바른 간지면 **그 글자 그대로** 한글·오행으로 바꿔 표시한다(= AI가 본 글자). 없거나 깨졌으면 새 엔진(기본 옵션, 평달 가정)으로 계산하고, 그것도 안 되면 빈 원국을 표시한다. 오행 개수는 천간 + 지지 정기 오행(rules-spec §9 counts 기준).
- 테스트: `tests/engine/unit/saju-input.test.ts`.

## 해석 규칙
연구소장이 `docs/knowledge/`에 규칙 단위로 기록 → 엔진 개발자가 구현. 고전별 관점:
- 연해자평: 기본 체계(십성·격국의 기초)
- 삼명통회: 다양한 이론·사례(신살 등)
- 적천수: 전체 기세·균형(신강약 판단)
- 자평진전: 격국과 사회적 역할
- 궁통보감: 계절·조후 용신

## 4. 버전 관리
`engineVersion`(예: `calendar@1.0.0+rules@1.0.0`)을 모든 결과에 저장. 계산 결과가 바뀌는 수정은 버전을 올리고 CHANGELOG에 기록한다.
