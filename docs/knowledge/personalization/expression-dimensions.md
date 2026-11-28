# 사주 발현 분석 — 기질 차원과 원국 판정 규칙 [제안]

> 작성: 명리학 연구소장 · 2026-11-28 · 상태: **제안**(총괄실장 검토 → 개인화 분석 연구원 구현 → 품질검증 독립 검증)
> 계약서: [docs/redesign/30-expression-engine.md](../../redesign/30-expression-engine.md)(D-035) · 입력: `RuleAnalysis`(rules@0.4.0, `src/engine/rules/types.ts`)
> 문서 판: **`expression-dimensions@0.2.0`** — 표의 문턱값을 바꾸면 판 번호를 올리고 구현 쪽 `dimensions.json`·`mbti-bridge.json`과 함께 바꾼다.
>
> **먼저 읽을 전제 다섯 가지**
> 1. **고전 원문 인용 0건, 원문 대조(L2) 0건**(감사 보고 `docs/reports/2026-11-28_knowledge-source-audit.md`). 이 문서의 명리 서술은 모두 **요지(paraphrase)** 이며 근거 등급은 **L0**(통설·기억, 출처 미확인)이다. 문턱값·가중·차원 구성은 **설계**(연구소장이 이번에 정한 값, 고전 근거 없음)다. 계약서 `evidenceLevel`은 전 차원 `"L0"`.
> 2. 기질 "차원"은 **전통 명리의 공식 분류가 아니다.** 십성·오행·관계 같은 엔진 값을 운명비서의 자기이해 모델로 묶은 것이다.
> 3. 명리 해석은 과학적으로 입증된 예측이 아니다. 차원 level은 "타고난 경향으로 읽을 수 있는 정도"이지 능력·성공의 측정값이 아니다.
> 4. MBTI–차원 대응(§6)은 **검증된 상관이 아니라 서비스 모델의 가설**이다. 명리 근거로 포장하지 않는다.
> 5. §4 계산 예시는 연구소장 손계산이다. 0.1.0 예시는 품질검증 독립 재구현·엔진과 일치했다(`docs/quality/2026-11-28_expression-engine-verify.md` 3-a). **0.2.0에서 새로 쓴 `grain` 줄은 아직 엔진 확인 전**이다.

## 개정 이력

| 판 | 날짜 | 바뀐 것 | 계기 |
|---|---|---|---|
| 0.1.0 | 2026-11-28 | 첫 판(9차원) | D-035 |
| **0.2.0** | 2026-11-28 | ① 결 차원 `steadiness`·`edge` 두 개 → **한 축 `grain`(양극)** 으로 합침, 9 → **8차원**(§3.7) ② 경계 차단 때 drive **+1·−1 모두 끔**으로 확정(§3.2·§7.2) ③ MBTI 대응표 재정리 — 신호 3줄(E→outward, J·P→grain)만 남기고 나머지는 문체 힌트 또는 삭제, "MBTI는 low를 만들지 않는다"·"확신 없음은 힌트만" 규칙(§6.2) ④ 시주 모름 분포 의견과 처리(§7.1) ⑤ 운 출력 이름을 확정 계약서에 맞춤(`how: activate/bridge/press`, `tone: favorable/burden/neutral`, `chart-uncertain`) ⑥ 운 tone 두 글자 결합·세 글자 관계의 flux 귀속 규칙 명시(§5.4·§5.5, QA S4) | QA 검증 B3·B4·B5·S4, 총괄실장 질의 |

---

## 0. 설계 원칙

| 원칙 | 내용 |
|---|---|
| 엔진 값만 읽는다 | 판정 재료는 `RuleAnalysis`가 이미 낸 값과, 거기서 **산수로만** 얻는 파생값(§2.2)이다. 발현 엔진은 새 명리 판단(합화·신살·성패 등)을 만들지 않는다. `RuleAnalysis`는 MBTI·설문과 무관하게 같은 값이다(계약서 §3). |
| 모형 A 고정 | 신강약·묶음 합계는 `strengthPrimary` 옵션과 관계없이 **모형 A(weighted)** 를 쓴다. 신성 원형(02-archetypes §1)과 같은 방침 — 옵션을 바꿔도 차원이 흔들리지 않게 한다. |
| 지장간 표 고정 | 차원 판정은 `hiddenStemTable: "kr-monthly-30"`으로 계산하고, 다른 표 결과는 기록만 한다(D-030 원형 방침과 같음, §7.3). |
| 같은 개념은 한 정의 | 십성 묶음 이름·투출·통근·존재 상태는 규칙 엔진 정의를 그대로 쓴다(§1.2 맞춤표). 새 철자·새 정의를 만들지 않는다. |
| 판정은 단계로만 | 내부 점수는 쓰되 화면·AI 입력에는 `strong / moderate / faint` 세 단계(+ `grain`만 방향 `lean`)를 보낸다(계약서 §5). |
| 근거는 반드시 남긴다 | 모든 level에는 `basis`(ruleId·위치·메모)가 최소 1개 있다. 원국에 없는 차원(faint)도 "없음" 근거를 남긴다(§3.1 L1). |
| 좋고 나쁨을 매기지 않는다 | faint는 "결함"이 아니라 "그 쪽 글자가 원국에서 옅다"는 뜻이다. 문안은 "옅다 → 채워라"를 기계적으로 쓰지 않는다(gaeun.md §1.3 감수 P1과 같은 주의). |
| 사람 사이 차이를 보여 줘야 한다 | 한 차원의 strong이 10명 중 6명에게 나오면 누구에게나 맞는 말(바넘 효과)이 된다. 차원마다 strong 15~35%, faint 15~40%를 목표로 한다(§8). |

---

## 1. 기질 차원 목록 (8개)

### 1.1 목록

| # | id | 쉬운 이름 | 한 줄 설명(갑·을을 몰라도 읽히게) | 갈래 | 주 재료 |
|---|---|---|---|---|---|
| 1 | `drive` | 내 힘으로 서는 힘 | 남에게 기대기보다 내 판단으로 버티고 밀고 나가는 힘 | 핵심 | 비겁 묶음 + 일간 세력 |
| 2 | `expression` | 꺼내 보여 주는 힘 | 속에 든 생각·재주를 말·글·손으로 밖에 내놓는 힘 | 핵심 | 식상 묶음 |
| 3 | `realism` | 현실로 옮겨 손에 쥐는 힘 | 생각을 결과·돈·살림 같은 손에 잡히는 것으로 바꾸는 감각 | 핵심 | 재성 묶음 |
| 4 | `duty` | 책임지고 틀을 지키는 힘 | 약속·마감·규칙 안에서 맡은 몫을 해내려는 힘 | 핵심 | 관살 묶음 |
| 5 | `learning` | 받아들이고 익히는 힘 | 배우고, 도움을 받고, 생각을 깊이 쌓는 힘 | 핵심 | 인성 묶음 |
| 6 | `grain` | 일을 풀어 가는 결 | 차근차근 고르게 다지는 쪽인지, 틀 밖으로 세게 밀고 나가는 쪽인지 — **한쪽으로 얼마나 기울었나** | 결(양극) | 정재·정관·정인·식신 ↔ 편관·상관·편인·겁재의 비중 |
| 7 | `flux` | 변화를 타는 힘 | 자리·관계·계획이 자주 움직이는 판에서 움직임을 타는 힘 | 보조 | 원국 충·형 |
| 8 | `outward` | 밖으로 펼치는 기운 | 기운이 안으로 갈무리되기보다 밖으로 퍼지는 정도 | 보조 | 음양 비율 + 한난 |

