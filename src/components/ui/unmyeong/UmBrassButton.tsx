import { cx } from "./cx"
import { umButtonClass, type UmButtonProps } from "./UmSealButton"

/**
 * 황동 테두리 버튼 — 보조 행동(다시 보기, 이전 장, 건너뛰기 등).
 * 종이(.um-paper) 안에서는 짙은 황동 선 + 먹 글자로 자동으로 바뀐다.
 */
export function UmBrassButton({ size = "md", block, className, type = "button", ...rest }: UmButtonProps) {
  return <button type={type} className={cx(umButtonClass("brass", { size, block }), className)} {...rest} />
}
