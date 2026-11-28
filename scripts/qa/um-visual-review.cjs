// 운명비서 독립 시각 검수 보조 — 품질검증 담당(2026-11-28)
// visual-check.cjs(디자인 실장 도구)와 독립적으로, 사람 눈 검수용 스크린샷과 측정값을 만든다.
//   - 결과 화면: 전체 페이지(fullPage) — 근거 접기(「할미는 어떻게 알았을까?」)를 닫은 상태·연 상태 둘 다
//   - 입력 화면: 쪽 안 스크롤(fit-lock)을 끝까지 내려 가며 여러 장
//   - 측정: 터치 대상 44px 미만, 16px 미만 본문 문단, 줄 끝 외톨이(마지막 줄에 짧은 한 덩어리), 감싸기 줄에서 한 항목만 다음 줄로 떨어짐
// 사용: NODE_PATH=/opt/node-tools/node_modules node scripts/qa/um-visual-review.cjs <미리보기 폴더> <출력 폴더> [--only=a412,...]
/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright")
const http = require("node:http")
const fs = require("node:fs")
const path = require("node:path")

const args = process.argv.slice(2)
const pos = args.filter(a => !a.startsWith("--"))
const opt = Object.fromEntries(args.filter(a => a.startsWith("--")).map(a => { const [k, v] = a.slice(2).split("="); return [k, v ?? "1"] }))
const ROOT = path.resolve(pos[0])
const OUT = path.resolve(pos[1])
fs.mkdirSync(OUT, { recursive: true })

const UA_A = "Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"
const UA_I = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1"
const mob = (w, h, dsf, ua) => ({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true, userAgent: ua })
const CONDS = [
  { id: "a412", ctx: mob(412, 915, 2.625, UA_A) },
  { id: "i390", ctx: mob(390, 844, 3, UA_I) },
  { id: "a360", ctx: mob(360, 740, 3, UA_A) },
  { id: "a412-115", ctx: mob(412, 915, 2.625, UA_A), zoom: 1.15 },
  { id: "a412-130", ctx: mob(412, 915, 2.625, UA_A), zoom: 1.3 },
  // 추가 조건(도구에 없음): 크롬 안드로이드 「페이지 확대」 방식 — 화면 전체가 커지므로 CSS 폭이 줄어든 것과 같다
  { id: "pz412-130", ctx: mob(317, 704, 2.625 * 1.3, UA_A) },
  { id: "pz412-150", ctx: mob(275, 610, 2.625 * 1.5, UA_A) },
  { id: "fold344", ctx: mob(344, 882, 2.625, UA_A) }, // 갤럭시 Z 폴드 덮개 화면 근사
  { id: "pc1440", ctx: { viewport: { width: 1440, height: 900 } } },
  { id: "pc1920", ctx: { viewport: { width: 1920, height: 1080 } } },
].filter(c => !opt.only || opt.only.split(",").includes(c.id))

function serve() {
  const T = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".mp4": "video/mp4", ".webm": "video/webm" }
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const rel = path.normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "")
      const f = path.join(ROOT, rel || "index.html")
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end() }
      rsp.writeHead(200, { "content-type": T[path.extname(f)] || "application/octet-stream" })
      fs.createReadStream(f).pipe(rsp)
    })
    srv.listen(0, "127.0.0.1", () => res(srv))
  })
}

// 글자 확대 흉내 — visual-check.cjs 와 같은 방식(비교 가능하도록)
async function zoomText(page, z) {
  if (!z) return
  await page.evaluate(async z => {
    const settle = async () => { void document.body.offsetHeight; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))) }
    const root = document.documentElement
    for (const el of document.querySelectorAll("[data-vc-z]")) { el.style.removeProperty("font-size"); el.removeAttribute("data-vc-z") }
    root.style.fontSize = ""; await settle()
    const els = [...document.body.querySelectorAll("*")]
    const base = els.map(el => parseFloat(getComputedStyle(el).fontSize))
    root.style.fontSize = `${z * 100}%`; await settle()
    const now = els.map(el => parseFloat(getComputedStyle(el).fontSize))
    els.forEach((el, i) => { if (now[i] < base[i] * z - 0.3) { el.style.setProperty("font-size", `${(base[i] * z).toFixed(2)}px`, "important"); el.setAttribute("data-vc-z", "") } })
  }, z)
  await page.waitForTimeout(300)
}

