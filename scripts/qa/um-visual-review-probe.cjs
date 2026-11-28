// 운명비서 재검수 보조(품질검증 2026-11-28 r2) — um-visual-review.cjs 로 못 보는 세부를 잰다.
//   ① 결과 끝부분 화면 단위 촬영(전체 페이지 사진이 16,384px 촬영 한계를 넘는 조건용) — <조건>-end-N.png
//   ② 값 왼쪽 끝 정렬(라벨·이름·날·고르기 첫 글자·시각·곳), 월·일 입력 요소 폭, 인장 글자 크기, 세로 리듬(빈 화면 vs 한밤중)
//   ③ 예전 확대 흉내(c1dd87c 판 zoomText)의 배율 이중 곱 여부
// 사용: NODE_PATH=/opt/node-tools/node_modules node scripts/qa/um-visual-review-probe.cjs <미리보기 폴더> <출력 폴더> [--only=a360,...]
/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright")
const http = require("node:http"), fs = require("node:fs"), path = require("node:path")
const args = process.argv.slice(2), pos = args.filter(a => !a.startsWith("--"))
const opt = Object.fromEntries(args.filter(a => a.startsWith("--")).map(a => { const [k, v] = a.slice(2).split("="); return [k, v ?? "1"] }))
const ROOT = path.resolve(pos[0]), OUT = path.resolve(pos[1]); fs.mkdirSync(OUT, { recursive: true })
const UA = "Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"
const mob = (w, h, d) => ({ viewport: { width: w, height: h }, deviceScaleFactor: d, isMobile: true, hasTouch: true, userAgent: UA })
const CONDS = [
  { id: "a412", ctx: mob(412, 915, 2.625) }, { id: "i390", ctx: mob(390, 844, 3) }, { id: "a360", ctx: mob(360, 740, 3) },
  { id: "fold344", ctx: mob(344, 882, 2.625) }, { id: "a412-130", ctx: mob(412, 915, 2.625), zoom: 1.3 }, { id: "r412-130", ctx: mob(412, 915, 2.625), fontPx: 21 },
  { id: "pz412-130", ctx: mob(317, 704, 3.4125) }, { id: "pz412-150", ctx: mob(275, 610, 3.9375) }, { id: "pz412-200", ctx: mob(206, 457, 5.25) },
  { id: "pc1440", ctx: { viewport: { width: 1440, height: 900 } } },
].filter(c => !opt.only || opt.only.split(",").includes(c.id))
function serve() { const T = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".mp4": "video/mp4" }; return new Promise(res => { const s = http.createServer((q, r) => { const rel = path.normalize(decodeURIComponent(new URL(q.url, "http://x").pathname)).replace(/^([/\\])+/, ""); const f = path.join(ROOT, rel || "index.html"); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end() } r.writeHead(200, { "content-type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r) }); s.listen(0, "127.0.0.1", () => res(s)) }) }
// c1dd87c 판(예전) 확대 흉내 그대로 — 이중 곱 확인용
const OLD_ZOOM = async z => {
  const settle = async () => { void document.body.offsetHeight; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))) }
  const root = document.documentElement
  for (const el of document.querySelectorAll("[data-vc-z]")) { el.style.removeProperty("font-size"); el.removeAttribute("data-vc-z") }
  root.style.fontSize = ""; await settle()
  const els = [...document.body.querySelectorAll("*")]
  const base = els.map(el => parseFloat(getComputedStyle(el).fontSize))
  root.style.fontSize = `${z * 100}%`; await settle()
  const now = els.map(el => parseFloat(getComputedStyle(el).fontSize))
  els.forEach((el, i) => { if (now[i] < base[i] * z - 0.3) { el.style.setProperty("font-size", `${(base[i] * z).toFixed(2)}px`, "important"); el.setAttribute("data-vc-z", "") } })
  await settle()
  let doubled = 0, max = 0; const ex = []
  els.forEach((el, i) => { const r = parseFloat(getComputedStyle(el).fontSize) / base[i]; if (r > max) max = r; if (r > z + 0.02) { doubled++; if (ex.length < 6) ex.push(el.tagName.toLowerCase() + "." + [...el.classList].slice(0, 2).join(".") + "×" + r.toFixed(2)) } })
  return { doubled, max: +max.toFixed(3), ex }
}
const NEW_ZOOM = async z => {
  const settle = async () => { void document.body.offsetHeight; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))) }
  const root = document.documentElement
  for (const el of document.querySelectorAll("[data-vc-z]")) { el.style.removeProperty("font-size"); el.removeAttribute("data-vc-z") }
  root.style.fontSize = ""; await settle()
  const els = [...document.body.querySelectorAll("*")]
  const base = new Map(els.map(el => [el, parseFloat(getComputedStyle(el).fontSize)]))
  root.style.fontSize = `${z * 100}%`; await settle()
  for (const el of els) { const w = base.get(el) * z; if (parseFloat(getComputedStyle(el).fontSize) < w - 0.3) { el.style.setProperty("font-size", `${w.toFixed(2)}px`, "important"); el.setAttribute("data-vc-z", "") } }
  await settle()
}
function probeInput() {
  const textLeft = el => { if (!el) return null; const r = document.createRange(); r.selectNodeContents(el); const rs = [...r.getClientRects()].filter(x => x.width > 0.5); return rs.length ? +Math.min(...rs.map(x => x.left)).toFixed(1) : null }
  const q = s => document.querySelector(s)
  const val = sel => { const el = q(sel); if (!el) return null; const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return +(r.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth)).toFixed(1) }
  const choiceFirst = legend => { const f = [...document.querySelectorAll(".ub-choice")].find(x => x.querySelector("legend")?.innerText.trim() === legend); const t = f && f.querySelector(".ub-choice__opt .ub-choice__text, .ub-choice__opt span:not(.ub-choice__dot)"); return textLeft(t || (f && f.querySelector(".ub-choice__opt"))) }
  const labelLeft = txt => textLeft([...document.querySelectorAll(".ub-ink__label, legend")].find(x => x.innerText.trim().startsWith(txt)))
  const w = s => { const el = q(s); return el ? +el.getBoundingClientRect().width.toFixed(1) : null }
  const seal = q(".ub-seal"); const sealTxt = seal && [...seal.querySelectorAll("*")].find(e => /열기|입력/.test(e.textContent) && !e.children.length)
  const pos = s => { const el = [...document.querySelectorAll(s)][0]; return el ? +el.getBoundingClientRect().top.toFixed(0) : null }
  return {
    left: { 라벨_부를이름: labelLeft("부를"), 이름값: val('input[name="um-name"]'), 연도: val('input[aria-label="태어난 연도"]'), 달력첫글자: choiceFirst("달력"), 시: val('select[aria-label="태어난 시"]'), 성별첫글자: choiceFirst("성별"), 곳: val('select[aria-label="태어난 곳"]') || val(".ub-ink select:not([aria-label])") },
    widths: { 월입력: w('input[aria-label="태어난 월"]'), 일입력: w('input[aria-label="태어난 일"]'), 월label: (() => { const e = q('input[aria-label="태어난 월"]'); return e && +e.closest("label").getBoundingClientRect().width.toFixed(1) })(), 월높이: (() => { const e = q('input[aria-label="태어난 월"]'); return e && +e.getBoundingClientRect().height.toFixed(1) })() },
    sealFont: sealTxt ? getComputedStyle(sealTxt).fontSize : null,
    rhythm: { voice: pos(".umf-voice"), firstField: pos(".ub-ledger .ub-ink, .umf-record .ub-ink"), title: pos(".ub-book__page h1, .ub-book__page [class*=title]"), seal: pos(".ub-seal") },
  }
}
;(async () => {
  const srv = await serve(); const base = `http://127.0.0.1:${srv.address().port}/index.html`
  const proxy = process.env.https_proxy || process.env.HTTPS_PROXY
  const browser = await chromium.launch(proxy ? { proxy: { server: proxy, bypass: "127.0.0.1,localhost" } } : {})
  const rep = {}
  for (const c of CONDS) {
    const ctx = await browser.newContext({ ...c.ctx, reducedMotion: "reduce", locale: "ko-KR" }); const page = await ctx.newPage()
    if (c.fontPx) { const cdp = await ctx.newCDPSession(page); await cdp.send("Page.setFontSizes", { fontSizes: { standard: c.fontPx, fixed: 17 } }) }
    const R = (rep[c.id] = {})
    try {
      await page.addInitScript(() => { try { localStorage.setItem("um-intro-seen", "1") } catch { /* */ } })
      await page.goto(base, { waitUntil: "networkidle" }); await page.waitForSelector(".ub-seal"); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(400)
      if (c.zoom) { R.oldZoomInput = await page.evaluate(OLD_ZOOM, c.zoom); await page.evaluate(NEW_ZOOM, c.zoom) }
      R.empty = await page.evaluate(probeInput)
      await page.selectOption('select[aria-label="태어난 시"]', "s0"); await page.waitForTimeout(300); if (c.zoom) await page.evaluate(NEW_ZOOM, c.zoom)
      await page.evaluate(() => { const p = document.querySelector(".ub-book__page"); if (p) p.scrollTop = 0 })
      R.sijin = await page.evaluate(probeInput)
      await page.selectOption('select[aria-label="태어난 시"]', "")
      await page.fill('input[aria-label="태어난 연도"]', "1992"); await page.fill('input[aria-label="태어난 월"]', "8"); await page.fill('input[aria-label="태어난 일"]', "14")
      await page.fill('input[name="um-name"]', "서연"); await page.check('input[name="um-gender"][value="F"]', { force: true })
      await page.evaluate(() => { const p = document.querySelector(".ub-book__page"); if (p) p.scrollTop = p.scrollHeight })
      await page.click(".ub-seal"); await page.waitForSelector(".umb .ub-book", { timeout: 30000 }); await page.waitForTimeout(1200)
      if (c.zoom) { R.oldZoomResult = await page.evaluate(OLD_ZOOM, c.zoom); await page.evaluate(NEW_ZOOM, c.zoom) }
      await page.evaluate(() => { const d = document.querySelector("details.umb-fold"); if (d) d.open = true }); await page.waitForTimeout(300)
      if (c.zoom) await page.evaluate(NEW_ZOOM, c.zoom)
      R.resultSeal = await page.evaluate(() => { const s = document.querySelector(".umb-end .ub-seal"); const t = s && [...s.querySelectorAll("*")].find(e => /입력/.test(e.textContent) && !e.children.length); return t ? getComputedStyle(t).fontSize : null })
      R.pcPages = await page.evaluate(() => [...document.querySelectorAll(".ub-book--spread, .ub-book")].slice(0, 4).map(b => [...b.querySelectorAll(".ub-chapter__title, h2")].slice(0, 2).map(h => Math.round(h.getBoundingClientRect().top + scrollY))))
      // 끝부분 화면 단위 촬영: 근거 접기 위부터 문서 끝까지
      const y0 = await page.evaluate(() => Math.round(document.querySelector("details.umb-fold").getBoundingClientRect().top + scrollY - 40))
      const H = await page.evaluate(() => document.documentElement.scrollHeight), vh = c.ctx.viewport.height
      let i = 0
      for (let y = y0; i < 14; y += Math.round(vh * 0.9), i++) { await page.evaluate(y => scrollTo(0, y), y); await page.waitForTimeout(150); await page.screenshot({ path: path.join(OUT, `${c.id}-end-${i}.png`) }); if (y + vh >= H) break }
    } catch (e) { R.error = e.message.split("\n")[0] }
    await ctx.close(); console.log(c.id, R.error || "ok")
  }
  fs.writeFileSync(path.join(OUT, "probe.json"), JSON.stringify(rep, null, 1)); await browser.close(); srv.close()
})()
