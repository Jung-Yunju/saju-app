/* office/web/art.js — 가상 사무실 픽셀아트 (카드 O-02, 디자인 실장)
 *
 * 형식: office/CONTRACT.md 6절 `window.OFFICE_ART` 그대로.
 *   palette  문자 1개 → "#rrggbb" ("." = 투명)
 *   frames   문자열 배열(h줄 × w글자)
 *
 * 만드는 방식
 *   - 외부 이미지 없음. 이 파일 안의 문자 도안(템플릿)과 작은 그리기 함수로 모든 그림을 만든다.
 *   - 도안은 "역할 문자"(머리색=1, 피부=3, 옷=5 …)로 그리고, 직원별 색표(STAFF)로 바꿔 칠한다.
 *     → 몸 골격은 모두 같고 머리모양·머리색·옷·소품만 다르다.
 *   - 팔레트 문자는 색이 처음 쓰일 때 자동 배정된다. 색을 바꾸려면 아래 C 표만 고친다.
 *   - 같은 프레임은 같은 배열을 다시 참조한다(예: walk 2·4번째 = idle).
 *
 * 화풍: 위에서 내려다보는 2D 픽셀아트, 타일 16px. 기존 게임 그림을 참고·복제하지 않은 독자 도안.
 * 톤: 짙은 남색 + 금색 포인트 + 따뜻한 나무·한지. 붉은 부적·태극 같은 사주 클리셰는 쓰지 않는다.
 * 검사: node office/web/check-art.mjs
 */
