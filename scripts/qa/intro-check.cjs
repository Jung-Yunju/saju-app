// 인트로 시안 독립 검증(품질검증 담당) — design/intro/{lamp,door,door-sewing,pillars}.html (+ index.html)
// 실행: node scripts/qa/intro-check.cjs [스크린샷 폴더]   (사전 설치 chromium, require('playwright'))
// 측정: 휴대폰 390×844. "휴대폰 흉내" = CPU 4배 느림 + 지연 150ms·1.6Mbps(3회 중앙값). 실제 기기 측정이 아니다.
// 결과는 JSON으로 표준출력에 낸다. 제품 파일은 읽기만 한다.
const { chromium } = require("playwright")
const http = require("node:http")
const fs = require("node:fs")
const path = require("node:path")
const zlib = require("node:zlib")

const ROOT = path.join(__dirname, "..", "..", "design", "intro")
const SHOTS = process.argv[2] || path.join(require("node:os").tmpdir(), "qa-intro")
fs.mkdirSync(SHOTS, { recursive: true })
const PAGES = ["lamp", "door", "door-sewing", "pillars"]
const VIEW = { width: 390, height: 844 }
const ALLOWED_HOSTS = new Set(["127.0.0.1", "fonts.googleapis.com", "fonts.gstatic.com"])

function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      const u = new URL(req.url, "http://x")
      const f = path.join(ROOT, path.normalize(decodeURIComponent(u.pathname)).replace(/^(\.\.[/\\])+/, ""))
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end() }
      const body = fs.readFileSync(f)
      const gz = /gzip/.test(req.headers["accept-encoding"] || "")
      rsp.writeHead(200, { "content-type": "text/html; charset=utf-8", ...(gz ? { "content-encoding": "gzip" } : {}) })
      rsp.end(gz ? zlib.gzipSync(body) : body)
    })
    srv.listen(0, "127.0.0.1", () => res(srv))
  })
}

// 문서 시작 전에 심는 계측: 소리 API 호출, 버튼 보임 시점, 클래스 변화(is-done 시점), FCP/LCP
const INSTRUMENT = () => {
  const w = window
  w.__qa = { sound: [], vis: [], classes: [], lcp: 0, anims: null }
  const hook = (obj, name, label) => { try { const o = obj && obj[name]; if (!o) return; obj[name] = new Proxy(o, { construct(t, a) { w.__qa.sound.push(label); return Reflect.construct(t, a) }, apply(t, th, a) { w.__qa.sound.push(label); return Reflect.apply(t, th, a) } }) } catch (e) {} }
  hook(w, "AudioContext", "AudioContext"); hook(w, "webkitAudioContext", "webkitAudioContext"); hook(w, "Audio", "Audio")
  try { const pl = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { w.__qa.sound.push("media.play"); return pl.apply(this, arguments) } } catch (e) {}
  try { if (w.speechSynthesis) { const sp = w.speechSynthesis.speak.bind(w.speechSynthesis); w.speechSynthesis.speak = (u) => { w.__qa.sound.push("speech"); return sp(u) } } } catch (e) {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__qa.lcp = e.startTime }).observe({ type: "largest-contentful-paint", buffered: true }) } catch (e) {}
  // 계측 시점엔 documentElement가 아직 없으므로 document 전체를 보고 html 요소의 class 변화만 거른다
  new MutationObserver((ms) => { for (const m of ms) if (m.type === "attributes" && m.target === document.documentElement) w.__qa.classes.push([performance.now(), document.documentElement.className]) }).observe(document, { attributes: true, subtree: true, attributeFilter: ["class"] })
  const effOpacity = (el) => { let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === "none" || cs.visibility === "hidden") return 0; o *= parseFloat(cs.opacity) } return o }
  const state = (sel) => {
    const el = document.querySelector(sel); if (!el) return null
    const r = el.getBoundingClientRect(); const o = effOpacity(el)
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2
    const top = document.elementFromPoint(cx, cy)
    const inView = r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth && r.width > 0
    return { o: +o.toFixed(3), inView, onTop: !!top && (top === el || el.contains(top)), w: r.width, h: r.height }
  }
  const tick = () => {
    try { if (document.body) {
      if (!w.__qa.anims) {
        const a = document.getAnimations()
        w.__qa.anims = { count: a.length, maxEnd: Math.max(0, ...a.map((x) => { const t = x.effect.getComputedTiming(); return (t.endTime || 0) / (x.playbackRate || 1) })) }
      }
      w.__qa.vis.push([performance.now(), state("#ctl"), state(".btn")])
    } } catch (e) { w.__qa.tickErr = String(e) }
    if (performance.now() < 1500) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  document.addEventListener("DOMContentLoaded", () => {
    // 압축본 재생 속도(RATE)는 첫 스크립트 실행 뒤 걸리므로 한 프레임 뒤 다시 잰다
    requestAnimationFrame(() => { const a = document.getAnimations(); w.__qa.animsAfter = { count: a.length, maxEnd: Math.max(0, ...a.map((x) => { const t = x.effect.getComputedTiming(); return (t.endTime || 0) / (x.playbackRate || 1) })) } })
  })
}

