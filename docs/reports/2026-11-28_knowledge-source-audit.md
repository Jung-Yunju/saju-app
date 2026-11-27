# 사주풀이 엔진 지식 출처 감사 보고 (2026-11-28)

> 작성: 총괄실장. 기준: 저장소 커밋 `64898b7`(작업 브랜치 `claude/saju-platform-company-setup-3h47r3`)의 실제 소스코드·데이터 파일.
> 이 문서는 확인한 사실만 적는다. 코드·파일로 확인하지 못한 것은 **확인 불가**로 적는다.
> 확인 수준 기호(`docs/knowledge/sources.md` §0): **L2** = 고전 본문 직접 대조, **L1** = 서지·URL 존재만 확인, **L0** = 통설·기억(AI 학습 지식 포함), 출처 미확인.
> 감사 시점에 엔진 개발자가 rules@0.4.0 변경(D-022)을 작업 중이다. 이 문서는 커밋된 rules@0.3.1 기준이다.

---

## 0. 한 줄 결론

- **고전 원문은 한 글자도 확보하지 못했다.** 5대 고전 원문 대조(L2) 0건, 저장소에 고전 원문 데이터 0건.
- 계산(만세력)은 오픈소스 천문 라이브러리 + 독립 천문 라이브러리 대조로 검증했다.
- 해석 규칙(십성·합충·신강약·격국·용신·조후)의 표와 수치는 **전부 L0**(연구소장 = AI 직원의 기억·통설 + 설계값)이다.
- 현재 운영 경로(유료 풀이 생성)는 **새 규칙 엔진을 쓰지 않고, AI(LLM)에게 십성·합충·신살 판단을 맡기는 옛 코드**다. 회사 원칙("AI에게 규칙 판단을 맡기지 않는다")과 어긋난다.

---

## 1. 사주풀이에 사용한 지식의 정확한 출처

