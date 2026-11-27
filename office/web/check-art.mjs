#!/usr/bin/env node
/* office/web/check-art.mjs — art.js·map.js 형식 검사 (카드 O-02, 디자인 실장)
 *
 * 사용: node office/web/check-art.mjs
 * 통과하면 종료 코드 0, 하나라도 어긋나면 1. 외부 패키지 없음.
 *
 * 검사 항목
 *  - art.js: tile=16, 팔레트(문자 1개 → #rrggbb, "." 투명), 필수 캐릭터 12종·애니메이션 7종,
 *            복자 애니메이션 6종, 필수 타일, 필수 아이콘 9종, 모든 프레임의 줄 수·글자 수·팔레트 문자,
 *            파일 크기(150KB 이하)
 *  - map.js: cols·rows, 레이어 크기, legend(모든 문자가 art.tiles 에 있음), 방 6개,
 *            자리(desks)가 통행 가능·자기 방 안, spots(회의 8·휴게 8·벨·문), walkable 형식,
 *            정문에서 모든 자리·spot 까지 길이 있음, 복자 경로(가로·세로 직선, 전 구간 통행 가능)
 */
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const errors = [];
const warns = [];
const err = (m) => errors.push(m);

function load(file) {
  const ctx = { window: {} };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  try {
    vm.runInContext(readFileSync(join(here, file), 'utf8'), ctx, { filename: file });
  } catch (e) {
    err(`${file} 실행 오류: ${e.message}`);
  }
  return ctx.window;
}

const w1 = load('art.js');
const w2 = load('map.js');
const ART = w1.OFFICE_ART;
const MAP = w2.OFFICE_MAP;

const STAFF = ['ceo', 'main', 'business-strategist', 'saju-engine-developer', 'frontend-developer', 'backend-developer',
  'qa-security-lead', 'myeongri-research-director', 'personalization-researcher', 'design-director', 'content-writer', 'guest'];
const CHAR_ANIMS = ['idle', 'walk', 'walkSide', 'walkUp', 'sit', 'type', 'read'];
const CAT_ANIMS = ['idle', 'walk', 'walkSide', 'sit', 'sleep', 'groom'];
const ICONS = ['typing', 'research', 'running', 'error', 'approval', 'done', 'unknown', 'zzz', 'meeting'];
const TILES = ['wall', 'wall_face', 'wall_window', 'door', 'floor_wood', 'floor_carpet', 'floor_mat', 'floor_stone',
  'desk_monitor', 'chair', 'monitor', 'bookshelf_top', 'bookshelf_bot', 'scroll_top', 'scroll_bot', 'easel_top', 'easel_bot',
  'desk_palette', 'whiteboard_l', 'whiteboard_r', 'table_tl', 'table_br', 'sofa_l', 'sofa_r', 'coffee', 'plant', 'cat_bed',
  'ceo_desk_l', 'ceo_desk_m', 'ceo_desk_r', 'bell', 'papers'];
const ROOM_OF = {
  ceo: 'ceo', main: 'ceo', 'business-strategist': 'ceo',
  'saju-engine-developer': 'dev', 'frontend-developer': 'dev', 'backend-developer': 'dev', 'qa-security-lead': 'dev',
  'myeongri-research-director': 'research', 'personalization-researcher': 'research',
  'design-director': 'design', 'content-writer': 'design', guest: 'lounge'
};

