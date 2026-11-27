// 가상 사무실 수집 Hook 테스트 (O-02) — 가림 규칙, 저장 금지 항목, 토큰 파싱 방어, 크기 상한, 실제 실행
import { describe, expect, it } from "vitest"
import { spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import {
  OUTSIDE_PATH, PRIVATE_FILE, REPO_ROOT, buildEvent, classifyTool, eventsDir, extractCardId, parseTokens,
  rotateIfNeeded, sanitizePath, staffFromAgentType,
} from "../../.claude/hooks/office-event.mjs"

const ROOT = resolve(__dirname, "..", "..")
const HOOK = join(ROOT, ".claude", "hooks", "office-event.mjs")
const tmp = () => mkdtempSync(join(tmpdir(), "office-hook-"))

describe("저장소 루트 계산", () => {
  it("스크립트 위치 기준으로 저장소 루트를 찾는다", () => {
    expect(REPO_ROOT).toBe(ROOT)
  })
  it("OFFICE_EVENTS_DIR 가 없으면 <루트>/.claude/office", () => {
    const prev = process.env.OFFICE_EVENTS_DIR
    delete process.env.OFFICE_EVENTS_DIR
    try { expect(eventsDir()).toBe(join(ROOT, ".claude", "office")) } finally { if (prev !== undefined) process.env.OFFICE_EVENTS_DIR = prev }
  })
})

describe("경로 가림 규칙", () => {
  const root = "/repo/app"
  it(".env 가 들어간 경로는 [비공개 파일]", () => {
    for (const p of ["/repo/app/.env", "/repo/app/.env.local", ".env", "config/.env.production", "/repo/app/sub/.ENV", "/elsewhere/.env"]) {
      expect(sanitizePath(p, { root })).toBe(PRIVATE_FILE)
    }
  })
  it("저장소 밖 경로는 [외부 경로] (파일 이름도 남기지 않음)", () => {
    for (const p of ["/etc/passwd", "/root/.claude/projects/x/agent.jsonl", "/repo/app2/x.ts", "../outside.txt", "/repo/app/../secret.txt"]) {
      expect(sanitizePath(p, { root })).toBe(OUTSIDE_PATH)
    }
  })
  it("저장소 안 경로는 저장소 기준 상대경로", () => {
    expect(sanitizePath("/repo/app/src/app/api/x.ts", { root })).toBe("src/app/api/x.ts")
    expect(sanitizePath("src/lib/env.ts", { root })).toBe("src/lib/env.ts")
    expect(sanitizePath("x.ts", { root, cwd: "/repo/app/src" })).toBe("src/x.ts")
    expect(sanitizePath("/repo/app", { root })).toBe(".")
    expect(sanitizePath("/repo/app/..foo/x", { root })).toBe("..foo/x")
  })
  it("저장소 경로 자체에 .env 가 들어 있어도 저장소 안 파일은 상대경로 기준으로 판단", () => {
    expect(sanitizePath("/home/u/.envs/app/src/a.ts", { root: "/home/u/.envs/app" })).toBe("src/a.ts")
  })
  it("빈 값·문자열 아님 → null", () => {
    expect(sanitizePath("", { root })).toBeNull()
    expect(sanitizePath(undefined, { root })).toBeNull()
    expect(sanitizePath(42 as unknown as string, { root })).toBeNull()
  })
})

describe("직원·도구 분류", () => {
  it("agent_type 없음 → main, 목록 밖 → guest", () => {
    expect(staffFromAgentType(undefined)).toBe("main")
    expect(staffFromAgentType("")).toBe("main")
    expect(staffFromAgentType("backend-developer")).toBe("backend-developer")
    expect(staffFromAgentType("general-purpose")).toBe("guest")
    expect(staffFromAgentType("Explore")).toBe("guest")
  })
  it("도구 kind", () => {
    expect(classifyTool("Edit")).toBe("typing")
    expect(classifyTool("Write")).toBe("typing")
    expect(classifyTool("NotebookEdit")).toBe("typing")
    expect(classifyTool("Read")).toBe("research")
    expect(classifyTool("WebSearch")).toBe("research")
    expect(classifyTool("mcp__web__fetch_page")).toBe("research")
    expect(classifyTool("Bash")).toBe("running")
    expect(classifyTool("Agent")).toBe("delegating")
    expect(classifyTool("SubagentHandback")).toBe("reporting")
    expect(classifyTool("TodoWrite")).toBe("other")
  })
})

describe("카드 ID 추출", () => {
  it("정규식 \\b(?:P\\d|U|O)-\\d{2}\\b", () => {
    expect(extractCardId("U-01 urgent security fixes")).toBe("U-01")
    expect(extractCardId("Build calendar engine P3-02/03/07")).toBe("P3-02")
    expect(extractCardId("O-02 office")).toBe("O-02")
    expect(extractCardId("XU-01 no")).toBeNull()
    expect(extractCardId("P10-01")).toBeNull()
    expect(extractCardId("U-001")).toBeNull()
    expect(extractCardId("Hook probe tiny task")).toBeNull()
    expect(extractCardId(null, "지시문 안의 카드 P3-08")).toBe("P3-08")
  })
})

describe("토큰 파싱 방어", () => {
  it("공식 문서 형태(usage + totalTokens)", () => {
    expect(parseTokens({ agentId: "a1", totalTokens: 1234, usage: { input_tokens: 10, output_tokens: 200, cache_read_input_tokens: 1000, cache_creation_input_tokens: 24 } }))
      .toEqual({ input: 10, output: 200, cacheRead: 1000, cacheWrite: 24, total: 1234, agentId: "a1" })
  })
  it("JSON 문자열·camelCase·total 없음 → 합계 계산", () => {
    expect(parseTokens(JSON.stringify({ usage: { inputTokens: 1, outputTokens: 2, cacheReadInputTokens: 3, cacheCreationInputTokens: 4 } })))
      .toEqual({ input: 1, output: 2, cacheRead: 3, cacheWrite: 4, total: 10, agentId: null })
  })
  it("텍스트 본문의 total_tokens 만 숫자로 뽑는다", () => {
    const t = parseTokens([{ type: "text", text: "보고서 본문...\n<usage>total_tokens: 5555\ntool_uses: 3</usage>" }])
    expect(t).toEqual({ input: null, output: null, cacheRead: null, cacheWrite: null, total: 5555, agentId: null })
  })
  it("이상한 값은 버린다", () => {
    expect(parseTokens(null)).toBeNull()
    expect(parseTokens("그냥 문자열")).toBeNull()
    expect(parseTokens({ status: "async_launched", agentId: "a9" })).toBeNull()
    expect(parseTokens({ totalTokens: -5, usage: { input_tokens: "많음", output_tokens: Number.NaN } })).toBeNull()
    expect(parseTokens({ usage: { input_tokens: Infinity, output_tokens: 7 } })).toMatchObject({ input: null, output: 7, total: 7 })
    expect(parseTokens(12345)).toBeNull()
  })
})

const SECRETS = ["SECRET_CMD_rm_rf", "SECRET_FILE_BODY", "SECRET_PROMPT_TEXT", "SECRET_TOOL_RESULT", "SECRET_QUERY", "SECRET_URL", "SECRET_LAST_MSG", "SECRET_NOTIF_MSG", "SECRET_ERROR"]
function hostile(event: string, extra: Record<string, unknown> = {}) {
  return {
    hook_event_name: event, session_id: "sess-1", transcript_path: "/root/.claude/projects/p/SECRET_TRANSCRIPT.jsonl", cwd: "/repo/app",
    prompt_id: "p1", scratchpad_dir: "/tmp/x",
    tool_input: {
      command: "SECRET_CMD_rm_rf /", content: "SECRET_FILE_BODY", old_string: "SECRET_FILE_BODY", new_string: "SECRET_FILE_BODY",
      prompt: "SECRET_PROMPT_TEXT", query: "SECRET_QUERY", url: "https://SECRET_URL.example", pattern: "SECRET_QUERY", file_path: "/repo/app/src/a.ts",
    },
    tool_response: { stdout: "SECRET_TOOL_RESULT", content: [{ type: "text", text: "SECRET_TOOL_RESULT" }] },
    last_assistant_message: "SECRET_LAST_MSG", message: "SECRET_NOTIF_MSG", error: "SECRET_ERROR", agent_transcript_path: "/root/SECRET_TRANSCRIPT",
    ...extra,
  }
}

describe("저장 금지 항목", () => {
  const events = ["SessionStart", "SessionEnd", "PreToolUse", "PostToolUse", "PostToolUseFailure", "SubagentStart", "SubagentStop", "Notification", "PermissionRequest", "Stop"]
  for (const name of events) {
    for (const agent of [{}, { agent_type: "backend-developer", agent_id: "a1" }]) {
      it(`${name}${"agent_type" in agent ? " (직원)" : " (총괄실장)"}: 명령문·내용·프롬프트·결과·검색어·URL·보고문 없음`, () => {
        for (const tool of ["Bash", "Write", "Agent", "WebSearch", "WebFetch"]) {
          const ev = buildEvent(hostile(name, { tool_name: tool, notification_type: "permission_prompt", ...agent }), { root: "/repo/app" })
          const text = JSON.stringify(ev)
          for (const s of SECRETS) expect(text).not.toContain(s)
          expect(text).not.toContain("SECRET_TRANSCRIPT")
        }
      })
    }
  }
  it("허용 필드만 나온다", () => {
    const ev = buildEvent(hostile("PostToolUse", { tool_name: "Agent", tool_use_id: "toolu_1",
      tool_input: { description: "U-01 urgent security fixes and a very long tail that must be cut off here ok", subagent_type: "backend-developer", prompt: "SECRET_PROMPT_TEXT" },
      tool_response: { agentId: "a406", totalTokens: 99, usage: { input_tokens: 9, output_tokens: 90 }, content: [{ type: "text", text: "SECRET_TOOL_RESULT" }] } }), { root: "/repo/app" })
    expect(Object.keys(ev!).sort()).toEqual(["agentId", "cardId", "desc", "event", "file", "kind", "notif", "ok", "sessionId", "staff", "target", "targetAgentId", "tokens", "tool", "toolUseId", "ts", "v"].sort())
    expect(ev!.desc!.length).toBeLessThanOrEqual(60)
    expect(ev!.cardId).toBe("U-01")
    expect(ev!.target).toBe("backend-developer")
    expect(ev!.tokens).toEqual({ input: 9, output: 90, cacheRead: null, cacheWrite: null, total: 99, agentId: "a406" })
    expect(JSON.stringify(ev)).not.toContain("SECRET")
  })
  it("직원의 Agent 이외 호출에는 desc 가 없다", () => {
    const ev = buildEvent({ hook_event_name: "PreToolUse", tool_name: "Bash", agent_type: "qa-security-lead", tool_input: { description: "SECRET_BASH_DESC", command: "x" } })
    expect(ev!.desc).toBeNull()
    expect(JSON.stringify(ev)).not.toContain("SECRET_BASH_DESC")
  })
  it("이벤트 종류별 ok·notif", () => {
    expect(buildEvent({ hook_event_name: "PostToolUse", tool_name: "Read" })!.ok).toBe(true)
    expect(buildEvent({ hook_event_name: "PostToolUseFailure", tool_name: "Read" })!.ok).toBe(false)
    expect(buildEvent({ hook_event_name: "PermissionRequest", tool_name: "Bash" })!.notif).toBe("permission")
    expect(buildEvent({ hook_event_name: "Notification", notification_type: "idle_prompt" })!.notif).toBe("idle_prompt")
    expect(buildEvent({ hook_event_name: "Unknown" })).toBeNull()
    expect(buildEvent(null)).toBeNull()
  })
})

describe("5MB 상한 — 날짜 파일로 넘기기", () => {
  it("상한 이상이면 events-<날짜>.jsonl 로 이름을 바꾸고, 이미 있으면 번호를 붙인다", () => {
    const d = tmp()
    try {
      const f = join(d, "events.jsonl")
      const now = new Date("2026-11-27T12:00:00Z")
      writeFileSync(f, "x".repeat(100))
      expect(rotateIfNeeded(f, now, 1000)).toBeNull()
      expect(rotateIfNeeded(f, now, 100)).toBe(join(d, "events-2026-11-27.jsonl"))
      writeFileSync(f, "y".repeat(100))
      expect(rotateIfNeeded(f, now, 100)).toBe(join(d, "events-2026-11-27-2.jsonl"))
      expect(existsSync(f)).toBe(false)
    } finally { rmSync(d, { recursive: true, force: true }) }
  })
})

describe("Hook 스크립트 실제 실행 (node)", () => {
  const run = (input: string, dir: string) => spawnSync(process.execPath, [HOOK], { input, env: { ...process.env, OFFICE_EVENTS_DIR: dir }, encoding: "utf8", timeout: 10000 })
  it("stdin JSON 하나 → 파일 한 줄, 출력 없음, 종료 코드 0", () => {
    const d = tmp()
    try {
      const h = hostile("PreToolUse", { tool_name: "Edit", agent_type: "backend-developer", agent_id: "a406", tool_use_id: "toolu_9", cwd: ROOT,
        tool_input: { file_path: join(ROOT, "src/app/api/x.ts"), old_string: "SECRET_FILE_BODY", new_string: "SECRET_FILE_BODY" } })
      const r = run(JSON.stringify(h), d)
      expect(r.status).toBe(0)
      expect(r.stdout).toBe("")
      expect(r.stderr).toBe("")
      const lines = readFileSync(join(d, "events.jsonl"), "utf8").trim().split("\n")
      expect(lines).toHaveLength(1)
      const ev = JSON.parse(lines[0])
      expect(ev).toMatchObject({ v: 1, event: "PreToolUse", staff: "backend-developer", agentId: "a406", tool: "Edit", kind: "typing", file: "src/app/api/x.ts", toolUseId: "toolu_9" })
      expect(lines[0]).not.toContain("SECRET")
      // 두 번째 실행은 같은 파일에 한 줄 추가
      run(JSON.stringify({ hook_event_name: "Stop", session_id: "s" }), d)
      expect(readFileSync(join(d, "events.jsonl"), "utf8").trim().split("\n")).toHaveLength(2)
    } finally { rmSync(d, { recursive: true, force: true }) }
  })
  it("깨진 입력·빈 입력·모르는 이벤트 → 아무것도 쓰지 않고 종료 코드 0", () => {
    const d = tmp()
    try {
      for (const input of ["", "garbage{", "[]", JSON.stringify({ hook_event_name: "Nope" })]) {
        const r = run(input, d)
        expect(r.status).toBe(0)
        expect(r.stdout).toBe("")
        expect(r.stderr).toBe("")
      }
      expect(readdirSync(d)).toEqual([])
    } finally { rmSync(d, { recursive: true, force: true }) }
  })
  it("쓸 수 없는 폴더여도 종료 코드 0", () => {
    const d = tmp()
    try {
      const blocker = join(d, "file-not-dir")
      writeFileSync(blocker, "")
      const r = run(JSON.stringify({ hook_event_name: "Stop" }), join(blocker, "sub"))
      expect(r.status).toBe(0)
      expect(r.stdout + r.stderr).toBe("")
    } finally { rmSync(d, { recursive: true, force: true }) }
  })
})
