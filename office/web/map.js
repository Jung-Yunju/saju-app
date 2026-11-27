/* office/web/map.js — 가상 사무실 지도 (카드 O-02, 디자인 실장)
 *
 * 형식: office/CONTRACT.md 6절 `window.OFFICE_MAP` 그대로. 타일 좌표(한 칸 16px).
 * 이 파일은 아래 "배치표"로 지도를 만든다. 가구를 옮기려면 FURNITURE 목록만 고치면 되고,
 * 통행 격자(walkable)는 바닥·가구 종류에서 자동으로 계산된다.
 *
 *   y  0      벽 윗면
 *   y  1      위층 방들의 벽 앞면(창문·책장 윗부분)
 *   y  2~8    대표실 | 명리학 연구실 | 디자인실
 *   y  9      벽(문 3곳)
 *   y 10      복도 벽 앞면
 *   y 11~12   복도(왼쪽 끝 x0,y12 = 정문)
 *   y 13      벽(문 3곳)
 *   y 14      아래층 방들의 벽 앞면(화이트보드·선반)
 *   y 15~22   개발실 | 회의실 | 휴게실
 *   y 23      벽
 *
 * 책상 자리(desks)는 모두 facing "down": 의자에 앉아 아래쪽(화면 앞쪽) 책상을 마주 본다.
 * 그래서 앉은 모습은 얼굴이 보이는 앞모습이다(머리·소품으로 직원 구별이 쉽도록).
 * 검사: node office/web/check-art.mjs
 */
