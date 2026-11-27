// 포즈 ② 웅크려 자기 — 대표 사진 1(밤색 스크래처 바구니에서 옆으로 누워 자는 모습)을 따라 그린다.
// 좌표계 400×270. 사진 속 위치를 0.1배로 옮겨 잡았다(머리 왼쪽, 등 위, 앞발 가운데, 뒷발이 바구니 턱을 넘어 늘어짐).
// 바구니는 사진의 갈색 대신 따뜻한 아이보리 짚 색으로 바꿨다(캐릭터가 주인공).
import { C } from './palette.mjs'
import { smooth, furInside, furEdge, deg, furPath as F, rimIn, clipDef } from './lib.mjs'

export const S = {
  body: [[132, 118], [160, 96], [205, 80], [262, 73], [318, 78], [358, 98], [382, 130], [389, 168], [374, 196], [330, 207], [260, 209], [190, 205], [146, 193], [124, 168], [122, 140]],
  head: [[70, 136], [92, 122], [118, 121], [137, 134], [144, 156], [140, 178], [126, 194], [101, 201], [78, 195], [63, 180], [59, 158]],
  ear: [[68, 147], [54, 157], [41, 172, 's'], [55, 180], [72, 186]],
  earIn: [[66, 156], [55, 166], [47, 172, 's'], [58, 176], [68, 178]],
  // 목 아래 흰 털이 주둥이로 이어진다(머리를 숙여 턱이 가슴 쪽으로)
  white: [[106, 160], [114, 150], [119, 134], [118, 120], [126, 117], [134, 128], [139, 146], [140, 164], [136, 180], [127, 189], [114, 190], [105, 184], [102, 171]],
  chest: [[148, 178], [158, 160], [176, 154], [193, 162], [200, 182], [194, 198], [160, 200]],
  pawTuck: [[148, 191], [158, 184], [178, 184], [188, 190], [182, 198], [154, 199]],
  arm: [[212, 187], [219, 177], [240, 174], [264, 178], [272, 189], [262, 199], [238, 200], [218, 199]],
  thigh: [[258, 174], [302, 172], [314, 194], [304, 214], [284, 224], [268, 216], [260, 196]],
  sock: [[268, 208], [292, 212], [291, 232], [275, 246], [258, 253], [243, 249], [239, 238], [250, 225]],
}
const P = (k) => smooth(S[k])

