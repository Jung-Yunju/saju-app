// 운명비서 독립 시각 검수 보조 — 품질검증 담당(2026-11-28 작성, 같은 날 재검수용 보강 r2)
// visual-check.cjs(디자인 실장 도구)와 독립적으로, 사람 눈 검수용 스크린샷과 측정값을 만든다.
//   - 결과 화면: 전체 페이지(fullPage) — 근거 접기(「할미는 어떻게 알았을까?」)를 닫은 상태·연 상태 둘 다(연 상태는 접기 안까지 측정)
//   - 입력 화면: 쪽 안 스크롤(fit-lock)을 끝까지 내려 가며 여러 장
//   - 측정: 터치 대상 44px 미만(label 로 감싼 칸은 label 크기), 16px 미만 문장, 줄 끝 외톨이, 감싸기 줄에서 한 항목만 다음 줄로 떨어짐,
//           장부형(라벨 왼쪽·값 오른쪽) ↔ 위아래형(라벨 위·값 아래) 판정, 12개 대략 시간대 이름 잘림, 쪽 안 넘침·인장 위치,
//           책 위 휠로 문서 끝(개인정보 안내 링크)까지 가는지, 터치 스와이프(합성 제스처) 시도
// r2 보강(2026-11-28 재검수)
//   - 글자 확대 흉내(zoomText) 자체 점검: 흉내 뒤 실제 배율이 목표 z 를 넘는 요소(배율 이중 곱)를 세어 measure.json 에 남긴다.
//     이중 곱이 생기는 경우: px 고정 조상을 ×z 로 강제했을 때, 이미 rem 으로 ×z 커진 자손 중 em·%로 크기를 잡은 것.
//     → 강제는 「조상이 강제되지 않았는데도 덜 커진 요소」에만, 위에서 아래 순서로 한 번씩 건다(이중 곱 0 확인).
//   - 실제 브라우저 글꼴 크기 설정 조건(r412-130): CDP Page.setFontSizes 로 기본 글자를 16 → 21px(≈130%). rem 만 커지고 화면 폭은 그대로 —
//     크롬 「글꼴 크기」설정·<meta name="text-scale"> 지원 브라우저와 같은 경로.
//   - 페이지 확대 조건: pz412-130(317px) · pz412-150(275px) · pz412-200(206px) · fold344
//   - 외톨이 판정: 세로쓰기(writing-mode vertical-*)와 블록 자식이 있는(일부러 두 단으로 짠) 요소는 제외, 같은 줄 판정은 세로 겹침(50% 이상)
//   - 감싸기 줄 판정도 세로 겹침으로 같은 줄을 묶는다. 세로 목록(flex-direction: column)은 제외
//   - 16px 미만 문장: p·li 로 한정하지 않고, 화면에 보이는 모든 글 덩어리 중 띄어쓰기가 있고 8자 이상인 것
// 사용: NODE_PATH=/opt/node-tools/node_modules node scripts/qa/um-visual-review.cjs <미리보기 폴더> <출력 폴더> [--only=a412,...] [--no-shots]
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
const SHOTS = !opt["no-shots"]
fs.mkdirSync(OUT, { recursive: true })

