import type { ReactNode } from "react"
import { cx } from "../cx"
import { chapterLabels } from "../chapter"

export type UmChapterHeadProps = {
  /** 장 번호 → "第一章 · 첫째 장"(붉은 먹). 없으면 kicker만 */
  no?: number
  /** 장 번호 자리에 쓸 글(no보다 앞선다). 예: "무료 풀이" */
  kicker?: ReactNode
  title: ReactNode
  /** 제목 아래 한두 줄(붓 명조, 옅은 먹) */
  lead?: ReactNode
  as?: "h1" | "h2" | "h3"
  /** center(기본) / start(왼쪽 정렬 — 긴 본문 쪽) */
  align?: "center" | "start"
  id?: string
  className?: string
}

/** 장 머리 — 붉은 먹 장 번호 · 큰 붓 명조 제목 · 가는 황동선 · 한두 줄 */
export function UmChapterHead({ no, kicker, title, lead, as: H = "h2", align = "center", id, className }: UmChapterHeadProps) {
  const lbl = no != null ? chapterLabels(no) : null
  return (
    <header className={cx("ub-chapter", align === "start" && "ub-chapter--start", className)}>
      {(kicker || lbl) && (
        <p className="ub-chapter__no">
          {kicker ?? (
            <>
              <span className="ub-chapter__han" lang="ko-Hani" aria-hidden="true">
                {lbl!.han}
              </span>
              <span className="ub-chapter__dot" aria-hidden="true">
                ·
              </span>
              <span>{lbl!.ko}</span>
            </>
          )}
        </p>
      )}
      <H className="ub-chapter__title" id={id}>
        {title}
      </H>
      <span className="ub-chapter__rule" aria-hidden="true" />
      {lead && <p className="ub-chapter__lead">{lead}</p>}
    </header>
  )
}
