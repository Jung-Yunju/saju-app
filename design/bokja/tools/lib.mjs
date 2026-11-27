// 복자 그림 생성 도구 — 공통 함수(외부 의존성 없음).
// 모양은 손으로 잡은 점 목록(Catmull-Rom → 3차 베지에)으로 그리고,
// 털 결(가는 선 수백 개)만 고정 씨앗 난수로 만들어 매번 같은 결과가 나온다.

/** 고정 씨앗 난수(mulberry32) */
export function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const n1 = (v) => {
  const r = Math.round(v * 10) / 10
  return Object.is(r, -0) ? '0' : String(r)
}

/**
 * 점 목록 → 부드러운 경로. 점은 [x, y] 또는 [x, y, 's'](뾰족한 점).
 * closed=false면 열린 선.
 */
export function smooth(pts, closed = true, k = 1 / 6) {
  const P = pts.map((p) => ({ x: p[0], y: p[1], s: p[2] === 's' }))
  const n = P.length
  const at = (i) => (closed ? P[(i + n) % n] : P[Math.max(0, Math.min(n - 1, i))])
  let d = `M${n1(P[0].x)} ${n1(P[0].y)}`
  const segs = closed ? n : n - 1
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2)
    const c1 = p1.s ? p1 : { x: p1.x + (p2.x - p0.x) * k, y: p1.y + (p2.y - p0.y) * k }
    const c2 = p2.s ? p2 : { x: p2.x - (p3.x - p1.x) * k, y: p2.y - (p3.y - p1.y) * k }
    d += `C${n1(c1.x)} ${n1(c1.y)} ${n1(c2.x)} ${n1(c2.y)} ${n1(p2.x)} ${n1(p2.y)}`
  }
  return closed ? d + 'Z' : d
}

/** 같은 곡선을 꺾은선으로 펼친다(안쪽 판정·가장자리 털 배치용) */
export function flatten(pts, closed = true, k = 1 / 6, steps = 8) {
  const P = pts.map((p) => ({ x: p[0], y: p[1], s: p[2] === 's' }))
  const n = P.length
  const at = (i) => (closed ? P[(i + n) % n] : P[Math.max(0, Math.min(n - 1, i))])
  const out = []
  const segs = closed ? n : n - 1
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2)
    const c1 = p1.s ? p1 : { x: p1.x + (p2.x - p0.x) * k, y: p1.y + (p2.y - p0.y) * k }
    const c2 = p2.s ? p2 : { x: p2.x - (p3.x - p1.x) * k, y: p2.y - (p3.y - p1.y) * k }
    for (let j = 0; j < steps; j++) {
      const t = j / steps, u = 1 - t
      out.push([
        u * u * u * p1.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p2.x,
        u * u * u * p1.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p2.y,
      ])
    }
  }
  if (!closed) out.push([P[n - 1].x, P[n - 1].y])
  return out
}

export function inside(poly, x, y) {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

const area = (poly) => {
  let a = 0
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1])
  return a / 2
}

/** 한 획: 시작점·각도·길이·휨 → 2차 곡선 조각(상대 좌표) */
const stroke = (x, y, ang, len, bend) => {
  const ex = Math.cos(ang) * len, ey = Math.sin(ang) * len
  const cx = ex / 2 - Math.sin(ang) * bend, cy = ey / 2 + Math.cos(ang) * bend
  return `M${n1(x)} ${n1(y)}q${n1(cx)} ${n1(cy)} ${n1(ex)} ${n1(ey)}`
}

/**
 * 안쪽 털 결. shape = 점 목록(smooth와 같은 형식).
 * dir(x,y) → 라디안, len=[최소,최대], bend=휨 최대, not = 제외할 점 목록들
 */
export function furInside({ shape, n, seed, dir, len = [4, 8], bend = 1.5, jitter = 0.35, not = [], where }) {
  const R = rng(seed)
  const poly = flatten(shape)
  const ex = not.map((s) => flatten(s))
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1])
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  let d = '', made = 0, tries = 0
  while (made < n && tries < n * 60) {
    tries++
    const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0)
    if (!inside(poly, x, y) || ex.some((e) => inside(e, x, y))) continue
    if (where && !where(x, y)) continue
    const a = dir(x, y) + (R() - 0.5) * 2 * jitter
    d += stroke(x, y, a, len[0] + R() * (len[1] - len[0]), (R() - 0.5) * 2 * bend)
    made++
  }
  return d
}

/**
 * 가장자리 털(바깥으로 삐져나온 잔털). gap=간격, where(x,y)=이 위치만, bias(x,y)=바깥 방향에 더할 각도
 */
export function furEdge({ shape, seed, gap = 2.2, len = [3, 6], out = 1, bend = 1.2, jitter = 0.45, inset = 1.2, where, bias, closed = true }) {
  const R = rng(seed)
  const poly = flatten(shape, closed, 1 / 6, 14)
  const ccw = area(poly) > 0
  let d = '', acc = 0
  for (let i = 0; i < poly.length - 1 + (closed ? 1 : 0); i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length]
    const L = Math.hypot(bx - ax, by - ay)
    if (!L) continue
    const tx = (bx - ax) / L, ty = (by - ay) / L
    // 바깥 법선(화면 좌표계 y 아래 방향)
    const nx = ccw ? -ty : ty, ny = ccw ? tx : -tx
    let s = acc
    while (s < L) {
      const x = ax + tx * s, y = ay + ty * s
      if (!where || where(x, y)) {
        let a = Math.atan2(ny * out, nx * out) + (bias ? bias(x, y) : 0) + (R() - 0.5) * 2 * jitter
        const sx = x - nx * inset * out, sy = y - ny * inset * out
        d += stroke(sx, sy, a, len[0] + R() * (len[1] - len[0]), (R() - 0.5) * 2 * bend)
      }
      s += gap * (0.6 + R() * 0.8)
    }
    acc = s - L
  }
  return d
}

/** 점 목록을 이동·확대·회전 */
export function tf(pts, { dx = 0, dy = 0, s = 1, rot = 0, ox = 0, oy = 0 } = {}) {
  const c = Math.cos((rot * Math.PI) / 180), si = Math.sin((rot * Math.PI) / 180)
  return pts.map(([x, y, f]) => {
    const X = (x - ox) * s, Y = (y - oy) * s
    const p = [ox + X * c - Y * si + dx, oy + X * si + Y * c + dy]
    if (f) p.push(f)
    return p
  })
}

export const deg = (d) => (d * Math.PI) / 180
/** (cx,cy)에서 바깥으로 퍼지는 방향 */
export const radial = (cx, cy, add = 0) => (x, y) => Math.atan2(y - cy, x - cx) + add

/** 털 결 묶음 → <path> 한 개 */
export const furPath = (d, color, op = 1, w = 0.7, extra = '') =>
  d ? `<path d="${d}" stroke="${color}"${op < 1 ? ` stroke-opacity="${op}"` : ''} stroke-width="${w}" fill="none" stroke-linecap="round"${extra}/>` : ''

/** 모양 안쪽으로만 번지는 테두리 빛(모양으로 자른 굵은 선). clip id는 `${p}-c-${key}` */
export const rimIn = (p, key, d, grad, w = 5, op = 1) =>
  `<g clip-path="url(#${p}-c-${key})"><path d="${d}" fill="none" stroke="url(#${grad})" stroke-width="${w}"${op < 1 ? ` opacity="${op}"` : ''}/></g>`
export const clipDef = (p, key, d) => `<clipPath id="${p}-c-${key}"><path d="${d}"/></clipPath>`
