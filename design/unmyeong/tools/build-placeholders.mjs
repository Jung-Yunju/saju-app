// 운명비서 임시 그림 만들기: node design/unmyeong/tools/build-placeholders.mjs
// 결과: public/unmyeong/placeholder/*-placeholder.svg (각 60KB 이하 — 넘으면 실패)
// 임시다. GPT 그래픽 담당 납품본(public/unmyeong/final/**)이 오면 src/lib/unmyeong/assets.ts 목록 한 줄만 바꾼다(DESIGN_SYSTEM 8-7).
// 색은 src/styles/unmyeong.css 토큰과 같은 계열만 쓴다. 금지: 보라·금박 광택·반짝이 입자·후광·마법진·꽃·장신구.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { C } from '../../bokja/tools/palette.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../../..')
const OUT = path.join(ROOT, 'public/unmyeong/placeholder')
const LIMIT = 60 * 1024
const G = JSON.parse(fs.readFileSync(path.join(HERE, 'glyphs.json'), 'utf8'))

const T = {
  bg: '#141310', study: '#211c17', wood: '#382b21', paper: '#c9b898', text: '#e2d8c5',
  brass: '#b9a17a', line: '#504335', seal: '#702f2b', ink: '#2a2119', lamp: '#c99652', flame: '#e9cf98',
}
const squeeze = (s) => s.replace(/\n\s*/g, '').replace(/>\s+</g, '><').trim()
const svg = (w, h, title, desc, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-labelledby="t d">` +
  `<title id="t">${title}</title><desc id="d">${desc} (임시 그림 — 최종본으로 교체 예정)</desc>` +
  `<!-- 생성 파일: design/unmyeong/tools/build-placeholders.mjs — 직접 고치지 말고 스크립트를 고친다 -->` +
  squeeze(body) + `</svg>\n`

/** 고정 씨앗 난수(다시 만들어도 같은 그림) */
function rng(seed) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

/** 글자 윤곽선 놓기: 기준선 (x,y), 크기 size. 세로쓰기는 vertical=true(글자마다 아래로) */
function glyphs(text, w, x, y, size, { vertical = false, gap = 0, fill = T.ink } = {}) {
  const k = size / 100
  let cx = x, cy = y, out = ''
  for (const ch of text) {
    const g = G[`${w}:${ch}`]
    if (!g) throw new Error(`glyphs.json에 없는 글자: ${w}:${ch} — make-glyphs.mjs TEXT에 넣고 다시 만든다`)
    out += `<path transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)}) scale(${k})" d="${g.d}"/>`
    if (vertical) cy += size + gap
    else cx += g.adv * k + gap
  }
  return `<g fill="${fill}">${out}</g>`
}
const width = (text, w, size, gap = 0) => [...text].reduce((a, ch) => a + G[`${w}:${ch}`].adv * size / 100 + gap, 0) - gap

/** 필름 입자(아주 옅게 — 아날로그 질감) */
const grainDef = (id, op = 0.07) =>
  `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/>` +
  `<feColorMatrix values="0 0 0 0 .9 0 0 0 0 .85 0 0 0 0 .75 0 0 0 ${op * 6} -${op * 3}"/></filter>`

const tempMark = (x, y, fill = T.text, op = 0.35) =>
  `<g opacity="${op}">${glyphs('임시', 700, x, y, 18, { fill, gap: 2 })}</g>`