| 지식 | 실제 위치(파일·함수) | 출처 | 확인 수준 |
|---|---|---|---|
| 절기 시각 | `src/engine/calendar/solarterms.ts` `termsOfYear()`, `libSolarToUtcMs()` | 오픈소스 `lunar-javascript` 1.7.8(6tail, MIT)의 寿星天文历 알고리즘. 라이브러리 값(UTC+8)을 UTC로 변환 | 코드 확인. 독립 검증은 §4 |
| 한국 음력·윤달 | `src/engine/calendar/lunar.ts` `newMoonUtcMs()`, `leapMonthOf()`, `lunarToSolar()`, `solarToLunar()` | 라이브러리의 합삭·중기 **천문 시각만** 쓰고, 날짜 판정은 한국 표준시(UTC+9)로 직접 구성(D-011). 라이브러리 농력(중국 음력)은 쓰지 않음 | 코드 확인 |
| 표준시·서머타임 이력 | `src/engine/calendar/time.ts` `zoneOffsetMs()`, `localToUtc()` | Node 내장 `Intl`(ICU의 IANA tzdb). 오프셋 하드코딩 없음 | 코드 확인. tzdb 버전은 실행 환경에 의존 |
| 진태양시(경도) 보정 | `time.ts` `solarTimeCorrectionMinutes()` | 경도×4분 − 표준시 오프셋. 기본 켜짐(`DEFAULT_OPTIONS.trueSolarTime: true`, 기본 경도 126.978 = 서울) | 코드 확인 |
| 균시차 | `time.ts` `equationOfTimeMinutes()` | Spencer(1971) 근사식, NOAA 계산식과 같은 식(코드 주석에 출처 명시). **기본 꺼짐**(`equationOfTime: false`) | 코드 확인, 식의 원문 대조는 확인 불가 |
| 원국 4기둥 | `src/engine/calendar/pillars.ts` `monthPillarAt()`, `dayPillarOfDate()`, `hourPillarOf()` | 60갑자 산술(오호둔·오서둔) | 코드 확인 |
| 대운 | `src/engine/calendar/luck.ts` `luckDirection()`, `computeLuck()` | 순역(연간 음양×성별), 절입까지 일수÷3 = 년 | 코드 확인. 규칙 자체는 L0 |
| 십성·지장간·12운성·합충형파해·공망 표 | `src/engine/rules/tables.ts`, `basics.ts` `tenGodOf()`, `hidden.ts`, `twelveStages.ts`, `interactions.ts`, `gongmang.ts` | 연구소장 명세 `docs/knowledge/rules-spec.md`를 옮김. 파일 주석: "수치는 L0(교재 통용 표, 고전 원문 대조 전) — 잠정" | **L0** |
| 지장간 비율 | `options.ts` 기본 `hiddenStemTable: "kr-monthly-30"` | 주석: "잠정: 수치 L0". 대안 `cn-lunarjs`는 lunar-javascript 표 | L0 |
| 신강약·격국·용신·조후·기세 | `strength.ts`, `structure.ts`, `usefulGod.ts`, `climate.ts`, `qiFlow.ts` | 연구소장 명세 `docs/knowledge/strength-structure-spec.md`. 수치 기준은 파일 주석에 "연구소장 설계값(근거 미확보)" | **L0 + 설계값** |
| 풀이 문장(유료) | 운영: `src/lib/generate-reading-v2.ts` / 새 구조(미연결): `src/engine/content/prompts/**` | Anthropic Claude가 생성. 해석 지식은 모델의 학습 지식 | AI 학습 지식(L0) |
| 무료 결과 문안 | `content/free/*.json` 6개 | 콘텐츠 작가(AI 직원) 작성. 십성 표기는 품질검증이 규칙 엔진과 전수 대조(불일치 0, `tests/content-qa/free-tengods.test.ts`) | 문장 = AI 작성, 십성 값 = 엔진 일치 |
| 인생 단계 개인화 | `src/engine/personalize/life-stage.ts`, 문서 `docs/knowledge/personalization/life-stages.md` | 개인화 연구원(AI 직원) 설계 | L0 |
| 고전 지식 항목 | `docs/knowledge/entries/tengods.yaml`, `johu-outline.yaml` | `source_status: unverified` 14건, `original_text`는 전부 null. 조후표는 `filled_cells: 0 / 120`(뼈대만) | **런타임 코드에서 읽지 않음**(grep 결과 0건) |

## 2. 참고한 명리학 고전의 명칭·판본·원문·출처

`docs/knowledge/sources.md`(서지 대장)에 적힌 내용이 전부다.

| 고전 | 판본 기록 | 원문 확보 | 확인 수준 |
|---|---|---|---|
| 연해자평(淵海子平) | 『新刊合併官板音義評註淵海子平』(명 楊淙 增校), 『淵海子平大全』(송 徐升 撰, 명 李欽 增補). 도호쿠대·일본 국회도서관 목록 | 위키문헌 URL 존재만 확인(미완성 문서 표시), 본문 미열람 | L1 |
| 삼명통회(三命通會) | 명 萬民英. 사고전서 자부 술수류(상해고적 1987 영인 문연각본 제810책), 대만 국가도서관 만력 6년(1578)본 | ANU 디지털 컬렉션 URL 존재만 확인 | L1 |
| 적천수(滴天髓) | 『滴天髓輯要』(陳之遴 輯), 『滴天髓闡微』(任鐵樵 증주) | 위키문헌 URL 존재만 확인 | L1/L0 |
| 자평진전(子平眞詮) | 청 沈孝瞻(저자명 L0), 서락오 평주본 | 공유저작물 원문 확보처 **미확인** | L0 |
| 궁통보감(窮通寶鑑) | 일본 국회도서관 『窮通寶鑑欄江綱』(淸 余春臺 輯) | 원문 확보처 **미확인** | L1(서지)·L0 |

- **원문 본문을 직접 열어 대조한 고전: 0건.** 사유: 이 클라우드 세션 네트워크에서 `ctext.org`, `zh.wikisource.org`, `koreascience.or.kr`가 차단되어 있다(`sources.md` "이번 조사의 제약"). 접속 허용은 대표 결정 대기(결정 문서 D6).
- 코드 주석·문서에 고전 문장을 "원문"으로 인용한 곳: 확인한 범위에서 없음. 새 프롬프트는 고전 인용을 금지한다(`src/engine/content/prompts/system.ts` §8 "고전 인용 금지").
- 따라서 "5대 고전 기반"이라고 광고할 근거가 **현재 없다**.

