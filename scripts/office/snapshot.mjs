#!/usr/bin/env node
// 가상 사무실 상태 문서 생성기 (O-02) — 규격: office/CONTRACT.md 4절(판정 규칙)·5절(문서 형식)
//
// 사용법:
//   node scripts/office/snapshot.mjs [--events <path>] [--out <path>] [--now <ISO>]
//                                    [--board <tasks.json>] [--backfill-transcripts <dir>]
//                                    [--sample] [--summary] [--quiet]
//   기본: --events .claude/office/events.jsonl (같은 폴더의 events-<날짜>*.jsonl 도 함께 읽음)
//         --out    .claude/office/state.json
//         --board  docs/board/tasks.json
//
// 모든 판정은 결정론적이다. 같은 이벤트 + 같은 now → 같은 결과.
// 이벤트가 없거나 오래되면 일하는 모습을 만들지 않고 unknown/off 로 둔다.
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { backfillFromTranscripts } from "./backfill.mjs"
import { INTERNAL, maskPersonal } from "../../.claude/hooks/office-event.mjs"

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")
export const MAX_DOC_BYTES = 200 * 1024
const KST_OFFSET_MS = 9 * 3600 * 1000

// ── 판정 시간 기준(초) — 계약서 4절 ─────────────────────────────
export const WINDOWS = {
  activeTool: 120,     // 도구 이벤트 2분 이내 → typing/research/running
  working: 600,        // 2~10분 → working, 10분 초과 → unknown
  error: 120,          // 실패 후 2분
  meetingCall: 120,    // 총괄실장 Agent 호출 후 2분
  meetingReview: 180,  // 직원 보고 후 3분
  done: 600,           // 보고 후 10분
  sessionActive: 600,  // 세션 활성: 마지막 이벤트 10분 이내
  approvalMax: 1800,   // 승인 대기 최대 30분
}
// 업무 구간 경계의 시각 근접 기준(밀리초) — 결함 D2
export const SESSION_MS = {
  startMerge: 5000,    // 암묵 업무가 출근(SubagentStart) 몇 초 앞이면 같은 업무(비동기 Hook 순서 뒤바뀜)
  reopen: 60000,       // 보고 뒤 1분 안에 출근 기록 없이 도구를 쓰면 같은 업무를 다시 연다(보고 독촉 후 재보고 등)
  race: 2000,          // 보고 직후 2초 안의 도구 기록은 순서 뒤바뀜으로 보고 새 업무를 만들지 않는다
  mergeNear: 10000,    // Hook·작업기록의 출근/보고가 같은 직원·10초 안이면 같은 기록(중복)
}

// ── 직원 목록 — 계약서 2절 ─────────────────────────────────────
export const STAFF = [
  { id: "ceo", name: "대표", title: "대표", room: "ceo" },
  { id: "main", name: "총괄실장", title: "프로젝트 매니저", room: "ceo" },
  { id: "business-strategist", name: "사업기획 담당", title: "사업기획·마케팅", room: "ceo" },
  { id: "saju-engine-developer", name: "엔진 개발자", title: "사주엔진 개발", room: "dev" },
  { id: "frontend-developer", name: "프론트엔드 개발자", title: "프론트엔드", room: "dev" },
  { id: "backend-developer", name: "백엔드 개발자", title: "백엔드·서버", room: "dev" },
  { id: "qa-security-lead", name: "품질검증 담당", title: "품질검증·보안", room: "dev" },
  { id: "myeongri-research-director", name: "명리학 연구소장", title: "명리학 연구", room: "research" },
  { id: "personalization-researcher", name: "개인화 연구원", title: "개인화 분석", room: "research" },
  { id: "design-director", name: "디자인 실장", title: "디자인", room: "design" },
  { id: "content-writer", name: "콘텐츠 작가", title: "콘텐츠·캐릭터", room: "design" },
  { id: "guest", name: "외부 지원 인력", title: "임시(조사·검토 보조)", room: "lounge" },
]

// 현황판(docs/board/tasks.json) owner 한글 이름 → staffId
export const OWNER_MAP = {
  "대표": "ceo",
  "총괄실장": "main",
  "사업기획·마케팅 담당자": "business-strategist",
  "사업기획 담당자": "business-strategist",
  "사주엔진 개발자": "saju-engine-developer",
  "프론트엔드 개발자": "frontend-developer",
  "백엔드·서버 개발자": "backend-developer",
  "백엔드 개발자": "backend-developer",
  "품질검증 담당자": "qa-security-lead",
  "품질검증·보안 담당자": "qa-security-lead",
  "명리학 연구소장": "myeongri-research-director",
  "개인화 분석 연구원": "personalization-researcher",
  "디자인 실장": "design-director",
  "콘텐츠 작가·캐릭터 기획자": "content-writer",
  "콘텐츠 작가": "content-writer",
}
const OWNER_KEYWORDS = [
  ["총괄", "main"], ["사업기획", "business-strategist"], ["마케팅", "business-strategist"], ["엔진", "saju-engine-developer"],
  ["프론트", "frontend-developer"], ["백엔드", "backend-developer"], ["서버", "backend-developer"], ["품질", "qa-security-lead"],
  ["보안", "qa-security-lead"], ["명리", "myeongri-research-director"], ["개인화", "personalization-researcher"],
  ["디자인", "design-director"], ["콘텐츠", "content-writer"], ["작가", "content-writer"],
]