let frameCount = 0;
function checkFrame(F, w, h, where) {
  frameCount++;
  if (!Array.isArray(F)) return err(`${where}: 프레임이 문자열 배열이 아님`);
  if (F.length !== h) err(`${where}: 줄 수 ${F.length} ≠ h ${h}`);
  F.forEach((row, i) => {
    if (typeof row !== 'string') return err(`${where} ${i}줄: 문자열 아님`);
    if (row.length !== w) err(`${where} ${i}줄: 글자 수 ${row.length} ≠ w ${w}`);
    for (const ch of row) if (!(ch in ART.palette)) { err(`${where} ${i}줄: 팔레트에 없는 문자 "${ch}"`); break; }
  });
}
function checkAnims(spec, names, where) {
  if (!spec || typeof spec !== 'object') return err(`${where}: 없음`);
  const { w, h, anims } = spec;
  if (!Number.isInteger(w) || !Number.isInteger(h)) err(`${where}: w·h 가 정수가 아님`);
  for (const a of names) {
    const an = anims && anims[a];
    if (!an) { err(`${where}.anims.${a}: 없음`); continue; }
    if (!(an.fps > 0)) err(`${where}.anims.${a}: fps 가 양수가 아님`);
    if (!Array.isArray(an.frames) || !an.frames.length) { err(`${where}.anims.${a}: frames 비어 있음`); continue; }
    an.frames.forEach((F, i) => checkFrame(F, w, h, `${where}.${a}[${i}]`));
  }
}