- **핵심(1~5)**: 십성 다섯 묶음과 1:1. 근거가 가장 단단한 쪽(오행 생극 관계는 명리의 기본 틀, L0).
- **결(6)**: 같은 묶음 안에서도 "고른 쪽 / 센 쪽"을 가르는 가로축. 0.1.0의 `steadiness`·`edge`를 **양극 축 하나**로 합쳤다(이유 §3.7). 이 차원만 level과 함께 방향 `lean: "steady" | "edge" | "balanced"`를 낸다.
- **보조(7·8)**: 대중 풀이에서 흔히 쓰는 읽기지만 근거가 가장 약하다(L0 중 약). 문안에서는 핵심 차원보다 뒤에, 더 조심스럽게 쓴다. `innateEssence` 장의 대표 기질로는 핵심 → 결 → 보조 순으로 고른다.
- 0.1.0 id `steadiness`·`edge`는 **폐지**한다(저장된 결과·시험이 있으면 구현자가 판 번호로 구분).

### 1.2 같은 개념 맞춤표 (모듈 간)

| 묶음 | rules `TenGodGroup` (`src/engine/rules/types.ts`) | archetype `TEN_GOD_GROUP` | content `TEN_GOD_GROUP` (`gaeun.ts`) | personalize `TenGodGroup` (`lived-link.ts`) | 발현 차원 |
|---|---|---|---|---|---|
| 비견·겁재 | `bigyeop` | `bigyeop` | `bigyeop` | **`bigeop`** | `drive` |
| 식신·상관 | `siksang` | `siksang` | `siksang` | `siksang` | `expression` |
| 편재·정재 | `jaeseong` | `jaeseong` | `jaeseong` | `jaeseong` | `realism` |
| 편관·정관 | `gwansal` | `gwansal` | `gwansal` | **`gwanseong`** | `duty` |
| 편인·정인 | `inseong` | `inseong` | `inseong` | `inseong` | `learning` |

- ⚑ **`lived-link.ts`만 철자가 다르다**(`bigeop`·`gwanseong`). 발현 엔진은 **rules 철자**(`bigyeop`·`gwansal`)를 기준으로 쓰고, lived-link 값을 읽을 때는 명시적 변환표(`bigeop→bigyeop`, `gwanseong→gwansal`)를 둔다. 세 번째 철자를 만들지 않는다.
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
| `presence[g]` | `touchul`·`hiddenAt`이 각각 비었는지로 `"stemAndHidden" / "stemOnly" / "hiddenOnly" / "absent"` | 규칙 엔진 `StructureGroupRef.presence`(§2.3)와 **같은 규칙**. 묶음은 오행으로 정해지므로 `stemAndHidden` = **투출+통근**과 같다(rooted 모형의 `hasRoot`와 같은 기준: 오행 일치, 역할 무관) |
| `M[g]` (월령) | (a) `tenGods`의 `{pillar:"month", viaHiddenStem:"jeonggi"}` 항목의 묶음이 g, **또는** (b) `struct` 중 `role === "primary"`이고 `pivot`이 있는 후보의 `TEN_GOD_GROUP[pivot.tenGod] === g` | (b)는 투출 우선(G2)으로 여기·중기가 격을 잡은 경우를 포함한다. (a)와 (b)가 다르면 **두 묶음 모두** M |
| `tgT[tg]` | 십성별 가중 합 = Σ `A.basis[i].points` (단 `group !== "self"`), 십성은 `tenGodOfStem(dayMaster.stem, basis[i].char)` | 규칙 엔진 공개 함수 사용. Σ = Σ`G` |
| `flavor[g]` | 묶음 g의 두 십성 중 한쪽 `tgT` ≥ `G[g]` × 2/3이면 그 십성, 아니면 `"mixed"`, `G[g] = 0`이면 없음 | 내용 서술용 "결" 메모(§3.10). level에는 쓰지 않는다 |

- ⚑ **지지 자체 항목은 십성 판정에 쓰지 말 것.** `tenGods`의 `{part:"branch", viaHiddenStem 없음}` 항목은 `branchYinYang` 옵션을 따라 子·午·巳·亥에서 십성이 정기 천간과 달라질 수 있다(rules-spec §2). 묶음(오행)은 같지만 **십성 단위(§3.7)에서는 지장간 항목 또는 `A.basis`만** 쓴다.

### 2.3 위치 문자열 형식 (`basis.positions`)
`gaeun.ts`의 `posStr`와 같게 쓴다: 천간 `"year.stem"`, 지장간 `"month.branch.jeonggi"`, 지지 자체 `"day.branch"`, 대운 `"daeun[3].stem"`(**1부터** 센 번호), 세운 `"seun.branch"`.

---

## 3. 차원별 판정 규칙

### 3.1 공통 묶음 규칙 `exp.lv.group.v1` (핵심 차원 1~5) — 0.1.0과 같음

묶음 g의 level은 위에서부터 처음 맞는 줄로 정한다.

| 순서 | 조건 | level | ruleId | basis 메모 |
|---|---|---|---|---|
| L1 | `presence[g] === "absent"` | faint | `exp.lv.absent` | "원국 천간·지장간 어디에도 없음"(positions 빈 배열 허용, basis 항목은 필수) |
| L2 | `presence[g] === "hiddenOnly"` | `gs[g] ≥ 0.12` 또는 `M[g]` → **moderate**(상한), 그 밖 → faint | `exp.lv.hiddenOnly` | `latent: true` — "지장간에만 있음(드러나지 않은 잠재)" |
| L3 | `presence[g] === "stemOnly"` | `gs[g] ≥ 0.15` → **moderate**(상한), 그 밖 → faint | `exp.lv.stemOnly` | `floating: true` — "천간에 드러났으나 받쳐 주는 뿌리가 없음" |
| L4 | `presence[g] === "stemAndHidden"` | `gs[g] ≥ 0.24` 또는 (`M[g]` 그리고 `gs[g] ≥ 0.18`) → **strong**, 그 밖 → moderate | `exp.lv.rooted` | "드러나 있고 뿌리도 있음" + M이면 "월령(태어난 달의 주된 기운)" |

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

- 측정 결과(QA 1만 건, 시주 있음): 다섯 차원 모두 strong 22~24%·faint 32% — 목표 범위 안. **문턱 유지.**