const BLOCK_STORAGE = () => { Object.defineProperty(window, "localStorage", { configurable: true, get() { throw new DOMException("The operation is insecure.", "SecurityError") } }) }
const QUOTA_STORAGE = () => { Storage.prototype.setItem = function () { throw new DOMException("QuotaExceededError", "QuotaExceededError") } }

async function newCtx(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ...opts })
  await ctx.addInitScript(INSTRUMENT)
  return ctx
}
function watch(page) {
  const log = { errors: [], console: [], requests: [], bytes: { own: 0, font: 0, other: 0 } }
  page.on("pageerror", (e) => log.errors.push(String(e.message || e)))
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") log.console.push(m.type() + ": " + m.text()) })
  page.on("requestfinished", async (r) => {
    const u = new URL(r.url()); log.requests.push(u.host + u.pathname.slice(0, 40))
    let n = 0; try { const s = await r.sizes(); n = s.responseBodySize + s.responseHeadersSize } catch (e) {}
    if (u.hostname === "127.0.0.1") log.bytes.own += n; else if (/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) log.bytes.font += n; else log.bytes.other += n
  })
  return log
}
async function throttle(page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 })
  await cdp.send("Network.enable")
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 })
}
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }
const fcpOf = (page) => page.evaluate(() => (performance.getEntriesByName("first-contentful-paint")[0] || {}).startTime || null)

// 글자 대비: 글자만 투명하게 한 뒤 그 자리 배경 픽셀을 찍어, 글자색과의 대비(최소·하위 5%·중앙값)를 구한다
async function contrast(page) {
  const items = await page.evaluate(() => {
    const out = []
    const els = [...document.querySelectorAll("body *")].filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
    els.forEach((el, i) => {
      const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight) return
      const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none") return
      let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity)
      if (o < 0.05) return
      const isSvg = el instanceof SVGElement
      el.setAttribute("data-qa-c", String(i))
      out.push({ i, tag: el.tagName.toLowerCase(), text: el.textContent.trim().slice(0, 24), color: isSvg ? cs.fill : cs.color, size: parseFloat(cs.fontSize), weight: +cs.fontWeight || 400, opacity: o, isSvg, rect: { x: Math.max(0, r.left), y: Math.max(0, r.top), width: Math.min(r.width, innerWidth - Math.max(0, r.left)), height: Math.min(r.height, innerHeight - Math.max(0, r.top)) } })
    })
    return out
  })
  const res = []
  for (const it of items) {
    if (it.rect.width < 1 || it.rect.height < 1) continue
    await page.addStyleTag({ content: `[data-qa-c="${it.i}"],[data-qa-c="${it.i}"] *{color:transparent!important;fill:transparent!important;text-shadow:none!important;-webkit-text-stroke:0!important;caret-color:transparent!important}` }).then((h) => h.evaluate((s) => (s.id = "qa-hide")))
    const png = await page.screenshot({ clip: it.rect, animations: "disabled" })
    await page.evaluate(() => document.querySelectorAll("#qa-hide").forEach((s) => s.remove()))
    const stat = await page.evaluate(async ({ b64, color, opacity }) => {
      const blob = await (await fetch("data:image/png;base64," + b64)).blob()
      const bmp = await createImageBitmap(blob); const c = new OffscreenCanvas(bmp.width, bmp.height); const g = c.getContext("2d"); g.drawImage(bmp, 0, 0)
      const d = g.getImageData(0, 0, bmp.width, bmp.height).data
      const m = /rgba?\(([^)]+)\)/.exec(color); if (!m) return null
      const [cr, cg, cb, ca0] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); const ca = (isNaN(ca0) ? 1 : ca0) * opacity
      const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
      const L = (r, g2, b) => 0.2126 * lin(r) + 0.7152 * lin(g2) + 0.0722 * lin(b)
      const rs = []
      for (let k = 0; k < d.length; k += 4 * 3) {
        const br = d[k], bg = d[k + 1], bb = d[k + 2]
        const tr = cr * ca + br * (1 - ca), tg = cg * ca + bg * (1 - ca), tb = cb * ca + bb * (1 - ca)
        const l1 = L(tr, tg, tb), l2 = L(br, bg, bb); rs.push((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05))
      }
      rs.sort((a, b) => a - b)
      return { min: rs[0], p5: rs[Math.floor(rs.length * 0.05)], med: rs[Math.floor(rs.length / 2)] }
    }, { b64: png.toString("base64"), color: it.color, opacity: it.opacity })
    if (!stat) continue
    const large = it.size >= 24 || (it.size >= 18.66 && it.weight >= 700)
    res.push({ text: it.text, tag: it.tag, size: it.size, weight: it.weight, need: large ? 3 : 4.5, min: +stat.min.toFixed(2), p5: +stat.p5.toFixed(2), med: +stat.med.toFixed(2) })
  }
  return res
}

