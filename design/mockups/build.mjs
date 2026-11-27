// 시안 페이지 생성기 (디자인 실장, P5-01)
// template.html + ../tokens.css + ../logo/*.svg + ../illust/*.svg → index.html (한 파일, 외부 리소스는 Google Fonts만)
// 실행: node design/mockups/build.mjs
//
// 템플릿 표식
//   /*@tokens*/            → tokens.css 내용
//   <!--@sprite-->         → 모든 SVG를 <symbol id="파일이름">으로 모은 숨김 스프라이트
//   {{art:이름 클래스 "대체글"}} → <svg class="art 클래스" viewBox=…><use href="#이름"/></svg>
//                            대체글이 있으면 role="img" aria-label, 없으면 aria-hidden
import { readFileSync, writeFileSync, readdirSync } from "node:fs"
import { dirname, join, basename } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")
const read = (p) => readFileSync(p, "utf8")

const svgDirs = ["logo", "illust"].map((d) => join(root, d))
const symbols = new Map()
for (const dir of svgDirs) {
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".svg")).sort()) {
    const id = basename(f, ".svg")
    const src = read(join(dir, f))
    const viewBox = src.match(/<svg[^>]*\sviewBox="([^"]+)"/)?.[1]
    if (!viewBox) throw new Error(`viewBox 없음: ${f}`)
    const inner = src
      .replace(/^[\s\S]*?<svg[^>]*>/, "")
      .replace(/<\/svg>\s*$/, "")
      .replace(/<title[^>]*>[\s\S]*?<\/title>/g, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .trim()
    if (symbols.has(id)) throw new Error(`SVG 이름 중복: ${id}`)
    symbols.set(id, { viewBox, inner })
  }
}

const sprite =
  '<svg class="sprite" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">\n' +
  [...symbols].map(([id, s]) => `<symbol id="${id}" viewBox="${s.viewBox}">${s.inner}</symbol>`).join("\n") +
  "\n</svg>"

let html = read(join(here, "template.html"))
html = html.replace("/*@tokens*/", () => read(join(root, "tokens.css")))
html = html.replace("<!--@sprite-->", () => sprite)
html = html.replace(/\{\{art:([a-z0-9-]+)((?:\s+[a-z0-9-]+)*)(?:\s+"([^"]*)")?\}\}/g, (_, id, cls, label) => {
  const s = symbols.get(id)
  if (!s) throw new Error(`없는 그림: ${id}`)
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true" focusable="false"'
  return `<svg class="art art-${id}${cls}" viewBox="${s.viewBox}" ${a11y}><use href="#${id}"/></svg>`
})
const left = html.match(/\{\{[^}]*\}\}|\/\*@[a-z]+\*\/|<!--@[a-z]+-->/)
if (left) throw new Error(`처리하지 못한 표식: ${left[0]}`)
writeFileSync(join(here, "index.html"), html)
console.log(`index.html 생성: 그림 ${symbols.size}개, ${(html.length / 1024).toFixed(0)}KB`)
