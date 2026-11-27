#!/usr/bin/env node
// 가상 사무실 수집 Hook (O-02) — 규격: office/CONTRACT.md 3절
//
// Claude Code Hook이 stdin으로 넘기는 JSON 하나를 읽어 이벤트 한 줄을
// <저장소 루트>/.claude/office/events.jsonl 에 추가한다.
//   - 저장소 루트는 이 파일 위치(.claude/hooks/) 기준으로 계산한다.
//   - 환경변수 OFFICE_EVENTS_DIR 이 있으면 그 폴더에 쓴다(테스트용).
//   - 내용(명령문·파일 내용·프롬프트·도구 결과·검색어·URL·마지막 보고문)은 절대 저장하지 않는다.
//   - 어떤 오류가 나도 아무것도 출력하지 않고 종료 코드 0으로 끝낸다(업무 방해 금지).
//   - 외부 패키지 없음(Node 내장 모듈만).
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from "node:fs"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

export const SCHEMA_VERSION = 1
export const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_STDIN_BYTES = 32 * 1024 * 1024
const DESC_MAX = 60

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")

// 계약서 2절 — 추적 대상 직원(ceo 제외). 이 목록 밖의 agent_type 은 guest.
export const KNOWN_STAFF = [
  "business-strategist",
  "saju-engine-developer",
  "frontend-developer",
  "backend-developer",
  "qa-security-lead",
  "myeongri-research-director",
  "personalization-researcher",
  "design-director",
  "content-writer",
]

export const HOOK_EVENTS = [
  "SessionStart", "SessionEnd", "PreToolUse", "PostToolUse", "PostToolUseFailure",
  "SubagentStart", "SubagentStop", "Notification", "PermissionRequest", "Stop",
]

export const PRIVATE_FILE = "[비공개 파일]"
export const OUTSIDE_PATH = "[외부 경로]"
export const CARD_ID_RE = /\b(?:P\d|U|O)-\d{2}\b/

/** agent_type → staffId (계약서 2절) */
export function staffFromAgentType(agentType) {
  if (agentType === undefined || agentType === null || agentType === "") return "main"
  if (typeof agentType !== "string") return "guest"
  return KNOWN_STAFF.includes(agentType) ? agentType : "guest"
}

/** 도구 이름 → kind (계약서 3절) */
export function classifyTool(tool) {
  if (typeof tool !== "string" || !tool) return null
  if (["Edit", "Write", "NotebookEdit", "MultiEdit"].includes(tool)) return "typing"
  if (["Read", "Grep", "Glob", "WebSearch", "WebFetch", "LS", "NotebookRead"].includes(tool)) return "research"
  if (tool.startsWith("mcp__") && /(web|fetch|search|browse|crawl|scrape)/i.test(tool)) return "research"
  if (["Agent", "Task"].includes(tool)) return "delegating"
  if (["SubagentHandback", "SendUserMessage"].includes(tool)) return "reporting"
  if (["Bash", "BashOutput", "KillShell", "KillBash", "PowerShell", "Monitor"].includes(tool) || tool.startsWith("mcp__")) return "running"
  if (["TodoWrite", "ToolSearch", "AskUserQuestion", "ExitPlanMode", "EnterPlanMode", "Skill"].includes(tool)) return "other"
  return "running"
}

// 제어문자 제거 + 길이 제한(로그 한 줄을 깨지 않게)
function clean(s, max) {
  if (typeof s !== "string") return null
  // eslint-disable-next-line no-control-regex
  const t = s.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, " ").replace(/\s+/g, " ").trim()
  if (!t) return null
  return t.length > max ? t.slice(0, max - 1) + "…" : t
}

/**
 * 경로 가림 규칙 (계약서 1절 3항)
 * - `.env` 가 들어간 경로 → [비공개 파일]
 * - 저장소 안 → 저장소 기준 상대경로(슬래시)
 * - 저장소 밖 → [외부 경로]
 */
