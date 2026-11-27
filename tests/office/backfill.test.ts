// 가상 사무실 작업기록 보조 변환 테스트 (O-02) — 직원 매핑, 토큰 중복 제거, 내용 미저장
import { describe, expect, it } from "vitest"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { backfillFromTranscripts, findTranscripts } from "../../scripts/office/backfill.mjs"
import { computeState } from "../../scripts/office/snapshot.mjs"

const ROOT = resolve(__dirname, "..", "..")
const jsonl = (rows: unknown[]) => rows.map(r => JSON.stringify(r)).join("\n") + "\n"

function fakeProject() {
  const dir = mkdtempSync(join(tmpdir(), "office-bf-"))
  const sess = "sess-x"
  const sub = join(dir, sess, "subagents")
  mkdirSync(sub, { recursive: true })
  const usage = (o: number) => ({ input_tokens: 2, output_tokens: o, cache_read_input_tokens: 100, cache_creation_input_tokens: 10 })
  // 메인: 직원 호출(Agent) + 결과의 agentId, 그리고 Bash 명령(내용은 비밀)
  writeFileSync(join(dir, `${sess}.jsonl`), jsonl([
    { type: "queue-operation", content: "SECRET_USER_PROMPT", timestamp: "2026-11-27T10:00:00.000Z" },
    { type: "user", sessionId: sess, timestamp: "2026-11-27T10:00:01.000Z", message: { role: "user", content: "SECRET_USER_PROMPT" } },
    { type: "assistant", sessionId: sess, cwd: ROOT, timestamp: "2026-11-27T10:00:02.000Z", message: { id: "m1", model: "claude-opus-5-5", usage: usage(50),
      content: [{ type: "tool_use", id: "tu1", name: "Agent", input: { description: "U-01 urgent fixes", subagent_type: "backend-developer", prompt: "SECRET_AGENT_PROMPT 카드 U-01" } }] } },
    { type: "user", sessionId: sess, timestamp: "2026-11-27T10:00:03.000Z", toolUseResult: { status: "async_launched", agentId: "abc123", prompt: "SECRET_AGENT_PROMPT" },
      message: { content: [{ type: "tool_result", tool_use_id: "tu1", content: [{ type: "text", text: "SECRET_TOOL_RESULT" }] }] } },
    { type: "assistant", sessionId: sess, cwd: ROOT, timestamp: "2026-11-27T10:00:04.000Z", message: { id: "m2", model: "claude-opus-5-5", usage: usage(10),
      content: [{ type: "tool_use", id: "tu2", name: "Bash", input: { command: "SECRET_COMMAND --token" } }] } },
    { type: "assistant", isSidechain: true, timestamp: "2026-11-27T10:00:05.000Z", message: { content: [{ type: "tool_use", id: "zz", name: "Write", input: { file_path: "/x" } }] } },
  ]))
  // 직원 작업기록: 같은 메시지 id가 두 줄로 나뉨(usage 중복) + 실패한 도구 + 보고
  writeFileSync(join(sub, "agent-abc123.jsonl"), jsonl([
    { type: "user", agentId: "abc123", sessionId: sess, timestamp: "2026-11-27T10:00:03.500Z", message: { role: "user", content: "SECRET_AGENT_PROMPT" } },
    { type: "assistant", agentId: "abc123", sessionId: sess, cwd: ROOT, timestamp: "2026-11-27T10:01:00.000Z", message: { id: "s1", model: "claude-opus-5-5", usage: usage(1000),
      content: [{ type: "thinking", thinking: "SECRET_THINKING" }] } },
    { type: "assistant", agentId: "abc123", sessionId: sess, cwd: ROOT, timestamp: "2026-11-27T10:01:00.100Z", message: { id: "s1", model: "claude-opus-5-5", usage: usage(1000),
      content: [{ type: "tool_use", id: "w1", name: "Write", input: { file_path: join(ROOT, "src/lib/x.ts"), content: "SECRET_FILE_BODY" } }] } },
    { type: "user", agentId: "abc123", timestamp: "2026-11-27T10:01:01.000Z", message: { content: [{ type: "tool_result", tool_use_id: "w1", content: "SECRET_TOOL_RESULT" }] } },
    { type: "assistant", agentId: "abc123", cwd: ROOT, timestamp: "2026-11-27T10:02:00.000Z", message: { id: "s2", model: "claude-opus-5-5", usage: usage(500),
      content: [{ type: "tool_use", id: "r1", name: "Read", input: { file_path: join(ROOT, ".env.local") } },
                { type: "tool_use", id: "q1", name: "WebSearch", input: { query: "SECRET_QUERY" } },
                { type: "tool_use", id: "b1", name: "Bash", input: { command: "SECRET_COMMAND" } }] } },
    { type: "user", agentId: "abc123", timestamp: "2026-11-27T10:02:01.000Z", message: { content: [
      { type: "tool_result", tool_use_id: "r1", content: "SECRET_TOOL_RESULT", is_error: true },
      { type: "tool_result", tool_use_id: "q1", content: "SECRET_TOOL_RESULT" },
      { type: "tool_result", tool_use_id: "b1", content: "SECRET_TOOL_RESULT" }] } },
    { type: "assistant", agentId: "abc123", timestamp: "2026-11-27T10:03:00.000Z", message: { id: "s3", model: "claude-opus-5-5", usage: usage(200),
      content: [{ type: "tool_use", id: "h1", name: "SubagentHandback", input: { message: "SECRET_LAST_MESSAGE" } }] } },
    { type: "user", agentId: "abc123", timestamp: "2026-11-27T10:03:01.000Z", message: { content: [{ type: "tool_result", tool_use_id: "h1", content: "ok" }] } },
  ]))
  // 메인 기록에 호출이 없는 직원: meta.json 으로 종류 확인, 아직 진행 중
  writeFileSync(join(sub, "agent-def456.jsonl"), jsonl([
    { type: "user", agentId: "def456", timestamp: "2026-11-27T10:05:00.000Z", message: { content: "SECRET_AGENT_PROMPT" } },
    { type: "assistant", agentId: "def456", cwd: ROOT, timestamp: "2026-11-27T10:05:30.000Z", message: { id: "d1", model: "claude-sonnet-5-5", usage: usage(100),
      content: [{ type: "tool_use", id: "g1", name: "Grep", input: { pattern: "SECRET_QUERY", path: "/etc" } }] } },
  ]))
  writeFileSync(join(sub, "agent-def456.meta.json"), JSON.stringify({ agentType: "Explore", description: "Look around O-02" }))
  return { dir, sess, sub }
}

