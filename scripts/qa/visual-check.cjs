// 운명비서 화면 「눈으로 보는」 자동 검사 — 디자인 실장 (2026-11-28, 대표 실기기 사진 「글자 크기가 제각각이네」 후속)
//
// 사용법
//   1) 미리보기 묶음을 만든다:  node scripts/preview/build-unmyeong-preview.mjs <미리보기 폴더>
//   2) 검사:                    node scripts/qa/visual-check.cjs <미리보기 폴더> [스크린샷 폴더] [--only=a412,pc1440] [--screen=input|result]
//      - 스크린샷 폴더 기본값: <OS 임시 폴더>/um-visual
//      - 종료 코드: 결함 0건이면 0, 하나라도 있으면 1 (글자 크기 단계 경고만으로는 실패하지 않는다)
//   필요: 사전 설치 playwright(require('playwright')) + Chromium. 글꼴(Google Fonts)은 https_proxy 환경변수가 있으면 그 프록시로 받는다.
//
// 무엇을 하나
//   미리보기 폴더를 127.0.0.1 임시 서버로 열고, 아래 7개 조건마다 ① 입력 화면 ② 결과 첫 화면(입력 → 인장 → 결과)을 연다.
//   화면: input(값 1992·8·14, 시 모름) · sijin(시를 「한밤중(자시)」로 → 한밤중 칸이 열린 상태) · result(결과 첫 화면)
//   (a) 결함 전수 탐지 — 걸린 요소를 「선택자 · 글자 · 수치」로 출력
//       · overflow  : scrollWidth > clientWidth(+1) 인 요소 중 넘친 내용에 글자가 있는 것(장식 그림·숨김 글은 제외)
//       · field     : <input>/<select> 안 글자(값·자리표시·고른 항목)가 칸 안쪽 폭보다 넓음(=잘림)
//       · outside   : 글자 줄 상자가 자기를 자르는 조상(overflow≠visible, 예: 책 쪽) 또는 화면 폭 밖으로 나감
//       · overlap   : 서로 다른 요소의 글자 상자(입력 칸 값·꼬리 글자·select 꺾쇠 포함)가 겹침
//       · page-x    : 문서 전체 가로 스크롤
//   (b) 스크린샷: <스크린샷 폴더>/<조건>-<화면>.png (화면 한 장 크기)
//   (c) 쓰는 글자 크기 목록(0.5px 이내는 한 단계로 묶음). 책 종이 위 글자 단계가 5개를 넘으면 경고.
//       큰 제목(가장 작은 단계를 도움말 T5 = 0.8125t 로 보고 1.3t 이상)은 따로 센다 — 체계: docs/DESIGN_SYSTEM.md 「타이포 5단계」
//
// 7개 조건
//   a412     412×915  DSF 2.625  안드로이드(WebView) UA  — 갤럭시 S 계열
//   i390     390×844  DSF 3      아이폰 UA(엔진은 Chromium — 사파리 실측 아님)
//   a360     360×740  DSF 3      안드로이드 UA          — 작은 안드로이드
//   a412-115 a412 + 글자 115% : 사용자 글꼴 크기 흉내 두 가지를 함께 건다
//            ㉮ html 기본 글자 115%(브라우저 글꼴 설정 = rem 확대)
//            ㉯ ㉮로 커지지 않은 글자(px 로 고정된 글자)도 모두 1.15배로 — 안드로이드 WebView textZoom 처럼 글자만 커지고
//               px 로 잡은 칸 폭은 그대로인 최악의 경우. (헤드리스 Chromium 은 --blink-settings 의 accessibilityFontScaleFactor·
//               textAutosizing 을 실제로 적용하지 않아(2026-11-28 확인) 스크립트로 글자 크기를 직접 키운다)
//   a412-130 같은 방식으로 130%
//   pc1440   1440×900   PC 양면
//   pc1920   1920×1080  큰 PC
//   ※ 모두 헤드리스 Chromium 흉내다. 실제 기기·사파리 측정이 아니다(대표 실기기 확인은 따로).
/* eslint-disable @typescript-eslint/no-require-imports -- Node 전용 CommonJS 검사 도구(다른 scripts/qa/*.cjs 와 같은 방식) */
const { chromium } = require("playwright")
const http = require("node:http")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const args = process.argv.slice(2)
const pos = args.filter(a => !a.startsWith("--"))
const opt = Object.fromEntries(args.filter(a => a.startsWith("--")).map(a => { const [k, v] = a.slice(2).split("="); return [k, v ?? "1"] }))
const ROOT = pos[0] && path.resolve(pos[0])
if (!ROOT || !fs.existsSync(path.join(ROOT, "index.html"))) {
  console.error("사용: node scripts/qa/visual-check.cjs <미리보기 폴더(index.html 있는 곳)> [스크린샷 폴더] [--only=a412,...] [--screen=input|result]")
  process.exit(2)
}
const SHOTS = path.resolve(pos[1] || path.join(os.tmpdir(), "um-visual"))
fs.mkdirSync(SHOTS, { recursive: true })

