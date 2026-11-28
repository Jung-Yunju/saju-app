import type { ReactNode } from "react"
import { cx } from "./cx"

export type UmChapterTitleProps = {
  /** 제목 위 작은 표식(예: "운명비서 · 첫째 권") */
  kicker?: ReactNode
  title: ReactNode
  /** 제목 아래 한두 줄 */
  lead?: ReactNode
  as?: "h1" | "h2" | "h3"
  align?: "start" | "center"
  id?: string
  className?: string
}

/** 어두운 서재 위 장 제목(황동). 종이 안에서는 먹색으로 바뀐다 */
export function UmChapterTitle({ kicker, title, lead, as: H = "h2", align = "start", id, className }: UmChapterTitleProps) {
  return (
    <header className={cx("um-ct", align === "center" && "um-ct--center", className)}>
      {kicker && <p className="um-ct__kicker">{kicker}</p>}
      <H className="um-ct__title" id={id}>
        {title}
      </H>
      {lead && <p className="um-ct__lead">{lead}</p>}
    </header>
  )
}