**왜 이렇게 나눴나 (요지·설계)**
- 명리 통설(L0): 지지 속(지장간)의 기운은 "숨은 기운", 천간에 드러나면(투출) "쓰이는 기운", 드러난 글자가 지지에 뿌리를 두면(통근) "힘이 실린 기운"으로 본다. 태어난 달의 지지(월령)가 원국에서 가장 무겁다는 것도 통설이다. → 투출+통근(L4)만 strong이 될 수 있게, 숨기만 했거나(L2) 뜨기만 한(L3) 기운은 moderate까지로 묶었다.
- 월령은 weighted-v1이 이미 월지에 3.0을 주므로 점수에 한 번 들어가 있다. M은 **strong 문턱을 0.24 → 0.18로 낮추는 데만** 쓴다(이중 가산을 줄이기 위함, 설계).
- ⚑ 학파 차이: **월지 정기가 투출하지 않아도 격을 이룬다**는 쪽(정기 고정, G2')에서는 L2 + 월령이 strong이어야 한다고 볼 수 있다. 1차 기본은 상한 moderate. 옵션 `hiddenMonthCanBeStrong: false`(기본) / `true`로 예약한다.

### 3.2 `drive` — 내 힘으로 서는 힘
- **재료**: 공통 규칙(g = `bigyeop`) + 일간 세력 보정.
- **보정** `exp.mod.drive.v1`(공통 규칙 결과에 적용, 한 단계씩, 최대 strong·최소 faint). **경계 차단(§7.2)이면 +1·−1 모두 하지 않는다**(0.2.0 확정 — 엔진 현행 동작이 맞다).
  - +1: `A.verdict === "신강"` 그리고 `G.bigyeop ≥ G.inseong`(비겁형, 원형 `tg.supportType`과 같은 동점 규칙).
  - −1: `A.extreme === "weak"`(극신약).
  - 보정을 했으면 basis에 `{ ruleId: "exp.mod.drive.v1", positions: [], note: "일간 세력(모형 A r=…)" }`를 남긴다.
  - 확정 이유(한 줄): 차단 세 조건(경계 근처·모형 갈림·표 민감)은 극단 판정 자체(r ≤ 0.20, 표마다 `extreme` 비교)도 흔들리는 경우라, 불확실한 극단으로 level을 내리지 않는다.
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

### 3.7 `grain` — 일을 풀어 가는 결 (양극 축) `exp.lv.grain.v1` — 0.2.0 재설계

#### 3.7.1 왜 하나의 축으로 합쳤나 (QA B4에 대한 연구소장 판단)
- **측정**(QA 1만 건, 시주 있음): 0.1.0의 `steadiness` strong 59%, `edge` strong 65%, faint 2~3.5%, 둘 다 strong 32%. 두 집합이 십성 10개 중 8개를 나눠 가져 두 비율의 합이 거의 늘 0.6~0.75다. 그래서 절대 비율은 "그 사람의 결"보다 "비견·편재(어디에도 안 넣은 두 십성)가 얼마나 적은가"를 더 많이 반영하고, 두 차원은 서로 반대로 움직인다.
- **명리적으로 (나) 비율 축이 맞다.** 정(正)·편(偏)은 본래 **상대 개념**이다 — 같은 오행 안에서 일간과 음양이 다르냐 같으냐로 가르는 쌍이고, 옛 격국론의 "순하게 쓰는 쪽 / 다루어 쓰는 쪽" 구분(요지, L0, 원문 미대조)도 한 원국 안에서 어느 쪽이 주도하느냐를 보는 틀이다. "고른 쪽이 많다"와 "센 쪽이 많다"를 따로 재서 둘 다 strong이라고 말하는 것은 이 개념과 맞지 않는다. 의미가 있는 값은 **두 쪽의 기울기**다.
- (가) 문턱만 올리기(strong ≥ 0.45·faint < 0.25)는 분포는 맞추지만, 남는 정보가 여전히 "한 축의 양 끝 + 비견·편재 양"이고 같은 기울기를 두 차원에서 두 번 말하게 된다. → **(나) 채택.** (가)는 계약 보완이 승인되지 않을 때만 쓰는 임시안(§3.7.6).

#### 3.7.2 판정
```ts
const STEADY = ["정재", "정관", "정인", "식신"]
const EDGE   = ["편관", "상관", "편인", "겁재"]          // 비견·편재는 어느 쪽에도 넣지 않음(§3.7.4)
const S = sum(tgT[tg] for tg in STEADY), E = sum(tgT[tg] for tg in EDGE)
if ((S + E) / T < 0.30) → { level: "faint", lean: "balanced", ruleId: "exp.lv.grain.thin" }   // 결을 가를 글자가 적음
const q = round6(S / (S + E))                            // 0 = 전부 센 쪽, 1 = 전부 고른 쪽
const d = round6(Math.abs(q - 0.5))
const lean = d < 0.07 ? "balanced" : q > 0.5 ? "steady" : "edge"
const SET = lean === "steady" ? STEADY : EDGE
const shown = tenGods.some(h => natalStem(h) && SET.includes(h.tenGod))   // 기운 쪽 십성이 연·월·시 천간에 투출
let level = d < 0.07 ? "faint" : d >= 0.20 && shown ? "strong" : "moderate"
// 승격(exp.mod.grain.clarity): lean === "edge" && level === "moderate" && flags에 "상관견관"·"효신탈식"·"관살혼잡" 중 하나 → "strong"
```

| level | 뜻 | lean |
|---|---|---|
| strong | 한쪽으로 뚜렷이 기울었고(`d ≥ 0.20`, q ≤ 0.30 또는 ≥ 0.70) 그쪽 글자가 천간에 드러나 있음 | `steady` 또는 `edge` |
| moderate | 한쪽으로 기울었으나 뚜렷하지 않음(0.07 ≤ d < 0.20) 또는 뚜렷하지만 드러나지 않음 | `steady` 또는 `edge` |
| faint | 두 결이 고름(d < 0.07, 0.43 < q < 0.57) 또는 가를 글자가 적음 | `balanced` |

- **faint의 뜻이 다른 차원과 다르다**: `grain`의 faint는 "옅다"가 아니라 **"두 결을 고르게 쓰는 판"** 이다. 문안 틀에 이 차이를 반드시 넣는다(콘텐츠 작가 전달).
- 문턱(0.07·0.20·0.30)은 QA 분위수(steadiness 비율 p25 0.260·p50 0.354·p75 0.446, edge p25 0.270·p50 0.359·p75 0.451, 합 0.6~0.75)에서 q의 퍼짐을 **추정해 잡은 설계값**이다. 목표: strong(양쪽 합) 15~35%, faint 15~40%, strong 안에서 steady·edge 어느 쪽도 1/3 아래로 쏠리지 않을 것. 실측 후 `dimensions.json`에서 조정(§8).
- 승격이 edge 쪽에만 있는 비대칭은 0.1.0과 같다(청탁 표지가 모두 "센 글자끼리의 긴장"을 가리키므로). 0.1.0 측정에서 승격 비율 3.7% — strong 쏠림이 edge로 심하면 승격을 끄는 쪽으로 조정한다.

#### 3.7.3 근거와 한계
- 옛 격국론의 순용·역용 구분(요지, **L0, 원문 미대조**)은 **용신을 다루는 방법**에 관한 것이지 성격 이론이 아니다. 현대 교재는 이를 "정은 고르고 편은 세다"는 성격 읽기로 넓혀 쓴다(L0 현대 통설). 이 차원은 그 현대 읽기를 서비스 모델로 빌린 **설계**다.
- ⚑ **음양으로 기계적으로 나누면 안 된다**: 일간과 음양이 같은 쪽(비견·식신·편재·편관·편인) / 다른 쪽(겁재·상관·정재·정관·정인)으로 가르면 식신이 "센 쪽", 상관이 "고른 쪽"이 되어 통설과 거꾸로다. 그래서 집합을 이름으로 고정했다.
- 명리상 겁재의 "센" 면은 특히 양간의 양인(刃)에서 말해지지만, 1차는 겁재 전체를 넣는다(양인 판정은 12운성 옵션에 기대므로, §7.7).
- 서비스 해석에서 `edge`를 "흉하다·위험하다"로 쓰지 않는다. "센 힘이라 쓸 자리와 쉴 장치가 있으면 큰 추진력이 된다", `steady`를 "답답하다"로 쓰지 않는다. 옛 사흉신·사길신 표현은 걷어 낸다.

#### 3.7.4 학파 차이
- **편재**: 옛 구분에서는 재성 전체(정재·편재)가 순용 쪽이지만, 현대 성격 읽기에서는 편재를 "확장·변동" 쪽으로 본다. 1차는 **어느 쪽에도 넣지 않는다**(설계 타협). 옵션 `pyeonjaeSide: "none"`(기본) / `"steady"` / `"edge"` 예약.

#### 3.7.5 자기보고와의 비교 (양극 차원 전용 규칙 — 구현자 반영 필요)
계약서의 상태(expressed·developed·dormant·quiet·unknown)는 한 방향 차원을 전제로 한다. `grain`은 **자기보고도 방향(selfLean)으로 받은 뒤, 원국 방향에 대해 상대 신호로 바꿔** 같은 상태 표에 넣는다.
1. selfLean: 사실·MBTI 신호(§6.2·§6.4)의 합 s(steady +, edge −). `s ≥ 0.5` → steady, `s ≤ −0.5` → edge, 그 밖 none. 사실과 MBTI가 반대면 사실만 쓰고 self-vs-self 기록(현행 규칙과 같음).
2. 상대 신호:
   | 원국 lean | selfLean 같은 쪽 | selfLean 반대쪽 | selfLean none |
   |---|---|---|---|
   | steady / edge | `high` | 사실이 근거면 `low`, **MBTI만이면 `none`** + conflicts `chart-vs-self` 메모("본인은 반대 결로 느낌") | `none` |
   | balanced | `high`(원국은 고른데 본인은 한쪽으로 기움) | — | `none` |
3. 그 뒤 상태 판정은 다른 차원과 같은 표·같은 제한(MBTI만으로 developed 금지, 기질 사실 필요, 시주 안정도 8/12)을 쓴다.
4. 출력: `ChartPotential.lean`, `DimensionReading.self.lean`(선택 필드, `grain`에만) — **계약 보완 필요**(§9.3).

#### 3.7.6 임시안 (계약 보완이 승인되지 않을 때만)
`steadiness`·`edge` 두 id를 유지하되 각각 절대 비율로 strong ≥ 0.45(투출 조건 유지)·faint < 0.25. 둘 다 strong은 거의 사라지지만 **같은 기울기를 두 번 말하는 문제는 남는다** — 문안에서 둘 중 strong인 쪽만 쓰고, 다른 쪽 faint는 서술하지 않는 규칙을 함께 둔다. 연구소장 권장은 아니다.

### 3.8 `flux` — 변화를 타는 힘 (보조) `exp.lv.flux.v1` — 0.1.0과 같음
```ts
const R = interactions.filter(i => i.scope === "natal" && !(i.subsumedBy?.length))
const moving = R.filter(i => i.type === "clash" || i.type === "stemClash" || (i.type === "punishment" && !i.partial))
const keyClash = moving.some(i => i.type === "clash" && i.members.some(m => m.part === "branch" && (m.pillar === "month" || m.pillar === "day")))
level = keyClash && moving.length >= 2 ? "strong" : moving.length >= 1 ? "moderate" : "faint"
```
- 세는 것: 지지 충, 천간 충, 형(**두 글자 부분 삼형 `partial: true`는 제외**). **세 글자 관계에 포함된 두 글자 기록(`subsumedBy`)은 뺀다**.
- 세지 않는 것: 파·해(gaeun.md §1.5 "1차 사용 안 함"과 맞춤), 합(§7.6).
- 고전 요지(L0): 충은 부딪쳐 움직이게 하는 관계, 월지·일지의 충은 사는 자리·일터 바탕의 변동으로 읽는다. 이것을 "움직임을 타는 기질"로 옮기는 것은 현대 대중 풀이의 읽기(L0 중 약) + 설계.
- ⚑ 학파 차이: 합이 충을 풀어 준다는 설 — 1차 미적용.
- 서비스 금지: 충을 이별·사고·수술로 쓰지 않는다(옛 판정 걷어 냄).
- 시주 모름일 때 처리: §7.1.

### 3.9 `outward` — 밖으로 펼치는 기운 (보조) `exp.lv.outward.v1` — 0.1.0과 같음
```ts
const yr = round6(yy.yang / (yy.yang + yy.yin))
const warm = tClass === "난" || tClass === "열강"
const cold = tClass === "한" || tClass === "한강"
level = yr >= 0.75 || (yr >= 0.625 && warm) ? "strong"
      : yr <= 0.25 || (yr <= 0.375 && cold) ? "faint"
      : "moderate"
```
- 고전 요지(L0): 양은 펼치고 움직이며 음은 거두고 갈무리한다는 음양의 기본 성질, 화의 따뜻함은 위로 퍼진다는 오행 성질. 성격의 발산·수렴으로 옮기는 것은 **대중 풀이 수준의 읽기(L0 중 가장 약)**.
- ⚑ 옵션 민감: `branchYinYang`(byMainQi/byOrder)에 따라 子·午·巳·亥의 음양이 바뀐다. 판정에 쓴 값을 basis 메모에 남긴다.
- faint의 서술은 "밖으로 펼치는 결이 옅다 = 안으로 모아 두는 쪽일 수 있다"이지 "소극적이다"가 아니다.

### 3.10 공통 메모 규칙 (level을 바꾸지 않음 — basis에 추가)

| ruleId | 조건 | 메모(문안 재료) |
|---|---|---|
| `exp.note.load` | g ∈ {siksang, jaeseong, gwansal}의 level strong · `A.verdict === "신약"` · 경계 차단 아님(§7.2) · 특수격 후보 없음 | "쓰는 쪽 힘이 커서 부담으로 느낄 수 있음" |
| `exp.note.surplus` | g ∈ {bigyeop, inseong}의 level strong · `A.verdict === "신강"` · 경계 차단 아님 · 특수격 후보 없음 | "넘쳐서 고이기 쉬움 — 흘려보낼 통로가 필요" |
| `exp.note.flavor` | `flavor[g]`가 있으면 | 그 십성 이름(결 메모, §3.3~3.6) |
| `exp.note.latent` / `exp.note.floating` | L2 / L3 | §3.1 |

- 특수격 후보가 있으면 load·surplus를 달지 않는 이유(요지, L0): 종격 관점에서는 넘치는 기운을 따르는 것이 오히려 쓰임이라, 억부식 "부담/넘침" 표현이 거꾸로 될 수 있다.
- 0.1.0에서 load·surplus 조건을 `nearBoundary`만으로 적었으나, 엔진은 경계 차단 세 조건 모두로 구현했고 QA가 그 동작을 확인했다(5번). **세 조건 모두가 맞다** — 문구를 고쳤다.

### 3.11 ruleId 목록

| ruleId | 쓰는 곳 |
|---|---|
| `exp.lv.absent` · `exp.lv.hiddenOnly` · `exp.lv.stemOnly` · `exp.lv.rooted` | 핵심 차원 1~5 |
| `exp.mod.drive.v1` | drive 보정 |
| `exp.lv.grain.v1` · `exp.lv.grain.thin` · `exp.mod.grain.clarity` | grain (0.1.0 `exp.lv.tenGodSet.v1`·`exp.mod.edge.clarity` 대체) |
| `exp.lv.flux.v1` | flux |
| `exp.lv.outward.v1` | outward |
| `exp.note.*` | §3.10 |
| `exp.luck.activate` · `exp.luck.bridge` · `exp.luck.press` · `exp.luck.flux` · `exp.luck.tone` | §5 (0.1.0 `feed` → 계약 이름 `bridge`) |
| `exp.sens.hour` · `exp.sens.table` · `exp.sens.boundary` | §7 |

basis 한 줄 예: `{ ruleId: "exp.lv.rooted", positions: ["year.stem", "month.branch.jeonggi", "day.branch.yeogi"], note: "편관 투출·월령, 비율 0.290" }`.

---

## 4. 손계산 예시

원국: 연 甲子 · 월 丙寅 · 일 戊辰 · 시 庚申 (일간 戊 토, 기본 옵션·kr-monthly-30). 핵심·flux·outward 줄은 0.1.0에서 QA·엔진과 일치 확인됨. **grain 줄은 0.2.0 손계산(엔진 확인 전).**

| 묶음 | 글자(가중) | G | gs | presence | M | level |
|---|---|---|---|---|---|---|
| bigyeop | 寅 戊 0.7, 辰 戊 0.9, 申 戊 0.233 | 1.833 | 0.175 | hiddenOnly | — | moderate (latent) |
| inseong | 丙(월간) 1.0, 寅 丙 0.7 | 1.700 | 0.162 | stemAndHidden | — | moderate |
| siksang | 庚(시간) 1.0, 申 庚 0.533 | 1.533 | 0.146 | stemAndHidden | — | moderate |
| jaeseong | 子 壬 0.333·癸 0.667, 辰 癸 0.15, 申 壬 0.233 | 1.383 | 0.132 | hiddenOnly | — | moderate (latent) |
| gwansal | 甲(연간) 1.0, 寅 甲 1.6, 辰 乙 0.45 | 3.050 | 0.290 | stemAndHidden | ✓ | **strong** |

- 모형 A r = 0.4317 → 신약, `nearBoundary: true` → 경계 차단: drive 보정 없음, duty에 load 메모 없음.
- **grain**: S = 정재 0.817 + 정관 0.45 + 정인 0 + 식신 1.533 = 2.8, E = 편관 2.6 + 편인 1.7 = 4.3. (S+E)/T = 0.676. q = 2.8 / 7.1 = **0.394366**, d = 0.105634 → lean **edge**, moderate(0.07 ≤ d < 0.20) → 청탁 표지 효신탈식(丙 편인·庚 식신) → **strong, edge**.
- flux: 寅申 충(월지) + 甲庚 천간충 = 2 → strong. outward: 양 7/8 = 0.875 → strong.
- **시주를 빼면**(T = 8.5): expression faint, flux faint, r = 0.505882 중화. grain: S = 0.817 + 0.45 = 1.267, E = 4.3, q = 0.227545, d = 0.272455 ≥ 0.20, 甲·丙 투출 → **strong, edge**(시주로 level은 같고 근거만 바뀜).

---

## 5. 대운·세운이 차원을 건드리는 규칙

출력 이름은 **확정 계약서 §5**를 따른다: `touches: { dimensionId; how: "activate" | "bridge" | "press"; positions: string[] }[]`, `tone?: "favorable" | "burden" | "neutral"`. (0.1.0 §5.8 제안 이름 `mode`·`feed`·`via`·`support`·`load`는 폐기 — QA B1의 이름 불일치는 계약서 쪽으로 맞추는 것이 연구소장 의견.)

### 5.1 운 글자 읽기
- 대운 i: `tenGods`에서 `position.pillar === "daeun" && position.luckIndex === i`인 천간·지지 항목. 세운: `position.pillar === "seun"`.
- 운 지지의 십성은 지지 자체 항목(정기 기준) 하나뿐이다. 1차는 이것만 쓴다(gaeun `LuckGlyphFacts`와 같은 방식).
- 운은 **원국 level을 바꾸지 않는다.**

### 5.2 운 글자 묶음 → 차원 (오행 생극, L0)

| 운 글자 묶음 | `activate` (그 시기 일이 몰리는 쪽) | `bridge` (생: 다음 차원으로 이어 줌) | `press` (극: 눌리는 차원) |
|---|---|---|---|
| 비겁 | `drive` | `expression` | `realism` |
| 식상 | `expression` | `realism` | `duty` |
| 재성 | `realism` | `duty` | `learning` |
| 관살 | `duty` | `learning` | `drive` |
| 인성 | `learning` | `drive` | `expression` |

- 근거(L0): 상생·상극을 일간 기준 묶음으로 옮긴 것. 압박 줄의 옛 이름(군겁쟁재·상관견관·재성파인·효신탈식)은 "그 쪽 일에 힘을 더 써야 하는 시기"로만 쓴다.

### 5.3 결 차원 `grain` (0.2.0 변경)
- 운 글자 십성이 STEADY 집합이면 "고른 쪽", EDGE 집합이면 "센 쪽"을 건드린다(비견·편재는 없음).
- 원국 lean과 **같은 쪽 → `how: "activate"`**(늘 쓰던 결로 일이 몰림), **반대쪽 → `how: "press"`**(평소 결과 반대 결을 요구받는 시기), 원국이 `balanced`면 → `"activate"`.
- 한 운 기둥 안에서 두 글자가 양쪽을 다 건드리면 touch 두 개를 그대로 남긴다(지우지 않음).
- 이 방식이면 `touches.how`에 새 값을 추가하지 않아도 된다.

### 5.4 관계 (flux) — 0.2.0 명시(QA S4)
- `interactions`에서 `scope === "luck"`, `type`이 `clash` 또는 `punishment`(`partial` 제외), `members`에 원국 **월지 또는 일지**가 있고 그 운 기둥 위치가 있으면 → 그 운 기둥에 `flux` activate (`positions`에 관계의 모든 위치).
- **세 글자 관계에 대운·세운이 함께 끼면 세운 쪽에만** flux activate를 붙인다. 그 관계는 그해 세운이 들어올 때만 완성되므로, 대운 10년 전체의 성질로 볼 수 없다. (현행 엔진은 "다른 쪽이 모두 원국일 때만" 세어 이 경우를 빼고 있다 → 세운 쪽에 붙이도록 변경.)
- 운 지지가 원국 월지·일지와 합 → 차원 touch 없음. 메모로만 "묶임·새 약속".
- `outward`는 운이 건드리지 않는다(1차).

### 5.5 운의 결 `tone` — 0.2.0 명시(QA S4)
- 억부 관점(`method === "eokbu"`)이 `status === "ok"`이고 `favorable`이 있을 때만 글자별로: 그 오행이 rank 1 오행 또는 `favorable.xi` → favorable, `favorable.ji` 또는 `favorable.gu` → burden, 그 밖 neutral.
- **한 운 기둥(천간·지지 두 글자) 결합**: favorable과 burden이 섞이면 `"neutral"`(현행 엔진 선택 채택), 한쪽 + neutral이면 그 한쪽, 둘 다 같으면 그 값. (gaeun `luckHalves`를 쓰는 화면에서는 반분별로 따로 낸다 — 두 모듈을 같은 옵션으로.)
- 경계 차단(§7.2)이면 `tone`을 **생략**한다(계약서 "경계·표 민감이면 생략"). 엔진이 지금 `"neutral"`을 넣는 부분은 계약서대로 생략으로 바꾸는 것이 맞다(총괄실장 B1 결정과 함께).
- 조후 1순위와 억부가 엇갈리면 tone은 억부만 쓰고 `conflicts`에 메모(용신 표시 방식은 대표 결정 대기 6번).

### 5.6 학파 차이 (운)

| 쟁점 | 갈래 | 1차 기본 |
|---|---|---|
| 대운 천간·지지 비중 | 통째로 / 앞 5년 천간·뒤 5년 지지 / 지지를 더 무겁게 | 통째로. gaeun `luckHalves`를 쓰면 같은 값 |
| 운 지지의 지장간 | 정기만 / 지장간 전부 | 정기만 |
| 세운을 대운에도 대볼지 | 원국만 / 대운까지 | 엔진 `interactions` 그대로 |
| 충이 기신을 치면 길, 용신을 치면 흉 | 판정 / 판정 안 함 | 판정 안 함 |

### 5.7 상태 × 건드림 → 행동 방향 id (계약서 `luck.strategy`, 설계)

| 원국·자기보고 상태 | activate 받음 | press 받음 |
|---|---|---|
| `expressed` | `exp.st.expand` 이미 쓰는 힘을 더 넓은 판에 | `exp.st.pace` 속도 조절·지킬 것 먼저 |
| `developed` | `exp.st.leverage` 익혀 온 힘을 드러내 쓸 때 | `exp.st.pace` |
| `dormant` | `exp.st.tryout` 덜 쓴 힘을 작게 꺼내 볼 때 | `exp.st.guard` 미리 대비·부담 나누기 |
| `quiet` | `exp.st.borrow` 혼자 다 하려 말고 사람·도구 빌리기 | `exp.st.guard` |
| `unknown` | `exp.st.observe` | `exp.st.observe` |

- `grain`의 press(반대 결 요구)는 `exp.st.pace` 대신 `exp.st.stretch`(평소와 다른 결을 작게 연습)로 둔다 — 결은 "지킬 것"이 아니라 "넓힐 것"이기 때문(설계).
- tone burden이면 `exp.st.smallsteps`, favorable이면 `exp.st.commit`을 덧붙인다. tone 생략이면 덧붙이지 않는다.
- MBTI 문체 힌트(§6.2 hint)는 strategy id를 바꾸지 않고 **같은 id의 문체 변형**으로만 쓴다(예: `exp.st.tryout` + `style.writeFirst`).

---

## 6. MBTI 4축과 차원 — 연구소장 의견 (서비스 모델 가설)

### 6.1 먼저 분명히 할 것
- MBTI와 사주 사이에 상관이 있다는 연구를 연구소장은 **확인하지 않았다**. 아래 대응은 **"운명비서 자기이해 모델의 가설"** 이다. 데이터에는 `claim: "service-model"`을 붙이고, 명리 근거(`evidenceLevel`) 칸에 넣지 않는다.
- 대응의 성격은 **"비슷한 쪽을 가리키는 은유"** 다. 사주는 태어난 시점의 글자 구조, MBTI는 지금 스스로 고른 선호다.
- MBTI는 원국·운 계산 입력이 아니다. MBTI만으로 `developed`를 판정하지 않는다.
- 상표 메모: "MBTI" 명칭의 화면 표기 범위는 연구소장이 확인하지 않았다(§9).

### 6.2 대응표 (0.2.0 재정리 — QA B3에 대한 판단)

**세 가지 규칙(표보다 먼저)**
1. **MBTI는 low 신호를 만들지 않는다.** low(그 쪽을 덜 쓴다)는 "덜 쓴 잠재력(dormant)"으로 이어지는데, MBTI 한 글자로 그런 추정을 내면 "I라서 펼치지 못한다" 같은 결여 판정이 된다(§6.3-7). MBTI가 줄 수 있는 것은 "본인도 그쪽으로 느낀다"는 확인(high)뿐이다.
2. **확신 없음(`sure: false`)은 신호가 아니라 힌트만.** 0.1.0의 약화 계수(0.5)는 결과적으로 효과 0이어서 "작동하는 척"만 했다. 확신 없는 답은 문체 힌트에만 쓴다.
3. **신호 줄은 실제 역할이 둘 중 하나 이상 있어야 표에 남는다**: (가) 사실이 없을 때 원국과 같은 쪽임을 확인(expressed), (나) 사실과 반대일 때 self-vs-self 상충 기록. 이 둘 중 아무것도 못 하는 줄은 힌트로 내리거나 지운다.

| 0.1.0 줄 | 0.2.0 처리 | 실제 역할 | 이유 |
|---|---|---|---|
| E → `outward` high (A) | **(a) 신호 유지** — `sure: true`만, 가중 1 | 사실 없을 때 outward 확인(expressed). outward에 닿는 사실이 없어 상충 기록은 없음 | 발산·수렴 은유가 비교적 자연스러움 |
| E → `expression` high (B) | **(b) 힌트** `style.talkFirst` | expression 관련 strategy를 "말로 꺼내기" 문체로 | E는 "표현을 잘한다"가 아니다. 신호로 두면 표현력 판정처럼 읽힘 |
| I → `outward` low (B, 확신만) | **(b) 힌트** `style.writeFirst` | 같은 strategy를 "글·혼자 정리 먼저" 문체로 | 규칙 1(MBTI는 low 금지) |
| S → `realism` high (B) | **(b) 힌트** `style.concreteFirst` | 조언을 "구체 단계 먼저" 문체로 | 구체 정보 선호 ≠ 결과·재물 감각. 은유가 약해 신호로 두면 과잉 |
| (N — 0.1.0에도 힌트) | 힌트 `style.bigPictureFirst` 유지 | 조언을 "큰 그림 먼저" 문체로 | — |
| (T/F — 0.1.0에도 힌트) | 힌트 `style.reasonFirst` / `style.peopleFirst` 유지 | 문체 | 차원 신호 금지 유지 |
| J → `steadiness` high (A−) | **(a) 신호** J → `grain` **steady 쪽**, `sure: true`만, 가중 1 | 사실 없을 때 원국 steady 확인 / 사실(creativity 등 edge 쪽)과 반대면 self-vs-self | 계획·마감 선호와 고른 결의 은유 |
| P → `steadiness` low (B−, 확신만) | **(a)로 흡수** P → `grain` **edge 쪽**, `sure: true`만, 가중 1 | 사실 없을 때 원국 edge 확인 / 사실(planning)과 반대면 self-vs-self / 원국 steady인데 P면 chart-vs-self 메모만(§3.7.5, low 아님) | 양극 축이 되어 "low"가 아니라 "다른 쪽"이 됨 — 규칙 1과 충돌 없음 |
| J → `duty` high (B) | **(c) 삭제** | — | J를 grain에 쓰므로 이중 사용. duty는 사실(planning·leading)로만 |
| P → `flux` high (B) | **(c) 삭제** | — | P를 grain edge에 쓰므로 이중 사용. flux는 근거가 약한 보조 차원이라 MBTI로 다시 흔들지 않음 |

- 결과: **신호 3줄**(E→outward, J→grain steady, P→grain edge), **힌트 6개**(E·I·S·N·T·F). S/N·T/F·I는 신호가 없다 → 계약서 §6 "E/I·S/N·J/P만 차원 신호" 문구를 **"E·J·P 세 줄만 신호, 나머지 축·극은 문체 힌트"** 로 고쳐야 한다(§9.3).
- 구현 권고: MBTI만 있을 때 high를 `가중 1 × mbtiOnlyFactor 0.5 = 0.5 ≥ highAt 0.5`라는 **우연한 등호**로 만들지 말고, "사실 없음 + 확신 + 신호 줄 → high(`mbtiOnly: true`)"를 **명시 규칙**으로 둔다(문턱을 바꾸다 조용히 꺼지는 일을 막음). `unsureFactor`는 쓰지 않는다(0 또는 삭제).
- 표 검증(QA·구현자): `links`의 `direction`은 `"high"` 또는 `grain`의 `"steady"|"edge"`만 허용, `"low"` 금지, `sureOnly: true` 고정, 차원 id는 `outward`·`grain`만.
- 원칙 7 확인: 같은 원국이라도 E/I·J/P에 따라 outward·grain 상태가 달라지고, 힌트로 strategy 문체가 달라진다.

### 6.3 피해야 할 단정 (데이터·문안 금지)
1. 사주로 MBTI를 맞히기: "당신의 사주는 ENFP형이다", "이 사주면 I일 것이다".
2. MBTI로 사주를 확인·반박하기: "E라서 사주가 맞았다/틀렸다", "MBTI가 사주를 바꾼다", "MBTI가 바뀌면 운이 바뀐다".
3. 상관을 사실처럼: "과학적으로 입증된", "검증된 상관", "통계적으로", "연구에 따르면"(근거 문헌 없음).
4. MBTI로 과거·경험을 지어내기: "E니까 친구가 많았겠다", "J라서 직장에서 인정받았을 것이다".
5. 16유형 ↔ 일간·오행·원형 고정표: "INTJ = 庚금", "ENFP = 봉황".
6. 고정관념: T=냉정, F=여림, I=소극적, P=게으름, 성별과 엮은 서술.
7. 결여 판정: "I라서 표현력이 없다", "P라서 책임감이 약하다".
8. 궁합·채용·적성 판정에 MBTI–사주 대응을 쓰는 것.

- 금지어 검사(QA B2) 보강 의견: 글자 그대로 비교로는 위 "류"를 못 막는다. 최소한 ① 띄어쓰기·조사 무시 비교 ② 「상관(관계)?」·「근거」 + 「입증·검증·증명·밝혀·유의」 조합 ③ 「사주」 근처의 `[EI][SN][TF][JP]{4}` 또는 단일 축 글자 단정(「…면 I일 것」) ④ 「MBTI」 + 「바꾸·바뀌·달라지·결정」 + 「사주·운」 조합 ⑤ 「연구·논문·통계」 + 「따르면·결과」 — 다섯 갈래 패턴을 권고한다(검증기 담당 판단).

### 6.4 사용자 사실(UserFact) → 차원

| 사실(questionId:value) | 차원 · 신호 | 출처 | 종류 |
|---|---|---|---|
| selfStrength:persistence | drive high | lived-link(bigeop) | 기질 |
| selfStrength:communication | expression high | lived-link | 기질 |
| selfStrength:creativity | expression high, **grain edge** | lived-link + 0.2.0 추가 | 기질 |
| selfStrength:planning | duty high, **grain steady** | lived-link(gwanseong) + 추가(0.1.0 steadiness → grain) | 기질 |
| selfStrength:caring | learning high | lived-link(inseong) | 기질 |
| selfStrength:learning | learning high | lived-link | 기질 |
| selfStrength:decisiveness | drive high | 추가 | 기질 |
| workStyle:solo_deep | learning high | lived-link | 기질 |
| workStyle:team | drive high | lived-link(bigeop) | 기질 |
| workStyle:people_facing | expression high | lived-link | 기질 |
| workStyle:leading | duty high | lived-link(gwanseong) | 기질 |
| selfWeakness:saving | realism low | lived-link(jaeseong) | 기질 |
| occupationStatus:* · recentChanges:* · lifeEvents:* | lived-link 대응 그대로 | lived-link | **상황** |

- `creativity → grain edge`를 넣은 이유: 새 방식을 떠올리는 것은 상관·편인(센 쪽)의 현대 읽기와 닿는다(B, 설계). 이것이 없으면 grain edge 쪽에 닿는 사실이 하나도 없어, P–사실 상충을 잡을 수 없다.
- 상황 사실만으로 `developed` 금지(계약서 §6 채택됨). QA S2 의견대로 표 검증에서 `developedEvidence`를 `["trait"]`로 고정하는 것을 지지한다.
- 약점 문항은 `saving` 하나만 차원에 잇는다(원인 단정 금지).

---

## 7. 상충·불확실 처리

### 7.1 시주 모름 — 민감도와 분포 의견 (0.2.0)

| 차원 | 민감도 | 이유 |
|---|---|---|
| `flux` | **높음** | 관계 1~2개로 판정. 지지 넷이면 쌍이 6개, 셋이면 3개 — 시지가 빠지면 셀 관계가 절반으로 준다 |
| `outward` | **높음** | 8글자 중 2글자가 빠진다 |
| `expression`·`realism`·`duty`·`learning` | 중~높음 | 시간(時干)은 투출 자리 셋 중 하나 — 빠지면 presence가 내려간다 |
| `drive` | 중 | 위와 같음 + 일간 세력 보정이 시주에 따라 바뀜 |
| `grain` | 중 | 비율(q)이라 두 글자분 변화에 절대 비율보다 덜 흔들린다(§4 예시: level 유지) |
| 월령(M)으로 strong이 된 묶음 | 낮음 | 월지 가중 3.0이 지배 |

**QA 측정에 대한 의견**(시주 없음: flux strong 8.4%·faint 53.2%, 핵심 faint 40.3~42.4%):
- **기둥 하나가 빠진 데서 오는 자연스러운 결과로 본다.** 핵심 차원 faint가 32% → 41%로 오른 것은 투출 자리 셋 중 하나와 지지 하나(T 10.5 중 2.0)가 빠져 absent·hiddenOnly가 늘어난 것이고, flux는 셀 관계 쌍이 절반이 되어 0개가 흔해진 것이다. 문턱을 시주 유무에 따라 따로 두지 않는다 — 두 벌 규칙은 같은 원국에 시주를 넣었을 때 판정 기준이 바뀌는 혼란을 만들고, 이 불확실성은 이미 12시진 안정도로 드러난다.
- 다만 **"시주가 없어서 안 보이는 것"과 "옅은 것"은 다르다.** 그래서 문안·장 선택에서 다음을 지킨다(구현·작가 반영):
  1. 시주 모름이고 `hourStable < 8/12`인 차원의 **faint는 성향으로 서술하지 않는다**("변화를 덜 탄다", "표현이 옅다" 금지). `chart-uncertain`만 남기고 문안은 "태어난 시각을 알면 달라질 수 있다".
  2. 시주 모름이면 `flux`는 level과 관계없이 `innateEssence` 대표 기질로 고르지 않는다(가장 시주 의존이 큰 보조 차원).
  3. dormant·developed 8/12 규칙은 그대로(계약서 §6 채택됨).
- QA 추가 측정 요청: 시주 모름 faint 중 `hourStable < 8/12`인 비율. 이 비율이 작아(예: faint의 절반 미만) "안정된 faint"가 40%를 크게 넘으면 그때 L2 문턱(0.12)을 다시 본다.

절차(`exp.sens.hour`, 원형 엔진 D-030과 같은 방식): ① 세 기둥 결과를 판정값으로 ② `hourPillarsOf(dayMaster.stem)`로 12시진을 넣어 `analyzeRules` 재실행 → 차원별 `hourStable x/12`와 나온 level 목록 기록(QA 4-a 확인됨) ③ level이 2가지 이상이면 `conflicts`에 `{ dimensionId, kind: "chart-uncertain", note }` ④ `grain`은 level과 **lean**이 모두 같아야 "같은 판정"으로 센다.

### 7.2 경계 차단 (0.2.0 확정)
- `A.nearBoundary === true`, `strength.agreement === "split"`, `strength.tableSensitive === true` 중 하나라도 참이면: **drive 보정 +1·−1 모두 안 함**, load·surplus 메모 안 함, 운 `tone` 생략. `basis`에 `exp.sens.boundary` 메모, `conflicts`에 `chart-uncertain`.
- 극단(`A.extreme`)이어도 묶음 level 계산(§3.1)은 그대로다. 극신약 −1은 **차단이 아닐 때만**.
- (0.1.0 §7.2 "극신약 drive −1만 적용"은 "극단이어도 다른 차원 level은 그대로, 극단이 바꾸는 것은 drive −1뿐"이라는 뜻이었으나 차단과의 관계를 적지 않아 두 가지로 읽혔다. 엔진 현행 동작(둘 다 끔)이 연구소장 의도다 — QA 측정 97건 차이는 엔진 쪽이 맞다.)

### 7.3 지장간 표 민감도 (`exp.sens.table`)
- 판정은 kr-monthly-30 고정. cn-lunarjs로 한 번 더 계산해 level이 다른 차원을 기록만 한다(고객 화면 비노출).
- 흔들리는 곳: 子·卯·酉(kr 표에만 여기 壬·甲·庚)와 午·亥(cn 표에는 여기 丙·戊 없음). grain의 q도 子(壬·癸 정·편 구분)·酉(庚·辛)에서 움직인다.
- 표 민감은 `chart-uncertain`으로 기록(계약서 채택됨).

### 7.4 격 변형
- 주 후보의 `variantAgreement === "differs"`면 M은 두 묶음 모두에 준다. basis 메모 "태어난 달의 주된 기운을 보는 방식이 두 갈래".

### 7.5 특수격 후보
- `kind === "special"`이 있으면 load·surplus 메모를 달지 않는다. level 판정 규칙은 그대로.

### 7.6 합·충의 보정
- 합거·합화·충으로 뿌리가 뽑힌다는 설은 1차에 **반영하지 않는다**(규칙 엔진 `combineAdjustment: "none"`, `transformed: null`).

### 7.7 쓰지 않는 엔진 값과 이유
| 값 | 이유 |
|---|---|
| 12운성 | 음간·토 처리 학파 옵션에 따라 단계가 바뀐다. basis 메모로만 허용 |
| 공망 | 기질과 잇는 통설이 약하고 기준 기둥 옵션이 갈린다 |
| 신살 | 규칙 엔진에 없다. 역마·도화 같은 이름으로 flux·outward를 보강하지 않는다 |
| 용신 오행 자체 | 차원 level에는 쓰지 않는다. 운 tone(§5.5)에만 |

### 7.8 차원 간 겹침
- `grain`은 핵심 다섯과 같은 글자를 다른 각도(기울기)로 다시 본다. `outward`는 `expression`과 은유가 닿는다. 같은 근거 위치를 공유하는 차원은 `sections` 대표 항목에서 하나만 고른다(현행 엔진 규칙 유지).
- 0.1.0의 "steadiness·edge 둘 다 strong" 같은 모순된 서술은 0.2.0 구조에서 생기지 않는다.

---

## 8. 구현자·품질검증에 요청

1. **분포 재측정**(무작위 1만 건, 시주 있음/없음): `grain`의 strong(steady·edge 각각)·moderate·faint 비율과 q 분위수. 목표: strong 합 15~35%, faint 15~40%, strong 안에서 한쪽이 1/3 미만으로 쏠리지 않을 것. 벗어나면 0.07·0.20 문턱(또는 edge 승격)을 조정하고 판 번호를 올린다 — 조정은 연구소장 검수 후.
2. **시험 사례**: §4 예시의 grain 두 판(시주 있음: q 0.394366 → moderate edge → 청탁 승격 strong / 시주 없음: q 0.227545 → strong edge). 승격 없이 strong, thin(가를 글자 부족), balanced, steady strong이 각각 한 번씩 걸리는 합성 원국.
3. **MBTI 표 불변 시험**: 625조합에서 ① low 신호 0 ② 확신 없음 답의 신호 효과 0(힌트만) ③ 신호가 생기는 차원은 outward·grain뿐 ④ 신호 줄 3개 모두 어떤 조합에서 실제로 판정을 바꾸는지(죽은 줄 0) ⑤ 힌트 6개 모두 strategy 문체 변형으로 출력되는지.
4. **경계 차단 시험**: 차단이면 drive 보정 0(+1·−1 모두), tone 생략.
5. **운 시험**: 대운+세운+원국 월지·일지 세 글자 형 → 세운 쪽에만 flux activate. grain touch의 activate/press가 원국 lean과 맞는지.
6. 불변·금지어·결정론 시험은 0.1.0과 같다.

---

## 9. 근거 확인 현황 · 학파 충돌 · 결정 필요

### 9.1 근거 확인 현황
| 항목 | 등급 | 비고 |
|---|---|---|
| 십성 다섯 묶음의 작용 요지(1~5) | L0 | entries/tengods.yaml·gaeun.md §1.3과 같은 수준 |
| 투출·통근·월령 중시 | L0 | 통설(요지). 문턱값은 설계 |
| 정·편을 상대 개념으로 보는 것, 순용·역용 구분(6의 배경) | L0 | 원문 미대조. 성격 이론으로 넓힌 것은 현대 통설 + 설계 |
| 충 = 움직임(7) | L0 중 약 | 대중 풀이 읽기 + 설계 |
| 음양·한난 = 발산(8) | L0 중 가장 약 | 대중 풀이 읽기 + 설계 |
| 운 생극 대응(§5.2) | L0 | 오행 생극 기본 틀 |
| MBTI 대응(§6) | 근거 없음 | 서비스 모델 가설(`claim: "service-model"`) |
| 고전 원문 인용 | 0건 | — |
| 엔진 일치 | 0.1.0 규칙 4,000건 불일치 0(QA) | 0.2.0 grain·MBTI·운 변경분은 미확인 |

### 9.2 학파 간 충돌 (옵션으로 둔 것)
| 쟁점 | 갈래 | 기본 |
|---|---|---|
| 지장간만 있는 월령 기운의 상한 | moderate까지 / strong 가능 | moderate (`hiddenMonthCanBeStrong: false`) |
| 편재의 결 | 순용(고른 쪽) / 확장(센 쪽) / 넣지 않음 | 넣지 않음 (`pyeonjaeSide: "none"`) |
| 합이 충을 푸는가 | 푼다 / 안 푼다 | 반영 안 함 |
| 대운 천간·지지 비중 | 통째 / 반분 / 지지 중시 | 통째(gaeun `luckHalves`를 따름) |
| 양인을 따로 볼지 | 겁재 전체 / 양인만 센 쪽 | 겁재 전체 |
| 지지 음양(子午巳亥) | byMainQi / byOrder | 엔진 옵션을 그대로 따르고 기록 |

### 9.3 총괄실장·대표 결정 필요
1. **계약서 보완(0.2.0 grain)**: `ChartPotential.lean?: "steady" | "edge" | "balanced"`, `DimensionReading.self.lean?: "steady" | "edge" | "none"`(grain 전용 선택 필드). 승인되지 않으면 §3.7.6 임시안.
2. **계약서 §6 문구**: "E/I·S/N·J/P만 차원 신호" → "신호는 E→outward, J→grain(고른 쪽), P→grain(센 쪽) 세 줄. I·S·N·T·F는 문체 힌트. MBTI는 low를 만들지 않고, 확신 없음은 힌트만".
3. **QA B1**: 운 필드 이름은 계약서(`how`·`positions`·`favorable/burden`·차단 시 tone 생략)에 코드를 맞추는 것을 연구소장은 권한다. 이 문서는 계약서 이름으로 고쳤다.
4. `lived-link.ts` 철자 통일 여부(0.1.0에서 넘긴 항목, 미결).
5. 설문 문서 문구 충돌(`survey.ts` MBTI `usage`, `lived-life.md` selfStrength "판정 금지") 정리(미결).
6. "MBTI" 명칭 화면 표기 — 상표 법무 확인(미결, 연구소장 미확인).
7. 용신 표시 방식(대표 결정 대기 6번) 확정 시 §5.5 재검토.
