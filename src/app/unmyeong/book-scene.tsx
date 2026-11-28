"use client"

// 입력 장면: 펼친 고서 탑뷰 정지 이미지(cover) + 같은 cover 변환으로 환산한 종이 영역 위의 실제 HTML 입력 UI.
// 장면 08(이름 각인)도 여기서 그린다 — 폼이 0.6초 동안 사라지고 이름만 종이 중앙에 먹으로 스며든다.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { UmSealButton, UmStamp } from "@/components/ui/unmyeong"
import { BookStill } from "./book-still"
import { CalField, DateField, GenderField, NameField, PlaceField, TimeField, type BirthFormState } from "./book-form"
import { coverMapper, mediaOf, type MediaKind, type Size } from "./media-utils"

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
  const [stageRef, box] = useBox<HTMLDivElement>()
  const geo = useMemo(() => {
    if (!box) return null
    const m = coverMapper(box, media.stillWidth, media.stillHeight)
    const first = m.rect(media.pages.first), second = m.rect(media.pages.second)
    const c = m.point(media.imprint)
    // 글자 크기 단계(최소 16px): 종이 폭에 비례해 16~20px
    const f = Math.max(16, Math.min(20, Math.floor(Math.min(first.width, second.width) / 17)))
    return { first, second, c, f }
  }, [box, media])

  const pageStyle = (r: { left: number; top: number; width: number; height: number }, f: number): CSSProperties =>
    ({ left: r.left, top: r.top, width: r.width, height: r.height, "--ov-f": f }) as CSSProperties

  const label = name || "오늘의 대상자"
  const inkSize = geo ? Math.max(24, Math.min(geo.second.width * 0.13, 56, (geo.second.width * 0.86) / Math.max(label.length, 3) * 1.15)) : 32

  const footer = (
    <div className="um-ov-foot">
      {serverError && <p className="um-err-form" role="alert">{serverError}</p>}
      <UmSealButton type="submit" block disabled={busy}>{busy ? "펼치는 중…" : "나의 운명비서 열기"}</UmSealButton>
      <p className="um-fine">생년월일은 풀이 계산에만 쓰고 저장하지 않는단다. 이름은 서버로 보내지 않아. 재미와 참고용이야.</p>
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

  return (
    <div className="um-stage um-bookscene" ref={stageRef} data-kind={kind} data-phase={phase}>
      <BookStill kind={kind} onError={onStillError} />
      {geo && (
        <form onSubmit={form.submit} noValidate aria-busy={busy} className="um-formbook um-ov-form" inert={phase !== "form"}>
          {kind === "mobile" ? (
            <>
              <div className="um-ov-page um-ov-page--a" style={pageStyle(geo.first, geo.f)}>
                <Mast kind={kind} />
                <NameField form={form} compact />
                <GenderField form={form} />
                <CalField form={form} compact />
              </div>
              <div className="um-ov-page um-ov-page--b" style={pageStyle(geo.second, geo.f)}>
                <DateField form={form} />
                <TimeField form={form} compact />
                <PlaceField form={form} compact />
                {footer}
              </div>
            </>
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
      {geo && phase === "imprint" && (
        <p className="um-imprint" style={{ left: geo.c.x, top: geo.c.y, fontSize: inkSize, maxWidth: geo.second.width * 0.9 }} aria-hidden="true">{label}</p>
      )}
      <div className={`um-vignette${vignette ? " is-on" : ""}`} aria-hidden="true" />
    </div>
  )
}
