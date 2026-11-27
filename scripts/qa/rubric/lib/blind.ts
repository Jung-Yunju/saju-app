// 대표용 블라인드 채점 시트 (P4-05) — 순수 함수(파일·네트워크 없음). 같은 견본·같은 seed → 같은 시트.
// 원칙
//  - 경쟁사 원문은 이 코드가 받지도, 쓰지도 않는다. 시트(HTML)에 "붙여 넣는 칸"만 두고, 붙여 넣은 글은 그 브라우저 화면에만 보인다
//    (저장·전송·localStorage 없음. 점수 내보내기 JSON에도 원문은 들어가지 않는다).
//  - A/B 배정·견본 순서는 seed로 섞고, 정답표(key)는 시트와 다른 파일에 둔다.
//  - 붙여 넣은 글은 textContent로만 그린다(innerHTML 금지 — 붙여 넣은 HTML이 실행되지 않게).
import { createHash } from "node:crypto"
import type { LoadedSample } from "./load"
import { COMPARE_LABEL, RUBRIC_ITEMS } from "./rubric"
import { sentencesOf } from "./metrics"

export const BLIND_VERSION = "blind-sheet@0.1.0"

// ─────────────────────────────────────────── 결정론적 난수

export function seededRandom(seed: string): () => number {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(xs: readonly T[], rnd: () => number): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─────────────────────────────────────────── 견본 → 읽기용 평문

const DEFAULT_MASK = ["할미", "할머니", "복자"]
const HIDE_FIELDS = new Set(["pos", "chapter_id", "element", "key", "id", "ganzhi", "letter", "year"])
const FIELD_LABEL: Record<string, string> = { todo: "오늘부터 할 일", ask: "물음", caveat: "참고" }

export function maskWords(text: string, words: readonly string[]): string {
  let t = text
  for (const w of [...words].filter(Boolean).sort((a, b) => b.length - a.length)) t = t.split(w).join("풀이자")
  return t
}

const strip = (s: string) => s.replace(/<[^>]*>/g, "")

/** 장 출력 하나를 사람이 읽을 평문 줄로 */
export function renderChapterText(output: unknown): string[] {
  const out: string[] = []
  const walk = (node: unknown, field: string, depth: number) => {
    if (typeof node === "string") {
      const t = strip(node).trim()
      if (!t || HIDE_FIELDS.has(field)) return
      if (field === "title" && depth === 1) out.push(`■ ${t}`)
      else if (FIELD_LABEL[field]) out.push(`${FIELD_LABEL[field]}: ${t}`)
      else out.push(t)
      return
    }
    if (Array.isArray(node)) {
      node.forEach((v) => walk(v, field, depth))
      return
    }
    if (node && typeof node === "object") {
      const o = node as Record<string, unknown>
      // 근거 칩 {letter, pos, label} → 한 줄
      if (typeof o.letter === "string" && typeof o.label === "string" && Object.keys(o).length <= 4) {
        out.push(`[근거 ${strip(o.letter)} · ${strip(o.label)}]`)
        return
      }
      if (typeof o.year === "number" && typeof o.ganzhi === "string") out.push(`— ${o.year}년 ${o.ganzhi}`)
      for (const [k, v] of Object.entries(o)) walk(v, k, depth + 1)
    }
  }
  walk(output, "", 0)
  return out
}

export function sampleText(s: LoadedSample, mask: readonly string[]): string {
  const lines: string[] = []
  for (const ch of s.chapters) {
    if (!ch.ok || !ch.output) {
      lines.push(`■ (이 장은 생성 실패: ${ch.id})`, "")
      continue
    }
    lines.push(...renderChapterText(ch.output), "")
  }
  return maskWords(lines.join("\n").trim(), mask)
}

// ─────────────────────────────────────────── 시트 구성

export interface BlindOptions {
  seed: string
  /** 경쟁사 칸을 둘 인물(persona). 대표가 같은 생년월일로 경쟁사 풀이를 산 인물 */
  compare: readonly string[]
  /** 구체성 표본 검사: 견본마다 뽑을 문장 수(기본 8) */
  swapPerSample?: number
  /** 이름 가리기(기본 할미·할머니·복자). [] = 가리지 않음 */
  maskWords?: readonly string[]
}

export interface BlindKey {
  version: string
  sheetId: string
  seed: string
  compare: { n: number; persona: string; ours: "A" | "B" }[]
  ours: { id: string; persona: string; file: string }[]
  swap: { id: string; persona: string; chapterId: string }[]
}

export interface BlindSheet {
  html: string
  key: BlindKey
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}

function ratingBlock(prefix: string, compare: boolean): string {
  return RUBRIC_ITEMS.map(({ key, label, short }) => {
    const name = `${prefix}.${key}`
    const lab = compare ? (COMPARE_LABEL[key] ?? label) : label
    const radios = [1, 2, 3, 4, 5].map((v) => `<label class="r"><input type="radio" name="${esc(name)}" value="${v}">${v}</label>`).join("")
    return `<div class="item"><div class="lab">${esc(lab)} <small>${esc(short)}</small></div><div class="radios">${radios}</div></div>`
  }).join("")
}

function subjectLine(s: LoadedSample): string {
  const f = s.facts
  if (!f) return "(사실표 없음)"
  const p = f.chart.pillars
  return `원국 ${p.year} ${p.month} ${p.day} ${p.hour ?? "(시 모름)"} · ${f.subject.gender === "M" ? "남" : "여"} · 만 ${f.subject.ageYears}세`
}

export function buildBlindSheet(samples: readonly LoadedSample[], opts: BlindOptions): BlindSheet {
  const mask = opts.maskWords ?? DEFAULT_MASK
  const per = opts.swapPerSample ?? 8
  const unknown = opts.compare.filter((p) => !samples.some((s) => s.persona === p))
  if (unknown.length) throw new Error(`--compare에 없는 인물: ${unknown.join(", ")}`)
  const sheetId = createHash("sha256")
    .update([BLIND_VERSION, opts.seed, ...samples.map((s) => s.persona), "|", ...opts.compare].join("\n"))
    .digest("hex")
    .slice(0, 12)
  const rnd = seededRandom(`${opts.seed}:${sheetId}`)

  // 1) 경쟁사 비교(A/B)
  const compare = opts.compare.map((persona, i) => ({ n: i + 1, persona, ours: (rnd() < 0.5 ? "A" : "B") as "A" | "B" }))
  // 2) 우리 견본 단독 채점(순서 섞기)
  const ours = shuffle(samples, rnd).map((s, i) => ({ id: `S${i + 1}`, persona: s.persona, file: s.file, s }))
  // 3) 구체성 표본 검사(인물을 섞어서, 간지·숫자·십성 가림)
  const pool: { persona: string; chapterId: string; text: string }[] = []
  for (const s of samples) {
    const recs = sentencesOf(s).filter((r) => !r.fixed && (r.kind === "narrative" || r.kind === "prose") && [...r.norm].length >= 12)
    for (const r of shuffle(recs, rnd).slice(0, per)) pool.push({ persona: s.persona, chapterId: r.chapterId, text: r.text })
  }
  const swap = shuffle(pool, rnd).map((x, i) => ({ id: `Q${i + 1}`, ...x }))

  const key: BlindKey = {
    version: BLIND_VERSION,
    sheetId,
    seed: opts.seed,
    compare,
    ours: ours.map(({ id, persona, file }) => ({ id, persona, file })),
    swap: swap.map(({ id, persona, chapterId }) => ({ id, persona, chapterId })),
  }

  const bySample = new Map(samples.map((s) => [s.persona, s]))
  const compareHtml = compare
    .map((c) => {
      const s = bySample.get(c.persona)!
      const oursText = esc(sampleText(s, mask))
      const slot = (ab: "A" | "B") =>
        c.ours === ab
          ? `<pre class="text">${oursText}</pre>`
          : `<pre class="text pasted" data-from="paste-${c.n}">(아래 붙여 넣기 칸에 경쟁사 풀이를 넣으면 여기에 보입니다)</pre>`
      return `<section class="cmp" data-n="${c.n}">
<h2>비교 ${c.n} <small>${esc(subjectLine(s))}</small></h2>
<details class="paste"><summary>경쟁사 풀이 붙여 넣기 — 이 칸의 글은 이 화면에만 보이고 어디에도 저장·전송되지 않습니다</summary>
<textarea id="paste-${c.n}" rows="6" placeholder="경쟁사 풀이 본문을 붙여 넣으세요"></textarea></details>
<div class="ab">
<div class="slot"><h3>풀이 A</h3>${slot("A")}<div class="rate">${ratingBlock(`cmp${c.n}.A`, true)}<label class="price">낼 만한 값(원) <input type="number" min="0" step="1000" name="cmp${c.n}.A.price"></label></div></div>
<div class="slot"><h3>풀이 B</h3>${slot("B")}<div class="rate">${ratingBlock(`cmp${c.n}.B`, true)}<label class="price">낼 만한 값(원) <input type="number" min="0" step="1000" name="cmp${c.n}.B.price"></label></div></div>
</div>
<div class="prefer">돈을 낸다면 어느 쪽? <label><input type="radio" name="cmp${c.n}.prefer" value="A">A</label> <label><input type="radio" name="cmp${c.n}.prefer" value="B">B</label> <label><input type="radio" name="cmp${c.n}.prefer" value="same">비슷함</label></div>
<label class="note">짧은 관찰(원문을 옮겨 적지 마세요) <input type="text" maxlength="200" name="cmp${c.n}.note"></label>
</section>`
    })
    .join("\n")

  const oursHtml = ours
    .map(
      (o) => `<section class="one" data-id="${o.id}">
<h2>견본 ${esc(o.id)} <small>${esc(subjectLine(o.s))}</small></h2>
<pre class="text">${esc(sampleText(o.s, mask))}</pre>
<div class="rate">${ratingBlock(`ours.${o.id}`, false)}</div>
<label class="note">짧은 관찰 <input type="text" maxlength="200" name="ours.${o.id}.note"></label>
</section>`,
    )
    .join("\n")

  const swapHtml = swap
    .map(
      (q) => `<div class="q"><div class="qt">${esc(q.id)}. ${esc(maskWords(maskLetters(q.text), mask))}</div>
<label><input type="radio" name="swap.${q.id}" value="generic">누구에게나 통함</label> <label><input type="radio" name="swap.${q.id}" value="specific">특정한 사람 얘기</label></div>`,
    )
    .join("\n")

  const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'none'; connect-src 'none'; form-action 'none'">
<meta name="robots" content="noindex">
<title>블라인드 채점 시트 ${esc(sheetId)}</title>
<style>
body{font-family:system-ui,-apple-system,"Noto Sans KR",sans-serif;margin:0 auto;max-width:1100px;padding:12px;line-height:1.6;color:#222}
h1{font-size:1.3rem}h2{font-size:1.1rem;border-top:2px solid #333;padding-top:10px}h2 small{font-weight:normal;color:#666;font-size:.85rem}
.ab{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:720px){.ab{grid-template-columns:1fr}}
.text{white-space:pre-wrap;word-break:keep-all;background:#faf8f3;border:1px solid #ddd;padding:10px;max-height:60vh;overflow:auto;font-family:inherit;font-size:.95rem}
.item{display:flex;flex-wrap:wrap;justify-content:space-between;border-bottom:1px dotted #ccc;padding:4px 0}.lab small{color:#777;display:block;font-size:.75rem}
.r{margin-left:6px;white-space:nowrap}.note,.price{display:block;margin:6px 0}.note input{width:100%}
.q{border-bottom:1px dotted #ccc;padding:6px 0}.qt{margin-bottom:4px}
textarea{width:100%;box-sizing:border-box}.guide{background:#eef3f8;padding:10px;border-radius:6px}
button{font-size:1rem;padding:8px 14px;margin:8px 0}
</style></head><body>
<h1>견본 풀이 블라인드 채점 시트 <small>${esc(sheetId)}</small></h1>
<div class="guide">
<p>1) 비교 칸: 같은 생년월일로 받은 두 풀이(A·B) 중 하나가 우리 것, 하나가 경쟁사 것입니다. 경쟁사 글은 「붙여 넣기」 칸에 넣으면 정해진 쪽에 나타납니다. 이름(할미 등)은 "풀이자"로 가렸습니다.${mask.length ? "" : " (이번 시트는 이름을 가리지 않았습니다)"}</p>
<p>2) 점수는 1~5점, 기준은 docs/quality/rubric.md. 다 매기면 맨 아래 「점수 내보내기」를 누르세요. 내보낸 파일에는 <b>점수와 짧은 관찰만</b> 들어가고 풀이 원문은 들어가지 않습니다.</p>
<p>3) 이 파일은 인터넷에 연결하지 않으며, 붙여 넣은 글을 저장하지 않습니다(창을 닫으면 사라집니다).</p>
<p>가릴 낱말 더하기(경쟁사 상호 등, 쉼표로): <input type="text" id="extraMask" size="30"></p>
</div>
${compare.length ? `<h1>1. 경쟁사와 나란히</h1>\n${compareHtml}` : "<p>(이번 시트에는 경쟁사 비교 칸이 없습니다)</p>"}
<h1>2. 우리 견본 채점(순서 섞음)</h1>
${oursHtml}
<h1>3. 구체성 표본 검사</h1>
<p class="guide">여러 견본에서 무작위로 뽑은 문장입니다. 간지 한자·숫자·십성 이름은 ○로 가렸습니다. 가린 채로 읽어도 <b>누구에게나 해당되는 말</b>이면 「누구에게나 통함」을 고르세요.</p>
${swapHtml}
<button id="export" type="button">점수 내보내기(JSON)</button>
<script>
(function(){
  var SHEET=${JSON.stringify(sheetId)}, VERSION=${JSON.stringify(BLIND_VERSION)}, CMP=${JSON.stringify(compare.map((c) => c.n))};
  var BASE_MASK=${JSON.stringify(mask)};
  function masked(t){var w=BASE_MASK.concat((document.getElementById('extraMask').value||'').split(',').map(function(x){return x.trim()}).filter(Boolean));
    w.sort(function(a,b){return b.length-a.length});w.forEach(function(x){t=t.split(x).join('풀이자')});return t}
  function refresh(n){var ta=document.getElementById('paste-'+n);var out=document.querySelector('[data-from="paste-'+n+'"]');if(!ta||!out)return;
    out.textContent=ta.value?masked(ta.value):'(아래 붙여 넣기 칸에 경쟁사 풀이를 넣으면 여기에 보입니다)'}
  CMP.forEach(function(n){var ta=document.getElementById('paste-'+n);if(ta)ta.addEventListener('input',function(){refresh(n)})});
  document.getElementById('extraMask').addEventListener('input',function(){CMP.forEach(refresh)});
  document.getElementById('export').addEventListener('click',function(){
    var data={sheetId:SHEET,version:VERSION,ratings:{},notes:{},swap:{}};
    document.querySelectorAll('input').forEach(function(el){
      if(!el.name)return;
      if(el.type==='radio'){if(!el.checked)return;
        if(el.name.indexOf('swap.')===0){data.swap[el.name.slice(5)]=el.value;return}
        data.ratings[el.name]=/^[1-5]$/.test(el.value)?Number(el.value):el.value;return}
      if(el.type==='number'){if(el.value!=='')data.ratings[el.name]=Number(el.value);return}
      if(el.type==='text'&&el.value)data.notes[el.name]=el.value.slice(0,200);
    });
    var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='blind-scores-'+SHEET+'.json';document.body.appendChild(a);a.click();a.remove();
  });
})();
</script>
</body></html>
`
  return { html, key }
}

/** 표본 검사용: 간지 한자·한글(한자) 병기·숫자·십성 이름을 ○로 가린 읽을 수 있는 문장 */
export function maskLetters(text: string): string {
  return strip(text)
    .replace(/[가-힣]{1,2}\([一-鿿]{1,2}\)/g, "○")
    .replace(/[一-鿿]+/g, "○")
    .replace(/\d+/g, "○")
    .replace(/비견|겁재|식신|상관|편재|정재|편관|정관|편인|정인|칠살|비겁|식상|재성|관성|관살|인성/g, "○○")
}

// ─────────────────────────────────────────── 블라인드 풀기(점수 JSON + 정답표 → 결과)

export interface ExportedScores {
  sheetId: string
  version?: string
  ratings: Record<string, number | string>
  notes?: Record<string, string>
  swap?: Record<string, string>
}

export function ratingsFor(prefix: string, sc: ExportedScores): Record<string, number> {
  const out: Record<string, number> = {}
  for (const { key } of RUBRIC_ITEMS) {
    const v = sc.ratings[`${prefix}.${key}`]
    if (typeof v === "number") out[key] = v
  }
  return out
}
