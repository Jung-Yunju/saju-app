// 가상 사무실 품질검증 불합격 결함 회귀 테스트 (O-02) — D1·D1-b·D2·L1·L2·L7
// 근거: docs/TEST_REPORT.md "O-02 가상 사무실 1단계 독립 검증", tests/office-qa/office-qa.test.ts
import { describe, expect, it } from "vitest"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { INTERNAL, MASKED, OUTSIDE_PATH, PRIVATE_FILE, buildEvent, cleanDesc, maskPersonal, sanitizePath } from "../../.claude/hooks/office-event.mjs"
import { backfillFromTranscripts } from "../../scripts/office/backfill.mjs"
import { buildSnapshot, computeState, isIgnoredEvent, mergeEvents } from "../../scripts/office/snapshot.mjs"

const ROOT = resolve(__dirname, "..", "..")
const HOOK = join(ROOT, ".claude", "hooks", "office-event.mjs")
type Ev = Record<string, unknown>
const T0 = Date.parse("2026-11-27T03:00:00Z") // KST 12:00
const at = (s: number) => new Date(T0 + s * 1000).toISOString()
const E = (s: number, event: string, staff: string, extra: Ev = {}): Ev =>
  ({ v: 1, ts: at(s), event, staff, agentId: null, sessionId: "S", tool: null, kind: null, file: null, desc: null, cardId: null, ok: null, notif: null, tokens: null, ...extra })
const status = (events: Ev[], s: number, id: string) => computeState({ events, now: at(s) }).staff.find((x: { id: string }) => x.id === id)
const WORK = new Set(["typing", "research", "running", "working"])
const mainTools = (s: number) => [E(s, "PreToolUse", "main", { tool: "Bash", kind: "running" }), E(s + 1, "PostToolUse", "main", { tool: "Bash", kind: "running" })]

describe("D1 — agent_type 없는 SubagentStart/Stop 은 총괄실장 이벤트가 아니다", () => {
  it("Hook: agent_type 없으면 staff=internal, 있으면 그대로, 도구 이벤트는 여전히 main", () => {
    expect(buildEvent({ hook_event_name: "SubagentStop", agent_id: "ahidden", session_id: "s" })?.staff).toBe(INTERNAL)
    expect(buildEvent({ hook_event_name: "SubagentStart", agent_id: "ahidden", agent_type: "", session_id: "s" })?.staff).toBe(INTERNAL)
    expect(buildEvent({ hook_event_name: "SubagentStop", agent_id: "a1", agent_type: "qa-security-lead" })?.staff).toBe("qa-security-lead")
    expect(buildEvent({ hook_event_name: "SubagentStop", agent_id: "a2", agent_type: "Explore" })?.staff).toBe("guest")
    expect(buildEvent({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: {} })?.staff).toBe("main")
    expect(buildEvent({ hook_event_name: "Stop" })?.staff).toBe("main")
  })
  it("상태 계산은 internal 과 예전 기록(staff=main 인 SubagentStart/Stop)을 무시한다", () => {
    expect(isIgnoredEvent(E(0, "SubagentStop", INTERNAL))).toBe(true)
    expect(isIgnoredEvent(E(0, "SubagentStop", "main", { agentId: "x" }))).toBe(true)
    expect(isIgnoredEvent(E(0, "SubagentStart", "main"))).toBe(true)
    expect(isIgnoredEvent(E(0, "Stop", "main"))).toBe(false)
    expect(isIgnoredEvent(E(0, "SubagentStop", "frontend-developer"))).toBe(false)
    for (const staff of ["main", INTERNAL]) {
      const ev = [...mainTools(0), E(5, "Stop", "main"), E(6, "SubagentStop", staff, { agentId: "ahidden" })]
      for (const s of [7, 60, 200, 400, 590]) {
        const st = status(ev, s, "main")
        expect(st.status, `${staff} t+${s}`).toBe("resting")
        expect(st.statusSince).toBe(at(5))
      }
      // 외부 지원 인력으로도 잡히지 않는다
      const d = computeState({ events: ev, now: at(60) })
      expect(d.staff.find((x: { id: string }) => x.id === "guest").status).toBe("off")
      expect(d.source.eventCount).toBe(3)
    }
  })
  it("진짜 직원 보고는 여전히 총괄실장 회의(규칙)를 만든다(응답 중일 때)", () => {
    const ev = [E(0, "SubagentStart", "backend-developer", { agentId: "b" }), ...mainTools(10), E(30, "SubagentStop", "backend-developer", { agentId: "b" }), ...mainTools(31)]
    expect(status(ev, 100, "main")).toMatchObject({ status: "meeting", rule: true })
  })
  it("Hook 실제 실행: 숨은 SubagentStop 은 internal 로 기록", () => {
    const d = mkdtempSync(join(tmpdir(), "office-reg-"))
    try {
      const r = spawnSync(process.execPath, [HOOK], { input: JSON.stringify({ hook_event_name: "SubagentStop", agent_id: "ahidden", session_id: "s", last_assistant_message: "비밀" }), env: { ...process.env, OFFICE_EVENTS_DIR: d }, encoding: "utf8" })
      expect(r.status).toBe(0)
      const line = JSON.parse(readFileSync(join(d, "events.jsonl"), "utf8").trim())
      expect(line).toMatchObject({ event: "SubagentStop", staff: INTERNAL, agentId: "ahidden" })
      expect(JSON.stringify(line)).not.toContain("비밀")
    } finally { rmSync(d, { recursive: true, force: true }) }
  })
})

