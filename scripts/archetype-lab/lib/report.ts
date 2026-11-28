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
  const cascade = rs.mode === "cascade"
  const exp = new Map(rs.archetypes.map((a) => [a.id, a.expectedShare]))
  const expTxt = (id: string, c: number): string => {
    const e = exp.get(id)
    if (!e) return "- | -"
    const x = N ? c / N : 0
    const band = `${(e[0] * 100).toFixed(0)}~${(e[1] * 100).toFixed(0)}%`
    return `${band} | ${x < e[0] ? "아래" : x > e[1] ? "위" : "안"}`
  }
  if (cascade) {
    line(`### 1. 원형별 비율 (시각 앎 1순위 / 연구소장 추정 / 부 원형 / 시각 모름 세 기둥 1순위)`)
    line(`| 순서 | 원형 | 1순위 | 추정 | 추정 대비 | 부 원형 | 시각 모름 1순위 |`)
    line(`|---:|---|---:|---:|---|---:|---:|`)
    for (const a of [...rs.archetypes].sort((x, y) => x.priority - y.priority))
      line(`| ${a.priority} | ${a.name} \`${a.id}\` | ${pct(prim.get(a.id) ?? 0, N)} | ${expTxt(a.id, prim.get(a.id) ?? 0)} | ${pct(sec.get(a.id) ?? 0, N)} | ${pct(unk.get(a.id) ?? 0, N)} |`)
    line(`| | (부 원형 없음) | | | | ${pct(sec.get("(없음)") ?? 0, N)} | |`)
  } else {
    line(`### 1. 원형별 비율 (시각 앎 1순위 / 2순위 / 시각 모름 세 기둥 1순위)`)
    line(`| 원형 | 1순위 | 2순위 | 시각 모름 1순위 |`)
    line(`|---|---:|---:|---:|`)
    for (const id of ids) line(`| ${name.get(id)} \`${id}\` | ${pct(prim.get(id) ?? 0, N)} | ${pct(sec.get(id) ?? 0, N)} | ${pct(unk.get(id) ?? 0, N)} |`)
  }
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
    line()
    line(`| 원형 | 시각 앎 1순위 중 세 기둥도 같은 원형 | 세 기둥 1순위 중 12시진 모두 같음 | 세 기둥 1순위 중 같은 시진 수 평균 |`)
    line(`|---|---:|---:|---:|`)
    for (const id of ids) {
      const k = R.filter((r) => r.known.primary === id)
      const u = withVar.filter((r) => r.unknown.primary === id)
      line(`| ${name.get(id)} | ${pct(k.filter((r) => r.unknown.primary === id).length, k.length)} | ${pct(u.filter((r) => r.unknown.stable).length, u.length)} | ${u.length ? (u.reduce((a, r) => a + (r.unknown.agree ?? 0), 0) / u.length).toFixed(2) : "-"} |`)
    }
  }
  line()

  // 4. 표 민감도
  const tb = R.filter((r) => r.table)
  line(`### 4. 지장간 표 민감도 (시각 앎, 기본 kr-monthly-30)`)
  if (tb.length) {
    line(`- kr-monthly-30 ↔ cn-lunarjs 1순위 다름: ${pct(tb.filter((r) => r.tableSensitive).length, tb.length)}`)
    line(`- main-only 포함 세 표 중 하나라도 다름: ${pct(tb.filter((r) => r.tableSensitiveIncludingMainOnly).length, tb.length)}`)
    const krOf = (r: SampleRecord) => r.table!.find((x) => x.tableId === "kr-monthly-30")!.primary
    const cnOf = (r: SampleRecord) => r.table!.find((x) => x.tableId === "cn-lunarjs")!.primary
    line()
    line(`| 원형(kr 기준) | 표본 | cn에서 다른 원형 | cn에서 가장 많이 가는 곳 |`)
    line(`|---|---:|---:|---|`)
    for (const id of ids) {
      const g = tb.filter((r) => krOf(r) === id)
      const moved = g.filter((r) => cnOf(r) !== id)
      const to = [...countBy(moved, cnOf).entries()].sort((a, b) => b[1] - a[1])[0]
      line(`| ${name.get(id)} | ${g.length} | ${pct(moved.length, g.length)} | ${to ? `${name.get(to[0])} ${pct(to[1], g.length)}` : "-"} |`)
    }
    const kc = tb.filter((r) => krOf(r) !== cnOf(r))
    const kcTop = [...countBy(kc, (r) => `${name.get(krOf(r))} → ${name.get(cnOf(r))}`).entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    line()
    line(`- kr → cn 이동 상위: ${kcTop.map(([k, v]) => `${k} ${pct(v, N)}`).join(" · ")}`)
  } else line(`- (끔)`)
  line()

  const dec = countBy(R, (r) => r.known.decidedBy)
  if (cascade) {
    const alarm = R.filter((r) => r.known.fallbackSafety)
    line(`### 5. 관문 경보·통과율 (시각 앎)`)
    const va = R.reduce((a, r) => a + (r.variantAlarms ?? 0), 0)
    const vaN = R.reduce((a, r) => a + (r.unknown.hourPrimaries?.length ?? 0) + (r.table?.length ?? 0), 0)
    line(`- **경보(어느 관문에도 안 걸림 → fallbackSafety)**: 시각 앎 ${alarm.length}건 / ${N} · 시각 모름 세 기둥 ${R.filter((r) => r.unknown.fallbackSafety).length}건 / ${N} · 12시진·지장간 표 변형 ${va}건 / ${vaN}회 판정`)
    line(`- 부 원형이 있는 원국 ${pct(R.filter((r) => r.known.secondary).length, N)} · 통과 관문 수 평균 ${(R.reduce((a, r) => a + 1 + (r.known.alsoMatched?.length ?? 0), 0) / Math.max(1, N)).toFixed(2)}`)
    line()
    line(`| 순서 | 원형 | 관문 통과율(순서 무시) | 1순위가 된 비율 | 통과했지만 앞 관문에 빼앗김 |`)
    line(`|---:|---|---:|---:|---:|`)
    for (const a of [...rs.archetypes].sort((x, y) => x.priority - y.priority)) {
      const passN = N - L.ineligible[a.id]
      const first = prim.get(a.id) ?? 0
      line(`| ${a.priority} | ${a.name} | ${pct(passN, N)} | ${pct(first, N)} | ${pct(passN - first, N)} |`)
    }
    line()
  } else {
  // 5. 동점·경계
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

  }

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
    if (r.cascade) {
      const order = r.cascade.trace.length
      line(`- #${s.i} \`${s.pillars}\` → **${r.primary.name}** (관문 ${order}${r.cascade.fallbackSafety ? " · 경보" : ""}) · 부 원형 ${r.secondary ? r.secondary.name : "없음"}${r.tableSensitivity?.sensitive ? ` · 표 민감(cn: ${name.get(r.tableSensitivity.byTable.find((x) => x.tableId === "cn-lunarjs")!.primary)})` : ""}`)
    } else
    line(`- #${s.i} \`${s.pillars}\` → **${r.primary.name}** ${r.primary.score}점 / 2순위 ${r.secondary ? `${r.secondary.name} ${r.secondary.score}점` : "없음"} · 차 ${r.margin ?? "-"} · ${r.decidedBy}${r.boundary ? " · 경계" : ""}${r.tableSensitivity?.sensitive ? " · 표 민감" : ""}`)
    if (r.cascade) {
      const c = r.cascade
      line(`  - 통과 관문 \`${c.ruleId}\`: ${Object.entries(c.matched).map(([k, v]) => `${k}=${Array.isArray(v) ? `[${v.join("/")}]` : v}`).join(", ")}`)
      line(`  - 앞 관문 탈락: ${c.trace.filter((t) => !t.passed).map((t) => `${name.get(t.id)}(${t.failedOn})`).join(" · ") || "(없음 — 첫 관문)"}`)
      line(`  - 함께 통과(부 원형 순): ${c.alsoMatched.map((x) => name.get(x)).join(", ") || "(없음)"}${c.fallbackSafety ? " · **경보 fallbackSafety**" : ""}`)
      continue
    }
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
