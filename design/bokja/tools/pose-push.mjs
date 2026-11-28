// 포즈 ③ 머리로 문을 미는 옆모습(오른쪽을 향함) — 사진에는 없는 동작이라 두 사진의 몸 비율·무늬를 옆모습으로 옮겼다.
// 좌표계 300×220, 바닥선 y=206. 움직임용으로 부위마다 <g id>를 따로 둔다:
//   {p}-tail(꼬리, 축 48,102) {p}-hf(먼 뒷다리, 축 92,120) {p}-ff(먼 앞다리, 축 186,130)
//   {p}-torso(몸통·가슴) {p}-hn(가까운 뒷다리, 축 78,112) {p}-fn(가까운 앞다리, 축 200,124) {p}-head(머리, 축 220,118)
// 보이는 쪽은 고양이의 왼쪽 → 흰 수염판 + 입술 옆 작은 검은 점. 코의 큰 검은 점은 반대쪽이라 코끝에만 비친다.
import { C } from './palette.mjs'
import { smooth, furInside, furEdge, deg, tf, furPath as F, rimIn, clipDef } from './lib.mjs'

// 머리는 목(218,116)을 축으로 20도 숙여 이마로 민다
const HR = (pts) => tf(pts, { rot: 20, ox: 218, oy: 116, dx: 4, dy: 2 })
export const HEAD_AT = (x, y) => HR([[x, y]])[0].map((v) => Math.round(v * 10) / 10)
export const S = {
  tail: [[50, 106], [36, 92], [24, 72], [18, 50], [21, 31], [30, 22], [39, 26], [37, 42], [37, 62], [46, 80], [62, 96]],
  hf: [[82, 116], [112, 116], [122, 146], [110, 172], [101, 192], [104, 206], [80, 206], [83, 190], [88, 168], [78, 140]],
  hfSock: [[84, 186], [93, 181], [103, 187], [102, 196], [108, 206], [80, 206], [82, 195]],
  ff: [[174, 128], [194, 126], [197, 158], [197, 188], [200, 206], [178, 206], [179, 188], [177, 158]],
  ffSock: [[178, 180], [187, 175], [197, 180], [198, 194], [203, 206], [178, 206], [179, 192]],
  body: [[44, 104], [64, 80], [100, 68], [140, 65], [178, 70], [204, 86], [217, 108], [215, 134], [201, 154], [170, 167], [130, 172], [94, 166], [64, 153], [46, 130]],
  chest: [[203, 93], [216, 110], [217, 134], [211, 152], [201, 162], [194, 154], [197, 128], [197, 108]],
  neck: [[192, 80], [222, 90], [238, 116], [236, 142], [214, 152], [200, 124]],
  throat: [[206, 110], [224, 130], [246, 148], [262, 154], [250, 162], [226, 160], [210, 152], [203, 130]],
  hn: [[52, 98], [94, 96], [114, 124], [110, 148], [92, 162], [76, 176], [69, 190], [76, 200], [80, 206], [44, 207], [41, 196], [47, 176], [44, 150], [42, 122]],
  hnSock: [[44, 186], [55, 179], [67, 184], [70, 195], [83, 206], [44, 207], [41, 196]],
  fn: [[189, 122], [210, 118], [218, 148], [221, 184], [226, 199], [230, 206], [203, 207], [203, 194], [199, 160], [187, 140]],
  fnSock: [[200, 175], [210, 168], [220, 174], [223, 192], [233, 206], [203, 207], [203, 195]],
  head: HR([[220, 101], [235, 88], [253, 85], [268, 91], [277, 103], [281, 116], [284, 127], [278, 138], [265, 145], [248, 147], [232, 143], [219, 133], [212, 118]]),
  earN: HR([[233, 93], [229, 68], [233, 57, 's'], [251, 78], [256, 88]]),
  earF: HR([[249, 89], [256, 66], [262, 58, 's'], [269, 87]]),
  earIn: HR([[237, 86], [235, 68], [248, 81]]),
  muzzle: HR([[263, 110], [273, 106], [280, 116], [284, 127], [279, 138], [266, 145], [251, 143], [255, 131], [259, 120]]),
  blaze: HR([[264, 95], [269, 97], [274, 107], [268, 110], [263, 104]]),
  eye: HR([[249, 110], [255, 106.5], [262, 106], [266.5, 109], [262, 113], [255, 113.5]]),
  eye0: [[249, 110], [255, 106.5], [262, 106], [266.5, 109], [262, 113], [255, 113.5]],
}
const P = (k) => smooth(S[k])

