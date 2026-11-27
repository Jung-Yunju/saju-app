# 콘텐츠 엔진 장(章) 구성 [제안]

> 관리: 콘텐츠 작가·캐릭터 기획자 · 최초 작성 2026-11-27 · 카드 P4-03(장별 프롬프트)
> 코드: `src/engine/content/prompts/` · 계약: `src/engine/content/types.ts`(총괄실장) · 테스트: `tests/content/prompts.test.ts`
> 말투·금지 규칙은 [voice-guide.md](voice-guide.md), 캐릭터는 [characters.md](characters.md), 메뉴 이름은 [menu-names.md](menu-names.md), 상품은 [../business/product-proposal.md](../business/product-proposal.md).
> 상품 목록·메뉴 이름·할머니 이름·캐릭터 사연은 모두 대표 결정 대기다. 이 문서의 구성도 그에 따라 바뀔 수 있다.

## 0. 한눈에
- 장은 19개: 무료 4 · 유료 기본 8 · 상품 특화 7.
- 장마다 `build(facts)`가 `{system, user}`를 만든다. **system은 풀이 하나 안에서 모든 장이 같다**(프롬프트 캐시 재사용). 장마다 다른 것은 user 메시지뿐이다.
- user 메시지의 `<사실표>`는 장에 필요한 조각만 넣는다(`factParts`). 사실표를 통째로 넣지 않는다.
- AI는 사실표를 **옮겨 적고 풀어 쓰기만** 한다. 십성·합충·공망·신강약을 새로 뽑지 않는다(CLAUDE.md 3절, voice-guide §1).
- 고정 문구 두 개는 AI가 쓰지 않고 파이프라인이 붙인다: 마지막 말(`LAST_WORDS`), "검증된 예측이 아니다" 안내(`RELIABILITY_NOTICE`).

## 1. 상품별 구성표

상품 코드는 현행 DB `ReadingType`(BASIC·MONEY·LOVE·CAREER·BULLY·CONFLICT)과 이름을 맞추고, 제안서의 확장 5종에 새 코드를 붙였다(`products.ts`).

| 코드 | 상품(제안서) | 메뉴 이름(★안) | 장 구성(화면 순서) | 출력 상한 합 |
|---|---|---|---|---|
| FREE | 무료 요약 | 생김새 한 장 · 올해 한 줄 | free-nature → free-elements → free-year → free-preview | 3,400 |
| BASIC | 나는 어떤 사람인가 | 타고난 옷감 | nature → talent → money → people → daeun-now → year-ahead → crossroads → closing | 13,000 |
| MONEY | 왜 돈이 안 모일까 | 곳간 셈 | nature → **money-deep** → daeun-now → year-ahead → crossroads → closing | 10,900 |
| LOVE | 왜 연애가 안 될까 | 곁자리 이야기 | nature → **love-deep** → daeun-now → year-ahead → crossroads → closing | 10,900 |
| CAREER | 왜 직장이 안 맞을까 | 네 손이 잘하는 일 | nature → talent → **career-deep** → daeun-now → year-ahead → crossroads → closing | 12,400 |
| LIFE | 인생 총괄 | 네 인생 한 두루마리 | 기본 8장 + **life-past**(사람 장 뒤) + **life-ahead**(지금 대운 뒤) | 17,000 |
| DECADE | 향후 10년 | 앞으로 열 해 날씨 | nature → **decade-weather** → **decade-pack** → year-ahead → crossroads → closing | 10,900 |
| YEAR | 올해(신년) 운세 | 한 해 옷 고쳐 입기 | nature → daeun-now → year-ahead → crossroads → closing (임시) | 8,700 |
| BULLY | 이 사람은 왜 나를 괴롭힐까 | — | **보류**(상대방 사실표 필요) | — |
| CONFLICT | 우리는 왜 맨날 싸울까 | — | **보류**(상대방 사실표 필요) | — |
| COMPAT | 궁합(2인) | 둘이 한 상에 앉으면 | **보류**(두 사람 사실표 + 두 사람 사이 관계 필요) | — |
| CONCERN | 현재 고민 | 갈림길 앞에서 | **보류**(고민 자유 서술 도입이 대표 결정 대기) | — |

