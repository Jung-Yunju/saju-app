import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react"
import { cx } from "./cx"

type Common = {
  label: ReactNode
  /** 입력칸 아래 도움말(항상 보임, aria-describedby로 연결) */
  help?: ReactNode
  /** 오류 문구 — 있으면 aria-invalid, 문구는 aria-live로 읽힌다 */
  error?: ReactNode
  /** default: 밑줄형 한 칸 / ledger: 기록부 한 줄(왼쪽 항목 칸 + 오른쪽 기입 칸) — UmLedgerPage 안에서 */
  variant?: "default" | "ledger"
  /** 필수 표시 문구(예: "필수"). 실제 required 속성은 따로 넘긴다 */
  requiredMark?: ReactNode
  className?: string
}

type AsInput = Common & { as?: "input" } & InputHTMLAttributes<HTMLInputElement>
type AsSelect = Common & { as: "select"; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>
type AsTextarea = Common & { as: "textarea" } & TextareaHTMLAttributes<HTMLTextAreaElement>
export type UmFieldProps = AsInput | AsSelect | AsTextarea

/**
 * 입력칸 — 실제 <input>/<select>/<textarea>를 그대로 그린다(라벨 for·도움말·오류 연결).
 * value/onChange/name/required/autoComplete/inputMode 등 HTML 속성은 그대로 넘긴다.
 * onChange를 쓰면 부모가 클라이언트 컴포넌트여야 한다. 폼 액션(서버)만 쓰면 서버 컴포넌트에서도 된다.
 */
export function UmField(props: UmFieldProps) {
  const { label, help, error, variant = "default", requiredMark, className } = props
  const auto = useId()
  const id = props.id ?? `um-f${auto}`
  const helpId = `${id}-help`
  const errId = `${id}-err`
  const describedBy = cx(help ? helpId : null, error ? errId : null, props["aria-describedby"]) || undefined
  const a11y = {
    id,
    "aria-describedby": describedBy,
    "aria-invalid": error ? (true as const) : undefined,
    className: "um-field__control",
  }

  let control: ReactNode
  let wrapClass = "um-field__wrap"
  if (props.as === "select") {
    const { children, ...sel } = strip(props)
    wrapClass += " um-field__wrap--select"
    control = (
      <select {...sel} {...a11y}>
        {children}
      </select>
    )
  } else if (props.as === "textarea") {
    control = <textarea {...strip(props)} {...a11y} />
  } else {
    control = <input {...strip(props)} {...a11y} />
  }

  return (
    <div className={cx("um-field", variant === "ledger" && "um-field--ledger", className)}>
      <label className="um-field__label" htmlFor={id}>
        {label}
        {requiredMark && <span className="um-field__req">{requiredMark}</span>}
      </label>
      <div className={wrapClass}>{control}</div>
      {help && (
        <p className="um-field__help" id={helpId}>
          {help}
        </p>
      )}
      <p className="um-field__error" id={errId} aria-live="polite">
        {error}
      </p>
    </div>
  )
}

/** 우리 쪽 속성(label·help…)을 빼고 HTML 속성만 남긴다 */
function strip<T extends Common & { as?: string; id?: string; "aria-describedby"?: string }>(p: T) {
  const { label, help, error, variant, requiredMark, className, as, id, "aria-describedby": d, ...html } = p
  void [label, help, error, variant, requiredMark, className, as, id, d]
  return html
}
