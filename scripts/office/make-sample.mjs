#!/usr/bin/env node
// 가상 사무실 "예시 화면"용 가짜 데이터 생성기 (O-02)
// 결과: office/fixtures/sample-events.jsonl, sample-board.json, sample-state.json
// 모든 값은 예시이며 실제 업무가 아니다. 모든 상태(11가지)가 한 번씩 나오도록 짰다.
// 사용법: node scripts/office/make-sample.mjs
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { REPO_ROOT, buildSnapshot } from "./snapshot.mjs"

export const SAMPLE_NOW = "2026-11-27T12:30:00.000Z"
const dir = join(REPO_ROOT, "office", "fixtures")
const SID = "example-session"
const T = hms => `2026-11-27T${hms}.000Z`

const base = { desc: null, cardId: null, ok: null, notif: null, tokens: null }
// 모든 예시 이벤트에 sample:true — --sample 없이 이 파일을 넣어도 상태 문서가 예시로 표시된다(L7)
const ev = (ts, event, staff, agentId, extra = {}) => ({ v: 1, ts, event, staff, agentId, sessionId: SID, tool: null, kind: null, file: null, ...base, ...extra, sample: true })
let n = 0
const tid = () => `example-tool-${String(++n).padStart(3, "0")}`
const KIND = { Edit: "typing", Write: "typing", Read: "research", Grep: "research", Glob: "research", WebSearch: "research", Bash: "running", Agent: "delegating", SubagentHandback: "reporting" }
function tool(ts, staff, agentId, name, file = null, result = "ok", postTs = null) {
  const id = tid()
  const common = { tool: name, kind: KIND[name], file, toolUseId: id }
  const out = [ev(ts, "PreToolUse", staff, agentId, common)]
  if (result === "ok") out.push(ev(postTs || ts, "PostToolUse", staff, agentId, { ...common, ok: true }))
  if (result === "fail") out.push(ev(postTs || ts, "PostToolUseFailure", staff, agentId, { ...common, ok: false }))
  return out
}
function call(ts, target, agentId, desc, cardId, tokens = null, postTs = null) {
  const id = tid()
  const common = { tool: "Agent", kind: "delegating", desc, cardId, target, toolUseId: id }
  return [
    ev(ts, "PreToolUse", "main", null, common),
    ev(postTs || ts, "PostToolUse", "main", null, { ...common, ok: true, targetAgentId: agentId, tokens }),
  ]
}

