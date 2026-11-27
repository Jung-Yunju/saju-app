#!/usr/bin/env node
// 견본 풀이 생성 실행기 — generate.ts를 vite-node(vitest에 포함, 추가 설치 없음)로 돌린다.
// 사용: node scripts/content/samples/generate.mjs [--only 1] [--budget-usd 0.5] [--compare] [--fake] [--help]
// Node 내장 fetch는 HTTPS_PROXY를 스스로 읽지 않으므로, 프록시가 잡힌 환경이면 NODE_USE_ENV_PROXY=1을 켜서 넘긴다(Node 22.21 이상).
import { spawnSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, "../../..")
const bin = resolve(root, "node_modules/.bin/vite-node")
const env = { ...process.env }
if ((env.HTTPS_PROXY || env.https_proxy) && env.NODE_USE_ENV_PROXY === undefined) {
  env.NODE_USE_ENV_PROXY = "1"
  // 이 기능의 "실험 기능" 경고 한 줄은 숨긴다(동작과 무관)
  env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ""} --disable-warning=UNDICI-EHPA`.trim()
}
const r = spawnSync(bin, ["--script", resolve(here, "generate.ts"), ...process.argv.slice(2)], { cwd: root, stdio: "inherit", env })
process.exit(r.status ?? 1)