export function sanitizePath(p, opts = {}) {
  if (typeof p !== "string" || !p.trim()) return null
  const root = opts.root || REPO_ROOT
  const raw = p.trim()
  const ENV = /\.env/i
  if (!isAbsolute(raw) && ENV.test(raw)) return PRIVATE_FILE
  let abs
  try {
    abs = isAbsolute(raw) ? resolve(raw) : resolve(opts.cwd && isAbsolute(opts.cwd) ? opts.cwd : root, raw)
  } catch {
    return OUTSIDE_PATH
  }
  const rel = relative(root, abs)
  const outside = rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel)
  // 저장소 안은 저장소 기준 경로로, 밖은 전체 경로로 .env 여부를 본다
  if (ENV.test(outside ? abs : rel)) return PRIVATE_FILE
  if (rel === "") return "."
  if (outside) return OUTSIDE_PATH
  const out = rel.split(sep).join("/")
  return clean(out, 300)
}

/** tool_input 에서 경로 하나만 꺼낸다(명령문·검색어·URL은 보지 않는다) */
export function pathFromToolInput(input) {
  if (!input || typeof input !== "object") return null
  for (const k of ["file_path", "notebook_path", "path"]) {
    if (typeof input[k] === "string" && input[k]) return input[k]
  }
  return null
}

/** 업무 설명에서 카드 ID 추출 */
export function extractCardId(...texts) {
  for (const t of texts) {
    if (typeof t !== "string") continue
    const m = t.match(CARD_ID_RE)
    if (m) return m[0]
  }
  return null
}

function num(v) {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return Math.round(v)
  if (typeof v === "string" && /^\d{1,15}$/.test(v.trim())) return Number(v.trim())
  return null
}

/**
 * Agent 도구 결과(tool_response)에서 토큰만 꺼낸다. 형태가 문서와 다를 수 있으므로 방어적으로 파싱.
 * 반환: {input, output, cacheRead, cacheWrite, total, agentId} 또는 null. 결과 본문은 반환하지 않는다.
 */
export function parseTokens(resp) {
  let r = resp
  if (typeof r === "string") {
    const s = r.trim()
    if (s.startsWith("{")) {
      try { r = JSON.parse(s) } catch { r = s }
    }
  }
  let agentId = null
  let usage = null
  let total = null
  let text = null
  if (r && typeof r === "object" && !Array.isArray(r)) {
    agentId = typeof r.agentId === "string" ? r.agentId : typeof r.agent_id === "string" ? r.agent_id : null
    usage = r.usage && typeof r.usage === "object" ? r.usage : null
    total = num(r.totalTokens) ?? num(r.total_tokens)
    if (Array.isArray(r.content)) text = r.content.map(c => (c && typeof c.text === "string" ? c.text : "")).join("\n")
  } else if (Array.isArray(r)) {
    text = r.map(c => (c && typeof c.text === "string" ? c.text : typeof c === "string" ? c : "")).join("\n")
  } else if (typeof r === "string") {
    text = r
  }
  let input = null, output = null, cacheRead = null, cacheWrite = null
  if (usage) {
    input = num(usage.input_tokens) ?? num(usage.inputTokens)
    output = num(usage.output_tokens) ?? num(usage.outputTokens)
    cacheRead = num(usage.cache_read_input_tokens) ?? num(usage.cacheReadInputTokens) ?? num(usage.cacheRead)
    cacheWrite = num(usage.cache_creation_input_tokens) ?? num(usage.cacheCreationInputTokens) ?? num(usage.cacheWrite)
  }
  if (total === null && text) {
    const m = text.match(/total_tokens\s*[:=]\s*(\d{1,15})/)
    if (m) total = Number(m[1])
  }
  const parts = [input, output, cacheRead, cacheWrite]
  if (total === null && parts.some(x => x !== null)) total = parts.reduce((a, b) => a + (b || 0), 0)
  if (total === null && parts.every(x => x === null)) return null
  return { input, output, cacheRead, cacheWrite, total, agentId }
}

/**
 * Hook 입력 → 이벤트 한 줄(객체). 저장 금지 항목은 여기서 걸러진다.
 * opts: { now: Date, root: string }
 */
