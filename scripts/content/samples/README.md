# 견본 풀이 생성 (기본 풀이 8장 × 가상 인물 10명)

대표가 실제 AI 글 품질을 확인하려고 쓰는 견본입니다. **모두 가상 인물(실존 아님)** 이고 이름은 없습니다. 설문 답도 "예시"로 지어낸 값입니다.
결과는 저장소의 `samples/<날짜>/`에 생기고, 이 폴더는 `.gitignore`에 있어 커밋되지 않습니다(저장소가 공개 상태라 대표 확인 전에는 비공개로 둡니다).

> 현재 상태(2026-11-27): 준비만 끝났고 **실제 호출은 한 번도 하지 않았습니다.** 대표가 견본 생성을 보류했으니, 다시 승인이 날 때까지 아래 3·4단계를 실행하지 않습니다.

## 흐름
인물마다 `computeChart` → `analyzeRules`(rules@0.3.x, 대운·올해 세운 포함, 신강약·용신 포함) → `buildPersonalContext`(설문 예시) → `buildFactSheet`(호칭 "손주", 이름·생년월일·출생지는 넣지 않음) → `chaptersForProduct("BASIC")`(콘텐츠 작가 `src/engine/content/prompts/index.ts`) → `generateChapters`(백엔드 파이프라인: 구조화 출력, 재시도, 검증기 block이 나오면 1회 재생성).

| 파일 | 하는 일 |
|---|---|
| `personas.ts` | 가상 인물 10명과 고른 이유 |
| `lib.ts` | 본체: 인자, 비용 상한, 인물 1명 실행, 요약 표 |
| `html.ts` | 대표가 보는 `index.html` |
| `fake-client.ts` | API 없이 쓰는 가짜 응답(테스트, `--fake` 연습용) |
| `generate.ts` / `generate.mjs` | 실행 입구 / 실행기(vite-node를 부름. vitest에 들어 있어 따로 설치할 것 없음) |

## 다음 세션 실행 순서
작업 폴더는 `/home/user/saju-app`입니다.

**0. (선택, 비용 0) 연습 실행**: API를 부르지 않고 가짜 응답으로 화면 모양만 확인합니다. 결과는 `samples/<날짜>-fake/`에 생깁니다.
```bash
node scripts/content/samples/generate.mjs --fake --only 1
```

**1. 환경 변수 확인**: 값은 화면에 나오지 않습니다.
```bash
node -e "console.log(process.env.SAJU_ANTHROPIC_API_KEY ? '있음' : '없음')"
```
- "없음"이면 대표가 클라우드 환경 설정에 `SAJU_ANTHROPIC_API_KEY`를 넣고 **새 세션을 열어야** 합니다. 이미 열린 세션에는 반영되지 않습니다.
- 일반 이름 `ANTHROPIC_API_KEY`는 일부러 읽지 않습니다(Claude Code 자체 인증과 충돌하기 때문).
- 키가 없을 때 실행하면 안내만 하고 상태 코드 2로 끝납니다. 이때 호출은 하지 않습니다.

**2. 검사**
```bash
npx vitest run tests/content/samples.test.ts
```

**3. 1명 시험 (상한 0.5달러)**
```bash
node scripts/content/samples/generate.mjs --only 1 --budget-usd 0.5
```
- 1명에 8장이고, 장마다 진행 줄(토큰·비용·누적)이 하나씩 찍힙니다. 시간은 대략 2~5분입니다.
- 끝나면 `samples/<날짜>/index.html`을 열어 본문, 근거 칩, 검증 판정, 장별 비용을 확인합니다.

**4. 전체 (10명 + 비교 2명)**
```bash
node scripts/content/samples/generate.mjs --compare --budget-usd 5 > samples/run.log 2>&1
```
- 10명 기준 20~45분이 걸립니다. Claude Code에서는 백그라운드 실행(`run_in_background`)으로 돌리고, 끝난 뒤 `samples/run.log` 끝의 요약 표를 확인합니다.
- `--compare`를 주면 p05(서머타임·설문)와 p09(극신강)를 `claude-sonnet-5-5`로도 만들어 `p05.claude-sonnet-5-5.json`처럼 따로 저장합니다.

## 옵션
`--help`로 전체를 볼 수 있습니다. 자주 쓰는 것은 다음과 같습니다.
`--only 1,3` · `--budget-usd 5` · `--model claude-opus-5-5`(기본값) · `--compare` · `--concurrency 1|2`(기본 2) · `--retry-failed` · `--date YYYY-MM-DD` · `--fake`

상태 코드: 0 완료(차단된 장이 있어도 0) · 1 인자·실행 오류 · 2 키 없음 · 3 장 명세 없음 · 4 비용 상한에 닿아 중단