// ───────── 할머니 실루엣(앉아서 오른쪽 등불 아래 책을 읽는 옆·뒷모습) — 좌표 0..260 × 0..270 ─────────
// 얼굴 디테일 없음. 쪽머리(뒤통수 아래 둥근 머리), 둥근 등, 저고리 소매 선만. 비녀·장신구 없음.
const GM = {
  head: 'M128 40C146 40 158 54 158 72C158 86 152 96 142 102C134 106 120 106 110 100C100 94 96 82 97 70C98 52 110 40 128 40Z',
  bun: 'M98 84C88 82 80 88 80 97C80 106 88 112 97 111C104 110 109 104 108 97C107 90 104 85 98 84Z',
  body:
    'M112 98C104 108 90 116 78 126C62 140 54 164 52 192C50 220 54 246 58 270L206 270' +
    'C204 252 196 236 184 224C192 218 204 210 214 202C222 196 222 186 214 182L180 160' +
    'C170 140 158 120 144 104Z',
  sleeve: 'M150 132C160 150 172 168 190 184',
  book: 'M200 180L236 166L250 180L214 196Z',
  bookFold: 'M213 172L229 189',
}
function grandma({ rim = true } = {}) {
  const shape = `<path d="${GM.head}"/><path d="${GM.bun}"/><path d="${GM.body}"/>`
  return (
    // 등불 쪽(오른쪽) 가장자리만 밝은 윤곽: 밝은 모양 위에 어두운 모양을 왼쪽으로 조금 밀어 덮는다
    (rim ? `<g fill="${T.lamp}" opacity=".55">${shape}</g>` : '') +
    `<g fill="#0c0a08" transform="translate(-2.4 .6)">${shape}</g>` +
    `<path d="${GM.sleeve}" stroke="#2a221b" stroke-width="1.4" fill="none" stroke-linecap="round" transform="translate(-2.4 .6)"/>` +
    `<path d="${GM.book}" fill="#b9a784"/><path d="${GM.book}" fill="#000" opacity=".12" transform="translate(0 0)"/>` +
    `<path d="${GM.bookFold}" stroke="#6f5f48" stroke-width="1.2"/>`
  )
}

// 등잔(작은 접시 + 받침 + 작은 불꽃). 후광 대신 좁은 범위의 따뜻한 빛만.
function lamp(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})">` +
    `<path d="M-6 0L6 0L4 -46L-4 -46Z" fill="#2b2119"/><ellipse cx="0" cy="1" rx="22" ry="5" fill="#2b2119"/>` +
    `<path d="M-16 -48Q0 -40 16 -48L13 -52L-13 -52Z" fill="#3a2d22"/>` +
    `<path d="M0 -76C4 -68 6 -61 5 -56C4 -52 2 -51 0 -51C-2 -51 -4 -52 -5 -56C-6 -61 -4 -68 0 -76Z" fill="${T.lamp}"/>` +
    `<path d="M0 -68C2 -63 3 -59 2 -56C1 -54 -1 -54 -2 -56C-3 -59 -2 -63 0 -68Z" fill="${T.flame}"/>` +
    `</g>`
}

// 책장 — 씨앗 고정 책등
function shelves(x0, y0, w, h, rows, seed) {
  const r = rng(seed)
  const spines = ['#2c231c', '#382b21', '#2f2620', '#3d2a23', '#33291f', '#40342a', '#2a2420', '#4a2a25']
  let s = `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#1a1612"/>`
  const rowH = h / rows
  for (let i = 0; i < rows; i++) {
    const base = y0 + (i + 1) * rowH - 8
    let x = x0 + 8
    while (x < x0 + w - 14) {
      const bw = 9 + r() * 13
      const bh = rowH * (0.55 + r() * 0.33)
      const lean = r() < 0.08 ? (r() - 0.5) * 14 : 0
      const c = spines[Math.floor(r() * spines.length)]
      s += `<rect x="${x.toFixed(1)}" y="${(base - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${c}"${lean ? ` transform="rotate(${lean.toFixed(1)} ${x.toFixed(1)} ${base})"` : ''}/>`
      if (r() < 0.35) s += `<rect x="${(x + 1.5).toFixed(1)}" y="${(base - bh + 8).toFixed(1)}" width="${(bw - 3).toFixed(1)}" height="1.2" fill="${T.brass}" opacity=".18"/>`
      x += bw + (r() < 0.12 ? 10 : 1)
    }
    s += `<rect x="${x0}" y="${base}" width="${w}" height="8" fill="#2a2018"/><rect x="${x0}" y="${base}" width="${w}" height="1.5" fill="#4a3a2c" opacity=".6"/>`
  }
  s += `<rect x="${x0 - 6}" y="${y0 - 6}" width="${w + 12}" height="${h + 12}" fill="none" stroke="#2a2018" stroke-width="12"/>`
  return s
}