const UA_A = "Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"
const UA_I = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1"
const mob = (w, h, dsf, ua) => ({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true, userAgent: ua })
const CONDS = [
  { id: "a412", ctx: mob(412, 915, 2.625, UA_A) },
  { id: "i390", ctx: mob(390, 844, 3, UA_I) },
  { id: "a360", ctx: mob(360, 740, 3, UA_A) },
  { id: "fold344", ctx: mob(344, 882, 2.625, UA_A) }, // 갤럭시 Z 폴드 덮개 화면 근사
  { id: "a412-115", ctx: mob(412, 915, 2.625, UA_A), zoom: 1.15 },
  { id: "a412-130", ctx: mob(412, 915, 2.625, UA_A), zoom: 1.3 },
  // 실제 브라우저 기본 글자 크기 설정(rem 만 130%) — CDP
  { id: "r412-130", ctx: mob(412, 915, 2.625, UA_A), fontPx: 21 },
  // 크롬 안드로이드 「페이지 확대」 방식 — 화면 전체가 커지므로 CSS 폭이 줄어든 것과 같다(412 / 배율)
  { id: "pz412-130", ctx: mob(317, 704, 2.625 * 1.3, UA_A) },
  { id: "pz412-150", ctx: mob(275, 610, 2.625 * 1.5, UA_A) },
  { id: "pz412-200", ctx: mob(206, 457, 2.625 * 2, UA_A) },
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

// 글자 확대 흉내(r2 수정판) — 결과: { forced, doubled, maxRatio }
async function zoomText(page, z) {
  if (!z) return null
  const r = await page.evaluate(async z => {
    const settle = async () => { void document.body.offsetHeight; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))) }
    const root = document.documentElement
    for (const el of document.querySelectorAll("[data-vc-z]")) { el.style.removeProperty("font-size"); el.removeAttribute("data-vc-z") }
    root.style.fontSize = ""; await settle()
    const els = [...document.body.querySelectorAll("*")]
    const base = new Map(els.map(el => [el, parseFloat(getComputedStyle(el).fontSize)]))
    root.style.fontSize = `${z * 100}%`; await settle()
    let forced = 0
    // 위에서 아래(문서 순서)로: 지금 크기가 목표보다 작으면 그 요소만 목표 px 로. 조상을 강제한 뒤에는 자손 크기를 다시 읽는다
    for (const el of els) {
      const want = base.get(el) * z
      const now = parseFloat(getComputedStyle(el).fontSize)
      if (now < want - 0.3) { el.style.setProperty("font-size", `${want.toFixed(2)}px`, "important"); el.setAttribute("data-vc-z", ""); forced++ }
    }
    await settle()
    let doubled = 0, maxRatio = 0; const ex = []
    for (const el of els) {
      const b = base.get(el); if (!b) continue
      const ratio = parseFloat(getComputedStyle(el).fontSize) / b
      if (ratio > maxRatio) maxRatio = ratio
      if (ratio > z + 0.02) { doubled++; if (ex.length < 5) ex.push(el.tagName.toLowerCase() + "." + [...el.classList].slice(0, 2).join(".") + " ×" + ratio.toFixed(2)) }
    }
    return { forced, doubled, maxRatio: +maxRatio.toFixed(3), ex }
  }, z)
  await page.waitForTimeout(300)
  return r
}

