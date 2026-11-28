// 고서 부품 견본 HTML 만들기(D-033) — esbuild로 book-preview.tsx를 묶어 node로 실행 → design/unmyeong/book-preview*.html
// 사용: node design/unmyeong/tools/build-book-preview.mjs [출력폴더(기본 design/unmyeong)] [google|next]
//   google(기본) = 글꼴을 Google Fonts에서 받음(커밋용) / next = .next 빌드 산출물의 같은 글꼴 조각(인터넷 없이 확인할 때)
import { build } from "esbuild"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const here = path.dirname(new URL(import.meta.url).pathname)
const root = path.resolve(here, "../../..")
const outDir = path.resolve(process.argv[2] ?? path.join(root, "design/unmyeong"))
const mode = process.argv[3] ?? "google"
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ub-preview-"))
const bundle = path.join(tmp, "preview.mjs")
await build({
  entryPoints: [path.join(here, "book-preview.tsx")], bundle: true, platform: "node", format: "esm", jsx: "automatic",
  outfile: bundle, nodePaths: [path.join(root, "node_modules")], logLevel: "warning",
  banner: { js: `import { createRequire } from 'module'; const require = createRequire(${JSON.stringify(path.join(root, "package.json"))});` },
})
fs.mkdirSync(outDir, { recursive: true })
// 출력 파일 위치 기준으로 상대 경로를 만든다 → design/unmyeong/ 에 쓰면 ../../public/… 가 된다
execFileSync(process.execPath, [bundle, path.join(outDir, "book-preview.html"), mode, root], { stdio: "inherit", cwd: root })
fs.rmSync(tmp, { recursive: true, force: true })
