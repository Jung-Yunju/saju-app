// 견본 풀이 화면(index.html) — 대표가 브라우저로 여는 한 장짜리 파일. 외부 파일·스크립트를 부르지 않는다.
// 모든 글자는 이스케이프한다. 본문(body) 문단의 <b></b>만 다시 살린다(프롬프트 규칙과 같음).
// 실명·생년월일·키는 싣지 않는다: 인물은 나이대·성별·계절·원국만 보인다.
import type { SampleChapter, SampleRecord } from "./lib"

export const KRW_PER_USD = 1400

export function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** 본문 문단: 이스케이프 후 <b>·</b>만 복원 */
function para(v: unknown): string {
  return esc(v).replace(/&lt;b&gt;/g, "<b>").replace(/&lt;\/b&gt;/g, "</b>")
}

export const usd = (n: number | undefined) => `$${(n ?? 0).toFixed(4)}`
export const krw = (n: number | undefined) => `${Math.round((n ?? 0) * KRW_PER_USD).toLocaleString("ko-KR")}원`

const FIELD_KO: Record<string, string> = {
  todo: "오늘부터 할 일",
  ask: "너에게 묻는 말",
  caveat: "밝혀 둘 불확실성",
  fits: "값이 오르는 자리",
  habits: "돈 버릇",
  faces: "얼굴 세 가지",
  best: "잘 오면",
  half: "반쯤 오면",
  worst: "잘못 오면",
  earn: "버는 법",
  keep: "모으는 법",
  leak: "새는 곳",
  place: "자리",
  text: "이유",
}

function renderValue(v: unknown, key = ""): string {
  if (v === null || v === undefined || v === "") return '<span class="muted">(비움)</span>'
  if (Array.isArray(v)) return `<ul>${v.map((x) => `<li>${renderValue(x, key)}</li>`).join("")}</ul>`
  if (typeof v === "object")
    return `<dl>${Object.entries(v as Record<string, unknown>)
      .map(([k, x]) => `<dt>${esc(FIELD_KO[k] ?? k)}</dt><dd>${renderValue(x, k)}</dd>`)
      .join("")}</dl>`
  return key === "body" ? para(v) : esc(v)
}

function renderOutput(out: unknown): string {
  if (!out || typeof out !== "object" || Array.isArray(out)) return `<pre>${esc(JSON.stringify(out, null, 2))}</pre>`
  const o = out as Record<string, unknown>
  const parts: string[] = []
  if (o.title) parts.push(`<h4>${esc(o.title)}</h4>`)
  if (o.sub) parts.push(`<p class="sub">${esc(o.sub)}</p>`)
  if (Array.isArray(o.chips) && o.chips.length)
    parts.push(
      `<div class="chips">${o.chips
        .map((c) => {
          const x = (c ?? {}) as Record<string, unknown>
          return `<span class="chip"><b>${esc(x.letter)}</b> ${esc(x.label)} <small>${esc(x.pos)}</small></span>`
        })
        .join("")}</div>`,
    )
  if (Array.isArray(o.body)) parts.push(o.body.map((p) => `<p>${para(p)}</p>`).join(""))
  const rest = Object.entries(o).filter(([k]) => !["title", "sub", "chips", "body"].includes(k))
  if (rest.length) parts.push(`<dl class="rest">${rest.map(([k, v]) => `<dt>${esc(FIELD_KO[k] ?? k)}</dt><dd>${renderValue(v, k)}</dd>`).join("")}</dl>`)
  return parts.join("\n")
}

interface FindingLike {
  severity?: string
  code?: string
  message?: string
  excerpt?: string
  location?: { path?: string }
}