function measure() {
  const out = { touch: [], small: [], orphan: [], wrapItem: [], sizes: {}, ledger: null }
  const vis = el => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== "none" && s.visibility !== "hidden" && r.width > 1 && r.height > 1 && !el.closest(".pv-tag") && !el.closest("details:not([open]) > :not(summary)") && !el.closest("[aria-hidden=true].umb-fold__hint > :not(:first-child)") }
  const name = el => { const c = [...el.classList].slice(0, 2).join("."); return el.tagName.toLowerCase() + (c ? "." + c : "") }
  const txt = el => (el.innerText || el.value || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 30)
  // 같은 줄 = 세로로 50% 이상 겹침
  const sameLine = (a, b) => { const ov = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); return ov > 0.5 * Math.min(a.bottom - a.top, b.bottom - b.top) }
  // 터치 대상: 클릭 가능한 것. 라디오·체크박스는 감싼 label, label 로 감싼 입력 칸·select 는 label 크기(꼬리 글자 눌러도 포커스)
  const targets = new Map()
  document.querySelectorAll("a[href], button, select, input:not([type=hidden]), summary, [role=button]").forEach(el => {
    const l = el.closest("label") || (el.id && document.querySelector(`label[for="${el.id}"]`))
    if (el.matches("input[type=radio], input[type=checkbox]")) { if (l) targets.set(l, null); return }
    if (l && el.matches("input, select")) { targets.set(l, el); return }
    targets.set(el, null)
  })
  for (const [el, ctl] of targets) {
    if (!vis(el)) continue
    const r = el.getBoundingClientRect()
    if (r.width < 44 || r.height < 44) {
      const c = ctl && ctl.getBoundingClientRect()
      out.touch.push({ el: name(el), text: txt(ctl || el), w: +r.width.toFixed(1), h: +r.height.toFixed(1), ...(c ? { ctlW: +c.width.toFixed(1), ctlH: +c.height.toFixed(1) } : {}) })
    }
  }
  // 글자 크기 인벤토리와 16px 미만 문장
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const seen = new Set(), seenBlk = new Set()
  for (let n; (n = tw.nextNode());) {
    const el = n.parentElement
    if (!el || !n.data.trim() || seen.has(el) || el.closest("script,style,option,select,.pv-tag")) continue
    seen.add(el)
    if (!vis(el)) continue
    const s = getComputedStyle(el)
    const px = Math.round(parseFloat(s.fontSize) * 10) / 10
    const k = px + "px"
    out.sizes[k] = out.sizes[k] || []
    if (out.sizes[k].length < 8) out.sizes[k].push(name(el) + "「" + n.data.trim().slice(0, 14) + "」")
    const t = n.data.trim().replace(/\s+/g, " ")
    if (px < 16 && t.length >= 8 && / /.test(t)) {
      const blk = el.closest("p,li,figcaption,summary,label,legend,h1,h2,h3,div") || el
      if (!seenBlk.has(blk)) { seenBlk.add(blk); out.small.push({ el: name(el), blk: name(blk), px, text: t.slice(0, 40) }) }
    }
  }
  // 외톨이 줄(r2): 인라인 내용만 가진 문단, 세로쓰기 제외, 세로 겹침으로 같은 줄
  const BLOCKY = /^(block|flex|grid|list-item|table|flow-root)$/
  for (const el of document.querySelectorAll("p, li, figcaption, h1, h2, h3, summary span, .ub-ink__hint, .ub-ink__label, .ub-choice__legend, .umr-p-label, .umr-wg-tag, .ub-voice, .ub-note, .umb-fine")) {
    if (!vis(el)) continue
    const s = getComputedStyle(el)
    if (/vertical/.test(s.writingMode)) continue
    if ([...el.querySelectorAll("*")].some(k => BLOCKY.test(getComputedStyle(k).display) && vis(k))) continue
    const range = document.createRange(); range.selectNodeContents(el)
    const rects = [...range.getClientRects()].filter(r => r.width > 1 && r.height > 1)
    const lines = []
    for (const r of rects) { const L = lines.find(l => sameLine(l, r)); if (L) { L.left = Math.min(L.left, r.left); L.right = Math.max(L.right, r.right); L.top = Math.min(L.top, r.top); L.bottom = Math.max(L.bottom, r.bottom) } else lines.push({ top: r.top, bottom: r.bottom, left: r.left, right: r.right }) }
    if (lines.length < 2) continue
    lines.sort((a, b) => a.top - b.top)
    const last = lines[lines.length - 1], w = Math.max(...lines.map(l => l.right - l.left))
    const fs = parseFloat(s.fontSize)
    if (last.right - last.left < fs * 3.2) out.orphan.push({ el: name(el), lines: lines.length, lastW: +(last.right - last.left).toFixed(0), maxW: +w.toFixed(0), text: (el.innerText || "").trim().replace(/\s+/g, " ").slice(-28) })
  }
  // 감싸기 줄(flex-wrap, 가로)에서 마지막 줄에 항목 하나만
  for (const el of document.querySelectorAll("*")) {
    const s = getComputedStyle(el)
    if (!/flex/.test(s.display) || s.flexWrap !== "wrap" || /column/.test(s.flexDirection) || !vis(el)) continue
    const kids = [...el.children].filter(vis)
    if (kids.length < 3) continue
    const rs = kids.map(k => k.getBoundingClientRect())
    const rows = []
    rs.forEach((r, i) => { const R = rows.find(x => sameLine(x.r, r)); if (R) R.i.push(i); else rows.push({ r, i: [i] }) })
    if (rows.length < 2) continue
    rows.sort((a, b) => a.r.top - b.r.top)
    const lastRow = rows[rows.length - 1]
    if (lastRow.i.length === 1) out.wrapItem.push({ el: name(el), rows: rows.length, lone: txt(kids[lastRow.i[0]]) || name(kids[lastRow.i[0]]), all: kids.map(txt).join(" | ").slice(0, 60) })
  }
  // 장부형 ↔ 위아래형: 기록 칸의 줄마다 라벨과 값의 위치
  const led = document.querySelector(".ub-ledger")
  if (led && vis(led)) {
    const rows = []
    for (const row of led.querySelectorAll(".ub-ink, .ub-choice")) {
      if (!vis(row)) continue
      const lab = row.querySelector(":scope > .ub-ink__label, :scope > label.ub-ink__label, :scope > .ub-choice__legend, :scope > legend, .ub-ink__label")
      const val = row.querySelector(".ub-ink__wrap, .ub-ink__group, .ub-choice__row")
      if (!lab || !val) continue
      const a = lab.getBoundingClientRect(), b = val.getBoundingClientRect()
      const mode = a.right <= b.left + 1 && a.top < b.bottom ? "side" : a.bottom <= b.top + 2 ? "stack" : "?"
      rows.push({ label: (lab.innerText || "").trim().replace(/\s+/g, " ").slice(0, 10), mode })
    }
    const ls = getComputedStyle(led)
    out.ledger = { fontPx: +parseFloat(ls.fontSize).toFixed(2), widthPx: +led.getBoundingClientRect().width.toFixed(1), widthEm: +(led.getBoundingClientRect().width / parseFloat(ls.fontSize)).toFixed(2), rows, modes: [...new Set(rows.map(r => r.mode))] }
  }
  // 고르기 줄: 한 줄/세로 목록
  out.choices = [...document.querySelectorAll(".ub-choice")].filter(vis).map(f => {
    const opts = [...f.querySelectorAll(".ub-choice__opt")].filter(vis).map(o => o.getBoundingClientRect())
    const rowsN = opts.reduce((acc, r) => (acc.some(x => sameLine(x, r)) ? acc : [...acc, r]), []).length
    return { legend: (f.querySelector("legend")?.innerText || "").trim(), n: opts.length, rows: rowsN }
  })
  return out
}

