// 운명비서 색 대비 실측: node design/unmyeong/tools/contrast.mjs
// WCAG 2.1 상대 휘도 공식. 값은 src/styles/unmyeong.css와 같아야 한다(고칠 때 둘 다).
const T = {
  bg: '#141310', study: '#211C17', wood: '#382B21', paper: '#C9B898',
  text: '#E2D8C5', textMuted: '#A99B83', brass: '#B9A17A', brassDeep: '#554425',
  line: '#504335', lineStrong: '#80705A', paperLine: '#6B5A45',
  seal: '#702F2B', sealHover: '#7B3530', sealText: '#EFE6D6', sealEdge: '#A65E50',
  ink: '#2A2119', inkMuted: '#4D3F32', dangerDark: '#D49A8A', dangerPaper: '#702F2B',
}
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
const L = (h) => { const n = parseInt(h.slice(1), 16); return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255) }
const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const pairs = [
  // [글자/선, 바탕, 기준, 쓰임]
  ['text', 'bg', 4.5, '밝은 본문 / 가장 깊은 바탕'],
  ['text', 'study', 4.5, '밝은 본문 / 서재'],
  ['text', 'wood', 4.5, '밝은 본문 / 목재'],
  ['textMuted', 'bg', 4.5, '보조 글 / 바탕'],
  ['textMuted', 'study', 4.5, '보조 글 / 서재'],
  ['textMuted', 'wood', 4.5, '보조 글 / 목재'],
  ['brass', 'bg', 4.5, '황동 제목 / 바탕'],
  ['brass', 'study', 4.5, '황동 제목 / 서재'],
  ['brass', 'wood', 4.5, '황동 제목 / 목재'],
  ['ink', 'paper', 4.5, '종이 위 본문'],
  ['inkMuted', 'paper', 4.5, '종이 위 보조 글'],
  ['seal', 'paper', 4.5, '종이 위 봉인색 글(장 번호·오류)'],
  ['brassDeep', 'paper', 4.5, '종이 위 짙은 황동(작은 제목·포커스)'],
  ['sealText', 'seal', 4.5, '봉인 버튼 글자'],
  ['sealText', 'sealHover', 4.5, '봉인 버튼 글자(누름 전)'],
  ['dangerDark', 'bg', 4.5, '오류 글 / 어두운 바탕'],
  ['dangerDark', 'study', 4.5, '오류 글 / 서재'],
  ['lineStrong', 'bg', 3, '입력 밑줄 / 어두운 바탕(비텍스트 3:1)'],
  ['lineStrong', 'study', 3, '입력 밑줄 / 서재'],
  ['paperLine', 'paper', 3, '입력 밑줄 / 종이'],
  ['brass', 'study', 3, '포커스 링 / 서재'],
  ['brassDeep', 'paper', 3, '포커스 링 / 종이'],
  ['sealEdge', 'bg', 3, '봉인 버튼 테두리 / 바탕(버튼 경계 3:1)'], ['sealEdge', 'study', 3, '봉인 버튼 테두리 / 서재'],
  ['line', 'bg', 1, '장식 구분선 / 바탕(장식 — 기준 없음)'],
]
let fail = 0
for (const [f, b, min, use] of pairs) {
  const r = ratio(T[f], T[b])
  const ok = r >= min
  if (!ok && min > 1) fail++
  console.log(`${ok ? 'OK ' : 'NG '} ${r.toFixed(2).padStart(5)}  ${T[f]} on ${T[b]}  (${min}:1)  ${use}`)
}
if (fail) { console.log(`\n${fail}건 기준 미달`); process.exitCode = 1 }
