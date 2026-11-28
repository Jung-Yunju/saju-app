import { useId, type ReactNode } from "react"
import { cx } from "../cx"
import { UmChapterHead } from "./UmChapterHead"

export type UmBookPageProps = {
  /** 장 번호(第一章 · 첫째 장) */
  no?: number
  /** 장 번호 대신 쓸 머리글 */
  kicker?: ReactNode
  /** 제목 — 없으면 머리 없이 본문만(앞 쪽에서 이어지는 쪽) */
  title?: ReactNode
  lead?: ReactNode
  /** 제목 요소 단계(기본 h2) */
  titleAs?: "h1" | "h2" | "h3"
  align?: "center" | "start"
  /** 본문 — <p>·<ul>·<blockquote>(할머니 말)·<h3> 를 그대로. 글꼴·간격은 .ub-prose 가 맞춘다 */
  children?: ReactNode
  /** 본문 아래(근거 펼침·다음 장 버튼 등) */
  footer?: ReactNode
  /** 쪽 번호(아래 가운데, 예: "一" 또는 "3") */
  folio?: ReactNode
  /** 바깥 요소: article(기본) / section / div */
  as?: "article" | "section" | "div"
  id?: string
  className?: string
}

/**
 * 책 안 한 쪽 — 무료·유료 결과의 장 하나. UmBook 쪽 안에 넣는다(여러 개를 이어 놓으면 사이에 먹점 셋으로 쪽이 나뉜다).
 * 제목이 있으면 aria-labelledby로 이어 준다. 훅은 useId뿐 → 서버·클라이언트 어디서나.
 */
export function UmBookPage({ no, kicker, title, lead, titleAs = "h2", align = "center", children, footer, folio, as: Tag = "article", id, className }: UmBookPageProps) {
  const auto = useId().replace(/[^a-zA-Z0-9_-]/g, "")
  const headId = title ? `ub-p${auto}-t` : undefined
  return (
    <Tag className={cx("ub-bookpage", className)} id={id} aria-labelledby={headId}>
      {title && <UmChapterHead no={no} kicker={kicker} title={title} lead={lead} as={titleAs} align={align} id={headId} />}
      {children && <div className="ub-prose">{children}</div>}
      {footer && <div className="ub-bookpage__foot">{footer}</div>}
      {folio != null && (
        <span className="ub-folio" aria-hidden="true">
          {folio}
        </span>
      )}
    </Tag>
  )
}
