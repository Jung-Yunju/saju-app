# 사주 발현 분석 — 기질 차원과 원국 판정 규칙 [제안]

> 작성: 명리학 연구소장 · 2026-11-28 · 상태: **제안**(총괄실장 검토 → 개인화 분석 연구원 구현 → 품질검증 독립 검증)
> 계약서: [docs/redesign/30-expression-engine.md](../../redesign/30-expression-engine.md)(D-035) · 입력: `RuleAnalysis`(rules@0.4.0, `src/engine/rules/types.ts`)
> 문서 판: `expression-dimensions@0.1.0` — 표의 문턱값을 바꾸면 판 번호를 올리고 구현 쪽 `dimensions.json`과 함께 바꾼다.
>
> **먼저 읽을 전제 다섯 가지**
> 1. **고전 원문 인용 0건, 원문 대조(L2) 0건**(감사 보고 `docs/reports/2026-11-28_knowledge-source-audit.md`). 이 문서의 명리 서술은 모두 **요지(paraphrase)** 이며 근거 등급은 **L0**(통설·기억, 출처 미확인)이다. 문턱값·가중·차원 구성은 **설계**(연구소장이 이번에 정한 값, 고전 근거 없음)다. 계약서 `evidenceLevel`은 전 차원 `"L0"`.
> 2. 기질 "차원"은 **전통 명리의 공식 분류가 아니다.** 십성·오행·관계 같은 엔진 값을 운명비서의 자기이해 모델로 묶은 것이다.
> 3. 명리 해석은 과학적으로 입증된 예측이 아니다. 차원 level은 "타고난 경향으로 읽을 수 있는 정도"이지 능력·성공의 측정값이 아니다.
> 4. MBTI–차원 대응(§6)은 **검증된 상관이 아니라 서비스 모델의 가설**이다. 명리 근거로 포장하지 않는다.
> 5. 이 문서의 계산 예시(§4)는 **손계산**이다. 엔진으로 돌려 확인하기 전에는 "검증됨"으로 쓰지 않는다.

---

## 0. 설계 원칙

| 원칙 | 내용 |
|---|---|
| 엔진 값만 읽는다 | 판정 재료는 `RuleAnalysis`가 이미 낸 값과, 거기서 **산수로만** 얻는 파생값(§2.2)이다. 발현 엔진은 새 명리 판단(합화·신살·성패 등)을 만들지 않는다. `RuleAnalysis`는 MBTI·설문과 무관하게 같은 값이다(계약서 §3). |
| 모형 A 고정 | 신강약·묶음 합계는 `strengthPrimary` 옵션과 관계없이 **모형 A(weighted)** 를 쓴다. 신성 원형(02-archetypes §1)과 같은 방침 — 옵션을 바꿔도 차원이 흔들리지 않게 한다. |
| 지장간 표 고정 | 차원 판정은 `hiddenStemTable: "kr-monthly-30"`으로 계산하고, 다른 표 결과는 기록만 한다(D-030 원형 방침과 같음, §7.3). |
| 같은 개념은 한 정의 | 십성 묶음 이름·투출·통근·존재 상태는 규칙 엔진 정의를 그대로 쓴다(§1.2 맞춤표). 새 철자·새 정의를 만들지 않는다. |
| 판정은 단계로만 | 내부 점수는 쓰되 화면·AI 입력에는 `strong / moderate / faint` 세 단계만 보낸다(계약서 §5). |
| 근거는 반드시 남긴다 | 모든 level에는 `basis`(ruleId·위치·메모)가 최소 1개 있다. 원국에 없는 차원(faint)도 "없음" 근거를 남긴다(§3.9). |
| 좋고 나쁨을 매기지 않는다 | faint는 "결함"이 아니라 "그 쪽 글자가 원국에서 옅다"는 뜻이다. 문안은 "옅다 → 채워라"를 기계적으로 쓰지 않는다(gaeun.md §1.3 감수 P1과 같은 주의). |

---

## 1. 기질 차원 목록 (9개)

### 1.1 목록

| # | id | 쉬운 이름 | 한 줄 설명(갑·을을 몰라도 읽히게) | 갈래 | 주 재료 |
|---|---|---|---|---|---|
| 1 | `drive` | 내 힘으로 서는 힘 | 남에게 기대기보다 내 판단으로 버티고 밀고 나가는 힘 | 핵심 | 비겁 묶음 + 일간 세력 |
| 2 | `expression` | 꺼내 보여 주는 힘 | 속에 든 생각·재주를 말·글·손으로 밖에 내놓는 힘 | 핵심 | 식상 묶음 |
| 3 | `realism` | 현실로 옮겨 손에 쥐는 힘 | 생각을 결과·돈·살림 같은 손에 잡히는 것으로 바꾸는 감각 | 핵심 | 재성 묶음 |
| 4 | `duty` | 책임지고 틀을 지키는 힘 | 약속·마감·규칙 안에서 맡은 몫을 해내려는 힘 | 핵심 | 관살 묶음 |
| 5 | `learning` | 받아들이고 익히는 힘 | 배우고, 도움을 받고, 생각을 깊이 쌓는 힘 | 핵심 | 인성 묶음 |
| 6 | `steadiness` | 차근차근 다지는 결 | 정해진 길을 고르게, 오래, 무리 없이 가는 쪽의 결 | 결(結) | 정재·정관·정인·식신 비중 |
| 7 | `edge` | 틀 밖으로 밀고 나가는 결 | 압박을 돌파하고, 남다른 길·새 방식을 찾는 센 결 | 결(結) | 편관·상관·편인·겁재 비중 |
| 8 | `flux` | 변화를 타는 힘 | 자리·관계·계획이 자주 움직이는 판에서 움직임을 타는 힘 | 보조 | 원국 충·형 |
| 9 | `outward` | 밖으로 펼치는 기운 | 기운이 안으로 갈무리되기보다 밖으로 퍼지는 정도 | 보조 | 음양 비율 + 한난 |

- **핵심(1~5)**: 십성 다섯 묶음과 1:1. 근거가 가장 단단한 쪽(오행 생극 관계는 명리의 기본 틀, L0).
- **결(6·7)**: 같은 묶음 안에서도 "고른 쪽 / 센 쪽"을 가르는 가로축. 핵심 다섯과 **같은 글자를 다른 각도로 다시 센다**(겹침 주의, §7.8).
- **보조(8·9)**: 대중 풀이에서 흔히 쓰는 읽기지만 근거가 가장 약하다(L0 중 약). 문안에서는 핵심 차원보다 뒤에, 더 조심스럽게 쓴다. `innateEssence` 장의 대표 기질로는 핵심 → 결 → 보조 순으로 고른다.
- 계약서 예시 id(`expression`·`drive`·`realism`·`duty`·`learning`)는 그대로 살렸다.

### 1.2 같은 개념 맞춤표 (모듈 간)

