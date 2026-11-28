// 포즈 ① 식빵 자세 정면 — 대표 사진 2(골프 매트 옆, 정면을 보는 식빵 자세)를 따라 그린다.
// 좌표계 400×300. 바닥선 y=292. 머리는 사진처럼 오른쪽(보는 쪽)이 조금 올라가게 -6도 기울인다.
import { C } from './palette.mjs'
import { smooth, furInside, furEdge, tf, deg, radial, furPath as F, rimIn, clipDef } from './lib.mjs'

const HEAD_C = [238, 176]
const HEAD_ROT = -6
const HEAD_S = 0.92
const rotH = (pts) => tf(pts, { rot: HEAD_ROT, s: HEAD_S, ox: HEAD_C[0], oy: HEAD_C[1] })

// ── 모양(점 목록) ──
export const S = {
  tail: [[124, 104], [100, 86], [82, 64], [72, 44], [74, 28], [86, 22], [96, 30], [102, 48], [116, 68], [142, 90]],
  body: [[74, 290], [62, 240], [66, 180], [84, 126], [118, 84], [168, 58], [224, 50], [276, 58], [316, 84], [340, 122], [350, 180], [352, 240], [348, 290], [300, 294], [200, 295], [120, 294]],
  legFar: [[126, 190], [96, 194], [66, 200], [44, 206], [36, 220], [48, 232], [90, 230], [128, 226]],
  sockFar: [[60, 203], [36, 205], [18, 211], [9, 223], [15, 235], [36, 238], [58, 234], [66, 219]],
  legNear: [[132, 238], [100, 242], [70, 248], [50, 254], [42, 270], [56, 282], [100, 280], [134, 276]],
  sockNear: [[70, 250], [44, 252], [26, 260], [18, 274], [27, 287], [50, 289], [70, 283], [76, 266]],
  bib: [[192, 222], [176, 240], [166, 264], [164, 292], [318, 292], [314, 262], [302, 238], [288, 222], [262, 236], [214, 236]],
  pawL: [[178, 288], [184, 280], [200, 278], [214, 283], [216, 292], [180, 293]],
  pawR: [[262, 284], [276, 278], [292, 279], [300, 286], [300, 293], [262, 293]],
  head: rotH([[238, 111], [268, 113], [292, 125], [305, 147], [313, 175], [314, 201], [302, 223], [273, 239], [238, 245], [203, 239], [174, 223], [162, 201], [163, 175], [171, 147], [184, 125], [208, 113]]),
  earL: rotH([[170, 148], [166, 116], [169, 90], [177, 72, 's'], [196, 84], [214, 100], [226, 116]]),
  earR: rotH([[250, 114], [264, 96], [286, 78], [303, 68, 's'], [309, 92], [311, 120], [308, 148]]),
  earInL: rotH([[180, 130], [178, 104], [181, 86, 's'], [197, 97], [210, 112]]),
  earInR: rotH([[264, 112], [281, 95], [298, 82, 's'], [300, 104], [299, 128]]),
  face: rotH([[234, 147], [238.5, 147], [240.5, 160], [243, 176], [249, 187], [264, 191], [281, 198], [291, 212], [283, 228], [263, 240], [238, 246], [216, 242], [203, 232], [207, 219], [219, 207], [225, 193], [229, 177], [232, 160]]),
  eyeL: rotH([[194, 171], [201, 166], [211, 164.5], [220, 166.5], [223.5, 171], [214, 176.5], [202, 176.5]]),
  eyeR: rotH([[282, 170], [275, 165], [265, 163.5], [256, 165.5], [252.5, 170], [262, 175.5], [274, 175.5]]),
  nose: rotH([[232, 189], [251, 189], [248, 195.5], [242, 201], [236, 195.5]]),
  noseK: rotH([[231.5, 189], [241.5, 189], [241.5, 197], [240, 203.5], [235.5, 207], [231, 202], [234.5, 195.5]]),
}
const P = (k) => smooth(S[k])

