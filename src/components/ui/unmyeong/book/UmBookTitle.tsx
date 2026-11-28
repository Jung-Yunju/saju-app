import type { ReactNode } from "react"
import { cx } from "../cx"

export type UmBookTitleProps = {
  /** 큰 한자 제목(기본 運命秘書) — 화면낭독기에는 읽히지 않고 title이 읽힌다 */
  hanja?: string
  /** 한글 제목(기본 운명비서) — 제목 요소의 실제 이름 */
  title?: string
  /** 한 줄 문구(기본 "세상에 단 한 권, 오직 너를 위한 기록.") — null이면 없음 */
  tagline?: ReactNode | null
  /** 제목 요소(기본 h1) */
  as?: "h1" | "h2"
  id?: string
  className?: string
}

/** 중앙 정렬 제목 묶음 — 運命秘書(큰 붓 명조) / 운명비서(넓은 자간) / 가는 황동선 / 한 줄 문구 */
export function UmBookTitle({ hanja = "運命秘書", title = "운명비서", tagline = "세상에 단 한 권, 오직 너를 위한 기록.", as: H = "h1", id, className }: UmBookTitleProps) {
  return (
    <header className={cx("ub-title", className)}>
      <H className="ub-title__head" id={id}>
        <span className="ub-title__han" lang="ko-Hani" aria-hidden="true">
          {hanja}
        </span>
        <span className="ub-title__ko">{title}</span>
      </H>
      <span className="ub-title__rule" aria-hidden="true" />
      {tagline != null && <p className="ub-title__tagline">{tagline}</p>}
    </header>
  )
}