## 3. 실제 확보한 고전 데이터 vs AI 자체 학습 지식

| 구분 | 내용 | 근거 |
|---|---|---|
| 확보한 고전 원문 데이터 | **0건** | `docs/knowledge/entries/*.yaml`의 `original_text` 전부 null, `source_status: verified` 0건(문서 설명문 3곳에만 단어로 등장) |
| 확보한 서지 정보 | 도서관 목록·저장소 URL(L1) 십여 건 | `docs/knowledge/sources.md` "출처 URL" |
| 독립 데이터로 확인된 것 | 절기·합삭(천문 계산), 표준시 이력(tzdb), 한국 설날·추석·윤달 기대값 92건 | §4 |
| AI 학습 지식(L0)에 의존하는 것 | 십성·지장간·12운성·합충 표, 신강약·격국·용신·조후 규칙과 수치, 학파 차이 설명, 모든 풀이 문장, 무료 문안, 인생 단계 해석 | `tables.ts` 주석 "L0", `strength.ts`·`usefulGod.ts`·`climate.ts` 주석 "연구소장 설계값", 연구소장 감수 문서의 "근거 출처: L0" |
| 운영 중 AI가 직접 판단하는 것 | 십성·합충형·신살 선택 | `src/lib/generate-reading-v2.ts` 시스템 프롬프트: "십성·합·충·형은 네가 뽑는다" |

- 십성처럼 정의가 단순한 표는 품질검증의 독립 오라클(`tests/engine/qa-rules/oracle.ts`, 명세만 보고 별도 구현)과 4,000건 이상 대조해 **엔진이 명세대로 동작함**을 확인했다. 단, 이것은 "명세 = 코드" 확인이지 "명세 = 고전" 확인이 아니다.

## 4. 만세력 계산 라이브러리와 정확성 검증 방법

**라이브러리**
- 제품 엔진: `lunar-javascript` 1.7.8 (`node_modules/lunar-javascript/package.json`: license MIT, github 6tail/lunar-javascript). 래퍼 `src/engine/calendar/lunar-lib.ts`.
- 검증 전용(개발 의존성): `astronomy-engine` 2.1.19 (MIT). 제품 엔진은 쓰지 않고 테스트만 쓴다.
- 엔진 버전 상수: `CALENDAR_ENGINE_VERSION = "calendar@0.1.1"`(`constants.ts`), 지원 연도 1900~2100.

**검증(테스트 파일과 방법)**

| 대상 | 테스트 | 방법 | 기준 |
|---|---|---|---|
| 절기 시각 | `tests/engine/golden/solar-terms.test.ts` | astronomy-engine `SearchSunLongitude`와 비교. 1900~2100 매 5년(41개) + 무작위 20개 연도 × 24절기 | 허용 오차 2분 |
| 한국 음력·윤달 | `tests/engine/golden/lunar.test.ts`, 데이터 `lunar-golden.json` | 92건(설날 32·추석 31·윤달 22·기타 7). 기대값은 astronomy-engine 기반 생성(합삭·중기 UTC+9 날짜, 무중치윤) | 출처 표기: 정부·천문연 자료 웹검색 인용 22건, 2차 자료(언론·위키) 13건, **외부 확인 없음 57건** |
| 일주·시주 | `day-hour-pillar.test.ts`, 오라클 `tests/engine/golden/oracle.ts` | 공개 JDN 공식과 오호둔·오서둔을 엔진 코드 없이 따로 구현해 대조 | — |
| 표준시 이력·서머타임 | `timezone-history.test.ts`, `dst-ambiguity.test.ts` | Intl tzdb 기준 | — |
| 진태양시·자시 | `true-solar-zi.test.ts` | 경도 보정·자시 경계 | — |
| 연·월 경계(입춘·절입) | `year-month-boundary.test.ts` | 절입 시각 전후 | — |
| 결정성 | `determinism.test.ts` | 같은 입력 = 같은 출력 | — |

