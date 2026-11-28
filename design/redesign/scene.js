/* =====================================================================
   design/redesign/scene.js — 재설계 시안 공통 스크립트 (디자인 실장, 2026-11-28)
   1) 원형 예시 데이터 ARCH (가상 — 엔진·연구소장·작가 확정 전 자리 문구)
   2) 대표 이미지 임시 장면: 달빛 연못 + 물 위의 신성한 인간 + 물속에 비친 영물 (직접 만든 SVG)
      → 최종 이미지가 오면 [data-scene] 자리에 <picture>만 넣으면 된다 (IMAGE_BRIEF.md)
   3) 테마 전환: ?arch=키, 또는 부모 창 postMessage({rdArch:'키'}) (비교 페이지 index.html)
   외부 이미지 없음. 같은 seed → 같은 그림(재현 가능).
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- 1) 원형 예시 데이터 (가상) ---------- */
  var ARCH = {
    cheongryong: {
      name: '청룡', hanja: '靑龍', kind: '신수', creature: 'dragon',
      nick: '새벽 물길을 여는 푸른 용',
      line: '멈춰 있는 걸 못 견디는 사람. 길이 없으면 물길부터 낸다.',
      first: '처음엔 조용한 줄 알았지. 그런데 눈이 벌써 다음 자리에 가 있더구나. 너는 시작하는 힘이 남다른 아이야. 다만 끝맺음은 자꾸 남의 몫으로 남겨 두지.',
      color: '청록 · 미드나이트'
    },
    baekho: {
      name: '백호', hanja: '白虎', kind: '신수', creature: 'tiger',
      nick: '달빛을 가르는 흰 범',
      line: '말보다 몸이 먼저 나서는 사람. 지킬 게 생기면 누구보다 단단해진다.',
      first: '눈매가 맑고 서늘하구나. 아닌 건 끝까지 아니라고 하는 아이지. 그 곧음이 너를 여기까지 데려왔을 거야. 그런데 얘야, 곧은 칼일수록 한 번에 부러지기도 해.',
      color: '은 · 백'
    },
    heukyeo: {
      name: '흑여우', hanja: '黑狐', kind: '영물', creature: 'fox',
      nick: '안개 속을 먼저 읽는 검은 여우',
      line: '남이 못 본 틈을 먼저 보는 사람. 그 눈이 정작 너 자신에게는 가장 늦게 닿는다.',
      first: '방에 들어서자마자 누가 누구 편인지부터 읽지? 그 눈치가 네 재주야. 다만 너무 많이 보면 마음이 먼저 지친단다.',
      color: '보라 · 먹'
    },
    hwangryong: {
      name: '황룡', hanja: '黃龍', kind: '신수', creature: 'dragon',
      nick: '고요한 못 밑에서 도는 황룡',
      line: '가운데서 모두를 붙드는 사람. 가만있는 것 같아도 물 밑에선 늘 크게 돌고 있다.',
      first: '너는 사람들이 기대 오는 자리에 서 있구나. 무겁지? 남의 짐까지 네 것처럼 드는 버릇, 할미 눈엔 다 보여.',
      color: '금 · 옥빛 먹'
    },
    bonghwang: {
      name: '봉황', hanja: '鳳凰', kind: '신수', creature: 'phoenix',
      nick: '재 속에서 다시 날아오르는 봉황',
      line: '꺼진 줄 알면 다시 타오르는 사람. 무대가 생기면 가장 밝아지지만, 박수가 끊기면 쉽게 식는다.',
      first: '한번 마음에 불이 붙으면 아무도 못 말리지. 그 빛에 사람들이 모여들어. 그런데 남의 박수로만 타는 불은 오래 못 간단다.',
      color: '붉은 기운 · 금'
    }
  };
  var DEFAULT_ARCH = 'cheongryong';

  /* ---------- 2) 그리기 도구 ---------- */
  function f(n) { return Math.round(n * 10) / 10; }
  function rng(seed) { var s = seed % 2147483647; if (s <= 0) s += 2147483646; return function () { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; }; }
  // "x,y x,y* ..." → [[x,y,corner]]
  function P(str) { return str.trim().split(/\s+/).map(function (t) { var c = t.slice(-1) === '*'; var a = (c ? t.slice(0, -1) : t).split(','); return [+a[0], +a[1], c]; }); }
  // Catmull-Rom → 3차 베지어 (corner 점은 꺾임)
  function smooth(p, closed) {
    var n = p.length, d = 'M' + f(p[0][0]) + ' ' + f(p[0][1]), segs = closed ? n : n - 1;
    for (var i = 0; i < segs; i++) {
      var p1 = p[i], p2 = p[(i + 1) % n];
      var p0 = closed ? p[(i - 1 + n) % n] : p[Math.max(i - 1, 0)];
      var p3 = closed ? p[(i + 2) % n] : p[Math.min(i + 2, n - 1)];
      var c1x = p1[2] ? p1[0] : p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[2] ? p1[1] : p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[2] ? p2[0] : p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[2] ? p2[1] : p2[1] - (p3[1] - p1[1]) / 6;
      d += 'C' + f(c1x) + ' ' + f(c1y) + ' ' + f(c2x) + ' ' + f(c2y) + ' ' + f(p2[0]) + ' ' + f(p2[1]);
    }
    return closed ? d + 'Z' : d;
  }
  // 열린 곡선을 촘촘히 샘플링
  function sample(p, per) {
    per = per || 12; var out = [], n = p.length;
    for (var i = 0; i < n - 1; i++) {
      var p0 = p[Math.max(i - 1, 0)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(i + 2, n - 1)];
      for (var j = 0; j < per; j++) {
        var t = j / per, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
        ]);
      }
    }
    out.push([p[n - 1][0], p[n - 1][1]]);
    return out;
  }
  // 가운데 선(spine) + 폭 함수 → 끝이 가늘어지는 띠(꼬리·깃·리본·용 몸통)
  function ribbon(spine, wfn, per) {
    var s = sample(typeof spine === 'string' ? P(spine) : spine, per), L = [], R = [], n = s.length;
    for (var i = 0; i < n; i++) {
      var a = s[Math.max(i - 1, 0)], b = s[Math.min(i + 1, n - 1)], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
      var w = wfn(i / (n - 1)) / 2, nx = -dy / len * w, ny = dx / len * w;
      L.push([s[i][0] + nx, s[i][1] + ny]); R.push([s[i][0] - nx, s[i][1] - ny]);
    }
    var pts = L.concat(R.reverse());
    return 'M' + pts.map(function (q) { return f(q[0]) + ' ' + f(q[1]); }).join('L') + 'Z';
  }
  function taper(w0, w1, pow) { return function (t) { return w0 + (w1 - w0) * Math.pow(t, pow || 1); }; }
  function bell(w, pow) { return function (t) { return w * Math.pow(Math.sin(Math.PI * Math.min(t * 1.02, 1)), pow || 1) + 0.4; }; }
  function path(d, attrs) { return '<path d="' + d + '"' + (attrs ? ' ' + attrs : '') + '/>'; }

  /* ---------- 영물 실루엣 (지면 y=0, 위쪽이 음수, 왼쪽을 바라봄, 폭 약 −160~180) ---------- */
  var CREATURES = {
    tiger: function () {
      // 몸을 낮춰 걷는 범: 어깨뼈 솟음 · 등 굽이 · 배 말림 · 늘어졌다 말려 오르는 꼬리
      var body = smooth(P('-166,-70* -162,-84 -152,-95 -141,-106 -132,-113 -127,-128* -114,-114 -102,-112 -84,-110 -60,-122 -22,-110 18,-108 58,-114 86,-112 100,-104 104,-88 100,-64 106,-40 104,-14 110,-3 108,0* 86,0* 86,-8 84,-28 79,-40 70,-52 50,-56 20,-52 -10,-50 -32,-48 -36,-34 -38,-14 -36,-4 -38,0* -66,0* -66,-6 -62,-18 -62,-38 -70,-56 -86,-62 -104,-64 -124,-60 -144,-58 -158,-62'), true) +
        ribbon('94,-104 114,-92 126,-66 132,-40 144,-20 160,-16 172,-28', taper(13, 6), 12);
      var far = smooth(P('-48,-52 -60,-30 -76,-9 -78,-1* -98,0* -96,-6 -82,-30 -70,-54'), true) + smooth(P('58,-58 70,-36 82,-12 85,-1* 67,0* 65,-8 55,-32 44,-54'), true);
      var st = ['-108,-108 -104,-96 -108,-84', '-88,-110 -84,-96 -90,-80', '-62,-118 -58,-100 -64,-80', '-36,-112 -31,-94 -38,-72', '-8,-107 -3,-88 -10,-66', '20,-106 25,-86 19,-64', '46,-110 51,-90 45,-68', '72,-111 76,-94 70,-76'];
      var stripes = st.map(function (q) { return path(ribbon(q, taper(5.5, 0.3, 1.2), 8)); }).join('');
      return '<g class="cr-far">' + path(far) + '</g>' + path(body, 'class="cr-body"') +
        '<g class="cr-mark">' + stripes + path(smooth(P('-148,-92* -139,-97 -133,-93* -141,-90'), true)) + path(smooth(P('-166,-73* -159,-77 -158,-70*'), true)) + path(smooth(P('-162,-64 -150,-66 -140,-62'), false), 'fill="none" stroke-width="1.6"') + '</g>';
    },
    fox: function () {
      // 가늘고 긴 다리, 뾰족한 주둥이, 안개처럼 갈라지는 세 갈래 꼬리
      var tails = [
        ['64,-84 92,-104 112,-136 116,-172 100,-204', 40],
        ['64,-84 104,-98 140,-122 160,-156 158,-192', 40],
        ['64,-84 104,-86 142,-92 172,-112 190,-144', 34]
      ].map(function (t, i) { return path(ribbon(t[0], function (u) { return t[1] * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.75)), 0.8) + 1; }, 16), 'class="cr-body" opacity="' + (0.62 + i * 0.16) + '"'); }).join('');
      var tips = ['112,-160 106,-188 100,-204', '160,-170 160,-184 158,-192', '178,-122 186,-134 190,-144'].map(function (q) { return path(ribbon(q, taper(9, 0.5, 1.2), 6), 'class="cr-tip"'); }).join('');
      var body = smooth(P('-160,-86* -146,-91 -130,-98 -122,-104 -116,-130* -104,-108 -96,-110 -88,-130* -82,-104 -74,-94 -54,-88 -18,-86 26,-86 60,-92 70,-84 72,-66 76,-40 82,-10 86,-3 84,0* 70,0* 68,-8 62,-36 54,-58 24,-60 -16,-60 -38,-62 -48,-56 -50,-30 -48,-6 -47,0* -63,0* -65,-7 -65,-32 -68,-62 -82,-74 -100,-78 -120,-80 -140,-82'), true);
      var far = smooth(P('-30,-60 -24,-30 -18,-6 -16,0* -30,0* -32,-6 -38,-32 -44,-60'), true) + smooth(P('44,-60 52,-34 60,-6 62,0* 48,0* 46,-6 38,-34 32,-58'), true);
      return '<g class="cr-far">' + path(far) + '</g>' + tails + path(body, 'class="cr-body"') + tips +
        '<g class="cr-mark">' + path(smooth(P('-136,-94* -125,-98 -119,-96*'), false), 'fill="none" stroke-width="2.2" stroke-linecap="round"') + path(smooth(P('-160,-88* -155,-90 -155,-85*'), true)) + '</g>';
    },
    dragon: function () {
      // 크게 한 번 휘감아 오르는 몸 + 갈기 + 뿔 + 수염 + 여의주
      var spine = P('-104,-118 -78,-136 -50,-128 -36,-98 -40,-66 -18,-44 18,-46 44,-72 52,-108 80,-136 116,-132 136,-104 134,-72 150,-48 176,-44 196,-60 204,-84');
      var body = ribbon(spine, function (t) { return 3 + 25 * Math.pow(1 - t, 0.75) * Math.min(1, 0.75 + t * 6); }, 14);
      var belly = ribbon(spine, function (t) { return 1 + 9 * Math.pow(1 - t, 0.9) * Math.min(1, 0.6 + t * 6); }, 14);
      var s = sample(spine, 14), spikes = '';
      for (var i = 6; i < s.length - 24; i += 6) {
        var a = s[i - 1], b = s[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = dy / L, ny = -dx / L;
        var w = 14 * (1 - i / s.length) + 4, x = s[i][0] + nx * (12 * (1 - i / s.length) + 2), y = s[i][1] + ny * (12 * (1 - i / s.length) + 2);
        spikes += path('M' + f(x - dx / L * 5) + ' ' + f(y - dy / L * 5) + 'L' + f(x + nx * w - dx / L * 4) + ' ' + f(y + ny * w - dy / L * 4) + 'L' + f(x + dx / L * 5) + ' ' + f(y + dy / L * 5) + 'Z');
      }
      var head = smooth(P('-92,-122 -104,-136 -122,-138 -140,-132 -160,-124* -156,-114 -140,-110 -154,-102* -132,-98 -110,-102 -94,-110'), true);
      var horns = path(ribbon('-104,-134 -94,-154 -76,-168', taper(7, 0.5), 8)) + path(ribbon('-114,-136 -108,-158 -96,-176', taper(6, 0.5), 8));
      var whisk = path(ribbon('-158,-122 -176,-132 -188,-152 -180,-170', taper(2.6, 0.2), 10)) + path(ribbon('-150,-104 -170,-94 -192,-100 -204,-116', taper(2.4, 0.2), 10));
      var mane = ['-90,-130 -76,-152 -58,-158', '-74,-132 -56,-148 -38,-146', '-58,-124 -38,-132 -26,-122', '-48,-108 -28,-110 -20,-98'].map(function (q) { return path(ribbon(q, taper(7, 0.4), 8)); }).join('');
      var legs = ['-44,-86 -64,-66 -66,-44', '30,-58 30,-30 22,-12', '132,-90 154,-92 168,-104', '146,-56 150,-30 142,-12'].map(function (q) {
        var pp = P(q), e = pp[2], dx = e[0] - pp[1][0], dy = e[1] - pp[1][1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
        var claw = function (ang) { var c = Math.cos(ang), sn = Math.sin(ang), vx = ux * c - uy * sn, vy = ux * sn + uy * c; return path(ribbon([[e[0], e[1]], [e[0] + vx * 10, e[1] + vy * 10]], taper(3.4, 0.2), 4)); };
        return path(ribbon(q, taper(11, 6), 8)) + claw(-0.7) + claw(0) + claw(0.7);
      }).join('');
      var tail = path(ribbon('196,-60 210,-82 214,-108', bell(20, 0.6), 8));
      return '<g class="cr-body">' + path(body) + spikes + path(head) + horns + whisk + mane + legs + tail + '</g>' +
        '<g class="cr-tip">' + path(belly) + '</g>' +
        '<g class="cr-mark">' + path(smooth(P('-134,-126* -124,-128 -119,-123*'), false), 'fill="none" stroke-width="2.4" stroke-linecap="round"') + '</g>' +
        '<circle class="cr-pearl" cx="-186" cy="-62" r="11"/>';
    },
    phoenix: function () {
      // 위로 치켜든 두 날개(팔 선을 따라 깃이 뒤로 흐름), 볏, S자로 흐르는 꼬리깃(끝 눈무늬)
      function wing(sx, sy, wx, wy, n, a0, a1, l0, l1, wid) {
        var out = '';
        for (var i = n - 1; i >= 0; i--) {
          var u = i / (n - 1), bx = sx + (wx - sx) * u, by = sy + (wy - sy) * u;
          var a = (a0 + (a1 - a0) * u) * Math.PI / 180, l = l0 + (l1 - l0) * Math.pow(u, 0.8) * (u > 0.9 ? 0.85 : 1);
          var ex = bx + Math.cos(a) * l, ey = by + Math.sin(a) * l, mx = bx + Math.cos(a - 0.25) * l * 0.5, my = by + Math.sin(a - 0.25) * l * 0.5;
          out += path(ribbon([[bx, by], [mx, my], [ex, ey]], function (t) { return wid * Math.pow(Math.sin(Math.PI * Math.min(1, 0.2 + t * 0.85)), 0.55) + 0.4; }, 10));
        }
        return out + path(ribbon([[sx, sy], [(sx + wx) / 2 - 4, (sy + wy) / 2], [wx, wy]], taper(18, 6), 8));
      }
      var near = wing(-2, -84, -18, -178, 11, -10, -62, 46, 96, 15);
      var far = wing(14, -86, 40, -170, 9, -2, -48, 40, 82, 13);
      var plumes = [
        ['28,-56 66,-56 100,-40 130,-34 160,-46 196,-40', 12], ['28,-58 70,-70 110,-70 146,-82 176,-104 204,-108', 10],
        ['28,-52 60,-38 90,-14 124,-8 156,-20 188,-12', 11], ['26,-50 52,-28 72,-4 104,8 140,2 172,12', 9],
        ['30,-60 66,-86 100,-110 134,-130 166,-148 196,-150', 8]
      ];
      var tail = plumes.map(function (q) { return path(ribbon(q[0], function (t) { return q[1] * (0.5 + 0.5 * Math.sin(Math.PI * t)) * (t > 0.9 ? (1 - t) * 10 : 1) + 0.5; }, 16)); }).join('');
      var eyes = plumes.map(function (q) { var pp = P(q[0]), e = pp[pp.length - 2]; return '<ellipse cx="' + e[0] + '" cy="' + e[1] + '" rx="7" ry="4.5"/>'; }).join('');
      var body = smooth(P('-24,-86 -36,-68 -28,-50 -8,-42 18,-46 36,-56 22,-74 4,-84'), true);
      var neck = path(ribbon('-20,-82 -36,-100 -46,-116 -56,-124', taper(16, 9), 10));
      var head = '<ellipse cx="-59" cy="-127" rx="10" ry="7.5"/>' + path('M-66 -131L-86 -123L-65 -121Z');
      var crest = ['-54,-133 -48,-150 -36,-162', '-60,-134 -60,-154 -54,-172', '-52,-131 -40,-142 -26,-148'].map(function (q) { return path(ribbon(q, taper(3.4, 0.4), 8)); }).join('') +
        '<circle cx="-36" cy="-162" r="3"/><circle cx="-54" cy="-172" r="3"/><circle cx="-26" cy="-148" r="3"/>';
      return '<g class="cr-far">' + far + '</g><g class="cr-body">' + tail + body + neck + head + crest + near + '</g>' +
        '<g class="cr-mark">' + eyes + '<circle cx="-61" cy="-129" r="1.8"/></g>';
    },
    unknown: function () {
      return '<g class="cr-body"><circle cx="0" cy="-70" r="20"/></g>' +
        '<g class="cr-far"><ellipse cx="0" cy="-70" rx="70" ry="40"/><ellipse cx="-30" cy="-110" rx="60" ry="26"/><ellipse cx="50" cy="-40" rx="56" ry="22"/></g>';
    }
  };

  /* 물 위의 신성한 인간 — 얼굴·성별을 정하지 않는 상징적 실루엣. 발 = (0,0) */
  function figure() {
    var robe = smooth(P('-3,-86 -11,-82 -17,-73 -24,-59 -30,-47* -21,-44 -16,-52 -15,-40 -17,-20 -20,-4 -13,0 0,1 14,0 26,-2 40,-3* 25,-10 17,-24 15,-40 16,-52 21,-44 30,-47* 24,-59 17,-73 11,-82 3,-86'), true);
    var ribbons = path(ribbon('-12,-78 -30,-72 -44,-58 -42,-40 -54,-24 -62,-20', taper(3, 0.6), 10), 'class="fg-rib"') +
      path(ribbon('12,-78 34,-68 56,-62 72,-50 90,-52 104,-62', taper(3, 0.6), 10), 'class="fg-rib"');
    return '<g class="fg">' + ribbons + path(robe) + '<circle cx="0" cy="-93" r="7"/><circle cx="0" cy="-102.5" r="3.6"/></g>' +
      '<g class="fg-rim">' + path(robe) + '<circle cx="0" cy="-93" r="7"/></g>';
  }

  function ridge(seed, x0, x1, base, amp, step, dip) {
    var r = rng(seed), d = 'M' + x0 + ' ' + base, x = x0;
    while (x <= x1) {
      var c = Math.abs(x - 195) / 195, h = amp * (0.25 + 0.75 * Math.pow(c, dip)) * (0.55 + r() * 0.6);
      var nx = x + step * (0.6 + r() * 0.8);
      d += 'Q' + f((x + nx) / 2) + ' ' + f(base - h * 1.25) + ' ' + f(nx) + ' ' + f(base - h * (0.4 + r() * 0.4));
      x = nx;
    }
    return d + 'L' + x1 + ' ' + (base + 2) + 'L' + x0 + ' ' + (base + 2) + 'Z';
  }

  /* 장면 그리기. opt.creature 없으면 data-arch의 영물. 크기 390×520 기준(슬라이스 맞춤) */
  var uid = 0;
  function sceneHTML(opt) {
    opt = opt || {}; var id = 'sc' + (++uid), W = 390, H = opt.h || 520, Y = opt.horizon || 300, cx = 195, r = rng(opt.seed || 7);
    var stars = '', i;
    for (i = 0; i < 46; i++) { var sx = r() * W, sy = r() * (Y - 90); stars += '<circle cx="' + f(sx) + '" cy="' + f(sy) + '" r="' + f(0.4 + r() * 0.9) + '" opacity="' + f(0.25 + r() * 0.65) + '"/>'; }
    var ripples = '';
    for (i = 0; i < 70; i++) { var ry = Y + 4 + Math.pow(r(), 1.6) * (H - Y), rw = 6 + r() * 26 * (1 + (ry - Y) / 120), rx = r() * W; ripples += '<rect x="' + f(rx) + '" y="' + f(ry) + '" width="' + f(rw) + '" height="0.8" opacity="' + f(0.05 + r() * 0.16) + '"/>'; }
    var glint = '';
    for (i = 0; i < 34; i++) { var gy = Y + 3 + i * 4.6 + r() * 2, gw = (58 - i * 1.5) * (0.5 + r() * 0.8); glint += '<rect x="' + f(cx - gw / 2 + (r() - 0.5) * 10) + '" y="' + f(gy) + '" width="' + f(gw) + '" height="1.3" rx=".6" opacity="' + f(Math.max(0.06, 0.7 - i * 0.02) * (0.5 + r() * 0.5)) + '"/>'; }
    var trees = '';
    [[0, 118], [262, 390]].forEach(function (seg, k) {
      var x = seg[0];
      while (x < seg[1]) { var hh = 8 + r() * 22 * (k ? (x - seg[0]) / 128 : 1 - (x - seg[0]) / 118) + 4; trees += path('M' + f(x - 5 - r() * 4) + ' ' + Y + 'Q' + f(x) + ' ' + f(Y - hh * 1.4) + ' ' + f(x + 5 + r() * 4) + ' ' + Y + 'Z'); x += 4 + r() * 6; }
    });
    var reeds = '';
    for (i = 0; i < 16; i++) {
      var left = i < 8, bx = left ? 6 + r() * 54 : W - 6 - r() * 58, top = H - 70 - r() * 70, bend = (left ? 1 : -1) * (8 + r() * 18);
      reeds += path(ribbon([[bx, H + 4], [bx + bend * 0.3, (H + top) / 2], [bx + bend, top]], taper(2.6, 0.3), 8));
    }
    var cr = (CREATURES[opt.creature] ? [opt.creature] : ['tiger', 'fox', 'dragon', 'phoenix']).map(function (k) {
      return '<g class="cr cr-' + k + (opt.creature ? ' cr-only' : '') + '">' + CREATURES[k]() + '</g>';
    }).join('');
    var moonY = opt.moonY || 206, moonR = opt.moonR || 64;

    var bg = '<svg class="sc-bg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' +
      '<defs>' +
      '<linearGradient id="' + id + 'sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--sky-0)"/><stop offset=".62" style="stop-color:var(--sky-1)"/><stop offset="1" style="stop-color:var(--sky-2)"/></linearGradient>' +
      '<linearGradient id="' + id + 'wat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--water-0)"/><stop offset="1" style="stop-color:var(--water-1)"/></linearGradient>' +
      '<radialGradient id="' + id + 'halo"><stop offset="0" style="stop-color:var(--moon-glow)"/><stop offset=".45" style="stop-color:var(--moon-glow);stop-opacity:.35"/><stop offset="1" style="stop-color:var(--moon-glow);stop-opacity:0"/></radialGradient>' +
      '<radialGradient id="' + id + 'moon" cx=".42" cy=".38" r=".7"><stop offset="0" style="stop-color:#fff"/><stop offset=".55" style="stop-color:var(--moon)"/><stop offset="1" style="stop-color:var(--moon);stop-opacity:.82"/></radialGradient>' +
      '<linearGradient id="' + id + 'fog" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--mist);stop-opacity:0"/><stop offset=".7" style="stop-color:var(--moon-glow);stop-opacity:.55"/><stop offset="1" style="stop-color:var(--mist);stop-opacity:0"/></linearGradient>' +
      '<linearGradient id="' + id + 'low" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--bg);stop-opacity:0"/><stop offset="1" style="stop-color:var(--bg)"/></linearGradient>' +
      '</defs>' +
      '<rect width="' + W + '" height="' + Y + '" fill="url(#' + id + 'sky)"/>' +
      '<g style="fill:var(--mote)">' + stars + '</g>' +
      '<circle cx="' + cx + '" cy="' + moonY + '" r="' + (moonR * 2.9) + '" fill="url(#' + id + 'halo)"/>' +
      '<circle cx="' + cx + '" cy="' + moonY + '" r="' + moonR + '" fill="url(#' + id + 'moon)"/>' +
      '' +
      path(ridge(11, -10, 400, Y + 1, 88, 34, 1.6), 'style="fill:var(--mtn-1)" opacity=".85"') +
      '<rect x="0" y="' + (Y - 70) + '" width="' + W + '" height="74" fill="url(#' + id + 'fog)"/>' +
      path(ridge(29, -10, 400, Y + 1, 52, 22, 2.2), 'style="fill:var(--mtn-2)"') +
      '<g style="fill:var(--shore)">' + trees + '<rect x="0" y="' + (Y - 1.5) + '" width="' + W + '" height="3"/></g>' +
      '<rect y="' + Y + '" width="' + W + '" height="' + (H - Y) + '" fill="url(#' + id + 'wat)"/>' +
      '<g style="fill:var(--moon)">' + ripples + '</g>' +
      '<g style="fill:var(--moon)" class="sc-glint">' + glint + '</g>' +
      '<g transform="translate(' + cx + ' ' + Y + ')" fill="none" style="stroke:var(--rim)"><ellipse rx="22" ry="3.2" opacity=".55" stroke-width=".9"/><ellipse rx="40" ry="5.6" opacity=".32" stroke-width=".8"/><ellipse rx="64" ry="8.6" opacity=".16" stroke-width=".7"/></g>' +
      '<g transform="translate(' + cx + ' ' + (Y + 1) + ') scale(' + (opt.figScale || 1) + ')">' + figure() + '</g>' +
      '<g style="fill:var(--figure)" opacity=".92">' + reeds + '</g>' +
      '<rect y="' + (H - 120) + '" width="' + W + '" height="120" fill="url(#' + id + 'low)"/>' +
      '</svg>';

    var refl = '<svg class="sc-refl" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' +
      '<defs>' +
      '<filter id="' + id + 'wav" x="-10%" y="-10%" width="120%" height="130%"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.16" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="9" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation=".7"/></filter>' +
      '<linearGradient id="' + id + 'sp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--spirit)"/><stop offset="1" style="stop-color:var(--spirit-2)"/></linearGradient>' +
      '<linearGradient id="' + id + 'fade" x1="0" y1="' + Y + '" x2="0" y2="' + (Y + 190) + '" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".6" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
      '<mask id="' + id + 'm" maskUnits="userSpaceOnUse" x="0" y="0" width="' + W + '" height="' + H + '"><rect y="' + (Y + 1) + '" width="' + W + '" height="' + (H - Y) + '" fill="url(#' + id + 'fade)"/></mask>' +
      '<filter id="' + id + 'aura" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>' +
      '</defs>' +
      '<g mask="url(#' + id + 'm)">' +
      '<use href="#' + id + 'cr" filter="url(#' + id + 'aura)" opacity=".75"/>' +
      '<g filter="url(#' + id + 'wav)"><g id="' + id + 'cr" class="cr-set" transform="translate(' + cx + ' ' + (Y + 3) + ') scale(' + (opt.crScale || 0.86) + ' -' + (opt.crScale || 0.86) + ')" style="--sp:url(#' + id + 'sp)">' + cr + '</g></g>' +
      '</g></svg>';

    var mist = '<div class="sc-mist" aria-hidden="true"><i></i><i></i><i></i></div>';
    var motes = '<div class="sc-motes" aria-hidden="true">';
    for (i = 0; i < 12; i++) motes += '<i style="left:' + f(8 + r() * 84) + '%;top:' + f(30 + r() * 52) + '%;animation-delay:-' + f(r() * 9) + 's;animation-duration:' + f(7 + r() * 6) + 's"></i>';
    motes += '</div>';
    var tag = opt.tag === false ? '' : '<span class="sc-tag">최종 이미지 자리 · 임시 SVG</span>';
    return bg + refl + mist + motes + tag;
  }

  /* ---------- 3) 테마 ---------- */
  function q(name) { var m = new RegExp('[?&]' + name + '=([^&#]*)').exec(location.search); return m ? decodeURIComponent(m[1]) : null; }
  function applyArch(key) {
    if (!ARCH[key]) key = DEFAULT_ARCH;
    var a = ARCH[key], root = document.documentElement;
    root.setAttribute('data-arch', key);
    root.setAttribute('data-creature', a.creature);
    document.querySelectorAll('[data-a]').forEach(function (el) { var v = a[el.getAttribute('data-a')]; if (v != null) el.textContent = v; });
    document.querySelectorAll('a[data-keep]').forEach(function (el) {
      var h = el.getAttribute('href').replace(/([?&])arch=[^&#]*&?/, '$1').replace(/[?&]$/, '');
      el.setAttribute('href', h + (h.indexOf('?') < 0 ? '?' : '&') + 'arch=' + key);
    });
    var meta = document.querySelector('meta[name=theme-color]');
    if (meta && root.getAttribute('data-mood') === 'night') meta.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim());
    window.RD.arch = key;
    document.dispatchEvent(new CustomEvent('rd:arch', { detail: key }));
  }
  function mountScenes() {
    document.querySelectorAll('[data-scene]').forEach(function (el) {
      if (el.getAttribute('data-done')) return;
      var o = {};
      try { o = JSON.parse(el.getAttribute('data-scene') || '{}'); } catch (e) { }
      el.innerHTML = sceneHTML(o) + el.innerHTML;
      el.classList.add('sc');
      el.setAttribute('data-done', '1');
    });
  }

  window.RD = { ARCH: ARCH, sceneHTML: sceneHTML, applyArch: applyArch, arch: DEFAULT_ARCH, CREATURES: CREATURES };
  applyArch(q('arch') || DEFAULT_ARCH);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { mountScenes(); applyArch(window.RD.arch); });
  else mountScenes();
  window.addEventListener('message', function (e) { if (e.data && e.data.rdArch) applyArch(e.data.rdArch); });
})();