/** owner 문자열 → staffId 배열 (여러 명이면 "A + B", "A, B" 형식도 지원) */
export function ownerToStaff(owner) {
  if (typeof owner !== "string" || !owner.trim()) return []
  const o = owner.trim()
  if (OWNER_MAP[o]) return [OWNER_MAP[o]]
  const out = new Set()
  for (const part of o.split(/\s*(?:,|\+|\/|、|&|\s및\s)\s*/)) {
    const p = part.trim()
    if (!p) continue
    if (OWNER_MAP[p]) { out.add(OWNER_MAP[p]); continue }
    const hit = OWNER_KEYWORDS.find(([k]) => p.includes(k))
    if (hit) out.add(hit[1])
  }
  return [...out]
}

export const STATUS_LABEL = {
  awaiting_approval: "승인 대기",
  error: "오류",
  typing: "코드 작성",
  research: "자료 조사",
  running: "실행·테스트",
  working: "업무 중",
  meeting: "회의(규칙 기반)",
  done: "완료",
  resting: "휴식",
  off: "퇴근",
  unknown: "상태 확인 불가",
}
const STATUS_PRIORITY = ["awaiting_approval", "error", "typing", "research", "running", "working", "meeting", "done", "unknown", "resting", "off"]
const ACTIVE_STATUSES = new Set(["awaiting_approval", "error", "typing", "research", "running", "working"])