// select 에서 고른 글이 칸 안쪽 폭에 들어가는가(꺾쇠 자리 = 오른쪽 padding 제외)
function selectFit() {
  const s = document.querySelector('select[aria-label="태어난 시"]')
  if (!s) return null
  const cs = getComputedStyle(s)
  const c = document.createElement("canvas").getContext("2d")
  c.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
  const t = s.options[s.selectedIndex]?.textContent || ""
  const ls = parseFloat(cs.letterSpacing) || 0
  const need = c.measureText(t).width + ls * [...t].length
  const avail = s.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
  const hint = s.closest(".ub-ink")?.querySelector(".ub-ink__hint")
  return { text: t, need: +need.toFixed(1), avail: +avail.toFixed(1), cut: need > avail + 0.5, align: cs.textAlignLast + "/" + cs.textAlign, hint: hint ? hint.innerText.trim().replace(/\s+/g, " ") : null, hintLines: hint ? Math.round(hint.getBoundingClientRect().height / parseFloat(getComputedStyle(hint).lineHeight || 20)) : 0 }
}

// 쪽 안 넘침·인장 위치·스크롤 단서
function pageInfo() {
  const p = document.querySelector("[data-qa-scroll]") || [...document.querySelectorAll(".ub-book__page")].find(e => e.scrollHeight > e.clientHeight + 2 && getComputedStyle(e).overflowY !== "visible")
  const seal = document.querySelector(".ub-seal")
  const sr = seal && seal.getBoundingClientRect()
  const vh = innerHeight
  const o = { vh, docH: document.documentElement.scrollHeight, sealTop: sr && +sr.top.toFixed(0), sealBottom: sr && +sr.bottom.toFixed(0), sealInView: sr ? sr.top >= 0 && sr.bottom <= vh : null }
  if (p) {
    const cs = getComputedStyle(p), pr = p.getBoundingClientRect()
    Object.assign(o, { pageScrollH: p.scrollHeight, pageClientH: p.clientHeight, pageOverflow: p.scrollHeight - p.clientHeight, pageTop: +pr.top.toFixed(0), pageBottom: +pr.bottom.toFixed(0), overscroll: cs.overscrollBehaviorY, gutter: cs.scrollbarGutter, scrollbarWidth: cs.scrollbarWidth, sealVisibleInPage: sr ? sr.bottom <= pr.bottom && sr.top >= pr.top : null })
  }
  return o
}

async function openInput(page, url) {
  await page.addInitScript(() => { try { localStorage.setItem("um-intro-seen", "1") } catch { /* */ } })
  await page.goto(url, { waitUntil: "networkidle" })
  await page.waitForSelector(".ub-seal", { timeout: 20000 })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(400)
}