/* ── art.js ── */
if (!ART) err('window.OFFICE_ART 가 없습니다');
else {
  if (ART.tile !== 16) err(`tile ${ART.tile} ≠ 16`);
  const pal = ART.palette || {};
  if (!('.' in pal) || pal['.'] !== null) err('palette["."] 는 null(투명)이어야 합니다');
  for (const [k, v] of Object.entries(pal)) {
    if ([...k].length !== 1) err(`palette 키 "${k}" 가 한 글자가 아님`);
    if (k !== '.' && !/^#[0-9a-f]{6}$/i.test(String(v))) err(`palette["${k}"] = ${v} (형식 #rrggbb 아님)`);
    if (k.charCodeAt(0) > 126) warns.push(`palette 키 "${k}" 가 ASCII 밖`);
  }
  for (const id of STAFF) {
    const c = ART.characters && ART.characters[id];
    if (!c) { err(`characters.${id}: 없음`); continue; }
    if (c.w !== 16 || c.h !== 24) err(`characters.${id}: 크기 ${c.w}×${c.h} ≠ 16×24`);
    checkAnims(c, CHAR_ANIMS, `characters.${id}`);
  }
  // 캐릭터끼리 앉은 모습이 똑같으면 구별이 안 된다
  const sitSig = {};
  for (const id of STAFF) {
    const f = ART.characters?.[id]?.anims?.sit?.frames?.[0];
    if (!f) continue;
    const sig = f.join('\n');
    if (sitSig[sig]) err(`characters.${id} 앉은 모습이 ${sitSig[sig]} 와 똑같음`);
    sitSig[sig] = id;
  }
  if (!ART.cat) err('cat: 없음');
  else {
    if (ART.cat.w !== 16 || ART.cat.h !== 16) err(`cat 크기 ${ART.cat.w}×${ART.cat.h} ≠ 16×16`);
    checkAnims(ART.cat, CAT_ANIMS, 'cat');
  }
  const tiles = ART.tiles || {};
  for (const t of TILES) if (!tiles[t]) err(`tiles.${t}: 없음`);
  for (const [k, t] of Object.entries(tiles)) {
    if (!t || !Number.isInteger(t.w) || !Number.isInteger(t.h) || t.w % 16 || t.h % 16) { err(`tiles.${k}: w·h 가 16의 배수가 아님`); continue; }
    if (!Array.isArray(t.frames) || !t.frames.length) { err(`tiles.${k}: frames 비어 있음`); continue; }
    t.frames.forEach((F, i) => checkFrame(F, t.w, t.h, `tiles.${k}[${i}]`));
  }
  const icons = ART.icons || {};
  for (const n of ICONS) {
    const ic = icons[n];
    if (!ic) { err(`icons.${n}: 없음`); continue; }
    if (ic.w !== 12 || ic.h !== 12) err(`icons.${n}: 크기 ${ic.w}×${ic.h} ≠ 12×12`);
    (ic.frames || []).forEach((F, i) => checkFrame(F, 12, 12, `icons.${n}[${i}]`));
    if (!ic.frames || !ic.frames.length) err(`icons.${n}: frames 비어 있음`);
  }
  const size = statSync(join(here, 'art.js')).size;
  if (size > 150 * 1024) err(`art.js 크기 ${(size / 1024).toFixed(1)}KB > 150KB`);
}

/* ── map.js ── */
if (!MAP) err('window.OFFICE_MAP 가 없습니다');
else {
  const { cols, rows } = MAP;
  if (!Number.isInteger(cols) || !Number.isInteger(rows)) err('cols·rows 가 정수가 아님');
  const tiles = (ART && ART.tiles) || {};
  const legend = MAP.legend || {};
  for (const [ch, key] of Object.entries(legend)) {
    if ([...ch].length !== 1) err(`legend 키 "${ch}" 가 한 글자가 아님`);
    if (ch === '.') err('legend 에 "." 을 쓰지 마세요(가구층의 빈칸)');
    if (!tiles[key]) err(`legend["${ch}"] = ${key}: art.tiles 에 없음`);
    else if (tiles[key].w !== 16 || tiles[key].h !== 16) warns.push(`legend["${ch}"] = ${key} 는 16×16 이 아님(여러 칸 가구)`);
  }
  for (const ln of ['floor', 'furniture']) {
    const L = MAP.layers && MAP.layers[ln];
    if (!Array.isArray(L)) { err(`layers.${ln}: 없음`); continue; }
    if (L.length !== rows) err(`layers.${ln}: 줄 수 ${L.length} ≠ rows ${rows}`);
    L.forEach((row, y) => {
      if (row.length !== cols) err(`layers.${ln} ${y}줄: 글자 수 ${row.length} ≠ cols ${cols}`);
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ln === 'furniture' && ch === '.') continue;
        if (!(ch in legend)) err(`layers.${ln} (${x},${y}): legend 에 없는 문자 "${ch}"`);
      }
    });
    if (ln === 'floor') L.forEach((row, y) => { if (row.includes('.')) err(`layers.floor ${y}줄: 바닥층에 빈칸(.)`); });
  }
  const Wk = MAP.walkable;
  if (!Array.isArray(Wk) || Wk.length !== rows) err('walkable: 줄 수가 rows 와 다름');
  else Wk.forEach((row, y) => {
    if (row.length !== cols) err(`walkable ${y}줄: 글자 수 ${row.length} ≠ cols ${cols}`);
    if (/[^#.]/.test(row)) err(`walkable ${y}줄: '#'·'.' 외 문자`);
  });
  const inside = (p) => p && Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.y >= 0 && p.x < cols && p.y < rows;
  const pass = (p) => inside(p) && Wk && Wk[p.y] && Wk[p.y][p.x] === '.';
  const roomIds = ['ceo', 'dev', 'research', 'design', 'meeting', 'lounge'];
  const rooms = {};
  (MAP.rooms || []).forEach((r) => { rooms[r.id] = r; if (!r.name) err(`rooms.${r.id}: name 없음`); });
  for (const id of roomIds) if (!rooms[id]) err(`rooms.${id}: 없음`);
  const inRoom = (p, id) => { const r = rooms[id]; return r && p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h; };

  const desks = MAP.desks || {};
  for (const id of STAFF) {
    const d = desks[id];
    if (!d) { if (id !== 'guest') err(`desks.${id}: 없음`); continue; }
    if (!inside(d)) { err(`desks.${id}: 지도 밖`); continue; }
    if (!pass(d)) err(`desks.${id} (${d.x},${d.y}): 통행 불가 칸`);
    if (!['up', 'down', 'left', 'right'].includes(d.facing)) err(`desks.${id}: facing 값 ${d.facing}`);
    if (!inRoom(d, ROOM_OF[id])) err(`desks.${id}: 계약서 2절의 방(${ROOM_OF[id]}) 밖`);
  }
  const seen = {};
  for (const [id, d] of Object.entries(desks)) { const k = d.x + ',' + d.y; if (seen[k]) err(`desks.${id}: ${seen[k]} 와 같은 칸`); seen[k] = id; }

  const sp = MAP.spots || {};
  for (const [kind, room] of [['meeting', 'meeting'], ['lounge', 'lounge']]) {
    const arr = sp[kind];
    if (!Array.isArray(arr) || arr.length !== 8) { err(`spots.${kind}: 8곳이 아님`); continue; }
    const s2 = {};
    arr.forEach((p, i) => {
      if (!pass(p)) err(`spots.${kind}[${i}] (${p.x},${p.y}): 통행 불가`);
      if (!inRoom(p, room)) err(`spots.${kind}[${i}]: ${room} 방 밖`);
      const k = p.x + ',' + p.y; if (s2[k]) err(`spots.${kind}[${i}]: 겹침`); s2[k] = 1;
    });
  }
  if (!inside(sp.ceoBell)) err('spots.ceoBell: 없음 또는 지도 밖');
  else if (!inRoom(sp.ceoBell, 'ceo')) err('spots.ceoBell: 대표실 밖');
  if (!pass(sp.door)) err('spots.door: 없음 또는 통행 불가');

  // 정문에서 길 찾기(BFS)
  const reach = new Set();
  if (pass(sp.door)) {
    const q = [sp.door]; reach.add(sp.door.x + ',' + sp.door.y);
    while (q.length) {
      const c = q.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = { x: c.x + dx, y: c.y + dy }, k = n.x + ',' + n.y;
        if (!reach.has(k) && pass(n)) { reach.add(k); q.push(n); }
      }
    }
    const must = Object.entries(desks).map(([id, d]) => [`desks.${id}`, d])
      .concat((sp.meeting || []).map((p, i) => [`spots.meeting[${i}]`, p]))
      .concat((sp.lounge || []).map((p, i) => [`spots.lounge[${i}]`, p]));
    for (const [name, p] of must) if (inside(p) && !reach.has(p.x + ',' + p.y)) err(`${name}: 정문에서 갈 수 없음`);
  }

  const routes = MAP.catRoutes;
  if (!Array.isArray(routes) || routes.length < 2 || routes.length > 3) err('catRoutes: 2~3개가 아님');
  else routes.forEach((rt, ri) => {
    if (!Array.isArray(rt) || rt.length < 2) return err(`catRoutes[${ri}]: 점이 2개 미만`);
    const touched = new Set();
    rt.forEach((p, i) => {
      if (!pass(p)) err(`catRoutes[${ri}][${i}] (${p.x},${p.y}): 통행 불가`);
      if (i === 0) return;
      const a = rt[i - 1];
      if (a.x !== p.x && a.y !== p.y) { err(`catRoutes[${ri}] ${i - 1}→${i}: 가로·세로 직선이 아님`); return; }
      const sx = Math.sign(p.x - a.x), sy = Math.sign(p.y - a.y);
      for (let x = a.x, y = a.y; ; x += sx, y += sy) {
        if (!pass({ x, y })) { err(`catRoutes[${ri}] ${i - 1}→${i}: (${x},${y}) 통행 불가`); break; }
        for (const r of MAP.rooms || []) if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) touched.add(r.id);
        if (x === p.x && y === p.y) break;
      }
    });
    if (touched.size < 2) err(`catRoutes[${ri}]: 방을 넘나들지 않음`);
  });
}

const artKB = (statSync(join(here, 'art.js')).size / 1024).toFixed(1);
const mapKB = (statSync(join(here, 'map.js')).size / 1024).toFixed(1);
const palN = ART ? Object.keys(ART.palette).length - 1 : 0;
const jsonKB = ART ? (JSON.stringify(ART).length / 1024).toFixed(1) : '?';
console.log(`art.js ${artKB}KB (펼친 데이터 ${jsonKB}KB) · map.js ${mapKB}KB · 색 ${palN}개 · 프레임 ${frameCount}개 검사`);
warns.forEach((w) => console.log('  참고: ' + w));
if (errors.length) {
  console.log(`실패 ${errors.length}건`);
  errors.slice(0, 80).forEach((e) => console.log('  - ' + e));
  if (errors.length > 80) console.log(`  … 외 ${errors.length - 80}건`);
  process.exit(1);
}
console.log('통과');
