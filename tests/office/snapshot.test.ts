// 가상 사무실 상태 판정 테스트 (O-02) — 계약서 4절 규칙의 경계, 오래된 기록, 토큰, 크기 상한, 예시 데이터
import { describe, expect, it } from "vitest"
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import {
  MAX_DOC_BYTES, STAFF, buildSnapshot, computeState, costUsd, eventFiles, loadEvents, mergeEvents, ownerToStaff, parseEventLine,
} from "../../scripts/office/snapshot.mjs"

const ROOT = resolve(__dirname, "..", "..")
type Ev = Record<string, unknown>
const NOW = Date.parse("2026-11-27T12:00:00.000Z") // KST 21:00
const at = (secAgo: number) => new Date(NOW - secAgo * 1000).toISOString()
const e = (secAgo: number, event: string, staff: string, extra: Ev = {}): Ev =>
  ({ v: 1, ts: at(secAgo), event, staff, agentId: staff === "main" ? null : `id-${staff}`, sessionId: "s1", tool: null, kind: null, file: null, desc: null, cardId: null, ok: null, notif: null, tokens: null, ...extra })
const tool = (secAgo: number, staff: string, name: string, kind: string, extra: Ev = {}) => e(secAgo, "PreToolUse", staff, { tool: name, kind, ...extra })
const state = (events: Ev[], tasks: unknown[] = []) => computeState({ events, tasks, now: new Date(NOW) })
const st = (events: Ev[], id: string) => state(events).staff.find((s: { id: string }) => s.id === id)
const B = "backend-developer"
// 직원 업무 시작 + 세션 활성 유지용 총괄실장 이벤트(5초 전)
const keepAlive = e(5, "Stop", "main")

describe("직원 목록", () => {
  it("계약서 2절 전원, 순서 유지, 기록 없으면 unknown(수집 기록 없음)", () => {
    const d = state([])
    expect(d.staff.map((s: { id: string }) => s.id)).toEqual(STAFF.map(s => s.id))
    for (const s of d.staff.filter((x: { id: string }) => x.id !== "ceo")) expect(s.status).toBe("unknown")
    expect(d.source.eventCount).toBe(0)
  })
  it("다른 직원에게 기록이 있으면, 오늘 출근 기록 없는 직원은 off", () => {
    const d = state([e(10, "SubagentStart", B)])
    expect(d.staff.find((s: { id: string }) => s.id === "content-writer").status).toBe("off")
  })
  it("어제(KST) 기록만 있으면 off", () => {
    const yesterday = { ...e(0, "SubagentStart", B), ts: "2026-11-26T14:59:59.000Z" } // KST 11-26 23:59:59
    const d = state([yesterday, e(10, "Stop", "main")])
    expect(d.staff.find((s: { id: string }) => s.id === B).status).toBe("off")
  })
  it("대표는 추적하지 않는다", () => {
    const ceo = state([keepAlive]).staff[0]
    expect(ceo).toMatchObject({ id: "ceo", tracked: false, status: "off" })
  })
})

describe("업무 중 판정 경계 (2분·10분)", () => {
  const base = [e(900, "SubagentStart", B)]
  it("도구 이벤트 120초 → typing / research / running", () => {
    expect(st([...base, tool(120, B, "Edit", "typing"), keepAlive], B).status).toBe("typing")
    expect(st([...base, tool(120, B, "Grep", "research"), keepAlive], B).status).toBe("research")
    expect(st([...base, tool(120, B, "Bash", "running"), keepAlive], B).status).toBe("running")
  })
  it("121초 → working, 600초 → working", () => {
    expect(st([...base, tool(121, B, "Edit", "typing"), keepAlive], B).status).toBe("working")
    expect(st([...base, tool(600, B, "Edit", "typing"), keepAlive], B).status).toBe("working")
  })
  it("601초 → unknown (업무 중 기록인데 10분 넘음)", () => {
    const s = st([...base, tool(601, B, "Edit", "typing"), keepAlive], B)
    expect(s.status).toBe("unknown")
    expect(s.task.startedAt).toBe(at(900))
  })
  it("오래된 기록(2시간 전 업무 중) → unknown, 일하는 모습을 만들지 않음", () => {
    const s = st([e(7300, "SubagentStart", B), tool(7200, B, "Edit", "typing")], B)
    expect(s.status).toBe("unknown")
    expect(s.currentFile).toBeNull()
  })
  it("출근 직후 도구 없음 → working, 그 kind 가 reporting 이면 working", () => {
    expect(st([e(30, "SubagentStart", B)], B).status).toBe("working")
    expect(st([e(60, "SubagentStart", B), tool(10, B, "SubagentHandback", "reporting")], B).status).toBe("working")
  })
  it("같은 kind 가 이어지면 statusSince 는 그 구간의 시작", () => {
    const s = st([...base, tool(100, B, "Read", "research"), tool(90, B, "Edit", "typing"), tool(50, B, "Write", "typing"), keepAlive], B)
    expect(s.status).toBe("typing")
    expect(s.statusSince).toBe(at(90))
  })
  it("SubagentStart 없이 도구 이벤트만 있어도 업무로 본다", () => {
    expect(st([tool(30, B, "Edit", "typing")], B).status).toBe("typing")
  })
})

