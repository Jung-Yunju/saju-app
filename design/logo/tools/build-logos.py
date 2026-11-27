"""시안 로고 SVG 생성기 (디자인 실장, P5-01 시안 단계)

워드마크 글자는 OFL 글꼴(Hahmlet, Gowun Batang)의 윤곽선을 패스로 바꿔 넣는다.
글꼴이 없는 환경에서도 같은 모양이 나오게 하려는 것이다. 심볼(복자·초승달)은 손으로 쓴 좌표다.

준비: pip install fonttools  (글꼴 파일은 github.com/google/fonts 의 ofl/hahmlet, ofl/gowunbatang)
실행: python build-logos.py <글꼴폴더> <출력폴더>
       글꼴폴더에 Hahmlet.ttf(가변), GowunBatang-Bold.ttf 가 있어야 한다.
심볼은 고정색 배지(어느 바탕에서도 같은 모양). 워드마크만 style="fill:var(--logo-*, 기본값)"
형태라 HTML에 인라인하면 테마 토큰을 따르고, 파일만 열면 기본값(밝은 테마 색)으로 보인다.
"""
import sys, os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.varLib import instancer

FONT_DIR, OUT = sys.argv[1], sys.argv[2]
_cache = {}

def _font(name, wght=None):
    key = (name, wght)
    if key not in _cache:
        f = TTFont(os.path.join(FONT_DIR, name))
        if wght and "fvar" in f:
            f = instancer.instantiateVariableFont(f, {"wght": wght})
        _cache[key] = f
    return _cache[key]