function renderFindings(findings: unknown[] | undefined): string {
  const list = (findings ?? []).filter((f): f is FindingLike => !!f && typeof f === "object")
  if (!list.length) return '<p class="muted">검증기 지적 없음</p>'
  return `<ul class="findings">${list
    .map(
      (f) =>
        `<li class="sev-${esc(f.severity)}"><span class="sev">${esc(f.severity)}</span> <code>${esc(f.code)}</code> ${esc(f.message)}${
          f.excerpt ? ` <q>${esc(f.excerpt)}</q>` : ""
        }${f.location?.path ? ` <small>${esc(f.location.path)}</small>` : ""}</li>`,
    )
    .join("")}</ul>`
}

const VERDICT_KO: Record<SampleChapter["verdict"], string> = {
  pass: "통과",
  block: "차단(block)",
  error: "실패",
  skipped: "건너뜀",
}

function renderChapter(c: SampleChapter): string {
  const counts = c.verify?.counts
  const warnNote = counts ? ` · block ${counts.block ?? 0} · warn ${counts.warn ?? 0} · info ${counts.info ?? 0}` : ""
  const u = c.usage
  const cost = u
    ? `${usd(u.costUsdEstimate)} (≈${krw(u.costUsdEstimate)}) · 입력 ${u.inputTokens + u.cacheReadTokens + u.cacheWriteTokens} (캐시읽기 ${u.cacheReadTokens}, 캐시쓰기 ${u.cacheWriteTokens}) · 출력 ${u.outputTokens}`
    : "호출 없음"
  const lastDraft = c.drafts.length ? c.drafts[c.drafts.length - 1] : undefined
  const body = c.ok
    ? renderOutput(c.output)
    : `<p class="err">이 장은 고객에게 나가지 않는 상태입니다 — ${esc(c.error ?? "")}</p>${
        lastDraft
          ? `<details><summary>차단된 마지막 초안 보기 (검토용 · 고객 비노출)</summary><div class="draft">${renderOutput(lastDraft.output)}</div></details>`
          : ""
      }`
  const history =
    c.drafts.length > 1
      ? `<details><summary>시도별 검증 기록 ${c.drafts.length}회</summary><ul>${c.drafts
          .map((d) => `<li>${d.attempt}번째 초안: ${d.pass ? "통과" : "차단"} (block ${d.counts.block ?? 0}, warn ${d.counts.warn ?? 0})</li>`)
          .join("")}</ul></details>`
      : ""
  return `<section class="chapter v-${c.verdict}">
<header><h3>${esc(c.title)} <small>${esc(c.id)}</small></h3><span class="badge b-${c.verdict}">${VERDICT_KO[c.verdict]}</span></header>
<p class="meta">시도 ${c.attempts}회${warnNote} · 비용 ${cost}</p>
${body}
<div class="verify"><h5>검증기 판정</h5>${renderFindings(c.verify?.findings)}</div>
${history}
</section>`
}