// ═════════ 1) 서재 장면 = 인트로 영상 포스터 대용(9:16) ═════════
function study() {
  const W = 540, H = 960, lx = 402, ly = 632
  return svg(W, H, '운명비서 서재 — 등잔 아래 책 읽는 할머니', '깊은 밤의 서재. 왼쪽 벽 책장, 오른쪽 책상 위 작은 등잔 하나, 그 불빛 아래 할머니가 등을 보이고 앉아 책을 읽는다. 등불이 닿는 가장자리만 희미하게 밝다.', `
<defs>
<radialGradient id="glow" cx="${lx}" cy="${ly - 60}" r="300" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${T.lamp}" stop-opacity=".30"/><stop offset=".35" stop-color="${T.lamp}" stop-opacity=".10"/><stop offset="1" stop-color="${T.lamp}" stop-opacity="0"/></radialGradient>
<radialGradient id="pool" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${T.lamp}" stop-opacity=".35"/><stop offset="1" stop-color="${T.lamp}" stop-opacity="0"/></radialGradient>
<linearGradient id="vig" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset=".35" stop-color="#000" stop-opacity="0"/><stop offset=".75" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></linearGradient>
<filter id="soft"><feGaussianBlur stdDeviation="14"/></filter>
${grainDef('grain')}
</defs>
<rect width="${W}" height="${H}" fill="${T.bg}"/>
<rect width="${W}" height="660" fill="${T.study}"/>
${shelves(18, 110, 250, 520, 5, 7)}
<rect x="300" y="150" width="200" height="300" fill="#1c1814"/>
<rect x="312" y="162" width="176" height="276" fill="none" stroke="#2c241d" stroke-width="2"/>
<g transform="translate(118 392) scale(1.75)" opacity=".38" filter="url(#soft)"><path d="${GM.head}" fill="#000"/><path d="${GM.body}" fill="#000"/></g>
<rect width="${W}" height="${H}" fill="url(#glow)"/>
<path d="M0 652L${W} 640L${W} 700L0 716Z" fill="#2e241b"/>
<path d="M0 716L${W} 700L${W} ${H}L0 ${H}Z" fill="#1a1511"/>
<path d="M0 716L${W} 700" stroke="#4a3a2c" stroke-width="1.5" opacity=".7"/>
<ellipse cx="${lx - 40}" cy="670" rx="170" ry="26" fill="url(#pool)"/>
${lamp(lx + 50, ly + 10, 1.1)}
<g transform="translate(150 393)">${grandma()}</g>
<rect width="${W}" height="${H}" fill="url(#vig)"/>
<rect width="${W}" height="${H}" filter="url(#grain)"/>
${tempMark(W - 58, H - 24)}
`)
}

// ═════════ 2) 할머니만(3:4, 로딩·안내 화면용) ═════════
function grandmaOnly() {
  const W = 360, H = 480
  return svg(W, H, '할머니 — 등잔 아래 책 읽는 옆·뒷모습', '어두운 바탕에 등을 보이고 앉은 할머니가 오른쪽 등잔 불빛에 책을 비춰 읽는다. 얼굴은 보이지 않는다.', `
<defs>
<radialGradient id="g" cx="300" cy="230" r="260" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${T.lamp}" stop-opacity=".26"/><stop offset=".4" stop-color="${T.lamp}" stop-opacity=".07"/><stop offset="1" stop-color="${T.lamp}" stop-opacity="0"/></radialGradient>
${grainDef('grain')}
</defs>
<rect width="${W}" height="${H}" fill="${T.study}"/>
<rect width="${W}" height="${H}" fill="url(#g)"/>
<path d="M0 400L${W} 392L${W} ${H}L0 ${H}Z" fill="#2a2119"/>
<path d="M0 400L${W} 392" stroke="#4a3a2c" stroke-width="1.5" opacity=".7"/>
${lamp(318, 398, 1.05)}
<g transform="translate(40 132)">${grandma()}</g>
<rect width="${W}" height="${H}" filter="url(#grain)"/>
${tempMark(W - 56, H - 20)}
`)
}

