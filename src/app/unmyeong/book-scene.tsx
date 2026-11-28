"use client"
import Link from "next/link"

// 입력 장면: 펼친 고서 탑뷰 정지 이미지(PC cover / 세로 화면 contain 뒤 오른쪽 쪽으로 확대, D-032) + 같은 cover 변환으로 환산한 종이 영역 위의 실제 HTML 입력 UI.
// 장면 08(이름 각인)도 여기서 그린다 — 폼이 0.6초 동안 사라지고 이름만 종이 중앙에 먹으로 스며든다.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { UmSealButton, UmStamp } from "@/components/ui/unmyeong"
import { BookStill, StillBackdrop } from "./book-still"
import { CalField, DateField, GenderField, NameField, PlaceField, TimeField, type BirthFormState } from "./book-form"
import { containXf, coverMapper, mediaOf, prefersReducedMotion, xfMapper, zoomXf, type MediaKind, type Size } from "./media-utils"

export type ScenePhase = "form" | "imprint"

function useBox<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [box, setBox] = useState<Size | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => setBox(prev => {
      const r = el.getBoundingClientRect()
      return prev && Math.abs(prev.w - r.width) < 0.5 && Math.abs(prev.h - r.height) < 0.5 ? prev : { w: r.width, h: r.height }
    })
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, box] as const
}

function Mast({ kind }: { kind: MediaKind }) {
  return (
    <div className="um-ledger__mast um-ov-mast">
      <p className="um-ledger__kicker">너의 운명을 바꿔 줄 1급 비밀</p>
      <h1 className="um-ledger__title">
        <span className="um-ledger__han" lang="ko-Hani" aria-hidden="true">運命秘書</span>
        <span className="um-ledger__ko">운명비서<span className="um-visually-hidden">(運命秘書)</span></span>
      </h1>
      <span className="um-ledger__stamp"><UmStamp size={kind === "pc" ? "lg" : "md"}>1급 비밀</UmStamp></span>
    </div>
  )
}

const ZOOM_AT = 700 // 확대 전 왼쪽 쪽 제목을 보여 주는 시간(ms)
const ZOOM_MS = 850