- 한국천문연구원(KASI) 원자료와 직접 대조한 것: 코드 주석의 **2024 입춘 1건**(`solarterms.ts` 주석 "역서 2024 입춘 17시 27분과 일치")뿐이다. KASI 원문 페이지는 네트워크 차단으로 열지 못했다. → 전수 공식 대조는 **확인 불가**.
- 알려진 결함: 서머타임 시기에 "시진만 선택"하면 일부 지역에서 시지가 한 칸 앞으로 계산됨(품질검증 U-03 D1, `src/lib/saju-input.ts` 대표 시각 계산). 대표 결정 대기.
- 기본 학파 설정(`src/engine/types.ts` `DEFAULT_OPTIONS`): `ziHour: "nextDay"`(밤 11시 이후 다음 날 일주, D-013 잠정), `trueSolarTime: true`, `equationOfTime: false`, `luckRounding: "round"`.

## 5. 격국·용신·신강약·조후 판단 알고리즘 (rules@0.3.1, 코드 확인)

**신강·신약** — `src/engine/rules/strength.ts` `analyzeStrength()`
- 모형 A `weighted`(기본): 위치 가중 비율 r = 일간 편 세력 ÷ 전체. 가중치는 `elements.ts` 주석 "weighted-v1(월지 3.0 · 일지 1.5 · 연지·시지 1.0 · 천간 1.0) — 연구소장 설계값이며 고전 수치가 아니다". 경계 0.45/0.55(중화 구간), 극단 0.20/0.80, 경계 근접 폭 0.03 — **모두 설계값**.
- 모형 B `threeFactor`: 득령·득지·득세 중 2개 이상이면 신강.
- 모형 C `rooted`: A와 같고 무근 천간 가중 0.5배(설계값).
- 합화·충 보정 없음(표시만), 12운성은 점수에 넣지 않음.
- 품질검증 분포 1만 건: 신강 28.1%·중화 23.8%·신약 48.1%, 지장간 표만 바꿔도 판정이 바뀌는 비율 47.2%(`docs/TEST_REPORT.md`). → **표 선택에 매우 민감**하다.

**격국** — `src/engine/rules/structure.ts` `regularStructures()`(정격 G1~G5), `specialStructures()`(특수격 후보)
- 파일 주석: "자평진전 관점 정격 판정 … 표는 연구소장 명세의 요지(L0)를 옮긴 것이다. 성격·파격은 판정하지 않는다. 특수격은 항상 confidence "low"".
- 월지 정기 기준 진입(`monthCommandBasis: "mainQi"`), 투출 우선(`structureTouchul: "transparentFirst"`).

**용신** — `src/engine/rules/usefulGod.ts` `analyzeUsefulGods()`, `eokbuOf()`
- 관점별로 따로 낸다: 억부(eokbu), 간이 조후(johuClimate), 통관(tonggwan), 격국 상신(gyeokguk), 특수격(special). 병약(byeongyak)은 기본 꺼짐. **하나로 합친 '진짜 용신'은 만들지 않는다**(주석: 대표 결정 대기 6번).
- 기준값 25%·0.5·40%는 주석에 "연구소장 설계값".
- **궁통보감 조후용신 표는 쓰지 않는다**(주석: "칸 0/120").

**조후** — `src/engine/rules/climate.ts` `analyzeClimate()`
- 지지별 [온도, 습도] 기본값 + 천간 丙丁/壬癸 가감으로 T·M 점수 계산 후 한·난·조·습 분류.
- 주석: "궁통보감 조후표가 아니다. 지지 기본값·계수·분류 경계는 모두 연구소장 설계값(근거 미확보)".

**기세** — `src/engine/rules/qiFlow.ts`: 상생 연쇄(비율 ≥ 0.10), 청탁 표지. 최종 청탁·진가 판정은 내지 않음.