- 묶음(3개 묶음·올패스)은 상품 코드의 조합이다. `chaptersForProducts([...])`가 장을 합치고 같은 장(예: nature)은 한 번만 만든다.
- 주제형 상품은 기본 장 중 주제와 겹치는 장을 특화 장으로 **바꿔 끼웠다**(LOVE는 people 대신 love-deep, MONEY는 money 대신 money-deep). 같은 일지·재성 이야기가 두 장에서 되풀이되지 않게 하려는 것이다. CAREER는 talent(재주)와 career-deep(일터·움직임)이 다루는 것이 달라 둘 다 둔다.
- YEAR는 월운(달마다의 간지) 사실이 계약에 없어 달별 장을 만들지 못한 임시 구성이다.

## 2. 장 목록

표의 "사실표 조각"은 user 메시지에 들어가는 조각이다(이름은 `chapter.ts`의 `FactPart`). 모든 장에 `subject`(호칭·만 나이·인생 단계·시 앎/모름·올해 연도), `warnings`, `guards`가 들어간다 — 표에서는 생략했다.

### 2-1. 무료 (작은 모델 전제, 짧게)

| id | 제목 | 상한 | 사실표 조각 | 사용자 사실 | 출력 칸 | 말버릇 |
|---|---|---|---|---|---|---|
| free-nature | 생김새 한 장 | 800 | dayPillar, natalTenGods(일주 위치만) | mbti, concernTopic | title, chips(1~2), body[겉, 속], todo, ask, caveat | 어디 보자 |
| free-elements | 첫 치수 — 오행 균형 | 800 | pillars, elements | — | title, chips(1~3), body[넘침, 모자람], todo, caveat | 치수부터 재자 |
| free-year | 올해 한 줄 | 800 | dayPillar, natalTenGods(지장간 뺌), thisYear, seunInteractions, noGuessYears | horizon, concernTopic | title, chips, line, body[1], open, reduce, todo, caveat | 날씨 얘기다 |
| free-preview | 펼치기 전에 — 풀이 미리보기 | 1,000 | pillars, natalTenGods, natalInteractions, elements, daeunNow, thisYear | — | title, intro, toc[8: chapter_id, text], body[첫 장 맛보기], caveat | 어디 보자 |

톤 메모: 무료는 신뢰를 쌓는 자리다. 결제·가격·할인·"더 알고 싶으면" 권유 문장을 AI가 쓰지 않는다(화면 몫). 미리보기는 목차와 첫 문단만 보여 주고, 일부러 불길하게 끊지 않는다(제안서 §1). 오행 장에서 "모자란 오행 = 용신"으로 단정하지 않고, 색·물건으로 채우라고 하지 않는다.

### 2-2. 유료 기본 8장

| id | 제목 | 상한 | 사실표 조각 | 사용자 사실 | 출력 칸 | 말버릇 |
|---|---|---|---|---|---|---|
| nature | 타고난 옷감 — 본질·성향 | 1,800 | pillars, natalTenGods, natalInteractions, gongmang, elements, strength | mbti, birthOrder, concernTopic | title, sub, chips(2~4), body[겉, 속, 여는 것, 굳는 데와 쓰는 법], todo, ask, caveat | 어디 보자 / 글자는 생김새다. 쓰는 건 너다 |
| talent | 네 손이 잘하는 일 — 재능·직업 | 1,500 | pillars, natalTenGods, natalInteractions, elements, strength | occupationStatus, careerFeeling, concernTopic | …, body[3], fits[{place, text}], … | — |
| money | 돈 드나드는 문 — 돈의 흐름 | 1,400 | pillars, natalTenGods, natalInteractions, elements | occupationStatus, moneyFocus, hasChildren | …, body[3], habits{earn, keep, leak}, … | 그건 할미도 모른다(거절할 때만) |
| people | 곁자리와 사람 — 사람·인연 | 1,400 | pillars, natalTenGods, natalInteractions, gongmang | relationshipStatus, birthOrder, hasChildren, concernTopic | …, body[3~4], … | — |
| daeun-now | 지금 입은 열 해 — 지금 대운 | 1,600 | pillars, natalTenGods(지장간 뺌), daeunNow, daeunInteractions, noGuessYears | horizon, occupationStatus, careerFeeling, relationshipStatus, life_event:* | …, body[2], faces{best, half, worst}, next{ganzhi, start_age, start_year, text}, … | 날씨 얘기다 |
| year-ahead | 한 해 옷 고쳐 입기 — 올해와 내년 | 1,600 | pillars, natalTenGods(지장간 뺌), daeunNow, thisYear, nextYear, seunInteractions, noGuessYears | horizon, occupationStatus, relationshipStatus, careerFeeling, life_event:* | …, body[1], years[{year, ganzhi, title, text, reduce, keep}], … | 날씨 얘기다 / 되돌릴 수 있는 크기로 |
| crossroads | 갈림길 앞에서 | 2,500 | pillars, natalTenGods(지장간 뺌), natalInteractions, daeunNow, thisYear, seunInteractions, noGuessYears | concernTopic, careerFeeling, loveFocus, moneyFocus, occupationStatus, relationshipStatus, horizon | title, sub, body[1], forks[3: title, sub, left/right{name, gain, loss}, criteria[3], rule, todo, ask], caveat | — |
| closing | 마무리 — 할미의 당부 | 1,200 | pillars, natalTenGods(지장간 뺌), daeunNow, thisYear, noGuessYears | concernTopic, horizon | title, points[3: title, text], review[1~2: after, claim, basis], todo, caveat | 개운이 별거냐… |