export function push({ p = 'bp', detail = 1, rim = true, aura = true, ground = true } = {}) {
  const N = (v) => Math.max(4, Math.round(v * detail))
  const g = (v) => (1.25 * v) / Math.pow(detail, 0.8)
  const RIMS = ['body', 'tail', 'head', 'fn', 'earN']
  const defs = `
<radialGradient id="${p}-sheen" cx=".35" cy=".05" r=".8"><stop offset="0" stop-color="${C.kSheen}" stop-opacity=".85"/><stop offset=".45" stop-color="${C.k3}" stop-opacity=".35"/><stop offset="1" stop-color="${C.k1}" stop-opacity="0"/></radialGradient>
<linearGradient id="${p}-under" x1="0" y1="0" x2="0" y2="1"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></linearGradient>
<radialGradient id="${p}-white" cx=".5" cy=".25" r=".85"><stop offset="0" stop-color="${C.w0}"/><stop offset=".55" stop-color="${C.w1}"/><stop offset="1" stop-color="${C.w2}"/></radialGradient>
<linearGradient id="${p}-sock" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.w2}"/><stop offset=".4" stop-color="${C.w1}"/><stop offset="1" stop-color="${C.w0}"/></linearGradient>
<linearGradient id="${p}-far" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.w3}"/><stop offset=".5" stop-color="${C.w2}"/><stop offset="1" stop-color="${C.w1}"/></linearGradient>
<radialGradient id="${p}-iris" cx=".55" cy=".6" r=".65"><stop offset="0" stop-color="${C.iris0}"/><stop offset=".55" stop-color="${C.iris1}"/><stop offset="1" stop-color="${C.iris2}"/></radialGradient>
<radialGradient id="${p}-glint" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${C.iris0}" stop-opacity=".35"/><stop offset="1" stop-color="${C.iris0}" stop-opacity="0"/></radialGradient>
<linearGradient id="${p}-ear" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${C.ear0}"/><stop offset="1" stop-color="${C.ear1}"/></linearGradient>
<linearGradient id="${p}-moon" x1="0" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="${C.moon}" stop-opacity=".95"/><stop offset=".2" stop-color="${C.moon}" stop-opacity=".4"/><stop offset=".45" stop-color="${C.moon}" stop-opacity="0"/></linearGradient>
<linearGradient id="${p}-lamp" x1="1" y1=".2" x2="0" y2=".5"><stop offset="0" stop-color="${C.lamp}" stop-opacity=".9"/><stop offset=".18" stop-color="${C.lamp}" stop-opacity=".3"/><stop offset=".4" stop-color="${C.lamp}" stop-opacity="0"/></linearGradient>
<radialGradient id="${p}-gr" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${C.shadow}" stop-opacity=".6"/><stop offset="1" stop-color="${C.shadow}" stop-opacity="0"/></radialGradient>
<filter id="${p}-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="8"/></filter>
<clipPath id="${p}-c-eye"><path d="${P('eye0')}"/></clipPath>
${rim ? RIMS.map((k) => clipDef(p, k, P(k))).join('') : ''}`
  const R = (k, w) => (rim ? rimIn(p, k, P(k), `${p}-moon`, w, 0.85) + rimIn(p, k, P(k), `${p}-lamp`, w * 0.8, 0.75) : '')
  const toes = (x, y, far) => `<path d="M${x} ${y}v-5M${x + 6} ${y}v-5" stroke="${far ? C.w3 : C.w3}" stroke-width="1" stroke-linecap="round" opacity="${far ? 0.6 : 0.9}"/>`

  const body = `
${ground ? `<ellipse cx="138" cy="206" rx="128" ry="8" fill="url(#${p}-gr)"/>` : ''}
${rim && aura ? `<g class="bj-aura" filter="url(#${p}-blur)" fill="${C.aura}" opacity=".5"><path d="${P('tail')}"/><path d="${P('body')}"/><path d="${P('head')}"/><path d="${P('earN')}"/></g>` : ''}
<g id="${p}-tail">
<path d="${P('tail')}" fill="${C.k1}"/>
${F(furInside({ shape: S.tail, n: N(30), seed: 101, dir: (x, y) => (y < 60 ? deg(-95) : deg(-125)), len: [4, 7], bend: 1 }), C.kSheen, 0.5)}
${F(furEdge({ shape: S.tail, seed: 102, gap: g(2), len: [2.5, 5.5] }), C.k1, 1, 1.2)}
${R('tail', 4)}
</g>
<g id="${p}-hf">
<path d="${P('hf')}" fill="${C.k0}"/>
<path d="${P('hfSock')}" fill="url(#${p}-far)"/>${toes(94, 206, 1)}
</g>
<g id="${p}-ff">
<path d="${P('ff')}" fill="${C.k0}"/>
<path d="${P('ffSock')}" fill="url(#${p}-far)"/>${toes(185, 206, 1)}
</g>
<g id="${p}-torso">
<path d="${P('body')}" fill="${C.k1}"/>
<path d="${P('body')}" fill="url(#${p}-sheen)"/>
${F(furInside({ shape: S.body, n: N(150), seed: 103, dir: () => deg(176), len: [6, 12], bend: 2, jitter: 0.22 }), C.kSheen, 0.42)}
${F(furInside({ shape: S.body, n: N(70), seed: 104, dir: () => deg(172), len: [5, 10], bend: 2 }), '#000', 0.45, 0.9)}
<path d="${P('body')}" fill="url(#${p}-under)"/>
${F(furEdge({ shape: S.body, seed: 105, gap: g(2.1), len: [3, 6.5], bias: (x, y) => (y > 140 ? deg(15) : deg(-20)) }), C.k1, 1, 1.3)}
${R('body', 6)}
<path d="${P('chest')}" fill="url(#${p}-white)"/>
${F(furInside({ shape: S.chest, n: N(40), seed: 106, dir: () => deg(100), len: [5, 9], bend: 1.8 }), C.w2, 0.8)}
${F(furEdge({ shape: S.chest, seed: 107, gap: g(1.7), len: [2.5, 5.5], where: (x) => x > 200, bias: () => deg(20) }), C.w1, 1, 1)}
</g>
<g id="${p}-hn">
<path d="${P('hn')}" fill="${C.k1}"/>
<path d="${P('hn')}" fill="url(#${p}-sheen)" opacity=".7"/>
${F(furInside({ shape: S.hn, n: N(40), seed: 109, dir: (x, y) => (y < 150 ? deg(120) : deg(100)), len: [4, 8], bend: 1.4 }), C.kSheen, 0.45)}
${F(furEdge({ shape: S.hn, seed: 110, gap: g(2), len: [2, 5], where: (x, y) => y > 120 && y < 182 }), C.k1, 1, 1.2)}

<path d="${P('hnSock')}" fill="url(#${p}-sock)"/>
${F(furEdge({ shape: S.hnSock, seed: 111, gap: g(1.8), len: [1.5, 4], where: (x, y) => y < 190 }), C.w1, 1, 0.9)}${toes(58, 206)}
</g>
<g id="${p}-fn">
<path d="${P('fn')}" fill="${C.k1}"/>
${F(furInside({ shape: S.fn, n: N(26), seed: 112, dir: () => deg(95), len: [4, 7], bend: 1 }), C.kSheen, 0.45)}
${rim ? rimIn(p, 'fn', P('fn'), `${p}-lamp`, 3, 0.8) : ''}
<path d="${P('fnSock')}" fill="url(#${p}-sock)"/>
${F(furEdge({ shape: S.fnSock, seed: 113, gap: g(1.8), len: [1.5, 4], where: (x, y) => y < 186 }), C.w1, 1, 0.9)}${toes(213, 206)}
</g>
<g id="${p}-head">
<path d="${P('neck')}" fill="${C.k1}"/>
${F(furInside({ shape: S.neck, n: N(20), seed: 118, dir: () => deg(160), len: [4, 8], bend: 1.2 }), C.kSheen, 0.45)}
<path d="${P('throat')}" fill="url(#${p}-white)"/>
${F(furEdge({ shape: S.throat, seed: 119, gap: g(1.7), len: [2, 5], where: (x, y) => y > 140 }), C.w1, 1, 0.9)}
<path d="${P('earF')}" fill="${C.k0}"/>
<path d="${P('earN')}" fill="${C.k1}"/>
${R('earN', 3)}
<path d="${P('earIn')}" fill="url(#${p}-ear)"/>
${F(furInside({ shape: S.earIn, n: N(8), seed: 114, dir: () => deg(-80), len: [3, 7], bend: 1 }), '#e9e2da', 0.6, 0.6)}
<path d="${P('head')}" fill="${C.k1}"/>
<path d="${P('head')}" fill="url(#${p}-sheen)" opacity=".85"/>
${F(furInside({ shape: S.head, n: N(60), seed: 115, dir: (x, y) => Math.atan2(y - HEAD_AT(282, 124)[1], x - HEAD_AT(282, 124)[0]), len: [2.5, 5], bend: 0.8, not: [S.muzzle] }), C.kSheen, 0.5, 0.6)}
${F(furEdge({ shape: S.head, seed: 116, gap: g(1.9), len: [2.5, 6], where: (x, y) => y > 122 && x < 262, bias: () => deg(-30) }), C.k1, 1, 1.2)}
${rim ? rimIn(p, 'head', P('head'), `${p}-lamp`, 3.5, 0.8) : ''}
<path d="${P('blaze')}" fill="${C.w1}"/>
<path d="${P('muzzle')}" fill="url(#${p}-white)"/>
${F(furEdge({ shape: S.muzzle, seed: 117, gap: g(1.5), len: [1.5, 3.5], inset: 0.8, where: (x) => x < 278 }), C.w1, 1, 0.8)}
<g transform="translate(4 2) rotate(20 218 116)">
<path d="M276.5 120.5c3-1.2 6-.6 7.6 1.5.8 2.6-.6 4.8-3.6 5.4-2.6-.2-4.4-3.4-4-6.9z" fill="${C.noseK}"/>
<path d="M277 121.5c1.6-.5 3-.3 4 .5" stroke="${C.pink}" stroke-width="1.4" fill="none" stroke-linecap="round"/>
<path d="M280.5 127.5q-1 5-4 7.5q-5 2-9 0" stroke="#6b6264" stroke-width="1.1" fill="none" stroke-linecap="round"/>
<circle cx="271.5" cy="132.5" r="1.9" fill="${C.noseK}"/>
<ellipse cx="258" cy="110" rx="12" ry="8" fill="url(#${p}-glint)"/>
<path d="${P('eye0')}" fill="url(#${p}-iris)"/>
<g clip-path="url(#${p}-c-eye)"><ellipse cx="260.6" cy="110.4" rx="2" ry="5" fill="${C.k0}"/><ellipse cx="258" cy="104.5" rx="12" ry="4.6" fill="${C.k0}" opacity=".55"/><ellipse cx="262.6" cy="108.4" rx="1.7" ry="1.2" fill="#fff" opacity=".92"/></g>
<path d="${P('eye0')}" fill="none" stroke="${C.k0}" stroke-width="1.6"/>
<g stroke="#f4f1ea" stroke-width=".85" fill="none" stroke-linecap="round" opacity=".85">
<path d="M272 129Q288 122 300 120M273 132Q289 131 301 134M271 135Q285 140 296 148M266 131Q250 128 236 132"/>
<path d="M258 101Q262 92 268 86" stroke-width=".7"/>
</g>
</g>
</g>`
  return { defs, body, viewBox: '0 0 300 220', w: 300, h: 220 }
}