function measure() {
  const out = { touch: [], small: [], orphan: [], wrapItem: [], sizes: {} }
  const vis = el => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== "none" && s.visibility !== "hidden" && r.width > 1 && r.height > 1 && !el.closest(".pv-tag") && !el.closest("details:not([open]) > :not(summary)") }
  const name = el => { const c = [...el.classList].slice(0, 2).join("."); return el.tagName.toLowerCase() + (c ? "." + c : "") }
  const txt = el => (el.innerText || el.value || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 30)
  // 터치 대상: 클릭 가능한 것. 라디오는 감싼 label 크기로 본다
  const targets = new Set()
  document.querySelectorAll("a[href], button, select, input:not([type=hidden]), summary, [role=button]").forEach(el => {
    if (el.matches("input[type=radio], input[type=checkbox]")) { const l = el.closest("label") || (el.id && document.querySelector(`label[for="${el.id}"]`)); if (l) targets.add(l); return }
    targets.add(el)
  })
  for (const el of targets) {
    if (!vis(el)) continue
    const r = el.getBoundingClientRect()
    if (r.width < 44 || r.height < 44) out.touch.push({ el: name(el), text: txt(el), w: +r.width.toFixed(1), h: +r.height.toFixed(1) })
  }
  // 글자 크기 인벤토리와 16px 미만 본문(문장 길이 20자 이상)
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const seen = new Set()
  for (let n; (n = tw.nextNode());) {
    const el = n.parentElement
    if (!el || !n.data.trim() || seen.has(el) || el.closest("script,style,option,select,.pv-tag")) continue
    seen.add(el)
    if (!vis(el)) continue
    const s = getComputedStyle(el)
    const px = Math.round(parseFloat(s.fontSize) * 10) / 10
    const blk = el.closest("p,li,h1,h2,h3,figcaption,summary,label,legend,span,b,div") || el
    const k = px + "px"
    out.sizes[k] = out.sizes[k] || []
    if (out.sizes[k].length < 8) out.sizes[k].push(name(el) + "「" + n.data.trim().slice(0, 14) + "」")
    const t = (blk.innerText || "").trim()
    if (px < 16 && t.length >= 20 && el.closest("p,li")) out.small.push({ el: name(el.closest("p,li")), px, text: t.slice(0, 40) })
  }
  // 외톨이 줄: p/li/figcaption/label 문단의 마지막 줄이 2글자 이하 낱말 하나뿐
  for (const el of document.querySelectorAll("p, li, figcaption, h1, h2, h3, .ub-ink__hint, .ub-ink__label, .umr-p-label, .umr-wg-tag, .umb-spine__title")) {
    if (!vis(el)) continue
    const range = document.createRange(); range.selectNodeContents(el)
    const rects = [...range.getClientRects()].filter(r => r.width > 1 && r.height > 1)
    const lines = []
    for (const r of rects) { const L = lines.find(l => Math.abs(l.t - r.top) < r.height * 0.5); if (L) { L.l = Math.min(L.l, r.left); L.r = Math.max(L.r, r.right) } else lines.push({ t: r.top, l: r.left, r: r.right, h: r.height }) }
    if (lines.length < 2) continue
    lines.sort((a, b) => a.t - b.t)
    const last = lines[lines.length - 1], w = Math.max(...lines.map(l => l.r - l.l))
    const fs = parseFloat(getComputedStyle(el).fontSize)
    if (last.r - last.l < fs * 3.2) out.orphan.push({ el: name(el), lines: lines.length, lastW: +(last.r - last.l).toFixed(0), maxW: +w.toFixed(0), text: (el.innerText || "").trim().replace(/\s+/g, " ").slice(-28) })
  }
  // 감싸기 줄(flex-wrap)에서 마지막 줄에 항목 하나만
  for (const el of document.querySelectorAll("*")) {
    const s = getComputedStyle(el)
    if (s.display !== "flex" || s.flexWrap !== "wrap" || !vis(el)) continue
    const kids = [...el.children].filter(vis)
    if (kids.length < 3) continue
    const tops = kids.map(k => Math.round(k.getBoundingClientRect().top))
    const rows = [...new Set(tops)]
    if (rows.length < 2) continue
    const lastRow = rows[rows.length - 1]
    const inLast = kids.filter((k, i) => tops[i] === lastRow)
    if (inLast.length === 1) out.wrapItem.push({ el: name(el), rows: rows.length, lone: txt(inLast[0]) || name(inLast[0]), all: kids.map(txt).join(" | ").slice(0, 60) })
  }
  return out
}

async function openInput(page, url) {
  await page.addInitScript(() => { try { localStorage.setItem("um-intro-seen", "1") } catch { /* */ } })
  await page.goto(url, { waitUntil: "networkidle" })
  await page.waitForSelector(".ub-seal", { timeout: 20000 })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(400)
}

