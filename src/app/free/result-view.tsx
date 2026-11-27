"use client"

import { useEffect, useRef, useState } from "react"
import { Bokja } from "./bokja"
import {
  buildShareSpec, canvasToBlob, drawShareCard, prepareCardFonts, readCardColors, type ShareSpec,
} from "./share-card"
import { SITE_NAME } from "./theme"
import { elementTitle } from "./_lib/element-title"
import { branchShort, dmCaption, EL_HANJA, EL_PLAIN, PILLAR_PLAIN, PILLAR_TERM, stemPicture, stemShort } from "./_lib/plain"
import type { CopyBlock, ElementKo, FreeResult, GanzhiView } from "./_lib/types"

const ELEMENTS: ElementKo[] = ["목", "화", "토", "금", "수"]
// 만세력 표기 순서: 시 · 일 · 월 · 연 (왼쪽부터)
const ORDER = ["hour", "day", "month", "year"] as const

function Text({ block }: { block: CopyBlock }) {
  if (block.placeholder) return <p className="fr-ph">{block.text}</p>
  return (
    <>
      {block.lead && <p className="fr-lead">{block.lead}</p>}
      <p className="fr-halmi-text">{block.text}</p>
      {block.details?.map((d) => (
        <p key={d.label} className="fr-detail"><b>{d.label}</b> {d.text}</p>
      ))}
    </>
  )
}

function Gz({ g, className }: { g: GanzhiView; className?: string }) {
  return (
    <span className={className}>
      <i data-el={g.element} style={{ color: "var(--el)" }}>{g.stemHanja}</i>
      <i data-el={g.branchEl} style={{ color: "var(--el)" }}>{g.branchHanja}</i>
    </span>
  )
}

