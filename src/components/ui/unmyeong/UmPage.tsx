import { useId, type ReactNode } from "react"
import { chapterLabels } from "./chapter"
import { cx } from "./cx"

export type UmPageProps = {
  /** 장 번호(1~10이면 "第一章 · 첫째 장"으로 표기) */
  no?: number
  /** 장 번호 표기를 직접 정할 때(예: "서(序)") — no보다 우선 */
  noLabel?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  /** 제목 단계(화면 구조에 맞춰). 기본 h2 */
  headingLevel?: 1 | 2 | 3
  /** paper: 고서 종이(기본) / dark: 어두운 서재 면 */
  tone?: "paper" | "dark"
  /** 장 아래쪽(버튼·펼침 등) */
  footer?: ReactNode
  children?: ReactNode
  className?: string
  id?: string
}

/**
 * 고서 한 장 — 장 번호·제목 머리 + 본문(.um-prose). 무료 결과 5장, 유료 권의 장에 쓴다.
 * 훅은 useId 하나뿐이라 서버 컴포넌트에서도 클라이언트 컴포넌트에서도 쓸 수 있다.
 */
export function UmPage({ no, noLabel, title, subtitle, headingLevel = 2, tone = "paper", footer, children, className, id }: UmPageProps) {
  const titleId = useId()
  const H = `h${headingLevel}` as const
  const labels = no === undefined ? null : chapterLabels(no)
  return (
    <article
      id={id}
      className={cx("um-page", tone === "paper" ? "um-paper" : "um-page--dark", className)}
      aria-labelledby={titleId}
    >
      <header className="um-page__head">
        {noLabel ? (
          <p className="um-page__no">{noLabel}</p>
        ) : (
          labels && (
            <p className="um-page__no">
              <span className="um-page__no-han" aria-hidden="true">
                {labels.han}
              </span>
              <span>{labels.ko}</span>
            </p>
          )
        )}
        <H className="um-page__title" id={titleId}>
          {title}
        </H>
        {subtitle && <p className="um-page__sub">{subtitle}</p>}
      </header>
      <div className="um-page__body um-prose">{children}</div>
      {footer && <footer className="um-page__foot">{footer}</footer>}
    </article>
  )
}