describe("작업기록 보조 변환(backfill)", () => {
  it("폴더 구조(프로젝트·세션·subagents) 모두 인식", () => {
    const { dir, sess, sub } = fakeProject()
    try {
      expect(findTranscripts(dir)).toEqual([{ main: join(dir, `${sess}.jsonl`), subagentsDir: sub }])
      expect(findTranscripts(join(dir, sess))).toEqual([{ main: join(dir, `${sess}.jsonl`), subagentsDir: sub }])
      expect(findTranscripts(sub)).toEqual([{ main: join(dir, `${sess}.jsonl`), subagentsDir: sub }])
      expect(findTranscripts(join(dir, "없음"))).toEqual([])
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  it("직원 종류는 메인 기록의 Agent 호출 + 결과 agentId 로 매핑, 없으면 meta.json", () => {
    const { dir } = fakeProject()
    try {
      const { events, agents } = backfillFromTranscripts(dir, { root: ROOT })
      expect(agents).toEqual([
        { agentId: "abc123", staff: "backend-developer", desc: "U-01 urgent fixes", cardId: "U-01", startedAt: "2026-11-27T10:00:03.500Z", endedAt: "2026-11-27T10:03:01.000Z", toolUses: 5 },
        { agentId: "def456", staff: "guest", desc: "Look around O-02", cardId: "O-02", startedAt: "2026-11-27T10:05:00.000Z", endedAt: null, toolUses: 1 },
      ])
      const b = events.filter(e => e.agentId === "abc123" && e.event !== "Usage")
      expect(b.map(e => `${e.event}:${e.tool ?? ""}:${e.file ?? ""}`)).toEqual([
        "SubagentStart::", "PreToolUse:Write:src/lib/x.ts", "PostToolUse:Write:src/lib/x.ts",
        "PreToolUse:Read:[비공개 파일]", "PreToolUse:WebSearch:", "PreToolUse:Bash:",
        "PostToolUseFailure:Read:[비공개 파일]", "PostToolUse:WebSearch:", "PostToolUse:Bash:",
        "PreToolUse:SubagentHandback:", "PostToolUse:SubagentHandback:", "SubagentStop::",
      ])
      // 같은 메시지 id(s1)는 한 번만 센다: 출력 1000 + 500 + 200
      const u = events.find(e => e.event === "Usage" && e.agentId === "abc123")
      expect(u.tokens).toMatchObject({ input: 6, output: 1700, cacheRead: 300, cacheWrite: 30, total: 2036, model: "claude-opus-5-5" })
      expect(events.find(e => e.event === "Usage" && e.staff === "main").tokens).toMatchObject({ output: 60 })
      // 사이드체인 줄은 메인 활동으로 넣지 않음
      expect(events.some(e => e.staff === "main" && e.tool === "Write")).toBe(false)
      // 저장소 밖 경로
      expect(events.find(e => e.tool === "Grep").file).toBe("[외부 경로]")
      expect(events.every(e => e.src === "backfill")).toBe(true)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  it("결과에 명령문·프롬프트·파일 내용·도구 결과·검색어·보고문·생각이 없다", () => {
    const { dir } = fakeProject()
    try {
      const { events } = backfillFromTranscripts(dir, { root: ROOT })
      const doc = computeState({ events, tasks: [], now: new Date("2026-11-27T10:06:00.000Z") })
      for (const text of [JSON.stringify(events), JSON.stringify(doc)]) {
        expect(text).not.toContain("SECRET")
        expect(text).not.toContain("--token")
      }
      const b = doc.staff.find((s: { id: string }) => s.id === "backend-developer")
      expect(b).toMatchObject({ status: "meeting", rule: true, filesTouched: 1, toolCounts: { Write: 1, Read: 1, WebSearch: 1, Bash: 1, SubagentHandback: 1 } })
      expect(b.errors).toEqual([{ at: "2026-11-27T10:02:01.000Z", tool: "Read", message: "도구 실행 실패" }])
      expect(b.sessions).toEqual([{ description: "U-01 urgent fixes", cardId: "U-01", startedAt: "2026-11-27T10:00:03.500Z", endedAt: "2026-11-27T10:03:01.000Z" }])
      expect(b.tokens.source).toBe("transcript")
      const g = doc.staff.find((s: { id: string }) => s.id === "guest")
      expect(g).toMatchObject({ status: "research", headcount: 1 })
      expect(g.costUsdEstimate.basis).not.toContain("Opus")
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
})