| 묶음 | rules `TenGodGroup` (`src/engine/rules/types.ts`) | archetype `TEN_GOD_GROUP` | content `TEN_GOD_GROUP` (`gaeun.ts`) | personalize `TenGodGroup` (`lived-link.ts`) | 발현 차원 |
|---|---|---|---|---|---|
| 비견·겁재 | `bigyeop` | `bigyeop` | `bigyeop` | **`bigeop`** | `drive` |
| 식신·상관 | `siksang` | `siksang` | `siksang` | `siksang` | `expression` |
| 편재·정재 | `jaeseong` | `jaeseong` | `jaeseong` | `jaeseong` | `realism` |
| 편관·정관 | `gwansal` | `gwansal` | `gwansal` | **`gwanseong`** | `duty` |
| 편인·정인 | `inseong` | `inseong` | `inseong` | `inseong` | `learning` |

- ⚑ **`lived-link.ts`만 철자가 다르다**(`bigeop`·`gwanseong`). 발현 엔진은 **rules 철자**(`bigyeop`·`gwansal`)를 기준으로 쓰고, lived-link 값을 읽을 때는 명시적 변환표(`bigeop→bigyeop`, `gwanseong→gwansal`)를 둔다. 세 번째 철자를 만들지 않는다. lived-link 철자 통일은 개인화 연구원 파일이라 총괄실장 판단(§9 결정 필요).
- 묶음 → 차원 대응: `DIM_OF_GROUP = { bigyeop: "drive", siksang: "expression", jaeseong: "realism", gwansal: "duty", inseong: "learning" }`.
- 십성 → 묶음은 기존 `TEN_GOD_GROUP`(archetype·gaeun과 같은 값)을 가져다 쓴다. 새로 정의하지 않는다.

---

## 2. 공통 입력과 파생값

### 2.1 읽는 엔진 필드 (rules@0.4.0, 코드에서 확인한 실제 이름)

| 기호 | 필드 | 비고 |
|---|---|---|
| `A` | `strength.models.find(m => m.model === "weighted")` | `A.ratio`, `A.verdict`, `A.extreme`, `A.nearBoundary`, `A.total`, `A.basis[]` |
| `G` | `strength.groupTotals` | 일간 제외 묶음 합(모형 A 가중). Σ`G` = `A.total` − 1 |
| `T` | `A.total` | 가중 weighted-v1(천간 1.0, 월지 3.0, 일지 1.5, 연지·시지 1.0) × 지장간 weight. 시주 있으면 **10.5**, 모르면 **8.5**(고정) |
| `tenGods` | `tenGods: TenGodHit[]` | 원국 천간(일간 제외)·지지·지장간 + 운(대운·세운)의 천간·지지. **운 기둥에는 지장간 항목이 없다** |
| `hidden` | `hiddenStems.pillars.{year,month,day,hour}` | 순서 여기→중기→정기, 시주 모름이면 `hour: null` |
| `struct` | `structure.candidates` | `role === "primary"`인 후보의 `pivot.tenGod`, `kind`, `variantAgreement` |
| `flags` | `qiFlow.clarityFlags[].flag` | "관살혼잡"·"상관견관"·"효신탈식"·"비겁쟁재"·"재성파인"(천간 기준) |
| `rels` | `interactions: Interaction[]` | `scope`("natal"/"luck"), `type`, `members`, `subsumedBy`, `partial` |
| `yy` | `elements.yinYang` | `{ yang, yin, branchYinYang }` — 천간+지지 개수 |
| `tClass` | `climate.tClass` | "한강"·"한"·"중"·"난"·"열강" |
| `ug` | `usefulGods.views` | `method === "eokbu"`의 `status`·`candidates`·`favorable`(§5.5에서만) |
| 민감도 | `strength.tableSensitive`, `strength.hourSensitivity`, `structure.tableSensitive`, `omitted` | §7 |

### 2.2 파생값 (발현 엔진이 산수로 계산 — 규칙 엔진 변경 없음)

| 파생값 | 정의 | 메모 |
|---|---|---|
| `gs[g]` | `round6(G[g] / T)` | 원형 02 §2.2의 `gs`와 **같은 정의**(분모에 일간 포함). 다섯 묶음 합 = (T−1)/T ≈ 0.905(시주 있음) |
| `touchul[g]` | `tenGods`에서 `position.pillar ∈ {year, month, hour}` · `position.part === "stem"` · `viaHiddenStem` 없음 · `TEN_GOD_GROUP[tenGod] === g`인 항목의 위치 | 투출(천간에 드러남). 일간은 `tenGods`에 원래 없다 |
| `hiddenAt[g]` | `tenGods`에서 원국 기둥 · `viaHiddenStem` 있음 · 묶음 g인 항목의 (위치, 역할) | 지장간(여기·중기·정기 무관) |
| `presence[g]` | `touchul`·`hiddenAt`이 각각 비었는지로 `"stemAndHidden" / "stemOnly" / "hiddenOnly" / "absent"` | 규칙 엔진 `StructureGroupRef.presence`(§2.3)와 **같은 규칙**. 묶음은 오행으로 정해지므로 `stemAndHidden` = "투출한 글자가 같은 오행 뿌리를 가짐" = **투출+통근**과 같다(rooted 모형의 `hasRoot`와 같은 기준: 오행 일치, 역할 무관) |
| `M[g]` (월령) | (a) `tenGods`의 `{pillar:"month", viaHiddenStem:"jeonggi"}` 항목의 묶음이 g, **또는** (b) `struct` 중 `role === "primary"`이고 `pivot`이 있는 후보의 `TEN_GOD_GROUP[pivot.tenGod] === g` | (b)는 투출 우선(G2)으로 여기·중기가 격을 잡은 경우를 포함한다. (a)와 (b)가 다르면 **두 묶음 모두** M |
| `tgT[tg]` | 십성별 가중 합 = Σ `A.basis[i].points` (단 `group !== "self"`), 십성은 `tenGodOfStem(dayMaster.stem, basis[i].char)` | 규칙 엔진 공개 함수(`src/engine/rules/index.ts` export) 사용. Σ = Σ`G`. 원형 02 §2.3이 예고한 `tenGodTotals`와 같은 값 |
| `flavor[g]` | 묶음 g의 두 십성 중 한쪽 `tgT` ≥ `G[g]` × 2/3이면 그 십성, 아니면 `"mixed"`, `G[g] = 0`이면 없음 | 내용 서술용 "결" 메모(§3.10). level에는 쓰지 않는다 |

- ⚑ **지지 자체 항목은 십성 판정에 쓰지 말 것.** `tenGods`의 `{part:"branch", viaHiddenStem 없음}` 항목은 `branchYinYang` 옵션을 따라 子·午·巳·亥에서 십성이 정기 천간과 달라질 수 있다(rules-spec §2). 묶음(오행)은 같지만 **십성 단위(§3.6·3.7)에서는 지장간 항목 또는 `A.basis`만** 쓴다. (참고: `gaeun.ts` `surfaceGroupCounts`는 묶음 개수만 세므로 영향 없음.)

### 2.3 위치 문자열 형식 (`basis.positions`)
`gaeun.ts`의 `posStr`와 같게 쓴다: 천간 `"year.stem"`, 지장간 `"month.branch.jeonggi"`, 지지 자체 `"day.branch"`, 대운 `"daeun[3].stem"`(**1부터** 센 번호 — `posStr` 규칙), 세운 `"seun.branch"`.

---

## 3. 차원별 판정 규칙

### 3.1 공통 묶음 규칙 `exp.lv.group.v1` (핵심 차원 1~5)

묶음 g의 level은 위에서부터 처음 맞는 줄로 정한다.

