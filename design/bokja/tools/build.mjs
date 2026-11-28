// 복자 그림 만들기: node design/bokja/tools/build.mjs
// 만드는 파일
//   design/bokja/bokja-loaf.svg   ① 식빵 자세 정면(시트용, 털 결 많음)
//   design/bokja/bokja-sleep.svg  ② 웅크려 자기
//   design/bokja/bokja-push.svg   ③ 머리로 문을 미는 옆모습(부위별 <g id> — 움직임용)
//   design/bokja/handoff/bokja-svg.ts  무료 결과 화면용 문자열 모듈(src/app/free/bokja-svg.ts를 이 파일로 바꾸면 된다)
// 사진(design/bokja/reference/)은 읽지 않는다 — 모양은 pose-*.mjs의 손으로 잡은 좌표다.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loaf } from './pose-loaf.mjs'
import { sleep } from './pose-sleep.mjs'
import { push } from './pose-push.mjs'

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LIMIT = 60 * 1024

const squeeze = (s) => s.replace(/\n+/g, '\n').replace(/>\s+</g, '><').trim()

/** 두 번 이상 쓰인 긴 윤곽선(d)을 <defs>에 한 번만 두고 <use>로 다시 쓴다(무게 줄이기) */
function hoist(r, p) {
  const all = r.defs + (r.sticker || '') + r.body
  const count = new Map()
  for (const m of all.matchAll(/<path d="([^"]{120,})"/g)) count.set(m[1], (count.get(m[1]) || 0) + 1)
  let defs = r.defs, body = r.body, sticker = r.sticker || '', shared = '', i = 0
  for (const [d, n] of count) {
    if (n < 2) continue
    const id = `${p}-o${i++}`
    shared += `<path id="${id}" d="${d}"/>`
    const re = new RegExp(`<path d="${d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g')
    defs = defs.replace(re, `<use href="#${id}"`)
    body = body.replace(re, `<use href="#${id}"`)
    sticker = sticker.replace(re, `<use href="#${id}"`)
  }
  return { ...r, defs: shared + defs, body, sticker }
}

function doc(r, title, desc) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r.viewBox}" width="${r.w}" height="${r.h}" role="img" aria-labelledby="t d">
<title id="t">${title}</title><desc id="d">${desc}</desc>
<!-- 생성 파일: design/bokja/tools/build.mjs (직접 고치지 말고 pose-*.mjs를 고친 뒤 다시 만든다) -->
<defs>${squeeze(r.defs)}</defs>
${squeeze(r.body)}
</svg>
`
}

const files = [
  ['bokja-loaf.svg', hoist(loaf({ p: 'bl', detail: 0.9 }), 'bl'), '복자 — 식빵 자세(정면)', '검은 턱시도 고양이 복자가 식빵 자세로 엎드려 노란 눈으로 무심하게 정면을 본다. 미간에서 시작하는 가는 흰 줄, 흰 주둥이에 비대칭 검은 코 점, 넓은 흰 턱받이, 옆으로 뻗은 흰 양말 뒷발, 세운 검은 꼬리.'],
  ['bokja-sleep.svg', hoist(sleep({ p: 'bs', detail: 1 }), 'bs'), '복자 — 웅크려 자기', '복자가 둥근 짚 바구니에서 옆으로 누워 머리를 숙이고 잔다. 흰 주둥이의 검은 코 점, 발바닥이 보이는 흰 앞발, 바구니 턱을 넘어 늘어진 흰 양말 뒷발(분홍 발바닥에 검은 점).'],
  ['bokja-push.svg', hoist(push({ p: 'bp', detail: 1 }), 'bp'), '복자 — 머리로 문을 미는 옆모습', '복자가 오른쪽을 향해 고개를 숙이고 이마로 무언가를 민다. 통통한 몸, 흰 턱받이와 흰 주둥이, 네 발의 흰 양말, 세운 검은 꼬리.'],
]
for (const [name, r, title, desc] of files) {
  const out = doc(r, title, desc)
  fs.writeFileSync(path.join(DIR, name), out)
  const kb = Buffer.byteLength(out) / 1024
  console.log(`${name}  ${kb.toFixed(1)}KB${kb * 1024 > LIMIT ? '  ← 60KB 초과!' : ''}`)
}

// ── 무료 결과 화면용(작게 보이므로 털 결을 줄인 판) ──
const lite = hoist(loaf({ p: '__P__', detail: 0.5, edge: '__EDGE__' }), '__P__')
const tpl = (x) => {
  if (/[`\\]|\$\{/.test(x)) throw new Error('템플릿 문자열에 넣을 수 없는 글자')
  return x
}
const inner = squeeze(`<defs>${lite.defs}</defs>${lite.body}`)
const sticker = squeeze(lite.sticker)
const ts = `// 복자(턱시도 고양이, 대표 반려묘 모델) 식빵 자세 — 생성 파일: design/bokja/tools/build.mjs
// 원본 그림: design/bokja/bokja-loaf.svg(시트용). 이 파일은 털 결을 줄인 화면용 판이다. 직접 고치지 말고 다시 만든다.
// - uid: 한 화면에 여러 장 그릴 때 그라데이션·필터 id가 겹치지 않게 하는 앞머리(영문·숫자·_·-만)
// - edge: 스티커 테두리 색(#rgb/#rrggbb). null이면 테두리 없음
// - aura: 어두운 바탕에서 검은 몸을 떼어 내는 청록 기운(밝은 바탕이면 false 권장)
const INNER = \`${tpl(inner)}\`
const STICKER = \`${tpl(sticker)}\`

const DEFAULT_EDGE = "#fffaf2"
/** 마크업에 끼우기 전 색상 검증: #rgb / #rrggbb 만 허용, 그 밖은 기본색 */
const safeEdge = (edge: string) => (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(edge) ? edge : DEFAULT_EDGE)
const safeUid = (uid: string) => (uid.replace(/[^a-zA-Z0-9_-]/g, "") || "bj")

export type BokjaOptions = { uid?: string; aura?: boolean }

/** SVG 안쪽 마크업(React에서 dangerouslySetInnerHTML — 고정 문자열 + 검증한 색·id만 끼움) */
export const bokjaInner = (edge: string | null = null, { uid = "bj", aura = true }: BokjaOptions = {}) => {
  const id = safeUid(uid)
  let body = INNER.split("__P__").join(id)
  if (!aura) body = body.replace(/<g class="bj-aura"[^>]*>.*?<\\/g>/, "")
  const edgeSvg = edge === null ? "" : STICKER.split("__EDGE__").join(safeEdge(edge))
  // 스티커 테두리는 그림자 바로 뒤, 몸보다 먼저 그린다
  return body.replace("</defs>", "</defs>" + edgeSvg)
}

/** 단독 SVG 문서 문자열(캔버스 Image·OG 이미지용). 비율 400:300 = 4:3(예전 120:90과 같다) */
export const bokjaSvgDocument = (edge: string | null = null, opts: BokjaOptions = {}) =>
  \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${lite.viewBox}" width="480" height="360">\${bokjaInner(edge, opts)}</svg>\`

export const BOKJA_VIEWBOX = "${lite.viewBox}"
export const BOKJA_RATIO = 400 / 300
`
fs.mkdirSync(path.join(DIR, 'handoff'), { recursive: true })
fs.writeFileSync(path.join(DIR, 'handoff', 'bokja-svg.ts'), ts)
console.log(`handoff/bokja-svg.ts  ${(Buffer.byteLength(ts) / 1024).toFixed(1)}KB`)