describe("D1-b — 응답 종료·입력 대기 뒤 다음 도구 이벤트 전까지 총괄실장은 휴식", () => {
  it("Stop 뒤 idle_prompt 알림만 있으면 resting(시작 시각은 Stop)", () => {
    const ev = [...mainTools(0), E(5, "Stop", "main"), E(65, "Notification", "main", { notif: "idle_prompt" })]
    for (const s of [66, 300, 600]) expect(status(ev, s, "main")).toMatchObject({ status: "resting", statusSince: at(5) })
  })
  it("Stop 없이 idle_prompt 만 와도 resting", () => {
    const ev = [...mainTools(0), E(30, "Notification", "main", { notif: "idle_prompt" })]
    expect(status(ev, 60, "main").status).toBe("resting")
  })
  it("Agent 호출 직후 응답 종료 → 회의(규칙)가 아니라 휴식", () => {
    const ev = [E(0, "PreToolUse", "main", { tool: "Agent", kind: "delegating", target: "backend-developer" }), E(1, "PostToolUse", "main", { tool: "Agent", kind: "delegating" }), E(3, "Stop", "main")]
    expect(status(ev, 30, "main").status).toBe("resting")
  })
  it("다음 도구 이벤트가 오면 다시 일하는 상태", () => {
    const ev = [...mainTools(0), E(5, "Stop", "main"), E(65, "Notification", "main", { notif: "idle_prompt" }), E(100, "PreToolUse", "main", { tool: "Edit", kind: "typing" })]
    expect(status(ev, 110, "main").status).toBe("typing")
  })
  it("휴식 중 10분 넘게 전체가 조용하면 unknown(일하는 상태 아님)", () => {
    const ev = [...mainTools(0), E(5, "Stop", "main")]
    expect(status(ev, 700, "main").status).toBe("unknown")
  })
  it("휴식 중에도 승인 요청이 오면 승인 대기", () => {
    const ev = [...mainTools(0), E(5, "Stop", "main"), E(20, "Notification", "main", { notif: "permission_prompt" })]
    expect(status(ev, 30, "main").status).toBe("awaiting_approval")
  })
})

