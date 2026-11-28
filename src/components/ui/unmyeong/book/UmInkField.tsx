import { useId, type CSSProperties, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react"
import { cx } from "../cx"

type Common = {
  /** 작은 명조 라벨(옅은 먹) */
  label: ReactNode
  /** 도움말 — 항상 보이고 aria-describedby로 연결 */
  hint?: ReactNode
  /** hint와 같다(기존 UmField에서 옮겨 올 때 그대로 쓰도록) */
  help?: ReactNode
  /** 오류(붉은 먹 작은 글씨) — 있으면 aria-invalid, aria-live로 읽힌다 */
  error?: ReactNode
  /** 필수 표시 글(예: "꼭"). 실제 required 속성은 따로 */
  requiredMark?: ReactNode
  /** 값 뒤에 붙는 글(예: "년", "시") */
  suffix?: ReactNode
  className?: string
}
type AsInput = Common & { as?: "input" } & Omit<InputHTMLAttributes<HTMLInputElement>, "size">
type AsSelect = Common & { as: "select"; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>
/** 여러 칸 묶음(년·월·일 등) — children에 UmInkPart 여러 개. 라벨은 role="group"의 이름이 된다 */
type AsGroup = Common & { as: "group"; children: ReactNode; id?: string }
export type UmInkFieldProps = AsInput | AsSelect | AsGroup

/**
 * 고서에 직접 적는 칸 — 테두리·배경 없이 붓 명조 글자 + 아주 옅은 붓 밑줄(포커스 시 먹이 가운데서 번지며 진해짐).
 * 실제 <input>/<select>를 그대로 그린다(label for · 도움말·오류 aria-describedby · aria-invalid).
 * value/onChange/name/required/autoComplete/inputMode 등 HTML 속성은 그대로 넘긴다. 훅은 useId뿐 → 서버·클라이언트 어디서나.
 */
export function UmInkField(props: UmInkFieldProps) {
  const { label, error, requiredMark, suffix, className } = props
  const hint = props.hint ?? props.help
  const auto = useId()
  const id = props.id ?? `ub-f${auto.replace(/[^a-zA-Z0-9_-]/g, "")}`
  const hintId = `${id}-hint`
  const errId = `${id}-err`
  const labelId = `${id}-label`
  const extra = props.as === "group" ? undefined : props["aria-describedby"]
  const describedBy = cx(hint ? hintId : null, error ? errId : null, extra) || undefined

  const head = (
    <>
      {requiredMark && <span className="ub-ink__req">{requiredMark}</span>}
    </>
  )
  const foot = (
    <>
      {hint && (
        <p className="ub-ink__hint" id={hintId}>
          {hint}
        </p>
      )}
      <p className="ub-ink__error" id={errId} aria-live="polite">
        {error}
      </p>
    </>
  )

  if (props.as === "group") {
    return (
      <div
        className={cx("ub-ink", "ub-ink--group", error ? "ub-ink--error" : null, className)}
        role="group"
        aria-labelledby={labelId}
        aria-describedby={describedBy}
      >
        <span className="ub-ink__label" id={labelId}>
          {label}
          {head}
        </span>
        <div className="ub-ink__group">{props.children}</div>
        {foot}
      </div>
    )
  }

  const a11y = {
    id,
    "aria-describedby": describedBy,
    "aria-invalid": error ? (true as const) : undefined,
    className: "ub-ink__control",
  }
  let control: ReactNode
  if (props.as === "select") {
    const { children, ...sel } = stripSelect(props)
    control = (
      <>
        <span className="ub-ink__sel">
          <select {...sel} {...a11y}>
            {children}
          </select>
          <InkCaret />
        </span>
      </>
    )
  } else {
    control = <input {...stripInput(props)} {...a11y} />
  }

  return (
    <div className={cx("ub-ink", error ? "ub-ink--error" : null, className)}>
      <label className="ub-ink__label" htmlFor={id}>
        {label}
        {head}
      </label>
      <div className="ub-ink__wrap">
        {control}
        {suffix && (
          <span className="ub-ink__suffix" aria-hidden="true">
            {suffix}
          </span>
        )}
        <span className="ub-ink__line" aria-hidden="true" />
        <span className="ub-ink__wet" aria-hidden="true" />
      </div>
      {foot}
    </div>
  )
}

type PartCommon = {
  /** 화면낭독기 이름(예: "태어난 해") — 묶음 라벨과 함께 읽힌다 */
  "aria-label": string
  suffix?: ReactNode
  invalid?: boolean
  /** 칸 너비(글자 수, 기본 4) — 예: 해 4, 달·날 2 */
  chars?: number
  className?: string
}
export type UmInkPartProps =
  | (PartCommon & { as?: "input" } & Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "aria-label">)
  | (PartCommon & { as: "select"; children: ReactNode } & Omit<SelectHTMLAttributes<HTMLSelectElement>, "aria-label">)

/** UmInkField as="group" 안의 한 칸(년·월·일·시·분). 밑줄·포커스 번짐은 같다 */
export function UmInkPart(props: UmInkPartProps) {
  const { suffix, invalid, chars = 4, className } = props
  const common = { className: "ub-ink__control", "aria-invalid": invalid ? (true as const) : undefined, "aria-label": props["aria-label"] }
  let control: ReactNode
  if (props.as === "select") {
    const { as, suffix: s, invalid: i, chars: n, className: c, children, ...sel } = props
    void [as, s, i, n, c]
    control = (
      <>
        <span className="ub-ink__sel">
          <select {...sel} {...common}>
            {children}
          </select>
          <InkCaret />
        </span>
      </>
    )
  } else {
    const { as, suffix: s, invalid: i, chars: n, className: c, ...inp } = props
    void [as, s, i, n, c]
    control = <input {...inp} {...common} />
  }
  return (
    <span
      className={cx("ub-ink__part", "ub-ink__wrap", invalid && "ub-ink--error", className)}
      style={{ "--ub-part-w": `${(chars * 0.62 + (props.as === "select" ? 1.6 : 0.5)).toFixed(2)}em` } as CSSProperties}
    >
      {control}
      {suffix && (
        <span className="ub-ink__suffix" aria-hidden="true">
          {suffix}
        </span>
      )}
      <span className="ub-ink__line" aria-hidden="true" />
      <span className="ub-ink__wet" aria-hidden="true" />
    </span>
  )
}

function InkCaret() {
  return (
    <svg className="ub-ink__caret" viewBox="0 0 14 10" aria-hidden="true" focusable="false">
      <path d="M1.5 2.2C4 4.6 5.6 6.4 7.1 8.3C8.6 6.2 10.4 4.2 12.6 1.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function stripInput(p: AsInput) {
  const { label, hint, help, error, requiredMark, suffix, className, as, id, "aria-describedby": d, ...html } = p
  void [label, hint, help, error, requiredMark, suffix, className, as, id, d]
  return html
}
function stripSelect(p: AsSelect) {
  const { label, hint, help, error, requiredMark, suffix, className, as, id, "aria-describedby": d, ...html } = p
  void [label, hint, help, error, requiredMark, suffix, className, as, id, d]
  return html
}