const E = [
  // 어제 기록 — 오늘 출근 기록이 없으므로 '퇴근(off)'
  ev("2026-11-26T05:00:00.000Z", "SubagentStart", "content-writer", "example-cw", { desc: "예시: 말투 문서 다듬기", cardId: "P9-09" }),
  ...tool("2026-11-26T05:10:00.000Z", "content-writer", "example-cw", "Write", "docs/example/tone.md"),
  ev("2026-11-26T05:30:00.000Z", "SubagentStop", "content-writer", "example-cw"),

  ev(T("11:40:00"), "SessionStart", "main", null),
  ...tool(T("11:40:05"), "main", null, "Read", "docs/board/tasks.json"),

  // 외부 지원 인력 2 — 끝나고 쉬는 중
  ...call(T("11:50:00"), "guest", "example-guest-2", "예시: 외부 검토 보조", null, null, T("11:50:01")),
  ev(T("11:50:02"), "SubagentStart", "guest", "example-guest-2"),
  ...tool(T("11:52:00"), "guest", "example-guest-2", "Grep", "src/example"),
  ...tool(T("11:57:00"), "guest", "example-guest-2", "SubagentHandback"),
  ev(T("11:58:00"), "SubagentStop", "guest", "example-guest-2"),

  // 사업기획 — 25분 전 보고, 세션은 활성 → 휴식
  ...call(T("11:55:00"), "business-strategist", "example-biz", "예시: 비용 표 정리 P9-08", "P9-08", null, T("11:55:01")),
  ev(T("11:55:02"), "SubagentStart", "business-strategist", "example-biz"),
  ...tool(T("11:56:00"), "business-strategist", "example-biz", "Read", "docs/example/cost.md"),
  ...tool(T("12:00:00"), "business-strategist", "example-biz", "Write", "docs/example/cost.md"),
  ...tool(T("12:04:30"), "business-strategist", "example-biz", "SubagentHandback"),
  ev(T("12:05:00"), "SubagentStop", "business-strategist", "example-biz"),

  // 외부 지원 인력 1 — 업무 중인데 20분째 소식 없음 → 상태 확인 불가
  ...call(T("12:00:00"), "guest", "example-guest-1", "예시: 자료 조사 보조", null, null, T("12:00:01")),
  ev(T("12:00:02"), "SubagentStart", "guest", "example-guest-1"),
  ...tool(T("12:05:00"), "guest", "example-guest-1", "WebSearch"),
  ...tool(T("12:10:00"), "guest", "example-guest-1", "Read", "[외부 경로]"),

  // 디자인 실장 — 6분 전 보고 → 완료 (Hook 토큰 예시 포함)
  ev(T("12:05:00"), "PreToolUse", "main", null, { tool: "Agent", kind: "delegating", desc: "예시: 사무실 그림 P9-06", cardId: "P9-06", target: "design-director", toolUseId: "example-tool-design" }),
  ev(T("12:05:02"), "SubagentStart", "design-director", "example-design"),
  ...tool(T("12:10:00"), "design-director", "example-design", "Write", "office/example/art.js"),
  ...tool(T("12:20:00"), "design-director", "example-design", "Edit", "office/example/art.js"),
  ...tool(T("12:23:50"), "design-director", "example-design", "SubagentHandback"),
  ev(T("12:24:00"), "SubagentStop", "design-director", "example-design"),
  ev(T("12:24:01"), "PostToolUse", "main", null, { tool: "Agent", kind: "delegating", desc: "예시: 사무실 그림 P9-06", cardId: "P9-06", target: "design-director", toolUseId: "example-tool-design", ok: true, targetAgentId: "example-design",
    tokens: { input: 1200, output: 45000, cacheRead: 900000, cacheWrite: 30000, total: 976200, agentId: "example-design" } }),

  // 사주엔진 — 마지막 도구 5분 전 → 업무 중
  ...call(T("12:10:00"), "saju-engine-developer", "example-engine", "예시: 절기 계산 점검 P9-02", "P9-02", null, T("12:10:01")),
  ev(T("12:10:02"), "SubagentStart", "saju-engine-developer", "example-engine"),
  ...tool(T("12:15:00"), "saju-engine-developer", "example-engine", "Edit", "src/example/solar-terms.ts"),
  ...tool(T("12:25:00"), "saju-engine-developer", "example-engine", "Bash", null, "ok", T("12:25:00")),

  // 개인화 — 명령 실행 승인 요청 후 10분째 대기 → 승인 대기
  ...call(T("12:12:00"), "personalization-researcher", "example-pers", "예시: 질문 분류 P9-04", "P9-04", null, T("12:12:01")),
  ev(T("12:12:02"), "SubagentStart", "personalization-researcher", "example-pers"),
  ...tool(T("12:15:00"), "personalization-researcher", "example-pers", "Read", "docs/example/questions.md"),
  ev(T("12:19:59"), "PreToolUse", "personalization-researcher", "example-pers", { tool: "Bash", kind: "running", toolUseId: "example-tool-perm" }),
  ev(T("12:20:00"), "PermissionRequest", "personalization-researcher", "example-pers", { tool: "Bash", kind: "running", notif: "permission", toolUseId: "example-tool-perm" }),
  ev(T("12:20:01"), "Notification", "personalization-researcher", "example-pers", { notif: "permission_prompt" }),

  // 명리학 연구소장 — 50초 전 웹 검색 → 자료 조사
  ...call(T("12:14:00"), "myeongri-research-director", "example-myeongri", "예시: 고전 문헌 조사 P9-05", "P9-05", null, T("12:14:01")),
  ev(T("12:14:02"), "SubagentStart", "myeongri-research-director", "example-myeongri"),
  ...tool(T("12:20:00"), "myeongri-research-director", "example-myeongri", "Write", "docs/example/classics.md"),
  ev(T("12:29:10"), "PreToolUse", "myeongri-research-director", "example-myeongri", { tool: "WebSearch", kind: "research", toolUseId: "example-tool-ws" }),

  // 품질검증 — 20초 전 테스트 실행 → 실행·테스트 (가림 규칙 예시 포함)
  ...call(T("12:15:00"), "qa-security-lead", "example-qa", "예시: 테스트 실행 P9-07", "P9-07", null, T("12:15:01")),
  ev(T("12:15:02"), "SubagentStart", "qa-security-lead", "example-qa"),
  ...tool(T("12:18:00"), "qa-security-lead", "example-qa", "Grep", "[비공개 파일]"),
  ...tool(T("12:29:00"), "qa-security-lead", "example-qa", "Bash", null, "ok", T("12:29:40")),

  // 프론트엔드 — 40초 전 도구 실패 → 오류
  ...call(T("12:16:00"), "frontend-developer", "example-front", "예시: 사무실 화면 P9-03", "P9-03", null, T("12:16:01")),
  ev(T("12:16:02"), "SubagentStart", "frontend-developer", "example-front"),
  ...tool(T("12:25:00"), "frontend-developer", "example-front", "Write", "office/example/app.js"),
  ...tool(T("12:29:15"), "frontend-developer", "example-front", "Bash", null, "fail", T("12:29:20")),

  // 백엔드 — 1분 전 호출, 30초 전 코드 수정 → 코드 작성 / 총괄실장은 호출 직후라 회의(규칙)
  ...call(T("12:29:00"), "backend-developer", "example-backend", "예시: 결제 API 점검 P9-01", "P9-01", null, T("12:29:01")),
  ev(T("12:29:02"), "SubagentStart", "backend-developer", "example-backend"),
  ...tool(T("12:29:10"), "backend-developer", "example-backend", "Read", "src/example/payment.ts"),
  ...tool(T("12:29:30"), "backend-developer", "example-backend", "Edit", "src/example/payment.ts"),
]
E.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts))

