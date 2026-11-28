// 실험 결과 → 분포·일관성 보고(마크다운). 계산만 하고 판단 문구는 넣지 않는다(판단은 연구소장·총괄실장 몫).
import type { LabResult, SampleRecord } from "./lab"
import type { ArchetypeRuleSet } from "./types"

const pct = (x: number, n: number): string => (n ? ((100 * x) / n).toFixed(1) + "%" : "-")
const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"]
const EL_OF: Record<string, string> = { 甲: "목", 乙: "목", 丙: "화", 丁: "화", 戊: "토", 己: "토", 庚: "금", 辛: "금", 壬: "수", 癸: "수" }

function countBy<T>(xs: T[], key: (x: T) => string): Map<string, number> {
  const m = new Map<string, number>()
  for (const x of xs) m.set(key(x), (m.get(key(x)) ?? 0) + 1)
  return m
}

/** 정규화 엔트로피(0 = 한 원형에 몰림, 1 = 완전 균등) */
function normEntropy(counts: number[], k: number): number {
  const n = counts.reduce((a, b) => a + b, 0)
  if (!n || k < 2) return 0
  const h = counts.filter((c) => c > 0).reduce((s, c) => s - (c / n) * Math.log(c / n), 0)
  return h / Math.log(k)
}

/** 그룹 키만으로 1순위를 맞힐 확률(그룹마다 최빈 원형을 찍을 때) */
function predictability(rs: SampleRecord[], group: (r: SampleRecord) => string): number {
  const by = new Map<string, Map<string, number>>()
  for (const r of rs) {
    const g = group(r)
    if (!by.has(g)) by.set(g, new Map())
    const m = by.get(g)!
    m.set(r.known.primary, (m.get(r.known.primary) ?? 0) + 1)
  }
  let hit = 0
  for (const m of by.values()) hit += Math.max(...m.values())
  return rs.length ? hit / rs.length : 0
}

