// 가상 사무실 — 작업기록(transcript) 보조 변환기 (O-02)
//
// Claude Code 작업기록(~/.claude/projects/<프로젝트>/<세션>.jsonl, <세션>/subagents/agent-*.jsonl)을
// 계약서 3절 이벤트로 바꾼다. 작업기록 형식은 공식 문서상 내부 형식이라 버전에 따라 바뀔 수 있다.
// 그래서 주 데이터가 아니라 "이미 끝난 오늘 활동을 보여 주는 보조 기능"으로만 쓴다.
//
// 저장 원칙은 Hook과 같다: 도구 이름, 저장소 기준 파일 경로, 시각, 직원, 짧은 업무 설명(60자),
// 카드 ID, 성공/실패, 토큰 수만 뽑는다. 명령문·파일 내용·프롬프트·도구 결과·검색어·URL은 읽어도 버린다.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { basename, dirname, join } from "node:path"
import {
  classifyTool, cleanDesc, extractCardId, pathFromToolInput, sanitizePath, staffFromAgentType, REPO_ROOT,
} from "../../.claude/hooks/office-event.mjs"

function readJsonl(file) {
  let text
  try { text = readFileSync(file, "utf8") } catch { return [] }
  const out = []
  for (const line of text.split("\n")) {
    if (!line.trim()) continue
    try { out.push(JSON.parse(line)) } catch { /* 깨진 줄은 건너뜀 */ }
  }
  return out
}

function readJson(file) {
  try { return JSON.parse(readFileSync(file, "utf8")) } catch { return null }
}

function shortText(s, max) {
  if (typeof s !== "string") return null
  const t = s.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, " ").replace(/\s+/g, " ").trim()
  if (!t) return null
  return t.length > max ? t.slice(0, max - 1) + "…" : t
}

const isDir = p => { try { return statSync(p).isDirectory() } catch { return false } }

/** 폴더 구조를 알아내 [{main, subagentsDir}] 목록을 만든다 */
export function findTranscripts(dir) {
  const out = []
  if (!isDir(dir)) return out
  if (basename(dir) === "subagents") {
    const main = dirname(dir) + ".jsonl"
    out.push({ main: existsSync(main) ? main : null, subagentsDir: dir })
    return out
  }
  if (isDir(join(dir, "subagents"))) {
    const main = dir.replace(/\/+$/, "") + ".jsonl"
    out.push({ main: existsSync(main) ? main : null, subagentsDir: join(dir, "subagents") })
    return out
  }
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith(".jsonl")) continue
    const sub = join(dir, f.replace(/\.jsonl$/, ""), "subagents")
    out.push({ main: join(dir, f), subagentsDir: isDir(sub) ? sub : null })
  }
  return out
}

function usageAdd(acc, model, u) {
  if (!u || typeof u !== "object") return
  const m = typeof model === "string" && model ? model : "unknown"
  const a = acc[m] || (acc[m] = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 })
  const n = v => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0)
  a.input += n(u.input_tokens)
  a.output += n(u.output_tokens)
  a.cacheRead += n(u.cache_read_input_tokens)
  a.cacheWrite += n(u.cache_creation_input_tokens)
}

function usageEvents(acc, base) {
  const out = []
  for (const [model, t] of Object.entries(acc)) {
    const total = t.input + t.output + t.cacheRead + t.cacheWrite
    if (!total) continue
    out.push({ ...base, event: "Usage", tokens: { ...t, total, model, agentId: base.agentId ?? null } })
  }
  return out
}

/** 사람이 보낸 새 지시(재개 메시지 포함)인가 — 도구 결과 줄·이미지 같은 딸림 줄(turnCompanion)은 아님 */
function isPromptRow(o) {
  if (o.type !== "user" || o.turnCompanion === true) return false
  const c = o.message && o.message.content
  if (typeof c === "string") return true
  if (!Array.isArray(c)) return false
  return !c.some(b => b && typeof b === "object" && b.type === "tool_result")
}

const marker = (b, event, extra = {}) => ({ ...b, event, tool: null, kind: null, file: null, desc: null, cardId: null, ok: null, notif: null, tokens: null, ...extra })

