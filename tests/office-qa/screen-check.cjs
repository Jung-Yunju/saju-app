#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- 전역 Playwright(NODE_PATH)를 쓰는 CommonJS 검증 스크립트 */
// O-02 독립 검증 — 가상 사무실 화면(Playwright, 사전 설치 Chromium)
// 사용: NODE_PATH=$(npm root -g) node tests/office-qa/screen-check.cjs <state.json> <shotDir> <libsDir>
//   state.json : snapshot.mjs 출력(실제 기록 기반). 시각은 지금 기준으로 옮겨 쓴다.
//   libsDir    : react.js / react-dom.js / phaser.js 로컬 사본(cdnjs 차단 환경용)
// 가짜 claude.use("db")를 직접 심어 문서를 원하는 때 밀어 넣는다(dev-preview.html의 가짜 DB는 쓰기 막음).
// 결과는 JSON 한 덩어리로 출력. 실패 항목은 ok:false.
const http = require("node:http")
const fs = require("node:fs")
const path = require("node:path")
const { chromium } = require("playwright")

const [statePath, shotDir, libsDir] = process.argv.slice(2)
const WEB = path.resolve(__dirname, "..", "..", "office", "web")
fs.mkdirSync(shotDir, { recursive: true })

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const u = decodeURIComponent(req.url.split("?")[0])
      const f = u.startsWith("/libs/") ? path.join(libsDir, path.basename(u)) : path.join(WEB, path.basename(u))
      fs.readFile(f, (e, b) => {
        if (e) { rsp.writeHead(404); rsp.end(); return }
        rsp.writeHead(200, { "content-type": f.endsWith(".html") ? "text/html;charset=utf-8" : "text/javascript;charset=utf-8" })
        rsp.end(b)
      })
    })
    srv.listen(0, "127.0.0.1", () => res(srv))
  })
}

// 문서 시각을 "지금 - 1분"으로 옮긴다
function shift(doc, newGen) {
  const d = newGen - Date.parse(doc.generatedAt)
  return JSON.parse(JSON.stringify(doc), (k, v) => (typeof v === "string" && /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(v) ? new Date(Date.parse(v) + d).toISOString() : v))
}

const P = [
  '<img src=x onerror="window.__xss=(window.__xss||0)+1">',
  '<script>window.__xss=(window.__xss||0)+1</script>',
  '"><svg onload="window.__xss=(window.__xss||0)+1">',
  "javascript:window.__xss=1",
  "{{constructor.constructor('window.__xss=1')()}}",
]
function poison(doc) {
  const d = JSON.parse(JSON.stringify(doc))
  let i = 0
  const p = () => P[i++ % P.length]
  for (const s of d.staff) {
    s.name = p() + s.name; s.title = p(); s.statusLabel = p()
    s.currentFile = p(); s.location = p()
    s.task = { description: p(), cardId: p(), startedAt: s.task?.startedAt ?? null, endedAt: null }
    s.activity = (s.activity || []).slice(0, 3).map(a => ({ ...a, tool: p(), file: p(), kind: p() }))
    if (!s.activity.length) s.activity = [{ at: d.generatedAt, tool: p(), file: p(), kind: p(), ok: false }]
    s.cards = [{ id: p(), title: p(), status: p(), progress: { done: 1, total: 2 }, verification: p(), issues: p(), approval: p() }]
    s.completed = [{ id: p(), title: p() }]
    s.errors = [{ at: d.generatedAt, tool: p(), message: p() }]
    s.approvals = [p(), { message: p() }]
    s.tokens = { input: 1, output: 2, cacheRead: 3, cacheWrite: 4, total: 10, source: p() }
    s.costUsdEstimate = { usd: 0.01, basis: p() }
  }
  d.staff.push({ id: P[0], name: P[1], status: "typing", title: P[2] })
  d.ceo = { pendingApprovals: [{ at: d.generatedAt, staff: P[0], tool: P[1], message: P[2] }], boardApprovals: [{ cardId: P[0], title: P[1], item: P[2], status: P[3] }] }
  d.source = { ...d.source, backfill: { note: P[0] }, period: { from: d.generatedAt, to: d.generatedAt, timezone: P[1] } }
  return d
}

