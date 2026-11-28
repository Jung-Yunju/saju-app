"use client"

// 인트로 = 영상 슬롯만. 영상은 대표가 콘티로 따로 만든다(D-027 변경). 장면 개발 코드는 intro-scene-unused.tsx(미사용)에 보존.
// assets.intro.video 가 있고 재생 가능할 때만 보여 주고, 없거나 실패·느린 연결·움직임 줄이기면 곧바로 입력 화면으로 넘어간다.
import { useEffect, useRef, useState } from "react"
import { UNMYEONG_ASSETS as assets } from "@/lib/unmyeong/assets"

type NetInfo = { saveData?: boolean; effectiveType?: string }

function canPlayVideo(): boolean {
  if (!assets.intro.video) return false
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false
  const c = (navigator as Navigator & { connection?: NetInfo }).connection
  if (c?.saveData) return false
  if (c?.effectiveType && /^(slow-2g|2g|3g)$/.test(c.effectiveType)) return false
  return true
}

export function Intro({ onDone }: { onDone: (skipped: boolean) => void }) {
  const video = assets.intro.video
  const ref = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(true)
  const [ok, setOk] = useState<boolean | null>(null)
  const done = useRef(onDone)
  useEffect(() => { done.current = onDone })

  useEffect(() => {
    const play = canPlayVideo()
    if (!play) done.current(false)
    else setOk(true) // eslint-disable-line react-hooks/set-state-in-effect
  }, [])

  useEffect(() => {
    if (!ok) return
    // 5초 안에 재생 준비가 안 되면(느린 연결 등) 입력 화면으로
    const t = setTimeout(() => { if (!ref.current || ref.current.readyState < 3) done.current(false) }, 5000)
    return () => clearTimeout(t)
  }, [ok])

  if (!ok || !video) return <div className="um-boot" aria-hidden="true" />
  return (
    <section className="um-intro" aria-label="인트로">
      <div className="um-video-wrap">
        <video ref={ref} className="um-video" src={video.mp4} poster={video.poster} autoPlay muted={muted} playsInline preload="auto"
          onEnded={() => done.current(false)} onError={() => done.current(false)} onStalled={() => done.current(false)} aria-hidden="true" />
        <button type="button" className="um-sound" onClick={() => setMuted(m => !m)} aria-pressed={!muted}>{muted ? "소리 켜기" : "소리 끄기"}</button>
      </div>
      <button type="button" className="um-skip" onClick={() => done.current(true)}>건너뛰기</button>
    </section>
  )
}
