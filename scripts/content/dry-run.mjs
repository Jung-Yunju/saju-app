#!/usr/bin/env node
// 콘텐츠 엔진 미리보기 실행기 — dry-run.ts를 vite-node(vitest에 포함)로 돌린다. API 호출 없음.
// 사용: node scripts/content/dry-run.mjs [--product BASIC] [--facts] [--prompts]
import { spawnSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, "../..")
const bin = resolve(root, "node_modules/.bin/vite-node")
const r = spawnSync(bin, [resolve(here, "dry-run.ts"), ...process.argv.slice(2)], { cwd: root, stdio: "inherit" })
process.exit(r.status ?? 1)
