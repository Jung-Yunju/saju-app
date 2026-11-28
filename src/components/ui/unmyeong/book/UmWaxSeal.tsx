"use client"
import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from "react"
import { cx } from "../cx"
import { SEAL_ART as A } from "./seal-art"

export type UmWaxSealProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "children" | "type"> & {
  /** 인장 아래 글(기본 "나의 운명비서 열기") */
  label?: ReactNode
  /** 봉인이 갈라지는 0.6초 연출이 끝난 뒤 불린다. 없으면 감싼 <form>을 requestSubmit() 한다 */
  onActivate?: () => void
  /**
   * 연출 전에 확인(입력 검사 등). false를 돌려주면 인장은 갈라지지 않는다.
   * 없으면 감싼 폼의 기본 검사(reportValidity)를 쓴다 — 폼이 noValidate면 검사 없이 진행.
   */
  beforeActivate?: () => boolean
  disabled?: boolean
  /** 처리 중(서버 계산 등) — 인장은 열린 채로 있고 다시 누를 수 없다. false로 돌아오면 인장이 다시 붙는다 */
  busy?: boolean
  /** busy 동안 보일 글(없으면 label) */
  busyLabel?: ReactNode
  /** 인장 아래 작은 글(선택) */
  sub?: ReactNode
  size?: "sm" | "md" | "lg"
  /** 기본 submit */
  type?: "submit" | "button"
}

type SealState = "idle" | "breaking" | "open"
const BREAK_MS = 600

/**
 * 붉은 밀랍 인장 버튼 — 흘러내린 가장자리의 밀랍, 가운데 눌린 원판에 運 음각.
 * 누르면 금이 가고 두 쪽으로 벌어지며(봉인 해제, 0.6초) 그 뒤 onActivate. 움직임 줄이기면 바로.
 * 실제 <button type="submit">. Enter 키로 폼을 보내도(암묵 제출 = 이 버튼 click) 같은 연출을 거친다.
 */