const at = (x, y) => tf([[x, y]], { rot: HEAD_ROT, s: HEAD_S, ox: HEAD_C[0], oy: HEAD_C[1] })[0]

function eye(p, key, cx, cy, side) {
  const r1 = (v) => Math.round(v * 10) / 10
  const [x, y] = at(cx, cy).map(r1)
  const id = `${p}-${key}`
  return `<clipPath id="${id}"><path d="${P(key)}"/></clipPath>
<path d="${P(key)}" fill="url(#${p}-iris)"/>
<g clip-path="url(#${id})">
<ellipse cx="${x + side * 1.2}" cy="${y + 0.5}" rx="3.4" ry="7.6" fill="${C.k0}"/>
<ellipse cx="${x}" cy="${y - 7}" rx="18" ry="6.5" fill="${C.k0}" opacity=".55"/>
<ellipse cx="${x - 4.2}" cy="${y - 2.2}" rx="2.7" ry="1.9" fill="#fff" opacity=".92"/>
<circle cx="${x + 4.5}" cy="${y + 3}" r=".9" fill="#fff" opacity=".45"/>
</g>
<path d="${P(key)}" fill="none" stroke="${C.k0}" stroke-width="2.2"/>`
}

/**
 * @param {object} o
 * @param {string} o.p  id 앞머리(한 문서에 여러 장 넣을 때 겹치지 않게)
 * @param {number} o.detail 털 결 양(1 = 시트용, 0.5 = 작은 스티커용)
 * @param {string|null} o.edge 스티커 테두리 색(null이면 없음)
 * @param {boolean} o.rim 달빛·등잔빛 테두리
 * @param {boolean} o.ground 바닥 그림자
 */
/**
 * @param {object} o
 * @param {string} o.p  id 앞머리(한 문서에 여러 장 넣을 때 겹치지 않게)
 * @param {number} o.detail 털 결 양(1 = 시트용, 0.6 = 작은 화면용)
 * @param {string|null} o.edge 스티커 테두리 색(null이면 없음)
 * @param {boolean} o.rim 달빛·등잔빛 테두리
 * @param {boolean} o.ground 바닥 그림자
 */
