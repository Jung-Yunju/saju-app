// 무료 결과 화면(/free) 대표 확인용 단일 HTML 미리보기를 만든다.
// 사용: node scripts/preview/build-free-preview.mjs [출력경로]
// 결과물은 서버 없이 브라우저 안에서 계산한다(배포 아님 — 비공개 미리보기 페이지로 올릴 때만 쓴다).
import { build } from "esbuild"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..")
const out = path.resolve(process.argv[2] || path.join(root, "preview-out/free-preview.html"))
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "free-preview-"))
const alias = { "@": path.join(root, "src") }

// 1) 문안 JSON을 서버 코드(loadRawContent) 그대로 읽는다
await build({ entryPoints: [path.join(root, "scripts/preview/raw-content.ts")], bundle: true, platform: "node", format: "esm", outfile: path.join(tmp, "raw.mjs"), alias, logLevel: "error" })
const raw = execFileSync(process.execPath, [path.join(tmp, "raw.mjs")], { cwd: root, encoding: "utf8" })

// 2) 화면 + 엔진을 브라우저용 한 덩어리로 묶는다
const stub = path.join(tmp, "stub.js")
fs.writeFileSync(stub, "export default {}; export const readFileSync = () => { throw new Error('no fs') }; export const join = (...a) => a.join('/');")
const res = await build({
  entryPoints: [path.join(root, "scripts/preview/free-entry.tsx")], bundle: true, platform: "browser", format: "iife", minify: true, write: false,
  jsx: "automatic", target: "es2020", alias: { ...alias, "node:fs": stub, "node:path": stub, fs: stub, path: stub },
  define: { __RAW_CONTENT__: raw, "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_SITE_URL": '""' }, logLevel: "error",
})
const js = res.outputFiles[0].text.replace(/<\/script/gi, "<\\/script")
const css = [path.join(root, "design/tokens.css"), path.join(root, "src/app/free/free.css")].map((f) => fs.readFileSync(f, "utf8")).join("\n")
const sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim()
const stamp = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })

const html = `<title>무료 결과 미리보기</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Gowun+Dodum&family=Noto+Serif+KR:wght@700&display=swap">
<style>
:root { --pv-bg: #f6f1e7; --pv-fg: #2b2620; --pv-note: #6b5f50; --pv-line: #d9cdb8; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --pv-bg: #f6f1e7; --pv-fg: #2b2620; --pv-note: #6b5f50; --pv-line: #d9cdb8; } }
:root[data-theme="dark"] { --pv-bg: #f6f1e7; --pv-fg: #2b2620; --pv-note: #6b5f50; --pv-line: #d9cdb8; }
*, *::before, *::after { box-sizing: border-box; }
body { background: var(--pv-bg); color: var(--pv-fg); }
${css}
#fr-app { --fx-display: "Gowun Batang"; --fx-body: "Gowun Dodum"; --fx-hanja: "Noto Serif KR"; }
.pv-bar { font: 13px/1.5 system-ui, sans-serif; color: var(--pv-note); border-bottom: 1px solid var(--pv-line); padding-block: 8px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.pv-bar b { color: var(--pv-fg); }
</style>
<div class="pv-bar"><b>대표 확인용 미리보기</b> · 실제 /free 화면 코드 그대로 · 계산은 이 브라우저 안에서만(입력값 전송·저장 없음) · 저장 버튼은 이 미리보기에서 동작하지 않을 수 있음 · 기준 ${sha} · ${stamp}</div>
<div id="fr-app"></div>
<script>${js}</script>
`
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, html)
console.log(out, (html.length / 1024).toFixed(0) + "KB")