describe("오류·승인 대기", () => {
  const base = [e(900, "SubagentStart", B)]
  it("마지막 이벤트가 도구 실패: 120초 → error, 121초 → working", () => {
    expect(st([...base, tool(125, B, "Bash", "running"), e(120, "PostToolUseFailure", B, { tool: "Bash", kind: "running", ok: false })], B).status).toBe("error")
    expect(st([...base, tool(125, B, "Bash", "running"), e(121, "PostToolUseFailure", B, { tool: "Bash", kind: "running", ok: false })], B).status).toBe("working")
  })
  it("실패 뒤 다른 도구를 쓰면 error 아님", () => {
    expect(st([...base, e(60, "PostToolUseFailure", B, { tool: "Bash", kind: "running", ok: false }), tool(30, B, "Read", "research")], B).status).toBe("research")
  })
  it("승인 요청 후 도구 이벤트 없음: 1800초 → awaiting_approval, 1801초 → 아님", () => {
    const mk = (sec: number) => [e(sec + 10, "SubagentStart", B), tool(sec + 1, B, "Bash", "running"), e(sec, "PermissionRequest", B, { tool: "Bash", kind: "running", notif: "permission" })]
    const a = state([...mk(1800), keepAlive])
    const s = a.staff.find((x: { id: string }) => x.id === B)
    expect(s.status).toBe("awaiting_approval")
    expect(a.ceo.pendingApprovals).toEqual([{ at: at(1800), staff: B, tool: "Bash", message: "명령 실행 승인 요청" }])
    expect(st([...mk(1801), keepAlive], B).status).toBe("unknown")
  })
  it("승인 후 도구 이벤트가 오면 해제", () => {
    const evs = [e(100, "SubagentStart", B), tool(61, B, "Bash", "running"), e(60, "PermissionRequest", B, { tool: "Bash", notif: "permission" }), e(30, "PostToolUse", B, { tool: "Bash", kind: "running", ok: true })]
    expect(st(evs, B).status).toBe("running")
    expect(state(evs).ceo.pendingApprovals).toEqual([])
  })
  it("Notification(permission_prompt)도 승인 요청으로 본다", () => {
    expect(st([e(100, "SubagentStart", B), e(50, "Notification", B, { notif: "permission_prompt" })], B).status).toBe("awaiting_approval")
    expect(st([e(100, "SubagentStart", B), e(50, "Notification", B, { notif: "idle_prompt" })], B).status).toBe("working")
  })
})

describe("완료·회의(규칙)·휴식·퇴근", () => {
  const job = (stopAgo: number) => [e(stopAgo + 300, "SubagentStart", B), tool(stopAgo + 60, B, "Edit", "typing"), e(stopAgo, "SubagentStop", B)]
  it("보고 후 180초 → meeting(rule), 181초 → done, 600초 → done", () => {
    const m = st([...job(180), keepAlive], B)
    expect(m).toMatchObject({ status: "meeting", rule: true, location: "meeting" })
    expect(st([...job(181), keepAlive], B).status).toBe("done")
    expect(st([...job(600), keepAlive], B).status).toBe("done")
  })
  it("601초 + 세션 활성 → resting(휴게실)", () => {
    expect(st([...job(601), keepAlive], B)).toMatchObject({ status: "resting", location: "lounge" })
  })
  it("601초 + 세션도 10분 넘게 조용 → off (업무를 끝내고 퇴근)", () => {
    expect(st(job(601), B).status).toBe("off")
  })
  it("SessionEnd 이후 → 전원 off", () => {
    const d = state([e(100, "SubagentStart", B), tool(50, B, "Edit", "typing"), e(10, "SessionEnd", "main")])
    expect(d.staff.find((s: { id: string }) => s.id === B).status).toBe("off")
    expect(d.staff.find((s: { id: string }) => s.id === "main").status).toBe("off")
    expect(d.source.sessionActive).toBe(false)
  })
  it("완료 업무에 업무 설명·카드 ID 연결(호출 결과 agentId → 업무)", () => {
    const evs = [
      e(400, "PreToolUse", "main", { tool: "Agent", kind: "delegating", desc: "U-01 fixes", cardId: "U-01", target: B }),
      e(399, "PostToolUse", "main", { tool: "Agent", kind: "delegating", desc: "U-01 fixes", cardId: "U-01", target: B, targetAgentId: `id-${B}`, ok: true }),
      ...job(200), keepAlive,
    ]
    const s = st(evs, B)
    expect(s.status).toBe("done")
    expect(s.task).toEqual({ description: "U-01 fixes", cardId: "U-01", startedAt: at(500), endedAt: at(200) })
    expect(s.elapsedSec).toBe(300)
  })
})