;(async () => {
  const srv = await serve()
  const base = `http://127.0.0.1:${srv.address().port}/index.html`
  const proxy = process.env.https_proxy || process.env.HTTPS_PROXY
  const browser = await chromium.launch(proxy ? { proxy: { server: proxy, bypass: "127.0.0.1,localhost" } } : {})
  const report = {}
  for (const c of CONDS) {
    const ctx = await browser.newContext({ ...c.ctx, reducedMotion: "reduce", locale: "ko-KR" })
    const page = await ctx.newPage()
    const R = (report[c.id] = {})
    try {
      await openInput(page, base)
      await page.fill('input[aria-label="태어난 연도"]', "1992")
      await page.fill('input[aria-label="태어난 월"]', "8")
      await page.fill('input[aria-label="태어난 일"]', "14")
      await page.evaluate(() => document.activeElement && document.activeElement.blur())
      await zoomText(page, c.zoom)
      // 입력 화면: 쪽 안 스크롤을 끝까지 내려 가며
      const scroller = await page.evaluate(() => { const p = [...document.querySelectorAll(".ub-book__page")].find(e => e.scrollHeight > e.clientHeight + 2 && getComputedStyle(e).overflowY !== "visible"); if (!p) return null; p.setAttribute("data-qa-scroll", ""); return { sh: p.scrollHeight, ch: p.clientHeight } })
      R.inputScroll = scroller
      R.input = await page.evaluate(measure)
      await page.screenshot({ path: path.join(OUT, `${c.id}-input-0.png`), fullPage: true })
      if (scroller) {
        let i = 1
        for (let y = scroller.ch * 0.85; y < scroller.sh; y += scroller.ch * 0.85, i++) {
          await page.evaluate(y => { document.querySelector("[data-qa-scroll]").scrollTop = y }, y)
          await page.waitForTimeout(150)
          await page.screenshot({ path: path.join(OUT, `${c.id}-input-${i}.png`), fullPage: true })
          if (i > 6) break
        }
        await page.evaluate(() => { document.querySelector("[data-qa-scroll]").scrollTop = 0 })
      }
      // 한밤중
      await page.selectOption('select[aria-label="태어난 시"]', "s0")
      await page.waitForTimeout(300)
      await zoomText(page, c.zoom)
      R.sijin = await page.evaluate(measure)
      await page.evaluate(() => document.querySelector('select[aria-label="태어난 시"]')?.scrollIntoView({ block: "start" }))
      await page.screenshot({ path: path.join(OUT, `${c.id}-sijin.png`), fullPage: true })
      // 대략 시간대 하나(긴 이름)
      const opts = await page.evaluate(() => [...document.querySelector('select[aria-label="태어난 시"]').options].map(o => [o.value, o.textContent]))
      R.hourOptions = opts
      const longest = opts.filter(o => o[0]).sort((a, b) => b[1].length - a[1].length)[0]
      if (longest) {
        await page.selectOption('select[aria-label="태어난 시"]', longest[0]); await page.waitForTimeout(300); await zoomText(page, c.zoom)
        R.longHour = await page.evaluate(measure)
        await page.evaluate(() => document.querySelector('select[aria-label="태어난 시"]')?.scrollIntoView({ block: "start" }))
        await page.screenshot({ path: path.join(OUT, `${c.id}-longhour.png`), fullPage: true })
      }
      // 결과
      await page.selectOption('select[aria-label="태어난 시"]', "")
      await page.fill('input[name="um-name"]', "서연")
      await page.check('input[name="um-gender"][value="F"]', { force: true })
      await page.evaluate(() => { const p = document.querySelector("[data-qa-scroll]"); if (p) p.scrollTop = p.scrollHeight })
      await page.click(".ub-seal")
      await page.waitForSelector(".umb .ub-book", { timeout: 30000 })
      await page.evaluate(() => { window.scrollTo(0, 0); return document.fonts.ready })
      await page.waitForTimeout(1200)
      await zoomText(page, c.zoom)
      R.result = await page.evaluate(measure)
      await page.screenshot({ path: path.join(OUT, `${c.id}-result-full.png`), fullPage: true })
      await page.evaluate(() => { const d = document.querySelector("details.umb-fold"); if (d) d.open = true })
      await page.waitForTimeout(300)
      await zoomText(page, c.zoom)
      R.resultOpen = await page.evaluate(measure)
      await page.screenshot({ path: path.join(OUT, `${c.id}-result-full-open.png`), fullPage: true })
      const h = await page.evaluate(() => document.documentElement.scrollHeight)
      R.resultHeight = h
    } catch (e) { R.error = e.message.split("\n")[0] }
    await ctx.close()
    console.log(c.id, R.error || "ok")
  }
  fs.writeFileSync(path.join(OUT, "measure.json"), JSON.stringify(report, null, 1))
  await browser.close(); srv.close()
})()