(function (root) {
  'use strict';

  /* ───────────────────────── 1. 색 ───────────────────────── */
  var C = {
    ink: '#1b1b24',
    // 남색(밤하늘) 9=가장 어두움
    n9: '#0f1430', n8: '#161d3d', n7: '#1f2a52', n6: '#2b3a6e', n5: '#3e5190', n4: '#5a6fb0',
    // 금색
    g7: '#8f6a22', g6: '#b48a32', g5: '#d4a847', g4: '#e8c66e', g3: '#f5e2a6',
    // 나무
    w9: '#3e2716', w8: '#5a3a22', w7: '#76502f', w6: '#92673c', w5: '#ad804d', w4: '#c79a62', w3: '#dcb782',
    // 한지
    h5: '#f6efdf', h4: '#ece1c7', h3: '#dccdab', h2: '#c4b28b',
    white: '#fbfaf5',
    // 돌·회색
    s5: '#d8d3c8', s4: '#c3bdaf', s3: '#a8a194',
    x8: '#24262c', x7: '#33363e', x6: '#474b55', x5: '#656a75', x4: '#8a8f99', x3: '#b3b7bf',
    // 식물
    v7: '#244a33', v6: '#2f6343', v5: '#3f7d52', v4: '#5c9c66', v3: '#86bd84',
    // 포인트
    mint: '#74c7b3', mintD: '#3e8f7f', plum: '#6b3f7a', plumD: '#47295a',
    coral: '#e0805a', coralD: '#b65d3d', sky: '#5b93cf', skyD: '#3d6ea6',
    teal: '#2f6f6c', tealD: '#1f4c4a', olive: '#5f7340', oliveD: '#42522a',
    violet: '#53458a', violetD: '#382e63', steel: '#3e5c78', steelD: '#2b4156',
    lav: '#9b8ac7', lavD: '#7563a3', ochre: '#cdb07a', ochreD: '#a88c57',
    stone: '#8c8577', stoneD: '#6e685c',
    red: '#cf5a45', green: '#4fae78', greenD: '#327a52',
    mouth: '#8c4a3c', blush: '#eaa596', lens: '#bfe3f0',
    // 피부(4단계, 고정관념 없이 고르게 배정)
    sk1: '#f5d6b8', sk1d: '#e0b18e', sk2: '#e9b892', sk2d: '#cc936d',
    sk3: '#c98d62', sk3d: '#a86f48', sk4: '#8f5b3b', sk4d: '#6f432b',
    // 머리색
    hBlack: '#25222c', hBlackD: '#16141b', hBrown: '#6e4a30', hBrownD: '#4d321f',
    hChest: '#4b2e28', hChestD: '#311d19', hSilver: '#d9d9e2', hSilverD: '#a8a9b9',
    hAsh: '#b99c6c', hAshD: '#937a4e', hAub: '#7c4a2a', hAubD: '#56321b',
    // 고양이(복자)
    cat: '#2b2b35', catH: '#41414f'
  };

  /* ───────────────────── 2. 팔레트 자동 배정 ───────────────────── */
  // "." 은 투명. 문자열에 넣기 곤란한 문자(" ' \ ` 공백)는 쓰지 않는다.
  var POOL = 'kabcdefghijlmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&*+-/:;<=>?@^_~|()[]{},';
  var palette = { '.': null };
  var hexToCh = {};
  var nextCh = 0;
  function pch(hex) {
    if (hex == null) return '.';
    var c = hexToCh[hex];
    if (c) return c;
    c = POOL.charAt(nextCh++);
    if (!c) throw new Error('OFFICE_ART: 팔레트 문자가 모자랍니다(색 수를 줄이세요)');
    hexToCh[hex] = c;
    palette[c] = hex;
    return c;
  }
  pch(C.ink); // 'k' = 외곽선

  /* ───────────────────── 3. 격자 도구 ───────────────────── */
  function grid(w, h) {
    var g = [];
    for (var y = 0; y < h; y++) { var r = []; for (var x = 0; x < w; x++) r.push(null); g.push(r); }
    return g;
  }
  function W(g) { return g[0].length; }
  function H(g) { return g.length; }
  // 도안 찍기: '.' 은 건너뜀. legend[ch] === null 이면 지움(투명).
  function stamp(g, rows, legend, dx, dy) {
    dx = dx || 0; dy = dy || 0;
    for (var y = 0; y < rows.length; y++) {
      var r = rows[y];
      for (var x = 0; x < r.length; x++) {
        var ch = r.charAt(x);
        if (ch === '.') continue;
        if (!(ch in legend)) throw new Error('OFFICE_ART: 도안 문자 "' + ch + '" 의 색이 없습니다');
        var X = x + dx, Y = y + dy;
        if (Y < 0 || Y >= g.length || X < 0 || X >= g[0].length) continue;
        g[Y][X] = legend[ch];
      }
    }
    return g;
  }
  function rect(g, x, y, w, h, col) {
    for (var j = y; j < y + h; j++) for (var i = x; i < x + w; i++) if (g[j] && i >= 0 && i < g[j].length) g[j][i] = col;
    return g;
  }
  function dot(g, x, y, col) { if (g[y] && x >= 0 && x < g[y].length) g[y][x] = col; return g; }
  function hline(g, x, y, w, col) { return rect(g, x, y, w, 1, col); }
  function vline(g, x, y, h, col) { return rect(g, x, y, 1, h, col); }
  function copy(g) { return g.map(function (r) { return r.slice(); }); }
  function flipV(g) { return copy(g).reverse(); }
  function sub(g, x, y, w, h) {
    var o = grid(w, h);
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) o[j][i] = g[y + j][x + i];
    return o;
  }
  // 격자 → 팔레트 문자열 배열
  function emit(g) {
    return g.map(function (r) { return r.map(pch).join(''); });
  }
  // 도안 길이 검사(정확히 w글자). 오타를 불러올 때 바로 잡는다.
  function S(rows, w, name) {
    w = w || 16;
    rows.forEach(function (r, i) {
      if (r.length !== w) throw new Error('OFFICE_ART 도안 ' + (name || '') + ' ' + i + '줄 길이 ' + r.length + ' ≠ ' + w);
    });
    return rows;
  }
  // 덧칠 도안(빈 줄 '' 허용, 짧은 줄은 오른쪽을 '.' 로 채움)
  function O(rows, w, name) {
    w = w || 16;
    return rows.map(function (r, i) {
      if (r.length > w) throw new Error('OFFICE_ART 덧칠 ' + (name || '') + ' ' + i + '줄이 ' + w + '글자보다 깁니다');
      while (r.length < w) r += '.';
      return r;
    });
  }
  function extend(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }

  /* ───────────────────── 4. 공용 도안 문자표 ───────────────────── */
  // 캐릭터 도안: 역할 문자(1~9, w, a, A)는 직원 색표가 채운다.
  var CL = {
    k: C.ink, g: C.g5, G: C.g7, y: C.g4, Y: C.g3, W: C.white, c: C.h5, C: C.h3,
    n: C.n7, N: C.n9, u: C.n5, T: C.w8, t: C.w6, L: C.w4, x: C.x7, X: C.x8, q: C.x5,
    l: C.lens, z: C.mint, Z: C.mintD, m: C.mouth, b: C.blush, v: C.green, p: C.plum,
    o: C.coral, s: C.sky, e: C.v5
  };
  // 타일 도안
  var TL = {
    k: C.ink,
    N: C.n9, n: C.n8, m: C.n7, M: C.n6, u: C.n5, U: C.n4,
    G: C.g7, H: C.g6, g: C.g5, y: C.g4, Y: C.g3,
    '9': C.w9, '8': C.w8, '7': C.w7, '6': C.w6, '5': C.w5, '4': C.w4, '3': C.w3,
    c: C.h5, C: C.h4, d: C.h3, D: C.h2, W: C.white,
    s: C.s5, S: C.s4, t: C.s3,
    x: C.x8, X: C.x7, q: C.x6, Q: C.x5, r: C.x4, R: C.x3,
    v: C.v7, V: C.v6, e: C.v5, E: C.v4, f: C.v3,
    z: C.mint, Z: C.mintD, p: C.plum, P: C.plumD, o: C.coral, O: C.coralD,
    b: C.sky, B: C.skyD, l: C.lens, a: C.red, A: C.green, i: C.lav, j: C.teal,
    _: null
  };

  /* ───────────────────── 5. 캐릭터 골격 ───────────────────── */
  // 머리(앞) 0~11줄. 3=피부 4=피부 그늘 m=입 b=볼
  var HEAD_F = S([
    '................',
    '.....kkkkkk.....',
    '...kk333333kk...',
    '..k3333333333k..',
    '..k3333333333k..',
    '.k333333333333k.',
    '.k333333333333k.',
    '.k333k3333k333k.',
    '.k333k3333k333k.',
    '.k4b33333333b4k.',
    '..k4433mm3344k..',
    '...kkk4444kkk...'
  ], 16, 'HEAD_F');
  // 눈 깜빡임: 7줄 눈을 피부로
  var HEAD_F_BLINK = HEAD_F.slice();
  HEAD_F_BLINK[7] = '.k333333333333k.';
  // 머리(옆, 오른쪽 보기)
  var HEAD_S = S([
    '................',
    '.....kkkkkk.....',
    '...kk333333kk...',
    '..k3333333333k..',
    '..k3333333333k..',
    '.k333333333333k.',
    '.k333333333333k.',
    '.k33333333k333k.',
    '.k33333333k333k.',
    '.k4333333333b3k.',
    '..k44333333m3k..',
    '...kkk44444kk...'
  ], 16, 'HEAD_S');
  // 머리(뒤): 얼굴 자리를 머리카락으로
  var HEAD_B = S([
    '................',
    '.....kkkkkk.....',
    '...kk111111kk...',
    '..k1111111111k..',
    '..k1111111111k..',
    '.k111111111111k.',
    '.k111111111111k.',
    '.k111111111111k.',
    '.k111111111111k.',
    '.k211111111112k.',
    '..k2222222222k..',
    '...kkk4444kkk...'
  ], 16, 'HEAD_B');

  // 몸(앞) — 12줄부터. 5=윗옷 6=윗옷 그늘 7=바지 8=신발 w=깃
  var TORSO_F = [
    '...kk55ww55kk...',
    '..k5k555555k5k..',
    '..k5k555555k5k..',
    '..k6k555555k6k..',
    '..k3k666666k3k..',
    '..kkk777777kkk..'
  ];
  var LEGS_F = {
    idle: ['....k777777k....', '....k77kk77k....', '....k77kk77k....', '....k88kk88k....', '....kkkkkkkk....', '................'],
    stepL: ['....k777777k....', '....k77kk77k....', '....k88kk77k....', '....kkkkk88k....', '........kkkk....', '................'],
    stepR: ['....k777777k....', '....k77kk77k....', '....k77kk88k....', '....k88kkkkk....', '....kkkk........', '................']
  };
  var TORSO_B = [
    '...kk555555kk...',
    '..k5k555555k5k..',
    '..k5k555555k5k..',
    '..k6k555555k6k..',
    '..k3k666666k3k..',
    '..kkk777777kkk..'
  ];
  // 몸(옆, 오른쪽 보기)
  var TORSO_S = {
    mid: ['....kk55w5kk....', '....k556655k....', '....k556655k....', '....k556655k....', '....k663366k....', '....k777777k....'],
    fwd: ['....kk55w5kk....', '....k555665k....', '....k555566k....', '....k555566k....', '....k666633k....', '....k777777k....'],
    back: ['....kk55w5kk....', '....k566555k....', '....k665555k....', '....k665555k....', '....k336666k....', '....k777777k....']
  };
  var LEGS_S = {
    stride: ['...k777kk777k...', '...k77k..k77k...', '..k77k....k77k..', '..k88k....k88k..', '..kkkk....kkkk..', '................'],
    pass: ['.....k7777k.....', '.....k7777k.....', '.....k7777k.....', '.....k8888kk....', '.....kkkkkkk....', '................']
  };
  // 앉은 몸(앞) — 14줄부터 10줄. 다리는 책상 뒤라 그리지 않는다(무릎선까지만).
  var SIT = S([
    '...kk55ww55kk...',
    '..k5k555555k5k..',
    '..k5k555555k5k..',
    '..k6k555555k6k..',
    '..k3k666666k3k..',
    '..kkk777777kkk..',
    '...k77777777k...',
    '...kkkkkkkkkk...',
    '................',
    '................'
  ], 16, 'SIT');
  var TYPE_A = S([
    '...kk55ww55kk...',
    '..k5k555555k5k..',
    '..k5k555555k5k..',
    '..k5k555555k5k..',
    '..k6k666666k6k..',
    '..k6k37777kk6k..',
    '..kkkkkkkk33kk..',
    '..........kkk...',
    '................',
    '................'
  ], 16, 'TYPE_A');
  var TYPE_B = S([
    '...kk55ww55kk...',
    '..k5k555555k5k..',
    '..k5k555555k5k..',
    '..k5k555555k5k..',
    '..k6k666666k6k..',
    '..k6kk77773k6k..',
    '..kk33kkkkkkkk..',
    '...kkk..........',
    '................',
    '................'
  ], 16, 'TYPE_B');
  // 읽기: 책(또는 두루마리)을 가슴 앞에. r=표지 R=표지 그늘 9=장식
  var READ_A = S([
    '...kk55ww55kk...',
    '..k5k555555k5k..',
    '..k5k555555k5k..',
    '..kkkkkkkkkkkk..',
    '..k3rrr99rrr3k..',
    '..k3rrrrrrRR3k..',
    '..kkkkkkkkkkkk..',
    '...k77777777k...',
    '...kkkkkkkkkk...',
    '................'
  ], 16, 'READ_A');
  var READ_B = S([
    '...kk55ww55kk...',
    '..k5k555555k5k..',
    '..kkkkkkkkkkkk..',
    '..k3rrr99rrr3k..',
    '..k3rrrrrrRR3k..',
    '..kkkkkkkkkkkk..',
    '..kkk777777kkk..',
    '...k77777777k...',
    '...kkkkkkkkkk...',
    '................'
  ], 16, 'READ_B');
  // 두루마리 읽기(연구소장): r=한지, R=한지 그늘, 9=축(나무)
  var SCROLL_A = S([
    '...kk55ww55kk...',
    '..k5k555555k5k..',
    '..k5k555555k5k..',
    '.9kkkkkkkkkkkk9.',
    '.9rrrRrrRrrRrr9.',
    '.9rRrrRrrrRrrr9.',
    '.9kkkkkkkkkkkk9.',
    '...k77777777k...',
    '...kkkkkkkkkk...',
    '................'
  ], 16, 'SCROLL_A');
  var SCROLL_B = S([
    '...kk55ww55kk...',
    '..k5k555555k5k..',
    '.9kkkkkkkkkkkk9.',
    '.9rrRrrrRrrRrr9.',
    '.9rrrRrrRrrrRr9.',
    '.9kkkkkkkkkkkk9.',
    '..kkk777777kkk..',
    '...k77777777k...',
    '...kkkkkkkkkk...',
    '................'
  ], 16, 'SCROLL_B');

  /* ───────────────────── 6. 머리모양(덧칠) ───────────────────── */
  // f=앞, s=옆(오른쪽), bx=뒤에서만 보이는 추가분. '.' = 아래 그림 유지
  var HAIR = {
    // 옆가르마 단정형(대표)
    part: {
      f: O(['', '.....kkkkkk.....', '...kk111111kk...', '..k1111111111k..', '..k1111111211k..', '.k111111112211k.', '.k12......2211k.', '.k2..........2k.']),
      s: O(['', '.....kkkkkk.....', '...kk111111kk...', '..k1111111111k..', '..k1111111112k..', '.k111111111122k.', '.k1111112.....k.', '.k111112......k.', '.k21112.......k.', '.k2212........k.', '..k22'])
    },
    // 곱슬 단발(총괄실장)
    curly: {
      f: O(['', '....kkkkkkkk....', '..kk11211211kk..', '.k121112111211k.', '.k211121112111k.', '.k112111211121k.', '.k1.2.1..1.2.1k.', '.k1..........1k.']),
      s: O(['', '....kkkkkkkk....', '..kk11211211kk..', '.k121112111211k.', '.k211121112112k.', '.k11211121112.k.', '.k1211121.2...k.', '.k21112.......k.', '.k1211........k.', '.k21'])
    },
    // 올림머리(사업기획)
    bun: {
      f: O(['......kkkk......', '.....k1121k.....', '...kkk2112kkk...', '..k1111111111k..', '..k1111111111k..', '.k112111111211k.', '.k12........21k.', '.k2..........2k.']),
      s: O(['..kkkk', '.k1121kkkk', '.k1211111kkk', '.kk11111111111k.', '..k1111111112k..', '.k111111111122k.', '.k1111112.....k.', '.k11112.......k.', '.k2112........k.', '.k22'])
    },
    // 부스스한 머리(엔진 개발자)
    messy: {
      f: O(['.....k...k......', '....k1kkk1kk....', '...k111111111k..', '..k1111111111k..', '.k111111111111k.', '.k112111211121k.', '.k1.2...2..2.1k.', '.k1..........1k.']),
      s: O(['....k...k.......', '...k1kkk1kk.....', '..k11111111kk...', '.k11111111111k..', '.k111111111112k.', '.k1121112111.2k.', '.k121112.2....k.', '.k2112........k.', '.k112.........k.', '.k21'])
    },
    // 아주 짧은 머리(품질검증·프론트엔드)
    buzz: {
      f: O(['', '.....kkkkkk.....', '...kk212121kk...', '..k1212121212k..', '..k2121212121k..', '.k2..........2k.']),
      s: O(['', '.....kkkkkk.....', '...kk212121kk...', '..k1212121212k..', '..k21212121..k..', '.k21212.......k.', '.k121.........k.', '.k21'])
    },
    // 묶은 머리(백엔드) — 뒤·옆에서 꽁지가 보인다
    pony: {
      f: O(['', '.....kkkkkk.....', '...kk111111kk...', '..k1111221111k..', '..k1112112111k..', '.k111211112111k.', '.k1121....1211k.', '.k21........12k.', '.k2..........2k.']),
      s: O(['', '.....kkkkkk.....', '...kk111111kk...', '..k1111111111k..', '..k1111111112k..', 'k9111111111122k.', 'k11111112.....k.', 'k1211112......k.', 'k221112.......k.', 'k221', 'k2k', '.kk']),
      bx: O(['', '', '', '', '', '', '', '', '', '', '.......kk.......', '......k99k......', '......k11k......', '......k12k......', '.......kk.......'])
    },
    // 은발 상투형 + 금 비녀(연구소장)
    knot: {
      f: O(['......kkkk..y...', '.....k1121kgg...', '...kk111111kk...', '..k1111111111k..', '..k1111111111k..', '.k111121121111k.', '.k112......211k.', '.k11........11k.', '.k12........21k.', '.k2..........2k.']),
      s: O(['.....kkkk..y', '....k1121kgg', '...kk111111kk...', '..k1111111111k..', '..k1111111112k..', '.k111111111122k.', '.k1111112.....k.', '.k111112......k.', '.k21112.......k.', '.k1212........k.', '..k21', '...k2'])
    },
    // 앞머리 단발(개인화)
    bob: {
      f: O(['', '.....kkkkkk.....', '...kk111111kk...', '..k1111111111k..', '.k111111111111k.', '.k111111111111k.', '.k122222222221k.', '.k11........11k.', '.k11........11k.', '.k12........21k.', '.k22........22k.', '..kk........kk..']),
      s: O(['', '.....kkkkkk.....', '...kk111111kk...', '..k1111111111k..', '.k111111111111k.', '.k111111111111k.', '.k11111111222.k.', '.k1111111.....k.', '.k1111112.....k.', '.k1211122.....k.', '.k22222k', '..kkkkk'])
    },
    // 베레모 아래 짧은 옆머리(디자인 실장)
    side: {
      f: O(['', '.....kkkkkk.....', '...kk111111kk...', '..k1111111111k..', '..k1111111111k..', '.k111111111111k.', '.k112......211k.', '.k11........11k.', '.k21........12k.', '.k2k........k2k.']),
      s: O(['', '.....kkkkkk.....', '...kk111111kk...', '..k1111111111k..', '.k111111111111k.', '.k111111111111k.', '.k1111112.....k.', '.k111112......k.', '.k21112.......k.', '.k2222k.......k.', '..kkkk'])
    },
    // 긴 물결머리(콘텐츠 작가)
    wavy: {
      f: O(['', '.....kkkkkk.....', '...kk111111kk...', '..k1111111111k..', '.k111111111121k.', '.k111211111111k.', '.k1121....1211k.', '.k121......121k.', 'k112........211k', 'k121........121k', 'k12..........21k', 'k21..........12k', 'kk2..........2kk', '.kk..........kk.']),
      s: O(['', '.....kkkkkk.....', '...kk111111kk...', '..k1111111111k..', '.k111111111112k.', '.k11121111112.k.', '.k1121112.....k.', 'k1211212......k.', 'k1121121......k.', 'k121121.......k.', 'k12112', 'k2112k', 'kk22k', '.kkk']),
      bx: O(['', '', '', '', '', '', '', '', '', '', '', '', '..kk11211211kk..', '....k211211k....', '....k121121k....', '.....kkkkkk.....'])
    }
  };

  /* ───────────────────── 7. 모자·안경·헤드폰 ───────────────────── */
  // a=모자 색, A=모자 그늘
  var HATS = {
    beanie: { f: O(['......kAAk......', '....kkaaaakk....', '...kaaaaaaaak...', '..kaAaAaAaAaAk..', '..kAAAAAAAAAAk..', '.kkkkkkkkkkkkkk.']) },
    beret: { f: O(['..........k.....', '...kkkkkkkak....', '.kkaaaaaaaaakk..', 'kaaaaaaaaaaaak..', 'kAaaaaaaaaaaAk..', '.kkAAAAAAAAAAkk.']) },
    cap: {
      f: O(['', '.....kkkkkk.....', '...kkaaaaaakk...', '..kaaaaAaaaaak..', '..kaaaaaaaaaak..', '.kkAAAAAAAAAAkk.', '..kkkkkkkkkkkk..']),
      s: O(['', '.....kkkkkk.....', '...kkaaaaaakk...', '..kaaaaaaaaaak..', '..kaaaaaaaaaakk.', '.kaaaaaaaaaaAAAk', '.kkkkkkkkkkkkkk.']),
      b: O(['', '.....kkkkkk.....', '...kkaaaaaakk...', '..kaaaaAaaaaak..', '..kaaaaaaaaaak..', '.kaaaaaaaaaaaak.', '..kkkkAAAAkkkk..'])
    }
  };
  var GLASSES = {
    round: {
      f: O(['', '', '', '', '', '', '....GGG..GGG....', '...Gl.lGGl.lG...', '...Gl.lGGl.lG...', '....GGG..GGG....']),
      s: O(['', '', '', '', '', '', '..........GG....', '......GGGG.lG...', '.........Gl.G...', '..........GG....'])
    },
    square: {
      f: O(['', '', '', '', '', '', '...kkkkkkkkkk...', '...kl.lkkl.lk...', '...kl.lkkl.lk...', '...kkkkkkkkkk...']),
      s: O(['', '', '', '', '', '', '.........kkkk...', '......kkkk.lk...', '.........kl.k...', '.........kkkk...'])
    }
  };
  // 헤드폰: a=띠, A=귀덮개, z=안쪽
  var PHONES = {
    f: O(['.....kkkkkk.....', '...kkaaaaaakk...', '..ka........ak..', '.ka..........ak.', '.ka..........ak.', '.ka..........ak.', 'kAAk........kAAk', 'kAzk........kzAk', 'kAzk........kzAk', 'kAAk........kAAk', '.kk..........kk.']),
    s: O(['......kk........', '.....kaak.......', '......aa........', '......aa........', '......aa........', '.....kaak.......', '....kAAAAk......', '....kAzzAk......', '....kAzzAk......', '....kAAAAk......', '.....kkkk.......'])
  };

  /* ───────────────────── 8. 옷 덧칠 ───────────────────── */
  // f=앞(몸 0줄 기준), s=옆, b=뒤
  var OUTFIT = {
    suit: {
      f: O(['...kk5w99w5kk...', '....k6w99w6k....', '.....6.99g6.....', '......6996......', '.......99.......']),
      s: O(['........w9......', '.........9......', '.........g......']),
      b: O(['', '.......6........', '.......6........', '.......6........'])
    },
    cardigan: {
      f: O(['...kk5wwww5kk...', '......6ww6......', '......6ww6......', '......6ww6......', '......6ww6......']),
      s: O(['........w.......', '..........w.....', '..........w.....', '..........w.....']),
      b: O([])
    },
    hoodie: {
      f: O(['...kk666666kk...', '......w..w......', '......w..w......', '.....666666.....']),
      s: O(['....kk666wkk....', '..........w.....', '..........w.....']),
      b: O(['...kk666666kk...', '.....666666.....', '......6666......'])
    },
    turtle: {
      f: O(['...kk555555kk...', '......g..g......', '.......gg.......']),
      s: O(['........5.......', '..........g.....']),
      b: O(['...kk555555kk...'])
    },
    robe: {
      f: O(['...kkw5555wkk...', '......w55w......', '.......ww.......', '........w9......', '.........99.....']),
      s: O(['........w.......', '.........w......', '..........w.....', '..........9.....']),
      b: O(['...kk555555kk...'])
    },
    vest: {
      f: O(['', '...w........w...', '...w.....g..w...', '...w........w...']),
      s: O(['', '.......ww.......', '.......ww.g.....', '.......ww.......']),
      b: O(['', '...w........w...', '...w........w...', '...w........w...'])
    },
    blazer: {
      f: O(['...kk5wwww5kk...', '......6ww6......', '.......66.......', '.......g........']),
      s: O(['........w.......', '..........w.....']),
      b: O([])
    },
    tee: {
      f: O(['...kk555555kk...', '', '.......zz.......', '.......zz.......']),
      s: O(['........5.......']),
      b: O([])
    },
    sweater: {
      f: O(['', '', '.....6.66.6.....', '......6..6......']),
      s: O([]),
      b: O(['', '', '.....6.66.6.....'])
    },
    visitor: {
      f: O(['...kk5g55g5kk...', '......g..g......', '......cWWc......', '......cnnc......']),
      s: O(['........g.......', '..........c.....', '..........c.....']),
      b: O(['...kk5g55g5kk...'])
    }
  };

  /* ───────────────────── 9. 손 소품 ───────────────────── */
  // 앞모습은 그림 왼쪽(직원의 오른손), 옆모습은 앞쪽 손. 몸 0줄(=12줄) 기준.
  var PROPS = {
    clipboard: {
      f: O(['', '.kgk', 'kTgTk', 'kcCck', 'kcCc3', 'kccck', 'kkkkk']),
      s: O(['', '', '.........kgk', '........kTgTk', '........3cCck', '........kcCck', '........kkkkk'])
    },
    tablet: {
      f: O(['', '', 'kkkkk', 'kxxvk', 'kxvxk', 'kvxx3', 'kkkkk']),
      s: O(['', '', '', '........kkkkk', '........3xxvk', '........kxvxk', '........kkkkk'])
    },
    mug: {
      f: O(['', '', '', '.kkkk', 'kWWWk', 'kWgW3', '.kkkk']),
      s: O(['', '', '', '.........kkkk', '........3WWWkk', '.........WgWk', '.........kkk'])
    },
    magnifier: {
      f: O(['.kkk', 'kllWk', 'klllk', 'kgllk', '.kkgk', '...3']),
      s: O(['', '..........kkk', '.........klWlk', '.........klllk', '........3gkkk', '.........g'])
    },
    scroll: {
      f: O(['.t', 'kck', 'kCk', 'kck', 'kCk3', 'kck', '.t']),
      s: O(['', '', '.........t', '........kck', '........3Ck', '........kck', '.........t'])
    },
    notebook: {
      f: O(['', '', 'kkkk', 'kpgk', 'kppk', 'kpp3', 'kkkk']),
      s: O(['', '', '', '........kkkk', '........3ppk', '........kpgk', '........kkkk'])
    },
    palette: {
      f: O(['', '', '', '.kkkk', 'kLzpLk', 'kLgLs3', '.kkkk']),
      s: O(['', '', '', '........kkkk', '........3zpLk', '........kLgsk', '.........kkk'])
    },
    brush: {
      f: O(['.kYk', '.kYk', '.kGk', '.kYk', '.kY3', '.kkk', '.kxk', '..k']),
      s: O(['', '.........kYk', '.........kYk', '.........kGk', '........3kYk', '.........kxk', '..........k'])
    }
  };

  /* ───────────────────── 10. 직원 색표 ───────────────────── */
  var SKIN = { 1: [C.sk1, C.sk1d], 2: [C.sk2, C.sk2d], 3: [C.sk3, C.sk3d], 4: [C.sk4, C.sk4d] };
  // read: 앉아서 읽는 물건 색 [표지, 그늘, 장식]. kind 'scroll' 이면 두루마리.
  var STAFF = {
    ceo: { // 대표: 남색 정장 + 금 넥타이·옷깃 핀
      skin: 2, hair: [C.hBlack, C.hBlackD], style: 'part', top: [C.n5, C.n6], collar: C.white, bottom: C.n8, shoes: C.x8,
      accent: C.g5, outfit: 'suit', read: { c: [C.n7, C.n8, C.g5] }
    },
    main: { // 총괄실장: 청록 가디건 + 곱슬머리 + 결재판
      skin: 1, hair: [C.hBrown, C.hBrownD], style: 'curly', top: [C.teal, C.tealD], collar: C.h5, bottom: C.n7, shoes: C.w8,
      accent: C.g5, outfit: 'cardigan', prop: 'clipboard', read: { c: [C.w6, C.w7, C.h5] }
    },
    'business-strategist': { // 사업기획: 올리브 재킷 + 올림머리 + 금테 둥근 안경 + 그래프 태블릿
      skin: 3, hair: [C.hChest, C.hChestD], style: 'bun', glasses: 'round', top: [C.olive, C.oliveD], collar: C.h5, bottom: C.x7, shoes: C.x8,
      accent: C.g5, outfit: 'blazer', prop: 'tablet', read: { c: [C.x7, C.x8, C.green] }
    },
    'saju-engine-developer': { // 엔진 개발자: 보라 후드 + 민트 헤드폰 + 부스스한 머리
      skin: 2, hair: [C.hBlack, C.hBlackD], style: 'messy', phones: true, hat: [C.g5, C.mint], top: [C.violet, C.violetD], collar: C.violet,
      bottom: C.x7, shoes: C.x8, accent: C.mint, outfit: 'hoodie', read: { c: [C.violetD, C.n9, C.mint] }
    },
    'frontend-developer': { // 프론트엔드: 산호색 털모자 + 하늘색 티셔츠(민트 무늬)
      skin: 4, hair: [C.hChest, C.hChestD], style: 'buzz', hatKind: 'beanie', hat: [C.coral, C.coralD], top: [C.sky, C.skyD], collar: C.sky,
      bottom: C.n7, shoes: C.white, accent: C.mint, outfit: 'tee', read: { c: [C.skyD, C.n6, C.white] }
    },
    'backend-developer': { // 백엔드: 짙은 회색 후드 + 사각 안경 + 묶은 머리 + 머그잔
      skin: 3, hair: [C.hBlack, C.hBlackD], style: 'pony', glasses: 'square', top: [C.x6, C.x7], collar: C.x6, bottom: C.n8, shoes: C.x8,
      accent: C.g5, outfit: 'hoodie', prop: 'mug', read: { c: [C.x7, C.x8, C.mint] }
    },
    'qa-security-lead': { // 품질검증: 강철색 조끼 + 금 방패 배지 + 돋보기
      skin: 4, hair: [C.hBlack, C.hBlackD], style: 'buzz', top: [C.steel, C.steelD], collar: C.h4, bottom: C.x7, shoes: C.x8,
      accent: C.g5, outfit: 'vest', prop: 'magnifier', read: { c: [C.h4, C.h2, C.green] }
    },
    'myeongri-research-director': { // 명리학 연구소장: 쪽빛 두루마기 + 흰 동정 + 은발 상투 + 두루마리
      skin: 1, hair: [C.hSilver, C.hSilverD], style: 'knot', top: [C.n6, C.n7], collar: C.white, bottom: C.n7, shoes: C.x8,
      accent: C.g5, outfit: 'robe', prop: 'scroll', read: { kind: 'scroll', c: [C.h5, C.h3, C.w7] }
    },
    'personalization-researcher': { // 개인화 연구원: 연보라 스웨터 + 앞머리 단발 + 수첩
      skin: 2, hair: [C.hBrown, C.hBrownD], style: 'bob', top: [C.lav, C.lavD], collar: C.white, bottom: C.n7, shoes: C.w8,
      accent: C.g5, outfit: 'sweater', prop: 'notebook', read: { c: [C.plum, C.plumD, C.g5] }
    },
    'design-director': { // 디자인 실장: 자두색 베레모 + 검정 터틀넥 + 금 목걸이 + 팔레트
      skin: 3, hair: [C.hBlack, C.hBlackD], style: 'side', hatKind: 'beret', hat: [C.plum, C.plumD], top: [C.x7, C.x8], collar: C.x7,
      bottom: C.x8, shoes: C.w8, accent: C.g5, outfit: 'turtle', prop: 'palette', read: { c: [C.h5, C.h3, C.plum] }
    },
    'content-writer': { // 콘텐츠 작가: 한지색 가디건 + 긴 물결머리 + 붓
      skin: 1, hair: [C.hAub, C.hAubD], style: 'wavy', top: [C.ochre, C.ochreD], collar: C.n6, bottom: C.n7, shoes: C.w8,
      accent: C.g5, outfit: 'cardigan', prop: 'brush', read: { c: [C.h4, C.h2, C.n6] }
    },
    guest: { // 외부 지원 인력: 회색 모자 + 회갈색 재킷 + 방문증
      skin: 2, hair: [C.hBrown, C.hBrownD], style: 'part', hatKind: 'cap', hat: [C.x5, C.x6], top: [C.stone, C.stoneD], collar: C.stone,
      bottom: C.x7, shoes: C.x8, accent: C.g5, outfit: 'visitor', read: { c: [C.h5, C.h3, C.x5] }
    }
  };

  function legendFor(s) {
    var sk = SKIN[s.skin];
    var hat = s.hat || [C.x5, C.x6];
    var rc = s.read.c;
    return extend(CL, {
      '1': s.hair[0], '2': s.hair[1], '3': sk[0], '4': sk[1],
      '5': s.top[0], '6': s.top[1], '7': s.bottom, '8': s.shoes, '9': s.accent, w: s.collar,
      a: hat[0], A: hat[1], r: rc[0], R: rc[1]
    });
  }

  // 머리 한 벌(보는 방향별)
  function drawHead(g, s, L, view, dy, blink) {
    var hair = HAIR[s.style];
    var hk = s.hatKind && HATS[s.hatKind];
    if (view === 'front') {
      stamp(g, blink ? HEAD_F_BLINK : HEAD_F, L, 0, dy);
      stamp(g, hair.f, L, 0, dy);
      if (s.glasses) stamp(g, GLASSES[s.glasses].f, L, 0, dy);
      if (hk) stamp(g, hk.f, L, 0, dy);
      if (s.phones) stamp(g, PHONES.f, L, 0, dy);
    } else if (view === 'side') {
      stamp(g, HEAD_S, L, 0, dy);
      stamp(g, hair.s, L, 0, dy);
      if (s.glasses) stamp(g, GLASSES[s.glasses].s, L, 0, dy);
      if (hk) stamp(g, hk.s || hk.f, L, 0, dy);
      if (s.phones) stamp(g, PHONES.s, L, 0, dy);
    } else {
      stamp(g, HEAD_B, L, 0, dy);
      stamp(g, hair.f, L, 0, dy);
      if (hair.bx) stamp(g, hair.bx, L, 0, dy);
      if (hk) stamp(g, hk.b || hk.f, L, 0, dy);
      if (s.phones) stamp(g, PHONES.f, L, 0, dy);
    }
  }

  function charFrame(s, L, pose) {
    var g = grid(16, 24);
    var of = OUTFIT[s.outfit];
    var prop = s.prop && PROPS[s.prop];
    var view = 'front', hdy = 0, longHairOver = false;
    switch (pose.kind) {
      case 'stand':
        stamp(g, TORSO_F.concat(LEGS_F[pose.legs]), L, 0, 12);
        stamp(g, of.f, L, 0, 12);
        break;
      case 'side':
        view = 'side';
        stamp(g, TORSO_S[pose.arm].concat(LEGS_S[pose.legs]), L, 0, 12);
        stamp(g, of.s, L, 0, 12);
        break;
      case 'back':
        view = 'back';
        stamp(g, TORSO_B.concat(LEGS_F[pose.legs]), L, 0, 12);
        stamp(g, of.b, L, 0, 12);
        break;
      case 'sit':
        hdy = 2;
        stamp(g, pose.body, L, 0, 14);
        stamp(g, of.f, L, 0, 14);
        if (pose.overlay) stamp(g, pose.overlay, L, 0, 14);
        break;
    }
    drawHead(g, s, L, view, hdy, pose.blink);
    if (pose.kind === 'sit' && pose.overlay) stamp(g, pose.overlay, L, 0, 14); // 책은 긴 머리 위로
    if (prop && pose.kind === 'stand') stamp(g, prop.f, L, 0, 12);
    if (prop && pose.kind === 'side') stamp(g, prop.s, L, 0, 12);
    return emit(g);
  }

  function buildCharacter(s) {
    var L = legendFor(s);
    var scroll = s.read.kind === 'scroll';
    var idle = charFrame(s, L, { kind: 'stand', legs: 'idle' });
    var blink = charFrame(s, L, { kind: 'stand', legs: 'idle', blink: true });
    var wl = charFrame(s, L, { kind: 'stand', legs: 'stepL' });
    var wr = charFrame(s, L, { kind: 'stand', legs: 'stepR' });
    var s1 = charFrame(s, L, { kind: 'side', legs: 'stride', arm: 'fwd' });
    var s2 = charFrame(s, L, { kind: 'side', legs: 'pass', arm: 'mid' });
    var s3 = charFrame(s, L, { kind: 'side', legs: 'stride', arm: 'back' });
    var b0 = charFrame(s, L, { kind: 'back', legs: 'idle' });
    var bl = charFrame(s, L, { kind: 'back', legs: 'stepL' });
    var br = charFrame(s, L, { kind: 'back', legs: 'stepR' });
    var sit = charFrame(s, L, { kind: 'sit', body: SIT });
    var sitBlink = charFrame(s, L, { kind: 'sit', body: SIT, blink: true });
    var ta = charFrame(s, L, { kind: 'sit', body: TYPE_A });
    var tb = charFrame(s, L, { kind: 'sit', body: TYPE_B });
    var ra = charFrame(s, L, { kind: 'sit', body: SIT, overlay: scroll ? SCROLL_A : READ_A });
    var rb = charFrame(s, L, { kind: 'sit', body: SIT, overlay: scroll ? SCROLL_B : READ_B });
    return {
      w: 16, h: 24,
      anims: {
        idle: { fps: 2, frames: [idle, idle, idle, blink] },
        walk: { fps: 6, frames: [wl, idle, wr, idle] },
        walkSide: { fps: 6, frames: [s1, s2, s3, s2] },
        walkUp: { fps: 6, frames: [bl, b0, br, b0] },
        sit: { fps: 1, frames: [sit, sit, sit, sitBlink] },
        type: { fps: 6, frames: [ta, tb] },
        read: { fps: 1, frames: [ra, ra, rb, ra] }
      }
    };
  }

  /* ───────────────────── 11. 복자(턱시도 고양이) ───────────────────── */
  // k=외곽 B=검은 털 H=털 윤기 W=흰 털 Y=노란 눈 n=코
  var CATL = { k: C.ink, B: C.cat, H: C.catH, W: C.white, w: C.h3, Y: C.g4, n: C.blush };
  var CAT_SIT = S([
    '................',
    '................',
    '...kk......kk...',
    '...kBk....kBk...',
    '...kBBkkkkBBk...',
    '..kBHBBBBBBBBk..',
    '..kBYYBBBBYYBk..',
    '..kBBBWnnWBBBk..',
    '...kBWWWWWWBk...',
    '...kBBWWWWBBk.k.',
    '..kBHBWWWWBBBkBk',
    '..kBHBWWWWBBBkBk',
    '..kBBBBWWBBBBkBk',
    '..kBWWBBBBWWBBk.',
    '...kkkkkkkkkkk..',
    '................'
  ], 16, 'CAT_SIT');
  function patch(base, rows) { // rows: {줄번호: 문자열}
    var o = base.slice();
    for (var k in rows) o[+k] = S([rows[k]], 16, 'patch ' + k)[0];
    return o;
  }
  var CAT_SIT_TAIL = patch(CAT_SIT, {
    9: '...kBBWWWWBBk...',
    10: '..kBHBWWWWBBBk..',
    11: '..kBHBWWWWBBBkk.',
    12: '..kBBBBWWBBBBkBk',
    13: '..kBWWBBBBWWBBBk',
    14: '...kkkkkkkkkkkk.'
  });
  var CAT_SIT_BLINK = patch(CAT_SIT, { 6: '..kBkkBBBBkkBk..' });
  var CAT_GROOM_A = patch(CAT_SIT, {
    6: '..kBkkBBBBkkBk..',
    7: '..kBBWWnnWBBBk..',
    8: '...kWWWWWWWBk...',
    9: '...kBWWWWWBBk.k.',
    13: '..kBBBBBBBWWBBk.'
  });
  var CAT_GROOM_B = patch(CAT_GROOM_A, {
    7: '..kBBWnnnWBBBk..',
    8: '...kBWWWWWWBk...',
    9: '...kWWWWWWBBk.k.'
  });
  var CAT_STAND = S([
    '................',
    '................',
    '................',
    '...kk......kk...',
    '...kBk....kBk...',
    '...kBBkkkkBBk.k.',
    '..kBHBBBBBBBBkBk',
    '..kBYYBBBBYYBkBk',
    '..kBBBWnnWBBBkBk',
    '...kBWWWWWWBkBk.',
    '..kBHBWWWWBBBkk.',
    '..kBBBBWWBBBBk..',
    '...kWWkBBkWWk...',
    '...kWWk..kWWk...',
    '...kkkk..kkkk...',
    '................'
  ], 16, 'CAT_STAND');
  var CAT_STAND_TAIL = patch(CAT_STAND, {
    4: '...kBk....kBk.k.',
    5: '...kBBkkkkBBkkBk',
    6: '..kBHBBBBBBBBkBk',
    7: '..kBYYBBBBYYBkk.',
    8: '..kBBBWnnWBBBk..',
    9: '...kBWWWWWWBk...'
  });
  var CAT_WALK_L = patch(CAT_STAND, { 13: '...kkkk..kWWk...', 14: '.........kkkk...' });
  var CAT_WALK_R = patch(CAT_STAND, { 13: '...kWWk..kkkk...', 14: '...kkkk.........' });
  var CAT_SIDE = S([
    '................',
    '................',
    '................',
    '...........k.k..',
    '..k.......kBkBk.',
    '.kBk......kBBBBk',
    '.kBk.....kBBBYBk',
    '..kBk....kBBBWnk',
    '...kBkkkkkBBWWk.',
    '....kHHBBBBBWWk.',
    '....kBBBBBBBWWk.',
    '....kBBBBBBBBBk.',
    '...kBBk....kBWk.',
    '..kWWk......kWWk',
    '..kkk.......kkk.',
    '................'
  ], 16, 'CAT_SIDE');
  var CAT_SIDE_PASS = patch(CAT_SIDE, {
    12: '....kBk...kBWk..',
    13: '....kWk...kWWk..',
    14: '....kkk...kkkk..'
  });
  var CAT_SIDE_2 = patch(CAT_SIDE, {
    4: '..........kBkBk.',
    5: '..........kBBBBk',
    6: 'k........kBBBYBk',
    7: 'kBk......kBBBWnk',
    8: '.kBkkkkkkBBBWWk.'
  });
  var CAT_SLEEP = S([
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....kkkkk.k.k..',
    '....kBHHBBkBkBk.',
    '...kBBBBBBBBBBBk',
    '..kBHBBBBBBBkkBk',
    '..kBBBBBBBBBWWWk',
    '..kBBBBBBBBWWWk.',
    '..kBBBBBBBBBBk..',
    '...kkkkkkkkkk...'
  ], 16, 'CAT_SLEEP');
  var CAT_SLEEP_2 = patch(CAT_SLEEP, {
    7: '.....kkkkk.k.k..',
    8: '....kBHHBBkBkBk.',
    9: '...kBBBBBBBBBBBk'
  });
  function catFrame(rows) { return emit(stamp(grid(16, 16), rows, CATL)); }

  /* ───────────────────── 12. 타일·가구 ───────────────────── */
  var T = {}; // key → 격자(여러 프레임이면 배열)
  function legendT(rows, w, name) { return stamp(grid(w || 16, rows.length), S(rows, w || 16, name), TL); }

  // 12-1 바닥
  function planks(base, seam, light, dark) {
    var g = grid(16, 16), joints = [11, 3, 13, 6];
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
      var p = y >> 2, r = y & 3, c = base;
      if (r === 3 || x === joints[p]) c = seam;
      else if (r === 0 && x === (joints[p] + 1) % 16) c = light;
      else if (r === 1 && (x * 5 + p * 3) % 9 === 0) c = light;
      else if (r === 2 && (x * 7 + p * 5) % 13 === 0) c = dark;
      g[y][x] = c;
    }
    return g;
  }
  T.floor_wood = planks(C.w6, C.w7, C.w5, C.w7);
  T.floor_wood_light = planks(C.w4, C.w5, C.w3, C.w5);
  T.floor_carpet = (function () {
    var g = grid(16, 16);
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
      var a = (x + y) % 8 === 0, b = (x - y + 16) % 8 === 0;
      g[y][x] = a && b ? C.g7 : (a || b) ? C.n6 : C.n7;
    }
    return g;
  })();
  T.floor_mat = (function () { // 한지 돗자리: 4×4 결이 번갈아
    var g = grid(16, 16);
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
      var horiz = ((x >> 2) + (y >> 2)) % 2 === 0;
      var line = horiz ? (y % 2 === 1) : (x % 2 === 1);
      g[y][x] = line ? C.h3 : C.h4;
      if (y === 15 || x === 15) g[y][x] = C.h2; // 돗자리 이음선
    }
    return g;
  })();
  T.floor_stone = (function () {
    var g = grid(16, 16);
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
      var q = ((x >> 3) + (y >> 3)) % 2;
      var c = q ? C.s4 : C.s5;
      if (x % 8 === 7 || y % 8 === 7) c = C.s3;
      else if (x % 8 === 0 && y % 8 === 0) c = C.white;
      g[y][x] = c;
    }
    return g;
  })();
  T.floor_rug = (function () { // 한지색 깔개 + 남색 마름모 + 금 점
    var g = grid(16, 16);
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
      var d = Math.abs(x - 7.5) + Math.abs(y - 7.5);
      var c = C.h4;
      if (d >= 4.5 && d < 5.5 && (x + y) % 2 === 0) c = C.h2;
      else if (d < 1) c = C.g6;
      if (x === 0 || y === 0) c = C.h3;
      g[y][x] = c;
    }
    return g;
  })();

  // 12-2 벽
  T.wall = (function () { // 벽 윗면(위에서 본 두께)
    var g = rect(grid(16, 16), 0, 0, 16, 16, C.n8);
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) if ((x * 7 + y * 3) % 13 === 0) g[y][x] = C.n7;
    return g;
  })();
  function faceBase() { // 벽 앞면: 남색 벽지 + 금 별점 + 나무 징두리
    var g = rect(grid(16, 16), 0, 0, 16, 16, C.n7);
    hline(g, 0, 0, 16, C.n9);
    [[5, 3], [12, 7], [2, 8]].forEach(function (p) { dot(g, p[0], p[1], C.g6); });
    [[9, 2], [1, 5], [14, 4]].forEach(function (p) { dot(g, p[0], p[1], C.n6); });
    hline(g, 0, 10, 16, C.w4);
    hline(g, 0, 11, 16, C.w6);
    rect(g, 0, 12, 16, 3, C.w7);
    for (var x = 3; x < 16; x += 8) vline(g, x, 12, 3, C.w8);
    hline(g, 0, 15, 16, C.w9);
    return g;
  }
  T.wall_face = faceBase();
  T.wall_window = stamp(faceBase(), S([
    '................',
    '..444444444444..',
    '..4NNNN66NNNN6..',
    '..4NYNN66NNYY6..',
    '..4NNNN66NNNY6..',
    '..4nNNn66nNNn6..',
    '..466666666666..',
    '..4nnnn66nnnn6..',
    '..4nnyn66nnnn6..',
    '..4MMMM66MMMM6..',
    '..666666666666..',
    '.33333333333333.'
  ], 16, 'window'), TL);
  T.wall_window2 = stamp(faceBase(), S([
    '................',
    '..444444444444..',
    '..4NNNN66NNNN6..',
    '..4NNNy66NNNN6..',
    '..4NNNN66NYNN6..',
    '..4nYNn66nNNn6..',
    '..466666666666..',
    '..4nnnn66nnyn6..',
    '..4nunn66nnnn6..',
    '..4MMMM66MMMM6..',
    '..666666666666..',
    '.33333333333333.'
  ], 16, 'window2'), TL);
  T.wall_moon = (function () { // 둥근 달창(한지 창살, 안쪽이 따뜻하게 빛남)
    var g = faceBase();
    for (var y = 0; y < 12; y++) for (var x = 0; x < 16; x++) {
      var d = Math.sqrt(Math.pow(x + 0.5 - 8, 2) + Math.pow(y + 0.5 - 6, 2));
      if (d <= 4.6) g[y][x] = (x % 3 === 1 || y % 3 === 0) ? C.w6 : (d < 2.5 ? C.g3 : C.h4);
      else if (d <= 5.8) g[y][x] = (x + y > 14) ? C.w7 : C.w5;
    }
    return g;
  })();
  T.wall_clock = (function () {
    var g = faceBase();
    for (var y = 0; y < 11; y++) for (var x = 0; x < 16; x++) {
      var d = Math.sqrt(Math.pow(x + 0.5 - 8, 2) + Math.pow(y + 0.5 - 5.5, 2));
      if (d <= 3.4) g[y][x] = C.h5;
      else if (d <= 4.4) g[y][x] = C.g5;
      else if (d <= 5.0) g[y][x] = C.ink;
    }
    vline(g, 8, 3, 3, C.ink); hline(g, 8, 5, 2, C.ink); dot(g, 8, 5, C.g7);
    return g;
  })();
  T.wall_shelf = stamp(faceBase(), S([
    '................',
    '................',
    '................',
    '....kk..........',
    '...kVEk...kkk...',
    '...kVVk..kWWWkk.',
    '..kkkkk..kWgWkk.',
    '..kHgHk..kWWWk..',
    '.555555555555555',
    '.777777777777777',
    '..8..........8..'
  ], 16, 'shelf'), TL);
  // 2칸 그림: 먹 산수화(달과 산)
  (function () {
    var g = rect(grid(32, 16), 0, 0, 32, 16, null);
    var fa = faceBase(), fb = faceBase();
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) { g[y][x] = fa[y][x]; g[y][x + 16] = fb[y][x]; }
    rect(g, 2, 1, 28, 9, C.g6); rect(g, 3, 2, 26, 7, C.h5);
    var peaks = [[8, 3.2], [17, 2.4], [25, 4]];
    for (var x = 3; x < 29; x++) {
      var top = 99; peaks.forEach(function (p) { top = Math.min(top, p[1] + Math.abs(x - p[0]) * 0.7); });
      for (var y = Math.ceil(top) + 2; y < 9; y++) g[y][x] = y < top + 4 ? C.x5 : C.n7;
    }
    rect(g, 22, 3, 2, 2, C.g4); dot(g, 22, 3, C.g3);
    hline(g, 2, 10, 28, C.g7);
    T.wall_art_l = sub(g, 0, 0, 16, 16); T.wall_art_r = sub(g, 16, 0, 16, 16);
  })();
  // 2칸 화이트보드
  (function () {
    var g = grid(32, 16), fa = faceBase();
    for (var y = 0; y < 16; y++) for (var x = 0; x < 32; x++) g[y][x] = fa[y][x % 16];
    rect(g, 1, 1, 30, 10, C.x3); rect(g, 2, 2, 28, 8, C.white);
    hline(g, 4, 3, 8, C.n6); hline(g, 4, 5, 11, C.n5); hline(g, 4, 7, 6, C.n6);
    for (var i = 0; i < 6; i++) dot(g, 15 + i * 2, 8 - i, C.mintD), dot(g, 16 + i * 2, 8 - i, C.mintD);
    rect(g, 24, 3, 4, 4, C.g4); hline(g, 25, 4, 2, C.g7);
    hline(g, 3, 11, 26, C.x5); dot(g, 6, 11, C.mint); dot(g, 8, 11, C.n5); dot(g, 9, 11, C.g5);
    T.whiteboard_l = sub(g, 0, 0, 16, 16); T.whiteboard_r = sub(g, 16, 0, 16, 16);
  })();
  // 2칸 무드보드(디자인실): 한지 판 + 색 견본
  (function () {
    var g = grid(32, 16), fa = faceBase();
    for (var y = 0; y < 16; y++) for (var x = 0; x < 32; x++) g[y][x] = fa[y][x % 16];
    rect(g, 1, 1, 30, 10, C.w6); rect(g, 2, 2, 28, 8, C.h3);
    var sw = [C.n6, C.g5, C.mint, C.plum, C.coral, C.sky, C.v5, C.h5];
    sw.forEach(function (c, i) { var x = 3 + (i % 4) * 4, y = 3 + (i >> 2) * 4; rect(g, x, y, 3, 3, c); dot(g, x + 1, y - 1, C.ink); });
    rect(g, 20, 3, 8, 6, C.h5); hline(g, 21, 5, 5, C.n5); hline(g, 21, 7, 3, C.n5); dot(g, 26, 7, C.g5);
    T.pinboard_l = sub(g, 0, 0, 16, 16); T.pinboard_r = sub(g, 16, 0, 16, 16);
  })();

  // 12-3 문
  T.door = (function () { // 가로벽의 문(열린 문틀, 위에서)
    var g = grid(16, 16);
    var fl = planks(C.w5, C.w6, C.w4, C.w6);
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) g[y][x] = fl[y][x];
    rect(g, 0, 0, 2, 16, C.w8); rect(g, 14, 0, 2, 16, C.w8);
    vline(g, 2, 0, 16, C.ink); vline(g, 13, 0, 16, C.ink);
    hline(g, 3, 7, 10, C.g6); hline(g, 3, 8, 10, C.g7);
    return g;
  })();
  T.door_side = (function () { // 세로벽의 문(정문)
    var g = grid(16, 16), fl = T.floor_stone;
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) g[y][x] = fl[y][x];
    rect(g, 0, 0, 16, 2, C.w8); rect(g, 0, 14, 16, 2, C.w8);
    hline(g, 0, 2, 16, C.ink); hline(g, 0, 13, 16, C.ink);
    vline(g, 7, 3, 10, C.g6); vline(g, 8, 3, 10, C.g7);
    return g;
  })();

  // 12-4 책상(한 칸 = 한 조각, 옆 조각과 이어짐)
  function desk(side, top, topD, edge, front, frontD) { // side: 'l'|'r'|'m'|'one'
    top = top || C.w5; topD = topD || C.w6; edge = edge || C.w4; front = front || C.w7; frontD = frontD || C.w8;
    var g = grid(16, 16);
    rect(g, 0, 0, 16, 1, C.ink);
    rect(g, 0, 1, 16, 9, top);
    for (var x = 0; x < 16; x++) if ((x * 5) % 11 === 2) dot(g, x, 3 + (x % 5), topD);
    hline(g, 0, 10, 16, edge);
    hline(g, 0, 11, 16, C.ink);
    rect(g, 0, 12, 16, 3, front);
    hline(g, 0, 13, 16, frontD);
    var L = side === 'l' || side === 'one', R = side === 'r' || side === 'one';
    if (L) { vline(g, 0, 0, 15, C.ink); rect(g, 1, 15, 2, 1, C.ink); }
    if (R) { vline(g, 15, 0, 15, C.ink); rect(g, 13, 15, 2, 1, C.ink); }
    if (!L && !R) { /* 가운데 */ }
    return g;
  }
  var MONITOR_BACK = S([
    '....zzzzzzzz....',
    '...kkkkkkkkkk...',
    '...kXXXXXXXXk...',
    '...kXXXXXXXXk...',
    '...kXXXggXXXk...',
    '...kXXXXXXXXk...',
    '...kkkkkkkkkk...',
    '.......kk.......',
    '.....kqqqqk.....',
    '.....kkkkkk.....'
  ], 16, 'monitor_back');
  T.desk_monitor = stamp(desk('l'), MONITOR_BACK, TL);
  T.desk = desk('one');
  T.desk_papers = stamp(desk('r'), S([
    '................',
    '....kkkkkkk.....',
    '...kcccccck.....',
    '...kcdddcckk....',
    '...kccccccWk....',
    '...kcdddccWk....',
    '...kkkkkkkkk....',
    '.....kHk........',
    '................',
    '................'
  ], 16, 'papers'), TL);
  T.desk_books = stamp(desk('r'), S([
    '................',
    '................',
    '...kkkkkkkkk....',
    '...kMMMMMMgk....',
    '..kkkkkkkkkkk...',
    '..kpppppppHpk...',
    '...kkkkkkkkkk...',
    '...kVVVVVVgVk...',
    '...kkkkkkkkkk...',
    '................'
  ], 16, 'books'), TL);
  T.desk_books_main = stamp(desk('l'), S([
    '................',
    '..kkkkk.........',
    '..kcdck.kkkkkk..',
    '..kcdck.kccccck.',
    '..kcdck.kcdddck.',
    '..kkkkk.kccccck.',
    '........kcdddck.',
    '........kkkkkkk.',
    '................',
    '................'
  ], 16, 'books_main'), TL);
  T.desk_mug = stamp(desk('r'), S([
    '................',
    '................',
    '.....kkkk.......',
    '....kWWWWk......',
    '....kWgWWkk.....',
    '....kWWWWk.k....',
    '....kWWWWkk.....',
    '.....kkkk..kkk..',
    '...........kzk..',
    '................'
  ], 16, 'mug'), TL);
  T.desk_plant = stamp(desk('r'), S([
    '................',
    '.....kk.kk......',
    '....kEEkEEk.....',
    '...kEeEEeEEk....',
    '....kVeEeVk.....',
    '.....kVVVk......',
    '.....kccck......',
    '.....kcHck......',
    '......kkk.......',
    '................'
  ], 16, 'plantdesk'), TL);
  T.desk_ink = stamp(desk('r'), S([
    '................',
    '.kkkkkkk........',
    '.kcccccck.......',
    '.kcmcmcck..kkk..',
    '.kcmcmcck.kXXXk.',
    '.kcmcccck.kXxXk.',
    '.kkkkkkkk.kXXXk.',
    '..44444kk..kkk..',
    '................',
    '................'
  ], 16, 'ink'), TL);
  T.desk_palette = stamp(desk('r'), S([
    '................',
    '..kkkkkk...kk...',
    '.k444444k..k4k..',
    'k4zz4pp44k.k4k..',
    'k4gg444kkk.k4k..',
    'k4oo4bb4k..kkk..',
    '.k444444k..kZk..',
    '..kkkkkk...kkk..',
    '................',
    '................'
  ], 16, 'palette'), TL);
  T.desk_scroll = stamp(desk('r'), S([
    '................',
    '................',
    '.8kkkkkkkkkkkk8.',
    '.8ccmcmccmcmcc8.',
    '.8ccmcmccmcccc8.',
    '.8ccmcccHccmcc8.',
    '.8kkkkkkkkkkkk8.',
    '................',
    '................',
    '................'
  ], 16, 'scrolldesk'), TL);

  // 대표 책상(3칸): 호두나무 + 금 테두리
  (function () {
    var g = grid(48, 16);
    rect(g, 0, 0, 48, 1, C.ink);
    rect(g, 0, 1, 48, 9, C.w8);
    for (var x = 0; x < 48; x++) if ((x * 7) % 13 === 3) dot(g, x, 2 + (x % 6), C.w7);
    hline(g, 0, 10, 48, C.g5);
    hline(g, 0, 11, 48, C.ink);
    rect(g, 0, 12, 48, 3, C.w9);
    for (var x2 = 3; x2 < 45; x2 += 3) dot(g, x2, 13, C.g6);
    vline(g, 0, 0, 15, C.ink); vline(g, 47, 0, 15, C.ink);
    rect(g, 1, 15, 2, 1, C.ink); rect(g, 45, 15, 2, 1, C.ink);
    // 서류함
    stamp(g, S(['kkkkkkkkk', 'kccccccck', 'kcdddddck', 'kcccccWck', 'kcdddddck', 'kkkkkkkkk'], 9, 'tray'), TL, 3, 2);
    // 가죽 받침 + 명패
    rect(g, 14, 2, 20, 7, C.n6); rect(g, 15, 3, 18, 5, C.n5);
    rect(g, 19, 7, 10, 3, C.g5); hline(g, 20, 8, 8, C.g7); hline(g, 19, 7, 10, C.g4);
    // 만년필 꽂이
    stamp(g, S(['..k..', '..g..', '.kgk.', 'kXXXk', 'kkkkk'], 5, 'pen'), TL, 36, 3);
    T.ceo_desk_l = sub(g, 0, 0, 16, 16); T.ceo_desk_m = sub(g, 16, 0, 16, 16); T.ceo_desk_r = sub(g, 32, 0, 16, 16);
  })();

  // 12-5 의자
  T.chair = legendT([
    '................',
    '...kkkkkkkkkk...',
    '..kMMMMMMMMMMk..',
    '..kMuuuuuuuuMk..',
    '..kMMMMMMMMMMk..',
    '...kkkkkkkkkk...',
    '...kmmmmmmmmk...',
    '..kmMMMMMMMMmk..',
    '..kmMMMMMMMMmk..',
    '..kmMMMMMMMMmk..',
    '..kmmmmmmmmmmk..',
    '...kkkkkkkkkk...',
    '.......XX.......',
    '....XXXXXXXX....',
    '...kX..XX..Xk...',
    '................'
  ], 16, 'chair');
  T.chair_meet = legendT([
    '................',
    '...kkkkkkkkkk...',
    '...k66666666k...',
    '...k6k6kk6k6k...',
    '...k66666666k...',
    '...kkkkkkkkkk...',
    '..k5555555555k..',
    '..k5MMMMMMMM5k..',
    '..k5MuuuuuuM5k..',
    '..k5MMMMMMMM5k..',
    '..k5555555555k..',
    '..kkkkkkkkkkkk..',
    '..k7k......k7k..',
    '..kkk......kkk..',
    '................',
    '................'
  ], 16, 'chair_meet');
  T.chair_meet_s = flipV(T.chair_meet);

  // 12-6 회의 탁자(4×2칸)
  (function () {
    var g = grid(64, 32);
    rect(g, 0, 1, 64, 1, C.ink);
    rect(g, 0, 2, 64, 23, C.w6);
    for (var y = 3; y < 25; y += 3) for (var x = (y * 5) % 7; x < 64; x += 9) dot(g, x, y, C.w7);
    // 금 상감 테두리
    hline(g, 3, 4, 58, C.g6); hline(g, 3, 22, 58, C.g6); vline(g, 3, 4, 19, C.g6); vline(g, 60, 4, 19, C.g6);
    // 한지 띠
    rect(g, 20, 9, 24, 9, C.h4); hline(g, 20, 9, 24, C.h3); hline(g, 20, 17, 24, C.h3);
    // 찻잔 둘 + 작은 화병
    stamp(g, S(['.kkk.', 'kWWWk', 'kWgWk', '.kkk.'], 5, 'cup'), TL, 23, 11);
    stamp(g, S(['.kkk.', 'kWWWk', 'kWgWk', '.kkk.'], 5, 'cup'), TL, 36, 11);
    stamp(g, S(['..kk..', '.kEEk.', 'kEeeEk', '.kMMk.', '.kMMk.', '..kk..'], 6, 'vase'), TL, 29, 10);
    hline(g, 0, 25, 64, C.w4);
    hline(g, 0, 26, 64, C.ink);
    rect(g, 0, 27, 64, 3, C.w8);
    hline(g, 0, 28, 64, C.w9);
    vline(g, 0, 1, 29, C.ink); vline(g, 63, 1, 29, C.ink);
    rect(g, 1, 30, 3, 2, C.ink); rect(g, 60, 30, 3, 2, C.ink);
    T.table_tl = sub(g, 0, 0, 16, 16); T.table_t1 = sub(g, 16, 0, 16, 16); T.table_t2 = sub(g, 32, 0, 16, 16); T.table_tr = sub(g, 48, 0, 16, 16);
    T.table_bl = sub(g, 0, 16, 16, 16); T.table_b1 = sub(g, 16, 16, 16, 16); T.table_b2 = sub(g, 32, 16, 16, 16); T.table_br = sub(g, 48, 16, 16, 16);
  })();

  // 12-7 소파(3칸, 남색 벨벳 + 금 단추)
  (function () {
    var g = grid(48, 16);
    rect(g, 1, 1, 46, 6, C.n6); hline(g, 1, 1, 46, C.n5);
    for (var x = 6; x < 44; x += 6) dot(g, x, 3, C.g6), dot(g, x + 3, 5, C.g6);
    rect(g, 1, 7, 46, 6, C.n5); hline(g, 1, 7, 46, C.n4);
    vline(g, 16, 7, 6, C.n6); vline(g, 32, 7, 6, C.n6);
    rect(g, 0, 2, 4, 12, C.n7); rect(g, 44, 2, 4, 12, C.n7); hline(g, 0, 2, 4, C.n6); hline(g, 44, 2, 4, C.n6);
    rect(g, 1, 13, 46, 2, C.n7);
    // 외곽선
    hline(g, 1, 0, 46, C.ink); hline(g, 0, 15, 48, C.ink);
    vline(g, 0, 1, 15, C.ink); vline(g, 47, 1, 15, C.ink);
    vline(g, 4, 7, 7, C.ink); vline(g, 43, 7, 7, C.ink);
    dot(g, 3, 15, C.w8); dot(g, 44, 15, C.w8);
    T.sofa_l = sub(g, 0, 0, 16, 16); T.sofa_m = sub(g, 16, 0, 16, 16); T.sofa_r = sub(g, 32, 0, 16, 16);
  })();

  T.table_low = legendT([
    '................',
    '................',
    '................',
    '.kkkkkkkkkkkkkk.',
    '.k555555555555k.',
    '.k5kkkk555kkk5k.',
    '.k5kccck55kWk5k.',
    '.kkcMccck5kgk5k.',
    '.k5kccck55kkk5k.',
    '.k55kkk555kkk5k.',
    '.k5555555kWk55k.',
    '.k444444444444k.',
    '.kkkkkkkkkkkkkk.',
    '.k777777777777k.',
    '.kk..........kk.',
    '................'
  ], 16, 'table_low');
  T.cushion = legendT([
    '................',
    '................',
    '................',
    '...kkkkkkkkkk...',
    '..kgMMMMMMMMgk..',
    '..kMMuuuuuuMMk..',
    '..kMuMMMMMMuMk..',
    '..kMuMMggMMuMk..',
    '..kMuMMggMMuMk..',
    '..kMuMMMMMMuMk..',
    '..kMMuuuuuuMMk..',
    '..kgMMMMMMMMgk..',
    '...kkkkkkkkkk...',
    '................',
    '................',
    '................'
  ], 16, 'cushion');
  T.cat_bed = legendT([
    '................',
    '................',
    '................',
    '................',
    '................',
    '....kkkkkkkk....',
    '..kk56565656kk..',
    '.k565666666565k.',
    '.k56cccccccc65k.',
    'k56cccdddcccc65k',
    'k56ccddddddcc65k',
    'k56cccddddccc65k',
    '.k56cccccccc65k.',
    '.k565666666565k.',
    '..kk56565656kk..',
    '....kkkkkkkk....'
  ], 16, 'cat_bed');

  // 12-8 휴게실 조리대
  function counter() {
    var g = grid(16, 16);
    hline(g, 0, 0, 16, C.ink);
    rect(g, 0, 1, 16, 9, C.s5);
    for (var x = 0; x < 16; x++) if (x % 5 === 2) dot(g, x, 4 + (x % 3), C.s4);
    hline(g, 0, 10, 16, C.s4);
    hline(g, 0, 11, 16, C.ink);
    rect(g, 0, 12, 16, 3, C.w7);
    vline(g, 7, 12, 3, C.w8); dot(g, 5, 13, C.g6); dot(g, 9, 13, C.g6);
    hline(g, 0, 15, 16, C.w9);
    return g;
  }
  T.counter = counter();
  T.coffee = stamp(counter(), S([
    '...kkkkkkkkkk...',
    '...kXXXXXXXXk...',
    '...kXzXXXgXXk...',
    '...kXXXXXXXXk...',
    '...kkkkkkkkkk...',
    '...kXk.kk.kXk...',
    '...kXk....kXk...',
    '...kXk.kkkkXk...',
    '...kXk.kWWkkk...',
    '...kkkkkkkkkk...'
  ], 16, 'coffee'), TL);
  T.counter_tea = stamp(counter(), S([
    '................',
    '..kkk...........',
    '.klllk..kkkk....',
    '.klVlk.kcccck...',
    '.kVVVk.kcMMck...',
    '.kVVVk.kcMMck.k.',
    '.kkkkk.kcccckWk.',
    '........kkkk.k..',
    '................',
    '................'
  ], 16, 'tea'), TL);

  // 12-9 화분
  T.plant = legendT([
    '......kk..kk....',
    '.....kEEkkEEk...',
    '...kkEeeEEeEk...',
    '..kEEeEVeEeVEk..',
    '.kEeeVEeVeEeVEk.',
    '.kEVeVeeVEVeeVk.',
    '..kVeeVVeVeVVk..',
    '.kEeVVeVVeVVeEk.',
    '.kVvVVvVVvVVvVk.',
    '..kvVvVvvVvVvk..',
    '...kkvvVvvVkk...',
    '....kggggggk....',
    '....kMMMMMMk....',
    '....kMuMMMMk....',
    '.....kMMMMk.....',
    '......kkkk......'
  ], 16, 'plant');
  T.plant2 = legendT([
    '......k.........',
    '..k..kEk...k....',
    '.kEk.kEk..kEk...',
    '.kek.kek..kek...',
    '.kek.kek.kEek...',
    '..kVkkVk.kVek...',
    '..kVekVekkVek...',
    '...kVeVekVek....',
    '...kVVeVVeVk....',
    '....kVVVVVk.....',
    '...kkkkkkkkk....',
    '...kcccccccck...',
    '...kcMMMMMMck...',
    '...kcccccccck...',
    '....kcccccck....',
    '.....kkkkkk.....'
  ], 16, 'plant2');

  // 12-10 책장·두루마리장·이젤·서버(2칸 높이 → 위/아래 조각)
  (function () {
    var g = grid(16, 32), spines = [C.n6, C.g6, C.v5, C.plum, C.w4, C.h4, C.teal, C.n5];
    rect(g, 0, 0, 16, 32, C.w7);
    rect(g, 2, 2, 12, 28, C.w9);
    [2, 9, 16, 23].forEach(function (top, b) {
      for (var x = 2; x < 14; x++) {
        var c = spines[(x * 3 + b * 5) % spines.length];
        var t0 = top + ((x * 5 + b) % 3 === 0 ? 1 : 0);
        if ((x + b) % 6 === 5) continue; // 빈틈
        vline(g, x, t0, top + 6 - t0, c);
        if ((x + b) % 4 === 0) dot(g, x, top + 3, C.g4);
      }
      hline(g, 1, top + 6, 14, C.w5);
    });
    vline(g, 0, 0, 32, C.ink); vline(g, 15, 0, 32, C.ink); hline(g, 0, 0, 16, C.ink); hline(g, 0, 31, 16, C.ink);
    hline(g, 1, 1, 14, C.w5);
    T.bookshelf_top = sub(g, 0, 0, 16, 16); T.bookshelf_bot = sub(g, 0, 16, 16, 16);
  })();
  (function () { // 두루마리장: 칸마다 두루마리 끝(둥근 단면)
    var g = grid(16, 32);
    rect(g, 0, 0, 16, 32, C.w8);
    for (var cy = 0; cy < 4; cy++) for (var cx = 0; cx < 3; cx++) {
      var x0 = 1 + cx * 5, y0 = 2 + cy * 7;
      rect(g, x0, y0, 4, 6, C.w9);
      stamp(g, S(['.kk.', 'kcCk', 'kCck', '.kk.'], 4, 'scr'), TL, x0, y0 + ((cx + cy) % 2 ? 2 : 1));
      if ((cx + cy) % 3 === 0) stamp(g, S(['.kk.', 'kdHk', '.kk.'], 4, 'scr2'), TL, x0, y0 + 3);
    }
    vline(g, 0, 0, 32, C.ink); vline(g, 15, 0, 32, C.ink); hline(g, 0, 0, 16, C.ink); hline(g, 0, 31, 16, C.ink);
    hline(g, 1, 1, 14, C.w6);
    T.scroll_top = sub(g, 0, 0, 16, 16); T.scroll_bot = sub(g, 0, 16, 16, 16);
  })();
  (function () { // 이젤 + 밤하늘 그림
    var g = grid(16, 32);
    // 다리
    for (var y = 4; y < 31; y++) { dot(g, 4 - ((y - 4) >> 3), y, C.w6); dot(g, 11 + ((y - 4) >> 3), y, C.w6); }
    vline(g, 8, 2, 27, C.w7);
    // 캔버스
    rect(g, 2, 3, 12, 14, C.ink); rect(g, 3, 4, 10, 12, C.n7);
    rect(g, 3, 12, 10, 4, C.n6);
    for (var x = 3; x < 13; x++) dot(g, x, 11 + ((x * 3) % 3 === 0 ? 0 : 1), C.mintD);
    rect(g, 8, 6, 3, 3, C.g4); dot(g, 8, 6, C.n7); dot(g, 5, 5, C.g3); dot(g, 11, 10, C.g3);
    hline(g, 1, 17, 14, C.w5); hline(g, 1, 18, 14, C.w7);
    dot(g, 3, 17, C.coral); dot(g, 5, 17, C.mint); dot(g, 12, 17, C.g5);
    T.easel_top = sub(g, 0, 0, 16, 16); T.easel_bot = sub(g, 0, 16, 16, 16);
  })();
  (function () { // 서버 장(불빛 2프레임)
    function rack(phase) {
      var g = grid(16, 32);
      rect(g, 1, 0, 14, 31, C.x7);
      for (var u = 0; u < 6; u++) {
        var y = 2 + u * 5;
        rect(g, 2, y, 12, 4, C.x8);
        hline(g, 3, y + 1, 6, C.x6);
        dot(g, 11, y + 1, (u + phase) % 2 ? C.mint : C.mintD);
        dot(g, 12, y + 2, (u + phase) % 3 ? C.g5 : C.g7);
      }
      vline(g, 1, 0, 31, C.ink); vline(g, 14, 0, 31, C.ink); hline(g, 1, 0, 14, C.ink); hline(g, 1, 30, 14, C.ink);
      rect(g, 2, 31, 2, 1, C.ink); rect(g, 12, 31, 2, 1, C.ink);
      return g;
    }
    var a = rack(0), b = rack(1);
    T.server_top = [sub(a, 0, 0, 16, 16), sub(b, 0, 0, 16, 16)];
    T.server_bot = [sub(a, 0, 16, 16, 16), sub(b, 0, 16, 16, 16)];
  })();

  // 12-11 한지 등(연구실)
  T.lamp_hanji = legendT([
    '................',
    '.....kkkkkk.....',
    '....k666666k....',
    '....kYcYcYck....',
    '....k666666k....',
    '....kcYcYcYk....',
    '....k666666k....',
    '....kYcYcYck....',
    '....k666666k....',
    '.....kkkkkk.....',
    '.......77.......',
    '.......77.......',
    '.......77.......',
    '.....kk77kk.....',
    '....k888888k....',
    '.....kkkkkk.....'
  ], 16, 'lamp');

  // 12-12 따로 쓰는 작은 그림(투명 배경)
  T.bell = [legendT([
    '................', '................', '................', '................', '................', '................',
    '.......kk.......',
    '.......gk.......',
    '.....kkkkkk.....',
    '....kyggggGk....',
    '...kyggggggGk...',
    '...kgggggggGk...',
    '..kkkkkkkkkkkk..',
    '..kXXXXXXXXXXk..',
    '...kkkkkkkkkk...',
    '................'
  ], 16, 'bell'), legendT([
    '................', '................', '................', '................',
    '..Y..........Y..',
    '...Y........Y...',
    '.......kk.......',
    '.Y.....gk.....Y.',
    '.....kkkkkk.....',
    '....kyggggGk....',
    '...kyggggggGk...',
    '...kgggggggGk...',
    '..kkkkkkkkkkkk..',
    '..kXXXXXXXXXXk..',
    '...kkkkkkkkkk...',
    '................'
  ], 16, 'bell2')];
  T.papers = legendT([
    '................', '................', '................', '................',
    '....kkkkkkkk....',
    '...kcccccccck...',
    '...kcdddddcck...',
    '..kkccccccccck..',
    '..kcdddddddcck..',
    '..kccccccccWck..',
    '..kcdddddccWck..',
    '..kcccccccccck..',
    '..kkkkkkkkkkkk..',
    '......kHHk......',
    '................', '................'
  ], 16, 'papers2');
  T.monitor = legendT([
    '................', '................',
    '.kkkkkkkkkkkkkk.',
    '.kNNNNNNNNNNNNk.',
    '.kNzzzNggNNNNNk.',
    '.kNNNzzzzNyNNNk.',
    '.kNzzNNNNNNNNNk.',
    '.kNNNyyyNzzzNNk.',
    '.kNzzzzNNNNNNNk.',
    '.kNNNNNNNNNNNNk.',
    '.kkkkkkkkkkkkkk.',
    '.......kk.......',
    '.....kqqqqk.....',
    '.....kkkkkk.....',
    '................', '................'
  ], 16, 'monitor');

  /* ───────────────────── 13. 머리 위 아이콘(12×12) ───────────────────── */
  function badge(fill, sym, symLegend, rim) {
    var g = grid(12, 12);
    var shape = S([
      '..kkkkkkkk..',
      '.kFFFFFFFFk.',
      'kFFFFFFFFFFk',
      'kFFFFFFFFFFk',
      'kFFFFFFFFFFk',
      'kFFFFFFFFFFk',
      'kFFFFFFFFFFk',
      'kFFFFFFFFFFk',
      'kFFFFFFFFFFk',
      'kFFFFFFFFFFk',
      '.kFFFFFFFFk.',
      '..kkkkkkkk..'
    ], 12, 'badge');
    stamp(g, shape, { k: rim || (fill === C.n7 ? C.g6 : C.ink), F: fill });
    stamp(g, S(sym, 8, 'icon'), extend(TL, symLegend || {}), 2, 2);
    return g;
  }
  var ICONS = {
    typing: badge(C.h5, ['......ok', '.....ogk', '....kgk.', '...kgk..', '..kgk...', '.k3k....', '.kk.....', '........'], { o: C.coral, '3': C.w3 }),
    research: badge(C.h5, ['.kkkk...', 'kllllk..', 'klWllk..', 'kllllk..', '.kkkkk..', '....kGk.', '.....kGk', '......kk']),
    running: badge(C.n7, ['........', 'z.......', '.z......', '..z.....', '.z......', 'z.......', '........', '...zzzz.']),
    error: badge(C.red, ['...WW...', '...WW...', '...WW...', '...WW...', '...WW...', '........', '...WW...', '...WW...']),
    approval: badge(C.n7, ['...kk...', '...gk...', '..yggg..', '.ygggGg.', '.gggggG.', '.gggggG.', 'kkkkkkkk', '...gg...']),
    done: badge(C.h5, ['........', '.......A', '......AA', '.....AA.', 'A...AA..', 'AA.AA...', '.AAA....', '..A.....']),
    unknown: badge(C.x3, ['..XXXX..', '.XX..XX.', '.....XX.', '....XX..', '...XX...', '...XX...', '........', '...XX...']),
    zzz: badge(C.lav, ['....MMMM', '......M.', '.....M..', '....MMMM', 'MMM.....', '..M.....', '.M......', 'MMM.....']),
    meeting: badge(C.n7, ['........', '........', '........', 'gg.gg.gg', 'gg.gg.gg', '........', '........', '........']),
    // 계약서 외 추가(선택): 업무 중 · 휴식
    working: badge(C.n7, ['.gggggg.', '..gccg..', '...gg...', '...gg...', '..gYYg..', '.gYYYYg.', '.gggggg.', '........']),
    resting: badge(C.h5, ['.t..t...', '..t..t..', '.t..t...', 'kkkkkk..', 'kWWWWkk.', 'kWgWWk.k', 'kWWWWkk.', '.kkkk...'], { t: C.x4 })
  };

  /* ───────────────────── 14. 내보내기 ───────────────────── */
  var characters = {};
  Object.keys(STAFF).forEach(function (id) { characters[id] = buildCharacter(STAFF[id]); });

  var catIdle = catFrame(CAT_STAND), catIdle2 = catFrame(CAT_STAND_TAIL);
  var catSit = catFrame(CAT_SIT), catSitTail = catFrame(CAT_SIT_TAIL), catBlink = catFrame(CAT_SIT_BLINK);
  var catSide = catFrame(CAT_SIDE), catPass = catFrame(CAT_SIDE_PASS), catSide2 = catFrame(CAT_SIDE_2);
  var cat = {
    w: 16, h: 16,
    anims: {
      idle: { fps: 2, frames: [catIdle, catIdle, catIdle2, catIdle2] },
      walk: { fps: 6, frames: [catFrame(CAT_WALK_L), catIdle, catFrame(CAT_WALK_R), catIdle] },
      walkSide: { fps: 6, frames: [catSide, catPass, catSide2, catPass] },
      sit: { fps: 2, frames: [catSit, catSit, catSitTail, catSit, catSit, catBlink] },
      sleep: { fps: 1, frames: [catFrame(CAT_SLEEP), catFrame(CAT_SLEEP_2)] },
      groom: { fps: 3, frames: [catFrame(CAT_GROOM_A), catFrame(CAT_GROOM_B)] }
    }
  };

  var tiles = {};
  Object.keys(T).forEach(function (k) {
    // v 는 격자(2차원) 하나이거나, 여러 프레임이면 격자 배열(3차원)
    var v = T[k], frames = (Array.isArray(v[0]) && Array.isArray(v[0][0])) ? v : [v];
    tiles[k] = { w: W(frames[0]), h: H(frames[0]), frames: frames.map(emit) };
  });

  var icons = {};
  Object.keys(ICONS).forEach(function (k) { icons[k] = { w: 12, h: 12, frames: [emit(ICONS[k])] }; });

  root.OFFICE_ART = {
    version: 1,
    tile: 16,
    palette: palette,
    characters: characters,
    cat: cat,
    tiles: tiles,
    icons: icons,
    // 참고용(화면 필수 아님): 직원별 구별 요소
    notes: {
      ceo: '남색 정장, 금 넥타이·옷깃 핀, 옆가르마',
      main: '청록 가디건, 곱슬머리, 결재판',
      'business-strategist': '올리브 재킷, 올림머리, 금테 둥근 안경, 그래프 태블릿',
      'saju-engine-developer': '보라 후드, 민트·금 헤드폰, 부스스한 검은 머리',
      'frontend-developer': '산호색 털모자, 하늘색 티셔츠(민트 무늬)',
      'backend-developer': '짙은 회색 후드, 사각 안경, 묶은 머리, 머그잔',
      'qa-security-lead': '강철색 조끼, 금 방패 배지, 아주 짧은 머리, 돋보기',
      'myeongri-research-director': '쪽빛 두루마기·흰 동정, 은발 상투와 금 비녀, 두루마리',
      'personalization-researcher': '연보라 스웨터, 앞머리 단발, 자두색 수첩',
      'design-director': '자두색 베레모, 검정 터틀넥, 금 목걸이, 팔레트',
      'content-writer': '한지색 가디건, 긴 물결머리, 붓',
      guest: '회색 모자, 회갈색 재킷, 방문증(목걸이 명찰)'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
