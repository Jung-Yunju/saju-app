#!/usr/bin/env node
// O-02 독립 검증 — 실제 기록(events.jsonl)·상태 문서(state.json)에 내용·개인정보가 섞였는지 탐색
// 사용: node tests/office-qa/privacy-scan.mjs <events.jsonl|state.json>... [--transcripts <dir>]
// 출력: 의심 문자열 목록(값은 앞 40자만) + 작업기록 속 "내용"(명령문·검색어·URL·프롬프트) 역조회 결과
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs"
import { join } from "node:path"

const args = process.argv.slice(2)
let tdir = null
const files = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--transcripts") tdir = args[++i]
  else files.push(args[i])
}

// 키 이름별로 허용되는 값 형태(계약서 3·5절)
const ALLOWED_KEY_SHAPES = {
  ts: /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/, at: /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/,
  sessionId: /^[0-9a-f-]{36}$/, agentId: /^[A-Za-z0-9_-]{1,64}$/, targetAgentId: /^[A-Za-z0-9_-]{1,64}$/,
  toolUseId: /^toolu_[A-Za-z0-9]+$/, kind: /^(typing|research|running|delegating|reporting|other)$/,
  cardId: /^(?:P\d|U|O)-\d{2}$/, notif: /^[a-z_]{1,40}$/,
}
const SUSPECT = [
  ["이메일", /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/],
  ["URL", /https?:\/\/|www\./i],
  ["비밀값 패턴", /(sk-[A-Za-z0-9]|ghp_|gho_|xox[bp]-|AKIA[0-9A-Z]{8}|-----BEGIN|Bearer\s+[A-Za-z0-9])/],
  ["비밀번호·키 단어", /(password|passwd|secret=|api[_-]?key\s*[:=]|DATABASE_URL|AUTH_SECRET|TOSS_SECRET)/i],
  ["셸 명령 흔적", /(\|\s*(head|grep|tail|wc)\b|&&|\bnpx\s|\bnode\s+-e|\bcat\s+[\/.~]|\bgit\s+(status|diff|log)|\bcd\s+\/)/],
  ["생년월일 형태", /(19|20)\d{2}[.\/년-]\s?\d{1,2}[.\/월-]\s?\d{1,2}일?/],
  ["전화번호", /01[016789]-?\d{3,4}-?\d{4}/],
  ["주민번호 형태", /\d{6}-[1-4]\d{6}/],
  ["카드번호 형태", /\b\d{4}[- ]\d{4}[- ]\d{4}[- ]\d{4}\b/],
  ["홈 경로·절대경로", /(^|\s)\/(home|root|etc|tmp|Users)\//],
  [".env 노출", /\.env\b/],
]
const LONG = 120

function* walk(v, path = "") {
  if (typeof v === "string") yield [path, v]
  else if (Array.isArray(v)) for (let i = 0; i < v.length; i++) yield* walk(v[i], `${path}[]`)
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) yield* walk(x, path ? `${path}.${k}` : k)
}

const findings = []
const allStrings = new Map() // value → path
for (const f of files) {
  const text = readFileSync(f, "utf8")
  const docs = f.endsWith(".jsonl") ? text.split("\n").filter(Boolean).map(l => JSON.parse(l)) : [JSON.parse(text)]
  for (const d of docs) {
    for (const [p, s] of walk(d)) {
      const key = p.split(".").pop().replace(/\[\]$/, "")
      allStrings.set(s, `${f.split("/").pop()}:${p}`)
      // 날짜(ISO) 필드는 생년월일 패턴 예외
      if (ALLOWED_KEY_SHAPES[key]) {
        if (!ALLOWED_KEY_SHAPES[key].test(s)) findings.push({ file: f, path: p, why: `형태 위반(${key})`, sample: s.slice(0, 40) })
        continue
      }
      if (/^(generatedAt|firstEventAt|lastEventAt|statusSince|startedAt|endedAt|from|to)$/.test(key)) continue
      for (const [why, re] of SUSPECT) if (re.test(s)) findings.push({ file: f, path: p, why, sample: s.slice(0, 40) })
      // 보드에서 온 카드 제목·이슈·승인 항목은 문서 출처이므로 길이 검사만 따로 표시
      if (s.length > LONG) findings.push({ file: f, path: p, why: `긴 문자열(${s.length}자)`, sample: s.slice(0, 40) })
    }
  }
}

// 작업기록 역조회: 명령문·검색어·URL·프롬프트·파일 내용이 결과에 들어갔는지
let leaked = []
let probes = 0
if (tdir && existsSync(tdir)) {
  const jsonls = []
  const rec = d => { for (const n of readdirSync(d)) { const p = join(d, n); const st = statSync(p); if (st.isDirectory()) rec(p); else if (n.endsWith(".jsonl")) jsonls.push(p) } }
  rec(tdir)
  const secrets = new Set()
  const add = s => { if (typeof s === "string") { const t = s.replace(/\s+/g, " ").trim(); if (t.length >= 16) secrets.add(t.slice(0, 60)) } }
  for (const j of jsonls) {
    for (const line of readFileSync(j, "utf8").split("\n")) {
      if (!line.trim()) continue
      let o; try { o = JSON.parse(line) } catch { continue }
      const c = o?.message?.content
      if (o.type === "user" && typeof c === "string") add(c)
      if (!Array.isArray(c)) continue
      for (const b of c) {
        if (b?.type === "tool_use" && b.input) {
          for (const k of ["command", "pattern", "query", "url", "prompt", "content", "old_string", "new_string", "glob"]) add(b.input[k])
        }
        if (b?.type === "text" && o.type === "user") add(b.text)
        if (b?.type === "tool_result") add(typeof b.content === "string" ? b.content : Array.isArray(b.content) ? b.content.map(x => x?.text || "").join(" ") : null)
      }
    }
  }
  probes = secrets.size
  const hay = [...allStrings.keys()]
  for (const s of secrets) {
    const needle = s.slice(0, 40)
    // 업무 설명(60자)과 보드 문서에서 온 문장은 허용 대상이므로 위치를 함께 출력
    const hit = hay.find(h => h.includes(needle))
    if (hit) leaked.push({ needle: needle.slice(0, 40), at: allStrings.get(hit) })
  }
}

const byWhy = {}
for (const x of findings) (byWhy[x.why] ||= []).push(x)
console.log(JSON.stringify({ files, stringCount: allStrings.size, findingCount: findings.length,
  byWhy: Object.fromEntries(Object.entries(byWhy).map(([k, v]) => [k, v.slice(0, 15).map(x => `${x.path} :: ${x.sample}`)])),
  transcriptProbes: probes, transcriptLeaks: leaked.slice(0, 30), leakCount: leaked.length }, null, 2))