톤 메모
- **본질**(5·3·2 — 따뜻·재치·신랄): 장면 하나로 네 문단을 잇는다. 굳은 데는 "고집"으로 끝내지 않고 왜 굳는지를 쓴다. 신랄은 넷째 문단에서만, 말씨 세기(toneStrength)가 허락할 때.
- **재능**: 직업 이름을 정해 주지 않고 "일의 모양"(예: 남의 글을 고치는 자리)으로 쓴다. 시험·승진 단정 금지.
- **돈**(4·4·2): 재성이 없어도 "돈 없는 사주"가 아니다. 종목·시기는 "그건 할미도 모른다".
- **사람**: 곁 사람은 성별 없이 "곁 사람·짝". 말하지 않은 짝·결혼을 전제하지 않는다. 가족 판정 금지.
- **지금 대운**: 얼굴 세 가지 + "네겐 어느 얼굴로 왔느냐?". 대운 갈아입는 해는 "첫 반년은 새 옷에 몸을 맞춘다"(voice-guide §10-20).
- **올해와 내년**(6·2·2): "흔들리는 해"(사실표 `luck.seunFlags.shaking === true`인 올해만 — prompts@0.3.0), "되돌릴 수 있는 크기로". 내년 간지가 사실표에 없으면 내년 간지를 쓰지 않는다(§5 계약 제안 2).
- **갈림길**: 정해 주지 않고 고르는 기준을 준다. 한쪽을 나쁜 길로 그리지 않는다.
- **마무리**: 새 판정을 꺼내지 않는다. review는 1년 뒤 스스로 가려 볼 말(기존 review 기능, menu-names F6 "일 년 뒤 할미 채점"). 마지막 말은 파이프라인이 붙인다.

### 2-3. 상품 특화 7장

| id | 상품 | 제목 | 상한 | 사실표 조각(공통 외) | 사용자 사실 | 출력 칸(공통 외) |
|---|---|---|---|---|---|---|
| love-deep | LOVE | 곁자리 이야기 — 연애·결혼 | 2,200 | pillars, natalTenGods, natalInteractions, gongmang, daeunNow, thisYear, 대운·세운 관계 중 **일지에 걸린 것** | relationshipStatus, loveFocus, hasChildren, life_event:marriage·childbirth, concernTopic | body[3], patterns[{name, text}], this_year |
| money-deep | MONEY | 곳간 셈 — 재물 | 2,200 | pillars, natalTenGods, natalInteractions, elements, strength, daeunNow, thisYear, daeun·seunInteractions | occupationStatus, moneyFocus, hasChildren, life_event:business_start·job_change, concernTopic | body[3], ledger{earn, keep, leak}, size_rule, this_year |
| career-deep | CAREER | 밥벌이 결 — 일과 직업 | 2,200 | pillars, natalTenGods, natalInteractions, daeunNow, thisYear, daeun·seunInteractions | occupationStatus, careerFeeling, life_event:job_change·business_start·school_milestone, concernTopic | body[2], roles[{place, text}], move_or_stay{stay, move, criteria[3]}, this_year |
| life-past | LIFE | 네 인생 한 두루마리 — 지나온 마디 | 1,800 | pillars, natalTenGods(지장간 뺌), daeunPast(첫 대운 전 포함), daeunInteractions, noGuessYears | life_event:*, birthOrder | body[1], daeun[{ganzhi, start_age, start_year, name, text}] |
| life-ahead | LIFE | 네 인생 한 두루마리 — 남은 마디 | 2,200 | pillars, natalTenGods(지장간 뺌), daeunAhead(지금부터 많아야 4개), daeunInteractions, noGuessYears | horizon, occupationStatus, relationshipStatus, hasChildren, concernTopic | body[1], daeun[{ganzhi, start_age, start_year, name, theme, best, half, worst, do_this}] |
| decade-weather | DECADE | 앞으로 열 해 날씨 | 2,400 | pillars, natalTenGods(지장간 뺌), daeunNow, daeunInteractions, thisYear, seunInteractions, noGuessYears | horizon, occupationStatus, careerFeeling, relationshipStatus, concernTopic | body[2], daeun[{ganzhi, start_age, start_year, name, theme, faces}], turn{year, text} |
| decade-pack | DECADE | 열 해 짐 꾸리기 | 1,400 | pillars, natalTenGods, natalInteractions, elements, daeunNow, thisYear, noGuessYears | horizon, occupationStatus, careerFeeling, concernTopic | carry[3], leave[2], checkpoints[2~3: year, text] |