export function BookScene({ kind, phase, vignette, name, form, busy, serverError, showReplay, onReplay, onStillError }: {
  kind: MediaKind
  phase: ScenePhase
  vignette: boolean
  name: string
  form: BirthFormState
  busy: boolean
  serverError: string
  showReplay: boolean
  onReplay: () => void
  onStillError: () => void
}) {
  const media = mediaOf(kind)
  const mobile = kind === "mobile"
  const [stageRef, box] = useBox<HTMLDivElement>()
  // 세로 화면: pre(전체 + 왼쪽 쪽 제목) → zoom(카메라가 내려앉듯 확대) → done(입력). 움직임 줄이기면 곧바로 done
  const [zp, setZp] = useState<"pre" | "zoom" | "done">(() => (mobile && !prefersReducedMotion() ? "pre" : "done"))
  useEffect(() => {
    if (zp === "pre") { const t = setTimeout(() => setZp("zoom"), ZOOM_AT); return () => clearTimeout(t) }
    if (zp === "zoom") { const t = setTimeout(() => setZp("done"), ZOOM_MS); return () => clearTimeout(t) }
  }, [zp])

  const geo = useMemo(() => {
    if (!box) return null
    const iw = media.stillWidth, ih = media.stillHeight
    if (mobile) {
      const cx = containXf(box, iw, ih), zx = zoomXf(box, iw, ih, media.pages.second)
      const m = xfMapper(zx, iw, ih)
      const second = m.rect(media.pages.second)
      const f = Math.max(16, Math.min(18, Math.floor(second.width / 21)))
      return { cx, zx, first: xfMapper(cx, iw, ih).rect(media.pages.first), second, c: m.point(media.imprint), f }
    }
    const m = coverMapper(box, iw, ih)
    const first = m.rect(media.pages.first), second = m.rect(media.pages.second)
    const c = m.point(media.imprint)
    // 글자 크기 단계(최소 16px): 종이 폭에 비례해 16~20px
    const f = Math.max(16, Math.min(20, Math.floor(Math.min(first.width, second.width) / 17)))
    return { cx: null, zx: null, first, second, c, f }
  }, [box, media, mobile])

  const pageStyle = (r: { left: number; top: number; width: number; height: number }, f: number): CSSProperties =>
    ({ left: r.left, top: r.top, width: r.width, height: r.height, "--ov-f": f }) as CSSProperties

  const label = name || "오늘의 대상자"
  const inkSize = geo ? Math.max(24, Math.min(geo.second.width * 0.13, 56, (geo.second.width * 0.86) / Math.max(label.length, 3) * 1.15)) : 32

  const footer = (
    <div className="um-ov-foot">
      {serverError && <p className="um-err-form" role="alert">{serverError}</p>}
      <UmSealButton type="submit" block disabled={busy}>{busy ? "펼치는 중…" : "나의 운명비서 열기"}</UmSealButton>
      <p className="um-fine">적은 생년월일은 풀이를 셈하는 데만 쓰고 서버에 남기지 않는다. 이름은 서버로 보내지 않는단다. 재미 삼아, 참고로만 읽거라. <Link href="/unmyeong/privacy" className="um-fine-link">개인정보 처리 안내</Link></p>
      {showReplay && <button type="button" className="um-replay" onClick={onReplay}>인트로 다시 보기</button>}
    </div>
  )
  const record = (
    <>
      <NameField form={form} compact />
      <GenderField form={form} />
      <CalField form={form} compact />
      <DateField form={form} />
      <TimeField form={form} compact />
      <PlaceField form={form} compact />
    </>
  )

  const waiting = mobile && zp !== "done"
  const camXf = geo && geo.cx && geo.zx ? (zp === "pre" ? geo.cx : geo.zx) : null
  const cam: CSSProperties | undefined = camXf
    ? { width: media.stillWidth, height: media.stillHeight, transform: `translate(${camXf.tx}px, ${camXf.ty}px) scale(${camXf.s})`,
        transition: zp === "pre" ? "none" : `transform ${ZOOM_MS - 50}ms cubic-bezier(.45,.05,.25,1)` }
    : undefined

  return (
    <div className="um-stage um-bookscene" ref={stageRef} data-kind={kind} data-phase={phase} data-zoom={zp}>
      {mobile ? (
        <>
          <StillBackdrop kind={kind} />
          <div className="um-cam" style={cam}><BookStill kind={kind} plain onError={onStillError} /></div>
          {geo && zp !== "done" && (
            <div className={`um-pretitle${zp === "zoom" ? " is-out" : ""}`} style={pageStyle(geo.first, 16)} aria-hidden="true">
              <p className="um-pretitle__kicker">너의 운명을 바꿔 줄 1급 비밀</p>
              <p className="um-pretitle__han" lang="ko-Hani">運命秘書</p>
              <p className="um-pretitle__ko">운명비서</p>
              <span className="um-pretitle__seal"><UmStamp size="md">1급 비밀</UmStamp></span>
            </div>
          )}
        </>
      ) : (
        <BookStill kind={kind} onError={onStillError} />
      )}
      {geo && (
        <form onSubmit={form.submit} noValidate aria-busy={busy} className={`um-formbook um-ov-form${waiting ? " is-wait" : ""}`} inert={phase !== "form" || waiting}>
          {mobile ? (
            <div className="um-ov-page um-ov-page--b um-ov-page--solo" style={pageStyle(geo.second, geo.f)}>
              <Mast kind={kind} />
              <h2 className="um-ov-rec">오늘의 대상자</h2>
              {record}
              {footer}
            </div>
          ) : (
            <>
              <div className="um-ov-page um-ov-page--a" style={pageStyle(geo.first, geo.f)}>
                <Mast kind={kind} />
                <p className="um-ov-sub">세상에 단 한 권, 오직 너를 위한 기록.</p>
              </div>
              <div className="um-ov-page um-ov-page--b" style={pageStyle(geo.second, geo.f)}>
                <h2 className="um-ov-rec">오늘의 대상자</h2>
                {record}
                {footer}
              </div>
            </>
          )}
        </form>
      )}
      {geo && phase === "imprint" && !waiting && (
        <p className="um-imprint" style={{ left: geo.c.x, top: geo.c.y, fontSize: inkSize, maxWidth: geo.second.width * 0.9 }} aria-hidden="true">{label}</p>
      )}
      <div className={`um-vignette${vignette ? " is-on" : ""}`} aria-hidden="true" />
    </div>
  )
}
