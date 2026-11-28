// 운명비서 고서 부품(D-033) 그림 만들기 — 디자인 실장
// 만드는 것
//   1) public/unmyeong/book/leather-grain.svg   가죽 결(오돌토돌한 낟알 + 얕은 주름 + 얼룩) 타일 — 색 없음(어두운·밝은 알파만), 표지 바탕색 위에 얹는다
//   2) public/unmyeong/book/paper-fiber.svg     고급 종이 섬유(가로로 긴 섬유 + 잔 티끌) 타일 — 알파만
//   3) public/unmyeong/book/brush-line.svg      붓 밑줄(양 끝이 가늘어지는 한 획) — CSS mask 로 쓴다(색은 CSS가 칠함)
//   4) src/components/ui/unmyeong/book/seal-art.ts  밀랍 인장 모양(흘러내린 가장자리)·갈라짐 선·두 쪽 자르기 선·運 글자 윤곽
// 모두 직접 그린 벡터(외부 이미지·글꼴 파일 없음). 運 윤곽은 glyphs.json(Noto Serif KR 800, SIL OFL 1.1)에서 가져온다.
// 다시 만들기: node design/unmyeong/tools/make-book-art.mjs  (값을 바꾸면 견본 페이지를 다시 찍어 본다 — DESIGN_SYSTEM 9절)
import fs from "node:fs"
import path from "node:path"

const root = path.resolve(new URL("../../..", import.meta.url).pathname)
const pub = path.join(root, "public/unmyeong/book")
fs.mkdirSync(pub, { recursive: true })

// ── 1) 가죽 결 ─────────────────────────────────────────
// 잔 낟알(조명으로 비춘 요철 — 아주 옅게) + 넓은 얼룩(손때) + 가늘고 긴 주름 몇 줄. 색은 알파만 → 표지 바탕색 위에 얹는다.
const leather = `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260" viewBox="0 0 260 260">
<filter id="g" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7" stitchTiles="stitch" result="n"/>
<feDiffuseLighting in="n" surfaceScale="1.4" diffuseConstant="1" lighting-color="#fff" result="l"><feDistantLight azimuth="225" elevation="52"/></feDiffuseLighting>
<feColorMatrix in="l" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1.2 0 0 0 .9"/>
</filter>
<filter id="h" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7" stitchTiles="stitch" result="n"/>
<feDiffuseLighting in="n" surfaceScale="1.4" diffuseConstant="1" lighting-color="#fff" result="l"><feDistantLight azimuth="225" elevation="52"/></feDiffuseLighting>
<feColorMatrix in="l" values="0 0 0 0 .92  0 0 0 0 .72  0 0 0 0 .55  1.3 0 0 0 -.98"/>
</filter>
<filter id="c" x="0" y="0" width="100%" height="100%">
<feTurbulence type="turbulence" baseFrequency=".018 .024" numOctaves="2" seed="21" stitchTiles="stitch"/>
<feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -16 1.1"/>
</filter>
<filter id="m" x="0" y="0" width="100%" height="100%">
<feTurbulence type="fractalNoise" baseFrequency=".022" numOctaves="3" seed="4" stitchTiles="stitch"/>
<feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.8 -.72"/>
</filter>
<filter id="w" x="0" y="0" width="100%" height="100%">
<feTurbulence type="fractalNoise" baseFrequency=".014" numOctaves="3" seed="12" stitchTiles="stitch"/>
<feColorMatrix values="0 0 0 0 .7  0 0 0 0 .48  0 0 0 0 .36  0 0 0 2 -1.12"/>
</filter>
<rect width="260" height="260" filter="url(#m)" opacity=".42"/>
<rect width="260" height="260" filter="url(#w)" opacity=".12"/>
<rect width="260" height="260" filter="url(#g)" opacity=".7"/>
<rect width="260" height="260" filter="url(#h)" opacity=".22"/>
<rect width="260" height="260" filter="url(#c)" opacity=".3"/>
</svg>
`
fs.writeFileSync(path.join(pub, "leather-grain.svg"), leather)

