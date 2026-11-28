import { cx } from "./cx"

export type UmDividerProps = {
  /** plain: 선 한 줄 / mark: 가운데 작은 황동 마름모 / seal: 가운데 작은 붉은 네모 */
  variant?: "plain" | "mark" | "seal"
  /** 장식일 뿐이면 true(기본) — 화면낭독기가 건너뛴다. 내용 구획을 나누는 뜻이 있으면 false */
  decorative?: boolean
  className?: string
}

export function UmDivider({ variant = "mark", decorative = true, className }: UmDividerProps) {
  const a11y = decorative ? { "aria-hidden": true as const } : { role: "separator" as const }
  return (
    <div className={cx("um-divider", `um-divider--${variant}`, className)} {...a11y}>
      {variant !== "plain" && <span className="um-divider__mark" />}
    </div>
  )
}