**검증**: 품질검증 독립 오라클(`tests/engine/qa-rules/strength-oracle.ts`, `p306-*.test.ts`) — 무작위 2,000 + 합성 2,000 + 옵션 변형, 불일치 0. 명세 사례 12건 3자 일치. **이것은 코드가 명세대로인지의 검증이며, 명세가 고전·실제 상담 결과와 맞는지는 검증하지 않았다.**

**중요 — 실제 서비스 사용 여부**: `analyzeRules()`(`src/engine/rules/index.ts`)를 호출하는 곳은 `src/engine/verify/index.ts`(검증기)뿐이다. **화면·API(`src/app/**`, `src/lib/**`)는 규칙 엔진을 호출하지 않는다.** 즉 위 알고리즘은 구현·검증됐지만 운영 풀이에는 아직 쓰이지 않는다.

## 6. 대운·세운·월운·재물·직업·배우자·자녀운의 해석 근거

| 항목 | 계산(코드) | 해석 근거 |
|---|---|---|
| 대운 | `luck.ts` `computeLuck()`: 순역, 절입까지 일수÷3, 월주에서 ±1씩 10개 | 해석 문장은 AI. 새 구조 장 `daeun-now`(`prompts/chapters/basic.ts`)가 사실표 글자만 쓰도록 지시 |
| 세운 | 연 간지 산술(`yearPillarOf`, 입춘 기준) + 원국과의 합충(`interactions.ts`) | 무료: `content/free/this-year.json`(2026·2027만, AI 작성, 십성 엔진 일치 확인). 유료: AI 생성 |
| 월운 | **구현 안 됨.** 엔진·사실표에 월운 없음 | 프롬프트가 "달마다의 이야기는 하지 않는다(월운은 사실표에 없다)"로 금지(`basic.ts:183`, `free.ts:69`). `products.ts:60` "월운 사실이 계약에 없어 달별 장을 만들지 못했다" |
| 재물운 | 전용 계산 없음. 재성 묶음 개수 등 일반 사실만 | 장 `money`, `money-deep` 프롬프트(AI 서술) |
| 직업운 | 전용 계산 없음 | 장 `talent`, `career-deep` 프롬프트(AI 서술) |
| 배우자운 | 전용 계산 없음 | 장 `people`, `love-deep` 프롬프트(AI 서술). 성별로 육친 의미를 바꾸지 않는 방침(결정 문서 D3 추천, 미확정) |
| 자녀운 | **전용 계산·장 없음** | 설문 `personalize/survey.ts`의 "자녀가 있으세요?" 답이 있을 때만 이야기를 꺼내라는 지시. 시스템 프롬프트가 자녀 등 사용자가 말하지 않은 경험을 지어내지 말라고 금지(`system.ts:90`) |
| 신살 | **규칙 엔진에 없음**(록 표만 `tables.ts:133` "신살 단계용"으로 예약) | 운영 v2는 AI가 신살을 고름(`generate-reading-v2.ts` 프롬프트) |

→ 재물·직업·배우자·자녀운은 **전용 규칙 없이 AI가 일반 사실(십성·오행·대운 글자)을 보고 서술**한다. 그 서술 방식의 근거는 AI 학습 지식(L0)이다.

## 7. 서로 다른 이론이 충돌할 때의 판단 기준

- 원칙: 학파 차이는 **옵션으로 분리**하고 기본값을 정해 둔다. 역법 옵션(`EngineOptions`)과 해석 옵션(`RuleOptions`)을 나눔(D-012).
- 기본값 위치와 근거: `src/engine/rules/options.ts` `DEFAULT_RULE_OPTIONS` — 파일 머리 주석 "기본값은 연구소장 제안이며 **전부 잠정** — 대표·연구소장 확정 대기". 주요 값:
  - 지장간 `kr-monthly-30`(L0), 지지 음양 `byMainQi`(L0), 12운성 음간 `reverse`·토 `withFire`(화토동법), 신강약 `weighted-v1`(설계값), 공망 `day`, 반합 `withKingOnly`, 특수격 `candidateOnly`, 용신 관점 5개 병기.
