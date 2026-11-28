// 신성 원형 실험 도구 — 실행 입구 (설계: docs/redesign/03-engine-design.md)
// 실행: npx vite-node scripts/archetype-lab/run.ts -- [옵션]
//   --rules 파일.json   원형 규칙 파일 (기본 scripts/archetype-lab/rules/example-v0.json — 임시 예시)
//   --n 1000            무작위 원국 수 (기본 1000)
//   --seed 문자열       시드 (기본 archetype-lab-v1)
//   --samples 5         근거 기록 샘플 수
//   --determinism 200   앞 몇 건을 다시 계산해 결정성 확인
//   --no-table          지장간 표 민감도 끄기 · --no-hour  시주 민감도 끄기
//   --md 파일           보고서(마크다운) 저장 · --json 파일  원자료 저장
//   --catalog           특징 목록 표만 출력(연구소장용)
//   --check             규칙 파일 검증만
// 외부 호출·DB·AI 없음. 제품 코드(src/**)를 고치지 않고 공개 API(computeChart·analyzeRules)만 부른다.
import { writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { featureCatalogMarkdown } from "./lib/features"
import { runLab } from "./lib/lab"
import { labMarkdown } from "./lib/report"
import { loadRuleSet, ruleSetHash } from "./lib/ruleset"

function args(argv: string[]) {
  const a = argv.filter((x) => x !== "--")
  const get = (k: string) => {
    const i = a.indexOf(k)
    return i >= 0 ? a[i + 1] : undefined
  }
  const num = (k: string, d: number) => {
    const v = get(k)
    if (v === undefined) return d
    const x = Number(v)
    if (!Number.isInteger(x) || x < 0) throw new Error(`${k}는 0 이상 정수`)
    return x
  }
  return {
    rules: get("--rules") ?? resolve(__dirname, "rules/example-v0.json"),
    n: num("--n", 1000),
    seed: get("--seed") ?? "archetype-lab-v1",
    samples: num("--samples", 5),
    determinism: num("--determinism", 200),
    table: !a.includes("--no-table"),
    hour: !a.includes("--no-hour"),
    md: get("--md"),
    json: get("--json"),
    catalog: a.includes("--catalog"),
    check: a.includes("--check"),
  }
}

const o = args(process.argv.slice(2))
if (o.catalog) {
  console.log(featureCatalogMarkdown())
  process.exit(0)
}
const rs = loadRuleSet(o.rules)
if (o.check) {
  console.log(`OK ${rs.id}@${rs.version} 원형 ${rs.archetypes.length}개 ${ruleSetHash(rs)}`)
  process.exit(0)
}
const L = runLab(rs, { n: o.n, seed: o.seed, samples: o.samples, table: o.table, hour: o.hour, determinism: o.determinism })
const md = labMarkdown(rs, L)
console.log(md)
if (o.md) writeFileSync(o.md, md + "\n")
if (o.json) writeFileSync(o.json, JSON.stringify(L, null, 1))
if (L.meta.errors.length || L.determinism.identical !== L.determinism.checked) process.exitCode = 1