// ═════════ 3) 운명비서 고서 표지(2:3) ═════════
// 오침(다섯 구멍) 실 매기 선장본, 오른쪽 묶음. 왼쪽 위에 세로 제첨(제목 종이) — 運命秘書, 그 아래 붉은 봉인.
function cover() {
  const W = 600, H = 900, bx = 40, by = 40, bw = 520, bh = 820
  const holes = [0.1, 0.3, 0.5, 0.7, 0.9].map((t) => by + bh * t)
  const sx = 96, sy = 96, sw = 118, sh = 470 // 제첨
  const han = 86
  return svg(W, H, '운명비서(運命秘書) 고서 표지', '짙은 갈색으로 물들인 낡은 고서 표지. 오른쪽에 다섯 구멍 실 매기, 왼쪽 위 세로 제목 종이에 運命秘書, 그 아래 작은 한글 운명비서, 붉은 사각 봉인.', `
<defs>
<filter id="cv" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".015 .5" numOctaves="3" seed="21"/><feColorMatrix values="0 0 0 0 .1 0 0 0 0 .07 0 0 0 0 .05 0 0 0 1.2 -.45"/></filter>
<filter id="sp" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".02" numOctaves="3" seed="8"/><feColorMatrix values="0 0 0 0 .55 0 0 0 0 .44 0 0 0 0 .3 0 0 0 1.4 -.8"/></filter>
<filter id="pp" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".03 .9" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 .35 0 0 0 0 .27 0 0 0 0 .17 0 0 0 1.3 -.6"/></filter>
<filter id="wear"><feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="2" seed="5"/><feDisplacementMap in="SourceGraphic" scale="5"/></filter>
<filter id="ink"><feTurbulence type="fractalNoise" baseFrequency=".6" numOctaves="2" seed="13" result="n"/><feColorMatrix in="n" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2 0 0 0 1.9" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>
<clipPath id="bk"><rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="6"/></clipPath>
</defs>
<rect width="${W}" height="${H}" fill="${T.bg}"/>
<rect x="${bx + 6}" y="${by + 10}" width="${bw}" height="${bh}" rx="6" fill="#000" opacity=".5"/>
<g clip-path="url(#bk)" filter="url(#wear)">
<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="#3a2a1f"/>
<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" filter="url(#cv)" opacity=".8"/>
<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" filter="url(#sp)" opacity=".35"/>
</g>
<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="6" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="10"/>
<path d="M${bx + bw - 64} ${by}V${by + bh}" stroke="#000" stroke-opacity=".25" stroke-width="2"/>
<g stroke="#8a7a5e" stroke-width="3.2" fill="none" stroke-linecap="round">
${holes.map((y) => `<path d="M${bx + bw - 40} ${y}H${bx + bw}"/>`).join('')}
<path d="M${bx + bw - 40} ${holes[0]}V${holes[4]}"/>
<path d="M${bx + bw - 40} ${by}V${holes[0]}M${bx + bw - 40} ${holes[4]}V${by + bh}"/>
</g>
${holes.map((y) => `<circle cx="${bx + bw - 40}" cy="${y}" r="3.2" fill="#120e0b"/>`).join('')}
<g transform="rotate(-.8 ${sx} ${sy})">
<rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" fill="${T.paper}"/>
<rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" filter="url(#pp)" opacity=".6"/>
<rect x="${sx + 7}" y="${sy + 7}" width="${sw - 14}" height="${sh - 14}" fill="none" stroke="${T.ink}" stroke-opacity=".5" stroke-width="1.2"/>
${glyphs('運命秘書', 800, sx + (sw - han) / 2 - 2, sy + 30 + han * 0.86, han, { vertical: true, gap: 6 })}
</g>
<g transform="translate(${sx + sw / 2} ${sy + sh + 52})">
${glyphs('운명비서', 700, -width('운명비서', 700, 24, 6) / 2, 0, 24, { fill: T.brass, gap: 6 })}
</g>
<g transform="translate(${sx + sw / 2 - 38} ${sy + sh + 84}) rotate(-4 38 38)" filter="url(#ink)">
<rect width="76" height="76" rx="4" fill="${T.seal}"/>
<rect x="5" y="5" width="66" height="66" rx="2" fill="none" stroke="#c9b898" stroke-opacity=".55" stroke-width="1.6"/>
${glyphs('秘', 800, 13, 63, 50, { fill: '#c9b898' })}
</g>
${tempMark(W - 70, H - 14)}
`)
}