describe("D2 — 같은 agentId 로 이어서 일한 직원의 업무가 구간마다 닫힌다", () => {
  const F = "frontend-developer"
  const A = { agentId: "aF" }
  it("재개 SubagentStart 가 앞선 암묵 업무를 닫고, 보고 후 회의 → 완료 → 휴식", () => {
    const ev = [E(0, "PreToolUse", F, { ...A, tool: "Edit", kind: "typing" }), E(1, "PostToolUse", F, { ...A, tool: "Edit", kind: "typing" }),
      E(1800, "SubagentStart", F, A), E(1810, "PreToolUse", F, { ...A, tool: "Read", kind: "research" }),
      E(1811, "PostToolUse", F, { ...A, tool: "Read", kind: "research" }), E(1900, "SubagentStop", F, A), E(1901, "PreToolUse", "main", { tool: "Bash", kind: "running" })]
    expect(status(ev, 2000, F)).toMatchObject({ status: "meeting", rule: true })
    expect(WORK.has(status(ev, 2100, F).status)).toBe(false)
    expect(status(ev, 2400, F).status).toBe("done")
    const s = status(ev, 2400, F)
    expect(s.sessions.map((x: { startedAt: string; endedAt: string }) => [x.startedAt, x.endedAt])).toEqual([[at(0), at(1800)], [at(1800), at(1900)]])
    expect(s.task.endedAt).toBe(at(1900))
  })
  it("출근-보고-재출근-보고: 두 업무 모두 닫힘", () => {
    const ev = [E(0, "SubagentStart", F, { ...A, desc: "첫 업무" }), E(10, "PreToolUse", F, { ...A, tool: "Edit", kind: "typing" }), E(60, "SubagentStop", F, A),
      E(600, "SubagentStart", F, A), E(610, "PreToolUse", F, { ...A, tool: "Read", kind: "research" }), E(700, "SubagentStop", F, A), E(705, "Stop", "main")]
    const s = status(ev, 1000, F)
    expect(s.status).toBe("done")
    expect(s.sessions.every((x: { endedAt: string | null }) => x.endedAt !== null)).toBe(true)
    expect(s.sessions).toHaveLength(2)
  })
  it("SubagentStart 몇 초 앞에 찍힌 도구 기록(비동기 순서 뒤바뀜)은 같은 업무로 합친다", () => {
    const ev = [E(0, "PreToolUse", F, { ...A, tool: "Read", kind: "research" }), E(1, "SubagentStart", F, { ...A, desc: "합쳐질 업무" }), E(30, "SubagentStop", F, A), E(31, "Stop", "main")]
    const s = status(ev, 60, F)
    expect(s.sessions).toEqual([{ description: "합쳐질 업무", cardId: null, startedAt: at(0), endedAt: at(30) }])
  })
  it("보고 직후 1분 안에 출근 기록 없이 다시 도구를 쓰면 같은 업무를 다시 열고, 다음 보고에서 닫는다", () => {
    const ev = [E(0, "SubagentStart", F, A), E(10, "PreToolUse", F, { ...A, tool: "Edit", kind: "typing" }), E(100, "SubagentStop", F, A),
      E(125, "PreToolUse", F, { ...A, tool: "SubagentHandback", kind: "reporting" }), E(126, "PostToolUse", F, { ...A, tool: "SubagentHandback", kind: "reporting" }),
      E(126.5, "SubagentStop", F, A), E(127, "Stop", "main")]
    const s = status(ev, 200, F)
    expect(s.status).toBe("meeting")
    expect(s.sessions).toEqual([{ description: null, cardId: null, startedAt: at(0), endedAt: at(126.5) }])
  })
  it("보고 2초 안에 늦게 찍힌 도구 결과(순서 뒤바뀜)는 새 업무를 만들지 않는다", () => {
    const ev = [E(0, "SubagentStart", F, A), E(50, "PreToolUse", F, { ...A, tool: "SubagentHandback", kind: "reporting" }), E(50.1, "SubagentStop", F, A),
      E(50.2, "PostToolUse", F, { ...A, tool: "SubagentHandback", kind: "reporting" }), E(51, "Stop", "main")]
    const s = status(ev, 100, F)
    expect(s.status).toBe("meeting")
    expect(s.sessions).toHaveLength(1)
  })
  it("합치기: 출근/보고 중복은 시각 근접(10초)으로 판정 — 다른 구간의 출근은 남긴다", () => {
    const hook = [E(1800, "SubagentStart", F, A), E(1900, "SubagentStop", F, A)]
    const bf = [E(0, "SubagentStart", F, { ...A, src: "backfill" }), E(500, "SubagentStop", F, { ...A, src: "backfill" }),
      E(1799.8, "SubagentStart", F, { ...A, src: "backfill" }), E(1899.9, "SubagentStop", F, { ...A, src: "backfill" })]
    const merged = mergeEvents(hook, bf)
    expect(merged.map(e => `${e.event}@${(Date.parse(String(e.ts)) - T0) / 1000}${e.src ? "b" : ""}`)).toEqual([
      "SubagentStart@1800", "SubagentStop@1900", "SubagentStart@0b", "SubagentStop@500b",
    ])
  })
})

