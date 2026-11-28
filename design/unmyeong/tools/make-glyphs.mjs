// 표지·도장 글자를 윤곽선(path)으로 바꿔 glyphs.json에 저장한다(그림이 <img>로 쓰일 때 글꼴이 없어도 같은 모양).
// 한 번만 돌리면 된다. 글꼴(모두 SIL OFL 1.1, Google Fonts에서 필요한 글자만 받은 TTF):
//   한글 = 나눔명조 700, 한자 = Noto Serif KR 800 (Google의 나눔명조에는 한자가 없다)
// 사용: node make-glyphs.mjs <opentype.js 경로> <나눔명조700.ttf> <NotoSerifKR800.ttf>
//   (opentype.js는 프로젝트 의존성이 아니다 — 임시 폴더에 npm i opentype.js@1 로 설치해 경로를 넘긴다)
import fs from 'node:fs'
import { createRequire } from 'node:module'
const [lib, f700, f800] = process.argv.slice(2)
const opentype = createRequire(import.meta.url)(lib)
const TEXT = { 800: '運命秘書', 700: '운명비서1급밀임시' }
const out = {}
for (const [w, file] of [[700, f700], [800, f800]]) {
  const font = opentype.parse(fs.readFileSync(file).buffer)
  for (const ch of new Set(TEXT[w])) {
    const g = font.charToGlyph(ch)
    if (!g.path.commands.length) throw new Error(`글꼴에 없는 글자: ${ch}`)
    const p = g.getPath(0, 0, 100) // 글자 크기 100, 기준선 y=0
    out[`${w}:${ch}`] = { d: p.toPathData(1), adv: +(g.advanceWidth * 100 / font.unitsPerEm).toFixed(1) }
  }
}
fs.writeFileSync(new URL('./glyphs.json', import.meta.url), JSON.stringify(out))
console.log(Object.keys(out).join(' '))