def _num(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s

def text(name, s, size, x, y, tracking=0.0, wght=None):
    """글자열 → (path d, 끝 x). 한글은 커닝 없이 advance만 쓴다."""
    f = _font(name, wght)
    gs, cmap, upm = f.getGlyphSet(), f.getBestCmap(), f["head"].unitsPerEm
    k = size / upm
    pen = SVGPathPen(gs, ntos=_num)
    cx = x
    for ch in s:
        g = cmap[ord(ch)]
        gs[g].draw(TransformPen(pen, (k, 0, 0, -k, cx, y)))
        cx += gs[g].width * k + tracking
    return pen.getCommands(), cx - tracking

def width(name, s, size, tracking=0.0, wght=None):
    return text(name, s, size, 0, 0, tracking, wght)[1]

def write(fn, body):
    with open(os.path.join(OUT, fn), "w", encoding="utf-8") as fp:
        fp.write(body.strip() + "\n")

HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n'

# ── 공통 도안: 복자(턱시도 고양이) 앉은 모습, 고정색 ──────────────────────
CAT = "#0a0c16"; WHITE = "#f6efdf"; EYE = "#f2c14e"; NOSE = "#c4877c"
_SIL = [  # 실루엣(귀·머리·몸·꼬리)
    '<path d="M41 49 L41.5 29 L53 39.5 Z"/>',
    '<path d="M67 49 L66.5 29 L55 39.5 Z"/>',
    '<circle cx="54" cy="51" r="14"/>',
    '<path d="M44.5 60 C38 70 35 84 36 97 L72 97 C73 84 70 70 63.5 60 Z"/>',
]
_TAIL = 'd="M70 95.5 C83 97 91 88 87.5 77" fill="none" stroke-linecap="round"'

def bokja_sitting(rim):
    """viewBox 128 기준. rim = 달빛 테두리(먹색 몸이 어두운 바탕에 묻히지 않게 바깥으로 1.5px)."""
    sil = "".join(_SIL)
    return f'''
  <g fill="none" stroke="{rim}" stroke-width="3" stroke-linejoin="round">{sil}<path {_TAIL} stroke-width="8"/></g>
  <g fill="{CAT}">{sil}</g><path {_TAIL} stroke="{CAT}" stroke-width="5"/>
  <g fill="{WHITE}">
    <path d="M54 43.5 C52.4 48 47.5 51.5 47.5 56 C47.5 60 50.4 62.4 54 62.4 C57.6 62.4 60.5 60 60.5 56 C60.5 51.5 55.6 48 54 43.5 Z"/>
    <path d="M48.5 63 C51.5 66.5 56.5 66.5 59.5 63 L58 82 C56.6 86.5 51.4 86.5 50 82 Z"/>
    <ellipse cx="47.5" cy="96.2" rx="5.2" ry="3"/><ellipse cx="60.5" cy="96.2" rx="5.2" ry="3"/>
  </g>
  <path d="M52.4 54.2 L55.6 54.2 L54 56.3 Z" fill="{NOSE}"/>
  <g fill="{EYE}"><ellipse cx="48.3" cy="50" rx="2.9" ry="3.3"/><ellipse cx="59.7" cy="50" rx="2.9" ry="3.3"/></g>
  <g fill="{CAT}"><ellipse cx="48.3" cy="50" rx="0.95" ry="2.5"/><ellipse cx="59.7" cy="50" rx="0.95" ry="2.5"/></g>'''

# ── A 「달밤 서재」 심볼: 꼬리가 초승달에 닿는 복자 ─────────────────────
A_SYMBOL = HEAD + f'''
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-labelledby="t">
  <title id="t">할머니가 풀어 주는 사주 — 시안 A 심볼(초승달과 복자)</title>
  <defs>
    <mask id="a-moon"><rect width="128" height="128" fill="#fff"/><circle cx="51" cy="57" r="42" fill="#000"/></mask>
  </defs>
  <circle cx="64" cy="64" r="64" fill="#0c1129"/>
  <circle cx="64" cy="64" r="46.5" mask="url(#a-moon)" fill="#d4a847"/>
  <g fill="#d4a847">
    <circle cx="30" cy="30" r="1.6"/><circle cx="22" cy="62" r="1.1"/><circle cx="96" cy="22" r="1.3"/>
    <path d="M27 86 l1.2 3.3 3.3 1.2 -3.3 1.2 -1.2 3.3 -1.2 -3.3 -3.3 -1.2 3.3 -1.2 Z"/>
  </g>
  {bokja_sitting("#d4a847")}
</svg>'''

# ── B 「등잔 아래 찻상」 심볼: 할머니 비녀를 꽂은 복자 얼굴 ────────────────
B_SYMBOL = HEAD + '''
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-labelledby="t">
  <title id="t">할머니가 풀어 주는 사주 — 시안 B 심볼(비녀 꽂은 복자)</title>
  <circle cx="64" cy="64" r="62" fill="#f3eadb" stroke="#221e1b" stroke-width="3"/>
  <!-- 비녀: 오른쪽 귀 뒤로 꽂힘(귀보다 먼저 그림) -->
  <path d="M60 46 L112 22" stroke="#7a5233" stroke-width="4.5" stroke-linecap="round"/>
  <circle cx="111" cy="22.5" r="6" fill="#f2c14e" stroke="#221e1b" stroke-width="2.2"/>
  <g fill="#221e1b" stroke="#221e1b" stroke-width="5" stroke-linejoin="round">
    <path d="M30 56 L33 20 L58 38 Z"/><path d="M98 56 L95 20 L70 38 Z"/>
  </g>
  <g fill="#c9897b"><path d="M36 44 L37.5 29 L48 37 Z"/><path d="M92 44 L90.5 29 L80 37 Z"/></g>
  <ellipse cx="64" cy="72" rx="39" ry="33" fill="#221e1b"/>
  <path d="M64 45 C62 53 56.5 61 53.5 71 C50.5 82 55 94.5 64 94.5 C73 94.5 77.5 82 74.5 71 C71.5 61 66 53 64 45 Z" fill="#fffaf2"/>
  <g fill="#f2c14e"><ellipse cx="44.5" cy="68" rx="7" ry="7.6"/><ellipse cx="83.5" cy="68" rx="7" ry="7.6"/></g>
  <g fill="#221e1b"><ellipse cx="44.5" cy="68.5" rx="2.2" ry="5.6"/><ellipse cx="83.5" cy="68.5" rx="2.2" ry="5.6"/></g>
  <g fill="#fffaf2"><circle cx="46.8" cy="65" r="1.4"/><circle cx="85.8" cy="65" r="1.4"/></g>
  <path d="M60 76.5 L68 76.5 L64 81 Z" fill="#c4877c"/>
  <path d="M64 81 Q61 86 56.5 84 M64 81 Q67 86 71.5 84" fill="none" stroke="#221e1b" stroke-width="1.8" stroke-linecap="round"/>
  <g stroke="#221e1b" stroke-width="1.6" stroke-linecap="round" fill="none">
    <path d="M28 80 L13 77"/><path d="M28 86 L14 89"/><path d="M100 80 L115 77"/><path d="M100 86 L114 89"/>
  </g>
</svg>'''

# ── A 워드마크: 한 줄, Hahmlet. "사주" 위에 금색 초승달 방점 ─────────────
def a_wordmark():
    F = "Hahmlet.ttf"; size = 28; base = 34; gap = 9
    d1, e1 = text(F, "할머니가 풀어 주는", size, 0, base, 0.6, wght=560)
    d2, e2 = text(F, "사주", size, e1 + gap, base, 0.6, wght=780)
    mx = e2 + 6.5; my = 12.5
    W = e2 + 13
    return HEAD + f'''
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -2 {_num(W)} 42" role="img" aria-labelledby="t">
  <title id="t">할머니가 풀어 주는 사주 — 시안 A 워드마크</title>
  <g style="fill:var(--logo-ink,#1b2340)"><path d="{d1}"/><path d="{d2}"/></g>
  <defs><mask id="a-wm-moon"><rect x="0" y="-2" width="{_num(W)}" height="42" fill="#fff"/><circle cx="{_num(mx-2.2)}" cy="{_num(my-1.2)}" r="4.6" fill="#000"/></mask></defs>
  <circle cx="{_num(mx)}" cy="{_num(my)}" r="5" mask="url(#a-wm-moon)" style="fill:var(--logo-gold,#86621f)"/>
</svg>''', W

# ── B 워드마크: 두 줄 가운데 정렬, Gowun Batang Bold. 복자가 "주" 뒤에서 빼꼼 ──
def b_wordmark():
    F = "GowunBatang-Bold.ttf"
    s1, s2 = 17, 46
    w1 = width(F, "할머니가 풀어 주는", s1, 0.8); w2 = width(F, "사주", s2, 1.5)
    W = max(w1, w2) + 40
    x1 = (W - w1) / 2; x2 = (W - (w2 + 22)) / 2
    d1, _ = text(F, "할머니가 풀어 주는", s1, x1, 18, 0.8)
    d2, e2 = text(F, "사주", s2, x2, 70, 1.5)
    # 복자 머리: "주" 오른쪽 어깨 뒤
    hx, hy = e2 + 9, 44
    cat = f'''
  <g style="fill:var(--logo-cat,#221e1b);stroke:var(--logo-rim,#221e1b)" stroke-width="1.6" stroke-linejoin="round">
    <path d="M{_num(hx-9.5)} {_num(hy+2)} L{_num(hx-8.5)} {_num(hy-12)} L{_num(hx-1.5)} {_num(hy-5.5)} Z"/>
    <path d="M{_num(hx+9.5)} {_num(hy+2)} L{_num(hx+8.5)} {_num(hy-12)} L{_num(hx+1.5)} {_num(hy-5.5)} Z"/>
    <path d="M{_num(hx-10.5)} {_num(hy+17.4)} L{_num(hx-10.5)} {_num(hy+3)} A10.5 9 0 0 1 {_num(hx+10.5)} {_num(hy+3)} L{_num(hx+10.5)} {_num(hy+17.4)} Z"/>
  </g>
  <path d="M{_num(hx)} {_num(hy-3)} C{_num(hx-1.5)} {_num(hy+2)} {_num(hx-5)} {_num(hy+4)} {_num(hx-5)} {_num(hy+8)} C{_num(hx-5)} {_num(hy+11)} {_num(hx-2.5)} {_num(hy+12.5)} {_num(hx)} {_num(hy+12.5)} C{_num(hx+2.5)} {_num(hy+12.5)} {_num(hx+5)} {_num(hy+11)} {_num(hx+5)} {_num(hy+8)} C{_num(hx+5)} {_num(hy+4)} {_num(hx+1.5)} {_num(hy+2)} {_num(hx)} {_num(hy-3)} Z" style="fill:var(--logo-white,#fffaf2)"/>
  <g style="fill:var(--logo-eye,#f2c14e)"><circle cx="{_num(hx-5.4)}" cy="{_num(hy+2.6)}" r="2.4"/><circle cx="{_num(hx+5.4)}" cy="{_num(hy+2.6)}" r="2.4"/></g>
  <g style="fill:var(--logo-cat,#221e1b)"><ellipse cx="{_num(hx-5.4)}" cy="{_num(hy+2.8)}" rx="0.8" ry="1.9"/><ellipse cx="{_num(hx+5.4)}" cy="{_num(hy+2.8)}" rx="0.8" ry="1.9"/></g>
  <path d="M{_num(hx-15)} {_num(hy+18.6)} L{_num(hx+14)} {_num(hy+18.6)}" style="stroke:var(--logo-ink,#221e1b)" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M{_num(x2+2)} 80 C{_num(x2+30)} 86 {_num(e2-20)} 86 {_num(e2+4)} 79 C{_num(e2+14)} 76 {_num(e2+15)} 68 {_num(e2+9)} 68" fill="none" style="stroke:var(--logo-ink,#221e1b)" stroke-width="3.2" stroke-linecap="round"/>'''
    return HEAD + f'''
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {_num(W)} 90" role="img" aria-labelledby="t">
  <title id="t">할머니가 풀어 주는 사주 — 시안 B 워드마크</title>
  <g style="fill:var(--logo-ink,#221e1b)"><path d="{d1}"/><path d="{d2}"/></g>{cat}
</svg>''', W

write("a-symbol.svg", A_SYMBOL)
write("b-symbol.svg", B_SYMBOL)
svg, w = a_wordmark(); write("a-wordmark.svg", svg); print("a-wordmark width", round(w, 1))
svg, w = b_wordmark(); write("b-wordmark.svg", svg); print("b-wordmark width", round(w, 1))