// ── 비용 단가(100만 토큰당 USD) — 계약서 5절 ────────────────────
export const PRICES = {
  opus: { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  sonnet: { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 },
  haiku: { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
}
export function priceFamily(model) {
  if (typeof model !== "string") return null
  if (/haiku/i.test(model)) return "haiku"
  if (/sonnet/i.test(model)) return "sonnet"
  if (/opus/i.test(model)) return "opus"
  return null
}
export function costUsd(t, model) {
  const fam = priceFamily(model)
  const p = PRICES[fam || "opus"]
  const n = v => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0)
  const usd = (n(t.input) * p.input + n(t.output) * p.output + n(t.cacheRead) * p.cacheRead + n(t.cacheWrite) * p.cacheWrite) / 1e6
  return { usd, assumedOpus: !fam }
}

// ── 이벤트 읽기 ───────────────────────────────────────────────
const TOOL_EVENTS = new Set(["PreToolUse", "PostToolUse", "PostToolUseFailure"])
export const STATUS_EVENTS = new Set([
  "SessionStart", "SessionEnd", "PreToolUse", "PostToolUse", "PostToolUseFailure",
  "SubagentStart", "SubagentStop", "Notification", "PermissionRequest", "Stop",
])
const ms = ts => Date.parse(ts)

/** 이벤트 한 줄 유효성: v=1, _comment 줄 무시, 시각·이벤트 필수 */
export function parseEventLine(line) {
  if (typeof line !== "string" || !line.trim()) return null
  let o
  try { o = JSON.parse(line) } catch { return null }
  if (!o || typeof o !== "object" || Array.isArray(o)) return null
  if ("_comment" in o) return null
  if (o.v !== 1 || typeof o.ts !== "string" || Number.isNaN(ms(o.ts)) || typeof o.event !== "string") return null
  if (typeof o.staff !== "string" || !o.staff) o.staff = "main"
  return o
}

/** 기본 파일 + 같은 폴더의 넘긴 날짜 파일(<이름>-YYYY-MM-DD[-n].jsonl) */
export function eventFiles(eventsPath) {
  const dir = dirname(eventsPath)
  const base = basename(eventsPath).replace(/\.jsonl$/, "")
  const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-\\d{4}-\\d{2}-\\d{2}(?:-\\d+)?\\.jsonl$`)
  let rotated = []
  try { rotated = readdirSync(dir).filter(f => re.test(f)).sort().map(f => join(dir, f)) } catch { rotated = [] }
  return [...rotated, ...(existsSync(eventsPath) ? [eventsPath] : [])]
}

export function loadEvents(paths) {
  const out = []
  for (const p of paths) {
    let text
    try { text = readFileSync(p, "utf8") } catch { continue }
    for (const line of text.split("\n")) {
      const e = parseEventLine(line)
      if (e) out.push(e)
    }
  }
  return out
}

/**
 * 후킹 이벤트와 작업기록 변환 이벤트를 합친다(같은 기록은 Hook 쪽을 남김)
 * - 도구 호출: 같은 이벤트 + 같은 toolUseId
 * - 출근/보고: 같은 이벤트 + 같은 agentId + 시각 차이 10초 이내(같은 직원이 여러 번 이어서 일하면
 *   구간마다 따로 남아야 하므로 agentId 만으로 중복 처리하지 않는다 — 결함 D2)
 */
export function mergeEvents(primary, extra) {
  const toolKeys = new Set()
  const marks = new Map() // "event|agentId" → [ms...]
  const toolKey = e => (e.toolUseId && TOOL_EVENTS.has(e.event)) ? `${e.event}|${e.toolUseId}` : null
  const markKey = e => (e.agentId && (e.event === "SubagentStart" || e.event === "SubagentStop")) ? `${e.event}|${e.agentId}` : null
  for (const e of primary) {
    const t = toolKey(e); if (t) toolKeys.add(t)
    const m = markKey(e)
    if (m && !Number.isNaN(ms(e.ts))) { if (!marks.has(m)) marks.set(m, []); marks.get(m).push(ms(e.ts)) }
  }
  const out = [...primary]
  for (const e of extra) {
    const t = toolKey(e)
    if (t && toolKeys.has(t)) continue
    const m = markKey(e)
    if (m && marks.has(m) && marks.get(m).some(x => Math.abs(x - ms(e.ts)) <= SESSION_MS.mergeNear)) continue
    out.push(e)
  }
  return out
}

/**
 * 상태 계산에서 빼는 이벤트(결함 D1): agent_type 없는 SubagentStart/Stop.
 * 새 Hook은 staff="internal" 로 남기고, 예전 기록은 staff="main" 으로 남아 있다.
 * 총괄실장 자신은 SubagentStart/Stop 을 만들지 않으므로 둘 다 내부 보조 에이전트로 본다.
 */
export function isIgnoredEvent(e) {
  if (!e || typeof e !== "object") return true
  if (e.staff === INTERNAL) return true
  return e.staff === "main" && (e.event === "SubagentStart" || e.event === "SubagentStop")
}

// ── 보조 함수 ─────────────────────────────────────────────────
function kstDayStartMs(nowMs) {
  const d = new Date(nowMs + KST_OFFSET_MS)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - KST_OFFSET_MS
}
const iso = m => (m === null || m === undefined || Number.isNaN(m) ? null : new Date(m).toISOString())
const isPermission = e => e.event === "PermissionRequest" || (e.event === "Notification" && typeof e.notif === "string" && /permission/i.test(e.notif))
const isIdlePrompt = e => e.event === "Notification" && typeof e.notif === "string" && /idle/i.test(e.notif)
const PLACEHOLDER = /^\[.*\]$/

function approvalMessage(tool) {
  if (tool === "Bash" || tool === "PowerShell") return "명령 실행 승인 요청"
  if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(tool)) return "파일 수정 승인 요청"
  if (tool === "WebFetch" || tool === "WebSearch") return "웹 접속 승인 요청"
  if (tool) return `${tool} 사용 승인 요청`
  return "승인 요청"
}

function kindStatus(kind) {
  return kind === "typing" || kind === "research" || kind === "running" ? kind : "working"
}

/**
 * 한 직원(또는 외부 지원 인력 1명)의 이벤트로 세션(업무 구간) 목록을 만든다.
 * 결함 D2 수정: 같은 agentId 로 이어서 일해도 구간마다 닫히게 한다.
 *   - SubagentStart: 같은 키의 열린 업무(암묵 업무 포함)를 이 시각에 닫고 새로 연다.
 *     단, 몇 초 앞 도구 기록으로 막 만든 업무는 순서 뒤바뀜으로 보고 이 출근에 합친다.
 *   - SubagentStop: 같은 키의 열린 업무를 모두 닫는다.
 *   - 도구 기록: 열린 업무가 없으면 처음 보는 키는 암묵 업무로 연다. 보고 뒤라면 PreToolUse·승인 요청만
 *     업무를 다시 연다(보고 2초 안은 무시, 1분 안은 같은 업무 재개, 그 뒤는 새 암묵 업무).
 */
function buildSessions(own, sessionEnds) {
  const sessions = []
  const open = new Map()       // agentKey → 열린 session
  const lastStop = new Map()   // agentKey → { s, at }
  const mk = (k, e, extra = {}) => ({ agentKey: k, startedAt: ms(e.ts), endedAt: null, startIdx: e._i, endIdx: null, desc: null, cardId: null, sessionId: e.sessionId ?? null, ...extra })
  const close = (s, e, by) => { s.endedAt = ms(e.ts); s.endIdx = e._i; s.endedBy = by }
  for (const e of own) {
    const k = e.agentId || "_"
    const t = ms(e.ts)
    if (e.event === "SubagentStart") {
      const cur = open.get(k)
      if (cur && t - cur.startedAt <= SESSION_MS.startMerge) {
        // 같은 출근의 중복·순서 뒤바뀜 → 합친다
        cur.implicit = false
        if (!cur.desc && e.desc) { cur.desc = e.desc; cur.cardId = e.cardId ?? null }
        continue
      }
      if (cur) close(cur, e, "restart")
      const s = mk(k, e, { desc: e.desc ?? null, cardId: e.cardId ?? null })
      sessions.push(s); open.set(k, s)
    } else if (e.event === "SubagentStop") {
      const opened = sessions.filter(s => s.agentKey === k && s.endedAt === null)
      if (!opened.length) {
        const prev = lastStop.get(k)
        // 같은 보고가 두 번 기록됨(Hook·작업기록 중복 등) → 새 업무를 만들지 않는다
        if (prev && t - prev.at <= SESSION_MS.race) continue
        const s = mk(k, e); sessions.push(s); opened.push(s)
      }
      for (const s of opened) close(s, e, "stop")
      open.delete(k)
      lastStop.set(k, { s: opened[opened.length - 1], at: t })
    } else if (TOOL_EVENTS.has(e.event) || e.event === "PermissionRequest") {
      if (open.has(k)) continue
      const prev = lastStop.get(k)
      if (!prev) {
        if (sessions.some(s => s.agentKey === k)) continue
        // Hook 등록 전에 시작된 업무 등: 첫 도구 이벤트를 시작으로 본다
        const s = mk(k, e, { implicit: true })
        sessions.push(s); open.set(k, s)
        continue
      }
      if (e.event !== "PreToolUse" && e.event !== "PermissionRequest") continue
      const gap = t - prev.at
      if (gap <= SESSION_MS.race) continue
      if (gap <= SESSION_MS.reopen && prev.s && prev.s.endedBy === "stop") {
        prev.s.endedAt = null; prev.s.endIdx = null; delete prev.s.endedBy
        open.set(k, prev.s)
        continue
      }
      const s = mk(k, e, { implicit: true })
      sessions.push(s); open.set(k, s)
    }
  }
  // 세션 종료(SessionEnd)는 그 이후 열려 있는 업무를 모두 닫는다
  for (const s of sessions) {
    if (s.endedAt !== null) continue
    const end = sessionEnds.find(se => se._i > s.startIdx && (!s.sessionId || !se.sessionId || se.sessionId === s.sessionId))
    if (end) { s.endedAt = ms(end.ts); s.endIdx = end._i; s.endedBy = "session_end" }
  }
  return sessions
}

/**
 * 직원 1명(또는 외부 지원 인력 1명)의 상태 판정 — 계약서 4절.
 * own: 그 직원에게 귀속된 이벤트(시간순, Usage 제외). ctx: 공통 정보.
 * 반환 { status, since, rule, session, lastToolEv, permEv }
 */
export function judge(staffId, own, ctx) {
  const { nowMs, dayStart, all, sessionEnds, sessionActive, lastSubagentStop } = ctx
  const age = e => (nowMs - ms(e.ts)) / 1000
  // 직원(총괄실장 제외)은 업무 단위(SubagentStart~Stop)를 먼저 만든다 — 모든 판정 결과에 현재 업무를 붙이기 위함
  const sessions = staffId === "main" ? [] : buildSessions(own, sessionEnds)
  const openS = [...sessions].reverse().find(s => s.endedAt === null) || null
  const lastS = sessions[sessions.length - 1] || null
  const r = (status, sinceMs, rule = false, extra = {}) => ({ status, since: iso(sinceMs), rule, session: openS || lastS, ...extra })
  if (all.length === 0) return r("unknown", null)
  const today = own.filter(e => ms(e.ts) >= dayStart)
  if (today.length === 0) return r("off", null)
  const last = own[own.length - 1]
  const lastTool = [...own].reverse().find(e => TOOL_EVENTS.has(e.event)) || null

  // 퇴근: 세션 종료 이후
  const endAfter = sessionEnds.find(se => se._i >= last._i && (!last.sessionId || !se.sessionId || se.sessionId === last.sessionId))
  if (endAfter) return r("off", ms(endAfter.ts))

  // 승인 대기: 마지막 승인 알림 이후 그 직원의 도구·종료 이벤트가 없음(최대 30분)
  const perm = [...own].reverse().find(isPermission)
  if (perm) {
    const clears = e => TOOL_EVENTS.has(e.event) || ["SubagentStop", "Stop", "SessionEnd"].includes(e.event)
    const cleared = own.some(e => e._i > perm._i && clears(e))
    if (!cleared) {
      // 같은 대기 구간의 첫 승인 알림(시작 시각)과 도구 이름(Notification에는 도구가 없을 수 있음)
      const lastClear = [...own].reverse().find(e => e._i < perm._i && clears(e) && e.event !== "PreToolUse")
      const streak = own.filter(e => isPermission(e) && (!lastClear || e._i > lastClear._i))
      const first = streak[0] || perm
      const withTool = [...streak].reverse().find(e => e.tool) ||
        [...own].reverse().find(e => e._i < perm._i && e.event === "PreToolUse" && e.tool) || null
      if (age(first) <= WINDOWS.approvalMax) {
        return r("awaiting_approval", ms(first.ts), false, { permEv: { ts: first.ts, tool: withTool ? withTool.tool : null } })
      }
    }
  }
  // 오류: 마지막 이벤트가 도구 실패이고 2분 이내
  const lastNonNotif = [...own].reverse().find(e => e.event !== "Notification") || last
  if (lastNonNotif.event === "PostToolUseFailure" && age(lastNonNotif) <= WINDOWS.error) return r("error", ms(lastNonNotif.ts))

  if (staffId === "main") {
    // 결함 D1-b: 응답 종료(Stop)·입력 대기 알림(idle_prompt) 이후 다음 도구 이벤트 전까지는 휴식
    const lastAct = [...own].reverse().find(e => TOOL_EVENTS.has(e.event) || e.event === "PermissionRequest") || null
    const restFrom = own.find(e => (e.event === "Stop" || isIdlePrompt(e)) && (!lastAct || e._i > lastAct._i)) || null
    if (restFrom) {
      if (sessionActive) return r("resting", ms(restFrom.ts))
      return r("unknown", ms(last.ts) + WINDOWS.working * 1000)
    }
    // 회의(규칙): Agent 호출 후 2분, 직원 보고 후 3분
    const call = [...own].reverse().find(e => e.event === "PreToolUse" && (e.tool === "Agent" || e.tool === "Task"))
    const callActive = call && age(call) <= WINDOWS.meetingCall
    const reviewActive = lastSubagentStop && age(lastSubagentStop) <= WINDOWS.meetingReview
    if (callActive || reviewActive) {
      const t = Math.max(callActive ? ms(call.ts) : -Infinity, reviewActive ? ms(lastSubagentStop.ts) : -Infinity)
      return r("meeting", t, true)
    }
    // 총괄실장 = 대화 세션. 마지막 이벤트 10분 이내면 업무 중(응답 종료·입력 대기는 위에서 휴식 처리)
    if (age(last) <= WINDOWS.working) {
      if (lastTool && age(lastTool) <= WINDOWS.activeTool && kindStatus(lastTool.kind) !== "working") return r(lastTool.kind, runStart(own, lastTool))
      return r("working", lastTool && age(lastTool) > WINDOWS.activeTool ? ms(lastTool.ts) + WINDOWS.activeTool * 1000 : ms(last.ts))
    }
    if (sessionActive) return r("resting", ms(last.ts) + WINDOWS.working * 1000)
    return r("unknown", ms(last.ts) + WINDOWS.working * 1000)
  }

  if (openS) {
    const inS = own.filter(e => e._i >= openS.startIdx && (openS.agentKey === "_" || (e.agentId || "_") === openS.agentKey))
    const lt = [...inS].reverse().find(e => TOOL_EVENTS.has(e.event))
    const lo = inS[inS.length - 1] || last
    if (lt && age(lt) <= WINDOWS.activeTool) {
      const st = kindStatus(lt.kind)
      return r(st, st === "working" ? ms(lt.ts) : runStart(inS, lt), false, { session: openS })
    }
    if (age(lo) <= WINDOWS.working) {
      return r("working", lt ? ms(lt.ts) + WINDOWS.activeTool * 1000 : openS.startedAt, false, { session: openS })
    }
    // 업무 중 기록인데 10분 넘게 소식 없음 → 상태 확인 불가
    return r("unknown", ms(lo.ts) + WINDOWS.working * 1000, false, { session: openS })
  }
  const stop = [...own].reverse().find(e => e.event === "SubagentStop")
  if (stop && age(stop) <= WINDOWS.meetingReview) return r("meeting", ms(stop.ts), true, { session: lastS })
  if (stop && age(stop) <= WINDOWS.done) return r("done", ms(stop.ts) + WINDOWS.meetingReview * 1000, false, { session: lastS })
  if (sessionActive) return r("resting", stop ? ms(stop.ts) + WINDOWS.done * 1000 : ms(last.ts), false, { session: lastS })
  // 계약서 공백 보완: 업무를 보고(SubagentStop)하고 끝났으며 세션도 10분 넘게 조용함 → 퇴근
  return r("off", ms(ctx.lastAny.ts) + WINDOWS.sessionActive * 1000, false, { session: lastS })
}

/** 같은 kind 도구 이벤트가 이어진 구간의 시작 시각 */
function runStart(list, lastTool) {
  let start = ms(lastTool.ts)
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i]
    if (e._i > lastTool._i) continue
    if (!TOOL_EVENTS.has(e.event)) continue
    if (e.kind !== lastTool.kind) break
    start = ms(e.ts)
  }
  return start
}

function buildActivity(own, dayStart) {
  const entries = []
  const byId = new Map()
  for (const e of own) {
    if (!TOOL_EVENTS.has(e.event) || ms(e.ts) < dayStart) continue
    if (e.event === "PreToolUse") {
      const a = { at: e.ts, kind: e.kind ?? null, tool: e.tool ?? null, file: e.file ?? null, ok: null }
      entries.push(a)
      if (e.toolUseId) byId.set(e.toolUseId, a)
    } else {
      const ok = e.event === "PostToolUse"
      let a = e.toolUseId ? byId.get(e.toolUseId) : null
      if (!a && !e.toolUseId) a = [...entries].reverse().find(x => x.tool === e.tool && x.ok === null) || null
      if (a) a.ok = ok
      else entries.push({ at: e.ts, kind: e.kind ?? null, tool: e.tool ?? null, file: e.file ?? null, ok })
    }
  }
  return entries
}

function sumTokens(tokenEntries) {
  // tokenEntries: [{agentKey, src: "transcript"|"hook", tokens, model}]
  // 같은 직원 업무(agentId)에 작업기록 집계가 있으면 그것을, 없으면 Hook 값을 쓴다(이중 계산 방지)
  const hasTranscript = new Set(tokenEntries.filter(t => t.src === "transcript" && t.agentKey).map(t => t.agentKey))
  const used = tokenEntries.filter(t => !(t.src === "hook" && t.agentKey && hasTranscript.has(t.agentKey)))
  if (!used.length) return { tokens: null, cost: null }
  const n = v => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0)
  const tot = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
  const srcs = new Set()
  let usd = 0, assumed = false, totalOnly = false
  for (const { tokens: t, model, src } of used) {
    tot.input += n(t.input); tot.output += n(t.output); tot.cacheRead += n(t.cacheRead); tot.cacheWrite += n(t.cacheWrite)
    const parts = n(t.input) + n(t.output) + n(t.cacheRead) + n(t.cacheWrite)
    tot.total += n(t.total) || parts
    if (!parts && n(t.total)) totalOnly = true
    const c = costUsd(t, model)
    usd += c.usd; if (c.assumedOpus && parts) assumed = true
    srcs.add(src)
  }
  let basis = "API 단가 환산 추정(구독 사용 — 실제 청구 아님)"
  if (assumed) basis += " · 모델 미확인분은 Opus 단가 적용"
  if (totalOnly) basis += " · 총량만 있는 기록은 비용에서 제외"
  return {
    tokens: { ...tot, source: srcs.size > 1 ? "mixed" : [...srcs][0] },
    cost: { usd: Math.round(usd * 100) / 100, basis },
  }
}

function cardsFor(staffId, tasks) {
  const owned = tasks.filter(t => ownerToStaff(t.owner).includes(staffId))
  const clip = (s, n) => (typeof s === "string" && s ? (s.length > n ? s.slice(0, n - 1) + "…" : s) : null)
  const cards = owned.filter(t => t.status !== "개발 완료").map(t => {
    const subs = Array.isArray(t.subtasks) ? t.subtasks : []
    return {
      id: t.id, title: t.title, status: t.status,
      progress: { done: subs.filter(s => s && s.done).length, total: subs.length },
      verification: t.verification?.result ?? null,
      issues: clip(t.issues, 200),
      approval: t.approval?.needed ? clip(t.approval.item, 120) : null,
    }
  })
  const completed = owned.filter(t => t.status === "개발 완료").map(t => ({ id: t.id, title: t.title }))
  return { cards, completed }
}

/**
 * 상태 문서 계산(순수 함수). events: 이벤트 배열, tasks: 현황판 tasks 배열, now: Date|ISO
 * @param {{ events?: any[], tasks?: any[], now?: Date | string, sample?: boolean, backfill?: any }} [opts]
 * @returns {any}
 */
export function computeState({ events = [], tasks = [], now = new Date(), sample = false, backfill = null } = {}) {
  // L7: --sample 없이 예시 기록을 넣어도 예시임이 드러나도록, sample:true 이벤트가 하나라도 있으면 예시 문서
  if (!sample && Array.isArray(events) && events.some(e => e && e.sample === true)) sample = true
  const nowMs = now instanceof Date ? now.getTime() : ms(now)
  if (Number.isNaN(nowMs)) throw new Error("now 값이 올바른 ISO 시각이 아님")
  const dayStart = kstDayStartMs(nowMs)

  const valid = events
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e && typeof e.ts === "string" && !Number.isNaN(ms(e.ts)) && ms(e.ts) <= nowMs)
    .sort((a, b) => ms(a.e.ts) - ms(b.e.ts) || a.i - b.i)
    .map(({ e }, i) => ({ ...e, _i: i }))
    .filter(e => !isIgnoredEvent(e))
  const all = valid.filter(e => STATUS_EVENTS.has(e.event))
  const usage = valid.filter(e => e.event === "Usage" && e.tokens && typeof e.tokens === "object")
  const sessionEnds = all.filter(e => e.event === "SessionEnd")
  const lastAny = all[all.length - 1] || null
  const sessionActive = !!lastAny && lastAny.event !== "SessionEnd" && (nowMs - ms(lastAny.ts)) / 1000 <= WINDOWS.sessionActive
  const lastSubagentStop = [...all].reverse().find(e => e.event === "SubagentStop") || null
  const ctx = { nowMs, dayStart, all, sessionEnds, sessionActive, lastSubagentStop, lastAny }

  // 직원 호출 정보: agentId → {desc, cardId}, 그리고 대상별 호출 목록
  const delegByAgent = new Map()
  const delegCalls = []
  const hookTokens = []
  for (const e of all) {
    if (e.staff !== "main" || (e.tool !== "Agent" && e.tool !== "Task")) continue
    if (e.event === "PreToolUse" && e.target) delegCalls.push(e)
    const aid = e.targetAgentId || (e.tokens && e.tokens.agentId) || null
    if (aid && (e.desc || e.cardId)) delegByAgent.set(aid, { desc: e.desc ?? null, cardId: e.cardId ?? null })
    if (e.event === "PostToolUse" && e.tokens && e.target) hookTokens.push({ staff: e.target, agentKey: aid, src: "hook", tokens: e.tokens, model: e.tokens.model ?? null, ts: e.ts })
  }
  const consumed = new Set()

  // 이벤트 귀속: SubagentStart/Stop·도구 이벤트 모두 e.staff 기준
  const byStaff = new Map()
  for (const e of all) {
    const id = STAFF.some(s => s.id === e.staff) ? e.staff : "guest"
    if (!byStaff.has(id)) byStaff.set(id, [])
    byStaff.get(id).push(e)
  }

  const describe = (staffId, s) => {
    if (!s) return null
    let desc = s.desc, cardId = s.cardId
    if (!desc && s.agentKey !== "_" && delegByAgent.has(s.agentKey)) ({ desc, cardId } = delegByAgent.get(s.agentKey))
    if (!desc) {
      const call = [...delegCalls].reverse().find(c => c.target === staffId && !consumed.has(c._i) && ms(c.ts) <= s.startedAt + 5000)
      if (call) { consumed.add(call._i); desc = call.desc ?? null; cardId = call.cardId ?? null }
    }
    // 예전 기록(가림 규칙 전)에 개인정보 형태가 남아 있어도 문서에는 가려서 낸다(L2)
    return { description: desc ? maskPersonal(desc) : null, cardId: cardId ?? null, startedAt: iso(s.startedAt), endedAt: iso(s.endedAt) }
  }

  const pendingApprovals = []
  const staffDocs = []
  for (const meta of STAFF) {
    const cardInfo = cardsFor(meta.id, tasks)
    const approvalsFromBoard = cardInfo.cards.filter(c => c.approval).map(c => `${c.id} ${c.approval}`)
    if (meta.id === "ceo") {
      staffDocs.push({
        ...meta, tracked: false, status: "off", statusLabel: "추적 대상 아님", statusSince: null, rule: false, location: meta.room,
        task: null, elapsedSec: null, currentFile: null, activity: [], toolCounts: {}, filesTouched: 0, tokens: null,
        costUsdEstimate: null, cards: cardInfo.cards, completed: cardInfo.completed, errors: [], approvals: approvalsFromBoard, sessions: [],
      })
      continue
    }
    const own = byStaff.get(meta.id) || []

    // 외부 지원 인력은 agentId 단위로 판정하고 가장 눈에 띄는 상태 하나를 대표로 쓴다
    let verdict, groups
    if (meta.id === "guest") {
      const m = new Map()
      for (const e of own) { const k = e.agentId || "_"; if (!m.has(k)) m.set(k, []); m.get(k).push(e) }
      groups = [...m.values()]
      // 같은 우선순위면 가장 최근에 활동한 사람을 대표로
      const vs = groups.map(g => ({ v: judge("guest", g, ctx), lastI: g[g.length - 1]._i }))
      const rank = x => STATUS_PRIORITY.indexOf(x.v.status)
      verdict = vs.length
        ? vs.reduce((a, b) => (rank(b) < rank(a) || (rank(b) === rank(a) && b.lastI > a.lastI) ? b : a)).v
        : judge("guest", [], ctx)
    } else {
      verdict = judge(meta.id, own, ctx)
      groups = [own]
    }

    // 세션(업무) 목록
    const sessions = meta.id === "main" ? [] : groups.flatMap(g => buildSessions(g, sessionEnds)).sort((a, b) => a.startedAt - b.startedAt)
    const sessionDocs = sessions
      .filter(s => (s.endedAt ?? nowMs) >= dayStart)
      .map(s => ({ s, d: describe(meta.id, s) }))
    const vs = verdict.session
    const cur = vs ? sessionDocs.find(x => x.s.agentKey === vs.agentKey && x.s.startIdx === vs.startIdx) : null
    const task = cur ? cur.d : null
    const elapsedSec = task ? Math.max(0, Math.round(((task.endedAt ? ms(task.endedAt) : nowMs) - ms(task.startedAt)) / 1000)) : null

    const activityAll = buildActivity(own, dayStart)
    const toolCounts = {}
    for (const a of activityAll) if (a.tool) toolCounts[a.tool] = (toolCounts[a.tool] || 0) + 1
    const filesTouched = new Set(activityAll.filter(a => a.kind === "typing" && a.file && !PLACEHOLDER.test(a.file)).map(a => a.file)).size

    let currentFile = null
    if (ACTIVE_STATUSES.has(verdict.status)) {
      const scope = verdict.session ? own.filter(e => e._i >= verdict.session.startIdx) : own
      const f = [...scope].reverse().find(e => TOOL_EVENTS.has(e.event) && e.file)
      currentFile = f ? f.file : null
    }

    const errors = own.filter(e => e.event === "PostToolUseFailure" && ms(e.ts) >= dayStart).slice(-10)
      .map(e => ({ at: e.ts, tool: e.tool ?? null, message: "도구 실행 실패" }))

    const approvals = [...approvalsFromBoard]
    if (verdict.status === "awaiting_approval" && verdict.permEv) {
      const p = verdict.permEv
      const msg = approvalMessage(p.tool)
      approvals.unshift(`${msg}${p.tool ? ` (${p.tool})` : ""}`)
      pendingApprovals.push({ at: p.ts, staff: meta.id, tool: p.tool ?? null, message: msg })
    }

    const tokenEntries = [
      ...usage.filter(u => (STAFF.some(s => s.id === u.staff) ? u.staff : "guest") === meta.id && ms(u.ts) >= dayStart)
        .map(u => ({ agentKey: u.agentId || u.tokens.agentId || null, src: "transcript", tokens: u.tokens, model: u.tokens.model ?? null })),
      ...hookTokens.filter(h => h.staff === meta.id && ms(h.ts) >= dayStart),
    ]
    const { tokens, cost } = sumTokens(tokenEntries)

    const attendedAgents = meta.id === "guest" ? new Set(own.filter(e => ms(e.ts) >= dayStart).map(e => e.agentId || "_")) : null
    const doc = {
      ...meta,
      status: verdict.status,
      statusLabel: STATUS_LABEL[verdict.status],
      statusSince: verdict.since,
      rule: verdict.rule,
      location: verdict.status === "meeting" ? "meeting" : verdict.status === "resting" ? "lounge" : meta.room,
      task,
      elapsedSec,
      currentFile,
      activity: activityAll.slice(-30),
      toolCounts,
      filesTouched,
      tokens,
      costUsdEstimate: cost,
      cards: cardInfo.cards,
      completed: cardInfo.completed,
      errors,
      approvals,
      sessions: sessionDocs.map(x => x.d).slice(-10),
    }
    if (attendedAgents) {
      doc.headcount = attendedAgents.size
      doc.activeCount = groups.map(g => judge("guest", g, ctx)).filter(v => ACTIVE_STATUSES.has(v.status)).length
    }
    staffDocs.push(doc)
  }

  const boardApprovals = tasks
    .filter(t => t.approval?.needed && t.status !== "개발 완료")
    .map(t => ({ cardId: t.id, title: t.title, item: t.approval.item, status: t.status }))

  const doc = {
    schemaVersion: 1,
    ...(sample ? { sample: true, sampleNote: "예시 데이터 — 실제 업무 아님" } : {}),
    generatedAt: new Date(nowMs).toISOString(),
    staleAfterSec: WINDOWS.sessionActive,
    source: {
      eventCount: all.length,
      firstEventAt: all[0]?.ts ?? null,
      lastEventAt: lastAny?.ts ?? null,
      sessionActive,
      period: { from: iso(dayStart), to: iso(nowMs), timezone: "Asia/Seoul" },
      ...(backfill ? { backfill } : {}),
    },
    ceo: { pendingApprovals, boardApprovals },
    staff: staffDocs,
  }
  return shrinkToLimit(doc)
}

/** 200KB 상한: 활동 로그·세션·오류를 줄여서 맞춘다 */
export function shrinkToLimit(doc, limit = MAX_DOC_BYTES) {
  const size = d => Buffer.byteLength(JSON.stringify(d, null, 2), "utf8")
  if (size(doc) <= limit) return doc
  for (const keep of [15, 8, 3, 0]) {
    for (const s of doc.staff) {
      s.activity = s.activity.slice(-keep)
      s.sessions = s.sessions.slice(-Math.max(1, Math.min(10, keep)))
      s.errors = s.errors.slice(-Math.max(1, Math.min(10, keep)))
    }
    doc.truncated = true
    if (size(doc) <= limit) return doc
  }
  for (const s of doc.staff) {
    s.cards = s.cards.map(c => ({ ...c, issues: c.issues ? c.issues.slice(0, 40) : null }))
    s.completed = s.completed.slice(-5)
  }
  return doc
}

// ── 명령행 ────────────────────────────────────────────────────
function parseArgs(argv) {
  const a = { events: null, out: null, now: null, board: null, backfill: null, sample: false, summary: false, quiet: false }
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]
    const v = () => { const x = argv[++i]; if (x === undefined) throw new Error(`${k} 값이 없음`); return x }
    if (k === "--events") a.events = v()
    else if (k === "--out") a.out = v()
    else if (k === "--now") a.now = v()
    else if (k === "--board") a.board = v()
    else if (k === "--backfill-transcripts") a.backfill = v()
    else if (k === "--sample") a.sample = true
    else if (k === "--summary") a.summary = true
    else if (k === "--quiet") a.quiet = true
    else if (k === "-h" || k === "--help") a.help = true
    else throw new Error(`알 수 없는 인자: ${k}`)
  }
  return a
}

/**
 * @param {{ events?: string, board?: string, now?: string, backfill?: string, sample?: boolean }} [opts]
 * @returns {any}
 */
export function buildSnapshot(opts = {}) {
  const eventsPath = resolve(opts.events || join(REPO_ROOT, ".claude", "office", "events.jsonl"))
  const boardPath = resolve(opts.board || join(REPO_ROOT, "docs", "board", "tasks.json"))
  let tasks = []
  try { tasks = JSON.parse(readFileSync(boardPath, "utf8")).tasks || [] } catch { tasks = [] }
  let events = loadEvents(eventFiles(eventsPath))
  let backfill = null
  if (opts.backfill) {
    const bf = backfillFromTranscripts(resolve(opts.backfill), { root: REPO_ROOT })
    const before = events.length
    events = mergeEvents(events, bf.events)
    backfill = { from: "transcripts", agents: bf.agents.length, added: events.length - before, note: "작업기록(내부 형식) 보조 변환 — 형식이 바뀌면 누락될 수 있음" }
  }
  const now = opts.now ? new Date(opts.now) : new Date()
  if (Number.isNaN(now.getTime())) throw new Error("--now 값이 올바른 ISO 시각이 아님")
  return computeState({ events, tasks, now, sample: !!opts.sample, backfill })
}

function summaryLines(doc) {
  const lines = []
  for (const s of doc.staff) {
    if (s.id === "ceo") continue
    const tc = Object.entries(s.toolCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ")
    const tk = s.tokens ? `토큰 ${s.tokens.total.toLocaleString("en-US")} (출력 ${s.tokens.output.toLocaleString("en-US")}) ≈ $${s.costUsdEstimate?.usd}` : "토큰 기록 없음"
    const ss = s.sessions.map(x => `${x.cardId || "-"} "${x.description || ""}" ${x.startedAt?.slice(11, 16)}~${x.endedAt ? x.endedAt.slice(11, 16) : "진행 중"}`).join(" | ")
    lines.push(`${s.name}${s.headcount ? `(${s.headcount}명)` : ""}: ${s.statusLabel} · 도구 ${Object.values(s.toolCounts).reduce((a, b) => a + b, 0)}회 [${tc}] · 수정 파일 ${s.filesTouched} · ${tk}${ss ? `\n    업무: ${ss}` : ""}`)
  }
  return lines
}

function main() {
  let a
  try { a = parseArgs(process.argv.slice(2)) } catch (e) { console.error(String(e.message || e)); process.exit(2) }
  if (a.help) {
    console.log("node scripts/office/snapshot.mjs [--events <path>] [--out <path>] [--now <ISO>] [--board <tasks.json>] [--backfill-transcripts <dir>] [--sample] [--summary] [--quiet]")
    return
  }
  const doc = buildSnapshot(a)
  const out = resolve(a.out || join(REPO_ROOT, ".claude", "office", "state.json"))
  mkdirSync(dirname(out), { recursive: true })
  const text = JSON.stringify(doc, null, 2) + "\n"
  writeFileSync(out, text, { encoding: "utf8", mode: 0o600 })
  try { chmodSync(out, 0o600) } catch { /* 이미 있던 파일 권한 조정 실패는 무시 */ }
  if (!a.quiet) {
    console.log(`상태 문서 생성: ${out} (${(Buffer.byteLength(text) / 1024).toFixed(1)}KB, 이벤트 ${doc.source.eventCount}건, 기준 ${doc.generatedAt})`)
    const counts = {}
    for (const s of doc.staff) if (s.id !== "ceo") counts[s.status] = (counts[s.status] || 0) + 1
    console.log("상태: " + Object.entries(counts).map(([k, v]) => `${STATUS_LABEL[k]} ${v}`).join(" · "))
  }
  if (a.summary) console.log(summaryLines(doc).join("\n"))
}

const isMain = (() => {
  try { return !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) } catch { return false }
})()
if (isMain) main()