- 학파 비교 문서: `docs/knowledge/schools.md`(자시·진태양시·대운수·지장간·12운성·신강약·용신·공망 등 12개 절).
- 충돌을 숨기지 않는 장치: 두 글자 관계를 지우지 않고 `subsumedBy` 표시(D-019), 표 민감도 `tableSensitive`, 경계 근접 `nearBoundary`, 용신 관점별 병기.
- 최종 확정 주체: 대표 결정 대기(결정 문서 D1~D6). **현재 확정된 학파 기준은 없다.**

## 8. 외부 API·데이터 사용 여부 (코드 확인)

| 외부 서비스 | 위치 | 보내는 데이터 |
|---|---|---|
| Anthropic Claude API | 운영: `src/lib/generate-reading-v2.ts`(모델 `claude-sonnet-4-6`). 새 구조(미연결): `src/engine/content/generate.ts`, 기본 모델 `claude-opus-5-5`(`cost.ts`) | 운영 v2: 이름(호칭), 성별, 양력 생년월일시, 원국·대운·공망·올해 간지(`SajuInputData`). 출생지는 `src/app/api/reading/_lib/ai-input.ts`에서 제거 |
| 토스페이먼츠 | `src/app/api/payment/confirm/route.ts` (`https://api.tosspayments.com/v1/payments`) | 결제 승인 정보 |
| Google OAuth(NextAuth v5) | 로그인 | 로그인 정보 |
| Neon PostgreSQL(Prisma) | DB | 회원·주문·풀이 저장 |
| Google Fonts | `src/app/free/og/route.tsx`(공유 이미지 생성 시 글꼴 조각 요청), 인트로 시안 HTML | 이미지에 쓰는 글자, 방문자 IP(브라우저 요청 시) |
| 만세력 외부 API | **사용 안 함** — 계산은 전부 로컬 코드 | — |
| 고전 원문 데이터 | **사용 안 함**(확보 0건) | — |

- 무료 결과(`/api/free`)는 AI·DB·로그인 없이 엔진 계산만 한다(`route.ts` 주석, 품질검증 정적 검사로 강제).
- 개인정보 관점 지적: 운영 v2는 AI에 **생년월일시와 이름**을 보낸다. 풀이 서술에 원국 글자가 이미 있으므로 생년월일시 원문 전송이 꼭 필요한지 재검토가 필요하다(규칙 14 "불필요한 전송 금지").

## 9. 저작권·상업적 이용 가능 여부

| 대상 | 확인한 것 | 판단 |
|---|---|---|
| lunar-javascript 1.7.8 | `package.json` license **MIT** | 상업 이용 가능(저작권 고지 유지 조건). 고지 파일 포함 여부는 배포 단계에서 확인 필요 |
| astronomy-engine 2.1.19 | **MIT** | 테스트 전용, 배포물에 포함 안 됨 |
| @anthropic-ai/sdk 1.8.0 | **Apache-2.0** | 상업 이용 가능 |
| 토스 SDK 2.10.0 / next-auth | MIT / ISC | 상업 이용 가능 |
| 고전 원문 | 저장소에 없음 | 해당 없음. 연구소장 의견(`sources.md` §7): 원문은 공유저작물로 보나 현대 교감본·민국 시대 주석(서락오 등)·현대 번역은 권리 문제 → **법무 확인 전 사용 금지** |
| 명리 표(십성·지장간 등) | 연구소장이 "교재 통용 표"를 기억으로 옮김(L0) | 특정 교재를 복제했는지 **확인 불가**. 일반적 사실·규칙은 보호 대상이 아닐 가능성이 크나 **법무 확인 필요** |
| AI가 쓴 문장(프롬프트·무료 문안·SEO 원고) | 저장소에 있음 | 상업 이용 조건은 대표 계정의 Anthropic 이용 약관에 따름 — 코드로 **확인 불가** |
| 글꼴(고운바탕·고운돋움·Noto Serif KR) | Google Fonts에서 불러옴 | 라이선스 파일이 저장소에 없음 → **확인 불가**(배포 전 확인) |
| 경쟁사 화면 캡처 | 저장소에 올리지 않음(`benchmark-halmakase.md` 머리말) | — |
| 참고 앱·블로그 | `sources.md`에 URL만 기록, 문장 미전재 | — |