const INIT = () => {
  // Phaser.Game 인스턴스를 잡아 둔다(캐릭터 위치·애니메이션 확인용)
  let _P
  Object.defineProperty(window, "Phaser", {
    configurable: true,
    get() { return _P },
    set(v) {
      if (v && v.Game && !v.__wrapped) {
        const G = v.Game
        const W = function (cfg) { const g = new G(cfg); window.__game = g; return g }
        W.prototype = G.prototype
        v.Game = W; v.__wrapped = true
      }
      _P = v
    },
  })
  let push = null, pending, has = false
  const snap = d => ({ id: "state", exists: d !== null, data: () => d, metadata: { fromCache: false, hasPendingWrites: false } })
  window.__push = d => { if (push) push(snap(d)); else { pending = d; has = true } }
  Object.defineProperty(window, "claude", {
    configurable: false, writable: false,
    value: { use: n => Promise.resolve(n === "db" ? { doc: () => ({ onSnapshot: next => { push = next; if (has) setTimeout(() => next(snap(pending)), 10); return () => {} } }) } : null) },
  })
}

async function main() {
  const real = JSON.parse(fs.readFileSync(statePath, "utf8"))
  const srv = await serve()
  const base = `http://127.0.0.1:${srv.address().port}/dev-preview.html?libs=/libs`
  const browser = await chromium.launch()
  const out = []
  const rec = (name, ok, detail) => out.push({ name, ok, ...(detail ? { detail } : {}) })

  async function open({ vw, vh, theme, doc, scheme, reduce }) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, colorScheme: scheme || "light", reducedMotion: reduce ? "reduce" : "no-preference", hasTouch: vw < 500, isMobile: vw < 500 })
    const page = await ctx.newPage()
    const errs = []
    page.on("console", m => { if (m.type() === "error") errs.push(m.text()) })
    page.on("pageerror", e => errs.push("pageerror: " + e.message))
    page.on("dialog", d => { errs.push("dialog: " + d.message()); d.dismiss() })
    await page.addInitScript(INIT)
    await page.goto(base + (theme ? `&theme=${theme}` : ""))
    await page.waitForFunction(() => !!window.OfficeApp && !!window.__push, null, { timeout: 15000 })
    if (doc !== undefined) await page.evaluate(d => window.__push(d), doc)
    await page.waitForTimeout(1200)
    return { ctx, page, errs }
  }
  const hscroll = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  const anims = page => page.evaluate(() => {
    const g = window.__game; if (!g) return null
    const sc = g.scene.scenes[0]; if (!sc || !sc.ents) return null
    return Object.values(sc.ents).map(e => ({ id: e.id, status: e.status, visible: e.sp.visible, alpha: e.sp.alpha, anim: e.sp.anims.currentAnim ? e.sp.anims.currentAnim.key : null, playing: e.sp.anims.isPlaying, moving: !!e.moving }))
  })

  const fresh = shift(real, Date.now() - 60000)

  // 1) 화면 4조합: 실제 기록 문서(신선) — 콘솔 오류·가로 스크롤
  for (const [vw, vh] of [[390, 844], [1280, 800]]) {
    for (const theme of ["light", "dark"]) {
      const { ctx, page, errs } = await open({ vw, vh, theme, doc: fresh, scheme: theme })
      const hs = await hscroll(page)
      await page.screenshot({ path: path.join(shotDir, `real-${vw}-${theme}.png`), fullPage: true })
      // 캔버스 안 캐릭터 클릭 → 상세 패널
      const target = await page.evaluate(() => {
        const g = window.__game, sc = g && g.scene.scenes[0]; if (!sc) return null
        const cv = document.querySelector("#stage canvas").getBoundingClientRect(), cam = sc.cameras.main
        const e = Object.values(sc.ents).find(x => x.sp.visible && x.id !== "ceo")
        if (!e) return null
        const wx = e.sp.x, wy = e.sp.y - e.h / 2
        const p = cam.getWorldPoint(0, 0)
        return { id: e.id, x: cv.left + (wx - p.x) * cam.zoom, y: cv.top + (wy - p.y) * cam.zoom }
      })
      let panel = null
      if (target) {
        await page.evaluate(() => document.getElementById("stage").scrollIntoView({ block: "center" }))
        const t2 = await page.evaluate(id => {
          const sc = window.__game.scene.scenes[0], e = sc.ents[id]
          const cv = document.querySelector("#stage canvas").getBoundingClientRect(), cam = sc.cameras.main, p = cam.getWorldPoint(0, 0)
          return { x: cv.left + (e.sp.x - p.x) * cam.zoom, y: cv.top + (e.sp.y - e.h / 2 - p.y) * cam.zoom }
        }, target.id)
        if (vw < 500) await page.touchscreen.tap(t2.x, t2.y); else await page.mouse.click(t2.x, t2.y)
        await page.waitForTimeout(500)
        panel = await page.evaluate(() => { const a = document.querySelector("aside.side"); return a ? a.getAttribute("aria-label") : null })
        await page.screenshot({ path: path.join(shotDir, `real-${vw}-${theme}-detail.png`) })
        const hs2 = await hscroll(page)
        rec(`상세 패널 ${vw}px ${theme} (캔버스 캐릭터 ${target.id} 클릭)`, !!panel && hs2 <= 0, { panel, hscrollAfter: hs2 })
      } else rec(`상세 패널 ${vw}px ${theme}`, false, "보이는 캐릭터 없음")
      rec(`화면 ${vw}px ${theme}: 콘솔 오류 0·가로 스크롤 0`, errs.length === 0 && hs <= 0, { errs, hscroll: hs })
      await ctx.close()
    }
  }

  // 2) 모바일 방 탭 6개 확대 + 가로 스크롤
  {
    const { ctx, page, errs } = await open({ vw: 390, vh: 844, theme: "light", doc: fresh })
    const tabs = await page.$$eval(".tabs button", b => b.map(x => x.textContent))
    const res = []
    for (const t of tabs) {
      await page.click(`.tabs button:has-text("${t}")`)
      await page.waitForTimeout(600)
      res.push({ t, zoom: await page.evaluate(() => window.__game.scene.scenes[0].cameras.main.zoom), hs: await hscroll(page) })
    }
    await page.screenshot({ path: path.join(shotDir, "mobile-tab-lounge.png") })
    rec("모바일 방 탭(전체+6개) 확대·가로 스크롤 0", tabs.length === 7 && res.every(r => r.hs <= 0) && errs.length === 0, { res, errs })
    await ctx.close()
  }

  // 3) XSS: 모든 문자열 필드에 HTML/스크립트 주입
  {
    const { ctx, page, errs } = await open({ vw: 1280, vh: 800, theme: "light", doc: poison(fresh) })
    // 모든 직원 상세를 열어 본다
    const n = await page.$$eval(".srow", x => x.length)
    for (let i = 0; i < n; i++) { await page.locator(".srow").nth(i).click(); await page.waitForTimeout(80) }
    const dbg = await page.evaluate(() => ({ rows: document.querySelectorAll(".srow").length, root: document.getElementById("root").innerText.slice(0, 300) }))
    if (dbg.rows) { await page.locator(".srow").first().click(); await page.waitForTimeout(100) }
    const r = await page.evaluate(() => ({
      xss: window.__xss || 0,
      injectedEls: document.querySelectorAll("#root img, #root svg, #root script, #root iframe, [onerror], [onload]").length,
      textHasPayload: document.body.innerText.includes("<img src=x onerror"),
    }))
    await page.screenshot({ path: path.join(shotDir, "xss-1280.png"), fullPage: true })
    rec("XSS 주입 문자열이 실행·요소화되지 않고 글자로만 표시", r.xss === 0 && r.injectedEls === 0 && r.textHasPayload && !errs.some(e => /dialog/.test(e)), { ...r, staffRows: n, dbg, errs: errs.slice(0, 5) })
    await ctx.close()
  }

  // 4) 예시: DB 문서 자체가 sample:true 일 때 배너
  {
    const sampleDoc = await (async () => {
      const { ctx, page } = await open({ vw: 390, vh: 844 })
      const d = await page.evaluate(() => window.OfficeApp.makeSample(Date.now()))
      await ctx.close(); return d
    })()
    for (const [label, doc] of [["sample:true 문서(DB)", sampleDoc], ["sample:true + 30분 초과", shift(sampleDoc, Date.now() - 45 * 60000)]]) {
      const { ctx, page, errs } = await open({ vw: 390, vh: 844, doc })
      const bar = await page.evaluate(() => { const b = document.querySelector(".sample-bar"); return b ? { text: b.innerText, top: b.getBoundingClientRect().top, pos: getComputedStyle(b).position } : null })
      await page.evaluate(() => window.scrollTo(0, 600)); await page.waitForTimeout(200)
      const barTopAfterScroll = await page.evaluate(() => { const b = document.querySelector(".sample-bar"); return b ? b.getBoundingClientRect().top : null })
      await page.screenshot({ path: path.join(shotDir, `sample-${label.replace(/[^a-z0-9]+/gi, "_")}.png`) })
      rec(`예시 배너: ${label}`, !!bar && bar.text.includes("예시 화면 — 실제 업무가 아닙니다") && barTopAfterScroll === 0, { bar, barTopAfterScroll, errs })
      await ctx.close()
    }
    // 예시 버튼 경로(실제 데이터 없음 → 버튼 → 배너)
    const { ctx, page, errs } = await open({ vw: 390, vh: 844, doc: null })
    const btn = await page.$("button:has-text('예시 화면 보기')")
    if (btn) await btn.click()
    await page.waitForTimeout(500)
    const bar = await page.evaluate(() => !!document.querySelector(".sample-bar") && document.querySelector(".sample-bar").innerText)
    rec("예시 버튼 경로: 실제 문서 없음 → 버튼 → 배너", !!btn && typeof bar === "string" && bar.includes("예시 화면 — 실제 업무가 아닙니다"), { errs })
    // 예시 상태에서 실제 문서가 들어오면 예시가 꺼지는지
    await page.evaluate(d => window.__push(d), fresh); await page.waitForTimeout(500)
    const bar2 = await page.evaluate(() => !!document.querySelector(".sample-bar"))
    rec("예시 보는 중 실제 문서 도착 → 예시·배너 해제", bar2 === false)
    await ctx.close()
  }

  // 5) 확인 불가 원칙: 문서 없음/null/30분 초과/수신 후 오래됨 → 일하는 동작 없음
  for (const [label, doc] of [["문서 없음(exists:false)", null], ["30분 초과 문서", shift(fresh, Date.now() - 31 * 60000)], ["형식 불일치", { schemaVersion: 2, staff: fresh.staff }]]) {
    const { ctx, page, errs } = await open({ vw: 1280, vh: 800, doc })
    await page.waitForTimeout(800)
    const a = await anims(page)
    const sum = await page.evaluate(() => [...document.querySelectorAll(".summary li .v")].map(x => x.textContent))
    const chips = await page.$$eval(".srow .chip", x => x.map(c => c.textContent))
    const working = (a || []).filter(e => e.visible && /:(type|read|walk|walkSide|walkUp)$/.test(e.anim || "") && e.playing)
    rec(`확인 불가: ${label} → 작업·걷기 애니메이션 0, 업무 중 표시 0`, a !== null && working.length === 0 && chips.every(c => !/코드 작성|자료 조사|실행·테스트|업무 중/.test(c)), { working, summary: sum, chips: [...new Set(chips)], errs })
    await ctx.close()
  }
  // 5b) 신선한 문서 수신 후 화면을 열어 둔 채 30분이 지나는 경우(시계 이동)
  {
    const work = JSON.parse(JSON.stringify(fresh))
    const s = work.staff.find(x => x.id === "saju-engine-developer"); s.status = "typing"; s.statusLabel = "코드 작성"
    const r = work.staff.find(x => x.id === "design-director"); r.status = "resting"; r.location = "lounge"
    const { ctx, page, errs } = await open({ vw: 1280, vh: 800, doc: work })
    await page.waitForTimeout(800)
    const before = (await anims(page)).find(e => e.id === "saju-engine-developer")
    // Date.now를 31분 뒤로 옮긴다
    await page.evaluate(() => { const off = 31 * 60000, n = Date.now; Date.now = () => n() + off })
    await page.waitForTimeout(1500)
    const mid = await anims(page)
    await page.waitForTimeout(2500)
    const after = await anims(page)
    const banner = await page.evaluate(() => { const b = document.querySelector(".banner"); return b ? b.innerText.split("\n")[0] : null })
    const walkedOnStale = mid.filter(e => e.moving || /:walk/.test(e.anim || "")).map(e => e.id)
    const workingAfter = after.filter(e => e.visible && /:(type|read)$/.test(e.anim || "") && e.playing)
    rec("열어 둔 화면이 30분 지나 오래됨 → 전원 확인 불가, 작업 애니메이션 정지", before && /:type$/.test(before.anim) && workingAfter.length === 0 && /마지막 갱신/.test(banner || ""), { before, banner, workingAfter, errs })
    rec("오래됨 전환 시 근거 없는 이동(걷기) 없음", walkedOnStale.length === 0, { walkedOnStale })
    await ctx.close()
  }
  // 5c) 미래 시각 generatedAt
  {
    const fut = shift(fresh, Date.now() + 365 * 86400000)
    const { ctx, page } = await open({ vw: 1280, vh: 800, doc: fut })
    const chips = await page.$$eval(".srow .chip", x => x.map(c => c.textContent))
    const banner = await page.evaluate(() => { const b = document.querySelector(".banner"); return b ? b.innerText.split("\n")[0] : null })
    rec("미래 generatedAt(1년 뒤) 문서 → 확인 불가로 처리", chips.every(c => !/코드 작성|자료 조사|실행·테스트|업무 중|휴식/.test(c)), { chips: [...new Set(chips)], banner })
    await ctx.close()
  }
  // 5d) 수집 연결 없음(claude 없음)·10초 무응답은 dev-preview mode=null/hang 으로 확인
  for (const mode of ["null", "hang"]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await ctx.newPage(); const errs = []
    page.on("pageerror", e => errs.push(e.message)); page.on("console", m => { if (m.type() === "error") errs.push(m.text()) })
    await page.goto(base + `&mode=${mode}`)
    await page.waitForTimeout(mode === "hang" ? 11500 : 1500)
    const banner = await page.evaluate(() => { const b = document.querySelector(".banner"); return b ? b.innerText.split("\n")[0] : null })
    const chips = await page.$$eval(".srow .chip", x => [...new Set(x.map(c => c.textContent))])
    rec(`연결 ${mode === "null" ? "없음(db=null)" : "10초 무응답"} → 배너·전원 확인 불가`, /수집 연결 안 됨|응답 없음/.test(banner || "") && chips.every(c => /상태 확인 불가|추적 대상 아님/.test(c)) && errs.length === 0, { banner, chips, errs })
    await ctx.close()
  }
  // 6) reduced-motion: 복자 정지
  {
    const { ctx, page } = await open({ vw: 390, vh: 844, doc: fresh, reduce: true })
    await page.waitForTimeout(4000)
    const cat = await page.evaluate(() => { const sc = window.__game.scene.scenes[0]; return sc.catEnt ? { anim: sc.catEnt.sp.anims.currentAnim && sc.catEnt.sp.anims.currentAnim.key, playing: sc.catEnt.sp.anims.isPlaying, tweens: sc.tweens.getTweensOf(sc.catEnt.sp).length } : null })
    rec("reduced-motion: 복자 산책·애니메이션 정지", !cat || (!cat.playing && cat.tweens === 0), { cat })
    await ctx.close()
  }

  await browser.close(); srv.close()
  console.log(JSON.stringify({ pass: out.filter(x => x.ok).length, fail: out.filter(x => !x.ok).length, results: out }, null, 2))
}
main().catch(e => { console.error(e); process.exit(1) })