export function loaf({ p = 'bl', detail = 1, edge = null, rim = true, ground = true, aura = true } = {}) {
  const N = (v) => Math.max(4, Math.round(v * detail))
  const g = (v) => (1.25 * v) / Math.pow(detail, 0.8)
  const nose = at(242, 196)
  const RIMS = ['body', 'tail', 'head', 'legNear', 'legFar', 'earR', 'earL']
  const defs = `
<radialGradient id="${p}-sheen" cx=".3" cy=".1" r=".8"><stop offset="0" stop-color="${C.kSheen}" stop-opacity=".8"/><stop offset=".4" stop-color="${C.k3}" stop-opacity=".4"/><stop offset="1" stop-color="${C.k1}" stop-opacity="0"/></radialGradient>
<linearGradient id="${p}-under" x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient>
<radialGradient id="${p}-hsheen" cx=".4" cy=".12" r=".75"><stop offset="0" stop-color="${C.kSheen}" stop-opacity=".85"/><stop offset=".5" stop-color="${C.k3}" stop-opacity=".3"/><stop offset="1" stop-color="${C.k1}" stop-opacity="0"/></radialGradient>
<radialGradient id="${p}-occ" cx=".5" cy=".5" r=".5"><stop offset=".6" stop-color="#000" stop-opacity=".75"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<radialGradient id="${p}-white" cx=".45" cy=".25" r=".85"><stop offset="0" stop-color="${C.w0}"/><stop offset=".55" stop-color="${C.w1}"/><stop offset="1" stop-color="${C.w2}"/></radialGradient>
<linearGradient id="${p}-sock" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.w3}"/><stop offset=".35" stop-color="${C.w1}"/><stop offset="1" stop-color="${C.w0}"/></linearGradient>
<radialGradient id="${p}-iris" cx=".5" cy=".6" r=".62"><stop offset="0" stop-color="${C.iris0}"/><stop offset=".55" stop-color="${C.iris1}"/><stop offset="1" stop-color="${C.iris2}"/></radialGradient>
<linearGradient id="${p}-ear" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${C.ear0}"/><stop offset="1" stop-color="${C.ear1}"/></linearGradient>
<radialGradient id="${p}-chin" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#40445a" stop-opacity=".6"/><stop offset="1" stop-color="#40445a" stop-opacity="0"/></radialGradient>
<radialGradient id="${p}-gr" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${C.shadow}" stop-opacity=".6"/><stop offset=".7" stop-color="${C.shadow}" stop-opacity=".25"/><stop offset="1" stop-color="${C.shadow}" stop-opacity="0"/></radialGradient>
<linearGradient id="${p}-moon" x1="0" y1="0" x2="1" y2=".6"><stop offset="0" stop-color="${C.moon}" stop-opacity=".95"/><stop offset=".22" stop-color="${C.moon}" stop-opacity=".45"/><stop offset=".5" stop-color="${C.moon}" stop-opacity="0"/></linearGradient>
<filter id="${p}-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>
<radialGradient id="${p}-glint" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${C.iris0}" stop-opacity=".35"/><stop offset="1" stop-color="${C.iris0}" stop-opacity="0"/></radialGradient>
<linearGradient id="${p}-lamp" x1="1" y1=".2" x2="0" y2=".5"><stop offset="0" stop-color="${C.lamp}" stop-opacity=".9"/><stop offset=".18" stop-color="${C.lamp}" stop-opacity=".3"/><stop offset=".4" stop-color="${C.lamp}" stop-opacity="0"/></linearGradient>
${rim ? RIMS.map((k) => clipDef(p, k, P(k))).join('') : ''}`

  const R = (k, w = 5) => (rim ? rimIn(p, k, P(k), `${p}-moon`, w * 0.7, 0.8) + rimIn(p, k, P(k), `${p}-lamp`, w * 0.6, 0.7) : '')
  const sticker = edge
    ? `<g fill="${edge}" stroke="${edge}" stroke-width="12" stroke-linejoin="round">${['tail', 'legFar', 'sockFar', 'legNear', 'sockNear', 'body', 'earL', 'earR', 'head'].map((k) => `<path d="${P(k)}"/>`).join('')}</g>`
    : ''
  const W = (x, y) => at(x, y).map((v) => Math.round(v * 10) / 10).join(' ')

  const body = `
${ground ? `<ellipse cx="206" cy="292" rx="204" ry="12" fill="url(#${p}-gr)"/>` : ''}
${rim && aura ? `<g class="bj-aura" filter="url(#${p}-blur)" fill="${C.aura}" opacity=".55"><path d="${P('tail')}"/><path d="${P('body')}"/><path d="${P('head')}"/><path d="${P('earL')}"/><path d="${P('earR')}"/></g>` : ''}
<path d="${P('tail')}" fill="${C.k1}"/>
${F(furInside({ shape: S.tail, n: N(34), seed: 11, dir: () => deg(-118), len: [4, 7], bend: 1 }), C.kSheen, 0.55)}
${F(furEdge({ shape: S.tail, seed: 12, gap: g(2.2), len: [3, 6], where: (x, y) => y < 96 }), C.k1, 1, 1.3)}
${R('tail', 4)}
<path d="${P('legFar')}" fill="${C.k1}"/>
${R('legFar', 4)}
<path d="${P('sockFar')}" fill="url(#${p}-sock)"/>
${F(furEdge({ shape: S.sockFar, seed: 13, gap: g(2), len: [2, 4.5], where: (x) => x > 50 }), C.w1, 1, 0.9)}
<path d="M17 221q5 2 9 1M14 229q5 2 10 1" stroke="${C.w3}" stroke-width="1.1" fill="none" stroke-linecap="round"/>
<path d="${P('body')}" fill="${C.k1}"/>
<path d="${P('body')}" fill="url(#${p}-sheen)"/>
${F(furInside({ shape: S.body, n: N(150), seed: 21, dir: radial(238, 230, deg(8)), len: [5, 11], bend: 2, jitter: 0.3 }), C.kSheen, 0.42)}
${F(furInside({ shape: S.body, n: N(80), seed: 22, dir: radial(238, 230), len: [5, 10], bend: 2 }), '#000', 0.45, 0.9)}
<path d="${P('body')}" fill="url(#${p}-under)"/>
${F(furEdge({ shape: S.body, seed: 23, gap: g(2.3), len: [3, 7], where: (x, y) => y < 262 }), C.k1, 1, 1.3)}
${R('body', 6)}
<ellipse cx="${HEAD_C[0] + 3}" cy="${HEAD_C[1] + 10}" rx="84" ry="80" fill="url(#${p}-occ)"/>
<path d="${P('legNear')}" fill="${C.k1}"/>
${F(furInside({ shape: S.legNear, n: N(34), seed: 31, dir: () => deg(180), len: [4, 8], bend: 1 }), C.kSheen, 0.45)}
${F(furEdge({ shape: S.legNear, seed: 32, gap: g(2.2), len: [2, 5], where: (x, y) => y < 250 && x > 74 }), C.k1, 1, 1.2)}
${R('legNear', 4)}
<path d="${P('sockNear')}" fill="url(#${p}-sock)"/>
${F(furInside({ shape: S.sockNear, n: N(30), seed: 33, dir: () => deg(185), len: [3, 5], bend: 1 }), C.w2, 0.8)}
${F(furEdge({ shape: S.sockNear, seed: 34, gap: g(2), len: [2, 4.5], where: (x) => x > 62 }), C.w1, 1, 0.9)}
<path d="M24 268q6 2 11 1M21 277q6 2 12 1" stroke="${C.w3}" stroke-width="1.2" fill="none" stroke-linecap="round"/>
<path d="${P('bib')}" fill="url(#${p}-white)"/>
${F(furInside({ shape: S.bib, n: N(105), seed: 41, dir: (x) => deg(90 + (x - 238) * 0.22), len: [6, 12], bend: 2.4, jitter: 0.25 }), C.w2, 0.75, 0.75)}
${F(furInside({ shape: S.bib, n: N(45), seed: 42, dir: (x) => deg(90 + (x - 238) * 0.22), len: [5, 10], bend: 2 }), '#fff', 0.9, 0.9)}
${F(furEdge({ shape: S.bib, seed: 43, gap: g(1.7), len: [2.5, 5], bend: 2.4, where: (x, y) => y < 286 && (x < 205 || x > 270 || y < 232), bias: (x) => (x < 238 ? deg(-22) : deg(22)) }), C.w1, 1, 1)}
<path d="M238 252q-2 18 0 38" stroke="${C.w3}" stroke-width="5" opacity=".18" fill="none" stroke-linecap="round"/>
<ellipse cx="238" cy="246" rx="62" ry="17" fill="url(#${p}-chin)"/>
<path d="${P('pawL')}" fill="${C.w1}"/><path d="${P('pawR')}" fill="${C.w1}"/>
<path d="M192 283q1 5 0 9M203 282q1 5 0 10M276 283q-1 5 0 9M287 282q1 5 0 10" stroke="${C.w3}" stroke-width="1.1" fill="none" stroke-linecap="round"/>
<path d="${P('earL')}" fill="${C.k1}"/><path d="${P('earR')}" fill="${C.k1}"/>
${R('earR', 3)}${R('earL', 3)}
<path d="${P('earInL')}" fill="url(#${p}-ear)"/><path d="${P('earInR')}" fill="url(#${p}-ear)"/>
${F(furInside({ shape: S.earInL, n: N(16), seed: 51, dir: () => deg(-60 + HEAD_ROT), len: [4, 9], bend: 1.5 }) + furInside({ shape: S.earInR, n: N(16), seed: 52, dir: () => deg(-120 + HEAD_ROT), len: [4, 9], bend: 1.5 }), '#e9e2da', 0.6, 0.6)}
${F(furEdge({ shape: S.earL, seed: 53, gap: g(2.4), len: [1.5, 3.5], where: (x) => x < 186 }) + furEdge({ shape: S.earR, seed: 54, gap: g(2.4), len: [1.5, 3.5], where: (x) => x > 296 }), C.k1, 1, 1)}
<path d="${P('head')}" fill="${C.k1}"/>
<path d="${P('head')}" fill="url(#${p}-hsheen)"/>
${F(furInside({ shape: S.head, n: N(90), seed: 61, dir: radial(nose[0], nose[1] + 6), len: [2.5, 5.5], bend: 0.8, not: [S.face] }), C.kSheen, 0.5, 0.6)}
${F(furEdge({ shape: S.head, seed: 65, gap: g(2), len: [2, 4.5], where: (x, y) => y < 150 }), C.k3, 1, 1)}
${F(furEdge({ shape: S.head, seed: 62, gap: g(1.9), len: [3, 7], where: (x, y) => y > 150 && (x < 190 || x > 286), bias: (x) => (x < 238 ? deg(-25) : deg(25)) }), C.k1, 1, 1.2)}
${rim ? rimIn(p, 'head', P('head'), `${p}-lamp`, 3, 0.5) : ''}
<path d="${P('face')}" fill="url(#${p}-white)"/>
${F(furEdge({ shape: S.face, seed: 63, gap: g(1.6), len: [1.5, 3.5], inset: 0.8, where: (x, y) => y < 240 }), C.w1, 1, 0.8)}
${F(furInside({ shape: S.face, n: N(36), seed: 64, dir: radial(nose[0], nose[1]), len: [2, 4], bend: 0.6 }), C.w2, 0.8, 0.6)}
<path d="${P('nose')}" fill="${C.pink}"/>
<path d="${P('noseK')}" fill="${C.noseK}"/>
<path d="M${W(244.5, 191)}q3 -.5 4.5 1" stroke="#f3d3cf" stroke-width="1" fill="none" stroke-linecap="round" opacity=".8"/>
<path d="M${W(242, 201)}L${W(242, 209)}Q${W(236, 215)} ${W(229, 212)}M${W(242, 209)}Q${W(248, 215)} ${W(256, 212)}" stroke="#6b6264" stroke-width="1.3" fill="none" stroke-linecap="round"/>
<circle cx="${W(257, 200).split(' ')[0]}" cy="${W(257, 200).split(' ')[1]}" r="2.3" fill="${C.noseK}"/>
<circle cx="${W(238, 221).split(' ')[0]}" cy="${W(238, 221).split(' ')[1]}" r="1.9" fill="${C.noseK}" opacity=".85"/>
${[[209, 171], [267, 170]].map(([x, y]) => `<ellipse cx="${W(x, y).split(' ')[0]}" cy="${W(x, y).split(' ')[1]}" rx="22" ry="14" fill="url(#${p}-glint)"/>`).join('')}
${eye(p, 'eyeL', 209, 171, 1)}
${eye(p, 'eyeR', 267, 170, -1)}
<g stroke="#f4f1ea" stroke-width="1" fill="none" stroke-linecap="round" opacity=".85">
<path d="M${W(262, 202)}Q${W(304, 190)} ${W(350, 184)}M${W(263, 206)}Q${W(306, 200)} ${W(354, 202)}M${W(262, 210)}Q${W(300, 212)} ${W(344, 222)}M${W(260, 213)}Q${W(292, 220)} ${W(326, 236)}M${W(223, 202)}Q${W(180, 190)} ${W(132, 186)}M${W(222, 206)}Q${W(178, 202)} ${W(128, 206)}M${W(223, 210)}Q${W(184, 214)} ${W(140, 228)}"/>
<path d="M${W(214, 160)}Q${W(204, 144)} ${W(192, 132)}M${W(260, 158)}Q${W(270, 142)} ${W(284, 130)}" stroke-width=".8"/>
</g>`
  return { defs, body, sticker, viewBox: '0 0 400 300', w: 400, h: 300 }
}