| 순서 | 조건 | level | ruleId | basis 메모 |
|---|---|---|---|---|
| L1 | `presence[g] === "absent"` | faint | `exp.lv.absent` | "원국 천간·지장간 어디에도 없음"(positions 빈 배열 허용, basis 항목은 필수) |
| L2 | `presence[g] === "hiddenOnly"` | `gs[g] ≥ 0.12` 또는 `M[g]` → **moderate**(상한), 그 밖 → faint | `exp.lv.hiddenOnly` | `latent: true` — "지장간에만 있음(드러나지 않은 잠재)" |
| L3 | `presence[g] === "stemOnly"` | `gs[g] ≥ 0.15` → **moderate**(상한), 그 밖 → faint | `exp.lv.stemOnly` | `floating: true` — "천간에 드러났으나 받쳐 주는 뿌리가 없음" |
| L4 | `presence[g] === "stemAndHidden"` | `gs[g] ≥ 0.24` 또는 (`M[g]` 그리고 `gs[g] ≥ 0.18`) → **strong**, 그 밖 → moderate | `exp.lv.rooted` | "드러나 있고 뿌리도 있음" + M이면 "월령(태어난 달의 주된 기운)" |

의사 코드(구현자가 그대로 옮길 수 있게):
```ts
function groupLevel(g: TenGodGroup): { level: Level; flags: string[] } {
  const p = presence[g], s = gs[g], m = M[g]
  if (p === "absent") return { level: "faint", flags: [] }
  if (p === "hiddenOnly") return { level: s >= 0.12 || m ? "moderate" : "faint", flags: ["latent"] }
  if (p === "stemOnly") return { level: s >= 0.15 ? "moderate" : "faint", flags: ["floating"] }
  return { level: s >= 0.24 || (m && s >= 0.18) ? "strong" : "moderate", flags: [] }   // stemAndHidden
}
// 비교는 round6 값끼리, 경계 포함(≥)
```