describe("총괄실장", () => {
  const M = "main"
  it("Agent 호출 120초 → meeting(rule), 121초 → working", () => {
    expect(st([tool(120, M, "Agent", "delegating", { target: B })], M)).toMatchObject({ status: "meeting", rule: true })
    expect(st([tool(121, M, "Agent", "delegating", { target: B })], M).status).toBe("working")
  })
  it("직원 보고 후 180초 → meeting, 181초 → 아님", () => {
    expect(st([e(180, "SubagentStop", B), tool(170, M, "Read", "research")], M).status).toBe("meeting")
    expect(st([e(181, "SubagentStop", B), tool(100, M, "Read", "research")], M).status).toBe("research")
  })
  it("마지막 이벤트 10분 이내 → 업무 중, 응답 종료(Stop) 후 → resting, 10분 넘게 조용 → unknown", () => {
    expect(st([tool(300, M, "Bash", "running")], M).status).toBe("working")
    expect(st([tool(300, M, "Bash", "running"), e(200, "Stop", M)], M).status).toBe("resting")
    expect(st([tool(601, M, "Bash", "running")], M).status).toBe("unknown")
  })
})

describe("외부 지원 인력", () => {
  it("여러 명을 묶어 인원수 표시, 가장 눈에 띄는 상태를 대표로", () => {
    const g = (id: string, ev: string, sec: number, extra: Ev = {}) => e(sec, ev, "guest", { agentId: id, ...extra })
    const s = st([g("g1", "SubagentStart", 900), g("g1", "SubagentStop", 800), g("g2", "SubagentStart", 100), g("g2", "PreToolUse", 30, { tool: "WebFetch", kind: "research" })], "guest")
    expect(s).toMatchObject({ status: "research", headcount: 2, activeCount: 1 })
  })
  it("목록 밖 staff 값도 guest 로 귀속", () => {
    expect(st([e(30, "SubagentStart", "Explore", { agentId: "x" })], "guest").status).toBe("working")
  })
})

describe("이벤트 읽기", () => {
  it("_comment 줄·깨진 줄·v 다른 줄 무시", () => {
    expect(parseEventLine(JSON.stringify({ v: 1, _comment: "예시" }))).toBeNull()
    expect(parseEventLine("{broken")).toBeNull()
    expect(parseEventLine(JSON.stringify({ v: 2, ts: at(0), event: "Stop" }))).toBeNull()
    expect(parseEventLine(JSON.stringify({ v: 1, ts: "nope", event: "Stop" }))).toBeNull()
    expect(parseEventLine(JSON.stringify({ v: 1, ts: at(0), event: "Stop" }))).toMatchObject({ staff: "main" })
  })
  it("기준 시각 이후 이벤트는 무시(--now 주입)", () => {
    const s = st([e(-60, "SubagentStart", B), e(-50, "PreToolUse", B, { tool: "Edit", kind: "typing" }), keepAlive], B)
    expect(s.status).toBe("off")
  })
  it("넘긴 날짜 파일도 함께 읽는다", () => {
    const d = mkdtempSync(join(tmpdir(), "office-snap-"))
    try {
      writeFileSync(join(d, "events-2026-11-26.jsonl"), JSON.stringify(e(100, "SubagentStart", B)) + "\n")
      writeFileSync(join(d, "events.jsonl"), JSON.stringify(e(50, "PreToolUse", B, { tool: "Edit", kind: "typing" })) + "\n")
      writeFileSync(join(d, "other.jsonl"), JSON.stringify(e(10, "Stop", "main")) + "\n")
      const files = eventFiles(join(d, "events.jsonl"))
      expect(files.map(f => f.slice(d.length + 1))).toEqual(["events-2026-11-26.jsonl", "events.jsonl"])
      expect(loadEvents(files)).toHaveLength(2)
    } finally { rmSync(d, { recursive: true, force: true }) }
  })
  it("Hook 기록과 작업기록 변환본이 겹치면 Hook 쪽만 남김", () => {
    const hook = [tool(10, B, "Edit", "typing", { toolUseId: "t1" }), e(20, "SubagentStart", B)]
    const bf = [tool(10, B, "Edit", "typing", { toolUseId: "t1", src: "backfill" }), e(20, "SubagentStart", B, { src: "backfill" }), tool(5, B, "Read", "research", { toolUseId: "t2", src: "backfill" })]
    expect(mergeEvents(hook, bf)).toHaveLength(3)
  })
})