export function labMarkdown(rs: ArchetypeRuleSet, L: LabResult): string {
  const R = L.records
  const N = R.length
  const ids = rs.archetypes.map((a) => a.id)
  const name = new Map(rs.archetypes.map((a) => [a.id, a.name]))
  const out: string[] = []
  const line = (s = "") => out.push(s)

  line(`### 실행 정보`)
  line(`- 규칙 파일: \`${rs.id}@${rs.version}\` (status: ${rs.status}, ${L.meta.ruleSet.hash})`)
  line(`- 엔진: ${L.meta.engineVersion} · ${L.meta.featureVersion} · ${L.meta.rulesEngineVersion} · 역법 ${L.meta.calendarEngineVersion}`)
  line(`- 표본: 양력 1900-01-01~2100-12-31 균등 무작위 ${L.meta.n}건, 시드 \`${L.meta.seed}\`, 서울 시각, 규칙 옵션 기본값`)
  line(`- 계산 성공 ${N}건 · 오류 ${L.meta.errors.length}건`)
  line(`- 결과 해시(시간 측정 제외): \`${L.meta.resultHash}\``)
  line()

  // 1. 분포
  const prim = countBy(R, (r) => r.known.primary)
  const sec = countBy(R, (r) => r.known.secondary ?? "(없음)")
  const unk = countBy(R, (r) => r.unknown.primary)
  line(`### 1. 원형별 비율 (시각 앎 1순위 / 2순위 / 시각 모름 세 기둥 1순위)`)
  line(`| 원형 | 1순위 | 2순위 | 시각 모름 1순위 |`)
  line(`|---|---:|---:|---:|`)
  for (const id of ids) line(`| ${name.get(id)} \`${id}\` | ${pct(prim.get(id) ?? 0, N)} | ${pct(sec.get(id) ?? 0, N)} | ${pct(unk.get(id) ?? 0, N)} |`)
  const pc = ids.map((id) => prim.get(id) ?? 0)
  line()
  line(`- 1순위 최대 ${pct(Math.max(...pc), N)} · 최소 ${pct(Math.min(...pc), N)} · 0건 원형 ${pc.filter((c) => c === 0).length}개 · 정규화 엔트로피 ${normEntropy(pc, ids.length).toFixed(3)} (1 = 완전 균등, 균등이면 원형당 ${(100 / ids.length).toFixed(1)}%)`)
  line()

  // 2. 일간 의존도
  line(`### 2. 같은 일간 안의 원형 다양성 (일간 하나로 정해지지 않는가)`)
  line(`| 일간 | 표본 | 나온 원형 수 | 최빈 원형 | 최빈 비율 |`)
  line(`|---|---:|---:|---|---:|`)
  for (const s of STEMS) {
    const g = R.filter((r) => r.dm === s)
    const m = countBy(g, (r) => r.known.primary)
    const top = [...m.entries()].sort((a, b) => b[1] - a[1] || ids.indexOf(a[0]) - ids.indexOf(b[0]))[0]
    line(`| ${s}(${EL_OF[s]}) | ${g.length} | ${m.size} | ${top ? name.get(top[0]) : "-"} | ${top ? pct(top[1], g.length) : "-"} |`)
  }
  line()
  line(`- 일간 오행(5)만 알 때 1순위 적중률 ${pct(predictability(R, (r) => EL_OF[r.dm]), 1)}, 일간(10)만 알 때 ${pct(predictability(R, (r) => r.dm), 1)} — 기준선(전체 최빈 원형만 찍기) ${pct(Math.max(...pc), N)}`)
  line(`- 일주(60)만 알 때 ${pct(predictability(R, (r) => r.pillars.split(" ")[2]), 1)} · 월지+일간(120)만 알 때 ${pct(predictability(R, (r) => r.dm + r.pillars.split(" ")[1][1]), 1)}`)
  line()

  // 3. 시주 민감도
  const withVar = R.filter((r) => r.unknown.hourPrimaries)
  line(`### 3. 시주 민감도`)
  line(`- 시각 앎 1순위 = 같은 사람 시각 모름(세 기둥) 1순위: ${pct(R.filter((r) => r.known.primary === r.unknown.primary).length, N)}`)
  if (withVar.length) {
    const stable = withVar.filter((r) => r.unknown.stable).length
    const distinct = withVar.map((r) => new Set(r.unknown.hourPrimaries!).size)
    const avgAgree = withVar.reduce((s, r) => s + (r.unknown.agree ?? 0), 0) / withVar.length
    const dist = countBy(distinct, (d) => String(d))
    line(`- 시각 모름 원국에 12시진을 넣어 봤을 때 1순위가 모두 같음: ${pct(stable, withVar.length)} (= "시주에 따라 원형이 바뀜" 표시 대상 ${pct(withVar.length - stable, withVar.length)})`)
    line(`- 12시진 중 나온 1순위 종류 수 분포: ${[...dist.entries()].sort((a, b) => +a[0] - +b[0]).map(([k, v]) => `${k}종 ${pct(v, withVar.length)}`).join(" · ")}`)
    line(`- 세 기둥 1순위와 같은 시진 수 평균 ${avgAgree.toFixed(2)}/12 · 12시진 최빈 원형 ≠ 세 기둥 1순위: ${pct(withVar.filter((r) => r.unknown.modal !== r.unknown.primary).length, withVar.length)}`)
    const chk = R.filter((r) => r.actualHourIndex !== null && r.unknown.hourPrimaries)
    line(`- 검산: 실제 시주 변형의 1순위 = 시각 앎 1순위 ${pct(chk.filter((r) => r.unknown.hourPrimaries![r.actualHourIndex!] === r.known.primary).length, chk.length)} (일·월주가 정오 가정과 같은 ${chk.length}건)`)
  }
  line()

  // 4. 표 민감도
  const tb = R.filter((r) => r.table)
  line(`### 4. 지장간 표 민감도 (시각 앎, 기본 kr-monthly-30)`)
  if (tb.length) {
    line(`- kr-monthly-30 ↔ cn-lunarjs 1순위 다름: ${pct(tb.filter((r) => r.tableSensitive).length, tb.length)}`)
    line(`- main-only 포함 세 표 중 하나라도 다름: ${pct(tb.filter((r) => r.tableSensitiveIncludingMainOnly).length, tb.length)}`)
  } else line(`- (끔)`)
  line()

  // 5. 동점·경계
  const dec = countBy(R, (r) => r.known.decidedBy)
  line(`### 5. 동점·경계·대체`)
  line(`- 점수 완전 동점(priority로 결정): ${pct(dec.get("priority") ?? 0, N)} · 경계(1·2순위 차 < ${rs.params.boundaryMargin}): ${pct(R.filter((r) => r.known.boundary && r.known.decidedBy !== "fallback").length, N)} · 대체 원형(1순위 < ${rs.params.minScore}점): ${pct(dec.get("fallback") ?? 0, N)}`)
  const margins = R.map((r) => r.known.margin).filter((m): m is number => m !== null).sort((a, b) => a - b)
  if (margins.length) line(`- 1·2순위 점수 차 중앙값 ${margins[Math.floor(margins.length / 2)].toFixed(2)} · 하위 10% ${margins[Math.floor(margins.length * 0.1)].toFixed(2)} · 상위 10% ${margins[Math.floor(margins.length * 0.9)].toFixed(2)}`)
  line()

  // 6. 조건 발동률
  line(`### 6. 조건(점수 항목) 발동률 — 시각 앎 기준`)
  line(`| 원형 | 자격 탈락 | 항목별 발동률 |`)
  line(`|---|---:|---|`)
  for (const a of rs.archetypes) {
    const tf = L.termFiring[a.id]
    line(`| ${a.name} | ${pct(L.ineligible[a.id], N)} | ${a.terms.map((t) => `${t.id} ${pct(tf[t.id], N)}`).join(" · ")} |`)
  }
  line()

  // 7. 결정성·성능
  line(`### 7. 결정성·성능`)
  line(`- 결정성: 앞 ${L.determinism.checked}건을 처음부터 두 번 다시 계산(시각 앎 + 표 민감도, 시각 모름 + 12시진·표 민감도) → 근거 포함 전체 결과 동일 ${L.determinism.identical}/${L.determinism.checked}`)
  line(`- 전체 ${N}건 실행 ${(L.timing.totalMs / 1000).toFixed(1)}초 (1건당 ${L.timing.perSampleMs.toFixed(2)}ms = 원국 2회 + [시각 앎: 규칙 엔진·원형 점수 ${L.records[0]?.table ? 3 : 1}회] + [시각 모름: ${L.records[0]?.unknown.hourPrimaries ? "1+12" : "1"}회])`)
  line(`- 단계별(앞 ${L.timing.benchN}건 평균): 역법 computeChart ${L.timing.chartMs.toFixed(3)}ms · 규칙 analyzeRules ${L.timing.analyzeMs.toFixed(3)}ms · 특징+원형 점수 ${L.timing.scoreMs.toFixed(3)}ms`)
  line(`- 서비스 1회 요청 추정(민감도 포함): 원국 1 + 규칙 3(표) + 12(시각 모름일 때) ≈ ${(L.timing.chartMs + 3 * L.timing.analyzeMs + 3 * L.timing.scoreMs).toFixed(1)}ms(시각 앎) / ${(L.timing.chartMs + 13 * L.timing.analyzeMs + 13 * L.timing.scoreMs).toFixed(1)}ms(시각 모름, 표 민감도 제외)`)
  line()

  // 8. 근거 기록 샘플
  line(`### 8. 근거 기록 샘플 (시각 앎, 1·2순위)`)
  for (const s of L.evidenceSamples) {
    const r = s.result
    line(`- #${s.i} \`${s.pillars}\` → **${r.primary.name}** ${r.primary.score}점 / 2순위 ${r.secondary ? `${r.secondary.name} ${r.secondary.score}점` : "없음"} · 차 ${r.margin ?? "-"} · ${r.decidedBy}${r.boundary ? " · 경계" : ""}${r.tableSensitivity?.sensitive ? " · 표 민감" : ""}`)
    for (const t of r.top2) {
      const ev = t.evidence.filter((e) => e.termId !== "require" && e.termId !== "exclude")
      line(`  - ${name.get(t.id)}: ${ev.map((e) => `${e.label} +${e.points} [${Object.entries(e.inputs).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join("/") : v}`).join(", ")}]`).join("; ") || "(발동 항목 없음)"}`)
    }
  }
  if (L.meta.errors.length) {
    line()
    line(`### 오류`)
    for (const e of L.meta.errors.slice(0, 20)) line(`- #${e.i} ${JSON.stringify(e.input)}: ${e.message}`)
  }
  return out.join("\n")
}