describe("D2 — 작업기록 변환: 보고 1건마다 종료, 다음 지시에서 재개 시작", () => {
  const jsonl = (rows: unknown[]) => rows.map(r => JSON.stringify(r)).join("\n") + "\n"
  function project() {
    const dir = mkdtempSync(join(tmpdir(), "office-reg-bf-"))
    const sub = join(dir, "sess", "subagents")
    mkdirSync(sub, { recursive: true })
    writeFileSync(join(dir, "sess.jsonl"), jsonl([]))
    const tu = (ts: string, id: string, name: string) => ({ type: "assistant", agentId: "aR", timestamp: ts, message: { id: `m-${id}`, content: [{ type: "tool_use", id, name, input: { message: "SECRET_REPORT" } }] } })
    const tr = (ts: string, id: string) => ({ type: "user", agentId: "aR", timestamp: ts, message: { content: [{ type: "tool_result", tool_use_id: id, content: "ok" }] } })
    writeFileSync(join(sub, "agent-aR.jsonl"), jsonl([
      { type: "user", agentId: "aR", timestamp: "2026-11-27T04:00:00.000Z", message: { content: "SECRET_PROMPT_1" } },
      tu("2026-11-27T04:01:00.000Z", "r1", "Read"), tr("2026-11-27T04:01:01.000Z", "r1"),
      // 이미지 같은 딸림 줄은 새 지시가 아님
      { type: "user", agentId: "aR", isMeta: true, turnCompanion: true, timestamp: "2026-11-27T04:01:02.000Z", message: { content: "[Image]" } },
      tu("2026-11-27T04:05:00.000Z", "h1", "SubagentHandback"), tr("2026-11-27T04:05:00.100Z", "h1"),
      // 30분 뒤 재개 지시
      { type: "user", agentId: "aR", isMeta: true, origin: { kind: "coordinator" }, timestamp: "2026-11-27T04:35:00.000Z", message: { content: "SECRET_PROMPT_2" } },
      tu("2026-11-27T04:36:00.000Z", "e1", "Edit"), tr("2026-11-27T04:36:01.000Z", "e1"),
      tu("2026-11-27T04:40:00.000Z", "h2", "SubagentHandback"), tr("2026-11-27T04:40:00.100Z", "h2"),
      // 보고 없이 응답 종료 → 다음 지시
      { type: "user", agentId: "aR", timestamp: "2026-11-27T04:50:00.000Z", message: { content: [{ type: "text", text: "SECRET_PROMPT_3" }] } },
      { type: "assistant", agentId: "aR", timestamp: "2026-11-27T04:51:00.000Z", message: { id: "m-end", stop_reason: "end_turn", content: [{ type: "text", text: "SECRET_ANSWER" }] } },
      { type: "user", agentId: "aR", timestamp: "2026-11-27T05:00:00.000Z", message: { content: "SECRET_PROMPT_4" } },
      tu("2026-11-27T05:01:00.000Z", "g1", "Grep"),
    ]))
    writeFileSync(join(sub, "agent-aR.meta.json"), JSON.stringify({ agentType: "frontend-developer", description: "O-02 화면 hong@example.com 010-1234-5678" }))
    return dir
  }
  it("구간마다 SubagentStart/Stop, 마지막 구간은 진행 중", () => {
    const dir = project()
    try {
      const { events, agents } = backfillFromTranscripts(dir, { root: ROOT })
      const marks = events.filter(e => e.event === "SubagentStart" || e.event === "SubagentStop").map(e => `${e.event}@${e.ts.slice(11, 19)}`)
      expect(marks).toEqual([
        "SubagentStart@04:00:00", "SubagentStop@04:05:00",
        "SubagentStart@04:35:00", "SubagentStop@04:40:00",
        "SubagentStart@04:50:00", "SubagentStop@04:51:00",
        "SubagentStart@05:00:00",
      ])
      expect(agents[0]).toMatchObject({ agentId: "aR", staff: "frontend-developer", startedAt: "2026-11-27T04:00:00.000Z", endedAt: null })
      // L2: 메타 설명의 개인정보 형태는 가림, 카드 ID 는 유지
      expect(agents[0].desc).toBe(`O-02 화면 ${MASKED} ${MASKED}`)
      expect(agents[0].cardId).toBe("O-02")
      expect(JSON.stringify(events)).not.toMatch(/SECRET|hong@|010-1234/)
      // 상태: 두 번째 보고 10분 뒤(04:50 이전)는 일하는 상태가 아님
      const d = computeState({ events, now: "2026-11-27T04:45:00.000Z" })
      const f = d.staff.find((x: { id: string }) => x.id === "frontend-developer")
      expect(WORK.has(f.status)).toBe(false)
      expect(f.sessions.map((x: { endedAt: string | null }) => x.endedAt)).toEqual(["2026-11-27T04:05:00.100Z", "2026-11-27T04:40:00.100Z"])
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
})

describe("L1 — '~' 로 시작하는 경로는 저장소 밖", () => {
  it("~/·~user/·~ → [외부 경로], ~/.env → [비공개 파일]", () => {
    const root = "/repo/app"
    for (const p of ["~/secrets/key.pem", "~root/.ssh/id_rsa", "~", " ~/x "]) expect(sanitizePath(p, { root, cwd: root })).toBe(OUTSIDE_PATH)
    expect(sanitizePath("~/.env", { root, cwd: root })).toBe(PRIVATE_FILE)
    // 저장소 안의 이름이 ~ 로 시작하지 않는 파일은 그대로
    expect(sanitizePath("src/~tmp.ts", { root, cwd: root })).toBe("src/~tmp.ts")
  })
})

describe("L2 — 업무 설명의 개인정보 형태 가림", () => {
  it("이메일·전화·생년월일·주민번호 형태 → [가림], 카드 ID·버전·일반 숫자는 유지", () => {
    const cases: [string, string][] = [
      ["상담 hong.gildong.qa@example.com", `상담 ${MASKED}`],
      ["1987-05-03 23:41 양력 서울 출생", `${MASKED} 23:41 양력 서울 출생`],
      ["1987년 5월 3일생 상담", `${MASKED}생 상담`],
      ["87년 5월 3일", MASKED],
      ["19870503", MASKED],
      ["1987년생", MASKED],
      ["010-1234-5678 연락", `${MASKED} 연락`],
      ["+82 10 1234 5678", MASKED],
      ["870503-1234567", MASKED],
      ["U-01 보안 수정 P3-05", "U-01 보안 수정 P3-05"],
      ["P3-02/03/07 calendar@0.1.1 next 16.2.1 토큰 976200", "P3-02/03/07 calendar@0.1.1 next 16.2.1 토큰 976200"],
    ]
    for (const [i, o] of cases) expect(maskPersonal(i), i).toBe(o)
  })
  it("가린 뒤 60자로 자른다(잘린 이메일 조각이 남지 않음)", () => {
    const d = cleanDesc(`${"가".repeat(50)} someone.long.name@example.com`)
    expect(d).not.toContain("someone")
    expect(d!.length).toBeLessThanOrEqual(60)
  })
  it("Hook: Agent 호출 설명을 가리고 카드 ID 는 남긴다", () => {
    const ev = buildEvent({ hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { description: "U-01 상담 hong@example.com", subagent_type: "backend-developer", prompt: "x" } })
    expect(ev).toMatchObject({ desc: `U-01 상담 ${MASKED}`, cardId: "U-01" })
  })
  it("상태 문서: 가림 규칙 전 예전 기록의 설명도 가려서 낸다", () => {
    const ev = [E(0, "PreToolUse", "main", { tool: "Agent", kind: "delegating", desc: "상담 hong@example.com", target: "backend-developer" }),
      E(1, "SubagentStart", "backend-developer", { agentId: "b" }), E(2, "PreToolUse", "backend-developer", { agentId: "b", tool: "Read", kind: "research" })]
    const d = computeState({ events: ev, now: at(10) })
    expect(JSON.stringify(d.staff.find((x: { id: string }) => x.id === "backend-developer").task)).not.toContain("hong@")
  })
})

describe("L7 — 예시 이벤트 표시", () => {
  it("sample-events.jsonl 의 모든 이벤트 줄에 sample:true", () => {
    const rows = readFileSync(join(ROOT, "office/fixtures/sample-events.jsonl"), "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l))
    expect(rows.length).toBeGreaterThan(10)
    for (const r of rows) expect(r.sample).toBe(true)
  })
  it("--sample 없이 예시 파일을 넣어도 문서에 sample:true, 실제 이벤트만이면 없음", () => {
    const doc = buildSnapshot({ events: join(ROOT, "office/fixtures/sample-events.jsonl"), board: join(ROOT, "office/fixtures/sample-board.json"), now: "2026-11-27T12:30:00.000Z" })
    expect(doc.sample).toBe(true)
    expect(computeState({ events: [E(0, "Stop", "main"), E(1, "SubagentStart", "backend-developer", { sample: true })], now: at(5) }).sample).toBe(true)
    expect(computeState({ events: [E(0, "Stop", "main")], now: at(5) }).sample).toBeUndefined()
  })
})