// ═════════ 4) 영물 자리: 물 위 신성한 모습 + 물속 반영은 영물(3:4) ═════════
// 사람(형상)은 물 위에 서 있고, 물에 비친 그림자는 다른 짐승(여기서는 사슴 — 임시)이다. 후광 없음. 빛은 위에서 내려오는 희미한 안개 한 줄.
const DEER = [
  'M40 120C38 104 60 96 100 96C130 96 152 100 158 112C164 124 160 140 146 146L56 148C44 146 40 134 40 120Z',
  'M140 108C146 92 152 78 158 68L166 62C172 60 182 62 188 68L184 74C178 74 174 76 170 80C166 92 160 106 154 118Z',
  'M162 65L154 55L167 61Z',
  'M56 140L52 200L58 200L66 142Z', 'M76 142L76 200L82 200L86 144Z', 'M134 140L138 200L144 200L146 138Z', 'M148 136L156 200L162 200L158 132Z',
  'M42 114L33 109L39 123Z',
]
const ANTLER = 'M163 63C157 51 153 41 147 32M155 48L144 43M151 40L156 30M168 61C170 49 176 39 184 31M172 47L184 44M178 38L176 28'
const FIGURE = {
  head: 'M300 236C309 236 315 243 315 252C315 261 309 268 300 268C291 268 285 261 285 252C285 243 291 236 300 236Z',
  body: 'M288 272C276 276 268 284 266 296L258 360C252 400 248 440 244 470L356 470C352 440 348 400 342 360L334 296C332 284 324 276 312 272Z',
  sleeves: 'M268 300C258 330 254 360 256 392L270 396C270 366 274 336 280 312ZM332 300C342 330 346 360 344 392L330 396C330 366 326 336 320 312Z',
}
function archetype() {
  const W = 600, H = 800, wl = 470
  const r = rng(31)
  let ripples = ''
  for (let i = 0; i < 26; i++) {
    const y = wl + 8 + i * 12 + r() * 6
    const x = 60 + r() * 420
    const w = 30 + r() * 140
    ripples += `<path d="M${x.toFixed(0)} ${y.toFixed(0)}h${w.toFixed(0)}" stroke="${T.text}" stroke-opacity="${(0.05 + r() * 0.08).toFixed(2)}" stroke-width="1.2"/>`
  }
  return svg(W, H, '신성과 영물 — 물 위의 형상과 물속에 비친 영물', '고요한 밤 물 위에 긴 옷을 입은 사람의 형상이 서 있고, 물에 비친 그림자는 사람이 아니라 사슴 모양의 영물이다. 위에서 희미한 빛이 내려온다.', `
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e0d0b"/><stop offset="1" stop-color="${T.study}"/></linearGradient>
<linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d1915"/><stop offset="1" stop-color="#0c0b09"/></linearGradient>
<linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.paper}" stop-opacity=".14"/><stop offset="1" stop-color="${T.paper}" stop-opacity="0"/></linearGradient>
<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity=".18"/></linearGradient>
<mask id="fm"><rect x="0" y="${wl}" width="${W}" height="${H - wl}" fill="url(#fade)"/></mask>
<filter id="wave" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".004 .09" numOctaves="2" seed="6"/><feDisplacementMap in="SourceGraphic" scale="6" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation=".8"/></filter>
<filter id="mist"><feGaussianBlur stdDeviation="18"/></filter>
${grainDef('grain', 0.06)}
</defs>
<rect width="${W}" height="${wl}" fill="url(#sky)"/>
<rect y="${wl}" width="${W}" height="${H - wl}" fill="url(#water)"/>
<path d="M250 0L350 0L372 ${wl}L228 ${wl}Z" fill="url(#beam)" filter="url(#mist)"/>
<ellipse cx="300" cy="${wl - 6}" rx="250" ry="16" fill="${T.paper}" opacity=".06" filter="url(#mist)"/>
<g fill="#0a0907"><path d="${FIGURE.head}"/><path d="${FIGURE.body}"/><path d="${FIGURE.sleeves}"/></g>
<g fill="none" stroke="${T.paper}" stroke-opacity=".28" stroke-width="1.2"><path d="${FIGURE.head}"/><path d="M312 272C324 276 332 284 334 296L342 360C348 400 352 440 356 470"/></g>
<g mask="url(#fm)"><g filter="url(#wave)" transform="translate(300 ${wl}) scale(1.35 -1.35) translate(-104 -200)" opacity=".85">
<g fill="${T.brass}" fill-opacity=".42">${DEER.map((d) => `<path d="${d}"/>`).join('')}</g>
<path d="${ANTLER}" stroke="${T.brass}" stroke-opacity=".42" stroke-width="2.6" fill="none" stroke-linecap="round"/>
</g></g>
${ripples}
<path d="M0 ${wl}H${W}" stroke="${T.paper}" stroke-opacity=".22" stroke-width="1"/>
<rect width="${W}" height="${H}" filter="url(#grain)"/>
${tempMark(W - 58, H - 20)}
`)
}