톤 메모
- **연애**(4·4·2): 재성·관성을 성별과 상관없이 "마음을 주고 챙기는 방식 / 끌리는 사람의 결과 내 기준"으로 읽는다. 재성=아내, 관성=남편 같은 옛 배정은 쓰지 않는다(DECISIONS 대기 7, tengods.yaml kinship_policy). 일지에 충이 오는 해는 "같이 사는 방식에서 손볼 데가 드러나는 해"(voice-guide §10-16). 만 19세 미만이면 친구·또래 관계로 바꿔 쓴다.
- **재물**: size_rule은 금액·종목 없이 "되돌릴 수 있는 크기" 원칙 한 문장. "대박·횡재" 금지.
- **직업**: 지키는 쪽/움직이는 쪽을 나란히 놓고 기준 세 가지를 준다. 퇴사 결정을 대신하지 않는다.
- **인생 총괄**: 지나온 마디는 맞히는 단정을 쓰지 않는다(지나온 길 단정 문항은 별도 기능). 늦은 나이 마디에서 수명·병·"끝"을 말하지 않는다(menu-names §1-4 수명 연상 금지와 같은 뜻).
- **향후 10년**: 해마다의 세운은 사실표에 올해만 있어 해마다 풀지 않는다. 열 해 안의 대운 교체 해(turn)에 무게를 둔다.

### 2-4. 바꿔 볼 것(개운) 범주 조각 — prompts@0.3.0 (facts@0.3.0, D-023 ②)
사실표 조각 `gaeun`(`facts.ts secGaeun`)은 코드(`src/engine/content/gaeun.ts`)가 고른 `chart.gaeun` 중 그 장 몫만 싣는다. 제목 "바꿔 볼 것 — 코드가 고른 범주. 이 밖의 개운은 만들지 않는다". 범주 한 줄 = 범주 + 바꿔 볼 것(`GAEUN_CATALOG` practice) + 근거 그림 말, 그 아래 문형 줄(voice-guide §14-4). 실천 등급만 싣고 참고 등급(색·방향·숫자·맛)은 싣지 않는다(대표 결정 전). 조각 맨 위에 `gaeunBasis.groupCounts`(드러난 글자 묶음 개수)를 옮겨 "~이 없다·약하면" 조건을 값 0인 묶음으로만 묶는다(감수 P1·P2).

| 범위(gaeunScope) | 싣는 범주(gaeun.md §3.4) | 장 |
|---|---|---|
| natal | GA.fill + GA.ease(또는 GA.balanced), GJ 1개 | nature |
| relationNatal | GA.fill/ease 중 비겁·관성·인성 | people |
| relation | 위 + 대운·올해의 GI.chungDay·GI.hap | love-deep |
| workNatal | GA.fill/ease 중 식상·재성·관성 | talent, money |
| work | 위 + 대운·올해의 GT.* | money-deep, career-deep |
| daeun | 지금 대운 슬롯 GT.* + GT.turn + GI.* | daeun-now, decade-weather, decade-pack |
| seun | 올해(·내년) 슬롯 GT.* + GI.* | year-ahead |
| closing | 새 범주 없이 natal ∪ daeun ∪ seun 중 1~3개 되짚기 | closing |

