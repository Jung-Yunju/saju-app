// 복자(턱시도 고양이) 식빵 자세 — design/illust/bokja-loaf.svg 의 인라인 사본(원본은 수정하지 않는다).
// 원본의 var(--ill-sticker-edge,#fffaf2)는 캔버스·OG 이미지(var 미지원)에서도 쓰이도록 값으로 치환한다.
// 원본이 바뀌면 이 파일의 BOKJA_INNER를 맞춰 갱신해야 한다.
const INNER = (edgeRaw: string) => { const edge = safeEdge(edgeRaw); return `
<g stroke="${edge}" stroke-width="7" stroke-linejoin="round" fill="none">
<path d="M14 80 C10 58 22 44 44 42 L78 42 C100 42 110 58 106 80 Z"/>
<path d="M30 34 L31 14 L44 25 Z"/><path d="M60 34 L59 14 L46 25 Z"/><circle cx="45" cy="40" r="17"/>
</g>
<g fill="#1d1a18">
<path d="M14 80 C10 58 22 44 44 42 L78 42 C100 42 110 58 106 80 Z"/>
<path d="M30 34 L31 14 L44 25 Z"/><path d="M60 34 L59 14 L46 25 Z"/>
<circle cx="45" cy="40" r="17"/>
</g>
<path d="M104 74 C114 70 116 60 108 56" fill="none" stroke="#1d1a18" stroke-width="6" stroke-linecap="round"/>
<g fill="#fffaf2">
<path d="M45 30 C43.5 35 37.5 38 37.5 44 C37.5 49 41 52 45 52 C49 52 52.5 49 52.5 44 C52.5 38 46.5 35 45 30 Z"/>
<path d="M36 56 C40 60 50 60 54 56 L52 76 C50 80 40 80 38 76 Z"/>
<ellipse cx="38" cy="80" rx="7" ry="3.6"/><ellipse cx="54" cy="80" rx="7" ry="3.6"/>
</g>
<g fill="none" stroke="#f2c14e" stroke-width="2.2" stroke-linecap="round">
<path d="M34.5 39 Q38 42 41.5 39"/><path d="M48.5 39 Q52 42 55.5 39"/>
</g>
<path d="M43 43.6 L47 43.6 L45 46 Z" fill="#c4877c"/>
<g fill="#f2c14e" font-family="serif" font-size="11" font-weight="700"><text x="68" y="22">z</text><text x="78" y="13" font-size="8">z</text></g>` }

const DEFAULT_EDGE = "#fffaf2"
/** 마크업에 끼우기 전 색상 검증: #rgb / #rrggbb 만 허용, 그 밖은 기본색 */
const safeEdge = (edge: string) => (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(edge) ? edge : DEFAULT_EDGE)

/** SVG 안쪽 마크업(React에서 dangerouslySetInnerHTML — 고정 문자열이라 안전) */
export const bokjaInner = (edge = "#fffaf2") => INNER(edge)

/** 단독 SVG 문서 문자열(캔버스 Image·OG 이미지용). 비율 120:90 */
export const bokjaSvgDocument = (edge = "#fffaf2") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90" width="480" height="360">${INNER(edge)}</svg>`

export const BOKJA_RATIO = 120 / 90