const UA_ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.6778.135 Mobile Safari/537.36"
const UA_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1"
const mobile = (w, h, dsf, ua) => ({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true, userAgent: ua })
const CONDITIONS = [
  { id: "a412", ctx: mobile(412, 915, 2.625, UA_ANDROID) },
  { id: "i390", ctx: mobile(390, 844, 3, UA_IPHONE) },
  { id: "a360", ctx: mobile(360, 740, 3, UA_ANDROID) },
  { id: "a412-115", ctx: mobile(412, 915, 2.625, UA_ANDROID), zoom: 1.15 },
  { id: "a412-130", ctx: mobile(412, 915, 2.625, UA_ANDROID), zoom: 1.3 },
  { id: "pc1440", ctx: { viewport: { width: 1440, height: 900 } } },
  { id: "pc1920", ctx: { viewport: { width: 1920, height: 1080 } } },
].filter(c => !opt.only || opt.only.split(",").includes(c.id))
const SCREENS = opt.screen ? [opt.screen] : ["input", "sijin", "result"]

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".mp4": "video/mp4", ".webm": "video/webm", ".mp3": "audio/mpeg", ".m4a": "audio/mp4" }
function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const u = new URL(req.url, "http://x")
      const rel = path.normalize(decodeURIComponent(u.pathname)).replace(/^([/\\])+/, "")
      const f = path.join(ROOT, rel || "index.html")
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end() }
      rsp.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" })
      fs.createReadStream(f).pipe(rsp)
    })
    srv.listen(0, "127.0.0.1", () => res(srv))
  })
}