function renderPersona(r: SampleRecord): string {
  const f = r.facts
  const p = f?.chart.pillars
  const won = p ? `${p.year} · ${p.month} · ${p.day} · ${p.hour ?? "시 모름"} <small>(연·월·일·시)</small>` : "(계산 실패)"
  const strength = f?.chart.strength
    ? `${esc(f.chart.strength.verdict)}${f.chart.strength.views?.length ? ` <small>(${f.chart.strength.views.map((v) => `${esc(v.method)} ${esc(v.verdict)}`).join(" / ")})</small>` : ""}`
    : "(없음)"
  const useful = f?.chart.usefulGod?.length ? f.chart.usefulGod.map((u) => `${esc(u.method)}: ${esc(u.element)}`).join(" / ") : "(없음)"
  const userFacts = f?.personal.userFacts.length
    ? `<p><b>설문 답(${esc(r.persona.surveyNote ?? "예시")}):</b> ${f.personal.userFacts.map((u) => `${esc(u.topic)}=${esc(u.value)}${u.period ? `(${esc(u.period)})` : ""}`).join(" · ")}</p>`
    : '<p class="muted">설문 답 없음</p>'
  const warnings = f?.warnings.length ? `<ul class="warn">${f.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : ""
  const t = r.totals
  return `<article class="persona" id="${esc(r.persona.id)}-${esc(r.model)}">
<header>
<h2>${esc(r.persona.id)} · ${esc(r.persona.label)} <span class="fict">가상 인물 · 실존 아님</span></h2>
<p class="model">모델 <code>${esc(r.model)}</code>${r.fake ? ' <span class="fake">가짜 응답(연습 실행) — 실제 AI 글 아님</span>' : ""}${r.stopped ? ` <span class="err">중단: ${esc(r.stopped)}</span>` : ""}</p>
</header>
<div class="summary">
<p><b>나이대</b> ${esc(r.persona.ageBand)} · <b>성별</b> ${r.persona.gender === "F" ? "여" : "남"} · <b>태어난 계절</b> ${esc(r.persona.season)}${r.persona.flags.length ? ` · <b>특징</b> ${r.persona.flags.map(esc).join(", ")}` : ""}</p>
<p><b>원국</b> ${won} · <b>일간</b> ${esc(f?.chart.dayMaster.stem)}(${esc(f?.chart.dayMaster.element)})</p>
<p><b>신강약</b> ${strength} · <b>용신 관점</b> ${useful}</p>
${userFacts}
${warnings}
<p class="why"><b>고른 이유</b> ${esc(r.persona.why)}</p>
<p class="meta">이 모델 합계: 장 ${r.chapters.length}개 중 통과 ${r.chapters.filter((c) => c.verdict === "pass").length} · 차단 ${r.chapters.filter((c) => c.verdict === "block").length} · 실패/건너뜀 ${r.chapters.filter((c) => c.verdict === "error" || c.verdict === "skipped").length} · 호출 ${t.calls}회 · ${usd(r.cumulative.costUsdEstimate)} (≈${krw(r.cumulative.costUsdEstimate)}) · ${(r.elapsedMs / 1000).toFixed(0)}초</p>
${r.notes.length ? `<ul class="notes">${r.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
</div>
${r.chapters.map(renderChapter).join("\n")}
</article>`
}

const CSS = `
body{font-family:system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;max-width:960px;margin:0 auto;padding:16px;line-height:1.65;color:#222;background:#fbfaf7}
h1{font-size:1.5rem}h2{font-size:1.2rem;margin:0}h3{font-size:1.05rem;margin:0}h4{margin:.4rem 0;font-size:1.05rem}
.banner{background:#fff3cd;border:1px solid #e0c36a;padding:10px 14px;border-radius:8px}
table{border-collapse:collapse;width:100%;font-size:.9rem}td,th{border:1px solid #ddd;padding:4px 6px;text-align:left}th{background:#f1eee6}
.persona{background:#fff;border:1px solid #ddd;border-radius:10px;padding:14px;margin:22px 0}
.fict{font-size:.75rem;background:#eee;border-radius:6px;padding:2px 6px;margin-left:6px;font-weight:normal}
.fake{background:#fde2e2;color:#8a1c1c;border-radius:6px;padding:2px 6px}
.summary{background:#f7f5ef;border-radius:8px;padding:8px 12px;margin:10px 0}
.chapter{border-top:1px dashed #ccc;padding:12px 0}.chapter header{display:flex;justify-content:space-between;align-items:center;gap:8px}
.badge{font-size:.8rem;border-radius:6px;padding:2px 8px;white-space:nowrap}.b-pass{background:#d7f0dc;color:#1d5e2c}.b-block{background:#fbd5d5;color:#8a1c1c}.b-error,.b-skipped{background:#eee;color:#555}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.chip{background:#eef3fb;border:1px solid #c9d6ee;border-radius:14px;padding:2px 10px;font-size:.85rem}.chip small{color:#777}
.sub{color:#666;margin-top:0}.meta{color:#666;font-size:.85rem}.muted{color:#999}.err{color:#8a1c1c}
.findings{font-size:.85rem;padding-left:18px}.sev{font-weight:bold;text-transform:uppercase}.sev-block{color:#8a1c1c}.sev-warn{color:#8a5a00}.sev-info{color:#777}
.warn{color:#8a5a00;font-size:.85rem}.why{font-size:.9rem}.draft{opacity:.85;border-left:3px solid #e8a0a0;padding-left:10px}
dl.rest dt,dl dt{font-weight:bold;font-size:.85rem;color:#555}dl dd{margin:0 0 6px 0}
code{background:#f1eee6;padding:0 4px;border-radius:4px}
`

export interface IndexMeta {
  title?: string
  generatedAt: string
  folderLabel: string
}

/** 폴더 안 모든 견본 기록 → index.html 문자열 */
export function renderIndexHtml(records: SampleRecord[], meta: IndexMeta): string {
  const rows = records
    .map((r) => {
      const pass = r.chapters.filter((c) => c.verdict === "pass").length
      const block = r.chapters.filter((c) => c.verdict === "block").length
      const other = r.chapters.length - pass - block
      const tok = r.totals.inputTokens + r.totals.cacheReadTokens + r.totals.cacheWriteTokens + r.totals.outputTokens
      return `<tr><td><a href="#${esc(r.persona.id)}-${esc(r.model)}">${esc(r.persona.id)}</a> ${esc(r.persona.label)}</td><td><code>${esc(r.model)}</code>${r.fake ? " (가짜)" : ""}</td><td>${pass}</td><td>${block}</td><td>${other}</td><td>${tok.toLocaleString("ko-KR")}</td><td>${usd(r.cumulative.costUsdEstimate)}</td><td>${(r.elapsedMs / 1000).toFixed(0)}초</td></tr>`
    })
    .join("")
  const total = records.reduce((n, r) => n + r.cumulative.costUsdEstimate, 0)
  const anyFake = records.some((r) => r.fake)
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(meta.title ?? "견본 풀이")} — ${esc(meta.folderLabel)}</title>
<style>${CSS}</style></head>
<body>
<h1>${esc(meta.title ?? "견본 풀이 (기본 풀이 8장)")}</h1>
<div class="banner">
<p><b>모두 가상 인물입니다(실존 아님).</b> 이름은 없고, 출생 정보는 검증용으로 지어낸 값입니다. 설문 답도 "예시"로 지어낸 것입니다.</p>
<p>장마다 <b>검증기 판정</b>이 붙어 있습니다. <b>차단(block)</b> 된 장은 실제 서비스에서는 고객에게 나가지 않습니다(검토용으로 초안만 접어 둠). <b>warn</b>은 고객에게 나가되 손볼 거리입니다.</p>
<p>비용은 토큰 사용량 × 단가표(src/engine/content/cost.ts)로 낸 <b>추정값</b>이며 1달러=${KRW_PER_USD.toLocaleString("ko-KR")}원 가정입니다. 실제 청구액은 Anthropic 콘솔에서 확인합니다.</p>
${anyFake ? '<p class="fake">이 폴더에는 가짜 응답(연습 실행) 결과가 섞여 있습니다 — 그 장의 글은 AI가 쓴 것이 아닙니다.</p>' : ""}
<p class="meta">폴더 ${esc(meta.folderLabel)} · 화면 생성 ${esc(meta.generatedAt)} · 기록 ${records.length}건 · 추정 비용 합계 ${usd(total)} (≈${krw(total)})</p>
</div>
<h2 style="margin-top:18px">요약</h2>
<table><thead><tr><th>인물</th><th>모델</th><th>통과</th><th>차단</th><th>실패/건너뜀</th><th>토큰</th><th>비용</th><th>시간</th></tr></thead><tbody>${rows}</tbody></table>
${records.map(renderPersona).join("\n")}
</body></html>
`
}
