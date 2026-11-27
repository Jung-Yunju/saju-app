#!/usr/bin/env node
// 개발 현황판 생성기
// 원본: docs/board/tasks.json  →  결과: docs/TASK_BOARD.md, docs/board/index.html
// 사용법: node scripts/board/build.mjs
// 규칙 점검: 상태값, 진행률(세부 작업 기준), '개발 완료'는 검증 '통과'일 때만, 선행 작업 ID 존재 여부
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..", "..")
const src = join(root, "docs", "board", "tasks.json")
const data = JSON.parse(readFileSync(src, "utf8"))
const { meta, tasks } = data

const problems = []
const ids = new Set(tasks.map(t => t.id))
for (const t of tasks) {
  if (!meta.statuses.includes(t.status)) problems.push(`${t.id}: 알 수 없는 상태 '${t.status}'`)
  if (t.status === "개발 완료" && t.verification?.result !== "통과")
    problems.push(`${t.id}: 검증 '${t.verification?.result}' 상태에서 '개발 완료' 불가`)
  for (const d of t.depends || []) if (!ids.has(d)) problems.push(`${t.id}: 선행 작업 ${d} 없음`)
  if (!Array.isArray(t.subtasks) || t.subtasks.length === 0) problems.push(`${t.id}: 세부 작업이 없어 진행률을 계산할 수 없음`)
  if (!Array.isArray(t.history) || t.history.length === 0) problems.push(`${t.id}: 이력 없음`)
  const done = (t.subtasks || []).filter(s => s.done).length
  t.progress = { done, total: (t.subtasks || []).length, pct: t.subtasks?.length ? Math.round((done / t.subtasks.length) * 100) : 0 }
}
if (ids.size !== tasks.length) problems.push("중복된 작업 ID가 있음")

if (problems.length) {
  console.error("현황판 규칙 위반:\n- " + problems.join("\n- "))
  process.exit(1)
}

// ── Markdown ───────────────────────────────────────────────
const order = ["대표 승인 대기", "수정 필요", "개발 중", "검증 중", "기획 중", "개발 대기", "보류", "개발 완료"]
const count = s => tasks.filter(t => t.status === s).length
let md = `# 개발 현황판 (TASK_BOARD)\n\n`
md += `> 자동 생성 문서입니다. 직접 고치지 말고 \`docs/board/tasks.json\`을 수정한 뒤 \`node scripts/board/build.mjs\`를 실행하세요.\n`
md += `> 기준일: ${meta.updated} · 현재 단계: ${meta.currentPhase}단계(${meta.phases[meta.currentPhase]}) · 웹 화면: \`docs/board/index.html\`\n\n`
md += `## 요약\n\n| 상태 | 건수 |\n|---|---|\n` + order.map(s => `| ${s} | ${count(s)} |`).join("\n") + `\n| **합계** | **${tasks.length}** |\n\n`
for (const s of order) {
  const list = tasks.filter(t => t.status === s)
  if (!list.length) continue
  md += `## ${s}\n\n| ID | 단계 | 개발 항목 | 담당 | 진행률 | 검증 | 대표 승인 |\n|---|---|---|---|---|---|---|\n`
  for (const t of list) {
    md += `| ${t.id} | ${t.phase} | ${t.title} | ${t.owner} | ${t.progress.done}/${t.progress.total} (${t.progress.pct}%) | ${t.verification.result} | ${t.approval.needed ? "필요: " + t.approval.item : "-"} |\n`
  }
  md += `\n`
}
md += `## 카드 상세\n\n`
for (const t of tasks) {
  md += `### ${t.id} ${t.title}\n\n`
  md += `- **담당**: ${t.owner} · **상태**: ${t.status} · **진행률**: ${t.progress.done}/${t.progress.total}\n`
  md += `- **목적**: ${t.purpose}\n`
  md += `- **선행 작업**: ${t.depends.length ? t.depends.join(", ") : "없음"}\n`
  md += `- **세부 작업**:\n` + t.subtasks.map(s => `  - [${s.done ? "x" : " "}] ${s.t}`).join("\n") + "\n"
  md += `- **개발 결과**: ${t.result || "-"}\n`
  md += `- **검증 결과**: ${t.verification.result}${t.verification.note ? " — " + t.verification.note : ""}\n`
  md += `- **발생한 문제**: ${t.issues || "-"}\n`
  md += `- **대표 승인**: ${t.approval.needed ? "필요 — " + t.approval.item : "불필요"}\n`
  md += `- **유지관리 문서**: ${t.docs.length ? t.docs.join(", ") : "-"}\n`
  md += `- **소스코드 위치**: ${t.code.length ? t.code.map(c => "`" + c + "`").join(", ") : "-"}\n`
  md += `- **이력**: ` + t.history.map(h => `${h.date} ${h.status}(${h.note})`).join(" → ") + "\n\n"
}
writeFileSync(join(root, "docs", "TASK_BOARD.md"), md)

// ── HTML ───────────────────────────────────────────────────
const tpl = readFileSync(join(here, "template.html"), "utf8")
const json = JSON.stringify({ meta, tasks }).replace(/</g, "\\u003c")
writeFileSync(join(root, "docs", "board", "index.html"), tpl.replace("/*__BOARD_DATA__*/null", json))

console.log(`현황판 생성 완료: 작업 ${tasks.length}건 · ` + order.map(s => `${s} ${count(s)}`).join(" · "))