(function (root) {
  'use strict';
  var COLS = 36, ROWS = 24;

  // 문자 → art.js 의 tiles 키 (바닥층·가구층 공용)
  var LEGEND = {
    // 바닥층
    W: 'wall', F: 'wall_face', N: 'wall_window', n: 'wall_window2',
    f: 'floor_wood', l: 'floor_wood_light', c: 'floor_carpet', m: 'floor_mat', s: 'floor_stone', r: 'floor_rug',
    D: 'door', E: 'door_side',
    // 가구층 — 벽 앞면에 붙는 것
    A: 'wall_art_l', a: 'wall_art_r', K: 'wall_clock', H: 'whiteboard_l', h: 'whiteboard_r',
    P: 'pinboard_l', p: 'pinboard_r', Q: 'wall_shelf', U: 'wall_moon',
    B: 'bookshelf_top', b: 'bookshelf_bot', Y: 'scroll_top', y: 'scroll_bot', V: 'easel_top', v: 'easel_bot',
    '[': 'server_top', ']': 'server_bot',
    // 책상
    M: 'desk_monitor', d: 'desk_papers', k: 'desk_books', j: 'desk_mug', g: 'desk_plant', i: 'desk_ink',
    e: 'desk_palette', o: 'desk_scroll', L: 'desk_books_main',
    '1': 'ceo_desk_l', '2': 'ceo_desk_m', '3': 'ceo_desk_r',
    // 의자·탁자·소파
    C: 'chair', T: 'chair_meet', t: 'chair_meet_s',
    '4': 'table_tl', '5': 'table_t1', '6': 'table_t2', '7': 'table_tr',
    '8': 'table_bl', '9': 'table_b1', '0': 'table_b2', '&': 'table_br',
    S: 'sofa_l', X: 'sofa_m', R: 'sofa_r', w: 'table_low', u: 'cushion',
    G: 'counter', Z: 'coffee', z: 'counter_tea',
    q: 'plant', O: 'plant2', '@': 'cat_bed', J: 'lamp_hanji'
  };
  // 위에 올라서거나 앉을 수 있는 가구(나머지 가구는 통행 불가)
  var PASSABLE_FURNITURE = { C: 1, T: 1, t: 1, S: 1, X: 1, R: 1, u: 1, '@': 1 };
  // 통행 가능한 바닥
  var PASSABLE_FLOOR = { f: 1, l: 1, c: 1, m: 1, s: 1, r: 1, D: 1, E: 1 };

  var ROOMS = [
    { id: 'ceo', name: '대표실', x: 1, y: 1, w: 10, h: 8 },
    { id: 'research', name: '명리학 연구실', x: 12, y: 1, w: 11, h: 8 },
    { id: 'design', name: '디자인실', x: 24, y: 1, w: 11, h: 8 },
    { id: 'dev', name: '개발실', x: 1, y: 14, w: 13, h: 9 },
    { id: 'meeting', name: '회의실', x: 15, y: 14, w: 10, h: 9 },
    { id: 'lounge', name: '휴게실', x: 26, y: 14, w: 9, h: 9 }
  ];
  var ROOM_FLOOR = { ceo: 'c', research: 'm', design: 'l', dev: 'f', meeting: 'c', lounge: 'f' };

  // ── 바닥층 ──
  var floor = [];
  for (var y = 0; y < ROWS; y++) { var r = []; for (var x = 0; x < COLS; x++) r.push('W'); floor.push(r); }
  function fill(grid, x0, y0, w, h, ch) { for (var j = y0; j < y0 + h; j++) for (var i = x0; i < x0 + w; i++) grid[j][i] = ch; }
  ROOMS.forEach(function (rm) {
    fill(floor, rm.x, rm.y, rm.w, 1, 'F');                     // 벽 앞면 줄
    fill(floor, rm.x, rm.y + 1, rm.w, rm.h - 1, ROOM_FLOOR[rm.id]); // 바닥
  });
  fill(floor, 1, 10, 34, 1, 'F');   // 복도 벽 앞면
  fill(floor, 1, 11, 34, 2, 's');   // 복도
  fill(floor, 30, 16, 5, 4, 'r');   // 휴게실 깔개
  // 창문(위층 바깥벽)
  [[2, 1, 'N'], [9, 1, 'n'], [15, 1, 'N'], [19, 1, 'n'], [26, 1, 'N'], [33, 1, 'n']].forEach(function (p) { floor[p[1]][p[0]] = p[2]; });
  // 문: 벽 칸은 문, 그 아래 벽 앞면 칸은 바닥으로 뚫는다
  [[6, 'c'], [17, 'm'], [29, 'l']].forEach(function (d) { floor[9][d[0]] = 'D'; floor[10][d[0]] = 's'; });
  [[7, 'f'], [20, 'c'], [30, 'f']].forEach(function (d) { floor[13][d[0]] = 'D'; floor[14][d[0]] = d[1]; });
  floor[12][0] = 'E'; // 정문

  // ── 가구층 ── [x, y, 문자]
  var FURNITURE = [
    // 대표실
    [1, 1, 'B'], [1, 2, 'b'], [5, 1, 'A'], [6, 1, 'a'], [10, 2, 'q'],
    [5, 3, 'C'], [4, 4, '1'], [5, 4, '2'], [6, 4, '3'],
    [2, 6, 'C'], [2, 7, 'M'], [3, 7, 'd'],
    [8, 6, 'C'], [8, 7, 'M'], [9, 7, 'g'],
    [1, 8, 'O'], [10, 8, '@'],
    // 명리학 연구실
    [12, 1, 'Y'], [12, 2, 'y'], [13, 1, 'Y'], [13, 2, 'y'], [17, 1, 'U'],
    [21, 1, 'B'], [21, 2, 'b'], [22, 1, 'B'], [22, 2, 'b'],
    [15, 4, 'C'], [15, 5, 'L'], [16, 5, 'o'],
    [19, 4, 'C'], [19, 5, 'M'], [20, 5, 'd'],
    [12, 8, 'J'], [22, 8, 'q'],
    // 디자인실
    [24, 1, 'B'], [24, 2, 'b'], [29, 1, 'P'], [30, 1, 'p'], [34, 2, 'O'],
    [26, 3, 'V'], [26, 4, 'v'],
    [29, 5, 'C'], [29, 6, 'M'], [30, 6, 'e'],
    [32, 5, 'C'], [32, 6, 'M'], [33, 6, 'i'],
    [34, 8, 'q'],
    // 복도
    [12, 10, 'K'], [23, 10, 'A'], [24, 10, 'a'], [34, 11, 'q'], [1, 11, 'O'],
    // 개발실
    [2, 14, 'H'], [3, 14, 'h'], [10, 14, 'K'], [13, 14, '['], [13, 15, ']'],
    [3, 16, 'C'], [3, 17, 'M'], [4, 17, 'k'],
    [9, 16, 'C'], [9, 17, 'M'], [10, 17, 'g'],
    [3, 20, 'C'], [3, 21, 'M'], [4, 21, 'j'],
    [9, 20, 'C'], [9, 21, 'M'], [10, 21, 'd'],
    [1, 15, 'q'], [13, 22, 'O'],
    // 회의실
    [16, 14, 'H'], [17, 14, 'h'], [22, 14, 'A'], [23, 14, 'a'],
    [18, 16, 'T'], [19, 16, 'T'], [20, 16, 'T'], [21, 16, 'T'],
    [18, 17, '4'], [19, 17, '5'], [20, 17, '6'], [21, 17, '7'],
    [18, 18, '8'], [19, 18, '9'], [20, 18, '0'], [21, 18, '&'],
    [18, 19, 't'], [19, 19, 't'], [20, 19, 't'], [21, 19, 't'],
    [15, 15, 'q'], [24, 15, 'q'], [15, 22, 'O'], [24, 22, 'O'],
    // 휴게실
    [27, 14, 'Q'], [32, 14, 'A'], [33, 14, 'a'],
    [26, 15, 'G'], [27, 15, 'Z'], [28, 15, 'z'], [34, 15, 'q'],
    [31, 16, 'S'], [32, 16, 'X'], [33, 16, 'R'], [32, 17, 'w'],
    [30, 18, 'u'], [34, 18, 'u'], [31, 20, 'u'], [33, 20, 'u'],
    [26, 22, 'O'], [34, 22, '@']
  ];
  var furn = [];
  for (var y2 = 0; y2 < ROWS; y2++) { var r2 = []; for (var x2 = 0; x2 < COLS; x2++) r2.push('.'); furn.push(r2); }
  FURNITURE.forEach(function (f) { furn[f[1]][f[0]] = f[2]; });

  // ── 통행 격자 ──
  var walk = [];
  for (var y3 = 0; y3 < ROWS; y3++) {
    var row = '';
    for (var x3 = 0; x3 < COLS; x3++) {
      var fc = furn[y3][x3];
      var ok = PASSABLE_FLOOR[floor[y3][x3]] && (fc === '.' || PASSABLE_FURNITURE[fc]);
      row += ok ? '.' : '#';
    }
    walk.push(row);
  }

  root.OFFICE_MAP = {
    version: 1,
    cols: COLS, rows: ROWS,
    layers: {
      floor: floor.map(function (r) { return r.join(''); }),
      furniture: furn.map(function (r) { return r.join(''); })
    },
    legend: LEGEND,
    rooms: ROOMS,
    // 앉는 자리(의자 칸). facing = 앉은 사람이 바라보는 방향(책상 쪽)
    desks: {
      ceo: { x: 5, y: 3, facing: 'down' },
      main: { x: 2, y: 6, facing: 'down' },
      'business-strategist': { x: 8, y: 6, facing: 'down' },
      'saju-engine-developer': { x: 3, y: 16, facing: 'down' },
      'frontend-developer': { x: 9, y: 16, facing: 'down' },
      'backend-developer': { x: 3, y: 20, facing: 'down' },
      'qa-security-lead': { x: 9, y: 20, facing: 'down' },
      'myeongri-research-director': { x: 15, y: 4, facing: 'down' },
      'personalization-researcher': { x: 19, y: 4, facing: 'down' },
      'design-director': { x: 29, y: 5, facing: 'down' },
      'content-writer': { x: 32, y: 5, facing: 'down' },
      // 계약서 2절: 외부 지원 인력은 휴게실. 고정 자리가 필요할 때 쓰는 방석 자리
      guest: { x: 34, y: 18, facing: 'left' }
    },
    spots: {
      // 회의 탁자 위쪽 의자 4 + 아래쪽 의자 4
      meeting: [
        { x: 18, y: 16 }, { x: 19, y: 16 }, { x: 20, y: 16 }, { x: 21, y: 16 },
        { x: 18, y: 19 }, { x: 19, y: 19 }, { x: 20, y: 19 }, { x: 21, y: 19 }
      ],
      // 소파 3 + 방석 3 + 조리대 앞 2
      lounge: [
        { x: 31, y: 16 }, { x: 32, y: 16 }, { x: 33, y: 16 },
        { x: 30, y: 18 }, { x: 31, y: 20 }, { x: 33, y: 20 },
        { x: 27, y: 17 }, { x: 28, y: 19 }
      ],
      ceoBell: { x: 6, y: 4 },   // 대표 책상 오른쪽(결재 벨 자리)
      door: { x: 1, y: 12 }      // 정문 안쪽 첫 칸(출근·퇴근 출입)
    },
    walkable: walk,
    // 복자 산책 경로(장식, 업무와 무관). 이웃한 두 점은 가로 또는 세로로만 이어지고 그 사이가 모두 통행 가능.
    catRoutes: [
      // 휴게실 고양이 침대 ↔ 대표실 고양이 침대
      [{ x: 33, y: 22 }, { x: 30, y: 22 }, { x: 30, y: 12 }, { x: 6, y: 12 }, { x: 6, y: 8 }, { x: 10, y: 8 },
        { x: 6, y: 8 }, { x: 6, y: 12 }, { x: 30, y: 12 }, { x: 30, y: 22 }, { x: 33, y: 22 }],
      // 개발실 ↔ 회의실 한 바퀴
      [{ x: 7, y: 22 }, { x: 7, y: 12 }, { x: 20, y: 12 }, { x: 20, y: 15 }, { x: 16, y: 15 }, { x: 16, y: 21 },
        { x: 23, y: 21 }, { x: 23, y: 15 }, { x: 20, y: 15 }, { x: 20, y: 12 }, { x: 7, y: 12 }, { x: 7, y: 22 }],
      // 명리학 연구실 ↔ 디자인실
      [{ x: 13, y: 6 }, { x: 17, y: 6 }, { x: 17, y: 12 }, { x: 29, y: 12 }, { x: 29, y: 8 }, { x: 27, y: 8 },
        { x: 27, y: 3 }, { x: 31, y: 3 }, { x: 31, y: 8 }, { x: 29, y: 8 }, { x: 29, y: 12 }, { x: 17, y: 12 },
        { x: 17, y: 6 }, { x: 13, y: 6 }]
    ]
  };
})(typeof window !== 'undefined' ? window : globalThis);