- 사람·재능·돈 기본 장은 운 이야기가 다른 장 몫이라 운 범주를 싣지 않는다(§3.4의 "관계 장·일·돈 장"을 기본/특화로 나눈 것 — 작가 해석).
- 범주를 싣지 않는 장: 무료 4장, crossroads, life-past, life-ahead. GA.bridge·GE.*(오행 생활 결 실천 줄)는 §3.4 표에 자리가 없어 지금은 어느 장에도 싣지 않는다(연구소장 확인 필요).
- `chart.gaeun`이 없는 옛 사실표: 조각이 "범주가 없다"고 알리고, 장 지시대로 그 장 사실표 글자에서만 실천을 끌어낸다(마무리 장은 옛 용신 줄 방식).
- 운 글자 십성은 `luck.glyphs` 값을 쓴다(지금 대운·올해). glyphs에 없는 슬롯(지난·다음 대운, 내년)만 `chart.tenGods`의 같은 글자 값을 옮긴다.
- 사용자 사실 줄에는 출처 "[출처: 네가 말한 것]"과 `link` 문형(match 통로 / mismatch 글자 밖 / 없음 배경)을 붙인다.

## 3. 장마다 공통으로 지키는 것(시스템 프롬프트 요약)
`system.ts`의 12개 절. 원문은 코드가 단일 원본이다.
1. 재료: 사실표에 있는 글자·관계만. 새로 계산·추론한 십성·합충·공망·신강약·용신·신살·12운성·지장간 금지. 목록이 비어도 "없다"고 단정하지 않음. 사실표에 없는 해의 간지를 셈하지 않음.
2. 근거 글자 공식(voice-guide §7). 운 글자는 같은 문장에 "대운·올해·연도·나이"를, 지장간은 "속에 든·지장간"을 밝힌다(검증기 BASIS_NOT_IN_CHART의 luck-unmarked·hidden-only 경고를 처음부터 피하려는 것).
3. 사용자 사실은 배경으로만, 맞히지 않는 해, 지어낸 경험 금지, MBTI 판정 금지.
4. 불확실성: 엔진 경고는 장의 `caveat` 칸에. 시 모름이면 시주 이야기 안 함. "검증된 예측이 아니다"는 정해진 자리에 한 번(파이프라인).
5. 앞날은 날씨처럼: 세 얼굴, 흔들리는 해(표지 있을 때만), 되돌릴 수 있는 크기, 개운 물건 금지. 개운 실천은 [바꿔 볼 것] 범주에서만(§2-4).
6. 다루지 않는 것: 죽음·사고·중병·이혼·파산 시기, 수명, 병 이름, 투자 종목·코인·복권, 합격, 속마음, 전생, 점수.
7. 옛 판정 걷어 내기: 성별을 AI에 넘기지 않고 성별로 뜻을 바꾸지 않음. 품성 판정 낱말 금지. 신랄은 버릇에만.
8. 고전 인용 금지(지식베이스 verified 원문 0건 — sources.md, 검증기 FAKE_CLASSIC_QUOTE).
9. 위기 신호: 풀이를 멈추고 voice-guide §11 문안만(호칭은 부름말로 바꿔 넣음).
10. 말투: 할미(반말) / 담백(해요체) 두 목소리, 호칭, 문장 길이, 비유 한 장에 하나, 한자 표기, 발음 주의.
11. 출력: JSON 스키마로만, `<b>`는 body에서만.
12. 내보내기 전 점검 6문항.

기존 SYSTEM_PROMPT에서 뺀 것(voice-guide §12 지적 반영): AI가 십성·합충·신살을 뽑게 하던 문장, `life_graph`의 건강·횡재 점수, `quote`("명언처럼"), "여자의 무관 = 남편에게 기대어 서는 팔자가 아니다"(성별 판정), "스무 살 무렵 사내의 편관은 군대"(성별 단정 — life-stages.md §3-1 규칙 5).