## 비용
- 단가는 `src/engine/content/cost.ts`를 따릅니다(Opus 5.5 기준 100만 토큰당 입력 $4, 출력 $20, 캐시 읽기 $0.2, 캐시 쓰기 $5). 환율은 1달러=1,400원으로 가정합니다.
- **Opus 1명(8장): 약 570~790원($0.40~0.56)**. 이 값은 `docs/COST_REPORT.md` 1-2의 장당 출력 2,000~3,000토큰 가정입니다. 장별 출력 상한(합계 13,000토큰)으로 미리보기(`scripts/content/dry-run.mjs`)를 돌리면 재생성이 없을 때 $0.25~0.36이 나옵니다.
- 10명(Opus)은 약 5,700~7,900원, 비교 2명(Sonnet)은 약 600~800원이 더 듭니다. 검증 차단으로 다시 만든 장은 비용이 그만큼 늘어납니다.
- **기본 상한 5달러(7,000원)는 전체 + 비교를 돌리기에 빠듯합니다.** 끝 무렵에 멈추면 아래 "이어서 하기"로 나머지만 만듭니다. 상한을 올리려면 대표 승인이 필요합니다.
- **상한을 지키는 방식**: 호출하기 직전에 그 호출의 최악 비용을 계산합니다(입력 근사값 × 1.3을 가장 비싼 입력 단가로, 출력은 `max_tokens`를 다 쓴다고 봄). 누적 비용과 진행 중 호출의 최악 비용에 이것을 더해 상한을 넘으면 **그 호출을 보내지 않고** 전체를 멈춥니다. 따라서 누적 추정 비용은 상한을 넘지 않습니다. 다만 상한보다 조금 일찍 멈출 수 있습니다.
- 실제 청구액은 Anthropic 콘솔에서 확인하고, `docs/COST_REPORT.md`에 기록합니다(사업기획 담당 몫).

## 출력
`samples/<날짜>/`에 다음 파일이 생깁니다.
- `p01.json` … : 사실표, 장별 결과, 검증 결과(block/warn/info), 시도마다의 초안(차단된 초안 포함), 호출마다의 모델·토큰·비용 기록, 합계가 들어갑니다. 지어낸 출생 입력은 재현용으로 JSON에만 남깁니다.
- `index.html`: 폴더 안의 모든 JSON을 모아 다시 만듭니다. 시험 실행과 전체 실행이 한 화면에 합쳐집니다. 인물은 나이대, 성별, 계절, 원국만 보이고 생년월일과 키는 싣지 않습니다. 차단된 장은 "고객 비노출" 표시와 함께 초안을 접어 둡니다.
- `summary-<시각>.txt`: 요약 표(인물별 통과/차단 장 수, 총 토큰·비용, 소요 시간)

## 실패 시 대처
| 증상 | 대처 |
|---|---|
| 키 없음 안내(상태 2) | 1단계를 다시 합니다. 새 세션인지 확인합니다. |
| `api_error:401` / `403` | 키가 틀렸거나 권한이 없습니다. 대표가 콘솔에서 키를 다시 발급합니다. 같은 키로 반복 실행하지 않습니다. |
| 연결 오류·시간 초과(`api_error:connection`, `timeout`) | `generate.mjs`가 프록시용 `NODE_USE_ENV_PROXY=1`을 켜는지 확인합니다(Node 22.21 이상 필요). 오류 끝의 `[agent-proxy]` 줄에 `api.anthropic.com`이 막혔다고 나오면 정책 문제이므로 총괄실장에게 보고합니다. 우회하지 않습니다. |
| `api_error:429` 잦음 | 속도 제한입니다. `--concurrency 1`로 줄이고 `--retry-failed`로 이어 갑니다. |
| `api_error:400:schema` | 구조화 출력 스키마가 거부된 경우입니다. 그 장만 자동으로 "지시문 + JSON 검사" 방식으로 한 번 바꿔 다시 시도합니다. 그래도 실패하면 콘텐츠 작가에게 스키마를 확인해 달라고 합니다. |
| 장이 `차단(block)` | 고장이 아니라 검증기가 막은 것입니다. 화면의 지적 코드(예: `BASIS_NOT_IN_CHART`)를 콘텐츠 작가(프롬프트)·품질검증 담당(검증기)에게 넘깁니다. 다시 만들려면 `--retry-failed`를 씁니다. |
| 비용 상한으로 중단(상태 4) | 같은 날짜 폴더에서 `node scripts/content/samples/generate.mjs --retry-failed --budget-usd <추가 금액>`을 실행합니다. 다른 날이면 `--date YYYY-MM-DD`를 붙입니다. 통과한 장은 다시 만들지 않습니다. |
| 장 명세 없음(상태 3) | `src/engine/content/prompts/index.ts`의 `chaptersForProduct`를 확인합니다(콘텐츠 작가 몫). |
| 이 환경에서 엉뚱한 곳으로 요청 | 클라이언트는 `baseURL`을 `https://api.anthropic.com`으로 직접 정합니다. 이 환경에는 Claude Code용 `ANTHROPIC_BASE_URL`이 잡혀 있기 때문입니다. 다른 주소가 필요할 때만 `SAJU_ANTHROPIC_BASE_URL`을 씁니다. |

## 지키는 것
- 키 값은 출력하지도, 저장하지도 않습니다. 오류 문구에 섞여 나와도 로그와 파일에 쓰기 전에 `[가림]`으로 바꿉니다.
- AI에는 호칭, 성별, 만 나이, 원국 사실표, 설문 예시만 보냅니다. 이름·생년월일·출생지는 보내지 않습니다.
- 견본 결과(`samples/`)는 커밋하지 않습니다. 밖으로 공유하는 것은 대표가 결정합니다.