/**
 * 한 작업기록(메인 또는 직원)을 이벤트로 바꾼다.
 * staff: 이 기록의 주인 staffId. 메인이면 "main".
 * segments: 직원 기록이면 업무 구간(출근~보고)마다 SubagentStart/SubagentStop 을 넣는다(결함 D2).
 *   - 보고(SubagentHandback 성공) 1건마다 그 시각에 종료
 *   - 보고 없이 응답이 끝난(end_turn) 뒤 새 지시가 오면 end_turn 시각에 종료
 *   - 종료 뒤 다음 지시(재개 메시지)가 오면 그 시각에 새 시작
 *   - 마지막 구간: 보고가 없으면 finished(meta) 또는 end_turn 일 때만 마지막 기록 시각에 종료
 * 반환: { events, lastTs, firstTs, usage, handbackTs, endTurn, agentCalls, segments }
 */
function convertTranscript(rows, { staff, agentId, root, isMainTranscript, segments: withSegments = false, startInfo = {}, finished }) {
  const events = []
  const segments = []             // [{start, stop}]
  let cur = null                  // 진행 중 구간
  let closed = false              // 현재 구간이 보고·응답 종료로 끝났는가(다음 지시가 오면 새 구간)
  let endTurnTs = null
  const uses = new Map()          // tool_use_id → {tool, kind, file, desc, cardId, target}
  const usageByMsg = new Map()    // message.id → {model, usage} (같은 메시지가 여러 줄로 나뉘어 기록됨 → 중복 제거)
  const agentCalls = new Map()    // agentId → {desc, cardId, target, subagentType}
  let firstTs = null, lastTs = null, handbackTs = null, endTurn = false, sessionId = null
  const base = (ts) => ({ v: 1, ts, staff, agentId: agentId ?? null, sessionId, src: "backfill" })

  for (const o of rows) {
    if (!o || typeof o !== "object") continue
    if (isMainTranscript && o.isSidechain === true) continue
    const ts = typeof o.timestamp === "string" && !Number.isNaN(Date.parse(o.timestamp)) ? new Date(o.timestamp).toISOString() : null
    if (!ts) continue
    if (o.type !== "user" && o.type !== "assistant") continue
    if (typeof o.sessionId === "string") sessionId = shortText(o.sessionId, 64)
    if (!firstTs) firstTs = ts
    lastTs = ts
    if (withSegments) {
      if (!cur) {
        cur = { start: ts, stop: null }; segments.push(cur); closed = false
        events.push(marker(base(ts), "SubagentStart", { desc: startInfo.desc ?? null, cardId: startInfo.cardId ?? null }))
      } else if (closed && isPromptRow(o)) {
        if (!cur.stop && endTurnTs) { cur.stop = endTurnTs; events.push(marker(base(endTurnTs), "SubagentStop")) }
        cur = { start: ts, stop: null }; segments.push(cur); closed = false; endTurnTs = null
        events.push(marker(base(ts), "SubagentStart", { desc: startInfo.desc ?? null, cardId: startInfo.cardId ?? null }))
      }
    }
    const msg = o.message
    if (!msg || typeof msg !== "object") continue
    if (o.type === "assistant") {
      if (typeof msg.id === "string" && msg.usage) usageByMsg.set(msg.id, { model: msg.model, usage: msg.usage })
      endTurn = msg.stop_reason === "end_turn"
      if (endTurn && cur && !cur.stop) { endTurnTs = ts; closed = true }
    }
    if (!Array.isArray(msg.content)) continue
    for (const b of msg.content) {
      if (!b || typeof b !== "object") continue
      if (o.type === "assistant" && b.type === "tool_use" && typeof b.name === "string") {
        const tool = shortText(b.name, 80)
        const kind = classifyTool(tool)
        const p = pathFromToolInput(b.input)
        const file = p ? sanitizePath(p, { root, cwd: o.cwd }) : null
        const info = { tool, kind, file }
        const ev = { ...base(ts), event: "PreToolUse", tool, kind, file, desc: null, cardId: null, ok: null, notif: null, tokens: null, toolUseId: shortText(b.id, 80) }
        if (staff === "main" && (tool === "Agent" || tool === "Task")) {
          const ti = b.input && typeof b.input === "object" ? b.input : {}
          info.desc = cleanDesc(ti.description)
          info.cardId = extractCardId(ti.description, ti.prompt)
          info.subagentType = typeof ti.subagent_type === "string" && ti.subagent_type ? ti.subagent_type : "general-purpose"
          info.target = staffFromAgentType(info.subagentType)
          ev.desc = info.desc; ev.cardId = info.cardId; ev.target = info.target
        }
        uses.set(b.id, info)
        events.push(ev)
      } else if (o.type === "user" && b.type === "tool_result" && typeof b.tool_use_id === "string") {
        const info = uses.get(b.tool_use_id)
        if (!info) continue
        const failed = b.is_error === true
        const ev = { ...base(ts), event: failed ? "PostToolUseFailure" : "PostToolUse", tool: info.tool, kind: info.kind, file: info.file,
          desc: null, cardId: null, ok: !failed, notif: null, tokens: null, toolUseId: shortText(b.tool_use_id, 80) }
        const handback = info.tool === "SubagentHandback" && !failed
        if (handback) handbackTs = ts
        if (staff === "main" && info.target) {
          ev.desc = info.desc; ev.cardId = info.cardId; ev.target = info.target
          const r = o.toolUseResult && typeof o.toolUseResult === "object" ? o.toolUseResult : null
          const aid = r && typeof r.agentId === "string" ? shortText(r.agentId, 64) : null
          if (aid) {
            ev.targetAgentId = aid
            agentCalls.set(aid, { desc: info.desc, cardId: info.cardId, target: info.target, subagentType: info.subagentType })
          }
        }
        events.push(ev)
        if (withSegments && handback && cur && !cur.stop) {
          cur.stop = ts; closed = true
          events.push(marker(base(ts), "SubagentStop"))
        }
      }
    }
  }
  if (withSegments && cur && !cur.stop && (finished === true || (finished === undefined && endTurn))) {
    cur.stop = lastTs
    events.push(marker(base(lastTs), "SubagentStop"))
  }
  const usage = {}
  for (const { model, usage: u } of usageByMsg.values()) usageAdd(usage, model, u)
  return { events, firstTs, lastTs, usage, handbackTs, endTurn, agentCalls, sessionId, base, segments }
}

