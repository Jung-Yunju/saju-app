// 운명비서(/unmyeong) 대표 확인용 미리보기 묶음. 사용: node scripts/preview/build-unmyeong-preview.mjs <출력 폴더>
// 출력: index.html + app.js + app.css + unmyeong/**(정지 이미지·임시 영상·효과음·임시 그림). 배포 아님(비공개 미리보기 전용).
import { build } from "esbuild"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { execFileSync } from "node:child_process"

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..")
const out = path.resolve(process.argv[2] || path.join(root, "preview-out/unmyeong"))
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "um-preview-"))
fs.mkdirSync(out, { recursive: true })

const stubDir = path.join(root, "scripts/preview/.stubs"); fs.mkdirSync(stubDir, { recursive: true })
const stub = (name, src) => { const p = path.join(stubDir, name); fs.writeFileSync(p, src); return p }
const fsStub = stub("fs.js", "export default {}; export const readFileSync = () => { const e = new Error('no fs'); e.code='ENOENT'; throw e }; export const existsSync = () => false;")
const pathStub = stub("path.js", "const join=(...a)=>a.join('/'); export default { join }; export { join };")
const fontStub = stub("font.js", "const f = (v) => () => ({ variable: v, className: v, style: {} }); export const Nanum_Myeongjo = f('um-font-title'); export const Noto_Serif_KR = f('um-font-hanja'); export const Noto_Sans_KR = f('um-font-body'); export const Gowun_Batang = f('x'); export const Gowun_Dodum = f('x');")
const linkStub = stub("link.js", "import { createElement } from 'react'; export default function Link({ href, children, prefetch, ...rest }) { return createElement('a', { href: typeof href === 'string' ? href : '#', ...rest }, children) }")
const freeCopy = fs.readFileSync(path.join(root, "content/unmyeong/free-copy.json"), "utf8")

const res = await build({
  entryPoints: [path.join(root, "scripts/preview/unmyeong-entry.tsx")], bundle: true, platform: "browser", format: "iife", minify: true,
  outdir: tmp + "/dist", write: true, jsx: "automatic", target: "es2020", loader: { ".svg": "file", ".png": "file", ".jpg": "file", ".webp": "file" },
  alias: { "@": path.join(root, "src"), "node:fs": fsStub, "node:path": pathStub, fs: fsStub, path: pathStub, "next/font/google": fontStub, "next/link": linkStub },
  define: { __FREE_COPY__: freeCopy, "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_SITE_URL": '""' },
  logLevel: "error",
})
let js = fs.readFileSync(path.join(tmp, "dist/unmyeong-entry.js"), "utf8")
let css = fs.existsSync(path.join(tmp, "dist/unmyeong-entry.css")) ? fs.readFileSync(path.join(tmp, "dist/unmyeong-entry.css"), "utf8") : ""
// 절대 경로 "/unmyeong/" → 상대 경로(미리보기 페이지 옆 파일)
js = js.split('"/unmyeong/').join('"unmyeong/').split("'/unmyeong/").join("'unmyeong/").split("`/unmyeong/").join("`unmyeong/")
css = css.split("/unmyeong/").join("unmyeong/")
fs.writeFileSync(path.join(out, "app.js"), js)
fs.writeFileSync(path.join(out, "app.css"), css)
// 자산 복사
for (const sub of ["final", "placeholder"]) {
  const src = path.join(root, "public/unmyeong", sub), dst = path.join(out, "unmyeong", sub)
  fs.mkdirSync(dst, { recursive: true })
  for (const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(dst, f))
}
const sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim()
fs.writeFileSync(path.join(out, "index.html"), `<meta charset="utf-8">
<title>운명비서 미리보기</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&family=Noto+Serif+KR:wght@400;700&family=Noto+Sans+KR:wght@400;700&display=swap">
<link rel="stylesheet" href="app.css">
<style>
:root { --pv-bg: #141310; color-scheme: dark; }
html, body { background: var(--pv-bg); }
.um-font-title { --um-ff-title: "Nanum Myeongjo"; } .um-font-hanja { --um-ff-hanja: "Noto Serif KR"; } .um-font-body { --um-ff-body: "Noto Sans KR"; }
#um-app { --um-ff-title: "Nanum Myeongjo"; --um-ff-hanja: "Noto Serif KR"; --um-ff-body: "Noto Sans KR"; min-height: 100%; }
.pv-tag { position: fixed; left: max(8px, env(safe-area-inset-left, 0px)); bottom: calc(8px + env(safe-area-inset-bottom, 0px)); z-index: 9999; font: 11px/1.3 system-ui, sans-serif; color: #b9a17a; background: rgba(20,19,16,.7); padding: 4px 8px; border-radius: 4px; pointer-events: none; }
</style>
<div id="um-app"></div>
<div class="pv-tag">대표 확인용 미리보기 · 임시 영상 · 계산은 이 기기 안에서만 · ${sha}</div>
<script src="app.js"></script>
`)
console.log(out)
