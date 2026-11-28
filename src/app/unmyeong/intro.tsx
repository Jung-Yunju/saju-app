"use client"

// 인트로 = 영상(장면 01~07) + 건너뛰기. 재생 거부·로딩 실패·느린 연결·움직임 줄이기면 곧바로 정지 이미지(입력 화면)로 간다.
// 영상이 끝나면 마지막 프레임 위에 같은 구도의 정지 이미지를 0.36초 크로스페이드로 얹은 뒤 입력 단계로 넘긴다.
import { useEffect, useRef, useState } from "react"
import { BookStill } from "./book-still"
import { canPlayMedia, mediaOf, type MediaKind } from "./media-utils"

export type IntroResult = "ended" | "skipped" | "fallback"
/** 인트로 영상이 한 번이라도 실제로 재생됐는가(다시 보기 버튼 표시용) */
export let introHasPlayed = false

export function Intro({ kind: kindProp, onDone }: { kind: MediaKind; onDone: (r: IntroResult) => void }) {
  const [kind] = useState(kindProp) // 재생 중 화면을 돌려도 영상이 끊기지 않게 처음 비율로 고정
  const media = mediaOf(kind)
  const ref = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(true)
  const [ended, setEnded] = useState(false)
  const [go, setGo] = useState<boolean | null>(null)
  const playing = useRef(false)
  const failed = useRef(0)
  const done = useRef(onDone)
  useEffect(() => { done.current = onDone })

  useEffect(() => {
    if (!canPlayMedia()) { done.current("fallback"); return }
    setGo(true) // eslint-disable-line react-hooks/set-state-in-effect
    // 입력 화면에 쓸 정지 이미지를 미리 받아 둔다(크로스페이드가 비지 않게)
    const im = new Image(); im.src = media.stillWebp
    // 4초 안에 재생이 시작되지 않으면(느린 연결·자동 재생 차단) 곧바로 정지 이미지
    const t = setTimeout(() => { if (!playing.current) done.current("fallback") }, 4000)
    return () => clearTimeout(t)
  }, [media.stillWebp])

  useEffect(() => {
    if (!go) return
    ref.current?.play()?.catch(() => done.current("fallback"))
  }, [go])

  useEffect(() => {
    if (!ended) return
    const t = setTimeout(() => done.current("ended"), 380)
    return () => clearTimeout(t)
  }, [ended])

  if (!go) return <div className="um-boot" aria-hidden="true" />
  return (
    <section className="um-stage um-intro" aria-label="인트로">
      <video ref={ref} className="um-stage-media" autoPlay muted={muted} playsInline preload="auto" aria-hidden="true"
        onPlaying={() => { playing.current = true; introHasPlayed = true }}
        onEnded={() => setEnded(true)} onError={e => { if (e.target === e.currentTarget) done.current("fallback") }}>
        {media.introVideo.map(s => (
          <source key={s.src} src={s.src} type={s.type}
            onError={() => { failed.current += 1; if (failed.current >= media.introVideo.length) done.current("fallback") }} />
        ))}
      </video>
      {ended && <BookStill kind={kind} className="um-still--fade" />}
      {!ended && (
        <>
          <button type="button" className="um-skip" onClick={() => done.current("skipped")}>건너뛰기</button>
          <button type="button" className="um-sound" onClick={() => setMuted(m => !m)} aria-pressed={!muted}>{muted ? "소리 켜기" : "소리 끄기"}</button>
        </>
      )}
    </section>
  )
}