/**
 * 작업기록 폴더 → 이벤트 목록 + 요약
 * dir: ~/.claude/projects/<프로젝트> 또는 <세션> 폴더 또는 subagents 폴더
 */
/**
 * @param {string} dir
 * @param {{ root?: string }} [opts]
 * @returns {{ events: any[], agents: any[] }}
 */
export function backfillFromTranscripts(dir, opts = {}) {
  const root = opts.root || REPO_ROOT
  /** @type {any[]} */
  const events = []
  /** @type {any[]} */
  const agents = []
  for (const { main, subagentsDir } of findTranscripts(dir)) {
    let agentCalls = new Map()
    if (main) {
      const r = convertTranscript(readJsonl(main), { staff: "main", agentId: null, root, isMainTranscript: true })
      events.push(...r.events)
      if (r.lastTs) events.push(...usageEvents(r.usage, { ...r.base(r.lastTs) }))
      agentCalls = r.agentCalls
    }
    if (!subagentsDir) continue
    for (const f of readdirSync(subagentsDir).sort()) {
      const m = f.match(/^agent-([A-Za-z0-9_-]+)\.jsonl$/)
      if (!m) continue
      const agentId = m[1].slice(0, 64)
      const meta = readJson(join(subagentsDir, `agent-${agentId}.meta.json`)) || {}
      const call = agentCalls.get(agentId)
      const agentType = call?.subagentType ?? (typeof meta.agentType === "string" ? meta.agentType : null)
      const staff = agentType ? staffFromAgentType(agentType) : "guest"
      const desc = call?.desc ?? cleanDesc(meta.description)
      const cardId = call?.cardId ?? extractCardId(meta.description)
      const finished = typeof meta.finished === "boolean" ? meta.finished : undefined
      const r = convertTranscript(readJsonl(join(subagentsDir, f)), {
        staff, agentId, root, isMainTranscript: false, segments: true, startInfo: { desc, cardId }, finished,
      })
      if (!r.firstTs) continue
      events.push(...r.events)
      events.push(...usageEvents(r.usage, r.base(r.lastTs)))
      const lastSeg = r.segments[r.segments.length - 1]
      agents.push({ agentId, staff, desc, cardId, startedAt: r.firstTs, endedAt: lastSeg && lastSeg.stop ? lastSeg.stop : null, toolUses: r.events.filter(e => e.event === "PreToolUse").length })
    }
  }
  return { events, agents }
}
