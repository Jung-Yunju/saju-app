import type { CSSProperties } from "react"
import { cx } from "./cx"

export type UmStampProps = {
  /** 도장 글자(기본 "1급 비밀") */
  children?: string
  size?: "md" | "lg"
  /** 기울기(도). 기본 -5 — 영상 마지막 프레임과 같게 맞춘 값(DESIGN_SYSTEM 8-6) */
  rotate?: number
  className?: string
}

/** 붉은 사각 도장(인주가 고르지 않게 찍힌 자국). 글자는 실제 텍스트라 화면낭독기가 읽는다 */
export function UmStamp({ children = "1급 비밀", size = "md", rotate, className }: UmStampProps) {
  return (
    <span
      className={cx("um-stamp", size === "lg" && "um-stamp--lg", className)}
      style={rotate === undefined ? undefined : ({ "--um-stamp-rotate": `${rotate}deg` } as CSSProperties)}
    >
      {children}
    </span>
  )
}
