import { useId, type ChangeEventHandler, type ReactNode } from "react"
import { cx } from "./cx"

export type UmChoiceOption = { value: string; label: ReactNode; disabled?: boolean }

export type UmChoiceGroupProps = {
  legend: ReactNode
  name: string
  options: UmChoiceOption[]
  /** 제어형(onChange와 함께) */
  value?: string
  /** 비제어형 기본값 */
  defaultValue?: string
  onChange?: ChangeEventHandler<HTMLInputElement>
  required?: boolean
  help?: ReactNode
  /** default: 칸 나란히 / ledger: 기록부 한 줄 */
  variant?: "default" | "ledger"
  className?: string
}

/**
 * 하나 고르기(양력·음력, 성별 등) — <fieldset>+<legend>+실제 라디오.
 * 라디오는 투명하게 겹쳐 두어 터치(48px)·키보드(화살표)·화면낭독기가 그대로 동작한다.
 */
export function UmChoiceGroup({ legend, name, options, value, defaultValue, onChange, required, help, variant = "default", className }: UmChoiceGroupProps) {
  const uid = useId()
  const helpId = help ? `um-c${uid}-help` : undefined
  const ledger = variant === "ledger"
  return (
    <fieldset className={cx("um-choice", ledger && "um-choice--ledger", className)} aria-describedby={helpId}>
      <legend className={ledger ? "um-visually-hidden" : "um-choice__legend"}>{legend}</legend>
      {ledger && (
        <span className="um-choice__label" aria-hidden="true">
          {legend}
        </span>
      )}
      <div className="um-choice__row">
        {options.map((o) => (
          <label className="um-choice__opt" key={o.value}>
            <input
              className="um-choice__input"
              type="radio"
              name={name}
              value={o.value}
              disabled={o.disabled}
              required={required}
              {...(value !== undefined ? { checked: value === o.value, onChange } : { defaultChecked: defaultValue === o.value, onChange })}
            />
            <span className="um-choice__face">{o.label}</span>
          </label>
        ))}
      </div>
      {help && (
        <p className={ledger ? "um-choice__help" : "um-field__help"} id={helpId}>
          {help}
        </p>
      )}
    </fieldset>
  )
}