## 4. 토큰 상한 근거
- 계산식: (칸별 예상 글자 수 합) × (한글 1자 ≈ 1토큰, **추정** — 실측 전) × (JSON 칸 이름·따옴표 약 15%) × 여유 1.3~2.0배. 장마다 `tokenBasis`에 적었다.
- 여유를 두는 까닭: 출력이 상한에 걸려 잘리면 JSON이 깨져 장 전체를 다시 만들어야 한다(재시도 비용이 여유분보다 크다). 상한은 "보통 쓰는 양"이 아니라 "넘으면 안 되는 선"이다.
- 상한 범위 800~2,500(지시 범위). 무료 장은 800~1,000, 유료 일반 장 1,200~1,800, 상품의 중심 장(특화 장)과 구조가 많은 장(갈림길)은 2,200~2,500.
- 비용 가정과의 대조(`docs/COST_REPORT.md`, `docs/business/unit-economics.md`): 주제형 출력 1.2만 토큰 가정 → BASIC 상한 합 1.3만(실제 사용량은 상한의 60~75%로 예상, 미측정). 인생 총괄 상한 합 1.7만, 향후 10년 1.09만(가정 2.5만보다 작음), 신년 0.87만(가정 1.5만보다 작음). 무료 3,400.
- 입력: 시스템 프롬프트(한글 약 5,000자 — 추정 약 4,000~5,000토큰)는 풀이 하나에서 모든 장이 같아 캐시를 쓰면 두 번째 장부터 캐시 읽기 단가로 계산된다. 장별 user 메시지는 사실표 조각만 넣어 장당 수백~1,500토큰(추정)이다. **무료 장(Haiku 1.5원/건 가정)은 시스템 프롬프트 때문에 가정보다 비쌀 수 있다** — 실측 후 무료 전용 짧은 시스템 프롬프트가 필요한지 판단한다(§7).

## 5. 계약(types.ts) 변경 제안 — 총괄실장 승인 필요
코드는 계약을 바꾸지 않고, 아래 선택 칸이 **있으면 읽고 없으면 무시**하게 만들었다(`facts.ts`의 `FactSheetWithExtras`).

1. **`style?: { voice: "할미" | "담백" }`** — 기존 기능(목소리 선택)을 이어 가려면 필요하다. 지금은 없으면 할미 목소리.
2. **`luck.nextYear?: { year; ganzhi }`**(계산 엔진 값) + 그해 원국과의 관계(`interactions`의 위치 코드 예: `"nextSeun.branch"`)와 십성 — "올해와 내년" 장의 내년 부분. 없으면 내년 간지를 쓰지 않고 올해만 쓴다. 향후 10년 상품을 해마다 풀려면 `luck.years: {year, ganzhi}[]`(10년치)로 넓히기를 제안.
3. **운 글자 십성의 범위** — `chart.tenGods`에 지금 대운·올해뿐 아니라 **모든 대운 글자**의 십성을 넣어 주기를 제안(규칙 엔진 `extra.luck`에 대운 전체를 넣으면 나온다). 지금은 사실표에 같은 글자가 없으면 "십성 사실표에 없음"으로 적고 AI가 이름을 못 붙이게 했다(인생 총괄·향후 10년 장의 품질이 여기에 달림).
4. **위치 코드 표기 확정** — `pos`·`positions`의 운 위치를 `"daeun.stem"`(지금 대운) / `"daeun[3].stem"`(몇 번째 대운) / `"seun.branch"` 중 무엇으로 쓸지, 지장간은 `"day.branch.jeonggi"`처럼 쓸지 확정 필요. 프롬프트는 `daeun…`·`seun…`으로 시작하면 운, `year|month|day|hour.stem|branch` 뒤에 꼬리가 붙으면 지장간으로 읽는다.
5. **`subject.gender`는 AI에 넘기지 않는다** — 프롬프트는 이 칸을 읽지 않는다. 사실표에 남겨 둘지(파이프라인 내부용) 뺄지 결정 필요. 빼는 편이 개인정보 최소화에 맞다.
6. **두 사람 상품**(궁합·괴롭힘·싸움): `partner?: { chart; ... }`와 두 사람 사이 관계(규칙 엔진) 칸이 필요하다. 제3자 개인정보 동의 문구와 함께 결정 필요.
7. **장 사이 일관성**: 장을 따로 만들기 때문에 장끼리 같은 말을 되풀이하거나 어긋날 수 있다. 장마다 "다른 장 몫"을 적어 막았지만, 앞 장의 제목·핵심 한 줄을 다음 장에 넘기는 `priorSummaries?: string[]`를 build의 두 번째 인자로 두는 것을 제안(계약의 `build(facts)` 모양 변경).
8. **월운**: 신년 상품의 달별 장을 만들려면 `luck.months?: { month; ganzhi }[]`가 필요하다.