export function sleep({ p = 'bs', detail = 1, rim = true, aura = true, basket = true } = {}) {
  const N = (v) => Math.max(4, Math.round(v * detail))
  const g = (v) => (1.25 * v) / Math.sqrt(detail)
  const tangent = (cx, cy) => (x, y) => Math.atan2(y - cy, x - cx) + Math.PI / 2
  const RIMS = ['body', 'head', 'thigh']
  const defs = `
<radialGradient id="${p}-sheen" cx=".45" cy=".05" r=".75"><stop offset="0" stop-color="${C.kSheen}" stop-opacity=".85"/><stop offset=".45" stop-color="${C.k3}" stop-opacity=".35"/><stop offset="1" stop-color="${C.k1}" stop-opacity="0"/></radialGradient>
<linearGradient id="${p}-under" x1="0" y1="0" x2="0" y2="1"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></linearGradient>
<radialGradient id="${p}-white" cx=".4" cy=".3" r=".85"><stop offset="0" stop-color="${C.w0}"/><stop offset=".55" stop-color="${C.w1}"/><stop offset="1" stop-color="${C.w2}"/></radialGradient>
<linearGradient id="${p}-sock" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.w3}"/><stop offset=".3" stop-color="${C.w1}"/><stop offset="1" stop-color="${C.w0}"/></linearGradient>
<linearGradient id="${p}-ear" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.ear1}"/><stop offset="1" stop-color="${C.ear0}"/></linearGradient>
<linearGradient id="${p}-moon" x1=".5" y1="0" x2=".5" y2="1"><stop offset="0" stop-color="${C.moon}" stop-opacity=".95"/><stop offset=".12" stop-color="${C.moon}" stop-opacity=".35"/><stop offset=".3" stop-color="${C.moon}" stop-opacity="0"/></linearGradient>
<linearGradient id="${p}-lamp" x1="1" y1=".3" x2="0" y2=".6"><stop offset="0" stop-color="${C.lamp}" stop-opacity=".85"/><stop offset=".15" stop-color="${C.lamp}" stop-opacity=".25"/><stop offset=".35" stop-color="${C.lamp}" stop-opacity="0"/></linearGradient>
<linearGradient id="${p}-bk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3d6ba"/><stop offset=".5" stop-color="#cbbb98"/><stop offset="1" stop-color="#a99a7c"/></linearGradient>
<linearGradient id="${p}-bkIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8f826a"/><stop offset="1" stop-color="#b8a988"/></linearGradient>
<pattern id="${p}-weave" width="6" height="5" patternUnits="userSpaceOnUse"><path d="M0 1.2h3M3 3.7h3M1.5 0v2.4M4.5 2.5v2.5" stroke="#7d6f57" stroke-width=".7" stroke-opacity=".45"/></pattern>
<radialGradient id="${p}-gr" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${C.shadow}" stop-opacity=".55"/><stop offset="1" stop-color="${C.shadow}" stop-opacity="0"/></radialGradient>
<filter id="${p}-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>
${rim ? RIMS.map((k) => clipDef(p, k, P(k))).join('') : ''}`
  const R = (k, w) => (rim ? rimIn(p, k, P(k), `${p}-moon`, w, 0.85) + rimIn(p, k, P(k), `${p}-lamp`, w * 0.8, 0.7) : '')
  const band = 'M76 184A160 16 0 0 0 396 184L396 232A160 16 0 0 1 76 232Z'

  const body = `
<ellipse cx="236" cy="250" rx="176" ry="14" fill="url(#${p}-gr)"/>
${rim && aura ? `<g filter="url(#${p}-blur)" fill="${C.aura}" opacity=".5"><path d="${P('body')}"/><path d="${P('head')}"/><path d="${P('ear')}"/></g>` : ''}
${basket ? `<ellipse cx="236" cy="184" rx="160" ry="16" fill="url(#${p}-bkIn)"/>` : ''}
<path d="${P('body')}" fill="${C.k1}"/>
<path d="${P('body')}" fill="url(#${p}-sheen)"/>
${F(furInside({ shape: S.body, n: N(170), seed: 71, dir: tangent(250, 250), len: [6, 12], bend: 2.2, jitter: 0.28 }), C.kSheen, 0.45)}
${F(furInside({ shape: S.body, n: N(90), seed: 72, dir: tangent(250, 250), len: [5, 11], bend: 2 }), '#000', 0.45, 0.9)}
<path d="${P('body')}" fill="url(#${p}-under)"/>
${F(furEdge({ shape: S.body, seed: 73, gap: g(2.2), len: [3, 7.5], where: (x, y) => y < 190 && x > 128, bias: () => deg(10) }), C.k1, 1, 1.3)}
${F(furEdge({ shape: S.body, seed: 74, gap: g(5), len: [5, 9], where: (x, y) => y < 120 && x > 150, bias: () => deg(25) }), C.kSheen, 0.7, 0.6)}
${R('body', 6)}
<path d="${P('chest')}" fill="url(#${p}-white)"/>
${F(furEdge({ shape: S.chest, seed: 75, gap: g(1.8), len: [2, 5], where: (x, y) => y < 192 }), C.w1, 1, 0.9)}
${F(furInside({ shape: S.chest, n: N(30), seed: 76, dir: () => deg(70), len: [4, 8], bend: 1.5 }), C.w2, 0.8)}
${basket ? `<path d="${band}" fill="url(#${p}-bk)"/><path d="${band}" fill="url(#${p}-weave)"/>
<path d="M76 184A160 16 0 0 0 396 184" fill="none" stroke="#efe5cf" stroke-width="2.2" stroke-opacity=".8"/>
<path d="M78 232A160 16 0 0 0 394 232" fill="none" stroke="#6f6350" stroke-width="1.4" stroke-opacity=".7"/>
${F(furEdge({ shape: [[78, 186], [236, 200], [394, 186]], closed: false, seed: 77, gap: g(3), len: [2, 5], out: -1, jitter: 1 }), '#d9cba9', 0.9, 0.6)}` : ''}
<path d="${P('pawTuck')}" fill="${C.w1}"/>
${F(furEdge({ shape: S.pawTuck, seed: 78, gap: g(2), len: [1.5, 3.5], where: (x, y) => y < 192 }), C.w1, 1, 0.8)}
<path d="${P('arm')}" fill="url(#${p}-white)"/>
${F(furInside({ shape: S.arm, n: N(34), seed: 79, dir: () => deg(185), len: [4, 8], bend: 1 }), C.w2, 0.8)}
${F(furEdge({ shape: S.arm, seed: 80, gap: g(1.8), len: [2, 4.5], where: (x) => x > 226 }), C.w1, 1, 0.9)}
<g><ellipse cx="219.5" cy="186.5" rx="3" ry="3.4" fill="#7a4b52"/><ellipse cx="224.5" cy="180.5" rx="3.2" ry="3" fill="${C.pinkD}"/><ellipse cx="231.5" cy="178.6" rx="3" ry="2.6" fill="#6a4148"/>
<path d="M234 186c4-3 9-2 10 2s-2 8-7 8-6-6-3-10z" fill="${C.pink}"/><path d="M235 189c2-2 6-2 7 1s-2 6-5 6-4-4-2-7z" fill="${C.padK}"/></g>
<path d="${P('thigh')}" fill="${C.k1}"/>
<path d="${P('thigh')}" fill="url(#${p}-sheen)" opacity=".6"/>
${F(furInside({ shape: S.thigh, n: N(36), seed: 81, dir: () => deg(105), len: [4, 8], bend: 1.4 }), C.kSheen, 0.45)}
${F(furEdge({ shape: S.thigh, seed: 82, gap: g(2), len: [2, 5], where: (x, y) => y > 190 }), C.k1, 1, 1.2)}
${R('thigh', 4)}
<path d="${P('sock')}" fill="url(#${p}-sock)"/>
${F(furInside({ shape: S.sock, n: N(30), seed: 83, dir: () => deg(130), len: [3, 6], bend: 1 }), C.w2, 0.8)}
${F(furEdge({ shape: S.sock, seed: 84, gap: g(1.8), len: [2, 5], where: (x, y) => y < 244 && x > 244 }), C.w1, 1, 0.9)}
<g><ellipse cx="258" cy="241" rx="7.5" ry="5.5" fill="${C.pink}" transform="rotate(-35 258 241)"/><ellipse cx="262.5" cy="238.5" rx="3" ry="4.2" fill="${C.padK}" transform="rotate(-35 262.5 238.5)"/>
<ellipse cx="246" cy="246.5" rx="2.6" ry="2.2" fill="${C.pink}"/><ellipse cx="243.5" cy="240" rx="2.3" ry="2.1" fill="${C.pinkD}"/><ellipse cx="250.5" cy="251" rx="2.3" ry="2" fill="${C.pink}"/></g>
${basket ? `<circle cx="384" cy="214" r="13" fill="url(#${p}-bk)"/><circle cx="384" cy="214" r="13" fill="url(#${p}-weave)"/><path d="M373 208q11 6 22 0M372 216q12 6 24 0" stroke="#7d6f57" stroke-width=".8" fill="none" stroke-opacity=".6"/>` : ''}
<path d="${P('ear')}" fill="${C.k1}"/>
<path d="${P('earIn')}" fill="url(#${p}-ear)"/>
${F(furInside({ shape: S.earIn, n: N(10), seed: 85, dir: () => deg(160), len: [3, 7], bend: 1.2 }), '#e9e2da', 0.6, 0.6)}
<path d="${P('head')}" fill="${C.k1}"/>
<path d="${P('head')}" fill="url(#${p}-sheen)" opacity=".8"/>
${F(furInside({ shape: S.head, n: N(70), seed: 86, dir: (x, y) => Math.atan2(y - 172, x - 118), len: [2.5, 5], bend: 0.8, not: [S.white] }), C.kSheen, 0.5, 0.6)}
${F(furEdge({ shape: S.head, seed: 87, gap: g(2), len: [2, 5], where: (x, y) => x < 120 }), C.k1, 1, 1.1)}
${R('head', 4)}
<path d="${P('white')}" fill="url(#${p}-white)"/>
${F(furEdge({ shape: S.white, seed: 88, gap: g(1.6), len: [1.5, 3.5], inset: 0.8 }), C.w1, 1, 0.8)}
${F(furInside({ shape: S.white, n: N(26), seed: 89, dir: () => deg(-80), len: [2, 5], bend: 0.8 }), C.w2, 0.8, 0.6)}
<path d="M110.5 170c2-4 9-5 12-1s0 9-5 10-8-4-7-9z" fill="${C.noseK}"/>
<path d="M118 168.5c2 0 4 1 4.6 2.6" stroke="${C.pinkD}" stroke-width="1.3" fill="none" stroke-linecap="round"/>
<circle cx="125" cy="177.5" r="1.9" fill="${C.noseK}"/>
<path d="M115 181q5 3 10 1" stroke="#6b6264" stroke-width="1.1" fill="none" stroke-linecap="round"/>
<path d="M86 160q4 6 10 9M98 141q3 4 8 6" stroke="${C.k0}" stroke-width="2" fill="none" stroke-linecap="round"/>
<path d="M86.5 159q4 6.5 10 9.6" stroke="${C.kSheen}" stroke-width=".7" fill="none" stroke-linecap="round" opacity=".8" transform="translate(-.8 1.2)"/>
<g stroke="#f4f1ea" stroke-width=".9" fill="none" stroke-linecap="round" opacity=".85">
<path d="M110 166Q92 146 70 128M112 163Q100 140 86 120M114 161Q108 138 100 116M108 172Q88 166 62 164M109 176Q90 180 70 190"/>
<path d="M131 170Q150 160 168 150M132 175Q154 172 174 170" opacity=".7"/>
</g>`
  return { defs, body, viewBox: '0 0 400 270', w: 400, h: 270 }
}