describe("토큰·비용", () => {
  it("Hook 토큰은 호출 대상 직원에게, 같은 업무에 작업기록 집계가 있으면 그것만", () => {
    const hookTok = e(100, "PostToolUse", "main", { tool: "Agent", kind: "delegating", target: B, targetAgentId: "a1", tokens: { input: 1, output: 1000000, cacheRead: 0, cacheWrite: 0, total: 1000001, agentId: "a1" } })
    const s = st([e(200, "SubagentStart", B, { agentId: "a1" }), hookTok, keepAlive], B)
    expect(s.tokens).toMatchObject({ output: 1000000, total: 1000001, source: "hook" })
    expect(s.costUsdEstimate.usd).toBe(20)
    expect(s.costUsdEstimate.basis).toContain("실제 청구 아님")
    expect(s.costUsdEstimate.basis).toContain("Opus")
    expect(st([], "main").tokens).toBeNull()
    const usage = { ...e(50, "Usage", B, { agentId: "a1" }), tokens: { input: 0, output: 1000000, cacheRead: 0, cacheWrite: 0, total: 1000000, model: "claude-sonnet-5-5", agentId: "a1" } }
    const s2 = st([e(200, "SubagentStart", B, { agentId: "a1" }), hookTok, usage, keepAlive], B)
    expect(s2.tokens).toMatchObject({ total: 1000000, source: "transcript" })
    expect(s2.costUsdEstimate.usd).toBe(10)
  })
  it("Usage 이벤트는 상태 판정에 쓰지 않는다", () => {
    const usage = { ...e(5, "Usage", B), tokens: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, total: 2, model: "x" } }
    expect(st([usage], B).status).toBe("unknown")
  })
  it("모델별 단가", () => {
    const t = { input: 1e6, output: 1e6, cacheRead: 1e6, cacheWrite: 1e6 }
    expect(costUsd(t, "claude-opus-5-5").usd).toBeCloseTo(29.2)
    expect(costUsd(t, "claude-sonnet-5-5").usd).toBeCloseTo(14.6)
    expect(costUsd(t, "haiku").usd).toBeCloseTo(0.735)
    expect(costUsd(t, null)).toMatchObject({ assumedOpus: true })
  })
})

describe("현황판 연동", () => {
  it("tasks.json 의 실제 owner 값이 전부 staffId 로 매핑된다", () => {
    const board = JSON.parse(readFileSync(join(ROOT, "docs/board/tasks.json"), "utf8"))
    const owners = [...new Set(board.tasks.map((t: { owner: string }) => t.owner))] as string[]
    for (const o of owners) expect(ownerToStaff(o).length, o).toBeGreaterThan(0)
    expect(ownerToStaff("총괄실장 + 디자인 실장")).toEqual(["main", "design-director"])
    expect(ownerToStaff("")).toEqual([])
  })
  it("카드 진행률은 세부 작업 완료 수, 완료 카드는 completed", () => {
    const tasks = [
      { id: "U-01", title: "a", owner: "백엔드·서버 개발자", status: "수정 필요", subtasks: [{ t: "1", done: true }, { t: "2", done: false }], verification: { result: "조건부 통과" }, issues: "문제", approval: { needed: true, item: "배포 승인" } },
      { id: "P6-01", title: "b", owner: "백엔드·서버 개발자", status: "개발 완료", subtasks: [{ t: "1", done: true }], verification: { result: "통과" }, approval: { needed: false, item: "" } },
    ]
    const d = state([keepAlive], tasks)
    const s = d.staff.find((x: { id: string }) => x.id === B)
    expect(s.cards).toEqual([{ id: "U-01", title: "a", status: "수정 필요", progress: { done: 1, total: 2 }, verification: "조건부 통과", issues: "문제", approval: "배포 승인" }])
    expect(s.completed).toEqual([{ id: "P6-01", title: "b" }])
    expect(d.ceo.boardApprovals).toEqual([{ cardId: "U-01", title: "a", item: "배포 승인", status: "수정 필요" }])
  })
})