## 6. 파이프라인(백엔드)에 넘기는 약속
- 장 출력은 `title·sub·chips·body·todo·ask` 꼴을 따른다(기존 FullReading의 chapter 꼴과 같은 칸 이름 — 검증기 `verifyReading`이 그대로 훑는다). 검증할 때 장 출력을 `parts[].chapters[]`에 넣으면 장별 바넘 비율 통계가 장 단위로 나온다.
- `years[].year/ganzhi`, `daeun[].ganzhi/start_age/start_year`는 사실표 값 그대로여야 한다. 검증기 구조 검사(YEAR_GANZHI_MISMATCH·daeun-start)에 걸리게 하려면 각각 최상위 `years`, `daeun_overview`로 옮겨 넣어 검증하기를 권한다.
- 고정 문구: 유료 풀이 첫 장 앞에 `RELIABILITY_NOTICE[voice]`, 마무리 장 뒤에 `LAST_WORDS[voice]`를 붙인다.
- 위기 신호: 사실표에는 자유 서술이 없어 AI가 위기를 볼 일이 거의 없다. 고민 자유 서술을 받게 되면 **AI를 부르기 전에** 검증기 `CRISIS_RE`로 먼저 검사하고, 걸리면 풀이를 만들지 않고 `crisisMessage(voice, addressAs)`를 보여 준다.
- 호칭: `subject.addressAs`에 실명을 넣지 않는다. 실명으로 부르고 싶으면 AI 출력의 호칭을 화면에서 바꿔 끼우는 방식(예: 자리표시)을 검토(프라이버시상 권장).

## 7. 남은 일 / 대표·총괄 결정 필요
1. 할머니 이름 확정 → `persona.ts`의 `GRANDMA_NAME` 한 곳만 바꾼다. 캐릭터 사연(`PERSONA_BACKSTORY`)도 승인 대기.
2. 상품 목록·장 구성 확정(특히 YEAR 임시 구성, CONCERN·두 사람 상품 보류).
3. 위기 상담 번호(109, 1577-0199) 출시 전 재확인(voice-guide §11).
4. 실제 생성으로 장별 출력 토큰·품질 실측 → 상한·문단 수 조정, 무료 장 전용 짧은 시스템 프롬프트 필요 여부 판단.
5. 지나온 길 단정 문항(기존 `generateClaims`)은 이번 범위 밖 — 새 엔진용 문항 장은 별도 카드로 제안.

## 8. 유지관리
- 문구를 바꾸면 `PROMPT_VERSION`(`system.ts`)을 올리고 `npx vitest run tests/content/prompts.test.ts`를 돌린다.
- 장을 더하려면: `chapters/*.ts`에 `defineChapter`로 만들고 → `index.ts`의 목록에 넣고 → `products.ts`의 `PRODUCT_CHAPTERS`에 상품별로 넣는다(장의 `products`는 구성표에서 자동으로 채워진다) → 이 문서 표를 고친다. 테스트의 `EXPECTED_IDS`도 고친다.
- 사실표 조각을 더하려면 `facts.ts`에 `sec*` 함수를 만들고 `chapter.ts`의 `FactPart`·`SECTION_BUILDERS`에 등록한다. 사실표를 통째로 직렬화하지 않는다(개인정보·토큰).
- 금지 낱말을 바꾸면 검증기(`src/engine/verify/checks/*`)와 voice-guide §9-2도 함께 맞춘다(품질검증 담당과 협의).

## 9. 변경 이력
| 날짜 | 내용 | 승인 |
|---|---|---|
| 2026-11-27 | 최초 작성(제안) — 장 19개, 상품 12코드 구성, 계약 변경 제안 8건 | 대표 승인 대기 |
| 2026-11-28 | prompts@0.3.0 — facts@0.3.0 개운 범주 조각(§2-4), 운 글자 십성 luck.glyphs, "흔들리는 해" 표지 조건, 사용자 사실 link 문형, 참고 등급 제외(마무리 장 색·방향 허용 삭제) | 총괄실장 지시(대표 결정 D-023 범위) |
