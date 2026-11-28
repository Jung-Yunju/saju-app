import type { ReactNode } from "react"
import { cx } from "./cx"

export type UmFoldProps = {
  /** 접힌 줄 글(기본 "할미는 어떻게 알았을까?") */
  summary?: ReactNode
  /** 오른쪽 작은 안내(예: "근거 보기") */
  hint?: ReactNode
  /** 처음부터 펼쳐 둘지 */
  defaultOpen?: boolean
  children: ReactNode
  className?: string
}

/**
 * 펼침 — <details>/<summary> 기반이라 자바스크립트 없이 열리고, 키보드(Enter·Space)·화면낭독기가 그대로 동작한다.
 * 주 용도: 무료·유료 결과의 근거("할미는 어떻게 알았을까?").
 */
export function UmFold({ summary = "할미는 어떻게 알았을까?", hint, defaultOpen, children, className }: UmFoldProps) {
  return (
    <details className={cx("um-fold", className)} open={defaultOpen}>
      <summary className="um-fold__summary">
        <span className="um-fold__mark" aria-hidden="true" />
        <span>{summary}</span>
        {hint && <span className="um-fold__hint">{hint}</span>}
      </summary>
      <div className="um-fold__body">{children}</div>
    </details>
  )
}
