"use client"

// 장면 09~10 결과 진입 영상. API 응답이 아직이면 책장 넘김 구간(loopStart~loopEnd)을 반복하고,
// 응답이 오면 멈춤 컷(stopStart~끝)으로 이어 재생한다. 끝나면 onEnd(마지막 프레임을 그대로 두고 결과로 디졸브).
import { useEffect, useRef, useState } from "react"
import { UNMYEONG_MEDIA } from "@/lib/unmyeong/assets"
import { StillBackdrop } from "./book-still"
import { mediaOf, relCss, type MediaKind } from "./media-utils"

export function EntryVideo({ kind: kindProp, ready, fading, zoomFrom, onEnd, onFail }: {
  kind: MediaKind; ready: boolean; fading: boolean; zoomFrom?: { k: number; x: number; y: number } | null; onEnd: () => void; onFail: () => void
}) {
  const [kind] = useState(kindProp) // 재생 중 회전해도 끊기지 않게 고정
  const media = mediaOf(kind)
  const cues = UNMYEONG_MEDIA.resultEntryCues
  const ref = useRef<HTMLVideoElement>(null)
  const readyRef = useRef(ready)
  const started = useRef(false)
  // 모바일: 입력 화면의 확대 상태에서 시작해 확대를 풀며 영상으로 넘어간다(D-032)
  const [zoomed, setZoomed] = useState(!!zoomFrom)
  useEffect(() => {
    if (!zoomFrom) return
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setZoomed(false)))
    return () => cancelAnimationFrame(id)
  }, [zoomFrom])
  const failedSrc = useRef(0)
  const cb = useRef({ onEnd, onFail })
  useEffect(() => { cb.current = { onEnd, onFail } })
  useEffect(() => { readyRef.current = ready }, [ready])

  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.play()?.catch(() => cb.current.onFail())
    // 4초 안에 재생이 시작되지 않으면 기존 로딩 연출로
    const t = setTimeout(() => { if (!started.current) cb.current.onFail() }, 4000)
    // 프레임 단위로 구간을 감시한다(requestVideoFrameCallback 우선, 없으면 rAF)
    let stop = false
    const check = () => {
      if (stop) return
      const end = cues.loopEnd - 0.04
      if (v.currentTime >= end && v.currentTime < cues.stopStart + 0.3 && !v.ended) {
        if (readyRef.current) { if (cues.stopStart > v.currentTime + 0.05) v.currentTime = cues.stopStart }
        else v.currentTime = cues.loopStart
      }
      schedule()
    }
    const schedule = () => {
      if ("requestVideoFrameCallback" in v) (v as HTMLVideoElement & { requestVideoFrameCallback: (cb: () => void) => number }).requestVideoFrameCallback(check)
      else requestAnimationFrame(check)
    }
    schedule()
    return () => { stop = true; clearTimeout(t) }
  }, [cues.loopEnd, cues.loopStart, cues.stopStart])

  return (
    <div className={`um-entry${fading ? " is-fading" : ""}`} aria-hidden="true">
      <StillBackdrop kind={kind} />
      <div className="um-entry__cam" style={zoomFrom ? { transform: zoomed ? relCss(zoomFrom) : "none" } : undefined}>
      <video ref={ref} className={`um-stage-media${kind === "mobile" ? " um-contain" : ""}`} autoPlay muted playsInline preload="auto"
        onPlaying={() => { started.current = true }}
        onEnded={() => cb.current.onEnd()}
        onError={e => { if (e.target === e.currentTarget) cb.current.onFail() }}>
        {media.resultEntryVideo.map(s => (
          <source key={s.src} src={s.src} type={s.type}
            onError={() => { failedSrc.current += 1; if (failedSrc.current >= media.resultEntryVideo.length) cb.current.onFail() }} />
        ))}
      </video>
      </div>
    </div>
  )
}