export function buildEvent(h, opts = {}) {
  if (!h || typeof h !== "object") return null
  const event = typeof h.hook_event_name === "string" ? h.hook_event_name : null
  if (!event || !HOOK_EVENTS.includes(event)) return null
  const now = opts.now instanceof Date ? opts.now : new Date()
  const staff = staffFromAgentType(h.agent_type)
  const toolName = typeof h.tool_name === "string" ? clean(h.tool_name, 80) : null
  const isTool = ["PreToolUse", "PostToolUse", "PostToolUseFailure", "PermissionRequest"].includes(event)
  const ev = {
    v: SCHEMA_VERSION,
    ts: now.toISOString(),
    event,
    staff,
    agentId: typeof h.agent_id === "string" ? clean(h.agent_id, 64) : null,
    sessionId: typeof h.session_id === "string" ? clean(h.session_id, 64) : null,
    tool: isTool ? toolName : null,
    kind: isTool ? classifyTool(toolName) : null,
    file: null,
    desc: null,
    cardId: null,
    ok: null,
    notif: null,
    tokens: null,
  }
  if (isTool) {
    const p = pathFromToolInput(h.tool_input)
    ev.file = p ? sanitizePath(p, { root: opts.root, cwd: h.cwd }) : null
    if (typeof h.tool_use_id === "string") ev.toolUseId = clean(h.tool_use_id, 80)
  }
  if (event === "PostToolUse") ev.ok = true
  if (event === "PostToolUseFailure") ev.ok = false
  if (event === "Notification") ev.notif = clean(h.notification_type, 40) || "notification"
  if (event === "PermissionRequest") ev.notif = "permission"

  // 총괄실장의 직원 호출(Agent): 짧은 업무 설명·카드 ID·호출 대상만
  if (staff === "main" && (toolName === "Agent" || toolName === "Task") &&
      (event === "PreToolUse" || event === "PostToolUse" || event === "PostToolUseFailure")) {
    const ti = h.tool_input && typeof h.tool_input === "object" ? h.tool_input : {}
    ev.desc = clean(ti.description, DESC_MAX)
    // 카드 ID는 업무 설명에서, 없으면 지시문에서 "ID 문자열만" 뽑는다(지시문 본문은 저장하지 않음)
    ev.cardId = extractCardId(ti.description, ti.prompt)
    ev.target = staffFromAgentType(typeof ti.subagent_type === "string" && ti.subagent_type ? ti.subagent_type : "general-purpose")
    if (event === "PostToolUse") {
      const t = parseTokens(h.tool_response)
      if (t && t.agentId) ev.targetAgentId = clean(t.agentId, 64)
      if (t && t.total !== null) {
        ev.tokens = { input: t.input, output: t.output, cacheRead: t.cacheRead, cacheWrite: t.cacheWrite, total: t.total, agentId: t.agentId ? clean(t.agentId, 64) : null }
      }
    }
  }
  return ev
}

function datePart(d) {
  return d.toISOString().slice(0, 10)
}

/** 5MB 넘으면 events-<날짜>.jsonl 로 넘긴다 */
export function rotateIfNeeded(file, now = new Date(), maxBytes = MAX_FILE_BYTES) {
  let size = 0
  try { size = statSync(file).size } catch { return null }
  if (size < maxBytes) return null
  const base = file.replace(/\.jsonl$/, "")
  let target = `${base}-${datePart(now)}.jsonl`
  for (let i = 2; existsSync(target) && i < 1000; i++) target = `${base}-${datePart(now)}-${i}.jsonl`
  renameSync(file, target)
  return target
}

export function eventsDir() {
  const d = process.env.OFFICE_EVENTS_DIR
  return d && d.trim() ? resolve(d.trim()) : join(REPO_ROOT, ".claude", "office")
}

export function appendEvent(ev, dir = eventsDir(), now = new Date()) {
  mkdirSync(dir, { recursive: true })
  const file = join(dir, "events.jsonl")
  rotateIfNeeded(file, now)
  appendFileSync(file, JSON.stringify(ev) + "\n", { encoding: "utf8", mode: 0o600 })
  return file
}

function run() {
  const quit = () => process.exit(0)
  process.on("uncaughtException", quit)
  process.on("unhandledRejection", quit)
  setTimeout(quit, 4000).unref()
  const chunks = []
  let total = 0
  let tooBig = false
  process.stdin.on("data", c => {
    if (tooBig) return
    total += c.length
    if (total > MAX_STDIN_BYTES) { tooBig = true; return }
    chunks.push(c)
  })
  process.stdin.on("error", quit)
  process.stdin.on("end", () => {
    try {
      if (tooBig) return quit()
      const h = JSON.parse(Buffer.concat(chunks).toString("utf8"))
      const ev = buildEvent(h, { now: new Date() })
      if (ev) appendEvent(ev)
    } catch {
      // 조용히 무시
    }
    quit()
  })
}

const isMain = (() => {
  try { return !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) } catch { return false }
})()
if (isMain) run()
