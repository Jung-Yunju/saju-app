#!/usr/bin/env node
// 채점 도구 실행기 — vite-node(vitest에 포함)로 TS 스크립트를 돌린다. AI·네트워크 호출 없음.
// 사용: node scripts/qa/rubric/run.mjs auto-score samples/2026-11-28 [--json]
//       node scripts/qa/rubric/run.mjs blind-sheet samples/2026-11-28 --seed 문자열 [--compare p1,p2]
import { spawnSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, "../../..")
const [cmd, ...rest] = process.argv.slice(2)
const scripts = { "auto-score": "auto-score.ts", "blind-sheet": "blind-sheet.ts" }
if (!scripts[cmd]) {
  console.error("사용법: node scripts/qa/rubric/run.mjs <auto-score|blind-sheet> <samples/날짜 폴더> [옵션]")
  process.exit(1)
}
const bin = resolve(root, "node_modules/.bin/vite-node")
const r = spawnSync(bin, [resolve(here, scripts[cmd]), ...rest], { cwd: root, stdio: "inherit" })
process.exit(r.status ?? 1)