const sub = (n2, d) => Array.from({ length: n2 }, (_, i) => ({ t: `예시 세부 작업 ${i + 1}`, done: i < d }))
const card = (id, title, owner, status, total, done, extra = {}) => ({
  id, phase: "9", title: `예시 — ${title}`, owner, purpose: "예시 데이터 — 실제 업무 아님", depends: [], status,
  subtasks: sub(total, done), result: "", verification: { result: "미검증", note: "" }, issues: "", approval: { needed: false, item: "" },
  docs: [], code: [], history: [{ date: "2026-11-27", status, note: "예시" }], ...extra,
})
const board = {
  meta: { project: "예시 사무실", updated: "2026-11-27", _comment: "예시 데이터 — 실제 업무 아님" },
  tasks: [
    card("P9-01", "결제 API 점검", "백엔드·서버 개발자", "개발 중", 5, 2),
    card("P9-02", "절기 계산 점검", "사주엔진 개발자", "개발 중", 4, 3),
    card("P9-03", "사무실 화면", "프론트엔드 개발자", "수정 필요", 6, 4, { issues: "예시 문제: 모바일에서 버튼이 겹침" }),
    card("P9-04", "질문 분류", "개인화 분석 연구원", "개발 중", 3, 1),
    card("P9-05", "고전 문헌 조사", "명리학 연구소장", "개발 중", 4, 2),
    card("P9-06", "사무실 그림", "디자인 실장", "검증 중", 3, 3, { verification: { result: "조건부 통과", note: "예시" } }),
    card("P9-07", "테스트 실행", "품질검증 담당자", "개발 중", 5, 1),
    card("P9-08", "비용 표 정리", "사업기획·마케팅 담당자", "개발 완료", 2, 2, { verification: { result: "통과", note: "예시" } }),
    card("P9-09", "말투 문서", "콘텐츠 작가·캐릭터 기획자", "대표 승인 대기", 2, 2, { approval: { needed: true, item: "예시: 캐릭터 말투 승인" } }),
    card("P9-10", "운영 계획", "총괄실장", "대표 승인 대기", 3, 3, { approval: { needed: true, item: "예시: 일정 승인" } }),
  ],
}

mkdirSync(dir, { recursive: true })
const evFile = join(dir, "sample-events.jsonl")
const boardFile = join(dir, "sample-board.json")
writeFileSync(evFile, [JSON.stringify({ v: 1, sample: true, _comment: "예시 데이터 — 실제 업무 아님 (scripts/office/make-sample.mjs 가 생성)" }), ...E.map(e => JSON.stringify(e))].join("\n") + "\n")
writeFileSync(boardFile, JSON.stringify(board, null, 2) + "\n")
// sample 옵션 없이 만들어도 예시 문서가 되는지가 L7 의 확인 지점이므로 옵션을 넘기지 않는다
const state = buildSnapshot({ events: evFile, board: boardFile, now: SAMPLE_NOW })
if (state.sample !== true) throw new Error("예시 이벤트의 sample 표시가 상태 문서에 반영되지 않음")
writeFileSync(join(dir, "sample-state.json"), JSON.stringify(state, null, 2) + "\n")
console.log("예시 데이터 생성: " + state.staff.map(s => `${s.id}=${s.status}`).join(", "))