export function UmWaxSeal({
  label = "나의 운명비서 열기",
  onActivate,
  beforeActivate,
  disabled,
  busy,
  busyLabel,
  sub,
  size = "md",
  type = "submit",
  className,
  ...rest
}: UmWaxSealProps) {
  const [state, setState] = useState<SealState>("idle")
  const timer = useRef<number | undefined>(undefined)
  const sawBusy = useRef(false)
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "")
  const ids = { body: `ub-s${uid}-b`, l: `ub-s${uid}-l`, r: `ub-s${uid}-r`, disc: `ub-s${uid}-d`, g: `ub-s${uid}-g`, gd: `ub-s${uid}-gd`, t: `ub-s${uid}-t`, sh: `ub-s${uid}-sh`, blob: `ub-s${uid}-o` }

  useEffect(() => () => window.clearTimeout(timer.current), [])
  // 열린 뒤: busy가 켜져 있으면 기다리고, 꺼지면(또는 끝내 켜지지 않으면) 인장을 다시 붙인다
  useEffect(() => {
    if (busy) {
      sawBusy.current = true
      return
    }
    if (state !== "open") return
    const t = window.setTimeout(() => {
      sawBusy.current = false
      setState("idle")
    }, sawBusy.current ? 250 : 1800)
    return () => window.clearTimeout(t)
  }, [busy, state])

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget
    const form = btn.form
    e.preventDefault()
    if (disabled || busy || state !== "idle") return
    if (beforeActivate) {
      if (beforeActivate() === false) return
    } else if (form && !form.noValidate && !form.reportValidity()) {
      return
    }
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    setState("breaking")
    timer.current = window.setTimeout(() => {
      setState("open")
      if (onActivate) onActivate()
      else if (form && type === "submit") form.requestSubmit(btn)
    }, reduce ? 0 : BREAK_MS)
  }

  const body = (
    <>
      {/* 밀랍 몸 */}
      <path d={A.blob} fill={`url(#${ids.g})`} />
      <path d={A.blob} fill="#000" filter={`url(#${ids.t})`} opacity="0.32" />
      <path d={A.blob} fill="none" stroke="#2c0c09" strokeOpacity="0.55" strokeWidth="0.9" />
      {/* 눌려 솟은 둘레(등불 쪽 위왼쪽이 밝다) */}
      <circle cx="60" cy="60" r="36.5" fill="none" stroke="#8f3d33" strokeOpacity="0.5" strokeWidth="2.4" transform="translate(-0.7 -0.9)" />
      <circle cx="60" cy="60" r="36.5" fill="none" stroke="#3a100d" strokeOpacity="0.45" strokeWidth="1.6" transform="translate(0.8 1)" />
      {/* 눌린 원판 — 안쪽 위왼쪽 벽은 그늘, 아래오른쪽 벽은 빛 */}
      <path d={A.disc} fill={`url(#${ids.gd})`} />
      <g clipPath={`url(#${ids.disc})`}>
        <path d={A.disc} fill="none" stroke="#2a0a08" strokeOpacity="0.7" strokeWidth="3.2" transform="translate(1.6 1.9)" />
        <path d={A.disc} fill="none" stroke="#b0574a" strokeOpacity="0.4" strokeWidth="2" transform="translate(-1.4 -1.6)" />
      </g>
      {/* 음각 둘레 선 */}
      <circle cx="60" cy="60" r="28.6" fill="none" stroke="#3a100d" strokeOpacity="0.75" strokeWidth="0.9" />
      <circle cx="60" cy="60" r="28.6" fill="none" stroke="#a5503f" strokeOpacity="0.35" strokeWidth="0.7" transform="translate(0.6 0.7)" />
      {/* 運 음각: 밝은 아래쪽 벽 → 어두운 파인 면 */}
      <g transform="translate(0.7 0.8)">
        <path d={A.glyph} transform={A.glyphTransform} fill="#a9554a" fillOpacity="0.45" />
      </g>
      <path d={A.glyph} transform={A.glyphTransform} fill="#360d0a" fillOpacity="0.92" />
      {/* 약한 광택(등불 쪽) */}
      <ellipse cx="40" cy="31" rx="15" ry="7" transform="rotate(-32 40 31)" fill="#ffe6d0" opacity="0.1" filter={`url(#${ids.sh})`} />
    </>
  )

  const text = busy && busyLabel ? busyLabel : label
  return (
    <button
      type={type}
      className={cx("ub-seal", size !== "md" && `ub-seal--${size}`, className)}
      data-state={state}
      disabled={disabled}
      aria-busy={busy ? true : undefined}
      aria-disabled={busy ? true : undefined}
      onClick={handleClick}
      {...rest}
    >
      <svg className="ub-seal__wax" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id={ids.g} cx="0.38" cy="0.32" r="0.78">
            <stop offset="0" stopColor="#87362e" />
            <stop offset="0.5" stopColor="#6c2823" />
            <stop offset="1" stopColor="#4a1713" />
          </radialGradient>
          <radialGradient id={ids.gd} cx="0.62" cy="0.66" r="0.72">
            <stop offset="0" stopColor="#74302a" />
            <stop offset="1" stopColor="#57201b" />
          </radialGradient>
          <filter id={ids.t} x="0" y="0" width="1" height="1">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n" />
            <feColorMatrix in="n" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 0.82" result="a" />
            <feComposite in="a" in2="SourceGraphic" operator="in" />
          </filter>
          <filter id={ids.sh} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <clipPath id={ids.disc}>
            <path d={A.disc} />
          </clipPath>
          <clipPath id={ids.blob}>
            <path d={A.blob} />
          </clipPath>
          <clipPath id={ids.l}>
            <path d={A.clipLeft} />
          </clipPath>
          <clipPath id={ids.r}>
            <path d={A.clipRight} />
          </clipPath>
          <g id={ids.body}>{body}</g>
        </defs>
        <use className="ub-seal__whole" href={`#${ids.body}`} />
        <g className="ub-seal__half ub-seal__half--l" clipPath={`url(#${ids.l})`}>
          <use href={`#${ids.body}`} />
        </g>
        <g className="ub-seal__half ub-seal__half--r" clipPath={`url(#${ids.r})`}>
          <use href={`#${ids.body}`} />
        </g>
        <g clipPath={`url(#${ids.blob})`}>
          <path className="ub-seal__crack" d={A.crack} pathLength={1} />
          <path className="ub-seal__branch" d={A.crackBranch} />
        </g>
      </svg>
      <span className="ub-seal__label">{text}</span>
      {sub && <span className="ub-seal__sub">{sub}</span>}
    </button>
  )
}