// 책 가운데에서 휠을 굴려 문서 끝(개인정보 링크)이 화면에 들어오는가
async function wheelTest(page) {
  const box = await page.evaluate(() => { const b = document.querySelector(".ub-book__page") || document.querySelector(".ub-book"); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
  await page.mouse.move(box.x, box.y)
  for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, 300); await page.waitForTimeout(40) }
  await page.waitForTimeout(400)
  const r = await page.evaluate(() => {
    const a = [...document.querySelectorAll("a")].find(x => /개인정보/.test(x.textContent))
    const ar = a && a.getBoundingClientRect()
    const p = document.querySelector("[data-qa-scroll]")
    return { docY: Math.round(scrollY), docMax: document.documentElement.scrollHeight - innerHeight, pageTop: p ? Math.round(p.scrollTop) : null, pageMax: p ? p.scrollHeight - p.clientHeight : null, linkInView: ar ? ar.top >= 0 && ar.bottom <= innerHeight : null, linkH: ar && +ar.height.toFixed(1) }
  })
  await page.evaluate(() => { scrollTo(0, 0); const p = document.querySelector("[data-qa-scroll]"); if (p) p.scrollTop = 0 })
  return r
}

// 합성 터치 스와이프(CDP) — 작동 여부 자체도 기록
async function swipeTest(page, cdp) {
  const box = await page.evaluate(() => { const b = document.querySelector(".ub-book__page") || document.querySelector(".ub-book"); const r = b.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height * 0.6) } })
  const res = []
  for (let i = 0; i < 8; i++) {
    try { await cdp.send("Input.synthesizeScrollGesture", { x: box.x, y: box.y, yDistance: -400, gestureSourceType: "touch", speed: 1200, repeatCount: 1 }) } catch (e) { return { error: e.message.split("\n")[0] } }
    await page.waitForTimeout(200)
    res.push(await page.evaluate(() => { const p = document.querySelector("[data-qa-scroll]"); return [Math.round(scrollY), p ? Math.round(p.scrollTop) : null] }))
  }
  const linkInView = await page.evaluate(() => { const a = [...document.querySelectorAll("a")].find(x => /개인정보/.test(x.textContent)); const r = a && a.getBoundingClientRect(); return r ? r.top >= 0 && r.bottom <= innerHeight : null })
  await page.evaluate(() => { scrollTo(0, 0); const p = document.querySelector("[data-qa-scroll]"); if (p) p.scrollTop = 0 })
  return { steps: res, linkInView }
}