describe("크기 상한·결정론", () => {
  it("이벤트 3만 건이어도 문서는 200KB 이하, 활동 30개·세션 10개", () => {
    const evs: Ev[] = []
    for (let i = 0; i < 30000; i++) {
      const staff = STAFF[1 + (i % 11)].id
      const sec = 30000 - i
      if (i % 50 === 0) evs.push(e(sec + 0.5, "SubagentStart", staff, { agentId: `${staff}-${Math.floor(i / 500)}`, desc: "가".repeat(60) }))
      evs.push(tool(sec, staff, "Edit", "typing", { agentId: `${staff}-${Math.floor(i / 500)}`, file: `src/very/long/path/${"x".repeat(150)}/${i}.ts`, toolUseId: `t${i}` }))
    }
    const d = computeState({ events: evs, now: new Date(NOW) })
    const size = Buffer.byteLength(JSON.stringify(d, null, 2))
    expect(size).toBeLessThanOrEqual(MAX_DOC_BYTES)
    for (const s of d.staff) { expect(s.activity.length).toBeLessThanOrEqual(30); expect(s.sessions.length).toBeLessThanOrEqual(10) }
  })
  it("같은 입력 + 같은 now → 같은 결과", () => {
    const evs = [e(100, "SubagentStart", B), tool(50, B, "Edit", "typing", { toolUseId: "a" }), e(40, "PostToolUse", B, { tool: "Edit", kind: "typing", toolUseId: "a", ok: true })]
    expect(JSON.stringify(state(evs))).toBe(JSON.stringify(state(evs)))
    expect(st(evs, B).activity).toEqual([{ at: at(50), kind: "typing", tool: "Edit", file: null, ok: true }])
  })
})

describe("예시 데이터 (office/fixtures)", () => {
  it("sample-state.json 은 예시 표시가 있고 모든 상태가 한 번 이상 나온다", () => {
    const d = JSON.parse(readFileSync(join(ROOT, "office/fixtures/sample-state.json"), "utf8"))
    expect(d.sample).toBe(true)
    const statuses = new Set(d.staff.filter((s: { id: string }) => s.id !== "ceo").map((s: { status: string }) => s.status))
    for (const k of ["typing", "research", "running", "working", "meeting", "done", "resting", "error", "awaiting_approval", "unknown", "off"]) expect(statuses.has(k), k).toBe(true)
    expect(Buffer.byteLength(JSON.stringify(d, null, 2))).toBeLessThanOrEqual(MAX_DOC_BYTES)
  })
  it("sample-events.jsonl 첫 줄은 예시 표시이고, 다시 계산하면 저장본과 같다", () => {
    const first = readFileSync(join(ROOT, "office/fixtures/sample-events.jsonl"), "utf8").split("\n")[0]
    expect(JSON.parse(first)._comment).toContain("예시")
    const re = buildSnapshot({ events: join(ROOT, "office/fixtures/sample-events.jsonl"), board: join(ROOT, "office/fixtures/sample-board.json"), now: "2026-11-27T12:30:00.000Z", sample: true })
    const saved = JSON.parse(readFileSync(join(ROOT, "office/fixtures/sample-state.json"), "utf8"))
    expect(re).toEqual(saved)
  })
})

describe("명령행 실행", () => {
  it("--events --out --now --board 로 파일 생성", () => {
    const d = mkdtempSync(join(tmpdir(), "office-cli-"))
    try {
      const out = join(d, "state.json")
      const r = spawnSync(process.execPath, [join(ROOT, "scripts/office/snapshot.mjs"), "--events", join(ROOT, "office/fixtures/sample-events.jsonl"),
        "--board", join(ROOT, "office/fixtures/sample-board.json"), "--out", out, "--now", "2026-11-27T12:30:00Z", "--quiet"], { encoding: "utf8" })
      expect(r.status).toBe(0)
      const doc = JSON.parse(readFileSync(out, "utf8"))
      expect(doc.generatedAt).toBe("2026-11-27T12:30:00.000Z")
      expect(doc.sample).toBeUndefined()
      const bad = spawnSync(process.execPath, [join(ROOT, "scripts/office/snapshot.mjs"), "--now", "어제", "--out", out], { encoding: "utf8" })
      expect(bad.status).not.toBe(0)
    } finally { rmSync(d, { recursive: true, force: true }) }
  })
})