## 10. 실제 구현된 기능 / 구현되지 않은 기능

**A. 구현됨 + 운영 경로에서 사용 중**
- 만세력 계산 `computeChart()`(calendar@0.1.1): `src/lib/saju-input.ts`를 통해 `/api/free`, `/api/reading/direct`, 결제 준비·승인 API가 사용.
- 무료 결과 화면 `/free`(엔진 계산 + 정적 문안, AI 없음).
- 유료 풀이 생성 v2 `src/lib/generate-reading-v2.ts` `generateFullReading()`, `generateClaims()`(API `/api/reading/[id]/generate`, `/claims`, `/verify`) — **AI가 십성·합충·신살을 판단하는 옛 구조**.
- 공망 계산 `gongmangString()`(saju-input이 사용).

**B. 구현됨 + 테스트 통과 + 운영 경로에 연결 안 됨**
- 규칙 엔진 `analyzeRules()`(rules@0.3.1): 지장간·십성·12운성·합충형파해(D-019)·공망·오행 분포·신강약 3모형·격국·관점별 용신·간이 조후·기세. 독립 오라클 검증 조건부 통과.
- 콘텐츠 엔진 `src/engine/content/`: 사실표(`facts.ts`, facts@0.2.0), 19개 장 프롬프트(prompts@0.1.1), `generateChapters()`(위기 사전 감지 포함). 실제 AI로 생성해 본 견본 **0편**(대표 지시로 보류).
- 개인화 `src/engine/personalize/`(설문·인생 단계).
- 풀이 검증기 `src/engine/verify/`(verify@0.2.0) — **2차 블라인드 검토 불합격**(새 문장 우회 60/60 미탐, 정상 오탐 20/36). verify@0.3.0 재설계 진행 중.
- 채점 도구 `scripts/qa/rubric/`(실제 견본으로 미실행).

**C. 구현 안 됨**
- 고전 원문 데이터·원문 대조(0건), 궁통보감 조후용신 표(0/120칸).
- 월운, 자녀운 전용 해석, 신살 계산, 합화(化) 판정, 성격·파격 판정, 청탁·진가 최종 판정.
- 상품: 궁합(COMPAT), 현재 고민(CONCERN), BULLY·CONFLICT — `products.ts`에서 `supported: false`.
- 새 구조(규칙 엔진 → 사실표 → 콘텐츠 엔진 → 검증기)를 운영 API에 연결하는 일.
- 학파 기본값 확정(전부 잠정), 사람 검토 등 2층 안전장치(대표 결정 대기).
- DB 마이그레이션 `20261127090000_reading_v3_safety` 적용(준비만 됨, 미적용).

**D. 남아 있으나 쓰지 않는 옛 코드**(규칙상 삭제하지 않음)
- `src/lib/saju.ts`(lunar-javascript 농력으로 음력 변환 — 중국 음력 문제가 있는 방식), `src/lib/generate-reading.ts` — 다른 파일에서 import 0건.

---

## 대표에게 드리는 판단 (총괄실장)
1. **"고전 기반"이라고 말할 수 없는 상태다.** 지금 정확하다고 말할 수 있는 것은 만세력 계산(독립 천문 라이브러리 대조)과 "코드가 연구소장 명세대로 동작한다"는 것까지다.
2. **운영 풀이는 AI가 규칙을 판단하는 옛 구조**라 회사 원칙과 어긋난다. 새 구조(규칙 엔진 + 사실표)를 연결하기 전까지는 유료 판매 품질을 보증할 수 없다.
3. 개선에 필요한 대표 결정: ① 고전 원문 사이트 접속 허용(무료) ② 학파 기본값 확정 ③ 견본 생성(API) 재개 시점 ④ 운영 v2의 생년월일 원문 AI 전송 축소 ⑤ 법무 확인(교감본·주석·글꼴·AI 생성물).
