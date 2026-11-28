import type { ButtonHTMLAttributes } from "react"
import { cx } from "./cx"

export type UmButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** 44px 보조 크기(기본은 52px 주 버튼) */
  size?: "md" | "sm"
  /** 가로 꽉 채우기 */
  block?: boolean
}

/**
 * 붉은 봉인 버튼 — 화면마다 주 행동 하나에만(예: "운명비서 펼치기", "기록하고 넘기기").
 * 링크로 쓰려면 버튼 대신 <Link className={umButtonClass("seal")}> 를 쓴다.
 * 서버·클라이언트 어느 쪽에서도 쓸 수 있다(onClick을 넘기면 부모가 클라이언트 컴포넌트여야 한다).
 */
export function UmSealButton({ size = "md", block, className, type = "button", ...rest }: UmButtonProps) {
  return <button type={type} className={cx(umButtonClass("seal", { size, block }), className)} {...rest} />
}

/** 링크·기타 요소에 버튼 모양만 입힐 때 */
export function umButtonClass(kind: "seal" | "brass", { size = "md", block = false }: { size?: "md" | "sm"; block?: boolean } = {}) {
  return cx("um-btn", `um-btn--${kind}`, size === "sm" && "um-btn--sm", block && "um-btn--block")
}