export function ResultView({ result: r, onReset }: { result: FreeResult; onReset: () => void }) {
  const spec = buildShareSpec(r)
  const total = r.elements.reduce((n, e) => n + e.count, 0) || 1
  const max = Math.max(...r.elements.map((e) => e.count), 1)

  return (
    <div>
      <div className="fr-result">
        <div className="fr-result-main">
          {/* 첫 인상: 일간 별명 */}
          <section className="fr-section" aria-labelledby="fr-h-dm">
            <div className="fr-card fr-intro-card" data-el={r.dayMaster.element}>
              <Bokja className="fr-intro-cat" />
              <span className="fr-dm-badge fr-hanja" aria-hidden="true">{r.dayMaster.hanja}</span>
              <p className="kicker">
                나를 나타내는 글자 — {stemPicture(r.dayMaster.hanja) || dmCaption(r.dayMaster.hanja, r.dayMaster.ko, r.dayMaster.element)}
                <small className="fr-term"> ({r.dayMaster.ko}{r.dayMaster.element} {r.dayMaster.hanja}{EL_HANJA[r.dayMaster.element]} · 일간)</small>
              </p>
              <h1 id="fr-h-dm">{r.dayMaster.nickname}</h1>
              {!r.copy.share.placeholder && <p className="line">{r.copy.share.line}</p>}
            </div>
          </section>

          <section className="fr-section" aria-labelledby="fr-h-halmi">
            <h2 id="fr-h-halmi">할미 한마디</h2>
            <div className="fr-card fr-halmi">
              <div className="fr-halmi-item"><h3>나를 나타내는 글자 이야기</h3><Text block={r.copy.dayMaster} /></div>
              <div className="fr-halmi-item"><h3>태어난 날의 두 글자 이야기 <small className="fr-term">({r.dayPillar.ko} · 일주)</small></h3><Text block={r.copy.dayPillar} /></div>
              {r.copy.disclaimer && <p className="fr-ph fr-fine-left">{r.copy.disclaimer}</p>}
            </div>
          </section>

          {/* 원국표 */}
          <section className="fr-section" aria-labelledby="fr-h-chart">
            <h2 id="fr-h-chart">태어난 해·달·날·시의 여덟 글자 <small className="fr-term">사주 원국</small></h2>
            <div className="fr-chart" role="table" aria-label="태어난 해·달·날·시의 여덟 글자 표">
              {ORDER.map((key) => {
                const p = r.pillars.find((x) => x.key === key)
                if (!p) {
                  return (
                    <div key={key} className="fr-pillar is-empty" role="row">
                      <div className="fr-plabel">{PILLAR_PLAIN[key]}<small>{PILLAR_TERM[key]}</small></div>
                      <p className="fr-empty-note">태어난 시각을 몰라 비워 뒀어요</p>
                    </div>
                  )
                }
                return (
                  <div key={key} className={`fr-pillar ${p.me ? "is-me" : ""}`} role="row">
                    {p.me && <span className="fr-me-tag">나</span>}
                    <div className="fr-plabel">{PILLAR_PLAIN[key]}<small>{PILLAR_TERM[key]}</small></div>
                    <div className="fr-gz" data-el={p.element}>
                      <span className="h fr-hanja" aria-hidden="true">{p.stemHanja}</span>
                      <span className="p">{stemShort(p.stemHanja)}</span>
                      <span className="k">{p.stemKo}{p.element}</span>
                    </div>
                    <div className="fr-gz" data-el={p.branchEl}>
                      <span className="h fr-hanja" aria-hidden="true">{p.branchHanja}</span>
                      <span className="p">{branchShort(p.branchHanja)}</span>
                      <span className="k">{p.branchKo}{p.branchEl}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="fr-legend">위 칸은 하늘에서 내려온 글자(천간), 아래 칸은 땅의 글자(지지)예요. 색은 다섯 가지 기운(오행)이에요: 나무(목) 초록 · 불(화) 붉은색 · 흙(토) 갈색 · 쇠(금) 회색 · 물(수) 파랑.</p>
          </section>

          {/* 오행 분포 */}
          <section className="fr-section" aria-labelledby="fr-h-el">
            <h2 id="fr-h-el">다섯 가지 기운 <small className="fr-term">오행 분포</small></h2>
            <div className="fr-card">
              <div className="fr-bars" role="img" aria-label={`다섯 가지 기운의 개수: ${ELEMENTS.map((el) => `${EL_PLAIN[el]} ${r.elements.find((e) => e.el === el)?.count ?? 0}개`).join(", ")}`}>
                {ELEMENTS.map((el) => {
                  const n = r.elements.find((e) => e.el === el)?.count ?? 0
                  return (
                    <div key={el} className="fr-bar" data-el={el}>
                      <span className="fr-bar-name">{EL_PLAIN[el]}<small>{el} {EL_HANJA[el]}</small></span>
                      <span className="fr-track"><span className="fr-fill" style={{ display: "block", width: `${n === 0 ? 0 : Math.max(8, (n / max) * 100)}%`, ...(n === 0 ? { borderRight: "none" } : {}) }} /></span>
                      <span className={`fr-bar-n ${n === 0 ? "zero" : ""}`}>{n === 0 ? "없음" : `${n}개`}</span>
                    </div>
                  )
                })}
              </div>
              <p className="fr-sub" style={{ marginTop: "var(--s-3)", marginBottom: 0 }}>글자 {total}개(위 칸 {r.hourUnknown ? 3 : 4} + 아래 칸 {r.hourUnknown ? 3 : 4}) 기준이에요.</p>
              {r.copy.elements.length > 0 && (
                <div className="fr-halmi" style={{ marginTop: "var(--s-4)" }}>
                  {r.copy.elements.map((c) => (
                    <div key={`${c.kind}-${c.el}`} className="fr-halmi-item">
                      <h3>{elementTitle(c.kind, c.el)}</h3>
                      <Text block={c} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <DaeunTimeline r={r} />

          {/* 올해 */}
          <section className="fr-section" aria-labelledby="fr-h-year">
            <h2 id="fr-h-year">{r.thisYear.year}년, 올해 들어오는 기운</h2>
            <div className="fr-card fr-year">
              <div className="fr-year-gz">
                <Gz g={r.thisYear.ganzhi} className="h fr-hanja" />
                <span className="k">{r.thisYear.ganzhi.ko}년 · {stemShort(r.thisYear.ganzhi.stemHanja)}과 {branchShort(r.thisYear.ganzhi.branchHanja)}</span>
              </div>
              <div><Text block={r.copy.thisYear} />{r.copy.thisYearNote && <p className="fr-ph fr-fine-left">{r.copy.thisYearNote}</p>}</div>
            </div>
          </section>

          {r.warnings.length > 0 && (
            <section className="fr-section" aria-labelledby="fr-h-warn">
              <h2 id="fr-h-warn" className="sr-only">계산 참고</h2>
              <div className="fr-note">
                <b>계산할 때 알아 둘 점</b>
                <ul>{r.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </div>
            </section>
          )}
        </div>

        <div className="fr-result-side">
          <ShareBlock spec={spec} />
          <LockedBlock teaser={r.copy.teaser} />
        </div>
      </div>

      <div className="fr-btn-row" style={{ maxWidth: "var(--content-max)", margin: "var(--s-8) auto 0" }}>
        <button type="button" className="fr-btn fr-btn-ghost" onClick={onReset}>다른 생년월일로 다시 보기</button>
      </div>
      <p className="fr-disclaimer">
        {SITE_NAME}의 풀이는 명리학의 관점으로 쓴 읽을거리예요. 미래를 맞힌다는 과학적 근거는 없으니 재미와 참고로만 봐 주세요.<br />
        할머니와 복자는 이야기 속 인물이에요. 이 결과는 AI가 아니라 옛 달력(만세력) 계산으로 나왔어요.
      </p>
    </div>
  )
}

function DaeunTimeline({ r }: { r: FreeResult }) {
  const scroller = useRef<HTMLDivElement>(null)
  const { items, currentIndex, startAge } = r.daeun
  useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>(".is-current")
    if (el && scroller.current) scroller.current.scrollLeft = Math.max(0, el.offsetLeft - scroller.current.clientWidth / 2 + el.clientWidth / 2)
  }, [])
  return (
    <section className="fr-section" aria-labelledby="fr-h-daeun">
      <h2 id="fr-h-daeun">열 해마다 바뀌는 큰 흐름 <small className="fr-term">대운</small></h2>
      <p className="fr-sub">
        약 10년마다 갈아입는 옷처럼 바뀌어요. 첫 흐름은 {startAge}세부터 시작해요.
        {currentIndex < 0 && " 지금은 첫 흐름이 시작되기 전이에요."}
      </p>
      <div className="fr-tl-scroll" ref={scroller} tabIndex={0} role="region" aria-label="열 해마다 바뀌는 큰 흐름 가로 목록">
        <ol className="fr-tl" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {items.map((d, i) => (
            <li key={d.hanja + d.startYear} className={`fr-tl-item ${d.current ? "is-current" : ""}`} aria-current={d.current ? "step" : undefined}>
              {d.current && <span className="fr-now">지금</span>}
              <span className="fr-tl-age">{d.startAge}세</span>
              <div className="fr-tl-box">
                <Gz g={d} className="h fr-hanja" />
                <span className="k">{d.ko}</span>
              </div>
              <div className="fr-tl-yr">{d.startYear}~</div>
              {i === 0 && currentIndex < 0 && <span className="sr-only">지금은 이 흐름이 시작되기 전이에요</span>}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function ShareBlock({ spec }: { spec: ShareSpec }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [msg, setMsg] = useState("")
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    const canvas = canvasRef.current
    const root = canvas?.closest<HTMLElement>(".fr-root")
    if (!canvas || !root) return
    const colors = readCardColors(root, spec.element)
    prepareCardFonts(colors, spec)
      .then(() => drawShareCard(canvas, spec, colors))
      .then(() => alive && setReady(true))
      .catch(() => alive && setMsg("카드 그림을 만들지 못했어요. 새로고침 후 다시 시도해 주세요."))
    return () => { alive = false }
  }, [spec.dmHanja, spec.nickname, spec.line, spec.element]) // eslint-disable-line react-hooks/exhaustive-deps

  async function shareCard() {
    const canvas = canvasRef.current
    if (!canvas || !ready) return
    setMsg("")
    try {
      const blob = await canvasToBlob(canvas)
      const file = new File([blob], spec.filename, { type: "image/png" })
      const url = `${location.origin}${spec.path}`
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: spec.site, text: spec.shareText, url })
        return
      }
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = spec.filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(a.href), 4000)
      setMsg("카드를 저장했어요. 마음에 드는 곳에 올려 보세요.")
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return
      setMsg("저장하지 못했어요. 카드를 길게 눌러 저장해 보세요.")
    }
  }

  async function copyLink() {
    const url = `${location.origin}${spec.path}`
    try {
      if (navigator.share && !navigator.canShare?.({ files: [new File([], "x.png", { type: "image/png" })] })) {
        await navigator.share({ title: spec.site, text: spec.shareText, url })
      } else {
        await navigator.clipboard.writeText(url)
        setMsg("링크를 복사했어요.")
      }
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") setMsg("링크를 복사하지 못했어요.")
    }
  }

  return (
    <section className="fr-section" aria-labelledby="fr-h-share">
      <h2 id="fr-h-share">카드로 저장·공유</h2>
      <p className="fr-sub">이름과 생년월일은 카드에 들어가지 않아요. 별명과 한 줄만 담겨요.</p>
      <canvas ref={canvasRef} className={`fr-share-canvas ${ready ? "" : "fr-skeleton"}`} role="img" aria-label={`공유 카드 미리보기: ${spec.nickname}`} />
      <div className="fr-btn-row">
        <button type="button" className="fr-btn fr-btn-primary" onClick={shareCard} disabled={!ready}>카드로 저장/공유</button>
        <button type="button" className="fr-btn fr-btn-ghost" onClick={copyLink}>링크 복사</button>
      </div>
      <p className="fr-toast" role="status" aria-live="polite">{msg}</p>
    </section>
  )
}

function LockedBlock({ teaser }: { teaser: FreeResult["copy"]["teaser"] }) {
  const [notice, setNotice] = useState(false)
  return (
    <section className="fr-section" aria-labelledby="fr-h-lock">
      <div className="fr-card fr-lock">
        <svg className="fr-lock-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
        <h2 id="fr-h-lock">{teaser.title}</h2>
        <p className="fr-sub" style={{ marginTop: "var(--s-1)", marginBottom: 0 }}>무료 결과 뒤에는 이런 이야기가 이어져요.</p>
        {teaser.placeholder ? (
          <p className="fr-ph" style={{ marginTop: "var(--s-3)" }}>{teaser.lock}</p>
        ) : (
          <>
            <ul>{teaser.items.map((t) => <li key={t.menu}><span><b>{t.menu}</b> {t.preview}</span></li>)}</ul>
            <p className="fr-halmi-text" style={{ marginTop: "var(--s-4)" }}>{teaser.lock}</p>
          </>
        )}
        <button type="button" className="fr-btn fr-btn-ghost" onClick={() => setNotice(true)} aria-describedby="fr-lock-msg">
          {teaser.button}
        </button>
        <p id="fr-lock-msg" className="fr-toast" role="status" aria-live="polite">{notice ? "아직 준비 중이에요. 곧 만나요." : ""}</p>
      </div>
    </section>
  )
}
