import type { ReactNode } from "react"
import { cx } from "../cx"

export type UmBookProps = {
  /**
   * single = 한 권을 세로로 읽는 한 쪽(모바일) — children을 쓴다.
   * spread = 펼친 양면(PC) — left·right를 쓴다.
   * auto   = 화면 폭 960px 이상이면 spread, 좁으면 left 다음 right를 한 쪽에 이어서(자바스크립트 없이 CSS로 전환).
   */
  layout: "single" | "spread" | "auto"
  left?: ReactNode
  right?: ReactNode
  /** single일 때 쪽 내용 */
  children?: ReactNode
  /** 표지가 넘어가며 펼쳐지는 연출(0.9초). 움직임 줄이기 설정이면 연출 없이 바로 펼친 상태 */
  opening?: boolean
  /** 왼쪽 쪽 내용 세로 정렬(기본 start). center = 제목·인장처럼 쪽 가운데에 */
  leftAlign?: "start" | "center"
  /** 오른쪽 쪽(또는 single 쪽) 내용 세로 정렬(기본 start) */
  rightAlign?: "start" | "center"
  /** 고서 전체 이름(화면낭독기). 예: "운명비서 입력" — 주면 role="region" */
  label?: string
  className?: string
}

/**
 * 화면 중앙의 입체 고서 — 가죽 표지(결·닳은 모서리·두께·책등) + 고급 종이(섬유·그을린 가장자리·등불 빛) + 종이 단면 층 + 바닥 그림자.
 * 내용은 각 쪽의 .ub-book__content 안에 그대로 그린다(폼·글은 부모가). 서버·클라이언트 어디서나(훅 없음).
 */
export function UmBook({ layout, left, right, children, opening, leftAlign, rightAlign, label, className }: UmBookProps) {
  const page = (side: "left" | "right" | "single", body: ReactNode) => (
    <div className={`ub-book__page ub-book__page--${side}`} data-align={(side === "left" ? leftAlign : rightAlign) ?? undefined}>
      <div className="ub-book__content">{body}</div>
    </div>
  )
  let block: ReactNode
  if (layout === "spread") {
    block = (
      <>
        {page("left", left)}
        {page("right", right)}
      </>
    )
  } else if (layout === "auto") {
    block = (
      <>
        <div className="ub-book__leaf" aria-hidden="true" />
        <div className="ub-book__pages">
          {page("left", left)}
          {page("right", right)}
        </div>
      </>
    )
  } else {
    block = (
      <>
        <div className="ub-book__leaf" aria-hidden="true" />
        {page("single", children)}
      </>
    )
  }
  return (
    <div
      className={cx("ub-book", `ub-book--${layout}`, opening && "ub-book--opening", className)}
      role={label ? "region" : undefined}
      aria-label={label}
    >
      <div className="ub-book__shadow" aria-hidden="true" />
      <div className="ub-book__body">
        <div className="ub-book__block">{block}</div>
      </div>
      {opening && (
        <div className="ub-book__flap" aria-hidden="true">
          <div className="ub-book__flap-face ub-book__flap-front">
            <span className="ub-book__flap-label" lang="ko-Hani">運命秘書</span>
          </div>
          <div className="ub-book__flap-face ub-book__flap-back" />
        </div>
      )}
    </div>
  )
}