// ── 2) 종이 섬유 ───────────────────────────────────────
// 고급 한지·면지 느낌: 구름 같은 두께 얼룩(뜬 종이의 지합) + 드문드문 짧은 섬유(가로·세로 섞임) + 아주 잔 티끌. 줄무늬 없음.
const fiber = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" viewBox="0 0 360 360">
<filter id="cl" x="0" y="0" width="100%" height="100%">
<feTurbulence type="fractalNoise" baseFrequency=".022" numOctaves="4" seed="9" stitchTiles="stitch"/>
<feColorMatrix values="0 0 0 0 .42  0 0 0 0 .32  0 0 0 0 .18  0 0 0 1.6 -.7"/>
</filter>
<filter id="fa" x="0" y="0" width="100%" height="100%">
<feTurbulence type="turbulence" baseFrequency=".045 .16" numOctaves="2" seed="13" stitchTiles="stitch"/>
<feColorMatrix values="0 0 0 0 .38  0 0 0 0 .28  0 0 0 0 .16  0 0 0 -16 1.0"/>
</filter>
<filter id="fb" x="0" y="0" width="100%" height="100%">
<feTurbulence type="turbulence" baseFrequency=".16 .05" numOctaves="2" seed="27" stitchTiles="stitch"/>
<feColorMatrix values="0 0 0 0 .38  0 0 0 0 .28  0 0 0 0 .16  0 0 0 -16 0.98"/>
</filter>
<filter id="lt" x="0" y="0" width="100%" height="100%">
<feTurbulence type="turbulence" baseFrequency=".06 .11" numOctaves="2" seed="51" stitchTiles="stitch"/>
<feColorMatrix values="0 0 0 0 1  0 0 0 0 .97  0 0 0 0 .9  0 0 0 -16 0.96"/>
</filter>
<filter id="d" x="0" y="0" width="100%" height="100%">
<feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3" stitchTiles="stitch"/>
<feColorMatrix values="0 0 0 0 .3  0 0 0 0 .22  0 0 0 0 .12  0 0 0 2.2 -1.38"/>
</filter>
<rect width="360" height="360" filter="url(#cl)" opacity=".36"/>
<rect width="360" height="360" filter="url(#fa)" opacity=".3"/>
<rect width="360" height="360" filter="url(#fb)" opacity=".24"/>
<rect width="360" height="360" filter="url(#lt)" opacity=".5"/>
<rect width="360" height="360" filter="url(#d)" opacity=".45"/>
</svg>
`
fs.writeFileSync(path.join(pub, "paper-fiber.svg"), fiber)

// ── 3) 붓 밑줄 ─────────────────────────────────────────
// 400×10 상자 안의 한 획: 왼쪽에서 붓을 눌러 시작(조금 두껍게) → 가운데 고르게 → 오른쪽으로 빠지며 가늘어짐. 위·아래 가장자리를 살짝 들쭉날쭉하게.
function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) }
{
  const r = rnd(5)
  const N = 60
  const top = [], bot = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const x = 2 + t * 396
    // 두께: 시작 0.9 → 3.2(눌림) → 2.4 → 끝 0.3
    const w = t < 0.06 ? 0.9 + (t / 0.06) * 2.3 : t < 0.8 ? 3.2 - ((t - 0.06) / 0.74) * 0.8 : 2.4 * (1 - (t - 0.8) / 0.2) + 0.3
    const mid = 5.2 + Math.sin(t * 5.3) * 0.5 - t * 0.6
    top.push([x, mid - w / 2 - r() * 0.35])
    bot.push([x, mid + w / 2 + r() * 0.35])
  }
  const pts = [...top, ...bot.reverse()]
  const d = "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(2)}`).join("L") + "Z"
  fs.writeFileSync(path.join(pub, "brush-line.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="10" viewBox="0 0 400 10" preserveAspectRatio="none"><path d="${d}" fill="#000"/></svg>\n`)
}

// ── 4) 밀랍 인장 ───────────────────────────────────────
// 판 120×120, 가운데 (60,60). 밀랍 반지름 약 47에 낮은 주파수 흔들림 + 흘러내린 혹 몇 개(오른쪽 아래가 더 흘렀다 — 녹은 밀랍을 위에서 부었을 때).
const art = {}
{
  const r = rnd(11)
  const N = 96
  const bumps = [
    { a: 20, w: 9, h: 3.2 }, { a: 62, w: 6, h: 5.5 }, { a: 74, w: 5, h: 3 }, { a: 118, w: 10, h: 2.6 },
    { a: 166, w: 7, h: 4 }, { a: 214, w: 12, h: 2.2 }, { a: 262, w: 6, h: 3.4 }, { a: 312, w: 9, h: 2.8 }, { a: 340, w: 5, h: 4.2 },
  ]
  const pts = []
  for (let i = 0; i < N; i++) {
    const deg = (i / N) * 360
    const th = (deg * Math.PI) / 180
    let rad = 46 + Math.sin(th * 3 + 0.7) * 0.9 + Math.sin(th * 5 + 2.1) * 0.6 + (r() - 0.5) * 0.7
    for (const b of bumps) {
      let dd = Math.abs(deg - b.a); if (dd > 180) dd = 360 - dd
      rad += b.h * Math.exp(-(dd * dd) / (2 * b.w * b.w))
    }
    pts.push([60 + Math.cos(th) * rad, 60 + Math.sin(th) * rad])
  }
  art.blob = catmull(pts)
  // 안쪽 눌린 원판(도장 면) — 거의 원, 살짝만 흔들림
  const disc = []
  for (let i = 0; i < 48; i++) {
    const th = (i / 48) * Math.PI * 2
    const rad = 33 + Math.sin(th * 4 + 1) * 0.35 + (r() - 0.5) * 0.3
    disc.push([60 + Math.cos(th) * rad, 60 + Math.sin(th) * rad])
  }
  art.disc = catmull(disc)
  // 갈라짐 선: 위에서 아래로, 가운데에서 조금씩 꺾이며
  const crack = [[63, -4], [61.5, 10], [64.5, 22], [59, 34], [62.5, 46], [57.5, 58], [61, 70], [56.5, 82], [60, 95], [57, 108], [58.5, 124]]
  art.crack = "M" + crack.map(([x, y]) => `${x} ${y}`).join("L")
  art.clipLeft = "M-20 -20L" + crack.map(([x, y]) => `${x} ${y}`).join("L") + "L-20 140Z"
  art.clipRight = "M140 -20L" + crack.map(([x, y]) => `${x} ${y}`).join("L") + "L140 140Z"
  // 작은 가지 금(갈라질 때만 보임)
  art.crackBranch = "M59 34L52 39L47 38M57.5 58L66 63L71 62"
  // 運 — glyphs.json(글자 크기 100, 기준선 y=0)의 bbox x 2.9~98, y -84.9~9 → 가운데 맞춰 34 크기로
  const g = JSON.parse(fs.readFileSync(path.join(root, "design/unmyeong/tools/glyphs.json"), "utf8"))["800:運"]
  const s = 34 / 95
  art.glyph = g.d
  art.glyphTransform = `translate(${(60 - 50.45 * s).toFixed(2)} ${(60 + 37.95 * s).toFixed(2)}) scale(${s.toFixed(4)})`
}

function catmull(p) {
  const n = p.length
  const f = (v) => v.toFixed(2)
  let d = `M${f(p[0][0])} ${f(p[0][1])}`
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`
  }
  return d + "Z"
}

const ts = `// 자동 생성 — design/unmyeong/tools/make-book-art.mjs 가 만든다. 손으로 고치지 말고 스크립트를 고쳐 다시 돌린다.
// 밀랍 인장(UmWaxSeal) 모양: 판 120×120, 가운데 (60,60). 運 윤곽은 Noto Serif KR 800(SIL OFL 1.1).
export const SEAL_ART = ${JSON.stringify(art, null, 2)} as const
`
fs.writeFileSync(path.join(root, "src/components/ui/unmyeong/book/seal-art.ts"), ts)
console.log("ok", fs.readdirSync(pub).map((f) => `${f} ${fs.statSync(path.join(pub, f)).size}B`).join(", "))
