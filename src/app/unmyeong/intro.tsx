"use client"

import { useEffect, useRef, useState } from "react"
import { assets } from "./_fallback"

const LINES = [
  "이놈, 왔구나.",
  "네가 이곳에 온 오늘이, 하늘이 널 부른 날이구나.",
  "그래… 무엇이 궁금해서 왔느냐.",
  "하늘이 네게 준 운명은 있어도, 네가 살아갈 인생까지 정해진 것은 아니란다.",
  "자, 네 이름과 태어난 날을 적어 보거라.",
  "네 운명의 비밀을 이 할미가 열어 주마.",
]
const HOLD_MS = [2200, 3200, 3000, 4800, 3200, 3200]
const OPEN_MS = 1100

type NetInfo = { saveData?: boolean; effectiveType?: string }

function shouldUseScene(): boolean {
  if (!assets.intro.video) return true
  const c = (navigator as Navigator & { connection?: NetInfo }).connection
  if (c?.saveData) return true
  if (c?.effectiveType && /^(slow-2g|2g|3g)$/.test(c.effectiveType)) return true
  return false
}

export function Intro({ onDone }: { onDone: (skipped: boolean) => void }) {
  // 영상은 클라이언트에서 환경을 본 뒤에만 시도한다(서버 렌더 때는 대체 장면)
  const [useVideo, setUseVideo] = useState(false)
  const [beat, setBeat] = useState(0)
  const [opening, setOpening] = useState(false)
  const done = useRef(onDone)
  useEffect(() => { done.current = onDone })

  useEffect(() => {
    if (!shouldUseScene()) setUseVideo(true) // eslint-disable-line react-hooks/set-state-in-effect
  }, [])

  // 대체 장면 진행: 대사 6줄 → 고서가 펼쳐짐 → 입력 화면
  useEffect(() => {
    if (useVideo) return
    if (beat >= LINES.length) {
      const t = setTimeout(() => done.current(false), OPEN_MS)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => {
      if (beat === LINES.length - 1) setOpening(true)
      setBeat(beat + 1)
    }, HOLD_MS[beat])
    return () => clearTimeout(t)
  }, [beat, useVideo])

  const video = assets.intro.video
  return (
    <section className={`um-intro ${opening ? "is-opening" : ""}`} aria-label="인트로">
      {useVideo && video ? (
        <IntroVideo
          src={video.src} poster={video.poster}
          onEnd={() => { setOpening(true); setTimeout(() => done.current(false), OPEN_MS) }}
          onFail={() => setUseVideo(false)}
        />
      ) : (
        <Scene beat={Math.min(beat, LINES.length - 1)} />
      )}

      {!useVideo && (
        <p className="um-caption" aria-live="polite" key={beat}>
          {beat < LINES.length ? LINES[beat] : ""}
        </p>
      )}
      <div className="um-paper-grow" aria-hidden="true" />
      <button type="button" className="um-skip" onClick={() => onDone(true)}>건너뛰기</button>
    </section>
  )
}

function IntroVideo({ src, poster, onEnd, onFail }: { src: string; poster?: string; onEnd: () => void; onFail: () => void }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(true)
  useEffect(() => {
    // 5초 안에 재생이 시작되지 않으면(느린 연결 등) 대체 장면으로 바꾼다
    const t = setTimeout(() => { if (ref.current && ref.current.readyState < 3) onFail() }, 5000)
    return () => clearTimeout(t)
  }, [onFail])
  return (
    <div className="um-video-wrap">
      <video ref={ref} className="um-video" src={src} poster={poster} autoPlay muted={muted} playsInline preload="auto"
        onEnded={onEnd} onError={onFail} onStalled={onFail} aria-hidden="true" />
      <button type="button" className="um-sound" onClick={() => setMuted(m => !m)} aria-pressed={!muted}>
        {muted ? "소리 켜기" : "소리 끄기"}
      </button>
    </div>
  )
}