**왜 이렇게 나눴나 (요지·설계)**
- 명리 통설(L0): 지지 속(지장간)의 기운은 "숨은 기운", 천간에 드러나면(투출) "쓰이는 기운", 드러난 글자가 지지에 뿌리를 두면(통근) "힘이 실린 기운"으로 본다. 태어난 달의 지지(월령)가 원국에서 가장 무겁다는 것도 통설이다. → 투출+통근(L4)만 strong이 될 수 있게, 숨기만 했거나(L2) 뜨기만 한(L3) 기운은 moderate까지로 묶었다.
- 월령은 weighted-v1이 이미 월지에 3.0을 주므로 점수에 한 번 들어가 있다. M은 **strong 문턱을 0.24 → 0.18로 낮추는 데만** 쓴다(이중 가산을 줄이기 위함, 설계).
- 수치 감각(시주 있음, T = 10.5): 천간 한 글자 = 0.095, 월지 정기 하나(16~20일) ≈ 0.15~0.19, 다섯 묶음이 고르면 각 ≈ 0.18. 문턱 0.24는 "고른 몫보다 확실히 큼", 0.12는 "고른 몫의 2/3", 0.15(L3)는 "천간 두 글자쯤"을 뜻한다(설계값, 분포 측정 후 조정 §8).
- ⚑ 학파 차이: **월지 정기가 투출하지 않아도 격을 이룬다**는 쪽(정기 고정, G2')에서는 L2(지장간만) + 월령이 strong이어야 한다고 볼 수 있다. 1차 기본은 상한 moderate. 옵션 `hiddenMonthCanBeStrong: false`(기본) / `true`로 예약한다.

### 3.2 `drive` — 내 힘으로 서는 힘
- **재료**: 공통 규칙(g = `bigyeop`) + 일간 세력 보정.
- **보정** `exp.mod.drive.v1`(공통 규칙 결과에 적용, 한 단계씩, 최대 strong·최소 faint):
  - +1: `A.verdict === "신강"` 그리고 `G.bigyeop ≥ G.inseong`(비겁형, 원형 `tg.supportType`과 같은 동점 규칙) 그리고 `A.nearBoundary === false` 그리고 `strength.tableSensitive === false`.
  - −1: `A.extreme === "weak"`(극신약).
  - 보정을 했으면 basis에 `{ ruleId: "exp.mod.drive.v1", positions: [], note: "일간 세력(모형 A r=…)" }`를 남긴다.
- **12운성은 쓰지 않는다**(§7.7). 원하면 basis 메모로만: 일지 봉법 단계가 건록·제왕이면 "일지에 일간 힘이 실림"(옵션 `twelveStagesYin`·`earthStages` 기록 필수).
- 고전 요지(L0): 비견·겁재는 일간과 같은 오행 — 자립·동료·경쟁의 기운. 일간이 강하면 스스로 감당하는 힘이 크다고 본다.
- 서비스 해석: "내 판단으로 서는 힘, 같이 뛰는 사람과 어울리는 힘." 넘치면 "혼자 다 지려는 버릇", 옅으면 "기대도 되는 판".
- 걷어 낸 옛 판정(원문 기록용 요지, 서비스 비사용): 비겁이 많으면 재물·배우자를 빼앗긴다(군겁쟁재), 형제 덕이 없다.

### 3.3 `expression` — 꺼내 보여 주는 힘
- **재료**: 공통 규칙(g = `siksang`). 보정 없음.
- 결 메모(§3.10): `flavor` 식신 → "즐기며 오래 만드는 쪽", 상관 → "고칠 점을 보고 새로 말하는 쪽".
- 고전 요지(L0): 식상은 일간이 생하는 오행 — 일간의 기운이 밖으로 흘러나가는 길(설기).
- 걷어 낸 옛 판정: 상관은 오만하다, 상관견관은 관재·남편을 해친다, 식상은 여자의 자식.

### 3.4 `realism` — 현실로 옮겨 손에 쥐는 힘
- **재료**: 공통 규칙(g = `jaeseong`). 보정 없음.
- 결 메모: 정재 → "차곡차곡 관리하는 쪽", 편재 → "넓게 굴리고 기회를 보는 쪽".
- 고전 요지(L0): 재성은 일간이 극하는 오행 — 일간이 다루어 손에 넣는 대상(재물·결과).
- 걷어 낸 옛 판정: 재성 = 남자의 아내, 재다신약은 처가 덕이 없다.

### 3.5 `duty` — 책임지고 틀을 지키는 힘
- **재료**: 공통 규칙(g = `gwansal`). 보정 없음.
- 결 메모: 정관 → "제도 안에서 신뢰를 쌓는 쪽", 편관 → "압박 속에서 버티고 돌파하는 쪽".
- 고전 요지(L0): 관살은 일간을 극하는 오행 — 일간을 단속·단련하는 틀.
- 걷어 낸 옛 판정: 관 = 여자의 남편, 관살혼잡은 정조 문제.

### 3.6 `learning` — 받아들이고 익히는 힘
- **재료**: 공통 규칙(g = `inseong`). 보정 없음.
- 결 메모: 정인 → "배우고 돌봄을 주고받는 쪽", 편인 → "남다른 방식으로 깊이 파는 쪽".
- 고전 요지(L0): 인성은 일간을 생하는 오행 — 일간을 채우고 받치는 기운(학문·문서·돌봄).
- 걷어 낸 옛 판정: 인성이 없으면 부모 덕이 없다, 편인은 고독·괴팍하다.

### 3.7 `steadiness` / `edge` — 결이 고른 쪽 / 센 쪽 `exp.lv.tenGodSet.v1`

| 차원 | 십성 집합 | 세지 않는 십성 |
|---|---|---|
| `steadiness` | 정재 · 정관 · 정인 · 식신 | 비견 · 편재(양쪽 어디에도 넣지 않음) |
| `edge` | 편관 · 상관 · 편인 · 겁재 | 〃 |

판정(두 차원 각각, 서로 독립 — 둘 다 strong일 수 있다):
```ts
const share = round6(sum(tgT[tg] for tg in SET) / T)
const shown = tenGods.some(h => natalStem(h) && SET.includes(h.tenGod))   // 집합 십성이 연·월·시 천간에 투출
level = share >= 0.30 && shown ? "strong" : share >= 0.12 ? "moderate" : "faint"
// edge만: level === "moderate" 이고 flags에 "상관견관"·"효신탈식"·"관살혼잡" 중 하나라도 있으면 → strong (exp.mod.edge.clarity)
```
- **근거와 한계**: 옛 격국론에서 재·관·인·식은 "순하게 쓰는(생하고 지키는)" 쪽, 살·상·효(편인)·인(刃, 양인)은 "다루어 쓰는(제어해 쓰는)" 쪽으로 나눈다는 요지로 기억한다(자평진전 계열로 알려진 구분, **원문 미대조, L0**). 그런데 이 구분은 **용신을 다루는 방법**에 관한 것이지 성격 이론이 아니다. 현대 교재는 이를 "정(正)은 고르고 편(偏)은 세다"는 성격 읽기로 넓혀 쓴다(L0 현대 통설). 이 차원은 그 현대 읽기를 서비스 모델로 빌린 **설계**다.
- ⚑ 학파 차이 — **편재**: 옛 구분에서는 재성 전체(정재·편재)가 순용 쪽이지만, 현대 성격 읽기에서는 편재를 "확장·변동" 쪽으로 본다. 둘이 엇갈려 1차는 **어느 쪽에도 넣지 않는다**(설계 타협). 옵션 `pyeonjaeSide: "none"`(기본) / `"steady"` / `"edge"`로 예약.
- ⚑ **음양으로 기계적으로 나누면 안 된다**: 일간과 음양이 같은 쪽(비견·식신·편재·편관·편인)과 다른 쪽(겁재·상관·정재·정관·정인)으로 가르면 식신이 "센 쪽", 상관이 "고른 쪽"이 되어 통설과 거꾸로다. 그래서 집합을 이름으로 고정했다.
- 명리상 겁재의 "센" 면은 특히 양간의 양인(刃)에서 말해지지만, 1차는 겁재 전체를 넣는다(양인 판정은 12운성 옵션에 기대므로, §7.7).
- 서비스 해석에서 `edge`를 "흉하다·위험하다"로 쓰지 않는다. "센 힘이라 쓸 자리와 쉴 장치가 있으면 큰 추진력이 된다"는 쪽으로만 쓴다(옛 사흉신 표현은 걷어 냄).

### 3.8 `flux` — 변화를 타는 힘 (보조) `exp.lv.flux.v1`
```ts
const R = interactions.filter(i => i.scope === "natal" && !(i.subsumedBy?.length))
const moving = R.filter(i => i.type === "clash" || i.type === "stemClash" || (i.type === "punishment" && !i.partial))
const keyClash = moving.some(i => i.type === "clash" && i.members.some(m => m.part === "branch" && (m.pillar === "month" || m.pillar === "day")))
level = keyClash && moving.length >= 2 ? "strong" : moving.length >= 1 ? "moderate" : "faint"
```
- 세는 것: 지지 충, 천간 충, 형(**두 글자 부분 삼형 `partial: true`는 제외** — 기본 옵션 `partialPunishment: true`에서 寅申·巳申 같은 쌍이 충/파와 같은 두 글자를 중복으로 세게 되는 것을 막음). 원형 특징 `rel.*`와 같이 **세 글자 관계에 포함된 두 글자 기록(`subsumedBy`)은 뺀다**.
- 세지 않는 것: 파·해(gaeun.md §1.5 "1차 사용 안 함"과 맞춤), 합(§7.6).
- 고전 요지(L0): 충은 부딪쳐 움직이게 하는 관계, 월지·일지의 충은 사는 자리·일터 바탕의 변동으로 읽는다. 이것을 "움직임을 타는 기질"로 옮기는 것은 현대 대중 풀이의 읽기(L0 중 약) + 설계.
- ⚑ 학파 차이: 합이 충을 풀어 준다(합으로 충을 잊는다)는 설이 있다 — 1차 미적용(규칙 엔진도 합충 보정 안 함, strength-structure-spec §1.7).
- 서비스 금지: 충을 이별·사고·수술로 쓰지 않는다(옛 판정 걷어 냄, gaeun.md §1.5).

### 3.9 `outward` — 밖으로 펼치는 기운 (보조) `exp.lv.outward.v1`
```ts
const yr = round6(yy.yang / (yy.yang + yy.yin))          // elements.yinYang (천간+지지)
const warm = tClass === "난" || tClass === "열강"
const cold = tClass === "한" || tClass === "한강"
level = yr >= 0.75 || (yr >= 0.625 && warm) ? "strong"
      : yr <= 0.25 || (yr <= 0.375 && cold) ? "faint"
      : "moderate"
```
- 고전 요지(L0): 양은 펼치고 움직이며 음은 거두고 갈무리한다는 음양의 기본 성질, 화(火)의 따뜻함은 위로 퍼진다는 오행 성질. 이것을 성격의 발산·수렴으로 옮기는 것은 **대중 풀이 수준의 읽기(L0 중 가장 약)** 이다.
- ⚑ 옵션 민감: `branchYinYang`(byMainQi/byOrder)에 따라 子·午·巳·亥의 음양이 바뀌어 `yr`이 달라진다. 판정에 쓴 값(`yy.branchYinYang`)을 basis 메모에 남긴다.
- faint의 서술은 "밖으로 펼치는 결이 옅다 = 안으로 모아 두는 쪽일 수 있다"이지 "소극적이다"가 아니다.

### 3.10 공통 메모 규칙 (level을 바꾸지 않음 — basis에 추가)

| ruleId | 조건 | 메모(문안 재료) |
|---|---|---|
| `exp.note.load` | g ∈ {siksang, jaeseong, gwansal}의 level strong · `A.verdict === "신약"` · `A.nearBoundary === false` · 특수격 후보(`kind === "special"`) 없음 | "쓰는 쪽 힘이 커서 부담으로 느낄 수 있음" |
| `exp.note.surplus` | g ∈ {bigyeop, inseong}의 level strong · `A.verdict === "신강"` · `A.nearBoundary === false` · 특수격 후보 없음 | "넘쳐서 고이기 쉬움 — 흘려보낼 통로가 필요" |
| `exp.note.flavor` | `flavor[g]`가 있으면 | 그 십성 이름(결 메모, §3.3~3.6) |
| `exp.note.latent` / `exp.note.floating` | L2 / L3 | §3.1 |

- 특수격 후보가 있으면 load·surplus를 달지 않는 이유(요지, L0): 종격 관점에서는 넘치는 기운을 따르는 것이 오히려 쓰임이라, 억부식 "부담/넘침" 표현이 거꾸로 될 수 있다(strength-structure-spec §2.4, 특수격은 늘 low).

### 3.11 ruleId 목록

| ruleId | 쓰는 곳 |
|---|---|
| `exp.lv.absent` · `exp.lv.hiddenOnly` · `exp.lv.stemOnly` · `exp.lv.rooted` | 핵심 차원 1~5 |
| `exp.mod.drive.v1` | drive 보정 |
| `exp.lv.tenGodSet.v1` · `exp.mod.edge.clarity` | steadiness · edge |
| `exp.lv.flux.v1` | flux |
| `exp.lv.outward.v1` | outward |
| `exp.note.*` | §3.10 |
| `exp.luck.activate` · `exp.luck.feed` · `exp.luck.press` · `exp.luck.flux` · `exp.luck.tone` | §5 |
| `exp.sens.hour` · `exp.sens.table` · `exp.sens.boundary` | §7 |

basis 한 줄 예: `{ ruleId: "exp.lv.rooted", positions: ["year.stem", "month.branch.jeonggi", "day.branch.yeogi"], note: "편관 투출·월령, 비율 0.290" }`. 위치는 그 묶음의 `touchul` → `hiddenAt` 순서(연→월→일→시).

---

## 4. 손계산 예시 (엔진 확인 전 — QA 대조 대상)

원국: 연 甲子 · 월 丙寅 · 일 戊辰 · 시 庚申 (일간 戊 토, 기본 옵션·kr-monthly-30). **손계산이므로 엔진 값과 다르면 엔진을 믿고 이 표를 고친다.**

| 묶음 | 글자(가중) | G | gs | presence | M | level |
|---|---|---|---|---|---|---|
| bigyeop | 寅 戊 0.7, 辰 戊 0.9, 申 戊 0.233 | 1.833 | 0.175 | hiddenOnly | — | moderate (latent) |
| inseong | 丙(월간) 1.0, 寅 丙 0.7 | 1.700 | 0.162 | stemAndHidden | — | moderate |
| siksang | 庚(시간) 1.0, 申 庚 0.533 | 1.533 | 0.146 | stemAndHidden | — | moderate |
| jaeseong | 子 壬 0.333·癸 0.667, 辰 癸 0.15, 申 壬 0.233 | 1.383 | 0.132 | hiddenOnly | — | moderate (latent) |
| gwansal | 甲(연간) 1.0, 寅 甲 1.6, 辰 乙 0.45 | 3.050 | 0.290 | stemAndHidden | ✓(월지 정기 甲, 칠살격 pivot 甲) | **strong** |

- 합 9.5 = T(10.5) − 일간 1.0 ✓. 모형 A r = (1 + 1.833 + 1.7) / 10.5 = 0.4317 → 신약, 경계 0.45까지 0.018 → `nearBoundary: true` → drive 보정 없음, duty에 `exp.note.load` **달지 않음**.
- steadiness: 정재 0.817 + 정관 0.45 + 정인 0 + 식신 1.533 = 2.8 → 0.267 → moderate. edge: 편관 2.6 + 편인 1.7 + 상관 0 + 겁재 0 = 4.3 → 0.410, 甲·丙 투출 → **strong**(청탁 표지 효신탈식도 있음 — 丙 편인·庚 식신).
- flux: 寅申 충(월지 포함) + 甲庚 천간충 = 2(寅申 부분 삼형은 `partial`이라 제외, 子辰·申子 반합은 申子辰 삼합에 포함) → **strong**.
- outward: 양 7 / 8(子만 음, byMainQi) = 0.875 → **strong**.
- **시주를 빼면**(T = 8.5): siksang absent → expression **faint**, 寅申·甲庚이 사라져 flux **faint**, 모형 A r = 4.3 / 8.5 = 0.506 → 중화. 시주 하나로 두 차원이 strong/moderate → faint로 바뀐다 — §7.1의 민감도 기록이 꼭 필요한 이유.

---

## 5. 대운·세운이 차원을 건드리는 규칙

### 5.1 운 글자 읽기
- 대운 i: `tenGods`에서 `position.pillar === "daeun" && position.luckIndex === i`인 천간·지지 항목. 세운: `position.pillar === "seun"`.
- 운 지지의 십성은 지지 자체 항목(정기 기준) 하나뿐이다(운에는 지장간 항목이 없음). 1차는 이것만 쓴다(gaeun `LuckGlyphFacts`와 같은 방식).
- 운은 **원국 level을 바꾸지 않는다.** 운은 "그 시기에 그 차원 쪽으로 일이 몰리거나(활성) 눌리는(압박)" 것만 표시한다.

### 5.2 운 글자 묶음 → 차원 (오행 생극, L0)

| 운 글자 묶음 | 활성 `activate` (그 시기 일이 몰리는 쪽) | 이어 줌 `feed` (생: 다음 차원으로 흐름) | 압박 `press` (극: 눌리는 차원) |
|---|---|---|---|
| 비겁 | `drive` | `expression` | `realism` |
| 식상 | `expression` | `realism` | `duty` |
| 재성 | `realism` | `duty` | `learning` |
| 관살 | `duty` | `learning` | `drive` |
| 인성 | `learning` | `drive` | `expression` |

- 근거(L0): 비겁→식상→재성→관살→인성→비겁은 상생, 비겁→재성, 식상→관살, 재성→인성, 관살→비겁, 인성→식상은 상극(오행 관계를 일간 기준으로 옮긴 것). 옛 판정의 이름(군겁쟁재·상관견관·재성파인·효신탈식)은 압박 줄의 옛 표현이며, 서비스에서는 "눌린다 = 그 쪽 일에 힘을 더 써야 하는 시기"로만 쓴다.
- `feed`는 계약서 `activates`에 넣지 않는 2차 정보다(§5.8).

### 5.3 십성 단위 (결 차원)
- 운 글자 십성이 {정재·정관·정인·식신} → `steadiness` activate, {편관·상관·편인·겁재} → `edge` activate. 비견·편재는 없음(§3.7).

### 5.4 관계 (flux)
- `interactions`에서 `scope === "luck"`이고 `members`에 그 운 기둥 위치가 있고, 다른 쪽이 원국 **월지 또는 일지**이며 `type`이 `clash` 또는 `punishment`(`partial` 제외) → `flux` activate (`exp.luck.flux`, positions에 두 위치).
- 운 지지가 원국 월지·일지와 합(육합·삼합 완성) → 차원 활성 없음. 메모로만 "묶임·새 약속" (gaeun L6과 같은 재료).
- `outward`는 운이 건드리지 않는다(1차). 근거가 약한 보조 차원을 운으로 다시 흔들지 않기 위함(설계).

### 5.5 운의 결(tone) — 힘이 실리는 운 / 부담이 큰 운 `exp.luck.tone`
- 억부 관점(`ug.find(v => v.method === "eokbu")`)이 `status === "ok"`이고 `favorable`이 있을 때만: 운 글자 오행이 rank 1 오행 또는 `favorable.xi` → `"support"`, `favorable.ji` 또는 `favorable.gu` → `"load"`, 그 밖 `"neutral"`. 그 외 status면 `"neutral"`.
- 조후 관점(`johuClimate`) 1순위와 억부가 엇갈리면 tone은 억부만 쓰고 `conflicts`에 메모(용신 표시 방식은 대표 결정 대기 6번 — 하나로 합친 '진짜 용신'을 만들지 않는다).
- `A.nearBoundary` 또는 `strength.agreement === "split"`이면 tone을 `"neutral"`로 둔다(억부 방향이 흔들리는 원국).

### 5.6 학파 차이 (운)

| 쟁점 | 갈래 | 1차 기본 |
|---|---|---|
| 대운 천간·지지 비중 | 통째로 / 앞 5년 천간·뒤 5년 지지 / 지지(계절)를 더 무겁게 | 통째로. gaeun의 `luckHalves` 옵션을 쓰면 같은 값을 따른다(두 모듈이 다르게 나누지 않게) |
| 운 지지의 지장간 | 정기만 / 지장간 전부 | 정기만(엔진이 운 지장간을 내지 않음) |
| 세운을 대운에도 대볼지 | 원국만 / 대운까지 | 엔진 `interactions`가 내는 그대로(세운–대운 관계 포함) |
| 충이 기신을 치면 길, 용신을 치면 흉 | 판정 / 판정 안 함 | 판정 안 함(gaeun §1.5와 같음) |

### 5.7 상태 × 건드림 → 행동 방향 id (계약서 `luck.strategy` 제안, 설계)

| 원국·자기보고 상태 | activate 받음 | press 받음 |
|---|---|---|
| `expressed` | `exp.st.expand` 이미 쓰는 힘을 더 넓은 판에 | `exp.st.pace` 속도 조절·지킬 것 먼저 |
| `developed` | `exp.st.leverage` 익혀 온 힘을 드러내 쓸 때 | `exp.st.pace` |
| `dormant` | `exp.st.tryout` 덜 쓴 힘을 작게 꺼내 볼 때 | `exp.st.guard` 미리 대비·부담 나누기 |
| `quiet` | `exp.st.borrow` 혼자 다 하려 말고 사람·도구 빌리기 | `exp.st.guard` |
| `unknown` | `exp.st.observe` 이 시기 일이 몰리는 쪽 살펴보기 | `exp.st.observe` |

- tone `"load"`이면 `exp.st.smallsteps`(작게 나눠), `"support"`이면 `exp.st.commit`(정한 것 밀고 가기)를 덧붙인다. 결과·성공을 약속하는 문장으로 쓰지 않는다.
- 같은 운이라도 자기보고(MBTI·사실)가 다르면 status가 달라져 strategy가 달라진다 → 계약서 시험 1·2(원칙 7)를 만족하는 구조.

### 5.8 계약서 보완 제안 (총괄실장 승인 필요)
지금 `luck` 항목에는 `activates: string[]`만 있어 압박·이어 줌·근거 위치를 담을 곳이 없다. 제안:
```ts
touches?: { dimensionId: string; mode: "activate" | "feed" | "press"; via: string[]; ruleId: string }[]
tone?: "support" | "load" | "neutral"
```
`activates`는 지금대로 `mode === "activate"`인 차원 id 목록으로 유지(하위 호환).

---

## 6. MBTI 4축과 차원 — 연구소장 의견 (서비스 모델 가설)

### 6.1 먼저 분명히 할 것
- MBTI와 사주 사이에 상관이 있다는 연구를 연구소장은 **확인하지 않았다**(찾아보지도, 대조하지도 않음). 따라서 아래 대응은 **"운명비서 자기이해 모델의 가설"** 이다. 데이터에는 `claim: "service-model"`을 붙이고, 명리 근거(`evidenceLevel`) 칸에 넣지 않는다.
- 대응의 성격은 **"비슷한 쪽을 가리키는 은유"** 다. 같은 것을 재는 두 도구가 아니다: 사주는 태어난 시점의 글자 구조, MBTI는 지금 스스로 고른 선호다.
- MBTI는 원국·운 계산 입력이 아니다(계약서 §6). MBTI만으로 `developed`를 판정하지 않는다.
- 상표·저작물 메모: "MBTI" 명칭의 상표 사용 범위는 연구소장이 확인하지 않았다 — 화면 표기 전 법무 확인 필요(§9).

### 6.2 대응표 (등급: A = 은유가 비교적 자연스러움, B = 약함·보조 신호로만, — = 대응하지 않음)

| 축 | 고른 극 | high 신호를 주는 차원 | low 신호(※) | 등급 | 연구소장 의견 |
|---|---|---|---|---|---|
| E/I | E | `outward`, `expression` | — | outward A, expression B | 양의 발산·식상의 "밖으로 내놓기"와 "사람·바깥에서 기운을 얻는 선호"가 은유로 닿는다. 그래도 E가 "표현을 잘한다"는 뜻은 아니므로 expression은 B |
| E/I | I | — | `outward` | B | I는 "안에서 기운을 채우는 선호"일 뿐 표현·배움·책임의 많고 적음과 무관. **learning(인성)과 잇지 않는다** |
| S/N | S | `realism` | — | B | "구체·경험 정보 선호"와 재성의 "손에 잡히는 결과 감각"이 은유로 닿는 정도 |
| S/N | N | — | — | — | 편인(직관)·상관(새 발상)과 잇고 싶어지지만, 명리의 "직관"과 MBTI의 "직관(정보 수집 방식)"은 다른 말이다. 대응하지 않고 조언 문체(큰 그림 먼저)에만 쓴다 |
| T/F | T·F | — | — | — | 관살=논리, 식신·정인=감정 같은 대응은 근거도 은유도 약하고 고정관념(냉정/여림)을 만든다. **차원 신호로 쓰지 않는다.** 조언 문체만(T: 이유·기준 먼저, F: 사람에 미치는 영향 먼저) |
| J/P | J | `steadiness`, `duty` | — | steadiness A−, duty B | "계획·마감·정리 선호"와 정관·정재의 규칙·관리 결이 은유로 닿는다 |
| J/P | P | `flux` | `steadiness` | flux B, low B− | "열어 두고 그때그때 맞추는 선호"와 움직임을 타는 결. P가 꾸준하지 않다는 뜻이 아니므로 low는 약하게 |

※ low 신호는 `sure: true`일 때만, 그리고 MBTI 규칙(계약서 §6: MBTI만 있으면 한 단계 낮춤)을 거친 뒤에 쓴다. 반대 극이 자동으로 low를 만드는 양극 대응은 위 표에 적은 두 경우(I→outward, P→steadiness)로만 한정한다.
- `drive`·`edge`·`learning`·`realism`(S 제외)은 MBTI와 대응하지 않는다 — 이 차원들의 자기보고는 설문 사실(§6.4)로만 받는다.

### 6.3 피해야 할 단정 (데이터·문안 금지)
1. 사주로 MBTI를 맞히기: "당신의 사주는 ENFP형이다", "이 사주면 I일 것이다".
2. MBTI로 사주를 확인·반박하기: "E라서 사주가 맞았다/틀렸다", "MBTI가 사주를 바꾼다", "MBTI가 바뀌면 운이 바뀐다".
3. 상관을 사실처럼: "과학적으로 입증된", "검증된 상관", "통계적으로", "연구에 따르면"(근거 문헌 없음).
4. MBTI로 과거·경험을 지어내기: "E니까 친구가 많았겠다", "J라서 직장에서 인정받았을 것이다"(원칙 3).
5. 16유형 ↔ 일간·오행·원형 고정표: "INTJ = 庚금", "ENFP = 봉황" — 만들지 않는다.
6. 고정관념: T=냉정, F=여림, I=소극적, P=게으름, 성별과 엮은 서술.
7. 결여 판정: "I라서 표현력이 없다", "P라서 책임감이 약하다".
8. 궁합·채용·적성 판정에 MBTI–사주 대응을 쓰는 것(이번 범위 밖, 쓰지 않음).

### 6.4 사용자 사실(UserFact) → 차원 (lived-link와 맞춘 제안)
`lived-link.ts` `VALUE_GROUP`의 묶음 대응을 그대로 차원으로 옮기고(§1.2 철자 변환), 묶음이 없는 것만 추가했다. **이것도 서비스 모델(설계)이다.**

| 사실(questionId:value) | 차원 · 신호 | 출처 | 종류 |
|---|---|---|---|
| selfStrength:persistence | drive high | lived-link(bigeop) | 기질 |
| selfStrength:communication | expression high | lived-link | 기질 |
| selfStrength:creativity | expression high | lived-link | 기질 |
| selfStrength:planning | duty high, steadiness high | lived-link(gwanseong) + 추가 | 기질 |
| selfStrength:caring | learning high | lived-link(inseong) — ⚑ tengods.yaml은 식신에도 "돌보는 마음"을 둠, 1차는 lived-link를 따름 | 기질 |
| selfStrength:learning | learning high | lived-link | 기질 |
| selfStrength:decisiveness | drive high | 추가 | 기질 |
| workStyle:solo_deep | learning high | lived-link | 기질 |
| workStyle:team | drive high | lived-link(bigeop) | 기질 |
| workStyle:people_facing | expression high | lived-link | 기질 |
| workStyle:leading | duty high | lived-link(gwanseong) | 기질 |
| selfWeakness:saving | realism low | lived-link(jaeseong) | 기질 |
| occupationStatus:* · recentChanges:* · lifeEvents:* | lived-link 대응 그대로 | lived-link | **상황** |

- ⚑ 연구소장 권고: **"상황 사실"(직업 상태·최근 변화·지난 일)만으로는 `developed`를 내지 말 것.** "직장에 다녀요"는 대다수 응답자에게 해당해 `duty developed`가 과다하게 나온다. `developed`는 **기질 사실(selfStrength·workStyle) 1개 이상**이 같은 방향일 때만 — 상황 사실은 보강 신호로만. (계약서 §6 "UserFact 1개 이상"의 구체화 — 총괄실장 판단)
- 약점 문항은 low 신호로 함부로 쓰지 않는다. `saving` 하나만 lived-link 대응을 따라 realism low로 두고, 나머지(indecision·worry 등)는 차원에 잇지 않는다(원인 단정 금지, survey.ts `selfWeakness.usage`).

---

## 7. 상충·불확실 처리

### 7.1 시주 모름 — 차원별 민감도

시주는 T 10.5 중 2.0(천간 1 + 지지 1, 19%)을 차지하고, 시간(時干)은 투출 자리 셋 중 하나다. 그래서 **존재 상태(presence)가 바뀌는 차원**이 가장 크게 흔들린다.

| 차원 | 민감도 | 이유 |
|---|---|---|
| `flux` | **높음** | 관계 1~2개로 판정. 시지는 일지와 붙어 있어 충·형이 자주 생긴다(§4 예시: strong → faint) |
| `outward` | **높음** | 8글자 중 2글자가 바뀌어 비율이 최대 ±0.25 움직인다 |
| `expression`·`realism`·`duty`·`learning` | 중~높음 | 시간 투출 하나로 hiddenOnly ↔ stemAndHidden, 시지 지장간 하나로 absent ↔ hiddenOnly가 바뀐다(§4 예시: expression moderate → faint) |
| `drive` | 중 | 위와 같음 + 일간 세력 보정이 시주에 따라 바뀜(`strength.hourSensitivity`) |
| `steadiness`·`edge` | 중 | 두 글자분 가중이 비율 0.30·0.12 문턱을 넘나든다 |
| 월령(M)으로 strong이 된 묶음 | 낮음 | 월지 가중 3.0이 지배 — 시주로 잘 안 바뀐다 |

절차(`exp.sens.hour`, 원형 엔진 D-030과 같은 방식):
1. 시주를 모르면 **세 기둥 결과를 판정값**으로 쓴다(평균·다수결로 바꾸지 않음).
2. `hourPillarsOf(dayMaster.stem)`(규칙 엔진 공개 함수)로 12시진 시주를 하나씩 넣어 `analyzeRules`를 다시 돌리고(같은 옵션·같은 운), 차원 level을 다시 계산해 **차원별 `hourStable: x/12`**(세 기둥 level과 같은 시진 수)와 나온 level 목록을 기록한다. 원형 엔진의 12시진 재계산 결과를 같이 쓸 수 있으면 재사용한다.
3. 시진에 따라 level이 2가지 이상 나오면 `conflicts`에 `{ dimensionId, kind: "missing", note: "태어난 시각에 따라 이 기질의 세기가 달라질 수 있음 (x/12)" }`.
4. **`dormant`·`developed` 판정에는 `hourStable ≥ 8/12`를 요구**(권고). 미만이면 status는 계산하되 문안은 반드시 "태어난 시각을 알면 달라질 수 있다"를 붙이고, 그 차원을 `untappedPotential`·`developedAbility` 장의 대표 항목으로 고르지 않는다.

### 7.2 신강약 경계
- `A.nearBoundary === true`, `strength.agreement === "split"`, `strength.tableSensitive === true` 중 하나라도 참이면: drive 보정(§3.2) 안 함, load·surplus 메모(§3.10) 안 함, 운 tone(§5.5) neutral. `basis`에 `exp.sens.boundary` 메모("힘의 세기가 경계 근처라 보는 방식에 따라 달라질 수 있음").
- 극단(`A.extreme`)이어도 묶음 level은 그대로 계산한다. 극신약 drive −1만 적용.

### 7.3 지장간 표 민감도 (`exp.sens.table`)
- 판정은 kr-monthly-30 고정. cn-lunarjs로 한 번 더 계산해 level이 다른 차원을 기록만 한다(고객 화면 비노출, 원형과 같은 방침).
- 특히 흔들리는 곳: 子·卯·酉(kr 표에만 여기 壬·甲·庚이 있음)와 午·亥(cn 표에는 여기 丙·戊가 없음). 이 글자가 그 묶음의 유일한 지장간이면 presence가 바뀐다. 정·편 비중(steadiness·edge)도 子(壬 편/정 구분)·酉에서 크게 움직인다.
- 계약서 `conflicts.kind`에는 "원국 판정 자체가 불확실"을 담을 종류가 없다 → **`"chart-uncertain"` 추가를 제안**(시주 모름·표 민감·경계 근처 공통). 승인 전에는 `"missing"`에 메모로 담는다.

### 7.4 격 변형
- `pivot`이 있는 주 후보의 `variantAgreement === "differs"`(투출 우선 G2 ↔ 정기 고정 G2' 결과가 다름)면 M은 두 묶음 모두에 준다(§2.2). basis 메모 "태어난 달의 주된 기운을 보는 방식이 두 갈래".

### 7.5 특수격 후보
- `structure.candidates`에 `kind === "special"`이 있으면 load·surplus 메모를 달지 않는다(§3.10). level 판정 규칙은 그대로.

### 7.6 합·충의 보정
- 합거(합으로 묶여 일을 못 한다)·합화(합해서 오행이 바뀐다)·충으로 뿌리가 뽑힌다는 설이 있으나 1차는 **어느 것도 level에 반영하지 않는다**(규칙 엔진도 `combineAdjustment: "none"`, 합화 `transformed: null`). 반영하려면 규칙 엔진 쪽 판정이 먼저 필요하다.

### 7.7 쓰지 않는 엔진 값과 이유
| 값 | 이유 |
|---|---|
| 12운성(`twelveStages`) | 음간 처리(`twelveStagesYin`)·토 처리(`earthStages`) 학파 옵션에 따라 단계가 바뀐다. 규칙 엔진도 신강약 점수에 넣지 않는다. basis 메모로만 허용 |
| 공망(`gongmang`) | 기질과 잇는 통설이 약하고 기준 기둥(일주/연주) 옵션이 갈린다 |
| 신살 | 규칙 엔진에 없다. 역마·도화 같은 이름으로 flux·outward를 보강하지 않는다 |
| 용신 오행 자체 | 차원 level에는 쓰지 않는다(용신은 "필요한 것"이지 "타고난 기질"이 아님). 운 tone(§5.5)에만 |

### 7.8 차원 간 겹침
- steadiness·edge는 핵심 다섯과 같은 글자를 다시 센다. `outward`는 `expression`과 은유가 닿는다. 문안에서 같은 근거로 두 차원을 각각 "강점"으로 두 번 말하지 않게, `sections` 대표 항목을 고를 때 **같은 basis 위치를 공유하는 차원은 하나만** 고르는 규칙을 권고한다.
- 핵심 다섯 중 둘 이상이 strong일 수 있고, 하나도 strong이 아닐 수도 있다(고른 원국). "strong이 없다 = 특징이 없다"가 아니다 → 고른 원국은 "치우치지 않은 판"으로 서술.

---

## 8. 구현자·품질검증에 요청

1. **분포 측정**(QA, 무작위 1만 건·시주 있음/없음 각각): 차원별 strong/moderate/faint 비율. 연구소장 목표(설계): 핵심 차원 각 strong 15~35%, faint 15~40%. 벗어나면 문턱값(0.24/0.18/0.12/0.15, 0.30/0.12, flux·outward 문턱)을 `dimensions.json`에서 조정하고 판 번호를 올린다 — 조정은 연구소장 검수 후.
2. **시험 사례**: §4 예시(시주 있음/없음 두 판), 그리고 각 규칙 줄(L1~L4)·보정(drive ±1, edge clarity)·경계 차단(§7.2)이 한 번씩 걸리는 합성 원국. 손계산 기대값은 엔진 결과로 먼저 확인 후 고정.
3. **불변 시험**: `RuleAnalysis`가 같으면 차원 level이 같다(MBTI·설문과 무관). 옵션 `strengthPrimary`를 바꿔도 level이 같다(모형 A 고정).
4. **금지어 시험**: §6.3의 표현이 `dimensions.json`·문안 틀에 없을 것.
5. `content/expression/dimensions.json` 검수 기준: 차원 id·label·문턱값·십성 집합·운 대응표가 이 문서와 같을 것, MBTI 대응 행마다 `claim: "service-model"`과 등급(A/B), `evidenceLevel`은 차원 행에만 "L0".

---

## 9. 근거 확인 현황 · 학파 충돌 · 결정 필요

### 9.1 근거 확인 현황
| 항목 | 등급 | 비고 |
|---|---|---|
| 십성 다섯 묶음의 작용 요지(1~5) | L0 | entries/tengods.yaml·gaeun.md §1.3과 같은 수준 |
| 투출·통근·월령 중시 | L0 | 통설(요지). 문턱값은 설계 |
| 순용·역용 구분(6·7의 배경) | L0 | 자평진전 계열로 알려진 요지 — 원문 미대조. 성격 이론으로 넓힌 것은 현대 통설 + 설계 |
| 충 = 움직임(8) | L0 중 약 | 대중 풀이 읽기 + 설계 |
| 음양·한난 = 발산(9) | L0 중 가장 약 | 대중 풀이 읽기 + 설계 |
| 운 생극 대응(§5.2) | L0 | 오행 생극 기본 틀 |
| MBTI 대응(§6) | 근거 없음 | 서비스 모델 가설(`claim: "service-model"`) |
| 고전 원문 인용 | 0건 | — |

### 9.2 학파 간 충돌 (이 문서에서 옵션으로 둔 것)
| 쟁점 | 갈래 | 기본 |
|---|---|---|
| 지장간만 있는 월령 기운의 상한 | moderate까지 / strong 가능 | moderate (`hiddenMonthCanBeStrong: false`) |
| 편재의 결 | 순용(고른 쪽) / 확장(센 쪽) / 넣지 않음 | 넣지 않음 (`pyeonjaeSide: "none"`) |
| 합이 충을 푸는가 | 푼다 / 안 푼다 | 반영 안 함 |
| 대운 천간·지지 비중 | 통째 / 반분 / 지지 중시 | 통째(gaeun `luckHalves`를 따름) |
| 양인을 따로 볼지 | 겁재 전체 / 양인만 센 쪽 | 겁재 전체 |
| 지지 음양(子午巳亥) | byMainQi / byOrder | 엔진 옵션을 그대로 따르고 기록 |

### 9.3 총괄실장·대표 결정 필요
1. **`lived-link.ts` 철자(`bigeop`·`gwanseong`) 통일 여부** — 개인화 연구원 파일. 통일 전에는 발현 엔진에 변환표.
2. **설문 문서와의 충돌 정리**: `survey.ts` MBTI 문항 `usage`("사주와 맞다/틀리다를 판정하지 않는다. 기질 판단 근거로 쓰지 않는다")와 `lived-life.md` §1 `selfStrength`("일치/불일치 판정 금지")가 D-035의 비교 구조(발현·미활용 추정)와 문구상 부딪친다. 발현 엔진은 "맞다/틀리다"가 아니라 "추정(inferred)"이므로 취지는 지켜지지만, 두 문서의 문구를 D-035에 맞게 고칠지 총괄실장 판단이 필요하다(연구소장은 해당 파일을 수정하지 않았다).
3. 계약서 보완: `luck.touches`·`luck.tone`(§5.8), `conflicts.kind: "chart-uncertain"`(§7.3).
4. `developed`에 기질 사실을 요구하는 권고(§6.4) 채택 여부.
5. "MBTI" 명칭의 화면 표기 — 상표 사용 범위 법무 확인(연구소장 미확인).
6. 용신 표시 방식(대표 결정 대기 6번)이 정해지면 §5.5 운 tone 규칙을 그에 맞춰 다시 본다.