;(async () => {
  const srv = await serve()
  const base = `http://127.0.0.1:${srv.address().port}/index.html`
  const proxy = process.env.https_proxy || process.env.HTTPS_PROXY
  const browser = await chromium.launch(proxy ? { proxy: { server: proxy, bypass: "127.0.0.1,localhost" } } : {})
  const report = {}
  const shot = async (page, f, full = true) => { if (SHOTS) await page.screenshot({ path: path.join(OUT, f), fullPage: full }) }
  for (const c of CONDS) {
    const ctx = await browser.newContext({ ...c.ctx, reducedMotion: "reduce", locale: "ko-KR" })
    const page = await ctx.newPage()
    const cdp = await ctx.newCDPSession(page)
    if (c.fontPx) await cdp.send("Page.setFontSizes", { fontSizes: { standard: c.fontPx, fixed: Math.round(c.fontPx * 13 / 16) } })
    const R = (report[c.id] = {})
    try {
      await openInput(page, base)
      R.rootFontPx = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))
      R.zoomEmpty = await zoomText(page, c.zoom)
      R.pageEmpty = await page.evaluate(() => { const p = [...document.querySelectorAll(".ub-book__page")].find(e => getComputedStyle(e).overflowY !== "visible"); if (p) p.setAttribute("data-qa-scroll", ""); return null })
      R.pageEmpty = await page.evaluate(pageInfo)
      R.empty = await page.evaluate(measure)
      await shot(page, `${c.id}-empty-view.png`, false)
      await page.fill('input[aria-label="태어난 연도"]', "1992")
      await page.fill('input[aria-label="태어난 월"]', "8")
      await page.fill('input[aria-label="태어난 일"]', "14")
      await page.evaluate(() => document.activeElement && document.activeElement.blur())
      R.zoom = await zoomText(page, c.zoom)
      R.pageInput = await page.evaluate(pageInfo)
      R.input = await page.evaluate(measure)
      await shot(page, `${c.id}-input-0.png`)
      const sc = R.pageInput
      if (sc.pageScrollH && sc.pageOverflow > 2) {
        let i = 1
        for (let y = sc.pageClientH * 0.85; y < sc.pageScrollH; y += sc.pageClientH * 0.85, i++) {
          await page.evaluate(y => { document.querySelector("[data-qa-scroll]").scrollTop = y }, y)
          await page.waitForTimeout(150)
          await shot(page, `${c.id}-input-${i}.png`)
          if (i > 6) break
        }
        R.pageInputBottom = await page.evaluate(pageInfo)
        await page.evaluate(() => { document.querySelector("[data-qa-scroll]").scrollTop = 0 })
      }
      R.wheelInput = await wheelTest(page)
      if (c.ctx.hasTouch) R.swipeInput = await swipeTest(page, cdp)
      // 한밤중
      await page.selectOption('select[aria-label="태어난 시"]', "s0")
      await page.waitForTimeout(300)
      R.zoomSijin = await zoomText(page, c.zoom)
      R.pageSijin = await page.evaluate(pageInfo)
      R.sijin = await page.evaluate(measure)
      await page.evaluate(() => document.querySelector('select[aria-label="태어난 시"]')?.scrollIntoView({ block: "start" }))
      await shot(page, `${c.id}-sijin.png`)
      R.wheelSijin = await wheelTest(page)
      // 12개 대략 시간대 순회 + 「모름」·정확한 시 몇 개
      const opts = await page.evaluate(() => [...document.querySelector('select[aria-label="태어난 시"]').options].map(o => [o.value, o.textContent]))
      R.hourOptions = opts
      R.hours = []
      for (const [v] of opts.filter(o => o[0].startsWith("s") || o[0] === "" || o[0] === "23")) {
        await page.selectOption('select[aria-label="태어난 시"]', v); await page.waitForTimeout(120)
        if (c.zoom) await zoomText(page, c.zoom)
        const fit = await page.evaluate(selectFit)
        const m = await page.evaluate(measure)
        R.hours.push({ v, ...fit, ledgerModes: m.ledger && m.ledger.modes, wrapItem: m.wrapItem.length, orphan: m.orphan.map(o => o.text) })
      }
      await page.selectOption('select[aria-label="태어난 시"]', "s10"); await page.waitForTimeout(200); if (c.zoom) await zoomText(page, c.zoom)
      await page.evaluate(() => document.querySelector('select[aria-label="태어난 시"]')?.scrollIntoView({ block: "start" }))
      await shot(page, `${c.id}-longhour.png`)
      // 결과
      await page.selectOption('select[aria-label="태어난 시"]', "")
      await page.fill('input[name="um-name"]', "서연")
      await page.check('input[name="um-gender"][value="F"]', { force: true })
      await page.evaluate(() => { const p = document.querySelector("[data-qa-scroll]"); if (p) p.scrollTop = p.scrollHeight })
      await page.click(".ub-seal")
      await page.waitForSelector(".umb .ub-book", { timeout: 30000 })
      await page.evaluate(() => { window.scrollTo(0, 0); return document.fonts.ready })
      await page.waitForTimeout(1200)
      R.zoomResult = await zoomText(page, c.zoom)
      R.result = await page.evaluate(measure)
      await shot(page, `${c.id}-result-full.png`)
      await page.evaluate(() => { const d = document.querySelector("details.umb-fold"); if (d) d.open = true })
      await page.waitForTimeout(300)
      R.zoomResultOpen = await zoomText(page, c.zoom)
      R.resultOpen = await page.evaluate(measure)
      R.foldHint = await page.evaluate(() => { const h = document.querySelector(".umb-fold__hint"); return h ? h.innerText.trim() : null })
      await shot(page, `${c.id}-result-full-open.png`)
      R.resultHeight = await page.evaluate(() => document.documentElement.scrollHeight)
    } catch (e) { R.error = e.message.split("\n")[0] }
    await ctx.close()
    console.log(c.id, R.error || "ok")
  }
  fs.writeFileSync(path.join(OUT, "measure.json"), JSON.stringify(report, null, 1))
  await browser.close(); srv.close()
})()
