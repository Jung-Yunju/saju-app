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

### 공망 [계산 명세 — rules@0.1.0, `src/engine/rules/gongmang.ts`]
- 근거: `docs/knowledge/rules-spec.md` §8.
- 60갑자 번호 i(甲子=0 … 癸亥=59)의 순두 h = i − (i mod 10), 공망 지지 번호 = (h+10) mod 12, (h+11) mod 12. rules-spec의 식 x = (b − s + 12) mod 12, {(x+10)%12, (x+11)%12}와 같다(h mod 12 = x).
- `xunKongOf(pillar)` → `{ xunHead, empty: [Branch, Branch] }`, `gongmangString(pillar)` → "寅卯"처럼 두 글자.
- 아직 구현하지 않은 것: rules-spec §8의 `gongmangBasis` 옵션과 `hits`(원국·대운·세운 지지 중 공망에 든 위치) — `RuleAnalysis` 작업 때 구현한다.
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