// ═════════ 5) 종이 질감 타일(512, 반복용) — CSS .um-paper 와 같은 3겹 ═════════
function paper() {
  const S = 512
  return svg(S, S, '고서 종이 질감', '고서 종이 색 바탕에 섬유 결과 얼룩 입자. 반복해서 까는 타일.', `
<defs>
<filter id="b" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".006" numOctaves="2" seed="29" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .42 0 0 0 0 .32 0 0 0 0 .19 0 0 0 1.1 -.52"/></filter>
<filter id="f" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".018 .9" numOctaves="2" seed="11" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .33 0 0 0 0 .25 0 0 0 0 .16 0 0 0 1.3 -.62"/></filter>
<filter id="s" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" seed="5" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .3 0 0 0 0 .22 0 0 0 0 .13 0 0 0 1.6 -.78"/></filter>
</defs>
<rect width="${S}" height="${S}" fill="${T.paper}"/>
<rect width="${S}" height="${S}" filter="url(#b)" opacity=".5"/>
<rect width="${S}" height="${S}" filter="url(#f)" opacity=".28"/>
<rect width="${S}" height="${S}" filter="url(#s)" opacity=".6"/>
`)
}

// ═════════ 6·7) 복자 — 원본 좌표 그대로, 서재 등불 조명으로 색만 바꾼다 ═════════
// 바꾸는 것: 달빛(청록) 테두리 → 등불빛, 청록 기운 끔, 모든 색을 '등불 아래'로(빨강 .74·초록 .64·파랑 .50배 — 흰 털은 그늘진 상아색이 된다).
// 유지: 모양·무늬 전부(코 왼쪽 검은 점, 비대칭 주둥이, 흰 양말, 노란 눈).
const lampGrade = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  const k = [0.74, 0.64, 0.5]
  return '#' + ch.map((v, i) => Math.round(v * k[i]).toString(16).padStart(2, '0')).join('')
}
async function bokja(pose) {
  const saved = { moon: C.moon, kSheen: C.kSheen, w3: C.w3 }
  C.moon = '#e0b070' // 달빛 대신 등불빛(등급 후 #a67038 근처)
  C.kSheen = '#6a5a48' // 검은 털 결의 푸른 반사 → 따뜻한 반사
  C.w3 = '#a89c8a' // 흰 털 그늘의 푸른 회색 → 따뜻한 회색
  try {
    const mod = await import(`../../bokja/tools/pose-${pose}.mjs`)
    const fn = pose === 'sleep' ? mod.sleep : mod.loaf
    const r = fn({ p: pose === 'sleep' ? 'us' : 'ul', detail: pose === 'sleep' ? 0.8 : 0.7, aura: false })
    const grade = (s) => s.replace(/#[0-9a-fA-F]{6}\b/g, lampGrade)
    const [w, h] = [r.w, r.h]
    const title = pose === 'sleep' ? '복자 — 서재 등불 아래 웅크려 자기' : '복자 — 서재 등불 아래 식빵 자세'
    const desc = pose === 'sleep'
      ? '턱시도 고양이 복자가 바구니에서 웅크려 잔다. 등불 아래라 흰 털이 그늘진 상아색으로 보인다. 흰 주둥이 왼쪽 코 옆 검은 점.'
      : '턱시도 고양이 복자가 식빵 자세로 엎드려 노란 눈으로 정면을 본다. 등불 아래 색. 흰 주둥이 왼쪽 코 옆 검은 점, 흰 턱받이, 흰 양말.'
    return svg(w, h, title, desc, `<defs>${grade(r.defs)}</defs>${grade(r.body)}`)
  } finally {
    Object.assign(C, saved)
  }
}

fs.mkdirSync(OUT, { recursive: true })
const files = {
  'study-placeholder.svg': study(),
  'grandma-placeholder.svg': grandmaOnly(),
  'book-cover-placeholder.svg': cover(),
  'reflection-placeholder.svg': archetype(),
  'paper-placeholder.svg': paper(),
  'bokja-sleep-placeholder.svg': await bokja('sleep'),
  'bokja-loaf-placeholder.svg': await bokja('loaf'),
}
let bad = 0
for (const [name, s] of Object.entries(files)) {
  fs.writeFileSync(path.join(OUT, name), s)
  const kb = Buffer.byteLength(s) / 1024
  if (kb * 1024 > LIMIT) bad++
  console.log(`${name.padEnd(32)} ${kb.toFixed(1)}KB${kb * 1024 > LIMIT ? '  ← 60KB 초과!' : ''}`)
}
if (bad) process.exitCode = 1