// ───── 브라우저 안에서 도는 탐지(문자열로 넘긴다) ─────
function detect() {
  const out = { overflow: [], field: [], outside: [], overlap: [], pagex: [], sizes: {} }
  const vw = document.documentElement.clientWidth
  const sel = el => {
    if (!el || el.nodeType !== 1) return "?"
    const parts = []
    for (let e = el, i = 0; e && e.nodeType === 1 && i < 3; e = e.parentElement, i++) {
      const c = [...e.classList].filter(x => !/^(um-font|is-)/.test(x)).slice(0, 2).join(".")
      parts.unshift(e.tagName.toLowerCase() + (c ? "." + c : "") + (e.getAttribute("aria-label") ? `[${e.getAttribute("aria-label")}]` : ""))
    }
    return parts.join(" > ")
  }
  const shown = el => {
    // 닫힌 <details> 안(요약 줄 제외)·content-visibility 로 숨은 글은 화면에 없다
    if (el.checkVisibility && !el.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true })) return false
    const d = el.closest("details:not([open])")
    if (d && !el.closest("summary")) return false
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const s = getComputedStyle(e)
      if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) < 0.05) return false
      if (e.getAttribute("aria-hidden") === "true" && e.tagName.toLowerCase() === "svg") return false
      if (e.hidden) return false
      const r = e.getBoundingClientRect()
      if (s.position === "absolute" && r.width <= 1 && r.height <= 1) return false // 화면낭독기 전용 글
      if (s.clip && s.clip !== "auto" && /rect\(0(px)? 0(px)? 0(px)? 0(px)?\)/.test(s.clip)) return false
    }
    return true
  }
  // 1) 글자 상자 모으기: 글자 노드의 줄 상자 + 입력 칸 글자 + select 꺾쇠
  const boxes = []
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const sizeOf = {}
  const addSize = (el, kind) => {
    const s = getComputedStyle(el)
    const px = Math.round(parseFloat(s.fontSize) * 10) / 10
    const paper = !!el.closest(".ub-book__page, .ub-paper-surface")
    const key = (paper ? "종이 " : "서재 ") + px
    const label = (kind || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 18)
    ;(sizeOf[key] = sizeOf[key] || { px, paper, n: 0, ex: [] }).n++
    if (sizeOf[key].ex.length < 3 && label && !sizeOf[key].ex.includes(label)) sizeOf[key].ex.push(label)
  }
  for (let n; (n = tw.nextNode());) {
    if (!n.data.trim()) continue
    const el = n.parentElement
    if (!el || el.closest("script,style,option,optgroup,select,noscript,.pv-tag") || !shown(el)) continue
    const range = document.createRange(); range.selectNodeContents(n)
    const rects = [...range.getClientRects()].filter(r => r.width > 0.5 && r.height > 0.5)
    if (!rects.length) continue
    addSize(el)
    for (const r of rects) boxes.push({ el, r: { l: r.left, r: r.right, t: r.top, b: r.bottom }, text: n.data.trim().slice(0, 24) })
  }
  const canvas = document.createElement("canvas").getContext("2d")
  const measure = (text, s) => {
    canvas.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`
    try { canvas.letterSpacing = s.letterSpacing === "normal" ? "0px" : s.letterSpacing } catch { /* 옛 브라우저 */ }
    return canvas.measureText(text).width
  }
  for (const el of document.querySelectorAll("input:not([type=radio]):not([type=checkbox]):not([type=hidden]), select")) {
    if (!shown(el)) continue
    const s = getComputedStyle(el)
    const text = el.tagName === "SELECT" ? (el.selectedOptions[0]?.textContent || "") : (el.value || el.placeholder || "")
    if (!text) continue
    addSize(el, `[칸] ${text}`)
    const r = el.getBoundingClientRect()
    const pl = parseFloat(s.paddingLeft) + parseFloat(s.borderLeftWidth), pr = parseFloat(s.paddingRight) + parseFloat(s.borderRightWidth)
    const cw = r.width - pl - pr
    const w = measure(text, s)
    if (w > cw + 0.5) out.field.push({ el: sel(el), text, need: +w.toFixed(1), have: +cw.toFixed(1) })
    const align = el.tagName === "SELECT" ? (s.textAlignLast !== "auto" ? s.textAlignLast : s.textAlign) : s.textAlign
    const ww = Math.min(w, cw)
    let left = r.left + pl
    if (align === "center") left = r.left + pl + (cw - ww) / 2
    else if (align === "right" || align === "end") left = r.right - pr - ww
    const fs = parseFloat(s.fontSize)
    boxes.push({ el, r: { l: left, r: left + ww, t: r.top + r.height / 2 - fs * 0.5, b: r.top + r.height / 2 + fs * 0.5 }, text: `[칸] ${text}` })
  }
  for (const c of document.querySelectorAll(".ub-ink__caret")) {
    if (!shown(c.parentElement)) continue
    const r = c.getBoundingClientRect()
    boxes.push({ el: c, r: { l: r.left, r: r.right, t: r.top, b: r.bottom }, text: "[꺾쇠]" })
  }
  // 2) 겹침 — 스크롤 상자(책 쪽 등)에 가려 안 보이는 부분은 잘라 낸 뒤 비교한다
  const visRect = bx => {
    const r = { ...bx.r }
    for (let e = bx.el.parentElement; e && e !== document.body; e = e.parentElement) {
      const s = getComputedStyle(e)
      if (s.overflowX === "visible" && s.overflowY === "visible") continue
      const c = e.getBoundingClientRect()
      if (s.overflowX !== "visible") { r.l = Math.max(r.l, c.left); r.r = Math.min(r.r, c.right) }
      if (s.overflowY !== "visible") { r.t = Math.max(r.t, c.top); r.b = Math.min(r.b, c.bottom) }
    }
    return r.r - r.l > 0.5 && r.b - r.t > 0.5 ? r : null
  }
  const vis = boxes.map(visRect)
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    if (!vis[i] || !vis[j]) continue
    const a = { ...boxes[i], r: vis[i] }, b = { ...boxes[j], r: vis[j] }
    if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue
    const w = Math.min(a.r.r, b.r.r) - Math.max(a.r.l, b.r.l)
    const h = Math.min(a.r.b, b.r.b) - Math.max(a.r.t, b.r.t)
    const minH = Math.min(a.r.b - a.r.t, b.r.b - b.r.t)
    if (w > 1.5 && h > Math.max(2, minH * 0.2)) out.overlap.push({ a: `${sel(a.el)} 「${a.text}」`, b: `${sel(b.el)} 「${b.text}」`, w: +w.toFixed(1), h: +h.toFixed(1) })
  }
  // 3) 자르는 조상·화면 밖
  const clipOf = el => {
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
      const s = getComputedStyle(e)
      if (s.overflowX !== "visible" || s.overflowY !== "visible") return { e, s }
    }
    return null
  }
  for (const bx of boxes) {
    const c = clipOf(bx.el)
    const why = []
    if (bx.r.l < -0.5 || bx.r.r > vw + 0.5) why.push(`화면 밖(${bx.r.l.toFixed(1)}~${bx.r.r.toFixed(1)} / ${vw})`)
    if (c) {
      const cr = c.e.getBoundingClientRect()
      if (c.s.overflowX !== "visible" && (bx.r.l < cr.left - 0.5 || bx.r.r > cr.right + 0.5)) why.push(`${sel(c.e)} 가로 밖(${bx.r.l.toFixed(1)}~${bx.r.r.toFixed(1)} / ${cr.left.toFixed(1)}~${cr.right.toFixed(1)})`)
      if (c.s.overflowY === "hidden" || c.s.overflowY === "clip") {
        if (bx.r.t < cr.top - 0.5 || bx.r.b > cr.bottom + 0.5) why.push(`${sel(c.e)} 세로 밖`)
      }
    }
    if (why.length) out.outside.push({ el: sel(bx.el), text: bx.text, why: why.join(" · ") })
  }
  // 4) scrollWidth > clientWidth — 넘친 쪽에 글자가 있는 것만(장식 그림·붓 동그라미 overflow:visible 은 글자가 아니다)
  for (const el of document.body.querySelectorAll("*")) {
    if (el.clientWidth === 0 || el.scrollWidth <= el.clientWidth + 1 || !shown(el)) continue
    if (el.matches("input,select,textarea")) continue // field 검사가 맡는다
    const er = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    const inner = er.left + el.clientLeft + el.clientWidth - (s.overflowX === "visible" ? 0 : 0)
    const spill = boxes.filter(b => el.contains(b.el) && b.el !== el.parentElement && b.r.r > inner + 0.5)
    if (spill.length) out.overflow.push({ el: sel(el), sw: el.scrollWidth, cw: el.clientWidth, text: spill.slice(0, 2).map(b => b.text).join(" / ") })
  }
  if (document.documentElement.scrollWidth > vw + 1) out.pagex.push({ el: "html", sw: document.documentElement.scrollWidth, cw: vw })
  out.sizes = sizeOf
  return out
}

function steps(sizes, paper) {
  const list = Object.values(sizes).filter(s => s.paper === paper).sort((a, b) => a.px - b.px)
  const groups = []
  for (const s of list) {
    const g = groups[groups.length - 1]
    if (g && s.px - g.lo <= 0.5) { g.hi = s.px; g.n += s.n; g.ex.push(...s.ex) } else groups.push({ lo: s.px, hi: s.px, n: s.n, ex: [...s.ex] })
  }
  return groups
}

// 글자 확대 흉내(㉮ + ㉯). 화면이 바뀔 때마다 다시 건다(이미 키운 글자는 되돌린 뒤 다시 잰다)
async function zoomText(page, z) {
  if (!z) return
  await page.evaluate(async z => {
    // 쪽 폭(cqi)에 걸린 글자 크기는 배치가 끝나야 새 값이 나온다 → 글자 크기를 바꿀 때마다 한 화면(프레임)을 기다린다
    const settle = async () => { void document.body.offsetHeight; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))) }
    const root = document.documentElement
    for (const el of document.querySelectorAll("[data-vc-z]")) { el.style.removeProperty("font-size"); el.removeAttribute("data-vc-z") }
    root.style.fontSize = ""
    await settle()
    const els = [...document.body.querySelectorAll("*")]
    const base = els.map(el => parseFloat(getComputedStyle(el).fontSize))
    root.style.fontSize = `${z * 100}%`
    await settle()
    const now = els.map(el => parseFloat(getComputedStyle(el).fontSize))
    els.forEach((el, i) => { if (now[i] < base[i] * z - 0.3) { el.style.setProperty("font-size", `${(base[i] * z).toFixed(2)}px`, "important"); el.setAttribute("data-vc-z", "") } })
  }, z)
  await page.waitForTimeout(300)
}
async function openInput(page, url) {
  await page.addInitScript(() => { try { localStorage.setItem("um-intro-seen", "1") } catch { /* */ } })
  await page.goto(url, { waitUntil: "networkidle" })
  await page.waitForSelector(".ub-seal", { timeout: 20000 })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(400)
}
async function fillAndSubmit(page) {
  await page.fill('input[name="um-name"]', "서연")
  await page.fill('input[aria-label="태어난 연도"]', "1992")
  await page.fill('input[aria-label="태어난 월"]', "8")
  await page.fill('input[aria-label="태어난 일"]', "14")
  await page.check('input[name="um-gender"][value="F"]', { force: true })
  await page.click(".ub-seal")
  await page.waitForSelector(".umb .ub-book", { timeout: 30000 })
  await page.evaluate(() => { window.scrollTo(0, 0); return document.fonts.ready })
  await page.waitForTimeout(900)
}

;(async () => {
  const srv = await serve()
  const base = `http://127.0.0.1:${srv.address().port}/index.html`
  const proxy = process.env.https_proxy || process.env.HTTPS_PROXY
  const browsers = {}
  const getBrowser = async zoom => {
    const k = String(zoom || 1)
    if (!browsers[k]) {
      browsers[k] = await chromium.launch({ ...(proxy ? { proxy: { server: proxy, bypass: "127.0.0.1,localhost" } } : {}) })
    }
    return browsers[k]
  }
  let defects = 0
  const summary = []
  for (const c of CONDITIONS) {
    const browser = await getBrowser(c.zoom)
    const ctx = await browser.newContext({ ...c.ctx, reducedMotion: "reduce", locale: "ko-KR" })
    // 실제 /unmyeong 은 Next 가 <meta name="viewport" content="width=device-width, initial-scale=1"> 을 넣는다.
    // 미리보기 index.html 에 이 줄이 없으면 휴대폰 흉내가 980px 폭으로 그려지므로(실제와 다름) 문서 시작 때 같은 줄을 넣는다.
    await ctx.addInitScript(() => {
      const add = () => { if (document.head && !document.querySelector('meta[name="viewport"]')) { const m = document.createElement("meta"); m.name = "viewport"; m.content = "width=device-width, initial-scale=1"; document.head.prepend(m); return true } return false }
      if (!add()) new MutationObserver((_, o) => { if (add()) o.disconnect() }).observe(document, { childList: true, subtree: true })
    })
    const page = await ctx.newPage()
    for (const screen of SCREENS) {
      try {
        if (screen === "input") await openInput(page, base)
        else if (screen === "sijin") {
          if (page.url() === "about:blank") await openInput(page, base)
          await page.fill('input[aria-label="태어난 연도"]', "1992")
          await page.selectOption('select[aria-label="태어난 시"]', "s0")
          await page.waitForSelector('input[name="um-zi"]', { state: "attached", timeout: 5000 })
        } else { if (page.url() === "about:blank") await openInput(page, base); await page.selectOption('select[aria-label="태어난 시"]', ""); await fillAndSubmit(page) }
      } catch (e) {
        console.log(`\n■ ${c.id} / ${screen} — 열기 실패: ${e.message.split("\n")[0]}`); defects++; summary.push(`${c.id}/${screen}: 열기 실패`); continue
      }
      if (screen === "input") {
        // 값이 든 상태도 본다(대표 사진과 같은 값). 시는 「모름」 그대로
        await page.fill('input[name="um-name"]', "")
        await page.fill('input[aria-label="태어난 연도"]', "1992")
        await page.fill('input[aria-label="태어난 월"]', "8")
        await page.fill('input[aria-label="태어난 일"]', "14")
        await page.evaluate(() => document.activeElement && document.activeElement.blur())
        await page.waitForTimeout(250)
      }
      await zoomText(page, c.zoom)
      if (screen === "sijin") await page.evaluate(() => { document.querySelector('select[aria-label="태어난 시"]')?.scrollIntoView({ block: "center" }) })
      const shot = path.join(SHOTS, `${c.id}-${screen}.png`)
      await page.screenshot({ path: shot })
      const r = await page.evaluate(detect)
      const n = r.overflow.length + r.field.length + r.outside.length + r.overlap.length + r.pagex.length
      defects += n
      console.log(`\n■ ${c.id} / ${screen} — 결함 ${n}건 · 스크린샷 ${shot}`)
      for (const [k, list] of [["overflow", r.overflow], ["field", r.field], ["outside", r.outside], ["overlap", r.overlap], ["page-x", r.pagex]]) {
        for (const d of list.slice(0, 12)) console.log(`  [${k}] ${JSON.stringify(d)}`)
        if (list.length > 12) console.log(`  [${k}] … 외 ${list.length - 12}건`)
      }
      for (const paper of [true, false]) {
        const g = steps(r.sizes, paper)
        if (!g.length) continue
        // 큰 제목(運命秘書·장 제목·한자 판)은 따로 센다: 가장 작은 단계를 도움말(T5 = 0.8125t)로 보고 1.3t 이상이면 제목
        const tEst = g[0].lo / 0.8125
        const big = g.filter(x => x.lo >= tEst * 1.3).length
        const body = g.length - big
        const warn = paper && body > 5 ? "  ⚠ 경고: 종이 위 글자 단계 5개 초과" : ""
        console.log(`  글자 크기(${paper ? "종이" : "서재"}) ${body}단계${big ? ` + 큰 제목 ${big}` : ""}:${warn}`)
        for (const x of g) console.log(`    ${x.lo === x.hi ? x.lo : `${x.lo}~${x.hi}`}px ×${x.n}  ${x.ex.slice(0, 4).map(e => `「${e}」`).join(" ")}`)
      }
      summary.push(`${c.id}/${screen}: ${n}`)
    }
    await ctx.close()
  }
  for (const b of Object.values(browsers)) await b.close()
  srv.close()
  console.log(`\n== 요약 == ${summary.join(" · ")}\n== 결함 합계 ${defects}건 ${defects ? "→ 실패" : "→ 통과"} ==`)
  process.exit(defects ? 1 : 0)
})()