/** CSS/SVG 대체 장면. 콘티 SCENE 01~04: 어두운 서재, 등불, 할머니, 복자(눈 깜박임), 운명비서 고서 */
function Scene({ beat }: { beat: number }) {
  return (
    <div className="um-scene" data-beat={beat} aria-hidden="true">
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" className="um-scene-svg">
        <defs>
          <radialGradient id="um-lampglow" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#f0b860" stopOpacity=".55" />
            <stop offset="1" stopColor="#f0b860" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="400" height="300" fill="#141310" />
        {/* 서재 책장 */}
        <g fill="#211C17" stroke="#382B21" strokeWidth="2">
          <rect x="0" y="20" width="110" height="200" /><rect x="290" y="20" width="110" height="200" />
        </g>
        <g stroke="#382B21" strokeWidth="2">
          {[70, 120, 170].map(y => <line key={y} x1="0" x2="110" y1={y} y2={y} />)}
          {[70, 120, 170].map(y => <line key={"r" + y} x1="290" x2="400" y1={y} y2={y} />)}
        </g>
        <g fill="#4a3a2c">
          {[8, 24, 40, 62, 80].map((x, i) => <rect key={x} x={x} y={i % 2 ? 36 : 30} width="12" height={i % 2 ? 34 : 40} />)}
          {[300, 318, 340, 360, 376].map((x, i) => <rect key={x} x={x} y={i % 2 ? 86 : 80} width="12" height={i % 2 ? 34 : 40} />)}
        </g>
        {/* 등불 */}
        <g className="um-lamp">
          <circle cx="200" cy="120" r="150" fill="url(#um-lampglow)" />
          <line x1="200" y1="0" x2="200" y2="52" stroke="#504335" strokeWidth="2" />
          <path d="M184 52h32l6 26h-44z" fill="#b9a17a" />
          <ellipse cx="200" cy="80" rx="12" ry="5" fill="#ffd89a" />
        </g>
        {/* 책상 */}
        <rect x="0" y="228" width="400" height="72" fill="#382B21" />
        <rect x="0" y="228" width="400" height="5" fill="#504335" />
        {/* 할머니 */}
        <g className="um-grandma">
          <path d="M120 236c0-52 26-72 58-72s58 20 58 72z" fill="#3a3a44" />
          <ellipse cx="178" cy="132" rx="26" ry="31" fill="#c9a98a" />
          <path d="M150 128c0-26 14-38 28-38s28 12 28 38c-6-12-14-18-28-18s-22 6-28 18z" fill="#cfd0d4" />
          <circle cx="178" cy="86" r="11" fill="#cfd0d4" />
          <g fill="none" stroke="#504335" strokeWidth="1.6"><circle cx="168" cy="134" r="7" /><circle cx="188" cy="134" r="7" /><line x1="175" y1="134" x2="181" y2="134" /></g>
          <path d="M170 152q8 4 16 0" stroke="#7a5a48" strokeWidth="1.6" fill="none" />
        </g>
        {/* 복자(고양이) */}
        <g className="um-bokja">
          <ellipse cx="302" cy="222" rx="30" ry="22" fill="#d8c3a0" />
          <path d="M280 200l-4-26 18 12zM324 200l4-26-18 12z" fill="#d8c3a0" />
          <ellipse cx="302" cy="196" rx="25" ry="20" fill="#d8c3a0" />
          <ellipse className="um-eye" cx="293" cy="196" rx="3.4" ry="4.5" fill="#2a2018" />
          <ellipse className="um-eye" cx="311" cy="196" rx="3.4" ry="4.5" fill="#2a2018" />
          <path d="M298 205l4 3 4-3" stroke="#7a5a48" strokeWidth="1.4" fill="none" />
        </g>
        {/* 운명비서 고서 */}
        <g className="um-book">
          <rect x="150" y="214" width="100" height="16" fill="#5b3a2a" stroke="#b9a17a" strokeWidth="1.5" />
          <rect className="um-book-page" x="156" y="206" width="88" height="10" fill="#C9B898" />
          <text x="200" y="226" textAnchor="middle" fontSize="8" fill="#b9a17a" fontFamily="serif">運命秘書</text>
        </g>
      </svg>
    </div>
  )
}