;(async () => {
  const srv = await serve()
  const base = `http://127.0.0.1:${srv.address().port}/`
  const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "127.0.0.1" } : undefined })
  const out = { base: "390x844", pages: {} }
  for (const name of PAGES) {
    const raw = fs.readFileSync(path.join(ROOT, name + ".html"))
    const R = (out.pages[name] = { htmlBytes: raw.length, htmlGzip: zlib.gzipSync(raw).length })

    // 1) 보통 조건 첫 방문 + 재방문
    {
      const ctx = await newCtx(browser); const page = await ctx.newPage(); const log = watch(page)
      const t0 = Date.now()
      await page.goto(base + name + ".html", { waitUntil: "load" })
      await page.waitForTimeout(150); await page.screenshot({ path: path.join(SHOTS, `${name}-0.15s.png`) })
      await page.waitForTimeout(1200); await page.screenshot({ path: path.join(SHOTS, `${name}-1.35s.png`) })
      await page.waitForFunction(() => document.documentElement.classList.contains("is-done"), null, { timeout: 10000 }).catch(() => {})
      await page.waitForTimeout(700) // 'load' 뒤 늦게 붙는 글꼴 요청까지 받는다
      const q = await page.evaluate(() => ({ cls: document.documentElement.className, qa: window.__qa, fcp: (performance.getEntriesByName("first-contentful-paint")[0] || {}).startTime, seen: (() => { try { return localStorage.getItem("halmi-intro-seen") } catch (e) { return "ERR" } })(), running: document.getAnimations().filter((a) => a.playState === "running").length, audioTags: document.querySelectorAll("audio,video").length }))
      await page.screenshot({ path: path.join(SHOTS, `${name}-end.png`) })
      const doneAt = (q.qa.classes.find((c) => /is-done/.test(c[1])) || [])[0]
      const playAt = (q.qa.classes.find((c) => /is-play/.test(c[1])) || [0])[0]
      if (!q.qa.vis.length) throw new Error("no samples: " + q.qa.tickErr)
      const firstVis = q.qa.vis[0]
      const firstBoth = q.qa.vis.find((v) => v[1] && v[2] && v[1].o >= 0.99 && v[2].o >= 0.99 && v[1].inView && v[2].inView && v[1].onTop && v[2].onTop)
      const minOp = q.qa.vis.reduce((m, v) => [Math.min(m[0], v[1] ? v[1].o : 0), Math.min(m[1], v[2] ? v[2].o : 0)], [1, 1])
      R.normal = {
        fcpMs: Math.round(q.fcp), lcpMs: Math.round(q.qa.lcp), initialClass: (q.qa.classes[0] || [0, ""])[1],
        playToDoneMs: doneAt ? Math.round(doneAt - playAt) : null, animCount: q.qa.animsAfter ? q.qa.animsAfter.count : null,
        animMaxEndMs: q.qa.animsAfter ? Math.round(q.qa.animsAfter.maxEnd) : null,
        firstSample: { t: Math.round(firstVis[0]), ctl: firstVis[1], btn: firstVis[2] }, bothFullyVisibleAtMs: firstBoth ? Math.round(firstBoth[0]) : null,
        minOpacityFirst1500ms: { ctl: minOp[0], btn: minOp[1] }, sound: q.qa.sound, audioTags: q.audioTags, seenAfter: q.seen, runningAfterDone: q.running,
        errors: log.errors, console: log.console, hosts: [...new Set(log.requests.map((r) => r.split("/")[0]))], bytes: log.bytes,
        disallowedHosts: [...new Set(log.requests.map((r) => r.split("/")[0].split(":")[0]))].filter((h) => !ALLOWED_HOSTS.has(h)),
      }
      // 버튼 크기(끝 장면)
      R.sizes = await page.evaluate(() => Object.fromEntries(["#ctl", ".btn"].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [s, { w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom) }] })))
      // 건너뛰기 → 끝 장면, 다시 보기 → 재생
      await page.goto(base + name + ".html?fresh=1"); await page.waitForTimeout(200)
      await page.click("#ctl"); const afterSkip = await page.evaluate(() => ({ cls: document.documentElement.className, label: document.getElementById("ctl").textContent }))
      await page.click("#ctl"); const afterReplay = await page.evaluate(() => ({ cls: document.documentElement.className, label: document.getElementById("ctl").textContent, anims: document.getAnimations().length }))
      R.skip = { afterSkip, afterReplay }
      // 재방문
      await page.goto(base + name + ".html", { waitUntil: "load" }); await page.waitForTimeout(100)
      R.revisit = await page.evaluate(() => ({ cls: document.documentElement.className, anims: document.getAnimations().length, ctl: document.getElementById("ctl").textContent }))
      await page.screenshot({ path: path.join(SHOTS, `${name}-revisit.png`) })
      // 끝 장면 글자 대비
      await page.goto(base + name + ".html?at=end", { waitUntil: "load" }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(200)
      R.contrast = await contrast(page)
      // ?at= 에 숫자가 아닌 값(검수용 매개변수 견고성)
      const e2 = []; page.on("pageerror", (e) => e2.push(String(e.message)))
      await page.goto(base + name + ".html?at=abc", { waitUntil: "load" }); await page.waitForTimeout(150)
      R.atNonNumeric = { errors: e2.slice() }
      await ctx.close()
      R.normal.wallMs = Date.now() - t0
    }
    // 2) 휴대폰 흉내 3회
    {
      const fcps = [], lcps = [], vis = []
      for (let k = 0; k < 3; k++) {
        const ctx = await newCtx(browser); const page = await ctx.newPage(); await throttle(page)
        await page.goto(base + name + ".html", { waitUntil: "load", timeout: 60000 }); await page.waitForTimeout(2500)
        const q = await page.evaluate(() => ({ fcp: (performance.getEntriesByName("first-contentful-paint")[0] || {}).startTime, lcp: window.__qa.lcp, vis: window.__qa.vis }))
        fcps.push(q.fcp); lcps.push(q.lcp)
        const fb = q.vis.find((v) => v[1] && v[2] && v[1].o >= 0.99 && v[2].o >= 0.99 && v[1].inView && v[2].inView)
        vis.push(fb ? fb[0] : null)
        await ctx.close()
      }
      R.throttled = { fcpMedianMs: Math.round(median(fcps)), fcpRuns: fcps.map(Math.round), lcpMedianMs: Math.round(median(lcps)), lcpRuns: lcps.map(Math.round), buttonsVisibleMs: vis.map((v) => (v == null ? null : Math.round(v))) }
    }
    // 3) 움직임 줄이기
    {
      const ctx = await newCtx(browser, { reducedMotion: "reduce" }); const page = await ctx.newPage(); const log = watch(page)
      await page.goto(base + name + ".html?fresh=1", { waitUntil: "load" }); await page.waitForTimeout(300)
      R.reduced = await page.evaluate(() => ({ cls: document.documentElement.className, running: document.getAnimations().filter((a) => a.playState === "running").length, ctlDisplay: getComputedStyle(document.getElementById("ctl")).display, btnVisible: !!document.querySelector(".btn").offsetParent }))
      R.reduced.errors = log.errors
      await page.screenshot({ path: path.join(SHOTS, `${name}-reduced.png`) })
      await ctx.close()
    }
    // 4) 저장소 차단(SecurityError) / 용량 초과(QuotaExceeded)
    for (const [label, fn] of [["blocked", BLOCK_STORAGE], ["quota", QUOTA_STORAGE]]) {
      const ctx = await newCtx(browser); await ctx.addInitScript(fn); const page = await ctx.newPage(); const log = watch(page)
      await page.goto(base + name + ".html", { waitUntil: "load" }); await page.waitForTimeout(200)
      const start = await page.evaluate(() => document.documentElement.className)
      await page.waitForFunction(() => document.documentElement.classList.contains("is-done"), null, { timeout: 8000 }).catch(() => {})
      const end = await page.evaluate(() => document.documentElement.className)
      await page.click("#ctl"); const replay = await page.evaluate(() => document.documentElement.className)
      await page.reload({ waitUntil: "load" }); await page.waitForTimeout(100)
      const second = await page.evaluate(() => document.documentElement.className)
      R["storage_" + label] = { start, end, replay, secondVisit: second, errors: log.errors, console: log.console.filter((c) => !/fonts/.test(c)) }
      await ctx.close()
    }
  }
  // index.html(비교판): 외부 호스트·오류만
  {
    const ctx = await newCtx(browser); const page = await ctx.newPage(); const log = watch(page)
    await page.goto(base + "index.html", { waitUntil: "load" }); await page.waitForTimeout(3500)
    await page.screenshot({ path: path.join(SHOTS, "index.png"), fullPage: true })
    out.index = { errors: log.errors, hosts: [...new Set(log.requests.map((r) => r.split("/")[0]))] }
    await ctx.close()
  }
  await browser.close(); srv.close()
  console.log(JSON.stringify(out, null, 1))
})().catch((e) => { console.error(e); process.exit(1) })
